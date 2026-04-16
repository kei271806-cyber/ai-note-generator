/**
 * app/api/generate-theme/route.ts
 * POST /api/generate-theme
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTheme } from "@/lib/gemini";
import { getPastThemes, createTheme } from "@/lib/notion";
import { getChannel, getNotionDbId, DEFAULT_CHANNEL_ID } from "@/lib/channels";

export async function POST(req: NextRequest) {
  console.log("[generate-theme] 開始");

  try {
    const body = await req.json().catch(() => ({}));
    const channelId = body?.channelId ?? DEFAULT_CHANNEL_ID;
    const channel = getChannel(channelId);
    const dbId = getNotionDbId(channel);

    console.log(`[generate-theme] チャンネル: ${channel.name}`);

    // ── Step 1: 過去のテーマを取得（重複防止）──
    console.log("[generate-theme] 過去テーマを取得中...");
    const pastThemes = await getPastThemes(dbId);
    console.log(`[generate-theme] 過去テーマ数: ${pastThemes.length}件`);

    // ── Step 2: Gemini でテーマを生成 ──
    console.log("[generate-theme] Gemini でテーマ生成中...");
    const theme = await generateTheme(pastThemes, channel.themePrompt);
    console.log("[generate-theme] 生成テーマ:", theme);

    // ── Step 3: Notion に保存 ──
    console.log("[generate-theme] Notion に保存中...");
    const article = await createTheme(theme, dbId);
    console.log("[generate-theme] Notion 保存完了. ID:", article.id);

    return NextResponse.json({
      success: true,
      message: "テーマの生成・保存が完了しました",
      data: { id: article.id, theme, status: "未作成", channelId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[generate-theme] エラー:", message);
    return NextResponse.json(
      { success: false, message: "テーマの生成に失敗しました", error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST メソッドを使用してください" }, { status: 405 });
}
