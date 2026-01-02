import { Redis } from "ioredis"

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:4338", {
  maxRetriesPerRequest: null,
})

export default redis
