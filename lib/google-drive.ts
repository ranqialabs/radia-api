import { google, drive_v3 } from "googleapis"
import { prisma } from "./prisma"

export async function getValidAccessToken(userId: string): Promise<string> {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
  })

  if (!account?.accessToken) {
    throw new Error(`No Google account found for user ${userId}`)
  }

  const isExpired =
    account.accessTokenExpiresAt && account.accessTokenExpiresAt < new Date()

  if (!isExpired) {
    return account.accessToken
  }

  if (!account.refreshToken) {
    throw new Error(
      `Access token expired and no refresh token available for user ${userId}`
    )
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ refresh_token: account.refreshToken })

  const { credentials } = await auth.refreshAccessToken()

  await prisma.account.update({
    where: { id: account.id },
    data: {
      accessToken: credentials.access_token,
      accessTokenExpiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date)
        : null,
    },
  })

  return credentials.access_token!
}

export function getDriveClient(accessToken: string): drive_v3.Drive {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return google.drive({ version: "v3", auth })
}

export async function listDriveFiles(
  drive: drive_v3.Drive,
  options?: { folderId?: string; pageSize?: number }
): Promise<drive_v3.Schema$File[]> {
  const { folderId, pageSize = 50 } = options ?? {}

  const queryParts = [
    "mimeType='application/vnd.google-apps.document'",
    "trashed=false",
  ]
  if (folderId) {
    queryParts.push(`'${folderId}' in parents`)
  }

  const res = await drive.files.list({
    q: queryParts.join(" and "),
    orderBy: "modifiedTime desc",
    pageSize,
    fields: "files(id, name, mimeType, modifiedTime)",
  })

  return res.data.files ?? []
}

export async function exportDocAsText(
  drive: drive_v3.Drive,
  fileId: string
): Promise<string> {
  const res = await drive.files.export(
    { fileId, mimeType: "text/plain" },
    { responseType: "arraybuffer" }
  )
  return Buffer.from(res.data as ArrayBuffer).toString("utf-8")
}
