import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LESSON_POINTS,
  billsParts,
  catchUpValue,
  clampCatchUp,
  debtMonthly,
  goalPlans,
  goalSurplus,
  hk,
  interestMonth,
  isPastDate,
  lenderFromDraft,
  money,
  monthlyDue,
  monthsUntil,
  noteOverdue,
  offshoreKey,
  onTimePoints,
  overduePoints,
  overdueTotal,
  packFreedRoom,
  planFigures,
  planLeft,
  planPartsEntered,
  saveableGap,
  projectFund,
  projectGoal,
  reachMonth,
  roundCents,
  sanitizeAmount,
  scoreOf,
  keptPoints,
  contractSummary,
  cutResult,
  dueThisWeek,
  homeSplit,
  markPaidAmount,
  passedDueIsLate,
  reduceDue,
} from '../src/logic.js'

const oct = new Date(2026, 9, 6)

assert.equal(monthlyDue(500, 'monthly'), 500)
assert.equal(monthlyDue(60, 'weekly'), 260)
assert.equal(monthlyDue(100, 'biweekly'), (100 * 26) / 12)
assert.equal(hk(monthlyDue(100, 'biweekly')), 'HK$216.67')
assert.equal(roundCents(monthlyDue(433.33, 'weekly')), 1877.76)
assert.equal(hk(monthlyDue(433.33, 'weekly')), 'HK$1,877.76')
assert.equal(sanitizeAmount('433.33'), '433.33')
assert.equal(sanitizeAmount('43.339'), '43.33')
assert.equal(sanitizeAmount('4,333'), '4333')
assert.equal(monthsUntil(oct, '2027-08'), 10)
assert.equal(monthsUntil(oct, '2027-10'), 12)
assert.equal(monthsUntil(oct, '2026-11'), 1)
assert.equal(monthsUntil(oct, '2026-10'), 0)

assert.equal(interestMonth({ left: '8000', interest: '3', interestPeriod: 'month' }), 240)
assert.equal(interestMonth({ left: '8000', interest: '36', interestPeriod: 'year' }), 240)
assert.equal(interestMonth({ left: '8000', interestUnknown: true, interest: '' }), null)

const lenders = [
  { due: '500', freq: 'monthly', overdue: true, overdueAmount: '500', left: '8000' },
  { due: '60', freq: 'weekly', overdue: false, overdueAmount: '', left: '4000' },
]
assert.equal(debtMonthly(lenders), 760)
assert.equal(overdueTotal(lenders), 500)

const state = {
  pay: '5220',
  owes: true,
  lenders,
  home: '2000',
  otherBills: '500',
  you: '1000',
  catchUp: '',
  catchUpEdited: false,
  fund: null,
  checks: {
    paidOnTime: false,
    sentWhatSheChose: false,
    keptHerPart: false,
    lessonsDid: {},
    overdueBaseline: 500,
  },
}
assert.equal(catchUpValue(state), '500')
assert.equal(billsParts(state).total, 1760)
state.catchUpEdited = true
state.catchUp = '200'
assert.equal(billsParts(state).total, 1460)
assert.equal(planFigures(state).left, 760)
state.catchUp = '0'
assert.equal(planFigures(state).left, 960)

const duesOnly = {
  pay: '5000',
  owes: true,
  lenders: [{ due: '1200', freq: 'monthly', overdue: true, overdueAmount: '2400', left: '10000' }],
  home: '',
  otherBills: '',
  you: '',
  catchUp: '',
  catchUpEdited: false,
}
assert.equal(planPartsEntered(duesOnly), false)
assert.equal(planLeft(duesOnly), null)
assert.equal(saveableGap(duesOnly), null)
assert.equal(packFreedRoom(duesOnly), false)
assert.equal(debtMonthly(duesOnly.lenders) + overdueTotal(duesOnly.lenders), 3600)
duesOnly.home = '500'
duesOnly.otherBills = '200'
duesOnly.you = '300'
assert.equal(planPartsEntered(duesOnly), true)
assert.equal(planLeft(duesOnly), planFigures(duesOnly).left)

state.you = '1000'
state.fund = { amount: '999999', by: '2027-10', monthly: '500' }
assert.equal(goalSurplus(state), 500)
const short = projectGoal(state, { name: 'School fees', amount: '8000', by: '2026-11' }, oct)
assert.equal(short.could, 500)
assert.equal(short.reaches, false)
assert.notEqual(short.pct, 100)
assert.ok(short.pct < 100)

const sample = projectGoal(state, { amount: '8000', by: '2027-08' }, oct)
assert.equal(sample.could, 5000)
assert.equal(sample.pct, 62)
assert.equal(sample.reaches, false)

const reached = projectGoal(
  { you: '1000', fund: { monthly: '0', amount: '0' } },
  { amount: '1000', by: '2027-08' },
  oct,
)
assert.equal(reached.reaches, true)
assert.equal(reached.pct, 100)

const bigFund = projectGoal(
  { you: '1000', fund: { monthly: '500', amount: '999999' } },
  { amount: '8000', by: '2027-08' },
  oct,
)
assert.equal(bigFund.could, 5000)

const fund = projectFund({ amount: '6000', by: '2027-10', monthly: '500' }, oct)
assert.equal(fund.could, 6000)
assert.equal(fund.reaches, true)
const fundShort = projectFund({ amount: '6000', by: '2026-11', monthly: '500' }, oct)
assert.equal(fundShort.reaches, false)

function scored(patch) {
  return scoreOf({
    owes: true,
    you: '1000',
    lenders: [{ paidOnTime: true, overdue: false, overdueAmount: '' }],
    checks: {
      sentWhatSheChose: true,
      keptAmount: '1000',
      lessonsDid: { 'ahk-send': true },
      overdueBaseline: 0,
      ...patch,
    },
  }).total
}
const withHomeLow = scoreOf({ ...state, home: '100', checks: state.checks })
const withHomeHigh = scoreOf({ ...state, home: '9000', checks: state.checks })
assert.equal(withHomeLow.total, withHomeHigh.total)
assert.equal(withHomeLow.sent, 0)
state.checks.sentWhatSheChose = true
assert.equal(scoreOf(state).sent, 15)
assert.equal(scoreOf({ ...state, home: '1' }).sent, 15)
assert.equal(scoreOf({ ...state, home: '8000' }).total, scoreOf({ ...state, home: '50' }).total)
assert.equal(overduePoints(state), 0)
state.lenders = state.lenders.map((lender) => ({ ...lender, overdue: false, overdueAmount: '' }))
assert.equal(overduePoints(state), 20)
assert.equal(Object.values(LESSON_POINTS).reduce((a, b) => a + b, 0), 15)
assert.equal(scored({}), scored({}))
assert.equal(offshoreKey('offshore-data'), true)
assert.equal(offshoreKey('planted-app'), false)
assert.equal(offshoreKey('Offshore-data'), false)
assert.match(hk(5220), /HK\$5,220/)

const centLenders = ['10.01', '20.02', '30.03', '40.04', '50.05'].map((left) => ({
  left, due: left, freq: 'monthly', overdue: false,
}))
assert.equal(roundCents(centLenders.reduce((sum, lender) => sum + money(lender.left), 0)), 150.15)
assert.equal(hk(150.15), 'HK$150.15')
assert.equal(roundCents(debtMonthly(centLenders)), 150.15)

const typed = lenderFromDraft({
  name: 'Card', left: '10', interest: '4.5', interestUnknown: true, interestPeriod: 'month',
  due: '1', freq: 'monthly', nextDate: '2026-10-20', overdue: false, paidOnTime: true,
})
assert.equal(typed.interestUnknown, false)
assert.equal(typed.interest, '4.5')
assert.equal(typed.paidOnTime, true)
const unknown = lenderFromDraft({
  name: 'Card', left: '10', interest: '', interestUnknown: true, interestPeriod: 'month',
  due: '1', freq: 'monthly', nextDate: '2026-10-20', overdue: false, paidOnTime: null,
})
assert.equal(unknown.interestUnknown, true)

const clampState = {
  owes: true,
  lenders: lenders.map((lender) => ({ ...lender })),
  catchUp: '300',
  catchUpEdited: true,
}
clampCatchUp(clampState)
assert.equal(clampState.catchUp, '300')
clampState.catchUp = '900'
clampCatchUp(clampState)
assert.equal(clampState.catchUp, '500')
clampState.lenders = clampState.lenders.map((lender) => ({ ...lender, overdue: false, overdueAmount: '' }))
clampCatchUp(clampState)
assert.equal(clampState.catchUp, '0')

assert.equal(overduePoints({
  owes: true,
  lenders: [{ overdue: true, overdueAmount: '800' }],
  checks: { overdueBaseline: 500 },
}), 0)
assert.equal(overduePoints({
  owes: true,
  lenders: [{ overdue: true, overdueAmount: '250' }],
  checks: { overdueBaseline: 500 },
}), 10)
assert.equal(onTimePoints({
  owes: true,
  lenders: [{ paidOnTime: true }, { paidOnTime: false }, { paidOnTime: true }, { paidOnTime: null }],
}), 18)
assert.equal(onTimePoints({ owes: false, lenders: [] }), 35)
assert.equal(keptPoints({ you: '1000', checks: { keptAmount: '500' } }), 8)
assert.equal(keptPoints({ you: '1000', checks: { keptAmount: '1000' } }), 15)
assert.equal(keptPoints({ you: '0', checks: { keptAmount: '1000' } }), 0)

const locked = { lenders: [{ overdue: true, overdueAmount: '500' }], checks: { overdueBaseline: null } }
noteOverdue(locked)
assert.equal(locked.checks.overdueBaseline, 500)
locked.lenders[0].overdueAmount = '900'
noteOverdue(locked)
assert.equal(locked.checks.overdueBaseline, 500)

assert.equal(isPastDate('2026-10-05', oct), true)
assert.equal(isPastDate('2026-10-06', oct), false)
assert.equal(passedDueIsLate('2026-10-05', oct), true)
assert.equal(passedDueIsLate('2026-10-06', oct), false)
assert.equal(dueThisWeek([
  { nextDate: '2026-10-06' },
  { nextDate: '2026-10-13' },
  { nextDate: '2026-10-14' },
], oct).length, 2)

const cut = cutResult({
  pay: '5220',
  home: '9000',
  otherBills: '500',
  you: '1000',
  catchUp: '0',
  catchUpEdited: true,
  owes: true,
  lenders: [],
  fund: null,
}, 'home', '100')
assert.equal(cut.applied, 100)
assert.equal(cut.over, true)
const billCut = cutResult({
  pay: '1000',
  home: '0',
  otherBills: '400',
  you: '0',
  catchUp: '300',
  catchUpEdited: true,
  owes: true,
  lenders: [],
  fund: null,
}, 'bills', '500')
assert.equal(billCut.applied, 500)
assert.equal(billCut.gap, 0)
const keptCatch = {
  pay: '5220',
  home: '2000',
  otherBills: '500',
  you: '1000',
  catchUp: '300',
  catchUpEdited: true,
  owes: true,
  lenders: [{ due: '500', freq: 'monthly', overdue: false, overdueAmount: '' }],
  fund: null,
}
assert.equal(catchUpValue(keptCatch), '300')
assert.equal(billsParts(keptCatch).catchUp, 300)

const reduced = reduceDue({ due: '500', freq: 'monthly' }, '200')
assert.equal(reduced.due, '300')
assert.equal(reduced.monthly, '200')
assert.equal(reduceDue({ due: '100' }, '250').due, '0')

const partialPaid = markPaidAmount({ overdue: true, overdueAmount: '500' }, '200')
assert.equal(partialPaid.left, 300)
assert.equal(partialPaid.cleared, false)
assert.equal(markPaidAmount({ overdue: true, overdueAmount: '300' }, '300').cleared, true)
assert.equal(markPaidAmount({ overdue: true, overdueAmount: '300' }, '900').left, 0)

assert.equal(homeSplit('3500', '4000').ok, false)
assert.equal(homeSplit('3500', '1000').cash, 2500)

const amberPapers = contractSummary({ writing: 'no', rate: 'unsure', licence: 'no', hold: 'yes', take: 'yes' })
assert.equal(amberPapers.warn, true)
assert.equal(amberPapers.amber.includes('Not in writing'), true)
assert.equal(JSON.stringify(amberPapers).includes('illegal'), false)
const clearPapers = contractSummary({ writing: 'yes', rate: 'yes', licence: 'yes', hold: 'no', take: 'no' })
assert.equal(clearPapers.warn, false)
assert.equal(clearPapers.clear.includes('In writing'), true)
assert.equal(reachMonth(6000, 500, oct), '2027-10')
assert.equal(projectFund({ amount: '6000', by: '2026-11', monthly: '500' }, oct).reach, '2027-10')

const split = goalPlans({
  you: '1500',
  fund: { monthly: '500' },
  goals: [
    { name: 'First', amount: '5000', by: '2027-08' },
    { name: 'Second', amount: '8000', by: '2027-08' },
  ],
}, oct)
assert.equal(split[0].claim, 500)
assert.equal(split[0].reaches, true)
assert.equal(split[0].freeAfter, 500)
assert.equal(split[1].claim, 500)
assert.equal(split[1].could, 5000)
assert.equal(split[1].reaches, false)
assert.notEqual(split[1].pct, 100)
assert.equal(split[1].freeAfter, 0)

const source = [
  'src/logic.js', 'src/store.js', 'src/main.js', 'src/screens.js', 'public/sw.js',
].map((file) => readFileSync(file, 'utf8')).join('\n')
assert.equal(source.includes('localStorage.clear'), false)
assert.equal(source.includes('sessionStorage.clear'), false)
assert.match(readFileSync('src/store.js', 'utf8'), /offshoreKey/)
assert.match(readFileSync('public/sw.js', 'utf8'), /startsWith\('offshore-'\)/)
assert.equal(scoreOf.toString().includes('home'), false)
assert.equal(scoreOf.toString().includes('.you'), false)

console.log('logic-check ok')
