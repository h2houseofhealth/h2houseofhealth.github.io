/**
 * House Merch API Routes
 * Mounts on the existing Express server for merchandise e-commerce.
 * Uses the same Razorpay keys, JWT, and SQLite DB as the booking portal.
 */
'use strict';

const crypto = require('crypto');
const express = require('express');
const router = express.Router();

module.exports = function mountMerchApi(app, { db, razorpay, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, JWT_SECRET, jwt, couponHelpers = {} }) {
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
      commission_rate REAL NOT NULL DEFAULT 10,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS merch_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      category TEXT NOT NULL,
      base_price INTEGER NOT NULL,
      image_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      gst_rate INTEGER NOT NULL DEFAULT 18,
      weight_grams INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

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

  db.exec(`
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
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'online',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      shipping_address TEXT,
      billing_address TEXT,
      tracking_number TEXT,
      carrier_name TEXT,
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
    );
  `);

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

  if (hasTable('coupons') && !hasColumn('coupons', 'influencer_id')) {
    db.exec('ALTER TABLE coupons ADD COLUMN influencer_id INTEGER REFERENCES merch_influencers(id)');
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_merch_orders_influencer_id
      ON merch_orders(influencer_id);

    CREATE INDEX IF NOT EXISTS idx_coupons_influencer_portal
      ON coupons(influencer_id, portal);
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

  function formatMerchPrice(paise) {
    return '₹' + Number(paise || 0).toLocaleString('en-IN');
  }

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
    const commissionRate = Number(body.commissionRate ?? body.commission_rate ?? 10);
    return {
      name: String(body.name || '').trim(),
      handle: String(body.handle || '').trim(),
      email: String(body.email || '').trim().toLowerCase(),
      phone: String(body.phone || '').trim(),
      notes: String(body.notes || '').trim(),
      commissionRate: Number.isFinite(commissionRate) ? Math.min(Math.max(commissionRate, 0), 100) : 10,
      active: body.active === false || Number(body.active) === 0 ? 0 : 1,
    };
  }

  function getInfluencerById(influencerId) {
    const id = Number(influencerId);
    if (!Number.isInteger(id) || id <= 0) return null;
    return db.prepare(`
      SELECT id, name, handle, email, phone, notes, commission_rate AS commissionRate,
             active, created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencers
      WHERE id = ?
    `).get(id);
  }

  function getMerchCouponByCode(code) {
    const normalizedCode = normalizeMerchCouponCode(code);
    if (!normalizedCode) return null;
    return db.prepare(`
      SELECT c.id, c.code, c.description, c.discount_type AS discountType, c.discount_value AS discountValue,
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
             COALESCE(SUM(CASE WHEN coupon_id IS NOT NULL THEN 1 ELSE 0 END), 0) AS couponUsage
      FROM merch_orders
      WHERE influencer_id IN (${ids.map(() => '?').join(', ')})
        AND payment_status IN ('paid', 'cod_pending')
      GROUP BY influencer_id
    `).all(...ids);
  }

  function serializeInfluencer(row, coupons = [], stats = {}) {
    const commissionRate = Number(row.commissionRate ?? row.commission_rate ?? 10);
    const revenue = Number(stats.revenue || 0);
    return {
      id: Number(row.id),
      name: String(row.name || ''),
      handle: String(row.handle || ''),
      email: String(row.email || ''),
      phone: String(row.phone || ''),
      notes: String(row.notes || ''),
      commissionRate,
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
      commission: Math.round(revenue * (commissionRate / 100)),
      createdAt: row.createdAt || row.created_at || null,
      updatedAt: row.updatedAt || row.updated_at || null,
    };
  }

  function loadMerchInfluencers() {
    const rows = db.prepare(`
      SELECT id, name, handle, email, phone, notes, commission_rate AS commissionRate,
             active, created_at AS createdAt, updated_at AS updatedAt
      FROM merch_influencers
      ORDER BY active DESC, datetime(created_at) DESC, id DESC
    `).all();
    const ids = rows.map((row) => Number(row.id));
    const couponRows = getInfluencerCouponRows(ids);
    const statRows = getInfluencerStatsRows(ids);
    const couponsByInfluencer = new Map();
    const statsByInfluencer = new Map();

    for (const coupon of couponRows) {
      const influencerId = Number(coupon.influencerId);
      if (!couponsByInfluencer.has(influencerId)) couponsByInfluencer.set(influencerId, []);
      couponsByInfluencer.get(influencerId).push(coupon);
    }
    for (const stats of statRows) {
      statsByInfluencer.set(Number(stats.influencerId), stats);
    }

    return rows.map((row) => serializeInfluencer(
      row,
      couponsByInfluencer.get(Number(row.id)) || [],
      statsByInfluencer.get(Number(row.id)) || {}
    ));
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

  function buildMerchProductRecord(product, variants = [], sales = null) {
    const activeVariants = variants.filter((variant) => Number(variant.isActive ?? 1) === 1);
    const priceOverrides = getMerchVariantPriceOverrides(product.slug);
    const normalizedVariants = activeVariants.map((variant, index) => {
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
    const stock = normalizedVariants.reduce((sum, variant) => sum + Number(variant.stock || 0), 0);
    const salesCount = Number(sales?.sales || 0);
    const orderCount = Number(sales?.orderCount || 0);

    return {
      id: Number(product.id),
      name: String(product.name || ''),
      slug: String(product.slug || ''),
      description: String(product.description || ''),
      category: String(product.category || ''),
      basePrice: minPrice,
      price: minPrice,
      priceLabel: minPrice === maxPrice ? formatMerchPrice(minPrice) : `${formatMerchPrice(minPrice)} - ${formatMerchPrice(maxPrice)}`,
      imageUrl: String(product.image_url || ''),
      image: String(product.image_url || ''),
      images: product.image_url ? [String(product.image_url)] : [],
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
      status: Number(product.is_active || 1) === 1 ? 'published' : 'archived',
      archived: Number(product.is_active || 1) !== 1,
      featured: false,
      sales: salesCount,
      orderCount,
      gstRate: Number(product.gst_rate || 18),
      weightGrams: Number(product.weight_grams || 0),
      createdAt: product.created_at || null,
      updatedAt: product.updated_at || null,
      lowStockThreshold: 10,
    };
  }

  function loadMerchProductCatalog({ includeInactive = false } = {}) {
    const productRows = db.prepare(`
      SELECT id, name, slug, description, category, base_price, image_url, is_active, gst_rate, weight_grams, created_at, updated_at
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
      salesMap.get(Number(product.id)) || null
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
             mo.shipping_charge AS shippingCharge, mo.discount_amount AS discountAmount, mo.coupon_id AS couponId,
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
    const products = loadMerchProductCatalog({ includeInactive: true });
    const profiles = db
      .prepare(
        `SELECT id, user_id AS userId, full_name AS fullName, email, mobile AS phone,
                avatar_url AS avatarUrl, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_customer_profiles`
      )
      .all();
    const coupons = db
      .prepare(
        `SELECT c.id, c.code, c.coupon_type AS couponType, c.active, c.influencer_id AS influencerId,
                COUNT(cr.id) AS totalRedemptions
         FROM coupons c
         LEFT JOIN coupon_redemptions cr ON cr.coupon_id = c.id
         WHERE c.portal = 'merch'
         GROUP BY c.id`
      )
      .all();
    const influencers = loadMerchInfluencers();

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
    for (const order of paidOrders) {
      const dateKey = String(order.createdAt || '').slice(0, 10);
      if (!dateKey) continue;
      revenueByDate.set(dateKey, (revenueByDate.get(dateKey) || 0) + Number(order.totalAmount || 0));
    }

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
        lowStockCount: products.filter((product) => !product.archived && Number(product.stock || 0) <= Number(product.lowStockThreshold || 10)).length,
        activeCouponCount: coupons.filter((coupon) => Number(coupon.active ?? 0) === 1).length,
      },
      statusBreakdown: statusCounts,
      revenueSeries: dailyRevenue,
      topProducts,
      topCategories: [...categoryStats.values()]
        .sort((left, right) => right.revenue - left.revenue || right.quantity - left.quantity)
        .slice(0, 5),
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
      recentOrders: allOrders.slice(0, 5),
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
    return validateCouponForUser({ ...args, appliesTo: 'merch', portal: 'merch' });
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
    res.json(loadMerchProductCatalog({ includeInactive: false }));
  });

  // ─── PUBLIC: Create Razorpay order for checkout ───
  app.post('/api/merch/preview-coupon', requireMerchAuth, (req, res) => {
    const couponCode = normalizeMerchCouponCode(req.body?.couponCode);
    if (!couponCode) {
      return res.status(400).json({ error: 'couponCode is required' });
    }

    const subtotalAmountPaise = Number(req.body?.subtotalAmountPaise || 0);
    const couponResult = validateMerchCouponForUser({
      code: couponCode,
      userId: req.user?.id,
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
    if (couponCode && !authUser) {
      return res.status(401).json({ error: 'Sign in to apply a coupon.' });
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
      const variant = db.prepare('SELECT v.*, p.name AS product_name, p.gst_rate FROM merch_variants v JOIN merch_products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1').get(item.variantId);
      if (!variant) {
        return res.status(400).json({ error: `Variant ${item.variantId} not found` });
      }
      if (variant.stock < item.quantity) {
        return res.status(409).json({ error: `Insufficient stock for ${variant.product_name} (available: ${variant.stock})` });
      }
      const lineTotal = variant.price * item.quantity;
      subtotal += lineTotal;
      validatedItems.push({
        variantId: variant.id,
        productName: variant.product_name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        sku: variant.sku,
        unitPrice: variant.price,
        quantity: item.quantity,
        lineTotal,
      });
    }

    const couponResult = couponCode
      ? validateMerchCouponForUser({
          code: couponCode,
          userId: authUser?.id,
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
        INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, guest_name, guest_email, guest_phone, is_guest, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, influencer_id, total_amount, payment_method, payment_status, razorpay_order_id, shipping_address, billing_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, 'online', 'pending', ?, ?, ?)
      `);
      const result = insertOrder.run(
        orderNumber, resolvedCustomer.name, resolvedCustomer.email, resolvedCustomer.phone,
        guestName, guestEmail, guestPhone, isGuestCheckout ? 1 : 0, authUser?.id || null, merchProfile?.id || null,
        subtotal, gstAmount, shippingCharge, discountAmount, couponResult.coupon?.id || null, couponResult.couponCode || null, influencerId, totalAmount,
        rpOrder.id, JSON.stringify(shippingAddressPayload || {}), JSON.stringify(billingAddressPayload || shippingAddressPayload || {})
      );
      const orderId = result.lastInsertRowid;

      // Save order items
      const insertItem = db.prepare(`
        INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const item of validatedItems) {
        insertItem.run(orderId, item.variantId, item.productName, item.variantLabel, item.sku, item.unitPrice, item.quantity, item.lineTotal);
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

    // Mark as paid, decrement stock
    const updateOrder = db.prepare(`
      UPDATE merch_orders SET status = 'processing', payment_status = 'paid', razorpay_payment_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    updateOrder.run(razorpay_payment_id, order.id);

    // Decrement stock for each item
    const items = db.prepare('SELECT variant_id, quantity FROM merch_order_items WHERE order_id = ?').all(order.id);
    const decrementStock = db.prepare('UPDATE merch_variants SET stock = stock - ? WHERE id = ?');
    for (const item of items) {
      decrementStock.run(item.quantity, item.variant_id);
    }

    if (Number(order.couponId || 0) > 0 && Number(order.discountAmount || 0) > 0 && Number(order.customerUserId || 0) > 0) {
      recordMerchCouponRedemption({
        couponId: Number(order.couponId),
        userId: Number(order.customerUserId),
        contextType: 'merch_payment',
        contextRef: String(order.id),
        discountAmountPaise: Number(order.discountAmount || 0),
      });
    }

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
    if (couponCode && !authUser) {
      return res.status(401).json({ error: 'Sign in to apply a coupon.' });
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
      const variant = db.prepare('SELECT v.*, p.name AS product_name FROM merch_variants v JOIN merch_products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1').get(item.variantId);
      if (!variant) return res.status(400).json({ error: `Variant ${item.variantId} not found` });
      if (variant.stock < item.quantity) return res.status(409).json({ error: `Insufficient stock for ${variant.product_name}` });
      const lineTotal = variant.price * item.quantity;
      subtotal += lineTotal;
      validatedItems.push({ variantId: variant.id, productName: variant.product_name, variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '), sku: variant.sku, unitPrice: variant.price, quantity: item.quantity, lineTotal });
    }

    const couponResult = couponCode
      ? validateMerchCouponForUser({
          code: couponCode,
          userId: authUser?.id,
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
    const totalAmount = Math.max(100, subtotal + shippingCharge + codSurcharge - discountAmount);
    const orderNumber = generateOrderNumber();
    const shippingAddressPayload = address || {};
    const billingAddressPayload = billingAddress || address || {};
    const isGuestCheckout = !authUser;
    const guestName = isGuestCheckout ? resolvedCustomer.name : null;
    const guestEmail = isGuestCheckout ? resolvedCustomer.email : null;
    const guestPhone = isGuestCheckout ? resolvedCustomer.phone : null;

    const result = db.prepare(`
      INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, guest_name, guest_email, guest_phone, is_guest, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, influencer_id, total_amount, payment_method, payment_status, shipping_address, billing_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'cod_pending', ?, ?)
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
      totalAmount,
      JSON.stringify(shippingAddressPayload || {}),
      JSON.stringify(billingAddressPayload || shippingAddressPayload || {})
    );

    const orderId = result.lastInsertRowid;
    const insertItem = db.prepare('INSERT INTO merch_order_items (order_id, variant_id, product_name, variant_label, sku, unit_price, quantity, line_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    const decrementStock = db.prepare('UPDATE merch_variants SET stock = stock - ? WHERE id = ?');
    for (const item of validatedItems) {
      insertItem.run(orderId, item.variantId, item.productName, item.variantLabel, item.sku, item.unitPrice, item.quantity, item.lineTotal);
      decrementStock.run(item.quantity, item.variantId);
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
                total_amount AS totalAmount, status, created_at AS createdAt, shipping_address AS shippingAddress,
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
    res.json({ influencers, total: influencers.length });
  });

  app.post('/api/merch/admin/influencers', requireAdmin, (req, res) => {
    const influencer = normalizeInfluencerPayload(req.body);
    if (!influencer.name) {
      return res.status(400).json({ message: 'Influencer name is required' });
    }

    const result = db.prepare(`
      INSERT INTO merch_influencers (name, handle, email, phone, notes, commission_rate, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      influencer.name,
      influencer.handle || null,
      influencer.email || null,
      influencer.phone || null,
      influencer.notes || null,
      influencer.commissionRate,
      influencer.active
    );

    const created = getInfluencerById(result.lastInsertRowid);
    res.status(201).json({ influencer: serializeInfluencer(created, [], {}) });
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
    if (!influencer.name) {
      return res.status(400).json({ message: 'Influencer name is required' });
    }

    db.prepare(`
      UPDATE merch_influencers
      SET name = ?, handle = ?, email = ?, phone = ?, notes = ?, commission_rate = ?,
          active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      influencer.name,
      influencer.handle || null,
      influencer.email || null,
      influencer.phone || null,
      influencer.notes || null,
      influencer.commissionRate,
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
    const updates = ['status = ?', "updated_at = datetime('now')"];
    const params = [status];
    if (payment_status) {
      updates.push('payment_status = ?');
      params.push(String(payment_status));
    }
    if (tracking_number) { updates.push('tracking_number = ?'); params.push(tracking_number); }
    if (carrier_name) { updates.push('carrier_name = ?'); params.push(carrier_name); }
    params.push(req.params.id);

    db.prepare(`UPDATE merch_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const order = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(req.params.id);
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(req.params.id);
    res.json({ success: true, order: buildMerchOrderRecord(order, items) });
  });

  // ─── ADMIN: Dashboard stats ───
  app.get('/api/merch/admin/stats', requireAdmin, (req, res) => {
    const orders = loadMerchOrders({ includeUnconfirmed: false });
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((order) => String(order.paymentStatus || '').toLowerCase() === 'paid')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const pendingOrders = orders.filter((order) => order.status === 'pending').length;
    const processingOrders = orders.filter((order) => order.status === 'processing').length;
    const shippedOrders = orders.filter((order) => order.status === 'shipped').length;
    const deliveredOrders = orders.filter((order) => order.status === 'delivered').length;
    const todayOrders = orders.filter((order) => String(order.createdAt || '').slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

    res.json({ totalOrders, totalRevenue, pendingOrders, processingOrders, shippedOrders, deliveredOrders, todayOrders });
  });

  // ─── ADMIN: Get all products (including inactive) ───
  app.get('/api/merch/admin/products', requireAdmin, (req, res) => {
    const products = loadMerchProductCatalog({ includeInactive: true });
    res.json(products);
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

  console.log('[Merch] API routes mounted at /api/merch/*');
};

// ─── Seed initial product data ───
function seedMerchProducts(db) {
  const products = [
    { name: 'Zenith Hoodie – Black', slug: 'zenith-hoodie-black', description: 'Heavyweight 450 GSM organic cotton blend hoodie with structured premium silhouette.', category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'Zenith Hoodie – Sand', slug: 'zenith-hoodie-sand', description: 'Same Zenith frame in earthy sand colourway. 450 GSM organic cotton blend.', category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'H2 Molecular Hydrogen Water Bottle', slug: 'h2-water-bottle', description: 'Portable PEM/SPE electrolysis bottle. Generates hydrogen-rich water in 3 minutes. BPA-free, USB-C rechargeable.', category: 'bottles', base_price: 649900, image_url: '/booking/assets/service-hydrogen-session.jpg', gst_rate: 18, weight_grams: 380 },
    { name: 'H2 Hydrogen Mist Spray', slug: 'h2-mist-spray', description: 'Compact hydrogen mist spray for skin rejuvenation. Antioxidant-rich hydrogen water delivery.', category: 'sprays', base_price: 249900, image_url: '/booking/assets/service-iv-shots.jpg', gst_rate: 18, weight_grams: 150 },
  ];

  const insertProduct = db.prepare(`
    INSERT INTO merch_products (name, slug, description, category, base_price, image_url, gst_rate, weight_grams)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVariant = db.prepare(`
    INSERT INTO merch_variants (product_id, sku, size, color, price, stock)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Product 1: Zenith Hoodie Black
  let r = insertProduct.run(products[0].name, products[0].slug, products[0].description, products[0].category, products[0].base_price, products[0].image_url, products[0].gst_rate, products[0].weight_grams);
  let pid = r.lastInsertRowid;
  for (const size of ['S', 'M', 'L', 'XL', 'XXL']) {
    insertVariant.run(pid, `HM-HOD-BLK-${size}`, size, 'Black', 349900, 25);
  }

  // Product 2: Zenith Hoodie Sand
  r = insertProduct.run(products[1].name, products[1].slug, products[1].description, products[1].category, products[1].base_price, products[1].image_url, products[1].gst_rate, products[1].weight_grams);
  pid = r.lastInsertRowid;
  for (const size of ['S', 'M', 'L', 'XL', 'XXL']) {
    insertVariant.run(pid, `HM-HOD-SND-${size}`, size, 'Sand', 349900, 20);
  }

  // Product 3: Water Bottle
  r = insertProduct.run(products[2].name, products[2].slug, products[2].description, products[2].category, products[2].base_price, products[2].image_url, products[2].gst_rate, products[2].weight_grams);
  pid = r.lastInsertRowid;
  insertVariant.run(pid, 'HM-BTL-300-SLV', '300ml', 'Silver', 699900, 40);
  insertVariant.run(pid, 'HM-BTL-500-SLV', '500ml', 'Silver', 649900, 35);
  insertVariant.run(pid, 'HM-BTL-300-BLK', '300ml', 'Black', 749900, 30);
  insertVariant.run(pid, 'HM-BTL-500-BLK', '500ml', 'Black', 849900, 25);

  // Product 4: Mist Spray
  r = insertProduct.run(products[3].name, products[3].slug, products[3].description, products[3].category, products[3].base_price, products[3].image_url, products[3].gst_rate, products[3].weight_grams);
  pid = r.lastInsertRowid;
  insertVariant.run(pid, 'HM-SPR-050-WHT', '50ml', 'White', 249900, 50);
  insertVariant.run(pid, 'HM-SPR-100-WHT', '100ml', 'White', 349900, 40);
  insertVariant.run(pid, 'HM-SPR-050-RSG', '50ml', 'Rose Gold', 279900, 35);
  insertVariant.run(pid, 'HM-SPR-100-RSG', '100ml', 'Rose Gold', 379900, 30);

  console.log('[Merch] Seeded 4 products with variants');
}
