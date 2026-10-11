// Not a *.test.ts file -- a shared helper, imported by spec files that
// create fresh connections and wait on a specific activeCount. The one
// shared dev server carries real state between test files (sequential,
// not isolated instances -- see spec/README.md), and vitest's execution
// order isn't stable or alphabetical, so no file can assume what ran
// immediately before it. Two things can make the server look busier than
// it really is for a window after a preceding test finishes: a closed
// socket keeps occupying a capacity slot for up to planning.md section 5's
// 2s leaving flash (many sockets, e.g. spec/capacity.test.ts's 13, makes
// this more likely to matter), and a just-finished collision holds
// status "gameover" for the full 5s GAME_OVER_RESET_MS before the next
// run can start (spec/ghost-trail.test.ts is the one test that forces
// this). Awaiting this first absorbs both.
export function settleSharedState(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 6000));
}
