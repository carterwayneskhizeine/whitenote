import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { hash } from 'bcryptjs'
import { config } from 'dotenv'

// Load environment variables
config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // 1. 创建默认用户 (Owner)
  const passwordHash = await hash('admin123', 12)

  const owner = await prisma.user.upsert({
    where: { email: 'owner@whitenote.local' },
    update: {},
    create: {
      email: 'owner@whitenote.local',
      passwordHash,
      name: 'Owner',
    },
  })

  // 2. 为用户创建默认 AI 配置
  const aiConfig = await prisma.aiConfig.upsert({
    where: { userId: owner.id },
    update: {},
    create: {
      userId: owner.id,
      openaiBaseUrl: process.env.OPENAI_BASE_URL || 'http://localhost:4000',
      openaiApiKey: process.env.OPENAI_API_KEY || '',
      openaiModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      autoTagModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      briefingModel: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      ragflowBaseUrl: process.env.RAGFLOW_BASE_URL || 'http://localhost:4154',
      ragflowApiKey: process.env.RAGFLOW_API_KEY || '',
      ragflowChatId: process.env.RAGFLOW_CHAT_ID || '',
      ragflowDatasetId: process.env.RAGFLOW_DATASET_ID || '',
    },
  })

  // 3. 删除所有旧的内置模板
  await prisma.template.deleteMany({
    where: { isBuiltIn: true },
  })

  // 4. 创建新的内置模板
  const templates = [
    {
      id: 'goldierill',
      name: 'GoldieRill',
      description: 'AI 助手快速调用',
      content: `· @goldierill ·`,
      isBuiltIn: true,
    },
  ]

  for (const template of templates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        description: template.description,
        content: template.content,
      },
      create: {
        authorId: owner.id,
        ...template,
      },
    })
  }

  // 5. 创建一些示例标签
  const tags = ['Idea', 'Journal', 'React', 'Note', 'Todo']
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
