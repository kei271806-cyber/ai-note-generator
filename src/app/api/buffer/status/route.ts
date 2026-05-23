import { NextResponse } from 'next/server'
import { getBufferQueueCount } from '@/lib/buffer/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const status = await getBufferQueueCount()
    return NextResponse.json(status)
  } catch (error) {
    console.error('[GET /api/buffer/status]', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}
