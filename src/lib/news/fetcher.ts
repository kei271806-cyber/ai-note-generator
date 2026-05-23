import { summarizeNewsToPost, summarizeNewsToXPost } from '@/lib/ai/gemini'
import { createPost, existsBySourceId, generateId } from '@/lib/notion/posts'

const NEWS_SOURCES = [
  {
    name: 'Ledge.ai',
    url: 'https://news.google.com/rss/search?q=site:ledge.ai&hl=ja&gl=JP&ceid=JP:ja',
    maxItems: 3,
  },
  {
    name: 'TechCrunch AI',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    maxItems: 2,
  },
  {
    name: 'VentureBeat AI',
    url: 'https://venturebeat.com/category/ai/feed/',
    maxItems: 2,
  },
]

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
}

function extractTag(xml: string, tag: string): string {
  const cdata = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i').exec(xml)
  if (cdata) return cdata[1].trim()
  const plain = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  if (plain) return plain[1].replace(/<[^>]+>/g, '').trim()
  return ''
}

function parseRSS(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const raw = match[1]
    const title = extractTag(raw, 'title')
    const description = extractTag(raw, 'description')
    const pubDate = extractTag(raw, 'pubDate')

    // <link> は自己終了タグの場合がある
    const linkMatch = /<link>([^<]+)<\/link>/.exec(raw) || /<guid[^>]*>([^<]+)<\/guid>/.exec(raw)
    const link = linkMatch ? linkMatch[1].trim() : ''

    if (title && link) {
      items.push({ title, link, description, pubDate })
    }
  }

  return items
}

function cleanTitle(title: string): string {
  // Google News の "タイトル - サイト名" から サイト名を除去
  return title.replace(/\s*[-–]\s*(Ledge\.ai|TechCrunch|VentureBeat)[^$]*$/i, '').trim()
}

function isRecent(pubDate: string, days = 3): boolean {
  if (!pubDate) return true
  const date = new Date(pubDate)
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return date >= cutoff
}

export async function runNewsFetchWorker(): Promise<{ saved: number; log: string[] }> {
  const log: string[] = []
  let saved = 0

  for (const source of NEWS_SOURCES) {
    log.push(`[${source.name}] 取得中...`)

    try {
      const res = await fetch(source.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RSS reader)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        log.push(`[${source.name}] HTTP ${res.status}`)
        continue
      }

      const xml = await res.text()
      const items = parseRSS(xml)
        .filter((item) => isRecent(item.pubDate))
        .slice(0, source.maxItems)

      log.push(`[${source.name}] ${items.length}件（直近2日）`)

      for (const item of items) {
        const sourceId = item.link

        if (await existsBySourceId(sourceId)) {
          log.push(`  スキップ（保存済み）: ${cleanTitle(item.title).slice(0, 40)}`)
          continue
        }

        const title = cleanTitle(item.title)
        const summary = item.description.slice(0, 300) || title

        const [threadsContent, xContent] = await Promise.all([
          summarizeNewsToPost(title, summary),
          summarizeNewsToXPost(title, summary),
        ])

        await Promise.all([
          createPost({
            id: generateId(),
            content: threadsContent,
            source_type: 'ai_news',
            source_id: sourceId,
            post_type: 'AIニュース解説',
            priority: 6,
            status: 'draft',
            platform: 'threads',
          }),
          createPost({
            id: generateId(),
            content: xContent,
            source_type: 'ai_news',
            source_id: `${sourceId}__x`,
            post_type: 'AIニュース解説',
            priority: 6,
            status: 'draft',
            platform: 'x',
          }),
        ])

        log.push(`  ✓ 保存: ${title.slice(0, 40)}`)
        saved++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.push(`[${source.name}] エラー: ${msg}`)
    }
  }

  return { saved, log }
}
