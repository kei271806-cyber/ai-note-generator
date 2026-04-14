"use client";

/**
 * components/XPostsPanel.tsx
 * X投稿の生成・表示・コピーパネル
 */

import { useState } from "react";
import styles from "./XPostsPanel.module.css";

interface XPosts {
  hook:       string;
  knowhow:    string;
  experience: string;
  cta:        string;
  philosophy: string;
}

interface XPostsPanelProps {
  articleBody: string;
}

const POST_LABELS = [
  { key: "hook",        icon: "🔥", label: "① フック投稿",    desc: "バズ狙い" },
  { key: "knowhow",     icon: "💡", label: "② ノウハウ投稿",  desc: "価値提供" },
  { key: "experience",  icon: "💬", label: "③ 体験投稿",      desc: "共感" },
  { key: "cta",         icon: "📎", label: "④ 誘導投稿",      desc: "noteリンク付き" },
  { key: "philosophy",  icon: "✨", label: "⑤ 思想投稿",      desc: "フォロー獲得" },
] as const;

export default function XPostsPanel({ articleBody }: XPostsPanelProps) {
  const [posts, setPosts]         = useState<XPosts | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [noteUrl, setNoteUrl]     = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // X投稿を生成
  const handleGenerate = async () => {
    if (!articleBody) return;
    setIsLoading(true);
    setError("");
    setPosts(null);

    try {
      const res = await fetch("/api/generate-x-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          article: articleBody,
          noteUrl: noteUrl.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPosts(data.posts);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  // コピー
  const handleCopy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 全件コピー
  const handleCopyAll = async () => {
    if (!posts) return;
    const allText = POST_LABELS
      .map((p) => `${p.icon} ${p.label}\n${posts[p.key]}\n`)
      .join("\n");
    await navigator.clipboard.writeText(allText).catch(() => {});
    setCopiedKey("all");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className={styles.container}>

      {/* ヘッダー */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>𝕏</span>
          <div>
            <p className={styles.headerTitle}>X投稿を自動生成</p>
            <p className={styles.headerSub}>記事からnote誘導ポストを5種類作成</p>
          </div>
        </div>
      </div>

      {/* noteのURL入力 */}
      <div className={styles.urlSection}>
        <label className={styles.urlLabel}>
          noteのURL（任意・④誘導投稿に使用）
        </label>
        <input
          type="text"
          className={styles.urlInput}
          placeholder="https://note.com/あなたのID/n/xxx"
          value={noteUrl}
          onChange={(e) => setNoteUrl(e.target.value)}
        />
      </div>

      {/* 生成ボタン */}
      <button
        className={styles.generateBtn}
        onClick={handleGenerate}
        disabled={isLoading || !articleBody}
      >
        {isLoading ? (
          <><span className={styles.spinner} /> X投稿を生成中...</>
        ) : (
          <>𝕏 X投稿を5つ生成する</>
        )}
      </button>

      {/* エラー */}
      {error && (
        <div className={styles.error}>⚠ {error}</div>
      )}

      {/* 投稿一覧 */}
      {posts && (
        <div className={styles.postsSection}>

          {/* 全件コピー */}
          <div className={styles.allCopyRow}>
            <span className={styles.postsTitle}>生成された投稿</span>
            <button
              className={styles.allCopyBtn}
              onClick={handleCopyAll}
            >
              {copiedKey === "all" ? "✓ コピー完了" : "📋 全件コピー"}
            </button>
          </div>

          {/* 各投稿 */}
          {POST_LABELS.map((item) => (
            <div key={item.key} className={styles.postCard}>
              <div className={styles.postHeader}>
                <div className={styles.postMeta}>
                  <span className={styles.postIcon}>{item.icon}</span>
                  <span className={styles.postLabel}>{item.label}</span>
                  <span className={styles.postDesc}>{item.desc}</span>
                </div>
                <button
                  className={`${styles.copyBtn} ${copiedKey === item.key ? styles.copyBtnDone : ""}`}
                  onClick={() => handleCopy(item.key, posts[item.key])}
                >
                  {copiedKey === item.key ? "✓ 完了" : "📋 コピー"}
                </button>
              </div>
              <div className={styles.postBody}>
                {posts[item.key]}
              </div>
              <div className={styles.postFooter}>
                <span className={styles.charCount}>
                  {posts[item.key].length}文字
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}