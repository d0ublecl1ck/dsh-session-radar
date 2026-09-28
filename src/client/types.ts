/**
 * Type-only module augmentations owned by this plugin: the `session-ledger`
 * locale namespace registered into the slots locale map. Imported from the
 * client entry so the registration type-checks against its own keys.
 *
 * @module dsh-session-ledger/client/types
 */
import type { ActivityBellKey } from './locales.js'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Activity bell, activity panel, and day-section copy. */
    'session-ledger': ActivityBellKey
  }
}

export {}
