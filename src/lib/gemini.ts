/**
 * lib/gemini.ts
 * Google Gemini API を使ってテーマ生成・記事生成を行うモジュール
 * プロンプトはチャンネルごとに channels.ts で管理
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GeneratedArticle {
  titles: string[];
  article: string;
}

// Gemini クライアントを初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * 503エラー時に自動リトライするラッパー
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("503") || error.message.includes("Service Unavailable"));

      if (isRetryable && attempt < maxRetries) {
        const waitMs = attempt * 3000;
        console.log(`[Gemini] 503エラー。${waitMs / 1000}秒後にリトライ (${attempt}/${maxRetries - 1})...`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } else {
        throw error;
      }
    }
  }
  throw new Error("リトライ上限に達しました");
}

/**
 * テーマを1つ生成する
 * @param pastThemes - 過去のテーマ一覧（重複を避けるために渡す）
 * @param themePrompt - チャンネルごとのテーマ生成プロンプト
 */
export async function generateTheme(
  pastThemes: string[],
  themePrompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const recentThemes = pastThemes.slice(0, 30);
  const pastThemesText =
    recentThemes.length > 0
      ? `\n\n【過去に生成したテーマ（重複禁止）】\n${recentThemes
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}`
      : "";

  const prompt = `${themePrompt}${pastThemesText}`;

  try {
    const result = await withRetry(() => model.generateContent(prompt));
    const text = result.response.text().trim();

    const cleaned = text
      .replace(/^[・\-\*\#\s]+/, "")
      .replace(/\n.*/s, "")
      .trim();

    if (!cleaned) {
      throw new Error("Gemini からテーマが返ってきませんでした");
    }

    console.log("[Gemini] テーマ生成成功:", cleaned);
    return cleaned;
  } catch (error) {
    console.error("[Gemini] テーマ生成エラー:", error);
    throw error;
  }
}

/**
 * タイトル案3つと記事本文を生成する
 * @param theme - 記事のテーマ
 * @param titleSystemPrompt - チャンネルごとのタイトル生成プロンプト
 * @param articleSystemPrompt - チャンネルごとの記事生成プロンプト
 */
export async function generateArticle(
  theme: string,
  titleSystemPrompt: string,
  articleSystemPrompt: string
): Promise<GeneratedArticle> {

  // ── Step 1: タイトル案を生成 ──
  const titleModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: titleSystemPrompt,
  });

  const titlesResult = await withRetry(() =>
    titleModel.generateContent(
      `テーマ：${theme}\n\n上記テーマでnoteのタイトル案を3つ作成してください。`
    )
  );
  const titlesText = titlesResult.response.text().trim();

  console.log("[Gemini] タイトル生成完了");

  const titles = titlesText
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (titles.length === 0) {
    titles.push(
      `${theme}の完全ガイド`,
      `初心者向け！${theme}入門`,
      `【実践】${theme}を始める方法`
    );
  }

  console.log("[Gemini] タイトル:", titles[0]);

  // ── Step 2: 記事本文を生成 ──
  const articleModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: articleSystemPrompt,
  });

  const articleResult = await withRetry(() =>
    articleModel.generateContent(
      `テーマ：${theme}\n\n上記テーマでnote記事を書いてください。`
    )
  );
  const article = articleResult.response.text().trim();

  console.log("[Gemini] 記事生成完了. 文字数:", article.length);

  return { titles, article };
}
