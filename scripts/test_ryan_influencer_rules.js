/**
 * Test Suite: Ryan Influencer Coupon and Commission Validation
 * Tests all 15 scenarios specified in the business requirements.
 */

const express = require('express');
const http = require('http');
const path = require('path');
const db = require('better-sqlite3')(path.join(__dirname, '../booking/data/booking.db'));

// Ensure seed runs
const mountMerchApi = require(path.join(__dirname, '../booking/merch-api'));
const app = express();
app.use(express.json());
mountMerchApi(app, {
  db,
  JWT_SECRET: 'test_jwt_secret',
  getCouponByCode: (code) => {
    const row = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1').get(code);
    if (!row) return null;
    return {
      ...row,
      isActive: Boolean(row.is_active && row.active),
      appliesTo: row.applies_to,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      influencerId: row.influencer_id,
    };
  },
  couponHelpers: {
    normalizeCouponCode: (c) => String(c || '').trim().toUpperCase().replace(/\s+/g, ''),
    recordCouponRedemption: () => {},
    validateCouponForUser: ({ code, subtotalAmountPaise, productIds }) => {
      const row = db.prepare('SELECT * FROM coupons WHERE UPPER(code) = UPPER(?) LIMIT 1').get(code);
      if (!row) return { error: 'Invalid coupon' };
      if (!productIds || !productIds.includes(11)) {
        return { error: 'This coupon is only valid when an item from the selected category is in the cart.' };
      }
      return {
        coupon: {
          ...row,
          isActive: Boolean(row.is_active && row.active),
          appliesTo: row.applies_to,
          discountType: row.discount_type,
          discountValue: row.discount_value,
          influencerId: row.influencer_id,
        },
        couponCode: row.code,
        discountAmountPaise: 115000,
        finalAmountPaise: Math.max(0, subtotalAmountPaise - 115000),
        originalAmountPaise: subtotalAmountPaise,
      };
    },
  },
  getMerchAuthUser: () => null,
  ensureMerchCustomerProfileForUser: () => null,
  recordCouponRedemption: () => {},
  razorpay: null,
  RAZORPAY_KEY_ID: 'rzp_test_mock',
  RAZORPAY_KEY_SECRET: 'mock_secret',
});

// Helper to make local express requests
function post(url, body) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const data = JSON.stringify(body);
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: url,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      }, (res) => {
        let respBody = '';
        res.on('data', chunk => respBody += chunk);
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, data: JSON.parse(respBody) });
          } catch {
            resolve({ status: res.statusCode, raw: respBody });
          }
        });
      });
      req.on('error', (err) => {
        server.close();
        reject(err);
      });
      req.write(data);
      req.end();
    });
  });
}

// Bottle Variant: 169 (Product ID: 11, ₹22,990 = 2,299,000 paise)
// Mist Variant: 173 (Product ID: 12, ₹11,900 = 1,190,000 paise)
const BOTTLE = {
  productId: 11,
  variantId: 169,
  productName: 'H2 Molecular Hydrogen Water Bottle',
  price: 22990,
  unitPrice: 2299000,
  lineTotal: 2299000,
};

const MIST = {
  productId: 12,
  variantId: 173,
  productName: 'H2 Hydrogen Mist Spray',
  price: 11900,
  unitPrice: 1190000,
  lineTotal: 1190000,
};

function buildCart(bottleQty, mistQty) {
  const items = [];
  if (bottleQty > 0) {
    items.push({
      ...BOTTLE,
      quantity: bottleQty,
      lineTotal: bottleQty * 2299000,
    });
  }
  if (mistQty > 0) {
    items.push({
      ...MIST,
      quantity: mistQty,
      lineTotal: mistQty * 1190000,
    });
  }
  const subtotalPaise = (bottleQty * 2299000) + (mistQty * 1190000);
  return { items, subtotalPaise };
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING RYAN INFLUENCER & COMMISSION VALIDATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST CASE 1: 1 Individual Bottle
  console.log('--- TEST CASE 1: One individual bottle ---');
  {
    const { items, subtotalPaise } = buildCart(1, 0);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 1150, 'Ryan discount is ₹1,150');
    assert(res.data.coupon?.bundleDiscountInr === 0, 'Bundle discount is ₹0');
    assert(res.data.coupon?.commissionAmountInr === 2300, 'Ryan commission is ₹2,300');
  }

  // TEST CASE 2: Two individual bottles
  console.log('\n--- TEST CASE 2: Two individual bottles ---');
  {
    const { items, subtotalPaise } = buildCart(2, 0);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 2300, 'Ryan discount is ₹2,300 total (2 x ₹1,150)');
    assert(res.data.coupon?.bundleDiscountInr === 0, 'Bundle discount is ₹0');
    assert(res.data.coupon?.commissionAmountInr === 4600, 'Ryan commission is ₹4,600 total (2 x ₹2,300)');
  }

  // TEST CASE 3: One bottle + one mist forming a bundle
  console.log('\n--- TEST CASE 3: One bottle + one mist forming a bundle ---');
  {
    const { items, subtotalPaise } = buildCart(1, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 0, 'Ryan customer discount is ₹0 (bundled bottle gets bundle discount, not Ryan discount)');
    assert(res.data.coupon?.bundleDiscountInr === 5234, 'Bundle discount is ₹5,233.50 (rounded to ₹5,234 in preview INR)');
    assert(res.data.coupon?.commissionAmountInr === 2300, 'Ryan commission is ₹2,300 (Ryan STILL receives commission for bundled bottle)');
  }

  // TEST CASE 4: Two bottles + one mist
  console.log('\n--- TEST CASE 4: Two bottles + one mist ---');
  {
    const { items, subtotalPaise } = buildCart(2, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 1150, 'Remaining individual bottle Ryan discount = ₹1,150');
    assert(res.data.coupon?.bundleDiscountInr === 5234, 'Bundle discount = ₹5,233.50');
    assert((res.data.coupon?.bundleDiscountInr + res.data.coupon?.discountAmountInr) >= 6383, 'Total customer discount is ₹6,383.50');
    assert(res.data.coupon?.commissionAmountInr === 4600, 'Total Ryan commission = ₹4,600 (Bundle bottle: ₹2,300 + Ind bottle: ₹2,300)');
  }

  // TEST CASE 5: One bundle + two individual bottles (Bottle x 3, Mist x 1)
  console.log('\n--- TEST CASE 5: One bundle + two individual bottles ---');
  {
    const { items, subtotalPaise } = buildCart(3, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 2300, 'Ryan discount for 2 individual bottles = ₹2,300');
    assert(res.data.coupon?.bundleDiscountInr === 5234, 'Bundle discount = ₹5,233.50');
    assert((res.data.coupon?.bundleDiscountInr + res.data.coupon?.discountAmountInr) >= 7533, 'Total customer discount is ₹7,533.50');
    assert(res.data.coupon?.commissionAmountInr === 6900, 'Total Ryan commission = 3 x ₹2,300 = ₹6,900');
  }

  // TEST CASE 6: Multiple bundles (Bottle x 2, Mist x 2)
  console.log('\n--- TEST CASE 6: Multiple bundles (Bottle x 2, Mist x 2) ---');
  {
    const { items, subtotalPaise } = buildCart(2, 2);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.discountAmountInr === 0, 'Ryan customer discount = ₹0 (both bottles are bundled)');
    assert(res.data.coupon?.bundleDiscountInr === 10467, 'Bundle discount applies to both bundles (2 x ₹5,233.50 = ₹10,467)');
    assert(res.data.coupon?.commissionAmountInr === 4600, 'Total Ryan commission = 2 x ₹2,300 = ₹4,600');
  }

  // TEST CASE 7: Bundle + individual mist/bottle combinations (Bottle x 3, Mist x 2)
  console.log('\n--- TEST CASE 7: Bottle x 3, Mist x 2 ---');
  {
    const { items, subtotalPaise } = buildCart(3, 2);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.status === 200, 'Status is 200');
    assert(res.data.coupon?.bundleCount === 2, '2 qualifying bundles');
    assert(res.data.coupon?.individualBottleCount === 1, '1 individual bottle');
    assert(res.data.coupon?.bundleDiscountInr === 10467, '2 bundle discounts = ₹10,467');
    assert(res.data.coupon?.discountAmountInr === 1150, '1 Ryan individual bottle discount = ₹1,150');
    assert((res.data.coupon?.bundleDiscountInr + res.data.coupon?.discountAmountInr) === 11617, 'Total customer discount = ₹11,617');
    assert(res.data.coupon?.commissionAmountInr === 6900, 'Total Ryan commission = 3 x ₹2,300 = ₹6,900');
  }

  // TEST CASE 8: Bundle discount must not stack with Ryan customer discount
  console.log('\n--- TEST CASE 8: No discount stacking on same bottle ---');
  {
    const { items, subtotalPaise } = buildCart(1, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.data.coupon?.discountAmountInr === 0, 'Customer discount on bundled bottle is ₹0 (not stacked)');
    assert(res.data.coupon?.bundleDiscountInr > 0, 'Bundle discount applied');
    assert(res.data.coupon?.commissionAmountInr === 2300, 'Ryan commission is ₹2,300');
  }

  // TEST CASE 9: Ryan commission when Ryan customer discount is not applied
  console.log('\n--- TEST CASE 9: Commission independent of customer discount ---');
  {
    const { items, subtotalPaise } = buildCart(1, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.data.coupon?.discountAmountInr === 0, 'Ryan customer discount is NOT applied');
    assert(res.data.coupon?.commissionAmountInr === 2300, 'Ryan STILL receives ₹2,300 commission');
  }

  // TEST CASE 10: Ryan attribution with no qualifying bundle
  console.log('\n--- TEST CASE 10: Ryan attribution with no qualifying bundle ---');
  {
    const { items, subtotalPaise } = buildCart(1, 0);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.data.coupon?.discountAmountInr === 1150, 'Ryan discount is ₹1,150');
    assert(res.data.coupon?.commissionAmountInr === 2300, 'Ryan commission is ₹2,300');
  }

  // TEST CASE 11: Ryan attribution with mixed bundled and individual bottles
  console.log('\n--- TEST CASE 11: Mixed bundled and individual bottles ---');
  {
    const { items, subtotalPaise } = buildCart(3, 1);
    const res = await post('/api/merch/preview-coupon', {
      couponCode: 'RYAN',
      items,
      subtotalAmountPaise: subtotalPaise,
    });
    assert(res.data.coupon?.bundleDiscountInr === 5234, 'Bundle discount = ₹5,233.50');
    assert(res.data.coupon?.discountAmountInr === 2300, 'Ryan discount = ₹2,300');
    assert((res.data.coupon?.bundleDiscountInr + res.data.coupon?.discountAmountInr) >= 7533, 'Total customer discount = ₹7,533.50');
    assert(res.data.coupon?.commissionAmountInr === 6900, 'Total Ryan commission = ₹6,900');
  }

  // TEST CASE 12: Cart quantity changes
  console.log('\n--- TEST CASE 12: Cart quantity changes step-by-step ---');
  {
    // Step a: Bottle x 1, Mist x 1
    const cartA = buildCart(1, 1);
    const resA = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartA.items, subtotalAmountPaise: cartA.subtotalPaise });
    assert(resA.data.coupon?.bundleCount === 1, 'Step A: 1 bundle');
    assert(resA.data.coupon?.individualBottleCount === 0, 'Step A: 0 individual bottles');
    assert(resA.data.coupon?.discountAmountInr === 0, 'Step A: Ryan discount = ₹0');
    assert(resA.data.coupon?.commissionAmountInr === 2300, 'Step A: Ryan commission = ₹2,300');

    // Step b: Increase bottle quantity to 2
    const cartB = buildCart(2, 1);
    const resB = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartB.items, subtotalAmountPaise: cartB.subtotalPaise });
    assert(resB.data.coupon?.bundleCount === 1, 'Step B: 1 bundle');
    assert(resB.data.coupon?.individualBottleCount === 1, 'Step B: 1 individual bottle');
    assert(resB.data.coupon?.discountAmountInr === 1150, 'Step B: Ryan discount = ₹1,150');
    assert(resB.data.coupon?.commissionAmountInr === 4600, 'Step B: Ryan commission = ₹4,600');

    // Step c: Increase bottle quantity to 3
    const cartC = buildCart(3, 1);
    const resC = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartC.items, subtotalAmountPaise: cartC.subtotalPaise });
    assert(resC.data.coupon?.bundleCount === 1, 'Step C: 1 bundle');
    assert(resC.data.coupon?.individualBottleCount === 2, 'Step C: 2 individual bottles');
    assert(resC.data.coupon?.discountAmountInr === 2300, 'Step C: Ryan discount = ₹2,300');
    assert(resC.data.coupon?.commissionAmountInr === 6900, 'Step C: Ryan commission = ₹6,900');
  }

  // TEST CASE 13: Remove mist from a bundle
  console.log('\n--- TEST CASE 13: Remove mist from bundle ---');
  {
    // Start with 1 bundle
    const cartStart = buildCart(1, 1);
    const resStart = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartStart.items, subtotalAmountPaise: cartStart.subtotalPaise });
    assert(resStart.data.coupon?.discountAmountInr === 0, 'Start: Ryan discount = ₹0');

    // Remove mist -> Bottle is now individual
    const cartRemoved = buildCart(1, 0);
    const resRemoved = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartRemoved.items, subtotalAmountPaise: cartRemoved.subtotalPaise });
    assert(resRemoved.data.coupon?.bundleCount === 0, 'Removed: 0 bundles');
    assert(resRemoved.data.coupon?.individualBottleCount === 1, 'Removed: 1 individual bottle');
    assert(resRemoved.data.coupon?.discountAmountInr === 1150, 'Removed: Ryan discount ₹1,150 applies');
    assert(resRemoved.data.coupon?.commissionAmountInr === 2300, 'Removed: Ryan commission remains ₹2,300');
  }

  // TEST CASE 14: Remove bottle from bundle
  console.log('\n--- TEST CASE 14: Remove bottle from bundle ---');
  {
    const cartOnlyMist = buildCart(0, 1);
    const resOnlyMist = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cartOnlyMist.items, subtotalAmountPaise: cartOnlyMist.subtotalPaise });
    assert(resOnlyMist.status === 400 || !resOnlyMist.data.coupon, 'Removed bottle: Coupon rejects or returns error for mist-only cart');
    assert(resOnlyMist.data?.error?.includes('Hydrogen Water Bottle') || resOnlyMist.data?.error?.includes('category'), 'Accurate error message shown');
  }

  // TEST CASE 15: Ryan commission scales by bottle quantity
  console.log('\n--- TEST CASE 15: Commission scales by bottle quantity ---');
  {
    for (let q = 1; q <= 4; q++) {
      const cart = buildCart(q, 0);
      const res = await post('/api/merch/preview-coupon', { couponCode: 'RYAN', items: cart.items, subtotalAmountPaise: cart.subtotalPaise });
      const expectedCommission = q * 2300;
      assert(res.data.coupon?.commissionAmountInr === expectedCommission, `${q} bottle(s) -> ₹${expectedCommission.toLocaleString()} commission`);
    }
  }

  // TEST SUPPORT FOR RYAN100 AND RYANH2 CODES
  console.log('\n--- BONUS: Testing code RYANH2 and RYAN100 ---');
  {
    const cart = buildCart(1, 0);
    const resH2 = await post('/api/merch/preview-coupon', { couponCode: 'RYANH2', items: cart.items, subtotalAmountPaise: cart.subtotalPaise });
    assert(resH2.status === 200 && resH2.data.coupon?.discountAmountInr === 1150, 'RYANH2 gives ₹1,150 discount');
    assert(resH2.data.coupon?.commissionAmountInr === 2300, 'RYANH2 gives ₹2,300 commission');

    const res100 = await post('/api/merch/preview-coupon', { couponCode: 'RYAN100', items: cart.items, subtotalAmountPaise: cart.subtotalPaise });
    assert(res100.status === 200 && res100.data.coupon?.discountAmountInr === 1150, 'RYAN100 gives ₹1,150 discount');
    assert(res100.data.coupon?.commissionAmountInr === 2300, 'RYAN100 gives ₹2,300 commission');
  }

  console.log('\n====================================================');
  console.log(`TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
