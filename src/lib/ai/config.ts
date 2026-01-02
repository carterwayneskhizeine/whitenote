import prisma from "@/lib/prisma"

// 用户级别配置缓存 (key = userId)
const configCache = new Map<string, {
  data: Awaited<ReturnType<typeof getAiConfigFromDb>>
  timestamp: number
}>()

const CACHE_TTL = 5000 // 5 秒缓存，保证热更新响应速度

/**
 * 从数据库获取用户的 AI 配置
 */
async function getAiConfigFromDb(userId: string) {
  let config = await prisma.aiConfig.findUnique({
    where: { userId },
  })

  // 如果用户没有配置，创建默认配置
  if (!config) {
    config = await prisma.aiConfig.create({
      data: { userId },
    })
  }

  return config
}

/**
 * 获取用户的 AI 配置 (带短时缓存)
 * @param userId 当前用户 ID
 */
export async function getAiConfig(userId: string) {
  const now = Date.now()
  const cached = configCache.get(userId)

  // 缓存有效，直接返回
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  // 缓存过期，从数据库获取
  const config = await getAiConfigFromDb(userId)
  configCache.set(userId, {
    data: config,
    timestamp: now,
  })

  return config
}

/**
 * 清除用户的配置缓存 (配置更新后调用)
 */
export function invalidateConfigCache(userId: string) {
  configCache.delete(userId)
}

/**
 * 更新用户的 AI 配置
 * @param userId 当前用户 ID
 * @param data 要更新的配置字段
 */
export async function updateAiConfig(userId: string, data: Partial<{
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  enableRag: boolean
  ragflowBaseUrl: string
  ragflowApiKey: string
  ragflowChatId: string
  ragflowDatasetId: string
  ragTimeFilterStart: Date | null
  ragTimeFilterEnd: Date | null
  enableAutoTag: boolean
  autoTagModel: string
  enableBriefing: boolean
  briefingModel: string
  briefingTime: string
  aiPersonality: string
  aiExpertise: string | null
  enableLinkSuggestion: boolean
}>) {
  const config = await prisma.aiConfig.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })

  // 清除缓存，确保下次调用获取最新配置
  invalidateConfigCache(userId)

  return config
}
