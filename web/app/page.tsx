"use client";

import { useState } from "react";
import { ChartBarDefault } from "@/components/ui/bar-chart";
import { AssetTrackingMap } from "@/components/asset-tracking-map";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  const [activeView, setActiveView] = useState<"traffic" | "assets">("traffic");

  return (
    <div className="py-8 px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-4">Katy Trail Live</h1>
        <div className="flex gap-2">
          <Button
            variant={activeView === "traffic" ? "default" : "outline"}
            onClick={() => setActiveView("traffic")}
          >
            Traffic Monitoring
          </Button>
          <Button
            variant={activeView === "assets" ? "default" : "outline"}
            onClick={() => setActiveView("assets")}
          >
            Asset Tracking
          </Button>
        </div>
      </div>

      <div className={cn(activeView !== "traffic" && "hidden")}>
        <ChartBarDefault />
      </div>

      <div className={cn(activeView !== "assets" && "hidden")}>
        <AssetTrackingMap />
      </div>
    </div>
  );
}
