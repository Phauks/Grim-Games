import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
	includeIgnoreFile(gitignorePath),
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
		// The Worker runs on workerd, not in the browser.
		files: ['worker/**/*.ts'],
		languageOptions: { globals: { ...globals.serviceworker } }
	}
);
