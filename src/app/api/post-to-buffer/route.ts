/**
 * app/api/post-to-buffer/route.ts
 * POST /api/post-to-buffer
 * Buffer 新API（GraphQL）経由で Threads に投稿
 */

import { NextRequest, NextResponse } from "next/server";
import { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";

const BUFFER_API = "https://api.buffer.com/graphql";

function buildMutation(text: string, channelId: string): string {
  return `mutation {
    createPost(input: {
      text: ${JSON.stringify(text)},
      channelId: ${JSON.stringify(channelId)},
      schedulingType: automatic,
      mode: addToQueue
    }) {
      ... on PostActionSuccess {
        post { id text dueAt }
      }
      ... on MutationError {
        message
      }
    }
  }`;
}

export async function POST(req: NextRequest) {
  try {
    const { text, notionPageId } = await req.json();

    const apiKey    = process.env.BUFFER_API_KEY;
    const channelId = process.env.BUFFER_THREADS_CHANNEL_ID;

    if (!apiKey || !channelId) {
      return NextResponse.json(
        { success: false, error: "BUFFER_API_KEY または BUFFER_THREADS_CHANNEL_ID が未設定です" },
        { status: 500 }
      );
    }

    if (!text) {
      return NextResponse.json(
        { success: false, error: "投稿テキストは必須です" },
        { status: 400 }
      );
    }

    const res = await fetch(BUFFER_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query: buildMutation(text, channelId) }),
    });

    const rawBody = await res.text();
    console.log("[post-to-buffer] status:", res.status, "content-type:", res.headers.get("content-type"));
    console.log("[post-to-buffer] response:", rawBody.slice(0, 300));

    if (!res.ok) {
      throw new Error(`Buffer API エラー: ${res.status} - ${rawBody.slice(0, 200)}`);
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      throw new Error(`Buffer API が予期しないレスポンスを返しました (${res.status}): ${rawBody.slice(0, 200)}`);
    }

    const data = JSON.parse(rawBody);
    const result = data?.data?.createPost;

    if (result?.message) {
      throw new Error(`Buffer エラー: ${result.message}`);
    }

    const postId = result?.post?.id;
    console.log("[post-to-buffer] Threads キューに追加:", postId);

    // Notion の該当レコードを「投稿済」に更新
    if (notionPageId) {
      try {
        const notion = new Client({ auth: process.env.NOTION_API_KEY });
        await notion.pages.update({
          page_id: notionPageId,
          properties: {
            ステータス: { select: { name: "投稿済" } },
          },
        });
        console.log("[post-to-buffer] Notion ステータス更新完了");
      } catch (e) {
        console.error("[post-to-buffer] Notion 更新エラー:", e);
      }
    }

    return NextResponse.json({ success: true, postId });

  } catch (error) {
    const message = error instanceof Error ? error.message : "不明なエラー";
    console.error("[post-to-buffer] エラー:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
