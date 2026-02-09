import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  updateTagLiveState,
  appendTagHistory,
} from "@/lib/redis-tags";

interface TelemetryPayload {
  gateway_id: string;
  timestamp: string;
  unique_devices: number;
}

interface AssetTrackingPayload {
  gateway_id: string;
  ts: string;
  lat: number;
  lng: number;
  tags: Array<{ id: string; rssi: number }>;
}

interface CombinedPayload {
  telemetry?: TelemetryPayload;
  asset_tracking?: AssetTrackingPayload;
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
    console.log(
      `POST /api/telemetry - Request body size: ${bodySizeBytes} bytes (${bodySizeKB} KB)`
    );

    const body: CombinedPayload = JSON.parse(bodyText);
    const results: {
      telemetry?: { success: boolean; unique_devices?: number };
      asset_tracking?: { success: boolean; tags_processed?: number };
    } = {};

    // Process telemetry payload (traffic monitoring)
    if (body.telemetry) {
      const { gateway_id, timestamp, unique_devices } = body.telemetry;
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

      results.telemetry = { success: true, unique_devices };
      console.log(
        `POST /api/telemetry - Successfully processed telemetry: ${unique_devices} unique devices`
      );
    }

    // Process asset tracking payload
    if (body.asset_tracking) {
      const { gateway_id, ts, lat, lng, tags } = body.asset_tracking;

      // Process each tag atomically (live state + history together)
      const tagPromises = tags.map(async (tag) => {
        const tagState = {
          lat,
          lng,
          rssi: tag.rssi,
          gateway_id,
          ts,
        };

        // Update live state and history atomically
        await Promise.all([
          updateTagLiveState(tag.id, tagState),
          appendTagHistory(tag.id, tagState),
        ]);
      });

      await Promise.all(tagPromises);

      results.asset_tracking = {
        success: true,
        tags_processed: tags.length,
      };
      console.log(
        `POST /api/telemetry - Successfully processed asset tracking: ${tags.length} tags`
      );
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Error saving to redis", error);
    return NextResponse.json(
      {
        error: "Failed to upload to redis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
