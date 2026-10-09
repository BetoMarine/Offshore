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
    stepper: 'Send to your GCash',
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
        body: 'Pick where it goes. Pick GCash so it lands in your wallet.',
      },
      {
        frame: 'o18',
        h1: 'Check and send',
        body: 'Enter the amount. Add your GCash details. Check, then confirm.',
        note: 'This money is for you first.',
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
    id: 'gcash-open',
    app: 'GCash',
    group: 'gcash',
    stepper: 'GCash',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you open your own GCash?',
    sets: null,
    steps: [
      {
        frame: 'l20',
        h1: 'Open your own GCash',
        body: 'Use the GCash app. Give it what it asks for. When it is open, the money you send next can be yours.',
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
        h1: 'See it land in your GCash',
        chips: ['Transactions'],
        body: 'Look for <b>Received Remittance</b>. When it is there, it is yours.',
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
        h1: 'Pay a bill yourself',
        chips: ['Bills'],
        body: 'Pick any merchant the app lists. Enter the details, tap <b>Next</b>, then confirm. Social security is one example — you see it paid.',
        html: true,
      },
    ],
  },
  {
    id: 'gcash-family',
    app: 'GCash',
    group: 'gcash',
    stepper: 'GCash',
    pointsReason: 'you finished a lesson.',
    didPrompt: 'Did you send to family?',
    sets: null,
    steps: [
      {
        frame: 'l24',
        h1: 'Send to family',
        body: 'After your bills are paid, send to their GCash.',
        mine: 'family',
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
