import { logger, metadata, schemaTask } from "@trigger.dev/sdk"
import { z } from "zod"
import { getValidAccessToken } from "../lib/google-drive"
import {
  getMeetClient,
  listConferenceRecords,
  listTranscriptsWithDoc,
} from "../lib/google-meet"
import { prisma } from "../lib/prisma"
import { meetIngestTask } from "./meet-ingest"

const CONCURRENCY = 5

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

export const meetScanTask = schemaTask({
  id: "meet-scan",
  schema: z.object({ userId: z.string() }),
  maxDuration: 120,
  run: async ({ userId }) => {
    logger.log("Starting Meet scan", { userId })

    const accessToken = await getValidAccessToken(userId)
    const meetClient = getMeetClient(accessToken)

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const conferences = await listConferenceRecords(meetClient, {
      filter: `startTime > ${since}`,
    })

    logger.log(`Found ${conferences.length} conference records`)

    const alreadyIngested = new Set(
      (
        await prisma.conferenceRecord.findMany({
          where: {
            userId,
            recordName: { in: conferences.map((c) => c.name) },
            transcriptIngested: true,
          },
          select: { recordName: true },
        })
      ).map((r) => r.recordName)
    )

    const toProcess = conferences.filter((c) => !alreadyIngested.has(c.name))

    metadata.set("total", conferences.length)
    metadata.set("skipped", alreadyIngested.size)

    if (toProcess.length === 0) {
      logger.log("Nothing to process")
      return {
        dispatched: 0,
        skipped: alreadyIngested.size,
        total: conferences.length,
      }
    }

    // Fetch transcripts with bounded concurrency to avoid heap exhaustion
    const transcriptResults = await mapWithConcurrency(
      toProcess,
      CONCURRENCY,
      async (conference) => {
        const transcripts = await listTranscriptsWithDoc(
          meetClient,
          conference.name
        )
        const ready =
          transcripts.find(
            (t) => t.state === "FILE_GENERATED" && t.docsFileId !== null
          ) ?? null
        return { conference, ready }
      }
    )

    const readyItems = transcriptResults.filter((r) => r.ready !== null) as {
      conference: (typeof toProcess)[number]
      ready: NonNullable<(typeof transcriptResults)[number]["ready"]>
    }[]

    if (readyItems.length === 0) {
      logger.log("No conferences with ready transcripts")
      return {
        dispatched: 0,
        skipped: alreadyIngested.size,
        total: conferences.length,
      }
    }

    // Upsert conference rows sequentially to keep DB connections low
    const batch: Parameters<typeof meetIngestTask.batchTrigger>[0] = []
    for (const { conference, ready } of readyItems) {
      const row = await prisma.conferenceRecord.upsert({
        where: { recordName: conference.name },
        create: {
          userId,
          recordName: conference.name,
          spaceId: conference.spaceId,
          startTime: conference.startTime
            ? new Date(conference.startTime)
            : null,
          endTime: conference.endTime ? new Date(conference.endTime) : null,
        },
        update: {},
        select: { id: true },
      })

      batch.push({
        payload: {
          userId,
          conferenceRecordId: row.id,
          recordName: conference.name,
          transcriptName: ready.transcriptName,
          docsFileId: ready.docsFileId!,
          startTime: conference.startTime,
        },
      })
    }

    await meetIngestTask.batchTrigger(batch)

    logger.log(`Dispatched ${batch.length} ingest tasks`, {
      skipped: alreadyIngested.size,
    })

    return {
      dispatched: batch.length,
      skipped: alreadyIngested.size,
      total: conferences.length,
    }
  },
})
