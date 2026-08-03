import type { AgentMessage, AgentToolCall, AgentToolDef } from '@fractal-office/agent-core'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import type { AiChatResponse, AiProviderConfig } from './types'
import type { StreamCallbacks } from './stream'

const DEFAULT_CODEX_MODEL = 'gpt-5.6-sol'

interface CodexTurn {
  text: string
  toolCalls: Array<{ name: string; inputJson: string }>
}

function codexCandidates(): string[] {
  const executable = process.platform === 'win32' ? 'codex.exe' : 'codex'
  const candidates = [
    process.env.CODEX_CLI_PATH,
    ...(process.env.PATH ?? '')
      .split(delimiter)
      .filter(Boolean)
      .map((dir) => join(dir, executable)),
    join(homedir(), '.local', 'bin', executable),
    '/opt/homebrew/bin/codex',
    '/usr/local/bin/codex',
  ]
  return [...new Set(candidates.filter((value): value is string => Boolean(value)))]
}

export function resolveCodexCliPath(): string {
  const path = codexCandidates().find((candidate) => existsSync(candidate))
  if (!path) {
    throw new Error(
      'Local Codex CLI was not found. Install it, sign in with `codex login`, then restart Fractal Office. You can also set CODEX_CLI_PATH.',
    )
  }
  return path
}

/**
 * Finder-launched macOS applications receive a minimal PATH. The Codex npm
 * launcher uses `#!/usr/bin/env node`, so finding `codex` by its absolute path
 * is not sufficient: its adjacent Node executable must also be discoverable.
 */
export function codexSpawnEnv(cliPath: string): NodeJS.ProcessEnv {
  const path = [
    dirname(cliPath),
    ...(process.env.PATH ?? '').split(delimiter),
    join(homedir(), '.local', 'bin'),
    '/opt/homebrew/bin',
    '/usr/local/bin',
  ].filter(Boolean)
  return {
    ...process.env,
    PATH: [...new Set(path)].join(delimiter),
  }
}

function outputSchema(tools: AgentToolDef[]): Record<string, unknown> {
  const nameSchema =
    tools.length > 0 ? { type: 'string', enum: tools.map((tool) => tool.name) } : { type: 'string' }
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      text: { type: 'string' },
      toolCalls: {
        type: 'array',
        maxItems: tools.length > 0 ? 16 : 0,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: nameSchema,
            inputJson: {
              type: 'string',
              description:
                'A JSON object encoded as a string that matches the selected tool input schema.',
            },
          },
          required: ['name', 'inputJson'],
        },
      },
    },
    required: ['text', 'toolCalls'],
  }
}

function serializeMessages(messages: AgentMessage[]): string {
  return messages
    .map((message) => {
      if (message.role === 'user') {
        const imageNote = message.images?.length
          ? `\n[${message.images.length} attached image(s)]`
          : ''
        return `USER:\n${message.text}${imageNote}`
      }
      if (message.role === 'assistant') {
        const calls = message.toolCalls?.length
          ? `\nTOOL REQUESTS:\n${JSON.stringify(
              message.toolCalls.map(({ name, input }) => ({ name, input })),
              null,
              2,
            )}`
          : ''
        return `ASSISTANT:\n${message.text}${calls}`
      }
      return `TOOL RESULTS:\n${JSON.stringify(message.results, null, 2)}`
    })
    .join('\n\n')
}

function buildPrompt(system: string, messages: AgentMessage[], tools: AgentToolDef[]): string {
  const toolCatalog = tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
  }))
  return [
    'You are the local AI engine embedded in Fractal Office.',
    'Do not run shell commands, inspect the filesystem, edit files directly, or use any tool provided by the Codex CLI.',
    'The only permitted actions are returning user-facing text and requesting zero or more DOCUMENT TOOLS from the catalog below.',
    'When a document change is requested, request the appropriate document tools. The host application will execute them and send results in the next turn.',
    'Put each tool input in inputJson as a valid JSON object string matching that tool schema.',
    'If tool execution is still needed, keep text brief. If the task is complete, return a concise helpful response and an empty toolCalls array.',
    '',
    'APPLICATION SYSTEM INSTRUCTIONS:',
    system,
    '',
    'DOCUMENT TOOL CATALOG:',
    JSON.stringify(toolCatalog, null, 2),
    '',
    'CONVERSATION:',
    serializeMessages(messages),
  ].join('\n')
}

function imageExtension(mime: string): string {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif') return '.gif'
  return '.png'
}

async function runCodexTurn(
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  signal?: AbortSignal,
): Promise<CodexTurn> {
  const workDir = await mkdtemp(join(tmpdir(), 'fractal-office-'))
  const schemaPath = join(workDir, 'response-schema.json')
  const resultPath = join(workDir, 'response.json')
  try {
    await writeFile(schemaPath, JSON.stringify(outputSchema(tools)), 'utf8')
    const imagePaths: string[] = []
    let imageIndex = 0
    for (const message of messages) {
      if (message.role !== 'user') continue
      for (const image of message.images ?? []) {
        const imagePath = join(workDir, `attachment-${imageIndex++}${imageExtension(image.mime)}`)
        await writeFile(imagePath, Buffer.from(image.base64, 'base64'))
        imagePaths.push(imagePath)
      }
    }

    const args = [
      'exec',
      '--ephemeral',
      '--sandbox',
      'read-only',
      '--ignore-user-config',
      '--ignore-rules',
      '--disable',
      'shell_tool',
      '--disable',
      'browser_use',
      '--disable',
      'browser_use_external',
      '--disable',
      'computer_use',
      '--disable',
      'apps',
      '--disable',
      'image_generation',
      '--disable',
      'multi_agent',
      '--disable',
      'plugins',
      '--skip-git-repo-check',
      '--model',
      config.model || DEFAULT_CODEX_MODEL,
      '--cd',
      workDir,
      '--output-schema',
      schemaPath,
      '--output-last-message',
      resultPath,
      ...imagePaths.flatMap((path) => ['--image', path]),
      '-',
    ]

    const cliPath = resolveCodexCliPath()
    const prompt = buildPrompt(system, messages, tools)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(cliPath, args, {
        cwd: workDir,
        env: codexSpawnEnv(cliPath),
        stdio: ['pipe', 'ignore', 'pipe'],
      })
      let stderr = ''
      const abort = () => child.kill('SIGTERM')
      signal?.addEventListener('abort', abort, { once: true })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr = `${stderr}${chunk.toString('utf8')}`.slice(-8000)
      })
      child.on('error', reject)
      child.on('close', (code, terminatedBySignal) => {
        signal?.removeEventListener('abort', abort)
        if (signal?.aborted || terminatedBySignal) {
          reject(new DOMException('Codex request was cancelled', 'AbortError'))
        } else if (code === 0) {
          resolve()
        } else {
          reject(
            new Error(
              `Local Codex CLI exited with code ${code}: ${stderr.trim() || 'No error details were returned.'}`,
            ),
          )
        }
      })
      child.stdin.end(prompt)
    })

    const raw = await readFile(resultPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<CodexTurn>
    if (typeof parsed.text !== 'string' || !Array.isArray(parsed.toolCalls)) {
      throw new Error('Local Codex CLI returned an invalid structured response')
    }
    return { text: parsed.text, toolCalls: parsed.toolCalls }
  } finally {
    await rm(workDir, { recursive: true, force: true })
  }
}

export async function streamCodexCli(
  config: AiProviderConfig,
  system: string,
  messages: AgentMessage[],
  tools: AgentToolDef[],
  cb: StreamCallbacks,
): Promise<void> {
  const turn = await runCodexTurn(config, system, messages, tools, cb.signal)
  if (turn.text) cb.onDelta(turn.text)
  for (const call of turn.toolCalls) {
    let input: Record<string, unknown> = {}
    let inputError: string | undefined
    try {
      const value = JSON.parse(call.inputJson) as unknown
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Tool input must be a JSON object')
      input = value as Record<string, unknown>
    } catch (error) {
      inputError = error instanceof Error ? error.message : String(error)
    }
    const toolCall: AgentToolCall = {
      id: crypto.randomUUID(),
      name: call.name,
      input,
      inputError,
    }
    cb.onToolCall(toolCall)
  }
}

export async function chatCodexCli(
  config: AiProviderConfig,
  system: string,
  user: string,
): Promise<AiChatResponse> {
  try {
    const turn = await runCodexTurn(config, system, [{ role: 'user', text: user }], [])
    if (!turn.text) return { ok: false, error: 'Local Codex CLI returned an empty response' }
    return { ok: true, content: turn.text }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
