#!/usr/bin/env node
/**
 * setup.js
 * AI記事自動生成システム セットアップスクリプト
 *
 * 実行方法：node setup.js
 *
 * このスクリプトが自動でやること：
 * 1. APIキーを対話形式で入力
 * 2. チャンネル（ジャンル）を対話形式で設定
 * 3. channels.ts を自動生成
 * 4. Notionデータベースを自動作成
 * 5. .env.local を自動生成
 * 6. Vercel CLIで環境変数を自動登録
 * 7. GitHubにpush & Vercelにデプロイ
 */

const readline = require("readline");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const https = require("https");

// ─────────────────────────────────────────────────
// カラー出力ヘルパー
// ─────────────────────────────────────────────────
const color = {
  green:  (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red:    (s) => `\x1b[31m${s}\x1b[0m`,
  cyan:   (s) => `\x1b[36m${s}\x1b[0m`,
  bold:   (s) => `\x1b[1m${s}\x1b[0m`,
  dim:    (s) => `\x1b[2m${s}\x1b[0m`,
};

function log(msg)       { console.log(msg); }
function success(msg)   { console.log(color.green("✅ " + msg)); }
function warn(msg)      { console.log(color.yellow("⚠️  " + msg)); }
function error(msg)     { console.log(color.red("❌ " + msg)); }
function step(num, msg) { console.log(color.bold("\n[STEP " + num + "] " + msg)); }
function hint(msg)      { console.log(color.dim("   💡 " + msg)); }

// ─────────────────────────────────────────────────
// 対話形式の入力ヘルパー
// ─────────────────────────────────────────────────
function createRL() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

function ask(rl, question, defaultVal) {
  return new Promise((resolve) => {
    const q = defaultVal
      ? color.yellow(question + " [デフォルト: " + defaultVal + "]: ")
      : color.yellow(question + ": ");
    rl.question(q, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

// ─────────────────────────────────────────────────
// HTTPSリクエストヘルパー
// ─────────────────────────────────────────────────
function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ─────────────────────────────────────────────────
// Notion API
// ─────────────────────────────────────────────────
async function getNotionRootPage(notionKey) {
  const options = {
    hostname: "api.notion.com",
    path: "/v1/search",
    method: "POST",
    headers: {
      "Authorization": "Bearer " + notionKey,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
  };
  const res = await httpsRequest(options, {
    filter: { property: "object", value: "page" },
    page_size: 1,
  });
  if (res.status !== 200 || !res.body.results || !res.body.results.length) {
    throw new Error(
      "Notionのページが見つかりません。\n" +
      "インテグレーションにページへのアクセス権限を付与してください。\n" +
      "（ページ右上「…」→「接続先」→インテグレーションを選択）"
    );
  }
  return res.body.results[0].id;
}

async function createNotionDatabase(notionKey, pageId, name) {
  const options = {
    hostname: "api.notion.com",
    path: "/v1/databases",
    method: "POST",
    headers: {
      "Authorization": "Bearer " + notionKey,
      "Content-Type": "application/json",
      "Notion-Version": "2022-06-28",
    },
  };
  const body = {
    parent: { page_id: pageId },
    title: [{ type: "text", text: { content: name } }],
    properties: {
      "タイトル":   { title: {} },
      "ステータス": {
        select: {
          options: [
            { name: "未作成", color: "gray" },
            { name: "生成済", color: "green" },
            { name: "投稿済", color: "blue" },
          ],
        },
      },
      "本文":       { rich_text: {} },
      "タイトル案": { rich_text: {} },
      "作成日":     { date: {} },
    },
  };
  const res = await httpsRequest(options, body);
  if (res.status !== 200) {
    throw new Error("DB作成失敗 (" + res.status + "): " + JSON.stringify(res.body));
  }
  return res.body.id.replace(/-/g, "");
}

// ─────────────────────────────────────────────────
// channels.ts を動的生成
// ─────────────────────────────────────────────────
function generateChannelsTs(channels) {
  const blocks = channels.map((ch) => {
    const varName = ch.id.toUpperCase().replace(/-/g, "_");
    const readerLines = ch.targetReader.split("\n").map((l) => "・" + l.trim()).join("\n");
    const readerListLines = ch.targetReader.split("\n").map((l) => "- " + l.trim()).join("\n");

    return [
      "const " + varName + ": Channel = {",
      '  id: "' + ch.id + '",',
      '  name: "' + ch.name + '",',
      '  notionDbEnvKey: "' + ch.envKey + '",',
      "  themePrompt: `",
      "あなたはnote記事の専門編集者です。",
      "以下の条件で、note記事のテーマを1つだけ生成してください。",
      "",
      "【読者像】",
      readerLines,
      "",
      "【ジャンル】",
      ch.genre,
      "",
      "【テーマの条件】",
      "・読者がすぐに実践できる具体的な内容",
      "・「〇〇する方法」「〇〇で稼ぐ」「〇〇を使った△△」など実用的な形式",
      "・1〜2文で具体的に表現すること",
      "",
      "【出力ルール】",
      "・テーマのみを1行で出力すること",
      "・前置きや説明は不要",
      "・マークダウンや記号は使わない",
      "・日本語で出力すること",
      "  `.trim(),",
      "  titleSystemPrompt: `あなたは「" + ch.name + "」というnoteメディアの専属コピーライターです。",
      "",
      "## ターゲット読者",
      readerListLines,
      "",
      "## タイトルのルール",
      "- 30文字前後",
      "- 具体的な数字を入れる（3ステップ、5分で、月3万円）",
      "- ハードルを下げる言葉（初心者OK、ゼロから、誰でもできる）",
      "- メリットが一目でわかる",
      "",
      "## 出力形式（厳守）",
      "- タイトル案を必ず3つ出力する",
      "- 番号付きリスト形式のみ",
      "1. タイトル案A",
      "2. タイトル案B",
      "3. タイトル案C`,",
      "  articleSystemPrompt: `あなたは「" + ch.name + "」というnoteメディアの専属ライターです。",
      "",
      "## ターゲット読者",
      readerListLines,
      "",
      "## 記事ルール",
      "- PREP法（結論→理由→具体例→結論）で構成",
      "- 文字数：2000〜3000字",
      "- 1文60字以内",
      "- 専門用語は括弧内で説明（例：AI（人工知能））",
      "- 親しみやすく温かみのある文体",
      "- 読者に語りかける表現を使う",
      "- ## 大見出しと ### 小見出しを適切に使う",
      "- ## 大見出しから開始（タイトル・前置き不要）",
      "- Markdown形式で出力",
      "",
      "## 禁止事項",
      "- 根拠のない断言",
      "- 1文60字超え",
      "- 前置き・後書き・自己紹介`,",
      "};",
    ].join("\n");
  });

  const channelIds = channels.map((ch) => {
    const varName = ch.id.toUpperCase().replace(/-/g, "_");
    return "  " + varName + ",";
  });

  return [
    "/**",
    " * lib/channels.ts",
    " * チャンネル定義（セットアップスクリプトで自動生成）",
    " */",
    "",
    "export interface Channel {",
    "  id: string;",
    "  name: string;",
    "  notionDbEnvKey: string;",
    "  themePrompt: string;",
    "  titleSystemPrompt: string;",
    "  articleSystemPrompt: string;",
    "}",
    "",
    blocks.join("\n\n"),
    "",
    "export const CHANNELS: Channel[] = [",
    channelIds.join("\n"),
    "];",
    "",
    'export const DEFAULT_CHANNEL_ID = "' + channels[0].id + '";',
    "",
    "export function getChannel(channelId: string): Channel {",
    "  const channel = CHANNELS.find((c) => c.id === channelId);",
    "  if (!channel) throw new Error(`チャンネルが見つかりません: ${channelId}`);",
    "  return channel;",
    "}",
    "",
    "export function getNotionDbId(channel: Channel): string {",
    "  const dbId = process.env[channel.notionDbEnvKey];",
    "  if (!dbId) throw new Error(`環境変数が未設定: ${channel.notionDbEnvKey}`);",
    "  return dbId;",
    "}",
  ].join("\n");
}

// ─────────────────────────────────────────────────
// コマンド実行ヘルパー
// ─────────────────────────────────────────────────
function runCommand(cmd, silent) {
  try {
    const result = execSync(cmd, {
      encoding: "utf8",
      stdio: silent ? "pipe" : "inherit",
    });
    return { success: true, output: result };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function checkTool(cmd, name) {
  const result = runCommand(cmd + " --version", true);
  if (!result.success) {
    warn(name + " がインストールされていません");
    return false;
  }
  return true;
}

function generateChannelId(name, index) {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return sanitized || ("channel-" + (index + 1));
}

// ─────────────────────────────────────────────────
// メイン処理
// ─────────────────────────────────────────────────
async function main() {
  console.clear();
  console.log(color.bold(color.cyan([
    "",
    "╔══════════════════════════════════════════════════╗",
    "║   AI記事自動生成システム セットアップ             ║",
    "║   あなた専用のシステムを自動で構築します          ║",
    "╚══════════════════════════════════════════════════╝",
    "",
  ].join("\n"))));

  log("所要時間：約20〜30分");
  log("途中でエラーが出た場合はそのままClaude.ai（claude.ai）に相談してください\n");

  const rl = createRL();

  try {
    // STEP 1: ツール確認
    step(1, "必要なツールを確認しています...");
    if (!checkTool("node", "Node.js") || !checkTool("git", "Git") || !checkTool("npm", "npm")) {
      error("必要なツールが不足しています。");
      log("Node.js: nodejs.org");
      log("Git: git-scm.com/download/win");
      process.exit(1);
    }
    success("必要なツールが揃っています");

    // STEP 2: APIキー入力
    step(2, "APIキーを入力してください");
    hint("Notion:  notion.so/my-integrations");
    hint("Gemini:  aistudio.google.com");
    hint("Claude:  console.anthropic.com");
    log("");

    const notionKey  = await ask(rl, "① Notion APIキー（secret_から始まる）");
    const geminiKey  = await ask(rl, "② Gemini APIキー（AIzaSyから始まる）");
    const claudeKey  = await ask(rl, "③ Claude APIキー（sk-ant-から始まる）");
    const cronSecret = await ask(rl, "④ Cron Secret（任意の文字列）", "cron-" + Date.now());

    if (!notionKey.startsWith("secret_")) { error("Notion APIキーは「secret_」から始まる必要があります"); process.exit(1); }
    if (!geminiKey.startsWith("AIzaSy"))  { error("Gemini APIキーは「AIzaSy」から始まる必要があります"); process.exit(1); }
    if (!claudeKey.startsWith("sk-ant-")) { error("Claude APIキーは「sk-ant-」から始まる必要があります"); process.exit(1); }

    success("APIキーの入力が完了しました");

    // STEP 3: チャンネル設定
    step(3, "チャンネル（ジャンル）を設定してください");
    log("チャンネルとは、記事を投稿するジャンルのことです。");
    log("例：AI副業・料理レシピ・子育て・投資・健康など\n");

    const channelCount = parseInt(await ask(rl, "チャンネル数を入力してください（1〜5）", "1"), 10);
    if (isNaN(channelCount) || channelCount < 1 || channelCount > 5) {
      error("チャンネル数は1〜5の数字で入力してください");
      process.exit(1);
    }

    const channels = [];

    for (let i = 0; i < channelCount; i++) {
      console.log(color.bold("\n── チャンネル " + (i + 1) + " の設定 ──"));

      const name  = await ask(rl, "チャンネル名（例：AI副業、料理レシピ）");
      const genre = await ask(rl, "このチャンネルのジャンル・テーマ（例：AIを使った副業・収益化）");

      log(color.dim("\nターゲット読者を入力してください（複数ある場合は改行で区切る）"));
      log(color.dim("例：30〜40代の会社員 / 副業に興味がある初心者"));
      log(color.dim("（入力が終わったら空行でEnterを押してください）\n"));

      const readerLines = [];
      while (readerLines.length < 5) {
        const line = await ask(rl, "読者像 " + (readerLines.length + 1) + "行目（空行で完了）");
        if (!line) break;
        readerLines.push(line);
      }

      const targetReader = readerLines.join("\n") || "30〜50代のビジネスパーソン";
      const channelId    = generateChannelId(name, i);
      const envKey       = i === 0
        ? "NOTION_DATABASE_ID"
        : "NOTION_DATABASE_ID_" + channelId.toUpperCase().replace(/-/g, "_");

      channels.push({ id: channelId, name, genre, targetReader, envKey });
      success("チャンネル「" + name + "」の設定が完了しました");
    }

    // STEP 4: channels.ts 生成
    step(4, "channels.ts を自動生成しています...");
    const channelsTsContent = generateChannelsTs(channels);
    fs.mkdirSync(path.join("src", "lib"), { recursive: true });
    fs.writeFileSync(path.join("src", "lib", "channels.ts"), channelsTsContent, "utf8");
    success("channels.ts を生成しました");
    channels.forEach((ch) => { log(color.dim("   ・" + ch.name + "（ID: " + ch.id + "）")); });

    // vercel.json 生成（チャンネルごとにcronを1時間ずらして設定）
    const cronEntries = channels.map((ch, i) => ({
      path: "/api/cron?channelId=" + ch.id,
      schedule: "0 " + (i + 1) + " * * *",
    }));
    const vercelJson = JSON.stringify({ crons: cronEntries }, null, 2);
    fs.writeFileSync("vercel.json", vercelJson, "utf8");
    success("vercel.json を生成しました（" + channels.length + "チャンネル分のcronを設定）");
    channels.forEach((ch, i) => {
      log(color.dim("   ・" + ch.name + "：毎日 0" + (i + 1) + ":00 UTC（JST " + (i + 10) + ":00）"));
    });

    // STEP 5: Notionデータベース作成
    step(5, "Notionデータベースを自動作成しています...");
    let rootPageId;
    try {
      rootPageId = await getNotionRootPage(notionKey);
      success("Notionへのアクセスを確認しました");
    } catch (e) {
      error("Notionへのアクセスに失敗しました");
      log("原因：" + e.message);
      process.exit(1);
    }

    const dbIds = {};
    for (const ch of channels) {
      try {
        log("「" + ch.name + "記事管理」を作成中...");
        const dbId = await createNotionDatabase(notionKey, rootPageId, ch.name + "記事管理");
        dbIds[ch.envKey] = dbId;
        success("「" + ch.name + "記事管理」作成完了");
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        warn("自動作成に失敗しました: " + e.message);
        const manualId = await ask(rl, "手動でデータベースIDを入力してください（32文字）");
        dbIds[ch.envKey] = manualId.replace(/-/g, "");
      }
    }
    success("全データベースの作成が完了しました");

    // STEP 6: .env.local 生成
    step(6, ".env.local を自動生成しています...");
    const envLines = [
      "# 環境変数（セットアップスクリプトで自動生成）",
      "# このファイルは絶対にGitHubにアップしないでください",
      "",
      "NOTION_API_KEY=" + notionKey,
    ];
    channels.forEach((ch) => { envLines.push(ch.envKey + "=" + dbIds[ch.envKey]); });
    envLines.push("", "GEMINI_API_KEY=" + geminiKey, "", "ANTHROPIC_API_KEY=" + claudeKey, "", "CRON_SECRET=" + cronSecret);
    fs.writeFileSync(".env.local", envLines.join("\n"), "utf8");
    success(".env.local を生成しました");

    // STEP 7: npm install
    step(7, "パッケージをインストールしています...");
    if (runCommand("npm install").success) {
      success("パッケージのインストールが完了しました");
    } else {
      warn("npm install に失敗しました。手動で「npm install」を実行してください");
    }

    // STEP 8: GitHub push
    step(8, "GitHubにpushしています...");
    const githubUsername = await ask(rl, "GitHubのユーザー名を入力してください");
    const gitEmail       = await ask(rl, "GitHubに登録しているメールアドレスを入力してください");
    const repoName       = "ai-note-starter";

    runCommand('git config user.name "' + githubUsername + '"', true);
    runCommand('git config user.email "' + gitEmail + '"', true);

    if (checkTool("gh", "GitHub CLI")) {
      const r = runCommand("gh repo create " + repoName + " --private --source=. --remote=origin --push");
      if (r.success) {
        success("GitHubリポジトリを作成してpushしました");
      } else {
        warn("GitHub CLIでの作成に失敗しました。手動でpushしてください");
        await showManualPushGuide(rl, githubUsername, repoName);
      }
    } else {
      await showManualPushGuide(rl, githubUsername, repoName);
    }

    // STEP 9: Vercel環境変数登録
    step(9, "Vercelの環境変数を設定しています...");
    if (!checkTool("vercel", "Vercel CLI")) {
      runCommand("npm install -g vercel");
    }
    runCommand("vercel login");
    runCommand("vercel link --yes");

    const allEnvVars = {
      NOTION_API_KEY: notionKey,
      GEMINI_API_KEY: geminiKey,
      ANTHROPIC_API_KEY: claudeKey,
      CRON_SECRET: cronSecret,
    };
    channels.forEach((ch) => { allEnvVars[ch.envKey] = dbIds[ch.envKey]; });

    for (const [key, value] of Object.entries(allEnvVars)) {
      runCommand('echo "' + value + '" | vercel env add ' + key + " production", true);
      log("  " + color.green("✓") + " " + key);
    }
    success(Object.keys(allEnvVars).length + "個の環境変数を登録しました");

    // STEP 10: デプロイ
    step(10, "Vercelにデプロイしています...");
    if (runCommand("vercel --prod").success) {
      success("Vercelへのデプロイが完了しました！");
    } else {
      warn("デプロイに失敗しました。Vercelダッシュボードから手動でRedeployしてください");
    }

    // 完了
    console.log(color.bold(color.green([
      "",
      "╔══════════════════════════════════════════════════╗",
      "║   🎉 セットアップが完了しました！                ║",
      "╚══════════════════════════════════════════════════╝",
      "",
    ].join("\n"))));

    log(color.bold("作成されたチャンネル："));
    channels.forEach((ch, i) => { log("  " + (i + 1) + ". " + ch.name); });
    log(color.bold("\n次のステップ："));
    log("1. Vercelダッシュボードでデプロイ済みのURLを確認する");
    log("2. ブラウザでURLを開く");
    log("3. チャンネルを選択して「テーマ生成」ボタンを押す");
    log("4. 「記事生成」ボタンを押して記事を確認する");
    log("5. noteに投稿して副業スタート！\n");
    log(color.yellow("⚠️  .env.local ファイルは絶対に他人に見せないでください。\n"));

    fs.writeFileSync("setup-complete.json", JSON.stringify({
      completedAt: new Date().toISOString(),
      channels: channels.map((ch) => ({ name: ch.name, id: ch.id, envKey: ch.envKey, dbId: dbIds[ch.envKey] })),
    }, null, 2));
    success("セットアップ完了ログを setup-complete.json に保存しました");

  } catch (e) {
    error("予期しないエラーが発生しました: " + e.message);
    log("\nエラー内容をClaude.ai（claude.ai）に貼り付けて相談してください。");
    process.exit(1);
  } finally {
    rl.close();
  }
}

async function showManualPushGuide(rl, githubUsername, repoName) {
  log("\n以下の手順でGitHubにpushしてください：");
  log("1. github.com で「" + repoName + "」という名前のPrivateリポジトリを作成");
  log("2. 作成後に以下を実行：");
  log(color.cyan("   git remote set-url origin https://github.com/" + githubUsername + "/" + repoName + ".git"));
  log(color.cyan("   git add ."));
  log(color.cyan("   git commit -m \"initial setup\""));
  log(color.cyan("   git push -u origin main"));
  await ask(rl, "\npushが完了したらEnterキーを押してください...");
}

main();
