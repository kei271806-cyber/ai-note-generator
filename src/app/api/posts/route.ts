import { NextRequest, NextResponse } from 'next/server'
import { getPosts, createPost, generateId } from '@/lib/notion/posts'
import type { PostStatus, SourceType } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') as PostStatus | null
    const limit = parseInt(searchParams.get('limit') ?? '200')
    const sourceTypesParam = searchParams.get('source_types')
    const sourceTypes = sourceTypesParam
      ? (sourceTypesParam.split(',') as SourceType[])
      : undefined

    const posts = await getPosts({ status: status ?? undefined, sourceTypes, limit })
    return NextResponse.json(posts)
  } catch (error) {
    console.error('[GET /api/posts]', error)
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const post = await createPost({
      id: generateId(),
      ...body,
    })
    return NextResponse.json(post, { status: 201 })
  } catch (error) {
    console.error('[POST /api/posts]', error)
    return NextResponse.json({ error: '作成に失敗しました' }, { status: 500 })
  }
}
