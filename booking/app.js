function resolveApiUrl() {
  const configuredWindowValue =
    typeof window !== 'undefined' ? String(window.__API_URL__ || '').trim() : '';
  const configuredMetaValue =
    typeof document !== 'undefined'
      ? String(document.querySelector('meta[name="api-base-url"]')?.content || '').trim()
      : '';
  const hostname = typeof window !== 'undefined' ? String(window.location.hostname || '').trim().toLowerCase() : '';
  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1';

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

const AUTH_TOKEN_STORAGE_KEY = 'booking_portal_auth_token';

function getStoredAuthToken() {
  try {
    return String(window.localStorage?.getItem(AUTH_TOKEN_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function storeAuthToken(token = '') {
  const normalized = String(token || '').trim();
  state.authToken = normalized;
  try {
    if (normalized) {
      window.localStorage?.setItem(AUTH_TOKEN_STORAGE_KEY, normalized);
    } else {
      window.localStorage?.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Local storage can be unavailable in private or embedded browsing contexts.
  }
}

function consumeOAuthTokenFromHash() {
  const rawHash = String(window.location.hash || '').replace(/^#/, '');
  if (!rawHash) return false;

  const params = new URLSearchParams(rawHash);
  const token = params.get('auth_token');
  if (!token) return false;

  storeAuthToken(token);
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return true;
}

function withApiCredentials(options = {}) {
  const headers = new Headers(options.headers || {});
  const authToken = String(state.authToken || '').trim();
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }
  return {
    credentials: 'include',
    ...options,
    headers,
  };
}
const state = {
  user: null,
  authToken: getStoredAuthToken(),
  bookings: [],
  services: [],
  adminMembershipOrders: [],
  userMembershipOrders: [],
  adminDiscountPhones: [],
  adminUsers: [],
  adminCoupons: [],
  generalCoupons: {
    services: [],
    membership: [],
  },
  adminSelectedUserId: null,
  adminUserSessionFilter: 'all',
  adminResolvedCustomer: null,
  adminCustomerForm: {
    name: '',
    email: '',
    phone: '',
  },
  postLoginChoice: '',
  pendingPreAuthChoice: '',
  showAuthCard: false,
  activeUserTab: 'services',
  servicesBackTargetTab: '',
  userBookingsFilter: 'all',
  memberSessionDisplayCount: 0,
  adminActiveTab: 'calendar',
  adminPendingBookingSearch: '',
  adminAllBookingSearch: '',
  adminAllBookingViewMode: 'history',
  adminPendingBookingDateFilters: {
    startDate: '',
    endDate: '',
  },
  adminAllBookingDateFilters: {
    startDate: '',
    endDate: '',
  },
  adminAllBookingSlotFilters: {
    date: '',
    time: '',
  },
  adminRescheduleSearch: '',
  adminRescheduleSelections: {},
  adminRescheduleAvailability: {},
  adminRescheduleLoading: {},
  adminRescheduleOtpRequested: {},
  adminRescheduleDateFilter: '',
  adminRescheduleSlotFilter: '',
  adminRescheduleView: 'queue',
  returnUserTabAfterEdit: '',
  membership: {
    plans: [],
    active: false,
    current: null,
  },
  membershipBrowseVisible: false,
  membershipAdditions: {},
  membershipCheckout: null,
  membershipCouponPreview: null,
  membershipRoster: null,
  cartCouponCode: '',
  cartCouponPreview: null,
  cart: [],
  guestCheckout: {
    isActive: false,
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    formErrors: {},
  },
  isGuestUser: false,
  guestSessionToken: null,
  ivSelections: {},
  selectedServiceCategory: null,
  selectedSingleSessionServiceName: '',
  singleSessionEditingBookingId: '',
  selectedHydrogenServiceName: '',
  selectedHydrogenFlow: 'topup',
  selectedHydrogenExtraSessions: 0,
  selectedHydrogenSlots: [],
  selectedHydrogenAddOnServiceName: '',
  selectedHydrogenAddOnSessionIndex: 0,
  focusHydrogenAddOnScheduler: false,
  hydrogenComposerNotice: {
    message: '',
    type: '',
  },
  hydrogenEditingGroupId: '',
  activeHydrogenSessionIndex: 0,
  activeHydrogenSessionDate: '',
  activeHydrogenSessionTime: '',
  selectedServiceDate: '',
  selectedBookingAddOnServiceName: '',
  bookingDialogContext: {
    membershipEdit: false,
    lockedServiceName: '',
    existingAddOnBooking: null,
    addOnScheduleManuallyEdited: false,
    defaultAddOnBookingDate: '',
    defaultAddOnBookingTime: '',
    hydrogenAddOnSlots: [],
  },
  slotAvailability: {},
  slotCapacityByService: {},
  slotHoldCounts: {},
  bookingHoldMinutes: 10,
  slotAvailabilityLoading: false,
  slotAutoShiftedNotice: '',
  adminDiscountUnlocked: false,
  adminDiscountSearch: '',
  adminDiscountDropdownOpen: false,
  adminDiscountSearchResults: [],
  adminDiscountSearchLoading: false,
  adminDiscountSelectedUsers: [],
  adminDiscountSelectedWindowOpen: false,
  adminBookingNotesByBooking: {},
  adminBookingNotesLoading: false,
  adminBookingNoteEdits: {},
  adminBookingEmailEventsByBooking: {},
  adminBookingEmailAnalyticsByBooking: {},
  adminBookingEmailTimelineLoading: false,
  adminPaymentLinkAnalytics: null,
  adminPaymentLinkAnalyticsRows: [],
  adminEmailAnalyticsFilters: {
    startDate: '',
    endDate: '',
  },
  adminBookingEmailEventsByBooking: {},
  adminBookingEmailAnalyticsByBooking: {},
  adminBookingEmailTimelineLoading: false,
  adminPaymentLinkAnalytics: null,
  adminPaymentLinkAnalyticsRows: [],
  adminEmailAnalyticsFilters: {
    startDate: '',
    endDate: '',
  },
  adminCalendarDate: '',
  adminCalendarCategory: 'HYDROGEN SESSION',
  adminCalendarServiceName: '',
  adminCalendarAvailability: {},
  adminCalendarHoldCounts: {},
  adminCalendarCapacityByService: {},
  adminCalendarLoading: false,
  adminCalendarError: '',
  adminCalendarMonth: '',
  adminCalendarMonthLoading: false,
  adminCalendarDayCache: {},
  filters: {
    search: '',
    status: 'all',
    date: '',
  },
  serviceDetailSelections: {},
};

function normalizeTenDigitMobile(value = '') {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  if (!digitsOnly) return '';
  if (digitsOnly.length <= 10) return digitsOnly;
  return digitsOnly.slice(-10);
}

function enforceTenDigitMobileInput(input) {
  if (!input) return;
  try {
    input.maxLength = 10;
    input.inputMode = 'numeric';
    input.autocomplete = 'tel';
    input.pattern = '\\d{10}';
  } catch {
    // Ignore attribute assignment failures.
  }
  input.addEventListener('input', (event) => {
    const target = event?.target;
    if (!target) return;
    const normalized = normalizeTenDigitMobile(target.value);
    if (target.value !== normalized) target.value = normalized;
  });
}

const adminRescheduleSearchPlaceholderQuery = window.matchMedia
  ? window.matchMedia('(max-width: 600px)')
  : null;

function syncAdminRescheduleSearchPlaceholder() {
  const input = elements.adminRescheduleSearch;
  if (!input) return;

  const desktopPlaceholder = String(input.dataset.placeholderDesktop || input.placeholder || '').trim();
  const mobilePlaceholder = String(input.dataset.placeholderMobile || desktopPlaceholder).trim();
  const nextPlaceholder = adminRescheduleSearchPlaceholderQuery?.matches
    ? mobilePlaceholder
    : desktopPlaceholder;

  if (nextPlaceholder && input.placeholder !== nextPlaceholder) {
    input.placeholder = nextPlaceholder;
  }
}

function syncAdminCustomerFieldsToUi() {
  if (elements.adminCustomerName) elements.adminCustomerName.value = state.adminCustomerForm.name || '';
  if (elements.adminCustomerEmail) elements.adminCustomerEmail.value = state.adminCustomerForm.email || '';
  if (elements.adminCustomerPhone) elements.adminCustomerPhone.value = state.adminCustomerForm.phone || '';
  if (elements.adminCalendarCustomerName) elements.adminCalendarCustomerName.value = state.adminCustomerForm.name || '';
  if (elements.adminCalendarCustomerEmail) elements.adminCalendarCustomerEmail.value = state.adminCustomerForm.email || '';
  if (elements.adminCalendarCustomerPhone) elements.adminCalendarCustomerPhone.value = state.adminCustomerForm.phone || '';
}

function closeAdminCalendarCustomerDialog() {
  pendingAdminCalendarBookingAction = null;
  try {
    elements.adminCalendarCustomerDialog?.close?.();
  } catch {
    elements.adminCalendarCustomerDialog?.removeAttribute?.('open');
  }
}

function openAdminCalendarCustomerDialog(onConfirmBooking) {
  if (!elements.adminCalendarCustomerDialog) {
    showNotice({ title: 'Notice', body: 'Enter customer name, email, and contact number first.' });
    return;
  }
  pendingAdminCalendarBookingAction = typeof onConfirmBooking === 'function' ? onConfirmBooking : null;
  if (elements.adminCalendarModalCustomerName) {
    elements.adminCalendarModalCustomerName.value = String(state.adminCustomerForm.name || '');
  }
  if (elements.adminCalendarModalCustomerEmail) {
    elements.adminCalendarModalCustomerEmail.value = String(state.adminCustomerForm.email || '');
  }
  if (elements.adminCalendarModalCustomerPhone) {
    elements.adminCalendarModalCustomerPhone.value = String(state.adminCustomerForm.phone || '');
  }
  if (typeof elements.adminCalendarCustomerDialog.showModal === 'function') {
    elements.adminCalendarCustomerDialog.showModal();
  } else {
    elements.adminCalendarCustomerDialog.setAttribute('open', 'open');
  }
}

function normalizeSlotStartTime(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (SLOT_OPTIONS.some((slot) => slot.value === normalized)) return normalized;

  const legacyMatch = normalized.match(/^(\d{2}):30$/);
  if (legacyMatch) {
    const candidate = `${legacyMatch[1]}:00`;
    if (SLOT_OPTIONS.some((slot) => slot.value === candidate)) return candidate;
  }

  return normalized;
}

const SLOT_OPTIONS = [
  { value: '10:00', label: '10:00 AM - 11:00 AM' },
  { value: '11:00', label: '11:00 AM - 12:00 PM' },
  { value: '12:00', label: '12:00 PM - 1:00 PM' },
  { value: '13:00', label: '1:00 PM - 2:00 PM' },
  { value: '14:00', label: '2:00 PM - 3:00 PM' },
  { value: '15:00', label: '3:00 PM - 4:00 PM' },
  { value: '16:00', label: '4:00 PM - 5:00 PM' },
  { value: '17:00', label: '5:00 PM - 6:00 PM' },
  { value: '18:00', label: '6:00 PM - 7:00 PM' },
  { value: '19:00', label: '7:00 PM - 8:00 PM' },
];
const BOOKING_WINDOW_DAYS = 365;
const IV_REBOOK_COOLDOWN_DAYS = 14;
const MAX_HYDROGEN_SESSIONS_PER_DAY_PER_USER = 4;
const BOOKING_HOLD_MINUTES = 10;
const HYDROGEN_SLOT_CAPACITY_PER_TIME_SLOT = 8;
const HYDROGEN_FREE_SESSIONS_PER_USER = 16;
const ADMIN_USER_CARD_DEFAULT_LIMIT = 10;
const ADMIN_USER_CARD_LARGE_DATASET_THRESHOLD = 300;
const AUTH_OTP_RESEND_COOLDOWN_MS = 30_000;
const ADMIN_RESCHEDULE_MISSED_WINDOW_MS = 15 * 60 * 1000;
const BOOKING_SLOT_DURATION_MS = 60 * 60 * 1000;
const ADMIN_COMPLETE_GRACE_MS = 5 * 60 * 1000;

function isHydrogenCategory(category) {
  return String(category || '').trim().toUpperCase() === 'HYDROGEN SESSION';
}

const elements = {
  authShell: document.getElementById('authShell'),
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
  authPasswordToggleBtn: document.getElementById('authPasswordToggleBtn'),
  authOtpWrap: document.getElementById('authOtpWrap'),
  authOtp: document.getElementById('authOtp'),
  authDevOtp: document.getElementById('authDevOtp'),
  authDevOtpValue: document.getElementById('authDevOtpValue'),
  authOtpActions: document.getElementById('authOtpActions'),
  authResendOtpBtn: document.getElementById('authResendOtpBtn'),
  authResendOtpHint: document.getElementById('authResendOtpHint'),
  authSubmitBtn: document.getElementById('authSubmitBtn'),
  authDivider: document.getElementById('authDivider'),
  googleAuthBtn: document.getElementById('googleAuthBtn'),
  authError: document.getElementById('authError'),
  authBackToChoicesBtn: document.getElementById('authBackToChoicesBtn'),
  forgotPasswordBtn: document.getElementById('forgotPasswordBtn'),

  profileBtn: document.getElementById('profileBtn'),
  profileAvatar: document.getElementById('profileAvatar'),
  userName: document.getElementById('userName'),
  userRole: document.getElementById('userRole'),
  userMembershipBadge: document.getElementById('userMembershipBadge'),
  cartBtn: document.getElementById('cartBtn'),
  cartCount: document.getElementById('cartCount'),
  logoutBtn: document.getElementById('logoutBtn'),
  appArea: document.getElementById('appArea'),

  profileDialog: document.getElementById('profileDialog'),
  closeProfileDialogBtn: document.getElementById('closeProfileDialogBtn'),
  cancelProfileBtn: document.getElementById('cancelProfileBtn'),
  profileForm: document.getElementById('profileForm'),
  profileFormMessage: document.getElementById('profileFormMessage'),
  profileName: document.getElementById('profileName'),
  profileAge: document.getElementById('profileAge'),
  profileGender: document.getElementById('profileGender'),
  profileMobile: document.getElementById('profileMobile'),
  profileAvatarFile: document.getElementById('profileAvatarFile'),
  profileAvatarPreview: document.getElementById('profileAvatarPreview'),

  totalCount: document.getElementById('totalCount'),
  adminStatTotal: document.getElementById('adminStatTotal'),
  adminHistoryCard: document.getElementById('adminHistoryCard'),
  historyCount: document.getElementById('historyCount'),
  adminTabNav: document.getElementById('adminTabNav'),
  adminTabBookings: document.getElementById('adminTabBookings'),
  adminTabUserBookings: document.getElementById('adminTabUserBookings'),
  adminTabHistory: document.getElementById('adminTabHistory'),
  adminTabSessions: document.getElementById('adminTabSessions'),
  adminTabCalendar: document.getElementById('adminTabCalendar'),
  adminTabMemberships: document.getElementById('adminTabMemberships'),
  adminTabCoupons: document.getElementById('adminTabCoupons'),
  adminTabRescheduled: document.getElementById('adminTabRescheduled'),
  adminPaymentLinkAnalytics: document.getElementById('adminPaymentLinkAnalytics'),
  adminPaymentLinkFunnel: document.getElementById('adminPaymentLinkFunnel'),
  adminEmailAnalyticsStartDate: document.getElementById('adminEmailAnalyticsStartDate'),
  adminEmailAnalyticsEndDate: document.getElementById('adminEmailAnalyticsEndDate'),
  adminEmailAnalyticsApplyBtn: document.getElementById('adminEmailAnalyticsApplyBtn'),
  adminEmailAnalyticsResetBtn: document.getElementById('adminEmailAnalyticsResetBtn'),
  adminEmailAnalyticsExportBtn: document.getElementById('adminEmailAnalyticsExportBtn'),
  memberChoiceGate: document.getElementById('memberChoiceGate'),
  userTabNav: document.getElementById('userTabNav'),
  comboNotice: document.getElementById('comboNotice'),
  comboNoticeClose: document.getElementById('comboNoticeClose'),
  comboHowItWorksBtn: document.getElementById('comboHowItWorksBtn'),
  comboHowItWorksModal: document.getElementById('comboHowItWorksModal'),
  comboModalClose: document.getElementById('comboModalClose'),
  userTabServices: document.getElementById('userTabServices'),
  userTabMembership: document.getElementById('userTabMembership'),
  userTabBookings: document.getElementById('userTabBookings'),
  userTabCart: document.getElementById('userTabCart'),
  joinAsMemberBtn: document.getElementById('joinAsMemberBtn'),
  topExplorePlansBtn: document.getElementById('topExplorePlansBtn'),
  continueAsMemberBtn: document.getElementById('continueAsMemberBtn'),
  continueAsNonMemberBtn: document.getElementById('continueAsNonMemberBtn'),
  membershipSection: document.getElementById('membershipSection'),
  servicesSection: document.getElementById('servicesSection'),
  bookingFiltersSection: document.getElementById('bookingFiltersSection'),
  userBookingsSection: document.getElementById('userBookingsSection'),
  userCartSection: document.getElementById('userCartSection'),
  bookingsCartNotice: document.getElementById('bookingsCartNotice'),
  bookingsViewCartBtn: document.getElementById('bookingsViewCartBtn'),

  // My Bookings Session Tracking
  myBookingsTotalSessions: document.getElementById('myBookingsTotalSessions'),
  myBookingsUpcomingCount: document.getElementById('myBookingsUpcomingCount'),
  myBookingsCompletedCount: document.getElementById('myBookingsCompletedCount'),
  myBookingsProgressLabel: document.getElementById('myBookingsProgressLabel'),
  myBookingsProgressBar: document.getElementById('myBookingsProgressBar'),
  myBookingsProgressNote: document.getElementById('myBookingsProgressNote'),
  myBookingsUpcomingList: document.getElementById('myBookingsUpcomingList'),
  myBookingsUpcomingEmpty: document.getElementById('myBookingsUpcomingEmpty'),
  myBookingsCalendarMonth: document.getElementById('myBookingsCalendarMonth'),
  myBookingsCalendarGrid: document.getElementById('myBookingsCalendarGrid'),
  myBookingsCalendarDetails: document.getElementById('myBookingsCalendarDetails'),
  myBookingsScheduleLaterFooter: document.getElementById('myBookingsScheduleLaterFooter'),
  myBookingsFilterAll: document.getElementById('myBookingsFilterAll'),
  myBookingsFilterUpcoming: document.getElementById('myBookingsFilterUpcoming'),
  myBookingsFilterCompleted: document.getElementById('myBookingsFilterCompleted'),
  myBookingsFilterScheduleLater:
    document.getElementById('myBookingsFilterScheduleLater') || document.getElementById('myBookingsFilterCancelled'),
  memberSessionCountDecBtn: document.getElementById('memberSessionCountDecBtn'),
  memberSessionCountIncBtn: document.getElementById('memberSessionCountIncBtn'),
  memberSessionCountValue: document.getElementById('memberSessionCountValue'),

  serviceGrid: document.getElementById('serviceGrid'),
  serviceEmpty: document.getElementById('serviceEmpty'),
  servicePanelLead: document.getElementById('servicePanelLead'),
  servicePageNote: document.getElementById('servicePageNote'),
  adminCustomerName: document.getElementById('adminCustomerName'),
  adminCustomerEmail: document.getElementById('adminCustomerEmail'),
  adminCustomerPhone: document.getElementById('adminCustomerPhone'),
  adminCalendarCustomerName: document.getElementById('adminCalendarCustomerName'),
  adminCalendarCustomerEmail: document.getElementById('adminCalendarCustomerEmail'),
  adminCalendarCustomerPhone: document.getElementById('adminCalendarCustomerPhone'),
  adminClientMeta: document.getElementById('adminClientMeta'),
  adminCustomerMessage: document.getElementById('adminCustomerMessage'),
  membershipPlans: document.getElementById('membershipPlans'),
  membershipSectionTitle: document.getElementById('membershipSectionTitle'),
  membershipStatusText: document.getElementById('membershipStatusText'),
  memberFlowLabel: document.getElementById('memberFlowLabel'),
  membershipBrowsePanel: document.getElementById('membershipBrowsePanel'),
  membershipDashboard: document.getElementById('membershipDashboard'),
  membershipWelcomeName: document.getElementById('membershipWelcomeName'),
  membershipDashboardStatus: document.getElementById('membershipDashboardStatus'),
  membershipTakeMembershipBtn: document.getElementById('membershipTakeMembershipBtn'),
  membershipStatSessionsLabel: document.getElementById('membershipStatSessionsLabel'),
  membershipStatSessions: document.getElementById('membershipStatSessions'),
  membershipStatSessionsMeta: document.getElementById('membershipStatSessionsMeta'),
  membershipStatMembersCard: document.getElementById('membershipStatMembersCard'),
  membershipStatMembersLabel: document.getElementById('membershipStatMembersLabel'),
  membershipStatMembers: document.getElementById('membershipStatMembers'),
  membershipStatMembersMeta: document.getElementById('membershipStatMembersMeta'),
  membershipStatMembersDetails: document.getElementById('membershipStatMembersDetails'),
  membershipStatValidLabel: document.getElementById('membershipStatValidLabel'),
  membershipStatValid: document.getElementById('membershipStatValid'),
  membershipStatValidMeta: document.getElementById('membershipStatValidMeta'),
  membershipStatValidCard: document.getElementById('membershipStatValidCard'),
  membershipStatExtraLabel: document.getElementById('membershipStatExtraLabel'),
  membershipStatExtra: document.getElementById('membershipStatExtra'),
  membershipStatExtraMeta: document.getElementById('membershipStatExtraMeta'),
  membershipStatExtraCard: document.getElementById('membershipStatExtraCard'),
  membershipTopUpBadge: document.getElementById('membershipTopUpBadge'),
  membershipConvertedTopUpNote: document.getElementById('membershipConvertedTopUpNote'),
  membershipStatBecomeCard: document.getElementById('membershipStatBecomeCard'),
  membershipUsageTitle: document.getElementById('membershipUsageTitle'),
  membershipUsageSessionHead: document.getElementById('membershipUsageSessionHead'),
  membershipUsageLabel: document.getElementById('membershipUsageLabel'),
  membershipUsageCount: document.getElementById('membershipUsageCount'),
  membershipUsageBar: document.getElementById('membershipUsageBar'),
  membershipUsageNote: document.getElementById('membershipUsageNote'),
  membershipCalendarMonth: document.getElementById('membershipCalendarMonth'),
  membershipCalendarGrid: document.getElementById('membershipCalendarGrid'),
  membershipCalendarDetails: document.getElementById('membershipCalendarDetails'),
  membershipScheduleLaterFooter: document.getElementById('membershipScheduleLaterFooter'),
  membershipNextSessionTitle: document.getElementById('membershipNextSessionTitle'),
  membershipNextSessionMeta: document.getElementById('membershipNextSessionMeta'),
  membershipCardScheduleBtn: document.getElementById('membershipCardScheduleBtn'),
  membershipCardTopUpBtn: document.getElementById('membershipCardTopUpBtn'),
  membershipQuickAddPersonBtn: document.getElementById('membershipQuickAddPersonBtn'),
  membershipQuickHistoryBtn: document.getElementById('membershipQuickHistoryBtn'),
  membershipBackBtn: document.getElementById('membershipBackBtn'),
  membershipNextBtn: document.getElementById('membershipNextBtn'),
  membershipPeopleCard: document.getElementById('membershipPeopleCard'),
  membershipAddPersonBtn: document.getElementById('membershipAddPersonBtn'),
  membershipPeopleMeta: document.getElementById('membershipPeopleMeta'),
  membershipPeopleList: document.getElementById('membershipPeopleList'),
  membershipAddPersonDialog: document.getElementById('membershipAddPersonDialog'),
  membershipAddPersonForm: document.getElementById('membershipAddPersonForm'),
  closeMembershipAddPersonDialogBtn: document.getElementById('closeMembershipAddPersonDialogBtn'),
  cancelMembershipAddPersonBtn: document.getElementById('cancelMembershipAddPersonBtn'),
  saveMembershipAddPersonBtn: document.getElementById('saveMembershipAddPersonBtn'),
  membershipAddPersonValidityNote: document.getElementById('membershipAddPersonValidityNote'),
  membershipAddPersonError: document.getElementById('membershipAddPersonError'),
  membershipAddPersonName: document.getElementById('membershipAddPersonName'),
  membershipAddPersonPlace: document.getElementById('membershipAddPersonPlace'),
  membershipAddPersonEmail: document.getElementById('membershipAddPersonEmail'),
  membershipAddPersonContact: document.getElementById('membershipAddPersonContact'),
  membershipRosterDialog: document.getElementById('membershipRosterDialog'),
  membershipRosterForm: document.getElementById('membershipRosterForm'),
  membershipRosterDialogTitle: document.getElementById('membershipRosterDialogTitle'),
  membershipRosterSummary: document.getElementById('membershipRosterSummary'),
  membershipRosterList: document.getElementById('membershipRosterList'),
  closeMembershipRosterDialogBtn: document.getElementById('closeMembershipRosterDialogBtn'),
  cancelMembershipRosterBtn: document.getElementById('cancelMembershipRosterBtn'),
  adminCalendarCustomerDialog: document.getElementById('adminCalendarCustomerDialog'),
  adminCalendarCustomerForm: document.getElementById('adminCalendarCustomerForm'),
  adminCalendarModalCustomerName: document.getElementById('adminCalendarModalCustomerName'),
  adminCalendarModalCustomerEmail: document.getElementById('adminCalendarModalCustomerEmail'),
  adminCalendarModalCustomerPhone: document.getElementById('adminCalendarModalCustomerPhone'),
  closeAdminCalendarCustomerDialogBtn: document.getElementById('closeAdminCalendarCustomerDialogBtn'),
  cancelAdminCalendarCustomerDialogBtn: document.getElementById('cancelAdminCalendarCustomerDialogBtn'),
  confirmAdminCalendarCustomerDialogBtn: document.getElementById('confirmAdminCalendarCustomerDialogBtn'),
  bookingNotesDialog: document.getElementById('bookingNotesDialog'),
  bookingNotesCloseBtn: document.getElementById('bookingNotesCloseBtn'),
  bookingNotesAddBtn: document.getElementById('bookingNotesAddBtn'),
  bookingNotesInput: document.getElementById('bookingNotesInput'),
  bookingNotesList: document.getElementById('bookingNotesList'),
  bookingNotesEmpty: document.getElementById('bookingNotesEmpty'),
  bookingNotesBookingId: document.getElementById('bookingNotesBookingId'),
  bookingEmailTimelineDialog: document.getElementById('bookingEmailTimelineDialog'),
  bookingEmailTimelineCloseBtn: document.getElementById('bookingEmailTimelineCloseBtn'),
  bookingEmailTimelineBookingId: document.getElementById('bookingEmailTimelineBookingId'),
  bookingEmailTimelineMeta: document.getElementById('bookingEmailTimelineMeta'),
  bookingEmailTimelineAnalytics: document.getElementById('bookingEmailTimelineAnalytics'),
  bookingEmailTimelineList: document.getElementById('bookingEmailTimelineList'),
  bookingEmailTimelineEmpty: document.getElementById('bookingEmailTimelineEmpty'),
  bookingEmailTimelineResendBtn: document.getElementById('bookingEmailTimelineResendBtn'),
  adminPaymentChoiceDialog: document.getElementById('adminPaymentChoiceDialog'),
  adminPaymentChoiceMeta: document.getElementById('adminPaymentChoiceMeta'),
  adminPaymentChoiceCashBtn: document.getElementById('adminPaymentChoiceCashBtn'),
  adminPaymentChoiceLinkBtn: document.getElementById('adminPaymentChoiceLinkBtn'),
  adminPaymentChoiceCloseBtn: document.getElementById('adminPaymentChoiceCloseBtn'),

  noticeDialog: document.getElementById('noticeDialog'),
  noticeDialogTitle: document.getElementById('noticeDialogTitle'),
  noticeDialogBody: document.getElementById('noticeDialogBody'),
  noticeDialogCloseBtn: document.getElementById('noticeDialogCloseBtn'),
  noticeDialogOkBtn: document.getElementById('noticeDialogOkBtn'),
  confirmDialog: document.getElementById('confirmDialog'),
  confirmDialogTitle: document.getElementById('confirmDialogTitle'),
  confirmDialogBody: document.getElementById('confirmDialogBody'),
  confirmDialogCloseBtn: document.getElementById('confirmDialogCloseBtn'),
  confirmDialogCancelBtn: document.getElementById('confirmDialogCancelBtn'),
  confirmDialogOkBtn: document.getElementById('confirmDialogOkBtn'),
  bookingEmailTimelineDialog: document.getElementById('bookingEmailTimelineDialog'),
  bookingEmailTimelineCloseBtn: document.getElementById('bookingEmailTimelineCloseBtn'),
  bookingEmailTimelineBookingId: document.getElementById('bookingEmailTimelineBookingId'),
  bookingEmailTimelineMeta: document.getElementById('bookingEmailTimelineMeta'),
  bookingEmailTimelineAnalytics: document.getElementById('bookingEmailTimelineAnalytics'),
  bookingEmailTimelineList: document.getElementById('bookingEmailTimelineList'),
  bookingEmailTimelineEmpty: document.getElementById('bookingEmailTimelineEmpty'),
  bookingEmailTimelineResendBtn: document.getElementById('bookingEmailTimelineResendBtn'),
  servicesBackBtn: document.getElementById('servicesBackBtn'),
  servicesNextBtn: document.getElementById('servicesNextBtn'),
  bookingsBackBtn: document.getElementById('bookingsBackBtn'),
  bookingsPayAllBtn: document.getElementById('bookingsPayAllBtn'),
  userCheckoutSummary: document.getElementById('userCheckoutSummary'),
  cartContinueShoppingBtn: document.getElementById('cartContinueShoppingBtn'),
  cartViewBookingsBtn: document.getElementById('cartViewBookingsBtn'),
  cartEmptyBrowseBtn: document.getElementById('cartEmptyBrowseBtn'),
  cartEmptyBookingsBtn: document.getElementById('cartEmptyBookingsBtn'),
  membershipDialog: document.getElementById('membershipDialog'),
  membershipForm: document.getElementById('membershipForm'),
  membershipDialogTitle: document.getElementById('membershipDialogTitle'),
  membershipPlanSummary: document.getElementById('membershipPlanSummary'),
  membershipMembersGrid: document.getElementById('membershipMembersGrid'),
  closeMembershipDialogBtn: document.getElementById('closeMembershipDialogBtn'),
  cancelMembershipBtn: document.getElementById('cancelMembershipBtn'),

  searchInput: document.getElementById('searchInput'),
  searchBtn: document.getElementById('searchBtn'),
  statusFilter: document.getElementById('statusFilter'),
  dateFilter: document.getElementById('dateFilter'),
  resetFiltersBtn: document.getElementById('resetFiltersBtn'),

  bookingTableBody: document.getElementById('bookingTableBody'),
  emptyState: document.getElementById('emptyState'),
  cartTableBody: document.getElementById('cartTableBody'),
  cartMobileList: document.getElementById('cartMobileList'),
  cartEmptyState: document.getElementById('cartEmptyState'),
  adminBookingTableBody: document.getElementById('adminBookingTableBody'),
  adminEmptyState: document.getElementById('adminEmptyState'),
  adminMembershipOrdersList: document.getElementById('adminMembershipOrdersList'),
  adminMembershipEmptyState: document.getElementById('adminMembershipEmptyState'),
  adminDiscountForm: document.getElementById('adminDiscountForm'),
  adminDiscountEmail: document.getElementById('adminDiscountEmail'),
  adminDiscountPhone: document.getElementById('adminDiscountPhone'),
  adminDiscountPercent: document.getElementById('adminDiscountPercent'),
  adminDiscountSubmitBtn: document.getElementById('adminDiscountSubmitBtn'),
  adminDiscountList: document.getElementById('adminDiscountList'),
  adminDiscountEmptyState: document.getElementById('adminDiscountEmptyState'),
  adminDiscountGateBtn: document.getElementById('adminDiscountGateBtn'),
  adminDiscountGateMessage: document.getElementById('adminDiscountGateMessage'),
  adminDiscountPanel: document.getElementById('adminDiscountPanel'),
  adminDiscountDropdown: document.getElementById('adminDiscountDropdown'),
  adminDiscountUserResults: document.getElementById('adminDiscountUserResults'),
  adminDiscountBulkPercent: document.getElementById('adminDiscountBulkPercent'),
  adminDiscountBulkApplyBtn: document.getElementById('adminDiscountBulkApplyBtn'),
  adminDiscountUsersEmpty: document.getElementById('adminDiscountUsersEmpty'),
  adminDiscountUserSearch: document.getElementById('adminDiscountUserSearch'),
  adminDiscountSelectedCount: document.getElementById('adminDiscountSelectedCount'),
  adminDiscountSelectedBtn: document.getElementById('adminDiscountSelectedBtn'),
  adminDiscountSelectedWindow: document.getElementById('adminDiscountSelectedWindow'),
  adminDiscountSelectedWindowCount: document.getElementById('adminDiscountSelectedWindowCount'),
  adminDiscountSelectedList: document.getElementById('adminDiscountSelectedList'),
  adminCouponForm: document.getElementById('adminCouponForm'),
  adminCouponRecipientEmailWrap: document.getElementById('adminCouponRecipientEmailWrap'),
  adminCouponRecipientEmail: document.getElementById('adminCouponRecipientEmail'),
  adminCouponFestivalName: document.getElementById('adminCouponFestivalName'),
  adminCouponCode: document.getElementById('adminCouponCode'),
  adminCouponDescription: document.getElementById('adminCouponDescription'),
  adminCouponType: document.getElementById('adminCouponType'),
  adminCouponValue: document.getElementById('adminCouponValue'),
  adminCouponMaxRedemptions: document.getElementById('adminCouponMaxRedemptions'),
  adminCouponExpiresAt: document.getElementById('adminCouponExpiresAt'),
  adminCouponExpiryDate: document.getElementById('adminCouponExpiryDate'),
  adminCouponExpiryTime: document.getElementById('adminCouponExpiryTime'),
  adminCouponSubmitBtn: document.getElementById('adminCouponSubmitBtn'),
  adminCouponSaveOnlyBtn: document.getElementById('adminCouponSaveOnlyBtn'),
  adminCouponList: document.getElementById('adminCouponList'),
  adminCouponEmptyState: document.getElementById('adminCouponEmptyState'),
  adminSeasonalCouponList: document.getElementById('adminSeasonalCouponList'),
  adminSeasonalCouponEmptyState: document.getElementById('adminSeasonalCouponEmptyState'),
  adminUserCards: document.getElementById('adminUserCards'),
  adminUserCardsEmpty: document.getElementById('adminUserCardsEmpty'),
  adminUserSessionDialog: document.getElementById('adminUserSessionDialog'),
  adminUserSessionTitle: document.getElementById('adminUserSessionTitle'),
  adminUserSessionMeta: document.getElementById('adminUserSessionMeta'),
  adminUserSessionCloseBtn: document.getElementById('adminUserSessionCloseBtn'),
  adminUserSessionKpis: document.getElementById('adminUserSessionKpis'),
  adminUserSessionList: document.getElementById('adminUserSessionList'),
  adminUserSessionListEmpty: document.getElementById('adminUserSessionListEmpty'),
  membershipCouponCode: document.getElementById('membershipCouponCode'),
  membershipApplyCouponBtn: document.getElementById('membershipApplyCouponBtn'),
  membershipCouponPreview: document.getElementById('membershipCouponPreview'),
  membershipGeneralCoupons: document.getElementById('membershipGeneralCoupons'),
  userCouponCode: document.getElementById('userCouponCode'),
  userApplyCouponBtn: document.getElementById('userApplyCouponBtn'),
  userCouponPreview: document.getElementById('userCouponPreview'),
  userGeneralCoupons: document.getElementById('userGeneralCoupons'),
  userCouponEntry: document.getElementById('userCouponEntry'),

  adminHistoryToggleBtn: document.getElementById('adminHistoryToggleBtn'),
  adminHistoryToggleBtnWrap: document.getElementById('adminHistoryToggleBtnWrap'),
  adminHistorySection: document.getElementById('adminHistorySection'),
  adminTableTitle: document.getElementById('adminTableTitle'),
  adminUserBookingsSection: document.getElementById('adminUserBookingsSection'),
  adminPendingBookingStartDate: document.getElementById('adminPendingBookingStartDate'),
  adminPendingBookingEndDate: document.getElementById('adminPendingBookingEndDate'),
  adminPendingBookingDateResetBtn: document.getElementById('adminPendingBookingDateResetBtn'),
  adminPendingBookingSearch: document.getElementById('adminPendingBookingSearch'),
  adminPendingBookingTableBody: document.getElementById('adminPendingBookingTableBody'),
  adminPendingEmptyState: document.getElementById('adminPendingEmptyState'),
  adminAllBookingsSection: document.getElementById('adminAllBookingsSection'),
  adminAllBookingTitle: document.getElementById('adminAllBookingTitle'),
  adminAllBookingModeText: document.getElementById('adminAllBookingModeText'),
  adminAllBookingModeToggleBtn: document.getElementById('adminAllBookingModeToggleBtn'),
  adminAllBookingStartDate: document.getElementById('adminAllBookingStartDate'),
  adminAllBookingEndDate: document.getElementById('adminAllBookingEndDate'),
  adminAllBookingDateResetBtn: document.getElementById('adminAllBookingDateResetBtn'),
  adminAllBookingDatePrevBtn: document.getElementById('adminAllBookingDatePrevBtn'),
  adminAllBookingDateNextBtn: document.getElementById('adminAllBookingDateNextBtn'),
  adminAllBookingSlotDate: document.getElementById('adminAllBookingSlotDate'),
  adminAllBookingSlotTime: document.getElementById('adminAllBookingSlotTime'),
  adminAllBookingSlotResetBtn: document.getElementById('adminAllBookingSlotResetBtn'),
  adminAllBookingSlotSummary: document.getElementById('adminAllBookingSlotSummary'),
  adminAllBookingSearch: document.getElementById('adminAllBookingSearch'),
  adminAllBookingTableBody: document.getElementById('adminAllBookingTableBody'),
  adminAllBookingEmptyState: document.getElementById('adminAllBookingEmptyState'),
  adminUserSessionsSection: document.getElementById('adminUserSessionsSection'),
  adminMembershipSection: document.getElementById('adminMembershipSection'),
  adminCouponsSection: document.getElementById('adminCouponsSection'),
  adminRescheduledSection: document.getElementById('adminRescheduledSection'),
  adminRescheduleSearch: document.getElementById('adminRescheduleSearch'),
  adminRescheduleDate: document.getElementById('adminRescheduleDate'),
  adminRescheduleDateClearBtn: document.getElementById('adminRescheduleDateClearBtn'),
  adminRescheduleViewToggleBtn: document.getElementById('adminRescheduleViewToggleBtn'),
  adminRescheduleSlotFilters: document.getElementById('adminRescheduleSlotFilters'),
  adminRescheduleList: document.getElementById('adminRescheduleList'),
  adminRescheduleEmptyState: document.getElementById('adminRescheduleEmptyState'),

  adminSessionSearch: document.getElementById('adminSessionSearch'),
  adminMembershipSearch: document.getElementById('adminMembershipSearch'),
  adminCalendarSection: document.getElementById('adminCalendarSection'),
  adminCalendarDate: document.getElementById('adminCalendarDate'),
  adminCalendarCategory: document.getElementById('adminCalendarCategory'),
  adminCalendarService: document.getElementById('adminCalendarService'),
  adminCalendarPrevMonthBtn: document.getElementById('adminCalendarPrevMonthBtn'),
  adminCalendarNextMonthBtn: document.getElementById('adminCalendarNextMonthBtn'),
  adminCalendarMonthLabel: document.getElementById('adminCalendarMonthLabel'),
  adminCalendarGrid: document.getElementById('adminCalendarGrid'),
  adminCalendarSelectedDateLabel: document.getElementById('adminCalendarSelectedDateLabel'),
  adminCalendarRefreshBtn: document.getElementById('adminCalendarRefreshBtn'),
  adminCalendarBookConsultationBtn: document.getElementById('adminCalendarBookConsultationBtn'),
  adminCalendarClearDetailsBtn: document.getElementById('adminCalendarClearDetailsBtn'),
  adminCalendarStatus: document.getElementById('adminCalendarStatus'),
  adminCalendarSlots: document.getElementById('adminCalendarSlots'),
  adminCalendarEmpty: document.getElementById('adminCalendarEmpty'),
  adminCalendarTracker: document.getElementById('adminCalendarTracker'),

  openBookingBtn: document.getElementById('openBookingBtn'),
  dialog: document.getElementById('bookingDialog'),
  addOnService: document.getElementById('addOnService'),
  addOnServiceLabel: document.getElementById('addOnServiceLabel'),
  addOnDate: document.getElementById('addOnDate'),
  addOnDateLabel: document.getElementById('addOnDateLabel'),
  addOnTime: document.getElementById('addOnTime'),
  addOnTimeLabel: document.getElementById('addOnTimeLabel'),
  bookingCustomerStep: document.getElementById('bookingCustomerStep'),
  bookingCustomerName: document.getElementById('bookingCustomerName'),
  bookingCustomerEmail: document.getElementById('bookingCustomerEmail'),
  bookingCustomerPhone: document.getElementById('bookingCustomerPhone'),
  bookingCustomerInlineMessage: document.getElementById('bookingCustomerInlineMessage'),
  bookingSchedulerSection: document.getElementById('bookingSchedulerSection'),
  bookingHydrogenAddOnScheduler: document.getElementById('bookingHydrogenAddOnScheduler'),
  bookingSummary: document.getElementById('bookingSummary'),
  summaryContent: document.getElementById('summaryContent'),
  totalPayable: document.getElementById('totalPayable'),
  dialogTitle: document.getElementById('dialogTitle'),
  closeDialogBtn: document.getElementById('closeDialogBtn'),
  cancelDialogBtn: document.getElementById('cancelDialogBtn'),
  bookingForm: document.getElementById('bookingForm'),
  bookingId: document.getElementById('bookingId'),
  serviceName: document.getElementById('serviceName'),
  bookingDate: document.getElementById('bookingDate'),
  bookingTime: document.getElementById('bookingTime'),
  bookingNotes: document.getElementById('bookingNotes'),
  experienceBookBtn: document.getElementById('experienceBookBtn'),
  experienceCardPrice: document.getElementById('experienceCardPrice'),

  // Guest Checkout Elements
  publicBookSessionBtn: document.getElementById('publicBookSessionBtn'),
  guestCheckoutDialog: document.getElementById('guestCheckoutDialog'),
  guestCheckoutForm: document.getElementById('guestCheckoutForm'),
  guestCheckoutName: document.getElementById('guestCheckoutName'),
  guestCheckoutEmail: document.getElementById('guestCheckoutEmail'),
  guestCheckoutPhone: document.getElementById('guestCheckoutPhone'),
  guestCheckoutError: document.getElementById('guestCheckoutError'),
  guestCheckoutSubmit: document.getElementById('guestCheckoutSubmit'),
  guestCheckoutCancel: document.getElementById('guestCheckoutCancel'),
  closeGuestCheckoutDialog: document.getElementById('closeGuestCheckoutDialog'),

  // Checkout Options Elements
  checkoutOptionsDialog: document.getElementById('checkoutOptionsDialog'),
  checkoutOptionsForm: document.getElementById('checkoutOptionsForm'),
  checkoutWithGoogle: document.getElementById('checkoutWithGoogle'),
  checkoutWithEmailLogin: document.getElementById('checkoutWithEmailLogin'),
  checkoutAsGuest: document.getElementById('checkoutAsGuest'),
  closeCheckoutOptionsDialog: document.getElementById('closeCheckoutOptionsDialog'),
  checkoutOptionsContinueShopping: document.getElementById('checkoutOptionsContinueShopping'),
};

let isRegisterMode = false;
let isForgotPasswordMode = false;
let signupStage = 'details';
let pendingSignupName = '';
let pendingSignupEmail = '';
let forgotPasswordStage = 'email';
let pendingForgotEmail = '';
let signupOtpResendAvailableAt = 0;
let forgotOtpResendAvailableAt = 0;
let authOtpResendTicker = 0;
let profilePreviewObjectUrl = '';
let availabilityRequestId = 0;
let adminCustomerRefreshTimer = 0;
let adminDiscountSearchTimer = 0;
let pendingAdminCalendarBookingAction = null;

bootstrap();

function getUserTabFromHash(hash) {
  const normalized = String(hash || '')
    .trim()
    .replace(/^#/, '')
    .toLowerCase();
  if (normalized === 'services') return 'services';
  if (normalized === 'membership') return 'membership';
  if (normalized === 'bookings') return 'bookings';
  if (normalized === 'cart') return 'cart';
  return '';
}

function openAuthFromLanding(choice = '') {
  state.pendingPreAuthChoice = String(choice || '').trim();
  state.showAuthCard = true;
  isRegisterMode = false;
  isForgotPasswordMode = false;
  signupStage = 'details';
  forgotPasswordStage = 'email';
  pendingSignupName = '';
  pendingSignupEmail = '';
  pendingForgotEmail = '';
  signupOtpResendAvailableAt = 0;
  forgotOtpResendAvailableAt = 0;
  elements.authOtp.value = '';
  elements.authPassword.value = '';
  renderAuthMode();
  render();
  requestAnimationFrame(() => {
    elements.authCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function ensurePostLoginDashboardChoice() {
  if (state.user?.role !== 'user' || state.postLoginChoice) return;
  state.postLoginChoice = isCurrentUserMembershipActive() ? 'continue-member' : 'continue-non-member';
}

function resetMyBookingsViewState() {
  state.userBookingsFilter = 'all';
}

function resetServicesUiStateForUserSwitch() {
  resetServiceBrowserState();
  state.expandedServiceCategories = {};
  state.serviceDetailSelections = {};
}


function routeAfterAuthSuccess() {
  ensurePostLoginDashboardChoice();
  if (state.user?.role === 'admin') {
    state.adminActiveTab = 'calendar';
    return;
  }
  state.membershipBrowseVisible = false;
  state.activeUserTab = 'membership';
  window.location.hash = '#membership';
}

async function finishAuthSuccess(result) {
  resetMyBookingsViewState();
  resetServicesUiStateForUserSwitch();
  state.user = result.user;
  storeAuthToken(result.token || result.authToken || '');
  state.postLoginChoice = state.pendingPreAuthChoice || '';
  state.pendingPreAuthChoice = '';
  state.showAuthCard = false;
  routeAfterAuthSuccess();
  render();

  try {
    await loadProfile();
    await loadDashboardData();
    routeAfterAuthSuccess();
  } catch (error) {
    if (Number(error?.status || 0) === 401) {
      console.warn('Dashboard data load was unauthorized after successful sign-in. Check server restart/auth cookie settings.');
    } else {
      console.error(error);
    }
  }

  render();
}

async function bootstrap() {
  const initialTab = getUserTabFromHash(window.location.hash);
  consumeOAuthTokenFromHash();
  if (initialTab) state.activeUserTab = initialTab;
  attachEvents();
  syncAdminRescheduleSearchPlaceholder();
  if (adminRescheduleSearchPlaceholderQuery) {
    if (typeof adminRescheduleSearchPlaceholderQuery.addEventListener === 'function') {
      adminRescheduleSearchPlaceholderQuery.addEventListener('change', syncAdminRescheduleSearchPlaceholder);
    } else if (typeof adminRescheduleSearchPlaceholderQuery.addListener === 'function') {
      adminRescheduleSearchPlaceholderQuery.addListener(syncAdminRescheduleSearchPlaceholder);
    }
  }
  populateTimeSlots();
  await loadCurrentUser();
  if (state.user) {
    resetMyBookingsViewState();
    resetServicesUiStateForUserSwitch();
    await loadProfile();
    await loadDashboardData();
    ensurePostLoginDashboardChoice();
    if (state.user.role === 'user' && !initialTab) {
      state.membershipBrowseVisible = false;
      state.activeUserTab = 'membership';
      window.location.hash = '#membership';
    }
  } else {
    await loadGuestDashboardData();
  }
  render();
}

function attachEvents() {
  const openMembershipPlansFromLanding = () => {
    if (!state.user) {
      openAuthFromLanding('join-member');
      return;
    }
    state.postLoginChoice = 'join-member';
    state.activeUserTab = 'membership';
    window.location.hash = '#membership';
    render();
    requestAnimationFrame(() => {
      document.querySelector('[aria-label="Membership"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  window.addEventListener('hashchange', () => {
    const nextTab = getUserTabFromHash(window.location.hash);
    if (!nextTab) return;
    if (!state.isGuestUser && (!state.user || state.user.role !== 'user' || !state.postLoginChoice)) return;
    if (state.isGuestUser && nextTab !== 'services' && nextTab !== 'cart') return;
    if (state.activeUserTab === nextTab) return;
    resetServiceBrowserState();
    state.activeUserTab = nextTab;
    render();
    requestAnimationFrame(() => {
      const section =
        nextTab === 'membership'
          ? elements.membershipSection
          : nextTab === 'bookings'
            ? elements.userBookingsSection
            : nextTab === 'cart'
              ? elements.userCartSection
              : elements.servicesSection;
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  elements.authSwitchBtn?.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    isForgotPasswordMode = false;
    signupStage = 'details';
    pendingSignupName = '';
    pendingSignupEmail = '';
    forgotPasswordStage = 'email';
    pendingForgotEmail = '';
    signupOtpResendAvailableAt = 0;
    forgotOtpResendAvailableAt = 0;
    elements.authOtp.value = '';
    elements.authForm.reset();
    renderAuthMode();
  });

  elements.authBackToChoicesBtn?.addEventListener('click', () => {
    state.showAuthCard = false;
    state.pendingPreAuthChoice = '';
    isRegisterMode = false;
    isForgotPasswordMode = false;
    signupStage = 'details';
    forgotPasswordStage = 'email';
    pendingSignupName = '';
    pendingSignupEmail = '';
    pendingForgotEmail = '';
    signupOtpResendAvailableAt = 0;
    forgotOtpResendAvailableAt = 0;
    elements.authForm.reset();
    elements.authError.textContent = '';
    renderAuthMode();
    render();
    requestAnimationFrame(() => {
      elements.memberChoiceGate?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  elements.forgotPasswordBtn.addEventListener('click', () => {
    if (isForgotPasswordMode) {
      isForgotPasswordMode = false;
      forgotPasswordStage = 'email';
      pendingForgotEmail = '';
      forgotOtpResendAvailableAt = 0;
      elements.authOtp.value = '';
      elements.authPassword.value = '';
      renderAuthMode();
      return;
    }

    isRegisterMode = false;
    isForgotPasswordMode = true;
    forgotPasswordStage = 'email';
    pendingForgotEmail = '';
    forgotOtpResendAvailableAt = 0;
    elements.authOtp.value = '';
    elements.authPassword.value = '';
    renderAuthMode();
  });

  elements.authForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitAuth();
  });

  elements.authPasswordToggleBtn?.addEventListener('click', () => {
    toggleAuthPasswordVisibility();
  });

  elements.authResendOtpBtn?.addEventListener('click', async () => {
    await resendAuthOtp();
  });

  function closeNoticeDialog() {
    const signature = String(elements.noticeDialog?.dataset?.signature || '').trim();
    if (signature) {
      acknowledgeNoticeSignature(signature);
    }
    try {
      elements.noticeDialog?.close?.();
    } catch {
      elements.noticeDialog?.removeAttribute?.('open');
    }
  }

  elements.noticeDialogOkBtn?.addEventListener('click', closeNoticeDialog);
  elements.noticeDialogCloseBtn?.addEventListener('click', closeNoticeDialog);
  
  elements.logoutBtn?.addEventListener('click', async () => {
    let logoutWarning = '';
    try {
      const response = await fetch(buildApiUrl('/api/auth/logout'), withApiCredentials({ method: 'POST' }));
      if (!response.ok) {
        logoutWarning = 'Signed out on this device, but server logout returned an error.';
      }
    } catch {
      logoutWarning = 'Signed out on this device, but server logout could not be reached.';
    }

    state.user = null;
    state.bookings = [];
    state.adminMembershipOrders = [];
    state.adminDiscountPhones = [];
    state.adminUsers = [];
    state.adminCoupons = [];
    state.adminSelectedUserId = null;
    state.adminResolvedCustomer = null;
    state.adminCustomerForm = { name: '', email: '', phone: '' };
    state.postLoginChoice = '';
    resetMyBookingsViewState();
    resetServicesUiStateForUserSwitch();
    state.pendingPreAuthChoice = '';
    state.showAuthCard = false;
    state.activeUserTab = 'services';
    storeAuthToken('');
    clearTimeout(adminCustomerRefreshTimer);
    state.membership = { plans: [], active: false, current: null };
    state.membershipBrowseVisible = false;
    state.membershipAdditions = {};
    state.membershipCheckout = null;
    state.membershipCouponPreview = null;
    state.cartCouponCode = '';
    state.cartCouponPreview = null;
    state.ivSelections = {};
    state.adminDiscountUnlocked = false;
    state.adminDiscountSearch = '';
    state.adminDiscountDropdownOpen = false;
    state.adminDiscountSearchResults = [];
    state.adminDiscountSearchLoading = false;
    state.adminDiscountSelectedUsers = [];
    state.adminDiscountSelectedWindowOpen = false;
    state.adminBookingNotesByBooking = {};
    state.adminBookingNotesLoading = false;
    state.adminBookingNoteEdits = {};
    state.adminBookingEmailEventsByBooking = {};
    state.adminBookingEmailAnalyticsByBooking = {};
    state.adminBookingEmailTimelineLoading = false;
    state.adminPaymentLinkAnalytics = null;
    state.adminPaymentLinkAnalyticsRows = [];
    state.adminEmailAnalyticsFilters = { startDate: '', endDate: '' };
    state.adminRescheduleSearch = '';
    state.adminRescheduleSelections = {};
    state.adminRescheduleAvailability = {};
    state.adminRescheduleLoading = {};
    state.adminRescheduleOtpRequested = {};
    state.adminRescheduleDateFilter = '';
    state.adminRescheduleSlotFilter = '';
    state.adminRescheduleView = 'queue';
    state.adminCalendarDate = '';
    state.adminCalendarCategory = 'HYDROGEN SESSION';
    state.adminCalendarServiceName = '';
    state.adminCalendarAvailability = {};
    state.adminCalendarHoldCounts = {};
    state.adminCalendarCapacityByService = {};
    state.adminCalendarLoading = false;
    state.adminCalendarError = '';
    state.adminCalendarMonth = '';
    state.adminCalendarMonthLoading = false;
    state.adminCalendarDayCache = {};
    state.selectedServiceCategory = null;
    state.selectedSingleSessionServiceName = '';
    state.singleSessionEditingBookingId = '';
    state.selectedHydrogenServiceName = '';
    state.selectedHydrogenExtraSessions = 0;
    state.selectedHydrogenSlots = [];
    state.selectedHydrogenAddOnServiceName = '';
    state.selectedHydrogenAddOnSessionIndex = 0;
    state.hydrogenEditingGroupId = '';
    state.activeHydrogenSessionIndex = 0;
    state.activeHydrogenSessionDate = '';
    state.activeHydrogenSessionTime = '';
    state.selectedServiceDate = '';
    state.slotAvailability = {};
    state.slotCapacityByService = {};
    state.slotAvailabilityLoading = false;
    state.slotAutoShiftedNotice = '';
    resetGuestCheckoutState();
    state.isGuestUser = true;
    isForgotPasswordMode = false;
    signupStage = 'details';
    pendingSignupName = '';
    pendingSignupEmail = '';
    forgotPasswordStage = 'email';
    pendingForgotEmail = '';
    signupOtpResendAvailableAt = 0;
    forgotOtpResendAvailableAt = 0;
    elements.authOtp.value = '';
    if (elements.dialog.open) elements.dialog.close();
    if (elements.profileDialog.open) elements.profileDialog.close();
    if (elements.membershipDialog?.open) elements.membershipDialog.close();
    if (elements.membershipRosterDialog?.open) elements.membershipRosterDialog.close();
    if (elements.adminUserSessionDialog?.open) elements.adminUserSessionDialog.close();
    state.isGuestUser = false;
    state.showAuthCard = false;
    state.postLoginChoice = '';
    state.pendingPreAuthChoice = '';
    render();

    if (logoutWarning) {
      showNotice({ title: 'Logout notice', body: logoutWarning });
    }
  });
  const updateAdminCustomerField = (field) => (event) => {
    const target = event?.target;
    if (!target) return;
    const rawValue = String(target.value || '').trim();
    const value =
      field === 'phone'
        ? normalizeTenDigitMobile(rawValue)
        : field === 'name'
          ? rawValue.slice(0, 80)
          : rawValue;
    if (field === 'name' && target.value !== value) target.value = value;
    if (field === 'phone' && target.value !== value) target.value = value;
    state.adminCustomerForm[field] = value;
    if (state.user?.role === 'admin') {
      clearTimeout(adminCustomerRefreshTimer);
      adminCustomerRefreshTimer = window.setTimeout(() => {
        refreshAdminCustomerContext().catch((error) => {
          setAdminCustomerMessage(error.message || 'Unable to load customer services.');
        });
      }, 300);
    }
  };
  elements.comboNoticeClose?.addEventListener('click', () => {
    if (elements.comboNotice) {
      elements.comboNotice.hidden = true;
    }
  });

  elements.comboHowItWorksBtn?.addEventListener('click', () => {
    elements.comboHowItWorksModal.hidden = false;
  });
  elements.comboModalClose?.addEventListener('click', () => {
    elements.comboHowItWorksModal.hidden = true;
  });
  elements.comboHowItWorksModal?.addEventListener('click', (event) => {
    if (event.target === elements.comboHowItWorksModal) {
      elements.comboHowItWorksModal.hidden = true;
    }
  });
  elements.adminCustomerName?.addEventListener('input', updateAdminCustomerField('name'));
  elements.adminCustomerPhone?.addEventListener('input', updateAdminCustomerField('phone'));
  elements.adminCustomerEmail?.addEventListener('input', updateAdminCustomerField('email'));
  elements.adminCalendarCustomerName?.addEventListener('input', updateAdminCustomerField('name'));
  elements.adminCalendarCustomerPhone?.addEventListener('input', updateAdminCustomerField('phone'));
  elements.adminCalendarCustomerEmail?.addEventListener('input', updateAdminCustomerField('email'));
  elements.adminCustomerName?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });
  elements.adminCustomerEmail?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });
  elements.adminCustomerPhone?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });
  elements.adminCalendarCustomerName?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });
  elements.adminCalendarCustomerEmail?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });
  elements.adminCalendarCustomerPhone?.addEventListener('change', async () => {
    await refreshAdminCustomerContext().catch(() => {});
  });

  elements.profileBtn?.addEventListener('click', openProfileDialog);
  enforceTenDigitMobileInput(elements.profileMobile);
  enforceTenDigitMobileInput(elements.adminDiscountPhone);
  enforceTenDigitMobileInput(elements.adminCustomerPhone);
  enforceTenDigitMobileInput(elements.adminCalendarCustomerPhone);
  enforceTenDigitMobileInput(elements.membershipAddPersonContact);
  enforceTenDigitMobileInput(elements.adminCalendarModalCustomerPhone);
  const syncAdminCustomerFromModal = () => {
    const nextName = String(elements.adminCalendarModalCustomerName?.value || '').trim().slice(0, 80);
    const nextEmail = String(elements.adminCalendarModalCustomerEmail?.value || '').trim();
    const nextPhone = normalizeTenDigitMobile(elements.adminCalendarModalCustomerPhone?.value || '');
    state.adminCustomerForm = {
      ...state.adminCustomerForm,
      name: nextName,
      email: nextEmail,
      phone: nextPhone,
    };
    if (elements.adminCalendarModalCustomerName && elements.adminCalendarModalCustomerName.value !== nextName) {
      elements.adminCalendarModalCustomerName.value = nextName;
    }
    if (elements.adminCalendarModalCustomerPhone && elements.adminCalendarModalCustomerPhone.value !== nextPhone) {
      elements.adminCalendarModalCustomerPhone.value = nextPhone;
    }
    syncAdminCustomerFieldsToUi();
  };
  elements.adminCalendarModalCustomerName?.addEventListener('input', syncAdminCustomerFromModal);
  elements.adminCalendarModalCustomerEmail?.addEventListener('input', syncAdminCustomerFromModal);
  elements.adminCalendarModalCustomerPhone?.addEventListener('input', syncAdminCustomerFromModal);
  elements.closeAdminCalendarCustomerDialogBtn?.addEventListener('click', closeAdminCalendarCustomerDialog);
  elements.cancelAdminCalendarCustomerDialogBtn?.addEventListener('click', closeAdminCalendarCustomerDialog);
  elements.adminCalendarCustomerDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeAdminCalendarCustomerDialog();
  });
  elements.adminCalendarCustomerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    syncAdminCustomerFromModal();
    const name = String(state.adminCustomerForm.name || '').trim();
    const email = String(state.adminCustomerForm.email || '').trim();
    const phone = String(state.adminCustomerForm.phone || '').trim();
    if (!name || !email || !phone) {
      showNotice({ title: 'Notice', body: 'Please fill customer name, email, and contact number.' });
      return;
    }
    if (!isValidEmail(email)) {
      showNotice({ title: 'Notice', body: 'Please enter a valid email address.' });
      return;
    }
    if (phone.length !== 10) {
      showNotice({ title: 'Notice', body: 'Contact number must be 10 digits.' });
      return;
    }
    await refreshAdminCustomerContext().catch(() => {});
    const pendingAction = pendingAdminCalendarBookingAction;
    closeAdminCalendarCustomerDialog();
    if (typeof pendingAction === 'function') pendingAction();
  });
  elements.membershipMembersGrid?.addEventListener('input', (event) => {
    const target = event?.target;
    if (!target || !(target instanceof HTMLInputElement)) return;
    if (String(target.getAttribute('data-member-field') || '') !== 'contactNumber') return;
    const normalized = normalizeTenDigitMobile(target.value);
    if (target.value !== normalized) target.value = normalized;
  });
  elements.joinAsMemberBtn?.addEventListener('click', () => {
    if (!state.user) {
      openAuthFromLanding('join-member');
      return;
    }
    state.postLoginChoice = 'join-member';
    state.activeUserTab = 'membership';
    window.location.hash = '#membership';
    render();
    requestAnimationFrame(() => {
      document.querySelector('[aria-label="Membership"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.topExplorePlansBtn?.addEventListener('click', () => {
    if (state.user) {
      ensurePostLoginDashboardChoice();
      state.activeUserTab = 'services';
      window.location.hash = '#services';
      render();
      requestAnimationFrame(() => {
        elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    openAuthFromLanding('continue-member');
  });
  document.querySelectorAll('[data-member-choice-join]').forEach((btn) => {
    btn.addEventListener('click', openMembershipPlansFromLanding);
  });
  elements.continueAsMemberBtn?.addEventListener('click', () => {
    if (!state.user) {
      openAuthFromLanding('continue-member');
      return;
    }
    if (!isCurrentUserMembershipActive()) {
      state.postLoginChoice = 'join-member';
      state.activeUserTab = 'membership';
      window.location.hash = '#membership';
      render();
      requestAnimationFrame(() => {
        document.querySelector('[aria-label="Membership"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    state.postLoginChoice = 'continue-member';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      document.querySelector('[aria-label="Services"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.continueAsNonMemberBtn?.addEventListener('click', () => {
    if (!state.user) {
      openAuthFromLanding('continue-non-member');
      return;
    }
    state.postLoginChoice = 'continue-non-member';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      document.querySelector('[aria-label="Services"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  elements.userTabServices?.addEventListener('click', () => {
    if (state.activeUserTab !== 'services') {
      resetServiceBrowserState();
    }
    state.selectedHydrogenFlow = 'topup';
    state.servicesBackTargetTab = '';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
  });
  elements.userTabMembership?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.servicesBackTargetTab = '';
    state.activeUserTab = 'membership';
    window.location.hash = '#membership';
    render();
  });
  elements.userTabBookings?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.servicesBackTargetTab = '';
    state.activeUserTab = 'bookings';
    window.location.hash = '#bookings';
    render();
    requestAnimationFrame(() => {
      elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.userTabCart?.addEventListener('click', async () => {
    resetServiceBrowserState();
    state.servicesBackTargetTab = '';
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
    await loadPublicCoupons();
    render();
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.cartBtn?.addEventListener('click', async () => {
    if (state.user?.role !== 'user' || !state.postLoginChoice) return;
    resetServiceBrowserState();
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
    await loadPublicCoupons();
    render();
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.bookingsViewCartBtn?.addEventListener('click', () => {
    if (state.user?.role !== 'user' || !state.postLoginChoice) return;
    resetServiceBrowserState();
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
    render();
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  [elements.myBookingsFilterAll, elements.myBookingsFilterUpcoming, elements.myBookingsFilterCompleted, elements.myBookingsFilterScheduleLater]
    .filter(Boolean)
    .forEach((button) => {
      button.addEventListener('click', () => {
        state.userBookingsFilter = String(button.dataset.bookingFilter || 'all').trim() || 'all';
        render();
      });
    });
  elements.myBookingsScheduleLaterFooter?.addEventListener('click', () => {
    state.activeUserTab = 'bookings';
    state.userBookingsFilter = 'schedule_later';
    window.location.hash = '#bookings';
    render();
    requestAnimationFrame(() => {
      elements.myBookingsFilterScheduleLater?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      elements.myBookingsFilterScheduleLater?.focus?.();
    });
  });
  elements.membershipScheduleLaterFooter?.addEventListener('click', () => {
    state.activeUserTab = 'bookings';
    state.userBookingsFilter = 'schedule_later';
    window.location.hash = '#bookings';
    render();
    requestAnimationFrame(() => {
      elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      elements.myBookingsFilterScheduleLater?.focus?.();
    });
  });
  elements.memberSessionCountDecBtn?.addEventListener('click', () => {
    const current = Number(state.memberSessionDisplayCount || 0);
    state.memberSessionDisplayCount = Math.max(0, current - 1);
    render();
  });
  elements.memberSessionCountIncBtn?.addEventListener('click', () => {
    const current = Number(state.memberSessionDisplayCount || 0);
    state.memberSessionDisplayCount = Math.min(64, Math.max(0, current + 1));
    render();
  });
  elements.membershipBackBtn?.addEventListener('click', () => {
    if (state.user?.role === 'user' && state.membershipBrowseVisible) {
      state.membershipBrowseVisible = false;
      state.membershipAdditions = {};
      render();
      requestAnimationFrame(() => {
        elements.membershipDashboard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    state.postLoginChoice = '';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      elements.memberChoiceGate?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipNextBtn?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.servicesBackTargetTab = 'membership';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  const openHydrogenServicesFlow = ({ flow = 'schedule', target = 'hydrogen' } = {}) => {
    resetServiceBrowserState();
    const allowTopUpFlow = isCurrentUserMembershipActive();
    const resolvedFlow = flow === 'topup' && !allowTopUpFlow ? 'schedule' : flow;
    const resolvedTarget = target === 'topup' && !allowTopUpFlow ? 'hydrogen' : target;
    state.selectedHydrogenFlow = resolvedFlow;
    state.servicesBackTargetTab = state.activeUserTab === 'membership' ? 'membership' : '';
    state.activeUserTab = 'services';
    state.selectedServiceCategory = 'HYDROGEN SESSION';
    state.expandedServiceCategories = {
      'HYDROGEN SESSION': true,
      'IV THERAPIES': false,
      'IV SHOTS': false,
    };
    window.location.hash = '#services';
    render();

    const scrollToTarget = (attempt = 0) => {
      const topOffset = Math.max(64, Number(document.querySelector('.top-nav')?.offsetHeight || 0) + 12);
      const hydrogenSection = document.querySelector('#service-category-details-hydrogen-session');
      const topUpAnchor = document.querySelector('#hydrogen-topup-anchor');
      const targetElement = resolvedTarget === 'topup' ? topUpAnchor || hydrogenSection : hydrogenSection;
      if (targetElement) {
        const y = window.scrollY + targetElement.getBoundingClientRect().top - topOffset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        return;
      }
      if (attempt >= 8) {
        elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      window.setTimeout(() => scrollToTarget(attempt + 1), 120);
    };
    requestAnimationFrame(() => scrollToTarget(0));
  };

  elements.membershipCardScheduleBtn?.addEventListener('click', () => {
    openHydrogenServicesFlow({ flow: 'schedule', target: 'hydrogen' });
  });
  elements.membershipCardTopUpBtn?.addEventListener('click', () => {
    if (isCurrentUserMembershipActive()) {
      openHydrogenServicesFlow({ flow: 'topup', target: 'topup' });
      return;
    }
    state.activeUserTab = 'membership';
    state.membershipBrowseVisible = true;
    window.location.hash = '#membership';
    render();
    requestAnimationFrame(() => {
      elements.membershipBrowsePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipQuickAddPersonBtn?.addEventListener('click', () => {
    state.activeUserTab = 'membership';
    state.membershipBrowseVisible = true;
    window.location.hash = '#membership';
    render();
    requestAnimationFrame(() => {
      elements.membershipBrowsePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipQuickHistoryBtn?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.activeUserTab = 'bookings';
    window.location.hash = '#bookings';
    render();
    requestAnimationFrame(() => {
      elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipTakeMembershipBtn?.addEventListener('click', () => {
    state.membershipBrowseVisible = true;
    render();
    requestAnimationFrame(() => {
      elements.membershipBrowsePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipStatBecomeCard?.addEventListener('click', () => {
    if (isCurrentUserMembershipActive()) return;
    state.activeUserTab = 'membership';
    state.membershipBrowseVisible = true;
    window.location.hash = '#membership';
    render();
    requestAnimationFrame(() => {
      elements.membershipBrowsePanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.membershipStatValidCard?.addEventListener('click', () => {
    openMembershipRosterDialog().catch((error) => {
      showNotice({
        title: 'Unable to open covered members',
        body: error?.message || 'Please try again in a moment.',
      });
    });
  });
  elements.membershipAddPersonBtn?.addEventListener('click', () => {
    const rosterLoaded = Boolean(state.membershipRoster && typeof state.membershipRoster === 'object');
    const slotsRemaining = rosterLoaded ? Number(state.membershipRoster?.slotsRemaining) : Number.NaN;
    if (!rosterLoaded || (Number.isFinite(slotsRemaining) && slotsRemaining > 0)) {
      openMembershipAddPersonDialog();
      return;
    }
    openMembershipAddPersonUpgradeCheckoutDialog();
  });
  elements.servicesBackBtn?.addEventListener('click', () => {
    resetServiceBrowserState();
    const backTargetTab = String(state.servicesBackTargetTab || '').trim();
    state.servicesBackTargetTab = '';
    if (backTargetTab === 'membership' || isCurrentUserMembershipActive()) {
      state.postLoginChoice = state.postLoginChoice || 'continue-member';
      state.activeUserTab = 'membership';
      window.location.hash = '#membership';
      render();
      requestAnimationFrame(() => {
        elements.membershipSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    if (state.postLoginChoice === 'join-member') {
      state.activeUserTab = 'membership';
      window.location.hash = '#membership';
      render();
      requestAnimationFrame(() => {
        elements.membershipSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    state.postLoginChoice = '';
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      elements.memberChoiceGate?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.servicesNextBtn?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
    render();
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.bookingsBackBtn?.addEventListener('click', () => {
    resetServiceBrowserState();
    state.activeUserTab = 'services';
    window.location.hash = '#services';
    render();
    requestAnimationFrame(() => {
      elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.cartContinueShoppingBtn?.addEventListener('click', () => {
    navigateToUserServices();
  });
  elements.cartEmptyBrowseBtn?.addEventListener('click', () => {
    navigateToUserServices();
  });
  elements.cartViewBookingsBtn?.addEventListener('click', () => {
    navigateToUserBookings();
  });
  elements.cartEmptyBookingsBtn?.addEventListener('click', () => {
    navigateToUserBookings();
  });

  // Public Book Session Button
  const handlePublicBookSession = async () => {
    await enterGuestBookingMode({ scrollToServices: true });
  };

  const publicBookSessionButtons = new Set([
    elements.publicBookSessionBtn,
    ...document.querySelectorAll('[data-public-book-session]'),
  ]);
  publicBookSessionButtons.forEach((button) => {
    button?.addEventListener('click', handlePublicBookSession);
  });

  // Guest Form Handlers
  elements.guestCheckoutSubmit?.addEventListener('click', handleGuestCheckoutSubmit);
  elements.guestCheckoutCancel?.addEventListener('click', () => {
    elements.guestCheckoutDialog?.close();
  });
  elements.closeGuestCheckoutDialog?.addEventListener('click', () => {
    elements.guestCheckoutDialog?.close();
  });

  // Checkout Options Handlers
  elements.checkoutWithGoogle?.addEventListener('click', () => {
    elements.checkoutOptionsDialog?.close();
    if (window.gapi && window.gapi.auth2) {
      window.gapi.auth2.getAuthInstance().signIn();
    }
  });

  elements.checkoutWithEmailLogin?.addEventListener('click', () => {
    elements.checkoutOptionsDialog?.close();
    state.showAuthCard = true;
    state.auth = { mode: 'login' };
    render();
  });

  elements.checkoutAsGuest?.addEventListener('click', () => {
    elements.checkoutOptionsDialog?.close();
    elements.guestCheckoutDialog?.showModal();
    elements.guestCheckoutName?.focus();
  });

  elements.closeCheckoutOptionsDialog?.addEventListener('click', () => {
    elements.checkoutOptionsDialog?.close();
  });

  elements.checkoutOptionsContinueShopping?.addEventListener('click', () => {
    elements.checkoutOptionsDialog?.close();
  });

  elements.bookingsPayAllBtn?.addEventListener('click', async () => {
    try {
      await payAllUserBookings();
    } catch (error) {
      showNotice({ title: 'Payment failed', body: error?.message || 'Unable to start payment right now.' });
    }
  });
  elements.closeProfileDialogBtn?.addEventListener('click', closeProfileDialog);
  elements.cancelProfileBtn?.addEventListener('click', closeProfileDialog);
  elements.adminUserSessionCloseBtn?.addEventListener('click', closeAdminUserSessionDialog);
  elements.profileAge?.addEventListener('input', () => {
    elements.profileAge.value = normalizeProfileAgeInput(elements.profileAge.value);
  });
  elements.profileForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = elements.profileForm.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    try {
      elements.profileFormMessage.textContent = '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }
      await saveProfile();
    } catch (error) {
      elements.profileFormMessage.textContent = error.message || 'Unable to save profile.';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel || 'Save Profile';
      }
    }
  });
  elements.profileAvatarFile?.addEventListener('change', handleProfileAvatarSelection);

  elements.closeMembershipDialogBtn?.addEventListener('click', closeMembershipDialog);
  elements.cancelMembershipBtn?.addEventListener('click', closeMembershipDialog);
  elements.membershipForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await submitMembershipCheckout();
  });
  elements.closeMembershipRosterDialogBtn?.addEventListener('click', closeMembershipRosterDialog);
  elements.cancelMembershipRosterBtn?.addEventListener('click', closeMembershipRosterDialog);
  elements.membershipRosterDialog?.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeMembershipRosterDialog();
  });
  elements.closeMembershipAddPersonDialogBtn?.addEventListener('click', closeMembershipAddPersonDialog);
  elements.cancelMembershipAddPersonBtn?.addEventListener('click', closeMembershipAddPersonDialog);
  elements.membershipAddPersonForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = elements.saveMembershipAddPersonBtn || elements.membershipAddPersonForm?.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    try {
      if (elements.membershipAddPersonError) {
        elements.membershipAddPersonError.hidden = true;
        elements.membershipAddPersonError.textContent = '';
      }
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';
      }
      await submitMembershipAddPerson();
    } catch (error) {
      if (elements.membershipAddPersonError) {
        elements.membershipAddPersonError.hidden = false;
        elements.membershipAddPersonError.textContent = error?.message || 'Unable to add person right now.';
      } else {
        showNotice({ title: 'Unable to add person', body: error?.message || 'Unable to add person right now.' });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel || 'Save';
      }
    }
  });
  elements.membershipApplyCouponBtn?.addEventListener('click', async () => {
    await previewMembershipCoupon();
  });
  elements.membershipCouponCode?.addEventListener('input', () => {
    state.membershipCouponPreview = null;
    renderMembershipCouponPreview();
    renderMembershipCheckoutSummary();
  });

  elements.adminDiscountForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fallbackUser = findAdminUserByContact(
      elements.adminDiscountEmail?.value,
      elements.adminDiscountPhone?.value
    );
    if (fallbackUser) {
      await applyAdminUserDiscount({
        userId: fallbackUser.id,
        email: elements.adminDiscountEmail?.value,
        phone: elements.adminDiscountPhone?.value,
        discountPercent: elements.adminDiscountPercent?.value,
      });
      return;
    }
    await saveAdminDiscountPhone();
  });
  elements.adminDiscountGateBtn?.addEventListener('click', async () => {
    await unlockAdminDiscounts();
  });
  elements.adminDiscountUserSearch?.addEventListener('input', (event) => {
    const nextQuery = String(event.target.value || '').trim();
    state.adminDiscountSearch = nextQuery;
    scheduleAdminDiscountSearch(nextQuery);
  });
  elements.adminDiscountUserSearch?.addEventListener('focus', () => {
    if (!state.adminDiscountDropdownOpen) {
      state.adminDiscountDropdownOpen = true;
      scheduleAdminDiscountSearch(state.adminDiscountSearch);
      render();
    }
  });
  elements.adminDiscountUserSearch?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      state.adminDiscountDropdownOpen = false;
      render();
    }
  });
  elements.adminDiscountBulkApplyBtn?.addEventListener('click', async () => {
    await applyAdminDiscountToSelected();
  });
  elements.adminDiscountSelectedBtn?.addEventListener('click', () => {
    state.adminDiscountSelectedWindowOpen = !state.adminDiscountSelectedWindowOpen;
    render();
  });
  elements.bookingNotesAddBtn?.addEventListener('click', async () => {
    await addBookingNote();
  });
  elements.bookingNotesCloseBtn?.addEventListener('click', closeBookingNotesDialog);
  elements.bookingEmailTimelineCloseBtn?.addEventListener('click', closeBookingEmailTimelineDialog);
  elements.bookingEmailTimelineResendBtn?.addEventListener('click', async () => {
    await resendPaymentLinkFromTimeline();
  });
  elements.adminEmailAnalyticsApplyBtn?.addEventListener('click', async () => {
    state.adminEmailAnalyticsFilters.startDate = String(elements.adminEmailAnalyticsStartDate?.value || '').trim();
    state.adminEmailAnalyticsFilters.endDate = String(elements.adminEmailAnalyticsEndDate?.value || '').trim();
    try {
      await loadDashboardData();
      render();
    } catch (error) {
      alert(error?.message || 'Unable to apply analytics date filters.');
    }
  });
  elements.adminEmailAnalyticsResetBtn?.addEventListener('click', async () => {
    state.adminEmailAnalyticsFilters = { startDate: '', endDate: '' };
    if (elements.adminEmailAnalyticsStartDate) elements.adminEmailAnalyticsStartDate.value = '';
    if (elements.adminEmailAnalyticsEndDate) elements.adminEmailAnalyticsEndDate.value = '';
    try {
      await loadDashboardData();
      render();
    } catch (error) {
      alert(error?.message || 'Unable to reset analytics date filters.');
    }
  });
  elements.adminEmailAnalyticsExportBtn?.addEventListener('click', () => {
    exportPaymentLinkAnalyticsCsv();
  });
  elements.bookingEmailTimelineCloseBtn?.addEventListener('click', closeBookingEmailTimelineDialog);
  elements.bookingEmailTimelineResendBtn?.addEventListener('click', async () => {
    await resendPaymentLinkFromTimeline();
  });
  elements.adminEmailAnalyticsApplyBtn?.addEventListener('click', async () => {
    state.adminEmailAnalyticsFilters.startDate = String(elements.adminEmailAnalyticsStartDate?.value || '').trim();
    state.adminEmailAnalyticsFilters.endDate = String(elements.adminEmailAnalyticsEndDate?.value || '').trim();
    try {
      await loadDashboardData();
      render();
    } catch (error) {
      showNotice({ title: 'Error', type: 'error', body: error?.message || 'Unable to apply analytics date filters.' });
    }
  });
  elements.adminEmailAnalyticsResetBtn?.addEventListener('click', async () => {
    state.adminEmailAnalyticsFilters = { startDate: '', endDate: '' };
    if (elements.adminEmailAnalyticsStartDate) elements.adminEmailAnalyticsStartDate.value = '';
    if (elements.adminEmailAnalyticsEndDate) elements.adminEmailAnalyticsEndDate.value = '';
    try {
      await loadDashboardData();
      render();
    } catch (error) {
      showNotice({ title: 'Error', type: 'error', body: error?.message || 'Unable to reset analytics date filters.' });
    }
  });
  elements.adminEmailAnalyticsExportBtn?.addEventListener('click', () => {
    exportPaymentLinkAnalyticsCsv();
  });
  elements.adminCouponForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveAdminCoupon({ sendEmail: true });
  });
  elements.adminCouponSaveOnlyBtn?.addEventListener('click', async () => {
    await saveAdminCoupon({ sendEmail: false });
  });
  elements.adminCouponType?.addEventListener('change', renderAdminCouponFormByType);
  elements.adminCouponExpiryDate?.addEventListener('change', syncAdminCouponExpiryValue);
  elements.adminCouponExpiryTime?.addEventListener('change', syncAdminCouponExpiryValue);
  elements.userApplyCouponBtn?.addEventListener('click', async () => {
    await previewCartCoupon();
  });
  elements.userCouponCode?.addEventListener('input', () => {
    state.cartCouponPreview = null;
    renderCartCouponPreview();
    renderUserCheckoutSummary(state.bookings || []);
  });

  elements.openBookingBtn?.addEventListener('click', () => openDialog());
  elements.experienceBookBtn?.addEventListener('click', () => {
    if (hasCurrentUserUsedExperienceSession()) {
      showNotice({ title: 'Demo already booked', body: 'Demo hydrogen session can be attended only once.' });
      return;
    }
    state.forceExperienceBooking = true;
    openDialog();
  });
  elements.bookingForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    await upsertBooking();
  });
  elements.serviceName?.addEventListener('change', () => {
    updateBookingAddOnOptions();
    updateBookingSummary();
  });
  elements.addOnService?.addEventListener('change', () => {
    state.selectedBookingAddOnServiceName = elements.addOnService.value;
    if (state.bookingDialogContext) state.bookingDialogContext.addOnScheduleManuallyEdited = false;
    updateBookingAddOnOptions();
    updateBookingSummary();
  });
  elements.addOnDate?.addEventListener('change', () => {
    if (state.bookingDialogContext) {
      state.bookingDialogContext.addOnScheduleManuallyEdited = true;
      state.bookingDialogContext.defaultAddOnBookingDate = String(elements.addOnDate?.value || '').trim();
    }
    updateBookingAddOnOptions();
  });
  elements.addOnTime?.addEventListener('change', () => {
    if (state.bookingDialogContext) {
      state.bookingDialogContext.addOnScheduleManuallyEdited = true;
      state.bookingDialogContext.defaultAddOnBookingTime = normalizeSlotStartTime(String(elements.addOnTime?.value || '').trim());
    }
  });
  elements.bookingDate?.addEventListener('change', () => {
    updateTimeSlotsByDate();
    updateBookingAddOnOptions();
    updateBookingSummary();
  });
  elements.bookingTime?.addEventListener('change', () => {
    if (state.bookingDialogContext && !state.bookingDialogContext.addOnScheduleManuallyEdited) {
      state.bookingDialogContext.defaultAddOnBookingTime = normalizeSlotStartTime(String(elements.bookingTime?.value || '').trim());
    }
    updateBookingAddOnOptions();
    updateBookingSummary();
  });
  elements.bookingCustomerName?.addEventListener('input', syncAdminCustomerFromBookingModal);
  elements.bookingCustomerEmail?.addEventListener('input', syncAdminCustomerFromBookingModal);
  elements.bookingCustomerPhone?.addEventListener('input', syncAdminCustomerFromBookingModal);
  enforceTenDigitMobileInput(elements.bookingCustomerPhone);
  elements.closeDialogBtn?.addEventListener('click', closeDialog);
  elements.cancelDialogBtn?.addEventListener('click', closeDialog);

  elements.searchInput?.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    render();
  });
  elements.searchBtn?.addEventListener('click', () => {
    state.filters.search = elements.searchInput.value.trim().toLowerCase();
    render();
    requestAnimationFrame(() => {
      elements.adminBookingTableBody?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  elements.statusFilter?.addEventListener('change', (event) => {
    state.filters.status = event.target.value;
    render();
  });
  elements.dateFilter?.addEventListener('change', (event) => {
    state.filters.date = event.target.value;
    render();
  });
  elements.resetFiltersBtn?.addEventListener('click', () => {
    state.filters = { search: '', status: 'all', date: '' };
    elements.searchInput.value = '';
    elements.statusFilter.value = 'all';
    elements.dateFilter.value = '';
    render();
  });

  elements.adminHistoryToggleBtn?.addEventListener('click', () => {
    state.adminActiveTab = 'bookings';
    render();
  });

  elements.adminPendingBookingSearch?.addEventListener('input', (event) => {
    state.adminPendingBookingSearch = String(event.target.value || '').trim().toLowerCase();
    render();
  });

  const onAdminPendingBookingDateFilterChange = () => {
    state.adminPendingBookingDateFilters.startDate = String(elements.adminPendingBookingStartDate?.value || '').trim();
    state.adminPendingBookingDateFilters.endDate = String(elements.adminPendingBookingEndDate?.value || '').trim();
    render();
  };
  elements.adminPendingBookingStartDate?.addEventListener('change', onAdminPendingBookingDateFilterChange);
  elements.adminPendingBookingEndDate?.addEventListener('change', onAdminPendingBookingDateFilterChange);
  elements.adminPendingBookingDateResetBtn?.addEventListener('click', () => {
    state.adminPendingBookingDateFilters = { startDate: '', endDate: '' };
    if (elements.adminPendingBookingStartDate) elements.adminPendingBookingStartDate.value = '';
    if (elements.adminPendingBookingEndDate) elements.adminPendingBookingEndDate.value = '';
    render();
  });

  elements.adminAllBookingSearch?.addEventListener('input', (event) => {
    state.adminAllBookingSearch = String(event.target.value || '').trim().toLowerCase();
    render();
  });

  elements.adminAllBookingModeToggleBtn?.addEventListener('click', () => {
    const currentMode = String(state.adminAllBookingViewMode || 'history').trim().toLowerCase();
    state.adminAllBookingViewMode = currentMode === 'today' ? 'history' : 'today';
    if (state.adminAllBookingViewMode === 'today') {
      state.adminAllBookingSlotFilters.date = getTodayIsoDate();
      state.adminAllBookingSlotFilters.time = '';
    } else {
      clearAdminAllBookingSlotFilters();
    }
    state.adminActiveTab = 'bookings';
    render();
  });

  const onAdminAllBookingSlotFilterChange = () => {
    state.adminAllBookingSlotFilters.date = String(elements.adminAllBookingSlotDate?.value || '').trim();
    state.adminAllBookingSlotFilters.time = String(elements.adminAllBookingSlotTime?.value || '').trim();
    render();
  };
  const onAdminAllBookingDateFilterChange = () => {
    state.adminAllBookingDateFilters.startDate = String(elements.adminAllBookingStartDate?.value || '').trim();
    state.adminAllBookingDateFilters.endDate = String(elements.adminAllBookingEndDate?.value || '').trim();
    render();
  };
  elements.adminAllBookingStartDate?.addEventListener('change', onAdminAllBookingDateFilterChange);
  elements.adminAllBookingEndDate?.addEventListener('change', onAdminAllBookingDateFilterChange);
  elements.adminAllBookingDateResetBtn?.addEventListener('click', () => {
    state.adminAllBookingDateFilters = { startDate: '', endDate: '' };
    state.adminAllBookingSearch = '';
    if (elements.adminAllBookingStartDate) elements.adminAllBookingStartDate.value = '';
    if (elements.adminAllBookingEndDate) elements.adminAllBookingEndDate.value = '';
    if (elements.adminAllBookingSearch) elements.adminAllBookingSearch.value = '';
    render();
  });
  elements.adminAllBookingDatePrevBtn?.addEventListener('click', () => {
    shiftAdminAllBookingDateFilters(-1);
    render();
  });
  elements.adminAllBookingDateNextBtn?.addEventListener('click', () => {
    shiftAdminAllBookingDateFilters(1);
    render();
  });
  elements.adminAllBookingSlotDate?.addEventListener('change', () => {
    state.adminAllBookingSlotFilters.date = String(elements.adminAllBookingSlotDate?.value || '').trim();
    state.adminAllBookingSlotFilters.time = '';
    if (elements.adminAllBookingSlotTime) elements.adminAllBookingSlotTime.value = '';
    render();
  });
  elements.adminAllBookingSlotTime?.addEventListener('change', onAdminAllBookingSlotFilterChange);
  elements.adminAllBookingSlotResetBtn?.addEventListener('click', () => {
    state.adminAllBookingSlotFilters = { date: '', time: '' };
    if (elements.adminAllBookingSlotDate) elements.adminAllBookingSlotDate.value = '';
    if (elements.adminAllBookingSlotTime) elements.adminAllBookingSlotTime.value = '';
    render();
  });



  elements.adminSessionSearch?.addEventListener('input', (event) => {
    state.adminSessionSearch = String(event.target.value || '').trim().toLowerCase();
    render();
  });

  elements.adminMembershipSearch?.addEventListener('input', (event) => {
    state.adminMembershipSearch = String(event.target.value || '').trim().toLowerCase();
    render();
  });
  elements.adminRescheduleSearch?.addEventListener('input', (event) => {
    state.adminRescheduleSearch = String(event.target.value || '').trim().toLowerCase();
    render();
  });
  elements.adminRescheduleDate?.addEventListener('change', (event) => {
    state.adminRescheduleDateFilter = String(event.target.value || '').trim();
    state.adminRescheduleSlotFilter = '';
    state.adminRescheduleOtpRequested = {};
    render();
  });
  elements.adminRescheduleDateClearBtn?.addEventListener('click', () => {
    state.adminRescheduleDateFilter = '';
    state.adminRescheduleSlotFilter = '';
    state.adminRescheduleOtpRequested = {};
    if (elements.adminRescheduleDate) elements.adminRescheduleDate.value = '';
    render();
  });
  if (elements.adminCouponExpiresAt) {
    elements.adminCouponExpiresAt.min = `${getTodayIsoDate()}T00:00`;
  }
  if (elements.adminCouponExpiryDate) {
    elements.adminCouponExpiryDate.min = getTodayIsoDate();
  }
  elements.adminRescheduleViewToggleBtn?.addEventListener('click', () => {
    state.adminRescheduleView = state.adminRescheduleView === 'rescheduled' ? 'queue' : 'rescheduled';
    state.adminRescheduleOtpRequested = {};
    render();
  });
  elements.adminCalendarDate?.addEventListener('change', async (event) => {
    state.adminCalendarDate = String(event.target.value || '').trim() || getTodayIsoDate();
    state.adminCalendarMonth = state.adminCalendarDate.slice(0, 7);
    await loadAdminCalendarAvailability();
  });
  elements.adminCalendarCategory?.addEventListener('change', async (event) => {
    state.adminCalendarCategory = String(event.target.value || '').trim().toUpperCase() || 'HYDROGEN SESSION';
    state.adminCalendarServiceName = '';
    state.adminCalendarDayCache = {};
    await loadAdminCalendarAvailability();
  });
  elements.adminCalendarService?.addEventListener('change', (event) => {
    state.adminCalendarServiceName = String(event.target.value || '').trim();
    renderAdminCalendar();
  });
  elements.adminCalendarPrevMonthBtn?.addEventListener('click', async () => {
    initializeAdminCalendarState();
    const [year, month] = String(state.adminCalendarMonth || getTodayIsoDate().slice(0, 7)).split('-').map(Number);
    const nextDate = new Date(year, (month || 1) - 2, 1);
    state.adminCalendarMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    syncAdminCalendarDateToVisibleMonth();
    await loadAdminCalendarAvailability({ silent: true });
    render();
  });
  elements.adminCalendarNextMonthBtn?.addEventListener('click', async () => {
    initializeAdminCalendarState();
    const maxMonth = getMaxBookingIsoDate().slice(0, 7);
    if (String(state.adminCalendarMonth || '').localeCompare(maxMonth) >= 0) return;
    const [year, month] = String(state.adminCalendarMonth || getTodayIsoDate().slice(0, 7)).split('-').map(Number);
    const nextDate = new Date(year, month || 1, 1);
    state.adminCalendarMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    syncAdminCalendarDateToVisibleMonth();
    await loadAdminCalendarAvailability({ silent: true });
    render();
  });
  elements.adminCalendarRefreshBtn?.addEventListener('click', async () => {
    state.adminCalendarDayCache = {};
    await loadAdminCalendarAvailability({ force: true });
  });
  elements.adminCalendarBookConsultationBtn?.addEventListener('click', () => {
    openAdminConsultationBookingFromCalendar();
  });
  elements.adminCalendarClearDetailsBtn?.addEventListener('click', async () => {
    await clearAdminCalendarCustomerDetails();
  });

  elements.adminStatTotal?.addEventListener('click', () => {
    state.adminActiveTab = 'bookings';
    state.adminAllBookingViewMode = 'today';
    state.adminAllBookingSlotFilters.date = getTodayIsoDate();
    state.adminAllBookingSlotFilters.time = '';
    render();
    requestAnimationFrame(() => {
      elements.adminAllBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  elements.adminHistoryCard?.addEventListener('click', () => {
    state.adminActiveTab = 'bookings';
    state.adminAllBookingViewMode = 'history';
    clearAdminAllBookingSlotFilters();
    render();
  });

  elements.adminTabBookings?.addEventListener('click', () => {
    state.adminActiveTab = 'bookings';
    state.adminAllBookingViewMode = 'history';
    clearAdminAllBookingSlotFilters();
    render();
  });
  elements.adminTabUserBookings?.remove();
  elements.adminTabSessions?.addEventListener('click', () => {
    state.adminActiveTab = 'sessions';
    render();
  });
  elements.adminTabCalendar?.addEventListener('click', () => {
    state.adminActiveTab = 'calendar';
    render();
  });
  elements.adminTabMemberships?.addEventListener('click', () => {
    state.adminActiveTab = 'memberships';
    render();
  });
  elements.adminTabRescheduled?.addEventListener('click', () => {
    state.adminActiveTab = 'rescheduled';
    render();
  });
  elements.adminTabCoupons?.addEventListener('click', () => {
    state.adminActiveTab = 'coupons';
    render();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (state.adminDiscountDropdownOpen) {
      if (elements.adminDiscountDropdown?.contains(target) || elements.adminDiscountUserSearch?.contains(target)) {
        return;
      }
      state.adminDiscountDropdownOpen = false;
      render();
    }

    if (!state.adminDiscountSelectedWindowOpen) return;
    if (elements.adminDiscountSelectedWindow?.contains(target) || elements.adminDiscountSelectedBtn?.contains(target)) {
      return;
    }
    state.adminDiscountSelectedWindowOpen = false;
    render();
  });

  renderAuthMode();
}

function renderAuthMode(preserveMessage = false) {
  if (!preserveMessage) elements.authError.textContent = '';
  const isSignupDetailsStep = isRegisterMode && signupStage === 'details';
  const isSignupOtpStep = isRegisterMode && signupStage === 'otp';
  const isSignupPasswordStep = isRegisterMode && signupStage === 'password';
  const isForgotEmailStep = !isRegisterMode && isForgotPasswordMode && forgotPasswordStage === 'email';
  const isForgotOtpStep = !isRegisterMode && isForgotPasswordMode && forgotPasswordStage === 'otp';
  const isForgotPasswordStep = !isRegisterMode && isForgotPasswordMode && forgotPasswordStage === 'password';
  const isLoginStep = !isRegisterMode && !isForgotPasswordMode;
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

  if ((isSignupOtpStep || isSignupPasswordStep) && pendingSignupEmail) {
    elements.authEmail.value = pendingSignupEmail;
  }
  if ((isForgotOtpStep || isForgotPasswordStep) && pendingForgotEmail) {
    elements.authEmail.value = pendingForgotEmail;
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

  elements.authSwitchText.textContent = isRegisterMode
    ? 'Already have an account?'
    : "Don't have an account?";
  elements.authSwitchBtn.textContent = isRegisterMode ? 'Sign in' : 'Register';
  elements.forgotPasswordBtn.textContent = isForgotPasswordMode ? 'Back to sign in' : 'Forgot password?';
  elements.forgotPasswordBtn.hidden = isRegisterMode;
  if (elements.googleAuthBtn) {
    elements.googleAuthBtn.hidden = !isLoginStep;
    elements.googleAuthBtn.href = buildApiUrl('/auth/google');
  }
  if (elements.authDivider) {
    elements.authDivider.hidden = !isLoginStep;
  }

  updateAuthOtpResendUI();
}

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

  const isSignupOtpStep = isRegisterMode && signupStage === 'otp';
  const isForgotOtpStep = !isRegisterMode && isForgotPasswordMode && forgotPasswordStage === 'otp';
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

  const availableAt = isSignupOtpStep ? signupOtpResendAvailableAt : forgotOtpResendAvailableAt;
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
  const seconds = Number.isFinite(Number(retryAfterSeconds)) && Number(retryAfterSeconds) > 0 ? Number(retryAfterSeconds) : AUTH_OTP_RESEND_COOLDOWN_MS / 1000;
  const nextAvailableAt = Date.now() + seconds * 1000;
  if (isSignup) {
    signupOtpResendAvailableAt = nextAvailableAt;
  } else {
    forgotOtpResendAvailableAt = nextAvailableAt;
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

async function resendAuthOtp() {
  if (!elements.authResendOtpBtn) return;

  const isSignupOtpStep = isRegisterMode && signupStage === 'otp';
  const isForgotOtpStep = !isRegisterMode && isForgotPasswordMode && forgotPasswordStage === 'otp';
  if (!isSignupOtpStep && !isForgotOtpStep) return;

  const availableAt = isSignupOtpStep ? signupOtpResendAvailableAt : forgotOtpResendAvailableAt;
  if (availableAt && Date.now() < availableAt) return;

  elements.authResendOtpBtn.disabled = true;

  try {
    if (isSignupOtpStep) {
      const email = pendingSignupEmail || elements.authEmail.value.trim();
      const name = pendingSignupName || elements.authName.value.trim() || 'User';
      const result = await api('/api/auth/register/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      pendingSignupEmail = email;
      pendingSignupName = name;
      showDevelopmentOtp(result.devOtp);
      elements.authError.textContent = result.message || 'Signup OTP resent.';
      applyAuthOtpResendCooldown({ isSignup: true });
      renderAuthMode(true);
      return;
    }

    const email = pendingForgotEmail || elements.authEmail.value.trim();
    const result = await api('/api/auth/password/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    pendingForgotEmail = email;
    showDevelopmentOtp(result.devOtp);
    elements.authError.textContent = result.message || 'Reset OTP resent.';
    applyAuthOtpResendCooldown({ isSignup: false });
    renderAuthMode(true);
  } catch (error) {
    const retryAfterSeconds = error?.data?.retryAfterSeconds;
    if (retryAfterSeconds) {
      applyAuthOtpResendCooldown({ isSignup: Boolean(isSignupOtpStep), retryAfterSeconds });
    }
    elements.authError.textContent = error.message || 'Failed to resend OTP.';
    updateAuthOtpResendUI();
  } finally {
    updateAuthOtpResendUI();
  }
}

async function submitAuth() {
  elements.authError.textContent = '';

  try {
    if (!isRegisterMode && !isForgotPasswordMode) {
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

    if (isForgotPasswordMode) {
      if (forgotPasswordStage === 'email') {
        const email = elements.authEmail.value.trim();
        const result = await api('/api/auth/password/forgot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        pendingForgotEmail = email;
        forgotPasswordStage = 'otp';
        applyAuthOtpResendCooldown({ isSignup: false });
        elements.authOtp.value = '';
        showDevelopmentOtp(result.devOtp);
        elements.authError.textContent = result.message || 'Password reset OTP sent.';
        renderAuthMode(true);
        return;
      }

      if (forgotPasswordStage === 'otp') {
        const otp = elements.authOtp.value.trim();
        const result = await api('/api/auth/password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: pendingForgotEmail || elements.authEmail.value.trim(),
            otp,
          }),
        });

        forgotPasswordStage = 'password';
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
          email: pendingForgotEmail || elements.authEmail.value.trim(),
          password,
        }),
      });

      isForgotPasswordMode = false;
      forgotPasswordStage = 'email';
      pendingForgotEmail = '';
      forgotOtpResendAvailableAt = 0;
      elements.authOtp.value = '';
      elements.authPassword.value = '';
      elements.authError.textContent = result.message || 'Password reset successful. Please login.';
      renderAuthMode(true);
      return;
    }

    if (signupStage === 'details') {
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

      pendingSignupName = name;
      pendingSignupEmail = email;
      signupStage = 'otp';
      applyAuthOtpResendCooldown({ isSignup: true });
      elements.authOtp.value = '';
      showDevelopmentOtp(result.devOtp);
      elements.authError.textContent = result.message || 'Signup OTP sent.';
      renderAuthMode(true);
      return;
    }

    if (signupStage === 'otp') {
      const otp = elements.authOtp.value.trim();
      const result = await api('/api/auth/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: pendingSignupEmail || elements.authEmail.value.trim(),
          otp,
        }),
      });

      signupStage = 'password';
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
        email: pendingSignupEmail || elements.authEmail.value.trim(),
        password,
      }),
    });

    signupStage = 'details';
    pendingSignupName = '';
    pendingSignupEmail = '';
    signupOtpResendAvailableAt = 0;
    elements.authForm.reset();
    await finishAuthSuccess(result);
  } catch (error) {
    if (state.user) {
      routeAfterAuthSuccess();
      render();
      return;
    }
    elements.authError.textContent = error.message;
  }
}

async function loadCurrentUser() {
  try {
    const result = await api('/api/auth/me');
    state.user = result.user;
    syncPostLoginChoiceWithMembership();
  } catch {
    state.user = null;
    storeAuthToken('');
  }
}

async function loadProfile() {
  const result = await api('/api/profile');
  state.user = { ...state.user, ...result.profile };
  syncPostLoginChoiceWithMembership();
}

function syncPostLoginChoiceWithMembership() {
  if (state.user?.role !== 'user') return;
  if (isCurrentUserMembershipActive()) {
    state.postLoginChoice = 'continue-member';
    return;
  }
  if (state.postLoginChoice === 'continue-member') {
    state.postLoginChoice = '';
  }
}

function isAdminCustomerFormReady() {
  return Boolean(
    String(state.adminCustomerForm.name || '').trim() &&
      String(state.adminCustomerForm.email || '').trim() &&
      String(state.adminCustomerForm.phone || '').trim()
  );
}

function getAdminCustomerValidationMessage() {
  const name = String(state.adminCustomerForm.name || '').trim();
  const email = String(state.adminCustomerForm.email || '').trim();
  const phone = normalizeTenDigitMobile(state.adminCustomerForm.phone || '');
  if (!name) return 'Customer name is required.';
  if (!email || !isValidEmail(email)) return 'Enter a valid customer email.';
  if (!phone || phone.length !== 10) return 'Enter a valid 10-digit contact number.';
  return '';
}

function isAdminCustomerFormValid() {
  return !getAdminCustomerValidationMessage();
}

function hasMembershipInBookingContext() {
  if (state.user?.role === 'admin') {
    return String(state.adminResolvedCustomer?.membershipStatus || '').trim().toLowerCase() === 'active';
  }
  return isCurrentUserMembershipActive();
}

function setBookingCustomerInlineMessage(message = '') {
  if (!elements.bookingCustomerInlineMessage) return;
  const text = String(message || '').trim();
  elements.bookingCustomerInlineMessage.textContent = text;
  elements.bookingCustomerInlineMessage.hidden = !text;
}

function syncBookingModalCustomerGate() {
  const isAdmin = state.user?.role === 'admin';
  const isValid = isAdminCustomerFormValid();
  if (elements.bookingCustomerStep) elements.bookingCustomerStep.hidden = !isAdmin;
  if (elements.bookingSchedulerSection) elements.bookingSchedulerSection.hidden = isAdmin && !isValid;
  if (elements.bookingSummary) elements.bookingSummary.hidden = isAdmin && !isValid ? true : elements.bookingSummary.hidden;
  if (isAdmin) {
    setBookingCustomerInlineMessage(isValid ? '' : getAdminCustomerValidationMessage());
  } else {
    setBookingCustomerInlineMessage('');
  }
}

function syncAdminCustomerFromBookingModal() {
  const prevName = String(state.adminCustomerForm?.name || '').trim();
  const prevEmail = String(state.adminCustomerForm?.email || '').trim();
  const prevPhone = normalizeTenDigitMobile(state.adminCustomerForm?.phone || '');
  const nextName = String(elements.bookingCustomerName?.value || '').trim().slice(0, 80);
  const nextEmail = String(elements.bookingCustomerEmail?.value || '').trim();
  const nextPhone = normalizeTenDigitMobile(elements.bookingCustomerPhone?.value || '');
  state.adminCustomerForm = {
    ...state.adminCustomerForm,
    name: nextName,
    email: nextEmail,
    phone: nextPhone,
  };
  if (elements.bookingCustomerName && elements.bookingCustomerName.value !== nextName) elements.bookingCustomerName.value = nextName;
  if (elements.bookingCustomerPhone && elements.bookingCustomerPhone.value !== nextPhone) elements.bookingCustomerPhone.value = nextPhone;
  if (elements.adminCalendarCustomerName) elements.adminCalendarCustomerName.value = nextName;
  if (elements.adminCalendarCustomerEmail) elements.adminCalendarCustomerEmail.value = nextEmail;
  if (elements.adminCalendarCustomerPhone) elements.adminCalendarCustomerPhone.value = nextPhone;
  syncBookingModalCustomerGate();
  const detailsChanged = prevName !== nextName || prevEmail !== nextEmail || prevPhone !== nextPhone;
  if (detailsChanged && isAdminCustomerFormValid()) {
    clearTimeout(adminCustomerRefreshTimer);
    adminCustomerRefreshTimer = window.setTimeout(async () => {
      try {
        await refreshAdminCustomerContext();
        if (elements.dialog?.open) {
          const selected = String(elements.serviceName?.value || '').trim();
          populateServiceOptions(selected);
          updateBookingAddOnOptions();
          updateBookingSummary();
          syncBookingModalCustomerGate();
        }
      } catch {
        // Keep current modal state; inline gate will continue guiding input.
      }
    }, 250);
  }
}

function hasAdminCustomerDetails() {
  return [state.adminCustomerForm.name, state.adminCustomerForm.email, state.adminCustomerForm.phone].some((value) =>
    String(value || '').trim()
  );
}

function setAdminCustomerMessage(message = '') {
  if (!elements.adminCustomerMessage) return;
  const text = String(message || '').trim();
  elements.adminCustomerMessage.textContent = text;
  elements.adminCustomerMessage.hidden = !text;
}

async function clearAdminCalendarCustomerDetails() {
  clearTimeout(adminCustomerRefreshTimer);
  state.adminCustomerForm = { name: '', email: '', phone: '' };
  state.adminResolvedCustomer = null;
  state.adminCalendarServiceName = '';
  state.adminCalendarDayCache = {};

  if (elements.adminCustomerName) elements.adminCustomerName.value = '';
  if (elements.adminCustomerEmail) elements.adminCustomerEmail.value = '';
  if (elements.adminCustomerPhone) elements.adminCustomerPhone.value = '';
  if (elements.adminCalendarCustomerName) elements.adminCalendarCustomerName.value = '';
  if (elements.adminCalendarCustomerEmail) elements.adminCalendarCustomerEmail.value = '';
  if (elements.adminCalendarCustomerPhone) elements.adminCalendarCustomerPhone.value = '';

  await refreshAdminCustomerContext();
}

async function refreshAdminCustomerContext() {
  if (state.user?.role !== 'admin') return;
  clearTimeout(adminCustomerRefreshTimer);
    state.ivSelections = {};
    state.selectedSingleSessionServiceName = '';
    state.singleSessionEditingBookingId = '';
    resetHydrogenComposer();
  state.selectedServiceDate = getTodayIsoDate();
  state.slotAvailability = {};
  state.slotCapacityByService = {};
  state.slotAvailabilityLoading = false;
  state.slotAutoShiftedNotice = '';
  try {
    await loadDashboardData();
    if (!isAdminCustomerFormReady()) {
      setAdminCustomerMessage('Booking page is ready. Enter customer details before saving the booking.');
    } else if (Number(state.adminResolvedCustomer?.discountPercent || 0) > 0) {
      setAdminCustomerMessage(
        `Customer details loaded. A ${Number(state.adminResolvedCustomer.discountPercent)}% service discount will apply for this phone number.`
      );
    } else if (state.adminResolvedCustomer?.membershipStatus === 'active') {
      setAdminCustomerMessage('Active membership found. Member pricing and membership-only services are loaded.');
    } else {
      setAdminCustomerMessage('Customer details loaded. Standard booking flow is ready.');
    }
  } catch (error) {
    setAdminCustomerMessage(error.message || 'Unable to refresh customer-specific pricing. Standard booking flow is still available.');
  }
  render();
}

async function fetchGeneralCouponsSafe(appliesTo) {
  const normalizedAppliesTo = String(appliesTo || '').trim().toLowerCase();
  try {
    const response = await api(`/api/coupons/general?appliesTo=${encodeURIComponent(normalizedAppliesTo)}`);
    const coupons = response?.coupons || [];
    const normalizedCoupons = Array.isArray(coupons)
      ? coupons.map((coupon) => normalizeGeneralCouponClient(coupon)).filter(Boolean)
      : [];
    return { coupons: normalizedCoupons, raw: response };
  } catch (error) {
    console.warn('Unable to load general coupons:', normalizedAppliesTo, error?.message || error);
    return { coupons: [], raw: null };
  }
}

async function loadPublicCoupons() {
  const [servicesCouponsResult, membershipCouponsResult] = await Promise.all([
    fetchGeneralCouponsSafe('services'),
    fetchGeneralCouponsSafe('membership'),
  ]);
  state.generalCoupons = {
    services: servicesCouponsResult?.coupons || [],
    membership: membershipCouponsResult?.coupons || [],
  };
  console.info('Public coupons payload (services):', servicesCouponsResult?.raw || null);
  console.info('Public coupons payload (membership):', membershipCouponsResult?.raw || null);
}

async function loadDashboardData() {
  if (state.isGuestUser && !state.user) {
    await loadGuestDashboardData();
    return;
  }
  if (state.user?.role === 'admin') {
    const analyticsParams = new URLSearchParams();
    if (state.adminEmailAnalyticsFilters?.startDate) analyticsParams.set('startDate', state.adminEmailAnalyticsFilters.startDate);
    if (state.adminEmailAnalyticsFilters?.endDate) analyticsParams.set('endDate', state.adminEmailAnalyticsFilters.endDate);
    const analyticsUrl = `/api/admin/analytics/payment-link-conversion${analyticsParams.toString() ? `?${analyticsParams.toString()}` : ''}`;
    const [
      bookingsResult,
      membershipOrdersResult,
      discountPhonesResult,
      couponsResult,
      genericServicesResult,
      adminUsersResult,
      paymentLinkAnalyticsResult,
    ] = await Promise.all([
      api('/api/bookings'),
      api('/api/admin/membership-orders'),
      api('/api/admin/discount-phones'),
      api('/api/admin/coupons'),
      api('/api/services'),
      api('/api/admin/users'),
      api(analyticsUrl),
    ]);
    state.bookings = bookingsResult.bookings || [];
    state.adminMembershipOrders = membershipOrdersResult.orders || [];
    state.adminDiscountPhones = discountPhonesResult.discountPhones || [];
    state.adminCoupons = couponsResult.coupons || [];
    state.adminUsers = adminUsersResult.users || [];
    state.generalCoupons = { services: [], membership: [] };
    state.adminPaymentLinkAnalytics = paymentLinkAnalyticsResult?.analytics || null;
    state.adminPaymentLinkAnalyticsRows = Array.isArray(paymentLinkAnalyticsResult?.rows) ? paymentLinkAnalyticsResult.rows : [];
    state.userMembershipOrders = [];
    state.membership = { plans: [], active: false, current: null };
    state.membershipBrowseVisible = false;
    state.services = genericServicesResult.services || [];
    state.adminResolvedCustomer = null;

    if (isAdminCustomerFormReady()) {
      try {
        const servicesResult = await api('/api/admin/services', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerName: state.adminCustomerForm.name,
            customerEmail: state.adminCustomerForm.email,
            customerPhone: state.adminCustomerForm.phone,
          }),
        });
        state.services = servicesResult.services || state.services;
        state.adminResolvedCustomer = servicesResult.resolvedCustomer || null;
      } catch {
        state.adminResolvedCustomer = null;
      }
    }
    initializeAdminCalendarState();
    await loadAdminCalendarAvailability({ silent: true });
  } else {
    const [servicesResult, bookingsResult, membershipResult, membershipOrdersResult] = await Promise.all([
      api('/api/services'),
      api('/api/bookings'),
      api('/api/membership/plans'),
      api('/api/membership/orders'),
    ]);
    state.services = servicesResult.services || [];
    cacheServicesCatalog(state.services);
    state.bookings = bookingsResult.bookings || [];
    state.membership = {
      plans: membershipResult.plans || [],
      active: Boolean(membershipResult.active),
      current: membershipResult.current || null,
    };
    state.userMembershipOrders = membershipOrdersResult.orders || [];
    await loadPublicCoupons();
    state.membershipBrowseVisible = Boolean(state.membership.active);
    state.membershipRoster = null;
    if (state.membership.active && Number(state.membership.current?.peopleCount || 0) >= 2) {
      try {
        state.membershipRoster = await api('/api/membership/members');
      } catch {
        state.membershipRoster = null;
      }
    }
    state.adminMembershipOrders = [];
    state.adminDiscountPhones = [];
    state.adminCoupons = [];
    state.adminResolvedCustomer = null;
    state.adminPaymentLinkAnalytics = null;
    state.adminPaymentLinkAnalyticsRows = [];
    state.adminCustomerForm = { name: '', email: '', phone: '' };
    state.adminCalendarDate = '';
    state.adminCalendarCategory = 'HYDROGEN SESSION';
    state.adminCalendarServiceName = '';
    state.adminCalendarAvailability = {};
    state.adminCalendarHoldCounts = {};
    state.adminCalendarCapacityByService = {};
    state.adminCalendarLoading = false;
    state.adminCalendarError = '';
    state.adminCalendarMonth = '';
    state.adminCalendarMonthLoading = false;
    state.adminCalendarDayCache = {};
    state.membershipCouponPreview = null;
    state.cartCouponPreview = null;
  }

  if (state.selectedServiceCategory) {
    const stillExists = state.services.some(
      (service) => String(service.category || '').toUpperCase() === state.selectedServiceCategory
    );
    if (!stillExists) state.selectedServiceCategory = null;
  }
  if (state.selectedHydrogenServiceName) {
    const hydrogenServiceExists = state.services.some((service) => String(service.name || '') === state.selectedHydrogenServiceName);
    if (!hydrogenServiceExists) state.selectedHydrogenServiceName = '';
  }
  if (!state.selectedServiceDate) {
    state.selectedServiceDate = getTodayIsoDate();
  }
  if (state.selectedServiceCategory) {
    await loadServiceAvailability();
  }
  state.slotAutoShiftedNotice = '';
}

async function loadGuestDashboardData() {
  const servicesResult = await api('/api/public/services').catch((error) => {
    console.warn('Guest services load failed, keeping existing catalog if available.', error);
    return null;
  });
  const nextServices = Array.isArray(servicesResult?.services) ? servicesResult.services : [];
  if (nextServices.length) {
    state.services = nextServices;
    cacheServicesCatalog(nextServices);
  } else {
    const cachedServices = loadCachedServicesCatalog();
    if (cachedServices.length) {
      state.services = cachedServices;
    }
  }
  state.bookings = Array.isArray(state.cart) ? state.cart : [];
  state.membership = { plans: [], active: false, current: null };
  state.userMembershipOrders = [];
  state.membershipBrowseVisible = false;
  state.membershipRoster = null;
  state.generalCoupons = { services: [], membership: [] };
}

function cacheServicesCatalog(services = []) {
  try {
    localStorage.setItem('h2_services_catalog_cache_v2', JSON.stringify(Array.isArray(services) ? services : []));
  } catch {
    // Ignore storage failures in private or embedded browsing contexts.
  }
}

function loadCachedServicesCatalog() {
  try {
    const raw = localStorage.getItem('h2_services_catalog_cache_v2');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredGuestCart() {
  const savedCart = localStorage.getItem('h2_guest_cart');
  if (!savedCart) return [];
  try {
    const parsed = JSON.parse(savedCart);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resetGuestCheckoutState() {
  state.guestCheckout = {
    isActive: false,
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    formErrors: {},
  };
  state.guestSessionToken = null;
}

async function enterGuestBookingMode({ scrollToServices = true } = {}) {
  state.isGuestUser = true;
  state.user = null;
  state.authToken = null;
  state.showAuthCard = false;
  state.postLoginChoice = 'guest';
  state.pendingPreAuthChoice = '';
  state.activeUserTab = 'services';
  state.servicesBackTargetTab = '';
  state.cart = loadStoredGuestCart();
  state.bookings = Array.isArray(state.cart) ? state.cart : [];
  resetGuestCheckoutState();
  storeAuthToken('');

  try {
    await loadGuestDashboardData();
  } catch (error) {
    console.error(error);
    showNotice({ title: 'Services unavailable', type: 'error', body: error?.message || 'Unable to load services for guest booking.' });
  }

  render();
  if (scrollToServices) {
    requestAnimationFrame(() => {
      elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

function getGuestCartBookings() {
  return Array.isArray(state.cart) ? state.cart : [];
}

function persistGuestCart() {
  const cart = getGuestCartBookings();
  state.cart = cart;
  state.bookings = cart;
  try {
    localStorage.setItem('h2_guest_cart', JSON.stringify(cart));
  } catch {
    // Local storage can be unavailable in private or embedded browsing contexts.
  }
}

function createGuestCartBooking(payload = {}) {
  const serviceName = String(payload.serviceName || '').trim();
  const bookingDate = String(payload.bookingDate || '').trim();
  const bookingTime = normalizeSlotStartTime(String(payload.bookingTime || '').trim());
  const addOnServiceName = String(payload.addOnServiceName || payload.addOnService || '').trim();
  const id = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    id,
    serviceName,
    bookingDate,
    bookingTime,
    addOnService: addOnServiceName,
    addOnServiceName,
    notes: String(payload.notes || '').trim(),
    status: 'pending',
    paymentStatus: 'unpaid',
    bookingType: 'guest',
    createdAt: new Date().toISOString(),
  };
}

function addGuestCartBookings(bookings = []) {
  const nextBookings = (Array.isArray(bookings) ? bookings : [bookings]).filter(
    (booking) => booking?.serviceName && booking?.bookingDate && booking?.bookingTime
  );
  state.cart = [...getGuestCartBookings(), ...nextBookings];
  persistGuestCart();
  return nextBookings;
}

function removeGuestCartBooking(bookingId = '') {
  const targetId = String(bookingId || '').trim();
  state.cart = getGuestCartBookings().filter((booking) => String(booking?.id || '') !== targetId);
  persistGuestCart();
}

async function loadServiceAvailability() {
  if (!state.selectedServiceCategory || !state.selectedServiceDate) {
    state.slotAvailabilityLoading = false;
    renderServices();
    return;
  }
  if (state.user?.role === 'admin' && !isAdminCustomerFormReady()) {
    state.slotAvailabilityLoading = false;
    renderServices();
    return;
  }
  const requestId = ++availabilityRequestId;
  state.slotAvailabilityLoading = true;
  renderServices();

  const params = new URLSearchParams({
    bookingDate: state.selectedServiceDate,
    category: state.selectedServiceCategory,
  });
  const availabilityPath = state.isGuestUser && !state.user ? '/api/public/services/availability' : '/api/services/availability';
  const url = `${buildApiUrl(availabilityPath)}?${params.toString()}`;

  fetch(url, withApiCredentials())
    .then((res) => res.json())
    .then((data) => {
      if (requestId !== availabilityRequestId) return;
      console.log('API DATA:', data);

      // ðŸ”¥ THIS IS THE FIX
      state.slotAvailability = data.slots || data.availability || {};
      state.slotCapacityByService = data.slotCapacityByService || {};
      state.slotHoldCounts = data.holds || {};
      state.bookingHoldMinutes = Number(data.holdMinutes || BOOKING_HOLD_MINUTES) || BOOKING_HOLD_MINUTES;

      const todayIso = getTodayIsoDate();
      const hasFutureSlots = SLOT_OPTIONS.some(
        (slot) => !isBookingSlotInPast(state.selectedServiceDate, slot.value)
      );
      if (!hasFutureSlots && state.selectedServiceDate === todayIso) {
        state.slotAutoShiftedNotice = 'Today has no remaining slots. Showing the next available day.';
        state.selectedServiceDate = getTomorrowIsoDate();
        state.slotAvailability = {};
        state.slotCapacityByService = {};
        state.slotHoldCounts = {};
        state.slotAvailabilityLoading = true;
        renderServices();
        loadServiceAvailability();
        return;
      }

      state.slotAvailabilityLoading = false;
      renderServices();
    })
    .catch((err) => {
      if (requestId !== availabilityRequestId) return;
      console.error(err);
      state.slotAvailability = {};
      state.slotCapacityByService = {};
      state.slotHoldCounts = {};
      state.slotAvailabilityLoading = false;
      renderServices();
    });
}

function refreshSelectedCategoryAvailability(bookingDate = '') {
  state.selectedServiceDate = bookingDate || getTodayIsoDate();
  state.slotAvailability = {};
  state.slotCapacityByService = {};
  state.slotHoldCounts = {};
  state.slotAvailabilityLoading = true;
  render();
  loadServiceAvailability();
}

function initializeAdminCalendarState() {
  if (!state.adminCalendarDate) {
    state.adminCalendarDate = getTodayIsoDate();
  }
  if (!state.adminCalendarCategory) {
    state.adminCalendarCategory = 'HYDROGEN SESSION';
  }
  if (!state.adminCalendarMonth) {
    state.adminCalendarMonth = String(state.adminCalendarDate || getTodayIsoDate()).slice(0, 7);
  }
}

function getAdminCalendarCacheKey(dateKey) {
  const category = String(state.adminCalendarCategory || 'HYDROGEN SESSION').trim().toUpperCase();
  return `${category}|${dateKey}`;
}

function getAdminCalendarMonthBounds() {
  initializeAdminCalendarState();
  const [year, month] = String(state.adminCalendarMonth || getTodayIsoDate().slice(0, 7)).split('-').map(Number);
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const safeMonthIndex = Number.isFinite(month) ? month - 1 : new Date().getMonth();
  return {
    year: safeYear,
    monthIndex: safeMonthIndex,
    firstOfMonth: new Date(safeYear, safeMonthIndex, 1),
    daysInMonth: new Date(safeYear, safeMonthIndex + 1, 0).getDate(),
  };
}

function syncAdminCalendarDateToVisibleMonth() {
  const { year, monthIndex, daysInMonth } = getAdminCalendarMonthBounds();
  const todayKey = getTodayIsoDate();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  const currentDate = String(state.adminCalendarDate || '').trim();
  if (currentDate.startsWith(`${monthKey}-`)) return;

  const maxAllowed = String(getMaxBookingIsoDate() || '').trim();
  let nextDate = `${monthKey}-01`;
  if (monthKey === todayKey.slice(0, 7)) {
    nextDate = todayKey;
  }
  if (maxAllowed && nextDate > maxAllowed) {
    nextDate = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;
  }
  state.adminCalendarDate = nextDate;
}

async function fetchAdminCalendarAvailabilityForDate(dateKey, { force = false } = {}) {
  const normalizedDate = String(dateKey || '').trim();
  if (!normalizedDate) {
    return { availability: {}, holds: {}, slotCapacityByService: {} };
  }
  const cacheKey = getAdminCalendarCacheKey(normalizedDate);
  if (!force && state.adminCalendarDayCache?.[cacheKey]) {
    return state.adminCalendarDayCache[cacheKey];
  }

  const params = new URLSearchParams({
    bookingDate: normalizedDate,
    category: state.adminCalendarCategory || 'HYDROGEN SESSION',
  });

  const availabilityResult = await api(`/api/services/availability?${params.toString()}`);
  const dayPayload = {
    availability: availabilityResult.availability || {},
    holds: availabilityResult.holds || {},
    slotCapacityByService: availabilityResult.slotCapacityByService || {},
  };
  state.adminCalendarDayCache = {
    ...(state.adminCalendarDayCache || {}),
    [cacheKey]: dayPayload,
  };
  return dayPayload;
}

async function preloadAdminCalendarMonth({ force = false } = {}) {
  initializeAdminCalendarState();
  const { year, monthIndex, daysInMonth } = getAdminCalendarMonthBounds();
  const maxAllowed = String(getMaxBookingIsoDate() || '').trim();
  const datesToLoad = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = getCalendarDateKey(year, monthIndex, day);
    if (maxAllowed && dateKey > maxAllowed) continue;
    datesToLoad.push(dateKey);
  }

  state.adminCalendarMonthLoading = true;
  render();
  try {
    await Promise.all(datesToLoad.map((dateKey) => fetchAdminCalendarAvailabilityForDate(dateKey, { force })));
  } finally {
    state.adminCalendarMonthLoading = false;
  }
}

function getAdminCalendarTrackedUser() {
  const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
  const resolvedId = String(state.adminResolvedCustomer?.id || '').trim();
  if (resolvedId) {
    const byId = users.find((user) => String(user?.id || '') === resolvedId);
    if (byId) return byId;
  }
  const email = String(state.adminCustomerForm?.email || '').trim().toLowerCase();
  if (!email) return null;
  return users.find((user) => String(user?.email || '').trim().toLowerCase() === email) || null;
}

function getAdminCalendarServiceNames() {
  return Object.keys(state.adminCalendarAvailability || {}).sort((a, b) =>
    getServiceDisplayName({ name: a }).localeCompare(getServiceDisplayName({ name: b }), undefined, { sensitivity: 'base' })
  );
}

function getAdminCalendarSelectedServiceName() {
  const serviceNames = getAdminCalendarServiceNames();
  const selected = String(state.adminCalendarServiceName || '').trim();
  if (selected && serviceNames.includes(selected)) return selected;
  return serviceNames[0] || '';
}

function openAdminCalendarBooking(serviceName, bookingTime = '') {
  const normalizedService = String(serviceName || '').trim();
  if (!normalizedService) {
    showNotice({ title: 'Notice', body: 'Select a service first.' });
    return;
  }
  const continueBooking = () => {
    openDialog();
    elements.serviceName.value = normalizedService;
    elements.bookingDate.value = state.adminCalendarDate || getTodayIsoDate();
    populateTimeSlots(elements.bookingDate.value);
    if (bookingTime) {
      const hasTimeOption = [...(elements.bookingTime?.options || [])].some((option) => option.value === bookingTime);
      if (hasTimeOption) elements.bookingTime.value = bookingTime;
    }
    updateBookingAddOnOptions();
    updateBookingSummary();
  };
  continueBooking();
}

function openAdminConsultationBookingFromCalendar() {
  const services = Array.isArray(state.services) ? state.services : [];
  if (!services.length) {
    showNotice({ title: 'Error', type: 'error', body: 'Services are not loaded yet. Please refresh and try again.' });
    return;
  }

  const consultationService =
    services.find((service) => {
      const category = String(service?.category || '').trim().toUpperCase();
      return category === 'EXPERIENCE SESSION' || category === 'CONSULTATION';
    }) ||
    services.find((service) => {
      const normalizedName = String(service?.name || '').toLowerCase();
      return normalizedName.includes('consult') || normalizedName.includes('demo') || normalizedName.includes('experience');
    }) ||
    // Fallback for catalogs that only define hydrogen sessions.
    services.find((service) => String(service?.category || '').trim().toUpperCase() === 'HYDROGEN SESSION') ||
    services[0] ||
    null;
  if (!consultationService) {
    showNotice({ title: 'Error', body: 'Consultation service is not configured.' });
    return;
  }
  const serviceAvailability = state.adminCalendarAvailability?.[consultationService.name] || {};
  const serviceHolds = state.adminCalendarHoldCounts?.[consultationService.name] || {};
  const capacityRaw = Number(state.adminCalendarCapacityByService?.[consultationService.name] || 8);
  const capacity = isHydrogenCategory(consultationService.category)
    ? Math.max(capacityRaw, HYDROGEN_SLOT_CAPACITY_PER_TIME_SLOT)
    : capacityRaw;
  const targetDate = state.adminCalendarDate || getTodayIsoDate();
  const nextOpenSlot =
    SLOT_OPTIONS.find((slot) => {
      if (isBookingSlotInPast(targetDate, slot.value)) return false;
      const booked = Number(serviceAvailability[slot.value] || 0);
      const held = Number(serviceHolds[slot.value] || 0);
      return booked + held < capacity;
    })?.value || '';
  openAdminCalendarBooking(consultationService.name, nextOpenSlot);
}

async function loadAdminCalendarAvailability({ silent = false, force = false } = {}) {
  if (state.user?.role !== 'admin') return;
  initializeAdminCalendarState();
  syncAdminCalendarDateToVisibleMonth();
  state.adminCalendarLoading = true;
  state.adminCalendarError = '';
  if (!silent) render();
  try {
    const selectedDate = state.adminCalendarDate || getTodayIsoDate();
    const [dayAvailability] = await Promise.all([
      fetchAdminCalendarAvailabilityForDate(selectedDate, { force }),
      preloadAdminCalendarMonth({ force }),
    ]);
    state.adminCalendarAvailability = dayAvailability.availability || {};
    state.adminCalendarHoldCounts = dayAvailability.holds || {};
    state.adminCalendarCapacityByService = dayAvailability.slotCapacityByService || {};
    state.adminCalendarServiceName = getAdminCalendarSelectedServiceName();
  } catch (error) {
    state.adminCalendarAvailability = {};
    state.adminCalendarHoldCounts = {};
    state.adminCalendarCapacityByService = {};
    state.adminCalendarServiceName = '';
    state.adminCalendarError = error.message || 'Unable to load slots right now.';
  } finally {
    state.adminCalendarLoading = false;
    if (!silent) render();
  }
}

async function refreshAdminCalendarCacheForDate(dateKey) {
  if (state.user?.role !== 'admin') return;
  const normalizedDate = String(dateKey || '').trim();
  if (!normalizedDate) return;
  const dayAvailability = await fetchAdminCalendarAvailabilityForDate(normalizedDate, { force: true });
  if (normalizedDate === String(state.adminCalendarDate || '').trim()) {
    state.adminCalendarAvailability = dayAvailability.availability || {};
    state.adminCalendarHoldCounts = dayAvailability.holds || {};
    state.adminCalendarCapacityByService = dayAvailability.slotCapacityByService || {};
    state.adminCalendarServiceName = getAdminCalendarSelectedServiceName();
  }
}

function getAdminCalendarDayData(dateKey) {
  return state.adminCalendarDayCache?.[getAdminCalendarCacheKey(dateKey)] || null;
}

function isAdminCalendarCountedBooking(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'cancelled') return false;
  if (['booked', 'confirmed', 'completed'].includes(status)) return true;
  return status === 'pending' && normalizePaymentStatusKey(booking?.paymentStatus) === 'paid';
}

function isAdminCalendarBookingInScope(booking, serviceName = '') {
  const selectedCategory = String(state.adminCalendarCategory || 'HYDROGEN SESSION').trim().toUpperCase();
  const bookingCategory = getBookingCategory(booking?.serviceName || '');
  if (selectedCategory === 'HYDROGEN SESSION') {
    return bookingCategory === 'HYDROGEN SESSION';
  }

  const targetServiceName = String(serviceName || '').trim().toLowerCase();
  const bookingServiceName = String(booking?.serviceName || '').trim().toLowerCase();
  if (targetServiceName) return bookingServiceName === targetServiceName;
  return bookingCategory === selectedCategory;
}

function getAdminCalendarBookingCounts(dateKey, serviceName = '') {
  const normalizedDate = String(dateKey || '').trim();
  const countsBySlot = {};
  let bookedSeatCount = 0;
  let bookedSlotCount = 0;

  if (!normalizedDate) {
    return { countsBySlot, bookedSeatCount, bookedSlotCount };
  }

  for (const booking of Array.isArray(state.bookings) ? state.bookings : []) {
    if (String(booking?.bookingDate || '').trim() !== normalizedDate) continue;
    if (!isAdminCalendarCountedBooking(booking)) continue;
    if (!isAdminCalendarBookingInScope(booking, serviceName)) continue;

    const slot = normalizeSlotStartTime(booking.bookingTime || '');
    if (!slot) continue;
    countsBySlot[slot] = Number(countsBySlot[slot] || 0) + 1;
  }

  for (const count of Object.values(countsBySlot)) {
    const value = Number(count || 0);
    bookedSeatCount += value;
    if (value > 0) bookedSlotCount += 1;
  }

  return { countsBySlot, bookedSeatCount, bookedSlotCount };
}

function getAdminCalendarDaySummary(dateKey, serviceName) {
  const dayData = getAdminCalendarDayData(dateKey);
  if (!dayData) {
    const bookingCounts = getAdminCalendarBookingCounts(dateKey, serviceName);
    return {
      hasData: bookingCounts.bookedSeatCount > 0,
      openSeatCount: 0,
      bookedSeatCount: bookingCounts.bookedSeatCount,
      bookedSlotCount: bookingCounts.bookedSlotCount,
      hasAnyOpen: false,
      hasAnyBooked: bookingCounts.bookedSeatCount > 0,
    };
  }

  const availabilityByService = dayData.availability || {};
  const holdsByService = dayData.holds || {};
  const targetServiceName = String(serviceName || '').trim();
  const servicesToCheck = targetServiceName && availabilityByService[targetServiceName] ? [targetServiceName] : Object.keys(availabilityByService);
  const enforceHydrogenCapacity = isHydrogenCategory(state.adminCalendarCategory);
  const bookingCounts = getAdminCalendarBookingCounts(dateKey, serviceName);
  const slotsWithBookingCounts = Object.keys(bookingCounts.countsBySlot || {}).filter((slot) => Number(bookingCounts.countsBySlot[slot] || 0) > 0);

  let openSeatCount = 0;
  let bookedSeatCount = 0;
  let bookedSlotCount = 0;
  for (const candidateServiceName of servicesToCheck) {
    const serviceAvailability = availabilityByService[candidateServiceName] || {};
    const serviceHolds = holdsByService[candidateServiceName] || {};
    const capacityRaw = Math.max(1, Number(dayData.slotCapacityByService?.[candidateServiceName] || 8));
    const capacity = enforceHydrogenCapacity ? Math.max(capacityRaw, HYDROGEN_SLOT_CAPACITY_PER_TIME_SLOT) : capacityRaw;
    for (const slot of SLOT_OPTIONS) {
      const booked = Math.max(Number(serviceAvailability?.[slot.value] || 0), Number(bookingCounts.countsBySlot[slot.value] || 0));
      const held = Number(serviceHolds?.[slot.value] || 0);
      bookedSeatCount += booked;
      if (booked > 0) bookedSlotCount += 1;
      if (isBookingSlotInPast(dateKey, slot.value)) continue;
      openSeatCount += Math.max(0, capacity - booked - held);
    }
  }

  if (!servicesToCheck.length && slotsWithBookingCounts.length) {
    bookedSeatCount = bookingCounts.bookedSeatCount;
    bookedSlotCount = bookingCounts.bookedSlotCount;
  }

  return {
    hasData: true,
    openSeatCount,
    bookedSeatCount: Math.max(bookedSeatCount, bookingCounts.bookedSeatCount),
    bookedSlotCount: Math.max(bookedSlotCount, bookingCounts.bookedSlotCount),
    hasAnyOpen: openSeatCount > 0,
    hasAnyBooked: Math.max(bookedSeatCount, bookingCounts.bookedSeatCount) > 0,
  };
}

function renderAdminCalendar() {
  if (
    !elements.adminCalendarSection ||
    !elements.adminCalendarDate ||
    !elements.adminCalendarCategory ||
    !elements.adminCalendarService ||
    !elements.adminCalendarMonthLabel ||
    !elements.adminCalendarGrid ||
    !elements.adminCalendarSelectedDateLabel ||
    !elements.adminCalendarStatus ||
    !elements.adminCalendarSlots ||
    !elements.adminCalendarEmpty ||
    !elements.adminCalendarTracker
  ) {
    return;
  }

  initializeAdminCalendarState();
  syncAdminCalendarDateToVisibleMonth();
  const selectedDate = state.adminCalendarDate || getTodayIsoDate();
  const { year, monthIndex, firstOfMonth, daysInMonth } = getAdminCalendarMonthBounds();
  const serviceNames = getAdminCalendarServiceNames();
  const selectedServiceName = getAdminCalendarSelectedServiceName();
  state.adminCalendarServiceName = selectedServiceName;

  if (elements.adminCalendarCustomerName) elements.adminCalendarCustomerName.value = state.adminCustomerForm.name || '';
  if (elements.adminCalendarCustomerEmail) elements.adminCalendarCustomerEmail.value = state.adminCustomerForm.email || '';
  if (elements.adminCalendarCustomerPhone) elements.adminCalendarCustomerPhone.value = state.adminCustomerForm.phone || '';

  elements.adminCalendarDate.removeAttribute('min');
  elements.adminCalendarDate.max = getMaxBookingIsoDate();
  elements.adminCalendarDate.value = selectedDate;
  elements.adminCalendarCategory.value = state.adminCalendarCategory || 'HYDROGEN SESSION';
  elements.adminCalendarMonthLabel.textContent = getCalendarMonthLabel(firstOfMonth);
  elements.adminCalendarSelectedDateLabel.textContent = formatBookingDateLabel(selectedDate);
  if (elements.adminCalendarPrevMonthBtn) {
    elements.adminCalendarPrevMonthBtn.disabled = false;
  }
  if (elements.adminCalendarNextMonthBtn) {
    elements.adminCalendarNextMonthBtn.disabled =
      String(state.adminCalendarMonth || '').localeCompare(getMaxBookingIsoDate().slice(0, 7)) >= 0;
  }

  elements.adminCalendarService.innerHTML = '';
  serviceNames.forEach((serviceName) => {
    const option = document.createElement('option');
    option.value = serviceName;
    const serviceLabel = getServiceDisplayName({ name: serviceName });
    option.textContent = serviceLabel;
    option.title = serviceLabel;
    elements.adminCalendarService.appendChild(option);
  });
  if (selectedServiceName) {
    elements.adminCalendarService.value = selectedServiceName;
  }
  const selectedServiceLabel = elements.adminCalendarService.selectedOptions?.[0]?.textContent || '';
  elements.adminCalendarService.title = String(selectedServiceLabel).trim();

  const customerLabel = isAdminCustomerFormReady()
    ? `for ${state.adminCustomerForm.name || state.adminCustomerForm.email}`
    : 'for all users';
  if (state.adminCalendarLoading || state.adminCalendarMonthLoading) {
    elements.adminCalendarStatus.textContent = 'Loading availability...';
  } else if (state.adminCalendarError) {
    elements.adminCalendarStatus.textContent = state.adminCalendarError;
  } else {
    const selectedDateIsPast = selectedDate < getTodayIsoDate();
    const selectedSummary = getAdminCalendarDaySummary(selectedDate, selectedServiceName);
    elements.adminCalendarStatus.textContent =
      `Booking summary on ${formatBookingDateLabel(selectedDate)} ${customerLabel}: ` +
      `${selectedSummary.bookedSlotCount} slots booked, ${selectedSummary.bookedSeatCount} seats booked` +
      `${selectedDateIsPast ? '.' : `, ${selectedSummary.openSeatCount} seats open.`}`;
  }

  elements.adminCalendarGrid.innerHTML = '';
  const startDay = firstOfMonth.getDay();
  const todayKey = getTodayIsoDate();
  const maxAllowed = String(getMaxBookingIsoDate() || '').trim();
  for (let index = 0; index < 42; index += 1) {
    const dayNumber = index - startDay + 1;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'admin-calendar-day';
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cell.classList.add('is-outside');
      cell.disabled = true;
      cell.innerHTML = '<span></span>';
    } else {
      const dateKey = getCalendarDateKey(year, monthIndex, dayNumber);
      const summary = getAdminCalendarDaySummary(dateKey, selectedServiceName);
      const isDisabled = maxAllowed && dateKey > maxAllowed;
      const isPastDate = dateKey < todayKey;
      const summaryLabel = isDisabled
        ? ''
        : isPastDate
          ? summary.hasAnyBooked
            ? `${summary.bookedSeatCount} booked`
            : summary.hasData
              ? '0 booked'
              : '...'
          : summary.hasAnyOpen
            ? `${summary.openSeatCount} open`
            : summary.hasData
              ? 'Full'
              : '...';
      cell.innerHTML = `
        <strong>${escapeHtml(String(dayNumber))}</strong>
        <small>${escapeHtml(summaryLabel)}</small>
      `;
      if (dateKey === todayKey) cell.classList.add('is-today');
      if (dateKey === selectedDate) cell.classList.add('is-selected');
      if (summary.hasAnyOpen) cell.classList.add('has-open');
      if (summary.hasData && !summary.hasAnyOpen) cell.classList.add('is-full');
      if (isDisabled) {
        cell.classList.add('is-disabled');
        cell.disabled = true;
      } else {
        cell.addEventListener('click', async () => {
          state.adminCalendarDate = dateKey;
          state.adminCalendarMonth = dateKey.slice(0, 7);
          await loadAdminCalendarAvailability({ silent: true });
          render();
        });
      }
    }
    elements.adminCalendarGrid.appendChild(cell);
  }

  elements.adminCalendarSlots.innerHTML = '';
  elements.adminCalendarEmpty.hidden = serviceNames.length > 0;
  if (serviceNames.length > 0) {
    const serviceAvailability = state.adminCalendarAvailability[selectedServiceName] || {};
    const serviceHolds = state.adminCalendarHoldCounts[selectedServiceName] || {};
    const slotCapacityRaw = Math.max(1, Number(state.adminCalendarCapacityByService[selectedServiceName] || 8));
    const slotCapacity = isHydrogenCategory(state.adminCalendarCategory)
      ? Math.max(slotCapacityRaw, HYDROGEN_SLOT_CAPACITY_PER_TIME_SLOT)
      : slotCapacityRaw;
    const selectedDateIsPast = selectedDate < getTodayIsoDate();
    const bookingCounts = getAdminCalendarBookingCounts(selectedDate, selectedServiceName);
    const slotList = document.createElement('div');
    slotList.className = 'admin-calendar-slot-list';

    let availableSlotCount = 0;
    SLOT_OPTIONS.forEach((slot) => {
      const booked = Math.max(Number(serviceAvailability[slot.value] || 0), Number(bookingCounts.countsBySlot[slot.value] || 0));
      const holdCount = Number(serviceHolds[slot.value] || 0);
      const openSeats = Math.max(0, slotCapacity - booked - holdCount);
      const isPast = isBookingSlotInPast(selectedDate, slot.value);

      if (selectedDateIsPast) {
        availableSlotCount += 1;
        const row = document.createElement('article');
        row.className = booked > 0
          ? 'admin-calendar-slot-row is-history is-booked'
          : 'admin-calendar-slot-row is-history';
        row.innerHTML = `
          <div class="admin-calendar-slot-time">
            <strong>${escapeHtml(slot.label)}</strong>
            <span>${booked} seats booked</span>
          </div>
          <div class="admin-calendar-slot-meta">
            <span>${booked > 0 ? 'Booked slot' : 'No bookings'}</span>
            <span>${booked}/${slotCapacity} capacity</span>
          </div>
        `;
        slotList.appendChild(row);
        return;
      }

      if (isPast || openSeats <= 0) return;

      availableSlotCount += 1;
      const row = document.createElement('article');
      row.className = 'admin-calendar-slot-row is-open';
      row.innerHTML = `
        <div class="admin-calendar-slot-time">
          <strong>${escapeHtml(slot.label)}</strong>
          <span>${openSeats} seats open</span>
        </div>
        <div class="admin-calendar-slot-meta">
          <span>${booked}/${slotCapacity} booked</span>
          <span>${holdCount} on hold</span>
        </div>
      `;
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.className = 'btn btn-secondary admin-calendar-slot-btn';
      actionBtn.textContent = 'Book Slot';
      actionBtn.addEventListener('click', () => {
        openAdminCalendarBooking(selectedServiceName, slot.value);
      });
      row.appendChild(actionBtn);
      slotList.appendChild(row);
    });

    elements.adminCalendarSlots.appendChild(slotList);
    elements.adminCalendarEmpty.hidden = availableSlotCount > 0;
    if (selectedDateIsPast && elements.adminCalendarEmpty) {
      elements.adminCalendarEmpty.textContent = 'No slot history for this date and category.';
    } else if (elements.adminCalendarEmpty) {
      elements.adminCalendarEmpty.textContent = 'No available slots for this date and category.';
    }
  }

  const trackedUser = getAdminCalendarTrackedUser();
  if (!trackedUser) {
    elements.adminCalendarTracker.innerHTML =
      '<p class="membership-copy">Enter customer details above to see user tracking details.</p>';
    return;
  }
  const summary = buildAdminUserSessionSummary(trackedUser);
  elements.adminCalendarTracker.innerHTML = `
    <div class="admin-calendar-tracker-head">
      <h3>${escapeHtml(trackedUser.name || 'User')} Users Tracking</h3>
      <p>${escapeHtml(trackedUser.email || trackedUser.mobile || '')}</p>
    </div>
    <div class="admin-calendar-tracker-grid">
      <article><span>Total</span><strong>${escapeHtml(String(summary.total))}</strong></article>
      <article><span>Completed</span><strong>${escapeHtml(String(summary.completed))}</strong></article>
      <article><span>Remaining</span><strong>${escapeHtml(String(summary.remaining))}</strong></article>
      <article><span>Missed</span><strong>${escapeHtml(String(summary.missed))}</strong></article>
    </div>
  `;
}

function resetServiceBrowserState() {
  resetHydrogenComposer();
  resetSingleSessionComposer();
  state.expandedServiceCategories = {};
  state.serviceDetailSelections = {};
  state.selectedServiceCategory = null;
  state.selectedServiceDate = getTodayIsoDate();
  state.slotAvailability = {};
  state.slotCapacityByService = {};
  state.slotHoldCounts = {};
  state.slotAvailabilityLoading = false;
  state.slotAutoShiftedNotice = '';
}

function navigateToUserServices() {
  resetServiceBrowserState();
  state.activeUserTab = 'services';
  window.location.hash = '#services';
  render();
  requestAnimationFrame(() => {
    elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function navigateToUserBookings() {
  resetServiceBrowserState();
  state.activeUserTab = 'bookings';
  window.location.hash = '#bookings';
  render();
  requestAnimationFrame(() => {
    elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function validateGuestCheckout() {
  const name = String(elements.guestCheckoutName?.value || '').trim();
  const email = String(elements.guestCheckoutEmail?.value || '').trim();
  const phone = String(elements.guestCheckoutPhone?.value || '').trim();
  
  const errors = {};
  
  if (!name) {
    errors.name = 'Full name is required';
  } else if (name.length < 2 || name.length > 80) {
    errors.name = 'Name must be 2-80 characters';
  } else if (!/^[a-zA-Z\s\-']+$/.test(name)) {
    errors.name = 'Name contains invalid characters';
  }
  
  if (!email) {
    errors.email = 'Email address is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address';
  }
  
  if (!phone) {
    errors.phone = 'Phone number is required';
  } else if (!/^[6-9]\d{9}$/.test(phone)) {
    errors.phone = 'Enter a valid 10-digit Indian phone number';
  }
  
  return { valid: Object.keys(errors).length === 0, errors };
}

function handleGuestCheckoutSubmit() {
  const validation = validateGuestCheckout();
  
  if (!validation.valid) {
    const errorMsg = Object.values(validation.errors)[0] || 'Please fix the errors above';
    elements.guestCheckoutError.textContent = errorMsg;
    elements.guestCheckoutError.hidden = false;
    return;
  }
  
  elements.guestCheckoutError.hidden = true;
  
  const guestName = String(elements.guestCheckoutName.value).trim();
  const guestEmail = String(elements.guestCheckoutEmail.value).trim();
  const guestPhone = String(elements.guestCheckoutPhone.value).trim();
  
  state.guestCheckout = {
    isActive: true,
    guestName,
    guestEmail,
    guestPhone,
    formErrors: {},
  };
  
  localStorage.setItem('h2_guest_checkout_info', JSON.stringify({
    guestName,
    guestEmail,
    guestPhone,
  }));
  
  proceedToGuestPayment();
}

async function proceedToGuestPayment() {
  if (!state.cart || state.cart.length === 0) {
    alert('Cart is empty. Please add bookings first.');
    return;
  }
  
  elements.guestCheckoutDialog.close();
  
  try {
    const response = await api('/api/guest/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestName: state.guestCheckout.guestName,
        guestEmail: state.guestCheckout.guestEmail,
        guestPhone: state.guestCheckout.guestPhone,
        bookings: state.cart,
      }),
    });
    
    if (!response.paymentToken) {
      throw new Error('Failed to generate payment token');
    }
    
    state.guestSessionToken = response.paymentToken;
    await openGuestPaymentGateway(response.paymentToken);
  } catch (error) {
    alert(`Checkout failed: ${error.message}`);
  }
}

async function openGuestPaymentGateway(token) {
  const trimmedToken = String(token || '').trim();
  if (!trimmedToken) {
    throw new Error('Missing guest payment token');
  }

  const order = await api('/api/public/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: trimmedToken }),
  });

  if (!window.Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  const options = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'H2 House Of Health',
    description: order.booking?.serviceName || 'Guest Booking Payment',
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
            token: trimmedToken,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        resetGuestCheckoutState();
        await loadDashboardData();
        render();
        alert('Payment successful. Your booking is confirmed.');
      } catch (error) {
        alert(error.message || 'Payment verification failed.');
      }
    },
    modal: {
      ondismiss: () => {
        alert('Payment canceled.');
      },
    },
  };

  const checkout = new window.Razorpay(options);
  checkout.open();
}

function getHydrogenSlotsForSubmit(requiredSlots) {
  const slots = state.selectedHydrogenSlots.slice(0, requiredSlots);
  const activeIndex = Number(state.activeHydrogenSessionIndex || 0);
  if (activeIndex >= 0 && activeIndex < requiredSlots && state.activeHydrogenSessionDate && state.activeHydrogenSessionTime) {
    slots[activeIndex] = {
      bookingDate: state.activeHydrogenSessionDate,
      bookingTime: state.activeHydrogenSessionTime,
    };
  }
  return slots;
}

function buildHydrogenAddOnSlots({ sessionCount, baseDate, baseTime, existingSlots = [], keepExisting = false } = {}) {
  const totalSessions = Math.max(1, Number(sessionCount || 1));
  const normalizedBaseDate = String(baseDate || getTodayIsoDate()).trim() || getTodayIsoDate();
  const normalizedBaseTime = normalizeSlotStartTime(String(baseTime || '').trim()) || SLOT_OPTIONS[0].value;
  const sourceSlots = Array.isArray(existingSlots) ? existingSlots.slice(0, totalSessions) : [];
  const anchorDate =
    keepExisting && String(sourceSlots[0]?.bookingDate || '').trim()
      ? String(sourceSlots[0].bookingDate || '').trim()
      : normalizedBaseDate;
  const slots = [];

  for (let index = 0; index < totalSessions; index += 1) {
    const currentSlot = sourceSlots[index] || {};
    const bookingDate =
      index === 0
        ? anchorDate
        : addDaysToIsoDate(anchorDate, index) || addDaysToIsoDate(normalizedBaseDate, index) || anchorDate;
    const bookingTime = normalizeSlotStartTime(
      String(currentSlot.bookingTime || (index === 0 ? normalizedBaseTime : normalizedBaseTime)).trim()
    ) || normalizedBaseTime;
    slots.push({
      bookingDate,
      bookingTime,
    });
  }

  return slots;
}

function populateAvailableTimeOptions(selectElement, serviceName, bookingDate, currentReservedSlot = null, preferredTime = '') {
  if (!selectElement) return;
  const selectedValue = normalizeSlotStartTime(
    String(selectElement.value || preferredTime || currentReservedSlot?.bookingTime || '').trim()
  );
  selectElement.innerHTML = '';

  const serviceAvailability = state.slotAvailability[String(serviceName || '')] || {};
  const serviceHolds = state.slotHoldCounts[String(serviceName || '')] || {};
  const capacity = Number(state.slotCapacityByService[String(serviceName || '')] || 1);
  const reservedDate = String(currentReservedSlot?.bookingDate || '').trim();
  const reservedTime = normalizeSlotStartTime(String(currentReservedSlot?.bookingTime || '').trim());

  for (const optionData of SLOT_OPTIONS) {
    const booked = Number(serviceAvailability[optionData.value] || 0);
    const held = Number(serviceHolds[optionData.value] || 0);
    const isPastSlot = isBookingSlotInPast(bookingDate, optionData.value);
    const isCurrentReserved = bookingDate === reservedDate && optionData.value === reservedTime && !isPastSlot;
    const isFull = booked + held >= capacity && !isCurrentReserved;
    if ((isPastSlot || isFull) && !isCurrentReserved) continue;
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    option.disabled = false;
    selectElement.appendChild(option);
  }

  const hasSelected = [...selectElement.options].some((option) => option.value === selectedValue && !option.disabled);
  if (hasSelected) {
    selectElement.value = selectedValue;
    return;
  }

  const fallback = [...selectElement.options].find((option) => !option.disabled);
  selectElement.value = fallback?.value || SLOT_OPTIONS[0].value;
}

function populateTimeSlots(bookingDate = '') {
  const selectedDate = String(bookingDate || elements.bookingDate?.value || getTodayIsoDate()).trim();
  const selectedServiceName = String(elements.serviceName?.value || '').trim();
  
  // Use populateAvailableTimeOptions for proper filtering
  populateAvailableTimeOptions(elements.bookingTime, selectedServiceName, selectedDate);
}

function updateTimeSlotsByDate() {
  const bookingDate = String(elements.bookingDate?.value || '').trim();
  populateTimeSlots(bookingDate);
}

function populateServiceOptions(selectedService = '') {
  const dialogContext = state.bookingDialogContext || {};
  const lockMembershipService = Boolean(dialogContext.membershipEdit);
  const findMatchingServiceName = (rawName) => {
    const target = String(rawName || '').trim();
    if (!target) return '';
    const direct = state.services.find((service) => String(service.name || '').trim() === target);
    if (direct) return String(direct.name || '').trim();
    const normalizedTarget = target.toLowerCase();
    const byCaseInsensitive = state.services.find(
      (service) => String(service.name || '').trim().toLowerCase() === normalizedTarget
    );
    if (byCaseInsensitive) return String(byCaseInsensitive.name || '').trim();
    const byDisplayName = state.services.find(
      (service) => String(getServiceDisplayName(service) || '').trim().toLowerCase() === normalizedTarget
    );
    return byDisplayName ? String(byDisplayName.name || '').trim() : '';
  };
  const requestedServiceName = String(selectedService || '').trim();
  const resolvedRequestedServiceName = findMatchingServiceName(requestedServiceName) || requestedServiceName;
  const lockedServiceName = String(dialogContext.lockedServiceName || resolvedRequestedServiceName || '').trim();
  const resolvedLockedServiceName = findMatchingServiceName(lockedServiceName) || lockedServiceName;
  elements.serviceName.innerHTML = '';
  let addedOptions = 0;
  for (const service of state.services) {
    if (lockMembershipService && resolvedLockedServiceName && String(service.name || '').trim() !== resolvedLockedServiceName) {
      continue;
    }
    const category = String(service.category || '').toUpperCase();
    const isExperience = category === 'EXPERIENCE SESSION' || String(service.name || '').toLowerCase().includes('experience');
    if (isExperience && hasCurrentUserUsedExperienceSession() && selectedService !== service.name) {
      continue;
    }
    if (isExperience && state.user?.role !== 'admin' && !state.forceExperienceBooking && selectedService !== service.name) {
      continue;
    }
    const option = document.createElement('option');
    option.value = service.name;
    const isIncluded = Boolean(service.membershipOnly) && hasMembershipInBookingContext();
    option.textContent = lockMembershipService
      ? `${getServiceDisplayName(service)} - Included in Membership`
      : isIncluded
        ? `${getServiceDisplayName(service)} - Included in Membership`
        : service.membershipOnly
          ? `${getServiceDisplayName(service)} - Free for Members Only`
          : `${getServiceDisplayName(service)} - Rs. ${Number(service.effectivePriceInr ?? service.priceInr ?? 0).toLocaleString('en-IN')}`;
    option.title = option.textContent;
    option.dataset.category = service.category;
    elements.serviceName.appendChild(option);
    addedOptions += 1;
  }

  if (lockMembershipService && addedOptions === 0 && resolvedLockedServiceName) {
    const option = document.createElement('option');
    option.value = resolvedLockedServiceName;
    option.textContent = `${resolvedLockedServiceName} - Included in Membership`;
    option.title = option.textContent;
    option.dataset.category = 'HYDROGEN SESSION';
    elements.serviceName.appendChild(option);
    addedOptions += 1;
  }

  if (resolvedRequestedServiceName) {
    const hasMatch = [...elements.serviceName.options].some(
      (option) => String(option.value || '').trim() === resolvedRequestedServiceName
    );
    if (!hasMatch) {
      const option = document.createElement('option');
      option.value = resolvedRequestedServiceName;
      option.textContent = resolvedRequestedServiceName;
      option.title = option.textContent;
      option.dataset.category = '';
      elements.serviceName.appendChild(option);
    }
    elements.serviceName.value = resolvedRequestedServiceName;
  }
}

async function loadAdminDiscountUsers() {
  if (state.user?.role !== 'admin') return;
  const result = await api('/api/admin/users');
  state.adminUsers = result.users || [];
}

async function unlockAdminDiscounts() {
  const password = window.prompt('Enter the discount admin password');
  if (!password) return;
  try {
    await api('/api/admin/discount-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    state.adminDiscountUnlocked = true;
    if (elements.adminDiscountGateMessage) {
      elements.adminDiscountGateMessage.textContent = 'Discounts unlocked for this session.';
      elements.adminDiscountGateMessage.hidden = false;
    }
    await loadAdminDiscountUsers();
    render();
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Invalid discount password.' });
  }
}

function populateBookingDateOptions(selectedDate = '') {
  const options = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i <= BOOKING_WINDOW_DAYS; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const year = day.getFullYear();
    const month = String(day.getMonth() + 1).padStart(2, '0');
    const date = String(day.getDate()).padStart(2, '0');
    const iso = `${year}-${month}-${date}`;
    const label = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(day);
    options.push({ value: iso, label });
  }

  elements.bookingDate.innerHTML = '';
  for (const optionData of options) {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    elements.bookingDate.appendChild(option);
  }

  if (options.length === 0) return;
  const hasSelected = options.some((option) => option.value === selectedDate);
  elements.bookingDate.value = hasSelected ? selectedDate : options[0].value;
}

function renderBookingHydrogenAddOnScheduler(addOnService) {
  if (!elements.bookingHydrogenAddOnScheduler) return;
  const selectedAddOnName = String(addOnService?.name || '').trim();
  const isHydrogenAddOn = String(addOnService?.category || '').trim().toUpperCase() === 'HYDROGEN SESSION';
  const sessionCount = isHydrogenAddOn ? Math.max(1, getHydrogenSessionCountFromServiceName(selectedAddOnName)) : 0;
  const context = state.bookingDialogContext || {};
  const currentSlots = Array.isArray(context.hydrogenAddOnSlots) ? context.hydrogenAddOnSlots : [];
  const baseDate = String(elements.bookingDate?.value || getTodayIsoDate()).trim() || getTodayIsoDate();
  const baseTime = normalizeSlotStartTime(String(elements.bookingTime?.value || '').trim()) || SLOT_OPTIONS[0].value;
  const slots =
    sessionCount > 0
      ? buildHydrogenAddOnSlots({
          sessionCount,
          baseDate,
          baseTime,
          existingSlots: currentSlots,
          keepExisting: Boolean(context.addOnScheduleManuallyEdited),
        })
      : [];

  context.hydrogenAddOnSlots = slots;
  if (!context.addOnScheduleManuallyEdited && slots.length) {
    context.defaultAddOnBookingDate = slots[0].bookingDate || baseDate;
    context.defaultAddOnBookingTime = slots[0].bookingTime || baseTime;
  }
  state.bookingDialogContext = context;

  elements.bookingHydrogenAddOnScheduler.innerHTML = '';
  if (!isHydrogenAddOn || !sessionCount) {
    elements.bookingHydrogenAddOnScheduler.hidden = true;
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'booking-hydrogen-addon-head';
  wrapper.innerHTML = `
    <strong>Hydrogen Session Schedule</strong>
    <span>${sessionCount} session${sessionCount === 1 ? '' : 's'} will be booked on consecutive dates.</span>
  `;
  elements.bookingHydrogenAddOnScheduler.appendChild(wrapper);

  const list = document.createElement('div');
  list.className = 'booking-hydrogen-addon-list';

  slots.forEach((slot, index) => {
    const row = document.createElement('article');
    row.className = 'booking-hydrogen-addon-session';
    const sessionNumber = index + 1;
    row.innerHTML = `
      <div class="booking-hydrogen-addon-session-head">
        <strong>Hydrogen Session ${sessionNumber}</strong>
        <small>${index === 0 ? 'Session 1 starts the sequence' : 'Auto-filled from Session 1'}</small>
      </div>
      <div class="booking-hydrogen-addon-session-grid">
        <label>
          Date
          <input
            class="booking-hydrogen-addon-session-date${index > 0 ? ' is-locked' : ''}"
            type="date"
            min="${getTodayIsoDate()}"
            max="${getMaxBookingIsoDate()}"
            value="${escapeHtml(slot.bookingDate || baseDate)}"
            ${index > 0 ? 'disabled' : ''}
          />
        </label>
        <label>
          Time
          <select class="booking-hydrogen-addon-session-time"></select>
        </label>
      </div>
    `;

    const dateInput = row.querySelector('.booking-hydrogen-addon-session-date');
    const timeSelect = row.querySelector('.booking-hydrogen-addon-session-time');
    populateAvailableTimeOptions(
      timeSelect,
      addOnService.name,
      slot.bookingDate || baseDate,
      null,
      slot.bookingTime || baseTime
    );
    if (timeSelect && slot.bookingTime) {
      timeSelect.value = normalizeSlotStartTime(slot.bookingTime) || timeSelect.value;
    }

    if (index === 0 && dateInput) {
      dateInput.addEventListener('change', () => {
        const nextDate = String(dateInput.value || '').trim() || getTodayIsoDate();
        const nextSlots = buildHydrogenAddOnSlots({
          sessionCount,
          baseDate: nextDate,
          baseTime: String(timeSelect?.value || baseTime || '').trim() || baseTime,
          existingSlots: state.bookingDialogContext?.hydrogenAddOnSlots || [],
        });
        state.bookingDialogContext = {
          ...(state.bookingDialogContext || {}),
          addOnScheduleManuallyEdited: true,
          defaultAddOnBookingDate: nextDate,
          defaultAddOnBookingTime: String(timeSelect?.value || baseTime || '').trim() || baseTime,
          hydrogenAddOnSlots: nextSlots,
        };
        updateBookingAddOnOptions();
        updateBookingSummary();
      });
    }

    if (timeSelect) {
      timeSelect.addEventListener('change', () => {
        const nextSlots = buildHydrogenAddOnSlots({
          sessionCount,
          baseDate: String(state.bookingDialogContext?.hydrogenAddOnSlots?.[0]?.bookingDate || baseDate).trim() || baseDate,
          baseTime: String(state.bookingDialogContext?.hydrogenAddOnSlots?.[0]?.bookingTime || baseTime).trim() || baseTime,
          existingSlots: state.bookingDialogContext?.hydrogenAddOnSlots || [],
          keepExisting: true,
        });
        nextSlots[index] = {
          ...nextSlots[index],
          bookingTime: normalizeSlotStartTime(String(timeSelect.value || '').trim()) || baseTime,
        };
        state.bookingDialogContext = {
          ...(state.bookingDialogContext || {}),
          addOnScheduleManuallyEdited: true,
          hydrogenAddOnSlots: nextSlots,
        };
        updateBookingSummary();
      });
    }

    list.appendChild(row);
  });

  elements.bookingHydrogenAddOnScheduler.appendChild(list);
  elements.bookingHydrogenAddOnScheduler.hidden = false;
}

function updateBookingAddOnOptions() {
  const isAdmin = state.user?.role === 'admin';
  const setAddOnScheduleVisibility = ({ showDateTime = false } = {}) => {
    if (elements.addOnDateLabel) elements.addOnDateLabel.hidden = !showDateTime;
    if (elements.addOnTimeLabel) elements.addOnTimeLabel.hidden = !showDateTime;
    if (elements.bookingHydrogenAddOnScheduler) elements.bookingHydrogenAddOnScheduler.hidden = true;
  };
  const populateAddOnDateOptions = (selectedDate = '') => {
    if (!elements.addOnDate) return;
    const options = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const year = day.getFullYear();
      const month = String(day.getMonth() + 1).padStart(2, '0');
      const date = String(day.getDate()).padStart(2, '0');
      const iso = `${year}-${month}-${date}`;
      const label = new Intl.DateTimeFormat(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(day);
      options.push({ value: iso, label });
    }
    elements.addOnDate.innerHTML = '';
    for (const optionData of options) {
      const option = document.createElement('option');
      option.value = optionData.value;
      option.textContent = optionData.label;
      elements.addOnDate.appendChild(option);
    }
    if (options.length) {
      const hasSelected = options.some((option) => option.value === selectedDate);
      elements.addOnDate.value = hasSelected ? selectedDate : options[0].value;
    }
  };
  const populateAddOnTimeOptions = () => {
    if (!elements.addOnTime) return;
    const addOnServiceName = String(elements.addOnService?.value || '').trim();
    const addOnDate = String(elements.addOnDate?.value || '').trim();
    if (!addOnServiceName || !addOnDate) {
      elements.addOnTime.innerHTML = '<option value="">Select add-on date first</option>';
      return;
    }
    const existingAddOnBookingTime = normalizeSlotStartTime(
      String(state.bookingDialogContext?.existingAddOnBooking?.bookingTime || '').trim()
    );
    const existingAddOnBookingDate = String(state.bookingDialogContext?.existingAddOnBooking?.bookingDate || '').trim();
    const preferredTime = normalizeSlotStartTime(
      String(elements.addOnTime?.value || '').trim() ||
      String(state.bookingDialogContext?.defaultAddOnBookingTime || '').trim() ||
      String(elements.bookingTime?.value || '').trim()
    );
    const reservedSlot =
      existingAddOnBookingDate === addOnDate && existingAddOnBookingTime
        ? { bookingDate: existingAddOnBookingDate, bookingTime: existingAddOnBookingTime }
        : null;
    populateAvailableTimeOptions(elements.addOnTime, addOnServiceName, addOnDate, reservedSlot, preferredTime);
  };
  if (isAdmin) {
    elements.addOnServiceLabel.hidden = true;
    elements.addOnService.innerHTML = '<option value="">No add-on</option>';
    elements.addOnService.value = '';
    if (elements.addOnDate) elements.addOnDate.innerHTML = '';
    if (elements.addOnTime) elements.addOnTime.innerHTML = '';
    setAddOnScheduleVisibility({ showDateTime: false });
    return;
  }

  const selectedServiceName = elements.serviceName.value;
  const selectedService = state.services.find((s) => s.name === selectedServiceName);
  const selectedCategory = String(selectedService?.category || '').toUpperCase();
  const isHydrogenService = selectedCategory === 'HYDROGEN SESSION';
  const isTherapyOrShotService = selectedCategory === 'IV THERAPIES' || selectedCategory === 'IV SHOTS';
  const showAddOnOptions = isHydrogenService || isTherapyOrShotService;

  elements.addOnServiceLabel.hidden = !showAddOnOptions;
  elements.addOnService.innerHTML = '<option value="">No add-on</option>';
  if (!showAddOnOptions) {
    if (elements.addOnDate) elements.addOnDate.innerHTML = '';
    if (elements.addOnTime) elements.addOnTime.innerHTML = '';
    setAddOnScheduleVisibility({ showDateTime: false });
    return;
  }
  
  const addOnServices = isHydrogenService
    ? state.services.filter((service) => {
        const category = String(service.category || '').toUpperCase();
        return category === 'IV THERAPIES' || category === 'IV SHOTS';
      })
    : state.services.filter((service) => String(service.category || '').toUpperCase() === 'HYDROGEN SESSION');
    
  for (const addOn of addOnServices) {
    const option = document.createElement('option');
    option.value = addOn.name;
    option.textContent = `${addOn.name} - Rs. ${Number(addOn.effectivePriceInr || addOn.priceInr || 0).toLocaleString('en-IN')}`;
    elements.addOnService.appendChild(option);
  }
  const context = state.bookingDialogContext || {};
  const existingAddOnBooking = context.existingAddOnBooking || null;
  const existingAddOnServiceName = String(existingAddOnBooking?.serviceName || '').trim();
  const existingValueStillValid = [...elements.addOnService.options].some(
    (option) => String(option.value || '').trim() === String(elements.addOnService.value || '').trim()
  );
  const preferredAddOnService = existingAddOnServiceName || String(state.selectedBookingAddOnServiceName || '').trim();
  if (preferredAddOnService && [...elements.addOnService.options].some((option) => option.value === preferredAddOnService)) {
    elements.addOnService.value = preferredAddOnService;
  } else if (!existingValueStillValid) {
    elements.addOnService.value = '';
  }
  const hasAddOnSelected = Boolean(String(elements.addOnService.value || '').trim());
  const selectedAddOnService = hasAddOnSelected
    ? state.services.find((service) => service.name === String(elements.addOnService.value || '').trim()) || null
    : null;
  const isHydrogenAddOn = String(selectedAddOnService?.category || '').trim().toUpperCase() === 'HYDROGEN SESSION';
  setAddOnScheduleVisibility({ showDateTime: hasAddOnSelected && !isHydrogenAddOn });
  if (elements.bookingHydrogenAddOnScheduler) {
    elements.bookingHydrogenAddOnScheduler.hidden = !hasAddOnSelected || !isHydrogenAddOn;
  }
  if (hasAddOnSelected && isHydrogenAddOn) {
    renderBookingHydrogenAddOnScheduler(selectedAddOnService);
    if (elements.addOnDate) elements.addOnDate.innerHTML = '';
    if (elements.addOnTime) elements.addOnTime.innerHTML = '';
    state.bookingDialogContext = {
      ...context,
      hydrogenAddOnSlots: Array.isArray(context.hydrogenAddOnSlots) && context.hydrogenAddOnSlots.length
        ? context.hydrogenAddOnSlots
        : buildHydrogenAddOnSlots({
            sessionCount: getHydrogenSessionCountFromServiceName(selectedAddOnService.name),
            baseDate: String(elements.bookingDate?.value || getTodayIsoDate()).trim() || getTodayIsoDate(),
            baseTime: normalizeSlotStartTime(String(elements.bookingTime?.value || '').trim()) || SLOT_OPTIONS[0].value,
          }),
    };
    if (elements.addOnDateLabel) elements.addOnDateLabel.hidden = true;
    if (elements.addOnTimeLabel) elements.addOnTimeLabel.hidden = true;
    updateBookingSummary();
    return;
  }
  if (hasAddOnSelected) {
    state.bookingDialogContext = {
      ...context,
      hydrogenAddOnSlots: [],
    };
    const baseDate = String(elements.bookingDate?.value || getTodayIsoDate()).trim();
    const baseTime = normalizeSlotStartTime(String(elements.bookingTime?.value || '').trim()) || SLOT_OPTIONS[0].value;
    const defaultDate = String(context.defaultAddOnBookingDate || existingAddOnBooking?.bookingDate || baseDate).trim() || baseDate;
    const defaultTime = normalizeSlotStartTime(
      String(context.defaultAddOnBookingTime || existingAddOnBooking?.bookingTime || baseTime).trim()
    ) || baseTime;
    const shouldSyncFromMain = !Boolean(context.addOnScheduleManuallyEdited);
    const selectedAddOnDate = shouldSyncFromMain ? baseDate : defaultDate;
    populateAddOnDateOptions(selectedAddOnDate);
    context.defaultAddOnBookingDate = String(elements.addOnDate?.value || selectedAddOnDate || baseDate).trim() || baseDate;
    context.defaultAddOnBookingTime = shouldSyncFromMain ? baseTime : defaultTime;
    state.bookingDialogContext = context;
    populateAddOnTimeOptions();
    const preferredTime = normalizeSlotStartTime(
      String(context.defaultAddOnBookingTime || defaultTime || baseTime).trim()
    ) || baseTime;
    if ([...(elements.addOnTime?.options || [])].some((option) => option.value === preferredTime && !option.disabled)) {
      elements.addOnTime.value = preferredTime;
    }
  }
  if (elements.bookingHydrogenAddOnScheduler) {
    elements.bookingHydrogenAddOnScheduler.innerHTML = '';
    elements.bookingHydrogenAddOnScheduler.hidden = true;
  }
}

function updateBookingSummary() {
  const selectedServiceName = elements.serviceName.value;
  const selectedService = state.services.find((s) => s.name === selectedServiceName);
  const submitBtn = elements.bookingForm?.querySelector('button[type="submit"]');
  const isEditingExistingBooking = Boolean(String(elements.bookingId?.value || '').trim());
  
  if (!selectedService) {
    elements.bookingSummary.hidden = true;
    if (submitBtn) submitBtn.textContent = isEditingExistingBooking ? 'Save Changes' : 'Confirm Book';
    return;
  }
  
  const category = String(selectedService.category || '').toUpperCase();
  const forceMembershipPricing = Boolean(state.bookingDialogContext?.membershipEdit);
  const hasMembership = hasMembershipInBookingContext();
  const customerHydrogenRemaining = Number(selectedService?.membershipRemainingHydrogenSessions);
  const hydrogenFreeRemaining =
    category === 'HYDROGEN SESSION' && hasMembership
      ? Number.isFinite(customerHydrogenRemaining)
        ? Math.max(0, customerHydrogenRemaining)
        : getHydrogenFreeSessionsRemainingClient()
      : 0;
  const isHydrogenFree = forceMembershipPricing || (category === 'HYDROGEN SESSION' && hasMembership && hydrogenFreeRemaining > 0);
  const basePrice = isHydrogenFree ? 0 : Number(selectedService.effectivePriceInr ?? selectedService.priceInr ?? 0);
  const isAdmin = state.user?.role === 'admin';
  const selectedAddOnName = isAdmin || elements.addOnServiceLabel.hidden ? '' : elements.addOnService.value;
  const selectedAddOn = selectedAddOnName ? state.services.find((s) => s.name === selectedAddOnName) : null;
  const addOnPrice = selectedAddOn ? Number(selectedAddOn.effectivePriceInr || selectedAddOn.priceInr || 0) : 0;
  if (submitBtn) {
    submitBtn.textContent = isEditingExistingBooking && selectedAddOn ? 'Proceed to Payment' : isEditingExistingBooking ? 'Save Changes' : 'Confirm Book';
  }
  if (isEditingExistingBooking && !selectedAddOn) {
    elements.bookingSummary.hidden = true;
    elements.summaryContent.innerHTML = '';
    elements.totalPayable.textContent = '';
    return;
  }
  if (isEditingExistingBooking && selectedAddOn) {
    const gstBreakdown = getGstBreakdownInr(addOnPrice);
    elements.summaryContent.innerHTML = `
      <div><span>Add-on: ${escapeHtml(selectedAddOn.name)}</span><span>Rs. ${addOnPrice.toLocaleString('en-IN')}</span></div>
      <div><span>GST ${GST_RATE_PERCENT}%</span><span>Rs. ${gstBreakdown.gstAmountInr.toLocaleString('en-IN')}</span></div>
      <div class="summary-total"><span>Total Payable</span><span>Rs. ${gstBreakdown.totalAmountInr.toLocaleString('en-IN')}</span></div>
    `;
    elements.totalPayable.textContent = `Rs. ${gstBreakdown.totalAmountInr.toLocaleString('en-IN')}`;
    elements.bookingSummary.hidden = false;
    return;
  }
  const totalPrice = basePrice + addOnPrice;
  const gstBreakdown = getGstBreakdownInr(totalPrice);
  const payableTotal = gstBreakdown.totalAmountInr;

  const summaryLines = [];
  summaryLines.push(
    `<div><span>${escapeHtml(getServiceDisplayName(selectedService))}${isHydrogenFree ? ` <small>(Included in Membership • ${hydrogenFreeRemaining} left)</small>` : ''}</span><span>Rs. ${basePrice.toLocaleString('en-IN')}</span></div>`
  );
  
  if (selectedAddOn) {
    summaryLines.push(`<div><span>Add-on: ${escapeHtml(selectedAddOn.name)}</span><span>Rs. ${addOnPrice.toLocaleString('en-IN')}</span></div>`);
  }
  if (totalPrice > 0) {
    summaryLines.push(`<div><span>GST ${GST_RATE_PERCENT}%</span><span>Rs. ${gstBreakdown.gstAmountInr.toLocaleString('en-IN')}</span></div>`);
    summaryLines.push(`<div class="summary-total"><span>Total Payable</span><span>Rs. ${payableTotal.toLocaleString('en-IN')}</span></div>`);
  }
  
  elements.summaryContent.innerHTML = summaryLines.join('');
  elements.totalPayable.textContent = `Rs. ${payableTotal.toLocaleString('en-IN')}`;
  elements.bookingSummary.hidden = false;
}

function openDialog(booking = null) {
  const bookingRecord = booking?.id
    ? (state.bookings || []).find((entry) => String(entry?.id || '') === String(booking.id || '')) || null
    : null;
  const resolvedBookedServiceName = booking
    ? String(bookingRecord?.serviceName || booking?.serviceName || booking?.serviceTitle || '').trim()
    : '';
  state.bookingDialogContext = {
    membershipEdit: false,
    lockedServiceName: '',
    existingAddOnBooking: null,
    addOnScheduleManuallyEdited: false,
    defaultAddOnBookingDate: '',
    defaultAddOnBookingTime: '',
    hydrogenAddOnSlots: [],
  };
  if (booking) {
    const isHydrogenCategory = getBookingCategory(resolvedBookedServiceName || booking?.serviceName || '') === 'HYDROGEN SESSION';
    const isMembershipSession = isHydrogenCategory && !isChargeableHydrogenMembershipBooking(booking);
    const bookingGroupId = String(booking?.bookingGroupId || '').trim();
    const existingAddOnBooking = bookingGroupId
      ? (state.bookings || []).find(
          (entry) =>
            String(entry?.bookingGroupId || '').trim() === bookingGroupId &&
            getBookingCategory(entry?.serviceName || '') === 'IV ADD-ON' &&
            String(entry?.status || '').trim().toLowerCase() !== 'cancelled'
        ) || null
      : null;
    state.bookingDialogContext = {
      membershipEdit: isMembershipSession,
      lockedServiceName: resolvedBookedServiceName,
      existingAddOnBooking,
      addOnScheduleManuallyEdited: false,
      defaultAddOnBookingDate: String(existingAddOnBooking?.bookingDate || booking?.bookingDate || '').trim(),
      defaultAddOnBookingTime: normalizeSlotStartTime(
        String(existingAddOnBooking?.bookingTime || booking?.bookingTime || '').trim()
      ),
      hydrogenAddOnSlots: [],
    };
  }
  populateServiceOptions();
  updateBookingAddOnOptions();
  updateBookingSummary();
  elements.serviceName.disabled = false;

  if (booking) {
    elements.dialogTitle.textContent = 'Edit Booking';
    elements.bookingId.value = String(booking.id);
    populateServiceOptions(resolvedBookedServiceName);
    const bookingStatus = String(booking?.status || '').trim().toLowerCase();
    const requestedDate = String(booking?.bookingDate || '').trim();
    const editableDate = bookingStatus === 'schedule_later' && requestedDate < getTodayIsoDate()
      ? getTodayIsoDate()
      : requestedDate;
    populateBookingDateOptions(editableDate);
    const selectedEditableDate = String(elements.bookingDate?.value || editableDate || getTodayIsoDate()).trim();
    populateTimeSlots(selectedEditableDate);
    const normalizedBookingTime = normalizeSlotStartTime(booking.bookingTime);
    if ([...(elements.bookingTime?.options || [])].some((option) => option.value === normalizedBookingTime)) {
      elements.bookingTime.value = normalizedBookingTime;
    }
    elements.bookingNotes.value = booking.notes || '';
    elements.serviceName.disabled = Boolean(booking.bookingGroupId) || Boolean(state.bookingDialogContext.membershipEdit);
    state.selectedBookingAddOnServiceName = String(state.bookingDialogContext?.existingAddOnBooking?.serviceName || '').trim();
    updateBookingAddOnOptions();
  } else {
    elements.dialogTitle.textContent = 'Book Slot';
    elements.bookingForm.reset();
    elements.bookingId.value = '';
    populateServiceOptions();
    populateBookingDateOptions();
    populateTimeSlots();
    if (elements.addOnDate) elements.addOnDate.innerHTML = '';
    if (elements.addOnTime) elements.addOnTime.innerHTML = '';
  }
  if (state.user?.role === 'admin') {
    if (elements.bookingCustomerName) elements.bookingCustomerName.value = String(state.adminCustomerForm.name || '');
    if (elements.bookingCustomerEmail) elements.bookingCustomerEmail.value = String(state.adminCustomerForm.email || '');
    if (elements.bookingCustomerPhone) elements.bookingCustomerPhone.value = String(state.adminCustomerForm.phone || '');
    syncAdminCustomerFromBookingModal();
  } else {
    syncBookingModalCustomerGate();
  }
  const submitBtn = elements.bookingForm?.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.textContent = booking ? 'Save Changes' : 'Confirm Book';
  }

  if (!booking && state.forceExperienceBooking) {
    if (hasCurrentUserUsedExperienceSession()) {
      state.forceExperienceBooking = false;
      showNotice({ title: 'Demo already booked', body: 'Demo hydrogen session can be attended only once.' });
      return;
    }
    const experienceService =
      state.services.find((service) => String(service.name || '').trim().toLowerCase() === 'demo session') ||
      state.services.find((service) => String(service.name || '').trim().toLowerCase() === 'experience session') ||
      state.services.find((service) => {
        const normalizedName = String(service.name || '').trim().toLowerCase();
        return normalizedName.includes('demo') || normalizedName.includes('experience');
      }) ||
      null;
    if (experienceService && elements.serviceName) {
      elements.serviceName.value = experienceService.name;
      elements.serviceName.disabled = true;
    }
    const experienceLabel = document.getElementById('experienceServiceLabel');
    if (experienceLabel) {
      experienceLabel.textContent = 'Demo Hydrogen Session';
      experienceLabel.hidden = false;
    }
    if (elements.serviceName) {
      elements.serviceName.hidden = true;
    }
    populateTimeSlots(elements.bookingDate?.value || getTodayIsoDate());
    updateBookingAddOnOptions();
    updateBookingSummary();
  }

  elements.dialog.showModal();
}

function closeDialog() {
  elements.dialog.close();
  state.forceExperienceBooking = false;
  state.bookingDialogContext = {
    membershipEdit: false,
    lockedServiceName: '',
    existingAddOnBooking: null,
    addOnScheduleManuallyEdited: false,
    defaultAddOnBookingDate: '',
    defaultAddOnBookingTime: '',
    hydrogenAddOnSlots: [],
  };
  state.selectedBookingAddOnServiceName = '';
  const experienceLabel = document.getElementById('experienceServiceLabel');
  if (experienceLabel) {
    experienceLabel.hidden = true;
  }
  if (elements.serviceName) {
    elements.serviceName.hidden = false;
    elements.serviceName.disabled = false;
  }
  setBookingCustomerInlineMessage('');
}

function openProfileDialog() {
  if (!state.user) return;

  elements.profileFormMessage.textContent = '';
  elements.profileName.value = state.user.name || '';
  elements.profileAge.value = state.user.age ?? '';
  elements.profileGender.value = state.user.gender || '';
  elements.profileMobile.value = state.user.mobile || '';
  elements.profileAvatarFile.value = '';
  setProfilePreview(state.user.avatarUrl || '');
  elements.profileDialog.showModal();
}

function closeProfileDialog() {
  elements.profileFormMessage.textContent = '';
  clearProfilePreviewObjectUrl();
  elements.profileDialog.close();
  renderProfileAvatar();
}

function normalizeProfileAgeInput(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 3);
  if (!digits) return '';
  const age = Number(digits);
  if (!Number.isFinite(age)) return '';
  return String(Math.min(age, 120));
}

function openAdminUserSessionDialog(userId) {
  if (!elements.adminUserSessionDialog) return;
  state.adminSelectedUserId = userId == null ? null : String(userId);
  state.adminUserSessionFilter = 'all';
  renderAdminUserSessionDialog();
  if (elements.adminUserSessionDialog.open) {
    elements.adminUserSessionDialog.close();
  }
  elements.adminUserSessionDialog.showModal();
}

function closeAdminUserSessionDialog() {
  if (!elements.adminUserSessionDialog) return;
  elements.adminUserSessionDialog.close();
}

async function saveProfile() {
  if (elements.profileAvatarFile.files && elements.profileAvatarFile.files[0]) {
    const formData = new FormData();
    formData.append('avatar', elements.profileAvatarFile.files[0]);
    const uploadResult = await api('/api/profile/avatar', {
      method: 'POST',
      body: formData,
    });
    state.user = {
      ...state.user,
      ...uploadResult.profile,
      avatarUrl: withCacheBuster(uploadResult.profile.avatarUrl || ''),
    };
  }

  const normalizedMobile = normalizeTenDigitMobile(elements.profileMobile.value);
  if (elements.profileMobile && elements.profileMobile.value.trim() !== normalizedMobile) {
    elements.profileMobile.value = normalizedMobile;
  }
  if (normalizedMobile.length !== 10) {
    throw new Error('Mobile number must be 10 digits.');
  }

  const normalizedAge = normalizeProfileAgeInput(elements.profileAge.value);
  if (elements.profileAge && elements.profileAge.value !== normalizedAge) {
    elements.profileAge.value = normalizedAge;
  }
  if (normalizedAge && (Number(normalizedAge) < 1 || Number(normalizedAge) > 120)) {
    throw new Error('Age must be between 1 and 120.');
  }

  const payload = {
    name: elements.profileName.value.trim(),
    age: normalizedAge,
    gender: elements.profileGender.value,
    mobile: normalizedMobile,
  };

  const result = await api('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  state.user = {
    ...state.user,
    ...result.profile,
    avatarUrl: withCacheBuster(result.profile.avatarUrl || state.user.avatarUrl || ''),
  };

  closeProfileDialog();
  render();
}

function handleProfileAvatarSelection() {
  clearProfilePreviewObjectUrl();
  const file = elements.profileAvatarFile.files?.[0];
  if (!file) {
    setProfilePreview(state.user?.avatarUrl || '');
    renderProfileAvatar();
    return;
  }

  profilePreviewObjectUrl = URL.createObjectURL(file);
  setProfilePreview(profilePreviewObjectUrl);
  elements.profileAvatar.textContent = '';
  elements.profileAvatar.style.backgroundImage = `url("${profilePreviewObjectUrl}")`;
  elements.profileAvatar.classList.add('has-image');
}

function clearProfilePreviewObjectUrl() {
  if (profilePreviewObjectUrl) {
    URL.revokeObjectURL(profilePreviewObjectUrl);
    profilePreviewObjectUrl = '';
  }
}

function setProfilePreview(src) {
  const normalized = normalizeAvatarUrl(src);
  if (!normalized) {
    elements.profileAvatarPreview.removeAttribute('src');
    elements.profileAvatarPreview.classList.remove('has-preview');
    return;
  }

  elements.profileAvatarPreview.src = normalized;
  elements.profileAvatarPreview.classList.add('has-preview');
}

async function upsertBooking() {
  const payload = {
    serviceName: elements.serviceName.value,
    bookingDate: elements.bookingDate.value,
    bookingTime: elements.bookingTime.value,
    notes: elements.bookingNotes.value.trim(),
  };
  
  const selectedAddOnName = elements.addOnService?.value;
  if (selectedAddOnName) {
    payload.addOnServiceName = selectedAddOnName;
    const selectedAddOnService = state.services.find((service) => service.name === selectedAddOnName) || null;
    const isHydrogenAddOn = String(selectedAddOnService?.category || '').trim().toUpperCase() === 'HYDROGEN SESSION';
    if (isHydrogenAddOn) {
      const hydrogenSlots = Array.isArray(state.bookingDialogContext?.hydrogenAddOnSlots)
        ? state.bookingDialogContext.hydrogenAddOnSlots
        : [];
      const fallbackHydrogenSlots = buildHydrogenAddOnSlots({
        sessionCount: Math.max(1, getHydrogenSessionCountFromServiceName(selectedAddOnName)),
        baseDate: String(elements.bookingDate?.value || getTodayIsoDate()).trim() || getTodayIsoDate(),
        baseTime: normalizeSlotStartTime(String(elements.bookingTime?.value || '').trim()) || SLOT_OPTIONS[0].value,
      });
      const slotsToSend = hydrogenSlots.length ? hydrogenSlots : fallbackHydrogenSlots;
      payload.addOnHydrogenSlots = slotsToSend.map((slot) => ({
        bookingDate: String(slot?.bookingDate || '').trim(),
        bookingTime: normalizeSlotStartTime(String(slot?.bookingTime || '').trim()) || SLOT_OPTIONS[0].value,
      }));
      payload.addOnBookingDate = String(slotsToSend[0]?.bookingDate || elements.bookingDate?.value || '').trim();
      payload.addOnBookingTime = normalizeSlotStartTime(
        String(slotsToSend[0]?.bookingTime || elements.bookingTime?.value || '').trim()
      );
    } else {
      payload.addOnBookingDate = String(elements.addOnDate?.value || elements.bookingDate?.value || '').trim();
      payload.addOnBookingTime = normalizeSlotStartTime(
        String(elements.addOnTime?.value || elements.bookingTime?.value || '').trim()
      );
    }
  }
  const selectedAddOnService = selectedAddOnName
    ? state.services.find((service) => service.name === selectedAddOnName)
    : null;
  const selectedAddOnAmountInr = selectedAddOnService
    ? Number(selectedAddOnService.effectivePriceInr || selectedAddOnService.priceInr || 0)
    : 0;
  
  const isAdmin = state.user?.role === 'admin';
  if (isAdmin) {
    if (!isAdminCustomerFormValid()) {
      setBookingCustomerInlineMessage(getAdminCustomerValidationMessage());
      syncBookingModalCustomerGate();
      return;
    }
    payload.customerName = state.adminCustomerForm.name;
    payload.customerEmail = state.adminCustomerForm.email;
    payload.customerPhone = state.adminCustomerForm.phone;
  }

  const id = elements.bookingId.value;
  const isNewBooking = !id;
  
  try {
    const result = await api(id ? `/api/bookings/${id}` : (isAdmin ? '/api/admin/bookings' : '/api/bookings'), {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await loadDashboardData();
    if (isAdmin && (state.adminActiveTab || '') === 'calendar') {
      await refreshAdminCalendarCacheForDate(payload.bookingDate);
    }
     
    // For new bookings, handle post-save flow
    if (isNewBooking) {
      const bookingId = result?.booking?.id || result?.bookings?.[0]?.id;
      if (isAdmin) {
        const registeredEmail = String(result?.customer?.email || '').trim() || String(state.adminCustomerForm.email || '').trim();
        const registeredMobile = String(result?.customer?.mobile || '').trim() || String(state.adminCustomerForm.phone || '').trim();
        closeDialog();
        render();
        if ((state.adminActiveTab || '') === 'calendar') {
          await showAdminBookingPaymentChoiceDialog(bookingId, registeredEmail, registeredMobile);
        } else {
          await showAdminPaymentLinkDialog(bookingId, registeredEmail, registeredMobile);
        }
      } else {
        // User flow: add to cart and let checkout happen only from "Pay Now"
        closeDialog();
        state.activeUserTab = 'cart';
        window.location.hash = '#cart';
        const cartSummary = buildUserCartSummary(state.bookings || []);
        render();
        requestAnimationFrame(() => {
          elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        showNotice({
          title: 'Added to cart',
          body: [`Cart items: ${Number(cartSummary.unitCount || 0)}`, 'Use Pay Now in cart to continue payment.'],
        });
      }
    } else {
      // Editing existing booking
      closeDialog();
      const addOn = result?.summary?.addOn || null;
      const requiresPayment = Boolean(result?.requiresPayment);
      const paymentBookingId = Number(result?.paymentBookingId || result?.booking?.id || id || 0);
      const addOnAmountInr = Number(addOn?.amountInr || selectedAddOnAmountInr || 0);
      render();
      if (!isAdmin && requiresPayment && Number.isInteger(paymentBookingId) && paymentBookingId > 0) {
        showNotice({
          title: 'Booking updated',
          body: [
            addOn
              ? `Add-on: ${addOn.serviceName} - Rs. ${addOnAmountInr.toLocaleString('en-IN')}`
              : `Add-on: ${selectedAddOnName} - Rs. ${addOnAmountInr.toLocaleString('en-IN')}`,
            'Opening payment for the selected add-on.',
          ],
        });
        await openPaymentWithBookingId(paymentBookingId);
        return;
      }
      showNotice({ title: 'Booking updated', body: 'Changes saved.' });
    }
  } catch (error) {
    showNotice({ title: 'Unable to save booking', body: error?.message || 'Unable to save booking.' });
  }
}

async function openPaymentWithBookingId(bookingId) {
  try {
    await payBooking(bookingId);
  } catch (error) {
    showNotice({ title: 'Payment failed', body: error?.message || 'Unable to proceed with payment.' });
  }
}

function getCheckoutPaymentErrorMessage(error, fallback = 'Payment verification failed.') {
  const rawMessage = String(error?.message || '').trim();
  if (String(error?.status || '') === '403' || rawMessage.toLowerCase() === 'forbidden') {
    return 'We could not validate this checkout. Please refresh your cart and try again.';
  }
  return rawMessage || fallback;
}

function buildAppliedCouponSuccessLines(coupon) {
  const code = String(coupon?.code || '').trim();
  const discountAmountInr = Number(coupon?.discountAmountInr || 0);
  if (!code && discountAmountInr <= 0) return [];
  const label = code ? `Coupon applied: ${code}` : 'Coupon applied';
  return discountAmountInr > 0 ? [label, `Coupon savings: Rs. ${discountAmountInr.toLocaleString('en-IN')}`] : [label];
}

function showAdminBookingPaymentChoiceDialog(bookingId, customerEmail = '', customerPhone = '') {
  const id = Number(bookingId);
  if (!Number.isInteger(id)) return Promise.resolve();

  const emailAddress = String(customerEmail || state.adminCustomerForm?.email || '').trim();
  const phoneNumber = String(customerPhone || state.adminCustomerForm?.phone || '').trim();

  if (!elements.adminPaymentChoiceDialog || typeof elements.adminPaymentChoiceDialog.showModal !== 'function') {
    showNotice({
      title: 'Payment method unavailable',
      body: 'The payment method dialog could not open. Use the booking actions to mark cash payment or send a payment link.',
    });
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const dialog = elements.adminPaymentChoiceDialog;
    const cashBtn = elements.adminPaymentChoiceCashBtn;
    const linkBtn = elements.adminPaymentChoiceLinkBtn;
    const closeBtn = elements.adminPaymentChoiceCloseBtn;

    const cleanup = () => {
      cashBtn?.removeEventListener('click', onCash);
      linkBtn?.removeEventListener('click', onLink);
      closeBtn?.removeEventListener('click', onClose);
      dialog?.removeEventListener('cancel', onClose);
      dialog?.removeEventListener('close', onDialogClose);
    };

    const finish = async (action) => {
      cleanup();
      if (dialog.open) dialog.close();
      try {
        if (action === 'cash') {
          await markBookingPaidInCash(id, { skipConfirm: true });
        } else if (action === 'link') {
          await showAdminPaymentLinkDialog(id, emailAddress, phoneNumber);
        }
      } finally {
        resolve();
      }
    };

    const onCash = () => finish('cash');
    const onLink = () => finish('link');
    const onClose = () => finish('');
    const onDialogClose = () => {
      cleanup();
      resolve();
    };

    if (elements.adminPaymentChoiceMeta) {
      const target = emailAddress || phoneNumber || 'this customer';
      elements.adminPaymentChoiceMeta.textContent = `Choose how to complete payment for ${target}.`;
    }

    cashBtn?.addEventListener('click', onCash);
    linkBtn?.addEventListener('click', onLink);
    closeBtn?.addEventListener('click', onClose);
    dialog.addEventListener('cancel', onClose);
    dialog.addEventListener('close', onDialogClose);
    dialog.showModal();
  });
}

async function showAdminPaymentLinkDialog(bookingId, customerEmail, customerPhone) {
  const result = await api(`/api/bookings/${bookingId}/payment-link`);
  const paymentLink = result.paymentLinkUrl || '';
  const emailAddress = String(customerEmail || state.adminCustomerForm?.email || '').trim();
  const phoneNumber = String(customerPhone || '').trim();
  
  if (!paymentLink) {
    showNotice({ title: 'Payment link unavailable', body: 'Payment link is not available for this booking.' });
    return;
  }

  copyTextToClipboard(paymentLink);
  if (!emailAddress) {
    openPaymentLinkFallbackShare(paymentLink, phoneNumber, 'No customer email found.');
    return;
  }

  await sendPaymentLinkViaEmail(bookingId, emailAddress, paymentLink, phoneNumber);
}

function normalizePhoneForShare(phoneNumber = '') {
  return String(phoneNumber || '').replace(/[^\d+]/g, '');
}

function buildPaymentLinkShareMessage(paymentLink = '') {
  return (
    `H2 House Of Health Payment Link\n\n` +
    `Please complete your booking payment using the secure link below:\n${String(paymentLink || '').trim()}\n\n` +
    `If this was not expected, please ignore this message.`
  );
}

function openPaymentLinkFallbackShare(paymentLink = '', phoneNumber = '', reason = '') {
  const link = String(paymentLink || '').trim();
  if (!link) return 'unavailable';

  const normalizedPhone = normalizePhoneForShare(phoneNumber);
  const shareMessage = buildPaymentLinkShareMessage(link);
  const encodedMessage = encodeURIComponent(shareMessage);
  const whatsappUrl = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  copyTextToClipboard(link);
  const contextLine = reason ? `Reason: ${reason}\n\n` : '';
  const promptLine = normalizedPhone
    ? `Payment link is copied. Open WhatsApp now?\n\nOK = WhatsApp\nCancel = keep copied link`
    : `Open WhatsApp share with the copied link now?`;
  const proceedWhatsapp = confirm(
    `${contextLine}${promptLine}`
  );
  if (proceedWhatsapp) {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    return 'whatsapp';
  }
  return 'copied';
}

async function sendPaymentLinkViaEmail(bookingId, email, paymentLink = '', phoneNumber = '') {
  try {
    const response = await fetch(buildApiUrl(`/api/bookings/${bookingId}/send-payment-link-email`), withApiCredentials({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, phoneNumber }),
    }));

    let result = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        result = await response.json();
      } catch {
        result = null;
      }
    }

    if (response.status !== 202) {
      const statusMessage = `Email provider acceptance is pending (HTTP ${response.status}).`;
      throw new Error(result?.message || statusMessage);
    }

    await loadDashboardData();
    render();

    const link = String(result?.paymentLinkUrl || '').trim();
    const messageId = String(result?.messageId || '').trim();
    if (link) copyTextToClipboard(link);

    showNotice({
      title: 'Email queued',
      type: 'success',
      body: [
        `To: ${email}`,
        result?.message || 'Email provider accepted the request.',
        messageId ? `Message ID: ${messageId}` : '',
        link ? `Payment Link:\n${link}\n\nLink copied.` : '',
      ].filter(Boolean),
    });
  } catch (error) {
    await loadDashboardData();
    render();

    const message = error?.message || 'Unable to send payment link via email.';
    const fallbackLink = String(paymentLink || '').trim();
    if (fallbackLink) {
      copyTextToClipboard(fallbackLink);
      showNotice({ title: 'Email failed', type: 'error', body: `${message}\n\nPayment link copied as fallback.` });
      return;
    }

    showNotice({ title: 'Email failed', type: 'error', body: message });
  }
}

async function changeStatus(id, status) {
  const bookingBefore = (Array.isArray(state.bookings) ? state.bookings : []).find((booking) => Number(booking?.id) === Number(id));
  const bookingDate = String(bookingBefore?.bookingDate || '').trim();
  const normalizedStatus = normalizeBookingStatusValue(status);
  await api(`/api/bookings/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: normalizedStatus }),
  });
  await loadDashboardData();
  if (state.user?.role === 'admin' && (state.adminActiveTab || '') === 'calendar' && bookingDate) {
    await refreshAdminCalendarCacheForDate(bookingDate);
  }
  if (normalizedStatus === 'schedule_later' && state.user?.role !== 'admin') {
    state.userBookingsFilter = 'schedule_later';
  }
  render();
  if (normalizedStatus === 'schedule_later' && state.user?.role !== 'admin') {
    showNotice({ title: 'Schedule later', body: 'This paid session is waiting in Schedule Later. Pick a new date when you are ready.' });
  } else if (normalizedStatus === 'cancelled' && state.user?.role !== 'admin') {
    showNotice({ title: 'Session cancelled', body: 'Your membership slot has been restored.' });
  }
}

function normalizeBookingStatusValue(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['schedulelater', 'scheduled_later', 'scheduledlater'].includes(normalized)) return 'schedule_later';
  return normalized;
}

async function markBookingCompleted(bookingId) {
  const id = Number(bookingId);
  if (!Number.isInteger(id)) return;
  const confirmed = confirm('Mark this booking as COMPLETED?');
  if (!confirmed) return;
  await changeStatus(id, 'completed');
}

async function markBookingPaidInCash(bookingId, { skipConfirm = false } = {}) {
  const id = Number(bookingId);
  if (!Number.isInteger(id)) return;
  if (!skipConfirm) {
    const confirmed = confirm('Mark this booking as PAID IN CASH and accept (confirm) the slot?');
    if (!confirmed) return;
  }

  const result = await api(`/api/bookings/${id}/mark-paid-cash`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });

  await loadDashboardData();
  render();

  const invoiceUrl = String(result?.invoiceUrl || '').trim();
  if (invoiceUrl) {
    openPortalDocument(invoiceUrl);
  } else {
    showNotice({ title: 'Cash accepted', body: 'Booking marked as paid in cash and confirmed.' });
  }
}

async function copyBookingPaymentLink(id) {
  const result = await api(`/api/bookings/${id}/payment-link`);
  copyTextToClipboard(result.paymentLinkUrl || '');
  showNotice({ title: 'Payment link', body: [result.paymentLinkUrl || '', '', 'Payment link copied.'] });
}

async function payBooking(id) {
  const result = await api('/api/payments/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId: id }),
  });

  if (!window.Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  const options = {
    key: result.keyId,
    amount: result.amount,
    currency: result.currency || 'INR',
    name: 'H2 House Of Health',
    description: `${result.booking.serviceName}`,
    order_id: result.orderId,
    prefill: {
      name: result.user?.name || '',
      email: result.user?.email || '',
    },
    theme: {
      color: '#8b5e3c',
    },
    handler: async (response) => {
      try {
        const verifyResult = await api('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        await loadDashboardData();
        render();
        const bookingCount = Number(verifyResult.bookingCount || result.bookingCount || 1);
        const totalAmountInr = Number(result.summary?.payableAmountInr || result.booking?.amountInr || result.summary?.totalAmountInr || 0);
        showNotice({
          title: 'Payment successful',
          body:
            bookingCount > 1
              ? `${bookingCount} booking(s) marked as booked.\nTotal paid: Rs. ${totalAmountInr.toLocaleString('en-IN')}.`
              : `Booking marked as booked.\nAmount paid: Rs. ${totalAmountInr.toLocaleString('en-IN')}.`,
        });
      } catch (error) {
        await loadDashboardData();
        render();
        showNotice({ title: 'Payment failed', body: error.message || 'Payment verification failed.' });
      }
    },
    modal: {
      ondismiss: async () => {
        await loadDashboardData();
        render();
        showNotice({ title: 'Payment canceled', body: 'Payment was canceled.' });
      },
    },
  };

  const checkout = new window.Razorpay(options);
  checkout.open();
}

async function payAllUserBookings() {
  const payButton = elements.bookingsPayAllBtn;
  const originalLabel = payButton?.textContent || 'Pay Now';
  const couponCode = String(elements.userCouponCode?.value || '').trim();

  if (payButton) {
    payButton.disabled = true;
    payButton.textContent = 'Starting payment...';
  }

  try {
    if (state.isGuestUser && !state.user) {
      state.cart = getUserCartPayableBookings(getGuestCartBookings());
      persistGuestCart();
      if (!state.cart.length) {
        throw new Error('Cart is empty. Please add bookings first.');
      }
      if (payButton) {
        payButton.disabled = false;
        payButton.textContent = originalLabel;
      }
      elements.guestCheckoutDialog?.showModal();
      elements.guestCheckoutName?.focus();
      return;
    }

    const result = await api('/api/payments/create-cart-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponCode }),
    });

    if (!window.Razorpay) {
      throw new Error('Razorpay SDK not loaded');
    }

    const options = {
      key: result.keyId,
      amount: result.amount,
      currency: result.currency || 'INR',
      name: 'H2 House Of Health',
      description: `Cart Payment`,
      order_id: result.orderId,
      prefill: {
        name: result.user?.name || '',
        email: result.user?.email || '',
      },
      theme: {
        color: '#8b5e3c',
      },
      handler: async (response) => {
        try {
          const verifyResult = await api('/api/payments/verify-cart', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          await loadDashboardData();
          state.cartCouponPreview = null;
          if (elements.userCouponCode) elements.userCouponCode.value = '';
          renderCartCouponPreview();
          render();
          const appliedCoupon = verifyResult.coupon || result.coupon || null;
          const successLines = [
            'You are all set! Your booking is confirmed.',
            ...buildAppliedCouponSuccessLines(appliedCoupon),
          `Total paid: Rs. ${Number(
              verifyResult.totalAmountInr || result.summary?.payableAmountInr || result.summary?.totalAmountInr || 0
            ).toLocaleString('en-IN')}.`,
          ];
          showNotice({
            title: 'Payment successful',
            body: successLines,
          });
        } catch (error) {
          await loadDashboardData();
          render();
          showNotice({ title: 'Payment failed', body: getCheckoutPaymentErrorMessage(error) });
        } finally {
          if (payButton) {
            payButton.disabled = false;
            payButton.textContent = originalLabel;
          }
        }
      },
      modal: {
        ondismiss: async () => {
          await loadDashboardData();
          render();
          if (payButton) {
            payButton.disabled = false;
            payButton.textContent = originalLabel;
          }
          showNotice({ title: 'Payment canceled', body: 'Payment was canceled.' });
        },
      },
    };

    try {
      const checkout = new window.Razorpay(options);
      checkout.open();
    } catch (error) {
      throw new Error(error?.message || 'Unable to open Razorpay checkout.');
    }
  } catch (error) {
    if (payButton) {
      payButton.disabled = false;
      payButton.textContent = originalLabel;
    }
    throw new Error(getCheckoutPaymentErrorMessage(error, 'Unable to open Razorpay checkout.'));
  }
}

async function saveHydrogenPackBookings({ serviceName, extraSessions, slots, addOnServiceName, addOnSessionIndex, forceChargeable = false }) {
  const isAdmin = state.user?.role === 'admin';
  if (isAdmin && !isAdminCustomerFormReady()) {
    setHydrogenComposerNotice('Enter customer name, email, and contact number first.', 'error');
    renderServices();
    return;
  }
  clearHydrogenComposerNotice();
  const duplicateSlot = findDuplicateHydrogenSlotClient(slots);
  if (duplicateSlot) {
    setHydrogenComposerNotice(
      `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${formatBookingTimeLabel(duplicateSlot.bookingTime)}.`,
      'error'
    );
    renderServices();
    return;
  }
  const membershipExpiryConflict = findMembershipExpiryConflictClient(slots);
  if (membershipExpiryConflict) {
    setHydrogenComposerNotice(
      `Membership sessions can only be scheduled until ${membershipExpiryConflict.expiryDate}.`,
      'error'
    );
    renderServices();
    return;
  }
  const dailyLimitConflict = findHydrogenDailyLimitConflictClient(slots);
  if (dailyLimitConflict) {
    setHydrogenComposerNotice(
      `Booking limit reached: max ${dailyLimitConflict.maxAllowed} hydrogen sessions per day. Reduce sessions on ${dailyLimitConflict.bookingDate}.`,
      'error'
    );
    renderServices();
    return;
  }
  if (!isAdmin && addOnServiceName) {
    const addOnSlot = slots?.[Number(addOnSessionIndex || 0)];
    const cooldownConflict = findIvCooldownConflictClient(addOnServiceName, addOnSlot?.bookingDate || '');
    if (cooldownConflict) {
      setHydrogenComposerNotice(getIvCooldownAlertMessage(cooldownConflict), 'error');
      renderServices();
      return;
    }
  }

  const result = await api(isAdmin ? '/api/admin/hydrogen/book-pack' : '/api/hydrogen/book-pack', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(isAdmin
        ? {
            customerName: state.adminCustomerForm.name,
            customerEmail: state.adminCustomerForm.email,
            customerPhone: state.adminCustomerForm.phone,
          }
        : {}),
      serviceName,
      extraSessions,
      slots,
      addOnServiceName,
      addOnSessionIndex,
      forceChargeable,
    }),
  });

  clearHydrogenComposerNotice();

  const summary = result.summary || {};
  const addOn = summary.addOn || null;
  const paymentBookingId = result.paymentBookingId || null;
  const inferredBaseAmountInr = Number(summary.packagePriceInr || 0) || Number(getDisplayedServicePriceInr(serviceName) || 0);
  const inferredExtraAmountInr =
    Number(summary.extraSessions || 0) > 0
      ? Number(summary.extraSessions || 0) * Number(summary.extraSessionPriceInr || getHydrogenSingleSessionPriceInr() || 0)
      : 0;
  const inferredAddOnAmountInr = Number(addOn?.amountInr || 0);
  const totalAmountInr = Number(summary.totalAmountInr || 0) || inferredBaseAmountInr + inferredExtraAmountInr + inferredAddOnAmountInr;
  const subtotalAmountInr =
    Number(summary.subtotalAmountInr || 0) || inferredBaseAmountInr + inferredExtraAmountInr + inferredAddOnAmountInr;
  const payableBreakdown =
    totalAmountInr > subtotalAmountInr
      ? getGstBreakdownInr(totalAmountInr, { fromGross: true })
      : getGstBreakdownInr(subtotalAmountInr);
  const shouldRouteToCart = !isAdmin && totalAmountInr > 0;
  const lines = [
    `Service: ${serviceName}`,
    summary.membershipActive && !summary.forceChargeable
      ? `Free hydrogen sessions applied: ${Number(summary.freeSessionsApplied || 0)} (of ${HYDROGEN_FREE_SESSIONS_PER_USER})`
      : summary.membershipActive
        ? 'Free hydrogen sessions applied: 0 (buy extra)'
      : `Subtotal: Rs. ${Number(subtotalAmountInr || 0).toLocaleString('en-IN')}`,
    summary.membershipActive
      ? Number(summary.chargeableHydrogenSessions || 0) > 0
        ? `Chargeable hydrogen sessions: ${Number(summary.chargeableHydrogenSessions || 0)} x Rs. ${Number(summary.memberSessionPriceInr || 0).toLocaleString('en-IN')}`
        : 'Chargeable hydrogen sessions: 0'
      : `Extra Hydrogen Sessions: ${Number(summary.extraSessions || 0)} x Rs. ${Number(summary.extraSessionPriceInr || 0).toLocaleString('en-IN')}`,
    addOn ? `IV Add-on: ${addOn.serviceName} - Rs. ${Number(addOn.amountInr || 0).toLocaleString('en-IN')}` : 'IV Add-on: None',
    `GST ${GST_RATE_PERCENT}%: Rs. ${Number(payableBreakdown.gstAmountInr || 0).toLocaleString('en-IN')}`,
    `Total Payable: Rs. ${Number(payableBreakdown.totalAmountInr || totalAmountInr || 0).toLocaleString('en-IN')}`,
    '',
    isAdmin ? 'Saved to All User Bookings.' : 'Saved to My Bookings.',
    isAdmin
      ? 'Share the payment link with the customer.'
      : shouldRouteToCart
        ? 'Added to cart. Use Pay Now in cart.'
        : 'Scheduled in My Bookings. No payment required.',
  ];
  if (!summary.membershipActive && Number(summary.extraSessions || 0) <= 0) {
    const extraIdx = lines.findIndex((line) => String(line).startsWith('Extra Hydrogen Sessions:'));
    if (extraIdx >= 0) lines.splice(extraIdx, 1);
  }

  state.selectedHydrogenSlots = [];
  state.selectedHydrogenExtraSessions = 0;
  state.selectedHydrogenAddOnServiceName = '';
  state.selectedHydrogenAddOnSessionIndex = 0;
  state.activeHydrogenSessionIndex = 0;
  state.activeHydrogenSessionDate = '';
  state.activeHydrogenSessionTime = '';
  state.selectedServiceCategory = null;
  state.selectedHydrogenServiceName = '';
  await loadDashboardData();
  if (!isAdmin && shouldRouteToCart) {
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
  } else if (!isAdmin) {
    state.activeUserTab = 'bookings';
    window.location.hash = '#bookings';
  }
  render();
  if (!isAdmin && shouldRouteToCart) {
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  } else if (!isAdmin) {
    requestAnimationFrame(() => {
      elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (isAdmin && totalAmountInr > 0 && paymentBookingId) {
    const registeredEmail = String(result?.customer?.email || '').trim() || String(state.adminCustomerForm.email || '').trim();
    const registeredMobile = String(result?.customer?.mobile || '').trim() || String(state.adminCustomerForm.phone || '').trim();
    await showAdminPaymentLinkDialog(paymentBookingId, registeredEmail, registeredMobile);
    return;
  }

  if (isAdmin && result.paymentLinkUrl) {
    copyTextToClipboard(result.paymentLinkUrl);
    lines.push('', `Payment Link: ${result.paymentLinkUrl}`, 'Payment link copied.');
  }
  showNotice({ title: shouldRouteToCart ? 'Added to cart' : 'Booking saved', body: lines });
}

async function updateHydrogenPackBookings({ bookingGroupId, serviceName, extraSessions, slots, addOnServiceName, addOnSessionIndex }) {
  clearHydrogenComposerNotice();
  const duplicateSlot = findDuplicateHydrogenSlotClient(slots);
  if (duplicateSlot) {
    setHydrogenComposerNotice(
      `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${formatBookingTimeLabel(duplicateSlot.bookingTime)}.`,
      'error'
    );
    renderServices();
    return;
  }
  const membershipExpiryConflict = findMembershipExpiryConflictClient(slots);
  if (membershipExpiryConflict) {
    setHydrogenComposerNotice(
      `Membership sessions can only be scheduled until ${membershipExpiryConflict.expiryDate}.`,
      'error'
    );
    renderServices();
    return;
  }
  const dailyLimitConflict = findHydrogenDailyLimitConflictClient(slots, bookingGroupId);
  if (dailyLimitConflict) {
    setHydrogenComposerNotice(
      `Booking limit reached: max ${dailyLimitConflict.maxAllowed} hydrogen sessions per day. Reduce sessions on ${dailyLimitConflict.bookingDate}.`,
      'error'
    );
    renderServices();
    return;
  }
  if (addOnServiceName) {
    const addOnSlot = slots?.[Number(addOnSessionIndex || 0)];
    const cooldownConflict = findIvCooldownConflictClient(addOnServiceName, addOnSlot?.bookingDate || '', '', bookingGroupId);
    if (cooldownConflict) {
      setHydrogenComposerNotice(getIvCooldownAlertMessage(cooldownConflict), 'error');
      renderServices();
      return;
    }
  }

  const result = await api(`/api/hydrogen/packages/${encodeURIComponent(bookingGroupId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceName,
      extraSessions,
      slots,
      addOnServiceName,
      addOnSessionIndex,
    }),
  });

  clearHydrogenComposerNotice();

  const summary = result.summary || {};
  const addOn = summary.addOn || null;
  const membershipIncludedSessions = Number(summary.membershipIncludedSessions || 0);
  const membershipSessionsRemaining = Number(summary.membershipSessionsRemaining || 0);
  const inferredBaseAmountInr = Number(summary.packagePriceInr || 0) || Number(getDisplayedServicePriceInr(serviceName) || 0);
  const inferredExtraAmountInr =
    Number(summary.extraSessions || 0) > 0
      ? Number(summary.extraSessions || 0) * Number(summary.extraSessionPriceInr || getHydrogenSingleSessionPriceInr() || 0)
      : 0;
  const inferredAddOnAmountInr = Number(addOn?.amountInr || 0);
  const totalAmountInr = Number(summary.totalAmountInr || 0) || inferredBaseAmountInr + inferredExtraAmountInr + inferredAddOnAmountInr;
  const subtotalAmountInr =
    Number(summary.subtotalAmountInr || 0) || inferredBaseAmountInr + inferredExtraAmountInr + inferredAddOnAmountInr;
  const payableBreakdown =
    totalAmountInr > subtotalAmountInr
      ? getGstBreakdownInr(totalAmountInr, { fromGross: true })
      : getGstBreakdownInr(subtotalAmountInr);
  const requiresPayment = Boolean(result.requiresPayment || summary.requiresPayment);
  const paymentBookingId = Number(result.paymentBookingId || 0);
  const lines = [`Service: ${serviceName}`];
  if (membershipIncludedSessions > 0) {
    lines.push(`Membership Included: ${membershipIncludedSessions} hydrogen session${membershipIncludedSessions === 1 ? '' : 's'}`);
    lines.push(`Hydrogen Sessions Left: ${membershipSessionsRemaining}`);
  }
  if (membershipIncludedSessions <= 0) {
    lines.push(`Subtotal: Rs. ${Number(subtotalAmountInr || 0).toLocaleString('en-IN')}`);
    if (Number(summary.extraSessions || 0) > 0) {
      lines.push(
        `Extra Hydrogen Sessions: ${Number(summary.extraSessions || 0)} x Rs. ${Number(summary.extraSessionPriceInr || 0).toLocaleString('en-IN')}`
      );
    }
  }
  lines.push(addOn ? `IV Add-on: ${addOn.serviceName} - Rs. ${Number(addOn.amountInr || 0).toLocaleString('en-IN')}` : 'IV Add-on: None');
  lines.push(`GST ${GST_RATE_PERCENT}%: Rs. ${Number(payableBreakdown.gstAmountInr || 0).toLocaleString('en-IN')}`);
  lines.push(`Total Payable: Rs. ${Number(payableBreakdown.totalAmountInr || totalAmountInr || 0).toLocaleString('en-IN')}`);

  resetHydrogenComposer();
  await loadDashboardData();
  const preferredReturnTab =
    state.user?.role !== 'admin' ? state.returnUserTabAfterEdit || 'cart' : '';
  const returnTab =
    state.user?.role !== 'admin'
      ? requiresPayment
        ? 'cart'
        : preferredReturnTab === 'services'
          ? 'services'
          : 'bookings'
      : '';
  state.returnUserTabAfterEdit = '';
  if (state.user?.role !== 'admin') {
    state.activeUserTab = returnTab;
    window.location.hash = `#${returnTab}`;
  }
  render();
  if (state.user?.role !== 'admin') {
    requestAnimationFrame(() => {
      (
        returnTab === 'cart'
          ? elements.userCartSection
          : returnTab === 'services'
            ? elements.servicesSection
            : elements.userBookingsSection
      )?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (state.user?.role !== 'admin' && requiresPayment && Number.isInteger(paymentBookingId) && paymentBookingId > 0) {
    showNotice({ title: 'Booking updated', body: [...lines, '', 'Opening payment for the selected add-on.'] });
    await openPaymentWithBookingId(paymentBookingId);
    return;
  }
  showNotice({ title: 'Booking updated', body: lines });
}

async function deleteBooking(booking) {
  const ok = confirm(
    booking.bookingGroupId
      ? `Delete the full hydrogen booking package for ${booking.serviceName}?`
      : `Delete booking for ${booking.serviceName}?`
  );
  if (!ok) return;

  if (state.isGuestUser && !state.user) {
    removeGuestCartBooking(booking.id);
    if (state.selectedServiceCategory) {
      await loadServiceAvailability();
    }
    render();
    return;
  }

  await api(`/api/bookings/${booking.id}`, { method: 'DELETE' });
  await loadDashboardData();
  if (state.selectedServiceCategory) {
    await loadServiceAvailability();
  }
  if (booking.bookingGroupId && booking.bookingGroupId === state.hydrogenEditingGroupId) {
    resetHydrogenComposer();
  }
  render();
}

function openBookingNotesDialog(bookingId) {
  if (!elements.bookingNotesDialog || !elements.bookingNotesBookingId) return;
  elements.bookingNotesBookingId.value = String(bookingId || '');
  if (elements.bookingNotesInput) elements.bookingNotesInput.value = '';
  if (elements.bookingNotesDialog.open) {
    elements.bookingNotesDialog.close();
  }
  elements.bookingNotesDialog.showModal();
  fetchBookingNotes(bookingId);
}

function closeBookingNotesDialog() {
  if (!elements.bookingNotesDialog) return;
  elements.bookingNotesDialog.close();
}

function getBookingNotes(bookingId) {
  const key = String(bookingId || '');
  const notes = state.adminBookingNotesByBooking?.[key];
  return Array.isArray(notes) ? notes : [];
}

async function fetchBookingNotes(bookingId) {
  if (!bookingId) return;
  state.adminBookingNotesLoading = true;
  renderBookingNotes();
  try {
    const result = await api(`/api/bookings/${encodeURIComponent(bookingId)}/notes`);
    const notes = Array.isArray(result?.notes) ? result.notes : [];
    state.adminBookingNotesByBooking = {
      ...(state.adminBookingNotesByBooking || {}),
      [String(bookingId)]: notes,
    };
    if (!Array.isArray(result?.notes)) {
      showNotice({ title: 'Notice', body: 'Notes are unavailable. Please confirm the server is updated.' });
    }
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to load booking notes.' });
  } finally {
    state.adminBookingNotesLoading = false;
    renderBookingNotes();
  }
}

async function addBookingNote() {
  const bookingId = Number(elements.bookingNotesBookingId?.value || 0);
  if (!bookingId) {
    showNotice({ title: 'Notice', body: 'Select a booking first.' });
    return;
  }
  const noteText = String(elements.bookingNotesInput?.value || '').trim();
  if (!noteText) {
    showNotice({ title: 'Notice', body: 'Enter a note before saving.' });
    return;
  }
  try {
    const result = await api('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, noteText }),
    });
    const note = result?.note;
    if (!note?.id) {
      showNotice({ title: 'Error', body: 'Unable to save this note right now.' });
      return;
    }
    state.adminBookingNotesByBooking = {
      ...(state.adminBookingNotesByBooking || {}),
      [String(bookingId)]: [note, ...getBookingNotes(bookingId)],
    };
    if (elements.bookingNotesInput) elements.bookingNotesInput.value = '';
    renderBookingNotes();
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to save this note right now.' });
  }
}

async function updateBookingNote(noteId) {
  const edit = state.adminBookingNoteEdits?.[noteId];
  const nextText = String(edit?.text || '').trim();
  if (!nextText) {
    showNotice({ title: 'Notice', body: 'Note text cannot be empty.' });
    return;
  }
  try {
    const result = await api(`/api/notes/${encodeURIComponent(noteId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ noteText: nextText }),
    });
    const updated = result?.note;
    if (!updated?.id) {
      showNotice({ title: 'Error', body: 'Unable to update this note right now.' });
      return;
    }
    const bookingId = String(updated.bookingId || elements.bookingNotesBookingId?.value || '');
    const notes = getBookingNotes(bookingId).map((note) =>
      String(note.id) === String(updated.id) ? updated : note
    );
    state.adminBookingNotesByBooking = {
      ...(state.adminBookingNotesByBooking || {}),
      [bookingId]: notes,
    };
    if (state.adminBookingNoteEdits) {
      delete state.adminBookingNoteEdits[noteId];
    }
    renderBookingNotes();
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to update this note right now.' });
  }
}

async function deleteBookingNote(noteId) {
  const ok = confirm('Delete this note?');
  if (!ok) return;
  try {
    await api(`/api/notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
    const bookingId = String(elements.bookingNotesBookingId?.value || '');
    const notes = getBookingNotes(bookingId).filter((note) => String(note.id) !== String(noteId));
    state.adminBookingNotesByBooking = {
      ...(state.adminBookingNotesByBooking || {}),
      [bookingId]: notes,
    };
    if (state.adminBookingNoteEdits) {
      delete state.adminBookingNoteEdits[noteId];
    }
    renderBookingNotes();
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to delete this note right now.' });
  }
}

function renderBookingNotes() {
  if (!elements.bookingNotesList || !elements.bookingNotesEmpty) return;
  const bookingId = String(elements.bookingNotesBookingId?.value || '');
  const notes = getBookingNotes(bookingId);
  const isLoading = state.adminBookingNotesLoading;
  elements.bookingNotesList.innerHTML = '';
  elements.bookingNotesEmpty.textContent = isLoading ? 'Loading notes...' : 'No notes yet.';
  elements.bookingNotesEmpty.hidden = isLoading ? false : notes.length > 0;

  notes.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'admin-note-card';
    const createdAt = note.createdAt ? new Date(note.createdAt) : null;
    const createdLabel = createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.toLocaleString() : '-';
    const edit = state.adminBookingNoteEdits?.[note.id] || null;
    const isEditing = Boolean(edit);

    if (isEditing) {
      const meta = document.createElement('div');
      meta.className = 'admin-note-meta';
      meta.innerHTML = `<span>Created ${escapeHtml(createdLabel)}</span>`;
      const textarea = document.createElement('textarea');
      textarea.className = 'admin-note-edit';
      textarea.rows = 3;
      textarea.value = edit.text || '';
      const actions = document.createElement('div');
      actions.className = 'admin-note-actions';
      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn btn-primary';
      saveBtn.type = 'button';
      saveBtn.textContent = 'Save';
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Cancel';
      actions.append(saveBtn, cancelBtn);
      card.append(meta, textarea, actions);
      textarea.addEventListener('input', (event) => {
        state.adminBookingNoteEdits[note.id] = { text: event.target.value };
      });
      saveBtn.addEventListener('click', () => updateBookingNote(note.id));
      cancelBtn.addEventListener('click', () => {
        delete state.adminBookingNoteEdits[note.id];
        renderBookingNotes();
      });
    } else {
      card.innerHTML = `
        <div class="admin-note-meta">
          <span>Created ${escapeHtml(createdLabel)}</span>
        </div>
        <p>${escapeHtml(note.noteText || '')}</p>
        <div class="admin-note-actions">
          <button class="btn btn-secondary" type="button">Edit</button>
          <button class="btn btn-danger" type="button">Delete</button>
        </div>
      `;
      const [editBtn, deleteBtn] = card.querySelectorAll('button');
      editBtn?.addEventListener('click', () => {
        state.adminBookingNoteEdits[note.id] = { text: note.noteText || '' };
        renderBookingNotes();
      });
      deleteBtn?.addEventListener('click', () => deleteBookingNote(note.id));
    }

    elements.bookingNotesList.appendChild(card);
  });
}

function openBookingEmailTimelineDialog(booking) {
  const bookingId = Number(booking?.id || 0);
  if (!bookingId || !elements.bookingEmailTimelineDialog || !elements.bookingEmailTimelineBookingId) return;
  elements.bookingEmailTimelineBookingId.value = String(bookingId);
  if (elements.bookingEmailTimelineDialog.open) {
    elements.bookingEmailTimelineDialog.close();
  }
  const serviceLabel = String(booking?.serviceName || 'Booking');
  const clientLabel = String(booking?.clientName || '').trim();
  if (elements.bookingEmailTimelineMeta) {
    elements.bookingEmailTimelineMeta.textContent = `${serviceLabel}${clientLabel ? ` - ${clientLabel}` : ''}`;
  }
  elements.bookingEmailTimelineDialog.showModal();
  fetchBookingEmailTimeline(bookingId);
}

function closeBookingEmailTimelineDialog() {
  if (!elements.bookingEmailTimelineDialog) return;
  elements.bookingEmailTimelineDialog.close();
}

function getBookingEmailEvents(bookingId) {
  const key = String(bookingId || '');
  const events = state.adminBookingEmailEventsByBooking?.[key];
  return Array.isArray(events) ? events : [];
}

function formatSecondsToReadable(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total < 0) return '-';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

async function fetchBookingEmailTimeline(bookingId) {
  if (!bookingId) return;
  state.adminBookingEmailTimelineLoading = true;
  renderBookingEmailTimeline();
  try {
    const params = new URLSearchParams();
    if (state.adminEmailAnalyticsFilters?.startDate) params.set('startDate', state.adminEmailAnalyticsFilters.startDate);
    if (state.adminEmailAnalyticsFilters?.endDate) params.set('endDate', state.adminEmailAnalyticsFilters.endDate);
    const result = await api(
      `/api/bookings/${encodeURIComponent(bookingId)}/payment-link-events${params.toString() ? `?${params.toString()}` : ''}`
    );
    const events = Array.isArray(result?.events) ? result.events : [];
    state.adminBookingEmailEventsByBooking = {
      ...(state.adminBookingEmailEventsByBooking || {}),
      [String(bookingId)]: events,
    };
    state.adminBookingEmailAnalyticsByBooking = {
      ...(state.adminBookingEmailAnalyticsByBooking || {}),
      [String(bookingId)]: result?.analytics || null,
    };
  } catch (error) {
    alert(error.message || 'Unable to load payment-link email timeline.');
  } finally {
    state.adminBookingEmailTimelineLoading = false;
    renderBookingEmailTimeline();
  }
}

function renderBookingEmailTimeline() {
  if (!elements.bookingEmailTimelineList || !elements.bookingEmailTimelineEmpty) return;
  const bookingId = String(elements.bookingEmailTimelineBookingId?.value || '');
  const events = getBookingEmailEvents(bookingId);
  const analytics = state.adminBookingEmailAnalyticsByBooking?.[bookingId] || null;
  const isLoading = state.adminBookingEmailTimelineLoading;
  elements.bookingEmailTimelineList.innerHTML = '';
  elements.bookingEmailTimelineEmpty.textContent = isLoading ? 'Loading email timeline...' : 'No payment-link email events yet.';
  elements.bookingEmailTimelineEmpty.hidden = isLoading ? false : events.length > 0;

  if (elements.bookingEmailTimelineAnalytics) {
    if (analytics) {
      const lines = [];
      lines.push(`Converted: ${analytics.paid ? 'Yes' : 'No'}`);
      if (analytics.paidAt) lines.push(`Paid At: ${formatDateOnly(analytics.paidAt)}`);
      if (analytics.firstDeliveredAt) lines.push(`First Delivered: ${formatDateOnly(analytics.firstDeliveredAt)}`);
      if (analytics.firstOpenedAt) lines.push(`First Opened: ${formatDateOnly(analytics.firstOpenedAt)}`);
      if (analytics.firstClickedAt) lines.push(`First Clicked: ${formatDateOnly(analytics.firstClickedAt)}`);
      if (Number.isFinite(Number(analytics.conversionAfterDeliveredSeconds))) {
        lines.push(`Conversion After Delivered: ${formatSecondsToReadable(analytics.conversionAfterDeliveredSeconds)}`);
      }
      if (Number.isFinite(Number(analytics.conversionAfterOpenedSeconds))) {
        lines.push(`Conversion After Opened: ${formatSecondsToReadable(analytics.conversionAfterOpenedSeconds)}`);
      }
      if (Number.isFinite(Number(analytics.conversionAfterClickedSeconds))) {
        lines.push(`Conversion After Clicked: ${formatSecondsToReadable(analytics.conversionAfterClickedSeconds)}`);
      }
      elements.bookingEmailTimelineAnalytics.textContent = lines.join(' | ');
      elements.bookingEmailTimelineAnalytics.hidden = false;
    } else {
      elements.bookingEmailTimelineAnalytics.hidden = true;
      elements.bookingEmailTimelineAnalytics.textContent = '';
    }
  }

  events.forEach((entry) => {
    const eventName = String(entry?.eventName || '').trim().toLowerCase();
    const title = eventName ? eventName.toUpperCase() : 'EVENT';
    const card = document.createElement('article');
    card.className = 'admin-note-card';
    const parts = [];
    parts.push(entry?.eventAt ? formatDateOnly(entry.eventAt) : '-');
    if (entry?.recipientEmail) parts.push(String(entry.recipientEmail));
    if (entry?.messageId) parts.push(`message: ${String(entry.messageId).slice(0, 64)}`);
    if (entry?.detail) parts.push(String(entry.detail));
    card.innerHTML = `
      <div class="admin-note-meta">
        <span>${escapeHtml(title)}</span>
      </div>
      <p>${escapeHtml(parts.join(' | '))}</p>
    `;
    elements.bookingEmailTimelineList.appendChild(card);
  });
}

function openBookingEmailTimelineDialog(booking) {
  const bookingId = Number(booking?.id || 0);
  if (!bookingId || !elements.bookingEmailTimelineDialog || !elements.bookingEmailTimelineBookingId) return;
  elements.bookingEmailTimelineBookingId.value = String(bookingId);
  if (elements.bookingEmailTimelineDialog.open) {
    elements.bookingEmailTimelineDialog.close();
  }
  const serviceLabel = String(booking?.serviceName || 'Booking');
  const clientLabel = String(booking?.clientName || '').trim();
  if (elements.bookingEmailTimelineMeta) {
    elements.bookingEmailTimelineMeta.textContent = `${serviceLabel}${clientLabel ? ` - ${clientLabel}` : ''}`;
  }
  elements.bookingEmailTimelineDialog.showModal();
  fetchBookingEmailTimeline(bookingId);
}

function closeBookingEmailTimelineDialog() {
  if (!elements.bookingEmailTimelineDialog) return;
  elements.bookingEmailTimelineDialog.close();
}

function getBookingEmailEvents(bookingId) {
  const key = String(bookingId || '');
  const events = state.adminBookingEmailEventsByBooking?.[key];
  return Array.isArray(events) ? events : [];
}

function formatSecondsToReadable(seconds) {
  const total = Number(seconds || 0);
  if (!Number.isFinite(total) || total < 0) return '-';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

async function fetchBookingEmailTimeline(bookingId) {
  if (!bookingId) return;
  state.adminBookingEmailTimelineLoading = true;
  renderBookingEmailTimeline();
  try {
    const params = new URLSearchParams();
    if (state.adminEmailAnalyticsFilters?.startDate) params.set('startDate', state.adminEmailAnalyticsFilters.startDate);
    if (state.adminEmailAnalyticsFilters?.endDate) params.set('endDate', state.adminEmailAnalyticsFilters.endDate);
    const result = await api(
      `/api/bookings/${encodeURIComponent(bookingId)}/payment-link-events${params.toString() ? `?${params.toString()}` : ''}`
    );
    const events = Array.isArray(result?.events) ? result.events : [];
    state.adminBookingEmailEventsByBooking = {
      ...(state.adminBookingEmailEventsByBooking || {}),
      [String(bookingId)]: events,
    };
    state.adminBookingEmailAnalyticsByBooking = {
      ...(state.adminBookingEmailAnalyticsByBooking || {}),
      [String(bookingId)]: result?.analytics || null,
    };
  } catch (error) {
    showNotice({ title: 'Error', type: 'error', body: error.message || 'Unable to load payment-link email timeline.' });
  } finally {
    state.adminBookingEmailTimelineLoading = false;
    renderBookingEmailTimeline();
  }
}

function renderBookingEmailTimeline() {
  if (!elements.bookingEmailTimelineList || !elements.bookingEmailTimelineEmpty) return;
  const bookingId = String(elements.bookingEmailTimelineBookingId?.value || '');
  const events = getBookingEmailEvents(bookingId);
  const analytics = state.adminBookingEmailAnalyticsByBooking?.[bookingId] || null;
  const isLoading = state.adminBookingEmailTimelineLoading;
  elements.bookingEmailTimelineList.innerHTML = '';
  elements.bookingEmailTimelineEmpty.textContent = isLoading ? 'Loading email timeline...' : 'No payment-link email events yet.';
  elements.bookingEmailTimelineEmpty.hidden = isLoading ? false : events.length > 0;

  if (elements.bookingEmailTimelineAnalytics) {
    if (analytics) {
      const lines = [];
      lines.push(`Converted: ${analytics.paid ? 'Yes' : 'No'}`);
      if (analytics.paidAt) lines.push(`Paid At: ${formatDateOnly(analytics.paidAt)}`);
      if (analytics.firstDeliveredAt) lines.push(`First Delivered: ${formatDateOnly(analytics.firstDeliveredAt)}`);
      if (analytics.firstOpenedAt) lines.push(`First Opened: ${formatDateOnly(analytics.firstOpenedAt)}`);
      if (analytics.firstClickedAt) lines.push(`First Clicked: ${formatDateOnly(analytics.firstClickedAt)}`);
      if (Number.isFinite(Number(analytics.conversionAfterDeliveredSeconds))) {
        lines.push(`Conversion After Delivered: ${formatSecondsToReadable(analytics.conversionAfterDeliveredSeconds)}`);
      }
      if (Number.isFinite(Number(analytics.conversionAfterOpenedSeconds))) {
        lines.push(`Conversion After Opened: ${formatSecondsToReadable(analytics.conversionAfterOpenedSeconds)}`);
      }
      if (Number.isFinite(Number(analytics.conversionAfterClickedSeconds))) {
        lines.push(`Conversion After Clicked: ${formatSecondsToReadable(analytics.conversionAfterClickedSeconds)}`);
      }
      elements.bookingEmailTimelineAnalytics.textContent = lines.join(' | ');
      elements.bookingEmailTimelineAnalytics.hidden = false;
    } else {
      elements.bookingEmailTimelineAnalytics.hidden = true;
      elements.bookingEmailTimelineAnalytics.textContent = '';
    }
  }

  events.forEach((entry) => {
    const eventName = String(entry?.eventName || '').trim().toLowerCase();
    const title = eventName ? eventName.toUpperCase() : 'EVENT';
    const card = document.createElement('article');
    card.className = 'admin-note-card';
    const parts = [];
    parts.push(entry?.eventAt ? formatDateOnly(entry.eventAt) : '-');
    if (entry?.recipientEmail) parts.push(String(entry.recipientEmail));
    if (entry?.messageId) parts.push(`message: ${String(entry.messageId).slice(0, 64)}`);
    if (entry?.detail) parts.push(String(entry.detail));
    card.innerHTML = `
      <div class="admin-note-meta">
        <span>${escapeHtml(title)}</span>
      </div>
      <p>${escapeHtml(parts.join(' | '))}</p>
    `;
    elements.bookingEmailTimelineList.appendChild(card);
  });
}

async function saveSingleSessionServiceBooking(serviceName) {
  const selection = state.ivSelections?.[serviceName] || {};
  const editingBookingId = String(selection.editingBookingId || state.singleSessionEditingBookingId || '');
  const effectiveBookingDate = String(
    editingBookingId ? selection.editingDate || selection.bookingDate || '' : selection.bookingDate || ''
  ).trim();
  const effectiveBookingTime = String(
    editingBookingId ? selection.editingTime || selection.bookingTime || '' : selection.bookingTime || ''
  ).trim();
  if (!effectiveBookingDate || !effectiveBookingTime) {
    showNotice({ title: 'Notice', body: 'Set hydrogen session date and time first.' });
    return;
  }
  const selectedService = getServiceCatalogEntry(serviceName);
  if (selectedService?.membershipOnly && !isCurrentUserMembershipActive()) {
    showNotice({
      title: 'Members only',
      body: '✨ An exclusive benefit for our members. Activate your membership to enjoy this service at no cost.',
    });
    return;
  }
  if (getBookingCategory(serviceName) === 'IV ADD-ON' && hasHydrogenPackageAddOnOnDateClient(effectiveBookingDate)) {
    showNotice({
      title: 'Not allowed',
      body: 'A hydrogen package on this date already includes an add-on. Separate Therapy/Shot bookings are not allowed on the same day.',
    });
    return;
  }
  const cooldownConflict = findIvCooldownConflictClient(serviceName, effectiveBookingDate, editingBookingId);
  if (cooldownConflict) {
    showNotice({ title: 'Not available', body: getIvCooldownAlertMessage(cooldownConflict) });
    return;
  }

  const isAdmin = state.user?.role === 'admin';
  if (isAdmin && !isAdminCustomerFormReady()) {
    showNotice({ title: 'Notice', body: 'Enter customer name, email, and contact number first.' });
    return;
  }

  const result = await api(editingBookingId ? `/api/bookings/${encodeURIComponent(editingBookingId)}` : isAdmin ? '/api/admin/bookings' : '/api/bookings', {
    method: editingBookingId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(isAdmin
        ? {
            customerName: state.adminCustomerForm.name,
            customerEmail: state.adminCustomerForm.email,
            customerPhone: state.adminCustomerForm.phone,
          }
        : {}),
      serviceName,
      bookingDate: effectiveBookingDate,
      bookingTime: effectiveBookingTime,
      notes: selection.notes || '',
    }),
  });

  state.ivSelections[serviceName] = {
    editingDate: effectiveBookingDate,
    editingTime: effectiveBookingTime,
    bookingDate: '',
    bookingTime: '',
  };
  state.singleSessionEditingBookingId = '';
  await loadDashboardData();
  if (editingBookingId && !isAdmin) {
    const returnTab = state.returnUserTabAfterEdit || 'bookings';
    state.returnUserTabAfterEdit = '';
    state.activeUserTab = returnTab;
    window.location.hash = `#${returnTab}`;
  }
  render();
  if (editingBookingId && !isAdmin) {
    requestAnimationFrame(() => {
      const returnTab = state.activeUserTab || 'bookings';
      (returnTab === 'cart' ? elements.userCartSection : elements.userBookingsSection)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }
  if (isAdmin && result.paymentLinkUrl) {
    copyTextToClipboard(result.paymentLinkUrl);
    showNotice({
      title: 'Booking saved',
      body: ['Saved to All User Bookings.', '', `Payment Link: ${result.paymentLinkUrl}`, 'Payment link copied.'],
    });
    return;
  }
  showNotice({
    title: editingBookingId ? 'Booking updated' : 'Booking saved',
    body: editingBookingId ? 'Changes saved.' : isAdmin ? 'Saved to All User Bookings.' : 'Saved to My Bookings.',
  });
}

function resetHydrogenComposer({ keepCategory = false, keepFlow = false } = {}) {
  state.selectedHydrogenServiceName = '';
  if (!keepFlow) {
    state.selectedHydrogenFlow = 'topup';
  }
  state.selectedHydrogenExtraSessions = 0;
  state.selectedHydrogenSlots = [];
  state.selectedHydrogenAddOnServiceName = '';
  state.selectedHydrogenAddOnSessionIndex = 0;
  state.focusHydrogenAddOnScheduler = false;
  state.hydrogenEditingGroupId = '';
  state.activeHydrogenSessionIndex = 0;
  state.activeHydrogenSessionDate = '';
  state.activeHydrogenSessionTime = '';
  if (!keepCategory) {
    state.selectedServiceCategory = null;
  }
}

function resetSingleSessionComposer() {
  state.selectedSingleSessionServiceName = '';
  state.singleSessionEditingBookingId = '';
  state.ivSelections = {};
}

function openSingleSessionBookingEditor(booking) {
  const bookingCategory = getBookingCategory(booking?.serviceName || '');
  const service = getServiceCatalogEntry(booking?.serviceName || '');
  const serviceCategory = String(service?.category || '').toUpperCase();
  const category =
    serviceCategory === 'IV THERAPIES' || serviceCategory === 'IV SHOTS'
      ? serviceCategory
      : bookingCategory;

  if (!booking || !category) {
    openDialog(booking || null);
    return;
  }

  state.returnUserTabAfterEdit = state.activeUserTab || 'services';
  state.activeUserTab = 'services';
  window.location.hash = '#services';
  state.expandedServiceCategories = {
    'HYDROGEN SESSION': false,
    'IV THERAPIES': false,
    'IV SHOTS': false,
    [category]: true,
  };
  state.selectedServiceCategory = category;
  state.selectedSingleSessionServiceName = booking.serviceName;
  state.singleSessionEditingBookingId = String(booking.id);
  const isScheduleLaterFlow = String(booking?.status || '').trim().toLowerCase() === 'schedule_later';
  const editableDate = isScheduleLaterFlow && String(booking.bookingDate || '').trim() < getTodayIsoDate()
    ? getTodayIsoDate()
    : booking.bookingDate;
  state.ivSelections[booking.serviceName] = {
    editingBookingId: String(booking.id),
    bookingDate: booking.bookingDate,
    bookingTime: booking.bookingTime,
    editingDate: editableDate,
    editingTime: booking.bookingTime,
    notes: booking.notes || '',
    paymentStatus: booking.paymentStatus || 'unpaid',
  };
  refreshSelectedCategoryAvailability(editableDate);
  render();
  requestAnimationFrame(() => {
    const categoryId = `service-category-details-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const target = document.getElementById(categoryId) || document.querySelector(`.service-category-card[data-category="${category}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function openIvAddOnSelectorFromBooking() {
  state.returnUserTabAfterEdit = state.activeUserTab || 'services';
  state.activeUserTab = 'services';
  window.location.hash = '#services';
  state.expandedServiceCategories = {
    'HYDROGEN SESSION': false,
    'IV THERAPIES': true,
    'IV SHOTS': true,
  };
  state.selectedServiceCategory = 'IV THERAPIES';
  resetHydrogenComposer({ keepCategory: true, keepFlow: false });
  resetSingleSessionComposer();
  render();
  requestAnimationFrame(() => {
    const target =
      document.getElementById('service-category-details-iv-therapies') ||
      document.querySelector('.service-category-card[data-category="IV THERAPIES"]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function getGroupedHydrogenRescheduleOptions(row) {
  const isScheduleLaterFlow = String(row?.status || '').trim().toLowerCase() === 'schedule_later';
  const entries = [...(Array.isArray(row?.hydrogenEntries) ? row.hydrogenEntries : [])].sort((a, b) =>
    `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`)
  );
  return entries.map((entry, index) => {
    const eligibility = getUserRescheduleEligibility(entry, {
      enforceRescheduleLimit: !isScheduleLaterFlow,
    });
    return {
      index,
      booking: entry,
      eligibility,
      label: `Hydrogen Session ${index + 1} - ${formatDateTime(entry.bookingDate, entry.bookingTime)}`,
    };
  });
}

function getGroupedHydrogenScheduleLaterOptions(row) {
  const entries = [...(Array.isArray(row?.hydrogenEntries) ? row.hydrogenEntries : [])].sort((a, b) =>
    `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`)
  );
  return entries.map((entry, index) => {
    const eligibility = getUserScheduleLaterEligibility(entry);
    return {
      index,
      booking: entry,
      allowed: eligibility.allowed,
      message: eligibility.message,
      label: `Hydrogen Session ${index + 1} - ${formatDateTime(entry.bookingDate, entry.bookingTime)}`,
    };
  });
}

function openGroupedScheduleLaterPicker(row) {
  const options = getGroupedHydrogenScheduleLaterOptions(row);
  if (!options.length) {
    showNotice({ title: 'Schedule later', body: 'No sessions found in this package.' });
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'booking-dialog user-reschedule-picker';
  const listHtml = options
    .map((item) => {
      const disabledAttr = item.allowed ? '' : 'disabled aria-disabled="true"';
      return `
        <label class="user-reschedule-option${item.allowed ? '' : ' is-disabled'}">
          <span class="user-reschedule-option-head">
            <input type="checkbox" name="scheduleLaterSessionPick" value="${escapeHtml(String(item.booking.id || ''))}" ${disabledAttr} />
            <strong>${escapeHtml(item.label)}</strong>
          </span>
          <span class="membership-copy">${escapeHtml(item.message)}</span>
        </label>
      `;
    })
    .join('');
  dialog.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>Select Sessions</h2>
        <button class="icon-btn" type="button" aria-label="Close">&times;</button>
      </div>
      <p class="membership-copy user-reschedule-picker-copy">Choose one or more sessions to hold in Schedule Later. Leave at least one package session scheduled.</p>
      <div class="user-reschedule-picker-list">${listHtml}</div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" type="button" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" type="button" data-action="continue">Schedule Later</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  const closePicker = () => {
    try {
      dialog.close();
    } catch {}
    dialog.remove();
  };
  dialog.querySelector('.icon-btn')?.addEventListener('click', closePicker);
  dialog.querySelector('[data-action="cancel"]')?.addEventListener('click', closePicker);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePicker();
  });
  dialog.querySelector('[data-action="continue"]')?.addEventListener('click', async () => {
    const selectedIds = [...dialog.querySelectorAll('input[name="scheduleLaterSessionPick"]:checked')]
      .map((input) => String(input?.value || '').trim())
      .filter(Boolean);
    if (!selectedIds.length) {
      showNotice({ title: 'Select sessions', body: 'Choose at least one session to schedule later.' });
      return;
    }
    const totalActiveEligible = options.filter((item) => item.allowed).length;
    if (totalActiveEligible > 1 && selectedIds.length >= totalActiveEligible) {
      showNotice({ title: 'Keep one scheduled', body: 'Leave at least one package session scheduled. Use Reschedule when you already know the new date.' });
      return;
    }
    const continueBtn = dialog.querySelector('[data-action="continue"]');
    if (continueBtn) continueBtn.disabled = true;
    try {
      for (const bookingId of selectedIds) {
        await changeStatus(bookingId, 'schedule_later');
      }
      closePicker();
    } catch (error) {
      if (continueBtn) continueBtn.disabled = false;
      showNotice({ title: 'Schedule later failed', body: error?.message || 'Unable to move this session to Schedule Later.' });
    }
  });
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    showNotice({ title: 'Schedule later', body: 'Your browser does not support the session picker dialog.' });
    dialog.remove();
  }
}

async function handleScheduleLaterAction(row) {
  if (!row) return;
  if (row.isGroupedHydrogen) {
    openGroupedScheduleLaterPicker(row);
    return;
  }
  const booking = row.booking || row;
  const eligibility = getUserScheduleLaterEligibility(booking);
  if (!eligibility.allowed) {
    showNotice({ title: 'Schedule later unavailable', body: eligibility.message || 'This session cannot be moved to Schedule Later.' });
    return;
  }
  await changeStatus(booking.id, 'schedule_later');
}

async function handleAdminScheduleLaterAction(booking) {
  const id = Number(booking?.id || 0);
  if (!Number.isInteger(id) || id <= 0) return;
  const eligibility = getAdminScheduleLaterEligibility(booking);
  if (!eligibility.allowed) {
    showNotice({ title: 'Schedule later unavailable', body: eligibility.message || 'This session cannot be moved to Schedule Later.' });
    return;
  }
  const confirmed = confirm(
    `Move ${booking.clientName || 'this customer'}'s session on ${formatDateTime(booking.bookingDate, booking.bookingTime)} to Schedule Later?`
  );
  if (!confirmed) return;
  await changeStatus(id, 'schedule_later');
  state.adminActiveTab = 'rescheduled';
  state.adminRescheduleView = 'schedule_later';
  state.adminRescheduleDateFilter = '';
  state.adminRescheduleSlotFilter = '';
  state.adminRescheduleSearch = '';
  if (elements.adminRescheduleSearch) elements.adminRescheduleSearch.value = state.adminRescheduleSearch;
  if (elements.adminRescheduleDate) elements.adminRescheduleDate.value = state.adminRescheduleDateFilter;
  render();
  showNotice({ title: 'Schedule later', body: 'Added in schedule later visible in user portal schedule later tab' });
}

function openGroupedReschedulePicker(row) {
  const options = getGroupedHydrogenRescheduleOptions(row);
  if (!options.length) {
    showNotice({ title: 'Unable to reschedule', body: 'No sessions found in this package.' });
    return;
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'booking-dialog user-reschedule-picker';
  const isScheduleLaterFlow = String(row?.status || '').trim().toLowerCase() === 'schedule_later';
  const listHtml = options
    .map((item) => {
      const disabledAttr = item.eligibility.allowed ? '' : 'disabled aria-disabled="true"';
      const stateLabel = item.eligibility.allowed ? 'Eligible' : `Not eligible: ${item.eligibility.message}`;
      return `
        <label class="user-reschedule-option${item.eligibility.allowed ? '' : ' is-disabled'}">
          <span class="user-reschedule-option-head">
            <input type="radio" name="rescheduleSessionPick" value="${escapeHtml(String(item.booking.id || ''))}" ${disabledAttr} />
            <strong>${escapeHtml(item.label)}</strong>
          </span>
          <span class="membership-copy">${escapeHtml(stateLabel)}</span>
        </label>
      `;
    })
    .join('');
  dialog.innerHTML = `
    <form method="dialog">
      <div class="dialog-head">
        <h2>${isScheduleLaterFlow ? 'Select Session to Schedule' : 'Select Session to Reschedule'}</h2>
        <button class="icon-btn" type="button" aria-label="Close">&times;</button>
      </div>
      <p class="membership-copy user-reschedule-picker-copy">${
        isScheduleLaterFlow
          ? 'Choose one held session, then pick the date and time to put it back on your calendar.'
          : 'Choose one eligible session. Sessions outside the reschedule window are disabled.'
      }</p>
      <div class="user-reschedule-picker-list">${listHtml}</div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" type="button" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" type="button" data-action="continue">${isScheduleLaterFlow ? 'Schedule' : 'Reschedule'}</button>
      </div>
    </form>
  `;
  document.body.appendChild(dialog);
  const closeBtn = dialog.querySelector('.icon-btn');
  const cancelBtn = dialog.querySelector('[data-action="cancel"]');
  const continueBtn = dialog.querySelector('[data-action="continue"]');
  const closePicker = () => {
    try {
      dialog.close();
    } catch {}
    dialog.remove();
  };
  closeBtn?.addEventListener('click', closePicker);
  cancelBtn?.addEventListener('click', closePicker);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closePicker();
  });
  continueBtn?.addEventListener('click', () => {
    const selected = dialog.querySelector('input[name="rescheduleSessionPick"]:checked');
    const bookingId = String(selected?.value || '').trim();
    if (!bookingId) {
      showNotice({ title: 'Select session', body: 'Choose an eligible session to continue.' });
      return;
    }
    closePicker();
    handleUserRescheduleAction(row, bookingId);
  });
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
  } else {
    showNotice({ title: 'Reschedule', body: 'Your browser does not support the session picker dialog.' });
    dialog.remove();
  }
}

function handleUserRescheduleAction(row, selectedBookingId = '') {
  if (!row) return;
  if (row.isGroupedHydrogen) {
    const chosenId = String(selectedBookingId || '').trim();
    if (!chosenId) {
      openGroupedReschedulePicker(row);
      return;
    }
    const selectedBooking = [...(row.hydrogenEntries || [])].find((entry) => String(entry?.id || '') === chosenId);
    if (!selectedBooking) {
      showNotice({ title: 'Unable to reschedule', body: 'Selected session is unavailable.' });
      return;
    }
    const isScheduleLaterFlow = String(row?.status || '').trim().toLowerCase() === 'schedule_later';
    const eligibility = getUserRescheduleEligibility(selectedBooking, {
      enforceRescheduleLimit: !isScheduleLaterFlow,
    });
    if (!eligibility.allowed) {
      showNotice({ title: 'Unable to reschedule', body: eligibility.message || 'This session is not eligible.' });
      return;
    }
    openDialog(selectedBooking);
    return;
  }
  const booking = row.booking || row;
  const category = getBookingCategory(booking?.serviceName || '');
  if (category === 'HYDROGEN SESSION') {
    openDialog(booking);
    return;
  }
  openSingleSessionBookingEditor(booking);
}

function handleUserAddOnAction(row) {
  if (!row) return;
  if (row.isGroupedHydrogen) {
    openHydrogenPackageEditor(row);
    return;
  }
  if (getBookingCategory(row?.booking?.serviceName) === 'HYDROGEN SESSION') {
    openIvAddOnSelectorFromBooking();
  }
}

function openHydrogenPackageEditor(row) {
  const hydrogenEntries = [...(row.hydrogenEntries || [])].sort((a, b) =>
    `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`)
  );
  if (!hydrogenEntries.length) {
    showNotice({ title: 'Error', body: 'Hydrogen package data is incomplete.' });
    return;
  }

  const addOnEntry = (row.addOnEntries || [])[0] || null;
  const addOnSessionIndex = addOnEntry
    ? Math.max(
        0,
        hydrogenEntries.findIndex(
          (entry) => entry.bookingDate === addOnEntry.bookingDate && entry.bookingTime === addOnEntry.bookingTime
        )
      )
    : 0;

  const baseServiceName = String(row.baseServiceName || hydrogenEntries[0].serviceName || '').trim();
  const basePackageSessions = Math.max(1, Number(getHydrogenSessionCountFromServiceName(baseServiceName) || 1));
  const totalHydrogenSessions = hydrogenEntries.length;
  const inferredExtraSessions = Math.max(0, Number(row.extraSessions || totalHydrogenSessions - basePackageSessions));
  const isScheduleFlowBooking =
    basePackageSessions === 1 && totalHydrogenSessions === 4 && inferredExtraSessions === 3;
  const inferredHydrogenFlow = isScheduleFlowBooking ? 'schedule' : 'topup';

  state.returnUserTabAfterEdit = state.activeUserTab || 'services';
  state.activeUserTab = 'services';
  window.location.hash = '#services';
  state.expandedServiceCategories = {
    'HYDROGEN SESSION': true,
    'IV THERAPIES': false,
    'IV SHOTS': false,
  };
  state.selectedServiceCategory = 'HYDROGEN SESSION';
  state.selectedHydrogenFlow = inferredHydrogenFlow;
  state.selectedHydrogenServiceName = baseServiceName;
  state.selectedHydrogenExtraSessions = inferredExtraSessions;
  state.selectedHydrogenSlots = hydrogenEntries.map((entry) => ({
    bookingDate: entry.bookingDate,
    bookingTime: entry.bookingTime,
  }));
  state.selectedHydrogenAddOnServiceName = addOnEntry?.serviceName || '';
  state.selectedHydrogenAddOnSessionIndex = addOnSessionIndex;
  state.hydrogenEditingGroupId = row.bookingGroupId || '';
  state.activeHydrogenSessionIndex = 0;
  state.activeHydrogenSessionDate = hydrogenEntries[0].bookingDate || getTodayIsoDate();
  state.activeHydrogenSessionTime = hydrogenEntries[0].bookingTime || SLOT_OPTIONS[0].value;
  state.selectedServiceDate = hydrogenEntries[0].bookingDate || getTodayIsoDate();
  refreshSelectedCategoryAvailability(hydrogenEntries[0].bookingDate || getTodayIsoDate());
  render();
  requestAnimationFrame(() => {
    const target =
      (inferredHydrogenFlow === 'topup' ? document.querySelector('#hydrogen-topup-anchor') : null) ||
      document.querySelector('[data-hydrogen-editor="true"]') ||
      document.getElementById('service-category-details-hydrogen-session') ||
      document.querySelector('.service-category-card[data-category="HYDROGEN SESSION"]');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function getFilteredBookings(sourceBookings = state.bookings) {
  const { search, status, date } = state.filters;
  return sourceBookings
    .filter((item) => {
      if (status !== 'all' && item.status !== status) return false;
      if (date && item.bookingDate !== date) return false;
      if (!search) return true;

      const searchable = [item.clientName, item.clientMobile, item.serviceName]
        .join(' ')
        .toLowerCase();

      return searchable.includes(search);
    })
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
}

function getFilteredUserHistoryBookings(sourceBookings = state.bookings) {
  const bookings = Array.isArray(sourceBookings) ? sourceBookings : [];
  const activeFilter = String(state.userBookingsFilter || 'all').trim().toLowerCase();
  const statusFiltered = activeFilter === 'all'
    ? bookings.filter((booking) => String(booking?.status || '').trim().toLowerCase() !== 'schedule_later')
    : bookings.filter((booking) => {
    const status = String(booking?.status || '').trim().toLowerCase();
    if (activeFilter === 'completed') return status === 'completed';
    if (activeFilter === 'schedule_later') return status === 'schedule_later';
    if (activeFilter === 'cancelled') return status === 'cancelled';
    if (activeFilter === 'upcoming') {
      if (status === 'completed' || status === 'cancelled' || status === 'schedule_later') return false;
      return !isBookingSlotInPast(booking?.bookingDate, booking?.bookingTime);
    }
    return true;
  });
  const latestFirst = [...statusFiltered].sort((a, b) => {
    if (activeFilter === 'upcoming') {
      const aTs = getBookingStartTime(a);
      const bTs = getBookingStartTime(b);
      const safeA = Number.isFinite(aTs) ? aTs : Number.MAX_SAFE_INTEGER;
      const safeB = Number.isFinite(bTs) ? bTs : Number.MAX_SAFE_INTEGER;
      if (safeA !== safeB) return safeA - safeB;
      return Number(a?.id || 0) - Number(b?.id || 0);
    }
    return compareBookingsByScheduleDesc(a, b);
  });

  const requestedCount = Number(state.memberSessionDisplayCount || 0);
  if (requestedCount <= 0) return latestFirst;
  let includedMemberSessions = 0;
  return latestFirst.filter((booking) => {
    if (getBookingCategory(booking?.serviceName) !== 'HYDROGEN SESSION') return true;
    if (isChargeableHydrogenMembershipBooking(booking)) return true;
    includedMemberSessions += 1;
    return includedMemberSessions <= requestedCount;
  });
}

function getScheduleLaterDisplayRowCount(bookings = state.bookings) {
  const scheduleLaterHydrogenBookings = (Array.isArray(bookings) ? bookings : []).filter(
    (booking) =>
      getBookingCategory(booking?.serviceName) === 'HYDROGEN SESSION' &&
      normalizeBookingStatusValue(booking?.status) === 'schedule_later'
  );
  return scheduleLaterHydrogenBookings.length;
}

function getFilteredAdminUsers() {
  const users = Array.isArray(state.adminUsers) ? state.adminUsers : [];
  const query = String(state.adminSessionSearch || '').trim().toLowerCase();
  const latestBookingByUser = new Map();

  (Array.isArray(state.bookings) ? state.bookings : []).forEach((booking) => {
    const userId = String(booking?.userId || '').trim();
    if (!userId) return;
    const createdAtMs = booking?.createdAt ? new Date(booking.createdAt).getTime() : Number.NaN;
    const scheduledAtMs = getBookingStartTime(booking);
    const timestamp = Number.isFinite(createdAtMs)
      ? createdAtMs
      : Number.isFinite(scheduledAtMs)
        ? scheduledAtMs
        : 0;
    const current = Number(latestBookingByUser.get(userId) || 0);
    if (timestamp > current) latestBookingByUser.set(userId, timestamp);
  });

  const sortedUsers = [...users].sort((a, b) => {
    const aTs = Number(latestBookingByUser.get(String(a?.id || '')) || 0);
    const bTs = Number(latestBookingByUser.get(String(b?.id || '')) || 0);
    if (bTs !== aTs) return bTs - aTs;
    return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' });
  });

  if (!query) {
    const limit = users.length > ADMIN_USER_CARD_LARGE_DATASET_THRESHOLD ? ADMIN_USER_CARD_DEFAULT_LIMIT : sortedUsers.length;
    return sortedUsers.slice(0, limit);
  }

  return sortedUsers.filter((user) => {
    const haystack = [user?.id, user?.name, user?.email, user?.mobile].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function getFilteredAdminMembershipOrders() {
  const orders = Array.isArray(state.adminMembershipOrders) ? state.adminMembershipOrders : [];
  const query = String(state.adminMembershipSearch || '').trim().toLowerCase();
  const paidOrders = orders.filter((order) => String(order?.status || '').trim().toLowerCase() === 'paid');
  
  // Keep only the latest order per user
  const userLatestOrders = new Map();
  for (const order of paidOrders) {
    const userId = String(order?.userId || '');
    if (!userId) continue;
    
    const existing = userLatestOrders.get(userId);
    if (!existing) {
      userLatestOrders.set(userId, order);
    } else {
      const existingDate = new Date(existing.paidAt || existing.createdAt || 0).getTime();
      const currentDate = new Date(order.paidAt || order.createdAt || 0).getTime();
      if (currentDate > existingDate) {
        userLatestOrders.set(userId, order);
      }
    }
  }
  
  const deduplicatedOrders = Array.from(userLatestOrders.values());
  
  if (!query) return deduplicatedOrders;
  return deduplicatedOrders.filter((order) => {
    const haystack = [order?.userId, order?.userName, order?.userEmail, order?.userMobile, order?.planId].join(' ').toLowerCase();
    return haystack.includes(query);
  });
}

function getTodayAdminBookings(bookings = state.bookings) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayKey = `${yyyy}-${mm}-${dd}`;
  return (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => String(booking?.bookingDate || '') === todayKey)
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
}

function isAdminPaidBookingVisible(booking) {
  const paymentStatus = normalizePaymentStatusKey(booking?.paymentStatus);
  return paymentStatus === 'paid';
}

function isAdminHistoryBookingVisible(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'cancelled') return true;
  return isAdminPaidBookingVisible(booking);
}

function isAdminDashboardBookingVisible(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  const paymentStatus = normalizePaymentStatusKey(booking?.paymentStatus);
  if (status === 'pending') return false;
  if (paymentStatus === 'unpaid') return false;
  return true;
}

function getAdminDashboardVisibleBookings(bookings = state.bookings) {
  return (Array.isArray(bookings) ? bookings : []).filter(isAdminDashboardBookingVisible);
}

function getAdminHistoryBookings(bookings = state.bookings) {
  const normalized = Array.isArray(bookings) ? bookings : [];
  return normalized
    .filter(isAdminHistoryBookingVisible)
    .sort((a, b) => {
      const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : Number.NaN;
      const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : Number.NaN;
      const aTs = Number.isFinite(aCreated) ? aCreated : getBookingStartTime(a);
      const bTs = Number.isFinite(bCreated) ? bCreated : getBookingStartTime(b);
      return (Number(bTs) || 0) - (Number(aTs) || 0);
    });
}

function getAdminPaidTodayBookings(bookings = state.bookings) {
  return getTodayAdminBookings(bookings).filter(isAdminPaidBookingVisible);
}

function getAdminPaymentPendingBookings(bookings = state.bookings) {
  const normalized = Array.isArray(bookings) ? bookings : [];
  return normalized
    .filter((booking) => String(booking?.status || '').trim().toLowerCase() !== 'cancelled')
    .filter((booking) => String(booking?.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid')
    .sort((a, b) => {
      const aCreated = a?.createdAt ? new Date(a.createdAt).getTime() : Number.NaN;
      const bCreated = b?.createdAt ? new Date(b.createdAt).getTime() : Number.NaN;
      const aTs = Number.isFinite(aCreated) ? aCreated : getBookingStartTime(a);
      const bTs = Number.isFinite(bCreated) ? bCreated : getBookingStartTime(b);
      return (Number(bTs) || 0) - (Number(aTs) || 0);
    });
}

function isIsoDateWithinRange(dateKey, startDateKey, endDateKey) {
  const date = String(dateKey || '').trim();
  let start = String(startDateKey || '').trim();
  let end = String(endDateKey || '').trim();
  if (start && end && start > end) {
    const swap = start;
    start = end;
    end = swap;
  }
  if (!start && !end) return true;
  if (!date) return false;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function getFilteredAdminPaymentPendingBookings(bookings = state.bookings) {
  const query = String(state.adminPendingBookingSearch || '').trim().toLowerCase();
  const pending = getAdminPaymentPendingBookings(bookings).filter((booking) =>
    isIsoDateWithinRange(
      booking?.bookingDate,
      state.adminPendingBookingDateFilters?.startDate,
      state.adminPendingBookingDateFilters?.endDate
    )
  );
  if (!query) return pending.length > 300 ? pending.slice(0, 10) : pending;
  return pending.filter((booking) => {
    const haystack = [booking?.clientName, booking?.clientEmail, booking?.clientMobile, booking?.serviceName]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function clearAdminAllBookingSlotFilters() {
  state.adminAllBookingSlotFilters = { date: '', time: '' };
  state.adminAllBookingDateFilters = { startDate: '', endDate: '' };
  if (elements.adminAllBookingStartDate) elements.adminAllBookingStartDate.value = '';
  if (elements.adminAllBookingEndDate) elements.adminAllBookingEndDate.value = '';
  if (elements.adminAllBookingSlotDate) elements.adminAllBookingSlotDate.value = '';
  if (elements.adminAllBookingSlotTime) elements.adminAllBookingSlotTime.value = '';
}

function getFilteredAdminAllBookings(bookings = state.bookings) {
  const query = String(state.adminAllBookingSearch || '').trim().toLowerCase();
  const filtered = getAdminHistoryBookings(bookings).filter((booking) => {
    if (
      !isIsoDateWithinRange(
        booking?.bookingDate,
        state.adminAllBookingDateFilters?.startDate,
        state.adminAllBookingDateFilters?.endDate
      )
    ) {
      return false;
    }
    const selectedTime = String(state.adminAllBookingSlotFilters?.time || '').trim();
    if (selectedTime && normalizeSlotStartTime(booking?.bookingTime) !== selectedTime) return false;
    const selectedDate = String(state.adminAllBookingSlotFilters?.date || '').trim();
    if (selectedDate && String(booking?.bookingDate || '').trim() !== selectedDate) return false;
    return true;
  });
  if (!query) return filtered.length > 300 ? filtered.slice(0, 10) : filtered;
  return filtered.filter((booking) => {
    const haystack = [booking?.clientName, booking?.clientEmail, booking?.clientMobile, booking?.serviceName]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function getAdminAllBookingBaseBookings(bookings = state.bookings) {
  const mode = String(state.adminAllBookingViewMode || 'history').trim().toLowerCase();
  return mode === 'today' ? getTodayAdminBookings(bookings) : getAdminHistoryBookings(bookings);
}

function getAdminAllBookingSlotCounts(bookings = state.bookings) {
  const mode = String(state.adminAllBookingViewMode || 'history').trim().toLowerCase();
  const selectedDate = mode === 'today' ? getTodayIsoDate() : String(state.adminAllBookingSlotFilters?.date || '').trim();
  if (!selectedDate) return new Map();
  const counts = new Map();
  getAdminAllBookingBaseBookings(bookings)
    .filter((booking) => String(booking?.bookingDate || '').trim() === selectedDate)
    .forEach((booking) => {
      const slot = normalizeSlotStartTime(booking?.bookingTime);
      if (!slot) return;
      counts.set(slot, (counts.get(slot) || 0) + 1);
  });
  return counts;
}

function renderAdminAllBookingControls(bookings = state.bookings) {
  const mode = String(state.adminAllBookingViewMode || 'history').trim().toLowerCase();
  const isTodayMode = mode === 'today';
  const selectedDate = isTodayMode ? getTodayIsoDate() : String(state.adminAllBookingSlotFilters?.date || '').trim();
  const selectedTime = String(state.adminAllBookingSlotFilters?.time || '').trim();
  const startDate = String(state.adminAllBookingDateFilters?.startDate || '').trim();
  const endDate = String(state.adminAllBookingDateFilters?.endDate || '').trim();
  if (isTodayMode && state.adminAllBookingSlotFilters?.date !== selectedDate) {
    state.adminAllBookingSlotFilters.date = selectedDate;
  }

  if (elements.adminAllBookingTitle) {
    elements.adminAllBookingTitle.textContent = isTodayMode ? "Today's Bookings" : 'History of All Bookings';
  }
  if (elements.adminAllBookingModeText) {
    elements.adminAllBookingModeText.textContent = isTodayMode
      ? "All bookings scheduled for today."
      : 'Paid and cancelled bookings across all users.';
  }
  if (elements.adminAllBookingModeToggleBtn) {
    elements.adminAllBookingModeToggleBtn.textContent = isTodayMode ? 'History' : "Today's Bookings";
  }
  if (elements.adminAllBookingSlotDate && elements.adminAllBookingSlotDate.value !== selectedDate) {
    elements.adminAllBookingSlotDate.value = selectedDate;
  }
  if (elements.adminAllBookingStartDate && elements.adminAllBookingStartDate.value !== startDate) {
    elements.adminAllBookingStartDate.value = startDate;
  }
  if (elements.adminAllBookingEndDate && elements.adminAllBookingEndDate.value !== endDate) {
    elements.adminAllBookingEndDate.value = endDate;
  }

  const slotCounts = getAdminAllBookingSlotCounts(bookings);
  if (elements.adminAllBookingSlotTime) {
    const currentValue = slotCounts.has(selectedTime) ? selectedTime : '';
    elements.adminAllBookingSlotTime.innerHTML = '';
    const allOption = document.createElement('option');
    allOption.value = '';
    const totalForDate = Array.from(slotCounts.values()).reduce((sum, count) => sum + count, 0);
    allOption.textContent = selectedDate ? `All slots (${totalForDate})` : 'Select date first';
    elements.adminAllBookingSlotTime.appendChild(allOption);

    for (const slot of SLOT_OPTIONS) {
      const count = slotCounts.get(slot.value) || 0;
      const option = document.createElement('option');
      option.value = slot.value;
      option.textContent = `${slot.label} (${count})`;
      option.disabled = selectedDate ? count === 0 : false;
      elements.adminAllBookingSlotTime.appendChild(option);
    }
    elements.adminAllBookingSlotTime.disabled = !selectedDate;
    elements.adminAllBookingSlotTime.value = currentValue;
    if (selectedTime && !currentValue) state.adminAllBookingSlotFilters.time = '';
  }

  if (elements.adminAllBookingSlotSummary) {
    if (!selectedDate) {
      elements.adminAllBookingSlotSummary.textContent = 'Choose a date to see booking counts by slot.';
    } else if (!slotCounts.size) {
      elements.adminAllBookingSlotSummary.textContent = `No bookings found on ${formatBookingDateLabel(selectedDate)}.`;
    } else {
      const slotLines = SLOT_OPTIONS
        .filter((slot) => slotCounts.has(slot.value))
        .map((slot) => `${slot.label}: ${slotCounts.get(slot.value)}`);
      elements.adminAllBookingSlotSummary.textContent = `Slot bookings on ${formatBookingDateLabel(selectedDate)}: ${slotLines.join(' | ')}`;
    }
  }
}

function getRescheduleWindowExpiresAt(booking) {
  const startTime = getBookingStartTime(booking);
  if (!Number.isFinite(startTime)) return Number.NaN;
  return startTime + ADMIN_RESCHEDULE_MISSED_WINDOW_MS;
}

function isAdminRescheduleEligible(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'cancelled' || status === 'completed') return false;
  if (status === 'schedule_later') return true;
  if (isAdminRescheduledBooking(booking)) return false;
  const startTime = getBookingStartTime(booking);
  if (!Number.isFinite(startTime)) return false;
  const now = Date.now();
  if (startTime > now) return true;
  return now <= startTime + ADMIN_RESCHEDULE_MISSED_WINDOW_MS;
}

function getAdminScheduleLaterEligibility(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (['completed', 'cancelled', 'schedule_later'].includes(status)) {
    return { allowed: false, message: 'This session is already completed, cancelled, or waiting to be scheduled.' };
  }
  if (!['booked', 'confirmed'].includes(status)) {
    return { allowed: false, message: 'Only booked sessions can be moved to Schedule Later.' };
  }
  if (String(booking?.paymentStatus || '').trim().toLowerCase() !== 'paid') {
    return { allowed: false, message: 'Only paid bookings can be moved to Schedule Later.' };
  }
  const notesLower = String(booking?.notes || '').toLowerCase();
  if (notesLower.includes('moved to schedule later by user') || notesLower.includes('moved to schedule later by admin')) {
    return { allowed: false, message: 'Schedule Later was already used once for this session.' };
  }
  const slotStart = getBookingStartTime(booking);
  if (!Number.isFinite(slotStart)) {
    return { allowed: false, message: 'This booking slot is invalid.' };
  }
  if (Date.now() > slotStart + ADMIN_RESCHEDULE_MISSED_WINDOW_MS) {
    return { allowed: false, message: 'Admin can move a session to Schedule Later only until 15 minutes after slot start.' };
  }
  return { allowed: true, message: '' };
}

function isAdminRescheduledBooking(booking) {
  return isBookingRescheduled(booking);
}

function getAdminRescheduleHistory(booking) {
  const notes = String(booking?.notes || '');
  const matches = [
    ...notes.matchAll(
      /(?:Rescheduled by (?:user|admin)|Scheduled later by user) from\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/gi
    ),
  ];
  const latest = matches[matches.length - 1];
  if (!latest) {
    return {
      originalDate: '',
      originalTime: '',
      rescheduledDate: booking?.bookingDate || '',
      rescheduledTime: booking?.bookingTime || '',
    };
  }
  return {
    originalDate: latest[1],
    originalTime: latest[2],
    rescheduledDate: latest[3],
    rescheduledTime: latest[4],
  };
}

function getBookingRescheduleHistory(booking) {
  const notes = String(booking?.notes || '');
  const matches = [
    ...notes.matchAll(
      /(?:Rescheduled by (?:user|admin)|Scheduled later by user) from\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/gi
    ),
  ];
  const latest = matches[matches.length - 1];
  if (!latest) return null;
  return {
    previousDate: latest[1],
    previousTime: latest[2],
    rescheduledDate: latest[3],
    rescheduledTime: latest[4],
  };
}

function isBookingRescheduled(booking) {
  return Boolean(getBookingRescheduleHistory(booking)) || Number(booking?.rescheduleCount || 0) > 0;
}

function getAdminRescheduleViewMode() {
  const view = String(state.adminRescheduleView || 'queue').trim().toLowerCase();
  return ['rescheduled', 'schedule_later'].includes(view) ? view : 'queue';
}

function getFilteredAdminRescheduleBookings(bookings = state.bookings) {
  const query = String(state.adminRescheduleSearch || '').trim().toLowerCase();
  const selectedDate = String(state.adminRescheduleDateFilter || '').trim();
  const selectedSlot = String(state.adminRescheduleSlotFilter || '').trim();
  const view = getAdminRescheduleViewMode();
  const queue = (Array.isArray(bookings) ? bookings : [])
    .filter((booking) => String(booking?.paymentStatus || '').trim().toLowerCase() === 'paid')
    .filter((booking) => {
      const status = String(booking?.status || '').trim().toLowerCase();
      if (view === 'rescheduled') return true;
      if (view === 'schedule_later') return status === 'schedule_later';
      return !['completed', 'cancelled', 'schedule_later'].includes(status);
    })
    .filter((booking) => {
      if (view === 'schedule_later') return true;
      const wasRescheduled = isAdminRescheduledBooking(booking);
      return view === 'rescheduled' ? wasRescheduled : !wasRescheduled && isAdminRescheduleEligible(booking);
    })
    .filter((booking) => {
      if (!selectedDate) return true;
      const history = getAdminRescheduleHistory(booking);
      const dateToCompare = view === 'rescheduled' ? history.originalDate || booking.bookingDate : booking.bookingDate;
      return String(dateToCompare || '').trim() === selectedDate;
    })
    .filter((booking) => {
      if (!selectedSlot) return true;
      const history = getAdminRescheduleHistory(booking);
      const slotToCompare = view === 'rescheduled' ? history.originalTime || booking.bookingTime : booking.bookingTime;
      return normalizeSlotStartTime(slotToCompare) === selectedSlot;
    })
    .sort((a, b) => {
      if (view === 'rescheduled') {
        const aHistory = getAdminRescheduleHistory(a);
        const bHistory = getAdminRescheduleHistory(b);
        return getBookingStartTime({ bookingDate: bHistory.rescheduledDate, bookingTime: bHistory.rescheduledTime })
          - getBookingStartTime({ bookingDate: aHistory.rescheduledDate, bookingTime: aHistory.rescheduledTime });
      }
      return getBookingStartTime(a) - getBookingStartTime(b);
    });
  if (!query) return queue;
  return queue.filter((booking) => {
    const history = getAdminRescheduleHistory(booking);
    const haystack = [
      booking?.clientName,
      booking?.clientEmail,
      booking?.clientMobile,
      booking?.serviceName,
      booking?.notes,
      formatDateTime(history.originalDate, history.originalTime),
      formatDateTime(history.rescheduledDate, history.rescheduledTime),
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

function getServiceCategoryForBooking(booking) {
  return String(getServiceCatalogEntry(booking?.serviceName || '')?.category || '').trim().toUpperCase();
}

function getAdminRescheduleSelection(booking) {
  const id = String(booking?.id || '');
  const existing = state.adminRescheduleSelections?.[id] || {};
  const bookingCategory = getServiceCategoryForBooking(booking) || 'HYDROGEN SESSION';
  const date = String(existing.bookingDate || getTodayIsoDate()).trim();
  return {
    bookingDate: date < getTodayIsoDate() ? getTodayIsoDate() : date,
    bookingTime: String(existing.bookingTime || '').trim(),
    category: bookingCategory,
  };
}

function getAdminRescheduleAvailabilityKey(bookingId, bookingDate, category) {
  return [bookingId, bookingDate, category].map((value) => String(value || '').trim()).join('|');
}

async function loadAdminRescheduleAvailability(booking) {
  const id = String(booking?.id || '');
  if (!id) return;
  const selection = getAdminRescheduleSelection(booking);
  const key = getAdminRescheduleAvailabilityKey(id, selection.bookingDate, selection.category);
  state.adminRescheduleLoading = { ...(state.adminRescheduleLoading || {}), [id]: true };
  renderAdminRescheduleQueue();
  try {
    const params = new URLSearchParams({
      bookingDate: selection.bookingDate,
      category: selection.category || 'HYDROGEN SESSION',
    });
    const result = await api(`/api/services/availability?${params.toString()}`);
    state.adminRescheduleAvailability = {
      ...(state.adminRescheduleAvailability || {}),
      [key]: {
        availability: result.availability || {},
        holds: result.holds || {},
        slotCapacityByService: result.slotCapacityByService || {},
      },
    };
  } finally {
    state.adminRescheduleLoading = { ...(state.adminRescheduleLoading || {}), [id]: false };
    renderAdminRescheduleQueue();
  }
}

function getAvailableAdminRescheduleSlots(booking) {
  const selection = getAdminRescheduleSelection(booking);
  const key = getAdminRescheduleAvailabilityKey(booking.id, selection.bookingDate, selection.category);
  const payload = state.adminRescheduleAvailability?.[key] || null;
  if (!payload) return [];
  const serviceName = String(booking?.serviceName || '').trim();
  const bookedBySlot = payload.availability?.[serviceName] || {};
  const holdsBySlot = payload.holds?.[serviceName] || {};
  const capacity = Math.max(1, Number(payload.slotCapacityByService?.[serviceName] || 1));
  return SLOT_OPTIONS.filter((slot) => {
    if (isBookingSlotInPast(selection.bookingDate, slot.value)) return false;
    const booked = Number(bookedBySlot[slot.value] || 0);
    const held = Number(holdsBySlot[slot.value] || 0);
    return booked + held < capacity;
  });
}

async function openAdminRescheduleForBooking(booking) {
  if (!booking?.id) return;
  const alreadyRescheduled = isAdminRescheduledBooking(booking);
  const isScheduleLater = String(booking?.status || '').trim().toLowerCase() === 'schedule_later';
  const history = getAdminRescheduleHistory(booking);
  state.adminActiveTab = 'rescheduled';
  state.adminRescheduleView = isScheduleLater ? 'schedule_later' : alreadyRescheduled ? 'rescheduled' : 'queue';
  state.adminRescheduleDateFilter = String(
    alreadyRescheduled ? history.originalDate || booking.bookingDate : booking.bookingDate || ''
  ).trim();
  state.adminRescheduleSlotFilter = normalizeSlotStartTime(
    alreadyRescheduled ? history.originalTime || booking.bookingTime : booking.bookingTime || ''
  );
  state.adminRescheduleSearch = String(booking.clientMobile || booking.clientEmail || booking.clientName || booking.id || '')
    .trim()
    .toLowerCase();
  if (elements.adminRescheduleSearch) elements.adminRescheduleSearch.value = state.adminRescheduleSearch;
  if (elements.adminRescheduleDate) elements.adminRescheduleDate.value = state.adminRescheduleDateFilter;
  if (!alreadyRescheduled) {
    state.adminRescheduleSelections = {
      ...(state.adminRescheduleSelections || {}),
      [String(booking.id)]: {
        bookingDate: getTodayIsoDate(),
        bookingTime: '',
      },
    };
  }
  render();
  requestAnimationFrame(() => {
    elements.adminRescheduledSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function renderAdminRescheduleSlotFilters() {
  if (!elements.adminRescheduleSlotFilters) return;
  const selectedDate = String(state.adminRescheduleDateFilter || '').trim();
  const selectedSlot = String(state.adminRescheduleSlotFilter || '').trim();
  const view = getAdminRescheduleViewMode();
  const source = (Array.isArray(state.bookings) ? state.bookings : [])
    .filter((booking) => String(booking?.paymentStatus || '').trim().toLowerCase() === 'paid')
    .filter((booking) => {
      const status = String(booking?.status || '').trim().toLowerCase();
      if (view === 'schedule_later') return status === 'schedule_later';
      if (view !== 'rescheduled' && ['completed', 'cancelled', 'schedule_later'].includes(status)) return false;
      const wasRescheduled = isAdminRescheduledBooking(booking);
      return view === 'rescheduled' ? wasRescheduled : !wasRescheduled && isAdminRescheduleEligible(booking);
    })
    .filter((booking) => {
      if (!selectedDate) return true;
      const history = getAdminRescheduleHistory(booking);
      const dateToCompare = view === 'rescheduled' ? history.originalDate || booking.bookingDate : booking.bookingDate;
      return String(dateToCompare || '').trim() === selectedDate;
    });
  const counts = new Map(SLOT_OPTIONS.map((slot) => [slot.value, 0]));
  for (const booking of source) {
    const history = getAdminRescheduleHistory(booking);
    const slotValue = normalizeSlotStartTime(view === 'rescheduled' ? history.originalTime || booking.bookingTime : booking.bookingTime);
    if (counts.has(slotValue)) counts.set(slotValue, Number(counts.get(slotValue) || 0) + 1);
  }

  elements.adminRescheduleSlotFilters.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = `admin-slot-filter-btn${selectedSlot ? '' : ' is-active'}`;
  allBtn.type = 'button';
  allBtn.innerHTML = `<span>All slots</span><strong>${source.length}</strong>`;
  allBtn.addEventListener('click', () => {
    state.adminRescheduleSlotFilter = '';
    renderAdminRescheduleQueue();
  });
  elements.adminRescheduleSlotFilters.appendChild(allBtn);

  for (const slot of SLOT_OPTIONS) {
    const btn = document.createElement('button');
    const count = Number(counts.get(slot.value) || 0);
    btn.className = `admin-slot-filter-btn${selectedSlot === slot.value ? ' is-active' : ''}`;
    btn.type = 'button';
    btn.innerHTML = `<span>${escapeHtml(slot.label)}</span><strong>${escapeHtml(String(count))}</strong>`;
    btn.addEventListener('click', () => {
      state.adminRescheduleSlotFilter = selectedSlot === slot.value ? '' : slot.value;
      renderAdminRescheduleQueue();
    });
    elements.adminRescheduleSlotFilters.appendChild(btn);
  }
}

function renderMemberChoiceGateCta() {
  if (!elements.topExplorePlansBtn) return;
  const isAuthenticatedUser = state.user?.role === 'user';
  const label = isAuthenticatedUser ? 'Continue Booking' : 'Sign Up / Log In';
  const ariaLabel = isAuthenticatedUser
    ? 'Continue to services'
    : 'Sign in or create an account to continue';
  elements.topExplorePlansBtn.innerHTML = `${label} <span aria-hidden="true">&rarr;</span>`;
  elements.topExplorePlansBtn.setAttribute('aria-label', ariaLabel);
}

function render() {
  document.body.classList.remove('app-booting');
  const isAuthenticated = Boolean(state.user);
  const isGuest = Boolean(state.isGuestUser && !state.user);
  const isAppUser = isAuthenticated || isGuest;
  const showAuthCard = !isAppUser && state.showAuthCard;
  const showPublicChoiceGate = !isAppUser && !showAuthCard;
  document.body.classList.toggle('auth-mode', showAuthCard);
  if (elements.authShell) elements.authShell.hidden = !showAuthCard;
  elements.authCard.hidden = !showAuthCard;
  elements.appArea.hidden = !isAppUser;
  renderMemberChoiceGateCta();

  document.querySelectorAll('.app-only').forEach((el) => {
    el.hidden = !isAppUser;
  });

  if (!isAppUser) {
    document.querySelectorAll('.app-only, .user-only, .admin-only').forEach((el) => {
      el.hidden = true;
    });
    if (elements.memberChoiceGate) {
      elements.memberChoiceGate.hidden = !showPublicChoiceGate;
    }
    elements.bookingTableBody.innerHTML = '';
    if (elements.cartTableBody) elements.cartTableBody.innerHTML = '';
    elements.adminBookingTableBody.innerHTML = '';
    if (elements.adminMembershipOrdersList) elements.adminMembershipOrdersList.innerHTML = '';
    return;
  }

  const isAdmin = state.user?.role === 'admin';
  if (!isAdmin) {
    syncPostLoginChoiceWithMembership();
  }
  const needsPostLoginChoice = state.user?.role === 'user' && !state.postLoginChoice;
  document.querySelectorAll('.user-only').forEach((el) => {
    el.hidden = isAdmin;
  });
  document.querySelectorAll('.admin-only').forEach((el) => {
    el.hidden = !isAdmin;
  });

  if (elements.memberChoiceGate) {
    elements.memberChoiceGate.hidden = !needsPostLoginChoice;
  }
  if (elements.userTabNav) {
    elements.userTabNav.hidden = isAdmin || needsPostLoginChoice;
  }
  if (elements.comboNotice) {
    elements.comboNotice.hidden = isAdmin || needsPostLoginChoice;
  }

  if (needsPostLoginChoice) {
    document.querySelectorAll('.app-only').forEach((el) => {
      if (el !== elements.memberChoiceGate) {
        el.hidden = true;
      }
    });
  }

  elements.userName.textContent = isGuest ? 'Guest' : formatDisplayName(state.user?.name);
  elements.userRole.textContent = isGuest ? 'Guest' : state.user?.role;
  renderProfileAvatar();
  renderProfileMembershipBadge();
  renderServicePanelContext();
  renderCartButtonState();

  if (needsPostLoginChoice) {
    return;
  }

  if (!isAdmin) {
    const activeTab = state.activeUserTab || 'services';
    if (elements.userTabServices) elements.userTabServices.classList.toggle('is-active', activeTab === 'services');
    if (elements.userTabMembership) elements.userTabMembership.classList.toggle('is-active', activeTab === 'membership');
    if (elements.userTabBookings) elements.userTabBookings.classList.toggle('is-active', activeTab === 'bookings');
    if (elements.userTabCart) elements.userTabCart.classList.toggle('is-active', activeTab === 'cart');
    if (isGuest) {
      if (elements.userTabMembership) elements.userTabMembership.hidden = true;
      if (elements.userTabBookings) elements.userTabBookings.hidden = true;
    } else {
      if (elements.userTabMembership) elements.userTabMembership.hidden = false;
      if (elements.userTabBookings) elements.userTabBookings.hidden = false;
    }
    if (elements.membershipSection) elements.membershipSection.hidden = activeTab !== 'membership';
    if (elements.servicesSection) elements.servicesSection.hidden = activeTab !== 'services';
    if (elements.userBookingsSection) elements.userBookingsSection.hidden = activeTab !== 'bookings';
    if (elements.userCartSection) elements.userCartSection.hidden = activeTab !== 'cart';
  } else {
    if (elements.bookingFiltersSection) elements.bookingFiltersSection.hidden = false;
  }

  renderStats(state.bookings);
  renderMembership();
  renderServices();
  renderMembershipCouponPreview();
  renderMembershipCheckoutSummary();
  renderCartCouponPreview();
  renderGeneralCoupons();

  if (isAdmin) {
    let activeAdminTab = state.adminActiveTab || 'bookings';
    if (activeAdminTab === 'userbookings') {
      activeAdminTab = 'bookings';
      state.adminActiveTab = 'bookings';
    }
    if (activeAdminTab === 'history' || activeAdminTab === 'today') {
      if (activeAdminTab === 'today') state.adminAllBookingViewMode = 'today';
      activeAdminTab = 'bookings';
      state.adminActiveTab = 'bookings';
    }
    renderAdminUserCards();

    if (elements.adminTabNav) elements.adminTabNav.hidden = false;
    elements.adminTabBookings?.classList.toggle('is-active', activeAdminTab === 'bookings');
    elements.adminTabUserBookings?.classList.toggle('is-active', false);
    elements.adminTabHistory?.classList.toggle('is-active', false);
    elements.adminTabSessions?.classList.toggle('is-active', activeAdminTab === 'sessions');
    elements.adminTabCalendar?.classList.toggle('is-active', activeAdminTab === 'calendar');
    elements.adminTabMemberships?.classList.toggle('is-active', activeAdminTab === 'memberships');
    elements.adminTabCoupons?.classList.toggle('is-active', activeAdminTab === 'coupons');
    elements.adminTabRescheduled?.classList.toggle('is-active', activeAdminTab === 'rescheduled');

    if (elements.adminHistoryToggleBtnWrap) elements.adminHistoryToggleBtnWrap.hidden = true;
    if (elements.adminHistorySection) elements.adminHistorySection.hidden = true;
    if (elements.adminUserBookingsSection) elements.adminUserBookingsSection.hidden = true;
    if (elements.adminAllBookingsSection) elements.adminAllBookingsSection.hidden = activeAdminTab !== 'bookings';
    if (elements.adminUserSessionsSection) elements.adminUserSessionsSection.hidden = activeAdminTab !== 'sessions';
    if (elements.adminCalendarSection) elements.adminCalendarSection.hidden = activeAdminTab !== 'calendar';
    if (elements.adminMembershipSection) elements.adminMembershipSection.hidden = activeAdminTab !== 'memberships';
    if (elements.adminCouponsSection) elements.adminCouponsSection.hidden = activeAdminTab !== 'coupons';
    if (elements.adminRescheduledSection) elements.adminRescheduledSection.hidden = activeAdminTab !== 'rescheduled';
    if (elements.servicesSection) elements.servicesSection.hidden = true;
    if (elements.bookingFiltersSection) elements.bookingFiltersSection.hidden = true;

    if (activeAdminTab === 'bookings') {
      renderAdminAllBookingControls(state.bookings);
      renderAdminAllBookingRows(getFilteredAdminAllBookings(state.bookings));
    }
    renderAdminCalendar();
    renderAdminUserSessionDialog();
    renderAdminMembershipOrders();
    renderAdminRescheduleQueue();
    renderAdminDiscountPhones();
    renderAdminDiscountUsers();
    renderAdminCoupons();
    renderMyBookingsSessionTracking();
  } else {
    const cartSourceBookings = isGuest ? getGuestCartBookings() : state.bookings || [];
    const cartPayableBookings = getUserCartPayableBookings(cartSourceBookings);
    const cartDisplayBookings = getUserCartDisplayBookings(cartSourceBookings);
    const historyBookings = getUserHistoryBookings(state.bookings || []);
    const filteredHistoryBookings = getFilteredUserHistoryBookings(historyBookings);
    elements.myBookingsFilterAll?.classList.toggle('is-active', (state.userBookingsFilter || 'all') === 'all');
    elements.myBookingsFilterUpcoming?.classList.toggle('is-active', (state.userBookingsFilter || 'all') === 'upcoming');
    elements.myBookingsFilterCompleted?.classList.toggle('is-active', (state.userBookingsFilter || 'all') === 'completed');
    elements.myBookingsFilterScheduleLater?.classList.toggle('is-active', (state.userBookingsFilter || 'all') === 'schedule_later');
    if (elements.memberSessionCountValue) {
      const value = Number(state.memberSessionDisplayCount || 0);
      elements.memberSessionCountValue.textContent = value > 0 ? String(value) : 'All';
    }
    if (elements.memberSessionCountDecBtn) {
      elements.memberSessionCountDecBtn.disabled = Number(state.memberSessionDisplayCount || 0) <= 0;
    }
    renderUserRows(isGuest ? [] : filteredHistoryBookings, state.userMembershipOrders || [], historyBookings);
    renderCartRows(cartDisplayBookings);
    renderUserCheckoutSummary(cartPayableBookings);

    if (elements.bookingsCartNotice) {
      const cartCount = getUserCartUnitCount(cartSourceBookings);
      elements.bookingsCartNotice.hidden = !(state.activeUserTab === 'bookings' && cartCount > 0);
    }
  }
}

function renderServicePanelContext() {
  if (elements.servicePanelLead) {
    if (state.user?.role === 'admin') {
      elements.servicePanelLead.textContent =
        'Enter customer details, then choose the service and slot. After booking, share the generated payment link.';
      elements.servicePanelLead.hidden = false;
    } else {
      elements.servicePanelLead.textContent = '';
      elements.servicePanelLead.hidden = true;
    }
  }

  if (elements.servicePageNote) {
    elements.servicePageNote.hidden = state.user?.role === 'admin';
  }

  if (elements.adminCustomerName) elements.adminCustomerName.value = state.adminCustomerForm.name || '';
  if (elements.adminCustomerEmail) elements.adminCustomerEmail.value = state.adminCustomerForm.email || '';
  if (elements.adminCustomerPhone) elements.adminCustomerPhone.value = state.adminCustomerForm.phone || '';

  if (elements.adminClientMeta) {
    const resolvedCustomer = state.adminResolvedCustomer;
    if (state.user?.role !== 'admin' || !isAdminCustomerFormReady()) {
      elements.adminClientMeta.hidden = true;
      elements.adminClientMeta.innerHTML = '';
      if (state.user?.role === 'admin' && !elements.adminCustomerMessage?.textContent) {
        setAdminCustomerMessage('Enter customer name, email, and contact number to load services.');
      }
      return;
    }

    const membershipStatus = String(resolvedCustomer?.membershipStatus || 'inactive');
    const membershipSummary =
      membershipStatus === 'active'
        ? `Active${resolvedCustomer?.membershipPeopleCount ? ` • ${resolvedCustomer.membershipPeopleCount} member${resolvedCustomer.membershipPeopleCount > 1 ? 's' : ''}` : ''}`
        : 'Inactive';
    const activeDiscount = Number(resolvedCustomer?.discountPercent || 0);
    elements.adminClientMeta.hidden = false;
    elements.adminClientMeta.innerHTML = `
      <div class="admin-client-chip">
        <strong>Customer</strong>
        <span>${escapeHtml(state.adminCustomerForm.name || '-')}</span>
      </div>
      <div class="admin-client-chip">
        <strong>Contact</strong>
        <span>${escapeHtml(state.adminCustomerForm.phone || state.adminCustomerForm.email || '-')}</span>
      </div>
      <div class="admin-client-chip">
        <strong>Membership</strong>
        <span>${escapeHtml(membershipSummary)}</span>
      </div>
      <div class="admin-client-chip">
        <strong>Valid Till</strong>
        <span>${resolvedCustomer?.membershipExpiresAt ? escapeHtml(formatDateOnly(resolvedCustomer.membershipExpiresAt)) : '-'}</span>
      </div>
      <div class="admin-client-chip">
        <strong>Discount</strong>
        <span>${activeDiscount > 0 ? `${activeDiscount}%` : '-'}</span>
      </div>
    `;
  }
}

function isCurrentUserMembershipActive() {
  if (state.user?.role !== 'user') return false;
  if (state.membership?.active) return true;
  const membershipStatus = String(state.user?.membershipStatus || '').trim().toLowerCase();
  if (membershipStatus !== 'active') return false;
  const startedAt = state.user?.membershipStartedAt ? new Date(state.user.membershipStartedAt).getTime() : NaN;
  const storedExpiresAt = state.user?.membershipExpiresAt ? new Date(state.user.membershipExpiresAt).getTime() : NaN;
  const expiresAt = Number.isFinite(startedAt)
    ? startedAt + 365 * 24 * 60 * 60 * 1000
    : storedExpiresAt;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function hasHydrogenMemberPricingAccess(service = null) {
  if (service && typeof service.membershipActive === 'boolean') {
    return service.membershipActive;
  }
  return isCurrentUserMembershipActive();
}

function getEffectiveMembershipExpiryDate(startedAtValue, expiresAtValue) {
  const startedAt = startedAtValue ? new Date(startedAtValue).getTime() : NaN;
  if (Number.isFinite(startedAt)) {
    return new Date(startedAt + 365 * 24 * 60 * 60 * 1000);
  }
  const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
  return expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null;
}

function toLocalIsoDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMembershipIsoRange() {
  if (!isCurrentUserMembershipActive()) return null;
  const expiresAt = getEffectiveMembershipExpiryDate(state.user?.membershipStartedAt, state.user?.membershipExpiresAt);
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) return null;

  const startedAtMs = state.user?.membershipStartedAt ? new Date(state.user.membershipStartedAt).getTime() : NaN;
  const startedAt = Number.isFinite(startedAtMs) ? new Date(startedAtMs) : new Date(expiresAt.getTime() - 365 * 24 * 60 * 60 * 1000);
  return {
    startIso: toLocalIsoDate(startedAt),
    endIso: toLocalIsoDate(expiresAt),
    startMs: startedAt.getTime(),
    endMs: expiresAt.getTime(),
  };
}

function isBookingWithinMembershipRange(booking, range) {
  if (!range) return true;
  const createdAtMs = booking?.createdAt ? new Date(booking.createdAt).getTime() : Number.NaN;
  if (Number.isFinite(createdAtMs) && Number.isFinite(range.startMs) && Number.isFinite(range.endMs)) {
    return createdAtMs >= range.startMs && createdAtMs <= range.endMs;
  }
  const bookingDate = String(booking?.bookingDate || '').trim();
  if (!range.startIso || !range.endIso || !bookingDate) return true;
  return bookingDate >= range.startIso && bookingDate <= range.endIso;
}

function getHydrogenSessionsUsedThisMembership() {
  const range = getCurrentMembershipIsoRange();
  const bookings = Array.isArray(state.bookings) ? state.bookings : [];
  return bookings.filter((booking) => {
    if (getBookingCategory(booking.serviceName) !== 'HYDROGEN SESSION') return false;
    const status = String(booking.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'schedule_later') return false;
    if (booking.holdExpired) return false;
    // Included/free membership sessions are allocated when booked, not when completed.
    // Chargeable top-up sessions are tracked separately in the top-up counters.
    if (!isMembershipCoveredHydrogenBooking(booking)) return false;
    if (!range?.startIso || !range?.endIso) return true;
    const bookingDate = String(booking.bookingDate || '').trim();
    return bookingDate >= range.startIso && bookingDate <= range.endIso;
  }).length;
}

function getHydrogenSessionsCompletedThisMembership() {
  const range = getCurrentMembershipIsoRange();
  const bookings = Array.isArray(state.bookings) ? state.bookings : [];
  return bookings.filter((booking) => {
    if (getBookingCategory(booking.serviceName) !== 'HYDROGEN SESSION') return false;
    if (String(booking.status || '').toLowerCase() !== 'completed') return false;
    if (booking.holdExpired) return false;
    if (!isMembershipCoveredHydrogenBooking(booking)) return false;
    if (!range?.startIso || !range?.endIso) return true;
    const bookingDate = String(booking.bookingDate || '').trim();
    return bookingDate >= range.startIso && bookingDate <= range.endIso;
  }).length;
}

function isBuyExtraHydrogenBooking(booking) {
  const category = getBookingCategory(booking?.serviceName);
  if (category !== 'HYDROGEN SESSION') return false;
  if (Number(booking?.isTopUpSession || 0) === 1) {
    return true;
  }
  const paymentReference = String(booking?.paymentReference || '').trim().toLowerCase();
  if (paymentReference === 'buy_extra') return true;
  if (paymentReference === 'membership') return false;
  const notes = String(booking?.notes || '').toLowerCase();
  const match = notes.match(/hydrogen package\s+(\d+)\s*\+\s*extra\s*(\d+)/i);
  if (!match) return false;
  const packageSessions = Number(match[1] || 0);
  const extraSessions = Number(match[2] || 0);
  if (!Number.isFinite(packageSessions) || !Number.isFinite(extraSessions)) return false;
  return Boolean(paymentReference) && (extraSessions === 0 || packageSessions > 1);
}

function isChargeableHydrogenMembershipBooking(booking) {
  return isBuyExtraHydrogenBooking(booking);
}

function isMembershipCoveredHydrogenBooking(booking) {
  if (getBookingCategory(booking?.serviceName) !== 'HYDROGEN SESSION') return false;
  if (isChargeableHydrogenMembershipBooking(booking)) return false;
  return String(booking?.paymentReference || '').trim().toLowerCase() === 'membership';
}

function getHydrogenExtraSessionsThisMembership() {
  const bookings = Array.isArray(state.bookings) ? state.bookings : [];
  return bookings.filter((booking) => {
    const status = String(booking.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'schedule_later') return false;
    if (booking.holdExpired) return false;
    if (!isChargeableHydrogenMembershipBooking(booking)) return false;
    return String(booking.paymentStatus || '').toLowerCase() === 'paid';
  }).length;
}

function getConvertedNonMemberTopUpSessionsThisMembership() {
  if (!isCurrentUserMembershipActive()) return 0;
  const membershipStartedAt = state.user?.membershipStartedAt ? new Date(state.user.membershipStartedAt).getTime() : NaN;
  if (!Number.isFinite(membershipStartedAt)) return 0;
  const bookings = Array.isArray(state.bookings) ? state.bookings : [];
  return bookings.filter((booking) => {
    const status = String(booking.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'schedule_later') return false;
    if (booking.holdExpired) return false;
    if (!isChargeableHydrogenMembershipBooking(booking)) return false;
    if (String(booking.paymentStatus || '').toLowerCase() !== 'paid') return false;
    const paidAt = booking.paidAt ? new Date(booking.paidAt).getTime() : NaN;
    const createdAt = booking.createdAt ? new Date(booking.createdAt).getTime() : NaN;
    return [paidAt, createdAt].some((time) => Number.isFinite(time) && time < membershipStartedAt);
  }).length;
}

function getHydrogenMissedSessionsThisMembership() {
  const range = getCurrentMembershipIsoRange();
  const bookings = Array.isArray(state.bookings) ? state.bookings : [];
  return bookings.filter((booking) => {
    const status = String(booking.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'completed' || status === 'schedule_later') return false;
    if (getBookingCategory(booking.serviceName) !== 'HYDROGEN SESSION') return false;
    if (!isBookingMissed(booking)) return false;
    if (!range?.startIso || !range?.endIso) return true;
    const bookingDate = String(booking.bookingDate || '').trim();
    return bookingDate >= range.startIso && bookingDate <= range.endIso;
  }).length;
}

function getUnifiedHydrogenTrackingSummary(bookings = state.bookings) {
  const all = Array.isArray(bookings) ? bookings : [];
  const hydrogenBookings = all.filter((booking) => {
    const status = String(booking?.status || '').toLowerCase();
    if (status === 'cancelled' || status === 'schedule_later') return false;
    if (booking?.holdExpired) return false;
    return getBookingCategory(booking?.serviceName) === 'HYDROGEN SESSION';
  });
  const completedSessions = hydrogenBookings.filter(
    (booking) => String(booking?.status || '').toLowerCase() === 'completed'
  ).length;
  const upcomingSessions = hydrogenBookings.filter((booking) => {
    const status = String(booking?.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || status === 'schedule_later') return false;
    return !isBookingSlotInPast(booking.bookingDate, booking.bookingTime);
  }).length;
  const missedSessions = hydrogenBookings.filter(isBookingMissed).length;
  const totalSessions = hydrogenBookings.length;
  const remainingSessions = Math.max(0, totalSessions - completedSessions);
  return {
    totalSessions,
    completedSessions,
    upcomingSessions,
    missedSessions,
    remainingSessions,
    usagePercent: totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0,
    hydrogenBookings,
  };
}

function getHydrogenFreeSessionsRemainingClient() {
  if (!isCurrentUserMembershipActive()) return 0;
  const used = getHydrogenSessionsUsedThisMembership();
  return Math.max(0, HYDROGEN_FREE_SESSIONS_PER_USER - used);
}

function renderProfileMembershipBadge() {
  if (!elements.userMembershipBadge) return;
  const isActiveMember = isCurrentUserMembershipActive();
  const isVisible = state.user?.role === 'user' && isActiveMember;
  elements.userMembershipBadge.hidden = !isVisible;
  if (!isVisible) {
    elements.userMembershipBadge.removeAttribute('title');
    return;
  }
  const expiresAt = getEffectiveMembershipExpiryDate(state.user?.membershipStartedAt, state.user?.membershipExpiresAt);
  elements.userMembershipBadge.textContent = '★ Member';
  elements.userMembershipBadge.title =
    expiresAt && !Number.isNaN(expiresAt.getTime()) ? `Membership active until ${formatDateAsDayMonthYear(expiresAt)}` : 'Membership active';
}

function getMembershipHydrogenSessionSummary() {
  const current = state.membership?.current || {};
  const active = Boolean(state.membership?.active) && isCurrentUserMembershipActive();
  const plan = (state.membership?.plans || []).find((item) => String(item.id) === String(current.plan || '')) || null;
  const fallbackSessionsByPlan = {
    h2_single: 16,
    h2_two: 32,
    h2_four: 64,
    h2_add_person: 16,
  };
  const totalSessions = Number(
    current.individualH2SessionsIncluded ||
      (Number(plan?.peopleCount || 0) > 0 ? Math.floor(Number(plan?.h2SessionsIncluded || 0) / Number(plan.peopleCount || 1)) : 0) ||
      plan?.h2SessionsIncluded ||
      current.h2SessionsIncluded ||
      fallbackSessionsByPlan[String(current.plan || '').trim()] ||
      0
  );
  const usedSessions = active ? getHydrogenSessionsUsedThisMembership() : 0;
  const completedSessions = active ? getHydrogenSessionsCompletedThisMembership() : 0;
  const missedSessions = active ? getHydrogenMissedSessionsThisMembership() : 0;
  const remainingSessions = totalSessions > 0 ? Math.max(0, totalSessions - usedSessions) : 0;

  return {
    active,
    totalSessions,
    usedSessions,
    completedSessions,
    missedSessions,
    remainingSessions,
    usagePercent: totalSessions > 0 ? Math.min(100, Math.round((completedSessions / totalSessions) * 100)) : 0,
  };
}

function renderServices() {
  if (!elements.serviceGrid) return;

  const experienceCard = document.getElementById('experienceCard');
  if (experienceCard) {
    const isMember = isCurrentUserMembershipActive();
    const demoAlreadyUsed = hasCurrentUserUsedExperienceSession();
    experienceCard.hidden = isMember || demoAlreadyUsed;
  }
  if (elements.experienceBookBtn) {
    const demoAlreadyUsed = hasCurrentUserUsedExperienceSession();
    elements.experienceBookBtn.disabled = demoAlreadyUsed;
    elements.experienceBookBtn.textContent = demoAlreadyUsed ? 'Already Booked' : 'Add to Cart';
  }
  if (elements.experienceCardPrice) {
    const experienceService = getServiceCatalogEntry('Experience Session') || getServiceCatalogEntry('Demo Session');
    const priceInr = Number(experienceService?.effectivePriceInr ?? experienceService?.priceInr ?? 4000) || 4000;
    elements.experienceCardPrice.innerHTML = `<strong>Rs. ${priceInr.toLocaleString('en-IN')}</strong>`;
  }

  elements.serviceGrid.innerHTML = '';
  if (!state.services.length) {
    elements.serviceEmpty.hidden = false;
    elements.serviceEmpty.textContent =
      state.user?.role === 'admin' ? 'No services available for this customer.' : 'No services configured.';
    return;
  }

  elements.serviceEmpty.hidden = true;
  elements.serviceGrid.classList.add('service-catalog-grid');

  const categoryVisuals = {
    'HYDROGEN SESSION': {
      title: 'Hydrogen Session',
      subtitle: 'Revitalize your cells',
      image: '/booking/assets/service-hydrogen-session.jpg',
      imageAlt: 'Hydrogen session equipment',
    },
    'IV THERAPIES': {
      title: 'Therapies',
      subtitle: 'Restore and hydrate',
      image: '/booking/assets/service-iv-therapies.jpg',
      imageAlt: 'IV therapy drip setup',
    },
    'IV SHOTS': {
      title: 'Shots',
      subtitle: 'Boost your energy',
      image: '/booking/assets/service-iv-shots.jpg',
      imageAlt: 'IV shot ampoules and syringe',
    },
  };

  const formatCategoryLabel = (value) => {
    const normalized = String(value || '').trim().toUpperCase();
    if (normalized === 'HYDROGEN SESSION') {
      return isCurrentUserMembershipActive() ? 'Membership Sessions' : 'Hydrogen Session';
    }
    if (normalized === 'IV THERAPIES') return 'Therapies';
    if (normalized === 'IV SHOTS') return 'Shots';
    return String(value || '')
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  const orderedCategories = ['HYDROGEN SESSION', 'IV THERAPIES', 'IV SHOTS'];
  const grouped = new Map();

  for (const category of orderedCategories) grouped.set(category, []);
  for (const service of state.services) {
    const category = String(service.category || '').toUpperCase();
    if (grouped.has(category)) grouped.get(category).push(service);
  }

  // Initialize state for tracking expanded categories
  if (!state.expandedServiceCategories) {
    state.expandedServiceCategories = {};
  }
  if (!state.serviceDetailSelections) {
    state.serviceDetailSelections = {};
  }
  for (const category of orderedCategories) {
    if ((grouped.get(category) || []).length && !Object.prototype.hasOwnProperty.call(state.expandedServiceCategories, category)) {
      state.expandedServiceCategories[category] = false;
    }
  }
  if (state.selectedServiceCategory) {
    for (const category of orderedCategories) {
      state.expandedServiceCategories[category] = category === state.selectedServiceCategory;
    }
  }

  // Display only the focused category while exploring, otherwise show all categories.
  const focusedCategory = String(state.selectedServiceCategory || '').trim().toUpperCase();
  for (const category of orderedCategories) {
    if (focusedCategory && category !== focusedCategory) continue;
    const services = grouped.get(category) || [];
    if (!services.length) continue;
    const visual = categoryVisuals[category] || {};
    const isExpanded = Boolean(state.expandedServiceCategories[category]);
    const categoryId = `service-category-details-${String(category).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const existingDetailSelection = state.serviceDetailSelections[category] || {};
    const selectedPlanName = services.some((service) => service.name === existingDetailSelection.selectedPlanName)
      ? existingDetailSelection.selectedPlanName
      : services[0]?.name || '';
    const ivTherapyOptions = grouped.get('IV THERAPIES') || [];
    const ivShotOptions = grouped.get('IV SHOTS') || [];
    const ivTherapyName = ivTherapyOptions.some((service) => service.name === existingDetailSelection.ivTherapyName)
      ? existingDetailSelection.ivTherapyName
      : '';
    const ivShotName = ivShotOptions.some((service) => service.name === existingDetailSelection.ivShotName)
      ? existingDetailSelection.ivShotName
      : '';
    state.serviceDetailSelections[category] = {
      ...existingDetailSelection,
      selectedPlanName,
      ivTherapyName,
      ivShotName,
    };

    const categoryCard = document.createElement('article');
    categoryCard.className = `service-category-card service-showcase-card${isExpanded ? ' is-expanded' : ''}`;
    categoryCard.dataset.category = category;

    const header = document.createElement('button');
    header.type = 'button';
    header.className = 'service-category-header service-showcase-button';
    header.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
    header.setAttribute('aria-controls', categoryId);
    header.setAttribute('aria-label', `${isExpanded ? 'Show less' : 'Explore'} ${visual.title || formatCategoryLabel(category)}`);
    header.innerHTML = `
      <span class="service-showcase-media">
        <img
          class="service-showcase-image"
          src="${escapeHtml(visual.image || '/booking/assets/service-experience.jpg')}"
          alt="${escapeHtml(visual.imageAlt || `${formatCategoryLabel(category)} service`)}"
          loading="lazy"
        />
      </span>
      <span class="service-showcase-content">
        <h3 class="service-showcase-title">${escapeHtml(visual.title || formatCategoryLabel(category))}</h3>
        <p class="service-showcase-subtitle">${escapeHtml(visual.subtitle || 'Choose and book your hydrogen session.')}</p>
        <span class="service-showcase-footer">
          <span class="service-showcase-cta">${isExpanded ? 'Show less' : 'Explore'}</span>
          <span class="service-showcase-count">${services.length} service${services.length === 1 ? '' : 's'}</span>
        </span>
      </span>
    `;

    header.addEventListener('click', () => {
      const isCurrentlyExpanded = Boolean(state.expandedServiceCategories[category]);
      if (isCurrentlyExpanded) {
        state.expandedServiceCategories[category] = false;
        state.selectedServiceCategory = null;
      } else {
        const nextExpandedState = {};
        for (const item of orderedCategories) {
          nextExpandedState[item] = false;
        }
        nextExpandedState[category] = true;
        state.expandedServiceCategories = {
          ...state.expandedServiceCategories,
          ...nextExpandedState,
        };
        state.selectedServiceCategory = category;
      }
      renderServices();
    });

    categoryCard.appendChild(header);

    const detailsContainer = document.createElement('div');
    detailsContainer.className = 'service-category-details service-detail-page';
    detailsContainer.id = categoryId;
    detailsContainer.dataset.category = category;
    detailsContainer.hidden = !isExpanded;

    const detailTopbar = document.createElement('div');
    detailTopbar.className = 'service-detail-topbar';
    detailTopbar.innerHTML = `
      <div class="service-detail-topbar-copy">
        <h3>${escapeHtml(visual.title || formatCategoryLabel(category))}</h3>
        <p>${services.length} service${services.length === 1 ? '' : 's'} available</p>
      </div>
    `;
    detailsContainer.appendChild(detailTopbar);

    if (category === 'HYDROGEN SESSION') {
      renderHydrogenUnifiedComposer({
        detailsContainer,
        services,
        category,
        ivTherapyOptions,
        ivShotOptions,
      });
      categoryCard.appendChild(detailsContainer);
      elements.serviceGrid.appendChild(categoryCard);
      continue;
    }

    if (category === 'IV THERAPIES' || category === 'IV SHOTS') {
      renderIvUnifiedComposer({
        detailsContainer,
        services,
        category,
      });
      categoryCard.appendChild(detailsContainer);
      elements.serviceGrid.appendChild(categoryCard);
      continue;
    }

    const plansWrap = document.createElement('div');
    plansWrap.className = 'service-plan-list';
    for (const service of services) {
      const serviceCard = createServiceDetailItem(service, {
        category,
        selectedPlanName: state.serviceDetailSelections[category].selectedPlanName,
      });
      plansWrap.appendChild(serviceCard);
    }
    if (isExpanded) {
      const collapseWrap = document.createElement('div');
      collapseWrap.className = 'service-showcase-collapse-wrap';
      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'btn btn-secondary service-showcase-collapse-btn';
      collapseBtn.textContent = 'Show less';
      collapseBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.expandedServiceCategories[category] = false;
        renderServices();
      });
      collapseWrap.appendChild(collapseBtn);
      detailsContainer.appendChild(collapseWrap);
    }
    categoryCard.appendChild(detailsContainer);

    elements.serviceGrid.appendChild(categoryCard);
  }
}

function createServiceDetailItem(service, options = {}) {
  const { category = '', selectedPlanName = '' } = options;
  const card = document.createElement('article');
  card.className = 'service-detail-item service-plan-card';
  if (String(service.name || '') === String(selectedPlanName || '')) {
    card.classList.add('is-selected');
  }

  const effectivePrice = Number(service.effectivePriceInr ?? service.priceInr ?? 0);
  const hasMemberAccess = isCurrentUserMembershipActive();
  const isMembershipOnly = Boolean(service.membershipOnly);

  const infoSection = document.createElement('div');
  infoSection.className = 'service-item-info';
  infoSection.innerHTML = `
    <h4>${escapeHtml(service.name)}</h4>
    ${service.description ? `<p class="service-description">${escapeHtml(service.description)}</p>` : ''}
  `;

  const priceSection = document.createElement('div');
  priceSection.className = 'service-item-pricing';
  
  const priceDisplay = document.createElement('span');
  priceDisplay.className = 'service-price';
  if (isMembershipOnly && !hasMemberAccess) {
    priceDisplay.textContent = 'Members Only';
  } else if (isMembershipOnly && hasMemberAccess) {
    priceDisplay.textContent = 'Included';
  } else {
    priceDisplay.textContent = `₹${effectivePrice.toLocaleString('en-IN')}`;
  }
  priceSection.appendChild(priceDisplay);

  // Show session count for multi-session services
  const sessionCount = getHydrogenSessionCountFromServiceName(service.name);
  if (sessionCount > 1) {
    const sessionBadge = document.createElement('span');
    sessionBadge.className = 'service-sessions';
    sessionBadge.textContent = `${sessionCount}×`;
    priceSection.appendChild(sessionBadge);
  }

  const buttonSection = document.createElement('div');
  buttonSection.className = 'service-item-actions';
  
  const bookButton = document.createElement('button');
  bookButton.type = 'button';
  bookButton.className = 'service-book-btn btn btn-primary';
  bookButton.textContent = 'Add to Cart';
  bookButton.disabled = isMembershipOnly && !hasMemberAccess;
  bookButton.addEventListener('click', (event) => {
    event.stopPropagation();
    openDialog();
    elements.serviceName.value = service.name;
    elements.bookingDate.value = getTodayIsoDate();
    elements.bookingTime.value = SLOT_OPTIONS[0].value;
  });
  buttonSection.appendChild(bookButton);

  card.appendChild(infoSection);
  card.appendChild(priceSection);
  card.appendChild(buttonSection);

  if (category) {
    card.addEventListener('click', () => {
      const current = state.serviceDetailSelections[category] || {};
      state.serviceDetailSelections[category] = {
        ...current,
        selectedPlanName: service.name,
      };
      renderServices();
    });
  }

  return card;
}

function renderHydrogenUnifiedComposer({ detailsContainer, services, category, ivTherapyOptions, ivShotOptions }) {
  const isEditingHydrogenGroup = Boolean(state.hydrogenEditingGroupId);
  const allPlanOptions = getHydrogenPlanOptions(services);
  const topUpPreferredSessions = [1, 4, 8, 16, 30, 90];
  const inferTopUpSessionCount = (service) => {
    const rawName = String(service?.name || '').trim();
    const rawDescription = String(service?.description || '').trim();
    const combined = `${rawName} ${rawDescription}`.toLowerCase();
    const fromStandardParser = Number(getHydrogenSessionCountFromServiceName(rawName));
    if (Number.isFinite(fromStandardParser) && fromStandardParser > 0) return fromStandardParser;
    const exactMatch = combined.match(/\b(1|4|8|16|30|90)\b/);
    return exactMatch ? Number(exactMatch[1]) : 0;
  };
  const topUpPlanOptions = topUpPreferredSessions
    .map((targetSessions) => {
      const matchedService = services.find((service) => inferTopUpSessionCount(service) === targetSessions);
      return matchedService ? { sessions: targetSessions, service: matchedService } : null;
    })
    .filter(Boolean);
  const resolvedTopUpPlanOptions = topUpPlanOptions.length ? topUpPlanOptions : allPlanOptions;
  const isTopUpFlow = !isCurrentUserMembershipActive() || String(state.selectedHydrogenFlow || 'schedule') === 'topup';
  const planOptions = isTopUpFlow ? resolvedTopUpPlanOptions : allPlanOptions;
  if (!planOptions.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Hydrogen session plans are not configured.';
    detailsContainer.appendChild(empty);
    return;
  }

  const detailSelection = state.serviceDetailSelections[category] || {};
  const hydrogenSummary = getMembershipHydrogenSessionSummary();
  const singleSessionPlan = allPlanOptions.find((opt) => Number(opt.sessions || 0) === 1) || allPlanOptions[0];
  const serviceReportedRemainingSessions = Number(
    singleSessionPlan?.service?.membershipRemainingHydrogenSessions
  );
  const totalIncludedSessions = Math.max(
    0,
    Number(hydrogenSummary.totalSessions || HYDROGEN_FREE_SESSIONS_PER_USER || 16)
  );
  const remainingIncludedSessions = hydrogenSummary.active
    ? Number.isFinite(serviceReportedRemainingSessions)
      ? Math.max(0, serviceReportedRemainingSessions)
      : Math.max(0, Number(hydrogenSummary.remainingSessions || 0))
    : 0;
  const usedIncludedSessions = Math.max(0, Number(hydrogenSummary.usedSessions || 0));
  const nextIncludedSessionNumber = Math.min(totalIncludedSessions, usedIncludedSessions + 1);
  const membershipScheduleTrimActive = Boolean(hydrogenSummary.active && isCurrentUserMembershipActive());
  const scheduleMinSessionNumber = membershipScheduleTrimActive ? Math.max(1, nextIncludedSessionNumber) : 1;
  const maxMembershipSessionCount = Math.max(1, remainingIncludedSessions);
  const selectedMembershipSessionCount = isTopUpFlow
    ? 1
    : Math.min(
        maxMembershipSessionCount,
        Math.max(1, Number(detailSelection.selectedMembershipSessionCount || 1))
      );
  const scheduleWindowStart = !isTopUpFlow ? Number(scheduleMinSessionNumber || 1) : 1;
  const scheduleWindowEnd = !isTopUpFlow
    ? Math.max(scheduleWindowStart, scheduleWindowStart + selectedMembershipSessionCount - 1)
    : 1;

  if (!state.selectedHydrogenServiceName || !planOptions.some((opt) => opt.service.name === state.selectedHydrogenServiceName)) {
    const fromDetail = planOptions.find((opt) => opt.service.name === detailSelection.selectedPlanName);
    state.selectedHydrogenServiceName = isTopUpFlow
      ? fromDetail?.service?.name || planOptions[0].service.name
      : singleSessionPlan.service.name;
  }
  if (!isTopUpFlow) {
    state.selectedHydrogenServiceName = singleSessionPlan.service.name;
  }
  state.selectedHydrogenExtraSessions = 0;
  state.serviceDetailSelections[category] = {
    ...detailSelection,
    selectedPlanName: state.selectedHydrogenServiceName,
    ...(!isTopUpFlow ? { selectedMembershipSessionCount } : {}),
  };

  const selectedPlan = planOptions.find((opt) => opt.service.name === state.selectedHydrogenServiceName) || planOptions[0];
  const selectedService = selectedPlan.service;
  const requiredSlots = isTopUpFlow
    ? Math.max(1, Number(selectedPlan.sessions || 1))
    : Math.max(1, scheduleWindowEnd - scheduleWindowStart + 1);
  const normalizeConsecutiveHydrogenSlots = (anchorDate, anchorIndex = 0) => {
    const safeAnchorIndex = Math.min(Math.max(0, Number(anchorIndex || 0)), Math.max(0, requiredSlots - 1));
    const fallbackDate = state.selectedHydrogenSlots[safeAnchorIndex]?.bookingDate || state.selectedServiceDate || getTodayIsoDate();
    const selectedAnchorDate = String(anchorDate || fallbackDate || getTodayIsoDate()).trim();
    const startDate = addDaysToIsoDate(selectedAnchorDate, -safeAnchorIndex) || getTodayIsoDate();
    const nextSlots = [];
    for (let idx = 0; idx < requiredSlots; idx += 1) {
      nextSlots.push({
        bookingDate: addDaysToIsoDate(startDate, idx) || startDate,
        bookingTime: state.selectedHydrogenSlots[idx]?.bookingTime || SLOT_OPTIONS[0].value,
      });
    }
    state.selectedHydrogenSlots = nextSlots;
  };
  if (!isEditingHydrogenGroup && requiredSlots > 1) {
    const missingAnyDate =
      state.selectedHydrogenSlots.length < requiredSlots ||
      state.selectedHydrogenSlots.slice(0, requiredSlots).some((slot) => !slot?.bookingDate);
    const hasDifferentDates = new Set(
      state.selectedHydrogenSlots
        .slice(0, requiredSlots)
        .map((slot) => String(slot?.bookingDate || '').trim())
        .filter(Boolean)
    ).size > 1;
    if (!state.selectedHydrogenSlots.length || missingAnyDate || !hasDifferentDates) {
      normalizeConsecutiveHydrogenSlots(state.selectedHydrogenSlots[0]?.bookingDate || state.selectedServiceDate || getTodayIsoDate(), 0);
    }
  }
  const topUpBlockStarts = [];
  for (let start = 1; start <= requiredSlots; start += 4) {
    topUpBlockStarts.push(start);
  }
  const topUpSelectedBlockStart = isTopUpFlow
    ? topUpBlockStarts.includes(Number(detailSelection.selectedTopUpBlockStart))
      ? Number(detailSelection.selectedTopUpBlockStart)
      : 1
    : 1;
  const topUpVisibleStart = isTopUpFlow ? topUpSelectedBlockStart : 1;
  const topUpVisibleEnd = isTopUpFlow ? Math.min(requiredSlots, topUpVisibleStart + 3) : requiredSlots;
  if (state.selectedHydrogenSlots.length > requiredSlots) {
    state.selectedHydrogenSlots = state.selectedHydrogenSlots.slice(0, requiredSlots);
  }
  if (!Number.isInteger(state.selectedHydrogenAddOnSessionIndex) || state.selectedHydrogenAddOnSessionIndex < 0) {
    state.selectedHydrogenAddOnSessionIndex = 0;
  }
  if (state.selectedHydrogenAddOnSessionIndex >= requiredSlots) {
    state.selectedHydrogenAddOnSessionIndex = 0;
  }

  let ivTherapyName = ivTherapyOptions.some((service) => service.name === detailSelection.ivTherapyName)
    ? detailSelection.ivTherapyName
    : '';
  let ivShotName = ivShotOptions.some((service) => service.name === detailSelection.ivShotName) ? detailSelection.ivShotName : '';
  if (ivTherapyName && ivShotName) {
    ivShotName = '';
  }
  state.selectedHydrogenAddOnServiceName = ivTherapyName || ivShotName || '';
  state.serviceDetailSelections[category] = {
    ...(state.serviceDetailSelections[category] || {}),
    ivTherapyName,
    ivShotName,
  };

  const layout = document.createElement('div');
  layout.className = 'hydrogen-layout hydrogen-unified-layout';
  if (isTopUpFlow) {
    layout.id = 'hydrogen-topup-anchor';
  }

  const controls = document.createElement('aside');
  controls.className = 'hydrogen-sidebar hydrogen-unified-controls';
  const initiationNote = isCurrentUserMembershipActive() && !isTopUpFlow
    ? '<p class="service-flow-note">Your first hydrogen session is the initiation session and is included in membership.</p>'
    : '';
  controls.innerHTML = `
    <div class="hydrogen-plan-controls">
      <label>
        ${isTopUpFlow ? 'Choose Package' : 'Sessions to Schedule'}
        ${
          isTopUpFlow
            ? '<select class="hydrogen-plan-select"></select>'
            : `
              <div class="hydrogen-session-stepper" role="group" aria-label="Sessions to schedule">
                <button type="button" class="hydrogen-stepper-btn hydrogen-stepper-decrease" aria-label="Decrease sessions">-</button>
                <span class="hydrogen-stepper-value" aria-live="polite">${selectedMembershipSessionCount}</span>
                <button type="button" class="hydrogen-stepper-btn hydrogen-stepper-increase" aria-label="Increase sessions">+</button>
              </div>
              <p class="hydrogen-session-remaining">${remainingIncludedSessions} session${remainingIncludedSessions === 1 ? '' : 's'} remaining</p>
            `
        }
      </label>
    </div>
    ${initiationNote}
  `;

  const planSelect = controls.querySelector('.hydrogen-plan-select');
  if (isTopUpFlow) {
    const nonMemberPackageLabelBySessions = {
      1: '1 Session',
      4: '1 Week (4 Session)',
      8: '2 Week (8 Session)',
      16: '1 Months (16 Session)',
      30: '1 Month (30 Session)',
      90: '3 Month (90 Session)',
    };
    for (const optionData of planOptions) {
      const option = document.createElement('option');
      option.value = optionData.service.name;
      const sessionsCount = Number(optionData.sessions || 1);
      const isMember = hasHydrogenMemberPricingAccess(optionData.service);
      const packagePriceInr = Number(
        isMember
          ? optionData.service?.memberPriceInr ?? optionData.service?.effectivePriceInr ?? optionData.service?.priceInr
          : optionData.service?.nonMemberPriceInr ?? optionData.service?.effectivePriceInr ?? optionData.service?.priceInr
      );
      const safePriceInr = Number.isFinite(packagePriceInr)
        ? packagePriceInr
        : Number(
            optionData.service?.effectivePriceInr ??
              optionData.service?.priceInr ??
              0
          );
      const packageLabel = isMember
        ? `${sessionsCount} Session${sessionsCount === 1 ? '' : 's'}`
        : nonMemberPackageLabelBySessions[sessionsCount] || `${sessionsCount} Session${sessionsCount === 1 ? '' : 's'}`;
      option.textContent = `${packageLabel} - Rs. ${safePriceInr.toLocaleString('en-IN')}`;
      planSelect.appendChild(option);
    }
    planSelect.value = state.selectedHydrogenServiceName;
    planSelect.disabled = isEditingHydrogenGroup;
    planSelect.addEventListener('change', () => {
      state.selectedHydrogenServiceName = planSelect.value;
      state.serviceDetailSelections[category] = {
        ...(state.serviceDetailSelections[category] || {}),
        selectedPlanName: planSelect.value,
        selectedTopUpBlockStart: 1,
      };
      state.selectedHydrogenSlots = [];
      state.selectedHydrogenAddOnSessionIndex = 0;
      state.activeHydrogenSessionIndex = 0;
      state.activeHydrogenSessionDate = '';
      state.activeHydrogenSessionTime = '';
      clearHydrogenComposerNotice();
      renderServices();
    });
  } else {
    const decreaseBtn = controls.querySelector('.hydrogen-stepper-decrease');
    const increaseBtn = controls.querySelector('.hydrogen-stepper-increase');
    const canDecrease = selectedMembershipSessionCount > 1 && !isEditingHydrogenGroup;
    const canIncrease = selectedMembershipSessionCount < maxMembershipSessionCount && !isEditingHydrogenGroup;
    if (decreaseBtn) decreaseBtn.disabled = !canDecrease;
    if (increaseBtn) increaseBtn.disabled = !canIncrease;
    decreaseBtn?.addEventListener('click', () => {
      const nextCount = Math.max(1, selectedMembershipSessionCount - 1);
      state.serviceDetailSelections[category] = {
        ...(state.serviceDetailSelections[category] || {}),
        selectedPlanName: singleSessionPlan.service.name,
        selectedMembershipSessionCount: nextCount,
      };
      clearHydrogenComposerNotice();
      renderServices();
    });
    increaseBtn?.addEventListener('click', () => {
      const nextCount = Math.min(maxMembershipSessionCount, selectedMembershipSessionCount + 1);
      state.serviceDetailSelections[category] = {
        ...(state.serviceDetailSelections[category] || {}),
        selectedPlanName: singleSessionPlan.service.name,
        selectedMembershipSessionCount: nextCount,
      };
      clearHydrogenComposerNotice();
      renderServices();
    });
  }

  const addOnPanel = document.createElement('section');
  addOnPanel.className = 'hydrogen-addon-panel';
  addOnPanel.innerHTML = `
    <div class="hydrogen-addon-head">
      <strong>Add-ons</strong>
      <span>Optional. Choose Therapy / Shot.</span>
    </div>
    <div class="hydrogen-addon-grid hydrogen-addon-grid-unified">
      <label>
        Therapy
        <select class="hydrogen-addon-therapy-select">
          <option value="">None</option>
        </select>
      </label>
      <label>
        Shot
        <select class="hydrogen-addon-shot-select">
          <option value="">None</option>
        </select>
      </label>
    </div>
  `;

  const therapySelect = addOnPanel.querySelector('.hydrogen-addon-therapy-select');
  const shotSelect = addOnPanel.querySelector('.hydrogen-addon-shot-select');
  let addOnDateSelect = null;
  let addOnTimeSelect = null;
  let addOnSchedulePanel = null;
  let addOnScheduleHint = null;
  for (const therapy of ivTherapyOptions) {
    const option = document.createElement('option');
    option.value = therapy.name;
    option.textContent = therapy.name;
    therapySelect.appendChild(option);
  }
  for (const shot of ivShotOptions) {
    const option = document.createElement('option');
    option.value = shot.name;
    option.textContent = shot.name;
    shotSelect.appendChild(option);
  }
  therapySelect.value = ivTherapyName || '';
  shotSelect.value = ivShotName || '';

  therapySelect.addEventListener('change', () => {
    const selectedValue = therapySelect.value || '';
    if (selectedValue && state.selectedHydrogenSlots.length) {
      state.selectedHydrogenAddOnSessionIndex = Number(state.activeHydrogenSessionIndex || 0);
    }
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      ivTherapyName: selectedValue,
      ivShotName: selectedValue ? '' : shotSelect.value || '',
    };
    state.selectedHydrogenAddOnServiceName = selectedValue || shotSelect.value || '';
    if (selectedValue) shotSelect.value = '';
    refreshAddOnScheduleSelectors();
    renderServices();
  });
  shotSelect.addEventListener('change', () => {
    const selectedValue = shotSelect.value || '';
    if (selectedValue && state.selectedHydrogenSlots.length) {
      state.selectedHydrogenAddOnSessionIndex = Number(state.activeHydrogenSessionIndex || 0);
    }
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      ivTherapyName: selectedValue ? '' : therapySelect.value || '',
      ivShotName: selectedValue,
    };
    state.selectedHydrogenAddOnServiceName = selectedValue || therapySelect.value || '';
    if (selectedValue) therapySelect.value = '';
    refreshAddOnScheduleSelectors();
    renderServices();
  });

  const refreshAddOnScheduleSelectors = () => {
    const assignedSlots = state.selectedHydrogenSlots
      .slice(0, requiredSlots)
      .map((slot, idx) => ({
        index: idx,
        bookingDate: String(slot?.bookingDate || '').trim(),
        bookingTime: normalizeSlotStartTime(String(slot?.bookingTime || '').trim()),
      }))
      .filter((slot) => slot.bookingDate && slot.bookingTime);
    const selectedAddOnName = String(state.selectedHydrogenAddOnServiceName || '').trim();

    const priorDate = String(addOnDateSelect?.value || '').trim();
    const priorTime = normalizeSlotStartTime(String(addOnTimeSelect?.value || '').trim());
    const currentlyMapped = assignedSlots.find((slot) => slot.index === Number(state.selectedHydrogenAddOnSessionIndex || 0));

    const uniqueDates = [...new Set(assignedSlots.map((slot) => slot.bookingDate))];
    if (addOnDateSelect) {
      addOnDateSelect.min = getTodayIsoDate();
      addOnDateSelect.max = getMaxBookingIsoDate();
      const preferredDate =
        (priorDate && uniqueDates.includes(priorDate) && priorDate) ||
        currentlyMapped?.bookingDate ||
        uniqueDates[0] ||
        '';
      addOnDateSelect.value = preferredDate;
    }

    const selectedDate = String(addOnDateSelect?.value || '').trim();
    if (addOnTimeSelect) {
      addOnTimeSelect.innerHTML = '';
      let effectiveSelectedDate = selectedDate;
      let sameDateSlots = assignedSlots.filter((slot) => slot.bookingDate === effectiveSelectedDate);
      if (!sameDateSlots.length && uniqueDates.length) {
        effectiveSelectedDate = uniqueDates[0];
        if (addOnDateSelect) addOnDateSelect.value = effectiveSelectedDate;
        sameDateSlots = assignedSlots.filter((slot) => slot.bookingDate === effectiveSelectedDate);
      }
      if (!sameDateSlots.length) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = uniqueDates.length ? 'No slot for selected date' : 'Set hydrogen sessions first';
        addOnTimeSelect.appendChild(option);
      } else {
        const preferredForDate =
          currentlyMapped?.bookingDate === effectiveSelectedDate
            ? currentlyMapped?.bookingTime || ''
            : sameDateSlots[0]?.bookingTime || '';
        const selectedAddOnServiceName = String(state.selectedHydrogenAddOnServiceName || '').trim();
        if (selectedAddOnServiceName) {
          populateAvailableTimeOptions(
            addOnTimeSelect,
            selectedAddOnServiceName,
            effectiveSelectedDate,
            {
              bookingDate: effectiveSelectedDate,
              bookingTime: preferredForDate,
            },
            preferredForDate
          );
        } else {
          for (const slot of sameDateSlots) {
            const option = document.createElement('option');
            option.value = slot.bookingTime;
            option.textContent = formatBookingTimeLabel(slot.bookingTime);
            addOnTimeSelect.appendChild(option);
          }
        }
      }
      const preferredTime =
        currentlyMapped?.bookingTime ||
        (priorTime && sameDateSlots.some((slot) => slot.bookingTime === priorTime) && priorTime) ||
        String(addOnTimeSelect.value || '').trim() ||
        '';
      if ([...addOnTimeSelect.options].some((option) => option.value === preferredTime && !option.disabled)) {
        addOnTimeSelect.value = preferredTime;
      }
    }

    const mapped = assignedSlots.find(
      (slot) => slot.bookingDate === String(addOnDateSelect?.value || '').trim()
        && slot.bookingTime === normalizeSlotStartTime(String(addOnTimeSelect?.value || '').trim())
    );
    state.selectedHydrogenAddOnSessionIndex = mapped ? mapped.index : (assignedSlots[0]?.index || 0);

    const selectorsDisabled = !selectedAddOnName || !assignedSlots.length;
    if (addOnDateSelect) addOnDateSelect.disabled = selectorsDisabled;
    if (addOnTimeSelect) addOnTimeSelect.disabled = selectorsDisabled;
    if (addOnScheduleHint) {
      addOnScheduleHint.hidden = false;
      if (!selectedAddOnName) {
        addOnScheduleHint.textContent = 'Select Therapy / Shot to enable add-on scheduling.';
      } else if (!assignedSlots.length) {
        addOnScheduleHint.textContent = 'Set hydrogen session date and time first.';
      } else {
        addOnScheduleHint.textContent = 'Choose when the selected add-on should be scheduled.';
      }
    }
  };

  controls.appendChild(addOnPanel);
  layout.appendChild(controls);

  const schedulePanel = document.createElement('section');
  schedulePanel.className = 'hydrogen-main hydrogen-schedule-panel';
  schedulePanel.innerHTML = `
    <header class="hydrogen-schedule-head">
      <h4>Schedule</h4>
      <p>Set date and time for all selected hydrogen sessions.</p>
    </header>
  `;

  if (state.hydrogenComposerNotice?.message) {
    const notice = document.createElement('div');
    notice.className = `hydrogen-composer-notice ${state.hydrogenComposerNotice.type === 'error' ? 'is-error' : 'is-info'}`.trim();
    notice.textContent = state.hydrogenComposerNotice.message;
    schedulePanel.appendChild(notice);
  }

  const scheduleList = document.createElement('div');
  scheduleList.className = 'hydrogen-schedule-list';
  for (let idx = topUpVisibleStart - 1; idx < topUpVisibleEnd; idx += 1) {
    const storageIndex = isTopUpFlow ? idx : idx - (topUpVisibleStart - 1);
    const sessionDisplayNumber = isTopUpFlow ? idx + 1 : Number(scheduleWindowStart || 1) + storageIndex;
    const existing = state.selectedHydrogenSlots[storageIndex] || {};
    const bookingDate = String(existing.bookingDate || state.selectedServiceDate || getTodayIsoDate());
    const bookingTime = String(existing.bookingTime || SLOT_OPTIONS[0].value);
    state.selectedHydrogenSlots[storageIndex] = {
      bookingDate,
      bookingTime,
    };

    const row = document.createElement('article');
    row.className = 'hydrogen-schedule-row';
    row.innerHTML = `
      <h5>Hydrogen Session ${sessionDisplayNumber}</h5>
      <div class="hydrogen-schedule-grid">
        <label>
          Date
          <input class="hydrogen-schedule-date" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" value="${bookingDate}" />
        </label>
        <label>
          Time
          <select class="hydrogen-schedule-time"></select>
        </label>
      </div>
    `;

    const dateInput = row.querySelector('.hydrogen-schedule-date');
    const timeSelect = row.querySelector('.hydrogen-schedule-time');
    populateAvailableTimeOptions(
      timeSelect,
      selectedService.name,
      bookingDate,
      {
        bookingDate,
        bookingTime,
      },
      bookingTime
    );
    state.selectedHydrogenSlots[storageIndex].bookingTime = timeSelect.value || bookingTime || SLOT_OPTIONS[0].value;

    dateInput.addEventListener('change', () => {
      clearHydrogenComposerNotice();
      const nextDate = dateInput.value || getTodayIsoDate();
      state.activeHydrogenSessionIndex = storageIndex;
      if (state.selectedHydrogenAddOnServiceName) {
        state.selectedHydrogenAddOnSessionIndex = storageIndex;
      }
      state.selectedHydrogenSlots[storageIndex] = {
        ...(state.selectedHydrogenSlots[storageIndex] || {}),
        bookingDate: nextDate,
      };
      populateAvailableTimeOptions(
        timeSelect,
        selectedService.name,
        nextDate,
        {
          bookingDate: nextDate,
          bookingTime: state.selectedHydrogenSlots[storageIndex]?.bookingTime || '',
        },
        state.selectedHydrogenSlots[storageIndex]?.bookingTime || ''
      );
      state.selectedHydrogenSlots[storageIndex].bookingTime = timeSelect.value || SLOT_OPTIONS[0].value;
      refreshAddOnScheduleSelectors();
    });
    timeSelect.addEventListener('change', () => {
      clearHydrogenComposerNotice();
      state.activeHydrogenSessionIndex = storageIndex;
      if (state.selectedHydrogenAddOnServiceName) {
        state.selectedHydrogenAddOnSessionIndex = storageIndex;
      }
      state.selectedHydrogenSlots[storageIndex] = {
        ...(state.selectedHydrogenSlots[storageIndex] || {}),
        bookingDate: dateInput.value || getTodayIsoDate(),
        bookingTime: timeSelect.value || SLOT_OPTIONS[0].value,
      };
      refreshAddOnScheduleSelectors();
    });

    scheduleList.appendChild(row);
  }
  schedulePanel.appendChild(scheduleList);
  addOnSchedulePanel = document.createElement('section');
  addOnSchedulePanel.className = 'hydrogen-schedule-row';
  addOnSchedulePanel.innerHTML = `
    <h5>Add-on Schedule</h5>
    <div class="hydrogen-schedule-grid">
      <label>
        Add-on Date
        <input class="hydrogen-addon-date-select" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" />
      </label>
      <label>
        Add-on Time
        <select class="hydrogen-addon-time-select"></select>
      </label>
    </div>
    <p class="service-flow-note hydrogen-addon-schedule-hint"></p>
  `;
  addOnDateSelect = addOnSchedulePanel.querySelector('.hydrogen-addon-date-select');
  addOnTimeSelect = addOnSchedulePanel.querySelector('.hydrogen-addon-time-select');
  addOnScheduleHint = addOnSchedulePanel.querySelector('.hydrogen-addon-schedule-hint');
  addOnDateSelect?.addEventListener('change', () => {
    refreshAddOnScheduleSelectors();
  });
  addOnTimeSelect?.addEventListener('change', () => {
    const assignedSlots = state.selectedHydrogenSlots
      .slice(0, requiredSlots)
      .map((slot, idx) => ({
        index: idx,
        bookingDate: String(slot?.bookingDate || '').trim(),
        bookingTime: normalizeSlotStartTime(String(slot?.bookingTime || '').trim()),
      }))
      .filter((slot) => slot.bookingDate && slot.bookingTime);
    const mapped = assignedSlots.find(
      (slot) => slot.bookingDate === String(addOnDateSelect?.value || '').trim()
        && slot.bookingTime === normalizeSlotStartTime(String(addOnTimeSelect?.value || '').trim())
    );
    state.selectedHydrogenAddOnSessionIndex = mapped ? mapped.index : (assignedSlots[0]?.index || 0);
  });
  refreshAddOnScheduleSelectors();
  schedulePanel.appendChild(addOnSchedulePanel);

  if (isTopUpFlow && requiredSlots > 4) {
    const blockMeta = document.createElement('p');
    blockMeta.className = 'service-flow-note';
    blockMeta.textContent = `Showing sessions ${topUpVisibleStart}-${topUpVisibleEnd} of ${requiredSlots}.`;
    schedulePanel.appendChild(blockMeta);
  }

  const selectedServicePrice = Number(selectedService.effectivePriceInr ?? selectedService.priceInr ?? 0);
  const selectedServiceIsMembershipOnly = Boolean(selectedService.membershipOnly);
  const selectedServiceHasMemberAccess = isCurrentUserMembershipActive();
  const hydrogenSessionSummary = getMembershipHydrogenSessionSummary();
  const selectedAddOnService =
    [...(Array.isArray(ivTherapyOptions) ? ivTherapyOptions : []), ...(Array.isArray(ivShotOptions) ? ivShotOptions : [])].find(
      (service) => String(service?.name || '') === String(state.selectedHydrogenAddOnServiceName || '')
    ) || null;
  const selectedAddOnPriceInr = Number(selectedAddOnService?.effectivePriceInr ?? selectedAddOnService?.priceInr ?? 0);
  const includedSessionsRemaining = Number(
    selectedService?.membershipRemainingHydrogenSessions ?? hydrogenSessionSummary.remainingSessions ?? 0
  );
  const canScheduleWithoutCart =
    !isEditingHydrogenGroup &&
    hydrogenSessionSummary.active &&
    includedSessionsRemaining >= requiredSlots &&
    selectedAddOnPriceInr <= 0;
  const stickyPriceText =
    isTopUpFlow
      ? formatAmountWithGstLabel(selectedServicePrice + selectedAddOnPriceInr).replace('Rs.', '₹')
      : hydrogenSessionSummary.active && includedSessionsRemaining > 0
      ? `${includedSessionsRemaining} hydrogen session${includedSessionsRemaining === 1 ? '' : 's'} left in membership`
      : selectedServiceIsMembershipOnly
        ? selectedServiceHasMemberAccess
          ? 'Included in Membership'
          : 'Members only'
        : formatAmountWithGstLabel(selectedServicePrice + selectedAddOnPriceInr).replace('Rs.', '₹');
  const stickyPriceClass = /₹|Rs\./i.test(stickyPriceText) ? 'service-sticky-price' : '';

  const stickyWrap = document.createElement('div');
  stickyWrap.className = 'service-sticky-book';

  let priceBreakdownHtml = '';
  if (/₹|Rs\./i.test(stickyPriceText)) {
    priceBreakdownHtml = `<div class="sticky-price-breakdown">`;
    if (selectedServicePrice > 0) {
      priceBreakdownHtml += `<div class="breakdown-item"><span>${escapeHtml(selectedService.name)}</span><span>₹${selectedServicePrice.toLocaleString('en-IN')}</span></div>`;
    }
    if (selectedAddOnService && selectedAddOnPriceInr > 0) {
      priceBreakdownHtml += `<div class="breakdown-item"><span>${escapeHtml(selectedAddOnService.name)}</span><span>₹${selectedAddOnPriceInr.toLocaleString('en-IN')}</span></div>`;
    }
    const gstBreakdown = getGstBreakdownInr(selectedServicePrice + selectedAddOnPriceInr);
    if ((selectedServicePrice + selectedAddOnPriceInr) > 0) {
      priceBreakdownHtml += `<div class="breakdown-item"><span>GST ${GST_RATE_PERCENT}%</span><span>₹${gstBreakdown.gstAmountInr.toLocaleString('en-IN')}</span></div>`;
      priceBreakdownHtml += `<div class="breakdown-total"><span>Total</span><span>₹${gstBreakdown.totalAmountInr.toLocaleString('en-IN')}</span></div>`;
    }
    priceBreakdownHtml += `</div>`;
  }

  stickyWrap.innerHTML = `
    <div class="service-sticky-meta">
      <strong>${escapeHtml(selectedService.name)}</strong>
      ${priceBreakdownHtml || `<span class="${stickyPriceClass}">${escapeHtml(stickyPriceText)}</span>`}
    </div>
  `;
  const stickyButton = document.createElement('button');
  stickyButton.type = 'button';
  stickyButton.className = 'btn btn-primary service-sticky-book-btn';
  stickyButton.textContent = isEditingHydrogenGroup
    ? 'Apply Changes'
    : isTopUpFlow
      ? (isCurrentUserMembershipActive() ? 'Buy Additional' : 'Add to Cart')
      : 'Schedule';
  stickyButton.disabled = selectedServiceIsMembershipOnly && !selectedServiceHasMemberAccess;
  const submitHydrogenBooking = async ({ forceChargeable = false } = {}) => {
    try {
      const slots = state.selectedHydrogenSlots.slice(0, requiredSlots).map((slot) => ({
        bookingDate: slot?.bookingDate || getTodayIsoDate(),
        bookingTime: slot?.bookingTime || SLOT_OPTIONS[0].value,
      }));
      const packageSessions = Math.max(1, Number(getHydrogenSessionCountFromServiceName(selectedService.name) || 1));
      const computedExtraSessions = Math.max(0, requiredSlots - packageSessions);
      const addOnServiceName = state.selectedHydrogenAddOnServiceName || '';
      const addOnSessionIndex = addOnServiceName ? Math.max(0, Number(state.selectedHydrogenAddOnSessionIndex || 0)) : null;
      if (addOnServiceName) {
        const addOnSlot = slots?.[Number(addOnSessionIndex || 0)];
        if (addOnSlot && hasStandaloneIvOnDateClient(addOnSlot.bookingDate, state.hydrogenEditingGroupId)) {
          setHydrogenComposerNotice(
            'A separate Therapy/Shot is already booked on this date. Hydrogen packages with an add-on cannot be combined with separate Therapy/Shot bookings on the same day.',
            'error'
          );
          renderServices();
          return;
        }
      }

      if (isEditingHydrogenGroup) {
        await updateHydrogenPackBookings({
          bookingGroupId: state.hydrogenEditingGroupId,
          serviceName: selectedService.name,
          extraSessions: computedExtraSessions,
          slots,
          addOnServiceName,
          addOnSessionIndex,
        });
      } else {
        await saveHydrogenPackBookings({
          serviceName: selectedService.name,
          extraSessions: computedExtraSessions,
          slots,
          addOnServiceName,
          addOnSessionIndex,
          forceChargeable,
        });
      }
    } catch (error) {
      setHydrogenComposerNotice(error.message || `Unable to ${isEditingHydrogenGroup ? 'update' : 'save'} hydrogen booking.`, 'error');
      renderServices();
    }
  };
  stickyButton.addEventListener('click', () => {
    submitHydrogenBooking({ forceChargeable: isTopUpFlow });
  });
  const stickyActions = document.createElement('div');
  stickyActions.className = 'service-sticky-actions';
  stickyActions.appendChild(stickyButton);
  if (isTopUpFlow && requiredSlots > 4) {
    const prevTopUpBtn = document.createElement('button');
    prevTopUpBtn.type = 'button';
    prevTopUpBtn.className = 'btn btn-secondary service-sticky-book-btn';
    prevTopUpBtn.textContent = 'Previous 4';
    prevTopUpBtn.disabled = topUpVisibleStart <= 1 || isEditingHydrogenGroup;
    prevTopUpBtn.addEventListener('click', () => {
      const nextStart = Math.max(1, topUpVisibleStart - 4);
      state.serviceDetailSelections[category] = {
        ...(state.serviceDetailSelections[category] || {}),
        selectedTopUpBlockStart: nextStart,
      };
      renderServices();
    });
    stickyActions.appendChild(prevTopUpBtn);

    const nextTopUpBtn = document.createElement('button');
    nextTopUpBtn.type = 'button';
    nextTopUpBtn.className = 'btn btn-secondary service-sticky-book-btn';
    nextTopUpBtn.textContent = 'Next 4';
    nextTopUpBtn.disabled = topUpVisibleEnd >= requiredSlots || isEditingHydrogenGroup;
    nextTopUpBtn.addEventListener('click', () => {
      const nextStart = Math.min(requiredSlots, topUpVisibleStart + 4);
      state.serviceDetailSelections[category] = {
        ...(state.serviceDetailSelections[category] || {}),
        selectedTopUpBlockStart: nextStart,
      };
      renderServices();
    });
    stickyActions.appendChild(nextTopUpBtn);
  }
  stickyWrap.appendChild(stickyActions);
  schedulePanel.appendChild(stickyWrap);

  layout.appendChild(schedulePanel);
  detailsContainer.appendChild(layout);
}

function renderIvUnifiedComposer({ detailsContainer, services, category }) {
  const detailSelection = state.serviceDetailSelections[category] || {};
  const hydrogenAddOnServices = state.services.filter(
    (service) => String(service.category || '').toUpperCase() === 'HYDROGEN SESSION'
  );
  const selectedPlanName = services.some((service) => service.name === detailSelection.selectedPlanName)
    ? detailSelection.selectedPlanName
    : services[0]?.name || '';
  const selectedDate = String(detailSelection.bookingDate || getTodayIsoDate());
  const selectedTime = String(detailSelection.bookingTime || SLOT_OPTIONS[0].value);
  const selectedAddOnServiceName = hydrogenAddOnServices.some((service) => service.name === detailSelection.addOnServiceName)
    ? String(detailSelection.addOnServiceName || '').trim()
    : '';
  const selectedAddOnBookingDate = String(detailSelection.addOnBookingDate || selectedDate || getTodayIsoDate());
  const selectedAddOnBookingTime = String(detailSelection.addOnBookingTime || selectedTime || SLOT_OPTIONS[0].value);
  state.serviceDetailSelections[category] = {
    ...detailSelection,
    selectedPlanName,
    bookingDate: selectedDate,
    bookingTime: selectedTime,
    addOnServiceName: selectedAddOnServiceName,
    addOnBookingDate: selectedAddOnBookingDate,
    addOnBookingTime: selectedAddOnBookingTime,
  };

  const selectedService = services.find((service) => service.name === selectedPlanName) || services[0] || null;
  if (!selectedService) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No services configured for this category.';
    detailsContainer.appendChild(empty);
    return;
  }

  const selectedAddOnService =
    hydrogenAddOnServices.find((service) => service.name === selectedAddOnServiceName) || null;
  const selectedServicePrice = Number(selectedService.effectivePriceInr ?? selectedService.priceInr ?? 0);
  const selectedAddOnPrice = selectedAddOnService
    ? Number(selectedAddOnService.effectivePriceInr ?? selectedAddOnService.priceInr ?? 0)
    : 0;
  const isHydrogenAddOn = String(selectedAddOnService?.category || '').trim().toUpperCase() === 'HYDROGEN SESSION';
  const selectedServiceIsMembershipOnly = Boolean(selectedService.membershipOnly);
  const selectedServiceHasMemberAccess = isCurrentUserMembershipActive();
  const basePriceText = selectedServiceIsMembershipOnly
    ? selectedServiceHasMemberAccess
      ? 'Included in Membership'
      : 'Members only'
    : `₹${selectedServicePrice.toLocaleString('en-IN')}`;
  const totalPrice = selectedServicePrice + selectedAddOnPrice;

  const layout = document.createElement('div');
  layout.className = 'hydrogen-layout hydrogen-unified-layout iv-unified-layout';

  const controls = document.createElement('aside');
  controls.className = 'hydrogen-sidebar hydrogen-unified-controls iv-unified-controls';
  controls.innerHTML = `
    <div class="hydrogen-plan-controls">
      <label>
        ${escapeHtml(category === 'IV THERAPIES' ? 'Therapy Plan' : 'Shot Plan')}
        <select class="hydrogen-plan-select iv-plan-select"></select>
      </label>
    </div>
    <div class="iv-plan-summary"></div>
  `;

  const planSelect = controls.querySelector('.iv-plan-select');
  const summary = controls.querySelector('.iv-plan-summary');
  for (const service of services) {
    const option = document.createElement('option');
    option.value = service.name;
    option.textContent = service.name;
    planSelect.appendChild(option);
  }
  planSelect.value = selectedService.name;

  const refreshSummary = () => {
    if (!summary) return;
    const addOnHtml = selectedAddOnService
      ? `
        <div class="iv-plan-summary-addon">
          <strong>${escapeHtml(selectedAddOnService.name)}</strong>
          <span>₹${selectedAddOnPrice.toLocaleString('en-IN')}</span>
        </div>
      `
      : '';
    summary.innerHTML = `
      <strong>${escapeHtml(selectedService.name)}</strong>
      <span>${escapeHtml(basePriceText)}</span>
      ${addOnHtml}
      <div class="iv-plan-summary-total">
        <strong>Total</strong>
        <span>${selectedServiceIsMembershipOnly && !selectedServiceHasMemberAccess ? 'Members only' : `₹${totalPrice.toLocaleString('en-IN')}`}</span>
      </div>
    `;
  };
  refreshSummary();

  planSelect.addEventListener('change', () => {
    const nextName = planSelect.value;
    const nextSelection = state.serviceDetailSelections[category] || {};
    state.serviceDetailSelections[category] = {
      ...nextSelection,
      selectedPlanName: nextName,
      bookingDate: dateInput.value || getTodayIsoDate(),
      bookingTime: timeSelect.value || SLOT_OPTIONS[0].value,
      addOnServiceName: String(nextSelection.addOnServiceName || '').trim(),
      addOnBookingDate: addOnDateSelect?.value || nextSelection.addOnBookingDate || dateInput.value || getTodayIsoDate(),
      addOnBookingTime: addOnTimeSelect?.value || nextSelection.addOnBookingTime || timeSelect.value || SLOT_OPTIONS[0].value,
    };
    renderServices();
  });

  layout.appendChild(controls);

  const schedulePanel = document.createElement('section');
  schedulePanel.className = 'hydrogen-main hydrogen-schedule-panel iv-schedule-panel';
  schedulePanel.innerHTML = `
    <header class="hydrogen-schedule-head">
      <h4>Schedule</h4>
      <p>Select date and time for your chosen plan.</p>
    </header>
  `;

  const scheduleList = document.createElement('div');
  scheduleList.className = 'hydrogen-schedule-list';
  const row = document.createElement('article');
  row.className = 'hydrogen-schedule-row';
  row.innerHTML = `
    <h5>Session</h5>
    <div class="hydrogen-schedule-grid">
      <label>
        Date
        <input class="hydrogen-schedule-date" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" value="${selectedDate}" />
      </label>
      <label>
        Time
        <select class="hydrogen-schedule-time"></select>
      </label>
    </div>
  `;
  const dateInput = row.querySelector('.hydrogen-schedule-date');
  const timeSelect = row.querySelector('.hydrogen-schedule-time');
  populateAvailableTimeOptions(
    timeSelect,
    selectedService.name,
    selectedDate,
    {
      bookingDate: selectedDate,
      bookingTime: selectedTime,
    },
    selectedTime
  );
  state.serviceDetailSelections[category] = {
    ...(state.serviceDetailSelections[category] || {}),
    bookingDate: selectedDate,
    bookingTime: timeSelect.value || selectedTime || SLOT_OPTIONS[0].value,
  };

  dateInput.addEventListener('change', () => {
    const nextDate = dateInput.value || getTodayIsoDate();
    const selectedServiceName = state.serviceDetailSelections[category]?.selectedPlanName || selectedService.name;
    populateAvailableTimeOptions(
      timeSelect,
      selectedServiceName,
      nextDate,
      {
        bookingDate: nextDate,
        bookingTime: state.serviceDetailSelections[category]?.bookingTime || '',
      },
      state.serviceDetailSelections[category]?.bookingTime || ''
    );
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      bookingDate: nextDate,
      bookingTime: timeSelect.value || SLOT_OPTIONS[0].value,
    };
  });

  timeSelect.addEventListener('change', () => {
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      bookingDate: dateInput.value || getTodayIsoDate(),
      bookingTime: timeSelect.value || SLOT_OPTIONS[0].value,
    };
  });

  scheduleList.appendChild(row);
  schedulePanel.appendChild(scheduleList);

  const addOnPanel = document.createElement('section');
  addOnPanel.className = 'hydrogen-addon-panel iv-addon-panel';
  addOnPanel.innerHTML = `
    <div class="hydrogen-addon-head">
      <strong>Add-ons</strong>
      <span>Optional. Choose Hydrogen Session.</span>
    </div>
    <div class="hydrogen-addon-grid">
      <label>
        Hydrogen Session
        <select class="hydrogen-addon-select">
          <option value="">No add-on</option>
        </select>
      </label>
      <label class="hydrogen-addon-date-label">
        Add-on Date
        <input class="hydrogen-addon-date-select" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" />
      </label>
      <label class="hydrogen-addon-time-label">
        Add-on Time
        <select class="hydrogen-addon-time-select"></select>
      </label>
    </div>
    <div class="hydrogen-addon-hydrogen-schedule" hidden></div>
  `;

  const addOnSelect = addOnPanel.querySelector('.hydrogen-addon-select');
  const addOnDateSelect = addOnPanel.querySelector('.hydrogen-addon-date-select');
  const addOnTimeSelect = addOnPanel.querySelector('.hydrogen-addon-time-select');
  const addOnDateLabel = addOnPanel.querySelector('.hydrogen-addon-date-label');
  const addOnTimeLabel = addOnPanel.querySelector('.hydrogen-addon-time-label');
  const hydrogenScheduleWrap = addOnPanel.querySelector('.hydrogen-addon-hydrogen-schedule');

  for (const addOn of hydrogenAddOnServices) {
    const option = document.createElement('option');
    option.value = addOn.name;
    option.textContent = `${addOn.name} - Rs. ${Number(addOn.effectivePriceInr || addOn.priceInr || 0).toLocaleString('en-IN')}`;
    addOnSelect.appendChild(option);
  }
  addOnSelect.value = selectedAddOnServiceName;

  const getHydrogenAddOnSlots = () => {
    const storedSlots = Array.isArray(state.serviceDetailSelections[category]?.addOnHydrogenSlots)
      ? state.serviceDetailSelections[category].addOnHydrogenSlots
      : [];
    const sessionCount = Math.max(1, getHydrogenSessionCountFromServiceName(selectedAddOnService?.name || ''));
    const baseDate = String(
      state.serviceDetailSelections[category]?.addOnBookingDate ||
      state.serviceDetailSelections[category]?.bookingDate ||
      dateInput.value ||
      getTodayIsoDate()
    ).trim() || getTodayIsoDate();
    const baseTime = normalizeSlotStartTime(
      String(
        state.serviceDetailSelections[category]?.addOnBookingTime ||
        state.serviceDetailSelections[category]?.bookingTime ||
        timeSelect.value ||
        SLOT_OPTIONS[0].value
      ).trim()
    ) || SLOT_OPTIONS[0].value;
    return buildHydrogenAddOnSlots({
      sessionCount,
      baseDate,
      baseTime,
      existingSlots: storedSlots,
      keepExisting: Boolean(storedSlots.length),
    });
  };

  const renderHydrogenAddOnSchedule = () => {
    if (!hydrogenScheduleWrap) return;
    hydrogenScheduleWrap.innerHTML = '';
    if (!selectedAddOnService || !isHydrogenAddOn) {
      hydrogenScheduleWrap.hidden = true;
      return;
    }

    const sessionCount = Math.max(1, getHydrogenSessionCountFromServiceName(selectedAddOnService.name));
    const slots = getHydrogenAddOnSlots();
    const nextBaseDate = String(slots[0]?.bookingDate || dateInput.value || getTodayIsoDate()).trim() || getTodayIsoDate();
    const nextBaseTime = normalizeSlotStartTime(String(slots[0]?.bookingTime || timeSelect.value || '').trim()) || SLOT_OPTIONS[0].value;
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      addOnServiceName: selectedAddOnService.name,
      addOnHydrogenSlots: slots,
      addOnBookingDate: nextBaseDate,
      addOnBookingTime: nextBaseTime,
    };

    const head = document.createElement('div');
    head.className = 'hydrogen-addon-schedule-head';
    head.innerHTML = `
      <strong>Hydrogen Session Schedule</strong>
      <span>${sessionCount} session${sessionCount === 1 ? '' : 's'} will be booked on consecutive dates.</span>
    `;
    hydrogenScheduleWrap.appendChild(head);

    const list = document.createElement('div');
    list.className = 'hydrogen-addon-schedule-list';
    slots.forEach((slot, index) => {
      const row = document.createElement('article');
      row.className = 'hydrogen-addon-schedule-row';
      row.innerHTML = `
        <div class="hydrogen-addon-schedule-row-head">
          <strong>Hydrogen Session ${index + 1}</strong>
          <small>${index === 0 ? 'Edit the first date to shift the sequence.' : 'Auto-filled from Session 1'}</small>
        </div>
        <div class="hydrogen-addon-schedule-grid">
          <label>
            Date
            <input
              class="hydrogen-addon-session-date${index > 0 ? ' is-locked' : ''}"
              type="date"
              min="${getTodayIsoDate()}"
              max="${getMaxBookingIsoDate()}"
              value="${escapeHtml(slot.bookingDate || nextBaseDate)}"
              ${index > 0 ? 'disabled' : ''}
            />
          </label>
          <label>
            Time
            <select class="hydrogen-addon-session-time"></select>
          </label>
        </div>
      `;
      const sessionDateInput = row.querySelector('.hydrogen-addon-session-date');
      const sessionTimeSelect = row.querySelector('.hydrogen-addon-session-time');
      populateAvailableTimeOptions(
        sessionTimeSelect,
        selectedAddOnService.name,
        slot.bookingDate || nextBaseDate,
        null,
        slot.bookingTime || nextBaseTime
      );
      if (sessionTimeSelect && slot.bookingTime) {
        sessionTimeSelect.value = normalizeSlotStartTime(slot.bookingTime) || sessionTimeSelect.value;
      }

      if (index === 0 && sessionDateInput) {
        sessionDateInput.addEventListener('change', () => {
          const nextDate = String(sessionDateInput.value || '').trim() || getTodayIsoDate();
          const currentSlots = getHydrogenAddOnSlots();
          const nextSlots = buildHydrogenAddOnSlots({
            sessionCount,
            baseDate: nextDate,
            baseTime: String(sessionTimeSelect?.value || nextBaseTime || '').trim() || nextBaseTime,
            existingSlots: currentSlots,
          });
          state.serviceDetailSelections[category] = {
            ...(state.serviceDetailSelections[category] || {}),
            addOnServiceName: selectedAddOnService.name,
            addOnHydrogenSlots: nextSlots,
            addOnBookingDate: String(nextSlots[0]?.bookingDate || nextDate).trim() || nextDate,
            addOnBookingTime: normalizeSlotStartTime(String(nextSlots[0]?.bookingTime || sessionTimeSelect?.value || '').trim()) || nextBaseTime,
          };
          renderServices();
        });
      }

      sessionTimeSelect?.addEventListener('change', () => {
        const currentSlots = getHydrogenAddOnSlots();
        currentSlots[index] = {
          ...(currentSlots[index] || {}),
          bookingDate: String(sessionDateInput?.value || currentSlots[index]?.bookingDate || nextBaseDate).trim() || nextBaseDate,
          bookingTime: normalizeSlotStartTime(String(sessionTimeSelect.value || '').trim()) || nextBaseTime,
        };
        const nextSlots = buildHydrogenAddOnSlots({
          sessionCount,
          baseDate: String(currentSlots[0]?.bookingDate || nextBaseDate).trim() || nextBaseDate,
          baseTime: String(currentSlots[0]?.bookingTime || nextBaseTime).trim() || nextBaseTime,
          existingSlots: currentSlots,
          keepExisting: true,
        });
        state.serviceDetailSelections[category] = {
          ...(state.serviceDetailSelections[category] || {}),
          addOnServiceName: selectedAddOnService.name,
          addOnHydrogenSlots: nextSlots,
          addOnBookingDate: String(nextSlots[0]?.bookingDate || nextBaseDate).trim() || nextBaseDate,
          addOnBookingTime: String(nextSlots[0]?.bookingTime || nextBaseTime).trim() || nextBaseTime,
        };
        renderServices();
      });

      list.appendChild(row);
    });

    hydrogenScheduleWrap.appendChild(list);
    hydrogenScheduleWrap.hidden = false;
  };

  const populateAddOnTimeOptions = () => {
    if (!addOnTimeSelect || !selectedAddOnService || isHydrogenAddOn) return;
    const addOnDate = String(addOnDateSelect?.value || '').trim();
    const preferredTime = String(
      state.serviceDetailSelections[category]?.addOnBookingTime || selectedAddOnBookingTime || timeSelect.value || SLOT_OPTIONS[0].value
    ).trim();
    if (!addOnDate) {
      addOnTimeSelect.innerHTML = '<option value="">Select add-on date first</option>';
      return;
    }
    populateAvailableTimeOptions(
      addOnTimeSelect,
      selectedAddOnService.name,
      addOnDate,
      {
        bookingDate: addOnDate,
        bookingTime: preferredTime,
      },
      preferredTime
    );
    if (![...addOnTimeSelect.options].some((option) => option.value === preferredTime)) {
      addOnTimeSelect.value = addOnTimeSelect.options[0]?.value || '';
    }
  };

  const populateAddOnDateOptions = () => {
    if (!addOnDateSelect || isHydrogenAddOn) return;
    const dates = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    for (let i = 0; i <= BOOKING_WINDOW_DAYS; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      dates.push(iso);
    }
    addOnDateSelect.innerHTML = '';
    for (const dateValue of dates) {
      const option = document.createElement('option');
      option.value = dateValue;
      option.textContent = formatBookingDateLabel(dateValue);
      addOnDateSelect.appendChild(option);
    }
    const preferredDate = String(
      state.serviceDetailSelections[category]?.addOnBookingDate || selectedAddOnBookingDate || dateInput.value || getTodayIsoDate()
    ).trim();
    addOnDateSelect.value = dates.includes(preferredDate) ? preferredDate : dates[0] || '';
    populateAddOnTimeOptions();
  };

  const syncAddOnSelection = () => {
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      addOnServiceName: String(addOnSelect.value || '').trim(),
      addOnBookingDate: String(addOnDateSelect?.value || '').trim(),
      addOnBookingTime: String(addOnTimeSelect?.value || '').trim(),
      addOnHydrogenSlots: isHydrogenAddOn ? getHydrogenAddOnSlots() : [],
    };
    refreshSummary();
  };

  addOnSelect.addEventListener('change', () => {
    state.serviceDetailSelections[category] = {
      ...(state.serviceDetailSelections[category] || {}),
      addOnServiceName: String(addOnSelect.value || '').trim(),
      addOnBookingDate: String(addOnSelect.value ? addOnDateSelect?.value || dateInput.value || getTodayIsoDate() : '').trim(),
      addOnBookingTime: String(addOnSelect.value ? addOnTimeSelect?.value || timeSelect.value || SLOT_OPTIONS[0].value : '').trim(),
      addOnHydrogenSlots: [],
    };
    renderServices();
  });
  addOnDateSelect.addEventListener('change', () => {
    populateAddOnTimeOptions();
    syncAddOnSelection();
  });
  addOnTimeSelect.addEventListener('change', () => {
    syncAddOnSelection();
  });

  addOnDateLabel.hidden = !selectedAddOnService || isHydrogenAddOn;
  addOnTimeLabel.hidden = !selectedAddOnService || isHydrogenAddOn;
  if (hydrogenScheduleWrap) hydrogenScheduleWrap.hidden = !isHydrogenAddOn;
  if (selectedAddOnService && isHydrogenAddOn) {
    renderHydrogenAddOnSchedule();
  } else if (selectedAddOnService) {
    populateAddOnDateOptions();
  } else {
    addOnDateSelect.value = '';
    addOnTimeSelect.innerHTML = '<option value="">No add-on selected</option>';
    if (hydrogenScheduleWrap) {
      hydrogenScheduleWrap.innerHTML = '';
      hydrogenScheduleWrap.hidden = true;
    }
  }

  schedulePanel.appendChild(addOnPanel);

  const stickyPriceText = selectedServiceIsMembershipOnly
    ? selectedServiceHasMemberAccess
      ? 'Included in Membership'
      : 'Members only'
    : `₹${selectedServicePrice.toLocaleString('en-IN')}`;
  const stickyPriceClass = /₹|Rs\./i.test(stickyPriceText) ? 'service-sticky-price' : '';

  const editingBookingId = String(state.ivSelections?.[selectedService.name]?.editingBookingId || '').trim();
  const isEditingIvBooking = Boolean(editingBookingId);

  const stickyWrap = document.createElement('div');
  stickyWrap.className = 'service-sticky-book';
  stickyWrap.innerHTML = `
    <div class="service-sticky-meta">
      <strong>${escapeHtml(selectedService.name)}</strong>
      <span class="${stickyPriceClass}">${escapeHtml(stickyPriceText)}</span>
    </div>
  `;
  const stickyButton = document.createElement('button');
  stickyButton.type = 'button';
  stickyButton.className = 'btn btn-primary service-sticky-book-btn';
  stickyButton.textContent = isEditingIvBooking ? 'Apply Changes' : 'Add to Cart';
  stickyButton.disabled = selectedServiceIsMembershipOnly && !selectedServiceHasMemberAccess;
  stickyButton.addEventListener('click', async () => {
    try {
      const payload = {
        serviceName: selectedService.name,
        bookingDate: dateInput.value || getTodayIsoDate(),
        bookingTime: timeSelect.value || SLOT_OPTIONS[0].value,
        addOnServiceName: selectedAddOnService ? selectedAddOnService.name : '',
        addOnBookingDate: selectedAddOnService
          ? isHydrogenAddOn
            ? String(state.serviceDetailSelections[category]?.addOnHydrogenSlots?.[0]?.bookingDate || dateInput.value || getTodayIsoDate()).trim()
            : addOnDateSelect.value || dateInput.value || getTodayIsoDate()
          : '',
        addOnBookingTime: selectedAddOnService
          ? isHydrogenAddOn
            ? String(state.serviceDetailSelections[category]?.addOnHydrogenSlots?.[0]?.bookingTime || timeSelect.value || SLOT_OPTIONS[0].value).trim()
            : addOnTimeSelect.value || timeSelect.value || SLOT_OPTIONS[0].value
          : '',
        addOnHydrogenSlots: selectedAddOnService && isHydrogenAddOn ? getHydrogenAddOnSlots() : [],
      };
      if (isEditingIvBooking) {
        await updateIvUnifiedBooking({
          bookingId: editingBookingId,
          ...payload,
        });
      } else {
        await saveIvUnifiedBookingToCart(payload);
      }
    } catch (error) {
      showNotice({ title: 'Error', body: error.message || 'Unable to process this request.' });
    }
  });
  stickyWrap.appendChild(stickyButton);
  schedulePanel.appendChild(stickyWrap);

  layout.appendChild(schedulePanel);
  detailsContainer.appendChild(layout);
}

async function saveIvUnifiedBookingToCart({
  serviceName,
  bookingDate,
  bookingTime,
  addOnServiceName = '',
  addOnBookingDate = '',
  addOnBookingTime = '',
  addOnHydrogenSlots = [],
}) {
  const service = getServiceCatalogEntry(serviceName);
  if (!service) {
    showNotice({ title: 'Error', body: 'Selected service is not available.' });
    return;
  }
  const safeDate = String(bookingDate || '').trim();
  const safeTime = String(bookingTime || '').trim();
  if (!safeDate || !safeTime) {
    showNotice({ title: 'Notice', body: 'Set hydrogen session date and time first.' });
    return;
  }
  if (addOnServiceName && (!String(addOnBookingDate || '').trim() || !String(addOnBookingTime || '').trim())) {
    showNotice({ title: 'Notice', body: 'Set add-on date and time first.' });
    return;
  }

  if (service?.membershipOnly && !isCurrentUserMembershipActive()) {
    showNotice({ title: 'Members only', body: 'This service is available only for active members.' });
    return;
  }

  if (getBookingCategory(serviceName) === 'IV ADD-ON' && hasHydrogenPackageAddOnOnDateClient(safeDate)) {
    showNotice({
      title: 'Not allowed',
      body: 'A hydrogen package on this date already includes an add-on. Separate Therapy/Shot bookings are not allowed on the same day.',
    });
    return;
  }

  const cooldownConflict = findIvCooldownConflictClient(serviceName, safeDate);
  if (cooldownConflict) {
    showNotice({ title: 'Not available', body: getIvCooldownAlertMessage(cooldownConflict) });
    return;
  }

  const isAdmin = state.user?.role === 'admin';
  if (isAdmin && !isAdminCustomerFormReady()) {
    showNotice({ title: 'Notice', body: 'Enter customer name, email, and contact number first.' });
    return;
  }

  const result = await api(isAdmin ? '/api/admin/bookings' : '/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(isAdmin
        ? {
            customerName: state.adminCustomerForm.name,
            customerEmail: state.adminCustomerForm.email,
            customerPhone: state.adminCustomerForm.phone,
          }
        : {}),
      serviceName,
      bookingDate: safeDate,
      bookingTime: safeTime,
      addOnServiceName,
      addOnBookingDate,
      addOnBookingTime,
      addOnHydrogenSlots,
      notes: '',
    }),
  });

  await loadDashboardData();
  if (!isAdmin) {
    state.activeUserTab = 'cart';
    window.location.hash = '#cart';
  }
  render();
  if (!isAdmin) {
    requestAnimationFrame(() => {
      elements.userCartSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  if (isAdmin && result.paymentLinkUrl) {
    copyTextToClipboard(result.paymentLinkUrl);
    showNotice({
      title: 'Booking saved',
      body: ['Saved to All User Bookings.', '', `Payment Link: ${result.paymentLinkUrl}`, 'Payment link copied.'],
    });
    return;
  }

  const cartSummary = buildUserCartSummary(state.bookings || []);
  showNotice({
    title: 'Added to cart',
    body: `${serviceName} on ${formatDateTime(safeDate, safeTime)}\nCart items: ${Number(cartSummary.unitCount || 0)}`,
  });
}

async function updateIvUnifiedBooking({
  bookingId,
  serviceName,
  bookingDate,
  bookingTime,
  addOnServiceName = '',
  addOnBookingDate = '',
  addOnBookingTime = '',
  addOnHydrogenSlots = [],
}) {
  const service = getServiceCatalogEntry(serviceName);
  if (!service) {
    showNotice({ title: 'Error', body: 'Selected service is not available.' });
    return;
  }
  const safeDate = String(bookingDate || '').trim();
  const safeTime = String(bookingTime || '').trim();
  if (!safeDate || !safeTime) {
    showNotice({ title: 'Notice', body: 'Set date and time first.' });
    return;
  }
  if (addOnServiceName && (!String(addOnBookingDate || '').trim() || !String(addOnBookingTime || '').trim())) {
    showNotice({ title: 'Notice', body: 'Set add-on date and time first.' });
    return;
  }

  const cooldownConflict = findIvCooldownConflictClient(serviceName, safeDate, bookingId);
  if (cooldownConflict) {
    showNotice({ title: 'Not available', body: getIvCooldownAlertMessage(cooldownConflict) });
    return;
  }

  const result = await api(`/api/bookings/${encodeURIComponent(bookingId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      serviceName,
      bookingDate: safeDate,
      bookingTime: safeTime,
      addOnServiceName,
      addOnBookingDate,
      addOnBookingTime,
      addOnHydrogenSlots,
      notes: '',
    }),
  });

  state.singleSessionEditingBookingId = '';
  state.ivSelections[serviceName] = {
    ...(state.ivSelections[serviceName] || {}),
    editingBookingId: '',
  };

  await loadDashboardData();
  const returnTab = state.returnUserTabAfterEdit || 'bookings';
  state.returnUserTabAfterEdit = '';
  state.activeUserTab = returnTab;
  window.location.hash = `#${returnTab}`;
  render();
  requestAnimationFrame(() => {
    if (returnTab === 'bookings') {
      elements.userBookingsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
  showNotice({
    title: 'Booking updated',
    body: `${serviceName} rescheduled to ${formatDateTime(safeDate, safeTime)}`,
  });
}

function getHydrogenSessionCountFromServiceName(serviceName) {
  const raw = String(serviceName || '').trim();
  const normalized = raw.toLowerCase();
  if (normalized.includes('single')) return 1;

  // Prefer explicit session count mentions like "(4 Sessions)".
  let match = raw.match(/\((\d+)\s*session/i);
  if (match) return Number(match[1]);

  match = raw.match(/\b(\d+)\s*session/i);
  if (match) return Number(match[1]);

  // Fallback: ignore "H2" prefix and use first standalone number.
  const cleaned = normalized.replace(/\bh2\b/g, ' ');
  match = cleaned.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 1;
}

function getHydrogenPlanOptions(services) {
  section.innerHTML = `
    <header class="service-cluster-head">
      <div>
        <h3 class="service-section-title">${escapeHtml(selectedCategory)}</h3>
        <p class="service-section-copy">${selectedServices.length} option${selectedServices.length === 1 ? '' : 's'}</p>
      </div>
    </header>
  `;
  if (isMembershipServicesCategory && !isCurrentUserMembershipActive()) {
    const copy = section.querySelector('.service-section-copy');
    if (copy) {
      copy.textContent = 'Visible to all users. These services are free only if you joined as a member.';
    }
  }

  const backButton = document.createElement('button');
  backButton.type = 'button';
  backButton.className = 'btn btn-secondary service-back-btn';
  backButton.textContent = 'Back to categories';
  backButton.addEventListener('click', () => {
    state.selectedServiceCategory = null;
    state.adminServiceDetailsExpanded = {};
    resetHydrogenComposer();
    resetSingleSessionComposer();
    state.slotAvailability = {};
    state.slotCapacityByService = {};
    state.slotAvailabilityLoading = false;
    renderServices();
  });
  section.querySelector('.service-cluster-head').appendChild(backButton);

  if (!isHydrogenCategory) {
    resetHydrogenComposer({ keepCategory: true, keepFlow: true });
  }

  if (isHydrogenCategory) {
    const isEditingHydrogenGroup = Boolean(state.hydrogenEditingGroupId);
    const isAdmin = state.user?.role === 'admin';
    const planOptions = getHydrogenPlanOptions(selectedServices);
    if (!planOptions.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Hydrogen session plans are not configured.';
      section.appendChild(empty);
      elements.serviceGrid.appendChild(section);
      return;
    }

    if (!state.selectedHydrogenServiceName || !planOptions.some((opt) => opt.service.name === state.selectedHydrogenServiceName)) {
      state.selectedHydrogenServiceName = planOptions[0].service.name;
    }

    const selectedPlan = planOptions.find((opt) => opt.service.name === state.selectedHydrogenServiceName) || planOptions[0];
    const packageSessions = Number(selectedPlan.sessions || 1);
    const extraSessions = Math.max(0, Number(state.selectedHydrogenExtraSessions || 0));
    const requiredSlots = packageSessions + extraSessions;
    if (state.selectedHydrogenSlots.length > requiredSlots) {
      state.selectedHydrogenSlots = state.selectedHydrogenSlots.slice(0, requiredSlots);
    }

    const selectedService = selectedPlan.service;
    const memberPrice = Number(selectedService.memberPriceInr || 0);
    const nonMemberPrice = Number(selectedService.nonMemberPriceInr || 0);
    const singleSession = selectedServices.find((service) => getHydrogenSessionCountFromServiceName(service.name) === 1) || selectedService;
    const extraSessionPrice = Number(singleSession.effectivePriceInr || singleSession.memberPriceInr || singleSession.nonMemberPriceInr || 0);
    const addOnServices = isAdmin
      ? []
      : state.services.filter((service) => {
          const category = String(service.category || '').toUpperCase();
          return category === 'IV THERAPIES' || category === 'IV SHOTS';
        });
    if (!addOnServices.some((service) => service.name === state.selectedHydrogenAddOnServiceName)) {
      state.selectedHydrogenAddOnServiceName = '';
    }
    if (!Number.isInteger(state.selectedHydrogenAddOnSessionIndex) || state.selectedHydrogenAddOnSessionIndex < 0) {
      state.selectedHydrogenAddOnSessionIndex = 0;
    }
    if (state.selectedHydrogenAddOnSessionIndex >= requiredSlots) {
      state.selectedHydrogenAddOnSessionIndex = 0;
    }
    const selectedAddOnService = addOnServices.find((service) => service.name === state.selectedHydrogenAddOnServiceName) || null;
    const selectedAddOnPriceInr = Number(selectedAddOnService?.effectivePriceInr || selectedAddOnService?.priceInr || 0);
    const consolidatedAmount = Number(selectedService.effectivePriceInr || 0) + extraSessions * extraSessionPrice + selectedAddOnPriceInr;

    const layout = document.createElement('div');
    layout.className = 'hydrogen-layout';
    layout.dataset.hydrogenEditor = 'true';

    const sidebar = document.createElement('aside');
    sidebar.className = 'hydrogen-sidebar';
    const consultationBenefit = isCurrentUserMembershipActive()
      ? '<div class="hydrogen-benefit-tag">Free Consultation Hydrogen Session</div>'
      : '';
    sidebar.innerHTML = `
      <h4 class="hydrogen-sidebar-title">Hydrogen Therapy</h4>
      ${consultationBenefit}
      <div class="hydrogen-plan-controls">
        <label>
          Hydrogen Session Package
          <select class="hydrogen-plan-select"></select>
        </label>
        <label>
          Add Extra Hydrogen Sessions
          <input class="hydrogen-extra-input" type="number" min="0" step="1" value="${extraSessions}" />
        </label>
      </div>
    `;
    const planSelect = sidebar.querySelector('.hydrogen-plan-select');
    for (const opt of planOptions) {
      const option = document.createElement('option');
      option.value = opt.service.name;
      option.textContent = `${opt.sessions} Hydrogen Sessions`;
      planSelect.appendChild(option);
    }
    planSelect.value = state.selectedHydrogenServiceName;
    planSelect.disabled = isEditingHydrogenGroup;
    planSelect.addEventListener('change', () => {
      state.selectedHydrogenServiceName = planSelect.value;
      state.selectedHydrogenSlots = [];
      state.activeHydrogenSessionIndex = 0;
      state.activeHydrogenSessionDate = '';
      state.activeHydrogenSessionTime = '';
      renderServices();
    });
    const extraInput = sidebar.querySelector('.hydrogen-extra-input');
    extraInput.disabled = isEditingHydrogenGroup;
    extraInput.addEventListener('input', () => {
      const parsed = Math.max(0, Number(extraInput.value || 0));
      state.selectedHydrogenExtraSessions = Number.isFinite(parsed) ? Math.floor(parsed) : 0;
      state.selectedHydrogenSlots = [];
      state.selectedHydrogenAddOnSessionIndex = 0;
      state.activeHydrogenSessionIndex = 0;
      state.activeHydrogenSessionDate = '';
      state.activeHydrogenSessionTime = '';
      renderServices();
    });
    const membershipSessionOffset = isCurrentUserMembershipActive() ? getHydrogenSessionsUsedThisMembership() : 0;
    let addOnSelect = null;
    let addOnDateSelect = null;
    let addOnTimeSelect = null;
    const assignedHydrogenSlots = state.selectedHydrogenSlots
      .slice(0, requiredSlots)
      .map((slot, idx) => ({
        index: idx,
        bookingDate: String(slot?.bookingDate || '').trim(),
        bookingTime: normalizeSlotStartTime(String(slot?.bookingTime || '').trim()),
      }))
      .filter((slot) => slot.bookingDate && slot.bookingTime);
    const assignedAddOnSlotByIndex = assignedHydrogenSlots.find(
      (slot) => slot.index === Number(state.selectedHydrogenAddOnSessionIndex || 0)
    );
    let selectedAddOnDate = assignedAddOnSlotByIndex?.bookingDate || assignedHydrogenSlots[0]?.bookingDate || '';
    let selectedAddOnTime = assignedAddOnSlotByIndex?.bookingTime || '';
    if (!isAdmin) {
      addOnSelect = document.createElement('select');
      addOnSelect.className = 'hydrogen-addon-select';
      const noAddOnOption = document.createElement('option');
      noAddOnOption.value = '';
      noAddOnOption.textContent = 'No add-on';
      addOnSelect.appendChild(noAddOnOption);
      for (const addOn of addOnServices) {
        const option = document.createElement('option');
        option.value = addOn.name;
        option.textContent = `${addOn.name} - Rs. ${Number(addOn.effectivePriceInr || addOn.priceInr || 0).toLocaleString('en-IN')}`;
        addOnSelect.appendChild(option);
      }
      addOnSelect.value = state.selectedHydrogenAddOnServiceName;
      addOnSelect.addEventListener('change', () => {
        state.selectedHydrogenAddOnServiceName = addOnSelect.value;
        state.focusHydrogenAddOnScheduler = Boolean(addOnSelect.value);
        renderServices();
      });
      addOnDateSelect = document.createElement('select');
      addOnDateSelect.className = 'hydrogen-addon-date-select';
      addOnTimeSelect = document.createElement('select');
      addOnTimeSelect.className = 'hydrogen-addon-time-select';

      const syncAddOnSessionIndex = () => {
        const matchedSlot = assignedHydrogenSlots.find(
          (slot) => slot.bookingDate === selectedAddOnDate && slot.bookingTime === selectedAddOnTime
        );
        if (matchedSlot) {
          state.selectedHydrogenAddOnSessionIndex = matchedSlot.index;
          return;
        }
        if (assignedHydrogenSlots.length) {
          state.selectedHydrogenAddOnSessionIndex = assignedHydrogenSlots[0].index;
        } else {
          state.selectedHydrogenAddOnSessionIndex = 0;
        }
      };

      const populateAddOnTimeOptions = () => {
        if (!addOnTimeSelect) return;
        addOnTimeSelect.innerHTML = '';
        const matchingSlots = assignedHydrogenSlots.filter(
          (slot) => slot.bookingDate === selectedAddOnDate && !isBookingSlotInPast(slot.bookingDate, slot.bookingTime)
        );
        if (!matchingSlots.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'Select add-on date first';
          addOnTimeSelect.appendChild(option);
          addOnTimeSelect.value = '';
          selectedAddOnTime = '';
          syncAddOnSessionIndex();
          return;
        }
        for (const slot of matchingSlots) {
          const slotOption = SLOT_OPTIONS.find((opt) => opt.value === slot.bookingTime);
          const option = document.createElement('option');
          option.value = slot.bookingTime;
          option.textContent = slotOption?.label || slot.bookingTime;
          addOnTimeSelect.appendChild(option);
        }
        const hasSelectedTime = matchingSlots.some((slot) => slot.bookingTime === selectedAddOnTime);
        selectedAddOnTime = hasSelectedTime ? selectedAddOnTime : matchingSlots[0].bookingTime;
        addOnTimeSelect.value = selectedAddOnTime;
        syncAddOnSessionIndex();
      };

      const populateAddOnDateOptions = () => {
        if (!addOnDateSelect) return;
        addOnDateSelect.innerHTML = '';
        const uniqueDates = [
          ...new Set(
            assignedHydrogenSlots
              .map((slot) => slot.bookingDate)
              .filter((dateValue) => String(dateValue || '').trim() >= getTodayIsoDate())
          ),
        ];
        if (!uniqueDates.length) {
          const option = document.createElement('option');
          option.value = '';
          option.textContent = 'Set hydrogen sessions first';
          addOnDateSelect.appendChild(option);
          addOnDateSelect.value = '';
          selectedAddOnDate = '';
          populateAddOnTimeOptions();
          return;
        }
        for (const dateValue of uniqueDates) {
          const option = document.createElement('option');
          option.value = dateValue;
          option.textContent = formatBookingDateLabel(dateValue);
          addOnDateSelect.appendChild(option);
        }
        const preferredDateFromSession = assignedHydrogenSlots.find(
          (slot) => slot.index === Number(state.activeHydrogenSessionIndex || 0)
        )?.bookingDate;
        const hasSelectedDate = uniqueDates.includes(selectedAddOnDate);
        selectedAddOnDate = hasSelectedDate
          ? selectedAddOnDate
          : uniqueDates.includes(preferredDateFromSession)
            ? preferredDateFromSession
            : uniqueDates[0];
        addOnDateSelect.value = selectedAddOnDate;
        populateAddOnTimeOptions();
      };

      populateAddOnDateOptions();
      addOnDateSelect.disabled = !state.selectedHydrogenAddOnServiceName || !assignedHydrogenSlots.length;
      addOnTimeSelect.disabled = !state.selectedHydrogenAddOnServiceName || !assignedHydrogenSlots.length;
      addOnDateSelect.addEventListener('change', () => {
        selectedAddOnDate = String(addOnDateSelect.value || '').trim();
        populateAddOnTimeOptions();
      });
      addOnTimeSelect.addEventListener('change', () => {
        selectedAddOnTime = normalizeSlotStartTime(String(addOnTimeSelect.value || '').trim());
        syncAddOnSessionIndex();
      });
    } else {
      state.selectedHydrogenAddOnServiceName = '';
      state.selectedHydrogenAddOnSessionIndex = 0;
    }

    const sessionsList = document.createElement('div');
    sessionsList.className = 'hydrogen-session-list';
    if (state.activeHydrogenSessionIndex >= requiredSlots) {
      state.activeHydrogenSessionIndex = 0;
    }
    for (let idx = 0; idx < requiredSlots; idx += 1) {
      const sessionBtn = document.createElement('button');
      sessionBtn.type = 'button';
      const assigned = Boolean(state.selectedHydrogenSlots[idx]);
      sessionBtn.className = `hydrogen-session-item${idx === state.activeHydrogenSessionIndex ? ' is-active' : ''}${
        assigned ? ' is-assigned' : ''
      }`;
      sessionBtn.textContent = `Hydrogen Session ${membershipSessionOffset + idx + 1}${assigned ? ' (Done)' : ''}`;
      sessionBtn.addEventListener('click', () => {
        state.activeHydrogenSessionIndex = idx;
        state.activeHydrogenSessionDate = state.selectedHydrogenSlots[idx]?.bookingDate || getTodayIsoDate();
        state.activeHydrogenSessionTime = state.selectedHydrogenSlots[idx]?.bookingTime || SLOT_OPTIONS[0].value;
        refreshSelectedCategoryAvailability(state.activeHydrogenSessionDate);
      });
      sessionsList.appendChild(sessionBtn);
    }
    sidebar.appendChild(sessionsList);
    layout.appendChild(sidebar);

    const main = document.createElement('div');
    main.className = 'hydrogen-main';
    const assignedCount = state.selectedHydrogenSlots.slice(0, requiredSlots).filter(Boolean).length;
    const activeSlot = state.selectedHydrogenSlots[state.activeHydrogenSessionIndex] || null;
    const editorDate = state.activeHydrogenSessionDate || activeSlot?.bookingDate || getTodayIsoDate();
    const editorTime = state.activeHydrogenSessionTime || activeSlot?.bookingTime || SLOT_OPTIONS[0].value;
    state.activeHydrogenSessionDate = editorDate;
    state.activeHydrogenSessionTime = editorTime;
    if (state.selectedServiceDate !== editorDate) {
      state.selectedServiceDate = editorDate;
    }

    const card = document.createElement('article');
    card.className = 'doctor-card service-card';
    card.innerHTML = `
      <div class="service-card-head">
        <h3>${escapeHtml(getServiceDisplayName(selectedService))}</h3>
      </div>
    `;

    if (addOnSelect && addOnDateSelect && addOnTimeSelect) {
      const addOnPanel = document.createElement('div');
      addOnPanel.className = 'hydrogen-addon-panel';
      addOnPanel.innerHTML = `
        <div class="hydrogen-addon-head">
          <strong>Optional IV Add-on</strong>
          <span>Choose 1 Therapy or Shot with this hydrogen booking.</span>
        </div>
        <div class="hydrogen-addon-grid">
          <label>
            Add-on Service
          </label>
          <label>
            Add-on Date
          </label>
          <label>
            Add-on Time
          </label>
        </div>
      `;
      const addOnGrid = addOnPanel.querySelector('.hydrogen-addon-grid');
      addOnGrid.children[0].appendChild(addOnSelect);
      addOnGrid.children[1].appendChild(addOnDateSelect);
      addOnGrid.children[2].appendChild(addOnTimeSelect);
      const addOnNote = document.createElement('p');
      addOnNote.className = 'hydrogen-addon-note';
      addOnNote.textContent =
        'Only one add-on can be booked in a single time slot. If you would like to book more sessions, please contact or visit H2 House of Health.';
      addOnPanel.appendChild(addOnNote);
      sidebar.appendChild(addOnPanel);
      if (state.focusHydrogenAddOnScheduler && state.selectedHydrogenAddOnServiceName) {
        state.focusHydrogenAddOnScheduler = false;
        requestAnimationFrame(() => {
          addOnPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (!addOnDateSelect.disabled) {
            addOnDateSelect.focus();
          } else {
            addOnSelect.focus();
          }
        });
      }
    }

    const editor = document.createElement('div');
    editor.className = 'hydrogen-session-editor';
    editor.innerHTML = `
      <h4>Hydrogen Session ${membershipSessionOffset + state.activeHydrogenSessionIndex + 1}</h4>
      <div class="hydrogen-editor-grid">
        <label>
          Date
          <input class="hydrogen-editor-date" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" value="${editorDate}" />
        </label>
        <label>
          Time
          <select class="hydrogen-editor-time"></select>
        </label>
      </div>
    `;
    const timeSelect = editor.querySelector('.hydrogen-editor-time');
    populateAvailableTimeOptions(timeSelect, selectedService.name, editorDate, activeSlot, editorTime);
    state.activeHydrogenSessionTime = timeSelect.value || SLOT_OPTIONS[0].value;
    const dateInput = editor.querySelector('.hydrogen-editor-date');
    dateInput.addEventListener('change', () => {
      state.activeHydrogenSessionDate = dateInput.value || getTodayIsoDate();
      refreshSelectedCategoryAvailability(state.activeHydrogenSessionDate);
    });
    timeSelect.addEventListener('change', () => {
      state.activeHydrogenSessionTime = timeSelect.value || SLOT_OPTIONS[0].value;
    });

    const editorActions = document.createElement('div');
    editorActions.className = 'hydrogen-editor-actions';
    const saveSessionBtn = document.createElement('button');
    saveSessionBtn.type = 'button';
    saveSessionBtn.className = 'btn btn-secondary';
    saveSessionBtn.textContent = 'Set Hydrogen Session Date & Time';
    saveSessionBtn.addEventListener('click', () => {
      state.selectedHydrogenSlots[state.activeHydrogenSessionIndex] = {
        bookingDate: state.activeHydrogenSessionDate || getTodayIsoDate(),
        bookingTime: state.activeHydrogenSessionTime || SLOT_OPTIONS[0].value,
      };
      renderServices();
    });
    const clearSessionBtn = document.createElement('button');
    clearSessionBtn.type = 'button';
    clearSessionBtn.className = 'btn btn-secondary';
    clearSessionBtn.textContent = 'Clear Hydrogen Session';
    clearSessionBtn.addEventListener('click', () => {
      state.selectedHydrogenSlots[state.activeHydrogenSessionIndex] = undefined;
      renderServices();
    });
    editorActions.appendChild(saveSessionBtn);
    editorActions.appendChild(clearSessionBtn);
    editor.appendChild(editorActions);
    card.appendChild(editor);

    const selectedSummary = document.createElement('div');
    selectedSummary.className = 'hydrogen-selected-list';
    for (let idx = 0; idx < requiredSlots; idx += 1) {
      const slot = state.selectedHydrogenSlots[idx];
      const summaryItem = document.createElement('span');
      summaryItem.className = 'hydrogen-selected-item';
      const displaySessionNumber = membershipSessionOffset + idx + 1;
      summaryItem.textContent = slot
        ? `Session ${displaySessionNumber}: ${slot.bookingDate} ${slot.bookingTime}`
        : `Session ${displaySessionNumber}: Pending`;
      selectedSummary.appendChild(summaryItem);
    }
    if (selectedAddOnService) {
      const addOnSlot = state.selectedHydrogenSlots[state.selectedHydrogenAddOnSessionIndex] || null;
      const addOnSummary = document.createElement('span');
      addOnSummary.className = 'hydrogen-selected-item';
      addOnSummary.textContent = addOnSlot?.bookingDate && addOnSlot?.bookingTime
        ? `IV Add-on: ${selectedAddOnService.name} (${formatDateTime(addOnSlot.bookingDate, addOnSlot.bookingTime)})`
        : `IV Add-on: ${selectedAddOnService.name} (Hydrogen Session ${
            membershipSessionOffset + state.selectedHydrogenAddOnSessionIndex + 1
          })`;
      selectedSummary.appendChild(addOnSummary);
    }
    card.appendChild(selectedSummary);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent =
      assignedCount === requiredSlots
        ? isEditingHydrogenGroup
          ? 'Update Package'
          : 'Confirm Book'
        : `Set ${requiredSlots - assignedCount} more hydrogen session(s)`;
    saveBtn.disabled = assignedCount !== requiredSlots || requiredSlots <= 0;
    saveBtn.addEventListener('click', async () => {
      try {
        const submitSlots = getHydrogenSlotsForSubmit(requiredSlots);
        if (selectedAddOnService) {
          const addOnSlot = submitSlots[state.selectedHydrogenAddOnSessionIndex];
          if (addOnSlot && hasStandaloneIvOnDateClient(addOnSlot.bookingDate, state.hydrogenEditingGroupId)) {
            showNotice({
              title: 'Not allowed',
              body: 'A separate Therapy/Shot is already booked on this date. Hydrogen packages with an add-on cannot be combined with separate Therapy/Shot bookings on the same day.',
            });
            return;
          }
        }
        if (isEditingHydrogenGroup) {
          await updateHydrogenPackBookings({
            bookingGroupId: state.hydrogenEditingGroupId,
            serviceName: selectedService.name,
            extraSessions,
            slots: submitSlots,
            addOnServiceName: selectedAddOnService?.name || '',
            addOnSessionIndex: selectedAddOnService ? state.selectedHydrogenAddOnSessionIndex : null,
          });
        } else {
          await saveHydrogenPackBookings({
            serviceName: selectedService.name,
            extraSessions,
            slots: submitSlots,
            addOnServiceName: selectedAddOnService?.name || '',
            addOnSessionIndex: selectedAddOnService ? state.selectedHydrogenAddOnSessionIndex : null,
          });
        }
      } catch (error) {
        showNotice({
          title: 'Error',
          body: error.message || `Unable to ${isEditingHydrogenGroup ? 'update' : 'save'} hydrogen booking.`,
        });
      }
    });
    if (isEditingHydrogenGroup) {
      const cancelEditBtn = document.createElement('button');
      cancelEditBtn.type = 'button';
      cancelEditBtn.className = 'btn btn-secondary';
      cancelEditBtn.textContent = 'Cancel Package Edit';
      cancelEditBtn.addEventListener('click', () => {
        resetHydrogenComposer();
        render();
      });
      card.appendChild(cancelEditBtn);
    }
    card.appendChild(saveBtn);
    main.appendChild(card);
    layout.appendChild(main);
    section.appendChild(layout);
    elements.serviceGrid.appendChild(section);
    return;
  }

  if (isSingleSessionCategory) {
    if (
      !state.selectedSingleSessionServiceName ||
      !selectedServices.some((service) => service.name === state.selectedSingleSessionServiceName)
    ) {
      state.selectedSingleSessionServiceName = selectedServices[0]?.name || '';
    }

    const selectedService =
      selectedServices.find((service) => service.name === state.selectedSingleSessionServiceName) || selectedServices[0];
    if (!selectedService) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No services are configured in this category.';
      section.appendChild(empty);
      elements.serviceGrid.appendChild(section);
      return;
    }

    const effectivePrice = Number(selectedService.effectivePriceInr ?? selectedService.priceInr ?? 0);
    const isMembershipOnly = Boolean(selectedService.membershipOnly);
    const hasMemberAccess = isCurrentUserMembershipActive();
    const selection = state.ivSelections[selectedService.name] || {};
    const nextMembershipSessionNumber = isCurrentUserMembershipActive() ? getHydrogenSessionsUsedThisMembership() + 1 : 1;
    const singleSessionLabel = `Hydrogen Session ${nextMembershipSessionNumber}`;
    const activeSingleSessionEditId = String(state.singleSessionEditingBookingId || '').trim();
    const isEditingSingleSession =
      Boolean(activeSingleSessionEditId) && String(selection.editingBookingId || '').trim() === activeSingleSessionEditId;
    const editorDate = selection.editingDate || selection.bookingDate || getTodayIsoDate();
    const editorTime = selection.editingTime || selection.bookingTime || SLOT_OPTIONS[0].value;
    if (state.selectedServiceDate !== editorDate) {
      state.selectedServiceDate = editorDate;
    }

    const layout = document.createElement('div');
    layout.className = 'hydrogen-layout';

    const sidebar = document.createElement('aside');
    sidebar.className = 'hydrogen-sidebar';
    sidebar.innerHTML = `
      <h4 class="hydrogen-sidebar-title">${escapeHtml(selectedCategory)}</h4>
      <div class="hydrogen-plan-controls">
        <label>
          Choose Service
          <select class="hydrogen-plan-select single-session-service-select"></select>
        </label>
      </div>
    `;
    const serviceSelect = sidebar.querySelector('.single-session-service-select');
    for (const service of selectedServices) {
      const option = document.createElement('option');
      option.value = service.name;
      option.textContent = service.name;
      serviceSelect.appendChild(option);
    }
    serviceSelect.value = selectedService.name;
    serviceSelect.disabled = isEditingSingleSession;
    serviceSelect.addEventListener('change', () => {
      state.selectedSingleSessionServiceName = serviceSelect.value;
      const nextSelection = state.ivSelections[serviceSelect.value] || {};
      state.singleSessionEditingBookingId = String(nextSelection.editingBookingId || '');
      state.selectedServiceDate = nextSelection.editingDate || nextSelection.bookingDate || getTodayIsoDate();
      state.slotAvailability = {};
      state.slotCapacityByService = {};
      state.slotAvailabilityLoading = true;
      render();
      loadServiceAvailability();
    });

    const sessionsList = document.createElement('div');
    sessionsList.className = 'hydrogen-session-list';
    const sessionBtn = document.createElement('button');
    sessionBtn.type = 'button';
    sessionBtn.className = `hydrogen-session-item is-active${selection.bookingDate && selection.bookingTime ? ' is-assigned' : ''}`;
    sessionBtn.textContent = `${singleSessionLabel}${selection.bookingDate && selection.bookingTime ? ' âœ“' : ''}`;
    sessionsList.appendChild(sessionBtn);
    sidebar.appendChild(sessionsList);
    layout.appendChild(sidebar);

    const main = document.createElement('div');
    main.className = 'hydrogen-main';
    const card = document.createElement('article');
    card.className = 'doctor-card service-card';
    card.innerHTML = `
      <div class="service-card-head">
        <h3>${escapeHtml(getServiceDisplayName(selectedService))}</h3>
      </div>
      <div class="service-price-panel">
        <p class="service-price-line">
          <span class="price-label">Your Price</span>
          <strong>${isMembershipOnly ? (hasMemberAccess ? 'Included in Membership' : 'Free for Members Only') : `Rs. ${effectivePrice.toLocaleString('en-IN')}`}</strong>
        </p>
        ${isMembershipOnly && !hasMemberAccess ? '<p class="service-price-meta">Booking is only available for active members.</p>' : ''}
      </div>
    `;

    const editor = document.createElement('div');
    editor.className = 'hydrogen-session-editor';
    editor.innerHTML = `
      <h4>${singleSessionLabel}</h4>
      <div class="hydrogen-editor-grid">
        <label>
          Date
          <input class="hydrogen-editor-date" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" value="${editorDate}" />
        </label>
        <label>
          Time
          <select class="hydrogen-editor-time"></select>
        </label>
      </div>
    `;
    const ivDateInput = editor.querySelector('.hydrogen-editor-date');
    const ivTimeSelect = editor.querySelector('.hydrogen-editor-time');
    populateAvailableTimeOptions(
      ivTimeSelect,
      selectedService.name,
      editorDate,
      {
        bookingDate: selection.bookingDate || '',
        bookingTime: selection.bookingTime || '',
      },
      editorTime
    );
    state.ivSelections[selectedService.name] = {
      ...(state.ivSelections[selectedService.name] || {}),
      editingTime: ivTimeSelect.value || editorTime || SLOT_OPTIONS[0].value,
    };
    ivDateInput.addEventListener('change', () => {
      state.ivSelections[selectedService.name] = {
        ...(state.ivSelections[selectedService.name] || {}),
        editingDate: ivDateInput.value || getTodayIsoDate(),
      };
      refreshSelectedCategoryAvailability(ivDateInput.value || getTodayIsoDate());
    });
    ivTimeSelect.addEventListener('change', () => {
      state.ivSelections[selectedService.name] = {
        ...(state.ivSelections[selectedService.name] || {}),
        editingTime: ivTimeSelect.value || SLOT_OPTIONS[0].value,
      };
    });

    const editorActions = document.createElement('div');
    editorActions.className = 'hydrogen-editor-actions';
    const setSessionBtn = document.createElement('button');
    setSessionBtn.type = 'button';
    setSessionBtn.className = 'btn btn-secondary';
    setSessionBtn.textContent = 'Set Hydrogen Session Date & Time';
    setSessionBtn.addEventListener('click', () => {
      state.ivSelections[selectedService.name] = {
        editingDate: ivDateInput.value || getTodayIsoDate(),
        editingTime: ivTimeSelect.value || SLOT_OPTIONS[0].value,
        bookingDate: ivDateInput.value || getTodayIsoDate(),
        bookingTime: ivTimeSelect.value || SLOT_OPTIONS[0].value,
      };
      renderServices();
    });
    const clearSessionBtn = document.createElement('button');
    clearSessionBtn.type = 'button';
    clearSessionBtn.className = 'btn btn-secondary';
    clearSessionBtn.textContent = 'Clear Hydrogen Session';
    clearSessionBtn.addEventListener('click', () => {
      state.ivSelections[selectedService.name] = {
        editingDate: ivDateInput.value || getTodayIsoDate(),
        editingTime: ivTimeSelect.value || SLOT_OPTIONS[0].value,
        bookingDate: '',
        bookingTime: '',
      };
      renderServices();
    });
    editorActions.appendChild(setSessionBtn);
    editorActions.appendChild(clearSessionBtn);
    editor.appendChild(editorActions);
    card.appendChild(editor);

    const selectedSummary = document.createElement('div');
    selectedSummary.className = 'hydrogen-selected-list';
    const summaryItem = document.createElement('span');
    summaryItem.className = 'hydrogen-selected-item';
    summaryItem.textContent =
      selection.bookingDate && selection.bookingTime
        ? `Hydrogen Session: ${formatDateTime(selection.bookingDate, selection.bookingTime)}`
        : 'Hydrogen Session: Pending';
    selectedSummary.appendChild(summaryItem);
    card.appendChild(selectedSummary);

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn btn-primary';
    saveBtn.textContent =
      selection.bookingDate && selection.bookingTime
        ? isEditingSingleSession
          ? 'Apply Changes'
          : 'Confirm Book'
        : 'Set Hydrogen Session Date & Time';
    saveBtn.disabled = !(selection.bookingDate && selection.bookingTime);
    saveBtn.addEventListener('click', async () => {
      try {
        await saveSingleSessionServiceBooking(selectedService.name);
      } catch (error) {
        showNotice({ title: 'Error', body: error.message || 'Unable to save booking.' });
      }
    });
    card.appendChild(saveBtn);
    if (isEditingSingleSession) {
      const cancelEditBtn = document.createElement('button');
      cancelEditBtn.type = 'button';
      cancelEditBtn.className = 'btn btn-secondary';
      cancelEditBtn.textContent = 'Cancel Edit';
      cancelEditBtn.addEventListener('click', () => {
        resetSingleSessionComposer();
        render();
      });
      card.appendChild(cancelEditBtn);
    }
    main.appendChild(card);
    layout.appendChild(main);
    section.appendChild(layout);
    elements.serviceGrid.appendChild(section);
    return;
  }

  if (!isSingleSessionCategory) {
    const dateRow = document.createElement('div');
    dateRow.className = 'service-date-row';
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Select Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = state.selectedServiceDate || getTodayIsoDate();
    dateInput.min = getTodayIsoDate();
    dateInput.max = getMaxBookingIsoDate();
    dateInput.className = 'service-date-input';
    dateInput.addEventListener('change', () => {
      state.selectedServiceDate = dateInput.value || getTodayIsoDate();
      state.slotAvailability = {};
      state.slotAvailabilityLoading = true;
      state.slotAutoShiftedNotice = '';
      renderServices();
      loadServiceAvailability();
    });
    dateLabel.appendChild(dateInput);
    dateRow.appendChild(dateLabel);
    section.appendChild(dateRow);
  }

  const grid = document.createElement('div');
  grid.className = 'service-card-grid';
  for (const service of selectedServices) {
    const card = document.createElement('article');
    card.className = 'doctor-card service-card';
    const effectivePrice = Number(service.effectivePriceInr ?? service.priceInr ?? 0);
    const isMembershipOnly = Boolean(service.membershipOnly);
    const hasMemberAccess = isCurrentUserMembershipActive();
    const hasDualHydrogenPrices =
      String(service.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
      Number(service.memberPriceInr) > 0 &&
      Number(service.nonMemberPriceInr) > 0;
    const memberPriceText = Number(service.memberPriceInr).toLocaleString('en-IN');
    const nonMemberPriceText = Number(service.nonMemberPriceInr).toLocaleString('en-IN');

    card.innerHTML = `
      <div class="service-card-head">
        <h3>${escapeHtml(getServiceDisplayName(service))}</h3>
      </div>
      <div class="service-price-panel">
        <p class="service-price-line">
          <span class="price-label">Your Price</span>
          <strong>${isMembershipOnly ? (hasMemberAccess ? 'Included in Membership' : 'Free for Members Only') : `Rs. ${effectivePrice.toLocaleString('en-IN')}`}</strong>
        </p>
        ${
          hasDualHydrogenPrices
            ? `<p class="service-price-meta">Member: Rs. ${memberPriceText} | Non-member: Rs. ${nonMemberPriceText}</p>
               <div class="hydrogen-pricing-grid">
                 <span class="hydrogen-pricing-head">No. of Services</span>
                 <span class="hydrogen-pricing-head">Non Member</span>
                 <span class="hydrogen-pricing-head">Member</span>
                 <span>${escapeHtml(service.name)}</span>
                 <span>Rs. ${nonMemberPriceText}</span>
                 <span>Rs. ${memberPriceText}</span>
               </div>`
            : ''
        }
        ${isMembershipOnly && !hasMemberAccess ? '<p class="service-price-meta">Booking is only available for active members.</p>' : ''}
      </div>
    `;

    const slotsWrap = document.createElement('div');
    slotsWrap.className = 'service-slots-wrap';
    const slotsTitle = document.createElement('p');
    slotsTitle.className = 'service-slots-title';
    slotsTitle.textContent = state.slotAvailabilityLoading ? 'Loading slots...' : 'Available time slots';
    slotsWrap.appendChild(slotsTitle);
    if (state.slotAutoShiftedNotice) {
      const notice = document.createElement('p');
      notice.className = 'slot-auto-notice';
      notice.textContent = state.slotAutoShiftedNotice;
      slotsWrap.appendChild(notice);
    }

    const slotGrid = document.createElement('div');
    slotGrid.className = 'service-slot-grid';
    const serviceAvailability = state.slotAvailability[service.name] || {};
    const serviceHolds = state.slotHoldCounts[service.name] || {};
    for (const slot of SLOT_OPTIONS) {
      const booked = Number(serviceAvailability[slot.value] || 0);
      const holdCount = Number(serviceHolds[slot.value] || 0);
      const capacity = Number(state.slotCapacityByService[service.name] || 8);
      const isPastSlot = isBookingSlotInPast(state.selectedServiceDate, slot.value);
      if (isPastSlot) continue;
      const slotRow = document.createElement('div');
      slotRow.className = 'service-slot-row';
      const slotTime = document.createElement('span');
      slotTime.className = 'slot-time';
      slotTime.textContent = slot.label;
      const seatWrap = document.createElement('div');
      seatWrap.className = 'slot-seat-grid';
      for (let seatIndex = 0; seatIndex < capacity; seatIndex += 1) {
        const seatBooked = seatIndex < booked;
        const seatHold = !seatBooked && seatIndex < booked + holdCount;
        const seatBtn = document.createElement('button');
        seatBtn.type = 'button';
        seatBtn.className = `slot-seat-box${seatBooked ? ' is-booked' : seatHold ? ' is-hold' : ' is-available'}`;
        seatBtn.disabled = seatBooked || seatHold || isPastSlot || state.slotAvailabilityLoading;
        const holdMinutes = Number(state.bookingHoldMinutes || BOOKING_HOLD_MINUTES) || BOOKING_HOLD_MINUTES;
        seatBtn.title = seatBooked
          ? 'Booked'
          : seatHold
            ? `On hold (${holdMinutes} min)`
            : isPastSlot
              ? 'Unavailable'
              : `Add to cart ${slot.label}`;
        seatBtn.setAttribute(
          'aria-label',
          `${slot.label} seat ${seatIndex + 1} ${
            seatBooked ? 'booked' : seatHold ? 'on hold' : isPastSlot ? 'unavailable' : 'available'
          }`
        );
        seatBtn.addEventListener('click', () => {
          openDialog();
          elements.serviceName.value = service.name;
          if (state.selectedServiceDate) {
            elements.bookingDate.value = state.selectedServiceDate;
          }
          elements.bookingTime.value = slot.value;
        });
        seatWrap.appendChild(seatBtn);
      }
      const slotMetaWrap = document.createElement('div');
      slotMetaWrap.className = 'slot-meta-wrap';
      const slotMeta = document.createElement('span');
      slotMeta.className = 'slot-meta';
      slotMeta.textContent = `${booked}/${capacity}`;
      slotMetaWrap.appendChild(slotMeta);
      if (holdCount > 0) {
        const holdNote = document.createElement('span');
        holdNote.className = 'slot-hold-note';
        const holdMinutes = Number(state.bookingHoldMinutes || BOOKING_HOLD_MINUTES) || BOOKING_HOLD_MINUTES;
        holdNote.textContent = `On hold: ${holdCount} • try again in ${holdMinutes} min`;
        slotMetaWrap.appendChild(holdNote);
      }
      slotRow.appendChild(slotTime);
      slotRow.appendChild(seatWrap);
      slotRow.appendChild(slotMetaWrap);
      slotGrid.appendChild(slotRow);
    }
    slotsWrap.appendChild(slotGrid);
    card.appendChild(slotsWrap);
    grid.appendChild(card);
  }

  section.appendChild(grid);
  elements.serviceGrid.appendChild(section);
}

function getHydrogenSessionCountFromServiceName(serviceName) {
  const raw = String(serviceName || '').trim();
  const normalized = raw.toLowerCase();
  if (normalized.includes('single')) return 1;

  // Prefer explicit session count mentions like "(4 Sessions)".
  let match = raw.match(/\((\d+)\s*session/i);
  if (match) return Number(match[1]);

  match = raw.match(/\b(\d+)\s*session/i);
  if (match) return Number(match[1]);

  // Fallback: ignore "H2" prefix and use first standalone number.
  const cleaned = normalized.replace(/\bh2\b/g, ' ');
  match = cleaned.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 1;
}

function getHydrogenPlanOptions(services) {
  const preferredOrder = [1, 4, 8, 16, 32, 30, 90];
  const bySessions = new Map();
  for (const service of services) {
    bySessions.set(getHydrogenSessionCountFromServiceName(service.name), service);
  }
  const options = [];
  for (const sessions of preferredOrder) {
    const service = bySessions.get(sessions);
    if (service) options.push({ sessions, service });
  }
  return options;
}

function formatSessionLabel(sessions) {
  if (sessions === 1) return '1 Hydrogen Session';
  return `${sessions} Hydrogen Sessions`;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToIsoDate(dateKey, daysToAdd = 0) {
  const match = String(dateKey || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  date.setDate(date.getDate() + Number(daysToAdd || 0));
  return toLocalIsoDate(date);
}

function shiftAdminAllBookingDateFilters(daysToAdd = 0) {
  const currentStart = String(state.adminAllBookingDateFilters?.startDate || '').trim();
  const currentEnd = String(state.adminAllBookingDateFilters?.endDate || '').trim();
  const fallbackDate = getTodayIsoDate();
  const effectiveStart = currentStart || currentEnd || fallbackDate;
  const effectiveEnd = currentEnd || currentStart || effectiveStart;
  state.adminAllBookingDateFilters = {
    startDate: addDaysToIsoDate(effectiveStart, daysToAdd) || effectiveStart,
    endDate: addDaysToIsoDate(effectiveEnd, daysToAdd) || effectiveEnd,
  };
}

function isBookingSlotInPast(bookingDate, bookingTime) {
  const normalizedDate = String(bookingDate || '').trim();
  const normalizedTime = String(bookingTime || '').trim();
  if (!normalizedDate || !normalizedTime) return false;
  const dateMatch = normalizedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = normalizedTime.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return false;
  const year = Number(dateMatch[1]);
  const monthIndex = Number(dateMatch[2]) - 1;
  const day = Number(dateMatch[3]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const slotDateTime = new Date(year, monthIndex, day, hours, minutes, 0, 0);
  if (Number.isNaN(slotDateTime.getTime())) return false;
  return slotDateTime.getTime() <= Date.now();
}

function getBookingSlotStartTimestamp(bookingDate, bookingTime) {
  const normalizedDate = String(bookingDate || '').trim();
  const normalizedTime = normalizeSlotStartTime(String(bookingTime || '').trim());
  if (!normalizedDate || !normalizedTime) return Number.NaN;
  const dateMatch = normalizedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = normalizedTime.match(/^(\d{2}):(\d{2})$/);
  if (!dateMatch || !timeMatch) return Number.NaN;
  const slotDateTime = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    0,
    0
  );
  const timestamp = slotDateTime.getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function getUserScheduleLaterEligibility(booking, options = {}) {
  const status = String(booking?.status || '').trim().toLowerCase();
  const notesLower = String(booking?.notes || '').toLowerCase();
  const enforcePreviousUse = options?.enforcePreviousUse !== false;
  if (['completed', 'cancelled', 'schedule_later'].includes(status)) {
    return { allowed: false, message: 'This session is already completed, cancelled, or waiting to be scheduled.' };
  }
  if (!['booked', 'confirmed'].includes(status)) {
    return { allowed: false, message: 'Only booked sessions can be moved to Schedule Later.' };
  }
  if (
    enforcePreviousUse &&
    (notesLower.includes('moved to schedule later by user') || notesLower.includes('moved to schedule later by admin'))
  ) {
    return { allowed: false, message: 'Schedule Later was already used once for this session.' };
  }
  const slotStart = getBookingSlotStartTimestamp(booking?.bookingDate, booking?.bookingTime);
  if (!Number.isFinite(slotStart)) {
    return { allowed: false, message: 'This booking slot is invalid.' };
  }
  const cutoffMs = 12 * 60 * 60 * 1000;
  if (Date.now() > slotStart - cutoffMs) {
    return { allowed: false, message: 'Schedule Later can be used only up to 12 hours before slot start.' };
  }
  return { allowed: true, message: 'Can be scheduled later' };
}

function getMaxBookingIsoDate() {
  const now = new Date();
  now.setDate(now.getDate() + BOOKING_WINDOW_DAYS);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarMonthLabel(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function getCalendarDateKey(year, monthIndex, day) {
  const month = String(monthIndex + 1).padStart(2, '0');
  const dayValue = String(day).padStart(2, '0');
  return `${year}-${month}-${dayValue}`;
}

function buildBookingsByDate(bookings, year, monthIndex) {
  const map = new Map();
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`;
  for (const booking of bookings) {
    const rawDate = String(booking?.bookingDate || '').trim();
    if (!rawDate.startsWith(monthKey)) continue;
    const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) continue;
    if (!map.has(rawDate)) map.set(rawDate, []);
    map.get(rawDate).push(booking);
  }
  return map;
}

function hasUpcomingBookedSession(bookings = []) {
  return bookings.some((booking) => {
    const status = String(booking?.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || status === 'schedule_later') return false;
    return !isBookingSlotInPast(booking?.bookingDate, booking?.bookingTime);
  });
}

function renderMembershipCalendarDetails(dateKey, bookings) {
  if (!elements.membershipCalendarDetails) return;
  if (!dateKey) {
    elements.membershipCalendarDetails.textContent = 'Select a date to view hydrogen sessions.';
    return;
  }
  const label = formatBookingDateLabel(dateKey);
  if (!bookings.length) {
    elements.membershipCalendarDetails.innerHTML = `
      <div>${escapeHtml(label)}</div>
      <span>No hydrogen sessions booked.</span>
    `;
    return;
  }
  const lines = bookings
    .map(
      (booking) => {
        const derivedStatus = getDerivedBookingStatus(booking);
        return `
        <div class="membership-calendar-detail-item">
          <strong>${escapeHtml(booking.serviceName || 'Hydrogen Session')}</strong>
          <span>${escapeHtml(formatBookingTimeLabel(booking.bookingTime))} • ${escapeHtml(derivedStatus)}</span>
        </div>
      `;
      }
    )
    .join('');
  elements.membershipCalendarDetails.innerHTML = `
    <div>${escapeHtml(label)}</div>
    <div class="membership-calendar-detail-list">${lines}</div>
  `;
}

function renderMembershipCalendar(bookings) {
  if (!elements.membershipCalendarGrid || !elements.membershipCalendarMonth) return;
  const today = new Date();
  const year = today.getFullYear();
  const monthIndex = today.getMonth();
  elements.membershipCalendarMonth.textContent = getCalendarMonthLabel(today);

  const firstOfMonth = new Date(year, monthIndex, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const bookedByDate = buildBookingsByDate(bookings, year, monthIndex);
  const bookedDates = Array.from(bookedByDate.keys()).sort();
  const todayKey = getCalendarDateKey(year, monthIndex, today.getDate());
  if (!state.membershipCalendarSelectedDate || !state.membershipCalendarSelectedDate.startsWith(`${year}-`)) {
    state.membershipCalendarSelectedDate = bookedDates[0] || todayKey;
  }
  if (!state.membershipCalendarSelectedDate.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}-`)) {
    state.membershipCalendarSelectedDate = bookedDates[0] || todayKey;
  }

  elements.membershipCalendarGrid.innerHTML = '';
  const totalCells = 42;
  for (let index = 0; index < totalCells; index += 1) {
    const dayNumber = index - startDay + 1;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'membership-calendar-day';
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      cell.classList.add('is-outside');
      cell.disabled = true;
      cell.textContent = '';
    } else {
      const dateKey = getCalendarDateKey(year, monthIndex, dayNumber);
      cell.textContent = String(dayNumber);
      if (dateKey === todayKey) cell.classList.add('is-today');
      if (dateKey === state.membershipCalendarSelectedDate) cell.classList.add('is-selected');
      if (bookedByDate.has(dateKey)) cell.classList.add('is-booked');
      if (hasUpcomingBookedSession(bookedByDate.get(dateKey) || [])) cell.classList.add('is-upcoming-booked');
      cell.addEventListener('click', () => {
        state.membershipCalendarSelectedDate = dateKey;
        renderMembershipCalendar(bookings);
      });
    }
    elements.membershipCalendarGrid.appendChild(cell);
  }

  renderMembershipCalendarDetails(
    state.membershipCalendarSelectedDate,
    bookedByDate.get(state.membershipCalendarSelectedDate) || []
  );
}

function getMembershipDashboardMembers(currentPeopleCount = 0) {
  const roster = state.membershipRoster || {};
  const fallbackOrder =
    (Array.isArray(state.userMembershipOrders) ? state.userMembershipOrders : [])
      .filter((order) => String(order?.status || '').toLowerCase() === 'paid')
      .sort((a, b) =>
        `${String(b?.paidAt || b?.createdAt || '')}`.localeCompare(`${String(a?.paidAt || a?.createdAt || '')}`)
      )[0] || null;
  const fallbackMembers = Array.isArray(fallbackOrder?.memberDetails) ? fallbackOrder.memberDetails : [];
  const rosterMembers = Array.isArray(roster?.members) && roster.members.length
    ? roster.members
    : Array.isArray(roster) && roster.length
      ? roster
      : fallbackMembers;
  const userMember = {
    name: state.user?.name || '',
    place: '',
    email: state.user?.email || '',
    contactNumber: state.user?.mobile || '',
  };
  const normalizedMembers = (rosterMembers.length ? rosterMembers : [userMember])
    .map((member) => ({
      name: String(member?.name || '').trim(),
      place: String(member?.place || '').trim(),
      email: String(member?.email || '').trim(),
      contactNumber: String(member?.contactNumber || '').trim(),
    }))
    .filter((member) => member.name || member.place || member.email || member.contactNumber);
  const resolvedPeopleCount = Math.max(
    Number(currentPeopleCount || 0),
    Number(roster?.subscription?.peopleCount || 0),
    Number(roster?.totalCovered || 0),
    Number(fallbackOrder?.peopleCount || 0),
    normalizedMembers.length
  );

  return {
    members: normalizedMembers.slice(0, resolvedPeopleCount || normalizedMembers.length),
    totalCovered: resolvedPeopleCount,
  };
}

function renderMembership() {
  if (!elements.membershipPlans || !elements.membershipStatusText) return;
  if (state.user?.role !== 'user') return;

  if (elements.memberFlowLabel) {
    elements.memberFlowLabel.textContent =
      state.postLoginChoice === 'join-member'
        ? 'Join as member selected'
        : state.postLoginChoice === 'continue-member'
          ? 'Active membership will be used for member pricing in services.'
          : '';
  }

  const current = state.membership.current || {};
  const active = Boolean(state.membership.active);
  if (elements.membershipCardScheduleBtn) {
    elements.membershipCardScheduleBtn.textContent = active ? 'Schedule Hydrogen Session' : 'Book a Session';
  }
  const currentPeopleCount = Number(current.peopleCount || 0);
  const activePlan =
    (state.membership.plans || []).find((plan) => String(plan.id) === String(current.plan || '')) ||
    null;
  const activePlanName = activePlan?.name || current.plan || 'Membership';
  const effectiveExpiry = getEffectiveMembershipExpiryDate(current.startedAt, current.expiresAt);
  if (elements.membershipStatusText) {
    elements.membershipStatusText.textContent = active ? '' : 'No active membership';
    elements.membershipStatusText.hidden = active;
    elements.membershipStatusText.classList.toggle('is-alert', !active);
  }
  if (elements.membershipSectionTitle) {
    elements.membershipSectionTitle.hidden = !active;
  }

  if (elements.membershipBrowsePanel) {
    elements.membershipBrowsePanel.hidden = !state.membershipBrowseVisible;
  }

  if (elements.membershipDashboard) {
    elements.membershipDashboard.hidden = false;
    elements.membershipDashboard.classList.toggle('is-non-member', !active);
  }

  if (elements.membershipTakeMembershipBtn) {
    elements.membershipTakeMembershipBtn.hidden = active;
  }

  const firstName = formatDisplayName(state.user?.name || 'Member').split(/\s+/)[0] || 'Member';
  if (elements.membershipWelcomeName) {
    elements.membershipWelcomeName.textContent = `Welcome, ${firstName}`;
  }
  if (elements.membershipDashboardStatus) {
    elements.membershipDashboardStatus.textContent = active
      ? `${activePlanName}${effectiveExpiry ? ` • valid till ${formatDateAsDayMonthYear(effectiveExpiry)}` : ''}`
      : 'Non-member account • standard pricing and pay-per-visit access';
  }

  const allBookings = (state.bookings || []).filter(
    (booking) => String(booking.status || '').toLowerCase() !== 'cancelled' && !booking.holdExpired
  );
  const unifiedHydrogenTracking = getUnifiedHydrogenTrackingSummary(allBookings);
  const paidBookings = allBookings.filter(
    (booking) => String(booking.paymentStatus || '').toLowerCase() === 'paid'
  );
  const nonMemberPaidHydrogenSessions = paidBookings.filter(
    (booking) => getBookingCategory(booking.serviceName) === 'HYDROGEN SESSION'
  ).length;
  const nonMemberCompletedHydrogenSessions = allBookings.filter(
    (booking) =>
      getBookingCategory(booking.serviceName) === 'HYDROGEN SESSION' &&
      String(booking.status || '').toLowerCase() === 'completed' &&
      String(booking.paymentStatus || '').toLowerCase() === 'paid'
  ).length;
  const hydrogenSessionSummary = getMembershipHydrogenSessionSummary();
  if (elements.membershipStatSessions) {
    const sessions = active
      ? Number(hydrogenSessionSummary.totalSessions || 0)
      : unifiedHydrogenTracking.totalSessions;
    elements.membershipStatSessions.textContent = Number.isFinite(sessions) ? String(sessions) : '0';
  }
  if (elements.membershipStatSessionsLabel) {
    elements.membershipStatSessionsLabel.textContent = active ? 'Membership Sessions' : 'Hydrogen Sessions';
  }
  if (elements.membershipStatMembersCard) {
    elements.membershipStatMembersCard.hidden = false;
  }
  if (elements.membershipStatSessionsMeta) {
    elements.membershipStatSessionsMeta.textContent = active ? 'Included' : 'Included';
  }
  if (elements.membershipStatMembers) {
    elements.membershipStatMembers.textContent = active ? (currentPeopleCount ? String(currentPeopleCount) : '0') : '\u20B9 4,800';
  }
  if (elements.membershipStatMembersLabel) {
    elements.membershipStatMembersLabel.textContent = active ? 'Members' : 'Member Price';
  }
  if (elements.membershipStatMembersMeta) {
    elements.membershipStatMembersMeta.textContent = active
      ? 'Covered'
      : '/session\nJoin membership to unlock lower pricing and premium benefits';
  }
  if (elements.membershipStatMembersDetails) {
    elements.membershipStatMembersDetails.hidden = !active;
    elements.membershipStatMembersDetails.innerHTML = '';
    if (active) {
      const rosterPreview = getMembershipDashboardMembers(currentPeopleCount);
      if (rosterPreview.members.length) {
        rosterPreview.members.forEach((member, index) => {
          const person = document.createElement('div');
          person.className = 'membership-stat-member';
          const name = member.name || `Member ${index + 1}`;
          const detailParts = [member.place, member.contactNumber, member.email].filter(Boolean);
          person.innerHTML = `
            <span>${escapeHtml(name)}</span>
            <small>${escapeHtml(detailParts.join(' • ') || 'Details pending')}</small>
          `;
          elements.membershipStatMembersDetails.appendChild(person);
        });
      } else {
        const empty = document.createElement('div');
        empty.className = 'membership-stat-member is-empty';
        empty.textContent = 'Member details not added yet';
        elements.membershipStatMembersDetails.appendChild(empty);
      }
    }
  }
  if (elements.membershipStatValidCard) {
    elements.membershipStatValidCard.title = active
      ? 'View covered members'
      : 'View membership options';
  }
  if (elements.membershipStatValid) {
    elements.membershipStatValid.textContent = active ? (effectiveExpiry ? formatDateAsDayMonthYear(effectiveExpiry) : '-') : '\u20B9 9,500';
  }
  if (elements.membershipStatValidLabel) {
    elements.membershipStatValidLabel.textContent = active ? 'Valid Till' : 'Non-member Price';
  }
  if (elements.membershipStatValidMeta) {
    elements.membershipStatValidMeta.textContent = active ? 'Plan end' : '/ session';
  }

  const extraSessionsBought = active
    ? getHydrogenExtraSessionsThisMembership()
    : 0;
  const convertedNonMemberTopUpSessions = active
    ? getConvertedNonMemberTopUpSessionsThisMembership()
    : 0;
  const topUpCompletedSessions = active
    ? allBookings.filter(
        (booking) =>
          !booking.holdExpired &&
          String(booking.status || '').toLowerCase() === 'completed' &&
          String(booking.paymentStatus || '').toLowerCase() === 'paid' &&
          isChargeableHydrogenMembershipBooking(booking)
      ).length
    : 0;
  const topUpRemainingSessions = Math.max(0, extraSessionsBought - topUpCompletedSessions);
  const topUpUsagePercent = extraSessionsBought > 0 ? Math.min(100, Math.round((topUpCompletedSessions / extraSessionsBought) * 100)) : 0;
  if (elements.membershipStatExtraLabel) {
    elements.membershipStatExtraLabel.textContent = active ? 'Top Up Sessions' : 'Become a Member';
  }
  if (elements.membershipStatExtra) {
    elements.membershipStatExtra.textContent = active ? String(extraSessionsBought) : '\u2197';
  }
  if (elements.membershipStatExtraMeta) {
    elements.membershipStatExtraMeta.textContent = active ? 'Top Up' : 'Unlock benefits';
  }
  if (elements.membershipTopUpBadge) {
    elements.membershipTopUpBadge.hidden = !active;
  }
  const hydrogenSessions = unifiedHydrogenTracking.hydrogenBookings;
  const upcomingHydrogenBookings = hydrogenSessions
    .filter((booking) => !isBookingSlotInPast(booking.bookingDate, booking.bookingTime))
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
  const upcomingBookings = paidBookings
    .filter((booking) => !isBookingSlotInPast(booking.bookingDate, booking.bookingTime))
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
  const totalSessions = active
    ? Number(hydrogenSessionSummary.totalSessions || 0)
    : unifiedHydrogenTracking.totalSessions;
  const usedSessions = active
    ? Number(hydrogenSessionSummary.usedSessions || 0)
    : unifiedHydrogenTracking.completedSessions;
  const usageCompletedSessions = active
    ? Number(hydrogenSessionSummary.completedSessions || 0)
    : Number(unifiedHydrogenTracking.completedSessions || 0);
  const completedSessions = Number(unifiedHydrogenTracking.completedSessions || 0);
  const upcomingSessions = Number(unifiedHydrogenTracking.upcomingSessions || 0);
  const missedSessions = Number(unifiedHydrogenTracking.missedSessions || 0);
  const remainingSessions = active
    ? Number(hydrogenSessionSummary.remainingSessions || 0)
    : unifiedHydrogenTracking.remainingSessions;
  const usagePercent = active
    ? Number(hydrogenSessionSummary.usagePercent || 0)
    : unifiedHydrogenTracking.usagePercent;
  const safeUsagePercent = Number.isFinite(usagePercent) ? Math.max(0, Math.min(100, usagePercent)) : 0;

  if (elements.membershipUsageTitle) {
    elements.membershipUsageTitle.textContent = active ? 'Hydrogen Session Usage' : 'Booking Activity';
  }
  if (elements.membershipUsageSessionHead) {
    elements.membershipUsageSessionHead.textContent = active ? 'Membership Sessions' : 'Sessions';
  }
  if (elements.membershipUsageLabel) {
    elements.membershipUsageLabel.textContent = totalSessions
      ? `${usageCompletedSessions} of ${totalSessions} completed`
      : '0 of 0 completed';
  }
  if (elements.membershipUsageCount) {
    elements.membershipUsageCount.textContent = `${usageCompletedSessions} of ${totalSessions}`;
  }
  const renderUsageBlocks = (containerId, activeCount, totalCount) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = Math.max(0, Number(totalCount || 0));
    const activeTotal = Math.max(0, Math.min(total, Number(activeCount || 0)));
    container.innerHTML = '';
    for (let i = 0; i < total; i += 1) {
      const block = document.createElement('span');
      block.className = i < activeTotal ? 'usage-v2-block is-active' : 'usage-v2-block';
      container.appendChild(block);
    }
  };

  const renderMiniBlocks = (containerId, activeCount, totalCount) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const total = Math.max(0, Number(totalCount || 0));
    const activeTotal = Math.max(0, Math.min(total, Number(activeCount || 0)));
    container.innerHTML = '';
    for (let i = 0; i < total; i += 1) {
      const block = document.createElement('span');
      block.className = i < activeTotal ? 'usage-v2-mini-block is-active' : 'usage-v2-mini-block';
      container.appendChild(block);
    }
  };
  const nonCancelledBookings = allBookings.filter((booking) => String(booking.status || '').toLowerCase() !== 'cancelled');
  const completedBookings = nonCancelledBookings.filter((booking) => String(booking.status || '').toLowerCase() === 'completed');
  const isTherapyBooking = (booking) => String(getServiceCatalogEntry(booking?.serviceName || '')?.category || '').toUpperCase() === 'IV THERAPIES';
  const isShotBooking = (booking) => String(getServiceCatalogEntry(booking?.serviceName || '')?.category || '').toUpperCase() === 'IV SHOTS';
  const therapyTotal = nonCancelledBookings.filter(isTherapyBooking).length;
  const therapyUsed = completedBookings.filter(isTherapyBooking).length;
  const shotsTotal = nonCancelledBookings.filter(isShotBooking).length;
  const shotsUsed = completedBookings.filter(isShotBooking).length;
  const therapyPercent = therapyTotal > 0 ? Math.min(100, Math.round((therapyUsed / therapyTotal) * 100)) : 0;
  const shotsPercent = shotsTotal > 0 ? Math.min(100, Math.round((shotsUsed / shotsTotal) * 100)) : 0;

  renderUsageBlocks('membershipSessionBlocks', usageCompletedSessions, Math.max(0, totalSessions));
  renderMiniBlocks('membershipTopUpBlocks', topUpCompletedSessions, Math.max(0, extraSessionsBought));
  renderMiniBlocks('membershipTherapyBlocks', therapyUsed, Math.max(0, therapyTotal));
  renderMiniBlocks('membershipShotsBlocks', shotsUsed, Math.max(0, shotsTotal));

  const membershipUsageCount = document.getElementById('membershipUsageCount');
  const membershipUsageRemaining = document.getElementById('membershipUsageRemaining');
  const membershipTopUpUsage = document.getElementById('membershipTopUpUsage');
  const membershipTopUpCount = document.getElementById('membershipTopUpCount');
  const therapyUsageUsed = document.getElementById('therapyUsageUsed');
  const therapyUsageCount = document.getElementById('therapyUsageCount');
  const shotsUsageUsed = document.getElementById('shotsUsageUsed');
  const shotsUsageCount = document.getElementById('shotsUsageCount');
  const attendanceCompleted = document.getElementById('attendanceCompleted');
  const attendanceUpcoming = document.getElementById('attendanceUpcoming');
  const attendanceMissed = document.getElementById('attendanceMissed');
  const attendanceScheduleLater = document.getElementById('attendanceScheduleLater');
  const scheduleLaterCount = getScheduleLaterDisplayRowCount(allBookings);

  if (membershipUsageCount) membershipUsageCount.textContent = `${usageCompletedSessions} / ${totalSessions}`;
  if (membershipUsageRemaining) membershipUsageRemaining.textContent = String(Math.max(0, totalSessions - usageCompletedSessions));
  if (membershipTopUpUsage) membershipTopUpUsage.textContent = `${topUpCompletedSessions} / ${Math.max(0, extraSessionsBought)}`;
  if (membershipTopUpCount) membershipTopUpCount.textContent = String(topUpRemainingSessions);
  if (therapyUsageUsed) therapyUsageUsed.textContent = `${therapyUsed} / ${therapyTotal}`;
  if (therapyUsageCount) therapyUsageCount.textContent = String(Math.max(0, therapyTotal - therapyUsed));
  if (shotsUsageUsed) shotsUsageUsed.textContent = `${shotsUsed} / ${shotsTotal}`;
  if (shotsUsageCount) shotsUsageCount.textContent = String(Math.max(0, shotsTotal - shotsUsed));
  if (attendanceCompleted) attendanceCompleted.textContent = String(completedSessions);
  if (attendanceUpcoming) attendanceUpcoming.textContent = String(upcomingSessions);
  if (attendanceMissed) attendanceMissed.textContent = String(missedSessions);
  if (attendanceScheduleLater) attendanceScheduleLater.textContent = String(scheduleLaterCount);
  if (elements.membershipConvertedTopUpNote) {
    elements.membershipConvertedTopUpNote.textContent = convertedNonMemberTopUpSessions > 0
      ? 'Note: Your previously purchased non-member hydrogen sessions were added to Top-up Sessions because you took membership after purchasing those sessions.'
      : '';
    elements.membershipConvertedTopUpNote.hidden = convertedNonMemberTopUpSessions <= 0;
  }

  if (elements.membershipUsageBar) {
    elements.membershipUsageBar.style.width = `${safeUsagePercent}%`;
  }
  if (elements.membershipUsageNote) {
    elements.membershipUsageNote.textContent = '';
    elements.membershipUsageNote.hidden = true;
  }
  if (elements.membershipCardTopUpBtn) {
    elements.membershipCardTopUpBtn.textContent = 'Buy Additional';
    elements.membershipCardTopUpBtn.hidden = !active;
  }

  const upcoming = active
    ? upcomingHydrogenBookings[0]
    : upcomingBookings[0];

  if (elements.membershipNextSessionTitle) {
    elements.membershipNextSessionTitle.textContent = upcoming
      ? active ? 'Hydrogen Session' : (upcoming.serviceName || 'Upcoming Booking')
      : active ? 'No hydrogen sessions scheduled' : 'No upcoming bookings';
  }
  if (elements.membershipNextSessionMeta) {
    elements.membershipNextSessionMeta.textContent = upcoming
      ? formatDateTime(upcoming.bookingDate, upcoming.bookingTime)
      : active ? 'Book your next hydrogen session to keep momentum.' : 'Book your next session to start building your dashboard.';
  }
  if (elements.membershipScheduleLaterFooter) {
    elements.membershipScheduleLaterFooter.hidden = scheduleLaterCount <= 0;
    elements.membershipScheduleLaterFooter.textContent = getScheduleLaterFooterText(scheduleLaterCount);
  }
  renderMembershipCalendar(allBookings);

  if (elements.membershipPeopleCard && elements.membershipPeopleList && elements.membershipPeopleMeta) {
    const planId = String(current.plan || '').trim();
    const showPeopleCard = active && currentPeopleCount >= 2;
    elements.membershipPeopleCard.hidden = !showPeopleCard;
    if (showPeopleCard) {
      const roster = state.membershipRoster;
      const members = Array.isArray(roster?.members) ? roster.members : [];
      const slotsRemaining = Number.isFinite(Number(roster?.slotsRemaining))
        ? Number(roster.slotsRemaining)
        : Math.max(0, currentPeopleCount - members.length);
      const startedAtValue =
        roster?.subscription?.startedAt || current.startedAt || state.user?.membershipStartedAt || null;
      const expiresAtValue =
        roster?.subscription?.expiresAt || current.expiresAt || state.user?.membershipExpiresAt || null;
      const startedAt = startedAtValue ? new Date(startedAtValue) : null;
      const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;

      const validityLine =
        startedAt && !Number.isNaN(startedAt.getTime())
          ? `Validity starts from ${formatDateAsDayMonthYear(startedAt)}` +
            (expiresAt && !Number.isNaN(expiresAt.getTime()) ? ` • ends on ${formatDateAsDayMonthYear(expiresAt)}` : '')
          : '';
      elements.membershipPeopleMeta.textContent = `${members.length} of ${currentPeopleCount} member${
        currentPeopleCount === 1 ? '' : 's'
      } added${validityLine ? ` • ${validityLine}` : ''}`;

      elements.membershipPeopleList.innerHTML = '';
      if (!members.length) {
        elements.membershipPeopleList.innerHTML = '<p class="empty-state">No members added yet.</p>';
      } else {
        for (const member of members) {
          const item = document.createElement('div');
          item.className = 'membership-people-item';
          const name = String(member?.name || '').trim() || 'Member';
          const place = String(member?.place || '').trim();
          const email = String(member?.email || '').trim();
          item.innerHTML = `
            <div>
              <strong>${escapeHtml(name)}</strong>
              ${place ? `<span>${escapeHtml(place)}</span>` : '<span>&nbsp;</span>'}
            </div>
            <div class="membership-people-email">${escapeHtml(email)}</div>
          `;
          elements.membershipPeopleList.appendChild(item);
        }
      }

      const supportsDashboardAddPerson = planId === 'h2_two' || planId === 'h2_four';
      if (elements.membershipAddPersonBtn) {
        elements.membershipAddPersonBtn.hidden = !supportsDashboardAddPerson;
        elements.membershipAddPersonBtn.disabled = !supportsDashboardAddPerson;
      }
    } else if (elements.membershipAddPersonBtn) {
      elements.membershipAddPersonBtn.hidden = true;
      elements.membershipAddPersonBtn.disabled = true;
    }
  }

  const orderedPlanIds = ['h2_single', 'h2_two', 'h2_four'];
  const plans = orderedPlanIds
    .map((id) => (state.membership.plans || []).find((plan) => String(plan.id) === id))
    .filter(Boolean);
  const addPersonPriceInr = getMembershipAddPersonPriceInr();

  if (!plans.length) {
    elements.membershipPlans.innerHTML = '<p class="empty-state">Membership plans are not configured.</p>';
    return;
  }

  elements.membershipPlans.innerHTML = '';
  for (const plan of plans) {
    const canAddPerson = supportsAddPersonOnMembershipCard(plan);
    const existingAdditionalPeople = Number(state.membershipAdditions?.[plan.id] || 0);
    const additionalPeople = canAddPerson && existingAdditionalPeople > 0 ? 1 : 0;
    if (canAddPerson) {
      state.membershipAdditions[plan.id] = additionalPeople;
    }
    const estimatedAmountInr = getGstBreakdownInr(Number(plan.priceInr || 0) + additionalPeople * addPersonPriceInr).totalAmountInr;
    const showAddPersonPricing = additionalPeople > 0;
    const isCurrentBasePlan = active && String(current.plan || '') === String(plan.id);
    const theme = getMembershipPlanTheme(plan);
    const featureItems = getMembershipFeatureItems(plan).slice(0, 4);
    const coverageLabel = `${Number(plan.peopleCount || 1)} ${
      Number(plan.peopleCount || 1) === 1 ? 'Person' : 'People'
    } Coverage`;

    const card = document.createElement('article');
    card.className = 'membership-card';
    if (theme.featured) card.classList.add('is-featured');
    if (isCurrentBasePlan) card.classList.add('is-current');
    
    card.innerHTML = `
      
      <div class="membership-card-head">
        <p class="membership-plan-name">${escapeHtml(coverageLabel)}</p>
        <h3>${escapeHtml(theme.title)}</h3>
        <p class="membership-card-subtitle">${escapeHtml(theme.subtitle)}</p>
        ${theme.badge ? `<span class="membership-plan-badge">${escapeHtml(theme.badge)}</span>` : ''}
        <span class="membership-card-active${isCurrentBasePlan ? '' : ' is-placeholder'}">Current Plan</span>
      </div>
      <div class="membership-card-body">
        <div class="membership-card-price-block">
          <p class="membership-price">Rs. ${estimatedAmountInr.toLocaleString('en-IN')}</p>
          <p class="membership-price-caption">1-year access • ${escapeHtml(plan.validityDays)} days • Includes GST ${GST_RATE_PERCENT}%</p>
        </div>
        <p class="membership-includes-label">Includes:</p>
        <ul class="membership-feature-list">
          ${featureItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
        ${
          canAddPerson
            ? `
        <div class="membership-add-price-box${showAddPersonPricing ? '' : ' is-hidden'}">
          <strong>Add Person</strong>
          <span class="membership-add-price-line">+ Rs. ${addPersonPriceInr.toLocaleString('en-IN')}</span>
        </div>
        <div class="membership-add-controls">
          <button
            type="button"
            class="membership-add-person-btn${additionalPeople > 0 ? ' is-active' : ''}"
            aria-label="${additionalPeople > 0 ? 'Remove added person' : 'Add one more person'}"
          >${additionalPeople > 0 ? '-' : '+'}</button>
          <span class="membership-add-label">Add 1 person</span>
        </div>
        `
            : ''
        }
        <div class="membership-card-actions"></div>
      </div>
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-primary';
    button.textContent = isCurrentBasePlan ? 'Active Plan' : 'Get Started';
    button.disabled = isCurrentBasePlan && additionalPeople === 0;
    button.addEventListener('click', () => {
      openMembershipCheckoutDialog(plan, additionalPeople);
    });

    const actionWrap = card.querySelector('.membership-card-actions');
    if (actionWrap) {
      actionWrap.appendChild(button);
    }

    const addPersonBtn = card.querySelector('.membership-add-person-btn');
    if (addPersonBtn) {
      addPersonBtn.addEventListener('click', () => {
        state.membershipAdditions[plan.id] = additionalPeople > 0 ? 0 : 1;
        renderMembership();
      });
    }
    elements.membershipPlans.appendChild(card);
  }
}

function supportsAddPersonOnMembershipCard(plan) {
  const planId = String(plan?.id || '').trim();
  return planId === 'h2_two' || planId === 'h2_four';
}

function getMembershipPlanTheme(plan) {
  const planId = String(plan?.id || '');
  if (planId === 'h2_two') {
    return {
      title: 'Most Popular',
      badge: 'Most Popular',
      subtitle: 'Balanced annual plan for two with stronger shared value.',
      featured: true,
    };
  }
  if (planId === 'h2_four') {
    return {
      title: 'Best Value',
      badge: '',
      subtitle: 'Great for family coverage with the strongest yearly savings.',
      featured: false,
    };
  }
  return {
    title: 'Starter',
    badge: '',
    subtitle: 'Designed for individual wellness and regular hydrogen access.',
    featured: false,
  };
}

function getMembershipFeatureItems(plan) {
  const sessions = Number(plan?.h2SessionsIncluded || 0);
  const people = Number(plan?.peopleCount || 1);
  return [
    `Coverage for ${people} member${people === 1 ? '' : 's'}`,
    `${sessions} hydrogen session${sessions === 1 ? '' : 's'} included`,
    'Lab tests and oxidative stress marker support',
    'Member pricing across eligible services',
  ];
}

function getMembershipAddPersonPriceInr() {
  const addPersonPlan = (state.membership.plans || []).find((plan) => String(plan.id) === 'h2_add_person');
  return Number(addPersonPlan?.priceInr || 0);
}

function openMembershipCheckoutDialog(plan, additionalPeople) {
  if (!elements.membershipDialog || !elements.membershipMembersGrid) return;
  restoreMembershipCheckoutFooter();
  const targetPeopleCount = Number(plan.peopleCount || 1) + Number(additionalPeople || 0);
  const addPersonPriceInr = getMembershipAddPersonPriceInr();
  const estimatedAmountInr = getGstBreakdownInr(Number(plan.priceInr || 0) + Number(additionalPeople || 0) * addPersonPriceInr).totalAmountInr;
  const members = [];
  for (let i = 0; i < targetPeopleCount; i += 1) {
    members.push({
      name: i === 0 ? state.user?.name || '' : '',
      place: '',
      email: i === 0 ? state.user?.email || '' : '',
      contactNumber: i === 0 ? state.user?.mobile || '' : '',
    });
  }

  state.membershipCheckout = {
    planId: plan.id,
    planName: plan.name,
    additionalPeople: Number(additionalPeople || 0),
    targetPeopleCount,
    estimatedAmountInr,
    members,
  };
  state.membershipCouponPreview = null;
  if (elements.membershipCouponCode) {
    elements.membershipCouponCode.value = '';
  }

  if (elements.membershipDialogTitle) {
    elements.membershipDialogTitle.textContent = `Membership Details • ${plan.name}`;
  }
  renderMembershipCheckoutSummary();
  renderMembershipCouponPreview();

  elements.membershipMembersGrid.innerHTML = '';
  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    const row = document.createElement('div');
    row.className = 'membership-member-row';
    row.innerHTML = `
      <h4>Person ${i + 1}</h4>
      <div class="form-grid">
        <label>
          Full Name
          <input type="text" required data-member-index="${i}" data-member-field="name" value="${escapeHtml(member.name)}" />
        </label>
        <label>
          Place
          <input type="text" required data-member-index="${i}" data-member-field="place" value="${escapeHtml(member.place)}" />
        </label>
        <label>
          Email
          <input type="email" required data-member-index="${i}" data-member-field="email" value="${escapeHtml(member.email)}" />
        </label>
        <label>
          Contact Number
          <input type="tel" required maxlength="10" inputmode="numeric" pattern="\\d{10}" data-member-index="${i}" data-member-field="contactNumber" value="${escapeHtml(member.contactNumber)}" />
        </label>
      </div>
    `;
    elements.membershipMembersGrid.appendChild(row);
  }

  elements.membershipDialog.showModal();
}

function closeMembershipDialog() {
  if (elements.membershipDialog?.open) {
    elements.membershipDialog.close();
  }
  state.membershipCheckout = null;
}

function closeMembershipRosterDialog() {
  if (elements.membershipRosterDialog?.open) {
    elements.membershipRosterDialog.close();
  }
}

async function openMembershipRosterDialog() {
  if (!elements.membershipRosterDialog || !elements.membershipRosterList || !elements.membershipRosterSummary) return;
  if (state.user?.role !== 'user') return;

  const active = Boolean(state.membership.active);
  const currentPeopleCount = Math.max(0, Number(state.membership.current?.peopleCount || 0));
  if (!active) {
    showNotice({
      title: 'No covered members',
      body: 'This membership does not currently have covered members to show.',
    });
    return;
  }

  if (!state.membershipRoster) {
    try {
      const fetchedRoster = await api('/api/membership/members');
      state.membershipRoster = Array.isArray(fetchedRoster) ? { members: fetchedRoster } : fetchedRoster;
    } catch {
      state.membershipRoster = null;
    }
  }

  const roster = state.membershipRoster || {};
  const fallbackOrder = (Array.isArray(state.userMembershipOrders) ? state.userMembershipOrders : [])
    .filter((order) => String(order?.status || '').toLowerCase() === 'paid')
    .sort((a, b) => `${String(b?.paidAt || b?.createdAt || '')}`.localeCompare(`${String(a?.paidAt || a?.createdAt || '')}`))[0] || null;
  const fallbackMembers = Array.isArray(fallbackOrder?.memberDetails) ? fallbackOrder.memberDetails : [];
  const members = Array.isArray(roster.members) && roster.members.length
    ? roster.members
    : Array.isArray(roster) && roster.length
      ? roster
      : fallbackMembers;
  const resolvedPeopleCount = Math.max(
    currentPeopleCount,
    Number(roster?.subscription?.peopleCount || 0),
    Number(roster?.totalCovered || 0),
    Number(fallbackOrder?.peopleCount || 0),
    members.length
  );
  const visibleMembers = members.slice(0, resolvedPeopleCount || members.length);
  const startedAtValue =
    roster?.subscription?.startedAt ||
    state.membership.current?.startedAt ||
    state.user?.membershipStartedAt ||
    null;
  const expiresAtValue =
    roster?.subscription?.expiresAt ||
    state.membership.current?.expiresAt ||
    state.user?.membershipExpiresAt ||
    null;
  const startedAt = startedAtValue ? new Date(startedAtValue) : null;
  const expiresAt = expiresAtValue ? new Date(expiresAtValue) : null;
  const validityText =
    startedAt && !Number.isNaN(startedAt.getTime())
      ? `Membership validity starts ${formatDateAsDayMonthYear(startedAt)}`
      : 'Membership validity is active';
  const endText = expiresAt && !Number.isNaN(expiresAt.getTime()) ? ` and ends ${formatDateAsDayMonthYear(expiresAt)}` : '';

  if (elements.membershipRosterDialogTitle) {
    elements.membershipRosterDialogTitle.textContent = 'Covered Members';
  }
  const summaryCount = resolvedPeopleCount || visibleMembers.length;
  elements.membershipRosterSummary.textContent =
    `${visibleMembers.length} of ${summaryCount} covered member${summaryCount === 1 ? '' : 's'}. ` +
    `${validityText}${endText}.`;

  elements.membershipRosterList.innerHTML = '';
  if (!visibleMembers.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No covered member details saved yet.';
    elements.membershipRosterList.appendChild(empty);
  } else {
    visibleMembers.forEach((member, index) => {
      const item = document.createElement('div');
      item.className = 'admin-member-detail membership-roster-item';
      const name = String(member?.name || '').trim() || 'Member';
      const place = String(member?.place || '').trim();
      const email = String(member?.email || '').trim() || '-';
      const contactNumber = String(member?.contactNumber || '').trim() || '-';
      item.innerHTML = `
        <div><strong>Person ${index + 1}</strong></div>
        <div><strong>Name:</strong> ${escapeHtml(name)}</div>
        ${place ? `<div><strong>Place:</strong> ${escapeHtml(place)}</div>` : ''}
        <div><strong>Email:</strong> ${escapeHtml(email)}</div>
        <div><strong>Contact:</strong> ${escapeHtml(contactNumber)}</div>
      `;
      elements.membershipRosterList.appendChild(item);
    });
  }

  elements.membershipRosterDialog.showModal();
}

function closeMembershipAddPersonDialog() {
  if (elements.membershipAddPersonDialog?.open) {
    elements.membershipAddPersonDialog.close();
  }
  if (elements.membershipAddPersonError) {
    elements.membershipAddPersonError.hidden = true;
    elements.membershipAddPersonError.textContent = '';
  }
}

function openMembershipAddPersonDialog() {
  if (!elements.membershipAddPersonDialog) return;
  if (state.user?.role !== 'user' || !isCurrentUserMembershipActive()) {
    showNotice({ title: 'Members only', body: 'Active membership is required to add a person.' });
    return;
  }
  const startedAtValue =
    state.membershipRoster?.subscription?.startedAt ||
    state.membership.current?.startedAt ||
    state.user?.membershipStartedAt ||
    null;
  const startedAt = startedAtValue ? new Date(startedAtValue) : null;
  if (elements.membershipAddPersonValidityNote) {
    elements.membershipAddPersonValidityNote.textContent =
      startedAt && !Number.isNaN(startedAt.getTime())
        ? `Validity for this person starts from your payment date: ${formatDateAsDayMonthYear(startedAt)}.`
        : 'Validity for this person starts from your membership payment date.';
  }
  if (elements.membershipAddPersonName) elements.membershipAddPersonName.value = '';
  if (elements.membershipAddPersonPlace) elements.membershipAddPersonPlace.value = '';
  if (elements.membershipAddPersonEmail) elements.membershipAddPersonEmail.value = '';
  if (elements.membershipAddPersonContact) elements.membershipAddPersonContact.value = '';
  if (elements.membershipAddPersonError) {
    elements.membershipAddPersonError.hidden = true;
    elements.membershipAddPersonError.textContent = '';
  }
  elements.membershipAddPersonDialog.showModal();
}

function openMembershipAddPersonUpgradeCheckoutDialog() {
  if (!elements.membershipDialog || !elements.membershipMembersGrid) return;
  restoreMembershipCheckoutFooter();
  if (state.user?.role !== 'user' || !isCurrentUserMembershipActive()) {
    showNotice({ title: 'Members only', body: 'Active membership is required to add a person.' });
    return;
  }

  const addPersonPlan = (state.membership.plans || []).find((plan) => String(plan.id) === 'h2_add_person') || null;
  if (!addPersonPlan) {
    showNotice({ title: 'Error', body: 'Add Person plan is not configured.' });
    return;
  }

  const currentPeopleCount = Math.max(
    1,
    Number(
      state.membershipRoster?.subscription?.peopleCount ||
        state.membership.current?.peopleCount ||
        state.user?.membershipPeopleCount ||
        1
    )
  );
  const targetPeopleCount = currentPeopleCount + 1;
  const estimatedAmountInr = getGstBreakdownInr(Number(addPersonPlan.priceInr || 0)).totalAmountInr;

  const buyerEmail = String(state.user?.email || '').trim().toLowerCase();
  const rosterMembers = Array.isArray(state.membershipRoster?.members) ? state.membershipRoster.members : [];
  const normalizedRoster = rosterMembers
    .map((member) => ({
      name: String(member?.name || '').trim(),
      place: String(member?.place || '').trim(),
      email: String(member?.email || '').trim(),
      contactNumber: String(member?.contactNumber || '').trim(),
    }))
    .filter((member) => Boolean(String(member.email || '').trim()));

  const buyerFromRosterIndex = normalizedRoster.findIndex(
    (member) => String(member.email || '').trim().toLowerCase() === buyerEmail
  );
  const buyerFromRoster = buyerFromRosterIndex >= 0 ? normalizedRoster.splice(buyerFromRosterIndex, 1)[0] : null;
  const buyerFallback = {
    name: String(state.user?.name || '').trim(),
    place: '',
    email: String(state.user?.email || '').trim(),
    contactNumber: String(state.user?.mobile || '').trim(),
  };
  const buyer = buyerFromRoster || buyerFallback;

  const members = [buyer];
  for (const member of normalizedRoster) {
    if (members.length >= currentPeopleCount) break;
    members.push(member);
  }
  while (members.length < currentPeopleCount) {
    members.push({ name: '', place: '', email: '', contactNumber: '' });
  }
  members.push({ name: '', place: '', email: '', contactNumber: '' });

  state.membershipCheckout = {
    planId: addPersonPlan.id,
    planName: addPersonPlan.name,
    additionalPeople: 0,
    targetPeopleCount,
    estimatedAmountInr,
    members,
    lockedMembers: members.slice(0, currentPeopleCount),
  };
  state.membershipCouponPreview = null;
  if (elements.membershipCouponCode) {
    elements.membershipCouponCode.value = '';
  }

  if (elements.membershipDialogTitle) {
    elements.membershipDialogTitle.textContent = `Membership Details • ${addPersonPlan.name}`;
  }
  renderMembershipCheckoutSummary();
  renderMembershipCouponPreview();

  elements.membershipMembersGrid.innerHTML = '';
  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    const row = document.createElement('div');
    row.className = 'membership-member-row';
    row.innerHTML = `
      <h4>Person ${i + 1}</h4>
      <div class="form-grid">
        <label>
          Full Name
          <input type="text" required data-member-index="${i}" data-member-field="name" value="${escapeHtml(member.name)}" />
        </label>
        <label>
          Place
          <input type="text" required data-member-index="${i}" data-member-field="place" value="${escapeHtml(member.place)}" />
        </label>
        <label>
          Email
          <input type="email" required data-member-index="${i}" data-member-field="email" value="${escapeHtml(member.email)}" />
        </label>
        <label>
          Contact Number
          <input type="tel" required maxlength="10" inputmode="numeric" pattern="\\d{10}" data-member-index="${i}" data-member-field="contactNumber" value="${escapeHtml(member.contactNumber)}" />
        </label>
      </div>
    `;
    elements.membershipMembersGrid.appendChild(row);

    if (i < currentPeopleCount) {
      const inputs = Array.from(row.querySelectorAll('input'));
      inputs.forEach((input) => {
        input.readOnly = true;
        input.disabled = true;
        input.title = 'Existing member details cannot be changed here.';
      });
    }
  }

  elements.membershipDialog.showModal();
}

async function submitMembershipAddPerson() {
  if (state.user?.role !== 'user') return;
  const name = String(elements.membershipAddPersonName?.value || '').trim();
  const place = String(elements.membershipAddPersonPlace?.value || '').trim();
  const email = String(elements.membershipAddPersonEmail?.value || '').trim();
  const contactNumber = normalizeTenDigitMobile(elements.membershipAddPersonContact?.value);
  if (elements.membershipAddPersonContact && elements.membershipAddPersonContact.value.trim() !== contactNumber) {
    elements.membershipAddPersonContact.value = contactNumber;
  }

  if (!name || !place || !email || !contactNumber) {
    throw new Error('Please fill all fields.');
  }
  if (contactNumber.length !== 10) {
    throw new Error('Contact number must be 10 digits.');
  }

  const response = await api('/api/membership/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, place, email, contactNumber }),
  });

  state.membershipRoster = response || null;
  closeMembershipAddPersonDialog();
  renderMembership();
}

function collectMembershipMemberDetails() {
  if (!state.membershipCheckout || !elements.membershipMembersGrid) return [];
  const members = [];
  const lockedMembers = Array.isArray(state.membershipCheckout.lockedMembers) ? state.membershipCheckout.lockedMembers : null;
  for (let i = 0; i < state.membershipCheckout.targetPeopleCount; i += 1) {
    if (lockedMembers && lockedMembers[i]) {
      members.push({
        name: String(lockedMembers[i].name || '').trim(),
        place: String(lockedMembers[i].place || '').trim(),
        email: String(lockedMembers[i].email || '').trim(),
        contactNumber: String(lockedMembers[i].contactNumber || '').trim(),
      });
      continue;
    }
    const getValue = (field) => {
      const input = elements.membershipMembersGrid.querySelector(
        `[data-member-index="${i}"][data-member-field="${field}"]`
      );
      return String(input?.value || '').trim();
    };
    members.push({
      name: getValue('name'),
      place: getValue('place'),
      email: getValue('email'),
      contactNumber: normalizeTenDigitMobile(getValue('contactNumber')),
    });
  }
  return members;
}

function renderMembershipCheckoutSummary() {
  if (!elements.membershipPlanSummary || !state.membershipCheckout) return;
  const targetPeopleCount = Number(state.membershipCheckout.targetPeopleCount || 0);
  const estimatedAmountInr = Number(state.membershipCheckout.estimatedAmountInr || 0);
  const estimatedBreakdown = getGstBreakdownInr(estimatedAmountInr, { fromGross: true });
  const preview = state.membershipCouponPreview;
  const planId = String(state.membershipCheckout.planId || '').trim();
  const startedAtValue =
    state.membershipRoster?.subscription?.startedAt ||
    state.membership.current?.startedAt ||
    state.user?.membershipStartedAt ||
    null;
  const startedAt = startedAtValue ? new Date(startedAtValue) : null;
  const addPersonValidityNote =
    planId === 'h2_add_person' && startedAt && !Number.isNaN(startedAt.getTime())
    ? ` • Validity starts from ${formatDateAsDayMonthYear(startedAt)}`
      : '';

  if (preview) {
    const original = Number(preview.originalAmountInr || estimatedAmountInr || 0);
    const discount = Number(preview.discountAmountInr || 0);
    const gst = Number(preview.gstAmountInr || 0);
    const payable = Number(preview.payableAmountInr || Math.max(0, original - discount + gst));
    elements.membershipPlanSummary.textContent =
      `Members: ${targetPeopleCount} • Estimated: Rs. ${original.toLocaleString('en-IN')}` +
      ` • Coupon: -Rs. ${discount.toLocaleString('en-IN')}` +
      ` • GST ${GST_RATE_PERCENT}%: Rs. ${gst.toLocaleString('en-IN')}` +
      ` • Payable: Rs. ${payable.toLocaleString('en-IN')}${addPersonValidityNote}`;
    return;
  }

  elements.membershipPlanSummary.textContent =
    `Members: ${targetPeopleCount} • Estimated Amount: Rs. ${estimatedBreakdown.subtotalAmountInr.toLocaleString('en-IN')}` +
    ` • GST ${GST_RATE_PERCENT}%: Rs. ${estimatedBreakdown.gstAmountInr.toLocaleString('en-IN')}` +
    ` • Payable: Rs. ${estimatedBreakdown.totalAmountInr.toLocaleString('en-IN')}${addPersonValidityNote}`;
}

function renderCouponPreview(preview, target) {
  if (!target) return;
  if (!preview) {
    target.hidden = true;
    target.innerHTML = '';
    return;
  }

  const description = String(preview.description || '').trim();
  const original = Number(preview.originalAmountInr || 0);
  const discount = Number(preview.discountAmountInr || 0);
  const gst = Number(preview.gstAmountInr || 0);
  const payable = Number(preview.payableAmountInr || 0);
  target.hidden = false;
  target.innerHTML = `
    <strong>${escapeHtml(preview.code || '')}</strong>
    ${description ? `<span>${escapeHtml(description)}</span>` : ''}
    <span>Discount: Rs. ${discount.toLocaleString('en-IN')} off</span>
    <span>GST ${GST_RATE_PERCENT}%: Rs. ${gst.toLocaleString('en-IN')}</span>
    <span>Payable: Rs. ${payable.toLocaleString('en-IN')} (was Rs. ${original.toLocaleString('en-IN')})</span>
  `;
}

function renderMembershipCouponPreview() {
  renderCouponPreview(state.membershipCouponPreview, elements.membershipCouponPreview);
}

function renderCartCouponPreview() {
  renderCouponPreview(state.cartCouponPreview, elements.userCouponPreview);
}

function renderGeneralCouponsForTarget({ coupons = [], container, onApply }) {
  if (!container) return;
  const isCartOffersContainer = container === elements.userGeneralCoupons;
  if (isCartOffersContainer && getUserCartUnitCount(state.bookings || []) === 0) {
    container.hidden = true;
    container.innerHTML = '';
    return;
  }
  container.innerHTML = '';
  container.hidden = false;
  const heading = document.createElement('p');
  heading.className = 'general-coupons-title';
  heading.textContent = 'Available Offers';
  container.appendChild(heading);

  const visibleCoupons = (Array.isArray(coupons) ? coupons : []).filter(
    (coupon) =>
      getCouponTypeClient(coupon) === 'public' &&
      isCouponActiveClient(coupon) &&
      isCouponWithinDateRangeClient(coupon)
  );
  if (!visibleCoupons.length) {
    if (isCartOffersContainer) {
      container.hidden = true;
      return;
    }
    const empty = document.createElement('p');
    empty.className = 'membership-copy';
    empty.textContent = 'No active offers right now.';
    container.appendChild(empty);
    return;
  }

  visibleCoupons.forEach((coupon) => {
    const card = document.createElement('article');
    const isRedeemable = Boolean(coupon.canRedeem);
    card.className = `general-coupon-card${isRedeemable ? '' : ' is-redeemed'}`;
    const description = String(coupon.description || '').trim();
    const festivalName = String(coupon.festivalName || '').trim();
    const expiryText = coupon.expiresAt ? `Valid till ${formatDateOnly(coupon.expiresAt)}` : 'Limited period';
    const metaText = [festivalName, description || expiryText].filter(Boolean).join(' • ');
    card.innerHTML = `
      <div class="general-coupon-top">
        <div class="general-coupon-head">
          <strong>🎉 ${escapeHtml(coupon.code || '')}</strong>
          <span>Rs. ${Number(coupon.discountValue || 0).toLocaleString('en-IN')} OFF</span>
        </div>
        ${
          isRedeemable
            ? '<button type="button" class="btn btn-secondary general-coupon-apply">Apply</button>'
            : '<span class="general-coupon-status" aria-label="Coupon already redeemed">Redeemed</span>'
        }
      </div>
      ${metaText ? `<small>${escapeHtml(metaText)}</small>` : ''}
    `;
    if (isRedeemable) {
      const applyBtn = card.querySelector('.general-coupon-apply');
      applyBtn?.addEventListener('click', () => onApply(coupon.code || ''));
    }
    container.appendChild(card);
  });
}

function renderGeneralCoupons() {
  renderGeneralCouponsForTarget({
    coupons: state.generalCoupons?.services || [],
    container: elements.userGeneralCoupons,
    onApply: async (code) => {
      if (elements.userCouponCode) elements.userCouponCode.value = code;
      await previewCartCoupon();
    },
  });
  renderGeneralCouponsForTarget({
    coupons: state.generalCoupons?.membership || [],
    container: elements.membershipGeneralCoupons,
    onApply: async (code) => {
      if (elements.membershipCouponCode) elements.membershipCouponCode.value = code;
      await previewMembershipCoupon();
    },
  });
}

async function previewMembershipCoupon() {
  if (!state.membershipCheckout) {
    showNotice({ title: 'Notice', body: 'Select a membership plan first.' });
    return;
  }
  const couponCode = String(elements.membershipCouponCode?.value || '').trim();
  if (!couponCode) {
    state.membershipCouponPreview = null;
    renderMembershipCouponPreview();
    renderMembershipCheckoutSummary();
    return;
  }

  try {
    const result = await api('/api/membership/preview-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: state.membershipCheckout.planId,
        additionalPeople: state.membershipCheckout.additionalPeople,
        couponCode,
      }),
    });
    state.membershipCouponPreview = result.coupon || null;
    renderMembershipCouponPreview();
    renderMembershipCheckoutSummary();
  } catch (error) {
    state.membershipCouponPreview = null;
    renderMembershipCouponPreview();
    renderMembershipCheckoutSummary();
    showNotice({ title: 'Error', body: error.message || 'Unable to apply this coupon.' });
  }
}

async function previewCartCoupon() {
  const couponCode = String(elements.userCouponCode?.value || '').trim();
  state.cartCouponCode = couponCode;
  if (!couponCode) {
    state.cartCouponPreview = null;
    renderCartCouponPreview();
    renderUserCheckoutSummary(state.bookings || []);
    return;
  }

  try {
    const result = await api('/api/payments/preview-cart-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couponCode }),
    });
    state.cartCouponPreview = result.coupon || null;
    renderCartCouponPreview();
    renderUserCheckoutSummary(state.bookings || []);
  } catch (error) {
    state.cartCouponPreview = null;
    renderCartCouponPreview();
    renderUserCheckoutSummary(state.bookings || []);
    showNotice({ title: 'Error', body: error.message || 'Unable to apply this coupon.' });
  }
}

async function submitMembershipCheckout() {
  if (!state.membershipCheckout) return;
  const plan = (state.membership.plans || []).find((item) => String(item.id) === String(state.membershipCheckout.planId));
  if (!plan) {
    showNotice({ title: 'Error', body: 'Membership plan not found.' });
    return;
  }

  try {
    const memberDetails = collectMembershipMemberDetails();
    memberDetails.forEach((member) => {
      if (!member?.contactNumber) return;
      if (String(member.contactNumber).trim().length !== 10) {
        throw new Error('Contact number must be 10 digits.');
      }
    });
    await activateMembershipWithPayment(plan, state.membershipCheckout.additionalPeople, memberDetails);
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to continue with membership payment.' });
  }
}

async function activateMembershipWithPayment(plan, additionalPeople = 0, memberDetails = []) {
  const couponCode = state.membershipCouponPreview?.code || String(elements.membershipCouponCode?.value || '').trim();
  const order = await api('/api/membership/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planId: plan.id, additionalPeople, memberDetails, couponCode }),
  });

  if (!window.Razorpay) {
    throw new Error('Razorpay SDK not loaded');
  }

  closeMembershipDialog();

  const options = {
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || 'INR',
    name: 'H2 House Of Health',
    description: `Membership: ${order.plan?.name || plan.name}`,
    order_id: order.orderId,
    prefill: {
      name: order.user?.name || state.user?.name || '',
      email: order.user?.email || state.user?.email || '',
    },
    theme: {
      color: '#8b5e3c',
    },
    handler: async (response) => {
      try {
        const result = await api('/api/membership/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planId: plan.id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          }),
        });
        state.user = { ...state.user, ...(result.profile || {}) };
        await loadDashboardData();
        state.membershipCouponPreview = null;
        if (elements.membershipCouponCode) elements.membershipCouponCode.value = '';
        renderMembershipCouponPreview();
        renderMembershipCheckoutSummary();
        state.activeUserTab = 'services';
        render();
        requestAnimationFrame(() => {
          elements.servicesSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        showNotice({
          title: 'Success',
          body: [result.message || 'Membership activated. Redirecting to Services.', ...buildAppliedCouponSuccessLines(result.coupon || order.coupon)],
        });
      } catch (error) {
        showNotice({ title: 'Error', body: getCheckoutPaymentErrorMessage(error, 'Membership payment verification failed.') });
      }
    },
    modal: {
      ondismiss: () => {
        showNotice({ title: 'Notice', body: 'Membership payment was canceled.' });
      },
    },
  };

  const checkout = new window.Razorpay(options);
  checkout.open();
}

function renderProfileAvatar() {
  const initials = getInitials(state.user?.name || 'User');
  const avatarUrl = normalizeAvatarUrl(state.user?.avatarUrl || '');
  elements.profileAvatar.textContent = initials;
  if (avatarUrl) {
    elements.profileAvatar.style.backgroundImage = `url("${avatarUrl}")`;
    elements.profileAvatar.classList.add('has-image');
  } else {
    elements.profileAvatar.style.backgroundImage = '';
    elements.profileAvatar.classList.remove('has-image');
  }
}

function normalizeAvatarUrl(urlValue) {
  const raw = String(urlValue || '').trim();
  if (!raw) return '';
  if (raw.startsWith('blob:')) return raw;
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return '';
  }
}

function withCacheBuster(urlValue) {
  const normalized = normalizeAvatarUrl(urlValue);
  if (!normalized) return '';
  try {
    const u = new URL(normalized);
    u.searchParams.set('v', String(Date.now()));
    return u.toString();
  } catch {
    return normalized;
  }
}

function getInitials(name) {
  const parts = String(name).trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return 'U';
  return parts.map((part) => part[0].toUpperCase()).join('');
}

function renderStats(bookings) {
  if (!elements.totalCount) {
    return;
  }
  const isAdmin = state.user?.role === 'admin';
  if (isAdmin) {
    const todayCount = getAdminPaidTodayBookings(bookings).length;
    const totalBookingsTillDate = Array.isArray(bookings)
      ? bookings.filter(isAdminPaidBookingVisible).length
      : 0;
    elements.totalCount.textContent = String(todayCount);
    if (elements.historyCount) elements.historyCount.textContent = String(totalBookingsTillDate);
    const activeAdminTab = state.adminActiveTab || 'bookings';
    const activeMode = String(state.adminAllBookingViewMode || 'history').trim().toLowerCase();
    elements.adminStatTotal?.classList.toggle('is-active', activeAdminTab === 'bookings' && activeMode === 'today');
    elements.adminHistoryCard?.classList.toggle('is-active', activeAdminTab === 'bookings' && activeMode !== 'today');
    return;
  }

  const total = Array.isArray(bookings) ? bookings.length : 0;
  elements.totalCount.textContent = String(total);
}

function getAdminUserBookings(userId) {
  const normalizedId = String(userId || '');
  return (Array.isArray(state.bookings) ? state.bookings : [])
    .filter((booking) => String(booking?.userId || '') === normalizedId)
    .filter((booking) => String(booking?.paymentStatus || '').trim().toLowerCase() === 'paid')
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
}

function isAdminHydrogenSessionBooking(booking) {
  return getBookingCategory(booking?.serviceName) === 'HYDROGEN SESSION';
}

function isAdminTopUpSessionBooking(booking) {
  if (!isAdminHydrogenSessionBooking(booking)) return false;
  if (Number(booking?.isTopUpSession || 0) === 1) return true;
  const paymentReference = String(booking?.paymentReference || '').trim().toLowerCase();
  if (paymentReference === 'buy_extra') return true;
  if (!paymentReference || paymentReference === 'membership') return false;
  return /hydrogen package\s+\d+\s*\+\s*extra\s*\d+/i.test(String(booking?.notes || ''));
}

function isAdminMemberSessionBooking(booking) {
  if (!isAdminHydrogenSessionBooking(booking)) return false;
  if (isAdminTopUpSessionBooking(booking)) return false;
  return String(booking?.paymentReference || '').trim().toLowerCase() === 'membership';
}

function getAdminSessionKindLabel(booking) {
  if (isAdminTopUpSessionBooking(booking)) return 'Top-up';
  if (isAdminMemberSessionBooking(booking)) return 'Member';
  if (isAdminHydrogenSessionBooking(booking)) return 'Paid';
  return getBookingCategoryLabel(booking?.serviceName || 'Session');
}

function getAdminUserSessionsByFilter(bookings, filter = state.adminUserSessionFilter) {
  const normalizedFilter = String(filter || 'all').trim().toLowerCase();
  const source = Array.isArray(bookings) ? bookings : [];
  if (normalizedFilter === 'member') return source.filter(isAdminMemberSessionBooking);
  if (normalizedFilter === 'topup') return source.filter(isAdminTopUpSessionBooking);
  if (normalizedFilter === 'completed') {
    return source.filter((booking) => String(booking?.status || '').trim().toLowerCase() === 'completed');
  }
  if (normalizedFilter === 'remaining') {
    return source.filter((booking) => {
      const status = String(booking?.status || '').trim().toLowerCase();
      return status !== 'completed' && status !== 'cancelled' && status !== 'schedule_later' && !isBookingMissed(booking);
    });
  }
  if (normalizedFilter === 'missed') return source.filter(isBookingMissed);
  return source;
}

function getBookingStartTime(booking) {
  const bookingDate = String(booking?.bookingDate || '').trim();
  const bookingTime = normalizeSlotStartTime(booking?.bookingTime || '');
  if (!bookingDate || !bookingTime) return Number.NaN;
  const isoDateMatch = bookingDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmyDateMatch = bookingDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const timeMatch = bookingTime.match(/^(\d{2}):(\d{2})$/);
  if (!timeMatch) return Number.NaN;
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  let year;
  let month;
  let day;
  if (isoDateMatch) {
    year = Number(isoDateMatch[1]);
    month = Number(isoDateMatch[2]);
    day = Number(isoDateMatch[3]);
  } else if (dmyDateMatch) {
    day = Number(dmyDateMatch[1]);
    month = Number(dmyDateMatch[2]);
    year = Number(dmyDateMatch[3]);
  } else {
    return Number.NaN;
  }
  const timestamp = new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

function getBookingMissedTime(booking) {
  const bookingStart = getBookingStartTime(booking);
  if (!Number.isFinite(bookingStart)) return Number.NaN;
  return bookingStart + BOOKING_SLOT_DURATION_MS + ADMIN_COMPLETE_GRACE_MS;
}

function compareBookingsByScheduleDesc(a, b) {
  const aTs = getBookingStartTime(a);
  const bTs = getBookingStartTime(b);
  const safeA = Number.isFinite(aTs) ? aTs : 0;
  const safeB = Number.isFinite(bTs) ? bTs : 0;
  if (safeB !== safeA) return safeB - safeA;
  return Number(b?.id || 0) - Number(a?.id || 0);
}

function getUserRescheduleEligibility(row, options = {}) {
  const booking = row?.booking || row;
  const enforceRescheduleLimit = options?.enforceRescheduleLimit !== false;
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'completed' || status === 'cancelled') {
    return { allowed: false, message: 'Completed or cancelled bookings cannot be rescheduled.' };
  }
  if (status === 'schedule_later') {
    return { allowed: true, message: '' };
  }
  const rescheduleCount = Number(booking?.rescheduleCount || 0);
  const hasUserRescheduleHistory = rescheduleCount >= 1;
  if (enforceRescheduleLimit && hasUserRescheduleHistory) {
    return { allowed: false, message: 'Reschedule limit reached. Further rescheduling can be done only by admin.' };
  }
  const slotStart = getBookingStartTime(booking);
  if (!Number.isFinite(slotStart)) {
    return { allowed: false, message: 'This booking slot is invalid for rescheduling.' };
  }
  const now = Date.now();
  if (now >= slotStart) {
    return { allowed: false, message: 'This session has already started or passed and cannot be rescheduled.' };
  }
  const cutoffMs = 12 * 60 * 60 * 1000;
  if (now > slotStart - cutoffMs) {
    return {
      allowed: false,
      message: 'You can only reschedule at least 12 hours before your session. Please contact admin now.',
    };
  }
  return { allowed: true, message: '' };
}

function isBookingMissed(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'missed') return true;
  if (status === 'completed' || status === 'cancelled' || status === 'schedule_later') return false;
  const missedAt = getBookingMissedTime(booking);
  return Number.isFinite(missedAt) && missedAt < Date.now();
}

function getDerivedBookingStatus(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (isBookingMissed(booking) && !['completed', 'cancelled', 'missed'].includes(status)) {
    return 'missed';
  }
  if (!['completed', 'cancelled', 'schedule_later'].includes(status) && isBookingRescheduled(booking)) {
    return 'rescheduled';
  }
  return status || 'pending';
}

function buildAdminUserSessionSummary(user) {
  const bookings = getAdminUserBookings(user?.id);
  const activeBookings = bookings.filter((booking) => String(booking?.status || '').toLowerCase() !== 'cancelled');
  const completed = activeBookings.filter((booking) => String(booking?.status || '').toLowerCase() === 'completed').length;
  const missed = activeBookings.filter(isBookingMissed).length;
  const remaining = activeBookings.filter((booking) => {
    const status = String(booking?.status || '').toLowerCase();
    return status !== 'completed' && !isBookingMissed(booking);
  }).length;

  return {
    bookings,
    total: activeBookings.length,
    completed,
    remaining,
    missed,
    memberSessions: activeBookings.filter(isAdminMemberSessionBooking).length,
    topUpSessions: activeBookings.filter(isAdminTopUpSessionBooking).length,
  };
}

function getMembershipPlanSessionAllowance(user) {
  const planId = String(user?.membershipPlan || '').trim();
  const peopleCount = Math.max(1, Number(user?.membershipPeopleCount || 1));
  const planSessionsById = {
    h2_single: 16,
    h2_two: 32,
    h2_four: 64,
    h2_add_person: 16,
  };
  const totalSessions = Number(planSessionsById[planId] || 0);
  if (!totalSessions) {
    return {
      planLabel: 'No active plan',
      totalSessions: 0,
      perUserSessions: 0,
    };
  }
  return {
    planLabel: getMembershipPlanDisplayName(planId),
    totalSessions,
    perUserSessions: Math.floor(totalSessions / peopleCount),
  };
}

function renderAdminUserCards() {
  if (!elements.adminUserCards || !elements.adminUserCardsEmpty) return;

  const users = getFilteredAdminUsers();
  elements.adminUserCards.innerHTML = '';

  if (!users.length) {
    elements.adminUserCardsEmpty.hidden = false;
    return;
  }

  elements.adminUserCardsEmpty.hidden = true;
  users.forEach((user) => {
    const summary = buildAdminUserSessionSummary(user);
    const membership = getMembershipPlanSessionAllowance(user);
    const completionPercent = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'admin-user-card';
    card.innerHTML = `
      <div class="admin-user-card-top">
        <span class="admin-user-card-avatar">${escapeHtml(getInitials(user?.name || 'User'))}</span>
        <span class="admin-user-card-tag">User #${escapeHtml(String(user?.id || '-'))}</span>
      </div>
      <div class="admin-user-card-main">
        <div class="admin-user-card-body">
          <h3>${escapeHtml(user?.name || 'Unnamed User')}</h3>
          <p>${escapeHtml(user?.email || user?.mobile || 'No contact info')}</p>
          <p class="admin-user-plan-copy">${escapeHtml(
            membership.totalSessions
              ? `${membership.planLabel} - ${membership.perUserSessions} member sessions per user`
              : membership.planLabel
          )}</p>
        </div>
        <div class="admin-user-donut-wrap">
          <div class="admin-user-donut" style="--donut-angle:${completionPercent}%;"><span>${escapeHtml(
            String(summary.completed)
          )}/${escapeHtml(String(summary.total))}</span></div>
          <small>Completed</small>
        </div>
      </div>
      <div class="admin-user-card-footer">
        <span><strong>${summary.memberSessions}</strong> member sessions</span>
        <span><strong>${summary.topUpSessions}</strong> top-up sessions</span>
      </div>
      <div class="admin-user-card-footer admin-user-card-footer--secondary">
        <span><strong>${summary.total}</strong> paid bookings</span>
        <span><strong>${summary.completed}</strong> completed</span>
      </div>
    `;
    card.addEventListener('click', () => {
      openAdminUserSessionDialog(user.id);
    });
    elements.adminUserCards.appendChild(card);
  });
}

function renderAdminUserSessionDialog() {
  if (
    !elements.adminUserSessionTitle ||
    !elements.adminUserSessionMeta ||
    !elements.adminUserSessionKpis ||
    !elements.adminUserSessionList ||
    !elements.adminUserSessionListEmpty
  ) {
    return;
  }

  const selectedUser = (Array.isArray(state.adminUsers) ? state.adminUsers : []).find(
    (user) => String(user?.id || '') === String(state.adminSelectedUserId || '')
  );

  if (!selectedUser) {
    elements.adminUserSessionTitle.textContent = 'Users Tracking';
    elements.adminUserSessionMeta.textContent = '';
    elements.adminUserSessionKpis.innerHTML = '';
    elements.adminUserSessionList.innerHTML = '';
    elements.adminUserSessionListEmpty.hidden = false;
    return;
  }

  const summary = buildAdminUserSessionSummary(selectedUser);
  elements.adminUserSessionTitle.textContent = selectedUser.name || 'Users Tracking';
  elements.adminUserSessionMeta.textContent = [selectedUser.email, selectedUser.mobile ? `ID ${selectedUser.id} • ${selectedUser.mobile}` : `ID ${selectedUser.id}`]
    .filter(Boolean)
    .join(' • ');

  const kpis = [
    { title: 'All Paid Bookings', value: summary.total, tone: 'total', filter: 'all' },
    { title: 'Member Sessions', value: summary.memberSessions, tone: 'member', filter: 'member' },
    { title: 'Top-up Sessions', value: summary.topUpSessions, tone: 'topup', filter: 'topup' },
    { title: 'Completed Sessions', value: summary.completed, tone: 'completed', filter: 'completed' },
    { title: 'Remaining Sessions', value: summary.remaining, tone: 'remaining', filter: 'remaining' },
    { title: 'Missed Sessions', value: summary.missed, tone: 'missed', filter: 'missed' },
  ];

  elements.adminUserSessionKpis.innerHTML = '';
  kpis.forEach((metric) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `admin-user-kpi-card tone-${metric.tone}`;
    card.classList.toggle('is-active', String(state.adminUserSessionFilter || 'all') === metric.filter);
    card.setAttribute('aria-pressed', String(String(state.adminUserSessionFilter || 'all') === metric.filter));
    card.innerHTML = `
      <span>${escapeHtml(metric.title)}</span>
      <strong>${escapeHtml(String(metric.value))}</strong>
    `;
    card.addEventListener('click', () => {
      state.adminUserSessionFilter = metric.filter;
      renderAdminUserSessionDialog();
    });
    elements.adminUserSessionKpis.appendChild(card);
  });

  elements.adminUserSessionList.innerHTML = '';
  const filteredBookings = getAdminUserSessionsByFilter(summary.bookings);
  if (!filteredBookings.length) {
    elements.adminUserSessionListEmpty.hidden = false;
    elements.adminUserSessionListEmpty.textContent =
      state.adminUserSessionFilter === 'all' ? 'No sessions found for this user.' : 'No sessions match this filter.';
    return;
  }

  elements.adminUserSessionListEmpty.hidden = true;
  [...filteredBookings]
    .sort((a, b) => `${b.bookingDate}T${b.bookingTime}`.localeCompare(`${a.bookingDate}T${a.bookingTime}`))
    .forEach((booking) => {
      const derivedStatus = getDerivedBookingStatus(booking);
      const sessionKind = getAdminSessionKindLabel(booking);
      const row = document.createElement('article');
      row.className = 'admin-user-session-row';
      row.innerHTML = `
        <div>
          <h4>${escapeHtml(booking?.serviceName || 'Session')}</h4>
          <p>${escapeHtml(formatAdminBookingDateTime(booking?.bookingDate, booking?.bookingTime).replace(/\n/g, ' • '))}</p>
        </div>
        <div class="admin-user-session-badges">
          <span class="status-chip session-${escapeHtml(String(sessionKind).toLowerCase().replace(/[^a-z0-9]+/g, '-'))}">${escapeHtml(
            sessionKind
          )}</span>
          <span class="status-chip status-${escapeHtml(derivedStatus)}">${escapeHtml(derivedStatus)}</span>
          <span class="status-chip payment-${escapeHtml(normalizePaymentStatusKey(booking?.paymentStatus))}">${escapeHtml(
            formatPaymentStatusLabel(booking?.paymentStatus)
          )}</span>
        </div>
      `;
      elements.adminUserSessionList.appendChild(row);
    });
}

function renderUserRows(bookings, membershipOrders = [], allBookings = bookings) {
  if (!elements.bookingTableBody || !elements.emptyState) return;
  elements.bookingTableBody.innerHTML = '';

  const displayRows = buildUserBookingRows(bookings, allBookings);
  const activeFilter = String(state.userBookingsFilter || 'all').trim().toLowerCase();
  const paidMembershipOrders = (Array.isArray(membershipOrders) ? membershipOrders : []).filter(
    (order) => String(order?.status || '').trim().toLowerCase() === 'paid'
  );
  const fallbackMembershipRows = !paidMembershipOrders.length && state.membership?.active && state.membership?.current
    ? [
        {
          orderId: `membership-active-${String(state.user?.id || '')}`,
          planId: state.membership.current.plan,
          peopleCount: Number(state.membership.current.peopleCount || 1),
          amountPaise: Number(state.membership.current.priceInr || 0) * 100,
          paidAt: state.membership.current.startedAt || state.membership.current.createdAt || '',
          status: 'paid',
        },
      ]
    : [];
  const membershipRows = activeFilter === 'schedule_later'
    ? []
    : paidMembershipOrders.length
      ? paidMembershipOrders
      : fallbackMembershipRows;
  if (!displayRows.length && !membershipRows.length) {
    elements.emptyState.hidden = false;
    return;
  }
  elements.emptyState.hidden = true;

  for (const row of displayRows) {
    const tr = document.createElement('tr');
    tr.appendChild(userBookingServiceCell(row, 'Service'));
    tr.appendChild(userBookingScheduleCell(row, 'Date & Time'));
    tr.appendChild(statusCell(row.status || 'pending', 'Status'));
    tr.appendChild(bookingAmountCell(row, 'Amount'));

    const actionCell = document.createElement('td');
    actionCell.dataset.label = 'Actions';
    const actions = document.createElement('div');
    actions.className = 'action-row';

    const rowStatus = String(row.status || '').toLowerCase();
    const canEdit = !['completed', 'cancelled'].includes(rowStatus);
    const rescheduleLabel = rowStatus === 'schedule_later' ? 'Schedule' : 'Reschedule';
    const rescheduleEligibility = getUserRescheduleEligibility(row);
    if (canShowBookingInvoice(row)) {
      actions.append(createActionButton('Invoice', () => openBookingInvoice(row.booking?.id || row.id)));
      actions.append(createActionButton('Download Invoice', () => downloadBookingInvoice(row.booking?.id || row.id)));
    }
    if (canEdit && row.isGroupedHydrogen) {
      const groupedRescheduleOptions = getGroupedHydrogenRescheduleOptions(row);
      const hasEligibleSession = groupedRescheduleOptions.some((item) => item.eligibility.allowed);
      if (hasEligibleSession) {
        actions.append(createActionButton(rescheduleLabel, () => handleUserRescheduleAction(row)));
      } else {
        const firstBlockedMessage = groupedRescheduleOptions.find((item) => !item.eligibility.allowed)?.eligibility?.message
          || 'No sessions are currently eligible for rescheduling.';
        actions.append(
          createActionButton(rescheduleLabel, () => {
            showNotice({ title: 'Unable to reschedule', body: firstBlockedMessage });
          })
        );
      }
    } else if (canEdit && rescheduleEligibility.allowed) {
      actions.append(createActionButton(rescheduleLabel, () => handleUserRescheduleAction(row)));
    } else if (canEdit && rescheduleEligibility.message) {
      actions.append(
        createActionButton(rescheduleLabel, () => {
          showNotice({ title: 'Unable to reschedule', body: rescheduleEligibility.message });
        })
      );
    }
    const rowNotesLower = String(row.booking?.notes || row.notes || '').toLowerCase();
    const isPaidBookingRow = String(row.paymentStatus || row.booking?.paymentStatus || '').trim().toLowerCase() === 'paid';
    const scheduleLaterAlreadyUsed = row.isGroupedHydrogen
      ? !getGroupedHydrogenScheduleLaterOptions(row).some((item) => item.allowed)
      : rowNotesLower.includes('moved to schedule later by user') || rowNotesLower.includes('moved to schedule later by admin');
    const isScheduleLaterSlotEligible = row.isGroupedHydrogen
      ? getGroupedHydrogenScheduleLaterOptions(row).some((item) => item.allowed)
      : getUserScheduleLaterEligibility(row.booking || row, { enforcePreviousUse: false }).allowed;
    if (isPaidBookingRow && !scheduleLaterAlreadyUsed && isScheduleLaterSlotEligible && !['cancelled', 'completed', 'schedule_later'].includes(rowStatus)) {
      actions.append(createActionButton('Schedule Later', () => handleScheduleLaterAction(row)));
    }

    actionCell.appendChild(actions);
    tr.appendChild(actionCell);
    elements.bookingTableBody.appendChild(tr);
  }

  for (const order of membershipRows) {
    const tr = document.createElement('tr');
    const peopleCount = Number(order?.peopleCount || 1);
    const planName = getMembershipPlanDisplayName(order?.planId);
    const serviceTitle = peopleCount > 1 ? `${planName} (${peopleCount} Members)` : planName;
    const amountInr = Number(order?.amountPaise || 0) / 100;
    const paidDate = order?.paidAt || order?.createdAt || '';

    const serviceCell = document.createElement('td');
    serviceCell.dataset.label = 'Service';
    serviceCell.textContent = `Membership • ${serviceTitle}`;
    tr.appendChild(serviceCell);

    const scheduleCell = document.createElement('td');
    scheduleCell.dataset.label = 'Date & Time';
    scheduleCell.textContent = paidDate ? `${formatDateOnly(paidDate)}\nPayment completed` : '-';
    tr.appendChild(scheduleCell);

    tr.appendChild(statusCell('completed', 'Status'));

    const amountCell = document.createElement('td');
    amountCell.dataset.label = 'Amount';
    amountCell.textContent = amountInr > 0 ? `Rs. ${amountInr.toLocaleString('en-IN')}` : 'Rs. 0';
    tr.appendChild(amountCell);

    const actionCell = document.createElement('td');
    actionCell.dataset.label = 'Actions';
    const actions = document.createElement('div');
    actions.className = 'action-row';
    actions.append(createActionButton('Invoice', () => openMembershipInvoice(order.orderId)));
    actions.append(createActionButton('Download Invoice', () => downloadMembershipInvoice(order.orderId)));
    actionCell.appendChild(actions);
    tr.appendChild(actionCell);

    elements.bookingTableBody.appendChild(tr);
  }
}

function cartAmountCell(row) {
  const td = document.createElement('td');
  td.dataset.label = 'Amount';
  let amountInr = 0;
  if (row.isGroupedHydrogen) {
    const payableHydrogenEntries = (row.hydrogenEntries || []).filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    const payableAddOnEntries = (row.addOnEntries || []).filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    amountInr = Number(getHydrogenGroupBreakdown(payableHydrogenEntries, payableAddOnEntries).totalAmountInr || 0);
  } else {
    amountInr = getBookingDisplayAmountInr(row.booking || { serviceName: row.serviceTitle });
  }
  td.textContent = amountInr > 0 ? formatGrossAmountWithGstLabel(amountInr) : 'Included';
  return td;
}

function getCartRowAmountLabel(row) {
  let amountInr = 0;
  if (row.isGroupedHydrogen) {
    const payableHydrogenEntries = (row.hydrogenEntries || []).filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    const payableAddOnEntries = (row.addOnEntries || []).filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    amountInr = Number(getHydrogenGroupBreakdown(payableHydrogenEntries, payableAddOnEntries).totalAmountInr || 0);
  } else {
    amountInr = getBookingDisplayAmountInr(row.booking || { serviceName: row.serviceTitle });
  }
  return amountInr > 0 ? formatGrossAmountWithGstLabel(amountInr) : 'Included';
}

function showCartRowDetails(row) {
  const serviceTitle = String(row?.serviceTitle || row?.serviceText || 'Service').trim();
  const scheduleText = Array.isArray(row?.scheduleLines) && row.scheduleLines.length
    ? row.scheduleLines.join('\n')
    : String(row?.dateTimeText || '-');
  const amountText = getCartRowAmountLabel(row);
  showNotice({
    title: 'Booking Details',
    body: `${serviceTitle}\n\n${scheduleText}\n\nAmount: ${amountText}`,
  });
}

function renderCartRows(cartBookings) {
  if (!elements.cartTableBody || !elements.cartEmptyState || !elements.cartMobileList) return;
  elements.cartTableBody.innerHTML = '';
  elements.cartMobileList.innerHTML = '';

  const displayRows = buildUserBookingRows(cartBookings, cartBookings);
  if (!displayRows.length) {
    elements.cartEmptyState.hidden = false;
    elements.cartMobileList.hidden = true;
    return;
  }

  elements.cartEmptyState.hidden = true;
  elements.cartMobileList.hidden = false;
  for (const row of displayRows) {
    const tr = document.createElement('tr');
    tr.appendChild(userBookingServiceCell(row));
    tr.appendChild(userBookingScheduleCell(row));
    tr.appendChild(cartAmountCell(row));

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'action-row';

    actions.append(createDangerButton('Remove', () => deleteBooking(row.booking)));
    actionCell.appendChild(actions);
    tr.appendChild(actionCell);

    elements.cartTableBody.appendChild(tr);

    const card = document.createElement('article');
    card.className = 'cart-mobile-card';
    const scheduleText = Array.isArray(row.scheduleLines) && row.scheduleLines.length
      ? row.scheduleLines.join(' • ')
      : (row.dateTimeText || '-');
    const amountText = getCartRowAmountLabel(row);
    card.innerHTML = `
      <div class="cart-mobile-card-head">
        <strong>${escapeHtml(row.serviceTitle || row.serviceText || 'Service')}</strong>
        <span>${escapeHtml(amountText)}</span>
      </div>
      <p>${escapeHtml(scheduleText)}</p>
    `;
    const mobileActions = document.createElement('div');
    mobileActions.className = 'cart-mobile-actions';
    mobileActions.appendChild(createActionButton('View Details', () => showCartRowDetails(row)));
    mobileActions.appendChild(createDangerButton('Remove', () => deleteBooking(row.booking)));
    card.appendChild(mobileActions);
    elements.cartMobileList.appendChild(card);
  }
}

function renderUserCheckoutSummary(bookings) {
  if (!elements.userCheckoutSummary || !elements.bookingsPayAllBtn) return;

  const summary = buildUserCartSummary(bookings);
  if (!summary.unitCount) {
    elements.userCheckoutSummary.hidden = true;
    elements.userCheckoutSummary.innerHTML = '';
    if (elements.userCouponEntry) elements.userCouponEntry.hidden = true;
    if (elements.userCouponCode) elements.userCouponCode.disabled = true;
    if (elements.userApplyCouponBtn) elements.userApplyCouponBtn.disabled = true;
    if (elements.userGeneralCoupons) elements.userGeneralCoupons.hidden = true;
    elements.bookingsPayAllBtn.hidden = true;
    elements.bookingsPayAllBtn.disabled = true;
    state.cartCouponPreview = null;
    renderCartCouponPreview();
    return;
  }

  const coupon = state.cartCouponPreview;
  const payableAmountInr = Number(coupon?.payableAmountInr || summary.payableAmountInr || summary.totalAmountInr || 0);
  const discountAmountInr = Number(coupon?.discountAmountInr || 0);
  const holdMinutes = summary.holdActive
    ? Number(summary.holdRemainingMinutes || state.bookingHoldMinutes || BOOKING_HOLD_MINUTES)
    : 0;
  const holdLine = summary.holdActive
    ? `<span class="user-hold-alert">Complete payment within ${holdMinutes} minute${holdMinutes === 1 ? '' : 's'} to keep this booking.</span>`
    : '';
  elements.userCheckoutSummary.hidden = false;
  if (elements.userCouponEntry) elements.userCouponEntry.hidden = false;
  if (elements.userCouponCode) elements.userCouponCode.disabled = false;
  if (elements.userApplyCouponBtn) elements.userApplyCouponBtn.disabled = false;
  elements.userCheckoutSummary.innerHTML = `
    <strong>${summary.unitCount} item${summary.unitCount === 1 ? '' : 's'} ready for one payment</strong>
    ${
      coupon
        ? `<span>Subtotal: Rs. ${Number(summary.subtotalAmountInr || summary.totalAmountInr || 0).toLocaleString('en-IN')}</span>
           <span>GST ${GST_RATE_PERCENT}%: Rs. ${Number(summary.gstAmountInr || 0).toLocaleString('en-IN')}</span>
           <span>Coupon Savings: -Rs. ${discountAmountInr.toLocaleString('en-IN')}</span>
           <span>Total payable: Rs. ${payableAmountInr.toLocaleString('en-IN')}</span>`
        : `<span>Subtotal: Rs. ${Number(summary.subtotalAmountInr || summary.totalAmountInr || 0).toLocaleString('en-IN')}</span>
           <span>GST ${GST_RATE_PERCENT}%: Rs. ${Number(summary.gstAmountInr || 0).toLocaleString('en-IN')}</span>
           <span>Total payable: Rs. ${Number(summary.payableAmountInr || summary.totalAmountInr || 0).toLocaleString('en-IN')}</span>`
    }
    ${holdLine}
  `;
  elements.bookingsPayAllBtn.hidden = false;
  elements.bookingsPayAllBtn.disabled = false;
  elements.bookingsPayAllBtn.textContent = `Pay Now`;
}

function buildHoldNotice(entries = []) {
  const normalized = Array.isArray(entries) ? entries : [];
  const activeEntries = normalized.filter((entry) => entry?.holdActive);
  if (activeEntries.length) {
    const minutes = Math.min(
      ...activeEntries
        .map((entry) => Number(entry?.holdRemainingMinutes || 0))
        .filter((value) => Number.isFinite(value) && value > 0)
    );
    const safeMinutes = minutes || Number(state.bookingHoldMinutes || BOOKING_HOLD_MINUTES) || BOOKING_HOLD_MINUTES;
    return {
      tone: 'hold',
      text: `On hold: complete payment within ${safeMinutes} minute${safeMinutes === 1 ? '' : 's'} to keep this booking.`,
    };
  }

  const expired = normalized.some((entry) => entry?.holdExpired);
  if (expired) {
    return { tone: 'expired', text: 'Hold expired. Please book this slot again.' };
  }

  return null;
}

function buildUserRescheduleMissNotice(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'completed' || status === 'cancelled' || status === 'schedule_later') return null;
  const eligibility = getUserRescheduleEligibility(booking);
  if (!eligibility.allowed) return null;
  return {
    tone: 'warning',
    text: 'If not rescheduled before slot start, this booking will be marked as missed.',
  };
}

function buildRescheduleDetailSection({ heading = '', history = null } = {}) {
  if (!history) return null;
  const currentSlot = formatDateTime(history.rescheduledDate, history.rescheduledTime);
  const previousSlot = formatDateTime(history.previousDate, history.previousTime);
  const lines = [
    { text: 'Current Slot', tone: 'reschedule-current-label' },
    { text: currentSlot, tone: 'reschedule-current-value' },
  ];
  if (previousSlot && previousSlot !== '-') {
    lines.push({ text: 'Previously', tone: 'reschedule-previous-label' });
    lines.push({ text: previousSlot, tone: 'reschedule-previous-value' });
  }
  return {
    title: heading || 'Session ↺ Rescheduled',
    lines,
  };
}

function buildUserBookingRows(bookings, allBookings = bookings) {
  const activeBookingFilter = String(state.userBookingsFilter || 'all').trim().toLowerCase();
  const includedEntryIds = new Set((Array.isArray(bookings) ? bookings : []).map((booking) => String(booking?.id || '')));
  const byGroup = new Map();
  for (const booking of allBookings) {
    const key = booking.bookingGroupId || `single_${booking.id}`;
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
    }
    byGroup.get(key).push(booking);
  }

  const includedKeys = new Set(
    bookings.map((booking) => booking.bookingGroupId || `single_${booking.id}`)
  );
  const rows = [];
  for (const [groupKey, entries] of byGroup.entries()) {
    if (!includedKeys.has(groupKey)) continue;
    const sortedEntries = [...entries].sort((a, b) =>
      `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`)
    );
    const includedEntries = sortedEntries.filter((entry) => includedEntryIds.has(String(entry?.id || '')));
    const hydrogenEntries = includedEntries.filter((entry) => getBookingCategory(entry.serviceName) === 'HYDROGEN SESSION');
    const addOnEntries = includedEntries.filter((entry) => getBookingCategory(entry.serviceName) === 'IV ADD-ON');
    const groupHydrogenEntries = [...entries]
      .filter((entry) => getBookingCategory(entry.serviceName) === 'HYDROGEN SESSION')
      .sort((a, b) => {
        const seqA = Number(a?.sessionSequence || a?.sessionNumber || 0);
        const seqB = Number(b?.sessionSequence || b?.sessionNumber || 0);
        if (seqA > 0 && seqB > 0 && seqA !== seqB) return seqA - seqB;
        const createdA = String(a?.createdAt || '').trim();
        const createdB = String(b?.createdAt || '').trim();
        if (createdA && createdB && createdA !== createdB) return createdA.localeCompare(createdB);
        return String(a?.id || '').localeCompare(String(b?.id || ''));
      });
    const groupAddOnEntries = [...entries]
      .filter((entry) => getBookingCategory(entry.serviceName) === 'IV ADD-ON')
      .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`));
    const pricingHydrogenEntries = groupHydrogenEntries.filter(
      (entry) => String(entry.status || '').toLowerCase() !== 'cancelled'
    );
    const pricingAddOnEntries = groupAddOnEntries.filter(
      (entry) => String(entry.status || '').toLowerCase() !== 'cancelled'
    );
    const hydrogenSequenceById = new Map(
      groupHydrogenEntries.map((entry, index) => [String(entry?.id || ''), index + 1])
    );
    const isGroupedHydrogen = Boolean(groupKey.startsWith('hydrogen_') || (sortedEntries[0]?.bookingGroupId && hydrogenEntries.length));

    if (!isGroupedHydrogen) {
      const booking = sortedEntries[0];
      const holdNotice = buildHoldNotice([booking]);
      const rescheduleMissNotice = buildUserRescheduleMissNotice(booking);
      const rescheduleHistory = getBookingRescheduleHistory(booking);
      const singleRescheduleSection = buildRescheduleDetailSection({
        heading: 'Session ↺ Rescheduled',
        history: rescheduleHistory,
      });
      rows.push({
        id: booking.id,
        booking,
        sortTime: getBookingStartTime(booking),
        isGroupedHydrogen: false,
        status: getDerivedBookingStatus(booking),
        paymentStatus: booking.paymentStatus || 'unpaid',
        amountInr: getBookingDisplayAmountInr(booking),
        serviceTitle: getServiceDisplayName(booking.serviceName),
        serviceMetaLines: [
          getBookingCategoryLabel(booking.serviceName),
          ...(holdNotice ? [holdNotice] : []),
          ...(rescheduleMissNotice ? [rescheduleMissNotice] : []),
        ],
        scheduleLines: [formatDateTime(booking.bookingDate, booking.bookingTime)],
        detailSections: singleRescheduleSection ? [singleRescheduleSection] : [],
        serviceText: getServiceDisplayName(booking.serviceName),
        dateTimeText: formatDateTime(booking.bookingDate, booking.bookingTime),
      });
      continue;
    }

    const booking =
      includedEntries.find(
        (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
      ) ||
      hydrogenEntries[0] ||
      includedEntries[0] ||
      sortedEntries[0];
    const baseServiceName = pricingHydrogenEntries[0]?.serviceName || hydrogenEntries[0]?.serviceName || booking.serviceName || 'Hydrogen Package';
    const packageSessionCount = Math.max(1, Number(pricingHydrogenEntries.length || hydrogenEntries.length || 0));
    const isAdditionalHydrogenPackage = pricingHydrogenEntries.some((entry) => {
      const paymentReference = String(entry?.paymentReference || '').trim().toLowerCase();
      return paymentReference === 'buy_extra' || Number(entry?.isTopUpSession || 0) === 1;
    });
    const displayPackageName =
      isAdditionalHydrogenPackage
        ? 'H2 Additional Sessions'
        : packageSessionCount > 1
          ? 'Hydrogen Package'
          : baseServiceName;
    const payableHydrogenEntries = hydrogenEntries.filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    const displayAddOnEntries = pricingAddOnEntries;
    const payableAddOnEntries = displayAddOnEntries.filter(
      (entry) => entry.status !== 'cancelled' && String(entry.paymentStatus || 'unpaid').toLowerCase() !== 'paid'
    );
    const breakdown = getHydrogenGroupBreakdown(pricingHydrogenEntries, pricingAddOnEntries);
    const payableBreakdown = getHydrogenGroupBreakdown(payableHydrogenEntries, payableAddOnEntries);
    const addOnDetails = displayAddOnEntries.map((entry) => {
      const linkedHydrogen = groupHydrogenEntries.find(
        (slot) => slot.bookingDate === entry.bookingDate && slot.bookingTime === entry.bookingTime
      );
      const linkedSequence = linkedHydrogen ? Number(hydrogenSequenceById.get(String(linkedHydrogen?.id || '')) || 0) : 0;
      return linkedSequence > 0 ? `${entry.serviceName} (Hydrogen Session ${linkedSequence})` : entry.serviceName;
    });
    const holdNotice = buildHoldNotice(includedEntries);
    const rescheduleMissNotice = buildUserRescheduleMissNotice(booking);
    const latestIncludedEntry = [...includedEntries].sort(compareBookingsByScheduleDesc)[0] || booking;
    const earliestIncludedEntry = includedEntries[0] || booking;
    const rowSortEntry = activeBookingFilter === 'upcoming' ? earliestIncludedEntry : latestIncludedEntry;

    const slotLines = hydrogenEntries.map((entry) => {
      const sequence = Number(hydrogenSequenceById.get(String(entry?.id || '')) || 0);
      const label = sequence > 0 ? `S${sequence}` : 'Session';
      return `${label}: ${formatDateTime(entry.bookingDate, entry.bookingTime)}`;
    });
    if (displayAddOnEntries.length) {
      displayAddOnEntries.forEach((entry) => {
        slotLines.push(`Add-on: ${entry.serviceName} with ${formatDateTime(entry.bookingDate, entry.bookingTime)}`);
      });
    }
    const rescheduleSections = [];
    [...groupHydrogenEntries, ...displayAddOnEntries].forEach((entry) => {
      const history = getBookingRescheduleHistory(entry);
      if (!history) return;
      const sequence = Number(hydrogenSequenceById.get(String(entry?.id || '')) || 0);
      const sectionHeading = getBookingCategory(entry.serviceName) === 'IV ADD-ON'
        ? `${entry.serviceName} ↺ Rescheduled`
        : sequence > 0
          ? `Session ${sequence} ↺ Rescheduled`
          : 'Session ↺ Rescheduled';
      const section = buildRescheduleDetailSection({
        heading: sectionHeading,
        history,
      });
      if (section) rescheduleSections.push(section);
    });

    rows.push({
      id: booking.id,
      booking,
      sortTime: getBookingStartTime(rowSortEntry),
      bookingGroupId: booking.bookingGroupId || '',
      baseServiceName,
      extraSessions: Math.max(0, hydrogenEntries.length - getHydrogenSessionCountFromServiceName(baseServiceName)),
      hydrogenEntries,
      addOnEntries: displayAddOnEntries,
      isGroupedHydrogen: true,
      status: summarizeGroupStatus(includedEntries),
      paymentStatus: summarizeGroupPaymentStatus(includedEntries),
      amountInr: Number(breakdown.totalAmountInr || 0),
      serviceTitle: 'Hydrogen Package Booking',
      serviceMetaLines: [
        displayPackageName,
        ...(addOnDetails.length ? [`Add-on: ${addOnDetails.join(', ')}`] : []),
        ...(holdNotice ? [holdNotice] : []),
        ...(rescheduleMissNotice ? [rescheduleMissNotice] : []),
      ],
      scheduleLines: [hydrogenEntries[0] ? formatDateTime(hydrogenEntries[0].bookingDate, hydrogenEntries[0].bookingTime) : '-'],
      detailSections: [
        { title: 'Hydrogen Sessions', lines: slotLines },
        ...rescheduleSections,
        ...(addOnDetails.length ? [{ title: 'Add-on', lines: addOnDetails }] : []),
        ...(breakdown.totalAmountInr > 0
        ? [
              {
                title: 'Payment',
                lines: [
                  `Subtotal: Rs. ${Number(breakdown.subtotalAmountInr || 0).toLocaleString('en-IN')}`,
                  `GST ${GST_RATE_PERCENT}%: Rs. ${Number(breakdown.gstAmountInr || 0).toLocaleString('en-IN')}`,
                  `Total: Rs. ${Number(payableBreakdown.totalAmountInr || breakdown.totalAmountInr || 0).toLocaleString('en-IN')}`,
                  ...(payableBreakdown.totalAmountInr > 0
                    ? [`Payable now: Rs. ${Number(payableBreakdown.totalAmountInr).toLocaleString('en-IN')}`]
                    : []),
                ],
              },
            ]
          : []),
      ],
      serviceText: ['Hydrogen Package Booking', displayPackageName].join('\n'),
      dateTimeText: slotLines.join('\n'),
    });
  }

  return rows.sort((a, b) => {
    const aTs = Number.isFinite(a?.sortTime) ? a.sortTime : 0;
    const bTs = Number.isFinite(b?.sortTime) ? b.sortTime : 0;
    if (activeBookingFilter === 'upcoming') {
      if (aTs !== bTs) return aTs - bTs;
      return Number(a?.id || 0) - Number(b?.id || 0);
    }
    if (bTs !== aTs) return bTs - aTs;
    return Number(b?.id || 0) - Number(a?.id || 0);
  });
}

function getBookingGroupKey(booking) {
  if (!booking) return '';
  return booking.bookingGroupId || `single_${booking.id}`;
}

function isBookingPaid(booking) {
  return String(booking?.paymentStatus || 'unpaid')
    .trim()
    .toLowerCase() === 'paid';
}

function getUserCartPayableBookings(bookings = state.bookings) {
  return (Array.isArray(bookings) ? bookings : []).filter((booking) => {
    if (String(booking.status || '').toLowerCase() === 'cancelled') return false;
    if (isBookingPaid(booking)) return false;
    if (booking.holdExpired) return false;
    const service = getServiceCatalogEntry(booking.serviceName);
    return !service?.membershipOnly;
  });
}

function getUserCartGroupKeys(bookings = state.bookings) {
  return new Set(
    (Array.isArray(bookings) ? bookings : [])
      .filter((booking) => {
        if (String(booking?.status || '').toLowerCase() === 'cancelled') return false;
        if (booking?.holdExpired) return false;
        return !isBookingPaid(booking);
      })
      .map((booking) => getBookingGroupKey(booking))
      .filter(Boolean)
  );
}

function getUserCartDisplayBookings(bookings = state.bookings) {
  const keys = getUserCartGroupKeys(bookings);
  if (!keys.size) return [];
  return (Array.isArray(bookings) ? bookings : []).filter((booking) => keys.has(getBookingGroupKey(booking)));
}

function getUserHistoryBookings(bookings = state.bookings) {
  const keys = getUserCartGroupKeys(bookings);
  return (Array.isArray(bookings) ? bookings : []).filter(
    (booking) => !keys.has(getBookingGroupKey(booking)) && isBookingPaid(booking)
  );
}

function getUserCartUnitCount(bookings = state.bookings) {
  const cartDisplayBookings = getUserCartDisplayBookings(bookings);
  if (!cartDisplayBookings.length) return 0;
  return buildUserBookingRows(cartDisplayBookings, cartDisplayBookings).length;
}

function buildUserCartSummary(bookings = state.bookings) {
  const payableBookings = getUserCartPayableBookings(bookings);

  const rows = buildUserBookingRows(payableBookings, payableBookings);
  let totalAmountInr = 0;
  for (const row of rows) {
    if (row.isGroupedHydrogen) {
      totalAmountInr += Number(getHydrogenGroupBreakdown(row.hydrogenEntries || [], row.addOnEntries || []).totalAmountInr || 0);
    } else {
      totalAmountInr += getBookingDisplayAmountInr(row.booking || { serviceName: row.serviceTitle });
    }
  }
  const payableBreakdown = getGstBreakdownInr(totalAmountInr, { fromGross: true });

  const holdActiveEntries = payableBookings.filter((booking) => booking.holdActive);
  const holdRemainingMinutes = holdActiveEntries.length
    ? Math.min(
        ...holdActiveEntries
          .map((booking) => Number(booking.holdRemainingMinutes || 0))
          .filter((value) => Number.isFinite(value) && value > 0)
      )
    : 0;

  return {
    unitCount: rows.length,
    bookingCount: payableBookings.length,
    totalAmountInr,
    subtotalAmountInr: payableBreakdown.subtotalAmountInr,
    gstAmountInr: payableBreakdown.gstAmountInr,
    payableAmountInr: payableBreakdown.totalAmountInr,
    holdActive: holdActiveEntries.length > 0,
    holdRemainingMinutes,
  };
}

function renderAdminPaymentLinkAnalytics() {
  if (!elements.adminPaymentLinkAnalytics) return;
  const analytics = state.adminPaymentLinkAnalytics || null;
  if (!analytics) {
    elements.adminPaymentLinkAnalytics.textContent = '';
    if (elements.adminPaymentLinkFunnel) {
      elements.adminPaymentLinkFunnel.hidden = true;
      elements.adminPaymentLinkFunnel.innerHTML = '';
    }
    return;
  }
  const emailed = Number(analytics.emailedBookings || 0);
  if (!emailed) {
    elements.adminPaymentLinkAnalytics.textContent = 'Payment-link email analytics: no emailed bookings yet.';
    if (elements.adminPaymentLinkFunnel) {
      elements.adminPaymentLinkFunnel.hidden = true;
      elements.adminPaymentLinkFunnel.innerHTML = '';
    }
    return;
  }
  const pct = (value) => `${Math.round((Number(value || 0) / emailed) * 100)}%`;
  const rangeLabel =
    analytics.startDate || analytics.endDate
      ? ` [${analytics.startDate || 'start'} to ${analytics.endDate || 'today'}]`
      : '';
  elements.adminPaymentLinkAnalytics.textContent =
    `Payment-link analytics${rangeLabel}: ` +
    `Emailed ${emailed}, Delivered ${analytics.delivered}/${emailed} (${pct(analytics.delivered)}), ` +
    `Opened ${analytics.opened}/${emailed} (${pct(analytics.opened)}), ` +
    `Clicked ${analytics.clicked}/${emailed} (${pct(analytics.clicked)}), ` +
    `Converted ${analytics.convertedPaid}/${emailed} (${pct(analytics.convertedPaid)}), ` +
    `Bounced ${analytics.bounced}, Deferred ${analytics.deferred}, Spam reports ${analytics.spamreport}.`;

  if (elements.adminPaymentLinkFunnel) {
    const stages = [
      { label: 'Emailed', value: emailed },
      { label: 'Delivered', value: Number(analytics.delivered || 0) },
      { label: 'Opened', value: Number(analytics.opened || 0) },
      { label: 'Clicked', value: Number(analytics.clicked || 0) },
      { label: 'Paid', value: Number(analytics.convertedPaid || 0) },
    ];
    elements.adminPaymentLinkFunnel.innerHTML = '';
    stages.forEach((stage) => {
      const widthPct = emailed > 0 ? Math.max(0, Math.min(100, Math.round((stage.value / emailed) * 100))) : 0;
      const row = document.createElement('div');
      row.className = 'admin-email-funnel-row';
      row.innerHTML = `
        <span class="admin-email-funnel-label">${escapeHtml(stage.label)}</span>
        <div class="admin-email-funnel-track">
          <span class="admin-email-funnel-fill" style="width:${widthPct}%"></span>
        </div>
        <span class="admin-email-funnel-value">${stage.value} (${widthPct}%)</span>
      `;
      elements.adminPaymentLinkFunnel.appendChild(row);
    });
    elements.adminPaymentLinkFunnel.hidden = false;
  }
}

function syncAdminEmailAnalyticsFilterInputs() {
  if (elements.adminEmailAnalyticsStartDate) {
    const nextStart = String(state.adminEmailAnalyticsFilters?.startDate || '');
    if (elements.adminEmailAnalyticsStartDate.value !== nextStart) {
      elements.adminEmailAnalyticsStartDate.value = nextStart;
    }
  }
  if (elements.adminEmailAnalyticsEndDate) {
    const nextEnd = String(state.adminEmailAnalyticsFilters?.endDate || '');
    if (elements.adminEmailAnalyticsEndDate.value !== nextEnd) {
      elements.adminEmailAnalyticsEndDate.value = nextEnd;
    }
  }
}

function exportPaymentLinkAnalyticsCsv() {
  const rows = Array.isArray(state.adminPaymentLinkAnalyticsRows) ? state.adminPaymentLinkAnalyticsRows : [];
  if (!rows.length) {
    showNotice({ title: 'Notice', type: 'info', body: 'No analytics rows available to export.' });
    return;
  }
  const headers = [
    'booking_id',
    'emailed_at',
    'paid_at',
    'paid',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'deferred',
    'spam_report',
  ];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const values = [
      Number(row.bookingId || 0),
      String(row.emailedAt || ''),
      String(row.paidAt || ''),
      row.paid ? '1' : '0',
      row.delivered ? '1' : '0',
      row.opened ? '1' : '0',
      row.clicked ? '1' : '0',
      row.bounced ? '1' : '0',
      row.deferred ? '1' : '0',
      row.spamreport ? '1' : '0',
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);
    csvRows.push(values.join(','));
  }
  const csvText = csvRows.join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `payment-link-analytics-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function resendPaymentLinkFromTimeline() {
  const bookingId = Number(elements.bookingEmailTimelineBookingId?.value || 0);
  if (!bookingId) {
    showNotice({ title: 'Notice', type: 'info', body: 'Select a booking first.' });
    return;
  }
  const booking = (state.bookings || []).find((entry) => Number(entry?.id) === bookingId);
  if (!booking) {
    showNotice({ title: 'Error', type: 'error', body: 'Booking details are not available.' });
    return;
  }
  await resendPaymentLinkForBooking(booking);
  await fetchBookingEmailTimeline(bookingId);
}

function renderAdminPaymentLinkAnalytics() {
  if (!elements.adminPaymentLinkAnalytics) return;
  const analytics = state.adminPaymentLinkAnalytics || null;
  if (!analytics) {
    elements.adminPaymentLinkAnalytics.textContent = '';
    if (elements.adminPaymentLinkFunnel) {
      elements.adminPaymentLinkFunnel.hidden = true;
      elements.adminPaymentLinkFunnel.innerHTML = '';
    }
    return;
  }
  const emailed = Number(analytics.emailedBookings || 0);
  if (!emailed) {
    elements.adminPaymentLinkAnalytics.textContent = 'Payment-link email analytics: no emailed bookings yet.';
    if (elements.adminPaymentLinkFunnel) {
      elements.adminPaymentLinkFunnel.hidden = true;
      elements.adminPaymentLinkFunnel.innerHTML = '';
    }
    return;
  }
  const pct = (value) => `${Math.round((Number(value || 0) / emailed) * 100)}%`;
  const rangeLabel =
    analytics.startDate || analytics.endDate
      ? ` [${analytics.startDate || 'start'} to ${analytics.endDate || 'today'}]`
      : '';
  elements.adminPaymentLinkAnalytics.textContent =
    `Payment-link analytics${rangeLabel}: ` +
    `Emailed ${emailed}, Delivered ${analytics.delivered}/${emailed} (${pct(analytics.delivered)}), ` +
    `Opened ${analytics.opened}/${emailed} (${pct(analytics.opened)}), ` +
    `Clicked ${analytics.clicked}/${emailed} (${pct(analytics.clicked)}), ` +
    `Converted ${analytics.convertedPaid}/${emailed} (${pct(analytics.convertedPaid)}), ` +
    `Bounced ${analytics.bounced}, Deferred ${analytics.deferred}, Spam reports ${analytics.spamreport}.`;

  if (elements.adminPaymentLinkFunnel) {
    const stages = [
      { label: 'Emailed', value: emailed },
      { label: 'Delivered', value: Number(analytics.delivered || 0) },
      { label: 'Opened', value: Number(analytics.opened || 0) },
      { label: 'Clicked', value: Number(analytics.clicked || 0) },
      { label: 'Paid', value: Number(analytics.convertedPaid || 0) },
    ];
    elements.adminPaymentLinkFunnel.innerHTML = '';
    stages.forEach((stage) => {
      const widthPct = emailed > 0 ? Math.max(0, Math.min(100, Math.round((stage.value / emailed) * 100))) : 0;
      const row = document.createElement('div');
      row.className = 'admin-email-funnel-row';
      row.innerHTML = `
        <span class="admin-email-funnel-label">${escapeHtml(stage.label)}</span>
        <div class="admin-email-funnel-track">
          <span class="admin-email-funnel-fill" style="width:${widthPct}%"></span>
        </div>
        <span class="admin-email-funnel-value">${stage.value} (${widthPct}%)</span>
      `;
      elements.adminPaymentLinkFunnel.appendChild(row);
    });
    elements.adminPaymentLinkFunnel.hidden = false;
  }
}

function syncAdminEmailAnalyticsFilterInputs() {
  if (elements.adminEmailAnalyticsStartDate) {
    const nextStart = String(state.adminEmailAnalyticsFilters?.startDate || '');
    if (elements.adminEmailAnalyticsStartDate.value !== nextStart) {
      elements.adminEmailAnalyticsStartDate.value = nextStart;
    }
  }
  if (elements.adminEmailAnalyticsEndDate) {
    const nextEnd = String(state.adminEmailAnalyticsFilters?.endDate || '');
    if (elements.adminEmailAnalyticsEndDate.value !== nextEnd) {
      elements.adminEmailAnalyticsEndDate.value = nextEnd;
    }
  }
}

function exportPaymentLinkAnalyticsCsv() {
  const rows = Array.isArray(state.adminPaymentLinkAnalyticsRows) ? state.adminPaymentLinkAnalyticsRows : [];
  if (!rows.length) {
    alert('No analytics rows available to export.');
    return;
  }
  const headers = [
    'booking_id',
    'emailed_at',
    'paid_at',
    'paid',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'deferred',
    'spam_report',
  ];
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    const values = [
      Number(row.bookingId || 0),
      String(row.emailedAt || ''),
      String(row.paidAt || ''),
      row.paid ? '1' : '0',
      row.delivered ? '1' : '0',
      row.opened ? '1' : '0',
      row.clicked ? '1' : '0',
      row.bounced ? '1' : '0',
      row.deferred ? '1' : '0',
      row.spamreport ? '1' : '0',
    ].map((value) => `"${String(value).replaceAll('"', '""')}"`);
    csvRows.push(values.join(','));
  }
  const csvText = csvRows.join('\n');
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `payment-link-analytics-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function resendPaymentLinkFromTimeline() {
  const bookingId = Number(elements.bookingEmailTimelineBookingId?.value || 0);
  if (!bookingId) {
    alert('Select a booking first.');
    return;
  }
  const booking = (state.bookings || []).find((entry) => Number(entry?.id) === bookingId);
  if (!booking) {
    alert('Booking details are not available.');
    return;
  }
  await resendPaymentLinkForBooking(booking);
  await fetchBookingEmailTimeline(bookingId);
}

function canResendBookingPaymentLink(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  const paymentStatus = String(booking?.paymentStatus || 'unpaid').trim().toLowerCase();
  const recipientEmail = String(booking?.paymentLinkRecipientEmail || booking?.clientEmail || '').trim();
  return paymentStatus !== 'paid' && !['completed', 'cancelled'].includes(status) && isValidEmail(recipientEmail);
}

async function resendPaymentLinkForBooking(booking) {
  const bookingId = Number(booking?.id || 0);
  if (!Number.isInteger(bookingId)) {
    showNotice({ title: 'Error', type: 'error', body: 'Booking details are not available.' });
    return;
  }
  const recipientEmail = String(booking?.paymentLinkRecipientEmail || booking?.clientEmail || '').trim().toLowerCase();
  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    showNotice({ title: 'Error', type: 'error', body: 'Valid recipient email not found for this booking.' });
    return;
  }
  const paymentLinkResult = await api(`/api/bookings/${bookingId}/payment-link`);
  const fallbackLink = String(paymentLinkResult?.paymentLinkUrl || '').trim();
  await sendPaymentLinkViaEmail(bookingId, recipientEmail, fallbackLink, String(booking?.clientMobile || '').trim());
}

function renderCartButtonState() {
  if (!elements.cartBtn || !elements.cartCount) return;
  const isGuest = Boolean(state.isGuestUser && !state.user);
  const isUser = state.user?.role === 'user';
  const needsPostLoginChoice = isUser && !state.postLoginChoice && !isCurrentUserMembershipActive();
  if ((!isUser && !isGuest) || needsPostLoginChoice) {
    elements.cartBtn.hidden = true;
    elements.cartCount.hidden = true;
    elements.cartBtn.classList.remove('has-items');
    elements.cartBtn.classList.remove('is-active');
    return;
  }

  const count = getUserCartUnitCount(isGuest ? getGuestCartBookings() : state.bookings || []);
  elements.cartBtn.hidden = false;
  elements.cartBtn.classList.toggle('has-items', count > 0);
  elements.cartBtn.classList.toggle('is-active', (state.activeUserTab || 'services') === 'cart');
  if (count > 0) {
    elements.cartCount.hidden = false;
    elements.cartCount.textContent = count > 99 ? '99+' : String(count);
  } else {
    elements.cartCount.hidden = true;
    elements.cartCount.textContent = '0';
  }
  elements.cartBtn.setAttribute('aria-label', count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart');
}

function renderAdminRows(bookings) {
  elements.adminBookingTableBody.innerHTML = '';

  if (bookings.length === 0) {
    elements.adminEmptyState.hidden = false;
    return;
  }

  elements.adminEmptyState.hidden = true;

  for (const booking of bookings) {
    const derivedStatus = getDerivedBookingStatus(booking);
    const tr = document.createElement('tr');
    tr.appendChild(multilineCell(`${booking.clientName}\n${booking.clientMobile || '-'}`));
    tr.appendChild(cell(booking.serviceName));
    tr.appendChild(multilineCell(formatAdminBookingDateTime(booking.bookingDate, booking.bookingTime)));
    tr.appendChild(cell(formatBookingCreatedAtIndia(booking.createdAt)));
    tr.appendChild(statusCell(derivedStatus));
    tr.appendChild(paymentCell(booking));
    const emailStatus = String(booking.paymentLinkEmailStatus || '').trim().toLowerCase();
    const emailRecipient = String(booking.paymentLinkRecipientEmail || '').trim();
    const emailSentAt = booking.paymentLinkEmailedAt ? formatDateOnly(booking.paymentLinkEmailedAt) : '';
    const emailError = String(booking.paymentLinkEmailError || '').trim();
    const deliveryStatus = String(booking.paymentLinkDeliveryStatus || '').trim().toLowerCase();
    const deliveryDetail = String(booking.paymentLinkDeliveryDetail || '').trim();
    const deliveryEventAt = booking.paymentLinkEmailEventAt ? formatDateOnly(booking.paymentLinkEmailEventAt) : '';
    let emailCellText = 'Not sent';
    if (emailStatus === 'sent') {
      const finalLabel = deliveryStatus ? `SENT • ${deliveryStatus.toUpperCase()}` : 'SENT';
      emailCellText =
        `${finalLabel}` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${emailSentAt ? `\nRequested: ${emailSentAt}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailStatus === 'failed') {
      const failDetail = deliveryStatus && !emailError ? deliveryStatus : emailError;
      emailCellText =
        `FAILED` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${failDetail ? `\n${failDetail}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail && deliveryDetail !== failDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailRecipient) {
      emailCellText = `Pending\n${emailRecipient}`;
    }
    tr.appendChild(multilineCell(emailCellText));

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'action-row';

    const bookingPaid = String(booking.paymentStatus || 'unpaid').toLowerCase() === 'paid';
    if (!bookingPaid && booking.status !== 'cancelled') {
      actions.append(createActionButton('Paid in Cash', () => markBookingPaidInCash(booking.id)));
      actions.append(createActionButton('Copy Payment Link', () => copyBookingPaymentLink(booking.id)));
      if (canResendBookingPaymentLink(booking)) {
        actions.append(createActionButton('Resend Payment Link', () => resendPaymentLinkForBooking(booking)));
      }
    }
    if (canShowBookingInvoice(booking)) {
      actions.append(createActionButton('Invoice', () => openBookingInvoice(booking.id)));
      actions.append(createActionButton('Download Invoice', () => downloadBookingInvoice(booking.id)));
    }
    if (
      String(booking.paymentStatus || '').trim().toLowerCase() === 'paid' &&
      !['completed', 'cancelled'].includes(String(booking.status || '').trim().toLowerCase())
    ) {
      actions.append(
        createActionButton(isAdminRescheduledBooking(booking) ? 'View Reschedule' : 'Reschedule', () =>
          openAdminRescheduleForBooking(booking)
        )
      );
    }

    if (getAdminScheduleLaterEligibility(booking).allowed) {
      actions.append(createActionButton('Schedule Later', () => handleAdminScheduleLaterAction(booking)));
    }

    actions.append(
      createActionButton('Confirm', () => changeStatus(booking.id, 'confirmed')),
      createActionButton('Cancel', () => changeStatus(booking.id, 'cancelled'))
    );
    actions.append(createActionButton('Notes', () => openBookingNotesDialog(booking.id)));

    actionCell.appendChild(actions);
    tr.appendChild(actionCell);
    elements.adminBookingTableBody.appendChild(tr);
  }
}

function renderAdminMembershipOrders() {
  if (!elements.adminMembershipOrdersList || !elements.adminMembershipEmptyState) return;

  elements.adminMembershipOrdersList.innerHTML = '';
  const paidOrders = getFilteredAdminMembershipOrders();
  if (!paidOrders.length) {
    elements.adminMembershipEmptyState.hidden = false;
    return;
  }

  elements.adminMembershipEmptyState.hidden = true;
  
  // Sort by most recent first
  const sorted = [...paidOrders].sort((a, b) => {
    const dateA = new Date(a.paidAt || a.createdAt || 0).getTime();
    const dateB = new Date(b.paidAt || b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  for (const order of sorted) {
    const circle = document.createElement('button');
    circle.type = 'button';
    circle.className = 'admin-membership-circle';
    circle.innerHTML = `
      <div class="admin-membership-circle-name">${escapeHtml(order.userName || 'User')}</div>
      <div class="admin-membership-circle-id">ID: ${escapeHtml(String(order.userId || '-').slice(0, 8))}</div>
    `;
    circle.addEventListener('click', () => {
      openMembershipDetailsModal(order);
    });
    elements.adminMembershipOrdersList.appendChild(circle);
  }
}

function renderAdminRescheduleQueue() {
  if (!elements.adminRescheduleList || !elements.adminRescheduleEmptyState) return;

  const viewMode = getAdminRescheduleViewMode();
  const isRescheduledView = viewMode === 'rescheduled';
  const isScheduleLaterView = viewMode === 'schedule_later';
  if (elements.adminRescheduleDate) {
    elements.adminRescheduleDate.value = String(state.adminRescheduleDateFilter || '').trim();
  }
  if (elements.adminRescheduleViewToggleBtn) {
    elements.adminRescheduleViewToggleBtn.textContent = isRescheduledView ? 'Reschedule Queue' : 'Rescheduled';
  }
  renderAdminRescheduleSlotFilters();

  const bookings = getFilteredAdminRescheduleBookings(state.bookings);
  elements.adminRescheduleList.innerHTML = '';
  if (!bookings.length) {
    elements.adminRescheduleEmptyState.hidden = false;
    elements.adminRescheduleEmptyState.textContent = isRescheduledView
      ? 'No rescheduled bookings found for this filter.'
      : isScheduleLaterView
        ? 'No Schedule Later sessions found for this filter.'
      : state.adminRescheduleDateFilter
        ? 'No eligible bookings found for this date and slot filter.'
        : 'Choose a date or search to find eligible bookings.';
    return;
  }

  elements.adminRescheduleEmptyState.hidden = true;
  for (const booking of bookings) {
    const id = String(booking.id || '');
    const canReschedule = isAdminRescheduleEligible(booking);
    const scheduleLaterEligibility = getAdminScheduleLaterEligibility(booking);
    const wasRescheduled = isAdminRescheduledBooking(booking);
    const history = getAdminRescheduleHistory(booking);
    const selection = getAdminRescheduleSelection(booking);
    const expiresAt = getRescheduleWindowExpiresAt(booking);
    const slots = getAvailableAdminRescheduleSlots(booking);
    const availabilityKey = getAdminRescheduleAvailabilityKey(id, selection.bookingDate, selection.category);
    const hasCheckedAvailability = Boolean(state.adminRescheduleAvailability?.[availabilityKey]);
    const isLoading = Boolean(state.adminRescheduleLoading?.[id]);
    const otpRequested = Boolean(state.adminRescheduleOtpRequested?.[id]);

    const card = document.createElement('article');
    card.className = 'admin-reschedule-card';
    card.innerHTML = `
      <div class="admin-reschedule-card-main">
        <h3>${escapeHtml(booking.clientName || 'User')}</h3>
        <p>${escapeHtml([booking.clientMobile, booking.clientEmail].filter(Boolean).join(' • ') || '-')}</p>
        <p><strong>${escapeHtml(booking.serviceName || 'Session')}</strong></p>
        ${
          isRescheduledView
            ? `<p>Actual booked slot: ${escapeHtml(formatDateTime(history.originalDate, history.originalTime))}</p>
               <p>Rescheduled slot: ${escapeHtml(formatDateTime(history.rescheduledDate, history.rescheduledTime))}</p>`
            : `<p>${isBookingMissed(booking) ? 'Missed' : 'Current slot'}: ${escapeHtml(formatDateTime(booking.bookingDate, booking.bookingTime))}</p>`
        }
        <p>Payment: ${escapeHtml(formatPaymentStatusLabel(booking.paymentStatus))}</p>
        ${
          canReschedule && !isRescheduledView
            ? String(booking?.status || '').trim().toLowerCase() === 'schedule_later'
              ? '<p>Waiting in Schedule Later. Choose a new slot when ready.</p>'
              : isBookingMissed(booking)
              ? `<p>Reschedule by: ${Number.isFinite(expiresAt) ? escapeHtml(new Date(expiresAt).toLocaleString()) : '-'}</p>`
              : '<p>Reschedule allowed until 15 minutes after the slot starts.</p>'
            : `<p>Status: ${wasRescheduled ? 'Already rescheduled' : escapeHtml(getDerivedBookingStatus(booking))}</p>`
        }
      </div>
      ${
        canReschedule && !isRescheduledView
          ? `<div class="admin-reschedule-controls">
              <label>
                New date
                <input class="admin-reschedule-date" type="date" min="${getTodayIsoDate()}" max="${getMaxBookingIsoDate()}" value="${escapeHtml(selection.bookingDate)}" />
              </label>
              <button class="btn btn-secondary admin-reschedule-check" type="button">${isLoading ? 'Checking...' : 'Check Slots'}</button>
              <label>
                Available slot
                <select class="admin-reschedule-time"></select>
              </label>
              <label>
                Customer OTP
                <input class="admin-reschedule-otp" type="text" inputmode="numeric" maxlength="6" placeholder="${
                  otpRequested ? 'Enter OTP sent to customer' : 'Click Request OTP first'
                }" />
              </label>
              <button class="btn btn-secondary admin-reschedule-request-otp" type="button">${
                otpRequested ? 'Resend OTP' : 'Request OTP'
              }</button>
              <button class="btn btn-primary admin-reschedule-confirm" type="button">Confirm Reschedule</button>
              ${
                scheduleLaterEligibility.allowed
                  ? '<button class="btn btn-secondary admin-reschedule-schedule-later" type="button">Schedule Later</button>'
                  : ''
              }
            </div>`
          : ''
      }
    `;

    const dateInput = card.querySelector('.admin-reschedule-date');
    const checkBtn = card.querySelector('.admin-reschedule-check');
    const timeSelect = card.querySelector('.admin-reschedule-time');
    const otpInput = card.querySelector('.admin-reschedule-otp');
    const requestOtpBtn = card.querySelector('.admin-reschedule-request-otp');
    const confirmBtn = card.querySelector('.admin-reschedule-confirm');
    const scheduleLaterBtn = card.querySelector('.admin-reschedule-schedule-later');

    if (canReschedule && !isRescheduledView && timeSelect) {
      timeSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = hasCheckedAvailability
        ? slots.length
          ? 'Select an available slot'
          : 'No open slots for this date'
        : 'Check slots first';
      timeSelect.appendChild(placeholder);
      for (const slot of slots) {
        const option = document.createElement('option');
        option.value = slot.value;
        option.textContent = slot.label;
        timeSelect.appendChild(option);
      }
      if (slots.some((slot) => slot.value === selection.bookingTime)) {
        timeSelect.value = selection.bookingTime;
      }
      timeSelect.disabled = !hasCheckedAvailability || isLoading || !slots.length;
    }

    if (canReschedule && !isRescheduledView && confirmBtn) {
      confirmBtn.disabled = !timeSelect?.value || isLoading || !otpRequested;
    }
    if (canReschedule && !isRescheduledView && checkBtn) {
      checkBtn.disabled = isLoading;
    }
    if (canReschedule && !isRescheduledView && requestOtpBtn) {
      requestOtpBtn.disabled = !timeSelect?.value || isLoading;
    }
    if (canReschedule && !isRescheduledView && otpInput) {
      otpInput.disabled = !otpRequested || isLoading;
    }

    dateInput?.addEventListener('change', () => {
      state.adminRescheduleSelections = {
        ...(state.adminRescheduleSelections || {}),
        [id]: {
          bookingDate: String(dateInput.value || getTodayIsoDate()).trim(),
          bookingTime: '',
        },
      };
      renderAdminRescheduleQueue();
    });

    checkBtn?.addEventListener('click', async () => {
      await loadAdminRescheduleAvailability(booking);
    });

    timeSelect?.addEventListener('change', () => {
      state.adminRescheduleSelections = {
        ...(state.adminRescheduleSelections || {}),
        [id]: {
          ...getAdminRescheduleSelection(booking),
          bookingTime: String(timeSelect.value || '').trim(),
        },
      };
      renderAdminRescheduleQueue();
    });

    requestOtpBtn?.addEventListener('click', async () => {
      await requestAdminRescheduleOtp(booking);
    });

    confirmBtn?.addEventListener('click', async () => {
      await confirmAdminRescheduleBooking(booking, String(otpInput?.value || '').trim());
    });

    scheduleLaterBtn?.addEventListener('click', async () => {
      await handleAdminScheduleLaterAction(booking);
    });

    elements.adminRescheduleList.appendChild(card);
  }
}

async function requestAdminRescheduleOtp(booking) {
  const id = Number(booking?.id || 0);
  if (!Number.isInteger(id) || id <= 0) return;
  const selection = getAdminRescheduleSelection(booking);
  if (!selection.bookingDate || !selection.bookingTime) {
    showNotice({ title: 'Select slot', body: 'Choose an available reschedule slot first.' });
    return;
  }
  const confirmed = confirm(
    `Send OTP to ${booking.clientEmail || 'the customer'} for rescheduling to ${formatDateTime(selection.bookingDate, selection.bookingTime)}?`
  );
  if (!confirmed) return;
  const otpResult = await api(`/api/admin/bookings/${id}/reschedule-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingDate: selection.bookingDate,
      bookingTime: selection.bookingTime,
    }),
  });
  state.adminRescheduleOtpRequested = {
    ...(state.adminRescheduleOtpRequested || {}),
    [String(id)]: true,
  };
  renderAdminRescheduleQueue();
  showNotice({ title: 'OTP Sent', body: otpResult?.message || 'OTP sent to customer email.' });
}

async function confirmAdminRescheduleBooking(booking, otpValue = '') {
  const id = Number(booking?.id || 0);
  if (!Number.isInteger(id) || id <= 0) return;
  const selection = getAdminRescheduleSelection(booking);
  if (!selection.bookingDate || !selection.bookingTime) {
    showNotice({ title: 'Select slot', body: 'Choose an available reschedule slot first.' });
    return;
  }
  const otp = String(otpValue || '').trim();
  if (!otp) {
    showNotice({ title: 'Enter OTP', body: 'Please enter the customer OTP to confirm reschedule.' });
    return;
  }

  await api(`/api/admin/bookings/${id}/reschedule-missed`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bookingDate: selection.bookingDate,
      bookingTime: selection.bookingTime,
      otp,
    }),
  });
  delete state.adminRescheduleSelections[String(id)];
  delete state.adminRescheduleOtpRequested[String(id)];
  state.adminRescheduleAvailability = {};
  await loadDashboardData();
  render();
  showNotice({ title: 'Rescheduled', body: 'Missed session rescheduled without requesting another payment.' });
}

function openMembershipDetailsModal(order) {
  if (!elements.membershipDialog) return;
  configureAdminMembershipDetailsFooter(order);
  
  const amountInr = Math.round(Number(order.amountPaise || 0) / 100);
  const memberDetails = Array.isArray(order.memberDetails) ? order.memberDetails : [];
  
  if (elements.membershipDialogTitle) {
    elements.membershipDialogTitle.textContent = `${escapeHtml(order.userName || 'Membership')} Details`;
  }

  const content = document.querySelector('.membership-dialog-content');
  if (content) {
    content.innerHTML = `
      <div class="admin-membership-modal-head">
        <div>
          <h3>${escapeHtml(getMembershipPlanDisplayName(order.planId))}</h3>
          <p>${escapeHtml(order.userEmail || '-')} • ${escapeHtml(order.userMobile || '-')}</p>
        </div>
        <span class="status-chip payment-${escapeHtml(String(order.status || 'created').toLowerCase())}">${escapeHtml(
          String(order.status || 'created')
        )}</span>
      </div>
      <div class="admin-membership-modal-meta">
        <div>
          <strong>People</strong>
          <span>${escapeHtml(String(order.peopleCount || 0))}</span>
        </div>
        <div>
          <strong>Amount</strong>
          <span>Rs. ${amountInr.toLocaleString('en-IN')}</span>
        </div>
        <div>
          <strong>Created</strong>
          <span>${escapeHtml(formatDateOnly(order.createdAt))}</span>
        </div>
        <div>
          <strong>Paid</strong>
          <span>${order.paidAt ? escapeHtml(formatDateOnly(order.paidAt)) : '-'}</span>
        </div>
      </div>
      <div class="admin-membership-modal-members">
        <h4>Covered Persons</h4>
        ${
          !memberDetails.length
            ? '<p class="empty-state">No person details saved.</p>'
            : memberDetails
                .map(
                  (member, idx) => `
          <div class="admin-member-detail">
            <div><strong>Person ${idx + 1}</strong></div>
            <div><strong>Name:</strong> ${escapeHtml(member?.name || '-')}</div>
            <div><strong>Place:</strong> ${escapeHtml(member?.place || '-')}</div>
            <div><strong>Email:</strong> ${escapeHtml(member?.email || '-')}</div>
            <div><strong>Contact:</strong> ${escapeHtml(member?.contactNumber || '-')}</div>
          </div>
        `
                )
                .join('')
        }
      </div>
    `;
  }

  elements.membershipDialog.showModal();
}

function restoreMembershipCheckoutFooter() {
  const actions = document.querySelector('.membership-dialog-actions');
  const dialogActions = elements.membershipForm?.querySelector('.dialog-actions');
  if (!actions) return;
  actions.classList.remove('admin-membership-footer');
  actions.innerHTML = '<button class="btn btn-primary" type="submit">Proceed to Payment</button>';
  if (dialogActions && elements.cancelMembershipBtn) {
    dialogActions.appendChild(elements.cancelMembershipBtn);
  }
}

function configureAdminMembershipDetailsFooter(order) {
  const actions = document.querySelector('.membership-dialog-actions');
  const dialogActions = elements.membershipForm?.querySelector('.dialog-actions');
  if (!actions) return;
  actions.classList.add('admin-membership-footer');
  actions.innerHTML = '';
  const invoiceBtn = createActionButton('View Invoice', () => openMembershipInvoice(order.orderId));
  const downloadInvoiceBtn = createActionButton('Download Invoice', () => downloadMembershipInvoice(order.orderId));
  actions.append(invoiceBtn, downloadInvoiceBtn);
  if (elements.cancelMembershipBtn) {
    actions.appendChild(elements.cancelMembershipBtn);
  }
  if (dialogActions) {
    dialogActions.innerHTML = '';
  }
}

function renderAdminDiscountPhones() {
  if (!elements.adminDiscountList || !elements.adminDiscountEmptyState) return;

  elements.adminDiscountList.innerHTML = '';
  const items = Array.isArray(state.adminDiscountPhones) ? state.adminDiscountPhones : [];
  if (!items.length) {
    elements.adminDiscountEmptyState.hidden = false;
    return;
  }

  elements.adminDiscountEmptyState.hidden = true;
  items.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'admin-discount-card';
    const redeemedText = item.redeemedAt
      ? `Used once${item.redeemedBookingId ? ` on booking #${item.redeemedBookingId}` : ''}`
      : 'Available for next paid booking';
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(item.phoneDisplay || item.phoneKey || '-')}</h3>
        <p>${escapeHtml(String(item.discountPercent || 0))}% service discount</p>
        <p>${escapeHtml(redeemedText)}</p>
      </div>
    `;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      await deleteAdminDiscountPhone(item.id);
    });
    row.appendChild(removeBtn);
    elements.adminDiscountList.appendChild(row);
  });
}

function findAdminUserByContact(email, phone) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = String(phone || '').trim();
  if (!normalizedEmail && !normalizedPhone) return null;
  return (Array.isArray(state.adminUsers) ? state.adminUsers : []).find((user) => {
    const userEmail = String(user.email || '').trim().toLowerCase();
    const userPhone = String(user.mobile || '').trim();
    if (normalizedEmail && userEmail === normalizedEmail) return true;
    if (normalizedPhone && userPhone === normalizedPhone) return true;
    return false;
  });
}

function getSelectedDiscountUsers() {
  return Array.isArray(state.adminDiscountSelectedUsers) ? state.adminDiscountSelectedUsers : [];
}

function addSelectedDiscountUser(user) {
  if (!user || !user.id) return;
  const selected = getSelectedDiscountUsers();
  if (selected.some((item) => String(item.id) === String(user.id))) return;
  state.adminDiscountSelectedUsers = [...selected, user];
  render();
}

function removeSelectedDiscountUser(userId) {
  const normalizedId = String(userId);
  state.adminDiscountSelectedUsers = getSelectedDiscountUsers().filter(
    (user) => String(user.id) !== normalizedId
  );
  if (!state.adminDiscountSelectedUsers.length) {
    state.adminDiscountSelectedWindowOpen = false;
  }
  render();
}

function scheduleAdminDiscountSearch(query) {
  clearTimeout(adminDiscountSearchTimer);
  const trimmed = String(query || '').trim();
  if (!trimmed) {
    state.adminDiscountSearchLoading = false;
    state.adminDiscountSearchResults = [];
    render();
    return;
  }
  state.adminDiscountSearchLoading = true;
  render();
  adminDiscountSearchTimer = window.setTimeout(() => {
    fetchAdminDiscountUsers(trimmed);
  }, 300);
}

async function fetchAdminDiscountUsers(query) {
  const trimmed = String(query || '').trim();
  try {
    const result = await api(`/api/admin/users?search=${encodeURIComponent(trimmed)}`);
    state.adminDiscountSearchResults = result.users || [];
  } catch {
    state.adminDiscountSearchResults = [];
  } finally {
    state.adminDiscountSearchLoading = false;
    render();
  }
}

function renderAdminDiscountUsers() {
  if (
    !elements.adminDiscountPanel ||
    !elements.adminDiscountUserResults ||
    !elements.adminDiscountUsersEmpty
  ) {
    return;
  }

  if (elements.adminDiscountGateMessage) {
    if (state.adminDiscountUnlocked && !elements.adminDiscountGateMessage.textContent) {
      elements.adminDiscountGateMessage.textContent = 'Discounts unlocked for this session.';
    }
    elements.adminDiscountGateMessage.hidden = !state.adminDiscountUnlocked;
  }

  elements.adminDiscountPanel.hidden = !state.adminDiscountUnlocked;
  if (!state.adminDiscountUnlocked) {
    elements.adminDiscountUserResults.innerHTML = '';
    elements.adminDiscountUsersEmpty.hidden = true;
    state.adminDiscountSelectedWindowOpen = false;
    if (elements.adminDiscountSelectedWindow) elements.adminDiscountSelectedWindow.hidden = true;
    return;
  }

  if (elements.adminDiscountDropdown) {
    elements.adminDiscountDropdown.hidden = !state.adminDiscountDropdownOpen;
    elements.adminDiscountDropdown.classList.toggle('is-open', state.adminDiscountDropdownOpen);
  }

  if (elements.adminDiscountSelectedCount) {
    const count = getSelectedDiscountUsers().length;
    elements.adminDiscountSelectedCount.textContent = `${count} selected`;
  }
  renderAdminSelectedDiscountUsers();

  const users = Array.isArray(state.adminDiscountSearchResults) ? state.adminDiscountSearchResults : [];
  elements.adminDiscountUserResults.innerHTML = '';
  if (!state.adminDiscountDropdownOpen) {
    elements.adminDiscountUsersEmpty.hidden = true;
    return;
  }

  if (state.adminDiscountSearchLoading) {
    const emptyTextEl = elements.adminDiscountUsersEmpty.querySelector('p');
    if (emptyTextEl) emptyTextEl.textContent = 'Searching...';
    elements.adminDiscountUsersEmpty.hidden = false;
    return;
  }

  const trimmedQuery = String(state.adminDiscountSearch || '').trim();
  if (!users.length) {
    const emptyText = trimmedQuery
      ? 'No users found.'
      : 'Type to search users.';
    const emptyTextEl = elements.adminDiscountUsersEmpty.querySelector('p');
    if (emptyTextEl) emptyTextEl.textContent = emptyText;
    elements.adminDiscountUsersEmpty.hidden = false;
  } else {
    elements.adminDiscountUsersEmpty.hidden = true;
    users.forEach((user) => {
      const row = document.createElement('div');
      row.className = 'admin-discount-result-row';

      const main = document.createElement('div');
      main.className = 'admin-discount-result-main';

      const left = document.createElement('div');
      left.className = 'admin-discount-result-left';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = getSelectedDiscountUsers().some((item) => String(item.id) === String(user.id));
      checkbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          addSelectedDiscountUser(user);
        } else {
          removeSelectedDiscountUser(user.id);
        }
      });
      const info = document.createElement('div');
      info.className = 'admin-discount-result-info';
      const membershipStatus = String(user.membershipStatus || 'inactive').toLowerCase();
      const isMember = membershipStatus === 'active';
      const statusLabel = isMember ? 'Member' : 'User';
      const email = user.email || 'no-email';
      const phone = user.mobile || 'no-phone';
      info.innerHTML = `
        <strong>${escapeHtml(user.name || 'User')}</strong>
        <span>${escapeHtml(email)} • ${escapeHtml(phone)}</span>
        <span>${escapeHtml(statusLabel)}</span>
      `;
      left.append(checkbox, info);

      const statusChip = document.createElement('span');
      statusChip.className = `status-chip ${isMember ? 'status-paid' : 'status-pending'}`;
      statusChip.textContent = statusLabel;

      main.append(left, statusChip);
      row.appendChild(main);

      elements.adminDiscountUserResults.appendChild(row);
    });
  }
}

async function applyAdminDiscountToSelected() {
  const selectedUsers = getSelectedDiscountUsers();
  if (!selectedUsers.length) {
    showNotice({ title: 'Notice', body: 'Select at least one user to apply a discount.' });
    return;
  }
  const percent = Number(elements.adminDiscountBulkPercent?.value || 0);
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    showNotice({ title: 'Notice', body: 'Enter a valid discount percentage between 1 and 100.' });
    return;
  }

  const failures = [];
  for (const user of selectedUsers) {
    const email = String(user.email || '').trim().toLowerCase();
    const phone = String(user.mobile || '').trim();
    if (!phone) {
      failures.push(user.name || `User ${user.id}`);
      continue;
    }
    try {
      await applyAdminUserDiscountRaw({ userId: user.id, email, phone, discountPercent: percent });
    } catch {
      failures.push(user.name || `User ${user.id}`);
    }
  }

  await loadDashboardData();
  await fetchAdminDiscountUsers(state.adminDiscountSearch);
  state.adminDiscountSelectedUsers = [];
  state.adminDiscountSelectedWindowOpen = false;
  if (failures.length) {
    showNotice({
      title: 'Partial success',
      body: `Discount applied with some issues. Could not apply for: ${failures.join(', ')}.`,
    });
    render();
    return;
  }
  render();
}

function renderAdminSelectedDiscountUsers() {
  if (
    !elements.adminDiscountSelectedBtn ||
    !elements.adminDiscountSelectedWindow ||
    !elements.adminDiscountSelectedWindowCount ||
    !elements.adminDiscountSelectedList
  ) {
    return;
  }

  const selectedUsers = getSelectedDiscountUsers();
  const count = selectedUsers.length;
  elements.adminDiscountSelectedBtn.textContent = count ? `Selected (${count})` : 'Selected';
  elements.adminDiscountSelectedBtn.disabled = !count;
  elements.adminDiscountSelectedWindowCount.textContent = `${count} selected`;
  elements.adminDiscountSelectedWindow.hidden = !state.adminDiscountSelectedWindowOpen || !count;
  elements.adminDiscountSelectedList.innerHTML = '';

  if (!count) {
    state.adminDiscountSelectedWindowOpen = false;
    return;
  }

  selectedUsers.forEach((user) => {
    const row = document.createElement('div');
    row.className = 'admin-discount-selected-row';

    const main = document.createElement('div');
    main.className = 'admin-discount-selected-main';

    const left = document.createElement('div');
    left.className = 'admin-discount-selected-left';

    const info = document.createElement('div');
    info.className = 'admin-discount-selected-info';
    const membershipStatus = String(user.membershipStatus || 'inactive').toLowerCase();
    const isMember = membershipStatus === 'active';
    const statusLabel = isMember ? 'Member' : 'User';
    const email = user.email || 'no-email';
    const phone = user.mobile || 'no-phone';
    info.innerHTML = `
      <strong>${escapeHtml(user.name || 'User')}</strong>
      <span>${escapeHtml(email)}</span>
      <span>${escapeHtml(phone)}</span>
      <span>${escapeHtml(statusLabel)}</span>
    `;

    left.appendChild(info);

    const actions = document.createElement('div');
    actions.className = 'admin-discount-selected-actions';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      removeSelectedDiscountUser(user.id);
    });

    actions.appendChild(removeBtn);
    main.append(left, actions);
    row.appendChild(main);
    elements.adminDiscountSelectedList.appendChild(row);
  });
}

async function applyAdminUserDiscountRaw({ userId, email, phone, discountPercent }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedPhone = normalizeTenDigitMobile(phone);
  const percent = Number(discountPercent || 0);

  if (!normalizedPhone) {
    throw new Error('Add a phone number to apply a discount.');
  }
  if (normalizedPhone.length !== 10) {
    throw new Error('Phone number must be 10 digits.');
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent > 100) {
    throw new Error('Enter a valid discount percentage between 1 and 100.');
  }

  if (normalizedEmail) {
    await api(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail, mobile: normalizedPhone }),
    });
  }
  await api('/api/admin/discount-phones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: normalizedPhone, discountPercent: percent }),
  });
}

async function applyAdminUserDiscount({ userId, email, phone, discountPercent }) {
  try {
    await applyAdminUserDiscountRaw({ userId, email, phone, discountPercent });
    await loadDashboardData();
    render();
  } catch (error) {
    showNotice({ title: 'Error', body: error.message || 'Unable to apply discount.' });
  }
}

async function saveAdminDiscountPhone() {
  const phone = normalizeTenDigitMobile(elements.adminDiscountPhone?.value);
  if (elements.adminDiscountPhone && elements.adminDiscountPhone.value.trim() !== phone) {
    elements.adminDiscountPhone.value = phone;
  }
  const discountPercent = Number(elements.adminDiscountPercent?.value || 0);
  if (!phone || phone.length !== 10 || !Number.isFinite(discountPercent) || discountPercent <= 0) {
    showNotice({ title: 'Notice', body: 'Enter a valid phone number and discount percentage.' });
    return;
  }

  const originalLabel = elements.adminDiscountSubmitBtn?.textContent || 'Add Discount';
  if (elements.adminDiscountSubmitBtn) {
    elements.adminDiscountSubmitBtn.disabled = true;
    elements.adminDiscountSubmitBtn.textContent = 'Saving...';
  }
  try {
    await api('/api/admin/discount-phones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, discountPercent }),
    });
    if (elements.adminDiscountPhone) elements.adminDiscountPhone.value = '';
    if (elements.adminDiscountPercent) elements.adminDiscountPercent.value = '';
    await loadDashboardData();
    render();
  } finally {
    if (elements.adminDiscountSubmitBtn) {
      elements.adminDiscountSubmitBtn.disabled = false;
      elements.adminDiscountSubmitBtn.textContent = originalLabel;
    }
  }
  if (state.user?.role !== 'admin') {
    state.adminUsers = [];
  }
}

async function deleteAdminDiscountPhone(discountId) {
  const ok = confirm('Remove this discount phone number?');
  if (!ok) return;
  await api(`/api/admin/discount-phones/${encodeURIComponent(discountId)}`, { method: 'DELETE' });
  await loadDashboardData();
  render();
}

function buildCouponCodePrefix(value) {
  const prefix = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 10);
  return prefix || 'H2';
}

function generateAdminCouponCode(prefixValue = 'H2') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const size = 8;
  const prefix = buildCouponCodePrefix(prefixValue);
  let suffix = '';
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(size);
    window.crypto.getRandomValues(bytes);
    suffix = Array.from(bytes)
      .map((value) => alphabet[value % alphabet.length])
      .join('');
  } else {
    for (let i = 0; i < size; i += 1) {
      suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
  }
  return `${prefix}-${suffix}`;
}

function isLikelyEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function normalizeGeneralCouponClient(coupon) {
  if (!coupon || typeof coupon !== 'object') return null;
  const normalized = { ...coupon };
  normalized.code = String(coupon.code || coupon.coupon_code || '').trim();
  normalized.couponType = String(coupon.couponType || coupon.coupon_type || '').trim().toLowerCase();
  normalized.active = coupon.active ?? coupon.is_active ?? coupon.isActive ?? 1;
  normalized.isActive = coupon.isActive ?? coupon.is_active ?? coupon.active ?? 1;
  normalized.validFrom = coupon.validFrom ?? coupon.valid_from ?? null;
  normalized.validTill = coupon.validTill ?? coupon.valid_till ?? null;
  normalized.expiresAt = coupon.expiresAt ?? coupon.expires_at ?? normalized.validTill ?? null;
  normalized.festivalName = coupon.festivalName ?? coupon.festival_name ?? '';
  normalized.discountValue = coupon.discountValue ?? coupon.discount_value ?? 0;
  normalized.canRedeem = coupon.canRedeem ?? coupon.can_redeem ?? true;
  normalized.unavailableReason = coupon.unavailableReason ?? coupon.unavailable_reason ?? '';
  return normalized;
}

function getCouponTypeClient(coupon) {
  const explicitType = String(coupon?.couponType || '').trim().toLowerCase();
  if (explicitType === 'private' || explicitType === 'public') return explicitType;
  const snakeType = String(coupon?.coupon_type || '').trim().toLowerCase();
  if (snakeType === 'private' || snakeType === 'public') return snakeType;
  const assignedEmail = String(coupon?.assignedUserEmail || coupon?.recipientEmail || '').trim().toLowerCase();
  return assignedEmail ? 'private' : 'public';
}

function isCouponWithinDateRangeClient(coupon) {
  const now = Date.now();
  const validFromRaw = String(coupon?.validFrom || '').trim();
  const validTillRaw = String(coupon?.validTill || coupon?.expiresAt || '').trim();
  if (validFromRaw) {
    const startTs = new Date(validFromRaw).getTime();
    if (Number.isFinite(startTs) && startTs > now) return false;
  }
  if (validTillRaw) {
    const endTs = new Date(validTillRaw).getTime();
    if (Number.isFinite(endTs) && endTs <= now) return false;
  }
  return true;
}

function isCouponActiveClient(coupon) {
  const activeValue = coupon?.isActive ?? coupon?.is_active ?? coupon?.active;
  if (activeValue == null || activeValue === '') return true;
  return Number(activeValue) === 1 || activeValue === true;
}

function renderAdminCoupons() {
  renderAdminCouponFormByType();
  if (!elements.adminCouponList || !elements.adminCouponEmptyState) return;

  elements.adminCouponList.innerHTML = '';
  if (elements.adminSeasonalCouponList) elements.adminSeasonalCouponList.innerHTML = '';
  const items = Array.isArray(state.adminCoupons) ? state.adminCoupons : [];
  if (!items.length) {
    elements.adminCouponEmptyState.hidden = false;
    if (elements.adminSeasonalCouponEmptyState) elements.adminSeasonalCouponEmptyState.hidden = false;
    return;
  }

  elements.adminCouponEmptyState.hidden = true;
  const privateCoupons = items.filter((item) => getCouponTypeClient(item) === 'private');
  const publicCoupons = items.filter((item) => getCouponTypeClient(item) === 'public');

  if (!privateCoupons.length) {
    elements.adminCouponEmptyState.hidden = false;
  }

  privateCoupons.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'admin-discount-card';
    const discountLabel = `Rs. ${Number(item.discountValue || 0).toLocaleString('en-IN')} off`;
    const maxRedemptions = item.maxRedemptions == null ? '∞' : String(item.maxRedemptions);
    const expiresText = item.expiresAt ? formatDateOnly(item.expiresAt) : 'No expiry';
    const recipientLabel = item.recipientEmail
      ? `${item.recipientName ? `${item.recipientName} • ` : ''}${item.recipientEmail}`
      : 'No recipient';
    const festivalLabel = item.festivalName ? `Festival: ${item.festivalName}` : '';
    const emailStatusValue = String(item.emailStatus || '').trim().toLowerCase();
    const emailStatus =
      emailStatusValue === 'failed'
        ? 'Needs resend'
        : emailStatusValue
          ? emailStatusValue.toUpperCase()
          : 'Not sent';
    const emailedAtText = item.emailedAt ? formatDateOnly(item.emailedAt) : '-';
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(item.code || '-')}</h3>
        <p>${escapeHtml(discountLabel)}</p>
        ${festivalLabel ? `<p>${escapeHtml(festivalLabel)}</p>` : ''}
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        <p>Recipient: ${escapeHtml(recipientLabel)}</p>
        <p>Email: ${escapeHtml(emailStatus)} • Last sent: ${escapeHtml(emailedAtText)}</p>
        ${emailStatusValue === 'failed' && item.emailError ? `<p>${escapeHtml(item.emailError)}</p>` : ''}
        <p>Uses: ${escapeHtml(String(item.totalRedemptions || 0))}/${escapeHtml(maxRedemptions)}</p>
        <p>Expires: ${escapeHtml(expiresText)}</p>
      </div>
    `;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      copyTextToClipboard(item.code || '');
      showNotice({ title: 'Copied', body: 'Coupon code copied.' });
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      await deleteAdminCoupon(item.id);
    });

    const resendBtn = document.createElement('button');
    resendBtn.type = 'button';
    resendBtn.className = 'btn btn-secondary';
    resendBtn.textContent = emailStatusValue === 'sent' ? 'Resend' : 'Send';
    resendBtn.disabled = !item.recipientEmail;
    resendBtn.addEventListener('click', async () => {
      await resendAdminCoupon(item.id);
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-secondary';
    toggleBtn.textContent = item.active ? 'Deactivate' : 'Activate';
    toggleBtn.addEventListener('click', async () => {
      await setAdminCouponActive(item.id, !item.active);
    });

    const actions = document.createElement('div');
    actions.className = 'admin-coupon-card-actions';
    actions.appendChild(copyBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(resendBtn);
    actions.appendChild(removeBtn);
    row.appendChild(actions);
    elements.adminCouponList.appendChild(row);
  });

  if (!elements.adminSeasonalCouponList || !elements.adminSeasonalCouponEmptyState) return;
  if (!publicCoupons.length) {
    elements.adminSeasonalCouponEmptyState.hidden = false;
    return;
  }
  elements.adminSeasonalCouponEmptyState.hidden = true;

  publicCoupons.forEach((item) => {
    const row = document.createElement('article');
    row.className = 'admin-discount-card admin-seasonal-card';
    const discountLabel = `Rs. ${Number(item.discountValue || 0).toLocaleString('en-IN')} off`;
    const expiryText = item.validTill || item.expiresAt ? formatDateOnly(item.validTill || item.expiresAt) : 'No expiry';
    const activeStatus = isCouponActiveClient(item) && isCouponWithinDateRangeClient(item) ? 'Active' : 'Inactive';
    row.innerHTML = `
      <div>
        <h3>${escapeHtml(item.code || '-')}</h3>
        <p>${escapeHtml(discountLabel)}</p>
        ${item.festivalName ? `<p>Offer: ${escapeHtml(item.festivalName)}</p>` : ''}
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
        <p>Expiry: ${escapeHtml(expiryText)}</p>
        <p>Status: ${escapeHtml(activeStatus)}</p>
        <p>Redeemed: ${escapeHtml(String(item.totalRedemptions || 0))}</p>
      </div>
    `;

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn btn-secondary';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      copyTextToClipboard(item.code || '');
      showNotice({ title: 'Copied', body: 'Coupon code copied.' });
    });

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-secondary';
    toggleBtn.textContent = item.active ? 'Deactivate' : 'Activate';
    toggleBtn.addEventListener('click', async () => {
      await setAdminCouponActive(item.id, !item.active);
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      await deleteAdminCoupon(item.id);
    });

    const actions = document.createElement('div');
    actions.className = 'admin-coupon-card-actions';
    actions.appendChild(copyBtn);
    actions.appendChild(toggleBtn);
    actions.appendChild(removeBtn);
    row.appendChild(actions);
    elements.adminSeasonalCouponList.appendChild(row);
  });
}

function renderAdminCouponFormByType() {
  const selectedType = String(elements.adminCouponType?.value || 'public').trim().toLowerCase();
  const isPrivate = selectedType === 'private';
  if (elements.adminCouponRecipientEmailWrap) {
    elements.adminCouponRecipientEmailWrap.hidden = !isPrivate;
  }
  if (elements.adminCouponSubmitBtn) {
    elements.adminCouponSubmitBtn.hidden = !isPrivate;
    elements.adminCouponSubmitBtn.textContent = 'Generate & Send';
  }
  if (elements.adminCouponSaveOnlyBtn) {
    elements.adminCouponSaveOnlyBtn.textContent = isPrivate ? 'Save Only' : 'Save Seasonal Coupon';
  }
}

function syncAdminCouponExpiryValue() {
  if (!elements.adminCouponExpiresAt) return;
  const dateValue = String(elements.adminCouponExpiryDate?.value || '').trim();
  const timeValue = String(elements.adminCouponExpiryTime?.value || '').trim();
  elements.adminCouponExpiresAt.value = dateValue && timeValue ? `${dateValue}T${timeValue}` : '';
}

function clearAdminCouponExpiryFields() {
  if (elements.adminCouponExpiresAt) elements.adminCouponExpiresAt.value = '';
  if (elements.adminCouponExpiryDate) elements.adminCouponExpiryDate.value = '';
  if (elements.adminCouponExpiryTime) elements.adminCouponExpiryTime.value = '';
}

async function setAdminCouponActive(couponId, active) {
  await api(`/api/admin/coupons/${encodeURIComponent(couponId)}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active: active ? 1 : 0 }),
  });
  await loadDashboardData();
  render();
}

async function saveAdminCoupon({ sendEmail = true } = {}) {
  const selectedType = String(elements.adminCouponType?.value || 'public').trim().toLowerCase();
  const couponType = selectedType === 'private' ? 'private' : 'public';
  const recipientEmail = String(elements.adminCouponRecipientEmail?.value || '').trim();
  const festivalName = String(elements.adminCouponFestivalName?.value || '').trim();
  let code = String(elements.adminCouponCode?.value || '').trim().toUpperCase();
  const description = String(elements.adminCouponDescription?.value || '').trim();
  const discountValue = Number(elements.adminCouponValue?.value || 0);
  const appliesTo = 'all';
  syncAdminCouponExpiryValue();
  const expiresAt = String(elements.adminCouponExpiresAt?.value || '').trim();
  const expiryDateValue = String(elements.adminCouponExpiryDate?.value || '').trim();
  const expiryTimeValue = String(elements.adminCouponExpiryTime?.value || '').trim();
  const shouldSendEmail = couponType === 'private' ? Boolean(sendEmail) : false;

  if (couponType === 'private' && recipientEmail && !isLikelyEmail(recipientEmail)) {
    showNotice({ title: 'Notice', body: 'Enter a valid recipient email.' });
    return;
  }
  if (couponType === 'private' && shouldSendEmail && !recipientEmail) {
    showNotice({ title: 'Notice', body: 'Recipient email is required to send a coupon.' });
    return;
  }
  if (couponType === 'private' && !recipientEmail) {
    showNotice({ title: 'Notice', body: 'Recipient email is required for private coupons.' });
    return;
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    showNotice({ title: 'Notice', body: 'Enter a valid fixed discount amount greater than 0.' });
    return;
  }
  if ((expiryDateValue && !expiryTimeValue) || (!expiryDateValue && expiryTimeValue)) {
    showNotice({ title: 'Notice', body: 'Choose both expiry date and expiry time, or leave both blank.' });
    return;
  }
  if (expiresAt) {
    const expiresDate = new Date(expiresAt);
    if (Number.isNaN(expiresDate.getTime())) {
      showNotice({ title: 'Notice', body: 'Enter a valid coupon expiry date and time.' });
      return;
    }
    const todayKey = getTodayIsoDate();
    const expiryDateKey = expiresAt.slice(0, 10);
    if (expiryDateKey < todayKey) {
      showNotice({ title: 'Notice', body: 'Coupon expiry date cannot be in the past.' });
      return;
    }
  }
  if (Number(discountValue) > 10000000) {
    showNotice({ title: 'Notice', body: 'Enter a reasonable fixed discount amount.' });
    return;
  }
  if (!code) {
    code = generateAdminCouponCode(festivalName);
    if (elements.adminCouponCode) {
      elements.adminCouponCode.value = code;
    }
  }

  const originalLabel = elements.adminCouponSubmitBtn?.textContent || 'Generate & Send';
  const saveOnlyLabel = elements.adminCouponSaveOnlyBtn?.textContent || 'Save Only';
  if (elements.adminCouponSubmitBtn) {
    elements.adminCouponSubmitBtn.disabled = true;
    elements.adminCouponSubmitBtn.textContent = shouldSendEmail ? 'Sending...' : originalLabel;
  }
  if (elements.adminCouponSaveOnlyBtn) {
    elements.adminCouponSaveOnlyBtn.disabled = true;
    elements.adminCouponSaveOnlyBtn.textContent = shouldSendEmail ? saveOnlyLabel : 'Saving...';
  }

  try {
    const result = await api('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        description,
        discountType: 'flat',
        discountValue,
        appliesTo,
        festivalName,
        couponType,
        maxRedemptions: 1,
        validTill: expiresAt,
        recipientEmail: couponType === 'private' ? recipientEmail : '',
        singleUse: true,
        sendEmail: shouldSendEmail,
      }),
    });

    if (elements.adminCouponCode) elements.adminCouponCode.value = '';
    if (elements.adminCouponDescription) elements.adminCouponDescription.value = '';
    if (elements.adminCouponValue) elements.adminCouponValue.value = '';
    clearAdminCouponExpiryFields();
    if (elements.adminCouponRecipientEmail) elements.adminCouponRecipientEmail.value = '';
    if (elements.adminCouponFestivalName) elements.adminCouponFestivalName.value = '';

    await loadDashboardData();
    render();

    const sentCode = result.code || code;
    if (!shouldSendEmail) {
      showNotice({ title: 'Saved', body: `Coupon ${sentCode} saved.` });
    } else if (result.emailStatus === 'failed') {
      showNotice({
        title: 'Coupon created',
        body: `Coupon ${sentCode} was created. Email was not sent yet; use Send on the coupon card to retry. ${result.emailMessage || ''}`.trim(),
      });
    } else {
      showNotice({ title: 'Email sent', body: `Coupon ${sentCode} sent to ${recipientEmail}.` });
    }
  } finally {
    if (elements.adminCouponSubmitBtn) {
      elements.adminCouponSubmitBtn.disabled = false;
      elements.adminCouponSubmitBtn.textContent = originalLabel;
    }
    if (elements.adminCouponSaveOnlyBtn) {
      elements.adminCouponSaveOnlyBtn.disabled = false;
      elements.adminCouponSaveOnlyBtn.textContent = saveOnlyLabel;
    }
  }
}

async function deleteAdminCoupon(couponId) {
  const ok = confirm('Remove this coupon?');
  if (!ok) return;
  await api(`/api/admin/coupons/${encodeURIComponent(couponId)}`, { method: 'DELETE' });
  await loadDashboardData();
  render();
}

async function resendAdminCoupon(couponId) {
  const ok = confirm('Resend this coupon email?');
  if (!ok) return;
  await api(`/api/admin/coupons/${encodeURIComponent(couponId)}/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  await loadDashboardData();
  render();
  showNotice({ title: 'Email sent', body: 'Coupon email sent.' });
}

function cell(content) {
  const td = document.createElement('td');
  td.textContent = content;
  return td;
}

function multilineCell(content) {
  const td = cell(content);
  td.style.whiteSpace = 'pre-line';
  return td;
}

function getBookingRowAmountInr(row) {
  if (Number.isFinite(Number(row?.amountInr))) {
    return Number(row.amountInr);
  }
  if (row?.isGroupedHydrogen) {
    const hydrogenEntries = Array.isArray(row?.hydrogenEntries) ? row.hydrogenEntries : [];
    const addOnEntries = Array.isArray(row?.addOnEntries) ? row.addOnEntries : [];
    const breakdown = getHydrogenGroupBreakdown(hydrogenEntries, addOnEntries);
    return Number(breakdown?.totalAmountInr || 0);
  }
  const booking = row?.booking || {};
  if (booking?.serviceName) return getBookingDisplayAmountInr(booking);
  return Number(getDisplayedServicePriceInr(row?.serviceTitle || '') || 0);
}

function userBookingServiceCell(row, label = 'Service') {
  const td = document.createElement('td');
  td.dataset.label = label;
  const wrap = document.createElement('div');
  wrap.className = 'booking-service-block';

  const icon = document.createElement('span');
  icon.className = 'booking-service-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '◔';
  wrap.appendChild(icon);

  const content = document.createElement('div');
  content.className = 'booking-service-content';

  const title = document.createElement('div');
  title.className = 'booking-service-title';
  title.textContent = row.serviceTitle || row.serviceText || '-';
  content.appendChild(title);

  const metaLines = Array.isArray(row.serviceMetaLines) ? row.serviceMetaLines : [];
  for (const line of metaLines) {
    const text = typeof line === 'object' && line !== null
      ? String(line.text || '').trim()
      : String(line || '').trim();
    if (!text) continue;
    const meta = document.createElement('div');
    meta.className = 'booking-service-meta';
    if (typeof line === 'object' && line !== null && line.tone) {
      meta.classList.add(`is-${String(line.tone).trim()}`);
    }
    meta.textContent = text;
    content.appendChild(meta);
  }

  if (Array.isArray(row.detailSections) && row.detailSections.length) {
    const details = document.createElement('details');
    details.className = 'booking-details-toggle';
    const summary = document.createElement('summary');
    summary.textContent = 'View Details';
    details.appendChild(summary);

    for (const section of row.detailSections) {
      const lines = Array.isArray(section?.lines) ? section.lines.filter(Boolean) : [];
      if (!lines.length) continue;
      const block = document.createElement('div');
      block.className = 'booking-details-section';

      const heading = document.createElement('div');
      heading.className = 'booking-details-heading';
      heading.textContent = section.title || 'Details';
      block.appendChild(heading);

      for (const line of lines) {
        const item = document.createElement('div');
        item.className = 'booking-details-line';
        const text = typeof line === 'object' && line !== null
          ? String(line.text || '').trim()
          : String(line || '').trim();
        if (!text) continue;
        if (typeof line === 'object' && line !== null && line.tone) {
          item.classList.add(`is-${String(line.tone).trim()}`);
        }
        item.textContent = text;
        block.appendChild(item);
      }

      details.appendChild(block);
    }

    content.appendChild(details);
  }

  wrap.appendChild(content);
  td.appendChild(wrap);
  return td;
}

function userBookingScheduleCell(row, label = 'Date & Time') {
  const td = document.createElement('td');
  td.dataset.label = label;
  const wrap = document.createElement('div');
  wrap.className = 'booking-schedule-block';

  const scheduleLines = Array.isArray(row.scheduleLines) ? row.scheduleLines : [row.dateTimeText || '-'];
  for (const line of scheduleLines) {
    const text = String(line || '').trim();
    if (!text) continue;
    const item = document.createElement('div');
    item.className = 'booking-schedule-line';
    item.textContent = text;
    wrap.appendChild(item);
  }

  td.appendChild(wrap);
  return td;
}

function bookingAmountCell(row, label = 'Amount') {
  const td = document.createElement('td');
  td.dataset.label = label;
  const amountInr = getBookingRowAmountInr(row);
  const amount = document.createElement('div');
  amount.className = 'booking-amount-value';
  amount.textContent = amountInr > 0 ? `Rs. ${amountInr.toLocaleString('en-IN')}` : '';
  td.appendChild(amount);
  return td;
}

function getBookingCategory(serviceName) {
  const normalized = String(serviceName || '').trim().toLowerCase();
  const matched = state.services.find((service) => String(service.name || '').trim().toLowerCase() === normalized);
  const category = String(matched?.category || '').toUpperCase();
  if (normalized === 'experience session' || normalized === 'demo session' || normalized === 'demo hydrogen session') {
    return 'EXPERIENCE SESSION';
  }
  if (category === 'EXPERIENCE SESSION') return 'EXPERIENCE SESSION';
  if (category === 'HYDROGEN SESSION') return 'HYDROGEN SESSION';
  if (category === 'MEMBERSHIP SERVICES') return 'MEMBERSHIP SERVICES';
  if (category === 'IV THERAPIES' || category === 'IV SHOTS') return 'IV ADD-ON';
  if (normalized.includes('hydrogen') || normalized.startsWith('h2 ')) return 'HYDROGEN SESSION';
  return '';
}

function isExperienceSessionServiceName(serviceName) {
  const normalized = String(serviceName || '').trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === 'experience session' || normalized === 'demo session' || normalized === 'demo hydrogen session') return true;
  const service = getServiceCatalogEntry(serviceName);
  return String(service?.category || '').trim().toUpperCase() === 'EXPERIENCE SESSION';
}

function hasCurrentUserUsedExperienceSession() {
  if (state.user?.role !== 'user') return false;
  if (isCurrentUserMembershipActive()) return true;
  return (Array.isArray(state.bookings) ? state.bookings : []).some((booking) => {
    if (!isExperienceSessionServiceName(booking?.serviceName)) return false;
    const status = String(booking?.status || '').trim().toLowerCase();
    if (status === 'cancelled') return false;
    if (booking?.holdExpired) return false;
    return status === 'completed' || status === 'schedule_later' || status === 'booked' || status === 'confirmed' || status === 'pending';
  });
}

function getBookingCategoryLabel(serviceName) {
  const category = getBookingCategory(serviceName);
  if (category === 'EXPERIENCE SESSION') return 'Demo Hydrogen Session';
  if (category === 'HYDROGEN SESSION') return 'Hydrogen Session';
  if (category === 'IV ADD-ON') {
    const service = getServiceCatalogEntry(serviceName);
    let specific = String(service?.category || '').trim().toUpperCase();
    if (!specific) {
      const normalized = String(serviceName || '').trim().toLowerCase();
      specific = normalized.includes('shot') ? 'IV SHOTS' : 'IV THERAPIES';
    }
    if (specific === 'IV THERAPIES') return 'Therapy';
    if (specific === 'IV SHOTS') return 'Shot';
    return 'Therapy / Shot';
  }
  if (category === 'MEMBERSHIP SERVICES') return 'Membership Service';
  return 'Service Booking';
}

function getServiceCatalogEntry(serviceName) {
  const normalized = String(serviceName || '').trim().toLowerCase();
  const direct = state.services.find((service) => String(service.name || '').trim().toLowerCase() === normalized) || null;
  if (direct) return direct;
  if (normalized === 'demo session' || normalized === 'demo hydrogen session') {
    return (
      state.services.find((service) => String(service.name || '').trim().toLowerCase() === 'experience session') || null
    );
  }
  return null;
}

function getDisplayedServicePriceInr(serviceName) {
  const service = getServiceCatalogEntry(serviceName);
  const normalized = String(serviceName || '').trim().toLowerCase();
  if (!service && (normalized === 'demo session' || normalized === 'demo hydrogen session' || normalized === 'experience session')) {
    return 4000;
  }
  const price = Number(service?.effectivePriceInr ?? service?.priceInr ?? 0);
  if (price <= 0 && String(service?.category || '').trim().toUpperCase() === 'EXPERIENCE SESSION') {
    return 4000;
  }
  return price;
}

function getHydrogenSingleSessionPriceInr() {
  const singleSessionService =
    state.services.find(
      (service) =>
        String(service.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
        getHydrogenSessionCountFromServiceName(service.name) === 1
    ) || null;
  return Number(
    singleSessionService?.effectivePriceInr ??
      singleSessionService?.memberPriceInr ??
      singleSessionService?.priceInr ??
      0
  );
}

const GST_RATE_PERCENT = 18;

function normalizeCurrencyAmountInr(amountInr) {
  return Math.max(0, Math.round(Number(amountInr || 0)));
}

function getGstBreakdownInr(amountInr, { fromGross = false } = {}) {
  const sourceAmountInr = normalizeCurrencyAmountInr(amountInr);
  if (sourceAmountInr <= 0) {
    return {
      subtotalAmountInr: 0,
      gstAmountInr: 0,
      totalAmountInr: 0,
    };
  }

  if (fromGross) {
    const subtotalAmountInr = Math.max(0, Math.round(sourceAmountInr / (1 + GST_RATE_PERCENT / 100)));
    return {
      subtotalAmountInr,
      gstAmountInr: Math.max(0, sourceAmountInr - subtotalAmountInr),
      totalAmountInr: sourceAmountInr,
    };
  }

  const subtotalAmountInr = sourceAmountInr;
  const gstAmountInr = Math.max(0, Math.round((subtotalAmountInr * GST_RATE_PERCENT) / 100));
  return {
    subtotalAmountInr,
    gstAmountInr,
    totalAmountInr: subtotalAmountInr + gstAmountInr,
  };
}

function formatAmountWithGstLabel(amountInr) {
  const breakdown = getGstBreakdownInr(amountInr);
  if (breakdown.gstAmountInr <= 0) {
    return `Rs. ${breakdown.totalAmountInr.toLocaleString('en-IN')}`;
  }
  return `Rs. ${breakdown.totalAmountInr.toLocaleString('en-IN')} (GST ${GST_RATE_PERCENT}%: Rs. ${breakdown.gstAmountInr.toLocaleString('en-IN')})`;
}

function formatGrossAmountWithGstLabel(amountInr) {
  const breakdown = getGstBreakdownInr(amountInr, { fromGross: true });
  if (breakdown.gstAmountInr <= 0) {
    return `Rs. ${breakdown.totalAmountInr.toLocaleString('en-IN')}`;
  }
  return `Rs. ${breakdown.totalAmountInr.toLocaleString('en-IN')} (GST ${GST_RATE_PERCENT}%: Rs. ${breakdown.gstAmountInr.toLocaleString('en-IN')})`;
}

function getBookingDisplayAmountInr(booking) {
  if (String(booking?.paymentReference || '').trim().toLowerCase() === 'membership') return 0;
  if (isBuyExtraHydrogenBooking(booking)) {
    return getGstBreakdownInr(getHydrogenSingleSessionPriceInr()).totalAmountInr;
  }
  return getGstBreakdownInr(getDisplayedServicePriceInr(booking?.serviceName || '')).totalAmountInr;
}

function canShowBookingInvoice(booking) {
  const bookingStatus = String(booking?.status || booking?.booking?.status || '').trim().toLowerCase();
  if (bookingStatus === 'schedule_later') return false;
  const bookingPaid = String(booking?.paymentStatus || 'unpaid').trim().toLowerCase() === 'paid';
  return bookingPaid && Number(getBookingRowAmountInr(booking) || 0) > 0;
}

function normalizeDiscountPhoneKey(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length < 7) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function getAdminDiscountRecordForPhone(phone) {
  const phoneKey = normalizeDiscountPhoneKey(phone);
  if (!phoneKey) return null;
  return (Array.isArray(state.adminDiscountPhones) ? state.adminDiscountPhones : []).find(
    (item) => item.phoneKey === phoneKey
  ) || null;
}

function getCurrentContextBookings() {
  if (state.user?.role === 'admin') {
    if (!state.adminResolvedCustomer?.id) return [];
    return state.bookings.filter((booking) => String(booking.userId) === String(state.adminResolvedCustomer.id));
  }
  return state.bookings;
}

function getIvCooldownAlertMessage(conflict) {
  const existingDate = formatBookingDateLabel(conflict?.bookingDate);
  return `A Therapy or Shot needs a 2-week gap before another booking.\n\nExisting booking: ${existingDate}\n\nPlease contact us if you still want help scheduling this.`;
}

function getScheduleLaterFooterText(count) {
  const safeCount = Math.max(0, Number(count || 0));
  return `Schedule ${safeCount} Held Session${safeCount === 1 ? '' : 's'}`;
}

function findIvCooldownConflictClient(serviceName, bookingDate, excludeBookingId = '', excludeGroupId = '') {
  if (state.user?.role !== 'user') return null;
  if (getBookingCategory(serviceName) !== 'IV ADD-ON') return null;
  const targetDate = new Date(`${String(bookingDate || '').trim()}T00:00:00`).getTime();
  if (Number.isNaN(targetDate)) return null;

  return getCurrentContextBookings().find((booking) => {
    if (['cancelled', 'schedule_later'].includes(String(booking.status || '').toLowerCase())) return false;
    if (booking.holdExpired) return false;
    if (excludeBookingId && String(booking.id) === String(excludeBookingId)) return false;
    if (excludeGroupId && String(booking.bookingGroupId || '') === String(excludeGroupId)) return false;
    if (getBookingCategory(booking.serviceName) !== 'IV ADD-ON') return false;
    const existingDate = new Date(`${booking.bookingDate}T00:00:00`).getTime();
    if (Number.isNaN(existingDate)) return false;
    const diffDays = Math.abs(Math.round((existingDate - targetDate) / 86400000));
    return diffDays < IV_REBOOK_COOLDOWN_DAYS;
  }) || null;
}

function findHydrogenDailyLimitConflictClient(slots = [], excludeGroupId = '') {
  if (state.user?.role !== 'user') return null;

  const existingByDate = new Map();
  getCurrentContextBookings().forEach((booking) => {
    if (['cancelled', 'schedule_later'].includes(String(booking.status || '').toLowerCase())) return;
    if (booking.holdExpired) return;
    if (excludeGroupId && booking.bookingGroupId === excludeGroupId) return;
    if (getBookingCategory(booking.serviceName) !== 'HYDROGEN SESSION') return;
    existingByDate.set(booking.bookingDate, Number(existingByDate.get(booking.bookingDate) || 0) + 1);
  });

  const requestedByDate = new Map();
  (Array.isArray(slots) ? slots : []).forEach((slot) => {
    const bookingDate = String(slot?.bookingDate || '').trim();
    if (!bookingDate) return;
    requestedByDate.set(bookingDate, Number(requestedByDate.get(bookingDate) || 0) + 1);
  });

  for (const [bookingDate, requestedTotal] of requestedByDate.entries()) {
    const existingTotal = Number(existingByDate.get(bookingDate) || 0);
    let maxAllowed = MAX_HYDROGEN_SESSIONS_PER_DAY_PER_USER;
    const membershipIsActive = isCurrentUserMembershipActive();
    const expiryDate = getEffectiveMembershipExpiryDate(state.user?.membershipStartedAt, state.user?.membershipExpiresAt);
    const expiryDateIso =
      membershipIsActive && expiryDate && !Number.isNaN(expiryDate.getTime()) ? toLocalIsoDate(expiryDate) : '';
    if (expiryDateIso && bookingDate === expiryDateIso) {
      maxAllowed = 3;
    }
    if (existingTotal + requestedTotal > maxAllowed) {
      return { bookingDate, existingTotal, requestedTotal, maxAllowed };
    }
  }

  return null;
}

function findDuplicateHydrogenSlotClient(slots = []) {
  const seen = new Set();
  for (const slot of Array.isArray(slots) ? slots : []) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    const bookingTime = normalizeSlotStartTime(String(slot?.bookingTime || '').trim());
    if (!bookingDate || !bookingTime) continue;
    const key = `${bookingDate}|${bookingTime}`;
    if (seen.has(key)) {
      return { bookingDate, bookingTime };
    }
    seen.add(key);
  }
  return null;
}

function findMembershipExpiryConflictClient(slots = []) {
  if (state.user?.role !== 'user') return null;
  if (!isCurrentUserMembershipActive()) return null;
  const expiryDate = getEffectiveMembershipExpiryDate(state.user?.membershipStartedAt, state.user?.membershipExpiresAt);
  if (!expiryDate || Number.isNaN(expiryDate.getTime())) return null;
  const expiryDateIso = toLocalIsoDate(expiryDate);
  for (const slot of Array.isArray(slots) ? slots : []) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    if (bookingDate && bookingDate > expiryDateIso) {
      return { bookingDate, expiryDate: expiryDateIso };
    }
  }
  return null;
}

function hasHydrogenPackageAddOnOnDateClient(bookingDate, excludeGroupId = '') {
  const targetDate = String(bookingDate || '').trim();
  if (!targetDate) return false;

  return getCurrentContextBookings().some((booking) => {
    if (booking.bookingDate !== targetDate) return false;
    if (!booking.bookingGroupId) return false;
    if (excludeGroupId && booking.bookingGroupId === excludeGroupId) return false;
    if (['cancelled', 'schedule_later'].includes(String(booking.status || '').toLowerCase())) return false;
    if (booking.holdExpired) return false;
    return getBookingCategory(booking.serviceName) === 'IV ADD-ON';
  });
}

function hasStandaloneIvOnDateClient(bookingDate, excludeGroupId = '') {
  const targetDate = String(bookingDate || '').trim();
  if (!targetDate) return false;

  return getCurrentContextBookings().some((booking) => {
    if (booking.bookingDate !== targetDate) return false;
    if (['cancelled', 'schedule_later'].includes(String(booking.status || '').toLowerCase())) return false;
    if (booking.holdExpired) return false;
    if (excludeGroupId && booking.bookingGroupId === excludeGroupId) return false;
    if (booking.bookingGroupId) return false;
    return getBookingCategory(booking.serviceName) === 'IV ADD-ON';
  });
}

function getHydrogenGroupBreakdown(hydrogenEntries, addOnEntries) {
  const allEntries = [...(Array.isArray(hydrogenEntries) ? hydrogenEntries : []), ...(Array.isArray(addOnEntries) ? addOnEntries : [])];
  const membershipActive = isCurrentUserMembershipActive();
  const isAdditionalHydrogenPackage = hydrogenEntries.some((entry) => {
    const paymentReference = String(entry?.paymentReference || '').trim().toLowerCase();
    return paymentReference === 'buy_extra' || Number(entry?.isTopUpSession || 0) === 1;
  });
  const chargeableHydrogenEntries = hydrogenEntries.filter(
    (entry) => String(entry?.paymentReference || '').trim().toLowerCase() !== 'membership'
  );
  const baseServiceName = hydrogenEntries[0]?.serviceName || '';
  const extraSessionPriceInr = getHydrogenSingleSessionPriceInr();
  const addOnParts = addOnEntries.map((entry) => ({
    label: entry.serviceName,
    amountInr: getDisplayedServicePriceInr(entry.serviceName),
  }));
  const breakdownParts = [];

  let hydrogenAmountInr = 0;
  if (membershipActive && !isAdditionalHydrogenPackage && extraSessionPriceInr > 0) {
    hydrogenAmountInr = chargeableHydrogenEntries.length * extraSessionPriceInr;
    if (hydrogenAmountInr > 0) {
      breakdownParts.push(
        `${chargeableHydrogenEntries.length} hydrogen session${chargeableHydrogenEntries.length === 1 ? '' : 's'} Rs. ${hydrogenAmountInr.toLocaleString('en-IN')}`
      );
    }
  } else {
    const packageSessions = getHydrogenSessionCountFromServiceName(baseServiceName);
    const extraSessions = Math.max(0, hydrogenEntries.length - packageSessions);
    const basePriceInr = getDisplayedServicePriceInr(baseServiceName);
    hydrogenAmountInr = basePriceInr + extraSessions * extraSessionPriceInr;
    if (hydrogenEntries.length > 1 && hydrogenAmountInr > 0) {
      breakdownParts.push(
        `${hydrogenEntries.length} hydrogen session${hydrogenEntries.length === 1 ? '' : 's'} Rs. ${hydrogenAmountInr.toLocaleString('en-IN')}`
      );
    } else {
      if (basePriceInr > 0) {
        breakdownParts.push(`${baseServiceName} Rs. ${basePriceInr.toLocaleString('en-IN')}`);
      }
      if (extraSessions > 0 && extraSessionPriceInr > 0) {
        breakdownParts.push(
          `${extraSessions} extra hydrogen session${extraSessions === 1 ? '' : 's'} Rs. ${(extraSessions * extraSessionPriceInr).toLocaleString('en-IN')}`
        );
      }
    }
  }
  addOnParts.forEach((item) => {
    if (item.amountInr > 0) {
      breakdownParts.push(`${item.label} Rs. ${item.amountInr.toLocaleString('en-IN')}`);
    }
  });

  const subtotalAmountInr = hydrogenAmountInr + addOnParts.reduce((sum, item) => sum + Number(item.amountInr || 0), 0);
  const gstBreakdown = getGstBreakdownInr(subtotalAmountInr);
  const totalAmountInr = gstBreakdown.totalAmountInr;

  return {
    breakdownText: breakdownParts.join(' + '),
    totalAmountInr,
    subtotalAmountInr,
    gstAmountInr: gstBreakdown.gstAmountInr,
  };
}

function summarizeGroupStatus(bookings) {
  const statuses = bookings.map((booking) => String(booking.status || '').toLowerCase());
  if (statuses.every((status) => status === 'cancelled')) return 'cancelled';
  if (statuses.every((status) => status === 'schedule_later')) return 'schedule_later';
  if (
    bookings.some((booking) => {
      const status = String(booking?.status || '').trim().toLowerCase();
      return !['completed', 'cancelled', 'schedule_later'].includes(status) && isBookingRescheduled(booking);
    })
  ) return 'rescheduled';
  if (statuses.some((status) => status === 'pending')) return 'pending';
  if (statuses.some((status) => status === 'booked')) return 'booked';
  if (statuses.some((status) => status === 'confirmed')) return 'confirmed';
  if (statuses.some((status) => status === 'completed')) return 'completed';
  return statuses[0] || 'pending';
}

function normalizePaymentStatusKey(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return 'unpaid';
  if (normalized === 'paid') return 'paid';
  if (normalized === 'payment_pending') return 'unpaid';
  if (normalized === 'payment pending') return 'unpaid';
  if (normalized === 'unpaid') return 'unpaid';
  return normalized;
}

function formatPaymentStatusLabel(value) {
  const normalized = normalizePaymentStatusKey(value);
  if (normalized === 'paid') return 'Paid';
  if (normalized === 'unpaid') return 'Unpaid';
  return String(value || normalized || '').trim() || 'Unpaid';
}

function formatPaymentMethodLabel(booking = {}) {
  const rawMethod = String(booking?.paymentMethod || '').trim().toLowerCase();
  const rawReference = String(booking?.paymentReference || '').trim().toLowerCase();
  const method = rawMethod || rawReference;

  if (!method) {
    const service = getServiceCatalogEntry(booking?.serviceName || '');
    return service && getBookingDisplayAmountInr(booking) <= 0 ? 'Included' : '';
  }
  if (method === 'cash') return 'Cash';
  if (method === 'upi') return 'UPI';
  if (method === 'card') return 'Card';
  if (method === 'netbanking') return 'Net banking';
  if (method === 'wallet') return 'Wallet';
  if (method === 'emi') return 'EMI';
  if (method === 'paylater') return 'Pay later';
  if (method === 'membership') return 'Membership';
  if (method === 'buy_extra') return 'Online';
  if (method.startsWith('pay_') || method.startsWith('order_')) return 'Online';

  return method
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPaymentDisplayLabel(bookingOrStatus) {
  const booking = bookingOrStatus && typeof bookingOrStatus === 'object' ? bookingOrStatus : { paymentStatus: bookingOrStatus };
  const statusLabel = formatPaymentStatusLabel(booking.paymentStatus);
  const normalized = normalizePaymentStatusKey(booking.paymentStatus);
  const methodLabel = normalized === 'paid' ? formatPaymentMethodLabel(booking) : '';
  return methodLabel ? `${statusLabel}/${methodLabel}` : statusLabel;
}

function summarizeGroupPaymentStatus(bookings) {
  const paymentStatuses = bookings.map((booking) => normalizePaymentStatusKey(booking.paymentStatus));
  if (paymentStatuses.every((status) => status === 'paid')) return 'paid';
  return 'unpaid';
}

function formatBookingStatusLabel(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'schedule_later') return 'Schedule Later';
  if (normalized === 'rescheduled') return 'Rescheduled';
  return normalized || 'pending';
}

function statusCell(status, label = 'Status') {
  const td = document.createElement('td');
  td.dataset.label = label;
  const normalized = String(status || 'pending').trim().toLowerCase();
  td.innerHTML = `<span class="status-chip status-${escapeHtml(normalized)}">${escapeHtml(formatBookingStatusLabel(normalized))}</span>`;
  return td;
}

function paymentCell(bookingOrStatus) {
  const td = document.createElement('td');
  const booking = bookingOrStatus && typeof bookingOrStatus === 'object' ? bookingOrStatus : { paymentStatus: bookingOrStatus };
  const normalized = normalizePaymentStatusKey(booking.paymentStatus);
  td.innerHTML = `<span class="status-chip payment-${normalized}">${escapeHtml(formatPaymentDisplayLabel(booking))}</span>`;
  return td;
}

function createActionButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'action-btn';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await onClick();
    } catch (error) {
      showNotice({ title: 'Action failed', body: error.message || 'Action failed' });
    }
  });
  return button;
}

function createDangerButton(label, onClick) {
  const button = createActionButton(label, onClick);
  button.classList.add('danger');
  return button;
}

function copyTextToClipboard(value) {
  const text = String(value || '').trim();
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
  }
}

function normalizeNoticeBody(body) {
  if (Array.isArray(body)) {
    return body.map((line) => String(line ?? '')).join('\n').trim();
  }
  return String(body ?? '').trim();
}

function normalizeNoticeType(typeValue, titleValue) {
  const raw = String(typeValue || '').trim().toLowerCase();
  if (['error', 'success', 'warning', 'info'].includes(raw)) return raw;

  const title = String(titleValue || '').trim().toLowerCase();
  if (!title) return 'info';
  if (title.includes('error') || title.includes('failed')) return 'error';
  if (title.includes('success') || title.includes('saved') || title.includes('copied') || title.includes('sent')) return 'success';
  if (title.includes('warning') || title.includes('not allowed') || title.includes('partial')) return 'warning';
  return 'info';
}

function getNoticeAcknowledgementKey(signature) {
  const normalized = String(signature || '').trim();
  return normalized ? `h2h_notice_ack_${normalized}` : '';
}

function isNoticeAcknowledged(signature) {
  const key = getNoticeAcknowledgementKey(signature);
  if (!key) return false;
  try {
    return window.sessionStorage?.getItem(key) === '1';
  } catch {
    return false;
  }
}

function acknowledgeNoticeSignature(signature) {
  const key = getNoticeAcknowledgementKey(signature);
  if (!key) return;
  try {
    window.sessionStorage?.setItem(key, '1');
  } catch {}
}

function showNotice({ title = 'Notice', body = '', type = '' } = {}) {
  const normalizedTitle = String(title || 'Notice').trim() || 'Notice';
  const normalizedBody = normalizeNoticeBody(body);
  const normalizedType = normalizeNoticeType(type, normalizedTitle);
  const noticeSignature = `${normalizedType}::${normalizedTitle}::${normalizedBody}`;
  const shouldSuppressAfterAcknowledgement =
    normalizedType === 'error' && normalizedTitle.toLowerCase().includes('email failed');
  if (shouldSuppressAfterAcknowledgement && isNoticeAcknowledged(noticeSignature)) {
    return;
  }
  const now = Date.now();
  const lastSignature = String(state._lastNoticeSignature || '');
  const lastAt = Number(state._lastNoticeAt || 0);
  if (lastSignature === noticeSignature && now - lastAt < 500) {
    return;
  }
  state._lastNoticeSignature = noticeSignature;
  state._lastNoticeAt = now;

  if (!elements.noticeDialog || !elements.noticeDialogTitle || !elements.noticeDialogBody) {
    alert([normalizedTitle, normalizedBody].filter(Boolean).join('\n\n'));
    return;
  }

  elements.noticeDialogTitle.textContent = normalizedTitle;
  elements.noticeDialogBody.textContent = normalizedBody;
  try {
    elements.noticeDialog.dataset.type = normalizedType;
    elements.noticeDialog.dataset.signature = shouldSuppressAfterAcknowledgement ? noticeSignature : '';
  } catch {}

  try {
    if (elements.noticeDialog.open) {
      // Dialog is already visible; updating content is enough and prevents duplicate popups.
      return;
    }
    if (typeof elements.noticeDialog.showModal === 'function') {
      elements.noticeDialog.showModal();
    } else {
      elements.noticeDialog.setAttribute('open', 'open');
    }
  } catch {
    alert([normalizedTitle, normalizedBody].filter(Boolean).join('\n\n'));
  }
}

function openPortalDocument(url) {
  const targetUrl = buildApiUrl(url);
  const popup = window.open(targetUrl, '_blank');
  if (!popup) {
    console.warn('Popup was blocked. Please allow popups in your browser settings.');
    // Show user notification instead of navigating
    showNotice({
      title: 'Popup blocked',
      body: 'The invoice could not open. Please allow popups and try again.',
    });
    const navigate = confirm('Popup was blocked. Open invoice in this tab instead?');
    if (navigate) {
      window.location.href = targetUrl;
    }
  }
}

function renderAdminHistoryRows(bookings) {
  if (!elements.adminPendingBookingTableBody || !elements.adminPendingEmptyState) return;

  elements.adminPendingBookingTableBody.innerHTML = '';

  if (bookings.length === 0) {
    elements.adminPendingEmptyState.hidden = false;
    return;
  }

  elements.adminPendingEmptyState.hidden = true;

  for (const booking of bookings) {
    const derivedStatus = getDerivedBookingStatus(booking);
    const tr = document.createElement('tr');
    tr.appendChild(multilineCell(`${booking.clientName}\n${booking.clientMobile || '-'}`));
    tr.appendChild(cell(booking.serviceName));
    tr.appendChild(multilineCell(formatAdminBookingDateTime(booking.bookingDate, booking.bookingTime)));
    tr.appendChild(cell(formatBookingCreatedAtIndia(booking.createdAt)));
    tr.appendChild(statusCell(derivedStatus));
    tr.appendChild(paymentCell(booking));

    const emailStatus = String(booking.paymentLinkEmailStatus || '').trim().toLowerCase();
    const emailRecipient = String(booking.paymentLinkRecipientEmail || '').trim();
    const emailSentAt = booking.paymentLinkEmailedAt ? formatDateOnly(booking.paymentLinkEmailedAt) : '';
    const emailError = String(booking.paymentLinkEmailError || '').trim();
    const deliveryStatus = String(booking.paymentLinkDeliveryStatus || '').trim().toLowerCase();
    const deliveryDetail = String(booking.paymentLinkDeliveryDetail || '').trim();
    const deliveryEventAt = booking.paymentLinkEmailEventAt ? formatDateOnly(booking.paymentLinkEmailEventAt) : '';
    let emailCellText = 'Not sent';
    if (emailStatus === 'sent') {
      const finalLabel = deliveryStatus ? `SENT • ${deliveryStatus.toUpperCase()}` : 'SENT';
      emailCellText =
        `${finalLabel}` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${emailSentAt ? `\nRequested: ${emailSentAt}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailStatus === 'failed') {
      const failDetail = deliveryStatus && !emailError ? deliveryStatus : emailError;
      emailCellText =
        `FAILED` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${failDetail ? `\n${failDetail}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail && deliveryDetail !== failDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailRecipient) {
      emailCellText = `Pending\n${emailRecipient}`;
    }
    tr.appendChild(multilineCell(emailCellText));

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'action-row';

    const bookingPaid = String(booking.paymentStatus || 'unpaid').toLowerCase() === 'paid';
    const bookingCancelled = String(booking.status || '').toLowerCase() === 'cancelled';
    const bookingCompleted = String(booking.status || '').toLowerCase() === 'completed';
    const bookingBookableStatus = ['booked', 'confirmed'].includes(String(booking.status || '').toLowerCase());
    const bookingMissed = isBookingMissed(booking);

    if (!bookingCancelled) {
      if (!bookingPaid) {
        actions.append(createActionButton('Paid in Cash', () => markBookingPaidInCash(booking.id)));
        actions.append(createActionButton('Copy Payment Link', () => copyBookingPaymentLink(booking.id)));
      }

    }

    if (canShowBookingInvoice(booking)) {
      actions.append(createActionButton('Invoice', () => openBookingInvoice(booking.id)));
      actions.append(createActionButton('Download Invoice', () => downloadBookingInvoice(booking.id)));
    }

    if (bookingBookableStatus && !bookingCompleted && !bookingCancelled && !bookingMissed) {
      actions.append(createActionButton('Complete', () => markBookingCompleted(booking.id)));
    }

    if (canResendBookingPaymentLink(booking)) {
      actions.append(createActionButton('Resend Payment Link', () => resendPaymentLinkForBooking(booking)));
    }

    if (getAdminScheduleLaterEligibility(booking).allowed) {
      actions.append(createActionButton('Schedule Later', () => handleAdminScheduleLaterAction(booking)));
    }

    actions.append(createActionButton('Notes', () => openBookingNotesDialog(booking.id)));

    actionCell.appendChild(actions);
    tr.appendChild(actionCell);
    elements.adminPendingBookingTableBody.appendChild(tr);
  }
}

function renderAdminAllBookingRows(bookings) {
  if (!elements.adminAllBookingTableBody || !elements.adminAllBookingEmptyState) return;

  elements.adminAllBookingTableBody.innerHTML = '';

  if (bookings.length === 0) {
    elements.adminAllBookingEmptyState.hidden = false;
    return;
  }

  elements.adminAllBookingEmptyState.hidden = true;

  for (const booking of bookings) {
    const derivedStatus = getDerivedBookingStatus(booking);
    const tr = document.createElement('tr');
    tr.appendChild(multilineCell(`${booking.clientName}\n${booking.clientMobile || '-'}`));
    tr.appendChild(cell(booking.serviceName));
    tr.appendChild(multilineCell(formatAdminBookingDateTime(booking.bookingDate, booking.bookingTime)));
    tr.appendChild(cell(formatBookingCreatedAtIndia(booking.createdAt)));
    tr.appendChild(statusCell(derivedStatus));
    tr.appendChild(paymentCell(booking));

    const emailStatus = String(booking.paymentLinkEmailStatus || '').trim().toLowerCase();
    const emailRecipient = String(booking.paymentLinkRecipientEmail || '').trim();
    const emailSentAt = booking.paymentLinkEmailedAt ? formatDateOnly(booking.paymentLinkEmailedAt) : '';
    const emailError = String(booking.paymentLinkEmailError || '').trim();
    const deliveryStatus = String(booking.paymentLinkDeliveryStatus || '').trim().toLowerCase();
    const deliveryDetail = String(booking.paymentLinkDeliveryDetail || '').trim();
    const deliveryEventAt = booking.paymentLinkEmailEventAt ? formatDateOnly(booking.paymentLinkEmailEventAt) : '';
    let emailCellText = 'Not sent';
    if (emailStatus === 'sent') {
      const finalLabel = deliveryStatus ? `SENT • ${deliveryStatus.toUpperCase()}` : 'SENT';
      emailCellText =
        `${finalLabel}` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${emailSentAt ? `\nRequested: ${emailSentAt}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailStatus === 'failed') {
      const failDetail = deliveryStatus && !emailError ? deliveryStatus : emailError;
      emailCellText =
        `FAILED` +
        `${emailRecipient ? `\n${emailRecipient}` : ''}` +
        `${failDetail ? `\n${failDetail}` : ''}` +
        `${deliveryEventAt ? `\nEvent: ${deliveryEventAt}` : ''}` +
        `${deliveryDetail && deliveryDetail !== failDetail ? `\n${deliveryDetail}` : ''}`;
    } else if (emailRecipient) {
      emailCellText = `Pending\n${emailRecipient}`;
    }
    tr.appendChild(multilineCell(emailCellText));

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'action-row';

    const bookingPaid = String(booking.paymentStatus || 'unpaid').toLowerCase() === 'paid';
    const bookingCancelled = String(booking.status || '').toLowerCase() === 'cancelled';
    const bookingCompleted = String(booking.status || '').toLowerCase() === 'completed';
    const bookingBookableStatus = ['booked', 'confirmed'].includes(String(booking.status || '').toLowerCase());
    const bookingMissed = isBookingMissed(booking);

    if (!bookingCancelled) {
      if (!bookingPaid) {
        actions.append(createActionButton('Paid in Cash', () => markBookingPaidInCash(booking.id)));
        actions.append(createActionButton('Copy Payment Link', () => copyBookingPaymentLink(booking.id)));
      }
    }

    if (canShowBookingInvoice(booking)) {
      actions.append(createActionButton('Invoice', () => openBookingInvoice(booking.id)));
      actions.append(createActionButton('Download Invoice', () => downloadBookingInvoice(booking.id)));
    }

    if (bookingBookableStatus && !bookingCompleted && !bookingCancelled && !bookingMissed) {
      actions.append(createActionButton('Complete', () => markBookingCompleted(booking.id)));
    }

    if (canResendBookingPaymentLink(booking)) {
      actions.append(createActionButton('Resend Payment Link', () => resendPaymentLinkForBooking(booking)));
    }

    if (getAdminScheduleLaterEligibility(booking).allowed) {
      actions.append(createActionButton('Schedule Later', () => handleAdminScheduleLaterAction(booking)));
    }

    actions.append(createActionButton('Notes', () => openBookingNotesDialog(booking.id)));

    actionCell.appendChild(actions);
    tr.appendChild(actionCell);
    elements.adminAllBookingTableBody.appendChild(tr);
  }
}

async function fetchInvoiceLink(url, fallbackLabel = 'Invoice') {
  let response = null;
  try {
    response = await fetch(buildApiUrl(url), withApiCredentials());
  } catch (error) {
    throw new Error(error?.message || 'Network error while generating invoice link.');
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Invoice link request returned non-JSON (HTTP ${response.status}). URL: ${response.url || 'unknown'}. ${text ? 'Check server/auth routing.' : ''}`.trim()
    );
  }

  if (!response.ok) {
    throw new Error(data?.message || `Invoice link request failed (HTTP ${response.status}).`);
  }

  if (!data?.invoiceUrl && !data?.invoiceDownloadUrl) {
    throw new Error(`Invoice link missing in server response (HTTP ${response.status}).`);
  }

  return {
    invoiceUrl: data.invoiceUrl || '',
    invoiceDownloadUrl: data.invoiceDownloadUrl || data.invoiceUrl || '',
    fallbackLabel,
  };
}

async function openBookingInvoice(bookingId) {
  const id = Number(bookingId);
  if (!Number.isInteger(id)) return;
  const data = await fetchInvoiceLink(`/api/bookings/${encodeURIComponent(id)}/invoice-link`, `Booking-${id}`);
  if (!data.invoiceUrl) {
    throw new Error('Invoice view link missing in server response.');
  }
  openPortalDocument(data.invoiceUrl);
}

async function openMembershipInvoice(orderId) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) return;
  const data = await fetchInvoiceLink(
    `/api/membership-orders/${encodeURIComponent(normalizedOrderId)}/invoice-link`,
    `Membership-${normalizedOrderId}`
  );
  if (!data.invoiceUrl) {
    throw new Error('Invoice view link missing in server response.');
  }
  openPortalDocument(data.invoiceUrl);
}

async function downloadBookingInvoice(bookingId) {
  const id = Number(bookingId);
  if (!Number.isInteger(id)) return;
  const data = await fetchInvoiceLink(`/api/bookings/${encodeURIComponent(id)}/invoice-link`, `Booking-${id}`);
  await downloadPortalDocument(data.invoiceDownloadUrl, data.fallbackLabel);
}

async function downloadMembershipInvoice(orderId) {
  const normalizedOrderId = String(orderId || '').trim();
  if (!normalizedOrderId) return;
  const data = await fetchInvoiceLink(
    `/api/membership-orders/${encodeURIComponent(normalizedOrderId)}/invoice-link`,
    `Membership-${normalizedOrderId}`
  );
  await downloadPortalDocument(data.invoiceDownloadUrl, data.fallbackLabel);
}

function getFilenameFromContentDisposition(headerValue, fallbackLabel = 'Invoice') {
  const header = String(headerValue || '');
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) {
    try {
      return decodeURIComponent(utfMatch[1]);
    } catch {}
  }
  const match = header.match(/filename="?([^";]+)"?/i);
  if (match?.[1]) return match[1];
  return `Invoice-${String(fallbackLabel || 'Invoice').replace(/[^a-z0-9_-]+/gi, '-')}.pdf`;
}

async function downloadPortalDocument(url, fallbackLabel = 'Invoice') {
  const targetUrl = buildApiUrl(url);
  let response;
  try {
    response = await fetch(targetUrl, { credentials: 'include' });
  } catch {
    throw new Error('Unable to generate the invoice. Please try again later or contact support.');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    if (contentType.includes('application/json')) {
      await response.json().catch(() => null);
      throw new Error('Unable to generate the invoice. Please try again later or contact support.');
    }
    await response.text().catch(() => '');
    throw new Error('Unable to generate the invoice. Please try again later or contact support.');
  }
  if (!contentType.includes('application/pdf')) {
    throw new Error('Unable to generate the invoice. Please try again later or contact support.');
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = getFilenameFromContentDisposition(response.headers.get('content-disposition'), fallbackLabel);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function getMembershipPlanDisplayName(planId) {
  const key = String(planId || '').trim();
  const labelMap = {
    h2_single: '1 Person Membership',
    h2_two: '2 Person Membership',
    h2_four: '4 Person Membership',
    h2_add_person: 'Add Person',
  };
  return labelMap[key] || key || 'Membership';
}

function formatDateOnly(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDateAsDayMonthYear(date);
}

function formatDateAsDayMonthYear(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

function formatBookingDateLabel(dateISO) {
  const match = String(dateISO || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '-';
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, monthIndex, day, 12, 0, 0);
  if (Number.isNaN(date.getTime())) return '-';
  return formatDateAsDayMonthYear(date);
}

function formatBookingTimeLabel(time24) {
  const normalized = normalizeSlotStartTime(String(time24 || '').trim());
  if (!normalized) return '-';
  const slot = SLOT_OPTIONS.find((item) => item.value === normalized);
  if (slot?.label) return slot.label;
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return normalized;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const date = new Date(2000, 0, 1, hours, minutes, 0);
  if (Number.isNaN(date.getTime())) return normalized;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatDateTime(dateISO, time24) {
  if (!dateISO || !time24) return '-';
  return `${formatBookingDateLabel(dateISO)}, ${formatBookingTimeLabel(time24)}`;
}

function formatAdminBookingDateTime(dateISO, time24) {
  if (!dateISO || !time24) return '-';
  return `${formatBookingDateLabel(dateISO)}\n${formatBookingTimeLabel(time24)}`;
}

function formatBookingCreatedAtIndia(value) {
  if (!value) return '-';
  const raw = String(value).trim();
  const normalized = raw.replace(' ', 'T');
  const hasExplicitTimezone = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalized);
  const parsed = Date.parse(hasExplicitTimezone ? normalized : `${normalized}Z`);
  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(date);
}

async function api(url, options = {}) {
  const method = String(options.method || 'GET').trim().toUpperCase();
  const isGuestMode = Boolean(state.isGuestUser && !state.user);
  if (isGuestMode) {
    const normalizedUrl = String(url || '');
    if (method === 'GET' && normalizedUrl === '/api/services') {
      url = '/api/public/services';
    } else if (method === 'GET' && normalizedUrl.startsWith('/api/services/availability')) {
      url = normalizedUrl.replace('/api/services/availability', '/api/public/services/availability');
    } else if (method === 'POST' && normalizedUrl === '/api/bookings') {
      const payload = JSON.parse(String(options.body || '{}'));
      const booking = createGuestCartBooking(payload);
      addGuestCartBookings(booking);
      return { booking, bookings: [booking] };
    } else if (method === 'POST' && normalizedUrl === '/api/hydrogen/book-pack') {
      const payload = JSON.parse(String(options.body || '{}'));
      const bookings = (Array.isArray(payload.slots) ? payload.slots : []).map((slot) =>
        createGuestCartBooking({
          serviceName: payload.serviceName,
          bookingDate: slot.bookingDate,
          bookingTime: slot.bookingTime,
          addOnServiceName: payload.addOnServiceName,
          notes: payload.notes,
        })
      );
      addGuestCartBookings(bookings);
      return { bookings };
    } else if (method === 'DELETE' && /^\/api\/bookings\/[^/]+$/.test(normalizedUrl)) {
      removeGuestCartBooking(decodeURIComponent(normalizedUrl.split('/').pop() || ''));
      return { ok: true };
    }
  }

  const targetUrl = buildApiUrl(url);
  let response;
  try {
    response = await fetch(targetUrl, withApiCredentials(options));
  } catch (fetchError) {
    const networkError = new Error(
      `Network request failed for ${targetUrl}. Check API host, CORS, HTTPS, and server availability.`
    );
    networkError.cause = fetchError;
    throw networkError;
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    let message = data?.message || '';
    if (!message) {
      const text = await response.text().catch(() => '');
      const compact = String(text || '').replace(/\s+/g, ' ').trim();
      const preview = compact ? ` Response: ${compact.slice(0, 180)}` : '';
      message = `Request failed (${response.status}) for ${targetUrl}.${preview}`;
    }
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

function getServiceDisplayName(serviceOrName) {
  const raw =
    typeof serviceOrName === 'string'
      ? serviceOrName
      : serviceOrName && typeof serviceOrName === 'object'
        ? serviceOrName.name
        : '';
  const name = String(raw || '').trim();
  if (!name) return '';
  const normalized = name.toLowerCase();
  if (normalized === 'experience session' || normalized === 'demo session') return 'Demo Hydrogen Session';
  return name;
}

function formatDisplayName(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .map((part) =>
      part
        .split(/(-|')/)
        .map((segment) => {
          if (segment === '-' || segment === "'") return segment;
          const lower = segment.toLowerCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('')
    )
    .join(' ');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&')
    .replaceAll('<', '<')
    .replaceAll('>', '>')
    .replaceAll('"', '"')
    .replaceAll("'", '&#039;');
}

function isValidEmail(value) {
  const normalized = String(value || '').trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function setHydrogenComposerNotice(message = '', type = 'error') {
  state.hydrogenComposerNotice = {
    message: String(message || '').trim(),
    type: String(type || '').trim(),
  };
}

function clearHydrogenComposerNotice() {
  setHydrogenComposerNotice('', '');
}

function renderMyBookingsSessionTracking() {
  if (state.user?.role !== 'user') return;

  const bookings = (state.bookings || []).filter((booking) => String(booking?.status || '').toLowerCase() !== 'cancelled');
  const todayKey = getTodayIsoDate();
  const tracking = getUnifiedHydrogenTrackingSummary(bookings);
  const hydrogenBookings = tracking.hydrogenBookings;
  const scheduleLaterCount = getScheduleLaterDisplayRowCount(bookings);
  const totalSessions = tracking.totalSessions;
  const completedCount = tracking.completedSessions;
  const upcomingCount = tracking.upcomingSessions;
  const upcomingBookings = hydrogenBookings.filter((booking) => {
    const bookingStatus = String(booking?.status || '').toLowerCase();
    if (bookingStatus === 'completed' || bookingStatus === 'cancelled' || bookingStatus === 'schedule_later') return false;
    return booking.bookingDate > todayKey ||
      (booking.bookingDate === todayKey && !isBookingSlotInPast(booking.bookingDate, booking.bookingTime));
  });

  // Update KPI cards
  if (elements.myBookingsTotalSessions) {
    elements.myBookingsTotalSessions.textContent = String(totalSessions);
  }
  if (elements.myBookingsUpcomingCount) {
    elements.myBookingsUpcomingCount.textContent = String(upcomingCount);
  }
  if (elements.myBookingsCompletedCount) {
    elements.myBookingsCompletedCount.textContent = String(completedCount);
  }

  // Progress bar
  const progressPercent = tracking.usagePercent;
  if (elements.myBookingsProgressLabel) {
    elements.myBookingsProgressLabel.textContent = `${completedCount} of ${totalSessions} hydrogen sessions completed`;
  }
  if (elements.myBookingsProgressBar) {
    elements.myBookingsProgressBar.style.width = `${progressPercent}%`;
  }
  if (elements.myBookingsProgressNote) {
    elements.myBookingsProgressNote.textContent = totalSessions === 0
      ? 'No hydrogen sessions booked yet. Book your first hydrogen session to get started.'
      : `${totalSessions - completedCount} hydrogen sessions remaining`;
  }
  if (elements.myBookingsScheduleLaterFooter) {
    elements.myBookingsScheduleLaterFooter.hidden = scheduleLaterCount <= 0;
    elements.myBookingsScheduleLaterFooter.textContent = getScheduleLaterFooterText(scheduleLaterCount);
  }

  // Upcoming sessions list
  if (elements.myBookingsUpcomingList) {
    elements.myBookingsUpcomingList.innerHTML = '';
  }
  if (elements.myBookingsUpcomingEmpty) {
    elements.myBookingsUpcomingEmpty.hidden = upcomingBookings.length > 0;
  }

  const sortedUpcoming = upcomingBookings
    .sort((a, b) => `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`))
    .slice(0, 5);

  sortedUpcoming.forEach((booking) => {
    const item = document.createElement('div');
    item.className = 'my-bookings-upcoming-item';
    const derivedStatus = getDerivedBookingStatus(booking);
    item.innerHTML = `
      <div class="my-bookings-upcoming-info">
        <strong>${escapeHtml(booking.serviceName)}</strong>
        <span>${formatDateTime(booking.bookingDate, booking.bookingTime)}</span>
      </div>
      <span class="status-chip status-${escapeHtml(derivedStatus)}">${escapeHtml(derivedStatus)}</span>
    `;
    elements.myBookingsUpcomingList?.appendChild(item);
  });

  // Calendar
  if (elements.myBookingsCalendarGrid && elements.myBookingsCalendarMonth) {
    const today = new Date();
    const year = today.getFullYear();
    const monthIndex = today.getMonth();
    elements.myBookingsCalendarMonth.textContent = getCalendarMonthLabel(today);

    const firstOfMonth = new Date(year, monthIndex, 1);
    const startDay = firstOfMonth.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const bookedByDate = buildBookingsByDate(hydrogenBookings, year, monthIndex);
    const todayKey2 = getCalendarDateKey(year, monthIndex, today.getDate());

    if (!state.myBookingsCalendarSelectedDate || !state.myBookingsCalendarSelectedDate.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}-`)) {
      const bookedDates = Array.from(bookedByDate.keys()).sort();
      state.myBookingsCalendarSelectedDate = bookedDates[0] || todayKey2;
    }

    elements.myBookingsCalendarGrid.innerHTML = '';
    const totalCells = 42;
    for (let index = 0; index < totalCells; index += 1) {
      const dayNumber = index - startDay + 1;
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'my-bookings-calendar-day';
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.classList.add('is-outside');
        cell.disabled = true;
        cell.textContent = '';
      } else {
        const dateKey = getCalendarDateKey(year, monthIndex, dayNumber);
        cell.textContent = String(dayNumber);
        if (dateKey === todayKey2) cell.classList.add('is-today');
        if (dateKey === state.myBookingsCalendarSelectedDate) cell.classList.add('is-selected');
        if (bookedByDate.has(dateKey)) cell.classList.add('is-booked');
        if (hasUpcomingBookedSession(bookedByDate.get(dateKey) || [])) cell.classList.add('is-upcoming-booked');
        cell.addEventListener('click', () => {
          state.myBookingsCalendarSelectedDate = dateKey;
          renderMyBookingsSessionTracking();
        });
      }
      elements.myBookingsCalendarGrid.appendChild(cell);
    }

    // Calendar details
    if (elements.myBookingsCalendarDetails) {
      const selectedDate = state.myBookingsCalendarSelectedDate;
      const label = formatBookingDateLabel(selectedDate);
      const dayBookings = bookedByDate.get(selectedDate) || [];

      if (!dayBookings.length) {
        elements.myBookingsCalendarDetails.innerHTML = `
          <div>${escapeHtml(label)}</div>
          <span>No hydrogen sessions booked.</span>
        `;
      } else {
        const lines = dayBookings.slice(0, 3).map((booking) => `
          <div class="my-bookings-calendar-detail-item">
            <strong>${escapeHtml(booking.serviceName || 'Hydrogen Session')}</strong>
            <span>${escapeHtml(formatBookingTimeLabel(booking.bookingTime))} • ${escapeHtml(getDerivedBookingStatus(booking))}</span>
          </div>
        `).join('');
        const moreCount = dayBookings.length - 3;
        const moreLine = moreCount > 0 ? `<span>+${moreCount} more</span>` : '';
        elements.myBookingsCalendarDetails.innerHTML = `
          <div>${escapeHtml(label)}</div>
          ${lines}
          ${moreLine}
        `;
      }
    }
  }
}
