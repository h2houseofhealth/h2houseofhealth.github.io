/**
 * House Merch API Routes
 * Mounts on the existing Express server for merchandise e-commerce.
 * Uses the same Razorpay keys, JWT, and SQLite DB as the booking portal.
 */
'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const express = require('express');
const FormData = require('form-data');
const router = express.Router();

const MERCH_HYPE_LABELS = [
  'Most Selling Product',
  'Limited Stock — Hurry Up',
  'Customer Favorite',
  'Best Rated',
  'Trending Now',
  'Most Loved',
  'Popular Choice',
  'Custom Label',
];

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  puppeteer = null;
}

module.exports = function mountMerchApi(app, { db, razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, JWT_SECRET, jwt, sendMerchEmail = null, couponHelpers = {}, merchImageUpload = null }) {
  const {
    normalizeCouponCode,
    validateCouponForUser,
    recordCouponRedemption,
  } = couponHelpers;

  // ─── Merch Database Schema (run once) ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_influencers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      handle TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      avatar_url TEXT,
      bio TEXT,
      social_links_json TEXT,
      preferred_payment_details TEXT,
      commission_rate REAL NOT NULL DEFAULT 10,
      commission_per_order_paise INTEGER NOT NULL DEFAULT 0,
      paid_commission INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      specifications_json TEXT,
      category TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      image_url TEXT,
      images_json TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      gst_rate INTEGER NOT NULL DEFAULT 18,
      weight_grams INTEGER NOT NULL DEFAULT 0,
      combo_purchase INTEGER NOT NULL DEFAULT 0,
      is_combo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Product specifications are optional so existing databases continue to work.
  if (!hasColumn('merch_products', 'specifications_json')) {
    db.exec('ALTER TABLE merch_products ADD COLUMN specifications_json TEXT');
  }
  if (!hasColumn('merch_products', 'images_json')) {
    db.exec('ALTER TABLE merch_products ADD COLUMN images_json TEXT');
  }
  if (!hasColumn('merch_products', 'combo_purchase')) {
    db.exec('ALTER TABLE merch_products ADD COLUMN combo_purchase INTEGER NOT NULL DEFAULT 0');
  }
  if (!hasColumn('merch_products', 'is_combo')) {
    db.exec('ALTER TABLE merch_products ADD COLUMN is_combo INTEGER NOT NULL DEFAULT 0');
  }
  // combo_purchase was the old flag-only implementation. Real combo cards
  // are represented by is_combo products and their component rows below.
  db.prepare('UPDATE merch_products SET combo_purchase = 0 WHERE is_combo = 0').run();

  // Backfill the supplied specification sheets for products created by older releases.
  const specificationBackfill = [
    ['bottle', { 'Product Name': 'Hydrogen-Rich Water Bottle', Capacity: '460ml', 'Electrolytic Material': 'Platinum-Titanium', 'Membrane Electrode': 'PEM + SPE', 'Main Material': 'Glass', 'Shell Material': 'Stainless Steel', 'Battery Type': '700mAh Lithium Polymer', 'Working Time': '5 minutes per cycle (3,000+ ppb)', Size: 'Ø7cm × 24cm', 'Colours Available': 'Blue / Black / Silver / Gold' }],
    ['mist', { 'Product Name': 'Hydrogen Mist Sprayer', 'Atomisation Amount': '0.8–1.2 ml/min', 'Hydrogen Concentration': '1000 ppb', 'Water Tank Capacity': '13ml', 'Main Material': 'PC (Polycarbonate)', 'Negative Potential': '< −300mV', 'Battery Capacity': '500mAh', 'Power Supply': 'DC 5V / Micro USB' }],
    ['hoodie', { 'Product type': 'Premium pullover hoodie', Fabric: '450 GSM organic cotton blend', Fit: 'Structured relaxed fit', Care: 'Machine wash cold; air dry' }],
  ];
  for (const [match, specifications] of specificationBackfill) {
    db.prepare(`UPDATE merch_products SET specifications_json = ? WHERE specifications_json IS NULL AND (lower(slug) LIKE ? OR lower(name) LIKE ?)`)
      .run(JSON.stringify(specifications), `%${match}%`, `%${match}%`);
  }

  // Restore product photography for records created by the earlier service-image fallback.
  db.prepare("UPDATE merch_products SET image_url = ? WHERE image_url = '/booking/assets/service-hydrogen-session.jpg'")
    .run('/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113');
  db.prepare("UPDATE merch_products SET image_url = ? WHERE image_url = '/booking/assets/service-iv-shots.jpg'")
    .run('/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138');

  // Replace the generic placeholder used by older catalog rows with the
  // product photography stored in the CDN files directory.
  db.prepare("UPDATE merch_products SET image_url = ? WHERE lower(category) = 'hoodies' AND (image_url IS NULL OR image_url LIKE '%merch%signup%image%')")
    .run('/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146');
  db.prepare("UPDATE merch_products SET image_url = ? WHERE lower(category) = 'bottles' AND (image_url IS NULL OR image_url LIKE '%merch%signup%image%')")
    .run('/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113');
  db.prepare("UPDATE merch_products SET image_url = ? WHERE lower(category) = 'sprays' AND (image_url IS NULL OR image_url LIKE '%merch%signup%image%')")
    .run('/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138');

  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES merch_products(id),
      sku TEXT NOT NULL UNIQUE,
      size TEXT,
      color TEXT,
      price INTEGER NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Restore the bundled hoodie catalog if it was removed by the previous
  // soft-delete implementation. Only restore products whose entire variant
  // set is inactive, so later admin stock edits are never overwritten.
  const bundledHoodieSlugs = ['zenith-hoodie-black', 'zenith-hoodie-sand'];
  for (const slug of bundledHoodieSlugs) {
    const hoodie = db.prepare(`
      SELECT p.id
      FROM merch_products p
      WHERE p.slug = ?
        AND p.is_active = 0
        AND EXISTS (SELECT 1 FROM merch_variants v WHERE v.product_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM merch_variants v WHERE v.product_id = p.id AND v.is_active = 1)
    `).get(slug);
    if (!hoodie) continue;
    db.transaction(() => {
      db.prepare("UPDATE merch_products SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(hoodie.id);
      db.prepare('UPDATE merch_variants SET is_active = 1, stock = 35 WHERE product_id = ?').run(hoodie.id);
    })();
  }

  // Restore the other bundled merch products if they were removed by the
  // previous admin delete flow. Existing stock values are preserved.
  const bundledProductRestores = [
    {
      name: 'H2 Molecular Hydrogen Water Bottle',
      slug: 'h2-water-bottle',
      description: 'Portable PEM/SPE electrolysis bottle. Generates hydrogen-rich water in 3 minutes. BPA-free, USB-C rechargeable.',
      category: 'bottles',
      basePrice: 649900,
      image: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113',
      weight: 380,
      variants: [
        ['HM-BTL-300-SLV', '300ml', 'Silver', 699900, 40],
        ['HM-BTL-500-SLV', '500ml', 'Silver', 649900, 35],
        ['HM-BTL-300-BLK', '300ml', 'Black', 749900, 30],
        ['HM-BTL-500-BLK', '500ml', 'Black', 849900, 25],
      ],
    },
    {
      name: 'H2 Hydrogen Mist Spray',
      slug: 'h2-mist-spray',
      description: 'Compact hydrogen mist spray for skin rejuvenation. Antioxidant-rich hydrogen water delivery.',
      category: 'sprays',
      basePrice: 249900,
      image: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138',
      weight: 150,
      variants: [
        ['HM-SPR-050-WHT', '50ml', 'White', 249900, 50],
        ['HM-SPR-100-WHT', '100ml', 'White', 349900, 40],
        ['HM-SPR-050-RSG', '50ml', 'Rose Gold', 279900, 35],
        ['HM-SPR-100-RSG', '100ml', 'Rose Gold', 379900, 30],
      ],
    },
  ];
  const restoreProduct = db.transaction((product) => {
    let row = db.prepare('SELECT id FROM merch_products WHERE slug = ?').get(product.slug);
    if (!row) {
      const result = db.prepare(`
        INSERT INTO merch_products (name, slug, description, category, base_price, image_url, gst_rate, weight_grams, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 18, ?, 1)
      `).run(product.name, product.slug, product.description, product.category, product.basePrice, product.image, product.weight);
      row = { id: Number(result.lastInsertRowid) };
    } else {
      db.prepare("UPDATE merch_products SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(row.id);
    }
    const insertVariant = db.prepare('INSERT OR IGNORE INTO merch_variants (product_id, sku, size, color, price, stock) VALUES (?, ?, ?, ?, ?, ?)');
    const activateVariant = db.prepare('UPDATE merch_variants SET is_active = 1 WHERE product_id = ? AND sku = ?');
    product.variants.forEach(([sku, size, color, price, stock]) => {
      insertVariant.run(row.id, sku, size, color, price, stock);
      activateVariant.run(row.id, sku);
    });
  });
  bundledProductRestores.forEach(restoreProduct);

  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_combo_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      combo_product_id INTEGER NOT NULL REFERENCES merch_products(id) ON DELETE CASCADE,
      component_product_id INTEGER NOT NULL REFERENCES merch_products(id),
      component_variant_id INTEGER NOT NULL REFERENCES merch_variants(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      UNIQUE(combo_product_id, component_variant_id)
    );

    CREATE TABLE IF NOT EXISTS merch_product_hypes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL UNIQUE REFERENCES merch_products(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      custom_label TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      guest_name TEXT,
      guest_email TEXT,
      guest_phone TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal INTEGER NOT NULL,
      gst_amount INTEGER NOT NULL DEFAULT 0,
      shipping_charge INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      coupon_id INTEGER REFERENCES coupons(id),
      coupon_code TEXT,
      influencer_id INTEGER REFERENCES merch_influencers(id),
      commission_amount_paise INTEGER NOT NULL DEFAULT 0,
      commission_snapshot_at TEXT,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'online',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      shipping_address TEXT,
      billing_address TEXT,
      tracking_number TEXT,
      carrier_name TEXT,
      delivered_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES merch_orders(id),
      variant_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      variant_label TEXT NOT NULL,
      sku TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      line_total INTEGER NOT NULL
      ,commission_amount_paise INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS merch_influencer_commission_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      influencer_id INTEGER NOT NULL REFERENCES merch_influencers(id) ON DELETE CASCADE,
      amount_paise INTEGER NOT NULL,
      payment_method TEXT,
      reference_number TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  if (!hasColumn('merch_orders', 'commission_amount_paise')) db.exec('ALTER TABLE merch_orders ADD COLUMN commission_amount_paise INTEGER NOT NULL DEFAULT 0');
  if (!hasColumn('merch_orders', 'commission_snapshot_at')) db.exec('ALTER TABLE merch_orders ADD COLUMN commission_snapshot_at TEXT');
  if (!hasColumn('merch_order_items', 'commission_amount_paise')) db.exec('ALTER TABLE merch_order_items ADD COLUMN commission_amount_paise INTEGER NOT NULL DEFAULT 0');
  db.exec("UPDATE merch_orders SET commission_amount_paise = COALESCE((SELECT commission_per_order_paise FROM merch_influencers WHERE merch_influencers.id = merch_orders.influencer_id), 0), commission_snapshot_at = datetime('now') WHERE commission_snapshot_at IS NULL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS merch_customer_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      mobile TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_customer_addresses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES merch_customer_profiles(id) ON DELETE CASCADE,
      label TEXT,
      recipient_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT,
      city TEXT,
      state TEXT,
      postal_code TEXT,
      country TEXT NOT NULL DEFAULT 'India',
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_customer_cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES merch_customer_profiles(id) ON DELETE CASCADE,
      variant_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, variant_id)
    );

    CREATE TABLE IF NOT EXISTS merch_customer_wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES merch_customer_profiles(id) ON DELETE CASCADE,
      product_id INTEGER,
      variant_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(customer_id, product_id, variant_id)
    );
  `);

  if (!hasColumn('merch_orders', 'customer_user_id')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN customer_user_id INTEGER');
  }

  if (!hasColumn('merch_orders', 'customer_id')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN customer_id INTEGER');
  }

  if (!hasColumn('merch_orders', 'guest_name')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN guest_name TEXT');
  }

  if (!hasColumn('merch_orders', 'guest_email')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN guest_email TEXT');
  }

  if (!hasColumn('merch_orders', 'guest_phone')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN guest_phone TEXT');
  }

  if (!hasColumn('merch_orders', 'is_guest')) {
    db.exec("ALTER TABLE merch_orders ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn('merch_orders', 'coupon_id')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id)');
  }

  if (!hasColumn('merch_orders', 'coupon_code')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN coupon_code TEXT');
  }

  if (!hasColumn('merch_orders', 'influencer_id')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN influencer_id INTEGER REFERENCES merch_influencers(id)');
  }

  if (!hasColumn('merch_orders', 'billing_address')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN billing_address TEXT');
  }
  if (!hasColumn('merch_orders', 'delivered_at')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN delivered_at TEXT');
  }

  if (!hasColumn('merch_influencers', 'avatar_url')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN avatar_url TEXT');
  }
  if (!hasColumn('merch_influencers', 'bio')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN bio TEXT');
  }
  if (!hasColumn('merch_influencers', 'social_links_json')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN social_links_json TEXT');
  }
  if (!hasColumn('merch_influencers', 'preferred_payment_details')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN preferred_payment_details TEXT');
  }
  if (!hasColumn('merch_influencers', 'paid_commission')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN paid_commission INTEGER NOT NULL DEFAULT 0');
  }
  if (!hasColumn('merch_influencers', 'commission_per_order_paise')) {
    db.exec('ALTER TABLE merch_influencers ADD COLUMN commission_per_order_paise INTEGER NOT NULL DEFAULT 0');
  }

  if (hasTable('coupons') && !hasColumn('coupons', 'influencer_id')) {
    db.exec('ALTER TABLE coupons ADD COLUMN influencer_id INTEGER REFERENCES merch_influencers(id)');
  }

  if (!hasTable('merch_influencer_commission_payments')) {
    db.exec(`
      CREATE TABLE merch_influencer_commission_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        influencer_id INTEGER NOT NULL REFERENCES merch_influencers(id) ON DELETE CASCADE,
        amount_paise INTEGER NOT NULL,
        payment_method TEXT,
        reference_number TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        paid_at TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  if (!hasColumn('merch_influencer_commission_payments', 'note')) {
    db.exec('ALTER TABLE merch_influencer_commission_payments ADD COLUMN note TEXT');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_merch_orders_influencer_id
      ON merch_orders(influencer_id);

    CREATE INDEX IF NOT EXISTS idx_coupons_influencer_portal
      ON coupons(influencer_id, portal);

    CREATE INDEX IF NOT EXISTS idx_merch_influencers_email
      ON merch_influencers(email);

    CREATE INDEX IF NOT EXISTS idx_merch_influencer_commission_payments_influencer
      ON merch_influencer_commission_payments(influencer_id, datetime(COALESCE(paid_at, created_at)) DESC);
  `);

  function hasTable(tableName) {
    return Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(tableName)
    );
  }

  function hasColumn(tableName, columnName) {
    if (!hasTable(tableName)) return false;
    return db.prepare(`PRAGMA table_info(${tableName})`).all().some((row) => row.name === columnName);
  }

  function getMerchHypeRows({ includeInactive = false } = {}) {
    return db.prepare(`
      SELECT h.id,
             h.product_id AS productId,
             h.label,
             h.custom_label AS customLabel,
             h.created_at AS createdAt,
             h.updated_at AS updatedAt,
             p.name AS productName,
             p.slug AS productSlug,
             p.is_active AS productActive
      FROM merch_product_hypes h
      JOIN merch_products p ON p.id = h.product_id
      ${includeInactive ? '' : 'WHERE p.is_active = 1'}
      ORDER BY h.id ASC
    `).all().map((row) => ({ ...row, effectiveLabel: getMerchHypeLabel(row) }));
  }

  function getMerchHypeLabel(row) {
    return String(row?.label || '').trim() === 'Custom Label'
      ? String(row?.customLabel || '').trim()
      : String(row?.label || '').trim();
  }

  function formatMerchPrice(paise) {
    return '₹' + Number(paise || 0).toLocaleString('en-IN');
  }

  const MERCH_TIME_ZONE = 'Asia/Kolkata';

  function getMerchDateKey(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const normalized = raw.replace(' ', 'T');
    const parsed = new Date(/(?:Z|[+\-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
    if (Number.isNaN(parsed.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: MERCH_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(parsed).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatMerchEmailCurrency(paise) {
    return `&#8377;${(Number(paise || 0) / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatMerchEmailDateTime(value) {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(parsed);
  }

  function addMerchEmailDays(value, days) {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    date.setDate(date.getDate() + Number(days || 0));
    return date;
  }

  function formatMerchEmailDate(value) {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(value);
  }

  function getMerchEmailOrigin(req) {
    const explicit = String(process.env.PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || process.env.API_BASE_URL || '').trim();
    if (explicit) return explicit.replace(/\/+$/, '');
    const protocol = String(req?.protocol || 'https').trim();
    const host = String(req?.get?.('host') || '').trim();
    return host ? `${protocol}://${host}` : 'https://h2houseofhealth.com';
  }

  function getMerchEmailAssetUrl(req, pathValue) {
    const value = String(pathValue || '').trim();
    if (/^https:\/\//i.test(value)) return value;
    if (/^http:\/\//i.test(value) && !/\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(value)) {
      return value.replace(/^http:/i, 'https:');
    }
    if (/^http:\/\//i.test(value)) {
      try {
        const parsed = new URL(value);
        return `https://h2houseofhealth.com${parsed.pathname}${parsed.search}`;
      } catch {
        return 'https://h2houseofhealth.com/';
      }
    }
    const normalizedPath = value.startsWith('/') ? value : `/${value}`;
    const origin = getMerchEmailOrigin(req);
    const assetOrigin = /^https:\/\//i.test(origin) && !/\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(origin)
      ? origin
      : 'https://h2houseofhealth.com';
    return `${assetOrigin}${normalizedPath}`;
  }

  const LOW_STOCK_THRESHOLD = 15;

  function getMerchVariantPriceOverrides(slug) {
    const normalizedSlug = String(slug || '').trim().toLowerCase();
    if (normalizedSlug === 'h2-water-bottle' || normalizedSlug === 'molecular-hydrogen-water-bottle') {
      return [699900, 649900, 749900];
    }
    if (normalizedSlug === 'h2-mist-spray' || normalizedSlug === 'hydrogen-mist-spray') {
      return [249900, 349900, 279900];
    }
    return null;
  }

  function normalizeInfluencerPayload(body = {}) {
    const commissionPerOrderPaise = Number(body.commissionPerOrderPaise ?? body.commission_per_order_paise ?? 0);
    const paidCommission = Number(body.paidCommission ?? body.paid_commission ?? 0);
    const rawSocialLinks = Array.isArray(body.socialLinks)
      ? body.socialLinks
      : Array.isArray(body.social_links)
        ? body.social_links
        : String(body.socialLinks || body.social_links || '')
            .split(/[\n,]/)
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    return {
      name: String(body.name || '').trim(),
      handle: String(body.handle || '').trim(),
      email: String(body.email || '').trim().toLowerCase(),
      phone: String(body.phone || '').trim(),
      notes: String(body.notes || '').trim(),
      avatarUrl: String(body.avatarUrl || body.avatar_url || '').trim(),
      bio: String(body.bio || '').trim(),
      socialLinks: Array.from(new Set(rawSocialLinks.map((item) => String(item || '').trim()).filter(Boolean))),
      preferredPaymentDetails: String(body.preferredPaymentDetails || body.preferred_payment_details || '').trim(),
      commissionPerOrderPaise: Number.isFinite(commissionPerOrderPaise) ? Math.max(0, Math.round(commissionPerOrderPaise)) : 0,
      paidCommission: Number.isFinite(paidCommission) ? Math.max(0, Math.round(paidCommission)) : 0,
      active: body.active === false || Number(body.active) === 0 ? 0 : 1,
    };
  }

  function normalizeInfluencerEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function isValidMerchEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function getMerchReportTransporter() {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  function escapeCsvValue(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMerchReportMonth(monthKey) {
    const parsed = new Date(`${String(monthKey || '').slice(0, 7)}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return String(monthKey || '');
    }
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(parsed);
  }

  function formatMerchCurrency(paise) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(paise || 0) / 100);
  }

  function getInfluencerById(influencerId) {
    const id = Number(influencerId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return db.prepare(`
      SELECT id, name, handle, email, phone, notes, avatar_url AS avatarUrl, bio,
             social_links_json AS socialLinksJson, preferred_payment_details AS preferredPaymentDetails,
             commission_rate AS commissionRate, commission_per_order_paise AS commissionPerOrderPaise, paid_commission AS paidCommission, active,
             created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencers
      WHERE id = ?
    `).get(id);
  }

  function getInfluencerByEmail(email) {
    const normalizedEmail = normalizeInfluencerEmail(email);
    if (!normalizedEmail) return null;
    return db.prepare(`
      SELECT id, name, handle, email, phone, notes, avatar_url AS avatarUrl, bio,
             social_links_json AS socialLinksJson, preferred_payment_details AS preferredPaymentDetails,
             commission_rate AS commissionRate, commission_per_order_paise AS commissionPerOrderPaise, paid_commission AS paidCommission, active,
             created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencers
      WHERE LOWER(TRIM(email)) = ?
      LIMIT 1
    `).get(normalizedEmail);
  }

  function getMerchCouponByCode(code) {
    const normalizedCode = normalizeMerchCouponCode(code);
    if (!normalizedCode) return null;
    return db.prepare(`
      SELECT c.id, c.code, c.description, c.discount_type AS discountType, c.discount_value AS discountValue,
             c.commission_per_order_paise AS commissionPerOrderPaise,
             c.applies_to AS appliesTo, c.active, c.is_active AS isActive, c.portal,
             c.influencer_id AS influencerId, i.name AS influencerName, i.handle AS influencerHandle,
             i.email AS influencerEmail, i.commission_rate AS influencerCommissionRate
      FROM coupons c
      LEFT JOIN merch_influencers i ON i.id = c.influencer_id
      WHERE c.code = ? AND c.portal = 'merch'
      LIMIT 1
    `).get(normalizedCode);
  }

  function getInfluencerCouponRows(influencerIds = []) {
    const ids = Array.from(new Set(
      influencerIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    ));
    if (!ids.length) return [];
    return db.prepare(`
      SELECT c.id, c.code, c.description, c.discount_type AS discountType, c.discount_value AS discountValue,
             c.commission_per_order_paise AS commissionPerOrderPaise,
             c.active, c.is_active AS isActive, c.influencer_id AS influencerId,
             COUNT(mo.id) AS usageCount,
             COALESCE(SUM(CASE WHEN mo.payment_status IN ('paid', 'cod_pending') THEN mo.total_amount ELSE 0 END), 0) AS revenue
      FROM coupons c
      LEFT JOIN merch_orders mo ON mo.coupon_id = c.id AND mo.influencer_id = c.influencer_id
      WHERE c.portal = 'merch'
        AND c.influencer_id IN (${ids.map(() => '?').join(', ')})
      GROUP BY c.id
      ORDER BY c.code ASC
    `).all(...ids);
  }

  function getInfluencerStatsRows(influencerIds = []) {
    const ids = Array.from(new Set(
      influencerIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)
    ));
    if (!ids.length) return [];
    return db.prepare(`
      SELECT influencer_id AS influencerId,
             COUNT(*) AS totalOrders,
             COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'cod_pending') THEN total_amount ELSE 0 END), 0) AS revenue,
             COALESCE(SUM(CASE WHEN payment_status IN ('paid', 'cod_pending') THEN commission_amount_paise ELSE 0 END), 0) AS totalCommissionEarned,
             COALESCE(SUM(CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS couponUsage
      FROM merch_orders
      WHERE influencer_id IN (${ids.map(() => '?').join(', ')})
        AND payment_status IN ('paid', 'cod_pending')
      GROUP BY influencer_id
    `).all(...ids);
  }

  function parseInfluencerSocialLinks(rawValue) {
    if (!rawValue) return [];
    if (Array.isArray(rawValue)) {
      return Array.from(new Set(rawValue.map((item) => String(item || '').trim()).filter(Boolean)));
    }
    const text = String(rawValue || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean)));
      }
    } catch {
      // Fall back to line-based parsing.
    }
    return Array.from(
      new Set(
        text
          .split(/[\n,]/)
          .map((item) => String(item || '').trim())
          .filter(Boolean)
      )
    );
  }

  function serializeInfluencer(row, coupons = [], stats = {}, payments = []) {
    const commissionPerOrderPaise = Math.max(0, Math.round(Number(row.commissionPerOrderPaise ?? row.commission_per_order_paise ?? 0)));
    const revenue = Number(stats.revenue || 0);
    const paymentTotal = payments
      .filter((payment) => ['paid', 'processed', 'completed', 'settled'].includes(String(payment.status || '').toLowerCase()))
      .reduce((sum, payment) => sum + Number(payment.amountPaise || 0), 0);
    const paidCommissionRecorded = Number(row.paidCommission ?? row.paid_commission);
    return {
      id: Number(row.id),
      name: String(row.name || ''),
      handle: String(row.handle || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      notes: String(row.notes || ''),
      avatarUrl: String(row.avatarUrl || row.avatar_url || ''),
      bio: String(row.bio || ''),
      socialLinks: parseInfluencerSocialLinks(row.socialLinksJson || row.social_links_json),
      preferredPaymentDetails: String(row.preferredPaymentDetails || row.preferred_payment_details || ''),
      commissionRate: commissionPerOrderPaise / 100,
      commissionPerOrderPaise,
      paidCommission: Number.isFinite(paidCommissionRecorded)
        ? Math.max(0, Math.max(Math.round(paidCommissionRecorded), paymentTotal))
        : paymentTotal,
      active: Number(row.active ?? 1) === 1,
      coupons: coupons.map((coupon) => String(coupon.code || '')).filter(Boolean),
      couponDetails: coupons.map((coupon) => ({
        id: Number(coupon.id),
        code: String(coupon.code || ''),
        description: String(coupon.description || ''),
        discountType: String(coupon.discountType || ''),
        discountValue: Number(coupon.discountValue || 0),
        active: Number(coupon.isActive ?? coupon.active ?? 0) === 1,
        usageCount: Number(coupon.usageCount || 0),
        revenue: Number(coupon.revenue || 0),
      })),
      totalOrders: Number(stats.totalOrders || 0),
      revenue,
      couponUsage: Number(stats.couponUsage || 0),
      activeCampaigns: coupons.filter((coupon) => Number(coupon.isActive ?? coupon.active ?? 0) === 1).length,
      commission: Math.max(0, Math.round(Number(stats.totalCommissionEarned || 0))),
      createdAt: row.createdAt || row.created_at || null,
      updatedAt: row.updatedAt || row.updated_at || null,
    };
  }

  function normalizeCommissionPaymentPayload(body = {}) {
    const amountPaise = Number(body.amountPaise ?? body.amount_paise ?? body.amount ?? 0);
    const rawStatus = String(body.status || 'paid').trim().toLowerCase();
    return {
      amountPaise: Number.isFinite(amountPaise) ? Math.max(0, Math.round(amountPaise)) : 0,
      paymentMethod: String(body.paymentMethod || body.payment_method || '').trim(),
      referenceNumber: String(body.referenceNumber || body.reference_number || '').trim(),
      status: ['pending', 'paid', 'processed', 'completed', 'settled', 'cancelled'].includes(rawStatus) ? rawStatus : 'paid',
      paidAt: String(body.paidAt || body.paid_at || '').trim(),
      note: String(body.note || '').trim(),
    };
  }

  function loadMerchInfluencers() {
    const rows = db.prepare(`
      SELECT id, name, handle, email, phone, notes, avatar_url AS avatarUrl, bio,
             social_links_json AS socialLinksJson, preferred_payment_details AS preferredPaymentDetails,
             commission_rate AS commissionRate, commission_per_order_paise AS commissionPerOrderPaise, paid_commission AS paidCommission, active, created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencers
      ORDER BY active DESC, datetime(created_at) DESC, id DESC
    `).all();
    const ids = rows.map((row) => Number(row.id));
    const couponRows = getInfluencerCouponRows(ids);
    const statRows = getInfluencerStatsRows(ids);
    const paymentRows = ids.length
      ? db.prepare(`
          SELECT id, influencer_id AS influencerId, amount_paise AS amountPaise, payment_method AS paymentMethod,
                 reference_number AS referenceNumber, status, paid_at AS paidAt, note, created_at AS createdAt, updated_at AS updatedAt
          FROM merch_influencer_commission_payments
          WHERE influencer_id IN (${ids.map(() => '?').join(', ')})
          ORDER BY datetime(COALESCE(paid_at, created_at)) DESC, id DESC
        `).all(...ids)
      : [];
    const couponsByInfluencer = new Map();
    const statsByInfluencer = new Map();
    const paymentsByInfluencer = new Map();

    for (const coupon of couponRows) {
      const influencerId = Number(coupon.influencerId);
      if (!couponsByInfluencer.has(influencerId)) couponsByInfluencer.set(influencerId, []);
      couponsByInfluencer.get(influencerId).push(coupon);
    }
    for (const stats of statRows) {
      statsByInfluencer.set(Number(stats.influencerId), stats);
    }
    for (const payment of paymentRows) {
      const influencerId = Number(payment.influencerId);
      if (!paymentsByInfluencer.has(influencerId)) paymentsByInfluencer.set(influencerId, []);
      paymentsByInfluencer.get(influencerId).push(payment);
    }

    return rows.map((row) => serializeInfluencer(
      row,
      couponsByInfluencer.get(Number(row.id)) || [],
      statsByInfluencer.get(Number(row.id)) || {},
      paymentsByInfluencer.get(Number(row.id)) || []
    ));
  }

  function getInfluencerCommissionPayments(influencerId) {
    const id = Number(influencerId);
    if (!Number.isInteger(id) || id <= 0) return [];
    return db.prepare(`
      SELECT id, influencer_id AS influencerId, amount_paise AS amountPaise, payment_method AS paymentMethod,
             reference_number AS referenceNumber, status, paid_at AS paidAt, note, created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencer_commission_payments
      WHERE influencer_id = ?
      ORDER BY datetime(COALESCE(paid_at, created_at)) DESC, id DESC
    `).all(id);
  }

  function maskCustomerName(name = '', isGuest = false) {
    const value = String(name || '').trim();
    if (!value) return isGuest ? 'Guest customer' : 'Customer';
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0]?.toUpperCase() || ''}.`;
  }

  function buildInfluencerNotifications({ coupons = [], orders = [], payments = [] } = {}) {
    const notifications = [];
    const now = Date.now();
    const expiryWindowMs = 14 * 24 * 60 * 60 * 1000;

    for (const order of orders.slice(0, 6)) {
      notifications.push({
        id: `sale-${order.id}`,
        type: 'sale',
        title: 'New sale made',
        message: `${order.orderNumber} used ${order.couponUsed || 'an assigned coupon'}.`,
        time: order.orderDate || null,
      });
    }

    for (const coupon of coupons) {
      const expiry = String(coupon.expiresAt || coupon.validTill || '').trim();
      if (!expiry) continue;
      const expiryTime = new Date(expiry.replace(' ', 'T')).getTime();
      if (!Number.isFinite(expiryTime)) continue;
      const remainingMs = expiryTime - now;
      if (remainingMs > 0 && remainingMs <= expiryWindowMs) {
        notifications.push({
          id: `expiry-${coupon.id}`,
          type: 'warning',
          title: 'Coupon nearing expiry',
          message: `${coupon.code} expires on ${expiry}.`,
          time: expiry,
        });
      }
      if (Number(coupon.usageCount || 0) === 0) {
        notifications.push({
          id: `assigned-${coupon.id}`,
          type: 'info',
          title: 'New coupon assigned',
          message: `${coupon.code} is ready to share.`,
          time: coupon.createdAt || null,
        });
      }
    }

    for (const payment of payments.slice(0, 4)) {
      const paidLike = ['paid', 'processed', 'completed', 'settled'].includes(String(payment.status || '').toLowerCase());
      notifications.push({
        id: `payment-${payment.id}`,
        type: paidLike ? 'success' : 'info',
        title: paidLike ? 'Commission payment processed' : 'Commission credited',
        message: `${formatMerchPrice(payment.amountPaise || 0)}${payment.referenceNumber ? ` • Ref ${payment.referenceNumber}` : ''}`,
        time: payment.paidAt || payment.createdAt || null,
      });
    }

    return notifications
      .sort((left, right) => String(right.time || '').localeCompare(String(left.time || '')))
      .slice(0, 10);
  }

  function buildInfluencerDashboard(influencer, { page = 1, pageSize = 8, search = '', status = '', startDate = '', endDate = '' } = {}) {
    if (!influencer || !Number(influencer.id)) return null;
    const influencerId = Number(influencer.id);
    const commissionPerOrderPaise = Math.max(0, Math.round(Number(influencer.commissionPerOrderPaise || influencer.commission_per_order_paise || 0)));

    const coupons = db.prepare(`
      SELECT c.id, c.code, c.description, c.discount_type AS discountType, c.discount_value AS discountValue,
             c.commission_per_order_paise AS commissionPerOrderPaise,
             c.applies_to AS appliesTo, c.max_redemptions AS maxRedemptions, c.per_user_limit AS perUserLimit,
             c.expires_at AS expiresAt, c.active, c.coupon_type AS couponType,
             c.is_active AS isActive, c.valid_from AS validFrom, c.valid_till AS validTill,
             c.created_at AS createdAt
      FROM coupons c
      WHERE c.portal = 'merch' AND c.influencer_id = ?
      ORDER BY c.active DESC, datetime(c.created_at) DESC, c.id DESC
    `).all(influencerId).map((coupon) => {
      const usageStats = db.prepare(`
        SELECT COUNT(*) AS total,
               COALESCE(SUM(CASE WHEN mo.payment_status IN ('paid', 'cod_pending') THEN mo.total_amount ELSE 0 END), 0) AS revenue,
               COALESCE(COUNT(CASE WHEN mo.payment_status IN ('paid', 'cod_pending') THEN 1 END), 0) AS orders
        FROM merch_orders mo
        WHERE mo.influencer_id = ?
          AND (mo.coupon_id = ? OR LOWER(TRIM(mo.coupon_code)) = LOWER(TRIM(?)))
      `).get(influencerId, Number(coupon.id), String(coupon.code || ''));
      const maxRedemptions = Number(coupon.maxRedemptions || 0);
      const usageCount = Number(usageStats.total || 0);
      return {
        id: Number(coupon.id),
        code: String(coupon.code || ''),
        description: String(coupon.description || ''),
        discountType: String(coupon.discountType || ''),
        discountValue: Number(coupon.discountValue || 0),
        appliesTo: String(coupon.appliesTo || 'all'),
        maxRedemptions: Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? maxRedemptions : null,
        perUserLimit: Number(coupon.perUserLimit || 1),
        expiresAt: coupon.expiresAt || coupon.validTill || null,
        active: Number(coupon.active ?? coupon.isActive ?? 0) === 1,
        usageCount,
        remainingUsage: Number.isFinite(maxRedemptions) && maxRedemptions > 0 ? Math.max(0, maxRedemptions - usageCount) : null,
        revenueGenerated: Number(usageStats.revenue || 0),
        ordersGenerated: Number(usageStats.orders || 0),
        createdAt: coupon.createdAt || null,
      };
    });

    const orderRows = db.prepare(`
      SELECT mo.id, mo.order_number AS orderNumber, mo.customer_name AS customerName, mo.customer_email AS customerEmail,
             mo.is_guest AS isGuest, mo.status, mo.payment_status AS paymentStatus,
             mo.payment_method AS paymentMethod, mo.razorpay_payment_id AS paymentReference,
             mo.total_amount AS totalAmount, mo.discount_amount AS discountAmount, mo.commission_amount_paise AS commissionAmountPaise,
             mo.coupon_id AS couponId, mo.coupon_code AS couponCode, mo.created_at AS createdAt
      FROM merch_orders mo
      WHERE mo.influencer_id = ?
      ORDER BY datetime(mo.created_at) DESC, mo.id DESC
    `).all(influencerId);
    const orderIds = orderRows.map((order) => Number(order.id));
    const itemRows = orderIds.length
      ? db.prepare(`
          SELECT order_id AS orderId, product_name AS productName, quantity, line_total AS lineTotal
          FROM merch_order_items
          WHERE order_id IN (${orderIds.map(() => '?').join(', ')})
        `).all(...orderIds)
      : [];
    const itemsByOrderId = new Map();
    for (const item of itemRows) {
      const id = Number(item.orderId);
      if (!itemsByOrderId.has(id)) itemsByOrderId.set(id, []);
      itemsByOrderId.get(id).push(item);
    }

    const monthlyMap = new Map();
    const productMap = new Map();
    const customerEmailCounts = new Map();
    const allOrders = orderRows.map((order) => {
      const items = itemsByOrderId.get(Number(order.id)) || [];
      const commissionEarned = Math.max(0, Number(order.commissionAmountPaise || 0));
      const productSummary = items.length
        ? items.map((item) => `${String(item.productName || 'Item')} x${Number(item.quantity || 0)}`).join(', ')
        : 'Merch order';
      const orderDate = order.createdAt || null;
      const monthKey = String(orderDate || '').slice(0, 7);
      if (monthKey) {
        const entry = monthlyMap.get(monthKey) || { sales: 0, commission: 0, orders: 0 };
        entry.sales += Number(order.totalAmount || 0);
        entry.commission += commissionEarned;
        entry.orders += 1;
        monthlyMap.set(monthKey, entry);
      }
      const normalizedEmail = normalizeMerchCustomerEmail(order.customerEmail);
      if (normalizedEmail) {
        customerEmailCounts.set(normalizedEmail, (customerEmailCounts.get(normalizedEmail) || 0) + 1);
      }
      for (const item of items) {
        const key = String(item.productName || 'Merch Product');
        const stats = productMap.get(key) || { name: key, quantity: 0, revenue: 0 };
        stats.quantity += Number(item.quantity || 0);
        stats.revenue += Number(item.lineTotal || 0);
        productMap.set(key, stats);
      }
      return {
        id: Number(order.id),
        orderNumber: String(order.orderNumber || ''),
        orderDate,
        productSummary,
        customerName: maskCustomerName(order.customerName, Boolean(Number(order.isGuest || 0))),
        couponUsed: String(order.couponCode || ''),
        orderAmount: Number(order.totalAmount || 0),
        commissionEarned,
        orderStatus: String(order.status || 'pending'),
        paymentStatus: String(order.paymentStatus || 'pending'),
      };
    });

    const searchTerm = String(search || '').trim().toLowerCase();
    const statusTerm = String(status || '').trim().toLowerCase();
    const start = String(startDate || '').trim();
    const end = String(endDate || '').trim();
    const filteredOrders = allOrders.filter((order) => {
      if (statusTerm && statusTerm !== 'all' && String(order.orderStatus || '').toLowerCase() !== statusTerm && String(order.paymentStatus || '').toLowerCase() !== statusTerm) {
        return false;
      }
      if (start && String(order.orderDate || '').slice(0, 10) < start) return false;
      if (end && String(order.orderDate || '').slice(0, 10) > end) return false;
      if (!searchTerm) return true;
      return [order.orderNumber, order.productSummary, order.customerName, order.couponUsed, order.orderStatus, order.paymentStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(searchTerm));
    });

    const pageNumber = Math.max(1, Number(page || 1));
    const pageLimit = Math.max(1, Math.min(20, Number(pageSize || 8)));
    const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageLimit));
    const currentPage = Math.min(pageNumber, pageCount);
    const offset = (currentPage - 1) * pageLimit;
    const pagedOrders = filteredOrders.slice(offset, offset + pageLimit);

    const paidOrders = allOrders.filter((order) => ['paid', 'cod_pending'].includes(String(order.paymentStatus || '').toLowerCase()));
    const activeOrders = allOrders.filter((order) => !['cancelled', 'refunded'].includes(String(order.orderStatus || '').toLowerCase()));
    const salesGenerated = paidOrders.reduce((sum, order) => sum + Number(order.orderAmount || 0), 0);
    const totalOrdersReferred = activeOrders.length;
    const commissionEarned = paidOrders.reduce((sum, order) => sum + Math.max(0, Number(order.commissionEarned || 0)), 0);
    const commissionPayments = getInfluencerCommissionPayments(influencerId);
    const commissionPaidFromPayments = commissionPayments
      .filter((payment) => ['paid', 'processed', 'completed', 'settled'].includes(String(payment.status || '').toLowerCase()))
      .reduce((sum, payment) => sum + Number(payment.amountPaise || 0), 0);
    const commissionPaidRecorded = Math.max(0, Math.round(Number(influencer.paidCommission ?? influencer.paid_commission ?? 0)));
    const commissionPaid = Math.max(commissionPaidFromPayments, commissionPaidRecorded);
    const commissionPending = Math.max(0, commissionEarned - commissionPaid);
    const activeCoupons = coupons.filter((coupon) => Number(coupon.active) === 1).length;
    const couponUsage = allOrders.filter((order) => Boolean(order.couponUsed)).length;
    const conversionRate = totalOrdersReferred ? Math.round((paidOrders.length / totalOrdersReferred) * 1000) / 10 : 0;
    const averageOrderValue = paidOrders.length ? Math.round(salesGenerated / paidOrders.length) : 0;
    const repeatCustomerCount = [...customerEmailCounts.values()].filter((count) => count > 1).length;
    const repeatCustomerPercentage = allOrders.length ? Math.round((repeatCustomerCount / allOrders.length) * 1000) / 10 : 0;

    const monthlyTrend = [...monthlyMap.entries()]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([month, values]) => ({
        month,
        label: new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`)),
        sales: Number(values.sales || 0),
        commission: Number(values.commission || 0),
        orders: Number(values.orders || 0),
      }))
      .slice(-12);

    const topProducts = [...productMap.values()]
      .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity)
      .slice(0, 5);

    const bestCoupon = coupons.slice().sort((left, right) => right.revenueGenerated - left.revenueGenerated || right.usageCount - left.usageCount)[0] || null;
    const highestSalesMonth = monthlyTrend.slice().sort((left, right) => right.sales - left.sales)[0] || null;
    const lastPayment = commissionPayments.find((payment) => ['paid', 'processed', 'completed', 'settled'].includes(String(payment.status || '').toLowerCase())) || null;
    const upcomingPaymentDate = commissionPending > 0 && (lastPayment?.paidAt || lastPayment?.createdAt)
      ? new Date(String(lastPayment.paidAt || lastPayment.createdAt).replace(' ', 'T'))
      : null;
    if (upcomingPaymentDate && !Number.isNaN(upcomingPaymentDate.getTime())) {
      upcomingPaymentDate.setDate(upcomingPaymentDate.getDate() + 14);
    }

    const notifications = buildInfluencerNotifications({
      coupons,
      orders: allOrders,
      payments: commissionPayments,
    });

    return {
      influencer: serializeInfluencer(influencer, coupons, {
        totalOrders: totalOrdersReferred,
        revenue: salesGenerated,
        couponUsage,
      }, commissionPayments),
      summary: {
        totalSalesGenerated: salesGenerated,
        totalOrdersReferred,
        totalCommissionEarned: commissionEarned,
        commissionPending,
        commissionPaid,
        activeCoupons,
        couponUsage,
        conversionRate,
        averageOrderValue,
      },
      analytics: {
        monthlyTrend,
        topProducts,
        bestCoupon: bestCoupon ? {
          code: bestCoupon.code,
          revenueGenerated: bestCoupon.revenueGenerated,
          usageCount: bestCoupon.usageCount,
        } : null,
        highestSalesMonth: highestSalesMonth ? {
          month: highestSalesMonth.month,
          label: highestSalesMonth.label,
          sales: highestSalesMonth.sales,
        } : null,
        repeatCustomerPercentage,
      },
      couponPerformance: coupons,
      salesHistory: {
        page: currentPage,
        pageSize: pageLimit,
        total: filteredOrders.length,
        pageCount,
        items: pagedOrders,
      },
      commission: {
        totalEarned: commissionEarned,
        totalPaid: commissionPaid,
        pending: commissionPending,
        lastPaymentDate: lastPayment?.paidAt || lastPayment?.createdAt || null,
        upcomingPayment: upcomingPaymentDate && !Number.isNaN(upcomingPaymentDate.getTime())
          ? upcomingPaymentDate.toISOString()
          : null,
      },
      commissionHistory: commissionPayments.map((payment) => ({
        id: Number(payment.id),
        paymentDate: payment.paidAt || payment.createdAt || null,
        amount: Number(payment.amountPaise || 0),
        paymentMethod: String(payment.paymentMethod || 'manual'),
        referenceNumber: String(payment.referenceNumber || ''),
        status: String(payment.status || 'pending'),
        note: String(payment.note || ''),
      })),
      performance: {
        bestCoupon: bestCoupon ? {
          code: bestCoupon.code,
          revenueGenerated: bestCoupon.revenueGenerated,
          usageCount: bestCoupon.usageCount,
        } : null,
        highestSalesMonth: highestSalesMonth ? {
          month: highestSalesMonth.month,
          label: highestSalesMonth.label,
          sales: highestSalesMonth.sales,
        } : null,
        topSellingProducts: topProducts,
        averageOrderValue,
        repeatCustomerPercentage,
        conversionRate,
      },
      notifications,
    };
  }

  function buildInfluencerAdminReport(influencerId, options = {}) {
    const influencer = getInfluencerById(influencerId);
    if (!influencer) return null;
    const dashboard = buildInfluencerDashboard(influencer, {
      page: 1,
      pageSize: 20,
      search: options.search || '',
      status: options.status || '',
      startDate: options.startDate || '',
      endDate: options.endDate || '',
    });
    if (!dashboard) return null;

    return {
      ...dashboard,
      generatedAt: new Date().toISOString(),
      periodLabel: [options.startDate, options.endDate].filter(Boolean).join(' to ') || 'all available dates',
    };
  }

  function buildInfluencerAdminReportHtml(report) {
    const influencer = report?.influencer || {};
    const summary = report?.summary || {};
    const analytics = report?.analytics || {};
    const performance = report?.performance || {};
    const commission = report?.commission || {};
    const couponRows = Array.isArray(report?.couponPerformance) ? report.couponPerformance : [];
    const orderRows = Array.isArray(report?.salesHistory?.items) ? report.salesHistory.items : [];
    const commissionRows = Array.isArray(report?.commissionHistory) ? report.commissionHistory : [];
    const trendRows = Array.isArray(analytics.monthlyTrend) ? analytics.monthlyTrend : [];
    const productRows = Array.isArray(performance.topSellingProducts) ? performance.topSellingProducts : [];
    const generatedAt = report?.generatedAt || new Date().toISOString();
    const periodLabel = report?.periodLabel || 'all available dates';

    const summaryCards = [
      ['Orders', summary.totalOrdersReferred || influencer.totalOrders || 0],
      ['Revenue', formatMerchCurrency(summary.totalSalesGenerated || influencer.revenue || 0)],
      ['Commission Earned', formatMerchCurrency(summary.totalCommissionEarned || commission.totalEarned || influencer.commission || 0)],
      ['Commission Paid', formatMerchCurrency(summary.commissionPaid || commission.totalPaid || influencer.paidCommission || 0)],
    ];

    const renderRows = (rows, emptyMessage, colCount, renderRow) => (rows.length ? rows.map(renderRow).join('') : `<tr><td colspan="${colCount}">${escapeHtml(emptyMessage)}</td></tr>`);

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(`${String(influencer.name || 'Influencer')} report`)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; font-size: 13px; line-height: 1.45; }
            h1, h2, h3, p { margin: 0 0 10px; }
            h1 { font-size: 26px; line-height: 1.1; }
            h2 { font-size: 18px; line-height: 1.15; }
            h3 { font-size: 15px; line-height: 1.2; }
            .muted { color: #6b7280; }
            .grid { display: grid; gap: 12px; }
            .meta, .cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 18px; }
            .meta div, .cards div { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px; }
            .cards strong { display: block; font-size: 14px; margin-top: 4px; }
            .section { margin-top: 20px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #f9fafb; }
            .chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { display: inline-flex; align-items: center; border: 1px solid #e5e7eb; border-radius: 999px; padding: 5px 9px; background: #fafafa; font-size: 11px; }
          </style>
        </head>
        <body>
          <div class="grid">
            <div class="muted">Generated ${escapeHtml(new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(generatedAt)))}</div>
            <h1>Influencer report</h1>
            <p class="muted">${escapeHtml(periodLabel)}</p>
          </div>

          <div class="meta">
            <div><strong>${escapeHtml(influencer.name || 'Unnamed influencer')}</strong><br />${escapeHtml(influencer.handle || 'No handle')}</div>
            <div><strong>Status</strong><br />${escapeHtml(Number(influencer.active ?? 1) === 1 ? 'Active' : 'Inactive')}</div>
            <div><strong>Email</strong><br />${escapeHtml(influencer.email || 'Not added yet')}</div>
            <div><strong>Phone</strong><br />${escapeHtml(influencer.phone || 'Not added yet')}</div>
          </div>

          <div class="cards">
            ${summaryCards.map(([label, value]) => `<div><span class="muted">${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong></div>`).join('')}
          </div>

          <div class="section">
            <h2>Coupon Performance</h2>
            <div class="chips">
              ${couponRows.length ? couponRows.map((coupon) => `<span class="chip">${escapeHtml(coupon.code || '')}${coupon.usageCount != null ? ` · ${escapeHtml(String(coupon.usageCount))} uses` : ''}</span>`).join('') : '<span class="muted">No coupon history yet.</span>'}
            </div>
          </div>

          <div class="section">
            <h2>Monthly Trend</h2>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Orders</th>
                  <th>Sales</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(trendRows, 'No monthly activity yet.', 4, (row) => `
                  <tr>
                    <td>${escapeHtml(row.label || formatMerchReportMonth(row.month))}</td>
                    <td>${escapeHtml(String(row.orders || 0))}</td>
                    <td>${escapeHtml(formatMerchCurrency(row.sales || 0))}</td>
                    <td>${escapeHtml(formatMerchCurrency(row.commission || 0))}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Top Products</h2>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(productRows, 'No product breakdown yet.', 3, (row) => `
                  <tr>
                    <td>${escapeHtml(row.name || '')}</td>
                    <td>${escapeHtml(String(row.quantity || 0))}</td>
                    <td>${escapeHtml(formatMerchCurrency(row.revenue || 0))}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Recent Orders</h2>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Coupon</th>
                  <th>Status</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(orderRows, 'No order history yet.', 6, (row) => `
                  <tr>
                    <td>${escapeHtml(row.orderNumber || row.id || '')}</td>
                    <td>${escapeHtml(String(row.orderDate || '').slice(0, 10) || '-')}</td>
                    <td>${escapeHtml(row.customerName || '-')}</td>
                    <td>${escapeHtml(row.couponUsed || '-')}</td>
                    <td>${escapeHtml(row.paymentStatus || row.orderStatus || '-')}</td>
                    <td>${escapeHtml(formatMerchCurrency(row.orderAmount || 0))}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2>Commission History</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reference</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                ${renderRows(commissionRows, 'No commission payments recorded yet.', 5, (row) => `
                  <tr>
                    <td>${escapeHtml(String(row.paymentDate || '').slice(0, 10) || '-')}</td>
                    <td>${escapeHtml(formatMerchCurrency(row.amount || 0))}</td>
                    <td>${escapeHtml(row.status || '-')}</td>
                    <td>${escapeHtml(row.referenceNumber || '-')}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        </body>
      </html>`;
  }

  function getMerchProductVariants(productIds = [], { includeInactive = false } = {}) {
    const ids = Array.isArray(productIds)
      ? productIds.map((value) => Number(value)).filter((value) => Number.isInteger(value))
      : [];
    const clauses = [];
    const params = [];

    if (ids.length) {
      clauses.push(`product_id IN (${ids.map(() => '?').join(', ')})`);
      params.push(...ids);
    }
    if (!includeInactive) clauses.push('is_active = 1');

    let sql = `
      SELECT id, product_id AS productId, sku, size, color, price, stock, is_active AS isActive, created_at AS createdAt
      FROM merch_variants
    `;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    sql += ' ORDER BY product_id ASC, id ASC';

    return db.prepare(sql).all(...params);
  }

  function getMerchProductSalesMap({ startDate = null, endDate = null } = {}) {
    const clauses = ["o.payment_status = 'paid'"];
    const params = [];

    if (startDate) {
      clauses.push("date(o.created_at) >= date(?)");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("date(o.created_at) <= date(?)");
      params.push(endDate);
    }

    const salesRows = db.prepare(`
      SELECT v.product_id AS productId,
             COALESCE(SUM(oi.quantity), 0) AS sales,
             COALESCE(COUNT(DISTINCT oi.order_id), 0) AS orderCount,
             COALESCE(SUM(oi.line_total), 0) AS revenue
      FROM merch_order_items oi
      JOIN merch_orders o ON o.id = oi.order_id
      JOIN merch_variants v ON v.id = oi.variant_id
      WHERE ${clauses.join(' AND ')}
      GROUP BY v.product_id
    `).all(...params);

    return new Map(
      salesRows.map((row) => [
        Number(row.productId),
        {
          sales: Number(row.sales || 0),
          orderCount: Number(row.orderCount || 0),
          revenue: Number(row.revenue || 0),
        },
      ])
    );
  }

  function parseMerchSpecifications(value) {
    if (!value) return {};
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function parseMerchImages(value) {
    if (Array.isArray(value)) return value.map(normalizeMerchImageInput).filter(Boolean);
    if (!value) return [];
    try {
      const parsed = JSON.parse(String(value));
      return Array.isArray(parsed) ? parsed.map(normalizeMerchImageInput).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  function getMerchProductImage(product = {}) {
    const storedImages = parseMerchImages(product.images || product.images_json);
    const stored = String(storedImages[0] || product.imageUrl || product.image_url || '').trim();
    if (stored && !/\/booking\/|\/merch\/assets\/images\/merch%20signup%20image/i.test(stored)) return stored;
    const category = String(product.category || '').toLowerCase();
    const name = String(product.name || '').toLowerCase();
    if (category === 'bottles' || name.includes('bottle')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113';
    if (category === 'sprays' || name.includes('mist') || name.includes('spray')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138';
    if (category === 'hoodies' || name.includes('hoodie')) return '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146';
    return stored;
  }

  function buildMerchProductRecord(product, variants = [], sales = null, { includeInactive = false } = {}) {
    const activeVariants = variants.filter((variant) => Number(variant.isActive ?? 1) === 1);
    const catalogVariants = includeInactive ? variants : activeVariants;
    const priceOverrides = getMerchVariantPriceOverrides(product.slug);
    const normalizedVariants = catalogVariants.map((variant, index) => {
      const overridePrice = Array.isArray(priceOverrides) ? Number(priceOverrides[index]) : NaN;
      return Number.isFinite(overridePrice) && overridePrice > 0
        ? { ...variant, price: overridePrice }
        : variant;
    });
    const priceValues = activeVariants.length
      ? normalizedVariants.map((variant) => Number(variant.price || 0)).filter((value) => Number.isFinite(value))
      : [Number(product.base_price || 0)];
    const minPrice = priceValues.length ? Math.min(...priceValues) : Number(product.base_price || 0);
    const maxPrice = priceValues.length ? Math.max(...priceValues) : Number(product.base_price || 0);
    const primaryVariant = normalizedVariants[0] || activeVariants[0] || variants[0] || null;
    const comboItems = Number(product.is_combo || 0) === 1
      ? db.prepare(`
          SELECT ci.component_variant_id AS variantId, ci.quantity,
                 cp.id AS productId, cp.name AS productName, cp.image_url AS imageUrl,
                 cv.sku, cv.size, cv.color, cv.price, cv.stock, cv.is_active AS isActive
          FROM merch_combo_items ci
          JOIN merch_products cp ON cp.id = ci.component_product_id
          JOIN merch_variants cv ON cv.id = ci.component_variant_id
          WHERE ci.combo_product_id = ?
          ORDER BY ci.id ASC
        `).all(Number(product.id)).map((item) => ({ ...item, imageUrl: getMerchProductImage(item) }))
      : [];
    const isCombo = Number(product.is_combo || 0) === 1;
    const customComboImage = isCombo && product.image_url && !String(product.image_url).startsWith('/booking/')
      ? [String(product.image_url)]
      : [];
    const productImages = isCombo
      ? [...new Set([...customComboImage, ...comboItems.map((item) => item.imageUrl)].filter(Boolean).map(String))]
      : (parseMerchImages(product.images_json).length ? parseMerchImages(product.images_json) : (product.image_url ? [getMerchProductImage(product)] : []));
    // A combo has its own inventory. Its component rows are only used to
    // describe what is included and must never determine or mutate stock.
    const stock = normalizedVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
    const salesCount = Number(sales?.sales || 0);
    const orderCount = Number(sales?.orderCount || 0);

    return {
      id: Number(product.id),
      name: String(product.name || ''),
      slug: String(product.slug || ''),
      description: String(product.description || ''),
      specifications: parseMerchSpecifications(product.specifications_json),
      category: String(product.category || ''),
      basePrice: minPrice,
      price: minPrice,
      priceLabel: minPrice === maxPrice ? formatMerchPrice(minPrice) : `${formatMerchPrice(minPrice)} - ${formatMerchPrice(maxPrice)}`,
      imageUrl: String(productImages[0] || getMerchProductImage(product) || ''),
      image: String(productImages[0] || getMerchProductImage(product) || ''),
      images: productImages,
      variants: normalizedVariants.map((variant) => ({
        id: Number(variant.id),
        productId: Number(variant.productId),
        sku: String(variant.sku || ''),
        size: variant.size || null,
        color: variant.color || null,
        price: Number(variant.price || 0),
        stock: Number(variant.stock || 0),
        isActive: Number(variant.isActive ?? 1),
        createdAt: variant.createdAt || null,
      })),
      variantCount: activeVariants.length,
      primarySku: String(primaryVariant?.sku || ''),
      sku: String(primaryVariant?.sku || ''),
      stock,
      // `is_active` is intentionally checked with nullish semantics here:
      // zero means archived and must not be replaced by the fallback value.
      status: Number(product.is_active ?? 1) === 1 ? 'published' : 'archived',
      archived: Number(product.is_active ?? 1) !== 1,
      featured: false,
      comboPurchase: Number(product.combo_purchase || 0) === 1,
      isCombo: Number(product.is_combo || 0) === 1,
      comboItems: comboItems.map((item) => ({
        variantId: Number(item.variantId),
        productId: Number(item.productId),
        productName: String(item.productName || ''),
        imageUrl: String(item.imageUrl || ''),
        sku: String(item.sku || ''),
        size: item.size || null,
        color: item.color || null,
        quantity: Number(item.quantity || 1),
        stock: Number(item.stock || 0),
      })),
      sales: salesCount,
      orderCount,
      gstRate: Number(product.gst_rate || 18),
      weightGrams: Number(product.weight_grams || 0),
      createdAt: product.created_at || null,
      updatedAt: product.updated_at || null,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
    };
  }

  function loadMerchProductCatalog({ includeInactive = false } = {}) {
    const productRows = db.prepare(`
      SELECT id, name, slug, description, specifications_json, category, base_price, image_url, images_json, is_active, gst_rate, weight_grams, combo_purchase, is_combo, created_at, updated_at
      FROM merch_products
      ${includeInactive ? '' : 'WHERE is_active = 1'}
      ORDER BY datetime(created_at) DESC, id DESC
    `).all();
    const productIds = productRows.map((product) => Number(product.id));
    const variantRows = getMerchProductVariants(productIds, { includeInactive });
    const salesMap = getMerchProductSalesMap();
    const variantsByProductId = new Map();

    for (const variant of variantRows) {
      const productId = Number(variant.productId);
      if (!variantsByProductId.has(productId)) {
        variantsByProductId.set(productId, []);
      }
      variantsByProductId.get(productId).push(variant);
    }

    const catalog = productRows.map((product) => buildMerchProductRecord(
      product,
      variantsByProductId.get(Number(product.id)) || [],
      salesMap.get(Number(product.id)) || null,
      { includeInactive }
    ));

    const featuredIds = new Set(
      [...catalog]
        .sort((left, right) => right.sales - left.sales || right.orderCount - left.orderCount || String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
        .slice(0, 3)
        .filter((product) => product.sales > 0)
        .map((product) => Number(product.id))
    );

    return catalog.map((product) => ({
      ...product,
      featured: featuredIds.has(Number(product.id)),
    }));
  }

  function buildMerchOrderTimeline(order) {
    const createdAt = order.createdAt || null;
    const updatedAt = order.updatedAt || order.createdAt || null;
    const entries = [
      {
        label: 'Placed',
        note: `Order ${order.orderNumber} saved in the merch order table`,
        time: createdAt,
      },
    ];

    if (String(order.paymentStatus || '').toLowerCase() === 'paid') {
      entries.push({
        label: 'Payment Captured',
        note: 'Payment status is recorded as paid',
        time: updatedAt,
      });
    }

    if (['processing', 'shipped', 'delivered', 'returned'].includes(String(order.status || '').toLowerCase())) {
      entries.push({
        label: 'Fulfillment Updated',
        note: `Current order status is ${String(order.status || 'pending')}`,
        time: updatedAt,
      });
    }

    if (order.trackingNumber || order.carrierName) {
      entries.push({
        label: 'Tracking Assigned',
        note: `${order.carrierName || 'Carrier'} ${order.trackingNumber ? `- ${order.trackingNumber}` : ''}`.trim(),
        time: updatedAt,
      });
    }

    if (String(order.status || '').toLowerCase() === 'cancelled') {
      entries.push({
        label: 'Cancelled',
        note: 'Order status was marked cancelled',
        time: updatedAt,
      });
    }

    return entries;
  }

  function buildMerchOrderRecord(order, items = []) {
    const shippingAddress = parseMerchShippingAddress(order.shippingAddress);
    const billingAddress = parseMerchShippingAddress(order.billingAddress) || shippingAddress;
    return {
      id: Number(order.id),
      orderNumber: String(order.orderNumber || ''),
      customerName: String(order.customerName || ''),
      customerEmail: String(order.customerEmail || ''),
      customerPhone: String(order.customerPhone || ''),
      guestName: String(order.guestName || ''),
      guestEmail: String(order.guestEmail || ''),
      guestPhone: String(order.guestPhone || ''),
      isGuest: Number(order.isGuest || 0) === 1,
      email: String(order.customerEmail || ''),
      phone: String(order.customerPhone || ''),
      status: String(order.status || 'pending'),
      subtotal: Number(order.subtotal || 0),
      gstAmount: Number(order.gstAmount || order.gst_amount || 0),
      shippingCharge: Number(order.shippingCharge || order.shipping_charge || 0),
      discountAmount: Number(order.discountAmount || order.discount_amount || 0),
      commissionAmountPaise: Number(order.commissionAmountPaise || order.commission_amount_paise || 0),
      couponId: order.couponId || order.coupon_id || null,
      couponCode: String(order.couponCode || order.coupon_code || ''),
      influencerId: order.influencerId || order.influencer_id || null,
      influencerName: String(order.influencerName || order.influencer_name || ''),
      influencerHandle: String(order.influencerHandle || order.influencer_handle || ''),
      influencerCoupon: order.influencerName || order.influencer_name
        ? `${String(order.influencerName || order.influencer_name)}${order.couponCode || order.coupon_code ? ` (${String(order.couponCode || order.coupon_code)})` : ''}`
        : '',
      totalAmount: Number(order.totalAmount || order.total_amount || 0),
      paymentMethod: String(order.paymentMethod || order.payment_method || 'online'),
      paymentStatus: String(order.paymentStatus || order.payment_status || 'pending'),
      razorpayOrderId: String(order.razorpayOrderId || order.razorpay_order_id || ''),
      razorpayPaymentId: String(order.razorpayPaymentId || order.razorpay_payment_id || ''),
      shippingAddress: shippingAddress ? formatMerchAddressLine(shippingAddress) : String(order.shippingAddress || ''),
      billingAddress: billingAddress ? formatMerchAddressLine(billingAddress) : String(order.billingAddress || order.shippingAddress || ''),
      trackingNumber: String(order.trackingNumber || order.tracking_number || ''),
      carrier: String(order.carrierName || order.carrier_name || ''),
      createdAt: order.createdAt || order.created_at || null,
      updatedAt: order.updatedAt || order.updated_at || null,
      deliveredAt: order.deliveredAt || order.delivered_at || (String(order.status || '').toLowerCase() === 'delivered' ? order.updatedAt || order.updated_at || null : null),
      items: items.map((item) => ({
        id: Number(item.id),
        name: String(item.productName || item.product_name || ''),
        qty: Number(item.quantity || 0),
        price: Number(item.unitPrice || item.unit_price || 0),
        variantLabel: String(item.variantLabel || item.variant_label || ''),
        sku: String(item.sku || ''),
        lineTotal: Number(item.lineTotal || item.line_total || 0),
      })),
      timeline: buildMerchOrderTimeline({
        orderNumber: order.orderNumber || order.order_number,
        status: order.status,
        paymentStatus: order.paymentStatus || order.payment_status,
        trackingNumber: order.trackingNumber || order.tracking_number,
        carrierName: order.carrierName || order.carrier_name,
        createdAt: order.createdAt || order.created_at,
        updatedAt: order.updatedAt || order.updated_at,
      }),
    };
  }

  function isVisibleMerchOrder(order) {
    const paymentStatus = String(order?.paymentStatus || order?.payment_status || '').trim().toLowerCase();
    const status = String(order?.status || '').trim().toLowerCase();

    if (['paid', 'cod_pending', 'refunded'].includes(paymentStatus)) return true;
    return ['processing', 'shipped', 'delivered', 'cancelled', 'returned'].includes(status);
  }

  function loadMerchOrders({
    status = null,
    startDate = null,
    endDate = null,
    customerUserId = null,
    customerId = null,
    includeUnconfirmed = false,
  } = {}) {
    const clauses = [];
    const params = [];

    if (status && status !== 'all') {
      clauses.push('mo.status = ?');
      params.push(status);
    }
    if (startDate) {
      clauses.push("date(mo.created_at) >= date(?)");
      params.push(startDate);
    }
    if (endDate) {
      clauses.push("date(mo.created_at) <= date(?)");
      params.push(endDate);
    }
    if (Number.isInteger(Number(customerUserId)) && Number(customerUserId) > 0) {
      clauses.push('mo.customer_user_id = ?');
      params.push(Number(customerUserId));
    }
    if (Number.isInteger(Number(customerId)) && Number(customerId) > 0) {
      clauses.push('mo.customer_id = ?');
      params.push(Number(customerId));
    }

    let sql = `
      SELECT mo.id, mo.order_number AS orderNumber, mo.customer_name AS customerName, mo.customer_email AS customerEmail,
             mo.customer_phone AS customerPhone, mo.guest_name AS guestName, mo.guest_email AS guestEmail,
             mo.guest_phone AS guestPhone, mo.is_guest AS isGuest, mo.status, mo.subtotal, mo.gst_amount AS gstAmount,
             mo.shipping_charge AS shippingCharge, mo.discount_amount AS discountAmount, mo.commission_amount_paise AS commissionAmountPaise, mo.coupon_id AS couponId,
             mo.coupon_code AS couponCode, mo.influencer_id AS influencerId, mi.name AS influencerName,
             mi.handle AS influencerHandle, mo.total_amount AS totalAmount, mo.payment_method AS paymentMethod,
             mo.payment_status AS paymentStatus, mo.razorpay_order_id AS razorpayOrderId,
             mo.razorpay_payment_id AS razorpayPaymentId, mo.shipping_address AS shippingAddress,
             mo.billing_address AS billingAddress,
             mo.tracking_number AS trackingNumber, mo.carrier_name AS carrierName,
             mo.created_at AS createdAt, mo.updated_at AS updatedAt,
             mo.customer_user_id AS customerUserId, mo.customer_id AS customerId
      FROM merch_orders mo
      LEFT JOIN merch_influencers mi ON mi.id = mo.influencer_id
    `;
    if (clauses.length) sql += ` WHERE ${clauses.join(' AND ')}`;
    sql += ' ORDER BY datetime(mo.created_at) DESC, mo.id DESC';

    const orders = db.prepare(sql).all(...params);
    if (!orders.length) return [];

    const visibleOrders = includeUnconfirmed ? orders : orders.filter(isVisibleMerchOrder);
    if (!visibleOrders.length) return [];

    const orderIds = visibleOrders.map((order) => Number(order.id));
    const itemRows = db.prepare(`
      SELECT id, order_id AS orderId, variant_id AS variantId, product_name AS productName,
             variant_label AS variantLabel, sku, unit_price AS unitPrice, quantity, line_total AS lineTotal
      FROM merch_order_items
      WHERE order_id IN (${orderIds.map(() => '?').join(', ')})
      ORDER BY order_id ASC, id ASC
    `).all(...orderIds);

    const itemsByOrderId = new Map();
    for (const item of itemRows) {
      const orderId = Number(item.orderId);
      if (!itemsByOrderId.has(orderId)) {
        itemsByOrderId.set(orderId, []);
      }
      itemsByOrderId.get(orderId).push(item);
    }

    return visibleOrders.map((order) => buildMerchOrderRecord(order, itemsByOrderId.get(Number(order.id)) || []));
  }

  function buildMerchReports({ startDate = null, endDate = null } = {}) {
    const allOrders = loadMerchOrders({ startDate, endDate });
    // Reports keep the normal confirmed-order visibility rules, while the live
    // feed must also see orders immediately after checkout creates them.
    const notificationOrders = loadMerchOrders({ startDate, endDate, includeUnconfirmed: true });
    const products = loadMerchProductCatalog({ includeInactive: true });
    const profiles = db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile AS phone,
               avatar_url AS avatarUrl, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles`
      )
      .all();
    const influencers = loadMerchInfluencers();
    const influencerById = new Map(influencers.map((influencer) => [Number(influencer.id), influencer]));
    const coupons = db
      .prepare(
        `SELECT c.id, c.code, c.coupon_type AS couponType, c.active, c.influencer_id AS influencerId,
                c.expires_at AS expiresAt, c.valid_till AS validTill,
                c.created_at AS createdAt,
                COUNT(cr.id) AS totalRedemptions
         FROM coupons c
         LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
         WHERE c.portal = 'merch'
         GROUP BY c.id`
      )
      .all();

    const paidOrders = allOrders.filter((order) => String(order.paymentStatus || '').toLowerCase() === 'paid');
    const revenue = paidOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const refunds = allOrders.filter((order) => String(order.paymentStatus || '').toLowerCase() === 'refunded').reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const discounts = allOrders.reduce((sum, order) => sum + Number(order.discountAmount || 0), 0);
    const gst = allOrders.reduce((sum, order) => sum + Number(order.gstAmount || 0), 0);
    const shipping = allOrders.reduce((sum, order) => sum + Number(order.shippingCharge || 0), 0);
    const uniqueCustomers = new Set(allOrders.map((order) => normalizeMerchCustomerEmail(order.customerEmail)).filter(Boolean));
    const repeatCustomers = new Set();
    const ordersByEmail = new Map();

    for (const order of allOrders) {
      const key = normalizeMerchCustomerEmail(order.customerEmail);
      if (!key) continue;
      ordersByEmail.set(key, (ordersByEmail.get(key) || 0) + 1);
    }
    for (const [email, count] of ordersByEmail.entries()) {
      if (count > 1) repeatCustomers.add(email);
    }

    const statusCounts = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
    };
    for (const order of allOrders) {
      const status = String(order.status || 'pending').toLowerCase();
      if (statusCounts[status] != null) {
        statusCounts[status] += 1;
      }
    }

    const revenueByDate = new Map();
    const monthlyInfluencerMap = new Map();
    for (const order of paidOrders) {
      const dateKey = getMerchDateKey(order.createdAt);
      if (!dateKey) continue;
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(order.totalAmount || 0));
    }
    for (const order of allOrders) {
      const influencerId = Number(order.influencerId || 0);
      const monthKey = getMerchDateKey(order.createdAt).slice(0, 7);
      if (!influencerId || !monthKey) continue;

      const influencer = influencerById.get(influencerId) || null;
      const entryKey = `${monthKey}:${influencerId}`;
      const existing = monthlyInfluencerMap.get(entryKey) || {
        month: monthKey,
        influencerId,
        name: String(order.influencerName || influencer?.name || 'Unknown Influencer'),
        handle: String(influencer?.handle || ''),
        orders: 0,
        revenue: 0,
        commission: 0,
        couponUsage: 0,
      };

      const orderRevenue = Number(order.totalAmount || 0);
      existing.orders += 1;
      existing.revenue += orderRevenue;
      existing.commission += Math.max(0, Number(order.commissionAmountPaise || 0));
      if (String(order.couponCode || '').trim()) {
        existing.couponUsage += 1;
      }
      monthlyInfluencerMap.set(entryKey, existing);
    }

    const monthlyRevenueMap = new Map();
    for (const order of paidOrders) {
      const monthKey = getMerchDateKey(order.createdAt).slice(0, 7);
      if (!monthKey) continue;
      const entry = monthlyRevenueMap.get(monthKey) || { month: monthKey, revenue: 0, orders: 0 };
      entry.revenue += Number(order.totalAmount || 0);
      entry.orders += 1;
      monthlyRevenueMap.set(monthKey, entry);
    }

    const recentPayments = allOrders
      .filter((order) => ['paid', 'cod_pending', 'refunded'].includes(String(order.paymentStatus || '').toLowerCase()) || Number(order.totalAmount || 0) > 0)
      .slice(0, 5)
      .map((order) => ({
        id: Number(order.id),
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        amount: Number(order.totalAmount || 0),
        paymentMethod: String(order.paymentMethod || 'online'),
        paymentStatus: String(order.paymentStatus || 'pending'),
        createdAt: order.createdAt || null,
        status: String(order.status || 'pending'),
      }));

    const recentCouponUsage = allOrders
      .filter((order) => String(order.couponCode || '').trim())
      .slice(0, 5)
      .map((order) => ({
        id: Number(order.id),
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        couponCode: String(order.couponCode || ''),
        influencerName: String(order.influencerName || ''),
        amount: Number(order.totalAmount || 0),
        createdAt: order.createdAt || null,
      }));

    const recentCustomers = profiles
      .map((profile) => {
        const profileEmail = normalizeMerchCustomerEmail(profile.email);
        const profileId = Number(profile.id || 0);
        const userId = Number(profile.userId || 0);
        const matchingOrders = allOrders.filter((order) => {
          if (profileId && Number(order.customerId || 0) === profileId) return true;
          if (userId && Number(order.customerUserId || 0) === userId) return true;
          if (profileEmail && normalizeMerchCustomerEmail(order.customerEmail) === profileEmail) return true;
          return false;
        });
        const lastOrder = matchingOrders[0] || null;
        return {
          id: profileId,
          name: String(profile.fullName || profile.email || 'Customer'),
          email: String(profile.email || ''),
          phone: String(profile.phone || ''),
          avatarUrl: String(profile.avatarUrl || ''),
          merchandiseOrders: matchingOrders.length,
          registrationDate: profile.createdAt || lastOrder?.createdAt || null,
          lastOrder: lastOrder
            ? {
                orderNumber: lastOrder.orderNumber,
                createdAt: lastOrder.createdAt || null,
                status: lastOrder.status || 'pending',
              }
            : null,
        };
      })
      .sort((left, right) => String(right.registrationDate || right.lastOrder?.createdAt || '').localeCompare(String(left.registrationDate || left.lastOrder?.createdAt || '')))
      .slice(0, 5);

    const notifications = [];
    const pushNotification = ({ id, type, title, message, time, read = false }) => {
      if (!time) return;
      notifications.push({ id: String(id), type, title, message, time, read });
    };

    for (const product of products
      .filter((item) => !item.archived && Number(item.stock || 0) <= LOW_STOCK_THRESHOLD)
      .sort((left, right) => Number(left.stock || 0) - Number(right.stock || 0))) {
      pushNotification({
        id: `stock-${product.id}`,
        type: Number(product.stock || 0) === 0 ? 'Out of Stock' : 'Low Stock',
        title: Number(product.stock || 0) === 0 ? 'Out of Stock' : 'Low Stock',
        message: Number(product.stock || 0) === 0
          ? `${product.name} is out of stock.`
          : `${product.name} has only ${Number(product.stock || 0)} units remaining.`,
        time: product.updatedAt || product.createdAt || new Date().toISOString(),
      });
    }

    for (const order of notificationOrders.slice(0, 10)) {
      pushNotification({
        id: `order-${order.id}`,
        type: 'New Order',
        title: 'New Order',
        message: `${order.orderNumber} placed by ${order.customerName || 'a customer'}.`,
        time: order.createdAt,
      });
      if (order.influencerName || order.couponCode) {
        pushNotification({
          id: `referral-${order.id}`,
          type: 'Influencer Referral',
          title: 'Influencer Referral',
          message: `${order.orderNumber} used ${order.couponCode || 'an assigned influencer coupon'}.`,
          time: order.createdAt,
          read: true,
        });
      }
      const paymentStatus = String(order.paymentStatus || '').toLowerCase();
      if (['failed', 'failure'].includes(paymentStatus)) {
        pushNotification({
          id: `payment-failed-${order.id}`,
          type: 'Payment Failed',
          title: 'Payment Failed',
          message: `${order.orderNumber} payment failed.`,
          time: order.updatedAt || order.createdAt,
        });
      } else if (['paid', 'cod_pending'].includes(paymentStatus)) {
        pushNotification({
          id: `payment-${order.id}`,
          type: 'Payment Received',
          title: 'Payment Received',
          message: `Payment received for ${order.orderNumber}.`,
          time: order.updatedAt || order.createdAt,
          read: true,
        });
      }
      const orderStatus = String(order.status || '').toLowerCase();
      if (['cancelled', 'returned'].includes(orderStatus)) {
        pushNotification({
          id: `order-status-${order.id}`,
          type: 'Order Cancelled',
          title: orderStatus === 'returned' ? 'Order Returned' : 'Order Cancelled',
          message: `${order.orderNumber} was ${orderStatus}.`,
          time: order.updatedAt || order.createdAt,
          read: true,
        });
      }
    }

    for (const customer of recentCustomers) {
      pushNotification({
        id: `customer-${customer.id}`,
        type: 'New Customer',
        title: 'New Customer',
        message: `${customer.name} created a new merch account.`,
        time: customer.registrationDate,
        read: true,
      });
    }

    const now = Date.now();
    for (const coupon of coupons) {
      const expiry = String(coupon.expiresAt || coupon.validTill || '').trim();
      const expiryTime = expiry ? new Date(expiry.replace(' ', 'T')).getTime() : NaN;
      if (Number.isFinite(expiryTime) && expiryTime > now && expiryTime - now <= 14 * 24 * 60 * 60 * 1000) {
        pushNotification({
          id: `coupon-${coupon.id}`,
          type: 'Coupon Expiring',
          title: 'Coupon Expiring',
          message: `${coupon.code} expires on ${expiry}.`,
          time: coupon.updatedAt || coupon.createdAt || expiry,
          read: true,
        });
      }
    }

    notifications.sort((left, right) => new Date(right.time).getTime() - new Date(left.time).getTime());

    const orderItemStats = new Map();
    for (const order of allOrders) {
      for (const item of order.items || []) {
        const product = products.find((entry) => entry.primarySku === item.sku || entry.variants.some((variant) => variant.sku === item.sku)) || null;
        const productId = Number(product?.id || 0);
        if (!productId) continue;
        const existing = orderItemStats.get(productId) || { quantity: 0, revenue: 0, orders: new Set() };
        existing.quantity += Number(item.qty || 0);
        existing.revenue += Number(item.lineTotal || 0);
        existing.orders.add(order.id);
        orderItemStats.set(productId, existing);
      }
    }

    const topProducts = [...products]
      .map((product) => {
        const stats = orderItemStats.get(Number(product.id)) || { quantity: 0, revenue: 0, orders: new Set() };
        return {
          id: product.id,
          name: product.name,
          category: product.category,
          priceLabel: product.priceLabel,
          stock: product.stock,
          quantity: stats.quantity,
          revenue: stats.revenue,
          orders: stats.orders.size,
          sales: product.sales,
        };
      })
      .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity || right.sales - left.sales)
      .slice(0, 5);

    const categoryStats = new Map();
    for (const product of products) {
      const stats = orderItemStats.get(Number(product.id)) || { quantity: 0, revenue: 0, orders: new Set() };
      const key = String(product.category || 'Uncategorized');
      const existing = categoryStats.get(key) || { name: key, quantity: 0, revenue: 0, orders: 0, products: 0 };
      existing.quantity += stats.quantity;
      existing.revenue += stats.revenue;
      existing.orders += stats.orders.size;
      existing.products += 1;
      categoryStats.set(key, existing);
    }

    const dailyRevenue = [...revenueByDate.entries()]
      .sort(([left], [right]) => String(left).localeCompare(String(right)))
      .map(([date, value]) => ({
        label: date,
        value,
        display: formatMerchPrice(value),
      }));

    const monthlyRevenueSeries = [...monthlyRevenueMap.values()]
      .sort((left, right) => String(left.month).localeCompare(String(right.month)))
      .map((row) => ({
        month: row.month,
        monthLabel: formatMerchReportMonth(row.month),
        revenue: row.revenue,
        orders: row.orders,
        display: formatMerchPrice(row.revenue),
      }));

    return {
      dateRange: {
        startDate,
        endDate,
      },
      summary: {
        orderCount: allOrders.length,
        paidOrders: paidOrders.length,
        revenue,
        refunds,
        discounts,
        gst,
        shipping,
        netRevenue: Math.max(0, revenue - refunds - discounts),
        averageOrderValue: paidOrders.length ? Math.round(revenue / paidOrders.length) : 0,
        customerCount: uniqueCustomers.size || profiles.length,
        repeatCustomerCount: repeatCustomers.size,
        productCount: products.length,
        lowStockCount: products.filter((product) => !product.archived && Number(product.stock || 0) <= LOW_STOCK_THRESHOLD).length,
        activeCouponCount: coupons.filter((coupon) => Number(coupon.active ?? 0) === 1).length,
      },
      lowStockProducts: products
        .filter((product) => !product.archived && Number(product.stock || 0) <= LOW_STOCK_THRESHOLD)
        .map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,
          sku: product.primarySku || product.sku || '',
          stock: Number(product.stock || 0),
          threshold: LOW_STOCK_THRESHOLD,
          priceLabel: product.priceLabel,
        }))
        .sort((left, right) => left.stock - right.stock || String(left.name).localeCompare(String(right.name))),
      statusBreakdown: statusCounts,
      revenueSeries: dailyRevenue,
      monthlyRevenueSeries,
      topProducts,
      productSales: [...orderItemStats.entries()]
        .map(([productId, stats]) => {
          const product = products.find((item) => Number(item.id) === Number(productId));
          return {
            id: productId,
            name: product?.name || `Product ${productId}`,
            category: product?.category || 'Uncategorized',
            quantity: stats.quantity,
            revenue: stats.revenue,
            orders: stats.orders.size,
          };
        })
        .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity),
      topCategories: [...categoryStats.values()]
        .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity)
        .slice(0, 5),
      monthlyInfluencerReports: [...monthlyInfluencerMap.values()]
        .sort((left, right) => String(right.month).localeCompare(String(left.month)) || right.revenue - left.revenue || right.orders - left.orders)
        .map((row) => ({
          month: row.month,
          monthLabel: formatMerchReportMonth(row.month),
          influencerId: row.influencerId,
          name: row.name,
          handle: row.handle,
          orders: row.orders,
          revenue: row.revenue,
          commission: row.commission,
          couponUsage: row.couponUsage,
        })),
      influencerReports: influencers
        .map((influencer) => ({
          id: influencer.id,
          name: influencer.name,
          handle: influencer.handle,
          coupons: influencer.coupons,
          orders: influencer.totalOrders,
          revenue: influencer.revenue,
          couponUsage: influencer.couponUsage,
          commissionRate: influencer.commissionRate,
          commission: influencer.commission,
        }))
        .sort((left, right) => right.revenue - left.revenue || right.orders - left.orders),
      recentPayments,
      recentCouponUsage,
      recentCustomers,
      recentOrders: allOrders.slice(0, 5),
      notifications: notifications.slice(0, 25),
    };
  }

  function getBookingUserById(userId) {
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) return null;
    return db
      .prepare(
        `SELECT id, name, email, mobile, avatar_url AS avatarUrl
         FROM users
         WHERE id = ?`
      )
      .get(numericUserId);
  }

  function getMerchAuthToken(req) {
    const authorizationHeader = String(req.headers.authorization || '').trim();
    const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
      ? authorizationHeader.slice(7).trim()
      : '';
    return String(req.cookies?.booking_portal_token || bearerToken || '').trim();
  }

  function getMerchAuthUser(req) {
    const token = getMerchAuthToken(req);
    if (!token) return null;

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = getBookingUserById(Number(payload.sub));
      if (!user) return null;
      return {
        id: Number(user.id),
        name: String(user.name || ''),
        email: String(user.email || ''),
        mobile: String(user.mobile || ''),
        avatarUrl: String(user.avatarUrl || ''),
      };
    } catch {
      return null;
    }
  }

  function getMerchCustomerProfileByUserId(userId) {
    const numericUserId = Number(userId);
    if (!Number.isInteger(numericUserId)) return null;
    return db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile, avatar_url AS avatarUrl,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles
         WHERE user_id = ?`
      )
      .get(numericUserId);
  }

  function ensureMerchCustomerProfileForUser(user) {
    const bookingUser = user?.id ? getBookingUserById(user.id) : null;
    if (!bookingUser) return null;

    const normalizedUserId = Number(bookingUser.id);
    const nextName = String(bookingUser.name || user?.name || '').trim();
    const nextEmail = String(bookingUser.email || user?.email || '').trim().toLowerCase();
    const nextMobile = String(bookingUser.mobile || user?.mobile || '').trim();
    const nextAvatarUrl = String(bookingUser.avatarUrl || user?.avatarUrl || '').trim();

    const existing = getMerchCustomerProfileByUserId(normalizedUserId);
    if (existing) {
      const updates = [];
      const params = [];
      if (nextName && nextName !== existing.fullName) {
        updates.push('full_name = ?');
        params.push(nextName);
      }
      if (nextEmail && nextEmail !== existing.email) {
        updates.push('email = ?');
        params.push(nextEmail);
      }
      if (nextMobile && nextMobile !== String(existing.mobile || '')) {
        updates.push('mobile = ?');
        params.push(nextMobile);
      }
      if (nextAvatarUrl !== String(existing.avatarUrl || '')) {
        updates.push('avatar_url = ?');
        params.push(nextAvatarUrl || null);
      }
      if (updates.length) {
        updates.push("updated_at = datetime('now')");
        db.prepare(`UPDATE merch_customer_profiles SET ${updates.join(', ')} WHERE user_id = ?`).run(...params, normalizedUserId);
      }
      return getMerchCustomerProfileByUserId(normalizedUserId);
    }

    const result = db
      .prepare(
        `INSERT INTO merch_customer_profiles (user_id, full_name, email, mobile, avatar_url, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(
        normalizedUserId,
        nextName || 'House of Health Customer',
        nextEmail || `customer-${normalizedUserId}@h2houseofhealth.local`,
        nextMobile || null,
        nextAvatarUrl || null
      );

    return db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile, avatar_url AS avatarUrl,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles
         WHERE id = ?`
      )
      .get(result.lastInsertRowid);
  }

  function parseMerchShippingAddress(rawValue) {
    if (!rawValue) return null;
    if (typeof rawValue === 'object') return rawValue;
    const text = String(rawValue || '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  function formatMerchAddressLine(address = {}) {
    const label = String(address.label || address.name || '').trim();
    const recipientName = String(address.recipientName || address.recipient_name || '').trim();
    const phone = String(address.phone || '').trim();
    const line1 = String(address.line1 || address.addressLine1 || '').trim();
    const line2 = String(address.line2 || address.addressLine2 || '').trim();
    const city = String(address.city || '').trim();
    const state = String(address.state || '').trim();
    const postalCode = String(address.postalCode || address.postal_code || '').trim();
    const country = String(address.country || '').trim();
    const fullAddress = String(address.full || address.address || address.value || '').trim();
    const locationParts = [line1, line2, city, state, postalCode, country].filter(Boolean);
    if (!locationParts.length && fullAddress) {
      locationParts.push(fullAddress);
    }
    const prefixParts = [label || recipientName, phone].filter(Boolean);
    return [prefixParts.join(' - '), locationParts.join(', ')].filter(Boolean).join(' - ').trim();
  }

  function getMerchCustomerActivityTimestamp(value) {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function normalizeMerchCustomerEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function normalizeMerchCustomerPhone(value) {
    return String(value || '').trim().replace(/\D+/g, '');
  }

  function getMerchCustomerProfileByEmail(email) {
    const normalizedEmail = normalizeMerchCustomerEmail(email);
    if (!normalizedEmail) return null;
    return db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile, avatar_url AS avatarUrl,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles
         WHERE LOWER(TRIM(email)) = ?
         LIMIT 1`
      )
      .get(normalizedEmail);
  }

  function normalizeMerchAddressPayload(rawValue = {}, fallback = {}) {
    const parsed = parseMerchShippingAddress(rawValue) || {};
    const fullAddress = String(parsed.full || parsed.address || parsed.value || fallback.full || '').trim();
    return {
      label: String(parsed.label || parsed.name || fallback.label || '').trim(),
      recipientName: String(parsed.recipientName || parsed.recipient_name || fallback.recipientName || fallback.recipient_name || '').trim(),
      phone: String(parsed.phone || fallback.phone || '').trim(),
      line1: String(parsed.line1 || parsed.addressLine1 || fallback.line1 || fullAddress || '').trim(),
      line2: String(parsed.line2 || parsed.addressLine2 || fallback.line2 || '').trim(),
      city: String(parsed.city || fallback.city || '').trim(),
      state: String(parsed.state || fallback.state || '').trim(),
      postalCode: String(parsed.postalCode || parsed.postal_code || fallback.postalCode || fallback.postal_code || '').trim(),
      country: String(parsed.country || fallback.country || 'India').trim() || 'India',
      full: fullAddress,
    };
  }

  function normalizeMerchAddressKey(address = {}) {
    const normalized = normalizeMerchAddressPayload(address);
    return [
      normalized.label,
      normalized.recipientName,
      normalized.phone,
      normalized.line1,
      normalized.line2,
      normalized.city,
      normalized.state,
      normalized.postalCode,
      normalized.country,
      normalized.full,
    ]
      .map((value) => String(value || '').trim().toLowerCase())
      .filter(Boolean)
      .join('|');
  }

  function getMerchCustomerAddresses(customerId) {
    return db
      .prepare(
        `SELECT id, customer_id AS customerId, label, recipient_name AS recipientName, phone, line1, line2,
                city, state, postal_code AS postalCode, country, is_default AS isDefault,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_addresses
         WHERE customer_id = ?
         ORDER BY isDefault DESC, datetime(createdAt) DESC, id DESC`
      )
      .all(customerId);
  }

  function getMerchCustomerAddressKeySet(customerId) {
    const existingAddresses = getMerchCustomerAddresses(customerId);
    return new Set(existingAddresses.map((address) => normalizeMerchAddressKey(address)));
  }

  function saveMerchCustomerAddress(customerId, address, { isDefault = false, addressKeySet = null } = {}) {
    const normalized = normalizeMerchAddressPayload(address);
    if (!normalized.recipientName || !normalized.phone || !normalized.line1) {
      return false;
    }

    const key = normalizeMerchAddressKey(normalized);
    if (!key) return false;
    if (addressKeySet?.has(key)) return false;

    if (addressKeySet) {
      addressKeySet.add(key);
    }

    const existingCount = db
      .prepare('SELECT COUNT(*) AS count FROM merch_customer_addresses WHERE customer_id = ?')
      .get(customerId).count;
    const shouldSetDefault = Boolean(isDefault) || existingCount === 0;

    if (shouldSetDefault) {
      db.prepare('UPDATE merch_customer_addresses SET is_default = 0 WHERE customer_id = ?').run(customerId);
    }

    db
      .prepare(
        `INSERT INTO merch_customer_addresses
          (customer_id, label, recipient_name, phone, line1, line2, city, state, postal_code, country, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(
        customerId,
        normalized.label || null,
        normalized.recipientName,
        normalized.phone,
        normalized.line1,
        normalized.line2 || null,
        normalized.city || null,
        normalized.state || null,
        normalized.postalCode || null,
        normalized.country,
        shouldSetDefault ? 1 : 0
      );

    return true;
  }

  function getMerchCustomerProfileByUserIdOrEmail(userId, email) {
    const byUser = getMerchCustomerProfileByUserId(userId);
    const byEmail = getMerchCustomerProfileByEmail(email);
    if (byUser && byEmail && Number(byUser.id) !== Number(byEmail.id)) {
      return { primary: byUser, duplicate: byEmail };
    }
    return { primary: byUser || byEmail || null, duplicate: null };
  }

  function mergeMerchCustomerProfiles(primaryProfileId, duplicateProfileId) {
    const primaryId = Number(primaryProfileId);
    const duplicateId = Number(duplicateProfileId);
    if (!Number.isInteger(primaryId) || !Number.isInteger(duplicateId) || primaryId <= 0 || duplicateId <= 0 || primaryId === duplicateId) {
      return false;
    }

    db.prepare('UPDATE merch_orders SET customer_id = ? WHERE customer_id = ?').run(primaryId, duplicateId);
    db.prepare('UPDATE merch_customer_addresses SET customer_id = ? WHERE customer_id = ?').run(primaryId, duplicateId);
    db.prepare('UPDATE merch_customer_cart_items SET customer_id = ? WHERE customer_id = ?').run(primaryId, duplicateId);
    db.prepare('UPDATE merch_customer_wishlist_items SET customer_id = ? WHERE customer_id = ?').run(primaryId, duplicateId);
    db.prepare('DELETE FROM merch_customer_profiles WHERE id = ?').run(duplicateId);
    return true;
  }

  function getMerchGuestOrdersByEmail(email) {
    const normalizedEmail = normalizeMerchCustomerEmail(email);
    if (!normalizedEmail) return [];

    return db.prepare(
      `SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_email AS customerEmail,
              customer_phone AS customerPhone, guest_name AS guestName, guest_email AS guestEmail,
              guest_phone AS guestPhone, is_guest AS isGuest, shipping_address AS shippingAddress,
              billing_address AS billingAddress, created_at AS createdAt, updated_at AS updatedAt,
              customer_user_id AS customerUserId, customer_id AS customerId
       FROM merch_orders
       WHERE LOWER(TRIM(customer_email)) = ?
         AND (COALESCE(customer_user_id, 0) = 0 OR COALESCE(is_guest, 0) = 1)
       ORDER BY datetime(created_at) DESC, id DESC`
    ).all(normalizedEmail);
  }

  function syncMerchGuestOrdersForUser(user) {
    const bookingUser = user?.id ? getBookingUserById(user.id) : null;
    const normalizedUserId = Number(bookingUser?.id || user?.id || 0);
    const normalizedEmail = normalizeMerchCustomerEmail(bookingUser?.email || user?.email || '');
    if (!Number.isInteger(normalizedUserId) || normalizedUserId <= 0 || !normalizedEmail) {
      return null;
    }

    const guestOrders = getMerchGuestOrdersByEmail(normalizedEmail);
    const { primary, duplicate } = getMerchCustomerProfileByUserIdOrEmail(normalizedUserId, normalizedEmail);
    let profile = primary;

    const latestGuestOrder = guestOrders[0] || null;
    const baseName = String(bookingUser?.name || user?.name || '').trim();
    const latestName = String(latestGuestOrder?.guestName || latestGuestOrder?.customerName || '').trim();
    const latestPhone = String(latestGuestOrder?.guestPhone || latestGuestOrder?.customerPhone || '').trim();
    const latestAvatarUrl = String(bookingUser?.avatarUrl || user?.avatarUrl || '').trim();
    const latestEmail = normalizedEmail;

    const transaction = db.transaction(() => {
      if (duplicate && profile && Number(duplicate.id) !== Number(profile.id)) {
        mergeMerchCustomerProfiles(profile.id, duplicate.id);
        profile = getMerchCustomerProfileByUserId(normalizedUserId) || getMerchCustomerProfileByEmail(normalizedEmail) || profile;
      }

      if (!profile) {
        const seedName = baseName || latestName || 'House of Health Customer';
        const seedMobile = String(bookingUser?.mobile || user?.mobile || latestPhone || '').trim();
        const insertResult = db
          .prepare(
            `INSERT INTO merch_customer_profiles (user_id, full_name, email, mobile, avatar_url, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          )
          .run(
            normalizedUserId,
            seedName,
            latestEmail,
            seedMobile || null,
            latestAvatarUrl || null
          );
        profile = db
          .prepare(
            `SELECT id, user_id AS userId, full_name AS fullName, email, mobile, avatar_url AS avatarUrl,
                    created_at AS createdAt, updated_at AS updatedAt
             FROM merch_customer_profiles
             WHERE id = ?`
          )
          .get(insertResult.lastInsertRowid);
      }

      const updates = [];
      const params = [];
      if (Number(profile.userId || 0) !== normalizedUserId) {
        updates.push('user_id = ?');
        params.push(normalizedUserId);
      }
      if (baseName && baseName !== String(profile.fullName || '').trim()) {
        updates.push('full_name = ?');
        params.push(baseName);
      } else if (!String(profile.fullName || '').trim() && latestName) {
        updates.push('full_name = ?');
        params.push(latestName);
      }
      if (latestEmail && latestEmail !== normalizeMerchCustomerEmail(profile.email)) {
        updates.push('email = ?');
        params.push(latestEmail);
      }
      const nextMobile = String(profile.mobile || '').trim() || String(bookingUser?.mobile || user?.mobile || latestPhone || '').trim();
      if (nextMobile && nextMobile !== String(profile.mobile || '').trim()) {
        updates.push('mobile = ?');
        params.push(nextMobile);
      }
      if (latestAvatarUrl && latestAvatarUrl !== String(profile.avatarUrl || '').trim()) {
        updates.push('avatar_url = ?');
        params.push(latestAvatarUrl);
      }
      if (updates.length) {
        updates.push("updated_at = datetime('now')");
        db.prepare(`UPDATE merch_customer_profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params, Number(profile.id));
      }

      const profileId = Number(profile.id);
      const addressKeySet = getMerchCustomerAddressKeySet(profileId);
      let markedDefault = false;
      for (const order of guestOrders) {
        const shippingAddress = parseMerchShippingAddress(order.shippingAddress);
        const billingAddress = parseMerchShippingAddress(order.billingAddress);
        if (shippingAddress) {
          const saved = saveMerchCustomerAddress(profileId, shippingAddress, {
            isDefault: !markedDefault,
            addressKeySet,
          });
          if (saved && !markedDefault) {
            markedDefault = true;
          }
        }
        if (billingAddress) {
          saveMerchCustomerAddress(profileId, billingAddress, {
            isDefault: !markedDefault && !shippingAddress,
            addressKeySet,
          });
        }
      }

      if (guestOrders.length) {
        db.prepare(
          `UPDATE merch_orders
           SET customer_user_id = ?, customer_id = ?, is_guest = 0, updated_at = datetime('now')
           WHERE LOWER(TRIM(customer_email)) = ?
             AND (COALESCE(customer_user_id, 0) = 0 OR COALESCE(is_guest, 0) = 1)`
        ).run(normalizedUserId, profileId, normalizedEmail);
      }
    });

    transaction();
    return profile ? getMerchCustomerProfileByUserId(normalizedUserId) || getMerchCustomerProfileByEmail(normalizedEmail) || profile : null;
  }

  app.locals.merchGuestOrderSync = syncMerchGuestOrdersForUser;
  app.locals.merchCustomerProfileSync = ensureMerchCustomerProfileForUser;

  function addMerchCustomerAddress(customer, address, source = 'saved') {
    const text = formatMerchAddressLine(address);
    if (!text) return;

    if (!customer._addressKeys) customer._addressKeys = new Set();
    const key = text.toLowerCase();
    if (customer._addressKeys.has(key)) return;

    customer._addressKeys.add(key);
    customer.addresses.push({
      label: String(address.label || address.name || '').trim(),
      text,
      source,
      isDefault: Number(address.isDefault || address.is_default || 0) === 1,
    });
  }

  function createMerchCustomerRecord(seed = {}) {
    return {
      id: seed.id,
      profileId: seed.profileId || null,
      userId: seed.userId || null,
      name: String(seed.name || '').trim(),
      email: String(seed.email || '').trim().toLowerCase(),
      phone: String(seed.phone || '').trim(),
      avatarUrl: String(seed.avatarUrl || '').trim(),
      registrationDate: seed.registrationDate || null,
      merchandiseOrders: 0,
      lifetimeMerchSpend: 0,
      couponDiscountTotal: 0,
      couponRedemptions: [],
      lastOrder: null,
      lastOrderAt: 0,
      addresses: [],
      addressCount: 0,
    };
  }

  function finalizeMerchCustomerRecord(customer) {
    delete customer._addressKeys;
    customer.addressCount = Array.isArray(customer.addresses) ? customer.addresses.length : 0;
    customer.addressSummary = customer.addressCount
      ? customer.addresses.slice(0, 2).map((address) => address.text).join(' | ') + (customer.addressCount > 2 ? ` +${customer.addressCount - 2} more` : '')
      : 'No saved addresses';
    customer.lastOrderLabel = customer.lastOrder?.orderNumber
      ? `${customer.lastOrder.orderNumber}${customer.lastOrder.createdAt ? ` - ${customer.lastOrder.createdAt}` : ''}`
      : 'No orders yet';
    customer.registrationDate = customer.registrationDate || customer.lastOrder?.createdAt || null;
    customer.merchandiseOrders = Number(customer.merchandiseOrders || 0);
    customer.lifetimeMerchSpend = Number(customer.lifetimeMerchSpend || 0);
    customer.couponDiscountTotal = Number(customer.couponDiscountTotal || 0);
    customer.couponRedemptions = Array.isArray(customer.couponRedemptions) ? customer.couponRedemptions : [];
    return customer;
  }

  function requireMerchAuth(req, res, next) {
    const user = getMerchAuthUser(req);
    if (!user) {
      return res.status(401).json({ message: 'unauthorized' });
    }

    req.user = user;
    return next();
  }

  // ─── Helper: Generate order number ───
  function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `HM-${date}-${rand}`;
  }

  // ─── Auth middleware (optional - for admin) ───
  function getMerchOrderEmailData(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) return null;
    const order = db.prepare(`
      SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_email AS customerEmail,
             customer_phone AS customerPhone, subtotal, gst_amount AS gstAmount, shipping_charge AS shippingCharge,
             discount_amount AS discountAmount, total_amount AS totalAmount, payment_method AS paymentMethod,
             payment_status AS paymentStatus, shipping_address AS shippingAddress, created_at AS createdAt
      FROM merch_orders
      WHERE id = ?
      LIMIT 1
    `).get(id);
    if (!order) return null;
    const items = db.prepare(`
      SELECT oi.id, oi.product_name AS productName, oi.variant_label AS variantLabel, oi.sku,
             oi.unit_price AS unitPrice, oi.quantity, oi.line_total AS lineTotal,
             p.image_url AS imageUrl
      FROM merch_order_items oi
      LEFT JOIN merch_variants v ON v.id = oi.variant_id
      LEFT JOIN merch_products p ON p.id = v.product_id
      WHERE oi.order_id = ?
      ORDER BY oi.id ASC
    `).all(id);
    return { order, items };
  }

  function buildMerchEmailLinks(req, orderId) {
    const origin = getMerchEmailOrigin(req);
    return {
      home: `${origin}/`,
      shop: `${origin}/merch/`,
      track: `${origin}/merch/#track-order/${encodeURIComponent(String(orderId || ''))}`,
      logo: getMerchEmailAssetUrl(req, '/cdn/shop/files/H2_Logo9664.png?v=1767874858&width=240'),
      hero: getMerchEmailAssetUrl(req, '/booking/assets/invoice-page.png'),
      leaf: getMerchEmailAssetUrl(req, '/booking/assets/leaf.png'),
      placeholder: getMerchEmailAssetUrl(req, '/cdn/shop/files/H2_Logo9664.png?v=1767874858&width=400'),
      email: 'mailto:hello@h2houseofhealth.com',
      phone: 'tel:+919876543210',
      instagram: process.env.H2_INSTAGRAM_URL || origin,
      facebook: process.env.H2_FACEBOOK_URL || origin,
      youtube: process.env.H2_YOUTUBE_URL || origin,
    };
  }

  function buildMerchOrderConfirmationText({ order, items, expectedDelivery, links }) {
    return [
      `Hi ${order.customerName || 'there'},`,
      '',
      'Thank you. Your H2 House of Health merchandise order is confirmed.',
      '',
      `Order ID: ${order.orderNumber || `Order #${order.id}`}`,
      `Order Date: ${formatMerchEmailDateTime(order.createdAt) || order.createdAt || ''}`,
      `Payment Status: ${String(order.paymentStatus || 'paid').toUpperCase()}`,
      `Payment Method: ${String(order.paymentMethod || 'online').toUpperCase()}`,
      `Customer Email: ${order.customerEmail || ''}`,
      '',
      'Order Summary:',
      ...items.map((item) => `- ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''} x ${item.quantity}: Rs. ${(Number(item.lineTotal || 0) / 100).toFixed(2)}`),
      '',
      `Subtotal: Rs. ${(Number(order.subtotal || 0) / 100).toFixed(2)}`,
      `Shipping: Rs. ${(Number(order.shippingCharge || 0) / 100).toFixed(2)}`,
      `GST (inclusive): Rs. ${(Number(order.gstAmount || 0) / 100).toFixed(2)}`,
      `Total Paid: Rs. ${(Number(order.totalAmount || 0) / 100).toFixed(2)}`,
      '',
      `Expected Delivery: ${expectedDelivery}`,
      `Track My Order: ${links.track}`,
      `Continue Shopping: ${links.shop}`,
      '',
      'Need help with your order? Contact hello@h2houseofhealth.com or +91 98765 43210.',
    ].join('\n');
  }

  function buildMerchOrderConfirmationHtml({ order, items, req }) {
    const links = buildMerchEmailLinks(req, order.id);
    const expectedStart = addMerchEmailDays(order.createdAt, 5);
    const expectedEnd = addMerchEmailDays(order.createdAt, 9);
    const expectedDelivery = `${formatMerchEmailDate(expectedStart)} - ${formatMerchEmailDate(expectedEnd)}`;
    const shippingAddress = formatMerchAddressLine(parseMerchShippingAddress(order.shippingAddress) || {}) || 'H2 House of Health, Hyderabad';
    const firstItem = items[0] || {};
    const productImage = getMerchEmailAssetUrl(req, firstItem.imageUrl || links.placeholder);
    const primaryItemName = firstItem.productName || 'H2 House Merch';
    const primaryVariant = firstItem.variantLabel || firstItem.sku || 'Standard';
    const totalQuantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 1;
    const itemRows = items.map((item) => `
      <tr>
        <td class="item-name" style="padding:9px 22px;color:#14233b;font-size:14px;line-height:20px;word-break:break-word;">${escapeHtml(item.productName || 'H2 House Merch')}</td>
        <td class="item-qty" align="center" style="padding:9px 8px;color:#14233b;font-size:14px;line-height:20px;white-space:nowrap;">${escapeHtml(String(item.quantity || 1))}</td>
        <td class="item-price" align="right" style="padding:9px 22px;color:#14233b;font-size:14px;line-height:20px;white-space:nowrap;">${formatMerchEmailCurrency(item.lineTotal || 0)}</td>
      </tr>
    `).join('');
    const text = buildMerchOrderConfirmationText({ order, items, expectedDelivery, links });
    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Your H2 order is confirmed</title>
    <style>
      body, table, td, p, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
      img { -ms-interpolation-mode: bicubic; }
      .product-name { overflow-wrap: break-word; word-break: break-word; }
      .price-table-value, .total-value, .product-price, .item-price, .item-qty { white-space: nowrap; }
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; max-width: 600px !important; }
        .mobile-pad { padding-left: 20px !important; padding-right: 20px !important; }
        .mobile-top-pad { padding-top: 22px !important; }
        .mobile-stack { display: block !important; width: 100% !important; }
        .mobile-center { text-align: center !important; }
        .mobile-left { text-align: left !important; }
        .mobile-button { display: block !important; width: 100% !important; min-height: 44px !important; box-sizing: border-box !important; }
        .mobile-button-wrap { display: block !important; width: 100% !important; padding-left: 0 !important; padding-right: 0 !important; padding-bottom: 12px !important; }
        .mobile-logo { width: 142px !important; max-width: 142px !important; margin: 0 auto !important; }
        .mobile-help { padding-top: 16px !important; text-align: center !important; }
        .hero-pad { padding-top: 18px !important; padding-bottom: 24px !important; }
        .hero-copy { padding-left: 0 !important; }
        .hero-title { font-size: 42px !important; line-height: 48px !important; }
        .hero-subtitle { font-size: 24px !important; line-height: 30px !important; }
        .hero-image { width: 170px !important; margin: 18px auto 0 !important; }
        .stat-cell { display: block !important; width: 100% !important; padding: 20px 12px !important; border-right: 0 !important; border-bottom: 1px solid rgba(255,255,255,0.45) !important; }
        .stat-cell-last { border-bottom: 0 !important; }
        .product-image-cell { padding: 18px 0 8px !important; text-align: center !important; }
        .product-image { width: 100% !important; max-width: 224px !important; height: auto !important; margin: 0 auto !important; }
        .product-copy { padding: 10px 0 6px !important; }
        .product-price { padding: 6px 0 18px !important; text-align: right !important; }
        .product-name { font-size: 20px !important; line-height: 26px !important; }
        .price-table-label { font-size: 16px !important; line-height: 23px !important; }
        .price-table-value { font-size: 16px !important; line-height: 23px !important; }
        .total-label { font-size: 22px !important; line-height: 28px !important; }
        .total-value { font-size: 26px !important; line-height: 32px !important; }
        .delivery-icon { display: block !important; width: 100% !important; padding: 18px 0 4px !important; text-align: center !important; }
        .delivery-copy { display: block !important; width: 100% !important; padding: 8px 18px 18px !important; text-align: center !important; box-sizing: border-box !important; }
        .footer-logo-cell { border-right: 0 !important; border-bottom: 1px solid #d6a28c !important; padding: 0 0 18px !important; }
        .footer-copy-cell { padding: 18px 0 0 !important; }
        .footer-contact-cell { padding-top: 4px !important; }
        .footer-leaf-cell { padding-top: 18px !important; text-align: center !important; }
        .footer-leaf-cell img { margin: 0 auto !important; }
        .footer-contact { display: block !important; width: 100% !important; padding: 4px 0 !important; }
        .footer-separator { display: none !important; }
      }
      @media only screen and (max-width: 390px) {
        .mobile-pad { padding-left: 16px !important; padding-right: 16px !important; }
        .hero-title { font-size: 38px !important; line-height: 44px !important; }
        .hero-subtitle { font-size: 22px !important; line-height: 28px !important; }
        .hero-image { width: 170px !important; }
        .mobile-button { font-size: 18px !important; line-height: 24px !important; padding-left: 12px !important; padding-right: 12px !important; }
        .total-value { font-size: 24px !important; line-height: 30px !important; }
      }
      @media only screen and (max-width: 360px) {
        .mobile-pad { padding-left: 14px !important; padding-right: 14px !important; }
        .hero-title { font-size: 34px !important; line-height: 40px !important; }
        .hero-subtitle { font-size: 20px !important; line-height: 26px !important; }
        .hero-image { width: 154px !important; }
        .stat-cell { padding: 18px 10px !important; }
        .product-image { max-width: 196px !important; }
        .price-table-label, .price-table-value { padding-left: 10px !important; padding-right: 10px !important; }
        .total-label { font-size: 20px !important; line-height: 26px !important; padding-left: 10px !important; padding-right: 8px !important; }
        .total-value { font-size: 22px !important; line-height: 28px !important; padding-left: 8px !important; padding-right: 10px !important; }
        .footer-copy-cell p { font-size: 13px !important; line-height: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f6f1ec;color:#14233b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f6f1ec;">
      <tr>
        <td align="center" style="padding:0;">
          <table role="presentation" class="email-shell" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;border-collapse:collapse;background:#fffaf7;">
            <tr>
              <td class="mobile-pad mobile-top-pad" style="padding:38px 32px 18px;background:#fffaf7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="mobile-stack mobile-center" valign="top" style="width:50%;">
                      <a href="${escapeHtml(links.home)}" style="text-decoration:none;">
                        <img class="mobile-logo" src="${escapeHtml(links.logo)}" width="154" alt="H2 House of Health logo" style="display:block;border:0;width:154px;max-width:154px;height:auto;">
                      </a>
                    </td>
                    <td class="mobile-stack mobile-center mobile-help" valign="top" align="right" style="width:50%;font-size:13px;line-height:20px;color:#14233b;">
                      <p style="margin:6px 0 5px;font-size:15px;line-height:20px;font-weight:500;color:#14233b;">Need help?</p>
                      <a href="${escapeHtml(links.email)}" style="color:#14233b;text-decoration:none;font-size:13px;line-height:18px;">hello@h2houseofhealth.com</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad hero-pad" style="padding:26px 32px 34px;background:#fffaf7;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="mobile-stack mobile-center hero-copy" valign="middle" style="width:68%;text-align:center;padding-left:80px;">
                      <h1 class="hero-title" style="margin:0;color:#ad3c22;font-family:Georgia,'Times New Roman',serif;font-size:50px;line-height:58px;font-weight:700;letter-spacing:0;">Thank You!</h1>
                      <h2 class="hero-subtitle" style="margin:2px 0 0;color:#14233b;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:34px;font-weight:700;letter-spacing:0;">Your order is confirmed.</h2>
                    </td>
                    
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad" style="padding:0 24px 34px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#b63b20;border-radius:8px;box-shadow:0 8px 18px rgba(88,36,19,0.12);">
                  <tr>
                    <td class="stat-cell" align="center" style="width:33.33%;padding:28px 14px;border-right:1px solid rgba(255,255,255,0.48);color:#ffffff;">
                      <div style="font-size:32px;line-height:32px;color:#ffffff;">&#9633;</div>
                      <p style="margin:18px 0 9px;font-size:18px;line-height:23px;font-weight:500;color:#ffffff;">Order ID</p>
                      <p style="margin:0;font-size:17px;line-height:24px;color:#ffffff;">${escapeHtml(order.orderNumber || `Order #${order.id}`)}</p>
                    </td>
                    <td class="stat-cell" align="center" style="width:33.33%;padding:28px 14px;border-right:1px solid rgba(255,255,255,0.48);color:#ffffff;">
                      <div style="font-size:32px;line-height:32px;color:#ffffff;">&#128197;</div>
                      <p style="margin:18px 0 9px;font-size:18px;line-height:23px;font-weight:500;color:#ffffff;">Order Date</p>
                      <p style="margin:0;font-size:17px;line-height:24px;color:#ffffff;">${escapeHtml(formatMerchEmailDateTime(order.createdAt) || order.createdAt || '')}</p>
                    </td>
                    <td class="stat-cell stat-cell-last" align="center" style="width:33.33%;padding:28px 14px;color:#ffffff;">
                      <div style="font-size:32px;line-height:32px;color:#ffffff;">&#10003;</div>
                      <p style="margin:18px 0 9px;font-size:18px;line-height:23px;font-weight:500;color:#ffffff;">Payment</p>
                      <p style="margin:0;font-size:17px;line-height:24px;color:#ffffff;">${escapeHtml(String(order.paymentStatus || 'paid').replace(/_/g, ' '))}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad" style="padding:0 30px 24px;">
                <h2 style="margin:0 0 14px;color:#ad3c22;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:34px;font-weight:700;">Order Summary</h2>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-top:1px solid #dcae9b;">
                  <tr>
                    <td class="mobile-stack product-image-cell" valign="top" style="width:172px;padding:18px 26px 18px 0;">
                      <img class="product-image" src="${escapeHtml(productImage)}" width="150" alt="${escapeHtml(primaryItemName)} product image" style="display:block;border:0;width:150px;max-width:150px;height:auto;border-radius:8px;background:#f5eee8;">
                    </td>
                    <td class="mobile-stack product-copy mobile-left" valign="top" style="padding:28px 0 18px;">
                      <h3 class="product-name" style="margin:0 0 18px;color:#ad3c22;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;overflow-wrap:break-word;word-break:break-word;">${escapeHtml(primaryItemName)}</h3>
                      <p style="margin:0 0 12px;color:#14233b;font-size:18px;line-height:25px;">Variant: ${escapeHtml(primaryVariant)}</p>
                      <p style="margin:0 0 12px;color:#14233b;font-size:18px;line-height:25px;">Quantity: ${escapeHtml(String(totalQuantity))}</p>
                      <p style="margin:0;color:#52606f;font-size:14px;line-height:20px;">Payment Method: ${escapeHtml(String(order.paymentMethod || 'online').toUpperCase())}</p>
                    </td>
                    <td class="mobile-stack product-price" valign="bottom" align="right" style="width:132px;padding:18px 0 22px;font-family:Georgia,'Times New Roman',serif;color:#14233b;font-size:24px;line-height:30px;font-weight:700;white-space:nowrap;">${formatMerchEmailCurrency(firstItem.lineTotal || order.totalAmount || 0)}</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e7cabb;border-radius:8px;background:#fffaf7;table-layout:fixed;">
                  <colgroup>
                    <col width="60%">
                    <col width="10%">
                    <col width="30%">
                  </colgroup>
                  ${itemRows}
                  <tr><td colspan="3" style="padding:0 0 8px;border-top:1px solid #f0ded4;"></td></tr>
                  <tr>
                    <td class="price-table-label" colspan="2" style="padding:8px 22px;color:#14233b;font-size:17px;line-height:24px;">Subtotal</td>
                    <td class="price-table-value" align="right" style="padding:8px 22px;color:#14233b;font-size:17px;line-height:24px;white-space:nowrap;">${formatMerchEmailCurrency(order.subtotal || 0)}</td>
                  </tr>
                  <tr>
                    <td class="price-table-label" colspan="2" style="padding:8px 22px;color:#14233b;font-size:17px;line-height:24px;">Shipping</td>
                    <td class="price-table-value" align="right" style="padding:8px 22px;color:#14233b;font-size:17px;line-height:24px;white-space:nowrap;">${formatMerchEmailCurrency(order.shippingCharge || 0)}</td>
                  </tr>
                  <tr>
                    <td class="price-table-label" colspan="2" style="padding:8px 22px 16px;color:#14233b;font-size:17px;line-height:24px;">GST (Inclusive)</td>
                    <td class="price-table-value" align="right" style="padding:8px 22px 16px;color:#14233b;font-size:17px;line-height:24px;white-space:nowrap;">${formatMerchEmailCurrency(order.gstAmount || 0)}</td>
                  </tr>
                  <tr>
                    <td class="total-label" colspan="2" style="padding:16px 22px;background:#f5e8e1;color:#ad3c22;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;font-weight:700;border-radius:6px 0 0 6px;">Total Paid</td>
                    <td class="total-value" align="right" style="padding:16px 22px;background:#f5e8e1;color:#ad3c22;font-family:Georgia,'Times New Roman',serif;font-size:27px;line-height:32px;font-weight:700;white-space:nowrap;border-radius:0 6px 6px 0;">${formatMerchEmailCurrency(order.totalAmount || 0)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad" style="padding:0 30px 18px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e7cabb;border-radius:8px;background:#fffaf7;">
                  <tr>
                    <td class="delivery-icon" width="122" align="center" style="padding:23px 14px;color:#ad3c22;font-size:42px;line-height:42px;">&#128666;</td>
                    <td class="delivery-copy" style="padding:22px 22px 22px 0;">
                      <p style="margin:0 0 7px;color:#14233b;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;">Expected Delivery</p>
                      <p style="margin:0 0 8px;color:#14233b;font-weight:700;font-size:20px;line-height:27px;">${escapeHtml(expectedDelivery)}</p>
                      <p style="margin:0;color:#14233b;font-size:16px;line-height:23px;">We'll notify you once your order is shipped.</p>
                      <p style="margin:10px 0 0;color:#657384;font-size:13px;line-height:19px;">Ship to: ${escapeHtml(shippingAddress)}</p>
                      <p style="margin:4px 0 0;color:#657384;font-size:13px;line-height:19px;">Email: ${escapeHtml(order.customerEmail || '')}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad" style="padding:0 30px 30px;">
                <a class="mobile-button" href="${escapeHtml(links.track)}" style="display:block;text-align:center;padding:17px 18px;border-radius:6px;background:#b63b20;color:#ffffff;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;font-weight:700;">Track My Order&nbsp;&nbsp;&#8594;</a>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:16px;">
                  <tr>
                    <td class="mobile-stack mobile-button-wrap" style="width:50%;padding-right:5px;">
                      <a class="mobile-button" href="${escapeHtml(links.home)}" style="display:block;text-align:center;padding:15px 12px;border:1px solid #b63b20;border-radius:6px;color:#ad3c22;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;font-weight:700;background:#fffaf7;">&#8962; &nbsp; Back to Home</a>
                    </td>
                    <td class="mobile-stack mobile-button-wrap" style="width:50%;padding-left:5px;">
                      <a class="mobile-button" href="${escapeHtml(links.shop)}" style="display:block;text-align:center;padding:15px 12px;border:1px solid #b63b20;border-radius:6px;color:#ad3c22;text-decoration:none;font-family:Georgia,'Times New Roman',serif;font-size:19px;line-height:25px;font-weight:700;background:#fffaf7;">&#128717; &nbsp; Continue Shopping</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="mobile-pad" style="padding:28px 30px 26px;background:#f4eee9;border-top:1px solid #ead8cd;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="mobile-stack mobile-center footer-logo-cell" valign="middle" style="width:31%;padding-right:22px;border-right:1px solid #d2a08d;">
                      <a href="${escapeHtml(links.home)}"><img src="${escapeHtml(links.logo)}" width="132" alt="H2 House of Health logo" style="display:block;border:0;width:132px;max-width:132px;height:auto;"></a>
                    </td>
                    <td class="mobile-stack mobile-center footer-copy-cell" valign="middle" style="padding-left:26px;">
                      <p style="margin:0 0 15px;color:#14233b;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:21px;font-weight:700;letter-spacing:1px;">PREVENTIVE TODAY, HEALTHIER TOMORROW.</p>
                      <p style="margin:0 0 18px;">
                        <a href="${escapeHtml(links.instagram)}" style="display:inline-block;width:26px;height:26px;margin-right:28px;color:#ad3c22;text-decoration:none;font-weight:700;font-size:24px;line-height:26px;text-align:center;" title="Instagram">&#9678;</a>
                        <a href="${escapeHtml(links.facebook)}" style="display:inline-block;width:26px;height:26px;margin-right:28px;color:#ad3c22;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:24px;line-height:26px;text-align:center;" title="Facebook">f</a>
                        <a href="${escapeHtml(links.youtube)}" style="display:inline-block;width:30px;height:24px;color:#ad3c22;text-decoration:none;font-weight:700;font-size:24px;line-height:24px;text-align:center;" title="YouTube">&#9658;</a>
                      </p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:24px;">
                  <tr>
                    <td class="mobile-stack mobile-center footer-contact-cell" valign="top" style="width:76%;">
                      <p style="margin:0 0 8px;color:#14233b;font-size:15px;line-height:22px;">
                        <span style="color:#ad3c22;font-size:18px;line-height:18px;">&#9993;</span>
                        <span>&nbsp;&nbsp;</span>
                        <span class="footer-contact"><a href="${escapeHtml(links.email)}" style="color:#111827;text-decoration:none;">hello@h2houseofhealth.com</a></span>
                        <span class="footer-separator">&nbsp;&nbsp; | &nbsp;&nbsp;</span>
                        <span style="color:#ad3c22;font-size:18px;line-height:18px;">&#9742;</span>
                        <span>&nbsp;&nbsp;</span>
                        <span class="footer-contact"><a href="${escapeHtml(links.phone)}" style="color:#111827;text-decoration:none;">+91 98765 43210</a></span>
                      </p>
                      <p style="margin:0;color:#14233b;font-size:15px;line-height:22px;">
                        <span style="color:#ad3c22;font-size:18px;line-height:18px;">&#9679;</span>
                        <span>&nbsp;&nbsp;</span>
                        H2 House of Health, Hyderabad
                      </p>
                    </td>
                    <td class="mobile-stack mobile-center footer-leaf-cell" valign="bottom" align="right" style="width:24%;">
                      <img src="${escapeHtml(links.leaf)}" width="82" alt="" style="display:block;border:0;width:82px;max-width:82px;height:auto;margin-left:auto;">
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    return { html, text };
  }

  function getMerchWhatsAppConfig() {
    const enabledValue = String(process.env.WHATSAPP_ORDER_CONFIRMATION_ENABLED || '').trim().toLowerCase();
    const token = String(process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_WHATSAPP_ACCESS_TOKEN || '').trim();
    const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.META_WHATSAPP_PHONE_NUMBER_ID || '').trim();
    return {
      enabled: enabledValue === 'true' || (!['false', '0', 'no', 'off'].includes(enabledValue) && Boolean(token && phoneNumberId)),
      token,
      phoneNumberId,
      apiVersion: String(process.env.WHATSAPP_API_VERSION || 'v20.0').trim(),
      actionTemplateName: String(process.env.WHATSAPP_ORDER_ACTION_TEMPLATE || '').trim(),
      templateLanguage: String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en').trim(),
    };
  }

  function normalizeMerchWhatsAppPhone(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  function formatMerchWhatsAppCurrency(paise) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(paise || 0) / 100);
  }

  function buildMerchWhatsAppCardHtml({ order, items, req }) {
    const links = buildMerchEmailLinks(req, order.id);
    const expectedStart = addMerchEmailDays(order.createdAt, 5);
    const expectedEnd = addMerchEmailDays(order.createdAt, 9);
    const expectedDelivery = `${formatMerchEmailDate(expectedStart)} - ${formatMerchEmailDate(expectedEnd)}`;
    const firstItem = items[0] || {};
    const heroImage = links.hero;
    const logo = links.logo;
    const itemRows = (items.length ? items : [firstItem]).map((item) => `
      <div class="product-row">
        <img src="${escapeHtml(getMerchEmailAssetUrl(req, item.imageUrl || firstItem.imageUrl || links.placeholder))}" alt="">
        <div class="product-copy">
          <h3>${escapeHtml(item.productName || 'H2 House Merch')}</h3>
          <p>${escapeHtml(item.variantLabel || item.sku || 'Standard')} <span>|</span> Quantity: ${escapeHtml(String(item.quantity || 1))}</p>
        </div>
        <strong>${formatMerchWhatsAppCurrency(item.lineTotal || order.totalAmount || 0)}</strong>
      </div>
    `).join('');

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #FAF7F4; color: #2F2F2F; font-family: Arial, Helvetica, sans-serif; }
      .card { width: 760px; min-height: 1060px; margin: 0; background: #FAF7F4; border: 6px solid #fff; border-radius: 24px; overflow: hidden; box-shadow: 0 18px 44px rgba(87, 48, 26, .16); }
      .hero { position: relative; min-height: 278px; padding: 34px 36px 28px; background: linear-gradient(90deg, rgba(250,247,244,.98) 0%, rgba(250,247,244,.9) 48%, rgba(250,247,244,.35) 100%); }
      .hero::after { content: ""; position: absolute; inset: 0; background: url("${escapeHtml(heroImage)}") right center / 43% auto no-repeat; opacity: .98; }
      .hero-content { position: relative; z-index: 1; width: 58%; }
      .logo { width: 148px; height: auto; display: block; margin-bottom: 24px; }
      h1 { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #A0522D; font-size: 70px; line-height: .98; letter-spacing: 0; }
      .tagline { margin: 22px 0 0; color: #6e3826; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; line-height: 1.28; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
      .rule { width: 62px; height: 1px; margin-top: 24px; background: #A0522D; }
      .confirmed { padding: 4px 44px 20px; text-align: center; }
      .success { display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px; border-radius: 999px; margin-bottom: 14px; background: #2E7D32; color: #fff; font-size: 38px; font-weight: 700; }
      .confirmed h2 { margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; font-size: 30px; line-height: 1.18; color: #141414; }
      .confirmed p { margin: 0 auto; max-width: 510px; font-size: 18px; line-height: 1.35; color: #111; }
      .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); margin: 0 28px 8px; border: 1px solid #ead3c6; border-radius: 12px; overflow: hidden; background: rgba(255, 250, 247, .7); }
      .info { min-height: 130px; padding: 20px 12px 16px; text-align: center; border-right: 1px solid #ead3c6; }
      .info:last-child { border-right: 0; }
      .info .icon { margin-bottom: 12px; color: #A0522D; font-size: 28px; line-height: 1; }
      .info span { display: block; margin-bottom: 8px; font-size: 15px; color: #4d3328; }
      .info strong { display: block; color: #982d18; font-size: 15px; line-height: 1.28; word-break: break-word; }
      .products { margin: 8px 28px; display: grid; gap: 8px; }
      .product-row { min-height: 108px; display: grid; grid-template-columns: 122px 1fr 144px; align-items: center; gap: 12px; padding: 12px 22px; border: 1px solid #ead3c6; border-radius: 12px; background: rgba(255, 250, 247, .72); }
      .product-row img { width: 100px; height: 84px; object-fit: contain; }
      .product-row h3 { margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; color: #171717; font-size: 24px; line-height: 1.15; }
      .product-row p { margin: 0; color: #111; font-size: 16px; line-height: 1.3; }
      .product-row p span { margin: 0 10px; color: #A0522D; }
      .product-row strong { justify-self: end; color: #111; font-size: 20px; white-space: nowrap; }
      .summary { margin: 8px 28px 12px; padding: 10px 14px 4px; border: 1px solid #ead3c6; border-radius: 12px; background: rgba(255, 250, 247, .72); }
      .summary-row { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; font-size: 17px; line-height: 1.25; }
      .summary-row strong { font-weight: 500; }
      .summary-total { margin-top: 6px; padding-top: 12px; border-top: 1px dashed #ddbea9; color: #A0522D; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; }
      .footer-note { margin: 0 28px; padding: 12px 6px 14px; border-top: 1px solid #dfc2b3; font-size: 16px; line-height: 1.35; }
      .footer-note p { margin: 0; }
      .footer { display: flex; align-items: center; min-height: 58px; padding: 0 30px; border-top: 1px solid #ead3c6; background: rgba(255, 250, 247, .75); }
      .footer img { width: 118px; height: auto; }
      .footer .divider { width: 1px; height: 32px; background: #dfc2b3; margin: 0 32px; }
      .follow { color: #5c3a2e; font-size: 15px; margin-right: 20px; }
      .social { display: flex; gap: 34px; color: #A0522D; font-size: 26px; font-weight: 700; align-items: center; }
      .time { margin-left: auto; color: #777; font-size: 15px; }
    </style>
  </head>
  <body>
    <article class="card">
      <section class="hero">
        <div class="hero-content">
          <img class="logo" src="${escapeHtml(logo)}" alt="H2 House of Health">
          <h1>Thank You!</h1>
          <p class="tagline">Preventive Today,<br>Healthier Tomorrow.</p>
          <div class="rule"></div>
        </div>
      </section>
      <section class="confirmed">
        <div class="success">✓</div>
        <h2>Your order is confirmed.</h2>
        <p>We're preparing your order with care and will notify you once it's on the way.</p>
      </section>
      <section class="info-grid">
        <div class="info"><div class="icon">□</div><span>Order ID</span><strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong></div>
        <div class="info"><div class="icon">▦</div><span>Order Date</span><strong>${escapeHtml(formatMerchEmailDateTime(order.createdAt) || order.createdAt || '')}</strong></div>
        <div class="info"><div class="icon">₹</div><span>Total Paid</span><strong>${formatMerchWhatsAppCurrency(order.totalAmount || 0)}</strong></div>
        <div class="info"><div class="icon">▭</div><span>Estimated Delivery</span><strong>${escapeHtml(expectedDelivery)}<br>We'll keep you updated.</strong></div>
      </section>
      <section class="products">${itemRows}</section>
      <section class="summary">
        <div class="summary-row"><span>Subtotal</span><strong>${formatMerchWhatsAppCurrency(order.subtotal || 0)}</strong></div>
        <div class="summary-row"><span>Shipping</span><strong>${formatMerchWhatsAppCurrency(order.shippingCharge || 0)}</strong></div>
        <div class="summary-row"><span>GST (Inclusive)</span><strong>${formatMerchWhatsAppCurrency(order.gstAmount || 0)}</strong></div>
        <div class="summary-row summary-total"><span>Total Paid</span><strong>${formatMerchWhatsAppCurrency(order.totalAmount || 0)}</strong></div>
      </section>
      <section class="footer-note">
        <p>Thank you for choosing H2 House of Health.</p>
        <p>We truly appreciate your trust in us.</p>
      </section>
      <footer class="footer">
        <img src="${escapeHtml(logo)}" alt="H2 House of Health">
        <div class="divider"></div>
        <span class="follow">Follow us</span>
        <div class="social"><span>◎</span><span>f</span><span>▶</span></div>
        <span class="time">${escapeHtml(new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()))}</span>
      </footer>
    </article>
  </body>
</html>`;
  }

  async function renderMerchWhatsAppCardImage({ order, items, req }) {
    if (!puppeteer) {
      throw new Error('Puppeteer is not available for WhatsApp card rendering');
    }
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 760, height: 1100, deviceScaleFactor: 2 });
      await page.setContent(buildMerchWhatsAppCardHtml({ order, items, req }), { waitUntil: 'networkidle0', timeout: 30000 });
      const card = await page.$('.card');
      if (!card) throw new Error('WhatsApp card root was not rendered');
      return card.screenshot({ type: 'png' });
    } finally {
      if (browser) await browser.close();
    }
  }

  function submitWhatsAppMediaUpload({ config, toUploadBuffer, filename }) {
    return new Promise((resolve, reject) => {
      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('type', 'image/png');
      form.append('file', toUploadBuffer, { filename, contentType: 'image/png' });
      const request = form.submit({
        protocol: 'https:',
        host: 'graph.facebook.com',
        path: `/${config.apiVersion}/${config.phoneNumberId}/media`,
        headers: { Authorization: `Bearer ${config.token}` },
      }, (error, response) => {
        if (error) {
          reject(error);
          return;
        }
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => {
          let parsed = {};
          try {
            parsed = body ? JSON.parse(body) : {};
          } catch {
            parsed = { raw: body };
          }
          if (response.statusCode < 200 || response.statusCode >= 300 || !parsed.id) {
            reject(new Error(parsed?.error?.message || `WhatsApp media upload failed with HTTP ${response.statusCode}`));
            return;
          }
          resolve(parsed.id);
        });
      });
      request.on('error', reject);
    });
  }

  async function sendWhatsAppGraphMessage(config, payload) {
    const response = await fetch(`https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `WhatsApp message failed with HTTP ${response.status}`);
    }
    return data;
  }

  async function sendMerchWhatsAppActionMessage({ config, to, order, links }) {
    const actionText = "Choose an action below 👇\n\nWe're here to help!";
    if (config.actionTemplateName) {
      await sendWhatsAppGraphMessage(config, {
        to,
        type: 'template',
        template: {
          name: config.actionTemplateName,
          language: { code: config.templateLanguage },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: order.orderNumber || `Order #${order.id}` },
              ],
            },
            { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: links.track }] },
            { type: 'button', sub_type: 'url', index: '1', parameters: [{ type: 'text', text: links.home }] },
            { type: 'button', sub_type: 'url', index: '2', parameters: [{ type: 'text', text: links.shop }] },
          ],
        },
      });
      return;
    }

    await sendWhatsAppGraphMessage(config, {
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: actionText },
        action: {
          buttons: [
            { type: 'reply', reply: { id: `track:${links.track}`, title: '📦 Track My Order' } },
            { type: 'reply', reply: { id: `home:${links.home}`, title: '🏠 Back to Home' } },
            { type: 'reply', reply: { id: `shop:${links.shop}`, title: '🛍 Continue Shopping' } },
          ],
        },
      },
    });
  }

  async function sendMerchWhatsAppOrderConfirmation(orderId, req) {
    const config = getMerchWhatsAppConfig();
    if (!config.enabled) return;
    if (!config.token || !config.phoneNumberId) {
      console.warn('[Merch] WhatsApp confirmation skipped: WhatsApp credentials are not configured.');
      return;
    }

    const data = getMerchOrderEmailData(orderId);
    const to = normalizeMerchWhatsAppPhone(data?.order?.customerPhone);
    if (!data || !to) {
      console.warn('[Merch] WhatsApp confirmation skipped: customer phone is missing.');
      return;
    }

    const links = buildMerchEmailLinks(req, data.order.id);
    const cardBuffer = await renderMerchWhatsAppCardImage({ order: data.order, items: data.items, req });
    const mediaId = await submitWhatsAppMediaUpload({
      config,
      toUploadBuffer: cardBuffer,
      filename: `h2-order-${String(data.order.orderNumber || data.order.id).replace(/[^a-z0-9_-]+/gi, '-')}.png`,
    });
    await sendWhatsAppGraphMessage(config, {
      to,
      type: 'image',
      image: { id: mediaId },
    });
    await sendMerchWhatsAppActionMessage({ config, to, order: data.order, links });
  }

  async function sendMerchOrderConfirmationEmail(orderId, req) {
    const data = getMerchOrderEmailData(orderId);
    if (!data || !isValidMerchEmail(data.order.customerEmail)) return;
    if (typeof sendMerchEmail !== 'function') {
      console.warn('[Merch] Order confirmation email skipped: email service is not configured.');
      return;
    }
    const { html, text } = buildMerchOrderConfirmationHtml({ order: data.order, items: data.items, req });
    await sendMerchEmail({
      to: String(data.order.customerEmail || '').trim().toLowerCase(),
      subject: `Your H2 order is confirmed - ${data.order.orderNumber || `Order #${data.order.id}`}`,
      text,
      html,
    });
    sendMerchWhatsAppOrderConfirmation(orderId, req).catch((error) => {
      console.error('[Merch] Failed to send WhatsApp order confirmation:', error?.message || error);
    });
  }

  function requireAdmin(req, res, next) {
    const token = req.cookies?.booking_portal_token ||
      (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Auth required' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      if (payload.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
      req.user = payload;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // ─── PUBLIC: Get all active products ───
  function normalizeMerchCouponCode(code) {
    if (typeof normalizeCouponCode === 'function') {
      return normalizeCouponCode(code);
    }
    return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function validateMerchCouponForUser(args) {
    if (typeof validateCouponForUser !== 'function') {
      return { error: 'Coupon validation is unavailable.' };
    }
    const result = validateCouponForUser({ ...args, appliesTo: 'merch', portal: 'merch' });
    if (result?.error || !result?.coupon?.influencerId) return result;
    const influencer = db.prepare('SELECT active FROM merch_influencers WHERE id = ?').get(Number(result.coupon.influencerId));
    if (!influencer || Number(influencer.active) !== 1) {
      return { error: 'This influencer coupon is no longer active.' };
    }
    return result;
  }

  function getMerchCommissionSnapshot(coupon, items = []) {
    if (!coupon?.influencerId) return { total: 0, byProduct: new Map() };
    const fallback = Math.max(0, Math.round(Number(coupon.commissionPerOrderPaise || 0)));
    const lineCommissions = new Map();
    let total = items.length ? fallback : 0;
    for (const item of items) {
      const productCommission = fallback;
      lineCommissions.set(Number(item.variantId), productCommission);
    }
    return { total, byProduct: lineCommissions };
  }

  function recordMerchCouponRedemption(payload) {
    if (typeof recordCouponRedemption !== 'function') return;
    recordCouponRedemption(payload);
  }

  function buildMerchCouponPreview(result) {
    const discountAmountPaise = Math.max(0, Math.round(Number(result?.discountAmountPaise || 0)));
    const originalAmountPaise = Math.max(0, Math.round(Number(result?.originalAmountPaise || 0)));
    const finalAmountPaise = Math.max(0, Math.round(Number(result?.finalAmountPaise || 0)));
    return {
      code: result?.coupon?.code || result?.couponCode || '',
      description: result?.coupon?.description || '',
      discountType: result?.coupon?.discountType || '',
      appliesTo: result?.coupon?.appliesTo || 'merch',
      originalAmountInr: Math.round(originalAmountPaise / 100),
      discountAmountInr: Math.round(discountAmountPaise / 100),
      payableAmountInr: Math.round(finalAmountPaise / 100),
      couponType: result?.coupon?.couponType || '',
      validFrom: result?.coupon?.validFrom || null,
      validTill: result?.coupon?.validTill || null,
      influencerId: result?.coupon?.influencerId || null,
      influencerName: result?.coupon?.influencerName || '',
      influencerHandle: result?.coupon?.influencerHandle || '',
    };
  }

  app.get('/api/merch/products', (req, res) => {
    const hypeByProductId = new Map(
      getMerchHypeRows().map((row) => [Number(row.productId), getMerchHypeLabel(row)])
    );
    res.json(loadMerchProductCatalog({ includeInactive: false }).map((product) => ({
      ...product,
      hypeLabel: hypeByProductId.get(Number(product.id)) || '',
    })));
  });

  // Public promotional catalog. HYPE is deliberately separate from sales and
  // order statistics: admins control this merchandising section directly.
  app.get('/api/merch/trending-products', (req, res) => {
    const catalogById = new Map(
      loadMerchProductCatalog({ includeInactive: false }).map((product) => [Number(product.id), product])
    );
    const products = getMerchHypeRows().map((row) => ({
      ...(catalogById.get(Number(row.productId)) || {}),
      hypeLabel: getMerchHypeLabel(row),
    })).filter((product) => product.id);
    res.json(products);
  });

  function getMerchPurchaseVariant(variantId) {
    const variant = db.prepare(`
      SELECT v.*, p.name AS product_name, p.gst_rate, p.is_combo
      FROM merch_variants v
      JOIN merch_products p ON p.id = v.product_id
      WHERE v.id = ? AND v.is_active = 1 AND p.is_active = 1
    `).get(Number(variantId));
    if (!variant) return null;
    const components = Number(variant.is_combo || 0) === 1
      ? db.prepare(`
          SELECT ci.component_variant_id AS variantId, ci.quantity, v.stock,
                 v.sku, v.size, v.color, p.name AS productName
          FROM merch_combo_items ci
          JOIN merch_variants v ON v.id = ci.component_variant_id AND v.is_active = 1
          JOIN merch_products p ON p.id = ci.component_product_id AND p.is_active = 1
          WHERE ci.combo_product_id = ?
          ORDER BY ci.id ASC
        `).all(Number(variant.product_id))
      : [];
    if (Number(variant.is_combo || 0) === 1 && !components.length) return null;
    const stock = Number(variant.stock || 0);
    return { variant, components, stock };
  }

  function normalizeMerchImageInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('cdn/') || raw.startsWith('booking/') || raw.startsWith('uploads/')) return `/${raw}`;
    return `/cdn/shop/files/${raw}`;
  }

  function decrementMerchPurchaseVariant(variantId, quantity) {
    const purchase = getMerchPurchaseVariant(variantId);
    if (!purchase || purchase.stock < quantity) throw new Error('Insufficient stock for this product.');
    const result = db.prepare('UPDATE merch_variants SET stock = stock - ? WHERE id = ? AND stock >= ?')
      .run(quantity, Number(variantId), quantity);
    if (!result.changes) throw new Error(`Stock changed while confirming ${purchase.variant.product_name}.`);
  }

  // Put the inventory reserved by an order back when that order is cancelled
  // before shipment. Combo inventory is held by the combo variant itself.
  function restoreMerchOrderStock(orderId) {
    const items = db.prepare(`
      SELECT oi.variant_id AS variantId, oi.quantity, p.is_combo AS isCombo
      FROM merch_order_items oi
      JOIN merch_variants v ON v.id = oi.variant_id
      JOIN merch_products p ON p.id = v.product_id
      WHERE oi.order_id = ?
    `).all(Number(orderId));
    const increment = db.prepare('UPDATE merch_variants SET stock = stock + ? WHERE id = ?');
    for (const item of items) {
      increment.run(Number(item.quantity || 0), Number(item.variantId));
    }
  }

  // ─── PUBLIC: Create Razorpay order for checkout ───
  app.post('/api/merch/preview-coupon',(req, res) => {
    const authUser = getMerchAuthUser(req);
    const couponCode = normalizeMerchCouponCode(req.body?.couponCode);
    if (!couponCode) {
      return res.status(400).json({ error: 'couponCode is required' });
    }

    const subtotalAmountPaise = Number(req.body?.subtotalAmountPaise || 0);
    const couponResult = validateMerchCouponForUser({
      code: couponCode,
      userId: authUser?.id ?? null,
      productIds: req.body?.productIds || [],
      productLineTotals: req.body?.productLineTotals || {},
      subtotalAmountPaise,
    });

    if (couponResult.error) {
      return res.status(400).json({ error: couponResult.error });
    }

    return res.json({ coupon: buildMerchCouponPreview(couponResult) });
  });

  app.post('/api/merch/checkout', (req, res) => {
    if (!razorpay || !RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: 'Payment gateway not configured' });
    }

    const { items, customer, address, billingAddress } = req.body || {};
    const authUser = getMerchAuthUser(req);
    const merchProfile = authUser ? ensureMerchCustomerProfileForUser(authUser) : null;
    const couponCode = normalizeMerchCouponCode(req.body?.couponCode);
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const resolvedCustomer = {
      name: String(customer?.name || merchProfile?.fullName || authUser?.name || '').trim(),
      email: String(customer?.email || merchProfile?.email || authUser?.email || '').trim().toLowerCase(),
      phone: String(customer?.phone || merchProfile?.mobile || authUser?.mobile || '').trim(),
    };
    if (!resolvedCustomer.name || !resolvedCustomer.email || !resolvedCustomer.phone) {
      return res.status(400).json({ error: 'Customer name, email, and phone required' });
    }

    // Validate items and calculate totals
    let subtotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const purchase = getMerchPurchaseVariant(item.variantId);
      const variant = purchase?.variant;
      const quantity = Math.max(1, Math.floor(Number(item.quantity || 0)));
      if (!purchase) {
        return res.status(400).json({ error: `Variant ${item.variantId} not found` });
      }
      if (purchase.stock < quantity) {
        return res.status(409).json({ error: `Insufficient stock for ${variant.product_name} (available: ${purchase.stock})` });
      }
      const lineTotal = variant.price * quantity;
      subtotal += lineTotal;
      validatedItems.push({
        variantId: variant.id,
        productId: Number(variant.product_id),
        productName: variant.product_name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        sku: variant.sku,
        unitPrice: variant.price,
        quantity,
        lineTotal,
      });
    }

    const couponResult = couponCode
      ? validateMerchCouponForUser({
          code: couponCode,
          userId: authUser?.id,
          productIds: validatedItems.map((item) => item.productId),
          productLineTotals: validatedItems.reduce((totals, item) => ({ ...totals, [item.productId]: Number(totals[item.productId] || 0) + item.lineTotal }), {}),
          subtotalAmountPaise: subtotal,
        })
      : { coupon: null, couponCode: '', discountAmountPaise: 0, finalAmountPaise: subtotal };
    if (couponResult.error) {
      return res.status(400).json({ error: couponResult.error });
    }

    // Product prices are GST-inclusive; derive included GST for reporting only.
    const gstAmount = Math.max(0, subtotal - Math.round(subtotal / 1.18));
    const shippingCharge = subtotal >= 99900 ? 0 : 9900; // Free above ₹999
    const discountAmount = Math.max(0, Math.round(Number(couponResult.discountAmountPaise || 0)));
    const influencerId = Number(couponResult.coupon?.influencerId || 0) > 0 ? Number(couponResult.coupon.influencerId) : null;
    const commissionSnapshot = getMerchCommissionSnapshot(couponResult.coupon, validatedItems);
    const totalAmount = Math.max(100, subtotal + shippingCharge - discountAmount);
    const orderNumber = generateOrderNumber();
    const shippingAddressPayload = address || {};
    const billingAddressPayload = billingAddress || address || {};
    const isGuestCheckout = !authUser;
    const guestName = isGuestCheckout ? resolvedCustomer.name : null;
    const guestEmail = isGuestCheckout ? resolvedCustomer.email : null;
    const guestPhone = isGuestCheckout ? resolvedCustomer.phone : null;

    // Create Razorpay order
    razorpay.orders.create({
      amount: totalAmount,
      currency: 'INR',
      receipt: orderNumber,
      notes: { customerEmail: resolvedCustomer.email, orderNumber, couponCode: String(couponResult.couponCode || couponCode || '') },
    }).then(rpOrder => {
      // Save order to DB
      const insertOrder = db.prepare(`
        INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, guest_name, guest_email, guest_phone, is_guest, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, influencer_id, commission_amount_paise, commission_snapshot_at, total_amount, payment_method, payment_status, razorpay_order_id, shipping_address, billing_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'online', 'pending', ?, ?, ?)
      `);
      const result = insertOrder.run(
        orderNumber, resolvedCustomer.name, resolvedCustomer.email, resolvedCustomer.phone,
        guestName, guestEmail, guestPhone, isGuestCheckout ? 1 : 0, authUser?.id || null, merchProfile?.id || null,
        subtotal, gstAmount, shippingCharge, discountAmount, couponResult.coupon?.id || null, couponResult.couponCode || null, influencerId, commissionSnapshot.total, totalAmount,
        rpOrder.id, JSON.stringify(shippingAddressPayload || {}), JSON.stringify(billingAddressPayload || shippingAddressPayload || {})
      );
      const orderId = result.lastInsertRowid;

      // Save order items
      const insertItem = db.prepare(`
        INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total, commission_amount_paise)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of validatedItems) {
        insertItem.run(orderId, item.variantId, item.productName, item.variantLabel, item.sku, item.unitPrice, item.quantity, item.lineTotal, commissionSnapshot.byProduct.get(Number(item.variantId)) || 0);
      }

      res.json({
        orderId,
        orderNumber,
        razorpayKeyId: RAZORPAY_KEY_ID,
        razorpayOrderId: rpOrder.id,
        amount: totalAmount,
        currency: 'INR',
        subtotal,
        gstAmount,
        shippingCharge,
        discountAmount,
        customer: resolvedCustomer,
        coupon: buildMerchCouponPreview(couponResult),
      });
    }).catch(err => {
      console.error('Merch Razorpay order create failed:', err?.message || err);
      res.status(500).json({ error: 'Payment service unavailable' });
    });
  });

  // ─── PUBLIC: Verify payment after Razorpay checkout ───
  app.post('/api/merch/verify-payment', (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_number } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: 'Missing payment details' });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    // Update order
    const order = db.prepare('SELECT id, status, customer_user_id AS customerUserId, coupon_id AS couponId, coupon_code AS couponCode, discount_amount AS discountAmount FROM merch_orders WHERE razorpay_order_id = ?').get(razorpay_order_id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'Order already processed' });
    }

    // Mark as paid and decrement stock together so an order cannot be confirmed
    // without its inventory update being persisted.
    const items = db.prepare('SELECT variant_id, quantity FROM merch_order_items WHERE order_id = ?').all(order.id);
    db.transaction(() => {
      db.prepare(`
        UPDATE merch_orders SET status = 'processing', payment_status = 'paid', razorpay_payment_id = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'pending'
      `).run(razorpay_payment_id, order.id);
      for (const item of items) {
        decrementMerchPurchaseVariant(item.variant_id, Number(item.quantity || 0));
      }
    })();

    if (Number(order.couponId || 0) > 0 && Number(order.discountAmount || 0) > 0 && Number(order.customerUserId || 0) > 0) {
      recordMerchCouponRedemption({
        couponId: Number(order.couponId),
        userId: Number(order.customerUserId),
        contextType: 'merch_payment',
        contextRef: String(order.id),
        discountAmountPaise: Number(order.discountAmount || 0),
      });
    }

    sendMerchOrderConfirmationEmail(order.id, req).catch((error) => {
      console.error('[Merch] Failed to send order confirmation email:', error?.message || error);
    });

    res.json({ success: true, message: 'Payment verified, order confirmed', orderId: order.id });
  });

  // ─── COD Checkout ───
  app.post('/api/merch/checkout-cod', (req, res) => {
    const { items, customer, address, billingAddress } = req.body || {};
    const authUser = getMerchAuthUser(req);
    const merchProfile = authUser ? ensureMerchCustomerProfileForUser(authUser) : null;
    const couponCode = normalizeMerchCouponCode(req.body?.couponCode);
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }
    const resolvedCustomer = {
      name: String(customer?.name || merchProfile?.fullName || authUser?.name || '').trim(),
      email: String(customer?.email || merchProfile?.email || authUser?.email || '').trim().toLowerCase(),
      phone: String(customer?.phone || merchProfile?.mobile || authUser?.mobile || '').trim(),
    };
    if (!resolvedCustomer.name || !resolvedCustomer.email || !resolvedCustomer.phone) {
      return res.status(400).json({ error: 'Customer details required' });
    }

    let subtotal = 0;
    const validatedItems = [];
    for (const item of items) {
      const purchase = getMerchPurchaseVariant(item.variantId);
      const variant = purchase?.variant;
      const quantity = Math.max(1, Math.floor(Number(item.quantity || 0)));
      if (!purchase) return res.status(400).json({ error: `Variant ${item.variantId} not found` });
      if (purchase.stock < quantity) return res.status(409).json({ error: `Insufficient stock for ${variant.product_name}` });
      const lineTotal = variant.price * quantity;
      subtotal += lineTotal;
      validatedItems.push({ productId: Number(variant.product_id), variantId: variant.id, productName: variant.product_name, variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '), sku: variant.sku, unitPrice: variant.price, quantity, lineTotal });
    }

    const couponResult = couponCode
      ? validateMerchCouponForUser({
          code: couponCode,
          userId: authUser?.id,
          productIds: validatedItems.map((item) => item.productId),
          productLineTotals: validatedItems.reduce((totals, item) => ({ ...totals, [item.productId]: Number(totals[item.productId] || 0) + item.lineTotal }), {}),
          subtotalAmountPaise: subtotal,
        })
      : { coupon: null, couponCode: '', discountAmountPaise: 0, finalAmountPaise: subtotal };
    if (couponResult.error) {
      return res.status(400).json({ error: couponResult.error });
    }

    const gstAmount = Math.max(0, subtotal - Math.round(subtotal / 1.18));
    const shippingCharge = subtotal >= 99900 ? 0 : 9900;
    const codSurcharge = 5000; // ₹50
    const discountAmount = Math.max(0, Math.round(Number(couponResult.discountAmountPaise || 0)));
    const influencerId = Number(couponResult.coupon?.influencerId || 0) > 0 ? Number(couponResult.coupon.influencerId) : null;
    const commissionSnapshot = getMerchCommissionSnapshot(couponResult.coupon, validatedItems);
    const totalAmount = Math.max(100, subtotal + shippingCharge + codSurcharge - discountAmount);
    const orderNumber = generateOrderNumber();
    const shippingAddressPayload = address || {};
    const billingAddressPayload = billingAddress || address || {};
    const isGuestCheckout = !authUser;
    const guestName = isGuestCheckout ? resolvedCustomer.name : null;
    const guestEmail = isGuestCheckout ? resolvedCustomer.email : null;
    const guestPhone = isGuestCheckout ? resolvedCustomer.phone : null;

    const result = db.prepare(`
      INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, guest_name, guest_email, guest_phone, is_guest, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, influencer_id, commission_amount_paise, commission_snapshot_at, total_amount, payment_method, payment_status, shipping_address, billing_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, 'cod', 'cod_pending', ?, ?)
    `).run(
      orderNumber,
      resolvedCustomer.name,
      resolvedCustomer.email,
      resolvedCustomer.phone,
      guestName,
      guestEmail,
      guestPhone,
      isGuestCheckout ? 1 : 0,
      authUser?.id || null,
      merchProfile?.id || null,
      subtotal,
      gstAmount,
      shippingCharge,
      discountAmount,
      couponResult.coupon?.id || null,
      couponResult.couponCode || null,
      influencerId,
      commissionSnapshot.total,
      totalAmount,
      JSON.stringify(shippingAddressPayload || {}),
      JSON.stringify(billingAddressPayload || shippingAddressPayload || {})
    );

    const orderId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total, commission_amount_paise) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of validatedItems) {
      insertItem.run(orderId, item.variantId, item.productName, item.variantLabel, item.sku, item.unitPrice, item.quantity, item.lineTotal, commissionSnapshot.byProduct.get(Number(item.variantId)) || 0);
      decrementMerchPurchaseVariant(item.variantId, item.quantity);
    }

    if (Number(couponResult.coupon?.id || 0) > 0 && Number(discountAmount || 0) > 0 && Number(authUser?.id || 0) > 0) {
      recordMerchCouponRedemption({
        couponId: Number(couponResult.coupon.id),
        userId: Number(authUser.id),
        contextType: 'merch_cod',
        contextRef: String(orderId),
        discountAmountPaise: discountAmount,
      });
    }

    res.json({
      success: true,
      orderNumber,
      orderId,
      totalAmount,
      discountAmount,
      coupon: buildMerchCouponPreview(couponResult),
      message: 'COD order placed',
      customer: resolvedCustomer,
    });
  });

  // ─── ADMIN: Get all orders ───
  app.post('/api/merch/wishlist', requireMerchAuth, (req, res) => {
    const profile = ensureMerchCustomerProfileForUser(req.user);
    const productId = Number(req.body?.productId || 0) || null;
    const variantId = Number(req.body?.variantId || 0) || null;

    if (!profile || (!productId && !variantId)) {
      return res.status(400).json({ error: 'A product or variant is required' });
    }

    db.prepare(`
      INSERT OR IGNORE INTO merch_customer_wishlist_items (customer_id, product_id, variant_id)
      VALUES (?, ?, ?)
    `).run(profile.id, productId, variantId);

    const item = db.prepare(`
      SELECT id, customer_id AS customerId, product_id AS productId, variant_id AS variantId,
             created_at AS createdAt, updated_at AS updatedAt
      FROM merch_customer_wishlist_items
      WHERE customer_id = ?
        AND ((product_id = ?) OR (product_id IS NULL AND ? IS NULL))
        AND ((variant_id = ?) OR (variant_id IS NULL AND ? IS NULL))
      LIMIT 1
    `).get(profile.id, productId, productId, variantId, variantId);

    return res.json({ success: true, item });
  });

  app.delete('/api/merch/wishlist/:id', requireMerchAuth, (req, res) => {
    const profile = ensureMerchCustomerProfileForUser(req.user);
    const itemId = Number(req.params.id || 0);
    if (!profile || !itemId) {
      return res.status(400).json({ error: 'A wishlist item is required' });
    }

    const result = db.prepare(`
      DELETE FROM merch_customer_wishlist_items
      WHERE id = ? AND customer_id = ?
    `).run(itemId, profile.id);

    if (!result.changes) {
      return res.status(404).json({ error: 'Wishlist item not found' });
    }

    return res.json({ success: true, id: itemId });
  });

  app.get('/api/merch/profile', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const addresses = db
      .prepare(
        `SELECT id, customer_id AS customerId, label, recipient_name AS recipientName, phone, line1, line2,
                city, state, postal_code AS postalCode, country, is_default AS isDefault,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_addresses
         WHERE customer_id = ?
         ORDER BY isDefault DESC, datetime(createdAt) DESC, id DESC`
      )
      .all(profile.id);

    const cartItems = db
      .prepare(
        `SELECT id, customer_id AS customerId, variant_id AS variantId, quantity, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_cart_items
         WHERE customer_id = ?
         ORDER BY id DESC`
      )
      .all(profile.id);

    const wishlistItems = db
      .prepare(
        `SELECT id, customer_id AS customerId, product_id AS productId, variant_id AS variantId, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_wishlist_items
         WHERE customer_id = ?
         ORDER BY id DESC`
      )
      .all(profile.id);

    const orders = loadMerchOrders({
      customerUserId: Number(req.user.id),
      customerId: Number(profile.id),
      includeUnconfirmed: true,
    });

    const couponHistory = orders
      .filter((order) => Number(order.couponId || 0) > 0 || String(order.couponCode || '').trim() || String(order.influencerName || '').trim())
      .map((order) => ({
        orderId: Number(order.id),
        orderNumber: order.orderNumber || '',
        couponId: order.couponId == null ? null : Number(order.couponId),
        couponCode: String(order.couponCode || ''),
        influencerName: String(order.influencerName || ''),
        influencerCoupon: String(order.influencerName || '').trim()
          ? `${String(order.influencerName || '').trim()}${String(order.couponCode || '').trim() ? ` (${String(order.couponCode || '').trim()})` : ''}`
          : String(order.couponCode || '').trim(),
        discountAmount: Number(order.discountAmount || 0),
        createdAt: order.createdAt || null,
      }));

    res.json({ profile, addresses, cartItems, wishlistItems, orders, couponHistory });
  });

  app.get('/api/merch/influencer-dashboard', requireMerchAuth, (req, res) => {
    const influencer = getInfluencerByEmail(req.user?.email);
    if (!influencer || Number(influencer.active ?? 1) !== 1) {
      return res.status(403).json({ message: 'influencer access is not available for this account' });
    }

    const dashboard = buildInfluencerDashboard(influencer, {
      page: req.query?.page || 1,
      pageSize: req.query?.pageSize || 8,
      search: req.query?.search || '',
      status: req.query?.status || '',
      startDate: req.query?.startDate || '',
      endDate: req.query?.endDate || '',
    });

    return res.json(dashboard);
  });

  app.patch('/api/merch/profile', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const fullName = String(req.body?.fullName || req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const mobile = String(req.body?.mobile || req.body?.phone || '').trim();
    const avatarUrl = String(req.body?.avatarUrl || '').trim();
    const hasMobileField =
      Object.prototype.hasOwnProperty.call(req.body || {}, 'mobile') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'phone');

    if (mobile && !/^[0-9+\-\s()]{7,20}$/.test(mobile)) {
      return res.status(400).json({ message: 'invalid mobile number' });
    }

    const updates = [];
    const params = [];
    if (fullName) {
      updates.push('full_name = ?');
      params.push(fullName);
    }
    if (email) {
      updates.push('email = ?');
      params.push(email);
    }
    if (hasMobileField) {
      updates.push('mobile = ?');
      params.push(mobile || null);
    }
    if (avatarUrl) {
      updates.push('avatar_url = ?');
      params.push(avatarUrl);
    }

    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE merch_customer_profiles SET ${updates.join(', ')} WHERE id = ?`).run(...params, profile.id);
    }
    if (hasMobileField && mobile) {
      db.prepare('UPDATE users SET mobile = ? WHERE id = ?').run(mobile, req.user.id);
    }

    const nextProfile = getMerchCustomerProfileByUserId(req.user.id);
    res.json({ profile: nextProfile || profile });
  });

  app.patch('/api/merch/influencer-profile', requireMerchAuth, (req, res) => {
    const influencer = getInfluencerByEmail(req.user?.email);
    if (!influencer || Number(influencer.active ?? 1) !== 1) {
      return res.status(403).json({ message: 'influencer access is not available for this account' });
    }

    const updates = [];
    const params = [];
    const name = String(req.body?.name || '').trim();
    const phone = String(req.body?.phone || '').trim();
    const avatarUrl = String(req.body?.avatarUrl || req.body?.avatar_url || '').trim();
    const bio = String(req.body?.bio || '').trim();
    const preferredPaymentDetails = String(req.body?.preferredPaymentDetails || req.body?.preferred_payment_details || '').trim();
    const socialLinks = normalizeInfluencerPayload(req.body).socialLinks;

    if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
      return res.status(400).json({ message: 'invalid phone number' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'name') && name) {
      updates.push('name = ?');
      params.push(name);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
      updates.push('phone = ?');
      params.push(phone || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl') || Object.prototype.hasOwnProperty.call(req.body || {}, 'avatar_url')) {
      updates.push('avatar_url = ?');
      params.push(avatarUrl || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'bio')) {
      updates.push('bio = ?');
      params.push(bio || null);
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'socialLinks') || Object.prototype.hasOwnProperty.call(req.body || {}, 'social_links')) {
      updates.push('social_links_json = ?');
      params.push(JSON.stringify(socialLinks || []));
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'preferredPaymentDetails') || Object.prototype.hasOwnProperty.call(req.body || {}, 'preferred_payment_details')) {
      updates.push('preferred_payment_details = ?');
      params.push(preferredPaymentDetails || null);
    }

    if (updates.length) {
      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE merch_influencers SET ${updates.join(', ')} WHERE id = ?`).run(...params, influencer.id);
    }

    const updated = getInfluencerById(influencer.id);
    const dashboard = buildInfluencerDashboard(updated, { page: 1, pageSize: 8 });
    return res.json({
      influencer: serializeInfluencer(updated, dashboard?.couponPerformance || [], {
        totalOrders: dashboard?.summary?.totalOrdersReferred || 0,
        revenue: dashboard?.summary?.totalSalesGenerated || 0,
        couponUsage: dashboard?.summary?.couponUsage || 0,
      }, getInfluencerCommissionPayments(updated.id)),
      dashboard,
    });
  });

  function getMerchCustomerAddresses(customerId) {
    return db
      .prepare(
        `SELECT id, customer_id AS customerId, label, recipient_name AS recipientName, phone, line1, line2,
                city, state, postal_code AS postalCode, country, is_default AS isDefault,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_addresses
         WHERE customer_id = ?
         ORDER BY isDefault DESC, datetime(createdAt) DESC, id DESC`
      )
      .all(customerId);
  }

  function normalizeAddressInput(body = {}) {
    return {
      label: String(body.label || '').trim(),
      recipientName: String(body.recipientName || body.recipient_name || '').trim(),
      phone: String(body.phone || body.mobile || '').trim(),
      line1: String(body.line1 || '').trim(),
      line2: String(body.line2 || '').trim(),
      city: String(body.city || '').trim(),
      state: String(body.state || '').trim(),
      postalCode: String(body.postalCode || body.postal_code || '').trim(),
      country: String(body.country || 'India').trim() || 'India',
      isDefault: body.isDefault === true || body.is_default === true || body.isDefault === 1 || body.is_default === 1,
    };
  }

  app.post('/api/merch/addresses', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const address = normalizeAddressInput(req.body);
    if (!address.recipientName || !address.phone || !address.line1) {
      return res.status(400).json({ message: 'Recipient, phone, and address line 1 are required' });
    }

    const existingCount = db
      .prepare('SELECT COUNT(*) AS count FROM merch_customer_addresses WHERE customer_id = ?')
      .get(profile.id).count;
    const shouldSetDefault = address.isDefault || existingCount === 0;

    if (shouldSetDefault) {
      db.prepare('UPDATE merch_customer_addresses SET is_default = 0 WHERE customer_id = ?').run(profile.id);
    }

    db
      .prepare(
        `INSERT INTO merch_customer_addresses
          (customer_id, label, recipient_name, phone, line1, line2, city, state, postal_code, country, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(
        profile.id,
        address.label || null,
        address.recipientName,
        address.phone,
        address.line1,
        address.line2 || null,
        address.city || null,
        address.state || null,
        address.postalCode || null,
        address.country,
        shouldSetDefault ? 1 : 0
      );

    res.status(201).json({ addresses: getMerchCustomerAddresses(profile.id) });
  });

  app.patch('/api/merch/addresses/:id', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId)) {
      return res.status(400).json({ message: 'Invalid address id' });
    }

    const existing = db
      .prepare('SELECT id FROM merch_customer_addresses WHERE id = ? AND customer_id = ?')
      .get(addressId, profile.id);
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const address = normalizeAddressInput(req.body);
    if (!address.recipientName || !address.phone || !address.line1) {
      return res.status(400).json({ message: 'Recipient, phone, and address line 1 are required' });
    }

    if (address.isDefault) {
      db.prepare('UPDATE merch_customer_addresses SET is_default = 0 WHERE customer_id = ?').run(profile.id);
    }

    db
      .prepare(
        `UPDATE merch_customer_addresses
         SET label = ?, recipient_name = ?, phone = ?, line1 = ?, line2 = ?, city = ?, state = ?,
             postal_code = ?, country = ?, is_default = CASE WHEN ? THEN 1 ELSE is_default END,
             updated_at = datetime('now')
         WHERE id = ? AND customer_id = ?`
      )
      .run(
        address.label || null,
        address.recipientName,
        address.phone,
        address.line1,
        address.line2 || null,
        address.city || null,
        address.state || null,
        address.postalCode || null,
        address.country,
        address.isDefault ? 1 : 0,
        addressId,
        profile.id
      );

    res.json({ addresses: getMerchCustomerAddresses(profile.id) });
  });

  app.patch('/api/merch/addresses/:id/default', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId)) {
      return res.status(400).json({ message: 'Invalid address id' });
    }

    const existing = db
      .prepare('SELECT id FROM merch_customer_addresses WHERE id = ? AND customer_id = ?')
      .get(addressId, profile.id);
    if (!existing) {
      return res.status(404).json({ message: 'Address not found' });
    }

    db.prepare('UPDATE merch_customer_addresses SET is_default = 0 WHERE customer_id = ?').run(profile.id);
    db
      .prepare("UPDATE merch_customer_addresses SET is_default = 1, updated_at = datetime('now') WHERE id = ? AND customer_id = ?")
      .run(addressId, profile.id);

    res.json({ addresses: getMerchCustomerAddresses(profile.id) });
  });

  app.delete('/api/merch/addresses/:id', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const addressId = Number(req.params.id);
    if (!Number.isInteger(addressId)) {
      return res.status(400).json({ message: 'Invalid address id' });
    }

    const deleted = db
      .prepare('DELETE FROM merch_customer_addresses WHERE id = ? AND customer_id = ?')
      .run(addressId, profile.id);

    if (!deleted.changes) {
      return res.status(404).json({ message: 'Address not found' });
    }

    const addresses = getMerchCustomerAddresses(profile.id);
    if (addresses.length && !addresses.some((address) => Number(address.isDefault) === 1)) {
      db
        .prepare("UPDATE merch_customer_addresses SET is_default = 1, updated_at = datetime('now') WHERE id = ? AND customer_id = ?")
        .run(addresses[0].id, profile.id);
    }

    res.json({ addresses: getMerchCustomerAddresses(profile.id) });
  });

  app.get('/api/merch/orders', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    const orders = loadMerchOrders({
      customerUserId: Number(req.user.id),
      customerId: Number(profile?.id || 0),
    });

    res.json({ orders });
  });

  // Customers may cancel only while the order is still being prepared. The
  // ownership check is done against both the user and the linked merch profile
  // because older orders can have either identifier populated.
  app.post('/api/merch/orders/:id/cancel', requireMerchAuth, (req, res) => {
    const profile = syncMerchGuestOrdersForUser(req.user) || ensureMerchCustomerProfileForUser(req.user);
    const order = db.prepare(`
      SELECT * FROM merch_orders
      WHERE id = ? AND (customer_user_id = ? OR customer_id = ?)
    `).get(Number(req.params.id), Number(req.user.id), Number(profile?.id || 0));
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const currentStatus = String(order.status || '').toLowerCase();
    if (currentStatus === 'cancelled') {
      const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(order.id);
      return res.json({ success: true, order: buildMerchOrderRecord(order, items) });
    }
    if (!['pending', 'processing'].includes(currentStatus)) {
      return res.status(409).json({ error: 'This order can no longer be cancelled because it has been shipped or completed.' });
    }

    const cancel = db.transaction(() => {
      const result = db.prepare(`
        UPDATE merch_orders
        SET status = 'cancelled',
            payment_status = CASE WHEN payment_status IN ('paid', 'cod_pending') THEN 'refunded' ELSE payment_status END,
            updated_at = datetime('now')
        WHERE id = ? AND status IN ('pending', 'processing')
      `).run(order.id);
      if (result.changes && ['paid', 'cod_pending'].includes(String(order.payment_status || '').toLowerCase())) {
        restoreMerchOrderStock(order.id);
      }
    });
    cancel();

    const updated = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(order.id);
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(order.id);
    res.json({ success: true, order: buildMerchOrderRecord(updated, items) });
  });

  app.get('/api/merch/admin/orders', requireAdmin, (req, res) => {
    const { status, startDate, endDate } = req.query;
    const orders = loadMerchOrders({ status, startDate, endDate });
    res.json({ orders, total: orders.length });
  });

  app.get('/api/merch/admin/customers', requireAdmin, (req, res) => {
    const profiles = db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile AS phone,
                avatar_url AS avatarUrl, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles
         ORDER BY datetime(created_at) DESC, id DESC`
      )
      .all();

    const profilesById = new Map(profiles.map((profile) => [Number(profile.id), profile]));
    const profilesByUserId = new Map(
      profiles
        .filter((profile) => Number(profile.userId || 0) > 0)
        .map((profile) => [Number(profile.userId), profile])
    );
    const profilesByEmail = new Map(
      profiles
        .filter((profile) => String(profile.email || '').trim())
        .map((profile) => [normalizeMerchCustomerEmail(profile.email), profile])
    );
    const profilesByPhone = new Map(
      profiles
        .filter((profile) => String(profile.phone || '').trim())
        .map((profile) => [normalizeMerchCustomerPhone(profile.phone), profile])
    );
    const customersByKey = new Map();

    const savedAddresses = db
      .prepare(
        `SELECT id, customer_id AS customerId, label, recipient_name AS recipientName, phone, line1, line2,
                city, state, postal_code AS postalCode, country, is_default AS isDefault,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_addresses
         ORDER BY datetime(created_at) DESC, id DESC`
      )
      .all();

    const orders = db
      .prepare(
        `SELECT id, order_number AS orderNumber, customer_name AS customerName, customer_email AS customerEmail,
                customer_phone AS customerPhone, customer_user_id AS customerUserId, customer_id AS customerId,
                total_amount AS totalAmount, discount_amount AS discountAmount, coupon_code AS couponCode,
                payment_status AS paymentStatus, status, created_at AS createdAt, shipping_address AS shippingAddress,
                billing_address AS billingAddress
         FROM merch_orders
         ORDER BY datetime(created_at) ASC, id ASC`
      )
      .all();

    function ensureCustomer(key, seed = {}) {
      if (!customersByKey.has(key)) {
        customersByKey.set(key, createMerchCustomerRecord(seed));
      }

      const customer = customersByKey.get(key);
      if (seed.profileId && !customer.profileId) customer.profileId = seed.profileId;
      if (seed.userId && !customer.userId) customer.userId = seed.userId;
      if (seed.name && !customer.name) customer.name = String(seed.name).trim();
      if (seed.email && !customer.email) customer.email = String(seed.email).trim().toLowerCase();
      if (seed.phone && !customer.phone) customer.phone = String(seed.phone).trim();
      if (seed.avatarUrl && !customer.avatarUrl) customer.avatarUrl = String(seed.avatarUrl).trim();
      if (seed.registrationDate && !customer.registrationDate) customer.registrationDate = seed.registrationDate;
      return customer;
    }

    for (const profile of profiles) {
      const customer = ensureCustomer(`profile:${profile.id}`, {
        id: Number(profile.id),
        profileId: Number(profile.id),
        userId: Number(profile.userId || 0) || null,
        name: profile.fullName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        avatarUrl: profile.avatarUrl || '',
        registrationDate: profile.createdAt || null,
      });

      customer.id = Number(profile.id);
      customer.profileId = Number(profile.id);
      customer.userId = Number(profile.userId || 0) || null;
      customer.name = String(profile.fullName || customer.name || '').trim();
      customer.email = String(profile.email || customer.email || '').trim().toLowerCase();
      customer.phone = String(profile.phone || customer.phone || '').trim();
      customer.avatarUrl = String(profile.avatarUrl || customer.avatarUrl || '').trim();
      customer.registrationDate = customer.registrationDate || profile.createdAt || null;
    }

    for (const address of savedAddresses) {
      const profileId = Number(address.customerId || 0);
      if (!profileId) continue;
      const profile = profilesById.get(profileId);
      if (!profile) continue;

      const customer = ensureCustomer(`profile:${profile.id}`, {
        id: Number(profile.id),
        profileId: Number(profile.id),
        userId: Number(profile.userId || 0) || null,
        name: profile.fullName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        avatarUrl: profile.avatarUrl || '',
        registrationDate: profile.createdAt || null,
      });
      addMerchCustomerAddress(customer, address, 'saved');
    }

    for (const order of orders) {
      if (!isVisibleMerchOrder(order)) {
        continue;
      }

      const linkedProfileId = Number(order.customerId || 0);
      const linkedUserId = Number(order.customerUserId || 0);
      const linkedProfile = linkedProfileId > 0
        ? profilesById.get(linkedProfileId)
        : linkedUserId > 0
          ? profilesByUserId.get(linkedUserId)
          : null;

      const normalizedEmail = normalizeMerchCustomerEmail(order.customerEmail);
      const normalizedPhone = normalizeMerchCustomerPhone(order.customerPhone);
      const matchedProfile = linkedProfile
        || (normalizedEmail ? profilesByEmail.get(normalizedEmail) : null)
        || (normalizedPhone ? profilesByPhone.get(normalizedPhone) : null)
        || null;
      const customerKey = matchedProfile
        ? `profile:${matchedProfile.id}`
        : normalizedEmail
          ? `guest-email:${normalizedEmail}`
          : normalizedPhone
            ? `guest-phone:${normalizedPhone}`
            : `guest-order:${order.id}`;

      const customer = ensureCustomer(customerKey, matchedProfile
        ? {
            id: Number(matchedProfile.id),
            profileId: Number(matchedProfile.id),
            userId: Number(matchedProfile.userId || 0) || null,
            name: matchedProfile.fullName || order.customerName || '',
            email: matchedProfile.email || order.customerEmail || '',
            phone: matchedProfile.phone || order.customerPhone || '',
            avatarUrl: matchedProfile.avatarUrl || '',
            registrationDate: matchedProfile.createdAt || order.createdAt || null,
          }
        : {
            id: customerKey,
            name: order.customerName || 'Guest Customer',
            email: order.customerEmail || '',
            phone: order.customerPhone || '',
            registrationDate: order.createdAt || null,
          });

      const orderTotal = Number(order.totalAmount || 0);
      const paymentStatus = String(order.paymentStatus || '').trim().toLowerCase();
      const orderTime = getMerchCustomerActivityTimestamp(order.createdAt);
      const registrationTime = getMerchCustomerActivityTimestamp(customer.registrationDate);

      customer.name = String(customer.name || order.customerName || '').trim();
      customer.email = String(customer.email || order.customerEmail || '').trim().toLowerCase();
      customer.phone = String(customer.phone || order.customerPhone || '').trim();
      customer.merchandiseOrders += 1;
      const couponCode = String(order.couponCode || '').trim();
      const discountAmount = Number(order.discountAmount || 0);
      if (couponCode) {
        customer.couponRedemptions.push({
          orderNumber: String(order.orderNumber || ''),
          couponCode,
          discountAmount,
          createdAt: order.createdAt || null,
        });
        customer.couponDiscountTotal += discountAmount;
      }
      if (paymentStatus === 'paid') {
        customer.lifetimeMerchSpend += orderTotal;
      }

      if (!customer.registrationDate || (registrationTime > 0 && orderTime > 0 && orderTime < registrationTime)) {
        customer.registrationDate = order.createdAt || customer.registrationDate;
      }

      if (!customer.lastOrderAt || orderTime >= customer.lastOrderAt) {
        customer.lastOrderAt = orderTime;
        customer.lastOrder = {
          orderNumber: order.orderNumber,
          createdAt: order.createdAt || null,
          status: order.status || 'pending',
          couponCode,
          discountAmount,
        };
      }

      const shippingAddress = parseMerchShippingAddress(order.shippingAddress);
      const billingAddress = parseMerchShippingAddress(order.billingAddress);
      if (shippingAddress) {
        addMerchCustomerAddress(customer, shippingAddress, 'order');
      }
      if (billingAddress) {
        addMerchCustomerAddress(customer, billingAddress, 'order');
      }
    }

    const customers = Array.from(customersByKey.values())
      .map((customer) => finalizeMerchCustomerRecord(customer))
      .sort((left, right) => {
        const leftTime = getMerchCustomerActivityTimestamp(left.lastOrder?.createdAt || left.registrationDate);
        const rightTime = getMerchCustomerActivityTimestamp(right.lastOrder?.createdAt || right.registrationDate);
        return rightTime - leftTime;
      });

    res.json({ customers, total: customers.length });
  });

  app.get('/api/merch/admin/influencers', requireAdmin, (_req, res) => {
    const influencers = loadMerchInfluencers();
    const monthlyRows = db.prepare(`
      SELECT mo.influencer_id AS influencerId,
             substr(mo.created_at, 1, 7) AS month,
             COUNT(*) AS orders,
             COALESCE(SUM(mo.total_amount), 0) AS revenue,
             COALESCE(SUM(mo.commission_amount_paise), 0) AS commission,
             SUM(CASE WHEN mo.coupon_id IS NOT NULL THEN 1 ELSE 0 END) AS couponUsage
      FROM merch_orders mo
      JOIN merch_influencers i ON i.id = mo.influencer_id
      WHERE mo.influencer_id IS NOT NULL
        AND mo.payment_status IN ('paid', 'cod_pending')
      GROUP BY mo.influencer_id, substr(mo.created_at, 1, 7)
      ORDER BY month DESC
    `).all();
    const monthlyByInfluencer = new Map();
    monthlyRows.forEach((row) => {
      const id = Number(row.influencerId);
      if (!monthlyByInfluencer.has(id)) monthlyByInfluencer.set(id, []);
      monthlyByInfluencer.get(id).push({
        month: row.month,
        monthLabel: formatMerchReportMonth(row.month),
        orders: Number(row.orders || 0),
        revenue: Number(row.revenue || 0),
        commission: Number(row.commission || 0),
        couponUsage: Number(row.couponUsage || 0),
      });
    });
    influencers.forEach((influencer) => {
      influencer.monthlySales = monthlyByInfluencer.get(Number(influencer.id)) || [];
    });
    const dailyRows = db.prepare(`
      SELECT mo.influencer_id AS influencerId,
             substr(mo.created_at, 1, 10) AS day,
             COUNT(*) AS orders,
             COALESCE(SUM(mo.total_amount), 0) AS revenue,
             COALESCE(SUM(mo.commission_amount_paise), 0) AS commission,
             SUM(CASE WHEN mo.coupon_id IS NOT NULL THEN 1 ELSE 0 END) AS couponUsage
      FROM merch_orders mo
      JOIN merch_influencers i ON i.id = mo.influencer_id
      WHERE mo.influencer_id IS NOT NULL
        AND mo.payment_status IN ('paid', 'cod_pending')
      GROUP BY mo.influencer_id, substr(mo.created_at, 1, 10)
      ORDER BY day DESC
    `).all();
    const dailyByInfluencer = new Map();
    dailyRows.forEach((row) => {
      const id = Number(row.influencerId);
      if (!dailyByInfluencer.has(id)) dailyByInfluencer.set(id, []);
      dailyByInfluencer.get(id).push({
        day: row.day,
        orders: Number(row.orders || 0),
        revenue: Number(row.revenue || 0),
        commission: Number(row.commission || 0),
        couponUsage: Number(row.couponUsage || 0),
      });
    });
    influencers.forEach((influencer) => {
      influencer.dailySales = dailyByInfluencer.get(Number(influencer.id)) || [];
    });
    res.json({ influencers, total: influencers.length });
  });

  app.post('/api/merch/admin/influencers', requireAdmin, (req, res) => {
    const influencer = normalizeInfluencerPayload(req.body);
    if (!influencer.name || !influencer.handle) {
      return res.status(400).json({ message: 'Influencer name and social handle are required' });
    }
    if (influencer.email) {
      const existingByEmail = getInfluencerByEmail(influencer.email);
      if (existingByEmail) {
        db.prepare(`
          UPDATE merch_influencers
          SET name = ?, handle = ?, phone = ?, notes = ?, avatar_url = ?, bio = ?, social_links_json = ?,
             preferred_payment_details = ?, commission_per_order_paise = ?, paid_commission = ?, active = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(
          influencer.name,
          influencer.handle || null,
          influencer.phone || null,
          influencer.notes || null,
          influencer.avatarUrl || null,
          influencer.bio || null,
          influencer.socialLinks.length ? JSON.stringify(influencer.socialLinks) : null,
          influencer.preferredPaymentDetails || null,
          influencer.commissionPerOrderPaise,
          influencer.paidCommission,
          influencer.active,
          existingByEmail.id
        );
        const updated = getInfluencerById(existingByEmail.id);
        return res.status(200).json({ influencer: serializeInfluencer(updated, [], {}, []) });
      }
    }

    const result = db.prepare(`
      INSERT INTO merch_influencers (name, handle, email, phone, notes, avatar_url, bio, social_links_json, preferred_payment_details, commission_per_order_paise, paid_commission, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      influencer.name,
      influencer.handle || null,
      influencer.email || null,
      influencer.phone || null,
      influencer.notes || null,
      influencer.avatarUrl || null,
      influencer.bio || null,
      influencer.socialLinks.length ? JSON.stringify(influencer.socialLinks) : null,
      influencer.preferredPaymentDetails || null,
      influencer.commissionPerOrderPaise,
      influencer.paidCommission,
      influencer.active
    );

    const created = getInfluencerById(result.lastInsertRowid);
    res.status(201).json({ influencer: serializeInfluencer(created, [], {}, []) });
  });

  app.put('/api/merch/admin/influencers/:id', requireAdmin, (req, res) => {
    const influencerId = Number(req.params.id);
    if (!Number.isInteger(influencerId) || influencerId <= 0) {
      return res.status(400).json({ message: 'Invalid influencer id' });
    }
    const existing = getInfluencerById(influencerId);
    if (!existing) {
      return res.status(404).json({ message: 'Influencer not found' });
    }

    const influencer = normalizeInfluencerPayload({
      ...existing,
      ...req.body,
      active: Object.prototype.hasOwnProperty.call(req.body || {}, 'active') ? req.body.active : existing.active,
    });
    if (!influencer.name || !influencer.handle) {
      return res.status(400).json({ message: 'Influencer name and social handle are required' });
    }
    if (influencer.email) {
      const existingByEmail = getInfluencerByEmail(influencer.email);
      if (existingByEmail && Number(existingByEmail.id) !== influencerId) {
        return res.status(409).json({ message: 'An influencer with this email already exists.' });
      }
    }

    db.prepare(`
      UPDATE merch_influencers
      SET name = ?, handle = ?, email = ?, phone = ?, notes = ?, avatar_url = ?, bio = ?, social_links_json = ?,
          preferred_payment_details = ?, commission_per_order_paise = ?, paid_commission = ?, active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      influencer.name,
      influencer.handle || null,
      influencer.email || null,
      influencer.phone || null,
      influencer.notes || null,
      influencer.avatarUrl || null,
      influencer.bio || null,
      influencer.socialLinks.length ? JSON.stringify(influencer.socialLinks) : null,
      influencer.preferredPaymentDetails || null,
      influencer.commissionPerOrderPaise,
      influencer.paidCommission,
      influencer.active,
      influencerId
    );

    const updated = loadMerchInfluencers().find((item) => Number(item.id) === influencerId);
    res.json({ influencer: updated });
  });

  app.patch('/api/merch/admin/influencers/:id/active', requireAdmin, (req, res) => {
    const influencerId = Number(req.params.id);
    if (!Number.isInteger(influencerId) || influencerId <= 0) {
      return res.status(400).json({ message: 'Invalid influencer id' });
    }
    const active = req.body?.active === false || Number(req.body?.active) === 0 ? 0 : 1;
    const result = db.prepare(`
      UPDATE merch_influencers
      SET active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(active, influencerId);
    if (!result.changes) {
      return res.status(404).json({ message: 'Influencer not found' });
    }
    const updated = loadMerchInfluencers().find((item) => Number(item.id) === influencerId);
    res.json({ influencer: updated });
  });

  app.put('/api/merch/admin/influencers/:id/coupons', requireAdmin, (req, res) => {
    const influencerId = Number(req.params.id);
    if (!Number.isInteger(influencerId) || influencerId <= 0) {
      return res.status(400).json({ message: 'Invalid influencer id' });
    }
    const influencer = getInfluencerById(influencerId);
    if (!influencer) {
      return res.status(404).json({ message: 'Influencer not found' });
    }

    const codes = Array.from(new Set(
      (Array.isArray(req.body?.couponCodes) ? req.body.couponCodes : String(req.body?.couponCodes || req.body?.coupons || '').split(/[\n,]/))
        .map((code) => normalizeMerchCouponCode(code))
        .filter(Boolean)
    ));

    const update = db.transaction(() => {
      db.prepare(`
        UPDATE coupons
        SET influencer_id = NULL
        WHERE portal = 'merch'
          AND influencer_id = ?
          ${codes.length ? `AND code NOT IN (${codes.map(() => '?').join(', ')})` : ''}
      `).run(influencerId, ...codes);

      if (!codes.length) return [];

      const rows = db.prepare(`
        SELECT id, code
        FROM coupons
        WHERE portal = 'merch'
          AND code IN (${codes.map(() => '?').join(', ')})
      `).all(...codes);
      const foundCodes = new Set(rows.map((row) => String(row.code || '').toUpperCase()));
      const missingCodes = codes.filter((code) => !foundCodes.has(code));
      if (missingCodes.length) {
        const error = new Error(`Coupon(s) not found for merch: ${missingCodes.join(', ')}`);
        error.status = 400;
        throw error;
      }

      db.prepare(`
        UPDATE coupons
        SET influencer_id = ?
        WHERE portal = 'merch'
          AND code IN (${codes.map(() => '?').join(', ')})
      `).run(influencerId, ...codes);

      return rows;
    });

    try {
      update();
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message || 'Unable to assign coupons' });
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'notes')) {
      db.prepare("UPDATE merch_influencers SET notes = ?, updated_at = datetime('now') WHERE id = ?")
        .run(String(req.body.notes || '').trim() || null, influencerId);
    }

    const updated = loadMerchInfluencers().find((item) => Number(item.id) === influencerId);
    res.json({ influencer: updated });
  });

  app.delete('/api/merch/admin/influencers/:id/coupons/:couponId', requireAdmin, (req, res) => {
    const influencerId = Number(req.params.id);
    const couponId = Number(req.params.couponId);
    if (!Number.isInteger(influencerId) || !Number.isInteger(couponId)) {
      return res.status(400).json({ message: 'Invalid influencer or coupon id' });
    }
    db.prepare(`
      UPDATE coupons
      SET influencer_id = NULL
      WHERE id = ?
        AND influencer_id = ?
        AND portal = 'merch'
    `).run(couponId, influencerId);
    const updated = loadMerchInfluencers().find((item) => Number(item.id) === influencerId);
    res.json({ influencer: updated || null });
  });

  function getInfluencerReportPeriod(query = {}) {
    const month = String(query.month || '').match(/^\d{4}-\d{2}$/)?.[0] || '';
    if (!month) return { startDate: query.startDate || '', endDate: query.endDate || '' };
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return { startDate: month + '-01', endDate: end.toISOString().slice(0, 10) };
  }

  app.get('/api/merch/admin/influencers/:id/report', requireAdmin, (req, res) => {
    const influencerId = Number(req.params.id);
    if (!Number.isInteger(influencerId) || influencerId <= 0) {
      return res.status(400).json({ message: 'Invalid influencer id' });
    }
    const period = getInfluencerReportPeriod(req.query);
    const report = buildInfluencerAdminReport(influencerId, {
      startDate: period.startDate,
      endDate: period.endDate,
      search: req.query?.search || '',
      status: req.query?.status || '',
    });
    if (!report) {
      return res.status(404).json({ message: 'Influencer not found' });
    }
    res.json({ report });
  });

  app.post('/api/merch/admin/influencers/:id/report/email', requireAdmin, async (req, res) => {
    const influencerId = Number(req.params.id);
    if (!Number.isInteger(influencerId) || influencerId <= 0) {
      return res.status(400).json({ message: 'Invalid influencer id' });
    }

    const period = getInfluencerReportPeriod(req.body || {});
    const report = buildInfluencerAdminReport(influencerId, {
      startDate: period.startDate,
      endDate: period.endDate,
      search: req.body?.search || '',
      status: req.body?.status || '',
    });
    if (!report) {
      return res.status(404).json({ message: 'Influencer not found' });
    }

    const influencer = report.influencer || {};
    const recipientEmail = normalizeInfluencerEmail(influencer.email);
    if (!isValidMerchEmail(recipientEmail)) {
      return res.status(400).json({ message: 'Influencer email is required to send the report.' });
    }

    const transporter = getMerchReportTransporter();
    const fromEmail = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!transporter || !fromEmail) {
      return res.status(500).json({ message: 'Email service is not configured.' });
    }

    const subject = `Merch influencer report - ${String(influencer.name || 'Influencer').trim()}`;
    const periodLabel = String(report.periodLabel || 'all available dates');
    const text = [
      `Merch influencer report for ${String(influencer.name || 'Influencer').trim()}.`,
      `Period: ${periodLabel}.`,
      '',
      `Orders: ${report.summary?.totalOrdersReferred || 0}`,
      `Revenue: ${formatMerchCurrency(report.summary?.totalSalesGenerated || 0)}`,
      `Commission earned: ${formatMerchCurrency(report.summary?.totalCommissionEarned || 0)}`,
      `Commission paid: ${formatMerchCurrency(report.summary?.commissionPaid || 0)}`,
      '',
      'A detailed HTML report is attached for review.',
    ].join('\n');
    const html = buildInfluencerAdminReportHtml(report);
    const attachmentSlug = String(influencer.name || `influencer-${influencerId}`)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `influencer-${influencerId}`;
    const attachmentName = `merch-influencer-report-${attachmentSlug}.html`;

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text,
        html,
        attachments: [
          {
            filename: attachmentName,
            content: html,
            contentType: 'text/html',
          },
        ],
      });
      res.json({ message: 'Influencer report emailed successfully.', recipientEmail });
    } catch (error) {
      console.error('Failed to send influencer report email:', error);
      res.status(500).json({ message: error.message || 'Unable to send influencer report email.' });
    }
  });

  // ─── ADMIN: Get order detail ───
  app.get('/api/merch/admin/orders/:id', requireAdmin, (req, res) => {
    const order = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(req.params.id);
    if (order && !isVisibleMerchOrder(order)) {
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(order.id);
    res.json({ order, items });
  });

  // ─── ADMIN: Update order status ───
  app.patch('/api/merch/admin/orders/:id/status', requireAdmin, (req, res) => {
    const { status, payment_status, tracking_number, carrier_name } = req.body || {};
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const existingOrder = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(req.params.id);
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });
    const existingStatus = String(existingOrder.status || '').toLowerCase();
    if (String(status).toLowerCase() === 'cancelled' && !['pending', 'processing', 'cancelled'].includes(existingStatus)) {
      return res.status(409).json({ error: 'Shipped, delivered, and returned orders cannot be cancelled.' });
    }
    const updates = ['status = ?', "updated_at = datetime('now')"];
    const params = [status];
    if (String(status).toLowerCase() === 'delivered' && String(existingOrder.status || '').toLowerCase() !== 'delivered') {
      updates.push("delivered_at = datetime('now')");
    }
    if (payment_status) {
      updates.push('payment_status = ?');
      params.push(String(payment_status));
    }
    if (tracking_number) { updates.push('tracking_number = ?'); params.push(tracking_number); }
    if (carrier_name) { updates.push('carrier_name = ?'); params.push(carrier_name); }
    params.push(req.params.id);

    const save = db.transaction(() => {
      const result = db.prepare(`UPDATE merch_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      if (result.changes && String(status).toLowerCase() === 'cancelled' && existingStatus !== 'cancelled'
        && ['paid', 'cod_pending'].includes(String(existingOrder.payment_status || '').toLowerCase())) {
        restoreMerchOrderStock(existingOrder.id);
      }
    });
    save();
    const order = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(req.params.id);
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(req.params.id);
    res.json({ success: true, order: buildMerchOrderRecord(order, items) });
  });

  // ADMIN: Record a refund from the confirmed edit action. Payment gateways
  // may be reconciled separately; the order is immediately marked refunded.
  app.post('/api/merch/admin/orders/:id/refund', requireAdmin, (req, res) => {
    const orderId = Number(req.params.id);
    const existingOrder = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(orderId);
    if (!existingOrder) return res.status(404).json({ error: 'Order not found' });
    db.prepare("UPDATE merch_orders SET payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?").run(orderId);
    const order = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(orderId);
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(orderId);
    res.json({ success: true, order: buildMerchOrderRecord(order, items) });
  });

  // ─── ADMIN: Dashboard stats ───
  app.get('/api/merch/admin/stats', requireAdmin, (req, res) => {
    const report = buildMerchReports();
    const summary = report.summary || {};
    res.json({
      totalOrders: summary.orderCount || 0,
      totalRevenue: summary.revenue || 0,
      pendingOrders: Number(report.statusBreakdown?.pending || 0),
      processingOrders: Number(report.statusBreakdown?.processing || 0),
      shippedOrders: Number(report.statusBreakdown?.shipped || 0),
      deliveredOrders: Number(report.statusBreakdown?.delivered || 0),
      todayOrders: Array.isArray(report.recentOrders)
        ? report.recentOrders.filter((order) => getMerchDateKey(order.createdAt) === getMerchDateKey(new Date())).length
        : 0,
      summary,
      statusBreakdown: report.statusBreakdown || {},
      monthlyRevenueSeries: report.monthlyRevenueSeries || [],
      recentOrders: report.recentOrders || [],
      recentPayments: report.recentPayments || [],
      recentCouponUsage: report.recentCouponUsage || [],
      recentCustomers: report.recentCustomers || [],
      notifications: report.notifications || [],
      topProducts: report.topProducts || [],
      topCategories: report.topCategories || [],
      revenueSeries: report.revenueSeries || [],
    });
  });

  // ─── ADMIN: Promotional HYPE configuration ───
  app.get('/api/merch/admin/hype', requireAdmin, (req, res) => {
    res.json({ labels: MERCH_HYPE_LABELS, hypes: getMerchHypeRows({ includeInactive: true }) });
  });

  app.put('/api/merch/admin/hype', requireAdmin, (req, res) => {
    const submitted = Array.isArray(req.body?.hypes) ? req.body.hypes : [];
    const seenProductIds = new Set();
    const hypes = [];

    for (const item of submitted) {
      const productId = Number(item?.productId);
      const label = String(item?.label || '').trim();
      const customLabel = String(item?.customLabel || '').trim();
      if (!Number.isInteger(productId) || productId <= 0 || seenProductIds.has(productId)) {
        return res.status(400).json({ message: 'Each hyped product must be selected once.' });
      }
      if (!MERCH_HYPE_LABELS.includes(label)) {
        return res.status(400).json({ message: 'Choose a valid hype label for every product.' });
      }
      if (label === 'Custom Label' && (!customLabel || customLabel.length > 60)) {
        return res.status(400).json({ message: 'Custom labels must be between 1 and 60 characters.' });
      }
      const product = db.prepare('SELECT id FROM merch_products WHERE id = ? AND is_active = 1').get(productId);
      if (!product) return res.status(400).json({ message: 'One or more selected products are unavailable.' });
      seenProductIds.add(productId);
      hypes.push({ productId, label, customLabel: label === 'Custom Label' ? customLabel : null });
    }

    const saveHypes = db.transaction(() => {
      db.prepare('DELETE FROM merch_product_hypes').run();
      const insert = db.prepare(`
        INSERT INTO merch_product_hypes (product_id, label, custom_label, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `);
      hypes.forEach((item) => insert.run(item.productId, item.label, item.customLabel));
    });
    saveHypes();
    res.json({ labels: MERCH_HYPE_LABELS, hypes: getMerchHypeRows({ includeInactive: true }) });
  });

  // ─── ADMIN: Get all products (including inactive) ───
  app.get('/api/merch/admin/products', requireAdmin, (req, res) => {
    // Legacy deletes were soft-deleted by disabling every variant. Keep those
    // tombstones out of the admin catalog while retaining normal archived
    // products, which still have active variants.
    const products = loadMerchProductCatalog({ includeInactive: true })
      .filter((product) => Array.isArray(product.variants) && product.variants.some((variant) => Number(variant.isActive ?? 1) === 1));
    res.json(products);
  });

  // ADMIN: Store merch imagery in the server uploads directory and return the
  // same public path saved on the product record and rendered by the storefront.
  app.post('/api/merch/admin/upload-image', requireAdmin, (req, res) => {
    if (!merchImageUpload) return res.status(500).json({ message: 'Image uploads are not configured.' });
    merchImageUpload.single('image')(req, res, (error) => {
      if (error) return res.status(400).json({ message: error.message || 'Image upload failed.' });
      if (!req.file) return res.status(400).json({ message: 'Choose an image to upload.' });
      return res.status(201).json({ imageUrl: `/uploads/${req.file.filename}` });
    });
  });

  // ADMIN: Create a purchasable combo card from existing product variants.
  app.post('/api/merch/admin/combos', requireAdmin, (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const slug = String(body.slug || name).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const priceRupees = Number(body.price || 0);
    const componentVariantIds = [...new Set((Array.isArray(body.componentVariantIds) ? body.componentVariantIds : [])
      .map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
    if (!name || !slug || !Number.isFinite(priceRupees) || priceRupees <= 0 || componentVariantIds.length < 2) {
      return res.status(400).json({ message: 'Combo name, price, and at least two product variants are required.' });
    }
    if (db.prepare('SELECT id FROM merch_products WHERE slug = ?').get(slug)) {
      return res.status(409).json({ message: 'A product or combo with this name already exists.' });
    }
    const placeholders = componentVariantIds.map(() => '?').join(', ');
    const components = db.prepare(`
      SELECT v.id AS variantId, v.product_id AS productId, v.sku, v.is_active AS isActive,
             p.name, p.image_url AS imageUrl, p.is_combo AS isCombo, p.is_active AS productActive
      FROM merch_variants v JOIN merch_products p ON p.id = v.product_id
      WHERE v.id IN (${placeholders})
    `).all(...componentVariantIds);
    if (components.length !== componentVariantIds.length || components.some((item) => !item.isActive || !item.productActive || item.isCombo)) {
      return res.status(400).json({ message: 'All selected combo components must be active normal products.' });
    }
    const componentStocks = new Map(
      (Array.isArray(body.componentStocks) ? body.componentStocks : [])
        .map((item) => {
          const rawStock = item?.stock;
          const stock = rawStock === undefined || rawStock === null || String(rawStock).trim() === ''
            ? 10
            : Math.max(0, Math.floor(Number(rawStock)));
          return [Number(item?.variantId), Number.isFinite(stock) ? stock : 10];
        })
        .filter(([variantId]) => Number.isInteger(variantId) && variantId > 0)
    );
    const comboStock = Math.min(...components.map((item) => componentStocks.has(item.variantId) ? componentStocks.get(item.variantId) : 10));
    const comboSku = `COMBO-${slug.toUpperCase().slice(0, 38)}-${Date.now().toString().slice(-6)}`;
      const image = normalizeMerchImageInput(body.image) || normalizeMerchImageInput(components[0]?.imageUrl);
    const description = String(body.description || '').trim();
    try {
      const createCombo = db.transaction(() => {
        const productResult = db.prepare(`
          INSERT INTO merch_products (name, slug, description, specifications_json, category, base_price, image_url, is_active, gst_rate, weight_grams, combo_purchase, is_combo)
          VALUES (?, ?, ?, ?, 'combos', ?, ?, ?, 18, 0, 0, 1)
        `).run(name, slug, description, JSON.stringify({ 'Combo items': components.map((item) => item.name).join(', ') }), Math.round(priceRupees * 100), image, String(body.status || 'published').toLowerCase() === 'published' ? 1 : 0);
        const productId = Number(productResult.lastInsertRowid);
        const variantResult = db.prepare(`INSERT INTO merch_variants (product_id, sku, size, color, price, stock) VALUES (?, ?, NULL, NULL, ?, ?)`)
          .run(productId, comboSku, Math.round(priceRupees * 100), comboStock);
        const insertItem = db.prepare('INSERT INTO merch_combo_items (combo_product_id, component_product_id, component_variant_id, quantity) VALUES (?, ?, ?, 1)');
        components.forEach((item) => {
          insertItem.run(productId, item.productId, item.variantId);
        });
        return { productId, variantId: Number(variantResult.lastInsertRowid) };
      });
      const result = createCombo();
      const combo = loadMerchProductCatalog({ includeInactive: true }).find((item) => Number(item.id) === result.productId);
      return res.status(201).json(combo || { id: result.productId, variantId: result.variantId });
    } catch (error) {
      console.error('Failed to create merch combo:', error);
      return res.status(500).json({ message: error.message || 'Unable to create combo.' });
    }
  });

  // ADMIN: Remove selected product variants from every combo that contains them.
  app.post('/api/merch/admin/combos/remove-components', requireAdmin, (req, res) => {
    const variantIds = [...new Set((Array.isArray(req.body?.variantIds) ? req.body.variantIds : [])
      .map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
    if (!variantIds.length) return res.status(400).json({ message: 'At least one product variant is required.' });
    const placeholders = variantIds.map(() => '?').join(', ');
    try {
      const result = db.transaction(() => {
        const affected = db.prepare(`SELECT DISTINCT combo_product_id AS comboId FROM merch_combo_items WHERE component_variant_id IN (${placeholders})`).all(...variantIds);
        const removed = db.prepare(`DELETE FROM merch_combo_items WHERE component_variant_id IN (${placeholders})`).run(...variantIds);
        const deactivate = db.prepare(`UPDATE merch_products SET is_active = 0, updated_at = datetime('now') WHERE id = ? AND is_combo = 1`);
        const countItems = db.prepare('SELECT COUNT(*) AS count FROM merch_combo_items WHERE combo_product_id = ?');
        affected.forEach(({ comboId }) => {
          if (Number(countItems.get(comboId).count || 0) < 2) deactivate.run(comboId);
        });
        return { removed: Number(removed.changes || 0), combosUpdated: affected.length };
      })();
      return res.json(result);
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Unable to remove products from combos.' });
    }
  });

  app.patch('/api/merch/admin/combos/:id', requireAdmin, (req, res) => {
    const comboId = Number(req.params.id);
    const combo = db.prepare('SELECT id FROM merch_products WHERE id = ? AND is_combo = 1').get(comboId);
    if (!combo) return res.status(404).json({ message: 'Combo not found.' });
    const body = req.body || {};
    const productUpdates = [];
    const productParams = [];
    const addProductField = (column, value) => { productUpdates.push(`${column} = ?`); productParams.push(value); };
    if (body.name !== undefined) addProductField('name', String(body.name || '').trim());
    if (body.description !== undefined) addProductField('description', String(body.description || '').trim());
    if (body.image !== undefined) addProductField('image_url', normalizeMerchImageInput(body.image));
    if (body.status !== undefined) addProductField('is_active', String(body.status).toLowerCase() === 'published' ? 1 : 0);
    const price = body.price !== undefined ? Math.max(0, Math.round(Number(body.price || 0) * 100)) : null;
    if (price !== null) addProductField('base_price', price);
    if (productUpdates.length) {
      productUpdates.push("updated_at = datetime('now')");
      productParams.push(comboId);
    }
    const componentIds = body.componentVariantIds === undefined ? null : [...new Set((Array.isArray(body.componentVariantIds) ? body.componentVariantIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const componentStocks = Array.isArray(body.componentStocks)
      ? new Map(body.componentStocks.map((item) => [Number(item?.variantId), Math.max(0, Math.floor(Number(item?.stock || 0)))]))
      : null;
    try {
      db.transaction(() => {
        if (productUpdates.length) db.prepare(`UPDATE merch_products SET ${productUpdates.join(', ')} WHERE id = ?`).run(...productParams);
        if (price !== null) db.prepare('UPDATE merch_variants SET price = ? WHERE product_id = ?').run(price, comboId);
        if (componentIds) {
          if (componentIds.length < 2) throw new Error('A combo needs at least two product variants.');
          const ph = componentIds.map(() => '?').join(', ');
          const valid = db.prepare(`SELECT v.id AS variantId, v.product_id AS productId, v.is_active AS isActive, p.is_active AS productActive, p.is_combo AS isCombo FROM merch_variants v JOIN merch_products p ON p.id = v.product_id WHERE v.id IN (${ph})`).all(...componentIds);
          if (valid.length !== componentIds.length || valid.some((item) => !item.isActive || !item.productActive || item.isCombo)) throw new Error('All combo components must be active normal products.');
          db.prepare('DELETE FROM merch_combo_items WHERE combo_product_id = ?').run(comboId);
          const insertItem = db.prepare('INSERT INTO merch_combo_items (combo_product_id, component_product_id, component_variant_id, quantity) VALUES (?, ?, ?, 1)');
          valid.forEach((item) => insertItem.run(comboId, item.productId, item.variantId));
        }
        if (componentStocks) {
          const stockVariantIds = componentIds || db.prepare('SELECT component_variant_id AS variantId FROM merch_combo_items WHERE combo_product_id = ?').all(comboId).map((item) => Number(item.variantId));
          const stocks = stockVariantIds.filter((variantId) => componentStocks.has(variantId)).map((variantId) => componentStocks.get(variantId));
          if (stocks.length) {
            db.prepare('UPDATE merch_variants SET stock = ? WHERE product_id = ?').run(Math.min(...stocks), comboId);
          }
        }
      })();
      return res.json(loadMerchProductCatalog({ includeInactive: true }).find((item) => Number(item.id) === comboId) || { id: comboId });
    } catch (error) {
      return res.status(400).json({ message: error.message || 'Unable to update combo.' });
    }
  });

  // ADMIN: Create a product and its first purchasable variant.
  app.post('/api/merch/admin/products', requireAdmin, (req, res) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const sku = String(body.sku || '').trim();
    const category = String(body.category || '').trim().toLowerCase();
    const description = String(body.description || '').trim();
    const slug = String(body.slug || name).trim().toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const priceRupees = Number(body.price || 0);
    const stock = Math.max(0, Math.floor(Number(body.stock || 0)));
    const specifications = body.specifications && typeof body.specifications === 'object' && !Array.isArray(body.specifications)
      ? body.specifications
      : {};
    const status = String(body.status || 'draft').toLowerCase();
    const comboPurchase = body.comboPurchase ? 1 : 0;
    const requestedImages = [...new Set((Array.isArray(body.images) ? body.images : (Array.isArray(body.imageUrls) ? body.imageUrls : [body.image]))
      .map(normalizeMerchImageInput).filter(Boolean))];
    const rawImage = String(body.image || '').trim() || (
      category === 'bottles' ? '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113' :
      category === 'sprays' ? '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138' :
      category === 'hoodies' ? '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146' :
      ''
    );
    const imageUrl = rawImage && !/^(https?:|data:|blob:|\/)/i.test(rawImage)
      ? `/${rawImage.startsWith('cdn/') || rawImage.startsWith('booking/') || rawImage.startsWith('uploads/') ? rawImage : `cdn/shop/files/${rawImage}`}`
      : rawImage;

    if (!name || !sku || !slug || !category || !Number.isFinite(priceRupees) || priceRupees <= 0) {
      return res.status(400).json({ message: 'Product name, SKU, category, and a valid price are required.' });
    }
    if (db.prepare('SELECT id FROM merch_products WHERE slug = ?').get(slug)) {
      return res.status(409).json({ message: 'A product with this name or slug already exists.' });
    }
    if (db.prepare('SELECT id FROM merch_variants WHERE sku = ?').get(sku)) {
      return res.status(409).json({ message: 'A product with this SKU already exists.' });
    }

    const insertProduct = db.prepare(`
      INSERT INTO merch_products (name, slug, description, specifications_json, category, base_price, image_url, images_json, is_active, gst_rate, weight_grams, combo_purchase)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertVariant = db.prepare(`
      INSERT INTO merch_variants (product_id, sku, size, color, price, stock)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const transaction = db.transaction(() => {
      const productResult = insertProduct.run(
        name,
        slug,
        description,
        JSON.stringify(specifications),
        category,
        Math.round(priceRupees * 100),
        imageUrl,
        JSON.stringify(requestedImages.length ? requestedImages : [imageUrl].filter(Boolean)),
        status === 'published' ? 1 : 0,
        Number(body.gstRate || 18),
        Math.max(0, Math.floor(Number(body.weightGrams || 0))),
        comboPurchase,
      );
      insertVariant.run(
        productResult.lastInsertRowid,
        sku,
        String(body.size || '').trim() || null,
        String(body.color || '').trim() || null,
        Math.round(priceRupees * 100),
        stock,
      );
      return Number(productResult.lastInsertRowid);
    });

    try {
      const productId = transaction();
      const product = loadMerchProductCatalog({ includeInactive: true }).find((item) => Number(item.id) === productId);
      return res.status(201).json(product || { id: productId, message: 'Product created.' });
    } catch (error) {
      console.error('Failed to create merch product:', error);
      return res.status(500).json({ message: error.message || 'Unable to create product.' });
    }
  });

  // ADMIN: Update a product and/or one of its variants.
  app.patch('/api/merch/admin/products/:id', requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    const body = req.body || {};
    const product = db.prepare('SELECT * FROM merch_products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });

    const variantId = Number(body.variantId || 0);
    let variant = null;
    if (variantId > 0) {
      variant = db.prepare('SELECT id FROM merch_variants WHERE id = ? AND product_id = ?').get(variantId, productId);
      if (!variant) return res.status(404).json({ message: 'Product variant not found.' });
    }

    const productUpdates = [];
    const productParams = [];
    const addProductField = (column, value) => {
      productUpdates.push(`${column} = ?`);
      productParams.push(value);
    };
    if (body.name !== undefined) addProductField('name', String(body.name || '').trim());
    if (body.category !== undefined) addProductField('category', String(body.category || '').trim().toLowerCase());
    if (body.description !== undefined) addProductField('description', String(body.description || '').trim());
    if (body.image !== undefined) addProductField('image_url', String(body.image || '').trim());
    if (body.images !== undefined || body.imageUrls !== undefined) {
      const imageValues = Array.isArray(body.images) ? body.images : body.imageUrls;
      const normalizedImages = [...new Set((Array.isArray(imageValues) ? imageValues : []).map(normalizeMerchImageInput).filter(Boolean))];
      addProductField('images_json', JSON.stringify(normalizedImages));
      if (normalizedImages.length && body.image === undefined) addProductField('image_url', normalizedImages[0]);
    }
    if (body.specifications !== undefined) addProductField('specifications_json', JSON.stringify(body.specifications || {}));
    if (body.status !== undefined) addProductField('is_active', String(body.status).toLowerCase() === 'published' ? 1 : 0);
    if (body.comboPurchase !== undefined) addProductField('combo_purchase', body.comboPurchase ? 1 : 0);
    if (body.price !== undefined) addProductField('base_price', Math.max(0, Math.round(Number(body.price || 0) * 100)));

    const variantUpdates = [];
    const variantParams = [];
    if (variant) {
      const addVariantField = (column, value) => { variantUpdates.push(`${column} = ?`); variantParams.push(value); };
      if (body.sku !== undefined) addVariantField('sku', String(body.sku || '').trim());
      if (body.size !== undefined) addVariantField('size', String(body.size || '').trim() || null);
      if (body.color !== undefined) addVariantField('color', String(body.color || '').trim() || null);
      if (body.price !== undefined) addVariantField('price', Math.max(0, Math.round(Number(body.price || 0) * 100)));
      if (body.stock !== undefined) addVariantField('stock', Math.max(0, Math.floor(Number(body.stock || 0))));
      if (variantUpdates.length) {
        variantParams.push(variantId, productId);
      }
    }

    db.transaction(() => {
      if (productUpdates.length) {
        productUpdates.push("updated_at = datetime('now')");
        productParams.push(productId);
        db.prepare(`UPDATE merch_products SET ${productUpdates.join(', ')} WHERE id = ?`).run(...productParams);
      }
      if (variantUpdates.length) {
        db.prepare(`UPDATE merch_variants SET ${variantUpdates.join(', ')} WHERE id = ? AND product_id = ?`).run(...variantParams);
      }
    })();
    const updated = loadMerchProductCatalog({ includeInactive: true }).find((item) => Number(item.id) === productId);
    return res.json(updated || { id: productId });
  });

  // ADMIN: Remove a product from the storefront without breaking historical orders.
  app.delete('/api/merch/admin/products/:id', requireAdmin, (req, res) => {
    const productId = Number(req.params.id);
    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ message: 'A valid product id is required.' });
    }
    const product = db.prepare(`
      SELECT p.id, p.name
      FROM merch_products p
      WHERE p.id = ?
         OR p.id = (SELECT product_id FROM merch_variants WHERE id = ?)
      LIMIT 1
    `).get(productId, productId);
    if (!product) return res.status(404).json({ message: 'Product not found.' });
    db.transaction(() => {
      // Order items retain a snapshot of product details and do not foreign-key
      // the variant, so removing the catalog rows does not break order history.
      db.prepare('DELETE FROM merch_combo_items WHERE combo_product_id = ? OR component_product_id = ?').run(Number(product.id), Number(product.id));
      db.prepare('DELETE FROM merch_variants WHERE product_id = ?').run(Number(product.id));
      db.prepare('DELETE FROM merch_products WHERE id = ?').run(Number(product.id));
    })();
    res.json({ message: 'Product permanently removed from the catalog.', id: Number(product.id), name: product.name });
  });

  // ─── ADMIN: Get inventory ───
  app.get('/api/merch/admin/inventory', requireAdmin, (req, res) => {
    const variants = db.prepare(`
      SELECT v.id, v.product_id AS productId, v.sku, v.size, v.color, v.price, v.stock, v.is_active AS isActive,
             v.created_at AS createdAt, p.name AS productName, p.category
      FROM merch_variants v
      JOIN merch_products p ON p.id = v.product_id
      ORDER BY v.stock ASC, v.id ASC
    `).all();
    res.json(variants);
  });

  app.get('/api/merch/admin/reports', requireAdmin, (req, res) => {
    const { startDate, endDate } = req.query;
    res.json(buildMerchReports({ startDate, endDate }));
  });

  app.post('/api/merch/admin/reports/email', requireAdmin, async (req, res) => {
    const { startDate, endDate, format = 'csv' } = req.body || {};
    const recipientEmail = String(req.body?.email || req.user?.email || '').trim().toLowerCase();
    if (!isValidMerchEmail(recipientEmail)) {
      return res.status(400).json({ message: 'A valid recipient email is required.' });
    }

    const transporter = getMerchReportTransporter();
    const fromEmail = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
    if (!transporter || !fromEmail) {
      return res.status(500).json({ message: 'Email service is not configured.' });
    }

    const report = buildMerchReports({ startDate, endDate });
    const monthlyRows = Array.isArray(report.monthlyInfluencerReports) ? report.monthlyInfluencerReports : [];
    const influencerRows = Array.isArray(report.influencerReports) ? report.influencerReports : [];
    const summary = report.summary || {};
    const monthRangeLabel = [startDate, endDate].filter(Boolean).join(' to ') || 'all available dates';
    const subject = `Merch influencer report - ${monthRangeLabel}`;
    const text = [
      `Merch influencer report for ${monthRangeLabel}.`,
      '',
      `Orders: ${summary.orderCount || 0}`,
      `Revenue: ${formatMerchCurrency(summary.revenue || 0)}`,
      `Influencers: ${influencerRows.length}`,
      `Monthly rows: ${monthlyRows.length}`,
      '',
      'Attached is the month-wise influencer breakdown for download and sharing.',
    ].join('\n');
    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
        <h2 style="margin: 0 0 12px;">Merch influencer report</h2>
        <p style="margin: 0 0 16px;">Period: ${escapeHtml(monthRangeLabel)}</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 720px;">
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Orders</td>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(String(summary.orderCount || 0))}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Revenue</td>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(formatMerchCurrency(summary.revenue || 0))}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Influencer rows</td>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(String(influencerRows.length))}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">Monthly rows</td>
            <td style="padding: 8px 12px; border: 1px solid #e5e7eb;">${escapeHtml(String(monthlyRows.length))}</td>
          </tr>
        </table>
      </div>
    `;

    const csvLines = [
      ['Period', monthRangeLabel],
      ['Orders', summary.orderCount || 0],
      ['Revenue', summary.revenue || 0],
      ['Influencers', influencerRows.length],
      ['Monthly rows', monthlyRows.length],
      [],
      ['Month', 'Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'],
      ...monthlyRows.map((row) => [
        row.monthLabel || row.month || '',
        row.name || '',
        row.handle || '',
        row.orders || 0,
        row.revenue || 0,
        row.commission || 0,
        row.couponUsage || 0,
      ]),
    ];
    const csvContent = csvLines
      .map((line) => line.map(escapeCsvValue).join(','))
      .join('\n');
    const normalizedFormat = String(format || 'csv').toLowerCase();
    const attachmentExtension = normalizedFormat === 'excel' ? 'xls' : normalizedFormat === 'pdf' ? 'html' : 'csv';
    const attachmentContent = normalizedFormat === 'excel'
      ? csvContent.split('\n').map((line) => line.replace(/,/g, '\t')).join('\n')
      : normalizedFormat === 'pdf'
        ? html
        : csvContent;
    const attachmentContentType = normalizedFormat === 'excel'
      ? 'application/vnd.ms-excel'
      : normalizedFormat === 'pdf'
        ? 'text/html'
        : 'text/csv';
    const attachmentName = `merch-influencer-report-${String(startDate || 'start').replace(/[^0-9-]/g, '')}-${String(endDate || 'end').replace(/[^0-9-]/g, '')}.${attachmentExtension}`;

    try {
      await transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject,
        text,
        html,
        attachments: [
          {
            filename: attachmentName,
            content: attachmentContent,
            contentType: attachmentContentType,
          },
        ],
      });

      res.json({ message: 'Report emailed successfully.', recipientEmail });
    } catch (error) {
      console.error('Failed to send merch report email:', error);
      res.status(500).json({ message: error.message || 'Unable to send report email.' });
    }
  });

  console.log('[Merch] API routes mounted at /api/merch/*');
};

// ─── Seed initial product data ───
function seedMerchProducts(db) {
  const products = [
    { name: 'Zenith Hoodie – Black', slug: 'zenith-hoodie-black', description: 'Heavyweight 450 GSM organic cotton blend hoodie with structured premium silhouette.', specifications_json: { 'Product type': 'Premium pullover hoodie', 'Fabric': '450 GSM organic cotton blend', 'Colour': 'Black', 'Fit': 'Structured relaxed fit', 'Care': 'Machine wash cold; air dry' }, category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'Zenith Hoodie – Sand', slug: 'zenith-hoodie-sand', description: 'Same Zenith frame in earthy sand colourway. 450 GSM organic cotton blend.', specifications_json: { 'Product type': 'Premium pullover hoodie', 'Fabric': '450 GSM organic cotton blend', 'Colour': 'Sand', 'Fit': 'Structured relaxed fit', 'Care': 'Machine wash cold; air dry' }, category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'H2 Molecular Hydrogen Water Bottle', slug: 'h2-water-bottle', description: 'Portable PEM/SPE electrolysis bottle. Generates hydrogen-rich water in 3 minutes. BPA-free, USB-C rechargeable.', specifications_json: { 'Product Name': 'Hydrogen-Rich Water Bottle', 'Capacity': '460ml', 'Electrolytic Material': 'Platinum-Titanium', 'Membrane Electrode': 'PEM + SPE', 'Main Material': 'Glass', 'Shell Material': 'Stainless Steel', 'Battery Type': '700mAh Lithium Polymer', 'Working Time': '5 minutes per cycle (3,000+ ppb)', 'Size': 'Ø7cm × 24cm', 'Colours Available': 'Blue / Black / Silver / Gold' }, category: 'bottles', base_price: 649900, image_url: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113', gst_rate: 18, weight_grams: 380 },
    { name: 'H2 Hydrogen Mist Spray', slug: 'h2-mist-spray', description: 'Compact hydrogen mist spray for skin rejuvenation. Antioxidant-rich hydrogen water delivery.', specifications_json: { 'Product Name': 'Hydrogen Mist Sprayer', 'Atomisation Amount': '0.8–1.2 ml/min', 'Hydrogen Concentration': '1000 ppb', 'Water Tank Capacity': '13ml', 'Main Material': 'PC (Polycarbonate)', 'Negative Potential': '< −300mV', 'Battery Capacity': '500mAh', 'Power Supply': 'DC 5V / Micro USB' }, category: 'sprays', base_price: 249900, image_url: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138', gst_rate: 18, weight_grams: 150 },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO merch_products (name, slug, description, specifications_json, category, base_price, image_url, gst_rate, weight_grams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVariant = db.prepare(`
    INSERT INTO merch_variants (product_id, sku, size, color, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Product 1: Zenith Hoodie Black
  let r = insertProduct.run(products[0].name, products[0].slug, products[0].description, JSON.stringify(products[0].specifications_json), products[0].category, products[0].base_price, products[0].image_url, products[0].gst_rate, products[0].weight_grams);
  let pid = r.lastInsertRowid;
  for (const size of ['S', 'M', 'L', 'XL', 'XXL']) {
    insertVariant.run(pid, `HM-HOD-BLK-${size}`, size, 'Black', 349900, 35);
  }

  // Product 2: Zenith Hoodie Sand
  r = insertProduct.run(products[1].name, products[1].slug, products[1].description, JSON.stringify(products[1].specifications_json), products[1].category, products[1].base_price, products[1].image_url, products[1].gst_rate, products[1].weight_grams);
  pid = r.lastInsertRowid;
  for (const size of ['S', 'M', 'L', 'XL', 'XXL']) {
    insertVariant.run(pid, `HM-HOD-SND-${size}`, size, 'Sand', 349900, 35);
  }

  // Product 3: Water Bottle
  r = insertProduct.run(products[2].name, products[2].slug, products[2].description, JSON.stringify(products[2].specifications_json), products[2].category, products[2].base_price, products[2].image_url, products[2].gst_rate, products[2].weight_grams);
  pid = r.lastInsertRowid;
  insertVariant.run(pid, 'HM-BTL-300-SLV', '300ml', 'Silver', 699900, 40);
  insertVariant.run(pid, 'HM-BTL-500-SLV', '500ml', 'Silver', 649900, 35);
  insertVariant.run(pid, 'HM-BTL-300-BLK', '300ml', 'Black', 749900, 30);
  insertVariant.run(pid, 'HM-BTL-500-BLK', '500ml', 'Black', 849900, 25);

  // Product 4: Mist Spray
  r = insertProduct.run(products[3].name, products[3].slug, products[3].description, JSON.stringify(products[3].specifications_json), products[3].category, products[3].base_price, products[3].image_url, products[3].gst_rate, products[3].weight_grams);
  pid = r.lastInsertRowid;
  insertVariant.run(pid, 'HM-SPR-050-WHT', '50ml', 'White', 249900, 50);
  insertVariant.run(pid, 'HM-SPR-100-WHT', '100ml', 'White', 349900, 40);
  insertVariant.run(pid, 'HM-SPR-050-RSG', '50ml', 'Rose Gold', 279900, 35);
  insertVariant.run(pid, 'HM-SPR-100-RSG', '100ml', 'Rose Gold', 379900, 30);

  console.log('[Merch] Seeded 4 products with variants');
}
