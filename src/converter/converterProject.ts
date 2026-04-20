// SVP / VPR を読み込み、変換しやすい共通形へそろえる
import type { TempoEvent } from "@/converterTiming"
import type { SvNote, SvTrack, SvpProject } from "@/converter/converterTypes"

export const DEFAULT_TEMPO_EVENTS: TempoEvent[] = [{ position: 0, bpm: 120 }]

const QUARTER_NOTE_UNITS = 705_600_000
const VPR_TICKS_PER_QUARTER = 480
const VPR_POSITION_SCALE = QUARTER_NOTE_UNITS / VPR_TICKS_PER_QUARTER

type VprSequence = {
  masterTrack?: {
    tempo?: {
      events?: VprTempoEvent[]
    }
  }
  tracks?: VprTrack[]
}

type VprTempoEvent = {
  pos: number
  value: number
}

type VprTrack = {
  type?: number
  name?: string
  parts?: VprPart[]
}

type VprPart = {
  pos?: number
  notes?: VprNote[]
}

type VprNote = {
  pos?: number
  duration?: number
  lyric?: string
  phoneme?: string
}

export function parseProject(text: string): SvpProject {
  let endIndex = text.length

  while (endIndex > 0 && text.charCodeAt(endIndex - 1) === 0) {
    endIndex -= 1
  }

  const cleaned = text.slice(0, endIndex).trim()
  return JSON.parse(cleaned) as SvpProject
}

export function parseVprProject(buffer: ArrayBuffer): SvpProject {
  const sequenceEntry = extractZipEntry(buffer, "Project/sequence.json")

  if (!sequenceEntry) {
    throw new Error("VPR から Project/sequence.json を見つけられませんでした。")
  }

  const sequence = JSON.parse(new TextDecoder().decode(sequenceEntry)) as VprSequence

  return {
    time: {
      tempo:
        sequence.masterTrack?.tempo?.events
          ?.map((event) => toTempoEvent(event))
          .filter((event): event is TempoEvent => event !== null) ?? [],
    },
    tracks:
      sequence.tracks
        ?.filter((track) => track.type === 0 || track.type === undefined)
        .map((track) => ({
          name: track.name,
          mainGroup: {
            notes:
              track.parts
                ?.flatMap((part) => normalizePartNotes(part))
                .filter((note): note is SvNote => note !== null) ?? [],
          },
        }))
        .filter((track) => (track.mainGroup?.notes?.length ?? 0) > 0) ?? [],
  }
}

export function collectConvertibleNotes(tracks: SvTrack[]) {
  return tracks
    .flatMap((track) => track.mainGroup?.notes ?? [])
    .filter((note) => note.musicalType !== "rap")
    .sort((a, b) => a.onset - b.onset)
}

function toTempoEvent(event: VprTempoEvent): TempoEvent | null {
  if (!Number.isFinite(event.pos) || !Number.isFinite(event.value) || event.value <= 0) {
    return null
  }

  return {
    position: scaleVprPosition(event.pos),
    bpm: event.value / 100,
  }
}

function normalizePartNotes(part: VprPart) {
  const partOffset = Number.isFinite(part.pos) ? (part.pos ?? 0) : 0
  return (part.notes ?? []).map((note) => normalizeVprNote(note, partOffset))
}

function normalizeVprNote(note: VprNote, partOffset: number): SvNote | null {
  const onsetTicks = Number.isFinite(note.pos) ? (note.pos ?? 0) : 0
  const durationTicks = Number.isFinite(note.duration) ? (note.duration ?? 0) : 0
  const phonemes = note.phoneme?.trim()

  if (durationTicks <= 0 || isSilentVprPhoneme(phonemes)) {
    return null
  }

  return {
    onset: scaleVprPosition(partOffset + onsetTicks),
    duration: scaleVprPosition(durationTicks),
    lyrics: note.lyric?.trim(),
    phonemes,
  }
}

function isSilentVprPhoneme(phoneme: string | undefined) {
  if (!phoneme) {
    return false
  }

  const normalized = phoneme.trim().toLowerCase()
  return normalized === "sil" || normalized === "pau"
}

function scaleVprPosition(position: number) {
  return Math.round(position * VPR_POSITION_SCALE)
}

function extractZipEntry(buffer: ArrayBuffer, targetPath: string) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const decoder = new TextDecoder()
  let offset = 0

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true)

    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break
    }

    if (signature !== 0x04034b50) {
      throw new Error("VPR ZIP の読み取りに失敗しました。")
    }

    const flags = view.getUint16(offset + 6, true)
    const compressionMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraFieldLength = view.getUint16(offset + 28, true)
    const fileNameStart = offset + 30
    const fileNameEnd = fileNameStart + fileNameLength
    const dataStart = fileNameEnd + extraFieldLength
    const dataEnd = dataStart + compressedSize
    const fileName = decoder.decode(bytes.subarray(fileNameStart, fileNameEnd))

    if ((flags & 0x0008) !== 0) {
      throw new Error("サイズ後書き形式の VPR にはまだ対応していません。")
    }

    if (compressionMethod !== 0) {
      throw new Error(
        "圧縮された VPR にはまだ対応していません。無圧縮の VPR を使用してください。"
      )
    }

    if (fileName === targetPath) {
      return bytes.slice(dataStart, dataEnd)
    }

    offset = dataEnd
  }

  return null
}
