import Anthropic from '@anthropic-ai/sdk'
import { buildMemoToPostPrompt } from './prompts/memo-to-post'
import { buildMemoToXPostPrompt } from './prompts/memo-to-x-post'
import type { PostType, SourceType } from '@/types'

const client = new Anthropic({
  apiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim(),
})

async function generate(prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

export async function convertMemoToPost(
  memo: string,
  postType: PostType,
  sourceType: SourceType
): Promise<string> {
  return generate(buildMemoToPostPrompt(memo, postType, sourceType))
}

export async function convertMemoToXPost(
  memo: string,
  postType: PostType,
  sourceType: SourceType
): Promise<string> {
  return generate(buildMemoToXPostPrompt(memo, postType, sourceType))
}

export async function convertMemoBoth(
  memo: string,
  postType: PostType,
  sourceType: SourceType
): Promise<{ threads: string; x: string }> {
  const [threads, x] = await Promise.all([
    convertMemoToPost(memo, postType, sourceType),
    convertMemoToXPost(memo, postType, sourceType),
  ])
  return { threads, x }
}
