/**
 * SPIKE: Trouble Brewing, Bad Moon Rising and Sects & Violets in ability parts, checked
 * against what the app does today.
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
import { BAD_MOON_RISING_PARTS } from './bad-moon-rising/index.ts';
import { CAROUSEL_PARTS } from './carousel/index.ts';
import { SECTS_AND_VIOLETS_PARTS } from './sects-and-violets/index.ts';
import { TROUBLE_BREWING_JINXES, TROUBLE_BREWING_PARTS } from './trouble-brewing/index.ts';
import type { AbilityParts } from './types.ts';

/**
 * Where the parts and today's rules disagree, by character and key, and why. Only shrinks.
 * Each reason starts with its gap: the design doc's gap list counts them.
 */
const DIFFERENCES: Record<string, Partial<Record<DerivedKey, string>>> = {
	poisoner: {
		impairs:
			'label-only: today the token impairs by its label (impairmentOfLabel, rules/ability.ts); parts say it, so a custom token name works too'
	},
	butler: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	thief: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	bureaucrat: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	professor: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	sailor: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	harlot: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)'
	},
	snakecharmer: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it); today it is choosesUnmarked'
	},
	bonecollector: {
		marksChoice:
			'uneven marksChoice: parts list every night choice a reminder marks; today only some are (the Savant reads it)',
		targetSeats:
			'seat judgement: a living Bone Collector picks a dead player, so never itself; today any'
	},
	courtier: {
		impairs:
			'label-only: today the token impairs by its label (impairmentOfLabel, rules/ability.ts); parts say it, so a custom token name works too',
		fixedReminders: 'countdown tokens: Drunk 3, 2, 1 replace each other; parts have no countdown'
	},
	philosopher: {
		impairs:
			'label-only: today the token impairs by its label (impairmentOfLabel, rules/ability.ts); parts say it, so a custom token name works too',
		targetSeats:
			"seat judgement: a chosen character's player, who can't be the Philosopher; parts don't know a character choice lands on someone else"
	},
	flowergirl: {
		fixedReminders: 'answer tokens: the yes and no tokens of an answer are not parts'
	},
	towncrier: {
		fixedReminders: 'answer tokens: the yes and no tokens of an answer are not parts'
	},
	juggler: {
		answers: "answer tokens: today's answer has no token, its Correct tokens are placed by day",
		fixedReminders: 'answer tokens: Correct marks each right guess, placed by day'
	},
	zombuul: {
		fixedReminders:
			'movement judgement: the Dead token marking its first death never moves, but is not listed fixed today'
	},
	sweetheart: {
		fixedReminders:
			"movement judgement: a lasting drunkenness never moves; parts can't tell it from the No Dashii's, which moves with its neighbours"
	},
	klutz: {
		gameEnd:
			'automatable: parts say evil chosen means its team loses; today the Storyteller decides'
	},
	vigormortis: {
		keepsAbility:
			'per-effect condition: only killed Minions keep their ability; parts have no condition on one effect',
		fixedReminders: 'movement judgement: Has Ability and its Poisoned stay put',
		targetSeats: 'seat judgement: it never kills itself with a token it keeps'
	},
	// Carousel Townsfolk (batch 1).
	acrobat: {
		marksChoice:
			'uneven marksChoice: Chosen always marks its night choice; today it is not listed (the Savant reads it)'
	},
	cultleader: {
		gameEnd:
			'voting: the cult vote is a vote nothing reads, so parts compile no game end; today the Storyteller decides'
	},
	pixie: {
		fixedReminders:
			'movement judgement: Has Ability goes on once, when the Mad Townsfolk dies; parts only fix a setup, first-night or once-per-game token'
	},
	// Carousel Townsfolk (batch 2)
	amnesiac: {
		deathCause:
			'one-offs: its ability is whatever the Storyteller makes up, so parts say gained-ability; today kills, since that ability may kill'
	},
	atheist: {
		gameEnd:
			'automatable: parts say good wins when the Atheist is executed; today the Storyteller decides'
	}
};

/** Characters whose derived night wakes differ from TPI's night sheet, and why. Only shrinks. */
const WAKE_DIFFERENCES: Record<string, string> = {};

/** Characters whose ability opens with another phrase than its timing gives, and why. Only shrinks. */
const OPENING_DIFFERENCES: Record<string, string> = {
	farmer:
		'wording: "When you die" and "If you die" (the Ravenkeeper) are the same timing, so parts can\'t tell them apart'
};

const data = committedGameData();

/** JSON with keys sorted, so two objects compare by content, not key order. */
const canonical = (value: unknown): string =>
	JSON.stringify(value, (_, v: unknown) =>
		v && typeof v === 'object' && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
			: v
	);
const EDITIONS: Record<string, ReadonlyMap<string, unknown>> = {
	tb: TROUBLE_BREWING_PARTS,
	bmr: BAD_MOON_RISING_PARTS,
	snv: SECTS_AND_VIOLETS_PARTS,
	carousel: CAROUSEL_PARTS
};
/** TEMPORARY: editions written in several batches, not yet complete. */
const PARTIAL = new Set(['carousel', 'fabled', 'loric']);
const ALL = new Map(Object.values(EDITIONS).flatMap((parts) => [...parts]));

function readAll(): Map<string, AbilityParts> {
	const out = new Map<string, AbilityParts>();
	for (const [id, raw] of ALL) {
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

describe('the base three editions as ability parts', () => {
	const parts = readAll();

	for (const [edition, editionParts] of Object.entries(EDITIONS))
		if (!PARTIAL.has(edition))
			it(`covers every ${edition} character and Traveller`, () => {
				const ids = [...data.byId.values()].filter((c) => c.edition === edition).map((c) => c.id);
				expect([...editionParts.keys()].sort()).toEqual(ids.sort());
			});

	for (const id of ALL.keys()) {
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
				const want = { firstNight: sheet.firstNight, otherNight: sheet.otherNight };
				if (WAKE_DIFFERENCES[id]) expect(derived.wakes).not.toEqual(want);
				else expect(derived.wakes).toEqual(want);
			});

			// Abilities that open with a state ("You are", "If", "You might") leave it to their text.
			if (derived.opening)
				it('opens with the Sort Order phrase its timing gives', () => {
					const phrase = SORT_ORDER_PHRASES[sortOrderRank(character.ability)];
					if (OPENING_DIFFERENCES[id]) expect(phrase).not.toBe(derived.opening);
					else expect(phrase).toBe(derived.opening);
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
