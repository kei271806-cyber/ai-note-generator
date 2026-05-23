import { NextResponse } from 'next/server'
import { runRefillWorker } from '@/lib/buffer/scheduler'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await runRefillWorker()
    return NextResponse.json(result)
  } catch (error) {
    console.error('[POST /api/buffer/refill]', error)
    return NextResponse.json({ error: '補充に失敗しました' }, { status: 500 })
  }
}
