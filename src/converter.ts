// svp を lab へ変換する
import { buildTempoMap } from "@/converterTiming"
import {
  collectConvertibleNotes,
  DEFAULT_TEMPO_EVENTS,
  parseProject,
  parseVprProject,
} from "@/converter/converterProject"
import { buildLabText, createSegmentsForNote } from "@/converter/converterSegments"
import type {
  ConversionOptions,
  ConversionResult,
  ConversionWarning,
  LabSegment,
} from "@/converter/converterTypes"
import { resolveUnits } from "@/converter/converterUnits"

export type {
  ConversionMode,
  ConversionOptions,
  ConversionResult,
  ConversionWarning,
  PhonemeOutputMode,
} from "@/converter/converterTypes"

export function convertSvpToLab(
  text: string,
  options: ConversionOptions
): ConversionResult {
  const project = parseProject(text)
  return convertProjectToLab(project, options)
}

export function convertVprToLab(
  buffer: ArrayBuffer,
  options: ConversionOptions
): ConversionResult {
  const project = parseVprProject(buffer)
  return convertProjectToLab(project, options)
}

function convertProjectToLab(
  project: ReturnType<typeof parseProject>,
  options: ConversionOptions
) {
  const tracks = project.tracks ?? []
  const notes = collectConvertibleNotes(tracks)
  const tempoMap = buildTempoMap(project.time?.tempo ?? DEFAULT_TEMPO_EVENTS)
  const warnings: ConversionWarning[] = []
  const segments: LabSegment[] = []
  let previousVowel: string | null = null

  for (const [noteIndex, note] of notes.entries()) {
    const resolved = resolveUnits(note, options, noteIndex + 1, previousVowel)
    warnings.push(...resolved.warnings)
    segments.push(
      ...createSegmentsForNote(note, resolved.units, tempoMap, options.outputMode)
    )

    // 長音記号: 前のノートで最後に出た母音を次のノートでも使うため
    previousVowel = resolved.lastVowel ?? previousVowel
  }

  return {
    labText: buildLabText(segments),
    noteCount: notes.length,
    segmentCount: segments.length,
    trackCount: tracks.length,
    warningCount: warnings.length,
    warnings,
  }
}
