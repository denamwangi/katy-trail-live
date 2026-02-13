"""
Scans for BLE devices and logs detection
"""

"""
Katy Trail BLE Scanner
Continuously scans for BLE devices and logs detections
"""

import os
import json
import asyncio
import hashlib
import requests
import csv
import math
from datetime import datetime, timedelta
from collections import defaultdict, deque
from dotenv import load_dotenv
from bleak import BleakScanner

load_dotenv()
# Configuration
SCAN_INTERVAL = 5  # seconds between scans
BATCH_SEND_INTERVAL = 180  # seconds between sends
OUTPUT_FILE = "detections.csv"
CONFIG_FILE = "config.json"
GATEWAY_SECRET = os.getenv("GATEWAY_SECRET")
if not GATEWAY_SECRET:
    raise ValueError("GATEWAY_SECRET environment variable is required")

# Movement filter thresholds
MOVEMENT_DISTANCE_THRESHOLD = 10  # meters
MOVEMENT_TIME_THRESHOLD = 120  # seconds (2 minutes)
RSSI_WINDOW_SIZE = 30  # seconds worth of readings (~6 readings with 5s scan interval)


class TrailScanner:
    def __init__(self):
        self.scan_count = 0
        self.total_detections = 0
        self.setup_csv()
        self.load_config()
        self.last_batch_time = datetime.now()
        self.buffer = set()  # Track unique device IDs only (for traffic monitoring)
        
        # Asset tracking state
        # Convert to set for fast lookup, preserving original case for device names
        self.allowed_tag_uuids = set(self.config.get("allowed_tag_uuids", []))
        # Also create a case-insensitive set for matching
        self.allowed_tag_uuids_upper = {str(uuid).upper() for uuid in self.allowed_tag_uuids}
        self.tag_rssi_windows = defaultdict(lambda: deque())  # tag_id -> deque of (timestamp, rssi)
        self.last_sent_gps = None  # {lat, lng, ts}
        self.gps_coords = self.config["gps"]

    def load_config(self):
        """Load gateway configuration from config.json"""
        config_path = os.path.join(os.path.dirname(__file__), CONFIG_FILE)
        try:
            with open(config_path, "r") as f:
                self.config = json.load(f)
            print(f"✅ Loaded config: gateway_id={self.config['gateway_id']}, GPS=({self.config['gps']['lat']}, {self.config['gps']['lng']})")
            print(f"📋 Tracking {len(self.config.get('allowed_tag_uuids', []))} allowed tag UUIDs")
        except FileNotFoundError:
            raise FileNotFoundError(f"Config file not found: {config_path}")
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON in config file: {e}")

    def setup_csv(self):
        """Initialize CSV file with headers"""
        with open(OUTPUT_FILE, "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=["timestamp", "hashed_mac", "rssi"])
            writer.writeheader()
        print(f"📊 Logging to: {OUTPUT_FILE}")

    def hash_mac(self, mac_address):
        """Hash MAC address for privacy"""
        return hashlib.sha256(mac_address.encode()).hexdigest()[:16]

    def haversine_distance(self, lat1, lng1, lat2, lng2):
        """Calculate distance between two GPS coordinates in meters using Haversine formula"""
        R = 6371000  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lng2 - lng1)
        
        a = math.sin(delta_phi / 2) ** 2 + \
            math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c

    def should_send_asset_tracking(self, current_time):
        """Check if asset tracking payload should be sent based on movement filter"""
        if self.last_sent_gps is None:
            return True
        
        # Check time threshold
        time_elapsed = (current_time - self.last_sent_gps["ts"]).total_seconds()
        if time_elapsed > MOVEMENT_TIME_THRESHOLD:
            return True
        
        # Check distance threshold
        distance = self.haversine_distance(
            self.last_sent_gps["lat"],
            self.last_sent_gps["lng"],
            self.gps_coords["lat"],
            self.gps_coords["lng"]
        )
        if distance > MOVEMENT_DISTANCE_THRESHOLD:
            return True
        
        return False

    def get_median_rssi(self, tag_id):
        """Calculate median RSSI from the rolling window for a tag"""
        window = self.tag_rssi_windows[tag_id]
        if not window:
            return None
        
        # Clean old readings (outside rolling window)
        current_time = datetime.now()
        cutoff_time = current_time - timedelta(seconds=RSSI_WINDOW_SIZE)
        while window and window[0][0] < cutoff_time:
            window.popleft()
        
        if not window:
            return None
        
        # Calculate median
        rssi_values = [rssi for _, rssi in window]
        rssi_values.sort()
        n = len(rssi_values)
        if n % 2 == 0:
            return (rssi_values[n // 2 - 1] + rssi_values[n // 2]) / 2
        else:
            return rssi_values[n // 2]

    def update_tag_rssi_window(self, tag_id, rssi):
        """Add RSSI reading to the rolling window for a tag"""
        current_time = datetime.now()
        self.tag_rssi_windows[tag_id].append((current_time, rssi))
        
        # Clean old readings
        cutoff_time = current_time - timedelta(seconds=RSSI_WINDOW_SIZE)
        while self.tag_rssi_windows[tag_id] and self.tag_rssi_windows[tag_id][0][0] < cutoff_time:
            self.tag_rssi_windows[tag_id].popleft()

    def batch_send(self):
        """Upload readings - batches both telemetry and asset tracking"""
        start_time = datetime.now()
        
        # Prepare telemetry payload (traffic monitoring)
        telemetry_payload = None
        if self.buffer:
            unique_devices_count = len(self.buffer)
            telemetry_payload = {
                "gateway_id": self.config["gateway_id"],
                "timestamp": start_time.isoformat(),
                "unique_devices": unique_devices_count,
            }
            self.buffer = set()
        
        # Prepare asset tracking payload
        asset_payload = None
        should_send_assets = self.should_send_asset_tracking(start_time)
        
        if should_send_assets:
            # Collect tags with median RSSI
            tracked_tags = []
            for tag_id in self.allowed_tag_uuids:
                median_rssi = self.get_median_rssi(tag_id)
                if median_rssi is not None:
                    tracked_tags.append({
                        "id": tag_id,
                        "rssi": int(median_rssi)
                    })
            
            asset_payload = {
                "gateway_id": self.config["gateway_id"],
                "ts": start_time.isoformat(),
                "lat": self.gps_coords["lat"],
                "lng": self.gps_coords["lng"],
                "tags": tracked_tags
            }
            
            # Update last sent GPS
            self.last_sent_gps = {
                "lat": self.gps_coords["lat"],
                "lng": self.gps_coords["lng"],
                "ts": start_time
            }
        
        # Send both payloads in a single request
        combined_payload = {}
        if telemetry_payload:
            combined_payload["telemetry"] = telemetry_payload
        if asset_payload:
            combined_payload["asset_tracking"] = asset_payload
        
        if not combined_payload:
            return
        
        self.last_batch_time = start_time

        headers = {
            "Content-Type": "application/json",
            "x-api-key": GATEWAY_SECRET,
        }
        url = "https://katy-trail-live.vercel.app/api/telemetry"
        response = requests.post(
            url,
            json=combined_payload,
            headers=headers,
        )
        print("*" * 50)
        print(f"Batch send response: {response.json()}")
        if telemetry_payload:
            print(f"  Telemetry: {telemetry_payload['unique_devices']} unique devices")
        if asset_payload:
            print(f"  Asset Tracking: {len(asset_payload['tags'])} tags")
        print("*" * 50)

    async def scan_once(self):
        """Perform a single BLE scan"""
        devices = await BleakScanner.discover(timeout=5.0)
        timestamp = datetime.now().isoformat()
        detections = []

        for device in devices:
            rssi = device.details.get("props", {}).get("RSSI")
            if rssi is None:
                continue
            
            # Check if this device matches any allowed tag UUID or device name from config
            matched_tag_id = None
            
            # First, check device name against allowed_tag_uuids (case-sensitive match)
            if hasattr(device, "name") and device.name:
                if device.name in self.allowed_tag_uuids:
                    matched_tag_id = device.name
                # Also try case-insensitive match
                elif not matched_tag_id:
                    device_name_upper = device.name.upper()
                    for allowed_id in self.allowed_tag_uuids:
                        if str(allowed_id).upper() == device_name_upper:
                            matched_tag_id = allowed_id  # Use the original case from config
                            break
            
            # If not matched by name, check service UUIDs (common for BLE tags)
            if not matched_tag_id:
                device_metadata = device.details.get("props", {})
                service_uuids = device_metadata.get("UUIDs", [])
                
                # Also check metadata if available
                if hasattr(device, "metadata") and device.metadata:
                    service_uuids = service_uuids + list(device.metadata.get("uuids", []))
                
                for service_uuid in service_uuids:
                    service_uuid_str = str(service_uuid).upper()
                    # Check against both original and uppercase versions
                    if service_uuid_str in self.allowed_tag_uuids_upper:
                        # Find the original case version
                        for allowed_id in self.allowed_tag_uuids:
                            if str(allowed_id).upper() == service_uuid_str:
                                matched_tag_id = allowed_id
                                break
                        if matched_tag_id:
                            break
            
            # If no service UUID match, check if device address matches (fallback for placeholder UUIDs)
            if not matched_tag_id:
                device_identifier = str(device.address).upper()
                if device_identifier in self.allowed_tag_uuids_upper:
                    # Find the original case version
                    for allowed_id in self.allowed_tag_uuids:
                        if str(allowed_id).upper() == device_identifier:
                            matched_tag_id = allowed_id
                            break
            
            # Track for asset tracking if matched
            if matched_tag_id:
                self.update_tag_rssi_window(matched_tag_id, rssi)
            
            # Always track for traffic monitoring (hash MAC)
            detections.append(
                {
                    "timestamp": timestamp,
                    "hashed_mac": self.hash_mac(device.address),
                    "rssi": rssi,
                }
            )

        return detections

    def save_detections(self, detections):
        """Append detections to CSV and add unique devices to buffer"""
        if not detections:
            return

        # Add unique device IDs to buffer (for counting)
        for detection in detections:
            self.buffer.add(detection["hashed_mac"])

        # Save all detections to CSV for local logging
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
