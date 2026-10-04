/**
 * React binding for the conversation-tail anchor: resolve once, then follow the
 * attribute through a mutation observer so the bell reacts to the operator
 * scrolling away from (or back to) the tail.
 *
 * The observer only schedules a frame; the frame work is one scoped
 * `querySelectorAll`, so the conversation's streaming mutations cannot turn
 * into a render loop.
 *
 * @module dsh-session-radar/client/use-conversation-tail
 */
import { useEffect, useState } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { tailSessionId } from './conversation-tail.js'

/**
 * Track the Session whose visible conversation follows its tail.
 *
 * @returns the Session id, or null while no conversation is at its tail.
 */
export function useFollowingTailSession(): SessionId | null {
  const [sessionId, setSessionId] = useState<SessionId | null>(() => tailSessionId(document))
  useEffect(() => {
    let frame = 0
    const sync = (): void => {
      frame = 0
      const next = tailSessionId(document)
      setSessionId((previous) => (previous === next ? previous : next))
    }
    const schedule = (): void => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(sync)
    }
    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-chat-following-tail', 'data-conversation-session'],
    })
    sync()
    return () => {
      observer.disconnect()
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [])
  return sessionId
}
