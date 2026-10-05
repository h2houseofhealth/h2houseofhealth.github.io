# AGENTS.md

Single-service Node 20 (CommonJS) app: static marketing site + booking portal + merch store + Express/SQLite API. No build step, bundler, tests, or linter.

## Commands

- `npm install`, `npm run dev` (`node --watch booking/server.js`), `npm start`
- Open `http://localhost:3000` (server auto-bumps up to 10 ports if busy — check console for actual port)
- No test/lint/typecheck scripts exist; verify by booting the server and hitting `GET /health`

## Architecture

- Entrypoint: `booking/server.js` (~16k lines, all `/api/*` routes + `migrate()` + `seedAdmin()`). Read via grep/offsets, never whole-file.
- Mounted sub-API: `booking/merch-api.js` (`mountMerchApi(app, {...})` in server.js).
- Frontends (vanilla JS, no bundler): `booking/` (`index.html`, `app.js`, `payment.js`, `styles.css`), `merch/` (`index.html`, `app.js`, `auth.js`), root `*.html` static site.
- Frontend API base (`booking/app.js` `resolveApiUrl`): `window.__API_URL__` > same-origin on localhost > `<meta name="api-base-url">`. Local dev uses relative URLs.

## Static-serving order (matters)

`booking/server.js` registers in this order: `/booking` → `/merch` → `/uploads` static, then `GET /booking*` → `booking/index.html`, then `express.static(repo-root)`, then `GET /.*/` → root `index.html`.
- New `GET` routes/pages MUST be registered before the catch-all or they are unreachable. `POST` routes are unaffected by the `GET` catch-all.

## Database / runtime data

- `better-sqlite3`, WAL mode. Schema auto-created by `migrate()` on every boot; schema source of truth is `migrate()` in `booking/server.js`, not `booking/migrations/` (only `001-guest-checkout.js`, already folded into base schema).
- Paths: `$DATA_DIR`/`$UPLOADS_DIR`, else `booking/data/booking.db` and `booking/uploads/` (both gitignored — never commit `*.db*` or uploads).
- Seed admin on boot: `admin@h2health.local` / `Admin@12345` (`seedAdmin()` only backfills missing password/role).
- Note: `booking/config/db.js` opens a second SQLite connection used only by legacy `GET /users`; main code uses the `db` in `server.js`.

## Env / config quirks

- `booking/.env` is loaded by a custom `loadEnvFromFile` (not `dotenv.config()`); real environment variables take precedence over the file.
- `JWT_SECRET` falls back to `dev_super_secret_change_me` — set it in any shared/dev deploy.
- OTP visibility: responses include `devOtp` only when `ALLOW_DEV_OTP_FALLBACK != false` AND (`NODE_ENV != production` OR `SHOW_DEV_OTP_IN_UI=true`).
- Razorpay is hard-gated: `RAZORPAY_MODE=test` AND `RAZORPAY_KEY_ID` starting with `rzp_test_` required, else payments init is disabled.
- CORS: open when `FRONTEND_ORIGINS`/`PUBLIC_APP_URL`/`API_BASE_URL` are unset; once set, only listed origins + localhost pass. Set `FRONTEND_ORIGINS` in deploys.
- Auth: JWT 20-min expiry in `booking_portal_token` cookie + `Authorization: Bearer` + `localStorage booking_portal_auth_token`. Google OAuth active only if all three `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` are set.
- Mail fallback order: SES API creds > Mailgun > SMTP transporter > error. Invoice PDFs render via `puppeteer` (optional dep — wrapped in try/catch, PDF routes fail without it).

## Domain rules (enforced server-side, don't re-derive)

- Slots hourly `10:00`–`19:00`; legacy `:30` times normalize to `:00`.
- Hydrogen cap 8/slot, IV cap 1/slot; max 4 hydrogen sessions/user/day; IV 14-day rebook cooldown; unpaid holds expire after 10 min (`BOOKING_HOLD_MINUTES`).
- Duplicate route registrations exist (e.g. `payment-link-events`, `payment-link-conversion`, `send-payment-link-email/sms`, `webhooks/sendgrid` appear twice) — first matching handler wins; check both copies before editing.

## Deploy

- Push `dev` → EC2 `/opt/h2house-dev`, restarts `h2-booking-dev`. Push `test` → `/opt/h2house`, restarts `h2-booking` (names are inverted: `test` branch is the prod-like service). Both via SSM in `.github/workflows/`; no CI checks.
- `render.yaml`: one web service (`npm install` / `npm start`), persistent disk at `/var/data` with `DATA_DIR=/var/data/data`, `UPLOADS_DIR=/var/data/uploads`.
