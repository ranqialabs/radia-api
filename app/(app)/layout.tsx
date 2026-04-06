import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "@/lib/session"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/sidebar"
import { IntegrationsProvider } from "@/providers/integrations"
import type { DriveFolder } from "@/actions/drive"

async function getGoogleScopes(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { scope: true },
  })
  const scope = account?.scope ?? ""
  const driveConnected = scope.includes("drive")

  const monitoredFolder = driveConnected
    ? await prisma.monitoredFolder.findUnique({
        where: { userId },
        select: { folderId: true, folderName: true },
      })
    : null

  return {
    driveConnected,
    docsConnected: scope.includes("documents"),
    monitoredFolder: monitoredFolder
      ? { id: monitoredFolder.folderId, name: monitoredFolder.folderName }
      : null,
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession()
  const { driveConnected, docsConnected, monitoredFolder } = session
    ? await getGoogleScopes(session.user.id)
    : { driveConnected: false, docsConnected: false, monitoredFolder: null }

  return (
    <IntegrationsProvider value={{ driveConnected, docsConnected }}>
      <SidebarProvider>
        <Suspense>
          <AppSidebar monitoredFolder={monitoredFolder as DriveFolder | null} />
        </Suspense>
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">
            <div className="container mx-auto">{children}</div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </IntegrationsProvider>
  )
}
