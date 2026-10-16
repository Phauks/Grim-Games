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
	'src/routes/grimoire/[gameId]/room/',
	'src/lib/features/show/',
	'src/lib/features/info-tokens/',
	'src/lib/features/bluffs/',
	'src/lib/features/day/',
	'src/lib/features/account/',
	'src/routes/account/',
	'src/lib/features/scripts/',
	'src/routes/scripts/',
	'src/lib/features/player/',
	'src/routes/play/',
	'src/lib/features/setup/',
	'src/routes/grimoire/[gameId]/setup/',
	'src/routes/grimoire/[gameId]/draw/',
	'src/lib/features/characters/CharacterPicker.svelte',
	'src/lib/features/characters/CharacterSearchBox.svelte'
];

export const ALLOWED_TEXT: Readonly<Record<string, readonly string[]>> = {
	// The start of a web address, the same in every language.
	'src/lib/features/scripts/ScriptPicker.svelte': ['https://']
};
