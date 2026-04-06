import { google } from "googleapis"
import { createGoogleAuth } from "./google-drive"

function getMeetClient(accessToken: string) {
  return google.meet({ version: "v2", auth: createGoogleAuth(accessToken) })
}

export type ConferenceRecord = {
  name: string
  startTime: string | null
  endTime: string | null
  spaceId: string | null
}

export type TranscriptWithDoc = {
  transcriptName: string
  state: string
  docsFileId: string | null
}

export type TranscriptEntry = {
  participant: string
  text: string
  startTime: string | null
  endTime: string | null
  languageCode: string | null
}

export async function listConferenceRecords(
  accessToken: string,
  options?: { filter?: string }
): Promise<ConferenceRecord[]> {
  const meet = getMeetClient(accessToken)
  const records: ConferenceRecord[] = []
  let pageToken: string | undefined

  do {
    const res = await meet.conferenceRecords.list({
      pageSize: 100,
      pageToken,
      filter: options?.filter,
    })

    for (const r of res.data.conferenceRecords ?? []) {
      records.push({
        name: r.name!,
        startTime: r.startTime ?? null,
        endTime: r.endTime ?? null,
        spaceId: r.space ?? null,
      })
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  return records
}

export async function listTranscriptsWithDoc(
  accessToken: string,
  conferenceRecordName: string
): Promise<TranscriptWithDoc[]> {
  const meet = getMeetClient(accessToken)

  const res = await meet.conferenceRecords.transcripts.list({
    parent: conferenceRecordName,
  })

  return (res.data.transcripts ?? []).map((t) => ({
    transcriptName: t.name!,
    state: t.state ?? "STATE_UNSPECIFIED",
    docsFileId: t.docsDestination?.document ?? null,
  }))
}

async function* iterTranscriptEntries(
  accessToken: string,
  transcriptName: string
): AsyncGenerator<TranscriptEntry> {
  const meet = getMeetClient(accessToken)
  let pageToken: string | undefined

  do {
    const res = await meet.conferenceRecords.transcripts.entries.list({
      parent: transcriptName,
      pageSize: 100,
      pageToken,
    })

    for (const e of res.data.transcriptEntries ?? []) {
      yield {
        participant: e.participant ?? "",
        text: e.text ?? "",
        startTime: e.startTime ?? null,
        endTime: e.endTime ?? null,
        languageCode: e.languageCode ?? null,
      }
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)
}

export async function resolveParticipant(
  accessToken: string,
  participantName: string
): Promise<string | null> {
  const meet = getMeetClient(accessToken)

  try {
    const res = await meet.conferenceRecords.participants.get({
      name: participantName,
    })
    return (
      res.data.signedinUser?.displayName ??
      res.data.anonymousUser?.displayName ??
      null
    )
  } catch {
    return null
  }
}

export async function buildFormattedTranscript(
  accessToken: string,
  transcriptName: string
): Promise<string> {
  const nameMap = new Map<string, string>()
  const lines: string[] = []

  for await (const e of iterTranscriptEntries(accessToken, transcriptName)) {
    if (e.participant && !nameMap.has(e.participant)) {
      const name = await resolveParticipant(accessToken, e.participant)
      nameMap.set(e.participant, name ?? "Unknown")
    }

    const speaker = nameMap.get(e.participant) ?? "Unknown"
    const time = e.startTime ? new Date(e.startTime).toISOString() : ""
    lines.push(`[${time}] ${speaker}: ${e.text}`)
  }

  return lines.join("\n")
}
