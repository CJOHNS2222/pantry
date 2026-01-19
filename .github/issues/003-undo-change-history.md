---
title: "Undo & Item Change History"
labels: enhancement, UX
assignees: ''
---

Allow users to undo recent operations (delete, bulk edits) and view a per-item change history.

Implementation:
- Store last N actions in local state and optionally in IndexedDB.
- Expose undo snackbar after destructive actions.
- Add a history tab in `ItemDetailModal` showing changes with timestamps.

Estimate: 3-4 story points
