import { Context, type Effect } from 'effect'
import type { ApiConnectionError } from '../types/errors'

export interface SystemStatus {
  readonly mdds: string
  readonly streaming: boolean
  readonly uptime: number
}

export interface StatusService {
  readonly getSystemStatus: () => Effect.Effect<SystemStatus, ApiConnectionError>
}

export const StatusService = Context.GenericTag<StatusService>('StatusService')
