/**
 * The seat the readout presses and the mounted bell answers.
 *
 * A walk can only live inside the bell: it owns the cursors, the projection
 * order, and the resolved sidebar anchors. The readout is a separate occupant
 * of the sidebar foot, so it cannot reach any of that — a seat is the seam. The
 * bell publishes one handler while it is mounted and clears it on unmount; the
 * readout routes a press through whatever is published, and a press with no
 * mounted walk is a no-op rather than an error.
 *
 * The archive is deliberately absent: the shell refuses to open an archived
 * Session, so that metric stays a count.
 *
 * @module dsh-session-radar/client/metric-jump
 */
/** The metrics a press can visit, in the order the readout paints them. */
export declare const JUMP_METRICS: readonly JumpMetric[];
/** One metric the readout can jump to. */
export type JumpMetric = 'running' | 'unread' | 'pending' | 'idle' | 'unarchived';
/**
 * Whether a metric key names a jump target.
 * @param value - a metric key, or anything else.
 * @returns whether the value is one of {@link JUMP_METRICS}.
 */
export declare function isJumpMetric(value: unknown): value is JumpMetric;
/** The live walk the bell offers while it is mounted. */
export interface MetricJumpHandler {
    /** @param metric - the metric whose next Session to open. */
    run(metric: JumpMetric): void;
}
/** Plugin-scope slot for the mounted bell's per-metric walk. */
export interface MetricJumpSeat {
    /**
     * Publish the mounted handler.
     * @param handler - the bell's walk, or null to clear it.
     * @returns a disposer that clears only the value it published.
     */
    publish(handler: MetricJumpHandler | null): () => void;
    /** @returns the current handler, or null while no bell is mounted. */
    current(): MetricJumpHandler | null;
    /** @param metric - the metric to walk; a press with no mounted bell does nothing. */
    run(metric: JumpMetric): void;
}
/**
 * Create the one-slot seat the readout and the bell share.
 * @returns the seat.
 */
export declare function createMetricJumpSeat(): MetricJumpSeat;
