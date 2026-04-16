"use client";

/**
 * components/Header.tsx
 * サイトヘッダー（チャンネル切り替え対応）
 */

import { useState } from "react";
import { CHANNELS } from "@/lib/channels";
import styles from "./Header.module.css";

interface HeaderProps {
  channelId: string;
  onChannelChange: (channelId: string) => void;
  onGenerateTheme: () => Promise<void>;
  onGenerateArticle: () => Promise<void>;
  isLoading: boolean;
}

export default function Header({
  channelId,
  onChannelChange,
  onGenerateTheme,
  onGenerateArticle,
  isLoading,
}: HeaderProps) {
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const handleTheme = async () => {
    setActiveAction("theme");
    await onGenerateTheme();
    setActiveAction(null);
  };

  const handleArticle = async () => {
    setActiveAction("article");
    await onGenerateArticle();
    setActiveAction(null);
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* ロゴ */}
        <div className={styles.logo}>
          <span className={styles.logoEyebrow}>AI WRITING SYSTEM</span>
          <h1 className={styles.logoTitle}>
            <span className={styles.logoAccent}>note</span>記事自動生成
          </h1>
        </div>

        {/* チャンネル切り替え */}
        <div className={styles.channelSelect}>
          <select
            value={channelId}
            onChange={(e) => onChannelChange(e.target.value)}
            disabled={isLoading}
            className={styles.channelDropdown}
          >
            {CHANNELS.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* アクションボタン */}
        <div className={styles.actions}>
          <button
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handleTheme}
            disabled={isLoading}
          >
            {activeAction === "theme" ? (
              <span className={styles.spinner} />
            ) : (
              <span>✦</span>
            )}
            テーマ生成
          </button>
          <button
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleArticle}
            disabled={isLoading}
          >
            {activeAction === "article" ? (
              <span className={styles.spinner} />
            ) : (
              <span>⚡</span>
            )}
            記事生成
          </button>
        </div>
      </div>
    </header>
  );
}
