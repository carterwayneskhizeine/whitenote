import { requireAuth } from "@/lib/api-auth"
import { NextRequest, NextResponse } from "next/server"
import { getAiConfig } from "@/lib/ai/config"
import Redis from "ioredis"

/**
 * GET /api/health/ragflow
 * 检查 RAGFlow 和 Worker 的健康状态
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth()
    const userId = session.user.id

    // 获取用户的 AI 配置
    const config = await getAiConfig(userId)

    const status = {
      ragflow: {
        connected: false,
        baseUrl: config.ragflowBaseUrl || null,
        error: null as string | null,
      },
      worker: {
        running: false,
        error: null as string | null,
      },
    }

    // 1. 检查 RAGFlow 连接
    if (config.ragflowBaseUrl && config.ragflowApiKey) {
      try {
        // 尝试调用 RAGFlow API 来测试连接
        const response = await fetch(`${config.ragflowBaseUrl}/api/v1/datasets`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${config.ragflowApiKey}`,
          },
          signal: AbortSignal.timeout(5000), // 5秒超时
        })

        if (response.ok) {
          status.ragflow.connected = true
        } else {
          status.ragflow.error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (error) {
        status.ragflow.error = error instanceof Error ? error.message : 'Unknown error'
      }
    } else {
      status.ragflow.error = 'RAGFlow not configured'
    }

    // 2. 检查 Worker 状态（通过 Redis 状态键）
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      const redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout: 2000,
      })

      // 检查 worker 状态键
      const workerStatusKey = 'worker:status'
      const workerStatus = await redis.get(workerStatusKey)

      if (workerStatus) {
        try {
          const statusData = JSON.parse(workerStatus)
          if (statusData.running) {
            status.worker.running = true
          }
        } catch (e) {
          status.worker.error = 'Invalid worker status data'
        }
      } else {
        status.worker.error = 'Worker not running'
      }

      await redis.quit()
    } catch (error) {
      status.worker.error = error instanceof Error ? error.message : 'Redis connection failed'
    }

    return NextResponse.json({ status })
  } catch (error) {
    console.error('[Health Check] Error:', error)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}
