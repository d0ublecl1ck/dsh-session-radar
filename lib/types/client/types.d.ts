/**
 * Type-only module augmentations owned by this plugin: the `session-radar`
 * locale namespace registered into the slots locale map. Imported from the
 * client entry so the registration type-checks against its own keys.
 *
 * @module dsh-session-radar/client/types
 */
import type { SessionRadarKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Bell/activity copy plus the status readout and its settings row. */
        'session-radar': SessionRadarKey;
    }
}
export {};
