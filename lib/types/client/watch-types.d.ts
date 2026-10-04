/**
 * Structural view of the client services and framework hooks the status
 * readout uses.
 *
 * The status half was built against a link:-installed bundle, so it described
 * the official contracts structurally instead of importing them. Merged into
 * this plugin the same shapes stay — they are the slice of the contracts the
 * readout actually touches, and they keep the readout importable by the plain
 * node render tests.
 *
 * @module dsh-unread-helper/client/watch-types
 */
/** Translate one dictionary key, with optional named template params. */
export type Translate = (key: string, params?: Record<string, unknown>) => string;
/** Selector hook over an observable snapshot (the framework's standard seat). */
export interface SnapshotSelectorHook {
    /** @param selector - projection over the current snapshot. @returns the selected value. */
    <Selected>(selector: (state: any) => Selected, equal?: (left: Selected, right: Selected) => boolean): Selected;
}
/** One plugin entry's live config form, as ctx.configForms.get(id) returns it. */
export interface ConfigFormLike {
    /** @returns the current redacted view of the entry's volatile fields. */
    getSnapshot(): ConfigFormSnapshot;
    /** @param listener - change callback. @returns the unsubscribe function. */
    subscribe(listener: () => void): () => void;
    /** @param field - volatile field name. @param value - next value. @returns whether the Host accepted the write. */
    set(field: string, value: unknown): Promise<boolean>;
}
/** The slice of a config form view this plugin reads. */
export interface ConfigFormSnapshot {
    /** The namespace's resolved value, holding every volatile field. */
    readonly value?: Readonly<Record<string, unknown>> | undefined;
    /** Whether the active profile accepts form writes. */
    readonly writable?: boolean | undefined;
}
/** The settings service face: per-namespace forms and namespace-gated registration. */
export interface ConfigFormsService {
    /** @param entryId - Host plugin row id, which is also the settings namespace. @returns that entry's form. */
    get(entryId: string): ConfigFormLike;
    /**
     * @param namespaces - namespaces this registration follows.
     * @param register - runs once one of them is served; returns its disposer.
     * @returns the disposer ending the watch and any live registration.
     */
    whileServed(namespaces: readonly string[], register: (served: ReadonlySet<string>) => (() => void) | void): () => void;
}
/** One slot registration: the entry key plus the registrant's private inject face. */
export interface WatchSlotRegistration {
    readonly name: string;
    readonly id: string;
    readonly order?: number;
    readonly label?: string | (() => string);
    readonly locale?: string;
    readonly inject?: () => Record<string, unknown>;
}
/**
 * The slots service face used for the status surfaces. The readout's own slot
 * keys and the settings row's slot key are owned by shell packages this repo
 * does not depend on for types, so this half reaches the service structurally.
 */
export interface WatchSlotsService {
    /**
     * Wait for one slot declaration, then run the callback for each declaration lifetime.
     * @param key - declared slot key.
     * @param callback - registers the contribution; returns its disposer.
     * @returns idempotent disposer for the wait and the active effect.
     */
    inject(key: string, callback: () => (() => void) | void): () => void;
    /** @param options - registration key and inject face. @param component - the React component. @returns the disposer. */
    register(options: WatchSlotRegistration, component: unknown): () => void;
}
