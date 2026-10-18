import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? "").trim(),
});

export interface GeneratedArticle {
  titles: string[];
  article: string;
}

export async function generateArticle(
  theme: string,
  titleSystemPrompt: string,
  articleSystemPrompt: string,
): Promise<GeneratedArticle> {

  const titlesResponse = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: titleSystemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ] as unknown as Anthropic.TextBlockParam[],
    messages: [
      {
        role: "user",
        content: `テーマ：${theme}\n\n上記テーマでnoteのタイトル案を3つ作成してください。`,
      },
    ],
  });

  const titleUsage = titlesResponse.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  console.log(
    `[Claude] タイトル生成 - 通常:${titleUsage.input_tokens}tok` +
    ` | キャッシュ書込:${titleUsage.cache_creation_input_tokens ?? 0}tok` +
    ` | キャッシュ読込:${titleUsage.cache_read_input_tokens ?? 0}tok`
  );

  const titlesText = titlesResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  const titles = titlesText
    .split("\n")
    .map((line) => line.replace(/^\d+\.\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);

  if (titles.length === 0) {
    titles.push(
      `${theme}の完全ガイド（初心者向け）`,
      `45歳からでも始められる！${theme}入門`,
      `【実践】${theme}で副業を始める方法`
    );
  }

  console.log("[Claude] タイトル生成完了:", titles[0]);

  const articleResponse = await anthropic.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 8192,
    system: [
      {
        type: "text",
        text: articleSystemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ] as unknown as Anthropic.TextBlockParam[],
    messages: [
      {
        role: "user",
        content: `テーマ：${theme}\n\n上記テーマでnote記事を書いてください。`,
      },
    ],
  });

  const articleUsage = articleResponse.usage as Anthropic.Usage & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  console.log(
    `[Claude] 記事生成 - 通常:${articleUsage.input_tokens}tok` +
    ` | キャッシュ書込:${articleUsage.cache_creation_input_tokens ?? 0}tok` +
    ` | キャッシュ読込:${articleUsage.cache_read_input_tokens ?? 0}tok`
  );

  const article = articleResponse.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();

  console.log("[Claude] 記事生成完了. 文字数:", article.length);

  return { titles, article };
}
