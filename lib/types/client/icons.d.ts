/**
 * The plugin's own glyphs: the bell, the six status-metric marks, and the
 * collapsed-rail status mark. The product icon set ships none of them, so this
 * module draws them at the same weight (a 16px current-color outline with a
 * 1px stroke) and the bundle stays free of an icon dependency.
 *
 * @module dsh-session-radar/client/icons
 */
import type { Metric } from '../count.js';
/**
 * Render the bell outline.
 * @param props.size - requested square edge in pixels.
 * @returns the icon element (decorative; the surrounding button owns the label).
 */
export declare function BellIcon({ size }: {
    size?: number;
}): import("react").JSX.Element;
/** Props of one metric glyph. */
export interface MetricIconProps {
    /** Which metric to draw. */
    readonly metric: Metric;
    /** Requested square edge in pixels. */
    readonly size?: number;
}
/**
 * Render one metric glyph.
 * @param props - metric and requested size.
 * @returns the glyph element (decorative; the surrounding surface owns the label).
 */
export declare function MetricIcon({ metric, size }: MetricIconProps): import("react").JSX.Element;
/**
 * The status readout's generic mark, used in the collapsed rail.
 * @param props - requested square edge in pixels.
 * @returns the glyph element (decorative).
 */
export declare function WatchIcon({ size }: {
    size?: number;
}): import("react").JSX.Element;
