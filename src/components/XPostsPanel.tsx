"use client";

/**
 * components/XPostsPanel.tsx
 * Threads投稿の生成・表示・コピーパネル
 */

import { useState } from "react";
import styles from "./XPostsPanel.module.css";

interface XPostsPanelProps {
  articleBody: string;
  articleId?: string;
}

export default function XPostsPanel({ articleBody, articleId }: XPostsPanelProps) {
  const [post, setPost]           = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState("");
  const [noteUrl, setNoteUrl]     = useState("");
  const [copied, setCopied]       = useState(false);
  const [stockState, setStockState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [stockError, setStockError] = useState("");

  const handleGenerate = async () => {
    if (!articleBody) return;
    setIsLoading(true);
    setError("");
    setPost("");
    setStockState("idle");

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
        setPost(data.post);
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToStock = async () => {
    setStockState("saving");
    setStockError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: post,
          source_type: "article",
          source_id: articleId,
          post_type: "短文",
          priority: 5,
          status: "draft",
          platform: "threads",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setStockState("done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "不明なエラー";
      setStockError(msg);
      setStockState("error");
      setTimeout(() => setStockState("idle"), 5000);
    }
  };

  return (
    <div className={styles.container}>

      {/* ヘッダー */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerIcon}>T</span>
          <div>
            <p className={styles.headerTitle}>Threads投稿を自動生成</p>
            <p className={styles.headerSub}>記事からnote誘導ポストを作成</p>
          </div>
        </div>
      </div>

      {/* noteのURL入力 */}
      <div className={styles.urlSection}>
        <label className={styles.urlLabel}>
          noteのURL（任意・投稿末尾に挿入）
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
          <><span className={styles.spinner} /> 生成中...</>
        ) : (
          <>📝 Threads投稿を生成する</>
        )}
      </button>

      {/* エラー */}
      {error && (
        <div className={styles.error}>⚠ {error}</div>
      )}

      {/* 投稿 */}
      {post && (
        <div className={styles.postsSection}>

          <div className={styles.allCopyRow}>
            <span className={styles.postsTitle}>生成された投稿</span>
            <button className={styles.allCopyBtn} onClick={handleCopy}>
              {copied ? "✓ コピー完了" : "📋 コピー"}
            </button>
          </div>

          <div className={styles.postCard}>
            <div className={styles.postBody}>{post}</div>
            <div className={styles.postFooter}>
              <span className={styles.charCount}>{post.length}文字</span>
              <button
                className={`${styles.bufferBtn} ${
                  stockState === "done"  ? styles.bufferBtnDone  :
                  stockState === "error" ? styles.bufferBtnError : ""
                }`}
                onClick={handleSaveToStock}
                disabled={stockState === "saving" || stockState === "done"}
              >
                {stockState === "saving" ? "保存中..." :
                 stockState === "done"   ? "✓ ストックに追加済み" :
                 stockState === "error"  ? "⚠ エラー" :
                 "📥 ストックに追加"}
              </button>
            </div>
          </div>

          {stockError && (
            <div className={styles.error}>⚠ {stockError}</div>
          )}

        </div>
      )}
    </div>
  );
}
