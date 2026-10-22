/**
 * One class namespace for the whole plugin.
 *
 * Every surface this plugin injects shares a single page-level stylesheet, and
 * the page already carries stylesheets from the shell and from other plugins.
 * Two-character prefixes (`ab-`, `ov-`, `sw-`, `rt-`) are collision bait: the
 * restart-retry dialog shipped with `rt-*` and a second injector on the same
 * page defined `.dsr-rt-row` as a five-column grid, which dragged the checklist
 * rows into a 210px column and produced a horizontal scrollbar. The fix is a
 * namespace nobody else claims; this test keeps it that way.
 *
 * @module dsh-session-radar/test/css-namespace
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
/** The one prefix every class this plugin defines must carry. */
const NAMESPACE = 'dsr-'
/** Prefixes that used to be bare and therefore collided with other sheets. */
const LEGACY = /(?<![\w-])(?:ab|ov|sw|rt)-(?=[a-z])/gu

function stylesheetText() {
  const source = readFileSync(join(ROOT, 'src/client/styles.ts'), 'utf8')
  const start = source.indexOf('const CSS = `')
  assert.notEqual(start, -1, 'styles.ts still declares the CSS template literal')
  const from = start + 'const CSS = `'.length
  const end = source.indexOf('`\n', from)
  assert.ok(end > from, 'the CSS template literal is still terminated by a bare backtick line')
  return source.slice(from, end)
}

test('every class the plugin stylesheet defines is namespaced', () => {
  const css = stylesheetText()
  const classes = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/gu)].map((match) => match[1]))
  assert.ok(classes.size > 50, 'the stylesheet parsed into class names, got ' + String(classes.size))
  const bare = [...classes].filter((name) => !name.startsWith(NAMESPACE)).sort()
  assert.deepEqual(
    bare,
    [],
    'these classes are not namespaced with ' + NAMESPACE + ' and can be overwritten by another page stylesheet: ' + bare.join(', '),
  )
})

test('no source file still spells a legacy bare class prefix', () => {
  const files = [
    ...readdirSync(join(ROOT, 'src/client')).filter((name) => name.endsWith('.ts') || name.endsWith('.tsx')).map((name) => join('src/client', name)),
    'scripts/capture-bell.mjs',
  ]
  const offenders = []
  for (const relative of files) {
    const text = readFileSync(join(ROOT, relative), 'utf8')
    for (const match of text.matchAll(LEGACY)) {
      const line = text.slice(0, match.index).split('\n').length
      offenders.push(relative + ':' + String(line) + ' ' + match[0] + '…')
    }
  }
  assert.deepEqual(offenders, [], 'legacy bare class prefixes remain:\n' + offenders.join('\n'))
})
