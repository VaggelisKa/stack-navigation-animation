---
'@stacknav/core': minor
---

`NavigationStack.entries` is now a `readonly StackEntry[]` -- the same live array as before, so reads stay cheap and its identity stays stable -- and `busy` is a getter.

Code that assigned to `stack.entries` or `stack.busy`, or that mutated the array in place, no longer type-checks and must go through the stack's own operations instead.
