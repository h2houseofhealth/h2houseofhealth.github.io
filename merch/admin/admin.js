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
  const LOW_STOCK_THRESHOLD = 15;

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

  const ORDER_STATUS_META = {
    pending: { label: 'Pending', color: '#d97706' },
    processing: { label: 'Processing', color: '#2563eb' },
    shipped: { label: 'Shipped', color: '#0f766e' },
    delivered: { label: 'Delivered', color: '#16a34a' },
    cancelled: { label: 'Cancelled', color: '#dc2626' },
    returned: { label: 'Returned', color: '#7c3aed' },
  };

  function normalizeOrderStatus(status) {
    const value = String(status || 'pending').trim().toLowerCase().replace(/\s+/g, '_');
    return ORDER_STATUS_META[value] ? value : 'pending';
  }

  function buildOrderStatusDistribution(orders) {
    const breakdown = Object.fromEntries(Object.keys(ORDER_STATUS_META).map((status) => [status, 0]));

    for (const order of Array.isArray(orders) ? orders : []) {
      const status = normalizeOrderStatus(order?.status);
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
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
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

  function renderInfluencerActionLinks(influencer) {
    const id = influencer?.id || '';
    const canEmail = Boolean(String(influencer?.email || '').trim());
    const emailTitle = canEmail ? '' : ' title="Add an email address before sending a report."';
    const emailDisabled = canEmail ? '' : ' disabled';

    return `
      <button class="admin-action-link" type="button" data-action="edit-influencer" data-id="${id}">Edit Influencer</button>
      <button class="admin-action-link" type="button" data-action="toggle-influencer" data-id="${id}">${influencer?.active ? 'Deactivate Influencer' : 'Reactivate Influencer'}</button>
      <button class="admin-action-link" type="button" data-action="assign-coupon" data-id="${id}">Assign Coupons</button>
      <button class="admin-action-link" type="button" data-action="download-influencer-report" data-id="${id}">Download Report</button>
      <button class="admin-action-link" type="button" data-action="email-influencer-report" data-id="${id}"${emailTitle}${emailDisabled}>Send to Email</button>
    `;
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

  function buildMerchReportLines(report) {
    const summary = report?.summary || {};
    const influencerRows = Array.isArray(report?.influencerReports) ? report.influencerReports : [];
    const monthlyRows = Array.isArray(report?.monthlyInfluencerReports) ? report.monthlyInfluencerReports : [];
    const periodLabel = [state.reportFrom, state.reportTo].filter(Boolean).join(' to ') || 'all available dates';

    return {
      summary,
      influencerRows,
      monthlyRows,
      periodLabel,
    };
  }

  function buildMerchReportCsv(report) {
    const { summary, influencerRows, monthlyRows, periodLabel } = buildMerchReportLines(report);
    const rows = [
      ['Merch influencer report'],
      ['Period', periodLabel],
      ['Orders', summary.orderCount || 0],
      ['Revenue', summary.revenue || 0],
      ['Influencers', influencerRows.length],
      ['Monthly rows', monthlyRows.length],
      [],
      ['Month', 'Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'],
      ...monthlyRows.map((row) => [
        row.monthLabel || reportMonthLabel(row.month),
        row.name || '',
        row.handle || '',
        row.orders || 0,
        row.revenue || 0,
        row.commission || 0,
        row.couponUsage || 0,
      ]),
    ];

    return rows.map((row) => row.map(csvCell).join(',')).join('\n');
  }

  function buildMerchReportTsv(report) {
    const { summary, influencerRows, monthlyRows, periodLabel } = buildMerchReportLines(report);
    const rows = [
      ['Merch influencer report'],
      ['Period', periodLabel],
      ['Orders', summary.orderCount || 0],
      ['Revenue', summary.revenue || 0],
      ['Influencers', influencerRows.length],
      ['Monthly rows', monthlyRows.length],
      [],
      ['Month', 'Influencer', 'Handle', 'Orders', 'Revenue', 'Commission', 'Coupon Usage'],
      ...monthlyRows.map((row) => [
        row.monthLabel || reportMonthLabel(row.month),
        row.name || '',
        row.handle || '',
        row.orders || 0,
        row.revenue || 0,
        row.commission || 0,
        row.couponUsage || 0,
      ]),
    ];

    return rows.map((row) => row.join('\t')).join('\n');
  }

  function buildMerchReportHtml(report) {
    const { summary, monthlyRows, periodLabel } = buildMerchReportLines(report);
    const rows = monthlyRows.map((row) => `
      <tr>
        <td>${escapeHtml(row.monthLabel || reportMonthLabel(row.month))}</td>
        <td>${escapeHtml(row.name || '')}</td>
        <td>${escapeHtml(row.handle || '')}</td>
        <td>${formatCount(row.orders)}</td>
        <td>${money(row.revenue)}</td>
        <td>${money(row.commission)}</td>
        <td>${formatCount(row.couponUsage)}</td>
      </tr>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Merch Influencer Report</title>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; }
            h1, h2, p { margin: 0 0 12px; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; max-width: 720px; margin-bottom: 20px; }
            .meta div { border: 1px solid #e5e7eb; border-radius: 12px; padding: 12px 14px; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #e5e7eb; padding: 10px 12px; text-align: left; }
            th { background: #f9fafb; }
          </style>
        </head>
        <body>
          <h1>Merch influencer report</h1>
          <p>Period: ${escapeHtml(periodLabel)}</p>
          <div class="meta">
            <div><strong>Orders</strong><br />${escapeHtml(String(summary.orderCount || 0))}</div>
            <div><strong>Revenue</strong><br />${escapeHtml(money(summary.revenue || 0))}</div>
            <div><strong>Influencers</strong><br />${escapeHtml(String((report?.influencerReports || []).length))}</div>
            <div><strong>Monthly rows</strong><br />${escapeHtml(String(monthlyRows.length))}</div>
          </div>
          <h2>Monthly Influencer Breakdown</h2>
          <table>
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
              ${rows || '<tr><td colspan="7">No monthly rows available.</td></tr>'}
            </tbody>
          </table>
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
            body { font-family: Arial, sans-serif; color: #1f2937; margin: 24px; background: #fff; font-size: 13px; line-height: 1.45; }
            h1, h2, h3, p { margin: 0 0 10px; }
            h1 { font-size: 26px; line-height: 1.1; }
            h2 { font-size: 18px; line-height: 1.15; }
            h3 { font-size: 15px; line-height: 1.2; }
            .hero { display: grid; gap: 12px; margin-bottom: 20px; }
            .meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .meta div, .panel { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px; background: #fff; }
            .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 20px; }
            .stats div { border: 1px solid #e5e7eb; border-radius: 14px; padding: 12px 14px; }
            .stats strong { display: block; font-size: 14px; margin-top: 4px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: left; vertical-align: top; font-size: 12px; }
            th { background: #f9fafb; }
            .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
            .muted { color: #6b7280; font-size: 13px; }
            .chips { display: flex; flex-wrap: wrap; gap: 8px; }
            .chip { display: inline-flex; border: 1px solid #e5e7eb; border-radius: 999px; padding: 5px 9px; font-size: 11px; background: #fafafa; }
            .section { margin-bottom: 20px; }
          </style>
        </head>
        <body>
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

  async function fetchInfluencerReport(influencerId) {
    return apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencerId)}/report`);
  }

  function buildInfluencerReportFilename(influencer, extension = 'html') {
    const slug = slugify(influencer?.name || influencer?.handle || `influencer-${influencer?.id || 'report'}`) || `influencer-${influencer?.id || 'report'}`;
    return `merch-influencer-report-${slug}.${extension}`;
  }

  async function downloadInfluencerReport(influencer) {
    if (!influencer) return;
    try {
      const result = await fetchInfluencerReport(influencer.id);
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

  async function emailInfluencerReport(influencer) {
    if (!influencer) return;
    if (!String(influencer.email || '').trim()) {
      toast('Email unavailable', `${influencer.name} does not have an email address on file.`, 'warning');
      return;
    }

    try {
      await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/report/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
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
      price: 3499.00,
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
      variants: [
        { id: 1, size: 'S', color: 'Black', price: 3499, stock: 25, sku: 'HM-HOD-BLK-S' },
        { id: 2, size: 'M', color: 'Black', price: 3499, stock: 30, sku: 'HM-HOD-BLK-M' },
        { id: 3, size: 'L', color: 'Black', price: 3499, stock: 20, sku: 'HM-HOD-BLK-L' },
        { id: 4, size: 'XL', color: 'Black', price: 3499, stock: 15, sku: 'HM-HOD-BLK-XL' },
        { id: 5, size: 'XXL', color: 'Black', price: 3499, stock: 10, sku: 'HM-HOD-BLK-XXL' },
      ],
    },
    {
      id: 2,
      name: 'Zenith Hoodie - Sand',
      slug: 'zenith-hoodie-sand',
      primarySku: 'HM-HOD-SND-S',
      categoryId: 1,
      category: 'Hoodies',
      price: 3499.00,
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
      variants: [
        { id: 6, size: 'S', color: 'Sand', price: 3499, stock: 20, sku: 'HM-HOD-SND-S' },
        { id: 7, size: 'M', color: 'Sand', price: 3499, stock: 25, sku: 'HM-HOD-SND-M' },
        { id: 8, size: 'L', color: 'Sand', price: 3499, stock: 18, sku: 'HM-HOD-SND-L' },
        { id: 9, size: 'XL', color: 'Sand', price: 3499, stock: 12, sku: 'HM-HOD-SND-XL' },
        { id: 10, size: 'XXL', color: 'Sand', price: 3499, stock: 8, sku: 'HM-HOD-SND-XXL' },
      ],
    },
    {
      id: 3,
      name: 'H2 Molecular Hydrogen Water Bottle',
      slug: 'molecular-hydrogen-water-bottle',
      primarySku: 'HM-BTL-300-SLV',
      categoryId: 2,
      category: 'Hydrogen Water Bottles',
      price: 6499.00,
      priceLabel: '₹6,499 - ₹8,499',
      stock: 130,
      status: 'published',
      createdAt: '2026-03-15',
      sales: 88,
      lowStockThreshold: 10,
      featured: true,
      archived: false,
      image: '/cdn/shop/files/WhatsApp_Image_2026-02-06_at_16.09.32_27f7d.jpg?v=1770378113',
      description: 'Hydrogen-rich water bottle with 300ml and 500ml variants.',
      variants: [
        { id: 11, size: '300ml', color: 'Silver', price: 6999, stock: 40, sku: 'HM-BTL-300-SLV' },
        { id: 12, size: '500ml', color: 'Silver', price: 6499, stock: 35, sku: 'HM-BTL-500-SLV' },
        { id: 13, size: '300ml', color: 'Black', price: 7499, stock: 30, sku: 'HM-BTL-300-BLK' },
        { id: 14, size: '500ml', color: 'Black', price: 8499, stock: 25, sku: 'HM-BTL-500-BLK' },
      ],
    },
    {
      id: 4,
      name: 'H2 Hydrogen Mist Spray',
      slug: 'hydrogen-mist-spray',
      primarySku: 'HM-SPR-050-WHT',
      categoryId: 3,
      category: 'Hydrogen Mists / Sprays',
      price: 2499.00,
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
      variants: [
        { id: 15, size: '50ml', color: 'White', price: 2499, stock: 50, sku: 'HM-SPR-050-WHT' },
        { id: 16, size: '100ml', color: 'White', price: 3499, stock: 40, sku: 'HM-SPR-100-WHT' },
        { id: 17, size: '50ml', color: 'Rose Gold', price: 2799, stock: 35, sku: 'HM-SPR-050-RSG' },
        { id: 18, size: '100ml', color: 'Rose Gold', price: 3799, stock: 30, sku: 'HM-SPR-100-RSG' },
      ],
    },
  ];

  function expandProductVariants(products) {
    return products.flatMap((product) => {
      const variants = Array.isArray(product.variants) && product.variants.length
        ? product.variants
        : [{ id: product.id, size: '', color: '', price: product.price, stock: product.stock, sku: product.primarySku || product.sku }];
      return variants.map((variant) => ({
        ...product,
        ...variant,
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
  const notificationsList = [];

  const initialState = {
    view: 'dashboard',
    sidebarOpen: false,
    notificationsOpen: false,
    selectedProductIds: [],
    selectedProductId: 101,
    selectedOrderId: null,
    selectedCustomerId: null,
    selectedCouponId: null,
    selectedInfluencerId: null,
    productsSearch: '',
    productsCategory: 'all',
    productsSort: 'newest',
    productsStatus: 'all',
    productsPage: 1,
    ordersLoading: false,
    ordersSearch: '',
    ordersStatus: 'all',
    ordersPage: 1,
    customersSearch: '',
    couponsSearch: '',
    couponsLoading: false,
    influencersLoading: false,
    reportsLoading: false,
    influencersSearch: '',
    influencersMonth: '',
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
    products: expandProductVariants(productsList),
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
    dashboardStats: null,
    reports: null,
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

  function buildRecentPayments(orders = []) {
    return [...(Array.isArray(orders) ? orders : [])]
      .filter((order) => ['paid', 'cod_pending', 'refunded'].includes(String(order.paymentStatus || '').toLowerCase()) || Number(order.totalAmount || 0) > 0)
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber || '',
        customerName: order.customerName || '',
        amount: Number(order.totalAmount || 0),
        paymentMethod: String(order.paymentMethod || 'online'),
        paymentStatus: String(order.paymentStatus || 'pending'),
        createdAt: order.createdAt || null,
      }));
  }

  function buildRecentCouponUsage(orders = []) {
    return [...(Array.isArray(orders) ? orders : [])]
      .filter((order) => String(order.couponCode || '').trim())
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber || '',
        customerName: order.customerName || '',
        couponCode: String(order.couponCode || ''),
        influencerName: String(order.influencerName || ''),
        amount: Number(order.totalAmount || 0),
        createdAt: order.createdAt || null,
      }));
  }

  function buildLatestCustomers(customers = []) {
    return [...(Array.isArray(customers) ? customers : [])]
      .sort((left, right) => {
        const leftKey = String(left.registrationDate || left.lastOrder?.createdAt || left.createdAt || '');
        const rightKey = String(right.registrationDate || right.lastOrder?.createdAt || right.createdAt || '');
        return rightKey.localeCompare(leftKey);
      })
      .slice(0, 5);
  }

  function getDashboardSnapshot() {
    const stats = state.dashboardStats || {};
    const report = state.reports || {};
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const customers = Array.isArray(state.customers) ? state.customers : [];
    const monthlyRevenueSeries = Array.isArray(stats.monthlyRevenueSeries) && stats.monthlyRevenueSeries.length
      ? stats.monthlyRevenueSeries
      : Array.isArray(report.monthlyRevenueSeries) && report.monthlyRevenueSeries.length
        ? report.monthlyRevenueSeries
        : buildMonthlyRevenueSeries(orders);
    const recentOrders = Array.isArray(stats.recentOrders) && stats.recentOrders.length
      ? stats.recentOrders
      : Array.isArray(report.recentOrders) && report.recentOrders.length
        ? report.recentOrders
        : orders.slice(0, 5);
    const recentPayments = Array.isArray(stats.recentPayments) && stats.recentPayments.length
      ? stats.recentPayments
      : Array.isArray(report.recentPayments) && report.recentPayments.length
        ? report.recentPayments
        : buildRecentPayments(orders);
    const recentCouponUsage = Array.isArray(stats.recentCouponUsage) && stats.recentCouponUsage.length
      ? stats.recentCouponUsage
      : Array.isArray(report.recentCouponUsage) && report.recentCouponUsage.length
        ? report.recentCouponUsage
        : buildRecentCouponUsage(orders);
    const latestCustomers = Array.isArray(stats.recentCustomers) && stats.recentCustomers.length
      ? stats.recentCustomers
      : buildLatestCustomers(customers);

    return {
      summary: stats.summary || report.summary || {},
      monthlyRevenueSeries,
      recentOrders,
      recentPayments,
      recentCouponUsage,
      latestCustomers,
      statusBreakdown: stats.statusBreakdown || report.statusBreakdown || {},
    };
  }

  function renderFeedList(items, emptyTitle, emptyMessage, renderItem) {
    if (!Array.isArray(items) || !items.length) {
      return renderEmptyState(emptyTitle, emptyMessage);
    }
    return items.map((item) => renderItem(item)).join('');
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
    const recentOrders = Array.isArray(dashboard.recentOrders) ? dashboard.recentOrders : [];
    const latestCustomers = Array.isArray(dashboard.latestCustomers) ? dashboard.latestCustomers : [];
    const recentPayments = Array.isArray(dashboard.recentPayments) ? dashboard.recentPayments : [];
    const recentCouponUsage = Array.isArray(dashboard.recentCouponUsage) ? dashboard.recentCouponUsage : [];
    const liveOrderDistribution = buildOrderStatusDistribution(state.orders);
    const liveOrderCount = liveOrderDistribution.total;
    const currentMonthKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`;
    const currentMonthRevenue = monthlyRevenueSeries.find((row) => String(row.month) === currentMonthKey)?.revenue || 0;
    const monthlyRevenueMax = Math.max(1, ...monthlyRevenueSeries.map((row) => Number(row.revenue || 0)));
    const monthlyChartRows = monthlyRevenueSeries.slice(-6).map((row) => ({
      label: row.monthLabel || formatMonthLabel(row.month),
      value: (Number(row.revenue || 0) / monthlyRevenueMax) * 100,
      display: money(row.revenue || 0),
    }));

    els.dashboardView.innerHTML = `
      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Overview</h2>
            <p class="admin-section__desc">Live merch orders, customers, coupons, and influencer data are synced from the merch API.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-card-grid admin-card-grid--1">
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
                    <p class="admin-table__muted">${escapeHtml(product.priceLabel || catalogPrice(product.price))} · ${escapeHtml(product.primarySku || 'SKU pending')}</p>
                  </div>
                `).join('')}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="admin-section">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Live Revenue</h2>
            <p class="admin-section__desc">Revenue, orders, customer activity, and coupon usage streamed from the merch API.</p>
          </div>
        </div>
        <div class="admin-section__body admin-card-grid admin-card-grid--3">
          <article class="admin-card">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Monthly Revenue</h3>
              <p class="admin-card__sub">Month-to-date totals from live orders</p>
            </div>
            <div class="admin-card__body admin-mini-chart">
              <p class="admin-stat__value" style="margin:0 0 10px;">${escapeHtml(money(currentMonthRevenue))}</p>
              <p class="admin-table__muted" style="margin:0 0 12px;">${escapeHtml(formatMonthLabel(currentMonthKey))}</p>
              ${renderMiniChart(monthlyChartRows.length ? monthlyChartRows : [{ label: 'No revenue yet', value: 0, display: money(0) }])}
            </div>
          </article>

          <article class="admin-card">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Revenue Overview Chart</h3>
              <p class="admin-card__sub">Monthly trend from the backend report feed</p>
            </div>
            <div class="admin-card__body admin-mini-chart">
              ${monthlyChartRows.length ? renderMiniChart(monthlyChartRows) : '<p class="admin-table__muted" style="margin:0;">No monthly revenue data is available yet.</p>'}
            </div>
          </article>

          <article class="admin-card">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Order Status Distribution</h3>
              <p class="admin-card__sub">Live breakdown from the current merch order feed</p>
            </div>
            <div class="admin-card__body" style="display:grid;gap:12px;">
              ${renderOrderStatusRing(liveOrderDistribution)}
              <div class="admin-chip-row" style="justify-content:center;">
                ${renderStatusLegend(liveOrderDistribution)}
              </div>
              <p class="admin-table__muted" style="margin:0;">${formatCount(liveOrderCount)} order(s) across the live status distribution.</p>
            </div>
          </article>
        </div>
      </section>
      <section class="admin-section admin-section--expanded">
        <div class="admin-section__head">
          <div>
            <h2 class="admin-section__title">Live Activity</h2>
            <p class="admin-section__desc">Recent orders, customers, payments, and coupon usage are wired to the admin data feed.</p>
          </div>
        </div>
        <div class="admin-section__body">
          <div class="admin-card-grid admin-card-grid--2">
            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Recent Orders</h3>
                <p class="admin-card__sub">Latest checkout activity from the merch API</p>
              </div>
              <div class="admin-card__body admin-list">
                ${renderFeedList(
                  recentOrders,
                  'No recent orders',
                  'Orders will appear here once live checkout activity is recorded.',
                  (order) => `
                    <div class="admin-list__item">
                      <div class="admin-list__item-head">
                        <div>
                          <p class="admin-list__item-title">${escapeHtml(order.orderNumber || `Order #${order.id}`)}</p>
                          <p class="admin-list__item-sub">${escapeHtml(order.customerName || 'Guest customer')} - ${escapeHtml(dateLabel(order.createdAt || ''))}</p>
                        </div>
                        <strong>${escapeHtml(money(order.totalAmount || 0))}</strong>
                      </div>
                      <p class="admin-table__muted" style="margin:0;">${escapeHtml(getStatusLabel(order.status || order.paymentStatus || 'pending'))} - ${escapeHtml(String(order.paymentStatus || 'pending'))}</p>
                    </div>
                  `
                )}
              </div>
            </article>

            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Latest Customers</h3>
                <p class="admin-card__sub">Most recently active merch customers</p>
              </div>
              <div class="admin-card__body admin-list">
                ${renderFeedList(
                  latestCustomers,
                  'No customer activity yet',
                  'Customer profiles will appear here after the backend is wired.',
                  (customer) => `
                    <div class="admin-list__item">
                      <div class="admin-list__item-head">
                        <div>
                          <p class="admin-list__item-title">${escapeHtml(customer.name || 'Customer')}</p>
                          <p class="admin-list__item-sub">${escapeHtml(customer.email || 'No email on file')}</p>
                        </div>
                        <span class="admin-avatar">${escapeHtml(initials(customer.name || 'Customer'))}</span>
                      </div>
                      <p class="admin-table__muted" style="margin:0;">${formatCount(customer.merchandiseOrders || 0)} order(s) - ${escapeHtml(dateLabel(customer.registrationDate || customer.createdAt || ''))}</p>
                    </div>
                  `
                )}
              </div>
            </article>

            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Recent Payments</h3>
                <p class="admin-card__sub">Payment confirmations and refunds</p>
              </div>
              <div class="admin-card__body admin-list">
                ${renderFeedList(
                  recentPayments,
                  'No payments yet',
                  'Payment entries will appear when the checkout and payment APIs are connected.',
                  (payment) => `
                    <div class="admin-list__item">
                      <div class="admin-list__item-head">
                        <div>
                          <p class="admin-list__item-title">${escapeHtml(payment.orderNumber || `Order #${payment.id}`)}</p>
                          <p class="admin-list__item-sub">${escapeHtml(payment.customerName || 'Guest customer')} - ${escapeHtml(payment.paymentMethod || 'online')}</p>
                        </div>
                        <strong>${escapeHtml(money(payment.amount || 0))}</strong>
                      </div>
                      <p class="admin-table__muted" style="margin:0;">${escapeHtml(getStatusLabel(payment.paymentStatus || 'pending'))} - ${escapeHtml(dateLabel(payment.createdAt || ''))}</p>
                    </div>
                  `
                )}
              </div>
            </article>

            <article class="admin-card">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Recent Coupon Usage</h3>
                <p class="admin-card__sub">Recently applied merch coupon codes</p>
              </div>
              <div class="admin-card__body admin-list">
                ${renderFeedList(
                  recentCouponUsage,
                  'No coupon usage yet',
                  'Coupon performance metrics will appear once a real source is wired in.',
                  (entry) => `
                    <div class="admin-list__item">
                      <div class="admin-list__item-head">
                        <div>
                          <p class="admin-list__item-title">${escapeHtml(entry.couponCode || 'Coupon')}</p>
                          <p class="admin-list__item-sub">${escapeHtml(entry.customerName || 'Guest customer')} - ${escapeHtml(entry.orderNumber || '')}</p>
                        </div>
                        <strong>${escapeHtml(money(entry.amount || 0))}</strong>
                      </div>
                      <p class="admin-table__muted" style="margin:0;">${escapeHtml(entry.influencerName || 'Store coupon')} - ${escapeHtml(dateLabel(entry.createdAt || ''))}</p>
                    </div>
                  `
                )}
              </div>
            </article>
          </div>

          <section class="admin-card" style="margin-top:18px;">
            <div class="admin-card__head">
              <h3 class="admin-card__title">Top Selling Products</h3>
              <p class="admin-card__sub">Using storefront catalog prices</p>
            </div>
            <div class="admin-card__body admin-list">
              ${state.products.slice(0, 5).map((product) => `
                <div class="admin-list__item">
                  <div class="admin-list__item-head">
                    <div>
                      <p class="admin-list__item-title">${escapeHtml(product.name)}</p>
                      <p class="admin-list__item-sub">${escapeHtml(product.category)}</p>
                    </div>
                    <strong>${escapeHtml(product.priceLabel || catalogPrice(product.price))}</strong>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>
      </section>
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
              <button class="admin-btn admin-btn--ghost" type="button" data-action="bulk-archive" ${selectedCount ? '' : 'disabled'}>Archive Selected</button>
              <button class="admin-btn admin-btn--danger" type="button" data-action="bulk-delete" ${selectedCount ? '' : 'disabled'}>Delete Selected</button>
            </div>
          </div>

          <div class="admin-grid admin-grid--stats" style="margin-bottom:18px;">
            ${[
              { label: 'Products in view', value: filtered.length, note: 'Matching current filters', trend: '+8%', up: true },
              { label: 'Low stock', value: lowStockCount, note: `At or below ${LOW_STOCK_THRESHOLD} units remaining`, trend: '-2%', up: false },
              { label: 'Archived', value: state.products.filter((product) => product.archived).length, note: 'Hidden from storefront', trend: '+1%', up: true },
              { label: 'Featured', value: state.products.filter((product) => product.featured).length, note: 'Highlighted items', trend: '+3%', up: true },
              { label: 'Avg. price', value: catalogPrice(Math.round(state.products.reduce((sum, product) => sum + product.price, 0) / state.products.length || 0)), note: 'All catalog items', trend: '+5%', up: true },
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
                  <th>Variant</th>
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
                    <td>${escapeHtml(product.variantLabel || 'Default variant')}</td>
                    <td>${escapeHtml(product.sku)}</td>
                    <td>${escapeHtml(product.category)}</td>
                    <td><strong>${escapeHtml(product.priceLabel || catalogPrice(product.price))}</strong></td>
                    <td>
                      <div class="admin-list" style="gap:4px;">
                        <input class="admin-input admin-stock-input" data-action="update-product-stock" data-id="${product.id}" type="number" min="0" value="${escapeHtml(product.stock)}" aria-label="Stock for ${escapeHtml(product.name)} ${escapeHtml(product.variantLabel || '')}" />
                        <span class="admin-badge ${Number(product.stock || 0) <= LOW_STOCK_THRESHOLD ? 'admin-badge--inactive' : 'admin-badge--active'}">${escapeHtml(getLowStockLabel(product))}</span>
                      </div>
                    </td>
                    <td><span class="admin-badge ${statusClass(product.status)}">${escapeHtml(getStatusLabel(product.status))}</span></td>
                    <td>${escapeHtml(dateLabel(product.createdAt))}</td>
                    <td>
                      <div class="admin-actions">
                        <button class="admin-action-link" type="button" data-action="edit-product" data-id="${product.id}">Edit</button>
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

          <div class="admin-grid admin-grid--two" ${showOrderDetails ? '' : 'style="grid-template-columns:1fr;"'}>
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
                        <td>
                          <select class="admin-select admin-order-status-select" data-action="update-order-status" data-id="${order.id}" aria-label="Status for ${escapeHtml(order.orderNumber)}">
                            ${Object.keys(ORDER_STATUS_META).map((status) => `<option value="${status}" ${normalizeOrderStatus(order.status) === status ? 'selected' : ''}>${escapeHtml(getStatusLabel(status))}</option>`).join('')}
                          </select>
                        </td>
                        <td>
                          <div class="admin-actions">
                            <button class="admin-action-link" type="button" data-action="open-order-invoice" data-id="${order.id}">Invoice</button>
                            <button class="admin-action-link" type="button" data-action="email-order-invoice" data-id="${order.id}">Email</button>
                            <button class="admin-action-link" type="button" data-action="download-order-invoice" data-id="${order.id}">Download</button>
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
                      <button class="admin-btn admin-btn--ghost" type="button" data-action="ship-order" data-id="${selectedOrder?.id || ''}">Ship</button>
                      <button class="admin-btn admin-btn--ghost" type="button" data-action="deliver-order" data-id="${selectedOrder?.id || ''}">Deliver</button>
                      <button class="admin-btn admin-btn--danger" type="button" data-action="cancel-order" data-id="${selectedOrder?.id || ''}">Cancel</button>
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
              <p class="admin-list__item-sub">${escapeHtml(customer.email)}</p>
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
          <p class="admin-list__item-sub">${escapeHtml(lastOrderLabel)}</p>
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

    const query = state.customersSearch.trim().toLowerCase();
    const filtered = state.customers.filter((customer) =>
      !query ||
      [
        customer.name,
        customer.email,
        customer.phone,
        customer.addressSummary,
        customer.lastOrderLabel,
        String(customer.merchandiseOrders || ''),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
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
          </div>

          <div class="admin-grid admin-grid--two" ${showCustomerDetails ? '' : 'style="grid-template-columns:1fr;"'}>
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
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Merchandise Orders</th>
                      <th>Last Order</th>
                      <th>Addresses</th>
                      <th>Registration Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filtered.map((customer) => `
                      <tr data-action="select-customer" data-id="${customer.id}" style="cursor:pointer;">
                        <td><strong>${escapeHtml(customer.name)}</strong></td>
                        <td>${escapeHtml(customer.email)}</td>
                        <td>${escapeHtml(customer.phone)}</td>
                        <td>${escapeHtml(formatCount(customer.merchandiseOrders))}</td>
                        <td>${escapeHtml(customer.lastOrder?.orderNumber ? `${customer.lastOrder.orderNumber}${customer.lastOrder.createdAt ? ` - ${dateLabel(customer.lastOrder.createdAt)}` : ''}` : customer.lastOrderLabel || 'No orders yet')}</td>
                        <td>${escapeHtml(customer.addressSummary || 'No saved addresses')}</td>
                        <td>${escapeHtml(dateLabel(customer.registrationDate || customer.registeredAt))}</td>
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
        coupon.influencerName,
        coupon.influencerHandle,
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

    const selectedCoupon = state.selectedCouponId == null
      ? null
      : filtered.find((coupon) => Number(coupon.id) === Number(state.selectedCouponId)) || null;
    const showCouponDetails = Boolean(selectedCoupon);

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
            </div>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-coupon-modal">Create Coupon</button>
          </div>

          <div class="admin-grid admin-grid--two" style="margin-top:16px;${showCouponDetails ? '' : 'grid-template-columns:1fr;'}">
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
                            <td>${escapeHtml(coupon.discount || coupon.discountValue || '-')}</td>
                            <td>${escapeHtml(String(usageCount))}</td>
                            <td>${escapeHtml(expiryValue ? dateLabel(expiryValue) : 'No expiry')}</td>
                            <td><span class="admin-badge ${statusClass(statusValue)}">${escapeHtml(getStatusLabel(statusValue))}</span></td>
                            <td>${escapeHtml(ownerLabel)}</td>
                            <td>${escapeHtml(coupon.createdAt ? dateLabel(coupon.createdAt) : '—')}</td>
                            <td>
                              <div class="admin-actions">
                                <button class="admin-action-link" type="button" data-action="select-coupon" data-id="${coupon.id}">View</button>
                                <button class="admin-action-link" type="button" data-action="edit-coupon" data-id="${coupon.id}">Edit</button>
                                <button class="admin-action-link" type="button" data-action="assign-coupon-owner" data-id="${coupon.id}">Assign Influencer</button>
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

            ${showCouponDetails ? `
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
                        Remaining usage: ${escapeHtml(selectedCoupon.maxRedemptions == null ? 'Unlimited' : String(Math.max(0, Number(selectedCoupon.maxRedemptions || 0) - Number(selectedCoupon.totalRedemptions || 0))))}
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

  function renderInfluencers() {
    const query = state.influencersSearch.trim().toLowerCase();
    const month = String(state.influencersMonth || '').trim();
    const recentMonths = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });
    const monthOptions = Array.from(new Set([
      ...recentMonths,
      ...state.influencers.flatMap((influencer) => (influencer.monthlySales || []).map((row) => row.month)),
    ]))
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left));
    const getMonthStats = (influencer) => {
      if (!month) return { orders: Number(influencer.totalOrders || 0), revenue: Number(influencer.revenue || 0), commission: Number(influencer.commission || 0), couponUsage: Number(influencer.couponUsage || 0) };
      return (influencer.monthlySales || []).find((row) => row.month === month) || { orders: 0, revenue: 0, commission: 0, couponUsage: 0 };
    };
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
    const totalRevenue = statsSource.reduce((sum, influencer) => sum + getMonthStats(influencer).revenue, 0);
    const totalOrders = statsSource.reduce((sum, influencer) => sum + getMonthStats(influencer).orders, 0);
    const totalCoupons = statsSource.reduce((sum, influencer) => sum + getMonthStats(influencer).couponUsage, 0);

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
            <div class="admin-toolbar__group" style="flex:0 1 220px;">
              <select class="admin-select" data-input="influencersMonth" aria-label="Filter influencer sales by month">
                <option value="">All months</option>
                ${monthOptions.map((value) => `<option value="${escapeHtml(value)}" ${month === value ? 'selected' : ''}>${escapeHtml(reportMonthLabel(value))}</option>`).join('')}
              </select>
            </div>
            <button class="admin-btn admin-btn--soft" type="button" data-action="open-influencer-modal">Add Influencer</button>
          </div>

          <div class="admin-card-grid admin-card-grid--2">
            ${visibleInfluencers.length ? visibleInfluencers.map((influencer) => `
              <article class="admin-card" data-action="select-influencer" data-id="${influencer.id}" style="cursor:pointer;">
                <div class="admin-card__head">
                  <div class="admin-list__item-head">
                    <div>
                      <button
                        class="admin-action-link"
                        type="button"
                        data-action="select-influencer"
                        data-id="${influencer.id}"
                        aria-label="View ${escapeHtml(influencer.name)} profile"
                        style="padding:0;border:0;background:none;font:inherit;font-weight:700;text-align:left;cursor:pointer;"
                      >${escapeHtml(influencer.name)}</button>
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
                    ${(() => { const stats = getMonthStats(influencer); return `<article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Orders</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(stats.orders)}</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Revenue</p>
                      <p class="admin-stat__value" style="font-size:20px;">${money(stats.revenue)}</p>
                    </article>`; })()}
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Coupon Use</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(influencer.couponUsage)}</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Campaigns</p>
                      <p class="admin-stat__value" style="font-size:20px;">${formatCount(influencer.activeCampaigns)}</p>
                    </article>
                  </div>
                  <div class="admin-grid admin-grid--stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px;">
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Commission Earned</p>
                      <p class="admin-stat__value" style="font-size:20px;">${money(getMonthStats(influencer).commission)}</p>
                      <p class="admin-stat__note">Based on the influencer's commission rate and attributed revenue.</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Commission Paid</p>
                      <p class="admin-stat__value" style="font-size:20px;">${money(influencer.paidCommission)}</p>
                      <p class="admin-stat__note">Processed commission payments already recorded.</p>
                    </article>
                    <article class="admin-stat" style="padding:12px;">
                      <p class="admin-stat__label">Commission per Order</p>
                      <p class="admin-stat__value" style="font-size:20px;">${money(influencer.commissionPerOrderPaise || 0)}</p>
                      <p class="admin-stat__note">Fixed amount credited for each attributed order.</p>
                    </article>
                  </div>
                  <div class="admin-actions" style="margin-top:12px;">
                    ${renderInfluencerActionLinks(influencer)}
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
            <section class="admin-card" id="influencer-profile-panel" tabindex="-1">
              <div class="admin-card__head">
                <h3 class="admin-card__title">Influencer Profile</h3>
                <p class="admin-card__sub">Full partner profile and coupon summary</p>
              </div>
              <div class="admin-card__body">
                ${selectedInfluencer ? `
                  <div class="admin-list">
                    ${month ? `<div class="admin-list__item"><p class="admin-list__item-title">${escapeHtml(reportMonthLabel(month))} Sales</p><p class="admin-list__item-sub">${formatCount(getMonthStats(selectedInfluencer).orders)} orders · ${money(getMonthStats(selectedInfluencer).revenue)} revenue · ${money(getMonthStats(selectedInfluencer).commission)} commission</p></div>` : ''}
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
                      <p class="admin-list__item-title">Active Campaigns</p>
                      <p class="admin-list__item-sub">${formatCount(selectedInfluencer.activeCampaigns)}</p>
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
      { title: 'Sales Report', meta: 'Orders, revenue, averages, and top sellers', target: 'sales-report' },
      { title: 'Orders Report', meta: 'Fulfillment stages and channel breakdown', target: 'orders-report' },
      { title: 'Products Report', meta: 'Stock health and performance by SKU', target: 'products-report' },
      { title: 'Customers Report', meta: 'LTV, repeat rate, and cohorts', target: 'customers-report' },
      { title: 'Coupons Report', meta: 'Usage, expiry, and owner split', target: 'coupons-report' },
      { title: 'Influencer Report', meta: 'Campaign performance and revenue contribution', target: 'influencer-report' },
      { title: 'Revenue Report', meta: 'Payment capture and return impact', target: 'revenue-report' },
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
        color: ORDER_STATUS_META[normalizeOrderStatus(status)]?.color || '#9ca3af',
        count: Number(count || 0),
        percent: reportOrderTotal ? (Number(count || 0) / reportOrderTotal) * 100 : 0,
      }));
    const reportDistribution = {
      total: reportOrderTotal,
      segments: reportSegments,
    };
    const lowStockProducts = getLowStockProducts();
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
          <div class="admin-toolbar">
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
              <button class="admin-report-card admin-report-card--interactive" type="button" data-action="open-report-section" data-target="${escapeHtml(tile.target)}">
                <h3 class="admin-report-card__title">${escapeHtml(tile.title)}</h3>
                <p class="admin-report-card__meta">${escapeHtml(tile.meta)}</p>
                <span class="admin-report-card__link">View report</span>
              </button>
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
              <h3 class="admin-card__title">Low Stock Report</h3>
              <p class="admin-card__sub">Products at or below ${LOW_STOCK_THRESHOLD} units remaining</p>
            </div>
            <div class="admin-card__body admin-table-wrap">
              ${lowStockProducts.length ? `
                <table class="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>SKU</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${lowStockProducts.map((product) => `
                      <tr>
                        <td><strong>${escapeHtml(product.name)}</strong><br><span class="admin-table__muted">${escapeHtml(product.description || '')}</span></td>
                        <td>${escapeHtml(product.sku || '—')}</td>
                        <td>${escapeHtml(product.category || '—')}</td>
                        <td><strong>${formatCount(product.stock)}</strong></td>
                        <td><span class="admin-badge admin-badge--inactive">${escapeHtml(getLowStockLabel(product))}</span></td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              ` : renderEmptyState('No low stock items', `All products are above ${LOW_STOCK_THRESHOLD} units.`)}
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

          <section class="admin-card" id="customers-report" style="margin-top:18px;">
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
          <label class="admin-field"><span>Price (rupees)</span><input class="admin-input" name="price" type="number" min="0" step="1" value="${escapeHtml(entity?.price || 0)}" required /></label>
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
          <label class="admin-field"><span>Discount</span><input class="admin-input" name="discount" type="number" min="1" step="1" value="${escapeHtml(entity?.discount || entity?.discountValue || '')}" required /></label>
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
          <label class="admin-field"><span>Applies To</span>
            <select class="admin-select" name="appliesTo">
              <option value="merch" ${String(entity?.appliesTo || 'merch') === 'merch' ? 'selected' : ''}>All Merch Products</option>
              ${state.products.map((product) => {
                const productId = product.productId || product.id;
                const variantLabel = [product.size, product.color].filter(Boolean).join(' / ');
                const label = variantLabel ? `${product.name} — ${variantLabel}` : product.name;
                return `<option value="product:${productId}" ${String(entity?.appliesTo) === `product:${productId}` ? 'selected' : ''}>${escapeHtml(label)}</option>`;
              }).join('')}
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
          <label class="admin-field"><span>Commission per Order (rupees)</span><input class="admin-input" name="commissionPerOrder" type="number" min="0" step="1" value="${escapeHtml(Number(entity?.commissionPerOrderPaise || 0) / 100)}" /></label>
          <label class="admin-field"><span>Commission Paid (rupees)</span><input class="admin-input" name="paidCommission" type="number" min="0" step="1" value="${escapeHtml(Math.round(Number(entity?.paidCommission || 0) / 100))}" /></label>
          <label class="admin-field admin-field--wide"><span>Assigned Coupons</span><input class="admin-input" value="${escapeHtml((entity?.coupons || []).join(', '))}" readonly /></label>
          <label class="admin-field admin-field--wide"><span>Notes</span><textarea class="admin-textarea" name="notes">${escapeHtml(entity?.notes || '')}</textarea></label>
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

  async function updateInfluencerCouponsFromForm(form) {
    const influencerId = Number(form.dataset.influencerId || 0);
    const influencer = getInfluencerById(influencerId);
    if (!influencer) {
      toast('Influencer not found', 'The selected influencer could not be updated.', 'warning');
      return;
    }

    const coupons = normalizeCouponCodes(form.querySelector('[name="coupons"]')?.value);
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
    const categoryId = Number(fd.get('categoryId'));
    const category = state.categories.find((item) => Number(item.id) === categoryId);
    const product = {
      id: existing?.id || Number(uniqueId('prod').replace(/\D/g, '').slice(0, 6)),
      name: String(fd.get('name') || '').trim(),
      sku: String(fd.get('sku') || '').trim(),
      categoryId,
      category: category?.name || 'Uncategorized',
      price: Number(fd.get('price') || 0),
      priceLabel: catalogPrice(Number(fd.get('price') || 0)),
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
    return {
      id: existing?.id || Date.now(),
      code: String(fd.get('code') || '').trim().toUpperCase(),
      description: String(fd.get('description') || '').trim(),
      discount: String(fd.get('discount') || '').trim(),
      usageCount: isUnlimitedInfluencer ? null : Number.isFinite(usageCount) && usageCount > 0 ? usageCount : null,
      expiry: isUnlimitedInfluencer ? '' : String(fd.get('expiry') || '').trim(),
      usageType,
      status: fd.get('status') === 'on' ? 'active' : 'inactive',
      couponType,
      ownerType: couponCategory === 'influencer' ? 'influencer' : couponCategory === 'private' ? 'private' : 'general',
      appliesTo: String(fd.get('appliesTo') || 'merch').trim().toLowerCase(),
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
      commissionPerOrderPaise: Math.max(0, Math.round(Number(fd.get('commissionPerOrder') || 0) * 100)),
      paidCommission: Math.max(0, Math.round(Number(fd.get('paidCommission') || existing?.paidCommission || 0) * 100)),
      coupons: existing?.coupons || [],
      totalOrders: Number(existing?.totalOrders || 0),
      revenue: Number(existing?.revenue || 0),
      couponUsage: Number(existing?.couponUsage || 0),
      activeCampaigns: Number(existing?.activeCampaigns || 0),
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
      const result = await apiRequest('/api/admin/coupons?portal=merch');
      state.coupons = Array.isArray(result.coupons) ? result.coupons : [];
    } catch (error) {
      state.coupons = [];
      toast('Coupons unavailable', error.message || 'Unable to load coupons from the shared admin API.', 'warning');
    } finally {
      state.couponsLoading = false;
      renderCoupons();
    }
  }

  async function loadDashboardStats() {
    try {
      const result = await apiRequest('/api/merch/admin/stats');
      state.dashboardStats = result || null;
    } catch (error) {
      state.dashboardStats = null;
    } finally {
      renderDashboard();
      if (state.view === 'reports') renderReports();
    }
  }

  async function loadOrderData() {
    state.ordersLoading = true;
    renderOrders();
    try {
      const result = await apiRequest('/api/merch/admin/orders');
      state.orders = Array.isArray(result.orders) ? result.orders : [];
    } catch (error) {
      state.orders = [];
      toast('Orders unavailable', error.message || 'Unable to load merch orders from the admin API.', 'warning');
    } finally {
      state.ordersLoading = false;
      renderOrders();
      renderDashboard();
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

  async function loadInfluencerData() {
    state.influencersLoading = true;
    renderInfluencers();
    try {
      const result = await apiRequest('/api/merch/admin/influencers');
      state.influencers = Array.isArray(result.influencers) ? result.influencers : [];
      if (!state.selectedInfluencerId && state.influencers[0]) {
        state.selectedInfluencerId = state.influencers[0].id;
      }
    } catch (error) {
      state.influencers = [];
      toast('Influencers unavailable', error.message || 'Unable to load influencer data from the admin API.', 'warning');
    } finally {
      state.influencersLoading = false;
      renderInfluencers();
    }
  }

  async function loadReportData() {
    state.reportsLoading = true;
    try {
      const params = new URLSearchParams();
      if (state.reportFrom) params.set('startDate', state.reportFrom);
      if (state.reportTo) params.set('endDate', state.reportTo);
      state.reports = await apiRequest(`/api/merch/admin/reports?${params.toString()}`);
    } catch (error) {
      state.reports = null;
      toast('Reports unavailable', error.message || 'Unable to load merch reports from the admin API.', 'warning');
    } finally {
      state.reportsLoading = false;
      renderReports();
      renderDashboard();
    }
  }

  function downloadCurrentReport() {
    if (!state.reports) {
      toast('Reports unavailable', 'Load the report data before downloading.', 'warning');
      return;
    }

    const format = String(state.reportFormat || 'csv').toLowerCase();
    const report = state.reports;
    const startLabel = String(state.reportFrom || 'start').replace(/[^0-9-]/g, '');
    const endLabel = String(state.reportTo || 'end').replace(/[^0-9-]/g, '');
    const baseName = `merch-influencer-report-${startLabel}-${endLabel}`;

    if (format === 'excel') {
      downloadMerchReportFile(`${baseName}.xls`, buildMerchReportTsv(report), 'application/vnd.ms-excel;charset=utf-8');
      toast('Download ready', 'The Excel-friendly report has been downloaded.', 'success');
      return;
    }

    if (format === 'pdf') {
      downloadMerchReportFile(`${baseName}.html`, buildMerchReportHtml(report), 'text/html;charset=utf-8');
      toast('Download ready', 'The printable report has been downloaded as HTML. Open it and print to PDF if needed.', 'success');
      return;
    }

    downloadMerchReportFile(`${baseName}.csv`, buildMerchReportCsv(report), 'text/csv;charset=utf-8');
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

  async function fetchOrderInvoiceLink(orderId) {
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error('Order details are unavailable.');
    }
    return apiRequest(`/api/merch/orders/${encodeURIComponent(id)}/invoice-link`);
  }

  function openInvoiceDocument(url) {
    const targetUrl = buildApiUrl(url);
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!opened) {
      toast('Invoice unavailable', 'The invoice could not open. Please allow popups and try again.', 'warning');
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

  async function handleAction(action, target) {
    const rawId = String(target?.dataset?.id || target?.closest?.('[data-id]')?.dataset?.id || '');
    const id = Number(rawId || 0);
    const product = state.products.find((item) => Number(item.id) === id);
    const category = state.categories.find((item) => Number(item.id) === id);
    const order = state.orders.find((item) => Number(item.id) === id);
    const customer = state.customers.find((item) => String(item.id) === rawId);
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
          state.selectedOrderId = Number(state.selectedOrderId) === Number(order.id) ? null : order.id;
          renderOrders();
        }
        return;
      case 'update-product-stock':
        if (product && target instanceof HTMLInputElement) {
          const stock = Math.max(0, Number(target.value || 0));
          product.stock = Number.isFinite(stock) ? stock : 0;
          target.value = String(product.stock);
          renderProducts();
        }
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
          try {
            await updateOrderOnServer(order, { status: order.status || 'processing', payment_status: 'refunded' });
            toast('Refund recorded', `${order.orderNumber} has been flagged for refund.`, 'success');
          } catch (error) {
            toast('Refund failed', error.message || 'Unable to record the refund.', 'warning');
          }
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
      case 'select-coupon':
        if (coupon) {
          state.selectedCouponId = Number(state.selectedCouponId) === Number(coupon.id) ? null : coupon.id;
          renderCoupons();
        }
        return;
      case 'open-coupon-modal':
        renderEntityFormModal('coupon');
        return;
      case 'edit-coupon':
        renderEntityFormModal('coupon', coupon);
        return;
      case 'assign-coupon-owner':
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
              onConfirm: async () => {
                await apiRequest(`/api/merch/admin/influencers/${encodeURIComponent(influencer.id)}/active`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ active: 0 }),
                });
                toast('Influencer deactivated', `${influencer.name} is now inactive.`, 'warning');
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
      case 'email-report':
        await emailCurrentReport();
        return;
      case 'open-report-section': {
        const targetId = String(target.dataset.target || '').trim();
        const sectionIdMap = {
          'sales-report': 'revenue-report',
          'revenue-report': 'revenue-report',
          'orders-report': 'orders-report',
          'products-report': 'products-report',
          'customers-report': 'customers-report',
          'coupons-report': 'coupons-report',
          'influencer-report': 'influencer-report',
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
    if (inputKey === 'influencersSearch' || inputKey === 'influencersMonth') {
      renderInfluencers();
      return;
    }
    if (inputKey === 'reportFrom' || inputKey === 'reportTo' || inputKey === 'reportFormat') {
      renderReports();
      loadReportData();
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
        discountValue: Number(entity.discount) || 0,
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
      const entity = updateInfluencerFromForm(form, existingId ? state.influencers.find((item) => Number(item.id) === existingId) : null);
      if (!entity.name || !entity.handle) {
        toast('Missing details', 'Influencer name and handle are required.', 'warning');
        return;
      }
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
      return;
    }
  }

  function bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;

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
      handleInput(target);
    });

    document.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
      if ((target instanceof HTMLInputElement || target instanceof HTMLSelectElement) && target.dataset.action) {
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
    loadDashboardStats();
    loadOrderData();
    loadCustomerData();
    loadInfluencerData();
    loadCouponData();
    loadReportData();
    setInterval(() => {
      if (document.hidden) return;
      loadDashboardStats();
      loadOrderData();
      loadReportData();
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
