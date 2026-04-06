import { Suspense } from "react"
import type { Metadata } from "next"
import { getServerSession } from "@/lib/session"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getDecisions,
  getActionItems,
  getEntities,
  getProcessedDocs,
  type MemoryItem,
} from "@/lib/insights"

export const metadata: Metadata = { title: "Dashboard" }

function SectionHeader({
  title,
  subtitle,
}: {
  title: string
  subtitle?: string
}) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
    </div>
  )
}

function MemoryCard({ item }: { item: MemoryItem }) {
  const date = item.created_at
    ? new Date(item.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
      <p className="text-sm leading-relaxed">{item.memory}</p>
      <div className="flex flex-wrap items-center gap-3">
        {item.source && (
          <span className="max-w-50 truncate text-xs text-muted-foreground">
            {item.source}
          </span>
        )}
        {item.categories && item.categories.length > 0 && (
          <div className="flex gap-1">
            {item.categories.slice(0, 2).map((c) => (
              <span
                key={c}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        {date && (
          <span className="ml-auto text-xs text-muted-foreground">{date}</span>
        )}
      </div>
    </div>
  )
}

function SkeletonSection({
  title,
  count = 3,
}: {
  title: string
  count?: number
}) {
  return (
    <>
      <SectionHeader title={title} />
      <div className="flex flex-col gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}

async function Decisions({ userId }: { userId: string }) {
  const items = await getDecisions(userId)
  return (
    <section>
      <SectionHeader
        title="Recent Decisions"
        subtitle="Key decisions extracted from your documents"
      />
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState message="No decisions found yet. Process some documents to get started." />
        ) : (
          items.map((item) => <MemoryCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  )
}

async function ActionItems({ userId }: { userId: string }) {
  const items = await getActionItems(userId)
  return (
    <section>
      <SectionHeader
        title="Action Items"
        subtitle="Tasks and pending items identified from meetings"
      />
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState message="No action items found yet." />
        ) : (
          items.map((item) => <MemoryCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  )
}

async function Entities({ userId }: { userId: string }) {
  const items = await getEntities(userId)
  return (
    <section>
      <SectionHeader
        title="Named Entities"
        subtitle="People, projects and companies identified across your documents"
      />
      <div className="flex flex-col gap-2">
        {items.length === 0 ? (
          <EmptyState message="No entities identified yet." />
        ) : (
          items.map((item) => <MemoryCard key={item.id} item={item} />)
        )}
      </div>
    </section>
  )
}

async function ProcessedDocs({ userId }: { userId: string }) {
  const docs = await getProcessedDocs(userId)
  return (
    <section>
      <SectionHeader
        title="Processed Documents"
        subtitle="Files already ingested into memory"
      />
      <div className="flex flex-col gap-2">
        {docs.length === 0 ? (
          <EmptyState message="No documents processed yet. Connect Google Drive and set a monitored folder." />
        ) : (
          docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3"
            >
              <span className="max-w-[60%] truncate text-sm">
                {doc.title ?? "Untitled"}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{doc.mem0Ids.length} memories</span>
                <span>
                  {new Date(doc.processedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

export default async function Page() {
  const session = await getServerSession()

  if (!session) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Please sign in to view your insights.
        </p>
      </div>
    )
  }

  const userId = session.user.id

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Insights from your documents and meetings.
        </p>
      </div>

      <Suspense fallback={<SkeletonSection title="Recent Decisions" />}>
        <Decisions userId={userId} />
      </Suspense>

      <Suspense fallback={<SkeletonSection title="Action Items" />}>
        <ActionItems userId={userId} />
      </Suspense>

      <Suspense fallback={<SkeletonSection title="Named Entities" count={2} />}>
        <Entities userId={userId} />
      </Suspense>

      <Suspense
        fallback={<SkeletonSection title="Processed Documents" count={2} />}
      >
        <ProcessedDocs userId={userId} />
      </Suspense>
    </div>
  )
}
