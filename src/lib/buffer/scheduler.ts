import { getBufferQueueCount, addToBuffer } from './client'
import { getApprovedPosts, updatePostStatus } from '@/lib/notion/posts'
import { getQueueBalance } from '@/lib/queue/balance'
import type { Platform } from '@/types'

const BUFFER_MIN_COUNT = 3
const BUFFER_TARGET = 6

async function refillPlatform(
  platform: Platform,
  balance: ReturnType<typeof getQueueBalance> extends Promise<infer T> ? T : never,
  log: string[]
): Promise<number> {
  const { pending_count } = await getBufferQueueCount(platform)
  log.push(`[${platform}] Buffer残数: ${pending_count}`)

  if (pending_count >= BUFFER_MIN_COUNT) {
    log.push(`[${platform}] 補充不要（${pending_count} >= ${BUFFER_MIN_COUNT}）`)
    return 0
  }

  const toRefill = BUFFER_TARGET - pending_count
  const allApproved = await getApprovedPosts(toRefill * 2, balance)
  const posts = allApproved.filter((p) => (p.platform ?? 'threads') === platform).slice(0, toRefill)

  if (posts.length === 0) {
    log.push(`[${platform}] 承認済み投稿なし`)
    return 0
  }

  let refilled = 0
  for (const post of posts) {
    try {
      const { id } = await addToBuffer(post.content, platform)
      await updatePostStatus(post.notion_page_id, 'buffered', {
        buffered_at: new Date().toISOString(),
        buffer_post_id: id,
      })
      log.push(`[${platform}] ✓ 追加: ${post.id}`)
      refilled++
    } catch (err) {
      const msg = err instanceof Error ? err.message : '不明なエラー'
      await updatePostStatus(post.notion_page_id, 'failed', { error_message: msg })
      log.push(`[${platform}] ✗ 失敗: ${post.id} - ${msg}`)
    }
  }
  return refilled
}

export async function runRefillWorker(): Promise<{ refilled: number; log: string[] }> {
  const log: string[] = []
  const balance = await getQueueBalance()
  log.push(`キューバランス: dev_log=${balance.dev_log} ai_news=${balance.ai_news} insight=${balance.insight} article=${balance.article}`)

  const [threadsCount, xCount] = await Promise.all([
    refillPlatform('threads', balance, log),
    refillPlatform('x', balance, log),
  ])

  return { refilled: threadsCount + xCount, log }
}
