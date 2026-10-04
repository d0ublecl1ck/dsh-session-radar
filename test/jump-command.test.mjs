/**
 * Pure-lane test: the one-slot seat the bell publishes its jump into, and the
 * application command that reads it. No DOM and no React — the command's
 * defaults and its blocked/handled resolutions are the whole contract.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ASK_JUMP_COMMAND, askJumpCommand, createJumpSeat, overviewCommand, OVERVIEW_COMMAND,
  unreadJumpCommand, UNREAD_JUMP_COMMAND,
} from '../.test-build/client/jump-command.js'
// The shipped service's own rules: a default it rejects throws inside
// `ctx.shortcuts.register` and takes the whole client half down with it.
import {
  bindingIssue, isWebBindingAllowed, normalizeBinding, overlappingBindings,
} from '@deepseek-ai/dsh-client-shortcuts/protocol'

/** Context the keyboard adapter always supplies; the command does not read it. */
const CONTEXT = { region: 'page', modal: null, target: null }

test('the seat is empty until the bell publishes and clears again on unmount', () => {
  const seat = createJumpSeat()
  assert.equal(seat.current(), null)
  const handler = { available: () => true, run: () => {} }
  const dispose = seat.publish(handler)
  assert.equal(seat.current(), handler)
  dispose()
  assert.equal(seat.current(), null)
})

test('a stale disposer never clears a newer handler', () => {
  const seat = createJumpSeat()
  const first = { available: () => true, run: () => {} }
  const second = { available: () => true, run: () => {} }
  const disposeFirst = seat.publish(first)
  const disposeSecond = seat.publish(second)
  disposeFirst()
  assert.equal(seat.current(), second, 'the newer handler survives the older cleanup')
  disposeSecond()
  assert.equal(seat.current(), null)
})

test('the command keys its stored override on a stable id and name', () => {
  const command = unreadJumpCommand(createJumpSeat(), () => '定位下一个未读', '没有未读会话')
  assert.equal(command.id, 'session-radar.jumpUnread')
  assert.equal(UNREAD_JUMP_COMMAND, 'session-radar.jumpUnread')
  assert.equal(command.label(), '定位下一个未读')
  assert.deepEqual(command.aliases, ['jump to next unread', 'next unread', 'unread'])
  assert.deepEqual(command.regions, ['page', 'editable'])
  assert.deepEqual(command.modals, [])
})

test('the defaults are Mod+Shift+J on macOS and Mod+Alt+J elsewhere', () => {
  const command = unreadJumpCommand(createJumpSeat(), () => 'x', 'y')
  assert.deepEqual(command.defaults, {
    'desktop:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
    'desktop:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    'desktop:linux': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
    'web:macos': { code: 'KeyJ', modifiers: ['primary', 'shift'] },
    'web:windows': { code: 'KeyJ', modifiers: ['primary', 'alt'] },
  })
  // Linux Web admits none of those combinations, so the owner declares none.
  assert.equal(command.defaults['web:linux'], undefined)
})

test('the macOS defaults avoid Option dead keys and bare-primary Web rejection', () => {
  const command = unreadJumpCommand(createJumpSeat(), () => 'x', 'y')
  for (const profile of ['desktop:macos', 'web:macos']) {
    const binding = command.defaults[profile]
    assert.ok(
      !binding.modifiers.includes('alt'),
      `${profile} must not use Option: the DOM adapter treats a macOS dead key as composition`,
    )
    assert.ok(
      binding.modifiers.includes('shift'),
      `${profile} must not be a bare primary combo: Web rejects it as unsupported-browser`,
    )
  }
})

test('every declared default passes the shipped service legality checks', () => {
  const command = unreadJumpCommand(createJumpSeat(), () => 'x', 'y')
  const profiles = Object.entries(command.defaults)
  assert.equal(profiles.length, 5, 'the five supported profiles declare a default')
  for (const [profile, binding] of profiles) {
    const [runtime, platform] = profile.split(':')
    const normalized = normalizeBinding(binding, platform)
    assert.equal(
      bindingIssue(normalized, runtime, platform), null,
      `${profile} must not be reserved or unsupported`,
    )
    if (runtime === 'web') {
      assert.equal(
        isWebBindingAllowed(normalized, platform), true,
        `${profile} must be a Web-legal combination`,
      )
    }
  }
})

test('the command blocks with the supplied reason while no bell can jump', () => {
  const seat = createJumpSeat()
  const command = unreadJumpCommand(seat, () => 'x', '没有未读会话')
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读会话' })
  seat.publish({ available: () => false, run: () => { throw new Error('must not run') } })
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读会话' })
})

test('the handled resolution captures the handler published at resolve time', () => {
  const seat = createJumpSeat()
  const calls = []
  const command = unreadJumpCommand(seat, () => 'x', '没有未读会话')
  seat.publish({ available: () => true, run: () => calls.push('first') })
  const resolution = command.resolve(CONTEXT)
  assert.equal(resolution.status, 'handled')
  seat.publish({ available: () => true, run: () => calls.push('second') })
  resolution.run()
  assert.deepEqual(calls, ['first'], 'the resolved action is the one that was current')
})

test('the ask command keys its stored override on a stable id and name', () => {
  const command = askJumpCommand(createJumpSeat(), () => '定位等待处理', '没有等待处理的会话')
  assert.equal(command.id, 'session-radar.jumpAsk')
  assert.equal(ASK_JUMP_COMMAND, 'session-radar.jumpAsk')
  assert.equal(command.label(), '定位等待处理')
  assert.deepEqual(command.aliases, ['jump to pending ask', 'next ask', 'pending ask'])
  assert.deepEqual(command.regions, ['page', 'editable'])
  assert.deepEqual(command.modals, [])
})

test('the ask defaults keep J\'s helper keys and move only the letter', () => {
  const command = askJumpCommand(createJumpSeat(), () => 'x', 'y')
  assert.deepEqual(command.defaults, {
    'desktop:macos': { code: 'KeyI', modifiers: ['primary', 'shift'] },
    'desktop:windows': { code: 'KeyI', modifiers: ['primary', 'alt'] },
    'desktop:linux': { code: 'KeyI', modifiers: ['primary', 'alt'] },
    'web:macos': { code: 'KeyI', modifiers: ['primary', 'shift'] },
    'web:windows': { code: 'KeyI', modifiers: ['primary', 'alt'] },
  })
  assert.equal(command.defaults['web:linux'], undefined)
})

/**
 * The shipped commands that own every simple KeyO shape. `workspace.add`
 * (dsh-client-ui-workspace) takes Mod+O on desktop and Mod+Alt+O on web;
 * `workspace.openLocal` (dsh-client-ui-open-in-app) takes Mod+Alt+O on desktop
 * and Mod+Shift+O on web. The registry throws "Conflicting shortcut defaults"
 * when two commands declare an overlapping default in ANY profile — not just
 * the running one — so this fixture pins the collision that once broke the
 * whole client boot and forces the ask letter off O.
 */
const SHIPPED_KEY_O_COMMANDS = {
  'workspace.add': {
    'desktop:macos': { code: 'KeyO', modifiers: ['primary'] },
    'desktop:windows': { code: 'KeyO', modifiers: ['primary'] },
    'desktop:linux': { code: 'KeyO', modifiers: ['primary'] },
    'web:macos': { code: 'KeyO', modifiers: ['primary', 'alt'] },
    'web:windows': { code: 'KeyO', modifiers: ['primary', 'alt'] },
  },
  'workspace.openLocal': {
    'desktop:macos': { code: 'KeyO', modifiers: ['primary', 'alt'] },
    'desktop:windows': { code: 'KeyO', modifiers: ['primary', 'alt'] },
    'desktop:linux': { code: 'KeyO', modifiers: ['primary', 'alt'] },
    'web:macos': { code: 'KeyO', modifiers: ['primary', 'shift'] },
    'web:windows': { code: 'KeyO', modifiers: ['primary', 'shift'] },
  },
}

test('no ask default overlaps a shipped KeyO binding', () => {
  const command = askJumpCommand(createJumpSeat(), () => 'x', 'y')
  for (const [name, profiles] of Object.entries(SHIPPED_KEY_O_COMMANDS)) {
    for (const [profile, official] of Object.entries(profiles)) {
      const platform = profile.split(':')[1]
      const ours = command.defaults[profile]
      assert.ok(ours, `${profile} declares an ask default`)
      assert.equal(
        overlappingBindings(normalizeBinding(ours, platform), normalizeBinding(official, platform)),
        false,
        `${profile} must not collide with ${name}`,
      )
    }
  }
})

test('every ask default passes the shipped service legality checks too', () => {
  const command = askJumpCommand(createJumpSeat(), () => 'x', 'y')
  const profiles = Object.entries(command.defaults)
  assert.equal(profiles.length, 5, 'the five supported profiles declare a default')
  for (const [profile, binding] of profiles) {
    const [runtime, platform] = profile.split(':')
    const normalized = normalizeBinding(binding, platform)
    assert.equal(
      bindingIssue(normalized, runtime, platform), null,
      `${profile} must not be reserved or unsupported`,
    )
    if (runtime === 'web') {
      assert.equal(
        isWebBindingAllowed(normalized, platform), true,
        `${profile} must be a Web-legal combination`,
      )
    }
  }
})

test('the ask command blocks with the supplied reason while the walk has nowhere to go', () => {
  const seat = createJumpSeat()
  const command = askJumpCommand(seat, () => 'x', '没有等待处理的会话')
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有等待处理的会话' })
  seat.publish({ available: () => false, run: () => { throw new Error('must not run') } })
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有等待处理的会话' })
})

/**
 * The shipped command that owns every simple KeyK shape. `session.search`
 * (dsh-client-ui-sidebar) takes Mod+K on desktop and Mod+Alt+K on web, so the
 * waiting window cannot declare either; the registry throws "Conflicting
 * shortcut defaults" on an overlap in ANY declared profile, not just the
 * running one, which would take the whole client half down at boot.
 */
const SHIPPED_KEY_K_COMMANDS = {
  'session.search': {
    'desktop:macos': { code: 'KeyK', modifiers: ['primary'] },
    'desktop:windows': { code: 'KeyK', modifiers: ['primary'] },
    'desktop:linux': { code: 'KeyK', modifiers: ['primary'] },
    'web:macos': { code: 'KeyK', modifiers: ['primary', 'alt'] },
    'web:windows': { code: 'KeyK', modifiers: ['primary', 'alt'] },
    'web:linux': { code: 'KeyK', modifiers: ['primary', 'alt'] },
  },
}

test('the overview command keys its stored override on a stable id and name', () => {
  const command = overviewCommand(createJumpSeat(), () => '打开待办总览', '没有未读或待决策的会话')
  assert.equal(command.id, 'session-radar.overview')
  assert.equal(OVERVIEW_COMMAND, 'session-radar.overview')
  assert.equal(command.label(), '打开待办总览')
  assert.deepEqual(command.aliases, ['overview', 'waiting overview', 'unread and pending'])
  assert.deepEqual(command.regions, ['page', 'editable'])
  assert.deepEqual(command.modals, [])
})

test('the overview defaults keep one letter and move the helper key to Shift', () => {
  const command = overviewCommand(createJumpSeat(), () => 'x', 'y')
  assert.deepEqual(command.defaults, {
    'desktop:macos': { code: 'KeyK', modifiers: ['primary', 'shift'] },
    'desktop:windows': { code: 'KeyK', modifiers: ['primary', 'shift'] },
    'desktop:linux': { code: 'KeyK', modifiers: ['primary', 'shift'] },
    'web:macos': { code: 'KeyK', modifiers: ['primary', 'shift'] },
    'web:windows': { code: 'KeyK', modifiers: ['primary', 'shift'] },
  })
  // Linux Web admits none of those combinations, so the owner declares none.
  assert.equal(command.defaults['web:linux'], undefined)
})

test('every overview default passes the shipped service legality checks', () => {
  const command = overviewCommand(createJumpSeat(), () => 'x', 'y')
  const profiles = Object.entries(command.defaults)
  assert.equal(profiles.length, 5, 'the five supported profiles declare a default')
  for (const [profile, binding] of profiles) {
    const [runtime, platform] = profile.split(':')
    const normalized = normalizeBinding(binding, platform)
    assert.equal(
      bindingIssue(normalized, runtime, platform), null,
      `${profile} must not be reserved or unsupported`,
    )
    if (runtime === 'web') {
      assert.equal(
        isWebBindingAllowed(normalized, platform), true,
        `${profile} must be a Web-legal combination`,
      )
    }
  }
})

test('no overview default overlaps the shipped KeyK search binding', () => {
  const command = overviewCommand(createJumpSeat(), () => 'x', 'y')
  for (const [name, profiles] of Object.entries(SHIPPED_KEY_K_COMMANDS)) {
    for (const [profile, official] of Object.entries(profiles)) {
      const platform = profile.split(':')[1]
      const ours = command.defaults[profile]
      if (ours === undefined) continue
      assert.equal(
        overlappingBindings(normalizeBinding(ours, platform), normalizeBinding(official, platform)),
        false,
        `${profile} must not collide with ${name}`,
      )
    }
  }
})

test('the three session-radar commands never overlap each other', () => {
  const commands = [
    unreadJumpCommand(createJumpSeat(), () => 'x', 'y'),
    askJumpCommand(createJumpSeat(), () => 'x', 'y'),
    overviewCommand(createJumpSeat(), () => 'x', 'y'),
  ]
  for (const profile of Object.keys(commands[0].defaults)) {
    const platform = profile.split(':')[1]
    for (let left = 0; left < commands.length; left += 1) {
      for (let right = left + 1; right < commands.length; right += 1) {
        assert.equal(
          overlappingBindings(
            normalizeBinding(commands[left].defaults[profile], platform),
            normalizeBinding(commands[right].defaults[profile], platform),
          ),
          false,
          `${profile}: ${commands[left].id} must not collide with ${commands[right].id}`,
        )
      }
    }
  }
})

test('the overview command blocks while nothing waits', () => {
  const seat = createJumpSeat()
  const command = overviewCommand(seat, () => 'x', '没有未读或待决策的会话')
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读或待决策的会话' })
  seat.publish({ available: () => false, run: () => { throw new Error('must not run') } })
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读或待决策的会话' })
})
