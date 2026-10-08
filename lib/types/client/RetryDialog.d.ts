import type { ReactElement } from 'react';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { type RetryCandidate, type RetryOutcome } from './retry-model.js';
/** The locale seat this dialog's copy is bound to. */
type Translate = PropsLocale<'session-radar'>['t'];
/** What the dialog needs from the mounted bell. */
export interface RetryDialogProps {
    readonly candidates: readonly RetryCandidate[];
    readonly t: Translate;
    /** Send the continue message to each id, in order, and report what happened. */
    readonly onRetry: (ids: readonly SessionId[]) => Promise<RetryOutcome>;
    /** The operator is done with the dialog, however it ended. */
    readonly onClose: () => void;
}
/**
 * Render the checklist, or nothing when there is nothing to ask about.
 * @param props - rows, locale seat, transport, and the close path.
 * @returns the overlay, or null while there is nothing to offer.
 */
export declare function RetryDialog({ candidates, t, onRetry, onClose }: RetryDialogProps): ReactElement | null;
export {};
