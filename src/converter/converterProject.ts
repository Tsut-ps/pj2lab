// SVP 全体の読み込みと、変換対象ノートの抽出を担当する
import type { TempoEvent } from "@/converterTiming"
import type { SvTrack, SvpProject } from "@/converter/converterTypes"

export const DEFAULT_TEMPO_EVENTS: TempoEvent[] = [{ position: 0, bpm: 120 }]

export function parseProject(text: string): SvpProject {
  // 末尾に残るヌル文字を取り除いてから JSON として読む
  let endIndex = text.length

  while (endIndex > 0 && text.charCodeAt(endIndex - 1) === 0) {
    endIndex -= 1
  }

  const cleaned = text.slice(0, endIndex).trim()
  return JSON.parse(cleaned) as SvpProject
}

export function collectConvertibleNotes(tracks: SvTrack[]) {
  return tracks
    .flatMap((track) => track.mainGroup?.notes ?? [])
    .filter((note) => note.musicalType !== "rap")
    .sort((a, b) => a.onset - b.onset)
}
