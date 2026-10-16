/**
 * Folders whose interface text has moved into the catalogs. The hard-coded text check
 * (hardcoded.test.ts) fails on any text written straight into a template under these paths,
 * so a moved feature stays moved. A folder joins the list in the commit that moves it.
 *
 * `allow` lists text that is not interface text (brand names, symbols), per file.
 */
export const MIGRATED_PATHS: readonly string[] = [
	'src/lib/i18n/',
	'src/lib/features/errors/',
	'src/lib/features/room/',
	'src/routes/join/',
	'src/routes/grimoire/[gameId]/room/'
];

export const ALLOWED_TEXT: Readonly<Record<string, readonly string[]>> = {};
