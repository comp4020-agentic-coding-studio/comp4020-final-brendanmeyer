// Not a *.test.ts file -- a shared helper, imported by spec files that
// create fresh connections and wait on a specific activeCount. The one
// shared dev server carries real state between test files (sequential,
// not isolated instances -- see spec/README.md), and vitest's execution
// order isn't stable or alphabetical, so no file can assume what ran
// immediately before it. A closed socket keeps occupying a capacity slot
// for up to planning.md section 5's 2s leaving flash, so a file that
// starts connecting immediately after a heavy preceding test (many
// sockets, e.g. spec/capacity.test.ts's 13) can see fewer real slots than
// expected for that window. Awaiting this first absorbs it.
export function settleSharedState(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 2500));
}
