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
  let authRefreshPromise = null;
  const CONFIRMATION_STORAGE_KEY = 'merch_booking_confirmation';
  const CHECKOUT_DETAILS_STORAGE_KEY = 'merch_checkout_details_v1';

  function isPlaceholderEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const normalized = email.trim().toLowerCase();
    return (
      normalized.endsWith('@h2houseofhealth.local') ||
      (normalized.endsWith('@h2health.local') && normalized.startsWith('customer-')) ||
      /^customer-\d+@/i.test(normalized) ||
      /^guest-\d+@/i.test(normalized)
    );
  }

  function hasRealEmail(email) {
    return Boolean(email && !isPlaceholderEmail(email));
  }

  function buildApiUrl(path) {
    if (/^https?:\/\//i.test(String(path || ''))) return String(path);
    const base = API_URL || window.location.origin;
    return `${base}${path}`;
  }

  function getStoredAuthToken() {
    try {
      window.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
    } catch {
      // Ignore storage access errors.
    }
    return '';
  }

  async function api(path, options = {}) {
    const request = () => {
      const headers = new Headers(options.headers || {});
      const authToken = getStoredAuthToken();
      if (authToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${authToken}`);
      return fetch(buildApiUrl(path), { ...options, credentials: 'include', headers });
    };
    let response = await request();
    if (response.status === 401 && !String(path).startsWith('/api/auth/')) {
      if (!authRefreshPromise) {
        authRefreshPromise = fetch(buildApiUrl('/api/auth/refresh'), {
          method: 'POST', credentials: 'include', headers: { Accept: 'application/json' },
        }).then(async (refreshResponse) => {
          if (!refreshResponse.ok) throw new Error('Authentication refresh failed');
          const refreshData = await refreshResponse.json();
          window.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
          return refreshData;
        }).finally(() => { authRefreshPromise = null; });
      }
      try {
        await authRefreshPromise;
        response = await request();
      } catch {
        // Preserve the original 401 so the existing auth UI can handle it.
      }
    }

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
    cartOwnerId: null,
    selectedCategory: 'all',
    sortBy: 'newest',
    searchQuery: '',
    currentView: 'shop', // 'shop' | 'detail' | 'checkout' | 'confirmation' | 'tracking'
    selectedProduct: null,
    trendingProducts: null,
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
    merchBundleCode: '',
    merchBundlePreview: null,
    latestConfirmation: null,
    offers: [],
    offersLoading: false,
    availableCoupons: [],
    activeOfferId: null,
    currency: (function() {
      try { return localStorage.getItem('h2_currency') || 'INR'; } catch { return 'INR'; }
    })(),
    currencyConfig: { defaultCurrency: 'INR', supportedCurrencies: ['INR', 'USD'], inrPerUsd: 85 },
  };
  window.__state = state;

  const FALLBACK_PRODUCT_IMAGE = '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113';
  const BOTTLE_DETAIL_FEATURE_IMAGE = '/cdn/shop/files/h2-bottle-transparent.png';
  const BOTTLE_DETAIL_FEATURE_SLIDES = [
    { src: '/cdn/shop/files/h2-bottle-product-features-front.png', label: 'Hydrogen water bottle front view' },
    { src: '/cdn/shop/files/h2-bottle-product-features-frontwithbag.png', label: 'Hydrogen water bottle with bag' },
    { src: '/cdn/shop/files/h2-bottle-product-features-bottom.png', label: 'Hydrogen water bottle bottom view' },
    { src: '/cdn/shop/files/h2-bottle-product-features-top.png', label: 'Hydrogen water bottle top view' },
  ];
  const MIST_DETAIL_FEATURE_SLIDES = {
    black: [
      { src: '/cdn/shop/files/products/h2-mist-product-features-front-black 1.png', label: 'Hydrogen mist sprayer black front view' },
      { src: '/cdn/shop/files/products/h2-mist-product-features-side-black-connected-cable 1.png', label: 'Hydrogen mist sprayer black side view with connected cable' },
    ],
    white: [
      { src: '/cdn/shop/files/products/h2-mist-product-features-front-correct-nozzle 1.png', label: 'Hydrogen mist sprayer white front view with correct nozzle' },
      { src: '/cdn/shop/files/products/h2-mist-product-features-side-connected-cable 1.png', label: 'Hydrogen mist sprayer white side view with connected cable' },
    ],
    default: [
      { src: '/cdn/shop/files/h2-mist-product-features-front.png', label: 'Hydrogen mist sprayer front view' },
      { src: '/cdn/shop/files/h2-mist-product-features-top.png', label: 'Hydrogen mist sprayer tank view' },
      { src: '/cdn/shop/files/h2-mist-product-features-chargeport.png', label: 'Hydrogen mist sprayer charge port view' },
      { src: '/cdn/shop/files/h2-mist-product-features-side.png', label: 'Hydrogen mist sprayer side view' },
    ],
  };
  const HOODIE_DETAIL_FEATURE_IMAGE = '/cdn/shop/files/h2-hoodie-product-features.png';




  // Product data is loaded from the merch API; do not duplicate catalog records here.
  const PRODUCTS = [];

  // Presentation-only fallbacks for the storefront card redesign. These are
  // not product/API fields and should be replaced with real catalog metadata.
  const PRODUCT_CARD_PRESENTATION = {
    bottles: { badge: 'BESTSELLER', stars: '★★★★☆', reviews: 128, annotation: 'Molecular Hydrogen on the go' },
    sprays: { badge: 'NEW ARRIVAL', stars: '★★★★★', reviews: 96, annotation: 'Refresh & rejuvenate anywhere' },
    hoodies: { badge: 'LIMITED DROP', stars: '★★★★☆', reviews: 74, annotation: 'Wear the wellness lifestyle' },
  };

  function getProductCardPresentation(product) {
    const category = String(product?.category || '').trim().toLowerCase();
    return PRODUCT_CARD_PRESENTATION[category] || {
      badge: 'NEW ARRIVAL',
      stars: '★★★★☆',
      reviews: 0,
      annotation: 'Made for your everyday ritual',
    };
  }

  // Sidebar content is deliberately data-first so it can later be replaced by
  // GET /api/merch/sidebar without changing the rendering layer.
  const MERCH_SIDEBAR_DEMO_DATA = {
    trending: [
      { key: 'bottle', rating: 5 },
      { key: 'mist', rating: 5 },
      { key: 'hoodie', rating: 5 },
    ],
    bundles: [
      { keys: ['bottle', 'mist'], label: 'Bottle + Mist', savings: 'Save 15%', discount: 0.85 },
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
      { key: 'hoodie' },
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
    return map;
  }, {});

  const HOODIE_CARD_IMAGE = '/cdn/shop/files/hero/h2-hoodie-transparent-source.png';

  function resolveProductImageSource(product) {
    const slug = String(product?.slug || '').trim().toLowerCase();
    const name = String(product?.name || '').trim().toLowerCase();
    const category = String(product?.category || '').trim().toLowerCase();
    const isCombo = Boolean(product?.isCombo);
    const source = isCombo ? null : (
      (!isCombo && slug && PRODUCT_IMAGE_SOURCES[slug]) ||
      (name.includes('water bottle') ? PRODUCT_IMAGE_SOURCES['h2-water-bottle'] : null) ||
      (name.includes('mist') || category === 'sprays' ? PRODUCT_IMAGE_SOURCES['h2-mist-spray'] : null) ||
      null
    );
    const fallbackImages = Array.isArray(source?.images) ? source.images.filter(Boolean) : [];
    const productImageList = Array.isArray(product?.images) ? product.images : (Array.isArray(product?.imageUrls) ? product.imageUrls : []);
    const productImages = productImageList.filter(Boolean).map(normalizeProductImageUrl);
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

  // Variant media is authoritative whenever a specific variant is selected.
  // Keep the primary configured image first so a variant's gallery can never
  // replace it with another colour or an unrelated product image.
  function getVariantImageSources(variant, product = null) {
    const primary = normalizeProductImageUrl(variant?.imageUrl || variant?.image_url || '');
    const gallery = (Array.isArray(variant?.images) ? variant.images : [])
      .map(normalizeProductImageUrl)
      .filter(Boolean);
    const variantSources = [...new Set([primary, ...gallery].filter(Boolean))];
    if (variantSources.length) return variantSources;

    const productSources = (Array.isArray(product?.images) ? product.images : [])
      .map(normalizeProductImageUrl)
      .filter(Boolean);
    const productPrimary = normalizeProductImageUrl(product?.imageUrl || product?.image || '');
    return [...new Set([productPrimary, ...productSources].filter(Boolean))];
  }

  function getVariantImageUrl(variant, product = null) {
    return getVariantImageSources(variant, product)[0] || getProductFallbackImage(product || {});
  }

  function getProductFallbackImage(product) {
    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    if (category === 'sprays' || name.includes('mist') || name.includes('spray')) return '/cdn/shop/files/hero/h2-mist-transparent-source.png';
    if (category === 'bottles' || name.includes('bottle')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113';
    if (category === 'hoodies' || name.includes('hoodie')) return HOODIE_CARD_IMAGE;
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

  function getGalleryVariantFromThumb(product, index) {
    const category = String(product?.category || '').trim().toLowerCase();
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return null;

    if (category === 'hoodies') {
      return variants[index % variants.length] || variants[0] || null;
    }

    return variants[index] || variants[0] || null;
  }

  function isMistProduct(product) {
    const category = String(product?.category || '').trim().toLowerCase();
    const name = String(product?.name || '').trim().toLowerCase();
    return category === 'sprays' || category.includes('mist') || name.includes('mist') || name.includes('spray');
  }

  function isBottleProduct(product) {
    const category = String(product?.category || '').trim().toLowerCase();
    const name = String(product?.name || '').trim().toLowerCase();
    const slug = String(product?.slug || '').trim().toLowerCase();
    return slug === 'molecular-hydrogen-water-bottle' || category === 'bottles' || category.includes('bottle') || name.includes('water bottle');
  }

  function getMistFeatureSlides(variant, product = null) {
    const color = String(variant?.color || '').trim().toLowerCase();
    const featureSlides = MIST_DETAIL_FEATURE_SLIDES[color] || MIST_DETAIL_FEATURE_SLIDES.default;
    const primaryImage = getVariantImageSources(variant, product)[0];
    if (!primaryImage) return featureSlides;
    return [
      { src: primaryImage, label: `${product?.name || 'Hydrogen mist sprayer'} ${variant?.color || ''} product view`.trim() },
      ...featureSlides,
    ];
  }

  function getProductVideoSources(product) {
    const videos = [product?.videoUrl, product?.video_url, ...(Array.isArray(product?.videos) ? product.videos : [])]
      .map((video) => typeof video === 'string' ? video : video?.src || video?.url || '')
      .map(normalizeProductImageUrl)
      .filter(Boolean);
    return [...new Set(videos)];
  }

  function getBottleFeatureSlides(variant, product = null) {
    const variantImages = getVariantImageSources(variant, product);
    const variantGalleryImages = (Array.isArray(variant?.images) ? variant.images : [])
      .map(normalizeProductImageUrl)
      .filter(Boolean);
    if (variantGalleryImages.length) {
      return variantImages.map((src, index) => ({
        src,
        label: `${product?.name || 'Hydrogen water bottle'} ${variant?.color || ''} view ${index + 1}`.trim(),
      }));
    }
    const primaryImage = variantImages[0];
    const featureSlides = BOTTLE_DETAIL_FEATURE_SLIDES.map((slide) => ({ ...slide }));
    return primaryImage
      ? [{ src: primaryImage, label: `${product?.name || 'Hydrogen water bottle'} ${variant?.color || ''} product view`.trim() }, ...featureSlides]
      : featureSlides;
  }

  function getProductGallerySlides(product, variant = state.selectedVariant) {
    const videoSlides = getProductVideoSources(product).map((src, index) => ({
      src,
      type: 'video',
      label: `${product.name} video ${index + 1}`,
      productImageIndex: null,
    }));
    if (isMistProduct(product)) {
      return [
        ...getMistFeatureSlides(variant, product).map((slide) => ({ ...slide, productImageIndex: null })),
        ...videoSlides,
      ];
    }
    if (isBottleProduct(product)) {
      return [
        ...getBottleFeatureSlides(variant, product).map((slide) => ({ ...slide, productImageIndex: null })),
        ...videoSlides,
      ];
    }
    const variantImages = getVariantImageSources(variant, product);
    if (variantImages.length) {
      return variantImages.map((src, index) => ({
        src,
        label: `${product.name} ${variant?.color || ''} view ${index + 1}`.trim(),
        productImageIndex: null,
      }));
    }
    const productImages = (product.images || []).map(normalizeProductImageUrl).filter(Boolean);
    return [...productImages.map((src, productImageIndex) => ({
      src,
      label: `${product.name} view ${productImageIndex + 1}`,
      productImageIndex,
    })), ...videoSlides];
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
      if (normalizedKey === 'hoodie') return name === 'hoodie' || name.includes('hoodie');
      return name.includes(normalizedKey);
    });
    return product || productPool[fallbackIndex % Math.max(1, productPool.length)] || null;
  }

  function getActiveOfferForVariant(productId, variantId) {
    if (!state.offers || !state.offers.length) return null;
    const pId = Number(productId || 0);
    const vId = Number(variantId || 0);
    let offer = state.offers.find((o) => Number(o.variantId) === vId && Number(o.productId) === pId);
    if (!offer && vId) {
      offer = state.offers.find((o) => Number(o.variantId) === vId);
    }
    if (!offer && pId) {
      offer = state.offers.find((o) => Number(o.productId) === pId && (!o.variantId || Number(o.variantId) === 0));
    }
    return offer || null;
  }

  function isRyanAttribution() {
    if (state.merchCouponPreview) {
      const code = String(state.merchCouponPreview.code || '').trim().toUpperCase();
      if (code.startsWith('RYAN')) return true;
      if (Number(state.merchCouponPreview.influencerId || 0) === 10) return true;
      if (String(state.merchCouponPreview.influencerName || '').toLowerCase() === 'ryan') return true;
    }
    if (state.merchCouponCode && normalizeCouponCode(state.merchCouponCode).startsWith('RYAN')) {
      return true;
    }
    const slug = String(state.campaignAttribution?.slug || '').toLowerCase();
    if (slug.startsWith('ryan')) return true;
    if (Number(state.campaignAttribution?.influencerId || 0) === 10) return true;
    return false;
  }

  function countCartBottles(cart = state.cart) {
    return (cart || []).reduce((count, item) => {
      const isBottle = Number(item.productId) === 11 ||
        String(item.category || '').toLowerCase() === 'bottles' ||
        /bottle/i.test(String(item.name || item.productName || ''));
      return isBottle ? count + Math.max(0, Number(item.quantity || 0)) : count;
    }, 0);
  }

  function countCartMists(cart = state.cart) {
    return (cart || []).reduce((count, item) => {
      const isMist = Number(item.productId) === 12 ||
        String(item.category || '').toLowerCase() === 'sprays' ||
        /(mist|spray)/i.test(String(item.name || item.productName || ''));
      return isMist ? count + Math.max(0, Number(item.quantity || 0)) : count;
    }, 0);
  }

  function getCartBundleCount(cart = state.cart) {
    const bottles = countCartBottles(cart);
    const mists = countCartMists(cart);
    return Math.min(bottles, mists);
  }

  function getCartIndividualBottleCount(cart = state.cart) {
    const bottles = countCartBottles(cart);
    const bundleCount = getCartBundleCount(cart);
    return Math.max(0, bottles - bundleCount);
  }

  function isInfluencerCoupon(coupon) {
    if (!coupon) return false;
    const infId = Number(coupon.influencerId || coupon.influencer_id || coupon.coupon?.influencerId || coupon.coupon?.influencer_id || 0);
    if (infId > 0) return true;
    if (coupon.influencerName || coupon.influencerHandle || coupon.influencer) return true;
    if (String(coupon.couponType || '').toLowerCase() === 'influencer') return true;
    if (state.campaignAttribution?.couponCode && normalizeCouponCode(coupon.code) === normalizeCouponCode(state.campaignAttribution.couponCode)) return true;
    return false;
  }

  function hasActiveInfluencerCoupon() {
    if (isRyanAttribution()) return true;
    if (state.merchCouponPreview && Number(state.merchCouponPreview.discountAmountInr || 0) > 0) {
      if (isInfluencerCoupon(state.merchCouponPreview)) return true;
      const matching = (state.availableCoupons || []).find((c) => normalizeCouponCode(c.code) === normalizeCouponCode(state.merchCouponPreview.code));
      if (matching && isInfluencerCoupon(matching)) return true;
      if (state.campaignAttribution?.slug || state.campaignAttribution?.influencerId) return true;
    }
    return false;
  }

  function hasActiveInfluencerCampaign() {
    return Boolean(
      hasActiveInfluencerCoupon() ||
      (state.campaignAttribution?.slug && state.merchCouponPreview && Number(state.merchCouponPreview.discountAmountInr || 0) > 0)
    );
  }

  function getVariantOfferDetails(variant, product = state.selectedProduct) {
    if (!variant) return null;
    if (hasActiveInfluencerCampaign()) return null;
    if (variant.offer && variant.offer.offerPrice !== undefined) {
      return variant.offer;
    }
    const productId = Number(product?.id || variant.productId || variant.product_id || 0);
    const variantId = Number(variant.id || variant.variantId || 0);
    const offer = getActiveOfferForVariant(productId, variantId);
    if (!offer) return null;

    const originalPrice = Number(variant.price || 0);
    if (originalPrice <= 0) return null;

    const discountValue = Number(offer.discountValue || 0);
    const isPercentage = String(offer.discountType || '').toLowerCase() === 'percentage';
    const discountAmount = isPercentage
      ? Math.round(originalPrice * discountValue / 100)
      : Math.round(discountValue / 100);
    const offerPrice = Math.max(0, originalPrice - discountAmount);
    const savings = Math.max(0, originalPrice - offerPrice);
    const discountLabel = isPercentage
      ? `${discountValue}% OFF`
      : `${formatPrice(discountAmount)} OFF`;

    return {
      id: offer.id,
      name: offer.name || '',
      discountType: offer.discountType,
      discountValue,
      discountLabel,
      originalPrice,
      offerPrice,
      savings,
      shortDescription: offer.shortDescription || '',
      terms: offer.terms || '',
    };
  }

  function refreshCartPrices() {
    if (!state.cart || !state.cart.length || !state.products || !state.products.length) return;
    let changed = false;
    state.cart.forEach((item) => {
      const product = state.products.find((p) => Number(p.id) === Number(item.productId));
      if (!product) return;
      const variant = product.variants.find((v) => Number(v.id) === Number(item.variantId));
      if (!variant) return;
      const offerInfo = getVariantOfferDetails(variant, product);
      const effectivePrice = offerInfo ? offerInfo.offerPrice : variant.price;
      if (item.price !== effectivePrice) {
        item.price = effectivePrice;
        item.originalPrice = offerInfo ? offerInfo.originalPrice : null;
        item.discountLabel = offerInfo ? offerInfo.discountLabel : null;
        item.offerName = offerInfo ? offerInfo.name : null;
        changed = true;
      }
    });
    if (changed) {
      saveCart();
      renderCart();
    }
  }

  function getSmartSidebarData() {
    const trending = Array.isArray(state.trendingProducts)
      ? state.trendingProducts.map((product) => ({ product, hypeLabel: product.hypeLabel }))
      : [];
    const recommended = MERCH_SIDEBAR_DEMO_DATA.recommended
      .map((entry, index) => ({ ...entry, product: findSidebarProduct(entry.key, index) }))
      .filter((entry) => entry.product);
    const bundles = MERCH_SIDEBAR_DEMO_DATA.bundles.map((bundle) => {
      const products = bundle.keys.map((key, index) => findSidebarProduct(key, index)).filter(Boolean);
      const basePrice = products.reduce((total, product) => total + Number(getDefaultPurchasableVariant(product)?.price || product.basePrice || 0), 0);
      return {
        ...bundle,
        products,
        label: products.map((product) => product.name).join(' + ') || bundle.label,
        price: basePrice * Number(bundle.discount || 1),
        available: products.length === bundle.keys.length && products.every((product) => {
          const variant = getDefaultPurchasableVariant(product);
          return Boolean(variant && Number(variant.stock || 0) > 0);
        }),
      };
    }).filter((bundle) => bundle.products.length);
    return {
      trending,
      bundles,
      benefits: MERCH_SIDEBAR_DEMO_DATA.benefits,
      recommended,
    };
  }

  function renderSidebarProduct(item) {
    const product = item.product;
    const variant = getDefaultPurchasableVariant(product);
    const image = variant ? getVariantImageUrl(variant, product) : (product.images?.[0] || product.imageUrl || getProductFallbackImage(product));
    return `
      <button class="smart-merch-product" type="button" data-sidebar-product-id="${escapeHtml(String(product.id))}" aria-label="View ${escapeHtml(product.name)}">
        <img src="${escapeHtml(image)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
        <span class="smart-merch-product__info">
          <strong>${escapeHtml(product.name)}</strong>
          ${item.hypeLabel ? `<span class="smart-merch-product__hype">${escapeHtml(item.hypeLabel)}</span>` : ''}
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
      ${data.trending.length ? `<section class="smart-merch-sidebar__section smart-merch-sidebar__section--trending" aria-labelledby="smartTrendingTitle">
        <div class="smart-merch-sidebar__heading">
          <h3 id="smartTrendingTitle">🔥 Trending Products</h3>
          <button type="button" class="smart-merch-sidebar__view-all" data-sidebar-action="view-all">View All <span aria-hidden="true">→</span></button>
        </div>
        <div class="smart-merch-product-list">${data.trending.map(renderSidebarProduct).join('')}</div>
      </section>` : ''}

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
                <img src="${escapeHtml((getDefaultPurchasableVariant(product) && getVariantImageUrl(getDefaultPurchasableVariant(product), product)) || product.images?.[0] || product.imageUrl || getProductFallbackImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
              `).join('')}
            </div>
            <strong>${escapeHtml(bundle.label)}</strong>
            <span class="smart-merch-bundle__savings">${escapeHtml(bundle.savings)}</span>
            <strong class="smart-merch-bundle__price">${escapeHtml(formatPrice(bundle.price))}</strong>
            <button type="button" class="btn btn-primary smart-merch-sidebar__cta" data-sidebar-action="shop-bundle" ${bundle.available ? '' : 'disabled'}>${bundle.available ? 'Shop Bundle' : 'Currently Unavailable'}</button>
            </div>
          `).join('')}
        </div>
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
    els.smartMerchSidebar.querySelectorAll('[data-sidebar-action="view-all"]').forEach((button) => {
      button.addEventListener('click', () => els.shopSection?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    });
    els.smartMerchSidebar.querySelectorAll('[data-sidebar-action="shop-bundle"]').forEach((button) => {
      button.addEventListener('click', () => addMerchBundleToCart());
    });
  }

  function getDefaultPurchasableVariant(product) {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    return variants.find((variant) => Number(variant?.stock || 0) > 0) || variants[0] || null;
  }

  function getMerchBundleDefinition() {
    const bundle = MERCH_SIDEBAR_DEMO_DATA.bundles[0];
    const products = bundle.keys.map((key, index) => findSidebarProduct(key, index)).filter(Boolean);
    return {
      ...bundle,
      products,
      available: products.length === bundle.keys.length && products.every((product) => {
        const variant = getDefaultPurchasableVariant(product);
        return Boolean(variant && Number(variant.stock || 0) > 0);
      }),
    };
  }

  function getMerchBundleDiscountAmount() {
    const isRyan = isRyanAttribution();
    if (hasActiveInfluencerCoupon() && !isRyan) {
      return 0;
    }
    const bundleQty = getCartBundleCount();
    if (bundleQty > 0) {
      // 15% off ₹34,890 bundle = ₹5,233.50 per bundle
      return bundleQty * 5233.5;
    }
    const activeBundle = getActiveBundleInfo();
    if (!activeBundle) {
      if (state.merchBundleCode === 'H2BUNDLE15' && !isRyan) {
        clearMerchBundleDiscount();
      }
      return 0;
    }
    const bottleUnitPrice = Number(activeBundle.bottleItem.price || 0);
    const mistUnitPrice = Number(activeBundle.mistItem.price || 0);
    const bundleUnitPrice = bottleUnitPrice + mistUnitPrice;
    const bundleOfferPrice = Math.round(bundleUnitPrice * 0.85);
    const singleBundleDiscount = Math.max(0, bundleUnitPrice - bundleOfferPrice);
    return singleBundleDiscount * Number(activeBundle.bundleQty || 1);
  }

  function getActiveBundleInfo() {
    const bundleDef = getMerchBundleDefinition();
    if (!bundleDef || !bundleDef.products || bundleDef.products.length !== 2) return null;
    const bottleProduct = bundleDef.products[0];
    const mistProduct = bundleDef.products[1];
    const bottleItem = state.cart.find((item) => Boolean(item.isBundle) && Number(item.productId) === Number(bottleProduct.id));
    const mistItem = state.cart.find((item) => Boolean(item.isBundle) && Number(item.productId) === Number(mistProduct.id));
    if (!bottleItem || !mistItem) return null;
    const bundleQty = Math.min(Number(bottleItem.quantity || 1), Number(mistItem.quantity || 1));
    if (bundleQty <= 0) return null;
    return {
      bundleDef,
      bottleProduct,
      mistProduct,
      bottleItem,
      mistItem,
      bundleQty,
    };
  }

  function getMerchBundleCartItems() {
    const bundle = getMerchBundleDefinition();
    if (!bundle.available) return [];
    return bundle.products.map((product) => ({
      product,
      variant: getDefaultPurchasableVariant(product),
    }));
  }

  function clearMerchBundleDiscount() {
    state.merchBundleCode = '';
    state.merchBundlePreview = null;
    try {
      localStorage.removeItem(getBundleStorageKey(state.cartOwnerId));
      localStorage.removeItem('merch_bundle_code');
    } catch {}
  }

  async function addMerchBundleToCart() {
    const bundleItems = getMerchBundleCartItems();
    if (bundleItems.length !== 2) {
      showCheckoutNotice('Bundle unavailable', 'The H2 Hydrogen Bottle and H2 Hydrogen Mist Spray must both be in stock.', { variant: 'error' });
      renderSmartMerchSidebar();
      return;
    }

    bundleItems.forEach(({ product, variant }) => addToCart(variant.id, 1, product, { isBundle: true, openDrawerAfterAdd: false, preserveCoupon: true }));
    state.merchBundleCode = 'H2BUNDLE15';
    try {
      localStorage.setItem(getBundleStorageKey(state.cartOwnerId), state.merchBundleCode);
    } catch {}

    const hasInfluencer = hasActiveInfluencerCoupon();
    const isRyan = isRyanAttribution();
    if (!hasInfluencer || isRyan) {
      const bundleTotal = bundleItems.reduce((sum, item) => sum + Number(item.variant.price || 0), 0);
      const bundleOffer = Math.round(bundleTotal * 0.85);
      state.merchBundlePreview = {
        code: state.merchBundleCode,
        description: 'Bundle & Save — 15% off Bottle + Mist',
        discountAmountInr: Math.max(0, bundleTotal - bundleOffer),
      };
    } else {
      state.merchBundlePreview = null;
    }
    if (!state.merchCouponCode && state.campaignAttribution?.couponCode) {
      state.merchCouponCode = state.campaignAttribution.couponCode;
    }
    if (state.merchCouponCode || state.campaignAttribution?.slug) {
      await applyMerchCouponFromCart({ silent: true });
    }
    renderCart();
    showCheckoutNotice('Added to Cart', hasInfluencer
      ? 'H2 Hydrogen Bottle and H2 Hydrogen Mist Spray were added to cart.'
      : 'H2 Hydrogen Bottle and H2 Hydrogen Mist Spray were added with 15% bundle savings.');
    openCart();
  }

  function getVariantLabel(variant) {
    return [variant?.size, variant?.color].filter(Boolean).join(' / ') || 'Default variant';
  }

  function isHoodieProduct(product) {
    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    return category === 'hoodies' || category.includes('hoodie') || name.includes('hoodie');
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
    if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
    return normalized === 'processing' ? 'processing' : normalized;
  }

  function getTrackingSteps(order) {
    const status = normalizeTrackingStatus(order?.status);
    const createdAt = order?.createdAt || null;
    const updatedAt = order?.updatedAt || createdAt;
    const backendTimeline = Array.isArray(order?.timeline) ? order.timeline : [];
    const timelineTime = (label) => {
      const match = backendTimeline.find((entry) => String(entry?.label || '').toLowerCase().includes(label));
      return match?.time || null;
    };

    // When an order is cancelled, show an Amazon-style cancellation flow:
    // Order Placed -> (Optional: Packed if previously packed) -> Order Cancelled
    // Do NOT show remaining forward delivery steps (Packed, Shipped, Out for Delivery, Delivered)
    if (status === 'cancelled') {
      const cancelledBy = String(order?.cancelledBy || order?.cancelled_by || '').toLowerCase();
      let cancelledNote = 'Order Cancelled';
      if (cancelledBy === 'customer') {
        cancelledNote = 'Cancelled by you';
      } else if (cancelledBy === 'admin' || cancelledBy === 'seller' || cancelledBy === 'merchant') {
        cancelledNote = 'Cancelled by seller';
      } else {
        const cancelEntry = backendTimeline.find((e) => String(e?.label || '').toLowerCase().includes('cancel'));
        if (cancelEntry?.note) {
          if (cancelEntry.note.toLowerCase().includes('customer')) {
            cancelledNote = 'Cancelled by you';
          } else if (cancelEntry.note.toLowerCase().includes('admin') || cancelEntry.note.toLowerCase().includes('seller') || cancelEntry.note.toLowerCase().includes('merchant')) {
            cancelledNote = 'Cancelled by seller';
          } else {
            cancelledNote = cancelEntry.note;
          }
        } else {
          cancelledNote = 'Cancelled';
        }
      }

      const cancelTime = order?.cancelledAt || order?.cancelled_at || timelineTime('cancel') || updatedAt;

      const steps = [
        {
          label: 'Order Placed',
          time: createdAt,
          isComplete: true,
          isCurrent: false,
          isCancelled: false,
          note: '',
        },
      ];

      const packTime = timelineTime('pack');
      if (packTime) {
        steps.push({
          label: 'Packed',
          time: packTime,
          isComplete: true,
          isCurrent: false,
          isCancelled: false,
          note: '',
        });
      }

      steps.push({
        label: 'Order Cancelled',
        time: cancelTime,
        isComplete: true,
        isCurrent: true,
        isCancelled: true,
        note: cancelledNote,
      });

      return steps;
    }

    const statusOrder = ['processing', 'packed', 'shipped', 'out_for_delivery', 'delivered'];
    const labels = ['Order Placed', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];
    const currentIndex = Math.max(0, statusOrder.indexOf(status));
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
      isCancelled: false,
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
      trackingNumber: confirmation.trackingNumber || '',
      carrier: confirmation.carrierName || confirmation.carrier || '',
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
    const isCancelled = String(order?.status || '').toLowerCase() === 'cancelled';
    return `
      <div class="tracking-timeline${isCancelled ? ' is-cancelled-flow' : ''}" aria-label="Order tracking timeline">
        ${getTrackingSteps(order).map((step) => `
          <article class="tracking-step${step.isComplete ? ' is-complete' : ''}${step.isCurrent ? ' is-current' : ''}${step.isCancelled ? ' is-cancelled' : ''}">
            <div class="tracking-step__marker" aria-hidden="true">${step.isCancelled ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>' : (step.isComplete ? confirmationIcon('check') : '')}</div>
            <div class="tracking-step__body">
              <h3>${escapeHtml(step.label)}</h3>
              <p>${escapeHtml(formatTrackingDateTime(step.time))}</p>
              ${step.note ? `<small class="${step.isCancelled ? 'tracking-step__cancelled-note' : ''}">${escapeHtml(step.note)}</small>` : ''}
            </div>
          </article>
        `).join('')}
      </div>
    `;
  }

  function OrderTrackingPage(order) {
    const trackingBackButton = isAdminTrackingRequest()
      ? ''
      : '<button class="tracking-back-btn" type="button" data-tracking-action="back">&larr; Back</button>';
    if (!order) {
      return `
        <div class="order-tracking__inner">
          ${trackingBackButton}
          <div class="tracking-empty">
            <h1 id="orderTrackingTitle">Order tracking</h1>
            <p>We could not find this merchandise order in your account yet.</p>
          </div>
        </div>
      `;
    }

    const product = getTrackingProductSummary(order);
    const isCancelled = String(order.status || '').toLowerCase() === 'cancelled';
    const statusLabel = isCancelled ? 'Cancelled' : formatOrderStatus(order.status || 'processing');
    return `
      <div class="order-tracking__inner">
        ${trackingBackButton}
        <article class="tracking-card">
          <header class="tracking-product">
            <img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" onerror="this.src='${FALLBACK_PRODUCT_IMAGE}'" />
            <div class="tracking-product__meta">
              <h1 id="orderTrackingTitle">${escapeHtml(product.name)}</h1>
              <p>${escapeHtml([product.variantLabel, `Qty: ${product.quantity}`].filter(Boolean).join(' - '))}</p>
              ${product.extraCount ? `<small>+${product.extraCount} more item${product.extraCount > 1 ? 's' : ''}</small>` : ''}
            </div>
            <span class="tracking-status-badge ${isCancelled ? 'tracking-status-badge--cancelled' : ''}">${escapeHtml(statusLabel)}</span>
          </header>
          ${renderTrackingTimeline(order)}
          <footer class="tracking-details">
            <div>
              <span>Order ID</span>
              <strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong>
            </div>
            <div>
              <span>Courier / AWB</span>
              <strong>${isCancelled ? 'Order Cancelled' : (order.trackingNumber ? `${escapeHtml(order.trackingNumber)}${order.carrier ? ` (${escapeHtml(order.carrier)})` : ''}` : (order.status === 'delivered' ? 'Delivered' : 'Processing'))}</strong>
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

  const CHECKOUT_PHONE_COUNTRY_CODES = [
    { value: '+91', label: 'India (+91)' },
    { value: '+1', label: 'US / Canada (+1)' },
    { value: '+44', label: 'United Kingdom (+44)' },
    { value: '+971', label: 'UAE (+971)' },
    { value: '+65', label: 'Singapore (+65)' },
    { value: '+61', label: 'Australia (+61)' },
  ];

  const CHECKOUT_COUNTRIES = [
    'India',
    'United States',
    'United Kingdom',
    'Canada',
    'Australia',
    'United Arab Emirates',
    'Singapore',
  ];

  const CHECKOUT_REGIONS_BY_COUNTRY = {
    India: ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Delhi', 'Kerala', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal'],
    'United States': ['Alabama', 'Alaska', 'Arizona', 'California', 'Colorado', 'Florida', 'Georgia', 'Illinois', 'New Jersey', 'New York', 'North Carolina', 'Ohio', 'Pennsylvania', 'Texas', 'Virginia', 'Washington'],
    'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland', 'Greater London'],
    Canada: ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Ontario', 'Quebec'],
    Australia: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia', 'South Australia'],
    'United Arab Emirates': ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman'],
    Singapore: ['Central Community Development Council', 'North East', 'North West', 'South East', 'South West'],
  };

  function normalizeCheckoutCountry(value = '') {
    const normalized = String(value || '').trim();
    if (/^(us|usa|u\.s\.a\.|united states|united states of america)$/i.test(normalized)) return 'United States';
    if (/^(uk|u\.k\.|united kingdom|great britain|england)$/i.test(normalized)) return 'United Kingdom';
    if (/^(ca|canada)$/i.test(normalized)) return 'Canada';
    if (/^(au|australia)$/i.test(normalized)) return 'Australia';
    if (/^(ae|uae|united arab emirates)$/i.test(normalized)) return 'United Arab Emirates';
    if (/^(sg|singapore)$/i.test(normalized)) return 'Singapore';
    if (/^(in|india)$/i.test(normalized)) return 'India';
    return CHECKOUT_COUNTRIES.includes(normalized) ? normalized : (normalized || 'India');
  }

  function getCheckoutRegionOptions(country = 'India') {
    return CHECKOUT_REGIONS_BY_COUNTRY[normalizeCheckoutCountry(country)] || CHECKOUT_REGIONS_BY_COUNTRY.India;
  }

  function isValidPostalCode(value, country = 'India') {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    const norm = normalizeCheckoutCountry(country);
    if (norm === 'United States') {
      return /^\d{5}(?:-\d{4})?$/.test(trimmed);
    }
    if (norm === 'United Kingdom') {
      return /^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(trimmed);
    }
    if (norm === 'Canada') {
      return /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test(trimmed);
    }
    if (norm === 'India') {
      return /^\d{6}$/.test(trimmed);
    }
    return /^[A-Za-z0-9\s-]{3,10}$/.test(trimmed);
  }

  function getPostalCodeErrorMessage(country = 'India') {
    const norm = normalizeCheckoutCountry(country);
    if (norm === 'United States') return 'Enter a valid 5-digit ZIP code (e.g. 90210).';
    if (norm === 'United Kingdom') return 'Enter a valid UK postcode (e.g. SW1A 1AA).';
    if (norm === 'Canada') return 'Enter a valid Canadian postal code (e.g. K1A 0B1).';
    if (norm === 'India') return 'Enter a 6-digit PIN code.';
    return 'Enter a valid postal code.';
  }

  function isValidPhoneNumber(phone, countryCode = '+91') {
    if (!phone || typeof phone !== 'string') return false;
    const trimmed = phone.trim();
    if (!trimmed) return false;
    if (/[^\d\s+\-]/.test(trimmed)) return false;

    if (trimmed.startsWith('+')) {
      const digits = trimmed.slice(1).replace(/[\s\-]/g, '');
      if (trimmed.startsWith('+91')) return /^\d{10}$/.test(digits.slice(2));
      if (trimmed.startsWith('+1')) return /^\d{10}$/.test(digits.slice(1));
      if (trimmed.startsWith('+44')) {
        const local = digits.slice(2).replace(/^0/, '');
        return /^\d{9,10}$/.test(local);
      }
      return digits.length >= 7 && digits.length <= 15;
    }

    const digits = trimmed.replace(/[\s\-]/g, '');
    const code = String(countryCode || '+91').trim();

    if (code === '+1') {
      const local = (digits.length === 11 && digits.startsWith('1')) ? digits.slice(1) : digits;
      return /^\d{10}$/.test(local);
    }
    if (code === '+44') {
      let local = digits.startsWith('44') ? digits.slice(2) : digits;
      if (local.startsWith('0')) local = local.slice(1);
      return /^\d{9,10}$/.test(local);
    }
    if (code === '+91') {
      const local = (digits.length === 12 && digits.startsWith('91')) ? digits.slice(2) : digits;
      return /^\d{10}$/.test(local);
    }

    return digits.length >= 7 && digits.length <= 15;
  }

  function getPhoneErrorMessage(countryCode = '+91') {
    const code = String(countryCode || '+91').trim();
    if (code === '+91') return 'Enter a valid 10-digit mobile number for India.';
    if (code === '+1') return 'Enter a valid 10-digit mobile number for US/Canada.';
    if (code === '+44') return 'Enter a valid UK mobile number.';
    return 'Enter a valid mobile number with country code.';
  }

  function formatE164Phone(phone = '', countryCode = '+91') {
    const trimmed = String(phone || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('+')) {
      const digits = trimmed.slice(1).replace(/\D+/g, '');
      if (digits.startsWith('440')) {
        return `+44${digits.slice(3)}`;
      }
      return `+${digits}`;
    }
    let digits = trimmed.replace(/\D+/g, '');
    const prefix = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    if (prefix === '+44' && digits.startsWith('0')) {
      digits = digits.slice(1);
    } else if (prefix === '+91' && digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (prefix === '+1' && digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }
    return `${prefix}${digits}`;
  }

  function parseCheckoutPhone(value = '') {
    const raw = String(value || '').trim();
    if (raw.startsWith('+')) {
      if (raw.startsWith('+91')) {
        return { countryCode: '+91', localNumber: raw.slice(3).replace(/\D+/g, '') };
      }
      if (raw.startsWith('+44')) {
        return { countryCode: '+44', localNumber: raw.slice(3).replace(/\D+/g, '') };
      }
      if (raw.startsWith('+971')) {
        return { countryCode: '+971', localNumber: raw.slice(4).replace(/\D+/g, '') };
      }
      if (raw.startsWith('+65')) {
        return { countryCode: '+65', localNumber: raw.slice(3).replace(/\D+/g, '') };
      }
      if (raw.startsWith('+61')) {
        return { countryCode: '+61', localNumber: raw.slice(3).replace(/\D+/g, '') };
      }
      if (raw.startsWith('+1')) {
        return { countryCode: '+1', localNumber: raw.slice(2).replace(/\D+/g, '') };
      }
      const match = raw.match(/^\+(\d{1,4})(\d+)$/);
      if (match) {
        return { countryCode: `+${match[1]}`, localNumber: match[2] };
      }
    }
    const digits = raw.replace(/\D+/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return { countryCode: '+91', localNumber: digits.slice(2) };
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return { countryCode: '+1', localNumber: digits.slice(1) };
    }
    if ((digits.length === 12 || digits.length === 11) && digits.startsWith('44')) {
      return { countryCode: '+44', localNumber: digits.slice(2) };
    }
    return { countryCode: '+91', localNumber: digits };
  }

  function getCheckoutPhonePayload(draft = {}) {
    const countryCode = CHECKOUT_PHONE_COUNTRY_CODES.some((option) => option.value === draft.phoneCountryCode)
      ? draft.phoneCountryCode
      : (draft.phoneCountryCode || '+91');
    return formatE164Phone(draft.phone, countryCode);
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
    const product = state.products.find(
        (entry) => Number(entry.id) === Number(item.productId)
    );

    return (
        product?.name ||
        item.productName ||
        `Saved item #${item.productId || item.id || ''}`
    ).trim();
}

function getWishlistProductVariant(item) {
    const product = state.products.find(
        (entry) => Number(entry.id) === Number(item.productId)
    );

    const variants = Array.isArray(product?.variants)
        ? product.variants
        : [];

    const variant = variants.find(
        (entry) => Number(entry.id) === Number(item.variantId)
    );

    if (!variant) return '';

    const details = [
        variant.size,
        variant.color
    ].filter(Boolean);

    return details.join(' / ');
}

function getWishlistProductPrice(item) {
    const product = state.products.find(
        (entry) => Number(entry.id) === Number(item.productId)
    );

    const variants = Array.isArray(product?.variants)
        ? product.variants
        : [];

    const variant = variants.find(
        (entry) => Number(entry.id) === Number(item.variantId)
    );

    const price = Number(
        variant?.price ??
        product?.price ??
        product?.basePrice ??
        product?.base_price ??
        0
    );

    if (!price) return '';

    return `₹${price.toLocaleString('en-IN')}`;
}

  function getWishlistProductImage(item) {
  const product = state.products.find(
    (entry) => Number(entry.id) === Number(item.productId)
  );
  const variant = product?.variants?.find(
    (entry) => Number(entry.id) === Number(item.variantId)
  );

  return variant
    ? getVariantImageUrl(variant, product)
    : (product?.images?.[0] || product?.imageUrl || (product ? getProductFallbackImage(product) : ''));
}

  function getWishlistItem(product, variant) {
    const productId = Number(product?.id || 0);
    const variantId = Number(variant?.id || 0);
    return state.merchWishlistItems.find((item) => (
      Number(item.productId || 0) === productId
      && Number(item.variantId || 0) === variantId
    )) || null;
  }

  function isProductWishlisted(product, variant) {
    return Boolean(getWishlistItem(product, variant));
  }

  function syncWishlistControls() {
    document.querySelectorAll('.product-card__wishlist').forEach((button) => {
      const product = state.products.find((item) => Number(item.id) === Number(button.closest('.product-card')?.dataset.productId));
      const variant = product ? getDefaultPurchasableVariant(product) : null;
      const selected = product && variant ? isProductWishlisted(product, variant) : false;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `${selected ? 'Remove' : 'Add'} ${product?.name || 'product'} ${selected ? 'from' : 'to'} wishlist`);
    });

    const detailButton = document.getElementById('addToWishlistBtn');
    if (detailButton && state.selectedProduct && state.selectedVariant) {
      const selected = isProductWishlisted(state.selectedProduct, state.selectedVariant);
      detailButton.classList.toggle('is-selected', selected);
      detailButton.setAttribute('aria-pressed', String(selected));
      detailButton.textContent = selected ? '♥ Wishlisted' : '♡ Wishlist';
    }
  }

  async function handleWishlistAction(button, product, variant) {
    if (!product || !variant || button?.dataset.wishlistPending === 'true') return;
    if (button) button.dataset.wishlistPending = 'true';
    try {
      await addToWishlist(product, variant);
      syncWishlistControls();
      if (state.accountDrawerOpen) renderAccountDrawer();
    } finally {
      if (button) delete button.dataset.wishlistPending;
    }
  }

  async function addToWishlist(product, variant) {
    if (!state.authResolved) {
      await loadCustomerContext();
    }
    const productId = Number(product?.id || 0) || null;
    const variantId = Number(variant?.id || 0) || null;
    if (!productId && !variantId) return;

    const alreadySaved = state.merchWishlistItems.find((item) => (
      Number(item.productId || 0) === Number(productId || 0)
      && Number(item.variantId || 0) === Number(variantId || 0)
    ));
    if (alreadySaved) {
      await removeWishlistItem(alreadySaved);
      renderWishlistBadge();
      showCheckoutNotice('Wishlist', `${product.name} was removed from your wishlist.`);
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

      renderWishlistBadge();
      showCheckoutNotice('Wishlist', `${product.name} was added to your wishlist.`);
      syncWishlistControls();
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

  function getAuthenticatedCheckoutCustomer(address = null) {
    const profile = state.merchProfile || {};
    const user = state.currentUser || {};
    const rawEmail = String(profile.email || user.email || '').trim();
    const isReal = hasRealEmail(rawEmail);
    return {
      // Guest checkout must start empty; only signed-in users get profile autofill.
      name: state.currentUser ? String(profile.fullName || user.name || address?.recipientName || '').trim() : '',
      email: state.currentUser && isReal ? rawEmail : '',
      phone: state.currentUser ? String(profile.mobile || user.mobile || address?.phone || '').trim() : '',
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
      offer: variant?.offer ? {
        id: variant.offer.id,
        name: variant.offer.name,
        discountType: variant.offer.discountType,
        discountValue: Number(variant.offer.discountValue || 0),
        discountLabel: variant.offer.discountLabel,
        originalPrice: normalizeCatalogAmount(variant.offer.originalPrice || variant.price),
        offerPrice: normalizeCatalogAmount(variant.offer.offerPrice),
        savings: normalizeCatalogAmount(variant.offer.savings),
      } : null,
      imageUrl: normalizeProductImageUrl(variant?.imageUrl || variant?.image_url || ''),
      images: Array.isArray(variant?.images)
        ? variant.images.map(normalizeProductImageUrl).filter(Boolean)
        : [],
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

  function renderReplacementPolicyAccordion(product = null) {
    const isHoodie = product ? isHoodieProduct(product) : false;
    const warrantyHtml = isHoodie ? '' : `
            <h3>6-Month Parts Warranty</h3>
            <p>Replacement of eligible mechanical and electronic product parts is covered by a 6-month parts warranty.</p>
    `;
    const bottleDisclaimerHtml = (product && !isHoodie) ? `
            <div style="margin-top:10px;padding:8px 10px;background:#fff8f5;border-left:3px solid #ae5431;border-radius:4px;font-size:12px;color:#4b5563;line-height:1.45;">
              <strong style="color:#111;">Bottle Color Disclaimer:</strong> The color of the bottle may vary depending on availability. Customers may receive the bottle in any available color, and a specific color cannot be guaranteed. Product images are for illustrative purposes only.
            </div>
    ` : '';
    return `
      <div class="replacement-policy-accordion">
        <button class="replacement-policy-accordion__button" id="replacementPolicyButton" type="button" aria-expanded="false" aria-controls="replacementPolicyContent">
          <span class="replacement-policy-accordion__heading">
            <svg class="replacement-policy-accordion__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11a8.1 8.1 0 0 0-14.4-4.8L4 8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 4v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 13a8.1 8.1 0 0 0 14.4 4.8L20 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M20 20v-4h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>${isHoodie ? '7-Day Return Policy (Shipment Damage)' : '7-Day Return &amp; 6-Month Parts Warranty'}</span>
          </span>
          <span class="replacement-policy-accordion__toggle" aria-hidden="true">+</span>
        </button>
        <div class="replacement-policy-accordion__content" id="replacementPolicyContent" aria-hidden="true">
          <div class="replacement-policy-accordion__body">
            <p><strong>7-Day Return:</strong> A product can be returned within 7 days of delivery only if it arrives damaged or is not working due to a shipment/transport issue. This is not a general return policy and does not apply to change of mind.</p>
            ${warrantyHtml}
            ${bottleDisclaimerHtml}
            <p><a href="/refund/" target="_blank" style="color:#ae5431;text-decoration:underline;font-weight:600;">View full return &amp; warranty policy &rarr;</a></p>
          </div>
        </div>
      </div>
    `;
  }

  function syncCartVariantImages() {
    state.cart = state.cart.map((item) => {
      const product = state.products.find((entry) => Number(entry.id) === Number(item.productId));
      const variant = product?.variants?.find((entry) => Number(entry.id) === Number(item.variantId));
      if (!product || !variant) return item;
      return {
        ...item,
        productName: product.name,
        variantLabel: getVariantLabel(variant),
        price: variant.price,
        image: getVariantImageUrl(variant, product),
        sku: variant.sku,
      };
    });
    saveCart();
  }

  async function loadMerchProducts() {
    try {
      const result = await api('/api/merch/products');
      const productRows = Array.isArray(result) ? result : (Array.isArray(result?.products) ? result.products : []);
      state.products = productRows.map(normalizeMerchProduct);
      syncCartVariantImages();
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

  async function loadTrendingProducts() {
    try {
      const result = await api('/api/merch/trending-products');
      state.trendingProducts = Array.isArray(result) ? result.map(normalizeMerchProduct) : [];
    } catch (error) {
      state.trendingProducts = [];
      console.error('Unable to load top trending products:', error);
    }
    renderSmartMerchSidebar();
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
    wishlistToggleBtn: document.getElementById('wishlistToggleBtn'),
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
    wishlistBadge: document.getElementById('wishlistBadge'),
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
    checkoutAddProductsDrawer: document.getElementById('checkoutAddProductsDrawer'),
    checkoutAddProductsOverlay: document.getElementById('checkoutAddProductsOverlay'),
    checkoutAddProductsCloseBtn: document.getElementById('checkoutAddProductsCloseBtn'),
    checkoutAddProductsList: document.getElementById('checkoutAddProductsList'),
  };

  // ─── Cart (Account-Isolated Storage & Backend Sync) ───
  function getCartStorageKey(userId = state.cartOwnerId) {
    return userId ? `merch_cart_user_${userId}` : 'merch_cart_guest';
  }

  function getBundleStorageKey(userId = state.cartOwnerId) {
    return userId ? `merch_bundle_user_${userId}` : 'merch_bundle_guest';
  }

  function getCouponStorageKey(userId = state.cartOwnerId) {
    return userId ? `merch_coupon_user_${userId}` : 'merch_coupon_guest';
  }

  function cleanupLegacySharedCartStorage() {
    try {
      localStorage.removeItem('merch_cart');
      localStorage.removeItem('merch_bundle_code');
    } catch {}
  }

  function loadCart(user = state.currentUser) {
    cleanupLegacySharedCartStorage();
    const targetUserId = user?.id || null;
    state.cartOwnerId = targetUserId;
    try {
      const key = getCartStorageKey(targetUserId);
      const saved = localStorage.getItem(key);
      state.cart = saved ? JSON.parse(saved) : [];
      if (Array.isArray(state.cart)) {
        state.cart = state.cart.map(item => ({
          ...item,
          isBundle: Boolean(item.isBundle),
          source: item.source || (item.isBundle ? 'bundle' : 'individual'),
        }));
      }
      const bundleKey = getBundleStorageKey(targetUserId);
      state.merchBundleCode = localStorage.getItem(bundleKey) || '';
      const couponKey = getCouponStorageKey(targetUserId);
      state.merchCouponCode = localStorage.getItem(couponKey) || '';
    } catch {
      state.cart = [];
      state.merchBundleCode = '';
      state.merchCouponCode = '';
    }
    renderCartBadge();
    if (state.cartDrawerOpen) {
      renderCart();
    }
  }

  let cartSyncTimeout = null;
  function syncCartToBackend(items) {
    if (!state.currentUser?.id) return;
    if (cartSyncTimeout) clearTimeout(cartSyncTimeout);
    cartSyncTimeout = setTimeout(async () => {
      try {
        await api('/api/merch/cart', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: (items || []).map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              isBundle: Boolean(item.isBundle),
              source: item.isBundle ? 'bundle' : 'individual',
            })),
          }),
        });
      } catch (err) {
        console.warn('[Merch] Failed to sync cart to backend:', err?.message || err);
      }
    }, 200);
  }

  async function syncCartFromBackend() {
    if (!state.currentUser?.id) return;
    try {
      const res = await api('/api/merch/cart');
      const backendItems = Array.isArray(res?.items) ? res.items : [];
      const localKey = getCartStorageKey(state.currentUser.id);
      const localRaw = localStorage.getItem(localKey);
      const localItems = localRaw ? JSON.parse(localRaw) : null;

      if (localItems !== null && Array.isArray(localItems) && localItems.length > 0) {
        syncCartToBackend(localItems);
        state.cart = localItems;
      } else if (backendItems.length > 0) {
        state.cart = backendItems;
        try {
          localStorage.setItem(localKey, JSON.stringify(state.cart));
        } catch {}
      } else {
        state.cart = [];
        try {
          localStorage.setItem(localKey, JSON.stringify([]));
        } catch {}
      }
      renderCartBadge();
      if (state.cartDrawerOpen) renderCart();
    } catch (err) {
      console.warn('[Merch] Failed to fetch backend cart:', err?.message || err);
    }
  }

  function saveCart() {
    cleanupLegacySharedCartStorage();
    try {
      const key = getCartStorageKey(state.cartOwnerId);
      localStorage.setItem(key, JSON.stringify(state.cart));
      const bundleKey = getBundleStorageKey(state.cartOwnerId);
      if (state.merchBundleCode) {
        localStorage.setItem(bundleKey, state.merchBundleCode);
      } else {
        localStorage.removeItem(bundleKey);
      }
      const couponKey = getCouponStorageKey(state.cartOwnerId);
      if (state.merchCouponCode) {
        localStorage.setItem(couponKey, state.merchCouponCode);
      } else {
        localStorage.removeItem(couponKey);
      }
    } catch (err) {
      console.warn('Unable to persist cart locally:', err);
    }
    renderCartBadge();
    if (state.currentUser?.id) {
      syncCartToBackend(state.cart);
    }
  }

  function addToCart(variantId, quantity, product, options = {}) {
    const { openDrawerAfterAdd = true, preserveCoupon = false, isBundle = false } = options;
    const variant = product.variants.find(v => Number(v.id) === Number(variantId));
    if (!variant || Number(variant.stock || 0) <= 0) return false;

    // Check stock across ALL items of this variant in cart (bundle + individual)
    const currentTotalQty = state.cart
      .filter(item => Number(item.variantId) === Number(variantId))
      .reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    const addQty = Math.max(1, Number(quantity || 1));
    if (currentTotalQty >= Number(variant.stock || 99)) {
      return false;
    }
    const allowableAddQty = Math.min(addQty, Number(variant.stock || 99) - currentTotalQty);
    if (allowableAddQty <= 0) return false;

    const offerInfo = getVariantOfferDetails(variant, product);
    const effectivePrice = offerInfo ? offerInfo.offerPrice : variant.price;

    const existing = state.cart.find(item => Number(item.variantId) === Number(variantId) && Boolean(item.isBundle) === Boolean(isBundle));
    if (existing) {
      existing.quantity = Number(existing.quantity || 1) + allowableAddQty;
      existing.price = effectivePrice;
      existing.originalPrice = offerInfo ? offerInfo.originalPrice : null;
      existing.discountLabel = offerInfo ? offerInfo.discountLabel : null;
      existing.offerName = offerInfo ? offerInfo.name : null;
      existing.isBundle = Boolean(isBundle);
      existing.source = isBundle ? 'bundle' : 'individual';
    } else {
      state.cart.push({
        variantId: Number(variantId),
        productId: product.id,
        productName: product.name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        price: effectivePrice,
        originalPrice: offerInfo ? offerInfo.originalPrice : null,
        discountLabel: offerInfo ? offerInfo.discountLabel : null,
        offerName: offerInfo ? offerInfo.name : null,
        quantity: allowableAddQty,
        image: getVariantImageUrl(variant, product),
        sku: variant.sku,
        isBundle: Boolean(isBundle),
        source: isBundle ? 'bundle' : 'individual',
      });
    }
    if (!preserveCoupon) {
      clearMerchCoupon();
    }
    saveCart();
    loadMerchCoupons();
    if (openDrawerAfterAdd) {
      openCart();
    }
    return true;
  }

  async function buyNow(variantId, quantity, product) {
    const added = addToCart(variantId, quantity, product, { openDrawerAfterAdd: false });
    if (!added) {
      showCheckoutNotice(isHoodieProduct(product) ? 'Sold out' : 'Out of stock', 'This product is currently unavailable.', { variant: 'error' });
      return;
    }

    await initiateCheckout({ directToCheckout: true });
  }

  async function handleProductCardAction(action, product, variantId = null) {
    const variant = product.variants.find((item) => String(item.id) === String(variantId))
      || getDefaultPurchasableVariant(product);
    if (!variant || Number(variant.stock || 0) <= 0) {
      showCheckoutNotice(isHoodieProduct(product) ? 'Sold out' : 'Out of stock', 'This product is currently unavailable.', { variant: 'error' });
      return;
    }

    if (action === 'buy-now') {
      const added = addToCart(variant.id, 1, product, { openDrawerAfterAdd: false });
      if (!added) {
        showCheckoutNotice(isHoodieProduct(product) ? 'Sold out' : 'Out of stock', 'This product is currently unavailable.', { variant: 'error' });
        return;
      }
      await initiateCheckout({ directToCheckout: true });
      return;
    }

    addToCart(variant.id, 1, product);
  }

  function removeFromCart(variantId, options = {}) {
    const { preserveCoupon = false, isBundle } = options;
    if (typeof isBundle === 'boolean') {
      state.cart = state.cart.filter(item => !(Number(item.variantId) === Number(variantId) && Boolean(item.isBundle) === isBundle));
    } else {
      state.cart = state.cart.filter(item => Number(item.variantId) !== Number(variantId));
    }
    if (!preserveCoupon) {
      clearMerchCoupon();
    }
    getMerchBundleDiscountAmount();
    saveCart();
    loadMerchCoupons();
    renderCart();
  }

  async function removeWishlistItem(item) {
    if (!item) return false;

    if (state.currentUser && item.id && !String(item.id).startsWith('guest-')) {
      await api(`/api/merch/wishlist/${encodeURIComponent(String(item.id))}`, { method: 'DELETE' });
    }

    state.merchWishlistItems = state.merchWishlistItems.filter((entry) => String(entry.id || '') !== String(item.id || ''));
    if (!state.currentUser) {
      localStorage.setItem('merch_wishlist_guest', JSON.stringify(state.merchWishlistItems));
    }
    syncWishlistControls();
    return true;
  }

  async function moveWishlistItemToCart(item) {
    const product = state.products.find((entry) => Number(entry.id) === Number(item?.productId));
    if (!product) {
      showCheckoutNotice('Wishlist', 'This product is no longer available.', { variant: 'error' });
      return;
    }

    const variant = product.variants.find((entry) => Number(entry.id) === Number(item?.variantId))
      || getDefaultPurchasableVariant(product);
    if (!variant || Number(variant.stock || 0) <= 0) {
      showCheckoutNotice(isHoodieProduct(product) ? 'Sold out' : 'Out of stock', 'This wishlist product is currently unavailable.', { variant: 'error' });
      return;
    }

    const added = addToCart(variant.id, 1, product, { openDrawerAfterAdd: false });
    if (!added) {
      showCheckoutNotice(isHoodieProduct(product) ? 'Sold out' : 'Out of stock', 'This wishlist product is currently unavailable.', { variant: 'error' });
      return;
    }

    try {
      await removeWishlistItem(item);
      renderWishlistBadge();
      renderAccountDrawer();
      showCheckoutNotice('Added to Cart', `${product.name} was moved to your cart.`);
      openCart();
    } catch (error) {
      showCheckoutNotice('Wishlist update failed', error?.message || 'The product was added to cart, but could not be removed from your wishlist.', { variant: 'error' });
    }
  }

  function getRawCartTotal() {
    return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function getCartTotal() {
    const rawTotal = getRawCartTotal();
    const bundleDiscount = getMerchBundleDiscountAmount();
    return Math.max(0, rawTotal - bundleDiscount);
  }

  function getMerchShippingCharge(_subtotalInr = getCartTotal()) {
    return 0;
  }

  function getIncludedGstAmount(subtotalInr = getCartTotal()) {
    const subtotalPaise = Math.round(Number(subtotalInr || 0) * 100);
    return Math.max(0, (subtotalPaise - Math.round(subtotalPaise / 1.18)) / 100);
  }

  function formatCheckoutMoney(amountInr) {
    if (state.currency === 'USD') {
      const rate = state.currencyConfig?.inrPerUsd || 85;
      const usd = Math.round((Number(amountInr || 0) / rate) * 100) / 100;
      return '$' + usd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return '₹' + Number(amountInr || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function getCheckoutDiscountAmount() {
    return Math.max(0, Number(state.merchCouponPreview?.discountAmountInr || 0));
  }

  function getMerchCouponPayableAmount() {
    const subtotal = getCartTotal();
    const discount = getCheckoutDiscountAmount();
    return Math.max(1, subtotal - discount);
  }

  function clearMerchCoupon({ preserveCode = false } = {}) {
    state.merchCouponPreview = null;
    state.merchCouponError = '';
    if (!preserveCode) state.merchCouponCode = '';
    if (els.cartCouponCode && !preserveCode) els.cartCouponCode.value = '';
    const checkoutCoupon = document.getElementById('checkoutCouponCode');
    if (checkoutCoupon && !preserveCode) checkoutCoupon.value = '';
  }

  function getCouponDiscountLabel(coupon) {
    if (!coupon) return '';
    return String(coupon.discountType || '').toLowerCase() === 'percentage'
      ? `${Number(coupon.discountValue || 0)}% OFF`
      : `${formatPrice(Number(coupon.discountValue || 0))} OFF`;
  }

  function isPublicMerchCoupon(coupon) {
    if (String(coupon?.couponType || 'public').toLowerCase() !== 'public') return false;
    if (Number(coupon?.influencerId || 0) > 0 || coupon?.influencerName || coupon?.influencer) return false;
    // Backward-compatible guard for older API responses that do not include influencerId.
    return !/influencer\s+merch\s+campaign\s+coupon/i.test(String(coupon?.description || ''));
  }

  async function loadMerchCoupons() {
    try {
      const productIds = [...new Set(state.cart.map((item) => Number(item.productId)).filter(Boolean))];
      const query = productIds.length ? `?productIds=${encodeURIComponent(productIds.join(','))}` : '';
      const result = await api(`/api/merch/coupons${query}`);
      state.availableCoupons = Array.isArray(result?.coupons) ? result.coupons : [];
    } catch {
      state.availableCoupons = [];
    }
    if (state.currentView === 'checkout') renderCheckoutPage();
    else if (state.cart.length) renderCart();
  }

  function getCheckoutTotals() {
    const rawSubtotal = getRawCartTotal();
    const bundleDiscount = getMerchBundleDiscountAmount();
    const subtotal = Math.max(0, rawSubtotal - bundleDiscount);
    let couponDiscount = Math.max(0, Number(state.merchCouponPreview?.discountAmountInr || 0));
    if (isRyanAttribution()) {
      const indBottles = getCartIndividualBottleCount();
      couponDiscount = indBottles * 1150;
    }
    const shipping = getMerchShippingCharge(Math.max(0, subtotal - couponDiscount));
    const total = Math.max(1, subtotal + shipping - couponDiscount);
    const totalSavings = bundleDiscount + couponDiscount;
    return {
      rawSubtotal,
      subtotal,
      bundleDiscount,
      couponDiscount,
      discount: couponDiscount,
      totalSavings,
      shipping,
      total,
      gstIncluded: getIncludedGstAmount(total),
    };
  }

  function getCartCount() {
    return (state.cart || []).reduce((sum, item) => sum + Math.max(1, Number(item.quantity || 1)), 0);
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
        els.cartCouponPreview.innerHTML = `<span class="cart-coupon__error">${escapeHtml(state.merchCouponError)}</span>`;
      } else {
        els.cartCouponPreview.hidden = true;
        els.cartCouponPreview.innerHTML = '';
      }
      return;
    }

    if (state.merchCouponError) {
      els.cartCouponPreview.hidden = false;
      els.cartCouponPreview.innerHTML = `<span class="cart-coupon__error">${escapeHtml(state.merchCouponError)}</span>`;
      return;
    }

    const totals = getCheckoutTotals();
    const isRyan = isRyanAttribution();
    const indBottles = getCartIndividualBottleCount();

    if (isRyan) {
      if (totals.couponDiscount > 0) {
        els.cartCouponPreview.hidden = false;
        els.cartCouponPreview.innerHTML = `
          <div class="cart-coupon__savings-text" style="color:#0f766e;">
            <strong style="display:block;margin-bottom:2px;">Ryan Discount Applied</strong>
            <div>${formatCheckoutMoney(totals.couponDiscount)} ${totals.bundleDiscount > 0 ? `discount applied to ${indBottles} standalone bottle${indBottles === 1 ? '' : 's'}` : `Ryan discount applied to ${indBottles} bottle${indBottles === 1 ? '' : 's'}`}.</div>
          </div>
        `;
      } else {
        // When Ryan customer discount is 0: do not show Ryan discount/coupon applied
        els.cartCouponPreview.hidden = true;
        els.cartCouponPreview.innerHTML = '';
      }
    } else {
      if (totals.couponDiscount > 0) {
        els.cartCouponPreview.hidden = false;
        els.cartCouponPreview.innerHTML = `
          <div class="cart-coupon__savings-text">
            ${formatCheckoutMoney(totals.couponDiscount)} Saved with discounts!
          </div>
        `;
      } else {
        els.cartCouponPreview.hidden = true;
        els.cartCouponPreview.innerHTML = '';
      }
    }
  }

  async function applyMerchCouponFromCart(options = {}) {
    const isSilent = Boolean(options?.silent);
    const checkoutCoupon = document.getElementById('checkoutCouponCode');
    const rawCode = state.currentView === 'checkout'
      ? (checkoutCoupon?.value || state.merchCouponCode || '')
      : (els.cartCouponCode?.value || state.merchCouponCode || '');
    const code = normalizeCouponCode(rawCode);
    state.merchCouponCode = code;
    state.merchCouponError = '';

    if (!code) {
      clearMerchCoupon();
      renderMerchCouponPreview();
      renderCart();
      if (state.currentView === 'checkout') renderCheckoutPage();
      return;
    }

    state.merchCouponLoading = true;
    try {
      const result = await api('/api/merch/preview-coupon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          couponCode: code,
          bundleCode: state.merchBundleCode || '',
          subtotalAmountPaise: Math.round(getCartTotal() * 100),
          productIds: state.cart.map((item) => Number(item.productId)).filter(Boolean),
          productLineTotals: state.cart.reduce((totals, item) => {
            const productId = Number(item.productId || 0);
            if (productId) totals[productId] = Number(totals[productId] || 0) + Math.round(item.price * item.quantity * 100);
            return totals;
          }, {}),
          variantIds: state.cart.map((item) => Number(item.variantId)).filter(Boolean),
          variantLineTotals: state.cart.reduce((totals, item) => {
            const variantId = Number(item.variantId || 0);
            if (variantId) totals[variantId] = Number(totals[variantId] || 0) + Math.round(item.price * item.quantity * 100);
            return totals;
          }, {}),
          items: state.cart.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            price: item.price,
            productName: item.productName || item.name || '',
          })),
          campaignSlug: state.campaignAttribution?.slug || null,
          campaignId: state.campaignAttribution?.campaignId || null,
        }),
      });
      state.merchCouponPreview = result.coupon || null;
      if (els.cartCouponCode) els.cartCouponCode.value = code;
      if (checkoutCoupon) checkoutCoupon.value = code;
      if (!isSilent) {
        showCheckoutNotice('Coupon applied', `${code} is ready for checkout.`);
      }
    } catch (error) {
      clearMerchCoupon();
      state.merchCouponError = error.message || 'Unable to validate coupon.';
      if (!isSilent) {
        showCheckoutNotice('Coupon error', state.merchCouponError, { variant: 'error' });
      }
    } finally {
      state.merchCouponLoading = false;
      renderCart();
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

  function renderWishlistBadge() {
    const count = Array.isArray(state.merchWishlistItems) ? state.merchWishlistItems.length : 0;
    if (!els.wishlistBadge) return;
    els.wishlistBadge.textContent = count;
    els.wishlistBadge.hidden = count === 0;
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
    const cartAvailableCoupons = document.getElementById('cartAvailableCoupons');
    if (cartAvailableCoupons) {
      const coupons = state.availableCoupons.filter(isPublicMerchCoupon);
      cartAvailableCoupons.innerHTML = coupons.length ? `
        <p class="cart-available-coupons__title">Available coupons</p>
        ${coupons.map((coupon) => `
          <button type="button" class="cart-available-coupon${String(coupon.code) === String(state.merchCouponCode) ? ' is-selected' : ''}" data-cart-coupon-code="${escapeHtml(coupon.code)}">
            <span><strong>${escapeHtml(coupon.code)}</strong><small>${escapeHtml(coupon.couponCategory === 'festival' ? 'Festival coupon' : coupon.couponCategory === 'seasonal' ? 'Seasonal coupon' : 'Public coupon')}${coupon.description ? ` · ${escapeHtml(coupon.description)}` : ''}</small></span>
            <b>${escapeHtml(getCouponDiscountLabel(coupon))}</b>
          </button>
        `).join('')}
      ` : '';
      cartAvailableCoupons.querySelectorAll('[data-cart-coupon-code]').forEach((button) => {
        button.addEventListener('click', async () => {
          const code = normalizeCouponCode(button.dataset.cartCouponCode);
          if (els.cartCouponCode) els.cartCouponCode.value = code;
          state.merchCouponCode = code;
          await applyMerchCouponFromCart();
        });
      });
    }
    renderMerchCouponPreview();

    const activeBundle = getActiveBundleInfo();
    let bundleCartHtml = '';
    if (activeBundle) {
      const bottleItem = activeBundle.bottleItem;
      const mistItem = activeBundle.mistItem;
      const bundleQty = activeBundle.bundleQty;
      const bundleUnitPrice = Number(bottleItem.price || 0) + Number(mistItem.price || 0);
      const bundleRegularLineTotal = bundleUnitPrice * bundleQty;
      const bundleDiscountAmount = getMerchBundleDiscountAmount();
      const bundleChargedLineTotal = bundleDiscountAmount > 0
        ? Math.max(0, bundleRegularLineTotal - bundleDiscountAmount)
        : bundleRegularLineTotal;
      const bottleImg = bottleItem.image || FALLBACK_PRODUCT_IMAGE;
      const mistImg = mistItem.image || FALLBACK_PRODUCT_IMAGE;

      bundleCartHtml = `
        <div class="cart-item cart-item--bundle" style="background:#fdfaf7;border:1px solid #eadcd2;border-radius:10px;padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px;">
          <div class="shopify-summary-bundle__images" style="width:72px;height:56px;padding:2px;gap:2px;flex-shrink:0;">
            <div class="shopify-summary-bundle__img" style="width:30px;height:48px;">
              <img src="${escapeHtml(bottleImg)}" alt="${escapeHtml(bottleItem.productName)}" style="width:100%;height:100%;object-fit:cover;" />
            </div>
            <span class="shopify-summary-bundle__plus" style="font-size:10px;">+</span>
            <div class="shopify-summary-bundle__img" style="width:30px;height:48px;">
              <img src="${escapeHtml(mistImg)}" alt="${escapeHtml(mistItem.productName)}" style="width:100%;height:100%;object-fit:cover;" />
            </div>
          </div>
          <div class="cart-item__details" style="min-width:0;flex:1;">
            <span class="shopify-summary-bundle__badge" style="font-size:9px;padding:2px 5px;margin-bottom:3px;">BUNDLE OFFER</span>
            <p class="cart-item__name" style="font-size:0.95em;font-weight:700;margin:0 0 2px;">Bottle + Mist Bundle</p>
            <p class="cart-item__variant" style="font-size:0.8em;color:#78350f;margin:0 0 4px;">Includes: Bottle + Mist</p>
            <div class="shopify-summary-product__stepper" style="margin-top:4px;margin-bottom:4px;" role="group" aria-label="Quantity for Bottle + Mist Bundle">
              <button type="button" class="shopify-summary-product__step-btn" data-cart-step-bundle="down" aria-label="Decrease bundle quantity" ${bundleQty <= 1 ? 'title="Remove bundle"' : ''}>−</button>
              <span class="shopify-summary-product__step-qty">${bundleQty}</span>
              <button type="button" class="shopify-summary-product__step-btn" data-cart-step-bundle="up" aria-label="Increase bundle quantity">+</button>
            </div>
            <p class="cart-item__price" style="margin:2px 0 0;">
              <strong>${formatPrice(bundleChargedLineTotal)}</strong>
              ${bundleDiscountAmount > 0 ? `<span style="text-decoration:line-through;color:var(--text-muted);font-size:0.85em;margin-left:6px;">${formatPrice(bundleRegularLineTotal)}</span>` : ''}
            </p>
          </div>
          <button class="cart-item__remove" data-cart-remove-bundle="H2BUNDLE15" aria-label="Remove bundle">✕</button>
        </div>
      `;
    }

    const nonBundleItems = state.cart.filter((item) => !item.isBundle);
    const individualItemsHtml = nonBundleItems.map(item => `
      <div class="cart-item">
        <div class="cart-item__image">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.productName)}" />
        </div>
        <div class="cart-item__details">
          <p class="cart-item__name">${escapeHtml(item.productName)}</p>
          <p class="cart-item__variant">${escapeHtml(item.variantLabel)} × ${item.quantity}</p>
          <div class="shopify-summary-product__stepper" style="margin-top:6px;margin-bottom:6px;" role="group" aria-label="Quantity for ${escapeHtml(item.productName)}">
            <button type="button" class="shopify-summary-product__step-btn" data-cart-step-variant="${item.variantId}" data-cart-step-dir="down" aria-label="Decrease quantity" ${item.quantity <= 1 ? 'title="Remove item"' : ''}>−</button>
            <span class="shopify-summary-product__step-qty">${item.quantity}</span>
            <button type="button" class="shopify-summary-product__step-btn" data-cart-step-variant="${item.variantId}" data-cart-step-dir="up" aria-label="Increase quantity">+</button>
          </div>
          <p class="cart-item__price">
            ${item.originalPrice && item.originalPrice > item.price ? `
              <span class="cart-item__original-price" style="text-decoration:line-through;color:var(--text-muted);font-size:0.85em;margin-right:6px;">${formatPrice(item.originalPrice * item.quantity)}</span>
              <strong>${formatPrice(item.price * item.quantity)}</strong>
              ${item.discountLabel ? `<span class="cart-item__offer-badge" style="display:inline-block;background:rgba(174,84,49,.12);color:var(--primary-dark);font-size:0.75em;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:700;">${escapeHtml(item.discountLabel)}</span>` : ''}
            ` : `
              ${formatPrice(item.price * item.quantity)}
            `}
          </p>
        </div>
        <button class="cart-item__remove" data-cart-remove-variant="${item.variantId}" aria-label="Remove">✕</button>
      </div>
    `).join('');

    els.cartItems.innerHTML = bundleCartHtml + individualItemsHtml;

    const totals = getCheckoutTotals();
    const bundleDiscount = totals.bundleDiscount;
    els.cartSubtotal.textContent = formatPrice(totals.rawSubtotal);
    const bundleDiscountRow = document.getElementById('cartBundleDiscountRow');
    const couponDiscountRow = document.getElementById('cartCouponDiscountRow');
    const cartPayable = document.getElementById('cartPayable');
    if (bundleDiscountRow) {
      bundleDiscountRow.hidden = bundleDiscount <= 0;
      bundleDiscountRow.querySelector('span:last-child').textContent = `- ${formatPrice(bundleDiscount)}`;
    }
    if (couponDiscountRow) {
      if (totals.couponDiscount > 0) {
        couponDiscountRow.hidden = false;
        const indBottles = getCartIndividualBottleCount();
        const labelEl = document.getElementById('cartCouponDiscountLabel');
        const valEl = document.getElementById('cartCouponDiscountVal');
        if (labelEl) labelEl.textContent = isRyanAttribution() ? `Ryan discount (${indBottles} ${totals.bundleDiscount > 0 ? 'standalone ' : ''}bottle${indBottles === 1 ? '' : 's'})` : 'Coupon discount';
        if (valEl) valEl.textContent = `- ${formatPrice(totals.couponDiscount)}`;
      } else {
        couponDiscountRow.hidden = true;
      }
    }
    if (cartPayable) cartPayable.textContent = formatPrice(totals.total);

    const cartCouponSection = document.querySelector('.cart-coupon');
    if (cartCouponSection) {
      cartCouponSection.hidden = false;
      renderMerchCouponPreview();
    }

    // Bind bundle remove button
    els.cartItems.querySelectorAll('[data-cart-remove-bundle]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.cart = state.cart.filter(item => !item.isBundle);
        clearMerchBundleDiscount();
        saveCart();
        loadMerchCoupons();
        renderCart();
      });
    });

    // Bind bundle stepper buttons
    els.cartItems.querySelectorAll('[data-cart-step-bundle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.cartStepBundle;
        const currentBundle = getActiveBundleInfo();
        if (!currentBundle) return;

        if (dir === 'up') {
          const bottleVar = (currentBundle.bottleProduct?.variants || []).find(v => Number(v.id) === Number(currentBundle.bottleItem.variantId));
          const mistVar = (currentBundle.mistProduct?.variants || []).find(v => Number(v.id) === Number(currentBundle.mistItem.variantId));
          const totalBottleQty = state.cart.filter(it => Number(it.variantId) === Number(bottleVar?.id)).reduce((s, it) => s + Number(it.quantity || 1), 0);
          const totalMistQty = state.cart.filter(it => Number(it.variantId) === Number(mistVar?.id)).reduce((s, it) => s + Number(it.quantity || 1), 0);
          if (totalBottleQty >= Number(bottleVar?.stock || 99) || totalMistQty >= Number(mistVar?.stock || 99)) {
            showCheckoutNotice('Max stock reached', 'Cannot add more units due to inventory limits.', { variant: 'error' });
            return;
          }
          currentBundle.bottleItem.quantity = Number(currentBundle.bottleItem.quantity || 1) + 1;
          currentBundle.mistItem.quantity = Number(currentBundle.mistItem.quantity || 1) + 1;
          saveCart();
          renderCart();
        } else if (dir === 'down') {
          if (currentBundle.bundleQty > 1) {
            currentBundle.bottleItem.quantity = Number(currentBundle.bottleItem.quantity || 1) - 1;
            currentBundle.mistItem.quantity = Number(currentBundle.mistItem.quantity || 1) - 1;
            saveCart();
            renderCart();
          } else {
            state.cart = state.cart.filter(item => !item.isBundle);
            clearMerchBundleDiscount();
            saveCart();
            renderCart();
          }
        }
      });
    });

    // Bind individual remove buttons
    els.cartItems.querySelectorAll('[data-cart-remove-variant]').forEach(btn => {
      btn.addEventListener('click', () => {
        const variantId = Number(btn.dataset.cartRemoveVariant);
        removeFromCart(variantId, { isBundle: false });
      });
    });

    // Bind drawer stepper buttons for individual items
    els.cartItems.querySelectorAll('[data-cart-step-variant]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const variantId = Number(btn.dataset.cartStepVariant);
        const dir = btn.dataset.cartStepDir;
        const item = state.cart.find(it => Number(it.variantId) === variantId && !it.isBundle);
        if (!item) return;

        const hadCoupon = Boolean(state.merchCouponCode);
        if (dir === 'up') {
          const prod = (state.products || []).find(p => Number(p.id) === Number(item.productId));
          const variant = (prod?.variants || []).find(v => Number(v.id) === variantId);
          const maxStock = Number(variant?.stock || 99);
          const totalVariantQty = state.cart.filter(it => Number(it.variantId) === variantId).reduce((s, it) => s + Number(it.quantity || 1), 0);
          if (totalVariantQty >= maxStock) {
            showCheckoutNotice('Max stock reached', 'Cannot add more units due to inventory limits.', { variant: 'error' });
            return;
          }
          item.quantity = Number(item.quantity || 1) + 1;
          saveCart();
          if (hadCoupon) await applyMerchCouponFromCart({ silent: true });
          renderCart();
        } else if (dir === 'down') {
          if (Number(item.quantity || 1) > 1) {
            item.quantity = Number(item.quantity || 1) - 1;
            saveCart();
            if (hadCoupon) await applyMerchCouponFromCart({ silent: true });
            renderCart();
          } else {
            removeFromCart(variantId, { isBundle: false, preserveCoupon: hadCoupon });
          }
        }
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
      trackingNumber: verifyResult?.trackingNumber || order?.trackingNumber || null,
      carrierName: verifyResult?.carrierName || order?.carrierName || null,
      createdAt,
      dateLabel: formatConfirmationDate(createdAt),
      timeLabel: `${formatConfirmationTime(createdAt)} - Order received`,
      service: itemCount > 1 ? `House Merch Order (${itemCount} items)` : 'House Merch Order',
      locationTitle: 'Delivery Location',
      location: getConfirmationLocation(address),
      email: String(customer?.email || order?.customer?.email || 'example@email.com').trim(),
      phone: String(customer?.phone || order?.customer?.phone || address?.phone || '').trim(),
      customerName: String(customer?.name || order?.customer?.name || 'H2 Customer').trim(),
      totalAmount: Number(order?.amount || 0),
      notifications: verifyResult?.notifications || order?.notifications || {},
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
        <h1 id="bookingConfirmationTitle">Order Confirmed!</h1>
        <p>Thank you for shopping with H2 House of Health.</p>
        <p>Your order updates are detailed below.</p>
      </div>
    `;
  }

  function BookingIdCard(data) {
    const hasTracking = Boolean(data.trackingNumber);
    return `
      <div class="booking-id-card">
        <span>Order Number</span>
        <strong>${escapeHtml(data.bookingId)}</strong>
        <button class="booking-copy-btn" type="button" data-confirmation-action="copy-id" aria-label="Copy order number">
          ${confirmationIcon('copy')}
        </button>
      </div>
      ${hasTracking ? `
        <div class="booking-id-card" style="margin-top: 10px; background: rgba(34, 197, 94, 0.08); border-color: rgba(34, 197, 94, 0.35);">
          <span>Courier Tracking AWB (${escapeHtml(data.carrierName || 'Shiprocket')})</span>
          <strong style="color: #16a34a; font-family: monospace; letter-spacing: 0.5px;">${escapeHtml(data.trackingNumber)}</strong>
          <button class="booking-copy-btn" type="button" data-confirmation-action="copy-awb" aria-label="Copy tracking AWB">
            ${confirmationIcon('copy')}
          </button>
        </div>
      ` : ''}
    `;
  }

  function getConfirmationNotificationState(notifications = {}) {
    const emailStatus = String(notifications?.email?.status || '').toLowerCase();
    const whatsappLatest = notifications?.whatsapp?.latest || {};
    const whatsappStatus = String(whatsappLatest.status || notifications?.whatsapp?.status || '').toLowerCase();
    const map = {
      read: ['Read', 'Your WhatsApp confirmation has been read.'],
      delivered: ['Delivered', 'Your WhatsApp confirmation was delivered.'],
      sent: ['Sent', 'Your WhatsApp confirmation was sent.'],
      triggered: ['Sending...', 'We are sending your WhatsApp confirmation now.'],
      pending: ['Sending...', 'We are sending your WhatsApp confirmation now.'],
      failed: ['Needs Attention', 'WhatsApp delivery failed. Our team can retry from the order record.'],
      skipped: ['Not Sent', 'WhatsApp updates are not enabled for this order.'],
    };
    const [whatsappLabel, whatsappText] = map[whatsappStatus] || ['Preparing...', 'We are preparing your WhatsApp confirmation.'];
    const emailLabel = emailStatus === 'sent' ? 'Sent' : emailStatus === 'failed' ? 'Needs Attention' : 'Preparing...';
    const emailText = emailStatus === 'sent'
      ? 'Your confirmation email has been sent.'
      : emailStatus === 'failed'
        ? 'Email delivery needs attention. Your order is still confirmed.'
        : "We're preparing your confirmation email.";
    return { emailLabel, emailText, whatsappLabel, whatsappText, whatsappStatus };
  }

  function BookingUpdatesCard(data = {}) {
    const rawCustomerEmail = data?.email || data?.customerEmail || '';
    const isReal = hasRealEmail(rawCustomerEmail);
    const customerEmail = isReal ? rawCustomerEmail : '';
    const customerPhone = data?.phone || '';
    const digits = customerPhone.replace(/\D/g, '');
    const phoneDisplay = digits.length >= 10 ? ` (+91 ${digits.slice(-10)})` : '';
    const orderId = data?.orderId || '';
    const notificationState = getConfirmationNotificationState(data?.notifications || {});

    return `
      <section class="booking-updates-card" aria-label="Order status updates">
        <h2>Order Confirmations & Updates</h2>
        <div class="booking-updates-grid">
          <article class="booking-update-item">
            <div class="booking-update-icon booking-update-icon--email">${confirmationIcon('mail')}</div>
            <div class="booking-update-content">
              <h3>Email Confirmation</h3>
              ${isReal ? `
                <strong class="booking-update-badge is-sent">✓ Sent to ${escapeHtml(customerEmail)}</strong>
                <p>${escapeHtml(notificationState.emailText || 'Check your inbox for order details and receipt.')}</p>
              ` : `
                <strong class="booking-update-badge is-muted">Email not provided</strong>
                <p>No confirmation email sent. You can add an email to your account profile anytime.</p>
              `}
            </div>
          </article>
          <article class="booking-update-item">
            <div class="booking-update-icon booking-update-icon--whatsapp">${confirmationIcon('whatsapp')}</div>
            <div class="booking-update-content">
              <h3>WhatsApp Confirmation</h3>
              <strong class="booking-update-badge is-sent" id="merchWhatsAppBadge">✓ Sent to WhatsApp${escapeHtml(phoneDisplay)}</strong>
              <p id="merchWhatsAppSubtext">${escapeHtml(notificationState.whatsappStatus === 'failed' ? notificationState.whatsappText : 'Order summary and real-time delivery alerts are sent to your WhatsApp number.')}</p>
              ${orderId ? `
                <button class="booking-whatsapp-action-btn" type="button" data-confirmation-action="send-whatsapp" data-order-id="${escapeHtml(String(orderId))}">
                  ${confirmationIcon('whatsapp')}
                  <span>Resend to WhatsApp</span>
                </button>
              ` : ''}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function BookingDetailsCard(data) {
    const orderDate = new Date(data.dateLabel.replace(/^[A-Za-z]+,\s*/, ''));

const deliveryDate = new Date(orderDate);
deliveryDate.setDate(orderDate.getDate() + 7);

const estimatedDelivery = deliveryDate.toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
    const details = [
      { icon: 'calendar', label: 'Date & Time', lines: [data.dateLabel, data.timeLabel] },
      { icon: 'user', label: 'Service', lines: [data.service] },
      { icon: 'map', label: data.locationTitle || 'Location', lines: [data.location] },
      {
        icon: 'truck',
        label: data.trackingNumber ? `Shipment Assigned (${data.carrierName || 'Shiprocket'})` : 'Estimated Delivery Date',
        lines: data.trackingNumber
          ? [`Tracking AWB: ${data.trackingNumber}`, 'Live tracking code generated instantly upon order confirmation.']
          : [estimatedDelivery, "We'll notify you once your order is shipped."],
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
      { icon: 'shield', title: 'Secure Payment', text: 'Encrypted and verified transactions.' },
      { icon: 'truck', title: 'Insured Delivery', text: 'Tamper-evident packaging and shipment tracking.' },
      { icon: 'heart', title: '7-Day Return Coverage', text: 'Covered for items damaged or non-working due to shipment.' },
      { icon: 'bell', title: '6-Month Parts Warranty', text: 'Coverage for eligible hardware components.' },
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
        if (action === 'copy-awb') {
          try {
            await navigator.clipboard?.writeText(data.trackingNumber);
            button.classList.add('is-copied');
            setTimeout(() => button.classList.remove('is-copied'), 1200);
          } catch {
            showCheckoutNotice('Copy unavailable', `Tracking AWB: ${data.trackingNumber}`);
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
        if (action === 'send-whatsapp') {
          const orderId = button.dataset.orderId || data.orderId;
          if (!orderId) {
            showCheckoutNotice('WhatsApp Confirmation', 'Order details are not available yet.');
            return;
          }
          const originalHtml = button.innerHTML;
          button.disabled = true;
          button.innerHTML = `<span>Sending...</span>`;
          try {
            const res = await fetch(buildApiUrl(`/api/merch/orders/${encodeURIComponent(orderId)}/send-whatsapp`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            const result = await res.json().catch(() => ({}));
            if (res.ok && result.success) {
              button.innerHTML = `${confirmationIcon('check')} <span>Sent!</span>`;
              button.classList.add('is-sent');
              const badge = els.bookingConfirmation.querySelector('#merchWhatsAppBadge');
              if (badge) badge.textContent = '✓ Sent to WhatsApp';
              setTimeout(() => {
                button.disabled = false;
                button.innerHTML = originalHtml;
                button.classList.remove('is-sent');
              }, 4000);
            } else {
              button.disabled = false;
              button.innerHTML = originalHtml;
              showCheckoutNotice('WhatsApp Status', result.message || 'Could not send WhatsApp message. Please try again.');
            }
          } catch (err) {
            button.disabled = false;
            button.innerHTML = originalHtml;
            showCheckoutNotice('WhatsApp Error', 'Network error while sending WhatsApp message.');
          }
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
    if (match) return decodeURIComponent(match[1]);
    const urlParams = new URLSearchParams(window.location.search);
    const queryOrder = urlParams.get('track') || urlParams.get('orderId') || urlParams.get('order');
    if (queryOrder) {
      const decoded = decodeURIComponent(queryOrder);
      if (window.location.hash !== `#track-order/${encodeURIComponent(decoded)}`) {
        window.location.hash = `track-order/${encodeURIComponent(decoded)}`;
      }
      return decoded;
    }
    return '';
  }

  function isAdminTrackingRequest() {
    return new URLSearchParams(window.location.search).get('adminTracking') === '1'
      && Boolean(getTrackingOrderIdFromHash());
  }

  function normalizeAdminTrackingOrder(result) {
    const raw = result?.order || {};
    const items = Array.isArray(result?.items) ? result.items : [];
    return {
      id: raw.id,
      orderNumber: raw.order_number || raw.orderNumber,
      customerEmail: raw.customer_email || raw.customerEmail || '',
      email: raw.customer_email || raw.customerEmail || '',
      status: raw.status || 'processing',
      createdAt: raw.created_at || raw.createdAt || null,
      updatedAt: raw.updated_at || raw.updatedAt || null,
      trackingNumber: raw.tracking_number || raw.trackingNumber || '',
      carrier: raw.carrier_name || raw.carrierName || '',
      totalAmount: Number(raw.total_amount || raw.totalAmount || 0),
      items: items.map((item) => ({
        name: item.product_name || item.productName || '',
        productName: item.product_name || item.productName || '',
        variantLabel: item.variant_label || item.variantLabel || '',
        qty: Number(item.quantity || item.qty || 1),
        quantity: Number(item.quantity || item.qty || 1),
        sku: item.sku || '',
      })),
    };
  }

  async function loadAdminTrackingOrder(orderId) {
    try {
      const result = await api(`/api/merch/admin/orders/${encodeURIComponent(orderId)}`);
      state.merchOrders = [normalizeAdminTrackingOrder(result)];
    } catch {
      state.merchOrders = [];
    }
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

  async function showOrderTracking(orderId) {
    state.currentView = 'tracking';

    els.productDetail.hidden = true;
    els.shopSection.hidden = true;
    if (els.checkoutPage) els.checkoutPage.hidden = true;
    if (els.bookingConfirmation) els.bookingConfirmation.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    closeCart();
    closeAccountDrawer();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    let order = getTrackingOrderById(orderId);
    if (order) {
      if (els.orderTracking) {
        els.orderTracking.hidden = false;
        els.orderTracking.innerHTML = OrderTrackingPage(order);
        bindOrderTrackingActions(order);
      }
      return;
    }

    if (els.orderTracking) {
      els.orderTracking.hidden = false;
      els.orderTracking.innerHTML = `
        <div class="order-tracking__inner">
          <div class="tracking-loading" style="text-align: center; padding: 60px 20px;">
            <p style="color: #666; font-size: 16px;">Loading order tracking...</p>
          </div>
        </div>
      `;
    }

    try {
      const res = await api(`/api/merch/orders/${encodeURIComponent(orderId)}/tracking`);
      if (res?.order) {
        order = res.order;
        if (!Array.isArray(state.merchOrders)) state.merchOrders = [];
        const existingIdx = state.merchOrders.findIndex(
          (o) => String(o.id) === String(order.id) || String(o.orderNumber) === String(order.orderNumber)
        );
        if (existingIdx >= 0) {
          state.merchOrders[existingIdx] = order;
        } else {
          state.merchOrders.unshift(order);
        }
      }
    } catch (err) {
      console.warn('Failed to load tracking order details:', err);
    }

    if (els.orderTracking) {
      els.orderTracking.innerHTML = OrderTrackingPage(order);
      if (order) {
        bindOrderTrackingActions(order);
      }
    }
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
    if (els.cartOverlay) els.cartOverlay.classList.remove('is-open');
    setTimeout(() => {
      els.cartDrawer.hidden = true;
      if (els.cartOverlay) els.cartOverlay.hidden = true;
    }, 300);
  }

  function getMerchantProfile() {
    const profile = state.merchProfile || {};
    const user = state.currentUser || {};
    const rawEmail = String(profile.email || user.email || '').trim();
    const isReal = hasRealEmail(rawEmail);
    return {
      fullName: String(profile.fullName || user.name || 'House of Health Customer').trim(),
      email: isReal ? rawEmail : '',
      rawEmail,
      hasRealEmail: isReal,
      displayEmail: isReal ? rawEmail : 'Email not provided',
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
          ${profile.hasRealEmail ? `<span>${escapeHtml(profile.email)}</span>` : ''}
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
    return items.map((item) => {
      const value = Number(item?.[valueKey] || 0);
      const formattedValue = typeof formatter === 'function' ? formatter(value, item) : formatPrice(value || 0);
      return `
        <article class="influencer-kpi">
          <p>${escapeHtml(item?.[labelKey] || '')}</p>
          <strong>${escapeHtml(formattedValue)}</strong>
        </article>
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
    const socialLinksText = Array.isArray(influencer.socialLinks) ? influencer.socialLinks.join('\n') : '';
    // Kept available for legacy markup while the insights panel remains hidden.
    const bestCoupon = analytics.bestCoupon || dashboard.performance?.bestCoupon || null;
    const highestSalesMonth = analytics.highestSalesMonth || dashboard.performance?.highestSalesMonth || null;
    const topProducts = Array.isArray(analytics.topProducts) ? analytics.topProducts : Array.isArray(dashboard.performance?.topSellingProducts) ? dashboard.performance.topSellingProducts : [];
    const averageOrderValue = dashboard.performance?.averageOrderValue ?? summary.averageOrderValue ?? 0;
    const repeatCustomerPercentage = dashboard.performance?.repeatCustomerPercentage ?? analytics.repeatCustomerPercentage ?? 0;
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
    const monthlyCouponUsage = activeMonthlyRows.filter((row) => row.couponUsed).length;
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
    ];

    return `
      <section class="account-section account-section--influencer">
        <div class="account-section__head">
          <div>
            <p class="account-section__eyebrow">Influencer Dashboard</p>
            <h4>Premium creator analytics</h4>
          </div>
          <div class="influencer-dashboard-actions">
            <button type="button" class="btn btn-outline account-action-btn" data-account-action="influencer-back">Back to account</button>
            <label class="influencer-month-select">
              <span>Month</span>
              <select data-influencer-filter="month">
                <option value="all" ${state.influencerSalesMonth === 'all' ? 'selected' : ''}>All months</option>
                ${monthOptions.map((item) => `<option value="${escapeHtml(item.value)}" ${state.influencerSalesMonth === item.value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
          </div>
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
              ${Array.isArray(dashboard.campaigns) && dashboard.campaigns[0] ? `
                <button type="button" class="btn btn-outline account-action-btn" data-account-action="copy-influencer-link" data-campaign-url="${window.location.origin}/c/${escapeHtml(dashboard.campaigns[0].slug)}">Copy Story Link</button>
              ` : ''}
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
          </div>
        </article>

        ${Array.isArray(dashboard.campaigns) && dashboard.campaigns.length ? `
          <div class="influencer-campaigns-list" style="margin-bottom:20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
            <p class="account-section__eyebrow" style="margin-bottom:8px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:700;">Instagram Story Tracking Links</p>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${dashboard.campaigns.map(c => `
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;background:#fff;padding:12px 14px;border-radius:8px;border:1px solid #e5e7eb;">
                  <div>
                    <strong>${escapeHtml(c.name || `${c.slug} Campaign`)}</strong>
                    <div style="font-family:monospace;font-size:13px;color:#374151;margin-top:2px;">${window.location.origin}/c/${escapeHtml(c.slug)}</div>
                    <small style="color:#6b7280;">Coupon: <code>${escapeHtml(c.couponCode)}</code> &bull; Clicks: <strong>${Number(c.clicksCount || 0)}</strong> &bull; Orders: <strong>${Number(c.ordersCount || 0)}</strong></small>
                  </div>
                  <button type="button" class="btn btn-outline account-action-btn" data-account-action="copy-influencer-link" data-campaign-url="${window.location.origin}/c/${escapeHtml(c.slug)}">Copy Story Link</button>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

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
      cancel: '<svg class="account-order-action__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="m15 9-6 6M9 9l6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
    };
    return icons[name] || '';
  }

  function renderAccountNavIcon(name) {
    const icons = {
      profile: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" stroke-width="1.8"/><path d="M4 21a8 8 0 0 1 16 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      orders: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 8a3 3 0 0 1 6 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      cart: '<svg class="account-panel-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h2.2l1.6 8.4a1.4 1.4 0 0 0 1.38 1.16h7.6a1.4 1.4 0 0 0 1.35-1.03L19.6 8H7.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.4" cy="19" r="1.05" fill="currentColor"/><circle cx="17" cy="19" r="1.05" fill="currentColor"/></svg>',
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
    const profilePhone = parseCheckoutPhone(profile.mobile || '');
    const avatarStyle = profile.avatarUrl
      ? ` style="background-image:url('${escapeHtml(profile.avatarUrl)}')"`
      : '';
    const totalCartCount = getCartCount();

    els.accountDrawerContent.innerHTML = `
      <nav class="account-panel-nav" aria-label="Account sections">
        <button type="button" data-account-nav="account-profile" aria-current="${state.accountActiveSection === 'account-profile' ? 'page' : 'false'}">${renderAccountNavIcon('profile')}<span>My Profile</span></button>
        <button type="button" data-account-nav="account-orders" aria-current="${state.accountActiveSection === 'account-orders' ? 'page' : 'false'}">${renderAccountNavIcon('orders')}<span>My Orders</span>${orders.length > 0 ? `<span class="account-nav-badge">${orders.length}</span>` : ''}</button>
        <button type="button" data-account-nav="cart">${renderAccountNavIcon('cart')}<span>My Cart</span>${totalCartCount > 0 ? `<span class="account-nav-badge">${totalCartCount}</span>` : ''}</button>
        <button type="button" data-account-nav="account-addresses" aria-current="${state.accountActiveSection === 'account-addresses' ? 'page' : 'false'}">${renderAccountNavIcon('addresses')}<span>My Addresses</span></button>
        <button type="button" data-account-nav="account-wishlist" aria-current="${state.accountActiveSection === 'account-wishlist' ? 'page' : 'false'}">${renderAccountNavIcon('wishlist')}<span>Wishlist</span>${wishlistItems.length > 0 ? `<span class="account-nav-badge">${wishlistItems.length}</span>` : ''}</button>
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
                ${profile.hasRealEmail
                  ? `<input name="email" type="email" value="${escapeHtml(profile.email)}" readonly aria-readonly="true" />`
                  : `<input name="email" type="email" value="" placeholder="" />`}
              </label>
              <label class="account-field">
                <span>Mobile Number</span>
                <div class="checkout-phone-control">
                  <select name="mobileCountryCode" aria-label="Mobile country code" autocomplete="tel-country-code">
                    ${CHECKOUT_PHONE_COUNTRY_CODES.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === profilePhone.countryCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
                  </select>
                  <input name="mobile" type="tel" inputmode="numeric" maxlength="15" value="${escapeHtml(profilePhone.localNumber)}" autocomplete="tel-national" placeholder="Mobile number" />
                </div>
              </label>
              <div class="account-form__actions">
                <button class="btn btn-primary account-action-btn" type="submit">Save</button>
                <button class="btn btn-outline account-action-btn" type="button" data-account-action="cancel-profile">Cancel</button>
              </div>
            </form>
          ` : `
            <ul class="account-meta-list">
              <li><span>Email</span><strong>${escapeHtml(profile.hasRealEmail ? profile.email : '—')}</strong></li>
              <li><span>Mobile Number</span><strong>${escapeHtml(formatCustomerPhone(profile.mobile))}</strong></li>
            </ul>
            <p class="account-card__note">${profile.hasRealEmail ? 'Email is your account identity and cannot be changed here.' : 'Add your email to receive order updates and receipts.'}</p>
          `}
          ${state.accountProfileMessage ? `<p class="account-success-message ${state.accountProfileIsError ? 'account-error-message' : ''}" style="${state.accountProfileIsError ? 'color:#dc2626;' : ''}">${escapeHtml(state.accountProfileMessage)}</p>` : ''}
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
            ${visibleOrders.map((order) => {
              const isOrderPending = (String(order.status || '').toLowerCase() === 'pending' || String(order.paymentStatus || '').toLowerCase() === 'pending') && String(order.status || '').toLowerCase() !== 'cancelled';
              return `
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
                  ${isOrderPending ? `
                    <button type="button" data-account-action="proceed-checkout" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Proceed to checkout for ${escapeHtml(order.orderNumber || `Order #${order.id}`)}"><span style="color: var(--primary, #0f172a); font-weight: 600;">Proceed to Checkout</span></button>
                    <button type="button" data-account-action="cancel-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Cancel ${escapeHtml(order.orderNumber || `Order #${order.id}`)}" style="color: #dc2626;">Cancel</button>
                  ` : `
                    <button type="button" data-account-action="track-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Track ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('truck')}<span>Track Order</span></button>
                    <button type="button" data-account-action="invoice-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Open invoice for ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('document')}<span>Invoice</span></button>
                    ${canCancelMerchOrder(order) ? `<button type="button" data-account-action="cancel-order" data-order-id="${escapeHtml(String(order.id || ''))}" aria-label="Cancel ${escapeHtml(order.orderNumber || `Order #${order.id}`)}">${renderOrderActionIcon('cancel')}<span>Cancel Order</span></button>` : ''}
                  `}
                </div>
              </article>
            `;
            }).join('')}
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
                            <img
                class="account-list__image"
                src="${escapeHtml(getWishlistProductImage(item))}"
                alt="${escapeHtml(getWishlistProductLabel(item))}"
              />
                <div class="account-list__row">
                  <strong>${escapeHtml(getWishlistProductLabel(item))}</strong>
                  <span>${escapeHtml(getWishlistProductVariant(item))} · ${escapeHtml(getWishlistProductPrice(item))}</span>
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

    els.accountDrawer.classList.toggle('account-drawer--influencer', state.accountActiveSection === 'account-influencer');
    const activeSection = state.accountActiveSection || '';
    els.accountDrawerContent.querySelectorAll('[data-account-section]').forEach((section) => {
      section.hidden = !activeSection || section.dataset.accountSection !== activeSection;
    });

    document.getElementById('merchLogoutBtn')?.addEventListener('click', handleLogout);
    bindAccountDrawerActions();
  }

  function renderAddressForm(address = null) {
    const isEdit = state.accountAddressFormMode === 'edit';
    const value = (key, fallback = '') => escapeHtml(String(address?.[key] || fallback));
    const phoneParsed = parseCheckoutPhone(address?.phone || '');
    const currentCountry = normalizeCheckoutCountry(address?.country || 'India');
    const isIndia = currentCountry === 'India';
    const isUS = currentCountry === 'United States';
    const postalPlaceholder = isUS ? 'ZIP code' : (isIndia ? '6-digit PIN code' : 'Postal code');
    const postalInputMode = isIndia ? 'numeric' : 'text';
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
            <div class="checkout-phone-control">
              <select name="phoneCountryCode" aria-label="Phone country code" autocomplete="tel-country-code">
                ${CHECKOUT_PHONE_COUNTRY_CODES.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === phoneParsed.countryCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
              </select>
              <input name="phone" type="tel" inputmode="numeric" maxlength="15" value="${escapeHtml(phoneParsed.localNumber)}" autocomplete="tel-national" placeholder="Mobile number" required />
            </div>
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
            <input name="postalCode" type="text" value="${value('postalCode')}" autocomplete="postal-code" inputmode="${postalInputMode}" maxlength="10" placeholder="${postalPlaceholder}" />
          </label>
          <label class="account-field">
            <span>Country</span>
            <select name="country" autocomplete="country-name">
              ${CHECKOUT_COUNTRIES.map((country) => `<option value="${escapeHtml(country)}" ${country === currentCountry ? 'selected' : ''}>${escapeHtml(country)}</option>`).join('')}
            </select>
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
    const profileForm = document.getElementById('accountProfileForm');
    profileForm?.addEventListener('input', handleAddressAndNameInputs);
    profileForm?.addEventListener('submit', handleProfileSubmit);

    const addressForm = document.getElementById('accountAddressForm');
    addressForm?.addEventListener('input', handleAddressAndNameInputs);
    addressForm?.addEventListener('submit', handleAddressSubmit);
    document.getElementById('influencerProfileForm')?.addEventListener('submit', handleInfluencerProfileSubmit);
    document.getElementById('accountOrderFilterForm')?.addEventListener('submit', handleAccountOrderFilterSubmit);

    els.accountDrawerContent?.querySelectorAll('[data-account-action]').forEach((button) => {
      button.addEventListener('click', () => handleAccountAction(button));
    });

    els.accountDrawerContent?.querySelectorAll('[data-account-nav]').forEach((button) => {
      button.addEventListener('click', () => {
        const targetSection = button.dataset.accountNav || 'account-profile';
        if (targetSection === 'cart') {
          closeAccountDrawer();
          openCartDrawer();
          return;
        }
        state.accountActiveSection = targetSection;
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
    return (Array.isArray(state.merchOrders) ? state.merchOrders : []).find(
      (order) => String(order.id || '') === String(orderId || '') || String(order.orderNumber || '') === String(orderId || '')
    );
  }

  function canCancelMerchOrder(order) {
    const status = String(order?.status || '').trim().toLowerCase();
    return Boolean(status) && !['delivered', 'returned', 'cancelled'].includes(status);
  }

  async function cancelMerchOrder(order) {
    if (!order || !canCancelMerchOrder(order)) {
      showCheckoutNotice('Cancellation unavailable', 'This order has already been shipped or completed.', { variant: 'error' });
      return;
    }
    const isPending = (String(order.status || '').toLowerCase() === 'pending' || String(order.paymentStatus || '').toLowerCase() === 'pending') && String(order.status || '').toLowerCase() !== 'cancelled';
    const confirmPrompt = isPending
      ? `Cancel ${order.orderNumber || `Order #${order.id}`}? This order will be removed from your orders.`
      : `Cancel ${order.orderNumber || `Order #${order.id}`}? No refund.`;
    if (!window.confirm(confirmPrompt)) return;
    try {
      const result = await api(`/api/merch/orders/${encodeURIComponent(order.id)}/cancel`, { method: 'POST' });
      if (result?.removed || isPending) {
        state.merchOrders = (Array.isArray(state.merchOrders) ? state.merchOrders : []).filter((item) => String(item.id) !== String(order.id));
        renderAccountDrawer();
        showCheckoutNotice('Order cancelled', `${order.orderNumber || `Order #${order.id}`} was cancelled and removed.`);
      } else {
        state.merchOrders = state.merchOrders.map((item) => String(item.id) === String(order.id) ? (result.order || { ...order, status: 'cancelled', paymentStatus: order.paymentStatus }) : item);
        renderAccountDrawer();
        showCheckoutNotice('Order cancelled', `${order.orderNumber || `Order #${order.id}`} was cancelled successfully.`);
      }
    } catch (error) {
      showCheckoutNotice('Cancellation unavailable', error.message || 'Unable to cancel this order.', { variant: 'error' });
    }
  }

  async function proceedToCheckoutFromOrder(order) {
    if (!order) return;
    closeMerchModal();
    if (state.accountDrawerOpen) closeAccountDrawer();

    const items = Array.isArray(order.items) ? order.items : [];
    if (!items.length) {
      showCheckoutNotice('Order items unavailable', 'Unable to retrieve items for this order.', { variant: 'error' });
      return;
    }

    const restoredCart = [];
    for (const item of items) {
      const variantId = Number(item.variantId || item.variant_id || 0);
      let matchedProduct = null;
      let matchedVariant = null;
      if (variantId > 0 && Array.isArray(state.products)) {
        for (const p of state.products) {
          const v = (p.variants || []).find((vEntry) => Number(vEntry.id) === variantId);
          if (v) {
            matchedProduct = p;
            matchedVariant = v;
            break;
          }
        }
      }
      if (matchedProduct && matchedVariant) {
        restoredCart.push({
          variantId: matchedVariant.id,
          productId: matchedProduct.id,
          productName: matchedProduct.name,
          variantLabel: [matchedVariant.size, matchedVariant.color].filter(Boolean).join(' / ') || item.variantLabel || '',
          price: Number(matchedVariant.price || item.unitPrice || item.price || 0),
          originalPrice: null,
          discountLabel: null,
          offerName: null,
          quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
          image: getVariantImageUrl(matchedVariant, matchedProduct) || getItemImageForOrderModal(item),
          sku: matchedVariant.sku || item.sku || '',
        });
      } else {
        restoredCart.push({
          variantId: variantId || Number(item.id || 0),
          productId: item.productId || null,
          productName: item.productName || item.name || 'Product',
          variantLabel: item.variantLabel || '',
          price: Number(item.unitPrice || item.price || 0),
          originalPrice: null,
          discountLabel: null,
          offerName: null,
          quantity: Math.max(1, Number(item.quantity || item.qty || 1)),
          image: getItemImageForOrderModal(item),
          sku: item.sku || '',
        });
      }
    }

    if (restoredCart.length > 0) {
      state.cart = restoredCart;
      saveCart();
      syncCartToBackend(state.cart);
      renderCartBadge();
    }

    const couponCode = order.influencerCoupon || order.couponCode || order.coupon_code || '';
    if (couponCode) {
      state.merchCouponCode = couponCode;
      state.merchCouponPreview = { code: couponCode };
    }

    const addressData = parseOrderModalAddress(order.shippingAddress, order.customerName, order.customerPhone);
    let checkoutAddress = null;
    if (addressData) {
      const lineParts = Array.isArray(addressData.lines) ? addressData.lines : [];
      checkoutAddress = {
        recipientName: addressData.name || '',
        phone: addressData.phone || '',
        line1: lineParts[0] || '',
        line2: lineParts.slice(1, -1).join(', ') || '',
        city: '',
        state: '',
        postalCode: '',
        country: 'India',
      };
      if (typeof order.shippingAddress === 'string' && order.shippingAddress.trim().startsWith('{')) {
        try {
          const parsedRaw = JSON.parse(order.shippingAddress);
          checkoutAddress.line1 = parsedRaw.line1 || checkoutAddress.line1;
          checkoutAddress.line2 = parsedRaw.line2 || checkoutAddress.line2;
          checkoutAddress.city = parsedRaw.city || '';
          checkoutAddress.state = parsedRaw.state || '';
          checkoutAddress.postalCode = parsedRaw.postalCode || parsedRaw.postal_code || '';
          checkoutAddress.country = parsedRaw.country || 'India';
        } catch {}
      } else if (typeof order.shippingAddress === 'object' && order.shippingAddress !== null) {
        checkoutAddress.line1 = order.shippingAddress.line1 || checkoutAddress.line1;
        checkoutAddress.line2 = order.shippingAddress.line2 || checkoutAddress.line2;
        checkoutAddress.city = order.shippingAddress.city || '';
        checkoutAddress.state = order.shippingAddress.state || '';
        checkoutAddress.postalCode = order.shippingAddress.postalCode || order.shippingAddress.postal_code || '';
        checkoutAddress.country = order.shippingAddress.country || 'India';
      }
    }

    const customer = getAuthenticatedCheckoutCustomer(checkoutAddress);
    showCheckoutPage(customer, checkoutAddress ? serializeAddress(checkoutAddress) : null);
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

  function parseOrderModalAddress(raw, fallbackName = '', fallbackPhone = '') {
    if (!raw) return null;
    let obj = null;
    if (typeof raw === 'object') {
      obj = raw;
    } else {
      const trimmed = String(raw).trim();
      if (!trimmed) return null;
      try {
        if (trimmed.startsWith('{')) {
          obj = JSON.parse(trimmed);
        }
      } catch {}
      if (!obj) {
        const segments = trimmed.split(/\s+-\s+/).filter(Boolean);
        if (segments.length >= 3) {
          const name = segments[0];
          const phone = segments[1];
          const addressPart = segments.slice(2).join(', ');
          const lines = addressPart.split(/\s*,\s*/).filter(Boolean);
          return {
            name: name || fallbackName,
            phone: phone || fallbackPhone,
            lines: lines.length ? lines : [addressPart],
          };
        } else {
          const lines = trimmed.split(/\s*,\s*/).filter(Boolean);
          return {
            name: fallbackName,
            phone: fallbackPhone,
            lines: lines.length ? lines : [trimmed],
          };
        }
      }
    }

    if (obj) {
      const name = obj.recipientName || obj.recipient_name || obj.name || obj.fullName || fallbackName || '';
      const phone = obj.phone || obj.phoneNumber || fallbackPhone || '';
      const line1 = obj.line1 || obj.addressLine1 || '';
      const line2 = obj.line2 || obj.addressLine2 || '';
      const city = obj.city || '';
      const state = obj.state || '';
      const postalCode = obj.postalCode || obj.postal_code || obj.pincode || '';
      const country = obj.country || '';
      const lines = [];
      if (line1) lines.push(line1);
      if (line2) lines.push(line2);
      const cityStatePostal = [city, state && postalCode ? `${state} ${postalCode}` : (state || postalCode)].filter(Boolean).join(', ');
      if (cityStatePostal) lines.push(cityStatePostal);
      if (country) lines.push(country);
      if (!lines.length && obj.full) {
        lines.push(...obj.full.split(/\s*,\s*/).filter(Boolean));
      }
      return { name, phone, lines };
    }
    return null;
  }

  function formatOrderModalPhone(phone) {
    const raw = String(phone || '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+91 ${digits.slice(0, 4)} ${digits.slice(4)}`;
    if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 6)} ${digits.slice(6)}`;
    return raw;
  }

  function getItemImageForOrderModal(item) {
    if (!item) return getProductFallbackImage({});
    const rawImage = normalizeProductImageUrl(item.imageUrl || item.image || item.image_url || '');
    if (rawImage && !rawImage.includes('service-hydrogen-session')) return rawImage;

    const name = String(item.name || item.productName || '').trim();
    const variantId = Number(item.variantId || item.variant_id || 0);

    if (variantId > 0 && Array.isArray(state.products)) {
      for (const p of state.products) {
        const v = Array.isArray(p.variants) ? p.variants.find((v) => Number(v.id) === variantId) : null;
        if (v) {
          const vImg = getVariantImageUrl(v, p);
          if (vImg) return vImg;
        }
      }
    }

    if (name && Array.isArray(state.products)) {
      const p = state.products.find((entry) => String(entry.name || '').trim().toLowerCase() === name.toLowerCase());
      if (p) {
        const pImg = p.images?.[0] || p.imageUrl || getProductFallbackImage(p);
        if (pImg) return normalizeProductImageUrl(pImg);
      }
    }

    return getProductFallbackImage({ name, category: item.category });
  }

  function showOrderDetailsModal(order) {
    if (!order) {
      showCheckoutNotice('Order details', 'Order details are unavailable.');
      return;
    }

    const orderNumber = order.orderNumber || `Order #${order.id}`;
    const statusKey = String(order.status || 'processing').toLowerCase().replace(/[\s-]+/g, '_');
    const paymentStatusKey = String(order.paymentStatus || 'pending').toLowerCase();
    const couponApplied = order.influencerCoupon || order.couponCode || order.coupon_code || '';
    const items = Array.isArray(order.items) ? order.items : [];

    const shippingAddressData = parseOrderModalAddress(order.shippingAddress, order.customerName || order.guestName, order.customerPhone || order.guestPhone);
    const billingAddressData = parseOrderModalAddress(order.billingAddress, order.customerName || order.guestName, order.customerPhone || order.guestPhone);
    const isBillingSame = !order.billingAddress ||
      order.billingAddress === order.shippingAddress ||
      String(order.billingAddress).trim().toLowerCase() === String(order.shippingAddress || '').trim().toLowerCase();

    const bodyHtml = `
      <div class="order-modal-status-grid">
        <div class="order-modal-status-card">
          <span class="order-modal-status-card__label">Order Status</span>
          <span class="order-modal-status-pill order-modal-status-pill--${escapeHtml(statusKey)}">${escapeHtml(formatOrderStatus(order.status))}</span>
        </div>
        <div class="order-modal-status-card">
          <span class="order-modal-status-card__label">Payment Status</span>
          <span class="order-modal-status-pill order-modal-status-pill--${escapeHtml(paymentStatusKey)}">${escapeHtml(String(order.paymentStatus || 'Pending'))}</span>
        </div>
      </div>

      <div class="order-modal-info-block">
        <div class="order-modal-info-row">
          <span class="order-modal-info-label">Order Date</span>
          <strong class="order-modal-info-value">${escapeHtml(formatDateLabel(order.createdAt))}</strong>
        </div>
        <div class="order-modal-info-row">
          <span class="order-modal-info-label">Customer Type</span>
          <strong class="order-modal-info-value">${order.isGuest ? 'Guest customer' : 'Registered customer'}</strong>
        </div>
        <div class="order-modal-info-row">
          <span class="order-modal-info-label">Payment Method</span>
          <strong class="order-modal-info-value">${escapeHtml(order.paymentMethod || 'Online')}</strong>
        </div>
        <div class="order-modal-info-row order-modal-info-row--total">
          <span class="order-modal-info-label">Total</span>
          <strong class="order-modal-info-value">${order.totalAmount ? formatMoneyFromPaise(order.totalAmount) : '—'}</strong>
        </div>
        ${couponApplied ? `
        <div class="order-modal-info-row">
          <span class="order-modal-info-label">Coupon Applied</span>
          <strong class="order-modal-info-value">${escapeHtml(couponApplied)}</strong>
        </div>
        ` : ''}
        ${(order.trackingNumber || order.carrier) ? `
        <div class="order-modal-info-row">
          <span class="order-modal-info-label">Courier / AWB</span>
          <strong class="order-modal-info-value">${escapeHtml([order.carrier, order.trackingNumber].filter(Boolean).join(' - '))}</strong>
        </div>
        ` : ''}
      </div>

      ${items.length ? `
      <div>
        <p class="order-modal-section-title">Items Ordered (${items.length})</p>
        <div class="order-modal-items-block">
          ${items.map((item) => {
            const itemImg = getItemImageForOrderModal(item);
            const fallbackImg = getProductFallbackImage({ name: item.name || item.productName });
            return `
            <div class="order-modal-item-row">
              <img src="${escapeHtml(itemImg)}" alt="" class="order-modal-item-thumb" onerror="this.onerror=null;this.src='${escapeHtml(fallbackImg)}';" />
              <div class="order-modal-item-meta">
                <p class="order-modal-item-name">${escapeHtml(item.name || item.productName || 'Product')}</p>
                <p class="order-modal-item-variant">${escapeHtml([item.variantLabel, `Qty: ${item.quantity || item.qty || 1}`].filter(Boolean).join(' • '))}</p>
              </div>
              <strong class="order-modal-item-price">${formatMoneyFromPaise(item.lineTotal || ((item.price || item.unitPrice || 0) * (item.quantity || item.qty || 1)) || 0)}</strong>
            </div>
          `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <div class="order-modal-addresses-grid">
        <div class="order-modal-address-card">
          <p class="order-modal-address-card__title">SHIPPING ADDRESS</p>
          ${shippingAddressData ? `
            <p class="order-modal-address-card__name">${escapeHtml(shippingAddressData.name)}</p>
            ${shippingAddressData.phone ? `<p class="order-modal-address-card__phone">${escapeHtml(formatOrderModalPhone(shippingAddressData.phone))}</p>` : ''}
            <div class="order-modal-address-card__lines">
              ${shippingAddressData.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            </div>
          ` : `<p class="order-modal-address-card__lines">Address unavailable</p>`}
        </div>

        <div class="order-modal-address-card">
          <p class="order-modal-address-card__title">BILLING ADDRESS</p>
          ${isBillingSame ? `
            <p class="order-modal-address-card__same">Same as shipping address</p>
          ` : (billingAddressData ? `
            <p class="order-modal-address-card__name">${escapeHtml(billingAddressData.name)}</p>
            ${billingAddressData.phone ? `<p class="order-modal-address-card__phone">${escapeHtml(formatOrderModalPhone(billingAddressData.phone))}</p>` : ''}
            <div class="order-modal-address-card__lines">
              ${billingAddressData.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}
            </div>
          ` : `<p class="order-modal-address-card__lines">Address unavailable</p>`)}
        </div>
      </div>
    `;

    const isOrderPending = (statusKey === 'pending' || paymentStatusKey === 'pending') && statusKey !== 'cancelled';

    const footerHtml = isOrderPending ? `
      <button type="button" class="btn btn-outline" style="color: #dc2626; border-color: #fca5a5;" data-order-modal-action="cancel" data-order-id="${escapeHtml(String(order.id || ''))}">Cancel</button>
      <button type="button" class="btn btn-primary" data-order-modal-action="proceed-checkout" data-order-id="${escapeHtml(String(order.id || ''))}">Proceed to Checkout</button>
    ` : `
      ${canCancelMerchOrder(order) ? `<button type="button" class="btn btn-outline" style="color: #dc2626; border-color: #fca5a5;" data-order-modal-action="cancel" data-order-id="${escapeHtml(String(order.id || ''))}">Cancel Order</button>` : ''}
      <button type="button" class="btn btn-outline" data-order-modal-action="invoice" data-order-id="${escapeHtml(String(order.id || ''))}">Invoice</button>
      <button type="button" class="btn btn-primary" data-order-modal-action="track" data-order-id="${escapeHtml(String(order.id || ''))}">Track Order</button>
    `;

    const modal = showMerchModal({
      eyebrow: 'HOUSE MERCH',
      title: orderNumber,
      body: bodyHtml,
      footer: footerHtml,
      panelClass: 'merch-order-details-modal',
    });

    modal.querySelector('[data-order-modal-action="cancel"]')?.addEventListener('click', async () => {
      closeMerchModal();
      await cancelMerchOrder(order);
    });

    modal.querySelector('[data-order-modal-action="proceed-checkout"]')?.addEventListener('click', async () => {
      await proceedToCheckoutFromOrder(order);
    });

    modal.querySelector('[data-order-modal-action="invoice"]')?.addEventListener('click', async () => {
      await openMerchInvoice(order.id);
    });

    modal.querySelector('[data-order-modal-action="track"]')?.addEventListener('click', () => {
      closeMerchModal();
      if (state.accountDrawerOpen) closeAccountDrawer();
      window.location.hash = `track-order/${encodeURIComponent(order.id)}`;
    });
  }

  async function handleAccountAction(button) {
    const action = button.dataset.accountAction;

    if (action === 'influencer-back') {
      state.accountActiveSection = 'account-orders';
      renderAccountDrawer();
      return;
    }

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
      const orderId = button.dataset.orderId;
      const order = getOrderById(orderId);
      if (order) {
        showOrderDetailsModal(order);
      } else {
        api(`/api/merch/orders/${encodeURIComponent(orderId)}/tracking`)
          .then((res) => showOrderDetailsModal(res?.order))
          .catch(() => showOrderDetailsModal(null));
      }
      return;
    }

    if (action === 'track-order') {
      if (button.dataset.orderId) {
        window.location.hash = `track-order/${encodeURIComponent(button.dataset.orderId)}`;
      }
      return;
    }

    if (action === 'proceed-checkout') {
      const orderId = button.dataset.orderId;
      const order = getOrderById(orderId);
      if (order) {
        await proceedToCheckoutFromOrder(order);
      } else {
        api(`/api/merch/orders/${encodeURIComponent(orderId)}/tracking`)
          .then((res) => res?.order && proceedToCheckoutFromOrder(res.order))
          .catch(() => showCheckoutNotice('Order unavailable', 'Could not open checkout for this order.', { variant: 'error' }));
      }
      return;
    }

    if (action === 'cancel-order') {
      await cancelMerchOrder(getOrderById(button.dataset.orderId));
      return;
    }

    if (action === 'invoice-order') {
      await openMerchInvoice(button.dataset.orderId);
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
      const item = state.merchWishlistItems.find((entry) => String(entry.id || '') === String(button.dataset.wishlistId || ''));
      if (!item) return;
      try {
        await removeWishlistItem(item);
        renderWishlistBadge();
        renderAccountDrawer();
      } catch (error) {
        showCheckoutNotice('Wishlist update failed', error?.message || 'Please try again.', { variant: 'error' });
      }
      return;
    }

    if (action === 'wishlist-move') {
      const item = state.merchWishlistItems.find((entry) => String(entry.id || '') === String(button.dataset.wishlistId || ''));
      if (item) await moveWishlistItemToCart(item);
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

    if (action === 'copy-influencer-link') {
      const url = String(button.dataset.campaignUrl || '').trim();
      if (!url) return;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
        }
        showCheckoutNotice('Copied', `Story link copied to clipboard.`);
      } catch {
        prompt('Copy your Instagram story link:', url);
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
    const opened = window.open(targetUrl, '_blank');
    if (!opened || opened.closed || typeof opened.closed === 'undefined') {
      // Mobile Safari / popup blocked: open directly so user can view/download
      window.location.assign(targetUrl);
      return;
    }
    try {
      opened.opener = null;
    } catch {
      // Some browsers restrict access to the opened window; the invoice tab still opened.
    }
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
    const emailVal = String(formData.get('email') || '').trim();
    const mobileCountryCode = String(formData.get('mobileCountryCode') || '+91').trim();
    const rawMobile = String(formData.get('mobile') || '').trim();
    const mobile = rawMobile ? formatE164Phone(rawMobile, mobileCountryCode) : '';
    const payload = {
      fullName: String(formData.get('fullName') || '').trim(),
      mobile,
    };
    if (!payload.fullName) {
      state.accountProfileMessage = 'Full name is required.';
      renderAccountDrawer();
      return;
    }
    if (!isValidName(payload.fullName)) {
      state.accountProfileMessage = 'Name should contain letters and spaces only.';
      renderAccountDrawer();
      return;
    }
    if (payload.mobile && !isValidPhoneNumber(payload.mobile, mobileCountryCode)) {
      state.accountProfileMessage = getPhoneErrorMessage(mobileCountryCode);
      renderAccountDrawer();
      return;
    }
    if (emailVal && hasRealEmail(emailVal)) {
      payload.email = emailVal;
    }

    try {
      const result = await api('/api/merch/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      state.merchProfile = result.profile || { ...(state.merchProfile || {}), ...payload };
      if (state.currentUser) {
        state.currentUser = {
          ...state.currentUser,
          name: payload.fullName,
          mobile: payload.mobile,
          ...(payload.email ? { email: payload.email } : {}),
        };
      }
      state.accountProfileEditing = false;
      state.accountProfileMessage = 'Profile saved.';
      state.accountProfileIsError = false;
    } catch (err) {
      state.accountProfileMessage = err.message || 'Unable to update profile.';
      state.accountProfileIsError = true;
    }

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
    const country = String(formData.get('country') || 'India').trim() || 'India';
    const phoneCountryCode = String(formData.get('phoneCountryCode') || '').trim();
    const rawPhone = String(formData.get('phone') || '').trim();
    const phone = phoneCountryCode ? formatE164Phone(rawPhone, phoneCountryCode) : rawPhone;

    return {
      label: String(formData.get('label') || '').trim(),
      recipientName: String(formData.get('recipientName') || '').trim(),
      phone,
      phoneCountryCode: phoneCountryCode || (parseCheckoutPhone(phone).countryCode),
      line1: String(formData.get('line1') || '').trim(),
      line2: String(formData.get('line2') || '').trim(),
      city: String(formData.get('city') || '').trim(),
      state: String(formData.get('state') || '').trim(),
      postalCode: String(formData.get('postalCode') || '').trim(),
      country,
      isDefault: formData.get('isDefault') === 'on',
    };
  }

  async function handleAddressSubmit(event) {
    event.preventDefault();
    const payload = getAddressPayload(event.currentTarget);
    if (!payload.recipientName) {
      state.accountAddressMessage = 'Recipient name is required.';
      renderAccountDrawer();
      return;
    }
    if (!isValidName(payload.recipientName)) {
      state.accountAddressMessage = 'Name should contain letters and spaces only.';
      renderAccountDrawer();
      return;
    }
    if (!isValidPhoneNumber(payload.phone, payload.phoneCountryCode)) {
      state.accountAddressMessage = getPhoneErrorMessage(payload.phoneCountryCode);
      renderAccountDrawer();
      return;
    }
    if (!payload.line1 || !isValidAddress(payload.line1)) {
      state.accountAddressMessage = 'Enter a valid address.';
      renderAccountDrawer();
      return;
    }
    if (payload.city && !isValidCityOrState(payload.city)) {
      state.accountAddressMessage = 'Enter a valid city name.';
      renderAccountDrawer();
      return;
    }
    if (payload.state && !isValidCityOrState(payload.state)) {
      state.accountAddressMessage = 'Enter a valid state name.';
      renderAccountDrawer();
      return;
    }
    if (payload.postalCode && !isValidPostalCode(payload.postalCode, payload.country)) {
      state.accountAddressMessage = getPostalCodeErrorMessage(payload.country);
      renderAccountDrawer();
      return;
    }
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

  async function openAccountDrawer(initialSection = 'account-orders') {
    if (!els.accountDrawer) return;
    if (!state.authResolved) await loadCustomerContext();

    state.accountDrawerOpen = true;
    state.accountDrawerTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.accountActiveSection = initialSection;
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

    // 1. Clear promotional state and legacy storage (do NOT delete guest cart)
    state.cart = [];
    state.cartOwnerId = null;
    state.merchBundleCode = '';
    state.merchCouponCode = '';
    state.merchCouponPreview = null;
    state.merchCouponError = '';

    cleanupLegacySharedCartStorage();

    // 2. Clear user state
    state.currentUser = null;
    state.merchProfile = null;
    state.merchOrders = [];
    state.merchAddresses = [];
    state.merchWishlistItems = [];
    renderWishlistBadge();
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

    // 3. Switch back to guest state: restore isolated guest cart
    loadCart(null);
    renderCartBadge();
    if (state.cartDrawerOpen) renderCart();
    closeCart();

    // 3. Return to shop if on checkout page
    if (state.currentView === 'checkout') {
      showShop();
    }

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

    if (['bottles', 'sprays'].includes(String(state.selectedCategory || '').toLowerCase())) {
      products = products.flatMap((product) => {
        const variants = [];
        const seenColors = new Set();
        for (const variant of Array.isArray(product.variants) ? product.variants : []) {
          const color = String(variant.color || '').trim();
          if (!color || seenColors.has(color)) continue;
          seenColors.add(color);
          variants.push({ ...product, displayVariant: variant });
        }
        return variants.length ? variants : [product];
      });
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

  function renderProductCard(product, hypeLabel = '') {
      const displayVariant = product.displayVariant || getDefaultPurchasableVariant(product);
      const isSoldOut = !displayVariant || Number(displayVariant.stock || 0) <= 0;
      const presentation = getProductCardPresentation(product);
      const offerInfo = getVariantOfferDetails(displayVariant, product);
      const isHoodie = isHoodieProduct(product);
      const normalizedCategory = String(product.category || '').toLowerCase();
      const normalizedName = String(product.name || '').toLowerCase();
      const isMist = normalizedCategory.includes('mist') || normalizedCategory === 'sprays'
        || normalizedName.includes('mist') || normalizedName.includes('spray');
      const isBottle = normalizedCategory.includes('bottle') || normalizedCategory === 'bottles'
        || normalizedName.includes('bottle');
      const isHoodieCombo = Boolean(product.isCombo) && Array.isArray(product.comboItems)
        && product.comboItems.some((item) => String(item.productName || item.name || '').toLowerCase().includes('hoodie'));
      const cardImage = displayVariant
        ? getVariantImageUrl(displayVariant, product)
        : (isHoodie || isHoodieCombo
          ? HOODIE_CARD_IMAGE
          : (product.images?.[0] || product.imageUrl || getProductFallbackImage(product)));
      const cardSizes = displayVariant?.size ? [displayVariant.size] : [];
      const cardColors = displayVariant?.color ? [displayVariant.color] : [];
      const cardSpecifications = Object.entries(getProductSpecifications(product, displayVariant))
        .filter(([label, value]) => String(label).trim() && String(value).trim())
        .slice(0, 2);
      const stockLabel = isSoldOut
        ? (isHoodie ? 'Sold out' : 'Out of stock')
        : Number(displayVariant?.stock || 0) <= LOW_STOCK_THRESHOLD
          ? `Low stock · ${Number(displayVariant.stock)} left`
          : `In stock · ${Number(displayVariant.stock)} available`;
      const cardClasses = [
        isHoodie ? 'product-card--hoodie' : '',
        isMist ? 'product-card--mist' : '',
        isBottle ? 'product-card--bottle' : '',
        isHoodieCombo ? 'product-card--hoodie-combo' : '',
      ].filter(Boolean).join(' ');
      return `
      <article class="product-card ${cardClasses}" data-product-id="${product.id}" data-variant-id="${escapeHtml(displayVariant?.id || '')}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.name)} ${escapeHtml(displayVariant?.color || '')}">
        <div class="product-card__image">
          <div class="product-card__badges">
            ${offerInfo ? `<span class="product-card__badge product-card__badge--offer">${escapeHtml(offerInfo.discountLabel)}</span>` : `<span class="product-card__badge">${escapeHtml(presentation.badge)}</span>`}
            ${hypeLabel ? `<span class="product-card__badge product-card__badge--hype">${escapeHtml(hypeLabel)}</span>` : ''}
            ${isSoldOut ? '<span class="product-card__badge product-card__badge--sold-out">Sold out</span>' : ''}
          </div>
          <button class="product-card__wishlist${isProductWishlisted(product, displayVariant) ? ' is-selected' : ''}" type="button" aria-label="${isProductWishlisted(product, displayVariant) ? 'Remove' : 'Add'} ${escapeHtml(product.name)} ${isProductWishlisted(product, displayVariant) ? 'from' : 'to'} wishlist" title="Wishlist" aria-pressed="${isProductWishlisted(product, displayVariant)}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10.1-8.8 10.1S3.2 14 3.2 8.8A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>
          </button>
          <div class="product-card__annotation" aria-hidden="true">
            <span>${escapeHtml(presentation.annotation)}</span>
            <svg viewBox="0 0 92 54"><path d="M5 7c2 29 26 41 70 34" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="m67 34 9 7-11 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
          <img src="${escapeHtml(cardImage)}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(getCategoryLabel(product.category))}</p>
          <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
          ${(cardSizes.length || cardColors.length) ? `<p class="product-card__variant">${cardSizes.length ? `Size: ${cardSizes.join(', ')}` : ''}${cardSizes.length && cardColors.length ? ' · ' : ''}${cardColors.length ? `Color: ${cardColors.join(', ')}` : ''}</p>` : ''}
          ${cardSpecifications.length ? `<div class="product-card__specs">${cardSpecifications.map(([label, value]) => `<span><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</span>`).join('')}</div>` : ''}
          <p class="product-card__stock ${isSoldOut ? 'out-of-stock' : Number(displayVariant?.stock || 0) <= LOW_STOCK_THRESHOLD ? 'low-stock' : 'in-stock'}">${escapeHtml(stockLabel)}</p>
          <div class="product-card__rating" aria-label="${escapeHtml(`${presentation.stars} (${presentation.reviews} reviews)`) }">
            <span class="product-card__stars" aria-hidden="true">${presentation.stars}</span>
            <span>(${presentation.reviews})</span>
          </div>
          <p class="product-card__price">
            ${offerInfo ? `
              <span class="product-card__price-original" style="text-decoration:line-through;color:var(--text-muted);font-size:0.88em;margin-right:6px;">${formatPrice(offerInfo.originalPrice)}</span>
              <strong class="product-card__price-discounted" style="color:var(--primary-dark);font-weight:700;">${formatPrice(offerInfo.offerPrice)}</strong>
            ` : (product.displayVariant ? formatPrice(displayVariant.price) : `${product.variants.length > 1 ? '<span class="price-from">From </span>' : ''}${getPriceRange(product)}`)}
          </p>
          <div class="product-card__actions">
            <button class="btn btn-secondary product-card__action" type="button" data-product-action="add-to-cart" data-product-id="${product.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? (isHoodie ? 'Sold Out' : 'Out of Stock') : 'Add to Cart'}
            </button>
            <button class="btn btn-outline product-card__action" type="button" data-product-action="buy-now" data-product-id="${product.id}" ${isSoldOut ? 'disabled' : ''}>
              ${isSoldOut ? 'Unavailable' : 'Buy Now'}
            </button>
          </div>
        </div>
      </article>
    `;
  }

  function bindProductCards(container) {
    if (!container) return;
    container.querySelectorAll('.product-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = Number(card.dataset.productId);
        showProductDetail(id, card.dataset.variantId);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const id = Number(card.dataset.productId);
          showProductDetail(id, card.dataset.variantId);
        }
      });
    });

    container.querySelectorAll('[data-product-action]').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const product = state.products.find((item) => Number(item.id) === Number(button.dataset.productId));
        if (!product) return;
        await handleProductCardAction(button.dataset.productAction, product, button.closest('.product-card')?.dataset.variantId);
      });
    });

    container.querySelectorAll('.product-card__wishlist').forEach((button) => {
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        const card = button.closest('.product-card');
        const product = state.products.find((item) => Number(item.id) === Number(card?.dataset.productId));
        const variant = product
          ? product.variants.find((item) => String(item.id) === String(card?.dataset.variantId)) || getDefaultPurchasableVariant(product)
          : null;
        await handleWishlistAction(button, product, variant);
      });
    });
  }

  function renderProductGrid() {
    const products = getFilteredProducts();

    if (products.length === 0) {
      els.productGrid.innerHTML = '';
      els.productEmpty.hidden = false;
      return;
    }

    els.productEmpty.hidden = true;
    els.productGrid.innerHTML = products.map((product) => renderProductCard(product)).join('');
    bindProductCards(els.productGrid);
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
  function showProductDetail(productId, variantId = null) {
    const product = state.products.find(p => Number(p.id) === Number(productId));
    if (!product) return;

    state.currentView = 'detail';
    state.selectedProduct = product;
    let targetVariant = null;
    if (variantId) {
      targetVariant = product.variants.find((variant) => String(variant.id) === String(variantId));
    }
    if (!targetVariant) {
      targetVariant = product.variants.find((v) => getVariantOfferDetails(v, product) !== null && Number(v.stock || 0) > 0)
        || product.variants.find((variant) => String(variant.id) === String(variantId))
        || getDefaultPurchasableVariant(product);
    }
    state.selectedVariant = targetVariant;
    state.quantity = 1;

    // Hide shop, show detail
    els.shopSection.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
    const _shopOffersSection = document.getElementById('shopOffersSection');
    if (_shopOffersSection) _shopOffersSection.hidden = true;
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
    const _shopOffersSection2 = document.getElementById('shopOffersSection');
    if (_shopOffersSection2) _shopOffersSection2.hidden = state.offers.length === 0;
    if (window.location.hash === '#booking-confirmation' || window.location.hash === '#checkout' || getTrackingOrderIdFromHash() || window.location.search) {
      history.replaceState(null, '', window.location.pathname);
    }
  }

  function renderProductGallery(product) {
    const slides = getProductGallerySlides(product, state.selectedVariant);
    const mainImage = getProductDetailMainImage(product, state.selectedVariant)
      || slides[0]?.src
      || getProductFallbackImage(product);
    els.productGallery.innerHTML = `
      <div class="gallery-main gallery-main--${escapeHtml(String(product.category || '').toLowerCase())}" tabindex="0" aria-label="${escapeHtml(product.name)} image gallery">
        <img id="galleryMainImg" src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${getProductFallbackImage(product)}'" />
        ${slides.some((slide) => slide.type === 'video') ? '<video id="galleryMainVideo" controls playsinline preload="metadata" hidden></video>' : ''}
        ${slides.length > 1 ? `
          <button class="gallery-nav gallery-nav--previous" type="button" data-gallery-direction="previous" aria-label="Previous product image">&#8592;</button>
          <button class="gallery-nav gallery-nav--next" type="button" data-gallery-direction="next" aria-label="Next product image">&#8594;</button>
          ` : ''}
      </div>
      ${slides.length > 1 ? `
        <div class="gallery-thumbs">
          ${slides.map((slide, i) => `
            <button class="gallery-thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}" type="button" aria-label="View ${escapeHtml(slide.label)}">
              <img src="${escapeHtml(slide.src)}" alt="" />
            </button>
          `).join('')}
        </div>
      ` : ''}
    `;

    let activeIndex = 0;
    const main = els.productGallery.querySelector('.gallery-main');
    const mainImageElement = document.getElementById('galleryMainImg');
    const mainVideoElement = document.getElementById('galleryMainVideo');
    const setActiveSlide = (nextIndex) => {
      activeIndex = (nextIndex + slides.length) % slides.length;
      const slide = slides[activeIndex];
      const isVideo = slide.type === 'video';
      mainImageElement.hidden = isVideo;
      if (mainVideoElement) {
        mainVideoElement.hidden = !isVideo;
        if (isVideo && mainVideoElement.src !== new URL(slide.src, window.location.href).href) {
          mainVideoElement.src = slide.src;
          mainVideoElement.load();
        }
      }
      if (!isVideo) {
        mainImageElement.src = slide.src;
        mainImageElement.alt = slide.label;
      }
      els.productGallery.querySelectorAll('.gallery-thumb').forEach((thumb, index) => {
        thumb.classList.toggle('is-active', index === activeIndex);
      });
      if (Number.isInteger(slide.productImageIndex)) {
        const galleryVariant = getGalleryVariantFromThumb(product, slide.productImageIndex);
        if (galleryVariant) {
          state.selectedVariant = galleryVariant;
          state.quantity = 1;
          renderProductInfo(product);
        }
      }
    };

    els.productGallery.querySelectorAll('.gallery-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => setActiveSlide(Number(thumb.dataset.index)));
    });

    els.productGallery.querySelectorAll('[data-gallery-direction]').forEach((button) => {
      button.addEventListener('click', () => setActiveSlide(activeIndex + (button.dataset.galleryDirection === 'next' ? 1 : -1)));
    });
    main.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') setActiveSlide(activeIndex + 1);
      if (event.key === 'ArrowLeft') setActiveSlide(activeIndex - 1);
    });
  }

  function getProductDetailMainImage(product, variant = state.selectedVariant) {
    const variantSources = getVariantImageSources(variant, product);
    if (variant && variantSources.length) return variantSources[0];

    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    const slug = String(product?.slug || '').toLowerCase();

    const isBottle =
      slug === 'molecular-hydrogen-water-bottle' ||
      category === 'bottles';
    const isMist =
      category === 'sprays' ||
      category.includes('mist') ||
      name.includes('mist') ||
      name.includes('spray');
    const isHoodie =
      category === 'hoodies' ||
      name.includes('hoodie');
    return isBottle
      ? BOTTLE_DETAIL_FEATURE_IMAGE
      : isMist
        ? getMistFeatureSlides(variant, product)[0].src
        : isHoodie
          ? HOODIE_DETAIL_FEATURE_IMAGE
          : (product.images?.[0] || product.imageUrl || getProductFallbackImage(product));
  }


  function updateProductDetailMainImage(product) {
    const image = document.getElementById('galleryMainImg');
    if (image) image.src = getProductDetailMainImage(product, state.selectedVariant);
  }

  function renderProductInfo(product) {
    const variant = state.selectedVariant;
    const isHoodie = isHoodieProduct(product);
    const offerInfo = getVariantOfferDetails(variant, product);
    const productDescription = isBottleProduct(product)
      ? 'Portable PEM/SPE electrolysis bottle. Generates hydrogen-rich water in 5 minutes. BPA-free, USB-C rechargeable.'
      : product.description;

    // Get unique sizes and colors
    const sizes = [...new Set(product.variants.map(v => v.size).filter(Boolean))];
    const colors = [...new Set(product.variants.map(v => v.color).filter(Boolean))];

    els.productInfo.innerHTML = `
      <p class="detail-kicker">${escapeHtml(getCategoryLabel(product.category))}</p>
      <h1 class="detail-title">${escapeHtml(product.name)}</h1>
      ${offerInfo ? `
        <div class="detail-offer-banner">
          <span class="detail-offer-badge">${escapeHtml(offerInfo.discountLabel)}</span>
          ${offerInfo.name ? `<span class="detail-offer-name">${escapeHtml(offerInfo.name)}</span>` : ''}
        </div>
        <div class="detail-pricing-row">
          <span class="detail-price__original">${formatPrice(offerInfo.originalPrice)}</span>
          <strong class="detail-price__discounted">${formatPrice(offerInfo.offerPrice)}</strong>
          <span class="detail-price__savings">Save ${formatPrice(offerInfo.savings)}</span>
        </div>
      ` : `
        <p class="detail-price">${formatPrice(variant.price)}</p>
      `}
      <p class="detail-description">${escapeHtml(productDescription)}</p>
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
              const hasOffer = v && getVariantOfferDetails(v, product) !== null;
              return `<button class="variant-option ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''} ${hasOffer ? 'has-offer' : ''}" 
                data-size="${escapeHtml(size)}" type="button" ${isDisabled ? 'disabled' : ''}>${escapeHtml(size)}${hasOffer ? ' <span class="variant-offer-dot" title="Special offer">•</span>' : ''}</button>`;
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
              const hasOffer = v && getVariantOfferDetails(v, product) !== null;
              return `<button class="variant-option ${isSelected ? 'is-selected' : ''} ${isDisabled ? 'is-disabled' : ''} ${hasOffer ? 'has-offer' : ''}"
                data-color="${escapeHtml(color)}" type="button" ${isDisabled ? 'disabled' : ''}>${escapeHtml(color)}${hasOffer ? ' <span class="variant-offer-dot" title="Special offer">•</span>' : ''}</button>`;
            }).join('')}
          </div>
        </div>
      ` : ''}

      ${isBottleProduct(product) ? `
        <div class="bottle-color-policy-notice" style="margin: 8px 0 14px; padding: 10px 12px; background: #fff8f5; border: 1px solid #f2e2d8; border-left: 3px solid #ae5431; border-radius: 6px; font-size: 12px; color: #4b5563; line-height: 1.45;">
          <strong style="color: #ae5431;">Bottle Color Disclaimer:</strong> The color of the bottle may vary depending on availability. Customers may receive the bottle in any available color, and a specific color cannot be guaranteed. Product images are for illustrative purposes only.
        </div>
      ` : ''}

      <div class="quantity-control">
        <label>Quantity</label>
        <button class="qty-btn" id="qtyDec" type="button">-</button>
        <span class="qty-value" id="qtyValue">${state.quantity}</span>
        <button class="qty-btn" id="qtyInc" type="button">+</button>
      </div>

      ${renderReplacementPolicyAccordion(product)}

      <div class="detail-actions">
        <button id="addToCartBtn" class="btn btn-primary btn-lg" type="button" ${variant.stock <= 0 ? 'disabled' : ''}>
          ${variant.stock <= 0 ? (isHoodie ? 'Sold Out' : 'Out of Stock') : 'Add to Cart'}
        </button>
        <button id="buyNowBtn" class="btn btn-secondary btn-lg" type="button" ${variant.stock <= 0 ? 'disabled' : ''}>
          ${variant.stock <= 0 ? 'Unavailable' : 'Buy Now'}
        </button>
        <button id="addToWishlistBtn" class="btn btn-outline btn-lg${isProductWishlisted(product, variant) ? ' is-selected' : ''}" type="button" aria-pressed="${isProductWishlisted(product, variant)}">${isProductWishlisted(product, variant) ? '♥ Wishlisted' : '♡ Wishlist'}</button>
      </div>

    `;

    const moreDetailsButton = document.getElementById('moreDetailsButton');
    const specificationsPanel = document.getElementById('productSpecifications');
    moreDetailsButton?.addEventListener('click', () => {
      const isOpen = !specificationsPanel.hidden;
      specificationsPanel.hidden = isOpen;
      moreDetailsButton.setAttribute('aria-expanded', String(!isOpen));
      moreDetailsButton.querySelector('span').textContent = isOpen ? '＋' : '−';
    });

    const replacementPolicyButton = document.getElementById('replacementPolicyButton');
    const replacementPolicyContent = document.getElementById('replacementPolicyContent');
    replacementPolicyButton?.addEventListener('click', () => {
      const isOpen = replacementPolicyButton.getAttribute('aria-expanded') === 'true';
      replacementPolicyButton.setAttribute('aria-expanded', String(!isOpen));
      replacementPolicyContent?.setAttribute('aria-hidden', String(isOpen));
      replacementPolicyButton.closest('.replacement-policy-accordion')?.classList.toggle('is-open', !isOpen);
      replacementPolicyButton.querySelector('.replacement-policy-accordion__toggle').textContent = isOpen ? '+' : '−';
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
          renderProductGallery(product);
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
          renderProductGallery(product);
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

    document.getElementById('addToWishlistBtn')?.addEventListener('click', (event) => {
      handleWishlistAction(event.currentTarget, product, state.selectedVariant);
    });
    syncWishlistControls();
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
        border-radius: 8px; transition: background 0.2s; touch-action: manipulation;
      ">
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

  function showMerchModal({ eyebrow = 'House Merch', title, body, footer = '', panelClass = '' }) {
    const modal = ensureMerchModal();
    const panel = modal.querySelector('.merch-flow-modal__panel');
    panel.className = 'merch-flow-modal__panel' + (panelClass ? ` ${panelClass}` : '');
    panel.innerHTML = `
      <div class="merch-flow-modal__header">
        <div>
          <p class="merch-flow-modal__eyebrow">${escapeHtml(eyebrow)}</p>
          <h3 class="order-modal-header__title">${escapeHtml(title)}</h3>
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

  function handleAddressAndNameInputs(event) {
    const target = event?.target;
    if (!target || !target.name) return;
    const name = target.name;

    if (name === 'phone' || name === 'mobile') {
      const form = target.form;
      const phoneCountryCode = form?.elements?.phoneCountryCode?.value || form?.elements?.mobileCountryCode?.value || state.checkoutDraft?.phoneCountryCode || '+91';
      const maxLen = (phoneCountryCode === '+91' || phoneCountryCode === '+1') ? 10 : (phoneCountryCode === '+44' ? 11 : 15);
      target.value = target.value.replace(/\D/g, '').slice(0, maxLen);
    } else if (name === 'postalCode') {
      const countryVal = target.form?.elements?.country?.value || state.checkoutDraft?.country;
      const countryNorm = normalizeCheckoutCountry(countryVal);
      if (countryNorm === 'United States') {
        target.value = target.value.replace(/[^\d-]/g, '').slice(0, 10);
      } else if (countryNorm === 'India') {
        target.value = target.value.replace(/\D/g, '').slice(0, 6);
      } else {
        target.value = target.value.replace(/[^A-Za-z0-9\s-]/g, '').slice(0, 10);
      }
    } else if (name === 'city' || name === 'state') {
      target.value = target.value.replace(/[0-9]/g, '');
    } else if (name === 'firstName' || name === 'lastName' || name === 'recipientName' || name === 'fullName') {
      target.value = target.value.replace(/[^A-Za-z\s]/g, '');
    }
  }

  function isValidName(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return false;
    return /^[A-Za-z]+(?:\s+[A-Za-z]+)*$/.test(trimmed);
  }

  function isValidAddress(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed.length < 3) return false;
    if (!/[A-Za-z0-9]/.test(trimmed)) return false;
    return /^[A-Za-z0-9\s,.\-#/()':;&+]+$/.test(trimmed);
  }

  function isValidCityOrState(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || trimmed.length < 2) return false;
    if (!/[A-Za-z]/.test(trimmed)) return false;
    if (/[0-9]/.test(trimmed)) return false;
    return /^[A-Za-z\s.'-]+$/.test(trimmed);
  }

  function getSavedGuestCheckoutDetails() {
    try {
      const saved = JSON.parse(window.localStorage?.getItem(CHECKOUT_DETAILS_STORAGE_KEY) || 'null');
      return saved && typeof saved === 'object' ? saved : {};
    } catch {
      return {};
    }
  }

  function saveGuestCheckoutDetails(draft = {}) {
    const details = {
      email: String(draft.email || '').trim(),
      phone: String(draft.phone || '').trim(),
      phoneCountryCode: String(draft.phoneCountryCode || '+91').trim(),
      firstName: String(draft.firstName || '').trim(),
      lastName: String(draft.lastName || '').trim(),
      country: normalizeCheckoutCountry(draft.country || 'India'),
      line1: String(draft.line1 || '').trim(),
      line2: String(draft.line2 || '').trim(),
      city: String(draft.city || '').trim(),
      state: String(draft.state || '').trim(),
      postalCode: String(draft.postalCode || '').trim(),
      emailOffers: Boolean(draft.emailOffers),
      saveInformation: true,
    };
    try {
      window.localStorage?.setItem(CHECKOUT_DETAILS_STORAGE_KEY, JSON.stringify(details));
    } catch {
      // Storage can be unavailable in private browsing; checkout can continue normally.
    }
  }

  function buildCheckoutDraft(customer = {}, address = {}) {
    const savedGuestDetails = !state.currentUser && !Object.keys(address || {}).length
      ? getSavedGuestCheckoutDetails()
      : {};
    const sourceAddress = Object.keys(address || {}).length ? address : savedGuestDetails;
    const savedName = [savedGuestDetails.firstName, savedGuestDetails.lastName].filter(Boolean).join(' ');
    const nameParts = String(customer?.name || address?.recipientName || savedName).trim().split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || '';
    const lastName = nameParts.join(' ');
    const phone = parseCheckoutPhone(customer?.phone || address?.phone || savedGuestDetails.phone || '');
    const email = hasRealEmail(customer?.email)
      ? String(customer.email).trim()
      : (hasRealEmail(savedGuestDetails.email) ? String(savedGuestDetails.email).trim() : '');
    return {
      email,
      phone: phone.localNumber,
      phoneCountryCode: phone.countryCode,
      firstName,
      lastName,
      addressId: sourceAddress?.id || null,
      country: normalizeCheckoutCountry(sourceAddress?.country || 'India'),
      line1: String(sourceAddress?.line1 || sourceAddress?.full || '').trim(),
      line2: String(sourceAddress?.line2 || '').trim(),
      city: String(sourceAddress?.city || '').trim(),
      state: String(sourceAddress?.state || '').trim(),
      postalCode: String(sourceAddress?.postalCode || '').trim(),
      emailOffers: savedGuestDetails.emailOffers ?? true,
      saveInformation: Boolean(sourceAddress?.isDefault || savedGuestDetails.saveInformation),
    };
  }

  function getCheckoutDraftFromForm(form) {
    const formData = new FormData(form);
    return {
      addressId: state.checkoutDraft?.addressId || null,
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim(),
      phoneCountryCode: String(formData.get('phoneCountryCode') || '+91').trim(),
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
        phone: getCheckoutPhonePayload(draft),
      },
      address: {
        id: draft.addressId || null,
        recipientName: fullName,
        phone: getCheckoutPhonePayload(draft),
        line1: String(draft.line1 || '').trim(),
        line2: String(draft.line2 || '').trim(),
        city: String(draft.city || '').trim(),
        state: String(draft.state || '').trim(),
        postalCode: String(draft.postalCode || '').trim(),
        country: normalizeCheckoutCountry(draft.country || 'India'),
        isDefault: Boolean(draft.saveInformation),
        full: [draft.line1, draft.line2, draft.city, draft.state, draft.postalCode, draft.country].filter(Boolean).join(', '),
      },
    };
  }

  async function persistCheckoutDetails(draft = state.checkoutDraft || {}) {
    if (state.currentUser) {
      const { address } = getCheckoutPayloadFromDraft(draft);
      const endpoint = address.id
        ? `/api/merch/addresses/${encodeURIComponent(address.id)}`
        : '/api/merch/addresses';
      const result = await api(endpoint, {
        method: address.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(address),
      });
      state.merchAddresses = Array.isArray(result.addresses) ? result.addresses : state.merchAddresses;
      syncCheckoutProfileDetails(address);
      return;
    }

    // Keep the last valid delivery details available for the next order. They
    // remain editable in the checkout form and can be replaced at any time.
    saveGuestCheckoutDetails(draft);
  }

  function validateCheckoutDraft(draft = {}) {
    const errors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const digitsOnly = (value) => String(value || '').replace(/\D+/g, '');

    if (draft.email) {
      if (!emailPattern.test(draft.email) || isPlaceholderEmail(draft.email)) {
        errors.email = 'Enter a valid email address.';
      }
    } else if (!state.currentUser && !draft.phone) {
      errors.email = 'Email or phone number is required.';
    }
    if (!draft.firstName) {
      errors.firstName = 'First name is required.';
    } else if (!isValidName(draft.firstName)) {
      errors.firstName = 'Name should contain letters and spaces only.';
    }
    if (!draft.lastName) {
      errors.lastName = 'Last name is required.';
    } else if (!isValidName(draft.lastName)) {
      errors.lastName = 'Name should contain letters and spaces only.';
    }
    if (!draft.country) {
      errors.country = 'Country is required.';
    }
    if (!draft.line1) {
      errors.line1 = 'Address is required.';
    } else if (!isValidAddress(draft.line1)) {
      errors.line1 = 'Enter a valid address.';
    }
    if (draft.line2 && !isValidAddress(draft.line2)) {
      errors.line2 = 'Enter a valid address.';
    }
    if (!draft.city) {
      errors.city = 'City is required.';
    } else if (!isValidCityOrState(draft.city)) {
      errors.city = 'Enter a valid city name.';
    }
    if (!draft.state) {
      errors.state = 'State is required.';
    } else if (!isValidCityOrState(draft.state)) {
      errors.state = 'Enter a valid state name.';
    }
    if (!draft.postalCode) {
      errors.postalCode = normalizeCheckoutCountry(draft.country) === 'United States' ? 'ZIP code is required.' : (normalizeCheckoutCountry(draft.country) === 'India' ? 'PIN code is required.' : 'Postal code is required.');
    } else if (!isValidPostalCode(draft.postalCode, draft.country)) {
      errors.postalCode = getPostalCodeErrorMessage(draft.country);
    }
    if (!draft.phone) {
      errors.phone = 'Phone is required.';
    } else if (!isValidPhoneNumber(draft.phone, draft.phoneCountryCode)) {
      errors.phone = getPhoneErrorMessage(draft.phoneCountryCode);
    }

    return errors;
  }

  function fieldError(name) {
    const message = state.checkoutErrors?.[name];
    return message ? `<span class="checkout-field-error" id="checkout-${name}-error">${escapeHtml(message)}</span>` : '';
  }

  function renderCheckoutField({ name, label, value = '', type = 'text', placeholder = '', autocomplete = '', wide = false, icon = '', required = true, inputmode = '', maxlength = '' }) {
    const error = state.checkoutErrors?.[name];
    const inputmodeAttr = inputmode ? ` inputmode="${escapeHtml(inputmode)}"` : '';
    const maxlengthAttr = maxlength ? ` maxlength="${escapeHtml(String(maxlength))}"` : '';
    return `
      <label class="shopify-field${wide ? ' shopify-field--wide' : ''}${error ? ' has-error' : ''}">
        <span>${escapeHtml(label)}</span>
        <input name="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" autocomplete="${escapeHtml(autocomplete)}"${inputmodeAttr}${maxlengthAttr} ${required ? 'required' : ''} ${error ? `aria-describedby="checkout-${escapeHtml(name)}-error"` : ''} />
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

  function renderCheckoutPhoneField(draft = {}) {
    const error = state.checkoutErrors?.phone;
    const selectedCode = CHECKOUT_PHONE_COUNTRY_CODES.some((option) => option.value === draft.phoneCountryCode)
      ? draft.phoneCountryCode
      : '+91';
    const isIndiaOrUS = selectedCode === '+91' || selectedCode === '+1';
    const maxLen = isIndiaOrUS ? 10 : (selectedCode === '+44' ? 11 : 15);
    const placeholder = selectedCode === '+91'
      ? '10-digit mobile number'
      : (selectedCode === '+1' ? '10-digit mobile number' : (selectedCode === '+44' ? 'UK mobile number' : 'Mobile number'));
    return `
      <label class="shopify-field shopify-field--wide checkout-phone-field${error ? ' has-error' : ''}">
        <span>Phone</span>
        <div class="checkout-phone-control">
          <select name="phoneCountryCode" aria-label="Phone country code" autocomplete="tel-country-code">
            ${CHECKOUT_PHONE_COUNTRY_CODES.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === selectedCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
          </select>
          <input name="phone" type="tel" inputmode="numeric" maxlength="${maxLen}" value="${escapeHtml(draft.phone || '')}" placeholder="${placeholder}" autocomplete="tel-national" required ${error ? 'aria-describedby="checkout-phone-error"' : ''} />
        </div>
        ${fieldError('phone')}
      </label>
    `;
  }

  async function addMerchBundleToCheckoutOrder() {
    const bundleItems = getMerchBundleCartItems();
    if (bundleItems.length !== 2) {
      showCheckoutNotice('Bundle unavailable', 'The H2 Hydrogen Bottle and H2 Hydrogen Mist Spray must both be in stock.', { variant: 'error' });
      return false;
    }

    bundleItems.forEach(({ product, variant }) => {
      addToCart(variant.id, 1, product, { isBundle: true, openDrawerAfterAdd: false, preserveCoupon: true });
    });

    state.merchBundleCode = 'H2BUNDLE15';
    try {
      localStorage.setItem(getBundleStorageKey(state.cartOwnerId), state.merchBundleCode);
      localStorage.setItem('merch_bundle_code', state.merchBundleCode);
    } catch {}

    const hasInfluencer = hasActiveInfluencerCoupon();
    const isRyan = isRyanAttribution();
    if (!hasInfluencer || isRyan) {
      const bundleTotal = bundleItems.reduce((sum, item) => sum + Number(item.variant.price || 0), 0);
      const bundleOffer = Math.round(bundleTotal * 0.85);
      state.merchBundlePreview = {
        code: state.merchBundleCode,
        description: 'Bundle & Save — 15% off Bottle + Mist',
        discountAmountInr: Math.max(0, bundleTotal - bundleOffer),
      };
    } else {
      state.merchBundlePreview = null;
    }
    if (!state.merchCouponCode && state.campaignAttribution?.couponCode) {
      state.merchCouponCode = state.campaignAttribution.couponCode;
    }
    if (state.merchCouponCode || state.campaignAttribution?.slug) {
      await applyMerchCouponFromCart({ silent: true });
    }

    saveCart();
    showCheckoutToast(hasInfluencer
      ? 'Bottle + Mist Bundle added to order.'
      : 'Bottle + Mist Bundle added to order with 15% savings!');
    renderCheckoutPage();
    return true;
  }

  function renderCheckoutRecommendations() {
    const bundleDef = getMerchBundleDefinition();
    const hasBundle = bundleDef && bundleDef.products && bundleDef.products.length === 2 && bundleDef.available;

    const bundleProductIds = hasBundle ? new Set(bundleDef.products.map((p) => Number(p.id))) : new Set();
    const cartProductIds = new Set(state.cart.map((item) => Number(item.productId)));
    const promoProducts = (state.products || []).filter((product) => {
      if (cartProductIds.has(Number(product.id))) return false;
      if (bundleProductIds.has(Number(product.id))) return false;
      const activeVariants = (product.variants || []).filter((v) => Number(v.stock || 0) > 0);
      if (!activeVariants.length) return false;
      const variant = activeVariants[0];
      const offerInfo = variant ? getVariantOfferDetails(variant, product) : null;
      const effectivePrice = offerInfo ? offerInfo.offerPrice : Number(variant?.price || product.price || 0);
      const originalPrice = offerInfo ? offerInfo.originalPrice : (product.basePrice && product.basePrice > effectivePrice ? product.basePrice : null);
      // Strictly require an actual promotional discount so regular products (e.g. ₹11,900 Mist) are NEVER displayed as an offer
      return Boolean(originalPrice && originalPrice > effectivePrice);
    });

    if (!hasBundle && !promoProducts.length) return '';

    const isBundleInOrder = Boolean(getActiveBundleInfo());

    let bundleCardHtml = '';
    if (hasBundle) {
      const bottleProduct = bundleDef.products[0];
      const mistProduct = bundleDef.products[1];
      const bottleVariant = getDefaultPurchasableVariant(bottleProduct);
      const mistVariant = getDefaultPurchasableVariant(mistProduct);
      const bottlePrice = Number(bottleVariant?.price || bottleProduct.basePrice || 22990);
      const mistPrice = Number(mistVariant?.price || mistProduct.basePrice || 11900);
      const regularTotal = bottlePrice + mistPrice;
      const discountRate = Number(bundleDef.discount || 0.85);
      const bundleOfferPrice = Math.round(regularTotal * discountRate);
      const savingsAmount = regularTotal - bundleOfferPrice;
      const savingsPercent = Math.round((savingsAmount / regularTotal) * 100);

      const bottleImg = getVariantImageUrl(bottleVariant, bottleProduct) || bottleProduct.images?.[0] || FALLBACK_PRODUCT_IMAGE;
      const mistImg = getVariantImageUrl(mistVariant, mistProduct) || mistProduct.images?.[0] || FALLBACK_PRODUCT_IMAGE;

      bundleCardHtml = `
        <div class="checkout-rec-card checkout-rec-card--bundle" data-bundle-code="H2BUNDLE15">
          <div class="checkout-rec-bundle__header">
            <span class="checkout-rec-bundle__badge">SAVE ${savingsPercent}%</span>
            <span class="checkout-rec-bundle__tag">Bundle Offer</span>
          </div>
          <div class="checkout-rec-bundle__images">
            <div class="checkout-rec-bundle__img-item">
              <img src="${escapeHtml(bottleImg)}" alt="${escapeHtml(bottleProduct.name)}" loading="lazy" />
              <span>Bottle</span>
            </div>
            <span class="checkout-rec-bundle__plus" aria-hidden="true">+</span>
            <div class="checkout-rec-bundle__img-item">
              <img src="${escapeHtml(mistImg)}" alt="${escapeHtml(mistProduct.name)}" loading="lazy" />
              <span>Mist Spray</span>
            </div>
          </div>
          <div class="checkout-rec-bundle__info">
            <strong class="checkout-rec-bundle__name">Bottle + Mist Bundle</strong>
            <p class="checkout-rec-bundle__includes">Includes: ${escapeHtml(bottleProduct.name)} + ${escapeHtml(mistProduct.name)}</p>
            <div class="checkout-rec-bundle__pricing">
              <span class="checkout-rec-bundle__price">${formatCheckoutMoney(bundleOfferPrice)}</span>
              <span class="checkout-rec-bundle__original">${formatCheckoutMoney(regularTotal)}</span>
              <span class="checkout-rec-bundle__savings">Save ${formatCheckoutMoney(savingsAmount)} (${savingsPercent}% OFF)</span>
            </div>
          </div>
          <button type="button" class="checkout-rec-card__add-btn ${isBundleInOrder ? 'is-added' : ''}" data-checkout-add-bundle="H2BUNDLE15" ${isBundleInOrder ? 'disabled' : ''} aria-label="${isBundleInOrder ? 'Bundle already in order' : 'Add Bottle + Mist Bundle to order'}">
            ${isBundleInOrder ? '✓ ADDED' : '+ ADD'}
          </button>
        </div>
      `;
    }

    const promoCardsHtml = promoProducts.map((product) => {
      const variant = product.variants.find((v) => Number(v.stock || 0) > 0) || product.variants[0];
      const offerInfo = variant ? getVariantOfferDetails(variant, product) : null;
      const effectivePrice = offerInfo ? offerInfo.offerPrice : Number(variant?.price || product.price || 0);
      const originalPrice = offerInfo ? offerInfo.originalPrice : (product.basePrice && product.basePrice > effectivePrice ? product.basePrice : null);
      const discountLabel = offerInfo?.discountLabel || `${Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)}% OFF`;
      const imageUrl = variant?.imageUrl || product.imageUrl || product.image || (Array.isArray(product.images) && product.images[0]) || FALLBACK_PRODUCT_IMAGE;

      return `
        <div class="checkout-rec-card">
          <div class="checkout-rec-card__image-box">
            <span class="checkout-rec-card__badge">${escapeHtml(discountLabel)}</span>
            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />
          </div>
          <div class="checkout-rec-card__body">
            <strong class="checkout-rec-card__name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</strong>
            <div class="checkout-rec-card__pricing">
              <span class="checkout-rec-card__price">${formatCheckoutMoney(effectivePrice)}</span>
              <span class="checkout-rec-card__original">${formatCheckoutMoney(originalPrice)}</span>
            </div>
            <button type="button" class="checkout-rec-card__add-btn" data-checkout-add-variant="${variant.id}" data-checkout-add-product="${product.id}" aria-label="Add ${escapeHtml(product.name)} to cart">
              + ADD
            </button>
          </div>
        </div>
      `;
    }).join('');

    const totalOfferCount = (hasBundle ? 1 : 0) + promoProducts.length;

    return `
      <div class="checkout-recommendations" aria-label="Best offers">
        <div class="checkout-recommendations__header">
          <div class="checkout-recommendations__title-wrap">
            <span class="checkout-recommendations__title">BEST OFFERS</span>
            <span class="checkout-recommendations__sub">Explore more</span>
          </div>
          <div class="checkout-recommendations__nav">
            <button type="button" class="checkout-rec-nav checkout-rec-nav--prev" aria-label="Previous items" data-action="rec-scroll-prev" hidden>‹</button>
            <button type="button" class="checkout-rec-nav checkout-rec-nav--next" aria-label="Next items" data-action="rec-scroll-next" ${totalOfferCount > 2 ? '' : 'hidden'}>›</button>
          </div>
        </div>
        <div class="checkout-recommendations__scroll-wrap">
          <div class="checkout-recommendations__track" id="checkoutRecTrack">
            ${bundleCardHtml}
            ${promoCardsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function showCheckoutToast(message) {
    let toast = document.getElementById('checkoutToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'checkoutToast';
      toast.className = 'checkout-toast';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `
      <span class="checkout-toast__icon">✓</span>
      <span>${escapeHtml(message)}</span>
    `;
    toast.classList.add('is-visible');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3000);
  }

  async function openCheckoutAddProductsDrawer() {
    if (!els.checkoutAddProductsDrawer) return;
    const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
    if (form) {
      state.checkoutDraft = getCheckoutDraftFromForm(form);
    }
    if (!state.products || !state.products.length) {
      if (els.checkoutAddProductsList) {
        els.checkoutAddProductsList.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#6f6f6f;"><p>Loading products...</p></div>';
      }
      await loadMerchProducts();
    }
    renderCheckoutAddProductsList();
    els.checkoutAddProductsDrawer.hidden = false;
    if (els.checkoutAddProductsOverlay) els.checkoutAddProductsOverlay.hidden = false;
    requestAnimationFrame(() => {
      els.checkoutAddProductsDrawer.classList.add('is-open');
      if (els.checkoutAddProductsOverlay) els.checkoutAddProductsOverlay.classList.add('is-open');
    });
    document.body.classList.add('has-drawer-open');
  }

  function closeCheckoutAddProductsDrawer() {
    if (!els.checkoutAddProductsDrawer) return;
    els.checkoutAddProductsDrawer.classList.remove('is-open');
    if (els.checkoutAddProductsOverlay) els.checkoutAddProductsOverlay.classList.remove('is-open');
    document.body.classList.remove('has-drawer-open');
    setTimeout(() => {
      els.checkoutAddProductsDrawer.hidden = true;
      if (els.checkoutAddProductsOverlay) els.checkoutAddProductsOverlay.hidden = true;
    }, 300);
  }

  function renderCheckoutAddProductsList() {
    if (!els.checkoutAddProductsList) return;
    const products = Array.isArray(state.products) ? state.products : [];

    const availableProducts = products.filter((p) => {
      const inStockVariants = (p.variants || []).filter((v) => Number(v.stock || 0) > 0);
      return inStockVariants.length > 0;
    });

    if (!availableProducts.length) {
      els.checkoutAddProductsList.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:#6f6f6f;">
          <p style="font-size:1rem;margin:0 0 8px 0;font-weight:600;">No additional products available</p>
          <small>All current items are already in your cart or out of stock.</small>
        </div>
      `;
      return;
    }

    els.checkoutAddProductsList.innerHTML = availableProducts.map((product) => {
      const activeVariants = (product.variants || []).filter((v) => Number(v.stock || 0) > 0);
      const firstVariant = activeVariants[0];
      const offerInfo = firstVariant ? getVariantOfferDetails(firstVariant, product) : null;
      const effectivePrice = offerInfo ? offerInfo.offerPrice : Number(firstVariant?.price || product.price || 0);
      const originalPrice = offerInfo ? offerInfo.originalPrice : (product.basePrice && product.basePrice > effectivePrice ? product.basePrice : null);
      const discountLabel = offerInfo?.discountLabel || (originalPrice && originalPrice > effectivePrice ? `${Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)}% OFF` : '');
      const imageUrl = getVariantImageUrl(firstVariant, product) || FALLBACK_PRODUCT_IMAGE;

      const inCartQty = state.cart.filter((item) => Number(item.variantId) === Number(firstVariant.id)).reduce((s, it) => s + Number(it.quantity || 0), 0);
      const hasMultipleVariants = activeVariants.length > 1;

      return `
        <div class="checkout-add-card" data-product-id="${product.id}" data-selected-variant-id="${firstVariant.id}">
          <div class="checkout-add-card__img-wrap">
            ${discountLabel ? `<span class="checkout-add-card__badge">${escapeHtml(discountLabel)}</span>` : ''}
            <img class="checkout-add-card__img" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" />
          </div>
          <div class="checkout-add-card__details">
            <div class="checkout-add-card__top">
              <strong class="checkout-add-card__name" title="${escapeHtml(product.name)}">${escapeHtml(product.name)}</strong>
              ${inCartQty > 0 ? `<span class="checkout-add-card__incart">In Order (${inCartQty})</span>` : ''}
            </div>

            <div class="checkout-add-card__pricing">
              <span class="checkout-add-card__price">${formatCheckoutMoney(effectivePrice)}</span>
              ${originalPrice && originalPrice > effectivePrice ? `<span class="checkout-add-card__original">${formatCheckoutMoney(originalPrice)}</span>` : ''}
            </div>

            ${hasMultipleVariants ? `
              <div class="checkout-add-card__variant-wrap">
                <select class="checkout-add-card__variant-select" aria-label="Select variant for ${escapeHtml(product.name)}">
                  ${activeVariants.map((v) => {
                    const label = [v.size, v.color].filter(Boolean).join(' / ') || v.sku || 'Standard';
                    const vOffer = getVariantOfferDetails(v, product);
                    const vPrice = vOffer ? vOffer.offerPrice : v.price;
                    const vImg = getVariantImageUrl(v, product);
                    const vInCartQty = state.cart.filter((item) => Number(item.variantId) === Number(v.id)).reduce((s, it) => s + Number(it.quantity || 0), 0);
                    return `<option value="${v.id}" data-price="${vPrice}" data-stock="${v.stock}" data-image="${escapeHtml(vImg)}" data-incart="${vInCartQty}">
                      ${escapeHtml(label)} (${formatCheckoutMoney(vPrice)})${vInCartQty ? ` · In Cart: ${vInCartQty}` : ''}
                    </option>`;
                  }).join('')}
                </select>
              </div>
            ` : ''}

            <div class="checkout-add-card__actions">
              <div class="checkout-add-qty-selector">
                <button type="button" class="checkout-add-qty-btn" data-action="dec" aria-label="Decrease quantity">−</button>
                <input type="number" class="checkout-add-qty-input" value="1" min="1" max="${firstVariant.stock || 99}" readonly />
                <button type="button" class="checkout-add-qty-btn" data-action="inc" aria-label="Increase quantity">+</button>
              </div>
              <button type="button" class="checkout-add-card__submit-btn" data-action="add-to-order" data-product-id="${product.id}" data-variant-id="${firstVariant.id}">
                <span>+ Add to Order</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    bindCheckoutAddProductsListEvents();
  }

  function bindCheckoutAddProductsListEvents() {
    if (!els.checkoutAddProductsList) return;

    // 1. Variant select changes
    els.checkoutAddProductsList.querySelectorAll('.checkout-add-card__variant-select').forEach((select) => {
      select.addEventListener('change', () => {
        const card = select.closest('.checkout-add-card');
        if (!card) return;
        const opt = select.selectedOptions[0];
        if (!opt) return;

        const variantId = Number(opt.value);
        const price = Number(opt.dataset.price);
        const stock = Number(opt.dataset.stock);
        const image = opt.dataset.image;
        const inCartQty = Number(opt.dataset.incart || 0);

        card.dataset.selectedVariantId = variantId;

        const imgEl = card.querySelector('.checkout-add-card__img');
        if (imgEl && image) imgEl.src = image;

        const priceEl = card.querySelector('.checkout-add-card__price');
        if (priceEl && !isNaN(price)) priceEl.textContent = formatCheckoutMoney(price);

        let inCartBadge = card.querySelector('.checkout-add-card__incart');
        if (inCartQty > 0) {
          if (!inCartBadge) {
            inCartBadge = document.createElement('span');
            inCartBadge.className = 'checkout-add-card__incart';
            card.querySelector('.checkout-add-card__top')?.appendChild(inCartBadge);
          }
          inCartBadge.textContent = `In Order (${inCartQty})`;
          inCartBadge.hidden = false;
        } else if (inCartBadge) {
          inCartBadge.hidden = true;
        }

        const qtyInput = card.querySelector('.checkout-add-qty-input');
        if (qtyInput) {
          qtyInput.max = stock || 99;
          qtyInput.value = '1';
        }

        const submitBtn = card.querySelector('.checkout-add-card__submit-btn');
        if (submitBtn) {
          submitBtn.dataset.variantId = variantId;
        }
      });
    });

    // 2. Quantity stepper buttons
    els.checkoutAddProductsList.querySelectorAll('.checkout-add-qty-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.checkout-add-card');
        const input = card?.querySelector('.checkout-add-qty-input');
        if (!input) return;
        let current = parseInt(input.value, 10) || 1;
        const min = parseInt(input.min, 10) || 1;
        const max = parseInt(input.max, 10) || 99;

        if (btn.dataset.action === 'inc') {
          if (current < max) input.value = current + 1;
        } else if (btn.dataset.action === 'dec') {
          if (current > min) input.value = current - 1;
        }
      });
    });

    // 3. Add to order submit buttons
    els.checkoutAddProductsList.querySelectorAll('.checkout-add-card__submit-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const card = btn.closest('.checkout-add-card');
        const productId = Number(btn.dataset.productId);
        const variantId = Number(btn.dataset.variantId || card?.dataset.selectedVariantId);
        const input = card?.querySelector('.checkout-add-qty-input');
        const quantity = parseInt(input?.value, 10) || 1;

        const product = (state.products || []).find((p) => Number(p.id) === productId);
        if (!product || !variantId) return;

        btn.disabled = true;
        btn.innerHTML = '<span>Adding...</span>';

        // 1. Save entered checkout draft from form so no entered data is lost!
        const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
        if (form) {
          state.checkoutDraft = getCheckoutDraftFromForm(form);
        }

        // 2. Add to cart with preserveCoupon: true, openDrawerAfterAdd: false, isBundle: false
        const hadCoupon = Boolean(state.merchCouponCode);
        const added = addToCart(variantId, quantity, product, { openDrawerAfterAdd: false, preserveCoupon: hadCoupon, isBundle: false });

        if (added) {
          // 3. Close the drawer immediately as requested
          closeCheckoutAddProductsDrawer();

          // 4. Re-evaluate coupon if applied
          if (hadCoupon) {
            await applyMerchCouponFromCart({ silent: true });
          }

          // 5. Immediately update Order Summary, item count, subtotal, discounts, total
          renderCheckoutPage();
          showCheckoutToast(`Added ${quantity} × ${product.name} to order`);
        } else {
          btn.disabled = false;
          btn.innerHTML = '<span>+ Add to Order</span>';
        }
      });
    });
  }

  function renderCheckoutSummary() {
    const totals = getCheckoutTotals();
    const hasShippingAddress = Boolean(state.checkoutDraft?.line1 && state.checkoutDraft?.city && state.checkoutDraft?.state && state.checkoutDraft?.postalCode);
    const isRyan = isRyanAttribution();
    const indBottles = getCartIndividualBottleCount();

    const activeBundle = getActiveBundleInfo();
    let bundleHtml = '';
    if (activeBundle) {
      const bottleProduct = activeBundle.bottleProduct;
      const mistProduct = activeBundle.mistProduct;
      const bottleItem = activeBundle.bottleItem;
      const mistItem = activeBundle.mistItem;
      const bundleQty = activeBundle.bundleQty;
      const bottleImg = bottleItem.image || (bottleProduct.images && bottleProduct.images[0]) || FALLBACK_PRODUCT_IMAGE;
      const mistImg = mistItem.image || (mistProduct.images && mistProduct.images[0]) || FALLBACK_PRODUCT_IMAGE;
      const bundleUnitPrice = Number(bottleItem.price || 0) + Number(mistItem.price || 0);
      const bundleRegularLineTotal = bundleUnitPrice * bundleQty;
      const bundleDiscountAmount = totals.bundleDiscount;
      const bundleChargedLineTotal = bundleDiscountAmount > 0
        ? Math.max(0, bundleRegularLineTotal - bundleDiscountAmount)
        : bundleRegularLineTotal;

      bundleHtml = `
        <div class="shopify-summary-product shopify-summary-product--bundle">
          <div class="shopify-summary-bundle__images" aria-label="Bundle products">
            <div class="shopify-summary-bundle__img">
              <img src="${escapeHtml(bottleImg)}" alt="${escapeHtml(bottleItem.productName)}" />
            </div>
            <span class="shopify-summary-bundle__plus" aria-hidden="true">+</span>
            <div class="shopify-summary-bundle__img">
              <img src="${escapeHtml(mistImg)}" alt="${escapeHtml(mistItem.productName)}" />
            </div>
            <span class="shopify-summary-bundle__count">${escapeHtml(String(bundleQty))}</span>
          </div>
          <div class="shopify-summary-product__copy">
            <span class="shopify-summary-bundle__badge">BUNDLE OFFER</span>
            <strong class="shopify-summary-bundle__title">${escapeHtml(activeBundle.bundleDef.label || 'Bottle + Mist Bundle')}</strong>
            <small class="shopify-summary-bundle__includes">Includes: ${escapeHtml(bottleItem.productName)} + ${escapeHtml(mistItem.productName)}</small>
            <small class="shopify-summary-product__qty-label">${escapeHtml(`${bundleQty} Set${bundleQty === 1 ? '' : 's'}`)}</small>
            <div class="shopify-summary-product__stepper" role="group" aria-label="Quantity for Bottle + Mist Bundle">
              <button type="button" class="shopify-summary-product__step-btn" data-checkout-step-bundle="down" aria-label="Decrease bundle quantity" ${bundleQty <= 1 ? 'title="Remove bundle"' : ''}>−</button>
              <span class="shopify-summary-product__step-qty">${bundleQty}</span>
              <button type="button" class="shopify-summary-product__step-btn" data-checkout-step-bundle="up" aria-label="Increase bundle quantity">+</button>
            </div>
          </div>
          <div class="shopify-summary-product__right">
            <strong class="shopify-summary-product__price">${formatCheckoutMoney(bundleChargedLineTotal)}</strong>
            ${bundleDiscountAmount > 0 ? `<del class="shopify-summary-product__orig-price">${formatCheckoutMoney(bundleRegularLineTotal)}</del>` : ''}
            <button type="button" class="shopify-summary-product__remove" data-checkout-remove-bundle="H2BUNDLE15" title="Remove bundle" aria-label="Remove Bottle + Mist Bundle">✕</button>
          </div>
        </div>
      `;
    }

    const nonBundleItems = state.cart.filter((item) => !item.isBundle);

    const individualItemsHtml = nonBundleItems.map((item) => `
      <div class="shopify-summary-product">
        <div class="shopify-summary-product__image">
          <img src="${escapeHtml(item.image || FALLBACK_PRODUCT_IMAGE)}" alt="${escapeHtml(item.productName)}" />
          <span>${escapeHtml(String(item.quantity))}</span>
        </div>
        <div class="shopify-summary-product__copy">
          <strong>${escapeHtml(item.productName)}</strong>
          <small>${escapeHtml(item.variantLabel || 'Default')}</small>
          <small class="shopify-summary-product__qty-label">${escapeHtml(`${item.quantity} Piece${item.quantity === 1 ? '' : 's'}`)}</small>
          <div class="shopify-summary-product__stepper" role="group" aria-label="Quantity for ${escapeHtml(item.productName)}">
            <button type="button" class="shopify-summary-product__step-btn" data-checkout-step-variant="${item.variantId}" data-checkout-step-dir="down" aria-label="Decrease quantity" ${item.quantity <= 1 ? 'title="Remove item"' : ''}>−</button>
            <span class="shopify-summary-product__step-qty">${item.quantity}</span>
            <button type="button" class="shopify-summary-product__step-btn" data-checkout-step-variant="${item.variantId}" data-checkout-step-dir="up" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="shopify-summary-product__right">
          <strong class="shopify-summary-product__price">${formatCheckoutMoney(item.price * item.quantity)}</strong>
          <button type="button" class="shopify-summary-product__remove" data-checkout-remove-variant="${item.variantId}" title="Remove item" aria-label="Remove ${escapeHtml(item.productName)}">✕</button>
        </div>
      </div>
    `).join('');

    return `
      <aside class="shopify-summary" aria-label="Order summary">
        <h2>Order Summary</h2>
        <div class="shopify-summary-products">
          ${bundleHtml}
          ${individualItemsHtml}
        </div>
        <button type="button" class="checkout-add-more-btn" id="checkoutAddMoreProductsBtn" aria-label="Add more products">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>Add more products</span>
        </button>

        <div class="shopify-coupon">
          <div class="shopify-coupon__row">
            <label class="shopify-coupon__field">
              <span aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="m20 12-8 8-9-9V3h8l9 9Z"/><circle cx="7.5" cy="7.5" r="1.2"/></svg>
              </span>
              <input id="checkoutCouponCode" value="${escapeHtml(state.merchCouponCode || '')}" placeholder="Enter coupon code" autocomplete="off" aria-label="Coupon code" />
            </label>
            <div class="shopify-coupon__actions">
              <button id="checkoutCouponApplyBtn" class="shopify-coupon__apply" type="button" ${state.merchCouponLoading ? 'disabled' : ''}>${state.merchCouponLoading ? 'APPLYING' : 'APPLY'}</button>
              ${state.merchCouponPreview ? `<button id="checkoutCouponRemoveBtn" class="shopify-coupon__remove" type="button" aria-label="Remove coupon">✕ REMOVE</button>` : ''}
            </div>
          </div>
          ${(() => {
            if (state.merchCouponError) return '';
            if (isRyan) {
              if (totals.couponDiscount > 0) {
                return `
                  <div class="shopify-coupon__savings-text" style="color:#0f766e;font-size:13px;line-height:1.4;margin-top:6px;">
                    <strong style="display:block;color:#0f766e;margin-bottom:2px;">Ryan Discount Applied</strong>
                    <span>${formatCheckoutMoney(totals.couponDiscount)} ${totals.bundleDiscount > 0 ? `discount applied to ${indBottles} standalone bottle${indBottles === 1 ? '' : 's'}` : `Ryan discount applied to ${indBottles} bottle${indBottles === 1 ? '' : 's'}`}.</span>
                  </div>
                `;
              }
              // When Ryan customer discount is 0: do not show Ryan discount/coupon applied
              return '';
            }
            if (totals.couponDiscount > 0 && state.merchCouponPreview) {
              return `
                <div class="shopify-coupon__savings-text" style="margin-top:6px;">
                  ${formatCheckoutMoney(totals.couponDiscount)} Saved with discounts!
                </div>
              `;
            }
            return '';
          })()}
          ${state.merchCouponError ? `
            <div class="shopify-coupon__message is-error">
              ${escapeHtml(state.merchCouponError)}
            </div>
          ` : ''}
          ${totals.bundleDiscount > 0 ? `
            <div class="shopify-bundle-badge" style="background:#fef7f2;border:1px dashed #ae5431;border-radius:10px;padding:12px 14px;margin-top:10px;display:flex;align-items:flex-start;gap:10px;">
              <span style="font-size:1.2rem;line-height:1;" aria-hidden="true">✨</span>
              <div>
                <strong style="display:block;font-size:0.88rem;color:#ae5431;line-height:1.3;">Bundle &amp; Save Applied (15% OFF)</strong>
                <small style="display:block;font-size:0.78rem;color:#78350f;margin-top:2px;">
                  ${totals.couponDiscount > 0
                    ? `${formatCheckoutMoney(totals.bundleDiscount)} saved on Bottle + Mist bundle`
                    : '15% bundle savings are active for your Bottle + Mist bundle.'
                  }
                </small>
              </div>
            </div>
          ` : ''}
          ${state.availableCoupons.length ? `<div class="checkout-coupon-offers" aria-label="Available coupons">
            <p class="checkout-coupon-offers__title">Available coupons</p>
            ${state.availableCoupons.filter(isPublicMerchCoupon).map((coupon) => `
              <button type="button" class="checkout-coupon-offer${String(coupon.code) === String(state.merchCouponCode) ? ' is-selected' : ''}" data-checkout-coupon-code="${escapeHtml(coupon.code)}">
                <span><strong>${escapeHtml(coupon.code)}</strong><small>${escapeHtml(coupon.couponCategory === 'festival' ? 'Festival coupon' : coupon.couponCategory === 'seasonal' ? 'Seasonal coupon' : 'Public coupon')}${coupon.description ? ` · ${escapeHtml(coupon.description)}` : ''}</small></span>
                <b>${escapeHtml(getCouponDiscountLabel(coupon))}</b>
              </button>
            `).join('')}
          </div>` : ''}
        </div>

        ${renderCheckoutRecommendations()}

        <div class="checkout-currency-selector" aria-label="Select currency">
          <span class="checkout-currency-label">Currency</span>
          <div class="currency-toggle-group">
            <button type="button" class="currency-toggle-btn ${state.currency === 'INR' ? 'is-active' : ''}" data-currency="INR">₹ INR</button>
            <button type="button" class="currency-toggle-btn ${state.currency === 'USD' ? 'is-active' : ''}" data-currency="USD">$ USD</button>
          </div>
        </div>

        <div class="shopify-pricing">
          <div class="shopify-price-row"><span>Subtotal</span><strong>${formatCheckoutMoney(totals.rawSubtotal)}</strong></div>
          ${totals.bundleDiscount > 0 ? `
            <div class="shopify-price-row shopify-price-row--discount">
              <span>Bundle &amp; Save (15% OFF)</span>
              <strong>- ${formatCheckoutMoney(totals.bundleDiscount)}</strong>
            </div>
          ` : ''}
          ${totals.couponDiscount > 0 ? `
            <div class="shopify-price-row shopify-price-row--discount">
              <span>${isRyan ? `Ryan Discount (${indBottles} ${totals.bundleDiscount > 0 ? 'standalone ' : ''}bottle${indBottles === 1 ? '' : 's'})` : `Coupon (${escapeHtml(state.merchCouponCode || '')})`}</span>
              <strong>- ${formatCheckoutMoney(totals.couponDiscount)}</strong>
            </div>
          ` : ''}
          <div class="shopify-price-row"><span>Shipping <em aria-label="Shipping help">?</em></span><strong>${hasShippingAddress ? (totals.shipping ? formatCheckoutMoney(totals.shipping) : 'Free') : 'Enter shipping address'}</strong></div>
          <div class="shopify-price-row"><span>GST (Included)</span><strong>${formatCheckoutMoney(totals.gstIncluded)}</strong></div>
        </div>

        ${(() => {
          if (totals.totalSavings <= 0) return '';
          let bundleLine = '';
          if (totals.bundleDiscount > 0) {
            bundleLine = `
              <div class="shopify-savings-breakdown__row">
                <div>
                  <strong>Bundle &amp; Save</strong>
                  <small>15% OFF</small>
                </div>
                <strong class="shopify-savings-breakdown__amt">${formatCheckoutMoney(totals.bundleDiscount)}</strong>
              </div>
            `;
          }
          let couponLine = '';
          if (isRyan && totals.couponDiscount > 0) {
            couponLine = `
              <div class="shopify-savings-breakdown__row">
                <div>
                  <strong>Ryan Discount</strong>
                  <small>Applied to ${indBottles} eligible ${totals.bundleDiscount > 0 ? 'standalone ' : ''}bottle${indBottles === 1 ? '' : 's'}</small>
                </div>
                <strong class="shopify-savings-breakdown__amt">${formatCheckoutMoney(totals.couponDiscount)}</strong>
              </div>
            `;
          } else if (!isRyan && totals.couponDiscount > 0) {
            couponLine = `
              <div class="shopify-savings-breakdown__row">
                <div>
                  <strong>Coupon Discount</strong>
                  <small>${escapeHtml(state.merchCouponCode || '')}</small>
                </div>
                <strong class="shopify-savings-breakdown__amt">${formatCheckoutMoney(totals.couponDiscount)}</strong>
              </div>
            `;
          }
          return `
            <div class="shopify-savings-breakdown">
              <span class="shopify-savings-breakdown__title">Discounts &amp; Savings</span>
              ${bundleLine}
              ${couponLine}
              <div class="shopify-savings-breakdown__total">
                <span>Total Savings</span>
                <strong>${formatCheckoutMoney(totals.totalSavings)}</strong>
              </div>
            </div>
          `;
        })()}

        <div class="shopify-total">
          <span>Total</span>
          <strong><small>${state.currency}</small> ${formatCheckoutMoney(totals.total)}</strong>
          ${state.currency === 'USD' ? `<p class="shopify-total__fx">Approx. ${formatCheckoutMoney(totals.total)} USD · Base ₹${Number(totals.total).toLocaleString('en-IN')}</p>` : ''}
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
    const country = normalizeCheckoutCountry(draft.country || 'India');
    const regionOptions = getCheckoutRegionOptions(country);
    const regionLabel = country === 'United States' ? 'State' : (country === 'Canada' ? 'Province' : 'State / Region');
    const postalLabel = country === 'United States' ? 'ZIP code' : (country === 'India' ? 'PIN code' : 'Postal code');
    const mailIcon = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.2 2c-.9.6-1.7 1.2-1.7 2.5"/><path d="M12 17h.01"/></svg>';
    const searchIcon = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></svg>';

    els.checkoutPage.innerHTML = `
      <div class="shopify-checkout__inner">
        <form id="shopifyCheckoutForm" class="shopify-checkout-form" novalidate>
          <section class="shopify-section shopify-section--contact">
            <div class="shopify-section__head">
              <h1 id="checkoutPageTitle">Contact</h1>
              ${Boolean(state.currentUser || state.merchProfile?.id) ? '' : '<p>Already have an account? <a href="/merch/auth.html">Sign in</a></p>'}
            </div>
            ${renderCheckoutField({ name: 'email', label: 'Email', value: draft.email, type: 'email', placeholder: '', autocomplete: 'email', wide: true, icon: mailIcon, required: false })}
            <label class="shopify-check"><input name="emailOffers" type="checkbox" ${draft.emailOffers ? 'checked' : ''} /><span>Email me with news and offers</span></label>
          </section>

          <section class="shopify-section">
            <h2>Delivery</h2>
            <div class="shopify-field-grid">
              ${renderCheckoutSelect({ name: 'country', label: 'Country/Region', value: country, options: CHECKOUT_COUNTRIES, wide: true })}
              ${renderCheckoutField({ name: 'firstName', label: 'First name', value: draft.firstName, placeholder: 'First name', autocomplete: 'given-name' })}
              ${renderCheckoutField({ name: 'lastName', label: 'Last name', value: draft.lastName, placeholder: 'Last name', autocomplete: 'family-name' })}
              ${renderCheckoutField({ name: 'line1', label: 'Address', value: draft.line1, placeholder: 'House number and street name', autocomplete: 'address-line1', wide: true, icon: searchIcon })}
              ${renderCheckoutField({ name: 'line2', label: 'Apartment, suite, etc. (optional)', value: draft.line2, placeholder: 'Apartment, suite, building, floor, etc.', autocomplete: 'address-line2', wide: true, required: false })}
              ${renderCheckoutField({ name: 'city', label: 'City', value: draft.city, placeholder: 'City', autocomplete: 'address-level2' })}
              ${renderCheckoutSelect({ name: 'state', label: regionLabel, value: draft.state || regionOptions[0], options: regionOptions })}
              ${renderCheckoutField({ name: 'postalCode', label: postalLabel, value: draft.postalCode, placeholder: postalLabel, autocomplete: 'postal-code', inputmode: country === 'India' ? 'numeric' : 'text', maxlength: country === 'India' ? 6 : 10 })}
              ${renderCheckoutPhoneField(draft)}
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

          <div class="shopify-checkout-actions" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:20px;">
            <button class="shopify-pay-button" type="submit" style="flex:1;min-width:200px;" ${state.checkoutSubmitting ? 'disabled' : ''}>
              <span>${state.checkoutSubmitting ? 'PROCESSING...' : 'CONTINUE TO PAYMENT'}</span>
              <svg viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
            </button>
            <a href="/merch/" class="shopify-continue-button" data-action="continue-shopping">
              CONTINUE SHOPPING
            </a>
          </div>
          <div class="shopify-checkout-policies" style="margin-top:16px;font-size:12px;color:#717171;line-height:1.6;">
            By placing your order, you agree to our 
            <a href="/terms/" target="_blank" style="color:#ae5431;text-decoration:underline;">Terms of Service</a>, 
            <a href="/privacy/" target="_blank" style="color:#ae5431;text-decoration:underline;">Privacy Policy</a>, 
            <a href="/shipping/" target="_blank" style="color:#ae5431;text-decoration:underline;">Shipping Policy</a>, and 
            <a href="/refund/" target="_blank" style="color:#ae5431;text-decoration:underline;">Return &amp; Warranty Policy</a> (7-Day shipment-damage returns; 6-Month parts warranty).
            <div style="margin-top:8px;padding:8px 10px;background:#fdfaf7;border-left:3px solid #ae5431;border-radius:4px;color:#555;font-size:11.5px;line-height:1.45;">
              <strong style="color:#111;">Bottle Color Disclaimer:</strong> The color of the bottle may vary depending on availability. Customers may receive the bottle in any available color, and a specific color cannot be guaranteed. Product images are for illustrative purposes only.
            </div>
          </div>
        </form>
        ${renderCheckoutSummary()}
      </div>
    `;
    bindCheckoutPageEvents();
  }

  function showCheckoutPage(customer = null, address = null) {
    if (state.authResolved && !state.cart.length) {
      showShop();
      return;
    }
    if (!state.products || !state.products.length) {
      loadMerchProducts().then(() => {
        if (state.currentView === 'checkout') renderCheckoutPage();
      });
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
    loadMerchCoupons();
    renderCheckoutPage();
    if (window.location.hash !== '#checkout') window.location.hash = 'checkout';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function bindCheckoutPageEvents() {
    const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
    if (!form) return;
    form.addEventListener('input', (event) => {
      handleAddressAndNameInputs(event);
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
    els.checkoutPage?.querySelectorAll('.currency-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const curr = btn.dataset.currency;
        if (curr && (curr === 'INR' || curr === 'USD')) {
          state.currency = curr;
          try { localStorage.setItem('h2_currency', curr); } catch {}
          renderCheckoutPage();
        }
      });
    });
    form.addEventListener('submit', handleCheckoutPageSubmit);
    els.checkoutPage?.querySelector('#checkoutAddMoreProductsBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCheckoutAddProductsDrawer();
    });
    els.checkoutPage?.querySelector('#checkoutCouponApplyBtn')?.addEventListener('click', applyMerchCouponFromCheckout);
    els.checkoutPage?.querySelector('#checkoutCouponRemoveBtn')?.addEventListener('click', () => {
      clearMerchCoupon();
      renderCheckoutPage();
    });
    els.checkoutPage?.querySelector('#checkoutCouponCode')?.addEventListener('change', (event) => {
      state.merchCouponCode = normalizeCouponCode(event.target.value);
      state.merchCouponPreview = null;
      state.merchCouponError = '';
    });
    els.checkoutPage?.querySelectorAll('[data-checkout-coupon-code]').forEach((button) => {
      button.addEventListener('click', async () => {
        const input = els.checkoutPage?.querySelector('#checkoutCouponCode');
        const code = normalizeCouponCode(button.dataset.checkoutCouponCode);
        if (input) input.value = code;
        state.merchCouponCode = code;
        await applyMerchCouponFromCheckout();
      });
    });
    els.checkoutPage?.querySelectorAll('[data-checkout-step-bundle]').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
        if (form) state.checkoutDraft = getCheckoutDraftFromForm(form);
        const dir = button.dataset.checkoutStepBundle;
        const activeBundle = getActiveBundleInfo();
        if (!activeBundle) return;

        if (dir === 'up') {
          const bottleProd = activeBundle.bottleProduct;
          const mistProd = activeBundle.mistProduct;
          const bottleVar = (bottleProd?.variants || []).find((v) => Number(v.id) === Number(activeBundle.bottleItem.variantId));
          const mistVar = (mistProd?.variants || []).find((v) => Number(v.id) === Number(activeBundle.mistItem.variantId));
          const totalBottleQty = state.cart.filter((it) => Number(it.variantId) === Number(bottleVar?.id)).reduce((s, it) => s + Number(it.quantity || 1), 0);
          const totalMistQty = state.cart.filter((it) => Number(it.variantId) === Number(mistVar?.id)).reduce((s, it) => s + Number(it.quantity || 1), 0);
          if (totalBottleQty >= Number(bottleVar?.stock || 99) || totalMistQty >= Number(mistVar?.stock || 99)) {
            showCheckoutNotice('Max quantity reached', 'Cannot add more units due to inventory limits.', { variant: 'error' });
            return;
          }
          activeBundle.bottleItem.quantity = Number(activeBundle.bottleItem.quantity || 1) + 1;
          activeBundle.mistItem.quantity = Number(activeBundle.mistItem.quantity || 1) + 1;
          saveCart();
          if (state.merchCouponCode) {
            await applyMerchCouponFromCart({ silent: true });
          }
          renderCheckoutPage();
        } else if (dir === 'down') {
          if (activeBundle.bundleQty > 1) {
            activeBundle.bottleItem.quantity = Number(activeBundle.bottleItem.quantity || 1) - 1;
            activeBundle.mistItem.quantity = Number(activeBundle.mistItem.quantity || 1) - 1;
            saveCart();
            if (state.merchCouponCode) {
              await applyMerchCouponFromCart({ silent: true });
            }
            renderCheckoutPage();
          } else {
            state.cart = state.cart.filter((item) => !item.isBundle);
            clearMerchBundleDiscount();
            saveCart();
            if (!state.cart.length) {
              showShop();
            } else {
              if (state.campaignAttribution?.couponCode && !state.merchCouponCode) {
                state.merchCouponCode = state.campaignAttribution.couponCode;
                await applyMerchCouponFromCart({ silent: true });
              } else if (state.merchCouponCode) {
                await applyMerchCouponFromCart({ silent: true });
              }
              renderCheckoutPage();
            }
          }
        }
      });
    });

    els.checkoutPage?.querySelectorAll('[data-checkout-remove-bundle]').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
        if (form) state.checkoutDraft = getCheckoutDraftFromForm(form);
        const activeBundle = getActiveBundleInfo();
        if (!activeBundle) return;

        state.cart = state.cart.filter((item) => !item.isBundle);
        clearMerchBundleDiscount();
        saveCart();
        if (!state.cart.length) {
          showShop();
        } else {
          if (state.campaignAttribution?.couponCode && !state.merchCouponCode) {
            state.merchCouponCode = state.campaignAttribution.couponCode;
            await applyMerchCouponFromCart({ silent: true });
          } else if (state.merchCouponCode) {
            await applyMerchCouponFromCart({ silent: true });
          }
          renderCheckoutPage();
        }
      });
    });

    els.checkoutPage?.querySelectorAll('[data-checkout-step-variant]').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
        if (form) state.checkoutDraft = getCheckoutDraftFromForm(form);
        const variantId = Number(button.dataset.checkoutStepVariant);
        const dir = button.dataset.checkoutStepDir;
        const item = state.cart.find((it) => Number(it.variantId) === variantId && !it.isBundle);
        if (!item) return;

        const hadCoupon = Boolean(state.merchCouponCode);

        if (dir === 'up') {
          const prod = (state.products || []).find((p) => Number(p.id) === Number(item.productId));
          const variant = (prod?.variants || []).find((v) => Number(v.id) === variantId);
          const maxStock = Number(variant?.stock || 99);
          const totalVariantQty = state.cart.filter((it) => Number(it.variantId) === variantId).reduce((s, it) => s + Number(it.quantity || 1), 0);
          if (totalVariantQty >= maxStock) {
            showCheckoutNotice('Max stock reached', 'Cannot add more units due to inventory limits.', { variant: 'error' });
            return;
          }
          item.quantity = Number(item.quantity || 1) + 1;
          saveCart();
          if (hadCoupon) {
            await applyMerchCouponFromCart({ silent: true });
          }
          renderCheckoutPage();
        } else if (dir === 'down') {
          if (Number(item.quantity || 1) > 1) {
            item.quantity = Number(item.quantity || 1) - 1;
            saveCart();
            if (hadCoupon) {
              await applyMerchCouponFromCart({ silent: true });
            }
            renderCheckoutPage();
          } else {
            state.cart = state.cart.filter((it) => it !== item);
            saveCart();
            if (!state.cart.length) {
              showShop();
            } else {
              if (hadCoupon) {
                await applyMerchCouponFromCart({ silent: true });
              }
              renderCheckoutPage();
            }
          }
        }
      });
    });

    els.checkoutPage?.querySelectorAll('[data-checkout-remove-variant]').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = els.checkoutPage?.querySelector('#shopifyCheckoutForm');
        if (form) state.checkoutDraft = getCheckoutDraftFromForm(form);
        const variantId = Number(button.dataset.checkoutRemoveVariant);
        const hadCoupon = Boolean(state.merchCouponCode);
        const item = state.cart.find((it) => Number(it.variantId) === variantId && !it.isBundle);
        if (!item) return;

        state.cart = state.cart.filter((it) => it !== item);
        saveCart();
        if (!state.cart.length) {
          showShop();
        } else {
          if (state.campaignAttribution?.couponCode && !state.merchCouponCode) {
            state.merchCouponCode = state.campaignAttribution.couponCode;
            await applyMerchCouponFromCart({ silent: true });
          } else if (hadCoupon) {
            await applyMerchCouponFromCart({ silent: true });
          }
          renderCheckoutPage();
        }
      });
    });
    els.checkoutPage?.querySelectorAll('[data-checkout-add-bundle]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'ADDING...';

        const added = await addMerchBundleToCheckoutOrder();
        if (!added) {
          button.disabled = false;
          button.textContent = '+ ADD';
        }
      });
    });
    els.checkoutPage?.querySelectorAll('[data-checkout-add-variant]').forEach((button) => {
      button.addEventListener('click', async () => {
        const variantId = Number(button.dataset.checkoutAddVariant);
        const productId = Number(button.dataset.checkoutAddProduct);
        const product = (state.products || []).find((p) => Number(p.id) === productId);
        if (!product || !variantId) return;

        button.disabled = true;
        button.textContent = 'ADDING...';

        const hadCoupon = Boolean(state.merchCouponCode);
        const added = addToCart(variantId, 1, product, { openDrawerAfterAdd: false, preserveCoupon: hadCoupon });
        if (added) {
          if (hadCoupon) {
            await applyMerchCouponFromCart({ silent: true });
          }
          renderCheckoutPage();
        } else {
          button.disabled = false;
          button.textContent = '+ ADD';
        }
      });
    });

    const track = els.checkoutPage?.querySelector('#checkoutRecTrack');
    const prevBtn = els.checkoutPage?.querySelector('[data-action="rec-scroll-prev"]');
    const nextBtn = els.checkoutPage?.querySelector('[data-action="rec-scroll-next"]');
    if (track && (prevBtn || nextBtn)) {
      const updateNav = () => {
        if (prevBtn) prevBtn.hidden = track.scrollLeft <= 5;
        if (nextBtn) nextBtn.hidden = track.scrollLeft + track.clientWidth >= track.scrollWidth - 5;
      };
      track.addEventListener('scroll', updateNav, { passive: true });
      updateNav();

      prevBtn?.addEventListener('click', () => {
        track.scrollBy({ left: -180, behavior: 'smooth' });
      });
      nextBtn?.addEventListener('click', () => {
        track.scrollBy({ left: 180, behavior: 'smooth' });
      });
    }
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
    try {
      await persistCheckoutDetails(state.checkoutDraft);
    } catch (error) {
      showCheckoutNotice('Details not saved', error.message || 'Unable to save your delivery details. Please try again.', { variant: 'error' });
      return;
    }
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

    const customer = getAuthenticatedCheckoutCustomer(defaultAddress);
    const modal = showMerchModal({
      title: 'Choose shipping address',
      body: `
        <div class="checkout-profile-summary">
          <p>Checking out as</p>
          <strong>${escapeHtml(customer.name)}</strong>
          <span>${customer.email && hasRealEmail(customer.email) ? `${escapeHtml(customer.email)}${customer.phone ? ' · ' : ''}` : ''}${escapeHtml(customer.phone || '')}</span>
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
      showCheckoutPage(getAuthenticatedCheckoutCustomer(selected), serializeAddress(selected));
    });
  }

  function renderCheckoutAddressForm(options = {}) {
    const profile = options.profile || getMerchantProfile();
    const fullName = String(profile.fullName || profile.name || '').trim();
    const phoneParsed = parseCheckoutPhone(profile.mobile || profile.phone || '');
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
            <input name="recipientName" type="text" value="${escapeHtml(fullName)}" autocomplete="name" placeholder="Enter full name" required />
          </label>
          <label class="account-field">
            <span>Phone Number</span>
            <div class="checkout-phone-control">
              <select name="phoneCountryCode" aria-label="Phone country code" autocomplete="tel-country-code">
                ${CHECKOUT_PHONE_COUNTRY_CODES.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === phoneParsed.countryCode ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
              </select>
              <input name="phone" type="tel" inputmode="numeric" maxlength="15" value="${escapeHtml(phoneParsed.localNumber)}" autocomplete="tel-national" placeholder="Mobile number" required />
            </div>
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
            <span>Pincode / Postal Code</span>
            <input name="postalCode" type="text" autocomplete="postal-code" placeholder="Postal code" maxlength="10" required />
          </label>
          <label class="account-field">
            <span>Country</span>
            <select name="country" autocomplete="country-name">
              ${CHECKOUT_COUNTRIES.map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join('')}
            </select>
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
    const modalForm = modal.querySelector('#checkoutAddAddressForm');
    modalForm?.addEventListener('input', handleAddressAndNameInputs);
    modalForm?.addEventListener('submit', handleCheckoutAddressSubmit);
  }

  async function handleCheckoutAddressSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const submitButton = document.querySelector('[form="checkoutAddAddressForm"]');
    const payload = getAddressPayload(form);
    if (!payload.recipientName || !isValidName(payload.recipientName)) {
      showCheckoutNotice('Invalid name', 'Name should contain letters and spaces only.', { variant: 'error' });
      return;
    }
    if (!isValidPhoneNumber(payload.phone, payload.phoneCountryCode)) {
      showCheckoutNotice('Invalid phone number', getPhoneErrorMessage(payload.phoneCountryCode), { variant: 'error' });
      return;
    }
    if (!payload.line1 || !isValidAddress(payload.line1)) {
      showCheckoutNotice('Invalid address', 'Enter a valid address.', { variant: 'error' });
      return;
    }
    if (payload.city && !isValidCityOrState(payload.city)) {
      showCheckoutNotice('Invalid city', 'Enter a valid city name.', { variant: 'error' });
      return;
    }
    if (payload.state && !isValidCityOrState(payload.state)) {
      showCheckoutNotice('Invalid state', 'Enter a valid state name.', { variant: 'error' });
      return;
    }
    if (payload.postalCode && !isValidPostalCode(payload.postalCode, payload.country)) {
      showCheckoutNotice('Invalid postal code', getPostalCodeErrorMessage(payload.country), { variant: 'error' });
      return;
    }
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

  // â”€â”€â”€ Event Bindings â”€â”€â”€
  function bindEvents() {
    // Hero shop button
    els.heroShopBtn.addEventListener('click', () => {
      document.querySelector('.merch-categories')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    els.wishlistToggleBtn?.addEventListener('click', () => openAccountDrawer('account-wishlist'));
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

    els.checkoutAddProductsCloseBtn?.addEventListener('click', closeCheckoutAddProductsDrawer);
    els.checkoutAddProductsOverlay?.addEventListener('click', closeCheckoutAddProductsDrawer);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !els.checkoutAddProductsDrawer?.hidden && els.checkoutAddProductsDrawer?.classList.contains('is-open')) {
        closeCheckoutAddProductsDrawer();
      }
    });

    document.addEventListener('click', (event) => {
      const continueBtn = event.target.closest('[data-action="continue-shopping"]');
      if (continueBtn) {
        event.preventDefault();
        showShop();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    window.addEventListener('hashchange', () => {
      if (!routeFromLocation()) {
        showShop();
      }
    });
  }

  // â”€â”€â”€ Razorpay Checkout Flow â”€â”€â”€
  async function initiateCheckout({ directToCheckout = false } = {}) {
    if (!state.authResolved) {
      await loadCustomerContext();
    }

    if (state.currentUser && !directToCheckout) {
      const defaultAddress = getDefaultAddress();
      const customer = getAuthenticatedCheckoutCustomer(defaultAddress);
      if (!customer.name || !customer.phone) {
        openCheckoutAddAddressModal({
          title: 'Complete your details',
          helpText: 'Add your name, phone, address, and pincode to continue checkout.',
        });
        return;
      }

      openAuthenticatedCheckoutAddressModal();
      return;
    }

    showCheckoutPage();
  }

  async function startRazorpayCheckout(customer, address) {
    const items = state.cart.map(item => ({
      variantId: item.variantId,
      quantity: item.quantity,
      isBundle: Boolean(item.isBundle),
      source: item.isBundle ? 'bundle' : 'individual',
    }));
    const hasInfluencer = hasActiveInfluencerCoupon();
    const isRyan = isRyanAttribution();
    const bundleCode = (hasInfluencer && !isRyan) ? '' : (state.merchBundleCode || 'H2BUNDLE15');
    const couponCode = state.merchCouponPreview?.code ? normalizeCouponCode(state.merchCouponPreview.code) : '';

    try {
      const res = await fetch(buildApiUrl('/api/merch/checkout'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer, address, couponCode, bundleCode, campaignSlug: state.campaignAttribution?.slug || '', currency: state.currency || 'INR' }),
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
        prefill: {
          name: customer.name,
          ...(hasRealEmail(customer.email) ? { email: customer.email } : {}),
          contact: customer.phone,
        },
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
      clearMerchBundleDiscount();
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
    const adminTrackingRequest = isAdminTrackingRequest();
    const urlParams = new URLSearchParams(window.location.search);
    const isCampaignOrCheckout = Boolean(urlParams.get('campaign') || urlParams.get('c') || window.location.hash === '#checkout');
    const previousUserId = state.cartOwnerId;
    try {
      const authResult = await api('/api/auth/me');
      state.currentUser = authResult.user || null;
      if (state.currentUser && String(state.currentUser.role || '').toLowerCase() === 'admin' && !adminTrackingRequest && !isCampaignOrCheckout) {
        window.location.replace('/merch/admin/index.html');
        return;
      }
    } catch {
      state.currentUser = null;
    }

    const currentUserId = state.currentUser?.id || null;
    if (currentUserId !== previousUserId) {
      state.cart = [];
      state.merchBundleCode = '';
      state.merchCouponCode = '';
      state.merchCouponPreview = null;
      state.merchCouponError = '';

      loadCart(state.currentUser);

      if (currentUserId) {
        await syncCartFromBackend();
      }

      renderCartBadge();
      if (state.cartDrawerOpen) renderCart();

      if (state.currentView === 'checkout') {
        if (!state.cart.length) {
          showShop();
        } else {
          renderCheckoutPage();
        }
      }
    }

    if (state.currentUser && adminTrackingRequest) {
      await loadAdminTrackingOrder(getTrackingOrderIdFromHash());
      state.merchProfile = null;
      state.merchAddresses = [];
      state.merchWishlistItems = [];
      state.merchCartItems = [];
      state.merchCouponHistory = [];
      state.influencerDashboard = null;
    } else if (state.currentUser) {
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
      try {
        const savedWishlist = localStorage.getItem('merch_wishlist_guest');
        state.merchWishlistItems = savedWishlist ? JSON.parse(savedWishlist) : [];
      } catch {
        state.merchWishlistItems = [];
      }
      state.merchCartItems = [];
      state.merchCouponHistory = [];
      state.influencerDashboard = null;
    }

    state.authResolved = true;
    renderWishlistBadge();
    syncWishlistControls();
    setBodyAuthLoading(false);
    renderAccountTrigger();

    if (state.currentView === 'tracking') {
      const trackingOrderId = getTrackingOrderIdFromHash();
      if (trackingOrderId) showOrderTracking(trackingOrderId);
    }
    if (state.accountDrawerOpen) renderAccountDrawer();
  }

  async function loadMerchOffers() {
    state.offersLoading = true;
    try {
      const data = await api('/api/merch/offers');
      state.offers = Array.isArray(data?.offers) ? data.offers : [];
    } catch {
      state.offers = [];
    }
    state.offersLoading = false;
    renderShopOffersSection();
    renderProductGrid();
    refreshCartPrices();
    if (state.currentView === 'detail' && state.selectedProduct) {
      renderProductInfo(state.selectedProduct);
    }
  }

  function renderShopOffersSection() {
    const section = document.getElementById('shopOffersSection');
    if (!section) return;
    section.hidden = state.currentView !== 'shop';
    const grid = section.querySelector('#shopOffersGrid');
    if (!grid) return;

    if (!state.offers.length) {
      grid.innerHTML = '<p class="merch-offers__empty">No offers available right now.</p>';
      return;
    }

    grid.innerHTML = state.offers.map((offer) => {
      // The public API joins each offer to its exact variant. Never fall back
      // to a product-level price for a variant-specific offer.
      const originalPricePaise = Number(offer.variantPrice);
      const discountValue = Number(offer.discountValue || 0);
      const hasPrice = Number.isFinite(originalPricePaise) && originalPricePaise >= 0;
      const isPercentage = String(offer.discountType || '').toLowerCase() === 'percentage';
      const discountAmountPaise = isPercentage
        ? Math.round(originalPricePaise * discountValue / 100)
        : discountValue;
      const offerPricePaise = hasPrice
        ? Math.max(0, originalPricePaise - discountAmountPaise)
        : null;
      const savingsPaise = hasPrice && offerPricePaise !== null
        ? Math.max(0, originalPricePaise - offerPricePaise)
        : null;
      const discountLabel = isPercentage
        ? `${discountValue}% OFF`
        : `${formatMoneyFromPaise(discountValue)} OFF`;
      const variantLabel = [offer.variantSize, offer.variantColor].filter(Boolean).join(' / ');
      const isSoldOut = Number(offer.variantStock || 0) <= 0;
      const variantImages = Array.isArray(offer.variantImages) ? offer.variantImages : [];
      const productImages = Array.isArray(offer.productImages) ? offer.productImages : [];
      const offerSlug = String(offer.productSlug || '').toLowerCase();
      const offerCategory = offerSlug.includes('mist') || offerSlug.includes('spray')
        ? 'sprays'
        : offerSlug.includes('hoodie')
          ? 'hoodies'
          : '';
      const imageUrl = normalizeProductImageUrl(
        offer.variantImageUrl || variantImages[0] || productImages[0] || offer.productImageUrl || getProductFallbackImage({ category: offerCategory, name: offer.productName })
      );
      const expiry = offer.expiryDate || offer.expiresAt || offer.expires_at || '';

      return `
        <article class="merch-offer-card merch-offer-card--${escapeHtml(offerCategory || 'default')}" data-offer-id="${escapeHtml(String(offer.id))}" data-action="offer-shop" data-product-id="${escapeHtml(String(offer.productId))}" data-variant-id="${escapeHtml(String(offer.variantId || ''))}" style="cursor:pointer;" tabindex="0" role="button" aria-label="View offer for ${escapeHtml([offer.productName, variantLabel].filter(Boolean).join(' — '))}">
          <div class="merch-offer-card__image">
            ${isSoldOut ? '<span class="merch-offer-card__availability">SOLD OUT</span>' : ''}
            <img src="${escapeHtml(imageUrl)}"
                 alt="${escapeHtml([offer.productName, variantLabel].filter(Boolean).join(' — '))}"
                 loading="lazy"
                 onerror="this.onerror=null;this.src='${escapeHtml(FALLBACK_PRODUCT_IMAGE)}'" />
          </div>
          <div class="merch-offer-card__body">
            <p class="merch-offer-card__discount">${escapeHtml(discountLabel)}</p>
            <p class="merch-offer-card__name">${escapeHtml(offer.name || '')}</p>
            ${offer.productName ? `<p class="merch-offer-card__product">${escapeHtml(offer.productName)}</p>` : ''}
            ${variantLabel ? `<p class="merch-offer-card__variant">${escapeHtml(variantLabel)}</p>` : ''}
            ${hasPrice && offerPricePaise !== null ? `
              <div class="merch-offer-card__pricing">
                <span class="merch-offer-card__original">${escapeHtml(formatMoneyFromPaise(originalPricePaise))}</span>
                <strong class="merch-offer-card__discounted">${escapeHtml(formatMoneyFromPaise(offerPricePaise))}</strong>
              </div>
              ${savingsPaise !== null ? `<p class="merch-offer-card__savings">Save ${escapeHtml(formatMoneyFromPaise(savingsPaise))}</p>` : ''}
            ` : ''}
            ${offer.shortDescription ? `<p class="merch-offer-card__desc">${escapeHtml(offer.shortDescription)}</p>` : ''}
            ${expiry ? `<p class="merch-offer-card__expiry">Expires ${escapeHtml(formatTrackingDateTime(expiry))}</p>` : ''}
            ${offer.fullDescription ? `<details class="merch-offer-card__details" onclick="event.stopPropagation()"><summary>View details</summary><p>${escapeHtml(offer.fullDescription)}</p>${offer.terms ? `<p>${escapeHtml(offer.terms)}</p>` : ''}</details>` : ''}
            ${offer.productId ? `
              <button type="button" class="merch-offer-card__shop-btn${isSoldOut ? ' is-disabled' : ''}"
                      data-action="offer-shop"
                      data-product-id="${escapeHtml(String(offer.productId))}"
                      data-variant-id="${escapeHtml(String(offer.variantId || ''))}"
                      ${isSoldOut ? 'disabled aria-disabled="true"' : ''}>
                ${isSoldOut ? 'Sold Out' : 'Shop Now →'}
              </button>` : ''}
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-action="offer-shop"]').forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = el.closest('[data-product-id]');
        const productId = Number(target?.dataset?.productId);
        const variantId = target?.dataset?.variantId ? Number(target.dataset.variantId) : null;
        if (productId) showProductDetail(productId, variantId);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const target = el.closest('[data-product-id]');
          const productId = Number(target?.dataset?.productId);
          const variantId = target?.dataset?.variantId ? Number(target.dataset.variantId) : null;
          if (productId) showProductDetail(productId, variantId);
        }
      });
    });
  }

  async function resolveCampaignAttribution() {
    const urlParams = new URLSearchParams(window.location.search);
    const paramSlug = urlParams.get('campaign') || urlParams.get('c');

    let attribution = null;
    const cookieMatch = document.cookie.match(/(?:^|;\s*)h2_campaign_attribution=([^;]+)/);
    if (cookieMatch) {
      try {
        attribution = JSON.parse(decodeURIComponent(cookieMatch[1]));
      } catch {}
    }

    if (paramSlug) {
      try {
        const res = await api(`/api/merch/campaigns/resolve?slug=${encodeURIComponent(paramSlug)}`);
        if (res?.campaign) {
          attribution = {
            campaignId: res.campaign.id,
            slug: res.campaign.slug,
            influencerId: res.campaign.influencerId,
            couponCode: res.campaign.couponCode,
            targetProductId: Number(res.campaign.targetProductId || 11),
            targetVariantId: Number(res.campaign.targetVariantId || 569),
            timestamp: Date.now(),
          };
          document.cookie = `h2_campaign_attribution=${encodeURIComponent(JSON.stringify(attribution))}; max-age=${30 * 24 * 60 * 60}; path=/; SameSite=Lax`;
        }
      } catch (err) {
        console.warn('[Campaign resolve error]:', err?.message || err);
      }
    }

    if (!attribution) return;

    state.campaignAttribution = attribution;

    // Only auto-seed the target product if the user directly arrived via an active campaign link
    const isDirectCampaignLanding = Boolean(paramSlug);
    if (isDirectCampaignLanding) {
      const targetProductId = Number(attribution.targetProductId || 11);
      const targetVariantId = Number(attribution.targetVariantId || 569);
      const bottleProduct = (state.products || []).find((p) => Number(p.id) === targetProductId)
        || (state.products || []).find((p) => p.slug === 'h2-water-bottle')
        || (state.products || []).find((p) => String(p.name || '').toLowerCase().includes('bottle'));

      if (bottleProduct && Array.isArray(bottleProduct.variants) && bottleProduct.variants.length) {
        const targetVariant = bottleProduct.variants.find((v) => Number(v.id) === targetVariantId)
          || bottleProduct.variants.find((v) => Number(v.stock || 0) > 0)
          || bottleProduct.variants[0];

        if (targetVariant) {
          const bottleIndex = (state.cart || []).findIndex((item) => Number(item.productId) === Number(bottleProduct.id));

          if (bottleIndex >= 0) {
            const currentItem = state.cart[bottleIndex];
            // If user arrived via campaign link and current bottle variant is different, swap to the campaign variant
            if (Number(currentItem.variantId) !== Number(targetVariant.id)) {
              state.cart.splice(bottleIndex, 1);
              addToCart(targetVariant.id, currentItem.quantity || 1, bottleProduct, { openDrawerAfterAdd: false, preserveCoupon: true });
            }
          } else if (!state.cart || state.cart.length === 0) {
            addToCart(targetVariant.id, 1, bottleProduct, { openDrawerAfterAdd: false, preserveCoupon: true });
          }
        }
      }
    }

    // Auto-apply coupon from campaign if not already applied
    if (attribution.couponCode) {
      state.merchCouponCode = attribution.couponCode;
      if (state.cart && state.cart.length > 0) {
        await applyMerchCouponFromCart({ silent: true });
      }
    }

    if (state.currentView === 'checkout') {
      renderCheckoutPage();
    }
  }

  async function loadCurrencyConfig() {
    try {
      const res = await fetch(buildApiUrl('/api/currency/config'));
      if (res.ok) {
        const cfg = await res.json();
        if (cfg && cfg.inrPerUsd) {
          state.currencyConfig = cfg;
        }
      }
    } catch {}
  }

  // ─── Initialize ───
  async function init() {
    cleanupLegacySharedCartStorage();
    setBodyAuthLoading(true);
    renderAccountTrigger();
    await loadCustomerContext();
    loadCart(state.currentUser);
    renderCartBadge();
    bindEvents();
    await Promise.all([loadCurrencyConfig(), loadMerchProducts(), resolveCampaignAttribution()]);
    renderProductGrid();
    routeFromLocation();
    loadTrendingProducts();
    loadMerchOffers();
    loadMerchCoupons();
    window.__MERCH_APP_STATE__ = state;
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
