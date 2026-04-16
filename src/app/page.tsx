"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Article } from "@/lib/notion";
import Header from "@/components/Header";
import ArticleCard from "@/components/ArticleCard";
import ArticleDetail from "@/components/ArticleDetail";
import Toast, { ToastMessage } from "@/components/Toast";
import { DEFAULT_CHANNEL_ID } from "@/lib/channels";
import styles from "./page.module.css";

export default function HomePage() {
  const [channelId, setChannelId]       = useState(DEFAULT_CHANNEL_ID);
  const [articles, setArticles]         = useState<Article[]>([]);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [isLoading, setIsLoading]       = useState(false);
  const [isFetching, setIsFetching]     = useState(true);
  const [toasts, setToasts]             = useState<ToastMessage[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [manualTheme, setManualTheme]   = useState("");
  const [showThemeInput, setShowThemeInput] = useState(false);
  const themeInputRef = useRef<HTMLTextAreaElement>(null);

  const addToast = useCallback(
    (type: ToastMessage["type"], message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── 記事一覧を取得（キャッシュ完全無効）──
  const fetchArticles = useCallback(async (cid = channelId) => {
    setIsFetching(true);
    try {
      const res = await fetch(`/api/articles?channelId=${cid}&t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      const data = await res.json();
      if (data.success) {
        setArticles(data.articles);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      addToast("error", `記事の取得に失敗しました: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsFetching(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchArticles(channelId);
  }, [channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── テーマ生成（Gemini）──
  const handleChannelChange = (newChannelId: string) => {
    setChannelId(newChannelId);
    setSelectedId(null);
    setFilterStatus("all");
  };

  const handleGenerateTheme = async () => {
    setIsLoading(true);
    addToast("info", "Gemini でテーマを生成中...");
    try {
      const res = await fetch("/api/generate-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", `テーマを生成しました：「${data.data.theme}」`);
        await fetchArticles();
      } else {
        throw new Error(data.error || data.message);
      }
    } catch (error) {
      addToast("error", `テーマ生成失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── テーマ手動追加 ──
  const handleAddManualTheme = async () => {
    if (!manualTheme.trim()) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/create-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: manualTheme.trim(), channelId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", `テーマを追加しました：「${manualTheme.trim()}」`);
        setManualTheme("");
        setShowThemeInput(false);
        await fetchArticles();
      } else {
        throw new Error(data.error || data.message);
      }
    } catch (error) {
      addToast("error", `テーマ追加失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 記事生成（Gemini）──
  const handleGenerateArticle = async () => {
    setIsLoading(true);
    addToast("info", "Gemini で記事を生成中...（1〜2分かかります）");
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", `記事を生成しました！`);
        await fetchArticles();
        if (data.data.pageId) setSelectedId(data.data.pageId);
      } else {
        throw new Error(data.error || data.message);
      }
    } catch (error) {
      addToast("error", `記事生成失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── 再生成 ──
  const handleRegenerate = async (pageId: string, theme: string) => {
    setIsLoading(true);
    addToast("info", `「${theme}」の記事を再生成中...`);
    try {
      const res = await fetch("/api/generate-article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, theme, channelId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "記事を再生成しました！");
        await fetchArticles();
        setSelectedId(pageId);
      } else {
        throw new Error(data.error || data.message);
      }
    } catch (error) {
      addToast("error", `再生成失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ── テーマ削除 ──
  const handleDelete = async (pageId: string) => {
    if (!confirm("このテーマを削除しますか？")) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/delete-article", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();
      if (data.success) {
        addToast("success", "削除しました");
        if (selectedId === pageId) setSelectedId(null);
        await fetchArticles();
      } else {
        throw new Error(data.error || data.message);
      }
    } catch (error) {
      addToast("error", `削除失敗: ${error instanceof Error ? error.message : "不明なエラー"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredArticles = articles.filter((a) =>
    filterStatus === "all" ? true : a.status === filterStatus
  );

  const selectedArticle = articles.find((a) => a.id === selectedId) ?? null;

  const stats = {
    total:   articles.length,
    pending: articles.filter((a) => a.status === "未作成").length,
    done:    articles.filter((a) => a.status === "生成済").length,
    posted:  articles.filter((a) => a.status === "投稿済").length,
  };

  return (
    <>
      <Header
        channelId={channelId}
        onChannelChange={handleChannelChange}
        onGenerateTheme={handleGenerateTheme}
        onGenerateArticle={handleGenerateArticle}
        isLoading={isLoading}
      />

      <div className={styles.layout}>
        {/* ── 左サイドバー ── */}
        <aside className={styles.sidebar}>

          {/* 統計 */}
          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <span className={styles.statNum}>{stats.total}</span>
              <span className={styles.statName}>総記事数</span>
            </div>
            <div className={styles.statBox}>
              <span className={`${styles.statNum} ${styles.statNumPending}`}>{stats.pending}</span>
              <span className={styles.statName}>未作成</span>
            </div>
            <div className={styles.statBox}>
              <span className={`${styles.statNum} ${styles.statNumDone}`}>{stats.done}</span>
              <span className={styles.statName}>生成済</span>
            </div>
          </div>

          {/* テーマ手動入力 */}
          <div className={styles.manualThemeSection}>
            {showThemeInput ? (
              <div className={styles.themeInputWrap}>
                <textarea
                  ref={themeInputRef}
                  className={styles.themeInput}
                  placeholder="記事テーマを入力してください..."
                  value={manualTheme}
                  onChange={(e) => setManualTheme(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
                <div className={styles.themeInputActions}>
                  <button
                    className={styles.btnCancel}
                    onClick={() => { setShowThemeInput(false); setManualTheme(""); }}
                  >
                    キャンセル
                  </button>
                  <button
                    className={styles.btnAdd}
                    onClick={handleAddManualTheme}
                    disabled={isLoading || !manualTheme.trim()}
                  >
                    追加
                  </button>
                </div>
              </div>
            ) : (
              <button
                className={styles.btnAddTheme}
                onClick={() => { setShowThemeInput(true); setTimeout(() => themeInputRef.current?.focus(), 100); }}
                disabled={isLoading}
              >
                ＋ テーマを手動で追加
              </button>
            )}
          </div>

          {/* フィルター */}
          <div className={styles.filterTabs}>
            {[
              { value: "all",  label: "すべて" },
              { value: "未作成", label: "未作成" },
              { value: "生成済", label: "生成済" },
              { value: "投稿済", label: "投稿済" },
            ].map((f) => (
              <button
                key={f.value}
                className={`${styles.filterTab} ${filterStatus === f.value ? styles.filterTabActive : ""}`}
                onClick={() => setFilterStatus(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* 記事リスト */}
          <div className={styles.articleList}>
            {isFetching ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.skeletonCard}>
                  <div className={`skeleton ${styles.skeletonBadge}`} />
                  <div className={`skeleton ${styles.skeletonTitle}`} />
                  <div className={`skeleton ${styles.skeletonMeta}`} />
                </div>
              ))
            ) : filteredArticles.length === 0 ? (
              <div className={styles.emptyList}>
                <p>記事がありません</p>
                <p className={styles.emptyListSub}>テーマを生成または手動追加してください</p>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  isSelected={selectedId === article.id}
                  onClick={() => setSelectedId(selectedId === article.id ? null : article.id)}
                  onDelete={() => handleDelete(article.id)}
                />
              ))
            )}
          </div>

          {/* 更新ボタン */}
          <button
            className={styles.refreshBtn}
            onClick={() => fetchArticles()}
            disabled={isFetching}
          >
            {isFetching ? <span className={styles.spinner} /> : "↻"}
            一覧を更新
          </button>
        </aside>

        {/* ── メインエリア ── */}
        <main className={styles.main}>
          {selectedArticle ? (
            <ArticleDetail
              article={selectedArticle}
              onRegenerate={handleRegenerate}
              isLoading={isLoading}
            />
          ) : (
            <div className={styles.placeholder}>
              <div className={styles.placeholderInner}>
                <div className={styles.placeholderIcon}>
                  <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="8" width="48" height="6" rx="1" fill="currentColor" opacity="0.15"/>
                    <rect x="8" y="20" width="36" height="4" rx="1" fill="currentColor" opacity="0.1"/>
                    <rect x="8" y="30" width="48" height="3" rx="1" fill="currentColor" opacity="0.08"/>
                    <rect x="8" y="37" width="42" height="3" rx="1" fill="currentColor" opacity="0.08"/>
                    <rect x="8" y="44" width="30" height="3" rx="1" fill="currentColor" opacity="0.08"/>
                  </svg>
                </div>
                <h3 className={styles.placeholderTitle}>記事を選択してください</h3>
                <p className={styles.placeholderSub}>左のリストから記事を選ぶと<br />本文とタイトル案が表示されます</p>
                <div className={styles.placeholderFlow}>
                  <div className={styles.flowStep}>
                    <span className={styles.flowNum}>1</span>
                    <span>テーマ生成</span>
                  </div>
                  <span className={styles.flowArrow}>→</span>
                  <div className={styles.flowStep}>
                    <span className={styles.flowNum}>2</span>
                    <span>記事生成</span>
                  </div>
                  <span className={styles.flowArrow}>→</span>
                  <div className={styles.flowStep}>
                    <span className={styles.flowNum}>3</span>
                    <span>コピペ投稿</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <Toast messages={toasts} onRemove={removeToast} />
    </>
  );
}