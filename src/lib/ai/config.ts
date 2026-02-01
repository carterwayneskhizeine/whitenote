import prisma from "@/lib/prisma"
import { encrypt, decrypt, isEncrypted } from "@/lib/crypto"
import type { AiConfig } from "@prisma/client"
import { Prisma } from "@prisma/client"

// 用户不存在错误（当数据库中找不到对应的用户记录时抛出）
export class UserNotFoundError extends Error {
  constructor(message: string = "User not found in database") {
    super(message)
    this.name = "UserNotFoundError"
  }
}

// 需要加密的字段列表
const ENCRYPTED_FIELDS = [
  'openaiApiKey',
  'ragflowApiKey',
  'asrApiKey',
] as const

// 用户级别配置缓存 (key = userId)
const configCache = new Map<string, {
  data: AiConfig
  timestamp: number
}>()

const CACHE_TTL = 5000 // 5 秒缓存，保证热更新响应速度

/**
 * 从数据库获取用户的 AI 配置并解密敏感字段
 */
async function getAiConfigFromDb(userId: string) {
  let config = await prisma.aiConfig.findUnique({
    where: { userId },
  })

  // 如果用户没有配置，创建默认配置
  if (!config) {
    try {
      config = await prisma.aiConfig.create({
        data: { userId },
      })
    } catch (error) {
      // 捕获外键约束错误，说明用户不存在
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new UserNotFoundError(`User with ID ${userId} does not exist in database`)
      }
      throw error
    }
  }

  // 解密敏感字段
  const decryptedConfig = { ...config }
  for (const field of ENCRYPTED_FIELDS) {
    const value = config[field]
    if (value && typeof value === 'string' && isEncrypted(value)) {
      try {
        (decryptedConfig as any)[field] = decrypt(value)
      } catch (error) {
        // 保持原值（可能是未加密的旧数据）
        ;(decryptedConfig as any)[field] = value
      }
    }
  }

  return decryptedConfig
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
 * 更新用户的 AI 配置 (敏感字段会自动加密)
 * @param userId 当前用户 ID
 * @param data 要更新的配置字段
 */
export async function updateAiConfig(userId: string, data: Partial<{
  openaiBaseUrl: string
  openaiApiKey: string
  openaiModel: string
  ragflowBaseUrl: string
  ragflowApiKey: string
  ragTimeFilterStart: Date | null
  ragTimeFilterEnd: Date | null
  autoTagModel: string
  briefingModel: string
  briefingTime: string
  aiPersonality: string
  aiExpertise: string | null
  enableLinkSuggestion: boolean
  enableMdSync: boolean
  mdSyncDir: string | null
  asrApiKey: string
  asrApiUrl: string
}>) {
  // 加密敏感字段
  const dataToStore = { ...data }
  for (const field of ENCRYPTED_FIELDS) {
    const value = data[field as keyof typeof data]
    if (value && typeof value === 'string') {
      try {
        (dataToStore as any)[field] = encrypt(value)
      } catch (error) {
        throw new Error(`Failed to encrypt ${field}. Check ENCRYPTION_KEY environment variable.`)
      }
    }
  }

  let config
  try {
    config = await prisma.aiConfig.upsert({
      where: { userId },
      update: dataToStore,
      create: { userId, ...dataToStore },
    })
  } catch (error) {
    // 捕获外键约束错误，说明用户不存在
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new UserNotFoundError(`User with ID ${userId} does not exist in database`)
    }
    throw error
  }

  // 清除缓存，确保下次调用获取最新配置
  invalidateConfigCache(userId)

  // 返回解密后的配置给调用者
  const decryptedConfig = { ...config }
  for (const field of ENCRYPTED_FIELDS) {
    const value = config[field]
    if (value && typeof value === 'string' && isEncrypted(value)) {
      try {
        (decryptedConfig as any)[field] = decrypt(value)
      } catch (error) {
        console.error(`Failed to decrypt ${field}:`, error)
      }
    }
  }

  return decryptedConfig
}
