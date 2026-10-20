# Deploying Tap.in

Nothing is deployed yet. This file lists what you need to do.

## Environment variables
| Variable | Required | Value |
|---|---|---|
| `NODE_ENV` | yes | `production`. Turns on secure cookies and trust proxy, and makes the server refuse to start without `SESSION_SECRET` |
| `SESSION_SECRET` | **yes** | 64 random hex chars: `openssl rand -hex 32` (Render's blueprint generates one) |
| `APP_URL` | yes | Public origin, no trailing slash, e.g. `https://tapin.onrender.com`. Used for CORS, the Socket.IO origin check and Stripe redirects. You can list several, comma-separated (e.g. custom domain + onrender URL) |
| `DATA_DIR` | yes | `/data` (persistent disk: SQLite DB, sessions, avatar uploads) |
| `PORT` | no | `8080` (Dockerfile default) |
| `STRIPE_SECRET_KEY` | for payments | `sk_test_...` (test mode). If it or the webhook secret is missing, the wallet shows "Payments not connected yet" |
| `STRIPE_WEBHOOK_SECRET` | for payments | `whsec_...` from the webhook endpoint below |
| `TURN_URL` | recommended | comma-separated TURN URLs |
| `TURN_USER`, `TURN_PASS` | with TURN | TURN credentials |
| `STUN_URL` | no | overrides `stun:stun.l.google.com:19302` |
| `DEMO` | no | `1` adds fake demo viewers (never credited) |
| `COOKIE_SECURE` | no | only set `0` for local plain-HTTP testing of a production build |
| `AUTH_RATE_LIMIT`, `CHAT_RATE`, `GIFT_RATE`, `MAX_UPLOAD_BYTES`, `START_COINS` | no | tuning (defaults: 20 auth/15 min/IP, 10 chats and 20 gifts per 10 s per socket, 2 MB, 500 coins) |

The server hands ICE servers to logged-in clients at `GET /api/ice` (STUN only, plus TURN when `TURN_URL` is set). The health check is at `GET /healthz`.

## Render (blueprint)
1. Create a GitHub/GitLab repo and push: `git remote add origin <url> && git push -u origin main`.
2. Render dashboard → **New → Blueprint** → choose the repo. `render.yaml` creates the web service `tapin` (Docker, **Starter** plan; persistent disks need a paid plan), a 1 GB disk at `/data`, a health check on `/healthz` and a generated `SESSION_SECRET`.
3. Fill in the `sync:false` values when prompted: `APP_URL` (e.g. `https://tapin.onrender.com`, which you only know after naming the service; update it and redeploy if it changes), Stripe keys and TURN credentials.
4. Deploy, then open `https://<app>.onrender.com/healthz` and expect `{"ok":true}`.
5. Keep **one instance**: live rooms and sockets live in memory, and SQLite runs on a single disk.

## Stripe (test mode)
1. Stripe Dashboard → Developers → API keys → copy the **test** secret key into `STRIPE_SECRET_KEY`.
2. Developers → Webhooks → **Add endpoint**:
   - URL: `https://<APP_URL host>/api/stripe/webhook` (e.g. `https://tapin.onrender.com/api/stripe/webhook`)
   - Event: `checkout.session.completed`
   - Copy the signing secret `whsec_...` into `STRIPE_WEBHOOK_SECRET` and redeploy.
3. Test with card `4242 4242 4242 4242`, any future date and any CVC. Coins are credited only by the webhook, once per session.
4. Cash-out creates a `pending` row in the `payouts` table and deducts diamonds. No money moves; pay creators manually (or later via Stripe Connect).

## TURN (needed for viewers behind strict NAT / mobile networks)
**Metered (free tier, ~500 MB/month):** sign up at https://www.metered.ca/stun-turn, create an app, open "TURN credentials", then set
```
TURN_URL=turn:global.relay.metered.ca:80,turn:global.relay.metered.ca:80?transport=tcp,turn:global.relay.metered.ca:443,turns:global.relay.metered.ca:443?transport=tcp
TURN_USER=<username from dashboard>
TURN_PASS=<credential from dashboard>
```
**Open Relay (Metered's free public project):** https://www.metered.ca/tools/openrelay/. Use the URLs and credentials shown there in the same three variables. It's fine for testing; use your own credentials for production.

Video uses a mesh: the streamer uploads one copy per viewer, so expect roughly 5–20 viewers per stream. For bigger audiences move to an SFU (LiveKit Cloud, mediasoup).

## Fly.io (alternative)
```bash
fly launch --copy-config --no-deploy        # keeps fly.toml; pick a unique app name and update APP_URL
fly volumes create tapin_data --size 1 --region iad
fly secrets set SESSION_SECRET=$(openssl rand -hex 32) STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... \
  TURN_URL=... TURN_USER=... TURN_PASS=...
fly deploy && fly scale count 1
```
Webhook URL: `https://<app>.fly.dev/api/stripe/webhook`.

## Local production test
```bash
docker build -t tapin:prod .
docker run --rm -p 127.0.0.1:41300:8080 -v tapin_test:/data -e SESSION_SECRET=$(openssl rand -hex 32) \
  -e APP_URL=http://127.0.0.1:41300 -e COOKIE_SECURE=0 tapin:prod
BASE_URL=http://127.0.0.1:41300 npm test
```

## Backups
Snapshot the `/data` disk (Render disk snapshots / `fly volumes snapshots`), or copy the DB with `sqlite3 /data/tapin.db ".backup /data/backup.db"`.
