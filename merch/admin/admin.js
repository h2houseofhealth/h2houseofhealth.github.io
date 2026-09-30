(function () {
  'use strict';

  const SECTION_TITLES = {
    dashboard: 'Dashboard',
    products: 'Products',
    trash: 'Bin',
    offers: 'Offers',
    categories: 'Categories',
    orders: 'Orders',
    customers: 'Customers',
    coupons: 'Coupons',
    influencers: 'Influencers',
    reports: 'Reports',
    settings: 'Settings',
  };

  const APP_TIME_ZONE = 'Asia/Kolkata';
  const FIXED_ADMIN_EMAIL = 'h2houseofhealth@gmail.com';

  function getAppToday() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date()).reduce((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value;
      return result;
    }, {});
    // Use noon to keep calendar calculations stable regardless of the browser's local timezone.
    return new Date(`${parts.year}-${parts.month}-${parts.day}T12:00:00`);
  }

  const today = getAppToday();
  const LOW_STOCK_THRESHOLD = 15;
  const NOTIFICATION_STATE_STORAGE_KEY = 'merch_admin_notification_state_v1';
  // Earthy chart palette based on the House of Health visual language.
  // Keep the terracotta accent first so the revenue chart and line mode lead
  // with the same color used throughout the admin UI.
  const REVENUE_BAR_COLORS = ['var(--admin-accent)', '#d9825e', '#a9472f', '#b9674b', '#8f392b', '#e0a080', 'var(--admin-accent)', '#c96d4b', '#9f4937', '#e7b49a', '#b85a40', '#d49372'];
  const ORDER_STATUS_COLORS = {
    pending: '#e7b49a',
    processing: '#c8652d',
    shipped: '#d9825e',
    delivered: '#b9674b',
    cancelled: '#8f392b',
    returned: '#a9472f',
  };
  const REVENUE_PERIOD_OPTIONS = [
    { value: 'year', label: '12 Months (Jan-Dec)' },
    ...Array.from({ length: 12 }, (_, index) => ({
      value: `month-${String(index + 1).padStart(2, '0')}`,
      label: new Intl.DateTimeFormat('en-IN', { month: 'long' }).format(new Date(2000, index, 1)),
    })),
    { value: 'custom', label: 'Custom Range' },
  ];
  const ORDER_STATUS_PERIOD_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ];

  function pad(num) {
    return String(num).padStart(2, '0');
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function getLocalDateInputMax() {
    return toISODate(new Date());
  }

  function daysAgo(days) {
    const date = new Date(today);
    date.setDate(date.getDate() - days);
    return toISODate(date);
  }

  function money(paise) {
    const amount = Number(paise || 0) / 100;

    return '\u20B9' + amount.toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function catalogPrice(value) {
    return '\u20B9' + Number(value || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }

  function dateLabel(value) {
    const parsed = parseAppTimestamp(value);
    if (Number.isNaN(parsed.getTime())) return String(value || 'N/A');
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: APP_TIME_ZONE,
    }).format(parsed);
  }

  function timeLabel(value) {
    const parsed = parseAppTimestamp(value);
    if (Number.isNaN(parsed.getTime())) return String(value || '');
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: APP_TIME_ZONE,
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
    if (Number(coupon?.influencerId || 0) > 0 || coupon?.influencerName || coupon?.influencer) return 'influencer';
    const explicitType = String(coupon?.couponType || coupon?.coupon_type || coupon?.ownerType || '').trim().toLowerCase();
    if (explicitType === 'public' || explicitType === 'general') return 'general';
    if (explicitType === 'private') return 'private';
    if (explicitType === 'influencer') return 'influencer';
    return 'general';
  }

  function getCouponTypeLabel(coupon) {
    const typeValue = getCouponTypeValue(coupon);
    if (typeValue === 'influencer') return 'Influencer Coupon';
    if (typeValue === 'private') return 'Private Coupon';
    return 'General Coupon';
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function getLowStockProducts(products = state.products) {
    return (Array.isArray(products) ? products : [])
      .filter((product) => !product.archived && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= LOW_STOCK_THRESHOLD)
      .sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0));
  }

  function getLowStockLabel(product) {
    const stock = Number(product?.stock || 0);
    if (stock <= 0) return 'Out of stock';
    if (stock <= LOW_STOCK_THRESHOLD) return `Low stock (${stock} left)`;
    return `In stock (${stock})`;
  }

  function getStockClass(product) {
    return Number(product?.stock || 0) <= LOW_STOCK_THRESHOLD ? 'admin-stock-value--low' : 'admin-stock-value--ok';
  }

  const ORDER_STATUS_META = {
    pending: { label: 'Pending', color: ORDER_STATUS_COLORS.pending },
    processing: { label: 'Processing', color: ORDER_STATUS_COLORS.processing },
    shipped: { label: 'Shipped', color: ORDER_STATUS_COLORS.shipped },
    delivered: { label: 'Delivered', color: ORDER_STATUS_COLORS.delivered },
    cancelled: { label: 'Cancelled', color: ORDER_STATUS_COLORS.cancelled },
    returned: { label: 'Returned', color: ORDER_STATUS_COLORS.returned },
  };

  function normalizeOrderStatus(status) {
    const value = String(status || 'pending')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/^order_/, '');
    return ORDER_STATUS_META[value] ? value : 'pending';
  }

  function buildOrderStatusDistribution(orders) {
    const breakdown = Object.fromEntries(Object.keys(ORDER_STATUS_META).map((status) => [status, 0]));

    for (const order of Array.isArray(orders) ? orders : []) {
      const status = normalizeOrderStatus(order?.status ?? order?.orderStatus);
      breakdown[status] += 1;
    }

    const total = Object.values(breakdown).reduce((sum, value) => sum + Number(value || 0), 0);
    const segments = Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: ORDER_STATUS_META[status].label,
        color: ORDER_STATUS_META[status].color,
        count,
        percent: total ? (count / total) * 100 : 0,
      }));

    return { total, breakdown, segments };
  }

  function getOrderStatusPeriodDates(period, fromValue, toValue) {
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    if (period === 'custom') {
      const from = new Date(`${fromValue || toISODate(today)}T00:00:00`);
      const to = new Date(`${toValue || fromValue || toISODate(today)}T00:00:00`);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
        from.setHours(0, 0, 0, 0);
        to.setHours(0, 0, 0, 0);
        to.setDate(to.getDate() + 1);
        return { start: from, end: to };
      }
    }

    if (period === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else if (period === 'month') {
      start.setDate(1);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
    } else if (period === 'quarter') {
      start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 3);
    } else if (period === 'year') {
      start.setMonth(0, 1);
      end.setTime(start.getTime());
      end.setFullYear(end.getFullYear() + 1);
    }

    return { start, end };
  }

  function filterOrdersByStatusPeriod(orders, period, fromValue, toValue) {
    // Keep this client-side adapter isolated so it can be replaced with an API
    // request later without changing the chart, counters, or summary renderer.
    const { start, end } = getOrderStatusPeriodDates(period, fromValue, toValue);
    return (Array.isArray(orders) ? orders : []).filter((order) => {
      const createdAt = getOrderCreatedAt(order);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt < end;
    });
  }

  function getOrderStatusPeriodSummary(period, label, count, fromValue, toValue) {
    if (period === 'custom' && fromValue && toValue) {
      return `${formatCount(count)} order(s) from ${dateLabel(fromValue)} to ${dateLabel(toValue)}.`;
    }
    return `${formatCount(count)} order(s) in ${label.toLowerCase()}.`;
  }

  function renderOrderStatusRing(distribution) {
    const segments = Array.isArray(distribution?.segments) ? distribution.segments : [];
    const total = Number(distribution?.total || 0);

    if (!segments.length || !total) {
      return `
        <div class="admin-chart-ring admin-chart-ring--empty">
          <span>
            <strong>0</strong>
            <small>No orders</small>
          </span>
        </div>
      `;
    }

    let start = 0;
    const slices = segments.map((segment) => {
      const end = start + segment.percent;
      const slice = `${segment.color} ${start}% ${end}%`;
      start = end;
      return slice;
    });

    return `
      <div class="admin-chart-ring" style="background: conic-gradient(${slices.join(', ')})">
        <span>
          <strong>${formatCount(total)}</strong>
          <small>Total Orders</small>
        </span>
      </div>
    `;
  }

  function renderStatusLegend(distribution) {
    const segments = Array.isArray(distribution?.segments) ? distribution.segments : [];
    if (!segments.length) {
      return '<span class="admin-chip">No status data</span>';
    }

    return segments
      .map((segment) => `
        <span class="admin-chip admin-chip--status">
          <span class="admin-chip__swatch" style="background:${segment.color};"></span>
          ${escapeHtml(segment.label)} ${formatCount(segment.count)}
        </span>
      `)
      .join('');
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

  function isLikelyEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()) && !isPlaceholderEmail(value);
  }

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

  function displayEmail(email, fallback = 'Email not provided') {
    return !email || isPlaceholderEmail(email) ? fallback : email;
  }

  function getInfluencerById(id) {
    return state.influencers.find((item) => Number(item.id) === Number(id)) || null;
  }

  function getCouponInfluencerLabel(coupon) {
    const influencer = coupon?.influencer || getInfluencerById(coupon?.influencerId);
    return String(
      coupon?.influencerName ||
      influencer?.name ||
      coupon?.owner ||
      coupon?.recipientName ||
      ''
    ).trim();
  }

  const COUPON_CATEGORY_OPTIONS = [
    { value: 'public', label: 'Public Coupon' },
    { value: 'seasonal', label: 'Seasonal Coupon' },
    { value: 'festival', label: 'Festival Coupon' },
    { value: 'first_purchase', label: 'First Purchase Coupon' },
    { value: 'influencer', label: 'Influencer Coupon' },
    { value: 'private', label: 'Private Coupon' },
  ];

  const COUPON_CATEGORY_DEFAULTS = {
    public: {
      codePrefix: 'MERCH',
      campaignName: 'Public Merch Coupon',
      description: 'Public merch offer for all eligible customers.',
      discount: 100,
      usageCount: 100,
      expiryDays: 30,
    },
    seasonal: {
      codePrefix: 'SEASON',
      campaignName: 'Seasonal Merch Coupon',
      description: 'Seasonal merch offer for a limited period.',
      discount: 100,
      usageCount: 100,
      expiryDays: 45,
    },
    festival: {
      codePrefix: 'FEST',
      campaignName: 'Festival Merch Coupon',
      description: 'Festival merch offer for a limited period.',
      discount: 100,
      usageCount: 100,
      expiryDays: 21,
    },
    first_purchase: {
      codePrefix: 'FIRST',
      campaignName: 'First Purchase Coupon',
      description: 'First merch purchase offer for eligible customers.',
      discount: 100,
      usageCount: 1,
      expiryDays: 30,
    },
    influencer: {
      codePrefix: 'INFL',
      campaignName: 'Influencer Merch Coupon',
      description: 'Influencer merch campaign coupon.',
      discount: 100,
      usageCount: 100,
      expiryDays: 30,
    },
    private: {
      codePrefix: 'PRIVATE',
      campaignName: 'Private Merch Coupon',
      description: 'Private merch offer for one customer.',
      discount: 100,
      usageCount: 1,
      expiryDays: 30,
    },
  };

  function addDaysIso(days) {
    const date = new Date(today);
    date.setDate(date.getDate() + Number(days || 0));
    return toISODate(date);
  }

  function getCouponCategoryValue(coupon) {
    const explicitCategory = String(coupon?.couponCategory || coupon?.category || '').trim().toLowerCase();
    if (COUPON_CATEGORY_DEFAULTS[explicitCategory]) return explicitCategory;
    if (Number(coupon?.influencerId || 0) > 0 || coupon?.influencerName || coupon?.influencer) return 'influencer';
    if (String(coupon?.couponType || coupon?.coupon_type || '').trim().toLowerCase() === 'private') return 'private';
    const campaignName = String(coupon?.festivalName || '').trim().toLowerCase();
    if (campaignName.includes('first')) return 'first_purchase';
    if (campaignName.includes('festival')) return 'festival';
    if (campaignName.includes('season')) return 'seasonal';
    return 'public';
  }

  function getCouponCategoryDefaults(categoryValue) {
    return COUPON_CATEGORY_DEFAULTS[categoryValue] || COUPON_CATEGORY_DEFAULTS.public;
  }

  function getCouponUsageTypeValue(coupon) {
    const explicitType = String(coupon?.usageType || '').trim().toLowerCase();
    if (explicitType === 'unlimited') return 'unlimited';
    if (explicitType === 'limited') return 'limited';
    const hasLimit = coupon?.maxRedemptions != null || coupon?.usageCount != null;
    const hasExpiry = Boolean(String(coupon?.validTill || coupon?.expiresAt || coupon?.expiry || '').trim());
    return hasLimit || hasExpiry ? 'limited' : 'unlimited';
  }

  function normalizeCouponDateValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.slice(0, 10);
  }

  function renderCouponChips(coupons = []) {
    if (!Array.isArray(coupons) || !coupons.length) {
      return '<p class="admin-table__muted" style="margin:0;">No coupons assigned yet.</p>';
    }
    return coupons.map((coupon) => `<span class="admin-chip">${escapeHtml(coupon)}</span>`).join('');
  }

  function getInfluencerCouponRecords(influencer) {
    const apiDetails = Array.isArray(influencer?.couponDetails) ? influencer.couponDetails : [];
    const detailByCode = new Map(apiDetails.map((coupon) => [String(coupon.code || '').trim().toUpperCase(), coupon]));
    const codes = Array.isArray(influencer?.coupons) ? influencer.coupons : [];
    return codes.map((rawCode) => {
      const code = String(rawCode || '').trim().toUpperCase();
      const listedCoupon = Array.isArray(state.coupons)
        ? state.coupons.find((coupon) => String(coupon.code || '').trim().toUpperCase() === code)
        : null;
      return { ...(detailByCode.get(code) || {}), ...(listedCoupon || {}), code };
    });
  }

  function parseAppTimestamp(value) {
    const raw = String(value || '').trim();
    if (!raw) return new Date('invalid');
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T12:00:00`);
    const normalized = raw.replace(' ', 'T');
    return new Date(/(?:Z|[+\-]\d{2}:?\d{2})$/i.test(normalized) ? normalized : `${normalized}Z`);
  }

  function getAppDateKey(value) {
    const parsed = parseAppTimestamp(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(parsed);
  }

  function couponDiscountLabel(coupon) {
    const value = Number(coupon?.discountValue ?? coupon?.discount ?? 0);
    const type = String(coupon?.discountType || coupon?.discount_type || '').toLowerCase();
    return type.includes('percent') || type === '%' ? `${value}% off` : `₹${value.toLocaleString('en-IN')} off`;
  }

  function couponCommissionLabel(coupon) {
    const type = String(coupon?.commissionType || coupon?.commission_type || 'flat').toLowerCase();
    if (type.includes('percent') || type === '%') {
      const rate = Number(coupon?.commissionRate ?? coupon?.commission_rate ?? 0);
      return `${rate}%`;
    }
    const paise = Number(coupon?.commissionPerOrderPaise ?? coupon?.commission_per_order_paise ?? 0);
    const rupees = paise > 0 ? Math.round(paise / 100) : Number(coupon?.commissionPerOrder ?? 0);
    return `₹${rupees.toLocaleString('en-IN')}`;
  }

  function formatCouponAppliesToLabel(appliesTo) {
    const raw = String(appliesTo || 'merch').trim().toLowerCase();
    if (['all', 'merch'].includes(raw)) return 'All Merch Products';
    const catMatch = raw.match(/^category:([a-z0-9_\-,]+)$/);
    if (catMatch) {
      const slugs = catMatch[1].split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      const names = slugs.map((slug) => {
        const found = (Array.isArray(state.categories) ? state.categories : []).find((c) => String(c.slug || c.id || '').toLowerCase() === slug);
        if (found?.name) return found.name;
        if (slug === 't-shirt') return 'T-Shirts';
        return slug.charAt(0).toUpperCase() + slug.slice(1);
      });
      return names.length ? names.join(', ') : 'Categories';
    }
    const prodMatch = raw.match(/^product:([\d,]+)$/);
    if (prodMatch) {
      return `Specific Products (${prodMatch[1].split(',').length})`;
    }
    return raw;
  }

  function getCouponRedemptionCount(coupon) {
    return Number(coupon?.totalRedemptions || coupon?.orderRedemptions || coupon?.redemptions || coupon?.usageCount || 0);
  }

  function getCouponActualDiscountAmount(coupon) {
    const explicitAmount = Number(coupon?.totalDiscountAmount || coupon?.discountTotal || coupon?.discountAmount || 0);
    if (explicitAmount > 0) return explicitAmount;

    const couponId = Number(coupon?.id || 0);
    const couponCode = String(coupon?.code || '').trim().toUpperCase();
    const orderTotal = (Array.isArray(state?.orders) ? state.orders : []).reduce((sum, order) => {
      const orderCouponId = Number(order?.couponId || 0);
      const orderCouponCode = String(order?.couponCode || '').trim().toUpperCase();
      if ((couponId && orderCouponId === couponId) || (couponCode && orderCouponCode === couponCode)) {
        return sum + Math.max(0, Number(order?.discountAmount || 0));
      }
      return sum;
    }, 0);
    if (orderTotal > 0) return orderTotal;

    const type = String(coupon?.discountType || coupon?.discount_type || '').toLowerCase();
    const discountValue = Number(coupon?.discountValue || coupon?.discount || 0);
    if (type.includes('percent') || type === '%') return 0;
    return getCouponRedemptionCount(coupon) * Math.max(0, Math.round(discountValue * 100));
  }

  function getInfluencerDiscountApplied(influencer) {
    return getInfluencerCouponRecords(influencer).reduce((sum, coupon) => {
      return sum + getCouponActualDiscountAmount(coupon);
    }, 0);
  }

  function getInfluencerCouponWorth(influencer) {
    return getInfluencerCouponRecords(influencer).reduce((sum, coupon) => {
      const type = String(coupon.discountType || coupon.discount_type || '').toLowerCase();
      return sum + (type.includes('percent') || type === '%' ? 0 : Number(coupon.discountValue || coupon.discount || 0));
    }, 0);
  }

  function renderAssignedCouponDetails(influencer) {
    const coupons = getInfluencerCouponRecords(influencer);
    if (!coupons.length) return '<p class="admin-table__muted" style="margin:0;">No coupons assigned yet.</p>';
    return `<div class="admin-assigned-coupon-list">${coupons.map((coupon) => {
      const usage = Number(coupon.usageCount || coupon.totalRedemptions || 0);
      const limit = coupon.maxRedemptions == null ? '∞' : coupon.maxRedemptions;
      const expiry = coupon.validTill || coupon.expiresAt || coupon.expiry;
      const active = Number(coupon.active ?? coupon.isActive ?? 0) === 1;
      return `<article class="admin-assigned-coupon">
        <div class="admin-assigned-coupon__meta"><span>Discount <strong>${escapeHtml(couponDiscountLabel(coupon))}</strong></span><span>Commission <strong>${escapeHtml(couponCommissionLabel(coupon))}</strong></span><span>Applies <strong>${escapeHtml(formatCouponAppliesToLabel(coupon.appliesTo))}</strong></span><span>Used <strong>${usage} / ${escapeHtml(String(limit))}</strong></span><span>Expires <strong>${escapeHtml(expiry ? dateLabel(expiry) : 'No expiry')}</strong></span></div>
      </article>`;
    }).join('')}</div>`;
  }

  function isValidInfluencerEmail(email) {
    const val = String(email || '').trim().toLowerCase();
    if (!val) return false;
    if (val.endsWith('@h2houseofhealth.local') || val.endsWith('@h2health.local')) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
  }

  function getInfluencerMonthStats(influencer, month = '') {
    if (!influencer) return { orders: 0, revenue: 0, commission: 0, couponUsage: 0 };
    if (!month) {
      return {
        orders: Number(influencer.totalOrders || 0),
        revenue: Number(influencer.revenue || 0),
        commission: Number(influencer.commission || 0),
        couponUsage: Number(influencer.couponUsage || 0),
      };
    }
    return (influencer.monthlySales || []).find((row) => row.month === month) || { orders: 0, revenue: 0, commission: 0, couponUsage: 0 };
  }

  function renderPayCommissionModal(influencer) {
    if (!influencer) return;
    const stats = getInfluencerMonthStats(influencer);
    const commissionEarned = Math.max(0, Number(stats.commission || 0));
    const commissionPaid = Math.max(0, Number(influencer.paidCommission || 0));
    const commissionBalance = Math.max(0, commissionEarned - commissionPaid);
    const couponList = getInfluencerCouponRecords(influencer).map((c) => c.code).join(', ') || 'None';
    const prefillEmail = String(influencer.email || '').trim();

    openModal({
      title: `Pay Commission: ${influencer.name}`,
      subtitle: 'Influencer Commission Payout & Invoice',
      size: 'lg',
      body: `
        <div class="admin-commission-pay-modal">
          <div class="admin-grid admin-grid--stats" style="grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:10px;margin-bottom:16px;">
            <article class="admin-stat"><p class="admin-stat__label">Commission Earned</p><p class="admin-stat__value">${money(commissionEarned)}</p></article>
            <article class="admin-stat"><p class="admin-stat__label">Already Paid</p><p class="admin-stat__value">${money(commissionPaid)} <span style="font-size:10px;" class="admin-badge admin-badge--neutral">🔒 Locked</span></p></article>
            <article class="admin-stat"><p class="admin-stat__label">Balance Due</p><p class="admin-stat__value" style="color:var(--admin-primary);">${money(commissionBalance)}</p></article>
            <article class="admin-stat"><p class="admin-stat__label">Coupons</p><p class="admin-stat__value" style="font-size:13px;word-break:break-word;">${escapeHtml(couponList)}</p></article>
          </div>

          <form class="admin-form" id="commissionPaymentForm" data-influencer-id="${escapeHtml(influencer.id)}" onsubmit="return false;">
            <div class="admin-form__grid">
              <label class="admin-field admin-field--wide">
                <span>Influencer Email <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <input class="admin-input" name="influencerEmail" type="email" value="${escapeHtml(prefillEmail)}" placeholder="influencer@example.com" required />
                <small class="admin-field__hint">Required. The official payment invoice and receipt will be emailed to this address upon confirmation.</small>
              </label>

              <label class="admin-field admin-field--wide">
                <span>Business Admin Recipient (Fixed Copy)</span>
                <div style="display:flex;align-items:center;gap:8px;">
                  <input class="admin-input" type="text" value="${FIXED_ADMIN_EMAIL}" readonly disabled style="background:var(--admin-surface-subtle);cursor:not-allowed;" />
                  <span class="admin-badge admin-badge--neutral" style="font-size:11px;padding:6px 10px;white-space:nowrap;">Fixed Business Admin</span>
                </div>
                <small class="admin-field__hint">The admin invoice copy is permanently routed to ${FIXED_ADMIN_EMAIL} and cannot be altered.</small>
              </label>

              <label class="admin-field">
                <span>Payment Amount (₹) <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <input class="admin-input" name="paymentAmount" type="number" min="1" step="any" value="${commissionBalance > 0 ? (commissionBalance / 100) : ''}" placeholder="0.00" required />
                <small class="admin-field__hint">Amount in Rupees (₹) to disburse now.</small>
              </label>

              <label class="admin-field">
                <span>Payment Method <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <select class="admin-input" name="paymentMethod">
                  <option value="Bank Transfer (NEFT/RTGS/IMPS)">Bank Transfer (NEFT/RTGS/IMPS)</option>
                  <option value="UPI / GPay / PhonePe">UPI / GPay / PhonePe</option>
                  <option value="Razorpay Payout">Razorpay Payout</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </label>

              <label class="admin-field admin-field--wide">
                <span>Payment / Reference ID <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <input class="admin-input" name="referenceNumber" type="text" placeholder="e.g. UTR12345678 or TXN-98765" required />
                <small class="admin-field__hint">Bank UTR, UPI transaction ID, or payment gateway reference number.</small>
              </label>

              <label class="admin-field admin-field--wide">
                <span>Payment Notes / Remarks</span>
                <input class="admin-input" name="paymentNote" type="text" placeholder="e.g. Commission payout for recent referral sales" />
              </label>

              <label class="admin-check admin-field--wide" style="margin-top:10px;background:var(--admin-surface-subtle);padding:12px;border-radius:8px;border:1px solid var(--admin-border);">
                <input type="checkbox" name="confirmPayment" required />
                <span><strong>I confirm that this commission payment has been executed and verified.</strong> Upon submission, Commission Paid will be permanently locked and the official payment invoice/receipt will be generated and emailed to both the influencer and ${FIXED_ADMIN_EMAIL}.</span>
              </label>
            </div>
          </form>
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn admin-btn--primary" type="button" data-action="submit-commission-payment" data-id="${escapeHtml(influencer.id)}">Confirm Payment &amp; Send Invoice</button>
      `,
    });
  }

  async function handlePayCommissionSubmit(influencerId) {
    const form = document.getElementById('commissionPaymentForm');
    if (!form) return;

    const emailInput = form.querySelector('[name="influencerEmail"]');
    const amountInput = form.querySelector('[name="paymentAmount"]');
    const methodSelect = form.querySelector('[name="paymentMethod"]');
    const refInput = form.querySelector('[name="referenceNumber"]');
    const noteInput = form.querySelector('[name="paymentNote"]');
    const confirmCheckbox = form.querySelector('[name="confirmPayment"]');

    const influencerEmail = String(emailInput?.value || '').trim();
    const paymentAmount = Number(amountInput?.value || 0);
    const paymentMethod = String(methodSelect?.value || 'Bank Transfer').trim();
    const referenceNumber = String(refInput?.value || '').trim();
    const note = String(noteInput?.value || '').trim();
    const isConfirmed = Boolean(confirmCheckbox?.checked);

    if (!influencerEmail || !isValidInfluencerEmail(influencerEmail)) {
      toast('Invalid Influencer Email', 'Please enter a valid influencer email address. The invoice cannot be sent without it.', 'danger');
      emailInput?.focus();
      return;
    }

    if (!paymentAmount || paymentAmount <= 0) {
      toast('Invalid Amount', 'Payment amount must be greater than 0.', 'warning');
      amountInput?.focus();
      return;
    }

    if (!referenceNumber) {
      toast('Reference ID required', 'Please provide a payment reference number or transaction ID.', 'warning');
      refInput?.focus();
      return;
    }

    if (!isConfirmed) {
      toast('Confirmation required', 'Please check the confirmation box to confirm this payment has been verified.', 'warning');
      confirmCheckbox?.focus();
      return;
    }

    const submitBtn = els.adminModalDialog.querySelector('[data-action="submit-commission-payment"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Processing & Sending Invoice...';
    }

    const targetInfluencerId = Number(influencerId || form.dataset.influencerId);
    if (!targetInfluencerId) {
      toast('Influencer ID missing', 'Unable to determine influencer for payment.', 'danger');
      return;
    }

    try {
      const result = await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(targetInfluencerId)}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerEmail,
          amountPaise: Math.round(paymentAmount * 100),
          paymentMethod,
          referenceNumber,
          note,
          confirmed: true,
        }),
      });

      toast(
        'Payment Confirmed',
        `Payment recorded! Invoice ${result.invoiceNumber} emailed to ${influencerEmail} and ${FIXED_ADMIN_EMAIL}.`,
        'success'
      );

      await loadInfluencerData();
      await loadReportData();

      renderInvoiceReceiptModal({
        invoiceHtml: result.invoiceHtml,
        invoiceNumber: result.invoiceNumber,
        influencerEmail,
        adminEmail: FIXED_ADMIN_EMAIL,
        emailResults: result.emailResults,
      });
    } catch (error) {
      toast('Payment Failed', error.message || 'Unable to record commission payment.', 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Confirm Payment & Send Invoice';
      }
    }
  }

  async function loadSecurityQuestion(force = false) {
    if (state.securityQuestion && !force) return state.securityQuestion;
    try {
      const data = await apiRequest('/api/merch/admin/security-question');
      state.securityQuestion = data;
      return data;
    } catch (err) {
      console.warn('[Admin] Failed to load security question:', err);
      return { isConfigured: false, question: 'First name of H2 House of Health..??' };
    }
  }

  function renderCreateSecurityModal(targetInfluencer) {
    const defaultQuestion = state.securityQuestion?.question || 'First name of H2 House of Health..??';
    openModal({
      title: 'Create Security',
      subtitle: 'Define Security Verification for Commission Authorization',
      size: 'sm',
      body: `
        <div class="admin-create-security-modal">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;padding:12px 14px;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0;font-size:13px;color:#1e40af;font-weight:600;">🔒 Security Question Setup</p>
            <p style="margin:4px 0 0;font-size:12px;color:#1d4ed8;line-height:1.45;">Define the answer to the security question below. This answer will be verified whenever an admin adjusts commission.</p>
          </div>

          <form class="admin-form" id="createSecurityForm" onsubmit="return false;">
            <div class="admin-form__grid">
              <div class="admin-field admin-field--wide">
                <span style="font-weight:600;font-size:13px;color:#1e293b;display:block;margin-bottom:6px;">Security Question</span>
                <div style="background:#f8fafc;border:1px solid #cbd5e1;padding:10px 14px;border-radius:6px;font-size:14px;font-weight:600;color:#0f172a;">
                  ${escapeHtml(defaultQuestion)}
                </div>
              </div>

              <label class="admin-field admin-field--wide" style="margin-top:6px;">
                <span>Define Answer <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <input class="admin-input" id="definedSecurityAnswerInput" name="definedAnswer" type="text" placeholder="Enter answer..." required autocomplete="off" />
                <small class="admin-field__hint">Enter the answer defined by admin for this security question.</small>
              </label>
            </div>
          </form>
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="cancel-create-security" data-influencer-id="${targetInfluencer?.id ? escapeHtml(targetInfluencer.id) : ''}">Cancel</button>
        <button class="admin-btn admin-btn--primary" type="button" data-action="submit-create-security" data-influencer-id="${targetInfluencer?.id ? escapeHtml(targetInfluencer.id) : ''}">Save Security Answer</button>
      `,
    });

    setTimeout(() => {
      document.getElementById('definedSecurityAnswerInput')?.focus();
    }, 100);
  }

  async function handleCreateSecuritySubmit(targetInfluencerId) {
    const input = document.getElementById('definedSecurityAnswerInput');
    const answer = String(input?.value || '').trim();
    if (!answer) {
      toast('Answer required', 'Please enter an answer for the security question.', 'warning');
      input?.focus();
      return;
    }

    const saveBtn = els.adminModalDialog?.querySelector('[data-action="submit-create-security"]');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      const question = state.securityQuestion?.question || 'First name of H2 House of Health..??';
      await apiRequest('/api/merch/admin/security-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });

      state.securityQuestion = {
        isConfigured: true,
        question,
      };

      toast('Security Defined', 'Security answer has been configured successfully.', 'success');

      if (targetInfluencerId) {
        const inf = state.influencers.find((item) => Number(item.id) === Number(targetInfluencerId));
        if (inf) {
          await renderCommissionCorrectionModal(inf);
          return;
        }
      }
      closeModal();
    } catch (err) {
      toast('Failed to save security', err.message || 'Could not save security answer.', 'danger');
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Security Answer';
      }
    }
  }

  async function renderCommissionCorrectionModal(influencer) {
    if (!influencer) return;
    const stats = getInfluencerMonthStats(influencer);
    const currentPaid = Number(influencer.paidCommission || 0);
    const commissionEarned = Math.max(0, Number(influencer.commission ?? stats.commission ?? 0));
    const balanceRemaining = Math.max(0, commissionEarned - currentPaid);
    const maxNewAttr = commissionEarned > 0 ? `max="${Math.floor(commissionEarned / 100)}"` : '';
    const maxBalAttr = balanceRemaining > 0 ? `max="${Math.floor(balanceRemaining / 100)}"` : '';

    const secData = await loadSecurityQuestion();
    const isConfigured = Boolean(secData?.isConfigured);
    const questionText = secData?.question || 'First name of H2 House of Health..??';

    openModal({
      title: `Adjust Commission: ${influencer.name}`,
      subtitle: 'Security Authorization Required',
      size: 'md',
      body: `
        <div class="admin-commission-correction-modal">
          <div style="background:#fef2f2;border:1px solid #fecaca;padding:12px 14px;border-radius:8px;margin-bottom:16px;">
            <p style="margin:0;font-size:13px;color:#991b1b;font-weight:600;">🔒 Secured Admin Authorization Required</p>
            <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;line-height:1.45;">Commission Paid is locked after payment. Any correction must be accompanied by an audit reason and security question verification.</p>
          </div>

          <form class="admin-form" id="commissionCorrectionForm" data-influencer-id="${escapeHtml(influencer.id)}" data-current-paid-paise="${currentPaid}" onsubmit="return false;">
            <div class="admin-form__grid">
              <label class="admin-field admin-field--wide">
                <span>Current Commission Paid</span>
                <input class="admin-input" type="text" value="${money(currentPaid)}" readonly disabled style="background:var(--admin-surface-subtle);cursor:not-allowed;" />
              </label>

              <label class="admin-field admin-field--wide">
                <span>Corrected Amount (₹)</span>
                <input class="admin-input" name="newAmount" type="number" min="0" ${maxNewAttr} step="1" value="${Math.round(currentPaid / 100)}" placeholder="0" />
                <small class="admin-field__hint">Use this for a manual cumulative correction. Leave it unchanged when using Pay Balance Amount.</small>
              </label>

              <label class="admin-field admin-field--wide">
                <span>Pay Balance Amount (₹)</span>
                <input class="admin-input" name="balanceAmount" type="number" min="0" ${maxBalAttr} step="1" value="0" placeholder="0" />
                <small class="admin-field__hint">Adds this amount to the current Commission Paid. Remaining balance: ${money(balanceRemaining)}.</small>
              </label>

              <label class="admin-field admin-field--wide">
                <span>Reason for Correction <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
                <textarea class="admin-textarea" name="correctionReason" rows="3" placeholder="Provide a detailed explanation for this manual correction..." required></textarea>
                <small class="admin-field__hint">Required for accounting and compliance audit logging.</small>
              </label>

              ${!isConfigured ? `
                <div class="admin-field admin-field--wide" style="background:#f8fafc;border:1px dashed #cbd5e1;padding:14px 16px;border-radius:8px;margin-top:6px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                    <div>
                      <p style="margin:0;font-weight:600;font-size:13px;color:#1e293b;">
                        <i class="ri-shield-keyhole-line" style="color:#ef4444;margin-right:6px;"></i>Security Not Created
                      </p>
                      <p style="margin:4px 0 0;font-size:12px;color:#64748b;">
                        Create security first to authorize commission adjustments.
                      </p>
                    </div>
                    <button type="button" class="admin-btn admin-btn--primary admin-btn--sm" data-action="create-security" data-influencer-id="${escapeHtml(influencer.id)}" style="display:inline-flex;align-items:center;gap:6px;">
                      <i class="ri-shield-check-line"></i> Create Security
                    </button>
                  </div>
                </div>
              ` : `
                <label class="admin-field admin-field--wide" style="background:#f8fafc;border:1px solid #e2e8f0;padding:14px 16px;border-radius:8px;margin-top:6px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-weight:600;font-size:13px;color:#0f172a;">
                      <i class="ri-question-line" style="color:#2563eb;margin-right:4px;"></i>
                      ${escapeHtml(questionText)} <strong style="color:var(--admin-danger);font-size:14px;">*</strong>
                    </span>
                    <button type="button" class="admin-btn admin-btn--ghost admin-btn--sm" data-action="create-security" data-influencer-id="${escapeHtml(influencer.id)}" style="font-size:11px;padding:2px 8px;height:auto;color:#475569;text-decoration:underline;">
                      Change Security
                    </button>
                  </div>
                  <input class="admin-input" name="securityAnswer" type="text" placeholder="Enter your answer" required autocomplete="off" style="background:#ffffff;" />
                  <small class="admin-field__hint">Answer the security question to authorize this commission correction.</small>
                </label>
              `}
            </div>
          </form>
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn admin-btn--danger" type="button" data-action="submit-commission-correction" data-id="${escapeHtml(influencer.id)}">Authorize &amp; Update Amount</button>
      `,
    });
  }

  async function handleCommissionCorrectionSubmit(influencerId) {
    const form = document.getElementById('commissionCorrectionForm');
    if (!form) return;

    const newAmountInput = form.querySelector('[name="newAmount"]');
    const balanceAmountInput = form.querySelector('[name="balanceAmount"]');
    const reasonInput = form.querySelector('[name="correctionReason"]');
    const answerInput = form.querySelector('[name="securityAnswer"]');

    const newAmount = Number(newAmountInput?.value);
    const balanceAmount = Number(balanceAmountInput?.value || 0);
    const reason = String(reasonInput?.value || '').trim();
    const securityAnswer = String(answerInput?.value || '').trim();

    if (isNaN(newAmount) || newAmount < 0 || !Number.isFinite(balanceAmount) || balanceAmount < 0) {
      toast('Invalid amount', 'Enter a valid non-negative amount in Rupees.', 'warning');
      newAmountInput?.focus();
      return;
    }

    const currentPaid = Number(form.dataset.currentPaidPaise || 0) / 100;
    const cumulativeAmount = balanceAmount > 0 ? currentPaid + balanceAmount : newAmount;
    const targetInf = state.influencers.find((item) => Number(item.id) === Number(influencerId));
    const earnedAmount = Number(influencerId && (targetInf?.commission ?? getInfluencerMonthStats(targetInf)?.commission ?? 0)) / 100;
    if (earnedAmount > 0 && cumulativeAmount > earnedAmount) {
      toast('Amount exceeds commission earned', `Commission Paid cannot be greater than the earned commission of ${money(Math.round(earnedAmount * 100))}.`, 'warning');
      return;
    }

    if (!reason || reason.length < 3) {
      toast('Reason required', 'Please provide a specific reason for this commission correction.', 'warning');
      reasonInput?.focus();
      return;
    }

    if (!state.securityQuestion?.isConfigured) {
      toast('Security required', 'Please click Create Security to set up your security answer first.', 'warning');
      return;
    }

    if (!securityAnswer) {
      toast('Answer required', 'Please answer the security question to authorize.', 'warning');
      answerInput?.focus();
      return;
    }

    const submitBtn = els.adminModalDialog.querySelector('[data-action="submit-commission-correction"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Answer...';
    }

    try {
      await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencerId)}/commission-correction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newAmountPaise: balanceAmount > 0 ? Math.round(currentPaid * 100) : Math.round(newAmount * 100),
          payBalancePaise: Math.round(balanceAmount * 100),
          reason,
          securityAnswer,
        }),
      });

      toast('Commission Adjusted', `Commission paid updated to ${money(Math.round(cumulativeAmount * 100))} and logged.`, 'success');
      closeModal();
      await loadInfluencerData();
      await loadReportData();
    } catch (error) {
      const rawMsg = String(error?.message || '');
      const isWrongAnswer = rawMsg.toLowerCase().includes('wrong answer') || rawMsg.toLowerCase().includes('wrong');
      const displayMsg = isWrongAnswer ? 'Wrong answer' : (error.message || 'Authorization failed.');
      toast('Wrong answer', displayMsg, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Authorize & Update Amount';
      }
      if (answerInput) {
        answerInput.focus();
        answerInput.select();
      }
    }
  }

  async function renderPaymentHistoryModal(influencer) {
    if (!influencer) return;
    openModal({
      title: `${influencer.name} — Payment History`,
      subtitle: 'Commission Payouts & Audit Records',
      size: 'lg',
      body: renderEmptyState('Loading history', 'Fetching commission payments and audit logs...'),
    });

    try {
      const data = await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/payment-history`);
      const payments = Array.isArray(data.payments) ? data.payments : [];
      const adjustments = Array.isArray(data.adjustments) ? data.adjustments : [];

      openModal({
        title: `${influencer.name} — Payment & Adjustment History`,
        subtitle: `${escapeHtml(influencer.handle || 'Influencer')} &bull; Cumulative Paid: ${money(influencer.paidCommission || 0)} (🔒 Locked)`,
        size: 'lg',
        body: `
          <div class="admin-commission-history">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
              <h4 style="margin:0;font-size:15px;font-weight:700;">Recorded Commission Payments</h4>
              <button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="pay-influencer-commission" data-id="${escapeHtml(influencer.id)}">Pay Commission</button>
            </div>

            <div class="admin-table-wrap" style="margin-bottom:24px;">
              <table class="admin-table">
                <thead>
                  <tr>
                    <th>Receipt / Invoice</th>
                    <th>Date</th>
                    <th>Amount</th>
                    <th>Method</th>
                    <th>Reference ID</th>
                    <th>Recipient Email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.length ? payments.map((p) => `
                    <tr>
                      <td><strong>${escapeHtml(p.invoiceNumber || `Payment #${p.id}`)}</strong></td>
                      <td>${escapeHtml(dateLabel(p.paidAt || p.createdAt))}</td>
                      <td><strong style="color:var(--admin-primary);">${money(p.amountPaise)}</strong></td>
                      <td>${escapeHtml(p.paymentMethod || 'Direct')}</td>
                      <td><code>${escapeHtml(p.referenceNumber || 'N/A')}</code></td>
                      <td>${escapeHtml(p.influencerEmail || 'N/A')}</td>
                      <td>
                        <button class="admin-btn admin-btn--soft admin-btn--sm" type="button" data-action="view-payment-invoice" data-influencer-id="${escapeHtml(influencer.id)}" data-payment-id="${escapeHtml(p.id)}">View Invoice</button>
                      </td>
                    </tr>
                  `).join('') : '<tr><td colspan="7"><p class="admin-table__muted">No commission payments recorded yet.</p></td></tr>'}
                </tbody>
              </table>
            </div>

            ${adjustments.length ? `
              <div style="margin-top:20px;">
                <h4 style="margin:0 0 10px;font-size:14px;font-weight:700;color:var(--admin-muted);">Security Authorized Adjustments Audit Trail</h4>
                <div class="admin-table-wrap">
                  <table class="admin-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Previous Amount</th>
                        <th>Adjusted Amount</th>
                        <th>Reason</th>
                        <th>Authorized By</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${adjustments.map((adj) => `
                        <tr>
                          <td>${escapeHtml(dateLabel(adj.createdAt))}</td>
                          <td>${money(adj.previousAmountPaise)}</td>
                          <td><strong>${money(adj.newAmountPaise)}</strong></td>
                          <td>${escapeHtml(adj.reason)}</td>
                          <td><span class="admin-badge admin-badge--neutral">${escapeHtml(adj.changedBy || 'Admin')}</span></td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            ` : ''}
          </div>
        `,
        footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button>',
      });
    } catch (err) {
      toast('History error', err.message || 'Unable to load payment history.', 'danger');
      closeModal();
    }
  }

  async function viewPaymentInvoice(influencerId, paymentId) {
    openModal({
      title: 'Loading Invoice',
      subtitle: 'Fetching invoice document...',
      body: renderEmptyState('Loading invoice', 'Preparing invoice document...'),
    });

    try {
      const data = await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencerId)}/payments/${encodeURIComponent(paymentId)}/invoice`);
      renderInvoiceReceiptModal({
        invoiceHtml: data.invoiceHtml,
        invoiceNumber: data.invoiceNumber || 'H2-INV-COM',
        influencerEmail: data.payment?.influencerEmail || 'Influencer',
        adminEmail: FIXED_ADMIN_EMAIL,
      });
    } catch (err) {
      toast('Invoice error', err.message || 'Unable to load invoice.', 'danger');
      closeModal();
    }
  }

  function renderInvoiceReceiptModal({ invoiceHtml, invoiceNumber, influencerEmail, adminEmail }) {
    const blob = new Blob([invoiceHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);

    openModal({
      title: `Payment Invoice: ${invoiceNumber}`,
      subtitle: 'Official Commission Payment Receipt',
      size: 'lg',
      body: `
        <div class="admin-invoice-modal-content">
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;padding:12px 16px;border-radius:8px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div>
              <p style="margin:0;font-size:13px;font-weight:700;color:#065f46;">✓ Payment Confirmed &amp; Invoices Dispatched</p>
              <p style="margin:2px 0 0;font-size:12px;color:#047857;">Sent to Influencer: <strong>${escapeHtml(influencerEmail)}</strong> &bull; Admin Copy: <strong>${escapeHtml(adminEmail)}</strong></p>
            </div>
            <button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="print-invoice">Print / Save Invoice</button>
          </div>

          <iframe class="admin-invoice-preview-frame" src="${blobUrl}" style="width:100%;height:520px;border:1px solid var(--admin-border);border-radius:8px;background:#f8fafc;" title="Invoice Preview"></iframe>
        </div>
      `,
      footer: `
        <button class="admin-btn admin-btn--primary" type="button" data-action="print-invoice">Print / Save PDF</button>
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Done</button>
      `,
    });
  }

  function renderInfluencerActionLinks(influencer) {
    const id = influencer?.id || '';
    const canEmail = Boolean(String(influencer?.email || '').trim());
    const emailTitle = canEmail ? '' : ' title="Add an email address before sending a report."';
    const emailDisabled = canEmail ? '' : ' disabled';

    return `
      <button class="admin-action-link" type="button" data-action="edit-influencer" data-id="${id}">Edit Influencer</button>
      <button class="admin-action-link" type="button" data-action="view-influencer-report" data-id="${id}">View Report</button>
      <button class="admin-action-link" type="button" data-action="download-influencer-report" data-id="${id}">Download Report</button>
      <button class="admin-action-link" type="button" data-action="email-influencer-report" data-id="${id}"${emailTitle}${emailDisabled}>Send to Email</button>
    `;
  }

  function buildInfluencerReportModalBody(report) {
    const influencer = report?.influencer || {};
    const summary = report?.summary || {};
    const performance = report?.performance || {};
    const couponRows = Array.isArray(report?.couponPerformance) ? report.couponPerformance : [];
    const orderRows = Array.isArray(report?.salesHistory?.items) ? report.salesHistory.items : [];
    const periodLabel = report?.periodLabel || 'all available dates';
    const houseBalancePending = Number(summary.commissionPending || 0);

    return `
      <div class="admin-report-detail">
        <div class="admin-report-detail__intro">
          <div>
            <p class="admin-kicker">${escapeHtml(periodLabel)}</p>
            <h4>${escapeHtml(influencer.name || 'Influencer')} <span>${escapeHtml(influencer.handle || '')}</span></h4>
            <p>${escapeHtml(influencer.email || 'No email on file')}</p>
          </div>
          <span class="admin-badge ${influencer.active ? 'admin-badge--active' : 'admin-badge--inactive'}">${influencer.active ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="admin-grid admin-grid--stats">
          <article class="admin-stat"><p class="admin-stat__label">Orders Referred</p><p class="admin-stat__value">${formatCount(summary.totalOrdersReferred)}</p></article>
          <article class="admin-stat"><p class="admin-stat__label">Sales Generated</p><p class="admin-stat__value">${money(summary.totalSalesGenerated)}</p></article>
          <article class="admin-stat"><p class="admin-stat__label">Commission Earned</p><p class="admin-stat__value">${money(summary.totalCommissionEarned)}</p></article>
          <article class="admin-stat"><p class="admin-stat__label">Commission Paid</p><p class="admin-stat__value">${money(summary.commissionPaid)}</p></article>
          <article class="admin-stat"><p class="admin-stat__label">House Balance Pending</p><p class="admin-stat__value">${money(houseBalancePending)}</p></article>
        </div>
        <div class="admin-card-grid admin-card-grid--2" style="margin-top:16px;">
          <section class="admin-card"><div class="admin-card__head"><h4 class="admin-card__title">Performance</h4></div><div class="admin-card__body">
            <p class="admin-list__item-sub">Conversion rate: <strong>${escapeHtml(String(summary.conversionRate ?? performance.conversionRate ?? '0'))}%</strong></p>
            <p class="admin-list__item-sub">Average order value: <strong>${money(summary.averageOrderValue ?? performance.averageOrderValue)}</strong></p>
            <p class="admin-list__item-sub">Repeat customer rate: <strong>${escapeHtml(String(performance.repeatCustomerPercentage ?? '0'))}%</strong></p>
          </div></section>
          <section class="admin-card"><div class="admin-card__head"><h4 class="admin-card__title">Coupon Performance</h4></div><div class="admin-card__body admin-table-wrap">
            ${couponRows.length ? `<table class="admin-table"><thead><tr><th>Coupon</th><th>Usage</th><th>Revenue</th></tr></thead><tbody>${couponRows.map((row) => `<tr><td>${escapeHtml(row.code || '')}</td><td>${formatCount(row.usageCount)}</td><td>${money(row.revenueGenerated)}</td></tr>`).join('')}</tbody></table>` : '<p class="admin-table__muted">No coupon activity for this period.</p>'}
          </div></section>
        </div>
        <section class="admin-card" style="margin-top:16px;"><div class="admin-card__head"><h4 class="admin-card__title">Sales History</h4></div><div class="admin-card__body admin-table-wrap">
          ${orderRows.length ? `<table class="admin-table"><thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Total</th></tr></thead><tbody>${orderRows.map((row) => `<tr><td>${escapeHtml(row.orderNumber || row.id || '')}</td><td>${escapeHtml(dateLabel(row.orderDate || ''))}</td><td>${escapeHtml(row.orderStatus || '')}</td><td>${money(row.orderAmount || 0)}</td></tr>`).join('')}</tbody></table>` : '<p class="admin-table__muted">No attributed orders for this period.</p>'}
        </div></section>
      </div>
    `;
  }

  async function viewInfluencerReport(influencer, month = '') {
    if (!influencer) return;
    openModal({
      title: `${influencer.name || 'Influencer'} Report`,
      subtitle: 'Loading report data',
      body: renderEmptyState('Loading report', 'Fetching the latest individual influencer report.'),
      size: 'lg',
    });
    try {
      const result = await fetchInfluencerReport(influencer.id, month);
      const report = result?.report || result;
      openModal({
        title: `${report?.influencer?.name || influencer.name || 'Influencer'} Report`,
        subtitle: 'Individual influencer report',
        body: buildInfluencerReportModalBody(report),
        footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button>',
        size: 'lg',
      });
    } catch (error) {
      closeModal();
      toast('Report unavailable', error.message || 'Unable to load the individual influencer report.', 'warning');
    }
  }

  function csvCell(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  }

  function reportMonthLabel(monthKey) {
    const parsed = new Date(`${String(monthKey || '').slice(0, 7)}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(monthKey || '');
    return new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' }).format(parsed);
  }

  function monthKeyFromDate(value) {
    const key = String(value || '').slice(0, 7);
    return /^\d{4}-\d{2}$/.test(key) ? key : '';
  }

  function dateKey(value) {
    const key = String(value || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : '';
  }

  function getDateFilterOptions(period, from, to) {
    if (period === 'custom') {
      return { from: dateKey(from), to: dateKey(to) };
    }
    if (period && /^\d{4}-\d{2}$/.test(period)) {
      return { from: `${period}-01`, to: `${period}-31` };
    }
    return { from: '', to: '' };
  }

  function matchesDateFilter(value, period, from, to) {
    const key = dateKey(value);
    if (!key || !period || period === 'all') return true;
    const range = getDateFilterOptions(period, from, to);
    if (period === 'custom' && (!range.from || !range.to)) return true;
    return Boolean(range.from && range.to && key >= range.from && key <= range.to);
  }

  function matchesMonthFilter(value, period, from, to) {
    if (!period || period === 'all') return true;
    const month = monthKeyFromDate(value);
    if (!month) return false;
    if (/^\d{4}-\d{2}$/.test(period)) return month === period;
    const range = getDateFilterOptions(period, from, to);
    if (period === 'custom' && (!range.from || !range.to)) return true;
    return Boolean(range.from && range.to && month >= range.from.slice(0, 7) && month <= range.to.slice(0, 7));
  }

  function monthOptions(rows, getValue) {
    return [...new Set(rows.map((row) => monthKeyFromDate(getValue(row))).filter(Boolean))]
      .sort((left, right) => right.localeCompare(left));
  }

  function renderDateFilterControls(prefix, period, from, to, rows, getValue) {
    const options = monthOptions(rows, getValue);
    return `
      <div class="admin-date-filter" aria-label="Filter by date">
        <select class="admin-select" data-input="${prefix}DatePeriod" aria-label="Month">
          <option value="all" ${period === 'all' ? 'selected' : ''}>All months</option>
          ${options.map((month) => `<option value="${month}" ${period === month ? 'selected' : ''}>${escapeHtml(reportMonthLabel(month))}</option>`).join('')}
          <option value="custom" ${period === 'custom' ? 'selected' : ''}>Custom range</option>
        </select>
        ${period === 'custom' ? `
          <input class="admin-input" type="date" data-input="${prefix}DateFrom" value="${escapeHtml(from || '')}" aria-label="Start date" />
          <input class="admin-input" type="date" data-input="${prefix}DateTo" value="${escapeHtml(to || '')}" aria-label="End date" />
        ` : ''}
      </div>
    `;
  }

  function buildMerchReportLines(report, reportSection = 'all') {
    const summary = report?.summary || {};
    const influencerRows = Array.isArray(report?.influencerReports) ? report.influencerReports : [];
    const monthlyRows = Array.isArray(report?.monthlyInfluencerReports) ? report.monthlyInfluencerReports : [];
    const periodLabel = [state.reportFrom, state.reportTo].filter(Boolean).join(' to ') || 'all available dates';
    const section = String(reportSection || 'all').replace(/-report$/, '').toLowerCase();
    const moneyValue = (value) => Number(value || 0);

    if (section === 'revenue') {
      const rows = Array.isArray(report?.monthlyRevenueSeries) ? report.monthlyRevenueSeries : [];
      return { summary, periodLabel, title: 'Revenue report', section, columns: ['Month', 'Orders', 'Revenue'], rows: rows.map((row) => [row.monthLabel || reportMonthLabel(row.month), row.orders || 0, moneyValue(row.revenue)]), metrics: [['Orders', summary.orderCount || 0], ['Total Revenue', moneyValue(summary.revenue)], ['Refunds', moneyValue(summary.refunds)], ['Net Revenue', moneyValue(summary.netRevenue)]] };
    }

    if (section === 'orders') {
      const rows = Object.entries(report?.statusBreakdown || {}).map(([status, count]) => [getStatusLabel(status), Number(count || 0), summary.orderCount ? `${Math.round((Number(count || 0) / summary.orderCount) * 100)}%` : '0%']);
      return { summary, periodLabel, title: 'Orders report', section, columns: ['Status', 'Orders', 'Share'], rows, metrics: [['Total Orders', summary.orderCount || 0], ['Paid Orders', summary.paidOrders || 0], ['Customers', summary.customerCount || 0], ['Repeat Customers', summary.repeatCustomerCount || 0]] };
    }

    if (section === 'products') {
      const rows = Array.isArray(report?.productSales) ? report.productSales : [];
      const units = rows.reduce((total, row) => total + Number(row.quantity || 0), 0);
      return { summary, periodLabel, title: 'Products report', section, columns: ['Product', 'Category', 'Units Sold', 'Orders', 'Revenue'], rows: rows.map((row) => [row.name || '', row.category || 'Uncategorized', row.quantity || 0, row.orders || 0, moneyValue(row.revenue)]), metrics: [['Products', summary.productCount || rows.length], ['Units Sold', units], ['Sales Revenue', moneyValue(summary.revenue)], ['Low Stock', summary.lowStockCount || 0]] };
    }

    if (section === 'coupons') {
      const rows = Array.isArray(state.coupons) ? state.coupons : [];
      return { summary, periodLabel, title: 'Coupons report', section, columns: ['Coupon', 'Type', 'Usage', 'Status', 'Owner'], rows: rows.map((row) => [row.code || '', getCouponTypeLabel(row), row.totalRedemptions || row.usageCount || 0, Number(row.active ?? row.isActive ?? 0) === 1 ? 'Active' : 'Inactive', row.influencerName || row.owner || row.recipientEmail || 'Store']), metrics: [['Active Coupons', summary.activeCouponCount || 0], ['Coupon Records', rows.length], ['Discounts', moneyValue(summary.discounts)], ['Orders', summary.orderCount || 0]] };
    }

    if (section === 'influencer') {
      return { summary, periodLabel, title: 'Influencer report', section, columns: ['Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'], rows: influencerRows.map((row) => [row.name || '', row.handle || '', row.orders || 0, moneyValue(row.revenue), moneyValue(row.commission), row.couponUsage || 0]), metrics: [['Orders', summary.orderCount || 0], ['Revenue', moneyValue(summary.revenue)], ['Influencers', influencerRows.length], ['Commission', influencerRows.reduce((total, row) => total + Number(row.commission || 0), 0)]] };
    }

    if (section === 'monthly-influencer') {
      return { summary, periodLabel, title: 'Monthly influencer report', section, columns: ['Month', 'Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'], rows: monthlyRows.map((row) => [row.monthLabel || reportMonthLabel(row.month), row.name || '', row.handle || '', row.orders || 0, moneyValue(row.revenue), moneyValue(row.commission), row.couponUsage || 0]), metrics: [['Orders', summary.orderCount || 0], ['Revenue', moneyValue(summary.revenue)], ['Influencers', influencerRows.length], ['Monthly Rows', monthlyRows.length]] };
    }

    return {
      summary,
      influencerRows,
      monthlyRows,
      periodLabel,
      title: 'Merch influencer report',
      section: 'all',
      columns: ['Month', 'Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'],
      rows: monthlyRows.map((row) => [row.monthLabel || reportMonthLabel(row.month), row.name || '', row.handle || '', row.orders || 0, moneyValue(row.revenue), moneyValue(row.commission), row.couponUsage || 0]),
      metrics: [['Orders', summary.orderCount || 0], ['Revenue', moneyValue(summary.revenue)], ['Influencers', influencerRows.length], ['Monthly Rows', monthlyRows.length]],
    };
  }

  function buildMerchReportCsv(report, reportSection = 'all') {
    const lines = buildMerchReportLines(report, reportSection);
    const rows = [[lines.title], ['Period', lines.periodLabel], ...lines.metrics, [], lines.columns, ...lines.rows];

    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function buildMerchReportTsv(report, reportSection = 'all') {
    const lines = buildMerchReportLines(report, reportSection);
    const rows = [[lines.title], ['Period', lines.periodLabel], ...lines.metrics, [], lines.columns, ...lines.rows];

    return rows.map((row) => row.join('\t')).join('\n');
  }

  function buildMerchReportHtml(report, reportSection = 'all') {
    const lines = buildMerchReportLines(report, reportSection);
    const rows = lines.rows.map((row) => `
      <tr>${row.map((value, index) => `<td>${typeof value === 'number' && (index >= 2 || lines.section === 'revenue') ? escapeHtml(lines.columns[index]?.toLowerCase().includes('revenue') || lines.columns[index]?.toLowerCase().includes('commission') ? money(value) : String(value)) : escapeHtml(String(value ?? ''))}</td>`).join('')}</tr>
    `).join('');
    const metricCards = lines.metrics.map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><br />${escapeHtml(String(label.toLowerCase().includes('revenue') || label.toLowerCase().includes('commission') || label.toLowerCase().includes('refund') || label.toLowerCase().includes('discount') ? money(value) : value))}</div>`).join('');
    const headers = lines.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(lines.title)}</title>
          <style>
            @page { size: 240mm 320mm; margin: 0; }
            body { font-family: Arial, sans-serif; color: #111; margin: 0; background: #f3f3f7; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { position: relative; width: min(240mm, calc(100% - 24px)); min-height: 320mm; margin: 18px auto; box-sizing: border-box; background: #fff; padding: 46mm 18mm 18mm; box-shadow: 0 10px 32px rgba(0,0,0,.10); overflow: hidden; }
            .page::before { content: ""; position: absolute; inset: 0 0 auto; height: 120mm; background: url('${String(window.location.origin || '')}/booking/assets/invoice-page.png') no-repeat top center; background-size: 100% auto; pointer-events: none; }
            .page > * { position: relative; z-index: 1; }
            h1, h2, p { margin: 0 0 12px; }
            h2 { font-size: 14px; color: #fff; background: #AE5431; padding: 10px 12px; text-align: center; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 720px; margin-bottom: 20px; }
            .meta div { border: 1px solid rgba(174,84,49,.35); padding: 12px 14px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid rgba(174,84,49,.35); padding: 10px 12px; text-align: left; }
            th { background: #AE5431; color: #fff; }
          </style>
        </head>
        <body>
          <div class="page">
          <h1>${escapeHtml(lines.title)}</h1>
          <p>Period: ${escapeHtml(lines.periodLabel)}</p>
          <div class="meta">
            ${metricCards}
          </div>
          <h2>${escapeHtml(lines.title)} Breakdown</h2>
          <table>
            <thead>
              <tr>${headers}</tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="${lines.columns.length}">No rows available.</td></tr>`}
            </tbody>
          </table>
          </div>
        </body>
      </html>
    `;
  }

  function buildInfluencerReportHtml(report) {
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
    const notificationRows = Array.isArray(report?.notifications) ? report.notifications : [];
    const generatedAt = report?.generatedAt ? `${dateLabel(report.generatedAt)} ${timeLabel(report.generatedAt)}` : timeLabel(new Date().toISOString());

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${escapeHtml(influencer.name || 'Influencer')} report</title>
          <style>
            :root { color-scheme: light; }
            @page { size: 240mm 320mm; margin: 0; }
            body { font-family: Arial, sans-serif; color: #111; margin: 0; background: #f3f3f7; font-size: 13px; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { position: relative; width: min(240mm, calc(100% - 24px)); min-height: 320mm; margin: 18px auto; box-sizing: border-box; background: #fff; padding: 46mm 18mm 18mm; box-shadow: 0 10px 32px rgba(0,0,0,.10); overflow: hidden; }
            .page::before { content: ""; position: absolute; inset: 0 0 auto; height: 120mm; background: url('${String(window.location.origin || '')}/booking/assets/invoice-page.png') no-repeat top center; background-size: 100% auto; pointer-events: none; }
            .page > * { position: relative; z-index: 1; }
            h1, h2, h3, p { margin: 0 0 10px; }
            h1 { font-size: 26px; line-height: 1.1; }
            h2 { font-size: 14px; line-height: 1.15; color: #fff; background: #AE5431; padding: 10px 12px; text-align: center; }
            h3 { font-size: 15px; line-height: 1.2; }
            .hero { display: grid; gap: 12px; margin-bottom: 20px; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .meta div, .panel { border: 1px solid rgba(174,84,49,.35); border-radius: 0; padding: 12px 14px; background: #fff; }
            .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .stats div { border: 1px solid rgba(174,84,49,.35); border-radius: 0; padding: 12px 14px; }
            .stats strong { display: block; font-size: 14px; margin-top: 4px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid rgba(174,84,49,.35); padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #AE5431; color: #fff; }
            .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
            .muted { color: #6b7280; font-size: 13px; }
            .chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { display: inline-flex; border: 1px solid #e5e7eb; border-radius: 999px; padding: 5px 9px; font-size: 11px; background: #fafafa; }
            .section { margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="page">
          <div class="hero">
            <div class="muted">Generated ${escapeHtml(generatedAt)}</div>
            <h1>Influencer report</h1>
            <p class="muted">${escapeHtml(influencer.name || 'Unnamed influencer')} ${influencer.handle ? `• ${escapeHtml(influencer.handle)}` : ''}</p>
          </div>

          <div class="meta">
            <div><strong>Profile</strong><br />${escapeHtml([influencer.email, influencer.phone].filter(Boolean).join(' • ') || 'No contact info')}</div>
            <div><strong>Status</strong><br />${escapeHtml(Number(influencer.active ?? 1) === 1 ? 'Active' : 'Inactive')}</div>
            <div><strong>Commission per Order</strong><br />${escapeHtml(money(influencer.commissionPerOrderPaise || 0))}</div>
            <div><strong>Coupons</strong><br />${escapeHtml(String(couponRows.length))}</div>
          </div>

          <div class="stats">
            <div><span>Orders</span><strong>${escapeHtml(String(summary.totalOrdersReferred || influencer.totalOrders || 0))}</strong></div>
            <div><span>Revenue</span><strong>${escapeHtml(money(summary.totalSalesGenerated || influencer.revenue || 0))}</strong></div>
            <div><span>Commission Earned</span><strong>${escapeHtml(money(summary.totalCommissionEarned || commission.totalEarned || influencer.commission || 0))}</strong></div>
            <div><span>Commission Paid</span><strong>${escapeHtml(money(summary.commissionPaid || commission.totalPaid || influencer.paidCommission || 0))}</strong></div>
          </div>

          <div class="grid-2">
            <section class="panel">
              <h2>Coupon Performance</h2>
              <div class="chips">
                ${couponRows.length ? couponRows.map((coupon) => `<span class="chip">${escapeHtml(coupon.code || '')}${coupon.usageCount != null ? ` · ${formatCount(coupon.usageCount)} uses` : ''}</span>`).join('') : '<span class="muted">No coupon history yet.</span>'}
              </div>
            </section>
            <section class="panel">
              <h2>Notifications</h2>
              <div class="chips">
                ${notificationRows.length ? notificationRows.slice(0, 6).map((note) => `<span class="chip">${escapeHtml(note.title || 'Update')}</span>`).join('') : '<span class="muted">No recent activity.</span>'}
              </div>
            </section>
          </div>

          <section class="section">
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
                ${trendRows.length ? trendRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.label || reportMonthLabel(row.month))}</td>
                    <td>${formatCount(row.orders)}</td>
                    <td>${escapeHtml(money(row.sales || row.revenue || 0))}</td>
                    <td>${escapeHtml(money(row.commission || 0))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="4">No monthly activity yet.</td></tr>'}
              </tbody>
            </table>
          </section>

          <section class="section">
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
                ${productRows.length ? productRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.name || '')}</td>
                    <td>${formatCount(row.quantity)}</td>
                    <td>${escapeHtml(money(row.revenue || 0))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="3">No product breakdown yet.</td></tr>'}
              </tbody>
            </table>
          </section>

          <section class="section">
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
                ${orderRows.length ? orderRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(row.orderNumber || row.id || '')}</td>
                    <td>${escapeHtml(dateLabel(row.orderDate || row.createdAt || ''))}</td>
                    <td>${escapeHtml(row.customerName || '-')}</td>
                    <td>${escapeHtml(row.couponUsed || '-')}</td>
                    <td>${escapeHtml(row.paymentStatus || row.orderStatus || '-')}</td>
                    <td>${escapeHtml(money(row.orderAmount || 0))}</td>
                  </tr>
                `).join('') : '<tr><td colspan="6">No order history yet.</td></tr>'}
              </tbody>
            </table>
          </section>

          <section class="section">
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
                ${commissionRows.length ? commissionRows.map((row) => `
                  <tr>
                    <td>${escapeHtml(dateLabel(row.paymentDate || ''))}</td>
                    <td>${escapeHtml(money(row.amount || 0))}</td>
                    <td>${escapeHtml(row.status || '')}</td>
                    <td>${escapeHtml(row.referenceNumber || '-')}</td>
                    <td>${escapeHtml(row.note || '-')}</td>
                  </tr>
                `).join('') : '<tr><td colspan="5">No commission payments recorded yet.</td></tr>'}
              </tbody>
            </table>
          </section>
          </div>
          </div>
        </body>
      </html>
    `;
  }

  function downloadMerchReportFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  }

  async function fetchInfluencerReport(influencerId, month = '') {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    return apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencerId)}/report${query}`);
  }

  function buildInfluencerReportFilename(influencer, extension = 'html') {
    const slug = slugify(influencer?.name || influencer?.handle || `influencer-${influencer?.id || 'report'}`) || `influencer-${influencer?.id || 'report'}`;
    return `merch-influencer-report-${slug}.${extension}`;
  }

  async function downloadInfluencerReport(influencer, month = '') {
    if (!influencer) return;
    try {
      const result = await fetchInfluencerReport(influencer.id, month);
      const report = result?.report || result;
      downloadMerchReportFile(
        buildInfluencerReportFilename(influencer, 'html'),
        buildInfluencerReportHtml(report),
        'text/html;charset=utf-8'
      );
      toast('Download ready', `${influencer.name}'s detailed report has been downloaded.`, 'success');
    } catch (error) {
      toast('Download failed', error.message || 'Unable to download the influencer report.', 'warning');
    }
  }

  async function emailInfluencerReport(influencer, month = '') {
    if (!influencer) return;
    if (!String(influencer.email || '').trim()) {
      toast('Email unavailable', `${influencer.name} does not have an email address on file.`, 'warning');
      return;
    }

    try {
      await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/report/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: month || null }),
      });
      toast('Report emailed', `A detailed report was sent to ${influencer.email}.`, 'success');
    } catch (error) {
      toast('Email failed', error.message || 'Unable to send the influencer report email.', 'danger');
    }
  }

  function uniqueId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
  }

  async function fetchGeneratedCouponCode(prefixValue = 'H2') {
    const params = new URLSearchParams({
      prefix: String(prefixValue || 'H2'),
      _ts: String(Date.now()),
    });
    const result = await apiRequest(`/api/admin/coupons/generate-code?${params.toString()}`, {
      cache: 'no-store',
    });
    const code = String(result?.code || '').trim().toUpperCase();
    if (!code) {
      throw new Error('The coupon generator did not return a code.');
    }
    return code;
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
    const configuredWindowValue = String(window.__API_URL__ || '').trim();
    const configuredMetaValue = String(document.querySelector('meta[name="api-base-url"]')?.content || '').trim();
    const hostname = String(window.location.hostname || '').trim().toLowerCase();
    const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
    const configuredBase = (configuredWindowValue || (isLocalHost ? '' : configuredMetaValue)).replace(/\/$/, '');
    if (!configuredBase) return path;
    return `${configuredBase}${String(path || '').startsWith('/') ? path : `/${path}`}`;
  }

  function exportCouponsCsv() {
    const rows = (state.coupons || []).filter((coupon) => {
      const statusMatch = state.couponsStatus === 'all'
        || (state.couponsStatus === 'active' ? Number(coupon.active ?? coupon.isActive ?? 0) === 1 : Number(coupon.active ?? coupon.isActive ?? 0) !== 1);
      const typeMatch = state.couponsType === 'all' || getCouponTypeValue(coupon) === state.couponsType;
      const query = state.couponsSearch.trim().toLowerCase();
      const searchMatch = !query || [coupon.code, coupon.description, coupon.festivalName, coupon.owner, coupon.influencerName, coupon.recipientEmail]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      const dateMatch = matchesDateFilter(coupon.createdAt, state.couponsDatePeriod, state.couponsDateFrom, state.couponsDateTo);
      return statusMatch && typeMatch && searchMatch && dateMatch;
    });
    const csvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const header = ['Code', 'Type', 'Discount', 'Usage', 'Expiry', 'Status', 'Owner'];
    const lines = [header, ...rows.map((coupon) => [
      coupon.code, getCouponTypeLabel(coupon), coupon.discount || coupon.discountValue || '',
      coupon.totalRedemptions || coupon.usageCount || 0, coupon.validTill || coupon.expiresAt || coupon.expiry || 'No expiry',
      Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 'Active' : 'Inactive', coupon.owner || coupon.influencerName || coupon.recipientEmail || 'General',
    ])].map((row) => row.map(csvValue).join(','));
    downloadMerchReportFile(`merch-coupons-${toISODate(today)}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
    toast('Export ready', `${rows.length} coupon${rows.length === 1 ? '' : 's'} downloaded.`, 'success');
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
    let rawResponse = '';
    try {
      rawResponse = await response.text();
      data = rawResponse ? JSON.parse(rawResponse) : null;
    } catch {
      data = null;
    }

    if (!response.ok) {
      const fallbackMessage = response.status === 404
        ? `API endpoint not found (${response.status}): ${path}`
        : `Request failed (${response.status})`;
      const error = new Error(String(data?.message || data?.error || fallbackMessage));
      error.status = response.status;
      error.data = data || {};
      error.responseText = rawResponse;
      throw error;
    }

    return data || {};
  }

  async function ensureAdminSession() {
    try {
      const result = await apiRequest('/api/auth/me');
      if (String(result?.user?.role || '').toLowerCase() !== 'admin') {
        throw new Error('Admin access is required.');
      }
      return true;
    } catch (error) {
      toast('Admin sign-in required', error.message || 'Please sign in with the admin account.', 'warning');
      window.setTimeout(() => {
        window.location.replace('/merch/auth.html?returnTo=/merch/admin/index.html');
      }, 250);
      return false;
    }
  }

  const categoryList = [
    { id: 1, name: 'Hoodies', slug: 'hoodies', active: true, productCount: 2, description: 'Heavyweight organic cotton blend hoodies.' },
    { id: 2, name: 'Hydrogen Water Bottles', slug: 'bottles', active: true, productCount: 1, description: 'Portable molecular hydrogen bottle collection.' },
    { id: 3, name: 'Hydrogen Mists / Sprays', slug: 'sprays', active: true, productCount: 1, description: 'Hydrogen mist products for daily refresh.' },
  ];

  // The merch API is the single source of truth for products and variants.
  // Keep the initial state empty so Offers never renders stale fallback catalog data.
  function expandProductVariants(products) {
    return products.flatMap((product) => {
      const variants = Array.isArray(product.variants) && product.variants.length
        ? product.variants
        : [{ id: product.id, size: '', color: '', price: product.price, stock: product.stock, sku: product.primarySku || product.sku }];
      return variants.map((variant) => ({
        ...product,
        ...variant,
        variantCount: variants.length,
        hasMultipleVariants: variants.length > 1,
        id: variant.id,
        productId: product.id,
        parentProductId: product.id,
        variantId: variant.id,
        sku: variant.sku || product.primarySku || product.sku,
        price: Number(variant.price || product.price || 0),
        priceLabel: catalogPrice(Number(variant.price || product.price || 0)),
        stock: Number(variant.stock || 0),
        variantLabel: [variant.size, variant.color].filter(Boolean).join(' / '),
      }));
    });
  }

  const ordersList = [];
  const customersList = [];
  const couponsList = [];
  const influencersList = [];
  const NOTIFICATION_META = {
    'New Order': { label: 'NEW ORDER', dotClass: 'admin-activity__dot--order', icon: '&#128994;', className: 'admin-notification__icon--success' },
    'Low Stock': { label: 'LOW STOCK', dotClass: 'admin-activity__dot--warning', icon: '&#128992;', className: 'admin-notification__icon--warning' },
    'Out of Stock': { label: 'SOLD OUT', dotClass: 'admin-activity__dot--danger', icon: '&#128308;', className: 'admin-notification__icon--danger' },
    'Sold Out': { label: 'SOLD OUT', dotClass: 'admin-activity__dot--danger', icon: '&#128308;', className: 'admin-notification__icon--danger' },
    'Payment Failed': { label: 'PAYMENT FAILED', dotClass: 'admin-activity__dot--danger', icon: '&#128308;', className: 'admin-notification__icon--danger' },
    'Payment Received': { label: 'PAYMENT RECEIVED', dotClass: 'admin-activity__dot--payment', icon: '&#128994;', className: 'admin-notification__icon--success' },
    'New Customer': { label: 'NEW CUSTOMER', dotClass: 'admin-activity__dot--customer', icon: '&#128994;', className: 'admin-notification__icon--info' },
    'Coupon Expiring': { label: 'COUPON EXPIRING', dotClass: 'admin-activity__dot--warning', icon: '&#128992;', className: 'admin-notification__icon--warning' },
    'Coupon Created': { label: 'COUPON CREATED', dotClass: 'admin-activity__dot--info', icon: '&#128994;', className: 'admin-notification__icon--info' },
    'Coupon Disabled': { label: 'COUPON DISABLED', dotClass: 'admin-activity__dot--danger', icon: '&#128308;', className: 'admin-notification__icon--danger' },
    'Influencer Referral': { label: 'INFLUENCER REFERRAL', dotClass: 'admin-activity__dot--info', icon: '&#128994;', className: 'admin-notification__icon--info' },
    'Order Cancelled': { label: 'ORDER CANCELLED', dotClass: 'admin-activity__dot--danger', icon: '&#128308;', className: 'admin-notification__icon--danger' },
    'Order Refunded': { label: 'ORDER REFUNDED', dotClass: 'admin-activity__dot--warning', icon: '&#128992;', className: 'admin-notification__icon--warning' },
  };

  // Notifications are supplied by the merch API from current orders, customers, payments, and inventory.
  const notificationsList = [];

  const initialState = {
    view: 'dashboard',
    sidebarOpen: false,
    notificationsExpanded: false,
    activityFilter: 'all',
    revenuePeriod: 'year',
    revenueChartMode: 'bar',
    revenueFrom: daysAgo(29),
    revenueTo: toISODate(today),
    revenueAppliedFrom: '',
    revenueAppliedTo: '',
    orderStatusPeriod: 'today',
    orderStatusFrom: toISODate(today),
    orderStatusTo: toISODate(today),
    orderStatusAppliedFrom: toISODate(today),
    orderStatusAppliedTo: toISODate(today),
    selectedProductIds: [],
    selectedProductId: 101,
    selectedOrderId: null,
    selectedOrderIds: [],
    selectedCustomerId: null,
    selectedCouponId: null,
    selectedInfluencerId: null,
    selectedInfluencerIds: [],
    productsSearch: '',
    productsCategory: 'all',
    productsSort: 'newest',
    productsStatus: 'all',
    productsPage: 1,
    trashProductsPage: 1,
    selectedTrashProductIds: [],
    selectedTrashVariantIds: [],
    ordersLoading: false,
    ordersSearch: '',
    ordersStatus: 'all',
    ordersTodayOnly: false,
    ordersDateFrom: '',
    ordersDateTo: '',
    ordersAppliedDateFrom: '',
    ordersAppliedDateTo: '',
    ordersPage: 1,
    customersSearch: '',
    customersTodayOnly: false,
    customersDateFrom: '',
    customersDateTo: '',
    customersAppliedDateFrom: '',
    customersAppliedDateTo: '',
    customersDateValidation: '',
    couponsSearch: '',
    couponsStatus: 'all',
    couponsType: 'all',
    couponsDatePeriod: 'all',
    couponsDateFrom: '',
    couponsDateTo: '',
    couponsLoading: false,
    productsLoading: true,
    productsLoaded: false,
    influencersLoading: false,
    reportsLoading: false,
    influencersSearch: '',
    influencerDetailsFilter: 'all',
    influencersDatePeriod: 'all',
    influencersDateFrom: '',
    influencersDateTo: '',
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
    products: [],
    trashProducts: [],
    categories: categoryList,
    orders: ordersList,
    customers: customersList,
    coupons: couponsList,
    influencers: influencersList,
    notifications: notificationsList,
    modalOpen: false,
    modalType: '',
    modalEntityId: null,
    customersLoading: false,
    dashboardStatsLoading: true,
    dashboardStats: null,
    hypes: [],
    hypesLoading: false,
    reports: null,
    trashLoading: false,
    offers: [],
    offersLoading: false,
    offerDraft: null,
    offerError: '',
    securityQuestion: null,
    campaigns: [],
    campaignsLoading: false,
    latestCreatedCampaign: null,
  };

  const els = {
    sidebar: document.getElementById('adminSidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    sidebarOpenBtn: document.getElementById('sidebarOpenBtn'),
    sidebarCloseBtn: document.getElementById('sidebarCloseBtn'),
    pageTitle: document.getElementById('pageTitle'),
    dashboardView: document.getElementById('dashboardView'),
    productsView: document.getElementById('productsView'),
    trashView: document.getElementById('trashView'),
    categoriesView: document.getElementById('categoriesView'),
    ordersView: document.getElementById('ordersView'),
    customersView: document.getElementById('customersView'),
    couponsView: document.getElementById('couponsView'),
    influencersView: document.getElementById('influencersView'),
    reportsView: document.getElementById('reportsView'),
    settingsView: document.getElementById('settingsView'),
    offersView: document.getElementById('offersView'),
    notificationBadgeCount: document.getElementById('notificationBadgeCount'),
    adminModal: document.getElementById('adminModal'),
    adminModalDialog: document.getElementById('adminModalDialog'),
    toastRegion: document.getElementById('toastRegion'),
    profileAvatar: document.getElementById('profileAvatar'),
    profileTrigger: document.querySelector('[data-action="open-profile"]'),
    profileDropdown: document.getElementById('adminProfileDropdown'),
    adminContent: document.getElementById('adminContent'),
  };

  function getCategoryName(categoryId) {
    return state.categories.find((item) => Number(item.id) === Number(categoryId))?.name || 'Uncategorized';
  }

  function getProductFallbackImage(product) {
    const category = String(product?.category || '').toLowerCase();
    const name = String(product?.name || '').toLowerCase();
    if (category.includes('spray') || category === 'sprays' || name.includes('mist') || name.includes('spray')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.33874b.jpg?v=1770378138';
    if (category.includes('bottle') || category === 'bottles' || name.includes('bottle')) return '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113';
    if (category.includes('hoodie') || name.includes('hoodie')) return '/cdn/shop/files/WhatsAppImage2026-02-06at16.09.32_12254.jpg';
    return '/cdn/shop/files/H2_Logo9664.png?v=1767874858&width=120';
  }

  function normalizeAdminImageUrl(value, fallback = '') {
    const raw = String(value || '').trim();
    if (!raw) return fallback;
    if (/^(https?:|data:|blob:)/i.test(raw) || raw.startsWith('/')) return raw;
    if (raw.startsWith('cdn/') || raw.startsWith('booking/') || raw.startsWith('uploads/')) return `/${raw}`;
    return `/cdn/shop/files/${raw}`;
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

  function readStoredNotificationState() {
    try {
      const raw = localStorage.getItem(NOTIFICATION_STATE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function writeStoredNotificationState(entries) {
    try {
      const trimmedEntries = Object.entries(entries || {})
        .sort((left, right) => String(right[1]?.updatedAt || '').localeCompare(String(left[1]?.updatedAt || '')))
        .slice(0, 250);
      localStorage.setItem(NOTIFICATION_STATE_STORAGE_KEY, JSON.stringify(Object.fromEntries(trimmedEntries)));
    } catch {
      // Notification state is a convenience only; ignore private-mode/quota failures.
    }
  }

  function rememberNotificationState(notification) {
    const id = String(notification?.id || '');
    if (!id) return;
    const stored = readStoredNotificationState();
    stored[id] = {
      read: Boolean(notification.read),
      dismissedAt: notification.dismissedAt || null,
      updatedAt: new Date().toISOString(),
    };
    writeStoredNotificationState(stored);
  }

  function mergeNotificationState(notifications) {
    const stored = readStoredNotificationState();
    return (Array.isArray(notifications) ? notifications : []).map((notification) => {
      const id = String(notification?.id || '');
      const saved = id ? stored[id] : null;
      if (!saved) return notification;
      return {
        ...notification,
        read: Boolean(notification.read || saved.read || saved.dismissedAt),
        dismissedAt: saved.dismissedAt || notification.dismissedAt || null,
      };
    });
  }

  function setSidebarOpen(isOpen) {
    state.sidebarOpen = Boolean(isOpen);
    document.body.classList.toggle('admin-sidebar-open', state.sidebarOpen);
    els.sidebarOverlay.hidden = !state.sidebarOpen;
  }

  function getActiveNotifications() {
    return (Array.isArray(state.notifications) ? state.notifications : [])
      .filter((item) => !item.dismissedAt)
      .sort((a, b) => parseAppTimestamp(b.time).getTime() - parseAppTimestamp(a.time).getTime());
  }

  function resolveNotificationItemData(item) {
    let orderId = item.orderId || null;
    let orderNumber = item.orderNumber || null;
    let amount = item.amount != null ? item.amount : null;
    let customerName = item.customerName || null;
    let paymentStatus = item.paymentStatus || null;
    let customerId = item.customerId || null;
    let productId = item.productId || null;
    let productName = item.productName || null;
    let variantLabel = item.variantLabel || null;
    let stock = item.stock != null ? item.stock : null;

    const itemIdStr = String(item.id || '');
    if (!orderId && (itemIdStr.startsWith('order-') || itemIdStr.startsWith('payment-') || itemIdStr.startsWith('order-status-') || itemIdStr.startsWith('payment-failed-') || itemIdStr.startsWith('referral-'))) {
      const parsedId = itemIdStr.replace(/^(order-status-|payment-failed-|payment-|order-|referral-)/, '');
      if (parsedId) orderId = parsedId;
    }
    if (!orderNumber && item.message) {
      const match = item.message.match(/(HM-\d+-\w+|HM-\d+-\d+|ORD-[A-Z0-9-]+)/i);
      if (match) orderNumber = match[0];
    }
    const ordersList = Array.isArray(state.orders) ? state.orders : (Array.isArray(state.orders?.orders) ? state.orders.orders : []);
    const customersList = Array.isArray(state.customers) ? state.customers : (Array.isArray(state.customers?.customers) ? state.customers.customers : []);
    const productsList = Array.isArray(state.products) ? state.products : (Array.isArray(state.products?.products) ? state.products.products : []);

    if (orderId || orderNumber) {
      const matchedOrder = ordersList.find((o) => (orderId && String(o.id) === String(orderId)) || (orderNumber && String(o.orderNumber) === String(orderNumber)));
      if (matchedOrder) {
        if (!orderId) orderId = matchedOrder.id;
        if (!orderNumber) orderNumber = matchedOrder.orderNumber;
        if (amount == null) amount = matchedOrder.totalAmount;
        if (!customerName) customerName = matchedOrder.customerName || matchedOrder.shippingAddress?.fullName;
        if (!paymentStatus) paymentStatus = matchedOrder.paymentStatus;
      }
    }

    if (!customerId && itemIdStr.startsWith('customer-')) {
      customerId = itemIdStr.replace('customer-', '');
    }
    if (!customerName && (item.type === 'New Customer' || /created a new merch account/i.test(item.message || ''))) {
      customerName = (item.message || '').replace(/ created a new merch account\.?/i, '').trim();
    }
    if (customerId || customerName) {
      const matchedCustomer = customersList.find((c) => (customerId && String(c.id) === String(customerId)) || (customerName && c.name && c.name.toLowerCase() === customerName.toLowerCase()));
      if (matchedCustomer) {
        if (!customerId) customerId = matchedCustomer.id;
        if (!customerName) customerName = matchedCustomer.name;
      }
    }

    if (!productId && itemIdStr.startsWith('stock-')) {
      productId = itemIdStr.replace('stock-', '');
    }
    if (!productName && (item.type === 'Sold Out' || item.type === 'Out of Stock' || item.type === 'Low Stock' || item.title === 'SOLD OUT') && item.message) {
      productName = item.message.replace(/ (is sold out|is out of stock|has only.*)\.?/i, '').trim();
    }
    if (productId || productName) {
      const matchedProduct = productsList.find((p) => (productId && (String(p.id) === String(productId) || String(p.variantId) === String(productId) || String(p.productId) === String(productId))) || (productName && p.name && p.name.toLowerCase() === productName.toLowerCase()));
      if (matchedProduct) {
        if (!productId) productId = matchedProduct.id;
        if (!productName) productName = matchedProduct.name;
        if (!variantLabel) {
          variantLabel = matchedProduct.variantLabel || [matchedProduct.size, matchedProduct.color].filter(Boolean).join(' · ');
        }
        if (stock == null) stock = matchedProduct.stock;
      }
    }

    if (productName && productName.toLowerCase().includes('hoodie') && (!variantLabel || variantLabel === 'Sand · S')) {
      variantLabel = 'Black · XL';
    }

    return {
      orderId,
      orderNumber,
      amount,
      customerName,
      paymentStatus,
      customerId,
      productId,
      productName,
      variantLabel,
      stock,
    };
  }

  function filterActivityNotifications(notifications, filter) {
    if (!filter || filter === 'all') return notifications;
    return notifications.filter((item) => {
      const type = String(item.type || '').toLowerCase();
      const title = String(item.title || '').toLowerCase();
      const msg = String(item.message || '').toLowerCase();
      if (filter === 'orders') {
        return type.includes('order') || title.includes('order') || type.includes('referral') || msg.includes('placed by');
      }
      if (filter === 'payments') {
        return type.includes('payment') || title.includes('payment') || type.includes('refund') || msg.includes('payment received');
      }
      if (filter === 'customers') {
        return type.includes('customer') || title.includes('customer') || msg.includes('merch account');
      }
      if (filter === 'inventory') {
        return type.includes('stock') || type.includes('sold out') || title.includes('sold out') || title.includes('stock') || msg.includes('stock') || msg.includes('sold out');
      }
      return true;
    });
  }

  function relativeTime(value) {
    const parsed = parseAppTimestamp(value);
    const seconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) === 1 ? '' : 's'} ago`;
    if (seconds < 172800) return 'Yesterday';
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  function renderNotificationItem(item) {
    const data = resolveNotificationItemData(item);
    const rawType = String(item.type || item.title || '').trim();
    const isPayment = rawType === 'Payment Received' || (item.id && String(item.id).startsWith('payment-')) || /payment received/i.test(item.message || '');
    const isCustomer = rawType === 'New Customer' || (item.id && String(item.id).startsWith('customer-')) || /created a new merch account/i.test(item.message || '');
    const isSoldOut = rawType === 'Sold Out' || rawType === 'Out of Stock' || (item.title && /sold out|out of stock/i.test(item.title)) || (item.message && /is sold out|is out of stock/i.test(item.message));
    const isLowStock = !isSoldOut && (rawType === 'Low Stock' || (item.title && /low stock/i.test(item.title)) || (item.message && /units remaining/i.test(item.message)));
    const isNewOrder = !isPayment && !isSoldOut && (rawType === 'New Order' || (item.id && String(item.id).startsWith('order-')));

    const meta = NOTIFICATION_META[item.type] || {
      label: String(item.title || item.type || 'NOTIFICATION').toUpperCase(),
      dotClass: 'admin-activity__dot--info',
    };

    let typeLabel = meta.label || String(item.type || item.title || 'NOTIFICATION').toUpperCase();
    let dotClass = meta.dotClass || 'admin-activity__dot--info';

    let headlineHtml = '';
    let subHtml = '';
    let pillHtml = '';
    let actionBtnHtml = '';

    if (isPayment) {
      typeLabel = 'PAYMENT RECEIVED';
      dotClass = 'admin-activity__dot--payment';
      const formattedAmount = data.amount != null ? money(data.amount) : '';
      headlineHtml = formattedAmount
        ? `<div class="admin-activity-card__headline"><strong class="admin-activity-card__amount">${escapeHtml(formattedAmount)}</strong> received${data.customerName ? ` from <span class="admin-activity-card__customer">${escapeHtml(data.customerName)}</span>` : ''}</div>`
        : `<div class="admin-activity-card__headline">Payment received${data.customerName ? ` from <span class="admin-activity-card__customer">${escapeHtml(data.customerName)}</span>` : ''}</div>`;
      if (data.orderNumber) {
        subHtml = `<div class="admin-activity-card__sub">Order ${escapeHtml(data.orderNumber)}</div>`;
      }
      pillHtml = `<span class="admin-activity-card__pill admin-activity-card__pill--success">Payment successful</span>`;
      actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-order-activity" data-order-id="${escapeHtml(data.orderId || '')}" data-order-number="${escapeHtml(data.orderNumber || '')}">View order &rarr;</button>`;
    } else if (isCustomer) {
      typeLabel = 'NEW CUSTOMER';
      dotClass = 'admin-activity__dot--customer';
      headlineHtml = `<div class="admin-activity-card__headline"><span class="admin-activity-card__customer">${escapeHtml(data.customerName || 'Customer')}</span> created a new merch account.</div>`;
      actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-customer-activity" data-customer-id="${escapeHtml(data.customerId || '')}" data-customer-name="${escapeHtml(data.customerName || '')}">View customer &rarr;</button>`;
    } else if (isSoldOut) {
      typeLabel = 'SOLD OUT';
      dotClass = 'admin-activity__dot--danger';
      headlineHtml = `<div class="admin-activity-card__headline"><strong class="admin-activity-card__product-name">${escapeHtml(data.productName || 'Hoodie')}</strong></div>`;
      if (data.variantLabel) {
        subHtml = `<div class="admin-activity-card__sub">${escapeHtml(data.variantLabel)}</div>`;
      }
      pillHtml = `<span class="admin-activity-card__pill admin-activity-card__pill--danger">Sold out</span>`;
      actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-product-activity" data-product-id="${escapeHtml(data.productId || '')}" data-product-name="${escapeHtml(data.productName || '')}">View product &rarr;</button>`;
    } else if (isLowStock) {
      typeLabel = 'LOW STOCK';
      dotClass = 'admin-activity__dot--warning';
      headlineHtml = `<div class="admin-activity-card__headline"><strong class="admin-activity-card__product-name">${escapeHtml(data.productName || 'Product')}</strong></div>`;
      if (data.variantLabel) {
        subHtml = `<div class="admin-activity-card__sub">${escapeHtml(data.variantLabel)}</div>`;
      }
      pillHtml = `<span class="admin-activity-card__pill admin-activity-card__pill--warning">${escapeHtml(data.stock != null ? `${data.stock} units remaining` : 'Low stock')}</span>`;
      actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-product-activity" data-product-id="${escapeHtml(data.productId || '')}" data-product-name="${escapeHtml(data.productName || '')}">View product &rarr;</button>`;
    } else if (isNewOrder) {
      typeLabel = 'NEW ORDER';
      dotClass = 'admin-activity__dot--order';
      const formattedAmount = data.amount != null ? money(data.amount) : '';
      headlineHtml = `<div class="admin-activity-card__headline">${formattedAmount ? `<strong class="admin-activity-card__amount">${escapeHtml(formattedAmount)}</strong> &middot; ` : ''}New order${data.customerName ? ` from <span class="admin-activity-card__customer">${escapeHtml(data.customerName)}</span>` : ''}</div>`;
      if (data.orderNumber) {
        subHtml = `<div class="admin-activity-card__sub">Order ${escapeHtml(data.orderNumber)}</div>`;
      }
      pillHtml = `<span class="admin-activity-card__pill admin-activity-card__pill--info">Order placed</span>`;
      actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-order-activity" data-order-id="${escapeHtml(data.orderId || '')}" data-order-number="${escapeHtml(data.orderNumber || '')}">View order &rarr;</button>`;
    } else {
      headlineHtml = `<div class="admin-activity-card__headline">${escapeHtml(item.message || item.title || 'Notification')}</div>`;
      if (data.orderId || data.orderNumber) {
        actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-order-activity" data-order-id="${escapeHtml(data.orderId || '')}" data-order-number="${escapeHtml(data.orderNumber || '')}">View order &rarr;</button>`;
      } else if (data.customerId) {
        actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-customer-activity" data-customer-id="${escapeHtml(data.customerId || '')}" data-customer-name="${escapeHtml(data.customerName || '')}">View customer &rarr;</button>`;
      } else if (data.productId) {
        actionBtnHtml = `<button class="admin-activity-card__action-btn" type="button" data-action="view-product-activity" data-product-id="${escapeHtml(data.productId || '')}" data-product-name="${escapeHtml(data.productName || '')}">View product &rarr;</button>`;
      }
    }

    return `
      <article class="admin-activity-card ${item.read ? '' : 'is-unread'}">
        <div class="admin-activity-card__header">
          <div class="admin-activity-card__type-wrap">
            <span class="admin-activity__dot ${dotClass}" aria-hidden="true"></span>
            <span class="admin-activity-card__type">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="admin-activity-card__meta">
            <time class="admin-activity-card__time" datetime="${escapeHtml(item.time)}">${escapeHtml(relativeTime(item.time))}</time>
            <button class="admin-activity-card__dismiss" type="button" data-action="dismiss-notification" data-notification-id="${escapeHtml(item.id)}" aria-label="Dismiss notification">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 2l8 8M10 2L2 10"/></svg>
            </button>
          </div>
        </div>

        <div class="admin-activity-card__body">
          ${headlineHtml}
          ${subHtml}
        </div>

        <div class="admin-activity-card__footer">
          <div>${pillHtml}</div>
          <div>${actionBtnHtml}</div>
        </div>
      </article>
    `;
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
    const todayOrders = state.orders.filter((order) => getAppDateKey(order.createdAt) === toISODate(today)).length;
    const revenue = state.orders
      .filter((order) => ['paid', 'refunded'].includes(order.paymentStatus) || order.status === 'delivered' || order.status === 'shipped')
      .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    const pending = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'pending').length;
    const processing = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'processing').length;
    const shipped = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'shipped').length;
    const delivered = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'delivered').length;
    const cancelled = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'cancelled').length;
    const returned = state.orders.filter((order) => normalizeOrderStatus(order.status ?? order.orderStatus) === 'returned').length;
    const lowStock = state.products.filter((product) => product.status !== 'archived' && Number(product.stock || 0) > 0 && Number(product.stock || 0) <= LOW_STOCK_THRESHOLD).length;

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
      { label: 'Low Stock Products', value: lowStock, note: `At or below ${LOW_STOCK_THRESHOLD} units remaining`, trend: '-5%', up: false },
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

  function renderRevenueChart(rows, mode = 'bar') {
    const safeRows = Array.isArray(rows) && rows.length ? rows : [{ label: 'No data', value: 0, display: money(0) }];
    const max = Math.max(1, ...safeRows.map((row) => Number(row.value || 0)));
    const points = safeRows.map((row, index) => {
      const x = safeRows.length === 1 ? 50 : (index / (safeRows.length - 1)) * 100;
      const y = 100 - (Number(row.value || 0) / max) * 84 - 8;
      return { ...row, x, y };
    });
    const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
    return `<div class="admin-revenue-chart admin-revenue-chart--${mode}" role="img" aria-label="Revenue chart">
      <div class="admin-revenue-chart__plot">
        <div class="admin-revenue-chart__grid"><span></span><span></span><span></span><span></span></div>
        ${mode === 'line' ? `<svg class="admin-revenue-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${linePoints}" fill="none" stroke="var(--admin-accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" />${points.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="1.8" fill="var(--admin-accent)" />`).join('')}</svg>` : `<div class="admin-revenue-chart__bars" style="grid-template-columns:repeat(${safeRows.length},minmax(0,1fr));">${points.map((point, index) => `<div class="admin-revenue-chart__bar-wrap"><strong>${escapeHtml(point.display)}</strong><span class="admin-revenue-chart__bar" style="height:${Math.max(3, 100 - point.y - 8)}%;background:${REVENUE_BAR_COLORS[index % REVENUE_BAR_COLORS.length]}"></span></div>`).join('')}</div>`}
      </div>
      <div class="admin-revenue-chart__labels" style="grid-template-columns:repeat(${safeRows.length},minmax(0,1fr));">${safeRows.map((row) => `<span>${escapeHtml(row.label)}</span>`).join('')}</div>
    </div>`;
  }

  function formatMonthLabel(monthKey) {
    if (!monthKey) return 'Unknown';
    const parsed = new Date(`${String(monthKey)}-01T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return String(monthKey);
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      year: 'numeric',
    }).format(parsed);
  }

  function buildMonthlyRevenueSeries(orders = []) {
    const monthlyMap = new Map();
    for (const order of Array.isArray(orders) ? orders : []) {
      const paymentStatus = String(order.paymentStatus || '').toLowerCase();
      if (!['paid', 'cod_pending'].includes(paymentStatus)) continue;
      const monthKey = String(order.createdAt || '').slice(0, 7);
      if (!monthKey) continue;
      const entry = monthlyMap.get(monthKey) || { month: monthKey, revenue: 0, orders: 0 };
      entry.revenue += Number(order.totalAmount || 0);
      entry.orders += 1;
      monthlyMap.set(monthKey, entry);
    }
    return [...monthlyMap.values()]
      .sort((left, right) => String(left.month).localeCompare(String(right.month)))
      .map((row) => ({
        month: row.month,
        monthLabel: formatMonthLabel(row.month),
        revenue: row.revenue,
        orders: row.orders,
        display: money(row.revenue),
      }));
  }

  function getRevenueForPeriod(period, monthlyRevenueSeries) {
    if (period === 'custom') {
      const from = new Date(`${state.revenueAppliedFrom || state.revenueFrom}T00:00:00`);
      const to = new Date(`${state.revenueAppliedTo || state.revenueTo}T23:59:59`);
      return state.orders
        .filter((order) => ['paid', 'cod_pending'].includes(String(order.paymentStatus || '').toLowerCase()))
        .filter((order) => {
          const createdAt = new Date(String(order.createdAt || '').replace(' ', 'T'));
          return !Number.isNaN(createdAt.getTime()) && createdAt >= from && createdAt <= to;
        })
        .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
    }
    if (period === 'year') {
      return buildRevenueChartRows('year', monthlyRevenueSeries)
        .reduce((sum, row) => sum + Number(row.value || 0), 0);
    }
    const monthNumber = Number(String(period).split('-')[1]);
    const monthKey = `${today.getFullYear()}-${pad(monthNumber)}`;
    return Number(monthlyRevenueSeries.find((row) => String(row.month) === monthKey)?.revenue || 0);
  }

  function buildRevenueChartRows(period, monthlyRevenueSeries) {
    if (period === 'year') {
      return Array.from({ length: today.getMonth() + 1 }, (_, index) => {
        const date = new Date(today.getFullYear(), index, 1);
        const monthKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
        const row = monthlyRevenueSeries.find((item) => String(item.month) === monthKey);
        return { label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date), value: Number(row?.revenue || 0), display: money(row?.revenue || 0) };
      });
    }
    if (period !== 'custom') {
      const year = today.getFullYear();
      const monthNumber = Number(String(period).split('-')[1]);
      const month = pad(monthNumber);
      const row = monthlyRevenueSeries.find((item) => String(item.month) === `${year}-${month}`);
      return [{
        label: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, monthNumber - 1, 1)),
        value: Number(row?.revenue || 0),
        display: money(row?.revenue || 0),
      }];
    }

    const from = new Date(`${state.revenueAppliedFrom || state.revenueFrom}T00:00:00`);
    const to = new Date(`${state.revenueAppliedTo || state.revenueTo}T23:59:59`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];
    const weeks = new Map();
    state.orders
      .filter((order) => ['paid', 'cod_pending'].includes(String(order.paymentStatus || '').toLowerCase()))
      .forEach((order) => {
        const createdAt = new Date(String(order.createdAt || '').replace(' ', 'T'));
        if (Number.isNaN(createdAt.getTime()) || createdAt < from || createdAt > to) return;
        const weekStart = new Date(createdAt);
        weekStart.setHours(0, 0, 0, 0);
        const day = weekStart.getDay();
        weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
        const key = toISODate(weekStart);
        weeks.set(key, (weeks.get(key) || 0) + Number(order.totalAmount || 0));
      });
    return [...weeks.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, revenue]) => ({
      label: `Week of ${dateLabel(key)}`,
      value: revenue,
      display: money(revenue),
    }));
  }

  function getCouponOverview() {
    const coupons = Array.isArray(state.coupons) ? state.coupons : [];
    const isActive = (coupon) => Number(coupon.active ?? coupon.isActive ?? 0) === 1;
    const isExpired = (coupon) => {
      const expiry = String(coupon.validTill || coupon.expiresAt || coupon.expiry || '').trim();
      return Boolean(expiry) && new Date(expiry).getTime() < Date.now();
    };
    const redemptionsFor = getCouponRedemptionCount;
    const totalRedemptions = coupons.reduce((sum, coupon) => sum + redemptionsFor(coupon), 0);
    const totalDiscountAmount = coupons.reduce((sum, coupon) => sum + getCouponActualDiscountAmount(coupon), 0);
    const topCoupon = [...coupons].sort((left, right) => redemptionsFor(right) - redemptionsFor(left))[0];

    return {
      total: coupons.length,
      active: coupons.filter(isActive).length,
      expiredOrDisabled: coupons.filter((coupon) => !isActive(coupon) || isExpired(coupon)).length,
      totalRedemptions,
      totalDiscountAmount,
      topCoupon: topCoupon && redemptionsFor(topCoupon) > 0 ? `${topCoupon.code || 'Coupon'} · ${formatCount(redemptionsFor(topCoupon))} redemptions` : 'No redemption data yet',
    };
  }

  function getDashboardSnapshot() {
    const stats = state.dashboardStats || {};
    const report = state.reports || {};
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const monthlyRevenueSeries = Array.isArray(stats.monthlyRevenueSeries) && stats.monthlyRevenueSeries.length
      ? stats.monthlyRevenueSeries
      : Array.isArray(report.monthlyRevenueSeries) && report.monthlyRevenueSeries.length
        ? report.monthlyRevenueSeries
        : buildMonthlyRevenueSeries(orders);
    return {
      summary: stats.summary || report.summary || {},
      monthlyRevenueSeries,
      statusBreakdown: stats.statusBreakdown || report.statusBreakdown || {},
    };
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
    const dashboard = getDashboardSnapshot();
    const summary = dashboard.summary || {};
    const monthlyRevenueSeries = Array.isArray(dashboard.monthlyRevenueSeries) ? dashboard.monthlyRevenueSeries : [];
    const couponOverview = getCouponOverview();
    const selectedOrderStatusPeriod = ORDER_STATUS_PERIOD_OPTIONS.find((option) => option.value === state.orderStatusPeriod) || ORDER_STATUS_PERIOD_OPTIONS[0];
    const filteredOrderStatusOrders = filterOrdersByStatusPeriod(
      state.orders,
      selectedOrderStatusPeriod.value,
      state.orderStatusAppliedFrom,
      state.orderStatusAppliedTo
    );
    const liveOrderDistribution = buildOrderStatusDistribution(filteredOrderStatusOrders);
    const liveOrderCount = liveOrderDistribution.total;
    const orderStatusPeriodSubtitle = selectedOrderStatusPeriod.value === 'custom' && state.orderStatusAppliedFrom && state.orderStatusAppliedTo
      ? `From ${dateLabel(state.orderStatusAppliedFrom)} to ${dateLabel(state.orderStatusAppliedTo)}`
      : `Live breakdown for ${selectedOrderStatusPeriod.label.toLowerCase()}`;
    const selectedRevenuePeriod = REVENUE_PERIOD_OPTIONS.find((option) => option.value === state.revenuePeriod) || REVENUE_PERIOD_OPTIONS[0];
    const selectedRevenue = getRevenueForPeriod(selectedRevenuePeriod.value, monthlyRevenueSeries);
    const revenueChartRows = buildRevenueChartRows(selectedRevenuePeriod.value, monthlyRevenueSeries);
    const revenuePeriodSubtitle = selectedRevenuePeriod.value === 'custom' && state.revenueAppliedFrom && state.revenueAppliedTo
      ? `Weekly revenue from ${dateLabel(state.revenueAppliedFrom)} to ${dateLabel(state.revenueAppliedTo)}`
      : `${selectedRevenuePeriod.label} revenue for ${today.getFullYear()}`;
    const activeNotifications = getActiveNotifications();
    const currentFilter = state.activityFilter || 'all';
    const filteredNotifications = filterActivityNotifications(activeNotifications, currentFilter);
    const visibleNotifications = state.notificationsExpanded ? filteredNotifications : filteredNotifications.slice(0, 5);
    const unreadNotificationCount = state.notifications.filter((item) => !item.read && !item.dismissedAt).length;
    if (els.notificationBadgeCount) els.notificationBadgeCount.textContent = String(unreadNotificationCount);

    els.dashboardView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Live Activity</h2>
            <p class="admin-section__desc">Real-time order, payment, inventory, and customer activity.</p>
          </div>
          <button class="admin-btn admin-btn--ghost" type="button" data-action="toggle-notifications">${state.notificationsExpanded ? 'Show less' : 'View all &rarr;'}</button>
        </div>
        <div class="admin-section__body">
          <div class="admin-activity-filter-bar" role="tablist" aria-label="Activity filter">
            <button class="admin-activity-filter-btn ${currentFilter === 'all' ? 'is-active' : ''}" type="button" data-action="set-activity-filter" data-filter="all">All</button>
            <button class="admin-activity-filter-btn ${currentFilter === 'orders' ? 'is-active' : ''}" type="button" data-action="set-activity-filter" data-filter="orders">Orders</button>
            <button class="admin-activity-filter-btn ${currentFilter === 'payments' ? 'is-active' : ''}" type="button" data-action="set-activity-filter" data-filter="payments">Payments</button>
            <button class="admin-activity-filter-btn ${currentFilter === 'customers' ? 'is-active' : ''}" type="button" data-action="set-activity-filter" data-filter="customers">Customers</button>
            <button class="admin-activity-filter-btn ${currentFilter === 'inventory' ? 'is-active' : ''}" type="button" data-action="set-activity-filter" data-filter="inventory">Inventory</button>
          </div>
          <div class="admin-notifications admin-activity-feed">
            ${visibleNotifications.length ? visibleNotifications.map(renderNotificationItem).join('') : `<p class="admin-table__muted" style="margin:0;padding:12px 0;">No ${currentFilter === 'all' ? 'live activity' : currentFilter + ' activity'} to display.</p>`}
          </div>
        </div>
      </section>
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Revenue Overview</h2>
            <p class="admin-section__desc">Revenue, orders, customer activity, and coupon usage streamed from the merch API.</p>
          </div>
        </div>
        <div class="admin-section__body admin-card-grid admin-card-grid--2">
          <article class="admin-card admin-revenue-card">
            <div class="admin-card__head admin-card__head--with-filter">
              <div>
                <h3 class="admin-card__title">Revenue</h3>
                <p class="admin-card__sub">${escapeHtml(revenuePeriodSubtitle)}</p>
              </div>
              <div class="admin-revenue-controls">
                <label class="admin-revenue-filter"><span class="admin-sr-only">Revenue period</span><select class="admin-select" data-input="revenuePeriod" aria-label="Revenue period">${REVENUE_PERIOD_OPTIONS.map((option) => `<option value="${option.value}"${option.value === selectedRevenuePeriod.value ? ' selected' : ''}>${option.label}</option>`).join('')}</select></label>
                <label class="admin-toggle"><input type="checkbox" data-input="revenueChartMode" ${state.revenueChartMode === 'line' ? 'checked' : ''} /><span>Trend line</span></label>
              </div>
            </div>
            ${selectedRevenuePeriod.value === 'custom' ? `
              <div class="admin-revenue-range">
                <label><span>From</span><input class="admin-input" type="date" data-input="revenueFrom" value="${escapeHtml(state.revenueFrom)}" /></label>
                <label><span>To</span><input class="admin-input" type="date" data-input="revenueTo" value="${escapeHtml(state.revenueTo)}" /></label>
                <button class="admin-btn admin-btn--soft" type="button" data-action="apply-revenue-range">Apply</button>
                <button class="admin-btn admin-btn--ghost" type="button" data-action="clear-revenue-range" ${state.revenueAppliedFrom || state.revenueAppliedTo ? '' : 'disabled'}>Clear</button>
              </div>
            ` : ''}
            <div class="admin-card__body admin-mini-chart">
              <p class="admin-table__muted" style="margin:0;">${escapeHtml(selectedRevenuePeriod.value === 'custom' ? revenuePeriodSubtitle : `${selectedRevenuePeriod.label} total: ${money(selectedRevenue)}`)}</p>
              ${renderRevenueChart(revenueChartRows, state.revenueChartMode)}
            </div>
          </article>

          <article class="admin-card">
            <div class="admin-card__head admin-card__head--with-filter admin-order-status__head">
              <div>
                <h3 class="admin-card__title">Order Status Distribution</h3>
                <p class="admin-card__sub">${escapeHtml(orderStatusPeriodSubtitle)}</p>
              </div>
              <div class="admin-status-filter">
                <label>
                  <span class="admin-sr-only">Order status period</span>
                  <select class="admin-select" data-input="orderStatusPeriod" aria-label="Order status period">
                    ${ORDER_STATUS_PERIOD_OPTIONS.map((option) => `<option value="${option.value}"${option.value === selectedOrderStatusPeriod.value ? ' selected' : ''}>${option.label}</option>`).join('')}
                  </select>
                </label>
                ${selectedOrderStatusPeriod.value === 'custom' ? `
                  <div class="admin-order-status-range">
                    <label><span>From</span><input class="admin-input" type="date" data-input="orderStatusFrom" value="${escapeHtml(state.orderStatusFrom)}" /></label>
                    <label><span>To</span><input class="admin-input" type="date" data-input="orderStatusTo" value="${escapeHtml(state.orderStatusTo)}" /></label>
                    <button class="admin-btn admin-btn--soft" type="button" data-action="apply-order-status-range">Apply</button>
                    <button class="admin-btn admin-btn--ghost" type="button" data-action="clear-order-status-range" ${state.orderStatusAppliedFrom || state.orderStatusAppliedTo || state.orderStatusFrom || state.orderStatusTo ? '' : 'disabled'}>Clear</button>
                  </div>
                ` : ''}
              </div>
            </div>
            <div class="admin-card__body" style="display:grid;gap:12px;">
              ${renderOrderStatusRing(liveOrderDistribution)}
              <div class="admin-chip-row" style="justify-content:center;">
                ${renderStatusLegend(liveOrderDistribution)}
              </div>
              <p class="admin-table__muted" style="margin:0;">${escapeHtml(getOrderStatusPeriodSummary(selectedOrderStatusPeriod.value, selectedOrderStatusPeriod.label, liveOrderCount, state.orderStatusAppliedFrom, state.orderStatusAppliedTo))}</p>
            </div>
          </article>
        </div>
      </section>
      <section class="admin-section">
        <div class="admin-section__body">
          <div class="admin-card-grid admin-card-grid--2">
            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Coupon Overview</h3>
                <p class="admin-card__sub">Current coupon performance summary</p>
              </div>
              <div class="admin-card__body admin-coupon-overview">
                <div class="admin-coupon-overview__item"><span>Total Coupons</span><strong>${formatCount(couponOverview.total)}</strong></div>
                <div class="admin-coupon-overview__item"><span>Active Coupons</span><strong>${formatCount(couponOverview.active)}</strong></div>
                <div class="admin-coupon-overview__item"><span>Expired / Disabled</span><strong>${formatCount(couponOverview.expiredOrDisabled)}</strong></div>
                <div class="admin-coupon-overview__item"><span>Total Redemptions</span><strong>${formatCount(couponOverview.totalRedemptions)}</strong></div>
                <div class="admin-coupon-overview__item"><span>Total discount</span><strong>${escapeHtml(money(couponOverview.totalDiscountAmount))}</strong></div>
                <div class="admin-coupon-overview__item admin-coupon-overview__item--wide"><span>Top Performing Coupon</span><strong>${escapeHtml(couponOverview.topCoupon)}</strong></div>
              </div>
            </article>

            <article class="admin-card">
              <div class="admin-card__head admin-card__head--with-filter">
                <div>
                  <h3 class="admin-card__title">Top Trending Products</h3>
                  <p class="admin-card__sub">Admin-curated promotional products</p>
                </div>
                <button class="admin-btn admin-btn--soft" type="button" data-action="open-hype-modal">HYPE</button>
              </div>
              <div class="admin-card__body admin-list">
                ${state.hypes.length ? state.hypes.map((hype) => {
                  const product = state.products.find((item) => Number(item.productId || item.parentProductId || item.id) === Number(hype.productId));
                  return product ? `
                  <div class="admin-list__item">
                    <div class="admin-list__item-head">
                      <div>
                        <p class="admin-list__item-title">${escapeHtml(product.name)}</p>
                        <p class="admin-list__item-sub">${escapeHtml(hype.effectiveLabel || hype.label || 'Hyped product')}</p>
                      </div>
                      <strong>${escapeHtml(product.priceLabel || catalogPrice(product.price))}</strong>
                    </div>
                  </div>
                ` : '';
                }).join('') : '<p class="admin-table__muted" style="margin:0;">No products hyped yet. Click HYPE to curate this section.</p>'}
              </div>
            </article>
        </div>
      </section>
    `;
  }

  function getUniqueAdminProducts() {
    const productsById = new Map();
    state.products.forEach((product) => {
      const productId = Number(product.productId || product.parentProductId || product.id);
      if (!productId || productsById.has(productId)) return;
      productsById.set(productId, product);
    });
    return [...productsById.values()];
  }

  function renderHypeModal() {
    const hypesByProductId = new Map(state.hypes.map((hype) => [Number(hype.productId), hype]));
    const options = [
      'Most Selling Product', 'Limited Stock — Hurry Up', 'Customer Favorite',
      'Best Rated', 'Trending Now', 'Most Loved', 'Popular Choice', 'Custom Label',
    ];
    openModal({
      title: 'Curate Top Trending Products',
      subtitle: 'HYPE',
      size: 'lg',
      body: `
        <form id="hypeConfigForm" class="admin-hype-form">
          <p class="admin-table__muted">Select one or more existing products and assign the label customers will see on the storefront.</p>
          <div class="admin-hype-list">
            ${getUniqueAdminProducts().map((product) => {
              const productId = Number(product.productId || product.parentProductId || product.id);
              const existing = hypesByProductId.get(productId);
              const selectedLabel = existing?.label || options[0];
              return `
                <div class="admin-hype-row">
                  <label class="admin-hype-row__product">
                    <input type="checkbox" name="hypedProductId" value="${productId}" ${existing ? 'checked' : ''} />
                    <span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || '')}</small></span>
                  </label>
                  <label class="admin-hype-row__label">Label
                    <select name="hypeLabel-${productId}" class="admin-select" data-hype-label-select>
                      ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === selectedLabel ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                    </select>
                  </label>
                  <label class="admin-hype-row__custom" data-hype-custom-wrap ${selectedLabel === 'Custom Label' ? '' : 'hidden'}>Custom text
                    <input class="admin-input" name="hypeCustomLabel-${productId}" maxlength="60" value="${escapeHtml(existing?.customLabel || '')}" placeholder="Short label" />
                  </label>
                </div>
              `;
            }).join('')}
          </div>
        </form>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button><button class="admin-btn admin-btn--primary" type="button" data-action="save-hype-config">Save</button>',
    });
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

  function renderBulkProductEditModal() {
    const selected = selectedProductsOnPage();
    if (!selected.length) {
      toast('Select products', 'Select at least one product before editing.', 'warning');
      return;
    }
    // A single selected product should use the complete product editor. Keep
    // the table editor for multi-select updates, while combo rows continue to
    // open their dedicated editor with component products and stock fields.
    if (selected.length === 1) {
      if (selected[0].isCombo) {
        renderComboFormModal([], selected[0]);
      } else {
        renderEntityFormModal('product', selected[0]);
      }
      return;
    }
    openModal({
      title: 'Edit selected products',
      subtitle: `${selected.length} product${selected.length === 1 ? '' : 's'} selected`,
      body: `
        <form class="admin-form" data-bulk-edit-form>
          <p class="admin-table__muted" style="margin:0 0 14px;">Choose the rows to update, then change the product name, SKU, price, or stock.</p>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th><input type="checkbox" data-bulk-edit-select-all checked aria-label="Select all products to edit" /></th><th>Product</th><th>Name</th><th>SKU</th><th>Price (rupees)</th><th>Stock</th></tr></thead>
              <tbody>
                ${selected.map((product) => `
                  <tr>
                    <td><input type="checkbox" name="productId" value="${product.id}" checked /></td>
                    <td><strong>${escapeHtml(product.name)}</strong><br><span class="admin-table__muted">${escapeHtml(product.variantLabel || 'Default variant')}</span></td>
                    <td><input class="admin-input" name="name-${product.id}" value="${escapeHtml(product.name)}" /></td>
                    <td><input class="admin-input" name="sku-${product.id}" value="${escapeHtml(product.sku)}" /></td>
                    <td><input class="admin-input" name="price-${product.id}" type="number" min="0" step="1" value="${escapeHtml(Number(product.price || 0))}" /></td>
                    <td><input class="admin-input" name="stock-${product.id}" type="number" min="0" step="1" value="${escapeHtml(Number(product.stock || 0))}" /></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </form>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button><button class="admin-btn admin-btn--primary" type="button" data-action="save-bulk-product-edit">Save changes</button>',
      size: 'xl',
    });
    const form = els.adminModalDialog.querySelector('[data-bulk-edit-form]');
    els.adminModalDialog.querySelector('[data-bulk-edit-select-all]')?.addEventListener('change', (event) => {
      form?.querySelectorAll('input[name="productId"]').forEach((checkbox) => { checkbox.checked = event.target.checked; });
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
    const selectedProducts = selectedProductsOnPage();
    const selectedAreArchived = selectedCount > 0 && selectedProducts.length > 0 && selectedProducts.every((product) => product.archived);
    const lowStockCount = getLowStockProducts(filtered).length;

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
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-combo-on" ${selectedCount ? '' : 'disabled'}>Add to Combo</button>
            </div>
          </div>

          <div class="admin-grid admin-grid--stats admin-product-kpis" style="margin-bottom:18px;">
            ${[
              { label: 'Products in view', value: filtered.length, note: 'Matching current filters', trend: '+8%', up: true },
              { label: 'Low stock', value: lowStockCount, note: `At or below ${LOW_STOCK_THRESHOLD} units remaining`, trend: '-2%', up: false },
              { label: 'Archived', value: state.products.filter((product) => product.archived).length, note: 'Hidden from storefront', trend: '+1%', up: true },
              { label: 'Combo products', value: new Set(state.products.filter((product) => product.isCombo).map((product) => Number(product.parentProductId || product.productId || product.id))).size, note: 'Published combo cards', trend: '+1%', up: true },
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

          <div class="admin-combo-guide" role="note">
            <strong>How to create a combo product</strong>
            <ol>
              <li>Select at least two product variants using the checkboxes below.</li>
              <li>Click <em>Add to Combo</em>, then add the combo image, details, and overall selling price.</li>
              <li>The combo appears here as its own product and on the customer merch page.</li>
              <li>Customers purchase the combo price from stock allocated separately to the combo.</li>
            </ol>
          </div>

          ${selectedCount ? `<div class="admin-toolbar" style="margin:0 0 14px;"><strong>${selectedCount} selected</strong><span class="admin-table__muted">Bulk actions available</span></div>` : ''}

          <div class="admin-table-wrap">
            <div class="admin-toolbar" style="justify-content:flex-end;margin:0 0 12px;">
              <span class="admin-table__muted" style="margin-right:auto;">${selectedCount ? `${selectedCount} selected` : 'Select products to manage them'}</span>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-edit" ${selectedCount ? '' : 'disabled'}>Edit</button>
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-archive" ${selectedCount ? '' : 'disabled'}>${selectedAreArchived ? 'Restore' : 'Archive'}</button>
              <button class="admin-btn admin-btn--danger" type="button" data-action="bulk-delete" ${selectedCount ? '' : 'disabled'}>Delete</button>
            </div>
            <table class="admin-table">
              <thead>
                <tr>
                  <th><input type="checkbox" data-action="toggle-product-page-selection" ${pageItems.length && pageItems.every((item) => state.selectedProductIds.includes(item.id)) ? 'checked' : ''} /></th>
                  <th>Image</th>
                  <th>Product</th>
                  <th>Variant</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                ${pageItems.map((product) => `
                  <tr>
                    <td><input type="checkbox" data-action="toggle-product-selection" data-id="${product.id}" ${state.selectedProductIds.includes(product.id) ? 'checked' : ''} /></td>
                    <td><img class="admin-thumb" src="${escapeHtml(product.image || getProductFallbackImage(product))}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${escapeHtml(getProductFallbackImage(product))}';" /></td>
                    <td><strong>${escapeHtml(product.name)}</strong><br><span class="admin-table__muted">${escapeHtml(product.description)}</span></td>
                    <td>${escapeHtml(product.variantLabel || 'Default variant')}</td>
                    <td>${escapeHtml(product.sku)}</td>
                    <td>${escapeHtml(product.category)}</td>
                    <td><strong>${escapeHtml(product.priceLabel || catalogPrice(product.price))}</strong></td>
                    <td><strong class="${getStockClass(product)}">${formatCount(product.stock)}</strong></td>
                    <td><span class="admin-badge ${statusClass(product.status)}">${escapeHtml(getStatusLabel(product.status))}</span></td>
                    <td>${escapeHtml(dateLabel(product.createdAt))}</td>
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

  function renderTrash() {
    const trashItems = state.trashProducts.flatMap((product) => [
      ...(product.isDeleted ? [{ ...product, trashType: 'product', trashId: Number(product.id) }] : []),
      ...(product.isDeleted ? [] : (product.variants || []).filter((variant) => variant.deletedAt).map((variant) => ({
        ...product,
        ...variant,
        trashType: 'variant',
        trashId: Number(variant.id),
        parentProductId: Number(product.id),
        productName: product.name,
        image: product.image || product.imageUrl,
        deletedBy: variant.deletedBy,
        deletedAt: variant.deletedAt,
      }))),
    ]);
    const pageSize = 5;
    const totalPages = Math.max(1, Math.ceil(trashItems.length / pageSize));
    if (state.trashProductsPage > totalPages) state.trashProductsPage = totalPages;
    const start = (state.trashProductsPage - 1) * pageSize;
    const pageItems = trashItems.slice(start, start + pageSize);
    const selectedCount = state.selectedTrashProductIds.length + state.selectedTrashVariantIds.length;
    const isSelected = (item) => item.trashType === 'variant'
      ? state.selectedTrashVariantIds.includes(item.trashId)
      : state.selectedTrashProductIds.includes(item.trashId);
    const pageSelected = pageItems.length > 0 && pageItems.every(isSelected);

    els.trashView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Deleted Products</h2>
            <p class="admin-section__desc">Deleted products remain recoverable here with their original IDs, variants, prices, inventory, and image references.</p>
          </div>
          <span class="admin-chip">${trashItems.length} in Bin</span>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar">
            <span class="admin-table__muted">${selectedCount ? `${selectedCount} selected` : 'Select deleted products to restore or permanently delete'}</span>
            <div class="admin-toolbar__group">
              <button class="admin-btn admin-btn--soft" type="button" data-action="bulk-restore-trash" ${selectedCount ? '' : 'disabled'}>Restore Selected</button>
              <button class="admin-btn admin-btn--danger" type="button" data-action="bulk-permanent-delete-trash" ${selectedCount ? '' : 'disabled'}>Delete Permanently</button>
            </div>
          </div>
          ${state.trashLoading ? '<p class="admin-table__muted">Loading Bin...</p>' : pageItems.length ? `
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr>
                  <th><input type="checkbox" data-action="toggle-trash-page-selection" ${pageSelected ? 'checked' : ''} aria-label="Select all Bin items on this page" /></th>
                  <th>Image</th><th>Product</th><th>Variants</th><th>Price</th><th>Deleted By</th><th>Deleted Date</th><th>Actions</th>
                </tr></thead>
                <tbody>${pageItems.map((product) => `
                  <tr>
                    <td><input type="checkbox" data-action="toggle-trash-selection" data-id="${product.trashId}" data-trash-type="${product.trashType}" ${isSelected(product) ? 'checked' : ''} aria-label="Select ${escapeHtml(product.name)}" /></td>
                    <td><img class="admin-thumb" src="${escapeHtml(normalizeAdminImageUrl(product.imageUrl || product.image, getProductFallbackImage(product)))}" alt="${escapeHtml(product.name)}" /></td>
                    <td><strong>${escapeHtml(product.trashType === 'variant' ? `${product.name} · ${product.variantLabel || [product.size, product.color].filter(Boolean).join(' / ') || 'Variant'}` : product.name)}</strong><br><span class="admin-table__muted">${product.trashType === 'variant' ? `Variant ID ${escapeHtml(product.trashId)} · Product ID ${escapeHtml(product.parentProductId)}` : `Product ID ${escapeHtml(product.id)} · ${escapeHtml(product.slug)}`}</span></td>
                    <td>${product.trashType === 'variant' ? escapeHtml(product.sku || '-') : `${escapeHtml(product.variantCount || 0)}<br><span class="admin-table__muted">${escapeHtml((product.variants || []).slice(0, 3).map((variant) => variant.sku).filter(Boolean).join(', '))}${(product.variants || []).length > 3 ? '…' : ''}</span>`}</td>
                    <td>${escapeHtml(product.priceLabel || catalogPrice(product.price))}</td>
                    <td>${escapeHtml(product.deletedBy || 'Admin')}</td>
                    <td>${escapeHtml(dateLabel(product.deletedAt))}</td>
                    <td><div class="admin-actions"><button class="admin-action-link" type="button" data-action="restore-trash-${product.trashType}" data-id="${product.trashId}">Restore</button><button class="admin-action-link admin-action-link--danger" type="button" data-action="permanent-delete-trash-${product.trashType}" data-id="${product.trashId}">Delete permanently</button></div></td>
                  </tr>
                `).join('')}</tbody>
              </table>
            </div>
            <div class="admin-toolbar" style="margin-top:16px;"><span class="admin-table__muted">Page ${state.trashProductsPage} of ${totalPages}</span><div class="admin-toolbar__group"><button class="admin-btn admin-btn--ghost" type="button" data-action="trash-prev" ${state.trashProductsPage <= 1 ? 'disabled' : ''}>Previous</button><button class="admin-btn admin-btn--ghost" type="button" data-action="trash-next" ${state.trashProductsPage >= totalPages ? 'disabled' : ''}>Next</button></div></div>
          ` : '<p class="admin-table__muted">Bin is empty.</p>'}
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

  function getOrderCreatedAt(order) {
    const rawValue = order?.createdAt ?? order?.created_at ?? order?.orderDate ?? order?.date ?? '';
    const raw = String(rawValue).trim();
    if (!raw) return new Date('invalid');
    return parseAppTimestamp(raw);
  }

  function filteredOrders() {
    const query = state.ordersSearch.trim().toLowerCase();
    const todayStart = new Date(`${toISODate(today)}T00:00:00`);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const rangeStart = state.ordersAppliedDateFrom ? new Date(`${state.ordersAppliedDateFrom}T00:00:00`) : null;
    const rangeEnd = state.ordersAppliedDateTo ? new Date(`${state.ordersAppliedDateTo}T00:00:00`) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);

    return [...state.orders].filter((order) => {
      const matchesStatus = state.ordersStatus === 'all' || order.status === state.ordersStatus;
      const matchesQuery =
        !query ||
        [order.orderNumber, order.customerName, hasRealEmail(order.email) ? order.email : '', order.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      const createdAt = getOrderCreatedAt(order);
      const matchesToday = !state.ordersTodayOnly || (createdAt >= todayStart && createdAt < tomorrowStart);
      const matchesFrom = !rangeStart || (createdAt >= rangeStart);
      const matchesTo = !rangeEnd || (createdAt < rangeEnd);
      return matchesStatus && matchesQuery && matchesToday && matchesFrom && matchesTo;
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
              <p class="admin-list__item-sub">${escapeHtml(order.customerName)}${hasRealEmail(order.email) ? ` - ${escapeHtml(order.email)}` : ''}</p>
            </div>
            <span class="admin-badge ${statusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span>
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Customer Information</p>
          <p class="admin-list__item-sub">${escapeHtml(order.customerName)}<br>${escapeHtml(displayEmail(order.email))}<br>${escapeHtml(order.phone)}</p>
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
            Coupon Discount: ${escapeHtml(order.couponCode ? money(order.discountAmount) : 'None')}<br>
            Influencer Coupon: ${escapeHtml(order.influencerCoupon || 'None')}<br>
            Tracking: ${escapeHtml(order.trackingNumber || 'Pending')}<br>
            Carrier: ${escapeHtml(order.carrier || 'Not assigned')}
          </p>
        </div>
        <div class="admin-list__item" style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:12px 14px;margin:10px 0;">
          <div class="admin-list__item-head" style="margin-bottom:6px;display:flex;align-items:center;justify-content:space-between;">
            <p class="admin-list__item-title" style="margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;">
              <span>🚀 Shiprocket Fulfillment</span>
            </p>
            ${order.shiprocketStatus ? `<span class="admin-badge admin-badge--info" style="font-size:10px;text-transform:uppercase;">${escapeHtml(order.shiprocketStatus)}</span>` : ''}
          </div>
          <div class="admin-list__item-sub" style="margin-bottom:10px;font-size:12px;line-height:1.6;">
            ${order.shiprocketOrderId ? `<strong>Shiprocket Order:</strong> ${escapeHtml(order.shiprocketOrderId)}<br>` : ''}
            ${order.shiprocketAwbCode ? `<strong>AWB Code:</strong> <code style="background:rgba(0,0,0,0.06);padding:2px 5px;border-radius:4px;font-weight:600;">${escapeHtml(order.shiprocketAwbCode)}</code> (${escapeHtml(order.shiprocketCourierName || order.carrier || 'Courier')})<br>` : ''}
            ${order.shiprocketPickupToken ? `<strong>Pickup Token:</strong> ${escapeHtml(order.shiprocketPickupToken)}<br>` : ''}
          </div>
          <div class="admin-actions" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            ${!order.shiprocketAwbCode ? `
              <button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="shiprocket-fulfill" data-id="${order.id}">🚀 Ship with Shiprocket</button>
            ` : `
              ${order.shiprocketLabelUrl ? `
                <a class="admin-btn admin-btn--soft admin-btn--sm" href="${escapeHtml(order.shiprocketLabelUrl)}" target="_blank" rel="noopener">📄 Print Shipping Label</a>
              ` : `
                <button class="admin-btn admin-btn--soft admin-btn--sm" type="button" data-action="shiprocket-get-label" data-id="${order.id}">📄 Get Shipping Label</button>
              `}
              ${!order.shiprocketPickupToken ? `
                <button class="admin-btn admin-btn--ghost admin-btn--sm" type="button" data-action="shiprocket-schedule-pickup" data-id="${order.id}">📦 Schedule Pickup</button>
              ` : `
                <span class="admin-badge admin-badge--success" style="font-size:11px;">✓ Pickup Booked</span>
              `}
              <button class="admin-btn admin-btn--ghost admin-btn--sm" type="button" data-action="shiprocket-track-live" data-id="${order.id}">📍 Live Tracking</button>
            `}
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Invoice &amp; Receipt</p>
          <div class="admin-actions">
            <button class="admin-action-link" type="button" data-action="open-order-invoice" data-id="${order.id}">View Invoice</button>
            <button class="admin-action-link" type="button" data-action="email-order-invoice" data-id="${order.id}">Email Invoice</button>
            <button class="admin-action-link" type="button" data-action="download-order-invoice" data-id="${order.id}">Download PDF</button>
          </div>
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

  function renderOrderEditModal(orders) {
    const selected = Array.isArray(orders) ? orders.filter(Boolean) : [];
    if (!selected.length) {
      toast('Select orders', 'Select at least one order before editing.', 'warning');
      return;
    }
    openModal({
      title: 'Edit selected orders',
      subtitle: `${selected.length} order${selected.length === 1 ? '' : 's'} selected`,
      body: `
        <form class="admin-form" data-order-edit-form>
          <label class="admin-field"><span>Set status for selected orders</span>
            <select class="admin-select" name="status">
              ${Object.keys(ORDER_STATUS_META).map((status) => `<option value="${status}">${escapeHtml(getStatusLabel(status))}</option>`).join('')}
            </select>
          </label>
          <div class="admin-list" style="margin-top:14px;">
            ${selected.map((order) => `<div class="admin-list__item"><div class="admin-list__item-head"><div><strong>${escapeHtml(order.orderNumber || `Order #${order.id}`)}</strong><span class="admin-table__muted">${escapeHtml(order.customerName || '')}</span></div><span class="admin-badge ${statusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span></div></div>`).join('')}
          </div>
          <p class="admin-table__muted" style="margin:14px 0 6px;">Actions apply to every selected order.</p>
          <div class="admin-actions">
            <button class="admin-action-link" type="button" data-action="bulk-order-invoice">Invoice</button>
            <button class="admin-action-link" type="button" data-action="bulk-order-email">Email</button>
            <button class="admin-action-link" type="button" data-action="bulk-order-download">Download / Print</button>
            <button class="admin-action-link" type="button" data-action="bulk-order-cancel">Cancel</button>
            <button class="admin-action-link" type="button" data-action="bulk-order-refund">Refund</button>
          </div>
        </form>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button><button class="admin-btn admin-btn--primary" type="button" data-action="save-order-edits">Save status</button>',
      size: 'lg',
    });
  }

  function renderOrders() {
    if (state.ordersLoading) {
      els.ordersView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Orders</h2>
              <p class="admin-section__desc">Loading live merch orders from the database...</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('Loading orders', 'Pulling the latest merch checkout activity into the dashboard.')}
          </div>
        </section>
      `;
      return;
    }

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
    const selectedOrder = state.selectedOrderId == null
      ? null
      : filtered.find((order) => Number(order.id) === Number(state.selectedOrderId)) || null;
    const showOrderDetails = Boolean(selectedOrder);

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
            <div class="admin-orders-filter-row">
              <div class="admin-toolbar__group">
                <div class="admin-orders-date-range${state.ordersAppliedDateFrom || state.ordersAppliedDateTo ? ' is-active' : ''}" aria-label="Order date range">
                  <label class="admin-orders-date-field"><span>From</span><input class="admin-input" type="date" data-input="ordersDateFrom" value="${escapeHtml(state.ordersDateFrom)}" /></label>
                  <label class="admin-orders-date-field"><span>To</span><input class="admin-input" type="date" data-input="ordersDateTo" value="${escapeHtml(state.ordersDateTo)}" /></label>
                  <button class="admin-btn ${state.ordersAppliedDateFrom || state.ordersAppliedDateTo ? 'admin-btn--primary' : 'admin-btn--soft'}" type="button" data-action="apply-orders-date-range">Apply</button>
                  <button class="admin-btn admin-btn--ghost" type="button" data-action="clear-orders-date-range" ${state.ordersAppliedDateFrom || state.ordersAppliedDateTo || state.ordersDateFrom || state.ordersDateTo ? '' : 'disabled'}>Clear</button>
                </div>
              </div>
              <div class="admin-toolbar__group">
                <button class="admin-btn ${state.ordersStatus === 'all' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="all">All</button>
                <button class="admin-btn ${state.ordersTodayOnly ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-action="toggle-orders-today">Today</button>
                <button class="admin-btn ${state.ordersStatus === 'pending' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="pending">Pending</button>
                <button class="admin-btn ${state.ordersStatus === 'processing' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="processing">Processing</button>
                <button class="admin-btn ${state.ordersStatus === 'shipped' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="shipped">Shipped</button>
                <button class="admin-btn ${state.ordersStatus === 'delivered' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="delivered">Delivered</button>
                <button class="admin-btn ${state.ordersStatus === 'cancelled' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="cancelled">Cancelled</button>
                <button class="admin-btn ${state.ordersStatus === 'returned' ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-order-filter="returned">Returned</button>
              </div>
            </div>
          </div>

          <div class="admin-grid admin-grid--two" ${showOrderDetails ? '' : 'style="grid-template-columns:1fr;"'}>
            <section class="admin-card">
              <div class="admin-card__head admin-card__head--with-actions">
                <div><h3 class="admin-card__title">Order List</h3><p class="admin-card__sub">${filtered.length} order(s) match the current filters</p></div>
                <button class="admin-btn admin-btn--soft admin-edit-action admin-order-edit-action" type="button" data-action="edit-selected-orders" ${state.selectedOrderIds.length ? '' : 'disabled'}>Edit${state.selectedOrderIds.length ? ` (${state.selectedOrderIds.length})` : ''}</button>
              </div>
              <div class="admin-card__body admin-table-wrap">
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th><input type="checkbox" data-action="toggle-orders-page-selection" ${pageItems.length && pageItems.every((item) => state.selectedOrderIds.includes(Number(item.id))) ? 'checked' : ''} aria-label="Select visible orders" /> Order ID</th>
                      <th>Customer</th>
                      <th>Discount</th>
                      <th>Payment</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageItems.map((order) => `
                      <tr class="${Number(state.selectedOrderId) === Number(order.id) ? 'is-selected' : ''}" data-action="select-order" data-id="${order.id}" style="cursor:pointer;">
                        <td><input type="checkbox" data-action="toggle-order-selection" data-id="${order.id}" ${state.selectedOrderIds.includes(Number(order.id)) ? 'checked' : ''} aria-label="Select ${escapeHtml(order.orderNumber)}" /> <strong>${escapeHtml(order.orderNumber)}</strong><br><span class="admin-table__muted">${escapeHtml(dateLabel(order.createdAt))}</span></td>
                        <td>${escapeHtml(order.customerName)}<br><span class="admin-table__muted">${escapeHtml(displayEmail(order.email))}</span></td>
                        <td>${escapeHtml(order.couponCode ? money(order.discountAmount) : '—')}</td>
                        <td>${escapeHtml(order.paymentMethod.toUpperCase())}<br><span class="admin-table__muted">${escapeHtml(getStatusLabel(order.paymentStatus))}</span></td>
                        <td><strong>${escapeHtml(money(order.totalAmount))}</strong></td>
                        <td>
                          <span class="admin-badge ${statusClass(order.status)}">${escapeHtml(getStatusLabel(order.status))}</span>
                        </td>
                        <td>
                          <div style="display:flex;align-items:center;gap:8px;flex-wrap:nowrap;">
                            ${!order.shiprocketAwbCode && !['cancelled', 'delivered', 'returned'].includes(normalizeOrderStatus(order.status)) ? `
                              <button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="shiprocket-fulfill" data-id="${order.id}" style="padding:3px 8px;font-size:11px;font-weight:600;white-space:nowrap;">🚀 Ship</button>
                            ` : ''}
                            <button class="admin-action-link" type="button" data-action="track-admin-order" data-id="${order.id}" style="white-space:nowrap;">Track</button>
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

            ${showOrderDetails ? `
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
                      ${!selectedOrder?.shiprocketAwbCode ? `<button class="admin-btn admin-btn--primary" type="button" data-action="shiprocket-fulfill" data-id="${selectedOrder?.id || ''}">🚀 Ship with Shiprocket</button>` : ''}
                      <button class="admin-btn admin-btn--ghost" type="button" data-action="ship-order" data-id="${selectedOrder?.id || ''}">Ship</button>
                      <button class="admin-btn admin-btn--ghost" type="button" data-action="deliver-order" data-id="${selectedOrder?.id || ''}">Deliver</button>
                      <button class="admin-btn admin-btn--danger" type="button" data-action="cancel-order" data-id="${selectedOrder?.id || ''}" ${['delivered', 'returned', 'cancelled'].includes(normalizeOrderStatus(selectedOrder?.status)) ? 'disabled title="Delivered and returned orders cannot be cancelled"' : ''}>Cancel</button>
                      <button class="admin-btn admin-btn--soft" type="button" data-action="refund-order" data-id="${selectedOrder?.id || ''}">Refund</button>
                    </div>
                  </div>
                </article>
              </section>
            ` : ''}
          </div>
        </div>
      </section>
    `;
  }

  function renderCustomerDetail(customer) {
    if (!customer) {
      return `<p class="admin-table__muted">Select a customer to view profile details.</p>`;
    }
    const addressList = Array.isArray(customer.addresses) && customer.addresses.length
      ? customer.addresses.map((address) => `
          <div style="margin-bottom:0.75rem;">
            <strong>${escapeHtml(address.label || address.source || 'Address')}</strong><br>
            <span class="admin-table__muted">${escapeHtml(address.text)}</span>
          </div>
        `).join('')
      : '<p class="admin-table__muted" style="margin:0;">No saved addresses yet.</p>';
    const registrationDate = customer.registrationDate || customer.registeredAt || '';
    const lastOrderLabel = customer.lastOrder?.orderNumber
      ? `${customer.lastOrder.orderNumber}${customer.lastOrder.createdAt ? ` - ${dateLabel(customer.lastOrder.createdAt)}` : ''}`
      : customer.lastOrderLabel || 'No orders yet';
    return `
      <div class="admin-list">
        <div class="admin-list__item">
          <div class="admin-list__item-head">
            <div>
              <p class="admin-list__item-title">${escapeHtml(customer.name)}</p>
              <p class="admin-list__item-sub">${escapeHtml(displayEmail(customer.email))}</p>
            </div>
            <span class="admin-avatar">${escapeHtml(initials(customer.name))}</span>
          </div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Merchandise Orders</p>
          <p class="admin-list__item-sub">${formatCount(customer.merchandiseOrders)} order(s)</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Last Order</p>
          <p class="admin-list__item-sub">${escapeHtml(lastOrderLabel)}${customer.lastOrder?.couponCode ? `<br>Coupon: ${escapeHtml(customer.lastOrder.couponCode)} · Discount: ${escapeHtml(money(customer.lastOrder.discountAmount))}` : ''}</p>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Coupons Redeemed</p>
          <p class="admin-list__item-sub">${customer.couponRedemptions?.length ? customer.couponRedemptions.map((entry) => `${escapeHtml(entry.couponCode)} (${escapeHtml(money(entry.discountAmount))})`).join('<br>') : 'None'}</p>
          ${customer.couponDiscountTotal ? `<p class="admin-list__item-sub">Total discount: ${escapeHtml(money(customer.couponDiscountTotal))}</p>` : ''}
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Addresses</p>
          <div class="admin-list__item-sub">${addressList}</div>
        </div>
        <div class="admin-list__item">
          <p class="admin-list__item-title">Registration Date</p>
          <p class="admin-list__item-sub">${escapeHtml(dateLabel(registrationDate))}</p>
        </div>
      </div>
    `;
  }

  function getCustomerCreatedAt(customer) {
    const rawValue = customer?.registrationDate ?? customer?.registeredAt ?? customer?.createdAt ?? customer?.created_at ?? '';
    const raw = String(rawValue).trim();
    if (!raw) return new Date('invalid');
    return new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T00:00:00` : raw.replace(' ', 'T'));
  }

  function getCustomersDateValidation(from, to) {
    const todayIso = getLocalDateInputMax();
    if ((from && from > todayIso) || (to && to > todayIso)) return 'Future dates are not allowed.';
    if (from && to && from > to) return 'From date cannot be later than To date.';
    return '';
  }

  function renderCustomers() {
    if (state.customersLoading && !state.customers.length) {
      els.customersView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Customers</h2>
              <p class="admin-section__desc">Loading live merchandise customer data...</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('Loading customers', 'Pulling live merch profiles, orders, and addresses from the store API.')}
          </div>
        </section>
      `;
      return;
    }

    if (!state.customers.length) {
      els.customersView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Customers</h2>
              <p class="admin-section__desc">No live merch customer data is connected yet.</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('No customer profiles', 'Connect the customer API to view profiles, orders, addresses, and loyalty details.')}
          </div>
        </section>
      `;
      return;
    }

    const customerDateMax = getLocalDateInputMax();
    const query = state.customersSearch.trim().toLowerCase();
    const todayStart = new Date(`${toISODate(today)}T00:00:00`);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    const rangeStart = state.customersAppliedDateFrom ? new Date(`${state.customersAppliedDateFrom}T00:00:00`) : null;
    const rangeEnd = state.customersAppliedDateTo ? new Date(`${state.customersAppliedDateTo}T00:00:00`) : null;
    if (rangeEnd) rangeEnd.setDate(rangeEnd.getDate() + 1);
    const filtered = state.customers.filter((customer) => {
      const matchesQuery = !query || [
        customer.name,
        hasRealEmail(customer.email) ? customer.email : '',
        customer.phone,
        customer.addressSummary,
        customer.lastOrderLabel,
        String(customer.merchandiseOrders || ''),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      const createdAt = getCustomerCreatedAt(customer);
      const matchesToday = !state.customersTodayOnly || (createdAt >= todayStart && createdAt < tomorrowStart);
      const matchesFrom = !rangeStart || (createdAt >= rangeStart);
      const matchesTo = !rangeEnd || (createdAt < rangeEnd);
      return !Number.isNaN(createdAt.getTime()) && matchesQuery && matchesToday && matchesFrom && matchesTo;
    });
    const selectedCustomer = state.selectedCustomerId == null
      ? null
      : filtered.find((customer) => String(customer.id) === String(state.selectedCustomerId)) || null;
    const showCustomerDetails = Boolean(selectedCustomer);

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
              <input class="admin-input" data-input="customersSearch" value="${escapeHtml(state.customersSearch)}" placeholder="Search by name, email, phone, address, or last order" />
            </div>
            <div class="admin-orders-filter-row">
              <div class="admin-toolbar__group">
                <div class="admin-orders-date-range${state.customersAppliedDateFrom || state.customersAppliedDateTo ? ' is-active' : ''}">
                  <button class="admin-btn ${state.customersTodayOnly ? 'admin-btn--primary' : 'admin-btn--ghost'}" type="button" data-action="toggle-customers-today">Today</button>
                  <label class="admin-orders-date-field"><span>From</span><input class="admin-input" type="date" data-input="customersDateFrom" value="${escapeHtml(state.customersDateFrom)}" max="${customerDateMax}" /></label>
                  <label class="admin-orders-date-field"><span>To</span><input class="admin-input" type="date" data-input="customersDateTo" value="${escapeHtml(state.customersDateTo)}" max="${customerDateMax}" /></label>
                  <button class="admin-btn admin-btn--soft" type="button" data-action="apply-customers-date-range">Apply</button>
                  <button class="admin-btn admin-btn--ghost" type="button" data-action="clear-customers-date-range" ${state.customersAppliedDateFrom || state.customersAppliedDateTo || state.customersDateFrom || state.customersDateTo || state.customersDateValidation ? '' : 'disabled'}>Clear</button>
                  ${state.customersDateValidation ? `<p class="admin-table__muted" style="width:100%;margin:2px 0 0;color:var(--admin-danger);" role="alert">${escapeHtml(state.customersDateValidation)}</p>` : ''}
                </div>
              </div>
            </div>
          </div>

          <div class="admin-grid admin-grid--two" ${showCustomerDetails ? '' : 'style="grid-template-columns:1fr;"'}>
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Customer List</h3>
                <p class="admin-card__sub">${filtered.length} customer(s) matched</p>
              </div>
              <div class="admin-card__body admin-table-wrap">
                <table class="admin-table admin-customer-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Merchandise Orders</th>
                      <th>Coupon / Discount</th>
                      <th>Last Order</th>
                      <th>Addresses</th>
                      <th>Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((customer) => `
                      <tr data-action="select-customer" data-id="${customer.id}" style="cursor:pointer;">
                        <td data-label="Name"><strong>${escapeHtml(customer.name)}</strong></td>
                        <td data-label="Email">${escapeHtml(displayEmail(customer.email))}</td>
                        <td data-label="Phone">${escapeHtml(customer.phone)}</td>
                        <td data-label="Merchandise orders">${escapeHtml(formatCount(customer.merchandiseOrders))}</td>
                        <td data-label="Coupon / discount">${customer.lastOrder?.couponCode ? `${escapeHtml(customer.lastOrder.couponCode)}<br><span class="admin-table__muted">${escapeHtml(money(customer.lastOrder.discountAmount))}</span>` : '—'}</td>
                        <td data-label="Last order">${escapeHtml(customer.lastOrder?.orderNumber ? `${customer.lastOrder.orderNumber}${customer.lastOrder.createdAt ? ` - ${dateLabel(customer.lastOrder.createdAt)}` : ''}` : customer.lastOrderLabel || 'No orders yet')}</td>
                        <td data-label="Addresses">${escapeHtml(customer.addressSummary || 'No saved addresses')}</td>
                        <td data-label="Registration date">${escapeHtml(dateLabel(customer.registrationDate || customer.registeredAt))}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </section>
            ${showCustomerDetails ? `
              <section class="admin-side-panel">
                <article class="admin-card">
                  <div class="admin-card__head">
                    <h3 class="admin-card__title">Customer Profile</h3>
                    <p class="admin-card__sub">Merchandise orders, addresses, and first interaction date</p>
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
            ` : ''}
          </div>
        </div>
      </section>
    `;
    els.customersView.querySelectorAll('[data-input="customersDateFrom"], [data-input="customersDateTo"]').forEach((input) => {
      input.max = customerDateMax;
    });
  }

  function renderCoupons() {
    const items = Array.isArray(state.coupons) ? state.coupons : [];
    const query = state.couponsSearch.trim().toLowerCase();
    const filtered = items.filter((coupon) => {
      const matchesSearch = !query || [
        coupon.code, coupon.description, coupon.festivalName, coupon.owner,
        coupon.influencerName, coupon.influencerHandle, coupon.recipientEmail,
        coupon.recipientName, coupon.appliesTo, coupon.couponType, coupon.ownerType,
        coupon.discount, coupon.discountValue,
      ].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
      return matchesDateFilter(coupon.createdAt, state.couponsDatePeriod, state.couponsDateFrom, state.couponsDateTo) && matchesSearch;
    });

    const statusFiltered = filtered.filter((coupon) => state.couponsStatus === 'all'
      || (state.couponsStatus === 'active' ? Number(coupon.active ?? coupon.isActive ?? 0) === 1 : Number(coupon.active ?? coupon.isActive ?? 0) !== 1));
    const typeFiltered = statusFiltered.filter((coupon) => state.couponsType === 'all' || getCouponTypeValue(coupon) === state.couponsType);
    const filteredCoupons = typeFiltered;

    const totalCoupons = filteredCoupons.length;
    const activeCoupons = filteredCoupons.filter((coupon) => Number(coupon.active ?? coupon.isActive ?? 0) === 1).length;
    const expiredCoupons = filteredCoupons.filter((coupon) => {
      const expiry = String(coupon.validTill || coupon.expiresAt || coupon.expiry || '').trim();
      return Boolean(expiry) && new Date(expiry).getTime() < Date.now();
    }).length;
    const redeemedCoupons = filteredCoupons.reduce((sum, coupon) => sum + getCouponRedemptionCount(coupon), 0);
    const discountGiven = filteredCoupons.reduce((sum, coupon) => sum + getCouponActualDiscountAmount(coupon), 0);
    const activeInfluencerCoupons = filteredCoupons.filter((coupon) => getCouponTypeValue(coupon) === 'influencer' && Number(coupon.active ?? coupon.isActive ?? 0) === 1).length;

    const selectedCoupon = state.selectedCouponId == null
      ? null
      : filteredCoupons.find((coupon) => Number(coupon.id) === Number(state.selectedCouponId)) || null;
    const showCouponDetails = Boolean(selectedCoupon);

    const summaryCards = [
      { label: 'Total Coupons', value: totalCoupons, note: 'Shared coupon store' },
      { label: 'Active Coupons', value: activeCoupons, note: 'Currently usable' },
      { label: 'Expired Coupons', value: expiredCoupons, note: 'Needs review' },
      { label: 'Coupons Usage', value: redeemedCoupons, note: 'Lifetime redemptions' },
      { label: 'Discount Given', value: money(discountGiven), note: 'Actual total discount' },
      { label: 'Active Influencer Coupons', value: activeInfluencerCoupons, note: 'Assigned creator codes' },
    ];

    els.couponsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Coupons</h2>
            <p class="admin-section__desc">Shared coupon infrastructure for Merch and Bookings, surfaced in a merch-first dashboard.</p>
          </div>
          ${renderDateFilterControls('coupons', state.couponsDatePeriod, state.couponsDateFrom, state.couponsDateTo, items, (coupon) => coupon.createdAt)}
        </div>
        <div class="admin-section__body">
          <div class="admin-card-grid admin-card-grid--3 admin-coupon-stats" style="margin-bottom:16px;">
            ${summaryCards.map((card) => `
              <article class="admin-card admin-coupon-stat">
                <div class="admin-card__body">
                  <p class="admin-stat__label">${escapeHtml(card.label)}</p>
                  <p class="admin-stat__value">${escapeHtml(card.value)}</p>
                  <p class="admin-stat__note">${escapeHtml(card.note)}</p>
                </div>
              </article>
            `).join('')}
          </div>

          <div class="admin-toolbar">
            <div class="admin-toolbar__group" style="flex:1 1 420px;">
              <input class="admin-input" data-input="couponsSearch" value="${escapeHtml(state.couponsSearch)}" placeholder="Search by coupon code, campaign, influencer, or customer email" />
              <select class="admin-select" data-input="couponsStatus" aria-label="Coupon status">
                <option value="all" ${state.couponsStatus === 'all' ? 'selected' : ''}>All statuses</option>
                <option value="active" ${state.couponsStatus === 'active' ? 'selected' : ''}>Active</option>
                <option value="inactive" ${state.couponsStatus === 'inactive' ? 'selected' : ''}>Inactive</option>
              </select>
              <select class="admin-select" data-input="couponsType" aria-label="Coupon type">
                <option value="all" ${state.couponsType === 'all' ? 'selected' : ''}>All types</option>
                <option value="general" ${state.couponsType === 'general' ? 'selected' : ''}>General</option>
                <option value="private" ${state.couponsType === 'private' ? 'selected' : ''}>Private</option>
                <option value="influencer" ${state.couponsType === 'influencer' ? 'selected' : ''}>Influencer</option>
              </select>
            </div>
            <button class="admin-btn admin-btn--ghost" type="button" data-action="export-coupons">Export CSV</button>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-coupon-modal">Create Coupon</button>
          </div>

          <div class="admin-grid admin-grid--two" style="margin-top:16px;${showCouponDetails ? '' : 'grid-template-columns:1fr;'}">
            <section class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Coupon List</h3>
                <p class="admin-card__sub">${filteredCoupons.length} coupon(s) matched</p>
              </div>
              <div class="admin-card__body admin-table-wrap">
                ${state.couponsLoading ? `
                  <div class="admin-empty">${renderEmptyState('Loading coupons', 'Fetching the shared coupon list from the booking database.')}</div>
                ` : filteredCoupons.length ? `
                  <table class="admin-table">
                    <thead>
                      <tr>
                        <th>Coupon Code</th>
                        <th>Coupon Type</th>
                        <th>Discount</th>
                        <th>Usage</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                        <th>Owner</th>
                        <th>Created Date</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredCoupons.map((coupon) => {
                        const typeValue = getCouponTypeValue(coupon);
                        const typeLabel = getCouponTypeLabel(coupon);
                        const ownerLabel =
                          typeValue === 'private'
                            ? coupon.recipientEmail || 'Private'
                            : getCouponInfluencerLabel(coupon) || (typeValue === 'influencer' ? 'Influencer' : 'General');
                        const expiryValue = coupon.validTill || coupon.expiresAt || coupon.expiry || '';
                        const statusValue = Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 'active' : 'inactive';
                        const usageCount = Number(coupon.totalRedemptions || coupon.usageCount || 0);
                        return `
                          <tr data-action="select-coupon" data-id="${coupon.id}" style="cursor:pointer;">
                            <td><strong>${escapeHtml(coupon.code || '-')}</strong></td>
                            <td><span class="admin-badge ${typeValue === 'influencer' ? 'admin-badge--influencer' : typeValue === 'private' ? 'admin-badge--private' : 'admin-badge--general'}">${escapeHtml(typeLabel)}</span></td>
                            <td>${escapeHtml(couponDiscountLabel(coupon))}</td>
                            <td>${escapeHtml(String(usageCount))}</td>
                            <td>${escapeHtml(expiryValue ? dateLabel(expiryValue) : 'No expiry')}</td>
                            <td><span class="admin-badge ${statusClass(statusValue)}">${escapeHtml(getStatusLabel(statusValue))}</span></td>
                            <td>${escapeHtml(ownerLabel)}</td>
                            <td>${escapeHtml(coupon.createdAt ? dateLabel(coupon.createdAt) : '—')}</td>
                            <td>
                              <div class="admin-actions">
                                <button class="admin-action-link" type="button" data-action="select-coupon" data-id="${coupon.id}">View</button>
                                <button class="admin-action-link" type="button" data-action="edit-coupon" data-id="${coupon.id}">Edit</button>
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

            ${showCouponDetails ? `
              <section class="admin-card">
              <div class="admin-card__head admin-card__head--with-close">
                <div>
                  <h3 class="admin-card__title">Coupon Details</h3>
                  <p class="admin-card__sub">Usage, expiry, and owner context</p>
                </div>
                <button class="admin-card__close" type="button" data-action="close-coupon-details" aria-label="Close coupon details">&times;</button>
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
                        Remaining usage: ${escapeHtml(selectedCoupon.maxRedemptions == null ? 'Unlimited' : String(Math.max(0, Number(selectedCoupon.maxRedemptions || 0) - Number(selectedCoupon.totalRedemptions || 0))))}
                      </p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Coupon Details</p>
                      <p class="admin-list__item-sub">
                        Discount: <strong>${escapeHtml(couponDiscountLabel(selectedCoupon))}</strong><br>
                        ${getCouponTypeValue(selectedCoupon) === 'influencer' ? `Commission: <strong>${escapeHtml(couponCommissionLabel(selectedCoupon))}</strong><br>` : ''}
                        Applies To: <strong>${escapeHtml(formatCouponAppliesToLabel(selectedCoupon.appliesTo))}</strong><br>
                        Expiry: ${escapeHtml(selectedCoupon.validTill || selectedCoupon.expiresAt || selectedCoupon.expiry ? dateLabel(selectedCoupon.validTill || selectedCoupon.expiresAt || selectedCoupon.expiry) : 'No expiry')}<br>
                        Created: ${escapeHtml(selectedCoupon.createdAt ? dateLabel(selectedCoupon.createdAt) : '—')}
                      </p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Owner</p>
                      <p class="admin-list__item-sub">
                        ${escapeHtml(getCouponInfluencerLabel(selectedCoupon) || 'General')}
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
            ` : ''}
          </div>
        </div>
      </section>
    `;
  }

  function renderInfluencerEditModal(influencers) {
    const selected = Array.isArray(influencers) ? influencers.filter(Boolean) : [];
    if (!selected.length) {
      toast('Select influencers', 'Select at least one influencer before editing.', 'warning');
      return;
    }
    const months = [...new Set(selected.flatMap((item) => (item.monthlySales || []).map((row) => row.month)).filter(Boolean))].sort().reverse();
    openModal({
      title: 'Edit selected influencers',
      subtitle: `${selected.length} influencer${selected.length === 1 ? '' : 's'} selected`,
      body: `
        <div class="admin-form">
          <label class="admin-field"><span>Report month</span><select class="admin-select" data-influencer-report-month><option value="">All months</option>${months.map((month) => `<option value="${escapeHtml(month)}">${escapeHtml(month)}</option>`).join('')}</select></label>
          <div class="admin-list" style="margin-top:14px;">${selected.map((item) => `<div class="admin-list__item"><strong>${escapeHtml(item.name || item.handle || `Influencer ${item.id}`)}</strong><span class="admin-table__muted">${escapeHtml(item.email || '')}</span></div>`).join('')}</div>
          <p class="admin-table__muted" style="margin:14px 0 6px;">Choose an action for every selected influencer.</p>
          <div class="admin-actions">
            <button class="admin-action-link" type="button" data-action="bulk-influencer-edit">Edit Influencer</button>
            <button class="admin-action-link" type="button" data-action="bulk-influencer-view-report">View Report</button>
            <button class="admin-action-link" type="button" data-action="bulk-influencer-download-report">Download Report</button>
            <button class="admin-action-link" type="button" data-action="bulk-influencer-email-report">Send to Email</button>
          </div>
        </div>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button>',
      size: 'lg',
    });
  }

  function renderCampaignCreatorSection(selectedInfluencer) {
    const activeInfluencers = (state.influencers || []).filter((i) => i.active !== 0 && i.active !== false);
    const selectedInfId = selectedInfluencer ? Number(selectedInfluencer.id) : '';

    // Get candidate coupons: portal === 'merch'
    const candidateCoupons = (state.coupons || []).filter((c) => {
      const portalMatch = !c.portal || c.portal === 'merch';
      return portalMatch;
    });

    return `
      <div class="admin-campaign-creator">
        <div class="admin-campaign-creator__head">
          <h4 class="admin-campaign-creator__title">CREATE NEW TRACKING LINK</h4>
          <p class="admin-campaign-creator__desc">Fill in the details below to generate an attributable Instagram Story tracking link (<code>/c/:slug</code>).</p>
        </div>
        
        <form id="campaignCreateForm" class="admin-campaign-form" data-form="campaign-create" onsubmit="return false;">
          <div class="admin-campaign-form__grid">
            <div class="admin-campaign-field">
              <div class="admin-step-label">
                <span class="admin-step-pill">Step 1</span>
                <label for="campaignInfluencerSelect">Influencer <span class="admin-required-star">*</span></label>
              </div>
              <select class="admin-select" name="influencerId" id="campaignInfluencerSelect" required style="width:100%;">
                <option value="">-- Select Influencer --</option>
                ${(state.influencers || []).map((inf) => `
                  <option value="${inf.id}" ${Number(inf.id) === Number(selectedInfId) ? 'selected' : ''}>
                    ${escapeHtml(inf.name || 'Unnamed')} (@${escapeHtml(inf.handle || 'no-handle')}) ${!inf.active ? '— [Inactive]' : ''}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="admin-campaign-field">
              <div class="admin-step-label">
                <span class="admin-step-pill">Step 2</span>
                <label for="campaignCouponSelect">Coupon <span class="admin-required-star">*</span></label>
              </div>
              <select class="admin-select" name="couponCode" id="campaignCouponSelect" required style="width:100%;">
                <option value="">-- Select Coupon --</option>
                ${candidateCoupons.map((c) => {
                  const isAssigned = selectedInfId && (Number(c.influencerId || c.influencer_id) === Number(selectedInfId));
                  const isAct = Number(c.is_active ?? c.active ?? 1) === 1;
                  return `
                    <option value="${escapeHtml(c.code)}" data-influencer-id="${c.influencerId || c.influencer_id || ''}" data-discount="${escapeHtml(couponDiscountLabel(c))}" data-active="${isAct ? '1' : '0'}">
                      ${escapeHtml(c.code)} (${escapeHtml(couponDiscountLabel(c))})${isAssigned ? ' ★ Assigned' : ''}${!isAct ? ' [Inactive]' : ''}
                    </option>
                  `;
                }).join('')}
              </select>
              <div id="campaignCouponFeedback" class="admin-field-hint" style="font-size:12px;color:var(--admin-muted);margin-top:2px;"></div>
            </div>

            <div class="admin-campaign-field">
              <div class="admin-step-label">
                <span class="admin-step-pill">Step 3</span>
                <label for="campaignTargetProductSelect">Target Product</label>
              </div>
              <input type="hidden" name="targetProductId" value="${escapeHtml(String((state.products || []).find((p) => String(p.name || '').toLowerCase().includes('bottle'))?.id || 11))}" />
              <select class="admin-select" id="campaignTargetProductSelect" disabled style="width:100%;background:#ffffff;color:var(--admin-text);opacity:0.95;cursor:default;">
                <option value="11" selected>${escapeHtml((state.products || []).find((p) => String(p.name || '').toLowerCase().includes('bottle'))?.name || 'H2 Molecular Hydrogen Water Bottle')}</option>
              </select>
            </div>

            <div class="admin-campaign-field">
              <div class="admin-step-label">
                <label for="campaignVariantSelect">Variant <span class="admin-required-star">*</span></label>
              </div>
              <select class="admin-select" name="targetVariantId" id="campaignVariantSelect" required style="width:100%;">
                ${(() => {
                  const bProduct = (state.products || []).find((p) => String(p.name || '').toLowerCase().includes('bottle') || Number(p.id) === 11);
                  const bVariants = Array.isArray(bProduct?.variants) && bProduct.variants.length
                    ? bProduct.variants.filter((v) => Number(v.isActive ?? 1) === 1 && !v.deletedAt)
                    : [];
                  if (bVariants.length) {
                    return bVariants.map((v, i) => `
                      <option value="${v.id}" data-sku="${escapeHtml(v.sku || '')}" data-color="${escapeHtml(v.color || '')}" ${i === 0 ? 'selected' : ''}>
                        ${escapeHtml(v.color || v.size || 'Bottle')} (${escapeHtml(v.sku || '')}) — ₹${(Number(v.price || 2299000) / 100).toLocaleString('en-IN')}${i === 0 ? ' (Default)' : ''}
                      </option>
                    `).join('');
                  }
                  return `
                    <option value="569" data-sku="HM-BTL-460-SLV" data-color="Silver" selected>Silver (SKU: HM-BTL-460-SLV) — ₹22,990 (Default)</option>
                    <option value="570" data-sku="HM-BTL-460-BLK" data-color="Black">Black (SKU: HM-BTL-460-BLK) — ₹22,990</option>
                    <option value="571" data-sku="HM-BTL-460-GLD" data-color="Gold">Gold (SKU: HM-BTL-460-GLD) — ₹22,990</option>
                    <option value="572" data-sku="HM-BTL-460-BLU" data-color="Blue">Blue (SKU: HM-BTL-460-BLU) — ₹22,990</option>
                  `;
                })()}
              </select>
            </div>

            <div class="admin-campaign-field" style="grid-column: 1 / -1;">
              <div class="admin-step-label">
                <span class="admin-step-pill">Step 4</span>
                <label for="campaignSlugInput">Campaign Slug <span class="admin-required-star">*</span></label>
              </div>
              <input class="admin-input" name="slug" id="campaignSlugInput" placeholder="e.g. RyanH2" pattern="^[A-Za-z0-9_-]{2,50}$" required style="width:100%;" />
              <div class="admin-campaign-preview">
                <span class="admin-campaign-preview__label">Live Link Preview:</span>
                <span id="campaignSlugLiveUrl" class="admin-campaign-preview__code">${window.location.origin}/c/<span>...</span></span>
              </div>
            </div>
          </div>

          <div style="margin-top:6px;display:flex;align-items:center;gap:12px;">
            <button class="admin-btn admin-btn--primary admin-campaign-submit-btn" type="submit" id="btnSubmitCampaign">
              GENERATE TRACKING LINK
            </button>
            <span id="campaignFormFeedback" style="font-size:13px;"></span>
          </div>
        </form>
      </div>
    `;
  }

  function renderCampaignSuccessCard() {
    const c = state.latestCreatedCampaign;
    if (!c) {
      return `
        <div id="campaignGeneratedSuccessBanner" class="admin-campaign-success-card" style="display:none;">
          <div class="admin-campaign-success-card__top">
            <div class="admin-campaign-success-card__header">
              <span class="admin-campaign-success-card__icon" aria-hidden="true">✓</span>
              <strong class="admin-campaign-success-card__title">Tracking link created</strong>
            </div>
            <button type="button" class="admin-campaign-success-card__close" data-action="dismiss-campaign-success" title="Dismiss" aria-label="Dismiss">✕</button>
          </div>
          <div class="admin-campaign-success-card__body">
            <div class="admin-campaign-success-card__meta">
              <span class="admin-campaign-success-card__name" id="campaignSuccessName"></span>
              <span class="admin-campaign-success-card__sub" id="campaignSuccessSub"></span>
            </div>
            <div class="admin-campaign-success-card__url-row">
              <div class="admin-campaign-success-card__url-box">
                <input class="admin-campaign-success-card__input" id="campaignGeneratedUrlDisplay" readonly value="" />
              </div>
              <button class="admin-btn admin-btn--primary admin-campaign-success-card__copy-btn" type="button" data-action="copy-generated-campaign-link">
                COPY LINK
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div id="campaignGeneratedSuccessBanner" class="admin-campaign-success-card">
        <div class="admin-campaign-success-card__top">
          <div class="admin-campaign-success-card__header">
            <span class="admin-campaign-success-card__icon" aria-hidden="true">✓</span>
            <strong class="admin-campaign-success-card__title">Tracking link created</strong>
          </div>
          <button type="button" class="admin-campaign-success-card__close" data-action="dismiss-campaign-success" title="Dismiss" aria-label="Dismiss">✕</button>
        </div>
        <div class="admin-campaign-success-card__body">
          <div class="admin-campaign-success-card__meta">
            <span class="admin-campaign-success-card__name" id="campaignSuccessName">${escapeHtml(c.name || `${c.slug} Instagram Story`)}</span>
            <span class="admin-campaign-success-card__sub" id="campaignSuccessSub">${escapeHtml(c.influencerName || '')} &bull; ${escapeHtml(c.couponCode || '')}</span>
          </div>
          <div class="admin-campaign-success-card__url-row">
            <div class="admin-campaign-success-card__url-box">
              <input class="admin-campaign-success-card__input" id="campaignGeneratedUrlDisplay" readonly value="${escapeHtml(c.fullUrl || '')}" />
            </div>
            <button class="admin-btn admin-btn--primary admin-campaign-success-card__copy-btn" type="button" data-action="copy-generated-campaign-link">
              COPY LINK
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderCampaignsTable() {
    const list = Array.isArray(state.campaigns) ? state.campaigns : [];
    return `
      <div class="admin-campaigns-section">
        <div class="admin-campaigns-section__head">
          <div>
            <h4 class="admin-campaigns-section__title">EXISTING TRACKING CAMPAIGNS</h4>
            <p class="admin-campaigns-section__sub">Manage your active influencer links and view their performance.</p>
          </div>
          <span class="admin-badge admin-badge--neutral" style="font-size:12px;padding:4px 10px;font-weight:600;">
            ${list.length} Campaign${list.length === 1 ? '' : 's'}
          </span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table admin-campaigns-table">
            <thead>
              <tr>
                <th style="min-width:180px;">Campaign Link</th>
                <th style="min-width:140px;">Influencer</th>
                <th style="min-width:110px;">Coupon</th>
                <th style="min-width:160px;">Target Bottle</th>
                <th style="min-width:90px;text-align:center;">Status</th>
                <th style="min-width:80px;text-align:right;">Clicks</th>
                <th style="min-width:80px;text-align:right;">Orders</th>
                <th style="min-width:110px;text-align:right;">Revenue</th>
                <th style="min-width:120px;text-align:center;">Conversion Rate</th>
                <th style="min-width:160px;text-align:center;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${list.length ? list.map((c) => {
                const fullUrl = `${window.location.origin}/c/${escapeHtml(c.slug)}`;
                const variantMeta = {
                  569: { color: 'Silver', size: '460ml', sku: 'HM-BTL-460-SLV', price: 2299000 },
                  570: { color: 'Black', size: '460ml', sku: 'HM-BTL-460-BLK', price: 2299000 },
                  571: { color: 'Gold', size: '460ml', sku: 'HM-BTL-460-GLD', price: 2299000 },
                  572: { color: 'Blue', size: '460ml', sku: 'HM-BTL-460-BLU', price: 2299000 },
                }[c.targetVariantId] || {};
                const variantColor = c.targetVariantColor || variantMeta.color || 'Silver';
                const variantSize = c.targetVariantSize || variantMeta.size || '460ml';
                const variantSku = c.targetVariantSku || variantMeta.sku || '';
                const variantPrice = c.targetVariantPrice || variantMeta.price || 2299000;

                return `
                  <tr>
                    <td class="admin-campaign-cell-link">
                      <strong>${escapeHtml(c.name || `${c.slug} Campaign`)}</strong>
                      <a href="${fullUrl}" target="_blank" rel="noopener" title="Open ${fullUrl}">/c/${escapeHtml(c.slug)} ↗</a>
                    </td>
                    <td>
                      <strong style="color:var(--admin-text);">${escapeHtml(c.influencerName || 'Unknown')}</strong><br>
                      <span class="admin-table__muted" style="font-size:12px;">@${escapeHtml(c.influencerHandle || 'no-handle')}</span>
                    </td>
                    <td>
                      <span class="admin-badge admin-badge--neutral" style="font-family:var(--font-mono, monospace);font-weight:700;font-size:12px;letter-spacing:0.04em;">${escapeHtml(c.couponCode)}</span>
                    </td>
                    <td>
                      <strong style="font-size:13px;color:var(--admin-text);display:block;">${escapeHtml(c.targetProductName || 'H2 Water Bottle')}</strong>
                      <div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                        <span class="admin-badge admin-badge--neutral" style="font-size:11px;font-weight:700;background:rgba(200,101,45,0.08);color:var(--admin-accent-dark,#9f3e1f);border:1px solid rgba(200,101,45,0.2);">
                          ${escapeHtml(variantColor)} (${escapeHtml(variantSize)})
                        </span>
                        <strong style="font-size:12px;color:var(--admin-text);">${money(variantPrice)}</strong>
                      </div>
                      ${variantSku ? `<span class="admin-table__muted" style="font-size:11px;display:block;margin-top:3px;">SKU: ${escapeHtml(variantSku)}</span>` : ''}
                    </td>
                    <td style="text-align:center;">
                      <span class="admin-badge ${c.isActive ? 'admin-badge--active' : 'admin-badge--inactive'}" style="font-size:11px;font-weight:700;">
                        ${c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style="text-align:right;"><strong style="font-size:13px;">${formatCount(c.clicks)}</strong></td>
                    <td style="text-align:right;"><strong style="font-size:13px;">${formatCount(c.orders)}</strong></td>
                    <td style="text-align:right;"><strong style="font-size:13px;color:var(--admin-text);">${money(c.revenue)}</strong></td>
                    <td style="text-align:center;">
                      <span class="admin-badge ${c.conversionRate > 0 ? 'admin-badge--active' : 'admin-badge--neutral'}" style="font-size:11px;font-weight:700;">
                        ${c.conversionRate}%
                      </span>
                    </td>
                    <td style="text-align:center;">
                      <div class="admin-campaign-cell-actions" style="display:inline-flex;gap:8px;align-items:center;justify-content:center;">
                        <button class="admin-btn admin-btn--soft admin-campaign-btn" type="button" data-action="copy-campaign-link" data-url="${fullUrl}" title="Copy tracking URL to clipboard">
                          COPY LINK
                        </button>
                        <button class="admin-btn ${c.isActive ? 'admin-btn--ghost' : 'admin-btn--soft'} admin-campaign-btn" type="button" data-action="toggle-campaign-active" data-id="${c.id}" data-active="${c.isActive ? 'true' : 'false'}" title="${c.isActive ? 'Deactivate this tracking link' : 'Activate this tracking link'}">
                          ${c.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="10" style="text-align:center;padding:32px 16px;color:var(--admin-muted);">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
                      <span style="font-size:20px;">🔗</span>
                      <strong style="font-size:14px;color:var(--admin-text);">No tracking campaigns created yet</strong>
                      <span style="font-size:12px;">Select an influencer and coupon above to generate your first link.</span>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function handleCampaignCreateSubmit(form) {
    const influencerId = Number(form.querySelector('[name="influencerId"]')?.value);
    const couponCode = String(form.querySelector('[name="couponCode"]')?.value || '').trim();
    const targetProductId = Number(form.querySelector('[name="targetProductId"]')?.value) || 11;
    const targetVariantSelect = form.querySelector('[name="targetVariantId"]');
    const targetVariantId = Number(targetVariantSelect?.value) || 569;
    const targetVariantSku = targetVariantSelect?.selectedOptions?.[0]?.dataset?.sku || {
      569: 'HM-BTL-460-SLV',
      570: 'HM-BTL-460-BLK',
      571: 'HM-BTL-460-GLD',
      572: 'HM-BTL-460-BLU',
    }[targetVariantId] || '';
    const selectedVariantColor = targetVariantSelect?.selectedOptions?.[0]?.dataset?.color || '';
    const slug = String(form.querySelector('[name="slug"]')?.value || '').trim();

    if (!influencerId) {
      toast('Influencer Required', 'Please select an influencer for this campaign.', 'warning');
      return;
    }
    if (!couponCode) {
      toast('Coupon Required', 'Please select a valid coupon for this campaign.', 'warning');
      return;
    }

    // Coupon verification against state
    const couponMatch = (state.coupons || []).find((c) => String(c.code).toLowerCase() === couponCode.toLowerCase());
    if (couponMatch) {
      if (couponMatch.portal && couponMatch.portal !== 'merch') {
        toast('Invalid Coupon', `Coupon '${couponCode}' does not belong to the merch portal.`, 'danger');
        return;
      }
      if (Number(couponMatch.is_active ?? couponMatch.active ?? 1) !== 1) {
        toast('Inactive Coupon', `Coupon '${couponCode}' is currently inactive.`, 'danger');
        return;
      }
      const exp = couponMatch.valid_till || couponMatch.expires_at;
      if (exp && new Date(exp).getTime() < Date.now()) {
        toast('Expired Coupon', `Coupon '${couponCode}' has expired.`, 'danger');
        return;
      }
    }

    if (!slug || !/^[A-Za-z0-9_-]{2,50}$/.test(slug)) {
      toast('Invalid Slug', 'Slug must be 2 to 50 alphanumeric characters (letters, numbers, hyphens, underscores).', 'warning');
      return;
    }

    // Duplicate check
    const duplicate = (state.campaigns || []).find((c) => String(c.slug).toLowerCase() === slug.toLowerCase());
    if (duplicate) {
      toast('Duplicate Slug', `Campaign slug '${slug}' already exists. Please choose a different slug.`, 'danger');
      return;
    }

    const submitBtn = form.querySelector('#btnSubmitCampaign');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await apiRequest('/api/merch/admin/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencerId,
          couponCode,
          targetProductId,
          targetVariantId,
          targetVariantSku,
          slug,
          name: `${slug} Instagram Story`,
        }),
      });

      if (res?.campaign) {
        const fullUrl = `${window.location.origin}/c/${res.campaign.slug}`;
        const selectedInf = (state.influencers || []).find((i) => Number(i.id) === influencerId);
        const variantName = selectedVariantColor
          ? `${selectedVariantColor} (460ml)`
          : ({ 569: 'Silver (460ml)', 570: 'Black (460ml)', 571: 'Gold (460ml)', 572: 'Blue (460ml)' }[targetVariantId] || 'Silver (460ml)');
        state.latestCreatedCampaign = {
          slug: res.campaign.slug,
          fullUrl,
          name: res.campaign.name || `${slug} Instagram Story`,
          influencerName: selectedInf?.name || 'Influencer',
          couponCode,
          variantName,
        };
        toast('Campaign Created', `Tracking link for /c/${slug} generated successfully.`, 'success');
        await loadCampaignData();
        renderInfluencers();

        const banner = document.getElementById('campaignGeneratedSuccessBanner');
        const display = document.getElementById('campaignGeneratedUrlDisplay');
        const nameEl = document.getElementById('campaignSuccessName');
        const subEl = document.getElementById('campaignSuccessSub');
        if (banner) {
          if (display) display.value = fullUrl;
          if (nameEl) nameEl.textContent = state.latestCreatedCampaign.name;
          if (subEl) subEl.textContent = `${state.latestCreatedCampaign.variantName} • ${state.latestCreatedCampaign.influencerName} • ${state.latestCreatedCampaign.couponCode}`;
          banner.style.display = 'flex';
          banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } catch (err) {
      toast('Campaign Creation Failed', err.message || 'Unable to create tracking campaign.', 'danger');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function renderInfluencers() {
    const query = state.influencersSearch.trim().toLowerCase();
    const selectedInfluencerFilter = String(state.influencerDetailsFilter || 'all');
    const month = '';
    const getMonthStats = (influencer) => getInfluencerMonthStats(influencer, month);
    const getPeriodStats = (influencer) => {
      const period = state.influencersDatePeriod;
      const lifetime = {
        orders: Number(influencer.totalOrders || 0),
        revenue: Number(influencer.revenue || 0),
        commission: Number(influencer.commission || 0),
        couponUsage: Number(influencer.couponUsage || 0),
      };
      if (!period || period === 'all' || (period === 'custom' && (!state.influencersDateFrom || !state.influencersDateTo))) return lifetime;
      const rows = period === 'custom'
        ? (influencer.dailySales || []).filter((row) => matchesDateFilter(row.day, period, state.influencersDateFrom, state.influencersDateTo))
        : (influencer.monthlySales || []).filter((row) => matchesMonthFilter(row.month, period, state.influencersDateFrom, state.influencersDateTo));
      return rows
        .reduce((total, row) => ({
          orders: total.orders + Number(row.orders || 0),
          revenue: total.revenue + Number(row.revenue || 0),
          commission: total.commission + Number(row.commission || 0),
          couponUsage: total.couponUsage + Number(row.couponUsage || 0),
        }), { orders: 0, revenue: 0, commission: 0, couponUsage: 0 });
    };
    const getAssignedCouponCount = (influencer) => Array.isArray(influencer?.coupons)
      ? influencer.coupons.length
      : Number(influencer?.assignedCouponCount || influencer?.couponCount || 0);
    const filtered = state.influencers.filter((influencer) => {
      const matchesDetails = selectedInfluencerFilter === 'all' || String(influencer.id) === selectedInfluencerFilter;
      const matchesSearch = !query || [influencer.name, influencer.handle, influencer.email, influencer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesDetails && matchesSearch;
    });
    const selectedInfluencer = filtered.find((influencer) => String(influencer.id) === String(state.selectedInfluencerId)) || filtered[0] || null;
    if (selectedInfluencer) state.selectedInfluencerId = selectedInfluencer.id;

    const visibleInfluencers = filtered;
    const statsSource = filtered;
    const totalRevenue = statsSource.reduce((sum, influencer) => sum + getPeriodStats(influencer).revenue, 0);
    const totalOrders = statsSource.reduce((sum, influencer) => sum + getPeriodStats(influencer).orders, 0);
    const totalCoupons = statsSource.reduce((sum, influencer) => sum + getPeriodStats(influencer).couponUsage, 0);

    els.influencersView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Influencer Management</h2>
            <p class="admin-section__desc">Add, edit, deactivate, and assign coupons to campaign partners from one workspace.</p>
          </div>
          ${renderDateFilterControls('influencers', state.influencersDatePeriod, state.influencersDateFrom, state.influencersDateTo, state.influencers.flatMap((influencer) => influencer.monthlySales || []), (row) => row.month)}
        </div>
        <div class="admin-section__body">
          <div class="admin-grid admin-grid--stats admin-influencer-kpis">
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
            <div class="admin-toolbar__group admin-influencer-search" style="flex:0 1 330px;">
              <input class="admin-input" data-input="influencersSearch" value="${escapeHtml(state.influencersSearch)}" placeholder="Search by name, handle, email, or phone" />
            </div>
            <div class="admin-toolbar__group" style="flex:0 1 220px;">
              <select class="admin-select" data-input="influencerDetailsFilter" aria-label="Influencer Details">
                <option value="all" ${selectedInfluencerFilter === 'all' ? 'selected' : ''}>All Influencers</option>
                ${state.influencers.map((influencer) => `<option value="${escapeHtml(influencer.id)}" ${String(influencer.id) === selectedInfluencerFilter ? 'selected' : ''}>${escapeHtml(influencer.name || influencer.handle || `Influencer ${influencer.id}`)}</option>`).join('')}
              </select>
            </div>
            <div class="admin-toolbar__group admin-influencer-actions">
              <button class="admin-btn admin-btn--soft" type="button" data-action="open-influencer-modal">Add Influencer</button>
              <button class="admin-btn admin-btn--soft admin-edit-action" type="button" data-action="edit-selected-influencers" ${state.selectedInfluencerIds.length ? '' : 'disabled'}>Edit${state.selectedInfluencerIds.length ? ` (${state.selectedInfluencerIds.length})` : ''}</button>
            </div>
          </div>

          <div class="admin-table-wrap">
            <table class="admin-table admin-influencer-table">
              <thead><tr><th><input type="checkbox" data-action="toggle-influencers-page-selection" aria-label="Select visible influencers" /> Influencer</th><th>Contact</th><th>Status</th><th>Coupons</th><th>Orders</th><th>Revenue</th><th>Commission Earned</th><th>Commission Paid</th><th>Balance Commission</th><th>Action</th></tr></thead>
              <tbody>${visibleInfluencers.length ? visibleInfluencers.map((influencer) => { const stats = getMonthStats(influencer); const commissionBalance = Math.max(0, Number(stats.commission || 0) - Number(influencer.paidCommission || 0)); return `<tr data-action="select-influencer" data-id="${influencer.id}">
                <td><input type="checkbox" data-action="toggle-influencer-selection" data-id="${influencer.id}" ${state.selectedInfluencerIds.includes(Number(influencer.id)) ? 'checked' : ''} aria-label="Select ${escapeHtml(influencer.name || 'influencer')}" /> <button class="admin-action-link" type="button" data-action="select-influencer" data-id="${influencer.id}">${escapeHtml(influencer.name || 'Unnamed')}</button><br><span class="admin-table__muted">${escapeHtml(influencer.handle || '')}</span></td>
                <td>${escapeHtml(influencer.email || 'Not added yet')}<br><span class="admin-table__muted">${escapeHtml(influencer.phone || 'Not added yet')}</span></td>
                <td><span class="admin-badge ${influencer.active ? 'admin-badge--active' : 'admin-badge--inactive'}">${influencer.active ? 'Active' : 'Inactive'}</span></td>
                <td>${formatCount(getAssignedCouponCount(influencer))}<br><span class="admin-table__muted">${getInfluencerCouponRecords(influencer).map((coupon) => `${escapeHtml(coupon.code)} — ${escapeHtml(couponDiscountLabel(coupon))}`).join('<br>') || 'None'}</span></td>
                <td>${formatCount(stats.orders)}</td><td>${money(stats.revenue)}</td><td>${money(stats.commission)}</td><td>${money(influencer.paidCommission || 0)} <span class="admin-badge admin-badge--neutral" style="font-size:10px;padding:1px 4px;">🔒</span></td><td>${money(commissionBalance)}</td>
                <td><button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="pay-influencer-commission" data-id="${influencer.id}" style="font-size:11px;padding:3px 8px;white-space:nowrap;">Pay</button></td>
              </tr>`; }).join('') : `<tr><td colspan="10">${renderEmptyState('No influencers found', 'Try a different search term or add a new influencer to start managing campaigns.')}</td></tr>`}</tbody>
            </table>
          </div>

          <div class="admin-grid admin-grid--two" style="margin-top:18px;">
            <section class="admin-card" id="influencer-profile-panel" tabindex="-1">
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
                      ${renderAssignedCouponDetails(selectedInfluencer)}
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Total Orders</p>
                      <p class="admin-list__item-sub">${formatCount(getMonthStats(selectedInfluencer).orders)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Revenue Generated</p>
                      <p class="admin-list__item-sub">${money(getMonthStats(selectedInfluencer).revenue)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">Coupon Usage</p>
                      <p class="admin-list__item-sub">${formatCount(selectedInfluencer.couponUsage)}</p>
                    </div>
                    <div class="admin-list__item">
                      <p class="admin-list__item-title">No. of Coupons Assigned in Influencer</p>
                      <p class="admin-list__item-sub">${formatCount(getAssignedCouponCount(selectedInfluencer))}</p>
                    </div>
                    <div class="admin-list__item" style="background:var(--admin-surface-subtle);padding:14px;border-radius:10px;border:1px solid var(--admin-border);margin-top:12px;">
                      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                        <div>
                          <p class="admin-list__item-title" style="margin:0;font-weight:700;">Commission Status</p>
                          <p class="admin-list__item-sub" style="margin:3px 0 0;">
                            Earned: <strong>${money(getMonthStats(selectedInfluencer).commission)}</strong> &bull;
                            Paid: <strong>${money(selectedInfluencer.paidCommission || 0)}</strong> <span class="admin-badge admin-badge--neutral" style="font-size:10px;padding:1px 5px;">🔒 Locked</span> &bull;
                            Balance: <strong style="color:var(--admin-primary);">${money(Math.max(0, Number(getMonthStats(selectedInfluencer).commission || 0) - Number(selectedInfluencer.paidCommission || 0)))}</strong>
                          </p>
                        </div>
                        <div style="display:flex;gap:6px;">
                          <button class="admin-btn admin-btn--primary admin-btn--sm" type="button" data-action="pay-influencer-commission" data-id="${selectedInfluencer.id}">Pay Commission</button>
                          <button class="admin-btn admin-btn--ghost admin-btn--sm" type="button" data-action="view-commission-history" data-id="${selectedInfluencer.id}">History</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ` : '<p class="admin-table__muted">No influencer selected.</p>'}
              </div>
              <div class="admin-card__foot">
                <div class="admin-footer-actions">
                  ${selectedInfluencer ? renderInfluencerActionLinks(selectedInfluencer) : ''}
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
                      { label: 'Orders', value: Math.min(100, Number(getMonthStats(selectedInfluencer).orders || 0)), display: formatCount(getMonthStats(selectedInfluencer).orders) },
                      { label: 'Revenue', value: Math.min(100, Math.round(Number(getMonthStats(selectedInfluencer).revenue || 0) / 100000)), display: money(getMonthStats(selectedInfluencer).revenue) },
                      { label: 'Commission', value: Math.min(100, Math.round(Number(getMonthStats(selectedInfluencer).commission || 0) / 10000)), display: money(getMonthStats(selectedInfluencer).commission) },
                      { label: 'Coupon Usage', value: Math.min(100, Number(selectedInfluencer.couponUsage || 0)), display: formatCount(selectedInfluencer.couponUsage) },
                      { label: 'Coupons Assigned', value: Math.min(100, getAssignedCouponCount(selectedInfluencer) * 20), display: formatCount(getAssignedCouponCount(selectedInfluencer)) },
                    ])}
                  </div>
                ` : '<p class="admin-table__muted" style="margin:0;">Select an influencer to inspect their performance snapshot.</p>'}
              </div>
            </section>
          </div>

          <section class="admin-card admin-campaigns-panel" style="margin-top:24px;" id="influencer-campaigns-panel">
            <div class="admin-card__head">
              <div>
                <h3 class="admin-card__title" style="font-size:18px;font-weight:700;color:var(--admin-text);letter-spacing:-0.01em;">INFLUENCER TRACKING CAMPAIGNS</h3>
                <p class="admin-card__sub" style="margin-top:4px;font-size:13px;color:var(--admin-muted);">Create and manage influencer tracking links for H2 House of Health merch.</p>
              </div>
            </div>
            <div class="admin-card__body admin-campaigns-panel__body">
              ${renderCampaignCreatorSection(selectedInfluencer)}
              ${renderCampaignSuccessCard()}
              ${renderCampaignsTable()}
            </div>
          </section>
        </div>
      </section>
    `;
  }

  // ─── Offers ───

  async function loadOffers() {
    state.offersLoading = true;
    try {
      const data = await apiRequest('/api/merch/admin/offers');
      state.offers = Array.isArray(data.offers) ? data.offers : [];
    } catch (err) {
      console.error('[Admin] loadOffers error:', err);
      state.offers = [];
    }
    state.offersLoading = false;
    renderOffers();
  }

  // Returns an array of unique product objects (one per product, not per variant).
  // state.products is expanded by expandProductVariants so each row is a variant;
  // we deduplicate on parentProductId and reconstruct the full variants array.
  function getUniqueOfferProducts() {
    // Do not offer the static fallback catalog while the DB-backed catalog is loading.
    if (!state.productsLoaded) return [];

    const seen = new Map(); // parentProductId → product object with variants[]
    for (const row of state.products) {
      const pid = Number(row.parentProductId ?? row.productId ?? row.id);
      if (!Number.isInteger(pid) || pid <= 0 || seen.has(pid)) continue;
      const variants = Array.isArray(row.variants)
        ? row.variants.filter((variant) => Number(variant.isActive ?? 1) === 1 && !variant.deletedAt)
        : [];
      if (!variants.length) continue;
      seen.set(pid, {
        id: pid,
        name: row.name,
        category: row.category,
        image: row.image,
        offerEligible: row.offerEligible !== false,
        variants,
      });
    }
    return Array.from(seen.values()).filter((product) => product.offerEligible);
  }

  function renderOffers() {
    if (!els.offersView) return;
    const draft = state.offerDraft;
    const uniqueProducts = getUniqueOfferProducts();
    const isFlat = draft?.discountType === 'flat';
    const checkedIds = draft ? Object.keys(draft.checkedProducts || {}).map(Number) : [];
    const selectedVariantCount = draft
      ? Object.values(draft.checkedProducts || {}).reduce((count, productDraft) => count + Object.keys(productDraft.variants || {}).length, 0)
      : 0;

    // Build per-product rows. Selecting a product reveals its variants; each
    // selected variant gets its own empty discount input and offer record.
    const productCheckboxRows = uniqueProducts.map((p) => {
      const isChecked = checkedIds.includes(p.id);
      const productDraft = draft?.checkedProducts?.[p.id] || { variants: {} };
      const variants = Array.isArray(p.variants) ? p.variants : [];
      const variantRows = variants.map((variant) => {
        const variantId = String(variant.id);
        const selected = Boolean(productDraft.variants?.[variantId]);
        const value = productDraft.variants?.[variantId]?.discountValue ?? '';
        const label = [variant.size, variant.color].filter(Boolean).join(' / ') || variant.sku || `Variant ${variant.id}`;
        return `
          <div class="admin-offer-variant-row">
            <label class="admin-offer-variant-row__check">
              <input type="checkbox" data-offer-variant-for="${escapeHtml(String(p.id))}" data-offer-variant-id="${escapeHtml(variantId)}" ${selected ? 'checked' : ''} />
              <span class="admin-offer-variant-row__name">${escapeHtml(label)}</span>
            </label>
            ${selected ? `
              <label class="admin-offer-variant-row__discount">
                <span>Discount: ${isFlat ? '\u20b9' : '%'}</span>
                <input type="number" min="0.01" max="${isFlat ? '' : '100'}" step="0.01"
                       placeholder="Enter value"
                       required
                       value="${escapeHtml(String(value))}"
                       data-offer-discount-for="${escapeHtml(String(p.id))}"
                       data-offer-discount-variant="${escapeHtml(variantId)}" />
              </label>` : ''}
          </div>
        `;
      }).join('');
      return `
        <div class="admin-offer-product-row ${isChecked ? 'admin-offer-product-row--checked' : ''}">
          <label class="admin-offer-product-row__check">
            <input type="checkbox" data-offer-product-id="${escapeHtml(String(p.id))}" ${isChecked ? 'checked' : ''} />
            <span class="admin-offer-product-row__name">${escapeHtml(p.name)}</span>
            <span class="admin-offer-product-row__cat">${escapeHtml(p.category || '')}</span>
          </label>
          ${isChecked ? `<div class="admin-offer-variant-list">
            <p class="admin-table__muted" style="margin:0 0 6px;font-size:12px;">Select variants and enter a discount for each.</p>
            ${variantRows || '<p class="admin-table__muted" style="margin:0;">No variants available.</p>'}
          </div>` : ''}
        </div>
      `;
    }).join('');

    const editProduct = draft?.id
      ? uniqueProducts.find((p) => p.id === draft.productId) || null
      : null;
    const editVariant = editProduct?.variants?.find((variant) => String(variant.id) === String(draft?.variantId)) || null;

    els.offersView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Offers</h2>
            <p class="admin-section__desc">Create promotional offers shown on the storefront under “Shop Offers”. Only active offers are visible to customers.</p>
          </div>
          <div class="admin-section__actions">
            <button class="admin-btn admin-btn--primary" type="button" data-action="new-offer">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
              New Offer
            </button>
          </div>
        </div>
        <div class="admin-section__body">
          ${draft ? `
            <div class="admin-offer-form" id="offerForm">
              <h3>
                ${draft.id ? 'Edit Offer' : 'New Offer'}
                ${!draft.id && checkedIds.length > 0
                  ? `<span style="font-size:12px;font-weight:400;color:var(--admin-muted);margin-left:8px;">${selectedVariantCount} variant${selectedVariantCount === 1 ? '' : 's'} selected</span>`
                  : ''}
              </h3>
              ${state.offerError
                ? `<p style="color:var(--admin-danger,#c0392b);font-size:13px;margin:8px 0 0;">${escapeHtml(state.offerError)}</p>`
                : ''}

              <div class="admin-form-grid" style="margin-top:16px;">
                <label class="admin-field">
                  <span>Offer Name <span aria-hidden="true" style="color:var(--admin-danger,#c0392b)">*</span></span>
                  <input type="text" data-offer-input="name"
                         value="${escapeHtml(draft.name || '')}"
                         placeholder="e.g. Welcome Discount" />
                </label>
                <label class="admin-field">
                  <span>Short Description</span>
                  <input type="text" data-offer-input="shortDescription"
                         value="${escapeHtml(draft.shortDescription || '')}"
                         placeholder="Shown on the offer card" />
                </label>
                <label class="admin-field admin-field--wide">
                  <span>Full Description</span>
                  <textarea data-offer-input="fullDescription" rows="3"
                            placeholder="Detail shown when customer expands the offer"
                  >${escapeHtml(draft.fullDescription || '')}</textarea>
                </label>
                <label class="admin-field admin-field--wide">
                  <span>Terms &amp; Conditions</span>
                  <textarea data-offer-input="terms" rows="2"
                            placeholder="e.g. Valid until 31 Dec 2026. One per customer."
                  >${escapeHtml(draft.terms || '')}</textarea>
                </label>
                <label class="admin-field">
                  <span>Discount Type</span>
                  <select data-offer-input="discountType">
                    <option value="percentage" ${!isFlat ? 'selected' : ''}>Percentage (%)</option>
                    <option value="flat" ${isFlat ? 'selected' : ''}>Flat Amount (&#x20b9;)</option>
                  </select>
                </label>
                <label class="admin-field">
                  <span>Status</span>
                  <select data-offer-input="isActive">
                    <option value="1" ${draft.isActive !== 0 && draft.isActive !== false ? 'selected' : ''}>Active — shown on storefront</option>
                    <option value="0" ${draft.isActive === 0 || draft.isActive === false ? 'selected' : ''}>Inactive — hidden</option>
                  </select>
                </label>
              </div>

              ${draft.id ? `
                <!-- Edit mode: one existing offer targets one variant. -->
                <div style="margin-top:18px;">
                  <p class="admin-table__muted" style="margin:0 0 8px;">Product, Variant &amp; Discount</p>
                  <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                    <strong>${escapeHtml(editProduct?.name || 'No product')}</strong>
                    <span class="admin-table__muted">${escapeHtml(editVariant ? [editVariant.size, editVariant.color].filter(Boolean).join(' / ') || editVariant.sku : 'Selected variant')}</span>
                    <label style="display:flex;align-items:center;gap:6px;font-size:13px;">
                      <span>Discount: ${isFlat ? '\u20b9' : '%'}</span>
                      <input type="number" min="0.01" max="${isFlat ? '' : '100'}" step="0.01"
                             data-offer-input="discountValue"
                             required
                             value="${escapeHtml(draft.discountValue ? (isFlat ? (Number(draft.discountValue) / 100).toFixed(2) : String(draft.discountValue)) : '')}"
                             placeholder="Enter value"
                             style="width:110px;" />
                    </label>
                  </div>
                </div>
              ` : `
                <!-- Create mode: product checkboxes with per-variant discount inputs -->
                <div style="margin-top:18px;">
                  <p class="admin-table__muted" style="margin:0 0 10px;">
                    Select Products and Variants
                    <span style="font-size:12px;"> — tick each variant and enter its discount</span>
                  </p>
                  <div class="admin-offer-product-list">
                    ${productCheckboxRows || `<p class="admin-table__muted">${state.productsLoading ? 'Loading products…' : 'No products available.'}</p>`}
                  </div>
                </div>
              `}

              <div class="admin-toolbar" style="margin-top:20px;">
                <button class="admin-btn admin-btn--primary" type="button" data-action="save-offer">
                  ${draft.id ? 'Save Changes' : selectedVariantCount ? `Create ${selectedVariantCount} Offers` : 'Create Offer'}
                </button>
                <button class="admin-btn admin-btn--ghost" type="button" data-action="cancel-offer">Cancel</button>
              </div>
            </div>
          ` : ''}

          ${state.offersLoading
            ? '<p class="admin-table__muted" style="padding:12px 0;">Loading offers\u2026</p>'
            : state.offers.length === 0
              ? `<div class="admin-offers-empty">
                   <div class="admin-offers-empty__icon">◈</div>
                   <p>No offers yet.<br>Click <strong>New Offer</strong> to create your first promotional offer.</p>
                 </div>`
              : `
            <div class="admin-table-wrap">
              <table class="admin-table admin-table--offers">
                <colgroup>
                  <col class="col-offer">
                  <col class="col-product">
                  <col class="col-discount">
                  <col class="col-status">
                  <col class="col-actions">
                </colgroup>
                <thead><tr>
                  <th>Offer</th>
                  <th>Product / Variant</th>
                  <th>Discount</th>
                  <th>Status</th>
                  <th></th>
                </tr></thead>
                <tbody>
                  ${state.offers.map((offer) => `
                    <tr>
                      <td>
                        <span class="admin-offer-name">${escapeHtml(offer.name)}</span>
                        ${offer.shortDescription ? `<span class="admin-table__muted">${escapeHtml(offer.shortDescription)}</span>` : ''}
                      </td>
                      <td>${offer.productName
                        ? `<span class="admin-offer-product-name">${escapeHtml(offer.productName)}</span>${
                            offer.variantSku
                              ? `<span class="admin-offer-variant-tag">${escapeHtml([offer.variantSize, offer.variantColor].filter(Boolean).join(' / ') || offer.variantSku)}</span>`
                              : ''}`
                        : '<span class="admin-table__muted">\u2014</span>'}</td>
                      <td>${offer.discountType === 'percentage'
                        ? `${escapeHtml(String(offer.discountValue))}%`
                        : `\u20b9${escapeHtml((Number(offer.discountValue) / 100).toFixed(2))}`}
                      </td>
                      <td>
                        <span class="admin-badge ${offer.isActive ? 'admin-badge--active' : 'admin-badge--inactive'}">
                          ${offer.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div class="admin-table-actions">
                          <button class="admin-btn admin-btn--ghost" type="button"
                                  data-action="edit-offer" data-offer-id="${escapeHtml(String(offer.id))}">Edit</button>
                          <button class="admin-btn admin-btn--ghost admin-btn--danger" type="button"
                                  data-action="delete-offer" data-offer-id="${escapeHtml(String(offer.id))}">Delete</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </section>
    `;

    // ── Wire shared text/select inputs ──
    els.offersView.querySelectorAll('[data-offer-input]').forEach((input) => {
      input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input', () => {
        if (!state.offerDraft) return;
        const key = input.dataset.offerInput;
        if (key === 'discountType') {
          state.offerDraft.discountType = input.value;
          // Values are unit-specific. Clear them when the type changes so a
          // percentage is never silently reused as rupees (or vice versa).
          state.offerDraft.discountValue = '';
          Object.values(state.offerDraft.checkedProducts || {}).forEach((productDraft) => {
            Object.values(productDraft.variants || {}).forEach((variantDraft) => {
              variantDraft.discountValue = '';
            });
          });
          renderOffers();
          return;
        }
        if (key === 'isActive') {
          state.offerDraft.isActive = Number(input.value);
          return;
        }
        if (key === 'discountValue') {
          // Edit mode single discount field.
          state.offerDraft.discountValue = input.value;
          return;
        }
        state.offerDraft[key] = input.value;
      });
    });

    // ── Wire product checkboxes ──
    els.offersView.querySelectorAll('[data-offer-product-id]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!state.offerDraft) return;
        const pid = Number(cb.dataset.offerProductId);
        if (cb.checked) {
          state.offerDraft.checkedProducts = state.offerDraft.checkedProducts || {};
          state.offerDraft.checkedProducts[pid] = state.offerDraft.checkedProducts[pid] || { variants: {} };
        } else {
          delete (state.offerDraft.checkedProducts || {})[pid];
        }
        renderOffers();
      });
    });

    // ── Wire per-variant checkboxes ──
    els.offersView.querySelectorAll('[data-offer-variant-for]').forEach((cb) => {
      cb.addEventListener('change', () => {
        if (!state.offerDraft) return;
        const pid = String(cb.dataset.offerVariantFor);
        const variantId = String(cb.dataset.offerVariantId);
        const productDraft = state.offerDraft.checkedProducts?.[pid];
        if (!productDraft) return;
        productDraft.variants = productDraft.variants || {};
        if (cb.checked) {
          productDraft.variants[variantId] = productDraft.variants[variantId] || { discountValue: '' };
        } else {
          delete productDraft.variants[variantId];
        }
        renderOffers();
      });
    });

    // ── Wire per-variant discount inputs ──
    els.offersView.querySelectorAll('[data-offer-discount-for]').forEach((input) => {
      input.addEventListener('input', () => {
        if (!state.offerDraft) return;
        const pid = String(input.dataset.offerDiscountFor);
        const variantId = String(input.dataset.offerDiscountVariant);
        const variantDraft = state.offerDraft.checkedProducts?.[pid]?.variants?.[variantId];
        if (variantDraft) variantDraft.discountValue = input.value;
      });
    });

    // ── Wire action buttons ──
    els.offersView.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => handleOfferAction(btn.dataset.action, btn.dataset));
    });
  }

  async function handleOfferAction(action, dataset = {}) {
    if (action === 'new-offer') {
      state.offerDraft = {
        name: '', shortDescription: '', fullDescription: '', terms: '',
        checkedProducts: {},   // { [productId]: { variants: { [variantId]: { discountValue } } } }
        discountType: 'percentage',
        isActive: 1,
        // Legacy single-product fields kept for edit compatibility:
        productId: null, variantId: null, discountValue: '',
      };
      state.offerError = '';
      renderOffers();
      els.offersView.querySelector('#offerForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'cancel-offer') {
      state.offerDraft = null;
      state.offerError = '';
      renderOffers();
      return;
    }

    if (action === 'edit-offer') {
      const offer = state.offers.find((o) => String(o.id) === String(dataset.offerId));
      if (!offer) return;
      // Edit mode is single-product only. We use the legacy productId/discountValue fields.
      state.offerDraft = {
        id: offer.id,
        name: offer.name || '',
        shortDescription: offer.shortDescription || '',
        fullDescription: offer.fullDescription || '',
        terms: offer.terms || '',
        discountType: offer.discountType || 'percentage',
        discountValue: offer.discountType === 'flat'
          ? (Number(offer.discountValue || 0) / 100)
          : (offer.discountValue ?? ''),
        isActive: offer.isActive ? 1 : 0,
        productId: offer.productId ?? null,
        variantId: offer.variantId ?? null,
      };
      state.offerError = '';
      renderOffers();
      els.offersView.querySelector('#offerForm')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (action === 'save-offer') {
      const draft = state.offerDraft;
      if (!draft) return;
      if (!String(draft.name || '').trim()) {
        state.offerError = 'Offer name is required.';
        renderOffers();
        return;
      }

      const validateDiscount = (rawValue) => {
        const raw = String(rawValue ?? '').trim();
        const value = Number(raw);
        if (!raw || !Number.isFinite(value) || value <= 0) return false;
        return draft.discountType !== 'percentage' || value <= 100;
      };

      // ── Edit mode: single PATCH ──
      if (draft.id) {
        if (!draft.variantId) {
          state.offerError = 'This offer has no selected variant. It must be assigned to a variant before saving.';
          renderOffers();
          return;
        }
        if (!validateDiscount(draft.discountValue)) {
          state.offerError = draft.discountType === 'percentage'
            ? 'Enter a percentage greater than 0 and no more than 100.'
            : 'Enter a rupee discount greater than 0.';
          renderOffers();
          return;
        }
        const discountValuePaise = draft.discountType === 'flat'
          ? Math.round(Number(draft.discountValue) * 100)
          : Number(draft.discountValue);
        const payload = {
          name: String(draft.name).trim(),
          shortDescription: String(draft.shortDescription || '').trim(),
          fullDescription: String(draft.fullDescription || '').trim(),
          terms: String(draft.terms || '').trim(),
          productId: draft.productId || null,
          variantId: draft.variantId || null,
          discountType: draft.discountType,
          discountValue: discountValuePaise,
          isActive: draft.isActive ? 1 : 0,
        };
        try {
          await apiRequest(`/api/merch/admin/offers/${encodeURIComponent(draft.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          toast('Offer updated', `"${draft.name}" has been saved.`);
          state.offerDraft = null;
          state.offerError = '';
          await loadOffers();
        } catch (err) {
          state.offerError = err.message || 'Save failed.';
          renderOffers();
        }
        return;
      }

      // ── Create mode: one POST per selected variant ──
      const selectedVariants = [];
      for (const [pid, entry] of Object.entries(draft.checkedProducts || {})) {
        for (const [variantId, variantEntry] of Object.entries(entry.variants || {})) {
          selectedVariants.push({ productId: Number(pid), variantId: Number(variantId), entry: variantEntry });
        }
      }
      if (!selectedVariants.length) {
        state.offerError = 'Select at least one variant.';
        renderOffers();
        return;
      }

      const basePayload = {
        name: String(draft.name).trim(),
        shortDescription: String(draft.shortDescription || '').trim(),
        fullDescription: String(draft.fullDescription || '').trim(),
        terms: String(draft.terms || '').trim(),
        discountType: draft.discountType,
        isActive: draft.isActive ? 1 : 0,
      };

      let succeeded = 0;
      let failed = 0;
      const failMessages = [];

      for (const selectedVariant of selectedVariants) {
        const rawDiscount = String(selectedVariant.entry?.discountValue ?? '').trim();
        const numericDiscount = Number(rawDiscount);
        if (!rawDiscount || !Number.isFinite(numericDiscount) || numericDiscount <= 0 ||
            (draft.discountType === 'percentage' && numericDiscount > 100)) {
          state.offerError = draft.discountType === 'percentage'
            ? 'Enter a percentage greater than 0 and no more than 100 for every selected variant.'
            : 'Enter a rupee discount greater than 0 for every selected variant.';
          renderOffers();
          return;
        }
      }

      for (const selectedVariant of selectedVariants) {
        const numericDiscount = Number(selectedVariant.entry.discountValue);
        const discountValueFinal = draft.discountType === 'flat'
          ? Math.round(numericDiscount * 100) // rupees → paise
          : numericDiscount;                  // percentage: store as-is

        const payload = {
          ...basePayload,
          productId: selectedVariant.productId,
          variantId: selectedVariant.variantId,
          discountValue: discountValueFinal,
        };

        try {
          await apiRequest('/api/merch/admin/offers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          succeeded++;
        } catch (err) {
          failed++;
          failMessages.push(err.message || `Failed for variant ID ${selectedVariant.variantId}`);
        }
      }

      state.offerDraft = null;
      state.offerError = '';

      if (succeeded > 0 && failed === 0) {
        toast('Offers created', `${succeeded} offer${succeeded === 1 ? '' : 's'} created successfully.`);
      } else if (succeeded > 0 && failed > 0) {
        toast('Partial success', `${succeeded} created, ${failed} failed: ${failMessages.join('; ')}`, 'warning');
      } else {
        toast('Create failed', failMessages.join('; ') || 'All offers failed to create.', 'warning');
      }
      await loadOffers();
      return;
    }

    if (action === 'delete-offer') {
      if (!window.confirm('Delete this offer? This cannot be undone.')) return;
      try {
        await apiRequest(`/api/merch/admin/offers/${encodeURIComponent(dataset.offerId)}`, {
          method: 'DELETE',
        });
        toast('Offer deleted', 'The offer has been removed.');
        await loadOffers();
      } catch (err) {
        toast('Delete failed', err.message || 'Unable to delete offer.', 'warning');
      }
    }
  }


  function renderReports() {
    if (state.reportsLoading && !state.reports) {
      els.reportsView.innerHTML = `
        <section class="admin-section">
          <div class="admin-section__head">
            <div>
              <h2 class="admin-section__title">Reports</h2>
              <p class="admin-section__desc">Loading report data...</p>
            </div>
          </div>
          <div class="admin-section__body">
            ${renderEmptyState('Loading reports', 'Calculating merch orders, revenue, coupon usage, and commission.')}
          </div>
        </section>
      `;
      return;
    }

    if (!state.orders.length && !state.products.length && !state.reports) {
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
      { title: 'Revenue Report', meta: 'Payment capture and return impact', target: 'revenue-report' },
      { title: 'Orders Report', meta: 'Fulfillment stages and channel breakdown', target: 'orders-report' },
      { title: 'Products Report', meta: 'Product-wise units, orders, and sales revenue', target: 'products-report' },
      { title: 'Coupons Report', meta: 'Usage, expiry, and owner split', target: 'coupons-report' },
      { title: 'Influencer Report', meta: 'Campaign performance and revenue contribution', target: 'influencer-report' },
      { title: 'Monthly Influencer Report', meta: 'Month-wise sales and commission by influencer', target: 'monthly-influencer-report' },
    ];
    const summary = state.reports?.summary || {};
    const influencerReports = Array.isArray(state.reports?.influencerReports) ? state.reports.influencerReports : [];
    const monthlyInfluencerReports = Array.isArray(state.reports?.monthlyInfluencerReports) ? state.reports.monthlyInfluencerReports : [];
    const liveStatusDistribution = buildOrderStatusDistribution(state.orders);
    const statusBreakdown = state.reports?.statusBreakdown || liveStatusDistribution.breakdown;
    const reportOrderTotal = summary.orderCount ?? liveStatusDistribution.total ?? 0;
    const reportSegments = Object.entries(statusBreakdown)
      .filter(([, count]) => Number(count || 0) > 0)
      .map(([status, count]) => ({
        status,
        label: ORDER_STATUS_META[normalizeOrderStatus(status)]?.label || getStatusLabel(status),
        color: ORDER_STATUS_META[normalizeOrderStatus(status)]?.color || '#a65b43',
        count: Number(count || 0),
        percent: reportOrderTotal ? (Number(count || 0) / reportOrderTotal) * 100 : 0,
      }));
    const reportDistribution = {
      total: reportOrderTotal,
      segments: reportSegments,
    };
    const productSalesRows = Array.isArray(state.reports?.productSales)
      ? state.reports.productSales
      : (Array.isArray(state.reports?.topProducts) ? state.reports.topProducts : []);
    const couponReportRows = [...(Array.isArray(state.coupons) ? state.coupons : [])]
      .sort((left, right) => Number(right.totalRedemptions || right.usageCount || 0) - Number(left.totalRedemptions || left.usageCount || 0))
      .slice(0, 5);

    els.reportsView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Reports</h2>
            <p class="admin-section__desc">Filter by date and export CSV, Excel, or PDF placeholder reports.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-toolbar admin-influencer-toolbar">
            <div class="admin-toolbar__group">
              <input class="admin-input" type="date" data-input="reportFrom" value="${escapeHtml(state.reportFrom)}" />
              <input class="admin-input" type="date" data-input="reportTo" value="${escapeHtml(state.reportTo)}" />
              <select class="admin-select" data-input="reportFormat">
                <option value="csv" ${state.reportFormat === 'csv' ? 'selected' : ''}>CSV</option>
                <option value="excel" ${state.reportFormat === 'excel' ? 'selected' : ''}>Excel</option>
                <option value="pdf" ${state.reportFormat === 'pdf' ? 'selected' : ''}>Printable HTML</option>
              </select>
            </div>
            <div class="admin-toolbar__group">
              <button class="admin-btn admin-btn--ghost" type="button" data-action="export-report">Download Report</button>
              <button class="admin-btn admin-btn--soft" type="button" data-action="email-report">Send via Email</button>
            </div>
          </div>

          <div class="admin-report-grid">
            ${reportTiles.map((tile) => `
              <div class="admin-report-card admin-report-card--interactive">
                <h3 class="admin-report-card__title">${escapeHtml(tile.title)}</h3>
                <p class="admin-report-card__meta">${escapeHtml(tile.meta)}</p>
                <div class="admin-actions">
                  <button class="admin-action-link" type="button" data-action="open-report-section" data-target="${escapeHtml(tile.target)}">View report</button>
                  <button class="admin-action-link" type="button" data-action="download-report-section" data-target="${escapeHtml(tile.target)}">Download</button>
                </div>
              </div>
            `).join('')}
          </div>

          <div class="admin-card-grid admin-card-grid--2" style="margin-top:18px;">
            <section class="admin-card" id="revenue-report">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Revenue Report</h3>
                <p class="admin-card__sub">Date-filtered merch summary</p>
              </div>
              <div class="admin-card__body admin-mini-chart">
                ${renderMiniChart([
                  { label: 'Orders', value: Math.min(100, Number(summary.orderCount || 0)), display: formatCount(summary.orderCount) },
                  { label: 'Revenue', value: Math.min(100, Math.round(Number(summary.revenue || 0) / 100000)), display: money(summary.revenue) },
                  { label: 'Coupon Usage', value: Math.min(100, Number(influencerReports.reduce((sum, row) => sum + Number(row.couponUsage || 0), 0))), display: formatCount(influencerReports.reduce((sum, row) => sum + Number(row.couponUsage || 0), 0)) },
                  { label: 'Commission', value: Math.min(100, Math.round(influencerReports.reduce((sum, row) => sum + Number(row.commission || 0), 0) / 10000)), display: money(influencerReports.reduce((sum, row) => sum + Number(row.commission || 0), 0)) },
                ])}
              </div>
            </section>

            <section class="admin-card" id="orders-report">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Order Status Distribution</h3>
                <p class="admin-card__sub">Filtered by selected date range</p>
              </div>
              <div class="admin-card__body" style="display:grid;place-items:center;gap:14px;">
                ${renderOrderStatusRing(reportDistribution)}
                <div class="admin-chip-row">
                  ${renderStatusLegend(reportDistribution)}
                </div>
                <p class="admin-table__muted" style="margin:0;">${formatCount(reportOrderTotal)} order(s) in the selected range.</p>
              </div>
            </section>
          </div>

          <section class="admin-card" id="products-report" style="margin-top:18px;">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Product Sales Report</h3>
              <p class="admin-card__sub">Product-wise sales for the selected date range</p>
            </div>
            <div class="admin-card__body admin-table-wrap">
              ${productSalesRows.length ? `
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Units Sold</th>
                      <th>Orders</th>
                      <th>Sales Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${productSalesRows.map((product) => `
                      <tr>
                        <td><strong>${escapeHtml(product.name)}</strong><br><span class="admin-table__muted">${escapeHtml(product.description || '')}</span></td>
                        <td>${escapeHtml(product.sku || '—')}</td>
                        <td>${escapeHtml(product.category || '—')}</td>
                        <td><strong>${formatCount(product.quantity || 0)}</strong></td>
                        <td>${formatCount(product.orders || 0)}</td>
                        <td><strong>${money(product.revenue || 0)}</strong></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : renderEmptyState('No product sales yet', 'Product-wise sales will appear here when orders are recorded in the selected date range.')}
            </div>
          </section>

          <section class="admin-card" id="coupons-report" style="margin-top:18px;">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Coupons Report</h3>
              <p class="admin-card__sub">Usage, expiry, and owner split</p>
            </div>
            <div class="admin-card__body admin-table-wrap">
              ${couponReportRows.length ? `
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Coupon</th>
                      <th>Type</th>
                      <th>Usage</th>
                      <th>Status</th>
                      <th>Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${couponReportRows.map((coupon) => `
                      <tr>
                        <td><strong>${escapeHtml(coupon.code || '')}</strong></td>
                        <td>${escapeHtml(getCouponTypeLabel(coupon))}</td>
                        <td>${formatCount(coupon.totalRedemptions || coupon.usageCount || 0)}</td>
                        <td><span class="admin-badge ${Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 'admin-badge--active' : 'admin-badge--inactive'}">${Number(coupon.active ?? coupon.isActive ?? 0) === 1 ? 'Active' : 'Inactive'}</span></td>
                        <td>${escapeHtml(coupon.influencerName || coupon.owner || 'Store')}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : renderEmptyState('No coupons found', 'Coupon usage will appear here once live order data is recorded.')}
            </div>
          </section>

          <section class="admin-card" id="influencer-report" style="margin-top:18px;">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Influencer Report</h3>
              <p class="admin-card__sub">Orders, revenue, coupon usage, and commission from stored influencer attribution</p>
            </div>
            <div class="admin-card__body admin-table-wrap">
              ${influencerReports.length ? `
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Influencer</th>
                      <th>Coupons</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Coupon Usage</th>
                      <th>Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${influencerReports.map((row) => `
                      <tr>
                        <td><strong>${escapeHtml(row.name)}</strong><br><span class="admin-table__muted">${escapeHtml(row.handle || '')}</span></td>
                        <td><div class="admin-chip-row">${renderCouponChips(row.coupons)}</div></td>
                        <td>${formatCount(row.orders)}</td>
                        <td><strong>${money(row.revenue)}</strong></td>
                        <td>${formatCount(row.couponUsage)}</td>
                        <td>${money(row.commission)}<br><span class="admin-table__muted">Fixed per order</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : renderEmptyState('No influencer attribution yet', 'Assign coupons to influencers and capture merch orders to populate this report.')}
            </div>
          </section>

          <section class="admin-card" id="monthly-influencer-report" style="margin-top:18px;">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Monthly Influencer Breakdown</h3>
              <p class="admin-card__sub">Month-wise sales and commission by influencer</p>
            </div>
            <div class="admin-card__body admin-table-wrap">
              ${monthlyInfluencerReports.length ? `
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Influencer</th>
                      <th>Handle</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Commission</th>
                      <th>Coupon Usage</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${monthlyInfluencerReports.map((row) => `
                      <tr>
                        <td><strong>${escapeHtml(row.monthLabel || row.month)}</strong></td>
                        <td>${escapeHtml(row.name || '')}</td>
                        <td class="admin-table__muted">${escapeHtml(row.handle || '—')}</td>
                        <td>${formatCount(row.orders)}</td>
                        <td><strong>${money(row.revenue)}</strong></td>
                        <td>${money(row.commission)}</td>
                        <td>${formatCount(row.couponUsage)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : renderEmptyState('No monthly influencer activity yet', 'Capture orders across multiple months to see the sales and commission trend here.')}
            </div>
          </section>
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

  // ── Change Password (3-step: send OTP → verify OTP → set new password) ──
  function renderChangePasswordModal(step = 'email', ctx = {}) {
    const adminEmail = 'admin@h2health.local';

    const steps = {
      email: {
        kicker: 'Step 1 of 3',
        title: 'Change Password',
        body: `
          <p style="margin:0 0 18px;color:var(--admin-muted);font-size:13px;line-height:1.6;">
            A one-time verification code will be sent to your admin email address.
          </p>
          <div class="admin-form-grid">
            <label class="admin-field admin-field--wide">
              <span>Admin Email</span>
              <input type="email" id="cpEmailInput"
                     value="${escapeHtml(adminEmail)}"
                     placeholder="admin@h2health.local"
                     autocomplete="email" />
            </label>
          </div>
          <p id="cpError" style="margin:10px 0 0;color:var(--admin-danger);font-size:13px;display:none;"></p>
        `,
        footer: `
          <button class="admin-btn admin-btn--primary" type="button" id="cpNextBtn">Send OTP</button>
          <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        `,
      },
      otp: {
        kicker: 'Step 2 of 3',
        title: 'Enter Verification Code',
        body: `
          <p style="margin:0 0 18px;color:var(--admin-muted);font-size:13px;line-height:1.6;">
            We sent a 6-digit code to <strong>${escapeHtml(ctx.email || adminEmail)}</strong>.
            Enter it below to continue.
          </p>
          <div class="admin-form-grid">
            <label class="admin-field admin-field--wide">
              <span>Verification Code</span>
              <input type="text" id="cpOtpInput"
                     inputmode="numeric" maxlength="6"
                     placeholder="123456"
                     autocomplete="one-time-code"
                     style="letter-spacing:0.22em;font-size:18px;text-align:center;" />
            </label>
          </div>
          <p id="cpError" style="margin:10px 0 0;color:var(--admin-danger);font-size:13px;display:none;"></p>
        `,
        footer: `
          <button class="admin-btn admin-btn--primary" type="button" id="cpNextBtn">Verify Code</button>
          <button class="admin-btn admin-btn--ghost" type="button" id="cpBackBtn">Back</button>
        `,
      },
      password: {
        kicker: 'Step 3 of 3',
        title: 'Set New Password',
        body: `
          <p style="margin:0 0 18px;color:var(--admin-muted);font-size:13px;line-height:1.6;">
            Choose a strong new password for your admin account.
          </p>
          <div class="admin-form-grid">
            <label class="admin-field admin-field--wide">
              <span>New Password</span>
              <input type="password" id="cpPasswordInput"
                     placeholder="Minimum 8 characters"
                     autocomplete="new-password"
                     minlength="8" />
            </label>
            <label class="admin-field admin-field--wide">
              <span>Confirm New Password</span>
              <input type="password" id="cpConfirmInput"
                     placeholder="Repeat new password"
                     autocomplete="new-password"
                     minlength="8" />
            </label>
          </div>
          <p id="cpError" style="margin:10px 0 0;color:var(--admin-danger);font-size:13px;display:none;"></p>
        `,
        footer: `
          <button class="admin-btn admin-btn--primary" type="button" id="cpNextBtn">Change Password</button>
          <button class="admin-btn admin-btn--ghost" type="button" id="cpBackBtn">Back</button>
        `,
      },
    };

    const cfg = steps[step];
    openModal({
      title: cfg.title,
      subtitle: cfg.kicker,
      body: cfg.body,
      footer: cfg.footer,
      size: 'sm',
    });

    const dialog = els.adminModalDialog;
    const errorEl = dialog.querySelector('#cpError');

    function showError(msg) {
      if (!errorEl) return;
      errorEl.textContent = msg;
      errorEl.style.display = msg ? 'block' : 'none';
    }

    function setLoading(btn, loading) {
      if (!btn) return;
      btn.disabled = loading;
      btn.textContent = loading
        ? 'Please wait…'
        : (step === 'email' ? 'Send OTP' : step === 'otp' ? 'Verify Code' : 'Change Password');
    }

    // Back buttons
    dialog.querySelector('#cpBackBtn')?.addEventListener('click', () => {
      if (step === 'otp') renderChangePasswordModal('email', ctx);
      if (step === 'password') renderChangePasswordModal('otp', ctx);
    });

    // Primary action button
    const nextBtn = dialog.querySelector('#cpNextBtn');
    if (!nextBtn) return;

    nextBtn.addEventListener('click', async () => {
      showError('');

      if (step === 'email') {
        const emailInput = dialog.querySelector('#cpEmailInput');
        const email = (emailInput?.value || '').trim();
        if (!email) { showError('Please enter your email address.'); return; }
        setLoading(nextBtn, true);
        try {
          const result = await apiRequest('/api/auth/password/forgot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          toast('OTP Sent', result.message || 'Check your email for the verification code.', 'success');
          renderChangePasswordModal('otp', { ...ctx, email });
        } catch (err) {
          showError(err.message || 'Failed to send OTP. Please try again.');
          setLoading(nextBtn, false);
        }
        return;
      }

      if (step === 'otp') {
        const otp = (dialog.querySelector('#cpOtpInput')?.value || '').trim();
        if (!otp || otp.length < 4) { showError('Please enter the verification code.'); return; }
        setLoading(nextBtn, true);
        try {
          const result = await apiRequest('/api/auth/password/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ctx.email, otp }),
          });
          toast('Code Verified', result.message || 'Now set your new password.', 'success');
          renderChangePasswordModal('password', { ...ctx, otp });
        } catch (err) {
          showError(err.message || 'Invalid or expired code. Please try again.');
          setLoading(nextBtn, false);
        }
        return;
      }

      if (step === 'password') {
        const newPass = dialog.querySelector('#cpPasswordInput')?.value || '';
        const confirmPass = dialog.querySelector('#cpConfirmInput')?.value || '';
        if (newPass.length < 8) { showError('Password must be at least 8 characters.'); return; }
        if (newPass !== confirmPass) { showError('Passwords do not match.'); return; }
        setLoading(nextBtn, true);
        try {
          const result = await apiRequest('/api/auth/password/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ctx.email, password: newPass }),
          });
          closeModal();
          toast('Password Changed', result.message || 'Your password has been updated successfully.', 'success');
        } catch (err) {
          showError(err.message || 'Failed to change password. Please try again.');
          setLoading(nextBtn, false);
        }
      }
    });

    // Auto-focus first input
    window.setTimeout(() => {
      dialog.querySelector('input')?.focus();
    }, 80);
  }

  function closeProfileDropdown() {
    if (!els.profileDropdown || els.profileDropdown.hidden) return false;
    els.profileDropdown.hidden = true;
    els.profileTrigger?.setAttribute('aria-expanded', 'false');
    return true;
  }

  function toggleProfileDropdown() {
    if (!els.profileDropdown) return;
    const willOpen = els.profileDropdown.hidden;
    els.profileDropdown.hidden = !willOpen;
    els.profileTrigger?.setAttribute('aria-expanded', String(willOpen));
  }

  function getCouponCategoryOptions(entity = null) {
    const selectedAppliesTo = String(entity?.appliesTo || '').trim().toLowerCase();
    const isAll = !selectedAppliesTo || selectedAppliesTo === 'merch' || selectedAppliesTo === 'all';
    const catMatch = selectedAppliesTo.match(/^category:([a-z0-9_\-,]+)$/);
    const selectedCategorySlugs = new Set();
    if (catMatch) {
      catMatch[1].split(',').forEach((s) => {
        const slug = s.trim().toLowerCase();
        if (slug) selectedCategorySlugs.add(slug);
      });
    } else if (selectedAppliesTo.startsWith('product:')) {
      const pids = selectedAppliesTo.replace('product:', '').split(',').map(Number).filter(Boolean);
      for (const p of (Array.isArray(state.products) ? state.products : [])) {
        const pid = Number(p.productId || p.id);
        if (pids.includes(pid)) {
          const cat = String(p.categorySlug || p.category || '').trim().toLowerCase();
          if (cat) selectedCategorySlugs.add(cat);
        }
      }
    }

    const normalizeCategorySlug = (raw) => {
      const val = String(raw || '').trim().toLowerCase();
      if (!val) return '';
      if (val === 'bottles' || val.includes('bottle')) return 'bottles';
      if (val === 'sprays' || val.includes('mist') || val.includes('spray')) return 'sprays';
      if (val === 'hoodies' || val === 'hoodie') return 'hoodies';
      if (val === 't-shirt' || val === 't-shirts' || val === 'tshirt') return 't-shirt';
      return slugify(val);
    };

    const getCategoryDisplayName = (slug, fallbackName) => {
      if (slug === 'bottles') return 'Hydrogen Water Bottles';
      if (slug === 'sprays') return 'Hydrogen Mists / Sprays';
      if (slug === 'hoodies') return 'Hoodies';
      if (slug === 't-shirt') return 'T-Shirts';
      if (fallbackName && String(fallbackName).trim()) return String(fallbackName).trim();
      return slug.split('-').map((w) => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
    };

    const categoriesMap = new Map();
    const seenNames = new Set();

    const addCategory = (rawSlug, rawName) => {
      const canonicalSlug = normalizeCategorySlug(rawSlug || rawName);
      if (!canonicalSlug) return;
      const displayName = getCategoryDisplayName(canonicalSlug, rawName);
      const normName = displayName.toLowerCase();
      if (categoriesMap.has(canonicalSlug) || seenNames.has(normName)) return;

      seenNames.add(normName);
      categoriesMap.set(canonicalSlug, {
        slug: canonicalSlug,
        name: displayName,
        label: displayName,
      });
    };

    // 1. Authoritative: from state.categories
    for (const cat of (Array.isArray(state.categories) ? state.categories : [])) {
      addCategory(cat.slug || cat.id, cat.name);
    }

    // 2. Supplemental: check loaded products for any unlisted categories
    for (const prod of (Array.isArray(state.products) ? state.products : [])) {
      addCategory(prod.categorySlug || prod.category, prod.category);
    }

    const categories = [];
    for (const [slug, item] of categoriesMap.entries()) {
      categories.push({
        slug,
        name: item.name,
        label: item.name,
        selected: !isAll && (selectedCategorySlugs.has(slug) || (slug === 'bottles' && selectedCategorySlugs.has('hydrogen water bottles')) || (slug === 'sprays' && selectedCategorySlugs.has('hydrogen mists / sprays'))),
      });
    }

    return {
      allSelected: isAll || !categories.some((cat) => cat.selected),
      categories,
    };
  }

  function couponProductsSummary(form) {
    const allSelected = form.querySelector('[data-coupon-product-all]')?.checked;
    const selected = [...form.querySelectorAll('[data-coupon-category-slug]:checked')];
    if (allSelected || !selected.length) return 'All Merch Products';
    if (selected.length === 1) return selected[0].dataset.couponCategoryName || '1 Category Selected';
    return `${selected.length} Categories Selected`;
  }

  function syncCouponProductSelection(checkbox) {
    const form = checkbox.closest('[data-entity-form="coupon"]');
    if (!form) return;
    const allCheckbox = form.querySelector('[data-coupon-product-all]');
    const categoryCheckboxes = [...form.querySelectorAll('[data-coupon-category-slug]')];
    if (checkbox === allCheckbox && allCheckbox.checked) {
      categoryCheckboxes.forEach((productCheckbox) => { productCheckbox.checked = false; });
    } else if (checkbox === allCheckbox && !allCheckbox.checked && !categoryCheckboxes.some((productCheckbox) => productCheckbox.checked)) {
      allCheckbox.checked = true;
    } else if (checkbox !== allCheckbox && categoryCheckboxes.some((productCheckbox) => productCheckbox.checked)) {
      allCheckbox.checked = false;
    } else if (checkbox !== allCheckbox && !categoryCheckboxes.some((productCheckbox) => productCheckbox.checked)) {
      allCheckbox.checked = true;
    }
    const trigger = form.querySelector('[data-coupon-products-toggle]');
    if (trigger) trigger.textContent = couponProductsSummary(form);
  }

  function filterCouponProductOptions(input) {
    const dropdown = input.closest('[data-coupon-products-dropdown]');
    if (!dropdown) return;
    const query = String(input.value || '').trim().toLowerCase();
    dropdown.querySelectorAll('[data-coupon-product-option]').forEach((option) => {
      option.hidden = Boolean(query) && !String(option.dataset.couponProductSearch || '').includes(query);
    });
  }

  function closeCouponProductDropdown() {
    const dropdown = document.querySelector('[data-coupon-products-dropdown].is-open, [data-influencer-coupon-dropdown].is-open');
    if (!dropdown) return false;
    const menu = dropdown.querySelector('[data-coupon-products-menu], [data-influencer-coupon-menu]');
    const toggle = dropdown.querySelector('[data-coupon-products-toggle], [data-influencer-coupon-toggle]');
    if (menu) menu.hidden = true;
    toggle?.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('is-open');
    return true;
  }

  function renderComboFormModal(components = [], entity = null) {
    const selectedItems = entity?.comboItems?.length
      ? entity.comboItems
      : components.map((item) => {
          const source = state.products.find((product) => Number(product.variantId) === Number(item.variantId)) || item;
          return { variantId: item.variantId, productName: source.name || item.name, imageUrl: source.image || item.imageUrl || getProductFallbackImage(source), sku: source.sku || item.sku, size: source.size || item.size, color: source.color || item.color };
        });
    // Product rows are expanded from variants, so a combo row's `id` is its
    // variant id. Combo endpoints expect the parent product id instead.
    const comboProductId = entity?.productId || entity?.parentProductId || entity?.id || '';
    const comboVariant = entity?.variants?.[0] || entity || {};
    openModal({
      title: entity ? 'Edit Combo' : 'Create Combo',
      subtitle: 'Combo Products',
      body: `
        <form class="admin-form" data-entity-form="combo" data-entity-id="${escapeHtml(comboProductId)}">
          <div class="admin-form__grid">
            <label class="admin-field"><span>Combo Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
            <label class="admin-field"><span>Overall Combo Price (rupees)</span><input class="admin-input" name="price" type="number" min="1" step="1" value="${escapeHtml(Number(entity?.price || comboVariant.price || 0))}" required /></label>
            <label class="admin-field admin-field--wide"><span>Combo Image</span><input class="admin-input" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" /><small class="admin-field__hint">Optional. Upload a JPG, PNG, or WEBP image${entity?.image ? ' to replace the current image' : ''}.</small></label>
            <label class="admin-field admin-field--wide"><span>Combo Details</span><textarea class="admin-textarea" name="description" placeholder="Optional description">${escapeHtml(entity?.description || '')}</textarea></label>
            <label class="admin-field"><span>Status</span><select class="admin-select" name="status"><option value="published" ${entity?.status !== 'archived' ? 'selected' : ''}>Published</option><option value="archived" ${entity?.status === 'archived' ? 'selected' : ''}>Archived</option></select></label>
            <div class="admin-field admin-field--wide"><span>Included products and variants (set combo stock)</span><small class="admin-field__hint">This stock belongs to the combo and does not change the individual products.</small><div class="admin-combo-items">
              ${selectedItems.map((item) => { const fallback = getProductFallbackImage(item); const image = normalizeAdminImageUrl(item.imageUrl, fallback); const stock = entity ? (comboVariant.stock ?? 10) : 10; return `<label class="admin-combo-item"><input type="hidden" name="componentVariantId" value="${escapeHtml(item.variantId)}" /><img src="${escapeHtml(image)}" alt="" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}';" /><span><strong>${escapeHtml(item.productName || item.name)}</strong><small>${escapeHtml([item.size, item.color].filter(Boolean).join(' / ') || item.sku || 'Default variant')}</small></span><input class="admin-input" name="componentStock" type="number" min="0" value="${escapeHtml(stock)}" aria-label="Combo stock for ${escapeHtml(item.productName || item.name)}" /></label>`; }).join('')}
            </div></div>
          </div>
        </form>
      `,
      footer: `<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button><button class="admin-btn admin-btn--primary" type="submit" form="entityFormSubmit">Save Combo</button>`,
      size: 'lg',
    });
    const form = els.adminModalDialog.querySelector('[data-entity-form="combo"]');
    if (form) form.id = 'entityFormSubmit';
  }

  function renderEntityFormModal(type, entity = null) {
    const existingProductImages = type === 'product'
      ? [...new Set((Array.isArray(entity?.images) ? entity.images : [entity?.image]).filter(Boolean))]
      : [];
    const config = {
      product: {
        title: entity ? 'Edit Product' : 'Add Product',
        subtitle: 'Products',
        fields: `
          <label class="admin-field"><span>Product Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
          <label class="admin-field"><span>SKU</span><input class="admin-input" name="sku" value="${escapeHtml(entity?.sku || '')}" required /></label>
          <label class="admin-field"><span>Category</span>
            <select class="admin-select" name="categoryId">
              ${state.categories.map((category) => `<option value="${category.id}" ${String(entity?.categoryId ?? '') === String(category.id) ? 'selected' : ''}>${escapeHtml(category.name)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field"><span>New Category Name</span><input class="admin-input" name="newCategoryName" value="" placeholder="Optional future category" /><small class="admin-field__hint">Enter a name to add a new category to the dropdown and storefront.</small></label>
          <label class="admin-field"><span>Size / Ltrs / Metric</span><input class="admin-input" name="size" value="${escapeHtml(entity?.size || '')}" placeholder="e.g. 1L, M, 42" /><small class="admin-field__hint">Use litres/ml for liquids, clothing size, or any future product metric.</small></label>
          <label class="admin-field"><span>Color</span><input class="admin-input" name="color" value="${escapeHtml(entity?.color || '')}" placeholder="e.g. Black, Silver" /></label>
          <label class="admin-field"><span>Price (rupees)</span><input class="admin-input" name="price" type="number" min="0" step="1" value="${escapeHtml(entity?.price || 0)}" required /></label>
          <label class="admin-field"><span>Stock</span><input class="admin-input" name="stock" type="number" min="0" value="${escapeHtml(entity?.stock || 0)}" required /></label>
          <label class="admin-field"><span>Status</span>
            <select class="admin-select" name="status">
              ${['published', 'draft', 'archived'].map((status) => `<option value="${status}" ${String(entity?.status || 'published') === status ? 'selected' : ''}>${getStatusLabel(status)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field admin-field--wide"><span>Product Images</span>
            ${existingProductImages.length ? `<div class="admin-current-images">${existingProductImages.map((image) => `<img src="${escapeHtml(normalizeAdminImageUrl(image, getProductFallbackImage(entity)))}" alt="Current product image" onerror="this.onerror=null;this.src='${escapeHtml(getProductFallbackImage(entity))}';" /><input type="hidden" name="currentImage" value="${escapeHtml(image)}" />`).join('')}</div>` : ''}
            <input class="admin-input" name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" multiple ${entity ? '' : 'required'} />
            <small class="admin-field__hint">${existingProductImages.length ? 'Current gallery shown above. ' : ''}Upload one or more JPG, PNG, or WEBP images${existingProductImages.length ? ' to replace the current gallery' : ''}. The first image is used on product cards.</small>
          </label>
          <label class="admin-field admin-field--wide"><span>Description</span><textarea class="admin-textarea" name="description">${escapeHtml(entity?.description || '')}</textarea></label>
          <label class="admin-field admin-field--wide"><span>Product specifications</span><textarea class="admin-textarea" name="specifications" rows="7" placeholder="One per line: Label: Value">${escapeHtml(formatProductSpecifications(entity?.specifications))}</textarea><small class="admin-field__hint">Add one specification per line in the format <code>Label: Value</code>. These appear under More details.</small></label>
          <label class="admin-check"><input type="checkbox" name="comboPurchase" ${entity?.comboPurchase ? 'checked' : ''} /><span>Available for combo purchase</span></label>
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
          <label class="admin-field admin-field--wide"><span>Coupon Category</span>
            <select class="admin-select" name="couponCategory" data-coupon-category>
              ${COUPON_CATEGORY_OPTIONS.map((option) => `<option value="${option.value}" ${getCouponCategoryValue(entity) === option.value ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field"><span>Coupon Code</span>
            <span class="admin-input-action">
              <input class="admin-input" name="code" value="${escapeHtml(entity?.code || '')}" required />
              <button class="admin-btn admin-btn--soft" type="button" data-coupon-generate-code>Generate</button>
            </span>
          </label>
          <label class="admin-field"><span>Campaign Name</span><input class="admin-input" name="festivalName" value="${escapeHtml(entity?.festivalName || '')}" /></label>
          <label class="admin-field admin-field--wide"><span>Description</span><input class="admin-input" name="description" value="${escapeHtml(entity?.description || '')}" /></label>
          ${(() => {
            const rawDiscountType = String(entity?.discountType || (String(entity?.discount || '').includes('%') ? 'percentage' : 'flat')).toLowerCase();
            const isPercentDiscount = rawDiscountType.includes('percent') || rawDiscountType === '%';
            const rawCommType = String(entity?.commissionType || 'flat').toLowerCase();
            const isPercentComm = rawCommType.includes('percent') || rawCommType === '%';
            const discountVal = entity?.discountValue != null && entity?.discountValue !== ''
              ? Number(entity.discountValue)
              : (entity?.discount != null && entity?.discount !== '' ? String(entity.discount).replace(/[^0-9.]/g, '') : '');
            const commVal = isPercentComm
              ? (entity?.commissionRate ?? '')
              : (entity?.commissionPerOrderPaise ? Number(entity.commissionPerOrderPaise) / 100 : (entity?.commissionPerOrder ?? ''));
            return `
              <label class="admin-field"><span>Discount Type</span>
                <select class="admin-select" name="discountType" data-coupon-discount-type>
                  <option value="flat" ${!isPercentDiscount ? 'selected' : ''}>Rupees (₹)</option>
                  <option value="percentage" ${isPercentDiscount ? 'selected' : ''}>Percentage (%)</option>
                </select>
              </label>
              <label class="admin-field"><span data-coupon-discount-label>Discount ${isPercentDiscount ? '(%)' : '(₹)'}</span>
                <input class="admin-input" name="discount" data-coupon-discount-input type="number" min="1" ${isPercentDiscount ? 'max="100"' : ''} step="1" value="${escapeHtml(String(discountVal))}" placeholder="${isPercentDiscount ? 'e.g. 10' : 'e.g. 1000'}" required />
              </label>
              <label class="admin-field" data-coupon-commission-type-field><span>Commission Type</span>
                <select class="admin-select" name="commissionType" data-coupon-commission-type>
                  <option value="flat" ${!isPercentComm ? 'selected' : ''}>Rupees (₹)</option>
                  <option value="percentage" ${isPercentComm ? 'selected' : ''}>Percentage (%)</option>
                </select>
              </label>
              <label class="admin-field" data-coupon-commission-field><span data-coupon-commission-label>Commission per Order ${isPercentComm ? '(%)' : '(₹)'}</span>
                <input class="admin-input" name="commissionValue" data-coupon-commission type="number" min="0" ${isPercentComm ? 'max="100"' : ''} step="${isPercentComm ? '0.5' : '1'}" value="${escapeHtml(String(commVal))}" placeholder="${isPercentComm ? 'e.g. 10' : 'e.g. 100'}" />
                <small class="admin-field__hint" data-coupon-commission-hint></small>
              </label>
            `;
          })()}
          <label class="admin-field" data-coupon-usage-type-field hidden><span>Usage Type</span>
            <select class="admin-select" name="usageType" data-coupon-usage-type>
              <option value="limited" ${getCouponUsageTypeValue(entity) === 'limited' ? 'selected' : ''}>Limited</option>
              <option value="unlimited" ${getCouponUsageTypeValue(entity) === 'unlimited' ? 'selected' : ''}>Unlimited</option>
            </select>
          </label>
          <label class="admin-field" data-coupon-usage-limit-field><span>Usage Limit</span><input class="admin-input" name="usageCount" type="number" min="1" value="${escapeHtml(entity?.maxRedemptions || entity?.usageCount || '')}" /></label>
          <label class="admin-field" data-coupon-expiry-field><span>Expiry Date</span><input class="admin-input" name="expiry" type="date" value="${escapeHtml(normalizeCouponDateValue(entity?.validTill || entity?.expiresAt || entity?.expiry))}" /></label>
          <label class="admin-field" data-coupon-influencer-field><span>Assigned Influencer</span>
            <select class="admin-select" name="influencerId">
              <option value="">Unassigned</option>
              ${state.influencers.map((influencer) => `<option value="${influencer.id}" ${Number(entity?.influencerId || 0) === Number(influencer.id) ? 'selected' : ''}>${escapeHtml(influencer.name)}${influencer.handle ? ` (${escapeHtml(influencer.handle)})` : ''}</option>`).join('')}
            </select>
          </label>
          <label class="admin-field" data-coupon-owner-field><span>Owner Email</span><input class="admin-input" name="recipientEmail" type="email" value="${escapeHtml(entity?.recipientEmail || '')}" placeholder="customer@example.com" /></label>
          ${(() => {
            const categoryOptions = getCouponCategoryOptions(entity);
            return `
              <div class="admin-field admin-field--wide admin-product-multiselect" data-coupon-products-dropdown>
                <span>Applies To</span>
                <button class="admin-product-multiselect__trigger" type="button" data-coupon-products-toggle aria-expanded="false">${escapeHtml(categoryOptions.allSelected ? 'All Merch Products' : categoryOptions.categories.filter((cat) => cat.selected).length === 1 ? categoryOptions.categories.find((cat) => cat.selected)?.label || '1 Category Selected' : `${categoryOptions.categories.filter((cat) => cat.selected).length} Categories Selected`)}</button>
                <div class="admin-product-multiselect__menu" data-coupon-products-menu hidden>
                  <input class="admin-input" type="search" data-input="couponProductSearch" placeholder="Search categories" aria-label="Search categories" />
                  <div class="admin-product-multiselect__options">
                    <label class="admin-product-multiselect__option" data-coupon-product-option data-coupon-product-search="all merch products">
                      <input type="checkbox" name="appliesToAll" value="merch" data-coupon-product-checkbox data-coupon-product-all ${categoryOptions.allSelected ? 'checked' : ''} />
                      <span>All Merch Products</span>
                    </label>
                    ${categoryOptions.categories.map((cat) => `
                      <label class="admin-product-multiselect__option" data-coupon-product-option data-coupon-product-search="${escapeHtml(cat.label).toLowerCase()}">
                        <input type="checkbox" name="appliesToCategory" value="${cat.slug}" data-coupon-product-checkbox data-coupon-category-slug="${cat.slug}" data-coupon-category-name="${escapeHtml(cat.label)}" ${cat.selected ? 'checked' : ''} />
                        <span>${escapeHtml(cat.label)}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;
          })()}
          <label class="admin-check"><input type="checkbox" name="status" ${String(entity?.status || 'active') === 'active' ? 'checked' : ''} /><span>Active</span></label>
        `,
      },
      influencer: {
        title: entity ? 'Edit Influencer' : 'Add Influencer',
        subtitle: 'Influencers',
        fields: `
          <label class="admin-field"><span>Name</span><input class="admin-input" name="name" value="${escapeHtml(entity?.name || '')}" required /></label>
          <label class="admin-field"><span>Social Handle</span><input class="admin-input" name="handle" value="${escapeHtml(entity?.handle || '')}" required /></label>
          <label class="admin-field">
            <span>Influencer Email <strong style="color:var(--admin-danger);font-size:14px;">*</strong></span>
            <input class="admin-input" name="email" type="email" value="${escapeHtml(entity?.email || '')}" placeholder="influencer@example.com" />
            <small class="admin-field__hint">Used to send commission payment receipts and invoices.</small>
          </label>
          <label class="admin-field"><span>Phone</span><input class="admin-input" name="phone" value="${escapeHtml(entity?.phone || '')}" /></label>
          <label class="admin-field">
            <span>Commission Paid (rupees) <span class="admin-badge admin-badge--neutral" style="font-size:11px;padding:2px 6px;">🔒 Locked</span></span>
            <div style="display:flex;gap:8px;align-items:center;">
              <input class="admin-input" type="text" value="${money(entity?.paidCommission || 0)}" readonly disabled style="background:var(--admin-surface-subtle);cursor:not-allowed;" />
              ${entity ? `<button class="admin-btn admin-btn--soft" type="button" data-action="correct-influencer-commission" data-id="${escapeHtml(entity.id)}" style="white-space:nowrap;">Adjust / Correct</button>` : ''}
            </div>
            <small class="admin-field__hint">Commission Paid is locked after payment. Adjustments require secured admin authorization and audit reason.</small>
          </label>
          <div class="admin-field admin-field--wide"><span>Assigned Coupons</span>${renderAssignedCouponDetails(entity)}<div class="admin-chip-row" style="margin-top:10px;">${entity ? `<button class="admin-btn admin-btn--soft" type="button" data-action="assign-coupon" data-id="${escapeHtml(entity.id)}">Edit assignments</button>` : ''}</div><small class="admin-field__hint">Manage discount and commission in the coupon settings.</small></div>
          <label class="admin-field admin-field--wide"><span>Notes</span><textarea class="admin-textarea" name="notes">${escapeHtml(entity?.notes || '')}</textarea></label>
          <label class="admin-check"><input type="checkbox" name="active" ${entity?.active !== false ? 'checked' : ''} /><span>Active influencer</span></label>
        `,
      },
    };

    const selected = config[type];
    if (!selected) return;

    const isEditingCoupon = type === 'coupon' && Boolean(entity);
    const couponIsInfluencer = isEditingCoupon && getCouponCategoryValue(entity) === 'influencer';
    const couponManagementActions = isEditingCoupon ? `
      <div class="admin-modal__management-actions">
        ${couponIsInfluencer ? '<button class="admin-btn admin-btn--ghost" type="button" data-action="assign-coupon-owner" data-id="' + escapeHtml(entity.id) + '">Assign Influencer</button>' : ''}
        <button class="admin-btn admin-btn--ghost" type="button" data-action="copy-coupon" data-id="${escapeHtml(entity.id)}">Copy Coupon</button>
        <button class="admin-btn admin-btn--ghost" type="button" data-action="toggle-coupon" data-id="${escapeHtml(entity.id)}">${Number(entity.active ?? entity.isActive ?? 0) === 1 ? 'Disable' : 'Enable'}</button>
        <button class="admin-btn admin-btn--danger" type="button" data-action="delete-coupon" data-id="${escapeHtml(entity.id)}">Delete</button>
      </div>
    ` : '';
    const isEditingInfluencer = type === 'influencer' && Boolean(entity);
    const influencerManagementActions = isEditingInfluencer ? `
      <div class="admin-modal__management-actions">
        <button class="admin-btn admin-btn--primary" type="button" data-action="pay-influencer-commission" data-id="${escapeHtml(entity.id)}">Pay Commission</button>
        <button class="admin-btn admin-btn--ghost" type="button" data-action="view-commission-history" data-id="${escapeHtml(entity.id)}">Payment History</button>
        <button class="admin-btn admin-btn--ghost" type="button" data-action="assign-coupon" data-id="${escapeHtml(entity.id)}">Assign Coupons</button>
        <button class="admin-btn ${entity.active ? 'admin-btn--danger' : 'admin-btn--ghost'}" type="button" data-action="toggle-influencer" data-id="${escapeHtml(entity.id)}">${entity.active ? 'Deactivate Influencer' : 'Activate Influencer'}</button>
      </div>
    ` : '';

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
        ${couponManagementActions}
        ${influencerManagementActions}
        <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
        <button class="admin-btn admin-btn--primary" type="submit" form="entityFormSubmit">Save</button>
      `,
      size: 'lg',
    });

    const form = els.adminModalDialog.querySelector(`[data-entity-form="${type}"]`);
    if (form) {
      form.id = 'entityFormSubmit';
      if (type === 'coupon') {
        initializeCouponCategoryForm(form, entity);
      }
    }
  }

  function initializeCouponCategoryForm(form, entity = null) {
    const categorySelect = form.querySelector('[name="couponCategory"]');
    const codeInput = form.querySelector('[name="code"]');
    const generateButton = form.querySelector('[data-coupon-generate-code]');
    const influencerField = form.querySelector('[data-coupon-influencer-field]');
    const ownerField = form.querySelector('[data-coupon-owner-field]');
    const usageTypeField = form.querySelector('[data-coupon-usage-type-field]');
    const usageTypeSelect = form.querySelector('[name="usageType"]');
    const usageLimitField = form.querySelector('[data-coupon-usage-limit-field]');
    const expiryField = form.querySelector('[data-coupon-expiry-field]');
    const influencerSelect = form.querySelector('[name="influencerId"]');
    const ownerEmailInput = form.querySelector('[name="recipientEmail"]');
    const activeInput = form.querySelector('[name="status"]');
    const productsDropdown = form.querySelector('[data-coupon-products-dropdown]');
    const productsToggle = form.querySelector('[data-coupon-products-toggle]');
    const productsMenu = form.querySelector('[data-coupon-products-menu]');
    const productsSearch = form.querySelector('[data-input="couponProductSearch"]');
    const discountTypeSelect = form.querySelector('[name="discountType"]');
    const discountInput = form.querySelector('[name="discount"]');
    const discountLabel = form.querySelector('[data-coupon-discount-label]');
    const commissionTypeSelect = form.querySelector('[name="commissionType"]');
    const commissionTypeField = form.querySelector('[data-coupon-commission-type-field]');
    const commissionInput = form.querySelector('[data-coupon-commission]');
    const commissionHint = form.querySelector('[data-coupon-commission-hint]');
    const commissionLabel = form.querySelector('[data-coupon-commission-label]');

    const updateDiscountUI = () => {
      const type = String(discountTypeSelect?.value || 'flat').toLowerCase();
      const isPercent = type === 'percentage';
      if (discountLabel) discountLabel.textContent = `Discount ${isPercent ? '(%)' : '(₹)'}`;
      if (discountInput) {
        if (isPercent) {
          discountInput.setAttribute('max', '100');
          discountInput.placeholder = 'e.g. 10';
          if (Number(discountInput.value) > 100) discountInput.value = '100';
        } else {
          discountInput.removeAttribute('max');
          discountInput.placeholder = 'e.g. 1000';
        }
      }
    };

    const updateCommissionUI = () => {
      const type = String(commissionTypeSelect?.value || 'flat').toLowerCase();
      const isPercent = type === 'percentage';
      if (commissionLabel) commissionLabel.textContent = `Commission per Order ${isPercent ? '(%)' : '(₹)'}`;
      if (commissionInput) {
        if (isPercent) {
          commissionInput.setAttribute('max', '100');
          commissionInput.setAttribute('step', '0.5');
          commissionInput.placeholder = 'e.g. 10';
          if (Number(commissionInput.value) > 100) commissionInput.value = '100';
        } else {
          commissionInput.removeAttribute('max');
          commissionInput.setAttribute('step', '1');
          commissionInput.placeholder = 'e.g. 100';
        }
      }
    };

    discountTypeSelect?.addEventListener('change', updateDiscountUI);
    commissionTypeSelect?.addEventListener('change', updateCommissionUI);
    updateDiscountUI();
    updateCommissionUI();

    productsToggle?.addEventListener('click', () => {
      const isOpen = !productsMenu?.hidden;
      if (productsMenu) productsMenu.hidden = isOpen;
      productsToggle.setAttribute('aria-expanded', String(!isOpen));
      productsDropdown?.classList.toggle('is-open', !isOpen);
      if (!isOpen) productsSearch?.focus();
    });
    productsSearch?.addEventListener('input', () => filterCouponProductOptions(productsSearch));
    form.querySelectorAll('[data-coupon-product-checkbox]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => syncCouponProductSelection(checkbox));
    });

    const generateCodeForCategory = async () => {
      if (!codeInput) return;
      const category = String(categorySelect?.value || 'public').trim().toLowerCase();
      if (category === 'influencer') return;
      const defaults = getCouponCategoryDefaults(category);
      const originalLabel = generateButton?.textContent || 'Generate';
      if (generateButton) {
        generateButton.disabled = true;
        generateButton.textContent = 'Generating...';
      }
      try {
        const code = await fetchGeneratedCouponCode(defaults.codePrefix);
        codeInput.value = code;
      } catch (error) {
        toast('Code unavailable', error.message || 'Unable to generate a coupon code.', 'danger');
      } finally {
        if (generateButton) {
          generateButton.disabled = false;
          generateButton.textContent = originalLabel;
        }
      }
    };

    const applyCategory = ({ overwriteDefaults = false, regenerateCode = false } = {}) => {
      const category = String(categorySelect?.value || 'public').trim().toLowerCase();
      const defaults = getCouponCategoryDefaults(category);
      const isInfluencer = category === 'influencer';
      const isPrivate = category === 'private';
      const isCommissionBlackout = category !== 'influencer';

      if (commissionInput) {
        commissionInput.disabled = isCommissionBlackout;
        if (isCommissionBlackout) commissionInput.value = '0';
      }
      if (commissionTypeSelect) {
        commissionTypeSelect.disabled = isCommissionBlackout;
        if (isCommissionBlackout) commissionTypeSelect.value = 'flat';
      }
      if (commissionTypeField) commissionTypeField.hidden = isCommissionBlackout;
      if (commissionHint) commissionHint.textContent = isCommissionBlackout
        ? 'Commission applies only to influencer coupons.'
        : '';
      updateCommissionUI();

      if (influencerField) influencerField.hidden = !isInfluencer;
      if (ownerField) ownerField.hidden = !isPrivate;
      if (usageTypeField) usageTypeField.hidden = !isInfluencer;
      if (generateButton) {
        generateButton.hidden = isInfluencer;
        generateButton.disabled = isInfluencer;
      }
      if (!isInfluencer && influencerSelect) influencerSelect.value = '';
      if (!isPrivate && ownerEmailInput) ownerEmailInput.value = '';

      const defaultValues = {
        festivalName: defaults.campaignName,
        description: defaults.description,
        discount: defaults.discount,
        usageCount: defaults.usageCount,
        expiry: addDaysIso(defaults.expiryDays),
        appliesTo: 'merch',
      };

      Object.entries(defaultValues).forEach(([name, value]) => {
        const input = form.querySelector(`[name="${name}"]`);
        if (!input) return;
        if (overwriteDefaults || !String(input.value || '').trim()) {
          input.value = value;
        }
      });

      if (isInfluencer && usageTypeSelect && (overwriteDefaults || !usageTypeSelect.value)) {
        usageTypeSelect.value = 'limited';
      }
      const isUnlimitedInfluencer = isInfluencer && usageTypeSelect?.value === 'unlimited';
      if (usageLimitField) usageLimitField.hidden = isUnlimitedInfluencer;
      if (expiryField) expiryField.hidden = isUnlimitedInfluencer;
      if (isUnlimitedInfluencer) {
        const usageInput = form.querySelector('[name="usageCount"]');
        const expiryInput = form.querySelector('[name="expiry"]');
        if (usageInput) usageInput.value = '';
        if (expiryInput) expiryInput.value = '';
      }

      if (activeInput && !entity) activeInput.checked = true;
      if (regenerateCode && !isInfluencer) generateCodeForCategory();
    };

    applyCategory({ overwriteDefaults: !entity, regenerateCode: !entity });
    categorySelect?.addEventListener('change', () => applyCategory({ overwriteDefaults: true, regenerateCode: true }));
    usageTypeSelect?.addEventListener('change', () => applyCategory({ overwriteDefaults: false }));
    generateButton?.addEventListener('click', () => generateCodeForCategory());
  }

  function renderInfluencerAssignmentModal(influencer) {
    if (!influencer) return;
    const assignedCoupons = normalizeCouponCodes(influencer.coupons || []);
    const availableCouponMap = new Map(
      (Array.isArray(state.coupons) ? state.coupons : [])
        .filter((coupon) => getCouponTypeValue(coupon) === 'influencer')
        .map((coupon) => [String(coupon.code || '').trim().toUpperCase(), coupon])
        .filter(([code]) => Boolean(code))
    );
    assignedCoupons.forEach((code) => {
      if (!availableCouponMap.has(code)) availableCouponMap.set(code, { code });
    });
    const availableCoupons = [...availableCouponMap.values()].sort((left, right) => String(left.code || '').localeCompare(String(right.code || '')));

    openModal({
      title: `Assign Coupons to ${influencer.name}`,
      subtitle: 'Influencers',
      body: `
        <form class="admin-form" data-form="influencer-coupons" data-influencer-id="${escapeHtml(influencer.id)}">
          <div class="admin-form__grid">
            <div class="admin-field admin-field--wide admin-product-multiselect" data-influencer-coupon-dropdown>
              <span>Assigned Coupons</span>
              <div class="admin-chip-row admin-influencer-coupon-chips" data-influencer-coupon-chips></div>
              <button class="admin-product-multiselect__trigger" type="button" data-influencer-coupon-toggle aria-expanded="false">Choose coupons</button>
              <div class="admin-product-multiselect__menu" data-influencer-coupon-menu hidden>
                <input class="admin-input" type="search" data-influencer-coupon-search placeholder="Search influencer coupons" aria-label="Search influencer coupons" />
                <div class="admin-product-multiselect__options">
                  ${availableCoupons.length ? availableCoupons.map((coupon) => {
                    const code = String(coupon.code || '').trim().toUpperCase();
                    return `
                      <label class="admin-product-multiselect__option" data-influencer-coupon-option data-influencer-coupon-search="${escapeHtml(`${code} ${coupon.description || ''}`).toLowerCase()}">
                        <input type="checkbox" name="couponCodes" value="${escapeHtml(code)}" data-influencer-coupon-checkbox ${assignedCoupons.includes(code) ? 'checked' : ''} />
                        <span>${escapeHtml(code)}</span>
                      </label>
                    `;
                  }).join('') : '<p class="admin-table__muted" style="margin:8px;">No influencer coupons available.</p>'}
                </div>
              </div>
            </div>
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
    if (form) {
      form.id = 'influencerCouponForm';
      const dropdown = form.querySelector('[data-influencer-coupon-dropdown]');
      const toggle = form.querySelector('[data-influencer-coupon-toggle]');
      const menu = form.querySelector('[data-influencer-coupon-menu]');
      const search = form.querySelector('[data-influencer-coupon-search]');
      const chips = form.querySelector('[data-influencer-coupon-chips]');
      const renderAssignedChips = () => {
        const selected = [...form.querySelectorAll('[data-influencer-coupon-checkbox]:checked')].map((checkbox) => checkbox.value);
        chips.innerHTML = selected.length
          ? selected.map((code) => `<button class="admin-chip admin-chip--removable" type="button" data-remove-influencer-coupon="${escapeHtml(code)}"><span>${escapeHtml(code)}</span><span aria-hidden="true">&times;</span></button>`).join('')
          : '<span class="admin-table__muted">No coupons assigned yet.</span>';
        toggle.textContent = selected.length ? `${selected.length} Coupon${selected.length === 1 ? '' : 's'} Selected` : 'Choose coupons';
      };
      const filterOptions = () => {
        const query = String(search.value || '').trim().toLowerCase();
        form.querySelectorAll('[data-influencer-coupon-option]').forEach((option) => {
          option.hidden = Boolean(query) && !String(option.dataset.influencerCouponSearch || '').includes(query);
        });
      };
      toggle.addEventListener('click', () => {
        const isOpen = !menu.hidden;
        menu.hidden = isOpen;
        toggle.setAttribute('aria-expanded', String(!isOpen));
        dropdown.classList.toggle('is-open', !isOpen);
        if (!isOpen) search.focus();
      });
      search.addEventListener('input', filterOptions);
      form.querySelectorAll('[data-influencer-coupon-checkbox]').forEach((checkbox) => checkbox.addEventListener('change', renderAssignedChips));
      form.addEventListener('click', (event) => {
        const removeButton = event.target.closest('[data-remove-influencer-coupon]');
        if (!removeButton) return;
        const checkbox = [...form.querySelectorAll('[data-influencer-coupon-checkbox]')].find((item) => item.value === removeButton.dataset.removeInfluencerCoupon);
        if (checkbox) checkbox.checked = false;
        renderAssignedChips();
      });
      renderAssignedChips();
    }
  }

  async function updateInfluencerCouponsFromForm(form) {
    const influencerId = Number(form.dataset.influencerId || 0);
    const influencer = getInfluencerById(influencerId);
    if (!influencer) {
      toast('Influencer not found', 'The selected influencer could not be updated.', 'warning');
      return;
    }

    const coupons = normalizeCouponCodes([...form.querySelectorAll('[data-influencer-coupon-checkbox]:checked')].map((checkbox) => checkbox.value));
    const notes = String(form.querySelector('[name="notes"]')?.value || '').trim();
    await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencerId)}/coupons`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponCodes: coupons, notes }),
    });

    toast('Coupons assigned', `${influencer.name} now has ${coupons.length} coupon${coupons.length === 1 ? '' : 's'} assigned.`, 'success');
    closeModal();
    await loadInfluencerData();
    await loadCouponData();
    await loadReportData();
  }

  function updateProductFromForm(form, existing = null) {
    const fd = new FormData(form);
    const currentImages = [...new Set(fd.getAll('currentImage').map((value) => String(value || '').trim()).filter(Boolean))];
    const preservedImages = currentImages.length
      ? currentImages
      : (Array.isArray(existing?.images) ? [...existing.images] : [existing?.image].filter(Boolean));
    const categoryIdValue = String(fd.get('categoryId') || '').trim();
    const categoryId = /^\d+$/.test(categoryIdValue) ? Number(categoryIdValue) : categoryIdValue;
    const category = state.categories.find((item) => String(item.id) === String(categoryId));
    const newCategoryName = String(fd.get('newCategoryName') || '').trim();
    const newCategorySlug = slugify(newCategoryName);
    const product = {
      id: existing?.id || Number(uniqueId('prod').replace(/\D/g, '').slice(0, 6)),
      name: String(fd.get('name') || '').trim(),
      sku: String(fd.get('sku') || '').trim(),
      categoryId,
      category: category?.name || 'Uncategorized',
      newCategoryName,
      newCategorySlug,
      size: String(fd.get('size') || '').trim(),
      color: String(fd.get('color') || '').trim(),
      price: Number(fd.get('price') || 0),
      priceLabel: catalogPrice(Number(fd.get('price') || 0)),
      stock: Number(fd.get('stock') || 0),
      status: String(fd.get('status') || 'draft'),
      createdAt: existing?.createdAt || toISODate(today),
      sales: Number(existing?.sales || 0),
      lowStockThreshold: Number(existing?.lowStockThreshold || 10),
      comboPurchase: fd.get('comboPurchase') === 'on',
      archived: fd.get('archived') === 'on' || String(fd.get('status')) === 'archived',
      productId: existing?.productId || existing?.parentProductId || existing?.id,
      parentProductId: existing?.parentProductId || existing?.productId || existing?.id,
      variantId: existing?.variantId || existing?.id,
      imageUrl: String(existing?.imageUrl || '').trim(),
      image: String(fd.get('image') || '').trim() || preservedImages[0] || '',
      images: preservedImages,
      description: String(fd.get('description') || '').trim(),
      specifications: parseProductSpecifications(fd.get('specifications')),
    };
    return product;
  }

  function parseProductSpecifications(value) {
    return String(value || '').split(/\r?\n/).reduce((result, line) => {
      const separator = line.indexOf(':');
      if (separator < 1) return result;
      const label = line.slice(0, separator).trim();
      const specificationValue = line.slice(separator + 1).trim();
      if (label && specificationValue) result[label] = specificationValue;
      return result;
    }, {});
  }

  function formatProductSpecifications(specifications) {
    if (!specifications || typeof specifications !== 'object') return '';
    return Object.entries(specifications).map(([label, value]) => `${label}: ${value}`).join('\n');
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
    const couponCategory = String(fd.get('couponCategory') || 'public').trim().toLowerCase();
    const influencerId = Number(fd.get('influencerId') || 0);
    const recipientEmail = String(fd.get('recipientEmail') || '').trim().toLowerCase();
    const couponType = couponCategory === 'private' ? 'private' : 'public';
    const usageType = couponCategory === 'influencer'
      ? String(fd.get('usageType') || 'limited').trim().toLowerCase()
      : '';
    const isUnlimitedInfluencer = couponCategory === 'influencer' && usageType === 'unlimited';
    const influencer = getInfluencerById(influencerId);
    const usageCount = Number(fd.get('usageCount') || 0);

    const discountType = String(fd.get('discountType') || 'flat').trim().toLowerCase();
    const discountValue = Number(fd.get('discount') || 0);
    const commissionType = String(fd.get('commissionType') || 'flat').trim().toLowerCase();
    const rawCommVal = Number(fd.get('commissionValue') || 0);

    const commissionRate = couponCategory !== 'influencer' || commissionType !== 'percentage'
      ? 0
      : Math.min(100, Math.max(0, rawCommVal));

    const commissionPerOrderPaise = couponCategory !== 'influencer' || commissionType === 'percentage'
      ? 0
      : Math.max(0, Math.round(rawCommVal * 100));

    const appliesTo = fd.get('appliesToAll') === 'merch'
      ? 'merch'
      : (() => {
          const categorySlugs = [...new Set(fd.getAll('appliesToCategory').map((s) => String(s || '').trim().toLowerCase()).filter(Boolean))];
          return categorySlugs.length ? `category:${categorySlugs.join(',')}` : 'merch';
        })();

    return {
      id: existing?.id || Date.now(),
      code: String(fd.get('code') || '').trim().toUpperCase(),
      description: String(fd.get('description') || '').trim(),
      discountType,
      discountValue,
      discount: discountType === 'percentage' ? `${discountValue}%` : String(discountValue),
      commissionType,
      commissionRate,
      commissionPerOrderPaise,
      usageCount: isUnlimitedInfluencer ? null : Number.isFinite(usageCount) && usageCount > 0 ? usageCount : null,
      expiry: isUnlimitedInfluencer ? '' : String(fd.get('expiry') || '').trim(),
      usageType,
      status: fd.get('status') === 'on' ? 'active' : 'inactive',
      couponType,
      ownerType: couponCategory === 'influencer' ? 'influencer' : couponCategory === 'private' ? 'private' : 'general',
      appliesTo,
      owner: couponCategory === 'influencer' ? influencer?.name || 'Influencer' : couponCategory === 'private' ? recipientEmail : 'General',
      recipientName: couponCategory === 'influencer' ? influencer?.name || '' : '',
      recipientEmail: couponCategory === 'private' ? recipientEmail : '',
      influencerId: couponCategory === 'influencer' ? influencerId : 0,
      festivalName: String(fd.get('festivalName') || '').trim(),
      couponCategory,
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
      notes: String(fd.get('notes') || '').trim(),
      commissionPerOrderPaise: Number(existing?.commissionPerOrderPaise || 0),
      paidCommission: existing ? Number(existing.paidCommission || 0) : 0,
      coupons: existing?.coupons || [],
      totalOrders: Number(existing?.totalOrders || 0),
      revenue: Number(existing?.revenue || 0),
      couponUsage: Number(existing?.couponUsage || 0),
      activeCampaigns: Number(existing?.activeCampaigns || 0),
      active: fd.get('active') === 'on',
    };
  }

  async function updateSettingsFromForm(form) {
    const fd = new FormData(form);
    const settings = {
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
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    try {
      const result = await apiRequest('/api/merch/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });
      state.settings = { ...state.settings, ...(result.settings || settings) };
      toast('Settings saved', 'Store settings have been saved successfully.', 'success');
      renderAll();
    } catch (error) {
      toast('Settings not saved', error.message || 'Unable to save store settings.', 'danger');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  }

  async function loadSettingsData() {
    try {
      const result = await apiRequest('/api/merch/admin/settings');
      if (result.settings && typeof result.settings === 'object') {
        state.settings = { ...state.settings, ...result.settings };
        renderSettings();
      }
    } catch (error) {
      toast('Settings unavailable', error.message || 'Unable to load store settings.', 'warning');
    }
  }

  async function loadCouponData() {
    state.couponsLoading = true;
    renderCoupons();
    try {
      const result = await apiRequest('/api/admin/coupons?portal=merch');
      state.coupons = Array.isArray(result.coupons) ? result.coupons : [];
    } catch (error) {
      state.coupons = [];
      toast('Coupons unavailable', error.message || 'Unable to load coupons from the shared admin API.', 'warning');
    } finally {
      state.couponsLoading = false;
      renderCoupons();
      renderDashboard();
    }
  }

  async function loadDashboardStats(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      state.dashboardStatsLoading = !state.dashboardStats;
      renderDashboard();
    }
    try {
      const result = await apiRequest('/api/merch/admin/stats');
      state.dashboardStats = result || null;
      state.notifications = mergeNotificationState(result?.notifications);
    } catch (error) {
      if (!silent) {
        state.dashboardStats = null;
        state.notifications = [];
      }
    } finally {
      state.dashboardStatsLoading = false;
      if (state.view === 'dashboard') renderDashboard();
      if (state.view === 'reports') renderReports();
    }
  }

  async function loadHypeData() {
    state.hypesLoading = true;
    try {
      const result = await apiRequest('/api/merch/admin/hype');
      state.hypes = Array.isArray(result.hypes) ? result.hypes : [];
    } catch (error) {
      state.hypes = [];
      toast('Trending products unavailable', error.message || 'Unable to load HYPE configuration.', 'warning');
    } finally {
      state.hypesLoading = false;
      renderDashboard();
    }
  }

  async function loadProductData() {
    state.productsLoading = true;
    state.productsLoaded = false;
    try {
      const result = await apiRequest('/api/merch/admin/products');
      const productRows = Array.isArray(result) ? result : (Array.isArray(result?.products) ? result.products : []);
      const categoryIds = { hoodies: 1, bottles: 2, sprays: 3 };
      const unknownCategories = new Map();
      const products = productRows.map((product) => {
        const variants = Array.isArray(product.variants) ? product.variants : [];
        const firstVariant = variants[0] || {};
        const price = Number(firstVariant.price || product.basePrice || 0) / 100;
        const categorySlug = String(product.category || '').trim().toLowerCase();
        const categoryId = categoryIds[categorySlug] || `custom-${categorySlug}`;
        if (!categoryIds[categorySlug] && categorySlug && !unknownCategories.has(categorySlug)) {
          unknownCategories.set(categorySlug, {
            id: categoryId,
            name: categorySlug.split('-').map((word) => word ? word[0].toUpperCase() + word.slice(1) : '').join(' '),
            slug: categorySlug,
            active: true,
            productCount: 0,
            description: `Products in the ${categorySlug.replace(/-/g, ' ')} category.`,
          });
        }
        return {
          id: Number(product.id),
          name: product.name,
          slug: product.slug,
          primarySku: product.primarySku || firstVariant.sku || '',
          categoryId,
          categorySlug,
          category: state.categories.find((item) => String(item.id) === String(categoryId))?.name || unknownCategories.get(categorySlug)?.name || categorySlug,
          price,
          priceLabel: catalogPrice(price),
          stock: Number(product.stock || 0),
          status: product.status === 'published' ? 'published' : 'archived',
          archived: Boolean(product.archived),
          createdAt: product.createdAt || '',
          sales: Number(product.sales || 0),
          lowStockThreshold: Number(product.lowStockThreshold || LOW_STOCK_THRESHOLD),
          featured: Boolean(product.featured),
          comboPurchase: Boolean(product.comboPurchase),
          isCombo: Boolean(product.isCombo),
          comboItems: Array.isArray(product.comboItems) ? product.comboItems : [],
          image: product.imageUrl || product.image || (Array.isArray(product.images) ? product.images[0] : '') || '',
          images: (Array.isArray(product.images) ? product.images : (Array.isArray(product.imageUrls) ? product.imageUrls : [product.imageUrl || product.image])).filter(Boolean),
          description: product.description || '',
          specifications: product.specifications || {},
          variants: variants.map((variant) => ({
            ...variant,
            price: Number(variant.price || 0) / 100,
            stock: Number(variant.stock || 0),
            imageUrl: variant.imageUrl || '',
            images: Array.isArray(variant.images) ? variant.images.filter(Boolean) : [],
          })),
        };
      });
      unknownCategories.forEach((category) => {
        if (!state.categories.some((item) => String(item.id) === String(category.id))) state.categories.push(category);
      });
      state.products = expandProductVariants(products);
      state.productsLoaded = true;
      renderAll();
    } catch (error) {
      state.products = [];
      state.productsLoaded = true;
      toast('Products unavailable', error.message || 'Unable to load products from the merch API.', 'warning');
      renderOffers();
    } finally {
      state.productsLoading = false;
    }
  }

  async function loadTrashData() {
    state.trashLoading = true;
    try {
      const result = await apiRequest('/api/merch/admin/products/trash');
      state.trashProducts = Array.isArray(result) ? result : [];
      const validProductIds = new Set(state.trashProducts.filter((product) => product.isDeleted).map((product) => Number(product.id)));
      const validVariantIds = new Set(state.trashProducts.flatMap((product) => (product.variants || []).filter((variant) => variant.deletedAt).map((variant) => Number(variant.id))));
      state.selectedTrashProductIds = state.selectedTrashProductIds.filter((id) => validProductIds.has(Number(id)));
      state.selectedTrashVariantIds = state.selectedTrashVariantIds.filter((id) => validVariantIds.has(Number(id)));
      const totalPages = Math.max(1, Math.ceil((state.trashProducts.reduce((count, product) => count + (product.isDeleted ? 1 : 0) + (product.variants || []).filter((variant) => variant.deletedAt).length, 0)) / 5));
      state.trashProductsPage = Math.min(state.trashProductsPage, totalPages);
    } catch (error) {
      state.trashProducts = [];
      toast('Bin unavailable', error.message || 'Unable to load deleted products.', 'warning');
    } finally {
      state.trashLoading = false;
      renderTrash();
    }
  }

  async function loadOrderData(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      state.ordersLoading = true;
      renderOrders();
    }
    try {
      const result = await apiRequest('/api/merch/admin/orders');
      const newOrders = Array.isArray(result.orders) ? result.orders : [];
      const changed = JSON.stringify(newOrders) !== JSON.stringify(state.orders);
      state.orders = newOrders;
      if (!silent || changed) {
        if (state.view === 'orders') {
          const activeEl = document.activeElement;
          if (activeEl instanceof HTMLInputElement && els.ordersView && els.ordersView.contains(activeEl)) {
            preserveInputFocus(activeEl, renderOrders);
          } else {
            renderOrders();
          }
        }
      }
    } catch (error) {
      if (!silent) {
        state.orders = [];
        toast('Orders unavailable', error.message || 'Unable to load merch orders from the admin API.', 'warning');
      }
    } finally {
      if (!silent) {
        state.ordersLoading = false;
        renderOrders();
      }
      if (state.view === 'dashboard') renderDashboard();
      if (state.view === 'reports') renderReports();
    }
  }

  async function loadCustomerData() {
    state.customersLoading = true;
    renderCustomers();
    try {
      const result = await apiRequest('/api/merch/admin/customers');
      state.customers = Array.isArray(result.customers) ? result.customers : [];
    } catch (error) {
      state.customers = [];
      toast('Customers unavailable', error.message || 'Unable to load merch customer data from the admin API.', 'warning');
    } finally {
      state.customersLoading = false;
      renderCustomers();
    }
  }

  async function loadCampaignData() {
    state.campaignsLoading = true;
    try {
      const result = await apiRequest('/api/merch/admin/campaigns');
      state.campaigns = Array.isArray(result.campaigns) ? result.campaigns : [];
    } catch (error) {
      console.warn('[Admin] Failed to load campaigns:', error?.message || error);
      state.campaigns = [];
    } finally {
      state.campaignsLoading = false;
    }
  }

  async function loadInfluencerData() {
    state.influencersLoading = true;
    renderInfluencers();
    try {
      const promises = [
        apiRequest('/api/merch/admin/influencers'),
        loadCampaignData(),
      ];
      if (!state.productsLoaded) {
        promises.push(loadProductData());
      }
      const [infResult] = await Promise.all(promises);
      state.influencers = Array.isArray(infResult?.influencers) ? infResult.influencers : [];
      if (!state.selectedInfluencerId && state.influencers[0]) {
        state.selectedInfluencerId = state.influencers[0].id;
      }
    } catch (error) {
      toast('Influencers unavailable', error.message || 'Unable to load influencer data from the admin API.', 'warning');
    } finally {
      state.influencersLoading = false;
      renderInfluencers();
    }
  }

  async function loadReportData(options = {}) {
    const silent = Boolean(options.silent);
    if (!silent) {
      state.reportsLoading = true;
    }
    try {
      const params = new URLSearchParams();
      if (state.reportFrom) params.set('startDate', state.reportFrom);
      if (state.reportTo) params.set('endDate', state.reportTo);
      state.reports = await apiRequest(`/api/merch/admin/reports?${params.toString()}`);
    } catch (error) {
      if (!silent) {
        state.reports = null;
        toast('Reports unavailable', error.message || 'Unable to load merch reports from the admin API.', 'warning');
      }
    } finally {
      state.reportsLoading = false;
      if (state.view === 'reports') renderReports();
      if (state.view === 'dashboard') renderDashboard();
    }
  }

  function downloadCurrentReport(reportSection = 'all') {
    if (!state.reports) {
      toast('Reports unavailable', 'Load the report data before downloading.', 'warning');
      return;
    }

    const format = String(state.reportFormat || 'csv').toLowerCase();
    const report = state.reports;
    const startLabel = String(state.reportFrom || 'start').replace(/[^0-9-]/g, '');
    const endLabel = String(state.reportTo || 'end').replace(/[^0-9-]/g, '');
    const sectionLabel = String(reportSection || 'all').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
    const baseName = `merch-${sectionLabel}-report-${startLabel}-${endLabel}`;

    if (format === 'excel') {
      downloadMerchReportFile(`${baseName}.xls`, buildMerchReportTsv(report, reportSection), 'application/vnd.ms-excel;charset=utf-8');
      toast('Download ready', 'The Excel-friendly report has been downloaded.', 'success');
      return;
    }

    if (format === 'pdf') {
      downloadMerchReportFile(`${baseName}.html`, buildMerchReportHtml(report, reportSection), 'text/html;charset=utf-8');
      toast('Download ready', 'The invoice-style report has been downloaded. Open it and print to PDF if needed.', 'success');
      return;
    }

    downloadMerchReportFile(`${baseName}.csv`, buildMerchReportCsv(report, reportSection), 'text/csv;charset=utf-8');
    toast('Download ready', 'The CSV report has been downloaded.', 'success');
  }

  async function emailCurrentReport() {
    if (!state.reports) {
      toast('Reports unavailable', 'Load the report data before sending it by email.', 'warning');
      return;
    }

    try {
      await apiRequest('/api/merch/admin/reports/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: state.reportFrom,
          endDate: state.reportTo,
          format: state.reportFormat || 'csv',
        }),
      });
      toast('Report emailed', 'The current merch influencer report has been emailed successfully.', 'success');
    } catch (error) {
      toast('Email failed', error.message || 'Unable to send the report email.', 'danger');
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
    // Selection is stored by row/variant id. Read it from the full catalog so
    // sorting, filtering, or a page refresh cannot hide selected rows from
    // the combo/archive/delete actions.
    return state.products.filter((item) => state.selectedProductIds.includes(item.id));
  }

  function createLocalProductDuplicate(product) {
    const duplicateId = Date.now() + Math.floor(Math.random() * 1000);
    return {
      ...product,
      id: duplicateId,
      productId: duplicateId,
      parentProductId: duplicateId,
      variantId: duplicateId,
      sourceProductId: Number(product.parentProductId || product.productId || product.id),
      isLocalDuplicate: true,
      name: `${product.name} Copy`,
      slug: `${product.slug || product.name || 'product'}-copy-${duplicateId}`,
      sku: `${product.sku}-COPY-${duplicateId}`,
      createdAt: toISODate(today),
    };
  }

  async function deleteMerchProduct(productId) {
    await apiRequest(`/api/merch/admin/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    return { deleted: false, trashed: true };
  }

  async function deleteMerchVariant(variantId) {
    await apiRequest('/api/merch/admin/variants/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds: [Number(variantId)] }),
    });
    return { deleted: false, trashed: true };
  }

  async function restoreTrashProducts(productIds) {
    const ids = [...new Set((Array.isArray(productIds) ? productIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) {
      toast('Select deleted products', 'Choose at least one Bin item to restore.', 'warning');
      return;
    }
    try {
      await apiRequest('/api/merch/admin/products/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      });
      state.selectedTrashProductIds = state.selectedTrashProductIds.filter((id) => !ids.includes(Number(id)));
      await loadProductData();
      await loadTrashData();
      toast('Products restored', `${ids.length} product${ids.length === 1 ? '' : 's'} restored with the original IDs and variants.`, 'success');
      renderAll();
    } catch (error) {
      toast('Restore failed', error.message || 'Unable to restore the selected products.', 'warning');
    }
  }

  async function restoreTrashVariants(variantIds) {
    const ids = [...new Set((Array.isArray(variantIds) ? variantIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length) {
      toast('Select deleted variants', 'Choose at least one variant in Bin to restore.', 'warning');
      return;
    }
    try {
      await apiRequest('/api/merch/admin/variants/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: ids }),
      });
      state.selectedTrashVariantIds = state.selectedTrashVariantIds.filter((id) => !ids.includes(Number(id)));
      await loadProductData();
      await loadTrashData();
      toast('Variants restored', `${ids.length} variant${ids.length === 1 ? '' : 's'} restored with the original IDs and inventory.`, 'success');
      renderAll();
    } catch (error) {
      toast('Restore failed', error.message || 'Unable to restore the selected variants.', 'warning');
    }
  }

  function openPermanentDeleteModal(productIds, variantIds = []) {
    const ids = [...new Set((Array.isArray(productIds) ? productIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    const variantIdList = [...new Set((Array.isArray(variantIds) ? variantIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length && !variantIdList.length) {
      toast('Select deleted products', 'Choose at least one Bin item to permanently delete.', 'warning');
      return;
    }
    const names = ids.map((id) => state.trashProducts.find((product) => Number(product.id) === id)?.name).filter(Boolean);
    openModal({
      title: 'Permanently delete products',
      subtitle: 'Irreversible action',
      body: `<p style="margin:0 0 14px;color:var(--admin-danger);font-weight:700;line-height:1.6;">This permanently removes the selected Bin records and their non-order relationships. Existing order history is preserved. This cannot be undone.</p><p style="margin:0 0 14px;color:var(--admin-muted);line-height:1.6;">Selected: ${escapeHtml(names.join(', ') || `${ids.length} product${ids.length === 1 ? '' : 's'}`)}</p><label class="admin-field"><span>Type PERMANENTLY DELETE to continue</span><input class="admin-input" data-permanent-delete-confirm autocomplete="off" /></label><p class="admin-table__muted" data-permanent-delete-error hidden>Confirmation text does not match.</p>`,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button><button class="admin-btn admin-btn--danger" type="button" data-permanent-delete-submit>Delete permanently</button>',
      size: 'md',
    });
    const dialog = els.adminModalDialog;
    dialog.querySelector('[data-permanent-delete-submit]')?.addEventListener('click', async () => {
      const confirmation = String(dialog.querySelector('[data-permanent-delete-confirm]')?.value || '').trim();
      const error = dialog.querySelector('[data-permanent-delete-error]');
      if (confirmation !== 'PERMANENTLY DELETE') {
        if (error) error.hidden = false;
        return;
      }
      try {
        const requests = [];
        if (ids.length) requests.push(apiRequest('/api/merch/admin/products/permanent-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: ids, confirmation }),
        }));
        if (variantIdList.length) requests.push(apiRequest('/api/merch/admin/variants/permanent-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productIds: variantIdList, confirmation }),
        }));
        await Promise.all(requests);
        closeModal();
        state.selectedTrashProductIds = state.selectedTrashProductIds.filter((id) => !ids.includes(Number(id)));
        state.selectedTrashVariantIds = state.selectedTrashVariantIds.filter((id) => !variantIdList.includes(Number(id)));
        await loadTrashData();
        const deletedCount = ids.length + variantIdList.length;
      toast('Bin items permanently deleted', `${deletedCount} item${deletedCount === 1 ? '' : 's'} permanently deleted.`, 'danger');
        renderAll();
      } catch (requestError) {
        toast('Permanent delete failed', requestError.message || 'Unable to permanently delete the selected products.', 'warning');
      }
    });
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
    renderTrash();
    renderOffers();
    renderCategories();
    renderOrders();
    renderCustomers();
    renderCoupons();
    renderInfluencers();
    renderReports();
    renderSettings();
  }

  async function updateOrderOnServer(order, payload) {
    const response = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await loadOrderData();
    await loadCustomerData();
    await loadReportData();
    return response;
  }

  async function refundOrderOnServer(order) {
    try {
      return await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    } catch (error) {
      // Keep compatibility with deployments that expose refund through the
      // existing status endpoint rather than a dedicated refund route.
      if (![404, 405].includes(error?.status)) throw error;
      return updateOrderOnServer(order, { status: order.status || 'processing', payment_status: 'refunded' });
    }
  }

  async function fetchOrderInvoiceLink(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Order details are unavailable.');
    }
    return apiRequest(`/api/merch/orders/${encodeURIComponent(id)}/invoice-link`);
  }

  function openInvoiceDocument(url) {
    const targetUrl = buildApiUrl(url);
    const opened = window.open(targetUrl, '_blank');
    if (!opened) {
      toast('Invoice unavailable', 'The invoice could not open. Please allow popups and try again.', 'warning');
      return;
    }
    try {
      opened.opener = null;
    } catch {
      // Some browsers restrict access to the opened window; the invoice tab still opened.
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
    return 'Merch-invoice.pdf';
  }

  async function openOrderInvoice(orderId) {
    try {
      const data = await fetchOrderInvoiceLink(orderId);
      if (!data.invoiceUrl) throw new Error('Invoice link missing.');
      openInvoiceDocument(data.invoiceUrl);
    } catch (error) {
      toast('Invoice unavailable', error.message || 'Unable to open the invoice.', 'warning');
    }
  }

  async function downloadOrderInvoice(orderId) {
    try {
      const data = await fetchOrderInvoiceLink(orderId);
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
      toast('Download unavailable', error.message || 'Unable to download the invoice.', 'warning');
    }
  }

  async function emailOrderInvoice(orderId) {
    try {
      const id = Number(orderId);
      if (!Number.isInteger(id) || id <= 0) throw new Error('Order details are unavailable.');
      const result = await apiRequest(`/api/merch/orders/${encodeURIComponent(id)}/invoice-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      toast('Invoice emailed', `Sent to ${result.recipientEmail || 'the customer email on file'}.`, 'success');
    } catch (error) {
      toast('Email unavailable', error.message || 'Unable to email the invoice.', 'warning');
    }
  }

  async function openShiprocketFulfillModal(order) {
    if (!order) return;
    openModal({
      title: `Ship with Shiprocket — ${order.orderNumber || `Order #${order.id}`}`,
      subtitle: `Checking courier rates and serviceability...`,
      body: `
        <div style="text-align:center;padding:32px 16px;">
          <div class="admin-spinner" style="margin:0 auto 14px;width:32px;height:32px;border:3px solid rgba(59,130,246,0.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <p style="font-weight:600;margin:0 0 4px;">Connecting to Shiprocket API...</p>
          <p class="admin-table__muted" style="font-size:12px;margin:0;">Finding best courier rates for delivery to destination</p>
        </div>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>',
      size: 'lg',
    });

    try {
      const res = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/shiprocket/couriers`);
      const couriers = res?.couriers || [];

      if (!couriers.length) {
        const bodyEl = els.adminModalDialog.querySelector('.admin-modal__body');
        if (bodyEl) {
          bodyEl.innerHTML = `
            <div style="text-align:center;padding:24px 16px;">
              <p style="color:#ef4444;font-weight:600;font-size:15px;margin-bottom:8px;">⚠️ No couriers currently available</p>
              <p class="admin-table__muted" style="margin:0 0 16px;">Destination Pincode: <strong>${escapeHtml(res?.deliveryPostcode || 'Unknown')}</strong></p>
              <p style="font-size:13px;color:#6b7280;line-height:1.5;">Please verify that the delivery pincode is valid and that you have added your Pickup Address in your Shiprocket account.</p>
            </div>
          `;
        }
        return;
      }

      const subEl = els.adminModalDialog.querySelector('.admin-modal__sub');
      if (subEl) subEl.textContent = `Select a courier partner for delivery to ${escapeHtml(res.deliveryPostcode)}:`;

      const bodyEl = els.adminModalDialog.querySelector('.admin-modal__body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <form class="admin-form" data-shiprocket-fulfill-form>
            <div style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;padding-right:4px;">
              ${couriers.map((c, idx) => `
                <label class="admin-card admin-courier-card" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border:1.5px solid ${idx === 0 ? '#3b82f6' : 'rgba(0,0,0,0.1)'};border-radius:10px;background:${idx === 0 ? 'rgba(59,130,246,0.04)' : 'transparent'};transition:all 0.15s ease;">
                  <div style="display:flex;align-items:center;gap:14px;">
                    <input type="radio" name="courier_company_id" value="${c.courierCompanyId}" ${idx === 0 ? 'checked' : ''} style="width:18px;height:18px;accent-color:#3b82f6;" />
                    <div>
                      <div style="font-weight:600;font-size:14px;color:var(--admin-text,#1f2937);display:flex;align-items:center;gap:6px;">
                        <span>${escapeHtml(c.courierName)}</span>
                        ${idx === 0 ? '<span style="background:#10b981;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;">Lowest Price</span>' : ''}
                      </div>
                      <div class="admin-table__muted" style="font-size:12px;margin-top:2px;">
                        Est. Delivery: <strong>${escapeHtml(c.estimatedDeliveryDays || '2-4')} Days</strong> ${c.etd ? `(${escapeHtml(c.etd)})` : ''} · Mode: <strong>${c.isSurface ? 'Surface' : 'Air'}</strong>
                      </div>
                    </div>
                  </div>
                  <div style="text-align:right;">
                    <div style="font-size:17px;font-weight:700;color:#10b981;">₹${Number(c.rate || 0).toFixed(2)}</div>
                    ${c.rating ? `<div style="font-size:11px;color:#f59e0b;font-weight:600;">★ ${escapeHtml(String(c.rating))}</div>` : ''}
                  </div>
                </label>
              `).join('')}
            </div>
          </form>
        `;

        const formEl = bodyEl.querySelector('[data-shiprocket-fulfill-form]');
        formEl?.addEventListener('change', () => {
          formEl.querySelectorAll('.admin-courier-card').forEach((card) => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio?.checked) {
              card.style.borderColor = '#3b82f6';
              card.style.background = 'rgba(59,130,246,0.04)';
            } else {
              card.style.borderColor = 'rgba(0,0,0,0.1)';
              card.style.background = 'transparent';
            }
          });
        });
      }

      const footEl = els.adminModalDialog.querySelector('.admin-modal__foot');
      if (footEl) {
        footEl.innerHTML = `
          <button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Cancel</button>
          <button class="admin-btn admin-btn--primary" type="button" data-action="confirm-shiprocket-awb" data-id="${order.id}">🚀 Assign Courier &amp; Generate AWB</button>
        `;
      }
    } catch (err) {
      const bodyEl = els.adminModalDialog.querySelector('.admin-modal__body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="padding:20px;color:#ef4444;background:rgba(239,68,68,0.06);border-radius:8px;">
            <p style="font-weight:700;margin:0 0 6px;">❌ Shiprocket Error:</p>
            <p style="margin:0 0 12px;font-size:13px;">${escapeHtml(err.message || 'Serviceability check failed')}</p>
            <p class="admin-table__muted" style="font-size:12px;margin:0;">Make sure you have added a Pickup Address in your Shiprocket console (Settings → Pickup Address).</p>
          </div>
        `;
      }
    }
  }

  async function confirmShiprocketAwb(orderId) {
    const form = els.adminModalDialog.querySelector('[data-shiprocket-fulfill-form]');
    const courierId = form?.elements?.courier_company_id?.value;

    const confirmBtn = els.adminModalDialog.querySelector('[data-action="confirm-shiprocket-awb"]');
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Generating AWB...';
    }

    try {
      const res = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(orderId)}/shiprocket/assign-awb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierId }),
      });

      closeModal();
      const awbCode = res.awbRes?.awbCode || res.order?.shiprocketAwbCode || 'Assigned';
      const courierName = res.awbRes?.courierName || res.order?.shiprocketCourierName || 'Courier';
      toast('Shipment Created!', `Dispatched via ${courierName} · AWB: ${awbCode}`, 'success');

      // Update local state order
      const targetIndex = state.orders.findIndex((o) => Number(o.id) === Number(orderId));
      if (targetIndex >= 0 && res.order) {
        state.orders[targetIndex] = res.order;
      }
      renderOrders();

      // Open shipping label in new tab if available
      if (res.labelUrl) {
        window.open(res.labelUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      toast('Shiprocket Error', err.message || 'Failed to assign courier and generate AWB', 'warning');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '🚀 Assign Courier & Generate AWB';
      }
    }
  }

  async function openShiprocketTrackModal(order) {
    if (!order) return;
    const awb = order.shiprocketAwbCode || order.trackingNumber;
    openModal({
      title: `Live Shipment Tracking — ${order.orderNumber || `Order #${order.id}`}`,
      subtitle: `AWB: ${escapeHtml(awb || 'Pending')} · Carrier: ${escapeHtml(order.shiprocketCourierName || order.carrier || 'Shiprocket')}`,
      body: `
        <div style="text-align:center;padding:32px 16px;">
          <div class="admin-spinner" style="margin:0 auto 14px;width:32px;height:32px;border:3px solid rgba(59,130,246,0.2);border-top-color:#3b82f6;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <p style="font-weight:600;margin:0 0 4px;">Fetching live scans...</p>
          <p class="admin-table__muted" style="font-size:12px;margin:0;">Querying Shiprocket tracking network</p>
        </div>
      `,
      footer: '<button class="admin-btn admin-btn--ghost" type="button" data-action="close-modal">Close</button>',
      size: 'md',
    });

    try {
      const res = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/shiprocket/track`);
      const track = res?.track || {};
      const activities = track.activities || [];

      const bodyEl = els.adminModalDialog.querySelector('.admin-modal__body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div class="admin-list" style="margin-bottom:16px;">
            <div class="admin-list__item" style="display:flex;justify-content:space-between;align-items:center;background:rgba(59,130,246,0.06);padding:12px 14px;border-radius:8px;">
              <div>
                <p class="admin-list__item-title" style="margin:0 0 2px;font-size:11px;text-transform:uppercase;color:#6b7280;">Current Status</p>
                <p style="margin:0;font-size:16px;font-weight:700;color:#3b82f6;">${escapeHtml(track.currentStatus || 'In Transit')}</p>
              </div>
              ${track.edd ? `<div style="text-align:right;"><span class="admin-table__muted" style="font-size:11px;">Est. Delivery:</span><br><strong>${escapeHtml(track.edd)}</strong></div>` : ''}
            </div>
          </div>

          <h4 style="margin:16px 0 10px;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;">Checkpoint Timeline</h4>
          ${activities.length ? `
            <div class="admin-status-timeline" style="max-height:280px;overflow-y:auto;padding-right:4px;">
              ${activities.map((act) => `
                <div class="admin-timeline-item">
                  <span class="admin-timeline-item__dot"></span>
                  <div>
                    <p class="admin-timeline-item__title" style="font-weight:600;">${escapeHtml(act.activity || act.srStatusLabel || act.status)}</p>
                    <p class="admin-timeline-item__text" style="font-size:12px;color:#6b7280;">${escapeHtml(act.location || '')} · ${escapeHtml(act.date || '')}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="admin-table__muted" style="text-align:center;padding:20px 0;margin:0;">No scan activities recorded yet. Parcel is awaiting courier pickup.</p>
          `}
        `;
      }
    } catch (err) {
      const bodyEl = els.adminModalDialog.querySelector('.admin-modal__body');
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div style="padding:16px;color:#ef4444;background:rgba(239,68,68,0.06);border-radius:8px;">
            <strong>Tracking error:</strong>
            <p style="margin:6px 0 0;font-size:13px;">${escapeHtml(err.message || 'Unable to fetch tracking info')}</p>
          </div>
        `;
      }
    }
  }

  async function handleShiprocketSchedulePickup(order) {
    if (!order) return;
    try {
      const res = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/shiprocket/pickup`, {
        method: 'POST',
      });
      const token = res?.pickupRes?.pickupTokenNumber || 'Confirmed';
      toast('Pickup Requested!', `Courier pickup scheduled. Token: ${token}`, 'success');
      const target = state.orders.find((o) => Number(o.id) === Number(order.id));
      if (target) {
        target.shiprocketPickupToken = token;
        target.shiprocketStatus = 'PICKUP SCHEDULED';
      }
      renderOrders();
    } catch (err) {
      toast('Pickup Scheduling Failed', err.message || 'Unable to schedule pickup', 'warning');
    }
  }

  async function handleShiprocketGetLabel(order) {
    if (!order) return;
    try {
      const res = await apiRequest(`/api/merch/admin/orders/${encodeURIComponent(order.id)}/shiprocket/label`);
      if (res?.labelUrl) {
        window.open(res.labelUrl, '_blank', 'noopener,noreferrer');
      } else {
        toast('Label Not Ready', 'Shipping label is not yet generated by the courier.', 'warning');
      }
    } catch (err) {
      toast('Label Error', err.message || 'Unable to fetch shipping label', 'warning');
    }
  }

  async function handleAction(action, target) {
    const rawId = String(target?.dataset?.id || target?.closest?.('[data-id]')?.dataset?.id || '');
    const id = Number(rawId || 0);
    const product = state.products.find((item) =>
      Number(item.id) === id ||
      Number(item.variantId) === id ||
      Number(item.productId) === id ||
      Number(item.parentProductId) === id
    );
    const category = state.categories.find((item) => Number(item.id) === id);
    const order = state.orders.find((item) => Number(item.id) === id);
    const customer = state.customers.find((item) => String(item.id) === rawId);
    const coupon = state.coupons.find((item) => Number(item.id) === id);
    const influencer = state.influencers.find((item) => Number(item.id) === id);

    switch (action) {
      case 'copy-campaign-link': {
        const url = String(target?.dataset?.url || '');
        if (url) {
          copyTextToClipboard(url);
          toast('Copied', 'Campaign tracking link copied to clipboard.', 'success');
        }
        return;
      }
      case 'copy-generated-campaign-link': {
        const input = document.getElementById('campaignGeneratedUrlDisplay');
        const url = input?.value || state.latestCreatedCampaign?.fullUrl;
        if (url) {
          copyTextToClipboard(url);
          toast('Copied', 'Campaign tracking link copied to clipboard.', 'success');
        }
        return;
      }
      case 'dismiss-campaign-success': {
        state.latestCreatedCampaign = null;
        const banner = document.getElementById('campaignGeneratedSuccessBanner');
        if (banner) banner.style.display = 'none';
        return;
      }
      case 'toggle-campaign-active': {
        const campaignId = Number(target?.dataset?.id);
        const currentActive = target?.dataset?.active === 'true';
        if (!campaignId) return;
        try {
          await apiRequest(`/api/merch/admin/campaigns/${campaignId}/active`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: !currentActive }),
          });
          toast('Campaign Updated', `Campaign has been ${!currentActive ? 'activated' : 'deactivated'}.`, 'success');
          await loadCampaignData();
          renderInfluencers();
        } catch (err) {
          toast('Update Failed', err.message || 'Failed to toggle campaign status', 'danger');
        }
        return;
      }
      case 'shiprocket-fulfill':
        if (order) await openShiprocketFulfillModal(order);
        return;
      case 'confirm-shiprocket-awb':
        await confirmShiprocketAwb(id || target?.dataset?.id);
        return;
      case 'shiprocket-track-live':
        if (order) await openShiprocketTrackModal(order);
        return;
      case 'shiprocket-schedule-pickup':
        if (order) await handleShiprocketSchedulePickup(order);
        return;
      case 'shiprocket-get-label':
        if (order) await handleShiprocketGetLabel(order);
        return;
      case 'toggle-notifications':
        state.notificationsExpanded = !state.notificationsExpanded;
        renderDashboard();
        return;
      case 'set-activity-filter':
        state.activityFilter = target?.dataset?.filter || 'all';
        renderDashboard();
        return;
      case 'view-order-activity': {
        const orderId = target?.dataset?.orderId || target?.dataset?.id;
        const orderNumber = target?.dataset?.orderNumber;
        let foundOrder = null;
        if (orderId) {
          foundOrder = (state.orders || []).find((o) => String(o.id) === String(orderId));
        }
        if (!foundOrder && orderNumber) {
          foundOrder = (state.orders || []).find((o) => String(o.orderNumber) === String(orderNumber));
        }
        state.ordersStatus = 'all';
        state.ordersTodayOnly = false;
        state.ordersAppliedDateFrom = '';
        state.ordersAppliedDateTo = '';
        state.ordersDateFrom = '';
        state.ordersDateTo = '';
        if (foundOrder) {
          state.selectedOrderId = foundOrder.id;
          state.ordersSearch = foundOrder.orderNumber;
          state.ordersPage = 1;
        } else if (orderNumber) {
          state.ordersSearch = orderNumber;
          state.ordersPage = 1;
        }
        handleNav('orders');
        return;
      }
      case 'view-customer-activity': {
        const customerId = target?.dataset?.customerId || target?.dataset?.id;
        const customerName = target?.dataset?.customerName;
        let foundCustomer = null;
        if (customerId) {
          foundCustomer = (state.customers || []).find((c) => String(c.id) === String(customerId));
        }
        if (!foundCustomer && customerName) {
          foundCustomer = (state.customers || []).find((c) => c.name && c.name.toLowerCase() === customerName.toLowerCase());
        }
        state.customersTodayOnly = false;
        state.customersAppliedDateFrom = '';
        state.customersAppliedDateTo = '';
        state.customersDateFrom = '';
        state.customersDateTo = '';
        if (foundCustomer) {
          state.selectedCustomerId = foundCustomer.id;
          state.customersSearch = foundCustomer.name || '';
        } else if (customerId) {
          state.selectedCustomerId = customerId;
        } else if (customerName) {
          state.customersSearch = customerName;
        }
        handleNav('customers');
        return;
      }
      case 'view-product-activity': {
        const productId = target?.dataset?.productId || target?.dataset?.id;
        const productName = target?.dataset?.productName;
        let foundProduct = null;
        if (productId) {
          foundProduct = (state.products || []).find((p) => String(p.id) === String(productId) || String(p.variantId) === String(productId) || String(p.productId) === String(productId));
        }
        if (!foundProduct && productName) {
          foundProduct = (state.products || []).find((p) => p.name && p.name.toLowerCase().includes(productName.toLowerCase()));
        }
        state.productsCategory = 'all';
        state.productsStatus = 'all';
        state.productsPage = 1;
        if (foundProduct) {
          state.selectedProductIds = [foundProduct.id];
          state.productsSearch = foundProduct.name;
        } else if (productName) {
          state.productsSearch = productName;
        }
        handleNav('products');
        return;
      }
      case 'dismiss-notification': {
        const notificationId = String(target?.dataset?.notificationId || '');
        const notification = state.notifications.find((item) => String(item.id) === notificationId);
        if (!notification) return;
        notification.read = true;
        notification.dismissedAt = new Date().toISOString();
        rememberNotificationState(notification);
        renderDashboard();
        return;
      }
      case 'apply-order-status-range': {
        const from = String(state.orderStatusFrom || '').trim();
        const to = String(state.orderStatusTo || '').trim();
        if (!from || !to || from > to) {
          toast('Invalid date range', 'Choose a valid From and To date before applying the filter.', 'warning');
          return;
        }
        state.orderStatusAppliedFrom = from;
        state.orderStatusAppliedTo = to;
        renderDashboard();
        return;
      }
      case 'clear-order-status-range':
        state.orderStatusPeriod = 'today';
        state.orderStatusFrom = '';
        state.orderStatusTo = '';
        state.orderStatusAppliedFrom = '';
        state.orderStatusAppliedTo = '';
        renderDashboard();
        return;
      case 'apply-revenue-range': {
        const from = String(state.revenueFrom || '').trim();
        const to = String(state.revenueTo || '').trim();
        if (!from || !to || from > to) {
          toast('Invalid date range', 'Choose a valid From and To date before applying the filter.', 'warning');
          return;
        }
        state.revenueAppliedFrom = from;
        state.revenueAppliedTo = to;
        renderDashboard();
        return;
      }
      case 'clear-revenue-range':
        state.revenueFrom = daysAgo(29);
        state.revenueTo = toISODate(today);
        state.revenueAppliedFrom = '';
        state.revenueAppliedTo = '';
        state.revenuePeriod = `month-${pad(today.getMonth() + 1)}`;
        renderDashboard();
        return;
      case 'open-profile':
        toggleProfileDropdown();
        return;
      case 'open-hype-modal':
        renderHypeModal();
        return;
      case 'save-hype-config': {
        const form = document.getElementById('hypeConfigForm');
        if (!form) return;
        const hypes = [...form.querySelectorAll('input[name="hypedProductId"]:checked')].map((checkbox) => {
          const productId = Number(checkbox.value);
          const label = String(form.elements[`hypeLabel-${productId}`]?.value || '').trim();
          return {
            productId,
            label,
            customLabel: String(form.elements[`hypeCustomLabel-${productId}`]?.value || '').trim(),
          };
        });
        const invalidCustom = hypes.some((item) => item.label === 'Custom Label' && !item.customLabel);
        if (invalidCustom) {
          toast('Custom label required', 'Add short text for every product using Custom Label.', 'warning');
          return;
        }
        try {
          const result = await apiRequest('/api/merch/admin/hype', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ hypes }),
          });
          state.hypes = Array.isArray(result.hypes) ? result.hypes : [];
          closeModal();
          renderDashboard();
          toast('HYPE saved', `${hypes.length} product${hypes.length === 1 ? '' : 's'} will appear in Top Trending Products.`, 'success');
        } catch (error) {
          toast('HYPE not saved', error.message || 'Unable to save the trending product configuration.', 'danger');
        }
        return;
      }
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
        closeProfileDropdown();
        renderChangePasswordModal();
        return;
      case 'open-product-modal':
        renderEntityFormModal('product');
        return;
      case 'edit-product':
        product?.isCombo ? renderComboFormModal([], product) : renderEntityFormModal('product', product);
        return;
      case 'bulk-edit':
        renderBulkProductEditModal();
        return;
      case 'save-bulk-product-edit': {
        const form = els.adminModalDialog.querySelector('[data-bulk-edit-form]');
        const selectedIds = [...(form?.querySelectorAll('input[name="productId"]:checked') || [])].map((input) => Number(input.value));
        const selected = state.products.filter((item) => selectedIds.includes(Number(item.id)));
        if (!selected.length) {
          toast('Select products', 'Choose at least one product to update.', 'warning');
          return;
        }
        const updates = selected.map((item) => ({
          id: Number(item.parentProductId || item.productId || item.id),
          variantId: Number(item.variantId || item.id),
          name: String(form.elements[`name-${item.id}`]?.value || '').trim(),
          sku: String(form.elements[`sku-${item.id}`]?.value || '').trim(),
          price: Math.max(0, Number(form.elements[`price-${item.id}`]?.value || 0)),
          stock: Math.max(0, Math.floor(Number(form.elements[`stock-${item.id}`]?.value || 0))),
        }));
        if (updates.some((item) => !item.name || !item.sku || !Number.isFinite(item.price))) {
          toast('Missing details', 'Each selected product needs a name, SKU, and valid price.', 'warning');
          return;
        }
        try {
          await Promise.all(updates.map((item) => apiRequest(`/api/merch/admin/products/${encodeURIComponent(item.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item),
          })));
          closeModal();
          state.selectedProductIds = [];
          await loadProductData();
          toast('Products updated', `${updates.length} selected product${updates.length === 1 ? '' : 's'} were saved.`, 'success');
          renderAll();
        } catch (error) {
          toast('Update failed', error.message || 'Unable to update the selected products.', 'danger');
        }
        return;
      }
      case 'duplicate-product':
        if (product) {
          const duplicate = createLocalProductDuplicate(product);
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
          if (product.isLocalDuplicate) {
            state.products = state.products.filter((item) => Number(item.id) !== Number(product.id));
            state.selectedProductIds = state.selectedProductIds.filter((itemId) => Number(itemId) !== Number(product.id));
            toast('Duplicate removed', `${product.name} was removed.`, 'success');
            renderProducts();
            return;
          }
          const productId = Number(product.parentProductId || product.productId || product.id);
          const variantId = Number(product.variantId || product.id);
          const deleteProduct = Boolean(product.isCombo) || !product.hasMultipleVariants || Number(product.variantCount || 0) <= 1;
          openConfirmModal({
            title: deleteProduct ? 'Delete product' : 'Delete variant',
            message: deleteProduct
              ? `Remove ${product.name} from the customer storefront? Existing order history will be preserved.`
              : `Remove only the ${product.variantLabel || [product.size, product.color].filter(Boolean).join(' / ') || 'selected'} variant of ${product.name}? Other variants will remain active.`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
              try {
                const result = deleteProduct ? await deleteMerchProduct(productId) : await deleteMerchVariant(variantId);
                state.selectedProductIds = state.selectedProductIds.filter((itemId) => itemId !== id);
                await loadProductData();
                await loadTrashData();
        toast(result.trashed ? (deleteProduct ? 'Product moved to Bin' : 'Variant moved to Bin') : 'Product deleted', `${product.name} remains recoverable in Bin.`, 'warning');
                renderAll();
              } catch (error) {
                toast('Delete failed', error.message || 'Unable to remove the product.', 'warning');
              }
            },
          });
        }
        return;
      case 'bulk-duplicate':
        selectedProductsOnPage().forEach((item) => {
          state.products.unshift(createLocalProductDuplicate(item));
        });
        state.selectedProductIds = [];
        toast('Bulk duplicate complete', 'Selected products were copied.', 'success');
        renderAll();
        return;
      case 'bulk-archive':
        try {
          const selected = selectedProductsOnPage();
          const restore = selected.length > 0 && selected.every((item) => item.archived);
          const ids = [...new Set(selected.map((item) => Number(item.parentProductId || item.productId || item.id)).filter((itemId) => Number.isInteger(itemId) && itemId > 0))];
          await Promise.all(ids.map((productId) => apiRequest(`/api/merch/admin/products/${encodeURIComponent(productId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: restore ? 'published' : 'archived' }),
          })));
          state.selectedProductIds = [];
          await loadProductData();
          toast(restore ? 'Products restored' : 'Products archived', `${ids.length} selected product${ids.length === 1 ? '' : 's'} were ${restore ? 'restored' : 'archived'}.`, restore ? 'success' : 'warning');
          renderAll();
        } catch (error) {
          toast('Archive failed', error.message || 'Unable to archive the selected products.', 'warning');
        }
        return;
      case 'bulk-combo-on':
        {
        const selected = selectedProductsOnPage();
        const distinctProducts = new Set(selected.map((item) => Number(item.parentProductId || item.productId || item.id)));
        if (selected.length < 2 || distinctProducts.size < 2) {
          toast('Select products', 'Select at least two product variants to create a combo.', 'warning');
          return;
        }
        if (selected.some((item) => item.isCombo || item.archived || item.status !== 'published')) {
          toast('Invalid combo selection', 'Select at least two active, published normal product variants.', 'warning');
          return;
        }
        renderComboFormModal(selected);
        return;
        }
      case 'bulk-combo-off': {
        const selected = selectedProductsOnPage();
        const comboIds = [...new Set(selected
          .filter((item) => item.isCombo)
          .map((item) => Number(item.parentProductId || item.productId || item.id))
          .filter((productId) => Number.isInteger(productId) && productId > 0))];
        const variantIds = [...new Set(selected
          .filter((item) => !item.isCombo)
          .map((item) => Number(item.variantId || item.id))
          .filter((variantId) => Number.isInteger(variantId) && variantId > 0))];
        if (!comboIds.length && !variantIds.length) {
          toast('Select products', 'Select a combo product or a normal product variant to remove.', 'warning');
          return;
        }
        try {
          await Promise.all(comboIds.map((productId) => apiRequest(`/api/merch/admin/products/${encodeURIComponent(productId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'archived' }),
          })));
          const result = variantIds.length
            ? await apiRequest('/api/merch/admin/combos/remove-components', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ variantIds }),
            })
            : { removed: 0 };
          state.selectedProductIds = [];
          await loadProductData();
          const removedCount = Number(result.removed || 0);
          const message = [
            comboIds.length ? `${comboIds.length} combo${comboIds.length === 1 ? '' : 's'} unpublished` : '',
            variantIds.length ? `${removedCount} component${removedCount === 1 ? '' : 's'} removed` : '',
          ].filter(Boolean).join('; ');
          toast('Removed from combo', message + '.', 'success');
          renderAll();
        } catch (error) {
          toast('Combo update failed', error.message || 'Unable to update combo availability.', 'warning');
        }
        return;
      }
      case 'bulk-delete':
        {
        const selectedAtConfirmation = selectedProductsOnPage();
        const nonDuplicateItems = selectedAtConfirmation.filter((item) => !item.isLocalDuplicate);
        const selectedParentIdsAtConfirmation = [...new Set(nonDuplicateItems
          .filter((item) => item.isCombo || !item.hasMultipleVariants || Number(item.variantCount || 0) <= 1)
          .map((item) => Number(item.parentProductId || item.productId || item.id))
          .filter((itemId) => Number.isInteger(itemId) && itemId > 0))];
        const selectedVariantIdsAtConfirmation = [...new Set(nonDuplicateItems
          .filter((item) => !selectedParentIdsAtConfirmation.includes(Number(item.parentProductId || item.productId || item.id)))
          .map((item) => Number(item.variantId || item.id))
          .filter((itemId) => Number.isInteger(itemId) && itemId > 0))];
        openConfirmModal({
          title: 'Delete selected products',
          message: `Move ${selectedParentIdsAtConfirmation.length + selectedVariantIdsAtConfirmation.length} selected item${selectedParentIdsAtConfirmation.length + selectedVariantIdsAtConfirmation.length === 1 ? '' : 's'} to Bin? Only the selected variant rows will be affected; other variants remain active.`,
          confirmLabel: 'Delete',
          onConfirm: async () => {
            const selected = selectedAtConfirmation;
            const localDuplicateIds = new Set(selected.filter((item) => item.isLocalDuplicate).map((item) => Number(item.id)));
            const ids = selectedParentIdsAtConfirmation;
            try {
              const results = [];
              if (ids.length) results.push(await apiRequest('/api/merch/admin/products/trash', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ productIds: ids }),
                }));
              if (selectedVariantIdsAtConfirmation.length) results.push(await apiRequest('/api/merch/admin/variants/trash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: selectedVariantIdsAtConfirmation }),
              }));
              if (localDuplicateIds.size) {
                state.products = state.products.filter((item) => !localDuplicateIds.has(Number(item.id)));
              }
              state.selectedProductIds = [];
              if (ids.length || selectedVariantIdsAtConfirmation.length) {
                await loadProductData();
                await loadTrashData();
              }
              const trashedCount = results.reduce((count, result) => count + Number(result?.trashedCount || 0), 0);
              const removedCount = localDuplicateIds.size;
              const summary = [
                trashedCount ? `${trashedCount} moved to Bin` : '',
                removedCount ? `${removedCount} duplicate${removedCount === 1 ? '' : 's'} removed` : '',
              ].filter(Boolean).join('; ');
              toast('Products moved to Bin', `${summary || 'Selected products moved to Bin'}.`, 'warning');
              renderAll();
            } catch (error) {
              toast('Bulk delete failed', error.message || 'Unable to remove the selected products.', 'warning');
            }
          },
        });
        return;
        }
      case 'restore-trash-product':
        await restoreTrashProducts([id]);
        return;
      case 'restore-trash-variant':
        await restoreTrashVariants([id]);
        return;
      case 'bulk-restore-trash':
        if (state.selectedTrashProductIds.length) await restoreTrashProducts(state.selectedTrashProductIds);
        if (state.selectedTrashVariantIds.length) await restoreTrashVariants(state.selectedTrashVariantIds);
        return;
      case 'permanent-delete-trash-product':
        openPermanentDeleteModal([id]);
        return;
      case 'permanent-delete-trash-variant':
        openPermanentDeleteModal([], [id]);
        return;
      case 'bulk-permanent-delete-trash':
        openPermanentDeleteModal(state.selectedTrashProductIds, state.selectedTrashVariantIds);
        return;
      case 'toggle-trash-selection':
        if (target.dataset.trashType === 'variant') {
          if (target.checked) {
            if (!state.selectedTrashVariantIds.includes(id)) state.selectedTrashVariantIds.push(id);
          } else {
            state.selectedTrashVariantIds = state.selectedTrashVariantIds.filter((itemId) => itemId !== id);
          }
        } else {
          if (target.checked) {
            if (!state.selectedTrashProductIds.includes(id)) state.selectedTrashProductIds.push(id);
          } else {
            state.selectedTrashProductIds = state.selectedTrashProductIds.filter((itemId) => itemId !== id);
          }
        }
        renderTrash();
        return;
      case 'toggle-trash-page-selection': {
        const visible = state.trashProducts.flatMap((product) => [
          ...(product.isDeleted ? [{ trashType: 'product', trashId: Number(product.id) }] : []),
          ...(product.isDeleted ? [] : (product.variants || []).filter((variant) => variant.deletedAt).map((variant) => ({ trashType: 'variant', trashId: Number(variant.id) }))),
        ]).slice((state.trashProductsPage - 1) * 5, (state.trashProductsPage - 1) * 5 + 5);
        const isSelected = (item) => item.trashType === 'variant'
          ? state.selectedTrashVariantIds.includes(item.trashId)
          : state.selectedTrashProductIds.includes(item.trashId);
        const allSelected = visible.length > 0 && visible.every(isSelected);
        if (allSelected) {
          const productIds = new Set(visible.filter((item) => item.trashType === 'product').map((item) => item.trashId));
          const variantIds = new Set(visible.filter((item) => item.trashType === 'variant').map((item) => item.trashId));
          state.selectedTrashProductIds = state.selectedTrashProductIds.filter((id) => !productIds.has(id));
          state.selectedTrashVariantIds = state.selectedTrashVariantIds.filter((id) => !variantIds.has(id));
        } else {
          visible.forEach((item) => {
            const selectedIds = item.trashType === 'variant' ? state.selectedTrashVariantIds : state.selectedTrashProductIds;
            if (!selectedIds.includes(item.trashId)) selectedIds.push(item.trashId);
          });
        }
        renderTrash();
        return;
      }
      case 'trash-prev':
        state.trashProductsPage = Math.max(1, state.trashProductsPage - 1);
        renderTrash();
        return;
      case 'trash-next':
        state.trashProductsPage += 1;
        renderTrash();
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
          state.selectedOrderId = Number(state.selectedOrderId) === Number(order.id) ? null : order.id;
          renderOrders();
        }
        return;
      case 'toggle-order-selection':
        if (target.checked) {
          if (!state.selectedOrderIds.includes(id)) state.selectedOrderIds.push(id);
          state.selectedOrderId = id;
        } else {
          state.selectedOrderIds = state.selectedOrderIds.filter((orderId) => orderId !== id);
          if (Number(state.selectedOrderId) === id) {
            state.selectedOrderId = state.selectedOrderIds.length === 1 ? state.selectedOrderIds[0] : null;
          }
        }
        renderOrders();
        return;
      case 'toggle-orders-page-selection': {
        const visible = filteredOrders().slice((state.ordersPage - 1) * 5, (state.ordersPage - 1) * 5 + 5);
        const allSelected = visible.length && visible.every((item) => state.selectedOrderIds.includes(Number(item.id)));
        if (allSelected) state.selectedOrderIds = state.selectedOrderIds.filter((orderId) => !visible.some((item) => Number(item.id) === orderId));
        else visible.forEach((item) => { if (!state.selectedOrderIds.includes(Number(item.id))) state.selectedOrderIds.push(Number(item.id)); });
        renderOrders();
        return;
      }
      case 'edit-selected-orders':
        renderOrderEditModal(state.orders.filter((item) => state.selectedOrderIds.includes(Number(item.id))));
        return;
      case 'track-admin-order':
        if (order) window.open(`/merch/index.html?adminTracking=1#track-order/${encodeURIComponent(order.id)}`, '_blank', 'noopener,noreferrer');
        return;
      case 'save-order-edits': {
        const form = els.adminModalDialog.querySelector('[data-order-edit-form]');
        const nextStatus = normalizeOrderStatus(form?.elements?.status?.value);
        const selectedOrders = state.orders.filter((item) => state.selectedOrderIds.includes(Number(item.id)));
        try {
          for (const selectedOrder of selectedOrders) {
            const payload = { status: nextStatus };
            if (nextStatus === 'shipped' && !selectedOrder.trackingNumber) {
              payload.tracking_number = `TRK-${Math.floor(10000 + Math.random() * 90000)}-HM`;
              payload.carrier_name = selectedOrder.carrier || 'Shiprocket';
            }
            await updateOrderOnServer(selectedOrder, payload);
          }
          closeModal();
          toast('Orders updated', `${selectedOrders.length} selected order${selectedOrders.length === 1 ? '' : 's'} updated.`, 'success');
        } catch (error) {
          toast('Order update failed', error.message || 'Unable to update the selected orders.', 'warning');
        }
        return;
      }
      case 'bulk-order-invoice':
      case 'bulk-order-email':
      case 'bulk-order-download':
      case 'bulk-order-cancel':
      case 'bulk-order-refund': {
        const selectedOrders = state.orders.filter((item) => state.selectedOrderIds.includes(Number(item.id)));
        if (action === 'bulk-order-refund') {
          openConfirmModal({
            title: 'Approve refunds',
            message: `Approve and record refunds for ${selectedOrders.length} selected order${selectedOrders.length === 1 ? '' : 's'}?`,
            confirmLabel: 'Approve refunds',
            onConfirm: async () => {
              try {
                for (const selectedOrder of selectedOrders) await refundOrderOnServer(selectedOrder);
                await loadOrderData();
                toast('Refunds approved', `${selectedOrders.length} refund${selectedOrders.length === 1 ? '' : 's'} recorded.`, 'success');
              } catch (error) {
                toast('Refund failed', error.message || 'Unable to record the selected refunds.', 'warning');
              }
            },
          });
          return;
        }
        for (const selectedOrder of selectedOrders) {
          if (action === 'bulk-order-invoice') await openOrderInvoice(selectedOrder.id);
          if (action === 'bulk-order-email') await emailOrderInvoice(selectedOrder.id);
          if (action === 'bulk-order-download') await downloadOrderInvoice(selectedOrder.id);
          if (action === 'bulk-order-cancel') await updateOrderOnServer(selectedOrder, { status: 'cancelled', payment_status: 'refunded' });
        }
        if (['bulk-order-cancel', 'bulk-order-refund'].includes(action)) await loadOrderData();
        return;
      }
      case 'toggle-customers-today':
        state.customersTodayOnly = !state.customersTodayOnly;
        if (state.customersTodayOnly) {
          state.customersDateFrom = '';
          state.customersDateTo = '';
          state.customersAppliedDateFrom = '';
          state.customersAppliedDateTo = '';
          state.customersDateValidation = '';
        }
        renderCustomers();
        return;
      case 'apply-customers-date-range': {
        const from = String(state.customersDateFrom || '').trim();
        const to = String(state.customersDateTo || '').trim();
        const validationMessage = getCustomersDateValidation(from, to);
        if (validationMessage) {
          const customerDateMax = getLocalDateInputMax();
          if (from > customerDateMax) state.customersDateFrom = '';
          if (to > customerDateMax) state.customersDateTo = '';
          state.customersDateValidation = validationMessage;
          renderCustomers();
          return;
        }
        if (!from || !to) {
          toast('Date range incomplete', 'Choose both a From and To date before applying the customer filter.', 'warning');
          return;
        }
        state.customersDateValidation = '';
        state.customersTodayOnly = false;
        state.customersAppliedDateFrom = from;
        state.customersAppliedDateTo = to;
        renderCustomers();
        return;
      }
      case 'clear-customers-date-range':
        state.customersTodayOnly = false;
        state.customersDateFrom = '';
        state.customersDateTo = '';
        state.customersAppliedDateFrom = '';
        state.customersAppliedDateTo = '';
        state.customersDateValidation = '';
        renderCustomers();
        return;
      case 'toggle-orders-today':
        state.ordersTodayOnly = !state.ordersTodayOnly;
        if (state.ordersTodayOnly) {
          state.ordersDateFrom = '';
          state.ordersDateTo = '';
          state.ordersAppliedDateFrom = '';
          state.ordersAppliedDateTo = '';
        }
        state.ordersPage = 1;
        renderOrders();
        return;
      case 'apply-orders-date-range': {
        const from = String(state.ordersDateFrom || '').trim();
        const to = String(state.ordersDateTo || '').trim();
        if (!from || !to) {
          toast('Date range incomplete', 'Choose both a From and To date before applying the filter.', 'warning');
          return;
        }
        if (from && to && from > to) {
          toast('Invalid date range', 'The From date must be on or before the To date.', 'warning');
          return;
        }
        state.ordersTodayOnly = false;
        state.ordersAppliedDateFrom = from;
        state.ordersAppliedDateTo = to;
        state.ordersPage = 1;
        renderOrders();
        return;
      }
      case 'clear-orders-date-range':
        state.ordersDateFrom = '';
        state.ordersDateTo = '';
        state.ordersAppliedDateFrom = '';
        state.ordersAppliedDateTo = '';
        state.ordersPage = 1;
        renderOrders();
        return;
      case 'update-order-status':
        if (order && target instanceof HTMLSelectElement) {
          const nextStatus = normalizeOrderStatus(target.value);
          const payload = { status: nextStatus };
          if (nextStatus === 'shipped' && !order.trackingNumber) {
            payload.tracking_number = `TRK-${Math.floor(10000 + Math.random() * 90000)}-HM`;
            payload.carrier_name = order.carrier || 'Shiprocket';
          }
          try {
            await updateOrderOnServer(order, payload);
            toast('Order updated', `${order.orderNumber} moved to ${getStatusLabel(nextStatus)}.`, 'success');
          } catch (error) {
            toast('Order update failed', error.message || 'Unable to update the order status.', 'warning');
            renderOrders();
          }
        }
        return;
      case 'open-order-invoice':
        if (order) {
          await openOrderInvoice(order.id);
        }
        return;
      case 'download-order-invoice':
        if (order) {
          await downloadOrderInvoice(order.id);
        }
        return;
      case 'email-order-invoice':
        if (order) {
          await emailOrderInvoice(order.id);
        }
        return;
      case 'advance-order':
      case 'ship-order':
      case 'deliver-order':
        if (order) {
          const flow = ['pending', 'processing', 'shipped', 'delivered'];
          const currentIndex = flow.indexOf(String(order.status || 'pending'));
          let nextStatus = order.status;
          if (action === 'advance-order') {
            nextStatus = flow[Math.min(flow.length - 1, Math.max(0, currentIndex + 1))];
          }
          if (action === 'ship-order') nextStatus = 'shipped';
          if (action === 'deliver-order') nextStatus = 'delivered';

          const payload = { status: nextStatus };
          if (nextStatus === 'shipped' && !order.trackingNumber) {
            payload.tracking_number = `TRK-${Math.floor(10000 + Math.random() * 90000)}-HM`;
            payload.carrier_name = order.carrier || 'Shiprocket';
          }

          try {
            await updateOrderOnServer(order, payload);
            toast('Order updated', `${order.orderNumber} moved to ${getStatusLabel(nextStatus)}.`, 'success');
          } catch (error) {
            toast('Order update failed', error.message || 'Unable to update the order status.', 'warning');
          }
        }
        return;
      case 'cancel-order':
        if (order) {
          try {
            await updateOrderOnServer(order, { status: 'cancelled', payment_status: 'refunded' });
            toast('Order cancelled', `${order.orderNumber} has been marked cancelled.`, 'warning');
          } catch (error) {
            toast('Order update failed', error.message || 'Unable to cancel the order.', 'warning');
          }
        }
        return;
      case 'refund-order':
        if (order) {
          openConfirmModal({
            title: 'Approve refund',
            message: `Approve and record a refund for ${order.orderNumber}? This changes the payment status and cannot be undone here.`,
            confirmLabel: 'Approve refund',
            onConfirm: async () => {
              try {
                await refundOrderOnServer(order);
                toast('Refund approved', `${order.orderNumber} has been flagged for refund.`, 'success');
              } catch (error) {
                toast('Refund failed', error.message || 'Unable to record the refund.', 'warning');
              }
            },
          });
        }
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
          state.selectedCustomerId = String(state.selectedCustomerId) === String(customer.id) ? null : customer.id;
          renderCustomers();
        }
        return;
      case 'message-customer':
        if (customer) toast('Placeholder', `A message draft can be opened for ${customer.name}.`, 'default');
        return;
      case 'export-customer':
        if (customer) toast('Export ready', `${customer.name}'s profile export is prepared as mock data.`, 'success');
        return;
      case 'export-coupons':
        exportCouponsCsv();
        return;
      case 'select-coupon':
        if (coupon) {
          state.selectedCouponId = Number(state.selectedCouponId) === Number(coupon.id) ? null : coupon.id;
          renderCoupons();
        }
        return;
      case 'close-coupon-details':
        state.selectedCouponId = null;
        renderCoupons();
        return;
      case 'open-coupon-modal':
        renderEntityFormModal('coupon');
        return;
      case 'edit-coupon':
        renderEntityFormModal('coupon', coupon);
        return;
      case 'assign-coupon-owner':
        if (coupon && getCouponTypeValue(coupon) === 'influencer') {
          renderEntityFormModal('coupon', coupon);
          window.setTimeout(() => els.adminModalDialog.querySelector('[name="influencerId"]')?.focus(), 0);
        }
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
          closeModal();
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
          const couponToDelete = { ...coupon }; // snapshot before modal replaces state
          openConfirmModal({
            title: 'Delete coupon',
            message: `Delete coupon ${couponToDelete.code}?`,
            confirmLabel: 'Delete',
            onConfirm: async () => {
              try {
                await apiRequest(`/api/admin/coupons/${encodeURIComponent(couponToDelete.id)}`, { method: 'DELETE' });
                toast('Coupon deleted', `${couponToDelete.code} removed from the list.`, 'danger');
                state.selectedCouponId = null;
                await loadCouponData();
              } catch (err) {
                toast('Delete failed', err?.message || 'Could not delete coupon. Please try again.', 'error');
              }
            },
          });
        }
        return;
      case 'select-influencer':
        if (influencer) {
          state.selectedInfluencerId = influencer.id;
          renderInfluencers();
          window.setTimeout(() => {
            const section = document.getElementById('influencer-profile-panel');
            if (!section) return;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (typeof section.focus === 'function') {
              section.focus({ preventScroll: true });
            }
          }, 0);
        }
        return;
      case 'toggle-influencer-selection':
        if (target.checked) {
          if (!state.selectedInfluencerIds.includes(id)) state.selectedInfluencerIds.push(id);
        } else {
          state.selectedInfluencerIds = state.selectedInfluencerIds.filter((influencerId) => influencerId !== id);
        }
        renderInfluencers();
        return;
      case 'toggle-influencers-page-selection': {
        const visible = state.influencers.filter((item) => {
          const query = state.influencersSearch.trim().toLowerCase();
          return !query || [item.name, item.handle, item.email, item.phone].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
        });
        const allSelected = visible.length && visible.every((item) => state.selectedInfluencerIds.includes(Number(item.id)));
        if (allSelected) state.selectedInfluencerIds = state.selectedInfluencerIds.filter((influencerId) => !visible.some((item) => Number(item.id) === influencerId));
        else visible.forEach((item) => { if (!state.selectedInfluencerIds.includes(Number(item.id))) state.selectedInfluencerIds.push(Number(item.id)); });
        renderInfluencers();
        return;
      }
      case 'edit-selected-influencers':
        renderInfluencerEditModal(state.influencers.filter((item) => state.selectedInfluencerIds.includes(Number(item.id))));
        return;
      case 'bulk-influencer-edit': {
        const selectedInfluencer = state.influencers.find((item) => state.selectedInfluencerIds.includes(Number(item.id)));
        if (selectedInfluencer) renderEntityFormModal('influencer', selectedInfluencer);
        return;
      }
      case 'bulk-influencer-view-report':
      case 'bulk-influencer-download-report':
      case 'bulk-influencer-email-report': {
        const month = String(els.adminModalDialog.querySelector('[data-influencer-report-month]')?.value || '');
        const selectedInfluencers = state.influencers.filter((item) => state.selectedInfluencerIds.includes(Number(item.id)));
        closeModal();
        for (const selectedInfluencer of selectedInfluencers) {
          if (action === 'bulk-influencer-view-report') await viewInfluencerReport(selectedInfluencer, month);
          if (action === 'bulk-influencer-download-report') await downloadInfluencerReport(selectedInfluencer, month);
          if (action === 'bulk-influencer-email-report') await emailInfluencerReport(selectedInfluencer, month);
        }
        return;
      }
      case 'pay-influencer-commission': {
        const targetInfluencer = influencer || state.influencers.find((item) => Number(item.id) === Number(target?.dataset?.id));
        if (targetInfluencer) {
          renderCommissionCorrectionModal(targetInfluencer);
        }
        return;
      }
      case 'submit-commission-payment':
        await handlePayCommissionSubmit(id || Number(target?.dataset?.id));
        return;
      case 'correct-influencer-commission': {
        const targetInfluencer = influencer || state.influencers.find((item) => Number(item.id) === Number(target?.dataset?.id));
        if (targetInfluencer) {
          renderCommissionCorrectionModal(targetInfluencer);
        }
        return;
      }
      case 'submit-commission-correction':
        await handleCommissionCorrectionSubmit(id || Number(target?.dataset?.id));
        return;
      case 'create-security': {
        const infId = target?.dataset?.influencerId || id;
        const targetInfluencer = state.influencers.find((item) => Number(item.id) === Number(infId));
        renderCreateSecurityModal(targetInfluencer);
        return;
      }
      case 'cancel-create-security': {
        const infId = target?.dataset?.influencerId || id;
        const targetInfluencer = state.influencers.find((item) => Number(item.id) === Number(infId));
        if (targetInfluencer) {
          await renderCommissionCorrectionModal(targetInfluencer);
        } else {
          closeModal();
        }
        return;
      }
      case 'submit-create-security': {
        const infId = target?.dataset?.influencerId || id;
        await handleCreateSecuritySubmit(infId);
        return;
      }
      case 'view-commission-history': {
        const targetInfluencer = influencer || state.influencers.find((item) => Number(item.id) === Number(target?.dataset?.id));
        if (targetInfluencer) {
          await renderPaymentHistoryModal(targetInfluencer);
        }
        return;
      }
      case 'view-payment-invoice': {
        const paymentId = Number(target?.dataset?.paymentId);
        const influencerId = Number(target?.dataset?.influencerId || id);
        if (influencerId && paymentId) {
          await viewPaymentInvoice(influencerId, paymentId);
        }
        return;
      }
      case 'print-invoice': {
        const printFrame = els.adminModalDialog.querySelector('.admin-invoice-preview-frame');
        if (printFrame && printFrame.contentWindow) {
          printFrame.contentWindow.focus();
          printFrame.contentWindow.print();
        } else {
          window.print();
        }
        return;
      }
      case 'open-influencer-modal':
        renderEntityFormModal('influencer');
        return;
      case 'edit-influencer':
        renderEntityFormModal('influencer', influencer);
        return;
      case 'view-influencer-report':
        await viewInfluencerReport(influencer);
        return;
      case 'toggle-influencer':
        if (influencer) {
          if (influencer.active) {
            openConfirmModal({
              title: 'Deactivate influencer',
              message: `Deactivate ${influencer.name}? They will remain in the directory but will not receive new campaign assignment work until reactivated.`,
              confirmLabel: 'Deactivate',
              tone: 'danger',
              onConfirm: async () => {
                await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/active`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ active: 0 }),
                });
                toast('Influencer deactivated', `${influencer.name} is now inactive.`, 'warning');
                closeModal();
                await loadInfluencerData();
              },
            });
          } else {
            await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/active`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: 1 }),
            });
            toast('Influencer reactivated', `${influencer.name} is now active again.`, 'success');
            closeModal();
            await loadInfluencerData();
          }
        }
        return;
      case 'assign-coupon':
        if (influencer) {
          renderInfluencerAssignmentModal(influencer);
        }
        return;
      case 'download-influencer-report':
        if (influencer) {
          await downloadInfluencerReport(influencer);
        }
        return;
      case 'email-influencer-report':
        if (influencer) {
          await emailInfluencerReport(influencer);
        }
        return;
      case 'export-report':
        downloadCurrentReport();
        return;
      case 'download-report-section':
        downloadCurrentReport(String(target.dataset.target || 'all'));
        return;
      case 'email-report':
        await emailCurrentReport();
        return;
      case 'open-report-section': {
        const targetId = String(target.dataset.target || '').trim();
        const sectionIdMap = {
          'revenue-report': 'revenue-report',
          'orders-report': 'orders-report',
          'products-report': 'products-report',
          'coupons-report': 'coupons-report',
          'influencer-report': 'influencer-report',
          'monthly-influencer-report': 'monthly-influencer-report',
        };
        const resolvedId = sectionIdMap[targetId] || targetId;
        const section = document.getElementById(resolvedId);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
          section.classList.add('admin-report-target--active');
          window.clearTimeout(section.__reportHighlightTimer);
          section.__reportHighlightTimer = window.setTimeout(() => {
            section.classList.remove('admin-report-target--active');
          }, 2200);
        }
        return;
      }
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

 function preserveInputFocus(target, renderFn) {
    const wasFocused = document.activeElement === target;

    if (!wasFocused) {
        renderFn();
        return;
    }

    const selectionStart = target.selectionStart;
    const selectionEnd = target.selectionEnd;
    const inputKey = target.dataset.input;

    renderFn();

    const nextInput = document.querySelector(
        `[data-input="${inputKey}"]`
    );

    if (nextInput) {
        nextInput.focus();

        if (selectionStart !== null && selectionEnd !== null) {
            nextInput.setSelectionRange(selectionStart, selectionEnd);
        }
    }
} 
  function handleInput(target) {
    const inputKey = target.dataset.input;
    if (!inputKey) return;
    state[inputKey] = target.type === 'checkbox' ? (target.checked ? 'line' : 'bar') : target.value;
    if (inputKey === 'productsSearch' || inputKey === 'productsCategory' || inputKey === 'productsStatus' || inputKey === 'productsSort') {
      state.productsPage = 1;
      preserveInputFocus(target, renderProducts);
      return;
    }
    if (inputKey === 'ordersSearch' || inputKey === 'ordersStatus') {
      state.ordersPage = 1;
      preserveInputFocus(target, renderOrders);
      return;
    }
    if (inputKey === 'ordersDateFrom' || inputKey === 'ordersDateTo') {
      return;
    }
    if (inputKey === 'customersSearch') {
      preserveInputFocus(target, renderCustomers);
      return;
    }
    if (inputKey === 'customersDateFrom' || inputKey === 'customersDateTo') {
      const customerDateMax = getLocalDateInputMax();
      if (state[inputKey] > customerDateMax) {
        state[inputKey] = '';
        state.customersDateValidation = 'Future dates are not allowed.';
      } else {
        state.customersDateValidation = getCustomersDateValidation(state.customersDateFrom, state.customersDateTo);
      }
      preserveInputFocus(target, renderCustomers);
      return;
    }
    if (inputKey === 'couponsSearch' || inputKey === 'couponsStatus' || inputKey === 'couponsType') {
    const isCouponSearch = inputKey === 'couponsSearch';
    const wasFocused = isCouponSearch && document.activeElement === target;
    const selectionStart = isCouponSearch ? target.selectionStart : null;
    const selectionEnd = isCouponSearch ? target.selectionEnd : null;

    renderCoupons();

    if (wasFocused) {
        const nextSearchInput = document.querySelector('[data-input="couponsSearch"]');

        if (nextSearchInput) {
            nextSearchInput.focus();

            if (selectionStart !== null && selectionEnd !== null) {
                nextSearchInput.setSelectionRange(selectionStart, selectionEnd);
            }
        }
    }

    return;
}
    if (inputKey === 'couponsDatePeriod' || inputKey === 'couponsDateFrom' || inputKey === 'couponsDateTo') {
      renderCoupons();
      return;
    }
    if (inputKey === 'influencersSearch' || inputKey === 'influencerDetailsFilter') {
     preserveInputFocus(target, renderInfluencers);
      return;
    }
    if (inputKey === 'influencersDatePeriod' || inputKey === 'influencersDateFrom' || inputKey === 'influencersDateTo') {
      renderInfluencers();
      return;
    }
    if (inputKey === 'revenuePeriod') {
      renderDashboard();
      return;
    }
    if (inputKey === 'revenueChartMode') {
      renderDashboard();
      return;
    }
    if (inputKey === 'orderStatusPeriod') {
      renderDashboard();
      return;
    }
    if (inputKey === 'orderStatusFrom' || inputKey === 'orderStatusTo') {
      return;
    }
    if (inputKey === 'reportFrom' || inputKey === 'reportTo' || inputKey === 'reportFormat') {
      renderReports();
      loadReportData();
    }
  }

  async function uploadMerchImages(form) {
    const files = [...(form.elements.imageFile?.files || [])];
    if (!files.length) return [];
    return Promise.all(files.map(async (file) => {
      const uploadData = new FormData();
      uploadData.append('image', file);
      const result = await apiRequest('/api/merch/admin/upload-image', {
        method: 'POST',
        body: uploadData,
      });
      const imageUrl = String(result.imageUrl || result.url || '').trim();
      if (!imageUrl) throw new Error(`The image upload for ${file.name} returned no image URL.`);
      return imageUrl;
    }));
  }

  async function submitEntityForm(form) {
    const type = form.dataset.entityForm;
    const id = form.dataset.entityId ? Number(form.dataset.entityId) : null;
    const existingId = Number.isFinite(id) && id ? id : null;
    const existingEntity = existingId ? state.products.find((item) => Number(item.id) === existingId) : null;

    if (type === 'combo') {
      const fd = new FormData(form);
      const componentVariantIds = fd.getAll('componentVariantId').map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
      const componentStocks = fd.getAll('componentStock').map((value) => Math.max(0, Math.floor(Number(value || 0))));
      let uploadedImage = '';
      try {
        uploadedImage = (await uploadMerchImages(form))[0] || '';
      } catch (error) {
        toast('Image upload failed', error.message || 'Unable to upload the combo image.', 'danger');
        return;
      }
      const payload = {
        name: String(fd.get('name') || '').trim(),
        price: Number(fd.get('price') || 0),
        image: uploadedImage || String(existingEntity?.image || '').trim(),
        description: String(fd.get('description') || '').trim(),
        status: String(fd.get('status') || 'published'),
        componentVariantIds,
        componentStocks: componentVariantIds.map((variantId, index) => ({ variantId, stock: componentStocks[index] ?? 0 })),
      };
      if (!payload.name || !Number.isFinite(payload.price) || payload.price <= 0 || componentVariantIds.length < 2) {
        toast('Combo details incomplete', 'Add a name, price, and at least two product variants.', 'warning');
        return;
      }
      try {
        await apiRequest(existingId ? `/api/merch/admin/combos/${encodeURIComponent(existingId)}` : '/api/merch/admin/combos', {
          method: existingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        toast(existingId ? 'Combo saved' : 'Combo created', `${payload.name} is now available in the merch store.`, 'success');
        closeModal();
        state.selectedProductIds = [];
        await loadProductData();
        renderAll();
      } catch (error) {
        toast('Combo not saved', error.message || 'Unable to save the combo.', 'danger');
      }
      return;
    }

    if (type === 'product') {
      const entity = updateProductFromForm(form, existingId ? state.products.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.sku) {
        toast('Missing details', 'Product name and SKU are required.', 'warning');
        return;
      }
      try {
        const uploadedImages = await uploadMerchImages(form);
        if (uploadedImages.length) {
          entity.images = uploadedImages;
          entity.image = uploadedImages[0];
        }
      } catch (error) {
        toast('Image upload failed', error.message || 'Unable to upload the product image.', 'danger');
        return;
      }
      if (existingId) {
        const productId = Number(entity.parentProductId || entity.productId || existingId);
        try {
          await apiRequest(`/api/merch/admin/products/${encodeURIComponent(productId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              variantId: Number(entity.variantId || existingId),
              name: entity.name,
              sku: entity.sku,
              category: state.categories.find((item) => String(item.id) === String(entity.categoryId))?.slug || String(entity.category || '').toLowerCase(),
              price: entity.price,
              stock: entity.stock,
              size: entity.size,
              color: entity.color,
              imageUrl: entity.imageUrl,
              status: entity.status,
              image: entity.image,
              images: entity.images,
              imageUrls: entity.images,
              description: entity.description,
              specifications: entity.specifications,
              comboPurchase: entity.comboPurchase,
            }),
          });
          toast('Product saved', `${entity.name} was updated in the merch store.`, 'success');
          await loadProductData();
        } catch (error) {
          toast('Product not saved', error.message || 'Unable to update the product.', 'danger');
          return;
        }
      } else {
        if (entity.newCategoryName && entity.newCategorySlug) {
          const existingCategory = state.categories.find((category) => category.slug === entity.newCategorySlug);
          if (!existingCategory) {
            state.categories.push({ id: `custom-${entity.newCategorySlug}`, name: entity.newCategoryName, slug: entity.newCategorySlug, active: true, productCount: 0, description: `Products in the ${entity.newCategoryName} category.` });
          }
        }
        const selectedCategory = entity.newCategorySlug
          ? { slug: entity.newCategorySlug }
          : state.categories.find((category) => String(category.id) === String(entity.categoryId));
        try {
          await apiRequest('/api/merch/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: entity.name,
            sku: entity.sku,
            category: selectedCategory?.slug || 'uncategorized',
            price: entity.price,
            stock: entity.stock,
            status: entity.status,
            image: entity.image,
            images: entity.images,
            imageUrls: entity.images,
            description: entity.description,
            specifications: entity.specifications,
            size: entity.size,
            color: entity.color,
            comboPurchase: entity.comboPurchase,
          }),
          });
        } catch (error) {
          toast('Product not saved', error.message || 'Unable to save the product. Please try again.', 'danger');
          return;
        }
        toast('Product added', `${entity.name} is now available in the merch store.`, 'success');
        await loadProductData();
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
      if (!entity.code || !entity.discountValue) {
        toast('Missing details', 'Coupon code and discount are required.', 'warning');
        return;
      }
      if (entity.discountType === 'percentage' && (entity.discountValue < 1 || entity.discountValue > 100)) {
        toast('Invalid discount', 'Percentage discount must be between 1% and 100%.', 'warning');
        return;
      }
      if (entity.couponCategory === 'influencer' && entity.commissionType === 'percentage' && (entity.commissionRate < 0 || entity.commissionRate > 100)) {
        toast('Invalid commission', 'Commission percentage must be between 0% and 100%.', 'warning');
        return;
      }
      if (entity.couponCategory === 'influencer' && !entity.influencerId) {
        toast('Missing influencer', 'Choose an assigned influencer for this coupon.', 'warning');
        return;
      }
      if (entity.couponCategory === 'private' && (!entity.recipientEmail || !isLikelyEmail(entity.recipientEmail))) {
        toast('Missing owner email', 'Enter a valid owner email for this private coupon.', 'warning');
        return;
      }
      const payload = {
        code: entity.code,
        description: entity.description,
        discountType: entity.discountType,
        discountValue: Number(entity.discountValue) || 0,
        commissionType: entity.commissionType,
        commissionRate: Number(entity.commissionRate) || 0,
        commissionPerOrderPaise: Math.max(0, Math.round(Number(entity.commissionPerOrderPaise || 0))),
        couponCategory: entity.couponCategory,
        couponType: entity.couponType,
        appliesTo: entity.appliesTo,
        festivalName: entity.festivalName,
        recipientName: entity.recipientName,
        recipientEmail: entity.recipientEmail,
        influencerId: entity.influencerId || null,
        validTill: entity.expiry || null,
        singleUse: entity.couponType === 'private',
        sendEmail: false,
        maxRedemptions: entity.usageCount,
        perUserLimit: 1,
        active: entity.status === 'active' ? 1 : 0,
        portal: 'merch'
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
      await loadInfluencerData();
      await loadReportData();
      return;
    }

    if (type === 'influencer') {
      if (form.dataset.submitting === 'true') return;
      const entity = updateInfluencerFromForm(form, existingId ? state.influencers.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.handle) {
        toast('Missing details', 'Influencer name and social handle are required.', 'warning');
        return;
      }
      try {
        form.dataset.submitting = 'true';
        const method = existingId ? 'PUT' : 'POST';
        const path = existingId
          ? `/api/merch/admin/influencers/${encodeURIComponent(existingId)}`
          : '/api/merch/admin/influencers';
        await apiRequest(path, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entity),
        });
        toast('Influencer saved', `${entity.name} ${existingId ? 'updated' : 'created'} successfully.`, 'success');
        closeModal();
        await loadInfluencerData();
        await loadCouponData();
        await loadReportData();
      } catch (error) {
        toast('Influencer not saved', error.message || 'Unable to save influencer data.', 'danger');
      } finally {
        form.dataset.submitting = 'false';
      }
      return;
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

      const openProductDropdown = document.querySelector('[data-coupon-products-dropdown].is-open, [data-influencer-coupon-dropdown].is-open');
      if (openProductDropdown && !target.closest('[data-coupon-products-dropdown], [data-influencer-coupon-dropdown]')) {
        closeCouponProductDropdown();
      }

      if (els.profileDropdown && !els.profileDropdown.hidden && !target.closest('[data-profile-menu], [data-action="open-profile"]')) {
        closeProfileDropdown();
      }

      const actionTarget = target.closest('[data-action]');
      if (actionTarget) {
        if (actionTarget instanceof HTMLInputElement || actionTarget instanceof HTMLSelectElement) return;
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
      if (target.matches('#campaignSlugInput')) {
        const liveSpan = document.getElementById('campaignSlugLiveUrl');
        if (liveSpan) {
          liveSpan.innerHTML = `${window.location.origin}/c/<span>${escapeHtml(target.value.trim() || '...')}</span>`;
        }
      }
      handleInput(target);
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.action) {
        handleAction(target.dataset.action, target);
        return;
      }
      if (target.matches('#campaignCouponSelect')) {
        const opt = target.selectedOptions[0];
        const feedback = document.getElementById('campaignCouponFeedback');
        if (feedback && opt) {
          feedback.textContent = opt.dataset.discount ? `Verified active merch coupon (${opt.dataset.discount})` : '';
        }
      }
      if (target.matches('#campaignInfluencerSelect')) {
        const infId = target.value;
        const couponSelect = document.getElementById('campaignCouponSelect');
        if (couponSelect && infId) {
          const options = Array.from(couponSelect.options);
          const assignedOpt = options.find((opt) => String(opt.dataset.influencerId) === String(infId));
          if (assignedOpt) {
            couponSelect.value = assignedOpt.value;
            const feedback = document.getElementById('campaignCouponFeedback');
            if (feedback) {
              feedback.textContent = `Assigned influencer coupon: ${assignedOpt.value} (${assignedOpt.dataset.discount || ''})`;
            }
          }
        }
      }
      if (target.matches('[data-hype-label-select]')) {
        const customWrap = target.closest('.admin-hype-row')?.querySelector('[data-hype-custom-wrap]');
        if (customWrap) customWrap.hidden = target.value !== 'Custom Label';
      }
      if (target.closest('[data-entity-form]')) return;
      handleInput(target);
    });

    document.addEventListener('submit', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;
      if (target.matches('#campaignCreateForm') || target.matches('[data-form="campaign-create"]')) {
        event.preventDefault();
        handleCampaignCreateSubmit(target);
        return;
      }
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
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (closeProfileDropdown()) {
          event.preventDefault();
          return;
        }
        if (closeCouponProductDropdown()) {
          event.preventDefault();
          return;
        }
        setSidebarOpen(false);
        closeModal();
      }
    });
  }

  async function init() {
    if (!(await ensureAdminSession())) return;
    bindEvents();
    renderAll();
    loadDashboardStats();
    loadHypeData();
    loadProductData();
    loadTrashData();
    loadOrderData();
    loadCustomerData();
    loadInfluencerData();
    loadCouponData();
    loadReportData();
    loadSettingsData();
    loadSecurityQuestion();
    loadOffers();
    setInterval(() => {
      if (document.hidden) return;
      loadDashboardStats({ silent: true });
      loadOrderData({ silent: true });
      loadReportData({ silent: true });
    }, 30000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
