"use client";

import { TrendingUp } from "lucide-react";
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { MOCK_WEEKDAY_DATA, type HourlyData } from "@/lib/mockData";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  type ChartConfig,
} from "@/components/ui/chart";

export const description = "Katy Trail Traffic";

const chartConfig = {
  percent: {
    label: "Percent",
    color: "var(--chart-3)",
  },
  live: {
    label: "Live",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function ChartBarDefault() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Katy Trail Traffic</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={MOCK_WEEKDAY_DATA}>
            <XAxis
              dataKey="hour"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <Bar dataKey="percent" fill="var(--color-percent)" radius={8}>
              {MOCK_WEEKDAY_DATA.map((entry: HourlyData, index: number) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isLive ? "var(--color-live)" : "var(--color-percent)"}
                  style={{
                    filter: entry.isLive ? "drop-shadow(0 0 4px var(--color-live))" : undefined,
                  }}
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Showing total visitors for the last 6 months
        </div>
      </CardFooter>
    </Card>
  );
}
