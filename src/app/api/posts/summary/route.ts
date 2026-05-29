import { NextResponse } from 'next/server'
import { getPosts } from '@/lib/notion/posts'

export const dynamic = 'force-dynamic'

const STOCK_STATUSES = ['draft', 'approved', 'queued', 'buffered'] as const

export async function GET() {
  try {
    const posts = await getPosts({ limit: 200 })

    const summary = {
      threads: { total: 0, draft: 0, approved: 0, queued: 0, buffered: 0 },
      x:       { total: 0, draft: 0, approved: 0, queued: 0, buffered: 0 },
    }

    for (const post of posts) {
      const platform = post.platform === 'x' ? 'x' : 'threads'
      if (!STOCK_STATUSES.includes(post.status as typeof STOCK_STATUSES[number])) continue
      summary[platform].total++
      if (post.status in summary[platform]) {
        (summary[platform] as Record<string, number>)[post.status]++
      }
    }

    return NextResponse.json(summary)
  } catch (error) {
    console.error('[GET /api/posts/summary]', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
