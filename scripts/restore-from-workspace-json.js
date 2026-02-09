const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Load .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const LINK_MD_DIR = path.join(__dirname, '../data/link_md');

async function restoreDatabase() {
  console.log('Starting database restoration from workspace.json files...\n');

  // Get default user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error('No user found in database. Please create a user first.');
    process.exit(1);
  }

  console.log(`Using user: ${user.email} (${user.id})\n`);

  const dirs = fs.readdirSync(LINK_MD_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => path.join(LINK_MD_DIR, d.name));

  let stats = {
    workspaces: 0,
    messages: 0,
    comments: 0,
    errors: 0
  };

  for (const folderPath of dirs) {
    const folderName = path.basename(folderPath);
    const workspaceFile = path.join(folderPath, '.whitenote', 'workspace.json');

    if (!fs.existsSync(workspaceFile)) {
      console.log(`⚠️  Skipping ${folderName} (no workspace.json)`);
      continue;
    }

    try {
      const wsData = JSON.parse(fs.readFileSync(workspaceFile, 'utf-8'));
      const wsInfo = wsData.workspace;

      console.log(`\n📁 Processing: ${folderName}`);
      console.log(`   Original ID: ${wsInfo.id}`);

      // Create or update workspace
      let workspace;
      const existing = await prisma.workspace.findUnique({
        where: { id: wsInfo.id }
      });

      if (existing) {
        console.log(`   ✅ Workspace already exists, updating...`);
        workspace = await prisma.workspace.update({
          where: { id: wsInfo.id },
          data: {
            name: wsInfo.name,
            updatedAt: new Date(wsInfo.lastSyncedAt || new Date())
          }
        });
      } else {
        console.log(`   🆕 Creating new workspace...`);
        workspace = await prisma.workspace.create({
          data: {
            id: wsInfo.id,
            name: wsInfo.name,
            userId: user.id,
            createdAt: new Date(wsInfo.lastSyncedAt || new Date()),
            updatedAt: new Date(wsInfo.lastSyncedAt || new Date())
          }
        });
      }

      console.log(`   ✅ Workspace: ${workspace.name} (${workspace.id})`);
      stats.workspaces++;

      // Process messages
      const messages = wsData.messages || {};
      for (const [key, msgData] of Object.entries(messages)) {
        const msgFilePath = path.join(folderPath, msgData.currentFilename);

        if (!fs.existsSync(msgFilePath)) {
          console.log(`   ⚠️  File not found: ${msgData.currentFilename}`);
          continue;
        }

        let content = fs.readFileSync(msgFilePath, 'utf-8');

        // 清理开头的多余空行，保留第一行作为 tags
        // 移除开头的所有空行，确保第一行是 tags（以 # 开头）
        content = content.replace(/^\s*\n+/, '');

        // Check if message exists
        const existingMsg = await prisma.message.findUnique({
          where: { id: msgData.id }
        });

        if (existingMsg) {
          console.log(`      ✅ Message exists: ${msgData.currentFilename}`);
        } else {
          // Create message
          await prisma.message.create({
            data: {
              id: msgData.id,
              content: content,
              authorId: user.id,
              workspaceId: workspace.id,
              createdAt: new Date(msgData.created_at),
              updatedAt: new Date(msgData.updated_at)
            }
          });
          console.log(`      📝 Created: ${msgData.currentFilename}`);
          stats.messages++;
        }
      }

      // Process comments
      const comments = wsData.comments || {};
      console.log(`\n   💬 Processing ${Object.keys(comments).length} comments...`);

      // Separate top-level comments from replies
      const topLevelComments = [];
      const replyComments = [];

      for (const [key, commentData] of Object.entries(comments)) {
        // Check if message exists (comments must have a parent message)
        const parentMessage = await prisma.message.findUnique({
          where: { id: commentData.messageId }
        });

        if (!parentMessage) {
          console.log(`      ⚠️  Parent message not found for comment: ${commentData.currentFilename}`);
          continue;
        }

        const commentFilePath = path.join(folderPath, commentData.folderName, commentData.currentFilename);

        if (!fs.existsSync(commentFilePath)) {
          console.log(`      ⚠️  Comment file not found: ${commentData.currentFilename}`);
          continue;
        }

        let content = fs.readFileSync(commentFilePath, 'utf-8');

        // 清理开头的多余空行，保留第一行作为 tags
        content = content.replace(/^\s*\n+/, '');

        // Check if comment exists
        const existingComment = await prisma.comment.findUnique({
          where: { id: commentData.id }
        });

        if (existingComment) {
          // Silent skip for existing comments
          continue;
        }

        const commentRecord = {
          id: commentData.id,
          content: content,
          authorId: user.id,
          messageId: commentData.messageId,
          parentId: commentData.parentId,
          createdAt: new Date(commentData.created_at),
          updatedAt: new Date(commentData.updated_at),
          filename: commentData.currentFilename
        };

        // Separate by whether it has a parentId
        if (!commentData.parentId) {
          topLevelComments.push(commentRecord);
        } else {
          replyComments.push(commentRecord);
        }
      }

      // Create top-level comments first
      for (const comment of topLevelComments) {
        try {
          await prisma.comment.create({
            data: {
              id: comment.id,
              content: comment.content,
              authorId: comment.authorId,
              messageId: comment.messageId,
              parentId: comment.parentId,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt
            }
          });
          console.log(`      💬 Created comment: ${comment.filename}`);
          stats.comments++;
        } catch (error) {
          console.error(`      ❌ Error creating comment ${comment.filename}:`, error.message);
        }
      }

      // Create reply comments (may reference newly created top-level comments)
      for (const comment of replyComments) {
        try {
          await prisma.comment.create({
            data: {
              id: comment.id,
              content: comment.content,
              authorId: comment.authorId,
              messageId: comment.messageId,
              parentId: comment.parentId,
              createdAt: comment.createdAt,
              updatedAt: comment.updatedAt
            }
          });
          console.log(`      💬 Created reply: ${comment.filename}`);
          stats.comments++;
        } catch (error) {
          console.error(`      ❌ Error creating reply ${comment.filename}:`, error.message);
          stats.errors++;
        }
      }

    } catch (error) {
      console.error(`❌ Error processing ${folderName}:`, error.message);
      stats.errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Restoration Summary:');
  console.log(`  Workspaces: ${stats.workspaces}`);
  console.log(`  Messages: ${stats.messages}`);
  console.log(`  Comments: ${stats.comments}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('='.repeat(50));

  await prisma.$disconnect();
}

restoreDatabase().catch(console.error);
