// 音素列を、開始・終了時刻付きの LAB セグメントへ変換する
// ノート長を各単位へ割り振り、最終的に LAB 形式のテキストへ整形する
import {
  LAB_UNIT_PER_SECOND,
  buildTempoMap,
  positionToSeconds,
} from "@/converterTiming"
import type {
  LabSegment,
  PhonemeOutputMode,
  SvNote,
} from "@/converter/converterTypes"

export function createSegmentsForNote(
  note: SvNote,
  units: string[],
  tempoMap: ReturnType<typeof buildTempoMap>,
  outputMode: PhonemeOutputMode
) {
  const outUnits = toOutputUnits(units, outputMode)

  if (outUnits.length === 0) {
    return []
  }

  const startSec = positionToSeconds(note.onset, tempoMap)
  const endSec = positionToSeconds(note.onset + note.duration, tempoMap)
  const noteSec = Math.max(0, endSec - startSec)

  if (noteSec <= 0) {
    return []
  }

  const durations = splitDurations(outUnits.length, noteSec, note.attributes?.dur)
  const segments: LabSegment[] = []
  let cursor = startSec

  for (const [index, unit] of outUnits.entries()) {
    const duration = durations[index] ?? 0
    const segStartSec = cursor
    const segEndSec = index === outUnits.length - 1 ? endSec : cursor + duration
    cursor = segEndSec

    const start = Math.round(segStartSec * LAB_UNIT_PER_SECOND)
    const end = Math.round(segEndSec * LAB_UNIT_PER_SECOND)

    if (end <= start) {
      continue
    }

    // LAB は整数時間単位なので、各セグメントごとに丸めて出力する
    segments.push({ start, end, phone: unit })
  }

  return segments
}

function toOutputUnits(units: string[], outputMode: PhonemeOutputMode) {
  if (outputMode === "split" || units.length <= 1) {
    return units
  }

  // br は休符なので他の音素と連結しない
  if (units.includes("br")) {
    return units
  }

  return [units.join("")]
}

export function buildLabText(segments: LabSegment[]) {
  // 念のため時間順に並べてから、最終的な 1 本の文字列へ整形する
  return segments
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((segment) => `${segment.start} ${segment.end} ${segment.phone}`)
    .join("\n")
}

function splitDurations(
  unitCount: number,
  noteLengthSeconds: number,
  weights?: number[]
) {
  if (unitCount <= 0) {
    return []
  }

  const normalizedWeights = normalizeDurationWeights(unitCount, weights)

  if (normalizedWeights) {
    const totalWeight = normalizedWeights.reduce((sum, weight) => sum + weight, 0)
    return normalizedWeights.map(
      (weight) => (noteLengthSeconds * weight) / totalWeight
    )
  }

  const evenDuration = noteLengthSeconds / unitCount
  return Array.from({ length: unitCount }, () => evenDuration)
}

function normalizeDurationWeights(unitCount: number, weights?: number[]) {
  if (!weights || weights.length === 0) {
    return null
  }

  return Array.from({ length: unitCount }, (_, index) => {
    const weight = weights[index]

    // dur 未指定ぶんは SynthV の既定値 100% とみなす。
    if (!Number.isFinite(weight) || weight <= 0) {
      return 1
    }

    return weight
  })
}
