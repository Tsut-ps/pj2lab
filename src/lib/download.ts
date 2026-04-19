// 文字列を一時的な Blob にして、そのままダウンロードさせる
export function downloadTextFile(contents: string, filename: string) {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
