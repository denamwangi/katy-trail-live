import { NextResponse } from "next/server";
import { getTagHistoryGeoJSON } from "@/lib/redis-tags";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tagId: string }> }
) {
  try {
    const { tagId } = await params;

    if (!tagId) {
      return NextResponse.json(
        { error: "Tag ID is required" },
        { status: 400 }
      );
    }

    const geoJSON = await getTagHistoryGeoJSON(tagId);

    if (!geoJSON) {
      return NextResponse.json(
        { error: "No history found for this tag" },
        { status: 404 }
      );
    }

    return NextResponse.json(geoJSON, {
      headers: {
        "Content-Type": "application/geo+json",
      },
    });
  } catch (error) {
    console.error("Error fetching tag history", error);
    return NextResponse.json(
      {
        error: "Failed to fetch tag history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
