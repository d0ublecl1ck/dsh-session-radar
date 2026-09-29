window.__ModuleLoader__.load({
  id: "dsh-session-ledger",
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

// src/client/ActivityBell.tsx
var import_react4 = require("react");
var import_react_dom = require("react-dom");
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
  const frame = (0, import_react.useRef)(0);
  (0, import_react.useEffect)(() => () => {
    cancelAnimationFrame(frame.current);
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
      cancelAnimationFrame(frame.current);
      let previous;
      let position = 0;
      const step = (now) => {
        position += previous === void 0 ? 0 : (now - previous) * TITLE_MARQUEE_PX_PER_MS;
        previous = now;
        placeTitle(element, Math.min(position, range), range);
        if (position < range) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    leave: () => {
      cancelAnimationFrame(frame.current);
      const element = title.current;
      if (element === null) return;
      restTitle(element);
    }
  }), [title]);
}

// src/client/use-anchors.ts
var import_react2 = require("react");
function useSidebarAnchors() {
  const [anchors, setAnchors] = (0, import_react2.useState)(
    () => resolveSidebarAnchors(document)
  );
  (0, import_react2.useEffect)(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
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
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(sync);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    sync();
    return () => {
      observer.disconnect();
      if (frame !== 0) window.cancelAnimationFrame(frame);
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

// src/client/use-conversation-tail.ts
function useFollowingTailSession() {
  const [sessionId, setSessionId] = (0, import_react3.useState)(() => tailSessionId(document));
  (0, import_react3.useEffect)(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const next = tailSessionId(document);
      setSessionId((previous) => previous === next ? previous : next);
    };
    const schedule = () => {
      if (frame !== 0) return;
      frame = window.requestAnimationFrame(sync);
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
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);
  return sessionId;
}

// src/client/ActivityBell.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
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
  if (row.unread) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "done", size: 8 });
  if (row.pending !== void 0) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "warning", size: 8 });
  if (row.running) return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.StateDot, { state: "ongoing", size: 10 });
  return null;
}
function ActivityRowItem({
  row,
  t,
  onOpen,
  onTogglePin,
  onArchive
}) {
  const title = (0, import_react4.useRef)(null);
  const marquee = useTitleMarquee(title);
  const status = statusText(row, t);
  const label = row.title === "" ? t("row.untitled") : row.title;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-row-mark", "aria-hidden": "true", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(RowMark, { row }) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ab-row-body", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-row-title", ref: title, children: label }),
          row.folder !== "" && /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ab-row-folder", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: 12 }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-row-folder-text", children: row.folder })
          ] }),
          status !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-sr-only", children: status })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ab-row-tail", children: [
          row.pinned && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-pin-mark", role: "img", "aria-label": t("row.pinned"), title: t("row.pinned"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconPinFillRegular, { size: 12 }) }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "ab-row-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t(row.pinned ? "action.unpin" : "action.pin"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "ab-icon-button",
                "aria-label": t(row.pinned ? "action.unpin" : "action.pin"),
                onClick: (event) => {
                  event.stopPropagation();
                  onTogglePin(row);
                },
                children: row.pinned ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 14 })
              }
            ) }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.Tooltip, { label: t("action.archive"), side: "bottom", align: "end", delayMs: 500, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                className: "ab-icon-button",
                "aria-label": t("action.archive"),
                onClick: (event) => {
                  event.stopPropagation();
                  onArchive(row);
                },
                children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 })
              }
            ) })
          ] })
        ] })
      ]
    }
  );
}
function useSnapshot(source) {
  const subscribe = (0, import_react4.useCallback)((listener) => source.subscribe(listener), [source]);
  const read = (0, import_react4.useCallback)(() => source.getSnapshot(), [source]);
  return (0, import_react4.useSyncExternalStore)(subscribe, read, read);
}
function useManualUnread() {
  const [marked, setMarked] = (0, import_react4.useState)(() => readManualUnread());
  (0, import_react4.useEffect)(() => watchManualUnread(setMarked), []);
  return marked;
}
function useMinuteTick() {
  const [now, setNow] = (0, import_react4.useState)(() => Date.now());
  (0, import_react4.useEffect)(() => {
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
  const [hosts, setHosts] = (0, import_react4.useState)({ bell: null, panel: null });
  (0, import_react4.useLayoutEffect)(() => {
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
  (0, import_react4.useLayoutEffect)(() => {
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
  sessions,
  statuses,
  workspaces,
  ledger
}) {
  const anchors = useSidebarAnchors();
  const list = useSnapshot(sessions);
  const statusMap = useSnapshot(statuses);
  const workspaceSnapshot = useSnapshot(workspaces);
  const manualUnread = useManualUnread();
  const tail = useFollowingTailSession();
  const now = useMinuteTick();
  const [active, setActive] = (0, import_react4.useState)(false);
  const [pending, setPending] = (0, import_react4.useState)(() => /* @__PURE__ */ new Set());
  const facts = (0, import_react4.useRef)(void 0);
  const [notice, setNotice] = (0, import_react4.useState)(null);
  const noticeTimer = (0, import_react4.useRef)(0);
  const hosts = useHosts(anchors, wide, active);
  (0, import_react4.useEffect)(() => {
    const current = sessionFacts(list, statusMap);
    const previous = facts.current;
    facts.current = current;
    setPending((currentPending) => nextPending(currentPending, previous, current));
    if (tail !== null && previous?.get(tail)?.running === true && current.get(tail)?.running === false) {
      ledger.read(tail);
    }
  }, [list, statusMap, tail, ledger]);
  const ledgerSnapshot = (0, import_react4.useSyncExternalStore)(
    (0, import_react4.useCallback)((listener) => ledger.subscribe(listener), [ledger]),
    (0, import_react4.useCallback)(() => ledger.getSnapshot(), [ledger])
  );
  const ledgerUnread = (0, import_react4.useMemo)(() => {
    const ids = /* @__PURE__ */ new Set();
    for (const row of ledgerSnapshot.unread) ids.add(row.sessionId);
    return ids;
  }, [ledgerSnapshot]);
  (0, import_react4.useEffect)(() => {
    if (tail === null || !pending.has(tail)) return;
    setPending((current) => {
      const next = new Set(current);
      next.delete(tail);
      return next;
    });
  }, [tail, pending]);
  (0, import_react4.useEffect)(() => {
    if (tail === null) return;
    if (ledgerUnread.has(tail)) ledger.read(tail);
  }, [tail, ledgerUnread, ledger]);
  const acknowledge = (0, import_react4.useCallback)((sessionId) => {
    setPending((current) => {
      if (!current.has(sessionId)) return current;
      const next = new Set(current);
      next.delete(sessionId);
      return next;
    });
    ledger.read(sessionId);
  }, [ledger]);
  const view = (0, import_react4.useMemo)(() => {
    const inputs = {
      sessions: list,
      statuses: statusMap,
      workspaces: workspaceSnapshot,
      completedSince: pending,
      ledgerUnread,
      viewingTail: tail,
      manualUnread
    };
    return { groups: buildActivityGroups(inputs, now), unread: countUnread(inputs) };
  }, [list, statusMap, workspaceSnapshot, pending, ledgerUnread, tail, manualUnread, now]);
  const { groups, unread } = view;
  const unreadOrder = (0, import_react4.useMemo)(
    () => groups.flatMap((group) => group.rows.filter((row) => row.unread).map((row) => row.id)),
    [groups]
  );
  const cursor = (0, import_react4.useRef)(null);
  const jumpNextUnread = (0, import_react4.useCallback)(() => {
    const target = nextUnreadId(unreadOrder, cursor.current);
    if (target === null) return;
    cursor.current = target;
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
    acknowledge(target);
    openSession(target);
  }, [acknowledge, anchors, openSession, unreadOrder, workspaceSnapshot]);
  (0, import_react4.useEffect)(() => {
    if (!wide) setActive(false);
  }, [wide]);
  (0, import_react4.useEffect)(() => {
    if (!active) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setActive(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [active]);
  (0, import_react4.useEffect)(() => {
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
  (0, import_react4.useEffect)(() => () => {
    window.clearTimeout(noticeTimer.current);
  }, []);
  const showNotice = (0, import_react4.useCallback)((message) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => {
      setNotice(null);
    }, 4e3);
  }, []);
  const togglePin = (0, import_react4.useCallback)((row) => {
    const call = row.pinned ? unpinSession : pinSession;
    call(row.id).catch(() => {
    });
  }, [pinSession, unpinSession]);
  const archive = (0, import_react4.useCallback)((row) => {
    archiveSession(row.id).catch(() => {
      showNotice(t("action.archiveFailed"));
    });
  }, [archiveSession, showNotice, t]);
  const listArea = anchors?.listArea ?? null;
  const panelHost = hosts.panel;
  (0, import_react4.useLayoutEffect)(() => {
    if (!active || listArea === null || panelHost === null) return;
    const covered = [...listArea.children].filter((child) => child !== panelHost).map((child) => child);
    for (const element of covered) element.inert = true;
    return () => {
      for (const element of covered) element.inert = false;
    };
  }, [active, listArea, panelHost]);
  if (hosts.bell === null) return null;
  const label = active ? t("bell.hide") : unread > 0 ? t("bell.showUnread", { count: unread }) : t("bell.noUnread");
  const bell = /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    import_dsh_client_ui_primitives.Tooltip,
    {
      label: active ? label : label + " \xB7 " + t("bell.openActivity"),
      side: "bottom",
      delayMs: 400,
      align: "end",
      children: /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
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
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(BellIcon, { size: 16 }),
            unread > 0 && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "ab-badge", "aria-hidden": "true", children: unread > 99 ? "99+" : String(unread) })
          ]
        }
      )
    }
  );
  const panel = /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "ab-panel", role: "region", "aria-label": t("panel.aria"), children: [
    notice !== null && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ab-panel-notice", role: "status", children: notice }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ab-panel-scroll", children: groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ab-empty", children: t("panel.empty") }) : groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "ab-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "ab-group-label", children: dayLabel(group.bucket, t, now) }),
      group.rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        ActivityRowItem,
        {
          row,
          t,
          onOpen: (sessionId) => {
            acknowledge(sessionId);
            openSession(sessionId);
          },
          onTogglePin: togglePin,
          onArchive: archive
        },
        row.id
      ))
    ] }, group.key)) })
  ] });
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
    (0, import_react_dom.createPortal)(bell, hosts.bell),
    active && hosts.panel !== null ? (0, import_react_dom.createPortal)(panel, hosts.panel) : null
  ] });
}

// src/client/LedgerChip.tsx
var import_react5 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var TEXT = {
  zh: {
    title: "\u91CD\u542F\u540E\u5F85\u5904\u7406",
    unread: "\u672A\u8BFB",
    interrupted: "\u88AB\u91CD\u542F\u4E2D\u65AD",
    continueAll: "\u5168\u90E8\u7EE7\u7EED",
    progress: (done, total) => `\u7EE7\u7EED\u4E2D ${done}/${total}`
  },
  en: {
    title: "Left over from a restart",
    unread: "Unread",
    interrupted: "Interrupted by restart",
    continueAll: "Continue all",
    progress: (done, total) => `Continuing ${done}/${total}`
  }
};
function copy() {
  return document.documentElement.lang.toLowerCase().startsWith("en") ? TEXT.en : TEXT.zh;
}
function LedgerChip({ ledger, openSession }) {
  const snapshot = (0, import_react5.useSyncExternalStore)(
    (0, import_react5.useCallback)((listener) => ledger.subscribe(listener), [ledger]),
    (0, import_react5.useCallback)(() => ledger.getSnapshot(), [ledger])
  );
  const [open, setOpen] = (0, import_react5.useState)(false);
  const text = copy();
  const unread = snapshot.unread;
  const interrupted = snapshot.interrupted;
  const idle = interrupted.length === 0 && !snapshot.rollout.running && snapshot.error === null;
  if (idle && !open) return null;
  const interruptedIds = new Set(interrupted.map((row) => row.sessionId));
  const rows = [...unread].map((row) => ({ ...row, interrupted: interruptedIds.has(row.sessionId) })).sort((left, right) => Number(right.interrupted) - Number(left.interrupted) || right.at - left.at);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { position: "relative" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "button",
      {
        type: "button",
        onClick: () => {
          setOpen((previous) => !previous);
        },
        "aria-expanded": open,
        "aria-label": text.title,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 8px",
          cursor: "pointer",
          background: "transparent",
          border: "1px solid var(--dsw-alias-border-l3)",
          borderRadius: 999,
          color: "var(--dsw-alias-label-primary)",
          font: "inherit"
        },
        children: [
          interrupted.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#d64545", fontWeight: 600 }, children: "\u26A0 " + String(interrupted.length) }),
          unread.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#c98a00", fontWeight: 600 }, children: "\u2022 " + String(unread.length) }),
          snapshot.rollout.running && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: text.progress(Math.min(snapshot.rollout.done + 1, snapshot.rollout.total), snapshot.rollout.total) }),
          snapshot.error !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { title: snapshot.error, style: { color: "#d64545", fontWeight: 600 }, children: "!" })
        ]
      }
    ),
    open && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
      "div",
      {
        role: "dialog",
        "aria-label": text.title,
        style: {
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 0,
          zIndex: 40,
          width: 280,
          maxHeight: "40vh",
          overflow: "auto",
          padding: 8,
          borderRadius: 10,
          border: "1px solid var(--dsw-alias-border-l3)",
          background: "var(--dsw-alias-bg-base)",
          color: "var(--dsw-alias-label-primary)",
          boxShadow: "0 8px 24px rgba(0,0,0,.25)"
        },
        children: [
          interrupted.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              disabled: snapshot.rollout.running,
              onClick: () => {
                void ledger.continueAll();
              },
              style: {
                width: "100%",
                marginBottom: 8,
                padding: "4px 8px",
                cursor: "pointer",
                border: "1px solid #d64545",
                borderRadius: 6,
                background: "transparent",
                color: "#d64545",
                font: "inherit"
              },
              children: text.continueAll + " (" + String(interrupted.length) + ")"
            }
          ),
          rows.length === 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { opacity: 0.7, padding: "4px 2px" }, children: text.unread + ": 0" }),
          rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              onClick: () => {
                openSession(row.sessionId);
                ledger.read(row.sessionId);
                setOpen(false);
              },
              title: row.sessionId,
              style: {
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 4px",
                cursor: "pointer",
                background: "transparent",
                border: 0,
                textAlign: "left",
                font: "inherit",
                color: row.interrupted ? "#d64545" : "inherit"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: {
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flex: "none",
                  background: row.interrupted ? "#d64545" : "#c98a00"
                } }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: row.sessionId }),
                /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.7, fontSize: 11, flex: "none" }, children: row.interrupted ? text.interrupted : String(row.kind ?? text.unread) })
              ]
            },
            row.sessionId
          ))
        ]
      }
    )
  ] });
}

// src/client/ledger-source.ts
var ROUTE = "/session-ledger";
var POLL_MS = 5e3;
var BOOT_SETTLE_MS = 3e3;
var EMPTY = {
  now: 0,
  unread: [],
  interrupted: [],
  rollout: { total: 0, done: 0, active: null, running: false },
  error: null
};
function mainViewId(sessions) {
  const state = sessions.getSnapshot();
  for (const id of state.ids) {
    const row = state.byId[id];
    if ((row?.retainedBy?.mainView ?? 0) > 0) return id;
  }
  return null;
}
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
      throw new Error("session-ledger: host refused " + endpoint + " (HTTP " + String(response.status) + ")");
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
    const current = mainViewId(sessions);
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
    read: (sessionId) => {
      void post("read", { sessionId }).then((next) => {
        if (!disposed) publish(next);
      }).catch((error) => {
        if (!disposed) publish({ ...snapshot, error: String(error?.message ?? error) });
      });
    },
    continueAll: async (sessionIds) => {
      try {
        await post("continue-all", sessionIds === void 0 ? {} : { sessionIds: [...sessionIds] });
      } catch (error) {
        if (!disposed) publish({ ...snapshot, error: String(error?.message ?? error) });
      }
      await refresh();
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
  }, "session-ledger: bridge teardown");
  return source;
}

// src/client/locales.ts
var zh = {
  "bell.show": "\u5B9A\u4F4D\u4E0B\u4E00\u4E2A\u672A\u8BFB",
  "bell.hide": "\u6253\u5F00\u6700\u8FD1\u6D3B\u52A8",
  "bell.showUnread": "\u5B9A\u4F4D\u4E0B\u4E00\u4E2A\u672A\u8BFB\uFF0C{count} \u4E2A\u4F1A\u8BDD\u5DF2\u5B8C\u6210\u672A\u67E5\u770B",
  "bell.noUnread": "\u6CA1\u6709\u672A\u8BFB\u4F1A\u8BDD",
  "bell.openActivity": "\u53F3\u952E\uFF1A\u6253\u5F00\u6700\u8FD1\u6D3B\u52A8\u5217\u8868",
  "panel.aria": "\u6700\u8FD1\u6D3B\u52A8",
  "panel.empty": "\u8FD8\u6CA1\u6709\u4F1A\u8BDD\u6D3B\u52A8\u3002",
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
  "day.dateYear": "{year}\u5E74{month}\u6708{day}\u65E5"
};
var en = {
  "bell.show": "Jump to next unread",
  "bell.hide": "Open recent activity",
  "bell.showUnread": "Jump to next unread, {count} sessions finished unviewed",
  "bell.noUnread": "No unread sessions",
  "bell.openActivity": "Right-click: recent activity list",
  "panel.aria": "Recent activity",
  "panel.empty": "No session activity yet.",
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
  "day.dateYear": "{year}/{month}/{day}"
};

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
`;
var PLUGIN_ID = "dsh-session-ledger";
var installed;
function injectStyles() {
  if (installed !== void 0 && installed.isConnected) return installed;
  const style = document.createElement("style");
  style.setAttribute("data-plugin", PLUGIN_ID);
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
var NS = "session-ledger";
var inject = ["slots", "locale", "sessions", "workspaces", "uiSession", "uiWorkspace"];
function apply(ctx) {
  ctx.effect(() => {
    const style = injectStyles();
    return () => {
      style.remove();
      removeStyles();
    };
  }, "unread-jump: styles");
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "unread-jump: dictionaries");
  const sessions = ctx.get("sessions").list;
  const statuses = ctx.uiSession.sessionStatus;
  const workspaces = ctx.get("workspaces").list;
  const ledger = createLedgerSource(ctx, sessions);
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "session-ledger",
    order: 900,
    locale: NS,
    inject: () => ({
      openSession: (sessionId) => {
        ctx.uiWorkspace.openSession(sessionId);
      },
      pinSession: (sessionId) => ctx.uiWorkspace.pinSession(sessionId),
      unpinSession: (sessionId) => ctx.uiWorkspace.unpinSession(sessionId),
      archiveSession: (sessionId) => ctx.uiWorkspace.archiveSession(sessionId),
      sessions,
      statuses,
      workspaces,
      ledger
    })
  }, ActivityBell));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "session-ledger-chip",
    order: 901,
    locale: NS,
    inject: () => ({
      ledger,
      openSession: (sessionId) => {
        ctx.uiWorkspace.openSession(sessionId);
      }
    })
  }, LedgerChip));
}
//# sourceMappingURL=client.js.map
    return module.exports;
  }
});

//# sourceMappingURL=client.js.map