import { google, drive_v3, docs_v1 } from "googleapis"
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

function createGoogleAuth(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })
  return auth
}

export function getDriveClient(accessToken: string): drive_v3.Drive {
  return google.drive({ version: "v3", auth: createGoogleAuth(accessToken) })
}

export function getDocsClient(accessToken: string): docs_v1.Docs {
  return google.docs({ version: "v1", auth: createGoogleAuth(accessToken) })
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

export async function listDriveFolders(
  drive: drive_v3.Drive,
  parentId = "root"
): Promise<drive_v3.Schema$File[]> {
  const res = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and trashed=false and '${parentId}' in parents`,
    orderBy: "name",
    pageSize: 100,
    fields: "files(id, name)",
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

export type DocTab = {
  tabId: string
  title: string
  text: string
}

function flattenTabs(tabs: docs_v1.Schema$Tab[]): docs_v1.Schema$Tab[] {
  const result: docs_v1.Schema$Tab[] = []
  for (const tab of tabs) {
    result.push(tab)
    if (tab.childTabs?.length) {
      result.push(...flattenTabs(tab.childTabs))
    }
  }
  return result
}

function extractText(elements: docs_v1.Schema$StructuralElement[]): string {
  let text = ""
  for (const el of elements) {
    if (el.paragraph) {
      for (const elem of el.paragraph.elements ?? []) {
        text += elem.textRun?.content ?? ""
      }
    } else if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          text += extractText(cell.content ?? [])
        }
      }
    } else if (el.tableOfContents) {
      text += extractText(el.tableOfContents.content ?? [])
    }
  }
  return text
}

export async function extractAllTabsText(
  accessToken: string,
  documentId: string
): Promise<DocTab[]> {
  const docs = getDocsClient(accessToken)

  const res = await docs.documents.get({
    documentId,
    includeTabsContent: true,
  })

  return flattenTabs(res.data.tabs ?? []).map((tab) => ({
    tabId: tab.tabProperties?.tabId ?? "unknown",
    title: tab.tabProperties?.title ?? "Sem título",
    text: extractText(tab.documentTab?.body?.content ?? []),
  }))
}
