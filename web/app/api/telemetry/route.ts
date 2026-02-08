import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface piPayload {
  gateway_id: string;
  timestamp: string;
  unique_devices: number;
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
    const { gateway_id, timestamp, unique_devices } = body;
    const unixTimeStamp = new Date(timestamp).getTime();
    
    const p = redis.pipeline();
    
    // Set gateway heartbeat
    p.set(`gateway_id:${gateway_id}:heartbeat`, timestamp);

    // Store count data with timestamp-based key
    const countKey = `gateway_id:${gateway_id}:traffic:${unixTimeStamp}`;
    const countValue = JSON.stringify({
      timestamp,
      unique_devices,
    });
    p.zadd(countKey, { score: unixTimeStamp, member: countValue });
    p.expire(countKey, 604800 * 2); // expire after 14 days

    // Execute all pipeline operations at once
    await p.exec();
    
    console.log(`POST /api/telemetry - Successfully processed count: ${unique_devices} unique devices`);
    return NextResponse.json({ success: true, unique_devices });
  } catch (error) {
    console.error("Error saving to redis", error);
    return NextResponse.json(
      { error: "Failed to upload to redis", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
