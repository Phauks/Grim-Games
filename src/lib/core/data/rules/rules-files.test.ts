import { readdirSync, readFileSync } from 'node:fs';
import { testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import { describe, expect, it } from 'vitest';
import { committedGameData, committedCharacters } from '#lib/core/testing/committed-data.ts';
import { parseCharacterRules } from '../character-rules.ts';
import { parseCharacter } from '../parse.ts';
import { Issues } from '../validate.ts';
import { actsWhenDead } from '#lib/core/rules/dead-characters.ts';
import { onDeathTrigger } from '#lib/core/rules/night-alerts.ts';
import { reminderPrompt } from '#lib/core/rules/reminder-prompts.ts';
import { OFFICIAL_RULES, rulesOf } from './index.ts';

const dir = new URL('./', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
const data = committedGameData();

describe('official rules files (data/rules/<id>.json)', () => {
	it('lists every file in the index', () => {
		expect([...OFFICIAL_RULES.keys()].sort()).toEqual(files.map((f) => f.slice(0, -5)).sort());
	});

	it.each(files)('%s is an official character and only names its own reminders', (file) => {
		const id = file.slice(0, -5);
		const character = data.byId.get(id);
		expect(character, id).toBeDefined();
		const issues = new Issues();
		const raw: unknown = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
		parseCharacterRules(raw, file, issues, [
			...character!.reminders,
			...character!.remindersGlobal
		]);
		expect(issues.list).toEqual([]);
	});

	// M59: each character's night position is TPI's sheet, written as "right after" the step
	// before it, so a copy of the character placed by its own rules wakes where the sheet says.
	it.each(['first', 'other'] as const)(
		'places each character as the %s night sheet does',
		(night) => {
			const list = data.nightSheet[night === 'first' ? 'firstNight' : 'otherNight'];
			for (const id of files.map((f) => f.slice(0, -5))) {
				const at = list.indexOf(id);
				const place = OFFICIAL_RULES.get(id)?.nightOrder?.[night];
				expect(place?.after, id).toBe(at > 0 ? list[at - 1] : undefined);
				expect(place === undefined || place.stage !== undefined, id).toBe(true);
			}
		}
	);
});

describe('parseCharacterRules', () => {
	const parse = (raw: unknown, reminders = ['Dead']) => {
		const issues = new Issues();
		return { rules: parseCharacterRules(raw, 'rules', issues, reminders), issues: issues.list };
	};

	it('reads what being nominated sets off, and rejects an unknown type or effect', () => {
		const onNominated = { by: 'townsfolk', effect: 'execute-nominator' };
		expect(parse({ onNominated }).rules).toEqual({ onNominated });
		expect(parse({ onNominated: { ...onNominated, by: 'player' } }).issues).toHaveLength(1);
		expect(parse({ onNominated: { ...onNominated, effect: 'swap' } }).issues).toHaveLength(1);
	});

	it('reads a night position, and rejects one with no stage or step to follow (M59)', () => {
		const nightOrder = { first: { after: 'dusk' }, other: { after: 'monk' } };
		expect(parse({ nightOrder }).rules).toEqual({ nightOrder });
		expect(parse({ nightOrder: {} }).issues).toHaveLength(1);
		expect(parse({ nightOrder: { first: { after: '' } } }).issues).toHaveLength(1);
		expect(parse({ nightOrder: { first: 'dusk' } }).issues).toHaveLength(1);
		expect(parse({ nightOrder: { other: { stage: 'impairs' } } }).issues).toEqual([]);
		// Team setup is a first-night stage only, and Dawn is a step, not a stage.
		expect(parse({ nightOrder: { other: { stage: 'team-setup' } } }).issues).toHaveLength(1);
		expect(parse({ nightOrder: { first: { stage: 'dawn' } } }).issues).toHaveLength(1);
	});

	// https://wiki.bloodontheclocktower.com/Witch, /Riot
	it('reads what nominating sets off, and which reminder lets nominees nominate', () => {
		const onNominating = { carrier: 'Dead', effect: 'kills-nominator' };
		expect(parse({ onNominating }).rules).toEqual({ onNominating });
		expect(parse({ onNominating: { ...onNominating, carrier: 'Cursed' } }).issues).toHaveLength(1);
		expect(parse({ onNominating: { effect: 'swap' } }).issues).toHaveLength(1);
		expect(parse({ nomineesNominate: 'Dead' }).rules).toEqual({ nomineesNominate: 'Dead' });
		expect(parse({ nomineesNominate: 'Day 3' }).issues).toHaveLength(1);
	});

	// https://wiki.bloodontheclocktower.com/Slayer (chooses a player), /Virgin (the nominator)
	it('reads who a day ability is used on, and rejects an unknown one', () => {
		expect(parse({ dayUse: { who: 'chosen' } }).rules).toEqual({ dayUse: { who: 'chosen' } });
		expect(parse({ dayUse: { who: 'neighbour' } }).issues).toEqual([
			'rules.dayUse.who: unknown value "neighbour"'
		]);
		expect(parse({ dayUse: 'chosen' }).issues).toHaveLength(1);
		const golem = { who: 'nominated', kills: true, spentToken: 'May Not Nominate' };
		expect(parse({ dayUse: golem }, ['May Not Nominate']).rules).toEqual({ dayUse: golem });
		expect(parse({ dayUse: golem }).issues).toEqual([
			'rules.dayUse.spentToken: not one of this character’s reminders'
		]);
		expect(parse({ dayUse: { who: 'chosen', kills: false } }).issues).toHaveLength(1);
	});

	// https://wiki.bloodontheclocktower.com/Flowergirl (two tokens show whether the Demon voted)
	it('reads a day mark with its two tokens, and rejects an unknown mark or token', () => {
		const dayMark = { mark: 'demon-voted', yes: 'Voted', no: 'Not Voted' };
		expect(parse({ dayMark }, ['Voted', 'Not Voted']).rules).toEqual({ dayMark });
		expect(
			parse({ dayMark: { ...dayMark, mark: 'slept' } }, ['Voted', 'Not Voted']).issues
		).toEqual(['rules.dayMark.mark: unknown value "slept"']);
		expect(parse({ dayMark }).issues).toEqual([
			'rules.dayMark.yes: not one of this character’s reminders',
			'rules.dayMark.no: not one of this character’s reminders'
		]);
		expect(parse({ dayMark: { ...dayMark, no: 'Voted' } }, ['Voted']).issues).toEqual([
			'rules.dayMark.no: the same token as yes'
		]);
	});

	it('reads what a player may still do once dead, and rejects a bad cause or count', () => {
		const afterDeath = { cause: ['demon'], nominations: 2, votes: 2 };
		expect(parse({ afterDeath }).rules).toEqual({ afterDeath });
		expect(parse({ afterDeath: { ...afterDeath, cause: [] } }).issues).toHaveLength(1);
		expect(parse({ afterDeath: { ...afterDeath, cause: 'demon' } }).issues).toHaveLength(1);
		expect(parse({ afterDeath: { ...afterDeath, votes: 0 } }).issues).toHaveLength(1);
		expect(parse({ afterDeath: { cause: ['demon'] } }).issues).toHaveLength(1);
		expect(parse({ afterDeath: { ...afterDeath, twice: true } }).issues).toHaveLength(1);
	});

	it('reads extra nominations after an execution, and rejects a count under 1', () => {
		expect(parse({ nominationsAfterExecution: 1 }).rules).toEqual({ nominationsAfterExecution: 1 });
		expect(parse({ nominationsAfterExecution: 0 }).issues).toHaveLength(1);
		expect(parse({ nominationsAfterExecution: 1.5 }).issues).toHaveLength(1);
	});

	it('reads a reminder prompt', () => {
		expect(parse({ reminderPrompts: { Dead: 'markDead' } })).toEqual({
			rules: { reminderPrompts: { Dead: 'markDead' } },
			issues: []
		});
	});

	it('reads the claim a player makes by day (L56)', () => {
		expect(parse({ dayClaim: 'guesses' })).toEqual({ rules: { dayClaim: 'guesses' }, issues: [] });
	});

	it('reports unknown rules, unknown prompts and reminders the character lacks', () => {
		expect(parse({ slays: true }).issues).toEqual(['rules.slays: unknown rule']);
		expect(parse({ onDeath: { by: 'night' } }).issues).toEqual([
			'rules.onDeath.by: unknown value "night"'
		]);
		expect(parse({ protects: { who: 'marked', from: 'demon' } }).issues).toEqual([
			'rules.protects.token: missing'
		]);
		expect(parse({ protects: { who: 'self', token: 'Dead', from: 'any' } }).issues).toEqual([
			'rules.protects.token: only a marked player has a token'
		]);
		expect(parse({ protects: { who: 'marked', token: 'Safe', from: 'any' } }).issues).toEqual([
			'rules.protects.token: not one of this character’s reminders'
		]);
		expect(parse({ redirectsKill: { from: 'other' } }).issues).toEqual([
			'rules.redirectsKill.from: unknown value "other"'
		]);
		expect(parse({ survivesFirstDeath: { spentToken: 'No Ability' } }).issues).toEqual([
			'rules.survivesFirstDeath.spentToken: not one of this character’s reminders'
		]);
		expect(parse({ survivesFirstDeath: {} }).issues).toEqual([
			'rules.survivesFirstDeath.spentToken: missing'
		]);
		expect(parse({ kills: { by: 'night' } }).issues).toEqual([
			'rules.kills.by: unknown value "night"'
		]);
		expect(parse({ kills: { by: 'other', targets: 'all' } }).issues).toEqual([
			'rules.kills.targets: unknown value "all"'
		]);
		expect(parse({ learns: { measure: 'pair-of-type' } }).issues).toEqual([
			'rules.learns.type: missing'
		]);
		expect(parse({ learns: { measure: 'demon-or-token' } }).issues).toEqual([
			'rules.learns.token: missing'
		]);
		expect(
			parse({ learns: { measure: 'evil-pairs', reminders: { each: 'Know' } } }).issues
		).toEqual(['rules.learns.reminders.each: not one of this character’s reminders']);
		expect(parse({ answers: { question: 'who-knows' } }).issues).toEqual([
			'rules.answers.question: unknown value "who-knows"'
		]);
		expect(parse({ impairs: { self: { reason: 'sleepy' } } }).issues).toEqual([
			'rules.impairs.self.reason: unknown value "sleepy"'
		]);
		expect(
			parse({ impairs: { tokens: { Hush: { reason: 'drunk', on: 'others' } } } }).issues
		).toEqual(['rules.impairs.tokens.Hush: not one of this character’s reminders']);
		expect(parse({ impairs: { tokens: { Dead: { reason: 'drunk', on: 'all' } } } }).issues).toEqual(
			['rules.impairs.tokens.Dead.on: unknown value "all"']
		);
		expect(parse({ registersAs: { self: { types: ['wizard'] } } }).issues).toEqual([
			'rules.registersAs.self.types: unknown value "wizard"'
		]);
		expect(parse({ registersAs: { tokens: { Paw: { alignments: ['evil'] } } } }).issues).toEqual([
			'rules.registersAs.tokens.Paw: not one of this character’s reminders'
		]);
		expect(parse({ gameEnd: { ends: [{ kind: 'win-now' }] } }).issues).toEqual([
			'rules.gameEnd.ends[0].kind: unknown value "win-now"'
		]);
		expect(parse({ gameEnd: { ends: [{ kind: 'survives-day', day: 5 }] } }).issues).toEqual([
			'rules.gameEnd.ends[0].winner: missing'
		]);
		expect(parse({ gameEnd: { ends: [{ kind: 'used-on-loses', on: 'wizard' }] } }).issues).toEqual([
			'rules.gameEnd.ends[0].on: unknown value "wizard"'
		]);
		expect(parse({ gameEnd: { holds: [{ kind: 'marked-alive', token: 'Twin' }] } }).issues).toEqual(
			['rules.gameEnd.holds[0].token: not one of this character’s reminders']
		);
		expect(parse({ deathCheck: { kind: 'explodes' } }).issues).toEqual([
			'rules.deathCheck.kind: unknown value "explodes"'
		]);
		expect(parse({ deathCheck: { kind: 'marked-killed-by-demon' } }).issues).toEqual([
			'rules.deathCheck.token: missing'
		]);
		expect(
			parse({ setupPrep: { reminders: [{ label: 'Dead', text: 'x', reason: 'y' }] } }).issues
		).toEqual(['rules.setupPrep.reminders[0].target: missing']);
		expect(
			parse({
				setupPrep: {
					reminders: [
						{ label: 'Lit', text: 'x', reason: 'y', target: { choose: 'all', choice: 'z' } }
					]
				}
			}).issues
		).toEqual([
			'rules.setupPrep.reminders[0].label: not one of this character’s reminders',
			'rules.setupPrep.reminders[0].target.choose: unknown value "all"'
		]);
		expect(
			parse({ setupModifier: { summary: '+1', ops: [{ kind: 'delta', type: 'traveller' }] } })
				.issues
		).toEqual(['rules.setupModifier.ops[0].type: unknown value "traveller"']);
		expect(
			parse({ setupModifier: { summary: '+1', ops: [{ kind: 'delta', type: 'outsider' }] } }).issues
		).toEqual(['rules.setupModifier.ops[0].values: expected a list of whole numbers']);
		expect(parse({ reminderTargets: { Dead: { differsFromLastNight: 'seat' } } }).issues).toEqual([
			'rules.reminderTargets.Dead.differsFromLastNight: unknown value "seat"'
		]);
		expect(parse({ dayClaim: 'shout' }).issues).toEqual(['rules.dayClaim: unknown value "shout"']);
		expect(parse({ actsWhenDead: 'yes' }).issues).toEqual([
			'rules.actsWhenDead: expected boolean, got string'
		]);
		expect(parse({ reminderPrompts: { Dead: 'explode' } }).issues).toEqual([
			'rules.reminderPrompts.Dead: unknown prompt "explode"'
		]);
		expect(parse({ reminderPrompts: { Alive: 'revive' } }).issues).toEqual([
			'rules.reminderPrompts.Alive: not one of this character’s reminders'
		]);
	});
});

describe('custom characters', () => {
	// A homebrew Demon whose kill reminder has its own words: its rules block makes placing
	// it ask to mark the player dead, as the Imp's "Dead" does
	// (https://wiki.bloodontheclocktower.com/Imp).
	const raw = {
		id: 'hollowking',
		name: 'Hollow King',
		team: 'demon',
		ability: 'Each night*, choose a player: they die.',
		reminders: ['Hollowed'],
		rules: { reminderPrompts: { Hollowed: 'markDead' } }
	};

	it('carry a rules block in their script entry, read by the same parser', () => {
		const issues = new Issues();
		const character = parseCharacter(raw, '[0]', issues, { strict: false, scriptFields: true });
		expect(issues.list).toEqual([]);
		expect(character?.rules).toEqual({ reminderPrompts: { Hollowed: 'markDead' } });
		const characters = new Map([[character!.id, character!]]);
		expect(rulesOf('hollowking', characters)).toBe(character!.rules);
		expect(reminderPrompt('Hollowed', 'hollowking', characters)).toBe('markDead');
		expect(reminderPrompt('Hollowed', undefined, committedCharacters())).toBeUndefined();
	});

	it('report a bad rules block like any other bad field', () => {
		const issues = new Issues();
		const bad = { ...raw, rules: { reminderPrompts: { Missing: 'markDead' } } };
		expect(parseCharacter(bad, '[0]', issues, { strict: false, scriptFields: true })).toBe(
			undefined
		);
		expect(issues.list).toEqual([
			'[0].rules.reminderPrompts.Missing: not one of this character’s reminders'
		]);
	});

	// One policy (M58): a custom character's text is its own, so it has only its own rules; an
	// official character carries our file from the moment game data loads.
	it('have only their own block when they reuse an official id', () => {
		expect(rulesOf('imp', new Map([['imp', {}]]))).toBeUndefined();
		expect(rulesOf('imp', new Map([['imp', { rules: { kills: { by: 'other' } } }]]))).toEqual({
			kills: { by: 'other' }
		});
		expect(rulesOf('imp', committedCharacters())).toMatchObject({ kills: { by: 'demon' } });
	});

	// A homebrew Outsider that acts on its death, as the Klutz does
	// (https://wiki.bloodontheclocktower.com/Klutz): its reminders stay in the bank's living
	// section once it dies.
	it('can act when dead', () => {
		const issues = new Issues();
		const lantern = parseCharacter(
			{
				id: 'lanternbearer',
				name: 'Lantern Bearer',
				team: 'outsider',
				ability: 'When you die, choose a player.',
				rules: { actsWhenDead: true }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		const characters = new Map([[lantern!.id, lantern!]]);
		expect(actsWhenDead('lanternbearer', characters)).toBe(true);
		expect(actsWhenDead('lanternbearer', committedCharacters())).toBe(false);
	});

	// A homebrew Townsfolk woken by a Demon kill, as the Sage is
	// (https://wiki.bloodontheclocktower.com/Sage).
	it('can be set off by their death', () => {
		const issues = new Issues();
		const watcher = parseCharacter(
			{
				id: 'lastwatch',
				name: 'Last Watch',
				team: 'townsfolk',
				ability: 'If the Demon kills you, you learn a player.',
				rules: { onDeath: { by: 'demon' } }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		expect(onDeathTrigger('lastwatch', new Map([[watcher!.id, watcher!]]))).toEqual({
			by: 'demon'
		});
		expect(onDeathTrigger('lastwatch', testCharacters)).toBeUndefined();
	});
});
