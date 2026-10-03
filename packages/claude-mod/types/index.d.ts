export type VibeAnnotation = {
  id: string
  url: string
  comment: string
  selector: string
}

declare module 'claude-code' {
  interface PluginState {
    'vibe-annotations': {
      /** Pending annotations as the server last reported them. */
      pending: VibeAnnotation[]
      /** Ids already handed to Claude in this session. */
      sentIds: string[]
      /** Send new annotations as soon as they arrive. */
      autoSend: boolean
      /** False when the last poll could not reach the server. */
      isOnline: boolean
    }
  }
}
