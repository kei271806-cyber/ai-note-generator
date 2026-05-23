export function buildNewsToXPostPrompt(
  newsTitle: string,
  newsSummary: string
): string {
  return `あなたはX（Twitter）投稿のプロです。以下のAIニュースからX投稿を生成してください。

【文字数】100〜130字（ハッシュタグ含む）

【ルール】
- 最初の一文で読者の目を止めるフックを作る
- 「自分ならこう使う」「これで〇〇できる」という気づきを入れる
- ネガティブな反応禁止（「難しそう」「また増える」など）
- 前向きに、でも煽らず
- 断言口調でOK
- 最後に「#AIニュース #生成AI #AI副業」を追加
- 投稿文のみ出力

【ニュースタイトル】
${newsTitle}

【ニュース概要】
${newsSummary}

投稿文のみ出力してください。`
}
