/**
 * Environment configuration with validation
 */

export interface EnvironmentConfig {
  port: number
  host: string
  mongodbUrl: string
  freshnessTtlMs: number
}

function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function getEnvVarNumber(name: string, defaultValue: number): number {
  const value = process.env[name]
  if (value === undefined) {
    return defaultValue
  }
  const parsed = parseInt(value, 10)
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number`)
  }
  return parsed
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    port: getEnvVarNumber('SERVICE_PORT', 3002),
    host: getEnvVar('HOST', '0.0.0.0'),
    mongodbUrl: getEnvVar(
      'MONGODB_URL',
      'mongodb://localhost:27017/lumina-repositories-cache'
    ),
    freshnessTtlMs: getEnvVarNumber('FRESHNESS_TTL_MS', 60000),
  }
}

export const environmentConfig = () => loadEnvironmentConfig()
