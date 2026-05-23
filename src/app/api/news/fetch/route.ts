import { NextResponse } from 'next/server'
import { runNewsFetchWorker } from '@/lib/news/fetcher'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await runNewsFetchWorker()
    return NextResponse.json(result)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/news/fetch]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
