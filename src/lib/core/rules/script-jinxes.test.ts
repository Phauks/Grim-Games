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
import { castWith, run, type CastGame } from '#lib/core/model/fixtures.test-support.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game } from '#lib/core/model/types.ts';
import type { Command } from '#lib/core/engine/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { abilityState, registrations } from './ability.ts';
import { gameEnds } from './game-end.ts';
import { nightStepAlerts, type NightAlert } from './night-alerts.ts';
import { nightKill } from './night-kill.ts';
import { reminderTargetMisses } from './reminder-targets.ts';
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

	it('H3: the Spy registers as good to the Lamplighter, only with always', () => {
		const entries = (always: boolean) => [
			lamplighter({
				jinxes: [
					jinx('spy', 'The Spy shows as good.', {
						registersTo: { who: 'partner', alignments: ['good'], ...(always ? { always } : {}) }
					})
				]
			}),
			'spy',
			'imp',
			'empath',
			'poisoner'
		];
		// Wiki (Spy): "It is the Storyteller's choice as to what the Spy registers as, even as many characters or both alignments during the same night."
		const { script } = clean(entries(true));
		const { game, ctx, seats } = castWith({ script })([
			'spy',
			'lamplighter',
			'imp',
			'empath',
			'poisoner'
		]);
		const spy = (viewer: string) =>
			registrations(game, ctx.characters, viewer).find((r) => r.seatId === seats[0]);
		expect(spy('lamplighter')?.alignments).toEqual(['good']);
		expect(spy('empath')?.alignments).toEqual(['evil', 'good']);
		// Without `always` it only adds what the Spy may already register as: a load warning.
		const plain = load(entries(false));
		expect(plain.warnings.map((w) => w.message)).toEqual([expect.stringContaining('add `always`')]);
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

	it('H6: if the Lamplighter chooses the Imp, the Imp does not kill tonight', () => {
		// Wiki (Imp): "On each night except the first, the Imp chooses a player to kill."
		const { script } = clean([
			lamplighter({
				reminders: ['Lit'],
				jinxes: [
					jinx('imp', 'A lit Imp does not kill.', {
						noKill: { who: 'partner', on: 'chosen', token: 'Lit' }
					})
				]
			}),
			'imp',
			'empath',
			'poisoner',
			'chef'
		]);
		const cast = castWith({ script });
		const lit = (s: string[]): Command => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'lamplighter', label: 'Lit' }
		});
		const players = ['imp', 'lamplighter', 'empath', 'poisoner', 'chef'];
		const night2 = cast(players, { type: 'NewDay' }, lit);
		expect(nightKill(night2.game, night2.seats[0], 'imp', night2.ctx.characters)?.max).toBe(0);
		expect(
			nightStepAlerts(night2.game, 'imp', night2.ctx.characters)
				.filter((a) => a.kind === 'no-kill')
				.map((a) => a.source !== 'override' && a.source.characterId)
		).toEqual(['lamplighter']);
		// Not chosen tonight: the Imp kills as usual, and a Lit left from last night doesn't count.
		const free = cast(players, { type: 'NewDay' });
		expect(nightKill(free.game, free.seats[0], 'imp', free.ctx.characters)?.max).toBe(1);
		const stale = cast(players, lit, { type: 'NewDay' });
		expect(nightKill(stale.game, stale.seats[0], 'imp', stale.ctx.characters)?.max).toBe(1);
	});

	it("warns at load when a kill-stopping token makes the jinx's noKill do nothing", () => {
		const { warnings, script } = load([
			lamplighter({
				reminders: ['Dimmed'],
				rules: { stopsKilling: { token: 'Dimmed', type: 'demon' } },
				jinxes: [
					jinx('imp', 'A dimmed Imp does not kill.', { noKill: { who: 'partner', on: 'token' } })
				]
			}),
			'imp'
		]);
		expect(warnings.map((w) => w.message)).toEqual([expect.stringContaining('changes nothing')]);
		// Kept: it loads, and only the author is told.
		expect(script.jinxes?.[0].rules).toEqual({ noKill: { who: 'partner', on: 'token' } });
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

/**
 * The rest of the homebrew sentences the audit's re-run graded Partly or No (H7, H8, H9, H11,
 * H12, and its own N1 to N5), written with M44's conditions and verbs and checked through what
 * the app does with them. Each jinx is the script's own, so the Djinn's rule for it is the
 * script's: the wiki's general rule is that each special rule fits its own pair.
 */
describe('homebrew sentences, stage 4 (M44)', () => {
	const jinx = (id: string, reason: string, rules: Json) => ({ id, reason, rules });
	const clean = (entries: unknown[]) => {
		const loaded = load(entries);
		expect(loaded.warnings).toEqual([]);
		return loaded;
	};
	const gloom = (extra: Json = {}) => ({
		id: 'gloom',
		name: 'Gloom',
		team: 'demon',
		ability: 'Each night*, choose a player: they die.',
		...extra
	});
	const kinds = (alerts: NightAlert[], kind: NightAlert['kind']) =>
		alerts.filter((a) => a.kind === kind);

	it('H7: when the Lamplighter is executed, the Undertaker also learns their true character', () => {
		// Wiki (Undertaker): "The player must have died from execution for the Undertaker to learn who they are."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('undertaker', 'The Undertaker learns the Lamplighter too.', {
						learns: { who: 'partner', what: 'character', when: ['self-executed'] }
					})
				]
			}),
			'undertaker',
			'imp',
			'empath',
			'poisoner'
		]);
		const cast = castWith({ script });
		const players = ['undertaker', 'lamplighter', 'imp', 'empath', 'poisoner'];
		const executed = cast(players, { type: 'NewDay' }, (s) => ({ type: 'Execute', seatId: s[1] }));
		const alerts = nightStepAlerts(executed.game, 'undertaker', executed.ctx.characters);
		expect(kinds(alerts, 'learns-character').map((a) => [a.seatId, a.about, a.partner])).toEqual([
			[executed.seats[0], executed.seats[1], 'lamplighter']
		]);
		// Someone else executed: nothing more to learn.
		const other = cast(players, { type: 'NewDay' }, (s) => ({ type: 'Execute', seatId: s[3] }));
		expect(
			kinds(nightStepAlerts(other.game, 'undertaker', other.ctx.characters), 'learns-character')
		).toEqual([]);
	});

	it('H8: if the Widow would poison the Lamplighter, the Storyteller chooses another player', () => {
		// Wiki (Widow): "The Widow points to a character token in the Grimoire. Mark them with a '''POISONED''' reminder."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('widow', 'The Widow poisons someone else.', {
						storytellerChooses: { who: 'partner', what: 'another-player' }
					})
				]
			}),
			'widow',
			'imp',
			'chef',
			'empath'
		]);
		const { game, ctx, seats } = castWith({ script })([
			'widow',
			'lamplighter',
			'imp',
			'chef',
			'empath'
		]);
		const poisoned = { characterId: 'widow', label: 'Poisoned' };
		expect(reminderTargetMisses(game, poisoned, seats[1], ctx.characters)).toEqual([
			'jinx-redirect'
		]);
		expect(reminderTargetMisses(game, poisoned, seats[3], ctx.characters)).toEqual([]);
		// The Widow's Know marks no choice of hers.
		const know = { characterId: 'widow', label: 'Know' };
		expect(reminderTargetMisses(game, know, seats[1], ctx.characters)).not.toContain(
			'jinx-redirect'
		);
		expect(
			kinds(nightStepAlerts(game, 'widow', ctx.characters), 'storyteller-redirects').map((a) => [
				a.seatId,
				a.partner
			])
		).toEqual([[seats[1], 'lamplighter']]);
	});

	it('H9: the Lamplighter cannot choose the Vizier', () => {
		// Wiki (Vizier): "On the first day, all players learn that the Vizier is in play, and which player it is."
		const { script } = clean([
			lamplighter({
				reminders: ['Lit'],
				jinxes: [
					jinx('vizier', 'The Lamplighter never chooses the Vizier.', { cannotChoose: true })
				]
			}),
			'vizier',
			'imp',
			'chef',
			'empath'
		]);
		const { game, ctx, seats } = castWith({ script })([
			'lamplighter',
			'vizier',
			'imp',
			'chef',
			'empath'
		]);
		const lit = { characterId: 'lamplighter', label: 'Lit' };
		expect(reminderTargetMisses(game, lit, seats[1], ctx.characters)).toEqual(['jinx-choice']);
		expect(reminderTargetMisses(game, lit, seats[2], ctx.characters)).toEqual([]);
		expect(
			kinds(nightStepAlerts(game, 'lamplighter', ctx.characters), 'cannot-choose').map((a) => [
				a.seatId,
				a.partner
			])
		).toEqual([[seats[1], 'vizier']]);
		// The Vizier's own choices are not limited: the jinx is about the Lamplighter's.
		expect(kinds(nightStepAlerts(game, 'vizier', ctx.characters), 'cannot-choose')).toEqual([]);
	});

	describe('H11: if the Lamplighter is executed while the Saint is alive, good wins', () => {
		// Wiki (Saint): "If the Saint dies in any way other than execution—such as the Demon killing them—then the game continues."
		const entries = [
			lamplighter({
				jinxes: [
					jinx('saint', 'Executing the Lamplighter while the Saint lives wins it for good.', {
						endsGame: { kind: 'executed', winner: 'good', when: ['partner-alive'] }
					})
				]
			}),
			'saint',
			'imp',
			'empath',
			'poisoner'
		];
		const players = ['lamplighter', 'saint', 'imp', 'empath', 'poisoner'];
		const jinxEnd = (game: Game, characters: CharacterLookup) =>
			gameEnds(game, characters)
				.filter((e) => e.jinxedWith === 'saint')
				.map((e) => [e.rule, e.winner, e.seats]);
		const execute = (s: string[]): Command => ({ type: 'Execute', seatId: s[0] });
		const saintDies = (s: string[]): Command => ({ type: 'SetDead', seatId: s[1], dead: true });

		it('ends the game for good, with no token and no nomination', () => {
			// Wiki (Saint): "If the Saint dies by execution, the game ends."
			const { game, ctx, seats } = castWith({ script: clean(entries).script })(
				players,
				{ type: 'NewDay' },
				execute
			);
			expect(jinxEnd(game, ctx.characters)).toEqual([['jinx-executed', 'good', [seats[0]]]]);
		});

		it('checks the Saint alive at the execution, not later', () => {
			// Wiki (Saint): "If the Saint dies in any way other than execution—such as the Demon killing them—then the game continues."
			const cast = castWith({ script: clean(entries).script });
			const after = cast(players, { type: 'NewDay' }, execute, saintDies);
			expect(jinxEnd(after.game, after.ctx.characters)).toEqual([
				['jinx-executed', 'good', [after.seats[0]]]
			]);
			const before = cast(players, saintDies, { type: 'NewDay' }, execute);
			expect(jinxEnd(before.game, before.ctx.characters)).toEqual([]);
		});
	});

	it('H12: the Lamplighter and the Mayor alive on the final day with no execution, good wins', () => {
		// Wiki (Mayor): "If only 3 players live & no execution occurs, your team wins."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('mayor', 'Good wins on a quiet final day with both alive.', {
						endsGame: { kind: 'day-without-execution', winner: 'good', when: ['final-day'] }
					})
				]
			}),
			'mayor',
			'imp',
			'empath',
			'poisoner'
		]);
		const cast = castWith({ script });
		const players = ['lamplighter', 'mayor', 'imp', 'empath', 'poisoner'];
		const dies =
			(i: number) =>
			(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });
		const jinxEnd = (game: Game, characters: CharacterLookup) =>
			gameEnds(game, characters, { dayEnded: true })
				.filter((e) => e.jinxedWith === 'mayor')
				.map((e) => [e.rule, e.winner, e.day]);
		const final = cast(players, dies(3), dies(4), { type: 'NewDay' });
		expect(jinxEnd(final.game, final.ctx.characters)).toEqual([
			['day-without-execution', 'good', 1]
		]);
		// Five alive: not the final day, so no day is guessed.
		const early = cast(players, { type: 'NewDay' });
		expect(jinxEnd(early.game, early.ctx.characters)).toEqual([]);
	});

	it('N1: while the Lamplighter is dead, the Empath is poisoned', () => {
		// Wiki (Empath): "Each night, wake the Empath."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('empath', 'A dead Lamplighter poisons the Empath.', {
						impairs: { who: 'partner', kind: 'poisoned', when: ['self-dead'] }
					})
				]
			}),
			'empath',
			'imp',
			'chef',
			'poisoner'
		]);
		const { session, ctx, seats } = castWith({ script })([
			'empath',
			'lamplighter',
			'imp',
			'chef',
			'poisoner'
		]);
		expect(abilityState(session.game, seats[0], ctx.characters).works).toBe(true);
		const dead = run(session, ctx, { type: 'SetDead', seatId: seats[1], dead: true });
		const state = abilityState(dead.game, seats[0], ctx.characters);
		expect(state.impairments.map((i) => [i.reason, i.source.characterId])).toEqual([
			['poisoned', 'lamplighter']
		]);
	});

	it('N2: while the Gloom is in play, the Lamplighter registers as evil to the Empath', () => {
		// Wiki (Empath): "The Empath only learns how many of their neighbours are evil, not which one is evil."
		const entries = [
			lamplighter({
				jinxes: [
					jinx('empath', 'With the Gloom about, the Lamplighter seems evil.', {
						registersTo: { alignments: ['evil'], always: true, when: [{ inPlay: 'gloom' }] }
					})
				]
			}),
			gloom(),
			'empath',
			'imp',
			'chef',
			'poisoner'
		];
		const cast = castWith({ script: clean(entries).script });
		const lamp = (demon: string) => {
			const { game, ctx, seats } = cast(['empath', 'lamplighter', demon, 'chef', 'poisoner']);
			return registrations(game, ctx.characters, 'empath').find((r) => r.seatId === seats[1]);
		};
		expect(lamp('gloom')?.alignments).toEqual(['evil']);
		expect(lamp('imp')).toBeUndefined();
	});

	it('N3: if the Lamplighter nominates the Gloom and the Gloom is executed, good wins', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('gloom', 'Good wins if the Lamplighter puts the Gloom to death.', {
						endsGame: { kind: 'nominated-marked-executed', winner: 'good' }
					})
				]
			}),
			gloom(),
			'empath',
			'chef',
			'poisoner'
		]);
		const { game, ctx, seats } = castWith({ script })(
			['lamplighter', 'gloom', 'empath', 'chef', 'poisoner'],
			{ type: 'NewDay' },
			(s) => ({ type: 'Nominate', nominator: s[0], nominee: s[1] }),
			(s) => ({ type: 'Execute', seatId: s[1] })
		);
		expect(
			gameEnds(game, ctx.characters)
				.filter((e) => e.jinxedWith === 'gloom')
				.map((e) => [e.rule, e.winner, e.seats])
		).toEqual([['nominated-marked-executed', 'good', [seats[1], seats[0]]]]);
	});

	it('N4: on the first night, while the Gloom is alive, the Lamplighter is drunk', () => {
		// Wiki (Djinn): "If there are jinxed characters on the character sheet, even if there are no jinxed characters in play, the Storyteller tells all players what the Djinn’s special rule is at the start of the game."
		const { script } = clean([
			lamplighter({
				jinxes: [
					jinx('gloom', 'The Lamplighter is drunk on the first night.', {
						impairs: { kind: 'drunk', when: [{ night: 1 }, 'partner-alive'] }
					})
				]
			}),
			gloom(),
			'empath',
			'chef',
			'poisoner'
		]);
		const cast = castWith({ script });
		const players = ['lamplighter', 'gloom', 'empath', 'chef', 'poisoner'];
		const works = (g: CastGame) => abilityState(g.game, g.seats[0], g.ctx.characters).works;
		expect(works(cast(players))).toBe(false);
		expect(works(cast(players, { type: 'NewDay' }))).toBe(true);
		expect(works(cast(players, (s) => ({ type: 'SetDead', seatId: s[1], dead: true })))).toBe(true);
	});

	// N5, "The Gloom cannot kill the Lamplighter", is out of scope for M44: no jinx verb protects
	// one player from one character's kill. `cannotChoose` with `who: "partner"` is the nearest
	// (the Gloom must choose someone else), which is a different rule; a jinx protection belongs
	// with the protection rules (`rules/protection.ts`), a later stage.

	it('warns at load when a condition names a character not on the script', () => {
		// Wiki (Djinn): "If there are multiple pairs of jinxed characters on the character sheet, the players learn all the Djinn’s special rules."
		const { warnings, script } = load([
			lamplighter({
				jinxes: [
					jinx('empath', 'With the Baron about, the Empath is drunk.', {
						impairs: { who: 'partner', kind: 'drunk', when: [{ inPlay: 'baron' }] }
					})
				]
			}),
			'empath',
			'imp'
		]);
		expect(warnings.map((w) => w.message)).toEqual([expect.stringContaining('not on the script')]);
		expect(script.jinxes?.[0].rules).toBeDefined();
	});
});
