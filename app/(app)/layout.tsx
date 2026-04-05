import { Suspense } from "react"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/sidebar"
import { IntegrationsProvider } from "@/providers/integrations"

async function getGoogleScopes(userId: string) {
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "google" },
    select: { scope: true },
  })
  const scope = account?.scope ?? ""
  return {
    driveConnected: scope.includes("drive"),
    docsConnected: scope.includes("documents"),
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  const { driveConnected, docsConnected } = session
    ? await getGoogleScopes(session.user.id)
    : { driveConnected: false, docsConnected: false }

  return (
    <IntegrationsProvider value={{ driveConnected, docsConnected }}>
      <SidebarProvider>
        <Suspense>
          <AppSidebar />
        </Suspense>
        <SidebarInset>
          <header className="flex h-12 items-center border-b px-4">
            <SidebarTrigger />
          </header>
          <main className="flex-1 p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </IntegrationsProvider>
  )
}
