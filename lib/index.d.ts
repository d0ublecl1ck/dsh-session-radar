/** Stable cordis plugin name (the bundle row's `name` resolves to this package). */
export declare const name = "session-ledger";
/** The browser reaches this half through an authenticated webServer route. */
export declare const inject: string[];
/**
 * Mount the host half: the cross-restart ledger, its persistence, and the
 * Remote calls the browser half makes.
 *
 * @param ctx - host cordis context.
 */
export declare function apply(ctx: unknown): void;
