---
'@stacknav/angular': patch
---

Cap `StackNavHistory`'s tracked entries at 200, matching browser history's own bounded stack instead of growing unbounded for the life of the app.
