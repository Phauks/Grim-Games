import { globSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findHardcodedText } from '#lib/i18n/hardcoded.ts';
import { ALLOWED_TEXT, MIGRATED_PATHS } from '#lib/i18n/migrated.ts';

const ROOT = path.resolve(import.meta.dirname, '../../..');

describe('findHardcodedText', () => {
	it('finds text between tags and in readable attributes', () => {
		const source = `<script>const x = 'Not template text';</script>
<h2>Night order</h2>
<Button label="Close" class="primary-button" />
<input placeholder="Search" aria-label={t('common.close')} />
{#if open}<p>Seat {n} is <b>dead</b></p>{/if}`;
		expect(findHardcodedText(source).map((found) => `${found.line}:${found.text}`)).toEqual([
			'2:Night order',
			'3:Close',
			'4:Search',
			'5:Seat',
			'5:is',
			'5:dead'
		]);
	});

	it('skips translated text, symbols, code and styles', () => {
		const source = `<p>{t('common.none')}</p><span>× · 3</span><code>npm run</code>
<style>p { content: 'Words'; }</style>`;
		expect(findHardcodedText(source)).toEqual([]);
	});
});

describe('migrated folders', () => {
	it('have no interface text written into their templates', () => {
		const problems: string[] = [];
		for (const file of globSync('src/**/*.svelte', { cwd: ROOT })) {
			const relative = file.split(path.sep).join('/');
			if (!MIGRATED_PATHS.some((prefix) => relative.startsWith(prefix))) continue;
			const allowed = new Set(ALLOWED_TEXT[relative] ?? []);
			for (const found of findHardcodedText(readFileSync(path.join(ROOT, file), 'utf8'))) {
				if (!allowed.has(found.text)) problems.push(`${relative}:${found.line} "${found.text}"`);
			}
		}
		expect(problems).toEqual([]);
	});
});
