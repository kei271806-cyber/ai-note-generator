import type { PostType, SourceType } from '@/types'

const TONE_GUIDE: Record<PostType, string> = {
  '共感系': '「あるある」感を大切に。完璧な解決策より共感を優先',
  'ノウハウ系': '「気づいたこと」として書く。断言せず"〜な気がする"くらいの温度感',
  '実践ログ': '日記っぽく。失敗も含めて正直に。数字があると信頼感が出る',
  '失敗談': '自虐気味に。でも学びは入れる。笑えるくらいがちょうどいい',
  '短文': '一言でズバッと。余計な説明はしない',
  'スレッド': '1投稿目で引きを作る。続きが気になる終わり方',
  'AIニュース解説': '転載ではなく「自分はこう思った」を軸に。実務への影響を語る',
}

const AI_NEWS_EXTRA = `
【AIニュース投稿の追加ルール】
- 「難しそう」「また覚えること増える」などネガティブな反応禁止
- 「これを使うと自分はこうなれる」という気づきを必ず入れる
- 読者が明日から行動できるヒントや視点を与える
- 前向きに、でも煽らず。「こんな使い方ができそう」くらいの温度感`

export function buildMemoToPostPrompt(
  memo: string,
  postType: PostType,
  sourceType: SourceType
): string {
  const newsExtra = sourceType === 'ai_news' ? AI_NEWS_EXTRA : ''

  return `あなたはSNS投稿のプロです。以下のメモをThreads投稿に変換してください。

【投稿タイプ】${postType}
【ソース】${sourceType}
【トーンガイド】${TONE_GUIDE[postType]}${newsExtra}

【絶対ルール】
- 140〜200字程度
- 箇条書き禁止。散文で書く
- 「〜です。〜ます。」の硬い文体禁止
- 「重要です」「注目です」「革命的」などの煽り禁止
- 改行は2〜3回まで
- 投稿文のみ出力。説明不要

【禁止表現】
- 「〜することが重要です」
- 「ぜひ試してみてください」
- 「まとめると」
- 過剰な絵文字

【メモ】
${memo}

投稿文のみ出力してください。`
}
