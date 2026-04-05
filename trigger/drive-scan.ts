import { logger, task } from "@trigger.dev/sdk/v3"
import {
  exportDocAsText,
  getDriveClient,
  getValidAccessToken,
  listDriveFiles,
} from "../lib/google-drive"

export const driveScanTask = task({
  id: "drive-scan",
  maxDuration: 300,
  run: async (payload: { userId: string; folderId?: string }) => {
    const { userId, folderId } = payload

    logger.log("Starting Drive scan", { userId, folderId })

    const accessToken = await getValidAccessToken(userId)
    const drive = getDriveClient(accessToken)

    const files = await listDriveFiles(drive, { folderId })
    logger.log(`Found ${files.length} Google Docs`, {
      files: files.map((f) => ({ id: f.id, name: f.name })),
    })

    const results = await Promise.all(
      files.map(async (file) => {
        if (!file.id || !file.name) return null

        const text = await exportDocAsText(drive, file.id)
        logger.log(`Exported doc: ${file.name}`, { charCount: text.length })

        return {
          fileId: file.id,
          name: file.name,
          modifiedTime: file.modifiedTime,
          charCount: text.length,
          preview: text.slice(0, 200),
        }
      })
    )

    const docs = results.filter(Boolean)

    logger.log("Drive scan complete", {
      totalDocs: docs.length,
      totalChars: docs.reduce((sum, d) => sum + (d?.charCount ?? 0), 0),
    })

    return { docs }
  },
})
