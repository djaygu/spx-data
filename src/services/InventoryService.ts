import { Context, type Effect } from 'effect'
import type { DateString } from '../types/common'
import type { ApiConnectionError, ValidationError } from '../types/errors'

export interface ContractInfo {
  readonly contract: string
  readonly root: string
  readonly expiration: DateString
  readonly strike: number
  readonly right: 'C' | 'P'
}

export interface InventoryService {
  readonly getExpirations: (
    root: string,
  ) => Effect.Effect<readonly DateString[], ApiConnectionError | ValidationError>

  readonly getContracts: (
    root: string,
    expiration: DateString,
  ) => Effect.Effect<readonly ContractInfo[], ApiConnectionError | ValidationError>
}

export const InventoryService = Context.GenericTag<InventoryService>('InventoryService')
