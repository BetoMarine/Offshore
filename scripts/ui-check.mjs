import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { projectFund, projectGoal } from '../src/logic.js'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const prefix = '/Offshore/preview/fourteenth'
const sundayPackUrl = 'https://betomarine.github.io/debtrenegociation1/sunday/'
const shots = '/opt/cursor/artifacts'
const required = [
  'o00', 'o34', 'cf00', 'cf01', 'cf02', 'cf03', 'cf-line', 'cf04', 'cf05', 'cf06', 'cf07', 'cf08', 'cf09',
  'cf-resume', 'cf10', 'cf11', 'cf12', 'cf13', 'ft16', 'ft15', 'ft18',
]

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    let path = decodeURIComponent(url.pathname)
    if (!path.startsWith(prefix)) {
      res.statusCode = 404
      res.end('no')
      return
    }
    path = path.slice(prefix.length) || '/'
    if (path.endsWith('/')) path += 'index.html'
    const file = normalize(join(root, path))
    if (!file.startsWith(root)) {
      res.statusCode = 403
      res.end('no')
      return
    }
    try {
      const data = await readFile(file)
      res.setHeader('content-type', types[extname(file)] || 'application/octet-stream')
      res.end(data)
    } catch {
      res.statusCode = 404
      res.end('missing')
    }
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const seen = new Set()
let page

async function mark() {
  const info = await page.evaluate(() => {
    const screen = document.querySelector('#app').dataset.screen
    const back = document.querySelector('[data-act="back"]')
    const backOk = screen === 'o00'
      ? !!(back && back.disabled)
      : screen === 'blank'
        ? !!document.querySelector('[data-act="home"]')
        : !!(back && !back.disabled)
    const exitOk = screen === 'blank' || !!document.querySelector('[data-act="exit"]')
    const forward = [...document.querySelectorAll('[data-act]')].some((el) => el.dataset.act !== 'back' && el.dataset.act !== 'exit')
    return { screen, backOk, exitOk, forward }
  })
  seen.add(info.screen)
  if (!info.backOk || !info.exitOk || !info.forward) {
    throw new Error(`No path on ${info.screen}: ${JSON.stringify(info)}`)
  }
  return info.screen
}

async function clickText(text) {
  const found = await page.evaluate((text) => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim().replace(/[\u2019\u2018']/g, "'")
    const want = norm(text)
    const nodes = [...document.querySelectorAll('button')]
    const el = nodes.find((node) => {
      if (norm(node.textContent) === want) return true
      const title = node.querySelector('.t')
      return !!(title && norm(title.textContent) === want)
    })
    if (!el) {
      return {
        ok: false,
        screen: document.querySelector('#app').dataset.screen,
        buttons: nodes.map((node) => norm(node.textContent)).filter(Boolean).slice(0, 14),
      }
    }
    el.click()
    return { ok: true }
  }, text)
  if (!found.ok) throw new Error(`Missing "${text}" on ${found.screen}: ${found.buttons.join(' | ')}`)
  return mark()
}

async function clickSel(sel) {
  await page.click(sel)
  return mark()
}

async function shown(act) {
  return page.evaluate((act) => {
    const el = document.querySelector(`[data-act="${act}"]`)
    if (!el) return { ok: false, reason: 'missing' }
    const rect = el.getBoundingClientRect()
    const viewH = window.innerHeight
    const viewW = window.innerWidth
    const box = {
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      viewH,
      viewW,
    }
    if (rect.width < 8 || rect.height < 8) return { ok: false, reason: 'tiny', ...box }
    if (rect.top < -1 || rect.left < -1 || rect.bottom > viewH + 1 || rect.right > viewW + 1) {
      return { ok: false, reason: 'outside', ...box }
    }
    let node = el.parentElement
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node)
      if (/auto|hidden|scroll|clip/.test(`${style.overflow} ${style.overflowY} ${style.overflowX}`)) {
        const parent = node.getBoundingClientRect()
        if (rect.top < parent.top - 1 || rect.bottom > parent.bottom + 1 || rect.left < parent.left - 1 || rect.right > parent.right + 1) {
          return {
            ok: false,
            reason: 'clipped',
            ...box,
            parentTop: Math.round(parent.top),
            parentBottom: Math.round(parent.bottom),
          }
        }
      }
      node = node.parentElement
    }
    const x = Math.round(rect.left + Math.min(rect.width / 2, 28))
    const y = Math.round(rect.top + rect.height / 2)
    const hit = document.elementFromPoint(x, y)
    const owner = hit && hit.closest ? hit.closest('[data-act]') : null
    if (!owner || owner.dataset.act !== act) {
      return { ok: false, reason: 'covered', hit: owner ? owner.dataset.act : '', x, y, ...box }
    }
    return { ok: true, ...box }
  }, act)
}

async function assertShown(act) {
  const info = await shown(act)
  if (!info.ok) throw new Error(`${act} is not on the first screen: ${JSON.stringify(info)}`)
}

async function tapAct(act) {
  const point = await page.evaluate((act) => {
    const el = document.querySelector(`[data-act="${act}"]`)
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'nearest' })
    const rect = el.getBoundingClientRect()
    const x = Math.round(rect.left + Math.min(rect.width / 2, 24))
    const y = Math.round(rect.top + rect.height / 2)
    const hit = document.elementFromPoint(x, y)
    const owner = hit && hit.closest ? hit.closest('[data-act]') : null
    return {
      x,
      y,
      act: owner ? owner.dataset.act : '',
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      view: window.innerHeight,
    }
  }, act)
  if (!point) throw new Error(`no control ${act}`)
  if (point.act !== act || point.height < 8 || point.top < 0 || point.bottom > point.view + 1) {
    throw new Error(`tap missed ${act}: ${JSON.stringify(point)}`)
  }
  await page.mouse.click(point.x, point.y)
  return mark()
}

async function fill(label, value) {
  await page.waitForSelector(`[aria-label="${label}"]`)
  await page.$eval(`[aria-label="${label}"]`, (el, next) => {
    el.focus()
    el.value = next
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

async function typeMoney(label, value) {
  await page.waitForSelector(`[aria-label="${label}"]`)
  const point = await page.$eval(`[aria-label="${label}"]`, (el) => {
    const field = el.closest('.field')
    const rect = field.getBoundingClientRect()
    return { x: rect.left + 16, y: rect.top + rect.height / 2 }
  })
  await page.mouse.click(point.x, point.y)
  const focused = await page.$eval(`[aria-label="${label}"]`, (el) => document.activeElement === el)
  if (!focused) throw new Error(`${label} did not focus from the HK$ side`)
  await page.keyboard.type(value, { delay: 15 })
  const got = await page.$eval(`[aria-label="${label}"]`, (el) => el.value)
  if (got !== value) throw new Error(`typed ${label} stored "${got}"`)
  const nextOff = await page.$eval('[data-act="next"]', (el) => el.disabled)
  if (nextOff) throw new Error(`${label} Next stayed off after typing`)
}

function isLivePackUrl(url) {
  const bare = sundayPackUrl.replace(/\/$/, '')
  return url === bare || url === sundayPackUrl || url.startsWith(`${bare}/`) || url.startsWith(`${bare}?`)
}

let livePackShot = false

async function openLivePack() {
  const before = await page.$eval('#app', (el) => el.dataset.screen)
  const links = await page.$$eval('[data-act="sunday-pack"]', (els) => els.map((el) => ({
    tag: el.tagName,
    href: el.getAttribute('href'),
    target: el.getAttribute('target'),
  })))
  if (!links.length) throw new Error(`no Sunday Pack on ${before}`)
  for (const link of links) {
    if (link.tag !== 'A' || link.href !== sundayPackUrl || link.target !== '_blank') {
      throw new Error(`Sunday Pack on ${before} is not the live link: ${JSON.stringify(link)}`)
    }
  }
  const popupPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sunday Pack on ${before} did not open a tab`)), 10000)
    const onTarget = async (target) => {
      if (target.type() !== 'page') return
      clearTimeout(timer)
      browser.off('targetcreated', onTarget)
      resolve(target.page())
    }
    browser.on('targetcreated', onTarget)
  })
  await page.click('[data-act="sunday-pack"]')
  const popup = await popupPromise
  try {
    await popup.waitForFunction(
      (url) => location.href.startsWith(url.replace(/\/$/, '')),
      { timeout: 20000 },
      sundayPackUrl,
    )
  } catch {
    // The address is checked below.
  }
  const url = popup.url()
  if (!livePackShot) {
    livePackShot = true
    await mkdir(shots, { recursive: true })
    await popup.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 }).catch(() => {})
    await popup.screenshot({ path: join(shots, 'sunday_pack_live.png'), fullPage: false }).catch(() => {})
  }
  await popup.close()
  if (!isLivePackUrl(url)) throw new Error(`Sunday Pack on ${before} opened ${url}`)
  const after = await page.$eval('#app', (el) => el.dataset.screen)
  const text = await bodyText()
  const packConfirm = before === 'cf08' && after === 'cf09'
  if (!packConfirm && after !== before) throw new Error(`Sunday Pack left ${before} for ${after}:\n${text}`)
  if (/A helper will be named|helper will be found|cannot help/i.test(text)) {
    throw new Error(`Sunday Pack stayed on a helper dead end:\n${text}`)
  }
  return mark()
}

async function bodyText() {
  return page.$eval('#screen', (el) => el.innerText)
}

async function scoreNumber() {
  return page.$eval('.ring .n b', (el) => el.textContent.trim())
}

async function shot(name) {
  await mkdir(shots, { recursive: true })
  await page.screenshot({ path: join(shots, name), fullPage: false })
}

const server = await startServer()
const port = server.address().port
const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-popup-blocking'],
})

try {
  page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await page.goto(`http://127.0.0.1:${port}${prefix}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1')
  await mark()
  if (!(await bodyText()).includes('The plan stays on this phone. Your progress can be saved.')) {
    throw new Error('privacy line does not match the locked strip')
  }

  async function onScreen(id) {
    const screen = await page.$eval('#app', (el) => el.dataset.screen)
    if (screen !== id) throw new Error(`expected ${id} got ${screen}:\n${await bodyText()}`)
    return screen
  }
  async function mustInclude(bits) {
    const text = await bodyText()
    const screen = await page.$eval('#app', (el) => el.dataset.screen)
    for (const bit of bits) {
      if (!text.includes(bit)) throw new Error(`missing "${bit}" on ${screen}:\n${text}`)
    }
    return text
  }
  async function mustExclude(bits) {
    const text = await bodyText()
    const screen = await page.$eval('#app', (el) => el.dataset.screen)
    for (const bit of bits) {
      if (text.includes(bit)) throw new Error(`unexpected "${bit}" on ${screen}:\n${text}`)
    }
    return text
  }
  async function replaceMoney(label, value) {
    await page.waitForSelector(`[aria-label="${label}"]`)
    await page.$eval(`[aria-label="${label}"]`, (el) => {
      el.focus()
      el.value = ''
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await typeMoney(label, value)
  }
  async function erase() {
    const screen = await page.$eval('#app', (el) => el.dataset.screen)
    if (screen !== 'o00') await clickSel('[data-act="exit"]')
    await onScreen('o00')
    await clickText('Erase my data')
    await onScreen('o34')
    await clickText('Erase everything')
    await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'o00')
    await mark()
  }
  async function line(field) {
    await clickSel(`[data-act="cf-line"][data-field="${field}"]`)
    await onScreen('cf-line')
  }
  async function enterFlow({ pay, loan, due, left, overdue, home, bills, keep }) {
    await clickText('Start')
    await onScreen('cf00')
    await mustInclude(['Where are you right now?', 'Money is tight right now', 'Most people start here.'])
    await mustExclude(['I’m OK. I want savings.', 'I have savings. I want goals.'])
    await clickText('Next')
    await onScreen('cf01')
    await fill('Amount', '10000000')
    if (!(await page.$eval('[data-act="next"]', (el) => el.disabled))) throw new Error('huge amount was allowed')
    await fill('Amount', '')
    await typeMoney('Amount', pay)
    await clickText('Next')
    await onScreen('cf02')
    await mustInclude(['Do you have a loan?', 'Loans, cards, or money from family or friends.'])
    if (loan) {
      await clickText('Yes')
      await onScreen('cf03')
      await mustInclude(['Your loan · one place', 'Details and papers together. Tap a line to change.', 'We are not lawyers. Facts stay on this phone.'])
      await line('name')
      await fill('Who', 'Card')
      await clickText('Next')
      await onScreen('cf03')
      await line('left')
      await typeMoney('Left to pay', left)
      await clickText('Next')
      await line('due')
      await typeMoney('Due each time', due)
      await clickText('Next')
      if (overdue) {
        await line('next')
        await fill('Next date', '2026-10-25')
        await typeMoney('Overdue', overdue)
        await clickText('Next')
      }
      await mustInclude(['Not sure', 'In writing?', 'Hold passport / phone / card?'])
      await clickText('Next')
    } else {
      await clickText('No')
      await onScreen('cf04')
      await clickSel('[data-act="back"]')
      await onScreen('cf02')
      await clickText('No')
    }
    await onScreen('cf04')
    await mustInclude(['Expenses · 1 of 3 · Home', 'How much will you send home each month?'])
    await typeMoney('Amount', home)
    await clickText('Next')
    await onScreen('cf05')
    await mustExclude(['Bills part:'])
    await mustInclude(['Expenses · 2 of 3 · Bills', 'Only what you type here.'])
    if (loan) await mustInclude(['Loan dues stay on Card.'])
    await typeMoney('Amount', bills)
    await clickText('Next')
    await onScreen('cf06')
    await mustInclude(['Expenses · 3 of 3 · Keep', 'How much will you keep for yourself?'])
    await typeMoney('Amount', keep)
    await clickText('Next')
    await onScreen('cf07')
  }

  await shot('start.png')
  await enterFlow({ pay: '5220', loan: true, due: '1200', left: '8000', overdue: '2400', home: '2500', bills: '800', keep: '1000' })
  await mustInclude(['Your full picture', 'Pay', 'Installment', 'HK$1,200', 'Send home', 'HK$2,500', 'Bills', 'HK$800', 'Keep', 'HK$1,000', 'HK$\u2212280', 'Card', 'Overdue HK$2,400', 'Interest not known', 'Nothing invented. Change any part next.'])
  await mustExclude(['Bills part:', 'A helper will be named'])
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await shot('cf07-your-now.png')
  await clickText('Take actions')
  await onScreen('cf08')
  await mustInclude(['What can you change?', 'Change send home', 'HK$2,500 now', 'Change bills', 'HK$800 now', 'Change loan', 'Installment HK$1,200', 'overdue HK$2,400', 'For your day off · opens live Pack'])
  await shot('cf08-take-actions.png')
  await openLivePack()
  await onScreen('cf09')
  await mustInclude(['Pack is on for next time', 'Flag set on this phone. Live Pack:', sundayPackUrl, 'Resume your day-off pack'])
  await mustExclude(['A helper will be named', 'helper will be found', 'For your day off'])
  await shot('cf09-pack-flag.png')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1')
  await mark()
  await onScreen('cf-resume')
  const resumeH1 = await page.$eval('h1', (el) => el.textContent.trim())
  if (resumeH1 !== 'Pick up your day-off pack') throw new Error(`cold open was ${resumeH1}`)
  await mustInclude(['You started this'])
  await mustExclude(['For your day off', 'A helper will be named', 'helper will be found'])
  await shot('cf-resume.png')
  await clickText('Continue')
  await onScreen('cf08')
  await mustInclude(['You started this · pick it up'])
  await mustExclude(['For your day off'])

  await clickText('Change send home')
  await onScreen('cf04')
  await replaceMoney('Amount', '1500')
  await clickText('Next')
  await onScreen('cf08')
  await clickText('Done')
  await onScreen('cf10')
  await mustInclude(['Room for a goal', 'Pay', 'HK$5,220', 'Out', 'HK$4,500', 'Left', 'HK$720', 'Better to save than to loan', 'Use what’s left toward a goal — not a new loan.'])
  await shot('cf10-room-goal.png')
  await clickText('Plan a goal')
  await onScreen('cf11')
  await fill('Goal name', 'Ticket home')
  await fill('Amount', '3000')
  await fill('Month', '2026-12')
  await clickText('Next')
  await onScreen('cf12')
  await mustInclude(['That date is tight', 'HK$720 left each month', 'HK$3,000 by December may not fit.', 'Try March 2027', 'Better to save than to loan', 'Don’t borrow to hit the date. Stretch the date instead.'])
  await shot('cf12-date-tight.png')
  await clickText('Keep this date')
  await onScreen('cf13')
  await mustInclude(['Ticket home', 'HK$3,000', 'by December 2026', 'That date is tight', 'Better to save than to loan', 'From Left HK$720 a month'])
  await clickSel('[data-act="back"]')
  await onScreen('cf12')
  await clickText('Move the date')
  await onScreen('cf13')
  await mustInclude(['Ticket home', 'by March 2027', 'From Left HK$720 a month · nothing invented', 'Emergency money is not counted here', 'Better to save than to loan', 'Saved on this phone. The plan stays on this phone. Your progress can be saved.'])
  await mustExclude(['That date is tight'])
  await shot('cf13-goal-saved.png')
  await clickText('Done')
  await onScreen('o00')

  await erase()
  await enterFlow({ pay: '5220', loan: true, due: '1200', left: '8000', overdue: '2400', home: '2500', bills: '800', keep: '1000' })
  await clickText('Take actions')
  await onScreen('cf08')
  await clickText('Done')
  await onScreen('ft16')
  await mustInclude(['This month fits', 'Left', 'HK$720'])
  await mustExclude(['HK$\u2212280', 'Room for a goal'])
  const fitRows = await page.$$eval('.row', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim()))
  if (fitRows.some((row) => row.startsWith('You'))) throw new Error(`FT16 invented You: ${fitRows.join(' | ')}`)
  await shot('ft16-month-fits.png')
  await clickText('Start a cushion')
  await onScreen('ft15')
  await mustInclude(['Room to save this month', 'Left', 'HK$720'])
  const roomRows = await page.$$eval('.row', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim()))
  if (!roomRows.some((row) => row.startsWith('You') && row.includes('HK$1,000'))) throw new Error(`room missed Keep: ${roomRows.join(' | ')}`)
  if (!roomRows.some((row) => row.startsWith('Left') && row.includes('HK$720'))) throw new Error(`room Left changed: ${roomRows.join(' | ')}`)
  if (roomRows.some((row) => row.includes('HK$0'))) throw new Error(`room invented zero: ${roomRows.join(' | ')}`)
  await shot('ft15-room-you.png')

  await erase()
  await enterFlow({ pay: '5000', loan: true, due: '2000', left: '8000', home: '2500', bills: '800', keep: '100' })
  await clickText('Take actions')
  await clickText('Done')
  await onScreen('ft18')
  await mustInclude(['This month is short', 'Short', 'HK$300'])
  await mustExclude(['Room to save this month', 'Room for a goal'])
  await shot('ft18-month-short.png')
  await openLivePack()
  await onScreen('ft18')
  await mustExclude(['Room to save this month', 'A helper will be named', 'helper will be found'])
  await shot('fork-b-pack-stays-short.png')

  await erase()
  await enterFlow({ pay: '5220', loan: false, home: '1000', bills: '100', keep: '100' })
  await mustInclude(['Your full picture', 'Pay', 'HK$5,220', 'Left', 'HK$4,020'])
  await mustExclude(['Installment', 'Card', 'Overdue', 'HK$0'])
  await shot('cf07-no-loan.png')
  await clickText('Take actions')
  await onScreen('cf08')
  await mustExclude(['Change loan'])
  await clickText('Done')
  await onScreen('cf10')
  await mustInclude(['Room for a goal', 'Better to save than to loan', 'HK$4,020'])
  await mustExclude(['Installment'])

  const missing = required.filter((id) => !seen.has(id))
  if (missing.length) throw new Error(`screens not visited: ${missing.join(', ')}`)
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`)
  console.log(`ui-check ok, screens ${seen.size}`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
