// Synthesizer V の位置情報を秒へ変換するための補助
const QUARTER_NOTE_UNITS = 705_600_000
export const LAB_UNIT_PER_SECOND = 10_000_000

export type TempoEvent = {
  position: number
  bpm: number
}

export type TempoPoint = TempoEvent & {
  secondsAtPosition: number
}

export function buildTempoMap(events: TempoEvent[]) {
  const sorted = [...events]
    .filter(
      (event) =>
        Number.isFinite(event.position) &&
        Number.isFinite(event.bpm) &&
        event.bpm > 0
    )
    .sort((a, b) => a.position - b.position)

  if (sorted.length === 0 || sorted[0]?.position !== 0) {
    sorted.unshift({ position: 0, bpm: 120 })
  }

  const tempoMap: TempoPoint[] = []

  for (const [index, event] of sorted.entries()) {
    if (index === 0) {
      tempoMap.push({ ...event, secondsAtPosition: 0 })
      continue
    }

    const previousEvent = sorted[index - 1]!
    const previousPoint = tempoMap[index - 1]!
    const deltaQuarter =
      (event.position - previousEvent.position) / QUARTER_NOTE_UNITS
    const deltaSeconds = deltaQuarter * (60 / previousEvent.bpm)

    tempoMap.push({
      ...event,
      secondsAtPosition: previousPoint.secondsAtPosition + deltaSeconds,
    })
  }

  return tempoMap
}

export function positionToSeconds(position: number, tempoMap: TempoPoint[]) {
  // 指定位置以前で最後に有効なテンポイベントを使う
  let activePoint = tempoMap[0]!

  for (const point of tempoMap) {
    if (point.position > position) {
      break
    }
    activePoint = point
  }

  const deltaQuarter = (position - activePoint.position) / QUARTER_NOTE_UNITS
  return activePoint.secondsAtPosition + deltaQuarter * (60 / activePoint.bpm)
}
