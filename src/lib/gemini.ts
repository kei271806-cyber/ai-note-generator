/**
 * lib/gemini.ts
 * Google Gemini API を使ってテーマを生成するモジュール
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

// Gemini クライアントを初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

/**
 * テーマを1つ生成する
 * @param pastThemes - 過去のテーマ一覧（重複を避けるために渡す）
 * @returns 生成されたテーマ文字列
 */
export async function generateTheme(pastThemes: string[]): Promise<string> {
  // 使用するモデル（gemini-1.5-flash は高速・無料枠あり）
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  // 過去テーマをプロンプトに含める（最大30件）
  const recentThemes = pastThemes.slice(0, 30);
  const pastThemesText =
    recentThemes.length > 0
      ? `\n\n【過去に生成したテーマ（重複禁止）】\n${recentThemes
          .map((t, i) => `${i + 1}. ${t}`)
          .join("\n")}`
      : "";

  const prompt = `
あなたはnote記事の専門編集者です。
以下の条件で、note記事のテーマを1つだけ生成してください。

【読者像】
・45歳前後の会社員
・AIや副業に興味があるが、まだ始めていない初心者
・スマホでnoteを読む
・難しい専門用語は苦手

【テーマの条件】
・AI初心者でもすぐに実践できる具体的な内容
・副業や仕事効率化に直結するもの
・「〇〇する方法」「〇〇で稼ぐ」「〇〇を使った△△」など実用的なタイトル候補になりやすい形式
・1〜2文で具体的に表現すること
・最新のAIツール（ChatGPT, Claude, Gemini, Perplexity等）を活用した内容が望ましい
${pastThemesText}

【出力ルール】
・テーマのみを1行で出力すること
・「テーマ：」「・」などの前置きは不要
・マークダウンや記号は使わない
・日本語で出力すること

出力例：
ChatGPTを使って副業ブログ記事を30分で書く方法（初心者向け）
`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // 余分な記号や改行を除去
    const cleaned = text
      .replace(/^[・\-\*\#\s]+/, "") // 先頭の記号を除去
      .replace(/\n.*/s, "")          // 最初の行のみ取得
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
