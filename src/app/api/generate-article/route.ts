/**
 * app/api/generate-article/route.ts
 * POST /api/generate-article
 */

import { NextRequest, NextResponse } from "next/server";
import { generateArticle } from "@/lib/gemini";
import { getUnwrittenArticle, updateArticle } from "@/lib/notion";
import { getChannel, getNotionDbId, DEFAULT_CHANNEL_ID } from "@/lib/channels";

export async function POST(req: NextRequest) {
  console.log("[generate-article] 開始");

  try {
    const body = await req.json().catch(() => ({}));
    const channelId = body?.channelId ?? DEFAULT_CHANNEL_ID;
    const channel = getChannel(channelId);
    const dbId = getNotionDbId(channel);

    console.log(`[generate-article] チャンネル: ${channel.name}`);

    let pageId: string | null = body?.pageId ?? null;
    let theme: string | null = body?.theme ?? null;

    // pageId と theme が指定されていない場合は Notion から取得
    if (!pageId || !theme) {
      const unwrittenArticle = await getUnwrittenArticle(dbId);

      if (!unwrittenArticle) {
        console.log("[generate-article] 未作成の記事がありません");
        return NextResponse.json({
          success: false,
          message: "未作成の記事が見つかりません。先にテーマを生成してください。",
        });
      }

      pageId = unwrittenArticle.id;
      theme = unwrittenArticle.title;
    }

    console.log("[generate-article] テーマ:", theme, "/ PageID:", pageId);

    // ── Gemini で記事を生成 ──
    console.log("[generate-article] Gemini で記事生成中...");
    const { titles, article } = await generateArticle(
      theme,
      channel.titleSystemPrompt,
      channel.articleSystemPrompt
    );
    console.log("[generate-article] 記事生成完了:", titles[0]);

    // ── Notion に保存 ──
    console.log("[generate-article] Notion に保存中...");
    await updateArticle(pageId, article, titles, 3);
    console.log("[generate-article] Notion 保存完了");

    return NextResponse.json({
      success: true,
      message: "記事の生成・保存が完了しました",
      data: { pageId, theme, titles, articleLength: article.length, channelId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[generate-article] エラー:", message);
    return NextResponse.json(
      { success: false, message: "記事の生成に失敗しました", error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST メソッドを使用してください" }, { status: 405 });
}
