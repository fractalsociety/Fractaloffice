import { delimiter, dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { codexSpawnEnv } from '../src/codex-cli'

describe('codexSpawnEnv', () => {
  it('puts the Codex launcher directory first so env can find its Node runtime', () => {
    const cliPath = '/opt/homebrew/bin/codex'
    const path = codexSpawnEnv(cliPath).PATH?.split(delimiter)

    expect(path?.[0]).toBe(dirname(cliPath))
    expect(path).toContain('/opt/homebrew/bin')
    expect(path).toContain('/usr/local/bin')
    expect(new Set(path).size).toBe(path?.length)
  })
})
