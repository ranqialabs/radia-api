import { logger, metadata, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import {
  extractAllTabsText,
  getDriveClient,
  getValidAccessToken,
  listDriveFiles,
} from "../lib/google-drive"
import { extractMemories } from "../lib/memory-extractor"
import { mem0 } from "../lib/mem0"
import { prisma } from "../lib/prisma"

export const driveScanTask = schemaTask({
  id: "drive-scan",
  schema: z.object({ userId: z.string() }),
  maxDuration: 600,
  run: async ({ userId }) => {
    const monitored = await prisma.monitoredFolder.findUnique({
      where: { userId },
      select: { folderId: true },
    })

    const folderId =
      monitored && monitored.folderId !== "root"
        ? monitored.folderId
        : undefined

    logger.log("Starting Drive scan", { userId, folderId })

    const accessToken = await getValidAccessToken(userId)
    const drive = getDriveClient(accessToken)

    const files = await listDriveFiles(drive, { folderId })
    logger.log(`Found ${files.length} Google Docs`, {
      files: files.map((f) => ({ id: f.id, name: f.name })),
    })

    const validFiles = files.filter(
      (f) => f.id && f.name
    ) as ((typeof files)[number] & { id: string; name: string })[]

    const alreadyProcessed = new Set(
      (
        await prisma.meetingMemory.findMany({
          where: { userId, fileId: { in: validFiles.map((f) => f.id) } },
          select: { fileId: true },
        })
      ).map((m) => m.fileId)
    )

    const toProcess = validFiles.filter((f) => !alreadyProcessed.has(f.id))
    const skipped = validFiles.length - toProcess.length

    metadata.set("total", validFiles.length)
    metadata.set("skipped", skipped)
    metadata.set("processed", 0)

    let processed = 0

    for (const file of toProcess) {
      logger.log(`Extracting tabs from: ${file.name}`)
      const tabs = await extractAllTabsText(accessToken, file.id)

      logger.log(`Extracted ${tabs.length} tabs`, {
        tabs: tabs.map((t) => ({ title: t.title, chars: t.text.length })),
      })

      const extracted = await extractMemories(tabs, file.name)

      logger.log(
        `Extracted ${extracted.memories.length} memories, ${extracted.entities.length} entities`,
        {
          participants: extracted.participants,
          entities: extracted.entities.map((e) => `${e.name} (${e.type})`),
        }
      )

      // Mark as processed early to prevent reprocessing if we crash mid-flight.
      // mem0Ids will be updated after successful ingestion.
      await prisma.meetingMemory.upsert({
        where: { fileId_userId: { fileId: file.id, userId } },
        create: { fileId: file.id, userId, title: file.name, mem0Ids: [] },
        update: {},
      })

      if (extracted.memories.length === 0 && extracted.entities.length === 0) {
        logger.log(
          `No memories extracted from: ${file.name}, skipping mem0 ingestion`
        )
        continue
      }

      // Build messages scoped to this meeting.
      // Using run_id = fileId isolates each meeting as its own episode in mem0,
      // enabling per-meeting filtering and preventing cross-meeting noise.
      const meetingContext = `[Meeting: ${file.name}${extracted.participants.length ? ` | Participants: ${extracted.participants.join(", ")}` : ""}]`

      const memoryMessages = extracted.memories.map((m) => ({
        role: "user" as const,
        content: `${meetingContext} ${m.content}`,
      }))

      // Entities are sent as a separate batch with their own context so mem0
      // understands these are named entity definitions, not just facts.
      const entityMessages = extracted.entities.map((e) => ({
        role: "user" as const,
        content: `${meetingContext} Entity: ${e.name} is a ${e.type}${e.description ? ` — ${e.description}` : ""}${e.aliases.length ? `. Also referred to as: ${e.aliases.join(", ")}` : ""}.`,
      }))

      const allMessages = [...entityMessages, ...memoryMessages]

      const result = await mem0.add(allMessages, {
        user_id: userId,
        // run_id scopes this batch to the specific meeting file,
        // enabling future per-meeting searches and deletions.
        run_id: file.id,
        metadata: {
          fileId: file.id,
          title: file.name,
          source: "google-drive",
          sourceType: "meeting-transcript",
          participants: extracted.participants,
          modifiedTime: file.modifiedTime ?? null,
        },
      })

      if (!Array.isArray(result)) {
        logger.warn(`Unexpected mem0.add response for: ${file.name}`, {
          result,
        })
      }

      const mem0Ids = Array.isArray(result)
        ? result
            .map((r: { id?: string }) => r.id)
            .filter((id): id is string => id !== undefined)
        : []

      await prisma.meetingMemory.update({
        where: { fileId_userId: { fileId: file.id, userId } },
        data: { mem0Ids },
      })

      processed++
      metadata.set("processed", processed)
      logger.log(`Ingested: ${file.name}`, {
        mem0Ids: mem0Ids.length,
        memories: extracted.memories.length,
        entities: extracted.entities.length,
      })
    }

    logger.log("Drive scan complete", { processed, skipped })

    return { processed, skipped, total: validFiles.length }
  },
})
