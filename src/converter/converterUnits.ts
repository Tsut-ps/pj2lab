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
  const lyric = note.lyrics?.trim() ?? ""
  if (options.mode === "raw-lyrics") {
    if (lyric) {
      if (lyric === "br") {
        return { units: ["br"], warnings: [], lastVowel: null }
      }

      const resolvedLyric = resolveRawLyricUnit(
        lyric,
        options.expandLongVowel,
        previousVowel
      )

      return {
        units: [resolvedLyric.unit],
        warnings: [],
        lastVowel: resolvedLyric.lastVowel,
      }
    }

    const explicitUnits = splitExplicitUnits(note.phonemes)
    if (explicitUnits !== null) {
      return { units: [explicitUnits.join(" ")], warnings: [], lastVowel: null }
    }

    return { units: [], warnings: [], lastVowel: null }
  }

  const explicitUnits = splitExplicitUnits(note.phonemes)
  if (explicitUnits !== null) {
    return {
      units: explicitUnits,
      warnings: [],
      lastVowel: getLastVowel(explicitUnits),
    }
  }

  if (!lyric) {
    return { units: [], warnings: [], lastVowel: null }
  }

  if (lyric === "br") {
    return { units: ["br"], warnings: [], lastVowel: null }
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

const PHONE_TO_LYRIC_VOWEL: Record<string, string> = {
  a: "あ",
  i: "い",
  u: "う",
  e: "え",
  o: "お",
  N: "ん",
}

function resolveRawLyricUnit(
  lyric: string,
  expandLongVowel: boolean,
  previousVowel: string | null
) {
  if (!expandLongVowel) {
    return {
      unit: lyric,
      lastVowel: inferRawLyricVowel(lyric, previousVowel),
    }
  }

  let expanded = ""
  let currentVowel = previousVowel

  for (const char of lyric) {
    if ((char === "ー" || char === "-") && currentVowel) {
      expanded += currentVowel
    } else {
      expanded += char
    }

    currentVowel = inferRawLyricVowel(expanded, previousVowel) ?? currentVowel
  }

  return {
    unit: expanded,
    lastVowel: currentVowel,
  }
}

function inferRawLyricVowel(lyric: string, previousVowel: string | null) {
  const previousPhone = previousVowel ? lyricVowelToPhone(previousVowel) : null
  const inferred = lyricToPhones(lyric, false, previousPhone)

  if (!inferred.lastVowel) {
    return null
  }

  return PHONE_TO_LYRIC_VOWEL[inferred.lastVowel] ?? null
}

function lyricVowelToPhone(vowel: string) {
  const match = Object.entries(PHONE_TO_LYRIC_VOWEL).find(
    ([, lyricVowel]) => lyricVowel === vowel
  )

  return match?.[0] ?? null
}
