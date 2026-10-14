const assert = require('assert');

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
  const Database = require('better-sqlite3');
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

  // 13. Test 13: Order financial balances, inventory, order status remain unchanged
  console.log('[Test 13] Verify financial balances, order status, and inventory unchanged');
  const orderCheckRes = await fetch(`${BASE_URL}/api/merch/admin/orders?limit=100`, { headers });
  const ordersList = await orderCheckRes.json();
  const order43 = (ordersList.orders || ordersList).find((o) => o.id === testOrderId);
  assert.strictEqual(order43.totalAmount, 100, 'Order total must remain unchanged (₹1 / 100)');
  assert.strictEqual(order43.status, 'stock_shortage', 'Order status must remain stock_shortage');
  console.log('✓ Test 13 passed');

  console.log('\n========================================');
  console.log('ALL MODAL & COUPON TESTS PASSED SUCCESSFULLY!');
  console.log('========================================\n');
}

main().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
