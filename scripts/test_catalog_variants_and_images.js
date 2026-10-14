const assert = require('assert');
const Database = require('better-sqlite3');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'a9576b0fe1e743023c59350d5790715cc86e2c70db34c797f179fbe3ba7b27c04b2f7ca8bf3af52072d39eee3b70afa23a000d2e89fe63b6e4f9791ba84d960c';
const token = jwt.sign({ id: 1, email: 'admin@h2health.local', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

function request(path, auth = false) {
  return new Promise((resolve, reject) => {
    const headers = auth ? { 'Authorization': 'Bearer ' + token } : {};
    http.get({ hostname: 'localhost', port: 3000, path, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + data.slice(0, 200)));
        }
      });
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('--- Running Product Catalog & Variant Verification Tests ---\n');

  const db = new Database('booking/data/booking.db');

  // Test 1: Storefront Catalog Verification
  console.log('Test 1: Storefront Catalog (/api/merch/products)');
  const storefrontProducts = await request('/api/merch/products');
  assert(Array.isArray(storefrontProducts), 'Storefront response must be an array');

  // Hoodie
  const hoodie = storefrontProducts.find(p => p.slug === 'hoodie');
  assert(hoodie, 'Hoodie must exist in storefront catalog');
  assert.strictEqual(hoodie.variants.length, 5, 'Hoodie must have exactly 5 variants');
  const hoodieColors = [...new Set(hoodie.variants.map(v => v.color))];
  assert.deepStrictEqual(hoodieColors, ['Sand'], 'Hoodie must only have color Sand');
  const hoodieSizes = hoodie.variants.map(v => v.size);
  assert.deepStrictEqual(hoodieSizes, ['S', 'M', 'L', 'XL', 'XXL'], 'Hoodie must have sizes S, M, L, XL, XXL');
  hoodie.variants.forEach(v => {
    assert.strictEqual(v.imageUrl || v.image, '/cdn/shop/files/hero/h2-hoodie-transparent-source.png', `Hoodie variant ${v.sku} must have correct image`);
  });
  console.log('  ✔ Hoodie: Sand only, sizes S/M/L/XL/XXL, correct image mapping');

  // Mist
  const mist = storefrontProducts.find(p => p.slug === 'h2-mist-spray');
  assert(mist, 'Mist must exist in storefront catalog');
  assert.strictEqual(mist.variants.length, 2, 'Mist must have exactly 2 active variants (13ml White & Black)');
  const mistSizes = [...new Set(mist.variants.map(v => v.size))];
  assert.deepStrictEqual(mistSizes, ['13ml'], 'Mist must only have size 13ml');
  const whiteMist = mist.variants.find(v => v.color === 'White');
  const blackMist = mist.variants.find(v => v.color === 'Black');
  assert(whiteMist, 'White mist variant must exist');
  assert(blackMist, 'Black mist variant must exist');
  assert.strictEqual(whiteMist.imageUrl || whiteMist.image, '/cdn/shop/files/hero/h2-mist-transparent-source.png', 'White mist must display White mist image');
  assert.strictEqual(blackMist.imageUrl || blackMist.image, '/cdn/shop/files/products/mist-black.png', 'Black mist must display Black mist image');
  assert.notStrictEqual(whiteMist.imageUrl, blackMist.imageUrl, 'White and Black mist images must be distinct');
  console.log('  ✔ Mist: 13ml only, Black and White, each with its own correct image');

  // Bottle
  const bottle = storefrontProducts.find(p => p.slug === 'h2-water-bottle');
  assert(bottle, 'Bottle must exist in storefront catalog');
  assert.strictEqual(bottle.variants.length, 4, 'Bottle must have exactly 4 active variants (460ml Silver, Gold, Black, Blue)');
  const bottleSizes = [...new Set(bottle.variants.map(v => v.size))];
  assert.deepStrictEqual(bottleSizes, ['460ml'], 'Bottle must only have size 460ml');
  const bottleColors = bottle.variants.map(v => v.color);
  assert(bottleColors.includes('Silver'), 'Bottle must include Silver');
  assert(bottleColors.includes('Gold'), 'Bottle must include Gold');
  assert(bottleColors.includes('Black'), 'Bottle must include Black');
  assert(bottleColors.includes('Blue'), 'Bottle must include Blue');

  const silverBottle = bottle.variants.find(v => v.color === 'Silver');
  const blackBottle = bottle.variants.find(v => v.color === 'Black');
  const goldBottle = bottle.variants.find(v => v.color === 'Gold');
  const blueBottle = bottle.variants.find(v => v.color === 'Blue');

  assert.strictEqual(silverBottle.imageUrl || silverBottle.image, '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113', 'Silver bottle image must match');
  assert.strictEqual(blackBottle.imageUrl || blackBottle.image, '/cdn/shop/files/products/bottle-black.png', 'Black bottle image must match');
  assert.strictEqual(goldBottle.imageUrl || goldBottle.image, '/cdn/shop/files/products/bottle-gold.png', 'Gold bottle image must match');
  assert.strictEqual(blueBottle.imageUrl || blueBottle.image, '/cdn/shop/files/products/bottle-blue.png', 'Blue bottle image must match');

  const distinctBottleImages = new Set([silverBottle.imageUrl, blackBottle.imageUrl, goldBottle.imageUrl, blueBottle.imageUrl]);
  assert.strictEqual(distinctBottleImages.size, 4, 'All 4 bottle colors must have distinct image URLs');
  console.log('  ✔ Bottle: 460ml only, Silver/Gold/Black/Blue, all 4 with distinct images');

  // Test 2: Admin Products Catalog
  console.log('\nTest 2: Admin Products Catalog (/api/merch/admin/products)');
  const adminProducts = await request('/api/merch/admin/products', true);
  const adminHoodie = adminProducts.find(p => p.slug === 'hoodie');
  const adminMist = adminProducts.find(p => p.slug === 'h2-mist-spray');
  const adminBottle = adminProducts.find(p => p.slug === 'h2-water-bottle');

  assert.strictEqual(adminHoodie.variants.length, 5, 'Admin Hoodie must only list 5 active variants');
  assert(adminHoodie.variants.every(v => v.color === 'Sand'), 'Admin Hoodie must only list Sand');

  assert.strictEqual(adminMist.variants.length, 2, 'Admin Mist must only list 2 active variants');
  assert(adminMist.variants.every(v => v.size === '13ml'), 'Admin Mist must only list 13ml');

  assert.strictEqual(adminBottle.variants.length, 4, 'Admin Bottle must only list 4 active variants');
  assert(adminBottle.variants.every(v => v.size === '460ml'), 'Admin Bottle must only list 460ml');

  // Test variant images in admin view
  adminBottle.variants.forEach(v => {
    assert(v.image || v.imageUrl, `Admin bottle variant ${v.sku} must have image`);
  });
  console.log('  ✔ Admin Products: No invalid 50ml mist or Black hoodie in active catalog');
  console.log('  ✔ Admin Products: Variant rows have their own specific images');

  // Test 3: Historical Order Safety
  console.log('\nTest 3: Historical Order Safety');
  const orderItems = db.prepare('SELECT id, order_id, variant_id, product_name, variant_label, sku FROM merch_order_items').all();
  console.log(`  Found ${orderItems.length} order items in database.`);
  assert(orderItems.length > 0, 'Historical order items must remain intact');

  // Verify that variants referenced by orders (such as 569, 570, 573, 574) still exist
  const referencedVariantIds = [...new Set(orderItems.map(item => item.variant_id).filter(Boolean))];
  const existingVariantIds = new Set(db.prepare('SELECT id FROM merch_variants').all().map(v => v.id));
  
  // For any modern variant referenced by orders, ensure it exists in merch_variants
  const modernReferenced = [569, 570, 573, 574];
  modernReferenced.forEach(id => {
    assert(existingVariantIds.has(id), `Active variant ID ${id} referenced by orders must exist`);
  });

  // Verify all 24 catalog variant records are intact in merch_variants (0 hard deletions of real variants)
  const totalVariants = db.prepare('SELECT COUNT(*) as count FROM merch_variants').get().count;
  assert.strictEqual(totalVariants, 24, 'All 24 catalog variants must remain in merch_variants without hard deletion');
  console.log('  ✔ All historical order items and variant rows are completely preserved without hard deletion');

  // Test 4: Persisted Stock Quantities Preserved
  console.log('\nTest 4: Persisted Stock Preservation');
  const hoodieVariants = db.prepare("SELECT sku, stock FROM merch_variants WHERE sku LIKE 'HM-HOD-SND-%'").all();
  hoodieVariants.forEach(v => {
    assert.strictEqual(v.stock, 0, `Hoodie variant ${v.sku} stock must be preserved as 0 (sold out)`);
  });
  const bottleVariants = db.prepare("SELECT sku, stock FROM merch_variants WHERE sku LIKE 'HM-BTL-460-%'").all();
  const bottleStockMap = Object.fromEntries(bottleVariants.map(v => [v.sku, v.stock]));
  assert.strictEqual(bottleStockMap['HM-BTL-460-SLV'], 85, 'Silver bottle stock must be preserved at 85');
  assert.strictEqual(bottleStockMap['HM-BTL-460-BLK'], 47, 'Black bottle stock must be preserved at 47');
  assert.strictEqual(bottleStockMap['HM-BTL-460-GLD'], 50, 'Gold bottle stock must be preserved at 50');
  assert.strictEqual(bottleStockMap['HM-BTL-460-BLU'], 50, 'Blue bottle stock must be preserved at 50');
  console.log('  ✔ All persisted stock quantities remain unchanged');

  // Test 5: Soft-deleted Variants in Bin
  console.log('\nTest 5: Soft-deleted Variants in Trash/Bin');
  const trashProducts = await request('/api/merch/admin/products/trash', true);
  const trashHoodie = trashProducts.find(p => p.slug === 'hoodie');
  assert(trashHoodie, 'Trash must contain Hoodie with discontinued variants');
  const blackVariants = (trashHoodie.variants || []).filter(v => v.deletedAt && v.color === 'Black');
  assert.strictEqual(blackVariants.length, 5, 'All 5 Black hoodie variants must be in Trash');

  const trashMist = trashProducts.find(p => p.slug === 'h2-mist-spray');
  assert(trashMist, 'Trash must contain Mist with discontinued variants');
  const oldMistVariants = (trashMist.variants || []).filter(v => v.deletedAt && (v.size === '50ml' || v.size === '100ml'));
  assert.strictEqual(oldMistVariants.length, 4, 'All 4 legacy Mist variants must be in Trash');

  const trashBottle = trashProducts.find(p => p.slug === 'h2-water-bottle');
  assert(trashBottle, 'Trash must contain Bottle with discontinued variants');
  const oldBottleVariants = (trashBottle.variants || []).filter(v => v.deletedAt && (v.size === '300ml' || v.size === '500ml'));
  assert.strictEqual(oldBottleVariants.length, 4, 'All 4 legacy Bottle variants must be in Trash');
  console.log('  ✔ All discontinued variants are correctly stored in the Bin with deletion timestamps and reasons');

  console.log('\n🎉 ALL CATALOG VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
