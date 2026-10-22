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
 * @module dsh-session-radar/client/styles
 */

const CSS = `
/* The bell's seat inside the section header row. */
.dsr-ab-bell-host {
  display: inline-flex;
  align-items: center;
  flex: none;
}

.dsr-ab-bell {
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

.dsr-ab-bell:hover { background: var(--dsw-alias-interactive-bg-hover); }

.dsr-ab-bell:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -2px;
}

/* Highlighted while the activity list replaces the workspace list. The ink
   stays label-primary: the sidebar's own selected nav rows pair their active
   fill with exactly that token, while the active-accent token is a fill (a
   pale blue in the light palette) and would all but vanish here. */
.dsr-ab-bell-active,
.dsr-ab-bell-active:hover {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-specific-sidebar-nav-item-active, var(--dsw-alias-interactive-bg-active));
}

.dsr-ab-badge {
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
.dsr-ab-badge-ask {
  inset-inline-end: auto;
  inset-inline-start: -3px;
  background: var(--dsw-alias-state-warn-primary, #f5a623);
}

/* The panel seat: an opaque cover over the list so the workspace rows never
   bleed through, sized to the seat's own box. */
.dsr-ab-panel-host {
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
     and it is declared here rather than on .dsr-ab-panel so the inline measurement
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

.dsr-ab-panel {
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

.dsr-ab-panel-notice {
  flex: none;
  padding: 2px 0 6px calc(var(--ab-row-pad) + var(--ab-mark) + var(--ab-gap));
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dsr-ab-panel-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding-bottom: 12px;
}

.dsr-ab-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 10px;
}

.dsr-ab-group-label {
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

.dsr-ab-row {
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

.dsr-ab-row:hover { background: var(--dsw-specific-sidebar-nav-item-hover, var(--dsw-alias-interactive-bg-hover)); }

/* The Session the conversation column is showing keeps the shipped selected-row
   fill, so the activity list says where you are without a second look. */
.dsr-ab-row-current,
.dsr-ab-row-current:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}

.dsr-ab-row:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -2px;
}

.dsr-ab-row-mark {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--ab-mark);
  height: 18px;
}

.dsr-ab-row-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dsr-ab-row-title {
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
.dsr-ab-row-title[data-scrolled] {
  mask-image: linear-gradient(to right, transparent, #000 12px);
}

.dsr-ab-row-title[data-clipped] {
  mask-image: linear-gradient(to left, transparent, #000 12px);
}

.dsr-ab-row-title[data-scrolled][data-clipped] {
  mask-image: linear-gradient(to right, transparent, #000 12px, #000 calc(100% - 12px), transparent);
}

/* The unclipped hover state drops the ellipsis, which would otherwise sit on
   top of the characters the marquee revealed. */
@media (hover: hover) {
  .dsr-ab-row:hover .dsr-ab-row-title,
  .dsr-ab-row:focus-within .dsr-ab-row-title {
    text-overflow: clip;
  }
}

.dsr-ab-row-folder {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary);
}

.dsr-ab-row-folder-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsr-ab-empty {
  padding: 18px 8px;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary);
}

/* Trailing row cell: the pinned marker at rest, the pin/archive affordances on
   hover or keyboard focus. */
.dsr-ab-row-tail {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 18px;
}

.dsr-ab-pin-mark {
  display: inline-flex;
  align-items: center;
  color: var(--dsw-alias-label-tertiary);
}

.dsr-ab-row-actions {
  display: none;
  align-items: center;
  gap: 2px;
}

.dsr-ab-row:hover .dsr-ab-row-actions,
.dsr-ab-row:focus-within .dsr-ab-row-actions {
  display: inline-flex;
}

.dsr-ab-row:hover .dsr-ab-pin-mark,
.dsr-ab-row:focus-within .dsr-ab-pin-mark {
  display: none;
}

.dsr-ab-icon-button {
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

.dsr-ab-icon-button:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.dsr-ab-icon-button:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary, currentColor);
  outline-offset: -1px;
}

/* Status copy for assistive tech: the dots themselves are decorative. */
.dsr-ab-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: no-preference) {
  .dsr-ab-panel { animation: dsr-ab-panel-in 120ms var(--ds-ease-in-out, ease-out); }
}

@keyframes dsr-ab-panel-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* ── restart retry (the boot dialog) ─────────────────────────────────────
   The only surface that speaks for the operator unprompted: after a restart the
   ledger knows which turns were cut off, and this asks once per process boot
   which of them to continue. A veil + panel like the waiting window, but the
   list is a checklist rather than a cursor grid. */
.dsr-rt-veil {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
}

.dsr-rt-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  width: min(620px, 100%);
  max-height: min(600px, 100%);
  overflow: hidden;
  box-sizing: border-box;
  padding: 16px 18px;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1, #1f1f21);
  color: var(--dsw-alias-label-primary, #f9fafb);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.dsr-rt-head { font-weight: 560; }
.dsr-rt-intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.dsr-rt-tools { display: flex; gap: 8px; }

.dsr-rt-list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dsr-rt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  font-size: 13px;
}

/* A turn is already running: it is listed so the operator sees why it is not
   offered, but it cannot be picked. */
.dsr-rt-row-running { opacity: 0.6; }

.dsr-rt-check { flex: none; margin: 0; }

.dsr-rt-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dsr-rt-folder {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.dsr-rt-tag {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16));
  color: var(--dsw-alias-state-warn-primary, #f5a623);
  font-size: 11px;
}

.dsr-rt-error {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dsr-rt-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dsr-rt-mini, .dsr-rt-send {
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.dsr-rt-mini:hover:enabled, .dsr-rt-send:hover:enabled { background: var(--dsw-alias-interactive-bg-hover, #ffffff14); }
.dsr-rt-mini:disabled, .dsr-rt-send:disabled { opacity: 0.5; cursor: default; }

.dsr-rt-send {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary, #7aaaff);
  color: #10131a;
  font-weight: 560;
}

.dsr-rt-send:hover:enabled { background: var(--dsw-alias-brand-primary, #7aaaff); filter: brightness(1.08); }

/* ── waiting window (the K overview) ─────────────────────────────────────
   A page overlay instead of a sidebar cover: the two zones need more width
   than the sidebar ever has, so this is the one surface that portals into the
   document body. The ask zone keeps a fixed column and the unread zone takes
   the rest, so "answer first" survives every window width. */
.dsr-ov-veil {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.45);
}

.dsr-ov-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: min(880px, 100%);
  max-height: min(640px, 100%);
  overflow: hidden;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 14px;
  background: var(--dsw-alias-bg-layer-1, #1f1f21);
  color: var(--dsw-alias-label-primary, #f9fafb);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}

.dsr-ov-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #ffffff14);
  font-size: 13.5px;
}

.dsr-ov-title { font-weight: 560; color: var(--dsw-alias-label-primary, #f9fafb); }
.dsr-ov-counts, .dsr-ov-hint { font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }
.dsr-ov-grow { flex: 1; }

.dsr-ov-close {
  flex: none;
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}

.dsr-ov-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, #ffffff14);
  color: var(--dsw-alias-label-primary, #f9fafb);
}

.dsr-ov-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 1px; }

.dsr-ov-kbd {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 19px;
  padding: 0 5px;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #ffffff10);
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  font-size: 11px;
}

.dsr-ov-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.dsr-ov-zone { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.dsr-ov-zone-ask { flex: none; width: 268px; }
.dsr-ov-zone-unread { flex: 1; }

/* Nothing waiting: the press still answers, with one line instead of two
   empty columns. */
.dsr-ov-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.dsr-ov-zone-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

/* The zone's priority mark: warning for an ask, unread red for a completion. */
.dsr-ov-zone-title::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--dsw-alias-state-warn-primary, #f5a623);
}

.dsr-ov-zone-unread .dsr-ov-zone-title::before { background: var(--dsw-alias-state-error-primary, #e5484d); }

.dsr-ov-zone-count { color: var(--dsw-alias-label-secondary, #cfd3d6); font-weight: 620; }
.dsr-ov-zone-empty { font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }

.dsr-ov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  align-content: start;
}

.dsr-ov-zone-ask .dsr-ov-grid { grid-template-columns: 1fr; }

.dsr-ov-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 11px;
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.dsr-ov-card:hover { border-color: var(--dsw-alias-border-l2, #ffffff1f); }
.dsr-ov-card:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: -2px; }

.dsr-ov-card-sel {
  border-color: var(--dsw-alias-brand-primary, #7aaaff);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary, #7aaaff);
}

/* The Session the conversation column already shows, so the window says where
   the operator is standing. */
.dsr-ov-card-current { background: var(--dsw-alias-interactive-bg-hover, #ffffff14); }

.dsr-ov-card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary, #f9fafb);
}

.dsr-ov-tag {
  align-self: flex-start;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16));
  color: var(--dsw-alias-state-warn-primary, #f5a623);
  font-size: 10.5px;
  font-weight: 600;
}

.dsr-ov-tag-unread { background: rgba(72, 199, 142, 0.16); color: #48c78e; }

.dsr-ov-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.dsr-ov-card-folder { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsr-ov-card-when { flex: none; margin-inline-start: auto; }

@media (prefers-reduced-motion: no-preference) {
  .dsr-ov-panel { animation: dsr-ab-panel-in 120ms var(--ds-ease-in-out, ease-out); }
}

/* ── status readout (merged from dsh-session-watch) ───────────────────────
   The six-metric footer readout and its settings row share this same
   stylesheet; the data-plugin marker and the fiber's removeStyles() cover the
   whole merged client half. Metric colors: one family per state, taken from
   the shell's semantic tokens where the shell has one, and reusing the
   sidebar's own label ramp for the archive metrics so they stay quiet. */
.dsr-sw-chip[data-metric="running"], .dsr-sw-legend[data-metric="running"], .dsr-sw-toggle[data-metric="running"] { --sw-ink: var(--dsw-alias-state-business-primary, #4d6bfe); }
.dsr-sw-chip[data-metric="unread"], .dsr-sw-legend[data-metric="unread"], .dsr-sw-toggle[data-metric="unread"] { --sw-ink: var(--dsw-alias-state-error-primary, #e5484d); }
.dsr-sw-chip[data-metric="pending"], .dsr-sw-legend[data-metric="pending"], .dsr-sw-toggle[data-metric="pending"] { --sw-ink: var(--dsw-alias-state-warn-primary, #f5a623); }
.dsr-sw-chip[data-metric="idle"], .dsr-sw-legend[data-metric="idle"], .dsr-sw-toggle[data-metric="idle"] { --sw-ink: var(--dsw-alias-label-tertiary, #98a2b3); }
.dsr-sw-chip[data-metric="unarchived"], .dsr-sw-legend[data-metric="unarchived"], .dsr-sw-toggle[data-metric="unarchived"] { --sw-ink: var(--dsw-alias-label-secondary, #667085); }
.dsr-sw-chip[data-metric="archived"], .dsr-sw-legend[data-metric="archived"], .dsr-sw-toggle[data-metric="archived"] { --sw-ink: var(--dsw-alias-label-tertiary, #98a2b3); }

/* The warning state is the one accent the unarchived metric can borrow. */
.dsr-sw-chip[data-warn="true"], .dsr-sw-legend[data-warn="true"] { --sw-ink: var(--dsw-alias-state-warn-primary, #f5a623); }

.dsr-sw-watch, .dsr-sw-meter, .dsr-sw-rail {
  display: inline-flex;
  align-items: center;
  flex: none;
  color: var(--dsw-alias-label-secondary, #667085);
  font-variant-numeric: tabular-nums;
}

/* Layout A: colored icon + number pills. */
.dsr-sw-watch { gap: 3px; }

.dsr-sw-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 22px;
  padding: 0 6px;
  border-radius: 11px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
  color: var(--sw-ink, var(--dsw-alias-label-secondary, #667085));
}

.dsr-sw-chip svg, .dsr-sw-legend svg, .dsr-sw-toggle-swatch svg { display: block; }

.dsr-sw-chip-count {
  font-size: 11px;
  font-weight: 620;
  line-height: 1;
  color: var(--sw-ink, inherit);
}

.dsr-sw-chip[data-warn="true"] { background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16)); }

/* Layout B: a thick stacked meter with a compact legend. */
.dsr-sw-meter { flex-direction: column; align-items: stretch; gap: 4px; min-width: 148px; }

.dsr-sw-meter-bar {
  display: flex;
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
}

.dsr-sw-meter-seg { min-width: 0; transition: flex-grow 160ms var(--ds-ease-in-out, ease-out); }
.dsr-sw-meter-seg[data-metric="running"] { background: var(--dsw-alias-state-business-primary, #4d6bfe); }
.dsr-sw-meter-seg[data-metric="unread"] { background: var(--dsw-alias-state-error-primary, #e5484d); }
.dsr-sw-meter-seg[data-metric="pending"] { background: var(--dsw-alias-state-warn-primary, #f5a623); }
.dsr-sw-meter-seg[data-metric="idle"] { background: var(--dsw-alias-state-idle-primary, #d0d5dd); }
.dsr-sw-meter-seg[data-empty="true"] { flex: 1 1 auto; }

.dsr-sw-meter-legend { display: flex; align-items: center; gap: 8px; }
.dsr-sw-legend { display: inline-flex; align-items: center; gap: 3px; color: var(--sw-ink); }

/* A jumpable metric is a button now; the chip/legend box is unchanged, so only
   the affordances move. The archived metric never becomes one, because the
   shell refuses to open an archived Session. */
button.dsr-sw-chip, button.dsr-sw-legend {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease-out);
}

button.dsr-sw-chip { margin: 0; }
button.dsr-sw-chip:hover { background: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.2)); }
button.dsr-sw-chip[data-warn="true"]:hover { background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16)); }

/* The legend is inline text: the pill is drawn with padding the negative margin
   takes back, so hovering highlights it without moving the row. */
button.dsr-sw-legend {
  margin: -2px -3px;
  padding: 2px 3px;
  border-radius: 6px;
  background: transparent;
}

button.dsr-sw-legend:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

button.dsr-sw-chip:focus-visible, button.dsr-sw-legend:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe);
  outline-offset: 1px;
}

button.dsr-sw-chip:active, button.dsr-sw-legend:active { transform: translateY(0.5px); }

@media (prefers-reduced-motion: reduce) {
  button.dsr-sw-chip, button.dsr-sw-legend { transition: none; }
}

/* The collapsed rail: one mark plus the unarchived count. */
.dsr-sw-rail {
  position: relative;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: var(--dsw-alias-label-secondary, #667085);
}

.dsr-sw-rail-count {
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

.dsr-sw-rail[data-warn="true"] { color: var(--dsw-alias-state-warn-primary, #f5a623); }
.dsr-sw-rail[data-warn="true"] .dsr-sw-rail-count { background: var(--dsw-alias-state-warn-primary, #f5a623); }

/* The Settings row. */
.dsr-sw-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 0;
}

.dsr-sw-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsr-sw-row-title { font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-primary, inherit); }
.dsr-sw-row-desc { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, GrayText); }
.dsr-sw-row-error { font-size: 12px; line-height: 16px; color: var(--dsw-alias-state-error-primary, #e5484d); }

.dsr-sw-row-controls { display: flex; flex-direction: column; gap: 12px; }

.dsr-sw-variants { display: inline-flex; gap: 4px; }
.dsr-sw-variant {
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
.dsr-sw-variant:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.1)); }
.dsr-sw-variant-on {
  border-color: transparent;
  background: var(--dsw-alias-state-business-primary, #4d6bfe);
  color: var(--dsw-alias-label-primary-inverted, #fff);
}
.dsr-sw-variant:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 1px; }

.dsr-sw-toggles {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  border: 0;
}

.dsr-sw-field-label { font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-tertiary, GrayText); padding: 0; }
.dsr-sw-field-hint { font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-tertiary, GrayText); }
.dsr-sw-field { display: flex; flex-direction: column; gap: 2px; }

.dsr-sw-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12.5px;
  line-height: 18px;
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
}
.dsr-sw-toggle input { accent-color: var(--dsw-alias-state-business-primary, #4d6bfe); margin: 0; }
.dsr-sw-toggle-swatch { display: inline-flex; color: var(--sw-ink, inherit); }
.dsr-sw-toggle-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsr-sw-toggle-count {
  margin-inline-start: auto;
  padding-inline-start: 6px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--sw-ink, inherit);
}
.dsr-sw-toggle-count[data-warn="true"] { color: var(--dsw-alias-state-warn-primary, #f5a623); }

.dsr-sw-input {
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

.dsr-sw-input:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: -1px; }

.dsr-sw-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
`

const PLUGIN_ID = 'dsh-session-radar'

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
