import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { config } from 'dotenv'

// Load environment variables
config()

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
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

async function main() {
  console.log('开始初始化 AI 命令...')

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

  console.log('AI 命令初始化完成！')
}

main()
  .catch((e) => {
    console.error('初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
