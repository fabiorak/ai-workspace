/**
 * The three presentation assets the local server serves, in one import site.
 *
 * They live in separate modules because they are separate languages with
 * separate reasons to change — markup, style, behaviour — and a single template
 * literal holding all three made every dashboard change touch the same file.
 * This module keeps the original import surface so that nothing downstream has
 * to know the split happened.
 */
export { shellHtml } from "./assets/shell.ts";
export { APP_CSS } from "./assets/styles.ts";
export { APP_JS } from "./assets/client.ts";
