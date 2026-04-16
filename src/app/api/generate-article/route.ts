/**
 * app/api/generate-article/route.ts
 * POST /api/generate-article
 *
 * 処理フロー：
 * 1. Notion から「ステータス=未作成」の記事を1件取得
 * 2. Claude で記事を生成
 * 3. Notion に本文・タイトル案を保存（ステータス: 生成済）
 */

import { NextRequest, NextResponse } from "next/server";
import { generateArticle } from "@/lib/gemini";
import { getUnwrittenArticle, updateArticle } from "@/lib/notion";

export async function POST(req: NextRequest) {
  console.log("[generate-article] 開始");

  try {
    // ── Step 1: 未作成の記事を取得 ──
    console.log("[generate-article] Notion から未作成記事を取得中...");
    
    // リクエストボディに pageId があればそれを優先（手動再生成用）
    let pageId: string | null = null;
    let theme: string | null = null;

    try {
      const body = await req.json();
      pageId = body?.pageId ?? null;
      theme = body?.theme ?? null;
    } catch {
      // ボディなし（cron からの呼び出し）は問題なし
    }

    // pageId と theme が指定されていない場合は Notion から取得
    if (!pageId || !theme) {
      const unwrittenArticle = await getUnwrittenArticle();

      if (!unwrittenArticle) {
        console.log("[generate-article] 未作成の記事がありません");
        return NextResponse.json({
          success: false,
          message: "未作成の記事が見つかりません。先にテーマを生成してください。",
        });
      }

      pageId = unwrittenArticle.id;
      theme = unwrittenArticle.title;
    }

    console.log("[generate-article] テーマ:", theme, "/ PageID:", pageId);

    // ── Step 2: Gemini で記事を生成 ──
    console.log("[generate-article] Gemini で記事生成中...");
    const { titles, article } = await generateArticle(theme);
    console.log("[generate-article] 記事生成完了:", titles[0]);

    // ── Step 3: Notion に保存（リトライ付き）──
    console.log("[generate-article] Notion に保存中...");
    await updateArticle(pageId, article, titles, 3); // 最大3回リトライ
    console.log("[generate-article] Notion 保存完了");

    return NextResponse.json({
      success: true,
      message: "記事の生成・保存が完了しました",
      data: {
        pageId,
        theme,
        titles,
        articleLength: article.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[generate-article] エラー:", message);

    return NextResponse.json(
      {
        success: false,
        message: "記事の生成に失敗しました",
        error: message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ message: "POST メソッドを使用してください" }, { status: 405 });
}
