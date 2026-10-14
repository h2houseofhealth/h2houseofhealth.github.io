const assert = require('assert');
const Database = require('better-sqlite3');
const crypto = require('crypto');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('================================================================');
  console.log('--- Testing Stock Availability & Order Fulfillment Flow (Phase 4) ---');
  console.log('================================================================\n');

  // 1. Admin login
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const loginData = await loginRes.json();
  const token = loginData.token;
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Cookie': `booking_portal_token=${token}`,
    'Content-Type': 'application/json',
  };

  const db = new Database('./booking/data/booking.db');

  try {
    // -------------------------------------------------------------------------
    // Helper to create clean test products and variants
    // -------------------------------------------------------------------------
    function createTestVariant(sku, initialStock, price = 500) {
      const prodRes = db.prepare(`
        INSERT INTO merch_products (name, slug, category, base_price, is_active, created_at, updated_at)
        VALUES (?, ?, 'Wellness', ?, 1, datetime('now'), datetime('now'))
      `).run(`Test Prod ${sku}`, `slug-${sku.toLowerCase()}`, price);

      const varRes = db.prepare(`
        INSERT INTO merch_variants (product_id, sku, size, color, stock, price, is_active, created_at)
        VALUES (?, ?, 'Standard', 'White', ?, ?, 1, datetime('now'))
      `).run(prodRes.lastInsertRowid, sku, initialStock, price);

      return {
        productId: Number(prodRes.lastInsertRowid),
        variantId: Number(varRes.lastInsertRowid),
        sku,
      };
    }

    function createTestOrder({ orderNumber, customerName, email, paymentMethod, paymentStatus, status, stockDeducted, items, createdAt }) {
      const time = createdAt || new Date().toISOString();
      const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
      const oRes = db.prepare(`
        INSERT INTO merch_orders (
          order_number, customer_name, customer_email, customer_phone, shipping_address, billing_address,
          payment_method, payment_status, status, stock_deducted, subtotal, total_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, '9876543210', '123 Test St, Test City', '123 Test St, Test City',
                  ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderNumber, customerName, email,
        paymentMethod, paymentStatus, status, stockDeducted ? 1 : 0, total, total,
        time, time
      );
      const orderId = Number(oRes.lastInsertRowid);

      for (const item of items) {
        db.prepare(`
          INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total)
          VALUES (?, ?, ?, 'Standard', ?, ?, ?, ?)
        `).run(orderId, item.variantId, item.name || 'Test Item', item.sku, item.price, item.qty, item.qty * item.price);
      }

      return orderId;
    }

    // =========================================================================
    // Test 1: Two unfulfilled orders competing for one unit, with deterministic FIFO allocation
    // =========================================================================
    console.log('[Test 1] Two unfulfilled orders competing for 1 unit (FIFO allocation)');
    const v1 = createTestVariant(`T1-${Date.now()}`, 1); // 1 physical unit

    const o1Id = createTestOrder({
      orderNumber: `HM-T1-A-${Date.now()}`,
      customerName: 'Customer A (First)',
      email: 'custA@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      createdAt: '2026-10-01 10:00:00',
      items: [{ variantId: v1.variantId, sku: v1.sku, qty: 1, price: 500 }],
    });

    const o2Id = createTestOrder({
      orderNumber: `HM-T1-B-${Date.now()}`,
      customerName: 'Customer B (Second)',
      email: 'custB@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      createdAt: '2026-10-01 10:05:00',
      items: [{ variantId: v1.variantId, sku: v1.sku, qty: 1, price: 500 }],
    });

    // Query admin orders API
    const resOrdersT1 = await fetch(`${BASE_URL}/api/merch/admin/orders`, { headers });
    assert.strictEqual(resOrdersT1.status, 200);
    const ordersT1 = (await resOrdersT1.json()).orders;

    const orderA = ordersT1.find((o) => Number(o.id) === o1Id);
    const orderB = ordersT1.find((o) => Number(o.id) === o2Id);

    assert.ok(orderA, 'Order A must exist in orders list');
    assert.ok(orderB, 'Order B must exist in orders list');

    // Earlier order A gets the single unit
    assert.strictEqual(orderA.items[0].allocatedQuantity, 1, 'Order A must receive 1 allocated unit');
    assert.strictEqual(orderA.items[0].deficitQuantity, 0, 'Order A deficit must be 0');
    assert.strictEqual(orderA.fulfillmentStatus, 'ready_to_fulfill', 'Order A must be ready to fulfill');
    assert.strictEqual(orderA.isFulfillmentBlocked, false, 'Order A must not be blocked');

    // Later order B gets 0 units and has a deficit of 1
    assert.strictEqual(orderB.items[0].allocatedQuantity, 0, 'Order B must receive 0 allocated units');
    assert.strictEqual(orderB.items[0].deficitQuantity, 1, 'Order B deficit must be 1');
    assert.strictEqual(orderB.fulfillmentStatus, 'stock_shortage', 'Order B must be stock_shortage');
    assert.strictEqual(orderB.isFulfillmentBlocked, true, 'Order B must be blocked from fulfillment');

    // Products catalog reflects blocked order count
    const resProdT1 = await fetch(`${BASE_URL}/api/merch/products`, { headers });
    const prodsT1 = await resProdT1.json();
    const prodT1 = prodsT1.find((p) => Number(p.id) === v1.productId);
    assert.ok(prodT1, 'Product must be found in catalog');
    assert.strictEqual(prodT1.blockedOrdersCount, 1, 'Product must report 1 blocked order');
    assert.strictEqual(prodT1.netAvailableStock, 0, 'Net available stock must be 0 (1 physical - 1 allocated)');
    console.log('✓ Test 1 passed: FIFO order allocation and blocked order counting are deterministic.\n');

    // =========================================================================
    // Test 2: Processing orders whose stock was already deducted (no double-counting)
    // =========================================================================
    console.log('[Test 2] Processing orders with stock_deducted = 1 do not double-subtract from physical stock');
    const v2 = createTestVariant(`T2-${Date.now()}`, 5); // Shelf stock is 5

    // Order C already deducted 2 units during checkout
    const oCId = createTestOrder({
      orderNumber: `HM-T2-C-${Date.now()}`,
      customerName: 'Customer C (Processing)',
      email: 'custC@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'processing',
      stockDeducted: 1,
      createdAt: '2026-10-02 10:00:00',
      items: [{ variantId: v2.variantId, sku: v2.sku, qty: 2, price: 500 }],
    });

    // Order D is a newly paid order for 5 units whose stock is not yet deducted
    const oDId = createTestOrder({
      orderNumber: `HM-T2-D-${Date.now()}`,
      customerName: 'Customer D (Unfulfilled)',
      email: 'custD@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'processing',
      stockDeducted: 0,
      createdAt: '2026-10-02 10:10:00',
      items: [{ variantId: v2.variantId, sku: v2.sku, qty: 5, price: 500 }],
    });

    const resOrdersT2 = await fetch(`${BASE_URL}/api/merch/admin/orders`, { headers });
    const ordersT2 = (await resOrdersT2.json()).orders;
    const orderC = ordersT2.find((o) => Number(o.id) === oCId);
    const orderD = ordersT2.find((o) => Number(o.id) === oDId);

    assert.strictEqual(orderC.items[0].stockDeducted, true, 'Order C stock was already deducted');
    assert.strictEqual(orderC.fulfillmentStatus, 'ready_to_fulfill');

    // Crucial check: Order D gets all 5 physical units. If Order C double-subtracted its 2 units,
    // Order D would only get 3 units with deficit 2!
    assert.strictEqual(orderD.items[0].allocatedQuantity, 5, 'Order D must receive full 5 units');
    assert.strictEqual(orderD.items[0].deficitQuantity, 0, 'Order D must have 0 deficit');
    assert.strictEqual(orderD.fulfillmentStatus, 'ready_to_fulfill', 'Order D must be ready to fulfill');
    console.log('✓ Test 2 passed: No double deduction for orders with stock_deducted = 1.\n');

    // =========================================================================
    // Test 3: Pending online orders and COD orders
    // =========================================================================
    console.log('[Test 3] Pending online orders vs submitted COD orders');
    const v3 = createTestVariant(`T3-${Date.now()}`, 10);

    // Pending online order (unpaid, checkout not completed)
    const oPendingId = createTestOrder({
      orderNumber: `HM-T3-P-${Date.now()}`,
      customerName: 'Pending Online Customer',
      email: 'pending@example.com',
      paymentMethod: 'online',
      paymentStatus: 'pending',
      status: 'pending',
      stockDeducted: 0,
      items: [{ variantId: v3.variantId, sku: v3.sku, qty: 2, price: 500 }],
    });

    // COD order (confirmed order, stock deducted at checkout)
    const oCodId = createTestOrder({
      orderNumber: `HM-T3-COD-${Date.now()}`,
      customerName: 'COD Customer',
      email: 'cod@example.com',
      paymentMethod: 'cod',
      paymentStatus: 'cod_pending',
      status: 'processing',
      stockDeducted: 1,
      items: [{ variantId: v3.variantId, sku: v3.sku, qty: 3, price: 500 }],
    });

    const resOrdersT3 = await fetch(`${BASE_URL}/api/merch/admin/orders?includeUnconfirmed=true`, { headers });
    const ordersT3 = (await resOrdersT3.json()).orders;
    const orderP = ordersT3.find((o) => Number(o.id) === oPendingId);
    const orderCod = ordersT3.find((o) => Number(o.id) === oCodId);

    assert.strictEqual(orderP.fulfillmentStatus, 'pending_payment', 'Pending online order must have pending_payment status');
    assert.strictEqual(orderCod.fulfillmentStatus, 'ready_to_fulfill', 'COD order with stock deducted must be ready_to_fulfill');

    // Flag stock shortage on COD order: should succeed without weakening payment
    const flagCodRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oCodId}/stock-shortage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: 'Warehouse damaged unit' }),
    });
    assert.strictEqual(flagCodRes.status, 200, 'Admin can flag stock shortage on COD order');
    const flagCodData = await flagCodRes.json();
    assert.strictEqual(flagCodData.order.status, 'stock_shortage');
    assert.strictEqual(flagCodData.order.paymentMethod, 'cod');
    console.log('✓ Test 3 passed: Correct handling of pending online and COD orders.\n');

    // =========================================================================
    // Test 4: Multi-item order with only one unavailable variant
    // =========================================================================
    console.log('[Test 4] Multi-item order with only one unavailable variant');
    const v4A = createTestVariant(`T4A-${Date.now()}`, 5); // Available
    const v4B = createTestVariant(`T4B-${Date.now()}`, 0); // Out of stock

    const oMultiId = createTestOrder({
      orderNumber: `HM-T4-MULTI-${Date.now()}`,
      customerName: 'Multi Item Customer',
      email: 'multi@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'processing',
      stockDeducted: 0,
      items: [
        { variantId: v4A.variantId, sku: v4A.sku, name: 'Item In Stock', qty: 2, price: 500 },
        { variantId: v4B.variantId, sku: v4B.sku, name: 'Item Out Of Stock', qty: 1, price: 500 },
      ],
    });

    const resOrdersT4 = await fetch(`${BASE_URL}/api/merch/admin/orders`, { headers });
    const ordersT4 = (await resOrdersT4.json()).orders;
    const orderMulti = ordersT4.find((o) => Number(o.id) === oMultiId);

    assert.strictEqual(orderMulti.fulfillmentStatus, 'partially_available', 'Must be partially_available');
    assert.strictEqual(orderMulti.isFulfillmentBlocked, true, 'Must be marked as blocked');

    const itA = orderMulti.items.find((i) => Number(i.variantId) === v4A.variantId);
    const itB = orderMulti.items.find((i) => Number(i.variantId) === v4B.variantId);

    assert.strictEqual(itA.allocatedQuantity, 2, 'Item A must be fully allocated');
    assert.strictEqual(itA.deficitQuantity, 0, 'Item A must have 0 deficit');
    assert.strictEqual(itB.allocatedQuantity, 0, 'Item B must have 0 allocated');
    assert.strictEqual(itB.deficitQuantity, 1, 'Item B must have deficit of 1');
    console.log('✓ Test 4 passed: Multi-item orders report partial availability and item deficits.\n');

    // =========================================================================
    // Test 5: Stock replenishment and shortage resolution
    // =========================================================================
    console.log('[Test 5] Stock replenishment and shortage resolution');
    const v5 = createTestVariant(`T5-${Date.now()}`, 0); // 0 stock initially

    const oShortageId = createTestOrder({
      orderNumber: `HM-T5-RES-${Date.now()}`,
      customerName: 'Shortage Resolve Customer',
      email: 'resolve@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      items: [{ variantId: v5.variantId, sku: v5.sku, qty: 3, price: 500 }],
    });

    // Create shortage entry
    db.prepare(`
      INSERT INTO merch_order_stock_shortages (order_id, variant_id, ordered_quantity, available_stock, reason, is_resolved)
      VALUES (?, ?, 3, 0, 'Awaiting manufacturer shipment', 0)
    `).run(oShortageId, v5.variantId);

    // Attempting to resolve shortage before replenishment MUST fail
    const resolveFailRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oShortageId}/resolve-stock-shortage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    assert.strictEqual(resolveFailRes.status, 400, 'Must reject shortage resolution when stock is insufficient');
    const failData = await resolveFailRes.json();
    assert.ok(failData.error.includes('Insufficient physical stock'), 'Error message must specify insufficient stock');

    // Replenish stock in inventory
    db.prepare('UPDATE merch_variants SET stock = 10 WHERE id = ?').run(v5.variantId);

    // Attempting resolution now MUST succeed
    const resolveSuccessRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oShortageId}/resolve-stock-shortage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    assert.strictEqual(resolveSuccessRes.status, 200, 'Must succeed when stock is available');
    const successData = await resolveSuccessRes.json();
    assert.strictEqual(successData.order.status, 'processing', 'Order status must return to processing');
    assert.strictEqual(successData.order.stockDeducted, true, 'Order stock_deducted must be true');

    // Verify physical stock was decremented from 10 to 7
    const v5After = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v5.variantId);
    assert.strictEqual(v5After.stock, 7, 'Variant stock must be decremented by 3 units');
    console.log('✓ Test 5 passed: Verified stock checking on shortage resolution.\n');

    // =========================================================================
    // Test 6: Cancellation and refund restoration, including duplicate-restoration prevention
    // =========================================================================
    console.log('[Test 6] Cancellation and refund stock restoration idempotency');
    const v6 = createTestVariant(`T6-${Date.now()}`, 5);

    // Order 1 has deducted stock (stock_deducted = 1, qty = 2)
    const oCancelId = createTestOrder({
      orderNumber: `HM-T6-CANC-${Date.now()}`,
      customerName: 'Cancel Customer',
      email: 'cancel@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'processing',
      stockDeducted: 1,
      items: [{ variantId: v6.variantId, sku: v6.sku, qty: 2, price: 500 }],
    });

    // Cancel order via status update
    const cancelRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oCancelId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.strictEqual(cancelRes.status, 200);

    // Stock should increase from 5 to 7
    let v6Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v6.variantId).stock;
    assert.strictEqual(v6Stock, 7, 'Stock must be restored by 2 units on cancellation');

    // Repeated cancellation / refund request must NOT restore stock a second time
    const refundRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oCancelId}/refund`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason: 'Duplicate refund request', cancel_order: true, restock: true }),
    });
    assert.strictEqual(refundRes.status, 200);

    v6Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v6.variantId).stock;
    assert.strictEqual(v6Stock, 7, 'Stock must NOT be restored a second time');

    // Test order that had stock_deducted = 0 (never consumed inventory)
    const oNoDeductId = createTestOrder({
      orderNumber: `HM-T6-NODED-${Date.now()}`,
      customerName: 'No Deduct Customer',
      email: 'nodeduct@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      items: [{ variantId: v6.variantId, sku: v6.sku, qty: 2, price: 500 }],
    });

    const cancelNoDeductRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oNoDeductId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'cancelled' }),
    });
    assert.strictEqual(cancelNoDeductRes.status, 200);

    v6Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v6.variantId).stock;
    assert.strictEqual(v6Stock, 7, 'Stock must not increase when cancelling order with stock_deducted = 0');
    console.log('✓ Test 6 passed: Restoration idempotency verified across cancellations and refunds.\n');

    // =========================================================================
    // Test 7: Returned orders and sellable-stock eligibility
    // =========================================================================
    console.log('[Test 7] Returned orders and sellable-stock eligibility');
    const v7 = createTestVariant(`T7-${Date.now()}`, 10);

    const oReturnId = createTestOrder({
      orderNumber: `HM-T7-RET-${Date.now()}`,
      customerName: 'Return Customer',
      email: 'return@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'delivered',
      stockDeducted: 1,
      items: [{ variantId: v7.variantId, sku: v7.sku, qty: 3, price: 500 }],
    });

    // Return WITHOUT restock_inventory (e.g. damaged goods)
    const retNoRestockRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oReturnId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'returned', restock_inventory: false }),
    });
    assert.strictEqual(retNoRestockRes.status, 200);

    let v7Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v7.variantId).stock;
    assert.strictEqual(v7Stock, 10, 'Damaged return must NOT restore stock');

    // Return WITH restock_inventory (sellable goods)
    const oReturnEligibleId = createTestOrder({
      orderNumber: `HM-T7-RET-ELIG-${Date.now()}`,
      customerName: 'Eligible Return Customer',
      email: 'return2@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'delivered',
      stockDeducted: 1,
      items: [{ variantId: v7.variantId, sku: v7.sku, qty: 3, price: 500 }],
    });

    const retRestockRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oReturnEligibleId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'returned', restock_inventory: true }),
    });
    assert.strictEqual(retRestockRes.status, 200);

    v7Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v7.variantId).stock;
    assert.strictEqual(v7Stock, 13, 'Eligible return must restore stock to sellable inventory');
    console.log('✓ Test 7 passed: Returns only restock when explicitly flagged as eligible.\n');

    // =========================================================================
    // Test 8: Razorpay payment captured but inventory unavailable during verification
    // =========================================================================
    console.log('[Test 8] Razorpay payment captured but stock depleted before verification (race recovery)');
    const v8 = createTestVariant(`T8-${Date.now()}`, 0); // Depleted stock!

    // Create order pending payment
    const oRaceId = createTestOrder({
      orderNumber: `HM-T8-RACE-${Date.now()}`,
      customerName: 'Race Condition Customer',
      email: 'race@example.com',
      paymentMethod: 'online',
      paymentStatus: 'pending',
      status: 'pending',
      stockDeducted: 0,
      items: [{ variantId: v8.variantId, sku: v8.sku, qty: 1, price: 500 }],
    });

    const capturedPaymentId = `pay_race_mock_${Date.now()}`;
    const rzpOrderId = `order_race_mock_${Date.now()}`;
    db.prepare('UPDATE merch_orders SET razorpay_order_id = ? WHERE id = ?').run(rzpOrderId, oRaceId);

    let rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    if (!rzpSecret) {
      try {
        const envFile = fs.readFileSync('./booking/.env', 'utf8');
        const match = envFile.match(/^RAZORPAY_KEY_SECRET=(.+)$/m);
        if (match) rzpSecret = match[1].trim();
      } catch (_) {}
    }
    const signature = crypto.createHmac('sha256', rzpSecret || '').update(`${rzpOrderId}|${capturedPaymentId}`).digest('hex');

    // Call verify-payment endpoint
    const verifyRes = await fetch(`${BASE_URL}/api/merch/verify-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: capturedPaymentId,
        razorpay_signature: signature,
        items: [{ variantId: v8.variantId, quantity: 1, price: 500 }],
      }),
    });

    assert.strictEqual(verifyRes.status, 200, 'Payment verification must return HTTP 200 instead of crashing');
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.stockShortage, true, 'Response must clearly flag stockShortage');

    // Verify order database state
    const orderInDb = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(oRaceId);
    assert.strictEqual(orderInDb.payment_status, 'paid', 'Captured payment must be recorded as paid');
    assert.strictEqual(orderInDb.status, 'stock_shortage', 'Status must safely transition to stock_shortage');
    assert.strictEqual(orderInDb.stock_deducted, 0, 'stock_deducted must remain 0');
    assert.strictEqual(orderInDb.razorpay_payment_id, capturedPaymentId, 'Payment ID must be preserved for audit');

    // Verify shortage entry was created
    const shortageRecord = db.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ?').get(oRaceId);
    assert.ok(shortageRecord, 'Stock shortage entry must be automatically created');
    assert.ok(shortageRecord.reason.includes('stock was depleted prior to payment verification'));

    // Variant stock should NOT go negative
    const v8Stock = db.prepare('SELECT stock FROM merch_variants WHERE id = ?').get(v8.variantId).stock;
    assert.strictEqual(v8Stock, 0, 'Variant stock must remain 0 and never drop below 0');
    console.log('✓ Test 8 passed: Graceful recovery from online payment race condition without 500 or negative stock.\n');

    // =========================================================================
    // Test 9: Shiprocket shipping blocked for an ineligible order at the backend
    // =========================================================================
    console.log('[Test 9] Shiprocket shipping action blocked at backend for shortage / unallocated orders');
    const v9 = createTestVariant(`T9-${Date.now()}`, 0);

    const oBlockedShipId = createTestOrder({
      orderNumber: `HM-T9-SHIP-${Date.now()}`,
      customerName: 'Blocked Shipping Customer',
      email: 'blockedship@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      items: [{ variantId: v9.variantId, sku: v9.sku, qty: 1, price: 500 }],
    });

    // Try Shiprocket create order
    const shipCreateRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oBlockedShipId}/shiprocket/create`, {
      method: 'POST',
      headers,
    });
    assert.strictEqual(shipCreateRes.status, 400, 'Shiprocket creation must be blocked with HTTP 400');
    const shipCreateData = await shipCreateRes.json();
    assert.ok(shipCreateData.error.includes('stock shortage') || shipCreateData.error.includes('unallocated'), 'Must reject due to shortage');

    // Try Shiprocket assign AWB
    const awbRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oBlockedShipId}/shiprocket/assign-awb`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courier_id: 123 }),
    });
    assert.strictEqual(awbRes.status, 400, 'AWB assignment must be blocked with HTTP 400');
    const awbData = await awbRes.json();
    assert.ok(awbData.error.includes('stock shortage') || awbData.error.includes('unallocated'), 'Must reject due to shortage');
    console.log('✓ Test 9 passed: Backend strictly guards Shiprocket fulfillment from blocked orders.\n');

    // =========================================================================
    // Test 10: Existing stock-shortage review, delay email, and coupon regressions
    // =========================================================================
    console.log('[Test 10] Existing stock-shortage review, delay email preview & coupon flows');
    const v10 = createTestVariant(`T10-${Date.now()}`, 0);

    const oReviewId = createTestOrder({
      orderNumber: `HM-T10-REV-${Date.now()}`,
      customerName: 'Review Flow Customer',
      email: 'reviewcust@example.com',
      paymentMethod: 'online',
      paymentStatus: 'paid',
      status: 'stock_shortage',
      stockDeducted: 0,
      items: [{ variantId: v10.variantId, sku: v10.sku, qty: 1, price: 500 }],
    });

    db.prepare(`
      INSERT INTO merch_order_stock_shortages (order_id, variant_id, ordered_quantity, available_stock, reason, is_resolved)
      VALUES (?, ?, 1, 0, 'Supply chain delay', 0)
    `).run(oReviewId, v10.variantId);

    // Review shortage and set delivery estimate
    const reviewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oReviewId}/stock-shortage/review`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        revisedDeliveryEstimate: '2026-11-15',
        internalDelayNote: 'Staff note on backorder',
        reviewStatus: 'ready_for_communication',
      }),
    });
    assert.strictEqual(reviewRes.status, 200, 'Review update must succeed');

    // Preview delay email
    const previewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oReviewId}/stock-shortage/email-preview`, { headers });
    assert.strictEqual(previewRes.status, 200);
    const previewData = await previewRes.json();
    assert.ok(previewData.text.includes('2026-11-15'), 'Preview must include the revised delivery estimate');

    // Create compensation coupon
    const couponCode = `COMP-${Date.now().toString().slice(-6)}`;
    const couponRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${oReviewId}/compensation-coupons`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        code: couponCode,
        discountType: 'percentage',
        discountValue: 10,
        maxRedemptions: 1,
      }),
    });
    assert.ok([200, 201].includes(couponRes.status), 'Compensation coupon creation must succeed');

    console.log('✓ Test 10 passed: Stock shortage review, delay email, and compensation coupon flows intact.\n');

    console.log('================================================================');
    console.log('ALL 10 SCENARIOS PASSED WITH ZERO REGRESSIONS!');
    console.log('================================================================\n');

  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
