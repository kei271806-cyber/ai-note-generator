import { getPosts } from '@/lib/notion/posts'
import type { QueueBalance } from '@/types'

export async function getQueueBalance(): Promise<QueueBalance> {
  const posts = await getPosts({ status: 'approved', limit: 100 })

  const counts = {
    dev_log: 0,
    ai_news: 0,
    insight: 0,
    article: 0,
  }

  for (const post of posts) {
    if (post.source_type === 'dev_log') counts.dev_log++
    else if (post.source_type === 'ai_news') counts.ai_news++
    else if (post.source_type === 'insight' || post.source_type === 'failure' || post.source_type === 'memo') counts.insight++
    else if (post.source_type === 'article') counts.article++
  }

  return {
    ...counts,
    total: posts.length,
  }
}
