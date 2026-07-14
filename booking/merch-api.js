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
      status TEXT NOT NULL DEFAULT 'pending',
      subtotal INTEGER NOT NULL,
      gst_amount INTEGER NOT NULL DEFAULT 0,
      shipping_charge INTEGER NOT NULL DEFAULT 0,
      discount_amount INTEGER NOT NULL DEFAULT 0,
      coupon_id INTEGER REFERENCES coupons(id),
      coupon_code TEXT,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'online',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      shipping_address TEXT,
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

  if (!hasColumn('merch_orders', 'coupon_id')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id)');
  }

  if (!hasColumn('merch_orders', 'coupon_code')) {
    db.exec('ALTER TABLE merch_orders ADD COLUMN coupon_code TEXT');
  }

  // Seed products if table is empty
  const productCount = db.prepare('SELECT COUNT(*) AS cnt FROM merch_products').get().cnt;
  if (productCount === 0) {
    seedMerchProducts(db);
  }

  function hasTable(tableName) {
    return Boolean(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1").get(tableName)
    );
  }

  function hasColumn(tableName, columnName) {
    if (!hasTable(tableName)) return false;
    return db.prepare(`PRAGMA table_info(${tableName})`).all().some((row) => row.name === columnName);
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
      if (nextMobile !== String(existing.mobile || '')) {
        updates.push('mobile = ?');
        params.push(nextMobile || null);
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
    return validateCouponForUser({ ...args, appliesTo: 'merch' });
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
    };
  }

  app.get('/api/merch/products', (req, res) => {
    const products = db.prepare(`
      SELECT p.*, GROUP_CONCAT(v.id || '|' || v.sku || '|' || COALESCE(v.size,'') || '|' || COALESCE(v.color,'') || '|' || v.price || '|' || v.stock) AS variants_raw
      FROM merch_products p
      LEFT JOIN merch_variants v ON v.product_id = p.id AND v.is_active = 1
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all();

    const result = products.map(p => ({
      ...p,
      variants: (p.variants_raw || '').split(',').filter(Boolean).map(raw => {
        const [id, sku, size, color, price, stock] = raw.split('|');
        return { id: Number(id), sku, size: size || null, color: color || null, price: Number(price), stock: Number(stock) };
      }),
      variants_raw: undefined,
    }));

    res.json(result);
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

    const { items, customer, address } = req.body || {};
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

    // Calculate GST (18%) and shipping
    const gstAmount = Math.round(subtotal * 18 / 100);
    const shippingCharge = subtotal >= 99900 ? 0 : 9900; // Free above ₹999
    const discountAmount = Math.max(0, Math.round(Number(couponResult.discountAmountPaise || 0)));
    const totalAmount = Math.max(100, subtotal + gstAmount + shippingCharge - discountAmount);
    const orderNumber = generateOrderNumber();

    // Create Razorpay order
    razorpay.orders.create({
      amount: totalAmount,
      currency: 'INR',
      receipt: orderNumber,
      notes: { customerEmail: resolvedCustomer.email, orderNumber, couponCode: String(couponResult.couponCode || couponCode || '') },
    }).then(rpOrder => {
      // Save order to DB
      const insertOrder = db.prepare(`
        INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, total_amount, payment_method, payment_status, razorpay_order_id, shipping_address)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, 'online', 'pending', ?, ?)
      `);
      const result = insertOrder.run(
        orderNumber, resolvedCustomer.name, resolvedCustomer.email, resolvedCustomer.phone,
        authUser?.id || null, merchProfile?.id || null,
        subtotal, gstAmount, shippingCharge, discountAmount, couponResult.coupon?.id || null, couponResult.couponCode || null, totalAmount,
        rpOrder.id, JSON.stringify(address || {})
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
    const { items, customer, address } = req.body || {};
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

    const gstAmount = Math.round(subtotal * 18 / 100);
    const shippingCharge = subtotal >= 99900 ? 0 : 9900;
    const codSurcharge = 5000; // ₹50
    const discountAmount = Math.max(0, Math.round(Number(couponResult.discountAmountPaise || 0)));
    const totalAmount = Math.max(100, subtotal + gstAmount + shippingCharge + codSurcharge - discountAmount);
    const orderNumber = generateOrderNumber();

    const result = db.prepare(`
      INSERT INTO merch_orders (order_number, customer_name, customer_email, customer_phone, customer_user_id, customer_id, status, subtotal, gst_amount, shipping_charge, discount_amount, coupon_id, coupon_code, total_amount, payment_method, payment_status, shipping_address)
      VALUES (?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?, ?, ?, 'cod', 'cod_pending', ?)
    `).run(
      orderNumber,
      resolvedCustomer.name,
      resolvedCustomer.email,
      resolvedCustomer.phone,
      authUser?.id || null,
      merchProfile?.id || null,
      subtotal,
      gstAmount,
      shippingCharge,
      discountAmount,
      couponResult.coupon?.id || null,
      couponResult.couponCode || null,
      totalAmount,
      JSON.stringify(address || {})
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
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

    const orders = db
      .prepare(
        `SELECT id, order_number AS orderNumber, status, subtotal, gst_amount AS gstAmount,
                shipping_charge AS shippingCharge, discount_amount AS discountAmount, total_amount AS totalAmount,
                coupon_id AS couponId, coupon_code AS couponCode,
                payment_method AS paymentMethod, payment_status AS paymentStatus, razorpay_order_id AS razorpayOrderId,
                razorpay_payment_id AS razorpayPaymentId, shipping_address AS shippingAddress,
                tracking_number AS trackingNumber, carrier_name AS carrierName,
                created_at AS createdAt, updated_at AS updatedAt
         FROM merch_orders
         WHERE customer_user_id = ? OR customer_id = ?
         ORDER BY datetime(createdAt) DESC, id DESC`
      )
      .all(Number(req.user.id), Number(profile.id));

    res.json({ profile, addresses, cartItems, wishlistItems, orders });
  });

  app.patch('/api/merch/profile', requireMerchAuth, (req, res) => {
    const profile = ensureMerchCustomerProfileForUser(req.user);
    if (!profile) {
      return res.status(404).json({ message: 'Merch profile could not be created' });
    }

    const fullName = String(req.body?.fullName || req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const mobile = String(req.body?.mobile || req.body?.phone || '').trim();
    const avatarUrl = String(req.body?.avatarUrl || '').trim();

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
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'mobile') || Object.prototype.hasOwnProperty.call(req.body || {}, 'phone')) {
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
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
    const profile = ensureMerchCustomerProfileForUser(req.user);
    const orders = db
      .prepare(
        `SELECT id, order_number AS orderNumber, status, subtotal, gst_amount AS gstAmount,
                shipping_charge AS shippingCharge, discount_amount AS discountAmount, total_amount AS totalAmount,
                coupon_id AS couponId, coupon_code AS couponCode,
                payment_method AS paymentMethod, payment_status AS paymentStatus,
                razorpay_order_id AS razorpayOrderId, razorpay_payment_id AS razorpayPaymentId,
                shipping_address AS shippingAddress, tracking_number AS trackingNumber,
                carrier_name AS carrierName, created_at AS createdAt, updated_at AS updatedAt
         FROM merch_orders
         WHERE customer_user_id = ? OR customer_id = ?
         ORDER BY datetime(createdAt) DESC, id DESC`
      )
      .all(Number(req.user.id), Number(profile?.id || 0));

    res.json({ orders });
  });

  app.get('/api/merch/admin/orders', requireAdmin, (req, res) => {
    const { status, startDate, endDate } = req.query;
    let sql = 'SELECT * FROM merch_orders';
    const params = [];
    const clauses = [];

    if (status && status !== 'all') { clauses.push('status = ?'); params.push(status); }
    if (startDate) { clauses.push("date(created_at) >= date(?)"); params.push(startDate); }
    if (endDate) { clauses.push("date(created_at) <= date(?)"); params.push(endDate); }

    if (clauses.length > 0) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY created_at DESC';

    const orders = db.prepare(sql).all(...params);
    res.json({ orders, total: orders.length });
  });

  // ─── ADMIN: Get order detail ───
  app.get('/api/merch/admin/orders/:id', requireAdmin, (req, res) => {
    const order = db.prepare('SELECT * FROM merch_orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare('SELECT * FROM merch_order_items WHERE order_id = ?').all(order.id);
    res.json({ order, items });
  });

  // ─── ADMIN: Update order status ───
  app.patch('/api/merch/admin/orders/:id/status', requireAdmin, (req, res) => {
    const { status, tracking_number, carrier_name } = req.body || {};
    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const updates = ['status = ?', "updated_at = datetime('now')"];
    const params = [status];
    if (tracking_number) { updates.push('tracking_number = ?'); params.push(tracking_number); }
    if (carrier_name) { updates.push('carrier_name = ?'); params.push(carrier_name); }
    params.push(req.params.id);

    db.prepare(`UPDATE merch_orders SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  });

  // ─── ADMIN: Dashboard stats ───
  app.get('/api/merch/admin/stats', requireAdmin, (req, res) => {
    const totalOrders = db.prepare('SELECT COUNT(*) AS cnt FROM merch_orders').get().cnt;
    const totalRevenue = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS total FROM merch_orders WHERE payment_status = 'paid'").get().total;
    const pendingOrders = db.prepare("SELECT COUNT(*) AS cnt FROM merch_orders WHERE status = 'pending'").get().cnt;
    const processingOrders = db.prepare("SELECT COUNT(*) AS cnt FROM merch_orders WHERE status = 'processing'").get().cnt;
    const shippedOrders = db.prepare("SELECT COUNT(*) AS cnt FROM merch_orders WHERE status = 'shipped'").get().cnt;
    const deliveredOrders = db.prepare("SELECT COUNT(*) AS cnt FROM merch_orders WHERE status = 'delivered'").get().cnt;
    const todayOrders = db.prepare("SELECT COUNT(*) AS cnt FROM merch_orders WHERE date(created_at) = date('now')").get().cnt;

    res.json({ totalOrders, totalRevenue, pendingOrders, processingOrders, shippedOrders, deliveredOrders, todayOrders });
  });

  // ─── ADMIN: Get all products (including inactive) ───
  app.get('/api/merch/admin/products', requireAdmin, (req, res) => {
    const products = db.prepare('SELECT * FROM merch_products ORDER BY created_at DESC').all();
    res.json(products);
  });

  // ─── ADMIN: Get inventory ───
  app.get('/api/merch/admin/inventory', requireAdmin, (req, res) => {
    const variants = db.prepare(`
      SELECT v.*, p.name AS product_name, p.category
      FROM merch_variants v
      JOIN merch_products p ON p.id = v.product_id
      ORDER BY v.stock ASC
    `).all();
    res.json(variants);
  });

  console.log('[Merch] API routes mounted at /api/merch/*');
};

// ─── Seed initial product data ───
function seedMerchProducts(db) {
  const products = [
    { name: 'Zenith Hoodie – Black', slug: 'zenith-hoodie-black', description: 'Heavyweight 450 GSM organic cotton blend hoodie with structured premium silhouette.', category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'Zenith Hoodie – Sand', slug: 'zenith-hoodie-sand', description: 'Same Zenith frame in earthy sand colourway. 450 GSM organic cotton blend.', category: 'hoodies', base_price: 349900, image_url: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146&width=600', gst_rate: 18, weight_grams: 650 },
    { name: 'H2 Molecular Hydrogen Water Bottle', slug: 'h2-water-bottle', description: 'Portable PEM/SPE electrolysis bottle. Generates hydrogen-rich water in 3 minutes. BPA-free, USB-C rechargeable.', category: 'bottles', base_price: 699900, image_url: '/booking/assets/service-hydrogen-session.jpg', gst_rate: 18, weight_grams: 380 },
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
  insertVariant.run(pid, 'HM-BTL-500-SLV', '500ml', 'Silver', 849900, 35);
  insertVariant.run(pid, 'HM-BTL-300-BLK', '300ml', 'Black', 699900, 30);
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
