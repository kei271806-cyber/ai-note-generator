/**
 * app/api/update-status/route.ts
 * POST /api/update-status
 * Notionの記事ステータスを更新する
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { pageId, status } = await req.json();

    if (!pageId || !status) {
      return NextResponse.json(
        { success: false, error: "pageId と status は必須です" },
        { status: 400 }
      );
    }

    // 許可するステータス値
    const allowedStatuses = ["未作成", "生成済", "投稿済"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: "無効なステータスです" },
        { status: 400 }
      );
    }

    await notion.pages.update({
      page_id: pageId,
      properties: {
        ステータス: {
          select: { name: status },
        },
      },
    });

    console.log(`[update-status] ${pageId} → ${status}`);

    return NextResponse.json({
      success: true,
      message: `ステータスを「${status}」に更新しました`,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[update-status] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}