export interface CaptureEvent {
  event: string
  distinctId: string
  properties?: Record<string, unknown>
}

export interface IdentifyParams {
  distinctId: string
  properties?: Record<string, unknown>
}

export interface AnalyticsPort {
  readonly name: string
  capture(event: CaptureEvent): void
  identify(params: IdentifyParams): void
  flush(): Promise<void>
  shutdown(): Promise<void>
}
