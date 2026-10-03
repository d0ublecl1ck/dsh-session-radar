/**
 * Type-only module augmentations owned by this plugin: the `unread-helper`
 * locale namespace registered into the slots locale map. Imported from the
 * client entry so the registration type-checks against its own keys.
 *
 * @module dsh-unread-helper/client/types
 */
import type { ActivityBellKey } from './locales.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Activity bell, activity panel, and day-section copy. */
    'unread-helper': ActivityBellKey
  }
}

export {}
