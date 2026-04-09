/**
 * app/api/create-theme/route.ts
 * POST /api/create-theme - テーマを手動で追加する
 */

import { NextRequest, NextResponse } from "next/server";
import { createTheme } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { theme } = await req.json();

    if (!theme || theme.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "テーマを入力してください" },
        { status: 400 }
      );
    }

    if (theme.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "テーマは5文字以上入力してください" },
        { status: 400 }
      );
    }

    const article = await createTheme(theme.trim());

    return NextResponse.json({
      success: true,
      message: "テーマを追加しました",
      data: { id: article.id, theme: theme.trim() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[create-theme] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}