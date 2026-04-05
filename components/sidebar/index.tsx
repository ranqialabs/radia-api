"use client"

import { useCallback } from "react"
import { authClient } from "@/lib/auth-client"
import { useIntegrations } from "@/providers/integrations"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { IntegrationItem } from "./integration-item"
import { AccountItem } from "./account-item"

export function AppSidebar() {
  const { data: session } = authClient.useSession()
  const { driveConnected } = useIntegrations()

  const requestDriveAccess = useCallback(async () => {
    await authClient.linkSocial({
      provider: "google",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
      callbackURL: "/",
    })
  }, [])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="flex aspect-square size-8 items-center justify-center bg-primary text-xs font-bold text-primary-foreground">
                R
              </div>
              <span className="font-medium">Radia</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent />

      <SidebarFooter>
        <SidebarMenu>
          <IntegrationItem
            connected={driveConnected}
            onConnectAction={requestDriveAccess}
          />
          <AccountItem
            name={session?.user.name}
            email={session?.user.email}
            image={session?.user.image}
          />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
