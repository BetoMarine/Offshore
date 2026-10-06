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

export function money(value) {
  if (value == null || value === '') return 0
  const n = Number(String(value).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function hk(value) {
  const n = Math.round(Number(value) || 0)
  const sign = n < 0 ? '-' : ''
  return `${sign}HK$${Math.abs(n).toLocaleString('en-HK')}`
}

export function offshoreKey(name) {
  return typeof name === 'string' && name.startsWith('offshore-')
}

export function monthlyDue(amount, freq) {
  const n = money(amount)
  if (freq === 'weekly') return Math.round((n * 52) / 12)
  if (freq === 'biweekly') return Math.round((n * 26) / 12)
  return Math.round(n)
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
  return Math.round(left * rate)
}

export function debtMonthly(lenders) {
  return (lenders || []).reduce((sum, lender) => sum + monthlyDue(lender.due, lender.freq), 0)
}

export function overdueTotal(lenders) {
  return (lenders || []).reduce((sum, lender) => {
    if (!lender.overdue) return sum
    return sum + Math.round(money(lender.overdueAmount))
  }, 0)
}

export function catchUpValue(state) {
  if (state.catchUpEdited) return String(state.catchUp ?? '')
  return String(overdueTotal(state.lenders))
}

export function billsParts(state) {
  const other = Math.round(money(state.otherBills))
  if (state.owes === false) return { other, debt: 0, catchUp: 0, total: other }
  const debt = debtMonthly(state.lenders)
  const catchUp = Math.round(money(catchUpValue(state)))
  return { other, debt, catchUp, total: other + debt + catchUp }
}

export function planFigures(state) {
  const pay = Math.round(money(state.pay))
  const home = Math.round(money(state.home))
  const you = Math.round(money(state.you))
  const bills = billsParts(state).total
  const out = home + bills + you
  return { pay, home, you, bills, out, left: pay - out, over: out > pay }
}

/** Months from the current month up to, but not including, the target month. */
export function monthsUntil(from, ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return 0
  const [y, m] = ym.split('-').map(Number)
  return (y - from.getFullYear()) * 12 + (m - (from.getMonth() + 1))
}

export function goalSurplus(state) {
  const you = Math.round(money(state.you))
  const fundMonthly = state.fund ? Math.round(money(state.fund.monthly)) : 0
  return Math.max(0, you - fundMonthly)
}

/**
 * What she could set aside for one goal by its date.
 * The emergency fund target and balance are not added.
 * On track and 100% only when the monthly surplus reaches the amount.
 */
export function projectGoal(state, goal, now = new Date()) {
  const amount = Math.round(money(goal.amount))
  const surplus = goalSurplus(state)
  const months = Math.max(0, monthsUntil(now, goal.by))
  const could = surplus * months
  const reaches = amount > 0 && could >= amount
  let pct = 0
  if (amount > 0) {
    pct = reaches ? 100 : Math.floor((could / amount) * 100)
    if (!reaches && pct > 99) pct = 99
  }
  return { amount, surplus, months, could, reaches, pct }
}

export function projectFund(fund, now = new Date()) {
  const amount = Math.round(money(fund.amount))
  const monthly = Math.round(money(fund.monthly))
  const months = Math.max(0, monthsUntil(now, fund.by))
  const could = months * monthly
  const reaches = amount > 0 && could >= amount
  return { amount, monthly, months, could, reaches, nowSaved: 0 }
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
export function scoreOf(state) {
  const checks = state.checks || {}
  const did = checks.lessonsDid || {}
  let lessons = 0
  for (const [id, points] of Object.entries(LESSON_POINTS)) {
    if (did[id] === true) lessons += points
  }
  const onTime = checks.paidOnTime === true ? SCORE_MAX.onTime : 0
  const sent = checks.sentWhatSheChose === true ? SCORE_MAX.sent : 0
  const kept = checks.keptHerPart === true ? SCORE_MAX.kept : 0
  const overdue = overduePoints(state)
  const total = onTime + overdue + sent + kept + lessons
  return { onTime, overdue, sent, kept, lessons, total }
}

export function overduePoints(state) {
  if (state.owes === false) return SCORE_MAX.overdue
  if (!state.lenders || state.lenders.length === 0) return 0
  const current = overdueTotal(state.lenders)
  if (current === 0) return SCORE_MAX.overdue
  const base = state.checks?.overdueBaseline
  if (base != null && current < base) return SCORE_MAX.overdue
  return 0
}

export function noteOverdue(state) {
  const current = overdueTotal(state.lenders)
  const base = state.checks.overdueBaseline
  if (base == null || current > base) state.checks.overdueBaseline = current
}

export function lenderFromDraft(draft) {
  const overdue = draft.overdue === true
  return {
    name: draft.name.trim(),
    left: draft.left,
    interest: draft.interestUnknown ? '' : draft.interest,
    interestPeriod: draft.interestUnknown ? null : draft.interestPeriod,
    interestUnknown: !!draft.interestUnknown,
    due: draft.due,
    freq: draft.freq || 'monthly',
    nextDate: draft.nextDate,
    overdue,
    overdueAmount: overdue ? draft.overdueAmount : '',
    overdueSince: overdue ? draft.overdueSince : '',
  }
}
