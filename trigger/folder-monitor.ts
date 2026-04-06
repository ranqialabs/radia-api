import { schedules } from "@trigger.dev/sdk"
import { driveScanTask } from "./drive-scan"
import { prisma } from "../lib/prisma"

export const folderMonitorTask = schedules.task({
  id: "folder-monitor",
  run: async (payload) => {
    const userId = payload.externalId
    if (!userId) return

    const folder = await prisma.monitoredFolder.findUnique({
      where: { userId },
      select: { folderId: true },
    })

    if (!folder) return

    await driveScanTask.trigger({
      userId,
      folderId: folder.folderId === "root" ? undefined : folder.folderId,
    })
  },
})
