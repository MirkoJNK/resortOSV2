import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url),
  ts = require('typescript')
function load(file, mapping = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(
    `(function(require,module,exports){${code}\n})`,
    { Date, Intl, BigInt, TextEncoder, crypto },
    { filename: file },
  )(
    (key) => {
      if (!(key in mapping)) throw Error('Unmapped ' + key + ' from ' + file)
      return mapping[key]
    },
    module,
    module.exports,
  )
  return module.exports
}
const stub = {}
const moneyModel = load('src/features/menu-management/model.ts')
const finance = load('src/features/discount-management/model.ts', {
  '../restaurant-tables/model': stub,
})
const restaurant = load('src/features/restaurant-tables/model.ts', {
  '../menu-management/model': moneyModel,
  '../discount-management/model': finance,
})
Object.assign(stub, restaurant)
const paymentHelpers = {
  parseCashCentavos: (s) => {
    if (!/^\d+(?:\.\d{1,2})?$/.test(s)) throw Error('Invalid cash')
    const [a, b = ''] = s.split('.')
    return Number(a) * 100 + Number(b.padEnd(2, '0'))
  },
}
const charges = load('src/features/front-desk/charges.ts', {
  '../payment-methods/model': paymentHelpers,
  '../service-catalog/model': {},
  '../restaurant-tables/model': restaurant,
  './stays': {},
})
const checkout = load('src/features/front-desk/checkout.ts', {
  '../payment-methods/model': paymentHelpers,
  '../restaurant-tables/model': restaurant,
  './charges': charges,
})
const TIMESTAMP = '2026-11-13T06:00:00.000Z'
const LATER = '2026-11-13T07:00:00.000Z'
const makeOrder = (prices = [{ price: 112000, quantity: 1 }]) => ({
  id: 'order-one',
  sessionId: 'session-one',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  lines: prices.map((p, i) => ({
    id: `line-${i}`,
    menuItemId: `item-${i}`,
    nameSnapshot: `Dish ${i}`,
    priceCentavos: p.price,
    quantity: p.quantity,
    note: '',
    recordedAt: TIMESTAMP,
  })),
})
const one = (order = makeOrder(), quantity = 1, sharePercent = 100) => [
  { lineId: order.lines[0].id, quantity, sharePercent },
]
const policy = (active = false, rateBasisPoints = 0) => ({
  active,
  rateBasisPoints,
  version: 1,
  history: [],
})
const rule = (kind = 'senior', name = kind) => ({
  id: `statutory:${kind}`,
  kind,
  name,
  type: 'percentage',
  rateBasisPoints: 2000,
  valueCentavos: 0,
  active: true,
  effectiveOn: '2010-01-01',
  version: 1,
  applicability: { scope: 'all', ids: [] },
  history: [],
})
const elect = (order, kind = 'senior', portions = one(order), tax = 'vat-inclusive') =>
  finance.electDiscount(order, rule(kind), portions, tax, true, TIMESTAMP)

test('defaults contain built-in statutory rates but no accidental service charge or tax assumption', () => {
  const c = finance.defaultFinanceConfig()
  assert.equal(finance.isValidFinanceConfig(c), true)
  assert.equal(c.taxMode, 'unconfigured')
  assert.equal(c.service.active, false)
  assert.deepEqual(
    [...c.discounts].map((x) => x.rateBasisPoints),
    [2000, 2000],
  )
  assert.throws(
    () =>
      finance.electDiscount(makeOrder(), c.discounts[0], one(), 'unconfigured', true, TIMESTAMP),
    /Configure Restaurant VAT/,
  )
})
test('statutory changes require reason, effective date, min rate and preserve a previous version', () => {
  const c = finance.defaultFinanceConfig(),
    old = c.discounts[0]
  assert.throws(
    () =>
      finance.updateDiscount(c, { ...old, rateBasisPoints: 1500 }, 'Very valid reason', TIMESTAMP),
    /legally configured minimum/,
  )
  assert.throws(
    () => finance.updateDiscount(c, { ...old, rateBasisPoints: 2500 }, 'no', TIMESTAMP),
    /reason/,
  )
  const next = finance.updateDiscount(
    c,
    { ...old, rateBasisPoints: 2500, effectiveOn: '2026-12-01' },
    'Verified future change',
    TIMESTAMP,
  )
  assert.equal(next.discounts[0].history[0].rateBasisPoints, 2000)
  assert.equal(next.discounts[0].version, 2)
  assert.equal(next.discounts[0].effectiveOn, '2026-12-01')
  assert.throws(
    () =>
      finance.updateDiscount(
        c,
        { ...old, rateBasisPoints: 1500, minimumRateBasisPoints: 1000 },
        'Detailed reason with unchanged legal citation',
        TIMESTAMP,
      ),
    /verified new legal reference/,
  )
  const changedLaw = finance.updateDiscount(
    c,
    {
      ...old,
      rateBasisPoints: 1500,
      minimumRateBasisPoints: 1000,
      legalReference: 'Verified amended future regulation',
      effectiveOn: '2027-01-01',
    },
    'Independently checked and approved hypothetical future legal amendment',
    TIMESTAMP,
  )
  assert.equal(changedLaw.discounts[0].minimumRateBasisPoints, 1000)
  assert.equal(changedLaw.discounts[0].rateBasisPoints, 1500)
})
test('custom discounts validate duplicate names, schedule, values, active status and frozen history', () => {
  const c = finance.defaultFinanceConfig()
  const draft = {
    id: 'offer-1',
    kind: 'custom',
    name: 'Christmas Special',
    type: 'percentage',
    rateBasisPoints: 1000,
    valueCentavos: 0,
    active: true,
    effectiveOn: '2026-01-01',
    startsOn: '2026-12-01',
    endsOn: '2026-12-31',
    version: 0,
    history: [],
    applicability: { scope: 'all', ids: [] },
  }
  const updated = finance.updateDiscount(c, draft, '', TIMESTAMP)
  assert.equal(finance.discountAvailable(updated.discounts[2], TIMESTAMP), false)
  assert.equal(finance.discountAvailable(updated.discounts[2], '2026-12-12T02:00:00Z'), true)
  assert.equal(finance.discountAvailable(updated.discounts[2], '2027-01-02T02:00:00Z'), false)
  assert.throws(
    () =>
      finance.updateDiscount(
        updated,
        { ...draft, id: 'offer-2', name: 'CHRISTMAS SPECIAL' },
        '',
        TIMESTAMP,
      ),
    /duplicate/,
  )
  assert.throws(
    () =>
      finance.updateDiscount(
        updated,
        { ...draft, id: 'offer-2', rateBasisPoints: 11000 },
        '',
        TIMESTAMP,
      ),
    /Invalid/,
  )
  const disabled = finance.setDiscountStatus(updated, 'offer-1', false)
  assert.equal(disabled.discounts[2].active, false)
  assert.equal(disabled.discounts[2].history.length, 1)
  assert.throws(
    () => finance.setDiscountStatus(updated, 'statutory:senior', false),
    /cannot be deactivated/,
  )
})
test('official BIR PWD VAT-inclusive example: ₱1120 is ₱1000 net, ₱200 discount, ₱800 due', () => {
  const order = makeOrder(),
    election = elect(order, 'pwd')
  const result = finance.calculateOrder(order, [election], policy(), TIMESTAMP)
  assert.equal(result.originalCentavos, 112000)
  assert.equal(result.vatReliefCentavos, 12000)
  assert.equal(result.discountCentavos, 20000)
  assert.equal(result.payableCentavos, 80000)
  assert.equal(finance.validCalculationSnapshot(order, result, [election]), true)
  assert.equal(
    finance.calculateOrder(order, [election], policy(true, 1000), TIMESTAMP).payableCentavos,
    88000,
  )
})
test('non-VAT discount applies only to one of five portions; remaining four are untouched', () => {
  const order = makeOrder([{ price: 10000, quantity: 5 }])
  const election = elect(order, 'senior', one(order, 1), 'non-vat')
  const s = finance.calculateOrder(order, [election], policy(), TIMESTAMP)
  assert.equal(s.originalCentavos, 50000)
  assert.equal(s.discountCentavos, 2000)
  assert.equal(s.vatReliefCentavos, 0)
  assert.equal(s.payableCentavos, 48000)
})
test('shared item allocation uses exact 25% of one portion, not the whole table', () => {
  const order = makeOrder([{ price: 40000, quantity: 1 }])
  const e = elect(order, 'pwd', one(order, 1, 25), 'non-vat')
  assert.equal(finance.calculateOrder(order, [e], policy(), TIMESTAMP).discountCentavos, 2000)
})
test('multiple statutory beneficiaries cannot overlap the same eligible portion', () => {
  const order = makeOrder([{ price: 10000, quantity: 2 }])
  const senior = elect(order, 'senior', one(order, 1), 'non-vat')
  const pwd = elect(order, 'pwd', one(order, 1), 'non-vat')
  assert.equal(
    finance.calculateOrder(order, [senior, pwd], policy(), TIMESTAMP).discountCentavos,
    4000,
  )
  assert.throws(
    () =>
      finance.calculateOrder(
        makeOrder([{ price: 10000, quantity: 1 }]),
        [senior, pwd],
        policy(),
        TIMESTAMP,
      ),
    /exceed/,
  )
})
test('promotion stacking with statutory benefit is explicitly rejected', () => {
  const order = makeOrder([{ price: 10000, quantity: 2 }]),
    e = elect(order, 'senior', one(order, 1), 'non-vat')
  const promo = {
    ...e,
    ruleId: 'promo-one',
    ruleVersion: 1,
    kind: 'custom',
    name: 'Promotion',
    taxMode: 'non-vat',
  }
  assert.throws(
    () => finance.calculateOrder(order, [promo, e], policy(), TIMESTAMP),
    /cannot be stacked/,
  )
  assert.throws(() => finance.calculateOrder(order, [promo, promo], policy(), TIMESTAMP), /twice/)
})
test('fixed discount cannot exceed eligible subtotal and payable cannot be negative', () => {
  const order = makeOrder([{ price: 999, quantity: 1 }])
  const fixed = {
    ...elect(order, 'senior', one(order), 'non-vat'),
    ruleId: 'fixed',
    kind: 'custom',
    type: 'fixed',
    valueCentavos: 1000,
    rateBasisPoints: 0,
  }
  assert.throws(
    () => finance.calculateOrder(order, [fixed], policy(), TIMESTAMP),
    /exceeds its eligible/,
  )
})
test('rounding is centavo-safe, with no floating-point accumulation', () => {
  const order = makeOrder([{ price: 1, quantity: 1 }])
  const s = finance.calculateOrder(order, [], policy(true, 5000), TIMESTAMP)
  assert.equal(s.serviceCentavos, 1)
  assert.equal(s.payableCentavos, 2)
  assert.equal(finance.validCalculationSnapshot(order, { ...s, payableCentavos: 3 }, []), false)
})
test('recorded item removal clips eligible quantity and invalid fixed discounts are cleared for review', () => {
  const order = makeOrder([{ price: 10000, quantity: 5 }]),
    selected = elect(order, 'senior', one(order, 5), 'non-vat')
  const ops = {
    ...restaurant.emptyOperations(),
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-1',
        reservationId: null,
        phase: 'open',
        openedAt: TIMESTAMP,
        closedAt: null,
      },
    ],
    orders: [{ ...order, discountElections: [selected] }],
  }
  assert.equal(restaurant.isValidOperations(ops), true)
  const after = restaurant.removeRecordedLine(ops, 'session-one', 'line-0', LATER, 4, 'removal-one')
  assert.equal(after.orders[0].lines[0].quantity, 5)
  assert.equal(after.orders[0].discountElections[0].portions[0].quantity, 1)
  assert.equal(
    finance.calculateOrder(after.orders[0], after.orders[0].discountElections, policy(), LATER)
      .payableCentavos,
    8000,
  )
  assert.equal(restaurant.isValidOperations(after), true)
})
test('invalidated fixed promotion prevents settlement until employee acknowledges review', () => {
  const order=makeOrder([{price:10000,quantity:5}])
  const election={ruleId:'fixed-1',ruleVersion:1,kind:'custom',name:'Fixed offer',type:'fixed',rateBasisPoints:0,valueCentavos:40000,
    taxMode:'non-vat',eligibilityConfirmed:false,portions:one(order,5)}
  const ops={...restaurant.emptyOperations(),sessions:[{id:'session-one',tableId:'table-one',reservationId:null,phase:'ready-to-pay',openedAt:TIMESTAMP,closedAt:null}],
    orders:[{...order,discountElections:[election]}]}
  const after=restaurant.removeRecordedLine(ops,'session-one','line-0',LATER,4,'removed-fixed')
  assert.equal(after.orders[0].discountElections.length,0)
  assert.equal(after.orders[0].discountReviewRequired,true)
  assert.throws(()=>restaurant.recordDemoSettlement(after,'session-one','cash',undefined,LATER,'not-allowed',finance.defaultFinanceConfig()),/Review the removed discount/)
  const acknowledged=restaurant.setOrderDiscounts(after,'order-one',[],LATER)
  assert.equal(acknowledged.orders[0].discountReviewRequired,false)
  const paid=restaurant.recordDemoSettlement(acknowledged,'session-one','cash',undefined,LATER,'acknowledged',finance.defaultFinanceConfig())
  assert.equal(paid.settlements[0].amountCentavos,10000)
})
test('settlement freezes rule and charge versions, pays final amount and is immune to later config edits', () => {
  const c = finance.updateTax(
    finance.defaultFinanceConfig(),
    'vat-inclusive',
    'Verified VAT pricing',
    TIMESTAMP,
  )
  const order = makeOrder(),
    selected = finance.electDiscount(order, c.discounts[0], one(order), c.taxMode, true, TIMESTAMP)
  const ready = {
    ...restaurant.emptyOperations(),
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-1',
        reservationId: null,
        phase: 'ready-to-pay',
        openedAt: TIMESTAMP,
        closedAt: null,
      },
    ],
    orders: [{ ...order, discountElections: [selected] }],
  }
  const configured = finance.updateService(c, true, 1000, 'Business approved', TIMESTAMP)
  const paid = restaurant.recordDemoSettlement(
    ready,
    'session-one',
    'cash',
    undefined,
    LATER,
    'settlement-one',
    configured,
  )
  assert.equal(paid.settlements[0].amountCentavos, 88000)
  assert.equal(paid.settlements[0].calculation.discounts[0].ruleVersion, 1)
  assert.equal(paid.settlements[0].calculation.serviceVersion, 2)
  assert.equal(restaurant.isValidOperations(paid), true)
  const later = finance.updateService(configured, true, 1500, 'Approved new rate', LATER)
  assert.equal(paid.settlements[0].amountCentavos, 88000)
  assert.notEqual(
    later.service.rateBasisPoints,
    paid.settlements[0].calculation.serviceRateBasisPoints,
  )
  assert.throws(
    () =>
      restaurant.recordDemoSettlement(
        paid,
        'session-one',
        'cash',
        undefined,
        LATER,
        'duplicate',
        configured,
      ),
    /no longer ready/,
  )
})
test('existing historical orders without snapshots remain readable at original recorded value', () => {
  const order = makeOrder([{ price: 12345, quantity: 1 }])
  const history = {
    ...restaurant.emptyOperations(),
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-1',
        reservationId: null,
        phase: 'ready-to-pay',
        openedAt: TIMESTAMP,
        closedAt: LATER,
      },
    ],
    orders: [order],
    settlements: [
      {
        id: 'old',
        orderId: 'order-one',
        sessionId: 'session-one',
        method: 'cash',
        amountCentavos: 12345,
        recordedAt: LATER,
        simulated: true,
      },
    ],
  }
  assert.equal(restaurant.isValidOperations(history), true)
  assert.equal(history.settlements[0].amountCentavos, 12345)
})
test('room posting, Front Desk charge payment and checkout reconcile exactly with the discounted settlement', () => {
  const financeConfig = finance.updateTax(
    finance.defaultFinanceConfig(),
    'non-vat',
    'Verified non VAT',
    TIMESTAMP,
  )
  const order = makeOrder([{ price: 10000, quantity: 2 }])
  const election = finance.electDiscount(
    order,
    financeConfig.discounts[0],
    one(order, 1),
    financeConfig.taxMode,
    true,
    TIMESTAMP,
  )
  const stay = {
    id: 'stay-one',
    roomId: 'room-one',
    guestName: 'Demo Guest',
    checkInDate: '2026-11-13',
    expectedCheckoutDate: '2026-11-15',
    checkedInAt: TIMESTAMP,
    status: 'active',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
  const room = { id: 'room-one', name: '101', code: '101', active: true }
  const ops = {
    ...restaurant.emptyOperations(),
    stays: [stay],
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-one',
        reservationId: null,
        phase: 'ready-to-pay',
        openedAt: TIMESTAMP,
        closedAt: null,
      },
    ],
    orders: [{ ...order, discountElections: [election] }],
  }
  const restaurantDone = restaurant.recordDemoSettlement(
    ops,
    'session-one',
    'room',
    room,
    LATER,
    'post-one',
    financeConfig,
  )
  assert.equal(restaurantDone.settlements[0].amountCentavos, 18000)
  assert.equal(charges.allCharges(restaurantDone)[0].amountCentavos, 18000)
  assert.equal(checkout.checkoutSummary(restaurantDone, 'stay-one').balanceDueCentavos, 18000)
  const individual = charges.recordChargePayment(
    restaurantDone,
    'restaurant',
    'post-one',
    '2026-11-13T07:30:00Z',
    'pay-one',
  )
  assert.equal(checkout.checkoutSummary(individual, 'stay-one').balanceDueCentavos, 0)
  const finished = checkout.finalizeCheckout(
    individual,
    { stayId: 'stay-one', roomId: 'room-one', roomName: '101' },
    '2026-11-13T08:00:00Z',
    'checkout-one',
  )
  assert.equal(finished.checkouts[0].totalCentavos, 18000)
  assert.equal(finished.checkouts[0].alreadyPaidCentavos, 18000)
  assert.equal(finished.checkouts[0].balanceDueCentavos, 0)
  assert.equal(restaurant.isValidOperations(finished), true)
  assert.throws(
    () =>
      charges.recordChargePayment(
        finished,
        'restaurant',
        'post-one',
        '2026-11-13T08:30:00Z',
        'duplicate',
      ),
    /no longer open/,
  )
})
test('checkout cash pays discounted posted amount with correct change and no second discount', () => {
  const c = finance.updateTax(
    finance.defaultFinanceConfig(),
    'non-vat',
    'Verified non VAT',
    TIMESTAMP,
  )
  const order = makeOrder([{ price: 50000, quantity: 1 }])
  const election = finance.electDiscount(
    order,
    c.discounts[1],
    one(order),
    c.taxMode,
    true,
    TIMESTAMP,
  )
  const room = { id: 'room-one', name: '101', code: '101', active: true }
  const stay = {
    id: 'stay-one',
    roomId: room.id,
    guestName: 'Demo Guest',
    checkInDate: '2026-11-13',
    expectedCheckoutDate: '2026-11-15',
    checkedInAt: TIMESTAMP,
    status: 'active',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  }
  const ops = {
    ...restaurant.emptyOperations(),
    stays: [stay],
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-one',
        reservationId: null,
        phase: 'ready-to-pay',
        openedAt: TIMESTAMP,
        closedAt: null,
      },
    ],
    orders: [{ ...order, discountElections: [election] }],
  }
  const posted = restaurant.recordDemoSettlement(
    ops,
    'session-one',
    'room',
    room,
    LATER,
    'post-one',
    c,
  )
  const finished = checkout.finalizeCheckout(
    posted,
    {
      stayId: 'stay-one',
      roomId: room.id,
      roomName: '101',
      method: 'cash',
      cashReceived: '500.00',
    },
    '2026-11-13T08:00:00Z',
    'checkout-one',
    ['paid-one'],
  )
  assert.equal(finished.checkouts[0].settledCentavos, 40000)
  assert.equal(finished.checkouts[0].cashReceivedCentavos, 50000)
  assert.equal(finished.checkouts[0].changeCentavos, 10000)
  assert.equal(finished.chargePayments[0].amountCentavos, 40000)
  assert.equal(restaurant.isValidOperations(finished), true)
})
test('100% promotion supports a complimentary cash close but never creates a zero-value room posting', () => {
  const c = finance.defaultFinanceConfig(),
    order = makeOrder([{ price: 15000, quantity: 1 }])
  const selection = {
    ruleId: 'promo-100',
    ruleVersion: 1,
    kind: 'custom',
    name: 'Complimentary Meal',
    type: 'percentage',
    rateBasisPoints: 10000,
    valueCentavos: 0,
    taxMode: 'unconfigured',
    eligibilityConfirmed: false,
    portions: one(order),
  }
  const ready = {
    ...restaurant.emptyOperations(),
    sessions: [
      {
        id: 'session-one',
        tableId: 'table-1',
        reservationId: null,
        phase: 'ready-to-pay',
        openedAt: TIMESTAMP,
        closedAt: null,
      },
    ],
    orders: [{ ...order, discountElections: [selection] }],
  }
  const configured = {
    ...c,
    discounts: [
      ...c.discounts,
      {
        id: 'promo-100',
        kind: 'custom',
        name: 'Complimentary Meal',
        type: 'percentage',
        rateBasisPoints: 10000,
        valueCentavos: 0,
        active: true,
        effectiveOn: '2026-01-01',
        version: 1,
        history: [],
        applicability: { scope: 'all', ids: [] },
      },
    ],
  }
  const paid = restaurant.recordDemoSettlement(
    ready,
    'session-one',
    'cash',
    undefined,
    LATER,
    'free-meal',
    configured,
  )
  assert.equal(paid.settlements[0].amountCentavos, 0)
  assert.equal(restaurant.isValidOperations(paid), true)
  assert.throws(
    () =>
      restaurant.recordDemoSettlement(
        ready,
        'session-one',
        'room',
        { id: 'room-1', name: 'Room 1', code: '1', active: true },
        LATER,
        'free-room',
        configured,
      ),
    /active guest check-in|zero-balance/,
  )
})
test('routes, UI and persistent database schema are connected', () => {
  const app = fs.readFileSync('src/App.tsx', 'utf8')
  const sys = fs.readFileSync('src/features/system-management/SystemManagement.tsx', 'utf8')
  const restaurantUI = fs.readFileSync('src/features/restaurant-tables/OrderWorkspace.tsx', 'utf8')
  const db = fs.readFileSync('src/features/restaurant-tables/storage.ts', 'utf8')
  assert.match(app, /case 'discounts'/)
  assert.match(sys, /id: 'discounts'/)
  assert.match(restaurantUI, /OrderDiscountDialog/)
  assert.match(db, /restaurant-finance-config/)
  assert.match(db, /indexedDB\.open\(RESTAURANT_OPERATIONS_DB, 6\)/)
})
