import { Redis } from "ioredis"

const rawUrl = process.env.REDIS_URL;
const fallbackUrl = "redis://localhost:16379";
const redisUrl = rawUrl || fallbackUrl;
//console.log(`[Redis] process.env.REDIS_URL: "${rawUrl}"`);
//console.log(`[Redis] Using URL: ${redisUrl}`);

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
})

export default redis
