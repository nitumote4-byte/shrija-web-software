export type ManakCredentialsPublic = {
  username: string
  baseUrl: string
  bridgeUrl: string
  hasPassword: boolean
}

export type ManakCredentialsStored = {
  username: string
  passwordEnc: string
  baseUrl: string
  bridgeUrl: string
  /** Comma-separated MACs allowed for scrap tool, e.g. 28-D0-43-20-EB-D6 */
  allowedMacs: string
  updatedAt: string
}

export type ManakRequestRow = {
  partyName: string
  item: string
  pic: number
  weight: number
  purity: string
  requestNo: string
  receiptNo: string
  jobCardNo: string
  cml: string
  date?: string
  raw?: Record<string, string>
}

export type ManakFetchResult = {
  ok: boolean
  source: 'bridge' | 'portal' | 'demo'
  requests: ManakRequestRow[]
  message?: string
  needsCaptcha?: boolean
  sessionId?: string
  captchaImage?: string
}
