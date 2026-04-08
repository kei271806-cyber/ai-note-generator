/**
 * lib/claude.ts
 * Anthropic Claude API を使って記事を生成するモジュール
 * タイトルと本文を別々のAPIコールで取得する方式
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

export interface GeneratedArticle {
  titles: string[];
  article: string;
}

export async function generateArticle(
  theme: string
): Promise<GeneratedArticle> {

  // ── Step 1: タイトル案を生成 ──
  const titlesResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `以下のテーマで、note記事のタイトル案を3つ作ってください。

テーマ：${theme}

条件：
・45歳会社員・AI初心者向け
・クリックされやすい具体的なタイトル
・数字や「初心者向け」などを入れる
・30文字前後

出力形式（この形式のみで返すこと）：
1. タイトル1
2. タイトル2
3. タイトル3`
    }],
  });

  const titlesText = titlesResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  // タイトルをパース
  const titles = titlesText
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  // タイトルが取れなかった場合のフォールバック
  if (titles.length === 0) {
    titles.push(
      `${theme}の完全ガイド（初心者向け）`,
      `45歳からでも始められる！${theme}入門`,
      `【実践】${theme}で副業を始める方法`
    );
  }

  console.log("[Claude] タイトル生成完了:", titles[0]);

  // ── Step 2: 記事本文を生成 ──
  const articleResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: `以下のテーマでnote記事を書いてください。

テーマ：${theme}

【読者像】
・45歳前後の会社員
・AIや副業に興味があるが初心者
・スマホでnoteを読む
・専門用語はほぼ知らない

【記事のルール】
・PREP法（結論→理由→具体例→結論）で構成
・文字数：2000〜3000字
・見出しは ## と ### を使う
・専門用語は括弧内で説明（例：AI（人工知能））
・一文は60字以内
・親しみやすい文体
・読者に語りかける表現を使う

記事本文のみをMarkdown形式で出力してください。
タイトルや前置き・後書きは不要です。
## から始めてください。`
    }],
  });

  const article = articleResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  console.log("[Claude] 記事生成完了. 文字数:", article.length);

  return { titles, article };
}