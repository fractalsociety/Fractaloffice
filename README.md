# Fractal Office

An AI-native office suite for macOS and Windows: word processor, spreadsheet,
presentations, and PDF. Its AI editing tools run through the locally installed,
locally authenticated OpenAI Codex CLI.

This fork removes the upstream hosted account, proxy endpoints, bundled AI
CLI, cloud slide generator, and private update feed. It does not require an
OpenAI API key and does not route model calls through an office vendor server.

## Apps

| App           | Product                   | What it is                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/docs`   | **Fractal Office Docs**   | `.docx` word processor. Byte-preserving round trip: only dirty paragraphs are regenerated (paragraph patch), everything else in the original file is kept byte-for-byte, so opening and saving never breaks layout in Word. Paginated view whose line metrics reproduce the original document's layout, tracked changes, comments, styles, equations, ink. |
| `apps/sheets` | **Fractal Office Sheets** | `.xlsx` spreadsheet. UI built on the open-source [Univer](https://github.com/dream-num/univer) core (Apache-2.0) with a large layer of in-house extensions; xlsx import/export runs through an in-house Rust sidecar (calamine + IronCalc), charts are rendered in-house (Konva), plus pivot tables, slicers, conditional formatting, and formula tracing. |
| `apps/slides` | **Fractal Office Slides** | `.pptx` presentations. In-house pptx parse/render/edit engine with masters, charts, cropping, ink, and text shaping (HarfBuzz metrics).                                                                                                                                                                                                                    |
| `apps/pdf`    | **Fractal Office PDF**    | PDF viewer/editor on pdf.js + pdf-lib: annotations, forms, outlines, stamps, signatures, page operations, print.                                                                                                                                                                                                                                           |
| `apps/shell`  | **Fractal Office**        | The suite shell: home screen and tabbed hosting of the four editors.                                                                                                                                                                                                                                                                                       |

Every app embeds the same AI panel: block-granular AI editing with version
snapshots and diffs in docs, a tool-calling agent over workbook/slide/PDF
state in the others.

**Local Codex integration.** The apps launch `codex exec` in an ephemeral,
read-only temporary directory with Codex shell, browser, app, computer-use,
image-generation, plugin, and multi-agent tools disabled. The request contains
the active conversation, attached images, and document-tool schemas. The office
app executes those document tools and returns their results to Codex on the next
turn. Your normal Codex CLI login is reused; no API key is copied into Fractal
Office.

## Engine packages

All pure TypeScript, no Electron dependency, unit-tested (except the UI kit):

- `packages/docx-engine` — docx parsing → block tree (with `docxIndex`
  anchors and passthrough), OOXML fragment generation, byte-level paragraph
  patching.
- `packages/pptx-engine` / `packages/pptx-render` — pptx model and rendering.
- `packages/file-parse` — text extraction for AI attachments (office formats,
  text formats).
- `packages/agent-core` — the AI agent loop and skill composition shared by
  every app.
- `packages/ai-provider` — local Codex CLI transport plus optional direct
  provider transports.
- `packages/ai-search` — Serper or DuckDuckGo web/image search tools; no
  upstream office service dependency.
- `packages/i18n`, `packages/ui`, `packages/project-store`,
  `packages/electron-utils` — shared i18n core, React UI kit, recent-files
  store, and Electron main-process helpers.

## Requirements and setup

1. Install Node.js 20 or newer and npm 10 or newer.
2. Install the OpenAI Codex CLI and authenticate it:

   ```bash
   npm install -g @openai/codex
   codex login
   codex --version
   ```

3. Install the app dependencies and verify the source:

```bash
npm ci
npm run fixtures     # generate test .docx fixtures
npm test             # engine + app unit tests (docs/sheets/slides need no display)
npm run typecheck    # tsc --noEmit across every workspace
npm run dev          # all four editors + shell against Vite dev servers
npm run dev:docs     # a single app (same pattern works per workspace)
npm run build:all    # production renderer/main-process builds
npm run dist:mac     # unsigned local macOS DMG + zip
npm run dist:win     # Windows NSIS installer
```

The packaged app searches `PATH`, `~/.local/bin/codex`,
`/opt/homebrew/bin/codex`, and `/usr/local/bin/codex`. Set
`CODEX_CLI_PATH=/absolute/path/to/codex` before launching the app when Codex is
installed somewhere else. The default model is `gpt-5.6-sol`.

### Hermes and local models

Fractal Office can also use Hermes-family or other local models through an
OpenAI-compatible HTTP endpoint. On the Home screen, open the account menu,
choose **AI model**, then select **Hermes / Local Models**. Enter the exact model
name exposed by the server and choose or edit its endpoint:

- Ollama: `http://127.0.0.1:11434/v1`
- LM Studio: `http://127.0.0.1:1234/v1`
- llama.cpp: `http://127.0.0.1:8080/v1`
- Hermes Proxy: `http://127.0.0.1:8645/v1`

Local endpoints do not require an API key unless the server was configured to
require one. The setting is shared by Docs, Sheets, Slides, and PDF. For reliable
document editing, use a local model and server that support OpenAI-compatible
streaming chat completions and function/tool calling.

The sheets app additionally needs a Rust toolchain for its xlsx sidecar
(`cargo` on PATH); `npm run build -w @fractal-office/sheets` compiles it
automatically.

Local UI/e2e driver scripts (Playwright + Electron, for local acceptance, not
committed by default) live in [`scripts/drivers/`](scripts/drivers/README.md).

## Architecture notes (docx round trip)

```
open docx ─► archive original by hash (never touched)
          ─► docx-engine parses word/document.xml top-level elements (w:p / w:tbl / …)
          ─► Block tree, each block anchored by docxIndex + original XML slice
          ─► TipTap streaming editor (manual + AI editing, dirty tracking)
save      ─► dirty blocks → OOXML fragments (referencing existing styles only)
          ─► splice into original document.xml (untouched blocks keep original bytes)
          ─► repack zip; all other entries copied byte-for-byte
```

The same philosophy holds in sheets and slides: the original file is the
source of truth, edits are applied as narrow patches, and everything the
editor didn't touch survives the round trip untouched.

## Security

See [SECURITY.md](SECURITY.md) for the process security posture (renderer
sandboxing, IPC validation, external-link gating) and the threat models for
AI-generated content.

## Third-party notices

`npm run notices` regenerates the bundled third-party license summary
(`tools/gen-third-party-notices.mjs`); all runtime dependencies are
MIT/Apache-2.0/OFL, and the bundled fonts (Liberation, Carlito, Caladea, Noto
CJK subsets) are OFL/Apache.

## License

Fractal Office is licensed under the [Apache License 2.0](LICENSE). It is derived
from an Apache-2.0 open-source office editor; its enterprise-only directory is
intentionally excluded from this fork. See
[NOTICE](NOTICE) and the generated third-party notices for attribution.

OpenAI and Codex are trademarks of OpenAI. This project is an independent
integration and is not an official OpenAI product.
