(function () {
  'use strict';

  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    products: 'Products',
    categories: 'Categories',
    orders: 'Orders',
    customers: 'Customers',
    coupons: 'Coupons',
    influencers: 'Influencers',
    reports: 'Reports',
    settings: 'Settings',
  };

  const today = new Date();

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function daysAgo(days) {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return toISODate(date);
  }

  function money(paise) {
    return '\u20B9' + Number(paise || 0).toLocaleString('en-IN');
  }

  function dateLabel(value) {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value || 'N/A');
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }

  function timeLabel(value) {
    const parsed = new Date(String(value || '').replace(' ', 'T'));
    if (Number.isNaN(parsed.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  }

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
  }

  function initials(name) {
    return String(name || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || 'AH';
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function statusClass(status) {
    return `admin-badge--${String(status || 'draft').toLowerCase().replace(/_/g, '-')}`;
  }

  function getCouponTypeValue(coupon) {
    const explicitType = String(coupon?.couponType || coupon?.coupon_type || coupon?.ownerType || '').trim().toLowerCase();
    if (explicitType === 'public' || explicitType === 'general') return 'general';
    if (explicitType === 'private' || explicitType === 'influencer') return 'influencer';
    return 'general';
  }

  function getCouponTypeLabel(coupon) {
    return getCouponTypeValue(coupon) === 'influencer' ? 'Influencer Coupon' : 'General Coupon';
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function normalizeCouponCodes(value) {
    return Array.from(
      new Set(
        String(value || '')
          .split(/[\n,]/)
          .map((item) => item.trim().toUpperCase())
          .filter(Boolean)
      )
    );
  }

  function getInfluencerById(id) {
    return state.influencers.find((item) => Number(item.id) === Number(id)) || null;
  }

  function renderCouponChips(coupons = []) {
    if (!Array.isArray(coupons) || !coupons.length) {
      return '<p class="admin-table__muted" style="margin:0;">No coupons assigned yet.</p>';
    }
    return coupons.map((coupon) => `<span class="admin-chip">${escapeHtml(coupon)}</span>`).join('');
  }

  function uniqueId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
  }

  async function copyTextToClipboard(text) {
    const value = String(text || '');
    if (!value) {
      toast('Copy failed', 'No coupon code available to copy.', 'warning');
      return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const input = document.createElement('textarea');
        input.value = value;
        input.setAttribute('readonly', 'true');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      toast('Copied', 'Coupon code copied to clipboard.', 'success');
    } catch (error) {
      toast('Copy failed', 'Unable to copy the coupon code.', 'warning');
    }
  }

  function buildApiUrl(path) {
    return path;
  }

  async function apiRequest(path, options = {}) {
    const response = await fetch(buildApiUrl(path), {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.headers || {}),
      },
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

  const categoryList = [
    { id: 1, name: 'Hoodies', slug: 'hoodies', active: true, productCount: 2, description: 'Heavyweight organic cotton blend hoodies.' },
    { id: 2, name: 'Hydrogen Water Bottles', slug: 'bottles', active: true, productCount: 1, description: 'Portable molecular hydrogen bottle collection.' },
    { id: 3, name: 'Hydrogen Mists / Sprays', slug: 'sprays', active: true, productCount: 1, description: 'Hydrogen mist products for daily refresh.' },
  ];

  const productsList = [
    {
      id: 1,
      name: 'Zenith Hoodie - Black',
      slug: 'zenith-hoodie-black',
      primarySku: 'HM-HOD-BLK-S',
      categoryId: 1,
      category: 'Hoodies',
      price: 349900,
      priceLabel: '₹3,499',
      stock: 100,
      status: 'published',
      createdAt: '2026-02-06',
      sales: 174,
      lowStockThreshold: 12,
      featured: true,
      archived: false,
      image: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg?v=1770377146',
      description: 'Heavyweight 450 GSM organic cotton blend hoodie in black.',
    },
    {
      id: 2,
      name: 'Zenith Hoodie - Sand',
      slug: 'zenith-hoodie-sand',
      primarySku: 'HM-HOD-SND-S',
      categoryId: 1,
      category: 'Hoodies',
      price: 349900,
      priceLabel: '₹3,499',
      stock: 83,
      status: 'published',
      createdAt: '2026-02-06',
      sales: 149,
      lowStockThreshold: 12,
      featured: true,
      archived: false,
      image: '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.30034b.jpg?v=1770377146',
      description: 'Earth-toned variant of the Zenith heavyweight hoodie.',
    },
    {
      id: 3,
      name: 'H2 Molecular Hydrogen Water Bottle',
      slug: 'molecular-hydrogen-water-bottle',
      primarySku: 'HM-BTL-300-SLV',
      categoryId: 2,
      category: 'Hydrogen Water Bottles',
      price: 699900,
      priceLabel: '₹6,999 - ₹8,499',
      stock: 130,
      status: 'published',
      createdAt: '2026-03-15',
      sales: 88,
      lowStockThreshold: 10,
      featured: true,
      archived: false,
      image: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113',
      description: 'Hydrogen-rich water bottle with 300ml and 500ml variants.',
    },
    {
      id: 4,
      name: 'H2 Hydrogen Mist Spray',
      slug: 'hydrogen-mist-spray',
      primarySku: 'HM-SPR-050-WHT',
      categoryId: 3,
      category: 'Hydrogen Mists / Sprays',
      price: 249900,
      priceLabel: '₹2,499 - ₹3,799',
      stock: 155,
      status: 'published',
      createdAt: '2026-04-01',
      sales: 106,
      lowStockThreshold: 10,
      featured: false,
      archived: false,
      image: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138',
      description: 'Hydrogen mist and spray range with white and rose-gold variants.',
    },
  ];

  const ordersList = [];
  const customersList = [];
  const couponsList = [];
  const influencersList = [];
  const notificationsList = [];

  const initialState = {
    view: 'dashboard',
    sidebarOpen: false,
    notificationsOpen: false,
    selectedProductIds: [],
    selectedProductId: 101,
    selectedOrderId: 50031,
    selectedCustomerId: 1,
    selectedCouponId: 1,
    selectedInfluencerId: null,
    productsSearch: '',
    productsCategory: 'all',
    productsSort: 'newest',
    productsStatus: 'all',
    productsPage: 1,
    ordersSearch: '',
    ordersStatus: 'all',
    ordersPage: 1,
    customersSearch: '',
    couponsSearch: '',
    couponsLoading: false,
    influencersSearch: '',
    reportFrom: daysAgo(29),
    reportTo: toISODate(today),
    reportFormat: 'csv',
    settings: {
      storeName: 'House Merch',
      supportEmail: 'support@h2health.in',
      supportPhone: '+91 90000 00000',
      shippingCharges: '149',
      returnPolicy: '30-day returns for unused items in original packaging.',
      taxSettings: 'GST calculated at checkout based on shipping state.',
      paymentGateway: 'Razorpay',
      emailTemplates: 'Order confirmations, shipping updates, coupon reminders.',
      adminUsers: 'admin@h2health.local, ops@h2health.local',
      permissions: 'Products, Orders, Customers, Reports, Settings',
      notifications: 'Enabled for stock alerts, failed payments, returns, and new orders.',
    },
  };

  const state = {
    ...initialState,
    products: productsList,
    categories: categoryList,
    orders: ordersList,
    customers: customersList,
    coupons: couponsList,
    influencers: influencersList,
    notifications: notificationsList,
    modalOpen: false,
    modalType: '',
    modalEntityId: null,
  };

  const els = {
    sidebar: document.getElementById('adminSidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    pageTitle: document.getElementById('pageTitle'),
    dashboardView: document.getElementById('dashboardView'),
    productsView: document.getElementById('productsView'),
    categoriesView: document.getElementById('categoriesView'),
    ordersView: document.getElementById('ordersView'),
    customersView: document.getElementById('customersView'),
    couponsView: document.getElementById('couponsView'),
    influencersView: document.getElementById('influencersView'),
    reportsView: document.getElementById('reportsView'),
    settingsView: document.getElementById('settingsView'),
    notificationsDrawer: document.getElementById('notificationsDrawer'),
    notificationsList: document.getElementById('notificationsList'),
    adminModal: document.getElementById('adminModal'),
    adminModalDialog: document.getElementById('adminModalDialog'),
    toastRegion: document.getElementById('toastRegion'),
    profileAvatar: document.getElementById('profileAvatar'),
    adminContent: document.getElementById('adminContent'),
  };

  function getCategoryName(categoryId) {
    return state.categories.find((item) => Number(item.id) === Number(categoryId))?.name || 'Uncategorized';
  }

  function getStatusLabel(status) {
    const map = {
      pending: 'Pending',
      processing: 'Processing',
      shipped: 'Shipped',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      returned: 'Returned',
      published: 'Published',
      draft: 'Draft',
      archived: 'Archived',
      active: 'Active',
      inactive: 'Inactive',
      paid: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded',
    };
    return map[String(status || '').toLowerCase()] || String(status || 'Unknown');
  }

  function toast(title, message, tone = 'default') {
    const node = document.createElement('div');
    node.className = `admin-toast${tone ? ` admin-toast--${tone}` : ''}`;
    node.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
    `;
    els.toastRegion.appendChild(node);
    window.setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(8px)';
    }, 2800);
    window.setTimeout(() => node.remove(), 3400);
  }

  function setSidebarOpen(isOpen) {
    state.sidebarOpen = Boolean(isOpen);
    document.body.classList.toggle('admin-sidebar-open', state.sidebarOpen);
    els.sidebarOverlay.hidden = !state.sidebarOpen;
  }

  function setNotificationsOpen(isOpen) {
    state.notificationsOpen = Boolean(isOpen);
    els.notificationsDrawer.hidden = !state.notificationsOpen;
  }

  function openModal({ title, subtitle = '', body = '', footer = '', size = 'md' }) {
    els.adminModalDialog.className = `admin-modal__dialog admin-modal__dialog--${size}`;
    els.adminModalDialog.innerHTML = `
      <div class="admin-modal__head">
        <div>
          <p class="admin-kicker">${escapeHtml(subtitle || 'House Merch')}</p>
          <h3 class="admin-modal__title" id="adminModalTitle">${escapeHtml(title)}</h3>
          ${subtitle ? `<p class="admin-modal__sub">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button class="admin-icon-btn" type="button" data-action="close-modal" aria-label="Close modal">&times;</button>
      </div>
      <div class="admin-modal__body">${body}</div>
      ${footer ? `<div class="admin-modal__foot">${footer}</div>` : ''}
    `;
    els.adminModal.hidden = false;
    els.adminModal.setAttribute('aria-hidden', 'false');
    state.modalOpen = true;
    document.body.style.overflow = 'hidden';
    return els.adminModalDialog;
  }

  function closeModal() {
    if (!state.modalOpen) return;
    els.adminModal.hidden = true;
    els.adminModal.setAttribute('aria-hidden', 'true');
    els.adminModalDialog.innerHTML = '';
    state.modalOpen = false;
    document.body.style.overflow = '';
  }

  function openConfirmModal({ title, message, confirmLabel = 'Confirm', tone = 'danger', onConfirm }) {
    openModal({
      title,
      subtitle: 'Action required',
      body: `<p style="margin:0;color:var(--admin-muted);line-height:1.6;">${escapeHtml(message)}</p>`,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn ${tone === 'danger' ? 'admin-btn--danger' : 'admin-btn--primary'}" type="button" data-confirm-action>${escapeHtml(confirmLabel)}</button>
      `,
      size: 'sm',
    });
    els.adminModalDialog.querySelector('[data-confirm-action]')?.addEventListener('click', () => {
      closeModal();
      onConfirm?.();
    });
  }

  function renderStats() {
    const orderCount = state.orders.length;
    const todayOrders = state.orders.filter((order) => String(order.createdAt).startsWith(toISODate(today))).length;
    const revenue = state.orders
      .filter((order) => ['paid', 'refunded'].includes(order.paymentStatus) || order.status === 'delivered' || order.status === 'shipped')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const pending = state.orders.filter((order) => order.status === 'pending').length;
    const processing = state.orders.filter((order) => order.status === 'processing').length;
    const shipped = state.orders.filter((order) => order.status === 'shipped').length;
    const delivered = state.orders.filter((order) => order.status === 'delivered').length;
    const cancelled = state.orders.filter((order) => order.status === 'cancelled').length;
    const returned = state.orders.filter((order) => order.status === 'returned').length;
    const lowStock = state.products.filter((product) => Number(product.stock) <= Number(product.lowStockThreshold || 10) && product.status !== 'archived').length;

    return [
      { label: "Today's Orders", value: todayOrders, note: 'Placed since midnight', trend: '+18%', up: true },
      { label: 'Total Orders', value: orderCount, note: 'Lifetime order count', trend: '+7%', up: true },
      { label: 'Revenue', value: money(revenue), note: 'Captured and in transit', trend: '+12%', up: true },
      { label: 'Pending Orders', value: pending, note: `${processing} in processing`, trend: '-4%', up: false },
      { label: 'Processing Orders', value: processing, note: `${shipped} already shipped`, trend: '+3%', up: true },
      { label: 'Shipped Orders', value: shipped, note: `${delivered} delivered`, trend: '+9%', up: true },
      { label: 'Delivered Orders', value: delivered, note: `${cancelled} cancelled`, trend: '+14%', up: true },
      { label: 'Cancelled Orders', value: cancelled, note: `${returned} returned`, trend: '-2%', up: false },
      { label: 'Returned Orders', value: returned, note: 'Post-delivery returns', trend: '-1%', up: false },
      { label: 'Low Stock Products', value: lowStock, note: 'Needs replenishment', trend: '-5%', up: false },
    ];
  }

  function renderStatCards() {
    return renderStats()
      .map(
        (item) => `
          <article class="admin-stat">
            <div class="admin-stat__top">
              <div>
                <p class="admin-stat__label">${escapeHtml(item.label)}</p>
                <p class="admin-stat__value">${escapeHtml(item.value)}</p>
              </div>
              <span class="admin-stat__trend ${item.up ? 'admin-stat__trend--up' : 'admin-stat__trend--down'}">${item.up ? '+' : '-'} ${escapeHtml(item.trend)}</span>
            </div>
            <p class="admin-stat__note">${escapeHtml(item.note)}</p>
          </article>
        `
      )
      .join('');
  }

  function renderMiniChart(rows) {
    return rows
      .map(
        (row) => `
          <div class="admin-mini-chart__row">
            <span class="admin-mini-chart__label">${escapeHtml(row.label)}</span>
            <div class="admin-mini-chart__track"><span class="admin-mini-chart__bar" style="width:${Math.max(6, Math.min(100, row.value))}%"></span></div>
            <span class="admin-mini-chart__value">${escapeHtml(row.display)}</span>
          </div>
        `
      )
      .join('');
  }

  function renderEmptyState(title, message, actionLabel = '', actionId = '') {
    return `
      <div class="admin-list__item" style="padding:18px;">
        <p class="admin-list__item-title">${escapeHtml(title)}</p>
        <p class="admin-list__item-sub">${escapeHtml(message)}</p>
        ${actionLabel ? `<div class="admin-actions" style="margin-top:8px;"><button class="admin-action-link" type="button" data-action="${escapeHtml(actionId)}">${escapeHtml(actionLabel)}</button></div>` : ''}
      </div>
    `;
  }

  function renderDashboard() {
    els.dashboardView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Overview</h2>
            <p class="admin-section__desc">This shell is wired to the live merch catalog data only. Orders, customers, coupons, and influencer data remain blank until backend APIs are connected.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-card-grid admin-card-grid--2">
            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Catalog Sync</h3>
                <p class="admin-card__sub">Pulled from the storefront product list</p>
              </div>
              <div class="admin-card__body admin-list">
                ${state.products.map((product) => `
                  <div class="admin-list__item">
                    <div class="admin-list__item-head">
                      <div>
                        <p class="admin-list__item-title">${escapeHtml(product.name)}</p>
                        <p class="admin-list__item-sub">${escapeHtml(product.category)}</p>
                      </div>
                      <span class="admin-badge ${statusClass(product.status)}">${escapeHtml(getStatusLabel(product.status))}</span>
                    </div>
                    <p class="admin-table__muted">${escapeHtml(product.priceLabel || money(product.price))} · ${escapeHtml(product.primarySku || 'SKU pending')}</p>
                  </div>
                `).join('')}
              </div>
            </article>

            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Wiring Status</h3>
                <p class="admin-card__sub">What is connected now versus what still needs APIs</p>
              </div>
              <div class="admin-card__body admin-list">
                <div class="admin-list__item">
                  <p class="admin-list__item-title">Products</p>
                  <p class="admin-list__item-sub">Connected to the storefront catalog data.</p>
                </div>
                <div class="admin-list__item">
                  <p class="admin-list__item-title">Orders</p>
                  <p class="admin-list__item-sub">Waiting for the real order management API.</p>
                </div>
                <div class="admin-list__item">
                  <p class="admin-list__item-title">Customers</p>
                  <p class="admin-list__item-sub">Waiting for customer profile API data.</p>
                </div>
                <div class="admin-list__item">
                  <p class="admin-list__item-title">Coupons and Influencers</p>
                  <p class="admin-list__item-sub">UI is ready, but the backend source is not wired yet.</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <div class="admin-view__split">
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Revenue Overview</h2>
              <p class="admin-section__desc">Monthly sales trend and distribution snapshots.</p>
            </div>
          </div>
          <div class="admin-section__body admin-card-grid admin-card-grid--2">
            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Monthly Revenue</h3>
                <p class="admin-card__sub">Waiting for backend revenue data</p>
              </div>
              <div class="admin-card__body">
                <p class="admin-table__muted" style="margin:0;">Revenue graphs will appear here after the reports API is connected.</p>
              </div>
            </article>
            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Order Status Distribution</h3>
                <p class="admin-card__sub">Waiting for order data</p>
              </div>
              <div class="admin-card__body" style="display:grid;gap:12px;">
                <div class="admin-chart-ring" style="margin-inline:auto;">
                  <span>
                    <strong>API</strong>
                    <small>Pending</small>
                  </span>
                </div>
                <p class="admin-table__muted" style="margin:0;">Order distribution charts will render once the backend returns real counts.</p>
              </div>
            </article>
          </div>
        </section>

        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Quick Activity</h2>
              <p class="admin-section__desc">No live operational feed is connected yet.</p>
            </div>
          </div>
          <div class="admin-section__body admin-list">
            <div class="admin-list__item">
              <p class="admin-list__item-title">Orders</p>
              <p class="admin-list__item-sub">This panel will show new orders, payment alerts, and fulfillment changes.</p>
            </div>
            <div class="admin-list__item">
              <p class="admin-list__item-title">Stock</p>
              <p class="admin-list__item-sub">Low-stock and replenishment alerts will appear here.</p>
            </div>
            <div class="admin-list__item">
              <p class="admin-list__item-title">Coupons</p>
              <p class="admin-list__item-sub">Coupon expiry and usage spikes will appear here.</p>
            </div>
            <div class="admin-list__item">
              <p class="admin-list__item-title">Customers</p>
              <p class="admin-list__item-sub">New registrations and customer activity will appear here.</p>
            </div>
          </div>
        </section>
      </div>

      <div class="admin-card-grid admin-card-grid--2">
        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Recent Orders</h3>
            <p class="admin-card__sub">Waiting for the order API</p>
          </div>
          <div class="admin-card__body">
            <p class="admin-table__muted" style="margin:0;">No live order data is connected yet.</p>
          </div>
        </section>

        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Latest Customers</h3>
            <p class="admin-card__sub">Waiting for customer API data</p>
          </div>
          <div class="admin-card__body">
            <p class="admin-table__muted" style="margin:0;">Customer profiles will appear here after the backend is wired.</p>
          </div>
        </section>
      </div>

      <div class="admin-card-grid admin-card-grid--3">
        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Recent Payments</h3>
            <p class="admin-card__sub">Waiting for payment data</p>
          </div>
          <div class="admin-card__body">
            <p class="admin-table__muted" style="margin:0;">Payment entries will appear when the checkout and payment APIs are connected.</p>
          </div>
        </section>

        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Recent Coupon Usage</h3>
            <p class="admin-card__sub">Waiting for coupon usage data</p>
          </div>
          <div class="admin-card__body">
            <p class="admin-table__muted" style="margin:0;">Coupon performance metrics will appear once a real source is wired in.</p>
          </div>
        </section>

        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Top Selling Products</h3>
            <p class="admin-card__sub">Using storefront catalog prices</p>
          </div>
          <div class="admin-card__body admin-list">
            ${state.products.map((product) => `
              <div class="admin-list__item">
                <div class="admin-list__item-head">
                  <div>
                    <p class="admin-list__item-title">${escapeHtml(product.name)}</p>
                    <p class="admin-list__item-sub">${escapeHtml(product.category)}</p>
                  </div>
                  <strong>${escapeHtml(product.priceLabel || money(product.price))}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      </div>

      <div class="admin-card-grid admin-card-grid--2">
        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Top Categories</h3>
            <p class="admin-card__sub">Storefront categories only</p>
          </div>
          <div class="admin-card__body">
            <div class="admin-list">
              ${state.categories.map((category) => `
                <div class="admin-list__item">
                  <p class="admin-list__item-title">${escapeHtml(category.name)}</p>
                  <p class="admin-list__item-sub">${escapeHtml(category.description)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <section class="admin-card">
          <div class="admin-card__head">
            <h3 class="admin-card__title">Revenue Overview Chart</h3>
            <p class="admin-card__sub">Pending revenue API</p>
          </div>
          <div class="admin-card__body">
            <p class="admin-table__muted" style="margin:0;">Revenue charts are intentionally blank until we connect live reporting data.</p>
          </div>
        </section>
      </div>
    `;
  }

  function filterProducts() {
    const query = state.productsSearch.trim().toLowerCase();
    return [...state.products]
      .filter((product) => {
        const matchesQuery =
          !query ||
          [product.name, product.sku, product.category, product.description]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(query));
        const matchesCategory = state.productsCategory === 'all' || String(product.categoryId) === String(state.productsCategory);
        const matchesStatus = state.productsStatus === 'all' || product.status === state.productsStatus;
        return matchesQuery && matchesCategory && matchesStatus;
      })
      .sort((a, b) => {
        switch (state.productsSort) {
          case 'price-asc':
            return a.price - b.price;
          case 'price-desc':
            return b.price - a.price;
          case 'stock-low':
            return a.stock - b.stock;
          case 'featured':
            return Number(b.featured) - Number(a.featured) || b.sales - a.sales;
          case 'newest':
          default:
            return String(b.createdAt).localeCompare(String(a.createdAt));
        }
      });
  }

  function renderProducts() {
    const filtered = filterProducts();
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.productsPage > totalPages) state.productsPage = totalPages;
    const start = (state.productsPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    const selectedCount = state.selectedProductIds.length;
    const lowStockCount = state.products.filter((product) => !product.archived && product.stock <= product.lowStockThreshold).length;

    els.productsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Product Management</h2>
            <p class="admin-section__desc">Search, sort, duplicate, archive, and edit the merchandise catalog.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="productsSearch" value="${escapeHtml(state.productsSearch)}" placeholder="Search products, SKU, category, description" />
              <select class="admin-select" data-input="productsCategory">
                <option value="all">All categories</option>
                ${state.categories.map((category) => `<option value="${category.id}" ${String(state.productsCategory) === String(category.id) ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}
              </select>
              <select class="admin-select" data-input="productsStatus">
                <option value="all">All statuses</option>
                <option value="published" ${state.productsStatus === 'published' ? 'selected' : ''}>Published</option>
                <option value="draft" ${state.productsStatus === 'draft' ? 'selected' : ''}>Draft</option>
                <option value="archived" ${state.productsStatus === 'archived' ? 'selected' : ''}>Archived</option>
              </select>
              <select class="admin-select" data-input="productsSort">
                <option value="newest" ${state.productsSort === 'newest' ? 'selected' : ''}>Newest first</option>
                <option value="featured" ${state.productsSort === 'featured' ? 'selected' : ''}>Featured first</option>
                <option value="price-asc" ${state.productsSort === 'price-asc' ? 'selected' : ''}>Price low to high</option>
                <option value="price-desc" ${state.productsSort === 'price-desc' ? 'selected' : ''}>Price high to low</option>
                <option value="stock-low" ${state.productsSort === 'stock-low' ? 'selected' : ''}>Stock low to high</option>
              </select>
            </div>
            <div class="admin-toolbar__group">
              <button class="admin-btn admin-btn--soft" type="button" data-action="open-product-modal">Add Product</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-duplicate" ${selectedCount ? '' : 'disabled'}>Duplicate Selected</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-archive" ${selectedCount ? '' : 'disabled'}>Archive Selected</button>
              <button class="admin-btn admin-btn--danger" type="button" data-action="bulk-delete" ${selectedCount ? '' : 'disabled'}>Delete Selected</button>
            </div>
          </div>

          <div class="admin-grid admin-grid--stats" style="margin-bottom:18px;">
            ${[
              { label: 'Products in view', value: filtered.length, note: 'Matching current filters', trend: '+8%', up: true },
              { label: 'Low stock', value: lowStockCount, note: 'Needs replenishment', trend: '-2%', up: false },
              { label: 'Archived', value: state.products.filter((product) => product.archived).length, note: 'Hidden from storefront', trend: '+1%', up: true },
              { label: 'Featured', value: state.products.filter((product) => product.featured).length, note: 'Highlighted items', trend: '+3%', up: true },
              { label: 'Avg. price', value: money(Math.round(state.products.reduce((sum, product) => sum + product.price, 0) / state.products.length || 0)), note: 'All catalog items', trend: '+5%', up: true },
            ].map((item) => `
              <article class="admin-stat">
                <div class="admin-stat__top">
                  <div>
                    <p class="admin-stat__label">${escapeHtml(item.label)}</p>
                    <p class="admin-stat__value">${escapeHtml(item.value)}</p>
                  </div>
                  <span class="admin-stat__trend ${item.up ? 'admin-stat__trend--up' : 'admin-stat__trend--down'}">${item.trend}</span>
                </div>
                <p class="admin-stat__note">${escapeHtml(item.note)}</p>
              </article>
            `).join('')}
          </div>

          ${selectedCount ? `<div class="admin-toolbar" style="margin:0 0 14px;"><strong>${selectedCount} selected</strong><span class="admin-table__muted">Bulk actions available</span></div>` : ''}

          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th><input type="checkbox" data-action="toggle-product-page-selection" ${pageItems.length && pageItems.every((item) => state.selectedProductIds.includes(item.id)) ? 'checked' : ''} /></th>
                  <th>Image</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${pageItems.map((product) => `
                  <tr>
                    <td><input type="checkbox" data-action="toggle-product-selection" data-id="${product.id}" ${state.selectedProductIds.includes(product.id) ? 'checked' : ''} /></td>
                    <td><img class="admin-thumb" src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" /></td>
                    <td><strong>${escapeHtml(product.name)}</strong><br><span class="admin-table__muted">${escapeHtml(product.description)}</span></td>
                    <td>${escapeHtml(product.sku)}</td>
                    <td>${escapeHtml(product.category)}</td>
                    <td><strong>${escapeHtml(product.priceLabel || money(product.price))}</strong></td>
                    <td>${escapeHtml(product.stock)}</td>
                    <td><span class="admin-badge ${statusClass(product.status)}">${escapeHtml(getStatusLabel(product.status))}</span></td>
                    <td>${escapeHtml(dateLabel(product.createdAt))}</td>
                    <td>
                      <div class="admin-actions">
                        <button class="admin-action-link" type="button" data-action="edit-product" data-id="${product.id}">Edit</button>
                        <button class="admin-action-link" type="button" data-action="duplicate-product" data-id="${product.id}">Duplicate</button>
                        <button class="admin-action-link" type="button" data-action="archive-product" data-id="${product.id}">${product.archived ? 'Restore' : 'Archive'}</button>
                        <button class="admin-action-link" type="button" data-action="delete-product" data-id="${product.id}">Delete</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="admin-toolbar" style="margin-top:16px;">
            <span class="admin-table__muted">Page ${state.productsPage} of ${totalPages}</span>
            <div class="admin-toolbar__group">
              <button class="admin-btn admin-btn--ghost" type="button" data-action="products-prev" ${state.productsPage <= 1 ? 'disabled' : ''}>Previous</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="products-next" ${state.productsPage >= totalPages ? 'disabled' : ''}>Next</button>
            </div>
          </div>
        </div>
      </section>
    `;
  }

  function renderCategories() {
    els.categoriesView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Categories</h2>
            <p class="admin-section__desc">Group the merch line into clean collections and keep activity toggles simple.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <div class="admin-chip-row">
              <span class="admin-chip is-active">All Categories</span>
              <span class="admin-chip">Active</span>
              <span class="admin-chip">Inactive</span>
            </div>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-category-modal">Add Category</button>
          </div>

          <div class="admin-card-grid admin-card-grid--3">
            ${state.categories.map((category) => `
              <article class="admin-card">
                <div class="admin-card__head">
                  <div class="admin-list__item-head">
                    <div>
                      <h3 class="admin-card__title">${escapeHtml(category.name)}</h3>
                      <p class="admin-card__sub">${escapeHtml(category.description)}</p>
                    </div>
                    <span class="admin-badge ${category.active ? 'admin-badge--active' : 'admin-badge--inactive'}">${category.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div class="admin-card__body">
                  <div class="admin-chip-row" style="margin-bottom:12px;">
                    <span class="admin-chip">${escapeHtml(category.productCount)} products</span>
                    <span class="admin-chip">${escapeHtml(category.slug)}</span>
                  </div>
                  <div class="admin-actions">
                    <button class="admin-action-link" type="button" data-action="edit-category" data-id="${category.id}">Edit</button>
                    <button class="admin-action-link" type="button" data-action="toggle-category" data-id="${category.id}">${category.active ? 'Deactivate' : 'Activate'}</button>
                    <button class="admin-action-link" type="button" data-action="delete-category" data-id="${category.id}">Delete</button>
                  </div>
                </div>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function filteredOrders() {
    const query = state.ordersSearch.trim().toLowerCase();
    return [...state.orders].filter((order) => {
      const matchesStatus = state.ordersStatus === 'all' || order.status === state.ordersStatus;
      const matchesQuery =
        !query ||
        [order.orderNumber, order.customerName, order.email, order.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }

  function renderOrderDetail(order) {
    if (!order) {
      return `<p class="admin-table__muted">Select an order to inspect details.</p>`;
    }
    return `
      <div class="admin-list">
        <div class="admin-list__item">
          <div class="admin-list__item-head">
            <div>
              <p class="admin-list__item-title">${escapeHtml(order.orderNumber)}</p>
              <p class="admin-list__item-sub">${escapeHtml(order.customerName)} - ${escapeHtml(order.email)}</p>
            </div>
            <span class="admin-badge ${statusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span>
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Customer Information</p>
          <p class="admin-list__item-sub">${escapeHtml(order.customerName)}<br>${escapeHtml(order.email)}<br>${escapeHtml(order.phone)}</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Shipping Address</p>
          <p class="admin-list__item-sub">${escapeHtml(order.shippingAddress)}</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Billing Address</p>
          <p class="admin-list__item-sub">${escapeHtml(order.billingAddress)}</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Ordered Products</p>
          <div class="admin-list">
            ${order.items.map((item) => `
              <div class="admin-list__item" style="padding:10px 12px;">
                <div class="admin-list__item-head">
                  <div>
                    <p class="admin-list__item-title">${escapeHtml(item.name)}</p>
                    <p class="admin-list__item-sub">Qty ${escapeHtml(item.qty)}</p>
                  </div>
                  <strong>${escapeHtml(money(item.price))}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Payment and Shipping</p>
          <p class="admin-list__item-sub">
            Payment: ${escapeHtml(order.paymentMethod.toUpperCase())}<br>
            Payment Status: ${escapeHtml(getStatusLabel(order.paymentStatus))}<br>
            Coupon: ${escapeHtml(order.couponCode || 'None')}<br>
            Influencer Coupon: ${escapeHtml(order.influencerCoupon || 'None')}<br>
            Tracking: ${escapeHtml(order.trackingNumber || 'Pending')}<br>
            Carrier: ${escapeHtml(order.carrier || 'Not assigned')}
          </p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Order Timeline</p>
          <div class="admin-status-timeline">
            ${order.timeline.map((entry) => `
              <div class="admin-timeline-item">
                <span class="admin-timeline-item__dot"></span>
                <div>
                  <p class="admin-timeline-item__title">${escapeHtml(entry.label)}</p>
                  <p class="admin-timeline-item__text">${escapeHtml(entry.note)} - ${escapeHtml(timeLabel(entry.time))}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderOrders() {
    if (!state.orders.length) {
      els.ordersView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Orders</h2>
              <p class="admin-section__desc">No live order data is connected yet.</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('No orders synced', 'Connect the orders API to display order queues, filters, and fulfillment actions.')}
          </div>
        </section>
      `;
      return;
    }

    const filtered = filteredOrders();
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.ordersPage > totalPages) state.ordersPage = totalPages;
    const start = (state.ordersPage - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);
    const selectedOrder = state.orders.find((order) => Number(order.id) === Number(state.selectedOrderId)) || filtered[0] || state.orders[0];
    if (selectedOrder) state.selectedOrderId = selectedOrder.id;

    els.ordersView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Orders</h2>
            <p class="admin-section__desc">Track, filter, and advance the fulfillment pipeline with clean placeholder interactions.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="ordersSearch" value="${escapeHtml(state.ordersSearch)}" placeholder="Search by order ID, customer name, email, or phone" />
            </div>
            <div class="admin-toolbar__group">
              <button class="admin-btn ${state.ordersStatus === 'all' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="all">All</button>
              <button class="admin-btn ${state.ordersStatus === 'pending' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="pending">Pending</button>
              <button class="admin-btn ${state.ordersStatus === 'processing' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="processing">Processing</button>
              <button class="admin-btn ${state.ordersStatus === 'shipped' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="shipped">Shipped</button>
              <button class="admin-btn ${state.ordersStatus === 'delivered' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="delivered">Delivered</button>
              <button class="admin-btn ${state.ordersStatus === 'cancelled' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="cancelled">Cancelled</button>
              <button class="admin-btn ${state.ordersStatus === 'returned' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="returned">Returned</button>
            </div>
          </div>

          <div class="admin-grid admin-grid--two">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Order List</h3>
                <p class="admin-card__sub">${filtered.length} order(s) match the current filters</p>
              </div>
              <div class="admin-card__body admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageItems.map((order) => `
                      <tr data-action="select-order" data-id="${order.id}" style="cursor:pointer;">
                        <td><strong>${escapeHtml(order.orderNumber)}</strong><br><span class="admin-table__muted">${escapeHtml(dateLabel(order.createdAt))}</span></td>
                        <td>${escapeHtml(order.customerName)}<br><span class="admin-table__muted">${escapeHtml(order.email)}</span></td>
                        <td>${escapeHtml(order.paymentMethod.toUpperCase())}<br><span class="admin-table__muted">${escapeHtml(getStatusLabel(order.paymentStatus))}</span></td>
                        <td><strong>${escapeHtml(money(order.totalAmount))}</strong></td>
                        <td><span class="admin-badge ${statusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span></td>
                        <td>
                          <div class="admin-actions">
                            <button class="admin-action-link" type="button" data-action="advance-order" data-id="${order.id}">Next Step</button>
                            <button class="admin-action-link" type="button" data-action="cancel-order" data-id="${order.id}">Cancel</button>
                            <button class="admin-action-link" type="button" data-action="refund-order" data-id="${order.id}">Refund</button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              <div class="admin-card__foot">
                <div class="admin-toolbar">
                  <span class="admin-table__muted">Page ${state.ordersPage} of ${totalPages}</span>
                  <div class="admin-toolbar__group">
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="orders-prev" ${state.ordersPage <= 1 ? 'disabled' : ''}>Previous</button>
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="orders-next" ${state.ordersPage >= totalPages ? 'disabled' : ''}>Next</button>
                  </div>
                </div>
              </div>
            </section>

            <section class="admin-side-panel">
              <article class="admin-card">
                <div class="admin-card__head">
                  <h3 class="admin-card__title">Order Details</h3>
                  <p class="admin-card__sub">Customer, shipping, timeline, and payment info</p>
                </div>
                <div class="admin-card__body">
                  ${renderOrderDetail(selectedOrder)}
                </div>
                <div class="admin-card__foot">
                  <div class="admin-footer-actions">
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="advance-order" data-id="${selectedOrder?.id || ''}">Accept / Process</button>
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="ship-order" data-id="${selectedOrder?.id || ''}">Ship</button>
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="deliver-order" data-id="${selectedOrder?.id || ''}">Deliver</button>
                    <button class="admin-btn admin-btn--danger" type="button" data-action="cancel-order" data-id="${selectedOrder?.id || ''}">Cancel</button>
                    <button class="admin-btn admin-btn--soft" type="button" data-action="refund-order" data-id="${selectedOrder?.id || ''}">Refund</button>
                  </div>
                </div>
              </article>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function renderCustomerDetail(customer) {
    if (!customer) {
      return `<p class="admin-table__muted">Select a customer to view profile details.</p>`;
    }
    const customerOrders = state.orders.filter((order) => order.email === customer.email);
    return `
      <div class="admin-list">
        <div class="admin-list__item">
          <div class="admin-list__item-head">
            <div>
              <p class="admin-list__item-title">${escapeHtml(customer.name)}</p>
              <p class="admin-list__item-sub">${escapeHtml(customer.email)}</p>
            </div>
            <span class="admin-avatar">${escapeHtml(initials(customer.name))}</span>
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Personal Details</p>
          <p class="admin-list__item-sub">${escapeHtml(customer.phone)}<br>Registered: ${escapeHtml(dateLabel(customer.registeredAt))}</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Addresses</p>
          <p class="admin-list__item-sub">${escapeHtml(customer.addresses)} saved address(es)</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Order History</p>
          <p class="admin-list__item-sub">${escapeHtml(customerOrders.length)} order(s) placed</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Wishlist and Coupons</p>
          <p class="admin-list__item-sub">Wishlist items: ${escapeHtml(customer.wishlist)}<br>Coupons used: ${escapeHtml(customer.couponsUsed)}</p>
        </div>
      </div>
    `;
  }

  function renderCustomers() {
    if (!state.customers.length) {
      els.customersView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Customers</h2>
              <p class="admin-section__desc">No live customer data is connected yet.</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('No customer profiles', 'Connect the customer API to view profiles, addresses, order history, and loyalty details.')}
          </div>
        </section>
      `;
      return;
    }

    const query = state.customersSearch.trim().toLowerCase();
    const filtered = state.customers.filter((customer) =>
      !query ||
      [customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    const selectedCustomer = state.customers.find((customer) => Number(customer.id) === Number(state.selectedCustomerId)) || filtered[0] || state.customers[0];
    if (selectedCustomer) state.selectedCustomerId = selectedCustomer.id;

    els.customersView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Customers</h2>
            <p class="admin-section__desc">Inspect purchasing behavior, profile history, and loyalty signals.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="customersSearch" value="${escapeHtml(state.customersSearch)}" placeholder="Search by name, email, or phone" />
            </div>
          </div>

          <div class="admin-grid admin-grid--two">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Customer List</h3>
                <p class="admin-card__sub">${filtered.length} customer(s) matched</p>
              </div>
              <div class="admin-card__body admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Phone</th>
                      <th>Registered</th>
                      <th>Orders</th>
                      <th>Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((customer) => `
                      <tr data-action="select-customer" data-id="${customer.id}" style="cursor:pointer;">
                        <td><strong>${escapeHtml(customer.name)}</strong><br><span class="admin-table__muted">${escapeHtml(customer.email)}</span></td>
                        <td>${escapeHtml(customer.phone)}</td>
                        <td>${escapeHtml(dateLabel(customer.registeredAt))}</td>
                        <td>${escapeHtml(customer.totalOrders)}</td>
                        <td><strong>${escapeHtml(money(customer.totalSpend))}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </section>
            <section class="admin-side-panel">
              <article class="admin-card">
                <div class="admin-card__head">
                  <h3 class="admin-card__title">Customer Profile</h3>
                  <p class="admin-card__sub">Orders, wishlist, and coupons used</p>
                </div>
                <div class="admin-card__body">
                  ${renderCustomerDetail(selectedCustomer)}
                </div>
                <div class="admin-card__foot">
                  <div class="admin-footer-actions">
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="message-customer" data-id="${selectedCustomer?.id || ''}">Message</button>
                    <button class="admin-btn admin-btn--soft" type="button" data-action="export-customer" data-id="${selectedCustomer?.id || ''}">Export Profile</button>
                  </div>
                </div>
              </article>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function renderCoupons() {
    const items = Array.isArray(state.coupons) ? state.coupons : [];
    const query = state.couponsSearch.trim().toLowerCase();
    const filtered = items.filter((coupon) =>
      !query ||
      [
        coupon.code,
        coupon.description,
        coupon.festivalName,
        coupon.owner,
        coupon.recipientEmail,
        coupon.recipientName,
        coupon.appliesTo,
        coupon.couponType,
        coupon.ownerType,
        coupon.discount,
        coupon.discountValue,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );

    const totalCoupons = items.length;
    const activeCoupons = items.filter((coupon) => Number(coupon.active ?? coupon.isActive ?? 0) === 1).length;
    const expiredCoupons = items.filter((coupon) => {
      const expiry = String(coupon.validTill || coupon.expiresAt || coupon.expiry || '').trim();
      return Boolean(expiry) && new Date(expiry).getTime() < Date.now();
    }).length;
    const redeemedCoupons = items.reduce((sum, coupon) => sum + Number(coupon.totalRedemptions || coupon.usageCount || 0), 0);
    const discountGiven = items.reduce((sum, coupon) => {
      const usage = Number(coupon.totalRedemptions || coupon.usageCount || 0);
      const discountValue = Number(coupon.discountValue || 0);
      return sum + Math.max(0, usage * discountValue);
    }, 0);
    const activeInfluencerCoupons = items.filter((coupon) => getCouponTypeValue(coupon) === 'influencer' && Number(coupon.active ?? coupon.isActive ?? 0) === 1).length;

    const selectedCoupon = items.find((coupon) => Number(coupon.id) === Number(state.selectedCouponId)) || filtered[0] || items[0] || null;
    if (selectedCoupon) state.selectedCouponId = selectedCoupon.id;

    const summaryCards = [
      { label: 'Total Coupons', value: totalCoupons, note: 'Shared coupon store' },
      { label: 'Active Coupons', value: activeCoupons, note: 'Currently usable' },
      { label: 'Expired Coupons', value: expiredCoupons, note: 'Needs review' },
      { label: 'Coupons Redeemed', value: redeemedCoupons, note: 'Lifetime redemptions' },
      { label: 'Discount Given', value: `Rs. ${discountGiven.toLocaleString('en-IN')}`, note: 'Approx. total discount' },
      { label: 'Active Influencer Coupons', value: activeInfluencerCoupons, note: 'Assigned creator codes' },
    ];

    els.couponsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Coupons</h2>
            <p class="admin-section__desc">Shared coupon infrastructure for Merch and Bookings, surfaced in a merch-first dashboard.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-grid admin-grid--3" style="margin-bottom:16px;">
            ${summaryCards.map((card) => `
              <article class="admin-stat">
                <p class="admin-stat__label">${escapeHtml(card.label)}</p>
                <p class="admin-stat__value">${escapeHtml(card.value)}</p>
                <p class="admin-stat__note">${escapeHtml(card.note)}</p>
              </article>
            `).join('')}
          </div>

          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="couponsSearch" value="${escapeHtml(state.couponsSearch)}" placeholder="Search by coupon code, campaign, influencer, or customer email" />
            </div>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-coupon-modal">Create Coupon</button>
          </div>

          <div class="admin-grid admin-grid--two" style="margin-top:16px;">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Coupon List</h3>
                <p class="admin-card__sub">${filtered.length} coupon(s) matched</p>
              </div>
              <div class="admin-card__body admin-table-wrap">
                ${state.couponsLoading ? `
                  <div class="admin-empty">${renderEmptyState('Loading coupons', 'Fetching the shared coupon list from the booking database.')}</div>
                ` : filtered.length ? `
                  <table class="admin-table">
                    <thead>
                      <tr>
                        <th>Coupon Code</th>
                        <th>Coupon Type</th>
                        <th>Discount</th>
                        <th>Usage</th>
                        <th>Session Limit</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filtered.map((coupon) => {
                        const typeValue = getCouponTypeValue(coupon);
                        const typeLabel = typeValue === 'influencer' ? 'Influencer Coupon' : 'General Coupon';
                        const ownerLabel = String(coupon.owner || (typeValue === 'influencer' ? 'Influencer' : 'General')).trim();
                        const expiryValue = coupon.validTill || coupon.expiresAt || coupon.expiry || '';
                        const statusValue = Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 'active' : 'inactive';
                        const usageCount = Number(coupon.totalRedemptions || coupon.usageCount || 0);
                        return `
                          <tr data-action="select-coupon" data-id="${coupon.id}" style="cursor:pointer;">
                            <td><strong>${escapeHtml(coupon.code || '-')}</strong></td>
                            <td><span class="admin-badge ${typeValue === 'influencer' ? 'admin-badge--influencer' : 'admin-badge--general'}">${escapeHtml(typeLabel)}</span></td>
                            <td>${escapeHtml(coupon.discount || coupon.discountValue || '-')}</td>
                            <td>${escapeHtml(String(usageCount))}</td>
                            <td>${escapeHtml(String(coupon.sessionLimit || coupon.perUserLimit || 1))}</td>
                            <td>${escapeHtml(expiryValue ? dateLabel(expiryValue) : 'No expiry')}</td>
                            <td><span class="admin-badge ${statusClass(statusValue)}">${escapeHtml(getStatusLabel(statusValue))}</span></td>
                            <td>${escapeHtml(ownerLabel)}</td>
                            <td>${escapeHtml(coupon.createdAt ? dateLabel(coupon.createdAt) : '—')}</td>
                            <td>
                              <div class="admin-actions">
                                <button class="admin-action-link" type="button" data-action="select-coupon" data-id="${coupon.id}">View</button>
                                <button class="admin-action-link" type="button" data-action="edit-coupon" data-id="${coupon.id}">Edit</button>
                                <button class="admin-action-link" type="button" data-action="toggle-coupon" data-id="${coupon.id}">${statusValue === 'active' ? 'Disable' : 'Enable'}</button>
                                <button class="admin-action-link" type="button" data-action="copy-coupon" data-id="${coupon.id}">Copy Coupon</button>
                                <button class="admin-action-link" type="button" data-action="delete-coupon" data-id="${coupon.id}">Delete</button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                ` : renderEmptyState('No coupons found', 'Create a coupon or widen the search to see shared coupon data.')}
              </div>
            </section>

            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Coupon Details</h3>
                <p class="admin-card__sub">Usage, expiry, and owner context</p>
              </div>
              <div class="admin-card__body">
                ${selectedCoupon ? `
                  <div class="admin-list">
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">${escapeHtml(selectedCoupon.code || '-')}</p>
                      <p class="admin-list__item-sub">
                        ${escapeHtml(getCouponTypeLabel(selectedCoupon))}<br>
                        ${escapeHtml(selectedCoupon.description || 'No description')}
                      </p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Usage Statistics</p>
                      <p class="admin-list__item-sub">
                        Times used: ${escapeHtml(String(selectedCoupon.totalRedemptions || selectedCoupon.usageCount || 0))}<br>
                        Remaining usage: ${escapeHtml(selectedCoupon.maxRedemptions == null ? 'Unlimited' : String(Math.max(0, Number(selectedCoupon.maxRedemptions || 0) - Number(selectedCoupon.totalRedemptions || 0))))}<br>
                        Remaining session limit: ${escapeHtml(selectedCoupon.sessionLimit == null ? '—' : String(selectedCoupon.sessionLimit))}
                      </p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Order Summary</p>
                      <p class="admin-list__item-sub">
                        Discount: ${escapeHtml(String(selectedCoupon.discount || selectedCoupon.discountValue || '-'))}<br>
                        Expiry: ${escapeHtml(selectedCoupon.validTill || selectedCoupon.expiresAt || selectedCoupon.expiry ? dateLabel(selectedCoupon.validTill || selectedCoupon.expiresAt || selectedCoupon.expiry) : 'No expiry')}<br>
                        Created: ${escapeHtml(selectedCoupon.createdAt ? dateLabel(selectedCoupon.createdAt) : '—')}
                      </p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Owner</p>
                      <p class="admin-list__item-sub">
                        ${escapeHtml(selectedCoupon.owner || (getCouponTypeValue(selectedCoupon) === 'influencer' ? 'Influencer' : 'General'))}
                      </p>
                    </div>
                  </div>
                ` : '<p class="admin-table__muted">No coupon selected.</p>'}
              </div>
              <div class="admin-card__foot">
                <div class="admin-footer-actions">
                  <button class="admin-btn admin-btn--ghost" type="button" data-action="edit-coupon" data-id="${selectedCoupon?.id || ''}">Edit</button>
                  <button class="admin-btn admin-btn--soft" type="button" data-action="open-coupon-modal">Create New</button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function renderInfluencers() {
    const query = state.influencersSearch.trim().toLowerCase();
    const filtered = state.influencers.filter((influencer) =>
      !query ||
      [influencer.name, influencer.handle, influencer.email, influencer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    const selectedInfluencer = getInfluencerById(state.selectedInfluencerId) || filtered[0] || state.influencers[0] || null;
    if (selectedInfluencer) state.selectedInfluencerId = selectedInfluencer.id;

    const visibleInfluencers = filtered;
    const statsSource = filtered.length ? filtered : state.influencers;
    const totalRevenue = statsSource.reduce((sum, influencer) => sum + Number(influencer.revenue || 0), 0);
    const totalOrders = statsSource.reduce((sum, influencer) => sum + Number(influencer.totalOrders || 0), 0);
    const totalCoupons = statsSource.reduce((sum, influencer) => sum + Number(influencer.couponUsage || 0), 0);

    els.influencersView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Influencer Management</h2>
            <p class="admin-section__desc">Add, edit, deactivate, and assign coupons to campaign partners from one workspace.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-grid admin-grid--stats">
            <article class="admin-stat">
              <div class="admin-stat__top">
                <div>
                  <p class="admin-stat__label">Influencers</p>
                  <p class="admin-stat__value">${formatCount(visibleInfluencers.length)}</p>
                </div>
              </div>
              <p class="admin-stat__note">Active and inactive partners in the current view.</p>
            </article>
            <article class="admin-stat">
              <div class="admin-stat__top">
                <div>
                  <p class="admin-stat__label">Total Orders</p>
                  <p class="admin-stat__value">${formatCount(totalOrders)}</p>
                </div>
              </div>
              <p class="admin-stat__note">Orders attributed to influencer campaigns.</p>
            </article>
            <article class="admin-stat">
              <div class="admin-stat__top">
                <div>
                  <p class="admin-stat__label">Revenue Generated</p>
                  <p class="admin-stat__value">${money(totalRevenue)}</p>
                </div>
              </div>
              <p class="admin-stat__note">Gross merch revenue linked to partners.</p>
            </article>
            <article class="admin-stat">
              <div class="admin-stat__top">
                <div>
                  <p class="admin-stat__label">Coupon Usage</p>
                  <p class="admin-stat__value">${formatCount(totalCoupons)}</p>
                </div>
              </div>
              <p class="admin-stat__note">Redemptions tracked across assigned codes.</p>
            </article>
          </div>

          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="influencersSearch" value="${escapeHtml(state.influencersSearch)}" placeholder="Search by name, handle, email, or phone" />
            </div>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-influencer-modal">Add Influencer</button>
          </div>

          <div class="admin-card-grid admin-card-grid--2">
            ${visibleInfluencers.length ? visibleInfluencers.map((influencer) => `
              <article class="admin-card" data-action="select-influencer" data-id="${influencer.id}" style="cursor:pointer;">
                <div class="admin-card__head">
                  <div class="admin-list__item-head">
                    <div>
                      <h3 class="admin-card__title">${escapeHtml(influencer.name)}</h3>
                      <p class="admin-card__sub">${escapeHtml(influencer.handle)}</p>
                    </div>
                    <span class="admin-badge ${influencer.active ? 'admin-badge--active' : 'admin-badge--inactive'}">${influencer.active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
                <div class="admin-card__body">
                  <div class="admin-list" style="gap:10px;">
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Email</p>
                      <p class="admin-list__item-sub">${escapeHtml(influencer.email || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Phone</p>
                      <p class="admin-list__item-sub">${escapeHtml(influencer.phone || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Assigned Coupons</p>
                      <div class="admin-chip-row">${renderCouponChips(influencer.coupons)}</div>
                    </div>
                  </div>
                  <div class="admin-grid admin-grid--stats" style="grid-template-columns:repeat(4,minmax(0,1fr));margin-top:14px;">
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Orders</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(influencer.totalOrders)}</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Revenue</p>
                      <p class="admin-stat__value" style="font-size:20px;">${money(influencer.revenue)}</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Coupon Use</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(influencer.couponUsage)}</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Campaigns</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(influencer.activeCampaigns)}</p>
                    </article>
                  </div>
                  <div class="admin-actions" style="margin-top:12px;">
                    <button class="admin-action-link" type="button" data-action="edit-influencer" data-id="${influencer.id}">Edit Influencer</button>
                    <button class="admin-action-link" type="button" data-action="toggle-influencer" data-id="${influencer.id}">${influencer.active ? 'Deactivate Influencer' : 'Reactivate Influencer'}</button>
                    <button class="admin-action-link" type="button" data-action="assign-coupon" data-id="${influencer.id}">Assign Coupons</button>
                  </div>
                </div>
              </article>
            `).join('') : `
              <div class="admin-card" style="grid-column:1/-1;">
                <div class="admin-card__body">
                  ${renderEmptyState('No influencers found', 'Try a different search term or add a new influencer to start managing campaigns.')}
                </div>
              </div>
            `}
          </div>

          <div class="admin-grid admin-grid--two" style="margin-top:18px;">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Influencer Profile</h3>
                <p class="admin-card__sub">Full partner profile and coupon summary</p>
              </div>
              <div class="admin-card__body">
                ${selectedInfluencer ? `
                  <div class="admin-list">
                    <div class="admin-list__item">
                      <div class="admin-list__item-head">
                        <div>
                          <p class="admin-list__item-title">${escapeHtml(selectedInfluencer.name)}</p>
                          <p class="admin-list__item-sub">${escapeHtml(selectedInfluencer.handle)}</p>
                        </div>
                        <span class="admin-avatar">${escapeHtml(initials(selectedInfluencer.name))}</span>
                      </div>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Name</p>
                      <p class="admin-list__item-sub">${escapeHtml(selectedInfluencer.name || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Social Handle</p>
                      <p class="admin-list__item-sub">${escapeHtml(selectedInfluencer.handle || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Email</p>
                      <p class="admin-list__item-sub">${escapeHtml(selectedInfluencer.email || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Phone</p>
                      <p class="admin-list__item-sub">${escapeHtml(selectedInfluencer.phone || 'Not added yet')}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Assigned Coupons</p>
                      <div class="admin-chip-row">${renderCouponChips(selectedInfluencer.coupons)}</div>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Total Orders</p>
                      <p class="admin-list__item-sub">${formatCount(selectedInfluencer.totalOrders)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Revenue Generated</p>
                      <p class="admin-list__item-sub">${money(selectedInfluencer.revenue)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Coupon Usage</p>
                      <p class="admin-list__item-sub">${formatCount(selectedInfluencer.couponUsage)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Active Campaigns</p>
                      <p class="admin-list__item-sub">${formatCount(selectedInfluencer.activeCampaigns)}</p>
                    </div>
                  </div>
                ` : '<p class="admin-table__muted">No influencer selected.</p>'}
              </div>
              <div class="admin-card__foot">
                <div class="admin-footer-actions">
                  <button class="admin-btn admin-btn--soft" type="button" data-action="assign-coupon" data-id="${selectedInfluencer?.id || ''}">Assign Coupons</button>
                  <button class="admin-btn admin-btn--ghost" type="button" data-action="edit-influencer" data-id="${selectedInfluencer?.id || ''}">Edit Influencer</button>
                </div>
              </div>
            </section>
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Performance Snapshot</h3>
                <p class="admin-card__sub">Selected influencer activity at a glance</p>
              </div>
              <div class="admin-card__body">
                ${selectedInfluencer ? `
                  <div class="admin-mini-chart">
                    ${renderMiniChart([
                      { label: 'Orders', value: Math.min(100, Number(selectedInfluencer.totalOrders || 0)), display: formatCount(selectedInfluencer.totalOrders) },
                      { label: 'Revenue', value: Math.min(100, Math.round(Number(selectedInfluencer.revenue || 0) / 100000)), display: money(selectedInfluencer.revenue) },
                      { label: 'Coupon Usage', value: Math.min(100, Number(selectedInfluencer.couponUsage || 0)), display: formatCount(selectedInfluencer.couponUsage) },
                      { label: 'Campaigns', value: Math.min(100, Number(selectedInfluencer.activeCampaigns || 0) * 20), display: `${formatCount(selectedInfluencer.activeCampaigns)} active` },
                    ])}
                  </div>
                ` : '<p class="admin-table__muted" style="margin:0;">Select an influencer to inspect their performance snapshot.</p>'}
              </div>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function renderReports() {
    if (!state.orders.length && !state.products.length) {
      els.reportsView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Reports</h2>
              <p class="admin-section__desc">Reports are waiting on live data sources.</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('No report data yet', 'Connect sales, order, and customer APIs before exporting CSV, Excel, or PDF reports.')}
          </div>
        </section>
      `;
      return;
    }

    const reportTiles = [
      { title: 'Sales Report', meta: 'Orders, revenue, averages, and top sellers' },
      { title: 'Orders Report', meta: 'Fulfillment stages and channel breakdown' },
      { title: 'Products Report', meta: 'Stock health and performance by SKU' },
      { title: 'Customers Report', meta: 'LTV, repeat rate, and cohorts' },
      { title: 'Coupons Report', meta: 'Usage, expiry, and owner split' },
      { title: 'Influencer Report', meta: 'Campaign performance and revenue contribution' },
      { title: 'Revenue Report', meta: 'Payment capture and return impact' },
    ];

    els.reportsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Reports</h2>
            <p class="admin-section__desc">Filter by date and export CSV, Excel, or PDF placeholder reports.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <div class="admin-toolbar__group">
              <input class="admin-input" type="date" data-input="reportFrom" value="${escapeHtml(state.reportFrom)}" />
              <input class="admin-input" type="date" data-input="reportTo" value="${escapeHtml(state.reportTo)}" />
              <select class="admin-select" data-input="reportFormat">
                <option value="csv" ${state.reportFormat === 'csv' ? 'selected' : ''}>CSV</option>
                <option value="excel" ${state.reportFormat === 'excel' ? 'selected' : ''}>Excel</option>
                <option value="pdf" ${state.reportFormat === 'pdf' ? 'selected' : ''}>PDF</option>
              </select>
            </div>
            <div class="admin-toolbar__group">
              <button class="admin-btn admin-btn--ghost" type="button" data-action="export-report" data-format="csv">Export CSV</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="export-report" data-format="excel">Export Excel</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="export-report" data-format="pdf">Export PDF</button>
            </div>
          </div>

          <div class="admin-report-grid">
            ${reportTiles.map((tile) => `
              <article class="admin-report-card">
                <h3 class="admin-report-card__title">${escapeHtml(tile.title)}</h3>
                <p class="admin-report-card__meta">${escapeHtml(tile.meta)}</p>
              </article>
            `).join('')}
          </div>

          <div class="admin-card-grid admin-card-grid--2" style="margin-top:18px;">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Revenue Report</h3>
                <p class="admin-card__sub">Date-filtered summary placeholder</p>
              </div>
              <div class="admin-card__body admin-mini-chart">
                ${renderMiniChart([
                  { label: 'Orders', value: 72, display: '72' },
                  { label: 'Revenue', value: 90, display: money(4280900) },
                  { label: 'Refunds', value: 14, display: money(199900) },
                  { label: 'Net', value: 84, display: money(4081000) },
                ])}
              </div>
            </section>

            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Order Status Distribution</h3>
                <p class="admin-card__sub">Filtered by selected date range</p>
              </div>
              <div class="admin-card__body" style="display:grid;place-items:center;gap:14px;">
                <div class="admin-chart-ring">
                  <span>
                    <strong>${state.orders.length}</strong>
                    <small>Orders</small>
                  </span>
                </div>
                <div class="admin-chip-row">
                  <span class="admin-chip">Pending 18%</span>
                  <span class="admin-chip">Processing 28%</span>
                  <span class="admin-chip">Shipped 22%</span>
                  <span class="admin-chip">Delivered 24%</span>
                  <span class="admin-chip">Cancelled 8%</span>
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    `;
  }

  function renderSettings() {
    const s = state.settings;
    els.settingsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Settings</h2>
            <p class="admin-section__desc">Store setup, gateway configuration, email templates, and admin permissions.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <form class="admin-form" data-form="settings">
            <div class="admin-card-grid admin-card-grid--2">
              <article class="admin-card">
                <div class="admin-card__head">
                  <h3 class="admin-card__title">Store Settings</h3>
                  <p class="admin-card__sub">Core storefront details</p>
                </div>
                <div class="admin-card__body admin-form">
                  <label class="admin-field"><span>Store Name</span><input class="admin-input" name="storeName" value="${escapeHtml(s.storeName)}" /></label>
                  <label class="admin-field"><span>Support Email</span><input class="admin-input" name="supportEmail" value="${escapeHtml(s.supportEmail)}" /></label>
                  <label class="admin-field"><span>Support Phone</span><input class="admin-input" name="supportPhone" value="${escapeHtml(s.supportPhone)}" /></label>
                  <label class="admin-field"><span>Shipping Charges</span><input class="admin-input" name="shippingCharges" value="${escapeHtml(s.shippingCharges)}" /></label>
                  <label class="admin-field admin-field--wide"><span>Return Policy</span><textarea class="admin-textarea" name="returnPolicy">${escapeHtml(s.returnPolicy)}</textarea></label>
                  <label class="admin-field admin-field--wide"><span>Tax Settings</span><textarea class="admin-textarea" name="taxSettings">${escapeHtml(s.taxSettings)}</textarea></label>
                </div>
              </article>

              <article class="admin-card">
                <div class="admin-card__head">
                  <h3 class="admin-card__title">Payments and Email</h3>
                  <p class="admin-card__sub">Gateway, notifications, and template text</p>
                </div>
                <div class="admin-card__body admin-form">
                  <label class="admin-field"><span>Payment Gateway</span><input class="admin-input" name="paymentGateway" value="${escapeHtml(s.paymentGateway)}" /></label>
                  <label class="admin-field admin-field--wide"><span>Email Templates</span><textarea class="admin-textarea" name="emailTemplates">${escapeHtml(s.emailTemplates)}</textarea></label>
                  <label class="admin-field admin-field--wide"><span>Admin Users</span><textarea class="admin-textarea" name="adminUsers">${escapeHtml(s.adminUsers)}</textarea></label>
                  <label class="admin-field admin-field--wide"><span>Permissions</span><textarea class="admin-textarea" name="permissions">${escapeHtml(s.permissions)}</textarea></label>
                  <label class="admin-field admin-field--wide"><span>Notifications</span><textarea class="admin-textarea" name="notifications">${escapeHtml(s.notifications)}</textarea></label>
                </div>
              </article>
            </div>

            <div class="admin-footer-actions">
              <button class="admin-btn admin-btn--ghost" type="reset">Reset</button>
              <button class="admin-btn admin-btn--primary" type="submit">Save Settings</button>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  function renderNotifications() {
    els.notificationsList.innerHTML = state.notifications
      .map(
        (item) => `
          <div class="admin-list__item">
            <div class="admin-list__item-head">
              <div>
                <p class="admin-list__item-title">${escapeHtml(item.title)}</p>
                <p class="admin-list__item-sub">${escapeHtml(item.message)}</p>
              </div>
              <span class="admin-badge ${statusClass(item.type)}">${escapeHtml(item.type)}</span>
            </div>
            <p class="admin-table__muted">${escapeHtml(timeLabel(item.time))}</p>
          </div>
        `
      )
      .join('');
  }

  function renderProfileModal() {
    openModal({
      title: 'Admin Profile',
      subtitle: 'Admin access and session shortcuts',
      body: `
        <div class="admin-list">
          <div class="admin-list__item">
            <div class="admin-list__item-head">
              <div>
                <p class="admin-list__item-title">Admin House</p>
                <p class="admin-list__item-sub">admin@h2health.local</p>
              </div>
              <span class="admin-avatar">${escapeHtml(initials('Admin House'))}</span>
            </div>
          </div>
          <div class="admin-list__item">
            <p class="admin-list__item-title">Role</p>
            <p class="admin-list__item-sub">Store administrator</p>
          </div>
          <div class="admin-list__item">
            <p class="admin-list__item-title">Quick Actions</p>
            <div class="admin-actions">
              <button class="admin-action-link" type="button" data-action="change-password">Change Password</button>
              <button class="admin-action-link" type="button" data-action="logout">Logout</button>
            </div>
          </div>
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button>
      `,
      size: 'sm',
    });
  }

  function renderEntityFormModal(type, entity = null) {
    const config = {
      product: {
        title: entity ? 'Edit Product' : 'Add Product',
        subtitle: 'Products',
        fields: `
          <label class="admin-field"><span>Product Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
          <label class="admin-field"><span>SKU</span><input class="admin-input" name="sku" value="${escapeHtml(entity?.sku || '')}" required /></label>
          <label class="admin-field"><span>Category</span>
            <select class="admin-select" name="categoryId">
              ${state.categories.map((category) => `<option value="${category.id}" ${Number(entity?.categoryId) === Number(category.id) ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field"><span>Price (paise)</span><input class="admin-input" name="price" type="number" min="0" value="${escapeHtml(entity?.price || 0)}" required /></label>
          <label class="admin-field"><span>Stock</span><input class="admin-input" name="stock" type="number" min="0" value="${escapeHtml(entity?.stock || 0)}" required /></label>
          <label class="admin-field"><span>Status</span>
            <select class="admin-select" name="status">
              ${['published', 'draft', 'archived'].map((status) => `<option value="${status}" ${String(entity?.status || 'draft') === status ? 'selected' : ''}>${getStatusLabel(status)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field admin-field--wide"><span>Image URL</span><input class="admin-input" name="image" value="${escapeHtml(entity?.image || '')}" /></label>
          <label class="admin-field admin-field--wide"><span>Description</span><textarea class="admin-textarea" name="description">${escapeHtml(entity?.description || '')}</textarea></label>
          <label class="admin-check"><input type="checkbox" name="featured" ${entity?.featured ? 'checked' : ''} /><span>Featured product</span></label>
          <label class="admin-check"><input type="checkbox" name="archived" ${entity?.archived ? 'checked' : ''} /><span>Archived</span></label>
        `,
      },
      category: {
        title: entity ? 'Edit Category' : 'Add Category',
        subtitle: 'Categories',
        fields: `
          <label class="admin-field"><span>Category Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
          <label class="admin-field"><span>Slug</span><input class="admin-input" name="slug" value="${escapeHtml(entity?.slug || '')}" required /></label>
          <label class="admin-field"><span>Product Count</span><input class="admin-input" name="productCount" type="number" min="0" value="${escapeHtml(entity?.productCount || 0)}" /></label>
          <label class="admin-check"><input type="checkbox" name="active" ${entity?.active !== false ? 'checked' : ''} /><span>Active category</span></label>
          <label class="admin-field admin-field--wide"><span>Description</span><textarea class="admin-textarea" name="description">${escapeHtml(entity?.description || '')}</textarea></label>
        `,
      },
      coupon: {
        title: entity ? 'Edit Coupon' : 'Create Coupon',
        subtitle: 'Coupons',
        fields: `
          <label class="admin-field"><span>Coupon Code</span><input class="admin-input" name="code" value="${escapeHtml(entity?.code || '')}" required /></label>
          <label class="admin-field"><span>Campaign / Offer Name</span><input class="admin-input" name="festivalName" value="${escapeHtml(entity?.festivalName || '')}" placeholder="Seasonal, Festival, First Purchase" /></label>
          <label class="admin-field"><span>Description</span><input class="admin-input" name="description" value="${escapeHtml(entity?.description || '')}" placeholder="Coupon notes or offer details" /></label>
          <label class="admin-field"><span>Discount</span><input class="admin-input" name="discount" value="${escapeHtml(entity?.discount || '')}" required /></label>
          <label class="admin-field"><span>Usage Count</span><input class="admin-input" name="usageCount" type="number" min="0" value="${escapeHtml(entity?.usageCount || 0)}" /></label>
          <label class="admin-field"><span>Session Limit</span><input class="admin-input" name="sessionLimit" type="number" min="1" value="${escapeHtml(entity?.sessionLimit || 1)}" /></label>
          <label class="admin-field"><span>Expiry</span><input class="admin-input" name="expiry" type="date" value="${escapeHtml(entity?.expiry || toISODate(today))}" /></label>
          <label class="admin-field"><span>Coupon Type</span>
            <select class="admin-select" name="couponType">
              <option value="general" ${getCouponTypeValue(entity) === 'general' ? 'selected' : ''}>General Coupon</option>
              <option value="influencer" ${getCouponTypeValue(entity) === 'influencer' ? 'selected' : ''}>Influencer Coupon</option>
            </select>
          </label>
          <label class="admin-field"><span>Coupon Owner</span><input class="admin-input" name="recipientName" value="${escapeHtml(entity?.recipientName || entity?.owner || '')}" placeholder="General or influencer name" /></label>
          <label class="admin-field"><span>Owner Email</span><input class="admin-input" name="recipientEmail" type="email" value="${escapeHtml(entity?.recipientEmail || '')}" placeholder="Optional for assigned coupons" /></label>
          <label class="admin-field"><span>Applies To</span>
            <select class="admin-select" name="appliesTo">
              <option value="merch" ${String(entity?.appliesTo || 'merch') === 'merch' ? 'selected' : ''}>Merch</option>
              <option value="all" ${String(entity?.appliesTo) === 'all' ? 'selected' : ''}>All</option>
            </select>
          </label>
          <label class="admin-check"><input type="checkbox" name="status" ${String(entity?.status || 'active') === 'active' ? 'checked' : ''} /><span>Active</span></label>
        `,
      },
      influencer: {
        title: entity ? 'Edit Influencer' : 'Add Influencer',
        subtitle: 'Influencers',
        fields: `
          <label class="admin-field"><span>Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
          <label class="admin-field"><span>Social Handle</span><input class="admin-input" name="handle" value="${escapeHtml(entity?.handle || '')}" required /></label>
          <label class="admin-field"><span>Email</span><input class="admin-input" name="email" value="${escapeHtml(entity?.email || '')}" /></label>
          <label class="admin-field"><span>Phone</span><input class="admin-input" name="phone" value="${escapeHtml(entity?.phone || '')}" /></label>
          <label class="admin-field admin-field--wide"><span>Assigned Coupons</span><input class="admin-input" name="coupons" value="${escapeHtml((entity?.coupons || []).join(', '))}" placeholder="CODE1, CODE2" /></label>
          <label class="admin-field"><span>Total Orders</span><input class="admin-input" name="totalOrders" type="number" min="0" value="${escapeHtml(entity?.totalOrders || 0)}" /></label>
          <label class="admin-field"><span>Revenue Generated</span><input class="admin-input" name="revenue" type="number" min="0" value="${escapeHtml(entity?.revenue || 0)}" /></label>
          <label class="admin-field"><span>Coupon Usage</span><input class="admin-input" name="couponUsage" type="number" min="0" value="${escapeHtml(entity?.couponUsage || 0)}" /></label>
          <label class="admin-field"><span>Active Campaigns</span><input class="admin-input" name="activeCampaigns" type="number" min="0" value="${escapeHtml(entity?.activeCampaigns || 0)}" /></label>
          <label class="admin-check"><input type="checkbox" name="active" ${entity?.active !== false ? 'checked' : ''} /><span>Active influencer</span></label>
        `,
      },
    };

    const selected = config[type];
    if (!selected) return;

    openModal({
      title: selected.title,
      subtitle: selected.subtitle,
      body: `
        <form class="admin-form" data-entity-form="${escapeHtml(type)}" data-entity-id="${escapeHtml(entity?.id || '')}">
          <div class="admin-form__grid">
            ${selected.fields}
          </div>
        </form>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn admin-btn--primary" type="submit" form="entityFormSubmit">Save</button>
      `,
      size: 'lg',
    });

    const form = els.adminModalDialog.querySelector(`[data-entity-form="${type}"]`);
    if (form) form.id = 'entityFormSubmit';
  }

  function renderInfluencerAssignmentModal(influencer) {
    if (!influencer) return;
    const availableCoupons = Array.isArray(state.coupons)
      ? state.coupons
          .map((coupon) => String(coupon.code || '').trim().toUpperCase())
          .filter(Boolean)
      : [];

    openModal({
      title: `Assign Coupons to ${influencer.name}`,
      subtitle: 'Influencers',
      body: `
        <form class="admin-form" data-form="influencer-coupons" data-influencer-id="${escapeHtml(influencer.id)}">
          <div class="admin-form__grid">
            <label class="admin-field admin-field--wide">
              <span>Assigned Coupons</span>
              <textarea class="admin-textarea" name="coupons" rows="4" placeholder="Enter coupon codes separated by commas or new lines">${escapeHtml((influencer.coupons || []).join(', '))}</textarea>
            </label>
            <label class="admin-field admin-field--wide">
              <span>Available Coupon Codes</span>
              <input class="admin-input" type="text" value="${escapeHtml(availableCoupons.length ? availableCoupons.join(', ') : 'No coupons synced yet')}" readonly />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Campaign Notes</span>
              <textarea class="admin-textarea" name="notes" rows="2" placeholder="Optional campaign note">${escapeHtml(influencer.notes || '')}</textarea>
            </label>
          </div>
        </form>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn admin-btn--primary" type="submit" form="influencerCouponForm">Save Assignment</button>
      `,
      size: 'lg',
    });

    const form = els.adminModalDialog.querySelector('[data-form="influencer-coupons"]');
    if (form) form.id = 'influencerCouponForm';
  }

  function updateInfluencerCouponsFromForm(form) {
    const influencerId = Number(form.dataset.influencerId || 0);
    const influencer = getInfluencerById(influencerId);
    if (!influencer) {
      toast('Influencer not found', 'The selected influencer could not be updated.', 'warning');
      return;
    }

    const coupons = normalizeCouponCodes(form.querySelector('[name="coupons"]')?.value);
    const notes = String(form.querySelector('[name="notes"]')?.value || '').trim();
    influencer.coupons = coupons;
    influencer.notes = notes;

    const couponSet = new Set(coupons);
    state.coupons = state.coupons.map((coupon) => {
      const code = String(coupon.code || '').trim().toUpperCase();
      if (!couponSet.has(code)) return coupon;
      return {
        ...coupon,
        couponType: 'private',
        ownerType: 'influencer',
        owner: influencer.name,
        recipientName: influencer.name,
        recipientEmail: influencer.email || coupon.recipientEmail || '',
      };
    });

    toast('Coupons assigned', `${influencer.name} now has ${coupons.length} coupon${coupons.length === 1 ? '' : 's'} assigned.`, 'success');
    closeModal();
    renderAll();
  }

  function updateProductFromForm(form, existing = null) {
    const fd = new FormData(form);
    const categoryId = Number(fd.get('categoryId'));
    const category = state.categories.find((item) => Number(item.id) === categoryId);
    const product = {
      id: existing?.id || Number(uniqueId('prod').replace(/\D/g, '').slice(0, 6)),
      name: String(fd.get('name') || '').trim(),
      sku: String(fd.get('sku') || '').trim(),
      categoryId,
      category: category?.name || 'Uncategorized',
      price: Number(fd.get('price') || 0),
      priceLabel: existing?.priceLabel || money(Number(fd.get('price') || 0)),
      stock: Number(fd.get('stock') || 0),
      status: String(fd.get('status') || 'draft'),
      createdAt: existing?.createdAt || toISODate(today),
      sales: Number(existing?.sales || 0),
      lowStockThreshold: Number(existing?.lowStockThreshold || 10),
      featured: fd.get('featured') === 'on',
      archived: fd.get('archived') === 'on' || String(fd.get('status')) === 'archived',
      image: String(fd.get('image') || '').trim() || '/cdn/shop/files/H2_Logo9664.png?v=1767874858&width=120',
      description: String(fd.get('description') || '').trim(),
    };
    return product;
  }

  function updateCategoryFromForm(form, existing = null) {
    const fd = new FormData(form);
    return {
      id: existing?.id || Date.now(),
      name: String(fd.get('name') || '').trim(),
      slug: String(fd.get('slug') || slugify(fd.get('name'))),
      productCount: Number(fd.get('productCount') || 0),
      active: fd.get('active') === 'on',
      description: String(fd.get('description') || '').trim(),
    };
  }

  function updateCouponFromForm(form, existing = null) {
    const fd = new FormData(form);
    const couponType = String(fd.get('couponType') || existing?.couponType || existing?.ownerType || 'general').trim().toLowerCase() === 'influencer'
      ? 'private'
      : 'public';
    return {
      id: existing?.id || Date.now(),
      code: String(fd.get('code') || '').trim().toUpperCase(),
      description: String(fd.get('description') || '').trim(),
      discount: String(fd.get('discount') || '').trim(),
      usageCount: Number(fd.get('usageCount') || 0),
      sessionLimit: Number(fd.get('sessionLimit') || 1),
      expiry: String(fd.get('expiry') || toISODate(today)),
      status: fd.get('status') === 'on' ? 'active' : 'inactive',
      couponType,
      ownerType: couponType === 'private' ? 'influencer' : 'general',
      appliesTo: String(fd.get('appliesTo') || 'merch').trim().toLowerCase() === 'all' ? 'all' : 'merch',
      owner: String(fd.get('recipientName') || '').trim() || (couponType === 'private' ? 'Influencer' : 'General'),
      recipientName: String(fd.get('recipientName') || '').trim(),
      recipientEmail: String(fd.get('recipientEmail') || '').trim().toLowerCase(),
      festivalName: String(fd.get('festivalName') || '').trim(),
    };
  }

  function updateInfluencerFromForm(form, existing = null) {
    const fd = new FormData(form);
    return {
      id: existing?.id || Date.now(),
      name: String(fd.get('name') || '').trim(),
      handle: String(fd.get('handle') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      coupons: String(fd.get('coupons') || '')
        .split(',')
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean),
      totalOrders: Number(fd.get('totalOrders') || 0),
      revenue: Number(fd.get('revenue') || 0),
      couponUsage: Number(fd.get('couponUsage') || 0),
      activeCampaigns: Number(fd.get('activeCampaigns') || 0),
      active: fd.get('active') === 'on',
    };
  }

  function updateSettingsFromForm(form) {
    const fd = new FormData(form);
    state.settings = {
      storeName: String(fd.get('storeName') || '').trim(),
      supportEmail: String(fd.get('supportEmail') || '').trim(),
      supportPhone: String(fd.get('supportPhone') || '').trim(),
      shippingCharges: String(fd.get('shippingCharges') || '').trim(),
      returnPolicy: String(fd.get('returnPolicy') || '').trim(),
      taxSettings: String(fd.get('taxSettings') || '').trim(),
      paymentGateway: String(fd.get('paymentGateway') || '').trim(),
      emailTemplates: String(fd.get('emailTemplates') || '').trim(),
      adminUsers: String(fd.get('adminUsers') || '').trim(),
      permissions: String(fd.get('permissions') || '').trim(),
      notifications: String(fd.get('notifications') || '').trim(),
    };
    toast('Settings saved', 'The placeholder settings have been updated.', 'success');
    renderAll();
  }

  async function loadCouponData() {
    state.couponsLoading = true;
    renderCoupons();
    try {
      const result = await apiRequest('/api/admin/coupons');
      state.coupons = Array.isArray(result.coupons) ? result.coupons : [];
    } catch (error) {
      state.coupons = [];
      toast('Coupons unavailable', error.message || 'Unable to load coupons from the shared admin API.', 'warning');
    } finally {
      state.couponsLoading = false;
      renderCoupons();
    }
  }

  function advanceOrderStatus(order, direction = 'next') {
    const flow = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = flow.indexOf(order.status);
    const nextIndex = Math.min(flow.length - 1, Math.max(0, currentIndex + (direction === 'next' ? 1 : 0)));
    const nextStatus = flow[nextIndex];
    if (order.status === 'cancelled' || order.status === 'returned') {
      toast('Order locked', 'Cancelled or returned orders cannot advance further.', 'warning');
      return;
    }
    if (nextStatus === order.status) {
      toast('No status change', 'This order is already at the final fulfillment step.', 'warning');
      return;
    }
    order.status = nextStatus;
    if (nextStatus === 'shipped' && !order.trackingNumber) {
      order.trackingNumber = `TRK-${Math.floor(10000 + Math.random() * 90000)}-HM`;
      order.carrier = order.carrier || 'Shiprocket';
    }
    order.timeline.unshift({
      label: getStatusLabel(nextStatus),
      note: 'Updated from admin dashboard placeholder action',
      time: `${toISODate(today)}T${pad(today.getHours())}:${pad(today.getMinutes())}:00`,
    });
    toast('Order updated', `${order.orderNumber} moved to ${getStatusLabel(nextStatus)}.`, 'success');
    renderAll();
  }

  function cancelOrder(order) {
    order.status = 'cancelled';
    order.paymentStatus = 'refunded';
    order.timeline.unshift({
      label: 'Cancelled',
      note: 'Admin cancelled this order from the dashboard',
      time: `${toISODate(today)}T${pad(today.getHours())}:${pad(today.getMinutes())}:00`,
    });
    toast('Order cancelled', `${order.orderNumber} has been marked cancelled.`, 'warning');
    renderAll();
  }

  function refundOrder(order) {
    order.paymentStatus = 'refunded';
    order.timeline.unshift({
      label: 'Refunded',
      note: 'Refund action recorded in the placeholder UI',
      time: `${toISODate(today)}T${pad(today.getHours())}:${pad(today.getMinutes())}:00`,
    });
    toast('Refund recorded', `${order.orderNumber} has been flagged for refund.`, 'success');
    renderAll();
  }

  function selectedProductsOnPage() {
    const visible = filterProducts().slice((state.productsPage - 1) * 5, (state.productsPage - 1) * 5 + 5);
    return visible.filter((item) => state.selectedProductIds.includes(item.id));
  }

  function renderAll() {
    els.pageTitle.textContent = SECTION_TITLES[state.view] || 'Dashboard';
    if (els.profileAvatar) els.profileAvatar.textContent = initials('Admin House');

    document.querySelectorAll('.admin-nav__item').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.navView === state.view);
    });

    document.querySelectorAll('.admin-view').forEach((view) => {
      view.classList.toggle('is-active', view.dataset.view === state.view);
    });

    renderDashboard();
    renderProducts();
    renderCategories();
    renderOrders();
    renderCustomers();
    renderCoupons();
    renderInfluencers();
    renderReports();
    renderSettings();
    renderNotifications();
  }

  async function handleAction(action, target) {
    const id = Number(target?.dataset?.id || target?.closest?.('[data-id]')?.dataset?.id || 0);
    const product = state.products.find((item) => Number(item.id) === id);
    const category = state.categories.find((item) => Number(item.id) === id);
    const order = state.orders.find((item) => Number(item.id) === id);
    const customer = state.customers.find((item) => Number(item.id) === id);
    const coupon = state.coupons.find((item) => Number(item.id) === id);
    const influencer = state.influencers.find((item) => Number(item.id) === id);

    switch (action) {
      case 'open-notifications':
        setNotificationsOpen(true);
        return;
      case 'close-notifications':
        setNotificationsOpen(false);
        return;
      case 'open-profile':
        renderProfileModal();
        return;
      case 'close-modal':
        closeModal();
        return;
      case 'logout':
  closeModal();

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
  } catch (err) {
    console.error(err);
  }

  try {
    localStorage.removeItem('booking_portal_auth_token');
  } catch {}

  toast('Logged out', 'Redirecting to login...', 'success');

  window.setTimeout(() => {
    window.location.replace('/merch/auth.html');
  }, 500);

  return;
      case 'change-password':
        toast('Placeholder', 'Password reset flow can be wired to the auth API later.', 'default');
        return;
      case 'open-product-modal':
        renderEntityFormModal('product');
        return;
      case 'edit-product':
        renderEntityFormModal('product', product);
        return;
      case 'duplicate-product':
        if (product) {
          const duplicate = { ...product, id: Date.now(), name: `${product.name} Copy`, sku: `${product.sku}-COPY`, createdAt: toISODate(today) };
          state.products.unshift(duplicate);
          state.selectedProductIds = [];
          toast('Product duplicated', `${product.name} was copied to the catalog.`, 'success');
          renderAll();
        }
        return;
      case 'archive-product':
        if (product) {
          product.archived = !product.archived;
          product.status = product.archived ? 'archived' : 'published';
          toast('Product updated', `${product.name} is now ${product.archived ? 'archived' : 'active'}.`, 'warning');
          renderAll();
        }
        return;
      case 'delete-product':
        if (product) {
          openConfirmModal({
            title: 'Delete product',
            message: `Delete ${product.name}? This placeholder action removes the item from the in-memory catalog.`,
            confirmLabel: 'Delete',
            onConfirm: () => {
              state.products = state.products.filter((item) => Number(item.id) !== id);
              state.selectedProductIds = state.selectedProductIds.filter((itemId) => itemId !== id);
              toast('Product deleted', `${product.name} has been removed.`, 'danger');
              renderAll();
            },
          });
        }
        return;
      case 'bulk-duplicate':
        selectedProductsOnPage().forEach((item) => {
          state.products.unshift({ ...item, id: Date.now() + Math.floor(Math.random() * 1000), name: `${item.name} Copy`, sku: `${item.sku}-COPY`, createdAt: toISODate(today) });
        });
        state.selectedProductIds = [];
        toast('Bulk duplicate complete', 'Selected products were copied.', 'success');
        renderAll();
        return;
      case 'bulk-archive':
        selectedProductsOnPage().forEach((item) => {
          item.archived = true;
          item.status = 'archived';
        });
        state.selectedProductIds = [];
        toast('Bulk archive complete', 'Selected products were archived.', 'warning');
        renderAll();
        return;
      case 'bulk-delete':
        openConfirmModal({
          title: 'Delete selected products',
          message: 'Remove all selected products from this mock catalog?',
          confirmLabel: 'Delete',
          onConfirm: () => {
            const ids = new Set(state.selectedProductIds);
            state.products = state.products.filter((item) => !ids.has(item.id));
            state.selectedProductIds = [];
            toast('Bulk delete complete', 'Selected products were removed.', 'danger');
            renderAll();
          },
        });
        return;
      case 'toggle-product-selection':
        if (target.checked) {
          if (!state.selectedProductIds.includes(id)) state.selectedProductIds.push(id);
        } else {
          state.selectedProductIds = state.selectedProductIds.filter((itemId) => itemId !== id);
        }
        renderProducts();
        return;
      case 'toggle-product-page-selection': {
        const visible = filterProducts().slice((state.productsPage - 1) * 5, (state.productsPage - 1) * 5 + 5);
        const allSelected = visible.every((item) => state.selectedProductIds.includes(item.id));
        if (allSelected) {
          state.selectedProductIds = state.selectedProductIds.filter((itemId) => !visible.some((item) => item.id === itemId));
        } else {
          visible.forEach((item) => {
            if (!state.selectedProductIds.includes(item.id)) state.selectedProductIds.push(item.id);
          });
        }
        renderProducts();
        return;
      }
      case 'products-prev':
        state.productsPage = Math.max(1, state.productsPage - 1);
        renderProducts();
        return;
      case 'products-next':
        state.productsPage += 1;
        renderProducts();
        return;
      case 'open-category-modal':
        renderEntityFormModal('category');
        return;
      case 'edit-category':
        renderEntityFormModal('category', category);
        return;
      case 'toggle-category':
        if (category) {
          category.active = !category.active;
          toast('Category updated', `${category.name} is now ${category.active ? 'active' : 'inactive'}.`, 'success');
          renderAll();
        }
        return;
      case 'delete-category':
        if (category) {
          openConfirmModal({
            title: 'Delete category',
            message: `Delete ${category.name}?`,
            confirmLabel: 'Delete',
            onConfirm: () => {
              state.categories = state.categories.filter((item) => Number(item.id) !== id);
              toast('Category deleted', `${category.name} removed from the list.`, 'danger');
              renderAll();
            },
          });
        }
        return;
      case 'select-order':
        if (order) {
          state.selectedOrderId = order.id;
          renderOrders();
        }
        return;
      case 'advance-order':
      case 'ship-order':
      case 'deliver-order':
        if (order) {
          if (action === 'advance-order') advanceOrderStatus(order, 'next');
          if (action === 'ship-order') {
            order.status = 'shipped';
            order.timeline.unshift({ label: 'Shipped', note: 'Manually advanced from admin dashboard', time: `${toISODate(today)}T${pad(today.getHours())}:${pad(today.getMinutes())}:00` });
            toast('Order shipped', `${order.orderNumber} marked as shipped.`, 'success');
            renderAll();
          }
          if (action === 'deliver-order') {
            order.status = 'delivered';
            order.timeline.unshift({ label: 'Delivered', note: 'Manually marked as delivered', time: `${toISODate(today)}T${pad(today.getHours())}:${pad(today.getMinutes())}:00` });
            toast('Order delivered', `${order.orderNumber} marked as delivered.`, 'success');
            renderAll();
          }
        }
        return;
      case 'cancel-order':
        if (order) cancelOrder(order);
        return;
      case 'refund-order':
        if (order) refundOrder(order);
        return;
      case 'orders-prev':
        state.ordersPage = Math.max(1, state.ordersPage - 1);
        renderOrders();
        return;
      case 'orders-next':
        state.ordersPage += 1;
        renderOrders();
        return;
      case 'select-customer':
        if (customer) {
          state.selectedCustomerId = customer.id;
          renderCustomers();
        }
        return;
      case 'message-customer':
        if (customer) toast('Placeholder', `A message draft can be opened for ${customer.name}.`, 'default');
        return;
      case 'export-customer':
        if (customer) toast('Export ready', `${customer.name}'s profile export is prepared as mock data.`, 'success');
        return;
      case 'select-coupon':
        if (coupon) {
          state.selectedCouponId = coupon.id;
          renderCoupons();
        }
        return;
      case 'open-coupon-modal':
        renderEntityFormModal('coupon');
        return;
      case 'edit-coupon':
        renderEntityFormModal('coupon', coupon);
        return;
      case 'toggle-coupon':
        if (coupon) {
          const nextActive = Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 0 : 1;
          await apiRequest(`/api/admin/coupons/${encodeURIComponent(coupon.id)}/active`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: nextActive }),
          });
          toast('Coupon updated', `${coupon.code} is now ${nextActive ? 'active' : 'inactive'}.`, 'success');
          await loadCouponData();
        }
        return;
      case 'copy-coupon':
        if (coupon) {
          copyTextToClipboard(coupon.code || '');
        }
        return;
      case 'delete-coupon':
        if (coupon) {
          openConfirmModal({
            title: 'Delete coupon',
            message: `Delete coupon ${coupon.code}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
              await apiRequest(`/api/admin/coupons/${encodeURIComponent(coupon.id)}`, { method: 'DELETE' });
              toast('Coupon deleted', `${coupon.code} removed from the list.`, 'danger');
              await loadCouponData();
            },
          });
        }
        return;
      case 'select-influencer':
        if (influencer) {
          state.selectedInfluencerId = influencer.id;
          renderInfluencers();
        }
        return;
      case 'open-influencer-modal':
        renderEntityFormModal('influencer');
        return;
      case 'edit-influencer':
        renderEntityFormModal('influencer', influencer);
        return;
      case 'toggle-influencer':
        if (influencer) {
          if (influencer.active) {
            openConfirmModal({
              title: 'Deactivate influencer',
              message: `Deactivate ${influencer.name}? They will remain in the directory but will not receive new campaign assignment work until reactivated.`,
              confirmLabel: 'Deactivate',
              tone: 'danger',
              onConfirm: () => {
                influencer.active = false;
                toast('Influencer deactivated', `${influencer.name} is now inactive.`, 'warning');
                renderAll();
              },
            });
          } else {
            influencer.active = true;
            toast('Influencer reactivated', `${influencer.name} is now active again.`, 'success');
            renderAll();
          }
        }
        return;
      case 'assign-coupon':
        if (influencer) {
          renderInfluencerAssignmentModal(influencer);
        }
        return;
      case 'export-report':
        toast('Export started', `${String(target.dataset.format || 'csv').toUpperCase()} export for the current date range is mocked.`, 'success');
        return;
      default:
        return;
    }
  }

  function handleNav(view) {
    if (!SECTION_TITLES[view]) return;
    state.view = view;
    setSidebarOpen(false);
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleInput(target) {
    const inputKey = target.dataset.input;
    if (!inputKey) return;
    state[inputKey] = target.value;
    if (inputKey === 'productsSearch' || inputKey === 'productsCategory' || inputKey === 'productsStatus' || inputKey === 'productsSort') {
      state.productsPage = 1;
      renderProducts();
      return;
    }
    if (inputKey === 'ordersSearch' || inputKey === 'ordersStatus') {
      state.ordersPage = 1;
      renderOrders();
      return;
    }
    if (inputKey === 'customersSearch') {
      renderCustomers();
      return;
    }
    if (inputKey === 'couponsSearch') {
      renderCoupons();
      return;
    }
    if (inputKey === 'influencersSearch') {
      renderInfluencers();
      return;
    }
    if (inputKey === 'reportFrom' || inputKey === 'reportTo' || inputKey === 'reportFormat') {
      renderReports();
    }
  }

  async function submitEntityForm(form) {
    const type = form.dataset.entityForm;
    const id = form.dataset.entityId ? Number(form.dataset.entityId) : null;
    const existingId = Number.isFinite(id) && id ? id : null;

    if (type === 'product') {
      const entity = updateProductFromForm(form, existingId ? state.products.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.sku) {
        toast('Missing details', 'Product name and SKU are required.', 'warning');
        return;
      }
      if (existingId) {
        state.products = state.products.map((item) => (Number(item.id) === existingId ? entity : item));
        toast('Product saved', `${entity.name} updated successfully.`, 'success');
      } else {
        state.products.unshift(entity);
        toast('Product added', `${entity.name} added to the catalog.`, 'success');
      }
      closeModal();
      renderAll();
      return;
    }

    if (type === 'category') {
      const entity = updateCategoryFromForm(form, existingId ? state.categories.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.slug) {
        toast('Missing details', 'Category name and slug are required.', 'warning');
        return;
      }
      if (existingId) {
        state.categories = state.categories.map((item) => (Number(item.id) === existingId ? entity : item));
        toast('Category saved', `${entity.name} updated successfully.`, 'success');
      } else {
        state.categories.unshift(entity);
        toast('Category added', `${entity.name} added to categories.`, 'success');
      }
      closeModal();
      renderAll();
      return;
    }

    if (type === 'coupon') {
      const entity = updateCouponFromForm(form, existingId ? state.coupons.find((item) => Number(item.id) === existingId) : null);
      if (!entity.code || !entity.discount) {
        toast('Missing details', 'Coupon code and discount are required.', 'warning');
        return;
      }
      const payload = {
        code: entity.code,
        description: entity.description,
        discountValue: Number(entity.discount) || 0,
        couponType: entity.couponType,
        appliesTo: entity.appliesTo,
        festivalName: entity.festivalName,
        recipientName: entity.recipientName,
        recipientEmail: entity.recipientEmail,
        validTill: entity.expiry || null,
        singleUse: entity.couponType === 'private',
        sendEmail: false,
        maxRedemptions: entity.couponType === 'private' ? 1 : null,
      };
      const method = existingId ? 'PUT' : 'POST';
      const path = existingId ? `/api/admin/coupons/${encodeURIComponent(existingId)}` : '/api/admin/coupons';
      await apiRequest(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast('Coupon saved', `${entity.code} ${existingId ? 'updated' : 'created'} successfully.`, 'success');
      closeModal();
      await loadCouponData();
      return;
    }

    if (type === 'influencer') {
      const entity = updateInfluencerFromForm(form, existingId ? state.influencers.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.handle) {
        toast('Missing details', 'Influencer name and handle are required.', 'warning');
        return;
      }
      if (existingId) {
        state.influencers = state.influencers.map((item) => (Number(item.id) === existingId ? entity : item));
        toast('Influencer saved', `${entity.name} updated successfully.`, 'success');
      } else {
        state.influencers.unshift(entity);
        toast('Influencer added', `${entity.name} added successfully.`, 'success');
      }
      closeModal();
      renderAll();
      return;
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const actionTarget = target.closest('[data-action]');
      if (actionTarget) {
        if (actionTarget instanceof HTMLInputElement && actionTarget.type === 'checkbox') return;
        event.preventDefault();
        handleAction(actionTarget.dataset.action, actionTarget);
        return;
      }

      const navTarget = target.closest('[data-nav-view]');
      if (navTarget) {
        event.preventDefault();
        handleNav(navTarget.dataset.navView);
        return;
      }

      const orderFilter = target.closest('[data-order-filter]');
      if (orderFilter) {
        state.ordersStatus = orderFilter.dataset.orderFilter;
        state.ordersPage = 1;
        renderOrders();
        return;
      }
    });

    document.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      handleInput(target);
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if (target instanceof HTMLInputElement && target.dataset.action) {
        handleAction(target.dataset.action, target);
        return;
      }
      if (target.closest('[data-entity-form]')) return;
      handleInput(target);
    });

    document.addEventListener('submit', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      const entityForm = target.closest('[data-entity-form]');
      if (entityForm) {
        event.preventDefault();
        submitEntityForm(target);
        return;
      }

      if (target.matches('[data-form="influencer-coupons"]')) {
        event.preventDefault();
        updateInfluencerCouponsFromForm(target);
        return;
      }

      if (target.matches('[data-form="settings"]')) {
        event.preventDefault();
        updateSettingsFromForm(target);
      }
    });

    els.sidebarOpenBtn?.addEventListener('click', () => setSidebarOpen(true));
    els.sidebarCloseBtn?.addEventListener('click', () => setSidebarOpen(false));
    els.sidebarOverlay?.addEventListener('click', () => setSidebarOpen(false));
    els.adminModal?.addEventListener('click', (event) => {
      const closeTarget = event.target instanceof Element ? event.target.closest('[data-action="close-modal"]') : null;
      if (closeTarget) {
        closeModal();
      }
    });
    els.notificationsDrawer?.addEventListener('click', (event) => {
      const closeTarget = event.target instanceof Element ? event.target.closest('[data-action="close-notifications"]') : null;
      if (closeTarget) setNotificationsOpen(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        setNotificationsOpen(false);
        closeModal();
      }
    });
  }

  function init() {
    bindEvents();
    renderAll();
    loadCouponData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
