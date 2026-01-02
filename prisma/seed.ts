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
  console.log('🌱 Starting database seeding...')

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

  console.log('✅ Created owner user:', owner.email)

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

  console.log('✅ Created AI config for user:', owner.email)

  // 3. 创建内置模板
  const templates = [
    {
      id: 'daily-journal',
      name: 'Daily Journal',
      description: '每日日记模板',
      content: `# 📅 ${new Date().toLocaleDateString('zh-CN')}

## 今日心情
<!-- 用 emoji 表达今天的心情 -->

## 今日待办
- [ ]

## 今日收获
<!-- 今天学到了什么？ -->

## 明日计划
<!-- 明天要做什么？ -->
`,
      isBuiltIn: true,
    },
    {
      id: 'quick-idea',
      name: 'Quick Idea',
      description: '快速记录灵感',
      content: `💡 **灵感速记**

---

<!-- 快速记录你的想法 -->

`,
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
        id: template.id,
        authorId: owner.id,
        ...template,
      },
    })
  }

  console.log('✅ Created built-in templates:', templates.length)

  // 4. 创建一些示例标签
  const tags = ['Idea', 'Journal', 'React', 'Note', 'Todo']
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { name: tagName },
      update: {},
      create: { name: tagName },
    })
  }
  console.log('✅ Created sample tags:', tags.length)

  console.log('🎉 Database seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
