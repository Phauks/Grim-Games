/**
 * Every official character whose ability text names a mechanic has the rule for it (the
 * character ability audit, 2026-10-27: abilities that act differently were missed because
 * nothing asked). Each trait pairs words in the ability text with the rules that encode
 * them; a character the words match without such a rule must be in `TRAIT_TODO` with why.
 * `TRAIT_TODO` only shrinks: an entry whose character now has the rule, or whose text no
 * longer matches, fails too, so it is taken off.
 *
 * Basis: TPI's ability text (committed game data) and the rules files; the reasons cite the
 * character's wiki page.
 */
import { describe, expect, it } from 'vitest';
import type { CharacterRules } from '#lib/core/data/character-rules.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import type { Character } from '#lib/core/data/types.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { impairmentOfLabel } from './ability.ts';

const W = 'https://wiki.bloodontheclocktower.com/';

interface Trait {
	/** Words in the ability text that say the character has this mechanic. */
	words: RegExp;
	/** Whether its rules (or its own reminder tokens) encode it. */
	has: (rules: CharacterRules, character: Character) => boolean;
}

const TRAITS: Record<string, Trait> = {
	// It makes players drunk or poisoned: an `impairs` rule, or its own Poisoned or Drunk token.
	impairs: {
		words: /\b(poison|drunk)/i,
		has: (r, c) => !!r.impairs || (c.reminders ?? []).some((l) => !!impairmentOfLabel(l))
	},
	// A player can't die, or survives or moves a death.
	protects: {
		words: /\b(can ?not|can't) die\b|\bsafe from\b/i,
		has: (r) => !!r.protects || !!r.survivesFirstDeath || !!r.redirectsKill
	},
	// A player registers as something they are not.
	registersAs: { words: /\bregisters?\b/i, has: (r) => !!r.registersAs },
	// The ability kills: a `kills` rule for its night step, or a `deathCause`.
	kills: {
		words: /\b(they|that player|a player|chosen player)s? dies?\b|\bkill\b/i,
		has: (r) => !!r.kills || !!r.deathCause
	},
	// Dying sets it off, or it acts while dead.
	onDeath: { words: /\b(if|when) you die\b/i, has: (r) => !!r.onDeath || !!r.actsWhenDead }
};

/** Characters the words match that have no rule for the trait, and why. Only shrinks. */
const TRAIT_TODO: Record<string, Record<string, string>> = {
	impairs: {
		acrobat: `reads a neighbour's poisoning rather than causing it (${W}Acrobat)`,
		boffin: `"even if drunk or poisoned" qualifies the Demon's gained ability (${W}Boffin)`,
		ogre: `"even if drunk or poisoned" qualifies its alignment change (${W}Ogre)`
	},
	protects: {
		deviant: `only "can't die by exile" if funny today: the Storyteller judges it (${W}Deviant)`
	},
	registersAs: {
		fortuneteller: `the Red Herring registers as a Demon only to its own answer, in learns (${W}Fortune_Teller)`,
		zombuul: `registers as dead through gameEnd.aliveWhileDead (${W}Zombuul)`
	}
};

const data = committedGameData();

describe('every ability that names a mechanic has its rule', () => {
	for (const [trait, { words, has }] of Object.entries(TRAITS)) {
		it(trait, () => {
			const missing: string[] = [];
			for (const [id, rules] of OFFICIAL_RULES) {
				const character = data.byId.get(id);
				if (!character || !words.test(character.ability)) continue;
				if (!has(rules, character)) missing.push(id);
			}
			expect(missing.sort()).toEqual(Object.keys(TRAIT_TODO[trait] ?? {}).sort());
		});
	}

	it('lists to-dos only for traits that exist', () => {
		for (const trait of Object.keys(TRAIT_TODO)) expect(TRAITS).toHaveProperty(trait);
	});
});
