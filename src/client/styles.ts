/**
 * Injected page styles for the activity bell and its panel. One
 * `<style data-plugin>` element owns every `ab-` class; the client fiber
 * removes it on dispose.
 *
 * Every surface inherits the shell's own tokens so the bell reads as part of
 * the sidebar rather than as an overlay: the control reuses the region's
 * icon-button geometry, the active state reuses the sidebar's nav-item active
 * pair, and the panel paints the sidebar fill so the list underneath cannot
 * show through.
 *
 * @module dsh-unread-helper/client/styles
 */

const CSS = `
/* The bell's seat inside the section header row. */
.ab-bell-host {
  display: inline-flex;
  align-items: center;
  flex: none;
}

.ab-bell {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  corner-shape: round;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease-out), color 120ms var(--ds-ease-in-out, ease-out);
}

.ab-bell:hover { background: var(--dsw-alias-interactive-bg-hover); }

.ab-bell:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -2px;
}

/* Highlighted while the activity list replaces the workspace list. The ink
   stays label-primary: the sidebar's own selected nav rows pair their active
   fill with exactly that token, while the active-accent token is a fill (a
   pale blue in the light palette) and would all but vanish here. */
.ab-bell-active,
.ab-bell-active:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-specific-sidebar-nav-item-active, var(--dsw-alias-interactive-bg-active));
}

.ab-badge {
  position: absolute;
  top: -2px;
  inset-inline-end: -3px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  corner-shape: round;
  border: 2px solid var(--dsw-specific-sidebar-fill, transparent);
  background: var(--dsw-alias-state-error-primary, #e5484d);
  color: var(--dsw-alias-label-primary-inverted, #fff);
  font-size: 10px;
  font-weight: 620;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

/* The pending-ask chip: the same seat on the opposite corner, filled with the
   shared warning colour so a Session waiting for an answer never reads as an
   unread completion. It sits beside the red unread badge when both apply. */
.ab-badge-ask {
  inset-inline-end: auto;
  inset-inline-start: -3px;
  background: var(--dsw-alias-state-warn-primary, #f5a623);
}

/* The panel seat: an opaque cover over the list so the workspace rows never
   bleed through, sized to the seat's own box. */
.ab-panel-host {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  flex-direction: column;
  min-height: 0;
  /* Row geometry. The list sits as far left as it can *without* being clipped:
     the shell's sidebar column clips at its own inline padding, and the shipped
     rows start exactly there (their list carries a matching 4px inset), so this
     4px is the outermost position that still paints whole corners. Inside it the
     rows are tight — 4px padding, a 12px dot column, 4px gap — which puts the
     title column well left of the shipped rows' own titles. Only the trailing
     inset follows the shipped rows (./anchors measures it when the list opens),
     and it is declared here rather than on .ab-panel so the inline measurement
     on this host wins. */
  --ab-panel-pad-left: 4px;
  --ab-panel-pad-right: 12px;
  --ab-row-pad: 4px;
  --ab-mark: 12px;
  --ab-gap: 4px;
  /* No panel is portalled here while the view is closed: the empty seat must
     stay click-through, or it would swallow every click on the list below. */
  pointer-events: none;
}

.ab-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  box-sizing: border-box;
  /* Row insets measured from the shipped rows: the activity list is exactly as
     wide as the Workspace rows it replaces, in whatever theme or release. */
  padding-left: var(--ab-panel-pad-left);
  padding-right: var(--ab-panel-pad-right);
  background: var(--dsw-specific-sidebar-fill, Canvas);
  /* The seat is pointer-transparent while no panel is portalled into it, so an
     open/closed toggle can never leave an invisible hit target over the list. */
  pointer-events: auto;
}

.ab-panel-notice {
  flex: none;
  padding: 2px 0 6px calc(var(--ab-row-pad) + var(--ab-mark) + var(--ab-gap));
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.ab-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 12px;
}

.ab-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 10px;
}

.ab-group-label {
  position: sticky;
  top: 0;
  z-index: 1;
  /* Aligned with the row titles below: row pad + dot gutter + title gap. */
  padding: 4px 0 4px calc(var(--ab-row-pad) + var(--ab-mark) + var(--ab-gap));
  font-size: 12px;
  font-weight: 500;
  color: var(--dsw-alias-label-tertiary);
  background: var(--dsw-specific-sidebar-fill, Canvas);
}

.ab-row {
  display: flex;
  align-items: flex-start;
  gap: var(--ab-gap);
  width: 100%;
  box-sizing: border-box;
  padding: 7px var(--ab-row-pad);
  border: none;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  text-align: start;
  cursor: pointer;
}

.ab-row:hover { background: var(--dsw-specific-sidebar-nav-item-hover, var(--dsw-alias-interactive-bg-hover)); }

/* The Session the conversation column is showing keeps the shipped selected-row
   fill, so the activity list says where you are without a second look. */
.ab-row-current,
.ab-row-current:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.ab-row:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -2px;
}

.ab-row-mark {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ab-mark);
  height: 18px;
}

.ab-row-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.ab-row-title {
  display: block;
  font-size: 13.5px;
  line-height: 1.35;
  color: var(--dsw-alias-label-primary);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Marquee masks: the left fade appears once the title has left its start, the
   right one while text still remains beyond the cell (see ./marquee). */
.ab-row-title[data-scrolled] {
  mask-image: linear-gradient(to right, transparent, #000 12px);
}

.ab-row-title[data-clipped] {
  mask-image: linear-gradient(to left, transparent, #000 12px);
}

.ab-row-title[data-scrolled][data-clipped] {
  mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent);
}

/* The unclipped hover state drops the ellipsis, which would otherwise sit on
   top of the characters the marquee revealed. */
@media (hover: hover) {
  .ab-row:hover .ab-row-title,
  .ab-row:focus-within .ab-row-title {
    text-overflow: clip;
  }
}

.ab-row-folder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.ab-row-folder-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ab-empty {
  padding: 18px 8px;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}

/* Trailing row cell: the pinned marker at rest, the pin/archive affordances on
   hover or keyboard focus. */
.ab-row-tail {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 18px;
}

.ab-pin-mark {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
}

.ab-row-actions {
  display: none;
  align-items: center;
  gap: 2px;
}

.ab-row:hover .ab-row-actions,
.ab-row:focus-within .ab-row-actions {
  display: inline-flex;
}

.ab-row:hover .ab-pin-mark,
.ab-row:focus-within .ab-pin-mark {
  display: none;
}

.ab-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}

.ab-icon-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.ab-icon-button:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -1px;
}

/* Status copy for assistive tech: the dots themselves are decorative. */
.ab-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .ab-panel { animation: ab-panel-in 120ms var(--ds-ease-in-out, ease-out); }
}

@keyframes ab-panel-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── status readout (merged from dsh-session-watch) ───────────────────────
   The six-metric footer readout and its settings row share this same
   stylesheet; the data-plugin marker and the fiber's removeStyles() cover the
   whole merged client half. Metric colors: one family per state, taken from
   the shell's semantic tokens where the shell has one, and reusing the
   sidebar's own label ramp for the archive metrics so they stay quiet. */
.sw-chip[data-metric="running"], .sw-legend[data-metric="running"], .sw-toggle[data-metric="running"] { --sw-ink: var(--dsw-alias-state-business-primary, #4d6bfe); }
.sw-chip[data-metric="unread"], .sw-legend[data-metric="unread"], .sw-toggle[data-metric="unread"] { --sw-ink: var(--dsw-alias-state-error-primary, #e5484d); }
.sw-chip[data-metric="pending"], .sw-legend[data-metric="pending"], .sw-toggle[data-metric="pending"] { --sw-ink: var(--dsw-alias-state-warn-primary, #f5a623); }
.sw-chip[data-metric="idle"], .sw-legend[data-metric="idle"], .sw-toggle[data-metric="idle"] { --sw-ink: var(--dsw-alias-label-tertiary, #98a2b3); }
.sw-chip[data-metric="unarchived"], .sw-legend[data-metric="unarchived"], .sw-toggle[data-metric="unarchived"] { --sw-ink: var(--dsw-alias-label-secondary, #667085); }
.sw-chip[data-metric="archived"], .sw-legend[data-metric="archived"], .sw-toggle[data-metric="archived"] { --sw-ink: var(--dsw-alias-label-tertiary, #98a2b3); }

/* The warning state is the one accent the unarchived metric can borrow. */
.sw-chip[data-warn="true"], .sw-legend[data-warn="true"] { --sw-ink: var(--dsw-alias-state-warn-primary, #f5a623); }

.sw-watch, .sw-meter, .sw-rail {
  display: inline-flex;
  align-items: center;
  flex: none;
  color: var(--dsw-alias-label-secondary, #667085);
  font-variant-numeric: tabular-nums;
}

/* Layout A: colored icon + number pills. */
.sw-watch { gap: 3px; }

.sw-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
  color: var(--sw-ink, var(--dsw-alias-label-secondary, #667085));
}

.sw-chip svg, .sw-legend svg, .sw-toggle-swatch svg { display: block; }

.sw-chip-count {
  font-size: 11px;
  font-weight: 620;
  line-height: 1;
  color: var(--sw-ink, inherit);
}

.sw-chip[data-warn="true"] { background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16)); }

/* Layout B: a thick stacked meter with a compact legend. */
.sw-meter { flex-direction: column; align-items: stretch; gap: 4px; min-width: 148px; }

.sw-meter-bar {
  display: flex;
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
}

.sw-meter-seg { min-width: 0; transition: flex-grow 160ms var(--ds-ease-in-out, ease-out); }
.sw-meter-seg[data-metric="running"] { background: var(--dsw-alias-state-business-primary, #4d6bfe); }
.sw-meter-seg[data-metric="unread"] { background: var(--dsw-alias-state-error-primary, #e5484d); }
.sw-meter-seg[data-metric="pending"] { background: var(--dsw-alias-state-warn-primary, #f5a623); }
.sw-meter-seg[data-metric="idle"] { background: var(--dsw-alias-state-idle-primary, #d0d5dd); }
.sw-meter-seg[data-empty="true"] { flex: 1 1 auto; }

.sw-meter-legend { display: flex; align-items: center; gap: 8px; }
.sw-legend { display: inline-flex; align-items: center; gap: 3px; color: var(--sw-ink); }

/* The collapsed rail: one mark plus the unarchived count. */
.sw-rail {
  position: relative;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--dsw-alias-label-secondary, #667085);
}

.sw-rail-count {
  position: absolute;
  top: -2px;
  inset-inline-end: -4px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  border: 2px solid var(--dsw-specific-sidebar-fill, transparent);
  background: var(--dsw-alias-label-secondary, #667085);
  color: var(--dsw-alias-label-primary-inverted, #fff);
  font-size: 10px;
  font-weight: 620;
  line-height: 1;
}

.sw-rail[data-warn="true"] { color: var(--dsw-alias-state-warn-primary, #f5a623); }
.sw-rail[data-warn="true"] .sw-rail-count { background: var(--dsw-alias-state-warn-primary, #f5a623); }

/* The Settings row. */
.sw-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.sw-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sw-row-title { font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-primary, inherit); }
.sw-row-desc { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, GrayText); }
.sw-row-error { font-size: 12px; line-height: 16px; color: var(--dsw-alias-state-error-primary, #e5484d); }

.sw-row-controls { display: flex; flex-direction: column; gap: 12px; }

.sw-variants { display: inline-flex; gap: 4px; }
.sw-variant {
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2, currentColor);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.sw-variant:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1)); }
.sw-variant-on {
  border-color: transparent;
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.sw-variant:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 1px; }

.sw-toggles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.sw-field-label { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, GrayText); padding: 0; }
.sw-field-hint { font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-tertiary, GrayText); }
.sw-field { display: flex; flex-direction: column; gap: 2px; }

.sw-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
}
.sw-toggle input { accent-color: var(--dsw-alias-state-business-primary, #4d6bfe); margin: 0; }
.sw-toggle-swatch { display: inline-flex; color: var(--sw-ink, inherit); }
.sw-toggle-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sw-toggle-count {
  margin-inline-start: auto;
  padding-inline-start: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--sw-ink, inherit);
}
.sw-toggle-count[data-warn="true"] { color: var(--dsw-alias-state-warn-primary, #f5a623); }

.sw-input {
  width: 84px;
  box-sizing: border-box;
  padding: 4px 8px;
  border: 1px solid var(--dsw-alias-border-l2, currentColor);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2, transparent);
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.sw-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: -1px; }

.sw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`

const PLUGIN_ID = 'dsh-unread-helper'

let installed: HTMLStyleElement | undefined

/**
 * Inject the stylesheet once per document.
 * @returns the attached style element.
 */
export function injectStyles(): HTMLStyleElement {
  if (installed !== undefined && installed.isConnected) return installed
  const style = document.createElement('style')
  style.setAttribute('data-plugin', PLUGIN_ID)
  style.textContent = CSS
  document.head.appendChild(style)
  installed = style
  return style
}

/** Remove the stylesheet (client fiber dispose). */
export function removeStyles(): void {
  if (installed === undefined) return
  installed.remove()
  installed = undefined
}
