const assert = require('assert');
const Database = require('better-sqlite3');

const BASE_URL = 'http://localhost:3000';

async function main() {
  console.log('--- Testing Stock Delay Compensation Modal & Coupon Creation ---');

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

  const testOrderId = 43; // Sowmya Sai Daddanala, sowmyaram63@gmail.com, order HM-20260929-4BB077

  const dbInit = new Database('./booking/data/booking.db');
  dbInit.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'pending', revised_delivery_estimate = '2026-10-25' WHERE order_id = ?").run(testOrderId);
  dbInit.close();

  // 2. Test 1: Preview without coupon contains predefined apology message and does NOT mention discount
  console.log('[Test 1] Preview without coupon contains predefined apology message and no discount');
  const p1Res = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  assert.strictEqual(p1Res.status, 200, 'Preview failed');
  const p1 = await p1Res.json();
  assert.strictEqual(p1.success, true);
  assert.ok(p1.text.includes("We're sorry, but your H2 House of Health order HM-20260929-4BB077 has been delayed because an item in your order is temporarily unavailable."));
  assert.ok(p1.text.includes('Our team is working to resolve this. Your revised estimated delivery date is 2026-10-25.'));
  assert.ok(p1.text.includes('We sincerely apologize for the inconvenience and appreciate your patience.'));
  assert.ok(p1.text.includes('Affected item(s):\n• H2 Hydrogen Mist Spray (13ml / White) × 1'));
  assert.ok(!p1.text.includes('coupon'), 'No-coupon email must not mention coupons');
  assert.ok(!p1.text.includes('discount'), 'No-coupon email must not mention discount');
  assert.ok(p1.html.includes('H2 House of Health'));
  assert.ok(p1.html.includes('Order Delay Update'));
  assert.ok(!p1.html.includes('Courtesy Compensation'));
  assert.strictEqual(p1.selectedCoupon, null);
  assert.ok(p1.defaultApologyMessage.length > 20);
  console.log('✓ Test 1 passed');

  // 3. Test 2: Custom apology message is reflected in preview
  console.log('[Test 2] Custom apology message is reflected in preview');
  const customMsg = 'Custom apology note for expedited handling.';
  const p2Res = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview?customMessage=${encodeURIComponent(customMsg)}`, { headers });
  const p2 = await p2Res.json();
  assert.ok(p2.text.includes(customMsg), 'Preview text should contain custom message');
  assert.ok(p2.html.includes(customMsg), 'Preview html should contain custom message');
  assert.strictEqual(p2.effectiveApologyMessage, customMsg);
  console.log('✓ Test 2 passed');

  // 4. Test 3: Coupon creation validation (rejection of duplicate, invalid, past expiry)
  console.log('[Test 3] Reject invalid, duplicate, or past-expiry coupon configurations');

  // Empty code
  const err1Res = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: '', discountValue: 10 }),
  });
  assert.strictEqual(err1Res.status, 400);

  // Past expiry date
  const err2Res = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: `PAST-${Date.now()}`, discountValue: 10, validTill: '2020-01-01' }),
  });
  assert.strictEqual(err2Res.status, 400);
  const err2Data = await err2Res.json();
  assert.ok(err2Data.error.includes('past'), 'Should reject past expiration');

  // Invalid percentage > 100
  const err3Res = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code: `HIGH-${Date.now()}`, discountType: 'percentage', discountValue: 150 }),
  });
  assert.strictEqual(err3Res.status, 400);

  // 5. Test 4: Successful coupon creation with valid input
  console.log('[Test 4] Successful private coupon creation');
  const uniqueCode = `CARE-AUTO-${Date.now().toString().slice(-6)}`;
  const createRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: uniqueCode,
      discountType: 'percentage',
      discountValue: 15,
      maxRedemptions: 1,
      appliesTo: 'merch',
    }),
  });
  assert.strictEqual(createRes.status, 201, 'Coupon creation failed');
  const createData = await createRes.json();
  assert.strictEqual(createData.success, true);
  assert.strictEqual(createData.coupon.code, uniqueCode);
  assert.strictEqual(createData.coupon.benefit, '15% OFF');
  assert.strictEqual(createData.coupon.assignedUserEmail, 'sowmyaram63@gmail.com');
  assert.strictEqual(createData.coupon.maxRedemptions, 1);
  assert.strictEqual(createData.coupon.remainingUsages, 1);
  const createdCouponId = createData.coupon.id;
  console.log('✓ Test 4 passed');

  // Duplicate rejection
  console.log('[Test 5] Reject duplicate coupon code');
  const dupRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: uniqueCode,
      discountType: 'percentage',
      discountValue: 10,
    }),
  });
  assert.strictEqual(dupRes.status, 409, 'Duplicate code should return 409');
  console.log('✓ Test 5 passed');

  // 6. Test 6: Created coupon appears in eligible list
  console.log('[Test 6] Created coupon appears in eligible compensation coupons list');
  const listRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, { headers });
  const listData = await listRes.json();
  const found = listData.eligibleCoupons.find((c) => c.id === createdCouponId);
  assert.ok(found, 'Created coupon must appear in eligible coupons list');
  assert.strictEqual(found.code, uniqueCode);
  assert.strictEqual(found.benefit, '15% OFF');
  console.log('✓ Test 6 passed');

  // 7. Test 7: Email preview includes created coupon's verified benefit, code, and expiry
  console.log('[Test 7] Email preview with selected coupon includes courtesy paragraph');
  const pWithCouponRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview?couponId=${createdCouponId}`, { headers });
  const pWithCoupon = await pWithCouponRes.json();
  assert.ok(pWithCoupon.text.includes(uniqueCode), 'Text preview must include coupon code');
  assert.ok(pWithCoupon.text.includes('15% OFF'), 'Text preview must include benefit');
  assert.ok(pWithCoupon.text.includes('As a courtesy, we\'ve included your coupon'), 'Text preview must include courtesy paragraph');
  assert.ok(pWithCoupon.html.includes(uniqueCode), 'HTML preview must include coupon code');
  assert.ok(pWithCoupon.html.includes('15% OFF'), 'HTML preview must include benefit');
  assert.ok(pWithCoupon.html.includes('Courtesy Compensation'), 'HTML preview must render Courtesy Compensation box');
  assert.strictEqual(pWithCoupon.selectedCoupon.id, createdCouponId);
  console.log('✓ Test 7 passed');

  // 8. Test 8: Previewing or creating does NOT consume or redeem coupon
  console.log('[Test 8] Coupon is not consumed by creation or preview');
  const checkRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, { headers });
  const checkData = await checkRes.json();
  const cCheck = checkData.eligibleCoupons.find((c) => c.id === createdCouponId);
  assert.strictEqual(cCheck.remainingUsages, 1, 'Remaining usages must still be 1');
  console.log('✓ Test 8 passed');

  // 9. Test 9: Customer-specific restriction enforced at backend checkout validation
  console.log('[Test 9] Private coupon is securely restricted to affected customer at checkout');
  // Attempt to preview/apply coupon as another customer
  const previewOtherUser = await fetch(`${BASE_URL}/api/merch/preview-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      couponCode: uniqueCode,
      customerEmail: 'attacker@example.com',
      subtotalAmountPaise: 500000,
      productIds: [1],
    }),
  });
  assert.strictEqual(previewOtherUser.status, 400, 'Other customer should be rejected');
  const otherErr = await previewOtherUser.json();
  assert.ok(otherErr.error.includes('assigned to another user'), 'Error must specify coupon is assigned to another user');

  // Valid customer email can validate it
  const previewValidUser = await fetch(`${BASE_URL}/api/merch/preview-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      couponCode: uniqueCode,
      customerEmail: 'sowmyaram63@gmail.com',
      subtotalAmountPaise: 500000,
      productIds: [1],
    }),
  });
  assert.strictEqual(previewValidUser.status, 200, 'Target customer email must be accepted');
  const validUserResult = await previewValidUser.json();
  assert.strictEqual(validUserResult.coupon.code, uniqueCode);
  console.log('✓ Test 9 passed');

  // 10. Test 10: Inactive / Invalidated coupon is rejected at send time
  console.log('[Test 10] Inactive coupon is rejected at send time');
  // Deactivate coupon
  await fetch(`${BASE_URL}/api/admin/coupons/${createdCouponId}/active`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: 0 }),
  });
  const sendDeactivatedRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ couponId: createdCouponId }),
  });
  assert.strictEqual(sendDeactivatedRes.status, 400, 'Sending with deactivated coupon must be rejected');
  const sendDeactivatedData = await sendDeactivatedRes.json();
  assert.ok(sendDeactivatedData.error.includes('ineligible') || sendDeactivatedData.error.includes('disabled'), 'Must report coupon is ineligible');

  // Re-activate coupon for dispatch test
  await fetch(`${BASE_URL}/api/admin/coupons/${createdCouponId}/active`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ active: 1 }),
  });
  console.log('✓ Test 10 passed');

  // 11. Test 11: Mocked send dispatch with coupon succeeds and records compensation coupon
  console.log('[Test 11] Mocked send dispatch records compensation coupon and maintains safety guardrails');
  const db = new Database('./booking/data/booking.db');
  db.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'pending', customer_communicated_at = NULL, customer_communication_sent_to = NULL WHERE order_id = ?").run(testOrderId);
  db.close();

  const sendRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-mock-email-success': 'true',
    },
    body: JSON.stringify({
      couponId: createdCouponId,
      customMessage: 'We sincerely apologize for the delay in dispatching your order.',
    }),
  });
  assert.strictEqual(sendRes.status, 200, 'Send email failed');
  const sendData = await sendRes.json();
  assert.strictEqual(sendData.success, true);
  assert.strictEqual(sendData.compensationCoupon.code, uniqueCode);
  assert.strictEqual(sendData.compensationCoupon.benefit, '15% OFF');

  // Check that the coupon usage count is NOT consumed by email dispatch
  const couponAfterSendRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, { headers });
  const couponAfterSendData = await couponAfterSendRes.json();
  const cAfterSend = couponAfterSendData.eligibleCoupons.find((c) => c.id === createdCouponId);
  assert.strictEqual(cAfterSend.remainingUsages, 1, 'Coupon usage must NOT be consumed by sending email');

  // 12. Test 12: Duplicate send prevention and 60-second cooldown protection
  console.log('[Test 12] Cooldown & resend protection prevents immediate re-send without reason');
  const immediateResend = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-mock-email-success': 'true',
    },
    body: JSON.stringify({ couponId: createdCouponId }),
  });
  // Must be rejected because it was already sent and requires confirmResend + reason
  assert.strictEqual(immediateResend.status, 409);

  // Even with confirmResend: true, 60s cooldown blocks rapid dispatch
  const cooldownResend = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/send-email`, {
    method: 'POST',
    headers: {
      ...headers,
      'x-test-mock-email-success': 'true',
    },
    body: JSON.stringify({
      couponId: createdCouponId,
      confirmResend: true,
      resendReason: 'Customer requested updated email copy immediately',
    }),
  });
  assert.strictEqual(cooldownResend.status, 429, 'Cooldown must block sends within 60s');
  console.log('✓ Test 12 passed');

  // 14. Test 14: Selected Products coupon creation, validation, and email preview
  console.log('[Test 14] Selected Products coupon creation, scope formatting, and preview');
  // Validation: empty productIds rejected
  const emptyProdRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: `SEL-EMPTY-${Date.now()}`,
      discountValue: 10,
      appliesTo: 'selected_products',
      productIds: [],
    }),
  });
  assert.strictEqual(emptyProdRes.status, 400, 'Empty productIds should be rejected');

  // Valid creation with selected products
  const selectedCode = `PROD-CARE-${Date.now().toString().slice(-6)}`;
  const selCreateRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/compensation-coupons`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code: selectedCode,
      discountType: 'percentage',
      discountValue: 20,
      validTill: '2026-12-31',
      maxRedemptions: 1,
      appliesTo: 'selected_products',
      productIds: [11, 12], // H2 Molecular Hydrogen Water Bottle (11), H2 Hydrogen Mist Spray (12)
    }),
  });
  assert.strictEqual(selCreateRes.status, 201, 'Selected products coupon creation failed');
  const selCreateData = await selCreateRes.json();
  assert.strictEqual(selCreateData.success, true);
  assert.ok(selCreateData.coupon.scopeLabel.includes('Selected Products'), 'Scope label must include Selected Products');
  assert.ok(selCreateData.coupon.scopeLabel.includes('H2 Hydrogen Mist Spray'), 'Scope label must name selected products');
  const selCouponId = selCreateData.coupon.id;

  // Preview with Selected Products coupon shows product-specific scope
  const selPreviewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview?couponId=${selCouponId}`, { headers });
  const selPreview = await selPreviewRes.json();
  assert.ok(selPreview.text.includes('Selected Products'), 'Text preview must mention selected products scope');
  assert.ok(selPreview.html.includes('Selected Products'), 'HTML preview must render selected products scope');
  console.log('✓ Test 14 passed');

  // 15. Test 15: Checkout validation genuinely restricts to selected products
  console.log('[Test 15] Checkout validation genuinely restricts coupon to selected products');
  // Applying on cart with product 12 (selected)
  const cartWithSelected = await fetch(`${BASE_URL}/api/merch/preview-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      couponCode: selectedCode,
      customerEmail: 'sowmyaram63@gmail.com',
      subtotalAmountPaise: 100000,
      productIds: [12],
      productLineTotals: { '12': 100000 },
    }),
  });
  assert.strictEqual(cartWithSelected.status, 200, 'Selected product must be valid for coupon');
  const validCartData = await cartWithSelected.json();
  assert.strictEqual(validCartData.coupon.discountAmountInr, 200, '20% of ₹1,000 should be ₹200');

  // Applying on cart with product 13 ONLY (unselected product: Hoodie)
  const cartWithUnselected = await fetch(`${BASE_URL}/api/merch/preview-coupon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      couponCode: selectedCode,
      customerEmail: 'sowmyaram63@gmail.com',
      subtotalAmountPaise: 150000,
      productIds: [13],
      productLineTotals: { '13': 150000 },
    }),
  });
  assert.strictEqual(cartWithUnselected.status, 400, 'Unselected product cart must be rejected');
  const unselData = await cartWithUnselected.json();
  assert.ok(unselData.error.includes('not valid'), 'Error must state coupon is not valid');
  console.log('✓ Test 15 passed');

  // 16. Test 16: Delivery estimate dynamic persistence and blank fallback
  console.log('[Test 16] Delivery estimate is loaded dynamically from review and handles blank without fabricating date');
  // Update estimate via authorized review workflow
  const updateEstRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      reviewStatus: 'ready_for_communication',
      revisedDeliveryEstimate: '2026-11-15',
      internalDelayNote: 'Updated supplier confirmation date',
    }),
  });
  assert.strictEqual(updateEstRes.status, 200);

  // Preview reflects updated estimate
  const estPreviewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const estPreview = await estPreviewRes.json();
  assert.strictEqual(estPreview.revisedDeliveryEstimate, '2026-11-15');
  assert.ok(estPreview.text.includes('2026-11-15'), 'Preview text should reflect revised estimate 2026-11-15');

  // Clear estimate via review
  await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      reviewStatus: 'ready_for_communication',
      revisedDeliveryEstimate: '',
      internalDelayNote: 'Supplier timeline pending',
    }),
  });

  const blankEstPreviewRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const blankEstPreview = await blankEstPreviewRes.json();
  assert.strictEqual(blankEstPreview.revisedDeliveryEstimate, null);
  assert.ok(blankEstPreview.text.includes('verified timeline'), 'Blank estimate must use confirmation message');
  assert.ok(!blankEstPreview.text.includes('2026-10-25'), 'Blank estimate must NEVER invent a date');
  console.log('✓ Test 16 passed');

  // 17. Test 17: Resend authorization reason requirements per backend dispatch rules
  console.log('[Test 17] Resend authorization reason field logic (first-time, provider failure, sent, stale, in-flight)');
  const dbTest = new Database('./booking/data/booking.db');

  // Case A: First-time send (pending/null status)
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'pending', customer_communicated_at = NULL WHERE order_id = ?").run(testOrderId);
  const prevFirstTimeRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const prevFirstTime = await prevFirstTimeRes.json();
  assert.strictEqual(prevFirstTime.dispatchMode, 'first_time');
  assert.strictEqual(prevFirstTime.requiresResendReason, false);
  assert.strictEqual(prevFirstTime.buttonLabel, 'Send Customer Delay Email');

  // Case B: Retry after provider failure
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'failed', customer_communicated_at = datetime('now') WHERE order_id = ?").run(testOrderId);
  const prevFailedRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const prevFailed = await prevFailedRes.json();
  assert.strictEqual(prevFailed.dispatchMode, 'retry_failed');
  assert.strictEqual(prevFailed.requiresResendReason, false);
  assert.strictEqual(prevFailed.buttonLabel, 'Retry Sending Customer Delay Email');

  // Case C: Already sent
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'sent', customer_communicated_at = datetime('now', '-2 minutes') WHERE order_id = ?").run(testOrderId);
  const prevSentRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const prevSent = await prevSentRes.json();
  assert.strictEqual(prevSent.dispatchMode, 'resend_authorized');
  assert.strictEqual(prevSent.requiresResendReason, true);
  assert.strictEqual(prevSent.buttonLabel, 'Resend Delay Email');

  // Case D: Stale sending (interrupted / uncertain outcome >= 5 mins)
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'sending', updated_at = datetime('now', '-10 minutes') WHERE order_id = ?").run(testOrderId);
  const prevStaleRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const prevStale = await prevStaleRes.json();
  assert.strictEqual(prevStale.dispatchMode, 'stale_recovery');
  assert.strictEqual(prevStale.requiresResendReason, true);
  assert.strictEqual(prevStale.buttonLabel, 'Authorize Resend (Recover Interrupted Dispatch)');

  // Case E: In-flight sending (< 5 mins)
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'sending', updated_at = datetime('now', '-1 minute') WHERE order_id = ?").run(testOrderId);
  const prevInFlightRes = await fetch(`${BASE_URL}/api/merch/admin/orders/${testOrderId}/stock-shortage/email-preview`, { headers });
  const prevInFlight = await prevInFlightRes.json();
  assert.strictEqual(prevInFlight.dispatchMode, 'in_flight');
  assert.strictEqual(prevInFlight.buttonLabel, 'Sending In Progress...');

  // Reset order 43 back to clean state for normal operation
  dbTest.prepare("UPDATE merch_order_stock_shortages SET customer_communication_status = 'pending', revised_delivery_estimate = '2026-10-25' WHERE order_id = ?").run(testOrderId);
  dbTest.close();
  console.log('✓ Test 17 passed');

  console.log('\n========================================');
  console.log('ALL MODAL, SCOPE & RESEND TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
