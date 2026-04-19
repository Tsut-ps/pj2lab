// 変換まわりで共有する型定義を集約する
import type { TempoEvent } from "@/converterTiming"

export type SvNote = {
  onset: number
  duration: number
  lyrics?: string
  phonemes?: string
  musicalType?: string
  attributes?: {
    dur?: number[]
  }
}

export type SvGroup = {
  notes?: SvNote[]
}

export type SvTrack = {
  name?: string
  mainGroup?: SvGroup
}

export type SvpProject = {
  time?: {
    tempo?: TempoEvent[]
  }
  tracks?: SvTrack[]
}

export type LabSegment = {
  start: number
  end: number
  phone: string
}

export type ConversionMode = "inferred" | "raw-lyrics"
export type PhonemeOutputMode = "split" | "combined"

export type ConversionOptions = {
  mode: ConversionMode
  expandLongVowel: boolean
  outputMode: PhonemeOutputMode
}

export type ConversionWarning = {
  noteIndex: number
  lyrics: string
  message: string
}

export type ConversionResult = {
  labText: string
  noteCount: number
  segmentCount: number
  trackCount: number
  warningCount: number
  warnings: ConversionWarning[]
}

export type ResolvedUnits = {
  units: string[]
  warnings: ConversionWarning[]
  lastVowel: string | null
}
