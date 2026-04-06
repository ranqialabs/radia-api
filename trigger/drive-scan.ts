import { logger, metadata, task } from "@trigger.dev/sdk"
import {
  extractAllTabsText,
  getDriveClient,
  getValidAccessToken,
  listDriveFiles,
  type DocTab,
} from "../lib/google-drive"
import { mem0 } from "../lib/mem0"
import { prisma } from "../lib/prisma"

function tabToMessage(tab: DocTab) {
  // Mem0 expects "user" for raw dialog (transcription) and "assistant" for summaries.
  // This lets Mem0 extract memories with correct conversational context.
  const isTranscription = ["transcript", "transcrição", "transcricao"].some(
    (k) => tab.title.toLowerCase().includes(k)
  )
  return {
    role: isTranscription ? ("user" as const) : ("assistant" as const),
    content: `[${tab.title}]\n\n${tab.text}`,
  }
}

export const driveScanTask = task({
  id: "drive-scan",
  maxDuration: 600,
  run: async (payload: { userId: string; folderId?: string }) => {
    const { userId, folderId } = payload

    logger.log("Starting Drive scan", { userId, folderId })

    const accessToken = await getValidAccessToken(userId)
    const drive = getDriveClient(accessToken)

    const files = await listDriveFiles(drive, { folderId })
    logger.log(`Found ${files.length} Google Docs`, {
      files: files.map((f) => ({ id: f.id, name: f.name })),
    })

    const validFiles = files.filter(
      (f) => f.id && f.name
    ) as ((typeof files)[number] & {
      id: string
      name: string
    })[]

    // Batch check which files were already processed
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

      const messages = tabs.map(tabToMessage)

      const result = await mem0.add(messages, {
        user_id: userId,
        metadata: {
          fileId: file.id,
          title: file.name,
          source: "google-drive",
          modifiedTime: file.modifiedTime ?? null,
        },
      })

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
