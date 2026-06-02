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

async function fetchXsrfToken(sessionCookie: string): Promise<string> {
  // note.com トップにアクセスして XSRF-TOKEN cookie を取得
  const res = await fetch('https://note.com/', {
    method: 'GET',
    headers: {
      'Cookie': `_note_session_v5=${sessionCookie}`,
      'User-Agent': NOTE_HEADERS_BASE['User-Agent'],
    },
    redirect: 'follow',
  })

  // Set-Cookie ヘッダーから XSRF-TOKEN を探す
  const raw = res.headers.get('set-cookie') ?? ''
  const tokenMatch = raw.match(/XSRF-TOKEN=([^;,\s]+)/)
  if (tokenMatch) return decodeURIComponent(tokenMatch[1])

  // HTML内の csrf-token メタタグにフォールバック
  const html = await res.text()
  const metaMatch = html.match(/<meta[^>]+name=["']csrf-token["'][^>]+content=["']([^"']+)["']/)
  if (metaMatch) return metaMatch[1]

  throw new Error('XSRFトークンの取得に失敗しました。セッションCookieが正しいか、有効期限が切れていないか確認してください。')
}

function buildHeaders(sessionCookie: string, xsrfToken: string) {
  return {
    ...NOTE_HEADERS_BASE,
    'Cookie': `_note_session_v5=${sessionCookie}`,
    'X-XSRF-TOKEN': xsrfToken,
  }
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

    const cookie = (sessionCookie as string).trim()

    // Step 1: XSRF トークンを取得
    console.log('[post-to-note] XSRFトークン取得中...')
    const xsrfToken = await fetchXsrfToken(cookie)
    const headers = buildHeaders(cookie, xsrfToken)

    // Step 2: 空の下書きを作成して note ID を取得
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

    // Step 3: 下書きにタイトル・本文を保存
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

    // 下書きURLを構築
    const noteUrl = urlname
      ? `https://note.com/@${urlname}/n/${noteKey}`
      : noteKey
      ? `https://note.com/notes/${noteKey}`
      : `https://note.com/`

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
