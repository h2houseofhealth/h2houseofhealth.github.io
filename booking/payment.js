const API_URL = '';
const token = new URLSearchParams(window.location.search).get('token') || '';
console.log('TOKEN:', token);

const elements = {
  paymentLead: document.getElementById('paymentLead'),
  paymentSummary: document.getElementById('paymentSummary'),
  paymentError: document.getElementById('paymentError'),
  payNowBtn: document.getElementById('payNowBtn'),
};

let paymentState = null;

bootstrap();

async function bootstrap() {
  elements.payNowBtn.addEventListener('click', handlePayNow);
  await loadPaymentSummary();
}

async function loadPaymentSummary() {
  elements.paymentError.textContent = '';
  elements.paymentSummary.innerHTML = '';
  elements.payNowBtn.disabled = true;

  if (!token) {
    elements.paymentError.textContent = 'Invalid payment link.';
    return;
  }

  try {
    paymentState = await api(`/api/public/payments/booking?token=${encodeURIComponent(token)}`);
    renderPaymentSummary();
  } catch (error) {
    elements.paymentError.textContent = error.message || 'Unable to load payment details.';
  }
}

function renderPaymentSummary() {
  if (!paymentState) return;

  const summary = paymentState.summary || {};
  const addOnLines = Array.isArray(summary.addOnItems) ? summary.addOnItems : [];
  const detailCard = document.createElement('article');
  detailCard.className = 'admin-membership-card';
  
  // Get customer name and email - prefer guest info if available
  const customerName = paymentState.booking?.guestName || paymentState.customer?.name || '';
  const customerEmail = paymentState.booking?.guestEmail || paymentState.customer?.email || '';
  const customerPhone = paymentState.booking?.guestPhone || paymentState.customer?.mobile || '';
  
  detailCard.innerHTML = `
    <div class="admin-membership-head">
      <div>
        <h3>${escapeHtml(paymentState.booking?.serviceName || 'Booking')}</h3>
        <p>${escapeHtml(customerName)} • ${escapeHtml(customerEmail)}</p>
      </div>
      <span class="status-chip payment-${escapeHtml(paymentState.paymentStatus || 'unpaid')}">${escapeHtml(
    paymentState.paymentStatus || 'unpaid'
  )}</span>
    </div>
    <div class="admin-membership-meta">
      <div class="admin-membership-meta-item">
        <strong>Slot</strong>
        <span>${escapeHtml(formatDateTime(paymentState.booking?.bookingDate, paymentState.booking?.bookingTime))}</span>
      </div>
      <div class="admin-membership-meta-item">
        <strong>Items</strong>
        <span>${escapeHtml(String(summary.bookingCount || 1))}</span>
      </div>
      <div class="admin-membership-meta-item">
        <strong>Status</strong>
        <span>${escapeHtml(paymentState.status || 'pending')}</span>
      </div>
      <div class="admin-membership-meta-item">
        <strong>Total</strong>
        <span>Rs. ${Number(summary.totalAmountInr || 0).toLocaleString('en-IN')}</span>
      </div>
    </div>
    ${customerPhone ? `
      <div class="admin-membership-meta" style="margin-top: 12px;">
        <div class="admin-membership-meta-item">
          <strong>Guest Phone</strong>
          <span>${escapeHtml(customerPhone)}</span>
        </div>
      </div>
    ` : ''}
  `;

  const breakdown = document.createElement('div');
  breakdown.className = 'admin-membership-members';
  breakdown.innerHTML = '<h4>Payment Breakdown</h4>';

  const items = [];
  if (Number(summary.packagePriceInr || 0) > 0) {
    items.push(`${summary.serviceName || paymentState.booking?.serviceName}: Rs. ${Number(summary.packagePriceInr).toLocaleString('en-IN')}`);
  } else if (Number(summary.amountInr || 0) > 0) {
    items.push(`${paymentState.booking?.serviceName || 'Service'}: Rs. ${Number(summary.amountInr).toLocaleString('en-IN')}`);
  }
  if (Number(summary.extraSessions || 0) > 0 && Number(summary.extraSessionPriceInr || 0) > 0) {
    items.push(
      `${summary.extraSessions} extra session(s): Rs. ${Number(summary.extraSessions * summary.extraSessionPriceInr).toLocaleString('en-IN')}`
    );
  }
  addOnLines.forEach((item) => {
    items.push(`${item.serviceName}: Rs. ${Number(item.amountInr || 0).toLocaleString('en-IN')}`);
  });
  if (!items.length) {
    items.push('No payable items found.');
  }

  items.forEach((line) => {
    const row = document.createElement('div');
    row.className = 'admin-member-field';
    row.innerHTML = `<span>${escapeHtml(line)}</span>`;
    breakdown.appendChild(row);
  });

  detailCard.appendChild(breakdown);
  elements.paymentSummary.appendChild(detailCard);
  elements.paymentLead.textContent =
    paymentState.paymentStatus === 'paid'
      ? 'This booking is already paid.'
      : 'Review the booking details below and complete payment.';
  elements.payNowBtn.disabled = paymentState.paymentStatus === 'paid' || paymentState.status === 'cancelled';
}

async function handlePayNow() {
  if (!token) return;
  elements.paymentError.textContent = '';

  try {
    const order = await api('/api/public/payments/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not loaded');
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'H2 House Of Health',
      description: order.booking?.serviceName || 'Booking Payment',
      order_id: order.orderId,
      prefill: {
        name: order.customer?.name || '',
        email: order.customer?.email || '',
      },
      theme: {
        color: '#8b5e3c',
      },
      handler: async (response) => {
        try {
          await api('/api/public/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          await loadPaymentSummary();
          alert('Payment successful.');
        } catch (error) {
          elements.paymentError.textContent = error.message || 'Payment verification failed.';
        }
      },
    });

    checkout.open();
  } catch (error) {
    elements.paymentError.textContent = error.message || 'Unable to start payment.';
  }
}

async function api(url, options = {}) {
  const targetUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  const response = await fetch(targetUrl, {
    ...options,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : {};
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function formatDateTime(dateISO, time24) {
  if (!dateISO || !time24) return '-';
  const dateMatch = String(dateISO || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(time24 || '').trim().match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch) return '-';
  const date = new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), 12, 0, 0);
  const dateLabel = Number.isNaN(date.getTime())
    ? dateISO
    : new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }).format(date);
  const slotLabels = {
    '09:30': '9:30 AM - 11:00 AM',
    '10:30': '10:30 AM - 12:00 PM',
    '11:30': '11:30 AM - 1:00 PM',
    '12:30': '12:30 PM - 2:00 PM',
    '13:30': '1:30 PM - 3:00 PM',
    '14:30': '2:30 PM - 4:00 PM',
    '15:30': '3:30 PM - 5:00 PM',
    '16:30': '4:30 PM - 6:00 PM',
    '17:30': '5:30 PM - 7:00 PM',
    '18:30': '6:30 PM - 8:00 PM',
    '19:30': '7:30 PM - 9:00 PM',
  };
  if (slotLabels[time24]) {
    return `${dateLabel}, ${slotLabels[time24]}`;
  }
  if (!timeMatch) return `${dateLabel}, ${time24}`;
  const time = new Date(2000, 0, 1, Number(timeMatch[1]), Number(timeMatch[2]), 0);
  const timeLabel = Number.isNaN(time.getTime())
    ? time24
    : new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(time);
  return `${dateLabel}, ${timeLabel}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
