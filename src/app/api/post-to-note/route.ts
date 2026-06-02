import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NOTE_API = 'https://note.com/api'

const NOTE_HEADERS_BASE = {
  'Content-Type': 'application/json',
  'Origin': 'https://editor.note.com',
  'Referer': 'https://editor.note.com/',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

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

    // Cookie文字列全体が貼り付けられた場合はパース、値だけの場合はそのまま使用
    const isFullCookieString = rawCookie.includes('=') && rawCookie.includes(';')
    const cookies = isFullCookieString ? parseCookieString(rawCookie) : {}

    const noteSession = isFullCookieString
      ? cookies['_note_session_v5']
      : rawCookie
    const xsrfRaw = cookies['XSRF-TOKEN'] ?? cookies['xsrf-token'] ?? ''
    const xsrfToken = xsrfRaw ? decodeURIComponent(xsrfRaw) : ''

    if (!noteSession) {
      return NextResponse.json(
        { success: false, error: 'Cookie文字列から _note_session_v5 が見つかりませんでした。Cookie行全体をコピーしてください。' },
        { status: 400 }
      )
    }

    if (!xsrfToken) {
      return NextResponse.json(
        { success: false, error: 'Cookie文字列から XSRF-TOKEN が見つかりませんでした。Cookie行全体をコピーしてください（XSRF-TOKEN が含まれている必要があります）。' },
        { status: 400 }
      )
    }

    const headers = {
      ...NOTE_HEADERS_BASE,
      'Cookie': rawCookie,
      'X-XSRF-TOKEN': xsrfToken,
    }

    // Step 1: 空の下書きを作成して note ID を取得
    console.log('[post-to-note] 空の下書きを作成中...')
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

    if (!createRes.ok) {
      throw new Error(`下書き作成失敗 (${createRes.status}): ${createRaw.slice(0, 200)}`)
    }

    const createData = JSON.parse(createRaw)
    const noteId: number | undefined = createData?.data?.id
    const noteKey: string | undefined = createData?.data?.key
    const urlname: string | undefined = createData?.data?.user?.urlname

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
