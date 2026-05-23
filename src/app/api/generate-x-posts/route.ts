/**
 * app/api/generate-x-posts/route.ts
 * POST /api/generate-x-posts
 * 記事本文からThreads投稿を1つ生成する
 */

import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

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
以下のnote記事をもとに、Threads投稿を1つ生成してください。

【目的】
・フォロワー増加
・noteへの誘導
・共感と保存を獲得

【構成】
フック（1〜2行）→ 価値提供（箇条書き3〜5点）→ CTA（noteリンク付き）

【ルール】
・300〜500文字
・スマホで読みやすく改行する
・難しい言葉は使わない
・1文は短くする
・箇条書きを使う
・感情 or 気づきを必ず入れる
・断定口調でOK
・最後にnoteのURLを入れる

【重要】
・そのまま要約するのではなく「再構成」すること
・読み手はAI初心者の会社員

【noteのURL】
${noteUrl || "https://note.com/（あなたのURL）"}

【出力フォーマット】
以下のJSON形式のみで返すこと。{ と } の外側に文字を一切書かないこと：
{
  "post": "投稿文"
}

【note記事本文】
${article.slice(0, 3000)}`;

    console.log("[generate-threads-post] Threads投稿生成中...");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Claude からの JSON レスポンスが見つかりませんでした");
    }
    const parsed = JSON.parse(match[0]);
    const post: string = parsed.post;
    if (!post) {
      throw new Error("Claude のレスポンスに post フィールドがありませんでした");
    }

    console.log("[generate-threads-post] 生成完了");

    return NextResponse.json({ success: true, post });

  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[generate-threads-post] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
