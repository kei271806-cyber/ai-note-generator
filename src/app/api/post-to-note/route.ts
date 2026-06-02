import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const NOTE_API = 'https://note.com/api'

// ── Markdown → HTML 変換（note.com のエディタ向け） ──
function markdownToHtml(md: string): string {
  const lines = md.split('\n')
  const output: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // コードブロック ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      const escaped = codeLines.join('\n')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      output.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`)
      i++
      continue
    }

    // 水平線 ---
    if (/^[-*]{3,}$/.test(line.trim())) {
      output.push('<hr>')
      i++
      continue
    }

    // 見出し
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      // note.comはh2〜h4 (#→h2, ##→h3, ###→h4)
      const level = Math.min(headingMatch[1].length + 1, 4)
      output.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`)
      i++
      continue
    }

    // 引用 >
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      output.push(`<blockquote>${quoteLines.map(inlineMarkdown).join('<br>')}</blockquote>`)
      continue
    }

    // 箇条書き - / *
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[-*]\s+/, ''))}</li>`)
        i++
      }
      output.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // 番号付きリスト 1.
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
        i++
      }
      output.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // 空行はスキップ
    if (line.trim() === '') {
      i++
      continue
    }

    // 段落
    output.push(`<p>${inlineMarkdown(line)}</p>`)
    i++
  }

  return output.join('\n')
}

// インライン要素の変換（bold / italic / code / link）
function inlineMarkdown(text: string): string {
  return text
    // リンク [text](url)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // 太字 **text** または __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // 斜体 *text* または _text_
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // インラインコード `code`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

// ── Cookie パース ──
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

    if (!cookies['_note_session_v5']) {
      return NextResponse.json(
        { success: false, error: 'Cookie文字列に _note_session_v5 が見つかりません。F12 → Network → リクエスト選択 → Request Headers の Cookie 行全体をコピーしてください。' },
        { status: 400 }
      )
    }

    const xsrfRaw = cookies['XSRF-TOKEN'] ?? cookies['xsrf-token'] ?? ''
    const xsrfToken = xsrfRaw ? decodeURIComponent(xsrfRaw) : undefined
    const headers = buildHeaders(rawCookie, xsrfToken)

    // Markdown → HTML 変換
    const htmlBody = markdownToHtml(body as string)
    console.log('[post-to-note] HTML変換後（先頭200字）:', htmlBody.slice(0, 200))

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

    if (createRes.status === 401 || createRes.status === 403) {
      throw new Error(`認証エラー (${createRes.status}): セッションCookieの期限が切れています。noteに再ログインして新しいCookieを取得してください。`)
    }
    if (createRes.status === 422) {
      throw new Error('CSRFエラー (422): XSRF-TOKENが必要です。F12 → Application → Cookies → note.com の XSRF-TOKEN の値を、Cookie文字列の末尾に "; XSRF-TOKEN=値" として追加してください。')
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

    // Step 2: 下書きにタイトル・本文（HTML）を保存
    console.log('[post-to-note] 本文を下書き保存中... id=', noteId)
    const saveRes = await fetch(
      `${NOTE_API}/v1/text_notes/draft_save?id=${noteId}&is_temp_saved=true`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          body: htmlBody,
          body_length: htmlBody.length,
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
