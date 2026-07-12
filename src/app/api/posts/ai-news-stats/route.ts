import { NextResponse } from 'next/server'
import { getPosts } from '@/lib/notion/posts'

export const dynamic = 'force-dynamic'

const THRESHOLD = 100

export async function GET() {
  try {
    const [approved, rejected] = await Promise.all([
      getPosts({ sourceTypes: ['ai_news'], status: 'approved', limit: 100 }),
      getPosts({ sourceTypes: ['ai_news'], status: 'rejected', limit: 100 }),
    ])

    return NextResponse.json({
      approved: approved.length,
      rejected: rejected.length,
      approvedReady: approved.length >= THRESHOLD,
      rejectedReady: rejected.length >= THRESHOLD,
      ready: approved.length >= THRESHOLD && rejected.length >= THRESHOLD,
      threshold: THRESHOLD,
    })
  } catch (error) {
    console.error('[GET /api/posts/ai-news-stats]', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
