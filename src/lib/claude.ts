/**
 * lib/claude.ts
 * Anthropic Claude API を使って記事を生成するモジュール
 * プロンプトキャッシング（RTK）でトークンコストを最大90%削減
 *
 * キャッシュの仕組み：
 * - 毎回変わらないシステムプロンプトをキャッシュ
 * - 変わる部分（テーマ）だけ毎回送信
 * - 同じキャッシュを5分間再利用（Vercel Cronで複数記事を連続生成する際に効果大）
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

export interface GeneratedArticle {
  titles: string[];
  article: string;
}

// ── タイトル生成システムプロンプト（キャッシュ対象）──
// ※ claude-sonnet-4-5 のキャッシュ最小トークン数は1024。
//   このプロンプトはその基準を満たすよう設計しています。
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

// ── 記事生成システムプロンプト（キャッシュ対象）──
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
- 例：「## AIを使えば記事作成が10分で完了する理由」

### 文体・表現ルール
- 1文は60字以内（長い文は分割する）
- 専門用語は初出時に括弧内で説明する（例：プロンプト（AIへの指示文））
- 語尾は「〜です」「〜ます」調を基本とする
- 読者に語りかける表現を積極的に使う（「〜ではないでしょうか」「ぜひ試してみてください」）
- 難しい概念は日常生活の例えを使って説明する（料理・通勤・家事など）
- 共感ワードを入れる（「最初は難しく感じるかもしれませんが」「私も最初は〜でした」）

### 禁止事項
- 根拠のない断言（「必ず稼げます」「100%成功します」等）
- 過度な専門用語の連発（説明なしに使わない）
- 1文60字を超える長文
- 記事タイトルを本文に含める（## から始める）
- 前置き・後書き・自己紹介を含める

### 文字数目安
- 目標：2000〜3000字
- 少なすぎると内容が薄く見える
- 多すぎるとスマホ読者が離脱する

## 出力形式（厳守）
- Markdown形式で出力する
- ## で始まる大見出しから開始する（タイトルは含めない）
- 前置き・後書き・補足説明は一切不要
- 記事本文のみをそのまま出力する`;

export async function generateArticle(
  theme: string
): Promise<GeneratedArticle> {

  // ── Step 1: タイトル案を生成（システムプロンプトをキャッシュ）──
  const titlesResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: TITLE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ] as Anthropic.TextBlockParam[],
    messages: [
      {
        role: "user",
        content: `テーマ：${theme}\n\n上記テーマでnoteのタイトル案を3つ作成してください。`,
      },
    ],
  });

  // キャッシュ効果をログ出力
  const titleUsage = titlesResponse.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  console.log(
    `[Claude] タイトル生成 - 通常:${titleUsage.input_tokens}tok` +
    ` | キャッシュ書込:${titleUsage.cache_creation_input_tokens ?? 0}tok` +
    ` | キャッシュ読込:${titleUsage.cache_read_input_tokens ?? 0}tok`
  );

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

  // ── Step 2: 記事本文を生成（システムプロンプトをキャッシュ）──
  const articleResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: ARTICLE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ] as Anthropic.TextBlockParam[],
    messages: [
      {
        role: "user",
        content: `テーマ：${theme}\n\n上記テーマでnote記事を書いてください。`,
      },
    ],
  });

  // キャッシュ効果をログ出力
  const articleUsage = articleResponse.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  console.log(
    `[Claude] 記事生成 - 通常:${articleUsage.input_tokens}tok` +
    ` | キャッシュ書込:${articleUsage.cache_creation_input_tokens ?? 0}tok` +
    ` | キャッシュ読込:${articleUsage.cache_read_input_tokens ?? 0}tok`
  );

  const article = articleResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  console.log("[Claude] 記事生成完了. 文字数:", article.length);

  return { titles, article };
}
