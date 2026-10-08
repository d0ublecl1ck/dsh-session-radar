/**
 * Collect the Session ids the host ledger still owes the operator.
 *
 * @param rows - the ledger snapshot's unread rows.
 * @returns the reminder ids, deduplicated; malformed rows are ignored.
 */
export function ledgerUnreadIds(rows) {
    const ids = new Set();
    for (const row of rows) {
        const id = row?.sessionId;
        if (typeof id === 'string' && id !== '')
            ids.add(id);
    }
    return ids;
}
//# sourceMappingURL=row-badge.js.map