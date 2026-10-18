import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import grim from './scripts/lint/plugin.js';

/** Files still hand-building labelled text fields; only ever shrinks (see grim/text-field). */
const TEXT_FIELD_TODO = [
	'src/lib/features/account/SignInForm.svelte',
	'src/lib/features/day/NoteSheet.svelte',
	'src/lib/features/glossary/GlossaryDialog.svelte',
	'src/lib/features/info-tokens/InfoTokenList.svelte',
	'src/lib/features/library/LabelManager.svelte',
	'src/lib/features/library/LibraryPage.svelte',
	'src/lib/features/player/NoteEditor.svelte',
	'src/lib/features/reference/CharacterReference.svelte',
	'src/lib/features/reference/NightOrderReference.svelte',
	'src/lib/features/reports/ReportDialog.svelte',
	'src/lib/features/reports/ReportsInbox.svelte',
	'src/lib/features/scripts/AddScript.svelte',
	'src/lib/features/scripts/BotcFilter.svelte',
	'src/lib/features/scripts/ScriptSearchBar.svelte',
	'src/lib/features/setup/RevealDialog.svelte'
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
		// Features reach Ark UI only through our own wrappers in src/lib/ui/primitives.
		files: ['src/lib/features/**', 'src/routes/**'],
		rules: {
			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['@ark-ui/*'],
							message: 'Use the wrappers in #lib/ui/primitives instead of Ark UI directly.'
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
		// Labelled text fields are the shared TextField (component review, 2026-10-17).
		// TEXT_FIELD_TODO lists the files written before it; the list only shrinks: move a
		// file onto TextField and take it off, never add one.
		files: ['src/**/*.svelte'],
		ignores: [
			'src/lib/ui/primitives/**',
			'src/lib/features/spikes/**',
			'src/routes/spikes/**',
			...TEXT_FIELD_TODO
		],
		plugins: { grim },
		rules: { 'grim/text-field': 'error' }
	},
	{
		// Every delete, remove or clear is the red trash can (Trevor, 2026-10-17).
		files: ['src/**/*.svelte'],
		ignores: ['src/lib/features/spikes/**', 'src/routes/spikes/**'],
		plugins: { grim },
		rules: { 'grim/delete-button': 'error' }
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
