/**
 * The app's name wherever people see it: the header, menu, page titles, messages and the
 * manifest (Trevor, 2026-10-18: "Grimbinder", to match grimbinder.com; not the final name).
 * Renaming the app is this one line, plus `static/manifest.webmanifest` and `src/app.html`,
 * which can't import it (app-name.test.ts fails until they match).
 *
 * Not the repository, the Worker (`grim-games`), Durable Object classes or storage keys:
 * those stay as they are so deploys and saved data keep working.
 */
export const APP_NAME = 'Grimbinder';
