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
          entities: extracted.entities.map((e) => e.name),
        }
      )

      const messages = [
        ...extracted.memories.map((m) => ({
          role: "user" as const,
          content: m.content,
        })),
        ...extracted.entities.map((e) => ({
          role: "user" as const,
          content: `Entity identified: ${e.name} (${e.type})${e.aliases.length ? `, also known as: ${e.aliases.join(", ")}` : ""}`,
        })),
      ]

      if (messages.length === 0) {
        logger.log(`No memories extracted from: ${file.name}, skipping`)
        continue
      }

      const result = await mem0.add(messages, {
        user_id: userId,
        metadata: {
          fileId: file.id,
          title: file.name,
          source: "google-drive",
          modifiedTime: file.modifiedTime ?? null,
        },
      })

      if (!Array.isArray(result)) {
        logger.warn(`Unexpected mem0.add response for: ${file.name}`, {
          result,
        })
      }

      const mem0Ids = Array.isArray(result)
        ? result.map((r: { id: string }) => r.id)
        : []

      await prisma.meetingMemory.create({
        data: { fileId: file.id, userId, title: file.name, mem0Ids },
      })

      processed++
      metadata.set("processed", processed)
      logger.log(`Ingested: ${file.name}`, { mem0Ids })
    }

    logger.log("Drive scan complete", { processed, skipped })

    return { processed, skipped, total: validFiles.length }
  },
})
