/**
 * Workspace Discovery Utility Test
 *
 * Run this script to verify the workspace-discovery utility works correctly:
 * npx tsx test-workspace-discovery.ts
 */

import * as fs from "fs"
import * as path from "path"
import {
  getWorkspaceDir,
  getWorkspaceMeta,
  findWorkspaceByFolderName,
  getWorkspaceMetadataPath,
  readWorkspaceMetadata,
  writeWorkspaceMetadata,
  clearWorkspaceCache,
  getWorkspaceIdByFolderName,
  getFolderNameByWorkspaceId
} from "./src/lib/workspace-discovery"

const SYNC_DIR = process.env.FILE_WATCHER_DIR || "D:\\Code\\whitenote-data\\link_md"

console.log("=".repeat(60))
console.log("Workspace Discovery Utility Test")
console.log("=".repeat(60))
console.log(`SYNC_DIR: ${SYNC_DIR}`)
console.log("")

// Test 1: Scan all workspaces
console.log("📂 Test 1: Scanning all workspaces...")
clearWorkspaceCache()

if (!fs.existsSync(SYNC_DIR)) {
  console.log(`❌ SYNC_DIR does not exist: ${SYNC_DIR}`)
  process.exit(1)
}

const dirs = fs.readdirSync(SYNC_DIR, { withFileTypes: true })
const workspaceFolders = dirs.filter(d => d.isDirectory())

console.log(`Found ${workspaceFolders.length} directories in SYNC_DIR`)

let validWorkspaceCount = 0
const testResults: {
  workspaceId: string
  folderName: string
  tests: string[]
}[] = []

for (const folder of workspaceFolders) {
  const metadataPath = path.join(SYNC_DIR, folder.name, ".whitenote", "workspace.json")

  if (!fs.existsSync(metadataPath)) {
    continue
  }

  try {
    const data = JSON.parse(fs.readFileSync(metadataPath, "utf-8"))

    if (data.version === 2 && data.workspace?.id) {
      const workspaceId = data.workspace.id
      const folderName = folder.name
      const tests: string[] = []

      validWorkspaceCount++
      console.log(`\n🔍 Workspace: ${folderName} (ID: ${workspaceId})`)

      // Test 2: getWorkspaceMeta by workspaceId
      console.log(`  ✓ Test 2: getWorkspaceMeta("${workspaceId}")`)
      const meta = getWorkspaceMeta(workspaceId)
      if (meta && meta.id === workspaceId && meta.currentFolderName === folderName) {
        tests.push("✅ getWorkspaceMeta works")
        console.log(`    Found: ${meta.currentFolderName} at ${meta.folderPath}`)
      } else {
        tests.push("❌ getWorkspaceMeta failed")
        console.log(`    ❌ FAILED`)
      }

      // Test 3: findWorkspaceByFolderName
      console.log(`  ✓ Test 3: findWorkspaceByFolderName("${folderName}")`)
      const metaByFolder = findWorkspaceByFolderName(folderName)
      if (metaByFolder && metaByFolder.id === workspaceId) {
        tests.push("✅ findWorkspaceByFolderName works")
        console.log(`    Found workspaceId: ${metaByFolder.id}`)
      } else {
        tests.push("❌ findWorkspaceByFolderName failed")
        console.log(`    ❌ FAILED`)
      }

      // Test 4: getWorkspaceDir
      console.log(`  ✓ Test 4: getWorkspaceDir("${workspaceId}")`)
      const workspaceDir = getWorkspaceDir(workspaceId)
      const expectedDir = path.join(SYNC_DIR, folderName)
      if (workspaceDir === expectedDir) {
        tests.push("✅ getWorkspaceDir works")
        console.log(`    Path: ${workspaceDir}`)
      } else {
        tests.push("❌ getWorkspaceDir failed")
        console.log(`    ❌ Expected: ${expectedDir}`)
        console.log(`    ❌ Got: ${workspaceDir}`)
      }

      // Test 5: getWorkspaceMetadataPath
      console.log(`  ✓ Test 5: getWorkspaceMetadataPath("${workspaceId}")`)
      const metadataPathResult = getWorkspaceMetadataPath(workspaceId)
      if (metadataPathResult === metadataPath) {
        tests.push("✅ getWorkspaceMetadataPath works")
        console.log(`    Path: ${metadataPathResult}`)
      } else {
        tests.push("❌ getWorkspaceMetadataPath failed")
        console.log(`    ❌ Expected: ${metadataPath}`)
        console.log(`    ❌ Got: ${metadataPathResult}`)
      }

      // Test 6: readWorkspaceMetadata
      console.log(`  ✓ Test 6: readWorkspaceMetadata("${workspaceId}")`)
      const metadata = readWorkspaceMetadata(workspaceId)
      if (metadata && metadata.workspace?.id === workspaceId) {
        tests.push("✅ readWorkspaceMetadata works")
        console.log(`    Version: ${metadata.version}, Workspace: ${metadata.workspace.name}`)
      } else {
        tests.push("❌ readWorkspaceMetadata failed")
        console.log(`    ❌ FAILED`)
      }

      // Test 7: getWorkspaceIdByFolderName
      console.log(`  ✓ Test 7: getWorkspaceIdByFolderName("${folderName}")`)
      const foundWorkspaceId = getWorkspaceIdByFolderName(folderName)
      if (foundWorkspaceId === workspaceId) {
        tests.push("✅ getWorkspaceIdByFolderName works")
        console.log(`    Found workspaceId: ${foundWorkspaceId}`)
      } else {
        tests.push("❌ getWorkspaceIdByFolderName failed")
        console.log(`    ❌ Expected: ${workspaceId}`)
        console.log(`    ❌ Got: ${foundWorkspaceId}`)
      }

      // Test 8: getFolderNameByWorkspaceId
      console.log(`  ✓ Test 8: getFolderNameByWorkspaceId("${workspaceId}")`)
      const foundFolderName = getFolderNameByWorkspaceId(workspaceId)
      if (foundFolderName === folderName) {
        tests.push("✅ getFolderNameByWorkspaceId works")
        console.log(`    Found folderName: ${foundFolderName}`)
      } else {
        tests.push("❌ getFolderNameByWorkspaceId failed")
        console.log(`    ❌ Expected: ${folderName}`)
        console.log(`    ❌ Got: ${foundFolderName}`)
      }

      testResults.push({
        workspaceId,
        folderName,
        tests
      })
    }
  } catch (error) {
    console.error(`  ❌ Error processing folder ${folder.name}:`, error)
  }
}

// Test 9: Cache performance
console.log("\n" + "=".repeat(60))
console.log("🚀 Test 9: Cache Performance Test")
clearWorkspaceCache()

const startTime1 = Date.now()
getWorkspaceDir(testResults[0]?.workspaceId || "")
const endTime1 = Date.now()
console.log(`First call (cache miss): ${endTime1 - startTime1}ms`)

const startTime2 = Date.now()
getWorkspaceDir(testResults[0]?.workspaceId || "")
const endTime2 = Date.now()
console.log(`Second call (cache hit): ${endTime2 - startTime2}ms`)

// Summary
console.log("\n" + "=".repeat(60))
console.log("📊 Test Summary")
console.log("=".repeat(60))

let totalTests = 0
let passedTests = 0

for (const result of testResults) {
  console.log(`\nWorkspace: ${result.folderName} (${result.workspaceId})`)
  result.tests.forEach(test => {
    totalTests++
    if (test.startsWith("✅")) passedTests++
    console.log(`  ${test}`)
  })
}

console.log("\n" + "=".repeat(60))
console.log(`Total Workspaces: ${validWorkspaceCount}`)
console.log(`Total Tests: ${totalTests}`)
console.log(`Passed: ${passedTests}`)
console.log(`Failed: ${totalTests - passedTests}`)
console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`)
console.log("=".repeat(60))

if (passedTests === totalTests) {
  console.log("\n✅ All tests passed!")
  process.exit(0)
} else {
  console.log("\n❌ Some tests failed!")
  process.exit(1)
}
