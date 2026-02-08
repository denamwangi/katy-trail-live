import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface piPayload {
  gateway_id: string;
  timestamp: string;
  unique_devices: number;
  device_sessions: BLESession[];
}

interface BLESession {
  first_seen: string;
  last_seen: string;
  min_rssi: number;
  max_rssi: number;
  rssi_variance: number;
  hashed_id: string;
  detection_count: number;
}

const redis = Redis.fromEnv();
export async function POST(request: Request) {
  console.log("POST /api/telemetry - Request received");
  const authHeader = request.headers.get("x-api-key");

  if (!authHeader || authHeader !== process.env.GATEWAY_SECRET) {
    console.log("POST /api/telemetry - Unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("POST /api/telemetry - Authorized, processing...");

  try {
    // Read body as text to measure size, then parse as JSON
    const bodyText = await request.text();
    const bodySizeBytes = new Blob([bodyText]).size;
    const bodySizeKB = (bodySizeBytes / 1024).toFixed(2);
    console.log(`POST /api/telemetry - Request body size: ${bodySizeBytes} bytes (${bodySizeKB} KB)`);
    
    const body: piPayload = JSON.parse(bodyText);
    const { gateway_id, timestamp, device_sessions } = body;
    const unixTimeStamp = new Date(timestamp).getTime();
    const p = redis.pipeline();
    
    // Set gateway heartbeat
    p.set(`gateway_id:${gateway_id}:heartbeat`, timestamp);

    // Add all device sessions to pipeline
    for (const session of device_sessions) {
      const key = `device:${session.hashed_id}:trail`;
      const value = JSON.stringify({
        gateway: gateway_id,
        ...session,
      });
      p.zadd(key, { score: unixTimeStamp, member: value });
      p.expire(key, 604800 * 2); // expire after 14 days
    }

    // Execute all pipeline operations at once
    await p.exec();
    
    console.log(`POST /api/telemetry - Successfully processed ${device_sessions.length} device sessions`);
    return NextResponse.json({ success: true, processed: device_sessions.length });
  } catch (error) {
    console.error("Error saving to redis", error);
    return NextResponse.json(
      { error: "Failed to upload to redis", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
