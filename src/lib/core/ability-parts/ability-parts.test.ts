/**
 * SPIKE: Trouble Brewing in ability parts, checked against what the app does today.
 *
 * Each character's parts are compiled (`derive.ts`) and compared with its hand-written rules
 * file (`data/rules/<id>.json`), TPI's night sheet and the Sort Order phrase its ability text
 * opens with. `DIFFERENCES` lists every place they disagree and why; it only shrinks.
 *
 * Basis: TPI's ability text and night sheet (committed game data), the rules files, and the
 * wiki pages cited in those files.
 */
import { describe, expect, it } from 'vitest';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { sortOrderRank, SORT_ORDER_PHRASES } from '#lib/core/data/sort-order.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { committedGameData, nightSheetPresence } from '#lib/core/testing/committed-data.ts';
import { DERIVED_KEYS, deriveRules, type DerivedKey } from './derive.ts';
import { applyJinx } from './jinx.ts';
import { readAbilityParts } from './read.ts';
import { TROUBLE_BREWING_JINXES, TROUBLE_BREWING_PARTS } from './trouble-brewing/index.ts';
import type { AbilityParts } from './types.ts';

/** Where the parts and today's rules disagree, by character and key, and why. Only shrinks. */
const DIFFERENCES: Record<string, Partial<Record<DerivedKey, string>>> = {
	poisoner: {
		impairs:
			'today the Poisoned token poisons by its label (impairmentOfLabel, rules/ability.ts); the parts say it, so a custom token name works too'
	},
	butler: {
		marksChoice:
			'parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	thief: {
		marksChoice:
			'parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	bureaucrat: {
		marksChoice:
			'parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	}
};

const data = committedGameData();

/** JSON with keys sorted, so two objects compare by content, not key order. */
const canonical = (value: unknown): string =>
	JSON.stringify(value, (_, v: unknown) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
			: v
	);
const TB = [...TROUBLE_BREWING_PARTS.keys()];

function readAll(): Map<string, AbilityParts> {
	const out = new Map<string, AbilityParts>();
	for (const [id, raw] of TROUBLE_BREWING_PARTS) {
		const issues = new Issues();
		const own = [
			...(data.byId.get(id)?.reminders ?? []),
			...Object.keys(OFFICIAL_RULES.get(id)?.reminderTargets ?? {})
		];
		const parts = readAbilityParts(raw, id, issues, own);
		expect(issues.list, id).toEqual([]);
		if (parts) out.set(id, parts);
	}
	return out;
}

const today = (parts: Map<string, AbilityParts>, id: string, key: DerivedKey): unknown => {
	const rules = OFFICIAL_RULES.get(id) ?? {};
	if (key === 'deathCause')
		return rules.deathCause && 'kind' in rules.deathCause ? rules.deathCause : undefined;
	if (key === 'targetSeats') {
		const seats = Object.entries(rules.reminderTargets ?? {}).filter(([label]) =>
			parts.get(id)?.clauses.some((c) => c.choose && c.marks === label)
		);
		return seats.length
			? Object.fromEntries(seats.map(([label, t]) => [label, t.seat]))
			: undefined;
	}
	if (key === 'fixedReminders') {
		const fixed = rules.reminderMovement?.fixed;
		return fixed?.length ? [...fixed].sort() : undefined;
	}
	return rules[key];
};

describe('Trouble Brewing as ability parts', () => {
	const parts = readAll();

	it('covers every Trouble Brewing character and Traveller', () => {
		const edition = [...data.byId.values()].filter((c) => c.edition === 'tb').map((c) => c.id);
		expect(TB.sort()).toEqual(edition.sort());
	});

	for (const id of TB) {
		describe(id, () => {
			const character = data.byId.get(id)!;
			const derived = deriveRules(parts.get(id)!, character.type);

			it('compiles to the rules it has today', () => {
				const found: Partial<Record<DerivedKey, string>> = {};
				for (const key of DERIVED_KEYS) {
					const mine = derived.rules[key];
					const theirs = today(parts, id, key);
					if (canonical(mine) !== canonical(theirs))
						found[key] = `derived ${JSON.stringify(mine)} / today ${JSON.stringify(theirs)}`;
				}
				expect(Object.keys(found).sort(), JSON.stringify(found, null, 1)).toEqual(
					Object.keys(DIFFERENCES[id] ?? {}).sort()
				);
			});

			it('wakes on the nights TPI’s night sheet lists', () => {
				const sheet = nightSheetPresence(id);
				expect(derived.wakes).toEqual({
					firstNight: sheet.firstNight,
					otherNight: sheet.otherNight
				});
			});

			// Abilities that open with a state ("You are", "If", "You might") leave it to their text.
			if (derived.opening)
				it('opens with the Sort Order phrase its timing gives', () => {
					expect(SORT_ORDER_PHRASES[sortOrderRank(character.ability)]).toBe(derived.opening);
				});
		});
	}

	it('applies the jinxes that touch Trouble Brewing', () => {
		const results = TROUBLE_BREWING_JINXES.map(
			(jinx) => [jinx.characters.join('+'), applyJinx(parts, jinx)] as const
		);
		const by = new Map(results);
		expect(by.get('heretic+baron')?.exclusive).toBe(true);
		expect(
			by
				.get('leviathan+soldier')
				?.parts.get('soldier')
				?.clauses.map((c) => c.id)
		).toEqual(['safe', 'leviathan-jinx']);
		expect(by.get('spy+poppygrower')?.suppressed).toEqual([
			{ clause: 'spy.grimoire', while: 'partner-has-ability' }
		]);
		expect(by.get('lleech+slayer')?.notes).toHaveLength(1);
	});
});
