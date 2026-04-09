"use client";

import { Article } from "@/lib/notion";
import styles from "./ArticleCard.module.css";

interface ArticleCardProps {
  article: Article;
  isSelected: boolean;
  onClick: () => void;
  onDelete: () => void;
}

const STATUS_CONFIG = {
  未作成: { label: "未作成", className: styles.statusPending, icon: "○" },
  生成済: { label: "生成済", className: styles.statusDone,    icon: "●" },
  投稿済: { label: "投稿済", className: styles.statusPosted,  icon: "✓" },
};

export default function ArticleCard({ article, isSelected, onClick, onDelete }: ArticleCardProps) {
  const statusConfig = STATUS_CONFIG[article.status] ?? STATUS_CONFIG["未作成"];
  const charCount = article.body ? article.body.replace(/[#*\n`]/g, "").length : 0;

  return (
    <article
      className={`${styles.card} ${isSelected ? styles.selected : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
    >
      <div className={styles.header}>
        <span className={`${styles.status} ${statusConfig.className}`}>
          {statusConfig.icon} {statusConfig.label}
        </span>
        <div className={styles.headerRight}>
          <time className={styles.date}>{article.createdAt}</time>
          <button
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="削除"
          >
            ×
          </button>
        </div>
      </div>
      <h3 className={styles.theme}>{article.title || "（テーマ未設定）"}</h3>
      <div className={styles.footer}>
        {charCount > 0 ? (
          <span className={styles.meta}>📝 {charCount.toLocaleString()} 字</span>
        ) : (
          <span className={styles.meta}>○ 未生成</span>
        )}
        {isSelected && <span className={styles.viewingBadge}>表示中</span>}
      </div>
    </article>
  );
}