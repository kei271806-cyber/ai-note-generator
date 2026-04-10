/**
 * app/api/post-to-note/route.ts
 * POST /api/post-to-note
 * noteの非公式APIを使って記事を下書き保存する
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { title, body, sessionCookie } = await req.json();

    if (!title || !body) {
      return NextResponse.json(
        { success: false, error: "タイトルと本文は必須です" },
        { status: 400 }
      );
    }

    // セッションCookieは環境変数から取得（リクエストで上書き可能）
    const cookie = sessionCookie || process.env.NOTE_SESSION_COOKIE;

    if (!cookie) {
      return NextResponse.json(
        { success: false, error: "noteのセッションCookieが設定されていません" },
        { status: 400 }
      );
    }

    const headers = {
      "Content-Type": "application/json",
      "Cookie": `_note_session_v5=${cookie}`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Referer": "https://note.com",
      "Origin": "https://note.com",
    };

    // ── Step 1: 空の記事を作成してIDを取得 ──
    console.log("[post-to-note] Step1: 新規エントリ作成中...");
    const createRes = await fetch("https://note.com/api/v1/text_notes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: title,
        body: " ",
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("[post-to-note] Step1 失敗:", createRes.status, errText);
      throw new Error(`記事作成失敗 (${createRes.status}): Cookieが無効か期限切れの可能性があります`);
    }

    const createData = await createRes.json();
    const noteId = createData?.data?.id;

    if (!noteId) {
      throw new Error("note IDの取得に失敗しました");
    }

    console.log("[post-to-note] Step1 完了. note ID:", noteId);

    // ── Step 2: 本文を下書き保存 ──
    console.log("[post-to-note] Step2: 下書き保存中...");
    const draftRes = await fetch(
      `https://note.com/api/v1/text_notes/draft_save?id=${noteId}&is_temp_saved=true`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: title,
          body: body,
          body_length: body.length,
          index: false,
          is_lead_form: false,
        }),
      }
    );

    if (!draftRes.ok) {
      const errText = await draftRes.text();
      console.error("[post-to-note] Step2 失敗:", draftRes.status, errText);
      throw new Error(`下書き保存失敗 (${draftRes.status})`);
    }

    const draftData = await draftRes.json();
    console.log("[post-to-note] 下書き保存完了. note ID:", noteId);

    return NextResponse.json({
      success: true,
      message: "noteに下書き保存しました",
      data: {
        noteId,
        noteUrl: `https://note.com/notes/${noteId}/edit`,
        response: draftData,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[post-to-note] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}