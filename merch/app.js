/* House Merch â€“ Storefront App */
/* Vanilla JS SPA following booking portal patterns */

(function () {
  'use strict';

  // â”€â”€â”€ API Configuration â”€â”€â”€
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

  // â”€â”€â”€ State â”€â”€â”€
  const state = {
    products: [],
    cart: [],
    selectedCategory: 'all',
    sortBy: 'newest',
    searchQuery: '',
    currentView: 'shop', // 'shop' | 'detail' | 'checkout' | 'confirmation' | 'tracking'
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
    merchCouponHistory: [],
    influencerDashboard: null,
    influencerDashboardLoading: false,
    influencerSalesSearch: '',
    influencerSalesStatus: 'all',
    influencerSalesFrom: '',
    influencerSalesTo: '',
    influencerSalesPage: 1,
    influencerSalesMonth: 'all',
    accountDrawerOpen: false,
    accountDrawerTrigger: null,
    accountActiveSection: null,
    accountProfileEditing: false,
    accountProfileMessage: '',
    accountAddressMessage: '',
    accountAddressFormMode: null,
    accountEditingAddressId: null,
    accountOrdersExpanded: false,
    accountOrderFilterFrom: '',
    accountOrderFilterTo: '',
    accountOrderFilterAppliedFrom: '',
    accountOrderFilterAppliedTo: '',
    accountOrderFilterMessage: '',
    checkoutModalOpen: false,
    checkoutSelectedAddressId: '',
    checkoutDraft: null,
    checkoutErrors: {},
    checkoutSubmitting: false,
    checkoutMessage: '',
    merchCouponCode: '',
    merchCouponPreview: null,
    merchCouponError: '',
    merchCouponLoading: false,
    latestConfirmation: null,
  };

  const FALLBACK_PRODUCT_IMAGE = '/booking/assets/service-hydrogen-session.jpg';

  // â”€â”€â”€ Product Data (Static catalog until API is built) â”€â”€â”€
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
      specifications: { 'Product Name': 'Hydrogen-Rich Water Bottle', Capacity: '460ml', 'Electrolytic Material': 'Platinum-Titanium', 'Membrane Electrode': 'PEM + SPE', 'Main Material': 'Glass', 'Shell Material': 'Stainless Steel', 'Battery Type': '700mAh Lithium Polymer', 'Working Time': '5 minutes per cycle (3,000+ ppb)', Size: 'Ø7cm × 24cm', 'Colours Available': 'Blue / Black / Silver / Gold' },
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
      specifications: { 'Product Name': 'Hydrogen Mist Sprayer', 'Atomisation Amount': '0.8–1.2 ml/min', 'Hydrogen Concentration': '1000 ppb', 'Water Tank Capacity': '13ml', 'Main Material': 'PC (Polycarbonate)', 'Negative Potential': '< −300mV', 'Battery Capacity': '500mAh', 'Power Supply': 'DC 5V / Micro USB' },
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

  // Sidebar content is deliberately data-first so it can later be replaced by
  // GET /api/merch/sidebar without changing the rendering layer.
  const MERCH_SIDEBAR_DEMO_DATA = {
    trending: [
      { key: 'bottle', rating: 5 },
      { key: 'mist', rating: 5 },
      { key: 'hoodie-sand', rating: 5 },
      { key: 'hoodie-black', rating: 5 },
    ],
    bundles: [
      { keys: ['bottle', 'mist'], label: 'Bottle + Mist', savings: 'Save 15%', discount: 0.85 },
    ],
    offers: [
      { eyebrow: '🏷 Limited Time Offer', title: 'Up to 10% OFF', detail: 'Make space for a more intentional everyday ritual.', cta: 'Shop Now' },
    ],
    benefits: [
      'Secure Payments',
      'Easy Returns',
      'Sustainably Made',
      'Trusted by Wellness Enthusiasts',
    ],
    recommended: [
      { key: 'bottle' },
      { key: 'mist' },
      { key: 'hoodie-black' },
      { key: 'hoodie-sand' },
    ],
  };

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
    const isCombo = Boolean(product?.isCombo);
    const source = isCombo ? null : (
      (!isCombo && slug && PRODUCT_IMAGE_SOURCES[slug]) ||
      (name.includes('water bottle') ? PRODUCT_IMAGE_SOURCES['h2-water-bottle'] : null) ||
      (name.includes('mist') || category === 'sprays' ? PRODUCT_IMAGE_SOURCES['h2-mist-spray'] : null) ||
      (name.includes('hoodie') && name.includes('black') ? PRODUCT_IMAGE_SOURCES['zenith-hoodie-black'] : null) ||
      (name.includes('hoodie') && name.includes('sand') ? PRODUCT_IMAGE_SOURCES['zenith-hoodie-sand'] : null) ||
      null
    );
    const fallbackImages = Array.isArray(source?.images) ? source.images.filter(Boolean) : [];
    const productImages = Array.isArray(product?.images) ? product.images.filter(Boolean).map(normalizeProductImageUrl) : [];
    const imageUrl = normalizeProductImageUrl(product?.imageUrl || product?.image || product?.image_url || source?.imageUrl || '');

    return {
      imageUrl: imageUrl || fallbackImages[0] || '',
      images: productImages.length ? productImages : (fallbackImages.length ? fallbackImages : (imageUrl ? [imageUrl] : [])),
    };
  }

  function normalizeProductImageUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    if (raw.startsWith('/')) return raw;
    if (raw.startsWith('cdn/') || raw.startsWith('booking/') || raw.startsWith('uploads/')) return `/${raw}`;
    return `/cdn/shop/files/${raw}`;
  }

  function getProductFallbackImage(product) {
    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    if (category === 'sprays' || name.includes('mist') || name.includes('spray')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138';
    if (category === 'bottles' || name.includes('bottle')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113';
    if (category === 'hoodies' || name.includes('hoodie')) return '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg';
    return FALLBACK_PRODUCT_IMAGE;
  }

  function renderDynamicCategoryOptions() {
    const categories = [...new Set(state.products.map((product) => String(product.category || '').trim()).filter(Boolean))];
    const currentValue = state.selectedCategory;
    els.categoryFilter.innerHTML = [
      '<option value="all">All Categories</option>',
      ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(getCategoryLabel(category))}</option>`),
    ].join('');
    els.categoryFilter.value = categories.includes(currentValue) ? currentValue : 'all';
    state.selectedCategory = els.categoryFilter.value;
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

  // â”€â”€â”€ Utility â”€â”€â”€
  const LOW_STOCK_THRESHOLD = 15;

  function formatPrice(amountInr) {
    return '₹' + Number(amountInr || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function formatMoneyFromPaise(paise) {
    return formatPrice(Math.max(0, Math.round(Number(paise || 0) / 100)));
  }

  function normalizeCatalogAmount(valueInPaise) {
    return Math.max(0, Math.round(Number(valueInPaise || 0) / 100));
  }

  function getPriceRange(product) {
    const prices = product.variants.map(v => v.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return formatPrice(min);
    return `${formatPrice(min)} - ${formatPrice(max)}`;
  }

  function findSidebarProduct(key, fallbackIndex = 0) {
    const normalizedKey = String(key || '').toLowerCase();
    const productPool = state.products.length ? state.products : PRODUCTS;
    const product = productPool.find((entry) => {
      const name = String(entry.name || '').toLowerCase();
      const category = String(entry.category || '').toLowerCase();
      if (normalizedKey === 'bottle') return category === 'bottles' || name.includes('bottle');
      if (normalizedKey === 'mist') return category === 'sprays' || name.includes('mist') || name.includes('spray');
      if (normalizedKey === 'hoodie-sand') return name.includes('hoodie') && name.includes('sand');
      if (normalizedKey === 'hoodie-black') return name.includes('hoodie') && name.includes('black');
      return name.includes(normalizedKey);
    });
    return product || productPool[fallbackIndex % Math.max(1, productPool.length)] || null;
  }

  function getSmartSidebarData() {
    const trending = MERCH_SIDEBAR_DEMO_DATA.trending
      .map((entry, index) => ({ ...entry, product: findSidebarProduct(entry.key, index) }))
      .filter((entry) => entry.product);
    const recommended = MERCH_SIDEBAR_DEMO_DATA.recommended
      .map((entry, index) => ({ ...entry, product: findSidebarProduct(entry.key, index) }))
      .filter((entry) => entry.product);
    const bundles = MERCH_SIDEBAR_DEMO_DATA.bundles.map((bundle) => {
      const products = bundle.keys.map((key, index) => findSidebarProduct(key, index)).filter(Boolean);
      const basePrice = products.reduce((total, product) => total + Number(product.variants?.[0]?.price || product.basePrice || 0), 0);
      return {
        ...bundle,
        products,
        price: basePrice * Number(bundle.discount || 1),
      };
    }).filter((bundle) => bundle.products.length);
    return {
      trending,
      bundles,
      offers: MERCH_SIDEBAR_DEMO_DATA.offers,
      benefits: MERCH_SIDEBAR_DEMO_DATA.benefits,
      recommended,
    };
  }

  function renderSidebarProduct(item) {
    const product = item.product;
    const image = product.images?.[0] || product.imageUrl || getProductFallbackImage(product);
    return `
      <button class="smart-merch-product" type="button" data-sidebar-product-id="${escapeHtml(String(product.id))}" aria-label="View ${escapeHtml(product.name)}">
        <img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
        <span class="smart-merch-product__info">
          <strong>${escapeHtml(product.name)}</strong>
          <span class="smart-merch-product__rating" aria-label="${Number(item.rating || 5)} out of 5 stars">★★★★★</span>
          <span class="smart-merch-product__price">${escapeHtml(getPriceRange(product))}</span>
        </span>
      </button>
    `;
  }

  function renderSmartMerchSidebar() {
    if (!els.smartMerchSidebar) return;
    const data = getSmartSidebarData();
    els.smartMerchSidebar.innerHTML = `
      <section class="smart-merch-sidebar__section smart-merch-sidebar__section--trending" aria-labelledby="smartTrendingTitle">
        <div class="smart-merch-sidebar__heading">
          <h3 id="smartTrendingTitle">🔥 Trending Products</h3>
          <button type="button" class="smart-merch-sidebar__view-all" data-sidebar-action="view-all">View All <span aria-hidden="true">→</span></button>
        </div>
        <div class="smart-merch-product-list">${data.trending.map(renderSidebarProduct).join('')}</div>
      </section>

      <section class="smart-merch-sidebar__section smart-merch-sidebar__section--bundle" aria-labelledby="smartBundleTitle">
        <div class="smart-merch-sidebar__heading">
          <h3 id="smartBundleTitle">Bundle &amp; Save</h3>
        </div>
        <div class="smart-merch-bundle-list">
          ${data.bundles.map((bundle) => `
            <div class="smart-merch-bundle">
            <div class="smart-merch-bundle__items">
              ${bundle.products.map((product, index) => `
                ${index ? '<span class="smart-merch-bundle__plus" aria-hidden="true">+</span>' : ''}
                <img src="${escapeHtml(product.images?.[0] || product.imageUrl || getProductFallbackImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
              `).join('')}
            </div>
            <strong>${escapeHtml(bundle.label)}</strong>
            <span class="smart-merch-bundle__savings">${escapeHtml(bundle.savings)}</span>
            <strong class="smart-merch-bundle__price">${escapeHtml(formatPrice(bundle.price))}</strong>
            <button type="button" class="btn btn-primary smart-merch-sidebar__cta" data-sidebar-action="shop-bundle">Shop Bundle</button>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="smart-merch-sidebar__section smart-merch-sidebar__section--offer" aria-labelledby="smartOfferTitle">
        ${data.offers.map((offer) => `
          <div class="smart-merch-offer">
            <p class="smart-merch-offer__eyebrow">${escapeHtml(offer.eyebrow)}</p>
            <h3 id="smartOfferTitle">${escapeHtml(offer.title)}</h3>
            <p>${escapeHtml(offer.detail)}</p>
            <button type="button" class="smart-merch-sidebar__text-cta" data-sidebar-action="shop-offer">${escapeHtml(offer.cta)} <span aria-hidden="true">→</span></button>
          </div>
        `).join('')}
      </section>

      <section class="smart-merch-sidebar__section smart-merch-sidebar__section--benefits" aria-labelledby="smartBenefitsTitle">
        <div class="smart-merch-sidebar__heading">
          <h3 id="smartBenefitsTitle">♥ House Benefits</h3>
        </div>
        <ul class="smart-merch-benefits">
          ${data.benefits.map((benefit) => `<li><span aria-hidden="true">✓</span>${escapeHtml(benefit)}</li>`).join('')}
        </ul>
      </section>

      <section class="smart-merch-sidebar__section smart-merch-sidebar__section--recommended" aria-labelledby="smartRecommendedTitle">
        <div class="smart-merch-sidebar__heading">
          <h3 id="smartRecommendedTitle">Recommended For You</h3>
          <button type="button" class="smart-merch-sidebar__view-all" data-sidebar-action="view-all">View All <span aria-hidden="true">→</span></button>
        </div>
        <div class="smart-merch-product-list">${data.recommended.map(renderSidebarProduct).join('')}</div>
      </section>
    `;

    els.smartMerchSidebar.querySelectorAll('[data-sidebar-product-id]').forEach((button) => {
      button.addEventListener('click', () => showProductDetail(Number(button.dataset.sidebarProductId)));
    });
    els.smartMerchSidebar.querySelectorAll('[data-sidebar-action="view-all"], [data-sidebar-action="shop-bundle"], [data-sidebar-action="shop-offer"]').forEach((button) => {
      button.addEventListener('click', () => {
        els.shopSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function getDefaultPurchasableVariant(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => Number(variant?.stock || 0) > 0) || variants[0] || null;
  }

  function getVariantLabel(variant) {
    return [variant?.size, variant?.color].filter(Boolean).join(' / ') || 'Default variant';
  }

  function getLowStockVariants(product) {
    return (Array.isArray(product?.variants) ? product.variants : [])
      .filter((variant) => Number(variant?.stock || 0) > 0 && Number(variant?.stock || 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
  }

  function getVariantStockState(variant) {
    const stock = Number(variant?.stock || 0);
    const label = getVariantLabel(variant);

    if (stock <= 0) {
      return {
        label: 'Out of stock',
        className: 'out-of-stock',
        detail: `${label} is unavailable right now.`,
      };
    }

    if (stock <= LOW_STOCK_THRESHOLD) {
      return {
        label: `Low stock (${stock} left)`,
        className: 'low-stock',
        detail: `${label} is running low. Restock soon.`,
      };
    }

    return {
      label: `In stock (${stock} available)`,
      className: 'in-stock',
      detail: `${label} is available for purchase.`,
    };
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

  function getOrderDateKey(order) {
    const value = order?.createdAt || order?.created_at || order?.orderDate || order?.order_date || '';
    if (!value) return '';
    const raw = String(value).trim();
    const directDate = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (directDate) return directDate[1];
    const parsed = new Date(raw.replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getFilteredMerchOrders(orders) {
    const from = state.accountOrderFilterAppliedFrom;
    const to = state.accountOrderFilterAppliedTo;
    if (!from && !to) return orders;
    return orders.filter((order) => {
      const orderDate = getOrderDateKey(order);
      if (!orderDate) return false;
      if (from && orderDate < from) return false;
      if (to && orderDate > to) return false;
      return true;
    });
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
      customerEmail: confirmation.email,
      email: confirmation.email,
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

  async function addToWishlist(product, variant) {
    if (!state.authResolved) {
      await loadCustomerContext();
    }
    const productId = Number(product?.id || 0) || null;
    const variantId = Number(variant?.id || 0) || null;
    if (!productId && !variantId) return;

    const alreadySaved = state.merchWishlistItems.some((item) => (
      Number(item.productId || 0) === Number(productId || 0)
      && Number(item.variantId || 0) === Number(variantId || 0)
    ));
    if (alreadySaved) {
      showCheckoutNotice('Wishlist', `${product.name} is already in your wishlist.`);
      return;
    }

    try {
      if (state.currentUser) {
        const result = await api('/api/merch/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, variantId }),
        });
        if (result?.item) state.merchWishlistItems.unshift(result.item);
      } else {
        const item = { id: `guest-${productId}-${variantId || 'default'}`, productId, variantId, productName: product.name };
        state.merchWishlistItems.unshift(item);
        localStorage.setItem('merch_wishlist_guest', JSON.stringify(state.merchWishlistItems));
      }

      showCheckoutNotice('Wishlist', `${product.name} was added to your wishlist.`);
    } catch (error) {
      showCheckoutNotice('Wishlist unavailable', error?.message || 'Please try again.', { variant: 'error' });
    }
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
    const normalizedVariants = variants.map((variant) => ({
      ...variant,
      price: normalizeCatalogAmount(variant?.price || 0),
    }));
    const normalizedPrices = normalizedVariants.map((variant) => Number(variant.price || 0));
    const basePrice = normalizeCatalogAmount(product?.basePrice || product?.base_price || 0);
    const price = normalizeCatalogAmount(product?.price || product?.basePrice || product?.base_price || 0);

    return {
      ...product,
      id: Number(product?.id || 0),
      name: String(product?.name || ''),
      slug: String(product?.slug || ''),
      description: String(product?.description || ''),
      specifications: normalizeSpecifications(product?.specifications || product?.specifications_json, product),
      category: String(product?.category || ''),
      basePrice,
      imageUrl,
      image: imageUrl,
      images,
      variants: normalizedVariants,
      price,
      priceLabel: normalizedPrices.length > 1
        ? `${formatPrice(Math.min(...normalizedPrices))} - ${formatPrice(Math.max(...normalizedPrices))}`
        : formatPrice(price || basePrice),
      createdAt: String(product?.createdAt || ''),
    };
  }

  function normalizeSpecifications(value, product = null) {
    if (!value) return inferSpecifications(product);
    if (typeof value === 'object' && !Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(String(value));
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : inferSpecifications(product);
    } catch {
      return inferSpecifications(product);
    }
  }

  function inferSpecifications(product) {
    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    if (category === 'bottles' || name.includes('bottle')) return { 'Product type': 'Hydrogen-rich water bottle', 'Recommended use': 'Use with clean drinking water; follow the product cycle instructions' };
    if (category === 'sprays' || name.includes('mist') || name.includes('spray')) return { 'Product type': 'Hydrogen mist sprayer', 'Recommended use': 'Fill with clean water and use as directed' };
    if (category === 'hoodies' || name.includes('hoodie')) return { 'Product type': 'Premium pullover hoodie', Care: 'Machine wash cold; air dry' };
    return {};
  }

  function getProductSpecifications(product, variant = null) {
    const specifications = { ...normalizeSpecifications(product?.specifications, product) };
    const category = String(product?.category || '').toLowerCase();
    const selectedSize = String(variant?.size || '').trim();
    const selectedColor = String(variant?.color || '').trim();

    // Variant-dependent values must follow the option selected by the customer.
    if (selectedSize && (category === 'bottles' || String(product?.name || '').toLowerCase().includes('bottle'))) {
      specifications.Capacity = selectedSize;
    }
    if (selectedSize && (category === 'sprays' || String(product?.name || '').toLowerCase().includes('mist') || String(product?.name || '').toLowerCase().includes('spray'))) {
      specifications['Product Size'] = selectedSize;
    }
    if (selectedColor && category === 'hoodies') {
      specifications.Colour = selectedColor;
    }
    if (selectedColor) {
      specifications['Selected Colour'] = selectedColor;
    }
    if (selectedSize) {
      specifications['Selected Size'] = selectedSize;
    }
    return specifications;
  }

  function renderProductSpecifications(product, variant = null) {
    const specifications = getProductSpecifications(product, variant);
    const entries = Object.entries(specifications).filter(([label, value]) => String(label).trim() && String(value).trim());
    if (!entries.length) return '';
    return `
      <div class="product-specifications" id="productSpecifications" hidden>
        <h2>Specifications</h2>
        <dl>${entries.map(([label, value]) => `<div class="product-specification"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>
      </div>
    `;
  }

  async function loadMerchProducts() {
    try {
      const result = await api('/api/merch/products');
      state.products = Array.isArray(result) ? result.map(normalizeMerchProduct) : [];
      renderDynamicCategoryOptions();
    } catch (error) {
      state.products = [];
      console.error('Unable to load merch products:', error);
    }

    renderProductGrid();
    renderSmartMerchSidebar();

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

  // â”€â”€â”€ Elements â”€â”€â”€
  const els = {
    productGrid: document.getElementById('productGrid'),
    productEmpty: document.getElementById('productEmpty'),
    smartMerchSidebar: document.getElementById('smartMerchSidebar'),
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
    checkoutPage: document.getElementById('checkoutPage'),
    bookingConfirmation: document.getElementById('bookingConfirmation'),
    orderTracking: document.getElementById('orderTracking'),
    merchAuthCta: document.getElementById('merchAuthCta'),
    accountDrawer: document.getElementById('accountDrawer'),
    accountDrawerOverlay: document.getElementById('accountDrawerOverlay'),
    accountDrawerCloseBtn: document.getElementById('accountDrawerCloseBtn'),
    accountDrawerContent: document.getElementById('accountDrawerContent'),
  };

  // â”€â”€â”€ Cart (localStorage for now) â”€â”€â”€
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

  function getMerchShippingCharge(subtotalInr = getCartTotal()) {
    return Number(subtotalInr || 0) >= 999 ? 0 : 99;
  }

  function getIncludedGstAmount(subtotalInr = getCartTotal()) {
    const subtotalPaise = Math.round(Number(subtotalInr || 0) * 100);
    return Math.max(0, (subtotalPaise - Math.round(subtotalPaise / 1.18)) / 100);
  }

  function formatCheckoutMoney(amountInr) {
    return '₹' + Number(amountInr || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getCheckoutDiscountAmount() {
    return Math.max(0, Number(state.merchCouponPreview?.discountAmountInr || 0));
  }

  function getCheckoutTotals() {
    const subtotal = getCartTotal();
    const shipping = getMerchShippingCharge(subtotal);
    const discount = getCheckoutDiscountAmount();
    const total = Math.max(1, subtotal + shipping - discount);
    return {
      subtotal,
      shipping,
      discount,
      total,
      gstIncluded: getIncludedGstAmount(subtotal),
    };
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
      <span>Discount: ${formatPrice(Number(preview.discountAmountInr || 0))}</span>
      <span>Payable: ${formatPrice(Number(preview.payableAmountInr || 0))}</span>
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

    state.merchCouponLoading = true;
    try {
      const result = await api('/api/merch/preview-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: code,
          subtotalAmountPaise: Math.round(getCartTotal() * 100),
          productIds: state.cart.map((item) => Number(item.productId)).filter(Boolean),
          productLineTotals: state.cart.reduce((totals, item) => {
            const productId = Number(item.productId || 0);
            if (productId) totals[productId] = Number(totals[productId] || 0) + Math.round(item.price * item.quantity * 100);
            return totals;
          }, {}),
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

  // â”€â”€â”€ Render: Cart Badge â”€â”€â”€
  function renderCartBadge() {
    const count = getCartCount();
    if (count > 0) {
      els.cartBadge.textContent = count;
      els.cartBadge.hidden = false;
    } else {
      els.cartBadge.hidden = true;
    }
  }

  // â”€â”€â”€ Render: Cart Drawer â”€â”€â”€
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
      els.cartCouponApplyBtn.textContent = state.merchCouponLoading ? 'APPLYING...' : 'APPLY COUPON';
      els.cartCouponApplyBtn.disabled = Boolean(state.merchCouponLoading);
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
      bag: '<path d="M6.5 8.5h11l-1 11h-9z" /><path d="M9 8.5a3 3 0 0 1 6 0" />',
      mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4.5 7 7.5 6 7.5-6" />',
      whatsapp: '<path d="M19.1 4.9A9.4 9.4 0 0 0 4.2 16.1L3 21l5-1.2A9.4 9.4 0 0 0 21.4 8.2a9.3 9.3 0 0 0-2.3-3.3Z" /><path d="M8.4 8.7c.2-.5.4-.6.7-.6h.5c.2 0 .4.1.5.4l.7 1.7c.1.2.1.4 0 .6l-.4.5c-.1.2-.1.4 0 .5.5.9 1.2 1.6 2.1 2.1.2.1.4.1.5 0l.6-.7c.2-.2.4-.2.6-.1l1.7.8c.3.1.4.3.4.5 0 .4-.2 1.1-.6 1.4-.5.5-1.4.6-2.4.3-2.6-.8-4.8-3-5.7-5.6-.3-.8-.1-1.5.2-1.8Z" />',
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
        <p>Your confirmation email will be available soon.</p>
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

  function BookingUpdatesCard() {
    return `
      <section class="booking-updates-card" aria-label="Booking status updates">
        <h2>We'll keep you updated</h2>
        <div class="booking-updates-grid">
          <article class="booking-update-item">
            <div class="booking-update-icon">${confirmationIcon('mail')}</div>
            <div>
              <h3>Email Confirmation</h3>
              <strong>Preparing...</strong>
              <p>We're preparing your confirmation email.</p>
            </div>
          </article>
          <article class="booking-update-item">
            <div class="booking-update-icon">${confirmationIcon('whatsapp')}</div>
            <div>
              <h3>WhatsApp Updates <span>Coming Soon</span></h3>
              <strong>Coming Soon</strong>
              <p>We'll notify you on WhatsApp when your order is shipped.</p>
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function BookingDetailsCard(data) {
    const details = [
      { icon: 'calendar', label: 'Date & Time', lines: [data.dateLabel, data.timeLabel] },
      { icon: 'user', label: 'Service', lines: [data.service] },
      { icon: 'map', label: data.locationTitle || 'Location', lines: [data.location] },
      {
        icon: 'truck',
        label: 'Estimated Delivery Date',
        lines: ['27 Jul 2026 - 31 Jul 2026', "We'll notify you once your order is shipped."],
        isDelivery: true,
      },
    ];
    return `
      <div class="booking-details-card">
        ${details.map((item) => `
          <article class="booking-detail-item${item.isDelivery ? ' booking-detail-item--delivery' : ''}">
            <div class="booking-detail-icon">${confirmationIcon(item.icon)}</div>
            <div>
              <h2>${escapeHtml(item.label)}</h2>
              ${item.lines.map((line, index) => (
                item.isDelivery && index === 0
                  ? `<strong>${escapeHtml(line)}</strong>`
                  : `<p>${escapeHtml(line)}</p>`
              )).join('')}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function BookingActions() {
    return `
      <div class="booking-actions">
        <button class="booking-action-btn booking-action-btn--accent" type="button" data-confirmation-action="track">
          ${confirmationIcon('truck')} <span>Track My Order</span>
        </button>
        <button class="booking-action-btn booking-action-btn--neutral" type="button" data-confirmation-action="home">
          ${confirmationIcon('home')} <span>Back to Home</span>
        </button>
        <button class="booking-action-btn booking-action-btn--primary" type="button" data-confirmation-action="shop">
          ${confirmationIcon('bag')} <span>Continue Shopping</span>
        </button>
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
        ${BookingUpdatesCard(data)}
        ${BookingDetailsCard(data)}
        ${BookingActions(data)}
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
        if (action === 'shop') {
          window.location.href = '/merch/';
          return;
        }
        if (action === 'track') {
          if (data.orderId) {
            window.location.hash = `track-order/${encodeURIComponent(data.orderId)}`;
          } else {
            showCheckoutNotice('Track My Order', 'Order details are unavailable for tracking yet.');
          }
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
    if (els.checkoutPage) els.checkoutPage.hidden = true;
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
          await openTrackingMerchInvoice(order);
        }
      });
    });
  }

  function showOrderTracking(orderId) {
    const order = getTrackingOrderById(orderId);
    state.currentView = 'tracking';

    els.productDetail.hidden = true;
    els.shopSection.hidden = true;
    if (els.checkoutPage) els.checkoutPage.hidden = true;
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
    if (window.location.hash === '#checkout') {
      showCheckoutPage();
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
    button?.addEventListener('click', (event) => {
      event.preventDefault();
      openAccountDrawer();
    });

  }

  function getInfluencerDashboardData() {
    return state.influencerDashboard || null;
  }

  function getInfluencerSalesRows() {
    const dashboard = getInfluencerDashboardData();
    const rows = Array.isArray(dashboard?.salesHistory?.items) ? [...dashboard.salesHistory.items] : [];
    const search = String(state.influencerSalesSearch || '').trim().toLowerCase();
    const status = String(state.influencerSalesStatus || 'all').trim().toLowerCase();
    const from = String(state.influencerSalesFrom || '').trim();
    const to = String(state.influencerSalesTo || '').trim();

    return rows.filter((row) => {
      const rowStatus = String(row.orderStatus || row.paymentStatus || '').trim().toLowerCase();
      if (status && status !== 'all' && rowStatus !== status) return false;
      if (from && String(row.orderDate || '').slice(0, 10) < from) return false;
      if (to && String(row.orderDate || '').slice(0, 10) > to) return false;
      if (state.influencerSalesMonth !== 'all' && String(row.orderDate || '').slice(0, 7) !== state.influencerSalesMonth) return false;
      if (!search) return true;
      return [row.orderNumber, row.productSummary, row.customerName, row.couponUsed, row.orderStatus, row.paymentStatus]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  }

  function renderSparklineBars(rows = [], valueKey = 'value', labelKey = 'label', formatter = null) {
    const items = Array.isArray(rows) ? rows : [];
    const maxValue = items.reduce((max, item) => Math.max(max, Number(item?.[valueKey] || 0)), 0) || 1;
    return items.map((item) => {
      const value = Number(item?.[valueKey] || 0);
      const width = Math.max(8, Math.round((value / maxValue) * 100));
      const formattedValue = typeof formatter === 'function' ? formatter(value, item) : formatPrice(value || 0);
      return `
        <div class="influencer-chart__row">
          <span class="influencer-chart__label">${escapeHtml(item?.[labelKey] || '')}</span>
          <span class="influencer-chart__bar"><span style="width:${width}%"></span></span>
          <strong class="influencer-chart__value">${escapeHtml(formattedValue)}</strong>
        </div>
      `;
    }).join('');
  }

  function renderInfluencerDashboardSection() {
    const dashboard = getInfluencerDashboardData();
    if (!state.currentUser) return '';

    if (!dashboard || !dashboard.influencer) {
      return `
        <section class="account-section account-section--influencer">
          <div class="account-section__head">
            <div>
              <p class="account-section__eyebrow">Influencer Dashboard</p>
              <h4>Creator access</h4>
            </div>
            <span class="account-badge account-badge--muted">Not available</span>
          </div>
          <div class="account-empty-state">
            <p>No influencer dashboard for this account.</p>
            <span>Your logged-in email must match an active influencer record in Merch Admin → Influencers.</span>
          </div>
        </section>
      `;
    }

    const influencer = dashboard.influencer || {};
    const summary = dashboard.summary || {};
    const analytics = dashboard.analytics || {};
    const coupons = Array.isArray(dashboard.couponPerformance) ? dashboard.couponPerformance : [];
    const commissions = Array.isArray(dashboard.commissionHistory) ? dashboard.commissionHistory : [];
    const notifications = Array.isArray(dashboard.notifications) ? dashboard.notifications : [];
    const filteredSales = getInfluencerSalesRows();
    const pageSize = 5;
    const pageCount = Math.max(1, Math.ceil(filteredSales.length / pageSize));
    const currentPage = Math.min(Math.max(1, Number(state.influencerSalesPage || 1)), pageCount);
    const pageSlice = filteredSales.slice((currentPage - 1) * pageSize, (currentPage - 1) * pageSize + pageSize);

    const socialLinksText = Array.isArray(influencer.socialLinks) ? influencer.socialLinks.join('\n') : '';
    // Kept available for legacy markup while the insights panel remains hidden.
    const bestCoupon = analytics.bestCoupon || dashboard.performance?.bestCoupon || null;
    const highestSalesMonth = analytics.highestSalesMonth || dashboard.performance?.highestSalesMonth || null;
    const topProducts = Array.isArray(analytics.topProducts) ? analytics.topProducts : Array.isArray(dashboard.performance?.topSellingProducts) ? dashboard.performance.topSellingProducts : [];
    const averageOrderValue = dashboard.performance?.averageOrderValue ?? summary.averageOrderValue ?? 0;
    const repeatCustomerPercentage = dashboard.performance?.repeatCustomerPercentage ?? analytics.repeatCustomerPercentage ?? 0;
    const conversionRate = dashboard.performance?.conversionRate ?? summary.conversionRate ?? 0;
    const upcomingPayment = dashboard.commission?.upcomingPayment ? formatDateLabel(dashboard.commission.upcomingPayment) : 'No payout scheduled';
    const lastPayment = dashboard.commission?.lastPaymentDate ? formatDateLabel(dashboard.commission.lastPaymentDate) : 'No payments yet';
    const monthlyTrend = Array.isArray(analytics.monthlyTrend) ? analytics.monthlyTrend : [];
    const isCouponExpired = (coupon) => {
      if (!coupon?.expiresAt) return false;
      const expiry = new Date(String(coupon.expiresAt).length <= 10 ? `${coupon.expiresAt}T23:59:59` : coupon.expiresAt);
      return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
    };
    const isCouponDisabled = (coupon) => coupon && (coupon.active === false || coupon.active === 0 || ['false', 'disabled', 'inactive'].includes(String(coupon.active).toLowerCase()));
    const isCouponUnavailable = (coupon) => isCouponDisabled(coupon) || isCouponExpired(coupon);
    const getCouponStatus = (coupon) => isCouponExpired(coupon) ? 'Expired' : isCouponDisabled(coupon) ? 'Disabled' : 'Active';
    const primaryCoupon = coupons.find((coupon) => coupon && !isCouponUnavailable(coupon)) || coupons[0] || null;
    const monthOptions = monthlyTrend.map((item) => ({
      value: String(item.month || item.key || '').slice(0, 7),
      label: String(item.label || item.month || item.key || ''),
    })).filter((item, index, items) => item.value && items.findIndex((entry) => entry.value === item.value) === index);
    const selectedMonth = monthOptions.find((item) => item.value === state.influencerSalesMonth) || null;
    const monthlyRows = getInfluencerSalesRows();
    const activeMonthlyRows = monthlyRows.filter((row) => !['cancelled', 'refunded', 'failed'].includes(String(row.orderStatus || row.paymentStatus || '').toLowerCase()));
    const activeMonthlySales = activeMonthlyRows.reduce((total, row) => total + Number(row.orderAmount || 0), 0);
    const monthlyCommission = activeMonthlyRows.reduce((total, row) => total + Number(row.commissionEarned || 0), 0);
    const monthlyPaidRows = activeMonthlyRows.filter((row) => ['paid', 'cod_pending'].includes(String(row.paymentStatus || '').toLowerCase()));
    const monthlyCouponUsage = activeMonthlyRows.filter((row) => row.couponUsed).length;
    const monthlyConversion = activeMonthlyRows.length ? (monthlyPaidRows.length / activeMonthlyRows.length) * 100 : 0;
    const isMonthlyView = Boolean(selectedMonth);
    const primaryCouponUnavailable = isCouponUnavailable(primaryCoupon);
    const kpis = [
      { label: 'Total Sales Generated', value: formatMoneyFromPaise(isMonthlyView ? activeMonthlySales : summary.totalSalesGenerated || 0), note: isMonthlyView ? `${selectedMonth.label} active sales.` : 'Live merch sales linked to your coupons.' },
      { label: 'Total Orders Referred', value: (isMonthlyView ? activeMonthlyRows.length : Number(summary.totalOrdersReferred || 0)).toLocaleString('en-IN'), note: isMonthlyView ? `${selectedMonth.label} active orders.` : 'Attributed orders across merch checkout.' },
      { label: 'Total Commission Earned', value: formatMoneyFromPaise(isMonthlyView ? monthlyCommission : summary.totalCommissionEarned || 0), note: isMonthlyView ? `${selectedMonth.label} calculated commission.` : 'Calculated from active influencer commission.' },
      { label: 'Commission Pending', value: formatMoneyFromPaise(isMonthlyView ? monthlyCommission : summary.commissionPending || 0), note: isMonthlyView ? `${selectedMonth.label} commission awaiting payout.` : 'Awaiting payout from the admin team.' },
      { label: 'Commission Paid', value: formatMoneyFromPaise(isMonthlyView ? 0 : summary.commissionPaid || 0), note: isMonthlyView ? 'Monthly payout details are recorded separately.' : 'Already processed and recorded.' },
      { label: 'Active Coupons', value: Number(summary.activeCoupons || coupons.filter((coupon) => coupon.active).length || 0).toLocaleString('en-IN'), note: 'Assignable and currently live.' },
      { label: 'Coupon Usage', value: (isMonthlyView ? monthlyCouponUsage : Number(summary.couponUsage || 0)).toLocaleString('en-IN'), note: isMonthlyView ? `${selectedMonth.label} orders captured through your codes.` : 'Orders captured through your codes.' },
      { label: 'Conversion Rate', value: `${(isMonthlyView ? monthlyConversion : Number(summary.conversionRate || 0)).toFixed(1)}%`, note: 'Paid orders from referred traffic.' },
    ];

    return `
      <section class="account-section account-section--influencer">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Influencer Dashboard</p>
            <h4>Premium creator analytics</h4>
          </div>
          <label class="influencer-month-select">
            <span>Month</span>
            <select data-influencer-filter="month">
              <option value="all" ${state.influencerSalesMonth === 'all' ? 'selected' : ''}>All months</option>
              ${monthOptions.map((item) => `<option value="${escapeHtml(item.value)}" ${state.influencerSalesMonth === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </label>
        </div>
        <p class="account-card__note">Your dashboard updates from live merch sales, assigned coupons, and commission payments.</p>

        <article class="influencer-coupon-hero${primaryCouponUnavailable ? ' influencer-coupon-hero--unavailable' : ''}">
          <div class="influencer-coupon-hero__top">
            <div class="influencer-coupon-hero__copy">
              <p class="account-section__eyebrow">Assigned Coupon</p>
              <h4>${escapeHtml(primaryCoupon?.code || 'Not assigned yet')}</h4>
              <p>${escapeHtml(primaryCoupon ? (primaryCoupon.description || 'This coupon is linked to your influencer account.') : 'No coupon has been assigned yet. Once the admin assigns one, it will appear here automatically.')}</p>
            </div>
            <div class="influencer-coupon-hero__actions">
              <span class="account-badge ${primaryCoupon && !primaryCouponUnavailable ? 'account-badge--live' : 'account-badge--muted'}">${escapeHtml(primaryCoupon ? getCouponStatus(primaryCoupon) : 'No coupon')}</span>
              <button type="button" class="btn btn-outline account-action-btn" data-account-action="copy-influencer-coupon" data-coupon-code="${escapeHtml(primaryCoupon?.code || '')}" ${primaryCoupon?.code && !primaryCouponUnavailable ? '' : 'disabled'}>Copy code</button>
            </div>
          </div>
          <div class="influencer-coupon-hero__stats">
            <div class="influencer-coupon-hero__stat">
              <small>Type</small>
              <strong>${escapeHtml(primaryCoupon ? (primaryCoupon.discountType || 'flat') : 'Discount')}</strong>
            </div>
            <div class="influencer-coupon-hero__stat">
              <small>Value</small>
              <strong>${escapeHtml(primaryCoupon ? formatPrice(primaryCoupon.discountValue || 0) : formatPrice(0))}</strong>
            </div>
            <div class="influencer-coupon-hero__stat">
              <small>Expires</small>
              <strong>${escapeHtml(primaryCoupon ? formatDateLabel(primaryCoupon.expiresAt) : 'No expiry')}</strong>
            </div>
            <div class="influencer-coupon-hero__stat">
              <small>Usage</small>
              <strong>${escapeHtml(primaryCoupon ? Number(primaryCoupon.usageCount || 0).toLocaleString('en-IN') : '0')}</strong>
            </div>
          </div>
        </article>

        <div class="influencer-kpi-grid">
          ${kpis.map((item) => `
            <article class="influencer-kpi">
              <p>${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.note)}</span>
            </article>
          `).join('')}
        </div>

        <div class="influencer-grid influencer-grid--charts">
          <article class="influencer-panel">
            <div class="account-section__head">
              <div>
                <p class="account-section__eyebrow">Monthly Sales Trend</p>
                <h4>Sales generated</h4>
              </div>
            </div>
            <div class="influencer-chart">
              ${monthlyTrend.length ? renderSparklineBars(monthlyTrend, 'sales', 'label', (value) => formatMoneyFromPaise(value)) : '<p class="account-empty-state">No sales trend data yet.</p>'}
            </div>
          </article>
          <article class="influencer-panel">
            <div class="account-section__head">
              <div>
                <p class="account-section__eyebrow">Monthly Commission Trend</p>
                <h4>Commission earned</h4>
              </div>
            </div>
            <div class="influencer-chart">
              ${monthlyTrend.length ? renderSparklineBars(monthlyTrend, 'commission', 'label', (value) => formatMoneyFromPaise(value)) : '<p class="account-empty-state">No commission trend data yet.</p>'}
            </div>
          </article>
        </div>

        <div class="influencer-grid influencer-grid--analytics">
          <article class="influencer-panel">
            <div class="account-section__head">
              <div>
                <p class="account-section__eyebrow">Orders Per Month</p>
                <h4>Fulfillment activity</h4>
              </div>
            </div>
            <div class="influencer-chart">
              ${monthlyTrend.length ? renderSparklineBars(monthlyTrend, 'orders', 'label', (value) => Number(value || 0).toLocaleString('en-IN')) : '<p class="account-empty-state">No order activity yet.</p>'}
            </div>
          </article>
          <article class="influencer-panel influencer-panel--removed-insights">
            <div class="account-section__head">
              <div>
                <p class="account-section__eyebrow">Performance Insights</p>
                <h4>Quick wins</h4>
              </div>
            </div>
            <div class="account-chip-list influencer-insight-list">
              <span class="account-chip">Best coupon: ${escapeHtml(bestCoupon?.code || 'N/A')}</span>
              <span class="account-chip">Highest sales month: ${escapeHtml(highestSalesMonth?.label || 'N/A')}</span>
              <span class="account-chip">Average order value: ${escapeHtml(formatMoneyFromPaise(averageOrderValue || 0))}</span>
              <span class="account-chip">Repeat customers: ${escapeHtml(`${repeatCustomerPercentage.toFixed ? repeatCustomerPercentage.toFixed(1) : repeatCustomerPercentage}%`)}</span>
              <span class="account-chip">Conversion rate: ${escapeHtml(`${Number(conversionRate || 0).toFixed(1)}%`)}</span>
            </div>
            <div class="influencer-mini-list">
              ${topProducts.length ? topProducts.map((product) => `
                <div class="influencer-mini-list__item">
                  <strong>${escapeHtml(product.name || 'Product')}</strong>
                  <span>${escapeHtml(`${Number(product.quantity || 0).toLocaleString('en-IN')} sold`)}</span>
                </div>
              `).join('') : '<p class="account-empty-state">Top products will appear once customers start buying through your codes.</p>'}
            </div>
          </article>
        </div>

        <article class="influencer-panel">
          <div class="account-section__head">
            <div>
              <p class="account-section__eyebrow">Coupon Performance</p>
              <h4>Assigned coupon details</h4>
            </div>
            <span class="account-section__count">${coupons.length}</span>
          </div>
          <div class="influencer-coupon-grid">
            ${coupons.length ? coupons.map((coupon) => `
              <article class="influencer-coupon-card${isCouponUnavailable(coupon) ? ' influencer-coupon-card--unavailable' : ''}">
                <div class="influencer-coupon-card__head">
                  <div>
                    <strong>${escapeHtml(coupon.code || '')}</strong>
                    <span>${escapeHtml(getCouponStatus(coupon))}</span>
                  </div>
                  <button type="button" class="btn btn-outline account-action-btn" data-account-action="copy-influencer-coupon" data-coupon-code="${escapeHtml(coupon.code || '')}" ${isCouponUnavailable(coupon) ? 'disabled' : ''}>Copy</button>
                </div>
                <p>${escapeHtml(coupon.description || 'No description')}</p>
                <div class="influencer-coupon-card__meta">
                  <span>${escapeHtml(coupon.discountType || 'flat')} ${escapeHtml(formatPrice(coupon.discountValue || 0))}</span>
                  <span>Expires ${escapeHtml(coupon.expiresAt ? formatDateLabel(coupon.expiresAt) : 'No expiry')}</span>
                  <span>Usage ${escapeHtml(`${Number(coupon.usageCount || 0)} / ${coupon.remainingUsage == null ? '∞' : coupon.maxRedemptions}`)}</span>
                  <span>Revenue ${escapeHtml(formatMoneyFromPaise(coupon.revenueGenerated || 0))}</span>
                  <span>Orders ${escapeHtml(Number(coupon.ordersGenerated || 0).toLocaleString('en-IN'))}</span>
                </div>
              </article>
            `).join('') : '<div class="account-empty-state"><p>No coupons assigned yet.</p><span>Assigned coupon performance will appear here automatically.</span></div>'}
          </div>
        </article>

        <details class="influencer-details influencer-details--sales-history" open>
          <summary>
            <span>Sales History</span>
            <small>${filteredSales.length} records</small>
          </summary>
          <div class="influencer-toolbar">
            <label class="account-field">
              <span>Search</span>
              <input type="search" data-influencer-filter="search" value="${escapeHtml(state.influencerSalesSearch)}" placeholder="Order number, coupon, customer, product" />
            </label>
            <label class="account-field">
              <span>Status</span>
              <select data-influencer-filter="status">
                <option value="all" ${state.influencerSalesStatus === 'all' ? 'selected' : ''}>All</option>
                <option value="paid" ${state.influencerSalesStatus === 'paid' ? 'selected' : ''}>Paid</option>
                <option value="cod_pending" ${state.influencerSalesStatus === 'cod_pending' ? 'selected' : ''}>COD Pending</option>
                <option value="processing" ${state.influencerSalesStatus === 'processing' ? 'selected' : ''}>Processing</option>
                <option value="shipped" ${state.influencerSalesStatus === 'shipped' ? 'selected' : ''}>Shipped</option>
                <option value="delivered" ${state.influencerSalesStatus === 'delivered' ? 'selected' : ''}>Delivered</option>
                <option value="cancelled" ${state.influencerSalesStatus === 'cancelled' ? 'selected' : ''}>Cancelled</option>
              </select>
            </label>
            <label class="account-field">
              <span>From</span>
              <input type="date" data-influencer-filter="from" value="${escapeHtml(state.influencerSalesFrom)}" />
            </label>
            <label class="account-field">
              <span>To</span>
              <input type="date" data-influencer-filter="to" value="${escapeHtml(state.influencerSalesTo)}" />
            </label>
          </div>
          <div class="influencer-table-wrap">
            ${pageSlice.length ? `
              <table class="influencer-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Date</th>
                    <th>Product Summary</th>
                    <th>Customer</th>
                    <th>Coupon</th>
                    <th>Amount</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Payment</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageSlice.map((order) => `
                    <tr>
                      <td><strong>${escapeHtml(order.orderNumber || '')}</strong></td>
                      <td>${escapeHtml(formatDateLabel(order.orderDate))}</td>
                      <td>${escapeHtml(order.productSummary || 'Merch order')}</td>
                      <td>${escapeHtml(order.customerName || 'Customer')}</td>
                      <td>${escapeHtml(order.couponUsed || '—')}</td>
                      <td>${escapeHtml(formatMoneyFromPaise(order.orderAmount || 0))}</td>
                      <td>${escapeHtml(formatMoneyFromPaise(order.commissionEarned || 0))}</td>
                      <td>${escapeHtml(order.orderStatus || 'pending')}</td>
                      <td>${escapeHtml(order.paymentStatus || 'pending')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
              <div class="influencer-pagination">
                <span>Page ${currentPage} of ${pageCount}</span>
                <div>
                  <button type="button" class="btn btn-outline account-action-btn" data-account-action="influencer-history-page" data-direction="prev" ${currentPage <= 1 ? 'disabled' : ''}>Previous</button>
                  <button type="button" class="btn btn-outline account-action-btn" data-account-action="influencer-history-page" data-direction="next" ${currentPage >= pageCount ? 'disabled' : ''}>Next</button>
                </div>
              </div>
            ` : '<div class="account-empty-state"><p>No sales match your filters.</p><span>Try a wider date range or clear the search.</span></div>'}
          </div>
        </details>

        <div class="influencer-grid influencer-grid--two">
          <details class="influencer-details" open>
            <summary>
              <span>Commission</span>
              <small>${formatMoneyFromPaise(dashboard.commission?.pending || 0)} pending</small>
            </summary>
            <div class="influencer-commission-grid">
              <article class="influencer-commission-card"><span>Total Earned</span><strong>${escapeHtml(formatMoneyFromPaise(dashboard.commission?.totalEarned || 0))}</strong></article>
              <article class="influencer-commission-card"><span>Total Paid</span><strong>${escapeHtml(formatMoneyFromPaise(dashboard.commission?.totalPaid || 0))}</strong></article>
              <article class="influencer-commission-card"><span>Pending</span><strong>${escapeHtml(formatMoneyFromPaise(dashboard.commission?.pending || 0))}</strong></article>
              <article class="influencer-commission-card"><span>Last Payment</span><strong>${escapeHtml(lastPayment)}</strong></article>
              <article class="influencer-commission-card"><span>Upcoming Payment</span><strong>${escapeHtml(upcomingPayment)}</strong></article>
            </div>
            <div class="influencer-table-wrap">
              ${commissions.length ? `
                <table class="influencer-table influencer-table--compact">
                  <thead>
                    <tr>
                      <th>Payment Date</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Reference Number</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${commissions.map((payment) => `
                      <tr>
                        <td>${escapeHtml(formatDateLabel(payment.paymentDate))}</td>
                        <td>${escapeHtml(formatMoneyFromPaise(payment.amount || 0))}</td>
                        <td>${escapeHtml(payment.paymentMethod || 'Manual')}</td>
                        <td>${escapeHtml(payment.referenceNumber || '—')}</td>
                        <td>${escapeHtml(payment.status || 'pending')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : '<div class="account-empty-state"><p>No commission history yet.</p><span>Processed payouts will show up here automatically.</span></div>'}
            </div>
          </details>

          <details class="influencer-details" open>
            <summary>
              <span>Notifications</span>
              <small>${notifications.length} items</small>
            </summary>
            <div class="influencer-notifications">
              ${notifications.length ? notifications.map((note) => `
                <article class="influencer-notification">
                  <strong>${escapeHtml(note.title || '')}</strong>
                  <p>${escapeHtml(note.message || '')}</p>
                  <span>${escapeHtml(formatDateLabel(note.time))}</span>
                </article>
              `).join('') : '<div class="account-empty-state"><p>No notifications yet.</p><span>Sale, coupon, and payment alerts will appear here.</span></div>'}
            </div>
          </details>
        </div>

        <details class="influencer-details">
          <summary>
            <span>Profile</span>
            <small>Manage creator details</small>
          </summary>
          <form class="influencer-profile-form" id="influencerProfileForm">
            <div class="account-form__grid">
              <label class="account-field account-field--wide">
                <span>Profile Picture</span>
                <input name="avatarUrl" type="url" value="${escapeHtml(influencer.avatarUrl || '')}" placeholder="https://..." />
              </label>
              <label class="account-field">
                <span>Name</span>
                <input name="name" type="text" value="${escapeHtml(influencer.name || '')}" required />
              </label>
              <label class="account-field">
                <span>Email</span>
                <input type="email" value="${escapeHtml(influencer.email || '')}" readonly aria-readonly="true" />
              </label>
              <label class="account-field">
                <span>Phone Number</span>
                <input name="phone" type="tel" value="${escapeHtml(influencer.phone || '')}" />
              </label>
              <label class="account-field account-field--wide">
                <span>Social Media Links</span>
                <textarea name="socialLinks" rows="3" placeholder="One URL per line">${escapeHtml(socialLinksText)}</textarea>
              </label>
              <label class="account-field account-field--wide">
                <span>Bio</span>
                <textarea name="bio" rows="3" placeholder="Short creator bio">${escapeHtml(influencer.bio || '')}</textarea>
              </label>
              <label class="account-field account-field--wide">
                <span>Preferred Payment Details</span>
                <textarea name="preferredPaymentDetails" rows="3" placeholder="UPI ID, bank details, or payout instructions">${escapeHtml(influencer.preferredPaymentDetails || '')}</textarea>
              </label>
            </div>
            <div class="account-form__actions">
              <button class="btn btn-primary account-action-btn" type="submit">Save Profile</button>
            </div>
          </form>
        </details>
      </section>
    `;
  }

  function renderOrderActionIcon(name) {
    const icons = {
      eye: '<svg class="account-order-action__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="1.8"/></svg>',
      truck: '<svg class="account-order-action__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 7h11v9H3V7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 10h4l3 3v3h-7v-6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" stroke="currentColor" stroke-width="1.8"/></svg>',
      document: '<svg class="account-order-action__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v5h4M10 12h5M10 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      download: '<svg class="account-order-action__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 21h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };
    return icons[name] || '';
  }

  function renderAccountNavIcon(name) {
    const icons = {
      profile: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8"/><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      orders: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      addresses: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12 12.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4Z" stroke="currentColor" stroke-width="1.8"/></svg>',
      wishlist: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20.5 5.8c-1.7-1.8-4.4-1.8-6.1 0L12 8.2 9.6 5.8c-1.7-1.8-4.4-1.8-6.1 0-1.8 1.9-1.8 4.9 0 6.7L12 21l8.5-8.5c1.8-1.8 1.8-4.8 0-6.7Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      logout: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12h9M10 9l3 3-3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      influencer: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 13v5a2 2 0 0 0 2 2h3l7-16h2a2 2 0 0 1 2 2v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 13h5M15 13h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    return icons[name] || '';
  }

  function renderAccountDrawer() {
    if (!els.accountDrawerContent) return;

    const profile = getMerchantProfile();
    const orders = Array.isArray(state.merchOrders) ? state.merchOrders : [];
    const filteredOrders = getFilteredMerchOrders(orders);
    const addresses = Array.isArray(state.merchAddresses) ? state.merchAddresses : [];
    const wishlistItems = Array.isArray(state.merchWishlistItems) ? state.merchWishlistItems : [];
    const couponHistory = Array.isArray(state.merchCouponHistory) ? state.merchCouponHistory : [];
    const visibleOrders = state.accountOrdersExpanded ? filteredOrders : filteredOrders.slice(0, 4);
    const hasActiveOrderFilter = Boolean(state.accountOrderFilterAppliedFrom && state.accountOrderFilterAppliedTo);
    const editingAddress = addresses.find((address) => getAddressId(address) === String(state.accountEditingAddressId || ''));
    const accountInitials = escapeHtml(getInitials(profile.fullName));
    const avatarStyle = profile.avatarUrl
      ? ` style="background-image:url('${escapeHtml(profile.avatarUrl)}')"`
      : '';

    els.accountDrawerContent.innerHTML = `
      <nav class="account-panel-nav" aria-label="Account sections">
        <button type="button" data-account-nav="account-profile" aria-current="${state.accountActiveSection === 'account-profile' ? 'page' : 'false'}">${renderAccountNavIcon('profile')}<span>My Profile</span></button>
        <button type="button" data-account-nav="account-orders" aria-current="${state.accountActiveSection === 'account-orders' ? 'page' : 'false'}">${renderAccountNavIcon('orders')}<span>My Orders</span></button>
        <button type="button" data-account-nav="account-addresses" aria-current="${state.accountActiveSection === 'account-addresses' ? 'page' : 'false'}">${renderAccountNavIcon('addresses')}<span>My Addresses</span></button>
        <button type="button" data-account-nav="account-wishlist" aria-current="${state.accountActiveSection === 'account-wishlist' ? 'page' : 'false'}">${renderAccountNavIcon('wishlist')}<span>Wishlist</span></button>
        <button id="merchLogoutNavBtn" class="account-panel-nav__logout" type="button">${renderAccountNavIcon('logout')}<span>Logout</span></button>
        ${state.influencerDashboard?.influencer ? `<button type="button" data-account-nav="account-influencer" aria-current="${state.accountActiveSection === 'account-influencer' ? 'page' : 'false'}">${renderAccountNavIcon('influencer')}<span>Influencer Dashboard</span></button>` : ''}
      </nav>
      <section id="account-profile" data-account-section="account-profile" class="account-card account-card--profile">
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

      <section id="account-addresses" data-account-section="account-addresses" class="account-section">
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

      <section id="account-orders" data-account-section="account-orders" class="account-section account-section--orders">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">My Orders</p>
            <h4>Merchandise orders</h4>
          </div>
          <span class="account-section__count">${orders.length}</span>
        </div>
        ${orders.length ? `
          <form class="account-order-filter" id="accountOrderFilterForm">
            <label class="account-field">
              <span>From</span>
              <input name="fromDate" type="date" value="${escapeHtml(state.accountOrderFilterFrom)}" />
            </label>
            <label class="account-field">
              <span>To</span>
              <input name="toDate" type="date" value="${escapeHtml(state.accountOrderFilterTo)}" />
            </label>
            <div class="account-order-filter__actions">
              <button class="btn btn-primary account-action-btn" type="submit">Apply</button>
              <button class="account-order-filter__clear" type="button" data-account-action="clear-order-filter">Clear</button>
            </div>
            ${state.accountOrderFilterMessage ? `<p class="account-order-filter__message" role="alert">${escapeHtml(state.accountOrderFilterMessage)}</p>` : ''}
          </form>
        ` : ''}
        ${filteredOrders.length ? `
          <div class="account-list account-order-list">
            ${visibleOrders.map((order) => `
              <article class="account-list__item account-list__item--stacked account-order-card">
                <div class="account-list__row">
                  <strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong>
                  <div class="order-status-group">
                    <span class="payment-status payment-status--${order.paymentStatus === 'paid' ? 'paid' : 'pending'}">
                      ${order.paymentStatus === 'paid' ? 'Paid' : 'Pending Payment'}
                    </span>
                    <span class="order-status">
                      ${escapeHtml(formatOrderStatus(order.status))}
                    </span>
                  </div>
                  
                </div>
                <p>${escapeHtml(formatDateLabel(order.createdAt))} <span class="account-order-meta-dot" aria-hidden="true">•</span> ${escapeHtml(order.totalAmount ? formatMoneyFromPaise(order.totalAmount) : 'Total unavailable')}</p>
                ${(order.influencerCoupon || order.couponCode || order.coupon_code) ? `<p class="account-order-coupon"><span>Coupon applied</span><strong>${escapeHtml(order.influencerCoupon || order.couponCode || order.coupon_code)}</strong></p>` : ''}
                <div class="account-item-actions account-item-actions--inline account-order-actions">
                  <button type="button" data-account-action="view-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="View details for ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('eye')}<span>View Details</span></button>
                  <button type="button" data-account-action="track-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Track ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('truck')}<span>Track Order</span></button>
                  <button type="button" data-account-action="invoice-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Open invoice for ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('document')}<span>Invoice</span></button>
                  <button type="button" data-account-action="download-invoice" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Download invoice for ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('download')}<span>Download Invoice</span></button>
                </div>
              </article>
            `).join('')}
          </div>
          ${hasActiveOrderFilter && filteredOrders.length > visibleOrders.length ? `<p class="account-order-filter__summary">Showing ${visibleOrders.length} of ${filteredOrders.length} matching orders.</p>` : ''}
        ` : orders.length ? `
          <div class="account-empty-state">
            <p>No orders found.</p>
            <span>No merchandise orders match the selected date range.</span>
          </div>
        ` : `
          <div class="account-empty-state">
            <p>No orders yet.</p>
            <span>Your first merch order will appear here after checkout.</span>
          </div>
        `}
      </section>

      <section data-account-section="account-coupons" class="account-section account-section--coupon-history">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Coupon History</p>
            <h4>Applied discounts</h4>
          </div>
          <span class="account-section__count">${couponHistory.length}</span>
        </div>
        ${couponHistory.length ? `
          <div class="account-list">
            ${couponHistory.map((entry) => `
              <article class="account-list__item account-list__item--stacked">
                <div class="account-list__row">
                  <strong>${escapeHtml(entry.couponCode || entry.influencerCoupon || `Order #${entry.orderId}`)}</strong>
                  <span>${escapeHtml(formatDateLabel(entry.createdAt))}</span>
                </div>
                <p>${escapeHtml(entry.influencerCoupon || entry.couponCode || 'Discount applied')}</p>
                <div class="account-item-actions account-item-actions--inline">
                  <button type="button" data-account-action="view-order" data-order-id="${escapeHtml(String(entry.orderId || ''))}">View Order</button>
                </div>
              </article>
            `).join('')}
          </div>
        ` : `
          <div class="account-empty-state">
            <p>No coupon history yet.</p>
            <span>Any merch coupon you used will appear here automatically.</span>
          </div>
        `}
      </section>

      <div id="account-influencer" data-account-section="account-influencer">${renderInfluencerDashboardSection()}</div>

      <section id="account-wishlist" data-account-section="account-wishlist" class="account-section">
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

      <section class="account-section account-section--extra">
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

      <section class="account-section account-section--extra">
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

    const activeSection = state.accountActiveSection || '';
    els.accountDrawerContent.querySelectorAll('[data-account-section]').forEach((section) => {
      section.hidden = !activeSection || section.dataset.accountSection !== activeSection;
    });

    document.getElementById('merchLogoutBtn')?.addEventListener('click', handleLogout);
    document.getElementById('merchLogoutNavBtn')?.addEventListener('click', handleLogout);
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
    document.getElementById('influencerProfileForm')?.addEventListener('submit', handleInfluencerProfileSubmit);
    document.getElementById('accountOrderFilterForm')?.addEventListener('submit', handleAccountOrderFilterSubmit);

    els.accountDrawerContent?.querySelectorAll('[data-account-action]').forEach((button) => {
      button.addEventListener('click', () => handleAccountAction(button));
    });

    els.accountDrawerContent?.querySelectorAll('[data-account-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        state.accountActiveSection = button.dataset.accountNav || 'account-profile';
        renderAccountDrawer();
      });
    });

    els.accountDrawerContent?.querySelectorAll('[data-influencer-filter]').forEach((input) => {
      const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(eventName, () => {
        const key = input.dataset.influencerFilter;
        if (key === 'search') state.influencerSalesSearch = String(input.value || '');
        if (key === 'status') state.influencerSalesStatus = String(input.value || 'all');
        if (key === 'from') state.influencerSalesFrom = String(input.value || '');
        if (key === 'to') state.influencerSalesTo = String(input.value || '');
        if (key === 'month') state.influencerSalesMonth = String(input.value || 'all');
        state.influencerSalesPage = 1;
        renderAccountDrawer();
      });
    });
  }

  function getOrderById(orderId) {
    return (Array.isArray(state.merchOrders) ? state.merchOrders : []).find((order) => String(order.id || '') === String(orderId || ''));
  }

  function handleAccountOrderFilterSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const from = String(formData.get('fromDate') || '').trim();
    const to = String(formData.get('toDate') || '').trim();
    state.accountOrderFilterFrom = from;
    state.accountOrderFilterTo = to;

    if (!from || !to) {
      state.accountOrderFilterMessage = 'Select both From and To dates.';
      renderAccountDrawer();
      return;
    }

    if (from > to) {
      state.accountOrderFilterMessage = 'From date must be before or equal to To date.';
      renderAccountDrawer();
      return;
    }

    state.accountOrderFilterAppliedFrom = from;
    state.accountOrderFilterAppliedTo = to;
    state.accountOrderFilterMessage = '';
    renderAccountDrawer();
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

    if (action === 'clear-order-filter') {
      state.accountOrderFilterFrom = '';
      state.accountOrderFilterTo = '';
      state.accountOrderFilterAppliedFrom = '';
      state.accountOrderFilterAppliedTo = '';
      state.accountOrderFilterMessage = '';
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
               <span>Customer Type</span>
               <strong>${order.isGuest ? 'Guest linked to account' : 'Registered customer'}</strong>
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
             ${(order.influencerCoupon || order.couponCode || order.coupon_code) ? `<div class="order-detail-row"><span>Coupon Applied</span><strong>${escapeHtml(order.influencerCoupon || order.couponCode || order.coupon_code)}</strong></div>` : ''}
             <div class="order-detail-row">
               <span>Shipping</span>
               <strong>${escapeHtml(order.shippingAddress || 'Unavailable')}</strong>
             </div>
             <div class="order-detail-row">
               <span>Billing</span>
               <strong>${escapeHtml(order.billingAddress || order.shippingAddress || 'Unavailable')}</strong>
             </div>
             <div class="order-detail-row">
               <span>Total</span>
               <strong>${order.totalAmount ? formatMoneyFromPaise(order.totalAmount) : 'Unavailable'}</strong>
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
      return;
    }

    if (action === 'copy-influencer-coupon') {
      const code = String(button.dataset.couponCode || '').trim();
      if (!code) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
        }
        showCheckoutNotice('Copied', `${code} copied to clipboard.`);
      } catch {
        showCheckoutNotice('Copy failed', 'Unable to copy the coupon code right now.', { variant: 'error' });
      }
      return;
    }

    if (action === 'influencer-history-page') {
      const direction = String(button.dataset.direction || '').trim();
      const totalRows = getInfluencerSalesRows();
      const pageCount = Math.max(1, Math.ceil(totalRows.length / 5));
      if (direction === 'prev') {
        state.influencerSalesPage = Math.max(1, Number(state.influencerSalesPage || 1) - 1);
      } else if (direction === 'next') {
        state.influencerSalesPage = Math.min(pageCount, Number(state.influencerSalesPage || 1) + 1);
      }
      renderAccountDrawer();
      return;
    }

    if (action === 'save-influencer-profile') {
      const form = document.getElementById('influencerProfileForm');
      if (form) form.requestSubmit();
      return;
    }
  }

  async function fetchMerchInvoiceLink(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Order details are unavailable.');
    }
    return api(`/api/merch/orders/${encodeURIComponent(id)}/invoice-link`);
  }

  async function fetchTrackingMerchInvoiceLink(order) {
    const id = Number(order?.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Order details are unavailable.');
    }
    const guestEmail = !state.currentUser ? String(order?.customerEmail || order?.email || '').trim() : '';
    const query = guestEmail ? `?guestEmail=${encodeURIComponent(guestEmail)}` : '';
    return api(`/api/merch/orders/${encodeURIComponent(id)}/invoice-link${query}`);
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

  async function openTrackingMerchInvoice(order) {
    try {
      const data = await fetchTrackingMerchInvoiceLink(order);
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

  async function handleInfluencerProfileSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const socialLinks = String(formData.get('socialLinks') || '')
      .split(/\n+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const payload = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      avatarUrl: String(formData.get('avatarUrl') || '').trim(),
      socialLinks,
      bio: String(formData.get('bio') || '').trim(),
      preferredPaymentDetails: String(formData.get('preferredPaymentDetails') || '').trim(),
    };

    try {
      const result = await api('/api/merch/influencer-profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.influencerDashboard = result.dashboard || state.influencerDashboard;
      if (result.influencer) {
        state.influencerDashboard = {
          ...(state.influencerDashboard || {}),
          influencer: result.influencer,
        };
      }
      if (state.merchProfile) {
        state.merchProfile = {
          ...state.merchProfile,
          ...(payload.name ? { fullName: payload.name } : {}),
          ...(payload.phone ? { mobile: payload.phone } : {}),
          ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
        };
      }
      if (state.currentUser) {
        state.currentUser = {
          ...state.currentUser,
          ...(payload.name ? { name: payload.name } : {}),
          ...(payload.phone ? { mobile: payload.phone } : {}),
          ...(payload.avatarUrl ? { avatarUrl: payload.avatarUrl } : {}),
        };
      }
      showCheckoutNotice('Profile saved', 'Your influencer profile was updated.');
    } catch (error) {
      showCheckoutNotice('Profile not saved', error.message || 'Unable to update influencer profile.', { variant: 'error' });
      return;
    }

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

  async function openAccountDrawer() {
    if (!els.accountDrawer) return;

    state.accountDrawerOpen = true;
    state.accountDrawerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.accountActiveSection = 'account-orders';
    els.accountDrawer.hidden = false;
    els.accountDrawerOverlay.hidden = false;
    requestAnimationFrame(() => {
      els.accountDrawer.classList.add('is-open');
      els.accountDrawerOverlay.classList.add('is-visible');
    });
    document.body.classList.add('is-account-drawer-open');
    renderAccountDrawer();
    els.accountDrawerCloseBtn?.focus();
    els.merchAuthCta?.querySelector('#merchAccountBtn')?.setAttribute('aria-expanded', 'true');

    await loadInfluencerDashboard();
    if (state.accountDrawerOpen) renderAccountDrawer();
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
    state.merchCouponHistory = [];
    state.influencerDashboard = null;
    state.influencerSalesSearch = '';
    state.influencerSalesStatus = 'all';
    state.influencerSalesFrom = '';
    state.influencerSalesTo = '';
    state.influencerSalesPage = 1;
    state.influencerSalesMonth = 'all';
    state.accountDrawerTrigger = null;
    closeAccountDrawer();
    renderAccountTrigger();
    requestAnimationFrame(() => {
      document.querySelector('#merchAuthCta a')?.focus();
    });
  }

  // â”€â”€â”€ Render: Product Grid â”€â”€â”€
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
      const lowStockVariants = getLowStockVariants(product);
      const stockState = getVariantStockState(defaultVariant);
      return `
      <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.name)}">
        <div class="product-card__image">
          ${isSoldOut ? '<span class="product-card__badge product-card__badge--sold-out">Sold out</span>' : lowStockVariants.length ? '<span class="product-card__badge product-card__badge--low-stock">Low stock</span>' : ''}
          <img src="${escapeHtml(product.images?.[0] || product.imageUrl || getProductFallbackImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(getCategoryLabel(product.category))}</p>
          <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
          <p class="product-card__price">
            ${product.variants.length > 1 ? '<span class="price-from">From </span>' : ''}${getPriceRange(product)}
          </p>
          <p class="product-card__stock ${stockState.className}">
            ${isSoldOut ? 'UNAVAILABLE' : 'IN STOCK'}
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
    if (labels[category]) return labels[category];
    return String(category || 'Products')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  // â”€â”€â”€ Render: Product Detail â”€â”€â”€
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
    if (els.checkoutPage) els.checkoutPage.hidden = true;
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
    if (els.checkoutPage) els.checkoutPage.hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    if (els.orderTracking) els.orderTracking.hidden = true;
    els.shopSection.hidden = false;
    document.querySelector('.merch-hero').hidden = false;
    document.querySelector('.merch-categories').hidden = false;
    if (window.location.hash === '#booking-confirmation' || window.location.hash === '#checkout' || getTrackingOrderIdFromHash()) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  function renderProductGallery(product) {
    const mainImage = product.images?.[0] || product.imageUrl || getProductFallbackImage(product);
    els.productGallery.innerHTML = `
      <div class="gallery-main">
        <img id="galleryMainImg" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
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
    const stockState = getVariantStockState(variant);
    const lowStockVariants = getLowStockVariants(product);

    // Get unique sizes and colors
    const sizes = [...new Set(product.variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];

    els.productInfo.innerHTML = `
      <p class="detail-kicker">${escapeHtml(getCategoryLabel(product.category))}</p>
      <h1 class="detail-title">${escapeHtml(product.name)}</h1>
      <p class="detail-price">${formatPrice(variant.price)}</p>
      <p class="detail-description">${escapeHtml(product.description)}</p>
      ${product.isCombo && Array.isArray(product.comboItems) && product.comboItems.length ? `
        <div class="combo-product-details">
          <strong>Included in this combo</strong>
          <div class="combo-product-details__items">
            ${product.comboItems.map((item) => { const fallback = getProductFallbackImage({ name: item.productName, category: '' }); const image = normalizeProductImageUrl(item.imageUrl || fallback); return `<div class="combo-product-details__item"><img src="${escapeHtml(image)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';" /><span>${escapeHtml(item.productName)}<small>${escapeHtml([item.size, item.color].filter(Boolean).join(' / ') || item.sku || 'Default variant')}</small></span></div>`; }).join('')}
          </div>
        </div>
      ` : ''}
      ${Object.keys(getProductSpecifications(product, variant)).length ? '<button class="more-details-button" id="moreDetailsButton" type="button" aria-expanded="false" aria-controls="productSpecifications">More details <span aria-hidden="true">＋</span></button>' : ''}
      ${renderProductSpecifications(product, variant)}

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
        <button class="qty-btn" id="qtyDec" type="button">-</button>
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

      <p class="stock-status ${stockState.className}">
        ${escapeHtml(stockState.label)}
      </p>
      <p class="stock-status__detail">
        ${escapeHtml(stockState.detail)}
      </p>
      ${lowStockVariants.length ? `
        <div class="stock-alert stock-alert--low">
          <strong>Low stock details</strong>
          <span>${escapeHtml(lowStockVariants.map((item) => `${getVariantLabel(item)} (${Number(item.stock || 0)})`).join(', '))}</span>
        </div>
      ` : ''}
    `;

    const moreDetailsButton = document.getElementById('moreDetailsButton');
    const specificationsPanel = document.getElementById('productSpecifications');
    moreDetailsButton?.addEventListener('click', () => {
      const isOpen = !specificationsPanel.hidden;
      specificationsPanel.hidden = isOpen;
      moreDetailsButton.setAttribute('aria-expanded', String(!isOpen));
      moreDetailsButton.querySelector('span').textContent = isOpen ? '＋' : '−';
    });

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

    document.getElementById('addToWishlistBtn')?.addEventListener('click', () => {
      addToWishlist(product, state.selectedVariant);
    });
  }

  // â”€â”€â”€ Search â”€â”€â”€
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

  function buildCheckoutDraft(customer = {}, address = {}) {
    const nameParts = String(customer?.name || address?.recipientName || '').trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    return {
      email: String(customer?.email || '').trim(),
      phone: String(customer?.phone || address?.phone || '').trim(),
      firstName,
      lastName,
      country: String(address?.country || 'India').trim() || 'India',
      line1: String(address?.line1 || address?.full || '').trim(),
      line2: String(address?.line2 || '').trim(),
      city: String(address?.city || '').trim(),
      state: String(address?.state || '').trim(),
      postalCode: String(address?.postalCode || '').trim(),
      emailOffers: true,
      saveInformation: Boolean(address?.isDefault),
    };
  }

  function getCheckoutDraftFromForm(form) {
    const formData = new FormData(form);
    return {
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      firstName: String(formData.get('firstName') || '').trim(),
      lastName: String(formData.get('lastName') || '').trim(),
      country: String(formData.get('country') || '').trim(),
      line1: String(formData.get('line1') || '').trim(),
      line2: String(formData.get('line2') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      state: String(formData.get('state') || '').trim(),
      postalCode: String(formData.get('postalCode') || '').trim(),
      emailOffers: formData.get('emailOffers') === 'on',
      saveInformation: formData.get('saveInformation') === 'on',
    };
  }

  function getCheckoutPayloadFromDraft(draft = state.checkoutDraft || {}) {
    const fullName = [draft.firstName, draft.lastName].filter(Boolean).join(' ').trim();
    return {
      customer: {
        name: fullName,
        email: String(draft.email || '').trim(),
        phone: String(draft.phone || '').trim(),
      },
      address: {
        recipientName: fullName,
        phone: String(draft.phone || '').trim(),
        line1: String(draft.line1 || '').trim(),
        line2: String(draft.line2 || '').trim(),
        city: String(draft.city || '').trim(),
        state: String(draft.state || '').trim(),
        postalCode: String(draft.postalCode || '').trim(),
        country: String(draft.country || 'India').trim() || 'India',
        isDefault: Boolean(draft.saveInformation),
        full: [draft.line1, draft.line2, draft.city, draft.state, draft.postalCode, draft.country].filter(Boolean).join(', '),
      },
    };
  }

  function validateCheckoutDraft(draft = {}) {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const digitsOnly = (value) => String(value || '').replace(/\D+/g, '');

    if (!draft.email) errors.email = 'Email is required.';
    else if (!emailPattern.test(draft.email)) errors.email = 'Enter a valid email address.';
    if (!draft.firstName) errors.firstName = 'First name is required.';
    if (!draft.lastName) errors.lastName = 'Last name is required.';
    if (!draft.country) errors.country = 'Country is required.';
    if (!draft.line1) errors.line1 = 'Address is required.';
    if (!draft.city) errors.city = 'City is required.';
    if (!draft.state) errors.state = 'State is required.';
    if (!draft.postalCode) errors.postalCode = 'PIN code is required.';
    else if (digitsOnly(draft.postalCode).length !== 6) errors.postalCode = 'Enter a 6-digit PIN code.';
    if (!draft.phone) errors.phone = 'Phone is required.';
    else if (digitsOnly(draft.phone).length !== 10) errors.phone = 'Enter a 10-digit phone number.';

    return errors;
  }

  function fieldError(name) {
    const message = state.checkoutErrors?.[name];
    return message ? `<span class="checkout-field-error" id="checkout-${name}-error">${escapeHtml(message)}</span>` : '';
  }

  function renderCheckoutField({ name, label, value = '', type = 'text', placeholder = '', autocomplete = '', wide = false, icon = '', required = true }) {
    const error = state.checkoutErrors?.[name];
    return `
      <label class="shopify-field${wide ? ' shopify-field--wide' : ''}${error ? ' has-error' : ''}">
        <span>${escapeHtml(label)}</span>
        <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="${escapeHtml(autocomplete)}" ${required ? 'required' : ''} ${error ? `aria-describedby="checkout-${escapeHtml(name)}-error"` : ''} />
        ${icon ? `<span class="shopify-field__icon" aria-hidden="true">${icon}</span>` : ''}
        ${fieldError(name)}
      </label>
    `;
  }

  function renderCheckoutSelect({ name, label, value = '', options = [], wide = false }) {
    const error = state.checkoutErrors?.[name];
    return `
      <label class="shopify-field shopify-field--select${wide ? ' shopify-field--wide' : ''}${error ? ' has-error' : ''}">
        <span>${escapeHtml(label)}</span>
        <select name="${escapeHtml(name)}" required ${error ? `aria-describedby="checkout-${escapeHtml(name)}-error"` : ''}>
          ${options.map((option) => `<option value="${escapeHtml(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
        </select>
        ${fieldError(name)}
      </label>
    `;
  }

  function renderCheckoutSummary() {
    const totals = getCheckoutTotals();
    const hasShippingAddress = Boolean(state.checkoutDraft?.line1 && state.checkoutDraft?.city && state.checkoutDraft?.state && state.checkoutDraft?.postalCode);
    const discount = totals.discount > 0 ? `
      <div class="shopify-price-row shopify-price-row--discount">
        <span>Discount${state.merchCouponCode ? ` (${escapeHtml(state.merchCouponCode)})` : ''}</span>
        <strong>- ${formatCheckoutMoney(totals.discount)}</strong>
      </div>
    ` : '';
    return `
      <aside class="shopify-summary" aria-label="Order summary">
        <h2>Order Summary</h2>
        <div class="shopify-summary-products">
          ${state.cart.map((item) => `
            <div class="shopify-summary-product">
              <div class="shopify-summary-product__image">
                <img src="${escapeHtml(item.image || FALLBACK_PRODUCT_IMAGE)}" alt="${escapeHtml(item.productName)}" />
                <span>${escapeHtml(String(item.quantity))}</span>
              </div>
              <div class="shopify-summary-product__copy">
                <strong>${escapeHtml(item.productName)}</strong>
                <small>${escapeHtml(item.variantLabel || 'Default')}</small>
                <small>${escapeHtml(`${item.quantity} Piece${Number(item.quantity) === 1 ? '' : 's'}`)}</small>
              </div>
              <strong class="shopify-summary-product__price">${formatCheckoutMoney(item.price * item.quantity)}</strong>
            </div>
          `).join('')}
        </div>

        <div class="shopify-coupon">
          <label class="shopify-coupon__field">
            <span aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m20 12-8 8-9-9V3h8l9 9Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>
            </span>
            <input id="checkoutCouponCode" type="text" value="${escapeHtml(state.merchCouponCode || '')}" placeholder="Discount code or gift card" autocomplete="off" aria-label="Discount code or gift card" />
          </label>
          <button id="checkoutCouponApplyBtn" class="shopify-coupon__apply" type="button" ${state.merchCouponLoading ? 'disabled' : ''}>${state.merchCouponLoading ? 'APPLYING' : 'APPLY'}</button>
          <div class="shopify-coupon__message${state.merchCouponError ? ' is-error' : ''}" ${state.merchCouponPreview || state.merchCouponError ? '' : 'hidden'}>
            ${state.merchCouponPreview ? `${escapeHtml(state.merchCouponPreview.code || state.merchCouponCode)} applied` : escapeHtml(state.merchCouponError || '')}
          </div>
        </div>

        <div class="shopify-pricing">
          <div class="shopify-price-row"><span>Subtotal</span><strong>${formatCheckoutMoney(totals.subtotal)}</strong></div>
          ${discount}
          <div class="shopify-price-row"><span>Shipping <em aria-label="Shipping help">?</em></span><strong>${hasShippingAddress ? (totals.shipping ? formatCheckoutMoney(totals.shipping) : 'Free') : 'Enter shipping address'}</strong></div>
          <div class="shopify-price-row"><span>GST (Included)</span><strong>${formatCheckoutMoney(totals.gstIncluded)}</strong></div>
        </div>

        <div class="shopify-total">
          <span>Total</span>
          <strong><small>INR</small> ${formatCheckoutMoney(totals.total)}</strong>
          <p>Including ${formatCheckoutMoney(totals.gstIncluded)} in taxes</p>
        </div>

        <div class="shopify-trust">
          <div><span><svg viewBox="0 0 24 24"><path d="M20 4c-8 1-13 6-14 14 6-1 12-6 14-14Z"/><path d="M9 15c2-3 4-5 7-7"/></svg></span><strong>100% Authentic<br>Products</strong></div>
          <div><span><svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span><strong>Secure<br>Payments</strong></div>
          <div><span><svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg></span><strong>Fast &amp; Reliable<br>Delivery</strong></div>
          <div><span><svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg></span><strong>H2 Quality<br>Promise</strong></div>
        </div>
      </aside>
    `;
  }

  function renderCheckoutPage() {
    if (!els.checkoutPage) return;
    const draft = state.checkoutDraft || buildCheckoutDraft(getAuthenticatedCheckoutCustomer(), serializeAddress(getDefaultAddress()));
    state.checkoutDraft = draft;
    const shippingReady = Boolean(draft.line1 && draft.city && draft.state && draft.postalCode);
    const mailIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.2 2c-.9.6-1.7 1.2-1.7 2.5"/><path d="M12 17h.01"/></svg>';
    const searchIcon = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>';

    els.checkoutPage.innerHTML = `
      <div class="shopify-checkout__inner">
        <form id="shopifyCheckoutForm" class="shopify-checkout-form" novalidate>
          <section class="shopify-section shopify-section--contact">
            <div class="shopify-section__head">
              <h1 id="checkoutPageTitle">Contact</h1>
              <p>Already have an account? <a href="/merch/auth.html">Sign in</a></p>
            </div>
            ${renderCheckoutField({ name: 'email', label: 'Email', value: draft.email, type: 'email', placeholder: 'Enter your email', autocomplete: 'email', wide: true, icon: mailIcon })}
            <label class="shopify-check"><input name="emailOffers" type="checkbox" ${draft.emailOffers ? 'checked' : ''} /><span>Email me with news and offers</span></label>
          </section>

          <section class="shopify-section">
            <h2>Delivery</h2>
            <div class="shopify-field-grid">
              ${renderCheckoutSelect({ name: 'country', label: 'Country/Region', value: draft.country || 'India', options: ['India'], wide: true })}
              ${renderCheckoutField({ name: 'firstName', label: 'First name', value: draft.firstName, placeholder: 'First name', autocomplete: 'given-name' })}
              ${renderCheckoutField({ name: 'lastName', label: 'Last name', value: draft.lastName, placeholder: 'Last name', autocomplete: 'family-name' })}
              ${renderCheckoutField({ name: 'line1', label: 'Address', value: draft.line1, placeholder: 'House number and street name', autocomplete: 'address-line1', wide: true, icon: searchIcon })}
              ${renderCheckoutField({ name: 'line2', label: 'Apartment, suite, etc. (optional)', value: draft.line2, placeholder: 'Apartment, suite, building, floor, etc.', autocomplete: 'address-line2', wide: true, required: false })}
              ${renderCheckoutField({ name: 'city', label: 'City', value: draft.city, placeholder: 'City', autocomplete: 'address-level2' })}
              ${renderCheckoutSelect({ name: 'state', label: 'State', value: draft.state || 'Telangana', options: ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi', 'Kerala', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal'] })}
              ${renderCheckoutField({ name: 'postalCode', label: 'PIN code', value: draft.postalCode, placeholder: 'PIN code', autocomplete: 'postal-code', inputmode: 'numeric' })}
              ${renderCheckoutField({ name: 'phone', label: 'Phone', value: draft.phone, type: 'tel', placeholder: '10-digit mobile number', autocomplete: 'tel', wide: true, icon: mailIcon })}
            </div>
            <label class="shopify-check"><input name="saveInformation" type="checkbox" ${draft.saveInformation ? 'checked' : ''} /><span>Save this information for next time</span></label>
          </section>

          <section class="shopify-section">
            <h2>Shipping method</h2>
            <div class="shopify-shipping-box${shippingReady ? ' is-ready' : ''}">
              <span><svg viewBox="0 0 24 24"><path d="M3 7h11v10H3z"/><path d="M14 11h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg></span>
              <p>${shippingReady ? `${getMerchShippingCharge() ? `${formatCheckoutMoney(getMerchShippingCharge())} standard shipping` : 'Free shipping available'}` : 'Enter your shipping address to view available shipping methods.'}</p>
            </div>
          </section>

          <section class="shopify-section">
            <h2>Payment</h2>
            <label class="shopify-payment-option">
              <input type="radio" name="paymentMethod" value="razorpay" checked />
              <span>Razorpay</span>
              <strong>Razorpay</strong>
            </label>
          </section>

          <button class="shopify-pay-button" type="submit" ${state.checkoutSubmitting ? 'disabled' : ''}>
            <span>${state.checkoutSubmitting ? 'PROCESSING...' : 'CONTINUE TO PAYMENT'}</span>
            <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
          </button>
        </form>
        ${renderCheckoutSummary()}
      </div>
    `;
    bindCheckoutPageEvents();
  }

  function showCheckoutPage(customer = null, address = null) {
    if (!state.cart.length) {
      showShop();
      return;
    }
    if (customer || address || !state.checkoutDraft) {
      state.checkoutDraft = buildCheckoutDraft(customer || getAuthenticatedCheckoutCustomer(), address || serializeAddress(getDefaultAddress()));
    }
    state.currentView = 'checkout';
    state.checkoutErrors = {};
    els.productDetail.hidden = true;
    els.shopSection.hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    if (els.orderTracking) els.orderTracking.hidden = true;
    if (els.checkoutPage) els.checkoutPage.hidden = false;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    closeCart();
    renderCheckoutPage();
    if (window.location.hash !== '#checkout') window.location.hash = 'checkout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindCheckoutPageEvents() {
    const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
    if (!form) return;
    form.addEventListener('input', () => {
      state.checkoutDraft = getCheckoutDraftFromForm(form);
      if (Object.keys(state.checkoutErrors || {}).length) {
        state.checkoutErrors = validateCheckoutDraft(state.checkoutDraft);
        renderCheckoutPage();
      }
    });
    form.addEventListener('change', () => {
      state.checkoutDraft = getCheckoutDraftFromForm(form);
      renderCheckoutPage();
    });
    form.addEventListener('submit', handleCheckoutPageSubmit);
    els.checkoutPage?.querySelector('#checkoutCouponApplyBtn')?.addEventListener('click', applyMerchCouponFromCheckout);
    els.checkoutPage?.querySelector('#checkoutCouponCode')?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        applyMerchCouponFromCheckout();
      }
    });
  }

  async function applyMerchCouponFromCheckout() {
    const input = els.checkoutPage?.querySelector('#checkoutCouponCode');
    if (input) state.merchCouponCode = normalizeCouponCode(input.value);
    await applyMerchCouponFromCart();
    renderCheckoutPage();
  }

  async function handleCheckoutPageSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    state.checkoutDraft = getCheckoutDraftFromForm(form);
    state.checkoutErrors = validateCheckoutDraft(state.checkoutDraft);
    if (Object.keys(state.checkoutErrors).length) {
      renderCheckoutPage();
      els.checkoutPage?.querySelector('.has-error input, .has-error select')?.focus();
      return;
    }

    const { customer, address } = getCheckoutPayloadFromDraft(state.checkoutDraft);
    state.checkoutSubmitting = true;
    renderCheckoutPage();
    await startRazorpayCheckout(customer, address);
    state.checkoutSubmitting = false;
    renderCheckoutPage();
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
      showCheckoutPage(customer, serializeAddress(selected));
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
    showCheckoutPage(getAuthenticatedCheckoutCustomer(), serializeAddress(selected));
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
    showCheckoutPage(customer, address);
  }

  // â”€â”€â”€ Event Bindings â”€â”€â”€
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

  // â”€â”€â”€ Razorpay Checkout Flow â”€â”€â”€
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

  async function loadInfluencerDashboard() {
    if (!state.currentUser) {
      state.influencerDashboard = null;
      return;
    }

    try {
      state.influencerDashboardLoading = true;
      const result = await api('/api/merch/influencer-dashboard?page=1&pageSize=500');
      state.influencerDashboard = result || null;
    } catch (error) {
      state.influencerDashboard = null;
      if (Number(error?.status || 0) !== 403) {
        console.warn('Unable to load influencer dashboard:', error?.message || error);
      }
    } finally {
      state.influencerDashboardLoading = false;
    }
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
        state.merchCouponHistory = Array.isArray(profileResult.couponHistory) ? profileResult.couponHistory : [];
      } catch {
        state.merchProfile = null;
        state.merchOrders = [];
        state.merchAddresses = [];
        state.merchWishlistItems = [];
        state.merchCartItems = [];
        state.merchCouponHistory = [];
      }
      await loadInfluencerDashboard();
    } else {
      state.merchProfile = null;
      state.merchOrders = [];
      state.merchAddresses = [];
      state.merchWishlistItems = [];
      state.merchCartItems = [];
      state.merchCouponHistory = [];
      state.influencerDashboard = null;
    }

    state.authResolved = true;
    setBodyAuthLoading(false);
    renderAccountTrigger();

    if (state.currentView === 'tracking') {
      const trackingOrderId = getTrackingOrderIdFromHash();
      if (trackingOrderId) showOrderTracking(trackingOrderId);
    }
  }

  // â”€â”€â”€ Initialize â”€â”€â”€
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
