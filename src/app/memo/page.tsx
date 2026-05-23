'use client'

import { useState } from 'react'
import type { PostType, SourceType } from '@/types'

const POST_TYPES: PostType[] = ['共感系', 'ノウハウ系', '実践ログ', '失敗談', '短文', 'スレッド', 'AIニュース解説']
const SOURCE_TYPES: SourceType[] = ['memo', 'dev_log', 'insight', 'failure', 'ai_news']

interface ConvertResult {
  threads: { content: string; post_id: string }
  x: { content: string; post_id: string }
}

export default function MemoPage() {
  const [memo, setMemo]             = useState('')
  const [postType, setPostType]     = useState<PostType>('実践ログ')
  const [sourceType, setSourceType] = useState<SourceType>('memo')
  const [result, setResult]         = useState<ConvertResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const handleConvert = async () => {
    if (!memo.trim()) return
    setLoading(true)
    setResult(null)
    setError('')

    try {
      const res = await fetch('/api/memo/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo, post_type: postType, source_type: sourceType }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
      } else {
        setError(data.error ?? '変換に失敗しました')
      }
    } catch {
      setError('変換に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        雑メモ → 投稿変換
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <textarea
          rows={4}
          placeholder="思いついたことを書く。箇条書きでもOK。"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.95rem', resize: 'vertical', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>投稿タイプ</label>
            <select value={postType} onChange={(e) => setPostType(e.target.value as PostType)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem' }}>
              {POST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: '#6b7280', marginBottom: 4 }}>ソース</label>
            <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem' }}>
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleConvert} disabled={loading || !memo.trim()}
          style={{ padding: '0.75rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 8,
            cursor: loading || !memo.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !memo.trim() ? 0.6 : 1, fontSize: '1rem', fontWeight: 600 }}>
          {loading ? 'AI変換中...' : 'Threads + X の両方に変換'}
        </button>

        {error && <div style={{ color: '#dc2626', fontSize: '0.9rem' }}>⚠ {error}</div>}

        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Threads */}
            <div style={{ border: '1px solid #ede9fe', borderRadius: 8, padding: '1rem', background: '#faf5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#7c3aed' }}>Threads用</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{result.threads.content.length}字</span>
              </div>
              <p style={{ margin: '0 0 0.5rem', whiteSpace: 'pre-line', fontSize: '0.95rem', lineHeight: 1.7 }}>
                {result.threads.content}
              </p>
              <div style={{ fontSize: '0.75rem', color: '#a78bfa' }}>✓ Notionに保存済み（draft）</div>
            </div>

            {/* X */}
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#f9fafb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151' }}>𝕏 X用</span>
                <span style={{ fontSize: '0.75rem', color: result.x.content.length > 140 ? '#dc2626' : '#9ca3af' }}>
                  {result.x.content.length}字
                </span>
              </div>
              <p style={{ margin: '0 0 0.5rem', whiteSpace: 'pre-line', fontSize: '0.95rem', lineHeight: 1.7 }}>
                {result.x.content}
              </p>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>✓ Notionに保存済み（draft）</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
