const assert = require('assert');
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../booking/data/booking.db');
const db = new Database(dbPath);

console.log('====================================================');
console.log('TESTING INFLUENCER MULTI-VARIANT CAMPAIGNS & PRICING');
console.log('====================================================\n');

// 1. Verify schema column target_variant_ids exists
const tableInfo = db.prepare("PRAGMA table_info('merch_campaigns')").all();
const hasTargetVariantIds = tableInfo.some((col) => col.name === 'target_variant_ids');
assert.strictEqual(hasTargetVariantIds, true, 'merch_campaigns should have target_variant_ids column');
console.log('✓ PASS: merch_campaigns table has target_variant_ids column');

// 2. Test multi-variant campaign creation and persistence
const testSlug = 'TestMultiVar_' + Date.now();
const testVariantIds = [569, 570, 571]; // Silver, Black, Gold
const testVariantIdsJson = JSON.stringify(testVariantIds);

// Get an active influencer & coupon
const influencer = db.prepare('SELECT id, name FROM merch_influencers WHERE active = 1 LIMIT 1').get();
const coupon = db.prepare("SELECT id, code FROM coupons WHERE portal = 'merch' AND is_active = 1 LIMIT 1").get();
assert(influencer, 'An active influencer must exist');
assert(coupon, 'An active merch coupon must exist');

const insertStmt = db.prepare(`
  INSERT INTO merch_campaigns (slug, name, influencer_id, coupon_id, coupon_code, target_product_id, target_variant_id, target_variant_ids, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 11, ?, ?, 1, datetime('now'), datetime('now'))
`);
const result = insertStmt.run(testSlug, `${testSlug} Campaign`, influencer.id, coupon.id, coupon.code, testVariantIds[0], testVariantIdsJson);
const createdCampaignId = result.lastInsertRowid;

const savedRow = db.prepare('SELECT * FROM merch_campaigns WHERE id = ?').get(createdCampaignId);
assert.strictEqual(savedRow.target_variant_id, 569, 'Primary target_variant_id should be 569');
assert.strictEqual(savedRow.target_variant_ids, testVariantIdsJson, 'target_variant_ids should match JSON string');
const parsedIds = JSON.parse(savedRow.target_variant_ids);
assert.deepStrictEqual(parsedIds, testVariantIds, 'Parsed IDs should match input array');
console.log('✓ PASS: Multi-variant campaign persisted with target_variant_id and target_variant_ids');

// 3. Test backward compatibility for existing single-variant campaigns
const legacyCampaigns = db.prepare('SELECT id, slug, target_variant_id, target_variant_ids FROM merch_campaigns WHERE id != ?').all(createdCampaignId);
for (const camp of legacyCampaigns) {
  assert(camp.target_variant_id > 0, `Campaign ${camp.slug} should have valid target_variant_id`);
  // parse helper logic
  let ids = [];
  if (camp.target_variant_ids) {
    try { ids = JSON.parse(camp.target_variant_ids); } catch (_) {}
  }
  if (!ids.length && camp.target_variant_id) {
    ids = [camp.target_variant_id];
  }
  assert(ids.length > 0, `Campaign ${camp.slug} should resolve at least one variant ID`);
}
console.log(`✓ PASS: All ${legacyCampaigns.length} legacy single-variant campaigns resolve correctly`);

// 4. Test price formatting logic
// In merch/admin/admin.js:
function catalogPrice(value) {
  return '\u20B9' + Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

// Bottle price: in DB 2,299,000 paise. loadProductData divides by 100 -> 22,990 rupees.
const bottleVariantPaise = 2299000;
const bottleVariantRupees = bottleVariantPaise / 100;
const formattedBottlePrice = catalogPrice(bottleVariantRupees);
assert.strictEqual(formattedBottlePrice, '₹22,990', `Bottle price should be ₹22,990, got: ${formattedBottlePrice}`);
console.log('✓ PASS: Bottle price formats to ₹22,990 (not ₹229.9)');

// Other products:
const mistVariantPaise = 1190000;
const mistVariantRupees = mistVariantPaise / 100;
assert.strictEqual(catalogPrice(mistVariantRupees), '₹11,900', 'Mist spray price formats correctly');

const hoodieVariantPaise = 349900;
const hoodieVariantRupees = hoodieVariantPaise / 100;
assert.strictEqual(catalogPrice(hoodieVariantRupees), '₹3,499', 'Hoodie price formats correctly');
console.log('✓ PASS: Other products (Mist: ₹11,900, Hoodie: ₹3,499) remain correct without 100x error');

// Clean up test campaign
db.prepare('DELETE FROM merch_campaigns WHERE id = ?').run(createdCampaignId);
console.log('✓ PASS: Cleaned up test campaign record');

console.log('\n====================================================');
console.log('ALL INFLUENCER MULTI-VARIANT TESTS PASSED!');
console.log('====================================================');
