/**
 * app/api/generate-x-posts/route.ts
 * POST /api/generate-x-posts
 * 記事本文からX投稿を5つ生成する
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

export interface XPosts {
  hook:        string; // ① フック投稿
  knowhow:     string; // ② ノウハウ投稿
  experience:  string; // ③ 体験投稿
  cta:         string; // ④ 誘導投稿
  philosophy:  string; // ⑤ 思想投稿
}

export async function POST(req: NextRequest) {
  try {
    const { article, noteUrl } = await req.json();

    if (!article) {
      return NextResponse.json(
        { success: false, error: "記事本文は必須です" },
        { status: 400 }
      );
    }

    const prompt = `あなたはSNSマーケティングのプロです。
以下のnote記事をもとに、X（Twitter）投稿を5つ生成してください。

【目的】
・フォロワー増加
・noteへの誘導
・共感と保存を獲得

【出力する投稿の種類（必ず5つ）】
① フック投稿（バズ狙い）
② ノウハウ投稿（価値提供）
③ 体験投稿（共感）
④ 誘導投稿（noteリンク付き）
⑤ 思想投稿（フォロー獲得）

【ルール】
・各投稿は140〜260文字以内
・スマホで読みやすく改行する
・難しい言葉は使わない
・1文は短くする
・箇条書きを使う
・感情 or 気づきを必ず入れる
・断定口調でOK（〜です→〜）

【重要】
・そのまま要約するのではなく「再構成」すること
・それぞれ役割が違う投稿にすること
・読み手はAI初心者の会社員

【noteのURL】
${noteUrl || "https://note.com/（あなたのURL）"}

【出力フォーマット】
以下のJSON形式のみで返すこと。
{ と } の外側に文字を一切書かないこと：
{
  "posts": {
    "hook": "①の投稿文",
    "knowhow": "②の投稿文",
    "experience": "③の投稿文",
    "cta": "④の投稿文（noteリンク入り）",
    "philosophy": "⑤の投稿文"
  }
}

【note記事本文】
${article.slice(0, 3000)}`;

    console.log("[generate-x-posts] X投稿生成中...");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    // JSONをパース
    const cleaned = rawText
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    const posts: XPosts = parsed.posts;

    console.log("[generate-x-posts] 生成完了");

    return NextResponse.json({ success: true, posts });

  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[generate-x-posts] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}