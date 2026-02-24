type ErrorWithMessage = {
  message?: string
}

function getRawMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const value = (error as ErrorWithMessage).message
    if (typeof value === 'string') return value
  }
  return ''
}

export function logError(context: string, error: unknown): void {
  console.error(`${context}:`, error)
}

export function toPublicErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const message = getRawMessage(error).toLowerCase()

  if (message.includes('fetch failed') || message.includes('network')) {
    return 'Sem ligação ao servidor. Tenta novamente.'
  }

  if (message.includes('invalid login credentials')) {
    return 'Email ou password inválidos.'
  }

  if (message.includes('duplicate key value')) {
    return 'Já existe um registo com esse valor.'
  }

  if (message.includes('violates row-level security policy')) {
    return 'Sem permissões para esta operação.'
  }

  return fallback
}
