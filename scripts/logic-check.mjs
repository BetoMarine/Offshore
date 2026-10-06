import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  LESSON_POINTS,
  billsParts,
  catchUpValue,
  debtMonthly,
  goalSurplus,
  hk,
  interestMonth,
  monthlyDue,
  monthsUntil,
  offshoreKey,
  overduePoints,
  overdueTotal,
  planFigures,
  projectFund,
  projectGoal,
  scoreOf,
} from '../src/logic.js'

const oct = new Date(2026, 9, 6)

assert.equal(monthlyDue(500, 'monthly'), 500)
assert.equal(monthlyDue(60, 'weekly'), 260)
assert.equal(monthlyDue(100, 'biweekly'), 217)
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
    lenders,
    checks: {
      paidOnTime: true,
      sentWhatSheChose: true,
      keptHerPart: true,
      lessonsDid: { 'ahk-send': true },
      overdueBaseline: 500,
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
