'use strict';

function resolveApiUrl() {
  const configuredWindowValue =
    typeof window !== 'undefined' ? String(window.__API_URL__ || '').trim() : '';
  const configuredMetaValue =
    typeof document !== 'undefined'
      ? String(document.querySelector('meta[name="api-base-url"]')?.content || '').trim()
      : '';
  const hostname = typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

  if (configuredWindowValue) return configuredWindowValue;
  if (isLocalHost) return '';
  return configuredMetaValue || '';
}

const API_URL = resolveApiUrl();

function buildApiUrl(url = '') {
  const normalized = String(url || '').trim();
  if (!normalized) return API_URL || window.location.origin;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const apiBase = API_URL || window.location.origin;
  return `${apiBase}${normalized}`;
}

function getReturnTo() {
  const params = new URLSearchParams(window.location.search || '');
  const candidate = String(params.get('returnTo') || '').trim();
  if (!candidate) return '/merch/';
  if (!candidate.startsWith('/')) return '/merch/';
  return candidate;
}

const ADMIN_LOGIN_EMAIL = 'admin@h2health.local';

function isAdminLoginIdentity(value) {
  return String(value || '').trim().toLowerCase() === ADMIN_LOGIN_EMAIL;
}

function getPhoneErrorMessage(countryCode = '+91') {
  if (countryCode === '+91') return 'Enter a valid 10-digit mobile number for India.';
  if (countryCode === '+1') return 'Enter a valid 10-digit mobile number for US/Canada.';
  if (countryCode === '+44') return 'Enter a valid UK mobile number.';
  return 'Enter a valid mobile number with country code.';
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

function parseAuthPhone(value = '') {
  const raw = String(value || '').trim();
  if (raw.startsWith('+')) {
    if (raw.startsWith('+91')) return { countryCode: '+91', localNumber: raw.slice(3).replace(/\D+/g, '') };
    if (raw.startsWith('+44')) return { countryCode: '+44', localNumber: raw.slice(3).replace(/\D+/g, '') };
    if (raw.startsWith('+1')) return { countryCode: '+1', localNumber: raw.slice(2).replace(/\D+/g, '') };
    if (raw.startsWith('+971')) return { countryCode: '+971', localNumber: raw.slice(4).replace(/\D+/g, '') };
    if (raw.startsWith('+65')) return { countryCode: '+65', localNumber: raw.slice(3).replace(/\D+/g, '') };
    if (raw.startsWith('+61')) return { countryCode: '+61', localNumber: raw.slice(3).replace(/\D+/g, '') };
    const match = raw.match(/^\+(\d{1,4})(\d+)$/);
    if (match) return { countryCode: `+${match[1]}`, localNumber: match[2] };
  }
  const digits = raw.replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return { countryCode: '+91', localNumber: digits.slice(2) };
  if (digits.length === 11 && digits.startsWith('1')) return { countryCode: '+1', localNumber: digits.slice(1) };
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('44')) return { countryCode: '+44', localNumber: digits.slice(2) };
  return { countryCode: '+91', localNumber: digits };
}

function formatE164Phone(phone = '', countryCode = '+91') {
  const trimmed = String(phone || '').trim();
  if (!trimmed) return '';
  const prefix = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;

  let digits = trimmed.replace(/\D+/g, '');
  if (trimmed.startsWith('+')) {
    const rawNoPlus = trimmed.slice(1).replace(/\D+/g, '');
    const prefixDigits = prefix.replace(/\D+/g, '');
    if (rawNoPlus.startsWith(prefixDigits)) {
      digits = rawNoPlus.slice(prefixDigits.length);
    } else if (rawNoPlus.startsWith('91') && rawNoPlus.length === 12) {
      digits = rawNoPlus.slice(2);
    } else if (rawNoPlus.startsWith('1') && rawNoPlus.length === 11) {
      digits = rawNoPlus.slice(1);
    } else if (rawNoPlus.startsWith('44')) {
      digits = rawNoPlus.slice(2);
    } else {
      digits = rawNoPlus;
    }
  } else {
    if (prefix === '+1' && digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    } else if (prefix === '+91' && digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (prefix === '+44' && (digits.length === 12 || digits.length === 11) && digits.startsWith('44')) {
      digits = digits.slice(2);
    }
  }

  if (prefix === '+44' && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return `${prefix}${digits}`;
}

function getPostAuthRedirectTarget({ email = '', user = null } = {}) {
  if (isAdminLoginIdentity(email) || isAdminLoginIdentity(user?.email) || String(user?.role || '').toLowerCase() === 'admin') {
    return '/merch/admin/index.html';
  }

  return getReturnTo();
}

function api(path, options = {}) {
  return fetch(buildApiUrl(path), {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  }).then(async (response) => {
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
  });
}

const elements = {
  authCard: document.getElementById('authCard'),
  authTitle: document.getElementById('authTitle'),
  authSwitchText: document.getElementById('authSwitchText'),
  authSwitchBtn: document.getElementById('authSwitchBtn'),
  authForm: document.getElementById('authForm'),
  signupIdentityChooser: document.getElementById('signupIdentityChooser'),
  signupEmailOption: document.getElementById('signupEmailOption'),
  signupMobileOption: document.getElementById('signupMobileOption'),
  authNameWrap: document.getElementById('authNameWrap'),
  authName: document.getElementById('authName'),
  authMobileWrap: document.getElementById('authMobileWrap'),
  authMobileCountry: document.getElementById('authMobileCountry'),
  authMobile: document.getElementById('authMobile'),
  authRoleWrap: document.getElementById('authRoleWrap'),
  authRole: document.getElementById('authRole'),
  authEmail: document.getElementById('authEmail'),
  authEmailWrap: document.getElementById('authEmailWrap'),
  authPassword: document.getElementById('authPassword'),
  authOtpWrap: document.getElementById('authOtpWrap'),
  authOtp: document.getElementById('authOtp'),
  authWhatsappOtpWrap: document.getElementById('authWhatsappOtpWrap'),
  authWhatsappOtp: document.getElementById('authWhatsappOtp'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  mobileAuthSection: document.getElementById('mobileAuthSection'),
  mobileAuthCountry: document.getElementById('mobileAuthCountry'),
  mobileAuthNumber: document.getElementById('mobileAuthNumber'),
  sendWhatsappOtpBtn: document.getElementById('sendWhatsappOtpBtn'),
  mobileAuthOtpWrap: document.getElementById('mobileAuthOtpWrap'),
  mobileAuthOtp: document.getElementById('mobileAuthOtp'),
  verifyWhatsappOtpBtn: document.getElementById('verifyWhatsappOtpBtn'),
  authError: document.getElementById('authError'),
  forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
  authBackToChoicesBtn: document.getElementById('authBackToChoicesBtn'),
  authPasswordToggleBtn: document.getElementById('authPasswordToggleBtn'),
  authOtpActions: document.getElementById('authOtpActions'),
  authResendOtpBtn: document.getElementById('authResendOtpBtn'),
  authResendOtpHint: document.getElementById('authResendOtpHint'),
  authDivider: document.getElementById('authDivider'),
  googleAuthBtn: document.getElementById('googleAuthBtn'),
};

const state = {
  registerMode: false,
  forgotMode: false,
  signupStage: 'details',
  signupMethod: 'email',
  forgotStage: 'email',
  pendingSignupName: '',
  pendingSignupEmail: '',
  pendingSignupMobile: '',
  pendingForgotEmail: '',
  signupOtpResendAvailableAt: 0,
  forgotOtpResendAvailableAt: 0,
};

let authOtpResendTicker = 0;
let whatsappOtpSent = false;

function stopAuthOtpResendTicker() {
  if (!authOtpResendTicker) return;
  clearInterval(authOtpResendTicker);
  authOtpResendTicker = 0;
}

function updateAuthOtpResendUI() {
  if (!elements.authOtpActions || !elements.authResendOtpBtn || !elements.authResendOtpHint) return;

  const isSignupOtpStep = state.registerMode && state.signupStage === 'otp';
  const isForgotOtpStep = !state.registerMode && state.forgotMode && state.forgotStage === 'otp';
  const shouldShow = isSignupOtpStep || isForgotOtpStep;

  elements.authOtpActions.hidden = !shouldShow;
  if (!shouldShow) {
    elements.authResendOtpHint.hidden = true;
    elements.authResendOtpHint.textContent = '';
    stopAuthOtpResendTicker();
    return;
  }

  if (!authOtpResendTicker) {
    authOtpResendTicker = window.setInterval(() => {
      updateAuthOtpResendUI();
    }, 250);
  }

  const availableAt = isSignupOtpStep ? state.signupOtpResendAvailableAt : state.forgotOtpResendAvailableAt;
  const remainingMs = availableAt - Date.now();
  const remainingSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const canResend = remainingSeconds <= 0;

  elements.authResendOtpBtn.disabled = !canResend;
  if (canResend) {
    elements.authResendOtpHint.hidden = true;
    elements.authResendOtpHint.textContent = '';
    return;
  }

  elements.authResendOtpHint.hidden = false;
  elements.authResendOtpHint.textContent = `Resend available in ${remainingSeconds}s`;
}

function applyAuthOtpResendCooldown({ isSignup, retryAfterSeconds } = {}) {
  const seconds = Number.isFinite(Number(retryAfterSeconds)) && Number(retryAfterSeconds) > 0
    ? Number(retryAfterSeconds)
    : 30;
  const nextAvailableAt = Date.now() + seconds * 1000;
  if (isSignup) {
    state.signupOtpResendAvailableAt = nextAvailableAt;
  } else {
    state.forgotOtpResendAvailableAt = nextAvailableAt;
  }
  updateAuthOtpResendUI();
}

function toggleAuthPasswordVisibility() {
  const input = elements.authPassword;
  const toggleBtn = elements.authPasswordToggleBtn;
  if (!input || !toggleBtn) return;

  const selectionStart = input.selectionStart;
  const selectionEnd = input.selectionEnd;
  const shouldShow = input.type === 'password';
  input.type = shouldShow ? 'text' : 'password';
  const isVisible = input.type === 'text';
  const actionLabel = isVisible ? 'Hide password' : 'Show password';

  toggleBtn.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
  toggleBtn.setAttribute('aria-label', actionLabel);

  const toggleText = toggleBtn.querySelector('.password-toggle-text');
  if (toggleText) toggleText.textContent = actionLabel;

  if (typeof selectionStart === 'number' && typeof selectionEnd === 'number') {
    try {
      input.setSelectionRange(selectionStart, selectionEnd);
    } catch {
      // ignore selection restore errors
    }
  }

  input.focus();
}

function renderAuthMode(preserveMessage = false) {
  if (!preserveMessage) elements.authError.textContent = '';

  const isSignupDetailsStep = state.registerMode && state.signupStage === 'details';
  const isSignupOtpStep = state.registerMode && state.signupStage === 'otp';
  const isSignupPasswordStep = state.registerMode && state.signupStage === 'password';
  const isForgotEmailStep = !state.registerMode && state.forgotMode && state.forgotStage === 'email';
  const isForgotOtpStep = !state.registerMode && state.forgotMode && state.forgotStage === 'otp';
  const isForgotPasswordStep = !state.registerMode && state.forgotMode && state.forgotStage === 'password';
  const isLoginStep = !state.registerMode && !state.forgotMode;
  const isEmailSignup = state.registerMode && state.signupMethod === 'email';
  const isMobileSignup = state.registerMode && state.signupMethod === 'mobile';
  const authPasswordWrap = elements.authPassword?.closest?.('label') || elements.authPassword.parentElement;

  elements.authNameWrap.hidden = !isSignupDetailsStep;
  elements.signupIdentityChooser.hidden = !isSignupDetailsStep;
  elements.signupEmailOption.classList.toggle('is-active', isEmailSignup);
  elements.signupMobileOption.classList.toggle('is-active', isMobileSignup);
  elements.authEmailWrap.hidden = !isLoginStep && !isEmailSignup && !isForgotEmailStep && !isForgotOtpStep && !isForgotPasswordStep;
  elements.authMobileWrap.hidden = !isMobileSignup;
  elements.authRoleWrap.hidden = true;
  elements.authOtpWrap.hidden = !((isSignupOtpStep && isEmailSignup) || isForgotOtpStep);
  elements.authWhatsappOtpWrap.hidden = !(isSignupOtpStep && isMobileSignup);
  authPasswordWrap.hidden = !(isLoginStep || (isSignupPasswordStep && isEmailSignup) || isForgotPasswordStep);

  elements.authName.required = isSignupDetailsStep;
  elements.authMobile.required = isMobileSignup;
  elements.authEmail.required = isLoginStep || isEmailSignup || isForgotEmailStep || isForgotOtpStep || isForgotPasswordStep;
  elements.authPassword.required = isLoginStep || (isSignupPasswordStep && isEmailSignup) || isForgotPasswordStep;
  elements.authOtp.required = (isSignupOtpStep && isEmailSignup) || isForgotOtpStep;
  elements.authWhatsappOtp.required = isSignupOtpStep && isMobileSignup;
  elements.authEmail.readOnly = isSignupOtpStep || isSignupPasswordStep || isForgotOtpStep || isForgotPasswordStep;
  elements.mobileAuthSection.hidden = !isLoginStep;
  if (!isLoginStep) {
    whatsappOtpSent = false;
    elements.mobileAuthOtpWrap.hidden = true;
    elements.verifyWhatsappOtpBtn.hidden = true;
  }

  if (isEmailSignup && (isSignupOtpStep || isSignupPasswordStep) && state.pendingSignupEmail) {
    elements.authEmail.value = state.pendingSignupEmail;
  }
  if (isMobileSignup && state.pendingSignupMobile) {
    const parsed = parseAuthPhone(state.pendingSignupMobile);
    if (elements.authMobileCountry && parsed.countryCode) {
      elements.authMobileCountry.value = parsed.countryCode;
    }
    elements.authMobile.value = parsed.localNumber;
    elements.authMobile.readOnly = isSignupOtpStep;
    if (elements.authMobileCountry) elements.authMobileCountry.disabled = isSignupOtpStep;
  } else if (isMobileSignup) {
    elements.authMobile.readOnly = false;
    if (elements.authMobileCountry) elements.authMobileCountry.disabled = false;
  }
  if ((isForgotOtpStep || isForgotPasswordStep) && state.pendingForgotEmail) {
    elements.authEmail.value = state.pendingForgotEmail;
  }

  if (isSignupDetailsStep) {
    elements.authTitle.textContent = 'Create your account';
    elements.authSubmitBtn.textContent = 'Send Signup OTP';
  } else if (isSignupOtpStep) {
    elements.authTitle.textContent = isMobileSignup ? 'Verify WhatsApp signup OTP' : 'Verify signup OTP';
    elements.authSubmitBtn.textContent = 'Verify OTP';
  } else if (isSignupPasswordStep && isEmailSignup) {
    elements.authTitle.textContent = 'Set password';
    elements.authSubmitBtn.textContent = 'Complete Signup';
  } else if (isForgotEmailStep) {
    elements.authTitle.textContent = 'Forgot password';
    elements.authSubmitBtn.textContent = 'Send Reset OTP';
  } else if (isForgotOtpStep) {
    elements.authTitle.textContent = 'Verify reset OTP';
    elements.authSubmitBtn.textContent = 'Verify OTP';
  } else if (isForgotPasswordStep) {
    elements.authTitle.textContent = 'Set new password';
    elements.authSubmitBtn.textContent = 'Reset Password';
  } else {
    elements.authTitle.textContent = 'Sign in to continue';
    elements.authSubmitBtn.textContent = 'Sign in';
  }

  elements.authSwitchText.textContent = state.registerMode
    ? 'Already have an account?'
    : "Don't have an account?";
  elements.authSwitchBtn.textContent = state.registerMode ? 'Sign in' : 'Register';
  elements.forgotPasswordBtn.textContent = state.forgotMode ? 'Back to sign in' : 'Forgot password?';
  elements.forgotPasswordBtn.hidden = state.registerMode;

  if (elements.authDivider) elements.authDivider.hidden = true;
  if (elements.googleAuthBtn) elements.googleAuthBtn.hidden = true;

  updateAuthOtpResendUI();
}

function resetToLoginMode() {
  state.registerMode = false;
  state.forgotMode = false;
  state.signupStage = 'details';
  state.forgotStage = 'email';
  state.pendingSignupName = '';
  state.pendingSignupEmail = '';
  state.pendingSignupMobile = '';
  state.signupMethod = 'email';
  state.pendingForgotEmail = '';
  state.signupOtpResendAvailableAt = 0;
  state.forgotOtpResendAvailableAt = 0;
  elements.authForm.reset();
  elements.authEmail.readOnly = false;
  renderAuthMode();
}

function applySignupErrorMessage(error) {
  elements.authError.textContent = error?.message || 'Something went wrong. Please try again.';
}

async function resendAuthOtp() {
  const isSignupOtpStep = state.registerMode && state.signupStage === 'otp';
  const isForgotOtpStep = !state.registerMode && state.forgotMode && state.forgotStage === 'otp';
  if (!isSignupOtpStep && !isForgotOtpStep) return;

  const availableAt = isSignupOtpStep ? state.signupOtpResendAvailableAt : state.forgotOtpResendAvailableAt;
  if (availableAt && Date.now() < availableAt) return;

  elements.authResendOtpBtn.disabled = true;

  try {
    if (isSignupOtpStep) {
      const name = state.pendingSignupName || elements.authName.value.trim() || 'User';
      let result;
      if (state.signupMethod === 'mobile') {
        const mobile = state.pendingSignupMobile || elements.authMobile.value.trim();
        result = await api('/api/auth/signup/send-whatsapp-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile }),
        });
        state.pendingSignupMobile = mobile;
      } else {
        const email = state.pendingSignupEmail || elements.authEmail.value.trim();
        result = await api('/api/auth/register/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        state.pendingSignupEmail = email;
      }
      state.pendingSignupName = name;
      elements.authError.textContent = result.message || 'Signup OTP resent.';
      applyAuthOtpResendCooldown({ isSignup: true });
      renderAuthMode(true);
      return;
    }

    const email = state.pendingForgotEmail || elements.authEmail.value.trim();
    const result = await api('/api/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    state.pendingForgotEmail = email;
    elements.authError.textContent = result.message || 'Reset OTP resent.';
    applyAuthOtpResendCooldown({ isSignup: false });
    renderAuthMode(true);
  } catch (error) {
    const retryAfterSeconds = error?.data?.retryAfterSeconds;
    if (retryAfterSeconds) {
      applyAuthOtpResendCooldown({ isSignup: Boolean(isSignupOtpStep), retryAfterSeconds });
    }
    applySignupErrorMessage(error);
    updateAuthOtpResendUI();
  } finally {
    updateAuthOtpResendUI();
  }
}

async function finishAuthSuccess(result) {
  const token = String(result?.token || result?.authToken || '').trim();
  const user = result?.user || null;
  if (token) {
    try {
      window.localStorage?.setItem('booking_portal_auth_token', token);
    } catch {
      // Ignore storage issues.
    }
  }
  window.location.replace(getPostAuthRedirectTarget({ user }));
}

async function submitAuth() {
  elements.authError.textContent = '';

  try {
    if (!state.registerMode && !state.forgotMode) {
      const email = elements.authEmail.value.trim();
      const password = elements.authPassword.value;
      const result = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      elements.authForm.reset();
      if (isAdminLoginIdentity(email) || isAdminLoginIdentity(result?.user?.email) || String(result?.user?.role || '').toLowerCase() === 'admin') {
        window.location.replace('/merch/admin/index.html');
        return;
      }
      await finishAuthSuccess(result);
      return;
    }

    if (state.forgotMode) {
      if (state.forgotStage === 'email') {
        const email = elements.authEmail.value.trim();
        const result = await api('/api/auth/password/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        state.pendingForgotEmail = email;
        state.forgotStage = 'otp';
        applyAuthOtpResendCooldown({ isSignup: false });
        elements.authOtp.value = '';
        elements.authError.textContent = result.message || 'Password reset OTP sent.';
        renderAuthMode(true);
        return;
      }

      if (state.forgotStage === 'otp') {
        const otp = elements.authOtp.value.trim();
        const result = await api('/api/auth/password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: state.pendingForgotEmail || elements.authEmail.value.trim(),
            otp,
          }),
        });

        state.forgotStage = 'password';
        elements.authPassword.value = '';
        elements.authError.textContent = result.message || 'OTP verified. Set your new password.';
        renderAuthMode(true);
        return;
      }

      const password = elements.authPassword.value;
      const result = await api('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.pendingForgotEmail || elements.authEmail.value.trim(),
          password,
        }),
      });

      resetToLoginMode();
      elements.authError.textContent = result.message || 'Password reset successful. Please login.';
      return;
    }

    if (state.signupStage === 'details') {
      const name = elements.authName.value.trim();
      if (!name) {
        elements.authError.textContent = 'Name is required.';
        return;
      }
      state.pendingSignupName = name;
      let result;
      if (state.signupMethod === 'mobile') {
        const countryCode = elements.authMobileCountry?.value || '+91';
        const rawMobile = elements.authMobile.value.trim();
        if (!rawMobile) {
          elements.authError.textContent = 'Mobile number is required.';
          return;
        }
        if (!isValidPhoneNumber(rawMobile, countryCode)) {
          elements.authError.textContent = getPhoneErrorMessage(countryCode);
          return;
        }
        const mobile = formatE164Phone(rawMobile, countryCode);
        result = await api('/api/auth/signup/send-whatsapp-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobile }),
        });
        state.pendingSignupMobile = mobile;
      } else {
        const email = elements.authEmail.value.trim();
        if (!email) {
          elements.authError.textContent = 'Email is required.';
          return;
        }
        result = await api('/api/auth/register/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });
        state.pendingSignupEmail = email;
      }
      state.signupStage = 'otp';
      applyAuthOtpResendCooldown({ isSignup: true });
      elements.authOtp.value = '';
      elements.authWhatsappOtp.value = '';
      elements.authError.textContent = result.message || 'Signup OTP sent.';
      renderAuthMode(true);
      return;
    }

    if (state.signupStage === 'otp') {
      if (state.signupMethod === 'mobile') {
        const result = await api('/api/auth/signup/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: state.pendingSignupName || elements.authName.value.trim(),
            mobile: state.pendingSignupMobile || formatE164Phone(elements.authMobile.value.trim(), elements.authMobileCountry?.value || '+91'),
            otp: elements.authWhatsappOtp.value.trim(),
          }),
        });
        state.signupStage = 'details';
        state.pendingSignupName = '';
        state.pendingSignupMobile = '';
        state.signupOtpResendAvailableAt = 0;
        elements.authForm.reset();
        await finishAuthSuccess(result);
        return;
      }

      const otp = elements.authOtp.value.trim();
      const result = await api('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: state.pendingSignupEmail || elements.authEmail.value.trim(),
          otp,
        }),
      });

      state.signupStage = 'password';
      elements.authPassword.value = '';
      elements.authError.textContent = result.message || 'OTP verified. Set your password.';
      renderAuthMode(true);
      return;
    }

    const password = elements.authPassword.value;
    const result = await api('/api/auth/register/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: state.pendingSignupEmail || elements.authEmail.value.trim(),
        password,
      }),
    });

    state.signupStage = 'details';
    state.pendingSignupName = '';
    state.pendingSignupEmail = '';
    state.pendingSignupMobile = '';
    state.signupMethod = 'email';
    state.signupOtpResendAvailableAt = 0;
    elements.authForm.reset();
    await finishAuthSuccess(result);
  } catch (error) {
    applySignupErrorMessage(error);
  }
}

async function loadCurrentUser() {
  try {
    const result = await api('/api/auth/me');
    window.location.replace(getPostAuthRedirectTarget({ user: result?.user || null }));
  } catch {
    // Anonymous shopper, stay on auth page.
  }
}

function bindEvents() {
  elements.authForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuth();
  });

  elements.authSwitchBtn?.addEventListener('click', () => {
    state.registerMode = !state.registerMode;
    state.forgotMode = false;
    state.signupStage = 'details';
    state.signupMethod = 'email';
    state.forgotStage = 'email';
    state.pendingSignupName = '';
    state.pendingSignupEmail = '';
    state.pendingSignupMobile = '';
    state.pendingForgotEmail = '';
    renderAuthMode();
  });

  const chooseSignupMethod = (method) => {
    state.signupMethod = method === 'mobile' ? 'mobile' : 'email';
    state.signupStage = 'details';
    state.pendingSignupEmail = '';
    state.pendingSignupMobile = '';
    elements.authOtp.value = '';
    elements.authWhatsappOtp.value = '';
    renderAuthMode();
  };
  elements.signupEmailOption?.addEventListener('click', () => chooseSignupMethod('email'));
  elements.signupMobileOption?.addEventListener('click', () => chooseSignupMethod('mobile'));

  elements.forgotPasswordBtn?.addEventListener('click', () => {
    state.registerMode = false;
    state.forgotMode = !state.forgotMode;
    state.signupStage = 'details';
    state.signupMethod = 'email';
    state.forgotStage = 'email';
    state.pendingSignupName = '';
    state.pendingSignupEmail = '';
    state.pendingSignupMobile = '';
    state.pendingForgotEmail = '';
    renderAuthMode();
  });

  elements.authBackToChoicesBtn?.addEventListener('click', () => {
    window.location.href = '/merch/';
  });

  elements.authPasswordToggleBtn?.addEventListener('click', toggleAuthPasswordVisibility);
  elements.authResendOtpBtn?.addEventListener('click', resendAuthOtp);

  elements.authMobileCountry?.addEventListener('change', () => {
    const code = elements.authMobileCountry.value;
    const maxDigits = (code === '+91' || code === '+1') ? 10 : 15;
    elements.authMobile.maxLength = maxDigits;
    elements.authMobile.placeholder = (code === '+91' || code === '+1') ? '10-digit mobile number' : 'Mobile number';
    elements.authMobile.value = elements.authMobile.value.replace(/\D/g, '').slice(0, maxDigits);
  });

  elements.mobileAuthCountry?.addEventListener('change', () => {
    const code = elements.mobileAuthCountry.value;
    const maxDigits = (code === '+91' || code === '+1') ? 10 : 15;
    elements.mobileAuthNumber.maxLength = maxDigits;
    elements.mobileAuthNumber.placeholder = (code === '+91' || code === '+1') ? '10-digit mobile number' : 'Mobile number';
    elements.mobileAuthNumber.value = elements.mobileAuthNumber.value.replace(/\D/g, '').slice(0, maxDigits);
  });

  elements.mobileAuthNumber?.addEventListener('input', (e) => {
    const code = elements.mobileAuthCountry?.value || '+91';
    const maxDigits = (code === '+91' || code === '+1') ? 10 : 15;
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
  });

  elements.authMobile?.addEventListener('input', (e) => {
    const code = elements.authMobileCountry?.value || '+91';
    const maxDigits = (code === '+91' || code === '+1') ? 10 : 15;
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
  });

  elements.authName?.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, '');
  });

  elements.sendWhatsappOtpBtn?.addEventListener('click', async () => {
    const countryCode = elements.mobileAuthCountry?.value || '+91';
    const rawNumber = elements.mobileAuthNumber.value.trim();
    if (!rawNumber) {
      elements.authError.textContent = 'Mobile number is required.';
      return;
    }
    if (!isValidPhoneNumber(rawNumber, countryCode)) {
      elements.authError.textContent = getPhoneErrorMessage(countryCode);
      return;
    }
    const mobile = formatE164Phone(rawNumber, countryCode);
    elements.authError.textContent = '';
    elements.sendWhatsappOtpBtn.disabled = true;
    try {
      const result = await api('/api/auth/send-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      whatsappOtpSent = true;
      elements.mobileAuthOtp.value = '';
      elements.mobileAuthOtpWrap.hidden = false;
      elements.verifyWhatsappOtpBtn.hidden = false;
      elements.authError.textContent = result.message || 'WhatsApp OTP sent.';
      elements.mobileAuthOtp.focus();
    } catch (error) {
      if (String(error.message || '').toLowerCase().includes('account not found')) {
        elements.authError.textContent = 'Account not found. Please click "Sign up" below to register with your mobile number first.';
      } else {
        elements.authError.textContent = error.message || 'Unable to send WhatsApp OTP.';
      }
    } finally {
      elements.sendWhatsappOtpBtn.disabled = false;
    }
  });

  elements.verifyWhatsappOtpBtn?.addEventListener('click', async () => {
    if (!whatsappOtpSent) return;
    const countryCode = elements.mobileAuthCountry?.value || '+91';
    const mobile = formatE164Phone(elements.mobileAuthNumber.value.trim(), countryCode);
    const otp = elements.mobileAuthOtp.value.trim();
    elements.authError.textContent = '';
    elements.verifyWhatsappOtpBtn.disabled = true;
    try {
      const result = await api('/api/auth/verify-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, otp }),
      });
      elements.authForm.reset();
      whatsappOtpSent = false;
      await finishAuthSuccess(result);
    } catch (error) {
      elements.authError.textContent = error.message || 'Unable to verify WhatsApp OTP.';
    } finally {
      elements.verifyWhatsappOtpBtn.disabled = false;
    }
  });
}

function init() {
  bindEvents();
  renderAuthMode();
  loadCurrentUser();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
