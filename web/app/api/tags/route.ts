import { NextResponse } from "next/server";
import { getAllActiveTagIds, getTagLiveState } from "@/lib/redis-tags";

export async function GET() {
  try {
    const tagIds = await getAllActiveTagIds();
    
    // Fetch live state for each tag
    const tags = await Promise.all(
      tagIds.map(async (tagId) => {
        const state = await getTagLiveState(tagId);
        if (!state) return null;
        return {
          id: tagId,
          ...state,
        };
      })
    );

    // Filter out null states
    const activeTags = tags.filter(
      (tag): tag is NonNullable<typeof tag> => tag !== null && tag.lat !== undefined && tag.lng !== undefined
    );

    return NextResponse.json({ tags: activeTags });
  } catch (error) {
    console.error("Error fetching active tags", error);
    return NextResponse.json(
      {
        error: "Failed to fetch active tags",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
