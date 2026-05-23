import { NextRequest, NextResponse } from 'next/server'
import { updatePost } from '@/lib/notion/posts'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const post = await updatePost(params.id, body)
    return NextResponse.json(post)
  } catch (error) {
    console.error('[PATCH /api/posts/[id]]', error)
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 })
  }
}
