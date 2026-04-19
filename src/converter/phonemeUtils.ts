// 音素推定で使う小さな補助関数をまとめる
import { VOWELS } from "@/converter/phonemeMaps"

export function getLastVowel(units: string[]) {
  // 後ろから見て最初に見つかった母音を返す
  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index]!
    if (VOWELS.has(unit)) {
      return unit
    }
  }

  return null
}

export function katakanaToHiragana(text: string) {
  // カタカナをひらがなへ寄せて、辞書テーブルを 1 系統で扱う
  return text.replace(/[ァ-ヶ]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0x60)
  )
}
