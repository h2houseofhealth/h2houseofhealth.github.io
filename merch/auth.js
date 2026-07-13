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
  authNameWrap: document.getElementById('authNameWrap'),
  authName: document.getElementById('authName'),
  authRoleWrap: document.getElementById('authRoleWrap'),
  authRole: document.getElementById('authRole'),
  authEmail: document.getElementById('authEmail'),
  authPassword: document.getElementById('authPassword'),
  authOtpWrap: document.getElementById('authOtpWrap'),
  authOtp: document.getElementById('authOtp'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authError: document.getElementById('authError'),
  forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),
  authBackToChoicesBtn: document.getElementById('authBackToChoicesBtn'),
  authPasswordToggleBtn: document.getElementById('authPasswordToggleBtn'),
  authDevOtp: document.getElementById('authDevOtp'),
  authDevOtpValue: document.getElementById('authDevOtpValue'),
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
  forgotStage: 'email',
  pendingSignupName: '',
  pendingSignupEmail: '',
  pendingForgotEmail: '',
  signupOtpResendAvailableAt: 0,
  forgotOtpResendAvailableAt: 0,
};

let authOtpResendTicker = 0;

function showDevelopmentOtp(otp = '') {
  if (!elements.authDevOtp || !elements.authDevOtpValue) return;
  const value = String(otp || '').trim();
  elements.authDevOtpValue.textContent = value;
  elements.authDevOtp.hidden = !value;
}

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
  const authPasswordWrap = elements.authPassword?.closest?.('label') || elements.authPassword.parentElement;

  elements.authNameWrap.hidden = !isSignupDetailsStep;
  elements.authRoleWrap.hidden = true;
  elements.authOtpWrap.hidden = !(isSignupOtpStep || isForgotOtpStep);
  if (!(isSignupOtpStep || isForgotOtpStep)) showDevelopmentOtp('');
  authPasswordWrap.hidden = !(isLoginStep || isSignupPasswordStep || isForgotPasswordStep);

  elements.authName.required = isSignupDetailsStep;
  elements.authPassword.required = isLoginStep || isSignupPasswordStep || isForgotPasswordStep;
  elements.authOtp.required = isSignupOtpStep || isForgotOtpStep;
  elements.authEmail.readOnly = isSignupOtpStep || isSignupPasswordStep || isForgotOtpStep || isForgotPasswordStep;

  if ((isSignupOtpStep || isSignupPasswordStep) && state.pendingSignupEmail) {
    elements.authEmail.value = state.pendingSignupEmail;
  }
  if ((isForgotOtpStep || isForgotPasswordStep) && state.pendingForgotEmail) {
    elements.authEmail.value = state.pendingForgotEmail;
  }

  if (isSignupDetailsStep) {
    elements.authTitle.textContent = 'Create your account';
    elements.authSubmitBtn.textContent = 'Send Signup OTP';
  } else if (isSignupOtpStep) {
    elements.authTitle.textContent = 'Verify signup OTP';
    elements.authSubmitBtn.textContent = 'Verify OTP';
  } else if (isSignupPasswordStep) {
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
      const email = state.pendingSignupEmail || elements.authEmail.value.trim();
      const name = state.pendingSignupName || elements.authName.value.trim() || 'User';
      const result = await api('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      state.pendingSignupEmail = email;
      state.pendingSignupName = name;
      showDevelopmentOtp(result.devOtp);
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
    showDevelopmentOtp(result.devOtp);
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
  if (token) {
    try {
      window.localStorage?.setItem('booking_portal_auth_token', token);
    } catch {
      // Ignore storage issues.
    }
  }
  window.location.replace(getReturnTo());
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
        showDevelopmentOtp(result.devOtp);
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
      const email = elements.authEmail.value.trim();
      if (!name) {
        elements.authError.textContent = 'Name is required.';
        return;
      }

      const result = await api('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      state.pendingSignupName = name;
      state.pendingSignupEmail = email;
      state.signupStage = 'otp';
      applyAuthOtpResendCooldown({ isSignup: true });
      elements.authOtp.value = '';
      showDevelopmentOtp(result.devOtp);
      elements.authError.textContent = result.message || 'Signup OTP sent.';
      renderAuthMode(true);
      return;
    }

    if (state.signupStage === 'otp') {
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
    state.signupOtpResendAvailableAt = 0;
    elements.authForm.reset();
    await finishAuthSuccess(result);
  } catch (error) {
    applySignupErrorMessage(error);
  }
}

async function loadCurrentUser() {
  try {
    await api('/api/auth/me');
    window.location.replace(getReturnTo());
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
    state.forgotStage = 'email';
    state.pendingSignupName = '';
    state.pendingSignupEmail = '';
    state.pendingForgotEmail = '';
    renderAuthMode();
  });

  elements.forgotPasswordBtn?.addEventListener('click', () => {
    state.registerMode = false;
    state.forgotMode = !state.forgotMode;
    state.signupStage = 'details';
    state.forgotStage = 'email';
    state.pendingSignupName = '';
    state.pendingSignupEmail = '';
    state.pendingForgotEmail = '';
    renderAuthMode();
  });

  elements.authBackToChoicesBtn?.addEventListener('click', () => {
    window.location.href = '/merch/';
  });

  elements.authPasswordToggleBtn?.addEventListener('click', toggleAuthPasswordVisibility);
  elements.authResendOtpBtn?.addEventListener('click', resendAuthOtp);
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
