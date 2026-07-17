/* House Merch – Storefront App */
/* Vanilla JS SPA following booking portal patterns */

(function () {
  'use strict';

  // ─── API Configuration ───
  function resolveApiUrl() {
    const meta = document.querySelector('meta[name="api-base-url"]');
    const configured = meta ? String(meta.content || '').trim() : '';
    const hostname = window.location.hostname.toLowerCase();
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
    if (configured) return configured;
    if (isLocal) return '';
    return '';
  }

  const API_URL = resolveApiUrl();
  const AUTH_TOKEN_STORAGE_KEY = 'booking_portal_auth_token';
  const CONFIRMATION_STORAGE_KEY = 'merch_booking_confirmation';

  function buildApiUrl(path) {
    if (/^https?:\/\//i.test(String(path || ''))) return String(path);
    const base = API_URL || window.location.origin;
    return `${base}${path}`;
  }

  function getStoredAuthToken() {
    try {
      return String(window.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    const authToken = getStoredAuthToken();
    if (authToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${authToken}`);
    }

    const response = await fetch(buildApiUrl(path), {
      ...options,
      credentials: 'include',
      headers,
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(String(data?.message || data?.error || 'Request failed'));
      error.status = response.status;
      error.data = data || {};
      throw error;
    }

    return data || {};
  }

  // ─── State ───
  const state = {
    products: [],
    cart: [],
    selectedCategory: 'all',
    sortBy: 'newest',
    searchQuery: '',
    currentView: 'shop', // 'shop' | 'detail' | 'confirmation' | 'tracking'
    selectedProduct: null,
    selectedVariant: null,
    quantity: 1,
    authResolved: false,
    currentUser: null,
    merchProfile: null,
    merchOrders: [],
    merchAddresses: [],
    merchWishlistItems: [],
    merchCartItems: [],
    accountDrawerOpen: false,
    accountDrawerTrigger: null,
    accountProfileEditing: false,
    accountProfileMessage: '',
    accountAddressMessage: '',
    accountAddressFormMode: null,
    accountEditingAddressId: null,
    accountOrdersExpanded: false,
    checkoutModalOpen: false,
    checkoutSelectedAddressId: '',
    checkoutMessage: '',
    merchCouponCode: '',
    merchCouponPreview: null,
    merchCouponError: '',
    merchCouponLoading: false,
    latestConfirmation: null,
  };

  const FALLBACK_PRODUCT_IMAGE = '/booking/assets/service-hydrogen-session.jpg';

  // ─── Product Data (Static catalog until API is built) ───
  const PRODUCTS = [
    {
      id: 1,
      name: 'Zenith Hoodie – Black',
      slug: 'zenith-hoodie-black',
      description: 'Meet the hoodie that understands the assignment. Engineered from a heavyweight 450 GSM organic cotton blend, the Zenith offers a structured, premium silhouette without sacrificing that "lived-in" softness. Whether you\'re hitting the gym, the coffee shop, or the couch, this is your new uniform.',
      category: 'hoodies',
      basePrice: 3499.00,
      images: [
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_18271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.328271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.31_18271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.318271.jpg?v=1770377146',
      ],
      variants: [
        { id: 1, size: 'S', color: 'Black', price: 3499.00, stock: 25, sku: 'HM-HOD-BLK-S' },
        { id: 2, size: 'M', color: 'Black', price: 3499.00, stock: 30, sku: 'HM-HOD-BLK-M' },
        { id: 3, size: 'L', color: 'Black', price: 3499.00, stock: 20, sku: 'HM-HOD-BLK-L' },
        { id: 4, size: 'XL', color: 'Black', price: 3499.00, stock: 15, sku: 'HM-HOD-BLK-XL' },
        { id: 5, size: 'XXL', color: 'Black', price: 3499.00, stock: 10, sku: 'HM-HOD-BLK-XXL' },
      ],
      gstRate: 18,
      weightGrams: 650,
      createdAt: '2026-02-06',
    },
    {
      id: 2,
      name: 'Zenith Hoodie – Sand',
      slug: 'zenith-hoodie-sand',
      description: 'Same Zenith. New vibe. The Sand colourway brings an earthy, tonal palette to the heavyweight 450 GSM frame. Perfect for layering or wearing solo — this piece transitions from sunrise sessions to evening outings effortlessly.',
      category: 'hoodies',
      basePrice: 3499.00,
      images: [
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.30034b.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.308271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.302cf7.jpg?v=1770377146',
      ],
      variants: [
        { id: 6, size: 'S', color: 'Sand', price: 3499.00, stock: 20, sku: 'HM-HOD-SND-S' },
        { id: 7, size: 'M', color: 'Sand', price: 3499.00, stock: 25, sku: 'HM-HOD-SND-M' },
        { id: 8, size: 'L', color: 'Sand', price: 3499.00, stock: 18, sku: 'HM-HOD-SND-L' },
        { id: 9, size: 'XL', color: 'Sand', price: 3499.00, stock: 12, sku: 'HM-HOD-SND-XL' },
        { id: 10, size: 'XXL', color: 'Sand', price: 3499.00, stock: 8, sku: 'HM-HOD-SND-XXL' },
      ],
      gstRate: 18,
      weightGrams: 650,
      createdAt: '2026-02-06',
    },
    {
      id: 3,
      name: 'H2 Molecular Hydrogen Water Bottle',
      slug: 'molecular-hydrogen-water-bottle',
      description: 'Generate hydrogen-rich water on the go. This portable bottle uses advanced PEM/SPE electrolysis technology to infuse your water with molecular hydrogen (H₂) in just 3 minutes. BPA-free, USB-C rechargeable, and built to last.',
      category: 'bottles',
      basePrice: 6499.00,
      images: [
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_29477.jpg?v=1770378113',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_2c1ed.jpg?v=1770378113',
      ],
      variants: [
        { id: 11, size: '300ml', color: 'Silver', price: 6999.00, stock: 40, sku: 'HM-BTL-300-SLV' },
        { id: 12, size: '500ml', color: 'Silver', price: 6499.00, stock: 35, sku: 'HM-BTL-500-SLV' },
        { id: 13, size: '300ml', color: 'Black', price: 7499.00, stock: 30, sku: 'HM-BTL-300-BLK' },
        { id: 14, size: '500ml', color: 'Black', price: 8499.00, stock: 25, sku: 'HM-BTL-500-BLK' },
      ],
      gstRate: 18,
      weightGrams: 380,
      createdAt: '2026-03-15',
    },
    {
      id: 4,
      name: 'H2 Hydrogen Mist Spray',
      slug: 'hydrogen-mist-spray',
      description: 'Refresh and rejuvenate your skin anywhere. This compact hydrogen mist spray delivers antioxidant-rich hydrogen water directly to your face and body. Perfect for post-workout recovery, skincare routines, or a quick pick-me-up throughout the day.',
      category: 'sprays',
      basePrice: 2499.00,
      images: [
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.3351c7.jpg?v=1770378138',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33de1d.jpg?v=1770378138',
      ],
      variants: [
        { id: 15, size: '50ml', color: 'White', price: 2499.00, stock: 50, sku: 'HM-SPR-050-WHT' },
        { id: 16, size: '100ml', color: 'White', price: 3499.00, stock: 40, sku: 'HM-SPR-100-WHT' },
        { id: 17, size: '50ml', color: 'Rose Gold', price: 2799.00, stock: 35, sku: 'HM-SPR-050-RSG' },
        { id: 18, size: '100ml', color: 'Rose Gold', price: 3799.00, stock: 30, sku: 'HM-SPR-100-RSG' },
      ],
      gstRate: 18,
      weightGrams: 150,
      createdAt: '2026-04-01',
    },
  ];

  const PRODUCT_IMAGE_SOURCES = PRODUCTS.reduce((map, product) => {
    const source = {
      imageUrl: product.images?.[0] || '',
      images: Array.isArray(product.images) ? [...product.images] : [],
    };
    map[product.slug] = source;
    if (product.slug === 'molecular-hydrogen-water-bottle') {
      map['h2-water-bottle'] = source;
    }
    if (product.slug === 'hydrogen-mist-spray') {
      map['h2-mist-spray'] = source;
    }
    if (product.slug === 'zenith-hoodie-black') {
      map['zenith-hoodie-black'] = source;
    }
    if (product.slug === 'zenith-hoodie-sand') {
      map['zenith-hoodie-sand'] = source;
    }
    return map;
  }, {});

  const PRODUCT_GALLERY_VARIANT_PRICES = {
    'molecular-hydrogen-water-bottle': [6999.00, 6499.00, 7499.00],
    'h2-water-bottle': [6999.00, 6499.00, 7499.00],
    'hydrogen-mist-spray': [2499.00, 3499.00, 2799.00],
    'h2-mist-spray': [2499.00, 3499.00, 2799.00],
  };

  function resolveProductImageSource(product) {
    const slug = String(product?.slug || '').trim().toLowerCase();
    const name = String(product?.name || '').trim().toLowerCase();
    const category = String(product?.category || '').trim().toLowerCase();
    const source =
      (slug && PRODUCT_IMAGE_SOURCES[slug]) ||
      (name.includes('water bottle') ? PRODUCT_IMAGE_SOURCES['h2-water-bottle'] : null) ||
      (name.includes('mist') || category === 'sprays' ? PRODUCT_IMAGE_SOURCES['h2-mist-spray'] : null) ||
      (name.includes('hoodie') && name.includes('black') ? PRODUCT_IMAGE_SOURCES['zenith-hoodie-black'] : null) ||
      (name.includes('hoodie') && name.includes('sand') ? PRODUCT_IMAGE_SOURCES['zenith-hoodie-sand'] : null) ||
      null;
    const fallbackImages = Array.isArray(source?.images) ? source.images.filter(Boolean) : [];
    const productImages = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
    const imageUrl = String(source?.imageUrl || product?.imageUrl || product?.image || product?.image_url || '').trim();

    return {
      imageUrl: imageUrl || fallbackImages[0] || '',
      images: fallbackImages.length ? fallbackImages : (productImages.length ? productImages : (imageUrl ? [imageUrl] : [])),
    };
  }

  function getGalleryVariantPrice(product, index) {
    const slug = String(product?.slug || '').trim().toLowerCase();
    const prices = PRODUCT_GALLERY_VARIANT_PRICES[slug];
    if (!Array.isArray(prices) || !Number.isInteger(index) || index < 0) return null;
    const value = Number(prices[index]);
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  function getGalleryVariantForIndex(product, index) {
    const targetPrice = getGalleryVariantPrice(product, index);
    if (targetPrice == null) return null;

    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => Number(variant.price) === targetPrice) || variants[index] || null;
  }

  function getGalleryVariantFromThumb(product, index) {
    const category = String(product?.category || '').trim().toLowerCase();
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return null;

    if (category === 'hoodies') {
      return variants[index % variants.length] || variants[0] || null;
    }

    return getGalleryVariantForIndex(product, index);
  }

  // ─── Utility ───
  function formatPrice(paise) {
    return '₹' + (paise / 100).toLocaleString('en-IN');
  }

  function getPriceRange(product) {
    const prices = product.variants.map(v => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatPrice(min);
    return `${formatPrice(min)} – ${formatPrice(max)}`;
  }

  function getDefaultPurchasableVariant(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => Number(variant?.stock || 0) > 0) || variants[0] || null;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function getInitials(name) {
    const parts = String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);
    if (!parts.length) return 'H2';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
  }

  function formatDateLabel(value) {
    if (!value) return 'Recently';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }

  function formatOrderStatus(status) {
    const label = String(status || 'pending').replace(/_/g, ' ');
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function formatTrackingDateTime(value) {
    if (!value) return 'Pending';
    const parsed = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value);
    const date = new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
    const time = new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(parsed);
    return `${date}, ${time}`;
  }

  function addTrackingOffset(value, hours) {
    const parsed = value ? new Date(String(value).replace(' ', 'T')) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return null;
    parsed.setHours(parsed.getHours() + hours);
    return parsed.toISOString();
  }

  function normalizeTrackingStatus(status) {
    const normalized = String(status || 'processing').trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (normalized === 'pending') return 'processing';
    if (normalized === 'packed') return 'packed';
    if (normalized === 'shipped') return 'shipped';
    if (normalized === 'out_for_delivery') return 'out_for_delivery';
    if (normalized === 'delivered') return 'delivered';
    return normalized === 'processing' ? 'processing' : normalized;
  }

  function getTrackingSteps(order) {
    const statusOrder = ['processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
    const labels = ['Order Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const status = normalizeTrackingStatus(order?.status);
    const currentIndex = Math.max(0, statusOrder.indexOf(status));
    const createdAt = order?.createdAt || null;
    const updatedAt = order?.updatedAt || createdAt;
    const backendTimeline = Array.isArray(order?.timeline) ? order.timeline : [];
    const timelineTime = (label) => {
      const match = backendTimeline.find((entry) => String(entry?.label || '').toLowerCase().includes(label));
      return match?.time || null;
    };
    const fallbackTimes = [
      createdAt,
      currentIndex >= 1 ? timelineTime('pack') || addTrackingOffset(createdAt, 6) || updatedAt : null,
      currentIndex >= 2 ? timelineTime('ship') || timelineTime('tracking') || updatedAt || addTrackingOffset(createdAt, 24) : null,
      currentIndex >= 3 ? timelineTime('delivery') || updatedAt || addTrackingOffset(createdAt, 48) : null,
      currentIndex >= 4 ? timelineTime('delivered') || updatedAt || addTrackingOffset(createdAt, 72) : null,
    ];

    return labels.map((label, index) => ({
      label,
      time: fallbackTimes[index],
      isComplete: index <= currentIndex,
      isCurrent: index === currentIndex,
      note: index === 2 && (order?.carrier || order?.carrierName || order?.trackingNumber)
        ? [order.carrier || order.carrierName, order.trackingNumber].filter(Boolean).join(' - ')
        : '',
    }));
  }

  function findProductForOrderItem(item) {
    const name = String(item?.name || item?.productName || '').trim().toLowerCase();
    const sku = String(item?.sku || '').trim().toLowerCase();
    const products = Array.isArray(state.products) ? state.products : [];
    return products.find((product) => {
      const productName = String(product.name || '').trim().toLowerCase();
      const variants = Array.isArray(product.variants) ? product.variants : [];
      return productName === name || productName.includes(name) || name.includes(productName)
        || variants.some((variant) => String(variant.sku || '').trim().toLowerCase() === sku);
    }) || null;
  }

  function getTrackingProductSummary(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const item = items[0] || {};
    const product = findProductForOrderItem(item);
    const imageSource = product ? resolveProductImageSource(product) : null;
    return {
      name: item.name || item.productName || order?.service || 'House Merch Order',
      variantLabel: item.variantLabel || '',
      quantity: Number(item.qty || item.quantity || 0) || 1,
      imageUrl: imageSource?.imageUrl || product?.imageUrl || FALLBACK_PRODUCT_IMAGE,
      extraCount: Math.max(0, items.length - 1),
    };
  }

  function getFallbackTrackingOrder(orderId) {
    const confirmation = state.latestConfirmation || getStoredConfirmation();
    if (!confirmation || String(confirmation.orderId || '') !== String(orderId || '')) return null;
    return {
      id: confirmation.orderId,
      orderNumber: confirmation.bookingId,
      status: 'processing',
      createdAt: confirmation.createdAt,
      updatedAt: confirmation.createdAt,
      totalAmount: confirmation.totalAmount,
      items: (Array.isArray(confirmation.items) ? confirmation.items : []).map((item) => ({
        name: item.productName,
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        qty: item.quantity,
      })),
    };
  }

  function getTrackingOrderById(orderId) {
    return getOrderById(orderId) || getFallbackTrackingOrder(orderId);
  }

  function renderTrackingTimeline(order) {
    return `
      <div class="tracking-timeline" aria-label="Order tracking timeline">
        ${getTrackingSteps(order).map((step) => `
          <article class="tracking-step${step.isComplete ? ' is-complete' : ''}${step.isCurrent ? ' is-current' : ''}">
            <div class="tracking-step__marker" aria-hidden="true">${step.isComplete ? confirmationIcon('check') : ''}</div>
            <div class="tracking-step__body">
              <h3>${escapeHtml(step.label)}</h3>
              <p>${escapeHtml(formatTrackingDateTime(step.time))}</p>
              ${step.note ? `<small>${escapeHtml(step.note)}</small>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function OrderTrackingPage(order) {
    if (!order) {
      return `
        <div class="order-tracking__inner">
          <button class="tracking-back-btn" type="button" data-tracking-action="back">&larr; Back</button>
          <div class="tracking-empty">
            <h1 id="orderTrackingTitle">Order tracking</h1>
            <p>We could not find this merchandise order in your account yet.</p>
          </div>
        </div>
      `;
    }

    const product = getTrackingProductSummary(order);
    const statusLabel = formatOrderStatus(order.status || 'processing');
    return `
      <div class="order-tracking__inner">
        <button class="tracking-back-btn" type="button" data-tracking-action="back">&larr; Back</button>
        <article class="tracking-card">
          <header class="tracking-product">
            <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.src='${FALLBACK_PRODUCT_IMAGE}'" />
            <div class="tracking-product__meta">
              <h1 id="orderTrackingTitle">${escapeHtml(product.name)}</h1>
              <p>${escapeHtml([product.variantLabel, `Qty: ${product.quantity}`].filter(Boolean).join(' - '))}</p>
              ${product.extraCount ? `<small>+${product.extraCount} more item${product.extraCount > 1 ? 's' : ''}</small>` : ''}
            </div>
            <span class="tracking-status-badge">${escapeHtml(statusLabel)}</span>
          </header>
          ${renderTrackingTimeline(order)}
          <footer class="tracking-details">
            <div>
              <span>Order ID</span>
              <strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong>
            </div>
            <div>
              <span>Expected Delivery</span>
              <strong>${escapeHtml(order.status === 'delivered' ? 'Delivered' : 'Pending')}</strong>
            </div>
            <button class="btn btn-outline account-action-btn" type="button" data-tracking-action="invoice" data-order-id="${escapeHtml(String(order.id || ''))}">Invoice</button>
          </footer>
        </article>
      </div>
    `;
  }

  function formatCustomerPhone(phone) {
    return String(phone || '').trim() || 'Not added yet';
  }

  function getAddressId(address) {
    return String(address?.id || address?.localId || '');
  }

  function getAddressSummary(address) {
    const parts = [
      address.line1,
      address.line2,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ') || 'Address details not added yet';
  }

  function getWishlistProductLabel(item) {
    const product = state.products.find((entry) => Number(entry.id) === Number(item.productId));
    return product?.name || item.productName || `Saved item #${item.productId || item.id || ''}`.trim();
  }

  function getAddressLabel(address) {
    return String(address?.label || address?.recipientName || 'Shipping Address').trim();
  }

  function getDefaultAddress() {
    const addresses = Array.isArray(state.merchAddresses) ? state.merchAddresses : [];
    return addresses.find((address) => Boolean(address.isDefault)) || addresses[0] || null;
  }

  function serializeAddress(address) {
    if (!address) return {};
    return {
      id: address.id || null,
      label: address.label || '',
      recipientName: address.recipientName || '',
      phone: address.phone || '',
      line1: address.line1 || '',
      line2: address.line2 || '',
      city: address.city || '',
      state: address.state || '',
      postalCode: address.postalCode || '',
      country: address.country || 'India',
      isDefault: Boolean(address.isDefault),
      full: getAddressSummary(address),
    };
  }

  function getAuthenticatedCheckoutCustomer() {
    const profile = getMerchantProfile();
    return {
      name: profile.fullName,
      email: profile.email,
      phone: profile.mobile,
    };
  }

  function syncCheckoutProfileDetails(payload) {
    const fullName = String(payload?.recipientName || '').trim();
    const mobile = String(payload?.phone || '').trim();

    if (fullName || mobile) {
      state.merchProfile = {
        ...(state.merchProfile || {}),
        ...(fullName ? { fullName } : {}),
        ...(mobile ? { mobile } : {}),
      };

      if (state.currentUser) {
        state.currentUser = {
          ...state.currentUser,
          ...(fullName ? { name: fullName } : {}),
          ...(mobile ? { mobile } : {}),
        };
      }

      renderAccountTrigger();
    }
  }

  function setBodyAuthLoading(isLoading) {
    document.body.classList.toggle('is-auth-loading', Boolean(isLoading));
  }

  function normalizeMerchProduct(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    const imageSource = resolveProductImageSource(product);
    const imageUrl = String(imageSource.imageUrl || '').trim();
    const images = Array.isArray(imageSource.images) && imageSource.images.length
      ? imageSource.images.filter(Boolean)
      : imageUrl
        ? [imageUrl]
        : [];

    return {
      ...product,
      id: Number(product?.id || 0),
      name: String(product?.name || ''),
      slug: String(product?.slug || ''),
      description: String(product?.description || ''),
      category: String(product?.category || ''),
      basePrice: Number(product?.basePrice || product?.base_price || 0),
      imageUrl,
      image: imageUrl,
      images,
      variants,
      price: Number(product?.price || product?.basePrice || product?.base_price || 0),
      priceLabel: String(product?.priceLabel || ''),
      createdAt: String(product?.createdAt || ''),
    };
  }

  async function loadMerchProducts() {
    try {
      const result = await api('/api/merch/products');
      state.products = Array.isArray(result) ? result.map(normalizeMerchProduct) : [];
    } catch (error) {
      state.products = [];
      console.error('Unable to load merch products:', error);
    }

    renderProductGrid();

    if (state.currentView === 'detail' && state.selectedProduct) {
      const refreshed = state.products.find((product) => Number(product.id) === Number(state.selectedProduct.id));
      if (refreshed) {
        state.selectedProduct = refreshed;
        state.selectedVariant = refreshed.variants?.find((variant) => Number(variant.id) === Number(state.selectedVariant?.id)) || refreshed.variants?.[0] || null;
        if (state.selectedVariant) {
          renderProductGallery(refreshed);
          renderProductInfo(refreshed);
        }
      }
    }

    if (state.currentView === 'tracking') {
      const trackingOrderId = getTrackingOrderIdFromHash();
      if (trackingOrderId) showOrderTracking(trackingOrderId);
    }
  }

  // ─── Elements ───
  const els = {
    productGrid: document.getElementById('productGrid'),
    productEmpty: document.getElementById('productEmpty'),
    productDetail: document.getElementById('productDetail'),
    productGallery: document.getElementById('productGallery'),
    productInfo: document.getElementById('productInfo'),
    shopSection: document.getElementById('shopSection'),
    categoryFilter: document.getElementById('categoryFilter'),
    sortSelect: document.getElementById('sortSelect'),
    backToShopBtn: document.getElementById('backToShopBtn'),
    heroShopBtn: document.getElementById('heroShopBtn'),
    searchToggleBtn: document.getElementById('searchToggleBtn'),
    searchOverlay: document.getElementById('searchOverlay'),
    searchInput: document.getElementById('searchInput'),
    searchCloseBtn: document.getElementById('searchCloseBtn'),
    searchResults: document.getElementById('searchResults'),
    cartToggleBtn: document.getElementById('cartToggleBtn'),
    cartDrawer: document.getElementById('cartDrawer'),
    cartOverlay: document.getElementById('cartOverlay'),
    cartCloseBtn: document.getElementById('cartCloseBtn'),
    cartItems: document.getElementById('cartItems'),
    cartFooter: document.getElementById('cartFooter'),
    cartEmpty: document.getElementById('cartEmpty'),
    cartSubtotal: document.getElementById('cartSubtotal'),
    cartCouponCode: document.getElementById('cartCouponCode'),
    cartCouponApplyBtn: document.getElementById('cartCouponApplyBtn'),
    cartCouponPreview: document.getElementById('cartCouponPreview'),
    cartBadge: document.getElementById('cartBadge'),
    cartShopBtn: document.getElementById('cartShopBtn'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    bookingConfirmation: document.getElementById('bookingConfirmation'),
    orderTracking: document.getElementById('orderTracking'),
    merchAuthCta: document.getElementById('merchAuthCta'),
    accountDrawer: document.getElementById('accountDrawer'),
    accountDrawerOverlay: document.getElementById('accountDrawerOverlay'),
    accountDrawerCloseBtn: document.getElementById('accountDrawerCloseBtn'),
    accountDrawerContent: document.getElementById('accountDrawerContent'),
  };

  // ─── Cart (localStorage for now) ───
  function loadCart() {
    try {
      const saved = localStorage.getItem('merch_cart');
      state.cart = saved ? JSON.parse(saved) : [];
    } catch {
      state.cart = [];
    }
  }

  function saveCart() {
    localStorage.setItem('merch_cart', JSON.stringify(state.cart));
    renderCartBadge();
  }

  function addToCart(variantId, quantity, product, options = {}) {
    const { openDrawerAfterAdd = true } = options;
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant || variant.stock <= 0) return false;

    const existing = state.cart.find(item => item.variantId === variantId);
    if (existing) {
      const newQty = Math.min(Math.max(1, quantity), variant.stock);
      existing.quantity = newQty;
    } else {
      state.cart.push({
        variantId,
        productId: product.id,
        productName: product.name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        price: variant.price,
        quantity: Math.min(quantity, variant.stock),
        image: product.images?.[0] || product.imageUrl || FALLBACK_PRODUCT_IMAGE,
        sku: variant.sku,
      });
    }
    saveCart();
    if (openDrawerAfterAdd) {
      openCart();
    }
    return true;
  }

  async function buyNow(variantId, quantity, product) {
    const added = addToCart(variantId, quantity, product, { openDrawerAfterAdd: false });
    if (!added) {
      showCheckoutNotice('Out of stock', 'This product is currently unavailable.', { variant: 'error' });
      return;
    }

    await initiateCheckout();
  }

  async function handleProductCardAction(action, product) {
    const variant = getDefaultPurchasableVariant(product);
    if (!variant || Number(variant.stock || 0) <= 0) {
      showCheckoutNotice('Out of stock', 'This product is currently unavailable.', { variant: 'error' });
      return;
    }

    if (action === 'buy-now') {
      const added = addToCart(variant.id, 1, product, { openDrawerAfterAdd: false });
      if (!added) {
        showCheckoutNotice('Out of stock', 'This product is currently unavailable.', { variant: 'error' });
        return;
      }
      await initiateCheckout();
      return;
    }

    addToCart(variant.id, 1, product);
  }

  function removeFromCart(variantId) {
    state.cart = state.cart.filter(item => item.variantId !== variantId);
    saveCart();
    renderCart();
  }

  function getCartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getCartCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function normalizeCouponCode(code) {
    return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  function renderMerchCouponPreview() {
    if (!els.cartCouponPreview) return;
    const preview = state.merchCouponPreview;
    if (!preview) {
      if (state.merchCouponError) {
        els.cartCouponPreview.hidden = false;
        els.cartCouponPreview.innerHTML = `<span>${escapeHtml(state.merchCouponError)}</span>`;
      } else {
        els.cartCouponPreview.hidden = true;
        els.cartCouponPreview.innerHTML = '';
      }
      return;
    }

    els.cartCouponPreview.hidden = false;
    els.cartCouponPreview.innerHTML = `
      <strong>${escapeHtml(preview.code || '')}</strong>
      <span>${escapeHtml(preview.description || 'Coupon applied')}</span>
      <span>Discount: ${formatPrice(Number(preview.discountAmountInr || 0) * 100)}</span>
      <span>Payable: ${formatPrice(Number(preview.payableAmountInr || 0) * 100)}</span>
    `;
  }

  async function applyMerchCouponFromCart() {
    const code = normalizeCouponCode(els.cartCouponCode?.value || state.merchCouponCode || '');
    state.merchCouponCode = code;
    state.merchCouponError = '';

    if (!code) {
      state.merchCouponPreview = null;
      renderMerchCouponPreview();
      return;
    }

    if (!state.currentUser) {
      state.merchCouponPreview = null;
      state.merchCouponError = 'Sign in to apply merch coupons.';
      showCheckoutNotice('Sign in required', 'Sign in to apply a merch coupon.', { variant: 'error' });
      renderMerchCouponPreview();
      return;
    }

    state.merchCouponLoading = true;
    try {
      const result = await api('/api/merch/preview-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: code,
          subtotalAmountPaise: getCartTotal(),
        }),
      });
      state.merchCouponPreview = result.coupon || null;
      if (els.cartCouponCode) els.cartCouponCode.value = code;
      showCheckoutNotice('Coupon applied', `${code} is ready for checkout.`);
    } catch (error) {
      state.merchCouponPreview = null;
      state.merchCouponError = error.message || 'Unable to validate coupon.';
      showCheckoutNotice('Coupon error', state.merchCouponError, { variant: 'error' });
    } finally {
      state.merchCouponLoading = false;
      renderMerchCouponPreview();
    }
  }

  // ─── Render: Cart Badge ───
  function renderCartBadge() {
    const count = getCartCount();
    if (count > 0) {
      els.cartBadge.textContent = count;
      els.cartBadge.hidden = false;
    } else {
      els.cartBadge.hidden = true;
    }
  }

  // ─── Render: Cart Drawer ───
  function renderCart() {
    if (state.cart.length === 0) {
      els.cartItems.innerHTML = '';
      els.cartFooter.hidden = true;
      els.cartEmpty.style.display = 'flex';
      state.merchCouponCode = '';
      state.merchCouponPreview = null;
      state.merchCouponError = '';
      renderMerchCouponPreview();
      return;
    }

    els.cartEmpty.style.display = 'none';
    els.cartFooter.hidden = false;
    if (els.cartCouponCode) els.cartCouponCode.value = state.merchCouponCode || '';
    if (els.cartCouponApplyBtn) {
      els.cartCouponApplyBtn.textContent = state.currentUser
        ? (state.merchCouponLoading ? 'Applying...' : 'Apply Coupon')
        : 'Sign in to Apply';
      els.cartCouponApplyBtn.disabled = Boolean(state.merchCouponLoading || !state.currentUser);
    }
    renderMerchCouponPreview();

    els.cartItems.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <div class="cart-item__image">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}" />
        </div>
        <div class="cart-item__details">
          <p class="cart-item__name">${escapeHtml(item.productName)}</p>
          <p class="cart-item__variant">${escapeHtml(item.variantLabel)} × ${item.quantity}</p>
          <p class="cart-item__price">${formatPrice(item.price * item.quantity)}</p>
        </div>
        <button class="cart-item__remove" data-variant-id="${item.variantId}" aria-label="Remove">✕</button>
      </div>
    `).join('');

    els.cartSubtotal.textContent = formatPrice(getCartTotal());

    // Bind remove buttons
    els.cartItems.querySelectorAll('.cart-item__remove').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFromCart(Number(btn.dataset.variantId));
      });
    });
  }

  function getStoredConfirmation() {
    try {
      const raw = window.sessionStorage?.getItem(CONFIRMATION_STORAGE_KEY) || '';
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveConfirmation(confirmation) {
    state.latestConfirmation = confirmation;
    try {
      window.sessionStorage?.setItem(CONFIRMATION_STORAGE_KEY, JSON.stringify(confirmation));
    } catch {
      // Session storage is a convenience for the redirect; the in-memory state still renders.
    }
  }

  function formatConfirmationDate(value) {
    const parsed = value ? new Date(value) : new Date();
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      weekday: 'long',
    }).format(date);
  }

  function formatConfirmationTime(value) {
    const parsed = value ? new Date(value) : new Date();
    const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return new Intl.DateTimeFormat('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  function getConfirmationLocation(address) {
    const parts = [
      address?.line1,
      address?.line2,
      address?.city,
      address?.state,
      address?.postalCode,
      address?.country,
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : String(address?.full || 'Hyderabad, Telangana').trim();
  }

  function buildConfirmationData({ order, verifyResult, customer, address, cartItems }) {
    const createdAt = new Date().toISOString();
    const items = Array.isArray(cartItems) ? cartItems : [];
    const itemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    return {
      bookingId: String(order?.orderNumber || verifyResult?.orderNumber || 'BK20260717001'),
      orderId: verifyResult?.orderId || order?.orderId || null,
      createdAt,
      dateLabel: formatConfirmationDate(createdAt),
      timeLabel: `${formatConfirmationTime(createdAt)} - Order received`,
      service: itemCount > 1 ? `House Merch Order (${itemCount} items)` : 'House Merch Order',
      locationTitle: 'Delivery Location',
      location: getConfirmationLocation(address),
      email: String(customer?.email || order?.customer?.email || 'example@email.com').trim(),
      customerName: String(customer?.name || order?.customer?.name || 'H2 Customer').trim(),
      totalAmount: Number(order?.amount || 0),
      items: items.map((item) => ({
        productName: item.productName,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
      })),
    };
  }

  function confirmationIcon(name) {
    const icons = {
      check: '<path d="M7 12.2 10.4 15.6 18 8" />',
      copy: '<rect x="9" y="9" width="9" height="11" rx="1.5" /><path d="M6 15H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 4h8a1.5 1.5 0 0 1 1.5 1.5v1" />',
      calendar: '<rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" />',
      user: '<circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" />',
      map: '<path d="M12 21s7-5.2 7-12a7 7 0 1 0-14 0c0 6.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.4" />',
      truck: '<path d="M3 7h10v9H3zM13 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.8" /><circle cx="17" cy="18" r="1.8" />',
      home: '<path d="m4 11 8-7 8 7" /><path d="M6.5 10.5V20h11v-9.5" /><path d="M10 20v-6h4v6" />',
      mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" />',
      shield: '<path d="M12 3 5 6v5.5c0 4 2.8 7.2 7 8.5 4.2-1.3 7-4.5 7-8.5V6z" /><path d="m9 12 2 2 4-5" />',
      bell: '<path d="M18 16H6c1.2-1.4 1.8-3 1.8-5V9a4.2 4.2 0 0 1 8.4 0v2c0 2 .6 3.6 1.8 5Z" /><path d="M10 19a2.3 2.3 0 0 0 4 0" />',
      heart: '<path d="M20.5 8.8c0 5-8.5 10.2-8.5 10.2S3.5 13.8 3.5 8.8A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 8.5 1.3Z" />',
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.check}</svg>`;
  }

  function BookingSuccessHeader(data) {
    return `
      <div class="booking-success-header">
        <div class="booking-confetti" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="booking-success-icon">${confirmationIcon('check')}</div>
        <h1 id="bookingConfirmationTitle">Booking Confirmed!</h1>
        <p>Your booking has been confirmed successfully.</p>
        <p>A confirmation has been sent to your email.</p>
      </div>
    `;
  }

  function BookingIdCard(data) {
    return `
      <div class="booking-id-card">
        <span>Booking ID</span>
        <strong>${escapeHtml(data.bookingId)}</strong>
        <button class="booking-copy-btn" type="button" data-confirmation-action="copy-id" aria-label="Copy booking ID">
          ${confirmationIcon('copy')}
        </button>
      </div>
    `;
  }

  function BookingDetailsCard(data) {
    const details = [
      { icon: 'calendar', label: 'Date & Time', lines: [data.dateLabel, data.timeLabel] },
      { icon: 'user', label: 'Service', lines: [data.service] },
      { icon: 'map', label: data.locationTitle || 'Location', lines: ['H2 House of Health', data.location] },
    ];
    return `
      <div class="booking-details-card">
        ${details.map((item) => `
          <article class="booking-detail-item">
            <div class="booking-detail-icon">${confirmationIcon(item.icon)}</div>
            <div>
              <h2>${escapeHtml(item.label)}</h2>
              ${item.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function BookingActions() {
    return `
      <div class="booking-actions">
        <button class="booking-action-btn booking-action-btn--neutral" type="button" data-confirmation-action="calendar">
          ${confirmationIcon('calendar')} <span>Add to Calendar</span>
        </button>
        <button class="booking-action-btn booking-action-btn--accent" type="button" data-confirmation-action="track">
          ${confirmationIcon('truck')} <span>Track My Order</span>
        </button>
        <button class="booking-action-btn booking-action-btn--primary" type="button" data-confirmation-action="home">
          ${confirmationIcon('home')} <span>Back to Home</span>
        </button>
      </div>
    `;
  }

  function EmailConfirmationCard(data) {
    return `
      <div class="booking-email-card">
        <div class="booking-email-icon">${confirmationIcon('mail')}</div>
        <div>
          <p>We've sent all the details to</p>
          <strong>${escapeHtml(data.email)}</strong>
          <p>Please check your inbox (and spam folder).</p>
        </div>
        <div class="booking-email-illustration" aria-hidden="true">
          <div class="booking-envelope">${confirmationIcon('mail')}</div>
          <span>${confirmationIcon('check')}</span>
        </div>
      </div>
    `;
  }

  function BookingFeatureCards() {
    const features = [
      { icon: 'shield', title: 'Secure Booking', text: 'Your booking is safe with us.' },
      { icon: 'calendar', title: 'Easy Reschedule', text: 'Reschedule or modify your booking anytime.' },
      { icon: 'bell', title: 'Timely Reminders', text: "We'll remind you before your session." },
      { icon: 'heart', title: 'Premium Experience', text: 'We are here to make your experience exceptional.' },
    ];
    return `
      <div class="booking-feature-cards">
        ${features.map((feature) => `
          <article class="booking-feature-card">
            <div class="booking-feature-icon">${confirmationIcon(feature.icon)}</div>
            <div>
              <h2>${escapeHtml(feature.title)}</h2>
              <p>${escapeHtml(feature.text)}</p>
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function BookingConfirmationPage(data) {
    return `
      <div class="booking-confirmation__inner">
        ${BookingSuccessHeader(data)}
        ${BookingIdCard(data)}
        ${BookingDetailsCard(data)}
        ${BookingActions(data)}
        ${EmailConfirmationCard(data)}
        ${BookingFeatureCards(data)}
      </div>
    `;
  }

  function bindBookingConfirmationActions(data) {
    if (!els.bookingConfirmation) return;
    els.bookingConfirmation.querySelectorAll('[data-confirmation-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.confirmationAction;
        if (action === 'copy-id') {
          try {
            await navigator.clipboard?.writeText(data.bookingId);
            button.classList.add('is-copied');
            setTimeout(() => button.classList.remove('is-copied'), 1200);
          } catch {
            showCheckoutNotice('Copy unavailable', `Booking ID: ${data.bookingId}`);
          }
          return;
        }
        if (action === 'home') {
          window.location.href = '/';
          return;
        }
        if (action === 'track') {
          if (data.orderId) {
            window.location.hash = `track-order/${encodeURIComponent(data.orderId)}`;
          } else {
            showCheckoutNotice('Track My Order', 'Order details are unavailable for tracking yet.');
          }
          return;
        }
        if (action === 'calendar') {
          showCheckoutNotice('Add to Calendar', 'Calendar export is ready for future booking schedule details.');
        }
      });
    });
  }

  function showBookingConfirmation(data = null) {
    const confirmation = data || state.latestConfirmation || getStoredConfirmation() || buildConfirmationData({});
    state.currentView = 'confirmation';
    state.latestConfirmation = confirmation;

    els.productDetail.hidden = true;
    els.shopSection.hidden = true;
    if (els.orderTracking) els.orderTracking.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    if (els.bookingConfirmation) {
      els.bookingConfirmation.hidden = false;
      els.bookingConfirmation.innerHTML = BookingConfirmationPage(confirmation);
      bindBookingConfirmationActions(confirmation);
    }
    closeCart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function getTrackingOrderIdFromHash() {
    const match = String(window.location.hash || '').match(/^#track-order\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function bindOrderTrackingActions(order) {
    if (!els.orderTracking) return;
    els.orderTracking.querySelectorAll('[data-tracking-action]').forEach((button) => {
      button.addEventListener('click', async () => {
        const action = button.dataset.trackingAction;
        if (action === 'back') {
          if (state.accountDrawerOpen) closeAccountDrawer();
          window.history.length > 1 ? window.history.back() : showShop();
          return;
        }
        if (action === 'invoice' && order?.id) {
          await openMerchInvoice(order.id);
        }
      });
    });
  }

  function showOrderTracking(orderId) {
    const order = getTrackingOrderById(orderId);
    state.currentView = 'tracking';

    els.productDetail.hidden = true;
    els.shopSection.hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    if (els.orderTracking) {
      els.orderTracking.hidden = false;
      els.orderTracking.innerHTML = OrderTrackingPage(order);
      bindOrderTrackingActions(order);
    }
    closeCart();
    closeAccountDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function routeFromLocation() {
    const trackingOrderId = getTrackingOrderIdFromHash();
    if (trackingOrderId) {
      showOrderTracking(trackingOrderId);
      return true;
    }
    if (window.location.hash === '#booking-confirmation') {
      showBookingConfirmation();
      return true;
    }
    return false;
  }

  function openCart() {
    els.cartDrawer.hidden = false;
    els.cartOverlay.hidden = false;
    requestAnimationFrame(() => {
      els.cartDrawer.classList.add('is-open');
    });
    renderCart();
  }

  function closeCart() {
    els.cartDrawer.classList.remove('is-open');
    setTimeout(() => {
      els.cartDrawer.hidden = true;
      els.cartOverlay.hidden = true;
    }, 300);
  }

  function getMerchantProfile() {
    const profile = state.merchProfile || {};
    const user = state.currentUser || {};
    return {
      fullName: String(profile.fullName || user.name || 'House of Health Customer').trim(),
      email: String(profile.email || user.email || '').trim(),
      mobile: String(profile.mobile || user.mobile || '').trim(),
      avatarUrl: String(profile.avatarUrl || user.avatarUrl || '').trim(),
    };
  }

  function renderAccountTrigger() {
    if (!els.merchAuthCta) return;

    if (!state.authResolved) {
      els.merchAuthCta.innerHTML = '';
      return;
    }

    const profile = getMerchantProfile();
    const initials = escapeHtml(getInitials(profile.fullName));
    const avatarStyle = profile.avatarUrl
      ? ` style="background-image:url('${escapeHtml(profile.avatarUrl)}')"`
      : '';

    if (!state.currentUser) {
      els.merchAuthCta.innerHTML = `
        <a href="/merch/auth.html?returnTo=%2Fmerch%2F" class="header-book-now-btn">
          Sign Up / Login
        </a>
      `;
      return;
    }

    els.merchAuthCta.innerHTML = `
      <button
        id="merchAccountBtn"
        class="profile-btn merch-account-btn"
        type="button"
        aria-expanded="false"
        aria-controls="accountDrawer"
      >
        <span class="profile-avatar${profile.avatarUrl ? ' has-image' : ''}"${avatarStyle}>${initials}</span>
        <span class="profile-meta">
          <strong>${escapeHtml(profile.fullName)}</strong>
          <span>${escapeHtml(profile.email || 'Logged in')}</span>
        </span>
      </button>
    `;

    const button = document.getElementById('merchAccountBtn');
    button?.addEventListener('click', openAccountDrawer);
  }

  function renderAccountDrawer() {
    if (!els.accountDrawerContent) return;

    const profile = getMerchantProfile();
    const orders = Array.isArray(state.merchOrders) ? state.merchOrders : [];
    const addresses = Array.isArray(state.merchAddresses) ? state.merchAddresses : [];
    const wishlistItems = Array.isArray(state.merchWishlistItems) ? state.merchWishlistItems : [];
    const visibleOrders = state.accountOrdersExpanded ? orders : orders.slice(0, 4);
    const editingAddress = addresses.find((address) => getAddressId(address) === String(state.accountEditingAddressId || ''));
    const accountInitials = escapeHtml(getInitials(profile.fullName));
    const avatarStyle = profile.avatarUrl
      ? ` style="background-image:url('${escapeHtml(profile.avatarUrl)}')"`
      : '';

    els.accountDrawerContent.innerHTML = `
      <section class="account-card account-card--profile">
        <div class="account-card__avatar profile-avatar${profile.avatarUrl ? ' has-image' : ''}"${avatarStyle}>${accountInitials}</div>
        <div class="account-card__summary">
          <div class="account-card__title-row">
            <div>
              <p class="account-card__eyebrow">My Profile</p>
              <h3>${escapeHtml(profile.fullName)}</h3>
            </div>
            ${state.accountProfileEditing ? '' : '<button class="btn btn-outline account-action-btn" type="button" data-account-action="edit-profile">Edit</button>'}
          </div>
          ${state.accountProfileEditing ? `
            <form class="account-form" id="accountProfileForm">
              <label class="account-field">
                <span>Full Name</span>
                <input name="fullName" type="text" value="${escapeHtml(profile.fullName)}" autocomplete="name" required />
              </label>
              <label class="account-field">
                <span>Email</span>
                <input type="email" value="${escapeHtml(profile.email || '')}" readonly aria-readonly="true" />
              </label>
              <label class="account-field">
                <span>Mobile Number</span>
                <input name="mobile" type="tel" value="${escapeHtml(profile.mobile)}" autocomplete="tel" />
              </label>
              <div class="account-form__actions">
                <button class="btn btn-primary account-action-btn" type="submit">Save</button>
                <button class="btn btn-outline account-action-btn" type="button" data-account-action="cancel-profile">Cancel</button>
              </div>
            </form>
          ` : `
            <ul class="account-meta-list">
              <li><span>Email</span><strong>${escapeHtml(profile.email || 'Not added yet')}</strong></li>
              <li><span>Mobile Number</span><strong>${escapeHtml(formatCustomerPhone(profile.mobile))}</strong></li>
            </ul>
            <p class="account-card__note">Email is your account identity and cannot be changed here.</p>
          `}
          ${state.accountProfileMessage ? `<p class="account-success-message">${escapeHtml(state.accountProfileMessage)}</p>` : ''}
        </div>
      </section>

      <section class="account-section">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">My Addresses</p>
            <h4>Shipping and billing</h4>
          </div>
          <div class="account-section__actions">
            <button class="btn btn-outline account-action-btn" type="button" data-account-action="add-address">Add Address</button>
            <span class="account-section__count">${addresses.length}</span>
          </div>
        </div>
        ${state.accountAddressFormMode ? renderAddressForm(editingAddress) : ''}
        ${state.accountAddressMessage ? `<p class="account-success-message" role="alert">${escapeHtml(state.accountAddressMessage)}</p>` : ''}
        ${addresses.length ? `
          <div class="account-list">
            ${addresses.map((address) => `
              <article class="account-list__item">
                <div>
                  <strong>${escapeHtml(address.label || address.recipientName || 'Address')}</strong>
                  <p>${escapeHtml(getAddressSummary(address))}</p>
                  <p>${escapeHtml([address.recipientName, address.phone].filter(Boolean).join(' · '))}</p>
                </div>
                <div class="account-item-actions">
                  <span>${address.isDefault ? 'Default' : escapeHtml(address.country || 'India')}</span>
                  <button type="button" data-account-action="edit-address" data-address-id="${escapeHtml(getAddressId(address))}">Edit</button>
                  <button type="button" data-account-action="delete-address" data-address-id="${escapeHtml(getAddressId(address))}">Delete</button>
                  ${address.isDefault ? '' : `<button type="button" data-account-action="default-address" data-address-id="${escapeHtml(getAddressId(address))}">Mark as Default</button>`}
                </div>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="account-empty-state">
            <p>No saved addresses yet.</p>
            <span>Add one now to speed up merch checkout.</span>
            <button class="btn btn-outline account-action-btn" type="button" data-account-action="add-address">Add Address</button>
          </div>
        `}
      </section>

      <section class="account-section">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">My Orders</p>
            <h4>Merchandise orders</h4>
          </div>
          <div class="account-section__actions">
            ${orders.length > 4 ? `<button class="btn btn-outline account-action-btn" type="button" data-account-action="view-all-orders">${state.accountOrdersExpanded ? 'Show Less' : 'View All'}</button>` : ''}
            <span class="account-section__count">${orders.length}</span>
          </div>
        </div>
        ${orders.length ? `
          <div class="account-list">
            ${visibleOrders.map((order) => `
              <article class="account-list__item account-list__item--stacked">
                <div class="account-list__row">
                  <strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong>
                  <div class="order-status-group">
                    <span class="payment-status payment-status--paid">
                      ${order.paymentStatus === 'paid' ? 'Paid' : 'Pending Payment'}
                    </span>
                    <span class="order-status">
                      ${escapeHtml(formatOrderStatus(order.status))}
                    </span>
                  </div>
                  
                </div>
                <p>${escapeHtml(formatDateLabel(order.createdAt))} · ${escapeHtml(order.totalAmount ? formatPrice(order.totalAmount) : 'Total unavailable')}</p>
                <div class="account-item-actions account-item-actions--inline">
                  <button type="button" data-account-action="view-order" data-order-id="${escapeHtml(String(order.id || ''))}">View Details</button>
                  <button type="button" data-account-action="track-order" data-order-id="${escapeHtml(String(order.id || ''))}">Track Order</button>
                  <button type="button" data-account-action="invoice-order" data-order-id="${escapeHtml(String(order.id || ''))}">Invoice</button>
                  <button type="button" data-account-action="email-invoice" data-order-id="${escapeHtml(String(order.id || ''))}">Email</button>
                  <button type="button" data-account-action="download-invoice" data-order-id="${escapeHtml(String(order.id || ''))}">Download PDF</button>
                </div>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="account-empty-state">
            <p>No orders yet.</p>
            <span>Your first merch order will appear here after checkout.</span>
          </div>
        `}
      </section>

      <section class="account-section">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Wishlist</p>
            <h4>Saved for later</h4>
          </div>
          <div class="account-section__actions">
            <button class="btn btn-outline account-action-btn" type="button" data-account-action="view-wishlist">View Wishlist</button>
            <span class="account-section__count">${wishlistItems.length}</span>
          </div>
        </div>
        ${wishlistItems.length ? `
          <div class="account-list">
            ${wishlistItems.map((item) => `
              <article class="account-list__item account-list__item--stacked">
                <div class="account-list__row">
                  <strong>${escapeHtml(getWishlistProductLabel(item))}</strong>
                  <span>Saved</span>
                </div>
                <div class="account-item-actions account-item-actions--inline">
                  <button type="button" data-account-action="wishlist-move" data-wishlist-id="${escapeHtml(String(item.id || ''))}">Move to Cart</button>
                  <button type="button" data-account-action="wishlist-remove" data-wishlist-id="${escapeHtml(String(item.id || ''))}">Remove</button>
                </div>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="account-empty-state">
            <p>No wishlist items yet.</p>
            <span>Tap the heart on a product to save it for later.</span>
            <button class="btn btn-outline account-action-btn" type="button" data-account-action="view-wishlist">View Wishlist</button>
          </div>
        `}
      </section>

      <section class="account-section">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Saved Payments</p>
            <h4>Fast checkout</h4>
          </div>
          <span class="account-section__count">0</span>
        </div>
        <div class="account-empty-state">
          <p>Coming Soon</p>
          <span>Payment storage is not enabled yet.</span>
        </div>
      </section>

      <section class="account-section">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Account Settings</p>
            <h4>Shopping preferences</h4>
          </div>
        </div>
        <div class="account-chip-list">
          <span class="account-chip">Merch updates</span>
          <span class="account-chip">Order alerts</span>
          <span class="account-chip">Default to shipping address</span>
        </div>
      </section>

      <button id="merchLogoutBtn" class="btn btn-secondary btn-full account-logout-btn" type="button">Logout</button>
    `;

    document.getElementById('merchLogoutBtn')?.addEventListener('click', handleLogout);
    bindAccountDrawerActions();
  }

  function renderAddressForm(address = null) {
    const isEdit = state.accountAddressFormMode === 'edit';
    const value = (key, fallback = '') => escapeHtml(String(address?.[key] || fallback));
    return `
      <form class="account-form account-form--address" id="accountAddressForm">
        <div class="account-form__grid">
          <label class="account-field">
            <span>Label</span>
            <input name="label" type="text" value="${value('label', isEdit ? 'Home' : '')}" placeholder="Home" />
          </label>
          <label class="account-field">
            <span>Recipient</span>
            <input name="recipientName" type="text" value="${value('recipientName')}" autocomplete="name" required />
          </label>
          <label class="account-field">
            <span>Mobile Number</span>
            <input name="phone" type="tel" value="${value('phone')}" autocomplete="tel" required />
          </label>
          <label class="account-field account-field--wide">
            <span>Address Line 1</span>
            <input name="line1" type="text" value="${value('line1')}" autocomplete="address-line1" required />
          </label>
          <label class="account-field account-field--wide">
            <span>Address Line 2</span>
            <input name="line2" type="text" value="${value('line2')}" autocomplete="address-line2" />
          </label>
          <label class="account-field">
            <span>City</span>
            <input name="city" type="text" value="${value('city')}" autocomplete="address-level2" />
          </label>
          <label class="account-field">
            <span>State</span>
            <input name="state" type="text" value="${value('state')}" autocomplete="address-level1" />
          </label>
          <label class="account-field">
            <span>Postal Code</span>
            <input name="postalCode" type="text" value="${value('postalCode')}" autocomplete="postal-code" />
          </label>
          <label class="account-field">
            <span>Country</span>
            <input name="country" type="text" value="${value('country', 'India')}" autocomplete="country-name" />
          </label>
        </div>
        <label class="account-check">
          <input name="isDefault" type="checkbox" ${address?.isDefault ? 'checked' : ''} />
          <span>Set as default address</span>
        </label>
        <div class="account-form__actions">
          <button class="btn btn-primary account-action-btn" type="submit">${isEdit ? 'Save' : 'Add Address'}</button>
          <button class="btn btn-outline account-action-btn" type="button" data-account-action="cancel-address">Cancel</button>
        </div>
      </form>
    `;
  }

  function bindAccountDrawerActions() {
    document.getElementById('accountProfileForm')?.addEventListener('submit', handleProfileSubmit);
    document.getElementById('accountAddressForm')?.addEventListener('submit', handleAddressSubmit);

    els.accountDrawerContent?.querySelectorAll('[data-account-action]').forEach((button) => {
      button.addEventListener('click', () => handleAccountAction(button));
    });
  }

  function getOrderById(orderId) {
    return (Array.isArray(state.merchOrders) ? state.merchOrders : []).find((order) => String(order.id || '') === String(orderId || ''));
  }

  async function handleAccountAction(button) {
    const action = button.dataset.accountAction;

    if (action === 'edit-profile') {
      state.accountProfileEditing = true;
      state.accountProfileMessage = '';
      renderAccountDrawer();
      return;
    }

    if (action === 'cancel-profile') {
      state.accountProfileEditing = false;
      renderAccountDrawer();
      return;
    }

    if (action === 'add-address') {
      state.accountAddressFormMode = 'add';
      state.accountEditingAddressId = null;
      state.accountAddressMessage = '';
      renderAccountDrawer();
      return;
    }

    if (action === 'edit-address') {
      state.accountAddressFormMode = 'edit';
      state.accountEditingAddressId = button.dataset.addressId;
      state.accountAddressMessage = '';
      renderAccountDrawer();
      return;
    }

    if (action === 'cancel-address') {
      state.accountAddressFormMode = null;
      state.accountEditingAddressId = null;
      state.accountAddressMessage = '';
      renderAccountDrawer();
      return;
    }

    if (action === 'delete-address') {
      await deleteAddress(button.dataset.addressId);
      return;
    }

    if (action === 'default-address') {
      await setDefaultAddress(button.dataset.addressId);
      return;
    }

    if (action === 'view-all-orders') {
      state.accountOrdersExpanded = !state.accountOrdersExpanded;
      renderAccountDrawer();
      return;
    }

    if (action === 'view-order') {
      const order = getOrderById(button.dataset.orderId);
      console.log('View order:', JSON.stringify(order, null, 2));
      showCheckoutNotice(
        order ? (order.orderNumber || `Order #${order.id}`) : 'Order details',
        order
        ? `
           <div class="order-details">
             <div class="order-detail-row">
               <span>Order Date</span>
               <strong>${formatDateLabel(order.createdAt)}</strong>
             </div>
             <div class="order-detail-row">
               <span>Order Status</span>
               <strong>${formatOrderStatus(order.status)}</strong>
             </div>
             <div class="order-detail-row">
               <span>Payment Status</span>
               <strong>${order.paymentStatus || 'Pending'}</strong>
             </div>
             <div class="order-detail-row">
               <span>Payment Method</span>
               <strong>${order.paymentMethod || 'Online'}</strong>
             </div>
             <div class="order-detail-row">
               <span>Total</span>
               <strong>${order.totalAmount ? formatPrice(order.totalAmount) : 'Unavailable'}</strong>
             </div>
           </div>
         `
        : 'Order details are unavailable.',
       { html: true }
      );
      return;
    }

    if (action === 'track-order') {
      if (button.dataset.orderId) {
        window.location.hash = `track-order/${encodeURIComponent(button.dataset.orderId)}`;
      }
      return;
    }

    if (action === 'invoice-order') {
      await openMerchInvoice(button.dataset.orderId);
      return;
    }

    if (action === 'download-invoice') {
      await downloadMerchInvoice(button.dataset.orderId);
      return;
    }

    if (action === 'email-invoice') {
      await emailMerchInvoice(button.dataset.orderId);
      return;
    }

    if (action === 'view-wishlist') {
      closeAccountDrawer();
      document.getElementById('shopSection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    if (action === 'wishlist-remove') {
      state.merchWishlistItems = state.merchWishlistItems.filter((item) => String(item.id || '') !== String(button.dataset.wishlistId || ''));
      renderAccountDrawer();
      return;
    }

    if (action === 'wishlist-move') {
      showCheckoutNotice('Wishlist', 'Move to Cart is ready for the wishlist service connection.');
    }
  }

  async function fetchMerchInvoiceLink(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Order details are unavailable.');
    }
    return api(`/api/merch/orders/${encodeURIComponent(id)}/invoice-link`);
  }

  function openMerchDocument(url) {
    const targetUrl = buildApiUrl(url);
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      showCheckoutNotice('Invoice', 'The invoice could not open. Please allow popups and try again.', { variant: 'error' });
    }
  }

  function getInvoiceFilename(headerValue, orderId) {
    const header = String(headerValue || '');
    const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
    if (utfMatch) {
      try {
        return decodeURIComponent(utfMatch[1]);
      } catch {}
    }
    const match = header.match(/filename="?([^";]+)"?/i);
    if (match?.[1]) return match[1];
    return `Invoice-Merch-${String(orderId || 'Order').replace(/[^a-z0-9_-]+/gi, '-')}.pdf`;
  }

  async function openMerchInvoice(orderId) {
    try {
      const data = await fetchMerchInvoiceLink(orderId);
      if (!data.invoiceUrl) throw new Error('Invoice link missing.');
      openMerchDocument(data.invoiceUrl);
    } catch (error) {
      showCheckoutNotice('Invoice unavailable', error.message || 'Unable to open the invoice. Please try again.', { variant: 'error' });
    }
  }

  async function downloadMerchInvoice(orderId) {
    try {
      const data = await fetchMerchInvoiceLink(orderId);
      const downloadUrl = data.invoiceDownloadUrl || data.invoiceUrl;
      if (!downloadUrl) throw new Error('Invoice download link missing.');
      const response = await fetch(buildApiUrl(downloadUrl), { credentials: 'include' });
      if (!response.ok || !(response.headers.get('content-type') || '').includes('application/pdf')) {
        throw new Error('Unable to generate the invoice PDF.');
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = getInvoiceFilename(response.headers.get('content-disposition'), orderId);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      showCheckoutNotice('Download unavailable', error.message || 'Unable to download the invoice. Please try again.', { variant: 'error' });
    }
  }

  async function emailMerchInvoice(orderId) {
    try {
      const id = Number(orderId);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Order details are unavailable.');
      const result = await api(`/api/merch/orders/${encodeURIComponent(id)}/invoice-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const recipient = String(result.recipientEmail || state.merchProfile?.email || '').trim();
      showCheckoutNotice(
        'Invoice email sent',
        recipient ? `We sent the invoice to ${recipient}.` : 'We sent the invoice email successfully.'
      );
    } catch (error) {
      showCheckoutNotice('Email unavailable', error.message || 'Unable to email the invoice. Please try again.', { variant: 'error' });
    }
  }

  async function handleProfileSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      fullName: String(formData.get('fullName') || '').trim(),
      mobile: String(formData.get('mobile') || '').trim(),
    };

    try {
      const result = await api('/api/merch/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.merchProfile = result.profile || { ...(state.merchProfile || {}), ...payload };
    } catch {
      state.merchProfile = { ...(state.merchProfile || {}), ...payload };
    }

    if (state.currentUser) {
      state.currentUser = { ...state.currentUser, name: payload.fullName, mobile: payload.mobile };
    }
    state.accountProfileEditing = false;
    state.accountProfileMessage = 'Profile saved.';
    renderAccountTrigger();
    renderAccountDrawer();
  }

  function getAddressPayload(form) {
    const formData = new FormData(form);
    return {
      label: String(formData.get('label') || '').trim(),
      recipientName: String(formData.get('recipientName') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      line1: String(formData.get('line1') || '').trim(),
      line2: String(formData.get('line2') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      state: String(formData.get('state') || '').trim(),
      postalCode: String(formData.get('postalCode') || '').trim(),
      country: String(formData.get('country') || 'India').trim() || 'India',
      isDefault: formData.get('isDefault') === 'on',
    };
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();
    const payload = getAddressPayload(event.currentTarget);
    const isEdit = state.accountAddressFormMode === 'edit';
    const addressId = state.accountEditingAddressId;

    try {
      const result = await api(isEdit ? `/api/merch/addresses/${encodeURIComponent(addressId)}` : '/api/merch/addresses', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.merchAddresses = Array.isArray(result.addresses) ? result.addresses : state.merchAddresses;
    } catch (error) {
      const detail = String(error?.message || '').trim();
      state.accountAddressMessage = detail
        ? `Address was not saved. ${detail}`
        : 'Address was not saved. Please try again.';
      renderAccountDrawer();
      return;
    }

    state.accountAddressMessage = '';
    state.accountAddressFormMode = null;
    state.accountEditingAddressId = null;
    renderAccountDrawer();
  }

  async function deleteAddress(addressId) {
    if (!addressId) return;
    const shouldDelete = await showCheckoutConfirm('Delete address', 'Delete this saved address?');
    if (!shouldDelete) return;
    try {
      const result = await api(`/api/merch/addresses/${encodeURIComponent(addressId)}`, { method: 'DELETE' });
      state.merchAddresses = Array.isArray(result.addresses) ? result.addresses : state.merchAddresses;
    } catch {
      state.merchAddresses = state.merchAddresses.filter((address) => getAddressId(address) !== String(addressId));
    }
    renderAccountDrawer();
  }

  async function setDefaultAddress(addressId) {
    if (!addressId) return;
    try {
      const result = await api(`/api/merch/addresses/${encodeURIComponent(addressId)}/default`, { method: 'PATCH' });
      state.merchAddresses = Array.isArray(result.addresses) ? result.addresses : state.merchAddresses;
    } catch {
      state.merchAddresses = state.merchAddresses.map((address) => ({
        ...address,
        isDefault: getAddressId(address) === String(addressId),
      }));
    }
    renderAccountDrawer();
  }

  function openAccountDrawer() {
    if (!els.accountDrawer) return;

    state.accountDrawerOpen = true;
    state.accountDrawerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    renderAccountDrawer();
    els.accountDrawer.hidden = false;
    els.accountDrawerOverlay.hidden = false;
    requestAnimationFrame(() => {
      els.accountDrawer.classList.add('is-open');
      els.accountDrawerOverlay.classList.add('is-visible');
    });
    document.body.classList.add('is-account-drawer-open');
    els.accountDrawerCloseBtn?.focus();
    els.merchAuthCta?.querySelector('#merchAccountBtn')?.setAttribute('aria-expanded', 'true');
  }

  function closeAccountDrawer() {
    if (!els.accountDrawer) return;

    state.accountDrawerOpen = false;
    els.accountDrawer.classList.remove('is-open');
    els.accountDrawerOverlay.classList.remove('is-visible');
    els.merchAuthCta?.querySelector('#merchAccountBtn')?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-account-drawer-open');
    setTimeout(() => {
      els.accountDrawer.hidden = true;
      els.accountDrawerOverlay.hidden = true;
      state.accountDrawerTrigger?.focus?.();
    }, 300);
  }

  async function handleLogout() {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear the merch UI even if the server could not be reached.
    }

    state.currentUser = null;
    state.merchProfile = null;
    state.merchOrders = [];
    state.merchAddresses = [];
    state.merchWishlistItems = [];
    state.merchCartItems = [];
    state.accountDrawerTrigger = null;
    closeAccountDrawer();
    renderAccountTrigger();
    requestAnimationFrame(() => {
      document.querySelector('#merchAuthCta a')?.focus();
    });
  }

  // ─── Render: Product Grid ───
  function getFilteredProducts() {
    let products = [...state.products];

    // Category filter
    if (state.selectedCategory !== 'all') {
      products = products.filter(p => p.category === state.selectedCategory);
    }

    // Search filter
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    // Sort
    switch (state.sortBy) {
      case 'price-asc':
        products.sort((a, b) => a.basePrice - b.basePrice);
        break;
      case 'price-desc':
        products.sort((a, b) => b.basePrice - a.basePrice);
        break;
      case 'newest':
      default:
        products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        break;
    }

    return products;
  }

  function renderProductGrid() {
    const products = getFilteredProducts();

    if (products.length === 0) {
      els.productGrid.innerHTML = '';
      els.productEmpty.hidden = false;
      return;
    }

    els.productEmpty.hidden = true;

    els.productGrid.innerHTML = products.map(product => {
      const defaultVariant = getDefaultPurchasableVariant(product);
      const isSoldOut = !defaultVariant || Number(defaultVariant.stock || 0) <= 0;
      return `
      <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.name)}">
        <div class="product-card__image">
          <img src="${escapeHtml(product.images?.[0] || product.imageUrl || FALLBACK_PRODUCT_IMAGE)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='${FALLBACK_PRODUCT_IMAGE}'" />
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(getCategoryLabel(product.category))}</p>
          <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
          <p class="product-card__price">
            ${product.variants.length > 1 ? '<span class="price-from">From </span>' : ''}${getPriceRange(product)}
          </p>
          <div class="product-card__actions">
            <button class="btn btn-secondary product-card__action" type="button" data-product-action="add-to-cart" data-product-id="${product.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'Out of Stock' : 'Add to Cart'}
            </button>
            <button class="btn btn-outline product-card__action" type="button" data-product-action="buy-now" data-product-id="${product.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'Unavailable' : 'Buy Now'}
            </button>
          </div>
        </div>
      </article>
    `;
    }).join('');

    // Bind click events
    els.productGrid.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.productId);
        showProductDetail(id);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = Number(card.dataset.productId);
          showProductDetail(id);
        }
      });
    });

    els.productGrid.querySelectorAll('[data-product-action]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const product = state.products.find((item) => Number(item.id) === Number(button.dataset.productId));
        if (!product) return;
        await handleProductCardAction(button.dataset.productAction, product);
      });
    });
  }

  function getCategoryLabel(category) {
    const labels = {
      hoodies: 'Hoodies',
      bottles: 'Hydrogen Water Bottles',
      sprays: 'Hydrogen Mists',
    };
    return labels[category] || category;
  }

  // ─── Render: Product Detail ───
  function showProductDetail(productId) {
    const product = state.products.find(p => Number(p.id) === Number(productId));
    if (!product) return;

    state.currentView = 'detail';
    state.selectedProduct = product;
    state.selectedVariant = getDefaultPurchasableVariant(product);
    state.quantity = 1;

    // Hide shop, show detail
    els.shopSection.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    if (els.orderTracking) els.orderTracking.hidden = true;
    els.productDetail.hidden = false;

    renderProductGallery(product);
    renderProductInfo(product);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showShop() {
    state.currentView = 'shop';
    state.selectedProduct = null;
    state.selectedVariant = null;

    els.productDetail.hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    if (els.orderTracking) els.orderTracking.hidden = true;
    els.shopSection.hidden = false;
    document.querySelector('.merch-hero').hidden = false;
    document.querySelector('.merch-categories').hidden = false;
    if (window.location.hash === '#booking-confirmation' || getTrackingOrderIdFromHash()) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function renderProductGallery(product) {
    const mainImage = product.images?.[0] || product.imageUrl || FALLBACK_PRODUCT_IMAGE;
    els.productGallery.innerHTML = `
      <div class="gallery-main">
        <img id="galleryMainImg" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" onerror="this.src='${FALLBACK_PRODUCT_IMAGE}'" />
      </div>
      ${(product.images || []).length > 1 ? `
        <div class="gallery-thumbs">
          ${(product.images || []).map((img, i) => `
            <button class="gallery-thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}" type="button" aria-label="View image ${i + 1}${getGalleryVariantPrice(product, i) ? `, ${formatPrice(getGalleryVariantPrice(product, i))}` : ''}">
              <img src="${img}" alt="Image ${i + 1}" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    // Thumb click handlers
    els.productGallery.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const idx = Number(thumb.dataset.index);
        document.getElementById('galleryMainImg').src = product.images?.[idx] || product.imageUrl || FALLBACK_PRODUCT_IMAGE;
        els.productGallery.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');

        const galleryVariant = getGalleryVariantFromThumb(product, idx);
        if (galleryVariant) {
          state.selectedVariant = galleryVariant;
          state.quantity = 1;
          renderProductInfo(product);
        }
      });
    });
  }

  function renderProductInfo(product) {
    const variant = state.selectedVariant;

    // Get unique sizes and colors
    const sizes = [...new Set(product.variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];

    els.productInfo.innerHTML = `
      <p class="detail-kicker">${escapeHtml(getCategoryLabel(product.category))}</p>
      <h1 class="detail-title">${escapeHtml(product.name)}</h1>
      <p class="detail-price">${formatPrice(variant.price)}</p>
      <p class="detail-description">${escapeHtml(product.description)}</p>

      ${sizes.length > 0 ? `
        <div class="variant-group">
          <span class="variant-label">Size</span>
          <div class="variant-options">
            ${sizes.map(size => {
              const v = product.variants.find(x => x.size === size && x.color === (variant.color || colors[0]));
              const isSelected = variant.size === size;
              const isDisabled = v && v.stock <= 0;
              return `<button class="variant-option ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}" 
                data-size="${escapeHtml(size)}" type="button" ${isDisabled ? 'disabled' : ''}>${escapeHtml(size)}</button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${colors.length > 0 ? `
        <div class="variant-group">
          <span class="variant-label">Color</span>
          <div class="variant-options">
            ${colors.map(color => {
              const v = product.variants.find(x => x.color === color && x.size === (variant.size || sizes[0]));
              const isSelected = variant.color === color;
              const isDisabled = v && v.stock <= 0;
              return `<button class="variant-option ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''}"
                data-color="${escapeHtml(color)}" type="button" ${isDisabled ? 'disabled' : ''}>${escapeHtml(color)}</button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <div class="quantity-control">
        <label>Quantity</label>
        <button class="qty-btn" id="qtyDec" type="button">−</button>
        <span class="qty-value" id="qtyValue">${state.quantity}</span>
        <button class="qty-btn" id="qtyInc" type="button">+</button>
      </div>

      <div class="detail-actions">
        <button id="addToCartBtn" class="btn btn-primary btn-lg" type="button" ${variant.stock <= 0 ? 'disabled' : ''}>
          ${variant.stock <= 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
        <button id="buyNowBtn" class="btn btn-secondary btn-lg" type="button" ${variant.stock <= 0 ? 'disabled' : ''}>
          ${variant.stock <= 0 ? 'Unavailable' : 'Buy Now'}
        </button>
        <button id="addToWishlistBtn" class="btn btn-outline btn-lg" type="button">♡ Wishlist</button>
      </div>

      <p class="stock-status ${variant.stock > 0 ? 'in-stock' : 'out-of-stock'}">
        ${variant.stock > 0 ? `✓ In stock (${variant.stock} available)` : '✕ Out of stock'}
      </p>
    `;

    // Bind variant selectors
    els.productInfo.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        const color = state.selectedVariant.color;
        const match = product.variants.find(v => v.size === size && v.color === color)
          || product.variants.find(v => v.size === size);
        if (match) {
          state.selectedVariant = match;
          state.quantity = 1;
          renderProductInfo(product);
        }
      });
    });

    els.productInfo.querySelectorAll('[data-color]').forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        const size = state.selectedVariant.size;
        const match = product.variants.find(v => v.color === color && v.size === size)
          || product.variants.find(v => v.color === color);
        if (match) {
          state.selectedVariant = match;
          state.quantity = 1;
          renderProductInfo(product);
        }
      });
    });

    // Quantity controls
    document.getElementById('qtyDec')?.addEventListener('click', () => {
      if (state.quantity > 1) {
        state.quantity--;
        document.getElementById('qtyValue').textContent = state.quantity;
      }
    });

    document.getElementById('qtyInc')?.addEventListener('click', () => {
      if (state.quantity < state.selectedVariant.stock) {
        state.quantity++;
        document.getElementById('qtyValue').textContent = state.quantity;
      }
    });

    // Add to cart
    document.getElementById('addToCartBtn')?.addEventListener('click', () => {
      if (state.selectedVariant && state.selectedVariant.stock > 0) {
        addToCart(state.selectedVariant.id, state.quantity, product);
      }
    });

    document.getElementById('buyNowBtn')?.addEventListener('click', () => {
      if (state.selectedVariant && state.selectedVariant.stock > 0) {
        buyNow(state.selectedVariant.id, state.quantity, product);
      }
    });
  }

  // ─── Search ───
  function openSearch() {
    els.searchOverlay.hidden = false;
    els.searchInput.focus();
  }

  function closeSearch() {
    els.searchOverlay.hidden = true;
    els.searchInput.value = '';
    els.searchResults.innerHTML = '';
  }

  function renderSearchResults(query) {
    if (!query.trim()) {
      els.searchResults.innerHTML = '';
      return;
    }

    const q = query.toLowerCase();
    const results = state.products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );

    if (results.length === 0) {
      els.searchResults.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 24px;">No products found</p>';
      return;
    }

    els.searchResults.innerHTML = results.map(p => `
      <div class="search-result-item" data-product-id="${p.id}" style="
        display: flex; gap: 12px; padding: 12px; cursor: pointer; border-bottom: 1px solid var(--border);
        border-radius: 8px; transition: background 0.2s;
      " onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
        <img src="${escapeHtml(p.images?.[0] || p.imageUrl || FALLBACK_PRODUCT_IMAGE)}" alt="" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onerror="this.src='${FALLBACK_PRODUCT_IMAGE}'" />
        <div>
          <p style="font-weight: 600; font-size: 14px; margin: 0 0 2px;">${escapeHtml(p.name)}</p>
          <p style="font-size: 13px; color: var(--text-muted); margin: 0;">${getPriceRange(p)}</p>
        </div>
      </div>
    `).join('');

    els.searchResults.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        closeSearch();
        showProductDetail(Number(item.dataset.productId));
      });
    });
  }

  function ensureMerchModal() {
    let modal = document.getElementById('merchFlowModal');
    if (modal) return modal;

    modal = document.createElement('div');
    modal.id = 'merchFlowModal';
    modal.className = 'merch-flow-modal';
    modal.hidden = true;
    modal.innerHTML = '<div class="merch-flow-modal__panel" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeMerchModal();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && state.checkoutModalOpen) {
        closeMerchModal();
      }
    });

    return modal;
  }

  function showMerchModal({ eyebrow = 'House Merch', title, body, footer = '' }) {
    const modal = ensureMerchModal();
    const panel = modal.querySelector('.merch-flow-modal__panel');
    panel.innerHTML = `
      <div class="merch-flow-modal__header">
        <div>
          <p class="merch-flow-modal__eyebrow">${escapeHtml(eyebrow)}</p>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <button class="drawer-close-btn" type="button" data-modal-close aria-label="Close">&#10005;</button>
      </div>
      <div class="merch-flow-modal__body">${body}</div>
      ${footer ? `<div class="merch-flow-modal__footer">${footer}</div>` : ''}
    `;
    panel.querySelectorAll('[data-modal-close]').forEach((button) => {
      button.addEventListener('click', closeMerchModal);
    });
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    document.body.classList.add('is-checkout-modal-open');
    state.checkoutModalOpen = true;
    return modal;
  }

  function closeMerchModal() {
    const modal = document.getElementById('merchFlowModal');
    if (!modal) return;
    modal.classList.remove('is-open');
    document.body.classList.remove('is-checkout-modal-open');
    state.checkoutModalOpen = false;
    setTimeout(() => {
      modal.hidden = true;
    }, 180);
  }

  function showCheckoutNotice(title, message, options = {}) {
    const variantClass = options.variant ? ` merch-flow-notice--${options.variant}` : '';
    const content = options.html
      ? message
      : `<p>${escapeHtml(message)}</p>`;
    const modal = showMerchModal({
      title,
      body: `
        <div class="merch-flow-notice${variantClass}">
          ${content}
        </div>
      `,
      footer: '<button class="btn btn-primary account-action-btn" type="button" data-modal-ok>OK</button>',
    });
    modal.querySelector('[data-modal-ok]')?.addEventListener('click', () => {
      closeMerchModal();
      options.onClose?.();
    });
  }
  function showCheckoutConfirm(title, message) {
    return new Promise((resolve) => {
      const modal = showMerchModal({
        title,
        body: `<div class="merch-flow-notice"><p>${escapeHtml(message)}</p></div>`,
        footer: `
          <button class="btn btn-primary account-action-btn" type="button" data-confirm-yes>Delete</button>
          <button class="btn btn-outline account-action-btn" type="button" data-confirm-no>Cancel</button>
        `,
      });
      const finish = (value) => {
        closeMerchModal();
        resolve(value);
      };
      modal.querySelector('[data-confirm-yes]')?.addEventListener('click', () => finish(true));
      modal.querySelector('[data-confirm-no]')?.addEventListener('click', () => finish(false));
    });
  }

  function renderCheckoutAddressCards() {
    const addresses = Array.isArray(state.merchAddresses) ? state.merchAddresses : [];
    const selectedId = state.checkoutSelectedAddressId || getAddressId(getDefaultAddress());
    return addresses.map((address) => {
      const addressId = getAddressId(address);
      const isSelected = addressId === selectedId;
      return `
        <label class="checkout-address-card${isSelected ? ' is-selected' : ''}">
          <input type="radio" name="checkoutAddress" value="${escapeHtml(addressId)}" ${isSelected ? 'checked' : ''} />
          <span>
            <strong>${escapeHtml(getAddressLabel(address))}</strong>
            <small>${escapeHtml(getAddressSummary(address))}</small>
            <small>${escapeHtml([address.recipientName, address.phone].filter(Boolean).join(' · '))}</small>
          </span>
          ${address.isDefault ? '<em>Default</em>' : ''}
        </label>
      `;
    }).join('');
  }

  function openAuthenticatedCheckoutAddressModal() {
    const addresses = Array.isArray(state.merchAddresses) ? state.merchAddresses : [];
    const defaultAddress = getDefaultAddress();
    state.checkoutSelectedAddressId = state.checkoutSelectedAddressId || getAddressId(defaultAddress);

    if (!addresses.length) {
      openCheckoutAddAddressModal();
      return;
    }

    const customer = getAuthenticatedCheckoutCustomer();
    const modal = showMerchModal({
      title: 'Choose shipping address',
      body: `
        <div class="checkout-profile-summary">
          <p>Checking out as</p>
          <strong>${escapeHtml(customer.name)}</strong>
          <span>${escapeHtml(customer.email)}${customer.phone ? ` · ${escapeHtml(customer.phone)}` : ''}</span>
        </div>
        <form id="checkoutAddressSelectForm" class="checkout-address-list">
          ${renderCheckoutAddressCards()}
        </form>
      `,
      footer: `
        <button class="btn btn-outline account-action-btn" type="button" data-checkout-add-address>Add Address</button>
        <button class="btn btn-primary account-action-btn" type="button" data-checkout-continue>Continue</button>
      `,
    });

    modal.querySelectorAll('input[name="checkoutAddress"]').forEach((input) => {
      input.addEventListener('change', () => {
        state.checkoutSelectedAddressId = input.value;
        modal.querySelectorAll('.checkout-address-card').forEach((card) => card.classList.remove('is-selected'));
        input.closest('.checkout-address-card')?.classList.add('is-selected');
      });
    });
    modal.querySelector('[data-checkout-add-address]')?.addEventListener('click', openCheckoutAddAddressModal);
    modal.querySelector('[data-checkout-continue]')?.addEventListener('click', () => {
      const selected = state.merchAddresses.find((address) => getAddressId(address) === String(state.checkoutSelectedAddressId));
      if (!selected) {
        showCheckoutNotice('Address needed', 'Choose or add a shipping address before checkout.');
        return;
      }
      closeMerchModal();
      startRazorpayCheckout(customer, serializeAddress(selected));
    });
  }

  function renderCheckoutAddressForm(options = {}) {
    const profile = options.profile || getMerchantProfile();
    const helpText = options.helpText || 'Fill in your name, address, phone, and pincode to continue checkout.';

    return `
      <form id="checkoutAddAddressForm" class="account-form account-form--address checkout-address-form">
        <div class="merch-flow-notice">
          <p>${escapeHtml(helpText)}</p>
        </div>
        <div class="account-form__grid">
          <label class="account-field">
            <span>Label</span>
            <input name="label" type="text" placeholder="Home" />
          </label>
          <label class="account-field">
            <span>Full Name</span>
            <input name="recipientName" type="text" value="${escapeHtml(profile.fullName)}" autocomplete="name" placeholder="Enter full name" required />
          </label>
          <label class="account-field">
            <span>Phone Number</span>
            <input name="phone" type="tel" value="${escapeHtml(profile.mobile)}" autocomplete="tel" placeholder="Enter phone number" required />
          </label>
          <label class="account-field account-field--wide">
            <span>Address</span>
            <input name="line1" type="text" autocomplete="address-line1" placeholder="House number, street, area" required />
          </label>
          <label class="account-field account-field--wide">
            <span>Address Line 2</span>
            <input name="line2" type="text" autocomplete="address-line2" />
          </label>
          <label class="account-field">
            <span>City</span>
            <input name="city" type="text" autocomplete="address-level2" />
          </label>
          <label class="account-field">
            <span>State</span>
            <input name="state" type="text" autocomplete="address-level1" />
          </label>
          <label class="account-field">
            <span>Pincode</span>
            <input name="postalCode" type="text" autocomplete="postal-code" placeholder="Enter pincode" required />
          </label>
          <label class="account-field">
            <span>Country</span>
            <input name="country" type="text" value="India" autocomplete="country-name" />
          </label>
        </div>
        <label class="account-check">
          <input name="isDefault" type="checkbox" checked />
          <span>Set as default address</span>
        </label>
      </form>
    `;
  }

  function openCheckoutAddAddressModal(options = {}) {
    const modal = showMerchModal({
      title: options.title || 'Add shipping address',
      body: renderCheckoutAddressForm({
        profile: options.profile || getAuthenticatedCheckoutCustomer(),
        helpText: options.helpText,
      }),
      footer: `
        <button class="btn btn-outline account-action-btn" type="button" data-checkout-back>Back</button>
        <button class="btn btn-primary account-action-btn" type="submit" form="checkoutAddAddressForm">Save & Continue</button>
      `,
    });

    modal.querySelector('[data-checkout-back]')?.addEventListener('click', () => {
      if (state.merchAddresses.length) openAuthenticatedCheckoutAddressModal();
      else closeMerchModal();
    });
    modal.querySelector('#checkoutAddAddressForm')?.addEventListener('submit', handleCheckoutAddressSubmit);
  }

  async function handleCheckoutAddressSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = document.querySelector('[form="checkoutAddAddressForm"]');
    const payload = getAddressPayload(form);
    submitButton?.setAttribute('disabled', 'disabled');

    try {
      const result = await api('/api/merch/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.merchAddresses = Array.isArray(result.addresses) ? result.addresses : state.merchAddresses;
      syncCheckoutProfileDetails(payload);
    } catch (error) {
      showCheckoutNotice('Address not saved', error.message || 'Please check the address details and try again.', { variant: 'error' });
      return;
    } finally {
      submitButton?.removeAttribute('disabled');
    }

    const selected = getDefaultAddress();
    if (!selected) {
      showCheckoutNotice('Address needed', 'Add a shipping address before checkout.', { variant: 'error' });
      return;
    }

    closeMerchModal();
    startRazorpayCheckout(getAuthenticatedCheckoutCustomer(), serializeAddress(selected));
  }

  function openGuestCheckoutModal() {
    const modal = showMerchModal({
      title: 'Guest checkout',
      body: `
        <form id="guestCheckoutForm" class="account-form guest-checkout-form">
          <label class="account-field">
            <span>Full Name</span>
            <input name="name" type="text" autocomplete="name" required />
          </label>
          <label class="account-field">
            <span>Email</span>
            <input name="email" type="email" autocomplete="email" required />
          </label>
          <label class="account-field">
            <span>Mobile Number</span>
            <input name="phone" type="tel" autocomplete="tel" required />
          </label>
          <label class="account-field">
            <span>Shipping Address</span>
            <textarea name="address" rows="4" autocomplete="street-address" required></textarea>
          </label>
        </form>
      `,
      footer: `
        <button class="btn btn-outline account-action-btn" type="button" data-modal-close>Cancel</button>
        <button class="btn btn-primary account-action-btn" type="submit" form="guestCheckoutForm">Continue</button>
      `,
    });
    modal.querySelector('[data-modal-close]')?.addEventListener('click', closeMerchModal);
    modal.querySelector('#guestCheckoutForm')?.addEventListener('submit', handleGuestCheckoutSubmit);
  }

  function handleGuestCheckoutSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const customer = {
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
    };
    const address = { full: String(formData.get('address') || '').trim() };

    if (!customer.name || !customer.email || !customer.phone || !address.full) {
      showCheckoutNotice('Missing details', 'Please complete all guest checkout fields.', { variant: 'error' });
      return;
    }

    closeMerchModal();
    startRazorpayCheckout(customer, address);
  }

  // ─── Event Bindings ───
  function bindEvents() {
    // Hero shop button
    els.heroShopBtn.addEventListener('click', () => {
      document.getElementById('shopSection').scrollIntoView({ behavior: 'smooth' });
    });

    // Category cards
    document.querySelectorAll('[data-category]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const category = btn.dataset.category;
        state.selectedCategory = category;
        els.categoryFilter.value = category;
        renderProductGrid();
        document.getElementById('shopSection').scrollIntoView({ behavior: 'smooth' });
      });
    });

    // Filter & Sort
    els.categoryFilter.addEventListener('change', () => {
      state.selectedCategory = els.categoryFilter.value;
      renderProductGrid();
    });

    els.sortSelect.addEventListener('change', () => {
      state.sortBy = els.sortSelect.value;
      renderProductGrid();
    });

    // Back to shop
    els.backToShopBtn.addEventListener('click', showShop);

    // Search
    els.searchToggleBtn.addEventListener('click', openSearch);
    els.searchCloseBtn.addEventListener('click', closeSearch);
    els.searchInput.addEventListener('input', (e) => {
      renderSearchResults(e.target.value);
    });
    els.searchOverlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeSearch();
    });

    // Cart
    els.cartToggleBtn.addEventListener('click', openCart);
    els.cartCloseBtn.addEventListener('click', closeCart);
    els.cartOverlay.addEventListener('click', closeCart);
    els.cartShopBtn.addEventListener('click', () => {
      closeCart();
      showShop();
    });

    // Checkout button — Razorpay integration
    els.checkoutBtn.addEventListener('click', () => {
      if (state.cart.length === 0) return;
      initiateCheckout();
    });

    els.cartCouponApplyBtn?.addEventListener('click', () => {
      applyMerchCouponFromCart();
    });

    els.cartCouponCode?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyMerchCouponFromCart();
      }
    });

    els.accountDrawerCloseBtn?.addEventListener('click', closeAccountDrawer);
    els.accountDrawerOverlay?.addEventListener('click', closeAccountDrawer);
    els.accountDrawer?.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeAccountDrawer();
      }
    });

    window.addEventListener('hashchange', () => {
      if (!routeFromLocation()) {
        showShop();
      }
    });
  }

  // ─── Razorpay Checkout Flow ───
  async function initiateCheckout() {
    if (!state.authResolved) {
      await loadCustomerContext();
    }

    if (state.currentUser) {
      const customer = getAuthenticatedCheckoutCustomer();
      if (!customer.name || !customer.email || !customer.phone) {
        openCheckoutAddAddressModal({
          title: 'Complete your details',
          helpText: 'Add your name, phone, address, and pincode to continue checkout.',
        });
        return;
      }

      openAuthenticatedCheckoutAddressModal();
      return;
    }

    openGuestCheckoutModal();
  }

  async function startRazorpayCheckout(customer, address) {
    const items = state.cart.map(item => ({ variantId: item.variantId, quantity: item.quantity }));
    const couponCode = normalizeCouponCode(state.merchCouponCode || els.cartCouponCode?.value || '');

    try {
      const res = await fetch(buildApiUrl('/api/merch/checkout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer, address, couponCode }),
      });

      if (!res.ok) {
        let err = {};
        try {
          err = await res.json();
        } catch {
          err = {};
        }
        showCheckoutNotice('Checkout failed', err.error || err.message || 'Please try again.', { variant: 'error' });
        return;
      }

      const data = await res.json();
      const confirmationCartItems = state.cart.map((item) => ({ ...item }));

      // Load Razorpay script if not loaded
      if (!window.Razorpay) {
        await loadScript('https://checkout.razorpay.com/v1/checkout.js');
      }

      // Open Razorpay checkout
      const options = {
        key: data.razorpayKeyId,
        amount: data.amount,
        currency: data.currency,
        name: 'H2 House of Health',
        description: `Order ${data.orderNumber}`,
        order_id: data.razorpayOrderId,
        prefill: { name: customer.name, email: customer.email, contact: customer.phone },
        theme: { color: '#c8652d' },
        handler: async function (response) {
          // Verify payment
          const verifyRes = await fetch(buildApiUrl('/api/merch/verify-payment'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_number: data.orderNumber,
            }),
          });
          if (verifyRes.ok) {
            const verifyData = await verifyRes.json().catch(() => ({}));
            const confirmation = buildConfirmationData({
              order: data,
              verifyResult: { ...verifyData, orderNumber: data.orderNumber },
              customer,
              address,
              cartItems: confirmationCartItems,
            });
            saveConfirmation(confirmation);
            state.cart = [];
            state.merchCouponCode = '';
            state.merchCouponPreview = null;
            state.merchCouponError = '';
            saveCart();
            renderCart();
            closeCart();
            await loadCustomerContext();
            window.location.hash = 'booking-confirmation';
            showBookingConfirmation(confirmation);
          } else {
            showCheckoutNotice('Payment verification failed', 'Please contact support with your payment details.', { variant: 'error' });
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      showCheckoutNotice('Checkout unavailable', 'Something went wrong. Please try again.', { variant: 'error' });
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function loadCustomerContext() {
    try {
      const authResult = await api('/api/auth/me');
      state.currentUser = authResult.user || null;
      if (state.currentUser && String(state.currentUser.role || '').toLowerCase() === 'admin') {
    window.location.replace('/merch/admin/index.html');
    return;
}
    } catch {
      state.currentUser = null;
    }

    if (state.currentUser) {
      try {
        const profileResult = await api('/api/merch/profile');
        state.merchProfile = profileResult.profile || null;
        state.merchOrders = Array.isArray(profileResult.orders) ? profileResult.orders : [];
        state.merchAddresses = Array.isArray(profileResult.addresses) ? profileResult.addresses : [];
        state.merchWishlistItems = Array.isArray(profileResult.wishlistItems) ? profileResult.wishlistItems : [];
        state.merchCartItems = Array.isArray(profileResult.cartItems) ? profileResult.cartItems : [];
      } catch {
        state.merchProfile = null;
        state.merchOrders = [];
        state.merchAddresses = [];
        state.merchWishlistItems = [];
        state.merchCartItems = [];
      }
    } else {
      state.merchProfile = null;
      state.merchOrders = [];
      state.merchAddresses = [];
      state.merchWishlistItems = [];
      state.merchCartItems = [];
    }

    state.authResolved = true;
    setBodyAuthLoading(false);
    renderAccountTrigger();

    if (state.currentView === 'tracking') {
      const trackingOrderId = getTrackingOrderIdFromHash();
      if (trackingOrderId) showOrderTracking(trackingOrderId);
    }
  }

  // ─── Initialize ───
  function init() {
    loadCart();
    renderCartBadge();
    renderProductGrid();
    bindEvents();
    routeFromLocation();
    setBodyAuthLoading(true);
    renderAccountTrigger();
    loadMerchProducts();
    loadCustomerContext();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
