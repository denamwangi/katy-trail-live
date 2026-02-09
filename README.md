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
- Copy `web/env.example` to `web/.env.local` and fill in the values:
  - `GATEWAY_SECRET` - API key for gateway authentication
  - `UPSTASH_REDIS_REST_URL` - Upstash Redis REST API URL
  - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST API token
  - `NEXT_PUBLIC_MAPBOX_TOKEN` - Mapbox access token for asset tracking map (get from https://account.mapbox.com/)

### Gateway Scanner

```bash
cd gateway
pip install -r requirements.txt
python scanner.py
```

Set environment variables:
- Copy `gateway/env.example` to `gateway/.env` and fill in:
  - `GATEWAY_SECRET` - API key matching web dashboard

Configuration:
- Edit `gateway/config.json` to set:
  - `gateway_id` - Unique identifier for this gateway
  - `gps.lat` / `gps.lng` - Hardcoded GPS coordinates (no GPS hardware)
  - `allowed_tag_uuids` - List of BLE tag UUIDs to track

## Testing

### Test Gateway Data

Use the `test_gateway.py` script to send mock data to the backend for frontend testing:

```bash
# Make sure GATEWAY_SECRET is set (from gateway/.env)
export GATEWAY_SECRET=your-secret-key

# Send test data with default values
python test_gateway.py

# Send with custom values
python test_gateway.py --devices 10 --lat 38.63 --lng -90.20

# Send only asset tracking (no telemetry)
python test_gateway.py --assets-only --tags 00000000-0000-0000-0000-000000000001 --rssi -65

# Send multiple tags with different RSSI values
python test_gateway.py --tags \
  00000000-0000-0000-0000-000000000001 \
  00000000-0000-0000-0000-000000000002 \
  --rssi -50 -80

# Test movement (move 15 meters north)
python test_gateway.py --move 15

# Use production URL
python test_gateway.py --url https://katy-trail-live.vercel.app/api/telemetry
```

The script sends both telemetry and asset tracking data by default, matching what the real gateway sends.
