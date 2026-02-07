"""
Scans for BLE devices and logs detection
"""

"""
Katy Trail BLE Scanner
Continuously scans for BLE devices and logs detections
"""

import asyncio
import hashlib
import csv
from datetime import datetime
from bleak import BleakScanner

# Configuration
SCAN_INTERVAL = 5  # seconds between scans
OUTPUT_FILE = "detections.csv"

class TrailScanner:
    def __init__(self):
        self.scan_count = 0
        self.total_detections = 0
        self.setup_csv()
    
    def setup_csv(self):
        """Initialize CSV file with headers"""
        with open(OUTPUT_FILE, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'hashed_mac', 'rssi'])
            writer.writeheader()
        print(f"📊 Logging to: {OUTPUT_FILE}")
    
    def hash_mac(self, mac_address):
        """Hash MAC address for privacy"""
        return hashlib.sha256(mac_address.encode()).hexdigest()[:16]
    
    async def scan_once(self):
        """Perform a single BLE scan"""
        devices = await BleakScanner.discover(timeout=5.0)
        
        timestamp = datetime.now().isoformat()
        detections = []
        
        for device in devices:
            detections.append({
                'timestamp': timestamp,
                'hashed_mac': self.hash_mac(device.address),
                'rssi': device.details['props']['RSSI']
            })
        
        return detections
    
    def save_detections(self, detections):
        """Append detections to CSV"""
        if not detections:
            return
        
        with open(OUTPUT_FILE, 'a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['timestamp', 'hashed_mac', 'rssi'])
            writer.writerows(detections)
    
    async def run(self):
        """Main scanning loop"""
        print("🏃‍♀️ Katy Trail Scanner Starting...")
        print(f"⏱️  Scanning every {SCAN_INTERVAL} seconds")
        print("🔴 Press Ctrl+C to stop\n")
        
        try:
            while True and self.scan_count < 500:
                self.scan_count += 1
                
                # Perform scan
                detections = await self.scan_once()
                
                # Save to CSV
                self.save_detections(detections)
                
                # Update stats
                self.total_detections += len(detections)
                
                # Print status
                print(f"Scan #{self.scan_count}: Found {len(detections)} devices (Total: {self.total_detections})")
                
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