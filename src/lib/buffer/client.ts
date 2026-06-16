const BUFFER_API = 'https://api.buffer.com'

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
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Buffer API エラー: ${res.status} ${body}`)
  }
  return res.json()
}

let cachedOrgId: string | null = null

async function getOrganizationId(apiKey: string): Promise<string> {
  if (cachedOrgId) return cachedOrgId
  const data = await bufferQuery(apiKey, `
    query { account { organizations { id } } }
  `)
  const orgs: Array<{ id: string }> = data?.data?.account?.organizations ?? []
  if (!orgs[0]?.id) throw new Error('Buffer: organization ID が取得できませんでした')
  cachedOrgId = orgs[0].id
  return cachedOrgId
}

export async function getBufferQueueCount(
  platform: 'threads' | 'x' = 'threads'
): Promise<{ pending_count: number; error?: string }> {
  if (!isChannelConfigured(platform)) {
    return { pending_count: 0, error: `BUFFER_${platform.toUpperCase()}_CHANNEL_ID が未設定です` }
  }
  try {
    const apiKey = getApiKey()
    const orgId = await getOrganizationId(apiKey)
    const channelId = getChannelId(platform)
    const data = await bufferQuery(apiKey, `
      query {
        posts(input: {
          organizationId: ${JSON.stringify(orgId)},
          filter: { channelIds: [${JSON.stringify(channelId)}], status: [scheduled] }
        }, first: 100) {
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
