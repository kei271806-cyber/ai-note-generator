/**
 * app/api/post-to-note/route.ts
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

    const cookie = sessionCookie || process.env.NOTE_SESSION_COOKIE;

    if (!cookie) {
      return NextResponse.json(
        { success: false, error: "noteのセッションCookieが設定されていません" },
        { status: 400 }
      );
    }

    const cookieHeader = `_note_session_v5=${cookie.trim()}`;

    const baseHeaders = {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://note.com",
      "Origin": "https://note.com",
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
      "X-Requested-With": "XMLHttpRequest",
    };

    // ── Step 1: CSRFトークンを取得 ──
    console.log("[post-to-note] CSRFトークン取得中...");
    const csrfRes = await fetch("https://note.com/api/v1/sessions/csrf_token", {
      method: "GET",
      headers: baseHeaders,
    });

    let csrfToken = "";
    if (csrfRes.ok) {
      const csrfData = await csrfRes.json();
      csrfToken = csrfData?.data?.csrf_token || "";
      console.log("[post-to-note] CSRFトークン取得:", csrfToken ? "成功" : "なし");
    }

    const headers = {
      ...baseHeaders,
      ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
    };

    // ── Step 2: 新規エントリの作成 ──
    console.log("[post-to-note] 新規エントリ作成中...");
    const createRes = await fetch("https://note.com/api/v1/text_notes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: title,
        body: " ",
      }),
    });

    const createText = await createRes.text();
    console.log("[post-to-note] Step1 status:", createRes.status);
    console.log("[post-to-note] Step1 response:", createText.slice(0, 200));

    if (!createRes.ok) {
      throw new Error(`記事作成失敗 (${createRes.status}): ${createText.slice(0, 100)}`);
    }

    const createData = JSON.parse(createText);
    const noteId = createData?.data?.id;

    if (!noteId) {
      throw new Error("note IDの取得に失敗しました");
    }

    console.log("[post-to-note] note ID取得:", noteId);

    // ── Step 3: 下書き保存 ──
    console.log("[post-to-note] 下書き保存中...");
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

    const draftText = await draftRes.text();
    console.log("[post-to-note] Step2 status:", draftRes.status);

    if (!draftRes.ok) {
      throw new Error(`下書き保存失敗 (${draftRes.status}): ${draftText.slice(0, 100)}`);
    }

    return NextResponse.json({
      success: true,
      message: "noteに下書き保存しました",
      data: {
        noteId,
        noteUrl: `https://note.com/notes/${noteId}/edit`,
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