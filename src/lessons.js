/** Lesson steps. Words are the app’s own button names. No links that move money. */

export const LESSONS = [
  {
    id: 'ahk-bill',
    app: 'AlipayHK',
    group: 'ahk',
    stepper: 'Pay a bill',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you pay your bill?',
    sets: null,
    steps: [
      {
        frame: 'o13',
        h1: 'Open Bill payment',
        chips: ['More', 'Bill payment'],
        body: 'Tap these on the home screen.',
      },
      {
        frame: 'o14',
        h1: 'Add your bill',
        chips: ['Add Bill', 'Merchant'],
        body: 'Then pick who you pay, or search the name.',
      },
      {
        frame: 'o15',
        h1: 'Pay it',
        body: 'Enter your bill account details. Pick how to pay. Enter your payment password.',
      },
    ],
  },
  {
    id: 'ahk-send',
    app: 'AlipayHK',
    group: 'ahk',
    stepper: 'Send home',
    pointsReason: 'you sent home what you chose.',
    didPrompt: 'Did you send the amount you chose?',
    sets: 'sentWhatSheChose',
    steps: [
      {
        frame: 'o16',
        h1: 'Open Remittance',
        chips: ['More', 'Remittance'],
        body: 'Tap these on the home screen.',
      },
      {
        frame: 'o17',
        h1: 'Start a new one',
        chips: ['New Remittance'],
        body: 'Pick where it goes. Pick how they get it.',
      },
      {
        frame: 'o18',
        h1: 'Check and send',
        body: 'Enter the amount you chose. Add their details. Check, then confirm.',
        mine: 'home',
      },
    ],
  },
  {
    id: 'ahk-save',
    app: 'AlipayHK',
    group: 'ahk',
    stepper: 'Save',
    unverified: true,
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you keep your part?',
    sets: null,
    steps: [
      {
        frame: 'o19',
        h1: 'Keep your part apart',
        body: 'Put the money you keep for yourself in a savings account you choose.',
        mine: 'you',
      },
    ],
  },
  {
    id: 'gcash-in',
    app: 'GCash',
    group: 'gcash',
    stepper: 'GCash',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you see the money come in?',
    sets: null,
    steps: [
      {
        frame: 'o20',
        h1: 'See it came in',
        chips: ['Transactions'],
        body: 'Look for <b>Received Remittance</b>.',
        html: true,
      },
    ],
  },
  {
    id: 'gcash-bill',
    app: 'GCash',
    group: 'gcash',
    stepper: 'GCash',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you pay your bill?',
    sets: null,
    steps: [
      {
        frame: 'o22a',
        h1: 'Pay a bill',
        chips: ['Bills'],
        body: 'Pick your biller. Enter the details, then tap <b>Next</b>.',
        html: true,
      },
    ],
  },
  {
    id: 'gcash-save',
    app: 'GCash',
    group: 'gcash',
    stepper: 'GCash',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you keep your part?',
    sets: null,
    steps: [
      {
        frame: 'o22b',
        h1: 'Save in GSave',
        chips: ['GSave', 'Deposit'],
        body: 'Enter your amount, tap <b>Next</b>, then <b>Confirm</b>.',
        html: true,
      },
    ],
  },
]

const BY_ID = Object.fromEntries(LESSONS.map((lesson) => [lesson.id, lesson]))

export function lessonById(id) {
  return BY_ID[id]
}

export function nextLessonId(id) {
  const lesson = BY_ID[id]
  if (!lesson) return null
  const group = LESSONS.filter((item) => item.group === lesson.group)
  const index = group.findIndex((item) => item.id === id)
  return group[index + 1]?.id || null
}

export function firstLesson(group) {
  return LESSONS.find((lesson) => lesson.group === group)
}
