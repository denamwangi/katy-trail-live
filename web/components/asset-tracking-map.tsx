"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface Tag {
  id: string;
  lat: number;
  lng: number;
  rssi: number;
  gateway_id: string;
  ts: string;
}

interface TagHistory {
  type: "LineString";
  coordinates: [number, number][];
}

const getRssiColor = (rssi: number): string => {
  if (rssi > -70) return "bg-green-500"; // Strong
  if (rssi > -90) return "bg-yellow-500"; // Weak
  return "bg-red-500"; // Very weak
};

const getRssiBorderColor = (rssi: number): string => {
  if (rssi > -70) return "border-green-600";
  if (rssi > -90) return "border-yellow-600";
  return "border-red-600";
};

export function AssetTrackingMap() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagHistories, setTagHistories] = useState<Record<string, TagHistory>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mapboxToken, setMapboxToken] = useState<string>("");
  const mapRef = useRef<MapRef>(null);

  // Fetch Mapbox token from environment (client-side)
  useEffect(() => {
    // In production, you'd want to fetch this from an API endpoint
    // For now, we'll use a placeholder - user needs to set NEXT_PUBLIC_MAPBOX_TOKEN
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    setMapboxToken(token);
  }, []);

  // IMPORTANT: Use useLayoutEffect (not useEffect) for map resizing
  // useLayoutEffect runs synchronously after DOM mutations but BEFORE browser paint.
  // This ensures the map container has accurate dimensions before the map renders,
  // preventing the map from appearing in the top-left corner or with incorrect sizing.
  // If this is changed to useEffect, the map will likely have sizing issues on initial render.
  useLayoutEffect(() => {
    if (mapRef.current) {
      // Trigger map resize to ensure it fills container
      const map = mapRef.current.getMap();
      if (map) {
        // Small delay to ensure container has rendered
        requestAnimationFrame(() => {
          map.resize();
        });
      }
    }
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        const map = mapRef.current.getMap();
        if (map) {
          map.resize();
        }
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  // Fetch active tags
  const fetchTags = useCallback(async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) throw new Error("Failed to fetch tags");
      const data = await response.json();
      setTags(data.tags || []);
      return data.tags || [];
    } catch (error) {
      console.error("Error fetching tags:", error);
      return [];
    } finally {
      setLoading(false);
      if (showLoading) setRefreshing(false);
    }
  }, []);

  // Fetch history for a tag
  const fetchTagHistory = useCallback(async (tagId: string) => {
    try {
      const response = await fetch(`/api/history/${tagId}`);
      if (!response.ok) return;
      const history = await response.json();
      setTagHistories((prev) => ({ ...prev, [tagId]: history }));
    } catch (error) {
      console.error(`Error fetching history for ${tagId}:`, error);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Fetch histories for all tags when tags change
  useEffect(() => {
    tags.forEach((tag) => {
      if (!tagHistories[tag.id]) {
        fetchTagHistory(tag.id);
      }
    });
  }, [tags, tagHistories, fetchTagHistory]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fetchedTags = await fetchTags(true);
      // Fetch histories for all tags (refresh all, not just new ones)
      if (fetchedTags && fetchedTags.length > 0) {
        await Promise.all(
          fetchedTags.map((tag: Tag) => fetchTagHistory(tag.id))
        );
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchTags, fetchTagHistory]);

  if (!mapboxToken) {
    return (
      <div className="flex items-center justify-center h-96 border rounded-lg">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">
            Mapbox token not configured
          </p>
          <p className="text-sm text-muted-foreground">
            Set NEXT_PUBLIC_MAPBOX_TOKEN environment variable
          </p>
        </div>
      </div>
    );
  }

  // Calculate center of all tags, or default to specified location
  const centerLat =
    tags.length > 0
      ? tags.reduce((sum, tag) => sum + tag.lat, 0) / tags.length
      : 32.80194;
  const centerLng =
    tags.length > 0
      ? tags.reduce((sum, tag) => sum + tag.lng, 0) / tags.length
      : -96.78758;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 border rounded-lg">
        <p className="text-muted-foreground">Loading tags...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Asset Tracking</h2>
          <p className="text-sm text-muted-foreground">
            {tags.length} active tag{tags.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          variant="outline"
          size="sm"
        >
          <RefreshCw
            className={cn(
              "h-4 w-4 mr-2",
              refreshing && "animate-spin"
            )}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
      <div className="relative w-full border rounded-lg overflow-hidden" style={{ height: "600px", position: "relative" }}>
        <div style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={mapboxToken}
            initialViewState={{
              longitude: centerLng,
              latitude: centerLat,
              zoom: tags.length > 0 ? 12 : 10,
            }}
            style={{ width: "100%", height: "100%", display: "block" }}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            reuseMaps
          >
        {/* Render breadcrumb trails */}
        {Object.entries(tagHistories).map(([tagId, history]) => {
          if (!history || history.coordinates.length < 2) return null;

          return (
            <Source
              key={`source-${tagId}`}
              id={`line-${tagId}`}
              type="geojson"
              data={history}
            >
              <Layer
                id={`line-layer-${tagId}`}
                type="line"
                paint={{
                  "line-color": "#3b82f6",
                  "line-width": 2,
                  "line-opacity": 0.6,
                }}
              />
            </Source>
          );
        })}

        {/* Render tag markers */}
        {tags.map((tag) => (
          <Marker
            key={tag.id}
            longitude={tag.lng}
            latitude={tag.lat}
            anchor="center"
          >
            <div className="relative">
              <div
                className={cn(
                  "w-6 h-6 rounded-full border-2 shadow-lg",
                  getRssiColor(tag.rssi),
                  getRssiBorderColor(tag.rssi)
                )}
                title={`Tag ${tag.id}\nRSSI: ${tag.rssi} dBm\nGateway: ${tag.gateway_id}`}
              />
              {/* Pulse animation for active tags */}
              <div
                className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-75",
                  getRssiColor(tag.rssi)
                )}
              />
            </div>
          </Marker>
        ))}
          </Map>
        </div>
        {tags.length === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/30 z-10 pointer-events-none">
            <div className="bg-background/90 px-4 py-2 rounded-lg border">
              <p className="text-muted-foreground">No active tags found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
