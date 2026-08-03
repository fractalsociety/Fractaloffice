# Fractal Office

## Download

[![Download for macOS](https://img.shields.io/badge/Download_for_macOS-Apple_Silicon-111111?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/fractalsociety/Fractaloffice/releases/latest/download/Fractal-Office-macOS-arm64.dmg)
[![Download for Windows](https://img.shields.io/badge/Download_for_Windows-64--bit-0078D4?style=for-the-badge&logo=windows11&logoColor=white)](https://github.com/fractalsociety/Fractaloffice/releases/latest/download/Fractal-Office-Windows-x64.exe)

The macOS download is signed and notarized by Apple. All installers and checksums are also available on the [latest GitHub release](https://github.com/fractalsociety/Fractaloffice/releases/latest).

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

## Installation and AI setup

Fractal Office supports two primary AI modes:

- **Local Codex CLI** — recommended. It reuses a Codex login already stored on
  the computer; Fractal Office never asks for or copies the credential.
- **Hermes / Local Models** — connects directly to an OpenAI-compatible server
  running on your computer or private network.

### Prerequisites

Install these before cloning the repository:

- [Git](https://git-scm.com/downloads)
- Node.js 20 or newer and npm 10 or newer
- Rust stable with `cargo` on `PATH` if building Fractal Office Sheets
- macOS or Windows; Linux development may work but is not currently packaged

Confirm the main tools are available:

```bash
git --version
node --version
npm --version
```

For Sheets, also run:

```bash
rustc --version
cargo --version
```

### 1. Download and install Fractal Office

```bash
git clone https://github.com/fractalsociety/Fractaloffice.git
cd Fractaloffice
npm ci
```

Use `npm ci`, not `npm install`, for a reproducible install from the committed
lockfile. No `.env` file is required for Codex or a local Hermes endpoint.

### 2A. Configure the local Codex CLI (recommended)

Install Codex globally, authenticate in the terminal, and verify the session:

```bash
npm install --global @openai/codex
codex login
codex login status
codex --version
```

`codex login` opens the official browser sign-in flow. Codex supports signing
in with ChatGPT or using an OpenAI API key. If a machine cannot open the browser,
use device authentication:

```bash
codex login --device-auth
```

To use API-key billing instead, place the key in an environment variable and
pipe it to Codex. Do not paste a key into this repository or commit it:

```bash
printenv OPENAI_API_KEY | codex login --with-api-key
```

Start Fractal Office, open the account menu on the Home screen, select
**AI model**, choose **Local Codex CLI**, and save. The app launches
`codex exec` for AI turns and defaults to `gpt-5.6-sol`.

The packaged app searches `PATH`, `~/.local/bin/codex`,
`/opt/homebrew/bin/codex`, and `/usr/local/bin/codex`. If it cannot find the
executable, set an explicit path before starting the app:

```bash
export CODEX_CLI_PATH="$(command -v codex)"  # macOS, Linux, or Git Bash
```

```powershell
$env:CODEX_CLI_PATH = (Get-Command codex).Source # Windows PowerShell
```

Restart Fractal Office after installing Codex, changing authentication, or
changing `CODEX_CLI_PATH`.

### 2B. Configure Hermes or another local model

This mode does not run the Codex CLI. Start an OpenAI-compatible model server,
load a model, and leave the server running while using Fractal Office. The
server must implement `/v1/chat/completions`; reliable document editing also
requires streaming responses and function/tool calling.

Supported endpoint presets are:

| Server       | Default endpoint            |
| ------------ | --------------------------- |
| Ollama       | `http://127.0.0.1:11434/v1` |
| LM Studio    | `http://127.0.0.1:1234/v1`  |
| llama.cpp    | `http://127.0.0.1:8080/v1`  |
| Hermes Proxy | `http://127.0.0.1:8645/v1`  |

Verify that the server is reachable and copy the exact model ID it returns:

```bash
curl http://127.0.0.1:11434/v1/models
```

Then configure the app:

1. Open Fractal Office and go to the Home screen.
2. Open the account menu and choose **AI model**.
3. Select **Hermes / Local Models**.
4. Choose a preset or enter the full endpoint URL.
5. Enter the exact model ID exposed by `/v1/models`.
6. Leave **API key** blank for an unsecured local endpoint. If your server
   requires a key, enter that server's key locally in the settings dialog.
7. Select **Save**, open an editor, and send a simple AI request.

The provider selection is shared by Docs, Sheets, Slides, and PDF. A model
named Hermes is not required—the option supports any compatible local model.
Model quality and tool-calling support determine how reliably it can edit
documents.

Do not expose an unauthenticated local-model endpoint to the public internet.
For another computer on a trusted network, replace `127.0.0.1` with the private
server address and configure authentication and firewall rules on that server.

### 3. Run the application

```bash
npm run dev          # all four editors and the desktop shell
npm run dev:docs     # Docs only
```

For a complete verification or production build:

```bash
npm run fixtures     # generate test .docx fixtures
npm test             # engine and app unit tests
npm run typecheck    # TypeScript checks across every workspace
npm run build:all    # production renderer and main-process builds
npm run dist:mac     # signed when a Developer ID identity is available; notarized when Apple credentials are configured
npm run dist:win     # Windows NSIS installer
```

`npm run build -w @fractal-office/sheets` compiles the Rust xlsx sidecar
automatically.

### Troubleshooting AI setup

| Problem                                                        | What to check                                                                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Codex CLI was not found**                                    | Run `codex --version`, set `CODEX_CLI_PATH`, and restart Fractal Office.                                       |
| **Codex is not signed in**                                     | Run `codex login status`; if needed, run `codex login` again.                                                  |
| **Local model connection refused**                             | Start the model server and verify its `/v1/models` endpoint with `curl`.                                       |
| **Model not found**                                            | Use the exact ID returned by `/v1/models`, including tags or quantization suffixes.                            |
| **Text works but document edits fail**                         | Use a model/server combination with OpenAI-compatible tool calling and streaming enabled.                      |
| **Requests are unexpectedly slow**                             | Check local RAM/VRAM use, reduce model size or context, and confirm the server is using hardware acceleration. |
| **Settings changed but an editor still uses the old provider** | Close and reopen the editor tab or restart Fractal Office.                                                     |

For Codex-specific diagnostics, run `codex doctor`. Never attach Codex auth
files, API keys, or local model credentials to a public issue.

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
