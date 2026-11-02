import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import grim from './scripts/lint/plugin.js';

/**
 * Files still reaching localStorage directly instead of #lib/ui/stored.ts; only ever shrinks
 * (component review, 2026-10-18).
 */
/**
 * Files still calling the phone's share sheet themselves instead of opening SharePanel; only
 * ever shrinks (Trevor, 2026-10-23: every Share the same). Empty since the share audit.
 */
const SHARE_TODO = [];
/**
 * Files that still show a player name as plain text (grim/names-as-badges); only ever shrinks
 * (Trevor, 2026-10-24: every player name is the grim's name badge).
 */
const PLAYER_BADGE_TODO = [];
// Files that still draw a script's logo beside its name by hand (grim/script-name). Only
// shrinks: the board's corner title is measured line by line (corner-room.ts).
const SCRIPT_NAME_TODO = ['src/lib/features/grimoire/BoardCorner.svelte'];
/**
 * Files that still draw a character's icon or ability themselves instead of CharacterRow (or
 * another shared character component); only ever shrinks (Trevor, 2026-10-30: characters and
 * their abilities always show the way the Script tab does).
 */
const CHARACTER_DISPLAY_TODO = [
	'src/lib/features/character-builder/CharacterPreview.svelte',
	'src/lib/features/characters/CharacterGroupDialog.svelte',
	'src/lib/features/characters/JinxMark.svelte',
	'src/lib/features/day/PreventedSheet.svelte',
	'src/lib/features/errors/ErrorPage.svelte',
	'src/lib/features/grimoire/FirstDeathAsk.svelte',
	'src/lib/features/grimoire/GameEndPrompt.svelte',
	'src/lib/features/grimoire/GuidedStep.svelte',
	'src/lib/features/grimoire/RuleCharacters.svelte',
	'src/lib/features/grimoire/StarPassPrompt.svelte',
	'src/lib/features/modes/SpectersSheet.svelte',
	'src/lib/features/player/GuessMarks.svelte',
	'src/lib/features/reference/FieldValue.svelte',
	'src/lib/features/setup/CharacterChoice.svelte'
];

/**
 * Files that still build "Seat 3" by hand instead of seatName or t('common.seat'); only ever
 * shrinks. Most show the result as plain text, so moving them onto seatName means showing a
 * PlayerBadge there too (grim/names-as-badges).
 */
const SEAT_NAME_TODO = [
	'src/lib/features/grimoire/ReminderAsk.svelte',
	'src/lib/features/grimoire/ReminderOrigin.svelte',
	'src/lib/features/grimoire/ReminderPicker.svelte',
	'src/lib/features/grimoire/SeatStatusDialog.svelte',
	'src/lib/features/grimoire/SeatToken.svelte',
	'src/lib/features/grimoire/StepAfflictions.svelte',
	'src/lib/features/grimoire/board.ts',
	'src/lib/features/player/notebook.ts'
];

// Requests go through #lib/ui/fetch.ts, which adds a timeout (code cleanup, 2026-10-27).
// The service worker and the update check make their own requests, with their own caching.
const FETCH_OWN = [
	'src/lib/ui/fetch.ts',
	'src/service-worker.ts',
	'src/lib/features/about/update-check.svelte.ts'
];
const FETCH_IGNORES = [
	...FETCH_OWN,
	'src/**/*.test.ts',
	'src/lib/features/spikes/**',
	'src/routes/spikes/**'
];
const NO_RAW_FETCH = {
	selector: "CallExpression[callee.name='fetch']",
	message: 'Use fetchJson or fetchWithTimeout from #lib/ui/fetch.ts.'
};
// A seat is named by seatName (features/game/seat-label.ts) or t('common.seat'), never a
// hand-built "Seat ${n}" (Trevor, 2026-10-19: one name for every seat). Core writes the
// default player names itself, in English. SEAT_NAME_TODO only shrinks.
const SEAT_NAME_IGNORES = [
	'src/lib/core/**',
	'src/**/*.test.ts',
	'src/lib/features/spikes/**',
	...SEAT_NAME_TODO
];
const NO_HAND_BUILT_SEAT_NAME = {
	selector: 'TemplateLiteral[quasis.0.value.raw=/^Seat $/]',
	message: "Name a seat with seatName (features/game/seat-label.ts) or t('common.seat')."
};

const LOCAL_STORAGE_TODO = [
	'src/lib/features/grimoire/board-looks.svelte.ts',
	'src/lib/features/grimoire/device-notes.ts',
	'src/lib/features/info-tokens/custom-tokens.svelte.ts',
	'src/lib/features/library/library-labels.svelte.ts',
	'src/lib/features/player/player-settings.svelte.ts',
	'src/lib/features/scripts/current-script.svelte.ts',
	'src/lib/features/setup/selection.svelte.ts'
];

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
	{ ignores: ['.claude/'] },
	js.configs.recommended,
	ts.configs.recommended,
	svelte.configs.recommended,
	prettier,
	svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } },
		rules: {
			// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
			// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
			'no-undef': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// Module boundaries (04-architecture.md §2): the rules core is pure TypeScript and
		// never depends on Svelte, the DOM-facing layers, or SvelteKit.
		files: ['src/lib/core/**/*.ts'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{ group: ['svelte', 'svelte/*'], message: 'core must not depend on Svelte.' },
						{ group: ['$app/*', '@sveltejs/*'], message: 'core must not depend on SvelteKit.' },
						{
							group: ['#lib/features/*', '#lib/ui/*', '**/features/**', '**/ui/**'],
							message: 'core must not import features or ui.'
						},
						{ group: ['@ark-ui/*'], message: 'core must not depend on UI libraries.' }
					]
				}
			]
		}
	},
	{
		// Features reach Ark UI only through our own wrappers in src/lib/ui/primitives, and
		// motion only through ui/motion.ts.
		files: ['src/lib/features/**', 'src/routes/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@ark-ui/*'],
							message: 'Use the wrappers in #lib/ui/primitives instead of Ark UI directly.'
						},
						{
							group: ['svelte/transition', 'animejs', 'animejs/*'],
							message: 'Use rise and duration from #lib/ui/motion.ts so motion shares the tokens.'
						}
					]
				}
			]
		}
	},
	{
		// Player mode never sees Storyteller state, so a bug cannot leak the grimoire onto a
		// player's screen (04-architecture.md §8.1). Repeats the Ark UI rule: this replaces it.
		files: ['src/lib/features/player/**', 'src/routes/play/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@ark-ui/*'],
							message: 'Use the wrappers in #lib/ui/primitives instead of Ark UI directly.'
						},
						{
							group: ['svelte/transition', 'animejs', 'animejs/*'],
							message: 'Use rise and duration from #lib/ui/motion.ts so motion shares the tokens.'
						},
						{
							group: [
								'#lib/features/game/*',
								'#lib/core/engine/*',
								'**/features/game/**',
								'**/core/engine/**'
							],
							message: 'Player mode must not import Storyteller game state.'
						}
					]
				}
			]
		}
	},
	{
		// Character and reminder names show as badges, never plain text (Trevor, 2026-10-16).
		// Type-aware: see scripts/lint/names-as-badges.js for what it catches and allows.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		// Spikes are prototypes kept as test fixtures.
		ignores: [
			'src/**/*.test.ts',
			'src/lib/core/**',
			'src/service-worker.ts',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**'
		],
		languageOptions: { parserOptions: { projectService: true, extraFileExtensions: ['.svelte'] } },
		plugins: { grim },
		rules: { 'grim/names-as-badges': 'error' }
	},
	// Player names show as PlayerBadge, the pill under a seat's token (Trevor, 2026-10-24:
	// "wherever we invoke a player name, we should use the player name badge that is on the
	// grim"). These files still show some as text. PLAYER_BADGE_TODO only shrinks.
	...(PLAYER_BADGE_TODO.length
		? [
				{
					files: PLAYER_BADGE_TODO,
					rules: { 'grim/names-as-badges': ['error', { playerNames: false }] }
				}
			]
		: []),
	{
		// Every confirmation is a ConfirmDialog: Cancel and Confirm (Trevor, 2026-10-16).
		files: ['src/**/*.svelte'],
		plugins: { grim },
		rules: { 'grim/confirm-dialog': 'error' }
	},
	{
		// Every single-line text field has an X that clears it (Trevor, 2026-10-16).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/clearable-field': 'error' }
	},
	{
		// localStorage goes through #lib/ui/stored.ts, which never throws (component review,
		// 2026-10-18). LOCAL_STORAGE_TODO only shrinks.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: [
			'src/lib/ui/stored.ts',
			// The Data section lists and clears every key, so it reads storage itself.
			'src/lib/features/settings/data/**',
			'src/**/*.test.ts',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			...LOCAL_STORAGE_TODO
		],
		rules: {
			'no-restricted-globals': [
				'error',
				{ name: 'localStorage', message: 'Use readStored/writeStored from #lib/ui/stored.ts.' }
			],
			'no-restricted-properties': [
				'error',
				{
					object: 'globalThis',
					property: 'localStorage',
					message: 'Use readStored/writeStored from #lib/ui/stored.ts.'
				},
				{
					object: 'window',
					property: 'localStorage',
					message: 'Use readStored/writeStored from #lib/ui/stored.ts.'
				}
			]
		}
	},
	// Two no-restricted-syntax lints share one rule, and a later config block replaces an earlier
	// one's options for the files both match, so files under both lints get both selectors.
	{
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: FETCH_IGNORES,
		rules: { 'no-restricted-syntax': ['error', NO_RAW_FETCH] }
	},
	{
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: [...SEAT_NAME_IGNORES, ...FETCH_IGNORES],
		rules: { 'no-restricted-syntax': ['error', NO_RAW_FETCH, NO_HAND_BUILT_SEAT_NAME] }
	},
	{
		files: FETCH_OWN,
		ignores: SEAT_NAME_IGNORES,
		rules: { 'no-restricted-syntax': ['error', NO_HAND_BUILT_SEAT_NAME] }
	},
	{
		// Every Share opens the one share screen (Trevor, 2026-10-23); only it calls
		// navigator.share. SHARE_TODO only shrinks.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: [
			'src/lib/ui/share/SharePanel.svelte',
			'src/**/*.test.ts',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			...SHARE_TODO
		],
		plugins: { grim },
		rules: { 'grim/share-panel': 'error' }
	},
	{
		// Labelled text fields are the shared TextField, search boxes SearchField
		// (component review, 2026-10-17; every older file moved 2026-10-18).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/ui/primitives/**', 'src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/text-field': 'error' }
	},
	{
		// Every delete, remove or clear is the red trash can (Trevor, 2026-10-17). Account
		// settings is exempt (Trevor, 2026-10-18): signing out is a text button, and Delete account
		// a labelled red button.
		files: ['src/**/*.svelte'],
		ignores: [
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			'src/lib/features/account/AccountPage.svelte'
		],
		plugins: { grim },
		rules: { 'grim/delete-button': 'error' }
	},
	{
		// Every close or clear X is the round IconButton (Trevor, 2026-10-18).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/ui/primitives/**', 'src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/close-button': 'error' }
	},
	{
		// One icon per meaning, from the catalogue: an edit is always the pencil (Trevor,
		// 2026-10-23). `owners` keeps a tool's icon on its own screen.
		files: ['src/**/*.svelte', 'src/**/*.ts'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: {
			'grim/icon-meaning': [
				'error',
				{ owners: { pen: ['src/lib/ui/scratch/'], eraser: ['src/lib/ui/scratch/'] } }
			]
		}
	},
	{
		// Decision modals end in Cancel and Confirm, bottom right (Trevor, 2026-10-17).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/modal-actions': 'error' }
	},
	{
		// One choice among a few options is a dropdown, not toggle buttons (Trevor, 2026-10-17).
		files: ['src/**/*.svelte', 'src/**/*.ts'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/dropdown-choice': 'error' }
	},
	{
		// Anything with a caret is the shared Collapsible, with a line between it and its
		// neighbours and one indent everywhere (Trevor, 2026-10-27).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/caret-section': 'error' }
	},
	{
		// A worked-out number sits in a filled CountBadge, not loose (Trevor, 2026-10-27).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/count-badge': 'error' }
	},
	{
		// Characters and their abilities show through the shared character components, the
		// Script tab's look (Trevor, 2026-10-30). Type-aware: see scripts/lint/character-display.js.
		// CHARACTER_DISPLAY_TODO only shrinks.
		files: ['src/**/*.ts', 'src/**/*.svelte'],
		ignores: [
			'src/**/*.test.ts',
			'src/lib/core/**',
			'src/service-worker.ts',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			// The components that draw a character, and where its icon is worked out.
			'src/lib/features/characters/icon-url.ts',
			'src/lib/features/characters/CharacterRow.svelte',
			'src/lib/features/characters/CharacterBadge.svelte',
			'src/lib/features/characters/CharacterToken.svelte',
			'src/lib/features/characters/ReminderToken.svelte',
			'src/lib/ui/seating/CharacterEmblem.svelte',
			'src/lib/features/grimoire/BoardReminder.svelte',
			'src/lib/features/grimoire/HeldAbilityPill.svelte',
			'src/lib/features/account/ProfileIcon.svelte',
			// The character's own page: CharacterSummary is its top.
			'src/lib/features/characters/CharacterSummary.svelte',
			'src/lib/features/characters/CharacterDialog.svelte',
			'src/lib/features/library/CharacterPane.svelte',
			// Shown to a player: the card hands them their character, a separate thing (Trevor,
			// 2026-10-31).
			'src/lib/features/room/RoleCard.svelte',
			'src/lib/features/setup/RevealDialog.svelte',
			'src/lib/features/show/ShownCard.svelte',
			// Icon addresses to keep offline, not drawn.
			'src/lib/features/offline/keep-offline.ts',
			...CHARACTER_DISPLAY_TODO
		],
		languageOptions: { parserOptions: { projectService: true, extraFileExtensions: ['.svelte'] } },
		plugins: { grim },
		rules: { 'grim/character-display': 'error' }
	},
	{
		// A script's name, with its logo, is one component (Trevor, 2026-10-31). The logo on
		// its own (the board's middle, the grim cover, a QR code's middle, paper) is its owners'.
		// SCRIPT_NAME_TODO only shrinks.
		files: ['src/**/*.svelte', 'src/**/*.ts'],
		ignores: [
			'src/**/*.test.ts',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			'src/lib/features/scripts/ScriptName.svelte',
			'src/lib/features/scripts/BoardLogo.svelte',
			'src/lib/features/scripts/ScriptQrCenter.svelte',
			'src/lib/features/show/CoverScreen.svelte',
			'src/lib/features/player/ScriptPrintSheet.svelte',
			...SCRIPT_NAME_TODO
		],
		plugins: { grim },
		rules: { 'grim/script-name': 'error' }
	},
	{
		// Core builds no screen text, but its fields must keep the name marks for the UI.
		files: ['src/lib/core/**/*.ts'],
		ignores: ['src/lib/core/**/*.test.ts'],
		languageOptions: { parserOptions: { projectService: true } },
		plugins: { grim },
		rules: { 'grim/names-as-badges': ['error', { plainText: false }] }
	},
	{
		// The Worker runs on workerd, not in the browser.
		files: ['worker/**/*.ts'],
		languageOptions: { globals: { ...globals.serviceworker } }
	}
);
