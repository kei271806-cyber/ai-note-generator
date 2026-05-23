import type { PostType, SourceType } from '@/types'

const HASHTAG_MAP: Record<SourceType, string> = {
  ai_news:  '#AIニュース #生成AI #AI活用',
  dev_log:  '#AI副業 #副業 #Claude',
  insight:  '#AI活用 #ChatGPT #副業',
  article:  '#AI副業 #note #副業初心者',
  failure:  '#AI副業 #副業 #失敗談',
  memo:     '#AI副業 #副業 #ChatGPT',
}

const AI_NEWS_EXTRA = `
【AIニュース投稿の追加ルール】
- 「難しそう」「覚えること増える」などネガティブ禁止
- 「自分ならこう使う」「これで〇〇できる」という気づきを入れる
- 前向きに、でも煽らず`

export function buildMemoToXPostPrompt(
  memo: string,
  postType: PostType,
  sourceType: SourceType
): string {
  const hashtags = HASHTAG_MAP[sourceType] ?? '#AI副業 #副業'
  const newsExtra = sourceType === 'ai_news' ? AI_NEWS_EXTRA : ''

  return `あなたはX（Twitter）投稿のプロです。以下のメモからX投稿を生成してください。

【投稿タイプ】${postType}
【文字数】100〜130字（ハッシュタグ含む）${newsExtra}

【ルール】
- 最初の一文で読者の目を止めるフックを作る
- 断言口調でOK（〜です→省略してよい）
- 「〜です。〜ます。」の硬い文体禁止
- 煽り表現禁止（「革命的」「必見」など）
- 改行は1〜2回まで
- 最後に以下のハッシュタグを追加: ${hashtags}
- 投稿文のみ出力。説明不要

【メモ】
${memo}

投稿文のみ出力してください。`
}
