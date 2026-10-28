/**
 * RYAN FERNANDO × H2 HOUSE OF HEALTH — CORE APPLICATION LOGIC
 * Includes Search Popover, Cart Drawer, In-Cart Best Offers & In-Card Features
 */

/* ==========================================================================
   H2 PRODUCT CATALOGUE & BEST OFFERS DATA (Using only Section 3 assets)
   ========================================================================== */
const H2_CATALOGUE = [
  {
    id: 'bottle',
    productId: 'bottle',
    name: 'H2 Molecular Hydrogen Water Bottle',
    shortName: 'H2 Hydrogen Bottle',
    defaultVariant: 'Silver',
    price: 22990,
    originalPrice: 24200,
    offerDiscount: '5% OFF',
    image: 'assets/products/card-bottle-silver.jpg',
    inStock: true,
    targetCardSelector: '[data-product="bottle"]',
    keywords: ['bottle', 'water', 'molecular', 'hydrogen', 'h2', 'silver', 'black', 'gold', 'blue', '460ml', 'flask']
  },
  {
    id: 'mist',
    productId: 'mist',
    name: 'H2 Hydrogen Mist Spray',
    shortName: 'H2 Mist Spray',
    defaultVariant: 'White',
    price: 11990,
    originalPrice: 12267,
    offerDiscount: '2% OFF',
    image: 'assets/products/card-mist-white.jpg',
    inStock: true,
    targetCardSelector: '[data-product="mist"]',
    keywords: ['mist', 'spray', 'face', 'hydrogen', 'h2', 'white', 'black', 'ultrasonic', 'skincare', '13ml']
  },
  {
    id: 'hoodie',
    productId: 'hoodie',
    name: 'H2 Hoodie',
    shortName: 'H2 Hoodie',
    defaultVariant: 'Terracotta · L',
    price: 3499,
    originalPrice: 3899,
    offerDiscount: 'Sold Out',
    image: 'assets/products/card-hoodie-terracotta.jpg',
    inStock: false,
    targetCardSelector: '[data-product="hoodie"]',
    keywords: ['hoodie', 'apparel', 'sweatshirt', 'cotton', 'terracotta', 'merch', 'h2', 'wear']
  }
];

const BUNDLE_OFFER = {
  id: 'bundle-bottle-mist',
  productId: 'bundle',
  name: 'Bottle + Mist Bundle',
  variant: 'Silver Bottle + White Mist',
  price: 29733,
  originalPrice: 34980,
  savingsAmount: 5247,
  savingsPercent: '15% OFF',
  title: 'Bottle + Mist Bundle',
  desc: 'Includes: H2 Molecular Hydrogen Water Bottle + H2 Hydrogen Mist Spray',
  bottleThumb: 'assets/products/bottle-silver.png',
  mistThumb: 'assets/products/mist-white.png',
  cartImage: 'assets/products/bottle-silver.png'
};

const BEST_OFFERS_ITEMS = [
  {
    id: 'bottle-blue-offer',
    productId: 'bottle',
    name: 'H2 Bottle (Blue Edition)',
    variant: 'Blue',
    price: 22990,
    image: 'assets/products/card-bottle-blue.jpg',
    inStock: true
  },
  {
    id: 'bottle-gold-offer',
    productId: 'bottle',
    name: 'H2 Bottle (Gold Edition)',
    variant: 'Gold',
    price: 22990,
    image: 'assets/products/card-bottle-gold.jpg',
    inStock: true
  },
  {
    id: 'bottle-black-offer',
    productId: 'bottle',
    name: 'H2 Bottle (Midnight Black)',
    variant: 'Black',
    price: 22990,
    image: 'assets/products/card-bottle-black.jpg',
    inStock: true
  },
  {
    id: 'bottle-silver-offer',
    productId: 'bottle',
    name: 'H2 Bottle (Silver Edition)',
    variant: 'Silver',
    price: 22990,
    image: 'assets/products/card-bottle-silver.jpg',
    inStock: true
  },
  {
    id: 'mist-white-offer',
    productId: 'mist',
    name: 'H2 Mist Spray (White)',
    variant: 'White',
    price: 11990,
    image: 'assets/products/card-mist-white.jpg',
    inStock: true
  },
  {
    id: 'mist-black-offer',
    productId: 'mist',
    name: 'H2 Mist Spray (Black)',
    variant: 'Black',
    price: 11990,
    image: 'assets/products/card-mist-black.jpg',
    inStock: true
  }
];

/* ==========================================================================
   CART STORE MANAGEMENT (Single Source of Truth)
   ========================================================================== */
const DEFAULT_COUPON_CODE = 'RYANH2';
const DEFAULT_COUPON_DISCOUNT = 1150;
// Ryan pricing rules (must mirror getRyanPricing in booking/merch-api.js):
// bottle + mist pair = bundle (15% off), extra bottles / mists = 5% off.
// Commission to Ryan: ₹2,300 per bottle + ₹1,000 per mist.
const RYAN_BUNDLE_DISCOUNT_RATE = 0.15;
const RYAN_INDIVIDUAL_DISCOUNT_RATE = 0.05;
// Money helpers: totals are exact to the paisa and are never rounded to whole rupees,
// so the page total always equals the amount the server sends to Razorpay.
const roundRs = (value) => Math.round(value * 100) / 100;
const formatRs = (value) => Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const getRyanPairPrice = () => H2_CATALOGUE[0].price + H2_CATALOGUE[1].price;
const VALID_RYAN_CODES = ['RYANH2', 'RYAN', 'RYAN100'];

let currentCart = [];
let appliedCoupon = DEFAULT_COUPON_CODE;

function isPreMadeBundle(item) {
  return Boolean(
    item && (
      item.productId === 'bundle' ||
      item.productId === 'bundle-pair' ||
      item.id === 'bundle-bottle-mist' ||
      /bundle/i.test(String(item.productId || '')) ||
      /bundle/i.test(String(item.name || ''))
    )
  );
}

function isStandaloneBottle(item) {
  return Boolean(
    item &&
    !isPreMadeBundle(item) &&
    (item.productId === 'bottle' || /bottle/i.test(String(item.name || '')))
  );
}

function isStandaloneMist(item) {
  return Boolean(
    item &&
    !isPreMadeBundle(item) &&
    (item.productId === 'mist' || /(mist|spray)/i.test(String(item.name || '')))
  );
}

function getCartPreMadeBundleCount(cart = currentCart) {
  return (cart || []).reduce((count, item) => isPreMadeBundle(item) ? count + (Number(item.quantity) || 1) : count, 0);
}

function getCartStandaloneBottleCount(cart = currentCart) {
  return (cart || []).reduce((count, item) => isStandaloneBottle(item) ? count + (Number(item.quantity) || 1) : count, 0);
}

function getCartStandaloneMistCount(cart = currentCart) {
  return (cart || []).reduce((count, item) => isStandaloneMist(item) ? count + (Number(item.quantity) || 1) : count, 0);
}

// Auto-bundles formed by pairing standalone bottles and mists
function getCartAutoBundleCount(cart = currentCart) {
  return Math.min(getCartStandaloneBottleCount(cart), getCartStandaloneMistCount(cart));
}

// Total qualifying bundles in cart (both pre-made from Best Offers and auto-bundled standalone pairs)
function getCartTotalBundleCount(cart = currentCart) {
  return getCartPreMadeBundleCount(cart) + getCartAutoBundleCount(cart);
}

// Total bottles across all items (both inside bundles and standalone)
function getCartTotalBottleCount(cart = currentCart) {
  return getCartPreMadeBundleCount(cart) + getCartStandaloneBottleCount(cart);
}

// Only excess standalone bottles that are not paired into any bundle receive Ryan's customer discount
function getCartIndividualBottleCount(cart = currentCart) {
  return Math.max(0, getCartStandaloneBottleCount(cart) - getCartAutoBundleCount(cart));
}

// Excess standalone mists that are not paired into any bundle receive individual mist discount
function getCartIndividualMistCount(cart = currentCart) {
  return Math.max(0, getCartStandaloneMistCount(cart) - getCartAutoBundleCount(cart));
}

function initCartStore() {
  try {
    const rawCart = localStorage.getItem('merch_cart');
    let loaded = null;
    if (rawCart) {
      const parsed = JSON.parse(rawCart);
      // An empty array is a valid saved cart (user removed everything) and must not be re-seeded
      if (Array.isArray(parsed) && (parsed.length === 0 || (parsed[0].name && parsed[0].price))) {
        loaded = parsed;
      }
    }

    if (loaded) {
      currentCart = loaded;
    } else {
      // First visit: start with an empty cart
      currentCart = [];
      saveCart(currentCart);
    }

    // Ryan's offer (5% bottle/mist, 15% bundle) always applies on this page; there is no coupon to enter or remove.
    appliedCoupon = DEFAULT_COUPON_CODE;
    localStorage.removeItem('h2_applied_coupon');
  } catch (err) {
    console.warn('[H2 Cart] Failed to initialize cart store:', err);
    currentCart = [];
  }
}

function saveCart(cartItems) {
  currentCart = cartItems;
  try {
    const serialized = JSON.stringify(currentCart);
    localStorage.setItem('merch_cart', serialized);
    localStorage.setItem('h2_cart', serialized);
    localStorage.setItem('cart', serialized);
  } catch (e) {
    console.warn('[H2 Cart] LocalStorage write error:', e);
  }
  updateCartCounters();
  renderCartDrawer();
}

function getCartItemCount() {
  return currentCart.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
}

function updateCartCounters() {
  const count = getCartItemCount();
  const badge = document.getElementById('cartBadge');
  const drawerCount = document.getElementById('cartDrawerCount');

  if (badge) {
    badge.textContent = String(count);
    badge.setAttribute('aria-label', `${count} items in cart`);
    badge.style.display = 'inline-flex';
  }

  if (drawerCount) {
    drawerCount.textContent = String(count);
  }
}

function animateCartBadge() {
  const badge = document.getElementById('cartBadge');
  if (badge) {
    badge.style.transform = 'scale(1.35)';
    badge.style.transition = 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)';
    setTimeout(() => {
      badge.style.transform = 'scale(1)';
    }, 220);
  }
}

function addToCart(item) {
  const existingIdx = currentCart.findIndex((i) => i.id === item.id);
  if (existingIdx > -1) {
    currentCart[existingIdx].quantity += item.quantity || 1;
  } else {
    currentCart.push({
      id: item.id,
      productId: item.productId,
      name: item.name,
      variant: item.variant || 'Standard',
      price: Number(item.price),
      quantity: item.quantity || 1,
      image: item.image
    });
  }
  saveCart(currentCart);
  animateCartBadge();
  openCartDrawer();
}

function updateItemQuantity(index, newQty) {
  if (index < 0 || index >= currentCart.length) return;
  if (newQty <= 0) {
    removeItemFromCart(index);
    return;
  }
  currentCart[index].quantity = newQty;
  saveCart(currentCart);
}

function removeItemFromCart(index) {
  if (index < 0 || index >= currentCart.length) return;
  currentCart.splice(index, 1);
  saveCart(currentCart);
}

/* ==========================================================================
   APP INITIALIZATION
   ========================================================================== */
/**
 * Bottle and mist prices are owned by the database (edited in the admin portal). Read them once on load
 * so the page shows exactly what the server will charge; the hard-coded values above are only a fallback.
 */
async function syncPricesFromServer() {
  try {
    const res = await fetch('/api/merch/products', { credentials: 'include' });
    if (!res.ok) return;
    const products = await res.json();
    const priceOf = (pattern) => {
      const product = products.find((p) => pattern.test(String(p.name || '')));
      const prices = ((product && product.variants) || [])
        .filter((v) => Number(v.isActive ?? 1) === 1 && !v.deletedAt)
        .map((v) => Number(v.price))
        .filter((n) => n > 0);
      return prices.length ? Math.min(...prices) / 100 : 0;
    };
    const bottlePrice = priceOf(/bottle/i);
    const mistPrice = priceOf(/(mist|spray)/i);
    if (!bottlePrice && !mistPrice) return;

    const unitPrices = { bottle: bottlePrice, mist: mistPrice };
    for (const [key, price] of Object.entries(unitPrices)) {
      if (!price) continue;
      const catalogueItem = H2_CATALOGUE.find((item) => item.id === key);
      if (catalogueItem) catalogueItem.price = price;
      BEST_OFFERS_ITEMS.filter((offer) => offer.productId === key).forEach((offer) => { offer.price = price; });
      if (typeof FEATURE_DATA !== 'undefined' && FEATURE_DATA[key]) {
        FEATURE_DATA[key].price = `₹${price.toLocaleString('en-IN')}`;
      }
      const priceLabel = document.querySelector(`[data-product="${key}"] .product-price`);
      if (priceLabel) priceLabel.textContent = `₹${price.toLocaleString('en-IN')}`;
      const addBtn = document.getElementById(`${key}AddToCartBtn`);
      if (addBtn) addBtn.dataset.price = String(price);
    }

    const pairPrice = getRyanPairPrice();
    BUNDLE_OFFER.originalPrice = pairPrice;
    BUNDLE_OFFER.price = roundRs(pairPrice * (1 - RYAN_BUNDLE_DISCOUNT_RATE));
    BUNDLE_OFFER.savingsAmount = roundRs(pairPrice * RYAN_BUNDLE_DISCOUNT_RATE);

    currentCart.forEach((item) => {
      if (isPreMadeBundle(item)) {
        item.price = BUNDLE_OFFER.price;
        item.originalPrice = pairPrice;
      } else if (isStandaloneBottle(item) && bottlePrice) {
        item.price = bottlePrice;
      } else if (isStandaloneMist(item) && mistPrice) {
        item.price = mistPrice;
      }
    });
    saveCart(currentCart);
  } catch (err) {
    console.warn('[H2 Prices] Could not load live prices, using page defaults:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCartStore();
  initCartCounter();
  initCtaNavigation();
  initSearchInteraction();
  initCartDrawer();
  initVariantSelectors();
  initAddToCartActions();
  initFeatureGalleries();
  initFeatureLightbox();
  initRazorpayCheckout();
  initAuthSystem();
  syncPricesFromServer();

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target) {
      setTimeout(() => target.scrollIntoView({ behavior: 'instant', block: 'start' }), 50);
    }
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('openCart') === 'true' || urlParams.get('openCart') === '1') {
    setTimeout(openCartDrawer, 120);
  }
});

function initCartCounter() {
  updateCartCounters();
}

function initCtaNavigation() {
  const ctaButtons = [
    document.getElementById('heroCtaBtn'),
    document.getElementById('headerShopBtn'),
    document.getElementById('cartEmptyShopBtn')
  ].filter(Boolean);

  ctaButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const targetId = btn.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        const targetSection = document.querySelector(targetId);
        if (targetSection) {
          e.preventDefault();
          closeCartDrawer();
          targetSection.scrollIntoView({ behavior: 'smooth' });
          targetSection.focus();
        }
      }
    });
  });
}

/* ==========================================================================
   HEADER SEARCH INTERACTION & AUTOCOMPLETE
   ========================================================================== */
function initSearchInteraction() {
  const searchBtn = document.getElementById('searchToggleBtn');
  const searchDropdown = document.getElementById('searchDropdown');
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  const searchResultsList = document.getElementById('searchResultsList');
  const searchEmptyState = document.getElementById('searchEmptyState');
  const searchEmptyQuery = document.getElementById('searchEmptyQuery');
  const searchViewAllBtn = document.getElementById('searchViewAllBtn');
  const searchQueryLabel = document.getElementById('searchQueryLabel');

  if (!searchBtn || !searchDropdown || !searchInput) return;

  function openSearch() {
    searchDropdown.hidden = false;
    searchBtn.setAttribute('aria-expanded', 'true');
    searchInput.focus();
    filterSearchResults(searchInput.value.trim());
  }

  function closeSearch() {
    searchDropdown.hidden = true;
    searchBtn.setAttribute('aria-expanded', 'false');
  }

  searchBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (searchDropdown.hidden) {
      openSearch();
    } else {
      closeSearch();
    }
  });

  searchDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchClearBtn.hidden = true;
      filterSearchResults('');
      searchInput.focus();
    });
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim();
    if (searchClearBtn) {
      searchClearBtn.hidden = query.length === 0;
    }
    filterSearchResults(query);
  });

  function filterSearchResults(query) {
    const q = query.toLowerCase();
    if (searchQueryLabel) {
      searchQueryLabel.textContent = query || 'all products';
    }

    let matches = H2_CATALOGUE;
    if (q) {
      matches = H2_CATALOGUE.filter((product) => {
        return (
          product.name.toLowerCase().includes(q) ||
          product.shortName.toLowerCase().includes(q) ||
          product.keywords.some((kw) => kw.includes(q))
        );
      });
    }

    if (matches.length === 0) {
      if (searchResultsList) searchResultsList.innerHTML = '';
      if (searchEmptyState) searchEmptyState.hidden = false;
      if (searchEmptyQuery) searchEmptyQuery.textContent = query;
      if (searchViewAllBtn) searchViewAllBtn.hidden = true;
    } else {
      if (searchEmptyState) searchEmptyState.hidden = true;
      if (searchViewAllBtn) searchViewAllBtn.hidden = false;
      renderSearchResults(matches);
    }
  }

  function renderSearchResults(items) {
    if (!searchResultsList) return;
    searchResultsList.innerHTML = items
      .map(
        (product) => `
        <div class="search-result-item" role="option" data-target="${product.targetCardSelector}">
          <img src="${product.image}" alt="${product.name}" class="search-item-thumb" />
          <div class="search-item-info">
            <h4 class="search-item-name">${product.name}</h4>
            <div class="search-item-price">₹${product.price.toLocaleString('en-IN')}</div>
          </div>
          <span class="search-item-arrow" aria-hidden="true">&rsaquo;</span>
        </div>
      `
      )
      .join('');

    searchResultsList.querySelectorAll('.search-result-item').forEach((itemEl) => {
      itemEl.addEventListener('click', () => {
        const selector = itemEl.dataset.target;
        closeSearch();
        navigateToProductCard(selector);
      });
    });
  }

  if (searchViewAllBtn) {
    searchViewAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeSearch();
      const collection = document.getElementById('collection');
      if (collection) {
        collection.scrollIntoView({ behavior: 'smooth' });
        collection.focus();
      }
    });
  }

  // Close when clicking outside or pressing Escape
  document.addEventListener('click', (e) => {
    if (!searchDropdown.hidden && !searchDropdown.contains(e.target) && !searchBtn.contains(e.target)) {
      closeSearch();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !searchDropdown.hidden) {
      closeSearch();
      searchBtn.focus();
    }
  });
}

function navigateToProductCard(selector) {
  if (!selector) return;
  const targetCard = document.querySelector(selector);
  if (targetCard) {
    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetCard.classList.remove('pulse-highlight');
    void targetCard.offsetWidth; // Trigger reflow
    targetCard.classList.add('pulse-highlight');
    setTimeout(() => {
      targetCard.classList.remove('pulse-highlight');
    }, 1500);
  }
}

/* ==========================================================================
   CART DRAWER, COUPONS & IN-CART BEST OFFERS
   ========================================================================== */
function initCartDrawer() {
  const cartBtn = document.getElementById('cartToggleBtn');
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  const cartCloseBtn = document.getElementById('cartCloseBtn');
  const couponInput = document.getElementById('couponInput');
  const couponApplyBtn = document.getElementById('couponApplyBtn');
  const couponRemoveBtn = document.getElementById('couponRemoveBtn');
  const cartCheckoutBtn = document.getElementById('cartCheckoutBtn');
  const bestOffersPrevBtn = document.getElementById('bestOffersPrevBtn');
  const bestOffersNextBtn = document.getElementById('bestOffersNextBtn');
  const bestOffersCarousel = document.getElementById('bestOffersCarousel');

  if (cartBtn) {
    cartBtn.addEventListener('click', () => {
      openCartDrawer();
    });
  }

  if (cartCloseBtn) {
    cartCloseBtn.addEventListener('click', () => {
      closeCartDrawer();
    });
  }

  if (cartBackdrop) {
    cartBackdrop.addEventListener('click', () => {
      closeCartDrawer();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartDrawer && !cartDrawer.hidden) {
      closeCartDrawer();
      if (cartBtn) cartBtn.focus();
    }
  });

  // Coupon Apply
  if (couponApplyBtn && couponInput) {
    couponApplyBtn.addEventListener('click', () => {
      applyCouponCode(couponInput.value.trim());
    });
    couponInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyCouponCode(couponInput.value.trim());
      }
    });
  }

  // Coupon Remove
  if (couponRemoveBtn) {
    couponRemoveBtn.addEventListener('click', () => {
      removeCouponCode();
    });
  }

  // Checkout Handler
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', () => {
      handleCheckout();
    });
  }

  // Best Offers Carousel Navigation
  if (bestOffersPrevBtn && bestOffersCarousel) {
    bestOffersPrevBtn.addEventListener('click', () => {
      bestOffersCarousel.scrollBy({ left: -190, behavior: 'smooth' });
    });
  }
  if (bestOffersNextBtn && bestOffersCarousel) {
    bestOffersNextBtn.addEventListener('click', () => {
      bestOffersCarousel.scrollBy({ left: 190, behavior: 'smooth' });
    });
  }

  renderCartDrawer();
  renderBestOffers();
}

function openCartDrawer() {
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  if (!cartDrawer || !cartBackdrop) return;

  cartBackdrop.hidden = false;
  cartDrawer.hidden = false;
  // Trigger animation next frame
  requestAnimationFrame(() => {
    cartBackdrop.classList.add('open');
    cartDrawer.classList.add('open');
  });

  document.body.style.overflow = 'hidden';
}

function closeCartDrawer() {
  const cartDrawer = document.getElementById('cartDrawer');
  const cartBackdrop = document.getElementById('cartBackdrop');
  if (!cartDrawer || !cartBackdrop) return;

  cartBackdrop.classList.remove('open');
  cartDrawer.classList.remove('open');

  setTimeout(() => {
    cartBackdrop.hidden = true;
    cartDrawer.hidden = true;
    document.body.style.overflow = '';
  }, 320);
}

function applyCouponCode(code) {
  const messageEl = document.getElementById('couponMessage');
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) {
    showCouponMessage('Please enter a coupon code.', 'error');
    return;
  }

  if (VALID_RYAN_CODES.includes(normalized)) {
    const hasEligible = (getCartTotalBottleCount() > 0 || getCartStandaloneMistCount() > 0);
    if (currentCart.length > 0 && !hasEligible) {
      showCouponMessage('This coupon is valid for H2 Hydrogen Water Bottles and Mist Sprays.', 'error');
      return;
    }
    appliedCoupon = normalized;
    localStorage.setItem('h2_applied_coupon', normalized);
    showCouponMessage(`Coupon ${normalized} applied successfully!`, 'success');
    renderCartDrawer();
  } else {
    showCouponMessage(`Invalid coupon code. Try ${DEFAULT_COUPON_CODE}.`, 'error');
  }
}

function removeCouponCode() {
  appliedCoupon = null;
  localStorage.setItem('h2_applied_coupon', 'NONE');
  const couponInput = document.getElementById('couponInput');
  if (couponInput) couponInput.value = '';
  showCouponMessage('Coupon removed.', 'success');
  renderCartDrawer();
}

function showCouponMessage(text, type) {
  const messageEl = document.getElementById('couponMessage');
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.className = `coupon-message ${type}`;
  messageEl.hidden = false;
  setTimeout(() => {
    messageEl.hidden = true;
  }, 3200);
}

function renderCartDrawer() {
  const itemsContainer = document.getElementById('cartItemsList');
  const emptyNotice = document.getElementById('cartEmptyNotice');
  const bundleDiscountBanner = document.getElementById('bundleDiscountBanner');
  const bundleDiscountLabel = document.getElementById('bundleDiscountLabel');
  const bundleDiscountVal = document.getElementById('bundleDiscountVal');
  const appliedCouponRow = document.getElementById('appliedCouponRow');
  const discountSummaryText = document.getElementById('discountSummaryText');
  const appliedCouponCode = document.getElementById('appliedCouponCode');
  const appliedCouponAmount = document.getElementById('appliedCouponAmount');
  const originalSubtotal = document.getElementById('cartOriginalSubtotal');
  const finalTotal = document.getElementById('cartFinalTotal');
  const savingsPillWrap = document.getElementById('cartSavingsPillWrap');
  const savingsText = document.getElementById('cartSavingsText');
  const checkoutBtn = document.getElementById('cartCheckoutBtn');

  // Breakdown Card Elements
  const breakdownSubtotalVal = document.getElementById('breakdownSubtotalVal');
  const breakdownBundleRow = document.getElementById('breakdownBundleRow');
  const breakdownBundleLabel = document.getElementById('breakdownBundleLabel');
  const breakdownBundleVal = document.getElementById('breakdownBundleVal');
  const breakdownProductRow = document.getElementById('breakdownProductRow');
  const breakdownProductLabel = document.getElementById('breakdownProductLabel');
  const breakdownProductVal = document.getElementById('breakdownProductVal');
  const breakdownCouponRow = document.getElementById('breakdownCouponRow');
  const breakdownCouponLabel = document.getElementById('breakdownCouponLabel');
  const breakdownCouponVal = document.getElementById('breakdownCouponVal');
  const breakdownShippingRow = document.getElementById('breakdownShippingRow');
  const breakdownTaxRow = document.getElementById('breakdownTaxRow');
  const breakdownTaxVal = document.getElementById('breakdownTaxVal');

  if (!itemsContainer) return;

  const rawSubtotal = currentCart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const preMadeBundleCount = getCartPreMadeBundleCount();
  const autoBundleCount = getCartAutoBundleCount();
  const totalBundleCount = getCartTotalBundleCount();
  const unbundledBottles = getCartIndividualBottleCount();
  const unbundledMists = getCartIndividualMistCount();

  // Confirmed Business Rules:
  // Bundle (1 bottle + 1 mist): 15% off
  // Bottle / mist not part of a bundle: 5% off
  const bundleDiscount = roundRs(totalBundleCount * getRyanPairPrice() * RYAN_BUNDLE_DISCOUNT_RATE);
  const autoBundleDiscount = roundRs(autoBundleCount * getRyanPairPrice() * RYAN_BUNDLE_DISCOUNT_RATE);
  const unbundledBottleDiscount = roundRs(unbundledBottles * H2_CATALOGUE[0].price * RYAN_INDIVIDUAL_DISCOUNT_RATE);
  const unbundledMistDiscount = roundRs(unbundledMists * H2_CATALOGUE[1].price * RYAN_INDIVIDUAL_DISCOUNT_RATE);

  const hasEligibleItems = (getCartTotalBottleCount() > 0 || getCartStandaloneMistCount() > 0);
  const isCouponValid = Boolean(appliedCoupon && VALID_RYAN_CODES.includes(appliedCoupon) && hasEligibleItems);
  // Ryan Fernando exclusive coupon: 5% off each unbundled bottle / mist
  const ryanCustomerDiscount = isCouponValid ? roundRs((unbundledBottles * H2_CATALOGUE[0].price + unbundledMists * H2_CATALOGUE[1].price) * RYAN_INDIVIDUAL_DISCOUNT_RATE) : 0;

  // Total user discount: automatic bundle discount + applied Ryan coupon discount
  const totalUserDiscount = bundleDiscount + ryanCustomerDiscount;

  // Full retail subtotal before any discounts:
  const fullRetailSubtotal = currentCart.reduce((sum, item) => {
    const retail = isPreMadeBundle(item) ? (Number(item.originalPrice) || 34980) : item.price;
    return sum + retail * (item.quantity || 1);
  }, 0);

  const payable = Math.max(0, roundRs(fullRetailSubtotal - totalUserDiscount));
  const totalSavings = roundRs(totalUserDiscount);
  const gstIncluded = Math.max(0, roundRs(payable - Math.round(payable * 100 / 1.18) / 100));

  if (currentCart.length === 0) {
    itemsContainer.innerHTML = '';
    if (emptyNotice) emptyNotice.hidden = false;
    if (bundleDiscountBanner) bundleDiscountBanner.hidden = true;
    if (appliedCouponRow) {
      if (appliedCoupon) {
        appliedCouponRow.hidden = false;
        if (appliedCouponCode) appliedCouponCode.textContent = appliedCoupon;
        if (appliedCouponAmount) appliedCouponAmount.textContent = '₹0.00';
        const couponBadgeHighlight = document.getElementById('couponBadgeHighlight');
        if (couponBadgeHighlight) {
          couponBadgeHighlight.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            </svg>
            <span>Coupon <strong>${appliedCoupon}</strong> active — saves <strong>5%</strong> on a Water Bottle or Mist Spray and <strong>15%</strong> on a Bottle + Mist bundle.</span>
          `;
        }
      } else {
        appliedCouponRow.hidden = true;
      }
    }
    const couponInput = document.getElementById('couponInput');
    if (couponInput && appliedCoupon && document.activeElement !== couponInput) {
      couponInput.value = appliedCoupon;
    }
    if (breakdownSubtotalVal) breakdownSubtotalVal.textContent = '₹0.00';
    if (breakdownBundleRow) breakdownBundleRow.hidden = true;
    if (breakdownProductRow) breakdownProductRow.hidden = true;
    if (breakdownCouponRow) {
      if (appliedCoupon) {
        breakdownCouponRow.hidden = false;
        if (breakdownCouponLabel) {
          breakdownCouponLabel.textContent = `Ryan's offer (5% on Bottles & Mists)`;
        }
        if (breakdownCouponVal) {
          breakdownCouponVal.textContent = '₹0.00';
        }
      } else {
        breakdownCouponRow.hidden = true;
      }
    }
    if (breakdownTaxVal) breakdownTaxVal.textContent = '₹0.00';
    if (originalSubtotal) originalSubtotal.hidden = true;
    if (savingsPillWrap) savingsPillWrap.hidden = true;
    if (finalTotal) finalTotal.textContent = '₹0.00';
    if (checkoutBtn) {
      checkoutBtn.disabled = true;
      checkoutBtn.style.opacity = '0.5';
      checkoutBtn.style.cursor = 'not-allowed';
    }
    return;
  }

  if (emptyNotice) emptyNotice.hidden = true;
  if (checkoutBtn) {
    checkoutBtn.disabled = false;
    checkoutBtn.style.opacity = '1';
    checkoutBtn.style.cursor = 'pointer';
  }

  // Render items list
  itemsContainer.innerHTML = currentCart
    .map(
      (item, idx) => `
      <div class="cart-item-card" data-index="${idx}">
        <img src="${item.image}" alt="${item.name}" class="cart-item-thumb" />
        <div class="cart-item-info">
          <h4 class="cart-item-title">${item.name}</h4>
          <div class="cart-item-variant">${item.variant}</div>
          <div class="cart-qty-ctrl-row">
            <button
              class="cart-item-trash-btn"
              type="button"
              aria-label="Remove ${item.name}"
              title="Remove product"
              data-action="remove"
              data-index="${idx}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <div class="cart-qty-pill">
              <button
                class="cart-qty-btn"
                type="button"
                aria-label="Decrease quantity"
                data-action="decrease"
                data-index="${idx}"
              >-</button>
              <span class="cart-qty-num">${item.quantity}</span>
              <button
                class="cart-qty-btn"
                type="button"
                aria-label="Increase quantity"
                data-action="increase"
                data-index="${idx}"
              >+</button>
            </div>
          </div>
        </div>
        <div class="cart-item-price">₹${formatRs((item.price * item.quantity))}</div>
      </div>
    `
    )
    .join('');

  // Wire quantity controls
  itemsContainer.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const idx = Number(btn.dataset.index);
      const currentItem = currentCart[idx];
      if (!currentItem) return;

      if (action === 'remove') {
        removeItemFromCart(idx);
      } else if (action === 'decrease') {
        updateItemQuantity(idx, currentItem.quantity - 1);
      } else if (action === 'increase') {
        updateItemQuantity(idx, currentItem.quantity + 1);
      }
    });
  });

  // Sync coupon input field with active coupon so it is never deceptively blank
  const couponInput = document.getElementById('couponInput');
  if (couponInput) {
    if (appliedCoupon) {
      couponInput.value = appliedCoupon;
    } else if (document.activeElement !== couponInput) {
      couponInput.value = '';
    }
  }

  // 1. Display automatic bundle discount independently from applied-coupon row
  if (bundleDiscountBanner) {
    if (totalBundleCount > 0) {
      bundleDiscountBanner.hidden = false;
      if (bundleDiscountLabel) {
        bundleDiscountLabel.textContent = `Bottle + Mist Bundle — 15% off${totalBundleCount > 1 ? ` (${totalBundleCount} bundles)` : ''}`;
      }
      if (bundleDiscountVal) {
        bundleDiscountVal.textContent = `− ₹${bundleDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else {
      bundleDiscountBanner.hidden = true;
    }
  }

  // 2. Show Ryan coupon row whenever appliedCoupon is active
  const couponBadgeHighlight = document.getElementById('couponBadgeHighlight');
  if (appliedCouponRow) {
    if (appliedCoupon) {
      appliedCouponRow.hidden = false;
      if (appliedCouponCode) appliedCouponCode.textContent = appliedCoupon;
      if (appliedCouponAmount) {
        if (ryanCustomerDiscount > 0) {
          appliedCouponAmount.textContent = `− ₹${ryanCustomerDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else {
          appliedCouponAmount.textContent = `₹0.00`;
        }
      }
      if (couponBadgeHighlight) {
        if (ryanCustomerDiscount > 0) {
          couponBadgeHighlight.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            </svg>
            <span>Coupon <strong>${appliedCoupon}</strong> applied: <strong>−₹${ryanCustomerDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> discount</span>
          `;
        } else if (totalBundleCount > 0 && unbundledBottles === 0 && unbundledMists === 0) {
          couponBadgeHighlight.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            </svg>
            <span><strong>${appliedCoupon} applied</strong> — ₹0.00 additional coupon discount because the bundle discount already applies.</span>
          `;
        } else {
          couponBadgeHighlight.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
            </svg>
            <span>Coupon <strong>${appliedCoupon}</strong> active — saves <strong>5%</strong> on a Water Bottle or Mist Spray and <strong>15%</strong> on a Bottle + Mist bundle.</span>
          `;
        }
      }
    } else {
      appliedCouponRow.hidden = true;
    }
  }

  // 3. Itemized Estimated-Total Breakdown using authoritative values
  if (breakdownSubtotalVal) {
    breakdownSubtotalVal.textContent = `₹${formatRs(fullRetailSubtotal)}`;
  }

  if (breakdownBundleRow) {
    if (bundleDiscount > 0) {
      breakdownBundleRow.hidden = false;
      if (breakdownBundleLabel) {
        breakdownBundleLabel.textContent = `Bottle + Mist Bundle discount (${totalBundleCount} bundle${totalBundleCount > 1 ? 's' : ''})`;
      }
      if (breakdownBundleVal) {
        breakdownBundleVal.textContent = `−₹${bundleDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
    } else {
      breakdownBundleRow.hidden = true;
    }
  }

  if (breakdownProductRow) {
    breakdownProductRow.hidden = true;
  }

  if (breakdownCouponRow) {
    if (appliedCoupon) {
      breakdownCouponRow.hidden = false;
      if (ryanCustomerDiscount > 0) {
        let itemsLabel = '';
        if (unbundledBottles > 0 && unbundledMists === 0) {
          itemsLabel = unbundledBottles > 1 ? ` (${unbundledBottles} bottles)` : '';
        } else if (unbundledBottles === 0 && unbundledMists > 0) {
          itemsLabel = unbundledMists > 1 ? ` (${unbundledMists} mists)` : ` (1 mist)`;
        } else if (unbundledBottles > 0 && unbundledMists > 0) {
          itemsLabel = ` (${unbundledBottles} bottle${unbundledBottles > 1 ? 's' : ''} + ${unbundledMists} mist${unbundledMists > 1 ? 's' : ''})`;
        }
        if (breakdownCouponLabel) {
          breakdownCouponLabel.textContent = `Ryan's offer · 5% off${itemsLabel}`;
        }
        if (breakdownCouponVal) {
          breakdownCouponVal.textContent = `−₹${ryanCustomerDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        }
      } else if (totalBundleCount > 0 && unbundledBottles === 0 && unbundledMists === 0) {
        // Explain clearly why coupon discount is ₹0.00 when bundle is present
        if (breakdownCouponLabel) {
          breakdownCouponLabel.textContent = `Ryan's offer (bundle discount already applies)`;
        }
        if (breakdownCouponVal) {
          breakdownCouponVal.textContent = `₹0.00`;
        }
      } else {
        if (breakdownCouponLabel) {
          breakdownCouponLabel.textContent = `Ryan's offer (5% on Bottles & Mists)`;
        }
        if (breakdownCouponVal) {
          breakdownCouponVal.textContent = `₹0.00`;
        }
      }
    } else {
      // Hide inapplicable zero-value row
      breakdownCouponRow.hidden = true;
    }
  }

  if (breakdownTaxVal) {
    breakdownTaxVal.textContent = `₹${formatRs(gstIncluded)}`;
  }

  // Original Subtotal strike-through and savings pill in footer
  if (originalSubtotal) {
    if (totalSavings > 0) {
      originalSubtotal.hidden = false;
      originalSubtotal.textContent = `₹${formatRs(fullRetailSubtotal)}`;
    } else {
      originalSubtotal.hidden = true;
    }
  }

  if (savingsPillWrap) {
    if (totalSavings > 0) {
      savingsPillWrap.hidden = false;
      if (savingsText) {
        savingsText.textContent = `₹${formatRs(totalSavings)}`;
      }
    } else {
      savingsPillWrap.hidden = true;
    }
  }

  if (finalTotal) {
    finalTotal.textContent = `₹${formatRs(payable)}`;
  }
}

function renderBestOffers() {
  const carousel = document.getElementById('bestOffersCarousel');
  if (!carousel) return;

  const bundleCardHtml = `
    <div class="best-offer-bundle-card" data-bundle-card="true">
      <div class="bundle-card-top-row">
        <span class="bundle-save-badge">SAVE 15%</span>
        <span class="bundle-tag">BUNDLE OFFER</span>
      </div>

      <div class="bundle-preview-box">
        <div class="bundle-preview-item">
          <div class="bundle-thumb-frame">
            <img src="${BUNDLE_OFFER.bottleThumb}" alt="H2 Bottle" class="bundle-thumb-img" />
          </div>
          <span class="bundle-item-label">Bottle</span>
        </div>

        <span class="bundle-plus-sign" aria-hidden="true">+</span>

        <div class="bundle-preview-item">
          <div class="bundle-thumb-frame">
            <img src="${BUNDLE_OFFER.mistThumb}" alt="H2 Mist Spray" class="bundle-thumb-img" />
          </div>
          <span class="bundle-item-label">Mist Spray</span>
        </div>
      </div>

      <div class="bundle-info-block">
        <h5 class="bundle-title">${BUNDLE_OFFER.title}</h5>
        <p class="bundle-desc">${BUNDLE_OFFER.desc}</p>
        <div class="bundle-pricing-row">
          <strong class="bundle-price-main">₹${formatRs(BUNDLE_OFFER.price)}</strong>
          <span class="bundle-price-strike">₹${formatRs(BUNDLE_OFFER.originalPrice)}</span>
          <span class="bundle-savings-pill">Save ₹${formatRs(BUNDLE_OFFER.savingsAmount)} (${BUNDLE_OFFER.savingsPercent})</span>
        </div>
      </div>

      <button class="bundle-add-btn" id="bundleAddBtn" type="button">
        + ADD
      </button>
    </div>
  `;

  const itemsHtml = BEST_OFFERS_ITEMS.map(
    (offer, i) => `
    <div class="best-offer-card" data-offer-id="${offer.id}">
      <img src="${offer.image}" alt="${offer.name}" class="offer-card-img" />
      <h5 class="offer-card-title">${offer.name}</h5>
      <div class="offer-price-row">
        <span class="offer-price-val">₹${offer.price.toLocaleString('en-IN')}</span>
      </div>
      <button
        class="offer-add-btn"
        type="button"
        ${offer.inStock ? '' : 'disabled aria-disabled="true"'}
        data-offer-index="${i}"
      >
        ${offer.inStock ? '+ ADD' : 'Sold Out'}
      </button>
    </div>
  `
  ).join('');

  carousel.innerHTML = bundleCardHtml + itemsHtml;

  // Wire Bundle Offer Add button
  const bundleAddBtn = carousel.querySelector('#bundleAddBtn');
  if (bundleAddBtn) {
    bundleAddBtn.addEventListener('click', () => {
      const originalText = bundleAddBtn.textContent;
      bundleAddBtn.textContent = 'Added ✓';
      bundleAddBtn.style.background = 'var(--h2-terracotta)';
      bundleAddBtn.style.color = '#FFFFFF';
      bundleAddBtn.style.borderColor = 'var(--h2-terracotta)';

      addToCart({
        id: BUNDLE_OFFER.id,
        productId: BUNDLE_OFFER.productId,
        name: BUNDLE_OFFER.name,
        variant: BUNDLE_OFFER.variant,
        price: BUNDLE_OFFER.price,
        quantity: 1,
        image: BUNDLE_OFFER.cartImage
      });

      setTimeout(() => {
        bundleAddBtn.textContent = originalText;
        bundleAddBtn.style.background = '';
        bundleAddBtn.style.color = '';
        bundleAddBtn.style.borderColor = '';
      }, 1200);
    });
  }

  // Wire Individual Product Add buttons
  carousel.querySelectorAll('.offer-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.offerIndex);
      const offer = BEST_OFFERS_ITEMS[idx];
      if (!offer || !offer.inStock) return;

      const originalText = btn.textContent;
      btn.textContent = 'Added ✓';
      btn.style.background = 'var(--h2-terracotta)';
      btn.style.color = '#FFFFFF';

      addToCart({
        id: `${offer.productId}-${offer.variant}`,
        productId: offer.productId,
        name: offer.name,
        variant: offer.variant,
        price: offer.price,
        quantity: 1,
        image: offer.image
      });

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 1200);
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function handleCheckout() {
  if (currentCart.length === 0) {
    openCartDrawer();
    return;
  }
  showCheckoutPage();
}

/**
 * Dedicated Shopify-style Checkout Page Navigation
 */
function showCheckoutPage() {
  if (currentCart.length === 0) {
    openCartDrawer();
    return;
  }
  closeCartDrawer();

  const mainContent = document.getElementById('mainContent');
  const checkoutPage = document.getElementById('checkoutPage');
  const bookingConfirmation = document.getElementById('bookingConfirmation');

  if (mainContent) mainContent.hidden = true;
  if (bookingConfirmation) bookingConfirmation.hidden = true;
  if (checkoutPage) checkoutPage.hidden = false;

  window.location.hash = 'checkout';
  renderCheckoutPage();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function returnToShop() {
  const mainContent = document.getElementById('mainContent');
  const checkoutPage = document.getElementById('checkoutPage');
  const bookingConfirmation = document.getElementById('bookingConfirmation');

  if (checkoutPage) checkoutPage.hidden = true;
  if (bookingConfirmation) bookingConfirmation.hidden = true;
  if (mainContent) mainContent.hidden = false;

  window.location.hash = '#collection';
  const target = document.getElementById('collection');
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Render Complete Dedicated Checkout Page with Razorpay Payment Section
 */
function renderCheckoutPage() {
  const container = document.getElementById('checkoutPage');
  if (!container) return;

  const rawSubtotal = currentCart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);
  const preMadeBundleCount = getCartPreMadeBundleCount();
  const autoBundleCount = getCartAutoBundleCount();
  const totalBundleCount = getCartTotalBundleCount();
  const unbundledBottles = getCartIndividualBottleCount();
  const unbundledMists = getCartIndividualMistCount();

  const bundleDiscount = roundRs(totalBundleCount * getRyanPairPrice() * RYAN_BUNDLE_DISCOUNT_RATE);
  const autoBundleDiscount = roundRs(autoBundleCount * getRyanPairPrice() * RYAN_BUNDLE_DISCOUNT_RATE);
  const unbundledBottleDiscount = roundRs(unbundledBottles * H2_CATALOGUE[0].price * RYAN_INDIVIDUAL_DISCOUNT_RATE);
  const unbundledMistDiscount = roundRs(unbundledMists * H2_CATALOGUE[1].price * RYAN_INDIVIDUAL_DISCOUNT_RATE);

  const hasEligibleItems = (getCartTotalBottleCount() > 0 || getCartStandaloneMistCount() > 0);
  const isCouponValid = Boolean(appliedCoupon && VALID_RYAN_CODES.includes(appliedCoupon) && hasEligibleItems);
  const ryanCustomerDiscount = isCouponValid ? roundRs((unbundledBottles * H2_CATALOGUE[0].price + unbundledMists * H2_CATALOGUE[1].price) * RYAN_INDIVIDUAL_DISCOUNT_RATE) : 0;

  const totalUserDiscount = bundleDiscount + ryanCustomerDiscount;

  const fullRetailSubtotal = currentCart.reduce((sum, item) => {
    const retail = isPreMadeBundle(item) ? (Number(item.originalPrice) || 34980) : item.price;
    return sum + retail * (item.quantity || 1);
  }, 0);

  const payable = Math.max(0, roundRs(fullRetailSubtotal - totalUserDiscount));
  const totalSavings = roundRs(totalUserDiscount);
  const gstIncluded = Math.max(0, roundRs(payable - Math.round(payable * 100 / 1.18) / 100));

  // Customer draft with auto-fill for authenticated user or saved guest info
  let draft = {};
  try {
    draft = JSON.parse(localStorage.getItem('h2_customer_details') || '{}');
  } catch (e) {}

  if (currentAuthUser) {
    if (!draft.email && currentAuthUser.email) draft.email = currentAuthUser.email;
    if (!draft.firstName && currentAuthUser.name) draft.firstName = currentAuthUser.name.split(' ')[0];
    if (!draft.lastName && currentAuthUser.name) draft.lastName = currentAuthUser.name.split(' ').slice(1).join(' ');
    if (!draft.phone && currentAuthUser.phone) draft.phone = currentAuthUser.phone;
    if (Array.isArray(currentAuthUser.savedAddresses) && currentAuthUser.savedAddresses.length > 0) {
      const lastAddr = currentAuthUser.savedAddresses[currentAuthUser.savedAddresses.length - 1];
      if (!draft.address && lastAddr.address) draft.address = lastAddr.address;
      if (!draft.city && lastAddr.city) draft.city = lastAddr.city;
      if (!draft.pincode && lastAddr.pincode) draft.pincode = lastAddr.pincode;
    }
  }

  const productsHtml = currentCart.map((item, idx) => {
    const isBundle = isPreMadeBundle(item);
    const linePrice = item.price;
    const qty = item.quantity || 1;
    const img = item.image || (isBundle ? 'assets/products/bottle-silver.png' : 'assets/products/card-bottle-silver.jpg');

    return `
      <div class="shopify-summary-product" data-item-idx="${idx}">
        <div class="shopify-summary-product__image">
          <img src="${img}" alt="${escapeHtml(item.name || 'H2 Product')}" />
          <span class="summary-qty-badge">${qty}</span>
        </div>
        <div class="shopify-summary-product__copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small>${escapeHtml(item.variant || '')}</small>
          <div class="shopify-summary-product__stepper">
            <button class="shopify-summary-product__step-btn" type="button" data-action="checkout-qty-minus" data-idx="${idx}" aria-label="Decrease quantity">−</button>
            <span class="shopify-summary-product__step-qty">${qty}</span>
            <button class="shopify-summary-product__step-btn" type="button" data-action="checkout-qty-plus" data-idx="${idx}" aria-label="Increase quantity">+</button>
          </div>
        </div>
        <div class="shopify-summary-product__price">
          ₹${formatRs((linePrice * qty))}
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="shopify-checkout-nav-bar">
      <a href="#collection" class="shopify-checkout-nav-logo" data-action="return-to-shop" aria-label="Return to store">
        <img src="assets/H2_Logo_brand.png" alt="H2 House of Health" />
      </a>
      <div class="shopify-checkout-breadcrumbs">
        <span>Cart</span>
        <span>&rsaquo;</span>
        <span class="is-active">Delivery &amp; Payment</span>
      </div>
      <a href="#collection" class="shopify-checkout-return-link" data-action="return-to-shop">
        &larr; Return to Store
      </a>
    </div>

    <div class="shopify-checkout__inner">
      <form id="shopifyCheckoutForm" class="shopify-checkout-form" novalidate>
        <!-- Contact Section -->
        <section class="shopify-section shopify-section--contact">
          <div class="shopify-section__head">
            <h1 id="checkoutPageTitle">Contact Information</h1>
          </div>

          ${currentAuthUser ? `
            <div class="shopify-checkout-auth-banner signed-in">
              <span>Signed in as <strong>${escapeHtml(currentAuthUser.name || 'Customer')}</strong> ${currentAuthUser.email ? `(${escapeHtml(currentAuthUser.email)})` : ''}</span>
              <button type="button" class="shopify-auth-link" id="checkoutSignOutPrompt">Switch account / Sign out</button>
            </div>
          ` : `
            <div class="shopify-checkout-auth-banner">
              <span>Have an account? <button type="button" class="shopify-auth-link" id="checkoutSignInPrompt">Sign in for faster checkout</button></span>
              <span>· Or continue below as guest</span>
            </div>
          `}

          <div class="shopify-field shopify-field--wide">
            <label class="shopify-field-label" for="checkoutCustEmail">Email Address <span class="req">*</span></label>
            <input type="email" id="checkoutCustEmail" name="email" value="${escapeHtml(draft.email || '')}" placeholder="name@example.com" required autocomplete="email" />
            <span class="shopify-field-hint">Your Razorpay receipt and tracking details will be sent here.</span>
          </div>
          <label class="shopify-check">
            <input type="checkbox" id="checkoutEmailOffers" name="emailOffers" checked />
            <span>Email me with exclusive wellness updates &amp; offers</span>
          </label>
        </section>

        <!-- Delivery Section -->
        <section class="shopify-section shopify-section--delivery">
          <div class="shopify-section__head">
            <h2>Delivery Address</h2>
          </div>
          <div class="shopify-field-grid">
            <div class="shopify-field shopify-field--wide">
              <label class="shopify-field-label" for="checkoutCountry">Country / Region <span class="req">*</span></label>
              <select id="checkoutCountry" name="country">
                <option value="India" selected>India</option>
                <option value="United States">United States</option>
                <option value="United Arab Emirates">United Arab Emirates</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Singapore">Singapore</option>
                <option value="Canada">Canada</option>
              </select>
            </div>
            <div class="shopify-field">
              <label class="shopify-field-label" for="checkoutCustFirstName">First Name <span class="req">*</span></label>
              <input type="text" id="checkoutCustFirstName" name="firstName" value="${escapeHtml(draft.firstName || draft.name?.split(' ')[0] || '')}" placeholder="e.g. Rahul" required autocomplete="given-name" />
            </div>
            <div class="shopify-field">
              <label class="shopify-field-label" for="checkoutCustLastName">Last Name <span class="req">*</span></label>
              <input type="text" id="checkoutCustLastName" name="lastName" value="${escapeHtml(draft.lastName || draft.name?.split(' ').slice(1).join(' ') || '')}" placeholder="e.g. Sharma" required autocomplete="family-name" />
            </div>
            <div class="shopify-field shopify-field--wide">
              <label class="shopify-field-label" for="checkoutCustAddress">Address <span class="req">*</span></label>
              <input type="text" id="checkoutCustAddress" name="address" value="${escapeHtml(draft.address || '')}" placeholder="House / Flat / Street address" required autocomplete="street-address" />
            </div>
            <div class="shopify-field shopify-field--wide">
              <label class="shopify-field-label" for="checkoutCustApartment">Apartment, suite, etc. (optional)</label>
              <input type="text" id="checkoutCustApartment" name="apartment" value="${escapeHtml(draft.apartment || '')}" placeholder="Apartment, unit, floor" autocomplete="address-line2" />
            </div>
            <div class="shopify-field">
              <label class="shopify-field-label" for="checkoutCustCity">City <span class="req">*</span></label>
              <input type="text" id="checkoutCustCity" name="city" value="${escapeHtml(draft.city || '')}" placeholder="City" required autocomplete="address-level2" />
            </div>
            <div class="shopify-field">
              <label class="shopify-field-label" for="checkoutCustPincode">PIN Code <span class="req">*</span></label>
              <input type="text" id="checkoutCustPincode" name="pincode" value="${escapeHtml(draft.pincode || '')}" placeholder="6-digit PIN code" maxlength="6" inputmode="numeric" required autocomplete="postal-code" />
            </div>
            <div class="shopify-field shopify-field--wide">
              <label class="shopify-field-label" for="checkoutCustPhone">Phone Number <span class="req">*</span></label>
              <input type="tel" id="checkoutCustPhone" name="phone" value="${escapeHtml(draft.phone || '')}" placeholder="10-digit mobile number" maxlength="10" inputmode="numeric" required autocomplete="tel" />
              <span class="shopify-field-hint">Required for order verification and courier delivery tracking.</span>
            </div>
          </div>
          <label class="shopify-check">
            <input type="checkbox" id="checkoutSaveInfo" name="saveInfo" checked />
            <span>Save this information for next time</span>
          </label>
        </section>

        <!-- Shipping Method -->
        <section class="shopify-section shopify-section--shipping">
          <div class="shopify-section__head">
            <h2>Shipping Method</h2>
          </div>
          <div class="shopify-shipping-box">
            <div class="shipping-icon-wrap" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M1 3h15v13H1z"></path>
                <path d="M16 8h4l3 3v5h-7V8z"></path>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <div>
              <p>Free Standard Shipping across India (3–5 business days)</p>
            </div>
            <strong class="shipping-free">FREE</strong>
          </div>
        </section>

        <!-- Dedicated Razorpay Payment Section -->
        <section class="shopify-section shopify-section--payment">
          <div class="shopify-section__head">
            <h2>Payment Gateway</h2>
          </div>
          <p class="shopify-payment-sub">All transactions are encrypted and processed securely by Razorpay.</p>
          <div class="shopify-payment-box">
            <label class="shopify-payment-option">
              <div class="shopify-payment-option-left">
                <input type="radio" name="paymentMethod" value="razorpay" checked />
                <span class="shopify-payment-name">Razorpay (Cards, UPI, NetBanking, Wallets)</span>
              </div>
              <strong class="shopify-payment-badge">Razorpay</strong>
            </label>
            <div class="shopify-payment-gateway-note">
              <div class="payment-note-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B7A42" stroke-width="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <p>After clicking <strong>Continue to Payment</strong>, you will complete your purchase securely via Razorpay with <strong>UPI (GPay, PhonePe, Paytm), Credit &amp; Debit Cards, NetBanking, or Wallets</strong>.</p>
                <div class="shopify-payment-methods-logos">
                  <span class="payment-method-pill">UPI</span>
                  <span class="payment-method-pill">Google Pay</span>
                  <span class="payment-method-pill">PhonePe</span>
                  <span class="payment-method-pill">Paytm</span>
                  <span class="payment-method-pill">Visa / Mastercard / RuPay</span>
                  <span class="payment-method-pill">NetBanking (50+ Banks)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div id="checkoutFormErrorMessage" class="checkout-error-msg" hidden style="margin-bottom:14px;color:#C0392B;font-weight:600;font-size:13px;"></div>

        <div class="shopify-checkout-actions">
          <button type="submit" class="shopify-pay-button" id="shopifyPayBtn">
            <span>CONTINUE TO PAYMENT (₹${formatRs(payable)})</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </button>
          <a href="#collection" class="shopify-continue-button" data-action="return-to-shop">
            RETURN TO SHOP
          </a>
        </div>

        <div class="shopify-checkout-policies">
          By placing your order, you agree to our 
          <a href="/pages/contact.html" target="_blank">Terms of Service</a>, 
          <a href="/pages/contact.html" target="_blank">Privacy Policy</a>, and 
          <a href="/pages/contact.html" target="_blank">Warranty Policy</a>.
          <div class="shopify-disclaimer-box">
            <strong>Bottle Color Disclaimer:</strong> Bottle color availability may vary slightly depending on stock. All products are authentic and backed by H2 House of Health warranty.
          </div>
        </div>
      </form>

      <!-- Right Column: Order Summary Aside -->
      <aside class="shopify-summary" aria-label="Order Summary">
        <h2>Order summary</h2>

        <div class="shopify-summary-products">
          ${productsHtml}
        </div>

        <div class="shopify-pricing">
          <div class="shopify-price-row">
            <span>Original subtotal</span>
            <strong>₹${formatRs(fullRetailSubtotal)}</strong>
          </div>
          ${bundleDiscount > 0 ? `
            <div class="shopify-price-row shopify-price-row--discount">
              <span>Bottle + Mist Bundle discount (${totalBundleCount} bundle${totalBundleCount > 1 ? 's' : ''})</span>
              <strong>−₹${bundleDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          ` : ''}
          ${ryanCustomerDiscount > 0 ? `
            <div class="shopify-price-row shopify-price-row--discount">
              <span>Ryan's offer · 5% off</span>
              <strong>−₹${ryanCustomerDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          ` : (appliedCoupon ? `
            <div class="shopify-price-row shopify-price-row--discount" style="opacity:0.85;">
              <span>Ryan's offer ${totalBundleCount > 0 && unbundledBottles === 0 && unbundledMists === 0 ? '(Bundle already includes 15% off)' : '(5% on Bottles & Mists)'}</span>
              <strong>₹0.00</strong>
            </div>
          ` : '')}
          <div class="shopify-price-row">
            <span>Shipping</span>
            <strong style="color:#1B7A42;">FREE</strong>
          </div>
          <div class="shopify-price-row">
            <span>Tax (GST 18% included)</span>
            <strong>₹${formatRs(gstIncluded)}</strong>
          </div>
        </div>

        ${totalSavings > 0 ? `
          <div class="shopify-savings-breakdown">
            <span class="shopify-savings-breakdown__title">Discounts &amp; Savings</span>
            ${bundleDiscount > 0 ? `
              <div class="shopify-savings-breakdown__row">
                <div>
                  <strong>Bottle + Mist Bundle</strong>
                  <small>15% OFF (${totalBundleCount} bundle${totalBundleCount > 1 ? 's' : ''})</small>
                </div>
                <strong>₹${bundleDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            ` : ''}
            ${ryanCustomerDiscount > 0 ? `
              <div class="shopify-savings-breakdown__row">
                <div>
                  <strong>Ryan Fernando Discount (${appliedCoupon})</strong>
                  <small>Applied to standalone bottles &amp; mists</small>
                </div>
                <strong>₹${ryanCustomerDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </div>
            ` : ''}
            <div class="shopify-savings-breakdown__total">
              <span>Total Savings</span>
              <strong>₹${formatRs(totalSavings)}</strong>
            </div>
          </div>
        ` : ''}

        <div class="shopify-total">
          <span>Total</span>
          <strong><small>INR</small>₹${formatRs(payable)}</strong>
        </div>

        <div class="shopify-trust">
          <div class="shopify-trust-item">
            <div class="shopify-trust-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>
            </div>
            <span class="shopify-trust-text">100% Authentic<br>Products</span>
          </div>
          <div class="shopify-trust-item">
            <div class="shopify-trust-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <span class="shopify-trust-text">256-Bit SSL<br>Razorpay Secure</span>
          </div>
          <div class="shopify-trust-item">
            <div class="shopify-trust-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 3h15v13H1z"></path><path d="M16 8h4l3 3v5h-7V8z"></path><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            </div>
            <span class="shopify-trust-text">Fast &amp; Reliable<br>Delivery</span>
          </div>
          <div class="shopify-trust-item">
            <div class="shopify-trust-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <span class="shopify-trust-text">H2 Quality<br>Promise</span>
          </div>
        </div>
      </aside>
    </div>
  `;

  bindCheckoutPageEvents();
}

/**
 * Event Bindings for Checkout Page
 */
function bindCheckoutPageEvents() {
  const container = document.getElementById('checkoutPage');
  if (!container) return;

  // Return to Shop links
  container.querySelectorAll('[data-action="return-to-shop"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      returnToShop();
    });
  });

  // Auth Prompts on Checkout Page
  const signInPrompt = container.querySelector('#checkoutSignInPrompt');
  if (signInPrompt) {
    signInPrompt.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal('signin');
    });
  }

  const signOutPrompt = container.querySelector('#checkoutSignOutPrompt');
  if (signOutPrompt) {
    signOutPrompt.addEventListener('click', (e) => {
      e.preventDefault();
      handleSignOut();
    });
  }

  // Quantity Steppers
  container.querySelectorAll('[data-action="checkout-qty-plus"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (currentCart[idx]) {
        currentCart[idx].quantity = (currentCart[idx].quantity || 1) + 1;
        saveCart(currentCart);
        renderCheckoutPage();
      }
    });
  });

  container.querySelectorAll('[data-action="checkout-qty-minus"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx, 10);
      if (currentCart[idx]) {
        if ((currentCart[idx].quantity || 1) > 1) {
          currentCart[idx].quantity -= 1;
        } else {
          currentCart.splice(idx, 1);
        }
        saveCart(currentCart);
        if (currentCart.length === 0) {
          returnToShop();
        } else {
          renderCheckoutPage();
        }
      }
    });
  });

  // Coupon Apply & Remove
  const couponInput = container.querySelector('#checkoutCouponInput');
  const applyBtn = container.querySelector('#checkoutCouponApplyBtn');
  const removeBtn = container.querySelector('#checkoutCouponRemoveBtn');

  if (applyBtn && couponInput) {
    applyBtn.addEventListener('click', () => {
      const code = couponInput.value.trim().toUpperCase();
      if (!code) return;
      if (VALID_RYAN_CODES.includes(code)) {
        appliedCoupon = code;
        localStorage.setItem('h2_applied_coupon', code);
        renderCheckoutPage();
      } else {
        const msg = container.querySelector('#checkoutCouponMsg');
        if (msg) {
          msg.textContent = 'Invalid coupon code. Try RYANH2.';
          msg.className = 'shopify-coupon__message is-error';
          msg.hidden = false;
        }
      }
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      appliedCoupon = null;
      localStorage.removeItem('h2_applied_coupon');
      renderCheckoutPage();
    });
  }

  // Form Submit -> Initiate Razorpay Checkout
  const form = container.querySelector('#shopifyCheckoutForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const errorMsg = container.querySelector('#checkoutFormErrorMessage');
      const submitBtn = container.querySelector('#shopifyPayBtn');

      const firstName = container.querySelector('#checkoutCustFirstName')?.value.trim() || '';
      const lastName = container.querySelector('#checkoutCustLastName')?.value.trim() || '';
      const name = `${firstName} ${lastName}`.trim();
      const email = container.querySelector('#checkoutCustEmail')?.value.trim() || '';
      const address = container.querySelector('#checkoutCustAddress')?.value.trim() || '';
      const apartment = container.querySelector('#checkoutCustApartment')?.value.trim() || '';
      const city = container.querySelector('#checkoutCustCity')?.value.trim() || '';
      const pincode = container.querySelector('#checkoutCustPincode')?.value.trim() || '';
      const phone = container.querySelector('#checkoutCustPhone')?.value.trim() || '';

      if (!firstName || !lastName || !email || !address || !city || !pincode || !phone) {
        if (errorMsg) {
          errorMsg.textContent = 'Please fill in all required delivery fields.';
          errorMsg.hidden = false;
        }
        return;
      }

      if (!/^\d{10}$/.test(phone.replace(/\D/g, ''))) {
        if (errorMsg) {
          errorMsg.textContent = 'Please enter a valid 10-digit mobile number.';
          errorMsg.hidden = false;
        }
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (errorMsg) {
          errorMsg.textContent = 'Please enter a valid email address.';
          errorMsg.hidden = false;
        }
        return;
      }

      if (errorMsg) errorMsg.hidden = true;

      const customer = { name, firstName, lastName, phone, email, address, apartment, city, pincode };
      try {
        localStorage.setItem('h2_customer_details', JSON.stringify(customer));
      } catch (err) {}

      await startRazorpayCheckout(customer, submitBtn, errorMsg);
    });
  }
}

/**
 * Resolve real merch variant IDs (bottle / mist) from the catalogue API and expand the cart into
 * the line items /api/merch/checkout expects. A pre-made bundle becomes one bottle + one mist so the
 * server prices bundles, extra bottles and extra mists with the same Ryan rules.
 */
async function buildMerchCheckoutItems(cart) {
  const res = await fetch('/api/merch/products', { credentials: 'include' });
  if (!res.ok) throw new Error('Unable to load product catalogue. Please try again.');
  const products = await res.json();
  const findProduct = (re, id) => products.find((p) => Number(p.id) === id) || products.find((p) => re.test(String(p.name || '')));
  const bottle = findProduct(/bottle/i, 11);
  const mist = findProduct(/(mist|spray)/i, 12);
  const pickVariant = (product, label) => {
    const variants = ((product && product.variants) || []).filter((v) => Number(v.isActive ?? 1) === 1 && !v.deletedAt);
    const wanted = String(label || '').toLowerCase();
    return variants.find((v) => wanted && String(v.color || '').toLowerCase() === wanted && wanted.length) || variants[0] || null;
  };
  const merged = new Map();
  const add = (product, label, qty) => {
    const variant = pickVariant(product, label);
    if (!variant) throw new Error('This product is currently unavailable.');
    merged.set(variant.id, (merged.get(variant.id) || 0) + qty);
  };
  for (const item of cart) {
    const qty = Number(item.quantity) || 1;
    const variantName = String(item.variant || '');
    if (isPreMadeBundle(item)) {
      const [bottleColor, mistColor] = variantName.split('+').map((part) => part.replace(/bottle|mist/i, '').trim());
      add(bottle, bottleColor, qty);
      add(mist, mistColor, qty);
    } else if (isStandaloneBottle(item)) {
      add(bottle, variantName, qty);
    } else if (isStandaloneMist(item)) {
      add(mist, variantName, qty);
    } else {
      throw new Error(`${item.name} is not available for online checkout yet.`);
    }
  }
  return Array.from(merged, ([variantId, quantity]) => ({ variantId, quantity }));
}

/**
 * Launch Razorpay Standard Checkout for the Dedicated Checkout Page
 */
async function startRazorpayCheckout(customer, submitBtn, errorMsg) {
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Connecting to Razorpay...</span>';
  }

  try {
    const enrichedCustomer = {
      ...customer,
      userId: currentAuthUser ? currentAuthUser.id : null,
      isGuest: !currentAuthUser || Boolean(currentAuthUser.isGuest)
    };

    const checkoutItems = await buildMerchCheckoutItems(currentCart);
    const orderRes = await fetch('/api/merch/checkout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: checkoutItems,
        landingPage: 'ryan',
        customer: { name: customer.name, email: customer.email, phone: customer.phone },
        address: {
          recipientName: customer.name,
          phone: customer.phone,
          line1: customer.address,
          line2: customer.apartment || '',
          city: customer.city,
          postalCode: customer.pincode,
          country: 'India'
        }
      })
    });

    const orderData = await orderRes.json().catch(() => ({}));
    if (!orderRes.ok || !orderData.razorpayOrderId) {
      throw new Error(orderData.error || orderData.message || 'Failed to initialize payment.');
    }
    const payableRupees = Number(orderData.originalInrAmount || orderData.amount || 0) / 100;
    orderData.payableRupees = payableRupees;

    if (typeof Razorpay === 'undefined') {
      throw new Error('Razorpay SDK is loading. Please check your internet connection.');
    }

    const rzp = new Razorpay({
      key: orderData.razorpayKeyId,
      amount: orderData.amount,
      currency: orderData.currency || 'INR',
      name: 'H2 House of Health',
      description: 'Ryan Fernando × H2 Order',
      order_id: orderData.razorpayOrderId,
      prefill: {
        name: customer.name,
        email: customer.email,
        contact: customer.phone,
      },
      notes: {
        delivery_address: `${customer.address}, ${customer.city} - ${customer.pincode}`,
      },
      theme: {
        color: '#AE5431',
      },
      handler: async function (response) {
        if (submitBtn) submitBtn.innerHTML = '<span>Verifying payment...</span>';

        try {
          const verifyRes = await fetch('/api/merch/verify-payment', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_number: orderData.orderNumber
            })
          });

          const verifyData = await verifyRes.json().catch(() => ({}));
          if (verifyRes.ok) {
            currentCart = [];
            saveCart(currentCart);
            showBookingConfirmation({
              paymentId: response.razorpay_payment_id,
              orderId: orderData.orderNumber || response.razorpay_order_id,
              amount: orderData.payableRupees,
              customer
            });
          } else {
            alert('Payment verification error: ' + (verifyData.error || verifyData.message || 'Please contact H2 support.'));
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `<span>Proceed to Pay (₹${formatRs(orderData.payableRupees)})</span>`;
            }
          }
        } catch (err) {
          console.error('[Payment Verification Error]:', err);
          alert('Network error verifying payment. Please contact H2 support with payment ID: ' + response.razorpay_payment_id);
        }
      },
      modal: {
        ondismiss: function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>CONTINUE TO PAYMENT (₹${formatRs(orderData.payableRupees)})</span>`;
          }
        }
      }
    });

    rzp.on('payment.failed', function (resp) {
      console.error('[Razorpay Payment Failed]:', resp.error);
      if (errorMsg) {
        errorMsg.textContent = `Payment Failed: ${resp.error.description || 'Transaction cancelled or declined.'}`;
        errorMsg.hidden = false;
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Retry Payment (₹${formatRs(orderData.payableRupees)})</span>`;
      }
    });

    rzp.open();
  } catch (err) {
    console.error('[Checkout Error]:', err);
    if (errorMsg) {
      errorMsg.textContent = err.message || 'Payment service error. Please try again.';
      errorMsg.hidden = false;
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>CONTINUE TO PAYMENT</span>';
    }
  }
}

/**
 * Display Confirmed Order Page (Shown after verified Razorpay payment)
 */
function showBookingConfirmation(confirmation) {
  const mainContent = document.getElementById('mainContent');
  const checkoutPage = document.getElementById('checkoutPage');
  const bookingConfirmation = document.getElementById('bookingConfirmation');

  if (mainContent) mainContent.hidden = true;
  if (checkoutPage) checkoutPage.hidden = true;

  if (bookingConfirmation) {
    bookingConfirmation.hidden = false;
    bookingConfirmation.innerHTML = `
      <div class="booking-confirmation__inner">
        <div class="booking-success-icon" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6L9 17l-5-5"></path>
          </svg>
        </div>
        <h1>Order Confirmed!</h1>
        <p class="booking-sub">Thank you for your order, ${escapeHtml(confirmation.customer?.name || 'Valued Customer')}. Your hydrogen wellness journey begins now.</p>
        <div class="booking-order-card">
          <div class="booking-order-row">
            <span class="label">Payment ID:</span>
            <span class="val" id="confirmPaymentId">${escapeHtml(confirmation.paymentId || 'N/A')}</span>
          </div>
          <div class="booking-order-row">
            <span class="label">Order ID:</span>
            <span class="val" id="confirmOrderId">${escapeHtml(confirmation.orderId || 'N/A')}</span>
          </div>
          <div class="booking-order-row">
            <span class="label">Amount Paid:</span>
            <span class="val" id="confirmAmountPaid">₹${formatRs(Number(confirmation.amount || 0))}</span>
          </div>
          <div class="booking-order-row">
            <span class="label">Shipping Destination:</span>
            <span class="val" id="confirmShippingDestination">${escapeHtml(confirmation.customer?.address || '')}, ${escapeHtml(confirmation.customer?.city || '')} (${escapeHtml(confirmation.customer?.pincode || '')})</span>
          </div>
          <div class="booking-order-row">
            <span class="label">Payment Method:</span>
            <span class="val" id="confirmPaymentMethod" style="color:#0C2340;font-weight:800;">Razorpay Secure</span>
          </div>
        </div>
        <button type="button" class="btn btn-primary" id="confirmContinueShoppingBtn">
          Continue Shopping
        </button>
      </div>
    `;

    const continueBtn = document.getElementById('confirmContinueShoppingBtn');
    if (continueBtn) {
      continueBtn.addEventListener('click', () => {
        returnToShop();
      });
    }
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Backward compatibility helpers
function openCheckoutDeliveryModal() { showCheckoutPage(); }
function closeCheckoutDeliveryModal() { returnToShop(); }
function openOrderSuccessModal(paymentId, orderId, amount, customer) {
  showBookingConfirmation({ paymentId, orderId, amount, customer });
}
function closeOrderSuccessModal() { returnToShop(); }
function initRazorpayCheckout() {
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#checkout') {
      showCheckoutPage();
    }
  });
}

/* ==========================================================================
   SECTION 3: VARIANT SELECTORS & ADD TO CART INTEGRATION
   ========================================================================== */
/**
 * Variant Selection & Image Swapping Logic
 */
function initVariantSelectors() {
  const productCards = document.querySelectorAll('.product-card');

  productCards.forEach((card) => {
    const swatches = card.querySelectorAll('.swatch-btn');
    const mainImg = card.querySelector('.product-card-img');
    const ctaBtn = card.querySelector('.btn-card-cta');
    const stockBadge = card.querySelector('.out-of-stock-badge');
    const productKey = card.dataset.product;

    swatches.forEach((swatch) => {
      swatch.addEventListener('click', () => {
        if (swatch.classList.contains('active')) return;

        // Update active swatch state
        swatches.forEach((s) => {
          s.classList.remove('active');
          s.setAttribute('aria-checked', 'false');
        });
        swatch.classList.add('active');
        swatch.setAttribute('aria-checked', 'true');

        // Swap main product image
        const newImgSrc = swatch.dataset.img;
        const newAlt = swatch.dataset.alt;
        if (mainImg && newImgSrc) {
          mainImg.style.opacity = '0.3';
          mainImg.style.transform = 'scale(0.97)';
          setTimeout(() => {
            mainImg.src = newImgSrc;
            if (newAlt) mainImg.alt = newAlt;
            mainImg.style.opacity = '1';
            mainImg.style.transform = 'scale(1)';
          }, 120);
        }

        // Check stock state
        const inStock = swatch.dataset.inStock === 'true';

        if (ctaBtn) {
          const ctaText = ctaBtn.querySelector('.cta-text');
          const ctaArrow = ctaBtn.querySelector('.cta-arrow');

          if (inStock) {
            ctaBtn.disabled = false;
            ctaBtn.removeAttribute('aria-disabled');
            ctaBtn.classList.remove('btn-sold-out');
            if (ctaText) ctaText.textContent = 'Add to Cart';
            if (ctaArrow) ctaArrow.style.display = 'inline';
            if (stockBadge) stockBadge.style.display = 'none';
          } else {
            ctaBtn.disabled = true;
            ctaBtn.setAttribute('aria-disabled', 'true');
            ctaBtn.classList.add('btn-sold-out');
            if (ctaText) ctaText.textContent = 'Out of Stock';
            if (ctaArrow) ctaArrow.style.display = 'none';
            if (stockBadge) stockBadge.style.display = 'inline-block';
          }
        }

        // Sync with In-Card Product Feature Gallery
        const selectedVariant = swatch.dataset.variant;
        if (productKey && selectedVariant) {
          updateCardFeatures(productKey, selectedVariant);
        }
      });
    });
  });
}

/**
 * Add to Cart Button Feedback & Cart Integration
 */
function initAddToCartActions() {
  const bottleBtn = document.getElementById('bottleAddToCartBtn');
  const mistBtn = document.getElementById('mistAddToCartBtn');

  if (bottleBtn) {
    bottleBtn.addEventListener('click', () => {
      if (bottleBtn.disabled) return;
      const bottleCard = document.querySelector('[data-product="bottle"]');
      const activeSwatch = bottleCard ? bottleCard.querySelector('.swatch-btn.active') : null;
      const variant = activeSwatch ? activeSwatch.dataset.variant : 'Silver';
      const img = activeSwatch ? activeSwatch.dataset.img : 'assets/products/card-bottle-silver.jpg';

      provideBtnFeedback(bottleBtn);
      addToCart({
        id: `bottle-${variant}`,
        productId: 'bottle',
        name: 'H2 Molecular Hydrogen Water Bottle',
        variant: variant,
        price: H2_CATALOGUE[0].price,
        quantity: 1,
        image: img
      });
    });
  }

  if (mistBtn) {
    mistBtn.addEventListener('click', () => {
      if (mistBtn.disabled) return;
      const mistCard = document.querySelector('[data-product="mist"]');
      const activeSwatch = mistCard ? mistCard.querySelector('.swatch-btn.active') : null;
      const variant = activeSwatch ? activeSwatch.dataset.variant : 'White';
      const img = activeSwatch ? activeSwatch.dataset.img : 'assets/products/card-mist-white.jpg';

      provideBtnFeedback(mistBtn);
      addToCart({
        id: `mist-${variant}`,
        productId: 'mist',
        name: 'H2 Hydrogen Mist Spray',
        variant: variant,
        price: H2_CATALOGUE[1].price,
        quantity: 1,
        image: img
      });
    });
  }
}

function provideBtnFeedback(btn) {
  const ctaText = btn.querySelector('.cta-text');
  const ctaArrow = btn.querySelector('.cta-arrow');
  const originalText = ctaText ? ctaText.textContent : 'Add to Cart';

  if (ctaText) ctaText.textContent = 'Added ✓';
  if (ctaArrow) ctaArrow.style.display = 'none';
  btn.style.backgroundColor = 'var(--h2-terracotta-hover)';

  setTimeout(() => {
    if (!btn.disabled && ctaText) {
      ctaText.textContent = originalText;
      if (ctaArrow) ctaArrow.style.display = 'inline';
      btn.style.backgroundColor = '';
    }
  }, 1400);
}

/* ==========================================================================
   IN-CARD PRODUCT FEATURES & ZOOM-IN LIGHTBOX LOGIC
   ========================================================================== */

/**
 * Complete Feature Assets Mapping by Product and Variant
 */
const FEATURE_DATA = {
  bottle: {
    name: 'Molecular Hydrogen Water Bottle',
    price: '₹22,990',
    variants: {
      Silver: [
        {
          src: 'assets/features/h2-bottle-product-features-top.png',
          title: 'Leak-Proof Cap',
          caption: 'Precision-engineered leak-proof seal maintains optimal molecular hydrogen pressure.',
        },
        {
          src: 'assets/features/h2-bottle-product-features-bottom.png',
          title: 'Stainless Steel Interior',
          caption: 'Food-grade stainless steel interior and platinum-coated SPE/PEM electrolysis core.',
        },
        {
          src: 'assets/features/h2-bottle-product-features-frontwithbag.png',
          title: 'Lightweight & Portable',
          caption: 'Ergonomically designed for travel, workouts, and effortless daily hydration.',
        },
        {
          src: 'assets/features/h2-bottle-product-features-front.png',
          title: 'Ergonomic Body & Finish',
          caption: 'High borosilicate glass cylinder with refined tactile grip and balanced weight distribution.',
        },
      ],
      Black: [
        {
          src: 'assets/features/bottle-black-cap.png',
          title: 'Leak-Proof Cap',
          caption: 'Airtight matte black cap engineered for maximum pressure retention and zero leakage.',
        },
        {
          src: 'assets/features/bottle-black-interior.png',
          title: 'Stainless Steel Interior',
          caption: 'Electropolished stainless steel base with advanced dual-chamber SPE membrane.',
        },
        {
          src: 'assets/features/bottle-black-portable.png',
          title: 'Lightweight & Portable',
          caption: 'Understated matte finish built to withstand demanding daily gym and office routines.',
        },
      ],
      Gold: [
        {
          src: 'assets/features/bottle-gold-cap.png',
          title: 'Leak-Proof Cap',
          caption: 'Brushed gold metallic finish with hermetic silicone gasket to lock in hydrogen molecules.',
        },
        {
          src: 'assets/features/bottle-gold-interior.png',
          title: 'Stainless Steel Interior',
          caption: 'Premium stainless steel chamber with high-efficiency electrolysis electrode array.',
        },
        {
          src: 'assets/features/bottle-gold-portable.png',
          title: 'Lightweight & Portable',
          caption: 'Refined warm metallic aesthetic designed for effortless portability wherever you go.',
        },
      ],
      Blue: [
        {
          src: 'assets/features/bottle-blue-cap.png',
          title: 'Leak-Proof Cap',
          caption: 'Anodized cobalt blue finish with precision thread lock to retain high saturation.',
        },
        {
          src: 'assets/features/bottle-blue-interior.png',
          title: 'Stainless Steel Interior',
          caption: 'Bio-inert medical grade interior and ultra-pure platinum-plated titanium core.',
        },
        {
          src: 'assets/features/bottle-blue-portable.png',
          title: 'Lightweight & Portable',
          caption: 'Vibrant blue accents crafted for travel, outdoor fitness, and everyday carry.',
        },
      ],
    },
  },
  mist: {
    name: 'Hydrogen Mist Spray',
    price: '₹11,990',
    variants: {
      White: [
        {
          src: 'assets/features/h2-mist-product-features-top.png',
          title: 'Large 15ml Water Tank',
          caption: 'High-capacity transparent 15ml reservoir delivers sustained hydration throughout the day.',
        },
        {
          src: 'assets/features/h2-mist-product-features-chargeport.png',
          title: 'Portable & Rechargeable',
          caption: 'Convenient USB Type-C charging port with long-lasting battery life on a single charge.',
        },
        {
          src: 'assets/features/h2-mist-product-features-side.png',
          title: 'Ultrasonic Mist Diffusion',
          caption: 'High-frequency ultrasonic atomization creates nano-sized mist for immediate skin absorption.',
        },
        {
          src: 'assets/features/h2-mist-product-features-front.png',
          title: 'Ergonomic Handheld Spray',
          caption: 'Gentle, soothing molecular hydrogen spray designed for facial soothing and anti-aging refresh.',
        },
      ],
      Black: [
        {
          src: 'assets/features/h2-mist-product-features-top.png',
          title: 'Large 15ml Water Tank',
          caption: 'High-capacity transparent 15ml reservoir delivers sustained hydration throughout the day.',
        },
        {
          src: 'assets/features/h2-mist-product-features-side-black-connected-cable.png',
          title: 'Portable & Rechargeable',
          caption: 'Seamless USB charging interface engineered for gym bags, desks, and rapid pocket recharges.',
        },
        {
          src: 'assets/features/h2-mist-product-features-front-black.png',
          title: 'Ultrasonic Mist Diffusion',
          caption: 'Matte black handheld profile generating micro-fine hydrogen particles for deeper dermal penetration.',
        },
      ],
    },
  },
  hoodie: {
    name: 'H2 Hoodie',
    price: '₹3,499',
    variants: {
      Terracotta: [
        {
          src: 'assets/features/hoodie-feature-cotton.png',
          title: 'Premium Organic Cotton',
          caption: 'Heavyweight 450 GSM organic cotton blend designed for lasting comfort, softness, and durability.',
        },
        {
          src: 'assets/features/hoodie-feature-print.png',
          title: 'High-Quality Durable Print',
          caption: 'High-density precision screen print with tactile gold-tone lettering: H2 GOT HYDROGEN?',
        },
        {
          src: 'assets/features/hoodie-feature-hood.png',
          title: 'Comfortable Hood & Fit',
          caption: 'Double-layered structured hood with matched drawstrings and relaxed comfortable neckline.',
        },
        {
          src: 'assets/features/hoodie-feature-fabric.png',
          title: 'Soft & Breathable Fabric',
          caption: 'Ultra-soft brushed fleece interior and breathable dense knit in earthy terracotta tone.',
        },
      ],
    },
  },
};

// Current active variants per product
const activeVariants = {
  bottle: 'Silver',
  mist: 'White',
  hoodie: 'Terracotta',
};

// Lightbox state
const lightboxState = {
  productKey: 'bottle',
  variant: 'Silver',
  items: [],
  currentIndex: 0,
  triggerElement: null,
};

/**
 * Initializes all in-card feature galleries
 */
function initFeatureGalleries() {
  renderCardFeatures('bottle', activeVariants.bottle);
  renderCardFeatures('mist', activeVariants.mist);
  renderCardFeatures('hoodie', activeVariants.hoodie);
}

/**
 * Renders the compact 4-column thumbnails grid inside a product card
 */
function renderCardFeatures(productKey, variant) {
  const grid = document.getElementById(`${productKey}CardFeaturesGrid`);
  if (!grid) return;

  const productData = FEATURE_DATA[productKey];
  if (!productData) return;

  const items = productData.variants[variant] || [];
  grid.innerHTML = '';

  items.forEach((item, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-feature-item';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute('aria-label', `Zoom in on ${item.title}`);
    btn.dataset.product = productKey;
    btn.dataset.variant = variant;
    btn.dataset.index = String(index);

    btn.innerHTML = `
      <span class="card-feature-thumb-box">
        <img
          src="${item.src}"
          alt="${item.title}"
          class="card-feature-thumb-img"
          loading="eager"
        />
        <span class="card-feature-zoom-badge" aria-hidden="true">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="11" y1="8" x2="11" y2="14"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </span>
      </span>
      <span class="card-feature-caption">${item.title}</span>
    `;

    btn.addEventListener('click', () => {
      openLightbox(productKey, variant, index, btn);
    });

    grid.appendChild(btn);
  });
}

/**
 * Updates an in-card feature gallery when a variant swatch is chosen
 */
function updateCardFeatures(productKey, variant) {
  if (!FEATURE_DATA[productKey]) return;
  activeVariants[productKey] = variant;

  const grid = document.getElementById(`${productKey}CardFeaturesGrid`);
  if (grid) {
    grid.style.opacity = '0.35';
    grid.style.transform = 'translateY(2px)';
    setTimeout(() => {
      renderCardFeatures(productKey, variant);
      grid.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      grid.style.opacity = '1';
      grid.style.transform = 'translateY(0)';
    }, 100);
  } else {
    renderCardFeatures(productKey, variant);
  }
}

/**
 * Lightbox Modal Controls & Keyboard Accessibility
 */
function initFeatureLightbox() {
  const lightbox = document.getElementById('featureLightbox');
  const backdrop = document.getElementById('lightboxBackdrop');
  const closeBtn = document.getElementById('lightboxCloseBtn');
  const prevBtn = document.getElementById('lightboxPrevBtn');
  const nextBtn = document.getElementById('lightboxNextBtn');

  if (!lightbox) return;

  const closeHandler = () => closeLightbox();
  if (closeBtn) closeBtn.addEventListener('click', closeHandler);
  if (backdrop) backdrop.addEventListener('click', closeHandler);

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (lightboxState.currentIndex > 0) {
        lightboxState.currentIndex--;
        updateLightboxView();
      }
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (lightboxState.currentIndex < lightboxState.items.length - 1) {
        lightboxState.currentIndex++;
        updateLightboxView();
      }
    });
  }

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (lightboxState.currentIndex > 0) {
        lightboxState.currentIndex--;
        updateLightboxView();
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (lightboxState.currentIndex < lightboxState.items.length - 1) {
        lightboxState.currentIndex++;
        updateLightboxView();
      }
    }
  });
}

/**
 * Opens Lightbox for specific product, variant and item index
 */
function openLightbox(productKey, variant, index, triggerEl) {
  const lightbox = document.getElementById('featureLightbox');
  if (!lightbox) return;

  const productData = FEATURE_DATA[productKey];
  if (!productData) return;

  const items = productData.variants[variant] || [];
  if (!items.length) return;

  lightboxState.productKey = productKey;
  lightboxState.variant = variant;
  lightboxState.items = items;
  lightboxState.currentIndex = index;
  lightboxState.triggerElement = triggerEl || null;

  updateLightboxView();

  lightbox.removeAttribute('hidden');
  // Trigger transition
  requestAnimationFrame(() => {
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const closeBtn = document.getElementById('lightboxCloseBtn');
    if (closeBtn) closeBtn.focus();
  });
}

/**
 * Updates Lightbox content and navigation state
 */
function updateLightboxView() {
  const { productKey, variant, items, currentIndex } = lightboxState;
  const currentItem = items[currentIndex];
  if (!currentItem) return;

  const productData = FEATURE_DATA[productKey];

  const productTitleEl = document.getElementById('lightboxProductTitle');
  const featureTitleEl = document.getElementById('lightboxFeatureTitle');
  const counterEl = document.getElementById('lightboxCounter');
  const imgEl = document.getElementById('lightboxImg');
  const captionEl = document.getElementById('lightboxCaption');
  const prevBtn = document.getElementById('lightboxPrevBtn');
  const nextBtn = document.getElementById('lightboxNextBtn');

  if (productTitleEl) {
    productTitleEl.textContent = `${productData.name} · ${variant} Edition`;
  }
  if (featureTitleEl) {
    featureTitleEl.textContent = currentItem.title;
  }
  if (counterEl) {
    counterEl.textContent = `${currentIndex + 1} / ${items.length}`;
  }
  if (captionEl) {
    captionEl.textContent = currentItem.caption || '';
  }

  if (imgEl) {
    imgEl.style.opacity = '0.4';
    imgEl.src = currentItem.src;
    imgEl.alt = `${currentItem.title} - ${productData.name} (${variant})`;
    imgEl.onload = () => {
      imgEl.style.opacity = '1';
    };
  }

  // Update nav button states
  if (prevBtn) {
    prevBtn.disabled = currentIndex <= 0;
    prevBtn.style.visibility = items.length > 1 ? 'visible' : 'hidden';
  }
  if (nextBtn) {
    nextBtn.disabled = currentIndex >= items.length - 1;
    nextBtn.style.visibility = items.length > 1 ? 'visible' : 'hidden';
  }
}

/**
 * Closes Lightbox and restores focus
 */
function closeLightbox() {
  const lightbox = document.getElementById('featureLightbox');
  if (!lightbox) return;

  lightbox.classList.remove('is-open');
  document.body.style.overflow = '';

  setTimeout(() => {
    lightbox.setAttribute('hidden', '');
    if (lightboxState.triggerElement && typeof lightboxState.triggerElement.focus === 'function') {
      lightboxState.triggerElement.focus();
    }
  }, 220);
}

/* ==============================================================================
   H2 CUSTOMER AUTHENTICATION, SESSIONS, GUEST & ORDER HISTORY MODULE
   ============================================================================== */
let currentAuthUser = null;
let currentAuthToken = localStorage.getItem('h2_auth_token') || null;

async function initAuthSystem() {
  // Check for Google OAuth callback token in URL hash
  if (window.location.hash && window.location.hash.includes('auth_token=')) {
    try {
      const hashContent = window.location.hash.startsWith('#') ? window.location.hash.substring(1) : window.location.hash;
      const params = new URLSearchParams(hashContent);
      const token = params.get('auth_token');
      const userName = params.get('user_name');
      if (token) {
        currentAuthToken = token;
        localStorage.setItem('h2_auth_token', token);
        // Clean URL hash without page reload
        history.replaceState(null, '', window.location.pathname + window.location.search);
        showAuthToast(`Welcome, ${userName || 'Customer'}!`);
      }
    } catch (e) {
      console.warn('[Auth] Error parsing hash auth token:', e);
    }
  }

  // Bind Header Account Button & Dropdown
  const headerAccountBtn = document.getElementById('headerAccountBtn');
  const accountDropdownMenu = document.getElementById('accountDropdownMenu');
  const accountSignOutBtn = document.getElementById('accountSignOutBtn');
  const accountViewOrdersBtn = document.getElementById('accountViewOrdersBtn');

  if (headerAccountBtn) {
    headerAccountBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentAuthUser && !currentAuthUser.isGuest) {
        if (accountDropdownMenu) {
          accountDropdownMenu.hidden = !accountDropdownMenu.hidden;
        }
      } else {
        openAuthModal('signin');
      }
    });
  }

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (accountDropdownMenu && !accountDropdownMenu.hidden) {
      if (!e.target.closest('#userAccountWrapper')) {
        accountDropdownMenu.hidden = true;
      }
    }
  });

  if (accountSignOutBtn) {
    accountSignOutBtn.addEventListener('click', () => {
      handleSignOut();
    });
  }

  if (accountViewOrdersBtn) {
    accountViewOrdersBtn.addEventListener('click', () => {
      if (accountDropdownMenu) accountDropdownMenu.hidden = true;
      openMyOrdersModal();
    });
  }

  // Bind Auth Modal controls
  const authModalCloseBtn = document.getElementById('authModalCloseBtn');
  const authModalBackdrop = document.getElementById('authModalBackdrop');
  if (authModalCloseBtn) authModalCloseBtn.addEventListener('click', closeAuthModal);
  if (authModalBackdrop) authModalBackdrop.addEventListener('click', closeAuthModal);

  // Tabs
  const tabs = document.querySelectorAll('.h2-auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchAuthTab(tab.dataset.tab);
    });
  });

  // OTP Sign-In Flow (Email Verification via AWS SES)
  const authSendOtpForm = document.getElementById('authSendOtpForm');
  const authVerifyOtpForm = document.getElementById('authVerifyOtpForm');
  const otpEmailInput = document.getElementById('otpEmailInput');
  const otpCodeInput = document.getElementById('otpCodeInput');
  const otpFlowStep1 = document.getElementById('otpFlowStep1');
  const otpFlowStep2 = document.getElementById('otpFlowStep2');
  const otpSentEmailTarget = document.getElementById('otpSentEmailTarget');
  const otpChangeEmailBtn = document.getElementById('otpChangeEmailBtn');
  const btnResendOtp = document.getElementById('btnResendOtp');
  const otpCountdownTimer = document.getElementById('otpCountdownTimer');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');

  let otpResendInterval = null;

  function startOtpCountdown(seconds = 30) {
    if (otpResendInterval) clearInterval(otpResendInterval);
    if (btnResendOtp) {
      btnResendOtp.disabled = true;
      btnResendOtp.style.opacity = '0.5';
      btnResendOtp.style.pointerEvents = 'none';
    }
    let remaining = seconds;
    if (otpCountdownTimer) otpCountdownTimer.textContent = `(${remaining}s)`;

    otpResendInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(otpResendInterval);
        otpResendInterval = null;
        if (otpCountdownTimer) otpCountdownTimer.textContent = '';
        if (btnResendOtp) {
          btnResendOtp.disabled = false;
          btnResendOtp.style.opacity = '1';
          btnResendOtp.style.pointerEvents = 'auto';
        }
      } else {
        if (otpCountdownTimer) otpCountdownTimer.textContent = `(${remaining}s)`;
      }
    }, 1000);
  }

  async function triggerSendOtp(email) {
    hideAuthModalAlert();
    if (btnSendOtp) {
      btnSendOtp.disabled = true;
      btnSendOtp.textContent = 'Sending code...';
    }
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.ok) {
        if (otpFlowStep1) otpFlowStep1.hidden = true;
        if (otpFlowStep2) otpFlowStep2.hidden = false;
        if (otpSentEmailTarget) otpSentEmailTarget.textContent = email;
        if (otpCodeInput) {
          otpCodeInput.value = '';
          otpCodeInput.focus();
        }
        startOtpCountdown(30);
        showAuthModalAlert(`Verification code sent to ${email}`, 'success');
      } else {
        showAuthModalAlert(data.message || 'Failed to send verification code. Please try again.', 'error');
      }
    } catch (err) {
      showAuthModalAlert('Unable to reach server. Please try again.', 'error');
    } finally {
      if (btnSendOtp) {
        btnSendOtp.disabled = false;
        btnSendOtp.textContent = 'Send Verification Code';
      }
    }
  }

  if (authSendOtpForm) {
    authSendOtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = otpEmailInput ? otpEmailInput.value.trim() : '';
      if (!email) return;
      await triggerSendOtp(email);
    });
  }

  if (otpChangeEmailBtn) {
    otpChangeEmailBtn.addEventListener('click', () => {
      if (otpResendInterval) clearInterval(otpResendInterval);
      if (otpFlowStep2) otpFlowStep2.hidden = true;
      if (otpFlowStep1) otpFlowStep1.hidden = false;
      hideAuthModalAlert();
      if (otpEmailInput) otpEmailInput.focus();
    });
  }

  if (btnResendOtp) {
    btnResendOtp.addEventListener('click', async () => {
      const email = otpEmailInput ? otpEmailInput.value.trim() : '';
      if (!email) return;
      await triggerSendOtp(email);
    });
  }

  if (authVerifyOtpForm) {
    authVerifyOtpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = otpEmailInput ? otpEmailInput.value.trim() : '';
      const otp = otpCodeInput ? otpCodeInput.value.trim() : '';
      if (!email || !otp) return;

      if (otp.length !== 6) {
        showAuthModalAlert('Please enter the full 6-digit code.', 'error');
        return;
      }

      if (btnVerifyOtp) {
        btnVerifyOtp.disabled = true;
        btnVerifyOtp.textContent = 'Verifying...';
      }

      try {
        const res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          currentAuthToken = data.token;
          currentAuthUser = data.user;
          localStorage.setItem('h2_auth_token', data.token);
          updateAuthHeaderUI();
          closeAuthModal();
          showAuthToast(`Signed in as ${data.user.name || data.user.email}`);
          const checkoutPage = document.getElementById('checkoutPage');
          if (checkoutPage && !checkoutPage.hidden) {
            renderCheckoutPage();
          }
        } else {
          showAuthModalAlert(data.message || 'Invalid or expired code.', 'error');
        }
      } catch (err) {
        showAuthModalAlert('Verification failed. Please try again.', 'error');
      } finally {
        if (btnVerifyOtp) {
          btnVerifyOtp.disabled = false;
          btnVerifyOtp.textContent = 'Verify & Sign In';
        }
      }
    });
  }

  // Sign In Form (Password Fallback)
  const signInForm = document.getElementById('authSignInForm');
  if (signInForm) {
    signInForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identity = document.getElementById('signInIdentity')?.value.trim();
      const password = document.getElementById('signInPassword')?.value.trim();
      const submitBtn = document.getElementById('btnSignInSubmit');

      if (!identity || !password) return;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Signing in...'; }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, password })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          currentAuthToken = data.token;
          currentAuthUser = data.user;
          localStorage.setItem('h2_auth_token', data.token);
          updateAuthHeaderUI();
          closeAuthModal();
          showAuthToast(`Signed in as ${data.user.name}`);
          // If checkout is open, re-render to autofill
          const checkoutPage = document.getElementById('checkoutPage');
          if (checkoutPage && !checkoutPage.hidden) {
            renderCheckoutPage();
          }
        } else {
          showAuthModalAlert(data.message || 'Invalid email or password.', 'error');
        }
      } catch (err) {
        showAuthModalAlert('Unable to connect to server. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Sign In'; }
      }
    });
  }

  // Sign Up Form
  const signUpForm = document.getElementById('authSignUpForm');
  if (signUpForm) {
    signUpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('signUpName')?.value.trim();
      const email = document.getElementById('signUpEmail')?.value.trim();
      const phone = document.getElementById('signUpPhone')?.value.trim();
      const password = document.getElementById('signUpPassword')?.value.trim();
      const submitBtn = document.getElementById('btnSignUpSubmit');

      if (!name || !email || !password) return;
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Creating account...'; }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          currentAuthToken = data.token;
          currentAuthUser = data.user;
          localStorage.setItem('h2_auth_token', data.token);
          updateAuthHeaderUI();
          closeAuthModal();
          showAuthToast(`Account created! Welcome, ${data.user.name}!`);
          const checkoutPage = document.getElementById('checkoutPage');
          if (checkoutPage && !checkoutPage.hidden) {
            renderCheckoutPage();
          }
        } else {
          showAuthModalAlert(data.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showAuthModalAlert('Unable to connect to server. Please try again.', 'error');
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Account'; }
      }
    });
  }

  // Guest Continue
  const btnGuestContinue = document.getElementById('btnGuestContinue');
  if (btnGuestContinue) {
    btnGuestContinue.addEventListener('click', async () => {
      const guestName = document.getElementById('guestName')?.value.trim();
      const guestEmail = document.getElementById('guestEmail')?.value.trim();
      btnGuestContinue.disabled = true;
      btnGuestContinue.textContent = 'Initializing guest checkout...';

      try {
        const res = await fetch('/api/auth/guest-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: guestName, email: guestEmail })
        });
        const data = await res.json();
        if (data.ok && data.token) {
          currentAuthToken = data.token;
          currentAuthUser = data.guestUser;
          localStorage.setItem('h2_auth_token', data.token);
          updateAuthHeaderUI();
          closeAuthModal();
          showAuthToast('Proceeding as Guest');
          const checkoutPage = document.getElementById('checkoutPage');
          if (checkoutPage && !checkoutPage.hidden) {
            renderCheckoutPage();
          }
        }
      } catch (err) {
        closeAuthModal();
      } finally {
        btnGuestContinue.disabled = false;
        btnGuestContinue.textContent = 'Continue as Guest';
      }
    });
  }

  // My Orders Modal controls
  const myOrdersCloseBtn = document.getElementById('myOrdersCloseBtn');
  const myOrdersBackdrop = document.getElementById('myOrdersBackdrop');
  if (myOrdersCloseBtn) myOrdersCloseBtn.addEventListener('click', closeMyOrdersModal);
  if (myOrdersBackdrop) myOrdersBackdrop.addEventListener('click', closeMyOrdersModal);

  // If we already have a saved token, verify it
  if (currentAuthToken) {
    await fetchAuthUser();
  } else {
    updateAuthHeaderUI();
  }
}

async function fetchAuthUser() {
  if (!currentAuthToken) return;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${currentAuthToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && data.user) {
        currentAuthUser = data.user;
        updateAuthHeaderUI();
        return;
      }
    }
  } catch (err) {}
  updateAuthHeaderUI();
}

function updateAuthHeaderUI() {
  const headerAccountBtn = document.getElementById('headerAccountBtn');
  const dropdownUserName = document.getElementById('dropdownUserName');
  const dropdownUserEmail = document.getElementById('dropdownUserEmail');
  const accountDropdownMenu = document.getElementById('accountDropdownMenu');

  if (currentAuthUser && !currentAuthUser.isGuest) {
    if (headerAccountBtn) {
      headerAccountBtn.classList.add('is-signed-in');
      const tooltip = currentAuthUser.name ? `Account (${currentAuthUser.name})` : 'Account';
      headerAccountBtn.setAttribute('title', tooltip);
      headerAccountBtn.setAttribute('aria-label', tooltip);
    }
    if (dropdownUserName) dropdownUserName.textContent = currentAuthUser.name || 'H2 Customer';
    if (dropdownUserEmail) dropdownUserEmail.textContent = currentAuthUser.email || '';
  } else if (currentAuthUser && currentAuthUser.isGuest) {
    if (headerAccountBtn) {
      headerAccountBtn.classList.add('is-signed-in');
      headerAccountBtn.setAttribute('title', 'Guest Account');
      headerAccountBtn.setAttribute('aria-label', 'Guest Account');
    }
    if (dropdownUserName) dropdownUserName.textContent = currentAuthUser.name || 'Guest Customer';
    if (dropdownUserEmail) dropdownUserEmail.textContent = 'Guest Checkout Mode';
  } else {
    if (headerAccountBtn) {
      headerAccountBtn.classList.remove('is-signed-in');
      headerAccountBtn.setAttribute('title', 'Account / Sign In');
      headerAccountBtn.setAttribute('aria-label', 'Account / Sign In');
    }
    if (accountDropdownMenu) accountDropdownMenu.hidden = true;
  }
}

function openAuthModal(defaultTab = 'signin') {
  const modal = document.getElementById('authModal');
  const backdrop = document.getElementById('authModalBackdrop');
  if (!modal || !backdrop) return;
  modal.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  switchAuthTab(defaultTab);
  hideAuthModalAlert();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  const backdrop = document.getElementById('authModalBackdrop');
  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = '';
}

function switchAuthTab(tabName) {
  const tabs = document.querySelectorAll('.h2-auth-tab');
  tabs.forEach(t => {
    const isActive = t.dataset.tab === tabName;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const paneSignIn = document.getElementById('paneSignIn');
  const paneSignUp = document.getElementById('paneSignUp');
  const paneGuest = document.getElementById('paneGuest');

  if (paneSignIn) paneSignIn.hidden = (tabName !== 'signin');
  if (paneSignUp) paneSignUp.hidden = (tabName !== 'signup');
  if (paneGuest) paneGuest.hidden = (tabName !== 'guest');
  hideAuthModalAlert();
}

function showAuthModalAlert(msg, type = 'error') {
  const alertEl = document.getElementById('authModalAlert');
  if (!alertEl) return;
  alertEl.textContent = msg;
  alertEl.className = `h2-auth-alert ${type}`;
  alertEl.hidden = false;
}

function hideAuthModalAlert() {
  const alertEl = document.getElementById('authModalAlert');
  if (alertEl) alertEl.hidden = true;
}

function handleSignOut() {
  localStorage.removeItem('h2_auth_token');
  currentAuthToken = null;
  currentAuthUser = null;
  updateAuthHeaderUI();
  showAuthToast('You have been signed out.');
  const checkoutPage = document.getElementById('checkoutPage');
  if (checkoutPage && !checkoutPage.hidden) {
    renderCheckoutPage();
  }
}

async function openMyOrdersModal() {
  const modal = document.getElementById('myOrdersModal');
  const backdrop = document.getElementById('myOrdersBackdrop');
  const listEl = document.getElementById('myOrdersList');
  if (!modal || !backdrop || !listEl) return;

  modal.hidden = false;
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  listEl.innerHTML = '<div class="h2-orders-loading">Loading your order history...</div>';

  try {
    const res = await fetch('/api/orders/my-orders', {
      headers: { 'Authorization': `Bearer ${currentAuthToken}` }
    });
    const data = await res.json();
    if (data.ok && Array.isArray(data.orders) && data.orders.length > 0) {
      listEl.innerHTML = data.orders.map(order => {
        const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent';
        const itemsSummary = (order.items || []).map(i => `${i.quantity || 1}× ${escapeHtml(i.name)}`).join(', ');
        const total = order.pricing?.payable || order.amount || 0;
        return `
          <div class="h2-order-card">
            <div class="h2-order-head">
              <div>
                <div class="h2-order-id">Order #${order.orderId || order.receipt}</div>
                <div class="h2-order-date">Placed on ${dateStr}</div>
              </div>
              <span class="h2-order-status-badge paid">Paid &amp; Confirmed</span>
            </div>
            <div class="h2-order-items">
              <strong>Items:</strong> ${itemsSummary || 'Hydrogen Wellness Pack'}
            </div>
            <div class="h2-order-total">
              <span>Paid Amount:</span>
              <span>₹${formatRs(total)}</span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = `
        <div class="h2-orders-empty">
          <p>No past orders found under your account.</p>
          <a href="#collection" class="btn btn-ryans-collection" style="margin-top:10px;display:inline-block;" onclick="closeMyOrdersModal()">Shop Ryan's Collection</a>
        </div>
      `;
    }
  } catch (err) {
    listEl.innerHTML = '<div class="h2-orders-empty">Unable to fetch orders. Please sign in again.</div>';
  }
}

function closeMyOrdersModal() {
  const modal = document.getElementById('myOrdersModal');
  const backdrop = document.getElementById('myOrdersBackdrop');
  if (modal) modal.hidden = true;
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = '';
}

function showAuthToast(msg) {
  let toast = document.getElementById('h2AuthToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'h2AuthToast';
    toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#243038;color:#FFFFFF;padding:12px 20px;border-radius:10px;font-size:13.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.2);z-index:9999;transition:all 0.25s ease;display:flex;align-items:center;gap:10px;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 3500);
}

