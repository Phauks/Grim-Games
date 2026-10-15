// Client-rendered SPA: adapter-static writes one index.html shell, and the Worker serves it
// for every app route via `not_found_handling: "single-page-application"` (wrangler.jsonc).
export const ssr = false;
