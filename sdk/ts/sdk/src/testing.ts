/**
 * Test helpers, published as `@vlo/sdk/testing`.
 *
 * `journalConformance` is the contract every journal implementation has to
 * satisfy; point it at your own `Journal` and the durability promises the host
 * relies on are checked for you.
 */

export { journalConformance } from "./journal/conformance.ts";
export { fakeClock, type Clock } from "./journal/fixtures.ts";
