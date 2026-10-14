const assert = require('assert');
const Database = require('better-sqlite3');
const puppeteer = require('puppeteer');

const BASE_URL = 'http://localhost:3000';
const DB_PATH = 'booking/data/booking.db';

async function runTests() {
  console.log('--- Testing Consolidated Stock Shortage Workflow (Single Delay Management Form) ---\n');

  // 1. Authenticate as Admin
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@h2health.local', password: 'Admin@12345' }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login failed');
  const { token } = await loginRes.json();
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Cookie': `booking_portal_token=${token}`,
    'Content-Type': 'application/json',
  };

  const testOrderId = 43;

  // Set up clean initial test state on shortage 50 (order 43)
  const db = new Database(DB_PATH);
  db.prepare(`
    UPDATE merch_order_stock_shortages
    SET customer_communication_status = 'pending',
        customer_communicated_at = NULL,
        customer_communication_sent_to = NULL,
        customer_communication_error = NULL,
        revised_delivery_estimate = NULL,
        internal_delay_note = NULL,
        review_status = 'awaiting_review',
        compensation_coupon_id = NULL,
        compensation_coupon_code = NULL,
        compensation_coupon_benefit = NULL,
        is_resolved = 0
    WHERE order_id = ? AND is_resolved = 0
  `).run(testOrderId);
  db.close();

  // -------------------------------------------------------------
  // Test 1: Backend allows direct email preview without prior review step
  // -------------------------------------------------------------
  console.log('[Test 1] Backend generates email preview directly on unreviewed shortage (no review-status prerequisite)');
  const previewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  assert.strictEqual(previewRes.status, 200, `Preview should succeed directly, got ${previewRes.status}`);
  const previewData = await previewRes.json();
  assert.strictEqual(previewData.success, true);
  assert.ok(Array.isArray(previewData.shortageItems) && previewData.shortageItems.length > 0, 'shortageItems must be returned');
  assert.ok(previewData.shortageItems[0].missingQuantity >= 0, 'missingQuantity must be calculated');
  console.log('  ✔ Email preview generated directly without requiring prior review step');
  console.log(`  ✔ Returned shortage item: ${previewData.shortageItems[0].productName} (${previewData.shortageItems[0].variantLabel}) — Ordered: ${previewData.shortageItems[0].orderedQuantity}, Available: ${previewData.shortageItems[0].availableStock}, Missing: ${previewData.shortageItems[0].missingQuantity}`);

  // -------------------------------------------------------------
  // Test 2: Save revised delivery estimate & internal note (No email sent, no coupon issued)
  // -------------------------------------------------------------
  console.log('\n[Test 2] Save revised delivery estimate and internal note in consolidated workflow');
  const saveDetailsRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      revisedDeliveryEstimate: '2026-10-30',
      internalDelayNote: 'Batch 88 arrived at customs; estimated warehouse intake on Friday.',
    }),
  });
  assert.strictEqual(saveDetailsRes.status, 200, 'Saving delay details should succeed');
  const saveDetailsData = await saveDetailsRes.json();
  assert.strictEqual(saveDetailsData.success, true);

  // Verify persistence in DB
  const dbVerify1 = new Database(DB_PATH);
  const updatedShortage = dbVerify1.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ? AND is_resolved = 0').get(testOrderId);
  assert.strictEqual(updatedShortage.revised_delivery_estimate, '2026-10-30', 'Delivery estimate must persist');
  assert.strictEqual(updatedShortage.internal_delay_note, 'Batch 88 arrived at customs; estimated warehouse intake on Friday.', 'Internal note must persist');
  assert.strictEqual(updatedShortage.customer_communication_status, 'pending', 'Customer communication status must remain pending (no email sent)');
  assert.strictEqual(updatedShortage.compensation_coupon_id, null, 'No compensation coupon should be issued');
  dbVerify1.close();
  console.log('  ✔ Delivery estimate and staff-only internal note persisted in DB');
  console.log('  ✔ Confirmed: No email was dispatched and no coupon was issued during save');

  // -------------------------------------------------------------
  // Test 3: Preview reflects updated delivery estimate
  // -------------------------------------------------------------
  console.log('\n[Test 3] Email preview dynamically reflects the updated delivery estimate');
  const previewUpdatedRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  assert.strictEqual(previewUpdatedRes.status, 200);
  const previewUpdated = await previewUpdatedRes.json();
  assert.strictEqual(previewUpdated.revisedDeliveryEstimate, '2026-10-30');
  assert.ok(previewUpdated.text.includes('Your revised estimated delivery date is 2026-10-30.'));
  assert.ok(!previewUpdated.text.includes('Batch 88 arrived at customs'), 'Internal note must NOT be exposed in customer email');
  console.log('  ✔ Preview email contains revised delivery date: 2026-10-30');
  console.log('  ✔ Internal staff note is strictly excluded from customer email content');

  // -------------------------------------------------------------
  // Test 4: Browser UI Verification with Puppeteer
  // -------------------------------------------------------------
  console.log('\n[Test 4] Browser UI testing of consolidated delay management form');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });

    await page.setCookie({
      name: 'booking_portal_token',
      value: token,
      domain: 'localhost',
      path: '/',
    });

    await page.goto(`${BASE_URL}/merch/admin/index.html#orders`, { waitUntil: 'networkidle2' });

    await page.evaluate((jwt) => {
      localStorage.setItem('booking_portal_auth_token', jwt);
    }, token);

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    await page.waitForSelector('[data-order-filter="all"]', { timeout: 10000 });

    // Filter to Stock Shortage orders
    console.log('  -> Filtering to Stock Shortage orders tab...');
    await page.waitForSelector('[data-order-filter="stock_shortage"]', { timeout: 5000 });
    await page.click('[data-order-filter="stock_shortage"]');
    await wait(600);

    // Select order 43 in table
    console.log('  -> Selecting stock shortage order 43...');
    await page.waitForSelector(`tr[data-id="${testOrderId}"]`, { timeout: 5000 });
    await page.click(`tr[data-id="${testOrderId}"]`);
    await wait(300);

    // Verify Review button is GONE from order detail
    const reviewBtnExists = await page.evaluate(() => {
      return Boolean(document.querySelector('[data-action="open-stock-shortage-review"]'));
    });
    assert.strictEqual(reviewBtnExists, false, 'Separate Review button must be completely removed from UI');
    console.log('  ✔ Confirmed: Separate "Review Delay & Delivery Estimate" button is removed from UI');

    // Verify consolidated action button is present and click it
    const manageBtnSelector = `[data-action="open-stock-shortage-email-modal"][data-order-id="${testOrderId}"]`;
    await page.waitForSelector(manageBtnSelector, { timeout: 5000 });
    const manageBtnText = await page.$eval(manageBtnSelector, (el) => el.innerText.trim());
    console.log(`  ✔ Consolidated action button found: "${manageBtnText}"`);

    await page.click(manageBtnSelector);
    await wait(1000);

    // Verify consolidated modal elements
    await page.waitForSelector('#consolidatedDeliveryEstimateInput', { timeout: 5000 });
    await page.waitForSelector('#consolidatedInternalDelayNote', { timeout: 5000 });
    await page.waitForSelector('#saveConsolidatedDelayDetailsBtn', { timeout: 5000 });
    await page.waitForSelector('#confirmSendDelayEmailCheck', { timeout: 5000 });
    await page.waitForSelector('[data-action="confirm-send-stock-delay-email"]', { timeout: 5000 });

    console.log('  ✔ Consolidated modal loaded with delivery estimate, internal note, and action buttons');

    // Verify Affected Items summary in modal contains missing quantity
    const modalItemsSummary = await page.evaluate(() => {
      const modal = document.querySelector('.admin-modal__body');
      return modal ? modal.innerText : '';
    });
    assert.ok(modalItemsSummary.includes('Ordered:'), 'Modal must display ordered quantity');
    assert.ok(modalItemsSummary.includes('Available Stock:'), 'Modal must display available stock');
    assert.ok(modalItemsSummary.includes('Missing:'), 'Modal must display missing quantity');
    console.log('  ✔ Affected items table displays Ordered, Available, and Missing quantities');

    // Update delivery estimate in UI
    console.log('  -> Updating delivery estimate and note in UI...');
    await page.$eval('#consolidatedDeliveryEstimateInput', (el) => { el.value = ''; });
    await page.type('#consolidatedDeliveryEstimateInput', '2026-11-05');

    await page.$eval('#consolidatedInternalDelayNote', (el) => { el.value = ''; });
    await page.type('#consolidatedInternalDelayNote', 'Updated via consolidated admin form.');

    // Click Save Delay Details button
    await page.click('#saveConsolidatedDelayDetailsBtn');
    await wait(800);

    // Verify DB updated
    const dbVerify2 = new Database(DB_PATH);
    const savedShortage = dbVerify2.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ? AND is_resolved = 0').get(testOrderId);
    assert.strictEqual(savedShortage.revised_delivery_estimate, '2026-11-05', 'Estimate updated in DB');
    assert.strictEqual(savedShortage.internal_delay_note, 'Updated via consolidated admin form.', 'Note updated in DB');
    dbVerify2.close();
    console.log('  ✔ "Save Delay Details" successfully persisted "2026-11-05" without sending email');

    // Check Send button is disabled until explicit confirmation checkbox is checked
    const isSendDisabledBefore = await page.$eval('[data-action="confirm-send-stock-delay-email"]', (el) => el.disabled);
    assert.strictEqual(isSendDisabledBefore, true, 'Send button must be disabled until confirmation checkbox is checked');
    console.log('  ✔ Send button is disabled by default (explicit confirmation required)');

    // Check confirmation checkbox
    await page.click('#confirmSendDelayEmailCheck');
    await wait(200);

    const isSendDisabledAfter = await page.$eval('[data-action="confirm-send-stock-delay-email"]', (el) => el.disabled);
    assert.strictEqual(isSendDisabledAfter, false, 'Send button must be enabled after checking confirmation');
    console.log('  ✔ Checking confirmation explicitly enables the Send button');

    // Close modal
    await page.click('[data-action="close-modal"]');
    await wait(400);

  } finally {
    await browser.close();
  }

  // -------------------------------------------------------------
  // Test 5: Optional Compensation & Explicit Confirmation on Send
  // -------------------------------------------------------------
  console.log('\n[Test 5] Send delay notification email with optional compensation & duplicate safeguards');

  // Send mock email without coupon (compensation optional)
  const sendRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-mock-email-success': 'true',
    },
    body: JSON.stringify({
      couponId: null, // optional compensation: none
      confirmResend: false,
    }),
  });
  assert.strictEqual(sendRes.status, 200, `Send email should succeed, got ${sendRes.status}`);
  const sendData = await sendRes.json();
  assert.strictEqual(sendData.success, true);
  console.log('  ✔ Delay email dispatched successfully with compensation omitted');

  // Verify status in DB is now 'sent'
  const dbVerify3 = new Database(DB_PATH);
  const sentShortage = dbVerify3.prepare('SELECT * FROM merch_order_stock_shortages WHERE order_id = ? AND is_resolved = 0').get(testOrderId);
  assert.strictEqual(sentShortage.customer_communication_status, 'sent');
  assert.ok(sentShortage.customer_communicated_at, 'customer_communicated_at must be populated');
  dbVerify3.close();
  console.log('  ✔ Database records communication status = "sent"');

  // -------------------------------------------------------------
  // Test 6: Duplicate Send Protection & Resend Rationale Safeguards
  // -------------------------------------------------------------
  console.log('\n[Test 6] Duplicate send protection rejects accidental re-dispatch');
  const duplicateSendRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-mock-email-success': 'true',
    },
    body: JSON.stringify({
      confirmResend: false,
    }),
  });
  assert.strictEqual(duplicateSendRes.status, 409, 'Immediate duplicate dispatch must be rejected with 409');
  console.log('  ✔ Already-sent email safely blocked from accidental duplicate re-dispatch');

  // -------------------------------------------------------------
  // Test 7: Inventory & Fulfillment Guardrails Intact
  // -------------------------------------------------------------
  console.log('\n[Test 7] Fulfillment remains blocked until stock shortage is genuinely resolved');
  const shiprocketAttempt = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/shiprocket/create`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert.strictEqual(shiprocketAttempt.status, 400, 'Shiprocket must reject fulfillment for order with active stock shortage');
  const shiprocketErr = await shiprocketAttempt.json();
  assert.ok(shiprocketErr.error.includes('stock shortage'), 'Error message must specify stock shortage block');

  // Verify order payload reports isFulfillmentBlocked = true
  const ordersListRes = await fetch(`${BASE_URL}/api/merch/admin/orders`, { headers });
  assert.strictEqual(ordersListRes.status, 200);
  const ordersListData = await ordersListRes.json();
  const targetOrder = (ordersListData.orders || ordersListData).find((o) => Number(o.id) === Number(testOrderId));
  assert.ok(targetOrder, 'Target order must be returned in orders list');
  assert.strictEqual(Boolean(targetOrder.isFulfillmentBlocked), true, 'Order isFulfillmentBlocked flag must be true');
  console.log('  ✔ Order strictly cannot be fulfilled while stock shortage remains unresolved');
  console.log('  ✔ isFulfillmentBlocked is correctly set to true on the order payload');

  // -------------------------------------------------------------
  // Test 8: Final DB check for the 52 genuine orders
  // -------------------------------------------------------------
  console.log('\n[Test 8] Strict verification of database integrity');
  const dbVerifyFinal = new Database(DB_PATH);
  const totalOrders = dbVerifyFinal.prepare('SELECT COUNT(*) as count FROM merch_orders').get().count;
  assert.strictEqual(totalOrders, 52, `Database must contain exactly 52 orders, found ${totalOrders}`);
  dbVerifyFinal.close();
  console.log('  ✔ Confirmed: Exactly 52 genuine customer orders preserved in database');

  console.log('\n🎉 ALL CONSOLIDATED STOCK SHORTAGE WORKFLOW TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
