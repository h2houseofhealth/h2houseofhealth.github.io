/**
 * End-to-End Test Suite: Stock Shortage Tab Lifecycle and Order Movement
 *
 * Verifies the 7 user scenarios:
 * 1. Paid shortage with no communication remains in Stock Shortage.
 * 2. Successful delay email moves the case out of the action-required queue and into Processing with "Customer Notified — Awaiting Restock."
 * 3. Failed email leaves the case requiring attention.
 * 4. Restocking triggers allocation recalculation without double-deducting stock.
 * 5. An order with insufficient stock remains blocked from fulfillment.
 * 6. A sufficiently allocated order can proceed through the existing fulfillment lifecycle.
 * 7. Refreshing the page preserves correct tab membership and status labels.
 *
 * Safety: Uses isolated test environment on port 3457 with test database.
 * Real database (booking/data/booking.db) count is verified before and after.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const Database = require('better-sqlite3');

const TEST_PORT = 3457;
const TEST_DATA_DIR = '/tmp/test_merch_lifecycle_data';
const TEST_UPLOADS_DIR = '/tmp/test_merch_lifecycle_uploads';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const REAL_DB_PATH = path.resolve(__dirname, '../booking/data/booking.db');
const TEST_SECRET = 'dummysecret_lifecycle_123';
const TEST_KEY_ID = 'rzp_test_dummykey_lifecycle_123';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, headers: res.headers, data };
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) return true;
    } catch (_) {}
    await sleep(300);
  }
  throw new Error(`Test server failed to start on port ${TEST_PORT}`);
}

function createPendingOrder(db, { orderNumber, customerName, email, items }) {
  const time = new Date().toISOString();
  const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const rzpOrderId = `order_${crypto.randomBytes(8).toString('hex')}`;

  const oRes = db.prepare(`
    INSERT INTO merch_orders (
      order_number, customer_name, customer_email, customer_phone, shipping_address, billing_address,
      payment_method, payment_status, status, stock_deducted, subtotal, total_amount, razorpay_order_id,
      created_at, updated_at
    ) VALUES (?, ?, ?, '9876543210', '{"addressLine1":"123 Test St","city":"Mumbai","state":"MH","pincode":"400001"}',
              '{"addressLine1":"123 Test St","city":"Mumbai","state":"MH","pincode":"400001"}',
              'online', 'pending', 'pending', 0, ?, ?, ?,
              ?, ?)
  `).run(
    orderNumber, customerName, email,
    total, total, rzpOrderId,
    time, time
  );
  const orderId = Number(oRes.lastInsertRowid);

  for (const item of items) {
    db.prepare(`
      INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total)
      VALUES (?, ?, ?, 'Standard', ?, ?, ?, ?)
    `).run(orderId, item.variantId, item.name || 'H2 Mist', item.sku, item.price, item.qty, item.qty * item.price);
  }

  return { id: orderId, orderNumber, razorpayOrderId: rzpOrderId };
}

function signRazorpay(rzpOrderId, paymentId) {
  return crypto.createHmac('sha256', TEST_SECRET).update(`${rzpOrderId}|${paymentId}`).digest('hex');
}

// Frontend mirror classification logic from admin.js
function isOrderStockShortageActionRequired(order) {
  if (!order) return false;
  if (order.requiresStockShortageAction === true) return true;
  if (order.requiresStockShortageAction === false) return false;
  const isCancelled = ['cancelled', 'returned'].includes(String(order.status || '').toLowerCase());
  if (isCancelled) return false;
  const isCommunicated = order.stockShortageCommunicationStatus === 'sent' ||
    (Array.isArray(order.stockShortages) && order.stockShortages.length > 0 && order.stockShortages.every((s) => s.customerCommunicationStatus === 'sent'));
  const isDeficit = Boolean(order.hasUnresolvedStockDeficit || order.isFulfillmentBlocked || order.status === 'stock_shortage' || order.fulfillmentStatus === 'stock_shortage');
  return isDeficit && !isCommunicated;
}

function isOrderAwaitingRestock(order) {
  if (!order) return false;
  if (order.isAwaitingRestock === true) return true;
  if (order.isAwaitingRestock === false) return false;
  if (order.fulfillmentStatus === 'awaiting_restock') return true;
  const isCancelled = ['cancelled', 'returned'].includes(String(order.status || '').toLowerCase());
  if (isCancelled) return false;
  const isCommunicated = order.stockShortageCommunicationStatus === 'sent' ||
    (Array.isArray(order.stockShortages) && order.stockShortages.length > 0 && order.stockShortages.every((s) => s.customerCommunicationStatus === 'sent'));
  const isDeficit = Boolean(order.hasUnresolvedStockDeficit || order.isFulfillmentBlocked || order.status === 'stock_shortage' || order.fulfillmentStatus === 'stock_shortage');
  return isDeficit && isCommunicated;
}

function getFulfillmentStatusLabel(status, order = null) {
  if (order && isOrderAwaitingRestock(order)) {
    return 'Customer Notified — Awaiting Restock';
  }
  const map = {
    ready_to_fulfill: 'Ready to Fulfill',
    partially_available: 'Partially Available',
    stock_shortage: 'Stock Shortage',
    awaiting_restock: 'Customer Notified — Awaiting Restock',
    fulfilled: 'Fulfilled',
    cancelled: 'Cancelled',
    returned: 'Returned',
    needs_review: 'Needs Review',
    pending_payment: 'Pending Payment',
  };
  return map[String(status).toLowerCase()] || String(status || 'Ready to Fulfill');
}

function matchesTab(order, tab) {
  const norm = String(order.status || 'pending').toLowerCase();
  if (tab === 'stock_shortage') {
    return isOrderStockShortageActionRequired(order);
  }
  if (tab === 'processing') {
    return !isOrderStockShortageActionRequired(order) && (norm === 'processing' || isOrderAwaitingRestock(order));
  }
  return norm === tab;
}

async function run() {
  console.log('=== Starting Stock Shortage Tab Lifecycle & Movement Test Suite ===\n');

  // 0. Verify real DB baseline
  const realDb = new Database(REAL_DB_PATH);
  const realDbInitialCount = realDb.prepare('SELECT count(*) as count FROM merch_orders').get().count;
  console.log(`[Safety Guard] Real database baseline order count: ${realDbInitialCount}`);

  // 1. Clean test dirs
  if (fs.existsSync(TEST_DATA_DIR)) fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (fs.existsSync(TEST_UPLOADS_DIR)) fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  fs.mkdirSync(TEST_UPLOADS_DIR, { recursive: true });

  // 2. Start isolated test server
  console.log(`[Setup] Spawning isolated server on port ${TEST_PORT}...`);
  const serverProc = spawn('node', ['booking/server.js'], {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      DATA_DIR: TEST_DATA_DIR,
      UPLOADS_DIR: TEST_UPLOADS_DIR,
      ALLOW_DEV_OTP_FALLBACK: 'true',
      NODE_ENV: 'development',
      RAZORPAY_KEY_ID: TEST_KEY_ID,
      RAZORPAY_KEY_SECRET: TEST_SECRET,
      RAZORPAY_MODE: 'test',
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer();
    console.log('[Setup] Isolated test server ready.\n');

    // 3. Authenticate as Admin
    console.log('[Setup] Admin login...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
    const adminToken = loginRes.data.token;
    assert(adminToken, 'Admin token must be returned');
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('  ✓ Admin logged in successfully.\n');

    // 4. Create disposable test product with 0 units in stock
    const testDb = new Database(path.join(TEST_DATA_DIR, 'booking.db'));
    const prodInsert = testDb.prepare(`
      INSERT INTO merch_products (name, slug, category, description, base_price, is_active, created_at)
      VALUES ('H2 Lifecycle Mist', 'h2-lifecycle-mist', 'sprays', 'Test mist for lifecycle', 150000, 1, datetime('now'))
    `).run();
    const productId = prodInsert.lastInsertRowid;

    const variantInsert = testDb.prepare(`
      INSERT INTO merch_variants (product_id, sku, price, stock, is_active, created_at)
      VALUES (?, 'MIST-LC-50ML', 150000, 0, 1, datetime('now'))
    `).run(productId);
    const variantId = variantInsert.lastInsertRowid;
    console.log(`  ✓ Created test product ID=${productId}, variant ID=${variantId} with Stock = 0.\n`);

    // =========================================================================
    // SCENARIO 1: Paid shortage with no communication remains in Stock Shortage
    // =========================================================================
    console.log('--- SCENARIO 1: Paid Shortage with No Communication Remains in Stock Shortage ---');
    const order1 = createPendingOrder(testDb, {
      orderNumber: `HM-LC-1-${Date.now()}`,
      customerName: 'Awaiting Customer 1',
      email: 'cust1@example.com',
      items: [{ variantId, sku: 'MIST-LC-50ML', name: 'H2 Lifecycle Mist', price: 1500, qty: 1 }],
    });

    const payId1 = `pay_lc_1_${Date.now()}`;
    const sig1 = signRazorpay(order1.razorpayOrderId, payId1);

    const verifyRes1 = await request('/api/merch/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_id: order1.id,
        razorpay_payment_id: payId1,
        razorpay_order_id: order1.razorpayOrderId,
        razorpay_signature: sig1,
      }),
    });
    assert.strictEqual(verifyRes1.status, 200, 'Payment verification should succeed');
    console.log('  ✓ Payment verified for Order 1 under zero stock.');

    // Fetch order list as admin
    const listRes1 = await request('/api/merch/admin/orders', { headers: adminHeaders });
    assert.strictEqual(listRes1.status, 200);
    const fetched1 = listRes1.data.orders.find((o) => o.id === order1.id);
    assert(fetched1, 'Order 1 must be present in orders list');

    console.log(`  Order 1 Status: ${fetched1.status}`);
    console.log(`  requiresStockShortageAction: ${fetched1.requiresStockShortageAction}`);
    console.log(`  isAwaitingRestock: ${fetched1.isAwaitingRestock}`);
    console.log(`  fulfillmentStatus: ${fetched1.fulfillmentStatus}`);

    assert.strictEqual(fetched1.requiresStockShortageAction, true, 'Order 1 must require stock shortage action');
    assert.strictEqual(fetched1.isAwaitingRestock, false, 'Order 1 is NOT awaiting restock yet (uncommunicated)');
    assert.strictEqual(isOrderStockShortageActionRequired(fetched1), true, 'Must appear in Stock Shortage action-required list');
    assert.strictEqual(matchesTab(fetched1, 'stock_shortage'), true, 'Matches stock_shortage tab');
    assert.strictEqual(matchesTab(fetched1, 'processing'), false, 'Does NOT match processing tab');
    console.log('  ✓ Scenario 1 Verified: Paid shortage with no communication correctly remains in Stock Shortage tab.\n');

    // =========================================================================
    // SCENARIO 2: Successful delay email moves order out of Stock Shortage and into Processing with "Customer Notified — Awaiting Restock"
    // =========================================================================
    console.log('--- SCENARIO 2: Successful Delay Email Moves Order to Processing as Awaiting Restock ---');
    const sendRes = await request(`/api/merch/admin/orders/${order1.id}/stock-shortage/send-email`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'x-test-mock-email-success': 'true',
      },
      body: JSON.stringify({
        revisedDeliveryEstimate: '3-4 business days',
        internalDelayNote: 'Supplier shipment expected Thursday.',
        authorizedBy: 'Operations Admin',
      }),
    });
    assert.strictEqual(sendRes.status, 200, 'Send delay email should succeed');
    assert.strictEqual(sendRes.data.success, true);
    console.log('  ✓ Delay email dispatched successfully with mock provider confirmation.');

    // Fetch orders again
    const listRes2 = await request('/api/merch/admin/orders', { headers: adminHeaders });
    const fetched2 = listRes2.data.orders.find((o) => o.id === order1.id);

    console.log(`  After Email - Status: ${fetched2.status}`);
    console.log(`  requiresStockShortageAction: ${fetched2.requiresStockShortageAction}`);
    console.log(`  isAwaitingRestock: ${fetched2.isAwaitingRestock}`);
    console.log(`  isCustomerNotified: ${fetched2.isCustomerNotified}`);
    console.log(`  fulfillmentStatus: ${fetched2.fulfillmentStatus}`);
    console.log(`  fulfillmentLabel: ${getFulfillmentStatusLabel(fetched2.fulfillmentStatus, fetched2)}`);

    assert.strictEqual(fetched2.status, 'processing', 'Order status must be updated to processing in DB');
    assert.strictEqual(fetched2.requiresStockShortageAction, false, 'Action required queue must NOT contain communicated order');
    assert.strictEqual(fetched2.isAwaitingRestock, true, 'isAwaitingRestock must be true');
    assert.strictEqual(fetched2.isCustomerNotified, true, 'isCustomerNotified must be true');
    assert.strictEqual(isOrderStockShortageActionRequired(fetched2), false, 'Must NOT be in Stock Shortage action-required list');
    assert.strictEqual(matchesTab(fetched2, 'stock_shortage'), false, 'Does NOT match stock_shortage tab');
    assert.strictEqual(matchesTab(fetched2, 'processing'), true, 'Matches processing tab');
    assert.strictEqual(
      getFulfillmentStatusLabel(fetched2.fulfillmentStatus, fetched2),
      'Customer Notified — Awaiting Restock',
      'Label must be Customer Notified — Awaiting Restock'
    );

    // Verify order details preserved
    assert(fetched2.stockShortages.length > 0, 'Shortage record details must be preserved');
    assert.strictEqual(fetched2.stockShortages[0].revisedDeliveryEstimate, '3-4 business days', 'Delivery estimate must be preserved');
    assert.strictEqual(fetched2.stockShortages[0].internalDelayNote, 'Supplier shipment expected Thursday.', 'Internal note must be preserved');
    assert.strictEqual(fetched2.stockShortages[0].customerCommunicationStatus, 'sent', 'Communication status must be sent');
    console.log('  ✓ Scenario 2 Verified: Order automatically moved out of Stock Shortage tab and into Processing with correct status label and preserved details.\n');

    // =========================================================================
    // SCENARIO 3: Failed email leaves the case requiring attention
    // =========================================================================
    console.log('--- SCENARIO 3: Failed Email Leaves Case Requiring Attention ---');
    const order2 = createPendingOrder(testDb, {
      orderNumber: `HM-LC-2-${Date.now()}`,
      customerName: 'Fail Test Customer',
      email: 'failcust@example.com',
      items: [{ variantId, sku: 'MIST-LC-50ML', name: 'H2 Lifecycle Mist', price: 1500, qty: 1 }],
    });
    const payId2 = `pay_lc_2_${Date.now()}`;
    const sig2 = signRazorpay(order2.razorpayOrderId, payId2);
    await request('/api/merch/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_id: order2.id,
        razorpay_payment_id: payId2,
        razorpay_order_id: order2.razorpayOrderId,
        razorpay_signature: sig2,
      }),
    });

    const failSendRes = await request(`/api/merch/admin/orders/${order2.id}/stock-shortage/send-email`, {
      method: 'POST',
      headers: {
        ...adminHeaders,
        'x-test-simulate-email-failure': 'true',
      },
      body: JSON.stringify({
        revisedDeliveryEstimate: '5 days',
        internalDelayNote: 'Network error test',
        authorizedBy: 'Operations Admin',
      }),
    });
    assert.strictEqual(failSendRes.status, 502, 'Should respond with 502 Bad Gateway on mail failure');

    const listRes3 = await request('/api/merch/admin/orders', { headers: adminHeaders });
    const fetched3 = listRes3.data.orders.find((o) => o.id === order2.id);

    console.log(`  Failed Order - Status: ${fetched3.status}`);
    console.log(`  requiresStockShortageAction: ${fetched3.requiresStockShortageAction}`);
    console.log(`  isAwaitingRestock: ${fetched3.isAwaitingRestock}`);
    console.log(`  stockShortageCommunicationStatus: ${fetched3.stockShortageCommunicationStatus}`);

    assert.strictEqual(fetched3.status, 'stock_shortage', 'Order status must remain stock_shortage');
    assert.strictEqual(fetched3.requiresStockShortageAction, true, 'Must still require action');
    assert.strictEqual(fetched3.isAwaitingRestock, false, 'Must NOT be marked awaiting restock');
    assert.strictEqual(fetched3.stockShortageCommunicationStatus, 'failed', 'Communication status must be failed');
    assert.strictEqual(isOrderStockShortageActionRequired(fetched3), true, 'Must remain in Stock Shortage action-required tab');
    console.log('  ✓ Scenario 3 Verified: Failed email leaves case in Stock Shortage tab requiring admin attention.\n');

    // =========================================================================
    // SCENARIO 5: An order with insufficient stock remains blocked from fulfillment
    // =========================================================================
    console.log('--- SCENARIO 5: Order with Insufficient Stock Blocked from Fulfillment ---');
    // Try manual status update to 'shipped' for order 1 (which is awaiting restock)
    const blockShipRes = await request(`/api/merch/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'shipped' }),
    });
    assert.strictEqual(blockShipRes.status, 400, 'Manual shipped update must be blocked when stock is deficient');
    assert(blockShipRes.data.error.includes('Insufficient stock allocated'), 'Error message must specify insufficient stock');
    console.log(`  Blocked manual shipped attempt: ${blockShipRes.data.error}`);

    // Try Shiprocket creation for order 1
    const blockSrRes = await request(`/api/merch/admin/orders/${order1.id}/shiprocket/create`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({}),
    });
    assert.strictEqual(blockSrRes.status, 400, 'Shiprocket creation must be blocked when stock is deficient');
    assert(blockSrRes.data.error.includes('Insufficient stock allocated'), 'Error message must specify insufficient stock');
    console.log(`  Blocked Shiprocket attempt: ${blockSrRes.data.error}`);
    console.log('  ✓ Scenario 5 Verified: Orders with insufficient stock are completely blocked from fulfillment.\n');

    // =========================================================================
    // SCENARIO 4: Restocking triggers allocation recalculation without double-deducting stock
    // =========================================================================
    console.log('--- SCENARIO 4: Restocking Triggers FIFO Recalculation Without Double-Deducting Stock ---');
    // Physical inventory restock: set stock = 1 on variant
    testDb.prepare('UPDATE merch_variants SET stock = 1 WHERE id = ?').run(variantId);
    console.log('  Restocked variant stock to 1 unit.');

    const listRes4 = await request('/api/merch/admin/orders', { headers: adminHeaders });
    const fetched4Order1 = listRes4.data.orders.find((o) => o.id === order1.id);
    const fetched4Order2 = listRes4.data.orders.find((o) => o.id === order2.id);

    console.log(`  Order 1 (FIFO First) Fulfillment Readiness: ${fetched4Order1.fulfillmentStatus}`);
    console.log(`  Order 1 isFulfillmentBlocked: ${fetched4Order1.isFulfillmentBlocked}`);
    console.log(`  Order 2 (FIFO Second) Fulfillment Readiness: ${fetched4Order2.fulfillmentStatus}`);
    console.log(`  Order 2 isFulfillmentBlocked: ${fetched4Order2.isFulfillmentBlocked}`);

    // Order 1 was created first: it gets the 1 available unit in FIFO order!
    assert.strictEqual(fetched4Order1.fulfillmentStatus, 'ready_to_fulfill', 'Order 1 must be ready to fulfill');
    assert.strictEqual(fetched4Order1.isFulfillmentBlocked, false, 'Order 1 must no longer be blocked');
    assert.strictEqual(fetched4Order1.isAwaitingRestock, false, 'Order 1 is no longer awaiting restock');

    // Order 2 was created second: stock is 1, so Order 2 is still deficient!
    assert.strictEqual(fetched4Order2.isFulfillmentBlocked, true, 'Order 2 remains blocked due to FIFO allocation');

    // Verify stock in database is NOT yet decremented (stock_deducted is still 0 until dispatched)
    const varRowBeforeFulfill = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId);
    assert.strictEqual(varRowBeforeFulfill.stock, 1, 'Physical stock must remain 1 until order is actually fulfilled/shipped');
    assert.strictEqual(fetched4Order1.stockDeducted, false, 'Order 1 stock_deducted must remain 0 until shipped');
    console.log('  ✓ Scenario 4 Verified: Allocation recalculation accurately allocates stock in FIFO order without premature or double deduction.\n');

    // =========================================================================
    // SCENARIO 6: A sufficiently allocated order can proceed through existing fulfillment lifecycle
    // =========================================================================
    console.log('--- SCENARIO 6: Sufficiently Allocated Order Proceeds Through Fulfillment Lifecycle ---');
    const fulfillRes = await request(`/api/merch/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({
        status: 'shipped',
        tracking_number: 'TEST-AWB-998877',
        carrier_name: 'BlueDart Express',
      }),
    });
    assert.strictEqual(fulfillRes.status, 200, 'Order 1 should be allowed to transition to shipped');
    console.log('  ✓ Order 1 successfully updated to shipped.');

    // Verify stock is now deducted
    const varRowAfterFulfill = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId);
    assert.strictEqual(varRowAfterFulfill.stock, 0, 'Physical stock must now be 0 after fulfillment');

    const orderRowAfterFulfill = testDb.prepare('SELECT stock_deducted, status FROM merch_orders WHERE id = ?').get(order1.id);
    assert.strictEqual(orderRowAfterFulfill.stock_deducted, 1, 'stock_deducted must now be 1');
    assert.strictEqual(orderRowAfterFulfill.status, 'shipped', 'Order status must be shipped');

    const shortageRowAfterFulfill = testDb.prepare('SELECT is_resolved, resolved_by FROM merch_order_stock_shortages WHERE order_id = ?').get(order1.id);
    assert.strictEqual(shortageRowAfterFulfill.is_resolved, 1, 'Shortage record must now be marked resolved');
    assert.strictEqual(shortageRowAfterFulfill.resolved_by, 'fulfilled_admin', 'resolved_by must be fulfilled_admin');

    // Progress to delivered
    const deliverRes = await request(`/api/merch/admin/orders/${order1.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'delivered' }),
    });
    assert.strictEqual(deliverRes.status, 200, 'Order 1 should transition to delivered');

    // Verify no double deduction on delivered
    const varRowAfterDelivered = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId);
    assert.strictEqual(varRowAfterDelivered.stock, 0, 'Stock must remain 0 (no double deduction)');
    console.log('  ✓ Scenario 6 Verified: Order 1 completed full fulfillment lifecycle (shipped -> delivered) with single stock deduction.\n');

    // =========================================================================
    // SCENARIO 7: Refreshing page preserves correct tab membership and status labels
    // =========================================================================
    console.log('--- SCENARIO 7: Refreshing Page Preserves Tab Membership and Status Labels ---');
    for (let iteration = 1; iteration <= 3; iteration++) {
      const refreshRes = await request('/api/merch/admin/orders', { headers: adminHeaders });
      assert.strictEqual(refreshRes.status, 200);

      const o1 = refreshRes.data.orders.find((o) => o.id === order1.id);
      const o2 = refreshRes.data.orders.find((o) => o.id === order2.id);

      assert.strictEqual(o1.status, 'delivered', 'Order 1 must stay delivered');
      assert.strictEqual(matchesTab(o1, 'stock_shortage'), false, 'Order 1 must not be in stock shortage');
      assert.strictEqual(matchesTab(o1, 'delivered'), true, 'Order 1 matches delivered tab');

      assert.strictEqual(o2.requiresStockShortageAction, true, 'Order 2 still requires action');
      assert.strictEqual(matchesTab(o2, 'stock_shortage'), true, 'Order 2 matches stock_shortage tab');
      assert.strictEqual(matchesTab(o2, 'processing'), false, 'Order 2 does not match processing tab');
    }
    console.log('  ✓ Scenario 7 Verified: Across 3 refresh cycles, tab membership and statuses are strictly preserved.\n');

    // =========================================================================
    // SAFETY GUARD VERIFICATION
    // =========================================================================
    const realDbFinalCount = realDb.prepare('SELECT count(*) as count FROM merch_orders').get().count;
    console.log(`[Safety Guard] Real DB count check: Initial = ${realDbInitialCount}, Final = ${realDbFinalCount}`);
    assert.strictEqual(realDbInitialCount, realDbFinalCount, 'Real database must not have been modified!');
    assert.strictEqual(realDbFinalCount, 54, 'Real database must retain exactly 54 orders');
    console.log('  ✓ Real database completely untouched and safe.\n');

    console.log('🎉 ALL 7 SCENARIOS PASSED WITH COMPLETE SAFETY VERIFICATION! 🎉');
  } finally {
    console.log('[Cleanup] Killing test server...');
    serverProc.kill('SIGKILL');
  }
}

run().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
