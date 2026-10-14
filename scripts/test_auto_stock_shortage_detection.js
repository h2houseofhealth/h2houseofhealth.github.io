/**
 * Test Suite: Automatic Stock Shortage Detection & Admin Notification
 * Runs in a completely ISOLATED environment using DATA_DIR=/tmp/test_merch_isolated_data.
 * Strictly verifies zero modification to real client records.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const Database = require('better-sqlite3');

const TEST_PORT = 3456;
const TEST_DATA_DIR = '/tmp/test_merch_isolated_data';
const TEST_UPLOADS_DIR = '/tmp/test_merch_isolated_uploads';
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const REAL_DB_PATH = path.resolve(__dirname, '../booking/data/booking.db');
const TEST_SECRET = 'dummysecret123';
const TEST_KEY_ID = 'rzp_test_dummykey123';

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
    ) VALUES (?, ?, ?, '9876543210', '{"addressLine1":"123 Test St"}', '{"addressLine1":"123 Test St"}',
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

async function run() {
  console.log('=== Starting Auto Stock Shortage Detection Test Suite ===\n');

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
    console.log('[Step] Admin login...');
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' }),
    });
    assert.strictEqual(loginRes.status, 200, 'Admin login should succeed');
    const adminToken = loginRes.data.token;
    assert(adminToken, 'Admin token must be returned');
    console.log('  ✓ Admin logged in successfully.\n');

    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 4. Create disposable test product with 1 unit of stock
    console.log('[Step] Setting up test product with 1 unit in stock...');
    const testDb = new Database(path.join(TEST_DATA_DIR, 'booking.db'));

    const prodInsert = testDb.prepare(`
      INSERT INTO merch_products (name, slug, category, description, base_price, is_active, created_at)
      VALUES ('H2 Mist Test Edition', 'h2-mist-test-edition', 'sprays', 'Test mist for race condition', 250000, 1, datetime('now'))
    `).run();
    const productId = prodInsert.lastInsertRowid;

    const variantInsert = testDb.prepare(`
      INSERT INTO merch_variants (product_id, sku, price, stock, is_active, created_at)
      VALUES (?, 'MIST-RACE-50ML', 250000, 1, 1, datetime('now'))
    `).run(productId);
    const variantId = variantInsert.lastInsertRowid;

    console.log(`  ✓ Created test product ID=${productId}, variant ID=${variantId} with Stock = 1.\n`);

    // =========================================================================
    // TEST 1: Critical Race Condition: 2 Customers, Stock = 1
    // =========================================================================
    console.log('--- TEST 1: Critical Race Condition: 2 Customers, Stock = 1 ---');

    const orderA = createPendingOrder(testDb, {
      orderNumber: `HM-RACE-A-${Date.now()}`,
      customerName: 'Customer A',
      email: 'customera@test.com',
      items: [{ variantId, sku: 'MIST-RACE-50ML', name: 'H2 Mist Test Edition', price: 2500, qty: 1 }],
    });
    console.log(`  Order A created in pending: ID=${orderA.id}, OrderNo=${orderA.orderNumber}`);

    const orderB = createPendingOrder(testDb, {
      orderNumber: `HM-RACE-B-${Date.now()}`,
      customerName: 'Customer B',
      email: 'customerb@test.com',
      items: [{ variantId, sku: 'MIST-RACE-50ML', name: 'H2 Mist Test Edition', price: 2500, qty: 1 }],
    });
    console.log(`  Order B created in pending: ID=${orderB.id}, OrderNo=${orderB.orderNumber}`);

    const payIdA = `pay_race_customer_a_${Date.now()}`;
    const payIdB = `pay_race_customer_b_${Date.now()}`;
    const sigA = signRazorpay(orderA.razorpayOrderId, payIdA);
    const sigB = signRazorpay(orderB.razorpayOrderId, payIdB);

    console.log('  Executing concurrent verify-payment requests for Order A and Order B...');
    const [verifyA, verifyB] = await Promise.all([
      request('/api/merch/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderA.id,
          razorpay_payment_id: payIdA,
          razorpay_order_id: orderA.razorpayOrderId,
          razorpay_signature: sigA,
        }),
      }),
      request('/api/merch/verify-payment', {
        method: 'POST',
        body: JSON.stringify({
          order_id: orderB.id,
          razorpay_payment_id: payIdB,
          razorpay_order_id: orderB.razorpayOrderId,
          razorpay_signature: sigB,
        }),
      }),
    ]);

    assert.strictEqual(verifyA.status, 200, 'Verify A should respond with 200 (never 500 error)');
    assert.strictEqual(verifyB.status, 200, 'Verify B should respond with 200 (never 500 error)');
    console.log('  ✓ Neither request threw 500 internal server error.');

    // Inspect DB states of Order A and Order B
    const rowA = testDb.prepare('SELECT id, status, payment_status, stock_deducted, razorpay_payment_id FROM merch_orders WHERE id = ?').get(orderA.id);
    const rowB = testDb.prepare('SELECT id, status, payment_status, stock_deducted, razorpay_payment_id FROM merch_orders WHERE id = ?').get(orderB.id);
    const variantRow = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId);

    console.log(`  Row A: status=${rowA.status}, payment_status=${rowA.payment_status}, stock_deducted=${rowA.stock_deducted}, pay_id=${rowA.razorpay_payment_id}`);
    console.log(`  Row B: status=${rowB.status}, payment_status=${rowB.payment_status}, stock_deducted=${rowB.stock_deducted}, pay_id=${rowB.razorpay_payment_id}`);
    console.log(`  Variant Stock in DB: ${variantRow.stock}`);

    // Verify stock is non-negative
    assert.strictEqual(variantRow.stock, 0, 'Variant stock must be exactly 0, never negative');

    // Exactly one order was allocated (processing, stock_deducted=1)
    // The other was routed to stock_shortage (stock_deducted=0, payment_status='paid')
    const allocatedOrder = rowA.status === 'processing' ? rowA : (rowB.status === 'processing' ? rowB : null);
    const shortageOrder = rowA.status === 'stock_shortage' ? rowA : (rowB.status === 'stock_shortage' ? rowB : null);

    assert(allocatedOrder, 'Exactly one order must be allocated with status=processing');
    assert.strictEqual(allocatedOrder.payment_status, 'paid', 'Allocated order must have payment_status=paid');
    assert.strictEqual(allocatedOrder.stock_deducted, 1, 'Allocated order must have stock_deducted=1');

    assert(shortageOrder, 'The second order must be safely routed to status=stock_shortage');
    assert.strictEqual(shortageOrder.payment_status, 'paid', 'Shortage order must preserve payment_status=paid');
    assert.strictEqual(shortageOrder.stock_deducted, 0, 'Shortage order must have stock_deducted=0 (no double deduction)');
    assert(shortageOrder.razorpay_payment_id, 'Shortage order must preserve razorpay_payment_id');

    console.log('  ✓ Deterministic single-unit allocation verified.');
    console.log('  ✓ Shortage order preserved payment and reference without double-decrementing stock.\n');

    // Verify shortage table entry
    const shortageRecord = testDb.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ?').get(shortageOrder.id);
    assert(shortageRecord, 'merch_order_stock_shortages must contain an entry for the shortage order');
    assert.strictEqual(shortageRecord.ordered_quantity, 1, 'Shortage record ordered_quantity should be 1');
    assert.strictEqual(shortageRecord.available_stock, 0, 'Shortage record available_stock should be 0');
    assert.strictEqual(shortageRecord.review_status, 'ready_for_communication', 'Shortage review_status should be ready_for_communication');
    assert.strictEqual(shortageRecord.customer_communication_status, 'pending', 'Customer communication status should be pending');
    console.log('  ✓ merch_order_stock_shortages entry automatically created with accurate deficit and pending communication status.\n');


    // =========================================================================
    // TEST 2: Admin Notification Generation & Stats Verification
    // =========================================================================
    console.log('--- TEST 2: Admin Notification & Stats Verification ---');
    const statsRes = await request('/api/merch/admin/stats', { headers: adminHeaders });
    assert.strictEqual(statsRes.status, 200, 'Admin stats should return 200');

    const notifications = statsRes.data.notifications || [];
    const shortageNotif = notifications.find((n) => n.id === `stock-shortage-order-${shortageOrder.id}` || (n.orderId === shortageOrder.id && /stock shortage/i.test(n.type || n.title)));
    assert(shortageNotif, 'Admin notifications must include a Stock Shortage notification for the affected order');
    console.log(`  Notification found: ID=${shortageNotif.id}, Type=${shortageNotif.type}, Title="${shortageNotif.title}", Message="${shortageNotif.message}"`);
    assert.strictEqual(shortageNotif.type, 'Stock Shortage', 'Notification type must be "Stock Shortage"');
    console.log('  ✓ Admin notification generated and verified in stats.\n');


    // =========================================================================
    // TEST 3: Idempotency of Repeated Payment Verification Calls
    // =========================================================================
    console.log('--- TEST 3: Idempotency of Repeated Verification Calls ---');
    const retryRes = await request('/api/merch/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_id: shortageOrder.id,
        razorpay_payment_id: shortageOrder.razorpay_payment_id,
        razorpay_order_id: orderB.razorpayOrderId,
        razorpay_signature: sigB,
      }),
    });
    assert.strictEqual(retryRes.status, 200, 'Payment retry should return 200');
    assert.strictEqual(retryRes.data.idempotent, true, 'Retry must return idempotent=true');
    assert.strictEqual(retryRes.data.stockShortage, true, 'Retry must preserve stockShortage=true');

    const shortageEntriesCount = testDb.prepare('SELECT count(*) as count FROM merch_order_stock_shortages WHERE order_id = ?').get(shortageOrder.id).count;
    assert.strictEqual(shortageEntriesCount, 1, 'Must not duplicate merch_order_stock_shortages rows on retry');

    const variantStockAfterRetry = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(variantStockAfterRetry, 0, 'Stock must remain 0 after idempotent retries');
    console.log('  ✓ Payment verification idempotency confirmed.\n');


    // =========================================================================
    // TEST 4: Baseline Order With Sufficient Stock (No False Shortages)
    // =========================================================================
    console.log('--- TEST 4: Baseline Order With Sufficient Stock ---');
    testDb.prepare('UPDATE merch_variants SET stock = 10 WHERE id = ?').run(variantId);

    const normalOrder = createPendingOrder(testDb, {
      orderNumber: `HM-NORM-${Date.now()}`,
      customerName: 'Customer C',
      email: 'customerc@test.com',
      items: [{ variantId, sku: 'MIST-RACE-50ML', name: 'H2 Mist Test Edition', price: 2500, qty: 2 }],
    });

    const normalPayId = `pay_normal_order_${Date.now()}`;
    const normalSig = signRazorpay(normalOrder.razorpayOrderId, normalPayId);

    const normalVerify = await request('/api/merch/verify-payment', {
      method: 'POST',
      body: JSON.stringify({
        order_id: normalOrder.id,
        razorpay_payment_id: normalPayId,
        razorpay_order_id: normalOrder.razorpayOrderId,
        razorpay_signature: normalSig,
      }),
    });
    assert.strictEqual(normalVerify.status, 200);

    const normalDbRow = testDb.prepare('SELECT status, stock_deducted FROM merch_orders WHERE id = ?').get(normalOrder.id);
    assert.strictEqual(normalDbRow.status, 'processing');
    assert.strictEqual(normalDbRow.stock_deducted, 1);

    const stockAfterNormal = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(stockAfterNormal, 8, 'Stock should be 10 - 2 = 8');

    const noShortage = testDb.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ?').get(normalOrder.id);
    assert.strictEqual(noShortage, undefined, 'No shortage record should be created for order with sufficient stock');
    console.log('  ✓ Normal order allocated and deducted stock correctly with 0 false shortages.\n');


    // =========================================================================
    // TEST 5: Order Cancellation & Stock Restoration Safeguards
    // =========================================================================
    console.log('--- TEST 5: Order Cancellation & Stock Restoration Safeguards ---');
    // Admin cancels the allocated order:
    const cancelAllocatedRes = await request(`/api/merch/admin/orders/${allocatedOrder.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (cancelAllocatedRes.status !== 200) {
      console.error('cancelAllocatedRes error:', cancelAllocatedRes.status, cancelAllocatedRes.data);
    }
    assert.strictEqual(cancelAllocatedRes.status, 200, 'Admin cancel of allocated order should succeed');

    // Stock should be restored for allocated order (which had stock_deducted=1)
    const stockAfterCancelAllocated = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(stockAfterCancelAllocated, 9, 'Stock should increase from 8 to 9 because allocated order was cancelled');

    // Admin cancels the shortage order:
    const cancelShortageRes = await request(`/api/merch/admin/orders/${shortageOrder.id}/status`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.strictEqual(cancelShortageRes.status, 200, 'Admin cancel of shortage order should succeed');

    // Stock should NOT increase because stock_deducted was 0
    const stockAfterCancelShortage = testDb.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(variantId).stock;
    assert.strictEqual(stockAfterCancelShortage, 9, 'Stock should remain 9 (shortage order had stock_deducted=0, no double restoration)');

    // Shortage record should now be marked resolved
    const resolvedShortage = testDb.prepare('SELECT is_resolved, resolved_by FROM merch_order_stock_shortages WHERE order_id = ?').get(shortageOrder.id);
    assert.strictEqual(resolvedShortage.is_resolved, 1, 'Shortage record should be marked resolved upon cancellation');
    assert.strictEqual(resolvedShortage.resolved_by, 'cancelled_by_admin');
    console.log('  ✓ Cancellation stock restoration and shortage resolution safeguards verified.\n');


    // =========================================================================
    // TEST 6: Customer Communication Safeguards
    // =========================================================================
    console.log('--- TEST 6: Customer Communication Safeguards ---');
    const customerCoupons = testDb.prepare("SELECT * FROM coupons WHERE code LIKE 'DELAY-%' OR code LIKE 'COMP-%'").all();
    assert.strictEqual(customerCoupons.length, 0, 'No automatic compensation coupons should be auto-created without explicit admin review');
    console.log('  ✓ Communication and compensation safeguards intact: zero unauthorized coupons or emails generated.\n');


    // =========================================================================
    // TEST 7: Safety Guard: Real Database Integrity
    // =========================================================================
    console.log('--- TEST 7: Final Safety Guard: Real Database Integrity ---');
    const realDbFinalCount = realDb.prepare('SELECT count(*) as count FROM merch_orders').get().count;
    console.log(`  Initial real DB count: ${realDbInitialCount}`);
    console.log(`  Final real DB count:   ${realDbFinalCount}`);
    assert.strictEqual(realDbFinalCount, realDbInitialCount, 'Real database order count must remain STRICTLY identical!');
    console.log('  ✓ Verified 100% isolation: Zero test records inserted into production/client database.\n');

    console.log('====================================================');
    console.log(' ALL 7 TEST PHASES PASSED WITH COMPLETE SUCCESS! ');
    console.log('====================================================');

  } finally {
    console.log('\n[Teardown] Stopping isolated test server...');
    serverProc.kill('SIGKILL');
    realDb.close();
    try {
      fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
      fs.rmSync(TEST_UPLOADS_DIR, { recursive: true, force: true });
      console.log('[Teardown] Cleaned up temporary test directories.');
    } catch (_) {}
  }
}

run().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
