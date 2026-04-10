/**
 * app/api/delete-article/route.ts
 * DELETE /api/delete-article - 記事(テーマ)を削除する
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function DELETE(req: NextRequest) {
  try {
    const { pageId } = await req.json();

    if (!pageId) {
      return NextResponse.json(
        { success: false, error: "pageId が必要です" },
        { status: 400 }
      );
    }

    // Notionではページを「アーカイブ」することで削除扱いにする
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });

    console.log("[delete-article] 削除完了. ID:", pageId);

    return NextResponse.json({
      success: true,
      message: "削除しました",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[delete-article] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}