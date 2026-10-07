import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** The Session the operator opened, and the way to report one. */
export interface UserOpen {
    /** The Session the operator opened last, or null before any. */
    readonly current: SessionId | null;
    /** Record one open the plugin performed on the operator's behalf. */
    readonly mark: (sessionId: SessionId) => void;
}
/**
 * Track the Session the operator opened themselves.
 *
 * The press is captured at the document, so the sidebar's rows and the
 * activity list's own rows both count however they were rendered.
 *
 * @returns the operator's last open, and the reporter the jumps call.
 */
export declare function useUserOpenedSession(): UserOpen;
