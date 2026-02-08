# Katy Trail Live

Live traffic monitoring for the Katy Trail.

## Structure

- `gateway/` - BLE scanner for device detection
- `web/` - Next.js dashboard

## Getting Started

### Web Dashboard

```bash
cd web
npm install
npm run dev
```

Set environment variables:
- `GATEWAY_SECRET` - API key for gateway authentication
- Upstash Redis credentials (via `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`)

### Gateway Scanner

```bash
cd gateway
pip install -r requirements.txt
python scanner.py
```

Set environment variables:
- `GATEWAY_SECRET` - API key matching web dashboard
