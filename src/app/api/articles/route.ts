/**
 * app/api/articles/route.ts
 * GET /api/articles?channelId=xxx
 */

import { NextRequest, NextResponse } from "next/server";
import { getArticles } from "@/lib/notion";
import { getChannel, getNotionDbId, DEFAULT_CHANNEL_ID } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;
    const channel = getChannel(channelId);
    const dbId = getNotionDbId(channel);

    const articles = await getArticles(dbId);
    return NextResponse.json(
      { success: true, articles },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[articles] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
