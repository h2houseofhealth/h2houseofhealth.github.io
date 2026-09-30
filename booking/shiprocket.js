/**
 * Shiprocket API Client for H2 House of Health Merch
 * Handles authentication, token caching, order creation, courier assignment,
 * AWB generation, label printing, pickup scheduling, and live tracking.
 */
'use strict';

const SHIPROCKET_API_BASE = 'https://apiv2.shiprocket.in/v1/external';

class ShiprocketService {
  constructor(config = {}) {
    this.email = config.email || process.env.SHIPROCKET_EMAIL || '';
    this.password = config.password || process.env.SHIPROCKET_PASSWORD || '';
    this.pickupLocation = config.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || 'work';
    this.pickupPostcode = config.pickupPostcode || process.env.SHIPROCKET_PICKUP_POSTCODE || '500033';
    // Default package dimensions and weight matching product specifications (H2 Hydrogen Mist Spray: 10.3cm × 4cm × 4cm, 0.15 kg / 150g)
    this.defaultWeightKg = Number(config.defaultWeightKg || process.env.SHIPROCKET_DEFAULT_WEIGHT_KG || 0.15);
    this.defaultLengthCm = Number(config.defaultLengthCm || process.env.SHIPROCKET_DEFAULT_LENGTH_CM || 10.3);
    this.defaultBreadthCm = Number(config.defaultBreadthCm || process.env.SHIPROCKET_DEFAULT_BREADTH_CM || 4);
    this.defaultHeightCm = Number(config.defaultHeightCm || process.env.SHIPROCKET_DEFAULT_HEIGHT_CM || 4);

    // In-memory token cache (valid for 10 days in Shiprocket)
    this.token = null;
    this.tokenExpiresAt = 0;
  }

  isConfigured() {
    return Boolean(this.getEmail() && this.getPassword());
  }

  getEmail() {
    return (this.email || process.env.SHIPROCKET_EMAIL || '').trim();
  }

  getPassword() {
    return (this.password || process.env.SHIPROCKET_PASSWORD || '').trim();
  }

  getPickupLocation() {
    return (this.pickupLocation || process.env.SHIPROCKET_PICKUP_LOCATION || 'work').trim();
  }

  getPickupPostcode() {
    return (this.pickupPostcode || process.env.SHIPROCKET_PICKUP_POSTCODE || '500033').trim();
  }

  /**
   * Authenticate and obtain or refresh Bearer token
   */
  async getToken(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && this.token && this.tokenExpiresAt > now + 60 * 1000) {
      return this.token;
    }

    const email = this.getEmail();
    const password = this.getPassword();

    if (!email || !password) {
      throw new Error('Shiprocket credentials missing. Please set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD in your environment.');
    }

    const response = await fetch(`${SHIPROCKET_API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.token) {
      const errMsg = data.message || (typeof data.errors === 'object' ? JSON.stringify(data.errors) : 'Failed to authenticate with Shiprocket');
      throw new Error(`Shiprocket auth failed: ${errMsg}`);
    }

    this.token = data.token;
    // Shiprocket tokens last ~10 days; refresh after 9 days to be safe
    this.tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;
    return this.token;
  }

  /**
   * Internal wrapper for authorized Shiprocket requests with auto-token retry
   */
  async request(endpoint, options = {}, isRetry = false) {
    const token = await this.getToken();
    const url = endpoint.startsWith('http') ? endpoint : `${SHIPROCKET_API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle token expiration
    if (response.status === 401 && !isRetry) {
      await this.getToken(true);
      return this.request(endpoint, options, true);
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data.message || (typeof data.errors === 'object' ? JSON.stringify(data.errors) : `HTTP ${response.status}`);
      const err = new Error(`Shiprocket API error: ${message}`);
      err.status = response.status;
      err.details = data;
      throw err;
    }

    return data;
  }

  /**
   * Calculate exact package dimensions and weight for an order:
   * - If a single item is placed, only that specific product's dimensions and weight are passed.
   * - If multiple items or combined items are placed, the combined dimensions (max L, max B, stacked H)
   *   and combined total weight (sum of all product weights * quantities) are passed.
   */
  calculatePackageMetrics(items = [], packageDimensions = null) {
    const dims = packageDimensions || {};
    let length = Number(dims.length || 0);
    let breadth = Number(dims.breadth || 0);
    let height = Number(dims.height || 0);
    let weight = Number(dims.weight || 0);

    let maxL = 0;
    let maxB = 0;
    let totalH = 0;
    let totalWeightGrams = 0;

    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity || item.units || 1));
      let itemL = Number(item.length_cm || item.length || 0);
      let itemB = Number(item.breadth_cm || item.breadth || 0);
      let itemH = Number(item.height_cm || item.height || 0);
      let itemWeight = Number(item.weight_grams ?? item.weightGrams ?? item.weight ?? 0);

      const nameLower = String(item.product_name || item.name || '').toLowerCase();
      const skuUpper = String(item.sku || '').toUpperCase();

      // Resolve known product specifications:
      // 1. Hydrogen Water Bottle: 1kg (1000g), 24cm × 7cm × 7cm
      // 2. Hydrogen Mist Spray: 0.15kg (150g), 10.3cm × 4cm × 4cm
      // 3. Hoodie: 0.65kg (650g), 30cm × 25cm × 5cm
      if (nameLower.includes('bottle') || skuUpper.includes('BTL')) {
        itemL = itemL > 0 ? itemL : 24;
        itemB = itemB > 0 ? itemB : 7;
        itemH = itemH > 0 ? itemH : 7;
        itemWeight = itemWeight > 0 ? itemWeight : 1000;
      } else if (nameLower.includes('spray') || nameLower.includes('mist') || skuUpper.includes('SPR')) {
        itemL = itemL > 0 ? itemL : 10.3;
        itemB = itemB > 0 ? itemB : 4;
        itemH = itemH > 0 ? itemH : 4;
        itemWeight = itemWeight > 0 ? itemWeight : 150;
      } else if (nameLower.includes('hoodie') || skuUpper.includes('HOD')) {
        itemL = itemL > 0 ? itemL : 30;
        itemB = itemB > 0 ? itemB : 25;
        itemH = itemH > 0 ? itemH : 5;
        itemWeight = itemWeight > 0 ? itemWeight : 650;
      } else {
        itemL = itemL > 0 ? itemL : this.defaultLengthCm;
        itemB = itemB > 0 ? itemB : this.defaultBreadthCm;
        itemH = itemH > 0 ? itemH : this.defaultHeightCm;
        itemWeight = itemWeight > 0 ? itemWeight : (this.defaultWeightKg * 1000);
      }

      if (itemL > maxL) maxL = itemL;
      if (itemB > maxB) maxB = itemB;
      totalH += (itemH * qty);
      totalWeightGrams += (itemWeight * qty);
    }

    // Apply calculated or fallback dimensions
    length = length || maxL || this.defaultLengthCm;
    breadth = breadth || maxB || this.defaultBreadthCm;
    height = height || totalH || this.defaultHeightCm;

    // Apply calculated or fallback weight (in kg, minimum 0.01 kg, rounded to 3 decimal places)
    if (!weight || weight <= 0) {
      weight = totalWeightGrams > 0
        ? Math.max(0.01, Number((totalWeightGrams / 1000).toFixed(3)))
        : this.defaultWeightKg;
    }

    return {
      length: Number(length.toFixed(1)),
      breadth: Number(breadth.toFixed(1)),
      height: Number(height.toFixed(1)),
      weight: Number(weight.toFixed(3)),
      totalWeightGrams,
    };
  }

  /**
   * 1. Create a custom ad-hoc order in Shiprocket
   */
  async createOrder({ order, items = [], customPickupLocation = null, packageDimensions = null }) {
    if (!order) throw new Error('Order object is required');

    // Parse shipping address safely
    let shippingAddr = {};
    const rawShipping = order.shipping_address || order.shippingAddress;
    if (typeof rawShipping === 'string') {
      try {
        shippingAddr = JSON.parse(rawShipping);
      } catch {
        shippingAddr = { address1: rawShipping };
      }
    } else if (rawShipping && typeof rawShipping === 'object') {
      shippingAddr = rawShipping;
    }

    // Parse billing address safely
    let billingAddr = {};
    const rawBilling = order.billing_address || order.billingAddress;
    if (typeof rawBilling === 'string') {
      try {
        billingAddr = JSON.parse(rawBilling);
      } catch {
        billingAddr = { address1: rawBilling };
      }
    } else if (rawBilling && typeof rawBilling === 'object') {
      billingAddr = rawBilling;
    }
    const finalBilling = (billingAddr && (billingAddr.line1 || billingAddr.address1 || billingAddr.street)) ? billingAddr : shippingAddr;

    // Resolve full customer name from recipientName, customer_name, guest_name, or profile
    const rawName = String(
      shippingAddr.recipientName ||
      shippingAddr.recipient_name ||
      shippingAddr.name ||
      shippingAddr.fullName ||
      finalBilling.recipientName ||
      finalBilling.recipient_name ||
      finalBilling.name ||
      order.customer_name ||
      order.customerName ||
      order.guest_name ||
      order.guestName ||
      ''
    ).trim();

    const nameParts = rawName ? rawName.split(/\s+/).filter(Boolean) : [];
    const firstName = nameParts[0] || 'Valued';
    const lastName = nameParts.slice(1).join(' ') || (firstName === 'Valued' ? 'Customer' : '');
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Customer';

    const orderDate = order.created_at
      ? new Date(order.created_at).toISOString().slice(0, 19).replace('T', ' ')
      : new Date().toISOString().slice(0, 19).replace('T', ' ');

    const isCod = String(order.payment_method || '').toLowerCase() === 'cod';
    const totalAmountRupees = Math.max(1, Math.round(Number(order.total_amount || 0) / 100));
    const subtotalRupees = Math.round(Number(order.subtotal || order.total_amount || 0) / 100);
    const discountRupees = Math.round(Number(order.discount_amount || 0) / 100);

    const orderItems = items.map((item) => {
      const unitPriceRupees = Math.round(Number(item.unit_price || 0) / 100);
      return {
        name: String(item.product_name || 'Merchandise Item').slice(0, 100),
        sku: String(item.sku || `SKU-${item.variant_id || item.id || 1}`).slice(0, 50),
        units: Math.max(1, Math.floor(Number(item.quantity || 1))),
        selling_price: String(unitPriceRupees),
        discount: '0',
        tax: '0',
        hsn: 0,
      };
    });

    // Calculate exact packaging dimensions and weight for the specific items in this order
    const metrics = this.calculatePackageMetrics(items, packageDimensions);
    const { length, breadth, height, weight } = metrics;

    const payload = {
      order_id: String(order.order_number || `ORD-${order.id}`),
      order_date: orderDate,
      pickup_location: customPickupLocation || this.getPickupLocation(),
      channel_id: '',
      comment: `Order #${order.order_number || order.id} from H2 House of Health Store`,
      customer_name: fullName,
      billing_customer_name: firstName,
      billing_last_name: lastName,
      billing_address: String(finalBilling.line1 || finalBilling.address1 || finalBilling.street || finalBilling.address || 'Address').slice(0, 150),
      billing_address_2: String(finalBilling.line2 || finalBilling.address2 || finalBilling.landmark || '').slice(0, 150),
      billing_city: String(finalBilling.city || 'Indore').trim(),
      billing_pincode: String(finalBilling.postalCode || finalBilling.postal_code || finalBilling.pincode || '452001').trim(),
      billing_state: String(finalBilling.state || 'Madhya Pradesh').trim(),
      billing_country: String(finalBilling.country || 'India').trim(),
      billing_email: String(order.customer_email || order.customerEmail || 'orders@h2houseofhealth.com').trim().toLowerCase(),
      billing_phone: String(order.customer_phone || order.customerPhone || finalBilling.phone || '9999999999').replace(/\D/g, '').slice(-10),
      shipping_is_billing: true,
      shipping_customer_name: firstName,
      shipping_last_name: lastName,
      shipping_address: String(shippingAddr.line1 || shippingAddr.address1 || shippingAddr.street || shippingAddr.address || 'Address').slice(0, 150),
      shipping_address_2: String(shippingAddr.line2 || shippingAddr.address2 || shippingAddr.landmark || '').slice(0, 150),
      shipping_city: String(shippingAddr.city || 'Indore').trim(),
      shipping_pincode: String(shippingAddr.postalCode || shippingAddr.postal_code || shippingAddr.pincode || '452001').trim(),
      shipping_country: String(shippingAddr.country || 'India').trim(),
      shipping_state: String(shippingAddr.state || 'Madhya Pradesh').trim(),
      shipping_email: String(order.customer_email || order.customerEmail || 'orders@h2houseofhealth.com').trim().toLowerCase(),
      shipping_phone: String(order.customer_phone || order.customerPhone || shippingAddr.phone || '9999999999').replace(/\D/g, '').slice(-10),
      order_items: orderItems,
      payment_method: isCod ? 'COD' : 'Prepaid',
      shipping_charges: Math.round(Number(order.shipping_charge || 0) / 100),
      giftwrap_charges: 0,
      transaction_charges: 0,
      total_discount: discountRupees,
      sub_total: subtotalRupees,
      length,
      breadth,
      height,
      weight,
    };

    const result = await this.request('/orders/create/adhoc', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      orderId: result.order_id,
      shipmentId: result.shipment_id,
      status: result.status,
      statusCode: result.status_code,
      awbCode: result.awb_code || null,
      courierName: result.courier_name || null,
      raw: result,
    };
  }

  /**
   * 2. Check available couriers and rates for a shipment
   */
  async checkServiceability({ pickupPostcode, deliveryPostcode, weight = 0.5, cod = false }) {
    const isCod = cod ? 1 : 0;
    const query = new URLSearchParams({
      pickup_postcode: String(pickupPostcode || this.getPickupPostcode() || '500033'),
      delivery_postcode: String(deliveryPostcode),
      weight: String(weight || 0.5),
      cod: String(isCod),
    });

    const result = await this.request(`/courier/serviceability/?${query.toString()}`, {
      method: 'GET',
    });

    const couriers = result?.data?.available_courier_companies || [];
    return couriers
      .map((c) => ({
        courierCompanyId: c.courier_company_id,
        courierName: c.courier_name,
        rate: Number(c.rate || 0),
        etd: c.etd,
        estimatedDeliveryDays: c.estimated_delivery_days,
        rating: c.rating,
        mode: c.mode,
        trackingPerformance: c.tracking_performance,
        isSurface: c.is_surface,
      }))
      .sort((a, b) => a.rate - b.rate);
  }

  /**
   * 3. Assign courier partner and generate AWB
   */
  async assignAwb({ shipmentId, courierId }) {
    if (!shipmentId) throw new Error('Shipment ID is required');

    const payload = {
      shipment_id: shipmentId,
    };
    if (courierId) {
      payload.courier_id = courierId;
    }

    const result = await this.request('/courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const responseData = result?.response?.data || {};
    if (result?.awb_assign_status === 0 || !responseData.awb_code) {
      const msg = result?.message || responseData?.awb_assign_error || 'Failed to assign AWB with selected courier';
      const err = new Error(msg);
      err.details = result;
      throw err;
    }

    return {
      awbCode: responseData.awb_code,
      courierCompanyId: responseData.courier_company_id,
      courierName: responseData.courier_name,
      assignedDateTime: responseData.assigned_date_time,
      appliedWeight: responseData.applied_weight,
      raw: result,
    };
  }

  /**
   * 4. Generate Shipping Label PDF URL
   */
  async generateLabel({ shipmentId }) {
    if (!shipmentId) throw new Error('Shipment ID is required');

    const result = await this.request('/courier/generate/label', {
      method: 'POST',
      body: JSON.stringify({
        shipment_id: [Number(shipmentId)],
      }),
    });

    return {
      labelCreated: Boolean(result.label_created),
      labelUrl: result.label_url || null,
      raw: result,
    };
  }

  /**
   * 5. Generate Tax Invoice PDF URL
   */
  async generateInvoice({ orderIds }) {
    const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
    const result = await this.request('/orders/print/invoice', {
      method: 'POST',
      body: JSON.stringify({
        ids: ids.map(Number),
      }),
    });

    return {
      isInvoiceCreated: Boolean(result.is_invoice_created),
      invoiceUrl: result.invoice_url || null,
      raw: result,
    };
  }

  /**
   * 6. Request Courier Pickup
   */
  async requestPickup({ shipmentId }) {
    if (!shipmentId) throw new Error('Shipment ID is required');

    const result = await this.request('/courier/generate/pickup', {
      method: 'POST',
      body: JSON.stringify({
        shipment_id: [Number(shipmentId)],
      }),
    });

    const response = result?.response || {};
    return {
      pickupStatus: response.pickup_status,
      pickupTokenNumber: response.pickup_token_number || null,
      pickupScheduledDate: response.pickup_scheduled_date || null,
      raw: result,
    };
  }

  /**
   * 7. Track AWB Live Status and Scan Milestones
   */
  async trackAwb(awbCode) {
    if (!awbCode) throw new Error('AWB code is required');

    const result = await this.request(`/courier/track/awb/${encodeURIComponent(awbCode)}`, {
      method: 'GET',
    });

    const trackingData = result?.tracking_data || {};
    const track = (trackingData.shipment_track && trackingData.shipment_track[0]) || {};
    const activities = trackingData.shipment_track_activities || [];

    return {
      trackStatus: trackingData.track_status,
      currentStatus: track.current_status || 'In Transit',
      awbCode: track.awb_code || awbCode,
      courierName: track.courier_name,
      origin: track.origin,
      destination: track.destination,
      pickupDate: track.pickup_date,
      deliveredDate: track.delivered_date,
      edd: track.edd,
      activities: activities.map((act) => ({
        date: act.date,
        status: act.status,
        activity: act.activity,
        location: act.location,
        srStatusLabel: act['sr-status-label'],
      })),
      raw: result,
    };
  }

  /**
   * 8. Cancel Order in Shiprocket
   */
  async cancelOrder({ shiprocketOrderIds }) {
    const ids = Array.isArray(shiprocketOrderIds) ? shiprocketOrderIds : [shiprocketOrderIds];
    const result = await this.request('/orders/cancel', {
      method: 'POST',
      body: JSON.stringify({
        ids: ids.map(Number),
      }),
    });

    return {
      success: true,
      raw: result,
    };
  }
}

module.exports = ShiprocketService;
