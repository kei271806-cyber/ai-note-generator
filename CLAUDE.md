# ai-note-generator プロジェクト

## 概要
ビジネス書・AI副業テーマのnote記事を全自動生成するシステム。
毎朝10時（JST）にVercel Cronが起動し、Geminiでテーマ生成→Claudeで記事生成→Notionに保存→手動でnoteに投稿。

## 技術スタック
- **フレームワーク**: Next.js 14 / TypeScript
- **記事生成**: Anthropic Claude API（claude-sonnet-4-5）
- **テーマ生成**: Google Gemini API（gemini-2.5-flash）
- **ストレージ**: Notion API
- **自動実行**: Vercel Cron（毎日 01:00 UTC = JST 10:00）
- **デプロイ**: Vercel

## ファイル構成

```
src/
├── app/
│   ├── api/
│   │   ├── generate-theme/route.ts    # テーマ生成（Gemini）
│   │   ├── generate-article/route.ts  # 記事生成（Claude）
│   │   ├── generate-x-posts/route.ts  # X投稿文生成
│   │   ├── post-to-note/route.ts      # note直接投稿API
│   │   ├── cron/route.ts              # 毎日自動実行エンドポイント
│   │   ├── articles/route.ts          # 記事一覧取得
│   │   ├── articles/[id]/route.ts     # 記事詳細取得
│   │   ├── update-status/route.ts     # ステータス更新
│   │   └── delete-article/route.ts    # 記事削除
│   ├── page.tsx                       # メイン画面
│   └── layout.tsx
├── components/
│   ├── ArticleCard.tsx                # 記事一覧カード
│   ├── ArticleDetail.tsx              # 記事詳細・コピー機能
│   ├── Header.tsx                     # ヘッダー（テーマ生成・記事生成ボタン）
│   ├── XPostsPanel.tsx                # X投稿文管理パネル
│   └── Toast.tsx                      # 通知トースト
└── lib/
    ├── claude.ts    # Claude API（RTKキャッシュ実装済み）
    ├── gemini.ts    # Gemini API
    └── notion.ts    # Notion CRUD操作
```

## Notion データベース構造

| プロパティ名 | 種類 | 説明 |
|------------|------|------|
| タイトル | タイトル | テーマ文字列 |
| ステータス | セレクト | `未作成` / `生成済` / `投稿済` |
| 本文 | テキスト | 記事本文（Markdown）※2000字で分割保存 |
| タイトル案 | テキスト | Claude生成のタイトル案3つ（改行区切り） |
| 作成日 | 日付 | YYYY-MM-DD |

## コアロジック

### 自動生成フロー（cron）
1. `GET /api/cron` が発火
2. Geminiで新テーマを生成 → Notionに「未作成」で保存
3. Notionから「未作成」の記事を取得
4. Claudeでタイトル案3つ＋記事本文を生成（RTKキャッシュ使用）
5. Notionに保存（ステータス「生成済」に更新）

### RTK（プロンプトキャッシュ）
`src/lib/claude.ts` にて実装済み。
- `TITLE_SYSTEM_PROMPT`・`ARTICLE_SYSTEM_PROMPT` を `system` ブロックにキャッシュ
- 毎回変わるのはテーマのみ → 2本目以降の記事は約67%コスト削減
- Vercelログで確認：`キャッシュ読込:NNNtok` が出ていれば正常動作

## 対象読者・コンテンツ方針
- **ターゲット**: 45歳前後の会社員、AI初心者、副業したい人
- **テーマ**: AI副業、ChatGPT/Claude活用、自動化ノウハウ
- **文体**: 1文60字以内、専門用語は括弧で説明、PREP法構成
- **文字数**: 2000〜3000字

## 環境変数（.env.local）
```
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=xxx
GEMINI_API_KEY=AIzaSyxxx
ANTHROPIC_API_KEY=sk-ant-xxx
CRON_SECRET=任意の文字列
```

## よくある作業

### ローカル開発
```bash
npm run dev   # http://localhost:3000
```

### プロンプトを変更したいとき
→ `src/lib/claude.ts` の `ARTICLE_SYSTEM_PROMPT` を編集

### テーマ生成ロジックを変更したいとき
→ `src/lib/gemini.ts` の `prompt` を編集

### Notion保存ロジックを変更したいとき
→ `src/lib/notion.ts` を編集（プロパティ名は日本語で完全一致が必要）
