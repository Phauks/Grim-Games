/**
 * Folders whose interface text has moved into the catalogs. The hard-coded text check
 * (hardcoded.test.ts) fails on any text written straight into a template under these paths,
 * so a moved feature stays moved. A folder joins the list in the commit that moves it.
 *
 * `allow` lists text that is not interface text (brand names, symbols), per file.
 */
export const MIGRATED_PATHS: readonly string[] = [
	'src/lib/features/shell/',
	'src/lib/features/modes/',
	'src/lib/features/about/',
	'src/lib/features/settings/',
	'src/routes/changelog/',
	'src/routes/+layout.svelte',
	'src/lib/i18n/',
	'src/lib/features/errors/',
	'src/lib/features/reports/',
	'src/routes/reports/',
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
	'src/lib/features/script-builder/',
	'src/routes/build-script/',
	'src/lib/features/player/',
	'src/routes/play/',
	'src/lib/features/history/',
	'src/routes/history/',
	'src/lib/features/setup/',
	'src/routes/grimoire/[gameId]/setup/',
	'src/routes/grimoire/[gameId]/draw/',
	'src/lib/features/characters/CharacterPicker.svelte',
	'src/lib/features/characters/CharacterSearchBox.svelte',
	// Reference and token visuals; the table files belong to the shared table thread and the
	// picker files to character selection, so they are listed one by one.
	'src/routes/reference/',
	'src/lib/features/reference/CharacterReference.svelte',
	'src/lib/features/reference/FieldValue.svelte',
	'src/lib/features/reference/NightText.svelte',
	'src/lib/features/reference/ReferenceCard.svelte',
	'src/lib/features/reference/ReferencePage.svelte',
	'src/lib/features/reference/ReminderSentence.svelte',
	'src/lib/features/reference/TokenKey.svelte',
	'src/lib/features/characters/CharacterBadge.svelte',
	'src/lib/features/characters/CharacterDialog.svelte',
	'src/lib/features/characters/CharacterToken.svelte',
	'src/lib/features/characters/ReminderToken.svelte',
	'src/lib/features/characters/TokenAppearanceSettings.svelte',
	'src/lib/features/glossary/',
	'src/lib/ui/token/',
	'src/lib/ui/scratch/',
	'src/lib/features/library/',
	'src/routes/library/'
];

export const ALLOWED_TEXT: Readonly<Record<string, readonly string[]>> = {
	// The start of a web address, the same in every language.
	'src/lib/features/scripts/AddScript.svelte': ['https://'],
	// The app's name, the same in every language.
	'src/lib/features/shell/AppHeader.svelte': ['Grim-Games'],
	'src/routes/+layout.svelte': ['Grim-Games']
};
