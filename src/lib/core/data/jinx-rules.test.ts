/**
 * The `jinxes` blocks in the official rules files use only the keys `jinx-rules.ts` documents,
 * and each names a jinx TPI has. A jinx is in effect while both characters are on the script
 * (https://wiki.bloodontheclocktower.com/Djinn); this checks only the data's shape.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findJinx } from '#lib/core/data/jinxes.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { JINX_RULE_KEYS } from './jinx-read.ts';
import { OFFICIAL_RULES, rulesFileOf } from './rules/index.ts';

const source = readFileSync(new URL('./jinx-rules.ts', import.meta.url), 'utf8');
const data = committedGameData();

/** Each official character's raw `jinxes` block, as written in its file. */
const blocks = [...OFFICIAL_RULES.keys()].flatMap((owner) => {
	const raw = rulesFileOf(owner) as { jinxes?: Record<string, Record<string, unknown>> };
	return Object.entries(raw?.jinxes ?? {}).map(([partner, rule]) => ({ owner, partner, rule }));
});

describe('jinx rules format (data/jinx-rules.ts)', () => {
	it('documents every key it reads', () => {
		const undocumented = JINX_RULE_KEYS.filter((key) => !source.includes(` * - \`${key}\``));
		expect(undocumented).toEqual([]);
	});

	it('has jinx blocks to check', () => {
		expect(blocks.length).toBeGreaterThan(100);
	});

	it.each(blocks.map((b) => [`${b.owner} with ${b.partner}`, b] as const))(
		'%s uses only documented keys and names a TPI jinx',
		(_, { owner, partner, rule }) => {
			const known: readonly string[] = JINX_RULE_KEYS;
			expect(Object.keys(rule).filter((key) => !known.includes(key))).toEqual([]);
			expect(findJinx(data.jinxes, owner, partner), `${owner} + ${partner}`).toBeDefined();
		}
	);
});
