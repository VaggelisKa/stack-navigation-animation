---
'@stacknav/core': minor
---

Start a phase from where the pages already are, so nothing has to be resolved to begin one. On an eight-deep stack of 600-row pages in Edge the synchronous main-thread work of a push drops from ~6 ms to ~0.3 ms and of a pop from ~7 ms to ~0.2 ms, with the same elements restyled over the whole operation, the same painting, and the same longest task. What is left in a real push — about 3 ms — is the application building its own page.

The cost was never the animation, which CSS has run since 0.5.0. It was three places where the engine asked the browser a question inside the navigation task, each of which makes it resolve every style change made so far: `refresh()` reading the `--sn-*` variables after the phase classes had been added, `commitStyles()` committing a start state that had just been written, and `getAnimations()` asking what was running. Removing any two of them changes nothing, because one forced resolution costs the same as three.

So none of them are asked any more:

- A covered page now rests where a covered page belongs — parallaxed, dimmed, out of sight — which is exactly where the pop that reveals it begins. The stack puts it there whenever it settles, frames before the phase that needs it.
- A page arriving takes its start from a new `@starting-style` rule in the stylesheet, because only CSS can say what an element looked like before it existed. Its values come from `--sn-enter-upper`, `--sn-enter-lower` and `--sn-enter-fade`, which the transition writes on each page as it is mounted.
- The configuration is re-read once per operation, before the stack touches the DOM.
- What is running is asked for a frame later, by which time the browser has done that work as part of its own.

`Transition` gains three optional members. `refresh(el)` is called once per operation before any DOM change. `mount(entry)` and `unmount(entry)` let a transition attach something to a page for as long as it is mounted — the dim overlay is now one per page, created at mount, because an element added at the start of a phase has no resolved opacity to fade from and would appear at full strength. `apply` is called once per phase rather than twice, and again with `p = 1` for every covered page whenever the stack settles.

A custom `Transition` needs two changes to match. Write nothing where the stylesheet already puts a page — an inline declaration there would outrank `@starting-style` and leave an arriving page with nothing to animate from — and expect `apply(lower, upper, 1)` to describe a resting state, not only a moment in a phase. `createNativeTransition` already does both.

The stack also places a page in the container itself now, even one the host had already put there, since an entry animation only exists for an element that has just arrived. Which page paints on top is still `z-index`, not document order.

A browser that has never heard of `@starting-style` (Baseline since August 2024, so Safari before 17.5 and Firefox before 129) is asked once per stack, by offering CSSOM the rule and seeing whether it is rejected. Where it is, the engine writes the start state itself and commits it, exactly as it did before — that browser gets the old cost and the same animation. Nothing about a pop or a drag depends on the rule either way, because their start states are where the pages already rest.
