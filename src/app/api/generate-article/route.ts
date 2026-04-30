/**
 * app/api/generate-article/route.ts
 * POST /api/generate-article
 * テーマ生成はGemini、記事生成はGeminiを使用
 */

import { NextRequest, NextResponse } from "next/server";
import { generateArticle } from "@/lib/gemini";
import { getUnwrittenArticle, updateArticle } from "@/lib/notion";
import { getChannel, getNotionDbId, DEFAULT_CHANNEL_ID } from "@/lib/channels";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const channelId = body.channelId ?? DEFAULT_CHANNEL_ID;

    console.log(`[generate-article] 開始`);

    const channel = getChannel(channelId);
    console.log(`[generate-article] チャンネル: ${channel.name}`);

    const notionDbId = getNotionDbId(channel);

    const article = await getUnwrittenArticle(notionDbId);
    if (!article) {
      return NextResponse.json({ success: false, message: "未作成の記事がありません" });
    }

    console.log(`[generate-article] テーマ: ${article.theme} / PageID: ${article.pageId}`);
    console.log(`[generate-article] Gemini で記事生成中...`);

    const { titles, article: content } = await generateArticle(
      article.theme,
      channel.titleSystemPrompt,
      channel.articleSystemPrompt
    );

    console.log(`[generate-article] 記事生成完了: ${titles[0]}`);
    console.log(`[generate-article] Notion に保存中...`);

    await updateArticle(notionDbId, article.pageId, titles, content);

    console.log(`[generate-article] Notion 保存完了`);

    return NextResponse.json({
      success: true,
      message: "記事を生成しました",
      data: { titles, articleLength: content.length },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error(`[generate-article] エラー:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
