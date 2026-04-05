"use client"

import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { GoogleIcon } from "@hugeicons/core-free-icons"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const signInWithGoogle = async () => {
    setLoading(true)
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    })
    setLoading(false)
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-medium tracking-tight">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Connect your Google account to continue.
        </p>
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full gap-3"
        onClick={signInWithGoogle}
        disabled={loading}
      >
        <HugeiconsIcon icon={GoogleIcon} size={16} />
        {loading ? "Redirecting..." : "Continue with Google"}
      </Button>
    </div>
  )
}
