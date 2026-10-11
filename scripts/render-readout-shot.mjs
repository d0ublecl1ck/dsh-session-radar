/**
 * Render the sidebar-foot status readout to a standalone HTML page.
 *
 * The readout screenshot used by the README must not come from a live DSH
 * instance: the counters are derived from real Sessions, and a crop of a real
 * footer therefore publishes real (if aggregate) numbers. This script renders
 * the shipped component with a fixed fixture instead — same component, same
 * stylesheet, no instance, no real data — and writes one self-contained page
 * that `scripts/capture-bell.mjs` can crop.
 *
 * Preconditions:
 *   - devDependencies installed (`npm ci`)
 *   - `.test-build/` is current (`node scripts/build-tests.mjs`, which `npm test` runs)
 *   - Google Chrome installed at the default macOS path (only for the capture step)
 * Side effects:
 *   - writes one HTML file (default `/tmp/dsh-readout-preview.html`)
 *
 * Usage:
 *   node scripts/render-readout-shot.mjs [--out-html /tmp/page.html]
 *   node scripts/capture-bell.mjs --url file:///tmp/dsh-readout-preview.html \
 *     --out assets/readout.png --selector '#readout-shot' --pad 10
 */
import { writeFileSync } from 'node:fs'

function arg(name, fallback) {
  const at = process.argv.indexOf('--' + name)
  return at === -1 ? fallback : process.argv[at + 1]
}

const outHtml = arg('out-html', '/tmp/dsh-readout-preview.html')

// The component injects its own stylesheet, so the document has to exist before
// the built client modules are imported.
const { JSDOM } = await import('jsdom')
const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>')
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.Node = dom.window.Node

// The published UI packages are platform modules in the browser and rely on
// the shell's module table; the same node-lane hooks the tests use redirect
// them to the local double and answer their `.module.css` imports.
const { register } = await import('node:module')
register('../test/css-hooks.mjs', import.meta.url)

const React = await import('react')
const { renderToStaticMarkup } = await import('react-dom/server')
const { injectStyles } = await import('../.test-build/client/styles.js')
const { StatusWatch } = await import('../.test-build/client/StatusWatch.js')
const { zh } = await import('../.test-build/client/locales.js')

injectStyles()
const css = document.querySelector('style[data-plugin="dsh-session-radar"]').textContent

/** Bind the shipped Chinese dictionary. */
function translate(key, params) {
  const template = zh[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name]))
}

/**
 * The fixture the readout is rendered against: every metric non-zero, so the
 * picture shows a real mix instead of an empty row. Archived rows are counted,
 * never opened — the readout paints them as a plain count.
 */
const ROWS = [
  ['run-a', { running: true }],
  ['run-b', { running: true }],
  ['ask-a', { running: true, pendingInteraction: { kind: 'question' } }],
  ['unread-a', { completionUnread: true }],
  ['unread-b', { completionUnread: true }],
  ['idle-a', {}],
  ['idle-b', {}],
  ['idle-c', {}],
  ['arch-a', {}],
  ['arch-b', {}],
]
const ARCHIVED = ['arch-a', 'arch-b']

const list = {
  ids: ROWS.map(([id]) => id),
  byId: Object.fromEntries(ROWS.map(([id], index) => [id, { updatedAt: 1_700_000_000_000 - index * 60_000 }])),
}
const statuses = new Map(ROWS.map(([id, status]) => [id, status]))
const workspaces = { archivedSessionIds: ARCHIVED, items: [] }

const hooks = {
  useSessions: (selector) => selector(list),
  useSessionStatus: (selector) => selector(statuses),
  useWorkspaces: (selector) => selector(workspaces),
}

/** One readout variant, rendered with the shipped component. */
function shot(variant) {
  const config = {
    getSnapshot: () => ({ threshold: 20, variant, visibility: { running: true, unread: true, pending: true, idle: true, unarchived: true, archived: true }, rowBadge: true }),
    subscribe: () => () => {},
  }
  return renderToStaticMarkup(React.createElement(StatusWatch, {
    wide: true, config, metricJump: { run: () => {} }, t: translate, ...hooks,
  }))
}

const page = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>dsh-session-radar — status readout</title>
<style>${css}</style>
<style>
  html, body { margin: 0; background: #ffffff; }
  body { font-family: -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; }
  #readout-shot {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: max-content;
    padding: 12px 14px;
    background: var(--dsw-specific-sidebar-fill, #f4f4f5);
  }
</style>
</head>
<body>
<div id="readout-shot">
  <div>${shot('chips')}</div>
  <div>${shot('meter')}</div>
</div>
</body>
</html>
`

writeFileSync(outHtml, page)
console.log(outHtml)
