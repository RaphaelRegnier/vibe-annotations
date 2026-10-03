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
      /** Origins the server routes to this session. */
      sites: string[]
      /** False when the server can't route (older server): every site shows. */
      isScoped: boolean
      /** Identifies this session to the server. */
      sessionId: string
      /** Working directory, matched against the folder serving each site's port. */
      cwd: string
    }
  }
}
