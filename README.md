# H2 House of Health website

This repository contains both the public website and the booking portal.

- Public website: `/`
- Booking portal: `/booking/`
- Booking API: `/api/`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Runtime data is stored in `booking/data` and
uploaded avatars in `booking/uploads`; both are excluded from Git.

For a development deployment that still runs with `NODE_ENV=production` such as
an AWS EC2 IP environment, set `SHOW_DEV_OTP_IN_UI=true` and keep
`ALLOW_DEV_OTP_FALLBACK=true` to show generated OTP codes in the booking UI.

## Deployment

The included `render.yaml` deploys the website and booking portal as one Node
service. Configure the payment and email secrets listed there in Render. The
persistent disk stores SQLite data and uploaded files outside the repository.
