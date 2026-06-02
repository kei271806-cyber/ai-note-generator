const BUFFER_API = 'https://api.buffer.com/graphql'

function getApiKey(): string {
  const key = process.env.BUFFER_API_KEY
  if (!key) throw new Error('BUFFER_API_KEY が未設定です')
  return key
}

export function getChannelId(platform: 'threads' | 'x' = 'threads'): string {
  const id = platform === 'x'
    ? process.env.BUFFER_X_CHANNEL_ID
    : process.env.BUFFER_THREADS_CHANNEL_ID
  if (!id) throw new Error(`BUFFER_${platform.toUpperCase()}_CHANNEL_ID が未設定です`)
  return id
}

export function isChannelConfigured(platform: 'threads' | 'x'): boolean {
  return platform === 'x'
    ? !!process.env.BUFFER_X_CHANNEL_ID
    : !!process.env.BUFFER_THREADS_CHANNEL_ID
}

async function bufferQuery(apiKey: string, query: string) {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) throw new Error(`Buffer API エラー: ${res.status}`)
  return res.json()
}

export async function getBufferQueueCount(
  platform: 'threads' | 'x' = 'threads'
): Promise<{ pending_count: number; error?: string }> {
  if (!isChannelConfigured(platform)) {
    return { pending_count: 0, error: `BUFFER_${platform.toUpperCase()}_CHANNEL_ID が未設定です` }
  }
  try {
    const apiKey = getApiKey()
    const channelId = getChannelId(platform)
    const data = await bufferQuery(apiKey, `
      query {
        posts(input: { channelIds: [${JSON.stringify(channelId)}], status: pending, limit: 100 }) {
          edges { node { id } }
        }
      }
    `)
    const edges = data?.data?.posts?.edges ?? []
    return { pending_count: edges.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '不明なエラー'
    return { pending_count: 0, error: msg }
  }
}

export async function addToBuffer(
  content: string,
  platform: 'threads' | 'x' = 'threads'
): Promise<{ id: string }> {
  const apiKey = getApiKey()
  const channelId = getChannelId(platform)
  const data = await bufferQuery(apiKey, `
    mutation {
      createPost(input: {
        text: ${JSON.stringify(content)},
        channelId: ${JSON.stringify(channelId)},
        schedulingType: automatic,
        mode: addToQueue
      }) {
        ... on PostActionSuccess { post { id } }
        ... on MutationError { message }
      }
    }
  `)

  const result = data?.data?.createPost
  if (result?.message) throw new Error(`Buffer エラー: ${result.message}`)
  if (!result?.post?.id) throw new Error('Buffer: post ID が取得できませんでした')

  return { id: result.post.id }
}
