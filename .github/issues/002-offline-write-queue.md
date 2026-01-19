---
title: "Offline write-queue (IndexedDB) for inventory sync"
labels: enhancement, offline
assignees: ''
---

Provide robust offline support by queuing inventory and related writes in IndexedDB when the client is offline and applying them when the device comes back online.

Implementation notes:
- Create a lightweight IndexedDB store for queued operations.
- Enqueue inventory sync operations from `useDataManagement` when `navigator.onLine` is false.
- Process the queue on `window.online` and on app start if online.
- Add telemetry for queued ops and failures.

Acceptance:
- Changes made while offline are persisted and applied when back online.

Estimate: 5 story points
