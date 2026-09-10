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
  elements.authOtpWrap.hidden = !(isSignupOtpStep || isForgotOtpStep);
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
  if (isMobileSignup && state.pendingSignupMobile) elements.authMobile.value = state.pendingSignupMobile;
  if ((isForgotOtpStep || isForgotPasswordStep) && state.pendingForgotEmail) {
    elements.authEmail.value = state.pendingForgotEmail;
  }

  if (isSignupDetailsStep) {
    elements.authTitle.textContent = 'Create your account';
    elements.authSubmitBtn.textContent = 'Send Signup OTP';
  } else if (isSignupOtpStep) {
    elements.authTitle.textContent = 'Verify signup OTP';
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
        const mobile = elements.authMobile.value.trim();
        if (!mobile) {
          elements.authError.textContent = 'Mobile number is required.';
          return;
        }
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
            mobile: state.pendingSignupMobile || elements.authMobile.value.trim(),
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

  elements.sendWhatsappOtpBtn?.addEventListener('click', async () => {
    const mobile = `${elements.mobileAuthCountry?.value || '+91'}${elements.mobileAuthNumber.value.replace(/\D/g, '')}`;
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
      elements.authError.textContent = error.message || 'Unable to send WhatsApp OTP.';
    } finally {
      elements.sendWhatsappOtpBtn.disabled = false;
    }
  });

  elements.verifyWhatsappOtpBtn?.addEventListener('click', async () => {
    if (!whatsappOtpSent) return;
    const mobile = `${elements.mobileAuthCountry?.value || '+91'}${elements.mobileAuthNumber.value.replace(/\D/g, '')}`;
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
