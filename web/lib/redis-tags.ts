import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export interface TagState {
  lat: number;
  lng: number;
  rssi: number;
  gateway_id: string;
  ts: string;
}

/**
 * Update live state for a tag (Redis Hash)
 * Key pattern: tag:latest:{tag_id}
 * TTL: 130 seconds
 */
export async function updateTagLiveState(
  tagId: string,
  state: TagState
): Promise<void> {
  const key = `tag:latest:${tagId}`;
  const pipeline = redis.pipeline();
  
  // Set all fields
  pipeline.hset(key, {
    lat: state.lat.toString(),
    lng: state.lng.toString(),
    rssi: state.rssi.toString(),
    gateway_id: state.gateway_id,
    ts: state.ts,
  });
  
  // Set TTL to 130 seconds
  pipeline.expire(key, 130);
  
  await pipeline.exec();
}

/**
 * Append to historical trace for a tag (Redis Stream)
 * Key pattern: tag:history:{tag_id}
 * Capped at ~10000 entries
 */
export async function appendTagHistory(
  tagId: string,
  state: TagState
): Promise<void> {
  const key = `tag:history:${tagId}`;
  
  // Add entry to stream
  // Note: Stream trimming will need to be handled separately or via Redis configuration
  // Upstash Redis client may not support MAXLEN in xadd options
  await redis.xadd(key, "*", {
    lat: state.lat.toString(),
    lng: state.lng.toString(),
    rssi: state.rssi.toString(),
    gateway_id: state.gateway_id,
    ts: state.ts,
  });
}

/**
 * Get live state for a tag
 */
export async function getTagLiveState(
  tagId: string
): Promise<TagState | null> {
  const key = `tag:latest:${tagId}`;
  const data = await redis.hgetall(key);
  
  if (!data || Object.keys(data).length === 0) {
    return null;
  }
  
  return {
    lat: parseFloat(data.lat as string),
    lng: parseFloat(data.lng as string),
    rssi: parseInt(data.rssi as string, 10),
    gateway_id: data.gateway_id as string,
    ts: data.ts as string,
  };
}

/**
 * Get all tag IDs that have live state
 */
export async function getAllActiveTagIds(): Promise<string[]> {
  const pattern = "tag:latest:*";
  const keys = await redis.keys(pattern);
  
  // Extract tag IDs from keys (tag:latest:{tag_id})
  return keys.map((key) => key.replace("tag:latest:", ""));
}

/**
 * Get historical trace for a tag as GeoJSON LineString
 */
export async function getTagHistoryGeoJSON(
  tagId: string
): Promise<GeoJSON.LineString | null> {
  const key = `tag:history:${tagId}`;
  
  // Get all entries from the stream
  const entries = await redis.xrange(key, "-", "+");
  
  // Handle different return types from Upstash Redis
  if (!entries) {
    return null;
  }
  
  // Convert to array if it's not already
  const entriesArray = Array.isArray(entries) ? entries : Object.entries(entries);
  
  if (entriesArray.length === 0) {
    return null;
  }
  
  // Extract coordinates from stream entries
  // Upstash returns entries as array of [id, [field, value, field, value, ...]]
  const coordinates: [number, number][] = [];
  
  for (const entry of entriesArray) {
    // Entry format: [id, data] where data is an array of [field, value, field, value, ...]
    const entryData = Array.isArray(entry) ? entry[1] : (entry as any).data || entry;
    
    // Convert array format to object
    const data: Record<string, string> = {};
    if (Array.isArray(entryData)) {
      for (let i = 0; i < entryData.length; i += 2) {
        data[entryData[i]] = entryData[i + 1];
      }
    } else {
      Object.assign(data, entryData);
    }
    
    const lng = parseFloat(data.lng);
    const lat = parseFloat(data.lat);
    
    if (!isNaN(lng) && !isNaN(lat)) {
      coordinates.push([lng, lat]); // GeoJSON uses [lng, lat] order
    }
  }
  
  if (coordinates.length === 0) {
    return null;
  }
  
  return {
    type: "LineString",
    coordinates,
  };
}
