import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { DocTab } from "./google-drive"

const MemorySchema = z.object({
  memories: z.array(
    z.object({
      content: z
        .string()
        .describe("The fact to be remembered, written clearly and concisely"),
      type: z.enum(["decision", "action_item", "opinion", "context", "entity"]),
      related_people: z
        .array(z.string())
        .describe("Canonical names of people mentioned, e.g. ['John Smith']"),
      related_projects: z
        .array(z.string())
        .describe(
          "Projects or initiatives mentioned, e.g. ['Database Migration']"
        ),
    })
  ),
  entities: z.array(
    z.object({
      name: z.string().describe("Normalized canonical name, e.g. 'John Smith'"),
      type: z.enum(["person", "project", "company", "other"]),
      aliases: z
        .array(z.string())
        .describe("Name variations found in the text"),
      source: z.string().describe("Source file name"),
    })
  ),
})

export type ExtractedMemories = z.infer<typeof MemorySchema>

export async function extractMemories(
  tabs: DocTab[],
  fileName: string
): Promise<ExtractedMemories> {
  const fullText = tabs
    .map((t) => `## ${t.title}\n\n${t.text}`)
    .join("\n\n---\n\n")

  const { output } = await generateText({
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5-nano"),
    output: Output.object({ schema: MemorySchema }),
    system: `You are a memory extractor for corporate meetings and documents.
Your goal is to identify what is worth remembering long-term.

Rules:
- Write each memory as a self-contained, standalone fact (no dangling pronouns)
- Normalize people's names to their full name whenever possible
- Capture decisions with their rationale when available
- Action items must include the responsible person and deadline if mentioned
- Opinions must be attributed to who expressed them
- Do not invent information not present in the text
- Ignore generic content that adds no future context`,
    prompt: `Extract memories and entities from the following document:\n\nFile: ${fileName}\n\n${fullText}`,
  })

  return output
}
