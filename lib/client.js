window.__ModuleLoader__.load({
  id: "dsh-session-radar",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/count.ts
var DEFAULT_THRESHOLD = 10;
var METRICS = ["running", "unread", "pending", "idle", "unarchived", "archived"];
function isOrdinary(row) {
  if (row.blank === true) return false;
  if (row.origin === "subagent") return false;
  if (row.parentId !== void 0) return false;
  return true;
}
function activityBucket(status, row) {
  if (status?.pendingInteraction !== void 0) return "pending";
  const running = status?.running ?? row.running;
  if (running === true) return "running";
  if (status?.completionUnread === true) return "unread";
  return "idle";
}
function emptyBuckets() {
  return { running: [], unread: [], pending: [], idle: [], unarchived: [], archived: [] };
}
function updatedAtOf(row) {
  return typeof row.updatedAt === "number" && Number.isFinite(row.updatedAt) ? row.updatedAt : 0;
}
function classifySessions(list, archivedIds, statuses) {
  const buckets = emptyBuckets();
  if (list === void 0 || list === null || !Array.isArray(list.ids)) return buckets;
  const archived = /* @__PURE__ */ new Set();
  for (const id of archivedIds ?? []) archived.add(String(id));
  const byId = list.byId ?? {};
  const rows = [];
  list.ids.forEach((id, index) => {
    const row = byId[String(id)];
    if (row === void 0 || row === null) return;
    if (!isOrdinary(row)) return;
    if (archived.has(String(id))) {
      rows.push({ id, bucket: "archived", at: updatedAtOf(row), index });
      return;
    }
    const status = typeof statuses?.get === "function" ? statuses.get(String(id)) : void 0;
    rows.push({ id, bucket: activityBucket(status, row), at: updatedAtOf(row), index });
  });
  rows.sort((left, right) => right.at - left.at || left.index - right.index);
  for (const row of rows) {
    if (row.bucket === "archived") {
      buckets.archived.push(row.id);
      continue;
    }
    buckets.unarchived.push(row.id);
    buckets[row.bucket].push(row.id);
  }
  return buckets;
}
function countSessions(list, archivedIds, statuses) {
  const buckets = classifySessions(list, archivedIds, statuses);
  return {
    running: buckets.running.length,
    unread: buckets.unread.length,
    pending: buckets.pending.length,
    idle: buckets.idle.length,
    unarchived: buckets.unarchived.length,
    archived: buckets.archived.length
  };
}
function normalizeThreshold(value) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD;
  const whole = Math.trunc(parsed);
  return whole >= 1 ? whole : DEFAULT_THRESHOLD;
}
function shouldWarn(count, threshold) {
  return count > normalizeThreshold(threshold);
}

// src/config.ts
var PLUGIN_ID = "session-radar";
var METRIC_FIELD = {
  running: "showRunning",
  unread: "showUnread",
  pending: "showPending",
  idle: "showIdle",
  unarchived: "showUnarchived",
  archived: "showArchived"
};
var DEFAULT_ROW_BADGE = true;
function normalizeRowBadge(value) {
  return typeof value === "boolean" ? value : DEFAULT_ROW_BADGE;
}
var DEFAULT_VISIBILITY = {
  running: true,
  unread: true,
  pending: true,
  idle: true,
  unarchived: true,
  archived: true
};
function normalizeVisibility(value) {
  const source = value ?? {};
  const result = {};
  for (const metric of METRICS) {
    const raw = source[METRIC_FIELD[metric]];
    result[metric] = typeof raw === "boolean" ? raw : DEFAULT_VISIBILITY[metric];
  }
  return result;
}
var VARIANTS = ["chips", "meter"];
var DEFAULT_VARIANT = "chips";
function normalizeVariant(value) {
  const candidate = String(value ?? "");
  return VARIANTS.includes(candidate) ? candidate : DEFAULT_VARIANT;
}
function visibleMetrics(visibility) {
  return METRICS.filter((metric) => visibility[metric]);
}

// src/client/ActivityBell.tsx
var import_react6 = require("react");
var import_react_dom2 = require("react-dom");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/activity-model.ts
var ACTIVITY_ROW_LIMIT = 200;
var MS_PER_DAY = 864e5;
function startOfLocalDay(at) {
  const date = new Date(at);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function pad2(value) {
  return value < 10 ? `0${value}` : String(value);
}
function dayBucket(now, at) {
  const elapsedDays = Math.round((startOfLocalDay(now) - startOfLocalDay(at)) / MS_PER_DAY);
  if (elapsedDays <= 0) return { key: "today", kind: "today" };
  if (elapsedDays === 1) return { key: "yesterday", kind: "yesterday" };
  const date = new Date(at);
  if (elapsedDays < 7) {
    const weekday = date.getDay();
    return { key: `weekday:${weekday}`, kind: "weekday", weekday };
  }
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return { key: `date:${year}-${pad2(month)}-${pad2(day)}`, kind: "date", year, month, day };
}
function pathBasename(path) {
  if (path === void 0) return void 0;
  const segments = path.split(/[\\/]+/).filter((segment) => segment !== "");
  return segments.length === 0 ? void 0 : segments[segments.length - 1];
}
function folderIndex(workspaces) {
  const index = /* @__PURE__ */ new Map();
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!index.has(sessionId)) index.set(sessionId, workspace.title);
    }
  }
  return index;
}
function isUnread(id, status, completedSince, ledgerUnread, manualUnread, atTail) {
  if (manualUnread?.has(id) === true) return true;
  if (atTail) return false;
  return status?.completionUnread === true || completedSince?.has(id) === true || ledgerUnread?.has(id) === true;
}
function pendingKind(kind) {
  switch (kind) {
    case "approval":
    case "plan-review":
    case "question":
      return kind;
    default:
      return void 0;
  }
}
function visible(session, archived) {
  if (session.origin === "subagent") return false;
  if (session.blank) return false;
  return !archived.has(session.id);
}
function buildActivityGroups(inputs, now, limit = ACTIVITY_ROW_LIMIT) {
  const archived = new Set(inputs.workspaces.archivedSessionIds);
  const pinned = new Set(inputs.workspaces.pinnedSessionIds ?? []);
  const completedSince = inputs.completedSince;
  const ledgerUnread = inputs.ledgerUnread;
  const manualUnread = inputs.manualUnread;
  const viewingTail = inputs.viewingTail ?? null;
  const folders = folderIndex(inputs.workspaces.items);
  const candidates = [];
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id];
    if (session === void 0 || !visible(session, archived)) continue;
    const status = inputs.statuses.get(id);
    const running = status?.running ?? session.running;
    const current = (session.retainedBy?.mainView ?? 0) > 0;
    candidates.push({
      id,
      title: session.displayTitle,
      folder: folders.get(id) ?? pathBasename(session.cwd) ?? "",
      updatedAt: session.updatedAt,
      unread: isUnread(id, status, completedSince, ledgerUnread, manualUnread, current && viewingTail === id),
      manual: manualUnread?.has(id) === true,
      running,
      pending: pendingKind(status?.pendingInteraction?.kind),
      pinned: pinned.has(id),
      current,
      bucket: dayBucket(now, session.updatedAt)
    });
  }
  candidates.sort((left, right) => right.updatedAt - left.updatedAt || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const groups = [];
  const byKey = /* @__PURE__ */ new Map();
  for (const row of candidates.slice(0, limit)) {
    const existing = byKey.get(row.bucket.key);
    if (existing !== void 0) {
      existing.rows.push(row);
      continue;
    }
    const group = { key: row.bucket.key, bucket: row.bucket, rows: [row] };
    byKey.set(row.bucket.key, group);
    groups.push(group);
  }
  return groups;
}
function countUnread(inputs) {
  const archived = new Set(inputs.workspaces.archivedSessionIds);
  const completedSince = inputs.completedSince;
  const ledgerUnread = inputs.ledgerUnread;
  const manualUnread = inputs.manualUnread;
  const viewingTail = inputs.viewingTail ?? null;
  let count = 0;
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id];
    if (session === void 0 || !visible(session, archived)) continue;
    const current = (session.retainedBy?.mainView ?? 0) > 0;
    const atTail = current && viewingTail === id;
    if (!isUnread(id, inputs.statuses.get(id), completedSince, ledgerUnread, manualUnread, atTail)) continue;
    count += 1;
  }
  return count;
}
function countPending(inputs) {
  const archived = new Set(inputs.workspaces.archivedSessionIds);
  let count = 0;
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id];
    if (session === void 0 || !visible(session, archived)) continue;
    if (pendingKind(inputs.statuses.get(id)?.pendingInteraction?.kind) === void 0) continue;
    count += 1;
  }
  return count;
}

// src/overview.ts
var OVERVIEW_LIMIT = ACTIVITY_ROW_LIMIT;
function toCard(row) {
  return {
    id: row.id,
    title: row.title,
    folder: row.folder,
    updatedAt: row.updatedAt,
    pending: row.pending,
    unread: row.unread,
    current: row.current
  };
}
function buildOverview(inputs, now, limit = OVERVIEW_LIMIT) {
  const rows = buildActivityGroups(inputs, now, limit).flatMap((group) => group.rows);
  const ask = [];
  const unread = [];
  for (const row of rows) {
    if (row.pending !== void 0) {
      ask.push(toCard(row));
      continue;
    }
    if (row.unread) unread.push(toCard(row));
  }
  return { ask, unread };
}

// src/client/anchors.ts
function measureRowInset(listArea) {
  if (listArea === null || !listArea.isConnected) return void 0;
  const row = listArea.querySelector('[data-row-key^="session:"]') ?? listArea.querySelector('[data-row-key^="workspace:"]');
  if (row === null) return void 0;
  const rowBox = row.getBoundingClientRect();
  if (rowBox.width <= 0) return void 0;
  const seatBox = listArea.getBoundingClientRect();
  return { inlineEnd: Math.round(seatBox.right - rowBox.right) };
}
function applyRowInset(host, inset) {
  if (inset === void 0) {
    host.style.removeProperty("--ab-panel-pad-right");
    return;
  }
  host.style.setProperty("--ab-panel-pad-right", `${inset.inlineEnd}px`);
}
var HEADER_SELECTOR = '[class*="sectionHeader"]';
var SEARCH_SLOT_SELECTOR = '[class*="searchSlot"]';
var ACTIONS_SELECTOR = '[class*="headerActions"]';
var LIST_AREA_SELECTOR = '[class*="listArea"]';
var SEARCH_CONTROL_SELECTOR = "button[aria-expanded]";
function findSidebarHeader(doc) {
  for (const candidate of doc.querySelectorAll(HEADER_SELECTOR)) {
    if (candidate.querySelector(SEARCH_SLOT_SELECTOR) === null) continue;
    if (candidate.querySelector(SEARCH_CONTROL_SELECTOR) === null) continue;
    return candidate;
  }
  return void 0;
}
function resolveSidebarAnchors(doc) {
  const header = findSidebarHeader(doc);
  if (header === void 0) return void 0;
  const root = header.parentElement;
  return {
    header,
    actions: header.querySelector(ACTIONS_SELECTOR),
    listArea: root?.querySelector(LIST_AREA_SELECTOR) ?? null
  };
}
function refreshSidebarAnchors(previous) {
  if (!previous.header.isConnected) return void 0;
  return {
    header: previous.header,
    actions: previous.header.querySelector(ACTIONS_SELECTOR),
    listArea: previous.header.parentElement?.querySelector(LIST_AREA_SELECTOR) ?? null
  };
}
function sameSidebarAnchors(left, right) {
  if (left === right) return true;
  if (left === void 0 || right === void 0) return false;
  return left.header === right.header && left.actions === right.actions && left.listArea === right.listArea;
}
function mountContainer(parent, before, className) {
  const container = parent.ownerDocument.createElement("div");
  container.className = className;
  container.dataset.activityBellHost = className;
  parent.insertBefore(container, before);
  return container;
}
function ensurePositioned(element) {
  const inline = element.style.position;
  const computed = element.ownerDocument.defaultView?.getComputedStyle(element).position;
  if (computed !== void 0 && computed !== "" && computed !== "static") return () => {
  };
  element.style.position = "relative";
  return () => {
    element.style.position = inline;
  };
}

// src/client/ask-jump.ts
function nextAskJump(asks, current, trail) {
  if (asks.length > 0) {
    const at = current === null ? -1 : asks.indexOf(current);
    const target2 = at === -1 ? asks[0] : asks[(at + 1) % asks.length];
    if (target2 === current) return { target: null, stack: trail };
    const remember = current !== null && at === -1 && !trail.includes(current);
    return { target: target2, stack: remember ? [...trail, current] : trail };
  }
  if (trail.length === 0) return { target: null, stack: trail };
  const remaining = [...trail];
  let target = remaining.pop() ?? null;
  while (target !== null && target === current && remaining.length > 0) {
    target = remaining.pop() ?? null;
  }
  if (target === null || target === current) return { target: null, stack: remaining };
  return { target, stack: remaining };
}

// src/client/completions.ts
function sessionFacts(list, statuses) {
  const facts = /* @__PURE__ */ new Map();
  for (const id of list.ids) {
    const row = list.byId[id];
    facts.set(id, {
      running: statuses.get(id)?.running ?? row?.running ?? false,
      mainView: (row?.retainedBy?.mainView ?? 0) > 0
    });
  }
  return facts;
}
function nextPending(pending, previous, current) {
  let next;
  const edit = () => {
    next ?? (next = new Set(pending));
    return next;
  };
  for (const [id, facts] of current) {
    if (facts.running) {
      if (pending.has(id)) edit().delete(id);
      continue;
    }
    const before = previous?.get(id);
    if (before?.running === true) edit().add(id);
    else if (before !== void 0 && !before.mainView && facts.mainView) edit().delete(id);
  }
  for (const id of pending) {
    if (!current.has(id)) edit().delete(id);
  }
  if (next === void 0) return pending;
  if (next.size === pending.size) {
    let same = true;
    for (const id of pending) {
      if (!next.has(id)) {
        same = false;
        break;
      }
    }
    if (same) return pending;
  }
  return next;
}

// src/client/jump.ts
function isElement(value) {
  return typeof value === "object" && value !== null && value.nodeType === 1;
}
function currentSessionId(list) {
  for (const id of list.ids) {
    if ((list.byId[id]?.retainedBy?.mainView ?? 0) > 0) return id;
  }
  return null;
}
function nextUnreadId(order, cursor) {
  if (order.length === 0) return null;
  if (cursor === null) return order[0];
  const at = order.indexOf(cursor);
  if (at === -1) return order[0];
  return order[(at + 1) % order.length];
}
function sessionRowKey(sessionId) {
  return `session:${sessionId}`;
}
function sessionIdOfRowKey(value) {
  if (typeof value !== "string" || !value.startsWith("session:")) return null;
  const sessionId = value.slice("session:".length);
  return sessionId === "" ? null : sessionId;
}
function findSessionRow(listArea, sessionId) {
  if (listArea === null || listArea === void 0) return void 0;
  const row = listArea.querySelector(`[data-row-key="${sessionRowKey(sessionId)}"]`);
  return isElement(row) ? row : void 0;
}
function revealRow(row) {
  if (typeof row.scrollIntoView !== "function") return;
  row.scrollIntoView({ block: "nearest", inline: "nearest" });
}
function owningWorkspaceKey(items, sessionId) {
  for (const workspace of items) {
    if (workspace.sessionIds.includes(sessionId)) return workspace.workspaceId;
  }
  return void 0;
}
function expandOwningGroup(listArea, workspaceKey) {
  if (listArea === null || listArea === void 0) return false;
  const rows = [...listArea.querySelectorAll("[data-row-key]")];
  const keys = rows.map((row) => String(row.getAttribute("data-row-key") ?? ""));
  const at = keys.indexOf(`workspace:${workspaceKey}`);
  if (at === -1) return false;
  let end = rows.length;
  for (let index = at + 1; index < keys.length; index += 1) {
    if (keys[index].startsWith("workspace:")) {
      end = index;
      break;
    }
  }
  if (keys.slice(at + 1, end).some((key) => key.startsWith("session:"))) return false;
  const disclosure = rows[at];
  if (!isElement(disclosure) || typeof disclosure.click !== "function") return false;
  disclosure.click();
  return true;
}

// src/client/manual-unread.ts
var WORKSPACE_VIEW_STORAGE_KEY = "dsh.workspace.view.v5";
var DESKTOP_STORAGE_SYNC_EVENT = "__dsh_storage_sync__";
var NONE = /* @__PURE__ */ new Set();
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseManualUnread(raw) {
  if (raw === null) return NONE;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NONE;
  }
  if (!isRecord(parsed)) return NONE;
  const ids = parsed.unreadSessionIds;
  if (!Array.isArray(ids)) return NONE;
  const marked = /* @__PURE__ */ new Set();
  for (const id of ids) {
    if (typeof id === "string" && id !== "") marked.add(id);
  }
  return marked;
}
function defaultStorage() {
  try {
    const page = typeof window === "undefined" ? void 0 : window;
    if (page?.localStorage !== void 0) return page.localStorage;
    return typeof localStorage === "undefined" ? void 0 : localStorage;
  } catch {
    return void 0;
  }
}
function readManualUnread(storage = defaultStorage()) {
  if (storage === void 0) return NONE;
  try {
    return parseManualUnread(storage.getItem(WORKSPACE_VIEW_STORAGE_KEY));
  } catch {
    return NONE;
  }
}
function sameIds(left, right) {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}
function storageConstructor() {
  const page = typeof window === "undefined" ? void 0 : window;
  if (page?.Storage !== void 0) return page.Storage;
  if (typeof Storage === "undefined") return void 0;
  return { prototype: Storage.prototype };
}
function watchStorageWrites(onWrite) {
  const holder = storageConstructor();
  if (holder === void 0) return () => {
  };
  const prototype = holder.prototype;
  const setItem = prototype.setItem;
  const removeItem = prototype.removeItem;
  const clear = prototype.clear;
  if (typeof setItem !== "function" || typeof removeItem !== "function" || typeof clear !== "function") {
    return () => {
    };
  }
  prototype.setItem = function wrappedSetItem(key, value) {
    setItem.call(this, key, value);
    if (key === WORKSPACE_VIEW_STORAGE_KEY) onWrite();
  };
  prototype.removeItem = function wrappedRemoveItem(key) {
    removeItem.call(this, key);
    if (key === WORKSPACE_VIEW_STORAGE_KEY) onWrite();
  };
  prototype.clear = function wrappedClear() {
    clear.call(this);
    onWrite();
  };
  return () => {
    prototype.setItem = setItem;
    prototype.removeItem = removeItem;
    prototype.clear = clear;
  };
}
function touchesViewStore(event) {
  const detail = event.detail;
  if (isRecord(detail)) {
    if (detail.type === "clear") return true;
    if (typeof detail.key === "string") return detail.key === WORKSPACE_VIEW_STORAGE_KEY;
  }
  const key = event.key;
  if (key === null) return true;
  return typeof key !== "string" || key === WORKSPACE_VIEW_STORAGE_KEY;
}
function droppedIds(previous, next) {
  const dropped = [];
  for (const id of previous) {
    if (!next.has(id)) dropped.push(id);
  }
  return dropped;
}
function watchManualUnread(onChange) {
  const page = typeof window === "undefined" ? void 0 : window;
  let current = readManualUnread();
  let disposed = false;
  const sync = () => {
    if (disposed) return;
    const next = readManualUnread();
    if (sameIds(current, next)) return;
    current = next;
    onChange(next);
  };
  const restore = watchStorageWrites(sync);
  const onStorageEvent = (event) => {
    if (touchesViewStore(event)) sync();
  };
  page?.addEventListener("storage", onStorageEvent);
  page?.addEventListener(DESKTOP_STORAGE_SYNC_EVENT, onStorageEvent);
  sync();
  return () => {
    disposed = true;
    restore();
    page?.removeEventListener("storage", onStorageEvent);
    page?.removeEventListener(DESKTOP_STORAGE_SYNC_EVENT, onStorageEvent);
  };
}

// src/client/icons.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function BellIcon({ size = 16 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 1,
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      focusable: "false",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.845 14a1.333 1.333 0 0 0 2.31 0" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.175 10.217A.667.667 0 0 0 2.667 11.333h10.666a.667.667 0 0 0 .493-1.115C12.94 9.304 12 8.333 12 5.333A4 4 0 0 0 4 5.333c0 3-.941 3.971-1.825 4.884" })
      ]
    }
  );
}
function frame(size) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.3,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: false
  };
}
function MetricIcon({ metric, size = 13 }) {
  if (metric === "running") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...frame(size), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M5.4 3.6 12.2 8l-6.8 4.4z" }) });
  }
  if (metric === "unread") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...frame(size), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "1.7", fill: "currentColor", stroke: "none" })
    ] });
  }
  if (metric === "pending") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...frame(size), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "5.2" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5.1v3.1" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 10.6h.01" })
    ] });
  }
  if (metric === "idle") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { ...frame(size), children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M9.9 2.9a5.7 5.7 0 1 0 3.2 8.9 4.6 4.6 0 0 1-3.2-8.9z" }) });
  }
  if (metric === "unarchived") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...frame(size), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.6 9.1 4.3 4.2a1 1 0 0 1 .94-.68h5.52a1 1 0 0 1 .94.68l1.7 4.9" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.6 9.1h3.1l.65 1.5h3.3l.65-1.5h3.1v3a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1z" })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...frame(size), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M2.1 3.3h11.8v2.2H2.1z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 5.5h10v6.2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M6.4 8.7h3.2" })
  ] });
}
function WatchIcon({ size = 16 }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { ...frame(size), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "8", cy: "8", r: "5.4" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M8 5.4V8l1.9 1.2" })
  ] });
}

// src/client/marquee.ts
var import_react = require("react");
var MIN_TITLE_REVEAL_PX = 8;
var TITLE_MARQUEE_PX_PER_MS = 0.028;
function placeTitle(title, left, range) {
  if (typeof title.scrollTo === "function") title.scrollTo({ left, behavior: "instant" });
  else title.scrollLeft = left;
  if (left > 0) title.dataset.scrolled = "";
  else delete title.dataset.scrolled;
  if (left < range) title.dataset.clipped = "";
  else delete title.dataset.clipped;
}
function restTitle(title) {
  if (typeof title.scrollTo === "function") title.scrollTo({ left: 0, behavior: "instant" });
  else title.scrollLeft = 0;
  delete title.dataset.scrolled;
  delete title.dataset.clipped;
}
function useTitleMarquee(title) {
  const frame2 = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => () => {
    cancelAnimationFrame(frame2.current);
  }, []);
  return (0, import_react.useMemo)(() => ({
    enter: () => {
      const element = title.current;
      if (element === null) return;
      const range = element.scrollWidth - element.clientWidth;
      if (range <= MIN_TITLE_REVEAL_PX) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        placeTitle(element, range, range);
        return;
      }
      cancelAnimationFrame(frame2.current);
      let previous;
      let position = 0;
      const step = (now) => {
        position += previous === void 0 ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
        previous = now;
        placeTitle(element, Math.min(position, range), range);
        if (position < range) frame2.current = requestAnimationFrame(step);
      };
      frame2.current = requestAnimationFrame(step);
    },
    leave: () => {
      cancelAnimationFrame(frame2.current);
      const element = title.current;
      if (element === null) return;
      restTitle(element);
    }
  }), [title]);
}

// src/client/overview-cursor.ts
function zoneCards(overview, zone) {
  return zone === "ask" ? overview.ask : overview.unread;
}
function zoneLength(overview, zone) {
  return zoneCards(overview, zone).length;
}
function seedCursor(overview) {
  if (overview.ask.length > 0) return { zone: "ask", index: 0 };
  if (overview.unread.length > 0) return { zone: "unread", index: 0 };
  return null;
}
function moveCursor(cursor, overview, step) {
  const current = cursor === null ? seedCursor(overview) : clampCursor(cursor, overview);
  if (current === null) return null;
  if (step === "left" || step === "right") {
    const other = current.zone === "ask" ? "unread" : "ask";
    return zoneLength(overview, other) === 0 ? current : { zone: other, index: 0 };
  }
  const length = zoneLength(overview, current.zone);
  const delta = step === "down" ? 1 : -1;
  return { zone: current.zone, index: (current.index + delta + length) % length };
}
function clampCursor(cursor, overview) {
  const length = zoneLength(overview, cursor.zone);
  if (length === 0) return seedCursor(overview);
  return cursor.index < length ? cursor : { zone: cursor.zone, index: length - 1 };
}
function selectedCard(overview, cursor) {
  if (cursor === null) return null;
  const cards = zoneCards(overview, cursor.zone);
  return cards[cursor.index] ?? null;
}

// src/client/use-anchors.ts
var import_react2 = require("react");
function useSidebarAnchors() {
  const [anchors, setAnchors] = (0, import_react2.useState)(
    () => resolveSidebarAnchors(document)
  );
  (0, import_react2.useEffect)(() => {
    let frame2 = 0;
    const sync = () => {
      frame2 = 0;
      setAnchors((previous) => {
        if (previous !== void 0) {
          const refreshed = refreshSidebarAnchors(previous);
          if (sameSidebarAnchors(previous, refreshed)) return previous;
          return refreshed;
        }
        const next = resolveSidebarAnchors(document);
        return sameSidebarAnchors(previous, next) ? previous : next;
      });
    };
    const schedule = () => {
      if (frame2 !== 0) return;
      frame2 = window.requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      if (frame2 !== 0) window.cancelAnimationFrame(frame2);
    };
  }, []);
  return anchors;
}

// src/client/use-conversation-tail.ts
var import_react3 = require("react");

// src/client/conversation-tail.ts
var CONVERSATION_REGION_SELECTOR = '[data-conversation-region="chat"][data-conversation-session]';
var FOLLOWING_TAIL_SELECTOR = "[data-chat-following-tail]";
var SESSION_ATTRIBUTE = "data-conversation-session";
function tailSessionId(root) {
  for (const region of root.querySelectorAll(CONVERSATION_REGION_SELECTOR)) {
    if (region.querySelector(FOLLOWING_TAIL_SELECTOR) === null) continue;
    const id = region.getAttribute(SESSION_ATTRIBUTE);
    if (typeof id === "string" && id !== "") return id;
  }
  return null;
}
function tailLedgerRead(input) {
  const { tail, reminder } = input;
  if (tail === null || reminder === null) return { send: false };
  if (tail !== input.restored || input.openedByUser === tail) {
    return { send: true, acknowledgeInterrupt: true };
  }
  return reminder.interrupted ? { send: false } : { send: true, acknowledgeInterrupt: false };
}

// src/client/use-conversation-tail.ts
function useFollowingTailSession() {
  const [sessionId, setSessionId] = (0, import_react3.useState)(() => tailSessionId(document));
  (0, import_react3.useEffect)(() => {
    let frame2 = 0;
    const sync = () => {
      frame2 = 0;
      const next = tailSessionId(document);
      setSessionId((previous) => previous === next ? previous : next);
    };
    const schedule = () => {
      if (frame2 !== 0) return;
      frame2 = window.requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-chat-following-tail", "data-conversation-session"]
    });
    sync();
    return () => {
      observer.disconnect();
      if (frame2 !== 0) window.cancelAnimationFrame(frame2);
    };
  }, []);
  return sessionId;
}

// src/client/use-user-open.ts
var import_react4 = require("react");
function rowSessionOf(target) {
  if (typeof target !== "object" || target === null) return null;
  const element = target;
  if (typeof element.closest !== "function") return null;
  const row = element.closest("[data-row-key]");
  if (row === null || typeof row.getAttribute !== "function") return null;
  return sessionIdOfRowKey(row.getAttribute("data-row-key"));
}
function useUserOpenedSession() {
  const [current, setCurrent] = (0, import_react4.useState)(null);
  const mark = (0, import_react4.useCallback)((sessionId) => {
    setCurrent(sessionId);
  }, []);
  (0, import_react4.useEffect)(() => {
    const onPointerDown = (event) => {
      const sessionId = rowSessionOf(event.target);
      if (sessionId !== null) setCurrent(sessionId);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, []);
  return { current, mark };
}

// src/client/RetryDialog.tsx
var import_react5 = require("react");
var import_react_dom = require("react-dom");

// src/client/retry-model.ts
function folderIndex2(workspaces) {
  const index = /* @__PURE__ */ new Map();
  for (const workspace of workspaces) {
    for (const sessionId of workspace.sessionIds) {
      if (!index.has(sessionId)) index.set(sessionId, workspace.title);
    }
  }
  return index;
}
function isSubagent(session) {
  return session.origin === "subagent" || session.parentId !== void 0;
}
function resolveRoot(id, sessions) {
  let current = id;
  for (let step = 0, cap = sessions.ids.length + 1; step < cap; step += 1) {
    const session = sessions.byId[current];
    if (session === void 0) return null;
    if (!isSubagent(session)) return current;
    const parent = session.parentId;
    if (parent === void 0) return null;
    current = parent;
  }
  return null;
}
function unfinishedSubagentRoots(inputs) {
  const reminders = new Map(inputs.reminders.map((reminder) => [reminder.sessionId, reminder]));
  const roots = /* @__PURE__ */ new Map();
  for (const id of inputs.sessions.ids) {
    const session = inputs.sessions.byId[id];
    if (session === void 0 || !isSubagent(session)) continue;
    const reminder = reminders.get(id);
    if (!session.running && reminder?.interrupted !== true) continue;
    const root = resolveRoot(id, inputs.sessions);
    if (root === null) continue;
    const dated = reminder?.at ?? 0;
    const entry = roots.get(root) ?? { at: 0, sources: /* @__PURE__ */ new Map() };
    entry.sources.set(id, dated);
    if (dated > entry.at) entry.at = dated;
    roots.set(root, entry);
  }
  return roots;
}
function buildRetryCandidates(inputs) {
  const folders = folderIndex2(inputs.workspaces.items);
  const reasons = /* @__PURE__ */ new Map();
  const remember = (id, at, sources) => {
    const reason = reasons.get(id) ?? { at: -1, sources: /* @__PURE__ */ new Map() };
    if (at > reason.at) reason.at = at;
    if (sources !== void 0) {
      for (const [sourceId, sourceAt] of sources) {
        if (sourceId !== id) reason.sources.set(sourceId, sourceAt);
      }
    }
    reasons.set(id, reason);
  };
  for (const reminder of inputs.reminders) {
    if (reminder.interrupted) remember(reminder.sessionId, reminder.at);
  }
  const subagentRoots = unfinishedSubagentRoots(inputs);
  for (const [root, entry] of subagentRoots) remember(root, entry.at, entry.sources);
  const rows = [];
  for (const [id, reason] of reasons) {
    const session = inputs.sessions.byId[id];
    if (session === void 0) continue;
    if (isSubagent(session)) continue;
    rows.push({
      id: session.id,
      title: session.displayTitle === "" ? id : session.displayTitle,
      folder: folders.get(id) ?? pathBasename(session.cwd) ?? "",
      at: reason.at,
      running: session.running,
      sources: [...reason.sources.entries()].sort((left, right) => right[1] - left[1] || (left[0] < right[0] ? -1 : 1)).map(([sourceId]) => sourceId)
    });
  }
  return rows.sort((left, right) => right.at - left.at || (left.id < right.id ? -1 : 1));
}
function candidateSources(candidates, id) {
  return candidates.find((row) => row.id === id)?.sources ?? [];
}
function selectable(row) {
  return !row.running;
}
function defaultSelection(candidates) {
  const selection = /* @__PURE__ */ new Set();
  for (const row of candidates) if (selectable(row)) selection.add(row.id);
  return selection;
}
function toggleOne(selection, id) {
  const next = new Set(selection);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
function allRetryableSelected(candidates, selection) {
  const retryable = candidates.filter(selectable);
  return retryable.length > 0 && retryable.every((row) => selection.has(row.id));
}
function toggleAll(candidates, selection) {
  if (allRetryableSelected(candidates, selection)) return /* @__PURE__ */ new Set();
  return new Set(candidates.filter(selectable).map((row) => row.id));
}
function selectedIds(candidates, selection) {
  return candidates.filter((row) => selectable(row) && selection.has(row.id)).map((row) => row.id);
}
async function retrySelected(input) {
  const sent = [];
  const failed = [];
  for (const id of input.ids) {
    try {
      const result = await input.send(id);
      if (result.ok) {
        sent.push(id);
        input.acknowledge(id);
      } else {
        failed.push({ id, message: result.message });
      }
    } catch (error) {
      failed.push({ id, message: String(error?.message ?? error) });
    }
  }
  return { sent, failed };
}

// src/client/RetryDialog.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function RetryDialog({ candidates, t, onRetry, onClose }) {
  const [selection, setSelection] = (0, import_react5.useState)(() => defaultSelection(candidates));
  const [sending, setSending] = (0, import_react5.useState)(false);
  const [failures, setFailures] = (0, import_react5.useState)(() => /* @__PURE__ */ new Map());
  const selected = selectedIds(candidates, selection);
  const everything = allRetryableSelected(candidates, selection);
  (0, import_react5.useEffect)(() => {
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);
  const run = (0, import_react5.useCallback)(() => {
    if (sending || selected.length === 0) return;
    setSending(true);
    setFailures(/* @__PURE__ */ new Map());
    void onRetry(selected).then((outcome) => {
      setSending(false);
      if (outcome.failed.length === 0) {
        onClose();
        return;
      }
      setFailures(new Map(outcome.failed.map((failure) => [failure.id, failure.message])));
    }).catch((error) => {
      setSending(false);
      setFailures(new Map(selected.map((id) => [id, String(error?.message ?? error)])));
    });
  }, [onClose, onRetry, selected, sending]);
  if (candidates.length === 0) return null;
  return (0, import_react_dom.createPortal)(
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "div",
      {
        className: "rt-veil",
        onPointerDown: (event) => {
          if (event.target === event.currentTarget) onClose();
        },
        children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "rt-panel", role: "dialog", "aria-modal": "true", "aria-label": t("retry.aria"), children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "rt-head", children: t("retry.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "rt-intro", children: t("retry.intro") }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "rt-tools", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              className: "rt-mini",
              onClick: () => {
                setSelection(toggleAll(candidates, selection));
              },
              children: t(everything ? "retry.selectNone" : "retry.selectAll")
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "rt-list", children: candidates.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: row.running ? "rt-row rt-row-running" : "rt-row", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                className: "rt-check",
                type: "checkbox",
                checked: row.running ? false : selection.has(row.id),
                disabled: row.running,
                "aria-label": row.title,
                onChange: () => {
                  setSelection(toggleOne(selection, row.id));
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "rt-title", children: row.title }),
            row.folder === "" ? null : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "rt-folder", children: row.folder }),
            row.running ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "rt-tag", children: t("retry.running") }) : null,
            failures.has(row.id) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "rt-error", title: failures.get(row.id) ?? "", children: t("retry.failed", { message: failures.get(row.id) ?? "" }) }) : null
          ] }, row.id)) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "rt-foot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", className: "rt-mini", onClick: onClose, children: t("retry.later") }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "rt-send",
                disabled: sending || selected.length === 0,
                onClick: run,
                children: t("retry.send", { count: selected.length })
              }
            )
          ] })
        ] })
      }
    ),
    document.body
  );
}

// src/client/ActivityBell.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var RETRY_BOOT_KEY = "session-radar.retryBoot";
function retryAskedBoot() {
  try {
    const raw = window.localStorage.getItem(RETRY_BOOT_KEY);
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}
function rememberRetryBoot(bootAt) {
  try {
    window.localStorage.setItem(RETRY_BOOT_KEY, String(bootAt));
  } catch {
  }
}
function dayLabel(bucket, t, now) {
  switch (bucket.kind) {
    case "today":
      return t("day.today");
    case "yesterday":
      return t("day.yesterday");
    case "weekday": {
      const weekdays = [
        "day.sun",
        "day.mon",
        "day.tue",
        "day.wed",
        "day.thu",
        "day.fri",
        "day.sat"
      ];
      return t(weekdays[bucket.weekday] ?? "day.sun");
    }
    case "date": {
      const currentYear = new Date(now).getFullYear();
      return bucket.year === currentYear ? t("day.date", { month: bucket.month, day: bucket.day }) : t("day.dateYear", { year: bucket.year, month: bucket.month, day: bucket.day });
    }
  }
}
function statusText(row, t) {
  if (row.manual) return t("row.markedUnread");
  if (row.unread) return t("row.unread");
  if (row.pending !== void 0) return t("row.attention");
  if (row.running) return t("row.running");
  return void 0;
}
function RowMark({ row }) {
  if (row.unread) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "done", size: 8 });
  if (row.pending !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "warning", size: 8 });
  if (row.running) return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing", size: 10 });
  return null;
}
function ActivityRowItem({
  row,
  t,
  onOpen,
  onTogglePin,
  onArchive
}) {
  const title = (0, import_react6.useRef)(null);
  const marquee = useTitleMarquee(title);
  const status = statusText(row, t);
  const label = row.title === "" ? t("row.untitled") : row.title;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      className: row.current ? "ab-row ab-row-current" : "ab-row",
      role: "button",
      tabIndex: 0,
      title: label,
      onPointerEnter: marquee.enter,
      onPointerLeave: marquee.leave,
      onClick: () => {
        onOpen(row.id);
      },
      onKeyDown: (event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onOpen(row.id);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-row-mark", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RowMark, { row }) }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ab-row-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-row-title", ref: title, children: label }),
          row.folder !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ab-row-folder", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 12 }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-row-folder-text", children: row.folder })
          ] }),
          status !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-sr-only", children: status })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ab-row-tail", children: [
          row.pinned && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-pin-mark", role: "img", "aria-label": t("row.pinned"), title: t("row.pinned"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconPinFillRegular, { size: 12 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ab-row-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t(row.pinned ? "action.unpin" : "action.pin"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "ab-icon-button",
                "aria-label": t(row.pinned ? "action.unpin" : "action.pin"),
                onClick: (event) => {
                  event.stopPropagation();
                  onTogglePin(row);
                },
                children: row.pinned ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 14 })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t("action.archive"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "ab-icon-button",
                "aria-label": t("action.archive"),
                onClick: (event) => {
                  event.stopPropagation();
                  onArchive(row);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 })
              }
            ) })
          ] })
        ] })
      ]
    }
  );
}
function relativeWhen(updatedAt, now, t) {
  const minutes = Math.floor(Math.max(0, now - updatedAt) / 6e4);
  if (minutes < 1) return t("when.now");
  if (minutes < 60) return t("when.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("when.hours", { count: hours });
  return t("when.days", { count: Math.floor(hours / 24) });
}
function attentionLabel(kind, t) {
  switch (kind) {
    case "approval":
      return t("attention.approval");
    case "plan-review":
      return t("attention.planReview");
    case "question":
      return t("attention.question");
  }
}
function WaitingCard({
  card,
  selected,
  now,
  t,
  onOpen
}) {
  const label = card.title === "" ? t("row.untitled") : card.title;
  const classes = ["ov-card"];
  if (selected) classes.push("ov-card-sel");
  if (card.current) classes.push("ov-card-current");
  return (
    // A card is its own button: the whole surface is the open affordance, and
    // the window renders no inner controls that would nest inside it.
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        className: classes.join(" "),
        title: label,
        onClick: () => {
          onOpen(card.id);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-card-title", children: label }),
          card.pending !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-tag", children: attentionLabel(card.pending, t) }) : card.unread ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-tag ov-tag-unread", children: t("row.unread") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "ov-card-meta", children: [
            card.folder !== "" && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-card-folder", children: card.folder }),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-card-when", children: relativeWhen(card.updatedAt, now, t) })
          ] })
        ]
      }
    )
  );
}
function WaitingZone({
  zone,
  cards,
  cursor,
  now,
  t,
  onOpen
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "ov-zone ov-zone-" + zone, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ov-zone-title", children: [
      t(zone === "ask" ? "overview.zone.ask" : "overview.zone.unread"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-zone-count", children: cards.length })
    ] }),
    cards.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ov-zone-empty", children: t("overview.zoneEmpty") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ov-grid", children: cards.map((card) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      WaitingCard,
      {
        card,
        selected: cursor?.zone === zone && cards[cursor.index]?.id === card.id,
        now,
        t,
        onOpen
      },
      card.id
    )) })
  ] });
}
function WaitingWindow({
  waiting,
  cursor,
  now,
  t,
  onOpen,
  onClose
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    "div",
    {
      className: "ov-veil",
      onPointerDown: (event) => {
        if (event.target === event.currentTarget) onClose();
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ov-panel", role: "dialog", "aria-modal": "true", "aria-label": t("overview.aria"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ov-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-title", children: t("overview.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-counts", children: t("overview.counts", {
            unread: waiting.unread.length,
            ask: waiting.ask.length
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-grow" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-hint", children: t("overview.hint") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "ov-close", onClick: onClose, children: t("overview.close") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ov-kbd", children: "Esc" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ov-body", children: waiting.ask.length === 0 && waiting.unread.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ov-empty", children: t("overview.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            WaitingZone,
            {
              zone: "ask",
              cards: waiting.ask,
              cursor,
              now,
              t,
              onOpen
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            WaitingZone,
            {
              zone: "unread",
              cards: waiting.unread,
              cursor,
              now,
              t,
              onOpen
            }
          )
        ] }) })
      ] })
    }
  );
}
function useSnapshot(source) {
  const subscribe = (0, import_react6.useCallback)((listener) => source.subscribe(listener), [source]);
  const read2 = (0, import_react6.useCallback)(() => source.getSnapshot(), [source]);
  return (0, import_react6.useSyncExternalStore)(subscribe, read2, read2);
}
function useManualUnread() {
  const [marked, setMarked] = (0, import_react6.useState)(() => readManualUnread());
  (0, import_react6.useEffect)(() => watchManualUnread(setMarked), []);
  return marked;
}
function useMinuteTick() {
  const [now, setNow] = (0, import_react6.useState)(() => Date.now());
  (0, import_react6.useEffect)(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 6e4);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}
function isNode(value) {
  return typeof value === "object" && value !== null && typeof value.nodeType === "number";
}
function useHosts(anchors, wide, active) {
  const [hosts, setHosts] = (0, import_react6.useState)({ bell: null, panel: null });
  (0, import_react6.useLayoutEffect)(() => {
    if (anchors === void 0 || !wide) {
      setHosts((current) => current.bell === null ? current : { bell: null, panel: current.panel });
      return;
    }
    const bell = mountContainer(anchors.header, anchors.actions, "ab-bell-host");
    setHosts((current) => ({ bell, panel: current.panel }));
    return () => {
      bell.remove();
    };
  }, [anchors, wide]);
  (0, import_react6.useLayoutEffect)(() => {
    if (anchors === void 0 || !wide || !active || anchors.listArea === null) {
      setHosts((current) => current.panel === null ? current : { bell: current.bell, panel: null });
      return;
    }
    const listArea = anchors.listArea;
    const restorePosition = ensurePositioned(listArea);
    const panel = mountContainer(listArea, null, "ab-panel-host");
    applyRowInset(panel, measureRowInset(listArea));
    setHosts((current) => ({ bell: current.bell, panel }));
    return () => {
      panel.remove();
      restorePosition();
    };
  }, [anchors, wide, active]);
  return hosts;
}
function ActivityBell({
  wide,
  t,
  openSession,
  pinSession,
  unpinSession,
  archiveSession,
  retrySession,
  sessions,
  statuses,
  workspaces,
  ledger,
  unreadJump,
  askJump,
  overviewJump,
  metricJump
}) {
  const anchors = useSidebarAnchors();
  const list = useSnapshot(sessions);
  const statusMap = useSnapshot(statuses);
  const workspaceSnapshot = useSnapshot(workspaces);
  const manualUnread = useManualUnread();
  const tail = useFollowingTailSession();
  const opened = useUserOpenedSession();
  const now = useMinuteTick();
  const [active, setActive] = (0, import_react6.useState)(false);
  const [waitingOpen, setWaitingOpen] = (0, import_react6.useState)(false);
  const [waitingCursor, setWaitingCursor] = (0, import_react6.useState)(null);
  const [pending, setPending] = (0, import_react6.useState)(() => /* @__PURE__ */ new Set());
  const facts = (0, import_react6.useRef)(void 0);
  const [notice, setNotice] = (0, import_react6.useState)(null);
  const noticeTimer = (0, import_react6.useRef)(0);
  const hosts = useHosts(anchors, wide, active);
  (0, import_react6.useEffect)(() => {
    const current = sessionFacts(list, statusMap);
    const previous = facts.current;
    facts.current = current;
    setPending((currentPending) => nextPending(currentPending, previous, current));
    if (tail !== null && previous?.get(tail)?.running === true && current.get(tail)?.running === false) {
      ledger.read(tail);
    }
  }, [list, statusMap, tail, ledger]);
  const ledgerSnapshot = (0, import_react6.useSyncExternalStore)(
    (0, import_react6.useCallback)((listener) => ledger.subscribe(listener), [ledger]),
    (0, import_react6.useCallback)(() => ledger.getSnapshot(), [ledger])
  );
  const ledgerUnread = (0, import_react6.useMemo)(() => {
    const ids = /* @__PURE__ */ new Set();
    for (const row of ledgerSnapshot.unread) ids.add(row.sessionId);
    return ids;
  }, [ledgerSnapshot]);
  const reminder = (0, import_react6.useMemo)(
    () => ledgerSnapshot.unread.find((row) => row.sessionId === tail) ?? null,
    [ledgerSnapshot, tail]
  );
  const restored = (0, import_react6.useRef)(null);
  const shown = (0, import_react6.useMemo)(() => currentSessionId(list), [list]);
  (0, import_react6.useEffect)(() => {
    if (restored.current !== null || shown === null) return;
    if (opened.current === shown) return;
    restored.current = shown;
  }, [shown, opened.current]);
  const retryCandidates = (0, import_react6.useMemo)(() => buildRetryCandidates({
    reminders: ledgerSnapshot.unread,
    sessions: list,
    workspaces: workspaceSnapshot
  }), [ledgerSnapshot, list, workspaceSnapshot]);
  const [retryOpen, setRetryOpen] = (0, import_react6.useState)(false);
  (0, import_react6.useEffect)(() => {
    if (retryOpen || retryCandidates.length === 0) return;
    if (ledgerSnapshot.bootAt === 0) return;
    if (retryAskedBoot() === ledgerSnapshot.bootAt) return;
    setRetryOpen(true);
  }, [retryOpen, retryCandidates.length, ledgerSnapshot.bootAt]);
  const closeRetry = (0, import_react6.useCallback)(() => {
    setRetryOpen(false);
    rememberRetryBoot(ledgerSnapshot.bootAt);
  }, [ledgerSnapshot.bootAt]);
  const runRetry = (0, import_react6.useCallback)((ids) => retrySelected({
    ids,
    send: retrySession,
    // The row may stand in for subagents that nothing else can reach, so an
    // accepted prompt spends their reminders in the same read.
    acknowledge: (id) => {
      ledger.read(id, { acknowledgeInterrupt: true, also: candidateSources(retryCandidates, id) });
    }
  }), [retrySession, ledger, retryCandidates]);
  (0, import_react6.useEffect)(() => {
    if (tail === null || !pending.has(tail)) return;
    setPending((current) => {
      const next = new Set(current);
      next.delete(tail);
      return next;
    });
  }, [tail, pending]);
  (0, import_react6.useEffect)(() => {
    const next = tailLedgerRead({
      tail,
      reminder,
      restored: restored.current,
      openedByUser: opened.current
    });
    if (!next.send) return;
    ledger.read(tail, next.acknowledgeInterrupt ? { acknowledgeInterrupt: true } : void 0);
  }, [tail, reminder, ledger, opened.current, restored]);
  const acknowledge = (0, import_react6.useCallback)((sessionId) => {
    setPending((current) => {
      if (!current.has(sessionId)) return current;
      const next = new Set(current);
      next.delete(sessionId);
      return next;
    });
    ledger.read(sessionId);
  }, [ledger]);
  const inputs = (0, import_react6.useMemo)(() => ({
    sessions: list,
    statuses: statusMap,
    workspaces: workspaceSnapshot,
    completedSince: pending,
    ledgerUnread,
    viewingTail: tail,
    manualUnread
  }), [list, statusMap, workspaceSnapshot, pending, ledgerUnread, tail, manualUnread]);
  const view = (0, import_react6.useMemo)(() => ({
    groups: buildActivityGroups(inputs, now),
    unread: countUnread(inputs),
    pendingCount: countPending(inputs)
  }), [inputs, now]);
  const { groups, unread, pendingCount } = view;
  const waiting = (0, import_react6.useMemo)(() => buildOverview(inputs, now), [inputs, now]);
  const unreadOrder = (0, import_react6.useMemo)(
    () => groups.flatMap((group) => group.rows.filter((row) => row.unread).map((row) => row.id)),
    [groups]
  );
  const askOrder = (0, import_react6.useMemo)(
    () => groups.flatMap((group) => group.rows.filter((row) => row.pending !== void 0).map((row) => row.id)).reverse(),
    [groups]
  );
  const cursor = (0, import_react6.useRef)(null);
  const askTrail = (0, import_react6.useRef)([]);
  const jumpBuckets = (0, import_react6.useMemo)(
    () => classifySessions(list, workspaceSnapshot.archivedSessionIds, statusMap),
    [list, workspaceSnapshot, statusMap]
  );
  const metricCursor = (0, import_react6.useRef)({});
  const revealSession = (0, import_react6.useCallback)((target) => {
    const listArea2 = anchors?.listArea ?? null;
    const row = findSessionRow(listArea2, target);
    if (row !== void 0) revealRow(row);
    else {
      const key = owningWorkspaceKey(workspaceSnapshot.items, target);
      if (key !== void 0 && expandOwningGroup(listArea2, key)) {
        window.requestAnimationFrame(() => {
          const revealed = findSessionRow(listArea2, target);
          if (revealed !== void 0) revealRow(revealed);
        });
      }
    }
  }, [anchors, workspaceSnapshot]);
  const openByUser = (0, import_react6.useCallback)((target) => {
    opened.mark(target);
    openSession(target);
  }, [openSession, opened.mark]);
  const jumpNextUnread = (0, import_react6.useCallback)(() => {
    const target = nextUnreadId(unreadOrder, cursor.current);
    if (target === null) return;
    cursor.current = target;
    revealSession(target);
    acknowledge(target);
    openByUser(target);
  }, [acknowledge, openByUser, revealSession, unreadOrder]);
  const jumpNextAsk = (0, import_react6.useCallback)(() => {
    const step = nextAskJump(askOrder, currentSessionId(list), askTrail.current);
    askTrail.current = step.stack;
    if (step.target === null) return;
    revealSession(step.target);
    openByUser(step.target);
  }, [askOrder, list, openByUser, revealSession]);
  const jumpMetric = (0, import_react6.useCallback)((metric) => {
    if (metric === "unread") {
      jumpNextUnread();
      return;
    }
    if (metric === "pending") {
      jumpNextAsk();
      return;
    }
    const target = nextUnreadId(jumpBuckets[metric], metricCursor.current[metric] ?? null);
    if (target === null) return;
    metricCursor.current[metric] = target;
    revealSession(target);
    acknowledge(target);
    openByUser(target);
  }, [acknowledge, jumpBuckets, jumpNextAsk, jumpNextUnread, openByUser, revealSession]);
  const activeCursor = waitingCursor ?? seedCursor(waiting);
  const toggleWaiting = (0, import_react6.useCallback)(() => {
    setActive(false);
    setWaitingCursor(null);
    setWaitingOpen((current) => !current);
  }, []);
  const closeWaiting = (0, import_react6.useCallback)(() => {
    setWaitingOpen(false);
    setWaitingCursor(null);
  }, []);
  const openWaitingCard = (0, import_react6.useCallback)((sessionId) => {
    acknowledge(sessionId);
    openByUser(sessionId);
    closeWaiting();
  }, [acknowledge, openByUser, closeWaiting]);
  (0, import_react6.useEffect)(() => {
    if (!waitingOpen) return;
    const onKeyDown = (event) => {
      const step = event.key === "ArrowDown" ? "down" : event.key === "ArrowUp" ? "up" : event.key === "ArrowRight" ? "right" : event.key === "ArrowLeft" ? "left" : null;
      if (step !== null) {
        event.preventDefault();
        setWaitingCursor((current) => moveCursor(current, waiting, step));
        return;
      }
      if (event.key === "Enter") {
        const card = selectedCard(waiting, activeCursor);
        if (card === null) return;
        event.preventDefault();
        openWaitingCard(card.id);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeWaiting();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [waitingOpen, waiting, activeCursor, openWaitingCard, closeWaiting]);
  (0, import_react6.useEffect)(() => unreadJump.publish({
    available: () => unreadOrder.length > 0,
    run: jumpNextUnread
  }), [unreadJump, jumpNextUnread, unreadOrder]);
  (0, import_react6.useEffect)(() => askJump.publish({
    available: () => askOrder.length > 0 || askTrail.current.length > 0,
    run: jumpNextAsk
  }), [askJump, jumpNextAsk, askOrder]);
  (0, import_react6.useEffect)(() => overviewJump.publish({
    available: () => true,
    run: toggleWaiting
  }), [overviewJump, toggleWaiting]);
  (0, import_react6.useEffect)(() => metricJump.publish({ run: jumpMetric }), [metricJump, jumpMetric]);
  (0, import_react6.useEffect)(() => {
    if (!wide) setActive(false);
  }, [wide]);
  (0, import_react6.useEffect)(() => {
    if (!active) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActive(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
  (0, import_react6.useEffect)(() => {
    if (!active) return;
    const bellHost = hosts.bell;
    const panelHost2 = hosts.panel;
    const header = anchors?.header;
    if (header === void 0) return;
    const sidebar = header.closest('[class*="regionArea"]')?.parentElement ?? header.parentElement;
    if (sidebar === null) return;
    const onPointerDown = (event) => {
      const target = event.target;
      if (!isNode(target)) return;
      if (panelHost2?.contains(target) === true) return;
      if (bellHost?.contains(target) === true) return;
      if (!sidebar.contains(target)) return;
      setActive(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [active, anchors, hosts.bell, hosts.panel]);
  (0, import_react6.useEffect)(() => () => {
    window.clearTimeout(noticeTimer.current);
  }, []);
  const showNotice = (0, import_react6.useCallback)((message) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
    }, 4e3);
  }, []);
  const togglePin = (0, import_react6.useCallback)((row) => {
    const call = row.pinned ? unpinSession : pinSession;
    call(row.id).catch(() => {
    });
  }, [pinSession, unpinSession]);
  const archive = (0, import_react6.useCallback)((row) => {
    archiveSession(row.id).catch(() => {
      showNotice(t("action.archiveFailed"));
    });
  }, [archiveSession, showNotice, t]);
  const listArea = anchors?.listArea ?? null;
  const panelHost = hosts.panel;
  (0, import_react6.useLayoutEffect)(() => {
    if (!active || listArea === null || panelHost === null) return;
    const covered = [...listArea.children].filter((child) => child !== panelHost).map((child) => child);
    for (const element of covered) element.inert = true;
    return () => {
      for (const element of covered) element.inert = false;
    };
  }, [active, listArea, panelHost]);
  if (hosts.bell === null) return null;
  const baseLabel = active ? t("bell.hide") : unread > 0 ? t("bell.showUnread", { count: unread }) : t("bell.noUnread");
  const label = pendingCount > 0 ? baseLabel + " \xB7 " + t("bell.pending", { count: pendingCount }) : baseLabel;
  const bell = /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_dsh_client_ui_primitives.Tooltip,
    {
      label: active ? label : label + " \xB7 " + t("bell.openActivity"),
      side: "bottom",
      delayMs: 400,
      align: "end",
      children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "button",
        {
          type: "button",
          className: active ? "ab-bell ab-bell-active" : "ab-bell",
          "aria-label": label,
          "aria-pressed": active,
          onClick: jumpNextUnread,
          onContextMenu: (event) => {
            event.preventDefault();
            setActive((value) => !value);
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BellIcon, { size: 16 }),
            unread > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-badge", "aria-hidden": "true", children: unread > 99 ? "99+" : String(unread) }),
            pendingCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "ab-badge ab-badge-ask", "aria-hidden": "true", children: pendingCount > 99 ? "99+" : String(pendingCount) })
          ]
        }
      )
    }
  );
  const panel = /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "ab-panel", role: "region", "aria-label": t("panel.aria"), children: [
    notice !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ab-panel-notice", role: "status", children: notice }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ab-panel-scroll", children: groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ab-empty", children: t("panel.empty") }) : groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "ab-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "ab-group-label", children: dayLabel(group.bucket, t, now) }),
      group.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        ActivityRowItem,
        {
          row,
          t,
          onOpen: (sessionId) => {
            acknowledge(sessionId);
            openByUser(sessionId);
          },
          onTogglePin: togglePin,
          onArchive: archive
        },
        row.id
      ))
    ] }, group.key)) })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
    (0, import_react_dom2.createPortal)(bell, hosts.bell),
    active && hosts.panel !== null ? (0, import_react_dom2.createPortal)(panel, hosts.panel) : null,
    waitingOpen ? (0, import_react_dom2.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        WaitingWindow,
        {
          waiting,
          cursor: activeCursor,
          now,
          t,
          onOpen: openWaitingCard,
          onClose: closeWaiting
        }
      ),
      document.body
    ) : null,
    retryOpen ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(RetryDialog, { candidates: retryCandidates, t, onRetry: runRetry, onClose: closeRetry }) : null
  ] });
}

// src/client/config-source.ts
function read(form) {
  let value = {};
  try {
    value = form.getSnapshot()?.value ?? {};
  } catch {
    value = {};
  }
  return {
    threshold: normalizeThreshold(value.threshold),
    variant: normalizeVariant(value.variant),
    visibility: normalizeVisibility(value),
    rowBadge: normalizeRowBadge(value.showRowBadge)
  };
}
function sameVisibility(left, right) {
  for (const metric of METRICS) if (left[metric] !== right[metric]) return false;
  return true;
}
function sameConfig(left, right) {
  return left.threshold === right.threshold && left.variant === right.variant && left.rowBadge === right.rowBadge && sameVisibility(left.visibility, right.visibility);
}
function createConfigSource(form) {
  let current = read(form);
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    if (sameConfig(next, current)) return;
    current = next;
    for (const listener of [...listeners]) listener();
  };
  const unsubscribe = form.subscribe(() => {
    publish(read(form));
  });
  const write = async (field, value) => {
    let accepted = false;
    try {
      accepted = await form.set(field, value);
    } catch {
      accepted = false;
    }
    if (!accepted) publish(read(form));
    return accepted;
  };
  return {
    getSnapshot: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setThreshold: (value) => {
      const next = normalizeThreshold(value);
      publish({ ...current, threshold: next });
      return write("threshold", next);
    },
    setVisible: (metric, visible2) => {
      publish({ ...current, visibility: { ...current.visibility, [metric]: visible2 } });
      return write(METRIC_FIELD[metric], visible2);
    },
    setVariant: (variant) => {
      publish({ ...current, variant });
      return write("variant", variant);
    },
    setRowBadge: (value) => {
      publish({ ...current, rowBadge: value });
      return write("showRowBadge", value);
    },
    dispose: () => {
      unsubscribe();
      listeners.clear();
    }
  };
}

// src/client/jump-command.ts
function createJumpSeat() {
  let current = null;
  return {
    publish(handler) {
      current = handler;
      return () => {
        if (current === handler) current = null;
      };
    },
    current: () => current
  };
}
var UNREAD_JUMP_COMMAND = "session-radar.jumpUnread";
var ASK_JUMP_COMMAND = "session-radar.jumpAsk";
var UNREAD_JUMP_DEFAULTS = {
  "desktop:macos": { code: "KeyJ", modifiers: ["primary", "shift"] },
  "desktop:windows": { code: "KeyJ", modifiers: ["primary", "alt"] },
  "desktop:linux": { code: "KeyJ", modifiers: ["primary", "alt"] },
  "web:macos": { code: "KeyJ", modifiers: ["primary", "shift"] },
  "web:windows": { code: "KeyJ", modifiers: ["primary", "alt"] }
};
var ASK_JUMP_DEFAULTS = {
  "desktop:macos": { code: "KeyI", modifiers: ["primary", "shift"] },
  "desktop:windows": { code: "KeyI", modifiers: ["primary", "alt"] },
  "desktop:linux": { code: "KeyI", modifiers: ["primary", "alt"] },
  "web:macos": { code: "KeyI", modifiers: ["primary", "shift"] },
  "web:windows": { code: "KeyI", modifiers: ["primary", "alt"] }
};
var OVERVIEW_COMMAND = "session-radar.overview";
var OVERVIEW_DEFAULTS = {
  "desktop:macos": { code: "KeyK", modifiers: ["primary", "shift"] },
  "desktop:windows": { code: "KeyK", modifiers: ["primary", "shift"] },
  "desktop:linux": { code: "KeyK", modifiers: ["primary", "shift"] },
  "web:macos": { code: "KeyK", modifiers: ["primary", "shift"] },
  "web:windows": { code: "KeyK", modifiers: ["primary", "shift"] }
};
function seatCommand(id, seat, label, unavailable, aliases, defaults) {
  return {
    id,
    label,
    aliases: [...aliases],
    defaults,
    regions: ["page", "editable"],
    modals: [],
    resolve: () => {
      const handler = seat.current();
      if (handler === null || !handler.available()) {
        return { status: "blocked", reason: unavailable };
      }
      return { status: "handled", run: () => {
        handler.run();
      } };
    }
  };
}
function unreadJumpCommand(seat, label, unavailable) {
  return seatCommand(
    UNREAD_JUMP_COMMAND,
    seat,
    label,
    unavailable,
    ["jump to next unread", "next unread", "unread"],
    UNREAD_JUMP_DEFAULTS
  );
}
function askJumpCommand(seat, label, unavailable) {
  return seatCommand(
    ASK_JUMP_COMMAND,
    seat,
    label,
    unavailable,
    ["jump to pending ask", "next ask", "pending ask"],
    ASK_JUMP_DEFAULTS
  );
}
function overviewCommand(seat, label, unavailable) {
  return seatCommand(
    OVERVIEW_COMMAND,
    seat,
    label,
    unavailable,
    ["overview", "waiting overview", "unread and pending"],
    OVERVIEW_DEFAULTS
  );
}

// src/client/ledger-source.ts
var ROUTE = "/session-radar";
var POLL_MS = 5e3;
var BOOT_SETTLE_MS = 3e3;
var EMPTY = {
  now: 0,
  bootAt: 0,
  unread: [],
  error: null
};
function createLedgerSource(_ctx, sessions) {
  let snapshot = EMPTY;
  let disposed = false;
  let settled = false;
  let bootMain = null;
  const listeners = /* @__PURE__ */ new Set();
  const publish = (next) => {
    snapshot = next;
    for (const listener of [...listeners]) listener();
  };
  const settleTimer = setTimeout(() => {
    settled = true;
  }, BOOT_SETTLE_MS);
  settleTimer.unref?.();
  async function post(endpoint, body) {
    const response = await fetch(ROUTE + "/" + endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const payload = await response.json();
    if (payload?.ok !== true || payload.value === void 0) {
      throw new Error("session-radar: host refused " + endpoint + " (HTTP " + String(response.status) + ")");
    }
    return { ...payload.value, error: null };
  }
  async function refresh() {
    if (disposed) return;
    try {
      const next = await post("list");
      if (!disposed) publish(next);
    } catch (error) {
      if (!disposed) publish({ ...snapshot, error: String(error?.message ?? error) });
    }
  }
  const onSessionsChanged = () => {
    const current = currentSessionId(sessions.getSnapshot());
    if (current === null) return;
    if (!settled) {
      bootMain ?? (bootMain = current);
      return;
    }
    if (current === bootMain) return;
    bootMain = current;
    source.read(current);
  };
  const poll = setInterval(() => void refresh(), POLL_MS);
  poll.unref?.();
  const source = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    read: (sessionId, options) => {
      const body = options?.acknowledgeInterrupt === true ? { sessionId, acknowledgeInterrupt: true } : { sessionId };
      if (options?.also !== void 0 && options.also.length > 0) body.also = [...options.also];
      void post("read", body).then((next) => {
        if (!disposed) publish(next);
      }).catch((error) => {
        if (!disposed) publish({ ...snapshot, error: String(error?.message ?? error) });
      });
    }
  };
  const unsubscribe = sessions.subscribe(onSessionsChanged);
  void refresh();
  _ctx.effect(() => () => {
    disposed = true;
    clearInterval(poll);
    clearTimeout(settleTimer);
    unsubscribe();
    listeners.clear();
  }, "session-radar: bridge teardown");
  return source;
}

// src/client/metric-jump.ts
var JUMP_METRICS = ["running", "unread", "pending", "idle", "unarchived"];
function isJumpMetric(value) {
  return typeof value === "string" && JUMP_METRICS.includes(value);
}
function createMetricJumpSeat() {
  let current = null;
  return {
    publish(handler) {
      current = handler;
      return () => {
        if (current === handler) current = null;
      };
    },
    current: () => current,
    run(metric) {
      current?.run(metric);
    }
  };
}

// src/client/locales.ts
var zh = {
  "bell.show": "\u5B9A\u4F4D\u4E0B\u4E00\u4E2A\u672A\u8BFB",
  "bell.hide": "\u6253\u5F00\u6700\u8FD1\u6D3B\u52A8",
  "bell.showUnread": "\u5B9A\u4F4D\u4E0B\u4E00\u4E2A\u672A\u8BFB\uFF0C{count} \u4E2A\u4F1A\u8BDD\u5DF2\u5B8C\u6210\u672A\u67E5\u770B",
  "bell.noUnread": "\u6CA1\u6709\u672A\u8BFB\u4F1A\u8BDD",
  "bell.jumpAsk": "\u5B9A\u4F4D\u7B49\u5F85\u5904\u7406",
  "bell.noAsk": "\u6CA1\u6709\u7B49\u5F85\u5904\u7406\u7684\u4F1A\u8BDD",
  "bell.pending": "\u7B49\u5F85\u4F60\u5904\u7406 {count} \u4E2A",
  "bell.openActivity": "\u53F3\u952E\uFF1A\u6253\u5F00\u6700\u8FD1\u6D3B\u52A8\u5217\u8868",
  "panel.aria": "\u6700\u8FD1\u6D3B\u52A8",
  "panel.empty": "\u8FD8\u6CA1\u6709\u4F1A\u8BDD\u6D3B\u52A8\u3002",
  "overview.open": "\u6253\u5F00\u5F85\u529E\u603B\u89C8",
  "overview.noWaiting": "\u6CA1\u6709\u672A\u8BFB\u6216\u5F85\u51B3\u7B56\u7684\u4F1A\u8BDD",
  "overview.aria": "\u672A\u8BFB\u4E0E\u5F85\u51B3\u7B56\u4F1A\u8BDD\u603B\u89C8",
  "overview.title": "\u7B49\u4F60\u5904\u7406",
  "overview.counts": "\u672A\u8BFB {unread} \xB7 \u5F85\u51B3\u7B56 {ask}",
  "overview.zone.ask": "\u5F85\u51B3\u7B56",
  "overview.zone.unread": "\u672A\u8BFB",
  "overview.zoneEmpty": "\u6682\u65E0",
  "overview.hint": "\u2191\u2193 \u79FB\u52A8 \xB7 \u2190\u2192 \u5207\u533A \xB7 Enter \u6253\u5F00",
  "overview.close": "\u5173\u95ED",
  "overview.empty": "\u6CA1\u6709\u672A\u8BFB\u6216\u5F85\u51B3\u7B56\u7684\u4F1A\u8BDD\u3002",
  "retry.aria": "\u4E0A\u6B21\u4E2D\u65AD\u7684\u4EFB\u52A1",
  "retry.title": "\u4E0A\u6B21\u4E2D\u65AD\u7684\u4EFB\u52A1",
  "retry.intro": "\u5BA2\u6237\u7AEF\u4E0A\u6B21\u610F\u5916\u9000\u51FA\uFF0C\u8FD9\u4E9B\u4F1A\u8BDD\u7684\u56DE\u5408\u88AB\u6253\u65AD\u4E86\u3002\u52FE\u9009\u8981\u63A5\u7740\u8DD1\u7684\uFF0C\u4E00\u952E\u628A\u7EED\u8DD1\u6D88\u606F\u53D1\u8FC7\u53BB\uFF1B\u6CA1\u52FE\u7684\u7EE7\u7EED\u7559\u5728\u672A\u8BFB\u91CC\u3002",
  "retry.selectAll": "\u5168\u9009",
  "retry.selectNone": "\u5168\u4E0D\u9009",
  "retry.send": "\u91CD\u8BD5\u9009\u4E2D {count} \u4E2A",
  "retry.later": "\u7A0D\u540E\u5904\u7406",
  "retry.running": "\u6B63\u5728\u8DD1",
  "retry.failed": "\u53D1\u9001\u5931\u8D25\uFF1A{message}",
  "retry.unavailable": "\u8FD9\u4E2A\u4F1A\u8BDD\u6682\u65F6\u6253\u4E0D\u5F00",
  "retry.continueMessage": "\u3010\u7CFB\u7EDF\u6D88\u606F\u3011\u672C\u6B21\u4F1A\u8BDD\u56E0\u5BA2\u6237\u7AEF\u610F\u5916\u9000\u51FA\u800C\u4E2D\u65AD\u3002\u8BF7\u7EE7\u7EED\u4E2D\u65AD\u524D\u7684\u4EFB\u52A1\uFF1A\u5148\u67E5\u770B\u4E0A\u4E00\u6B21\u5DE5\u5177\u8C03\u7528\u7684\u7ED3\u679C\uFF0C\u907F\u514D\u91CD\u590D\u6267\u884C\u5DF2\u7ECF\u5B8C\u6210\u7684\u8C03\u7528\uFF1B\u540C\u65F6\u68C0\u67E5\u5B50\u4EE3\u7406\u7684\u60C5\u51B5\uFF0C\u5224\u65AD\u4EFB\u52A1\u662F\u5426\u5931\u8D25\uFF08\u5982\u679C\u4F60\u6CA1\u6709\u5B50\u4EE3\u7406\uFF0C\u5219\u5FFD\u89C6\u8FD9\u4E00\u9879\u3002\uFF09\u9664\u7EE7\u7EED\u5B8C\u6210\u539F\u4EFB\u52A1\u5916\uFF0C\u4E0D\u8981\u6539\u52A8\u4EFB\u52A1\u7684\u76EE\u6807\u4E0E\u8303\u56F4\u3002",
  "attention.approval": "\u5BA1\u6279",
  "attention.planReview": "\u8BA1\u5212\u5BA1\u9605",
  "attention.question": "\u63D0\u95EE",
  "when.now": "\u521A\u521A",
  "when.minutes": "{count} \u5206\u949F",
  "when.hours": "{count} \u5C0F\u65F6",
  "when.days": "{count} \u5929",
  "row.untitled": "\u672A\u547D\u540D\u4F1A\u8BDD",
  "row.unread": "\u5DF2\u5B8C\u6210\u672A\u67E5\u770B",
  "row.markedUnread": "\u6807\u4E3A\u672A\u8BFB",
  "row.running": "\u8FD0\u884C\u4E2D",
  "row.attention": "\u7B49\u5F85\u4F60\u5904\u7406",
  "row.pinned": "\u5DF2\u7F6E\u9876",
  "action.pin": "\u7F6E\u9876",
  "action.unpin": "\u53D6\u6D88\u7F6E\u9876",
  "action.archive": "\u5F52\u6863",
  "action.archiveFailed": "\u5F52\u6863\u5931\u8D25\uFF1A\u8BE5\u4F1A\u8BDD\u8FD8\u6709\u8FD0\u884C\u4E2D\u7684\u5DE5\u4F5C",
  "day.today": "\u4ECA\u5929",
  "day.yesterday": "\u6628\u5929",
  "day.sun": "\u661F\u671F\u65E5",
  "day.mon": "\u661F\u671F\u4E00",
  "day.tue": "\u661F\u671F\u4E8C",
  "day.wed": "\u661F\u671F\u4E09",
  "day.thu": "\u661F\u671F\u56DB",
  "day.fri": "\u661F\u671F\u4E94",
  "day.sat": "\u661F\u671F\u516D",
  "day.date": "{month}\u6708{day}\u65E5",
  "day.dateYear": "{year}\u5E74{month}\u6708{day}\u65E5",
  "metric.running": "\u8FD0\u884C\u4E2D",
  "metric.unread": "\u672A\u8BFB",
  "metric.pending": "\u5F85\u5904\u7406",
  "metric.idle": "\u95F2\u7F6E",
  "metric.unarchived": "\u672A\u5F52\u6863",
  "metric.archived": "\u5DF2\u5F52\u6863",
  "watch.aria": "\u4F1A\u8BDD\u72B6\u6001\uFF1A{summary}",
  "watch.summaryItem": "{label} {count} \u4E2A",
  "watch.summaryJoin": "\uFF0C",
  "watch.railHint": "\u4F1A\u8BDD\u72B6\u6001 \xB7 {unarchived} \u4E2A\u672A\u5F52\u6863",
  "watch.warn": "\u672A\u5F52\u6863 {count} \u4E2A\uFF0C\u5DF2\u8D85\u8FC7\u9608\u503C {threshold} \u4E2A",
  "watch.jump": "{label} {count} \u4E2A\uFF0C\u70B9\u51FB\u8DF3\u5230\u4E0B\u4E00\u4E2A",
  "watch.jumpHint": "\u70B9\u51FB\u56FE\u6807\u53EF\u8DF3\u5230\u4E0B\u4E00\u4E2A\u540C\u7C7B\u4F1A\u8BDD",
  "watch.empty": "\u6CA1\u6709\u8981\u663E\u793A\u7684\u8BA1\u6570\u9879",
  "row.title": "\u4F1A\u8BDD\u72B6\u6001\u8BFB\u6570",
  "row.description": "\u9009\u62E9\u4FA7\u8FB9\u680F\u5E95\u90E8\u8BFB\u6570\u663E\u793A\u54EA\u4E9B\u4F1A\u8BDD\u8BA1\u6570\u3002\u5F53\u524D\uFF1A{summary}",
  "row.showLabel": "\u663E\u793A\u9879\u76EE",
  "row.variantLabel": "\u7248\u5F0F",
  "row.variant.chips": "\u80F6\u56CA",
  "row.variant.meter": "\u6BD4\u4F8B\u6761",
  "row.thresholdLabel": "\u672A\u5F52\u6863\u544A\u8B66\u9608\u503C",
  "row.thresholdHint": "\u672A\u5F52\u6863\u8D85\u8FC7\u8BE5\u6570\u91CF\u65F6\uFF0C\u672A\u5F52\u6863\u8BA1\u6570\u8FDB\u5165\u544A\u8B66\u8272\u3002",
  "row.inputLabel": "\u672A\u5F52\u6863\u4F1A\u8BDD\u9608\u503C",
  "row.badgeLabel": "\u91CD\u542F\u540E\u4FDD\u7559\u672A\u8BFB\u5C0F\u6807",
  "row.saveFailed": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5"
};
var en = {
  "bell.show": "Jump to next unread",
  "bell.hide": "Open recent activity",
  "bell.showUnread": "Jump to next unread, {count} sessions finished unviewed",
  "bell.noUnread": "No unread sessions",
  "bell.jumpAsk": "Jump to pending ask",
  "bell.noAsk": "No pending asks",
  "bell.pending": "Waiting on you in {count}",
  "bell.openActivity": "Right-click: recent activity list",
  "panel.aria": "Recent activity",
  "panel.empty": "No session activity yet.",
  "overview.open": "Open waiting overview",
  "overview.noWaiting": "No unread or pending sessions",
  "overview.aria": "Unread and pending session overview",
  "overview.title": "Waiting on you",
  "overview.counts": "Unread {unread} \xB7 Pending {ask}",
  "overview.zone.ask": "Pending",
  "overview.zone.unread": "Unread",
  "overview.zoneEmpty": "None",
  "overview.hint": "\u2191\u2193 move \xB7 \u2190\u2192 switch zone \xB7 Enter opens",
  "overview.close": "Close",
  "overview.empty": "No unread or pending sessions.",
  "retry.aria": "Tasks cut off last time",
  "retry.title": "Tasks cut off last time",
  "retry.intro": "The client exited unexpectedly last time and cut these turns off. Pick the ones to resume and send the continue message in one go; anything you leave unchecked stays unread.",
  "retry.selectAll": "Select all",
  "retry.selectNone": "Select none",
  "retry.send": "Retry {count} selected",
  "retry.later": "Later",
  "retry.running": "Running",
  "retry.failed": "Send failed: {message}",
  "retry.unavailable": "This session cannot be reached right now",
  "retry.continueMessage": "[System message] This session was interrupted when the client exited unexpectedly. Please continue the task from before the interruption: first review the result of the last tool call and avoid repeating calls that already produced results; also check on your subagents and decide whether the task failed (ignore this item if you have no subagents). Apart from finishing that task, do not change its goal or scope.",
  "attention.approval": "Approval",
  "attention.planReview": "Plan review",
  "attention.question": "Question",
  "when.now": "just now",
  "when.minutes": "{count} min",
  "when.hours": "{count} h",
  "when.days": "{count} d",
  "row.untitled": "Untitled session",
  "row.unread": "Finished, unviewed",
  "row.markedUnread": "Marked unread",
  "row.running": "Running",
  "row.attention": "Waiting for you",
  "row.pinned": "Pinned",
  "action.pin": "Pin",
  "action.unpin": "Unpin",
  "action.archive": "Archive",
  "action.archiveFailed": "Archive failed: this session still has running work",
  "day.today": "Today",
  "day.yesterday": "Yesterday",
  "day.sun": "Sunday",
  "day.mon": "Monday",
  "day.tue": "Tuesday",
  "day.wed": "Wednesday",
  "day.thu": "Thursday",
  "day.fri": "Friday",
  "day.sat": "Saturday",
  "day.date": "{month}/{day}",
  "day.dateYear": "{year}/{month}/{day}",
  "metric.running": "Running",
  "metric.unread": "Unread",
  "metric.pending": "Pending",
  "metric.idle": "Idle",
  "metric.unarchived": "Unarchived",
  "metric.archived": "Archived",
  "watch.aria": "Session status: {summary}",
  "watch.summaryItem": "{label} {count}",
  "watch.summaryJoin": ", ",
  "watch.railHint": "Session status \xB7 {unarchived} unarchived",
  "watch.warn": "Unarchived {count}, above the threshold of {threshold}",
  "watch.jump": "{label} {count}, activate to jump to the next one",
  "watch.jumpHint": "Activate an icon to jump to the next Session",
  "watch.empty": "No metric is shown",
  "row.title": "Session status readout",
  "row.description": "Choose which Session counts the sidebar foot readout shows. Currently: {summary}",
  "row.showLabel": "Shown metrics",
  "row.variantLabel": "Layout",
  "row.variant.chips": "Chips",
  "row.variant.meter": "Meter",
  "row.thresholdLabel": "Unarchived warning threshold",
  "row.thresholdHint": "The unarchived count turns warning-coloured above this number.",
  "row.inputLabel": "Unarchived session threshold",
  "row.badgeLabel": "Keep unread dots across restarts",
  "row.saveFailed": "Could not save; try again"
};

// src/client/RowBadge.tsx
var import_react7 = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/row-badge.ts
function ledgerUnreadIds(rows) {
  const ids = /* @__PURE__ */ new Set();
  for (const row of rows) {
    const id = row?.sessionId;
    if (typeof id === "string" && id !== "") ids.add(id);
  }
  return ids;
}

// src/client/RowBadge.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function RowBadge({ sessionId, ledger, config, t }) {
  const watch = (0, import_react7.useSyncExternalStore)(config.subscribe, config.getSnapshot, config.getSnapshot);
  const subscribeLedger = (0, import_react7.useCallback)((listener) => ledger.subscribe(listener), [ledger]);
  const readLedger = (0, import_react7.useCallback)(() => ledger.getSnapshot(), [ledger]);
  const snapshot = (0, import_react7.useSyncExternalStore)(subscribeLedger, readLedger, readLedger);
  if (!watch.rowBadge) return null;
  if (!ledgerUnreadIds(snapshot.unread).has(sessionId)) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_dsh_client_ui_primitives2.StateDot, { state: "done" }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "sw-sr-only", children: t("row.unread") })
  ] });
}

// src/client/SettingsRow.tsx
var import_react8 = require("react");
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");

// src/client/summary.ts
function metricValue(counts, metric) {
  return counts[metric];
}
function metricLabel(t, metric) {
  return t("metric." + metric);
}
function summaryText(t, counts, visibility) {
  const shown = visibleMetrics(visibility);
  if (shown.length === 0) return t("watch.empty");
  const parts = shown.map(
    (metric) => t("watch.summaryItem", { label: metricLabel(t, metric), count: counts[metric] })
  );
  return parts.join(t("watch.summaryJoin"));
}
function unarchivedWarns(counts, threshold) {
  return shouldWarn(counts.unarchived, threshold);
}
var ALL_METRICS = METRICS;

// src/client/use-counts.ts
var EMPTY_STATUSES = /* @__PURE__ */ new Map();
function useSessionCounts({ useSessions, useSessionStatus, useWorkspaces }) {
  const useStatus = typeof useSessionStatus === "function" ? useSessionStatus : (selector) => selector(EMPTY_STATUSES);
  const archived = useWorkspaces((state) => state.archivedSessionIds);
  const statuses = useStatus((state) => state);
  return {
    running: useSessions((state) => countSessions(state, archived, statuses).running),
    unread: useSessions((state) => countSessions(state, archived, statuses).unread),
    pending: useSessions((state) => countSessions(state, archived, statuses).pending),
    idle: useSessions((state) => countSessions(state, archived, statuses).idle),
    unarchived: useSessions((state) => countSessions(state, archived, statuses).unarchived),
    archived: useSessions((state) => countSessions(state, archived, statuses).archived)
  };
}

// src/client/SettingsRow.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function SettingsRow({ useSessions, useSessionStatus, useWorkspaces, config, t }) {
  const watch = (0, import_react8.useSyncExternalStore)(config.subscribe, config.getSnapshot, config.getSnapshot);
  const counts = useSessionCounts({ useSessions, useSessionStatus, useWorkspaces });
  const [draft, setDraft] = (0, import_react8.useState)(String(watch.threshold));
  const [failed, setFailed] = (0, import_react8.useState)(false);
  (0, import_react8.useEffect)(() => {
    setDraft(String(watch.threshold));
    setFailed(false);
  }, [watch.threshold]);
  const commit = () => {
    const parsed = Number.parseInt(draft, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed === watch.threshold) {
      setDraft(String(watch.threshold));
      setFailed(false);
      return;
    }
    void config.setThreshold(parsed).then((accepted) => {
      setFailed(!accepted);
      if (!accepted) setDraft(String(watch.threshold));
    });
  };
  const summary = summaryText(t, counts, watch.visibility);
  const warn = counts.unarchived > watch.threshold;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sw-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sw-row-text", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-row-title", children: t("row.title") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-row-desc", children: t("row.description", { summary }) }),
      failed ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-row-error", children: t("row.saveFailed") }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "sw-row-controls", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "sw-variants", role: "radiogroup", "aria-label": t("row.variantLabel"), children: VARIANTS.map((variant) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        "button",
        {
          type: "button",
          role: "radio",
          "aria-checked": watch.variant === variant,
          className: watch.variant === variant ? "sw-variant sw-variant-on" : "sw-variant",
          onClick: () => {
            void config.setVariant(variant);
          },
          children: t("row.variant." + variant)
        },
        variant
      )) }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("fieldset", { className: "sw-toggles", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("legend", { className: "sw-field-label", children: t("row.showLabel") }),
        ALL_METRICS.map((metric) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "sw-toggle", "data-metric": metric, children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "input",
            {
              type: "checkbox",
              checked: watch.visibility[metric],
              onChange: (event) => {
                void config.setVisible(metric, event.currentTarget.checked);
              }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-toggle-swatch", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(MetricIcon, { metric }) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-toggle-label", children: metricLabel(t, metric) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "span",
            {
              className: "sw-toggle-count",
              "data-warn": metric === "unarchived" && warn ? "true" : void 0,
              children: metricValue(counts, metric)
            }
          )
        ] }, metric))
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "sw-toggle sw-toggle-badge", "data-metric": "rowBadge", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            type: "checkbox",
            checked: watch.rowBadge,
            onChange: (event) => {
              void config.setRowBadge(event.currentTarget.checked);
            }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-toggle-swatch", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(import_dsh_client_ui_primitives3.StateDot, { state: "done" }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-toggle-label", children: t("row.badgeLabel") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("label", { className: "sw-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-field-label", children: t("row.thresholdLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-field-hint", children: t("row.thresholdHint") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "sw-sr-only", children: t("row.inputLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          "input",
          {
            className: "sw-input",
            type: "number",
            min: 1,
            step: 1,
            inputMode: "numeric",
            value: draft,
            onChange: (event) => setDraft(event.currentTarget.value),
            onBlur: commit,
            onKeyDown: (event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              commit();
            }
          }
        )
      ] })
    ] })
  ] });
}

// src/client/StatusWatch.tsx
var import_react9 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");
var import_jsx_runtime6 = require("react/jsx-runtime");
var ACTIVITY = ["running", "unread", "pending", "idle"];
function StatusWatch({
  wide,
  useSessions,
  useSessionStatus,
  useWorkspaces,
  config,
  metricJump,
  t
}) {
  const watch = (0, import_react9.useSyncExternalStore)(config.subscribe, config.getSnapshot, config.getSnapshot);
  const counts = useSessionCounts({ useSessions, useSessionStatus, useWorkspaces });
  const shown = visibleMetrics(watch.visibility);
  if (shown.length === 0) return null;
  const warn = unarchivedWarns(counts, watch.threshold);
  const summary = summaryText(t, counts, watch.visibility);
  const label = warn ? t("watch.warn", { count: counts.unarchived, threshold: watch.threshold }) + t("watch.summaryJoin") + summary : t("watch.aria", { summary });
  if (!wide) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label, side: "top", delayMs: 200, portal: true, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "sw-rail", role: "status", "aria-label": label, "data-warn": warn ? "true" : void 0, children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(WatchIcon, {}),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-rail-count", "aria-hidden": "true", children: counts.unarchived })
    ] }) });
  }
  const body = watch.variant === "meter" ? renderMeter(counts, shown, warn, label, t, metricJump) : renderChips(counts, shown, warn, label, t, metricJump);
  return (
    // The shell's own tooltip is portaled out of the sidebar's clipping column,
    // so the full metric names survive even in the 56px rail. Hover and
    // keyboard focus both raise it; the readout keeps its own accessible name.
    // The hint names the affordance the icons now carry, which hovering alone
    // does not otherwise reveal.
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_dsh_client_ui_primitives4.Tooltip, { label: label + " \xB7 " + t("watch.jumpHint"), side: "top", delayMs: 200, portal: true, children: body })
  );
}
function warnOf(metric, warn) {
  return metric === "unarchived" && warn ? "true" : void 0;
}
function MetricCell({
  metric,
  count,
  warn,
  className,
  t,
  metricJump
}) {
  const glyph = /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_jsx_runtime6.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(MetricIcon, { metric }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-chip-count", children: count })
  ] });
  if (!isJumpMetric(metric)) {
    return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className, "data-metric": metric, "data-warn": warnOf(metric, warn), children: glyph });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    "button",
    {
      type: "button",
      className,
      "data-metric": metric,
      "data-warn": warnOf(metric, warn),
      "aria-label": t("watch.jump", { label: metricLabel(t, metric), count }),
      onClick: () => {
        metricJump?.run(metric);
      },
      children: glyph
    }
  );
}
function renderChips(counts, shown, warn, label, t, metricJump) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-watch", "data-variant": "chips", role: "status", "aria-label": label, children: shown.map((metric) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
    MetricCell,
    {
      className: "sw-chip",
      metric,
      count: counts[metric],
      warn,
      t,
      metricJump
    },
    metric
  )) });
}
function renderMeter(counts, shown, warn, label, t, metricJump) {
  const activity = ACTIVITY.filter((metric) => shown.includes(metric));
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: "sw-meter", "data-variant": "meter", role: "status", "aria-label": label, children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-meter-bar", "aria-hidden": "true", children: activity.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-meter-seg", "data-metric": "idle", "data-empty": "true" }) : activity.map((metric) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      "span",
      {
        className: "sw-meter-seg",
        "data-metric": metric,
        style: { flexGrow: Math.max(0, counts[metric]) }
      },
      metric
    )) }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: "sw-meter-legend", children: shown.map((metric) => /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
      MetricCell,
      {
        className: "sw-legend",
        metric,
        count: counts[metric],
        warn,
        t,
        metricJump
      },
      metric
    )) })
  ] });
}

// src/client/styles.ts
var CSS = `
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
     rows are tight \u2014 4px padding, a 12px dot column, 4px gap \u2014 which puts the
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

/* \u2500\u2500 restart retry (the boot dialog) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   The only surface that speaks for the operator unprompted: after a restart the
   ledger knows which turns were cut off, and this asks once per process boot
   which of them to continue. A veil + panel like the waiting window, but the
   list is a checklist rather than a cursor grid. */
.rt-veil {
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

.rt-panel {
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

.rt-head { font-weight: 560; }
.rt-intro {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.rt-tools { display: flex; gap: 8px; }

.rt-list {
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

.rt-row {
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
.rt-row-running { opacity: 0.6; }

.rt-check { flex: none; margin: 0; }

.rt-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rt-folder {
  flex: none;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.rt-tag {
  flex: none;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16));
  color: var(--dsw-alias-state-warn-primary, #f5a623);
  font-size: 11px;
}

.rt-error {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.rt-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.rt-mini, .rt-send {
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-border-l2, #ffffff1f);
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #cfd3d6);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.rt-mini:hover:enabled, .rt-send:hover:enabled { background: var(--dsw-alias-interactive-bg-hover, #ffffff14); }
.rt-mini:disabled, .rt-send:disabled { opacity: 0.5; cursor: default; }

.rt-send {
  border-color: transparent;
  background: var(--dsw-alias-brand-primary, #7aaaff);
  color: #10131a;
  font-weight: 560;
}

.rt-send:hover:enabled { background: var(--dsw-alias-brand-primary, #7aaaff); filter: brightness(1.08); }

/* \u2500\u2500 waiting window (the K overview) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
   A page overlay instead of a sidebar cover: the two zones need more width
   than the sidebar ever has, so this is the one surface that portals into the
   document body. The ask zone keeps a fixed column and the unread zone takes
   the rest, so "answer first" survives every window width. */
.ov-veil {
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

.ov-panel {
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

.ov-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--dsw-alias-border-l2, #ffffff14);
  font-size: 13.5px;
}

.ov-title { font-weight: 560; color: var(--dsw-alias-label-primary, #f9fafb); }
.ov-counts, .ov-hint { font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }
.ov-grow { flex: 1; }

.ov-close {
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

.ov-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, #ffffff14);
  color: var(--dsw-alias-label-primary, #f9fafb);
}

.ov-close:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: 1px; }

.ov-kbd {
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

.ov-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
  padding: 12px 16px 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.ov-zone { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.ov-zone-ask { flex: none; width: 268px; }
.ov-zone-unread { flex: 1; }

/* Nothing waiting: the press still answers, with one line instead of two
   empty columns. */
.ov-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px 0;
  font-size: 12.5px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.ov-zone-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

/* The zone's priority mark: warning for an ask, unread red for a completion. */
.ov-zone-title::before {
  content: '';
  width: 3px;
  height: 12px;
  border-radius: 2px;
  background: var(--dsw-alias-state-warn-primary, #f5a623);
}

.ov-zone-unread .ov-zone-title::before { background: var(--dsw-alias-state-error-primary, #e5484d); }

.ov-zone-count { color: var(--dsw-alias-label-secondary, #cfd3d6); font-weight: 620; }
.ov-zone-empty { font-size: 12px; color: var(--dsw-alias-label-tertiary, #adb2b8); }

.ov-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  align-content: start;
}

.ov-zone-ask .ov-grid { grid-template-columns: 1fr; }

.ov-card {
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

.ov-card:hover { border-color: var(--dsw-alias-border-l2, #ffffff1f); }
.ov-card:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, currentColor); outline-offset: -2px; }

.ov-card-sel {
  border-color: var(--dsw-alias-brand-primary, #7aaaff);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-brand-primary, #7aaaff);
}

/* The Session the conversation column already shows, so the window says where
   the operator is standing. */
.ov-card-current { background: var(--dsw-alias-interactive-bg-hover, #ffffff14); }

.ov-card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary, #f9fafb);
}

.ov-tag {
  align-self: flex-start;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16));
  color: var(--dsw-alias-state-warn-primary, #f5a623);
  font-size: 10.5px;
  font-weight: 600;
}

.ov-tag-unread { background: rgba(72, 199, 142, 0.16); color: #48c78e; }

.ov-card-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 11.5px;
  color: var(--dsw-alias-label-tertiary, #adb2b8);
}

.ov-card-folder { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ov-card-when { flex: none; margin-inline-start: auto; }

@media (prefers-reduced-motion: no-preference) {
  .ov-panel { animation: ab-panel-in 120ms var(--ds-ease-in-out, ease-out); }
}

/* \u2500\u2500 status readout (merged from dsh-session-watch) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
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

/* A jumpable metric is a button now; the chip/legend box is unchanged, so only
   the affordances move. The archived metric never becomes one, because the
   shell refuses to open an archived Session. */
button.sw-chip, button.sw-legend {
  appearance: none;
  border: 0;
  font: inherit;
  cursor: pointer;
  transition: background-color 120ms var(--ds-ease-in-out, ease-out);
}

button.sw-chip { margin: 0; }
button.sw-chip:hover { background: var(--dsw-alias-bg-layer-3, rgba(127, 127, 127, 0.2)); }
button.sw-chip[data-warn="true"]:hover { background: var(--dsw-alias-state-warn-tertiary, rgba(245, 166, 35, 0.16)); }

/* The legend is inline text: the pill is drawn with padding the negative margin
   takes back, so hovering highlights it without moving the row. */
button.sw-legend {
  margin: -2px -3px;
  padding: 2px 3px;
  border-radius: 6px;
  background: transparent;
}

button.sw-legend:hover { background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12)); }

button.sw-chip:focus-visible, button.sw-legend:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4d6bfe);
  outline-offset: 1px;
}

button.sw-chip:active, button.sw-legend:active { transform: translateY(0.5px); }

@media (prefers-reduced-motion: reduce) {
  button.sw-chip, button.sw-legend { transition: none; }
}

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
`;
var PLUGIN_ID2 = "dsh-session-radar";
var installed;
function injectStyles() {
  if (installed !== void 0 && installed.isConnected) return installed;
  const style = document.createElement("style");
  style.setAttribute("data-plugin", PLUGIN_ID2);
  style.textContent = CSS;
  document.head.appendChild(style);
  installed = style;
  return style;
}
function removeStyles() {
  if (installed === void 0) return;
  installed.remove();
  installed = void 0;
}

// src/client/index.ts
var NS = PLUGIN_ID;
var STATUS_ID = PLUGIN_ID + ".status";
var STATUS_ORDER = 890;
var SETTINGS_ORDER = 16;
var ROW_BADGE_ID = PLUGIN_ID + ".row-badge";
var ROW_BADGE_ORDER = 10;
var inject = ["slots", "locale", "configForms", "shortcuts", "sessions", "workspaces", "uiSession", "uiWorkspace"];
function apply(ctx) {
  ctx.effect(() => {
    const style = injectStyles();
    return () => {
      style.remove();
      removeStyles();
    };
  }, "session-radar: styles");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "session-radar: dictionaries");
  const forms = ctx.configForms;
  const config = createConfigSource(forms.get(PLUGIN_ID));
  ctx.effect(() => () => config.dispose(), "session-radar: status config source");
  const sessions = ctx.get("sessions").list;
  const statuses = ctx.uiSession.sessionStatus;
  const workspaces = ctx.get("workspaces").list;
  const connection = ctx.get("connection");
  const ledger = createLedgerSource(ctx, sessions);
  const unreadJump = createJumpSeat();
  const askJump = createJumpSeat();
  const overviewJump = createJumpSeat();
  const metricJump = createMetricJumpSeat();
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.shortcuts.register(
    unreadJumpCommand(unreadJump, () => t("bell.show"), t("bell.noUnread"))
  ), "session-radar: shortcut command");
  ctx.effect(() => ctx.shortcuts.register(
    askJumpCommand(askJump, () => t("bell.jumpAsk"), t("bell.noAsk"))
  ), "session-radar: ask shortcut command");
  ctx.effect(() => ctx.shortcuts.register(
    overviewCommand(overviewJump, () => t("overview.open"), t("overview.noWaiting"))
  ), "session-radar: overview shortcut command");
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "session-radar",
    order: 900,
    locale: NS,
    inject: () => ({
      openSession: (sessionId) => {
        ctx.uiWorkspace.openSession(sessionId);
      },
      pinSession: (sessionId) => ctx.uiWorkspace.pinSession(sessionId),
      unpinSession: (sessionId) => ctx.uiWorkspace.unpinSession(sessionId),
      archiveSession: (sessionId) => ctx.uiWorkspace.archiveSession(sessionId),
      // Asking a cut-off Session to carry on: one official `session/prompt`
      // Remote call. The host resumes a stored Session by itself, so this works
      // for one that was never opened, and it never moves the operator's stage.
      retrySession: async (sessionId) => {
        if (connection === void 0) return { ok: false, message: t("retry.unavailable") };
        const request = {
          requestId: crypto.randomUUID(),
          sessionId,
          mode: "queue",
          content: [{ type: "text", text: t("retry.continueMessage") }]
        };
        try {
          const result = await connection.rpc.call("/api", "session/prompt", { args: { request } });
          return result.ok ? { ok: true } : { ok: false, message: result.error.message };
        } catch (error) {
          return { ok: false, message: String(error?.message ?? error) };
        }
      },
      sessions,
      statuses,
      workspaces,
      ledger,
      unreadJump,
      askJump,
      overviewJump,
      metricJump
    })
  }, ActivityBell));
  const watchSlots = ctx.slots;
  ctx.effect(() => watchSlots.inject("sidebar.footer.action", () => watchSlots.register({
    name: "sidebar.footer.action",
    id: STATUS_ID,
    order: STATUS_ORDER,
    locale: NS,
    inject: () => ({ config, metricJump })
  }, StatusWatch)), "session-radar: status readout");
  ctx.effect(() => forms.whileServed([PLUGIN_ID], () => watchSlots.inject("settings.general.item", () => watchSlots.register({
    name: "settings.general.item",
    id: PLUGIN_ID,
    order: SETTINGS_ORDER,
    locale: NS,
    inject: () => ({ config })
  }, SettingsRow))), "session-radar: status settings row");
  ctx.effect(() => watchSlots.inject("sidebar.session.row.leading", () => watchSlots.register({
    name: "sidebar.session.row.leading",
    id: ROW_BADGE_ID,
    order: ROW_BADGE_ORDER,
    locale: NS,
    inject: () => ({ ledger, config })
  }, RowBadge)), "session-radar: row badge");
  ctx.effect(() => {
    let previous = readManualUnread();
    return watchManualUnread((next) => {
      for (const id of droppedIds(previous, next)) ledger.read(id);
      previous = next;
    });
  }, "session-radar: manual read sync");
}
//# sourceMappingURL=client.js.map
    return module.exports;
  }
});

//# sourceMappingURL=client.js.map