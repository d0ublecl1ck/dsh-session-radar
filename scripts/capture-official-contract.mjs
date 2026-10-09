// Capture the official contract fixtures the client half is written against:
// the installed @deepseek-ai/* versions, the declaration fragments that carry
// the fields the plugin reads, and the DOM anchors the shipped client bundles
// embed. Prints a report for review; the assertions themselves live in
// test/official-contract.test.mjs, which must never be updated by copying this
// output blindly — a fragment that moved is a src/ change, not a fixture edit.
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

/** One package plus the files and fragments the plugin depends on. */
const TARGETS = [
  ['@deepseek-ai/dsh-api-session-controller', 'lib/types/client/sessions/service.d.ts', ['interface SessionListState', 'ids: SessionId[]', 'byId: Record<SessionId, SessionSummary>', 'projectionsBySession: Readonly<Record<SessionId, SessionProjectionSnapshot>>']],
  ['@deepseek-ai/dsh-api-session-controller', 'lib/types/client/contract/sessions.d.ts', ['interface ISessions', 'readonly list: ObservableSnapshot<SessionListState>']],
  ['@deepseek-ai/dsh-client-ui-session', 'lib/types/client/index.d.ts', ['interface SessionStatus {', 'readonly running: boolean | undefined', 'readonly pendingInteraction: SessionPendingInteraction | undefined', 'readonly completionUnread: boolean']],
  ['@deepseek-ai/dsh-api-workspace-controller', 'lib/types/client/model.d.ts', ['interface WorkspaceSnapshot {', 'readonly archivedSessionIds:']],
  ['@deepseek-ai/dsh-client-ui-sidebar', 'lib/types/client/contract/slots.d.ts', ["'sidebar.footer.action': {", 'owner: SidebarFooterActionOwnerProps']],
  ['@deepseek-ai/dsh-client-ui-settings', 'lib/types/client/config-form.d.ts', ['getSnapshot(): ConfigFormSnapshot<T>', 'whileServed(namespaces: readonly string[]']],
  ['@deepseek-ai/dsh-api-session-controller', 'lib/client.js', ['subagentCatalog']],
  ['@deepseek-ai/dsh-client-ui-workspace', 'lib/client.js', ['data-row-key', 'listArea', 'sectionHeader']],
  ['@deepseek-ai/dsh-client-locale', 'lib/client.js', ['dsh.workspace.view.v5']],
]

console.log('# official contract capture')
for (const [name, rel, fragments] of TARGETS) {
  const dir = join(root, 'node_modules', name)
  if (!existsSync(join(dir, 'package.json'))) {
    console.log(`\n## ${name}: NOT INSTALLED (optional peer)`)
    continue
  }
  const version = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version
  console.log(`\n## ${name}@${version}`)
  const file = join(dir, rel)
  if (!existsSync(file)) {
    console.log(`  ${rel}: MISSING`)
    continue
  }
  const text = readFileSync(file, 'utf8')
  for (const fragment of fragments) {
    console.log(`  ${text.includes(fragment) ? 'present' : 'ABSENT '} ${JSON.stringify(fragment)}`)
  }
}
