/**
 * app/api/articles/route.ts
 * GET /api/articles - 記事一覧を返す（キャッシュ無効）
 */

import { NextResponse } from "next/server";
import { getArticles } from "@/lib/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const articles = await getArticles();
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