import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A worked-out number sits in a CountBadge beside its words, never in brackets in them (Trevor,
 * 2026-10-27: "If a number is a calculation, it should sit in a colored circle, not be loose in
 * the air"). `grim/count-badge` checks the markup; this checks the English catalog.
 */
const dir = new URL('../src/lib/i18n/messages/en/', import.meta.url);

describe('count messages', () => {
	it('no message puts a count in brackets, as "Townsfolk ({count})"', () => {
		const found = readdirSync(dir)
			.filter((f) => f.endsWith('.ts'))
			.flatMap((f) =>
				[...readFileSync(new URL(f, dir), 'utf8').matchAll(/'([\w.-]+)':\s*'([^']*)'/g)]
					.filter(([, , text]) => /\(\{(count|total|n)\}\)/.test(text))
					.map(([, key]) => key)
			);
		expect(found).toEqual([]);
	});
});
