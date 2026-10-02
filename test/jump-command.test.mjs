/**
 * Pure-lane test: the one-slot seat the bell publishes its jump into, and the
 * application command that reads it. No DOM and no React — the command's
 * defaults and its blocked/handled resolutions are the whole contract.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createUnreadJumpSeat, unreadJumpCommand, UNREAD_JUMP_COMMAND,
} from '../.test-build/client/jump-command.js'
// The shipped service's own rules: a default it rejects throws inside
// `ctx.shortcuts.register` and takes the whole client half down with it.
import {
  bindingIssue, isWebBindingAllowed, normalizeBinding,
} from '@deepseek-ai/dsh-client-shortcuts/protocol'

/** Context the keyboard adapter always supplies; the command does not read it. */
const CONTEXT = { region: 'page', modal: null, target: null }

test('the seat is empty until the bell publishes and clears again on unmount', () => {
  const seat = createUnreadJumpSeat()
  assert.equal(seat.current(), null)
  const handler = { available: () => true, run: () => {} }
  const dispose = seat.publish(handler)
  assert.equal(seat.current(), handler)
  dispose()
  assert.equal(seat.current(), null)
})

test('a stale disposer never clears a newer handler', () => {
  const seat = createUnreadJumpSeat()
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
  const command = unreadJumpCommand(createUnreadJumpSeat(), () => '定位下一个未读', '没有未读会话')
  assert.equal(command.id, 'session-ledger.jumpUnread')
  assert.equal(UNREAD_JUMP_COMMAND, 'session-ledger.jumpUnread')
  assert.equal(command.label(), '定位下一个未读')
  assert.deepEqual(command.aliases, ['jump to next unread', 'next unread', 'unread'])
  assert.deepEqual(command.regions, ['page', 'editable'])
  assert.deepEqual(command.modals, [])
})

test('the defaults are Mod+Shift+J on macOS and Mod+Alt+J elsewhere', () => {
  const command = unreadJumpCommand(createUnreadJumpSeat(), () => 'x', 'y')
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
  const command = unreadJumpCommand(createUnreadJumpSeat(), () => 'x', 'y')
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
  const command = unreadJumpCommand(createUnreadJumpSeat(), () => 'x', 'y')
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
  const seat = createUnreadJumpSeat()
  const command = unreadJumpCommand(seat, () => 'x', '没有未读会话')
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读会话' })
  seat.publish({ available: () => false, run: () => { throw new Error('must not run') } })
  assert.deepEqual(command.resolve(CONTEXT), { status: 'blocked', reason: '没有未读会话' })
})

test('the handled resolution captures the handler published at resolve time', () => {
  const seat = createUnreadJumpSeat()
  const calls = []
  const command = unreadJumpCommand(seat, () => 'x', '没有未读会话')
  seat.publish({ available: () => true, run: () => calls.push('first') })
  const resolution = command.resolve(CONTEXT)
  assert.equal(resolution.status, 'handled')
  seat.publish({ available: () => true, run: () => calls.push('second') })
  resolution.run()
  assert.deepEqual(calls, ['first'], 'the resolved action is the one that was current')
})
