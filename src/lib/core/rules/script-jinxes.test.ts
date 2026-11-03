/**
 * Rules on a custom script's own jinxes (M40, `data/script-jinx-rules.ts`, `rulesForJinx`).
 *
 * A jinx is in effect while both characters are on the script
 * (https://wiki.bloodontheclocktower.com/Djinn); a script may write its own jinxes, and the
 * homebrew characters and jinx wording below are invented for these tests. A script's jinx
 * replaces TPI's for its pair, so the app uses only the script's rules for it, and none when
 * the script gives none.
 */
import { describe, expect, it } from 'vitest';
import { findJinx } from '#lib/core/data/index.ts';
import { loadScriptText, scriptToJson, toScript } from '#lib/core/data/script.ts';
import type { Json } from '#lib/core/data/validate.ts';
import { characterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import { castWith, run } from '#lib/core/model/fixtures.test-support.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { abilityState } from './ability.ts';
import {
	barredAbilities,
	createdTooLate,
	isExclusiveJinx,
	jinxForbidsBecoming,
	ownJinxRules,
	rulesForJinx,
	scriptJinxes
} from './jinxes.ts';

const data = committedGameData();

/** A script from its entries, as the import reads it, with its load problems. */
function load(entries: unknown[]) {
	const result = loadScriptText(
		JSON.stringify([{ id: '_meta', name: 'Homebrew' }, ...entries]),
		data
	);
	if (!result.script) throw new Error(JSON.stringify(result.problems));
	const script = toScript(result.script);
	const warnings = result.problems.filter((p) => p.severity !== 'info');
	return { result, script, warnings, characters: characterLookup(data, script) };
}

/** An official character's entry carrying the script's own jinxes for it. */
const official = (id: string, jinxes: Json[]) => ({ id, jinxes });

/** An invented Townsfolk for these tests, with whatever else the test gives it. */
const lamplighter = (extra: Json = {}) => ({
	id: 'lamplighter',
	name: 'Lamplighter',
	team: 'townsfolk',
	ability: 'Each night, choose a player: you learn whether they woke tonight.',
	...extra
});

const DRUNK_WHILE_IN_PLAY = { impairs: { who: 'partner', kind: 'drunk', when: ['self-in-play'] } };

describe('a script jinx between two official characters', () => {
	const entries = (rules?: Json) => [
		official('monk', [
			{
				id: 'chef',
				reason: 'While the Monk is in play, the Chef is drunk.',
				...(rules ? { rules } : {})
			}
		]),
		'chef',
		'imp',
		'empath',
		'saint',
		'poisoner'
	];

	it('changes what the app does: its partner is drunk while it is in play', () => {
		const { script, warnings } = load(entries(DRUNK_WHILE_IN_PLAY));
		expect(warnings).toEqual([]);
		expect(script.jinxes).toEqual([
			{
				characters: ['monk', 'chef'],
				reason: 'While the Monk is in play, the Chef is drunk.',
				rules: { impairs: { who: 'partner', kind: 'drunk', when: ['self-in-play'] } }
			}
		]);
		const cast = castWith({ script });
		const { game, ctx, seats } = cast(['chef', 'monk', 'imp', 'empath', 'poisoner']);
		const state = abilityState(game, seats[0], ctx.characters);
		expect(state.works).toBe(false);
		expect(state.impairments.map((i) => [i.reason, i.source])).toEqual([
			['drunk', { characterId: 'monk', seatId: seats[1] }]
		]);
		// No Monk in play: the Chef is sober.
		const without = cast(['chef', 'saint', 'imp', 'empath', 'poisoner']);
		expect(abilityState(without.game, without.seats[0], without.ctx.characters).works).toBe(true);
	});

	it('is text only with no rules, and reads the same from either side', () => {
		const { script } = load(entries());
		expect(rulesForJinx(script, 'chef', 'monk')).toBeUndefined();
		expect(rulesForJinx(script, 'monk', 'chef')).toBeUndefined();
		const cast = castWith({ script });
		const { game, ctx, seats } = cast(['chef', 'monk', 'imp', 'empath', 'poisoner']);
		expect(abilityState(game, seats[0], ctx.characters).works).toBe(true);
	});

	it('is written back out with its rules', () => {
		const { result } = load(entries(DRUNK_WHILE_IN_PLAY));
		const again = load(scriptToJson(result.script!).slice(1));
		expect(again.script.jinxes).toEqual(load(entries(DRUNK_WHILE_IN_PLAY)).script.jinxes);
	});
});

describe('a script that rewords an official jinx', () => {
	// https://wiki.bloodontheclocktower.com/Damsel#Related_Jinxes: TPI's has the Spy poison her.
	it('drops the official rules when it gives none', () => {
		const ids = ['damsel', 'imp', 'chef', 'empath', 'saint'];
		const reworded = load([
			official('spy', [{ id: 'damsel', reason: 'In our games the Spy and Damsel get along.' }]),
			...ids
		]);
		const cast = castWith({ script: reworded.script });
		const { game, ctx, seats } = cast(['damsel', 'spy', 'imp', 'chef', 'empath']);
		expect(abilityState(game, seats[0], ctx.characters).works).toBe(true);
		// The same pair with TPI's own jinx still poisons her.
		const tpi = castWith({ script: load(['spy', ...ids]).script });
		const usual = tpi(['damsel', 'spy', 'imp', 'chef', 'empath']);
		expect(abilityState(usual.game, usual.seats[0], usual.ctx.characters).works).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Heretic#Related_Jinxes: only one may be in play.
	it('no longer forbids both being in play unless its own words or rules say so', () => {
		const entries = (reason: string, rules?: Json) => [
			official('heretic', [{ id: 'pithag', reason, ...(rules ? { rules } : {}) }]),
			'pithag',
			'imp',
			'chef',
			'empath',
			'saint'
		];
		const free = load(entries('The Heretic and the Pit-Hag ignore each other here.'));
		const [jinx] = scriptJinxes(data.jinxes, scriptCharacterIds(free.script), free.script.jinxes);
		expect([jinx.source, jinx.exclusive]).toEqual(['script', false]);
		const cast = castWith({ script: free.script });
		const { game, ctx, seats } = cast(['pithag', 'imp', 'chef', 'empath', 'heretic']);
		expect(jinxForbidsBecoming(game, seats[2], 'heretic', ctx.characters)).toBeUndefined();

		const worded = load(entries('Only one of the Heretic and the Pit-Hag may be in play.'));
		const strict = castWith({ script: worded.script });
		const again = strict(['pithag', 'imp', 'chef', 'empath', 'saint']);
		const heretic = run(again.session, again.ctx, {
			type: 'AssignCharacter',
			seatId: again.seats[4],
			characterId: 'heretic'
		});
		expect(jinxForbidsBecoming(heretic.game, again.seats[2], 'pithag', again.ctx.characters)).toBe(
			'heretic'
		);
	});

	it("keeps TPI's rules when the script copies TPI's wording exactly", () => {
		const reason = findJinx(data.jinxes, 'damsel', 'spy')!.reason;
		const { script } = load([
			official('spy', [{ id: 'damsel', reason }]),
			'damsel',
			'imp',
			'chef',
			'empath'
		]);
		expect(script.jinxes).toBeUndefined();
		expect(rulesForJinx(script, 'damsel', 'spy')).toEqual({
			impairs: { kind: 'poisoned', when: ['partner-in-play'] }
		});
	});
});

describe('a script jinx with rules the app cannot use', () => {
	it('warns at load, still loads, and is text only', () => {
		const { result, script, warnings } = load([
			official('monk', [
				{
					id: 'chef',
					reason: 'The Monk makes the Chef sleepy.',
					rules: { impairs: { who: 'partner', kind: 'sleepy' } }
				}
			]),
			'chef',
			'imp',
			'empath',
			'saint'
		]);
		expect(result.ok).toBe(true);
		expect(warnings).toMatchObject([
			{
				severity: 'warning',
				where: 'Entry 2 (monk)',
				message: expect.stringContaining('text only')
			}
		]);
		expect(script.jinxes).toEqual([
			{ characters: ['monk', 'chef'], reason: 'The Monk makes the Chef sleepy.' }
		]);
		const cast = castWith({ script });
		const { game, ctx, seats } = cast(['chef', 'monk', 'imp', 'empath', 'saint']);
		expect(abilityState(game, seats[0], ctx.characters).works).toBe(true);
	});

	it('warns when a verb lacks what it works through on either character', () => {
		// `carriedBy` needs a `carrierIsDemon` token on its subject, which the Chef lacks.
		const { warnings, script } = load([
			official('monk', [
				{
					id: 'chef',
					reason: 'Only a Townsfolk may carry the Chef.',
					rules: { carriedBy: { who: 'partner', type: 'townsfolk' } }
				}
			]),
			'chef',
			'imp'
		]);
		expect(warnings.map((w) => w.message)).toEqual([
			expect.stringContaining('needs `carrierIsDemon`')
		]);
		expect(script.jinxes?.[0].rules).toBeUndefined();
	});
});

describe("a custom character's jinx", () => {
	const cast = (entries: unknown[]) => {
		const loaded = load(entries);
		const { game, ctx, seats } = castWith({ script: loaded.script })([
			'fortuneteller',
			'lamplighter',
			'imp',
			'empath',
			'poisoner'
		]);
		return { ...loaded, works: abilityState(game, seats[0], ctx.characters).works };
	};
	const others = ['fortuneteller', 'imp', 'empath', 'poisoner'];

	it('works from its jinx entry', () => {
		const { works, warnings } = cast([
			lamplighter({
				jinxes: [
					{
						id: 'fortuneteller',
						reason: 'While the Lamplighter is in play, the Fortune Teller is drunk.',
						rules: DRUNK_WHILE_IN_PLAY
					}
				]
			}),
			...others
		]);
		expect(warnings).toEqual([]);
		expect(works).toBe(false);
	});

	it("works from its own rules block's jinxes, beside its text", () => {
		const { works, warnings } = cast([
			lamplighter({
				rules: { jinxes: { fortuneteller: DRUNK_WHILE_IN_PLAY } },
				jinxes: [{ id: 'fortuneteller', reason: 'The Fortune Teller is drunk with us.' }]
			}),
			...others
		]);
		expect(warnings).toEqual([]);
		expect(works).toBe(false);
	});

	it('keeps the character when its own jinx rules are bad, without them', () => {
		const { works, warnings, characters } = cast([
			lamplighter({ rules: { jinxes: { fortuneteller: { impairs: 'sleepy' } } } }),
			...others
		]);
		expect(warnings.map((w) => [w.where, w.severity])).toEqual([
			['Entry 2 (lamplighter)', 'warning']
		]);
		expect(characters.get('lamplighter')?.name).toBe('Lamplighter');
		expect(works).toBe(true);
	});
});

describe('the text fallback', () => {
	it('reads "only one of X and Y" as only one in play', () => {
		expect(isExclusiveJinx('Only one of the Godfather and the Lamplighter may be in play.')).toBe(
			true
		);
		expect(isExclusiveJinx('The Lamplighter and the Godfather may not both be in play.')).toBe(
			true
		);
		expect(isExclusiveJinx('Only 1 jinxed character can be in play.')).toBe(true);
		expect(isExclusiveJinx('Only the Lamplighter learns this.')).toBe(false);
	});
});

/**
 * The audit's homebrew sentences (ability-parts/jinx-format-audit.md, H1 to H17), each written
 * as a script's own jinx. The Lamplighter, the Hexer and the Gloom are invented characters.
 */
describe('homebrew sentences', () => {
	const jinx = (id: string, reason: string, rules: Json) => ({ id, reason, rules });
	const clean = (entries: unknown[]) => {
		const loaded = load(entries);
		expect(loaded.warnings).toEqual([]);
		return loaded;
	};

	it('H1: the Lamplighter cannot give the Demon the Saint ability', () => {
		const { script, characters } = clean([
			lamplighter({
				rules: { givesAbility: { to: 'demon', types: ['outsider'] } },
				jinxes: [
					jinx('saint', 'The Demon never gets the Saint ability.', { cannotCreate: 'givesAbility' })
				]
			}),
			'saint',
			'imp'
		]);
		expect(barredAbilities('lamplighter', script, characters)).toEqual(['saint']);
	});

	it('H2: only one of the Godfather and the Lamplighter, from the wording alone', () => {
		const { script } = clean([
			lamplighter({
				jinxes: [
					{
						id: 'godfather',
						reason: 'Only one of the Godfather and the Lamplighter may be in play.'
					}
				]
			}),
			'godfather',
			'imp'
		]);
		expect(rulesForJinx(script, 'godfather', 'lamplighter')).toEqual({ exclusive: true });
	});

	it('H3: the Spy registers as good to the Lamplighter', () => {
		const { script, characters } = clean([
			lamplighter({
				jinxes: [
					jinx('spy', 'The Spy shows as good.', {
						registersTo: { who: 'partner', alignments: ['good'] }
					})
				]
			}),
			'spy',
			'imp'
		]);
		expect(ownJinxRules({ script }, 'spy', 'lamplighter', characters)?.registersTo).toEqual({
			alignments: ['good']
		});
	});

	it('H5: while the Lamplighter lives, the Washerwoman has no ability', () => {
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('washerwoman', 'A living Lamplighter takes it.', {
						impairs: { who: 'partner', kind: 'no-ability', when: ['self-alive'] }
					})
				]
			}),
			'washerwoman',
			'imp',
			'empath',
			'poisoner'
		]);
		const { session, ctx, seats } = castWith({ script })([
			'washerwoman',
			'lamplighter',
			'imp',
			'empath',
			'poisoner'
		]);
		expect(abilityState(session.game, seats[0], ctx.characters).works).toBe(false);
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[1], dead: true });
		expect(abilityState(dead.game, seats[0], ctx.characters).works).toBe(true);
	});

	it("H6: the Imp doesn't kill while the Lamplighter's token stops it", () => {
		const { script, characters } = clean([
			lamplighter({
				reminders: ['Dimmed'],
				rules: { stopsKilling: { token: 'Dimmed', type: 'demon' } },
				jinxes: [
					jinx('imp', 'A dimmed Imp does not kill.', { noKill: { who: 'partner', on: 'token' } })
				]
			}),
			'imp'
		]);
		expect(ownJinxRules({ script }, 'imp', 'lamplighter', characters)?.noKill).toEqual({
			on: 'token'
		});
	});

	it('H10: the Pit-Hag cannot create the Lamplighter after day 3', () => {
		const { script, characters } = clean([
			lamplighter({
				jinxes: [
					jinx('pithag', 'Not after day 3.', {
						cannotCreate: { who: 'partner', via: 'changesCharacter', when: [{ afterDay: 3 }] }
					})
				]
			}),
			'pithag',
			'imp'
		]);
		const day = { entries: [] } as never;
		expect(createdTooLate({ script, pastDays: [day, day] }, 'pithag', characters)).toEqual([]);
		expect(createdTooLate({ script, pastDays: [day, day, day] }, 'pithag', characters)).toEqual([
			'lamplighter'
		]);
	});

	it("H13 and H14: rules on an official partner's side, from the custom character's entry", () => {
		const { script, characters } = clean([
			lamplighter({
				jinxes: [
					jinx('vortox', 'The Lamplighter learns the truth.', { trueInfo: { who: 'partner' } }),
					jinx('cannibal', 'The Cannibal learns it gained this.', {
						learns: { who: 'partner', what: 'ability' }
					})
				]
			}),
			'vortox',
			'cannibal'
		]);
		expect(ownJinxRules({ script }, 'vortox', 'lamplighter', characters)).toEqual({ trueInfo: {} });
		expect(ownJinxRules({ script }, 'cannibal', 'lamplighter', characters)).toEqual({
			learns: { what: 'ability' }
		});
	});

	it('H4, H15, H16, H17: the custom character changes itself or its partner', () => {
		const { script, characters } = clean([
			lamplighter({ jinxes: [jinx('fortuneteller', 'Drunk while we play.', DRUNK_WHILE_IN_PLAY)] }),
			{
				id: 'hexer',
				name: 'Hexer',
				team: 'minion',
				ability: 'Each night*, choose a player and a character they become.',
				rules: { changesCharacter: { types: ['townsfolk', 'outsider', 'minion', 'demon'] } },
				jinxes: [jinx('lilmonsta', 'Also a Minion.', { alsoBecomes: 'minion' })]
			},
			{
				id: 'gloom',
				name: 'Gloom',
				team: 'demon',
				ability: 'Each night*, choose a player: they die.',
				jinxes: [
					jinx('sage', 'A chosen Sage acts but lives.', {
						nightChoice: { chooses: 'good', partner: 'acts' }
					}),
					jinx('magician', 'No Magician ability.', {
						impairs: { who: 'partner', kind: 'no-ability', when: ['self-in-play'] }
					})
				]
			},
			'fortuneteller',
			'lilmonsta',
			'sage',
			'magician'
		]);
		const rules = (a: string, b: string) => ownJinxRules({ script }, a, b, characters);
		expect(rules('fortuneteller', 'lamplighter')?.impairs?.kind).toBe('drunk');
		expect(rules('hexer', 'lilmonsta')?.alsoBecomes).toEqual({ type: 'minion' });
		expect(rules('gloom', 'sage')?.nightChoice).toEqual({ chooses: 'good', partner: 'acts' });
		expect(rules('magician', 'gloom')?.impairs?.kind).toBe('no-ability');
	});
});
