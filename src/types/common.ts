export enum DataProvider {
  THETADATA = 'thetadata',
}

export enum OptionType {
  CALL = 'call',
  PUT = 'put',
}

export enum ExpirationStatus {
  FUTURE = 'future',
  TODAY = 'today',
  EXPIRED = 'expired',
}

export type DateString = string // Format: YYYY-MM-DD
export type ContractString = string // Format: O:SPX[YY]MMDD[CP]STRIKE
