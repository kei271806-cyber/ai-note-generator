/**
 * app/api/cron/route.ts
 * GET /api/cron?channelId=xxx
 *
 * Vercel Cron から各チャンネルごとに呼び出される
 */

import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_CHANNEL_ID } from "@/lib/channels";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get("channelId") ?? DEFAULT_CHANNEL_ID;

  console.log(`[cron] 開始: channelId=${channelId}`, new Date().toISOString());

  // ── セキュリティ認証 ──
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[cron] 認証失敗: 不正なアクセス");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  const results = {
    themeGeneration: { success: false, message: "", data: null as unknown },
    articleGeneration: { success: false, message: "", data: null as unknown },
  };

  // ── Step 1: テーマ生成 ──
  try {
    console.log("[cron] テーマ生成 API を呼び出し中...");
    const themeRes = await fetch(`${baseUrl}/api/generate-theme`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ channelId }),
    });

    const themeData = await themeRes.json();
    results.themeGeneration = {
      success: themeData.success,
      message: themeData.message,
      data: themeData.data,
    };

    if (!themeData.success) {
      console.error("[cron] テーマ生成失敗:", themeData.error);
    } else {
      console.log("[cron] テーマ生成成功:", themeData.data?.theme);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[cron] テーマ生成エラー:", message);
    results.themeGeneration = { success: false, message, data: null };
  }

  await new Promise((r) => setTimeout(r, 2000));

  // ── Step 2: 記事生成 ──
  try {
    console.log("[cron] 記事生成 API を呼び出し中...");
    const articleRes = await fetch(`${baseUrl}/api/generate-article`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ channelId }),
    });

    const articleData = await articleRes.json();
    results.articleGeneration = {
      success: articleData.success,
      message: articleData.message,
      data: articleData.data,
    };

    if (!articleData.success) {
      console.error("[cron] 記事生成失敗:", articleData.error);
    } else {
      console.log("[cron] 記事生成成功:", articleData.data?.titles?.[0]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[cron] 記事生成エラー:", message);
    results.articleGeneration = { success: false, message, data: null };
  }

  const allSuccess =
    results.themeGeneration.success && results.articleGeneration.success;

  console.log("[cron] 完了:", allSuccess ? "全成功" : "一部失敗", results);

  return NextResponse.json({
    success: allSuccess,
    channelId,
    executedAt: new Date().toISOString(),
    results,
  });
}
