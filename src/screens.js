import {
  billsParts,
  catchUpValue,
  debtMonthly,
  freqWord,
  hk,
  interestMonth,
  longDate,
  money,
  monthLong,
  monthName,
  monthShort,
  monthlyDue,
  overdueTotal,
  contractSummary,
  cutResult,
  dueThisWeek,
  homeSplit,
  planFigures,
  planLeft,
  planPartsEntered,
  saveableGap,
  projectFund,
  projectGoal,
  reduceDue,
  roundCents,
  scoreOf,
  SCORE_MAX,
  shortDate,
  soonestDue,
} from './logic.js'
import { LESSONS, lessonById } from './lessons.js'

const BACK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'
const EXIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 5.1A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.6 3.4"/><path d="M6.5 6.6C3.9 8.3 2.5 12 2.5 12s3.5 7 9.5 7a9 9 0 0 0 4.9-1.4"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10.5" width="16" height="10.5" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>'
const MARK = '<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="21" fill="#A63D1F"/><path d="M8 26c4 0 4-3 7-3s3 3 7 3 4-3 7-3 3 3 7 3" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="22" cy="15" r="4.5" fill="#F2B632"/></svg>'

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]))
}

function shell({ stepper = '', back = true, body, actions = '' }) {
  return `<div class="top">
    <button type="button" class="iconbtn" data-act="back" aria-label="Back" ${back ? '' : 'disabled aria-disabled="true"'}><span class="visually-hidden"></span>${BACK}</button>
    <div class="stepper">${stepper}</div>
    <button type="button" class="iconbtn exit" data-act="exit" aria-label="Quick exit">${EXIT}<span>Exit</span></button>
  </div>
  <div class="content">${body}</div>
  <div class="actions">${actions}</div>`
}

function primary(label, act) {
  return `<button type="button" class="btn primary" data-act="${act}">${label}</button>`
}

function quiet(label, act) {
  return `<button type="button" class="btn quiet" data-act="${act}">${label}</button>`
}

function moneyField(field, value, label = 'Amount') {
  const filled = value !== '' && value != null ? ' filled' : ''
  return `<label class="field${filled}"><span class="cur">HK$</span><input aria-label="${label}" data-field="${field}" data-kind="money" inputmode="decimal" autocomplete="off" value="${esc(value)}"></label><p class="hint warn" data-cap hidden>That number is too big.</p>`
}

function emptyDraft() {
  return {
    name: '', left: '', interest: '', interestPeriod: 'month', interestUnknown: false,
    due: '', freq: 'monthly', nextDate: '', overdue: null, overdueAmount: '', overdueSince: '',
  }
}

function textField(field, value, label) {
  const filled = value ? ' filled' : ''
  return `<label class="field text${filled}"><input aria-label="${label}" data-field="${field}" data-kind="text" autocomplete="off" value="${esc(value)}"></label>`
}

function ring(total, size = '') {
  const xl = size === 'xl'
  const box = xl ? 168 : 104
  const r = xl ? 70 : 44
  const sw = xl ? 16 : 12
  const c = 2 * Math.PI * r
  const dash = (Math.max(0, Math.min(100, total)) / 100) * c
  return `<div class="ring${xl ? ' xl' : ''}" role="img" aria-label="Score ${total} out of 100"><svg viewBox="0 0 ${box} ${box}" aria-hidden="true"><circle cx="${box / 2}" cy="${box / 2}" r="${r}" fill="none" stroke="#EADFC9" stroke-width="${sw}"/><circle cx="${box / 2}" cy="${box / 2}" r="${r}" fill="none" stroke="#A86A10" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(c - dash).toFixed(1)}"/></svg><div class="n"><b>${total}</b><i>of 100</i></div></div>`
}

function lastLine(state, withNumber) {
  const reason = state.checks.lastUp
  if (!reason) return 'Last went up: not yet this month.'
  if (withNumber) return `Last went up ${state.checks.lastDelta}: ${reason}`
  return `Last went up: ${reason}`
}

function interestText(lender) {
  const amount = interestMonth(lender)
  if (amount == null) return ''
  return `About ${hk(amount)} interest a month`
}

function knownInterest(lenders) {
  let sum = 0
  let any = false
  for (const lender of lenders || []) {
    const amount = interestMonth(lender)
    if (amount == null) continue
    any = true
    sum += amount
  }
  return any ? sum : null
}

function doughnut(pct) {
  const c = 2 * Math.PI * 34
  const dash = (pct / 100) * c
  return `<svg viewBox="0 0 88 88" role="img" aria-label="${pct} percent"><circle cx="44" cy="44" r="34" fill="none" stroke="#E6DCCF" stroke-width="14"/><circle cx="44" cy="44" r="34" fill="none" stroke="#2E6B4F" stroke-width="14" stroke-dasharray="${dash.toFixed(1)} ${(c - dash).toFixed(1)}"/></svg>`
}

function spark(could, amount) {
  const target = Math.max(amount, 1)
  const end = Math.min(1, could / target)
  const y = (56 - end * 46).toFixed(1)
  return `<svg class="spark" viewBox="0 0 300 60" aria-hidden="true"><line x1="6" y1="10" x2="294" y2="10" stroke="#857A70" stroke-width="1.5" stroke-dasharray="5 5"/><polyline fill="none" stroke="#2E6B4F" stroke-width="3" stroke-linecap="round" points="6,56 275,${y}"/><circle cx="275" cy="${y}" r="4" fill="#2E6B4F"/></svg>`
}

function stepperLabel(lesson, stepIndex) {
  if (lesson.group === 'gcash') {
    const group = LESSONS.filter((item) => item.group === 'gcash')
    const index = group.findIndex((item) => item.id === lesson.id)
    return `GCash · ${index + 1} of ${group.length}`
  }
  return `${lesson.stepper} · ${stepIndex + 1} of ${lesson.steps.length}`
}

function lenderCards(state) {
  return state.lenders.map((lender, index) => {
    const due = `Due <b>${hk(lender.due)}</b> ${freqWord(lender.freq)} · Next <b>${esc(shortDate(lender.nextDate))}</b>`
    const overdue = lender.overdue
      ? `<div class="od">Overdue ${hk(lender.overdueAmount)} since ${esc(shortDate(lender.overdueSince))}</div>`
      : '<div class="k">Nothing overdue</div>'
    const interest = interestText(lender)
    const yes = lender.paidOnTime === true ? ' on' : ''
    const no = lender.paidOnTime === false ? ' on' : ''
    return `<div class="owe"><div class="h">${esc(lender.name)}</div><div class="k">Left <b>${hk(lender.left)}</b></div><div class="k">${due}</div>${interest ? `<div class="k">${esc(interest)}</div>` : ''}${overdue}
      <div class="seg" role="radiogroup" aria-label="This month for ${esc(lender.name)}">
        <button type="button" class="${yes}" data-act="paid" data-index="${index}" data-value="yes" role="radio" aria-checked="${lender.paidOnTime === true}">Paid on time</button>
        <button type="button" class="${no}" data-act="paid" data-index="${index}" data-value="no" role="radio" aria-checked="${lender.paidOnTime === false}">Not this time</button>
      </div>
      <div class="row-actions">
        <button type="button" data-act="edit-lender" data-index="${index}">Edit</button>
        <button type="button" data-act="remove-lender" data-index="${index}">Remove</button>
      </div>
      <button type="button" class="papers" data-act="papers-pick" data-index="${index}">Check a loan’s papers</button>
    </div>`
  }).join('')
}

export function view(state, route) {
  if (route.screen === 'blank') return pages.o00(state)
  const page = pages[route.screen]
  if (!page) return shell({ body: '<h1>Offshore</h1>', actions: quiet('Back to start', 'home') })
  return page(state, route)
}

function homeSplitHtml(state) {
  if (!state.sendHome?.saved) {
    return '<button type="button" class="split" data-act="send-home">On the app or cash only</button>'
  }
  const split = homeSplit(state.home, state.sendHome.app)
  return `<span class="split">On the app ${hk(split.app)} · Cash only ${hk(split.cash)}</span>`
}

function papersQuiet(state) {
  return state.lenders?.length ? quiet('Check a loan’s papers', 'papers') : ''
}

function enteredFact(state) {
  const bits = []
  if (state.pay !== '') bits.push(`Pay ${hk(state.pay)}`)
  if (state.lenders?.length) {
    const left = roundCents(state.lenders.reduce((sum, lender) => sum + money(lender.left), 0))
    bits.push(`Loan left ${hk(left)}`)
  }
  const overdue = lateLenders(state).length
  if (overdue) bits.push(`${overdue} overdue`)
  if ((state.lenders || []).some((lender) => lender.interestUnknown)) bits.push('Interest not known')
  if (!bits.length) return ''
  return `<div class="fact"><b>You entered</b>${bits.join(' · ')}</div>`
}

function packAction(state) {
  const action = state.fix?.lastAction || ''
  if (!lateLenders(state).length && /catch up/i.test(action)) return 'You have not picked one yet.'
  return action || 'You have not picked one yet.'
}

function packWeek(state) {
  const dues = dueThisWeek(state.lenders)
  const dueRows = dues.length
    ? dues.map((lender) => `<div class="row"><span>Due this week</span><span class="v">${esc(lender.name)} · ${esc(shortDate(lender.nextDate))} · ${hk(lender.due)}</span></div>`).join('')
    : '<div class="row"><span>Due this week</span><span class="v">Nothing due this week</span></div>'
  const lates = lateLenders(state)
  const late = lates.length
    ? lates.map((lender) => `<button type="button" class="chip amber" data-act="mark-paid" data-index="${state.lenders.indexOf(lender)}">${esc(lender.name)} ${hk(lender.overdueAmount)}</button>`).join('')
    : '<span class="v">Nothing late</span>'
  return `<div class="week">${dueRows}<div class="row"><span>Late</span><span class="v">${late}</span></div></div>
    <div class="actionpick"><b>Your action</b>${esc(packAction(state))}</div>`
}

function lateLenders(state) {
  return (state.lenders || []).filter((lender) => lender.overdue && money(lender.overdueAmount) > 0)
}

function fixDoorHtml(state) {
  const fig = planFigures(state)
  const late = lateLenders(state).length > 0
  const doors = []
  if (fig.over) {
    doors.push('<button type="button" class="door" data-act="fix-fit"><span class="t">Make this month fit</span><span class="s">Shrink one part until the month fits</span></button>')
  }
  if (late) {
    doors.push('<button type="button" class="door" data-act="fix-catch"><span class="t">Catch up this one</span><span class="s">Pay toward what is late, on a loan you pick</span></button>')
  }
  if (fig.over || late) {
    doors.push('<button type="button" class="door" data-act="fix-fund"><span class="t">Start the fund now</span><span class="s">Pay a bit less on a loan; keep that for yourself</span></button>')
  }
  return doors.length ? `<div class="doors">${doors.join('')}</div>` : ''
}

function cutHint(state) {
  if (!state.fix?.lastCutAmount) return ''
  const part = state.fix.lastCutPart === 'you' ? 'You' : state.fix.lastCutPart === 'bills' ? 'Bills' : 'Home'
  const line = `You cut ${part} by ${hk(state.fix.lastCutAmount)}.`
  if (planFigures(state).over) return `${line} The gap is still there. You can cut again.`
  return `${line} Change any part any time.`
}

function catchUpLine(state) {
  const amount = money(state.catchUp)
  if (amount <= 0 || state.fix?.catchIndex == null || state.fix.catchIndex < 0) return ''
  const lender = state.lenders[state.fix.catchIndex]
  if (!lender) return ''
  const still = lender.overdue && money(lender.overdueAmount) > 0
  const late = still
    ? `${esc(lender.name)} is still late by ${hk(lender.overdueAmount)} until you mark it paid.`
    : `${esc(lender.name)} late is cleared.`
  const mark = still
    ? `<p class="hint"><button type="button" class="textlink" data-act="mark-paid" data-index="${state.fix.catchIndex}">Mark ${esc(lender.name)} paid</button> · Change any part any time.</p>`
    : ''
  return `<div class="catchline"><b>Inside Bills</b>Includes ${hk(amount)} catch up on ${esc(lender.name)}. ${late}</div>${mark}`
}

function stillLateLine(state) {
  const lates = lateLenders(state)
  if (!lates.length) return ''
  const text = lates.map((lender) => `${esc(lender.name)} is still late by ${hk(lender.overdueAmount)}.`).join(' ')
  return `<div class="catchline late"><b>Still late</b>${text}</div>`
}

function dueFact(state) {
  const bits = (state.lenders || []).map((lender) => {
    const often = lender.freq === 'monthly' ? 'a month' : freqWord(lender.freq)
    return `${esc(lender.name)} due ${hk(lender.due)} ${often}`
  })
  return bits.join(' · ')
}

const PAPER_QUESTIONS = [
  { key: 'writing', h1: 'Is it in writing?', body: 'A paper or a message you can show.' },
  { key: 'rate', h1: 'Does it say the rate and the total?', body: 'Interest, and how much you pay back in all.' },
  { key: 'licence', h1: 'Did they say they have a money-lender licence?', body: 'We only save what you heard. We do not decide.' },
  { key: 'hold', h1: 'Does anyone hold your passport, phone or card?', body: '' },
  { key: 'take', h1: 'Can they take from your pay without you saying yes each time?', body: '' },
]

const pages = {
  o00(state) {
    return shell({
      back: false,
      body: `<div class="wordmark">${MARK}<span>Offshore</span></div>
        <h1>Your money.<br>Your plan.</h1>
        <p class="body">You decide every number. We show you how to do each step yourself.</p>
        <div class="private">${LOCK}<span>The plan stays on this phone. Your progress can be saved.</span></div>
        <p class="fine" style="margin-top:14px">This helps you plan. It is not financial advice.</p>`,
      actions: `${primary('Start', 'start')}${quiet('Erase my data', 'erase')}`,
    })
  },
  o01() {
    return shell({
      stepper: 'Start',
      body: `<h1>Where are you right now?</h1>
        <p class="body">Pick one. You can open every part later.</p>
        <div class="doors">
          <button type="button" class="door" data-act="door" data-door="fix"><span class="t">Money is tight right now</span><span class="s">Most people start here.</span></button>
          <button type="button" class="door" data-act="door" data-door="fund"><span class="t">I’m OK. I want savings.</span></button>
          <button type="button" class="door" data-act="door" data-door="goal"><span class="t">I have savings. I want goals.</span></button>
        </div>`,
    })
  },
  o02(state) {
    return shell({
      stepper: 'Step 1 of 6',
      body: `<p class="eyebrow">Money in</p><h1>How much do you get paid each month?</h1>
        ${moneyField('pay', state.pay)}
        <p class="hint">Your pay after any cuts. Change it any time.</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o02a() {
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">What you owe</p><h1>Do you owe anyone money?</h1>
        <p class="body">Loans, cards, or money from family or friends.</p>
        <div class="doors">
          <button type="button" class="door choice" data-act="owes-yes"><span class="t">Yes</span></button>
          <button type="button" class="door choice" data-act="owes-no"><span class="t">No</span></button>
        </div>`,
    })
  },
  o02b(state) {
    const draft = state.draft || { name: '' }
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">What you owe</p><h1>Who is it?</h1>
        <p class="body">Use your own words.</p>
        ${textField('draft.name', draft.name, 'Who')}
        <p class="hint">Like: card, lender, agency, family</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o02c(state) {
    const draft = state.draft || emptyDraft()
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>How much is left to pay?</h1>
        ${moneyField('draft.left', draft.left)}`,
      actions: primary('Next', 'next'),
    })
  },
  o02d(state) {
    const draft = state.draft || emptyDraft()
    const period = draft.interestPeriod || 'month'
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>How much interest do you pay?</h1>
        <p class="body">Check your papers or app.</p>
        <label class="field${draft.interest !== '' ? ' filled' : ''}"><input aria-label="Interest" data-field="draft.interest" data-kind="decimal" inputmode="decimal" autocomplete="off" value="${esc(draft.interest)}"><span class="cur">%</span></label>
        <p class="hint warn" data-cap hidden>That number is too big.</p>
        <div class="seg" role="radiogroup" aria-label="Interest per">
          <button type="button" class="${period === 'month' ? 'on' : ''}" data-act="iperiod" data-value="month" role="radio" aria-checked="${period === 'month'}">a month</button>
          <button type="button" class="${period === 'year' ? 'on' : ''}" data-act="iperiod" data-value="year" role="radio" aria-checked="${period === 'year'}">a year</button>
        </div>`,
      actions: `${primary('Next', 'next')}${quiet('I don’t know', 'interest-unknown')}`,
    })
  },
  o02e(state) {
    const draft = state.draft || emptyDraft()
    const freq = draft.freq || 'monthly'
    const option = (value, label) => `<button type="button" class="r${freq === value ? ' on' : ''}" data-act="freq" data-value="${value}" role="radio" aria-checked="${freq === value}"><i></i>${label}</button>`
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>How much is due each time?</h1>
        ${moneyField('draft.due', draft.due)}
        <p class="flabel">How often?</p>
        <div class="radios" role="radiogroup" aria-label="How often">
          ${option('monthly', 'Monthly')}
          ${option('biweekly', 'Every 2 weeks')}
          ${option('weekly', 'Weekly')}
        </div>`,
      actions: primary('Next', 'next'),
    })
  },
  o02f(state) {
    const draft = state.draft || emptyDraft()
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>When is the next payment due?</h1>
        <label class="field date${draft.nextDate ? ' filled' : ''}"><input type="date" aria-label="Next date" data-field="draft.nextDate" data-kind="date" value="${esc(draft.nextDate)}"></label>
        <p class="hint" data-echo="date" data-empty="Pick a date.">${draft.nextDate ? esc(longDate(draft.nextDate)) : 'Pick a date.'}</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o02g(state) {
    const draft = state.draft || emptyDraft()
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>Is any of it overdue?</h1>
        <p class="body">Overdue means a due date has passed.</p>
        <div class="doors">
          <button type="button" class="door choice" data-act="overdue-yes"><span class="t">Yes</span></button>
          <button type="button" class="door choice" data-act="overdue-no"><span class="t">No</span></button>
        </div>`,
    })
  },
  o02g2(state) {
    const draft = state.draft || emptyDraft()
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>How much is overdue?</h1>
        ${moneyField('draft.overdueAmount', draft.overdueAmount)}`,
      actions: primary('Next', 'next'),
    })
  },
  o02g3(state) {
    const draft = state.draft || emptyDraft()
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">${esc(draft.name)}</p><h1>Since when?</h1>
        <label class="field date${draft.overdueSince ? ' filled' : ''}"><input type="date" aria-label="Overdue since" data-field="draft.overdueSince" data-kind="date" value="${esc(draft.overdueSince)}"></label>
        <p class="hint" data-echo="date" data-empty="Pick the date it was due.">${draft.overdueSince ? esc(longDate(draft.overdueSince)) : 'Pick the date it was due.'}</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o02r(state, route) {
    const lender = state.lenders[route.index]
    const name = lender?.name || 'this'
    return shell({
      stepper: 'What you owe',
      body: `<h1>Remove this?</h1><p class="body">This takes ${esc(name)} off your list.</p>`,
      actions: `${primary('Remove', 'remove-yes')}${quiet('Keep it', 'keep')}`,
    })
  },
  o02h(state) {
    return shell({
      stepper: 'Step 2 of 6',
      body: `<h1>Who you owe</h1><div class="mini">${lenderCards(state)}</div>`,
      actions: `${primary('That’s all', 'thats-all')}${quiet('Add another', 'add-lender')}`,
    })
  },
  o03(state) {
    const total = roundCents(state.lenders.reduce((sum, lender) => sum + money(lender.left), 0))
    const rows = state.lenders.map((lender) => `<div class="row"><span class="k">${esc(lender.name)}</span><span class="v">${hk(lender.left)}</span></div>`).join('')
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">What you owe</p><h1>You owe ${hk(total)} in total.</h1><div class="rows">${rows}</div>`,
      actions: `${primary('Next', 'to-monthly')}${quiet('Change', 'to-summary')}`,
    })
  },
  o04(state) {
    const rows = state.lenders.map((lender) => `<div class="row"><span class="k">${esc(lender.name)} · ${hk(lender.due)} ${freqWord(lender.freq)}</span><span class="v">${hk(monthlyDue(lender.due, lender.freq))}</span></div>`).join('')
    return shell({
      stepper: 'Step 2 of 6',
      body: `<p class="eyebrow">What you owe</p><h1>You pay ${hk(debtMonthly(state.lenders))} a month.</h1><div class="rows">${rows}</div>`,
      actions: `${primary('Next', 'to-plan')}${quiet('Change', 'to-summary')}`,
    })
  },
  o05(state) {
    return shell({
      stepper: 'Your plan',
      body: `<h1>Your pay, your plan</h1>
        <p class="body">Split what you get into three parts. We only use what you enter.</p>
        ${enteredFact(state)}
        <div class="parts">
          <div class="part"><div class="num">1</div><div><div class="t">Home</div><div class="s">What you send home</div></div></div>
          <div class="part"><div class="num">2</div><div><div class="t">Bills</div><div class="s">Bills and debt you pay</div></div></div>
          <div class="part"><div class="num">3</div><div><div class="t">You</div><div class="s">What you keep for yourself</div></div></div>
        </div>`,
      actions: `${primary('Start my plan', 'to-home')}${quiet('Keep for now', 'back')}`,
    })
  },
  o06(state) {
    return shell({
      stepper: 'Step 4 of 6',
      body: `<p class="eyebrow">Part 1 of 3 · Home</p><h1>How much will you send home each month?</h1>
        <p class="body">You decide. Change it any time.</p>
        ${moneyField('home', state.home)}`,
      actions: primary('Next', 'next'),
    })
  },
  o07(state) {
    const bills = billsParts(state)
    const showDebt = state.owes !== false && state.lenders.length > 0
    const debt = showDebt ? `<p class="flabel">Catch up</p>
        ${moneyField('catchUp', catchUpValue(state), 'Catch up')}
        <p class="hint">Overdue money. You can change this.</p>
        <div class="readback"><b data-live="bills-total">Bills part: ${hk(bills.total)}</b><span data-live="bills-includes">Includes ${hk(bills.owe)} for what you owe</span></div>` : ''
    return shell({
      stepper: 'Step 5 of 6',
      body: `<p class="eyebrow">Money out · Part 2 of 3</p><h1>How much for your other bills each month?</h1>
        <p class="body">Phone, transport, and other bills you pay.</p>
        ${moneyField('otherBills', state.otherBills)}
        ${debt}`,
      actions: primary('Next', 'next'),
    })
  },
  o08(state) {
    return shell({
      stepper: 'Step 6 of 6',
      body: `<p class="eyebrow">Part 3 of 3 · You</p><h1>How much will you keep for yourself?</h1>
        <p class="body">For emergencies and your goals.</p>
        ${moneyField('you', state.you)}`,
      actions: primary('Next', 'next'),
    })
  },
  o09(state) {
    const fig = planFigures(state)
    const place = planPartsEntered(state) && fig.left > 0 && !fig.over
    const hint = cutHint(state) || (place
      ? 'Left is in your plan. Place it when you want · Change any part any time.'
      : 'Change any part any time.')
    const late = lateLenders(state).length > 0
    return shell({
      stepper: 'Your plan',
      body: `<div class="planfit"><h1>Your plan for this month</h1>
        <div class="rows">
          <div class="row"><span class="k">Home${homeSplitHtml(state)}</span><span class="v">${hk(fig.home)}</span></div>
          <div class="row"><span class="k">Bills</span><span class="v">${hk(fig.bills)}</span></div>
          <div class="row"><span class="k">You</span><span class="v">${hk(fig.you)}</span></div>
          <div class="row total"><span class="k">Left</span><span class="v" data-left="${fig.left}">${hk(fig.left)}</span></div>
        </div>
        ${stillLateLine(state)}
        ${catchUpLine(state)}
        <p class="hint">${esc(hint)}</p>
        ${fixDoorHtml(state)}</div>`,
      actions: `${primary(place ? 'This is my plan' : 'Done', 'plan-yes')}${place ? quiet('Place what\u2019s left', 'place-left') : ''}${quiet('Sunday Pack', 'sunday-pack')}${quiet('Change a part', 'change-part')}${late ? quiet('Catch up this one', 'fix-catch') : ''}${papersQuiet(state)}`,
    })
  },
  o10(state) {
    const fig = planFigures(state)
    const more = fig.out - fig.pay
    const lates = lateLenders(state)
    const factLate = lates.length
      ? lates.map((lender) => `${esc(lender.name)} is late by ${hk(lender.overdueAmount)}.`).join(' ')
      : 'Nothing is late.'
    const afterCut = !!state.fix?.lastCutAmount
    const pack = quiet('Sunday Pack', 'sunday-pack')
    const actions = afterCut
      ? `${primary('Done', 'plan-yes')}${pack}${quiet('Cut again', 'fix-fit')}${quiet('Change a part', 'change-part')}${papersQuiet(state)}`
      : `${quiet('Keep for now', 'plan-yes')}${pack}${papersQuiet(state)}${quiet('Change a part', 'change-part')}`
    return shell({
      stepper: afterCut ? 'Your plan' : 'Fix',
      body: `<h1>${afterCut ? 'Your plan for this month' : 'What you can do'}</h1>
        <div class="fact"><b>This month</b>${hk(more)} more than you get. ${factLate}${dueFact(state) ? ` ${dueFact(state)}.` : ''}</div>
        <div class="rows">
          <div class="row"><span class="k">Home${homeSplitHtml(state)}</span><span class="v">${hk(fig.home)}</span></div>
          <div class="row"><span class="k">Bills</span><span class="v">${hk(fig.bills)}</span></div>
          <div class="row"><span class="k">You</span><span class="v">${hk(fig.you)}</span></div>
          <div class="row total"><span class="k">Your pay</span><span class="v">${hk(fig.pay)}</span></div>
        </div>
        <p class="note">This is ${hk(more)} more than you get.</p>
        ${stillLateLine(state)}
        ${catchUpLine(state)}
        ${cutHint(state) ? `<p class="hint">${esc(cutHint(state))}</p>` : ''}
        ${fixDoorHtml(state)}`,
      actions,
    })
  },
  parts() {
    return shell({
      stepper: 'Your plan',
      body: `<h1>Which part do you want to change?</h1>
        <div class="doors">
          <button type="button" class="door" data-act="part" data-part="pay"><span class="t">Pay</span><span class="s">What you get each month</span></button>
          <button type="button" class="door" data-act="part" data-part="home"><span class="t">Home</span><span class="s">What you send home</span></button>
          <button type="button" class="door" data-act="part" data-part="bills"><span class="t">Bills</span><span class="s">Bills and what you owe</span></button>
          <button type="button" class="door" data-act="part" data-part="you"><span class="t">You</span><span class="s">What you keep for yourself</span></button>
        </div>`,
    })
  },
  o11(state) {
    const fig = planFigures(state)
    const soon = soonestDue(state.lenders)
    const overdue = overdueTotal(state.lenders)
    const interest = knownInterest(state.lenders)
    const score = scoreOf(state)
    const oweBody = state.lenders.length
      ? `<div class="h">What you owe${soon ? `<span>Next due ${esc(shortDate(soon.nextDate))}</span>` : ''}</div>${overdue ? `<div class="od">Overdue ${hk(overdue)}</div>` : ''}${interest != null ? `<div class="k">${esc(`About ${hk(interest)} interest a month`)}</div>` : ''}`
      : '<div class="h">What you owe</div>'
    return shell({
      stepper: 'Your month',
      body: `<h1>Your month</h1>
        <button type="button" class="lifecard" data-act="today"><div class="h">Today<span>${esc(monthName(new Date()))}</span></div>${planPartsEntered(state) ? `<div class="k">Left this month</div><div class="v" data-left="${fig.left}">${hk(fig.left)}</div><div class="k">In ${hk(fig.pay)} · Out ${hk(fig.out)}</div>` : '<div class="k">Split your pay to see what is left.</div>'}</button>
        <button type="button" class="lifecard" data-act="owe" style="margin-top:12px">${oweBody}</button>
        <div style="height:12px"></div>
        <button type="button" class="score" data-act="score">${ring(score.total)}<div><div class="lbl">Your score</div><div class="why">${esc(lastLine(state, false))}</div></div></button>
        <p class="flabel">How much of your part did you keep?</p>
        ${moneyField('checks.keptAmount', state.checks?.keptAmount || '', 'Kept')}`,
      actions: `${primary('Go to lessons', 'lessons')}${quiet('Sunday Pack', 'sunday-pack')}${quiet('See your life', 'life')}${papersQuiet(state)}`,
    })
  },
  o12(state) {
    return shell({
      stepper: 'Lessons',
      body: `<h1>Manage your own money</h1>
        <p class="body">Not send it out and hope.</p>
        <ol class="tips">
          <li><span class="num">1</span><span>Open your own GCash</span></li>
          <li><span class="num">2</span><span>Send money to you</span></li>
          <li><span class="num">3</span><span>Pay a bill (e.g. social security)</span></li>
          <li><span class="num">4</span><span>Then send to family</span></li>
        </ol>
        <p class="hint">Make sure the money is going where it needs to go.</p>
        <div class="doors">
          <button type="button" class="door" data-act="open-app" data-app="ahk"><span class="t">AlipayHK</span><span class="s">Pay a bill · Send to your GCash · Keep your part</span></button>
          <button type="button" class="door" data-act="open-app" data-app="gcash"><span class="t">GCash</span><span class="s">Open yours · Send to you · Pay a bill · Then family</span></button>
        </div>
        <p class="hint"><button type="button" class="textlink" data-act="send-home">What you send home</button></p>
        ${state.planSet ? '<p class="hint">✓ Your plan is done.</p>' : ''}`,
    })
  },
  lesson(state, route) {
    const lesson = lessonById(route.lessonId)
    const step = lesson.steps[route.step]
    const chips = (step.chips || []).map((chip, index) => `${index ? '<span class="arrow" aria-hidden="true">›</span>' : ''}<span class="chip">${esc(chip)}</span>`).join('')
    const mine = step.mine === 'home'
      ? `<p class="mine">Your plan: <b>${hk(state.home || 0)}</b> home</p>`
      : step.mine === 'family'
        ? `<p class="mine">Your plan: the home amount you chose.</p>`
        : step.mine === 'you'
          ? `<p class="mine">Your plan: <b>${hk(state.you || 0)}</b> for you</p>`
          : ''
    const note = step.note ? `<p class="mine">${esc(step.note)}</p>` : ''
    const unverified = lesson.unverified ? '<p class="fine unverified">Unverified, check in app.</p>' : ''
    const last = route.step + 1 >= lesson.steps.length
    return shell({
      stepper: stepperLabel(lesson, route.step),
      body: `<div class="stepart"><div class="big" aria-hidden="true">${route.step + 1}</div><div class="app">In ${esc(lesson.app)}</div></div>
        <h1>${esc(step.h1)}</h1>
        ${chips ? `<div class="path">${chips}</div>` : ''}
        <p class="body">${step.html ? step.body : esc(step.body)}</p>
        ${mine}${note}${unverified}`,
      actions: `${primary(last ? 'Done' : 'Done, next step', 'lesson-next')}${quiet('I’m stuck', 'stuck')}`,
    })
  },
  o21() {
    return shell({
      stepper: 'Help',
      body: `<h1>Stuck? Try this</h1>
        <ol class="tips">
          <li><span class="num">1</span><span>Update the app and open it again.</span></li>
          <li><span class="num">2</span><span>Check your account is verified in the app.</span></li>
          <li><span class="num">3</span><span>For a remittance with a code: Cash In, then Global Banks and Partners.</span></li>
          <li><span class="num">4</span><span>Open the app’s own Help.</span></li>
        </ol>`,
      actions: `${primary('Back to the step', 'back')}${quiet('Skip this step', 'skip-step')}`,
    })
  },
  o32(state, route) {
    const lesson = lessonById(route.lessonId)
    return shell({
      stepper: 'Lesson done',
      body: `<h1>${esc(lesson.didPrompt)}</h1><p class="body">We can’t see your app. Only you know.</p>`,
      actions: `${primary('Yes, I did it', 'did-yes')}${quiet('Not yet', 'did-no')}`,
    })
  },
  o33(state, route) {
    const score = scoreOf(state)
    return shell({
      stepper: 'Your score',
      body: `<div style="display:flex;justify-content:center;margin:8px 0 18px">${ring(score.total, 'xl')}</div>
        <h1 style="text-align:center">You did it yourself.</h1>
        <p class="body" style="text-align:center">Up ${state.checks.lastDelta}: ${esc(state.checks.lastUp)}</p>`,
      actions: `${primary('Next lesson', 'next-lesson')}${quiet('Back to your month', 'month')}`,
    })
  },
  o23(state) {
    return shell({
      stepper: 'Emergencies · 1 of 3',
      body: `<h1>How much do you want for emergencies?</h1>
        <p class="body">Pick any amount.</p>
        ${moneyField('fundDraft.amount', state.fundDraft.amount)}`,
      actions: `${primary('Next', 'next')}${quiet('Not now', 'life')}`,
    })
  },
  o24(state) {
    return shell({
      stepper: 'Emergencies · 2 of 3',
      body: `<h1>By when?</h1>
        <label class="field month${state.fundDraft.by ? ' filled' : ''}"><input type="month" aria-label="Month" data-field="fundDraft.by" data-kind="month" value="${esc(state.fundDraft.by)}"></label>
        <p class="hint" data-echo="month" data-empty="Pick a month.">${state.fundDraft.by ? esc(monthLong(state.fundDraft.by)) : 'Pick a month.'}</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o25(state) {
    return shell({
      stepper: 'Emergencies · 3 of 3',
      body: `<h1>How much will you put in each month?</h1>
        <p class="body">From the part you keep for yourself.</p>
        ${moneyField('fundDraft.monthly', state.fundDraft.monthly)}`,
      actions: primary('Next', 'next'),
    })
  },
  o26(state) {
    if (state.fund?.fromFix || !state.fund?.by) {
      return shell({
        stepper: 'Emergencies',
        body: `<h1>Money for emergencies</h1>
          <div class="lifecard"><div class="h">Money for emergencies</div>
            <div class="k">${hk(state.fund.monthly)} a month</div>
            <div class="k">No target yet. You can set one later.</div>
          </div>`,
        actions: `${primary('Done', 'life')}${quiet('Change it', 'fund-edit')}`,
      })
    }
    const fund = projectFund(state.fund, new Date())
    const width = fund.amount ? Math.min(100, Math.round((fund.nowSaved / fund.amount) * 100)) : 0
    const math = `${fund.months} months × ${hk(fund.monthly)} = ${hk(fund.could)}.`
    const line = fund.reaches
      ? `${math} On track for your date.`
      : fund.monthly > 0
        ? math
        : 'This does not grow yet.'
    const reach = !fund.reaches && fund.reach
      ? `<p class="hint">You reach this in ${esc(monthShort(fund.reach))}.</p>`
      : ''
    return shell({
      stepper: 'Emergencies',
      body: `<h1>Money for emergencies</h1>
        <div class="lifecard"><div class="h">Your target<span>by ${esc(monthShort(state.fund.by))}</span></div>
          <div class="v">${hk(fund.amount)}</div>
          <div class="bar" aria-hidden="true"><i style="width:${width}%"></i></div>
          <div class="k">Now ${hk(0)} · ${hk(fund.monthly)} each month</div>
        </div>
        <p class="hint">${esc(line)}</p>
        ${reach}`,
      actions: `${primary('Done', 'life')}${quiet('Change it', 'fund-edit')}`,
    })
  },
  o27(state) {
    return shell({
      stepper: 'Goal · 1 of 3',
      body: `<h1>What is your goal?</h1>
        <p class="body">Use any words you like.</p>
        ${textField('goalDraft.name', state.goalDraft.name, 'Goal name')}`,
      actions: `${primary('Next', 'next')}${quiet('Not now', 'life')}`,
    })
  },
  o28(state) {
    return shell({
      stepper: 'Goal · 2 of 3',
      body: `<h1>How much does it cost?</h1>${moneyField('goalDraft.amount', state.goalDraft.amount)}`,
      actions: primary('Next', 'next'),
    })
  },
  o29(state) {
    return shell({
      stepper: 'Goal · 3 of 3',
      body: `<h1>When do you need it?</h1>
        <label class="field month${state.goalDraft.by ? ' filled' : ''}"><input type="month" aria-label="Month" data-field="goalDraft.by" data-kind="month" value="${esc(state.goalDraft.by)}"></label>
        <p class="hint" data-echo="month" data-empty="Pick a month.">${state.goalDraft.by ? esc(monthLong(state.goalDraft.by)) : 'Pick a month.'}</p>`,
      actions: primary('Next', 'next'),
    })
  },
  o30(state, route) {
    const goal = state.goals[route.goalIndex] || state.goals[state.goals.length - 1]
    const proj = projectGoal(state, goal, new Date())
    const when = monthShort(goal.by)
    const reach = proj.reaches
      ? ''
      : proj.reach
        ? `<p class="hint">You reach this in ${esc(monthShort(proj.reach))}.</p>`
        : '<p class="hint">This does not grow yet.</p>'
    return shell({
      stepper: 'Goal',
      body: `<h1>${esc(goal.name)}</h1>
        <div class="lifecard">
          <div class="h">${hk(proj.amount)}<span>by ${esc(when)}</span></div>
          ${spark(proj.could, proj.amount)}
          <div class="k">Dashed line: your ${hk(proj.amount)}</div>
          <div class="cover">${doughnut(proj.pct)}<div class="c"><b>${proj.pct}% by ${esc(when)}</b>You could have ${hk(proj.could)} of ${hk(proj.amount)}.</div></div>
        </div>
        <p class="hint">${hk(proj.freeAfter)} a month still free.</p>
        ${reach}
        <p class="hint">Your emergency money is not counted here.</p>`,
      actions: `${primary('Done', 'life')}${quiet('Add another goal', 'goal-add')}`,
    })
  },
  o31(state) {
    const score = scoreOf(state)
    const row = (label, value, max) => `<li><span>${label}</span><span>${value} of ${max}</span></li>`
    return shell({
      stepper: 'Your score',
      body: `<div style="display:flex;align-items:center;gap:16px;margin-bottom:8px">${ring(score.total)}
          <div><div style="font-size:18px;font-weight:700;color:var(--os-muted)">Your score this month</div>
          <div style="font-size:19px;line-height:1.35">${esc(lastLine(state, true))}</div></div>
        </div>
        <ul class="raises">
          ${row('Payments on time', score.onTime, SCORE_MAX.onTime)}
          ${row('Overdue cleared or shrinking', score.overdue, SCORE_MAX.overdue)}
          ${row('Sent home what you chose', score.sent, SCORE_MAX.sent)}
          ${row('Kept your own part', score.kept, SCORE_MAX.kept)}
          ${row('Lessons finished', score.lessons, SCORE_MAX.lessons)}
        </ul>
        <p class="flabel">How much of your part did you keep?</p>
        ${moneyField('checks.keptAmount', state.checks?.keptAmount || '', 'Kept')}
        <div class="private">${LOCK}<span>Only you can see this. It stays on this phone.</span></div>`,
      actions: primary('Back to your month', 'month'),
    })
  },
  o34() {
    return shell({
      stepper: 'Erase',
      body: `<h1>Erase everything?</h1>
        <p class="body">This removes all your numbers and your score from this phone. You can’t undo it.</p>`,
      actions: `${primary('Erase everything', 'erase-yes')}${quiet('Keep my data', 'keep')}`,
    })
  },
  o35(state) {
    const fig = planFigures(state)
    const score = scoreOf(state)
    const oweLines = state.lenders.map((lender) => {
      const interest = interestText(lender)
      return `<div class="oweline"><span>${esc(lender.name)} · next ${esc(shortDate(lender.nextDate))}</span>${lender.overdue ? `<span class="od">Overdue ${hk(lender.overdueAmount)}</span>` : ''}</div>${interest ? `<div class="k">${esc(interest)}</div>` : ''}`
    }).join('')
    const owe = `<button type="button" class="lifecard" data-act="owe"><div class="h">What you owe</div>${oweLines || '<div class="k">Do you owe anyone money?</div>'}</button>`
    const fundProj = state.fund ? projectFund(state.fund, new Date()) : null
    const fundReach = fundProj && !fundProj.reaches && fundProj.reach
      ? `<div class="k">You reach this in ${esc(monthShort(fundProj.reach))}.</div>`
      : ''
    const fund = !state.fund
      ? `<button type="button" class="lifecard" data-act="fund"><div class="h">Emergencies</div><div class="k">How much do you want for emergencies?</div></button>`
      : state.fund.fromFix || !state.fund.by
        ? `<button type="button" class="lifecard" data-act="fund"><div class="h">Money for emergencies</div><div class="k">${hk(state.fund.monthly)} a month</div><div class="k">No target yet. You can set one later.</div></button>`
        : `<button type="button" class="lifecard" data-act="fund"><div class="h">Emergencies<span>${hk(0)} of ${hk(state.fund.amount)}</span></div><div class="bar" aria-hidden="true"><i style="width:0%"></i></div>${fundReach}</button>`
    const goals = state.goals.length
      ? state.goals.map((goal, index) => {
        const proj = projectGoal(state, goal, new Date())
        const reach = proj.reaches || !proj.reach ? '' : `<div class="k">You reach this in ${esc(monthShort(proj.reach))}.</div>`
        return `<button type="button" class="lifecard" data-act="goal" data-index="${index}"><div class="h">${esc(goal.name)}<span>by ${esc(monthShort(goal.by))}</span></div><div class="cover" style="margin-top:4px">${doughnut(proj.pct)}<div class="c"><b style="font-size:20px">${proj.pct}%</b>covered by your date</div></div>${reach}<div class="k">${hk(proj.freeAfter)} a month still free.</div></button>`
      }).join('')
      : '<button type="button" class="lifecard" data-act="goal-new"><div class="h">What is your goal?</div></button>'
    return shell({
      stepper: 'Your life',
      body: `<h1 style="margin-bottom:10px">Your life</h1>
        <button type="button" class="score compact" data-act="score">${ring(score.total)}<div><div class="lbl">Your score</div><div class="why">${esc(lastLine(state, false))}</div></div></button>
        <div class="mini" style="margin-top:10px">
          <button type="button" class="lifecard" data-act="today"><div class="h">Today<span>${planPartsEntered(state) ? `Left ${hk(fig.left)}` : 'Make your plan'}</span></div></button>
          ${owe}
          ${fund}
          ${goals}
        </div>`,
      actions: `${quiet('Sunday Pack', 'sunday-pack')}${papersQuiet(state)}${quiet('Erase my data', 'erase')}`,
    })
  },
  f01(state) {
    const fig = planFigures(state)
    const gap = roundCents(Math.max(0, fig.out - fig.pay))
    const part = (key, title, amount) => `<button type="button" class="door" data-act="fit-part" data-part="${key}"><span class="t">${title}</span><span class="s">Now ${hk(amount)}</span></button>`
    return shell({
      stepper: 'Make it fit · 1 of 2',
      body: `<p class="eyebrow">Make this month fit</p><h1>Which part do you want to shrink?</h1>
        <div class="fact">You need ${hk(gap)} less to fit.</div>
        <div class="doors">
          ${part('home', 'Home', fig.home)}
          ${part('bills', 'Bills', fig.bills)}
          ${part('you', 'You', fig.you)}
        </div>`,
    })
  },
  f02(state) {
    const part = state.fix?.part || 'home'
    const title = part === 'you' ? 'You' : part === 'bills' ? 'Bills' : 'Home'
    const result = cutResult(state, part, state.fix?.cutAmount || 0)
    return shell({
      stepper: 'Make it fit · 2 of 2',
      body: `<p class="eyebrow">${title} · Make this month fit</p><h1>Cut by how much?</h1>
        ${moneyField('fix.cutAmount', state.fix?.cutAmount || '', 'Cut')}
        <p class="gap" data-live="cut-gap">Gap left after this cut: <b>${hk(result.gap)}</b></p>`,
      actions: primary('Update my plan', 'next'),
    })
  },
  f04(state) {
    const doors = (state.lenders || []).map((lender, index) => {
      const sub = lender.overdue && money(lender.overdueAmount) > 0
        ? `Late by ${hk(lender.overdueAmount)}${lender.nextDate ? ` · next ${esc(shortDate(lender.nextDate))}` : ''}`
        : 'Nothing late'
      return `<button type="button" class="door" data-act="catch-pick" data-index="${index}"><span class="t">${esc(lender.name)}</span><span class="s">${sub}</span></button>`
    }).join('')
    return shell({
      stepper: 'Catch up · 1 of 2',
      body: `<p class="eyebrow">Catch up this one</p><h1>Who do you want to catch up?</h1><div class="doors">${doors}</div>`,
      actions: quiet('Check this loan’s papers', 'papers'),
    })
  },
  f05(state) {
    const lender = state.lenders[state.fix?.catchIndex] || { name: '', overdueAmount: 0 }
    const late = lender.overdue ? money(lender.overdueAmount) : 0
    return shell({
      stepper: 'Catch up · 2 of 2',
      body: `<p class="eyebrow">${esc(lender.name)} · Catch up</p><h1>How much can you pay this month?</h1>
        ${moneyField('fix.catchAmount', state.fix?.catchAmount || '', 'Catch up amount')}
        <p class="hint">Late by ${hk(late)}. You can pay up to that.</p>`,
      actions: primary('Update my plan', 'next'),
    })
  },
  f06d(state) {
    const lender = state.lenders[state.fix?.markIndex] || { name: '', overdueAmount: 0 }
    const late = lender.overdue ? money(lender.overdueAmount) : 0
    return shell({
      stepper: 'Catch up',
      body: `<p class="eyebrow">${esc(lender.name)} · Late</p><h1>How much of the late amount did you pay?</h1>
        ${moneyField('fix.markAmount', state.fix?.markAmount || '', 'Paid')}
        <p class="hint">Late was ${hk(late)}. You can mark up to that.</p>`,
      actions: `${primary('Mark as paid', 'next')}${quiet('Not yet', 'mark-not')}`,
    })
  },
  f06a(state) {
    const doors = (state.lenders || []).map((lender, index) => {
      const often = lender.freq === 'monthly' ? 'a month' : freqWord(lender.freq)
      return `<button type="button" class="door" data-act="fund-pick" data-index="${index}"><span class="t">${esc(lender.name)}</span><span class="s">Due ${hk(lender.due)} ${often}</span></button>`
    }).join('')
    return shell({
      stepper: 'Fund · 1 of 2',
      body: `<p class="eyebrow">Start the fund now</p><h1>Which loan do you want to pay a bit less on?</h1><div class="doors">${doors}</div>`,
      actions: quiet('Check this loan’s papers', 'papers'),
    })
  },
  f06b(state) {
    const lender = state.lenders[state.fix?.fundIndex] || { name: '', due: 0, freq: 'monthly' }
    const reduced = reduceDue(lender, state.fix?.fundLess || 0)
    const often = lender.freq === 'monthly' ? 'a month' : freqWord(lender.freq)
    return shell({
      stepper: 'Fund · 2 of 2',
      body: `<p class="eyebrow">${esc(lender.name)} · Start the fund</p><h1>How much less will you pay on ${esc(lender.name)}?</h1>
        ${moneyField('fix.fundLess', state.fix?.fundLess || '', 'Less')}
        <p class="gap" data-live="fund-less">${esc(lender.name)} due becomes <b>${hk(reduced.due)}</b> ${often}.<br>You put <b>${hk(reduced.applied)}</b> a month aside for emergencies.</p>`,
      actions: primary('Start my fund', 'next'),
    })
  },
  f07(state) {
    return shell({
      stepper: 'Day off',
      body: `<h1>For your day off</h1>
        ${packWeek(state)}
        <div class="saved">${LOCK}<span>Saved on this phone. We\u2019ll pick this up next time you open.</span></div>`,
      actions: primary('Done', 'dayoff-done'),
    })
  },
  ft00(state) {
    return shell({
      stepper: 'Fix',
      body: `<h1>We can still make a plan</h1>
        <p class="body">Split your pay. Pay yourself first. Fix what\u2019s late when you can.</p>
        ${enteredFact(state)}
        <div class="privstrip">The plan stays on this phone. Your progress can be saved.</div>
        <button type="button" class="sidelink" data-act="sunday-pack">Sunday Pack</button>
        <button type="button" class="sidelink" data-act="lessons">Lessons</button>`,
      actions: `${primary('See what you can do', 'see-fix')}${quiet('Keep for now', 'back')}`,
    })
  },
  ft03(state) {
    return shell({
      stepper: 'Day off',
      body: `<span class="followchip">You started this</span>
        <h1>Pick up your day-off pack</h1>
        <p class="body">Same pack. Check what\u2019s due, what\u2019s late, and your action.</p>
        ${packWeek(state)}`,
      actions: `${primary('Continue', 'pack-continue')}${quiet('Not now', 'pack-not-now')}`,
    })
  },
  ft05(state) {
    const left = planLeft(state) || 0
    return shell({
      stepper: 'Your plan',
      body: `<h1 class="leftoverbig">${hk(left)} left this month</h1>
        <p class="leftoversub">From your plan. Place it where you want.</p>
        <div class="placepick">
          <button type="button" class="door" data-act="place-part" data-part="home"><span class="t">Home</span><span class="s">Add to what you send home</span></button>
          <button type="button" class="door" data-act="place-part" data-part="bills"><span class="t">Bills</span><span class="s">Add to bills or debt</span></button>
          <button type="button" class="door" data-act="place-part" data-part="you"><span class="t">You</span><span class="s">Add to what you keep</span></button>
          <button type="button" class="door" data-act="place-cushion"><span class="t">Keep as cushion</span><span class="s">Leave it unassigned for now</span></button>
        </div>`,
    })
  },
  ft08(state) {
    const fig = saveableGap(state) || planFigures(state)
    const row = (name, value) => `<div class="row"><span class="k">${name}</span><span class="v">${hk(value)}</span></div>`
    return shell({
      stepper: 'Day off',
      body: `<span class="followchip">Day-off pack done</span>
        <h1>Room to save this month</h1>
        <p class="leftoversub">Pay you entered · Out from your plan. Nothing we made up.</p>
        <div class="rows">
          ${row('Pay', fig.pay)}
          ${row('Home', fig.home)}
          ${row('Bills', fig.bills)}
          ${row('You', fig.you)}
          <div class="row total"><span class="k">Left</span><span class="v">${hk(fig.left)}</span></div>
        </div>
        <p class="hint">Left is room to start saving.</p>`,
      actions: `${primary('See where it can go', 'gap-go')}${quiet('Done for now', 'pack-later')}`,
    })
  },
  ft09(state) {
    const fig = saveableGap(state) || planFigures(state)
    return shell({
      stepper: 'Day off',
      body: `<span class="followchip">Day-off pack done</span>
        <h1>${hk(fig.left)} left this month</h1>
        <div class="catchline"><b>Your pack helped</b>Catch-up placed · late cleared. That freed room in your plan.</div>
        <p class="leftoversub" style="margin-top:14px">From pay and your plan only \u2014 not invented.</p>
        <div class="rows" style="margin-top:4px">
          <div class="row"><span class="k">Pay</span><span class="v">${hk(fig.pay)}</span></div>
          <div class="row"><span class="k">Out</span><span class="v">${hk(fig.out)}</span></div>
          <div class="row total"><span class="k">Left</span><span class="v">${hk(fig.left)}</span></div>
        </div>`,
      actions: `${primary('See where it can go', 'gap-go')}${quiet('Done for now', 'pack-later')}`,
    })
  },
  ft10(state) {
    const fig = saveableGap(state) || planFigures(state)
    const door = (act, title, sub) => `<button type="button" class="door" data-act="${act}"><span class="t">${title}</span><span class="s">${sub}</span></button>`
    return shell({
      stepper: 'Your plan',
      body: `<h1>Start a cushion</h1>
        <p class="leftoversub">${hk(fig.left)} left from your plan. Put it where it can grow.</p>
        <div class="placepick">
          ${door('cushion-you', 'Put toward You', 'Add to what you keep')}
          ${door('cushion-fund', 'Start a fund', 'Money for emergencies')}
          ${door('cushion-else', 'Place elsewhere', 'Home · Bills · or keep unassigned')}
        </div>`,
    })
  },
  ft07(state) {
    const lender = state.lenders[state.fix?.papersIndex] || { name: 'This loan' }
    const summary = contractSummary(state.contract)
    const labels = (summary.warn ? summary.amber : summary.clear).join(' · ')
    const door = (act, title, sub) => `<button type="button" class="door" data-act="${act}"><span class="t">${title}</span><span class="s">${sub}</span></button>`
    return shell({
      stepper: 'Check',
      body: `<h1>You can still get better</h1>
        <p class="body">We are not lawyers. Split your pay. Pay yourself first.</p>
        <div class="fact"><b>${esc(lender.name)} · facts ready</b>${esc(labels)}</div>
        <div class="helperslot"><b>Someone who can help</b>A helper will be named here. Not named yet.</div>
        <div class="placepick teachdoors">
          ${door('see-fix', 'See what you can do', 'Fix late · fit the month')}
          ${door('sunday-pack', 'Sunday Pack', 'For your day off')}
          ${door('lessons', 'Lessons', 'Split · pay yourself · GCash')}
          ${door('papers-save', 'Save the facts', 'Keep on this phone')}
        </div>`,
    })
  },
  papers(state, route) {
    const lender = state.lenders[state.fix?.papersIndex] || { name: 'this loan' }
    const step = route.step || 0
    const question = PAPER_QUESTIONS[step] || PAPER_QUESTIONS[0]
    const choice = (value, label) => `<button type="button" class="door choice" data-act="paper-answer" data-value="${value}"><span class="t">${label}</span></button>`
    return shell({
      stepper: `Check · ${step + 1} of 5`,
      body: `<p class="eyebrow">Check a loan · ${esc(lender.name)}</p><h1>${esc(question.h1)}</h1>
        ${question.body ? `<p class="body">${esc(question.body)}</p>` : ''}
        <div class="doors">${choice('yes', 'Yes')}${choice('no', 'No')}${choice('unsure', 'Not sure')}</div>`,
    })
  },
  'papers-who'(state) {
    const doors = (state.lenders || []).map((lender, index) => `<button type="button" class="door" data-act="papers-pick" data-index="${index}"><span class="t">${esc(lender.name)}</span></button>`).join('')
    return shell({
      stepper: 'Check',
      body: `<h1>Which loan’s papers?</h1><div class="doors">${doors || '<p class="body">Add what you owe first.</p>'}</div>`,
    })
  },
  'papers-sum'(state) {
    return pages.ft07(state)
  },
  send(state) {
    const split = homeSplit(state.home, state.sendHome?.app || 0)
    const note = split.ok
      ? `<p class="hint" data-live="send-note">Cash only ${hk(split.cash)}. Any merchant the app lists.</p>`
      : '<p class="note" data-live="send-note">The app part cannot be more than the total. You can change it.</p>'
    return shell({
      stepper: 'Home',
      body: `<h1>What you send home</h1>
        <p class="flabel">Total home</p>
        ${moneyField('home', state.home, 'Total home')}
        <p class="flabel">Pay on the app</p>
        ${moneyField('sendHome.app', state.sendHome?.app || '', 'Pay on the app')}
        ${note}`,
      actions: `${primary('Continue', 'next')}${quiet('Not now', 'back')}`,
    })
  },
}
