"use client"

import { useCallback, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Logout01Icon, MoreVerticalIcon } from "@hugeicons/core-free-icons"
import { authClient } from "@/lib/auth-client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar"

type AccountItemProps = {
  name?: string | null
  email?: string | null
  image?: string | null
}

export function AccountItem({ name, email, image }: AccountItemProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSignOut = useCallback(() => {
    startTransition(async () => {
      await authClient.signOut({
        fetchOptions: { onSuccess: () => router.push("/login") },
      })
    })
  }, [router])

  const isLoading = !name && !email

  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              tooltip={name ?? email ?? "Account"}
            />
          }
        >
          {isLoading ? (
            <Skeleton className="size-8 shrink-0 rounded-full" />
          ) : image ? (
            <Image
              src={image}
              alt={name ?? "Avatar"}
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold uppercase">
              {name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
            {isLoading ? (
              <>
                <Skeleton className="h-2.5 w-24 rounded" />
                <Skeleton className="h-2 w-32 rounded" />
              </>
            ) : (
              <>
                <span className="truncate text-sm leading-none font-medium">
                  {name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </>
            )}
          </div>
          <HugeiconsIcon
            icon={MoreVerticalIcon}
            size={14}
            className="shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden"
          />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="end"
          className="w-56"
          sideOffset={4}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-muted-foreground">{email}</span>
              </div>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              onClick={handleSignOut}
              disabled={isPending}
              className="text-destructive focus:text-destructive"
            >
              <HugeiconsIcon icon={Logout01Icon} size={14} />
              {isPending ? "Signing out..." : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}
