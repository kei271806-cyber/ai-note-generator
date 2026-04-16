/**
 * lib/gemini.ts
 * Google Gemini API を使ってテーマ生成・記事生成を行うモジュール
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
 * @param fn - 実行する非同期関数
 * @param maxRetries - 最大リトライ回数
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
        const waitMs = attempt * 3000; // 3秒・6秒・9秒と間隔を増やす
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
 * @returns 生成されたテーマ文字列
 */
export async function generateTheme(pastThemes: string[]): Promise<string> {
  // 使用するモデル（gemini-1.5-flash は高速・無料枠あり）
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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
    const result = await withRetry(() => model.generateContent(prompt));
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

// ── タイトル生成システムプロンプト ──
const TITLE_SYSTEM_PROMPT = `あなたは「45歳からのAI副業」というnoteメディアの専属コピーライターです。
このメディアは、40〜50代の会社員がAIを活用して副業を始めるためのノウハウを発信しています。

## ターゲット読者の詳細プロフィール

### 基本属性
- 年齢：40〜50代（特に45歳前後）の会社員
- 職種：営業・管理・事務・製造など、IT専門職ではない一般的なビジネスパーソン
- 副業経験：ほぼなし、または過去に挫折した経験がある
- AI・IT知識：スマホは使いこなせるが、プログラミングは未経験
- 情報収集：スマホでSNSやnoteを読む習慣がある

### 読者の悩み・課題
- 副業をやりたいが何から始めればよいかわからない
- AIは便利そうだが難しそうで怖い、自分には無理だと思っている
- 仕事が忙しく、副業に使える時間が限られている
- ブログや動画など過去に挑戦したが続かなかった経験がある
- 老後の資金・収入への不安がある

### 読者が求めるもの
- 「自分にもできる」「難しくない」という安心感
- 具体的なツール名・ステップ・数字
- 失敗談や現実的な体験談
- すぐに試せる再現性の高い方法

## 効果的なnoteタイトルの作り方

### 必ず守るルール
- 30文字前後を目安にする（長すぎると読まれない）
- 読者の悩みや欲求に直接訴えかける表現を使う
- 具体的な数字を入れる（例：3ステップ、5分で、90%削減）
- 「初心者OK」「ゼロから」「誰でもできる」などハードルを下げる言葉を入れる
- メリットや結果が一目でわかるようにする

### 効果的なタイトルのパターン
- 【数字】で始める：「3つのコツ」「5分でわかる」「月3万円を目指す」
- 問いかけ形式：「〜で悩んでいませんか？」「〜ってどうすれば？」
- 実績・比較形式：「〜したら〇〇が変わった」「〜vs〜どっちがいい？」
- How-to形式：「〜する方法」「〜のやり方を解説」

### 避けるべきパターン
- 専門用語だけのタイトル（読者が意味を理解できない）
- 抽象的すぎるタイトル（何の記事かわからない）
- 30文字を大幅に超える長いタイトル

## 出力形式（厳守）
- タイトル案を必ず3つ出力する
- 番号付きリスト形式のみで出力する
- タイトルのみを出力し、説明・解説・前置きは一切不要
- 出力例：
1. タイトル案A
2. タイトル案B
3. タイトル案C`;

// ── 記事生成システムプロンプト ──
const ARTICLE_SYSTEM_PROMPT = `あなたは「45歳からのAI副業」というnoteメディアの専属ライターです。
このメディアは、40〜50代の会社員がAIを活用して副業を始めるためのノウハウを発信しています。

## ターゲット読者の詳細プロフィール

### 基本属性
- 年齢：40〜50代（特に45歳前後）の会社員
- AIや副業に興味があるが、まだ始めていない初心者
- スマートフォンでnoteを読むことが多い
- プログラミングやIT専門知識はほぼない
- 「難しそう」「自分には無理かも」という先入観を持っている
- 残業が多く、自由な時間が限られている
- 副業で月3〜5万円の収入を目指している

### 読者の悩み・課題
- 副業をやりたいが何から始めればよいかわからない
- AIは便利そうだが使い方がわからない、難しそうだと感じている
- ブログや動画など、過去に副業を試みて挫折した経験がある
- 毎日続けることが苦手で、モチベーション維持が難しい
- 老後の不安や収入の柱を増やしたい気持ちがある

### 読者が求めるもの
- 「自分にもできる」「難しくない」という安心感
- 具体的なツール名・手順・数字が入った再現性の高い情報
- 失敗しない・リスクの少ない始め方
- 実際の体験談や成功・失敗の事例

## 記事作成の詳細ガイドライン

### 構成ルール（PREP法）
すべての記事は以下の順序で構成する：
1. **結論**：記事で最も伝えたいことを冒頭に述べる（読者をつかむ）
2. **理由**：なぜそれが重要か・役立つかを丁寧に説明する
3. **具体例**：実際のツール名・操作手順・数字を使って詳しく説明する
4. **結論**：最後にもう一度結論を述べ、読者に行動を促す

### 見出し設計ルール
- ## 大見出し：記事全体を通じて3〜5個程度
- ### 小見出し：大見出しの中に必要に応じて配置
- 見出しは内容が一目でわかる具体的な表現にする

### 文体・表現ルール
- 1文は60字以内（長い文は分割する）
- 専門用語は初出時に括弧内で説明する（例：プロンプト（AIへの指示文））
- 語尾は「〜です」「〜ます」調を基本とする
- 読者に語りかける表現を積極的に使う
- 難しい概念は日常生活の例えを使って説明する
- 共感ワードを入れる

### 禁止事項
- 根拠のない断言（「必ず稼げます」「100%成功します」等）
- 過度な専門用語の連発（説明なしに使わない）
- 1文60字を超える長文
- 記事タイトルを本文に含める（## から始める）
- 前置き・後書き・自己紹介を含める

### 文字数目安
- 目標：2000〜3000字

## 出力形式（厳守）
- Markdown形式で出力する
- ## で始まる大見出しから開始する（タイトルは含めない）
- 前置き・後書き・補足説明は一切不要
- 記事本文のみをそのまま出力する`;

/**
 * タイトル案3つと記事本文を生成する
 * @param theme - 記事のテーマ
 * @returns タイトル案3つと記事本文
 */
export async function generateArticle(theme: string): Promise<GeneratedArticle> {

  // ── Step 1: タイトル案を生成 ──
  const titleModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: TITLE_SYSTEM_PROMPT,
  });

  const titlesResult = await withRetry(() =>
    titleModel.generateContent(
      `テーマ：${theme}\n\n上記テーマでnoteのタイトル案を3つ作成してください。`
    )
  );
  const titlesText = titlesResult.response.text().trim();

  console.log("[Gemini] タイトル生成完了");

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

  console.log("[Gemini] タイトル:", titles[0]);

  // ── Step 2: 記事本文を生成 ──
  const articleModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: ARTICLE_SYSTEM_PROMPT,
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
