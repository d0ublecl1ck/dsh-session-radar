/**
 * dsh-session-ledger — host entry.
 *
 * The host half owns the cross-restart ledger and the authenticated route the
 * browser posts to; `src/host.ts` holds the behavior and this module only wires
 * the exports the loader contract requires.
 *
 * @module dsh-session-ledger
 */
import { mount } from './host.js';
/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export const name = 'session-ledger';
/** The browser reaches this half through an authenticated webServer route. */
export const inject = ['webServer', 'connection'];
/**
 * Mount the host half: the cross-restart ledger, its persistence, and the
 * Remote calls the browser half makes.
 *
 * @param ctx - host cordis context.
 */
export function apply(ctx) {
    mount(ctx);
}
//# sourceMappingURL=index.js.map