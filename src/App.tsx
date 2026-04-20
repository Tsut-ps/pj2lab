import * as React from "react"
import { Download, FileAudio, RefreshCw } from "lucide-react"

import {
  convertSvpToLab,
  convertVprToLab,
  type ConversionMode,
  type ConversionOptions,
  type ConversionResult,
  type PhonemeOutputMode,
} from "@/converter"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { downloadTextFile } from "@/lib/download"
import { cn } from "@/lib/utils"

const DEFAULT_OUTPUT_BASENAME = "pj2lab"
const WARNING_PLACEHOLDER = "警告はありません"
const PREVIEW_PLACEHOLDER = "ここに変換済みの lab テキストが表示されます。"

const sourceMeta = {
  svp: {
    label: "Synthesizer V",
    fileExtension: ".svp",
    accept: ".svp,application/json",
  },
  vocaloid: {
    label: "VOCALOID",
    fileExtension: ".vpr",
    accept: ".vpr",
  },
} as const

type InputSource = "svp" | "vocaloid"

type FormState = {
  source: InputSource
  mode: ConversionMode
  expandLongVowel: boolean
  outputMode: PhonemeOutputMode
}

type ConversionViewState = {
  result: ConversionResult | null
  error: string | null
  baseName: string
  isDirty: boolean
}

const sourceOptions = [
  {
    value: "svp",
    title: "Synthesizer V",
    description: ".svp ファイルを読み込んで lab に変換します。",
    badge: "対応中",
  },
  {
    value: "vocaloid",
    title: "VOCALOID",
    description: ".vpr ファイルを読み込んで lab に変換します。",
    badge: "対応中",
  },
] satisfies Array<{
  value: InputSource
  title: string
  description: string
  badge: string
}>

const modeOptions = [
  {
    value: "inferred",
    title: "音素を推定する",
    description:
      "phonemes があれば優先し、なければ lyrics から日本語音素を推定します。",
  },
  {
    value: "raw-lyrics",
    title: "lyrics をそのまま出力",
    description:
      "ノートごとの lyrics をそのまま lab に出力します。確認用のモードです。",
  },
] satisfies Array<{
  value: ConversionMode
  title: string
  description: string
}>

const outputOptions = [
  {
    value: "split",
    title: "音素ごとに分割",
    description: "1 ノート内の音素を分割して時間配分します。",
  },
  {
    value: "combined",
    title: "ノート単位で結合",
    description: "1 ノートの音素列を 1 セグメントとして出力します。",
  },
] satisfies Array<{
  value: PhonemeOutputMode
  title: string
  description: string
}>

export function App() {
  const fileInputId = React.useId()
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [dragActive, setDragActive] = React.useState(false)
  const [isConverting, setIsConverting] = React.useState(false)
  const [isPending, startTransition] = React.useTransition()
  const [form, setForm] = React.useState<FormState>({
    source: "svp",
    mode: "inferred",
    expandLongVowel: true,
    outputMode: "split",
  })
  const [viewState, setViewState] = React.useState<ConversionViewState>({
    result: null,
    error: null,
    baseName: DEFAULT_OUTPUT_BASENAME,
    isDirty: false,
  })

  const isSourceSupported = form.source === "svp" || form.source === "vocaloid"
  const hasResult = Boolean(viewState.result?.labText)
  const isBusy = isConverting || isPending
  const canDownload = isSourceSupported && hasResult && !viewState.isDirty
  const currentSource = sourceMeta[form.source]
  const fileAccept = currentSource.accept
  const warningsText = viewState.result
    ? formatWarnings(viewState.result)
    : WARNING_PLACEHOLDER

  const stats = React.useMemo(
    () => [
      {
        label: "トラック数",
        value: viewState.result ? String(viewState.result.trackCount) : "—",
      },
      {
        label: "ノート数",
        value: viewState.result ? String(viewState.result.noteCount) : "—",
      },
      {
        label: "セグメント数",
        value: viewState.result ? String(viewState.result.segmentCount) : "—",
      },
      {
        label: "警告数",
        value: viewState.result ? String(viewState.result.warningCount) : "—",
      },
    ],
    [viewState.result]
  )

  const statusMessage = !isSourceSupported
    ? `${currentSource.label} 形式はまだ未対応です。`
    : !selectedFile
      ? `${currentSource.fileExtension} ファイルを選択してください。`
      : viewState.isDirty
        ? "設定を変更しました。再変換すると最新の結果に更新されます。"
        : hasResult
          ? "変換結果を確認してダウンロードできます。"
          : "変換を実行できます。"

  function markDirty() {
    setViewState((current) => ({
      ...current,
      error: null,
      isDirty: current.result ? true : current.isDirty,
    }))
  }

  function updateFormState<K extends keyof FormState>(key: K, value: FormState[K]) {
    if (key === "source" && form.source !== value) {
      // 入力形式を切り替えたら、選択済みファイルもリセットして取り違えを防ぐ。
      setSelectedFile(null)
      setViewState({
        result: null,
        error: null,
        baseName: DEFAULT_OUTPUT_BASENAME,
        isDirty: false,
      })
    }

    setForm((current) => ({
      ...current,
      [key]: value,
    }))
    markDirty()
  }

  function handleFileSelection(file: File | null) {
    setSelectedFile(file)
    setViewState({
      result: null,
      error: null,
      baseName: file ? stripExtension(file.name) : DEFAULT_OUTPUT_BASENAME,
      isDirty: false,
    })
  }

  async function handleConvert(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!isSourceSupported) {
      setViewState((current) => ({
        ...current,
        result: null,
        error: "この形式はまだ対応していません。",
        isDirty: false,
      }))
      return
    }

    if (!selectedFile) {
      setViewState((current) => ({
        ...current,
        result: null,
        error: `変換する ${currentSource.fileExtension} ファイルを選択してください。`,
        isDirty: false,
      }))
      return
    }

    setIsConverting(true)

    try {
      const options: ConversionOptions = {
        mode: form.mode,
        expandLongVowel: form.expandLongVowel,
        outputMode: form.outputMode,
      }
      const result =
        form.source === "vocaloid"
          ? convertVprToLab(await selectedFile.arrayBuffer(), options)
          : convertSvpToLab(await selectedFile.text(), options)

      startTransition(() => {
        setViewState({
          result,
          error: null,
          baseName: stripExtension(selectedFile.name),
          isDirty: false,
        })
      })
    } catch (error) {
      startTransition(() => {
        setViewState((current) => ({
          ...current,
          result: null,
          error: normalizeError(error),
          isDirty: false,
        }))
      })
    } finally {
      setIsConverting(false)
    }
  }

  function handleDownload() {
    if (!viewState.result?.labText) {
      return
    }

    downloadTextFile(
      viewState.result.labText,
      buildDownloadName(viewState.baseName, form.mode, form.outputMode)
    )
  }

  return (
    <div className="min-h-svh bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <header className="mb-8 border-b pb-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">pj2lab</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Synthesizer V の `.svp` と VOCALOID の `.vpr` を読み込み、LAB
              テキストへ変換します。`phonemes` 優先、lyrics 推定、警告表示、
              ダウンロードまでを 1 画面にまとめています。
            </p>
          </div>
        </header>

        <main className="grid gap-6">
          <form className="grid gap-4" onSubmit={handleConvert}>
            <Card>
              <CardHeader>
                <CardTitle>入力形式</CardTitle>
                <CardDescription>
                  プロジェクトファイルを選択します。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {sourceOptions.map((option) => (
                  <ChoiceCard
                    key={option.value}
                    checked={form.source === option.value}
                    title={option.title}
                    description={option.description}
                    badge={option.badge}
                    badgeVariant="secondary"
                    onClick={() => {
                      updateFormState("source", option.value)
                    }}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>ファイル</CardTitle>
                <CardDescription>
                  ドラッグ&ドロップ、またはクリックしてファイルを選択します。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <input
                  id={fileInputId}
                  type="file"
                  accept={fileAccept}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0] ?? null
                    handleFileSelection(file)
                    event.currentTarget.value = ""
                  }}
                />
                <Label
                  htmlFor={fileInputId}
                  className={cn(
                    "grid min-h-40 place-items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-muted/50",
                    dragActive && "border-primary bg-muted/60"
                  )}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault()
                    setDragActive(false)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragActive(false)
                    handleFileSelection(event.dataTransfer.files?.[0] ?? null)
                  }}
                >
                  <FileAudio className="size-8 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium">
                      {selectedFile
                        ? "ファイルを選択済みです"
                        : `ここに ${currentSource.fileExtension} ファイルをドロップ`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedFile
                        ? `${selectedFile.name} ・ ${formatBytes(selectedFile.size)}`
                        : "またはクリックして選択します。"}
                    </p>
                  </div>
                </Label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>変換設定</CardTitle>
                <CardDescription>
                  必要な設定だけをまとめています。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3">
                  <Label>変換モード</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {modeOptions.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        checked={form.mode === option.value}
                        title={option.title}
                        description={option.description}
                        onClick={() => {
                          updateFormState("mode", option.value)
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <Label>追加オプション</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      aria-pressed={form.expandLongVowel}
                      className={cn(
                        "flex items-start justify-between gap-4 rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary/30",
                        form.expandLongVowel &&
                          "border-primary bg-primary/8 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]"
                      )}
                      onClick={() => {
                        updateFormState(
                          "expandLongVowel",
                          !form.expandLongVowel
                        )
                      }}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">長音記号を前の母音で展開</p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          `ー` や `-` を前ノートの母音へ寄せて推定します。
                        </p>
                      </div>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full border transition-colors",
                          form.expandLongVowel
                            ? "border-primary/50 bg-primary"
                            : "border-border bg-muted"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block size-4 rounded-full bg-background shadow-sm transition-transform",
                            form.expandLongVowel
                              ? "translate-x-6"
                              : "translate-x-1"
                          )}
                        />
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label>音素の出力単位</Label>
                    <p className="text-sm leading-6 text-muted-foreground">
                      推定モードでのみ有効です。
                    </p>
                  </div>
                  <div
                    className={cn(
                      "grid gap-3 sm:grid-cols-2",
                      form.mode === "raw-lyrics" &&
                        "pointer-events-none opacity-50"
                    )}
                  >
                    {outputOptions.map((option) => (
                      <ChoiceCard
                        key={option.value}
                        checked={form.outputMode === option.value}
                        title={option.title}
                        description={option.description}
                        onClick={() => {
                          updateFormState("outputMode", option.value)
                        }}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>実行</CardTitle>
                <CardDescription>{statusMessage}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  size="lg"
                  className="px-4 text-base"
                  disabled={!isSourceSupported || !selectedFile || isBusy}
                >
                  <RefreshCw
                    className={cn("size-4", isBusy && "animate-spin")}
                  />
                  {isBusy ? "変換中..." : "変換する"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="px-4 text-base"
                  disabled={!canDownload}
                  onClick={handleDownload}
                >
                  <Download className="size-4" />
                  ダウンロード
                </Button>
              </CardContent>
            </Card>
          </form>

          <section className="grid gap-4">
            {viewState.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {viewState.error}
              </div>
            ) : null}

            {viewState.isDirty ? (
              <div className="rounded-md border border-amber-900 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
                現在の結果は古い設定で生成されています。再変換すると最新の設定が反映されます。
              </div>
            ) : null}

            <div
              className={cn(
                "grid gap-4 transition-opacity",
                (viewState.isDirty || !viewState.result) && "opacity-50"
              )}
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {stats.map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {stat.value}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>lab プレビュー</CardTitle>
                      <CardDescription>
                        変換後のテキストを確認できます。
                      </CardDescription>
                    </div>
                    <Badge variant="outline">
                      {form.mode === "raw-lyrics" ? "歌詞そのまま" : "音素推定"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={viewState.result?.labText ?? ""}
                    readOnly
                    placeholder={PREVIEW_PLACEHOLDER}
                    className="min-h-[22rem] resize-y font-mono text-xs leading-6"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>警告</CardTitle>
                  <CardDescription>
                    解釈できなかった文字や推定時の注意点を表示します。
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="text-sm leading-6 text-muted-foreground">
                    `phonemes` があるノートはその内容を優先し、`rap`
                    ノートは変換対象から除外します。
                  </div>
                  <Textarea
                    value={warningsText}
                    readOnly
                    className="min-h-60 resize-y font-mono text-xs leading-6"
                  />
                </CardContent>
              </Card>
            </div>
          </section>
        </main>

        <footer className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground/70">
          <p>
            © Tsut-ps. Deployed with{" "}
            <a
              href="https://github.com/Tsut-ps/pj2lab-vite"
              target="_blank"
              rel="noreferrer"
              className="underline-offset-4 hover:text-foreground hover:underline"
            >
              GitHub
            </a>
            .
          </p>
        </footer>
      </div>
    </div>
  )
}

type ChoiceCardProps = {
  checked: boolean
  title: string
  description: string
  badge?: string
  badgeVariant?: "default" | "secondary" | "outline" | "warning"
  onClick: () => void
}

function ChoiceCard({
  checked,
  title,
  description,
  badge,
  badgeVariant = "secondary",
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      className={cn(
        "rounded-lg border px-4 py-3 text-left transition-colors hover:border-primary/30",
        checked &&
          "border-primary bg-primary/8 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-start gap-2">
          {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 inline-flex size-4 shrink-0 rounded-full border transition-colors",
              checked
                ? "border-primary bg-primary"
                : "border-border bg-background"
            )}
          />
        </div>
      </div>
    </button>
  )
}

function formatWarnings(result: ConversionResult) {
  if (result.warnings.length === 0) {
    return WARNING_PLACEHOLDER
  }

  return result.warnings
    .map((warning) => `#${warning.noteIndex} [${warning.lyrics}] ${warning.message}`)
    .join("\n")
}

function buildDownloadName(
  baseName: string,
  mode: ConversionMode,
  outputMode: PhonemeOutputMode
) {
  const modeSuffix = mode === "raw-lyrics" ? "_raw_lyrics" : "_inferred"
  const outputSuffix = outputMode === "split" ? "_split" : "_combined"
  return `${baseName}${modeSuffix}${outputSuffix}.lab`
}

function stripExtension(filename: string) {
  return filename.replace(/\.[^.]+$/, "")
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return "変換中に不明なエラーが発生しました。"
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B"
  }

  const units = ["B", "KB", "MB", "GB"]
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1
  )
  const value = bytes / 1024 ** exponent

  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`
}

export default App
