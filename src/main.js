import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './tokens.css'
import './app.css'

import { firstLesson, lessonById, nextLessonId } from './lessons.js'
import {
  billsParts,
  hk,
  lenderFromDraft,
  longDate,
  monthLong,
  noteOverdue,
  planFigures,
  scoreOf,
} from './logic.js'
import { view } from './screens.js'
import {
  blankDraft,
  draftFromLender,
  eraseOffshore,
  freshState,
  loadState,
  saveState,
} from './store.js'

let state = loadState()
let history = [{ screen: 'o00' }]

const app = document.querySelector('#app')
const screenEl = document.querySelector('#screen')

function route() {
  return history[history.length - 1]
}

function frameOf(item) {
  if (item.screen === 'lesson') {
    const lesson = lessonById(item.lessonId)
    return lesson?.steps?.[item.step]?.frame || 'lesson'
  }
  return item.screen
}

function paint() {
  const item = route()
  app.dataset.screen = frameOf(item)
  screenEl.className = item.screen === 'blank' ? 'screen blank' : 'screen'
  screenEl.innerHTML = view(state, item)
  refreshGates()
}

function go(screen, extra = {}) {
  history.push({ screen, ...extra })
  saveState(state)
  paint()
}

function paintOnly() {
  saveState(state)
  paint()
}

function back() {
  if (history.length <= 1) return
  const leaving = history.pop()
  if (leaving.screen === 'o02b') {
    state.draft = null
    state.editIndex = -1
  }
  saveState(state)
  paint()
}

function home() {
  history = [{ screen: 'o00' }]
  paint()
}

function setField(path, value) {
  const [head, tail] = path.split('.')
  if (tail) state[head][tail] = value
  else state[head] = value
}

function canAdvance() {
  const item = route()
  const draft = state.draft
  switch (item.screen) {
    case 'o02': return state.pay !== ''
    case 'o02b': return !!draft && draft.name.trim() !== ''
    case 'o02c': return !!draft && draft.left !== ''
    case 'o02d': return !!draft && draft.interest !== ''
    case 'o02e': return !!draft && draft.due !== ''
    case 'o02f': return !!draft && draft.nextDate !== ''
    case 'o02g2': return !!draft && draft.overdueAmount !== ''
    case 'o02g3': return !!draft && draft.overdueSince !== ''
    case 'o06': return state.home !== ''
    case 'o07': return state.otherBills !== ''
    case 'o08': return state.you !== ''
    case 'o23': return state.fundDraft.amount !== ''
    case 'o24': return state.fundDraft.by !== ''
    case 'o25': return state.fundDraft.monthly !== ''
    case 'o27': return state.goalDraft.name.trim() !== ''
    case 'o28': return state.goalDraft.amount !== ''
    case 'o29': return state.goalDraft.by !== ''
    default: return true
  }
}

function refreshGates() {
  const button = screenEl.querySelector('[data-act="next"]')
  if (!button) return
  button.disabled = !canAdvance()
}

function updateLive() {
  const bills = billsParts(state)
  const total = document.querySelector('[data-live="bills-total"]')
  if (total) total.textContent = `Bills part: ${hk(bills.total)}`
  const includes = document.querySelector('[data-live="bills-includes"]')
  if (includes) includes.textContent = `Includes ${hk(bills.debt)} for what you owe`
}

function commitLender() {
  const lender = lenderFromDraft(state.draft)
  if (state.editIndex >= 0) state.lenders[state.editIndex] = lender
  else state.lenders.push(lender)
  state.owes = true
  state.draft = null
  state.editIndex = -1
  noteOverdue(state)
  saveState(state)
  go('o02h')
}

function saveGoal() {
  const goal = {
    name: state.goalDraft.name.trim(),
    amount: state.goalDraft.amount,
    by: state.goalDraft.by,
  }
  let index = state.goalDraft.index
  if (index >= 0) state.goals[index] = goal
  else {
    state.goals.push(goal)
    index = state.goals.length - 1
  }
  state.goalDraft = { name: '', amount: '', by: '', index: -1 }
  saveState(state)
  go('o30', { goalIndex: index })
}

function next() {
  if (!canAdvance()) return
  const item = route()
  switch (item.screen) {
    case 'o02': return go('o02a')
    case 'o02b': return go('o02c')
    case 'o02c': return go('o02d')
    case 'o02d': return go('o02e')
    case 'o02e': return go('o02f')
    case 'o02f': return go('o02g')
    case 'o02g2': return go('o02g3')
    case 'o02g3': return commitLender()
    case 'o06': return go('o07')
    case 'o07': return go('o08')
    case 'o08': return go(planFigures(state).over ? 'o10' : 'o09')
    case 'o23': return go('o24')
    case 'o24': return go('o25')
    case 'o25':
      state.fund = {
        amount: state.fundDraft.amount,
        by: state.fundDraft.by,
        monthly: state.fundDraft.monthly,
      }
      saveState(state)
      return go('o26')
    case 'o27': return go('o28')
    case 'o28': return go('o29')
    case 'o29': return saveGoal()
    default: return undefined
  }
}

function lessonNext() {
  const item = route()
  const lesson = lessonById(item.lessonId)
  if (item.step + 1 >= lesson.steps.length) go('o32', { lessonId: item.lessonId })
  else go('lesson', { lessonId: item.lessonId, step: item.step + 1 })
}

function skipStep() {
  history.pop()
  const item = route()
  const lesson = lessonById(item.lessonId)
  if (!lesson) return paint()
  if (item.step + 1 >= lesson.steps.length) go('o32', { lessonId: item.lessonId })
  else {
    item.step += 1
    paintOnly()
  }
}

function didYes() {
  const id = route().lessonId
  const lesson = lessonById(id)
  const before = scoreOf(state).total
  state.checks.lessonsDid[id] = true
  if (lesson.sets) state.checks[lesson.sets] = true
  state.checks.lastDelta = scoreOf(state).total - before
  state.checks.lastUp = lesson.pointsReason
  saveState(state)
  go('o33', { lessonId: id })
}

async function doErase() {
  await eraseOffshore()
  state = freshState()
  history = [{ screen: 'o00' }]
  paint()
}

function onClick(event) {
  const el = event.target.closest('[data-act]')
  if (!el || el.disabled) return
  const act = el.dataset.act
  if (act === 'back') return back()
  if (act === 'exit') return go('blank')
  if (act === 'home') return home()
  if (act === 'start') return go('o01')
  if (act === 'erase') return go('o34')
  if (act === 'erase-yes') return doErase()
  if (act === 'keep') return back()
  if (act === 'next') return next()
  if (act === 'door') {
    if (el.dataset.door === 'fix') return go('o02')
    if (el.dataset.door === 'fund') {
      state.fundDraft = state.fund
        ? { amount: state.fund.amount, by: state.fund.by, monthly: state.fund.monthly }
        : { amount: '', by: '', monthly: '' }
      return go('o23')
    }
    state.goalDraft = { name: '', amount: '', by: '', index: -1 }
    return go('o27')
  }
  if (act === 'owes-yes') {
    state.owes = true
    if (state.lenders.length) return go('o02h')
    state.editIndex = -1
    state.draft = blankDraft()
    return go('o02b')
  }
  if (act === 'owes-no') {
    state.owes = false
    state.lenders = []
    state.draft = null
    state.editIndex = -1
    state.checks.overdueBaseline = 0
    saveState(state)
    return go('o05')
  }
  if (act === 'interest-unknown') {
    state.draft.interestUnknown = true
    state.draft.interest = ''
    return go('o02e')
  }
  if (act === 'iperiod') {
    state.draft.interestPeriod = el.dataset.value
    return paintOnly()
  }
  if (act === 'freq') {
    state.draft.freq = el.dataset.value
    return paintOnly()
  }
  if (act === 'overdue-yes') {
    state.draft.overdue = true
    return go('o02g2')
  }
  if (act === 'overdue-no') {
    state.draft.overdue = false
    return commitLender()
  }
  if (act === 'thats-all') {
    noteOverdue(state)
    saveState(state)
    return go('o03')
  }
  if (act === 'add-lender') {
    state.editIndex = -1
    state.draft = blankDraft()
    return go('o02b')
  }
  if (act === 'edit-lender') {
    const index = Number(el.dataset.index)
    state.editIndex = index
    state.draft = draftFromLender(state.lenders[index])
    return go('o02b')
  }
  if (act === 'to-monthly') return go('o04')
  if (act === 'to-plan' || act === 'to-home') return act === 'to-plan' ? go('o05') : go('o06')
  if (act === 'to-summary') return go('o02h')
  if (act === 'change-part') return go('o06')
  if (act === 'plan-yes') {
    state.planSet = true
    saveState(state)
    return go('o11')
  }
  if (act === 'lessons') return go('o12')
  if (act === 'life') return go('o35')
  if (act === 'month') return go('o11')
  if (act === 'score') return go('o31')
  if (act === 'today') {
    if (route().screen === 'o35') return go('o11')
    if (!state.planSet) return go('o05')
    return go(planFigures(state).over ? 'o10' : 'o09')
  }
  if (act === 'owe') {
    if (!state.pay) return go('o02')
    if (!state.lenders.length) return go('o02a')
    return go('o02h')
  }
  if (act === 'open-app') {
    const lesson = firstLesson(el.dataset.app)
    return go('lesson', { lessonId: lesson.id, step: 0 })
  }
  if (act === 'lesson-next') return lessonNext()
  if (act === 'stuck') return go('o21')
  if (act === 'skip-step') return skipStep()
  if (act === 'did-yes') return didYes()
  if (act === 'did-no') return back()
  if (act === 'next-lesson') {
    const id = nextLessonId(route().lessonId)
    if (id) return go('lesson', { lessonId: id, step: 0 })
    return go('o12')
  }
  if (act === 'fund') {
    if (!state.fund) {
      state.fundDraft = { amount: '', by: '', monthly: '' }
      return go('o23')
    }
    return go('o26')
  }
  if (act === 'fund-edit') {
    state.fundDraft = { amount: state.fund.amount, by: state.fund.by, monthly: state.fund.monthly }
    return go('o23')
  }
  if (act === 'goal' ) return go('o30', { goalIndex: Number(el.dataset.index) })
  if (act === 'goal-new' || act === 'goal-add') {
    state.goalDraft = { name: '', amount: '', by: '', index: -1 }
    return go('o27')
  }
  return undefined
}

function onInput(event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement) || !input.dataset.field) return
  let value = input.value
  if (input.dataset.kind === 'money') value = value.replace(/[^\d]/g, '')
  if (input.dataset.kind === 'decimal') {
    value = value.replace(/[^\d.]/g, '')
    const bits = value.split('.')
    if (bits.length > 2) value = `${bits[0]}.${bits.slice(1).join('')}`
  }
  if (value !== input.value) input.value = value
  setField(input.dataset.field, value)
  if (input.dataset.field === 'catchUp') state.catchUpEdited = true
  input.closest('.field')?.classList.toggle('filled', value !== '')
  saveState(state)
  updateLive()
  refreshGates()
  const echo = input.closest('.content')?.querySelector('[data-echo]')
  if (echo) {
    if (!value) echo.textContent = echo.dataset.empty || ''
    else if (input.dataset.kind === 'month') echo.textContent = monthLong(value)
    else if (input.dataset.kind === 'date') echo.textContent = longDate(value)
  }
}

async function setupServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  const params = new URLSearchParams(location.search)
  const kill = params.get('offshore-kill-sw')
  if (kill === '1') localStorage.setItem('offshore-sw-kill', '1')
  if (kill === '0') localStorage.removeItem('offshore-sw-kill')
  if (localStorage.getItem('offshore-sw-kill') === '1') {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(regs.filter((reg) => reg.scope.includes('/Offshore/')).map((reg) => reg.unregister()))
    if (globalThis.caches?.keys) {
      const names = await caches.keys()
      await Promise.all(names.filter((name) => name.startsWith('offshore-')).map((name) => caches.delete(name)))
    }
    return
  }
  const reg = await navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
  const bar = document.querySelector('#update-bar')
  const show = () => { bar.hidden = false }
  if (reg.waiting && navigator.serviceWorker.controller) show()
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) show()
    })
  })
  document.querySelector('#update-reload').addEventListener('click', () => {
    reg.waiting?.postMessage('SKIP_WAITING')
    let done = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (done) return
      done = true
      location.reload()
    })
  })
}

app.addEventListener('click', onClick)
app.addEventListener('input', onInput)
paint()
setupServiceWorker().catch(() => {})
