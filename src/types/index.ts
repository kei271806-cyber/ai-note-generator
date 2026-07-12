export type SourceType =
  | 'article'
  | 'ai_news'
  | 'dev_log'
  | 'insight'
  | 'failure'
  | 'memo'

export type PostType =
  | '共感系'
  | 'ノウハウ系'
  | '実践ログ'
  | '失敗談'
  | '短文'
  | 'スレッド'
  | 'AIニュース解説'

export type PostStatus =
  | 'draft'
  | 'approved'
  | 'queued'
  | 'buffered'
  | 'posted'
  | 'failed'
  | 'rejected'

export type Platform = 'threads' | 'x'

export interface XPost {
  id: string
  content: string
  source_type: SourceType
  source_id?: string
  post_type: PostType
  priority: number
  status: PostStatus
  scheduled_at?: string
  buffered_at?: string
  posted_at?: string
  impressions?: number
  likes?: number
  reposts?: number
  buffer_post_id?: string
  error_message?: string
  created_at: string
  notion_page_id: string
  platform: Platform
}

export interface MemoConvertRequest {
  memo: string
  post_type: PostType
  source_type: SourceType
}

export interface MemoConvertResponse {
  content: string
  post_type: PostType
  source_type: SourceType
}

export interface BufferStatus {
  pending_count: number
  profile_id: string
}

export interface QueueBalance {
  dev_log: number
  ai_news: number
  insight: number
  article: number
  total: number
}
