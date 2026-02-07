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

### Gateway Scanner

```bash
cd gateway
pip install -r requirements.txt
python scanner.py
```
