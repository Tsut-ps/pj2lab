// 1 ノート分の phonemes / lyrics を、最終的な出力単位へ解決する
// ここでは「明示 phonemes を優先する」「必要なら lyrics から推定する」という分岐を扱う
import { lyricToPhones } from "@/converterPhonemes"
import { getLastVowel } from "@/converter/phonemeUtils"
import type {
  ConversionOptions,
  ResolvedUnits,
  SvNote,
} from "@/converter/converterTypes"

export function resolveUnits(
  note: SvNote,
  options: ConversionOptions,
  noteIndex: number,
  previousVowel: string | null
): ResolvedUnits {
  const explicitUnits = splitExplicitUnits(note.phonemes)
  if (explicitUnits !== null) {
    return {
      units: explicitUnits,
      warnings: [],
      lastVowel: getLastVowel(explicitUnits),
    }
  }

  const lyric = note.lyrics?.trim() ?? ""
  if (!lyric) {
    return { units: [], warnings: [], lastVowel: null }
  }

  if (lyric === "br") {
    return { units: ["br"], warnings: [], lastVowel: null }
  }

  if (options.mode === "raw-lyrics") {
    return { units: [lyric], warnings: [], lastVowel: null }
  }

  // 単独の "-" ノートでも伸ばし棒を展開できるよう、前ノートの母音を引き継ぐ
  const inferred = lyricToPhones(lyric, options.expandLongVowel, previousVowel)
  return {
    units: inferred.units,
    warnings: inferred.warnings.map((message) => ({
      noteIndex,
      lyrics: lyric,
      message,
    })),
    lastVowel: inferred.lastVowel,
  }
}

function splitExplicitUnits(phonemes: string | undefined): string[] | null {
  const trimmed = phonemes?.trim() ?? ""

  if (!trimmed) {
    return null
  }

  // phonemes が明示されている場合は、基本的にその内容をそのまま使う
  return trimmed
    .split(/\s+/)
    .map((unit) => unit.trim())
    .filter(Boolean)
}
