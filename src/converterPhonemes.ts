// lyrics から音素列を推定する処理をまとめる (解釈できない要素は warning 付きで残す)
import {
  DIGRAPH_MAP,
  MONOGRAPH_MAP,
  STRIPPABLE_PUNCTUATION,
} from "@/converter/phonemeMaps"
import { getLastVowel, katakanaToHiragana } from "@/converter/phonemeUtils"

export type PhoneInferenceResult = {
  units: string[]
  warnings: string[]
  lastVowel: string | null
}

export function lyricToPhones(
  rawLyric: string,
  expandLongVowel: boolean,
  previousVowel: string | null = null
): PhoneInferenceResult {
  const lyric = katakanaToHiragana(rawLyric).replace(STRIPPABLE_PUNCTUATION, "")
  const units: string[] = []
  const warnings: string[] = []
  let lastVowel = previousVowel
  let index = 0

  while (index < lyric.length) {
    const char = lyric[index]!
    const next = lyric[index + 1] ?? ""
    const pair = char + next

    // SynthV 準拠: 先頭の ' / ’ / ‘ は cl
    if (char === "'" || char === "’" || char === "‘") {
      units.push("cl")
      index += 1
      continue
    }

    if (char === "ー" || char === "-") {
      if (expandLongVowel && lastVowel) {
        units.push(lastVowel)
        index += 1
        continue
      }

      units.push(char)
      warnings.push(
        `長音記号 ${char} を展開できなかったため、そのまま出力しました。`
      )
      index += 1
      continue
    }

    if (char === "っ") {
      units.push("cl")
      index += 1
      continue
    }

    const digraph = DIGRAPH_MAP[pair]
    if (digraph) {
      units.push(...digraph)
      lastVowel = getLastVowel(digraph) ?? lastVowel
      index += 2
      continue
    }

    const monograph = MONOGRAPH_MAP[char]
    if (monograph) {
      units.push(...monograph)
      lastVowel = getLastVowel(monograph) ?? lastVowel
      index += 1
      continue
    }

    const latinToken = lyric.slice(index).match(/^[A-Za-z][A-Za-z0-9_-]*/)?.[0]
    if (latinToken) {
      // 英字トークンは無理に分解せず、そのまま warning 付きで残す
      units.push(latinToken)
      warnings.push(
        `推定モードで ${latinToken} は解釈できないため、そのまま出力しました。`
      )
      index += latinToken.length
      continue
    }

    units.push(char)
    warnings.push(`文字 ${char} を解釈できないため、そのまま出力しました。`)
    index += 1
  }

  return { units, warnings, lastVowel }
}
