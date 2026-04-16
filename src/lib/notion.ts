/**
 * lib/notion.ts
 * Notion API との全通信を担うモジュール
 * ここを変更するだけでDB操作をまとめて管理できます
 */

import { Client } from "@notionhq/client";

// ─────────────────────────────────────────────────
// Notion クライアントの初期化
// ─────────────────────────────────────────────────
const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

// ─────────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────────
export type ArticleStatus = "未作成" | "生成済" | "投稿済";

export interface Article {
  id: string;           // Notion ページID
  title: string;        // テーマ（記事タイトル候補のベース）
  status: ArticleStatus;
  body: string;         // 記事本文 (Markdown)
  titleCandidates: string; // タイトル案（改行区切り）
  createdAt: string;    // 作成日
}

// ─────────────────────────────────────────────────
// ヘルパー：Notion ページ → Article 型に変換
// ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pageToArticle(page: any): Article {
  const props = page.properties;

  // タイトル (title プロパティ)
  const title =
    props["タイトル"]?.title?.[0]?.plain_text ?? "";

  // ステータス (select プロパティ)
  const status: ArticleStatus =
    props["ステータス"]?.select?.name ?? "未作成";

  // 本文 (rich_text プロパティ)
  const body =
    props["本文"]?.rich_text
      ?.map((t: { plain_text: string }) => t.plain_text)
      .join("") ?? "";

  // タイトル案 (rich_text プロパティ)
  const titleCandidates =
    props["タイトル案"]?.rich_text
      ?.map((t: { plain_text: string }) => t.plain_text)
      .join("") ?? "";

  // 作成日 (date プロパティ)
  const createdAt =
    props["作成日"]?.date?.start ?? new Date().toISOString().split("T")[0];

  return {
    id: page.id,
    title,
    status,
    body,
    titleCandidates,
    createdAt,
  };
}

// ─────────────────────────────────────────────────
// 1. 記事一覧を取得（最新順・最大50件）
// ─────────────────────────────────────────────────
export async function getArticles(dbId: string): Promise<Article[]> {
  try {
    const response = await notion.databases.query({
      database_id: dbId,
      sorts: [{ property: "作成日", direction: "descending" }],
      page_size: 50,
    });
    return response.results.map(pageToArticle);
  } catch (error) {
    console.error("[Notion] getArticles エラー:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────
// 2. ステータスが「未作成」の記事を1件取得
// ─────────────────────────────────────────────────
export async function getUnwrittenArticle(dbId: string): Promise<Article | null> {
  try {
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: "ステータス",
        select: { equals: "未作成" },
      },
      sorts: [{ property: "作成日", direction: "ascending" }],
      page_size: 1,
    });

    if (response.results.length === 0) {
      return null; // 未作成の記事なし
    }

    return pageToArticle(response.results[0]);
  } catch (error) {
    console.error("[Notion] getUnwrittenArticle エラー:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────
// 3. 過去のテーマ一覧を取得（重複チェック用）
// ─────────────────────────────────────────────────
export async function getPastThemes(dbId: string): Promise<string[]> {
  try {
    const response = await notion.databases.query({
      database_id: dbId,
      page_size: 100, // 過去100件のテーマをチェック
    });

    return response.results
      .map(pageToArticle)
      .map((a) => a.title)
      .filter(Boolean);
  } catch (error) {
    console.error("[Notion] getPastThemes エラー:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────
// 4. 新しいテーマ（記事）をNotionに追加
// ─────────────────────────────────────────────────
export async function createTheme(theme: string, dbId: string): Promise<Article> {
  try {
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const page = await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        // タイトル
        タイトル: {
          title: [{ type: "text", text: { content: theme } }],
        },
        // ステータス：未作成
        ステータス: {
          select: { name: "未作成" },
        },
        // 作成日
        作成日: {
          date: { start: today },
        },
      },
    });

    return pageToArticle(page);
  } catch (error) {
    console.error("[Notion] createTheme エラー:", error);
    throw error;
  }
}

// ─────────────────────────────────────────────────
// 5. 記事本文とタイトル案をNotionに保存（ステータスも更新）
// ─────────────────────────────────────────────────
// Notion の rich_text は1フィールド2000字制限のため、分割して保存
const MAX_RICH_TEXT_LENGTH = 1900;

function splitIntoRichTextBlocks(
  text: string
): Array<{ type: "text"; text: { content: string } }> {
  const blocks = [];
  for (let i = 0; i < text.length; i += MAX_RICH_TEXT_LENGTH) {
    blocks.push({
      type: "text" as const,
      text: { content: text.slice(i, i + MAX_RICH_TEXT_LENGTH) },
    });
  }
  return blocks;
}

export async function updateArticle(
  pageId: string,
  body: string,
  titleCandidates: string[],
  retries = 3 // リトライ回数
): Promise<void> {
  const titleCandidatesText = titleCandidates
    .map((t, i) => `${i + 1}. ${t}`)
    .join("\n");

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await notion.pages.update({
        page_id: pageId,
        properties: {
          // ステータスを「生成済」に更新
          ステータス: {
            select: { name: "生成済" },
          },
          // 記事本文（2000字制限のため分割）
          本文: {
            rich_text: splitIntoRichTextBlocks(body),
          },
          // タイトル案
          タイトル案: {
            rich_text: splitIntoRichTextBlocks(titleCandidatesText),
          },
        },
      });
      console.log(`[Notion] updateArticle 成功 (試行${attempt}回目)`);
      return; // 成功したら終了
    } catch (error) {
      console.error(
        `[Notion] updateArticle エラー (試行${attempt}/${retries}回目):`,
        error
      );
      if (attempt === retries) {
        throw error; // 最終リトライでも失敗したら例外を投げる
      }
      // 1秒待ってリトライ
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// ─────────────────────────────────────────────────
// 6. 単一記事を取得（IDで検索）
// ─────────────────────────────────────────────────
export async function getArticleById(pageId: string): Promise<Article | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId });
    return pageToArticle(page);
  } catch (error) {
    console.error("[Notion] getArticleById エラー:", error);
    return null;
  }
}
