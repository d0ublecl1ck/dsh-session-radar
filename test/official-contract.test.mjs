/**
 * Contract test against the official packages the client half compiles and runs
 * against: the snapshot fields the readout counts, the two slot names the
 * surfaces register into, the declaration fragments the settings row reaches
 * through `ctx.configForms`, plus the DOM anchors and the Workspace view storage
 * key the bell resolves rows with.
 *
 * The fragments below are fixtures pinned to the official version line this repo
 * develops on (the `@deepseek-ai/*` devDependencies). When a release widens the
 * declared peer range — see `peerDependencies` in package.json — re-capture with
 * `node scripts/capture-official-contract.mjs` and review the diff here: a
 * fragment that moved means `src/` has to change, never this list.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

/** Official packages whose shipped files carry the contracts below. */
const PKGS = {
  sessions: '@deepseek-ai/dsh-api-session-controller',
  workspaces: '@deepseek-ai/dsh-api-workspace-controller',
  uiSession: '@deepseek-ai/dsh-client-ui-session',
  sidebar: '@deepseek-ai/dsh-client-ui-sidebar',
  settings: '@deepseek-ai/dsh-client-ui-settings',
  shortcuts: '@deepseek-ai/dsh-client-shortcuts',
  workspaceUi: '@deepseek-ai/dsh-client-ui-workspace',
}

/** Declared pieces of the official client contracts this plugin reads. */
const DECLARATIONS = [
  // Session list: the readout counts `ids` and reads each row from `byId`.
  [PKGS.sessions, 'lib/types/client/sessions/service.d.ts', [
    'interface SessionListState',
    'ids: SessionId[]',
    'byId: Record<SessionId, SessionSummary>',
    'projectionsBySession: Readonly<Record<SessionId, SessionProjectionSnapshot>>',
  ]],
  [PKGS.sessions, 'lib/types/client/contract/sessions.d.ts', [
    'interface ISessions',
    'readonly list: ObservableSnapshot<SessionListState>',
  ]],
  // Session UI status: the readout's pending / running / unread precedence.
  [PKGS.uiSession, 'lib/types/client/index.d.ts', [
    'interface SessionStatus {',
    'readonly running: boolean | undefined',
    'readonly pendingInteraction: SessionPendingInteraction | undefined',
    'readonly completionUnread: boolean',
    'export type SessionStatusSnapshot = ReadonlyMap<SessionId, SessionStatus>',
  ]],
  // Workspace snapshot: the archived set the readout subtracts.
  [PKGS.workspaces, 'lib/types/client/model.d.ts', [
    'interface WorkspaceSnapshot {',
    'readonly archivedSessionIds:',
  ]],
  // The footer seat both surfaces occupy.
  [PKGS.sidebar, 'lib/types/client/contract/slots.d.ts', [
    "'sidebar.footer.action': {",
    'owner: SidebarFooterActionOwnerProps',
  ]],
  // The settings service shape the settings row reaches through ctx.configForms.
  [PKGS.settings, 'lib/types/client/config-form.d.ts', [
    'getSnapshot(): ConfigFormSnapshot<T>',
    'subscribe(listener: () => void): () => void',
    'set(field: string, value: unknown): Promise<boolean>',
    'whileServed(namespaces: readonly string[]',
  ]],
]

/**
 * Identifiers the shipped browser bundles must keep embedding: the DOM anchors
 * the bell resolves rows and the conversation region through, and the Workspace
 * view store key the manual-unread reader parses.
 */
const SHIPPED = [
  [PKGS.workspaceUi, 'lib/client.js', ['data-row-key', 'listArea', 'sectionHeader']],
  [PKGS.workspaceUi, 'lib/client.js', ['dsh.workspace.view.v5']],
  // The projection key the readout resolves a parent's live subagents through.
  [PKGS.sessions, 'lib/client.js', ['subagentCatalog']],
]

/** The bundle row id this plugin registers; also its settings namespace. */
const ROW_ID = 'session-radar'

/**
 * Compare one installed version against one caret range, prerelease-aware:
 * `^0.1.7-alpha.1` admits `0.1.7-alpha.2` but not `0.2.0-rc.1`.
 * @param version - exact installed version.
 * @param range - one `^`-prefixed range from package.json.
 * @returns whether the version satisfies the range.
 */
function satisfiesCaret(version, range) {
  const trim = range.trim()
  assert.ok(trim.startsWith('^'), `unsupported range ${JSON.stringify(range)}; only caret ranges are declared here`)
  const split = (value) => {
    const [core, pre = ''] = value.replace(/^\^/, '').split('-')
    return { parts: core.split('.').map(Number), pre }
  }
  const want = split(trim)
  const got = split(version)
  // Prerelease ordering: a version with a prerelease is lower than its release.
  const comparePre = (left, right) => {
    if (left === right) return 0
    if (left === '') return 1
    if (right === '') return -1
    return left < right ? -1 : 1
  }
  const compare = (a, b) => {
    for (let index = 0; index < 3; index += 1) {
      const diff = (a.parts[index] ?? 0) - (b.parts[index] ?? 0)
      if (diff !== 0) return diff
    }
    return comparePre(a.pre, b.pre)
  }
  if (compare(got, want) < 0) return false
  const upper = want.parts[0] === 0
    ? { parts: [0, want.parts[1] + 1, 0], pre: '' }
    : { parts: [want.parts[0] + 1, 0, 0], pre: '' }
  return compare(got, upper) < 0
}

/**
 * @param name - official package name.
 * @returns the package's installed directory, or undefined when absent.
 */
function installedDir(name) {
  const dir = join(root, 'node_modules', name)
  return existsSync(dir) ? dir : undefined
}

test('the installed official packages stay inside the declared peer range', () => {
  const declared = pkg.peerDependencies ?? {}
  const checked = []
  for (const name of new Set(Object.values(PKGS))) {
    const dir = installedDir(name)
    if (dir === undefined) continue // optional peer this checkout does not install
    const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
    const range = declared[name]
    assert.ok(range !== undefined, `${name} must stay declared in peerDependencies`)
    const admitted = range.split('||').some((part) => satisfiesCaret(version, part))
    assert.ok(
      admitted,
      `${name}@${version} is installed but peerDependencies declares "${range}". ` +
        'Append the new version segment to that range in package.json, then re-capture this file\'s fixtures.',
    )
    checked.push(`${name}@${version}`)
  }
  assert.ok(checked.length >= 5, `expected the official client packages to be installed, saw ${checked.join(', ')}`)
})

test('the official declarations still carry every field and service face the plugin reads', () => {
  for (const [name, rel, fragments] of DECLARATIONS) {
    const dir = installedDir(name)
    if (dir === undefined) continue
    const text = readFileSync(join(dir, rel), 'utf8')
    for (const fragment of fragments) {
      assert.ok(
        text.includes(fragment),
        `${name}/${rel} no longer contains ${JSON.stringify(fragment)}. ` +
          'The plugin reads this contract: fix src/ against the new shape, then refresh this fixture.',
      )
    }
  }
})

test('the shipped client bundles still embed the DOM anchors and the view store key', () => {
  for (const [name, rel, fragments] of SHIPPED) {
    const dir = installedDir(name)
    if (dir === undefined) continue
    const text = readFileSync(join(dir, rel), 'utf8')
    for (const fragment of fragments) {
      assert.ok(
        text.includes(fragment),
        `${name}/${rel} no longer contains ${JSON.stringify(fragment)}; the browser half addresses the shell through it.`,
      )
    }
  }
})

test('the shortcuts protocol keeps the default-binding rules the commands rely on', async () => {
  if (installedDir(PKGS.shortcuts) === undefined) return
  const protocol = await import('@deepseek-ai/dsh-client-shortcuts/protocol')
  for (const name of ['bindingIssue', 'isWebBindingAllowed', 'normalizeBinding', 'overlappingBindings']) {
    assert.equal(typeof protocol[name], 'function', `the shortcuts protocol must still export ${name}`)
  }
})

test('the Host row id the settings namespace mirrors is still the one the bundle inserts', () => {
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml')
  assert.ok(
    readFileSync(join(root, 'cordis.patch.yml'), 'utf8').includes(`id: ${ROW_ID}`),
    `the bundle patch must keep inserting the Host row under the id ${ROW_ID}`,
  )
})
