import { generateText, Output } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import type { DocTab } from "./google-drive"

const MemorySchema = z.object({
  participants: z
    .array(z.string())
    .describe(
      "All people identified as meeting participants, with canonical names"
    ),
  memories: z.array(
    z.object({
      content: z
        .string()
        .describe(
          "The fact to be remembered, written clearly and concisely, with full names (no pronouns)"
        ),
      type: z.enum(["decision", "action_item", "opinion", "context"]),
      related_people: z
        .array(z.string())
        .describe("Canonical names of people mentioned"),
      related_projects: z
        .array(z.string())
        .describe("Projects or products mentioned"),
    })
  ),
  entities: z.array(
    z.object({
      name: z.string().describe("Normalized canonical name"),
      type: z.enum([
        "person",
        "project",
        "product",
        "company",
        "tool",
        "other",
      ]),
      aliases: z
        .array(z.string())
        .describe(
          "All name variations found in the text (nicknames, abbreviations, first name only)"
        ),
      description: z
        .string()
        .describe("One-line description of this entity based on the document"),
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
    model: openai(process.env.OPENAI_MODEL ?? "gpt-5.4-nano"),
    output: Output.object({ schema: MemorySchema }),
    system: `You are a memory extractor for corporate meeting transcripts and documents.
Your goal is to identify what is worth remembering long-term, with full context.

ENTITY EXTRACTION RULES:
- Extract ALL named entities: people, projects, products, companies, tools — even if mentioned briefly
- For people: look for participant lists, speaker labels, attendee sections, and any name mentions in the text to build the full roster. The file name may also contain names (e.g. "Person A <> Person B" format), use it as a hint but prioritize the document content.
- Resolve first names, nicknames, and abbreviations to full names whenever the document provides enough context to do so
- For each person, list ALL name variations found in the document as aliases (e.g. canonical "Alexandre Silva", aliases: ["Alexandre", "Ale", "Alex"])
- For projects/products: use the exact name as written; mark type as "project", "product", or "company" accordingly
- Populate "participants" with canonical names of all people who actively participated in the meeting

MEMORY EXTRACTION RULES:
- Write each memory as a self-contained, standalone fact — use full names, never pronouns or "they/he/she"
- Include WHO said or decided something whenever known
- decisions: "X decided to Y because Z" — always include rationale when available
- action_items: "X will do Y by Z" — always include responsible person, task, and deadline if mentioned
- opinions: "X believes/thinks Y" — always attribute to the person
- context: background facts that give meaning to future references
- Do not invent information not present in the text
- Skip greetings, filler, generic status updates with no concrete content`,
    prompt: `Extract memories and entities from the following meeting document:

File: ${fileName}

${fullText}`,
  })

  return output
}
