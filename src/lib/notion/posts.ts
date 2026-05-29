import { Client } from '@notionhq/client'
import type { XPost, PostStatus, SourceType, QueueBalance, Platform } from '@/types'

const notion = new Client({ auth: process.env.NOTION_API_KEY })

function getDbId(): string {
  const id = process.env.NOTION_POSTS_DB_ID
  if (!id) throw new Error('NOTION_POSTS_DB_ID が未設定です')
  return id
}

const TARGET_RATIO: Record<string, number> = {
  dev_log: 0.40,
  ai_news: 0.25,
  insight: 0.20,
  article: 0.15,
  failure: 0.00,
  memo: 0.00,
}

export function generateId(): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 7)
  return `post_${ts}_${rand}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function notionPageToPost(page: any): XPost {
  const p = page.properties
  return {
    notion_page_id: page.id,
    id: p['id']?.title?.[0]?.plain_text ?? '',
    content: p['content']?.rich_text?.map((t: { plain_text: string }) => t.plain_text).join('') ?? '',
    source_type: (p['source_type']?.select?.name ?? 'memo') as SourceType,
    source_id: p['source_id']?.rich_text?.[0]?.plain_text,
    post_type: p['post_type']?.select?.name ?? '短文',
    priority: p['priority']?.number ?? 5,
    status: (p['status']?.select?.name ?? 'draft') as PostStatus,
    scheduled_at: p['scheduled_at']?.date?.start,
    buffered_at: p['buffered_at']?.date?.start,
    posted_at: p['posted_at']?.date?.start,
    impressions: p['impressions']?.number ?? undefined,
    likes: p['likes']?.number ?? undefined,
    reposts: p['reposts']?.number ?? undefined,
    buffer_post_id: p['buffer_post_id']?.rich_text?.[0]?.plain_text,
    error_message: p['error_message']?.rich_text?.[0]?.plain_text,
    created_at: page.created_time,
    platform: (p['platform']?.select?.name ?? 'threads') as Platform,
  }
}

export async function getPosts({
  status,
  limit = 50,
}: {
  status?: PostStatus
  limit?: number
} = {}): Promise<XPost[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: any = status
    ? { property: 'status', select: { equals: status } }
    : undefined

  const response = await notion.databases.query({
    database_id: getDbId(),
    filter,
    sorts: [{ property: 'priority', direction: 'descending' }],
    page_size: limit,
  })

  return response.results.map(notionPageToPost)
}

function getLeastRepresentedType(balance: QueueBalance): SourceType {
  const counts: Record<string, number> = {
    dev_log: balance.dev_log,
    ai_news: balance.ai_news,
    insight: balance.insight,
    article: balance.article,
  }
  const total = balance.total || 1

  let worstType: SourceType = 'dev_log'
  let worstGap = -Infinity

  for (const [type, target] of Object.entries(TARGET_RATIO)) {
    if (target === 0) continue
    const actual = (counts[type] ?? 0) / total
    const gap = target - actual
    if (gap > worstGap) {
      worstGap = gap
      worstType = type as SourceType
    }
  }
  return worstType
}

export async function getApprovedPosts(
  limit: number,
  balance: QueueBalance
): Promise<XPost[]> {
  const allApproved = await getPosts({ status: 'approved', limit: 100 })
  if (allApproved.length === 0) return []

  const priorityType = getLeastRepresentedType(balance)
  const prioritized = allApproved.filter((p) => p.source_type === priorityType)
  const rest = allApproved.filter((p) => p.source_type !== priorityType)

  return [...prioritized, ...rest].slice(0, limit)
}

export async function createPost(
  data: Omit<XPost, 'notion_page_id' | 'created_at'>
): Promise<XPost> {
  const page = await notion.pages.create({
    parent: { database_id: getDbId() },
    properties: {
      id: { title: [{ type: 'text', text: { content: data.id } }] },
      content: { rich_text: [{ type: 'text', text: { content: data.content.slice(0, 1900) } }] },
      source_type: { select: { name: data.source_type } },
      source_id: data.source_id
        ? { rich_text: [{ type: 'text', text: { content: data.source_id } }] }
        : { rich_text: [] },
      post_type: { select: { name: data.post_type } },
      priority: { number: data.priority },
      status: { select: { name: data.status } },
      ...(data.platform ? { platform: { select: { name: data.platform } } } : {}),
    },
  })
  return notionPageToPost(page)
}

export async function updatePostStatus(
  pageId: string,
  status: PostStatus,
  extra?: {
    buffered_at?: string
    buffer_post_id?: string
    posted_at?: string
    error_message?: string
  }
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {
    status: { select: { name: status } },
  }

  if (extra?.buffered_at) {
    properties['buffered_at'] = { date: { start: extra.buffered_at } }
  }
  if (extra?.buffer_post_id) {
    properties['buffer_post_id'] = { rich_text: [{ type: 'text', text: { content: extra.buffer_post_id } }] }
  }
  if (extra?.posted_at) {
    properties['posted_at'] = { date: { start: extra.posted_at } }
  }
  if (extra?.error_message) {
    properties['error_message'] = { rich_text: [{ type: 'text', text: { content: extra.error_message.slice(0, 1900) } }] }
  }

  await notion.pages.update({ page_id: pageId, properties })
}

export async function existsBySourceId(sourceId: string): Promise<boolean> {
  const response = await notion.databases.query({
    database_id: getDbId(),
    filter: {
      property: 'source_id',
      rich_text: { equals: sourceId },
    },
    page_size: 1,
  })
  return response.results.length > 0
}

export async function updatePost(
  pageId: string,
  data: Partial<Pick<XPost, 'content' | 'status' | 'priority' | 'post_type' | 'source_type'>>
): Promise<XPost> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: any = {}

  if (data.content !== undefined) {
    properties['content'] = { rich_text: [{ type: 'text', text: { content: data.content.slice(0, 1900) } }] }
  }
  if (data.status !== undefined) {
    properties['status'] = { select: { name: data.status } }
  }
  if (data.priority !== undefined) {
    properties['priority'] = { number: data.priority }
  }
  if (data.post_type !== undefined) {
    properties['post_type'] = { select: { name: data.post_type } }
  }
  if (data.source_type !== undefined) {
    properties['source_type'] = { select: { name: data.source_type } }
  }

  const page = await notion.pages.update({ page_id: pageId, properties })
  return notionPageToPost(page)
}
