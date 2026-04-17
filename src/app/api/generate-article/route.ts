/**
 * app/api/generate-article/route.ts
 * POST /api/generate-article
 * テーマ生成はGemini、記事生成はClaudeを使用
 */

import { NextRequest, NextResponse } from "next/server";
import { generateTheme as geminiGenerateTheme } from "@/lib/gemini";
import { getUnwrittenArticle, updateArticle } from "@/lib/notion";
import { getChannel, getNotionDbId, DEFAULT_CHANNEL_ID } from "@/lib/channels";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Claude クライアント
const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

/**
 * Claudeでタイトルと記事本文を生成する
 */
async function generateArticleWithClaude(
  theme: string,
  titleSystemPrompt: string,
  articleSystemPrompt: string
): Promise<{ titles: string[]; article: string }> {

  // ── Step 1: タイトル案を生成 ──
  const titlesResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: titleSystemPrompt,
    messages: [{
      role: "user",
      content: `テーマ：${theme}\n\n上記テーマでnoteのタイトル案を3つ作成してください。`,
    }],
  });

  const titlesText = titlesResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  const titles = titlesText
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (