'use client'

import { useEffect, useState } from 'react'
import type { XPost, PostStatus } from '@/types'

const STATUS_COLORS: Record<PostStatus, string> = {
  draft:     'background:#e5e7eb;color:#374151',
  approved:  'background:#dbeafe;color:#1d4ed8',
  queued:    'background:#fef9c3;color:#92400e',
  buffered:  'background:#ede9fe;color:#5b21b6',
  posted:    'background:#d1fae5;color:#065f46',
  failed:    'background:#fee2e2;color:#991b1b',
}

const STATUS_LABELS: PostStatus[] = ['draft', 'approved', 'queued', 'buffered', 'posted', 'failed']

export default function QueuePage() {
  const [posts, setPosts]           = useState<XPost[]>([])
  const [filter, setFilter]         = useState<PostStatus | 'all'>('all')
  const [memoOnly, setMemoOnly]     = useState(false)
  const [bufferCount, setBufferCount] = useState<number | null>(null)
  const [stockSummary, setStockSummary] = useState<{ threads: number; x: number } | null>(null)
  const [loading, setLoading]       = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [refilling, setRefilling]   = useState(false)
  const [refillLog, setRefillLog]   = useState<string[] | null>(null)

  const MANUAL_SOURCE_TYPES = 'memo,dev_log,insight,failure'

  const fetchPosts = async (f: PostStatus | 'all', manual = memoOnly) => {
    setLoading(true)
    setFetchError(null)
    try {
      const params = new URLSearchParams()
      if (f !== 'all') params.set('status', f)
      if (manual) params.set('source_types', MANUAL_SOURCE_TYPES)
      const url = `/api/posts${params.toString() ? '?' + params.toString() : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) {
        setFetchError(data.error ?? `APIエラー (HTTP ${res.status})`)
        setPosts([])
        return
      }
      setPosts(Array.isArray(data) ? data : [])
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '通信エラー')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  const fetchBufferCount = async () => {
    try {
      const res = await fetch('/api/buffer/status')
      const data = await res.json()
      setBufferCount(data.pending_count ?? null)
    } catch {
      setBufferCount(null)
    }
  }

  const fetchStockSummary = async () => {
    try {
      const res = await fetch('/api/posts/summary')
      const data = await res.json()
      setStockSummary({ threads: data.threads?.total ?? 0, x: data.x?.total ?? 0 })
    } catch {
      setStockSummary(null)
    }
  }

  useEffect(() => {
    fetchPosts(filter, memoOnly)
    fetchBufferCount()
    fetchStockSummary()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, memoOnly])

  const handleRefill = async () => {
    setRefilling(true)
    setRefillLog(null)
    try {
      const res = await fetch('/api/buffer/refill', { method: 'POST' })
      const data = await res.json()
      setRefillLog(data.log ?? [`補充数: ${data.refilled ?? 0}`])
      fetchStockSummary()
    } catch (e) {
      setRefillLog([`エラー: ${e instanceof Error ? e.message : '不明'}`])
    } finally {
      setRefilling(false)
    }
  }

  const handleStatusChange = async (post: XPost, status: PostStatus) => {
    await fetch(`/api/posts/${post.notion_page_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await fetchPosts(filter)
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>投稿Queue</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={handleRefill}
            disabled={refilling}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 6,
              border: 'none',
              cursor: refilling ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: 600,
              background: refilling ? '#e5e7eb' : '#111827',
              color: refilling ? '#6b7280' : '#fff',
            }}
          >
            {refilling ? '補充中...' : '▶ 今すぐ補充'}
          </button>
          {stockSummary !== null && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>ストック:</span>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 9999,
                fontSize: '0.875rem',
                fontWeight: 600,
                background: stockSummary.threads === 0 ? '#fee2e2' : '#ede9fe',
                color: stockSummary.threads === 0 ? '#991b1b' : '#5b21b6',
              }}>
                Threads {stockSummary.threads}件
              </span>
              <span style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 9999,
                fontSize: '0.875rem',
                fontWeight: 600,
                background: stockSummary.x === 0 ? '#fee2e2' : '#f3f4f6',
                color: stockSummary.x === 0 ? '#991b1b' : '#374151',
              }}>
                𝕏 {stockSummary.x}件
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 補充ログ */}
      {refillLog && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8rem', fontFamily: 'monospace' }}>
          {refillLog.map((line, i) => (
            <div key={i} style={{ color: line.includes('✗') || line.includes('エラー') ? '#991b1b' : line.includes('✓') ? '#065f46' : '#374151' }}>
              {line}
            </div>
          ))}
        </div>
      )}

      {/* ステータスフィルター */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
        {(['all', ...STATUS_LABELS] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 9999,
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              fontSize: '0.875rem',
              background: filter === s ? '#111827' : '#fff',
              color: filter === s ? '#fff' : '#374151',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* memo フィルター */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setMemoOnly((v) => !v)}
          style={{
            padding: '0.2rem 0.75rem',
            borderRadius: 9999,
            border: `1px solid ${memoOnly ? '#7c3aed' : '#d1d5db'}`,
            cursor: 'pointer',
            fontSize: '0.8rem',
            background: memoOnly ? '#ede9fe' : '#fff',
            color: memoOnly ? '#7c3aed' : '#6b7280',
            fontWeight: memoOnly ? 700 : 400,
          }}
        >
          ✏ 手動投稿のみ
        </button>
        {memoOnly && (
          <span style={{ fontSize: '0.75rem', color: '#7c3aed' }}>
            手動投稿（memo・実践ログ・失敗談・insight）だけ表示中
          </span>
        )}
      </div>

      {/* エラー表示 */}
      {fetchError && (
        <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, fontSize: '0.875rem', color: '#991b1b' }}>
          ⚠ 投稿の取得に失敗しました：{fetchError}
        </div>
      )}

      {/* 投稿一覧 */}
      {loading ? (
        <p style={{ color: '#6b7280' }}>読み込み中...</p>
      ) : !fetchError && posts.length === 0 ? (
        <p style={{ color: '#6b7280' }}>投稿がありません</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {posts.map((post) => (
            <div
              key={post.notion_page_id}
              style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#fff' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ padding: '0.1rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', ...Object.fromEntries(STATUS_COLORS[post.status].split(';').map(s => s.split(':'))) }}>
                    {post.status}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{post.source_type}</span>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{post.post_type}</span>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: 4,
                    background: post.platform === 'x' ? '#f3f4f6' : '#ede9fe',
                    color: post.platform === 'x' ? '#374151' : '#7c3aed',
                  }}>
                    {post.platform === 'x' ? '𝕏' : 'Threads'}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>優先度: {post.priority}</span>
              </div>

              <p style={{ margin: '0 0 0.75rem', whiteSpace: 'pre-line', fontSize: '0.9rem', lineHeight: 1.6 }}>
                {post.content}
              </p>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {post.status === 'draft' && (
                  <button
                    onClick={() => handleStatusChange(post, 'approved')}
                    style={{ padding: '0.25rem 0.75rem', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    ✓ 承認
                  </button>
                )}
                {post.status === 'approved' && (
                  <button
                    onClick={() => handleStatusChange(post, 'draft')}
                    style={{ padding: '0.25rem 0.75rem', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    下書きに戻す
                  </button>
                )}
                {post.status === 'failed' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(post, 'draft')}
                      style={{ padding: '0.25rem 0.75rem', background: '#fef9c3', color: '#92400e', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      ↩ 下書きに戻す
                    </button>
                    {post.error_message && (
                      <span style={{ fontSize: '0.75rem', color: '#991b1b', alignSelf: 'center' }}>
                        エラー: {post.error_message}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
