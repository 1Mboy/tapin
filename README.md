# Tap.in — live streaming app (Node + Express + SQLite + Socket.IO + WebRTC)

The existing front end (`index.html`, `css/`, `js/app.js`, `img/`) is served by `server.js`.
Gift list (152 `GIFTS`), the 50% streamer share, coin packs and cash-out rules (60,000 💎 min, 200 💎 = $1)
live in `js/app.js` and the server **reads them from that file**, so the client and server always agree.

## Run locally
```bash
npm ci
npm start                 # http://127.0.0.1:41209  (PORT / HOST env override)
./run.sh                  # same, with restart-on-crash loop, logs in data/server.log
DEMO=1 npm start          # adds fake demo viewers/promo banner (never credited)
npm test                  # Playwright E2E (set CHROME_PATH if browsers version differs)
```
Data (SQLite DB, sessions, avatar uploads, session secret) lives in `data/` (or `DATA_DIR`).

## Environment
| var | purpose |
|---|---|
| `PORT`, `HOST` | listen address (default 41209 / 127.0.0.1) |
| `DATA_DIR` | DB + uploads directory |
| `SESSION_SECRET` | cookie signing secret (auto-generated into DATA_DIR if missing) |
| `COOKIE_SECURE` | defaults on in production; `0` only for local http tests |
| `APP_URL` | public origin(s) for CORS/Socket.IO/Stripe redirects |
| `NODE_ENV=production` | secure cookies, trust proxy, SESSION_SECRET required |
| `TURN_URL`,`TURN_USER`,`TURN_PASS` | TURN relay served via `/api/ice` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe test keys. If either is missing, the wallet shows "Payments not connected yet" and no purchase happens |
| `DEMO=1` | fake viewers for demos |
| `START_COINS` | coins given to new accounts (default 500) |

## Stripe (test mode)
1. Put `sk_test_...` in `STRIPE_SECRET_KEY`.
2. Create a webhook endpoint `https://YOUR_HOST/api/stripe/webhook` for `checkout.session.completed`; put its `whsec_...` in `STRIPE_WEBHOOK_SECRET`.
   Locally: `stripe listen --forward-to localhost:41209/api/stripe/webhook`.
3. Coins are credited **only** by the webhook (idempotent per Checkout session).

Cash-out (`POST /api/payouts`) creates a `pending` row in `payouts` and deducts the diamonds. No money is sent; pay out manually and update the row.

## Video
WebRTC mesh: the streamer's browser opens one peer connection per viewer (fine for ~5–20 viewers), Socket.IO relays signaling, STUN `stun.l.google.com:19302`.
For viewers behind strict NATs add a TURN server; for big audiences switch to an SFU (LiveKit, mediasoup).
Browsers only allow camera access on HTTPS (or localhost), so deploy behind HTTPS.

## Features
Live video + chat + gifts, wallet/cash-out, profiles & follows, **Near you** (people sorted by city), **Match** (Meet Me yes/no, mutual matches), **Chats** (1:1 realtime DMs with unread counts, matches highlighted).

Tests: `npm test` (live/gifts) and `node e2e.social.test.js` (Near you/Match/Chats). Set `BASE_URL` to test another host.

## Production
See **DEPLOY.md** (env vars, Render blueprint `render.yaml`, `fly.toml`, Stripe webhook, TURN).

## Deploy to Render (summary)
1. Push this folder to a Git repo.
2. Render → New → Web Service → pick the repo → Runtime **Docker**.
3. Add a **Disk** mounted at `/data` (SQLite + uploads need persistent storage).
4. Env vars: `SESSION_SECRET`, `PUBLIC_URL=https://<app>.onrender.com`, Stripe keys. Port 8080 is set in the Dockerfile (`PORT`).
5. Run a single instance (sockets and live rooms are in memory).

## Deploy to Fly.io
```bash
fly launch --no-deploy            # uses the Dockerfile; internal_port = 8080
fly volumes create tapin_data --size 1
# in fly.toml add:  [mounts] source="tapin_data" destination="/data"
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) PUBLIC_URL=https://<app>.fly.dev \
  STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
fly deploy
fly scale count 1                 # keep one machine (in-memory rooms)
```
