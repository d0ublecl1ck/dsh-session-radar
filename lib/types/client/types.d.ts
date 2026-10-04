/**
 * Type-only module augmentations owned by this plugin: the `unread-helper`
 * locale namespace registered into the slots locale map. Imported from the
 * client entry so the registration type-checks against its own keys.
 *
 * @module dsh-unread-helper/client/types
 */
import type { UnreadHelperKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Bell/activity copy plus the status readout and its settings row. */
        'unread-helper': UnreadHelperKey;
    }
}
export {};
