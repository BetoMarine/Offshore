import { currentMonthKey, noteOverdue, offshoreKey, overdueTotal } from './logic.js'

export const DATA_KEY = 'offshore-data'

export function freshState() {
  return {
    pay: '',
    owes: null,
    lenders: [],
    draft: null,
    editIndex: -1,
    home: '',
    otherBills: '',
    catchUp: '',
    catchUpEdited: false,
    you: '',
    planSet: false,
    fund: null,
    fundDraft: { amount: '', by: '', monthly: '' },
    goals: [],
    goalDraft: { name: '', amount: '', by: '', index: -1 },
    afterSetup: null,
    returnTo: null,
    fix: freshFix(),
    sendHome: { app: '', saved: false, blocked: false },
    contract: freshContract(),
    sundayPack: { started: false },
    checks: freshChecks(),
  }
}

export function freshFix() {
  return {
    part: 'home',
    cutAmount: '',
    lastCutPart: '',
    lastCutAmount: '',
    catchIndex: -1,
    fundIndex: -1,
    papersIndex: -1,
    markIndex: -1,
    markAmount: '',
    catchAmount: '',
    fundLess: '',
    lastAction: '',
  }
}

export function freshContract() {
  return { writing: '', rate: '', licence: '', hold: '', take: '' }
}

function freshChecks(month = currentMonthKey()) {
  return {
    month,
    paidOnTime: false,
    sentWhatSheChose: false,
    keptHerPart: false,
    keptAmount: '',
    lessonsDid: {},
    overdueBaseline: null,
    lastUp: '',
    lastDelta: 0,
  }
}

export function blankDraft() {
  return {
    name: '',
    left: '',
    interest: '',
    interestPeriod: 'month',
    interestUnknown: false,
    due: '',
    freq: 'monthly',
    nextDate: '',
    overdue: null,
    overdueAmount: '',
    overdueSince: '',
    paidOnTime: null,
  }
}

export function draftFromLender(lender) {
  return {
    name: lender.name || '',
    left: String(lender.left ?? ''),
    interest: lender.interestUnknown ? '' : String(lender.interest ?? ''),
    interestPeriod: lender.interestPeriod || 'month',
    interestUnknown: !!lender.interestUnknown,
    due: String(lender.due ?? ''),
    freq: lender.freq || 'monthly',
    nextDate: lender.nextDate || '',
    overdue: lender.overdue ? true : false,
    overdueAmount: lender.overdue ? String(lender.overdueAmount ?? '') : '',
    overdueSince: lender.overdue ? lender.overdueSince || '' : '',
    paidOnTime: lender.paidOnTime === true ? true : lender.paidOnTime === false ? false : null,
  }
}

function rollMonth(state) {
  const month = currentMonthKey()
  if (!state.checks || state.checks.month !== month) {
    const baseline = overdueTotal(state.lenders)
    state.checks = freshChecks(month)
    state.checks.overdueBaseline = baseline
    for (const lender of state.lenders || []) lender.paidOnTime = null
  }
  if (state.checks.keptAmount == null) state.checks.keptAmount = ''
  if (!state.checks.lessonsDid) state.checks.lessonsDid = {}
  if (!state.fundDraft) state.fundDraft = { amount: '', by: '', monthly: '' }
  if (!state.goalDraft) state.goalDraft = { name: '', amount: '', by: '', index: -1 }
  if (!Array.isArray(state.lenders)) state.lenders = []
  if (!Array.isArray(state.goals)) state.goals = []
  return state
}

export function loadState() {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw)
    const state = freshState()
    Object.assign(state, parsed)
    state.checks = { ...freshChecks(), ...(parsed.checks || {}) }
    state.fundDraft = parsed.fundDraft || { amount: '', by: '', monthly: '' }
    state.goalDraft = parsed.goalDraft || { name: '', amount: '', by: '', index: -1 }
    if (!Array.isArray(state.lenders)) state.lenders = []
    if (!Array.isArray(state.goals)) state.goals = []
    state.fix = { ...freshFix(), ...(parsed.fix || {}) }
    state.sendHome = { app: '', saved: false, blocked: false, ...(parsed.sendHome || {}) }
    state.contract = { ...freshContract(), ...(parsed.contract || {}) }
    state.sundayPack = { started: false, ...(parsed.sundayPack || {}) }
    state.afterSetup = null
    state.returnTo = null
    return rollMonth(state)
  } catch {
    return freshState()
  }
}

export function saveState(state) {
  localStorage.setItem(DATA_KEY, JSON.stringify(state))
}

function dropPrefixed(storage) {
  if (!storage) return
  const keys = []
  for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i))
  for (const key of keys) {
    if (offshoreKey(key)) storage.removeItem(key)
  }
}

function deleteDatabase(name) {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(name)
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

/** Removes only offshore- keys, databases, and caches. */
export async function eraseOffshore() {
  dropPrefixed(globalThis.localStorage)
  dropPrefixed(globalThis.sessionStorage)
  if (globalThis.indexedDB?.databases) {
    const dbs = await indexedDB.databases()
    await Promise.all(
      dbs
        .filter((db) => offshoreKey(db.name))
        .map((db) => deleteDatabase(db.name)),
    )
  }
  if (globalThis.caches?.keys) {
    const names = await caches.keys()
    await Promise.all(names.filter((name) => offshoreKey(name)).map((name) => caches.delete(name)))
  }
}

export function rememberOverdue(state) {
  noteOverdue(state)
}
