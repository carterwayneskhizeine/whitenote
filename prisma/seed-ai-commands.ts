import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { config } from 'dotenv'

config()

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? 'file:./data/whitenote.db' })
const prisma = new PrismaClient({ adapter })

const builtinCommands = [
  {
    id: 'builtin-ask',
    label: 'Ask',
    description: 'AI Ask',
    action: 'ask',
    prompt: 'You are a helpful assistant.\n{content}',
    isBuiltIn: true,
    authorId: null,
  },
]

const builtinTemplates = [
  {
    id: 'goldierill',
    name: 'GoldieRill',
    description: 'AI Assistant',
    content: `  @goldierill  `,
    isBuiltIn: true,
  },
  {
    id: 'ragflow',
    name: 'RAGFlow',
    description: 'AI Assistant',
    content: `  @ragflow  `,
    isBuiltIn: true,
  },
]

async function main() {
  console.log('开始初始化数据...')

  console.log('\n初始化 AI 命令...')
  for (const command of builtinCommands) {
    await prisma.aICommand.upsert({
      where: { id: command.id },
      update: {
        label: command.label,
        description: command.description,
        action: command.action,
        prompt: command.prompt,
      },
      create: command,
    })
    console.log(`✓ 已就绪命令: ${command.label}`)
  }

  console.log('\n初始化内置模板...')
  await prisma.template.deleteMany({
    where: { isBuiltIn: true },
  })

  for (const template of builtinTemplates) {
    await prisma.template.upsert({
      where: { id: template.id },
      update: {
        name: template.name,
        description: template.description,
        content: template.content,
      },
      create: template,
    })
    console.log(`✓ 已就绪模板: ${template.name}`)
  }

  console.log('\n✅ 数据初始化完成！')
}

main()
  .catch((e) => {
    console.error('❌ 数据初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
