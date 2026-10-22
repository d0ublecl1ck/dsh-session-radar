// The README's readout picture has to stay reproducible: this runs the render
// script and pins the page it writes, so a component or prop change that breaks
// the shot fails here instead of leaving a silently aging asset in the repo.
import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

test('the readout shot script renders both layouts with the fixture counts', () => {
  const dir = mkdtempSync(join(tmpdir(), 'readout-shot-'))
  const out = join(dir, 'page.html')
  try {
    execFileSync(process.execPath, [join(root, 'scripts/render-readout-shot.mjs'), '--out-html', out], {
      cwd: root,
      stdio: 'pipe',
    })
    const html = readFileSync(out, 'utf8')
    assert.match(html, /<div id="readout-shot">/, 'the capture wrapper is the crop target')
    assert.match(html, /\.dsr-sw-chip \{/, 'the shipped stylesheet travels with the page')
    assert.match(html, /data-variant="chips"/)
    assert.match(html, /data-variant="meter"/)
    assert.match(html, /data-metric="running"[\s\S]*?dsr-sw-chip-count">2</, 'the fixture keeps every count non-zero')
    assert.match(html, /data-metric="unarchived"[\s\S]*?dsr-sw-chip-count">8</)
    assert.match(html, /<button[^>]*class="dsr-sw-chip"[^>]*data-metric="idle"/, 'the jumpable metrics stay buttons')
    assert.doesNotMatch(html, /<button[^>]*data-metric="archived"/, 'the archive stays a plain count')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
