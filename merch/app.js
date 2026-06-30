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
  const AUTH_TOKEN_KEY = 'merch_auth_token';

  function buildApiUrl(path) {
    const base = API_URL || window.location.origin;
    return `${base}${path}`;
  }

  // ─── State ───
  const state = {
    products: [],
    cart: [],
    selectedCategory: 'all',
    sortBy: 'newest',
    searchQuery: '',
    currentView: 'shop', // 'shop' | 'detail'
    selectedProduct: null,
    selectedVariant: null,
    quantity: 1,
    authToken: localStorage.getItem(AUTH_TOKEN_KEY) || '',
  };

  // ─── Product Data (Static catalog until API is built) ───
  const PRODUCTS = [
    {
      id: 1,
      name: 'Zenith Hoodie – Black',
      slug: 'zenith-hoodie-black',
      description: 'Meet the hoodie that understands the assignment. Engineered from a heavyweight 450 GSM organic cotton blend, the Zenith offers a structured, premium silhouette without sacrificing that "lived-in" softness. Whether you\'re hitting the gym, the coffee shop, or the couch, this is your new uniform.',
      category: 'hoodies',
      basePrice: 349900,
      images: [
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_18271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.328271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.31_18271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.318271.jpg?v=1770377146',
      ],
      variants: [
        { id: 1, size: 'S', color: 'Black', price: 349900, stock: 25, sku: 'HM-HOD-BLK-S' },
        { id: 2, size: 'M', color: 'Black', price: 349900, stock: 30, sku: 'HM-HOD-BLK-M' },
        { id: 3, size: 'L', color: 'Black', price: 349900, stock: 20, sku: 'HM-HOD-BLK-L' },
        { id: 4, size: 'XL', color: 'Black', price: 349900, stock: 15, sku: 'HM-HOD-BLK-XL' },
        { id: 5, size: 'XXL', color: 'Black', price: 349900, stock: 10, sku: 'HM-HOD-BLK-XXL' },
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
      basePrice: 349900,
      images: [
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.30034b.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.308271.jpg?v=1770377146',
        '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.302cf7.jpg?v=1770377146',
      ],
      variants: [
        { id: 6, size: 'S', color: 'Sand', price: 349900, stock: 20, sku: 'HM-HOD-SND-S' },
        { id: 7, size: 'M', color: 'Sand', price: 349900, stock: 25, sku: 'HM-HOD-SND-M' },
        { id: 8, size: 'L', color: 'Sand', price: 349900, stock: 18, sku: 'HM-HOD-SND-L' },
        { id: 9, size: 'XL', color: 'Sand', price: 349900, stock: 12, sku: 'HM-HOD-SND-XL' },
        { id: 10, size: 'XXL', color: 'Sand', price: 349900, stock: 8, sku: 'HM-HOD-SND-XXL' },
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
      basePrice: 699900,
      images: [
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_29477.jpg?v=1770378113',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_2c1ed.jpg?v=1770378113',
      ],
      variants: [
        { id: 11, size: '300ml', color: 'Silver', price: 699900, stock: 40, sku: 'HM-BTL-300-SLV' },
        { id: 12, size: '500ml', color: 'Silver', price: 849900, stock: 35, sku: 'HM-BTL-500-SLV' },
        { id: 13, size: '300ml', color: 'Black', price: 699900, stock: 30, sku: 'HM-BTL-300-BLK' },
        { id: 14, size: '500ml', color: 'Black', price: 849900, stock: 25, sku: 'HM-BTL-500-BLK' },
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
      basePrice: 249900,
      images: [
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.3351c7.jpg?v=1770378138',
        '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33de1d.jpg?v=1770378138',
      ],
      variants: [
        { id: 15, size: '50ml', color: 'White', price: 249900, stock: 50, sku: 'HM-SPR-050-WHT' },
        { id: 16, size: '100ml', color: 'White', price: 349900, stock: 40, sku: 'HM-SPR-100-WHT' },
        { id: 17, size: '50ml', color: 'Rose Gold', price: 279900, stock: 35, sku: 'HM-SPR-050-RSG' },
        { id: 18, size: '100ml', color: 'Rose Gold', price: 379900, stock: 30, sku: 'HM-SPR-100-RSG' },
      ],
      gstRate: 18,
      weightGrams: 150,
      createdAt: '2026-04-01',
    },
  ];

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

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
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
    cartBadge: document.getElementById('cartBadge'),
    cartShopBtn: document.getElementById('cartShopBtn'),
    checkoutBtn: document.getElementById('checkoutBtn'),
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

  function addToCart(variantId, quantity, product) {
    const variant = product.variants.find(v => v.id === variantId);
    if (!variant || variant.stock <= 0) return;

    const existing = state.cart.find(item => item.variantId === variantId);
    if (existing) {
      const newQty = Math.min(existing.quantity + quantity, variant.stock);
      existing.quantity = newQty;
    } else {
      state.cart.push({
        variantId,
        productId: product.id,
        productName: product.name,
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
        price: variant.price,
        quantity: Math.min(quantity, variant.stock),
        image: product.images[0] || '',
        sku: variant.sku,
      });
    }
    saveCart();
    openCart();
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
      return;
    }

    els.cartEmpty.style.display = 'none';
    els.cartFooter.hidden = false;

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

  // ─── Render: Product Grid ───
  function getFilteredProducts() {
    let products = [...PRODUCTS];

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

    els.productGrid.innerHTML = products.map(product => `
      <article class="product-card" data-product-id="${product.id}" tabindex="0" role="button" aria-label="View ${escapeHtml(product.name)}">
        <div class="product-card__image">
          <img src="${product.images[0]}" alt="${escapeHtml(product.name)}" loading="lazy" onerror="this.src='/booking/assets/service-hydrogen-session.jpg'" />
        </div>
        <div class="product-card__body">
          <p class="product-card__category">${escapeHtml(getCategoryLabel(product.category))}</p>
          <h3 class="product-card__name">${escapeHtml(product.name)}</h3>
          <p class="product-card__price">
            ${product.variants.length > 1 ? '<span class="price-from">From </span>' : ''}${getPriceRange(product)}
          </p>
        </div>
      </article>
    `).join('');

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
    const product = PRODUCTS.find(p => p.id === productId);
    if (!product) return;

    state.currentView = 'detail';
    state.selectedProduct = product;
    state.selectedVariant = product.variants[0];
    state.quantity = 1;

    // Hide shop, show detail
    els.shopSection.hidden = true;
    document.querySelector('.merch-hero').hidden = true;
    document.querySelector('.merch-categories').hidden = true;
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
    els.shopSection.hidden = false;
    document.querySelector('.merch-hero').hidden = false;
    document.querySelector('.merch-categories').hidden = false;
  }

  function renderProductGallery(product) {
    const mainImage = product.images[0] || '/booking/assets/service-hydrogen-session.jpg';
    els.productGallery.innerHTML = `
      <div class="gallery-main">
        <img id="galleryMainImg" src="${mainImage}" alt="${escapeHtml(product.name)}" onerror="this.src='/booking/assets/service-hydrogen-session.jpg'" />
      </div>
      ${product.images.length > 1 ? `
        <div class="gallery-thumbs">
          ${product.images.map((img, i) => `
            <button class="gallery-thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}" type="button">
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
        document.getElementById('galleryMainImg').src = product.images[idx];
        els.productGallery.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
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
        <button id="addToWishlistBtn" class="btn btn-outline" type="button">♡ Wishlist</button>
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
    const results = PRODUCTS.filter(p =>
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
        <img src="${p.images[0]}" alt="" style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover;" onerror="this.src='/booking/assets/service-hydrogen-session.jpg'" />
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
  }

  // ─── Razorpay Checkout Flow ───
  async function initiateCheckout() {
    // Collect customer info
    const name = prompt('Your full name:');
    if (!name) return;
    const email = prompt('Your email:');
    if (!email) return;
    const phone = prompt('Your phone number (10 digits):');
    if (!phone) return;

    const address = prompt('Shipping address (full address with pincode):');

    const items = state.cart.map(item => ({ variantId: item.variantId, quantity: item.quantity }));
    const customer = { name, email, phone };

    try {
      const res = await fetch(buildApiUrl('/api/merch/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, customer, address: { full: address } }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Checkout failed');
        return;
      }

      const data = await res.json();

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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              order_number: data.orderNumber,
            }),
          });
          if (verifyRes.ok) {
            state.cart = [];
            saveCart();
            renderCart();
            closeCart();
            alert('Payment successful! Order ' + data.orderNumber + ' confirmed.');
          } else {
            alert('Payment verification failed. Please contact support.');
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error('Checkout error:', err);
      alert('Something went wrong. Please try again.');
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

  // ─── Initialize ───
  function init() {
    loadCart();
    renderCartBadge();
    renderProductGrid();
    bindEvents();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
