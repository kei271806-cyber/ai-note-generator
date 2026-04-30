/**
 * lib/channels.ts
 * ⚠️ このファイルは setup.js が自動生成します
 * 手動で編集しないでください
 *
 * セットアップ手順：
 *   node setup.js
 */

export interface Channel {
  id: string;
  name: string;
  notionDbEnvKey: string;
  themePrompt: string;
  titleSystemPrompt: string;
  articleSystemPrompt: string;
}

const MY_CHANNEL: Channel = {
  id: "my-channel",
  name: "マイチャンネル",
  notionDbEnvKey: "NOTION_DATABASE_ID",
  themePrompt: `セットアップ未完了です。node setup.js を実行してください。`,
  titleSystemPrompt: `セットアップ未完了です。node setup.js を実行してください。`,
  articleSystemPrompt: `セットアップ未完了です。node setup.js を実行してください。`,
};

export const CHANNELS: Channel[] = [
  MY_CHANNEL,
];

export const DEFAULT_CHANNEL_ID = "my-channel";

export function getChannel(channelId: string): Channel {
  const channel = CHANNELS.find((c) => c.id === channelId);
  if (!channel) throw new Error(`チャンネルが見つかりません: ${channelId}`);
  return channel;
}

export function getNotionDbId(channel: Channel): string {
  const dbId = process.env[channel.notionDbEnvKey];
  if (!dbId) throw new Error(`環境変数が未設定: ${channel.notionDbEnvKey}`);
  return dbId;
}
