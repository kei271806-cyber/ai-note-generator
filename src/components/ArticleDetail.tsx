"use client";

import { useState } from "react";
import { Article } from "@/lib/notion";
import styles from "./ArticleDetail.module.css";

interface ArticleDetailProps {
  article: Article;
  onRegenerate: (pageId: string, theme: string) => Promise<void>;
  isLoading: boolean;
}

function renderMarkdown(md: string): string {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    .split("\n\n")
    .map((p) =>
      p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<blockquote") || p.startsWith("<li")
        ? p
        : `<p>${p.replace(/\n/g, "<br>")}</p>`
    )
    .join("");
}

export default function ArticleDetail({
  article,
  onRegenerate,
  isLoading,
}: ArticleDetailProps) {
  const [copyState, setCopyState]       = useState<"idle" | "copied">("idle");
  const [activeTab, setActiveTab]       = useState<"preview" | "raw">("preview");
  const [postState, setPostState]       = useState<"idle" | "posting" | "done" | "error">("idle");
  const [postError, setPostError]       = useState("");
  const [noteUrl, setNoteUrl]           = useState("");
  const [selectedTitleIdx, setSelectedTitleIdx] = useState(0);
  const [showCookieInput, setShowCookieInput]   = useState(false);
  const [sessionCookie, setSessionCookie]       = useState("");

  // タイトル案をパース
  const titles = article.titleCandidates
    ? article.titleCandidates
        .split("\n")
        .map((t) => t.replace(/^\d+\.\s*/, "").trim())
        .filter(Boolean)
    : [];

  const selectedTitle = titles[selectedTitleIdx] || article.title;

  // 本文コピー
  const handleCopyBody = async () => {
    try {
      await navigator.clipboard.writeText(article.body || "");
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = article.body || "";
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2500);
    }
  };

  // タイトルコピー
  const handleCopyTitle = async (title: string) => {
    await navigator.clipboard.writeText(title).catch(() => {});
  };

  // noteに下書き投稿
  const handlePostToNote = async () => {
    if (!article.body) return;

    // Cookieが未入力の場合は入力欄を表示
    if (!sessionCookie && !showCookieInput) {
      setShowCookieInput(true);
      return;
    }

    if (!sessionCookie) {
      setPostError("セッションCookieを入力してください");
      return;
    }

    setPostState("posting");
    setPostError("");

    try {
      const res = await fetch("/api/post-to-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: selectedTitle,
          body: article.body,
          sessionCookie: sessionCookie.trim(),
        }),
      });

      const data = await res.json();

      if (data.success) {
        setPostState("done");
        setNoteUrl(data.data.noteUrl);
        setShowCookieInput(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      setPostState("error");
      setPostError(error instanceof Error ? error.message : "投稿に失敗しました");
    }
  };

  // 文字数
  const charCount = article.body
    ? article.body.replace(/[#*\n`]/g, "").length
    : 0;
  const barPct = Math.min(100, (charCount / 3000) * 100);
  const isGoodLength = charCount >= 2000 && charCount <= 3000;

  if (!article.body && article.status === "未作成") {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>✦</div>
        <h3 className={styles.emptyTitle}>記事がまだ生成されていません</h3>
        <p className={styles.emptySub}>テーマ：「{article.title}」</p>
        <button
          className={styles.generateBtn}
          onClick={() => onRegenerate(article.id, article.title)}
          disabled={isLoading}
        >
          {isLoading ? <><span className={styles.spinner} /> 生成中...</> : <>⚡ この記事を生成する</>}
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>

      {/* テーマ見出し */}
      <div className={styles.themeHeader}>
        <span className={styles.themeLabel}>THEME</span>
        <h2 className={styles.themeText}>{article.title}</h2>
        <time className={styles.themeDate}>{article.createdAt}</time>
      </div>

      {/* タイトル案 */}
      {titles.length > 0 && (
        <div className={styles.titlesSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>タイトル案</span>
            <span className={styles.sectionCount}>{titles.length}案</span>
          </div>
          <div className={styles.titleList}>
            {titles.map((title, i) => (
              <div
                key={i}
                className={`${styles.titleItem} ${selectedTitleIdx === i ? styles.titleItemSelected : ""}`}
                onClick={() => setSelectedTitleIdx(i)}
              >
                <span className={styles.titleNum}>0{i + 1}</span>
                <span className={styles.titleText}>{title}</span>
                <button
                  className={styles.titleCopyBtn}
                  onClick={(e) => { e.stopPropagation(); handleCopyTitle(title); }}
                  title="コピー"
                >
                  📋
                </button>
              </div>
            ))}
          </div>
          <p className={styles.titleHint}>
            ✦ クリックで投稿タイトルを選択中：<strong>0{selectedTitleIdx + 1}</strong>
          </p>
        </div>
      )}

      {/* 記事本文 */}
      <div className={styles.articleSection}>
        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === "preview" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("preview")}
            >
              プレビュー
            </button>
            <button
              className={`${styles.tab} ${activeTab === "raw" ? styles.tabActive : ""}`}
              onClick={() => setActiveTab("raw")}
            >
              Markdown
            </button>
          </div>
          <div className={styles.toolbarActions}>
            <button
              className={`${styles.actionBtn} ${copyState === "copied" ? styles.actionBtnSuccess : styles.actionBtnPrimary}`}
              onClick={handleCopyBody}
              disabled={!article.body}
            >
              {copyState === "copied" ? "✓ コピー完了！" : "📄 本文をコピー"}
            </button>
            <button
              className={styles.actionBtn}
              onClick={() => onRegenerate(article.id, article.title)}
              disabled={isLoading}
            >
              {isLoading ? <><span className={styles.spinner} /> 生成中...</> : "🔄 再生成"}
            </button>
          </div>
        </div>

        <div className={styles.articleBody}>
          {activeTab === "preview" ? (
            <div
              className={`markdown-body ${styles.preview}`}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(article.body) }}
            />
          ) : (
            <pre className={styles.raw}>{article.body}</pre>
          )}
        </div>

        <div className={styles.statsBar}>
          <span className={styles.statLabel}>
            文字数：
            <strong className={isGoodLength ? styles.statGood : styles.statWarn}>
              {charCount.toLocaleString()} 字
            </strong>
          </span>
          <div className={styles.barTrack}>
            <div
              className={`${styles.barFill} ${isGoodLength ? styles.barGood : styles.barWarn}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={styles.statTarget}>目標：2,000〜3,000 字</span>
        </div>
      </div>

      {/* noteに投稿セクション */}
      {article.body && (
        <div className={styles.notePostSection}>
          <div className={styles.notePostHeader}>
            <span className={styles.notePostTitle}>📝 noteに下書き投稿</span>
            <span className={styles.notePostSub}>
              選択中のタイトル：{selectedTitle}
            </span>
          </div>

          {/* Cookie入力欄 */}
          {showCookieInput && postState !== "done" && (
            <div className={styles.cookieSection}>
              <p className={styles.cookieLabel}>
                🔑 noteのセッションCookieを入力してください
              </p>
              <p className={styles.cookieHint}>
                取得方法：noteにログイン → F12 → Networkタブ → 任意のリクエストを選択 →
                Request Headers の Cookie から <code>_note_session_v5=</code> の値をコピー
              </p>
              <input
                type="password"
                className={styles.cookieInput}
                placeholder="_note_session_v5 の値を貼り付け"
                value={sessionCookie}
                onChange={(e) => setSessionCookie(e.target.value)}
              />
            </div>
          )}

          {/* エラー表示 */}
          {postState === "error" && (
            <div className={styles.postError}>
              ⚠ {postError}
            </div>
          )}

          {/* 成功表示 */}
          {postState === "done" && noteUrl && (
            <div className={styles.postSuccess}>
              ✓ noteに下書き保存しました！
              <a href={noteUrl} target="_blank" rel="noopener noreferrer" className={styles.noteLink}>
                noteで確認する →
              </a>
            </div>
          )}

          {/* 投稿ボタン */}
          {postState !== "done" && (
            <button
              className={`${styles.notePostBtn} ${postState === "posting" ? styles.notePostBtnLoading : ""}`}
              onClick={handlePostToNote}
              disabled={postState === "posting" || !article.body}
            >
              {postState === "posting" ? (
                <><span className={styles.spinner} /> 投稿中...</>
              ) : showCookieInput ? (
                <>📤 この内容でnoteに下書き投稿する</>
              ) : (
                <>📤 noteに下書き投稿する</>
              )}
            </button>
          )}

          {postState === "done" && (
            <button
              className={styles.notePostBtnReset}
              onClick={() => { setPostState("idle"); setNoteUrl(""); }}
            >
              別の記事を投稿する
            </button>
          )}
        </div>
      )}
    </div>
  );
}