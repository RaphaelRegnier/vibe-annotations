export type VibeMessage = { author: 'user' | 'agent', body: string }

export type VibeAnnotation = {
  id: string
  url: string
  comment: string
  selector: string
  /** 'comment' | 'design' | 'text' */
  kind?: string
  /** Text edits: the copy before and after. */
  copy?: { original: string, value: string }
  /** Follow-ups after the first comment. */
  thread: VibeMessage[]
  /** Claude replied last: waiting on the user, not sent again until they answer. */
  awaitingUser: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'vibe-annotations': {
      /** Pending annotations as the server last reported them. */
      pending: VibeAnnotation[]
      /** What was handed to Claude in this session: "<id>#<user turns>", so a
       *  new user reply in the thread makes the annotation new again. */
      sentIds: string[]
      /** Annotation ids the extension asked to send, until they show up. */
      wanted: string[]
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
