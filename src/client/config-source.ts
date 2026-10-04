/**
 * The live plugin preference: one observable over the plugin's own config
 * namespace, holding the unarchived threshold, the layout variant, and one
 * visibility flag per metric.
 *
 * The config form belongs to the settings provider; this module only projects
 * it into the two things the readout and the Settings row need — a synchronous
 * getSnapshot for useSyncExternalStore, and writes that publish the optimistic
 * value instead of waiting for the Host round-trip to re-render.
 *
 * @module dsh-unread-helper/client/config-source
 */
import { METRICS, normalizeThreshold, type Metric } from '../count.js'
import {
  METRIC_FIELD,
  normalizeVariant,
  normalizeVisibility,
  type Variant,
  type Visibility,
  type VisibilityField,
} from '../config.js'
import type { ConfigFormLike } from './watch-types.js'

/** Observable preference handed to the readout and the Settings row. */
export interface WatchConfig {
  /** Warn once the unarchived count exceeds this value. */
  readonly threshold: number
  /** Which layout the readout uses. */
  readonly variant: Variant
  /** Which metrics the readout renders. */
  readonly visibility: Visibility
}

/** Observable preference source. */
export interface ConfigSource {
  /** @returns the current preference, never undefined. */
  getSnapshot(): WatchConfig
  /** @param listener - change callback. @returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
  /** @param value - next threshold. @returns whether the Host accepted the write. */
  setThreshold(value: number): Promise<boolean>
  /** @param metric - metric to toggle. @param visible - next visibility. @returns whether the Host accepted the write. */
  setVisible(metric: Metric, visible: boolean): Promise<boolean>
  /** @param variant - next layout. @returns whether the Host accepted the write. */
  setVariant(variant: Variant): Promise<boolean>
  /** Release the config-form subscription (client fiber dispose). */
  dispose(): void
}

/** Read the whole preference off one form view, falling back to defaults. */
function read(form: ConfigFormLike): WatchConfig {
  let value: Readonly<Record<string, unknown>> = {}
  try {
    value = form.getSnapshot()?.value ?? {}
  } catch {
    value = {}
  }
  return {
    threshold: normalizeThreshold(value.threshold),
    variant: normalizeVariant(value.variant),
    visibility: normalizeVisibility(value),
  }
}

/** Whether two visibility records agree on every metric. */
function sameVisibility(left: Visibility, right: Visibility): boolean {
  for (const metric of METRICS) if (left[metric] !== right[metric]) return false
  return true
}

/** Whether two preference snapshots carry the same values. */
function sameConfig(left: WatchConfig, right: WatchConfig): boolean {
  return (
    left.threshold === right.threshold &&
    left.variant === right.variant &&
    sameVisibility(left.visibility, right.visibility)
  )
}

/**
 * Create the live preference source.
 * @param form - the plugin entry's config form.
 * @returns the observable preference and its disposer.
 */
export function createConfigSource(form: ConfigFormLike): ConfigSource {
  let current = read(form)
  const listeners = new Set<() => void>()

  const publish = (next: WatchConfig): void => {
    if (sameConfig(next, current)) return
    current = next
    for (const listener of [...listeners]) listener()
  }

  const unsubscribe = form.subscribe(() => {
    publish(read(form))
  })

  const write = async (field: VisibilityField | 'threshold' | 'variant', value: unknown): Promise<boolean> => {
    let accepted = false
    try {
      accepted = await form.set(field, value)
    } catch {
      accepted = false
    }
    // A refused write leaves the Host's value in force; never keep showing ours.
    if (!accepted) publish(read(form))
    return accepted
  }

  return {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    setThreshold: (value) => {
      const next = normalizeThreshold(value)
      // Publish first: the readout must react to the edit, not to the round-trip.
      publish({ ...current, threshold: next })
      return write('threshold', next)
    },
    setVisible: (metric, visible) => {
      // Publish first so the checkbox and the readout react immediately.
      publish({ ...current, visibility: { ...current.visibility, [metric]: visible } })
      return write(METRIC_FIELD[metric], visible)
    },
    setVariant: (variant) => {
      publish({ ...current, variant })
      return write('variant', variant)
    },
    dispose: () => {
      unsubscribe()
      listeners.clear()
    },
  }
}
