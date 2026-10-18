import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { STANDARD_INFO_TOKENS } from '#lib/core/data/info-tokens.ts';
import { tokenTitle } from './token-title.ts';

const DIR = new URL('./', import.meta.url);
const sources = readdirSync(DIR)
	.filter((file) => file.endsWith('.svelte'))
	.map((file) => [file, readFileSync(new URL(file, DIR), 'utf8')] as const);

/** Dialog and sheet titles that name a screen or an action, not a token. */
const NOT_TOKENS = [
	'info-tokens.title',
	'info-tokens.quick',
	'info-tokens.characterCards',
	'info-tokens.belongsTo',
	'info-tokens.edit',
	'info-tokens.newLabel',
	'info-tokens.deleteConfirm',
	// A character card: its name and its character, as its tile shows them.
	'info-tokens.cardFor'
];

describe('tokenTitle', () => {
	it('is the text on every standard and enhanced tile', () => {
		for (const token of STANDARD_INFO_TOKENS) expect(tokenTitle(token)).toBe(token.text);
	});
	it('drops the formatting marks of a custom token', () => {
		expect(tokenTitle({ text: 'You are **drunk**' })).toBe('You are drunk');
	});
});

describe('info token dialogs and sheets', () => {
	/** The expression a title uses, with a `$derived` name replaced by what it derives. */
	function expand(source: string, title: string): string {
		const name = title.trim();
		if (!/^\w+$/.test(name)) return title;
		const derived = new RegExp(`const ${name} = \\$derived\\(([\\s\\S]*?)\\);\\n`).exec(source);
		return derived ? derived[1] : title;
	}

	const titled = sources
		.map(([file, source]) => {
			const titles = [
				...source.matchAll(/<(?:Dialog|BottomSheet)\b[^>]*?\btitle=\{([^}]*)\}/g),
				...source.matchAll(/<(?:Dialog|BottomSheet)\b[^>]*?\s\{title\}/g)
			].map((match) => expand(source, match[1] ?? 'title'));
			return [file, titles] as const;
		})
		.filter(([, titles]) => titles.length > 0);

	// Every dialog or sheet opened from a token takes the token's own name: a token's text is
	// only ever read through tokenTitle, and any fixed wording names a screen, not a token.
	it.each(titled)('%s titles them with tokenTitle or a screen name', (_file, titles) => {
		for (const title of titles) {
			const rest = title.replace(/tokenTitle\([^()]*\)/g, '');
			const keys = [...rest.matchAll(/\bt\('([^']+)'/g)].map((match) => match[1]);
			expect(rest, `title={${title}}`).not.toMatch(/\.text\b/);
			for (const key of keys) expect(NOT_TOKENS, `title={${title}}`).toContain(key);
		}
	});
});
