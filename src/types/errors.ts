import { Data } from 'effect'

export class ApiConnectionError extends Data.TaggedError('ApiConnectionError')<{
  readonly message: string
  readonly statusCode?: number
  readonly url?: string
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
  readonly message: string
  readonly field?: string
  readonly value?: unknown
}> {}
