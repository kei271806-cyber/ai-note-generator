import { NextRequest, NextResponse } from 'next/server'
import { runRefillWorker } from '@/lib/buffer/scheduler'
import { runNewsFetchWorker } from '@/lib/news/fetcher'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [newsResult, refillResult] = await Promise.allSettled([
      runNewsFetchWorker(),
      runRefillWorker(),
    ])

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      news: newsResult.status === 'fulfilled' ? newsResult.value : { error: String(newsResult.reason) },
      refill: refillResult.status === 'fulfilled' ? refillResult.value : { error: String(refillResult.reason) },
    })
  } catch (error) {
    console.error('[GET /api/cron/scheduler]', error)
    return NextResponse.json({ error: 'スケジューラ実行に失敗しました' }, { status: 500 })
  }
}
