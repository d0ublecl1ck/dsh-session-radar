import type { ReactElement } from 'react';
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { LedgerSource } from './ledger-source.js';
/** Business face the registration injects. */
export interface LedgerChipInjected {
    readonly ledger: LedgerSource;
    readonly openSession: (sessionId: SessionId) => void;
}
/** Composed props: shell share + locale seat + injected business face. */
export type LedgerChipProps = PropsRuntime<'sidebar.footer.action'> & PropsLocale<'session-ledger'> & LedgerChipInjected;
/**
 * Render the chip and its popover.
 * @param props - shell share, locale seat, ledger source and open action.
 * @returns the chip, or nothing while every list is empty.
 */
export declare function LedgerChip({ ledger, openSession }: LedgerChipProps): ReactElement | null;
