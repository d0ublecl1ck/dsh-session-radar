/**
 * Capture a content-free clip of the DSH Web sidebar from a running instance.
 *
 * Preconditions:
 *   - a DSH Web instance is running and reachable at --url (the URL must carry
 *     its ?token=..., or the page must already be authenticated)
 *   - Google Chrome is installed at the default macOS path
 * Side effects:
 *   - launches a headless Chrome with a throwaway --user-data-dir (removed on exit)
 *   - writes one PNG per --out (the repo ships these under assets/)
 *
 * The default clip is the sidebar's section-header row (the "工作区" label +
 * search + the bell). That row carries no session titles, project names, or
 * account data, which is why it is safe to publish. Never point --selector at
 * the list area or the activity panel: those render real session titles.
 *
 * Usage:
 *   node scripts/capture-bell.mjs --url 'http://127.0.0.1:43129/?token=...' \
 *     --out assets/bell.png [--selector '[class*="sectionHeader"]'] [--pad 8] \
 *     [--wait-for '.ab-badge-ask'] [--settle-ms 800]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

function arg(name, fallback) {
  const at = process.argv.indexOf('--' + name)
  return at === -1 ? fallback : process.argv[at + 1]
}

const url = arg('url')
const out = arg('out')
const selector = arg('selector', '[class*="sectionHeader"]')
const pad = Number(arg('pad', '8'))
const waitFor = arg('wait-for', null)
const settleMs = Number(arg('settle-ms', '800'))
if (url === undefined || out === undefined) {
  console.error('usage: node scripts/capture-bell.mjs --url <dsh url> --out <png> [--selector s] [--pad n] [--wait-for s] [--settle-ms ms]')
  process.exit(2)
}

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const port = 9411
const profile = '/tmp/dsh-capture-' + Date.now()
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--window-size=1600,1000', '--remote-debugging-port=' + String(port),
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: 'ignore' })

try {
  let ready = false
  for (let i = 0; i < 80 && !ready; i += 1) {
    try { ready = (await fetch('http://127.0.0.1:' + String(port) + '/json/version')).ok } catch { await sleep(250) }
  }
  if (!ready) throw new Error('chrome did not start')

  const targets = await (await fetch('http://127.0.0.1:' + String(port) + '/json/list')).json()
  const page = targets.find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })

  let id = 0
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  const call = (method, params = {}) => new Promise((resolve) => {
    const callId = ++id
    pending.set(callId, resolve)
    ws.send(JSON.stringify({ id: callId, method, params }))
  })

  await call('Runtime.enable')
  await call('Page.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 2, mobile: false })
  await call('Page.navigate', { url })

  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, returnByValue: true })
    return result.result?.result?.value
  }
  for (let i = 0; i < 60; i += 1) {
    if (await evaluate('!!document.querySelector(' + JSON.stringify(selector) + ')')) break
    await sleep(300)
  }
  if (waitFor !== null) {
    for (let i = 0; i < 80 && !(await evaluate('!!document.querySelector(' + JSON.stringify(waitFor) + ')')); i += 1) {
      await sleep(250)
    }
  }
  await sleep(settleMs)

  const box = await evaluate(
    '(() => { const el = document.querySelector(' + JSON.stringify(selector) + ');'
    + ' if (!el) return null; const r = el.getBoundingClientRect();'
    + ' return { x: r.x, y: r.y, w: r.width, h: r.height }; })()',
  )
  if (box === null || box.w <= 0) throw new Error('selector matched nothing visible: ' + selector)

  const clip = {
    x: Math.max(0, Math.floor(box.x - pad)),
    y: Math.max(0, Math.floor(box.y - pad)),
    width: Math.ceil(box.w + pad * 2),
    height: Math.ceil(box.h + pad * 2),
    scale: 1,
  }
  const shot = await call('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: true })
  const data = shot.result?.data
  if (typeof data !== 'string' || data === '') throw new Error('captureScreenshot returned nothing')

  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(data, 'base64'))
  console.log(JSON.stringify({ out, selector, clip }))
  ws.close()
} finally {
  chrome.kill('SIGKILL')
  try { rmSync(profile, { recursive: true, force: true }) } catch {}
}
