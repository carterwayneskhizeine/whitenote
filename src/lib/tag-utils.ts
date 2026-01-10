import prisma from "@/lib/prisma"

/**
 * Batch upsert tags and return their IDs
 * Optimized to avoid N+1 queries
 *
 * @param tagNames - Array of tag names to upsert
 * @returns Array of tag IDs
 */
export async function batchUpsertTags(tagNames: string[]): Promise<string[]> {
  if (!tagNames || tagNames.length === 0) {
    return []
  }

  // Normalize tag names (trim, lowercase, remove duplicates)
  const normalizedNames = Array.from(
    new Set(tagNames.map((name) => name.trim().toLowerCase()).filter(Boolean)
  )

  // Step 1: Batch query all existing tags (1 query)
  const existingTags = await prisma.tag.findMany({
    where: {
      name: { in: normalizedNames },
    },
    select: {
      id: true,
      name: true,
    },
  })

  // Step 2: Identify new tags that need to be created
  const existingNames = new Set(existingTags.map((tag) => tag.name))
  const newNames = normalizedNames.filter((name) => !existingNames.has(name))

  // Step 3: Batch create new tags if any (1 query)
  let createdTags: Array<{ id: string; name: string }> = []
  if (newNames.length > 0) {
    // Use createMany with skipDuplicates for better performance
    await prisma.tag.createMany({
      data: newNames.map((name) => ({ name })),
      skipDuplicates: true,
    })

    // Query the newly created tags to get their IDs
    createdTags = await prisma.tag.findMany({
      where: {
        name: { in: newNames },
      },
      select: {
        id: true,
        name: true,
      },
    })
  }

  // Step 4: Combine and return all tag IDs
  const allTags = [...existingTags, ...createdTags]
  const tagMap = new Map(allTags.map((tag) => [tag.name, tag.id]))

  // Return IDs in the same order as input (after normalization)
  return normalizedNames.map((name) => tagMap.get(name)!).filter(Boolean)
}

/**
 * Create tag connections for a message
 *
 * @param messageId - The message ID
 * @param tagIds - Array of tag IDs to connect
 */
export async function connectTagsToMessage(
  messageId: string,
  tagIds: string[]
): Promise<void> {
  if (tagIds.length === 0) {
    return
  }

  // Use createMany for better performance (single query)
  await prisma.messageTag.createMany({
    data: tagIds.map((tagId) => ({
      messageId,
      tagId,
    })),
    skipDuplicates: true,
  })
}
