import prisma from "@/lib/prisma"

async function testDatabaseConnection() {
  try {
    console.log("Testing database connection...")

    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 5
    })

    console.log(`Found ${workspaces.length} workspaces:`)
    workspaces.forEach(ws => {
      console.log(`  - ${ws.id.substring(0, 20)}... | ${ws.name}`)
    })

    await prisma.$disconnect()
    process.exit(0)
  } catch (error) {
    console.error("Database connection failed:", error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

testDatabaseConnection()
