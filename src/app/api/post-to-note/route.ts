import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NOTE_API = 'https://note.com/api'

function parseCookieString(raw: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx < 0) continue
    const key = part.slice(0, idx).trim()
    const val = part.slice(idx + 1).trim()
    if (key) result[key] = val
  }
  return result
}

function buildHeaders(cookieStr: string, xsrfToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Cookie': cookieStr,
    'Origin': 'https://editor.note.com',
    'Referer': 'https://editor.note.com/',
    'X-Requested-With': 'XMLHttpRequest',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  }
  if (xsrfToken) headers['X-XSRF-TOKEN'] = xsrfToken
  return headers
}

export async function POST(req: NextRequest) {
  try {
    const { title, body, sessionCookie } = await req.json()

    if (!title || !body || !sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'title・body・sessionCookieは必須です' },
        { status: 400 }
      )
    }

    const rawCookie = (sessionCookie as string).trim()
    const cookies = parseCookieString(rawCookie)

    // _note_session_v5 の存在確認
    if (!cookies['_note_session_v5']) {
      return NextResponse.json(
        { success: false, error: 'Cookie文字列に _note_session_v5 が見つかりません。F12 → Network → リクエスト選択 → Request Headers の Cookie 行全体をコピーしてください。' },
        { status: 400 }
      )
    }

    // XSRF-TOKEN があれば使う（なくても試みる）
    const xsrfRaw = cookies['XSRF-TOKEN'] ?? cookies['xsrf-token'] ?? ''
    const xsrfToken = xsrfRaw ? decodeURIComponent(xsrfRaw) : undefined

    const headers = buildHeaders(rawCookie, xsrfToken)

    // Step 1: 空の下書きを作成して note ID を取得
    console.log('[post-to-note] 空の下書きを作成中... xsrf=', xsrfToken ? 'あり' : 'なし')
    const createRes = await fetch(`${NOTE_API}/v1/text_notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: '',
        body_length: 0,
        name: 'Untitled',
        index: false,
        is_lead_form: false,
      }),
    })

    const createRaw = await createRes.text()
    console.log('[post-to-note] 作成レスポンス:', createRes.status, createRaw.slice(0, 300))

    if (createRes.status === 401 || createRes.status === 403) {
      throw new Error(`認証エラー (${createRes.status}): セッションCookieの期限が切れている可能性があります。noteに再ログインして新しいCookieを取得してください。`)
    }
    if (createRes.status === 422) {
      throw new Error(`CSRFエラー (422): note.comのAPIがXSRF-TOKENを要求しています。F12 → Application → Cookies → note.com の XSRF-TOKEN の値をメモし、Cookie文字列に追加してください（例: ...既存のCookie; XSRF-TOKEN=値）`)
    }
    if (!createRes.ok) {
      throw new Error(`下書き作成失敗 (${createRes.status}): ${createRaw.slice(0, 200)}`)
    }

    let createData: Record<string, unknown>
    try {
      createData = JSON.parse(createRaw)
    } catch {
      throw new Error(`noteからの応答が不正なJSON形式です: ${createRaw.slice(0, 200)}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = createData?.data as any
    const noteId: number | undefined = data?.id
    const noteKey: string | undefined = data?.key
    const urlname: string | undefined = data?.user?.urlname

    if (!noteId) {
      throw new Error(`note IDを取得できませんでした: ${createRaw.slice(0, 200)}`)
    }

    // Step 2: 下書きにタイトル・本文を保存
    console.log('[post-to-note] 本文を下書き保存中... id=', noteId)
    const saveRes = await fetch(
      `${NOTE_API}/v1/text_notes/draft_save?id=${noteId}&is_temp_saved=true`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: body,
          body_length: body.length,
          name: title,
          index: false,
          is_lead_form: false,
        }),
      }
    )

    const saveRaw = await saveRes.text()
    console.log('[post-to-note] 保存レスポンス:', saveRes.status, saveRaw.slice(0, 300))

    if (!saveRes.ok) {
      throw new Error(`下書き保存失敗 (${saveRes.status}): ${saveRaw.slice(0, 200)}`)
    }

    const noteUrl = urlname
      ? `https://note.com/@${urlname}/n/${noteKey}`
      : noteKey
      ? `https://note.com/notes/${noteKey}`
      : 'https://note.com/'

    console.log('[post-to-note] 完了:', noteUrl)

    return NextResponse.json({
      success: true,
      data: { noteUrl, noteId, noteKey },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : '不明なエラー'
    console.error('[post-to-note] エラー:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
