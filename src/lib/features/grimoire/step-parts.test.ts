import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Dusk, Minion info, Demon info and Dawn are drawn by the same step as a character's (Trevor,
 * 2026-11-06: "Minion and demon info need to be treated like character with the night order
 * steps and eyes and the rest. I constantly play catch-up with these. Similar to dawn and
 * dusk"). A part of the step the Storyteller opens (`GuidedStep`) or of the strip under the
 * board (`NightStrip`) that only a character's step gets falls behind on the others, so every
 * condition that looks at the step's character or its kind must be listed here, with why only
 * one kind of step can have it. A new one fails until it is either drawn for every step or
 * given its reason.
 */
const ONE_KIND_ONLY: Record<string, Record<string, string>> = {
	'GuidedStep.svelte': {
		'{:else if holders.length > 1 && step.character}':
			"Several holders of a character are named in its band; Minion info's are under it.",
		'{#if !step.character && holders.length > 1}':
			"Minion info's players sit under its band, so the band keeps the step's name.",
		'{#if step.character}':
			'A character\'s own ability, and its abilities\' own parts (changing a character, a gained or Storyteller ability, "mad as", countdowns, chosen kills, No attack): a step with no character has no ability.',
		'{#if evilStep}':
			"Minion info's and Demon info's cards, numbered on from their text's lines as a character's info lines are.",
		'{#if step.character && onShowGrimoire && seesGrimoire(step.character)}':
			'The Grimoire is shown only to a character whose ability sees it (the Spy, the Widow).',
		'{#if step.id === TRAVELLER_JOINS_STEP}': "The Storyteller's own step for Travellers joining.",
		'{#if step.id === TRAVELLER_ALIGNMENT_STEP}':
			"The Storyteller's own step for Traveller alignments.",
		'{#if evilStep && !textLines}':
			'Minion info and Demon info with no text, which the night order never makes: their cards still show.',
		'{#if step?.character}': 'The "chose" picker heads with the character whose player chose.'
	},
	'NightStrip.svelte': {}
};

const conditions = (source: string) =>
	[...source.matchAll(/\{[#:](?:else )?if [^}]*\}/g)]
		.map((m) => m[0])
		.filter((c) => /step\??\.(character|id|kind)\b|evilStep|isNightMarker|'marker'/.test(c));

describe('night steps of every kind', () => {
	for (const [file, allowed] of Object.entries(ONE_KIND_ONLY)) {
		const source = readFileSync(new URL(file, import.meta.url), 'utf8');
		const found = new Set(conditions(source));

		it(`${file} gives every kind of step the same parts`, () => {
			const unlisted = [...found].filter((c) => !(c in allowed));
			expect(
				unlisted,
				'Draw this for every step, Dusk, Minion info, Demon info and Dawn too, or list it with its reason in ONE_KIND_ONLY'
			).toEqual([]);
		});

		it(`${file}'s list has no stale entries`, () => {
			expect(Object.keys(allowed).filter((c) => !found.has(c))).toEqual([]);
		});
	}

	it("draws every step's text as its Steps, not only a character's", () => {
		const guided = readFileSync(new URL('GuidedStep.svelte', import.meta.url), 'utf8');
		expect(guided).toMatch(/const textLines = \$derived\(step \? stepNightText\(step, night\)/);
		expect(guided).toMatch(/\{#if textLines\}\s*<h3>Steps<\/h3>/);
	});
});
