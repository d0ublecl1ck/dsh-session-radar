/**
 * Client half: inject the page styles, register the session-radar
 * dictionaries, register the unread and pending-ask shortcuts, mount the bell,
 * and add the merged status readout and its settings row.
 *
 * The bell registration is the component's lifecycle and locale carrier (plus
 * the shell's wide flag); its visible surface is portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no hole
 * beside the search control. See ./ActivityBell for that rationale. The status
 * half is a second group of registrations in this same module (one client
 * bundle, one entry): the readout is another sidebar.footer.action occupant and
 * the preference row is gated on the Host actually serving this plugin's
 * config namespace.
 *
 * @module dsh-session-radar/client
 */
import type { Context } from '@deepseek-ai/cordis';
import './types.js';
/** Services required before this plugin mounts. */
export declare const inject: string[];
/**
 * Mount the browser half.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
