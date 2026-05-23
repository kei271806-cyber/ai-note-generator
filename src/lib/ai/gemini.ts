import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildNewsToPostPrompt } from './prompts/news-to-post'
import { buildNewsToXPostPrompt } from './prompts/news-to-x-post'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '')

async function generate(prompt: string): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

export async function summarizeNewsToPost(
  title: string,
  summary: string
): Promise<string> {
  return generate(buildNewsToPostPrompt(title, summary))
}

export async function summarizeNewsToXPost(
  title: string,
  summary: string
): Promise<string> {
  return generate(buildNewsToXPostPrompt(title, summary))
}
