"""
Scans for BLE devices and logs detection
"""

"""
Katy Trail BLE Scanner
Continuously scans for BLE devices and logs detections
"""

import os
import asyncio
import hashlib
import requests
import csv
from datetime import datetime, timedelta
from collections import defaultdict
from dotenv import load_dotenv
from bleak import BleakScanner

load_dotenv()
# Configuration
SCAN_INTERVAL = 5  # seconds between scans
BATCH_SEND_INTERVAL = 90  # 90 seconds between sends
OUTPUT_FILE = "detections.csv"
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET")
if not GATEWAY_SECRET:
    raise ValueError("GATEWAY_SECRET environment variable is required")


class TrailScanner:
    def __init__(self):
        self.scan_count = 0
        self.total_detections = 0
        self.setup_csv()
        self.last_batch_time = datetime.now()
        self.buffer = defaultdict(list)

    def setup_csv(self):
        """Initialize CSV file with headers"""
        with open(OUTPUT_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["timestamp", "hashed_mac", "rssi"])
            writer.writeheader()
        print(f"📊 Logging to: {OUTPUT_FILE}")

    def hash_mac(self, mac_address):
        """Hash MAC address for privacy"""
        return hashlib.sha256(mac_address.encode()).hexdigest()[:16]

    def cleanup_buffer(self):
        """Cleans up anything older than last batch send"""
        pass

    def batch_send(self):
        """Upload readings"""
        if not self.buffer:
            return

        start_time = datetime.now()
        data = []

        for device, readings in self.buffer.items():
            device_data = {
                "hashed_id": device,
                "detection_count": len(readings),
            }
            for ts_str, rssi in readings:
                ts = datetime.fromisoformat(ts_str)
                if "first_seen" not in device_data:
                    device_data["first_seen"] = ts_str
                    device_data["last_seen"] = ts_str
                    device_data["min_rssi"] = rssi
                    device_data["max_rssi"] = rssi
                    continue
                if ts < datetime.fromisoformat(device_data["first_seen"]):
                    device_data["first_seen"] = ts_str
                if ts > datetime.fromisoformat(device_data["last_seen"]):
                    device_data["last_seen"] = ts_str
                device_data["min_rssi"] = min(rssi, device_data["min_rssi"])
                device_data["max_rssi"] = max(rssi, device_data["max_rssi"])

            device_data["rssi_variance"] = (
                device_data["max_rssi"] - device_data["min_rssi"]
            )
            data.append(device_data)

        payload = {
            "gateway_id": "kt_trail_pi_001",
            "timestamp": start_time.isoformat(),
            "unique_devices": len(data),
            "device_sessions": data,
        }

        self.buffer = defaultdict(list)
        self.last_batch_time = start_time

        headers = {
            "Content-Type": "application/json",
            "x-api-key": GATEWAY_SECRET,
        }
        url = "https://katy-trail-live.vercel.app/api/telemetry"
        response = requests.post(
            url,
            json=payload,
            headers=headers,
        )
        print("*" * 50)
        print(f"Batch send response: {response.json()}")
        print("*" * 50)

    async def scan_once(self):
        """Perform a single BLE scan"""
        devices = await BleakScanner.discover(timeout=5.0)
        timestamp = datetime.now().isoformat()
        detections = []

        for device in devices:
            detections.append(
                {
                    "timestamp": timestamp,
                    "hashed_mac": self.hash_mac(device.address),
                    "rssi": device.details["props"]["RSSI"],
                }
            )

        return detections

    def save_detections(self, detections):
        """Append detections to CSV and add to buffer"""
        if not detections:
            return

        for detection in detections:
            self.buffer[detection["hashed_mac"]].append(
                (detection["timestamp"], detection["rssi"])
            )

        with open(OUTPUT_FILE, "a", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["timestamp", "hashed_mac", "rssi"])
            writer.writerows(detections)

    async def run(self):
        """Main scanning loop"""
        print("🏃‍♀️ Katy Trail Scanner Starting...")
        print(f"⏱️  Scanning every {SCAN_INTERVAL} seconds")
        print("🔴 Press Ctrl+C to stop\n")

        try:
            while True:
                self.scan_count += 1

                # Perform scan
                detections = await self.scan_once()

                # Save to CSV
                self.save_detections(detections)

                # Update stats
                self.total_detections += len(detections)

                # Print status
                print(
                    f"Scan #{self.scan_count}: Found {len(detections)} devices (Total: {self.total_detections})"
                )

                # batch send if it's been long enough
                if (
                    datetime.now() - self.last_batch_time
                ).total_seconds() > BATCH_SEND_INTERVAL:
                    print("Start processing for batch send")
                    self.batch_send()

                # Wait before next scan
                await asyncio.sleep(SCAN_INTERVAL)

        except KeyboardInterrupt:
            print(f"\n\n✅ Scanner stopped")
            print(f"📈 Total scans: {self.scan_count}")
            print(f"📊 Total detections: {self.total_detections}")
            print(f"💾 Data saved to: {OUTPUT_FILE}")


if __name__ == "__main__":
    scanner = TrailScanner()
    asyncio.run(scanner.run())
