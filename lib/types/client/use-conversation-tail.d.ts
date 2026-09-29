import type { SessionId } from '@deepseek-ai/dsh-session/types';
/**
 * Track the Session whose visible conversation follows its tail.
 *
 * @returns the Session id, or null while no conversation is at its tail.
 */
export declare function useFollowingTailSession(): SessionId | null;
