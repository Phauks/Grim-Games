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
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { abilityState, registrations } from './ability.ts';
import { earlyOnly } from './becomes.ts';
import { keepsAbilityWhenDead } from './dead-characters.ts';
import { demonInfo } from './evil-info.ts';
import { gameEnds } from './game-end.ts';
import { evilInfoNotesLeftOut } from './holder-jinxes.ts';
import { gainedEnd, madAsPartners, notShownGiven, survivesCarrierBy } from './jinx-effects.ts';
import { jinxStoppers } from './jinx-ends.ts';
import { answerCauses, nightAnswer, reliability } from './night-info.ts';
import { nominationsPerDay } from './nominations.ts';
import { jinxSafeFrom, protection } from './protection.ts';
import { uncountedVote, voteWorth } from './vote-weights.ts';
import { rulesInPlay } from './rules-in-play.ts';
import { madAsChoice } from './mad-as.ts';
import { nightStepAlerts, type NightAlert } from './night-alerts.ts';
import { nightKill } from './night-kill.ts';
import { reminderTargetMisses } from './reminder-targets.ts';
import { wakeConditionMet } from './wakes-when.ts';
import {
	barredAbilities,
	createdTooLate,
	givenInstead,
	isExclusiveJinx,
	jinxForbidsBecoming,
	neighbourBecoming,
	ownJinxRules,
	rulesForJinx,
	scriptJinxes,
	storytellerGains
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

	// M61b: the verb `impairs` is a preset of a patch of the part `impairs`.
	it('does the same when the jinx says it as a patch of the part `impairs`', () => {
		const patch = {
			patch: {
				who: 'partner',
				when: ['self-in-play'],
				parts: { impairs: { self: { reason: 'drunk' } } }
			}
		};
		const { script, warnings } = load(entries(patch));
		expect(warnings).toEqual([]);
		const cast = castWith({ script });
		const { game, ctx, seats } = cast(['chef', 'monk', 'imp', 'empath', 'poisoner']);
		const state = abilityState(game, seats[0], ctx.characters);
		expect(state.works).toBe(false);
		expect(state.impairments.map((i) => [i.reason, i.source])).toEqual([
			['drunk', { characterId: 'monk', seatId: seats[1] }]
		]);
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

	it('H11b: the same end written as a condition: the Saint executed after the Lamplighter nominated', () => {
		// Wiki (Saint): "If the Saint dies by execution, the game ends."
		const entries = [
			lamplighter({
				jinxes: [
					jinx('saint', 'If the Lamplighter nominates and executes the Saint, good wins.', {
						endsGame: {
							kind: 'condition',
							event: 'executed',
							subject: 'partner',
							nominatedBySelf: true,
							winner: 'good'
						}
					})
				]
			}),
			'saint',
			'imp',
			'empath',
			'poisoner'
		];
		const players = ['lamplighter', 'saint', 'imp', 'empath', 'poisoner'];
		const cast = castWith({ script: clean(entries).script });
		const ends = (game: Game, characters: CharacterLookup) =>
			gameEnds(game, characters)
				.filter((e) => e.jinxedWith === 'saint')
				.map((e) => [e.rule, e.winner, e.seats]);
		const nominated = cast(
			players,
			{ type: 'NewDay' },
			(s) => ({ type: 'Nominate', nominator: s[0], nominee: s[1] }),
			(s) => ({ type: 'Execute', seatId: s[1] })
		);
		expect(ends(nominated.game, nominated.ctx.characters)).toEqual([
			['jinx-executed', 'good', [nominated.seats[1], nominated.seats[0]]]
		]);
		const other = cast(
			players,
			{ type: 'NewDay' },
			(s) => ({ type: 'Nominate', nominator: s[3], nominee: s[1] }),
			(s) => ({ type: 'Execute', seatId: s[1] })
		);
		expect(ends(other.game, other.ctx.characters)).toEqual([]);
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

	// N5, "The Gloom cannot kill the Lamplighter", needed a jinx protection: it is M46's
	// `protects`, tested in stage 5 below.

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

/**
 * Stage 5 (M46): the general shapes that replaced the jinx values written for one official
 * pair, and the jinx protection (N5). Each test reuses a shape for another pair, as a script's
 * own jinx, and checks it through what the app does with it. The Lamplighter, the Gloom and
 * the other characters with no wiki page are invented for these tests.
 */
describe('homebrew sentences, stage 5 (M46)', () => {
	const jinx = (id: string, reason: string, rules: Json) => ({ id, reason, rules });
	const clean = (entries: unknown[]) => {
		const loaded = load(entries);
		expect(loaded.warnings).toEqual([]);
		return loaded;
	};
	const play = (entries: unknown[], players: string[]) =>
		scenario(players, { script: clean(entries).script });
	const gloom = (extra: Json = {}) => ({
		id: 'gloom',
		name: 'Gloom',
		team: 'demon',
		ability: 'Each night*, choose a player: they die.',
		rules: { kills: { by: 'demon' } },
		...extra
	});
	const minion = (id: string, name: string, extra: Json = {}) => ({
		id,
		name,
		team: 'minion',
		ability: 'Each night, choose a player: they feel uneasy.',
		...extra
	});
	const kinds = (alerts: NightAlert[], kind: NightAlert['kind']) =>
		alerts.filter((a) => a.kind === kind);
	/** Seat 0 is the good Alchemist, shown `minion`'s token. */
	const alchemistAs = (entries: unknown[], players: string[]) =>
		play(entries, players)
			.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'good' }))
			.reminder(0, 'alchemist', 'Is The Alchemist');

	describe('N5: the Gloom cannot kill the Lamplighter (protects)', () => {
		const entries = (when?: Json[]) => [
			lamplighter(),
			gloom({
				jinxes: [
					jinx('lamplighter', 'The Gloom cannot kill the Lamplighter.', {
						protects: { who: 'partner', by: 'partner', ...(when ? { when } : {}) }
					})
				]
			}),
			'imp',
			'empath',
			'chef',
			'poisoner',
			'monk'
		];
		const players = ['lamplighter', 'gloom', 'empath', 'chef', 'poisoner'];
		const safe = (s: Scenario, killer: string, on = 'lamplighter') =>
			protection(s.game, s.seat(on), s.characters, 'demon', killer);

		it("keeps the Gloom's kill off the Lamplighter, and only the Gloom's", () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const s = play(entries(), players);
			expect(safe(s, 'gloom')).toEqual({ characterId: 'lamplighter' });
			expect(safe(s, 'imp')).toBeUndefined();
			expect(safe(s, 'gloom', 'empath')).toBeUndefined();
			expect(
				kinds(nightStepAlerts(s.newDay().game, 'gloom', s.characters), 'protected').map((a) => [
					a.seatId,
					a.source
				])
			).toEqual([[s.seat('lamplighter'), { characterId: 'lamplighter' }]]);
		});

		it("holds whatever the Lamplighter's ability: a jinx is a rule", () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const s = play(entries(), players).poisoned('lamplighter');
			expect(safe(s, 'gloom')).toEqual({ characterId: 'lamplighter' });
		});

		it('holds even when the Gloom’s kill ignores protection', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const fierce = [
				lamplighter(),
				gloom({
					rules: { kills: { by: 'demon', ignoresProtection: true } },
					jinxes: [
						jinx('lamplighter', 'The Gloom cannot kill the Lamplighter.', {
							protects: { who: 'partner', by: 'partner' }
						})
					]
				}),
				'empath',
				'chef',
				'poisoner'
			];
			const s = play(fierce, players).newDay();
			expect(
				kinds(nightStepAlerts(s.game, 'gloom', s.characters), 'protected').map((a) => [
					a.seatId,
					a.source
				])
			).toEqual([[s.seat('lamplighter'), { characterId: 'lamplighter' }]]);
			expect(jinxSafeFrom(s.game, s.seat('lamplighter'), s.characters, 'demon', 'gloom')).toEqual({
				characterId: 'lamplighter'
			});
			expect(
				jinxSafeFrom(s.game, s.seat('empath'), s.characters, 'demon', 'gloom')
			).toBeUndefined();
		});

		it('holds only while its condition does', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const withChef = play(entries([{ inPlay: 'chef' }]), players);
			expect(safe(withChef, 'gloom')).toEqual({ characterId: 'lamplighter' });
			const without = play(entries([{ inPlay: 'chef' }]), [
				'lamplighter',
				'gloom',
				'empath',
				'monk',
				'poisoner'
			]);
			expect(safe(without, 'gloom')).toBeUndefined();
		});
	});

	it('abnormalCounts self-caused: the Abacus counts the Drunk’s own false info', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const abacus = (jinxes: Json[]) => ({
			id: 'abacus',
			name: 'Abacus',
			team: 'townsfolk',
			ability: 'Each night*, learn how many abilities misfired today.',
			reminders: ['Abnormal'],
			rules: {
				answers: { question: 'abnormal-abilities', token: 'Abnormal' },
				reminderTargets: { Abnormal: { seat: 'any', note: 'A player whose ability misfired.' } }
			},
			jinxes
		});
		const count = (jinxes: Json[]) => {
			const s = play(
				[abacus(jinxes), 'drunk', 'chef', 'imp', 'empath', 'monk'],
				['abacus', 'chef', 'imp', 'empath', 'monk']
			)
				.drunk('chef')
				.newDay()
				.do((at) => ({
					type: 'RecordNightInfo',
					seatId: at.seat('chef'),
					characterId: 'chef',
					text: 'Shown 2',
					abnormal: answerCauses(reliability(at.game, at.seat('chef'), 'chef', at.characters))
				}));
			return nightAnswer(s.game, s.seat('abacus'), 'abacus', s.characters);
		};
		const counts = jinx('drunk', 'The Abacus counts the Drunk.', {
			abnormalCounts: { counts: 'self-caused' }
		});
		expect(count([counts])).toMatchObject({ kind: 'number', value: 1 });
		expect(count([])).toMatchObject({ kind: 'number', value: 0 });
	});

	describe('endsGame night-instead: the executed Gloom’s night decides instead of an extra day', () => {
		const entries = (rules?: Json) => [
			official('mastermind', rules ? [jinx('gloom', 'The executed Gloom chooses.', rules)] : []),
			gloom(),
			'chef',
			'empath',
			'monk',
			'soldier'
		];
		const players = ['gloom', 'mastermind', 'chef', 'empath', 'monk', 'soldier'];
		const holds = (rules?: Json) => {
			const s = play(entries(rules), players).execute('gloom');
			return gameEnds(s.game, s.characters).find((e) => e.rule === 'demon-dead')?.holds;
		};

		it('is a night hold, its chooser the Gloom or the Mastermind', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const night = (chooser: string) => ({ endsGame: { kind: 'night-instead', chooser } });
			expect(holds(night('partner'))).toMatchObject([{ rule: 'jinx-night', characterId: 'gloom' }]);
			expect(holds(night('self'))).toMatchObject([
				{ rule: 'jinx-night', characterId: 'mastermind' }
			]);
			expect(holds()).toMatchObject([{ rule: 'extra-day', characterId: 'mastermind' }]);
		});
	});

	it('endsGame ability-stopped: the Lamplighter may stop the Gloom; one Gloom alive, good wins', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			gloom({
				jinxes: [
					jinx('lamplighter', 'The Lamplighter may stop the Gloom.', {
						endsGame: { kind: 'ability-stopped', winner: 'good', alive: 1 }
					})
				]
			}),
			lamplighter(),
			'chef',
			'empath',
			'poisoner'
		];
		const s = play(entries, ['gloom', 'lamplighter', 'chef', 'empath', 'poisoner']).newDay();
		expect(jinxStoppers(s.game, 'gloom', s.characters)).toEqual([
			{ partner: 'lamplighter', seatId: s.seat('lamplighter'), stopped: false }
		]);
		const stopped = s.do((at) => ({
			type: 'UseAbility',
			seatId: at.seat('lamplighter'),
			characterId: 'lamplighter',
			stops: 'gloom'
		}));
		expect(
			gameEnds(stopped.game, stopped.characters)
				.filter((e) => e.jinxedWith === 'lamplighter')
				.map((e) => [e.rule, e.winner])
		).toEqual([['partner-stops', 'good']]);
		// A dead Gloom has no ability left to stop.
		expect(jinxStoppers(s.dies('gloom').game, 'gloom', s.characters)).toEqual([]);
	});

	describe('an Alchemist with a Minion ability other than the official pairs', () => {
		const tinker = minion('tinker', 'Tinker', {
			rules: { givesAbility: { to: 'demon', types: ['outsider'] } }
		});
		const entries = [
			official('alchemist', [
				jinx('poisoner', 'An Alchemist-Poisoner gets no bluffs; dying, evil wins.', {
					endsGame: { kind: 'gained-end', end: 'dead-without-demon', winner: 'evil' },
					notShown: { what: 'bluffs' }
				}),
				jinx('tinker', 'An Alchemist-Tinker does not learn the ability given.', {
					notShown: { what: 'given-ability' }
				})
			]),
			tinker,
			'poisoner',
			'chef',
			'empath',
			'monk',
			'imp'
		];
		const others = ['chef', 'empath', 'monk', 'imp'];

		it('endsGame gained-end: the Alchemist-Poisoner has the dead-without-demon end for evil', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const s = alchemistAs(entries, ['poisoner', ...others]);
			expect(gainedEnd(s.game, s.seat(0), s.characters)).toEqual({
				partner: 'poisoner',
				winner: 'evil'
			});
			const real = play(entries, ['poisoner', ...others]);
			expect(gainedEnd(real.game, real.seat(0), real.characters)).toBeUndefined();
		});

		it('notShown bluffs: the Alchemist-Poisoner is left out of the bluffs', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const s = alchemistAs(entries, ['poisoner', ...others]);
			expect(evilInfoNotesLeftOut(s.game, s.characters)).toContain('poisoner');
			const real = play(entries, ['poisoner', ...others]);
			expect(evilInfoNotesLeftOut(real.game, real.characters)).not.toContain('poisoner');
		});

		it('notShown given-ability: the Alchemist-Tinker is not shown the ability given', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const s = alchemistAs(entries, ['tinker', ...others]);
			expect(notShownGiven(s.game, s.characters)).toEqual([
				{ seatId: s.seat(0), owner: 'alchemist', partner: 'tinker' }
			]);
			const real = play(entries, ['tinker', ...others]);
			expect(notShownGiven(real.game, real.characters)).toEqual([]);
		});
	});

	it('notShown partner-seat: while the Lamplighter lives, the Demon is not shown the Marionette', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			lamplighter({
				jinxes: [
					jinx('marionette', 'The Demon does not learn which neighbour is the Marionette.', {
						notShown: { what: 'partner-seat', when: ['self-alive'] }
					})
				]
			}),
			'marionette',
			'chef',
			'imp',
			'empath',
			'monk'
		];
		// Seat 0 the Marionette (as the Chef), seat 1 the Imp.
		const s = play(entries, ['chef', 'imp', 'lamplighter', 'empath', 'monk'])
			.do((at) => ({ type: 'SetAlignment', seatId: at.seat(0), alignment: 'evil' }))
			.reminder(0, 'marionette', 'Is The Marionette');
		expect(demonInfo(s.game, s.characters).neighbourHidden).toEqual({
			seats: [s.seat(0)],
			partner: 'marionette',
			hiddenBy: 'lamplighter'
		});
		const dead = s.dies('lamplighter');
		expect(demonInfo(dead.game, dead.characters).neighbourHidden).toBeUndefined();
	});

	describe('storytellerChooses own-execution: the riot with the Sceptic', () => {
		const sceptic = {
			id: 'sceptic',
			name: 'Sceptic',
			team: 'townsfolk',
			ability: 'The Storyteller may bend any rule; putting them to death wins it for good.',
			rules: {
				gameEnd: { ends: [{ kind: 'storyteller-executed', winner: 'good' }] }
			}
		};
		const entries = (jinxes: Json[]) => [
			official('riot', jinxes),
			sceptic,
			'chef',
			'empath',
			'monk',
			'soldier'
		];
		const nominated = (jinxes: Json[]) => {
			const s = play(entries(jinxes), ['chef', 'riot', 'riot', 'empath', 'monk', 'soldier'])
				.newDay()
				.newDay()
				.reminder(1, 'riot', 'Day 3')
				.do((at) => ({ type: 'NominateStoryteller', nominator: at.seat('chef') }));
			return nominationsPerDay(s.game, s.seat('chef'), s.characters);
		};

		it('lets the nominator nominate again when the Storyteller is not executed', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const vote = jinx('sceptic', 'During the riot, a nominated Storyteller is voted on.', {
				storytellerChooses: { what: 'own-execution' }
			});
			expect(nominated([vote])).toBe(2);
			expect(nominated([])).toBe(1);
		});

		it('needs the jinx partner to be the one that lets the Storyteller be executed (M58)', () => {
			// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
			const vote = jinx('chef', 'During the riot, a nominated Storyteller is voted on.', {
				storytellerChooses: { what: 'own-execution' }
			});
			expect(nominated([vote])).toBe(1);
		});
	});

	it('storytellerHas changed: when the Tinkerer changes the living Poisoner, the Storyteller has it', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const tinkerer = {
			id: 'tinkerer',
			name: 'Tinkerer',
			team: 'townsfolk',
			ability: 'Once per game, at night, swap an evil player for another evil character.',
			reminders: ['No Ability'],
			rules: {
				changesCharacter: { types: ['minion', 'demon'], sameType: true, spent: 'No Ability' }
			},
			jinxes: [
				jinx('poisoner', 'The Storyteller has the Poisoner ability the Tinkerer removes.', {
					storytellerHas: { who: 'partner', once: 'changed' }
				})
			]
		};
		const s = play(
			[tinkerer, 'poisoner', 'chef', 'empath', 'imp'],
			['tinkerer', 'poisoner', 'chef', 'empath', 'imp']
		);
		expect(storytellerGains(s.game, s.seat('poisoner'), 'tinkerer', s.characters)).toBe('poisoner');
		expect(storytellerGains(s.game, s.seat('chef'), 'tinkerer', s.characters)).toBeUndefined();
		const dead = s.dies('poisoner');
		expect(
			storytellerGains(dead.game, dead.seat('poisoner'), 'tinkerer', dead.characters)
		).toBeUndefined();
	});

	it('storytellerChooses via carrierIsDemon: while the Lamplighter lives, the Storyteller picks the babysitter', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			official('lilmonsta', [
				jinx('lamplighter', 'While the Lamplighter lives, the Storyteller picks the babysitter.', {
					storytellerChooses: { what: 'player', via: 'carrierIsDemon', when: ['partner-alive'] }
				})
			]),
			lamplighter(),
			'poisoner',
			'widow',
			'chef',
			'empath'
		];
		const s = play(entries, ['lamplighter', 'poisoner', 'widow', 'chef', 'empath']);
		const chooses = (at: Scenario) =>
			kinds(nightStepAlerts(at.game, 'lilmonsta', at.characters), 'storyteller-chooses');
		expect(chooses(s)).toEqual([
			expect.objectContaining({
				seatId: s.seat('lamplighter'),
				partner: 'lamplighter',
				carrier: true
			})
		]);
		expect(chooses(s.dies('lamplighter'))).toEqual([]);
	});

	it('wakes one-by-one: while the Lamplighter lives, Legion wake one at a time', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			official('legion', [
				jinx('lamplighter', 'While the Lamplighter lives, Legion wake one at a time.', {
					wakes: { how: 'one-by-one', when: ['partner-alive'] }
				})
			]),
			lamplighter(),
			'chef',
			'empath'
		];
		const s = play(entries, ['legion', 'legion', 'legion', 'lamplighter', 'chef', 'empath']);
		const oneByOne = (at: Scenario) =>
			kinds(nightStepAlerts(at.game, 'legion', at.characters), 'wakes-one-by-one');
		const [alert] = oneByOne(s);
		expect(alert).toMatchObject({
			seatId: s.seat('lamplighter'),
			source: { characterId: 'legion' },
			partner: 'lamplighter'
		});
		// No token to carry: the alert is not a babysitter's.
		expect(alert.carrier).toBeUndefined();
		expect(oneByOne(s.dies('lamplighter'))).toEqual([]);
	});

	it('changesCharacter token: the Summoner may summon the Gloom on Night 2', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			official('summoner', [
				jinx('gloom', 'The Summoner may summon the Gloom a night early.', {
					changesCharacter: { token: 'Night 2' }
				})
			]),
			gloom(),
			'chef',
			'empath',
			'monk',
			'poisoner'
		];
		const s = play(entries, ['summoner', 'chef', 'empath', 'monk', 'poisoner']);
		const early = (at: Scenario) => earlyOnly(at.game, 'summoner', at.characters);
		expect(early(s.reminder('summoner', 'summoner', 'Night 2'))).toEqual(['gloom']);
		expect(early(s.reminder('summoner', 'summoner', 'Night 3'))).toBeUndefined();
	});

	it('givenInstead becomes: a type up to a count, or the Demon’s good neighbour', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const { script, characters } = clean([
			official('plaguedoctor', [
				jinx('hexer', 'Up to three players become Townsfolk instead.', {
					givenInstead: { instead: 'becomes', type: 'townsfolk', upTo: 3 }
				}),
				jinx('witch', 'One of the Demon’s good neighbours becomes the Witch instead.', {
					givenInstead: { instead: 'becomes', where: 'demon-good-neighbour' }
				}),
				jinx('poisoner', 'A Minion gains the Poisoner ability instead.', {
					givenInstead: 'a-minion'
				})
			]),
			minion('hexer', 'Hexer'),
			'witch',
			'poisoner',
			'chef',
			'imp'
		]);
		expect(givenInstead('plaguedoctor', 'hexer', script, characters)).toEqual({
			instead: 'becomes',
			type: 'townsfolk',
			upTo: 3
		});
		expect(givenInstead('plaguedoctor', 'witch', script, characters)).toEqual({
			instead: 'becomes',
			where: 'demon-good-neighbour'
		});
		expect(givenInstead('plaguedoctor', 'poisoner', script, characters)).toEqual({
			instead: 'a-minion'
		});
		expect(givenInstead('plaguedoctor', 'chef', script, characters)).toBeUndefined();
	});

	it('alsoBecomes neighbour: a summoned Gloom neighbours an Outsider, and the other neighbour becomes one', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			official('summoner', [
				jinx('gloom', 'A summoned Gloom sits by an Outsider; its other neighbour becomes one.', {
					alsoBecomes: { type: 'outsider', players: 'neighbours' }
				})
			]),
			gloom(),
			'poisoner',
			'chef',
			'empath',
			'saint',
			'monk'
		];
		// Seated in a circle: the Summoner, Poisoner, Chef, Empath, Saint and Monk.
		const s = play(entries, ['summoner', 'poisoner', 'chef', 'empath', 'saint', 'monk']);
		const near = (seat: string) =>
			neighbourBecoming(s.game, 'summoner', 'gloom', s.seat(seat), s.characters);
		expect(near('empath')).toEqual({ type: 'outsider', fits: true, becomes: s.seat('chef') });
		expect(near('poisoner')).toEqual({ type: 'outsider', fits: false });
		expect(neighbourBecoming(s.game, 'summoner', 'imp', s.seat('empath'), s.characters)).toBe(
			undefined
		);
	});

	it('learns good-players: with the Lamplighter in play, the Gloom learns the good players but it', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			gloom({
				jinxes: [
					jinx('lamplighter', 'The Gloom learns who is good, but not the Lamplighter.', {
						learns: { what: 'good-players', when: ['partner-in-play'] }
					})
				]
			}),
			lamplighter(),
			'chef',
			'empath',
			'poisoner',
			'monk'
		];
		const s = play(entries, ['gloom', 'poisoner', 'lamplighter', 'chef', 'empath']);
		expect(demonInfo(s.game, s.characters).goodShown).toEqual({
			seats: [s.seat('chef'), s.seat('empath')],
			hiddenBy: 'lamplighter'
		});
		const without = play(entries, ['gloom', 'poisoner', 'monk', 'chef', 'empath']);
		expect(demonInfo(without.game, without.characters).goodShown).toBeUndefined();
	});

	it('noKill killer demon: after the Lamplighter nominates the executed Chef, the Demon does not kill', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			lamplighter({
				jinxes: [
					jinx('chef', 'If the Lamplighter puts the Chef to death, the Demon rests tonight.', {
						noKill: {
							killer: 'demon',
							when: ['nominated-partner', 'partner-executed', 'partner-dead']
						}
					})
				]
			}),
			'chef',
			'imp',
			'empath',
			'monk'
		];
		const s = play(entries, ['imp', 'lamplighter', 'chef', 'empath', 'monk']);
		const noKill = (at: Scenario) =>
			kinds(nightStepAlerts(at.game, 'imp', at.characters), 'no-kill').map((a) => [
				a.seatId,
				a.source
			]);
		const executed = s.nominate('lamplighter', 'chef').execute('chef');
		expect(noKill(executed)).toEqual([
			[s.seat('imp'), { characterId: 'lamplighter', seatId: s.seat('lamplighter') }]
		]);
		expect(noKill(s.nominate('empath', 'chef').execute('chef'))).toEqual([]);
	});

	it('voter countsOnlyWith: the Valet’s vote counts only with their master’s, in eyes-closed voting', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const valet = (jinxes: Json[]) => ({
			id: 'valet',
			name: 'Valet',
			team: 'outsider',
			ability: 'Each night, choose a player to serve: you vote only when they vote.',
			reminders: ['Master'],
			rules: {
				voter: { onlyWith: 'Master' },
				reminderTargets: { Master: { seat: 'other', note: 'The player the Valet serves.' } }
			},
			jinxes
		});
		const uncounted = (jinxes: Json[]) => {
			const s = play(
				[valet(jinxes), 'organgrinder', 'chef', 'empath', 'monk', 'imp'],
				['valet', 'organgrinder', 'chef', 'empath', 'monk', 'imp']
			)
				.reminder('monk', 'valet', 'Master')
				.nominate('chef', 'imp');
			return uncountedVote(s.game, 'valet', s.characters);
		};
		const counts = jinx(
			'organgrinder',
			'In eyes-closed voting the Valet’s vote counts only with their master’s.',
			{
				voter: { countsOnlyWith: true }
			}
		);
		expect(uncounted([counts])).toBe('organgrinder');
		expect(uncounted([])).toBeUndefined();
	});

	it('survives carrier-executed: while the Lamplighter lives, the Lleech outlives its executed host', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = [
			official('lleech', [
				jinx(
					'lamplighter',
					'With the Lamplighter alive, the Lleech lives on when its host is executed.',
					{
						survives: { on: 'carrier-executed', when: ['partner-alive'] }
					}
				)
			]),
			lamplighter(),
			'chef',
			'empath',
			'monk'
		];
		const s = play(entries, ['lleech', 'lamplighter', 'chef', 'empath', 'monk']).reminder(
			'chef',
			'lleech',
			'Poisoned'
		);
		const survives = (at: Scenario) => survivesCarrierBy(at.game, at.seat('lleech'), at.characters);
		expect(survives(s.execute('chef'))).toBe('lamplighter');
		expect(survives(s.dies('chef', 'lleech'))).toBeUndefined();
		expect(survives(s.dies('lamplighter').execute('chef'))).toBeUndefined();
	});

	it('keepsAbility afterDeath: a Poisoner the Vigormortis killed keeps it after the Vigormortis dies', () => {
		// Wiki (Djinn): "There are many different Djinn special rules. Each is tailored to a specific pair of jinxed characters."
		const entries = (jinxes: Json[]) => [
			official('vigormortis', jinxes),
			'poisoner',
			'chef',
			'empath',
			'monk'
		];
		const keeps = (jinxes: Json[]) => {
			const s = play(entries(jinxes), ['vigormortis', 'poisoner', 'chef', 'empath', 'monk'])
				.dies('poisoner', 'vigormortis')
				.reminder('poisoner', 'vigormortis', 'Has Ability')
				.execute('vigormortis');
			return keepsAbilityWhenDead(s.game, s.seat('poisoner'), s.characters);
		};
		const kept = jinx(
			'poisoner',
			'A Poisoner with their ability keeps it if the Vigormortis dies.',
			{
				keepsAbility: { who: 'partner', afterDeath: true }
			}
		);
		expect(keeps([kept])).toBe(true);
		expect(keeps([])).toBe(false);
	});
});

// M61: a jinx `patch` lays parts of a rules block over the character's own while it holds.
describe('a script jinx that patches its character’s rules', () => {
	const PATCH = {
		patch: {
			parts: { voteWeight: { self: true, weight: 2 } },
			when: ['partner-alive']
		}
	};
	const entries = (rules: Json = PATCH) => [
		lamplighter({
			jinxes: [{ id: 'imp', reason: 'While the Imp lives, the Lamplighter votes twice.', rules }]
		}),
		'imp',
		'chef',
		'empath',
		'poisoner'
	];

	it('counts the Lamplighter’s vote twice while the Imp lives, and once after', () => {
		const { script, warnings, characters } = load(entries());
		expect(warnings).toEqual([]);
		const cast = castWith({ script, characters });
		const { game, seats } = cast(['lamplighter', 'imp', 'chef', 'empath', 'poisoner']);
		expect(rulesInPlay(game, 'lamplighter', characters)?.voteWeight).toEqual({
			self: true,
			weight: 2
		});
		expect(voteWorth(game, seats[0], characters)).toBe(2);
		const after = cast(['lamplighter', 'imp', 'chef', 'empath', 'poisoner'], (s): Command => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true
		}));
		expect(voteWorth(after.game, after.seats[0], characters)).toBe(1);
	});

	it('rejects a patch part its reader rejects, or jinxes inside a patch', () => {
		const bad = load(entries({ patch: { parts: { voteWeight: { weight: 1 }, jinxes: {} } } }));
		expect(bad.warnings.map((w) => w.message).join(' ')).toMatch(/patch/);
	});
});

// M61c: the verb `madAsPartner` is a preset of a patch of the part `madAs`.
describe('a script jinx that patches the Cerenovus’s madAs', () => {
	const MAD_AS = { token: 'Mad', mad: 'carrier', choose: ['townsfolk', 'outsider'] };
	const entries = (rules: Json) => [
		official('cerenovus', [
			{ id: 'baron', reason: 'The Cerenovus may make a player mad as the Baron.', rules }
		]),
		'baron',
		'chef',
		'empath',
		'imp'
	];

	it('lets the Cerenovus choose the Baron, as the verb would', () => {
		const patch = { patch: { parts: { madAs: { ...MAD_AS, characters: ['baron'] } } } };
		for (const rules of [patch, { madAsPartner: true }]) {
			const { script, warnings, characters } = load(entries(rules));
			expect(warnings).toEqual([]);
			const cast = castWith({ script, characters });
			const { game } = cast(['cerenovus', 'chef', 'empath', 'imp']);
			expect(madAsPartners(game, 'cerenovus', characters)).toEqual(['baron']);
			expect(madAsChoice(game, 'cerenovus', characters)?.partners).toEqual(['baron']);
		}
	});
});

// M61d: `wakesWhen.deadAtLeast`, and the verb `deadAtLeast` as a preset of a patch of it.
describe('a custom character that wakes once enough players are dead', () => {
	const dies =
		(n: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[n], dead: true });
	const ids = ['lamplighter', 'chef', 'empath', 'imp', 'poisoner'];

	it('wakes once its own dead count is met', () => {
		const { script, warnings, characters } = load([
			lamplighter({ rules: { wakesWhen: { deadAtLeast: 2 } } }),
			'chef',
			'empath',
			'imp',
			'poisoner'
		]);
		expect(warnings).toEqual([]);
		const cast = castWith({ script, characters });
		const one = cast(ids, dies(1));
		expect(wakeConditionMet(one.game, 'lamplighter', one.seats[0], characters, new Set())).toBe(
			false
		);
		const two = cast(ids, dies(1), dies(2));
		expect(wakeConditionMet(two.game, 'lamplighter', two.seats[0], characters, new Set())).toBe(
			true
		);
	});

	it('wakes on one death while its jinx partner is in play, by patch or by the verb', () => {
		const own = { wakesWhen: { deadAtLeastLiving: true } };
		const patch = {
			patch: {
				when: ['partner-in-play'],
				parts: { wakesWhen: { deadAtLeastLiving: true, deadAtLeast: 1 } }
			}
		};
		const verb = { deadAtLeast: { dead: 1, when: ['partner-in-play'] } };
		for (const rules of [patch, verb]) {
			const { script, warnings, characters } = load([
				lamplighter({
					rules: own,
					jinxes: [
						{ id: 'imp', reason: 'With the Imp in play, one death wakes the Lamplighter.', rules }
					]
				}),
				'chef',
				'empath',
				'imp',
				'poisoner'
			]);
			expect(warnings).toEqual([]);
			const cast = castWith({ script, characters });
			const one = cast(ids, dies(1));
			expect(wakeConditionMet(one.game, 'lamplighter', one.seats[0], characters, new Set())).toBe(
				true
			);
			const noImp = cast(['lamplighter', 'chef', 'empath', 'poisoner', 'saint'], dies(1));
			expect(
				wakeConditionMet(noImp.game, 'lamplighter', noImp.seats[0], characters, new Set())
			).toBe(false);
		}
	});
});
