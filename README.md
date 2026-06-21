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

## Deployment

The included `render.yaml` deploys the website and booking portal as one Node
service. Configure the payment and email secrets listed there in Render. The
persistent disk stores SQLite data and uploaded files outside the repository.
