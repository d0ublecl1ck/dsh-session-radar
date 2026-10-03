/**
 * Client half: inject the page styles, register the `unread-helper`
 * dictionaries, register the unread-jump shortcut, and mount the bell.
 *
 * The registration is the component's lifecycle and locale carrier (plus the
 * shell's `wide` flag); the visible surface is portalled into the browsing
 * region, because the region is a single-occupant slot whose header has no
 * hole beside the search control. See `./ActivityBell` for that rationale.
 *
 * @module dsh-unread-helper/client
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
