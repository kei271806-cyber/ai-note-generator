/**
 * app/api/generate-article/route.ts
 * POST /api/generate-article
 * テーマ生成はGemini、記事生成はClaudeを使用
 */

import { NextRequest, NextResponse } from "next/server";
import { generateArticle } from "@/lib/claude";
import { getUnwrittenArticle, getArticleById, updateArticle } from "@/lib/notion";
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

    // pageId指定あり→その記事を再生成、なし→最初の未作成記事を取得
    const article = body.pageId
      ? await getArticleById(body.pageId)
      : await getUnwrittenArticle(notionDbId);

    if (!article) {
      return NextResponse.json({ success: false, message: "未作成の記事がありません" });
    }

    const theme = body.theme ?? article.title;

    console.log(`[generate-article] テーマ: ${theme} / PageID: ${article.id}`);
    console.log(`[generate-article] Claude で記事生成中...`);

    const { titles, article: rawContent } = await generateArticle(
      theme,
      channel.titleSystemPrompt,
      channel.articleSystemPrompt
    );

    const CTA_FOOTER = `\n\n---\n\n🔥 より深く学びたい方へ\n\n実践で使える手順・プロンプト・テンプレートをまとめた有料記事を販売しています（各¥480）。\n\n→ 厳選コンテンツ一覧 https://note.com/45ai/m/md4f3aabf2436`;
    const content = rawContent.trimEnd() + CTA_FOOTER;

    console.log(`[generate-article] 記事生成完了: ${titles[0]}`);
    console.log(`[generate-article] Notion に保存中...`);

    await updateArticle(article.id, content, titles);

    console.log(`[generate-article] Notion 保存完了`);

    return NextResponse.json({
      success: true,
      message: "記事を生成しました",
      data: { titles, articleLength: content.length, pageId: article.id },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error(`[generate-article] エラー:`, message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
