/**
 * The Character builder's jinx fields (M79): every verb the jinx reader takes has fields, in
 * its short and full forms, so a jinx written either way opens in fields.
 */
import { describe, expect, it } from 'vitest';
import { uncovered, type FieldSpec } from './field-spec.ts';
import { JINX_FIELDS } from './jinx-fields.ts';
import { JINX_RULE_KEYS } from './jinx-read.ts';

const ofEntry = (JINX_FIELDS as Extract<FieldSpec, { kind: 'byCharacter' }>).of as Extract<
	FieldSpec,
	{ kind: 'object' }
>;

describe('jinx fields', () => {
	it('has fields for every verb the jinx reader takes', () => {
		const keys = ofEntry.fields.map((f) => f.key);
		expect([...keys].sort()).toEqual([...JINX_RULE_KEYS].sort());
	});

	it('holds a verb written short or in full, with who and when', () => {
		const jinxes = {
			empath: { impairs: 'poisoned', partnerInPlay: true },
			chef: {
				impairs: { kind: 'drunk', who: 'both', when: ['self-alive', { not: { day: 2 } }] },
				noKill: 'token'
			}
		};
		expect(uncovered(JINX_FIELDS, jinxes)).toEqual([]);
	});

	it('finds what the fields do not hold', () => {
		expect(uncovered(JINX_FIELDS, { empath: { impairs: 'tired', madeUp: true } })).toEqual([
			'.empath.madeUp',
			'.empath.impairs'
		]);
	});
});
