import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT_ENV_PATH = resolve(process.cwd(), '.env')

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

export function readRootEnv() {
  if (!existsSync(ROOT_ENV_PATH)) {
    throw new Error(`Missing .env at ${ROOT_ENV_PATH}`)
  }

  const raw = readFileSync(ROOT_ENV_PATH, 'utf8')
  const env = {}

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator === -1) continue

    const key = trimmed.slice(0, separator).trim()
    const value = stripQuotes(trimmed.slice(separator + 1).trim())
    env[key] = value
  }

  return env
}

export function loadRootEnv() {
  const env = readRootEnv()
  Object.assign(process.env, env)
  return env
}

export function envValue(name) {
  return process.env[name] ?? ''
}
