import { mem0 } from "./mem0"
import { prisma } from "./prisma"

export type MemoryItem = {
  id: string
  memory: string
  created_at?: Date
  score?: number
  source?: string // file title from metadata
  categories?: string[]
}

async function search(
  userId: string,
  query: string,
  limit = 5
): Promise<MemoryItem[]> {
  const results = await mem0.search(query, {
    user_id: userId,
    limit,
    filters: { user_id: userId },
  })
  return results
    .filter(
      (r): r is typeof r & { id: string; memory: string } =>
        !!r.id && !!r.memory
    )
    .map((r) => ({
      id: r.id,
      memory: r.memory,
      created_at: r.created_at,
      score: r.score,
      source: r.metadata?.title ?? undefined,
      categories: r.categories ?? undefined,
    }))
}

export async function getDecisions(userId: string) {
  return search(userId, "decisions made agreed", 5)
}

export async function getActionItems(userId: string) {
  return search(userId, "action items tasks pending responsible deadline", 5)
}

export async function getEntities(userId: string) {
  return search(userId, "entity identified person project company", 6)
}

export async function getProcessedDocs(userId: string) {
  return prisma.meetingMemory.findMany({
    where: { userId },
    orderBy: { processedAt: "desc" },
    take: 6,
    select: { id: true, title: true, processedAt: true, mem0Ids: true },
  })
}
