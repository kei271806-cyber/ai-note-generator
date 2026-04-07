/**
 * lib/claude.ts
 * Anthropic Claude API を使って記事を生成するモジュール
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

// 記事生成の戻り値の型
export interface GeneratedArticle {
  titles: string[];   // タイトル案3つ
  article: string;    // 記事本文（Markdown）
}

/**
 * テーマから記事を生成する
 * @param theme - 記事のテーマ
 * @returns タイトル案と記事本文
 */
export async function generateArticle(
  theme: string
): Promise<GeneratedArticle> {

  console.log("API KEY:", process.env.ANTHROPIC_API_KEY); // ←ここに追加

  // システムプロンプト：Claudeへの役割設定
  const systemPrompt = `あなたはnote記事専門のプロライターです。
以下のルールを必ず守って記事を生成してください。

【読者像】
・45歳前後の会社員
・AIや副業に興味があるが、ほぼ初心者
・スマホでnoteを読む
・専門用語はほぼ知らない

【記事のルール】
1. PREP法（結論→理由→具体例→結論）で構成すること
2. 文字数：2000〜3000字（本文のみ）
3. 見出しは ## と ### を使うこと
4. 専門用語は必ず括弧内で説明すること（例：AI（人工知能）)
5. 一文は60字以内を目安にすること
6. スマホで読みやすい短めの段落にすること
7. 親しみやすく、でも信頼感のある文体にすること
8. 「〜ですよね」「〜しましょう」など読者に語りかける表現を使うこと

【タイトルのルール】
・3案用意すること
・クリックされやすい具体的な数字や「初心者向け」などの言葉を入れること
・30文字前後が理想

【出力フォーマット】
必ず以下のJSON形式のみで返してください。マークダウンのコードブロック(\`\`\`json)は使わないこと：
{
  "titles": ["タイトル案1", "タイトル案2", "タイトル案3"],
  "article": "記事本文（Markdown形式）"
}`;

  // ユーザープロンプト：実際のリクエスト
  const userPrompt = `以下のテーマでnote記事を書いてください。

テーマ：${theme}

上記のルールを守り、AI初心者の45歳会社員が読んで「これなら自分でもできる！」と思えるような、
実践的で親しみやすい記事を作成してください。`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",        // 高品質モデルを使用
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: systemPrompt,
    });

    // レスポンスからテキストを取得
    const rawText = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    // JSON をパース
    try {
      // コードブロックが混入している場合は除去
      const cleaned = rawText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const parsed: GeneratedArticle = JSON.parse(cleaned);

      // バリデーション
      if (!parsed.titles || !Array.isArray(parsed.titles) || parsed.titles.length === 0) {
        throw new Error("titles が不正です");
      }
      if (!parsed.article || typeof parsed.article !== "string") {
        throw new Error("article が不正です");
      }

      console.log("[Claude] 記事生成成功:", parsed.titles[0]);
      return parsed;
    } catch (parseError) {
      // JSON パース失敗時のフォールバック
      console.warn("[Claude] JSON パース失敗。フォールバック処理:", parseError);
      return {
        titles: [
          `${theme}の完全ガイド（初心者向け）`,
          `45歳でも始められる！${theme}入門`,
          `【実践】${theme}で副業を始める方法`,
        ],
        article: rawText,
      };
    }
  } catch (error) {
    console.error("[Claude] 記事生成エラー:", error);
    throw error;
  }
}
