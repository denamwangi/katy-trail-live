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
  const authHeader = request.headers.get("x-api-key");

  if (!authHeader || authHeader !== process.env.GATEWAY_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body: piPayload = await request.json();
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
    
    return NextResponse.json({ success: true, processed: device_sessions.length });
  } catch (error) {
    console.error("Error saving to redis", error);
    return NextResponse.json(
      { error: "Failed to upload to redis", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
