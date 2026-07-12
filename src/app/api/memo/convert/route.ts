import { NextRequest, NextResponse } from 'next/server'
import { convertMemoBoth } from '@/lib/ai/claude'
import { createPost, generateId } from '@/lib/notion/posts'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { memo, post_type, source_type } = await req.json()

    if (!memo || memo.trim() === '') {
      return NextResponse.json({ error: 'メモは必須です' }, { status: 400 })
    }

    const { threads, x } = await convertMemoBoth(memo, post_type, source_type)

    const [threadsPost, xPost] = await Promise.all([
      createPost({
        id: generateId(),
        content: threads,
        source_type,
        post_type,
        priority: 10,
        status: 'draft',
        platform: 'threads',
      }),
      createPost({
        id: generateId(),
        content: x,
        source_type,
        post_type,
        priority: 10,
        status: 'draft',
        platform: 'x',
      }),
    ])

    return NextResponse.json({
      threads: { content: threads, post_id: threadsPost.notion_page_id },
      x: { content: x, post_id: xPost.notion_page_id },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/memo/convert]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
