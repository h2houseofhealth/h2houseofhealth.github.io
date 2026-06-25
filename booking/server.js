const fs = require('fs');
const https = require('https');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let session;
try {
  session = require('express-session');
} catch {
  session = require('./session-fallback');
}
let passport;
try {
  passport = require('passport');
} catch {
  passport = require('./passport-fallback');
}
let GoogleStrategy;
try {
  ({ Strategy: GoogleStrategy } = require('passport-google-oauth20'));
} catch {
  GoogleStrategy = null;
}
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const Mailgun = require('mailgun.js');
const formData = require('form-data');
const Razorpay = require('razorpay');
const multer = require('multer');
let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch {
  puppeteer = null;
}

loadEnvFromFile(path.join(__dirname, '.env'));

const PORT = process.env.PORT || 3000;
const WEBSITE_ROOT = path.resolve(__dirname, '..');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_super_secret_change_me';
const IS_PRODUCTION = normalizeEnvValue(process.env.NODE_ENV).toLowerCase() === 'production';
const AUTH_COOKIE_SECURE_MODE = normalizeEnvValue(process.env.AUTH_COOKIE_SECURE || 'auto').toLowerCase();
const GOOGLE_CLIENT_ID = normalizeEnvValue(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_CLIENT_SECRET = normalizeEnvValue(process.env.GOOGLE_CLIENT_SECRET);
const GOOGLE_CALLBACK_URL = normalizeEnvValue(process.env.GOOGLE_CALLBACK_URL);
const GOOGLE_OAUTH_ENABLED = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_CALLBACK_URL);
const ALLOW_DEV_OTP_FALLBACK = normalizeEnvValue(process.env.ALLOW_DEV_OTP_FALLBACK || 'true').toLowerCase() !== 'false';
const SHOW_DEV_OTP_OVERRIDE = parseBooleanEnv(process.env.SHOW_DEV_OTP_IN_UI, false);
const SHOW_DEV_OTP_IN_UI = ALLOW_DEV_OTP_FALLBACK && (!IS_PRODUCTION || SHOW_DEV_OTP_OVERRIDE);
const TOKEN_COOKIE = 'booking_portal_token';
const ALLOWED_SLOT_START_TIMES = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'];
const LEGACY_ALLOWED_SLOT_START_TIMES = ['10:30', '11:30', '12:30', '13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'];
const MAX_BOOKINGS_PER_SLOT_HYDROGEN = 8;
const MAX_BOOKINGS_PER_SLOT_IV = 1;
const MAX_HYDROGEN_SESSIONS_PER_DAY_PER_USER = 4;
const IV_REBOOK_COOLDOWN_DAYS = 14;
const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = (() => {
  const candidate = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 30);
  if (!Number.isFinite(candidate)) return 30;
  return Math.min(Math.max(Math.floor(candidate), 5), 300);
})();
const BOOKING_HOLD_MINUTES = 10;
const BOOKING_HOLD_CUTOFF_SQL = `datetime('now', '-${BOOKING_HOLD_MINUTES} minutes')`;
const BOOKING_STATUSES = ['pending', 'booked', 'confirmed', 'completed', 'cancelled', 'schedule_later'];
const FRONTEND_ORIGINS = String(process.env.FRONTEND_ORIGINS || process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((value) => normalizeOriginValue(value))
  .filter(Boolean);
const DEPLOYMENT_ORIGINS = [
  normalizeOriginValue(process.env.PUBLIC_APP_URL || ''),
  normalizeOriginValue(process.env.API_BASE_URL || ''),
].filter(Boolean);
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const ALLOWED_CORS_ORIGINS = Array.from(
  new Set([...DEFAULT_ALLOWED_ORIGINS, ...FRONTEND_ORIGINS, ...DEPLOYMENT_ORIGINS].map(normalizeOriginValue).filter(Boolean))
);
const HAS_EXPLICIT_CORS_ORIGINS = FRONTEND_ORIGINS.length > 0 || DEPLOYMENT_ORIGINS.length > 0;
console.log('FRONTEND_ORIGINS:', process.env.FRONTEND_ORIGINS || '');
console.log('HAS_EXPLICIT_CORS_ORIGINS:', HAS_EXPLICIT_CORS_ORIGINS);
console.log('ALLOWED_CORS_ORIGINS:', ALLOWED_CORS_ORIGINS);
const ADMIN_DISCOUNT_GATE_PASSWORD = normalizeEnvValue(process.env.ADMIN_DISCOUNT_GATE_PASSWORD || 'H2-FOUNDERS-2026');
const RAZORPAY_KEY_ID = normalizeEnvValue(process.env.RAZORPAY_KEY_ID);
const RAZORPAY_KEY_SECRET = normalizeEnvValue(process.env.RAZORPAY_KEY_SECRET);
const RAZORPAY_MODE = normalizeEnvValue(process.env.RAZORPAY_MODE || 'test').toLowerCase() || 'test';
const SENDGRID_API_KEY = normalizeEnvValue(process.env.SENDGRID_API_KEY);
const SENDGRID_FROM_EMAIL = normalizeEnvValue(
  process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER || ''
);
const SENDGRID_VERIFIED_SENDER = normalizeEnvValue(process.env.SENDGRID_VERIFIED_SENDER || '');
const SENDGRID_OTP_FROM_EMAIL = normalizeEnvValue(process.env.SENDGRID_OTP_FROM_EMAIL || SENDGRID_FROM_EMAIL);
const SENDGRID_BOOKING_FROM_EMAIL = normalizeEnvValue(
  process.env.SENDGRID_BOOKING_FROM_EMAIL || deriveBookingSenderEmail(SENDGRID_FROM_EMAIL)
);
const SENDGRID_MARKETING_FROM_EMAIL = normalizeEnvValue(process.env.SENDGRID_MARKETING_FROM_EMAIL || SENDGRID_BOOKING_FROM_EMAIL);
const SENDGRID_OTP_VERIFIED_SENDER = normalizeEnvValue(process.env.SENDGRID_OTP_VERIFIED_SENDER || SENDGRID_VERIFIED_SENDER);
const SENDGRID_BOOKING_VERIFIED_SENDER = normalizeEnvValue(
  process.env.SENDGRID_BOOKING_VERIFIED_SENDER || SENDGRID_VERIFIED_SENDER
);
const SENDGRID_MARKETING_VERIFIED_SENDER = normalizeEnvValue(
  process.env.SENDGRID_MARKETING_VERIFIED_SENDER || SENDGRID_VERIFIED_SENDER
);
const MARKETING_LIST_UNSUBSCRIBE = normalizeEnvValue(process.env.MARKETING_LIST_UNSUBSCRIBE || '');
const SENDGRID_WEBHOOK_PUBLIC_KEY = normalizeEnvValue(process.env.SENDGRID_WEBHOOK_PUBLIC_KEY || '');
const SENDGRID_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const MAILGUN_API_KEY = normalizeEnvValue(process.env.MAILGUN_API_KEY || '');
const MAILGUN_DOMAIN = normalizeEnvValue(process.env.MAILGUN_DOMAIN || '');
const MAIL_FROM = normalizeEnvValue(
  process.env.MAIL_FROM || 'noreply@h2houseofhealth.com'
);
const BUSINESS_GSTIN = normalizeEnvValue(process.env.BUSINESS_GSTIN || process.env.GSTIN || '');
const AVATAR_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const SEED_DEMO_DOCTORS = normalizeEnvValue(process.env.SEED_DEMO_DOCTORS || 'false').toLowerCase() === 'true';
const SES_API_REGION = (
  normalizeEnvValue(process.env.SES_API_REGION) ||
  normalizeEnvValue(process.env.AWS_REGION) ||
  regionFromSmtpHost(normalizeEnvValue(process.env.SMTP_HOST)) ||
  'ap-southeast-2'
).trim();
const SES_API_ACCESS_KEY_ID = normalizeEnvValue(process.env.SES_API_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '');
const SES_API_SECRET_ACCESS_KEY = (
  normalizeEnvValue(process.env.SES_API_SECRET_ACCESS_KEY) ||
  normalizeEnvValue(process.env.AWS_SECRET_ACCESS_KEY) ||
  ''
).trim();
const SES_API_SESSION_TOKEN = normalizeEnvValue(process.env.SES_API_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || '');

function normalizeSlotStartTime(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (ALLOWED_SLOT_START_TIMES.includes(normalized)) return normalized;

  if (LEGACY_ALLOWED_SLOT_START_TIMES.includes(normalized)) {
    const match = normalized.match(/^(\d{2}):30$/);
    if (match) return `${match[1]}:00`;
  }

  return '';
}

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}
const mailgun = new Mailgun(formData);

const mg =
  MAILGUN_API_KEY && MAILGUN_DOMAIN
    ? mailgun.client({
        username: 'api',
        key: MAILGUN_API_KEY,
      })
    : null;

async function sendMailgunEmail({ to, from, subject, text, html }) {
  if (!mg) {
    throw new Error('Mailgun is not configured');
  }

  return mg.messages.create(MAILGUN_DOMAIN, {
    from: from || MAIL_FROM,
    to,
    subject,
    text,
    html,
  });
}
const SERVICE_CATALOG = [
  {
    category: 'EXPERIENCE SESSION',
    name: 'Experience Session',
    priceInr: 4000,
    includes: '30 min consultation + hydrogen session',
    description: 'Demo hydrogen session for non-members with consultation.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 Single Session',
    priceInr: 4067.8,
    nonMemberPriceInr: 8050.85,
    memberPriceInr: 4067.8,
    includes: '1 Hydrogen Session',
    description:
      'Single hydrogen session for immediate recovery and cellular wellness support. Non-member pricing: Rs. 9,500.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 1 Week Program (4 Sessions)',
    priceInr: 10169.49,
    nonMemberPriceInr: 23728.81,
    memberPriceInr: 10169.49,
    includes: '4 Hydrogen Sessions in 1 week',
    description:
      'Structured weekly session plan designed for consistency and better recovery outcomes. Non-member pricing: Rs. 28,000.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 2 Week Program (8 Sessions)',
    priceInr: 18644.07,
    nonMemberPriceInr: 40677.97,
    memberPriceInr: 18644.07,
    includes: '8 Hydrogen Sessions in 2 weeks',
    description:
      'Enhanced two-week protocol to support sustained detox and energy optimization. Non-member pricing: Rs. 48,000.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 1 Month Program (16 Sessions)',
    priceInr: 27118.64,
    nonMemberPriceInr: 54237.29,
    memberPriceInr: 27118.64,
    includes: '16 Hydrogen Sessions in 1 month',
    description:
      'Monthly core plan for ongoing metabolic, inflammation, and vitality support. Non-member pricing: Rs. 64,000.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 2 Month Program (32 Sessions)',
    priceInr: 54237.29,
    nonMemberPriceInr: 108474.58,
    memberPriceInr: 54237.29,
    includes: '32 Hydrogen Sessions in 2 months',
    description:
      'Extended plan for sustained recovery and performance support with consistent hydrogen sessions. Non-member pricing: Rs. 1,28,000.',
  },
  {
    category: 'HYDROGEN SESSION',
    name: 'H2 Intensive 3 Month (90 Sessions)',
    priceInr: 84745.76,
    nonMemberPriceInr: 127118.64,
    memberPriceInr: 84745.76,
    includes: '90 Hydrogen Sessions in 3 months',
    description:
      'Long-cycle intensive plan built for deep and sustained wellness transformation. Non-member pricing: Rs. 1,50,000.',
  },
  {
    category: 'MEMBERSHIP SERVICES',
    name: 'Lab Tests',
    priceInr: 0,
    membershipOnly: true,
    includes: 'Comprehensive lab panel included for active members.',
    description: 'Membership-only benefit. Included in active membership.',
  },
  {
    category: 'MEMBERSHIP SERVICES',
    name: 'Oxidative Stress Marker Test',
    priceInr: 0,
    membershipOnly: true,
    includes: 'Oxidative stress marker test included for active members.',
    description: 'Membership-only benefit. Included in active membership.',
  },
  {
    category: 'MEMBERSHIP SERVICES',
    name: 'Radiology Services',
    priceInr: 0,
    membershipOnly: true,
    includes: 'Radiology services included for active members.',
    description: 'Membership-only benefit. Included in active membership.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Gym Hero',
    priceInr: 4067.8,
    includes: 'Normal saline, B1, B2, B6, B12, Vitamin C, Magnesium, Glutathione',
    description:
      'Designed for fitness enthusiasts to support muscle recovery, hydration, energy production, and antioxidant support after intense workouts.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Skin Luminosity',
    priceInr: 5000,
    includes: 'B1, B2, B6, B12, Vitamin C, Biotin, Zinc, Glutathione',
    description:
      'Promotes brighter, clearer skin by supporting collagen production, antioxidant protection, and overall skin health.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Ultimate Immunity',
    priceInr: 5508.47,
    includes: 'Vitamin C, N-Acetyl Cysteine (NAC), Zinc, B1, B2, B6, B12, Alpha Lipoic Acid, Glutathione',
    description:
      'A powerful immune support blend that helps fight infections, reduce oxidative stress, and improve overall wellness.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Hangover Cure',
    priceInr: 3813.56,
    includes: 'Normal saline, B1, B2, B6, B12, Glutathione, Magnesium, Ketorol, Ondansetron',
    description:
      'Rehydrates the body, relieves nausea and headache, and restores energy levels after alcohol consumption.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Migraine',
    priceInr: 3813.56,
    includes: 'B1, B2, B6, B12, Magnesium, Ondansetron, Ketorol',
    description:
      'Helps reduce migraine intensity by easing pain, correcting deficiencies, and relieving nausea.',
  },
  {
    category: 'IV THERAPIES',
    name: 'Stress Buster',
    priceInr: 3813.56,
    includes: 'B1, B2, B6, B12, Vitamin C, Magnesium, Zinc',
    description:
      'Supports nervous system balance, reduces fatigue, and helps manage physical and mental stress.',
  },
  {
    category: 'IV THERAPIES',
    name: 'The House Drip',
    priceInr: 6355.93,
    includes:
      'B1, B2, B6, B12, Folic Acid, Vitamin C, Magnesium, Alpha Lipoic Acid, N-Acetyl Cysteine, Zinc, Biotin, L-Arginine, L-Carnitine',
    description:
      'A comprehensive wellness infusion designed for energy, immunity, detox support, metabolism, and overall vitality.',
  },
  {
    category: 'IV SHOTS',
    name: 'Recharge',
    priceInr: 1949.15,
    includes: 'B1, B2, B6, B12, Vitamin C',
    description: 'Quick energy booster that helps reduce fatigue and improve daily performance.',
  },
  {
    category: 'IV SHOTS',
    name: 'Focus',
    priceInr: 2457.63,
    includes: 'B1, B2, B6, B12, Glutathione',
    description: 'Supports mental clarity, concentration, and antioxidant protection.',
  },
  {
    category: 'IV SHOTS',
    name: 'Relax',
    priceInr: 2033.9,
    includes: 'Magnesium, Zinc, B1, B2, B6',
    description: 'Helps calm the nervous system, ease muscle tension, and promote relaxation.',
  },
  {
    category: 'IV SHOTS',
    name: 'Beauty',
    priceInr: 2966.1,
    includes: 'B1, B2, B3, B5, B6, Biotin, Vitamin C, Zinc, Glutathione',
    description: 'Enhances skin glow, supports hair and nail strength, and provides antioxidant benefits.',
  },
  {
    category: 'IV SHOTS',
    name: 'Gym Pump',
    priceInr: 2796.61,
    includes: 'B1, B2, B6, Glutathione, L-Arginine, L-Carnitine',
    description: 'Improves blood flow, endurance, and workout performance.',
  },
  {
    category: 'IV SHOTS',
    name: 'Detox',
    priceInr: 3220.34,
    includes: 'Vitamin C, N-Acetyl Cysteine, Zinc, Glutathione',
    description: 'Supports liver function, detoxification pathways, and cellular antioxidant defense.',
  },
  {
    category: 'IV SHOTS',
    name: 'Immunity Boost',
    priceInr: 3305.08,
    includes: 'B1, B2, B6, Vitamin C, N-Acetyl Cysteine, Zinc, Glutathione',
    description: 'Strengthens immune response and helps protect against infections.',
  },
  {
    category: 'IV SHOTS',
    name: 'The House Push',
    priceInr: 4067.8,
    includes: 'B1, B2, B6, B12, Vitamin C, Biotin, N-Acetyl Cysteine, Zinc, Glutathione',
    description: 'A premium wellness shot designed for full-body support, energy enhancement, and immune strengthening.',
  },
];

const MEMBERSHIP_PLANS = [
  {
    id: 'h2_single',
    name: '1 Person Membership',
    peopleCount: 1,
    priceInr: 71186.44,
    validityDays: 90,
    h2SessionsIncluded: 16,
    perks:
      'Includes lab tests, oxidative stress marker test, radiology services, concierge primary care, and 16 H2 sessions.',
  },
  {
    id: 'h2_two',
    name: '2 Person Membership',
    peopleCount: 2,
    priceInr: 135593.22,
    validityDays: 90,
    h2SessionsIncluded: 32,
    perks: '',
  },
  {
    id: 'h2_four',
    name: '4 Person Membership',
    peopleCount: 4,
    priceInr: 244067.8,
    validityDays: 90,
    h2SessionsIncluded: 64,
    perks: '',
  },
  {
    id: 'h2_add_person',
    name: 'Add Person',
    peopleCount: 1,
    priceInr: 66101.69,
    validityDays: 90,
    h2SessionsIncluded: 16,
    perks:
      'Add one more member to an existing plan with lab tests, oxidative stress marker test, radiology services, and hydrogen pricing benefits.',
  },
];
const MEMBERSHIP_VALIDITY_DAYS = Number(MEMBERSHIP_PLANS.find((plan) => plan.id === 'h2_single')?.validityDays || 90);
const HYDROGEN_FREE_SESSIONS_PER_USER = 16;

const app = express();
const connection = require("./config/db");
const cors = require("cors");
const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }
    const normalizedOrigin = normalizeOriginValue(origin);
    if (!HAS_EXPLICIT_CORS_ORIGINS) {
      // Fallback for deployments where FRONTEND_ORIGINS/API_BASE_URL is not configured yet.
      callback(null, true);
      return;
    }
    if (ALLOWED_CORS_ORIGINS.includes(normalizedOrigin) || isLocalDevOrigin(normalizedOrigin)) {
      callback(null, true);
      return;
    }
    const error = new Error(`CORS origin not allowed: ${normalizedOrigin || origin}`);
    error.status = 403;
    callback(error);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('/{*any}', cors(corsOptions));
app.use((err, req, res, next) => {
  if (String(err?.message || '').toLowerCase().includes('cors origin not allowed')) {
    return res.status(Number(err?.status || 403)).json({
      message: 'CORS origin not allowed for this API. Add your frontend URL to FRONTEND_ORIGINS.',
      origin: String(req.headers.origin || ''),
    });
  }
  return next(err);
});
app.set('trust proxy', 1);
const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const uploadsDir = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'));
const dbPath = path.join(dataDir, 'booking.db');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
const razorpayConfigError = getRazorpayConfigError();
const RAZORPAY_UNAVAILABLE_MESSAGE = razorpayConfigError || 'Razorpay is not configured';
const razorpay = !razorpayConfigError
  ? new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET })
  : null;

if (razorpayConfigError && (RAZORPAY_KEY_ID || RAZORPAY_KEY_SECRET || process.env.RAZORPAY_MODE)) {
  console.warn(`Razorpay disabled: ${razorpayConfigError}`);
}

migrate();
seedAdmin();
configureGoogleOAuth();

const requestCounters = new Map();

function loadEnvFromFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = String(rawLine || '').trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalizeEnvValue(value) {
  let normalized = String(value || '').trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }
  return normalized;
}

function parseBooleanEnv(value, fallback = false) {
  const normalized = normalizeEnvValue(value).toLowerCase();
  if (!normalized) return fallback;
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function normalizeOriginValue(value) {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return '';
  return normalized.replace(/\/+$/, '');
}

function isLocalDevOrigin(origin) {
  const normalized = normalizeOriginValue(origin);
  if (!normalized) return false;
  try {
    const parsed = new URL(normalized);
    const host = String(parsed.hostname || '').toLowerCase();
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function deriveBookingSenderEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized;
  const [, domain = ''] = normalized.split('@');
  if (!domain) return normalized;
  return `bookings@${domain}`;
}

function buildMarketingHeaders() {
  const rawValue = String(MARKETING_LIST_UNSUBSCRIBE || '').trim();
  if (!rawValue) return {};
  const value = rawValue.includes('<') ? rawValue : `<${rawValue}>`;
  return {
    'List-Unsubscribe': value,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

function uniqueValidEmails(values = []) {
  const seen = new Set();
  const emails = [];
  for (const value of values) {
    const email = String(value || '').trim().toLowerCase();
    if (!email || seen.has(email) || !isValidEmail(email)) continue;
    seen.add(email);
    emails.push(email);
  }
  return emails;
}

function getSendGridBookingSenderCandidates() {
  return uniqueValidEmails([
    SENDGRID_BOOKING_FROM_EMAIL,
    SENDGRID_BOOKING_VERIFIED_SENDER,
    SENDGRID_FROM_EMAIL,
    SENDGRID_OTP_FROM_EMAIL,
  ]);
}

function extractSendGridErrorDetails(error) {
  const statusCode = Number(error?.code || error?.response?.statusCode || 500);
  const body = error?.response?.body;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const detail = errors
    .map((entry) => String(entry?.message || entry?.field || '').trim())
    .filter(Boolean)
    .join(' | ');

  return {
    statusCode,
    detail,
    responseBody: body || null,
  };
}

const TRACKED_PAYMENT_LINK_EVENTS = new Set(['delivered', 'open', 'click', 'bounce', 'deferred', 'spamreport', 'dropped']);

function normalizePaymentLinkEventName(value) {
  const eventName = String(value || '').trim().toLowerCase();
  if (!eventName) return '';
  if (eventName === 'opened') return 'open';
  if (eventName === 'clicked') return 'click';
  if (eventName === 'bounced') return 'bounce';
  return eventName;
}

function buildPaymentLinkEventDedupeKey({ bookingId, eventName, recipient, messageId, sgEventId, eventAt, detail }) {
  const source = [
    String(bookingId || ''),
    String(eventName || ''),
    String(recipient || '').toLowerCase(),
    String(messageId || ''),
    String(sgEventId || ''),
    String(eventAt || ''),
    String(detail || ''),
  ].join('|');
  return crypto.createHash('sha256').update(source).digest('hex');
}

function parseIsoDateOnly(value) {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  return normalized;
}

function buildDateRangeFilter({ startDate, endDate, sqlColumn }) {
  const from = parseIsoDateOnly(startDate);
  const to = parseIsoDateOnly(endDate);
  if (from && to && from > to) {
    return { error: 'startDate cannot be after endDate' };
  }
  const clauses = [];
  const params = [];
  if (from) {
    clauses.push(`date(${sqlColumn}) >= date(?)`);
    params.push(from);
  }
  if (to) {
    clauses.push(`date(${sqlColumn}) <= date(?)`);
    params.push(to);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', params, from, to };
}

async function verifySendGridWebhookSignature(req) {
  if (!SENDGRID_WEBHOOK_PUBLIC_KEY) {
    if (IS_PRODUCTION) {
      return { ok: false, statusCode: 500, message: 'SENDGRID_WEBHOOK_PUBLIC_KEY is not configured.' };
    }
    return { ok: true, skipped: true };
  }

  const signature = String(req.headers['x-twilio-email-event-webhook-signature'] || '').trim();
  const timestamp = String(req.headers['x-twilio-email-event-webhook-timestamp'] || '').trim();
  if (!signature || !timestamp) {
    return { ok: false, statusCode: 401, message: 'Missing SendGrid webhook signature headers.' };
  }

  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > SENDGRID_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, statusCode: 401, message: 'Webhook signature timestamp is outside tolerance window.' };
  }

  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || []);
  const publicKeyBytes = Buffer.from(SENDGRID_WEBHOOK_PUBLIC_KEY, 'base64');
  const signatureBytes = Buffer.from(signature, 'base64');
  if (!publicKeyBytes.length || !signatureBytes.length) {
    return { ok: false, statusCode: 401, message: 'Invalid SendGrid webhook signature encoding.' };
  }

  try {
    const key = await crypto.webcrypto.subtle.importKey('raw', publicKeyBytes, { name: 'Ed25519' }, false, ['verify']);
    const payload = Buffer.from(`${timestamp}${rawBody}`, 'utf8');
    const verified = await crypto.webcrypto.subtle.verify('Ed25519', key, signatureBytes, payload);
    if (!verified) {
      return { ok: false, statusCode: 401, message: 'SendGrid webhook signature verification failed.' };
    }
    return { ok: true };
  } catch (error) {
    console.error('SendGrid webhook signature verification error:', String(error?.message || error));
    return { ok: false, statusCode: 401, message: 'Unable to verify SendGrid webhook signature.' };
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getRazorpayConfigError() {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return 'Razorpay is not configured';
  }

  if (RAZORPAY_MODE !== 'test') {
    return 'Razorpay live mode is blocked. Set RAZORPAY_MODE=test.';
  }

  if (!RAZORPAY_KEY_ID.startsWith('rzp_test_')) {
    return 'Razorpay live keys are blocked. Use rzp_test_* credentials.';
  }

  return null;
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      if (String(req.originalUrl || '').startsWith('/api/webhooks/sendgrid')) {
        req.rawBody = buf.toString('utf8');
      }
    },
  })
);
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON received:', req.method, req.originalUrl || req.url);
    return res.status(400).json({ message: 'Invalid JSON body.' });
  }
  return next(err);
});
app.get("/users", (req, res) => {
  connection.query("SELECT * FROM users", (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});
app.use(cookieParser());
app.use(
  session({
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: getSessionCookieOptions(),
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
  const pathName = String(req.path || '');
  if (
    pathName === '/booking/app.js' ||
    pathName === '/booking/index.html' ||
    pathName === '/booking/styles.css'
  ) {
    res.setHeader('Cache-Control', 'no-store');
  }
  return next();
});
app.use('/booking', express.static(path.join(__dirname)));
app.use('/uploads', express.static(uploadsDir));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      cb(null, `avatar_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: {
    fileSize: AVATAR_MAX_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('Only JPG, PNG, or WEBP images are allowed'), ok);
  },
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/auth/google', ensureGoogleOAuthConfigured, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', ensureGoogleOAuthConfigured, (req, res, next) => {
  passport.authenticate('google', { session: true }, (error, user) => {
    if (error) {
      console.error('Google OAuth callback error:', String(error?.message || error));
      return res.redirect('/booking/?auth_error=google');
    }

    if (!user) {
      return res.redirect('/booking/?auth_error=google');
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        console.error('Google OAuth login error:', String(loginError?.message || loginError));
        return res.redirect('/booking/?auth_error=google');
      }

      const token = setAuthCookie(req, res, user);
      return res.redirect(`/booking/#auth_token=${encodeURIComponent(token)}`);
    });
  })(req, res, next);
});

app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 40 }));

app.post('/api/auth/register/start', async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!name || !email) {
    return res.status(400).json({ message: 'name and email are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'valid email is required' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ message: 'email already registered' });
  }

  const pendingCooldown = db
    .prepare("SELECT strftime('%s', created_at) AS createdAtEpoch FROM pending_registrations WHERE email = ?")
    .get(email);
  const pendingCreatedAtMs = Number(pendingCooldown?.createdAtEpoch || 0) * 1000;
  if (pendingCreatedAtMs > 0) {
    const elapsedMs = Date.now() - pendingCreatedAtMs;
    if (elapsedMs >= 0 && elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds}s before requesting another signup OTP.`,
        retryAfterSeconds,
      });
    }
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const placeholderPasswordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  db.prepare(
    `INSERT INTO pending_registrations (email, name, password_hash, otp_hash, expires_at, attempts_left, otp_verified, created_at)
     VALUES (?, ?, ?, ?, ?, 5, 0, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET
       name = excluded.name,
       password_hash = excluded.password_hash,
       otp_hash = excluded.otp_hash,
       expires_at = excluded.expires_at,
       attempts_left = 5,
       otp_verified = 0,
       created_at = datetime('now')`
  ).run(email, name, placeholderPasswordHash, otpHash, expiresAt);

  const mailResult = await sendOtpEmail(email, otp, 'signup');
  if (!mailResult.ok) {
    return res.status(mailResult.statusCode || 500).json({ message: mailResult.message });
  }

  const responsePayload = {
    message: mailResult.message || `Signup OTP sent to ${email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    otpRequired: true,
    verificationRequired: true,
  };
  if (SHOW_DEV_OTP_IN_UI) {
    responsePayload.devOtp = otp;
  }
  return res.status(200).json(responsePayload);
});

app.post('/api/auth/register', async (_req, res) => {
  return res.status(410).json({
    message: 'Signup flow changed. Use /api/auth/register/start, /api/auth/register/verify, and /api/auth/register/complete.',
  });
});

app.post('/api/auth/register/verify-email', async (req, res) => {
  return res.status(410).json({
    message: 'Use /api/auth/register/start with name and email to begin signup.',
  });
});

app.post('/api/auth/register/verify', (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) {
    return res.status(400).json({ message: 'email and otp are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const pending = db.prepare(
    `SELECT email, name, otp_hash AS otpHash, expires_at AS expiresAt, attempts_left AS attemptsLeft, otp_verified AS otpVerified
     FROM pending_registrations
     WHERE email = ?`
  ).get(normalizedEmail);

  if (!pending) {
    return res.status(404).json({ message: 'No pending registration found. Please register again.' });
  }

  if (Number(pending.otpVerified) === 1) {
    return res.json({
      verified: true,
      verificationStatus: 'SUCCESS',
      message: 'OTP already verified. Please set your password to complete signup.',
    });
  }

  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(normalizedEmail);
    return res.status(400).json({ message: 'OTP expired. Please register again.' });
  }

  const isOtpValid = hashOtp(String(otp).trim()) === pending.otpHash;
  if (!isOtpValid) {
    db.prepare(
      'UPDATE pending_registrations SET attempts_left = attempts_left - 1 WHERE email = ?'
    ).run(normalizedEmail);

    const updated = db
      .prepare('SELECT attempts_left AS attemptsLeft FROM pending_registrations WHERE email = ?')
      .get(normalizedEmail);

    if (!updated || updated.attemptsLeft <= 0) {
      db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(normalizedEmail);
      return res.status(400).json({ message: 'Too many invalid OTP attempts. Please register again.' });
    }

    return res.status(400).json({ message: `Invalid OTP. ${updated.attemptsLeft} attempts left.` });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (existingUser) {
    db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(normalizedEmail);
    return res.status(409).json({ message: 'email already registered' });
  }

  db.prepare(
    `UPDATE pending_registrations
     SET otp_verified = 1, otp_hash = '', expires_at = datetime('now'), attempts_left = 0
     WHERE email = ?`
  ).run(normalizedEmail);

  return res.json({
    verified: true,
    verificationStatus: 'SUCCESS',
    message: 'OTP verified. Now set your password to complete signup.',
  });
});

app.post('/api/auth/register/complete', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'password must be at least 8 characters' });
  }

  const pending = db.prepare(
    `SELECT email, name, otp_verified AS otpVerified
     FROM pending_registrations
     WHERE email = ?`
  ).get(email);
  if (!pending) {
    return res.status(404).json({ message: 'No pending signup found. Start registration again.' });
  }

  if (Number(pending.otpVerified) !== 1) {
    return res.status(400).json({ message: 'Please verify signup OTP first.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(email);
    return res.status(409).json({ message: 'email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'user', datetime('now'))`
    )
    .run(String(pending.name || '').trim() || 'User', email, passwordHash);

  db.prepare('DELETE FROM pending_registrations WHERE email = ?').run(email);

  const user = syncMembershipForUser({ userId: Number(result.lastInsertRowid), email }) || {
    id: Number(result.lastInsertRowid),
    name: String(pending.name || 'User'),
    email,
    role: 'user',
    membershipStatus: 'inactive',
    membershipPlan: '',
    membershipStartedAt: null,
    membershipExpiresAt: null,
    membershipPeopleCount: null,
    membershipSubscriptionId: null,
  };
  transferGuestBookingsToUserByEmail(email, user.id);
  const token = setAuthCookie(req, res, user);
  return res.status(201).json({ user, token });
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    let user = null;
    try {
      user = db
        .prepare(
          `SELECT id, name, email, password_hash, role, age, gender, mobile, avatar_url AS avatarUrl,
                  membership_status AS membershipStatus, membership_plan AS membershipPlan,
                  membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
                  membership_people_count AS membershipPeopleCount,
                  membership_subscription_id AS membershipSubscriptionId
           FROM users
           WHERE email = ?`
        )
        .get(normalizedEmail);
    } catch {
      // Older DB schema fallback.
      user = db
        .prepare(
          `SELECT id, name, email, password_hash, role, age, gender, mobile
           FROM users
           WHERE email = ?`
        )
        .get(normalizedEmail);
    }

    if (!user) {
      return res.status(404).json({ message: 'User not found. Please register.' });
    }

    const passwordHash = String(user.password_hash || '').trim();
    if (!passwordHash) {
      return res.status(500).json({
        message: 'This account is missing a password. Please contact support or reseed the admin account.',
      });
    }

    let passwordMatches = false;
    try {
      passwordMatches = bcrypt.compareSync(String(password), passwordHash);
    } catch {
      return res.status(500).json({ message: 'Stored password format is invalid. Please reset your password.' });
    }

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid password.' });
    }

    let syncedUser = null;
    try {
      syncedUser = syncMembershipForUser({ userId: Number(user.id), email: normalizedEmail }) || getUserProfileById(Number(user.id));
    } catch {
      syncedUser = null;
    }
    transferGuestBookingsToUserByEmail(normalizedEmail, Number(user.id));

    const authSource = syncedUser || user;
    const authUser = {
      id: Number(authSource.id),
      name: String(authSource.name),
      email: String(authSource.email),
      role: String(authSource.role || 'user'),
      age: authSource.age ?? null,
      gender: authSource.gender || '',
      mobile: authSource.mobile || '',
      avatarUrl: authSource.avatarUrl || '',
      membershipStatus: authSource.membershipStatus || 'inactive',
      membershipPlan: authSource.membershipPlan || '',
      membershipStartedAt: authSource.membershipStartedAt || null,
      membershipExpiresAt: authSource.membershipExpiresAt || null,
      membershipPeopleCount: authSource.membershipPeopleCount ?? null,
      membershipSubscriptionId: authSource.membershipSubscriptionId || null,
    };

    const token = setAuthCookie(req, res, authUser);
    return res.json({ user: authUser, token });
  } catch (error) {
    console.error('Login route error:', String(error?.message || error));
    return res.status(500).json({ message: 'Login failed due to a server configuration error. Check server logs.' });
  }
});

app.post('/api/auth/login/verify', (req, res) => {
  return res.status(410).json({ message: 'Login OTP flow is disabled. Please login using email and password.' });
});

app.post('/api/auth/password/forgot', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ message: 'email is required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'valid email is required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const resetCooldown = db
    .prepare("SELECT strftime('%s', created_at) AS createdAtEpoch FROM pending_password_resets WHERE email = ?")
    .get(email);
  const resetCreatedAtMs = Number(resetCooldown?.createdAtEpoch || 0) * 1000;
  if (resetCreatedAtMs > 0) {
    const elapsedMs = Date.now() - resetCreatedAtMs;
    if (elapsedMs >= 0 && elapsedMs < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
      const retryAfterSeconds = Math.ceil((OTP_RESEND_COOLDOWN_SECONDS * 1000 - elapsedMs) / 1000);
      return res.status(429).json({
        message: `Please wait ${retryAfterSeconds}s before requesting another reset OTP.`,
        retryAfterSeconds,
      });
    }
  }

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO pending_password_resets (email, otp_hash, expires_at, attempts_left, verified, created_at)
     VALUES (?, ?, ?, 5, 0, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET
       otp_hash = excluded.otp_hash,
       expires_at = excluded.expires_at,
       attempts_left = 5,
       verified = 0,
       created_at = datetime('now')`
  ).run(email, otpHash, expiresAt);

  const mailResult = await sendOtpEmail(email, otp, 'password_reset');
  if (!mailResult.ok) {
    return res.status(mailResult.statusCode || 500).json({ message: mailResult.message });
  }

  const responsePayload = {
    message: mailResult.message || `Password reset OTP sent to ${email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  };
  if (SHOW_DEV_OTP_IN_UI) {
    responsePayload.devOtp = otp;
  }
  return res.json(responsePayload);
});

app.post('/api/auth/password/verify', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const otp = String(req.body?.otp || '').trim();
  if (!email || !otp) {
    return res.status(400).json({ message: 'email and otp are required' });
  }

  const pending = db
    .prepare(
      `SELECT email, otp_hash AS otpHash, expires_at AS expiresAt, attempts_left AS attemptsLeft, verified
       FROM pending_password_resets
       WHERE email = ?`
    )
    .get(email);

  if (!pending) {
    return res.status(404).json({ message: 'No pending password reset found. Request OTP again.' });
  }

  if (Number(pending.verified) === 1) {
    return res.json({ verified: true, message: 'OTP already verified. Set your new password.' });
  }

  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    db.prepare('DELETE FROM pending_password_resets WHERE email = ?').run(email);
    return res.status(400).json({ message: 'OTP expired. Request a new one.' });
  }

  if (hashOtp(otp) !== pending.otpHash) {
    db.prepare('UPDATE pending_password_resets SET attempts_left = attempts_left - 1 WHERE email = ?').run(email);
    const updated = db
      .prepare('SELECT attempts_left AS attemptsLeft FROM pending_password_resets WHERE email = ?')
      .get(email);
    if (!updated || updated.attemptsLeft <= 0) {
      db.prepare('DELETE FROM pending_password_resets WHERE email = ?').run(email);
      return res.status(400).json({ message: 'Too many invalid OTP attempts. Request a new one.' });
    }
    return res.status(400).json({ message: `Invalid OTP. ${updated.attemptsLeft} attempts left.` });
  }

  db.prepare(
    `UPDATE pending_password_resets
     SET verified = 1, otp_hash = '', expires_at = datetime('now'), attempts_left = 0
     WHERE email = ?`
  ).run(email);

  return res.json({ verified: true, message: 'OTP verified. Set your new password.' });
});

app.post('/api/auth/password/reset', (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'password must be at least 8 characters' });
  }

  const pending = db
    .prepare('SELECT email, verified FROM pending_password_resets WHERE email = ?')
    .get(email);
  if (!pending) {
    return res.status(404).json({ message: 'No pending password reset found. Request OTP again.' });
  }

  if (Number(pending.verified) !== 1) {
    return res.status(400).json({ message: 'Please verify OTP first.' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    db.prepare('DELETE FROM pending_password_resets WHERE email = ?').run(email);
    return res.status(404).json({ message: 'User not found.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(passwordHash, email);
  db.prepare('DELETE FROM pending_password_resets WHERE email = ?').run(email);
  db.prepare('DELETE FROM pending_login_otps WHERE email = ?').run(email);

  return res.json({ message: 'Password reset successful. Please login with your new password.' });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE, getAuthCookieOptions(req));
  res.status(204).send();
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get('/api/profile', requireAuth, (req, res) => {
  const profile = db.prepare(
    `SELECT id, name, role, age, gender, mobile, avatar_url AS avatarUrl,
            membership_status AS membershipStatus, membership_plan AS membershipPlan,
            membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
            membership_people_count AS membershipPeopleCount,
            membership_subscription_id AS membershipSubscriptionId
     FROM users
     WHERE id = ?`
  ).get(req.user.id);

  res.json({ profile });
});

app.get('/api/doctor/profile', requireAuth, requireDoctor, (req, res) => {
  const doctor = db
    .prepare(
      `SELECT id, user_id AS userId, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays,
              approval_status AS approvalStatus, created_at AS createdAt
       FROM doctors
       WHERE user_id = ?`
    )
    .get(req.user.id);

  res.json({ doctor: doctor || null });
});

app.put('/api/doctor/profile', requireAuth, requireDoctor, (req, res) => {
  const payload = validateDoctorSelfProfilePayload(req.body);
  if (payload.error) return res.status(400).json({ message: payload.error });

  const existing = db
    .prepare('SELECT id FROM doctors WHERE user_id = ?')
    .get(req.user.id);

  if (existing) {
    db.prepare(
      `UPDATE doctors
       SET name = ?, specialty = ?, bio = ?, experience_years = ?, consultation_fee = ?, available_days = ?, approval_status = 'pending'
       WHERE id = ?`
    ).run(
      req.user.name,
      payload.data.specialty,
      payload.data.bio,
      payload.data.experienceYears,
      payload.data.consultationFee,
      payload.data.availableDays,
      existing.id
    );
  } else {
    db.prepare(
      `INSERT INTO doctors (
        user_id, name, specialty, bio, experience_years, consultation_fee, available_days, approval_status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).run(
      req.user.id,
      req.user.name,
      payload.data.specialty,
      payload.data.bio,
      payload.data.experienceYears,
      payload.data.consultationFee,
      payload.data.availableDays
    );
  }

  const doctor = db
    .prepare(
      `SELECT id, user_id AS userId, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays,
              approval_status AS approvalStatus, created_at AS createdAt
       FROM doctors
       WHERE user_id = ?`
    )
    .get(req.user.id);

  res.json({ doctor });
});

app.put('/api/profile', requireAuth, (req, res) => {
  const hasAvatarField = Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarUrl');
  const name = String(req.body?.name || '').trim();
  const ageRaw = String(req.body?.age ?? '').trim();
  const gender = String(req.body?.gender || '').trim().toLowerCase();
  const mobile = String(req.body?.mobile || '').trim();
  const avatarUrl = hasAvatarField ? String(req.body?.avatarUrl || '').trim() : null;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  let age = null;
  if (ageRaw) {
    if (!/^\d{1,3}$/.test(ageRaw)) {
      return res.status(400).json({ message: 'age must be a valid number between 1 and 120' });
    }
    const parsed = Number(ageRaw);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 120) {
      return res.status(400).json({ message: 'age must be a valid number between 1 and 120' });
    }
    age = parsed;
  }

  const allowedGenders = ['', 'male', 'female', 'other', 'prefer_not_to_say'];
  if (!allowedGenders.includes(gender)) {
    return res.status(400).json({ message: 'invalid gender' });
  }

  if (mobile && !/^[0-9+\-\s()]{7,20}$/.test(mobile)) {
    return res.status(400).json({ message: 'invalid mobile number' });
  }

  if (hasAvatarField && avatarUrl && !/^https?:\/\/.+/i.test(avatarUrl) && !avatarUrl.startsWith('/uploads/')) {
    return res.status(400).json({ message: 'avatarUrl must be a valid http/https URL or /uploads path' });
  }

  const current = db
    .prepare('SELECT avatar_url AS avatarUrl FROM users WHERE id = ?')
    .get(req.user.id);
  const nextAvatarUrl = hasAvatarField ? (avatarUrl || null) : (current?.avatarUrl || null);

  db.prepare(
    `UPDATE users
     SET name = ?, age = ?, gender = ?, mobile = ?, avatar_url = ?
     WHERE id = ?`
  ).run(name, age, gender || null, mobile || null, nextAvatarUrl, req.user.id);

  const profile = db.prepare(
    `SELECT id, name, role, age, gender, mobile, avatar_url AS avatarUrl,
            membership_status AS membershipStatus, membership_plan AS membershipPlan,
            membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
            membership_people_count AS membershipPeopleCount
     FROM users
     WHERE id = ?`
  ).get(req.user.id);

  res.json({ profile });
});

app.post('/api/profile/avatar', requireAuth, (req, res) => {
  upload.single('avatar')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'File is too large. Max size is 10MB.' });
      }
      return res.status(400).json({ message: err.message || 'Image upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'avatar file is required' });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.id);

    const profile = db.prepare(
      `SELECT id, name, role, age, gender, mobile, avatar_url AS avatarUrl,
              membership_status AS membershipStatus, membership_plan AS membershipPlan,
              membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
              membership_people_count AS membershipPeopleCount
       FROM users
       WHERE id = ?`
    ).get(req.user.id);

    return res.json({ profile });
  });
});

app.post('/api/admin/ses/verify-recipient', requireAuth, requireAdmin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'valid email is required' });
  }

  const verification = await requestSesRecipientVerification(email);
  if (!verification.ok) {
    return res.status(400).json({
      message: verification.message,
      configured: Boolean(verification.configured),
    });
  }

  return res.json({
    email,
    verificationStatus: verification.status,
    message: 'Verification email requested. Ask recipient to click the SES verification link.',
  });
});

app.get('/api/admin/ses/identity-status', requireAuth, requireAdmin, async (req, res) => {
  const email = String(req.query?.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'valid email query param is required' });
  }

  const statusResult = await getSesIdentityStatus(email);
  if (!statusResult.ok) {
    return res.status(statusResult.statusCode || 400).json({ message: statusResult.message });
  }

  return res.json({
    email,
    verificationStatus: statusResult.status,
  });
});

app.get('/api/services', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    syncMembershipCoveredHydrogenBookings(req.user.id, req.user);
  }
  const hydrogenBalance = getHydrogenFreeSessionBalance(req.user.id, req.user);
  const services = getVisibleServicesForUser(req.user).map((service) => {
    const response = toServiceResponse(service, req.user);
    if (String(response?.category || '').toUpperCase() === 'HYDROGEN SESSION' && hydrogenBalance.active) {
      response.membershipRemainingHydrogenSessions = hydrogenBalance.remaining;
    }
    return response;
  });
  res.json({ services, membershipActive: isMembershipActiveForUser(req.user) });
});
app.get('/api/public/services', (_req, res) => {
  try {
    const guestUser = {
      role: 'guest',
      id: null,
      email: null,
    };

    const services = getVisibleServicesForUser(guestUser).map((service) => {
      return toServiceResponse(service, guestUser);
    });

    res.json({
      services,
      membershipActive: false,
    });
  } catch (error) {
    console.error('Public services error:', error);
    res.status(500).json({
      message: 'Unable to load services',
    });
  }
});
app.get('/api/services/availability', requireAuth, (req, res) => {
  const bookingDate = String(req.query?.bookingDate || '').trim();
  const category = String(req.query?.category || '').trim().toUpperCase();
  let availabilityUser = req.user;

  if (req.user.role === 'admin') {
    const customerEmail = String(req.query?.customerEmail || '').trim().toLowerCase();
    if (customerEmail) {
      const resolvedCustomer = resolveAdminCustomerContext({
        customerEmail,
        createIfMissing: false,
      });
      if (resolvedCustomer.error) {
        return res.status(400).json({ message: resolvedCustomer.error });
      }
      availabilityUser = resolvedCustomer.user;
    }
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    return res.status(400).json({ message: 'bookingDate query must be in YYYY-MM-DD format' });
  }

  const selectedDate = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    return res.status(400).json({ message: 'bookingDate is invalid' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today && req.user.role !== 'admin') {
    return res.status(400).json({ message: 'bookingDate cannot be in the past' });
  }

  const allServices = getVisibleServicesForUser(availabilityUser).filter((service) => {
    if (!category) return true;
    return String(service.category || '').toUpperCase() === category;
  });

  const availability = {};
  const holds = {};
  for (const service of allServices) {
    availability[service.name] = {};
    holds[service.name] = {};
    for (const slot of ALLOWED_SLOT_START_TIMES) {
      availability[service.name][slot] = 0;
      holds[service.name][slot] = 0;
    }
  }

  if (allServices.length > 0) {
    const placeholders = allServices.map(() => '?').join(', ');
    const params = [bookingDate, ...allServices.map((service) => service.name)];
    const rows = db
      .prepare(
        `SELECT service_name AS serviceName,
                booking_time AS bookingTime,
                SUM(CASE WHEN ${calendarBookedBookingSql()} THEN 1 ELSE 0 END) AS total,
                SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
         FROM bookings
         WHERE booking_date = ?
           AND status IN ('pending', 'booked', 'confirmed', 'completed')
           AND service_name IN (${placeholders})
         GROUP BY service_name, booking_time`
      )
      .all(...params);

    for (const row of rows) {
      const serviceName = String(row.serviceName || '');
      const bookingTime = normalizeSlotStartTime(row.bookingTime);
      if (!availability[serviceName] || !bookingTime) continue;
      availability[serviceName][bookingTime] = Number(availability[serviceName][bookingTime] || 0) + Number(row.total || 0);
      holds[serviceName][bookingTime] = Number(holds[serviceName][bookingTime] || 0) + Number(row.holdTotal || 0);
    }
  }

  return res.json({
    bookingDate,
    category,
    maxPerSlot: MAX_BOOKINGS_PER_SLOT_HYDROGEN,
    slotCapacityByService: Object.fromEntries(
      allServices.map((service) => [service.name, getSlotCapacityForServiceName(service.name)])
    ),
    slots: ALLOWED_SLOT_START_TIMES,
    availability,
    holds,
    holdMinutes: BOOKING_HOLD_MINUTES,
  });
});

app.get('/api/membership/plans', requireAuth, (req, res) => {
  const active = isMembershipActiveForUser(req.user);
  return res.json({
    active,
    current: {
      status: req.user.membershipStatus || 'inactive',
      plan: req.user.membershipPlan || '',
      startedAt: req.user.membershipStartedAt || null,
      expiresAt: req.user.membershipExpiresAt || null,
      peopleCount: req.user.membershipPeopleCount ?? null,
      subscriptionId: req.user.membershipSubscriptionId || null,
    },
    plans: MEMBERSHIP_PLANS,
  });
});

app.post('/api/membership/preview-coupon', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can preview membership coupons.' });
  }

  const planId = String(req.body?.planId || '').trim();
  const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ message: 'Invalid membership plan selected.' });
  }

  const additionalPeople = Number(req.body?.additionalPeople ?? 0);
  if (!Number.isInteger(additionalPeople) || additionalPeople < 0) {
    return res.status(400).json({ message: 'additionalPeople must be a non-negative integer' });
  }

  const addPersonPlan = MEMBERSHIP_PLANS.find((item) => item.id === 'h2_add_person');
  const addPersonPriceInr = Number(addPersonPlan?.priceInr || 0);
  const subtotalAmountPaise = Math.round((Number(plan.priceInr || 0) + additionalPeople * addPersonPriceInr) * 100);
  const couponResult = validateCouponForUser({
    code: req.body?.couponCode,
    userId: req.user.id,
    appliesTo: 'membership',
    subtotalAmountPaise,
  });
  if (couponResult.error) {
    return res.status(400).json({ message: couponResult.error });
  }

  return res.json({ coupon: serializeCouponPreview(couponResult) });
});

app.post('/api/membership/subscribe', requireAuth, (req, res) => {
  return res.status(410).json({
    message: 'Direct membership activation is disabled. Use /api/membership/create-order and /api/membership/verify.',
  });
});

app.post('/api/membership/create-order', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can subscribe to membership.' });
  }
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const planId = String(req.body?.planId || '').trim();
  const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ message: 'Invalid membership plan selected.' });
  }
  const additionalPeople = Number(req.body?.additionalPeople ?? 0);
  if (!Number.isInteger(additionalPeople) || additionalPeople < 0) {
    return res.status(400).json({ message: 'additionalPeople must be a non-negative integer' });
  }

  const userRow = db
    .prepare(
      `SELECT membership_status AS membershipStatus, membership_plan AS membershipPlan,
              membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
              membership_people_count AS membershipPeopleCount
       FROM users
       WHERE id = ?`
    )
    .get(req.user.id);
  const hasActiveMembership = isMembershipActiveForUser({
    membershipStatus: userRow?.membershipStatus || req.user.membershipStatus,
    membershipExpiresAt: userRow?.membershipExpiresAt || req.user.membershipExpiresAt,
  });

  if (planId === 'h2_add_person' && !hasActiveMembership) {
    return res.status(409).json({ message: 'Add Person is available only for active memberships.' });
  }

  if (planId === 'h2_add_person' && additionalPeople > 0) {
    return res.status(400).json({ message: 'additionalPeople is not supported for Add Person plan' });
  }

  const addPersonPlan = MEMBERSHIP_PLANS.find((item) => item.id === 'h2_add_person');
  const addPersonPriceInr = Number(addPersonPlan?.priceInr || 0);
  const basePeopleCount = Number(plan.peopleCount || 1);
  const targetPeopleCount =
    planId === 'h2_add_person'
      ? Number(userRow?.membershipPeopleCount || req.user.membershipPeopleCount || 1) + 1
      : basePeopleCount + additionalPeople;
  const subtotalAmountInr =
    planId === 'h2_add_person'
      ? Number(plan.priceInr || 0)
      : Number(plan.priceInr || 0) + additionalPeople * addPersonPriceInr;
  const subtotalAmountPaise = Math.round(subtotalAmountInr * 100);
  const couponResult = validateCouponForUser({
    code: req.body?.couponCode,
    userId: req.user.id,
    appliesTo: 'membership',
    subtotalAmountPaise,
  });
  if (couponResult.error) {
    return res.status(400).json({ message: couponResult.error });
  }
  const taxableAmountPaise = Number(couponResult.finalAmountPaise || subtotalAmountPaise);
  const amountInPaise = Math.max(100, Math.round(taxableAmountPaise * (1 + GST_RATE_PERCENT / 100)));
  const gstAmountPaise = Math.max(0, amountInPaise - taxableAmountPaise);

  const memberDetailsResult = normalizeMembershipMembers(req.body?.memberDetails, targetPeopleCount);
  if (memberDetailsResult.error) {
    return res.status(400).json({ message: memberDetailsResult.error });
  }
  const memberDetails = memberDetailsResult.data;
  if (!memberDetails.some((member) => String(member.email || '').trim().toLowerCase() === String(req.user.email || '').trim().toLowerCase())) {
    return res.status(400).json({ message: 'Buyer email must be included in the membership member list.' });
  }
  const subscriptionConflict = validateSubscriptionMemberConflicts(getMembershipSubscriptionId(req.user.id), memberDetails);
  if (subscriptionConflict.error) {
    return res.status(409).json({ message: subscriptionConflict.error });
  }

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: buildRazorpayReceipt('membership', req.user.id),
      notes: {
        userId: String(req.user.id),
        planId: String(plan.id),
        peopleCount: String(targetPeopleCount),
        couponCode: String(couponResult.couponCode || ''),
      },
    });

    db.prepare(
      `INSERT OR REPLACE INTO membership_payment_orders (
        order_id, user_id, plan_id, people_count, member_details_json, original_amount_paise, discount_amount_paise, coupon_id, coupon_code, amount_paise, status, payment_reference, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL, datetime('now'))`
    ).run(
      order.id,
      req.user.id,
      plan.id,
      targetPeopleCount,
      JSON.stringify(memberDetails),
      Number(couponResult.originalAmountPaise || subtotalAmountPaise),
      Number(couponResult.discountAmountPaise || 0),
      couponResult.coupon?.id || null,
      couponResult.couponCode || null,
      amountInPaise
    );

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan: {
        id: plan.id,
        name: plan.name,
        priceInr: Math.round(amountInPaise / 100),
        subtotalAmountInr,
        gstAmountInr: Math.round(gstAmountPaise / 100),
        basePriceInr: Number(plan.priceInr || 0),
        addPersonPriceInr,
        additionalPeople,
        basePeopleCount,
        peopleCount: targetPeopleCount,
        validityDays: plan.validityDays,
        coupon: serializeCouponPreview(couponResult),
      },
      members: memberDetails,
      user: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Razorpay membership order create failed:', getRazorpayOrderErrorMessage(error, 'Unable to create membership order'));
    return res.status(500).json({ message: getRazorpayOrderErrorMessage(error, 'Unable to create membership order') });
  }
});

app.post('/api/membership/verify', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'Only users can subscribe to membership.' });
  }
  if (!razorpay || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const planId = String(req.body?.planId || '').trim();
  const razorpayOrderId = String(req.body?.razorpay_order_id || '');
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
  const razorpaySignature = String(req.body?.razorpay_signature || '');
  if (!planId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Invalid membership verification payload' });
  }

  const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ message: 'Invalid membership plan selected.' });
  }

  const pendingOrder = db
    .prepare(
      `SELECT order_id AS orderId, user_id AS userId, plan_id AS planId, people_count AS peopleCount, status,
              member_details_json AS memberDetailsJson,
              coupon_id AS couponId, coupon_code AS couponCode, discount_amount_paise AS discountAmountPaise
       FROM membership_payment_orders
       WHERE order_id = ?`
    )
    .get(razorpayOrderId);

  if (!pendingOrder) {
    return res.status(404).json({ message: 'Membership order not found' });
  }
  if (Number(pendingOrder.userId) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'forbidden' });
  }
  if (String(pendingOrder.planId) !== plan.id) {
    return res.status(400).json({ message: 'Plan mismatch for this order' });
  }
  if (String(pendingOrder.status) === 'paid') {
    return res.status(409).json({ message: 'Membership payment already verified for this order' });
  }

  const peopleCount = Number(pendingOrder.peopleCount || plan.peopleCount || 1);
  let memberDetails = [];
  try {
    memberDetails = pendingOrder.memberDetailsJson ? JSON.parse(pendingOrder.memberDetailsJson) : [];
  } catch {
    memberDetails = [];
  }
  const memberDetailsResult = normalizeMembershipMembers(memberDetails, peopleCount);
  if (memberDetailsResult.error) {
    return res.status(400).json({ message: memberDetailsResult.error });
  }
  memberDetails = memberDetailsResult.data;
  if (!memberDetails.some((member) => String(member.email || '').trim().toLowerCase() === String(req.user.email || '').trim().toLowerCase())) {
    return res.status(400).json({ message: 'Buyer email must be included in the membership member list.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }
  if (Number(pendingOrder.couponId || 0) > 0) {
    const couponLimitError = validateCouponRedemptionLimit(Number(pendingOrder.couponId), req.user.id);
    if (couponLimitError) {
      return res.status(409).json({ message: couponLimitError });
    }
  }

  const existingUser = db
    .prepare(
      `SELECT membership_status AS membershipStatus, membership_plan AS membershipPlan,
              membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
              membership_subscription_id AS membershipSubscriptionId
       FROM users
       WHERE id = ?`
    )
    .get(req.user.id);
  const hasActiveMembership = isMembershipActiveForUser({
    membershipStatus: existingUser?.membershipStatus || req.user.membershipStatus,
    membershipExpiresAt: existingUser?.membershipExpiresAt || req.user.membershipExpiresAt,
  });

  if (plan.id === 'h2_add_person' && !hasActiveMembership) {
    return res.status(409).json({ message: 'Add Person is available only for active memberships.' });
  }

  const now = new Date();
  const startedAt =
    plan.id === 'h2_add_person' && existingUser?.membershipStartedAt ? existingUser.membershipStartedAt : now.toISOString();
  const expiresAt =
    plan.id === 'h2_add_person' && existingUser?.membershipExpiresAt
      ? existingUser.membershipExpiresAt
      : new Date(now.getTime() + Number(plan.validityDays || MEMBERSHIP_VALIDITY_DAYS) * 24 * 60 * 60 * 1000).toISOString();
  const membershipPlanId =
    plan.id === 'h2_add_person' ? String(existingUser?.membershipPlan || req.user.membershipPlan || 'h2_single') : plan.id;
  const subscriptionId =
    existingUser?.membershipSubscriptionId ||
    req.user.membershipSubscriptionId ||
    getMembershipSubscriptionId(req.user.id);

  db.prepare(
    `UPDATE users
     SET membership_status = 'active',
         membership_plan = ?,
         membership_started_at = ?,
         membership_expires_at = ?,
         membership_people_count = ?,
         membership_subscription_id = ?
     WHERE id = ?`
  ).run(membershipPlanId, startedAt, expiresAt, peopleCount, subscriptionId, req.user.id);

  db.prepare(
    `UPDATE membership_payment_orders
     SET status = 'paid',
         payment_reference = ?,
         paid_at = datetime('now')
     WHERE order_id = ?`
  ).run(razorpayPaymentId, razorpayOrderId);

  if (Number(pendingOrder.couponId || 0) > 0 && Number(pendingOrder.discountAmountPaise || 0) > 0) {
    recordCouponRedemption({
      couponId: Number(pendingOrder.couponId),
      userId: req.user.id,
      contextType: 'membership',
      contextRef: razorpayOrderId,
      discountAmountPaise: Number(pendingOrder.discountAmountPaise || 0),
    });
  }

  const saveMembersResult = saveMembershipSubscriptionMembers({
    ownerUserId: req.user.id,
    subscriptionId,
    planId: membershipPlanId,
    peopleCount,
    startedAt,
    expiresAt,
    members: memberDetails.map((member) => ({
      ...member,
      email: String(member.email || '').trim().toLowerCase(),
    })),
  });
  if (saveMembersResult.error) {
    return res.status(409).json({ message: saveMembersResult.error });
  }

  const profile = syncMembershipForUser({ userId: req.user.id, email: req.user.email }) || getUserProfileById(req.user.id);

  return res.json({
    message:
      plan.id === 'h2_add_person'
        ? `Member added successfully. Current covered members: ${peopleCount}.`
        : `${plan.name} activated successfully for ${peopleCount} member(s).`,
    profile,
    paid: true,
    coupon: serializeAppliedCouponFromOrder(pendingOrder),
  });
});

app.get('/api/doctors', requireAuth, (_req, res) => {
  return res.json({ doctors: [] });
});

app.get('/api/admin/doctors', requireAuth, requireAdmin, (_req, res) => {
  const doctors = db
    .prepare(
      `SELECT id, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays, created_at AS createdAt,
              approval_status AS approvalStatus,
              user_id AS userId
       FROM doctors
       ORDER BY id ASC`
    )
    .all();
  res.json({ doctors });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
  const search = String(_req.query?.search || '').trim().toLowerCase();
  let query = `
    SELECT id,
           name,
           email,
           mobile,
           membership_status AS membershipStatus,
           membership_plan AS membershipPlan,
           membership_expires_at AS membershipExpiresAt,
           membership_people_count AS membershipPeopleCount
    FROM users
    WHERE role = 'user'
  `;
  const params = [];
  if (search) {
    const like = `%${search}%`;
    query += ` AND (
      CAST(id AS TEXT) LIKE ? OR
      LOWER(name) LIKE ? OR
      LOWER(email) LIKE ? OR
      mobile LIKE ?
    )`;
    params.push(like, like, like, like);
  }
  query += ' ORDER BY name COLLATE NOCASE ASC, id ASC';
  const users = db.prepare(query).all(...params);

  res.json({ users });
});

app.post('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const mobile = String(req.body?.mobile || '').trim();

  if (!name || !email || !mobile) {
    return res.status(400).json({ message: 'Name, email, and phone are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  const result = resolveAdminCustomerContext({
    customerName: name,
    customerEmail: email,
    customerPhone: mobile,
    createIfMissing: true,
  });
  if (result?.error) {
    return res.status(400).json({ message: result.error });
  }
  if (!result?.user) {
    return res.status(500).json({ message: 'Unable to create user.' });
  }

  return res.json({ user: result.user, created: Boolean(result.createdUser) });
});

app.post('/api/admin/discount-access', requireAuth, requireAdmin, (req, res) => {
  const password = String(req.body?.password || '').trim();
  if (!password) {
    return res.status(400).json({ message: 'Password is required.' });
  }
  if (password !== ADMIN_DISCOUNT_GATE_PASSWORD) {
    return res.status(401).json({ message: 'Invalid discount password.' });
  }
  return res.json({ ok: true });
});

app.patch('/api/admin/users/:id', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId)) {
    return res.status(400).json({ message: 'Invalid user id.' });
  }

  const existing = db
    .prepare('SELECT id, name, email, mobile FROM users WHERE id = ?')
    .get(userId);
  if (!existing) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const nextEmailRaw = String(req.body?.email || '').trim().toLowerCase();
  const nextMobileRaw = String(req.body?.mobile || '').trim();
  const nextEmail = nextEmailRaw || existing.email;
  const nextMobile = nextMobileRaw || '';

  if (!nextEmail || !isValidEmail(nextEmail)) {
    return res.status(400).json({ message: 'A valid email address is required.' });
  }

  if (nextEmail !== existing.email) {
    const emailConflict = db
      .prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
      .get(nextEmail, userId);
    if (emailConflict) {
      return res.status(409).json({ message: 'That email is already in use.' });
    }
  }

  db.prepare('UPDATE users SET email = ?, mobile = ? WHERE id = ?').run(nextEmail, nextMobile || null, userId);

  return res.json({
    user: {
      id: userId,
      name: existing.name,
      email: nextEmail,
      mobile: nextMobile,
    },
  });
});

app.post('/api/admin/services', requireAuth, requireAdmin, (req, res) => {
  const resolvedCustomer = resolveAdminCustomerContext({
    customerName: req.body?.customerName,
    customerEmail: req.body?.customerEmail,
    customerPhone: req.body?.customerPhone,
    createIfMissing: false,
  });
  if (resolvedCustomer.error) {
    return res.status(400).json({ message: resolvedCustomer.error });
  }

  if (!resolvedCustomer.user || !resolvedCustomer.user.email) {
    return res.json({ services: [], membershipActive: false, resolvedCustomer: null });
  }

  const services = getVisibleServicesForUser(resolvedCustomer.user).map((service) =>
    toServiceResponse(service, resolvedCustomer.user)
  );
  res.json({
    services,
    membershipActive: isMembershipActiveForUser(resolvedCustomer.user),
    resolvedCustomer: {
      id: resolvedCustomer.user.id ?? null,
      name: resolvedCustomer.user.name || '',
      email: resolvedCustomer.user.email || '',
      mobile: resolvedCustomer.user.mobile || '',
      discountPercent: getDiscountPercentForPhone(resolvedCustomer.user.mobile || ''),
      membershipStatus: resolvedCustomer.user.membershipStatus || 'inactive',
      membershipExpiresAt: resolvedCustomer.user.membershipExpiresAt || null,
      membershipPeopleCount: resolvedCustomer.user.membershipPeopleCount ?? null,
    },
  });
});

app.get('/api/admin/membership-orders', requireAuth, requireAdmin, (_req, res) => {
  const orders = db
    .prepare(
      `SELECT mpo.order_id AS orderId,
              mpo.plan_id AS planId,
              mpo.people_count AS peopleCount,
              mpo.member_details_json AS memberDetailsJson,
              mpo.amount_paise AS amountPaise,
              mpo.status,
              mpo.payment_reference AS paymentReference,
              mpo.paid_at AS paidAt,
              mpo.created_at AS createdAt,
              u.id AS userId,
              u.name AS userName,
              u.email AS userEmail,
              u.mobile AS userMobile
       FROM membership_payment_orders mpo
       JOIN users u ON u.id = mpo.user_id
       WHERE LOWER(COALESCE(mpo.status, '')) = 'paid'
       ORDER BY datetime(COALESCE(mpo.paid_at, mpo.created_at)) DESC`
    )
    .all()
    .map((row) => {
      let memberDetails = [];
      try {
        memberDetails = row.memberDetailsJson ? JSON.parse(row.memberDetailsJson) : [];
      } catch {
        memberDetails = [];
      }
      return {
        orderId: row.orderId,
        planId: row.planId,
        peopleCount: Number(row.peopleCount || 0),
        amountPaise: Number(row.amountPaise || 0),
        status: row.status,
        paymentReference: row.paymentReference || '',
        paidAt: row.paidAt || null,
        createdAt: row.createdAt,
        userId: Number(row.userId),
        userName: row.userName,
        userEmail: row.userEmail,
        userMobile: row.userMobile || '',
        memberDetails,
      };
    });

  res.json({ orders });
});

app.get('/api/membership/orders', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can access membership orders' });
  }

  const orders = db
    .prepare(
      `SELECT order_id AS orderId,
              plan_id AS planId,
              people_count AS peopleCount,
              member_details_json AS memberDetailsJson,
              amount_paise AS amountPaise,
              status,
              payment_reference AS paymentReference,
              paid_at AS paidAt,
              created_at AS createdAt
       FROM membership_payment_orders
       WHERE user_id = ?
       ORDER BY datetime(COALESCE(paid_at, created_at)) DESC`
    )
    .all(req.user.id)
    .map((row) => {
      let memberDetails = [];
      try {
        memberDetails = row.memberDetailsJson ? JSON.parse(row.memberDetailsJson) : [];
      } catch {
        memberDetails = [];
      }
      return {
        orderId: row.orderId,
        planId: row.planId,
        peopleCount: Number(row.peopleCount || 0),
        amountPaise: Number(row.amountPaise || 0),
        status: row.status,
        paymentReference: row.paymentReference || '',
        paidAt: row.paidAt || null,
        createdAt: row.createdAt,
        memberDetails,
      };
    });

  return res.json({ orders });
});

app.get('/api/membership/members', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can access membership members' });
  }

  const subscriptionId = String(req.user.membershipSubscriptionId || getMembershipSubscriptionId(req.user.id) || '').trim();
  if (!subscriptionId) {
    return res.status(404).json({ message: 'membership not found' });
  }

  const subscription = getMembershipSubscriptionById(subscriptionId);
  if (!subscription) {
    return res.status(404).json({ message: 'membership not found' });
  }
  if (!isMembershipSubscriptionActive(subscription)) {
    return res.status(404).json({ message: 'membership is not active' });
  }

  const members = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              email,
              name,
              place,
              contact_number AS contactNumber,
              is_registered AS isRegistered,
              created_at AS createdAt,
              updated_at AS updatedAt
       FROM membership_subscription_members
       WHERE subscription_id = ?
       ORDER BY id ASC`
    )
    .all(subscriptionId)
    .map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId || 0) || null,
      email: row.email || '',
      name: row.name || '',
      place: row.place || '',
      contactNumber: row.contactNumber || '',
      isRegistered: Number(row.isRegistered || 0) === 1,
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));

  return res.json({
    subscription,
    members,
    totalCovered: Number(subscription.peopleCount || members.length || 0),
    slotsRemaining: Math.max(0, Number(subscription.peopleCount || members.length || 0) - members.length),
  });
});

app.get('/api/membership-orders/:orderId/invoice-link', requireAuth, (req, res) => {
  const orderId = String(req.params.orderId || '').trim();
  if (!orderId) {
    return res.status(400).json({ message: 'orderId is required' });
  }

  const order = db
    .prepare(
      `SELECT order_id AS orderId,
              user_id AS userId,
              status,
              amount_paise AS amountPaise,
              discount_amount_paise AS discountAmountPaise,
              coupon_code AS couponCode,
              payment_reference AS paymentReference,
              paid_at AS paidAt,
              created_at AS createdAt
       FROM membership_payment_orders
       WHERE order_id = ?`
    )
    .get(orderId);
  if (!order) {
    return res.status(404).json({ message: 'membership order not found' });
  }

  if (req.user.role !== 'admin' && Number(order.userId) !== Number(req.user.id)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const normalizedOrderStatus = String(order.status || '').trim().toLowerCase();
  if (normalizedOrderStatus !== 'paid') {
    return res.status(409).json({ message: `invoice is available only for paid membership orders (status=${order.status ?? ''})` });
  }

  const token = createInvoiceAccessToken({
    scope: 'membership_invoice',
    orderId: order.orderId,
    userId: order.userId,
  });

  const invoiceUrl = `${getRequestOrigin(req)}/invoice/membership?token=${encodeURIComponent(token)}`;
  return res.json({
    invoiceUrl,
    invoiceDownloadUrl: `${invoiceUrl}&format=pdf&download=1`,
  });
});

app.get('/api/admin/discount-phones', requireAuth, requireAdmin, (_req, res) => {
  const discountPhones = db
    .prepare(
      `SELECT id,
              phone_key AS phoneKey,
              phone_display AS phoneDisplay,
              discount_percent AS discountPercent,
              redeemed_at AS redeemedAt,
              redeemed_booking_id AS redeemedBookingId,
              created_at AS createdAt
       FROM admin_discount_phones
       ORDER BY redeemed_at IS NOT NULL ASC, datetime(created_at) DESC, id DESC`
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      phoneKey: row.phoneKey || '',
      phoneDisplay: row.phoneDisplay || '',
      discountPercent: Number(row.discountPercent || 0),
      redeemedAt: row.redeemedAt || null,
      redeemedBookingId: row.redeemedBookingId == null ? null : Number(row.redeemedBookingId),
      createdAt: row.createdAt || null,
    }));

  res.json({ discountPhones });
});

app.post('/api/admin/discount-phones', requireAuth, requireAdmin, (req, res) => {
  const phoneDisplay = String(req.body?.phone || '').trim();
  const phoneKey = normalizeDiscountPhoneKey(phoneDisplay);
  const discountPercent = Number(req.body?.discountPercent || 0);

  if (!phoneKey) {
    return res.status(400).json({ message: 'Valid phone number is required.' });
  }
  if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
    return res.status(400).json({ message: 'discountPercent must be between 1 and 100.' });
  }

  db.prepare(
    `INSERT INTO admin_discount_phones (phone_key, phone_display, discount_percent, created_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(phone_key) DO UPDATE SET
       phone_display = excluded.phone_display,
       discount_percent = excluded.discount_percent,
       redeemed_at = NULL,
       redeemed_booking_id = NULL`
  ).run(phoneKey, phoneDisplay, discountPercent);

  res.status(201).json({ message: 'Discount phone saved.' });
});

app.delete('/api/admin/discount-phones/:id', requireAuth, requireAdmin, (req, res) => {
  const discountId = Number(req.params.id);
  if (!Number.isInteger(discountId)) {
    return res.status(400).json({ message: 'Invalid discount id.' });
  }

  db.prepare('DELETE FROM admin_discount_phones WHERE id = ?').run(discountId);
  res.json({ message: 'Discount phone removed.' });
});

app.get('/api/admin/coupons', requireAuth, requireAdmin, (_req, res) => {
  const coupons = db
    .prepare(
      `SELECT id,
              code,
              description,
              discount_type AS discountType,
              discount_value AS discountValue,
              applies_to AS appliesTo,
              max_redemptions AS maxRedemptions,
              per_user_limit AS perUserLimit,
              expires_at AS expiresAt,
              active,
              coupon_type AS couponType,
              assigned_user_email AS assignedUserEmail,
              used_by AS usedBy,
              is_active AS isActive,
              valid_from AS validFrom,
              valid_till AS validTill,
              recipient_email AS recipientEmail,
              recipient_name AS recipientName,
              festival_name AS festivalName,
              emailed_at AS emailedAt,
              email_status AS emailStatus,
              email_error AS emailError,
              created_at AS createdAt
       FROM coupons
       ORDER BY active DESC, datetime(created_at) DESC, id DESC`
    )
    .all()
    .map((row) => {
      const stats = getCouponRedemptionStats(row.id, -1);
      const coupon = mapCouponRow(row);
      return {
        ...coupon,
        totalRedemptions: Number(stats.total || 0),
      };
    });

  res.json({ coupons });
});

app.patch('/api/admin/coupons/:id/active', requireAuth, requireAdmin, (req, res) => {
  const couponId = Number(req.params.id);
  if (!Number.isInteger(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon id.' });
  }
  const active = Number(req.body?.active) === 1 ? 1 : 0;
  db.prepare('UPDATE coupons SET active = ?, is_active = ? WHERE id = ?').run(active, active, couponId);
  res.json({ message: active ? 'Coupon activated.' : 'Coupon deactivated.' });
});

app.get('/api/coupons/general', requireAuth, (req, res) => {
  const appliesTo = String(req.query?.appliesTo || '').trim().toLowerCase();
  const allowedAppliesTo = new Set(['services', 'membership']);
  const filterAppliesTo = allowedAppliesTo.has(appliesTo) ? appliesTo : '';
  const requesterRole = String(req.user?.role || '').trim().toLowerCase();

  if (requesterRole !== 'user') {
    console.warn('[coupons/general] non-user access, returning empty payload', {
      requesterRole,
      appliesTo: filterAppliesTo || 'all',
      userId: req.user?.id || null,
    });
    return res.status(200).json({ coupons: [] });
  }

  try {
    const rows = db
      .prepare(
        `SELECT id,
                code,
                description,
                discount_type AS discountType,
                discount_value AS discountValue,
                applies_to AS appliesTo,
                max_redemptions AS maxRedemptions,
                per_user_limit AS perUserLimit,
                expires_at AS expiresAt,
                active,
                coupon_type AS couponType,
                assigned_user_email AS assignedUserEmail,
                used_by AS usedBy,
                is_active AS isActive,
                valid_from AS validFrom,
                valid_till AS validTill,
                festival_name AS festivalName,
                created_at AS createdAt
         FROM coupons
         WHERE active = 1
           AND COALESCE(is_active, 1) = 1
           AND COALESCE(coupon_type, 'public') = 'public'
           AND (valid_from IS NULL OR datetime(valid_from) <= datetime('now'))
           AND (
             (valid_till IS NOT NULL AND datetime(valid_till) > datetime('now'))
             OR (valid_till IS NULL AND (expires_at IS NULL OR datetime(expires_at) > datetime('now')))
           )
         ORDER BY datetime(created_at) DESC, id DESC`
      )
      .all();

    console.log('[coupons/general] db rows fetched', {
      appliesTo: filterAppliesTo || 'all',
      rowCount: Array.isArray(rows) ? rows.length : 0,
      userId: req.user?.id || null,
    });

    const coupons = rows
      .map((row) => {
        const coupon = mapCouponRow(row);
        const couponAppliesTo = String(coupon.appliesTo || 'all').trim().toLowerCase();
        if (filterAppliesTo && !['all', filterAppliesTo].includes(couponAppliesTo)) {
          return null;
        }
        const stats = getCouponRedemptionStats(coupon.id, req.user.id);
        const maxRedemptions = coupon.maxRedemptions;
        const perUserLimit = Number(coupon.perUserLimit || 1);
        let canRedeem = true;
        let unavailableReason = '';
        const userEmail = String(req.user?.email || '').trim().toLowerCase();
        if (userEmail && Array.isArray(coupon.usedBy) && coupon.usedBy.includes(userEmail)) {
          canRedeem = false;
          unavailableReason = 'Already used by you';
        } else if (
          coupon.couponType === 'private' &&
          Number.isFinite(maxRedemptions) &&
          maxRedemptions > 0 &&
          Number(stats.total || 0) >= maxRedemptions
        ) {
          canRedeem = false;
          unavailableReason = 'Coupon fully redeemed';
        } else if (perUserLimit > 0 && Number(stats.userTotal || 0) >= perUserLimit) {
          canRedeem = false;
          unavailableReason = 'Already used by you';
        }
        return {
          id: coupon.id,
          code: coupon.code,
          description: coupon.description,
          festivalName: coupon.festivalName,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          appliesTo: couponAppliesTo || 'all',
          active: coupon.active ? 1 : 0,
          isActive: coupon.isActive ? 1 : 0,
          validFrom: coupon.validFrom || null,
          validTill: coupon.validTill || null,
          expiresAt: coupon.validTill || coupon.expiresAt || null,
          couponType: coupon.couponType,
          canRedeem,
          unavailableReason,
        };
      })
      .filter(Boolean);

    console.log('[coupons/general] response payload ready', {
      appliesTo: filterAppliesTo || 'all',
      couponCount: coupons.length,
      couponCodes: coupons.map((item) => item.code).slice(0, 25),
      userId: req.user?.id || null,
    });

    return res.status(200).json({ coupons: Array.isArray(coupons) ? coupons : [] });
  } catch (error) {
    console.error('[coupons/general] failed, returning empty payload', {
      appliesTo: filterAppliesTo || 'all',
      userId: req.user?.id || null,
      message: String(error?.message || error),
    });
    return res.status(200).json({ coupons: [] });
  }
});

app.post('/api/admin/coupons', requireAuth, requireAdmin, async (req, res) => {
  let code = normalizeCouponCode(req.body?.code);
  const description = String(req.body?.description || '').trim();
  const festivalName = String(req.body?.festivalName || '').trim();
  const discountType = 'flat';
  const discountValue = Number(req.body?.discountValue || 0);
  const appliesTo = 'all';
  const recipientEmail = String(req.body?.recipientEmail || '').trim().toLowerCase();
  const sendEmail = req.body?.sendEmail !== false;
  let couponType = String(req.body?.couponType || '').trim().toLowerCase();
  if (!['public', 'private'].includes(couponType)) {
    couponType = recipientEmail ? 'private' : 'public';
  }
  const singleUse = Boolean(req.body?.singleUse) || couponType === 'private';
  const maxRedemptionsRaw = req.body?.maxRedemptions;
  let maxRedemptions =
    maxRedemptionsRaw === '' || maxRedemptionsRaw == null ? null : Number(maxRedemptionsRaw);
  const validFrom = String(req.body?.validFrom || '').trim();
  const validTill = String(req.body?.validTill || req.body?.expiresAt || '').trim();

  if (!code) {
    code = generateUniqueCouponCode();
  }
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return res.status(400).json({ message: 'discountValue must be greater than 0.' });
  }
  if (discountValue > 10000000) {
    return res.status(400).json({ message: 'discountValue is too large.' });
  }
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    return res.status(400).json({ message: 'recipientEmail must be a valid email.' });
  }
  if (couponType === 'private' && !recipientEmail) {
    return res.status(400).json({ message: 'recipientEmail is required for private coupons.' });
  }
  if (sendEmail && couponType !== 'private') {
    return res.status(400).json({ message: 'Email sending is supported only for private coupons.' });
  }
  if (sendEmail && !recipientEmail) {
    return res.status(400).json({ message: 'recipientEmail is required to send the coupon.' });
  }
  if (singleUse || couponType === 'private') {
    maxRedemptions = 1;
  }
  if (maxRedemptions != null && (!Number.isInteger(maxRedemptions) || maxRedemptions <= 0)) {
    return res.status(400).json({ message: 'maxRedemptions must be a positive integer.' });
  }
  if (validFrom) {
    const parsedStart = new Date(validFrom);
    if (Number.isNaN(parsedStart.getTime())) {
      return res.status(400).json({ message: 'validFrom must be a valid date.' });
    }
  }
  if (validTill) {
    const parsedExpiry = new Date(validTill);
    if (Number.isNaN(parsedExpiry.getTime())) {
      return res.status(400).json({ message: 'validTill must be a valid date.' });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDateOnly = new Date(parsedExpiry);
    expiryDateOnly.setHours(0, 0, 0, 0);
    if (expiryDateOnly < today) {
      return res.status(400).json({ message: 'validTill cannot be in the past.' });
    }
  }
  if (validFrom && validTill && new Date(validFrom).getTime() >= new Date(validTill).getTime()) {
    return res.status(400).json({ message: 'validTill must be after validFrom.' });
  }

  const assignedUserEmail = couponType === 'private' ? recipientEmail : '';
  const recipient = assignedUserEmail ? getUserByEmail(assignedUserEmail) : null;
  const recipientName = recipient?.name || '';
  const initialEmailStatus = sendEmail && couponType === 'private' ? 'pending' : 'draft';

  db.prepare(
    `INSERT INTO coupons (
      code, description, discount_type, discount_value, applies_to, max_redemptions, per_user_limit, expires_at, active,
      coupon_type, assigned_user_email, used_by, is_active, valid_from, valid_till,
      recipient_email, recipient_name, festival_name, emailed_at, email_status, email_error, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, '[]', 1, ?, ?, ?, ?, ?, NULL, ?, ?, datetime('now'))
    ON CONFLICT(code) DO UPDATE SET
      description = excluded.description,
      discount_type = excluded.discount_type,
      discount_value = excluded.discount_value,
      applies_to = excluded.applies_to,
      max_redemptions = excluded.max_redemptions,
      per_user_limit = excluded.per_user_limit,
      expires_at = excluded.expires_at,
      coupon_type = excluded.coupon_type,
      assigned_user_email = excluded.assigned_user_email,
      is_active = excluded.is_active,
      valid_from = excluded.valid_from,
      valid_till = excluded.valid_till,
      recipient_email = excluded.recipient_email,
      recipient_name = excluded.recipient_name,
      festival_name = excluded.festival_name,
      email_status = excluded.email_status,
      email_error = excluded.email_error,
      active = 1`
  ).run(
    code,
    description,
    discountType,
    discountValue,
    appliesTo,
    maxRedemptions,
    validTill || null,
    couponType,
    assignedUserEmail || null,
    validFrom || null,
    validTill || null,
    assignedUserEmail || null,
    recipientName || null,
    festivalName || null,
    initialEmailStatus,
    ''
  );

  let emailStatus = initialEmailStatus;
  let emailMessage = '';
  if (sendEmail && assignedUserEmail) {
    const emailResult = await sendCouponEmail({
      toEmail: assignedUserEmail,
      recipientName,
      code,
      discountValue,
      appliesTo,
      expiresAt: validTill,
    });
    if (!emailResult.ok) {
      emailStatus = 'failed';
      emailMessage = emailResult.message || 'Unable to send email.';
      db.prepare(
        `UPDATE coupons
         SET email_status = ?, email_error = ?, emailed_at = NULL
         WHERE code = ?`
      ).run(emailStatus, emailMessage, code);
    } else {
      emailStatus = 'sent';
      db.prepare(
        `UPDATE coupons
         SET email_status = ?, email_error = '', emailed_at = datetime('now')
         WHERE code = ?`
      ).run(emailStatus, code);
    }
  }

  res.status(201).json({
    message: 'Coupon saved.',
    code,
    emailStatus,
    emailMessage,
  });
});

app.delete('/api/admin/coupons/:id', requireAuth, requireAdmin, (req, res) => {
  const couponId = Number(req.params.id);
  if (!Number.isInteger(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon id.' });
  }

  db.prepare('DELETE FROM coupons WHERE id = ?').run(couponId);
  res.json({ message: 'Coupon removed.' });
});

app.post('/api/admin/coupons/:id/resend', requireAuth, requireAdmin, async (req, res) => {
  const couponId = Number(req.params.id);
  if (!Number.isInteger(couponId)) {
    return res.status(400).json({ message: 'Invalid coupon id.' });
  }

  const coupon = getCouponById(couponId);
  if (!coupon) {
    return res.status(404).json({ message: 'Coupon not found.' });
  }
  if (coupon.couponType !== 'private') {
    return res.status(400).json({ message: 'Only private coupons can be emailed.' });
  }

  const recipientEmail = String(req.body?.recipientEmail || coupon.assignedUserEmail || coupon.recipientEmail || '').trim().toLowerCase();
  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return res.status(400).json({ message: 'Valid recipientEmail is required.' });
  }

  const recipient = getUserByEmail(recipientEmail);
  const recipientName = recipient?.name || coupon.recipientName || '';
  const emailResult = await sendCouponEmail({
    toEmail: recipientEmail,
    recipientName,
    code: coupon.code,
    discountValue: coupon.discountValue,
    appliesTo: coupon.appliesTo,
    expiresAt: coupon.expiresAt,
  });

  if (!emailResult.ok) {
    const message = emailResult.message || 'Unable to send email.';
    db.prepare(
      `UPDATE coupons
       SET recipient_email = ?, assigned_user_email = ?, recipient_name = ?, email_status = ?, email_error = ?, emailed_at = NULL
       WHERE id = ?`
    ).run(recipientEmail, recipientEmail, recipientName || null, 'failed', message, couponId);
    return res.status(500).json({ message });
  }

  db.prepare(
    `UPDATE coupons
     SET recipient_email = ?, assigned_user_email = ?, recipient_name = ?, email_status = ?, email_error = '', emailed_at = datetime('now')
     WHERE id = ?`
  ).run(recipientEmail, recipientEmail, recipientName || null, 'sent', couponId);

  res.json({ message: 'Coupon emailed.', emailStatus: 'sent' });
});

app.patch('/api/admin/doctors/:id/approval', requireAuth, requireAdmin, (req, res) => {
  const doctorId = Number(req.params.id);
  const approvalStatus = String(req.body?.approvalStatus || '').trim().toLowerCase();

  if (!Number.isInteger(doctorId)) {
    return res.status(400).json({ message: 'invalid doctor id' });
  }
  if (!['pending', 'approved', 'rejected'].includes(approvalStatus)) {
    return res.status(400).json({ message: 'approvalStatus must be pending/approved/rejected' });
  }

  const existing = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);
  if (!existing) {
    return res.status(404).json({ message: 'doctor not found' });
  }

  db.prepare('UPDATE doctors SET approval_status = ? WHERE id = ?').run(approvalStatus, doctorId);
  const doctor = db
    .prepare(
      `SELECT id, user_id AS userId, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays,
              approval_status AS approvalStatus, created_at AS createdAt
       FROM doctors
       WHERE id = ?`
    )
    .get(doctorId);

  res.json({ doctor });
});

app.post('/api/admin/doctors', requireAuth, requireAdmin, (req, res) => {
  const payload = validateDoctorPayload(req.body);
  if (payload.error) return res.status(400).json({ message: payload.error });

  const result = db
    .prepare(
      `INSERT INTO doctors (
        name, specialty, bio, experience_years, consultation_fee, available_days, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      payload.data.name,
      payload.data.specialty,
      payload.data.bio,
      payload.data.experienceYears,
      payload.data.consultationFee,
      payload.data.availableDays
    );

  const doctor = db
    .prepare(
      `SELECT id, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays, created_at AS createdAt
       FROM doctors WHERE id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ doctor });
});

app.put('/api/admin/doctors/:id', requireAuth, requireAdmin, (req, res) => {
  const doctorId = Number(req.params.id);
  if (!Number.isInteger(doctorId)) {
    return res.status(400).json({ message: 'invalid doctor id' });
  }

  const existing = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);
  if (!existing) {
    return res.status(404).json({ message: 'doctor not found' });
  }

  const payload = validateDoctorPayload(req.body);
  if (payload.error) return res.status(400).json({ message: payload.error });

  db.prepare(
    `UPDATE doctors
     SET name = ?, specialty = ?, bio = ?, experience_years = ?, consultation_fee = ?, available_days = ?
     WHERE id = ?`
  ).run(
    payload.data.name,
    payload.data.specialty,
    payload.data.bio,
    payload.data.experienceYears,
    payload.data.consultationFee,
    payload.data.availableDays,
    doctorId
  );

  const doctor = db
    .prepare(
      `SELECT id, name, specialty, bio, experience_years AS experienceYears,
              consultation_fee AS consultationFee, available_days AS availableDays, created_at AS createdAt
       FROM doctors WHERE id = ?`
    )
    .get(doctorId);

  res.json({ doctor });
});

app.delete('/api/admin/doctors/:id', requireAuth, requireAdmin, (req, res) => {
  const doctorId = Number(req.params.id);
  if (!Number.isInteger(doctorId)) {
    return res.status(400).json({ message: 'invalid doctor id' });
  }

  const existing = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);
  if (!existing) {
    return res.status(404).json({ message: 'doctor not found' });
  }

  const activeBooking = db
    .prepare(
      `SELECT id
       FROM bookings
       WHERE doctor_id = ?
         AND status IN ('pending', 'booked', 'confirmed')
       LIMIT 1`
    )
    .get(doctorId);

  if (activeBooking) {
    return res.status(409).json({ message: 'cannot delete doctor with active bookings' });
  }

  db.prepare('DELETE FROM doctors WHERE id = ?').run(doctorId);
  res.status(204).send();
});

app.get('/api/bookings', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') {
    syncMembershipCoveredHydrogenBookings(req.user.id, req.user);
  }

  const baseQuery = `
    SELECT b.id,
           b.user_id AS userId,
           b.booking_group_id AS bookingGroupId,
           u.name AS clientName,
           u.email AS clientEmail,
           u.mobile AS clientMobile,
           u.age AS clientAge,
           u.gender AS clientGender,
           b.service_name AS serviceName,
           b.booking_date AS bookingDate,
           b.booking_time AS bookingTime,
           b.status,
           b.payment_status AS paymentStatus,
           b.payment_reference AS paymentReference,
           b.paid_amount_paise AS paidAmountPaise,
           b.is_topup_session AS isTopUpSession,
           b.payment_method AS paymentMethod,
           b.paid_at AS paidAt,
           b.payment_link_recipient_email AS paymentLinkRecipientEmail,
           b.payment_link_emailed_at AS paymentLinkEmailedAt,
           b.payment_link_email_status AS paymentLinkEmailStatus,
           b.payment_link_email_error AS paymentLinkEmailError,
           b.payment_link_delivery_status AS paymentLinkDeliveryStatus,
           b.payment_link_delivery_detail AS paymentLinkDeliveryDetail,
           b.payment_link_email_event AS paymentLinkEmailEvent,
           b.payment_link_email_event_at AS paymentLinkEmailEventAt,
           b.reschedule_count AS rescheduleCount,
           b.notes,
           b.created_at AS createdAt
    FROM bookings b
    JOIN users u ON u.id = b.user_id
  `;

  const rows = req.user.role === 'admin'
    ? db.prepare(`${baseQuery} ORDER BY b.booking_date, b.booking_time`).all()
    : db
        .prepare(`${baseQuery} WHERE b.user_id = ? ORDER BY b.booking_date DESC, b.booking_time DESC, b.id DESC`)
        .all(req.user.id);

  const mapped = rows.map(applyHoldMeta);
  if (req.user.role !== 'admin') {
    for (const booking of mapped) {
      if (!booking) continue;
      const paymentStatus = String(booking.paymentStatus || '').trim().toLowerCase();
      if (paymentStatus === 'paid') continue;
      const service = getServiceByName(booking.serviceName);
      if (!service) continue;
      const category = String(service.category || '').toUpperCase();
      if (category === 'EXPERIENCE SESSION') continue;
      const effectivePriceInr = Number(getEffectiveServicePriceInr(service, req.user) || 0);
      if (effectivePriceInr <= 0) {
        booking.paymentStatus = 'paid';
      }
    }
  }

  res.json({ bookings: mapped });
});

function mapBookingNote(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.bookingId,
    noteText: row.noteText || '',
    createdBy: row.createdBy ?? null,
    createdByName: row.createdByName || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
  };
}

function getAdminBookingNote(noteId) {
  return db
    .prepare(
      `SELECT n.id,
              n.booking_id AS bookingId,
              n.note_text AS noteText,
              n.created_by AS createdBy,
              u.name AS createdByName,
              n.created_at AS createdAt,
              n.updated_at AS updatedAt
       FROM booking_notes n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.id = ?`
    )
    .get(noteId);
}

app.get('/api/bookings/:id/notes', requireAuth, requireAdmin, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db.prepare('SELECT id FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const rows = db
    .prepare(
      `SELECT n.id,
              n.booking_id AS bookingId,
              n.note_text AS noteText,
              n.created_by AS createdBy,
              u.name AS createdByName,
              n.created_at AS createdAt,
              n.updated_at AS updatedAt
       FROM booking_notes n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.booking_id = ?
       ORDER BY n.created_at DESC, n.id DESC`
    )
    .all(bookingId);

  res.json({ notes: rows.map(mapBookingNote) });
});

app.post('/api/notes', requireAuth, requireAdmin, (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  const noteText = String(req.body?.noteText || '').trim();

  if (!Number.isInteger(bookingId) || bookingId <= 0) {
    return res.status(400).json({ message: 'invalid booking id' });
  }
  if (!noteText) {
    return res.status(400).json({ message: 'note text is required' });
  }

  const booking = db.prepare('SELECT id FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const result = db
    .prepare(
      `INSERT INTO booking_notes (booking_id, note_text, created_by, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    )
    .run(bookingId, noteText, req.user.id);

  const note = mapBookingNote(getAdminBookingNote(result.lastInsertRowid));
  return res.status(201).json({ note });
});

app.put('/api/notes/:id', requireAuth, requireAdmin, (req, res) => {
  const noteId = Number(req.params.id);
  const noteText = String(req.body?.noteText || '').trim();

  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ message: 'invalid note id' });
  }
  if (!noteText) {
    return res.status(400).json({ message: 'note text is required' });
  }

  const existing = getAdminBookingNote(noteId);
  if (!existing) {
    return res.status(404).json({ message: 'note not found' });
  }

  db.prepare("UPDATE booking_notes SET note_text = ?, updated_at = datetime('now') WHERE id = ?").run(noteText, noteId);
  const note = mapBookingNote(getAdminBookingNote(noteId));
  return res.json({ note });
});

app.delete('/api/notes/:id', requireAuth, requireAdmin, (req, res) => {
  const noteId = Number(req.params.id);
  if (!Number.isInteger(noteId) || noteId <= 0) {
    return res.status(400).json({ message: 'invalid note id' });
  }

  const existing = getAdminBookingNote(noteId);
  if (!existing) {
    return res.status(404).json({ message: 'note not found' });
  }

  db.prepare('DELETE FROM booking_notes WHERE id = ?').run(noteId);
  return res.status(204).send();
});

app.get('/api/doctor/bookings', requireAuth, requireDoctor, (req, res) => {
  return res.status(410).json({ message: 'Doctor bookings are currently disabled.' });
});

app.post('/api/bookings', requireAuth, (req, res) => {
  const requestRole = String(req.user?.role || '').trim().toLowerCase();
  if (requestRole === 'admin') {
    const resolvedCustomer = resolveAdminCustomerContext({
      userId: req.body?.userId,
      customerName: req.body?.customerName,
      customerEmail: req.body?.customerEmail,
      customerPhone: req.body?.customerPhone,
      createIfMissing: true,
    });
    if (resolvedCustomer.error) {
      return res.status(400).json({ message: resolvedCustomer.error });
    }
    return createSingleBookingResponse(req, res, {
      targetUser: resolvedCustomer.user,
      defaultNotes: 'Booked by admin',
      includeAdminMeta: true,
    });
  }

  return createSingleBookingResponse(req, res, {
    targetUser: req.user,
    defaultNotes: '',
    includeAdminMeta: false,
  });
});

app.post('/api/admin/bookings', requireAuth, requireAdmin, (req, res) => {
  const resolvedCustomer = resolveAdminCustomerContext({
    userId: req.body?.userId,
    customerName: req.body?.customerName,
    customerEmail: req.body?.customerEmail,
    customerPhone: req.body?.customerPhone,
    createIfMissing: true,
  });
  if (resolvedCustomer.error) {
    return res.status(400).json({ message: resolvedCustomer.error });
  }
  return createSingleBookingResponse(req, res, {
    targetUser: resolvedCustomer.user,
    defaultNotes: 'Booked by admin',
    includeAdminMeta: true,
  });
});

app.post('/api/hydrogen/create-order', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can create hydrogen bookings' });
  }
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const serviceName = String(req.body?.serviceName || '').trim();
  const service = getServiceByName(serviceName);
  if (!service || String(service.category || '').toUpperCase() !== 'HYDROGEN SESSION') {
    return res.status(400).json({ message: 'Invalid hydrogen package selected.' });
  }

  const packageSessions = getHydrogenSessionCountFromServiceName(service.name);
  const extraSessions = Number(req.body?.extraSessions ?? 0);
  if (!Number.isInteger(extraSessions) || extraSessions < 0) {
    return res.status(400).json({ message: 'extraSessions must be a non-negative integer' });
  }

  const totalSessions = packageSessions + extraSessions;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  if (slots.length !== totalSessions) {
    return res.status(400).json({ message: `Please select exactly ${totalSessions} slots.` });
  }
  const duplicateSlot = findDuplicateHydrogenSlot(slots);
  if (duplicateSlot) {
    return res.status(409).json({
      message: `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${duplicateSlot.bookingTime}.`,
    });
  }

  const normalizedSlots = [];
  for (const slot of slots) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    const bookingTimeRaw = String(slot?.bookingTime || '').trim();
    const bookingTime = normalizeSlotStartTime(bookingTimeRaw);
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: `Invalid bookingDate: ${bookingDate}` });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ message: 'bookingDate cannot be in the past' });
    }
    if (!bookingTime) {
      return res.status(400).json({ message: `Invalid bookingTime: ${bookingTimeRaw}` });
    }
    if (isBookingSlotInPast(bookingDate, bookingTime)) {
      return res.status(400).json({ message: `bookingTime cannot be in the past for ${bookingDate}` });
    }
    normalizedSlots.push({ bookingDate, bookingTime });
  }

  const singleSessionService =
    SERVICE_CATALOG.find(
      (item) =>
        String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
        getHydrogenSessionCountFromServiceName(item.name) === 1
    ) || service;
  const addOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const addOnSessionIndexRaw = req.body?.addOnSessionIndex;
  let addOnService = null;
  let addOnSessionIndex = null;
  if (addOnServiceName) {
    addOnService = getServiceByName(addOnServiceName);
    if (!addOnService || !isAddOnService(addOnService)) {
      return res.status(400).json({ message: 'Invalid add-on selected. Choose one IV Therapy or IV Shot.' });
    }
    addOnSessionIndex = Number(addOnSessionIndexRaw);
    if (!Number.isInteger(addOnSessionIndex) || addOnSessionIndex < 0 || addOnSessionIndex >= totalSessions) {
      return res.status(400).json({ message: 'addOnSessionIndex must point to a valid session.' });
    }
  }
  const addOnPriceInr = addOnService ? getEffectiveServicePriceInr(addOnService, req.user) : 0;
  const forceChargeable = Boolean(req.body?.forceChargeable || req.body?.chargeAllSessions);
  const pricing = buildHydrogenPackPricingSummary({
    user: req.user,
    userId: req.user.id,
    baseService: service,
    packageSessions,
    extraSessions,
    addOnAmountInr: addOnPriceInr,
    forceChargeable,
  });
  const pricingSummary = finalizeSummaryWithGst(pricing.summary || { totalAmountInr: pricing.totalAmountInr || 0 });
  const totalAmountInr = Number(pricingSummary.totalAmountInr || 0);
  const hydrogenDailyLimitConflict = validateHydrogenDailySessionLimit(req.user.id, normalizedSlots);
  if (hydrogenDailyLimitConflict) {
    return res.status(409).json({
      message: `Only ${hydrogenDailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
    });
  }
  if (addOnService) {
    const addOnSlot = normalizedSlots[addOnSessionIndex];
    const cooldownConflict = findIvCooldownConflict(req.user.id, addOnService.name, addOnSlot?.bookingDate);
    if (cooldownConflict) {
      return res.status(409).json({
        message: getIvCooldownResponseMessage(cooldownConflict),
      });
    }
  }
  if (totalAmountInr <= 0) {
    return res.status(409).json({ message: 'No payment is required for this booking.' });
  }
  const amountInPaise = Math.round(totalAmountInr * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: buildRazorpayReceipt('hydrogen', req.user.id),
      notes: {
        userId: String(req.user.id),
        serviceName: service.name,
        sessions: String(totalSessions),
      },
    });

    const insertBooking = db.prepare(
      `INSERT INTO bookings (
        user_id, doctor_id, client_name, client_email, client_phone,
        service_name, booking_date, booking_time, assigned_staff, status, payment_status, payment_order_id, booking_group_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'payment_pending', ?, ?, ?, ?)`
    );
    const countActiveForSlot = db.prepare(
      `SELECT
          SUM(CASE WHEN ${activeBookingSql()} THEN 1 ELSE 0 END) AS activeTotal,
          SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
       FROM bookings
       WHERE service_name = ?
         AND booking_date = ?
         AND booking_time = ?
         AND status IN ('pending', 'booked', 'confirmed')`
    );
    const maxPerSlot = getSlotCapacityForServiceName(service.name);
    const inRequestCounter = new Map();
    const bookingGroupId = createBookingGroupId('hydrogen');
    let addOnSummary = null;

    const createdIds = [];
    const txn = db.transaction((entries) => {
      entries.forEach((entry, index) => {
        const key = `${entry.bookingDate}|${entry.bookingTime}`;
        const alreadyInRequest = Number(inRequestCounter.get(key) || 0);
        const slotStats = countActiveForSlot.get(service.name, entry.bookingDate, entry.bookingTime) || {};
        const existing = Number(slotStats.activeTotal || 0);
        const holdCount = Number(slotStats.holdTotal || 0);
        if (existing + alreadyInRequest >= maxPerSlot) {
          throw new Error(holdCount > 0 ? buildHoldSlotMessage() : `Slot full for ${entry.bookingDate} ${entry.bookingTime}`);
        }
        inRequestCounter.set(key, alreadyInRequest + 1);

        const result = insertBooking.run(
          req.user.id,
          null,
          req.user.name,
          req.user.email,
          req.user.mobile || '-',
          service.name,
          entry.bookingDate,
          entry.bookingTime,
          'H2 House Of Health',
          order.id,
          bookingGroupId,
          `Hydrogen package ${packageSessions} + extra ${extraSessions}`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(result.lastInsertRowid));
      });

      if (addOnService) {
        const addOnSlot = entries[addOnSessionIndex];
        if (!addOnSlot) {
          throw new Error('Invalid add-on session selection');
        }
        if (hasStandaloneIvBookingOnDate(req.user.id, addOnSlot.bookingDate)) {
          throw new Error(
            'A separate IV Therapy/IV Shot is already booked on this date. Hydrogen packages with an IV add-on cannot be combined with separate IV bookings on the same day.'
          );
        }
        if (hasConflictingAddOnBooking(req.user.id, addOnSlot.bookingDate, addOnSlot.bookingTime)) {
          throw new Error(
            'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.'
          );
        }
        const addOnStats = countActiveForSlot.get(addOnService.name, addOnSlot.bookingDate, addOnSlot.bookingTime) || {};
        const existingAddOn = Number(addOnStats.activeTotal || 0);
        const holdAddOn = Number(addOnStats.holdTotal || 0);
        const addOnCapacity = getSlotCapacityForServiceName(addOnService.name);
        if (existingAddOn >= addOnCapacity) {
          throw new Error(holdAddOn > 0 ? buildHoldSlotMessage() : `Add-on slot full for ${addOnSlot.bookingDate} ${addOnSlot.bookingTime}`);
        }

        const result = insertBooking.run(
          req.user.id,
          null,
          req.user.name,
          req.user.email,
          req.user.mobile || '-',
          addOnService.name,
          addOnSlot.bookingDate,
          addOnSlot.bookingTime,
          'H2 House Of Health',
          order.id,
          bookingGroupId,
          `IV add-on for ${service.name} (Session ${addOnSessionIndex + 1})`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(result.lastInsertRowid));

        addOnSummary = {
          serviceName: addOnService.name,
          bookingDate: addOnSlot.bookingDate,
          bookingTime: addOnSlot.bookingTime,
          sessionNumber: addOnSessionIndex + 1,
          amountInr: Number(addOnPriceInr || 0),
        };
      }
    });

    txn(normalizedSlots);
    setPaymentAmountForBookingIds(createdIds, amountInPaise);

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      totalSessions,
      amountInr: totalAmountInr,
      summary: {
        ...pricingSummary,
        addOn: addOnSummary,
      },
      user: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to prepare hydrogen order' });
  }
});

app.post('/api/hydrogen/book-pack', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can create hydrogen bookings' });
  }

  const serviceName = String(req.body?.serviceName || '').trim();
  const service = getServiceByName(serviceName);
  if (!service || String(service.category || '').toUpperCase() !== 'HYDROGEN SESSION') {
    return res.status(400).json({ message: 'Invalid hydrogen package selected.' });
  }

  const packageSessions = getHydrogenSessionCountFromServiceName(service.name);
  const extraSessions = Number(req.body?.extraSessions ?? 0);
  if (!Number.isInteger(extraSessions) || extraSessions < 0) {
    return res.status(400).json({ message: 'extraSessions must be a non-negative integer' });
  }

  const totalSessions = packageSessions + extraSessions;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  if (slots.length !== totalSessions) {
    return res.status(400).json({ message: `Please select exactly ${totalSessions} slots.` });
  }
  const duplicateSlot = findDuplicateHydrogenSlot(slots);
  if (duplicateSlot) {
    return res.status(409).json({
      message: `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${duplicateSlot.bookingTime}.`,
    });
  }

  const normalizedSlots = [];
  for (const slot of slots) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    const bookingTimeRaw = String(slot?.bookingTime || '').trim();
    const bookingTime = normalizeSlotStartTime(bookingTimeRaw);
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: `Invalid bookingDate: ${bookingDate}` });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ message: 'bookingDate cannot be in the past' });
    }
    if (!bookingTime) {
      return res.status(400).json({ message: `Invalid bookingTime: ${bookingTimeRaw}` });
    }
    if (isBookingSlotInPast(bookingDate, bookingTime)) {
      return res.status(400).json({ message: `bookingTime cannot be in the past for ${bookingDate}` });
    }
    normalizedSlots.push({ bookingDate, bookingTime });
  }

  const addOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const addOnSessionIndexRaw = req.body?.addOnSessionIndex;
  let addOnService = null;
  let addOnSessionIndex = null;
  if (addOnServiceName) {
    addOnService = getServiceByName(addOnServiceName);
    if (!addOnService || !isAddOnService(addOnService)) {
      return res.status(400).json({ message: 'Invalid add-on selected. Choose one IV Therapy or IV Shot.' });
    }
    addOnSessionIndex = Number(addOnSessionIndexRaw);
    if (!Number.isInteger(addOnSessionIndex) || addOnSessionIndex < 0 || addOnSessionIndex >= totalSessions) {
      return res.status(400).json({ message: 'addOnSessionIndex must point to a valid session.' });
    }
  }
  const addOnPriceInr = addOnService ? getEffectiveServicePriceInr(addOnService, req.user) : 0;
  const forceChargeable = Boolean(req.body?.forceChargeable || req.body?.chargeAllSessions);
  const pricing = buildHydrogenPackPricingSummary({
    user: req.user,
    userId: req.user.id,
    baseService: service,
    packageSessions,
    extraSessions,
    addOnAmountInr: addOnPriceInr,
    forceChargeable,
  });
  const pricingSummary = finalizeSummaryWithGst(pricing.summary || { totalAmountInr: pricing.totalAmountInr || 0 });
  const totalAmountInr = Number(pricingSummary.totalAmountInr || 0);
  const freeHydrogenSessionsApplied = Number(pricingSummary.freeSessionsApplied || 0);
  const hydrogenDailyLimitConflict = validateHydrogenDailySessionLimit(req.user.id, normalizedSlots);
  if (hydrogenDailyLimitConflict) {
    return res.status(409).json({
      message: `Only ${hydrogenDailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
    });
  }
  if (addOnService) {
    const addOnSlot = normalizedSlots[addOnSessionIndex];
    const cooldownConflict = findIvCooldownConflict(req.user.id, addOnService.name, addOnSlot?.bookingDate);
    if (cooldownConflict) {
      return res.status(409).json({
        message: getIvCooldownResponseMessage(cooldownConflict),
      });
    }
  }

  try {
    const bookingGroupId = createBookingGroupId('hydrogen');
    const insertBooking = db.prepare(
      `INSERT INTO bookings (
        user_id, doctor_id, client_name, client_email, client_phone,
        service_name, booking_date, booking_time, assigned_staff, status, payment_status, paid_at, payment_reference, is_topup_session, booking_group_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const countActiveForSlot = db.prepare(
      `SELECT
          SUM(CASE WHEN ${activeBookingSql()} THEN 1 ELSE 0 END) AS activeTotal,
          SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
       FROM bookings
       WHERE service_name = ?
         AND booking_date = ?
         AND booking_time = ?
         AND status IN ('pending', 'booked', 'confirmed')`
    );
    const maxPerSlot = getSlotCapacityForServiceName(service.name);
    const inRequestCounter = new Map();
    const createdIds = [];
    let addOnSummary = null;

    const txn = db.transaction((entries) => {
      entries.forEach((entry, index) => {
        const key = `${entry.bookingDate}|${entry.bookingTime}`;
        const alreadyInRequest = Number(inRequestCounter.get(key) || 0);
        const slotStats = countActiveForSlot.get(service.name, entry.bookingDate, entry.bookingTime) || {};
        const existing = Number(slotStats.activeTotal || 0);
        const holdCount = Number(slotStats.holdTotal || 0);
        if (existing + alreadyInRequest >= maxPerSlot) {
          throw new Error(holdCount > 0 ? buildHoldSlotMessage() : `Slot full for ${entry.bookingDate} ${entry.bookingTime}`);
        }
        inRequestCounter.set(key, alreadyInRequest + 1);

        const isMembershipCovered = index < freeHydrogenSessionsApplied;
        const paymentReference = isMembershipCovered ? 'membership' : forceChargeable ? 'buy_extra' : null;
        const entryPaymentStatus = isMembershipCovered ? 'paid' : 'unpaid';
        const result = insertBooking.run(
          req.user.id,
          null,
          req.user.name,
          req.user.email,
          req.user.mobile || '-',
          service.name,
          entry.bookingDate,
          entry.bookingTime,
          'H2 House Of Health',
          isMembershipCovered ? 'booked' : 'pending',
          entryPaymentStatus,
          isMembershipCovered ? getCurrentSqliteTimestamp() : null,
          paymentReference,
          forceChargeable ? 1 : 0,
          bookingGroupId,
          `Hydrogen package ${packageSessions} + extra ${extraSessions}`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(result.lastInsertRowid));
      });

      if (addOnService) {
        const addOnSlot = entries[addOnSessionIndex];
        if (!addOnSlot) {
          throw new Error('Invalid add-on session selection');
        }
        if (hasStandaloneIvBookingOnDate(req.user.id, addOnSlot.bookingDate)) {
          throw new Error(
            'A separate IV Therapy/IV Shot is already booked on this date. Hydrogen packages with an IV add-on cannot be combined with separate IV bookings on the same day.'
          );
        }
        if (hasConflictingAddOnBooking(req.user.id, addOnSlot.bookingDate, addOnSlot.bookingTime)) {
          throw new Error(
            'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.'
          );
        }
        const addOnStats = countActiveForSlot.get(addOnService.name, addOnSlot.bookingDate, addOnSlot.bookingTime) || {};
        const existingAddOn = Number(addOnStats.activeTotal || 0);
        const holdAddOn = Number(addOnStats.holdTotal || 0);
        const addOnCapacity = getSlotCapacityForServiceName(addOnService.name);
        if (existingAddOn >= addOnCapacity) {
          throw new Error(holdAddOn > 0 ? buildHoldSlotMessage() : `Add-on slot full for ${addOnSlot.bookingDate} ${addOnSlot.bookingTime}`);
        }

        const addOnPaymentStatus = addOnPriceInr > 0 ? 'unpaid' : 'paid';
        const addOnResult = insertBooking.run(
          req.user.id,
          null,
          req.user.name,
          req.user.email,
          req.user.mobile || '-',
          addOnService.name,
          addOnSlot.bookingDate,
          addOnSlot.bookingTime,
          'H2 House Of Health',
          addOnPaymentStatus === 'paid' ? 'booked' : 'pending',
          addOnPaymentStatus,
          addOnPaymentStatus === 'paid' ? getCurrentSqliteTimestamp() : null,
          null,
          0,
          bookingGroupId,
          `IV add-on for ${service.name} (Session ${addOnSessionIndex + 1})`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(addOnResult.lastInsertRowid));
        addOnSummary = {
          serviceName: addOnService.name,
          bookingDate: addOnSlot.bookingDate,
          bookingTime: addOnSlot.bookingTime,
          sessionNumber: addOnSessionIndex + 1,
          amountInr: Number(addOnPriceInr || 0),
        };
      }
    });

    txn(normalizedSlots);

    const bookings = db
      .prepare(
        `SELECT b.id, b.service_name AS serviceName, b.booking_date AS bookingDate, b.booking_time AS bookingTime, b.status, b.payment_status AS paymentStatus
                , b.payment_reference AS paymentReference
         FROM bookings b
         WHERE b.id IN (${createdIds.map(() => '?').join(', ')})
         ORDER BY b.booking_date, b.booking_time`
      )
      .all(...createdIds);

    return res.status(201).json({
      message: 'Hydrogen bookings saved successfully.',
      summary: {
        serviceName: service.name,
        addOn: addOnSummary,
        ...pricingSummary,
      },
      bookings,
    });
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to save hydrogen bookings' });
  }
});

app.post('/api/admin/hydrogen/book-pack', requireAuth, requireAdmin, (req, res) => {
  const resolvedCustomer = resolveAdminCustomerContext({
    userId: req.body?.userId,
    customerName: req.body?.customerName,
    customerEmail: req.body?.customerEmail,
    customerPhone: req.body?.customerPhone,
    createIfMissing: true,
  });
  if (resolvedCustomer.error) {
    return res.status(400).json({ message: resolvedCustomer.error });
  }
  const targetUser = resolvedCustomer.user;

  const serviceName = String(req.body?.serviceName || '').trim();
  const service = getServiceByName(serviceName);
  if (!service || String(service.category || '').toUpperCase() !== 'HYDROGEN SESSION') {
    return res.status(400).json({ message: 'Invalid hydrogen package selected.' });
  }

  const packageSessions = getHydrogenSessionCountFromServiceName(service.name);
  const extraSessions = Number(req.body?.extraSessions ?? 0);
  if (!Number.isInteger(extraSessions) || extraSessions < 0) {
    return res.status(400).json({ message: 'extraSessions must be a non-negative integer' });
  }

  const totalSessions = packageSessions + extraSessions;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  if (slots.length !== totalSessions) {
    return res.status(400).json({ message: `Please select exactly ${totalSessions} slots.` });
  }
  const duplicateSlot = findDuplicateHydrogenSlot(slots);
  if (duplicateSlot) {
    return res.status(409).json({
      message: `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${duplicateSlot.bookingTime}.`,
    });
  }

  const normalizedSlots = [];
  for (const slot of slots) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    const bookingTimeRaw = String(slot?.bookingTime || '').trim();
    const bookingTime = normalizeSlotStartTime(bookingTimeRaw);
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: `Invalid bookingDate: ${bookingDate}` });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ message: 'bookingDate cannot be in the past' });
    }
    if (!bookingTime) {
      return res.status(400).json({ message: `Invalid bookingTime: ${bookingTimeRaw}` });
    }
    if (isBookingSlotInPast(bookingDate, bookingTime)) {
      return res.status(400).json({ message: `bookingTime cannot be in the past for ${bookingDate}` });
    }
    normalizedSlots.push({ bookingDate, bookingTime });
  }

  const addOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const addOnSessionIndexRaw = req.body?.addOnSessionIndex;
  let addOnService = null;
  let addOnSessionIndex = null;
  if (addOnServiceName) {
    addOnService = getServiceByName(addOnServiceName);
    if (!addOnService || !isAddOnService(addOnService)) {
      return res.status(400).json({ message: 'Invalid add-on selected. Choose one IV Therapy or IV Shot.' });
    }
    addOnSessionIndex = Number(addOnSessionIndexRaw);
    if (!Number.isInteger(addOnSessionIndex) || addOnSessionIndex < 0 || addOnSessionIndex >= totalSessions) {
      return res.status(400).json({ message: 'addOnSessionIndex must point to a valid session.' });
    }
  }
  const addOnPriceInr = addOnService ? getEffectiveServicePriceInr(addOnService, targetUser) : 0;
  const forceChargeable = Boolean(req.body?.forceChargeable || req.body?.chargeAllSessions);
  const pricing = buildHydrogenPackPricingSummary({
    user: targetUser,
    userId: targetUser.id,
    baseService: service,
    packageSessions,
    extraSessions,
    addOnAmountInr: addOnPriceInr,
    forceChargeable,
  });
  const pricingSummary = finalizeSummaryWithGst(pricing.summary || { totalAmountInr: pricing.totalAmountInr || 0 });
  const totalAmountInr = Number(pricingSummary.totalAmountInr || 0);
  const freeHydrogenSessionsApplied = Number(pricingSummary.freeSessionsApplied || 0);
  const hydrogenDailyLimitConflict = validateHydrogenDailySessionLimit(targetUser.id, normalizedSlots);
  if (hydrogenDailyLimitConflict) {
    return res.status(409).json({
      message: `Only ${hydrogenDailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
    });
  }

  try {
    const bookingGroupId = createBookingGroupId('hydrogen');
    const insertBooking = db.prepare(
      `INSERT INTO bookings (
        user_id, doctor_id, client_name, client_email, client_phone,
        service_name, booking_date, booking_time, assigned_staff, status, payment_status, paid_at, payment_reference, is_topup_session, booking_group_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const countActiveForSlot = db.prepare(
      `SELECT
          SUM(CASE WHEN ${activeBookingSql()} THEN 1 ELSE 0 END) AS activeTotal,
          SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
       FROM bookings
       WHERE service_name = ?
         AND booking_date = ?
         AND booking_time = ?
         AND status IN ('pending', 'booked', 'confirmed')`
    );
    const maxPerSlot = getSlotCapacityForServiceName(service.name);
    const inRequestCounter = new Map();
    const createdIds = [];
    let addOnSummary = null;

    const txn = db.transaction((entries) => {
      entries.forEach((entry, index) => {
        const key = `${entry.bookingDate}|${entry.bookingTime}`;
        const alreadyInRequest = Number(inRequestCounter.get(key) || 0);
        const slotStats = countActiveForSlot.get(service.name, entry.bookingDate, entry.bookingTime) || {};
        const existing = Number(slotStats.activeTotal || 0);
        const holdCount = Number(slotStats.holdTotal || 0);
        if (existing + alreadyInRequest >= maxPerSlot) {
          throw new Error(holdCount > 0 ? buildHoldSlotMessage() : `Slot full for ${entry.bookingDate} ${entry.bookingTime}`);
        }
        inRequestCounter.set(key, alreadyInRequest + 1);

        const isMembershipCovered = index < freeHydrogenSessionsApplied;
        const paymentReference = isMembershipCovered ? 'membership' : forceChargeable ? 'buy_extra' : null;
        const entryPaymentStatus = isMembershipCovered ? 'paid' : 'unpaid';
        const result = insertBooking.run(
          targetUser.id,
          null,
          targetUser.name,
          targetUser.email,
          targetUser.mobile || '-',
          service.name,
          entry.bookingDate,
          entry.bookingTime,
          'H2 House Of Health',
          isMembershipCovered ? 'booked' : 'pending',
          entryPaymentStatus,
          isMembershipCovered ? getCurrentSqliteTimestamp() : null,
          paymentReference,
          forceChargeable ? 1 : 0,
          bookingGroupId,
          `Hydrogen package ${packageSessions} + extra ${extraSessions} (booked by admin)`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(result.lastInsertRowid));
      });

      if (addOnService) {
        const addOnSlot = entries[addOnSessionIndex];
        if (!addOnSlot) {
          throw new Error('Invalid add-on session selection');
        }
        if (hasStandaloneIvBookingOnDate(targetUser.id, addOnSlot.bookingDate)) {
          throw new Error(
            'A separate IV Therapy/IV Shot is already booked on this date. Hydrogen packages with an IV add-on cannot be combined with separate IV bookings on the same day.'
          );
        }
        if (hasConflictingAddOnBooking(targetUser.id, addOnSlot.bookingDate, addOnSlot.bookingTime)) {
          throw new Error(
            'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.'
          );
        }
        const addOnStats = countActiveForSlot.get(addOnService.name, addOnSlot.bookingDate, addOnSlot.bookingTime) || {};
        const existingAddOn = Number(addOnStats.activeTotal || 0);
        const holdAddOn = Number(addOnStats.holdTotal || 0);
        const addOnCapacity = getSlotCapacityForServiceName(addOnService.name);
        if (existingAddOn >= addOnCapacity) {
          throw new Error(holdAddOn > 0 ? buildHoldSlotMessage() : `Add-on slot full for ${addOnSlot.bookingDate} ${addOnSlot.bookingTime}`);
        }

        const addOnPaymentStatus = addOnPriceInr > 0 ? 'unpaid' : 'paid';
        const addOnResult = insertBooking.run(
          targetUser.id,
          null,
          targetUser.name,
          targetUser.email,
          targetUser.mobile || '-',
          addOnService.name,
          addOnSlot.bookingDate,
          addOnSlot.bookingTime,
          'H2 House Of Health',
          addOnPaymentStatus === 'paid' ? 'booked' : 'pending',
          addOnPaymentStatus,
          addOnPaymentStatus === 'paid' ? getCurrentSqliteTimestamp() : null,
          null,
          0,
          bookingGroupId,
          `IV add-on for ${service.name} (Session ${addOnSessionIndex + 1}) (booked by admin)`,
          getCurrentSqliteTimestamp()
        );
        createdIds.push(Number(addOnResult.lastInsertRowid));
        addOnSummary = {
          serviceName: addOnService.name,
          bookingDate: addOnSlot.bookingDate,
          bookingTime: addOnSlot.bookingTime,
          sessionNumber: addOnSessionIndex + 1,
          amountInr: Number(addOnPriceInr || 0),
        };
      }
    });

    txn(normalizedSlots);

    const bookings = db
      .prepare(
        `SELECT b.id, b.service_name AS serviceName, b.booking_date AS bookingDate, b.booking_time AS bookingTime, b.status, b.payment_status AS paymentStatus,
                b.payment_reference AS paymentReference
         FROM bookings b
         WHERE b.id IN (${createdIds.map(() => '?').join(', ')})
         ORDER BY b.booking_date, b.booking_time`
      )
      .all(...createdIds);

    return res.status(201).json({
      message: 'Hydrogen bookings saved successfully.',
      summary: {
        serviceName: service.name,
        ...pricingSummary,
        addOn: addOnSummary,
      },
      bookings,
      customer: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        mobile: targetUser.mobile || '',
        membershipStatus: targetUser.membershipStatus || 'inactive',
        membershipExpiresAt: targetUser.membershipExpiresAt || null,
        membershipPeopleCount: targetUser.membershipPeopleCount ?? null,
      },
      paymentLinkUrl:
        totalAmountInr > 0
          ? buildBookingPaymentLink(
              req,
              (bookings.find((entry) => String(entry.paymentStatus || '').toLowerCase() !== 'paid') || bookings[0])?.id,
              targetUser.id
            )
          : '',
    });
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to save hydrogen bookings' });
  }
});

app.put('/api/hydrogen/packages/:groupId', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can edit hydrogen bookings' });
  }

  const bookingGroupId = String(req.params.groupId || '').trim();
  if (!bookingGroupId) {
    return res.status(400).json({ message: 'booking group id is required' });
  }

  const existingBookings = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              reschedule_count AS rescheduleCount,
              notes
       FROM bookings
       WHERE booking_group_id = ?
       ORDER BY booking_date, booking_time, id`
    )
    .all(bookingGroupId);

  if (!existingBookings.length) {
    return res.status(404).json({ message: 'hydrogen booking package not found' });
  }

  if (existingBookings.some((entry) => !canAccessBooking(req.user, entry.userId))) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (existingBookings.some((entry) => ['completed', 'cancelled'].includes(String(entry.status || '').toLowerCase()))) {
    return res.status(409).json({ message: 'completed or cancelled package cannot be edited' });
  }

  const hydrogenBookings = existingBookings.filter((entry) => {
    const service = getServiceByName(entry.serviceName);
    return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
  });
  if (!hydrogenBookings.length) {
    return res.status(400).json({ message: 'invalid hydrogen booking package' });
  }

  const existingAddOnBookings = existingBookings.filter((entry) => {
    const service = getServiceByName(entry.serviceName);
    return isAddOnService(service);
  });
  if (existingAddOnBookings.length > 1) {
    return res.status(409).json({ message: 'package contains multiple add-ons and cannot be edited automatically' });
  }

  const serviceName = String(req.body?.serviceName || '').trim();
  const service = getServiceByName(serviceName);
  if (!service || String(service.category || '').toUpperCase() !== 'HYDROGEN SESSION') {
    return res.status(400).json({ message: 'Invalid hydrogen package selected.' });
  }

  const packageSessions = getHydrogenSessionCountFromServiceName(service.name);
  const extraSessions = Number(req.body?.extraSessions ?? 0);
  if (!Number.isInteger(extraSessions) || extraSessions < 0) {
    return res.status(400).json({ message: 'extraSessions must be a non-negative integer' });
  }

  const totalSessions = packageSessions + extraSessions;
  if (totalSessions !== hydrogenBookings.length) {
    return res.status(400).json({ message: 'Package size cannot be changed during edit.' });
  }

  const slots = Array.isArray(req.body?.slots) ? req.body.slots : [];
  if (slots.length !== totalSessions) {
    return res.status(400).json({ message: `Please select exactly ${totalSessions} slots.` });
  }
  const duplicateSlot = findDuplicateHydrogenSlot(slots);
  if (duplicateSlot) {
    return res.status(409).json({
      message: `Duplicate/conflicting session slot selected for ${duplicateSlot.bookingDate} ${duplicateSlot.bookingTime}.`,
    });
  }

  const normalizedSlots = [];
  for (const slot of slots) {
    const bookingDate = String(slot?.bookingDate || '').trim();
    const bookingTimeRaw = String(slot?.bookingTime || '').trim();
    const bookingTime = normalizeSlotStartTime(bookingTimeRaw);
    const selectedDate = new Date(`${bookingDate}T00:00:00`);
    if (Number.isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: `Invalid bookingDate: ${bookingDate}` });
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selectedDate < today) {
      return res.status(400).json({ message: 'bookingDate cannot be in the past' });
    }
    if (!bookingTime) {
      return res.status(400).json({ message: `Invalid bookingTime: ${bookingTimeRaw}` });
    }
    if (isBookingSlotInPast(bookingDate, bookingTime)) {
      return res.status(400).json({ message: `bookingTime cannot be in the past for ${bookingDate}` });
    }
    normalizedSlots.push({ bookingDate, bookingTime });
  }

  const addOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const addOnSessionIndexRaw = req.body?.addOnSessionIndex;
  let addOnService = null;
  let addOnSessionIndex = null;
  if (addOnServiceName) {
    addOnService = getServiceByName(addOnServiceName);
    if (!addOnService || !isAddOnService(addOnService)) {
      return res.status(400).json({ message: 'Invalid add-on selected. Choose one IV Therapy or IV Shot.' });
    }
    addOnSessionIndex = Number(addOnSessionIndexRaw);
    if (!Number.isInteger(addOnSessionIndex) || addOnSessionIndex < 0 || addOnSessionIndex >= totalSessions) {
      return res.status(400).json({ message: 'addOnSessionIndex must point to a valid session.' });
    }
  }

  const groupHasPaidBookings = existingBookings.some((entry) => String(entry.paymentStatus || '').toLowerCase() === 'paid');
  const existingAddOnServiceName = existingAddOnBookings[0]?.serviceName || '';
  if (groupHasPaidBookings && existingAddOnServiceName && addOnServiceName !== existingAddOnServiceName) {
    return res.status(409).json({ message: 'Paid packages can only reschedule the existing add-on. Add-on pricing changes are blocked.' });
  }
  if (groupHasPaidBookings) {
    const sortedExistingHydrogenBookings = [...hydrogenBookings].sort((a, b) =>
      `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`) || a.id - b.id
    );
    const hydrogenSlotChanged = sortedExistingHydrogenBookings.some((entry, index) => {
      const nextSlot = normalizedSlots[index] || {};
      return entry.bookingDate !== nextSlot.bookingDate || normalizeSlotStartTime(entry.bookingTime) !== nextSlot.bookingTime;
    });
    const addOnSlot = addOnService ? normalizedSlots[addOnSessionIndex] : null;
    const addOnSlotChanged = Boolean(
      existingAddOnBookings[0] &&
        addOnSlot &&
        (existingAddOnBookings[0].bookingDate !== addOnSlot.bookingDate ||
          normalizeSlotStartTime(existingAddOnBookings[0].bookingTime) !== addOnSlot.bookingTime)
    );

    if (hydrogenSlotChanged || addOnSlotChanged) {
      const changedHydrogenAlreadyRescheduled = sortedExistingHydrogenBookings.some((entry, index) => {
        const nextSlot = normalizedSlots[index] || {};
        const slotChanged =
          entry.bookingDate !== nextSlot.bookingDate ||
          normalizeSlotStartTime(entry.bookingTime) !== nextSlot.bookingTime;
        return slotChanged && Number(entry.rescheduleCount || 0) >= 1;
      });
      const changedAddOnAlreadyRescheduled =
        addOnSlotChanged && existingAddOnBookings.some((entry) => Number(entry.rescheduleCount || 0) >= 1);
      const alreadyRescheduled = changedHydrogenAlreadyRescheduled || changedAddOnAlreadyRescheduled;
      if (alreadyRescheduled) {
        return res.status(409).json({
          message: 'You can reschedule only once. Please contact admin for further reschedule changes.',
        });
      }
      const rescheduleCutoffMs = 12 * 60 * 60 * 1000;
      const tooLateBooking = existingBookings.find((entry) => {
        const normalizedExistingTime = normalizeSlotStartTime(String(entry.bookingTime || '').trim()) || String(entry.bookingTime || '').trim();
        const slotStart = new Date(`${String(entry.bookingDate || '').trim()}T${normalizedExistingTime}:00`).getTime();
        return !Number.isFinite(slotStart) || Date.now() > slotStart - rescheduleCutoffMs;
      });
      if (tooLateBooking) {
        return res.status(409).json({
          message: 'Reschedule is allowed only up to 12 hours before slot start time. Please contact admin.',
        });
      }
    }
  }

  const excludeIds = existingBookings.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id));
  const hydrogenDailyLimitConflict = validateHydrogenDailySessionLimit(req.user.id, normalizedSlots, excludeIds);
  if (hydrogenDailyLimitConflict) {
    return res.status(409).json({
      message: `Only ${hydrogenDailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
    });
  }
  const excludePlaceholders = excludeIds.map(() => '?').join(', ');
  const countActiveForSlot = db.prepare(
    `SELECT
        SUM(CASE WHEN ${activeBookingSql()} THEN 1 ELSE 0 END) AS activeTotal,
        SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
     FROM bookings
     WHERE service_name = ?
       AND booking_date = ?
       AND booking_time = ?
       AND status IN ('pending', 'booked', 'confirmed')
       ${excludePlaceholders ? `AND id NOT IN (${excludePlaceholders})` : ''}`
  );
  const inRequestCounter = new Map();

  for (const slot of normalizedSlots) {
    const key = `${slot.bookingDate}|${slot.bookingTime}`;
    const alreadyInRequest = Number(inRequestCounter.get(key) || 0);
    const slotStats = countActiveForSlot.get(service.name, slot.bookingDate, slot.bookingTime, ...excludeIds) || {};
    const existing = Number(slotStats.activeTotal || 0);
    const holdCount = Number(slotStats.holdTotal || 0);
    if (existing + alreadyInRequest >= getSlotCapacityForServiceName(service.name)) {
      return res.status(409).json({ message: holdCount > 0 ? buildHoldSlotMessage() : `Slot full for ${slot.bookingDate} ${slot.bookingTime}` });
    }
    inRequestCounter.set(key, alreadyInRequest + 1);
  }

  let addOnSummary = null;
  if (addOnService) {
    const addOnSlot = normalizedSlots[addOnSessionIndex];
    const cooldownConflict = findIvCooldownConflict(req.user.id, addOnService.name, addOnSlot.bookingDate, excludeIds);
    if (cooldownConflict) {
      return res.status(409).json({
        message: getIvCooldownResponseMessage(cooldownConflict),
      });
    }
    if (hasStandaloneIvBookingOnDate(req.user.id, addOnSlot.bookingDate, excludeIds)) {
      return res.status(409).json({
        message:
          'A separate IV Therapy/IV Shot is already booked on this date. Hydrogen packages with an IV add-on cannot be combined with separate IV bookings on the same day.',
      });
    }
    const addOnNames = SERVICE_CATALOG.filter((entry) => isAddOnService(entry)).map((entry) => entry.name);
    const addOnNamePlaceholders = addOnNames.map(() => '?').join(', ');
    const conflictingAddOn = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM bookings
         WHERE user_id = ?
           AND booking_date = ?
           AND booking_time = ?
           AND ${activeBookingSql()}
           AND service_name IN (${addOnNamePlaceholders})
           ${excludePlaceholders ? `AND id NOT IN (${excludePlaceholders})` : ''}`
      )
      .get(req.user.id, addOnSlot.bookingDate, addOnSlot.bookingTime, ...addOnNames, ...excludeIds);
    if (Number(conflictingAddOn?.total || 0) > 0) {
      return res.status(409).json({
        message:
          'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.',
      });
    }

    const addOnSlotStats = countActiveForSlot.get(addOnService.name, addOnSlot.bookingDate, addOnSlot.bookingTime, ...excludeIds) || {};
    const existingAddOnSlotCount = Number(addOnSlotStats.activeTotal || 0);
    const holdAddOn = Number(addOnSlotStats.holdTotal || 0);
    if (existingAddOnSlotCount >= getSlotCapacityForServiceName(addOnService.name)) {
      return res.status(409).json({ message: holdAddOn > 0 ? buildHoldSlotMessage() : `Add-on slot full for ${addOnSlot.bookingDate} ${addOnSlot.bookingTime}` });
    }
    addOnSummary = {
      serviceName: addOnService.name,
      bookingDate: addOnSlot.bookingDate,
      bookingTime: addOnSlot.bookingTime,
      sessionNumber: addOnSessionIndex + 1,
      amountInr: Number(getEffectiveServicePriceInr(addOnService, req.user) || 0),
    };
  }

  const sortedHydrogenBookings = [...hydrogenBookings].sort((a, b) =>
    `${a.bookingDate}T${a.bookingTime}`.localeCompare(`${b.bookingDate}T${b.bookingTime}`) || a.id - b.id
  );
  const existingAddOnBooking = existingAddOnBookings[0] || null;
  const packagePriceInr = getEffectiveServicePriceInr(service, req.user);
  const singleSessionService =
    SERVICE_CATALOG.find(
      (item) =>
        String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
        getHydrogenSessionCountFromServiceName(item.name) === 1
    ) || service;
  const extraSessionPriceInr = getEffectiveServicePriceInr(singleSessionService, req.user);
  const addOnPriceInr = addOnService ? getEffectiveServicePriceInr(addOnService, req.user) : 0;
  const calculatedTotalAmountInr =
    Number(packagePriceInr || 0) + Number(extraSessionPriceInr || 0) * extraSessions + Number(addOnPriceInr || 0);
  const payableAmountInr = groupHasPaidBookings
    ? addOnService && (!existingAddOnBooking || String(existingAddOnBooking.paymentStatus || '').toLowerCase() !== 'paid')
      ? Number(addOnPriceInr || 0)
      : 0
    : calculatedTotalAmountInr;
  let paymentBookingId = null;

  try {
    const txn = db.transaction(() => {
      const updateHydrogenBooking = db.prepare(
        `UPDATE bookings
         SET service_name = ?,
             booking_date = ?,
             booking_time = ?,
             assigned_staff = 'H2 House Of Health',
             notes = ?,
             reschedule_count = CASE WHEN ? = 1 THEN COALESCE(reschedule_count, 0) + 1 ELSE COALESCE(reschedule_count, 0) END,
             payment_status = CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'unpaid' END,
             payment_order_id = CASE WHEN payment_status = 'paid' THEN payment_order_id ELSE NULL END,
             payment_reference = CASE WHEN payment_status = 'paid' THEN payment_reference ELSE NULL END,
             paid_at = CASE WHEN payment_status = 'paid' THEN paid_at ELSE NULL END,
             paid_amount_paise = CASE WHEN payment_status = 'paid' THEN paid_amount_paise ELSE NULL END,
             status = CASE WHEN status = 'booked' THEN 'booked' ELSE 'pending' END
         WHERE id = ?`
      );
      const updateAddOnBooking = db.prepare(
        `UPDATE bookings
         SET service_name = ?,
             booking_date = ?,
             booking_time = ?,
             assigned_staff = 'H2 House Of Health',
             notes = ?,
             reschedule_count = CASE WHEN ? = 1 THEN COALESCE(reschedule_count, 0) + 1 ELSE COALESCE(reschedule_count, 0) END,
             payment_status = CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'unpaid' END,
             payment_order_id = CASE WHEN payment_status = 'paid' THEN payment_order_id ELSE NULL END,
             payment_reference = CASE WHEN payment_status = 'paid' THEN payment_reference ELSE NULL END,
             paid_at = CASE WHEN payment_status = 'paid' THEN paid_at ELSE NULL END,
             paid_amount_paise = CASE WHEN payment_status = 'paid' THEN paid_amount_paise ELSE NULL END,
             status = CASE WHEN status = 'booked' THEN 'booked' ELSE 'pending' END
         WHERE id = ?`
      );
      const insertAddOnBooking = db.prepare(
        `INSERT INTO bookings (
          user_id, doctor_id, client_name, client_email, client_phone,
          service_name, booking_date, booking_time, assigned_staff, status, payment_status, booking_group_id, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?, ?, ?)`
      );

      sortedHydrogenBookings.forEach((entry, index) => {
        const slot = normalizedSlots[index];
        const slotChanged =
          entry.bookingDate !== slot.bookingDate ||
          normalizeSlotStartTime(String(entry.bookingTime || '').trim()) !== slot.bookingTime;
        const baseNote = `Hydrogen package ${packageSessions} + extra ${extraSessions}`;
        const rescheduleNote = slotChanged
          ? `Rescheduled by user from ${entry.bookingDate} ${entry.bookingTime} to ${slot.bookingDate} ${slot.bookingTime}`
          : '';
        const nextNotes = [baseNote, String(entry.notes || '').trim(), rescheduleNote].filter(Boolean).join('\n');
        updateHydrogenBooking.run(
          service.name,
          slot.bookingDate,
          slot.bookingTime,
          nextNotes,
          slotChanged ? 1 : 0,
          entry.id
        );
      });

      if (addOnService) {
        const addOnSlot = normalizedSlots[addOnSessionIndex];
        const addOnNote = `IV add-on for ${service.name} (Session ${addOnSessionIndex + 1})`;
        if (existingAddOnBooking) {
          const addOnSlotChanged =
            existingAddOnBooking.bookingDate !== addOnSlot.bookingDate ||
            normalizeSlotStartTime(String(existingAddOnBooking.bookingTime || '').trim()) !== addOnSlot.bookingTime;
          const rescheduleNote = addOnSlotChanged
            ? `Rescheduled by user from ${existingAddOnBooking.bookingDate} ${existingAddOnBooking.bookingTime} to ${addOnSlot.bookingDate} ${addOnSlot.bookingTime}`
            : '';
          const nextAddOnNote = [addOnNote, String(existingAddOnBooking.notes || '').trim(), rescheduleNote].filter(Boolean).join('\n');
          updateAddOnBooking.run(
            addOnService.name,
            addOnSlot.bookingDate,
            addOnSlot.bookingTime,
            nextAddOnNote,
            addOnSlotChanged ? 1 : 0,
            existingAddOnBooking.id
          );
          if (String(existingAddOnBooking.paymentStatus || '').toLowerCase() !== 'paid' && Number(addOnPriceInr || 0) > 0) {
            paymentBookingId = Number(existingAddOnBooking.id);
          } else if (String(existingAddOnBooking.paymentStatus || '').toLowerCase() !== 'paid') {
            db.prepare(
              `UPDATE bookings
               SET payment_status = 'paid',
                   paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
                   paid_amount_paise = 0,
                   status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
               WHERE id = ?`
            ).run(existingAddOnBooking.id);
          }
        } else {
          const addOnResult = insertAddOnBooking.run(
            req.user.id,
            null,
            req.user.name,
            req.user.email,
            req.user.mobile || '-',
            addOnService.name,
            addOnSlot.bookingDate,
            addOnSlot.bookingTime,
            'H2 House Of Health',
            bookingGroupId,
            addOnNote,
            getCurrentSqliteTimestamp()
          );
          if (Number(addOnPriceInr || 0) > 0) {
            paymentBookingId = Number(addOnResult.lastInsertRowid);
          } else {
            db.prepare(
              `UPDATE bookings
               SET payment_status = 'paid',
                   paid_at = datetime('now'),
                   paid_amount_paise = 0,
                   status = 'booked'
               WHERE id = ?`
            ).run(Number(addOnResult.lastInsertRowid));
          }
        }
      } else if (existingAddOnBooking) {
        if (String(existingAddOnBooking.paymentStatus || '').toLowerCase() === 'paid') {
          throw new Error('Paid add-on cannot be removed from this package.');
        }
        db.prepare('DELETE FROM bookings WHERE id = ?').run(existingAddOnBooking.id);
      }
    });

    txn();

    const bookings = db
      .prepare(
        `SELECT id,
                service_name AS serviceName,
                booking_date AS bookingDate,
                booking_time AS bookingTime,
                status,
                payment_status AS paymentStatus,
                booking_group_id AS bookingGroupId
         FROM bookings
         WHERE booking_group_id = ?
         ORDER BY booking_date, booking_time, id`
      )
      .all(bookingGroupId);

    return res.json({
      message: 'Hydrogen package updated successfully.',
      summary: {
        serviceName: service.name,
        packageSessions,
        extraSessions,
        totalSessions,
        packagePriceInr,
        extraSessionPriceInr,
        totalAmountInr: payableAmountInr,
        calculatedTotalAmountInr,
        requiresPayment: payableAmountInr > 0,
        addOn: addOnSummary,
      },
      requiresPayment: payableAmountInr > 0,
      paymentBookingId,
      bookings,
    });
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to update hydrogen package' });
  }
});

app.post('/api/hydrogen/verify', requireAuth, async (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'only users can verify hydrogen payment' });
  }
  if (!razorpay || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const razorpayOrderId = String(req.body?.razorpay_order_id || '');
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
  const razorpaySignature = String(req.body?.razorpay_signature || '');
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment verification payload' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  const paymentMethod = await getRazorpayPaymentMethod(razorpayPaymentId);

  const bookings = db
    .prepare(
      `SELECT id
       FROM bookings
       WHERE user_id = ?
         AND payment_order_id = ?`
    )
    .all(req.user.id, razorpayOrderId);
  if (!bookings.length) {
    return res.status(404).json({ message: 'Hydrogen order bookings not found' });
  }

  db.prepare(
    `UPDATE bookings
     SET payment_status = 'paid',
         paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
         payment_reference = CASE
           WHEN LOWER(COALESCE(payment_reference, '')) IN ('membership', 'buy_extra') THEN payment_reference
           ELSE ?
         END,
         is_topup_session = CASE
           WHEN LOWER(COALESCE(payment_reference, '')) = 'buy_extra' THEN 1
           ELSE COALESCE(is_topup_session, 0)
         END,
         payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
         status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
     WHERE user_id = ?
       AND payment_order_id = ?`
  ).run(razorpayPaymentId, paymentMethod, paymentMethod, req.user.id, razorpayOrderId);

  return res.json({ paid: true, bookingCount: bookings.length });
});

app.put('/api/bookings/:id', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const existing = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              status,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              reschedule_count AS rescheduleCount,
              notes,
              created_at AS createdAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);

  if (!existing) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, existing.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'user') {
    return res.status(403).json({ message: 'forbidden' });
  }

  const existingStatus = String(existing.status || '').trim().toLowerCase();
  if (req.user.role !== 'admin' && ['completed', 'cancelled'].includes(existingStatus)) {
    return res.status(409).json({ message: 'completed/cancelled booking cannot be edited by user' });
  }

  const bookingOwner =
    req.user.role === 'admin'
      ? db
          .prepare(
            `SELECT membership_status AS membershipStatus, membership_expires_at AS membershipExpiresAt
             FROM users
             WHERE id = ?`
          )
          .get(existing.userId)
      : req.user;

  const payload = validateBookingPayload(req.body, bookingOwner || req.user, { excludeExperienceBookingIds: [bookingId] });
  if (payload.error) return res.status(400).json({ message: payload.error });

  const isUser = req.user.role === 'user';
  const isScheduleLaterBooking = existingStatus === 'schedule_later';
  const isRescheduleAttempt =
    isUser &&
    (String(payload.data.bookingDate || '').trim() !== String(existing.bookingDate || '').trim() ||
      String(payload.data.bookingTime || '').trim() !== String(existing.bookingTime || '').trim());
  if (isRescheduleAttempt && !isScheduleLaterBooking) {
    if (Number(existing.rescheduleCount || 0) >= 1) {
      return res.status(409).json({
        message: 'You can reschedule only once. Please contact admin for further reschedule changes.',
      });
    }
    const normalizedExistingTime = normalizeSlotStartTime(String(existing.bookingTime || '').trim()) || String(existing.bookingTime || '').trim();
    const slotStart = new Date(`${String(existing.bookingDate || '').trim()}T${normalizedExistingTime}:00`).getTime();
    if (!Number.isFinite(slotStart)) {
      return res.status(409).json({ message: 'Current booking slot is invalid for reschedule.' });
    }
    const rescheduleCutoffMs = 12 * 60 * 60 * 1000;
    if (Date.now() > slotStart - rescheduleCutoffMs) {
      return res.status(409).json({
        message: 'Reschedule is allowed only up to 12 hours before slot start time. Please contact admin.',
      });
    }
  }

  if (existing.bookingGroupId && payload.data.serviceName !== existing.serviceName) {
    return res.status(400).json({ message: 'Grouped hydrogen bookings can only update date, time, and notes.' });
  }

  const selectedService = getServiceByName(payload.data.serviceName);
  const selectedCategory = String(selectedService?.category || '').toUpperCase();
  const selectedAddOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const requestedAddOnBookingDate = String(req.body?.addOnBookingDate || '').trim();
  const requestedAddOnBookingTime = normalizeSlotStartTime(String(req.body?.addOnBookingTime || '').trim());
  const effectiveAddOnBookingDate = requestedAddOnBookingDate || String(payload.data.bookingDate || '').trim();
  const effectiveAddOnBookingTime = requestedAddOnBookingTime || String(payload.data.bookingTime || '').trim();
  let addOnService = null;
  let existingAddOnBooking = null;
  let nextBookingGroupId = String(existing.bookingGroupId || '').trim();
  let addOnPaymentBookingId = null;
  let addOnAmountInr = 0;

  if (selectedAddOnServiceName) {
    if (req.user.role !== 'user') {
      return res.status(403).json({ message: 'only users can add an add-on while rescheduling' });
    }
    addOnService = getServiceByName(selectedAddOnServiceName);
    const addOnCategory = String(addOnService?.category || '').toUpperCase();
    const isHydrogenAddOn = addOnCategory === 'HYDROGEN SESSION';
    const isIvAddOn = isAddOnService(addOnService);
    const validAddOn =
      (selectedCategory === 'HYDROGEN SESSION' && isIvAddOn) ||
      ((selectedCategory === 'IV THERAPIES' || selectedCategory === 'IV SHOTS') && isHydrogenAddOn);
    if (!addOnService || !validAddOn) {
      return res.status(400).json({
        message:
          selectedCategory === 'HYDROGEN SESSION'
            ? 'Invalid add-on selected. Choose one IV Therapy or IV Shot.'
            : 'Invalid add-on selected. Choose a Hydrogen Session.',
      });
    }
    const addOnSlotPayloadValidation = validateBookingPayload(
      {
        serviceName: addOnService.name,
        bookingDate: effectiveAddOnBookingDate,
        bookingTime: effectiveAddOnBookingTime,
      },
      bookingOwner || req.user
    );
    if (addOnSlotPayloadValidation.error) {
      return res.status(400).json({ message: `Invalid add-on schedule: ${addOnSlotPayloadValidation.error}` });
    }
    addOnAmountInr = Number(getEffectiveServicePriceInr(addOnService, bookingOwner || req.user) || 0);
    if (isHydrogenAddOn && !nextBookingGroupId) {
      const dailyLimitConflict = validateHydrogenDailySessionLimit(
        existing.userId,
        [{ bookingDate: effectiveAddOnBookingDate, bookingTime: effectiveAddOnBookingTime }],
        [bookingId]
      );
      if (dailyLimitConflict) {
        return res.status(409).json({
          message: `Only ${dailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
        });
      }
    }
    if (nextBookingGroupId) {
      if (isHydrogenAddOn) {
        existingAddOnBooking = db
          .prepare(
            `SELECT id,
                    service_name AS serviceName,
                    booking_date AS bookingDate,
                    booking_time AS bookingTime,
                    status,
                    payment_status AS paymentStatus,
                    notes
             FROM bookings
             WHERE booking_group_id = ?
               AND status <> 'cancelled'
               AND service_name IN (${SERVICE_CATALOG.filter((item) => isHydrogenSessionService(item))
                 .map(() => '?')
                 .join(', ')})
             ORDER BY id
             LIMIT 1`
          )
          .get(
            nextBookingGroupId,
            ...SERVICE_CATALOG.filter((item) => isHydrogenSessionService(item)).map((item) => item.name)
          );
      } else {
        existingAddOnBooking = db
          .prepare(
            `SELECT id,
                    service_name AS serviceName,
                    booking_date AS bookingDate,
                    booking_time AS bookingTime,
                    status,
                    payment_status AS paymentStatus,
                    notes
             FROM bookings
             WHERE booking_group_id = ?
               AND status <> 'cancelled'
               AND service_name IN (${getAddOnServiceNames().map(() => '?').join(', ')})
             ORDER BY id
             LIMIT 1`
          )
          .get(nextBookingGroupId, ...getAddOnServiceNames());
      }
    }
  }
  if (
    req.user.role !== 'admin' &&
    selectedService &&
    isAddOnService(selectedService) &&
    hasConflictingAddOnBooking(req.user.id, payload.data.bookingDate, payload.data.bookingTime, bookingId)
  ) {
    return res.status(409).json({
      message:
        'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.',
    });
  }
  if (
    req.user.role !== 'admin' &&
    selectedService &&
    isAddOnService(selectedService) &&
    !existing.bookingGroupId &&
    hasHydrogenPackageAddOnOnDate(req.user.id, payload.data.bookingDate, [bookingId])
  ) {
    return res.status(409).json({
      message:
        'A hydrogen package on this date already includes an IV add-on. Separate IV Therapy/IV Shot bookings are not allowed on the same day.',
    });
  }
  if (selectedService && String(selectedService.category || '').toUpperCase() === 'HYDROGEN SESSION') {
    const dailyLimitConflict = validateHydrogenDailySessionLimit(existing.userId, [
      { bookingDate: payload.data.bookingDate, bookingTime: payload.data.bookingTime },
    ], [bookingId]);
    if (dailyLimitConflict) {
      return res.status(409).json({
        message: `Only ${dailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
      });
    }
  }
  if (req.user.role !== 'admin' && selectedService && isAddOnService(selectedService)) {
    const cooldownConflict = findIvCooldownConflict(existing.userId, payload.data.serviceName, payload.data.bookingDate, [bookingId]);
    if (cooldownConflict) {
      return res.status(409).json({
        message: getIvCooldownResponseMessage(cooldownConflict),
      });
    }
  }
  if (addOnService) {
    const excludeAddOnBookingId = existingAddOnBooking?.id ? Number(existingAddOnBooking.id) : null;
    const excludeIds = [bookingId, excludeAddOnBookingId].filter((id) => Number.isInteger(Number(id)));
    const addOnCategory = String(addOnService.category || '').toUpperCase();
    const isHydrogenAddOn = addOnCategory === 'HYDROGEN SESSION';
    if (isHydrogenAddOn) {
      const addOnDailyLimitConflict = validateHydrogenDailySessionLimit(existing.userId, [
        { bookingDate: effectiveAddOnBookingDate, bookingTime: effectiveAddOnBookingTime },
      ], excludeIds);
      if (addOnDailyLimitConflict) {
        return res.status(409).json({
          message: `Only ${addOnDailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
        });
      }
    } else {
      if (hasStandaloneIvBookingOnDate(existing.userId, effectiveAddOnBookingDate, excludeIds)) {
        return res.status(409).json({
          message:
            'A separate IV Therapy/IV Shot is already booked on this date. Hydrogen packages with an IV add-on cannot be combined with separate IV bookings on the same day.',
        });
      }
      if (hasConflictingAddOnBooking(existing.userId, effectiveAddOnBookingDate, effectiveAddOnBookingTime, excludeAddOnBookingId)) {
        return res.status(409).json({
          message:
            'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.',
        });
      }
      const cooldownConflict = findIvCooldownConflict(existing.userId, addOnService.name, effectiveAddOnBookingDate, excludeIds);
      if (cooldownConflict) {
        return res.status(409).json({
          message: getIvCooldownResponseMessage(cooldownConflict),
        });
      }
    }
    const addOnSlotStatus = getSlotCapacityStatus(
      addOnService.name,
      effectiveAddOnBookingDate,
      effectiveAddOnBookingTime,
      excludeAddOnBookingId
    );
    if (addOnSlotStatus.reached) {
      const message = addOnSlotStatus.holdTotal > 0
        ? buildHoldSlotMessage()
        : `This add-on slot is full. Maximum ${addOnSlotStatus.maxPerSlot} bookings are allowed.`;
      return res.status(409).json({ message });
    }
  }

  const slotStatus = getSlotCapacityStatus(
    payload.data.serviceName,
    payload.data.bookingDate,
    payload.data.bookingTime,
    bookingId
  );
  if (slotStatus.reached) {
    const message = slotStatus.holdTotal > 0
      ? buildHoldSlotMessage()
      : `This slot is full. Maximum ${slotStatus.maxPerSlot} bookings are allowed.`;
    return res.status(409).json({ message });
  }

  const nextStatus = req.user.role === 'admin'
    ? normalizeBookingStatus(req.body?.status || existing.status)
    : isScheduleLaterBooking && isRescheduleAttempt
      ? 'booked'
      : String(existing.status || 'pending');

  if (!isValidStatus(nextStatus)) {
    return res.status(400).json({
      message: `invalid status: ${String(req.body?.status ?? nextStatus ?? '').trim() || '(empty)'}`,
      allowedStatuses: BOOKING_STATUSES,
    });
  }

  let nextNotes = String(payload.data.notes || '').trim();
  if (isRescheduleAttempt) {
    const userRescheduleNote = isScheduleLaterBooking
      ? `Scheduled later by user from ${existing.bookingDate} ${existing.bookingTime} to ${payload.data.bookingDate} ${payload.data.bookingTime}`
      : `Rescheduled by user from ${existing.bookingDate} ${existing.bookingTime} to ${payload.data.bookingDate} ${payload.data.bookingTime}`;
    nextNotes = [nextNotes, userRescheduleNote].filter(Boolean).join('\n');
  }
  const shouldIncrementRescheduleCount = isRescheduleAttempt && !isScheduleLaterBooking;

  const txn = db.transaction(() => {
    if (addOnService && !nextBookingGroupId) {
      nextBookingGroupId = createBookingGroupId('booking');
    }

    db.prepare(
      `UPDATE bookings SET
        doctor_id = NULL,
        booking_group_id = CASE WHEN ? <> '' THEN ? ELSE booking_group_id END,
        service_name = ?,
        booking_date = ?,
        booking_time = ?,
        assigned_staff = 'H2 House Of Health',
        notes = ?,
        reschedule_count = CASE WHEN ? = 1 THEN COALESCE(reschedule_count, 0) + 1 ELSE COALESCE(reschedule_count, 0) END,
        payment_status = CASE WHEN ? = 1 THEN 'paid' ELSE payment_status END,
        status = ?
      WHERE id = ?`
    ).run(
      nextBookingGroupId,
      nextBookingGroupId,
      payload.data.serviceName,
      payload.data.bookingDate,
      payload.data.bookingTime,
      nextNotes,
      shouldIncrementRescheduleCount ? 1 : 0,
      selectedService?.membershipOnly ? 1 : 0,
      nextStatus,
      bookingId
    );

    if (addOnService) {
      const addOnNote =
        String(addOnService.category || '').toUpperCase() === 'HYDROGEN SESSION'
          ? `Hydrogen add-on for ${payload.data.serviceName} (rescheduled session)`
          : `IV add-on for ${payload.data.serviceName} (rescheduled session)`;
      if (existingAddOnBooking) {
        if (
          String(existingAddOnBooking.paymentStatus || '').trim().toLowerCase() === 'paid' &&
          String(existingAddOnBooking.serviceName || '') !== addOnService.name
        ) {
          throw new Error('Paid add-on cannot be changed while rescheduling.');
        }
        db.prepare(
          `UPDATE bookings SET
             service_name = ?,
             booking_date = ?,
             booking_time = ?,
             assigned_staff = 'H2 House Of Health',
             notes = ?,
             payment_status = CASE WHEN payment_status = 'paid' THEN 'paid' ELSE 'unpaid' END,
             payment_order_id = CASE WHEN payment_status = 'paid' THEN payment_order_id ELSE NULL END,
             payment_reference = CASE WHEN payment_status = 'paid' THEN payment_reference ELSE NULL END,
             paid_at = CASE WHEN payment_status = 'paid' THEN paid_at ELSE NULL END,
             paid_amount_paise = CASE WHEN payment_status = 'paid' THEN paid_amount_paise ELSE NULL END,
             status = CASE WHEN status = 'booked' THEN 'booked' ELSE 'pending' END
           WHERE id = ?`
        ).run(
          addOnService.name,
          effectiveAddOnBookingDate,
          effectiveAddOnBookingTime,
          [addOnNote, String(existingAddOnBooking.notes || '').trim()].filter(Boolean).join('\n'),
          existingAddOnBooking.id
        );
        if (String(existingAddOnBooking.paymentStatus || '').trim().toLowerCase() !== 'paid') {
          if (addOnAmountInr > 0) {
            addOnPaymentBookingId = Number(existingAddOnBooking.id);
          } else {
            db.prepare(
              `UPDATE bookings
               SET payment_status = 'paid',
                   paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
                   paid_amount_paise = 0,
                   status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
               WHERE id = ?`
            ).run(existingAddOnBooking.id);
          }
        }
      } else {
        const result = db.prepare(
          `INSERT INTO bookings (
            user_id, doctor_id, client_name, client_email, client_phone,
            service_name, booking_date, booking_time, assigned_staff, status, payment_status, booking_group_id, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
        ).run(
          existing.userId,
          null,
          req.user.name,
          req.user.email,
          req.user.mobile || '-',
          addOnService.name,
          effectiveAddOnBookingDate,
          effectiveAddOnBookingTime,
          'H2 House Of Health',
          addOnAmountInr > 0 ? 'unpaid' : 'paid',
          nextBookingGroupId,
          addOnNote,
          getCurrentSqliteTimestamp()
        );
        if (addOnAmountInr > 0) {
          addOnPaymentBookingId = Number(result.lastInsertRowid);
        } else {
          db.prepare(
            `UPDATE bookings
             SET paid_at = datetime('now'),
                 paid_amount_paise = 0,
                 status = 'booked'
             WHERE id = ?`
          ).run(Number(result.lastInsertRowid));
        }
      }
    }
  });

  try {
    txn();
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to update booking.' });
  }

  const booking = db
    .prepare(
      `SELECT b.id,
              b.user_id AS userId,
              b.booking_group_id AS bookingGroupId,
              u.name AS clientName,
              u.email AS clientEmail,
              u.mobile AS clientMobile,
              b.service_name AS serviceName,
              b.booking_date AS bookingDate,
              b.booking_time AS bookingTime,
              b.status,
              b.payment_status AS paymentStatus,
              b.paid_at AS paidAt,
              b.reschedule_count AS rescheduleCount,
              b.notes,
              b.created_at AS createdAt
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .get(bookingId);

  res.json({
    booking,
    requiresPayment: Boolean(addOnPaymentBookingId && addOnAmountInr > 0),
    paymentBookingId: addOnPaymentBookingId,
    summary: addOnService
      ? {
          addOn: {
            serviceName: addOnService.name,
            bookingDate: effectiveAddOnBookingDate,
            bookingTime: effectiveAddOnBookingTime,
            amountInr: addOnAmountInr,
          },
          totalAmountInr: addOnPaymentBookingId ? addOnAmountInr : 0,
        }
      : null,
  });
});

app.get('/api/payments/config', requireAuth, (_req, res) => {
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  return res.json({ keyId: RAZORPAY_KEY_ID, currency: 'INR' });
});

app.get('/api/bookings/:id/payment-link', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      'SELECT id, user_id AS userId, status, payment_status AS paymentStatus, service_name AS serviceName, created_at AS createdAt FROM bookings WHERE id = ?'
    )
    .get(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }
 
  const service = getServiceByName(booking.serviceName);
  if (!service || service.membershipOnly || String(booking.paymentStatus || '').trim().toLowerCase() === 'paid') {
    return res.status(409).json({ message: 'payment link is not required for this booking' });
  }
  if (isHoldExpiredBooking(booking)) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  return res.json({
    paymentLinkUrl: buildBookingPaymentLink(req, booking.id, booking.userId),
  });
});

app.get('/api/bookings/:id/payment-link-events', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              payment_status AS paymentStatus,
              paid_at AS paidAt,
              payment_link_emailed_at AS paymentLinkEmailedAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const range = buildDateRangeFilter({
    startDate: req.query?.startDate,
    endDate: req.query?.endDate,
    sqlColumn: 'event_at',
  });
  if (range.error) {
    return res.status(400).json({ message: range.error });
  }

  const events = db
    .prepare(
      `SELECT id,
              event_name AS eventName,
              recipient_email AS recipientEmail,
              message_id AS messageId,
              sg_event_id AS sgEventId,
              detail,
              event_at AS eventAt
       FROM booking_email_events
       WHERE booking_id = ?
         ${range.where ? `AND ${range.where.replace(/^WHERE\s+/i, '')}` : ''}
       ORDER BY datetime(event_at) ASC, id ASC`
    )
    .all(bookingId, ...range.params);

  const paidAtMs = booking.paidAt ? Date.parse(`${String(booking.paidAt).replace(' ', 'T')}Z`) : NaN;
  let firstDeliveredAt = '';
  let firstOpenedAt = '';
  let firstClickedAt = '';
  let firstBouncedAt = '';
  let firstDeferredAt = '';
  let firstSpamReportedAt = '';
  for (const event of events) {
    const eventName = normalizePaymentLinkEventName(event?.eventName);
    const eventAt = String(event?.eventAt || '');
    if (eventName === 'delivered' && !firstDeliveredAt) firstDeliveredAt = eventAt;
    if (eventName === 'open' && !firstOpenedAt) firstOpenedAt = eventAt;
    if (eventName === 'click' && !firstClickedAt) firstClickedAt = eventAt;
    if (eventName === 'bounce' && !firstBouncedAt) firstBouncedAt = eventAt;
    if (eventName === 'deferred' && !firstDeferredAt) firstDeferredAt = eventAt;
    if (eventName === 'spamreport' && !firstSpamReportedAt) firstSpamReportedAt = eventAt;
  }

  const toMs = (value) => {
    if (!value) return NaN;
    const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
    return Date.parse(normalized);
  };
  const conversionAfter = (value) => {
    const eventMs = toMs(value);
    if (!Number.isFinite(paidAtMs) || !Number.isFinite(eventMs) || paidAtMs < eventMs) return null;
    return Math.max(0, Math.round((paidAtMs - eventMs) / 1000));
  };

  return res.json({
    events,
    analytics: {
      bookingId,
      startDate: range.from || null,
      endDate: range.to || null,
      paid: String(booking.paymentStatus || '').toLowerCase() === 'paid',
      paidAt: booking.paidAt || null,
      requestedAt: booking.paymentLinkEmailedAt || null,
      firstDeliveredAt: firstDeliveredAt || null,
      firstOpenedAt: firstOpenedAt || null,
      firstClickedAt: firstClickedAt || null,
      firstBouncedAt: firstBouncedAt || null,
      firstDeferredAt: firstDeferredAt || null,
      firstSpamReportedAt: firstSpamReportedAt || null,
      conversionAfterDeliveredSeconds: conversionAfter(firstDeliveredAt),
      conversionAfterOpenedSeconds: conversionAfter(firstOpenedAt),
      conversionAfterClickedSeconds: conversionAfter(firstClickedAt),
    },
  });
});

app.get('/api/admin/analytics/payment-link-conversion', requireAuth, requireAdmin, (_req, res) => {
  const range = buildDateRangeFilter({
    startDate: _req.query?.startDate,
    endDate: _req.query?.endDate,
    sqlColumn: 'payment_link_emailed_at',
  });
  if (range.error) {
    return res.status(400).json({ message: range.error });
  }

  const rows = db
    .prepare(
      `SELECT id,
              payment_link_emailed_at AS emailedAt,
              payment_status AS paymentStatus,
              paid_at AS paidAt
       FROM bookings
       WHERE payment_link_emailed_at IS NOT NULL
         ${range.where ? `AND ${range.where.replace(/^WHERE\s+/i, '')}` : ''}`
    )
    .all(...range.params);

  const eventsByBooking = db
    .prepare(
      `SELECT booking_id AS bookingId, event_name AS eventName
       FROM booking_email_events`
    )
    .all();

  const bucket = new Map();
  for (const row of rows) {
    bucket.set(Number(row.id), {
      paid: String(row.paymentStatus || '').toLowerCase() === 'paid' && Boolean(row.paidAt),
      delivered: false,
      opened: false,
      clicked: false,
      bounced: false,
      deferred: false,
      spamreport: false,
    });
  }
  for (const event of eventsByBooking) {
    const bookingId = Number(event.bookingId);
    const item = bucket.get(bookingId);
    if (!item) continue;
    const eventName = normalizePaymentLinkEventName(event.eventName);
    if (eventName in item) item[eventName] = true;
  }

  const totals = {
    startDate: range.from || null,
    endDate: range.to || null,
    emailedBookings: bucket.size,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    deferred: 0,
    spamreport: 0,
    convertedPaid: 0,
    convertedAfterDelivered: 0,
    convertedAfterOpened: 0,
    convertedAfterClicked: 0,
  };
  const exportRows = [];
  for (const entry of bucket.values()) {
    if (entry.delivered) totals.delivered += 1;
    if (entry.opened) totals.opened += 1;
    if (entry.clicked) totals.clicked += 1;
    if (entry.bounced) totals.bounced += 1;
    if (entry.deferred) totals.deferred += 1;
    if (entry.spamreport) totals.spamreport += 1;
    if (entry.paid) totals.convertedPaid += 1;
    if (entry.paid && entry.delivered) totals.convertedAfterDelivered += 1;
    if (entry.paid && entry.opened) totals.convertedAfterOpened += 1;
    if (entry.paid && entry.clicked) totals.convertedAfterClicked += 1;
  }

  for (const row of rows) {
    const bookingId = Number(row.id);
    const event = bucket.get(bookingId) || {};
    exportRows.push({
      bookingId,
      emailedAt: row.emailedAt || '',
      paidAt: row.paidAt || '',
      paid: Boolean(event.paid),
      delivered: Boolean(event.delivered),
      opened: Boolean(event.opened),
      clicked: Boolean(event.clicked),
      bounced: Boolean(event.bounced),
      deferred: Boolean(event.deferred),
      spamreport: Boolean(event.spamreport),
    });
  }

  return res.json({ analytics: totals, rows: exportRows });
});

app.post('/api/bookings/:id/send-payment-link-email', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT b.id,
              b.user_id AS userId,
              b.client_name AS clientName,
              b.client_email AS clientEmail,
              u.email AS userEmail,
              b.service_name AS serviceName,
              b.booking_date AS bookingDate,
              b.booking_time AS bookingTime,
              b.status,
              b.payment_status AS paymentStatus,
              b.created_at AS createdAt
       FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const service = getServiceByName(booking.serviceName);
  if (!service || service.membershipOnly || booking.paymentStatus === 'paid') {
    return res.status(409).json({ message: 'payment link is not required for this booking' });
  }
  if (booking.status === 'cancelled') {
    return res.status(409).json({ message: 'cannot send payment link for a cancelled booking' });
  }
  if (isHoldExpiredBooking(booking)) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  const recipientEmail = String(req.body?.email || booking.clientEmail || booking.userEmail || '')
    .trim()
    .toLowerCase();
  if (!isValidEmail(recipientEmail)) {
    return res.status(400).json({ message: 'valid recipient email is required' });
  }
  console.log('Payment link email recipient resolved:', {
    bookingId,
    requestedEmail: String(req.body?.email || '').trim().toLowerCase(),
    bookingClientEmail: String(booking.clientEmail || '').trim().toLowerCase(),
    userEmail: String(booking.userEmail || '').trim().toLowerCase(),
    selectedRecipient: recipientEmail,
  });

  const paymentLinkUrl = buildBookingPaymentLink(req, booking.id, booking.userId);
  const markEmailDelivery = db.prepare(
    `UPDATE bookings
     SET payment_link_recipient_email = ?,
         payment_link_emailed_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE payment_link_emailed_at END,
         payment_link_email_status = ?,
         payment_link_email_error = ?
     WHERE id = ?`
  );
  const insertBookingEmailEvent = db.prepare(
    `INSERT INTO booking_email_events (
      booking_id, event_name, recipient_email, message_id, sg_event_id, dedupe_key, detail, event_at, raw_payload, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  const emailResult = await sendBookingPaymentLinkEmail({
    toEmail: recipientEmail,
    recipientName: booking.clientName || '',
    serviceName: booking.serviceName || '',
    bookingDate: booking.bookingDate || '',
    bookingTime: booking.bookingTime || '',
    paymentLinkUrl,
    bookingId,
    userId: booking.userId,
  });

  if (!emailResult.ok) {
    markEmailDelivery.run(
      recipientEmail,
      'failed',
      'failed',
      String(emailResult.message || 'Unable to send payment link email.').slice(0, 500),
      bookingId
    );
    const eventAt = new Date().toISOString();
    const messageId = String(emailResult.messageId || '');
    const detail = String(emailResult.message || 'Unable to send payment link email.').slice(0, 1000);
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName: 'request_failed',
      recipient: recipientEmail,
      messageId,
      sgEventId: '',
      eventAt,
      detail,
    });
    insertBookingEmailEvent.run(bookingId, 'request_failed', recipientEmail, messageId, '', dedupeKey, detail, eventAt, null);
    return res.status(emailResult.statusCode || 500).json({ message: emailResult.message || 'Unable to send payment link email.' });
  }

  if (Number(emailResult.statusCode || 0) !== 202) {
    const detail = `Email provider did not confirm 202 acceptance (status: ${Number(emailResult.statusCode || 0) || 'unknown'}).`;
    markEmailDelivery.run(recipientEmail, 'failed', 'failed', detail, bookingId);
    const eventAt = new Date().toISOString();
    const messageId = String(emailResult.messageId || '');
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName: 'request_failed',
      recipient: recipientEmail,
      messageId,
      sgEventId: '',
      eventAt,
      detail,
    });
    insertBookingEmailEvent.run(bookingId, 'request_failed', recipientEmail, messageId, '', dedupeKey, detail, eventAt, null);
    return res.status(502).json({ message: detail });
  }

  markEmailDelivery.run(recipientEmail, 'sent', 'sent', null, bookingId);
  const acceptedAt = new Date().toISOString();
  const acceptedMessageId = String(emailResult.messageId || '');
  const acceptedDetail = 'Send request accepted by email provider (202).';
  const acceptedDedupeKey = buildPaymentLinkEventDedupeKey({
    bookingId,
    eventName: 'request_accepted',
    recipient: recipientEmail,
    messageId: acceptedMessageId,
    sgEventId: '',
    eventAt: acceptedAt,
    detail: acceptedDetail,
  });
  insertBookingEmailEvent.run(
    bookingId,
    'request_accepted',
    recipientEmail,
    acceptedMessageId,
    '',
    acceptedDedupeKey,
    acceptedDetail,
    acceptedAt,
    null
  );

  return res.status(202).json({
    sent: true,
    paymentLinkUrl,
    messageId: String(emailResult.messageId || ''),
    message:
      emailResult.delivery === 'console'
        ? `Payment link generated for ${recipientEmail}. Email service is not configured, so the link was logged on server.`
        : `Email request accepted for ${recipientEmail}.`,
  });
});

app.post('/api/webhooks/sendgrid', async (req, res) => {
  const verification = await verifySendGridWebhookSignature(req);
  if (!verification.ok) {
    return res.status(verification.statusCode || 401).json({ message: verification.message || 'Unauthorized webhook signature.' });
  }

  const events = Array.isArray(req.body) ? req.body : [];
  if (!events.length) {
    return res.status(400).json({ message: 'No SendGrid events provided.' });
  }

  const updateDelivery = db.prepare(
    `UPDATE bookings
     SET payment_link_recipient_email = CASE WHEN ? <> '' THEN ? ELSE payment_link_recipient_email END,
         payment_link_delivery_status = ?,
         payment_link_delivery_detail = ?,
         payment_link_email_event = ?,
         payment_link_email_event_at = ?,
         payment_link_email_status = CASE
           WHEN ? IN ('bounce', 'dropped', 'spamreport') THEN 'failed'
           WHEN ? IN ('delivered', 'open', 'click') THEN 'sent'
           ELSE payment_link_email_status
         END,
         payment_link_email_error = CASE
           WHEN ? IN ('bounce', 'dropped', 'spamreport') THEN COALESCE(?, payment_link_email_error)
           ELSE payment_link_email_error
         END
     WHERE id = ?`
  );
  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO booking_email_events (
      booking_id, event_name, recipient_email, message_id, sg_event_id, dedupe_key, detail, event_at, raw_payload, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  let updated = 0;
  let stored = 0;
  for (const event of events) {
    const customArgs = event?.custom_args || event?.unique_args || {};
    if (String(customArgs?.context || '').trim() !== 'booking_payment_link') continue;

    const bookingId = Number(customArgs?.bookingId);
    if (!Number.isInteger(bookingId)) continue;

    const eventName = normalizePaymentLinkEventName(event?.event);
    if (!eventName) continue;

    const recipient = String(event?.email || '').trim().toLowerCase();
    const messageId = String(event?.sg_message_id || event?.smtp-id || '').trim();
    const sgEventId = String(event?.sg_event_id || '').trim();
    const eventAt = Number.isFinite(Number(event?.timestamp))
      ? new Date(Number(event.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const detailParts = [
      String(event?.reason || '').trim(),
      String(event?.response || '').trim(),
      String(event?.status || '').trim(),
      String(event?.url || '').trim(),
    ].filter(Boolean);
    const detail = detailParts.join(' | ').slice(0, 500) || null;
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName,
      recipient,
      messageId,
      sgEventId,
      eventAt,
      detail,
    });

    const insertResult = insertEvent.run(
      bookingId,
      eventName,
      recipient,
      messageId,
      sgEventId,
      dedupeKey,
      detail,
      eventAt,
      JSON.stringify(event)
    );
    if (Number(insertResult?.changes || 0) > 0) stored += Number(insertResult.changes || 0);

    if (!TRACKED_PAYMENT_LINK_EVENTS.has(eventName)) {
      continue;
    }

    const result = updateDelivery.run(
      recipient,
      recipient,
      eventName,
      detail,
      eventName,
      eventAt,
      eventName,
      eventName,
      eventName,
      detail,
      bookingId
    );
    if (Number(result?.changes || 0) > 0) updated += Number(result.changes || 0);

    if (eventName === 'delivered' || eventName === 'deferred' || eventName === 'bounce') {
      console.log('Payment link delivery webhook event:', {
        bookingId,
        event: eventName,
        recipient,
        messageId,
        detail: detail || '',
        eventAt,
      });
    }
  }

  return res.json({ ok: true, processed: events.length, updated, stored });
});

// Backward-compatible endpoint used by older cached frontend builds.
// We do not have an SMS gateway wired yet, so this returns the link with a clear message
// instead of failing the request.
app.post('/api/bookings/:id/send-payment-link-sms', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id, user_id AS userId, service_name AS serviceName, status, payment_status AS paymentStatus, created_at AS createdAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const service = getServiceByName(booking.serviceName);
  if (!service || service.membershipOnly || booking.paymentStatus === 'paid') {
    return res.status(409).json({ message: 'payment link is not required for this booking' });
  }
  if (booking.status === 'cancelled') {
    return res.status(409).json({ message: 'cannot send payment link for a cancelled booking' });
  }
  if (isHoldExpiredBooking(booking)) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  if (!phoneNumber) {
    return res.status(400).json({ message: 'phoneNumber is required' });
  }

  const paymentLinkUrl = buildBookingPaymentLink(req, booking.id, booking.userId);
  return res.json({
    sent: false,
    paymentLinkUrl,
    message: 'SMS gateway is not configured yet. Share the copied payment link with the customer, or use email delivery.',
  });
});

app.get('/api/bookings/:id/invoice-link', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              payment_reference AS paymentReference,
              paid_amount_paise AS paidAmountPaise
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }
  const normalizedPaymentStatus = String(booking.paymentStatus || '').trim().toLowerCase();
  if (normalizedPaymentStatus !== 'paid') {
    return res
      .status(409)
      .json({ message: `invoice is available only for paid bookings (paymentStatus=${booking.paymentStatus ?? ''})` });
  }

  const bookingOwner = getUserById(booking.userId);
  const pricingUser = {
    membershipStatus: bookingOwner?.membershipStatus || 'inactive',
    membershipStartedAt: bookingOwner?.membershipStartedAt || null,
    membershipExpiresAt: bookingOwner?.membershipExpiresAt || null,
    mobile: bookingOwner?.mobile || '',
  };
  const groupBookings = booking.bookingGroupId
    ? db
        .prepare(
          `SELECT id,
                  user_id AS userId,
                  booking_group_id AS bookingGroupId,
                  service_name AS serviceName,
                  booking_date AS bookingDate,
                  booking_time AS bookingTime,
                  status,
                  payment_status AS paymentStatus,
                  payment_reference AS paymentReference,
                  paid_amount_paise AS paidAmountPaise
           FROM bookings
           WHERE booking_group_id = ?
           ORDER BY booking_date, booking_time, id`
        )
        .all(booking.bookingGroupId)
    : [booking];
  const activeBookings = groupBookings.filter((entry) => String(entry.status || '').toLowerCase() !== 'cancelled');
  let summary = null;
  try {
    summary = buildBookingInvoiceSummary(activeBookings, pricingUser);
  } catch {
    summary = null;
  }
  const amountInr = Number(summary?.totalAmountInr ?? summary?.amountInr ?? 0);
  if (amountInr <= 0) {
    return res.status(409).json({ message: 'invoice is available only for paid bookings with amount greater than 0' });
  }

  const token = createInvoiceAccessToken({
    scope: 'booking_invoice',
    bookingId: booking.id,
    userId: booking.userId,
  });

  const invoiceUrl = `${getRequestOrigin(req)}/invoice/booking?token=${encodeURIComponent(token)}`;
  return res.json({
    invoiceUrl,
    invoiceDownloadUrl: `${invoiceUrl}&format=pdf&download=1`,
  });
});

app.get('/api/bookings/:id/payment-link-events', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              payment_status AS paymentStatus,
              paid_at AS paidAt,
              payment_link_emailed_at AS paymentLinkEmailedAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const range = buildDateRangeFilter({
    startDate: req.query?.startDate,
    endDate: req.query?.endDate,
    sqlColumn: 'event_at',
  });
  if (range.error) {
    return res.status(400).json({ message: range.error });
  }

  const events = db
    .prepare(
      `SELECT id,
              event_name AS eventName,
              recipient_email AS recipientEmail,
              message_id AS messageId,
              sg_event_id AS sgEventId,
              detail,
              event_at AS eventAt
       FROM booking_email_events
       WHERE booking_id = ?
         ${range.where ? `AND ${range.where.replace(/^WHERE\\s+/i, '')}` : ''}
       ORDER BY datetime(event_at) ASC, id ASC`
    )
    .all(bookingId, ...range.params);

  const paidAtMs = booking.paidAt ? Date.parse(`${String(booking.paidAt).replace(' ', 'T')}Z`) : NaN;
  let firstDeliveredAt = '';
  let firstOpenedAt = '';
  let firstClickedAt = '';
  let firstBouncedAt = '';
  let firstDeferredAt = '';
  let firstSpamReportedAt = '';
  for (const event of events) {
    const eventName = normalizePaymentLinkEventName(event?.eventName);
    const eventAt = String(event?.eventAt || '');
    if (eventName === 'delivered' && !firstDeliveredAt) firstDeliveredAt = eventAt;
    if (eventName === 'open' && !firstOpenedAt) firstOpenedAt = eventAt;
    if (eventName === 'click' && !firstClickedAt) firstClickedAt = eventAt;
    if (eventName === 'bounce' && !firstBouncedAt) firstBouncedAt = eventAt;
    if (eventName === 'deferred' && !firstDeferredAt) firstDeferredAt = eventAt;
    if (eventName === 'spamreport' && !firstSpamReportedAt) firstSpamReportedAt = eventAt;
  }

  const toMs = (value) => {
    if (!value) return NaN;
    const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
    return Date.parse(normalized);
  };
  const conversionAfter = (value) => {
    const eventMs = toMs(value);
    if (!Number.isFinite(paidAtMs) || !Number.isFinite(eventMs) || paidAtMs < eventMs) return null;
    return Math.max(0, Math.round((paidAtMs - eventMs) / 1000));
  };

  return res.json({
    events,
    analytics: {
      bookingId,
      startDate: range.from || null,
      endDate: range.to || null,
      paid: String(booking.paymentStatus || '').toLowerCase() === 'paid',
      paidAt: booking.paidAt || null,
      requestedAt: booking.paymentLinkEmailedAt || null,
      firstDeliveredAt: firstDeliveredAt || null,
      firstOpenedAt: firstOpenedAt || null,
      firstClickedAt: firstClickedAt || null,
      firstBouncedAt: firstBouncedAt || null,
      firstDeferredAt: firstDeferredAt || null,
      firstSpamReportedAt: firstSpamReportedAt || null,
      conversionAfterDeliveredSeconds: conversionAfter(firstDeliveredAt),
      conversionAfterOpenedSeconds: conversionAfter(firstOpenedAt),
      conversionAfterClickedSeconds: conversionAfter(firstClickedAt),
    },
  });
});

app.get('/api/admin/analytics/payment-link-conversion', requireAuth, requireAdmin, (_req, res) => {
  const range = buildDateRangeFilter({
    startDate: _req.query?.startDate,
    endDate: _req.query?.endDate,
    sqlColumn: 'payment_link_emailed_at',
  });
  if (range.error) {
    return res.status(400).json({ message: range.error });
  }

  const rows = db
    .prepare(
      `SELECT id,
              payment_link_emailed_at AS emailedAt,
              payment_status AS paymentStatus,
              paid_at AS paidAt
       FROM bookings
       WHERE payment_link_emailed_at IS NOT NULL
         ${range.where ? `AND ${range.where.replace(/^WHERE\s+/i, '')}` : ''}`
    )
    .all(...range.params);

  const eventsByBooking = db
    .prepare(
      `SELECT booking_id AS bookingId, event_name AS eventName
       FROM booking_email_events`
    )
    .all();

  const bucket = new Map();
  for (const row of rows) {
    bucket.set(Number(row.id), {
      paid: String(row.paymentStatus || '').toLowerCase() === 'paid' && Boolean(row.paidAt),
      delivered: false,
      opened: false,
      clicked: false,
      bounced: false,
      deferred: false,
      spamreport: false,
    });
  }
  for (const event of eventsByBooking) {
    const bookingId = Number(event.bookingId);
    const item = bucket.get(bookingId);
    if (!item) continue;
    const eventName = normalizePaymentLinkEventName(event.eventName);
    if (eventName in item) item[eventName] = true;
  }

  const totals = {
    startDate: range.from || null,
    endDate: range.to || null,
    emailedBookings: bucket.size,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    deferred: 0,
    spamreport: 0,
    convertedPaid: 0,
    convertedAfterDelivered: 0,
    convertedAfterOpened: 0,
    convertedAfterClicked: 0,
  };
  const exportRows = [];
  for (const entry of bucket.values()) {
    if (entry.delivered) totals.delivered += 1;
    if (entry.opened) totals.opened += 1;
    if (entry.clicked) totals.clicked += 1;
    if (entry.bounced) totals.bounced += 1;
    if (entry.deferred) totals.deferred += 1;
    if (entry.spamreport) totals.spamreport += 1;
    if (entry.paid) totals.convertedPaid += 1;
    if (entry.paid && entry.delivered) totals.convertedAfterDelivered += 1;
    if (entry.paid && entry.opened) totals.convertedAfterOpened += 1;
    if (entry.paid && entry.clicked) totals.convertedAfterClicked += 1;
  }

  for (const row of rows) {
    const bookingId = Number(row.id);
    const event = bucket.get(bookingId) || {};
    exportRows.push({
      bookingId,
      emailedAt: row.emailedAt || '',
      paidAt: row.paidAt || '',
      paid: Boolean(event.paid),
      delivered: Boolean(event.delivered),
      opened: Boolean(event.opened),
      clicked: Boolean(event.clicked),
      bounced: Boolean(event.bounced),
      deferred: Boolean(event.deferred),
      spamreport: Boolean(event.spamreport),
    });
  }

  return res.json({ analytics: totals, rows: exportRows });
});

app.post('/api/bookings/:id/send-payment-link-email', requireAuth, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT b.id,
              b.user_id AS userId,
              b.client_name AS clientName,
              b.client_email AS clientEmail,
              u.email AS userEmail,
              b.service_name AS serviceName,
              b.booking_date AS bookingDate,
              b.booking_time AS bookingTime,
              b.status,
              b.payment_status AS paymentStatus,
              b.created_at AS createdAt
       FROM bookings b
       LEFT JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const service = getServiceByName(booking.serviceName);
  if (!service || service.membershipOnly || booking.paymentStatus === 'paid') {
    return res.status(409).json({ message: 'payment link is not required for this booking' });
  }
  if (booking.status === 'cancelled') {
    return res.status(409).json({ message: 'cannot send payment link for a cancelled booking' });
  }
  if (isHoldExpiredBooking(booking)) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  const recipientEmail = String(req.body?.email || booking.clientEmail || booking.userEmail || '')
    .trim()
    .toLowerCase();
  if (!isValidEmail(recipientEmail)) {
    return res.status(400).json({ message: 'valid recipient email is required' });
  }
  console.log('Payment link email recipient resolved:', {
    bookingId,
    requestedEmail: String(req.body?.email || '').trim().toLowerCase(),
    bookingClientEmail: String(booking.clientEmail || '').trim().toLowerCase(),
    userEmail: String(booking.userEmail || '').trim().toLowerCase(),
    selectedRecipient: recipientEmail,
  });

  const paymentLinkUrl = buildBookingPaymentLink(req, booking.id, booking.userId);
  const markEmailDelivery = db.prepare(
    `UPDATE bookings
     SET payment_link_recipient_email = ?,
         payment_link_emailed_at = CASE WHEN ? = 'sent' THEN datetime('now') ELSE payment_link_emailed_at END,
         payment_link_email_status = ?,
         payment_link_email_error = ?
     WHERE id = ?`
  );
  const insertBookingEmailEvent = db.prepare(
    `INSERT INTO booking_email_events (
      booking_id, event_name, recipient_email, message_id, sg_event_id, dedupe_key, detail, event_at, raw_payload, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  const emailResult = await sendBookingPaymentLinkEmail({
    toEmail: recipientEmail,
    recipientName: booking.clientName || '',
    serviceName: booking.serviceName || '',
    bookingDate: booking.bookingDate || '',
    bookingTime: booking.bookingTime || '',
    paymentLinkUrl,
    bookingId,
    userId: booking.userId,
  });

  if (!emailResult.ok) {
    markEmailDelivery.run(
      recipientEmail,
      'failed',
      'failed',
      String(emailResult.message || 'Unable to send payment link email.').slice(0, 500),
      bookingId
    );
    const eventAt = new Date().toISOString();
    const messageId = String(emailResult.messageId || '');
    const detail = String(emailResult.message || 'Unable to send payment link email.').slice(0, 1000);
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName: 'request_failed',
      recipient: recipientEmail,
      messageId,
      sgEventId: '',
      eventAt,
      detail,
    });
    insertBookingEmailEvent.run(bookingId, 'request_failed', recipientEmail, messageId, '', dedupeKey, detail, eventAt, null);
    return res.status(emailResult.statusCode || 500).json({ message: emailResult.message || 'Unable to send payment link email.' });
  }

  if (Number(emailResult.statusCode || 0) !== 202) {
    const detail = `Email provider did not confirm 202 acceptance (status: ${Number(emailResult.statusCode || 0) || 'unknown'}).`;
    markEmailDelivery.run(recipientEmail, 'failed', 'failed', detail, bookingId);
    const eventAt = new Date().toISOString();
    const messageId = String(emailResult.messageId || '');
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName: 'request_failed',
      recipient: recipientEmail,
      messageId,
      sgEventId: '',
      eventAt,
      detail,
    });
    insertBookingEmailEvent.run(bookingId, 'request_failed', recipientEmail, messageId, '', dedupeKey, detail, eventAt, null);
    return res.status(502).json({ message: detail });
  }

  markEmailDelivery.run(recipientEmail, 'sent', 'sent', null, bookingId);
  const acceptedAt = new Date().toISOString();
  const acceptedMessageId = String(emailResult.messageId || '');
  const acceptedDetail = 'Send request accepted by email provider (202).';
  const acceptedDedupeKey = buildPaymentLinkEventDedupeKey({
    bookingId,
    eventName: 'request_accepted',
    recipient: recipientEmail,
    messageId: acceptedMessageId,
    sgEventId: '',
    eventAt: acceptedAt,
    detail: acceptedDetail,
  });
  insertBookingEmailEvent.run(
    bookingId,
    'request_accepted',
    recipientEmail,
    acceptedMessageId,
    '',
    acceptedDedupeKey,
    acceptedDetail,
    acceptedAt,
    null
  );

  return res.status(202).json({
    sent: true,
    paymentLinkUrl,
    messageId: String(emailResult.messageId || ''),
    message:
      emailResult.delivery === 'console'
        ? `Payment link generated for ${recipientEmail}. Email service is not configured, so the link was logged on server.`
        : `Email request accepted for ${recipientEmail}.`,
  });
});

app.post('/api/webhooks/sendgrid', async (req, res) => {
  const verification = await verifySendGridWebhookSignature(req);
  if (!verification.ok) {
    return res.status(verification.statusCode || 401).json({ message: verification.message || 'Unauthorized webhook signature.' });
  }

  const events = Array.isArray(req.body) ? req.body : [];
  if (!events.length) {
    return res.status(400).json({ message: 'No SendGrid events provided.' });
  }

  const updateDelivery = db.prepare(
    `UPDATE bookings
     SET payment_link_recipient_email = CASE WHEN ? <> '' THEN ? ELSE payment_link_recipient_email END,
         payment_link_delivery_status = ?,
         payment_link_delivery_detail = ?,
         payment_link_email_event = ?,
         payment_link_email_event_at = ?,
         payment_link_email_status = CASE
           WHEN ? IN ('bounce', 'dropped', 'spamreport') THEN 'failed'
           WHEN ? IN ('delivered', 'open', 'click') THEN 'sent'
           ELSE payment_link_email_status
         END,
         payment_link_email_error = CASE
           WHEN ? IN ('bounce', 'dropped', 'spamreport') THEN COALESCE(?, payment_link_email_error)
           ELSE payment_link_email_error
         END
     WHERE id = ?`
  );
  const insertEvent = db.prepare(
    `INSERT OR IGNORE INTO booking_email_events (
      booking_id, event_name, recipient_email, message_id, sg_event_id, dedupe_key, detail, event_at, raw_payload, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  );

  let updated = 0;
  let stored = 0;
  for (const event of events) {
    const customArgs = event?.custom_args || event?.unique_args || {};
    if (String(customArgs?.context || '').trim() !== 'booking_payment_link') continue;

    const bookingId = Number(customArgs?.bookingId);
    if (!Number.isInteger(bookingId)) continue;

    const eventName = normalizePaymentLinkEventName(event?.event);
    if (!eventName) continue;

    const recipient = String(event?.email || '').trim().toLowerCase();
    const messageId = String(event?.sg_message_id || event?.smtp-id || '').trim();
    const sgEventId = String(event?.sg_event_id || '').trim();
    const eventAt = Number.isFinite(Number(event?.timestamp))
      ? new Date(Number(event.timestamp) * 1000).toISOString()
      : new Date().toISOString();
    const detailParts = [
      String(event?.reason || '').trim(),
      String(event?.response || '').trim(),
      String(event?.status || '').trim(),
      String(event?.url || '').trim(),
    ].filter(Boolean);
    const detail = detailParts.join(' | ').slice(0, 500) || null;
    const dedupeKey = buildPaymentLinkEventDedupeKey({
      bookingId,
      eventName,
      recipient,
      messageId,
      sgEventId,
      eventAt,
      detail,
    });

    const insertResult = insertEvent.run(
      bookingId,
      eventName,
      recipient,
      messageId,
      sgEventId,
      dedupeKey,
      detail,
      eventAt,
      JSON.stringify(event)
    );
    if (Number(insertResult?.changes || 0) > 0) stored += Number(insertResult.changes || 0);

    if (!TRACKED_PAYMENT_LINK_EVENTS.has(eventName)) {
      continue;
    }

    const result = updateDelivery.run(
      recipient,
      recipient,
      eventName,
      detail,
      eventName,
      eventAt,
      eventName,
      eventName,
      eventName,
      detail,
      bookingId
    );
    if (Number(result?.changes || 0) > 0) updated += Number(result.changes || 0);

    if (eventName === 'delivered' || eventName === 'deferred' || eventName === 'bounce') {
      console.log('Payment link delivery webhook event:', {
        bookingId,
        event: eventName,
        recipient,
        messageId,
        detail: detail || '',
        eventAt,
      });
    }
  }

  return res.json({ ok: true, processed: events.length, updated, stored });
});

// Backward-compatible endpoint used by older cached frontend builds.
// We do not have an SMS gateway wired yet, so this returns the link with a clear message
// instead of failing the request.
app.post('/api/bookings/:id/send-payment-link-sms', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id, user_id AS userId, service_name AS serviceName, status, payment_status AS paymentStatus, created_at AS createdAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const service = getServiceByName(booking.serviceName);
  if (!service || service.membershipOnly || booking.paymentStatus === 'paid') {
    return res.status(409).json({ message: 'payment link is not required for this booking' });
  }
  if (booking.status === 'cancelled') {
    return res.status(409).json({ message: 'cannot send payment link for a cancelled booking' });
  }
  if (isHoldExpiredBooking(booking)) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  if (!phoneNumber) {
    return res.status(400).json({ message: 'phoneNumber is required' });
  }

  const paymentLinkUrl = buildBookingPaymentLink(req, booking.id, booking.userId);
  return res.json({
    sent: false,
    paymentLinkUrl,
    message: 'SMS gateway is not configured yet. Share the copied payment link with the customer, or use email delivery.',
  });
});

app.get('/api/public/payments/booking', (req, res) => {
  const access = verifyPaymentAccessToken(req.query?.token);
  const guestAccess = access ? null : verifyGuestCheckoutAccessToken(req.query?.token);

  if (access && Number.isInteger(access.bookingId) && Number.isInteger(access.userId)) {
    const booking = db
      .prepare(
        `SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, service_name AS serviceName,
                booking_date AS bookingDate, booking_time AS bookingTime, status, payment_status AS paymentStatus,
                payment_reference AS paymentReference, is_topup_session AS isTopUpSession,
                created_at AS createdAt
         FROM bookings
         WHERE id = ?`
      )
      .get(access.bookingId);
    if (!booking || Number(booking.userId) !== access.userId) {
      return res.status(404).json({ message: 'booking not found' });
    }

    const bookingOwner = getUserById(booking.userId);
    const service = getServiceByName(booking.serviceName);
    if (!service) {
      return res.status(400).json({ message: 'Invalid service configured on booking' });
    }

    const groupBookings = booking.bookingGroupId
      ? db
          .prepare(
            `SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, service_name AS serviceName,
                    booking_date AS bookingDate, booking_time AS bookingTime, status, payment_status AS paymentStatus,
                    payment_reference AS paymentReference, is_topup_session AS isTopUpSession,
                    created_at AS createdAt
             FROM bookings
             WHERE booking_group_id = ?
             ORDER BY booking_date, booking_time, id`
          )
          .all(booking.bookingGroupId)
      : [booking];
    const holdMetaEntries = groupBookings.map(applyHoldMeta);
    const holdActiveEntries = holdMetaEntries.filter((entry) => entry.holdActive);
    const holdExpired = holdMetaEntries.some((entry) => entry.holdExpired);
    const holdActive = holdActiveEntries.length > 0;
    const holdRemainingMinutes = holdActive
      ? Math.min(...holdActiveEntries.map((entry) => Number(entry.holdRemainingMinutes || 0)).filter((value) => value > 0))
      : 0;
    const holdExpiresAt = holdActive
      ? holdActiveEntries.map((entry) => entry.holdExpiresAt).filter(Boolean).sort()[0] || ''
      : '';
    const activeBookings = groupBookings.filter((entry) => entry.status !== 'cancelled');
    const payableBookings = activeBookings.filter((entry) => String(entry.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid');
    const pricingUser = {
      membershipStatus: bookingOwner?.membershipStatus || 'inactive',
      membershipExpiresAt: bookingOwner?.membershipExpiresAt || null,
      membershipStartedAt: bookingOwner?.membershipStartedAt || null,
      mobile: bookingOwner?.mobile || '',
    };
    let summary;
    try {
      if (booking.bookingGroupId) {
        const summaryBookings = payableBookings.length ? payableBookings : activeBookings;
        const payableHydrogenBookings = summaryBookings.filter((entry) => {
          const entryService = getServiceByName(entry.serviceName);
          return String(entryService?.category || '').toUpperCase() === 'HYDROGEN SESSION';
        });
        summary = payableHydrogenBookings.length
          ? buildHydrogenGroupPaymentSummary(summaryBookings, pricingUser)
          : buildAddOnOnlyPaymentSummary(summaryBookings, pricingUser);
      } else {
        summary = {
          serviceName: booking.serviceName,
          amountInr: getEffectiveServicePriceInr(service, pricingUser),
          totalAmountInr: getEffectiveServicePriceInr(service, pricingUser),
          bookingCount: 1,
        };
      }
    } catch (error) {
      return res.status(409).json({ message: error?.message || 'Unable to calculate payment details.' });
    }

    return res.json({
      bookingId: booking.id,
      bookingGroupId: booking.bookingGroupId || '',
      status: booking.status,
      paymentStatus: booking.paymentStatus || 'unpaid',
      customer: {
        name: bookingOwner?.name || '',
        email: bookingOwner?.email || '',
        mobile: bookingOwner?.mobile || '',
      },
      booking: {
        serviceName: summary.serviceName || booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
      },
      summary,
      hold: {
        active: holdActive,
        expired: holdExpired,
        remainingMinutes: holdRemainingMinutes,
        expiresAt: holdExpiresAt,
        holdMinutes: BOOKING_HOLD_MINUTES,
      },
      keyId: RAZORPAY_KEY_ID,
    });
  }

  if (!guestAccess) {
    return res.status(400).json({ message: 'Invalid or expired payment link' });
  }

  const bookings = loadBookingsByIds(guestAccess.bookingIds);
  if (!bookings.length || bookings.length !== guestAccess.bookingIds.length) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const activeBookings = bookings.filter((entry) => entry.status !== 'cancelled');
  const payableBookings = activeBookings.filter((entry) => String(entry.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid');
  if (!payableBookings.length) {
    return res.status(409).json({ message: 'All bookings in this package are already paid or cancelled.' });
  }
  if (payableBookings.some((entry) => isHoldExpiredBooking(entry))) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  const pricingUser = {
    membershipStatus: 'inactive',
    membershipExpiresAt: null,
    membershipStartedAt: null,
    mobile: guestAccess.guestPhone || '',
  };

  let summary;
  try {
    summary = applyOneUseAdminPhoneDiscountToSummary(
      payableBookings,
      pricingUser,
      buildAggregatePaymentSummary(payableBookings, pricingUser)
    );
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to calculate payment details.' });
  }

  const firstBooking = payableBookings[0] || bookings[0];
  return res.json({
    bookingId: Number(firstBooking.id || 0),
    bookingIds: bookings.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id) && id > 0),
    bookingGroupId: '',
    status: firstBooking.status || 'pending',
    paymentStatus: firstBooking.paymentStatus || 'unpaid',
    customer: {
      name: guestAccess.guestName || firstBooking.guestName || '',
      email: guestAccess.guestEmail || firstBooking.guestEmail || '',
      mobile: guestAccess.guestPhone || firstBooking.guestPhone || '',
    },
    booking: {
      serviceName: summary.units?.[0]?.label || firstBooking.serviceName,
      bookingDate: firstBooking.bookingDate,
      bookingTime: firstBooking.bookingTime,
      guestName: guestAccess.guestName || firstBooking.guestName || '',
      guestEmail: guestAccess.guestEmail || firstBooking.guestEmail || '',
      guestPhone: guestAccess.guestPhone || firstBooking.guestPhone || '',
    },
    bookings: bookings.map((entry) => ({
      id: entry.id,
      serviceName: entry.serviceName,
      bookingDate: entry.bookingDate,
      bookingTime: entry.bookingTime,
      guestName: entry.guestName || '',
      guestEmail: entry.guestEmail || '',
      guestPhone: entry.guestPhone || '',
    })),
    summary,
    hold: {
      active: false,
      expired: false,
      remainingMinutes: 0,
      expiresAt: '',
      holdMinutes: BOOKING_HOLD_MINUTES,
    },
    keyId: RAZORPAY_KEY_ID,
  });
});

// Guest Checkout Endpoint
// Allows unauthenticated users to start checkout with basic info
app.post('/api/guest/checkout', async (req, res) => {
  const { guestName, guestEmail, guestPhone, bookings } = req.body;

  // Validate guest information
  if (!guestName || typeof guestName !== 'string' || guestName.trim().length < 2 || guestName.trim().length > 80) {
    return res.status(400).json({ message: 'Valid guest name (2-80 characters) is required' });
  }

  if (!guestEmail || typeof guestEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) {
    return res.status(400).json({ message: 'Valid guest email is required' });
  }

  if (!guestPhone || typeof guestPhone !== 'string' || !/^[6-9]\d{9}$/.test(guestPhone.trim())) {
    return res.status(400).json({ message: 'Valid 10-digit guest phone number is required' });
  }

  if (!Array.isArray(bookings) || bookings.length === 0) {
    return res.status(400).json({ message: 'At least one booking is required' });
  }

  // Validate each booking and create provisional records
  const createdBookings = [];
  const errors = [];
  const guestUserId = ensureGuestBookingOwnerUser();

  try {
    for (const booking of bookings) {
      const { serviceName, bookingDate, bookingTime, addOnService } = booking;

      if (!serviceName || !bookingDate || !bookingTime) {
        errors.push('Invalid booking details: service, date, and time required');
        continue;
      }

      // Validate service exists
      const service = getServiceByName(serviceName);
      if (!service) {
        errors.push(`Service not found: ${serviceName}`);
        continue;
      }

      // Check slot availability
      const slotCheck = db
        .prepare(
          `SELECT COUNT(*) as total FROM bookings
           WHERE service_name = ? AND booking_date = ? AND booking_time = ? 
           AND status IN ('booked', 'confirmed') AND payment_status = 'paid'`
        )
        .get(serviceName, bookingDate, bookingTime);

      if (Number(slotCheck.total || 0) >= MAX_BOOKINGS_PER_SLOT_HYDROGEN) {
        errors.push(`Slot full for ${serviceName} on ${bookingDate} at ${bookingTime}`);
        continue;
      }

      const now = new Date().toISOString();

      const insertResult = db.prepare(
        `INSERT INTO bookings (
          user_id, booking_group_id, client_name, client_email, client_phone, service_name,
          booking_date, booking_time, assigned_staff, status, payment_status,
          is_topup_session, reschedule_count, notes, guest_name, guest_email, guest_phone,
          booking_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        guestUserId,
        null, // booking_group_id - will be set if group booking
        guestName.trim(),
        guestEmail.trim(),
        guestPhone.trim(),
        serviceName,
        bookingDate,
        bookingTime,
        'pending',
        'pending',
        'unpaid',
        0,
        0,
        '',
        guestName.trim(),
        guestEmail.trim(),
        guestPhone.trim(),
        'guest',
        now
      );

      const bookingId = Number(insertResult.lastInsertRowid);
      createdBookings.push({ id: bookingId, serviceName, bookingDate, bookingTime });
    }

    if (errors.length > 0 && createdBookings.length === 0) {
      return res.status(400).json({ message: errors[0] });
    }

    if (createdBookings.length === 0) {
      return res.status(400).json({ message: 'No valid bookings to create' });
    }

    // Generate payment token for guest
    const paymentToken = createGuestCheckoutAccessToken({
      guestEmail: guestEmail.trim(),
      guestPhone: guestPhone.trim(),
      guestName: guestName.trim(),
      bookingIds: createdBookings.map((b) => b.id),
    });

    if (!paymentToken) {
      return res.status(500).json({ message: 'Unable to prepare guest payment token' });
    }

    // Calculate total amount (simplified - use first booking price for now)
    const firstService = getServiceByName(createdBookings[0].serviceName);
    const totalAmountInr = firstService ? Number(firstService.priceInr || 0) * createdBookings.length : 0;

    res.json({
      success: true,
      paymentToken,
      summary: {
        totalAmountInr,
        bookingCount: createdBookings.length,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim(),
        items: createdBookings.map(b => ({
          serviceName: b.serviceName,
          bookingDate: b.bookingDate,
          bookingTime: b.bookingTime,
        })),
      },
    });
  } catch (error) {
    console.error('Guest checkout error:', error);
    return res.status(500).json({ message: 'Unable to process guest checkout' });
  }
});

app.post('/api/public/payments/create-order', async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const access = verifyPaymentAccessToken(req.body?.token);
  const guestAccess = access ? null : verifyGuestCheckoutAccessToken(req.body?.token);

  const paymentContext = (() => {
    if (access && Number.isInteger(access.bookingId) && Number.isInteger(access.userId)) {
      const booking = db
        .prepare(
          `SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, status, payment_status AS paymentStatus,
                  payment_reference AS paymentReference, is_topup_session AS isTopUpSession,
                  service_name AS serviceName, booking_date AS bookingDate, booking_time AS bookingTime,
                  created_at AS createdAt
           FROM bookings
           WHERE id = ?`
        )
        .get(access.bookingId);
      if (!booking || Number(booking.userId) !== access.userId) {
        return null;
      }
      const bookingOwner = getUserById(booking.userId);
      const service = getServiceByName(booking.serviceName);
      if (!service) return null;
      const groupBookings = booking.bookingGroupId
        ? db
            .prepare(
              `SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, service_name AS serviceName,
                      booking_date AS bookingDate, booking_time AS bookingTime, status, payment_status AS paymentStatus,
                      payment_reference AS paymentReference, is_topup_session AS isTopUpSession
               FROM bookings
               WHERE booking_group_id = ?
               ORDER BY booking_date, booking_time, id`
            )
            .all(booking.bookingGroupId)
        : [];
      const payableBookings = booking.bookingGroupId
        ? groupBookings.filter((entry) => entry.status !== 'cancelled' && entry.paymentStatus !== 'paid')
        : [booking];
      if (!payableBookings.length) return null;
      if (payableBookings.some((entry) => isHoldExpiredBooking(entry))) return null;
      const pricingUser = {
        membershipStatus: bookingOwner?.membershipStatus || 'inactive',
        membershipExpiresAt: bookingOwner?.membershipExpiresAt || null,
        membershipStartedAt: bookingOwner?.membershipStartedAt || null,
        mobile: bookingOwner?.mobile || '',
      };
      return {
        kind: 'user',
        booking,
        bookingOwner,
        service,
        payableBookings,
        pricingUser,
      };
    }

    if (!guestAccess) return null;
    const bookings = loadBookingsByIds(guestAccess.bookingIds);
    if (!bookings.length || bookings.length !== guestAccess.bookingIds.length) return null;
    const activeBookings = bookings.filter((entry) => entry.status !== 'cancelled');
    const payableBookings = activeBookings.filter((entry) => String(entry.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid');
    if (!payableBookings.length) return null;
    if (payableBookings.some((entry) => isHoldExpiredBooking(entry))) return null;
    return {
      kind: 'guest',
      booking: activeBookings[0] || bookings[0],
      bookings,
      payableBookings,
      pricingUser: {
        membershipStatus: 'inactive',
        membershipExpiresAt: null,
        membershipStartedAt: null,
        mobile: guestAccess.guestPhone || '',
      },
      guestAccess,
    };
  })();

  if (!paymentContext) {
    return res.status(400).json({ message: 'Invalid or expired payment link' });
  }

  let paymentSummary;
  try {
    if (paymentContext.kind === 'user') {
      const { booking, bookingOwner, service, payableBookings, pricingUser } = paymentContext;
      if (booking.bookingGroupId) {
        const payableHydrogenBookings = payableBookings.filter((entry) => {
          const entryService = getServiceByName(entry.serviceName);
          return String(entryService?.category || '').toUpperCase() === 'HYDROGEN SESSION';
        });
        paymentSummary = payableHydrogenBookings.length
          ? buildHydrogenGroupPaymentSummary(payableBookings, pricingUser)
          : buildAddOnOnlyPaymentSummary(payableBookings, pricingUser);
      } else {
        paymentSummary = {
          serviceName: booking.serviceName,
          amountInr: getEffectiveServicePriceInr(service, pricingUser),
          totalAmountInr: getEffectiveServicePriceInr(service, pricingUser),
          bookingCount: 1,
        };
      }
      paymentContext.bookingOwner = bookingOwner;
    } else {
      paymentSummary = applyOneUseAdminPhoneDiscountToSummary(
        paymentContext.payableBookings,
        paymentContext.pricingUser,
        buildAggregatePaymentSummary(paymentContext.payableBookings, paymentContext.pricingUser)
      );
    }
    paymentSummary = finalizeSummaryWithGst(paymentSummary);
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to calculate payment total for this booking.' });
  }

  const payableTotalInr = Number(paymentSummary.totalAmountInr || 0);
  const amountInPaise = Math.max(0, Math.round(payableTotalInr * 100));

  try {
    if (amountInPaise <= 0) {
      if (paymentContext.kind === 'user') {
        const { booking, payableBookings } = paymentContext;
        if (booking.bookingGroupId) {
          db.prepare(
            `UPDATE bookings
             SET payment_status = 'paid',
                 paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
                 paid_amount_paise = 0,
                 status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
             WHERE booking_group_id = ?
               AND status <> 'cancelled'
               AND payment_status <> 'paid'`
          ).run(booking.bookingGroupId);
        } else {
          db.prepare(
            `UPDATE bookings
             SET payment_status = 'paid',
                 paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
                 paid_amount_paise = 0,
                 status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
             WHERE id = ?`
          ).run(booking.id);
        }
        return res.json({
          paid: true,
          bookingId: booking.id,
          bookingCount: Number(paymentSummary.bookingCount || payableBookings.length || 1),
          summary: paymentSummary,
        });
      }

      db.prepare(
        `UPDATE bookings
         SET payment_status = 'paid',
             paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
             paid_amount_paise = 0,
             status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
         WHERE id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      );
      for (const booking of paymentContext.payableBookings) {
        db.prepare(
          `UPDATE bookings
           SET payment_status = 'paid',
               paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
               paid_amount_paise = 0,
               status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
           WHERE id = ?
             AND status <> 'cancelled'
             AND payment_status <> 'paid'`
        ).run(booking.id);
      }
      return res.json({
        paid: true,
        bookingId: Number(paymentContext.payableBookings[0]?.id || paymentContext.bookings[0]?.id || 0),
        bookingIds: paymentContext.payableBookings.map((booking) => Number(booking.id)).filter((id) => Number.isInteger(id) && id > 0),
        bookingCount: Number(paymentSummary.bookingCount || paymentContext.payableBookings.length || 1),
        summary: paymentSummary,
      });
    }

    const booking = paymentContext.booking;
    const bookingOwner = paymentContext.bookingOwner;
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: buildRazorpayReceipt(
        booking.bookingGroupId ? 'bkgroup' : paymentContext.kind === 'guest' ? 'guest' : 'booking',
        booking.bookingGroupId || booking.id
      ),
      notes: paymentContext.kind === 'guest'
        ? {
            bookingIds: paymentContext.payableBookings.map((entry) => String(entry.id)).join(','),
            guestEmail: paymentContext.guestAccess?.guestEmail || '',
            guestPhone: paymentContext.guestAccess?.guestPhone || '',
          }
        : {
            bookingId: String(booking.id),
            userId: String(booking.userId),
            bookingGroupId: String(booking.bookingGroupId || ''),
          },
    });

    if (paymentContext.kind === 'user') {
      const { payableBookings } = paymentContext;
      if (booking.bookingGroupId) {
        setPaymentAmountForBookings(payableBookings, amountInPaise);
        db.prepare(
          `UPDATE bookings
           SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
               payment_order_id = ?
           WHERE booking_group_id = ?
             AND status <> 'cancelled'
             AND payment_status <> 'paid'`
        ).run(order.id, booking.bookingGroupId);
      } else {
        setPaymentAmountForBookings([booking], amountInPaise);
        db.prepare(
          `UPDATE bookings
           SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
               payment_order_id = ?
           WHERE id = ?`
        ).run(order.id, booking.id);
      }
    } else {
      setPaymentAmountForBookings(paymentContext.payableBookings, amountInPaise);
      db.prepare(
        `UPDATE bookings
         SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
             payment_order_id = ?
         WHERE id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      );
      for (const guestBooking of paymentContext.payableBookings) {
        db.prepare(
          `UPDATE bookings
           SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
               payment_order_id = ?
           WHERE id = ?
             AND status <> 'cancelled'
             AND payment_status <> 'paid'`
        ).run(order.id, guestBooking.id);
      }
    }

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: Number(booking.id || 0),
      bookingIds: paymentContext.kind === 'guest'
        ? paymentContext.payableBookings.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id) && id > 0)
        : undefined,
      bookingCount: Number(paymentSummary.bookingCount || paymentContext.payableBookings?.length || 1),
      summary: paymentSummary,
      booking: {
        serviceName: paymentSummary.serviceName || booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        amountInr: Number(paymentSummary.payableAmountInr || paymentSummary.totalAmountInr || 0),
        guestName: paymentContext.kind === 'guest' ? paymentContext.guestAccess?.guestName || '' : '',
        guestEmail: paymentContext.kind === 'guest' ? paymentContext.guestAccess?.guestEmail || '' : '',
        guestPhone: paymentContext.kind === 'guest' ? paymentContext.guestAccess?.guestPhone || '' : '',
      },
      customer: paymentContext.kind === 'guest'
        ? {
            name: paymentContext.guestAccess?.guestName || '',
            email: paymentContext.guestAccess?.guestEmail || '',
            mobile: paymentContext.guestAccess?.guestPhone || '',
          }
        : {
            name: bookingOwner?.name || '',
            email: bookingOwner?.email || '',
          },
    });
  } catch (error) {
    console.error('Razorpay public booking order create failed:', getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order'));
    return res.status(500).json({ message: getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order') });
  }
});

app.post('/api/public/payments/verify', async (req, res) => {
  const access = verifyPaymentAccessToken(req.body?.token);
  const guestAccess = access ? null : verifyGuestCheckoutAccessToken(req.body?.token);
  const razorpayOrderId = String(req.body?.razorpay_order_id || '');
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
  const razorpaySignature = String(req.body?.razorpay_signature || '');

  if (!razorpay || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  if ((!access && !guestAccess) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment verification payload' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  const paymentMethod = await getRazorpayPaymentMethod(razorpayPaymentId);

  if (access && Number.isInteger(access.bookingId) && Number.isInteger(access.userId)) {
    const booking = db
      .prepare(
        'SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, payment_order_id AS paymentOrderId FROM bookings WHERE id = ?'
      )
      .get(access.bookingId);

    if (!booking || Number(booking.userId) !== access.userId) {
      return res.status(404).json({ message: 'booking not found' });
    }

    if (booking.paymentOrderId && booking.paymentOrderId !== razorpayOrderId) {
      return res.status(400).json({ message: 'Order mismatch' });
    }

    if (booking.bookingGroupId) {
      const groupBookings = db
        .prepare(
          `SELECT id
           FROM bookings
           WHERE booking_group_id = ?
             AND status <> 'cancelled'
             AND payment_status <> 'paid'`
        )
        .all(booking.bookingGroupId);

      db.prepare(
        `UPDATE bookings
         SET payment_status = 'paid',
             paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
             payment_order_id = CASE WHEN ? <> '' THEN ? ELSE payment_order_id END,
             payment_reference = CASE WHEN ? <> '' THEN ? ELSE payment_reference END,
             payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
             status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
         WHERE booking_group_id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      ).run(razorpayOrderId, razorpayOrderId, razorpayPaymentId, razorpayPaymentId, paymentMethod, paymentMethod, booking.bookingGroupId);

      return res.json({ bookingId: access.bookingId, paid: true, bookingCount: groupBookings.length });
    }

    markBookingPaid(access.bookingId, razorpayOrderId, razorpayPaymentId, paymentMethod);
    return res.json({ bookingId: access.bookingId, paid: true });
  }

  const guestBookings = loadBookingsByIds(guestAccess.bookingIds);
  if (!guestBookings.length || guestBookings.length !== guestAccess.bookingIds.length) {
    return res.status(404).json({ message: 'booking not found' });
  }
  if (guestBookings.some((booking) => booking.paymentOrderId && booking.paymentOrderId !== razorpayOrderId)) {
    return res.status(400).json({ message: 'Order mismatch' });
  }

  const payableGuestBookings = guestBookings.filter(
    (booking) => booking.status !== 'cancelled' && String(booking.paymentStatus || '').trim().toLowerCase() !== 'paid'
  );
  if (!payableGuestBookings.length) {
    return res.status(409).json({ message: 'All bookings in this package are already paid or cancelled.' });
  }

  db.transaction(() => {
    for (const booking of payableGuestBookings) {
      db.prepare(
        `UPDATE bookings
         SET payment_status = 'paid',
             paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
             payment_order_id = CASE WHEN ? <> '' THEN ? ELSE payment_order_id END,
             payment_reference = CASE WHEN ? <> '' THEN ? ELSE payment_reference END,
             payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
             status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
         WHERE id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      ).run(razorpayOrderId, razorpayOrderId, razorpayPaymentId, razorpayPaymentId, paymentMethod, paymentMethod, booking.id);
    }
  })();

  return res.json({
    bookingId: Number(payableGuestBookings[0]?.id || guestBookings[0]?.id || 0),
    bookingIds: payableGuestBookings.map((booking) => Number(booking.id)).filter((id) => Number.isInteger(id) && id > 0),
    paid: true,
    bookingCount: payableGuestBookings.length,
  });
});

app.post('/api/payments/preview-cart-coupon', requireAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'forbidden' });
  }

  const pricingUser = {
    membershipStatus: req.user.membershipStatus || 'inactive',
    membershipExpiresAt: req.user.membershipExpiresAt || null,
    mobile: req.user.mobile || '',
  };
  const payableBookings = getPayableUserBookings(req.user.id);
  if (!payableBookings.length) {
    return res.status(409).json({ message: 'No unpaid payable bookings found.' });
  }

  let paymentSummary;
  try {
    paymentSummary = buildAggregatePaymentSummary(payableBookings, pricingUser);
    paymentSummary = applyOneUseAdminPhoneDiscountToSummary(payableBookings, { ...pricingUser, mobile: req.user.mobile || '' }, paymentSummary);
    paymentSummary = finalizeSummaryWithGst(paymentSummary);
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to calculate payment total for current bookings.' });
  }

  const couponResult = validateCouponForUser({
    code: req.body?.couponCode,
    userId: req.user.id,
    appliesTo: 'services',
    subtotalAmountPaise: Math.round(Number(paymentSummary.totalAmountInr || 0) * 100),
    singleBookingAmountPaise: getSingleBookingCouponBasePaise(paymentSummary),
  });
  if (couponResult.error) {
    return res.status(400).json({ message: couponResult.error });
  }

  return res.json({ coupon: serializeCouponPreview(couponResult), summary: paymentSummary });
});

app.post('/api/payments/create-cart-order', requireAuth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'forbidden' });
  }

  const pricingUser = {
    membershipStatus: req.user.membershipStatus || 'inactive',
    membershipExpiresAt: req.user.membershipExpiresAt || null,
    mobile: req.user.mobile || '',
  };
  const payableBookings = getPayableUserBookings(req.user.id);
  if (!payableBookings.length) {
    return res.status(409).json({ message: 'No unpaid payable bookings found.' });
  }

  let paymentSummary;
  try {
    paymentSummary = buildAggregatePaymentSummary(payableBookings, pricingUser);
    paymentSummary = applyOneUseAdminPhoneDiscountToSummary(payableBookings, { ...pricingUser, mobile: req.user.mobile || '' }, paymentSummary);
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to calculate payment total for current bookings.' });
  }

  const subtotalAmountPaise = Math.round(Number(paymentSummary.subtotalAmountInr ?? paymentSummary.totalAmountInr ?? 0) * 100);
  const couponResult = validateCouponForUser({
    code: req.body?.couponCode,
    userId: req.user.id,
    appliesTo: 'services',
    subtotalAmountPaise,
    singleBookingAmountPaise: getSingleBookingCouponBasePaise(paymentSummary),
  });
  if (couponResult.error) {
    return res.status(400).json({ message: couponResult.error });
  }
  const taxableAmountPaise = Number(couponResult.finalAmountPaise || subtotalAmountPaise);
  const amountInPaise = Math.max(100, Math.round(taxableAmountPaise * (1 + GST_RATE_PERCENT / 100)));
  paymentSummary = finalizeSummaryWithGst(paymentSummary);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: buildRazorpayReceipt('cart', req.user.id),
      notes: {
        userId: String(req.user.id),
        scope: 'cart',
        couponCode: String(couponResult.couponCode || ''),
      },
    });

    const ids = payableBookings.map((entry) => Number(entry.id)).filter((id) => Number.isInteger(id));
    db.prepare(
      `INSERT OR REPLACE INTO cart_payment_orders (
        order_id, user_id, original_amount_paise, discount_amount_paise, coupon_id, coupon_code, amount_paise, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).run(
      order.id,
      req.user.id,
      Number(couponResult.originalAmountPaise || subtotalAmountPaise),
      Number(couponResult.discountAmountPaise || 0),
      couponResult.coupon?.id || null,
      couponResult.couponCode || null,
      amountInPaise
    );

    db.prepare(
      `UPDATE bookings
       SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
           payment_order_id = ?
       WHERE id IN (${ids.map(() => '?').join(', ')})`
    ).run(order.id, ...ids);
    setPaymentAmountForBookings(payableBookings, amountInPaise);

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      summary: paymentSummary,
      subtotalAmountInr: Number(paymentSummary.subtotalAmountInr || subtotalAmountPaise / 100),
      gstAmountInr: Number(paymentSummary.gstAmountInr || Math.max(0, amountInPaise / 100 - subtotalAmountPaise / 100)),
      payableAmountInr: Number(paymentSummary.payableAmountInr || amountInPaise / 100),
      coupon: serializeCouponPreview(couponResult),
      user: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Razorpay cart order create failed:', getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order'));
    return res.status(500).json({ message: getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order') });
  }
});

app.post('/api/payments/create-order', requireAuth, async (req, res) => {
  if (!razorpay) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  const bookingId = Number(req.body?.bookingId);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'bookingId is required' });
  }

  const booking = db.prepare(
    `SELECT b.id, b.user_id AS userId, b.booking_group_id AS bookingGroupId, b.status, b.payment_status AS paymentStatus,
            b.payment_reference AS paymentReference, b.is_topup_session AS isTopUpSession,
            b.service_name AS serviceName, b.booking_date AS bookingDate, b.booking_time AS bookingTime,
            b.created_at AS createdAt
     FROM bookings b
     WHERE b.id = ?`
  ).get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (booking.status === 'cancelled') {
    return res.status(400).json({ message: 'cannot pay for a cancelled booking' });
  }

  if (booking.paymentStatus === 'paid' && !booking.bookingGroupId) {
    return res.status(409).json({ message: 'booking is already paid' });
  }

  const service = getServiceByName(booking.serviceName);
  if (!service) {
    return res.status(400).json({ message: 'Invalid service configured on booking' });
  }
  if (service.membershipOnly) {
    return res.status(409).json({ message: 'This membership service is included. Payment is not required.' });
  }

  const bookingOwner = db
    .prepare(
      `SELECT membership_status AS membershipStatus,
              membership_started_at AS membershipStartedAt,
              membership_expires_at AS membershipExpiresAt,
              mobile
       FROM users
       WHERE id = ?`
    )
    .get(booking.userId);
  const pricingUser = {
    membershipStatus: bookingOwner?.membershipStatus || req.user.membershipStatus || 'inactive',
    membershipExpiresAt: bookingOwner?.membershipExpiresAt || req.user.membershipExpiresAt || null,
    membershipStartedAt: bookingOwner?.membershipStartedAt || req.user.membershipStartedAt || null,
    mobile: bookingOwner?.mobile || req.user.mobile || '',
  };
  const groupBookings = booking.bookingGroupId
    ? db
        .prepare(
          `SELECT id,
                  user_id AS userId,
                  booking_group_id AS bookingGroupId,
                  service_name AS serviceName,
                  booking_date AS bookingDate,
                  booking_time AS bookingTime,
                  status,
                  payment_status AS paymentStatus,
                  payment_reference AS paymentReference,
                  is_topup_session AS isTopUpSession,
                  created_at AS createdAt
           FROM bookings
           WHERE booking_group_id = ?
           ORDER BY booking_date, booking_time, id`
        )
        .all(booking.bookingGroupId)
    : [];

  if (groupBookings.some((entry) => !canAccessBooking(req.user, entry.userId))) {
    return res.status(403).json({ message: 'forbidden' });
  }

  const payableBookings = booking.bookingGroupId
    ? groupBookings.filter((entry) => entry.status !== 'cancelled' && entry.paymentStatus !== 'paid')
    : [booking];

  if (!payableBookings.length) {
    return res.status(409).json({ message: 'All bookings in this package are already paid or cancelled.' });
  }
  if (payableBookings.some((entry) => isHoldExpiredBooking(entry))) {
    return res.status(409).json({ message: 'This booking hold has expired. Please book another slot.' });
  }

  let paymentSummary;
  try {
    if (booking.bookingGroupId) {
      const payableHydrogenBookings = payableBookings.filter((entry) => {
        const entryService = getServiceByName(entry.serviceName);
        return String(entryService?.category || '').toUpperCase() === 'HYDROGEN SESSION';
      });
      paymentSummary = payableHydrogenBookings.length
        ? buildHydrogenGroupPaymentSummary(payableBookings, pricingUser)
        : buildAddOnOnlyPaymentSummary(payableBookings, pricingUser);
    } else {
      paymentSummary = {
          serviceName: booking.serviceName,
          amountInr: getEffectiveServicePriceInr(service, pricingUser),
          totalAmountInr: getEffectiveServicePriceInr(service, pricingUser),
          bookingCount: 1,
        };
    }
    if (booking.bookingGroupId) {
      const aggregateSummary = buildAggregatePaymentSummary(payableBookings, pricingUser);
      const oneUseSummary = applyOneUseAdminPhoneDiscountToSummary(payableBookings, pricingUser, aggregateSummary);
      paymentSummary = {
        ...paymentSummary,
        totalAmountInr: Number(oneUseSummary.totalAmountInr || paymentSummary.totalAmountInr || 0),
      };
    }
    paymentSummary = finalizeSummaryWithGst(paymentSummary);
  } catch (error) {
    return res.status(409).json({ message: error?.message || 'Unable to calculate payment total for this booking.' });
  }

  const payableTotalInr = Number(paymentSummary.totalAmountInr || 0);
  if (payableTotalInr <= 0) {
    if (booking.bookingGroupId) {
      db.prepare(
        `UPDATE bookings
         SET payment_status = 'paid',
             paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
             paid_amount_paise = 0,
             status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
         WHERE booking_group_id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      ).run(booking.bookingGroupId);
    } else {
      db.prepare(
        `UPDATE bookings
         SET payment_status = 'paid',
             paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
             paid_amount_paise = 0,
             status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
         WHERE id = ?`
      ).run(booking.id);
    }

    return res.json({
      paid: true,
      bookingId: booking.id,
      bookingCount: Number(paymentSummary.bookingCount || 1),
      summary: paymentSummary,
    });
  }

  const amountInPaise = Math.round(payableTotalInr * 100);

  try {
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: buildRazorpayReceipt(booking.bookingGroupId ? 'bkgroup' : 'booking', booking.bookingGroupId || booking.id),
      notes: {
        bookingId: String(booking.id),
        userId: String(booking.userId),
        bookingGroupId: String(booking.bookingGroupId || ''),
      },
    });

    if (booking.bookingGroupId) {
      setPaymentAmountForBookings(payableBookings, amountInPaise);
      db.prepare(
        `UPDATE bookings
         SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
             payment_order_id = ?
         WHERE booking_group_id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      ).run(order.id, booking.bookingGroupId);
    } else {
      setPaymentAmountForBookings([booking], amountInPaise);
      db.prepare(
        `UPDATE bookings
         SET payment_status = CASE WHEN payment_status = 'unpaid' THEN 'payment_pending' ELSE payment_status END,
             payment_order_id = ?
         WHERE id = ?`
      ).run(order.id, booking.id);
    }

    return res.json({
      keyId: RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking.id,
      bookingCount: Number(paymentSummary.bookingCount || 1),
      summary: paymentSummary,
      subtotalAmountInr: Number(paymentSummary.subtotalAmountInr || 0),
      gstAmountInr: Number(paymentSummary.gstAmountInr || 0),
      booking: {
        serviceName: paymentSummary.serviceName || booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        amountInr: Number(paymentSummary.payableAmountInr || paymentSummary.totalAmountInr || 0),
      },
      user: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (error) {
    console.error('Razorpay booking order create failed:', getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order'));
    return res.status(500).json({ message: getRazorpayOrderErrorMessage(error, 'Unable to create Razorpay order') });
  }
});

function shouldDownloadInvoicePdf(req) {
  const format = String(req.query?.format || '').trim().toLowerCase();
  const download = String(req.query?.download || '').trim().toLowerCase();
  return format === 'pdf' || ['1', 'true', 'yes'].includes(download);
}

function sanitizeInvoiceFilenamePart(value) {
  return String(value || 'Invoice')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'Invoice';
}

function prepareInvoiceHtmlForPdf(html, req) {
  const origin = getRequestOrigin(req).replace(/\/+$/, '');
  return String(html || '')
    .replace(/<head>/i, `<head><base href="${escapeHtml(origin)}/">`)
    .replace(/url\('\/([^']+)'\)/g, `url('${origin}/$1')`)
    .replace(/url\("\/([^"]+)"\)/g, `url("${origin}/$1")`)
    .replace(/url\(\/([^)]+)\)/g, `url(${origin}/$1)`)
    .replace(/\ssrc="\/([^"]+)"/g, ` src="${origin}/$1"`)
    .replace(/\shref="\/([^"]+)"/g, ` href="${origin}/$1"`);
}

async function sendInvoiceResponse(req, res, html, invoiceNo) {
  if (!shouldDownloadInvoicePdf(req)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  if (!puppeteer) {
    return res.status(503).json({
      message: 'PDF invoice download requires Puppeteer. Install the minimal dependency with: npm install puppeteer',
    });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
    await page.setContent(prepareInvoiceHtmlForPdf(html, req), {
      waitUntil: ['load', 'networkidle0'],
    });
    const pdfBuffer = await page.pdf({
      width: '240mm',
      height: '320mm',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    const safeInvoiceNo = sanitizeInvoiceFilenamePart(invoiceNo);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice-${safeInvoiceNo}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Invoice PDF generation failed:', error);
    return res.status(500).json({ message: 'Unable to generate invoice PDF right now.' });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

app.get('/invoice/booking', async (req, res) => {
  const access = verifyInvoiceAccessToken(req.query?.token);
  if (!access || access.scope !== 'booking_invoice' || !Number.isInteger(access.bookingId) || !Number.isInteger(access.userId)) {
    return res.status(400).send('Invalid or expired invoice link');
  }

  const booking = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              payment_reference AS paymentReference,
              paid_amount_paise AS paidAmountPaise,
              paid_at AS paidAt,
              created_at AS createdAt
       FROM bookings
       WHERE id = ?`
    )
    .get(access.bookingId);
  if (!booking || Number(booking.userId) !== access.userId) {
    return res.status(404).send('Invoice not found');
  }
  if (String(booking.paymentStatus || '').trim().toLowerCase() !== 'paid') {
    return res.status(409).send('Invoice is available only for paid bookings');
  }

  const bookingOwner = getUserById(booking.userId);
  const pricingUser = {
    membershipStatus: bookingOwner?.membershipStatus || 'inactive',
    membershipStartedAt: bookingOwner?.membershipStartedAt || null,
    membershipExpiresAt: bookingOwner?.membershipExpiresAt || null,
    mobile: bookingOwner?.mobile || '',
  };

  const groupBookings = booking.bookingGroupId
    ? db
        .prepare(
          `SELECT id,
                  user_id AS userId,
                  booking_group_id AS bookingGroupId,
                  service_name AS serviceName,
                  booking_date AS bookingDate,
                  booking_time AS bookingTime,
                  status,
                  payment_status AS paymentStatus,
                  payment_reference AS paymentReference,
                  paid_amount_paise AS paidAmountPaise
           FROM bookings
           WHERE booking_group_id = ?
           ORDER BY booking_date, booking_time, id`
        )
        .all(booking.bookingGroupId)
    : [booking];

  const activeBookings = groupBookings.filter((entry) => String(entry.status || '').toLowerCase() !== 'cancelled');
  let summary = null;
  try {
    summary = buildBookingInvoiceSummary(activeBookings, pricingUser);
  } catch {
    summary = null;
  }

  const invoiceSummary = summary?.gstIncluded ? summary : summary ? finalizeSummaryWithGst(summary) : null;
  const amountInr = Number(
    invoiceSummary?.payableAmountInr ?? invoiceSummary?.totalAmountInr ?? invoiceSummary?.amountInr ?? 0
  );
  if (amountInr <= 0) {
    return res.status(409).send('Invoice is available only for paid bookings with amount greater than 0');
  }
  const invoiceItems =
    Array.isArray(invoiceSummary?.invoiceItems) && invoiceSummary.invoiceItems.length
      ? invoiceSummary.invoiceItems
      : [
          {
            serviceName: invoiceSummary?.serviceName || booking.serviceName || 'Booking',
            bookingDate: booking.bookingDate,
            bookingTime: booking.bookingTime,
          amountInr,
        },
      ];
  const grossBreakdown = getGstBreakdownForAmountInr(amountInr, { fromGross: true });
  const explicitSubtotalAmountInr = Number(invoiceSummary?.subtotalAmountInr);
  const explicitGstAmountInr = Number(invoiceSummary?.gstAmountInr);
  const useExplicitSplit =
    Number.isFinite(explicitSubtotalAmountInr) &&
    Number.isFinite(explicitGstAmountInr) &&
    explicitSubtotalAmountInr > 0 &&
    explicitGstAmountInr > 0;
  const subtotalAmountInr = useExplicitSplit ? explicitSubtotalAmountInr : grossBreakdown.subtotalAmountInr;
  const gstAmountInr = useExplicitSplit ? explicitGstAmountInr : grossBreakdown.gstAmountInr;
  const invoiceRowsHtml = invoiceItems
    .map((item, index) => {
      const itemDateTime = formatDateTimeWithComma(item.bookingDate || booking.bookingDate, item.bookingTime || booking.bookingTime);
      const rowAmountInr = invoiceItems.length === 1 ? subtotalAmountInr : Number(item.amountInr || 0);
      return `<tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.serviceName || 'Booking')}</td>
          <td>1</td>
          <td class="right">
              Rs. ${Number(rowAmountInr || 0).toLocaleString('en-IN')}
          </td>
          <td class="right">
              Rs. ${Number(rowAmountInr || 0).toLocaleString('en-IN')}
          </td>
        </tr>`;
    })
    .join('');
  const invoiceNo = `BK-${booking.id}`;
  const paidAtLabel = formatInvoiceDateTime(booking.paidAt);
  const generatedAtLabel = formatInvoiceDateTime(new Date());
  const customerName = bookingOwner?.name || '';
  const customerEmail = bookingOwner?.email || '';
  const customerMobile = bookingOwner?.mobile || '';

  const invoiceHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Billing Invoice ${escapeHtml(invoiceNo)}</title>
  <style>
    :root{--ink:#111;--muted:#444;--line:#e8e8f0}
    html,body{min-height:100%;height:auto;overflow-y:auto}
    body{
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      margin:0;
      color:var(--ink);
      background:#f3f3f7;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .page{
      width:min(240mm, calc(100% - 24px));
      min-height:320mm;
      margin:18px auto;
      box-sizing:border-box;
      background:#fff url('/booking/assets/invoice-page.png') no-repeat top center;
      background-size:100% 100%;
      padding:46mm 18mm 18mm 18mm;
      box-shadow:0 10px 32px rgba(0,0,0,.10);
      overflow:visible;
    }
    .row{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
    .title{font-size:18px;margin:0 0 4px;letter-spacing:.02em}
    .muted{color:var(--muted);font-size:13px;line-height:1.35}
    .block{margin-top:10px}
    .invoice-box{
       border:1px solid rgba(174,84,49,0.35);
       margin-top:8px;
       width:220px;
       margin-left:auto;
       margin-bottom:12px;
    }
    .invoice-box-label,
    .invoice-section-title{

       background:#AE5431;
       color:#fff;
       padding:12px;
       font-weight:700;
       text-align:center;
    }
    .invoice-box,
    .invoice-to-card{
      border:1px solid rgba(174,84,49,0.35);
    }
    .invoice-box div:last-child{
       padding:10px;
       text-align:center;
    }
    .invoice-to-card{
      margin-top:24px;
      border:1px solid rgba(174,84,49,0.35);
    }
    .invoice-to-body{
      padding:14px 18px;
    }
    .invoice-section-title{
      background:#AE5431;
      padding:10px;
      font-weight:700;
      text-align:center;
    }
    .customer-table{
       width:100%;
       margin-top:24px;
       border-collapse:collapse;
       table-layout:fixed;
    }

    .customer-table th{
       background:#AE5431;
       color:#fff;
       padding:12px;
    }
    .customer-table td{
       padding:16px;
       border:1px solid #d7b5a2;
    }
    .service-info-card{
      display:grid;
      grid-template-columns:1fr 1fr;
      margin-top:24px;
      margin-bottom:24px;
      border:1px solid rgba(174,84,49,0.35);
    }
    .invoice-bottom-section{
      display:flex;
      justify-content:space-between;
      align-items:flex-start;
      margin-top:24px;
      gap:40px;
    }
     
    .invoice-bottom-left{
      flex:1;
    }
    .summary-box{
       width:340px;
       margin-left:auto;
       margin-top:24px;
       border:1px solid rgba(174,84,49,.35);
    }
    .invoice-bottom-section .summary-box{
      margin-top:0;
    }
    .summary-row{
       display:flex;
       justify-content:space-between;
       padding:12px 18px;
       border-bottom:1px solid rgba(174,84,49,.15);
    }

    .summary-row:last-child{
      border-bottom:none;
    }

    .summary-total{
      background:#AE5431;
      color:#fff;
      font-weight:700;
    
    }
    .service-info-col{
      border-right:1px solid rgba(174,84,49,0.35);
    }
    .service-info-col:last-child{
      border-right:none;
    }
    .service-info-title{
      background:#AE5431;
      color:#fff;
      padding:12px;
      font-weight:700;
      text-align:center;
    }
    .service-info-body{
      padding:18px;
      min-height:120px;
      line-height:1.8;
    }
    
    .gst{margin-top:6px}
    .gst-space{display:inline-block;min-width:240px;border-bottom:1px solid #777;transform:translateY(-2px)}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    .invoice-service-table{width:100%;border-collapse:collapse;margin-top:24px;}
    .invoice-service-table th{background:#AE5431;color:#fff;border:1px solid rgba(174,84,49,.35);padding:12px;}
    .invoice-service-table td{border:1px solid rgba(174,84,49,.35);padding:14px;}
    th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;font-size:14px;vertical-align:top}
    th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    .right{text-align:right}
    .total{font-weight:700;font-size:16px}
    .footer{margin-top:14px}
    @media screen and (max-width:700px){
      html,body{height:auto;min-height:100%}
      body{background:#fff}
      .page{
        width:100%;
        min-height:calc(100vw * 1448 / 1086);
        margin:0;
        padding:132px 16px 24px;
        box-shadow:none;
        background-size:100% 100%;
      }
      .invoice-box{width:min(220px, 100%)}
      .customer-table{table-layout:auto}
      .customer-table th,
      .customer-table td{display:block;width:100%;text-align:left}
      .customer-table colgroup,
      .customer-table thead{display:none}
      .customer-table td:nth-child(1)::before{content:"Invoice to: ";font-weight:700;color:#AE5431}
      .customer-table td:nth-child(2)::before{content:"Email: ";font-weight:700;color:#AE5431}
      .customer-table td:nth-child(3)::before{content:"Phone: ";font-weight:700;color:#AE5431}
      .service-info-card{display:block}
      .service-info-col{border-right:0;border-bottom:1px solid rgba(174,84,49,0.35)}
      .service-info-col:last-child{border-bottom:0}
      .service-info-body{min-height:auto}
      .invoice-bottom-section{display:block}
      .summary-box{width:100%;margin-left:0}
      .invoice-bottom-section .summary-box{margin-top:16px}
      .row{display:block}
      .row > div{max-width:100%;overflow-wrap:anywhere}
      .row > div + div{margin-top:18px}
      .title{font-size:17px}
      .muted{font-size:12px}
      .gst-space{display:block;min-width:0;width:100%;max-width:260px;margin-top:4px;transform:none}
      table{table-layout:fixed;margin-top:16px}
      th,td{padding:9px 5px;font-size:12px;overflow-wrap:anywhere}
      th{font-size:10px;letter-spacing:.03em}
      .total{font-size:14px}
    }
    @media print{
      body{background:#fff}
      .page{width:240mm;margin:0;box-shadow:none}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="row invoice-header">
      <div>
        <div style="font-weight:700;">
           Vasporixus Apex Therapeutics LLP
        </div>
        <div class="muted">
           GSTIN: 36ABBFV3058K1ZW
        </div>
      </div>
    </div>
    <div style="text-align:right;">

      <div class="invoice-box">
         <div class="invoice-box-label">INVOICE</div>
         <div>${escapeHtml(invoiceNo)}</div>
      </div>

      <div class="invoice-box">
         <div class="invoice-box-label">DATE</div>
         <div>${escapeHtml(paidAtLabel || generatedAtLabel)}</div>
      </div>
    </div>
    <table class="customer-table">
      <colgroup>
        <col style="width:33%">
        <col style="width:34%">
        <col style="width:33%">
      </colgroup>
      <thead>
       <tr>
         <th>INVOICE TO</th>
         <th>EMAIL</th>
         <th>PHONE</th>
       </tr>
      </thead>
      <tbody>
        <tr>
           <td>${escapeHtml(customerName)}</td>
           <td>${escapeHtml(customerEmail)}</td>
           <td>${escapeHtml(customerMobile)}</td>
        </tr>
      </tbody>
    </table>
    <div class="service-info-card">

      <div class="service-info-col">
         <div class="service-info-title">
            DESCRIPTION
         </div>

         <div class="service-info-body">
           <strong>Hydrogen Session</strong><br>
           Personalized health consultation and
           comprehensive wellness assessment.
         </div>
      </div>

      <div class="service-info-col">
        <div class="service-info-title">
            SERVICE DETAILS
        </div>
        <div class="service-info-body">

            <li>One-on-one consultation</li>
            <li>Health evaluation</li>
            <li>Personalized wellness guidance</li>
            <li>Post-session support</li>
        </div>
      </div>

    </div>
    

    <table class="invoice-service-table">
      <thead>
        <tr>
          <th>S.N0</th>
          <th>DESCRIPTION</th>
          <th>QYT</th>
          <th class="right">UNIT PRICE</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${invoiceRowsHtml}
      </tbody>
      
    </table>
    <div class="invoice-bottom-section">
      <div class="invoice-bottom-left">
        <div class="amount-words">
          <strong>Amount in Words:</strong><br>
          Nine Thousand Five Hundred Only
        </div>
        <div class="invoice-notes">
           <strong>Notes:</strong>
             <ul>
              <li>Payment to be made within 15 days from the date of invoice.</li>
              <li>Please quote the invoice number while making the payment.</li>
             </ul>
        </div>
      </div>
      <div class="summary-box">
       <div class="summary-row">
         <span>Sub Total</span>
         <span>
            Rs. ${Number((amountInr || 0) - (gstAmountInr || 0)).toLocaleString('en-IN')}
         </span>
       </div>
       <div class="summary-row">
         <span>CGST (9%)</span>
         <span>
           Rs. ${Number((gstAmountInr || 0) / 2).toLocaleString('en-IN')}
         </span>
       </div>
       <div class="summary-row">
         <span>SGST (9%)</span>
         <span>
           Rs. ${Number((gstAmountInr || 0) / 2).toLocaleString('en-IN')}
         </span>
       </div>
       <div class="summary-row summary-total">
         <span>TOTAL</span>
         <span>
            Rs. ${Number(amountInr || 0).toLocaleString('en-IN')}
         </span>
       </div>
      </div>
    </div>
    
    
  </div>
</body>
</html>`;
  return sendInvoiceResponse(req, res, invoiceHtml, invoiceNo);
});

app.get('/invoice/membership', async (req, res) => {
  const access = verifyInvoiceAccessToken(req.query?.token);
  if (!access || access.scope !== 'membership_invoice' || !access.orderId || !Number.isInteger(access.userId)) {
    return res.status(400).send('Invalid or expired invoice link');
  }

  const order = db
    .prepare(
      `SELECT order_id AS orderId,
              user_id AS userId,
              plan_id AS planId,
              people_count AS peopleCount,
              original_amount_paise AS originalAmountPaise,
              amount_paise AS amountPaise,
              discount_amount_paise AS discountAmountPaise,
              coupon_code AS couponCode,
              status,
              payment_reference AS paymentReference,
              paid_at AS paidAt,
              created_at AS createdAt
       FROM membership_payment_orders
       WHERE order_id = ?`
    )
    .get(access.orderId);

  if (!order || Number(order.userId) !== Number(access.userId)) {
    return res.status(404).send('Invoice not found');
  }
  if (String(order.status || '').trim().toLowerCase() !== 'paid') {
    return res.status(409).send('Invoice is available only for paid membership orders');
  }

  const user = getUserById(order.userId);
  const invoiceNo = `MB-${escapeHtml(order.orderId)}`;
  const paidAtLabel = formatInvoiceDateTime(order.paidAt);
  const generatedAtLabel = formatInvoiceDateTime(new Date());
  const originalAmountInr = Math.round(Number(order.originalAmountPaise || 0) / 100);
  const discountInr = Math.round(Number(order.discountAmountPaise || 0) / 100);
  const taxableAmountInr = Math.max(0, originalAmountInr - discountInr);
  const gstAmountInr = Math.max(0, Math.round((taxableAmountInr * GST_RATE_PERCENT) / 100));
  const amountInr = taxableAmountInr + gstAmountInr;

  const invoiceHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Membership Invoice ${invoiceNo}</title>
  <style>
    :root{--ink:#111;--muted:#444;--line:#e8e8f0}
    html,body{min-height:100%;height:auto;overflow-y:auto}
    body{
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;
      margin:0;
      color:var(--ink);
      background:#f3f3f7;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .page{
      width:min(240mm, calc(100% - 24px));
      min-height:320mm;
      margin:18px auto;
      box-sizing:border-box;
      background:#fff url('/booking/assets/invoice-page.png') no-repeat top center;
      background-size:100% 100%;
      padding:46mm 18mm 18mm 18mm;
      box-shadow:0 10px 32px rgba(0,0,0,.10);
      overflow:visible;
    }
    .row{display:flex;gap:16px;justify-content:space-between;align-items:flex-start;flex-wrap:wrap}
    .title{font-size:18px;margin:0 0 4px;letter-spacing:.02em}
    .muted{color:var(--muted);font-size:13px;line-height:1.35}
    .gst{margin-top:6px}
    .gst-space{display:inline-block;min-width:240px;border-bottom:1px solid #777;transform:translateY(-2px)}
    table{width:100%;border-collapse:collapse;margin-top:18px}
    th,td{border-bottom:1px solid var(--line);padding:10px 8px;text-align:left;font-size:14px;vertical-align:top}
    th{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
    .right{text-align:right}
    .total{font-weight:700;font-size:16px}
    .summary-box{
       width:320px;
       margin-left:auto;
       margin-top:20px;
       border:1px solid #d7b5a2;
       flex-shrink:0;
      }
    .summary-row{
       display:flex;
       justify-content:space-between;
       padding:10px 16px;
       border-bottom:1px solid #e5d4cb;
    }
    .summary-total{
      background:#AE5431;
      color:#fff;
      font-weight:700;
    }
    .amount-words{margin-top:60px;font-size:16px;}
    .amount-words strong{color:#AE5431;}
    .amount-words{clear:both;margin-top:50px;}
    .invoice-notes strong{color:#AE5431;}
    .invoice-notes ol{margin-top:10px;padding-left:22px;}
    .invoice-notes{margin-top:24px;margin-bottom:120px;}
    .invoice-company-footer{
        display:grid;
        margin-top:180px;
        padding-top:20px;
        border-top:1px solid #d7b5a2;
        clear:both;
        gap:40px;
        grid-template-columns:1fr 1fr;
    }
    .invoice-company-footer div{word-break:break-word;}
    .footer{margin-top:24px}
    @media screen and (max-width:700px){
      html,body{height:auto;min-height:100%}
      body{background:#fff}
      .page{
        width:100%;
        min-height:calc(100vw * 1448 / 1086);
        margin:0;
        padding:132px 16px 24px;
        box-shadow:none;
        background-size:100% 100%;
      }
      .summary-box{width:100%;margin-left:0}
      .invoice-company-footer{grid-template-columns:1fr;margin-top:72px;gap:18px}
      .invoice-company-footer div{text-align:left !important}
      .row{display:block}
      .row > div{max-width:100%;overflow-wrap:anywhere}
      .row > div + div{margin-top:18px}
      .title{font-size:17px}
      .muted{font-size:12px}
      .gst-space{display:block;min-width:0;width:100%;max-width:260px;margin-top:4px;transform:none}
      table{table-layout:fixed;margin-top:16px}
      th,td{padding:9px 5px;font-size:12px;overflow-wrap:anywhere}
      th{font-size:10px;letter-spacing:.03em}
      .total{font-size:14px}
    }
    @media print{
      body{background:#fff}
      .page{width:240mm;margin:0;box-shadow:none}
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="row">
      <div>
        <h1 class="title">Membership Invoice</h1>
        <div class="muted">Invoice No: ${invoiceNo}</div>
        ${paidAtLabel ? `<div class="muted">Paid at: ${escapeHtml(paidAtLabel)}</div>` : ''}
      </div>
      <div>
        <div class="muted"><strong>Customer</strong></div>
        <div>${escapeHtml(user?.name || '')}</div>
        <div class="muted">${escapeHtml(user?.email || '')}</div>
        <div class="muted">${escapeHtml(user?.mobile || '')}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Plan</th>
          <th>Members</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(String(order.planId || 'Membership'))}</td>
          <td>${escapeHtml(String(order.peopleCount || 1))}</td>
          <td class="right">Rs. ${Number(originalAmountInr || 0).toLocaleString('en-IN')}</td>
        </tr>
        ${discountInr > 0 ? `<tr><td colspan="2">Discount ${order.couponCode ? `(${escapeHtml(String(order.couponCode))})` : ''}</td><td class="right">- Rs. ${discountInr.toLocaleString('en-IN')}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="summary-box">
      <div class="summary-row">
        <span>Sub Total</span>
        <span>
           Rs. ${Number((amountInr || 0) - (gstAmountInr || 0)).toLocaleString('en-IN')}
        </span>
      </div>

      <div class="summary-row">
         <span>CGST (9%)</span>
         <span>
            Rs. ${Number((gstAmountInr || 0)/2).toLocaleString('en-IN')}
         </span>
      </div>

      <div class="summary-row">
         <span>SGST (9%)</span>
         <span>
             Rs. ${Number((gstAmountInr || 0)/2).toLocaleString('en-IN')}
          </span>
      </div>

      <div class="summary-row summary-total">
         <span>Total</span>
         <span>
           Rs. ${Number(amountInr || 0).toLocaleString('en-IN')}
         </span>
       </div>
    </div>
    <div class="summary-box">
      <div class="summary-row">
        <span>Sub Total</span>
        <span>
           Rs. ${Number((amountInr || 0) - (gstAmountInr || 0)).toLocaleString('en-IN')}
        </span>
      </div>
      <div class="summary-row">
         <span>CGST (9%)</span>
         <span>
           Rs. ${Number((gstAmountInr || 0)/2).toLocaleString('en-IN')}
         </span>
      </div>
      <div class="summary-row">
       <span>SGST (9%)</span>
       <span>
         Rs. ${Number((gstAmountInr || 0)/2).toLocaleString('en-IN')}
       </span>
      </div>
      <div class="summary-row summary-total">
        <span>Total</span>
        <span>
          Rs. ${Number(amountInr || 0).toLocaleString('en-IN')}
        </span>
      </div>
    </div>
    <div class="invoice-company-footer">
      <div>
        <strong>P:</strong> 91000 56979, 91000 86979<br>
        <strong>E:</strong> hello@h2houseofhealth.com
      </div>
      <div style="text-align:right;">
          <strong>A:</strong> 47A Journalist Colony,<br>
          Jubilee Hills, Hyderabad - 500033<br>
          <strong>W:</strong> www.h2houseofhealth.com
      </div>
    </div>
  </div>
</body>
</html>`;
  return sendInvoiceResponse(req, res, invoiceHtml, invoiceNo);
});

app.post('/api/payments/verify', requireAuth, async (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  const razorpayOrderId = String(req.body?.razorpay_order_id || '');
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
  const razorpaySignature = String(req.body?.razorpay_signature || '');

  if (!razorpay || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }

  if (!Number.isInteger(bookingId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment verification payload' });
  }

  const booking = db
    .prepare(
      'SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, payment_order_id AS paymentOrderId FROM bookings WHERE id = ?'
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, booking.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (booking.paymentOrderId && booking.paymentOrderId !== razorpayOrderId) {
    return res.status(400).json({ message: 'Order mismatch' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  const paymentMethod = await getRazorpayPaymentMethod(razorpayPaymentId);

  if (booking.bookingGroupId) {
    const groupBookings = db
      .prepare(
        `SELECT id
         FROM bookings
         WHERE booking_group_id = ?
           AND status <> 'cancelled'
           AND payment_status <> 'paid'`
      )
      .all(booking.bookingGroupId);

    db.prepare(
      `UPDATE bookings
       SET payment_status = 'paid',
           paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
           payment_order_id = CASE WHEN ? <> '' THEN ? ELSE payment_order_id END,
           payment_reference = CASE WHEN ? <> '' THEN ? ELSE payment_reference END,
           payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
           status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
       WHERE booking_group_id = ?
         AND status <> 'cancelled'
         AND payment_status <> 'paid'`
    ).run(razorpayOrderId, razorpayOrderId, razorpayPaymentId, razorpayPaymentId, paymentMethod, paymentMethod, booking.bookingGroupId);

    return res.json({ bookingId, paid: true, bookingCount: groupBookings.length });
  }

  markBookingPaid(bookingId, razorpayOrderId, razorpayPaymentId, paymentMethod);
  return res.json({ bookingId, paid: true });
});

app.post('/api/payments/verify-cart', requireAuth, async (req, res) => {
  const razorpayOrderId = String(req.body?.razorpay_order_id || '');
  const razorpayPaymentId = String(req.body?.razorpay_payment_id || '');
  const razorpaySignature = String(req.body?.razorpay_signature || '');

  if (!razorpay || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ message: RAZORPAY_UNAVAILABLE_MESSAGE });
  }
  if (req.user.role !== 'user') {
    return res.status(403).json({ message: 'forbidden' });
  }
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment verification payload' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ message: 'Invalid payment signature' });
  }

  const paymentMethod = await getRazorpayPaymentMethod(razorpayPaymentId);

  const cartOrder = db
    .prepare(
      `SELECT order_id AS orderId,
              user_id AS userId,
              coupon_id AS couponId,
              coupon_code AS couponCode,
              discount_amount_paise AS discountAmountPaise,
              amount_paise AS amountPaise
       FROM cart_payment_orders
       WHERE order_id = ?`
    )
    .get(razorpayOrderId);
  if (!cartOrder || Number(cartOrder.userId) !== Number(req.user.id)) {
    return res.status(404).json({ message: 'Cart payment order not found.' });
  }

  const matchedBookings = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus
       FROM bookings
       WHERE user_id = ?
         AND payment_order_id = ?
         AND status <> 'cancelled'
         AND payment_status <> 'paid'
       ORDER BY booking_date, booking_time, id`
    )
    .all(req.user.id, razorpayOrderId);

  if (!matchedBookings.length) {
    return res.status(404).json({ message: 'No payable bookings found for this payment order.' });
  }
  if (Number(cartOrder.couponId || 0) > 0) {
    const couponLimitError = validateCouponRedemptionLimit(Number(cartOrder.couponId), req.user.id);
    if (couponLimitError) {
      return res.status(409).json({ message: couponLimitError });
    }
  }

  const pricingUser = {
    membershipStatus: req.user.membershipStatus || 'inactive',
    membershipExpiresAt: req.user.membershipExpiresAt || null,
    mobile: req.user.mobile || '',
  };
  const summary = applyOneUseAdminPhoneDiscountToSummary(
    matchedBookings,
    pricingUser,
    buildAggregatePaymentSummary(matchedBookings, pricingUser)
  );

  db.prepare(
    `UPDATE bookings
     SET payment_status = 'paid',
         paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
         payment_order_id = CASE WHEN ? <> '' THEN ? ELSE payment_order_id END,
         payment_reference = CASE
           WHEN LOWER(COALESCE(payment_reference, '')) IN ('membership', 'buy_extra') THEN payment_reference
           WHEN ? <> '' THEN ?
           ELSE payment_reference
         END,
         is_topup_session = CASE
           WHEN LOWER(COALESCE(payment_reference, '')) = 'buy_extra' THEN 1
           ELSE COALESCE(is_topup_session, 0)
         END,
         payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
         status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
     WHERE user_id = ?
       AND payment_order_id = ?
       AND status <> 'cancelled'
       AND payment_status <> 'paid'`
  ).run(razorpayOrderId, razorpayOrderId, razorpayPaymentId, razorpayPaymentId, paymentMethod, paymentMethod, req.user.id, razorpayOrderId);

  db.prepare(
    `UPDATE cart_payment_orders
     SET status = 'paid',
         payment_reference = ?,
         paid_at = datetime('now')
     WHERE order_id = ?`
  ).run(razorpayPaymentId, razorpayOrderId);

  if (Number(cartOrder.couponId || 0) > 0 && Number(cartOrder.discountAmountPaise || 0) > 0) {
    recordCouponRedemption({
      couponId: Number(cartOrder.couponId),
      userId: req.user.id,
      contextType: 'cart',
      contextRef: razorpayOrderId,
      discountAmountPaise: Number(cartOrder.discountAmountPaise || 0),
    });
  }
  if (matchedBookings.length) {
    consumeAdminDiscountForBooking(req.user.id, matchedBookings[0].id);
  }

  const paidAmountPaise = Number.isFinite(Number(cartOrder.amountPaise))
    ? Number(cartOrder.amountPaise)
    : Math.max(0, Math.round(Number(summary.totalAmountInr || 0) * 100) - Number(cartOrder.discountAmountPaise || 0));

  return res.json({
    paid: true,
    bookingCount: matchedBookings.length,
    unitCount: Number(summary.unitCount || 0),
    totalAmountInr: Math.round(paidAmountPaise / 100),
    discountAmountInr: Math.round(Number(cartOrder.discountAmountPaise || 0) / 100),
    originalAmountInr: Number(summary.totalAmountInr || 0),
    coupon: serializeAppliedCouponFromOrder(cartOrder),
  });
});

app.patch('/api/bookings/:id/status', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  const status = normalizeBookingStatus(req.body?.status);

  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  if (!isValidStatus(status)) {
    return res.status(400).json({
      message: `invalid status: ${String(req.body?.status ?? '').trim() || '(empty)'}`,
      allowedStatuses: BOOKING_STATUSES,
    });
  }

  const existing = db
    .prepare(
      'SELECT id, user_id AS userId, status, payment_status AS paymentStatus, booking_group_id AS bookingGroupId, booking_date AS bookingDate, booking_time AS bookingTime, notes FROM bookings WHERE id = ?'
    )
    .get(bookingId);

  if (!existing) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, existing.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (req.user.role !== 'admin' && ['completed', 'cancelled'].includes(String(existing.status || '').trim().toLowerCase())) {
    return res.status(409).json({ message: 'completed/cancelled booking cannot be moved to schedule later' });
  }

  if (req.user.role !== 'admin' && !['cancelled', 'schedule_later'].includes(status)) {
    return res.status(403).json({ message: 'only admin can set this status' });
  }

  if (req.user.role !== 'admin' && status === 'schedule_later' && String(existing.paymentStatus || '').trim().toLowerCase() !== 'paid') {
    return res.status(409).json({ message: 'Only paid bookings can be moved to Schedule Later.' });
  }

  const existingStatus = String(existing.status || '').trim().toLowerCase();
  const existingNotesLower = String(existing.notes || '').toLowerCase();
  if (status === 'schedule_later') {
    if (['completed', 'cancelled', 'schedule_later'].includes(existingStatus)) {
      return res.status(409).json({ message: 'This session is already completed, cancelled, or waiting to be scheduled.' });
    }
    if (!['booked', 'confirmed'].includes(existingStatus)) {
      return res.status(409).json({ message: 'Only booked sessions can be moved to Schedule Later.' });
    }
    if (String(existing.paymentStatus || '').trim().toLowerCase() !== 'paid') {
      return res.status(409).json({ message: 'Only paid bookings can be moved to Schedule Later.' });
    }
    const normalizedExistingTime = normalizeSlotStartTime(String(existing.bookingTime || '').trim()) || String(existing.bookingTime || '').trim();
    const slotStart = new Date(`${String(existing.bookingDate || '').trim()}T${normalizedExistingTime}:00`).getTime();
    if (!Number.isFinite(slotStart)) {
      return res.status(409).json({ message: 'Current booking slot is invalid.' });
    }
    if (req.user.role === 'admin') {
      const adminScheduleLaterWindowMs = 15 * 60 * 1000;
      if (Date.now() > slotStart + adminScheduleLaterWindowMs) {
        return res.status(409).json({ message: 'Admin can move a session to Schedule Later only until 15 minutes after slot start.' });
      }
    } else {
      const scheduleLaterCutoffMs = 12 * 60 * 60 * 1000;
      if (Date.now() > slotStart - scheduleLaterCutoffMs) {
        return res.status(409).json({ message: 'Schedule Later can be used only up to 12 hours before slot start.' });
      }
    }
    if (existingNotesLower.includes('moved to schedule later by user') || existingNotesLower.includes('moved to schedule later by admin')) {
      return res.status(409).json({ message: 'Schedule Later can be used only once for this session.' });
    }
  }

  if (status === 'confirmed' && existing.paymentStatus !== 'paid') {
    return res.status(400).json({ message: 'booking must be paid before confirming' });
  }

  if (status === 'cancelled' && existing.bookingGroupId) {
    db.prepare('UPDATE bookings SET status = ? WHERE booking_group_id = ?').run(status, existing.bookingGroupId);
  } else if (status === 'schedule_later') {
    const actorLabel = req.user.role === 'admin' ? 'admin' : 'user';
    const scheduleLaterNote = `Moved to Schedule Later by ${actorLabel} from ${existing.bookingDate} ${existing.bookingTime}`;
    const nextNotes = [String(existing.notes || '').trim(), scheduleLaterNote].filter(Boolean).join('\n');
    db.prepare('UPDATE bookings SET status = ?, notes = ? WHERE id = ?').run(status, nextNotes, bookingId);
  } else {
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, bookingId);
  }
  if (status === 'cancelled' || status === 'schedule_later') {
    const targetUser = getUserProfileById(Number(existing.userId));
    if (targetUser) {
      syncMembershipForUser({ userId: Number(existing.userId) });
      syncMembershipCoveredHydrogenBookings(Number(existing.userId), targetUser);
    }
  }
  res.status(204).send();
});

app.patch('/api/bookings/:id/mark-paid-cash', requireAuth, requireAdmin, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              payment_reference AS paymentReference,
              is_topup_session AS isTopUpSession,
              created_at AS createdAt
       FROM bookings
       WHERE id = ?`
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const bookingStatus = String(booking.status || '').trim().toLowerCase();
  if (bookingStatus === 'cancelled') {
    return res.status(409).json({ message: 'cannot accept cash for a cancelled booking' });
  }

  const targetGroupId = String(booking.bookingGroupId || '').trim();
  if (targetGroupId) {
    const groupBookings = db
      .prepare(
        `SELECT id,
                user_id AS userId,
                booking_group_id AS bookingGroupId,
                service_name AS serviceName,
                booking_date AS bookingDate,
                booking_time AS bookingTime,
                status,
                payment_status AS paymentStatus,
                payment_reference AS paymentReference,
                is_topup_session AS isTopUpSession,
                created_at AS createdAt
         FROM bookings
         WHERE booking_group_id = ?
           AND status <> 'cancelled'
         ORDER BY booking_date, booking_time, id`
      )
      .all(targetGroupId);
    const targetUser = getUserProfileById(Number(booking.userId));
    try {
      const summary = buildHydrogenGroupPaymentSummary(groupBookings, targetUser || {});
      setPaymentAmountForBookings(groupBookings, Math.round(Number(summary.totalAmountInr || 0) * 100));
    } catch {
      // Keep cash marking available even if historical pricing cannot be reconstructed.
    }
    db.prepare(
      `UPDATE bookings
       SET payment_status = 'paid',
           paid_at = datetime('now'),
           payment_reference = 'cash',
           payment_method = 'cash',
           status = CASE
             WHEN status IN ('cancelled','completed') THEN status
             ELSE 'confirmed'
           END
       WHERE booking_group_id = ?
         AND status <> 'cancelled'`
    ).run(targetGroupId);
  } else {
    const targetUser = getUserProfileById(Number(booking.userId));
    const service = getServiceByName(booking.serviceName);
    const amountPaise =
      String(booking.paymentReference || '').trim().toLowerCase() === 'membership'
        ? 0
        : Math.round(Number(getEffectiveServicePriceInr(service, targetUser || {}) || 0) * 100);
    db.prepare(
      `UPDATE bookings
       SET payment_status = 'paid',
           paid_at = datetime('now'),
           paid_amount_paise = ?,
           payment_reference = 'cash',
           payment_method = 'cash',
           status = CASE
             WHEN status IN ('cancelled','completed') THEN status
             ELSE 'confirmed'
           END
       WHERE id = ?`
    ).run(amountPaise, bookingId);
  }

  const token = createInvoiceAccessToken({
    scope: 'booking_invoice',
    bookingId: booking.id,
    userId: booking.userId,
  });

  const invoiceUrl = `${getRequestOrigin(req)}/invoice/booking?token=${encodeURIComponent(token)}`;
  return res.json({
    paid: true,
    invoiceUrl,
    invoiceDownloadUrl: `${invoiceUrl}&format=pdf&download=1`,
  });
});

function getAdminRescheduleEligibility(booking) {
  const status = String(booking?.status || '').trim().toLowerCase();
  if (status === 'completed' || status === 'cancelled') {
    return { eligible: false, message: 'completed or cancelled sessions cannot be rescheduled here' };
  }
  if (status === 'schedule_later') {
    return { eligible: true, mode: 'schedule_later' };
  }
  const notes = String(booking?.notes || '').toLowerCase();
  const wasAlreadyRescheduled =
    Number(booking?.rescheduleCount || 0) > 0 ||
    notes.includes('rescheduled by admin from') ||
    notes.includes('rescheduled by user from') ||
    notes.includes('scheduled later by user from');
  if (wasAlreadyRescheduled) {
    return { eligible: false, message: 'this session was already rescheduled once and cannot be rescheduled again' };
  }
  const slotStart = new Date(`${booking.bookingDate}T${normalizeSlotStartTime(booking.bookingTime) || booking.bookingTime}:00`).getTime();
  if (!Number.isFinite(slotStart)) {
    return { eligible: false, message: 'booking slot is invalid' };
  }
  const now = Date.now();
  if (slotStart > now) {
    return { eligible: true, mode: 'upcoming' };
  }
  const missedWindowMs = 15 * 60 * 1000;
  if (now <= slotStart + missedWindowMs) {
    return { eligible: true, mode: 'missed' };
  }
  return { eligible: false, message: 'missed bookings can be rescheduled only within 15 minutes after the slot starts' };
}

function loadBookingForAdminReschedule(bookingId) {
  return db
    .prepare(
      `SELECT b.id,
              b.user_id AS userId,
              b.service_name AS serviceName,
              b.booking_date AS bookingDate,
              b.booking_time AS bookingTime,
              b.status,
              b.payment_status AS paymentStatus,
              b.reschedule_count AS rescheduleCount,
              b.notes,
              u.name,
              u.email,
              u.mobile,
              u.membership_status AS membershipStatus,
              u.membership_expires_at AS membershipExpiresAt
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .get(bookingId);
}

function validateAdminRescheduleTarget(booking, body) {
  const owner = {
    id: booking.userId,
    name: booking.name,
    email: booking.email,
    mobile: booking.mobile,
    membershipStatus: booking.membershipStatus,
    membershipExpiresAt: booking.membershipExpiresAt,
  };
  const payload = validateBookingPayload(
    {
      serviceName: booking.serviceName,
      bookingDate: body?.bookingDate,
      bookingTime: body?.bookingTime,
      notes: booking.notes || '',
    },
    owner
  );
  if (payload.error) return { error: payload.error };

  const selectedService = getServiceByName(booking.serviceName);
  if (selectedService && String(selectedService.category || '').toUpperCase() === 'HYDROGEN SESSION') {
    const dailyLimitConflict = validateHydrogenDailySessionLimit(
      booking.userId,
      [{ bookingDate: payload.data.bookingDate, bookingTime: payload.data.bookingTime }],
      [booking.id]
    );
    if (dailyLimitConflict) {
      return { error: `Only ${dailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`, statusCode: 409 };
    }
  }

  const slotStatus = getSlotCapacityStatus(booking.serviceName, payload.data.bookingDate, payload.data.bookingTime, booking.id);
  if (slotStatus.reached) {
    const message = slotStatus.holdTotal > 0
      ? buildHoldSlotMessage()
      : `This slot is full. Maximum ${slotStatus.maxPerSlot} bookings are allowed.`;
    return { error: message, statusCode: 409 };
  }

  return { data: payload.data };
}

app.post('/api/admin/bookings/:id/reschedule-otp', requireAuth, requireAdmin, async (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = loadBookingForAdminReschedule(bookingId);

  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const eligibility = getAdminRescheduleEligibility(booking);
  if (!eligibility.eligible) {
    return res.status(409).json({ message: eligibility.message });
  }

  if (!isValidEmail(booking.email)) {
    return res.status(409).json({ message: 'customer email is required for reschedule OTP verification' });
  }

  const target = validateAdminRescheduleTarget(booking, req.body || {});
  if (target.error) {
    return res.status(target.statusCode || 400).json({ message: target.error });
  }

  const otp = generateOtp();
  db.prepare(
    `INSERT INTO pending_booking_reschedules (booking_id, otp_hash, booking_date, booking_time, expires_at, attempts_left, created_at)
     VALUES (?, ?, ?, ?, ?, 5, datetime('now'))
     ON CONFLICT(booking_id) DO UPDATE SET
       otp_hash = excluded.otp_hash,
       booking_date = excluded.booking_date,
       booking_time = excluded.booking_time,
       expires_at = excluded.expires_at,
       attempts_left = 5,
       created_at = datetime('now')`
  ).run(
    booking.id,
    hashOtp(otp),
    target.data.bookingDate,
    target.data.bookingTime,
    new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString()
  );

  const mailResult = await sendOtpEmail(booking.email, otp, 'booking_reschedule');
  if (!mailResult.ok) {
    return res.status(mailResult.statusCode || 500).json({ message: mailResult.message || 'Unable to send reschedule OTP.' });
  }

  return res.json({
    otpRequired: true,
    message: mailResult.message || `Reschedule OTP sent to ${booking.email}. It expires in ${OTP_TTL_MINUTES} minutes.`,
  });
});

app.patch('/api/admin/bookings/:id/reschedule-missed', requireAuth, requireAdmin, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const booking = loadBookingForAdminReschedule(bookingId);
  if (!booking) {
    return res.status(404).json({ message: 'booking not found' });
  }

  const eligibility = getAdminRescheduleEligibility(booking);
  if (!eligibility.eligible) {
    return res.status(409).json({ message: eligibility.message });
  }

  const pending = db
    .prepare(
      `SELECT booking_id AS bookingId,
              otp_hash AS otpHash,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              expires_at AS expiresAt,
              attempts_left AS attemptsLeft
       FROM pending_booking_reschedules
       WHERE booking_id = ?`
    )
    .get(booking.id);
  if (!pending) {
    return res.status(400).json({ message: 'request a reschedule OTP before confirming' });
  }
  if (new Date(pending.expiresAt).getTime() < Date.now()) {
    db.prepare('DELETE FROM pending_booking_reschedules WHERE booking_id = ?').run(booking.id);
    return res.status(400).json({ message: 'OTP expired. Request a new reschedule OTP.' });
  }
  const otp = String(req.body?.otp || '').trim();
  if (!otp) {
    return res.status(400).json({ message: 'otp is required' });
  }
  if (hashOtp(otp) !== pending.otpHash) {
    const attemptsLeft = Math.max(0, Number(pending.attemptsLeft || 0) - 1);
    if (attemptsLeft <= 0) {
      db.prepare('DELETE FROM pending_booking_reschedules WHERE booking_id = ?').run(booking.id);
      return res.status(400).json({ message: 'Too many invalid OTP attempts. Request a new reschedule OTP.' });
    }
    db.prepare('UPDATE pending_booking_reschedules SET attempts_left = ? WHERE booking_id = ?').run(attemptsLeft, booking.id);
    return res.status(400).json({ message: `Invalid OTP. ${attemptsLeft} attempts left.` });
  }

  const requestedDate = String(req.body?.bookingDate || '').trim();
  const requestedTime = normalizeSlotStartTime(String(req.body?.bookingTime || '').trim());
  if (requestedDate !== pending.bookingDate || requestedTime !== pending.bookingTime) {
    return res.status(400).json({ message: 'selected slot changed after OTP was sent. Request a new OTP.' });
  }

  const target = validateAdminRescheduleTarget(booking, {
    bookingDate: pending.bookingDate,
    bookingTime: pending.bookingTime,
  });
  if (target.error) {
    return res.status(target.statusCode || 400).json({ message: target.error });
  }

  const rescheduleNote = `Rescheduled by admin from ${booking.bookingDate} ${booking.bookingTime} to ${target.data.bookingDate} ${target.data.bookingTime}`;
  const nextNotes = [String(booking.notes || '').trim(), rescheduleNote].filter(Boolean).join('\n');

  db.prepare(
    `UPDATE bookings
     SET booking_date = ?,
         booking_time = ?,
         status = 'confirmed',
         notes = ?
     WHERE id = ?`
  ).run(target.data.bookingDate, target.data.bookingTime, nextNotes, booking.id);
  db.prepare('DELETE FROM pending_booking_reschedules WHERE booking_id = ?').run(booking.id);

  const updated = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              notes
       FROM bookings
       WHERE id = ?`
    )
    .get(booking.id);

  return res.json({ booking: updated });
});

app.post('/api/bookings/:id/pay', requireAuth, (req, res) => {
  return res.status(410).json({ message: 'Use /api/payments/create-order and /api/payments/verify for Razorpay.' });
});

app.delete('/api/bookings/:id', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isInteger(bookingId)) {
    return res.status(400).json({ message: 'invalid booking id' });
  }

  const existing = db
    .prepare('SELECT id, user_id AS userId, booking_group_id AS bookingGroupId FROM bookings WHERE id = ?')
    .get(bookingId);

  if (!existing) {
    return res.status(404).json({ message: 'booking not found' });
  }

  if (!canAccessBooking(req.user, existing.userId)) {
    return res.status(403).json({ message: 'forbidden' });
  }

  if (existing.bookingGroupId) {
    db.prepare('DELETE FROM bookings WHERE booking_group_id = ?').run(existing.bookingGroupId);
  } else {
    db.prepare('DELETE FROM bookings WHERE id = ?').run(bookingId);
  }
  res.status(204).send();
});

app.get(/^\/booking(?:\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(WEBSITE_ROOT));

app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(WEBSITE_ROOT, 'index.html'));
});

const HOST = normalizeEnvValue(process.env.HOST || (IS_PRODUCTION ? '0.0.0.0' : '127.0.0.1'));
const BASE_PORT = Number(PORT) || 3000;
const MAX_PORT_TRIES = 10;

function logMailerConfiguration() {
  if (SENDGRID_API_KEY && SENDGRID_OTP_FROM_EMAIL && SENDGRID_BOOKING_FROM_EMAIL) {
    console.log(`SendGrid OTP mailer configured with sender ${SENDGRID_OTP_FROM_EMAIL}`);
    console.log(`SendGrid booking mailer configured with sender ${SENDGRID_BOOKING_FROM_EMAIL}`);
  } else {
    console.warn(
      'SendGrid mailers are not fully configured. Check SENDGRID_API_KEY, SENDGRID_OTP_FROM_EMAIL, and SENDGRID_BOOKING_FROM_EMAIL.'
    );
  }
}

function startServer(port, triesLeft = MAX_PORT_TRIES) {
  const server = app.listen(port, HOST, () => {
    const hostLabel = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`Server listening on http://${hostLabel}:${port}`);
    if (hostLabel !== '127.0.0.1') {
      console.log(`Server listening on http://127.0.0.1:${port}`);
    }
    if (port !== BASE_PORT) {
      console.log(`Port ${BASE_PORT} was busy. Using fallback port ${port}.`);
    }
    logMailerConfiguration();
  });

  server.on('error', (error) => {
    const code = String(error?.code || '');
    if (code === 'EADDRINUSE' && triesLeft > 0) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Retrying on ${nextPort}...`);
      return startServer(nextPort, triesLeft - 1);
    }
    console.error('Server failed to start:', error?.message || error);
  });

  server.on('close', () => {
    console.error('Server closed.');
  });

  return server;
}

startServer(BASE_PORT);

function canAccessBooking(user, ownerId) {
  return user.role === 'admin' || user.id === Number(ownerId);
}

function getUserById(userId) {
  if (!Number.isInteger(Number(userId))) return null;
  return db
    .prepare(
      `SELECT id, role, name, email, mobile,
              membership_status AS membershipStatus,
              membership_expires_at AS membershipExpiresAt,
              membership_people_count AS membershipPeopleCount
       FROM users
       WHERE id = ?`
    )
    .get(Number(userId));
}

function getUserByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  return db
    .prepare(
      `SELECT id, role, name, email, mobile,
              membership_status AS membershipStatus,
              membership_expires_at AS membershipExpiresAt,
              membership_people_count AS membershipPeopleCount
       FROM users
       WHERE email = ?`
    )
    .get(normalizedEmail);
}
function transferGuestBookingsToUserByEmail(email, userId) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const numericUserId = Number(userId);
  if (!normalizedEmail || !Number.isInteger(numericUserId) || numericUserId <= 0) {
    return 0;
  }

  const guestUserId = ensureGuestBookingOwnerUser();
  if (!Number.isInteger(guestUserId) || guestUserId <= 0 || guestUserId === numericUserId) {
    return 0;
  }

  const result = db
    .prepare(
      `UPDATE bookings
       SET user_id = ?
       WHERE user_id = ?
         AND LOWER(COALESCE(guest_email, '')) = ?`
    )
    .run(numericUserId, guestUserId, normalizedEmail);

  return Number(result?.changes || 0);
}
function normalizeDiscountPhoneKey(phone) {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (digits.length < 7) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function getDiscountPercentForPhone(phone) {
  const phoneKey = normalizeDiscountPhoneKey(phone);
  if (!phoneKey) return 0;
  const row = db
    .prepare(
      `SELECT discount_percent AS discountPercent
       FROM admin_discount_phones
       WHERE phone_key = ?
         AND redeemed_at IS NULL`
    )
    .get(phoneKey);
  const percent = Number(row?.discountPercent || 0);
  if (!Number.isFinite(percent) || percent <= 0) return 0;
  return Math.min(100, percent);
}

function consumeAdminDiscountForBooking(userId, bookingId) {
  const user = getUserById(userId);
  const phoneKey = normalizeDiscountPhoneKey(user?.mobile || '');
  if (!phoneKey || !Number.isInteger(Number(bookingId))) return;

  db.prepare(
    `UPDATE admin_discount_phones
     SET redeemed_at = datetime('now'),
         redeemed_booking_id = ?
     WHERE phone_key = ?
       AND redeemed_at IS NULL`
  ).run(Number(bookingId), phoneKey);
}

function applyPhoneDiscount(amountInr, phone) {
  const baseAmount = Number(amountInr || 0);
  if (!Number.isFinite(baseAmount) || baseAmount <= 0) return 0;
  const discountPercent = getDiscountPercentForPhone(phone);
  if (discountPercent <= 0) return baseAmount;
  return Math.max(0, Math.round(baseAmount * (1 - discountPercent / 100)));
}

function normalizeCouponCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9_-]/g, '');
}

function generateCouponCode(prefix = 'H2') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(8);
  const suffix = Array.from(bytes)
    .map((value) => alphabet[value % alphabet.length])
    .join('');
  return prefix ? `${prefix}-${suffix}` : suffix;
}

function parseCouponUsedBy(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => String(entry || '').trim().toLowerCase())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function mapCouponRow(row) {
  const couponType = String(row?.couponType || '').trim().toLowerCase() === 'private' ? 'private' : 'public';
  const assignedUserEmail = String(row?.assignedUserEmail || row?.recipientEmail || '').trim().toLowerCase();
  const validTill = row?.validTill || row?.expiresAt || null;
  const isActiveFlag = row?.isActive == null ? Number(row?.active || 0) === 1 : Number(row?.isActive || 0) === 1;
  const usedBy = parseCouponUsedBy(row?.usedBy);
  return {
    id: Number(row.id),
    code: row.code || '',
    description: row.description || '',
    discountType: row.discountType || 'flat',
    discountValue: Number(row.discountValue || 0),
    appliesTo: row.appliesTo || 'all',
    maxRedemptions: row.maxRedemptions == null ? null : Number(row.maxRedemptions),
    perUserLimit: Number(row.perUserLimit || 1),
    expiresAt: row.expiresAt || null,
    active: isActiveFlag,
    recipientEmail: row.recipientEmail || assignedUserEmail || '',
    recipientName: row.recipientName || '',
    festivalName: row.festivalName || '',
    emailedAt: row.emailedAt || null,
    emailStatus: row.emailStatus || '',
    emailError: row.emailError || '',
    createdAt: row.createdAt || null,
    couponType,
    assignedUserEmail,
    usedBy,
    isActive: isActiveFlag,
    validFrom: row.validFrom || null,
    validTill,
  };
}

function getCouponByCode(code) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return null;
  const row = db
    .prepare(
      `SELECT id,
              code,
              description,
              discount_type AS discountType,
              discount_value AS discountValue,
              applies_to AS appliesTo,
              max_redemptions AS maxRedemptions,
              per_user_limit AS perUserLimit,
              expires_at AS expiresAt,
              active,
              coupon_type AS couponType,
              assigned_user_email AS assignedUserEmail,
              used_by AS usedBy,
              is_active AS isActive,
              valid_from AS validFrom,
              valid_till AS validTill,
              recipient_email AS recipientEmail,
              recipient_name AS recipientName,
              festival_name AS festivalName,
              emailed_at AS emailedAt,
              email_status AS emailStatus,
              email_error AS emailError,
              created_at AS createdAt
       FROM coupons
       WHERE code = ?`
    )
    .get(normalizedCode);
  if (!row) return null;
  return mapCouponRow(row);
}

function getCouponById(couponId) {
  const id = Number(couponId);
  if (!Number.isInteger(id)) return null;
  const row = db
    .prepare(
      `SELECT id,
              code,
              description,
              discount_type AS discountType,
              discount_value AS discountValue,
              applies_to AS appliesTo,
              max_redemptions AS maxRedemptions,
              per_user_limit AS perUserLimit,
              expires_at AS expiresAt,
              active,
              coupon_type AS couponType,
              assigned_user_email AS assignedUserEmail,
              used_by AS usedBy,
              is_active AS isActive,
              valid_from AS validFrom,
              valid_till AS validTill,
              recipient_email AS recipientEmail,
              recipient_name AS recipientName,
              festival_name AS festivalName,
              emailed_at AS emailedAt,
              email_status AS emailStatus,
              email_error AS emailError,
              created_at AS createdAt
       FROM coupons
       WHERE id = ?`
    )
    .get(id);
  if (!row) return null;
  return mapCouponRow(row);
}

function generateUniqueCouponCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const candidate = generateCouponCode('H2');
    if (!getCouponByCode(candidate)) return candidate;
  }
  return generateCouponCode(`H2${Date.now().toString(36).toUpperCase()}`);
}

function getCouponRedemptionStats(couponId, userId) {
  const totals = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS userTotal
       FROM coupon_redemptions
       WHERE coupon_id = ?`
    )
    .get(Number(userId), Number(couponId));
  return {
    total: Number(totals?.total || 0),
    userTotal: Number(totals?.userTotal || 0),
  };
}

function calculateCouponDiscountPaise(coupon, subtotalAmountPaise) {
  const subtotal = Math.max(0, Math.round(Number(subtotalAmountPaise || 0)));
  if (!coupon || subtotal <= 0) return 0;

  let discountPaise = 0;
  if (coupon.discountType === 'flat') {
    discountPaise = Math.round(Number(coupon.discountValue || 0) * 100);
  } else {
    discountPaise = Math.round(subtotal * (Number(coupon.discountValue || 0) / 100));
  }

  if (!Number.isFinite(discountPaise) || discountPaise <= 0) return 0;
  return Math.min(discountPaise, Math.max(0, subtotal - 100));
}

function validateCouponForUser({ code, userId, appliesTo, subtotalAmountPaise, singleBookingAmountPaise }) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    return {
      coupon: null,
      couponCode: '',
      discountAmountPaise: 0,
      finalAmountPaise: Math.max(0, Math.round(Number(subtotalAmountPaise || 0))),
      originalAmountPaise: Math.max(0, Math.round(Number(subtotalAmountPaise || 0))),
    };
  }

  const coupon = getCouponByCode(normalizedCode);
  if (!coupon) {
    return { error: 'Invalid coupon code.' };
  }
  if (!coupon.active || !coupon.isActive) {
    return { error: 'This coupon is no longer active. Please remove it and try checkout again.' };
  }
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > Date.now()) {
    return { error: 'This coupon is not active yet.' };
  }
  if (coupon.validTill && new Date(coupon.validTill).getTime() <= Date.now()) {
    return { error: 'This coupon has expired.' };
  }
  if (!['all', appliesTo].includes(String(coupon.appliesTo || 'all'))) {
    return { error: 'This coupon is not valid for this payment.' };
  }
  const assignedEmail = String(coupon.assignedUserEmail || coupon.recipientEmail || '').trim().toLowerCase();
  if (coupon.couponType === 'private' || assignedEmail) {
    const user = getUserById(userId);
    const userEmail = String(user?.email || '').trim().toLowerCase();
    if (!userEmail || userEmail !== assignedEmail) {
      return { error: 'This coupon is assigned to another user.' };
    }
  }

  const user = getUserById(userId);
  const userEmail = String(user?.email || '').trim().toLowerCase();
  if (userEmail && Array.isArray(coupon.usedBy) && coupon.usedBy.includes(userEmail)) {
    return { error: 'You have already used this coupon.' };
  }

  const stats = getCouponRedemptionStats(coupon.id, userId);
  if (
    coupon.couponType === 'private' &&
    Number.isFinite(coupon.maxRedemptions) &&
    coupon.maxRedemptions > 0 &&
    stats.total >= coupon.maxRedemptions
  ) {
    return { error: 'This coupon has reached its maximum usage limit.' };
  }
  if (Number(coupon.perUserLimit || 1) > 0 && stats.userTotal >= Number(coupon.perUserLimit || 1)) {
    return { error: 'You have already used this coupon.' };
  }

  const isAssignedSingleBookingServiceCoupon =
    appliesTo === 'services' &&
    (coupon.couponType === 'private' || assignedEmail) &&
    Number(coupon.maxRedemptions || 0) === 1 &&
    Number(singleBookingAmountPaise || 0) > 0;
  const subtotalPaise = Math.max(0, Math.round(Number(subtotalAmountPaise || 0)));
  const discountBasePaise = Math.max(
    0,
    Math.round(Number(isAssignedSingleBookingServiceCoupon ? singleBookingAmountPaise : subtotalPaise || 0))
  );
  const discountAmountPaise = calculateCouponDiscountPaise(coupon, discountBasePaise);
  if (discountAmountPaise <= 0) {
    return { error: 'This coupon does not apply to the current payable amount.' };
  }

  return {
    coupon,
    couponCode: normalizedCode,
    originalAmountPaise: subtotalPaise,
    discountAmountPaise,
    finalAmountPaise: Math.max(100, subtotalPaise - discountAmountPaise),
  };
}

function serializeCouponPreview(result) {
  const finalAmountPaise = Math.max(0, Math.round(Number(result?.finalAmountPaise || 0)));
  const gstAmountPaise = Math.max(0, Math.round((finalAmountPaise * GST_RATE_PERCENT) / 100));
  return {
    code: result?.coupon?.code || result?.couponCode || '',
    description: result?.coupon?.description || '',
    discountType: result?.coupon?.discountType || '',
    appliesTo: result?.coupon?.appliesTo || '',
    originalAmountInr: Math.round(Number(result?.originalAmountPaise || 0) / 100),
    discountAmountInr: Math.round(Number(result?.discountAmountPaise || 0) / 100),
    gstAmountInr: Math.round(gstAmountPaise / 100),
    payableAmountInr: Math.round((finalAmountPaise + gstAmountPaise) / 100),
  };
}

function serializeAppliedCouponFromOrder(order) {
  const code = String(order?.couponCode || '').trim();
  const discountAmountInr = Math.round(Number(order?.discountAmountPaise || 0) / 100);
  if (!code && discountAmountInr <= 0) return null;
  return {
    code,
    discountAmountInr,
  };
}

function recordCouponRedemption({ couponId, userId, contextType, contextRef, discountAmountPaise }) {
  if (!Number.isInteger(Number(couponId)) || !Number.isInteger(Number(userId))) return;
  const normalizedContextRef = String(contextRef || '').trim();
  const exists = db
    .prepare(
      `SELECT id
       FROM coupon_redemptions
       WHERE coupon_id = ?
         AND user_id = ?
         AND context_type = ?
         AND context_ref = ?`
    )
    .get(Number(couponId), Number(userId), String(contextType || '').trim(), normalizedContextRef);
  if (exists) return;

  db.prepare(
    `INSERT INTO coupon_redemptions (
      coupon_id, user_id, context_type, context_ref, discount_amount_paise, created_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    Number(couponId),
    Number(userId),
    String(contextType || '').trim(),
    normalizedContextRef,
    Math.max(0, Math.round(Number(discountAmountPaise || 0)))
  );

  const coupon = getCouponById(couponId);
  const user = getUserById(userId);
  const userEmail = String(user?.email || '').trim().toLowerCase();
  if (coupon && userEmail) {
    const usedBySet = new Set(Array.isArray(coupon.usedBy) ? coupon.usedBy : []);
    usedBySet.add(userEmail);
    const usedBy = JSON.stringify(Array.from(usedBySet));
    db.prepare('UPDATE coupons SET used_by = ? WHERE id = ?').run(usedBy, Number(couponId));
  }
}

function validateCouponRedemptionLimit(couponId, userId) {
  const coupon = getCouponById(couponId);
  if (!coupon) return 'Invalid coupon code.';
  if (!coupon.active || !coupon.isActive) return 'This coupon is no longer active. Please contact the front desk for help with this payment.';
  if (coupon.validFrom && new Date(coupon.validFrom).getTime() > Date.now()) return 'This coupon is not active yet.';
  if (coupon.validTill && new Date(coupon.validTill).getTime() <= Date.now()) return 'This coupon has expired.';
  const user = getUserById(userId);
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const assignedEmail = String(coupon.assignedUserEmail || coupon.recipientEmail || '').trim().toLowerCase();
  if (coupon.couponType === 'private' || assignedEmail) {
    if (!userEmail || userEmail !== assignedEmail) {
      return 'This coupon is assigned to another user.';
    }
  }
  if (userEmail && Array.isArray(coupon.usedBy) && coupon.usedBy.includes(userEmail)) {
    return 'You have already used this coupon.';
  }
  const stats = getCouponRedemptionStats(coupon.id, userId);
  if (
    coupon.couponType === 'private' &&
    Number.isFinite(coupon.maxRedemptions) &&
    coupon.maxRedemptions > 0 &&
    stats.total >= coupon.maxRedemptions
  ) {
    return 'This coupon has already been used.';
  }
  if (Number(coupon.perUserLimit || 1) > 0 && stats.userTotal >= Number(coupon.perUserLimit || 1)) {
    return 'You have already used this coupon.';
  }
  return '';
}

function resolveAdminCustomerContext({ userId, customerName, customerEmail, customerPhone, createIfMissing = false } = {}) {
  const normalizedName = String(customerName || '').trim();
  const normalizedEmail = String(customerEmail || '').trim().toLowerCase();
  const normalizedPhone = String(customerPhone || '').trim();
  const numericUserId = Number(userId);

  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    return { error: 'valid customerEmail is required' };
  }

  let existingUser = null;
  if (Number.isInteger(numericUserId)) {
    existingUser = getUserById(numericUserId);
  } else if (normalizedEmail) {
    existingUser = getUserByEmail(normalizedEmail);
  }

  if (existingUser) {
    if (String(existingUser.role || '').toLowerCase() !== 'user') {
      return { error: 'customer account is invalid' };
    }

    const nextName = normalizedName || existingUser.name;
    const nextPhone = normalizedPhone || existingUser.mobile || '';
    if (nextName !== existingUser.name || nextPhone !== (existingUser.mobile || '')) {
      db.prepare('UPDATE users SET name = ?, mobile = ? WHERE id = ?').run(nextName, nextPhone, existingUser.id);
      existingUser = getUserById(existingUser.id);
    }
    return { user: existingUser, existingUser: true };
  }

  if (!createIfMissing) {
    if (!normalizedEmail) {
      return { user: null, existingUser: false };
    }
    return {
      user: {
        id: null,
        role: 'user',
        name: normalizedName || 'Customer',
        email: normalizedEmail,
        mobile: normalizedPhone,
        membershipStatus: 'inactive',
        membershipExpiresAt: null,
        membershipPeopleCount: null,
      },
      existingUser: false,
    };
  }

  if (!normalizedName || !normalizedEmail || !normalizedPhone) {
    return { error: 'customerName, customerEmail, and customerPhone are required' };
  }

  const passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  try {
    const insert = db
      .prepare(
        `INSERT INTO users (name, email, mobile, password_hash, role, created_at)
         VALUES (?, ?, ?, ?, 'user', datetime('now'))`
      )
      .run(normalizedName, normalizedEmail, normalizedPhone, passwordHash);
    return { user: getUserById(insert.lastInsertRowid), existingUser: false, createdUser: true };
  } catch {
    const fallbackUser = getUserByEmail(normalizedEmail);
    if (!fallbackUser || String(fallbackUser.role || '').toLowerCase() !== 'user') {
      return { error: 'Unable to create customer account' };
    }
    db.prepare('UPDATE users SET name = ?, mobile = ? WHERE id = ?').run(normalizedName, normalizedPhone, fallbackUser.id);
    return { user: getUserById(fallbackUser.id), existingUser: true };
  }
}

function createPaymentAccessToken(bookingId, userId) {
  return jwt.sign(
    {
      scope: 'booking_payment',
      bookingId: Number(bookingId),
      userId: Number(userId),
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyPaymentAccessToken(token) {
  try {
    const payload = jwt.verify(String(token || ''), JWT_SECRET);
    if (payload?.scope !== 'booking_payment') return null;
    return {
      bookingId: Number(payload.bookingId),
      userId: Number(payload.userId),
    };
  } catch {
    return null;
  }
}

function createGuestCheckoutAccessToken(payload) {
  const bookingIds = (Array.isArray(payload?.bookingIds) ? payload.bookingIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!bookingIds.length) return '';
  return jwt.sign(
    {
      scope: 'guest_checkout',
      bookingIds,
      guestName: String(payload?.guestName || '').trim(),
      guestEmail: String(payload?.guestEmail || '').trim(),
      guestPhone: String(payload?.guestPhone || '').trim(),
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function verifyGuestCheckoutAccessToken(token) {
  try {
    const payload = jwt.verify(String(token || ''), JWT_SECRET);
    if (payload?.scope !== 'guest_checkout') return null;
    const bookingIds = Array.isArray(payload.bookingIds)
      ? payload.bookingIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    if (!bookingIds.length) return null;
    return {
      bookingIds,
      guestName: String(payload.guestName || '').trim(),
      guestEmail: String(payload.guestEmail || '').trim(),
      guestPhone: String(payload.guestPhone || '').trim(),
    };
  } catch {
    return null;
  }
}

function loadBookingsByIds(bookingIds = []) {
  const ids = (Array.isArray(bookingIds) ? bookingIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(', ');
  return db
    .prepare(
      `SELECT id, user_id AS userId, booking_group_id AS bookingGroupId, service_name AS serviceName,
              booking_date AS bookingDate, booking_time AS bookingTime, status, payment_status AS paymentStatus,
              payment_order_id AS paymentOrderId, payment_reference AS paymentReference, is_topup_session AS isTopUpSession,
              guest_name AS guestName, guest_email AS guestEmail, guest_phone AS guestPhone,
              created_at AS createdAt
       FROM bookings
       WHERE id IN (${placeholders})
       ORDER BY booking_date, booking_time, id`
    )
    .all(...ids);
}

function createInvoiceAccessToken(payload) {
  const scope = String(payload?.scope || '').trim();
  if (!scope) return '';
  return jwt.sign(
    {
      scope,
      bookingId: payload?.bookingId != null ? Number(payload.bookingId) : undefined,
      userId: payload?.userId != null ? Number(payload.userId) : undefined,
      orderId: payload?.orderId != null ? String(payload.orderId) : undefined,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function verifyInvoiceAccessToken(token) {
  try {
    const payload = jwt.verify(String(token || ''), JWT_SECRET);
    const scope = String(payload?.scope || '').trim();
    if (!scope) return null;
    return {
      scope,
      bookingId: payload?.bookingId != null ? Number(payload.bookingId) : null,
      userId: payload?.userId != null ? Number(payload.userId) : null,
      orderId: payload?.orderId != null ? String(payload.orderId) : '',
    };
  } catch {
    return null;
  }
}

function getRequestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function buildBookingPaymentLink(req, bookingId, userId) {
  const token = createPaymentAccessToken(bookingId, userId);
  return `${getRequestOrigin(req)}/booking/payment.html?token=${encodeURIComponent(token)}`;
}

function buildRazorpayReceipt(prefix, identifier = '') {
  const safePrefix = String(prefix || 'ord')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8) || 'ord';
  const safeIdentifier = String(identifier || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-12);
  const stamp = Date.now().toString(36);
  return [safePrefix, safeIdentifier, stamp].filter(Boolean).join('_').slice(0, 40);
}

const GST_RATE_PERCENT = 18;

function normalizeCurrencyAmountInr(amountInr) {
  return Math.max(0, Math.round(Number(amountInr || 0)));
}

function getGstBreakdownForAmountInr(amountInr, { fromGross = false } = {}) {
  const sourceAmountInr = normalizeCurrencyAmountInr(amountInr);
  if (sourceAmountInr <= 0) {
    return {
      subtotalAmountInr: 0,
      gstAmountInr: 0,
      totalAmountInr: 0,
      gstRatePercent: GST_RATE_PERCENT,
    };
  }

  if (fromGross) {
    const subtotalAmountInr = Math.max(0, Math.round(sourceAmountInr / (1 + GST_RATE_PERCENT / 100)));
    const gstAmountInr = Math.max(0, sourceAmountInr - subtotalAmountInr);
    return {
      subtotalAmountInr,
      gstAmountInr,
      totalAmountInr: sourceAmountInr,
      gstRatePercent: GST_RATE_PERCENT,
    };
  }

  const subtotalAmountInr = sourceAmountInr;
  const gstAmountInr = Math.max(0, Math.round((subtotalAmountInr * GST_RATE_PERCENT) / 100));
  return {
    subtotalAmountInr,
    gstAmountInr,
    totalAmountInr: subtotalAmountInr + gstAmountInr,
    gstRatePercent: GST_RATE_PERCENT,
  };
}

function finalizeSummaryWithGst(summary, options = {}) {
  if (!summary) return summary;
  if (summary.gstIncluded) return summary;

  const sourceAmountInr = Number(summary.subtotalAmountInr ?? summary.totalAmountInr ?? summary.amountInr ?? 0);
  const breakdown = getGstBreakdownForAmountInr(sourceAmountInr, options);
  return {
    ...summary,
    subtotalAmountInr: breakdown.subtotalAmountInr,
    gstAmountInr: breakdown.gstAmountInr,
    gstRatePercent: breakdown.gstRatePercent,
    totalAmountInr: breakdown.totalAmountInr,
    payableAmountInr: breakdown.totalAmountInr,
    amountInr: breakdown.totalAmountInr,
    gstIncluded: true,
  };
}

function getCurrentSqliteTimestamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function getRazorpayOrderErrorMessage(error, fallbackMessage) {
  const message =
    error?.error?.description ||
    error?.description ||
    error?.error?.message ||
    error?.message ||
    fallbackMessage;
  return String(message || fallbackMessage || 'Razorpay request failed');
}

function parseSqliteDateToUtcMs(value) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  if (raw.includes('T')) {
    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? NaN : parsed;
  }
  const parsed = Date.parse(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(parsed) ? NaN : parsed;
}

function isHoldEligible(status, paymentStatus) {
  const normalizedStatus = String(status || '').toLowerCase();
  if (normalizedStatus !== 'pending') return false;
  const normalizedPayment = String(paymentStatus || '').toLowerCase();
  return normalizedPayment !== 'paid';
}

function getBookingHoldMeta(booking) {
  if (!booking || !isHoldEligible(booking.status, booking.paymentStatus)) {
    return {
      holdActive: false,
      holdExpired: false,
      holdExpiresAt: '',
      holdRemainingMinutes: 0,
    };
  }

  const createdMs = parseSqliteDateToUtcMs(booking.createdAt);
  if (!Number.isFinite(createdMs)) {
    return {
      holdActive: false,
      holdExpired: false,
      holdExpiresAt: '',
      holdRemainingMinutes: 0,
    };
  }

  const expiresMs = createdMs + BOOKING_HOLD_MINUTES * 60 * 1000;
  const remainingMs = expiresMs - Date.now();
  const holdExpired = remainingMs <= 0;
  return {
    holdActive: !holdExpired,
    holdExpired,
    holdExpiresAt: new Date(expiresMs).toISOString(),
    holdRemainingMinutes: holdExpired ? 0 : Math.ceil(remainingMs / 60000),
  };
}

function isHoldExpiredBooking(booking) {
  return Boolean(getBookingHoldMeta(booking).holdExpired);
}

function applyHoldMeta(booking) {
  const meta = getBookingHoldMeta(booking);
  return { ...booking, ...meta };
}

function activeBookingSql(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `(${prefix}status IN ('booked', 'confirmed') OR (${prefix}status = 'pending' AND (${prefix}payment_status = 'paid' OR ${prefix}created_at >= ${BOOKING_HOLD_CUTOFF_SQL})))`;
}

function holdBookingSql(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `(${prefix}status = 'pending' AND COALESCE(${prefix}payment_status, '') <> 'paid' AND ${prefix}created_at >= ${BOOKING_HOLD_CUTOFF_SQL})`;
}

function calendarBookedBookingSql(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `(${prefix}status IN ('booked', 'confirmed', 'completed') OR (${prefix}status = 'pending' AND (${prefix}payment_status = 'paid' OR ${prefix}created_at >= ${BOOKING_HOLD_CUTOFF_SQL})))`;
}

function buildHoldSlotMessage() {
  return `This slot is currently on hold. Please try again in ${BOOKING_HOLD_MINUTES} minutes or choose another slot.`;
}

function createSingleBookingResponse(req, res, { targetUser, defaultNotes = '', includeAdminMeta = false } = {}) {
  const payload = validateBookingPayload(req.body, targetUser);
  if (payload.error) return res.status(400).json({ message: payload.error });

  const selectedService = getServiceByName(payload.data.serviceName);
  const effectivePriceInr = selectedService ? Number(getEffectiveServicePriceInr(selectedService, targetUser) || 0) : 0;
  const selectedCategory = String(selectedService?.category || '').toUpperCase();
  const isHydrogenBase = selectedCategory === 'HYDROGEN SESSION';
  const isTherapyOrShotBase = selectedCategory === 'IV THERAPIES' || selectedCategory === 'IV SHOTS';
  const isExperienceSession = selectedCategory === 'EXPERIENCE SESSION';
  const selectedAddOnServiceName = String(req.body?.addOnServiceName || '').trim();
  const addOnBookingDate = String(req.body?.addOnBookingDate || payload.data.bookingDate || '').trim();
  const addOnBookingTime = normalizeSlotStartTime(
    String(req.body?.addOnBookingTime || payload.data.bookingTime || '').trim()
  );
  const requestedAddOnHydrogenSlots = Array.isArray(req.body?.addOnHydrogenSlots) ? req.body.addOnHydrogenSlots : [];
  let addOnService = null;
  let addOnAmountInr = 0;
  let bookingGroupId = '';
  let addOnHydrogenSlots = [];
  if (selectedAddOnServiceName) {
    addOnService = getServiceByName(selectedAddOnServiceName);
    const addOnCategory = String(addOnService?.category || '').toUpperCase();
    const isHydrogenAddOn = addOnCategory === 'HYDROGEN SESSION';
    const isIvAddOn = isAddOnService(addOnService);
    const validAddOn =
      (isHydrogenBase && isIvAddOn) ||
      (isTherapyOrShotBase && isHydrogenAddOn);
    if (!addOnService || !validAddOn) {
      return res.status(400).json({
        message: isHydrogenBase
          ? 'Invalid add-on selected. Choose one IV Therapy or IV Shot.'
          : 'Invalid add-on selected. Choose a Hydrogen Session.',
      });
    }
    const addOnValidation = validateBookingPayload(
      {
        serviceName: addOnService.name,
        bookingDate: addOnBookingDate,
        bookingTime: addOnBookingTime,
        notes: payload.data.notes || defaultNotes,
      },
      targetUser
    );
    if (addOnValidation.error) {
      return res.status(400).json({ message: `Invalid add-on schedule: ${addOnValidation.error}` });
    }
    if (isHydrogenAddOn) {
      const expectedSessions = Math.max(1, getHydrogenSessionCountFromServiceName(addOnService.name));
      const sourceSlots = requestedAddOnHydrogenSlots.length
        ? requestedAddOnHydrogenSlots
        : [{ bookingDate: addOnBookingDate, bookingTime: addOnBookingTime }];
      if (sourceSlots.length !== expectedSessions) {
        return res.status(400).json({
          message: `Please select exactly ${expectedSessions} hydrogen add-on session${expectedSessions === 1 ? '' : 's'}.`,
        });
      }
      const normalizedHydrogenSlots = [];
      const firstHydrogenDate = String(sourceSlots[0]?.bookingDate || '').trim();
      for (let slotIndex = 0; slotIndex < sourceSlots.length; slotIndex += 1) {
        const slot = sourceSlots[slotIndex];
        const bookingDate = String(slot?.bookingDate || '').trim();
        const bookingTimeRaw = String(slot?.bookingTime || '').trim();
        const bookingTime = normalizeSlotStartTime(bookingTimeRaw);
        const selectedDate = new Date(`${bookingDate}T00:00:00`);
        if (Number.isNaN(selectedDate.getTime())) {
          return res.status(400).json({ message: `Invalid hydrogen add-on bookingDate: ${bookingDate}` });
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate < today) {
          return res.status(400).json({ message: 'Hydrogen add-on bookingDate cannot be in the past' });
        }
        if (!bookingTime) {
          return res.status(400).json({ message: `Invalid hydrogen add-on bookingTime: ${bookingTimeRaw}` });
        }
        if (isBookingSlotInPast(bookingDate, bookingTime)) {
          return res.status(400).json({ message: `Hydrogen add-on bookingTime cannot be in the past for ${bookingDate}` });
        }
        if (slotIndex > 0) {
          const expectedDate = new Date(`${firstHydrogenDate}T00:00:00`);
          expectedDate.setDate(expectedDate.getDate() + slotIndex);
          const expectedDateIso = `${expectedDate.getFullYear()}-${String(expectedDate.getMonth() + 1).padStart(2, '0')}-${String(expectedDate.getDate()).padStart(2, '0')}`;
          if (bookingDate !== expectedDateIso) {
            return res.status(400).json({
              message: 'Hydrogen add-on sessions must be booked on consecutive dates.',
            });
          }
        }
        normalizedHydrogenSlots.push({ bookingDate, bookingTime });
      }
      const duplicateHydrogenSlot = findDuplicateHydrogenSlot(normalizedHydrogenSlots);
      if (duplicateHydrogenSlot) {
        return res.status(409).json({
          message: `Duplicate/conflicting session slot selected for ${duplicateHydrogenSlot.bookingDate} ${duplicateHydrogenSlot.bookingTime}.`,
        });
      }
      const hydrogenLimitConflict = validateHydrogenDailySessionLimit(targetUser.id, normalizedHydrogenSlots);
      if (hydrogenLimitConflict) {
        return res.status(409).json({
          message: `Only ${hydrogenLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
        });
      }
      addOnHydrogenSlots = normalizedHydrogenSlots;
    } else {
      const cooldownConflict = findIvCooldownConflict(targetUser.id, addOnService.name, addOnBookingDate);
      if (cooldownConflict) {
        return res.status(409).json({
          message: getIvCooldownResponseMessage(cooldownConflict),
        });
      }
    }
    addOnAmountInr = Number(getEffectiveServicePriceInr(addOnService, targetUser) || 0);
    bookingGroupId = createBookingGroupId('booking');
  }
  let computedPaymentStatus = isExperienceSession || effectivePriceInr > 0 ? 'unpaid' : 'paid';
  if (addOnService && addOnAmountInr > 0) {
    computedPaymentStatus = 'unpaid';
  }
  if (
    selectedService &&
    isAddOnService(selectedService) &&
    hasConflictingAddOnBooking(targetUser.id, payload.data.bookingDate, payload.data.bookingTime)
  ) {
    return res.status(409).json({
      message:
        'Only 1 IV add-on (IV Therapy or IV Shot) can be booked in the same time slot. Additional add-ons are handled by admin after consultation.',
    });
  }
  if (
    selectedService &&
    isAddOnService(selectedService) &&
    hasHydrogenPackageAddOnOnDate(targetUser.id, payload.data.bookingDate)
  ) {
    return res.status(409).json({
      message:
        'A hydrogen package on this date already includes an IV add-on. Separate IV Therapy/IV Shot bookings are not allowed on the same day.',
    });
  }
  if (!includeAdminMeta && selectedService && isAddOnService(selectedService)) {
    const cooldownConflict = findIvCooldownConflict(targetUser.id, payload.data.serviceName, payload.data.bookingDate);
    if (cooldownConflict) {
      return res.status(409).json({
        message: getIvCooldownResponseMessage(cooldownConflict),
      });
    }
  }
  if (selectedService && String(selectedService.category || '').toUpperCase() === 'HYDROGEN SESSION') {
    const dailyLimitConflict = validateHydrogenDailySessionLimit(targetUser.id, [
      { bookingDate: payload.data.bookingDate, bookingTime: payload.data.bookingTime },
    ]);
    if (dailyLimitConflict) {
      return res.status(409).json({
        message: `Only ${dailyLimitConflict.maxAllowed} hydrogen sessions can be booked in one day.`,
      });
    }
  }

  const slotStatus = getSlotCapacityStatus(payload.data.serviceName, payload.data.bookingDate, payload.data.bookingTime);
  if (slotStatus.reached) {
    const message = slotStatus.holdTotal > 0
      ? buildHoldSlotMessage()
      : `This slot is full. Maximum ${slotStatus.maxPerSlot} bookings are allowed.`;
    return res.status(409).json({ message });
  }

  const result = db
    .prepare(
      `INSERT INTO bookings (
        user_id, doctor_id, client_name, client_email, client_phone,
        service_name, booking_date, booking_time, assigned_staff, status, payment_status, booking_group_id, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
    )
    .run(
      targetUser.id,
      null,
      targetUser.name,
      targetUser.email,
      targetUser.mobile || '-',
      payload.data.serviceName,
      payload.data.bookingDate,
      payload.data.bookingTime,
      'H2 House Of Health',
      computedPaymentStatus,
      bookingGroupId,
      payload.data.notes || defaultNotes,
      getCurrentSqliteTimestamp()
    );

  if (addOnService) {
    if (String(addOnService.category || '').trim().toUpperCase() === 'HYDROGEN SESSION') {
      addOnHydrogenSlots.forEach((slot, index) => {
        db
          .prepare(
            `INSERT INTO bookings (
              user_id, doctor_id, client_name, client_email, client_phone,
              service_name, booking_date, booking_time, assigned_staff, status, payment_status, booking_group_id, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
          )
          .run(
            targetUser.id,
            null,
            targetUser.name,
            targetUser.email,
            targetUser.mobile || '-',
            addOnService.name,
            slot.bookingDate,
            slot.bookingTime,
            'H2 House Of Health',
            computedPaymentStatus,
            bookingGroupId,
            `Hydrogen add-on for ${payload.data.serviceName} (Session ${index + 1})`,
            getCurrentSqliteTimestamp()
          );
      });
    } else {
      const addOnNote = isHydrogenBase
        ? `IV add-on for ${payload.data.serviceName}`
        : `Hydrogen add-on for ${payload.data.serviceName}`;
      db
        .prepare(
          `INSERT INTO bookings (
            user_id, doctor_id, client_name, client_email, client_phone,
            service_name, booking_date, booking_time, assigned_staff, status, payment_status, booking_group_id, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`
        )
        .run(
          targetUser.id,
          null,
          targetUser.name,
          targetUser.email,
          targetUser.mobile || '-',
          addOnService.name,
          addOnBookingDate,
          addOnBookingTime,
          'H2 House Of Health',
          computedPaymentStatus,
          bookingGroupId,
          addOnNote,
          getCurrentSqliteTimestamp()
        );
    }
  }

  const booking = db
    .prepare(
      `SELECT b.id,
              b.user_id AS userId,
              u.name AS clientName,
              u.email AS clientEmail,
              u.mobile AS clientMobile,
              b.service_name AS serviceName,
              b.booking_date AS bookingDate,
              b.booking_time AS bookingTime,
              b.status,
              b.payment_status AS paymentStatus,
              b.paid_at AS paidAt,
              b.notes,
              b.created_at AS createdAt
       FROM bookings b
       JOIN users u ON u.id = b.user_id
       WHERE b.id = ?`
    )
    .get(result.lastInsertRowid);

  if (!includeAdminMeta) {
    return res.status(201).json({ booking });
  }

  return res.status(201).json({
    booking,
    customer: {
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      mobile: targetUser.mobile || '',
      membershipStatus: targetUser.membershipStatus || 'inactive',
      membershipExpiresAt: targetUser.membershipExpiresAt || null,
      membershipPeopleCount: targetUser.membershipPeopleCount ?? null,
    },
    paymentLinkUrl: computedPaymentStatus === 'paid' ? '' : buildBookingPaymentLink(req, booking.id, targetUser.id),
  });
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'admin only' });
  }
  return next();
}

function requireDoctor(req, res, next) {
  if (req.user?.role !== 'doctor') {
    return res.status(403).json({ message: 'doctor only' });
  }
  return next();
}

function getSlotCapacityStatus(serviceName, bookingDate, bookingTime, excludeBookingId = null) {
  const maxPerSlot = getSlotCapacityForServiceName(serviceName);
  const params = [serviceName, bookingDate, bookingTime];
  let excludeClause = '';
  if (excludeBookingId) {
    excludeClause = 'AND id <> ?';
    params.push(excludeBookingId);
  }
  const row = db
    .prepare(
      `SELECT
          SUM(CASE WHEN ${activeBookingSql()} THEN 1 ELSE 0 END) AS activeTotal,
          SUM(CASE WHEN ${holdBookingSql()} THEN 1 ELSE 0 END) AS holdTotal
       FROM bookings
       WHERE service_name = ?
         AND booking_date = ?
         AND booking_time = ?
         AND status IN ('pending', 'booked', 'confirmed')
         ${excludeClause}`
    )
    .get(...params);
  const activeTotal = Number(row?.activeTotal || 0);
  const holdTotal = Number(row?.holdTotal || 0);
  return {
    maxPerSlot,
    activeTotal,
    holdTotal,
    reached: activeTotal >= maxPerSlot,
  };
}

function isSlotCapacityReached(serviceName, bookingDate, bookingTime, excludeBookingId = null) {
  return getSlotCapacityStatus(serviceName, bookingDate, bookingTime, excludeBookingId).reached;
}

function getSlotCapacityForServiceName(serviceName) {
  const service = getServiceByName(serviceName);
  const category = String(service?.category || '').toUpperCase();
  if (category === 'HYDROGEN SESSION') return MAX_BOOKINGS_PER_SLOT_HYDROGEN;
  if (category === 'IV THERAPIES' || category === 'IV SHOTS') return MAX_BOOKINGS_PER_SLOT_IV;
  return MAX_BOOKINGS_PER_SLOT_HYDROGEN;
}

function getVisibleServicesForUser(user) {
  if (String(user?.role || '').toLowerCase() === 'admin') {
    return SERVICE_CATALOG;
  }
  return SERVICE_CATALOG;
}

function isAddOnService(service) {
  const category = String(service?.category || '').toUpperCase();
  return category === 'IV THERAPIES' || category === 'IV SHOTS';
}

function isHydrogenSessionService(service) {
  return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
}

function getAddOnServiceNames() {
  return SERVICE_CATALOG.filter((service) => isAddOnService(service)).map((service) => service.name);
}

function buildExcludedBookingIdsClause(excludeBookingIds = []) {
  const ids = Array.isArray(excludeBookingIds)
    ? excludeBookingIds.map((id) => Number(id)).filter((id) => Number.isInteger(id))
    : [];
  if (!ids.length) {
    return { clause: '', params: [] };
  }
  return {
    clause: ` AND id NOT IN (${ids.map(() => '?').join(', ')})`,
    params: ids,
  };
}

function hasConflictingAddOnBooking(userId, bookingDate, bookingTime, excludeBookingId = null) {
  const addOnNames = getAddOnServiceNames();
  if (!addOnNames.length) return false;

  const placeholders = addOnNames.map(() => '?').join(', ');
  if (excludeBookingId) {
    const row = db
      .prepare(
        `SELECT COUNT(*) AS total
         FROM bookings
         WHERE user_id = ?
           AND booking_date = ?
           AND booking_time = ?
           AND ${activeBookingSql()}
           AND service_name IN (${placeholders})
           AND id <> ?`
      )
      .get(userId, bookingDate, bookingTime, ...addOnNames, Number(excludeBookingId));
    return Number(row?.total || 0) > 0;
  }

  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND booking_date = ?
         AND booking_time = ?
         AND ${activeBookingSql()}
         AND service_name IN (${placeholders})`
    )
    .get(userId, bookingDate, bookingTime, ...addOnNames);

  return Number(row?.total || 0) > 0;
}

function hasHydrogenPackageAddOnOnDate(userId, bookingDate, excludeBookingIds = []) {
  const addOnNames = getAddOnServiceNames();
  if (!addOnNames.length) return false;

  const placeholders = addOnNames.map(() => '?').join(', ');
  const exclusion = buildExcludedBookingIdsClause(excludeBookingIds);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND booking_date = ?
         AND booking_group_id IS NOT NULL
         AND ${activeBookingSql()}
         AND service_name IN (${placeholders})
         ${exclusion.clause}`
    )
    .get(userId, bookingDate, ...addOnNames, ...exclusion.params);

  return Number(row?.total || 0) > 0;
}

function hasStandaloneIvBookingOnDate(userId, bookingDate, excludeBookingIds = []) {
  const addOnNames = getAddOnServiceNames();
  if (!addOnNames.length) return false;

  const placeholders = addOnNames.map(() => '?').join(', ');
  const exclusion = buildExcludedBookingIdsClause(excludeBookingIds);
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND booking_date = ?
         AND (booking_group_id IS NULL OR booking_group_id = '')
         AND ${activeBookingSql()}
         AND service_name IN (${placeholders})
         ${exclusion.clause}`
    )
    .get(userId, bookingDate, ...addOnNames, ...exclusion.params);

  return Number(row?.total || 0) > 0;
}

function getIvCooldownResponseMessage(conflict) {
  return `An IV Therapy/IV Shot can be booked again only after 2 weeks. Existing IV booking found on ${conflict?.bookingDate}. Reach out to us to book if you still want this.`;
}

function startOfDayUtcMs(dateString) {
  return new Date(`${String(dateString || '').trim()}T00:00:00`).getTime();
}

function findIvCooldownConflict(userId, serviceName, bookingDate, excludeBookingIds = []) {
  const service = getServiceByName(serviceName);
  if (!isAddOnService(service)) return null;

  const addOnNames = getAddOnServiceNames();
  if (!addOnNames.length) return null;

  const exclusion = buildExcludedBookingIdsClause(excludeBookingIds);
  const placeholders = addOnNames.map(() => '?').join(', ');
  const rows = db
    .prepare(
      `SELECT id, service_name AS serviceName, booking_date AS bookingDate, booking_time AS bookingTime
       FROM bookings
       WHERE user_id = ?
         AND service_name IN (${placeholders})
         AND (status = 'completed' OR ${activeBookingSql()})
         ${exclusion.clause}
       ORDER BY booking_date ASC, booking_time ASC`
    )
    .all(userId, ...addOnNames, ...exclusion.params);

  const targetMs = startOfDayUtcMs(bookingDate);
  if (Number.isNaN(targetMs)) return null;

  for (const row of rows) {
    const existingMs = startOfDayUtcMs(row.bookingDate);
    if (Number.isNaN(existingMs)) continue;
    const diffDays = Math.abs(Math.round((existingMs - targetMs) / 86400000));
    if (diffDays < IV_REBOOK_COOLDOWN_DAYS) {
      return {
        bookingId: Number(row.id),
        bookingDate: row.bookingDate,
        bookingTime: row.bookingTime,
        diffDays,
      };
    }
  }

  return null;
}

function validateHydrogenDailySessionLimit(userId, slots, excludeBookingIds = []) {
  const exclusion = buildExcludedBookingIdsClause(excludeBookingIds);
  const existingRows = db
    .prepare(
      `SELECT booking_date AS bookingDate, COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND (status = 'completed' OR ${activeBookingSql()})
         AND service_name IN (${SERVICE_CATALOG.filter((item) => String(item.category || '').toUpperCase() === 'HYDROGEN SESSION')
           .map(() => '?')
           .join(', ')})
         ${exclusion.clause}
       GROUP BY booking_date`
    )
    .all(
      userId,
      ...SERVICE_CATALOG.filter((item) => String(item.category || '').toUpperCase() === 'HYDROGEN SESSION').map((item) => item.name),
      ...exclusion.params
    );

  const existingByDate = new Map(existingRows.map((row) => [String(row.bookingDate), Number(row.total || 0)]));
  const requestedByDate = new Map();
  for (const slot of Array.isArray(slots) ? slots : []) {
    const date = String(slot?.bookingDate || '').trim();
    if (!date) continue;
    requestedByDate.set(date, Number(requestedByDate.get(date) || 0) + 1);
  }

  let expiryDateIso = '';
  const memberRow = db
    .prepare(
      `SELECT membership_status AS membershipStatus,
              membership_started_at AS membershipStartedAt,
              membership_expires_at AS membershipExpiresAt
       FROM users
       WHERE id = ?`
    )
    .get(Number(userId));
  if (memberRow && String(memberRow.membershipStatus || '').toLowerCase() === 'active') {
    const startedAtMs = memberRow.membershipStartedAt ? new Date(memberRow.membershipStartedAt).getTime() : NaN;
    const storedExpiresAtMs = memberRow.membershipExpiresAt ? new Date(memberRow.membershipExpiresAt).getTime() : NaN;
    const effectiveExpiresAtMs = Number.isFinite(startedAtMs)
      ? startedAtMs + MEMBERSHIP_VALIDITY_DAYS * 24 * 60 * 60 * 1000
      : storedExpiresAtMs;
    if (Number.isFinite(effectiveExpiresAtMs) && effectiveExpiresAtMs > Date.now()) {
      expiryDateIso = new Date(effectiveExpiresAtMs).toISOString().slice(0, 10);
    }
  }

  for (const [bookingDate, requestedTotal] of requestedByDate.entries()) {
    const existingTotal = Number(existingByDate.get(bookingDate) || 0);
    const maxAllowed =
      expiryDateIso && bookingDate === expiryDateIso ? 3 : MAX_HYDROGEN_SESSIONS_PER_DAY_PER_USER;
    if (existingTotal + requestedTotal > maxAllowed) {
      return {
        bookingDate,
        existingTotal,
        requestedTotal,
        maxAllowed,
      };
    }
  }

  return null;
}

function getHydrogenSessionCountFromServiceName(serviceName) {
  const raw = String(serviceName || '').trim();
  const normalized = raw.toLowerCase();
  if (normalized.includes('single')) return 1;

  let match = raw.match(/\((\d+)\s*session/i);
  if (match) return Number(match[1]);

  match = raw.match(/\b(\d+)\s*session/i);
  if (match) return Number(match[1]);

  const cleaned = normalized.replace(/\bh2\b/g, ' ');
  match = cleaned.match(/\b(\d+)\b/);
  return match ? Number(match[1]) : 1;
}

function createBookingGroupId(prefix = 'group') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function buildHydrogenPackPricingSummary({
  user,
  userId,
  baseService,
  packageSessions,
  extraSessions,
  addOnAmountInr = 0,
  forceChargeable = false,
}) {
  const totalSessions = Math.max(1, Number(packageSessions || 1) + Number(extraSessions || 0));
  const addOnTotal = Number(addOnAmountInr || 0);

  const singleSessionService =
    SERVICE_CATALOG.find(
      (item) =>
        String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
        getHydrogenSessionCountFromServiceName(item.name) === 1
    ) || baseService;

  const membershipBalance = getHydrogenFreeSessionBalance(Number(userId), user);
  if (membershipBalance.active) {
    if (forceChargeable) {
      const packagePriceInr = getEffectiveServicePriceInr(baseService, user);
      const extraSessionPriceInr = getEffectiveServicePriceInr(singleSessionService, user);
      const totalAmountInr =
        Number(packagePriceInr || 0) + Number(extraSessionPriceInr || 0) * Number(extraSessions || 0) + addOnTotal;

      return {
        totalAmountInr,
        summary: {
          membershipActive: true,
          freeSessionsApplied: 0,
          chargeableHydrogenSessions: totalSessions,
          memberSessionPriceInr: 0,
          packageSessions: Number(packageSessions || 0),
          extraSessions: Number(extraSessions || 0),
          totalSessions,
          packagePriceInr: Number(packagePriceInr || 0),
          extraSessionPriceInr: Number(extraSessionPriceInr || 0),
          addOnAmountInr: addOnTotal,
          membershipSessionsRemaining: Number(membershipBalance.remaining || 0),
          forceChargeable: true,
          totalAmountInr,
        },
      };
    }

    const freeSessionsApplied = forceChargeable ? 0 : Math.min(membershipBalance.remaining, totalSessions);
    const chargeableHydrogenSessions = Math.max(0, totalSessions - freeSessionsApplied);
    const memberSessionPriceInr = getEffectiveServicePriceInr(singleSessionService, user);
    const totalAmountInr = chargeableHydrogenSessions * Number(memberSessionPriceInr || 0) + addOnTotal;

    return {
      totalAmountInr,
      summary: {
        membershipActive: true,
        freeSessionsApplied,
        chargeableHydrogenSessions,
        memberSessionPriceInr: Number(memberSessionPriceInr || 0),
        packageSessions: Number(packageSessions || 0),
        extraSessions: Number(extraSessions || 0),
        totalSessions,
        packagePriceInr: 0,
        extraSessionPriceInr: 0,
        addOnAmountInr: addOnTotal,
        membershipSessionsRemaining: Math.max(0, membershipBalance.remaining - freeSessionsApplied),
        forceChargeable: Boolean(forceChargeable),
        totalAmountInr,
      },
    };
  }

  const packagePriceInr = getEffectiveServicePriceInr(baseService, user);
  const extraSessionPriceInr = getEffectiveServicePriceInr(singleSessionService, user);
  const totalAmountInr = Number(packagePriceInr || 0) + Number(extraSessionPriceInr || 0) * Number(extraSessions || 0) + addOnTotal;

  return {
    totalAmountInr,
    summary: {
      membershipActive: false,
      freeSessionsApplied: 0,
      chargeableHydrogenSessions: totalSessions,
      memberSessionPriceInr: 0,
      packageSessions: Number(packageSessions || 0),
      extraSessions: Number(extraSessions || 0),
      totalSessions,
      packagePriceInr: Number(packagePriceInr || 0),
      extraSessionPriceInr: Number(extraSessionPriceInr || 0),
      addOnAmountInr: addOnTotal,
      membershipSessionsRemaining: 0,
      totalAmountInr,
    },
  };
}

function buildHydrogenGroupPaymentSummary(bookings, user) {
  if (!Array.isArray(bookings) || !bookings.length) {
    throw new Error('No bookings available for payment.');
  }

  const inferredUserId = Number(bookings[0]?.userId);
  const hydrogenBookings = bookings.filter((entry) => {
    const service = getServiceByName(entry.serviceName);
    return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
  });
  if (!hydrogenBookings.length) {
    throw new Error('Grouped payment is only supported for hydrogen package bookings.');
  }

  const baseService = getServiceByName(hydrogenBookings[0].serviceName);
  if (!baseService) {
    throw new Error('Invalid hydrogen service configured on booking group.');
  }

  const packageSessions = getHydrogenSessionCountFromServiceName(baseService.name);
  const extraSessions = Math.max(0, hydrogenBookings.length - packageSessions);
  const addOnBookings = bookings.filter((entry) => {
    const service = getServiceByName(entry.serviceName);
    return isAddOnService(service);
  });
  const addOnItems = addOnBookings.map((entry) => {
    const service = getServiceByName(entry.serviceName);
    return {
      bookingId: entry.id,
      serviceName: entry.serviceName,
      amountInr: getEffectiveServicePriceInr(service, user),
      bookingDate: entry.bookingDate,
      bookingTime: entry.bookingTime,
    };
  });
  const addOnAmountInr = addOnItems.reduce((sum, item) => sum + Number(item.amountInr || 0), 0);
  const addOnLineItems = addOnItems.map((item) => ({
    serviceName: item.serviceName,
    bookingDate: item.bookingDate,
    bookingTime: item.bookingTime,
    amountInr: Number(item.amountInr || 0),
  }));
  const isForceChargeableGroup = hydrogenBookings.some((entry) => {
    const paymentReference = String(entry?.paymentReference || '').trim().toLowerCase();
    return paymentReference === 'buy_extra' || Number(entry?.isTopUpSession || 0) === 1;
  });

  if (isMembershipActiveForUser(user) && isForceChargeableGroup) {
    const pricing = buildHydrogenPackPricingSummary({
      user,
      userId: inferredUserId,
      baseService,
      packageSessions,
      extraSessions,
      addOnAmountInr,
      forceChargeable: true,
    });

    return {
      serviceName: baseService.name,
      packageSessions,
      extraSessions,
      addOnItems,
      addOnAmountInr,
      bookingCount: bookings.length,
      totalAmountInr: pricing.totalAmountInr,
      invoiceItems: [
        {
          serviceName: `${baseService.name}${hydrogenBookings.length > 1 ? ` (${hydrogenBookings.length} sessions)` : ''}`,
          bookingDate: hydrogenBookings[0]?.bookingDate || '',
          bookingTime: hydrogenBookings[0]?.bookingTime || '',
          amountInr: Number(pricing.totalAmountInr || 0) - addOnAmountInr,
        },
        ...addOnLineItems,
      ].filter((item) => Number(item.amountInr || 0) > 0),
      ...pricing.summary,
    };
  }

  if (isMembershipActiveForUser(user)) {
    const singleSessionService =
      SERVICE_CATALOG.find(
        (item) =>
          String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
          getHydrogenSessionCountFromServiceName(item.name) === 1
      ) || baseService;
    const chargeableHydrogenBookings = hydrogenBookings.filter((entry) => {
      if (String(entry.paymentReference || '').trim().toLowerCase() === 'membership') return false;
      return String(entry.paymentStatus || 'unpaid').trim().toLowerCase() !== 'paid';
    });
    const memberSessionPriceInr = getEffectiveServicePriceInr(singleSessionService, user);
    const hydrogenAmountInr = chargeableHydrogenBookings.length * Number(memberSessionPriceInr || 0);
    const totalAmountInr = hydrogenAmountInr + addOnAmountInr;

    return {
      serviceName: baseService.name,
      packageSessions,
      extraSessions,
      addOnItems,
      addOnAmountInr,
      bookingCount: bookings.length,
      membershipActive: true,
      freeSessionsApplied: Math.max(0, hydrogenBookings.length - chargeableHydrogenBookings.length),
      chargeableHydrogenSessions: chargeableHydrogenBookings.length,
      memberSessionPriceInr: Number(memberSessionPriceInr || 0),
      totalSessions: hydrogenBookings.length,
      totalAmountInr,
      invoiceItems: [
        {
          serviceName:
            chargeableHydrogenBookings.length > 1
              ? `${baseService.name} (${chargeableHydrogenBookings.length} paid sessions)`
              : baseService.name,
          bookingDate: chargeableHydrogenBookings[0]?.bookingDate || hydrogenBookings[0]?.bookingDate || '',
          bookingTime: chargeableHydrogenBookings[0]?.bookingTime || hydrogenBookings[0]?.bookingTime || '',
          amountInr: hydrogenAmountInr,
        },
        ...addOnLineItems,
      ].filter((item) => Number(item.amountInr || 0) > 0),
    };
  }

  const pricing = buildHydrogenPackPricingSummary({
    user,
    userId: inferredUserId,
    baseService,
    packageSessions,
    extraSessions,
    addOnAmountInr,
  });

  return {
    serviceName: baseService.name,
    packageSessions,
    extraSessions,
    addOnItems,
    addOnAmountInr,
    bookingCount: bookings.length,
    totalAmountInr: pricing.totalAmountInr,
    invoiceItems: [
      {
        serviceName: `${baseService.name}${hydrogenBookings.length > 1 ? ` (${hydrogenBookings.length} sessions)` : ''}`,
        bookingDate: hydrogenBookings[0]?.bookingDate || '',
        bookingTime: hydrogenBookings[0]?.bookingTime || '',
        amountInr: Number(pricing.totalAmountInr || 0) - addOnAmountInr,
      },
      ...addOnLineItems,
    ].filter((item) => Number(item.amountInr || 0) > 0),
    ...pricing.summary,
  };
}

function buildAddOnOnlyPaymentSummary(bookings, user) {
  const orderedBookings = Array.isArray(bookings) ? bookings.filter(Boolean) : [];
  if (!orderedBookings.length) {
    throw new Error('No payable add-ons found.');
  }

  const baseBooking = orderedBookings.find((entry) => {
    const service = getServiceByName(entry.serviceName);
    return String(service?.category || '').toUpperCase() !== 'HYDROGEN SESSION';
  }) || null;
  const addOnBookings = baseBooking
    ? orderedBookings.filter((entry) => entry !== baseBooking)
    : orderedBookings.filter((entry) => {
        const service = getServiceByName(entry.serviceName);
        const category = String(service?.category || '').toUpperCase();
        return isAddOnService(service) || category === 'HYDROGEN SESSION';
      });
  if (!addOnBookings.length && !baseBooking) {
    throw new Error('No payable add-ons found.');
  }

  const addOnItems = addOnBookings.map((entry) => {
    const service = getServiceByName(entry.serviceName);
    return {
      bookingId: entry.id,
      serviceName: entry.serviceName,
      amountInr: Number(getEffectiveServicePriceInr(service, user) || 0),
      bookingDate: entry.bookingDate,
      bookingTime: entry.bookingTime,
    };
  });
  const addOnAmountInr = addOnItems.reduce((sum, item) => sum + Number(item.amountInr || 0), 0);
  const baseAmountInr = baseBooking ? Number(getEffectiveServicePriceInr(getServiceByName(baseBooking.serviceName), user) || 0) : 0;
  const totalAmountInr = baseAmountInr + addOnAmountInr;

  if (baseBooking) {
    const baseService = getServiceByName(baseBooking.serviceName);
    return {
      serviceName: baseService?.name || baseBooking.serviceName || 'Booking',
      addOnItems,
      addOnAmountInr,
      bookingCount: orderedBookings.length,
      totalAmountInr,
      amountInr: totalAmountInr,
      invoiceItems: [
        {
          serviceName: baseService?.name || baseBooking.serviceName || 'Booking',
          bookingDate: baseBooking.bookingDate || '',
          bookingTime: baseBooking.bookingTime || '',
          amountInr: baseAmountInr,
        },
        ...addOnItems.map((item) => ({
          serviceName: item.serviceName,
          bookingDate: item.bookingDate,
          bookingTime: item.bookingTime,
          amountInr: Number(item.amountInr || 0),
        })),
      ].filter((item) => Number(item.amountInr || 0) > 0),
    };
  }

  return {
    serviceName: addOnItems.length === 1 ? addOnItems[0].serviceName : 'IV Add-ons',
    addOnItems,
    addOnAmountInr,
    bookingCount: addOnBookings.length,
    totalAmountInr: addOnAmountInr,
    amountInr: addOnAmountInr,
    invoiceItems: addOnItems.map((item) => ({
      serviceName: item.serviceName,
      bookingDate: item.bookingDate,
      bookingTime: item.bookingTime,
      amountInr: Number(item.amountInr || 0),
    })),
  };
}

function getMemberHydrogenSingleSessionPriceInr(user) {
  const singleSessionService =
    SERVICE_CATALOG.find(
      (item) =>
        String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
        getHydrogenSessionCountFromServiceName(item.name) === 1
    ) || null;
  const amountInr = Number(
    singleSessionService?.memberPriceInr ??
      singleSessionService?.priceInr ??
      singleSessionService?.nonMemberPriceInr ??
      0
  );
  return applyPhoneDiscount(amountInr, user?.mobile || '');
}

function buildPaidBookingInvoiceSummaryFromStoredAmounts(activeBookings, user) {
  const paidBookings = (Array.isArray(activeBookings) ? activeBookings : []).filter(
    (entry) => String(entry?.paymentStatus || '').trim().toLowerCase() === 'paid'
  );
  if (!paidBookings.length || paidBookings.length !== activeBookings.length) return null;
  return null;
}

function buildBookingInvoiceSummary(bookings, user) {
  const activeBookings = (Array.isArray(bookings) ? bookings : []).filter(
    (entry) => String(entry?.status || '').toLowerCase() !== 'cancelled'
  );
  if (!activeBookings.length) {
    return { serviceName: 'Booking', totalAmountInr: 0, amountInr: 0, bookingCount: 0 };
  }

  const storedPaidAmountPaise = activeBookings.reduce((sum, entry) => {
    if (String(entry?.paymentStatus || '').trim().toLowerCase() !== 'paid') return sum;
    return sum + Math.max(0, Math.round(Number(entry?.paidAmountPaise || 0)));
  }, 0);
  if (storedPaidAmountPaise > 0) {
    const totalAmountInr = storedPaidAmountPaise / 100;
    const breakdown = getGstBreakdownForAmountInr(totalAmountInr, { fromGross: true });
    return {
      serviceName: activeBookings[0]?.serviceName || 'Booking',
      totalAmountInr,
      payableAmountInr: totalAmountInr,
      amountInr: totalAmountInr,
      subtotalAmountInr: breakdown.subtotalAmountInr,
      gstAmountInr: breakdown.gstAmountInr,
      gstRatePercent: GST_RATE_PERCENT,
      gstIncluded: true,
      bookingCount: activeBookings.length,
      invoiceItems: [
        {
          serviceName: activeBookings[0]?.serviceName || 'Booking',
          bookingDate: activeBookings[0]?.bookingDate || '',
          bookingTime: activeBookings[0]?.bookingTime || '',
          amountInr: breakdown.subtotalAmountInr,
        },
      ],
    };
  }

  const hydrogenBookings = activeBookings.filter((entry) => {
    const service = getServiceByName(entry.serviceName);
    return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
  });

  if (hydrogenBookings.length) {
    const hasNonHydrogenBooking = activeBookings.some((entry) => {
      const service = getServiceByName(entry.serviceName);
      return String(service?.category || '').toUpperCase() !== 'HYDROGEN SESSION';
    });
    if (hasNonHydrogenBooking) {
      return buildAddOnOnlyPaymentSummary(activeBookings, user);
    }

    const hasMembershipPricingReference = hydrogenBookings.some((entry) => {
      const ref = String(entry.paymentReference || '').trim().toLowerCase();
      return ref === 'membership' || ref === 'buy_extra';
    });

    if (!hasMembershipPricingReference) {
      return buildHydrogenGroupPaymentSummary(activeBookings, user);
    }

    const baseService = getServiceByName(hydrogenBookings[0].serviceName);
    const addOnBookings = activeBookings.filter((entry) => isAddOnService(getServiceByName(entry.serviceName)));
    const addOnItems = addOnBookings.map((entry) => ({
      serviceName: entry.serviceName,
      bookingDate: entry.bookingDate,
      bookingTime: entry.bookingTime,
      amountInr: Number(getEffectiveServicePriceInr(getServiceByName(entry.serviceName), user) || 0),
    }));
    const addOnAmountInr = addOnItems.reduce((sum, entry) => sum + Number(entry.amountInr || 0), 0);
    const chargeableHydrogenSessions = hydrogenBookings.filter(
      (entry) => String(entry.paymentReference || '').trim().toLowerCase() !== 'membership'
    ).length;
    const memberSessionPriceInr = getMemberHydrogenSingleSessionPriceInr(user);
    const hydrogenAmountInr = chargeableHydrogenSessions * Number(memberSessionPriceInr || 0);

    return {
      serviceName: baseService?.name || hydrogenBookings[0].serviceName || 'Hydrogen Session',
      bookingCount: activeBookings.length,
      totalSessions: hydrogenBookings.length,
      freeSessionsApplied: Math.max(0, hydrogenBookings.length - chargeableHydrogenSessions),
      chargeableHydrogenSessions,
      memberSessionPriceInr,
      addOnAmountInr,
      totalAmountInr: hydrogenAmountInr + addOnAmountInr,
      amountInr: hydrogenAmountInr + addOnAmountInr,
      invoiceItems: [
        {
          serviceName:
            chargeableHydrogenSessions > 1
              ? `${baseService?.name || hydrogenBookings[0].serviceName || 'Hydrogen Session'} (${chargeableHydrogenSessions} paid sessions)`
              : baseService?.name || hydrogenBookings[0].serviceName || 'Hydrogen Session',
          bookingDate: hydrogenBookings[0]?.bookingDate || '',
          bookingTime: hydrogenBookings[0]?.bookingTime || '',
          amountInr: hydrogenAmountInr,
        },
        ...addOnItems,
      ].filter((item) => Number(item.amountInr || 0) > 0),
    };
  }

  const booking = activeBookings[0];
  const service = getServiceByName(booking.serviceName);
  const paymentReference = String(booking.paymentReference || '').trim().toLowerCase();
  const amountInr = paymentReference === 'membership' ? 0 : Number(getEffectiveServicePriceInr(service, user) || 0);
  return {
    serviceName: booking.serviceName,
    amountInr,
    totalAmountInr: amountInr,
    bookingCount: 1,
    invoiceItems: [
      {
        serviceName: booking.serviceName,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        amountInr,
      },
    ].filter((item) => Number(item.amountInr || 0) > 0),
  };
}

function getPayableUserBookings(userId) {
  const rows = db
    .prepare(
      `SELECT id,
              user_id AS userId,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              booking_date AS bookingDate,
              booking_time AS bookingTime,
              status,
              payment_status AS paymentStatus,
              payment_reference AS paymentReference,
              created_at AS createdAt
       FROM bookings
       WHERE user_id = ?
         AND status <> 'cancelled'
         AND payment_status <> 'paid'
       ORDER BY booking_date, booking_time, id`
    )
    .all(userId);

  return rows.filter((entry) => {
    if (isHoldExpiredBooking(entry)) return false;
    const service = getServiceByName(entry.serviceName);
    return service && !service.membershipOnly;
  });
}

function buildAggregatePaymentSummary(bookings, user) {
  if (!Array.isArray(bookings) || !bookings.length) {
    throw new Error('No bookings available for payment.');
  }

  const byKey = new Map();
  for (const booking of bookings) {
    const key = booking.bookingGroupId || `single_${booking.id}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(booking);
  }

  const units = [];
  let totalAmountInr = 0;
  for (const [groupKey, entries] of byKey.entries()) {
    const hydrogenEntries = entries.filter((entry) => {
      const service = getServiceByName(entry.serviceName);
      return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
    });
    const hasNonHydrogenEntry = entries.some((entry) => {
      const service = getServiceByName(entry.serviceName);
      return String(service?.category || '').toUpperCase() !== 'HYDROGEN SESSION';
    });

    if (hydrogenEntries.length && hasNonHydrogenEntry) {
      const summary = buildAddOnOnlyPaymentSummary(entries, user);
      units.push({
        type: 'hydrogen_add_on',
        key: groupKey,
        label: summary.serviceName,
        amountInr: Number(summary.totalAmountInr || 0),
        bookingCount: Number(summary.bookingCount || entries.length),
      });
      totalAmountInr += Number(summary.totalAmountInr || 0);
      continue;
    }

    if (groupKey.startsWith('hydrogen_') || hydrogenEntries.length) {
      if (!hydrogenEntries.length && entries.every((entry) => isAddOnService(getServiceByName(entry.serviceName)))) {
        const summary = buildAddOnOnlyPaymentSummary(entries, user);
        units.push({
          type: 'hydrogen_add_on',
          key: groupKey,
          label: summary.serviceName,
          amountInr: Number(summary.totalAmountInr || 0),
          bookingCount: Number(summary.bookingCount || entries.length),
        });
        totalAmountInr += Number(summary.totalAmountInr || 0);
        continue;
      }
      const groupEntries =
        groupKey.startsWith('hydrogen_')
          ? db
              .prepare(
                `SELECT id,
                        user_id AS userId,
                        booking_group_id AS bookingGroupId,
                        service_name AS serviceName,
                        booking_date AS bookingDate,
                        booking_time AS bookingTime,
                        status,
                        payment_status AS paymentStatus,
                        payment_reference AS paymentReference,
                        created_at AS createdAt
                 FROM bookings
                 WHERE booking_group_id = ?
                   AND status <> 'cancelled'
                 ORDER BY booking_date, booking_time, id`
              )
              .all(groupKey)
          : entries;
      const summary = buildHydrogenGroupPaymentSummary(groupEntries.length ? groupEntries : entries, user);
      units.push({
        type: 'hydrogen_package',
        key: groupKey,
        label: summary.serviceName,
        amountInr: Number(summary.totalAmountInr || 0),
        bookingCount: Number(summary.bookingCount || entries.length),
      });
      totalAmountInr += Number(summary.totalAmountInr || 0);
      continue;
    }

    const booking = entries[0];
    const service = getServiceByName(booking.serviceName);
    if (!service || service.membershipOnly) continue;
    const amountInr = Number(getEffectiveServicePriceInr(service, user) || 0);
    units.push({
      type: 'single',
      key: groupKey,
      label: booking.serviceName,
      amountInr,
      bookingCount: 1,
    });
    totalAmountInr += amountInr;
  }

  return {
    unitCount: units.length,
    bookingCount: bookings.length,
    totalAmountInr,
    units,
  };
}

function getSingleBookingCouponBasePaise(paymentSummary) {
  const units = Array.isArray(paymentSummary?.units) ? paymentSummary.units : [];
  const firstPaidUnit = units.find((unit) => Number(unit?.amountInr || 0) > 0);
  return Math.round(Number(firstPaidUnit?.amountInr || 0) * 100);
}

function applyOneUseAdminPhoneDiscountToSummary(bookings, user, summary) {
  const discountPercent = getDiscountPercentForPhone(user?.mobile || '');
  if (discountPercent <= 0 || !Array.isArray(bookings) || !bookings.length) return summary;

  const baseUser = { ...user, mobile: '' };
  let baseSummary;
  try {
    baseSummary = buildAggregatePaymentSummary(bookings, baseUser);
  } catch {
    return summary;
  }

  const baseUnits = Array.isArray(baseSummary.units) ? baseSummary.units : [];
  const firstPaidUnitIndex = baseUnits.findIndex((unit) => Number(unit?.amountInr || 0) > 0);
  if (firstPaidUnitIndex < 0) return summary;

  const nextUnits = baseUnits.map((unit, index) => {
    if (index !== firstPaidUnitIndex) return unit;
    const baseAmountInr = Number(unit.amountInr || 0);
    return {
      ...unit,
      amountInr: Math.max(0, Math.round(baseAmountInr * (1 - discountPercent / 100))),
    };
  });
  const totalAmountInr = nextUnits.reduce((sum, unit) => sum + Number(unit.amountInr || 0), 0);
  return {
    ...baseSummary,
    units: nextUnits,
    totalAmountInr,
    oneUseDiscountPercent: discountPercent,
  };
}

async function getRazorpayPaymentMethod(paymentId) {
  const id = String(paymentId || '').trim();
  if (!id || !razorpay?.payments?.fetch) return '';

  try {
    const payment = await razorpay.payments.fetch(id);
    return String(payment?.method || '').trim().toLowerCase();
  } catch (error) {
    console.warn('Unable to fetch Razorpay payment method:', error?.message || error);
    return '';
  }
}

function splitAmountPaise(totalAmountPaise, itemCount) {
  const count = Math.max(0, Number(itemCount || 0));
  const total = Math.max(0, Math.round(Number(totalAmountPaise || 0)));
  if (!count) return [];
  const base = Math.floor(total / count);
  let remainder = total - base * count;
  return Array.from({ length: count }, () => {
    const value = base + (remainder > 0 ? 1 : 0);
    remainder -= 1;
    return value;
  });
}

function setPaymentAmountForBookingIds(bookingIds, totalAmountPaise) {
  const ids = (Array.isArray(bookingIds) ? bookingIds : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!ids.length) return;
  const amounts = splitAmountPaise(totalAmountPaise, ids.length);
  const update = db.prepare('UPDATE bookings SET paid_amount_paise = ? WHERE id = ?');
  const txn = db.transaction(() => {
    ids.forEach((id, index) => update.run(Number(amounts[index] || 0), id));
  });
  txn();
}

function setPaymentAmountForBookings(bookings, totalAmountPaise) {
  setPaymentAmountForBookingIds(
    (Array.isArray(bookings) ? bookings : []).map((entry) => entry?.id),
    totalAmountPaise
  );
}

function markBookingPaid(bookingId, paymentOrderId, paymentRef, paymentMethod = '', paidAmountPaise = null) {
  if (!Number.isInteger(Number(bookingId))) return;

  const booking = db
    .prepare('SELECT id, user_id AS userId FROM bookings WHERE id = ?')
    .get(Number(bookingId));
  const orderId = String(paymentOrderId || '');
  const paymentId = String(paymentRef || '');
  const method = String(paymentMethod || '').trim().toLowerCase();
  db.prepare(
    `UPDATE bookings
     SET payment_status = 'paid',
         paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
         payment_order_id = CASE WHEN ? <> '' THEN ? ELSE payment_order_id END,
         payment_reference = CASE WHEN ? <> '' THEN ? ELSE payment_reference END,
         payment_method = CASE WHEN ? <> '' THEN ? ELSE payment_method END,
         paid_amount_paise = CASE WHEN ? IS NOT NULL THEN ? ELSE paid_amount_paise END,
         status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
     WHERE id = ?`
  ).run(orderId, orderId, paymentId, paymentId, method, method, paidAmountPaise, paidAmountPaise, Number(bookingId));
  if (booking) {
    consumeAdminDiscountForBooking(booking.userId, booking.id);
  }
}

function getHistoricalBookingAmountPaise(booking) {
  if (!booking) return 0;
  const paymentReference = String(booking.paymentReference || '').trim().toLowerCase();
  if (paymentReference === 'membership') return 0;
  const service = getServiceByName(booking.serviceName);
  if (!service) return 0;
  const category = String(service.category || '').toUpperCase();
  if (category === 'HYDROGEN SESSION') {
    if (paymentReference === 'buy_extra' || Number(booking.isTopUpSession || 0) === 1) {
      const singleSessionService =
        SERVICE_CATALOG.find(
          (item) =>
            String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
            getHydrogenSessionCountFromServiceName(item.name) === 1
        ) || service;
      return Math.round(Number(singleSessionService.memberPriceInr || singleSessionService.priceInr || 0) * 100);
    }
    return Math.round(Number(service.nonMemberPriceInr || service.priceInr || 0) * 100);
  }
  return Math.round(Number(service.priceInr || 0) * 100);
}

function backfillPaidBookingAmounts() {
  if (!hasColumn('bookings', 'paid_amount_paise')) return;
  const rows = db
    .prepare(
      `SELECT id,
              booking_group_id AS bookingGroupId,
              service_name AS serviceName,
              payment_reference AS paymentReference,
              is_topup_session AS isTopUpSession,
              notes
       FROM bookings
       WHERE payment_status = 'paid'
         AND (paid_amount_paise IS NULL OR paid_amount_paise < 0)`
    )
    .all();
  if (!rows.length) return;
  const byGroup = new Map();
  for (const row of rows) {
    const key = row.bookingGroupId || `single:${row.id}`;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(row);
  }
  const updates = [];
  for (const entries of byGroup.values()) {
    const hydrogenEntries = entries.filter((entry) => {
      const service = getServiceByName(entry.serviceName);
      return String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION';
    });
    if (hydrogenEntries.length > 1) {
      const firstHydrogen = hydrogenEntries[0];
      const firstService = getServiceByName(firstHydrogen.serviceName);
      const isTopUpGroup = hydrogenEntries.some(
        (entry) =>
          String(entry.paymentReference || '').trim().toLowerCase() === 'buy_extra' ||
          Number(entry.isTopUpSession || 0) === 1
      );
      let hydrogenTotalPaise = 0;
      if (isTopUpGroup) {
        hydrogenTotalPaise = hydrogenEntries.reduce((sum, entry) => sum + getHistoricalBookingAmountPaise(entry), 0);
      } else {
        const packageSessions = getHydrogenSessionCountFromServiceName(firstService?.name || firstHydrogen.serviceName);
        const extraSessions = Math.max(0, hydrogenEntries.length - packageSessions);
        const singleSessionService =
          SERVICE_CATALOG.find(
            (item) =>
              String(item.category || '').toUpperCase() === 'HYDROGEN SESSION' &&
              getHydrogenSessionCountFromServiceName(item.name) === 1
          ) || firstService;
        hydrogenTotalPaise =
          Math.round(Number(firstService?.nonMemberPriceInr || firstService?.priceInr || 0) * 100) +
          extraSessions * Math.round(Number(singleSessionService?.nonMemberPriceInr || singleSessionService?.priceInr || 0) * 100);
      }
      const split = splitAmountPaise(hydrogenTotalPaise, hydrogenEntries.length);
      hydrogenEntries.forEach((entry, index) => updates.push({ id: entry.id, amountPaise: split[index] || 0 }));
      entries
        .filter((entry) => !hydrogenEntries.some((hydrogenEntry) => hydrogenEntry.id === entry.id))
        .forEach((entry) => updates.push({ id: entry.id, amountPaise: getHistoricalBookingAmountPaise(entry) }));
      continue;
    }
    entries.forEach((entry) => updates.push({ id: entry.id, amountPaise: getHistoricalBookingAmountPaise(entry) }));
  }
  const update = db.prepare('UPDATE bookings SET paid_amount_paise = ? WHERE id = ?');
  const txn = db.transaction((items) => {
    for (const row of items) {
      update.run(row.amountPaise, row.id);
    }
  });
  txn(updates);
}

const USER_PROFILE_SELECT = `SELECT id, name, email, role, age, gender, mobile, avatar_url AS avatarUrl,
        membership_status AS membershipStatus, membership_plan AS membershipPlan,
        membership_started_at AS membershipStartedAt, membership_expires_at AS membershipExpiresAt,
        membership_people_count AS membershipPeopleCount, membership_subscription_id AS membershipSubscriptionId
 FROM users`;

function getMembershipSubscriptionId(ownerUserId) {
  return Number.isInteger(Number(ownerUserId)) ? `membership:${Number(ownerUserId)}` : '';
}

function getUserProfileById(userId) {
  if (!Number.isInteger(Number(userId))) return null;
  return db.prepare(`${USER_PROFILE_SELECT} WHERE id = ?`).get(Number(userId));
}

function getUserProfileByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  return db.prepare(`${USER_PROFILE_SELECT} WHERE email = ?`).get(normalizedEmail);
}

function refreshMembershipSubscriptionStates() {
  db.prepare(
    `UPDATE membership_subscriptions
     SET status = CASE
       WHEN datetime(expires_at) <= datetime('now') THEN 'expired'
       ELSE 'active'
     END,
         updated_at = datetime('now')`
  ).run();
}

function getMembershipSubscriptionById(subscriptionId) {
  const normalizedId = String(subscriptionId || '').trim();
  if (!normalizedId) return null;
  refreshMembershipSubscriptionStates();
  return db
    .prepare(
      `SELECT subscription_id AS subscriptionId, owner_user_id AS ownerUserId, plan_id AS planId,
              people_count AS peopleCount, status, started_at AS startedAt, expires_at AS expiresAt
       FROM membership_subscriptions
       WHERE subscription_id = ?`
    )
    .get(normalizedId);
}

function isMembershipSubscriptionActive(subscription) {
  if (!subscription) return false;
  if (String(subscription.status || '').toLowerCase() !== 'active') return false;
  const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : NaN;
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

function findMembershipMemberByEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return null;
  refreshMembershipSubscriptionStates();
  return db
    .prepare(
      `SELECT mm.id, mm.subscription_id AS subscriptionId, mm.user_id AS userId, mm.email, mm.name, mm.place,
              mm.contact_number AS contactNumber, mm.is_registered AS isRegistered,
              ms.owner_user_id AS ownerUserId, ms.plan_id AS planId, ms.people_count AS peopleCount,
              ms.status, ms.started_at AS startedAt, ms.expires_at AS expiresAt
       FROM membership_subscription_members mm
       JOIN membership_subscriptions ms ON ms.subscription_id = mm.subscription_id
       WHERE mm.email = ?
       ORDER BY CASE WHEN ms.status = 'active' THEN 0 ELSE 1 END, datetime(ms.expires_at) DESC, mm.id DESC
       LIMIT 1`
    )
    .get(normalizedEmail);
}

function setUserMembershipState(userId, subscription) {
  if (!Number.isInteger(Number(userId))) return;
  if (subscription && isMembershipSubscriptionActive(subscription)) {
    db.prepare(
      `UPDATE users
       SET membership_status = 'active',
           membership_plan = ?,
           membership_started_at = ?,
           membership_expires_at = ?,
           membership_people_count = ?,
           membership_subscription_id = ?
       WHERE id = ?`
    ).run(
      String(subscription.planId || ''),
      subscription.startedAt || null,
      subscription.expiresAt || null,
      Number(subscription.peopleCount || 1),
      String(subscription.subscriptionId || ''),
      Number(userId)
    );
    return;
  }

  db.prepare(
    `UPDATE users
     SET membership_status = 'inactive',
         membership_plan = NULL,
         membership_started_at = NULL,
         membership_expires_at = NULL,
         membership_people_count = NULL,
         membership_subscription_id = NULL
     WHERE id = ?`
  ).run(Number(userId));
}

function syncMembershipStatusForSubscription(subscriptionId) {
  const subscription = getMembershipSubscriptionById(subscriptionId);
  const members = db
    .prepare(
      `SELECT user_id AS userId
       FROM membership_subscription_members
       WHERE subscription_id = ?
         AND user_id IS NOT NULL`
    )
    .all(String(subscriptionId || ''));

  members.forEach((member) => {
    if (Number.isInteger(Number(member.userId))) {
      setUserMembershipState(member.userId, subscription);
    }
  });
}

function syncMembershipForUser({ userId, email } = {}) {
  const numericUserId = Number(userId);
  let user = Number.isInteger(numericUserId) ? getUserProfileById(numericUserId) : null;
  const normalizedEmail = String(email || user?.email || '').trim().toLowerCase();
  if (!user && normalizedEmail) {
    user = getUserProfileByEmail(normalizedEmail);
  }
  if (!user) return null;

  const linkedMember = findMembershipMemberByEmail(normalizedEmail);
  if (!linkedMember) {
    if (user.membershipSubscriptionId) {
      setUserMembershipState(user.id, null);
    }
    return getUserProfileById(user.id);
  }

  if (!linkedMember.userId || Number(linkedMember.userId) !== Number(user.id) || Number(linkedMember.isRegistered) !== 1) {
    db.prepare(
      `UPDATE membership_subscription_members
       SET user_id = ?, is_registered = 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(Number(user.id), Number(linkedMember.id));
  }

  setUserMembershipState(user.id, linkedMember);
  return getUserProfileById(user.id);
}

function validateSubscriptionMemberConflicts(subscriptionId, members) {
  for (const member of Array.isArray(members) ? members : []) {
    const existing = db
      .prepare(
        `SELECT mm.email, mm.subscription_id AS subscriptionId
         FROM membership_subscription_members mm
         JOIN membership_subscriptions ms ON ms.subscription_id = mm.subscription_id
         WHERE mm.email = ?
           AND mm.subscription_id <> ?
           AND ms.status = 'active'
           AND datetime(ms.expires_at) > datetime('now')
         LIMIT 1`
      )
      .get(String(member?.email || '').trim().toLowerCase(), String(subscriptionId || ''));

    if (existing) {
      return {
        error: `${member.email} is already linked to another active subscription. Remove it there before reusing it here.`,
      };
    }
  }

  return { ok: true };
}

function saveMembershipSubscriptionMembers({ ownerUserId, subscriptionId, planId, peopleCount, startedAt, expiresAt, members }) {
  const normalizedSubscriptionId = String(subscriptionId || '').trim();
  if (!normalizedSubscriptionId) {
    return { error: 'Missing subscription id.' };
  }

  const conflict = validateSubscriptionMemberConflicts(normalizedSubscriptionId, members);
  if (conflict.error) return conflict;

  db.prepare(
    `INSERT INTO membership_subscriptions (
      subscription_id, owner_user_id, plan_id, people_count, status, started_at, expires_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'active', ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(subscription_id) DO UPDATE SET
      owner_user_id = excluded.owner_user_id,
      plan_id = excluded.plan_id,
      people_count = excluded.people_count,
      status = 'active',
      started_at = excluded.started_at,
      expires_at = excluded.expires_at,
      updated_at = datetime('now')`
  ).run(
    normalizedSubscriptionId,
    Number(ownerUserId),
    String(planId || ''),
    Number(peopleCount || 1),
    startedAt || null,
    expiresAt || null
  );

  const previousMembers = db
    .prepare(
      `SELECT DISTINCT user_id AS userId
       FROM membership_subscription_members
       WHERE subscription_id = ?
         AND user_id IS NOT NULL`
    )
    .all(normalizedSubscriptionId);

  db.prepare('DELETE FROM membership_subscription_members WHERE subscription_id = ?').run(normalizedSubscriptionId);

  const insertMember = db.prepare(
    `INSERT INTO membership_subscription_members (
      subscription_id, user_id, email, name, place, contact_number, is_registered, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  );

  for (const member of members) {
    const matchedUser = getUserByEmail(member.email);
    const userId = Number(matchedUser?.id || 0) || null;
    const isRegistered = userId ? 1 : 0;
    insertMember.run(
      normalizedSubscriptionId,
      userId,
      String(member.email || '').trim().toLowerCase(),
      String(member.name || '').trim(),
      String(member.place || '').trim(),
      String(member.contactNumber || '').trim(),
      isRegistered
    );
  }

  syncMembershipStatusForSubscription(normalizedSubscriptionId);
  previousMembers.forEach((member) => {
    if (Number.isInteger(Number(member.userId))) {
      syncMembershipForUser({ userId: Number(member.userId) });
    }
  });
  return { ok: true };
}

function backfillMembershipSubscriptionsFromOrders() {
  const paidOrders = db
    .prepare(
      `SELECT mpo.order_id AS orderId, mpo.user_id AS userId, mpo.plan_id AS planId,
              mpo.people_count AS peopleCount, mpo.member_details_json AS memberDetailsJson,
              mpo.paid_at AS paidAt, mpo.created_at AS createdAt,
              u.email AS ownerEmail,
              u.membership_plan AS membershipPlan,
              u.membership_started_at AS membershipStartedAt,
              u.membership_expires_at AS membershipExpiresAt
       FROM membership_payment_orders mpo
       JOIN users u ON u.id = mpo.user_id
       WHERE mpo.status = 'paid'
       ORDER BY mpo.user_id ASC, datetime(COALESCE(mpo.paid_at, mpo.created_at)) DESC, mpo.created_at DESC`
    )
    .all();

  const processedOwners = new Set();
  for (const order of paidOrders) {
    const ownerUserId = Number(order.userId);
    if (!Number.isInteger(ownerUserId) || processedOwners.has(ownerUserId)) continue;
    processedOwners.add(ownerUserId);

    const subscriptionId = getMembershipSubscriptionId(ownerUserId);
    const existingMembers = db
      .prepare(
        `SELECT COUNT(1) AS count
         FROM membership_subscription_members
         WHERE subscription_id = ?`
      )
      .get(subscriptionId);
    if (Number(existingMembers?.count || 0) > 0) continue;

    let members = [];
    try {
      members = order.memberDetailsJson ? JSON.parse(order.memberDetailsJson) : [];
    } catch {
      members = [];
    }

    const expectedCount = Number(order.peopleCount || 1);
    const membersResult = normalizeMembershipMembers(members, expectedCount);
    if (membersResult.error) continue;

    const normalizedMembers = membersResult.data;
    const ownerEmail = String(order.ownerEmail || '').trim().toLowerCase();
    if (!normalizedMembers.some((member) => String(member.email || '').trim().toLowerCase() === ownerEmail)) {
      continue;
    }

    const startedAt = order.membershipStartedAt || order.paidAt || order.createdAt || new Date().toISOString();
    const planId =
      String(order.membershipPlan || '').trim() ||
      (String(order.planId || '').trim() === 'h2_add_person' ? 'h2_single' : String(order.planId || '').trim());
    const plan = MEMBERSHIP_PLANS.find((item) => item.id === planId) || MEMBERSHIP_PLANS.find((item) => item.id === 'h2_single');
    const expiresAt =
      order.membershipExpiresAt ||
      new Date(
        new Date(startedAt).getTime() + Number(plan?.validityDays || MEMBERSHIP_VALIDITY_DAYS) * 24 * 60 * 60 * 1000
      ).toISOString();

    saveMembershipSubscriptionMembers({
      ownerUserId,
      subscriptionId,
      planId,
      peopleCount: expectedCount,
      startedAt,
      expiresAt,
      members: normalizedMembers,
    });
  }
}

function configureGoogleOAuth() {
  passport.serializeUser((user, done) => {
    done(null, Number(user?.id));
  });

  passport.deserializeUser((id, done) => {
    try {
      const user = getUserProfileById(Number(id));
      done(null, user || false);
    } catch (error) {
      done(error);
    }
  });

  if (!GOOGLE_OAUTH_ENABLED) {
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: GOOGLE_CALLBACK_URL,
      },
      (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = findOrCreateGoogleUser(profile);
          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
}

function ensureGoogleOAuthConfigured(_req, res, next) {
  if (GOOGLE_OAUTH_ENABLED) return next();
  return res.status(500).send('Google OAuth is not configured.');
}

function findOrCreateGoogleUser(profile) {
  const googleId = String(profile?.id || '').trim();
  const email = String(profile?.emails?.[0]?.value || '').trim().toLowerCase();
  const name = String(profile?.displayName || profile?.name?.givenName || email || 'User').trim();

  if (!googleId || !email) {
    throw new Error('Google profile did not include a usable id and email.');
  }

  const existingUser = getUserProfileByEmail(email);
  if (existingUser) {
    db.prepare('UPDATE users SET google_id = ? WHERE id = ?').run(googleId, Number(existingUser.id));
    return syncMembershipForUser({ userId: Number(existingUser.id), email }) || getUserProfileById(Number(existingUser.id));
  }

  const result = db
    .prepare(
      `INSERT INTO users (name, email, google_id, password_hash, role, created_at)
       VALUES (?, ?, ?, '', 'user', datetime('now'))`
    )
    .run(name || 'User', email, googleId);

  const userId = Number(result.lastInsertRowid);
  return syncMembershipForUser({ userId, email }) || getUserProfileById(userId);
}

function setAuthCookie(req, res, user) {
  const token = jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie(TOKEN_COOKIE, token, {
    ...getAuthCookieOptions(req),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}

function getAuthCookieOptions(req) {
  const secure = shouldUseSecureAuthCookie(req);
  const useCrossSiteCookie = secure && FRONTEND_ORIGINS.length > 0;
  return {
    httpOnly: true,
    sameSite: useCrossSiteCookie ? 'none' : 'lax',
    secure,
    path: '/',
  };
}

function getSessionCookieOptions() {
  const secureMode = AUTH_COOKIE_SECURE_MODE;
  const secure =
    secureMode === 'true' || secureMode === 'always'
      ? true
      : secureMode === 'false' || secureMode === 'never'
        ? false
        : IS_PRODUCTION
          ? 'auto'
          : false;
  const useCrossSiteCookie = (secure === true || secure === 'auto') && FRONTEND_ORIGINS.length > 0;
  return {
    httpOnly: true,
    sameSite: useCrossSiteCookie ? 'none' : 'lax',
    secure,
    path: '/',
  };
}

function shouldUseSecureAuthCookie(req) {
  if (AUTH_COOKIE_SECURE_MODE === 'true' || AUTH_COOKIE_SECURE_MODE === 'always') return true;
  if (AUTH_COOKIE_SECURE_MODE === 'false' || AUTH_COOKIE_SECURE_MODE === 'never') return false;
  if (!IS_PRODUCTION) return false;
  if (req?.secure) return true;
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  return forwardedProto === 'https';
}

function requireAuth(req, res, next) {
  const authorizationHeader = String(req.headers.authorization || '').trim();
  const bearerToken = authorizationHeader.toLowerCase().startsWith('bearer ')
    ? authorizationHeader.slice(7).trim()
    : '';
  const tokens = [req.cookies[TOKEN_COOKIE], bearerToken]
    .map((token) => String(token || '').trim())
    .filter(Boolean);
  if (!tokens.length) return res.status(401).json({ message: 'unauthorized' });

  for (const token of tokens) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      syncMembershipForUser({ userId: Number(payload.sub) });
      const user = getUserProfileById(Number(payload.sub));

      if (!user) continue;

      req.user = {
        id: Number(user.id),
        name: String(user.name),
        email: String(user.email),
        role: String(user.role || 'user'),
        age: user.age ?? null,
        gender: user.gender || '',
        mobile: user.mobile || '',
        avatarUrl: user.avatarUrl || '',
        membershipStatus: user.membershipStatus || 'inactive',
        membershipPlan: user.membershipPlan || '',
        membershipStartedAt: user.membershipStartedAt || null,
        membershipExpiresAt: user.membershipExpiresAt || null,
        membershipPeopleCount: user.membershipPeopleCount ?? null,
        membershipSubscriptionId: user.membershipSubscriptionId || null,
      };

      return next();
    } catch {
      // Try the next available auth source before rejecting the request.
    }
  }

  return res.status(401).json({ message: 'unauthorized' });
}

function validateBookingPayload(body, user, options = {}) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid payload' };
  }

  const serviceName = String(body.serviceName || '').trim();
  const bookingDate = String(body.bookingDate || '').trim();
  const bookingTime = String(body.bookingTime || '').trim();
  const notes = String(body.notes || '').trim();

  if (!serviceName || !bookingDate || !bookingTime) {
    return { error: 'serviceName, bookingDate, bookingTime are required' };
  }

  const service = getServiceByName(serviceName);
  if (!service) {
    return { error: 'Invalid service selected.' };
  }
  if (String(service.category || '').toUpperCase() === 'EXPERIENCE SESSION' && isMembershipActiveForUser(user)) {
    return { error: 'Demo hydrogen session is available only for non-members.' };
  }
  if (
    String(service.category || '').toUpperCase() === 'EXPERIENCE SESSION' &&
    hasUserUsedExperienceSession(user?.id, options.excludeExperienceBookingIds)
  ) {
    return { error: 'Demo hydrogen session can be attended only once.' };
  }

  if (service.membershipOnly && !isMembershipActiveForUser(user)) {
    return { error: '✨ An exclusive benefit for our members. Activate your membership to enjoy this service at no cost.' };
  }

  const selectedDate = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(selectedDate.getTime())) {
    return { error: 'bookingDate is invalid' };
  }

  if (String(service.category || '').toUpperCase() === 'HYDROGEN SESSION' && isMembershipActiveForUser(user)) {
    const startedAtMs = user?.membershipStartedAt ? new Date(user.membershipStartedAt).getTime() : NaN;
    const storedExpiresAtMs = user?.membershipExpiresAt ? new Date(user.membershipExpiresAt).getTime() : NaN;
    const effectiveExpiresAtMs = Number.isFinite(startedAtMs)
      ? startedAtMs + MEMBERSHIP_VALIDITY_DAYS * 24 * 60 * 60 * 1000
      : storedExpiresAtMs;
    if (Number.isFinite(effectiveExpiresAtMs)) {
      const expiryDateIso = new Date(effectiveExpiresAtMs).toISOString().slice(0, 10);
      if (bookingDate > expiryDateIso) {
        return { error: `Membership sessions can only be scheduled until ${expiryDateIso}.` };
      }
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (selectedDate < today) {
    return { error: 'bookingDate cannot be in the past' };
  }

  const normalizedBookingTime = normalizeSlotStartTime(bookingTime);
  if (!normalizedBookingTime) {
    return { error: 'bookingTime must be one of the allowed 1-hour slots' };
  }

  if (isBookingSlotInPast(bookingDate, normalizedBookingTime)) {
    return { error: 'bookingTime cannot be in the past for the selected date' };
  }

  return {
    data: {
      serviceName,
      bookingDate,
      bookingTime: normalizedBookingTime,
      notes,
    },
  };
}

function isBookingSlotInPast(bookingDate, bookingTime) {
  const normalizedDate = String(bookingDate || '').trim();
  const normalizedTime = String(bookingTime || '').trim();
  if (!normalizedDate || !normalizedTime) return false;
  const slotDateTime = new Date(`${normalizedDate}T${normalizedTime}:00`);
  if (Number.isNaN(slotDateTime.getTime())) return false;
  return slotDateTime.getTime() < Date.now();
}

function normalizeMembershipMembers(rawMembers, expectedCount) {
  if (!Number.isInteger(expectedCount) || expectedCount <= 0) {
    return { error: 'Invalid people count for membership.' };
  }

  if (!Array.isArray(rawMembers)) {
    return { error: 'memberDetails must be provided for all members.' };
  }

  if (rawMembers.length !== expectedCount) {
    return { error: `Please provide details for exactly ${expectedCount} member(s).` };
  }

  const normalized = [];
  const seenEmails = new Set();
  for (let i = 0; i < rawMembers.length; i += 1) {
    const item = rawMembers[i] || {};
    const name = String(item.name || '').trim();
    const place = String(item.place || '').trim();
    const email = String(item.email || '').trim().toLowerCase();
    const contactNumber = String(item.contactNumber || '').trim();
    const contactDigits = contactNumber.replace(/\D+/g, '');

    if (!name || !place || !email || !contactNumber) {
      return { error: `Member ${i + 1}: name, place, email, and contact number are required.` };
    }
    if (!isValidEmail(email)) {
      return { error: `Member ${i + 1}: valid email is required.` };
    }
    if (contactDigits.length !== 10) {
      return { error: `Member ${i + 1}: contact number must be exactly 10 digits.` };
    }
    if (seenEmails.has(email)) {
      return { error: `Member ${i + 1}: duplicate email entries are not allowed.` };
    }
    seenEmails.add(email);

    normalized.push({ name, place, email, contactNumber: contactDigits });
  }

  return { data: normalized };
}

function isMembershipActiveForUser(user) {
  if (!user) return false;
  if (String(user.membershipStatus || '').toLowerCase() !== 'active') return false;
  const startedAt = user.membershipStartedAt ? new Date(user.membershipStartedAt).getTime() : null;
  const storedExpiresAt = user.membershipExpiresAt ? new Date(user.membershipExpiresAt).getTime() : null;
  const normalizedExpiresAt =
    Number.isFinite(startedAt) && startedAt > 0 ? startedAt + MEMBERSHIP_VALIDITY_DAYS * 24 * 60 * 60 * 1000 : storedExpiresAt;
  const expiresAt = Number.isFinite(normalizedExpiresAt) ? normalizedExpiresAt : null;
  if (!expiresAt) return false;
  return expiresAt > Date.now();
}

function getMembershipWindow(user) {
  if (!user) return null;
  const startedAtMs = user.membershipStartedAt ? new Date(user.membershipStartedAt).getTime() : null;
  if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) return null;
  const expiresAtMs = startedAtMs + MEMBERSHIP_VALIDITY_DAYS * 24 * 60 * 60 * 1000;
  return { startedAtMs, expiresAtMs };
}

function getHydrogenServiceNames() {
  return SERVICE_CATALOG
    .filter((service) => String(service?.category || '').toUpperCase() === 'HYDROGEN SESSION')
    .map((service) => service.name)
    .filter(Boolean);
}

function getExperienceSessionNames() {
  const names = SERVICE_CATALOG
    .filter((service) => String(service?.category || '').toUpperCase() === 'EXPERIENCE SESSION')
    .map((service) => service.name)
    .filter(Boolean);
  return Array.from(new Set([...names, 'Demo Session', 'Demo Hydrogen Session']));
}

function hasUserUsedExperienceSession(userId, excludeBookingIds = []) {
  const normalizedUserId = Number(userId);
  if (!Number.isInteger(normalizedUserId)) return false;
  const serviceNames = getExperienceSessionNames();
  if (!serviceNames.length) return false;
  const exclusion = buildExcludedBookingIdsClause(excludeBookingIds);

  const placeholders = serviceNames.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND service_name IN (${placeholders})
         AND status <> 'cancelled'
         AND (status IN ('completed', 'schedule_later') OR ${activeBookingSql()})`
          + exclusion.clause
    )
    .get(normalizedUserId, ...serviceNames, ...exclusion.params);

  return Number(row?.total || 0) > 0;
}

function countPaidHydrogenSessionsDuringMembership(userId, user) {
  if (!Number.isInteger(Number(userId))) return 0;
  if (!isMembershipActiveForUser(user)) return 0;
  const window = getMembershipWindow(user);
  if (!window) return 0;

  const startedAtIso = new Date(window.startedAtMs).toISOString().slice(0, 10);
  const expiresAtIso = new Date(window.expiresAtMs).toISOString().slice(0, 10);
  const serviceNames = getHydrogenServiceNames();
  if (!serviceNames.length) return 0;

  const placeholders = serviceNames.map(() => '?').join(', ');
  const row = db
    .prepare(
      `SELECT COUNT(*) AS total
       FROM bookings
       WHERE user_id = ?
         AND status NOT IN ('cancelled', 'schedule_later')
         AND COALESCE(payment_status, '') = 'paid'
         AND COALESCE(is_topup_session, 0) = 0
         AND LOWER(COALESCE(payment_reference, '')) = 'membership'
         AND service_name IN (${placeholders})
         AND booking_date >= ?
         AND booking_date <= ?`
    )
    .get(Number(userId), ...serviceNames, startedAtIso, expiresAtIso);

  return Number(row?.total || 0);
}

function getHydrogenFreeSessionBalance(userId, user, { usedOverride } = {}) {
  if (!isMembershipActiveForUser(user)) {
    return {
      active: false,
      used: 0,
      remaining: 0,
    };
  }
  const used =
    Number.isFinite(Number(usedOverride)) ? Number(usedOverride) : countPaidHydrogenSessionsDuringMembership(userId, user);
  const remaining = Math.max(0, HYDROGEN_FREE_SESSIONS_PER_USER - Math.max(0, used));
  return {
    active: true,
    used,
    remaining,
  };
}

function syncMembershipCoveredHydrogenBookings(userId, user) {
  const balance = getHydrogenFreeSessionBalance(userId, user);
  if (!balance.active || balance.remaining <= 0) return;
  const window = getMembershipWindow(user);
  if (!window) return;
  const startedAtIso = new Date(window.startedAtMs).toISOString().slice(0, 10);
  const expiresAtIso = new Date(window.expiresAtMs).toISOString().slice(0, 10);
  const hydrogenServiceNames = SERVICE_CATALOG
    .filter((service) => String(service.category || '').toUpperCase() === 'HYDROGEN SESSION')
    .map((service) => service.name);
  if (!hydrogenServiceNames.length) return;

  const placeholders = hydrogenServiceNames.map(() => '?').join(', ');
  const candidates = db
    .prepare(
      `SELECT id
       FROM bookings
       WHERE user_id = ?
         AND COALESCE(payment_status, 'unpaid') <> 'paid'
         AND COALESCE(payment_reference, '') <> 'buy_extra'
         AND COALESCE(is_topup_session, 0) = 0
         AND status IN ('pending', 'booked', 'confirmed')
         AND service_name IN (${placeholders})
         AND booking_date >= ?
         AND booking_date <= ?
       ORDER BY booking_date, booking_time, id
       LIMIT ?`
    )
    .all(Number(userId), ...hydrogenServiceNames, startedAtIso, expiresAtIso, Number(balance.remaining || 0));

  if (!candidates.length) return;
  const update = db.prepare(
    `UPDATE bookings
     SET payment_status = 'paid',
         paid_at = CASE WHEN paid_at IS NULL THEN datetime('now') ELSE paid_at END,
         paid_amount_paise = 0,
         payment_reference = 'membership',
         status = CASE WHEN status = 'pending' THEN 'booked' ELSE status END
     WHERE id = ?`
  );
  const txn = db.transaction((rows) => {
    for (const row of rows) update.run(row.id);
  });
  txn(candidates);
}

function getEffectiveServicePriceInr(service, user) {
  if (!service) return 0;
  const category = String(service.category || '').toUpperCase();
  const isHydrogen = category === 'HYDROGEN SESSION';
  const isExperienceSession = category === 'EXPERIENCE SESSION';
  const membershipActive = isMembershipActiveForUser(user);
  const userPhone = user?.mobile || '';

  if (service.membershipOnly) {
    return membershipActive ? Number(service.priceInr || 0) : 0;
  }

  if (category === 'IV THERAPIES' || category === 'IV SHOTS') {
    return applyPhoneDiscount(Number(service.priceInr || 0), userPhone);
  }

  // Demo/experience session should always stay chargeable at its catalog price.
  if (isExperienceSession) {
    return Number(service.priceInr || 0);
  }

  if (isHydrogen && membershipActive && Number(service.memberPriceInr) > 0) {
    return applyPhoneDiscount(Number(service.memberPriceInr), userPhone);
  }

  if (isHydrogen && Number(service.nonMemberPriceInr) > 0) {
    return applyPhoneDiscount(Number(service.nonMemberPriceInr), userPhone);
  }

  return applyPhoneDiscount(Number(service.priceInr || 0), userPhone);
}

function findDuplicateHydrogenSlot(slots = []) {
  const seen = new Set();
  for (const slot of slots) {
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

function toServiceResponse(service, user) {
  const membershipActive = isMembershipActiveForUser(user);
  const effectivePriceInr = getEffectiveServicePriceInr(service, user);
  const discountPercent = getDiscountPercentForPhone(user?.mobile || '');
  return {
    ...service,
    effectivePriceInr,
    membershipActive,
    discountPercent,
  };
}

function getServiceByName(name) {
  const normalized = String(name || '').trim().toLowerCase();
  const directMatch = SERVICE_CATALOG.find((service) => service.name.toLowerCase() === normalized) || null;
  if (directMatch) return directMatch;
  if (normalized === 'demo session' || normalized === 'demo hydrogen session') {
    return SERVICE_CATALOG.find((service) => String(service.name || '').trim().toLowerCase() === 'experience session') || null;
  }
  return null;
}

function ensureGuestBookingOwnerUser() {
  const guestEmail = 'guest-bookings@h2hbooking.local';
  const existingUser = db
    .prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
    .get(guestEmail);

  if (existingUser && Number.isFinite(Number(existingUser.id))) {
    return Number(existingUser.id);
  }

  const passwordHash = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  const result = db
    .prepare(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'user', datetime('now'))`
    )
    .run('Guest Booking', guestEmail, passwordHash);

  return Number(result.lastInsertRowid);
}

function validateDoctorPayload(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid payload' };
  }

  const data = {
    name: String(body.name || '').trim(),
    specialty: String(body.specialty || '').trim(),
    bio: String(body.bio || '').trim(),
    experienceYears: Number(body.experienceYears),
    consultationFee: Number(body.consultationFee),
    availableDays: String(body.availableDays || '').trim(),
  };

  if (!data.name || !data.specialty || !data.bio || !data.availableDays) {
    return { error: 'name, specialty, bio, and availableDays are required' };
  }
  if (!Number.isInteger(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 80) {
    return { error: 'experienceYears must be between 0 and 80' };
  }
  if (!Number.isFinite(data.consultationFee) || data.consultationFee <= 0 || data.consultationFee > 100000) {
    return { error: 'consultationFee must be a valid positive number' };
  }
  const days = normalizeAvailableDays(data.availableDays);
  if (days.error) return days;
  data.availableDays = days.value;

  return { data };
}

function validateDoctorSelfProfilePayload(body) {
  if (!body || typeof body !== 'object') {
    return { error: 'invalid payload' };
  }

  const data = {
    specialty: String(body.specialty || '').trim(),
    bio: String(body.bio || '').trim(),
    experienceYears: Number(body.experienceYears),
    consultationFee: Number(body.consultationFee),
    availableDays: String(body.availableDays || '').trim(),
  };

  if (!data.specialty || !data.bio || !data.availableDays) {
    return { error: 'specialty, bio, and availableDays are required' };
  }
  if (!Number.isInteger(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 80) {
    return { error: 'experienceYears must be between 0 and 80' };
  }
  if (!Number.isFinite(data.consultationFee) || data.consultationFee <= 0 || data.consultationFee > 100000) {
    return { error: 'consultationFee must be a valid positive number' };
  }
  const days = normalizeAvailableDays(data.availableDays);
  if (days.error) return days;
  data.availableDays = days.value;

  return { data };
}

function normalizeAvailableDays(availableDays) {
  const order = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const valid = new Set(order);
  const selected = new Set(
    String(availableDays || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );

  if (selected.size === 0) {
    return { error: 'please select at least one available day' };
  }

  for (const day of selected) {
    if (!valid.has(day)) {
      return { error: 'availableDays must be comma-separated weekday codes like Sun, Mon, Tue' };
    }
  }

  return {
    value: order.filter((day) => selected.has(day)).join(', '),
  };
}

function weekdayShortFromDate(dateISO) {
  const [year, month, day] = String(dateISO || '').split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
  const date = new Date(year, month - 1, day);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()] || '';
}

function isDoctorAvailableOnDate(availableDays, bookingDate) {
  const weekday = weekdayShortFromDate(bookingDate);
  if (!weekday) return false;
  const allowed = new Set(
    String(availableDays || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
  );
  return allowed.has(weekday);
}

function isValidStatus(status) {
  return BOOKING_STATUSES.includes(normalizeBookingStatus(status));
}

function normalizeBookingStatus(status) {
  const normalized = String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['schedulelater', 'scheduled_later', 'scheduledlater'].includes(normalized)) return 'schedule_later';
  return normalized;
}

function hasColumn(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function hasTable(tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(String(tableName || ''));
  return Boolean(row);
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function regionFromSmtpHost(host) {
  const match = String(host || '')
    .trim()
    .toLowerCase()
    .match(/^email-smtp\.([a-z0-9-]+)\.amazonaws\.com$/);
  return match?.[1] || '';
}

function hasSesApiCredentials() {
  return Boolean(SES_API_ACCESS_KEY_ID && SES_API_SECRET_ACCESS_KEY && SES_API_REGION);
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function hmacSha256(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function amzDateParts(date = new Date()) {
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, dateStamp: amzDate.slice(0, 8) };
}

function awsSigV4Authorization({ method, host, canonicalUri, payloadHash, amzDate, dateStamp, includeContentHeaders = true }) {
  const service = 'ses';
  const credentialScope = `${dateStamp}/${SES_API_REGION}/${service}/aws4_request`;

  const baseHeaders = {
    host,
    'x-amz-date': amzDate,
  };
  if (includeContentHeaders) {
    baseHeaders['content-type'] = 'application/json';
    baseHeaders['x-amz-content-sha256'] = payloadHash;
  }
  if (SES_API_SESSION_TOKEN) {
    baseHeaders['x-amz-security-token'] = SES_API_SESSION_TOKEN;
  }

  const sortedHeaderKeys = Object.keys(baseHeaders).sort();
  const canonicalHeaders = sortedHeaderKeys
    .map((key) => `${key}:${String(baseHeaders[key]).trim()}\n`)
    .join('');
  const signedHeaders = sortedHeaderKeys.join(';');
  const canonicalRequest = [
    method.toUpperCase(),
    canonicalUri,
    '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const kDate = hmacSha256(`AWS4${SES_API_SECRET_ACCESS_KEY}`, dateStamp);
  const kRegion = hmacSha256(kDate, SES_API_REGION);
  const kService = hmacSha256(kRegion, service);
  const kSigning = hmacSha256(kService, 'aws4_request');
  const signature = hmacSha256(kSigning, stringToSign, 'hex');

  return {
    headers: {
      Host: baseHeaders.host,
      'X-Amz-Date': baseHeaders['x-amz-date'],
      ...(includeContentHeaders ? { 'Content-Type': baseHeaders['content-type'] } : {}),
      ...(includeContentHeaders ? { 'X-Amz-Content-Sha256': baseHeaders['x-amz-content-sha256'] } : {}),
      ...(SES_API_SESSION_TOKEN ? { 'X-Amz-Security-Token': SES_API_SESSION_TOKEN } : {}),
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${SES_API_ACCESS_KEY_ID}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

async function sesApiRequest(method, pathName, payload = null) {
  if (!hasSesApiCredentials()) {
    return {
      ok: false,
      configured: false,
      message:
        'SES identity API is not configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or SES_API_* equivalents).',
    };
  }

  const host = `email.${SES_API_REGION}.amazonaws.com`;
  const canonicalUri = String(pathName || '/');
  const body = payload ? JSON.stringify(payload) : '';
  const payloadHash = sha256Hex(body);
  const includeContentHeaders = String(method || '').toUpperCase() !== 'GET';
  const { amzDate, dateStamp } = amzDateParts();
  const signed = awsSigV4Authorization({
    method,
    host,
    canonicalUri,
    payloadHash,
    amzDate,
    dateStamp,
    includeContentHeaders,
  });

  const headers = { ...signed.headers };
  if (body) {
    headers['Content-Length'] = String(Buffer.byteLength(body));
  }

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: host,
        port: 443,
        method,
        path: canonicalUri,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = { message: raw };
          }

          const statusCode = Number(res.statusCode || 500);
          if (statusCode >= 200 && statusCode < 300) {
            resolve({ ok: true, data: parsed, statusCode });
            return;
          }

          resolve({
            ok: false,
            statusCode,
            data: parsed,
            message: parsed?.message || parsed?.Message || `SES API request failed with ${statusCode}`,
          });
        });
      }
    );

    req.on('error', (error) => {
      resolve({
        ok: false,
        statusCode: 500,
        message: `SES API request failed: ${error.message}`,
      });
    });

    if (body) req.write(body);
    req.end();
  });
}

async function getSesIdentityStatus(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const result = await sesApiRequest('GET', `/v2/email/identities/${normalizedEmail}`);
  if (!result.ok) {
    if (!result.configured && result.message) {
      return { ok: false, statusCode: 400, message: result.message };
    }
    if (result.statusCode === 404) {
      return { ok: false, statusCode: 404, message: 'Email identity not found. Request verification first.' };
    }
    return { ok: false, statusCode: result.statusCode || 500, message: result.message || 'Unable to read SES identity status.' };
  }

  const status = String(result.data?.VerificationStatus || 'UNKNOWN').toUpperCase();
  return { ok: true, status };
}

async function requestSesRecipientVerification(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!hasSesApiCredentials()) {
    return {
      ok: false,
      configured: false,
      message:
        'SES identity API is not configured. Set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY (or SES_API_* equivalents).',
    };
  }

  const createResult = await sesApiRequest('POST', '/v2/email/identities', { EmailIdentity: normalizedEmail });
  const createMessage = String(createResult.message || '').toLowerCase();
  const identityAlreadyExists = createMessage.includes('already exist');
  if (!createResult.ok && createResult.statusCode !== 409 && !identityAlreadyExists) {
    return {
      ok: false,
      configured: true,
      message: createResult.message || 'Unable to request email verification.',
    };
  }

  return {
    ok: true,
    status: 'PENDING',
  };
}

async function sendSignupConfirmationEmail(toEmail, name) {
  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !fromEmail) {
    return {
      ok: false,
      statusCode: 500,
      message: 'Email service is not configured. Please contact support.',
    };
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: 'Signup Verification Check',
      text: `Hello ${name || 'User'}, your email has been verified and signup can continue.`,
    });
    return { ok: true };
  } catch (error) {
    const responseText = String(error?.response || '').toLowerCase();
    const isUnverified =
      Number(error?.responseCode) === 554 &&
      responseText.includes('email address is not verified');

    if (isUnverified) {
      return {
        ok: false,
        code: 'UNVERIFIED',
        statusCode: 400,
        message: 'Verification email sent. Click the verification link in your inbox, then sign up again.',
      };
    }

    return {
      ok: false,
      code: 'SEND_FAILED',
      statusCode: 500,
      message: 'Unable to send verification check email. Please try again.',
    };
  }
}

async function sendCouponEmail({ toEmail, recipientName, code, discountValue, appliesTo, expiresAt }) {
  const normalizedToEmail = String(toEmail || '').trim().toLowerCase();
  if (!normalizedToEmail) {
    return { ok: false, statusCode: 400, message: 'Recipient email is required.' };
  }

  const appliesLabel = 'all payments';
  const expiryLabel = expiresAt ? formatDateAsDayMonthYear(expiresAt) : 'No expiry date';
  const discountLabel = `Rs. ${Number(discountValue || 0).toLocaleString('en-IN')} off`;
  const subject = `Your ${discountLabel} coupon`;
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const text =
    `${greeting}\n\n` +
    `Here is your single-use coupon code: ${String(code || '').trim()}\n` +
    `Discount: ${discountLabel} (${appliesLabel})\n` +
    `Expiry: ${expiryLabel}\n\n` +
    `Use this code at checkout. It can be redeemed only once.\n\n` +
    `If you did not expect this email, please ignore it.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <p style="margin: 0 0 12px;">${escapeHtml(greeting)}</p>
      <p style="margin: 0 0 12px;">Here is your single-use coupon code:</p>
      <div style="display: inline-block; padding: 10px 14px; border-radius: 8px; background: #f3f4f6; font-size: 20px; font-weight: 700; letter-spacing: 1px;">
        ${escapeHtml(String(code || '').trim())}
      </div>
      <p style="margin: 12px 0 0;">Discount: ${escapeHtml(discountLabel)} (${escapeHtml(appliesLabel)})</p>
      <p style="margin: 6px 0 0;">Expiry: ${escapeHtml(expiryLabel)}</p>
      <p style="margin: 12px 0 0;">Use this code at checkout. It can be redeemed only once.</p>
      <p style="margin: 12px 0 0; color: #6b7280;">If you did not expect this email, please ignore it.</p>
    </div>
  `;

  if (SENDGRID_API_KEY && SENDGRID_MARKETING_FROM_EMAIL) {
    if (!isValidEmail(SENDGRID_MARKETING_FROM_EMAIL)) {
      return { ok: false, statusCode: 500, message: 'SENDGRID_MARKETING_FROM_EMAIL is invalid.' };
    }
    if (
      SENDGRID_MARKETING_VERIFIED_SENDER &&
      SENDGRID_MARKETING_FROM_EMAIL.toLowerCase() !== SENDGRID_MARKETING_VERIFIED_SENDER.toLowerCase()
    ) {
      return {
        ok: false,
        statusCode: 500,
        message: 'SENDGRID_MARKETING_FROM_EMAIL does not match SENDGRID_MARKETING_VERIFIED_SENDER.',
      };
    }
    try {
      await sgMail.send({
        to: normalizedToEmail,
        from: SENDGRID_MARKETING_FROM_EMAIL,
        subject,
        text,
        html,
        headers: buildMarketingHeaders(),
      });
      return { ok: true };
    } catch (error) {
      const sendGridError = extractSendGridErrorDetails(error);
      console.error('Failed to send coupon email via SendGrid:', {
        statusCode: sendGridError.statusCode,
        detail: sendGridError.detail,
        responseBody: sendGridError.responseBody,
      });
      return {
        ok: false,
        statusCode: sendGridError.statusCode || 500,
        message:
          sendGridError.statusCode === 403
            ? 'SendGrid rejected the sender identity. Verify the configured FROM email or authenticated domain.'
            : 'Unable to send coupon email. Please try again.',
      };
    }
  }

  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_MARKETING_FROM || SENDGRID_MARKETING_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !fromEmail) {
    return {
      ok: false,
      statusCode: 500,
      message: 'Email service is not configured. Please contact support.',
    };
  }

  try {
    await transporter.sendMail({
      from: fromEmail,
      to: normalizedToEmail,
      subject,
      text,
      html,
      headers: buildMarketingHeaders(),
    });
    return { ok: true };
  } catch (error) {
    console.error('Failed to send coupon email via SMTP:', error);
    return {
      ok: false,
      statusCode: 500,
      message: 'Unable to send coupon email. Please try again.',
    };
  }
}

function formatDateTimeWithComma(bookingDate, bookingTime) {
  const normalizedDate = String(bookingDate || '').trim();
  const normalizedTime = String(bookingTime || '').trim();
  if (!normalizedDate || !normalizedTime) return `${normalizedDate} ${normalizedTime}`.trim();
  if (normalizedTime.includes('-')) return `${formatDateAsDayMonthYear(normalizedDate)}, ${normalizedTime}`;

  let dt = new Date(`${normalizedDate}T${normalizedTime}:00`);
  if (Number.isNaN(dt.getTime())) {
    const timeMatch = normalizedTime.match(/^(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
    if (timeMatch) {
      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2]);
      const meridiem = String(timeMatch[3] || '').toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      dt = new Date(`${normalizedDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    }
  }
  if (Number.isNaN(dt.getTime())) return `${normalizedDate}, ${normalizedTime}`;

  const datePart = formatDateAsDayMonthYear(dt);
  const timePart = dt.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const endTime = new Date(dt.getTime() + 60 * 60 * 1000);
  const endTimePart = endTime.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart}, ${timePart} - ${endTimePart}`;
}

function formatInvoiceDateTime(value) {
  if (!value) return '';
  const raw = String(value || '').trim();
  const normalized = raw.replace(' ', 'T');
  const hasExplicitTimezone = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalized);
  const parsed = value instanceof Date ? value : new Date(hasExplicitTimezone ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateAsDayMonthYear(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}/${month}/${year}`;
}

async function sendBookingPaymentLinkEmail({
  toEmail,
  recipientName,
  serviceName,
  bookingDate,
  bookingTime,
  paymentLinkUrl,
  bookingId,
  userId,
}) {
  const normalizedToEmail = String(toEmail || '').trim().toLowerCase();
  if (!normalizedToEmail || !isValidEmail(normalizedToEmail)) {
    return { ok: false, statusCode: 400, message: 'Valid recipient email is required.' };
  }

  const bookingLabel =
    bookingDate && bookingTime ? formatDateTimeWithComma(bookingDate, bookingTime) : `${String(bookingDate || '').trim()} ${String(bookingTime || '').trim()}`.trim();
  const subject = `Your H2 booking link: ${String(serviceName || 'Session').trim()}`;
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const safeLink = String(paymentLinkUrl || '').trim();
  if (!safeLink) {
    return { ok: false, statusCode: 400, message: 'Payment link URL is required.' };
  }
  let parsedPaymentUrl = null;
  try {
    parsedPaymentUrl = new URL(safeLink);
  } catch {
    return { ok: false, statusCode: 400, message: 'Payment link URL is invalid.' };
  }
  if (!['http:', 'https:'].includes(String(parsedPaymentUrl.protocol || '').toLowerCase())) {
    return { ok: false, statusCode: 400, message: 'Payment link URL protocol is invalid.' };
  }
  const text =
    `${greeting}\n\n` +
    `Your session has been reserved with H2 House Of Health.\n` +
    `Service: ${String(serviceName || 'Booking Session').trim()}\n` +
    `Schedule: ${bookingLabel || '-'}\n\n` +
    `To confirm this booking, please use your secure link:\n${safeLink}\n\n` +
    `If you did not request this booking, please ignore this email.`;

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Arial, sans-serif; line-height: 1.6; color: #1f2937; background: #f9fafb; padding: 24px;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden;">
        <div style="padding: 16px 20px; background: linear-gradient(135deg, #fff7ed, #ffedd5); border-bottom: 1px solid #fed7aa;">
          <h2 style="margin: 0; font-size: 18px; color: #7c2d12;">H2 House Of Health</h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: #9a3412;">Your booking is on hold for confirmation</p>
        </div>
        <div style="padding: 18px 20px 20px;">
          <p style="margin: 0 0 12px;">${escapeHtml(greeting)}</p>
          <p style="margin: 0 0 10px;">Thank you for booking with us. Please confirm your session using the secure link below.</p>
          <p style="margin: 0 0 4px;"><strong>Service:</strong> ${escapeHtml(String(serviceName || 'Booking Session').trim())}</p>
          <p style="margin: 0 0 16px;"><strong>Schedule:</strong> ${escapeHtml(bookingLabel || '-')}</p>
          <a href="${escapeHtml(safeLink)}" style="display: inline-block; background: #c96a2d; color: #ffffff; text-decoration: none; padding: 11px 18px; border-radius: 8px; font-weight: 700;">Open Secure Booking Link</a>
          <p style="margin: 14px 0 0; font-size: 13px; color: #4b5563;">If the button does not open, copy this link:</p>
          <p style="margin: 6px 0 0; word-break: break-all; font-size: 13px;"><a href="${escapeHtml(safeLink)}">${escapeHtml(safeLink)}</a></p>
          <p style="margin: 14px 0 0; font-size: 12px; color: #6b7280;">If you did not request this booking, you can safely ignore this email.</p>
        </div>
      </div>
    </div>
  `;

  if (SENDGRID_API_KEY) {
    const senderCandidates = getSendGridBookingSenderCandidates();
    if (!senderCandidates.length) {
      return { ok: false, statusCode: 500, message: 'SendGrid booking sender email is not configured.' };
    }

    let lastSendGridError = null;
    for (const fromEmail of senderCandidates) {
      try {
        const [sendGridResponse] = await sgMail.send({
          to: normalizedToEmail,
          from: fromEmail,
          subject,
          text,
          html,
          customArgs: {
            context: 'booking_payment_link',
            bookingId: String(bookingId || ''),
            userId: String(userId || ''),
          },
          categories: ['booking_payment_link'],
        });
        const statusCode = Number(sendGridResponse?.statusCode || 0);
        const headers = sendGridResponse?.headers || {};
        const messageId = String(
          (typeof headers.get === 'function' ? headers.get('x-message-id') : headers['x-message-id'] || headers['X-Message-Id']) || ''
        ).trim();

        console.log('Payment link email send attempt result (SendGrid):', {
          to: normalizedToEmail,
          from: fromEmail,
          subject,
          statusCode,
          messageId,
        });

        if (statusCode !== 202) {
          lastSendGridError = {
            statusCode: statusCode || 502,
            detail: `SendGrid did not return 202 accepted. Received ${statusCode || 'unknown'}.`,
          };
          continue;
        }

        return { ok: true, delivery: 'sendgrid', statusCode, messageId };
      } catch (error) {
        const sendGridError = extractSendGridErrorDetails(error);
        lastSendGridError = sendGridError;
        console.error('Failed to send booking payment link email via SendGrid:', {
          to: normalizedToEmail,
          from: fromEmail,
          subject,
          statusCode: sendGridError.statusCode,
          detail: sendGridError.detail,
          responseBody: sendGridError.responseBody,
        });
        if (![401, 403].includes(Number(sendGridError.statusCode || 0))) {
          break;
        }
      }
    }

    return {
      ok: false,
      statusCode: lastSendGridError?.statusCode || 500,
      message:
        Number(lastSendGridError?.statusCode || 0) === 403
          ? 'SendGrid rejected all configured sender identities. Verify SENDGRID_BOOKING_FROM_EMAIL or authenticate the sender domain.'
          : 'Unable to send payment link email. Please try again.',
    };
  }

  const transporter = getTransporter();
  const fromEmail = process.env.SMTP_BOOKING_FROM || SENDGRID_BOOKING_FROM_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !fromEmail) {
    if (ALLOW_DEV_OTP_FALLBACK) {
      const messageId = `dev-console-${Date.now()}`;
      console.warn(`[DEV MAIL FALLBACK] Payment link for ${normalizedToEmail}: ${safeLink}`);
      console.log('Payment link email send attempt result (DEV console):', {
        to: normalizedToEmail,
        from: 'console',
        subject,
        statusCode: 202,
        messageId,
      });
      return { ok: true, delivery: 'console', statusCode: 202, messageId };
    }
    return {
      ok: false,
      statusCode: 500,
      message: 'Email service is not configured. Please contact support.',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: fromEmail,
      to: normalizedToEmail,
      subject,
      text,
      html,
    });
    const messageId = String(info?.messageId || '').trim();
    console.log('Payment link email send attempt result (SMTP):', {
      to: normalizedToEmail,
      from: fromEmail,
      subject,
      statusCode: 202,
      messageId,
    });
    return { ok: true, delivery: 'smtp', statusCode: 202, messageId };
  } catch (error) {
    console.error('Failed to send booking payment link email via SMTP:', {
      to: normalizedToEmail,
      from: fromEmail,
      subject,
      error: String(error?.message || error),
    });
    return {
      ok: false,
      statusCode: 500,
      message: 'Unable to send payment link email. Please try again.',
    };
  }
}

async function sendOtpEmail(toEmail, otp, purpose = 'signup') {
  const normalizedToEmail = String(toEmail || '').trim().toLowerCase();
  const otpValue = String(otp || '').trim();
  const normalizedPurpose = String(purpose || '').trim().toLowerCase();
  const isPasswordReset = normalizedPurpose === 'password_reset';
  const isBookingReschedule = normalizedPurpose === 'booking_reschedule';
  const flowLabel = isBookingReschedule ? 'booking reschedule' : isPasswordReset ? 'password reset' : 'signup';

  if (!SENDGRID_API_KEY || !SENDGRID_OTP_FROM_EMAIL) {
    if (ALLOW_DEV_OTP_FALLBACK) {
      return {
        ok: true,
        delivery: 'development-ui',
        message: `OTP generated for ${normalizedToEmail}. Use the development code shown below.`,
      };
    }

    return {
      ok: false,
      statusCode: 500,
      message: 'SendGrid is not configured. Please contact support.',
    };
  }

  const subject = isBookingReschedule
    ? 'Booking Reschedule Verification'
    : isPasswordReset
      ? 'Password Reset Verification'
      : 'Sign Up Verification';
  const heading = subject;
  const intro = isBookingReschedule
    ? 'Share this OTP with H2 House Of Health staff to confirm your booking reschedule.'
    : isPasswordReset
      ? 'Use the OTP below to continue resetting your password.'
      : 'Use the OTP below to complete your sign up.';
  const text = `${heading}\n\n${intro}\n\nOTP: ${otpValue}\nValid for: ${OTP_TTL_MINUTES} minutes\n\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #1f2937;">
      <h2 style="margin: 0 0 16px;">${heading}</h2>
      <p style="margin: 0 0 12px;">${intro}</p>
      <p style="margin: 0 0 8px;">Your OTP is:</p>
      <div style="display: inline-block; padding: 12px 18px; border-radius: 8px; background: #f3f4f6; font-size: 24px; font-weight: 700; letter-spacing: 4px;">
        ${otpValue}
      </div>
      <p style="margin: 16px 0 0;">This OTP is valid for ${OTP_TTL_MINUTES} minutes.</p>
      <p style="margin: 12px 0 0; color: #6b7280;">If you did not request this, please ignore this email.</p>
    </div>
  `;

  if (!isValidEmail(SENDGRID_OTP_FROM_EMAIL)) {
    return {
      ok: false,
      statusCode: 500,
      message: 'SENDGRID_OTP_FROM_EMAIL is invalid.',
    };
  }
  if (
    SENDGRID_OTP_VERIFIED_SENDER &&
    SENDGRID_OTP_FROM_EMAIL.toLowerCase() !== SENDGRID_OTP_VERIFIED_SENDER.toLowerCase()
  ) {
    return {
      ok: false,
      statusCode: 500,
      message: 'SENDGRID_OTP_FROM_EMAIL does not match SENDGRID_OTP_VERIFIED_SENDER.',
    };
  }

  try {
    await sendMailgunEmail({
  to: normalizedToEmail,
  from: MAIL_FROM,
  subject,
  text,
  html,
    });

    return {
      ok: true,
      delivery: 'mailgun',
      message: `${isBookingReschedule ? 'Booking reschedule' : isPasswordReset ? 'Password reset' : 'Signup'} OTP sent to ${normalizedToEmail}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    };
  } catch (error) {
    const sendGridError = extractSendGridErrorDetails(error);
    console.error('Failed to send OTP email via SendGrid:', {
      to: normalizedToEmail,
      from: SENDGRID_OTP_FROM_EMAIL,
      statusCode: sendGridError.statusCode,
      detail: sendGridError.detail,
      responseBody: sendGridError.responseBody,
    });
    const statusCode = sendGridError.statusCode;
    if (ALLOW_DEV_OTP_FALLBACK) {
      return {
        ok: true,
        delivery: 'development-ui',
        message: `OTP generated for ${normalizedToEmail}. Use the development code shown below.`,
      };
    }
    const isUnauthorized = statusCode === 401 || statusCode === 403;

    return {
      ok: false,
      statusCode,
      message: isUnauthorized
        ? statusCode === 403
          ? 'SendGrid rejected the sender identity. Verify the configured FROM email or authenticated domain.'
          : 'SendGrid authentication failed. Please contact support.'
        : 'Unable to send OTP email. Please try again.',
    };
  }
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      age INTEGER,
      gender TEXT,
      mobile TEXT,
      google_id TEXT,
      avatar_url TEXT,
      membership_status TEXT NOT NULL DEFAULT 'inactive',
      membership_plan TEXT,
      membership_started_at TEXT,
      membership_expires_at TEXT,
      membership_people_count INTEGER,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      bio TEXT NOT NULL,
      experience_years INTEGER NOT NULL,
      consultation_fee INTEGER NOT NULL,
      available_days TEXT NOT NULL,
      approval_status TEXT NOT NULL DEFAULT 'approved',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      doctor_id INTEGER REFERENCES doctors(id),
      booking_group_id TEXT,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      client_phone TEXT NOT NULL,
      service_name TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      assigned_staff TEXT NOT NULL,
      status TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      paid_at TEXT,
      payment_order_id TEXT,
      paid_amount_paise INTEGER,
      payment_reference TEXT,
      payment_method TEXT,
      is_topup_session INTEGER NOT NULL DEFAULT 0,
      reschedule_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      guest_name TEXT,
      guest_email TEXT,
      guest_phone TEXT,
      booking_type TEXT NOT NULL DEFAULT 'registered',
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS booking_email_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      event_name TEXT NOT NULL,
      recipient_email TEXT,
      message_id TEXT,
      sg_event_id TEXT,
      dedupe_key TEXT,
      detail TEXT,
      event_at TEXT NOT NULL,
      raw_payload TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS booking_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
      note_text TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_registrations (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts_left INTEGER NOT NULL,
      otp_verified INTEGER NOT NULL DEFAULT 0,
      registration_role TEXT NOT NULL DEFAULT 'user',
      doctor_profile_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_login_otps (
      email TEXT PRIMARY KEY,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts_left INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_password_resets (
      email TEXT PRIMARY KEY,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts_left INTEGER NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_booking_reschedules (
      booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
      otp_hash TEXT NOT NULL,
      booking_date TEXT NOT NULL,
      booking_time TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts_left INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS membership_payment_orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      plan_id TEXT NOT NULL,
      people_count INTEGER NOT NULL DEFAULT 1,
      member_details_json TEXT,
      original_amount_paise INTEGER,
      discount_amount_paise INTEGER NOT NULL DEFAULT 0,
      coupon_id INTEGER REFERENCES coupons(id),
      coupon_code TEXT,
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS membership_subscriptions (
      subscription_id TEXT PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan_id TEXT NOT NULL,
      people_count INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS membership_subscription_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subscription_id TEXT NOT NULL REFERENCES membership_subscriptions(subscription_id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      place TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      is_registered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(subscription_id, email)
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      discount_type TEXT NOT NULL,
      discount_value REAL NOT NULL,
      applies_to TEXT NOT NULL DEFAULT 'all',
      max_redemptions INTEGER,
      per_user_limit INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      coupon_type TEXT NOT NULL DEFAULT 'public',
      assigned_user_email TEXT,
      used_by TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      valid_from TEXT,
      valid_till TEXT,
      recipient_email TEXT,
      recipient_name TEXT,
      festival_name TEXT,
      emailed_at TEXT,
      email_status TEXT,
      email_error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS coupon_redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coupon_id INTEGER NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      context_type TEXT NOT NULL,
      context_ref TEXT NOT NULL,
      discount_amount_paise INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cart_payment_orders (
      order_id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_amount_paise INTEGER NOT NULL,
      discount_amount_paise INTEGER NOT NULL DEFAULT 0,
      coupon_id INTEGER REFERENCES coupons(id),
      coupon_code TEXT,
      amount_paise INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_reference TEXT,
      paid_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_discount_phones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone_key TEXT NOT NULL UNIQUE,
      phone_display TEXT NOT NULL,
      discount_percent REAL NOT NULL,
      redeemed_at TEXT,
      redeemed_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_user_date
      ON bookings(user_id, booking_date, booking_time);
    CREATE INDEX IF NOT EXISTS idx_booking_email_events_booking_event_at
      ON booking_email_events(booking_id, event_at);
    CREATE INDEX IF NOT EXISTS idx_admin_discount_phones_phone_key
      ON admin_discount_phones(phone_key);
    CREATE INDEX IF NOT EXISTS idx_membership_subscription_members_email
      ON membership_subscription_members(email);
    CREATE INDEX IF NOT EXISTS idx_membership_subscriptions_owner
      ON membership_subscriptions(owner_user_id, status, expires_at);
  `);

  if (!hasColumn('users', 'role')) {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  }

  if (!hasColumn('users', 'age')) {
    db.exec('ALTER TABLE users ADD COLUMN age INTEGER');
  }

  if (!hasColumn('users', 'gender')) {
    db.exec('ALTER TABLE users ADD COLUMN gender TEXT');
  }

  if (!hasColumn('users', 'mobile')) {
    db.exec('ALTER TABLE users ADD COLUMN mobile TEXT');
  }

  if (!hasColumn('users', 'google_id')) {
    db.exec('ALTER TABLE users ADD COLUMN google_id TEXT');
  }

  if (!hasColumn('users', 'avatar_url')) {
    db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
  }

  if (!hasColumn('users', 'membership_status')) {
    db.exec("ALTER TABLE users ADD COLUMN membership_status TEXT NOT NULL DEFAULT 'inactive'");
  }

  if (!hasColumn('users', 'membership_plan')) {
    db.exec('ALTER TABLE users ADD COLUMN membership_plan TEXT');
  }

  if (!hasColumn('users', 'membership_started_at')) {
    db.exec('ALTER TABLE users ADD COLUMN membership_started_at TEXT');
  }

  if (!hasColumn('users', 'membership_expires_at')) {
    db.exec('ALTER TABLE users ADD COLUMN membership_expires_at TEXT');
  }

  if (!hasColumn('users', 'membership_people_count')) {
    db.exec('ALTER TABLE users ADD COLUMN membership_people_count INTEGER');
  }

  if (!hasColumn('users', 'membership_subscription_id')) {
    db.exec('ALTER TABLE users ADD COLUMN membership_subscription_id TEXT');
  }

  if (!hasColumn('bookings', 'doctor_id')) {
    db.exec('ALTER TABLE bookings ADD COLUMN doctor_id INTEGER REFERENCES doctors(id)');
  }

  if (!hasColumn('bookings', 'booking_group_id')) {
    db.exec('ALTER TABLE bookings ADD COLUMN booking_group_id TEXT');
  }

  if (!hasColumn('doctors', 'user_id')) {
    db.exec('ALTER TABLE doctors ADD COLUMN user_id INTEGER');
  }

  if (!hasColumn('doctors', 'approval_status')) {
    db.exec("ALTER TABLE doctors ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'");
  }

  if (!hasColumn('pending_registrations', 'registration_role')) {
    db.exec("ALTER TABLE pending_registrations ADD COLUMN registration_role TEXT NOT NULL DEFAULT 'user'");
  }

  if (!hasColumn('pending_registrations', 'doctor_profile_json')) {
    db.exec('ALTER TABLE pending_registrations ADD COLUMN doctor_profile_json TEXT');
  }

  if (!hasColumn('pending_registrations', 'otp_verified')) {
    db.exec("ALTER TABLE pending_registrations ADD COLUMN otp_verified INTEGER NOT NULL DEFAULT 0");
  }

  if (!hasColumn('pending_password_resets', 'verified')) {
    db.exec("ALTER TABLE pending_password_resets ADD COLUMN verified INTEGER NOT NULL DEFAULT 0");
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'people_count')) {
    db.exec("ALTER TABLE membership_payment_orders ADD COLUMN people_count INTEGER NOT NULL DEFAULT 1");
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'member_details_json')) {
    db.exec('ALTER TABLE membership_payment_orders ADD COLUMN member_details_json TEXT');
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'original_amount_paise')) {
    db.exec('ALTER TABLE membership_payment_orders ADD COLUMN original_amount_paise INTEGER');
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'discount_amount_paise')) {
    db.exec("ALTER TABLE membership_payment_orders ADD COLUMN discount_amount_paise INTEGER NOT NULL DEFAULT 0");
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'coupon_id')) {
    db.exec('ALTER TABLE membership_payment_orders ADD COLUMN coupon_id INTEGER REFERENCES coupons(id)');
  }

  if (hasTable('membership_payment_orders') && !hasColumn('membership_payment_orders', 'coupon_code')) {
    db.exec('ALTER TABLE membership_payment_orders ADD COLUMN coupon_code TEXT');
  }

  if (hasTable('coupons') && !hasColumn('coupons', 'recipient_email')) {
    db.exec('ALTER TABLE coupons ADD COLUMN recipient_email TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'coupon_type')) {
    db.exec("ALTER TABLE coupons ADD COLUMN coupon_type TEXT NOT NULL DEFAULT 'public'");
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'assigned_user_email')) {
    db.exec('ALTER TABLE coupons ADD COLUMN assigned_user_email TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'used_by')) {
    db.exec("ALTER TABLE coupons ADD COLUMN used_by TEXT NOT NULL DEFAULT '[]'");
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'is_active')) {
    db.exec('ALTER TABLE coupons ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'valid_from')) {
    db.exec('ALTER TABLE coupons ADD COLUMN valid_from TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'valid_till')) {
    db.exec('ALTER TABLE coupons ADD COLUMN valid_till TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'recipient_name')) {
    db.exec('ALTER TABLE coupons ADD COLUMN recipient_name TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'festival_name')) {
    db.exec('ALTER TABLE coupons ADD COLUMN festival_name TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'emailed_at')) {
    db.exec('ALTER TABLE coupons ADD COLUMN emailed_at TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'email_status')) {
    db.exec('ALTER TABLE coupons ADD COLUMN email_status TEXT');
  }
  if (hasTable('coupons') && !hasColumn('coupons', 'email_error')) {
    db.exec('ALTER TABLE coupons ADD COLUMN email_error TEXT');
  }
  if (hasTable('coupons')) {
    db.exec(`
      UPDATE coupons
      SET coupon_type = CASE
          WHEN LOWER(TRIM(COALESCE(coupon_type, ''))) IN ('public', 'private') THEN LOWER(TRIM(coupon_type))
          WHEN TRIM(COALESCE(assigned_user_email, recipient_email, '')) <> '' THEN 'private'
          ELSE 'public'
        END,
        assigned_user_email = COALESCE(NULLIF(TRIM(assigned_user_email), ''), NULLIF(TRIM(recipient_email), '')),
        used_by = CASE
          WHEN used_by IS NULL OR TRIM(used_by) = '' THEN '[]'
          ELSE used_by
        END,
        is_active = CASE
          WHEN is_active IS NULL THEN COALESCE(active, 1)
          ELSE is_active
        END,
        valid_till = COALESCE(valid_till, expires_at);
    `);
  }
  if (hasTable('admin_discount_phones') && !hasColumn('admin_discount_phones', 'redeemed_at')) {
    db.exec('ALTER TABLE admin_discount_phones ADD COLUMN redeemed_at TEXT');
  }
  if (hasTable('admin_discount_phones') && !hasColumn('admin_discount_phones', 'redeemed_booking_id')) {
    db.exec('ALTER TABLE admin_discount_phones ADD COLUMN redeemed_booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL');
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_doctors_user_id
      ON doctors(user_id)
      WHERE user_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_bookings_doctor_slot_active
      ON bookings(doctor_id, booking_date, booking_time)
      WHERE status IN ('pending', 'booked', 'confirmed');

    CREATE INDEX IF NOT EXISTS idx_bookings_service_slot_active
      ON bookings(service_name, booking_date, booking_time)
      WHERE status IN ('pending', 'booked', 'confirmed');

    CREATE INDEX IF NOT EXISTS idx_membership_payment_orders_user_status
      ON membership_payment_orders(user_id, status, created_at);

    CREATE INDEX IF NOT EXISTS idx_bookings_group_id
      ON bookings(booking_group_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_email_events_sg_event_id
      ON booking_email_events(sg_event_id)
      WHERE sg_event_id IS NOT NULL AND sg_event_id <> '';

    CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_email_events_dedupe_key
      ON booking_email_events(dedupe_key)
      WHERE dedupe_key IS NOT NULL AND dedupe_key <> '';

    CREATE INDEX IF NOT EXISTS idx_booking_notes_booking_created
      ON booking_notes(booking_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_coupons_code
      ON coupons(code);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_redemptions_context
      ON coupon_redemptions(coupon_id, user_id, context_type, context_ref);

    CREATE INDEX IF NOT EXISTS idx_cart_payment_orders_user_status
      ON cart_payment_orders(user_id, status, created_at);
  `);

  if (!hasColumn('bookings', 'payment_status')) {
    db.exec("ALTER TABLE bookings ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid'");
  }

  if (!hasColumn('bookings', 'paid_at')) {
    db.exec('ALTER TABLE bookings ADD COLUMN paid_at TEXT');
  }

  if (!hasColumn('bookings', 'payment_reference')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_reference TEXT');
  }

  if (!hasColumn('bookings', 'payment_method')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_method TEXT');
  }

  if (!hasColumn('bookings', 'payment_order_id')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_order_id TEXT');
  }
  if (!hasColumn('bookings', 'paid_amount_paise')) {
    db.exec('ALTER TABLE bookings ADD COLUMN paid_amount_paise INTEGER');
  }
  if (!hasColumn('bookings', 'is_topup_session')) {
    db.exec("ALTER TABLE bookings ADD COLUMN is_topup_session INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn('bookings', 'reschedule_count')) {
    db.exec("ALTER TABLE bookings ADD COLUMN reschedule_count INTEGER NOT NULL DEFAULT 0");
  }
  if (!hasColumn('bookings', 'payment_link_recipient_email')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_recipient_email TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_emailed_at')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_emailed_at TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_email_status')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_email_status TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_email_error')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_email_error TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_delivery_status')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_delivery_status TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_delivery_detail')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_delivery_detail TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_email_event')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_email_event TEXT');
  }
  if (!hasColumn('bookings', 'payment_link_email_event_at')) {
    db.exec('ALTER TABLE bookings ADD COLUMN payment_link_email_event_at TEXT');
  }
  if (!hasColumn('bookings', 'guest_name')) {
    db.exec('ALTER TABLE bookings ADD COLUMN guest_name TEXT');
  }
  if (!hasColumn('bookings', 'guest_email')) {
    db.exec('ALTER TABLE bookings ADD COLUMN guest_email TEXT');
  }
  if (!hasColumn('bookings', 'guest_phone')) {
    db.exec('ALTER TABLE bookings ADD COLUMN guest_phone TEXT');
  }
  if (!hasColumn('bookings', 'booking_type')) {
    db.exec("ALTER TABLE bookings ADD COLUMN booking_type TEXT NOT NULL DEFAULT 'registered'");
  }
  db.exec(`
    UPDATE bookings
    SET is_topup_session = 1
    WHERE LOWER(COALESCE(payment_reference, '')) = 'buy_extra'
       OR (
         booking_group_id LIKE 'hydrogen_%'
         AND LOWER(COALESCE(notes, '')) LIKE 'hydrogen package%'
         AND LOWER(COALESCE(payment_reference, '')) NOT IN ('', 'membership', 'cash')
       );

    UPDATE bookings
    SET reschedule_count = CASE
      WHEN LOWER(COALESCE(notes, '')) LIKE '%rescheduled by user from%' THEN 1
      ELSE COALESCE(reschedule_count, 0)
    END
    WHERE COALESCE(reschedule_count, 0) = 0;
  `);
  if (hasTable('booking_email_events') && !hasColumn('booking_email_events', 'dedupe_key')) {
    db.exec('ALTER TABLE booking_email_events ADD COLUMN dedupe_key TEXT');
  }

  db.exec(`
    UPDATE bookings
    SET payment_status = CASE
      WHEN status IN ('booked', 'confirmed', 'completed') THEN 'paid'
      ELSE 'unpaid'
    END
    WHERE payment_status IS NULL OR payment_status = '';
  `);

  db.exec(`
    UPDATE membership_payment_orders
    SET original_amount_paise = amount_paise
    WHERE original_amount_paise IS NULL;
  `);

  db.exec("UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''");
  db.exec("UPDATE users SET role = 'user' WHERE role = 'doctor'");
  db.exec("UPDATE users SET membership_status = 'inactive' WHERE membership_status IS NULL OR membership_status = ''");
  db.exec("UPDATE doctors SET approval_status = 'approved' WHERE approval_status IS NULL OR approval_status = ''");

  backfillPaidBookingAmounts();
  backfillMembershipSubscriptionsFromOrders();
  refreshMembershipSubscriptionStates();
  const linkedSubscriptions = db
    .prepare(
      `SELECT DISTINCT subscription_id AS subscriptionId
       FROM membership_subscription_members
       WHERE user_id IS NOT NULL`
    )
    .all();
  linkedSubscriptions.forEach((row) => {
    syncMembershipStatusForSubscription(row.subscriptionId);
  });
}

function seedDoctors() {
  const existing = db.prepare('SELECT id FROM doctors LIMIT 1').get();
  if (existing) return;

  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO doctors (
      user_id, name, specialty, bio, experience_years, consultation_fee, available_days, approval_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const doctors = [
    [
      null,
      'Dr. Olivia Bennett',
      'Physiotherapy',
      'Focuses on sports injury recovery and postural correction plans.',
      11,
      90,
      'Mon, Wed, Fri',
      'approved',
      now,
    ],
    [
      null,
      'Dr. Ethan Brooks',
      'Chiropractic Care',
      'Specializes in spinal alignment and chronic lower-back pain treatment.',
      14,
      110,
      'Tue, Thu, Sat',
      'approved',
      now,
    ],
  ];

  const txn = db.transaction((rows) => {
    for (const row of rows) insert.run(...row);
  });

  txn(doctors);
}

function seedAdmin() {
  const email = 'admin@h2health.local';
  const defaultPasswordHash = bcrypt.hashSync('Admin@12345', 10);
  const existing = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);

  if (!existing) {
    db.prepare(
      `INSERT INTO users (name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, 'admin', datetime('now'))`
    ).run('Portal Admin', email, defaultPasswordHash);
    return;
  }

  db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);

  const existingPasswordHash = String(existing.password_hash || '').trim();
  if (!existingPasswordHash) {
    db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(defaultPasswordHash, email);
  }
}

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const row = requestCounters.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > row.resetAt) {
      row.count = 0;
      row.resetAt = now + windowMs;
    }

    row.count += 1;
    requestCounters.set(key, row);

    if (row.count > max) {
      return res.status(429).json({ message: 'Too many requests. Please try again shortly.' });
    }

    return next();
  };
}
