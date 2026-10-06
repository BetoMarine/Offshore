import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'
import { projectFund, projectGoal } from '../src/logic.js'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const prefix = '/Offshore/preview/second'
const shots = '/opt/cursor/artifacts'
const required = [
  'o00', 'o01', 'o02', 'o02a', 'o02b', 'o02c', 'o02d', 'o02e', 'o02f', 'o02g', 'o02g2', 'o02g3', 'o02h',
  'o03', 'o04', 'o05', 'o06', 'o07', 'o08', 'o09', 'o10', 'o11', 'o12',
  'o13', 'o14', 'o15', 'o16', 'o17', 'o18', 'o19', 'o20', 'o21', 'o22a', 'o22b',
  'o23', 'o24', 'o25', 'o26', 'o27', 'o28', 'o29', 'o30', 'o31', 'o32', 'o33', 'o34', 'o35', 'parts', 'o02r',
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
    const el = nodes.find((node) => norm(node.textContent) === want)
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

async function fill(label, value) {
  await page.waitForSelector(`[aria-label="${label}"]`)
  await page.$eval(`[aria-label="${label}"]`, (el, next) => {
    el.focus()
    el.value = next
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
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
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
})

try {
  page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  const errors = []
  page.on('pageerror', (err) => errors.push(String(err)))
  await page.goto(`http://127.0.0.1:${port}${prefix}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1')
  await mark()
  await shot('start.png')

  await clickText('Erase my data')
  await clickText('Keep my data')

  await clickText('Start')
  await page.goBack()
  await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'o00')
  await mark()
  if (!page.url().includes(prefix)) throw new Error(`browser back left the app: ${page.url()}`)

  await clickText('Start')
  await clickSel('[data-door="fix"]')
  await fill('Amount', '10000000')
  if (!(await page.$eval('[data-act="next"]', (el) => el.disabled))) throw new Error('huge amount was allowed')
  if (!(await bodyText()).includes('That number is too big.')) throw new Error('missing cap message')
  await fill('Amount', '5220')
  await clickText('Next')
  await clickText('Yes')
  await fill('Who', 'Card')
  await clickText('Next')
  await fill('Amount', '8000')
  await clickText('Next')
  await fill('Interest', '3')
  await clickText('Next')
  await fill('Amount', '500')
  await clickText('Next')
  await fill('Next date', '2026-10-01')
  if (!(await page.$eval('[data-act="next"]', (el) => el.disabled))) throw new Error('past due date was allowed')
  if (!(await bodyText()).includes('That date has passed. Pick a later date.')) throw new Error('past date hint missing')
  await fill('Next date', '2026-10-25')
  await clickText('Next')
  await clickText('Yes')
  await fill('Amount', '500')
  await clickText('Next')
  await fill('Overdue since', '2026-09-25')
  await clickText('Next')

  await clickSel('[data-act="back"]')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o02a') {
    throw new Error('back after save did not return to who you owe')
  }
  await clickText('Yes')

  let text = await bodyText()
  if (!text.includes('About HK$240 interest a month')) throw new Error(`interest line missing:\n${text}`)
  if (!text.includes('Overdue HK$500 since 25 Sep')) throw new Error(`overdue line missing:\n${text}`)
  await clickText('Add another')
  await fill('Who', 'Cousin Ana')
  await clickText('Next')
  await fill('Amount', '4000')
  await clickText('Next')
  await clickText("I don't know")
  await clickSel('[data-act="back"]')
  await fill('Interest', '4')
  if ((await page.$eval('[aria-label="Interest"]', (el) => el.value)) !== '4') {
    throw new Error('a rate typed after I don\'t know was dropped')
  }
  await clickText("I don't know")
  await fill('Amount', '60')
  await clickText('Weekly')
  await clickText('Next')
  await fill('Next date', '2026-10-10')
  await clickText('Next')
  await clickText('No')
  text = await bodyText()
  if (!text.includes('Nothing overdue')) throw new Error(`second lender overdue copy:\n${text}`)
  if ((text.split('About HK$').length - 1) !== 1) throw new Error(`interest should be one fact:\n${text}`)
  await clickSel('[data-act="edit-lender"][data-index="0"]')
  await clickSel('[data-act="back"]')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o02h') throw new Error('edit back left the summary')

  await clickSel('[data-act="edit-lender"][data-index="1"]')
  await clickText('Next')
  await clickText('Next')
  await fill('Interest', '4')
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  await clickText('No')
  text = await bodyText()
  if (!text.includes('About HK$160 interest a month')) throw new Error(`typed rate did not win:\n${text}`)

  await clickText('Add another')
  await fill('Who', 'Shop')
  await clickText('Next')
  await fill('Amount', '100.10')
  await clickText('Next')
  await clickText("I don't know")
  await fill('Amount', '433.33')
  if ((await page.$eval('[aria-label="Amount"]', (el) => el.value)) !== '433.33') {
    throw new Error('weekly amount dropped the decimal point')
  }
  await clickText('Weekly')
  await clickText('Next')
  await fill('Next date', '2026-11-02')
  await clickText('Next')
  await clickText('No')
  text = await bodyText()
  if (!text.includes('HK$433.33')) throw new Error(`decimal due not shown:\n${text}`)
  await clickSel('[data-act="remove-lender"][data-index="2"]')
  await clickText('Remove')
  text = await bodyText()
  if (text.includes('Shop')) throw new Error('removed lender still listed')

  const cents = [
    ['One', '10.01'],
    ['Two', '20.02'],
    ['Three', '30.03'],
    ['Four', '40.04'],
    ['Five', '50.05'],
  ]
  for (const [name, amount] of cents) {
    await clickText('Add another')
    await fill('Who', name)
    await clickText('Next')
    await fill('Amount', amount)
    await clickText('Next')
    await clickText("I don't know")
    await fill('Amount', amount)
    await clickText('Next')
    await fill('Next date', '2026-11-01')
    await clickText('Next')
    await clickText('No')
  }
  await clickText("That's all")
  text = await bodyText()
  if (!text.includes('You owe HK$12,150.15 in total.')) throw new Error(`cent total:\n${text}`)
  await clickText('Change')
  for (let i = 0; i < cents.length; i += 1) {
    await clickSel('[data-act="remove-lender"][data-index="2"]')
    await clickText('Remove')
  }
  await shot('lender-loop.png')
  await clickText("That's all")
  text = await bodyText()
  if (!text.includes('You owe HK$12,000 in total.')) throw new Error(text)
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('You pay HK$760 a month.')) throw new Error(text)
  if (!text.includes('HK$260')) throw new Error(text)
  await clickText('Next')
  await page.setViewport({ width: 390, height: 664, deviceScaleFactor: 1 })
  const fitted = await page.evaluate(() => {
    const button = document.querySelector('.actions .btn')
    const rect = button.getBoundingClientRect()
    return rect.top >= 0 && rect.bottom <= window.innerHeight + 1
  })
  if (!fitted) throw new Error('plan intro button is off a 390 by 664 screen')
  const longFit = await page.evaluate(() => {
    const content = document.querySelector('.content')
    const extra = document.createElement('p')
    extra.className = 'body'
    extra.textContent = 'A long line of words. '.repeat(80)
    content.append(extra)
    const button = document.querySelector('.actions .btn')
    const overflows = content.scrollHeight > content.clientHeight + 8
    const rect = button.getBoundingClientRect()
    extra.remove()
    return { overflows, buttonStays: rect.bottom <= window.innerHeight + 1 && rect.top >= 0 }
  })
  if (!longFit.overflows || !longFit.buttonStays) throw new Error(`long text did not keep the button reachable ${JSON.stringify(longFit)}`)
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
  await clickText('Make my plan')
  await fill('Amount', '2000')
  await clickText('Next')
  const catchUp = await page.$eval('[aria-label="Catch up"]', (el) => el.value)
  if (catchUp !== '500') throw new Error(`catch up default ${catchUp}`)
  await fill('Catch up', '800')
  if ((await page.$eval('[aria-label="Catch up"]', (el) => el.value)) !== '500') {
    throw new Error('catch up went above the overdue amount')
  }
  await fill('Amount', '500')
  text = await bodyText()
  if (!text.includes('Bills part: HK$1,760')) throw new Error(`bills before edit:\n${text}`)
  if (!text.includes('Includes HK$1,260 for what you owe')) throw new Error(text)
  await fill('Catch up', '200')
  text = await bodyText()
  if (!text.includes('Bills part: HK$1,460')) throw new Error(`bills did not react:\n${text}`)
  if (!text.includes('Includes HK$960 for what you owe')) throw new Error(text)
  await clickText('Next')
  await fill('Amount', '1000')
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('HK$760')) throw new Error(`left did not include catch up:\n${text}`)
  await shot('plan-summary.png')
  await clickText('Change a part')
  await clickSel('[data-part="bills"]')
  await fill('Catch up', '0')
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('HK$960')) throw new Error(`left did not react to catch up:\n${text}`)
  await clickText('This is my plan')

  await clickText('Go to lessons')
  await clickSel('[data-app="ahk"]')
  await clickText("I'm stuck")
  await clickText('Back to the step')
  await clickText('Done, next step')
  await clickText('Done, next step')
  await clickText('Done')
  await clickText('Not yet')
  await clickText('Done')
  await clickText('Yes, I did it')
  await clickText('Next lesson')
  await clickText('Done, next step')
  await clickText('Done, next step')
  await clickText('Done')
  await clickText('Yes, I did it')
  await clickText('Next lesson')
  text = await bodyText()
  if (!text.includes('Unverified, check in app.')) throw new Error(`o19 unverified missing:\n${text}`)
  await clickText('Done')
  await clickText('Yes, I did it')
  await clickText('Next lesson')
  await clickSel('[data-app="gcash"]')
  await clickText("I'm stuck")
  await clickText('Skip this step')
  await clickText('Yes, I did it')
  await clickText('Next lesson')
  await clickText('Done')
  await clickText('Yes, I did it')
  await clickText('Next lesson')
  await clickText('Done')
  await clickText('Yes, I did it')
  await clickText('Back to your month')
  const scoreBeforeHomeChange = await scoreNumber()

  await clickSel('[data-act="today"]')
  await clickText('Change a part')
  await clickSel('[data-part="home"]')
  await fill('Amount', '100')
  await clickText('Next')
  await clickText('This is my plan')
  if (await scoreNumber() !== scoreBeforeHomeChange) throw new Error('score moved when she sent less home')

  await clickSel('[data-act="today"]')
  await clickText('Change a part')
  await clickSel('[data-part="home"]')
  await fill('Amount', '9000')
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('more than you get')) throw new Error(`over plan missing:\n${text}`)
  await clickText('Keep it for now')
  if (await scoreNumber() !== scoreBeforeHomeChange) throw new Error('score moved when she sent more home')
  const sentLine = await bodyText()
  if (!sentLine.includes('15 of 15') && !sentLine.includes('Sent home')) {
    await clickSel('[data-act="score"]')
  }
  if (page.url()) {
    const detail = await bodyText()
    if (!detail.includes('Sent home what you chose') || !detail.includes('15 of 15')) {
      await clickSel('[data-act="score"]')
      const breakdown = await bodyText()
      if (!breakdown.includes('15 of 15')) throw new Error(`sent-home points missing:\n${breakdown}`)
    }
  }

  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o31') {
    if ((await page.$eval('#app', (el) => el.dataset.screen)) === 'o11') await clickSel('[data-act="score"]')
  }
  await clickText('Back to your month')
  await clickText('See your life')

  await clickSel('[data-act="exit"]')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o00') throw new Error('exit did not open the first page')
  await mark()
  const saved = await page.evaluate(() => localStorage.getItem('offshore-data'))
  if (!saved || !saved.includes('Cousin Ana')) throw new Error('data was not saved')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1')
  await mark()
  const reloaded = await page.evaluate(() => localStorage.getItem('offshore-data'))
  if (reloaded !== saved) throw new Error('reload dropped saved data')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o00') throw new Error('reload did not open on the first page')

  await clickText('Start')
  await clickSel('[data-door="fund"]')
  if ((await page.$eval('[aria-label="Amount"]', (el) => el.value)) !== '5220') {
    throw new Error('savings door did not ask for pay')
  }
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('HK$5,220')) throw new Error(`savings plan has no pay:\n${text}`)
  await clickText('Keep it for now')
  await fill('Amount', '6000')
  await clickText('Next')
  const fundWhen = await page.evaluate(() => {
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
  })
  await fill('Month', fundWhen)
  await clickText('Next')
  await fill('Amount', '500')
  await clickText('Next')
  const fund = projectFund({ amount: '6000', by: fundWhen, monthly: '500' }, new Date())
  text = await bodyText()
  if (fund.reaches) throw new Error('short fund was treated as on track')
  if (/on track/i.test(text)) throw new Error(`short fund said on track:\n${text}`)
  if (!text.includes('You reach this in')) throw new Error(`fund reach date missing:\n${text}`)
  await clickText('Done')

  await clickSel('[data-act="exit"]')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o00') throw new Error('exit did not open the first page')
  await mark()
  await clickText('Start')
  await clickSel('[data-door="goal"]')
  if ((await page.$eval('[aria-label="Amount"]', (el) => el.value)) !== '5220') {
    throw new Error('goals door did not ask for pay')
  }
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('HK$5,220')) throw new Error(`goals plan has no pay:\n${text}`)
  await clickText('Keep it for now')
  await fill('Goal name', 'School fees')
  await clickText('Next')
  await fill('Amount', '2000')
  await clickText('Next')
  const goalWhen = await page.evaluate(() => {
    const now = new Date()
    const target = new Date(now.getFullYear(), now.getMonth() + 10, 1)
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
  })
  await fill('Month', goalWhen)
  await clickText('Next')
  text = await bodyText()
  if (!text.includes('HK$300 a month still free.')) throw new Error(`first goal took the whole surplus:\n${text}`)
  if (!text.includes('Your emergency money is not counted here.')) throw new Error(text)
  await clickText('Add another goal')
  await fill('Goal name', 'Fare home')
  await clickText('Next')
  await fill('Amount', '8000')
  await clickText('Next')
  await fill('Month', goalWhen)
  await clickText('Next')
  const goal = projectGoal(
    {
      you: '1000',
      fund: { monthly: '500', amount: '6000' },
      goals: [
        { amount: '2000', by: goalWhen },
        { amount: '8000', by: goalWhen },
      ],
    },
    { amount: '8000', by: goalWhen },
    new Date(),
  )
  text = await bodyText()
  if (goal.reaches || text.includes('100%')) throw new Error(`second goal claimed the whole surplus:\n${text}`)
  if (!text.includes('HK$0 a month still free.')) throw new Error(`free surplus missing:\n${text}`)
  if (!text.includes('You reach this in')) throw new Error(`goal reach date missing:\n${text}`)
  await clickText('Done')
  await shot('your-life.png')

  await clickSel('[data-act="today"]')
  await clickText('Go to lessons')
  await clickSel('[data-act="back"]')
  await clickSel('[data-act="owe"]')
  await clickSel('[data-act="back"]')
  await clickText('See your life')

  await clickSel('[data-act="today"]')
  await clickSel('[data-act="today"]')
  await clickText('Change a part')
  await clickSel('[data-part="bills"]')
  await fill('Catch up', '300')
  if ((await page.$eval('[aria-label="Catch up"]', (el) => el.value)) !== '300') {
    throw new Error('catch up 300 was not kept while overdue remained')
  }
  await clickText('Next')
  for (let step = 0; step < 6; step += 1) {
    if ((await page.$eval('#app', (el) => el.dataset.screen)) === 'o11') break
    await clickSel('[data-act="back"]')
  }
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o11') {
    throw new Error('could not return to the month before clearing overdue')
  }
  await clickSel('[data-act="owe"]')
  await clickSel('[data-act="edit-lender"][data-index="0"]')
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  await clickText('Next')
  await clickText('No')
  for (let step = 0; step < 6; step += 1) {
    if ((await page.$eval('#app', (el) => el.dataset.screen)) === 'o11') break
    await clickSel('[data-act="back"]')
  }
  await clickSel('[data-act="today"]')
  await clickText('Change a part')
  await clickSel('[data-part="bills"]')
  if ((await page.$eval('[aria-label="Catch up"]', (el) => el.value)) !== '0') {
    throw new Error('catch up stayed above overdue after it was cleared')
  }
  await clickSel('[data-act="exit"]')
  if ((await page.$eval('#app', (el) => el.dataset.screen)) !== 'o00') {
    throw new Error('exit did not open the first page')
  }

  await page.evaluate(async () => {
    localStorage.setItem('planted-app', 'keep')
    localStorage.setItem('offshore-extra', 'gone')
    sessionStorage.setItem('planted-session', 'keep')
    sessionStorage.setItem('offshore-session', 'gone')
    await new Promise((resolve) => {
      const open = indexedDB.open('offshore-notes')
      open.onupgradeneeded = () => open.result.createObjectStore('notes')
      open.onsuccess = () => { open.result.close(); resolve() }
    })
    await new Promise((resolve) => {
      const open = indexedDB.open('planted-db')
      open.onsuccess = () => { open.result.close(); resolve() }
    })
    const userCache = await caches.open('offshore-user')
    await userCache.put(new Request('/offshore-marker'), new Response('x'))
    const otherCache = await caches.open('planted-cache')
    await otherCache.put(new Request('/planted-marker'), new Response('y'))
  })
  await clickText('Erase my data')
  await clickText('Erase everything')
  await page.waitForFunction(() => document.querySelector('#app')?.dataset.screen === 'o00' && localStorage.getItem('offshore-data') == null)
  await mark()
  const after = await page.evaluate(async () => {
    const local = []
    for (let i = 0; i < localStorage.length; i += 1) local.push(localStorage.key(i))
    const session = []
    for (let i = 0; i < sessionStorage.length; i += 1) session.push(sessionStorage.key(i))
    const dbs = (await indexedDB.databases()).map((db) => db.name)
    const cacheNames = await caches.keys()
    return {
      local,
      session,
      dbs,
      cacheNames,
      planted: localStorage.getItem('planted-app'),
      plantedSession: sessionStorage.getItem('planted-session'),
    }
  })
  if (after.planted !== 'keep' || after.plantedSession !== 'keep') throw new Error(`planted keys lost ${JSON.stringify(after)}`)
  if (after.local.some((key) => key.startsWith('offshore-'))) throw new Error(`offshore local keys remain ${after.local}`)
  if (after.session.some((key) => key.startsWith('offshore-'))) throw new Error(`offshore session keys remain ${after.session}`)
  if (!after.dbs.includes('planted-db') || after.dbs.includes('offshore-notes')) throw new Error(`databases ${after.dbs}`)
  if (!after.cacheNames.includes('planted-cache') || after.cacheNames.includes('offshore-user')) throw new Error(`caches ${after.cacheNames}`)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('h1')
  await mark()
  const cold = await page.evaluate(() => ({
    screen: document.querySelector('#app').dataset.screen,
    data: localStorage.getItem('offshore-data'),
    planted: localStorage.getItem('planted-app'),
  }))
  if (cold.screen !== 'o00' || cold.data != null || cold.planted !== 'keep') throw new Error(`cold reopen ${JSON.stringify(cold)}`)
  await clickText('Start')
  await clickSel('[data-door="fix"]')
  const pay = await page.$eval('[aria-label="Amount"]', (el) => el.value)
  if (pay !== '') throw new Error(`pay left over: ${pay}`)

  const missing = required.filter((id) => !seen.has(id))
  if (missing.length) throw new Error(`screens not visited: ${missing.join(', ')}`)
  if (errors.length) throw new Error(`page errors:\n${errors.join('\n')}`)
  console.log(`ui-check ok, screens ${seen.size}`)
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
