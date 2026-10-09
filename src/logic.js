/** Pure money, goal, and score rules. Amounts come from her input. */

export const SCORE_MAX = {
  onTime: 35,
  overdue: 20,
  sent: 15,
  kept: 15,
  lessons: 15,
}

export const LESSON_POINTS = {
  'ahk-bill': 3,
  'ahk-send': 3,
  'ahk-save': 2,
  'gcash-in': 2,
  'gcash-bill': 3,
  'gcash-save': 2,
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export const MAX_MONEY = 9999999.99
export const MAX_RATE = 1000

export function money(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Keep digits and one decimal point, with at most two cents. */
export function sanitizeAmount(raw) {
  let value = String(raw ?? '').replace(/[^\d.]/g, '')
  const dot = value.indexOf('.')
  if (dot !== -1) {
    value = `${value.slice(0, dot + 1)}${value.slice(dot + 1).replace(/\./g, '')}`
    const [whole, frac = ''] = value.split('.')
    value = `${whole}.${frac.slice(0, 2)}`
  }
  return value
}

export function roundCents(value) {
  const n = Number(value) || 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function formatAmount(value) {
  const n = roundCents(value)
  if (Object.is(n, -0) || n === 0) return '0'
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}

export function tooBigMoney(value) {
  return money(value) > MAX_MONEY
}

export function hk(value) {
  const n = roundCents(value)
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  const cents = Math.round(abs * 100) % 100
  const text = cents
    ? abs.toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(abs).toLocaleString('en-HK')
  return `${sign}HK$${text}`
}

export function offshoreKey(name) {
  return typeof name === 'string' && name.startsWith('offshore-')
}

/** Exact monthly amount. Round only when the number is shown. */
export function monthlyDue(amount, freq) {
  const n = money(amount)
  if (freq === 'weekly') return (n * 52) / 12
  if (freq === 'biweekly') return (n * 26) / 12
  return n
}

export function freqWord(freq) {
  if (freq === 'weekly') return 'weekly'
  if (freq === 'biweekly') return 'every 2 weeks'
  return 'monthly'
}

export function interestMonth(lender) {
  if (!lender || lender.interestUnknown) return null
  if (lender.interest == null || lender.interest === '') return null
  const left = money(lender.left)
  const pct = money(lender.interest)
  const rate = lender.interestPeriod === 'year' ? pct / 100 / 12 : pct / 100
  return roundCents(left * rate)
}

export function debtMonthly(lenders) {
  return (lenders || []).reduce((sum, lender) => sum + monthlyDue(lender.due, lender.freq), 0)
}

export function overdueTotal(lenders) {
  return roundCents((lenders || []).reduce((sum, lender) => {
    if (!lender.overdue) return sum
    return sum + money(lender.overdueAmount)
  }, 0))
}

export function catchUpValue(state) {
  const cap = state.owes === false ? 0 : overdueTotal(state.lenders)
  if (state.owes === false) return '0'
  if (!state.catchUpEdited) return formatAmount(cap)
  return formatAmount(money(state.catchUp))
}

/** Catch up follows overdue: never above it, and 0 when overdue is 0. */
export function clampCatchUp(state) {
  const cap = state.owes === false ? 0 : overdueTotal(state.lenders)
  if (!state.catchUpEdited) {
    state.catchUp = formatAmount(cap)
    return state.catchUp
  }
  const next = Math.min(cap, money(state.catchUp))
  state.catchUp = formatAmount(next)
  return state.catchUp
}

export function billsParts(state) {
  const other = money(state.otherBills)
  if (state.owes === false) return { other, debt: 0, catchUp: 0, total: other, owe: other }
  const debt = debtMonthly(state.lenders)
  const catchUp = money(catchUpValue(state))
  return { other, debt, catchUp, total: other + debt + catchUp, owe: debt + catchUp }
}

export function planFigures(state) {
  const pay = money(state.pay)
  const home = money(state.home)
  const you = money(state.you)
  const bills = billsParts(state).total
  const out = home + bills + you
  return { pay, home, you, bills, out, left: pay - out, over: out > pay + 0.001 }
}

/** Blank is not zero. She has a plan only after she types Home, other bills, and You. */
export function planPartsEntered(state) {
  return !!state && state.home !== '' && state.otherBills !== '' && state.you !== ''
}

/**
 * Leftover only from a plan she entered.
 * Loan dues and overdue are not spend, and must not become a leftover on their own.
 */
export function planLeft(state) {
  if (!planPartsEntered(state)) return null
  return planFigures(state).left
}

/** Room to save only after she entered the plan and expenses are under her pay. */
export function saveableGap(state) {
  if (!planPartsEntered(state)) return null
  const fig = planFigures(state)
  if (!(fig.left > 0) || fig.over) return null
  return fig
}

/** Pack actions freed room: catch-up is in the plan and nothing is still late. */
export function packFreedRoom(state) {
  if (!saveableGap(state)) return false
  const late = (state.lenders || []).some((lender) => lender.overdue && money(lender.overdueAmount) > 0)
  if (late) return false
  return money(state.catchUp) > 0
}

/** Months from the current month up to, but not including, the target month. */
export function monthsUntil(from, ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 0
  const [y, m] = ym.split('-').map(Number)
  return (y - from.getFullYear()) * 12 + (m - (from.getMonth() + 1))
}

export function goalSurplus(state) {
  const you = money(state.you)
  const fundMonthly = state.fund ? money(state.fund.monthly) : 0
  return roundCents(Math.max(0, you - fundMonthly))
}

/** Month she reaches `amount` if she sets aside `monthly` from this month. */
export function reachMonth(amount, monthly, now = new Date()) {
  const target = roundCents(amount)
  const each = money(monthly)
  if (target <= 0 || each <= 0) return null
  const monthsNeeded = Math.ceil(target / each - 1e-9)
  const date = new Date(now.getFullYear(), now.getMonth() + monthsNeeded, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Goals take the monthly surplus in the order she made them.
 * Each one only gets what is left after the earlier ones.
 * The fund target and balance are not added.
 * On track and 100% only when that goal's own monthly amount reaches it.
 */
export function goalPlans(state, now = new Date()) {
  let free = goalSurplus(state)
  return (state.goals || []).map((goal) => {
    const amount = roundCents(money(goal.amount))
    const months = Math.max(0, monthsUntil(now, goal.by))
    const need = months > 0 && amount > 0 ? amount / months : 0
    const claim = roundCents(Math.min(free, need))
    const could = roundCents(claim * months)
    const reaches = amount > 0 && could + 0.001 >= amount
    let pct = 0
    if (amount > 0) {
      pct = reaches ? 100 : Math.floor((could / amount) * 100)
      if (!reaches && pct > 99) pct = 99
    }
    free = roundCents(Math.max(0, free - claim))
    return {
      goal,
      amount,
      surplus: claim,
      months,
      claim,
      could,
      reaches,
      pct,
      freeAfter: free,
      reach: reaches ? goal.by : reachMonth(amount, claim, now),
    }
  })
}

export function projectGoal(state, goal, now = new Date()) {
  const goals = state.goals || []
  const index = goals.indexOf(goal)
  if (index >= 0) return goalPlans(state, now)[index]
  return goalPlans({ ...state, goals: [goal] }, now)[0]
}

export function projectFund(fund, now = new Date()) {
  const amount = roundCents(money(fund.amount))
  const monthly = money(fund.monthly)
  const months = Math.max(0, monthsUntil(now, fund.by))
  const could = roundCents(months * monthly)
  const reaches = amount > 0 && could + 0.001 >= amount
  return {
    amount,
    monthly,
    months,
    could,
    reaches,
    nowSaved: 0,
    reach: reaches ? fund.by : reachMonth(amount, monthly, now),
  }
}

export function soonestDue(lenders) {
  return [...(lenders || [])]
    .filter((lender) => lender.nextDate)
    .sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)))[0] || null
}

export function partsOfDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  if (!y || !m || !d) return null
  return { y, m, d }
}

export function shortDate(iso) {
  const p = partsOfDate(iso)
  if (!p) return ''
  return `${p.d} ${SHORT[p.m - 1]}`
}

export function longDate(iso) {
  const p = partsOfDate(iso)
  if (!p) return ''
  return `${p.d} ${LONG[p.m - 1]} ${p.y}`
}

export function monthShort(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return `${SHORT[m - 1]} ${y}`
}

export function monthLong(ym) {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  return `${LONG[m - 1]} ${y}`
}

export function monthName(date) {
  return LONG[date.getMonth()]
}

export function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Monthly score out of 100.
 * Sending more or less home is not an input. Only whether she sent what she chose.
 */
export function onTimePoints(state) {
  if (state.owes === false) return SCORE_MAX.onTime
  const lenders = state.lenders || []
  if (!lenders.length) return 0
  const paid = lenders.filter((lender) => lender.paidOnTime === true).length
  return Math.round((SCORE_MAX.onTime * paid) / lenders.length)
}

export function overduePoints(state) {
  if (state.owes === false) return SCORE_MAX.overdue
  const lenders = state.lenders || []
  if (!lenders.length) return 0
  const current = overdueTotal(lenders)
  if (current === 0) return SCORE_MAX.overdue
  const base = state.checks?.overdueBaseline
  if (base == null || base <= 0 || current > base) return 0
  return Math.round(SCORE_MAX.overdue * ((base - current) / base))
}

export function keptPoints(state) {
  const you = money(state.you)
  if (you <= 0) return 0
  const kept = money(state.checks?.keptAmount)
  return Math.round(SCORE_MAX.kept * Math.min(1, Math.max(0, kept / you)))
}

export function scoreOf(state) {
  const checks = state.checks || {}
  const did = checks.lessonsDid || {}
  let lessons = 0
  for (const [id, points] of Object.entries(LESSON_POINTS)) {
    if (did[id] === true) lessons += points
  }
  const onTime = onTimePoints(state)
  const sent = checks.sentWhatSheChose === true ? SCORE_MAX.sent : 0
  const kept = keptPoints(state)
  const overdue = overduePoints(state)
  const total = onTime + overdue + sent + kept + lessons
  return { onTime, overdue, sent, kept, lessons, total }
}

/** Lock overdue at the start of the month. Later growth does not raise it. */
export function noteOverdue(state) {
  if (!state.checks || state.checks.overdueBaseline != null) return
  state.checks.overdueBaseline = overdueTotal(state.lenders)
}

export function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function isPastDate(iso, now = new Date()) {
  return !!iso && iso < todayISO(now)
}

/** A next payment date that has already passed is late. She can continue. */
export function passedDueIsLate(iso, now = new Date()) {
  return isPastDate(iso, now)
}

export function dueThisWeek(lenders, now = new Date()) {
  const start = todayISO(now)
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7)
  const end = todayISO(endDate)
  return (lenders || []).filter((lender) => lender.nextDate && lender.nextDate >= start && lender.nextDate <= end)
}

export function shrinkableBills(state) {
  const parts = billsParts(state)
  return roundCents(parts.other + parts.catchUp)
}

/** How much of a plan part a cut actually removes, and the gap left after it. */
export function cutResult(state, part, rawAmount) {
  const fig = planFigures(state)
  const ask = Math.max(0, money(rawAmount))
  let cap = 0
  if (part === 'home') cap = fig.home
  else if (part === 'you') cap = fig.you
  else cap = shrinkableBills(state)
  const applied = roundCents(Math.min(ask, cap))
  const gap = roundCents(Math.max(0, fig.out - applied - fig.pay))
  return { applied, gap, over: fig.out - applied > fig.pay + 0.001 }
}

/** The typed amount is the monthly fund. The due drops by that same amount, not below 0. */
export function reduceDue(lender, rawAmount) {
  const due = money(lender?.due)
  const applied = roundCents(Math.min(Math.max(0, money(rawAmount)), due))
  return { due: formatAmount(due - applied), monthly: formatAmount(applied), applied }
}

/** She confirms a payment toward what is late. Cap at the overdue still left. */
export function markPaidAmount(lender, rawAmount) {
  const late = lender?.overdue ? money(lender.overdueAmount) : 0
  const applied = roundCents(Math.min(Math.max(0, money(rawAmount)), late))
  const left = roundCents(Math.max(0, late - applied))
  return { applied, left, cleared: left <= 0.001 }
}

/** Cash only is what is left after the app part. An app part above the total does not save. */
export function homeSplit(total, appPart) {
  const home = money(total)
  const app = money(appPart)
  if (app > home + 0.001) return { ok: false, app, home, cash: 0 }
  return { ok: true, app, home, cash: roundCents(home - app) }
}

/**
 * Five answers, then one summary. Not sure is amber. Never a verdict.
 * Hold and take are amber when the answer is yes.
 */
export function contractSummary(answers = {}) {
  const amber = []
  const clear = []
  if (answers.writing === 'yes') clear.push('In writing')
  else if (answers.writing === 'no') amber.push('Not in writing')
  else amber.push('Writing: not sure')
  if (answers.rate === 'yes') clear.push('Rate and total on the paper')
  else if (answers.rate === 'no') amber.push('No rate and total')
  else amber.push('Rate and total: not sure')
  if (answers.licence === 'yes') clear.push('They said they have a licence')
  else if (answers.licence === 'no') amber.push('Licence: they did not say')
  else amber.push('Licence: not sure')
  if (answers.hold === 'no') clear.push('Nothing held')
  else if (answers.hold === 'yes') amber.push('Someone holds your passport, phone or card')
  else amber.push('Not sure if someone holds your passport, phone or card')
  if (answers.take === 'no') clear.push('No take from pay')
  else if (answers.take === 'yes') amber.push('Can take from your pay')
  else amber.push('Not sure if they can take from your pay')
  return { warn: amber.length > 0, amber, clear }
}

export function lenderFromDraft(draft) {
  const overdue = draft.overdue === true
  const unknown = !!draft.interestUnknown && String(draft.interest ?? '') === ''
  return {
    name: draft.name.trim(),
    left: draft.left,
    interest: unknown ? '' : draft.interest,
    interestPeriod: unknown ? null : (draft.interestPeriod || 'month'),
    interestUnknown: unknown,
    due: draft.due,
    freq: draft.freq || 'monthly',
    nextDate: draft.nextDate,
    overdue,
    overdueAmount: overdue ? draft.overdueAmount : '',
    overdueSince: overdue ? draft.overdueSince : '',
    paidOnTime: draft.paidOnTime === true ? true : draft.paidOnTime === false ? false : null,
  }
}
