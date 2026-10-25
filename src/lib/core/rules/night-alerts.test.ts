/**
 * Night step reminders of game state. Each scenario paraphrases the wiki page it cites.
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	NIGHT_KILLERS,
	ON_DEATH,
	nightKiller,
	nightStepAlerts,
	type NightAlert
} from './night-alerts.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

function game(cast: string[], ...extra: ((seats: string[]) => Command)[]) {
	const { session, ctx, seats } = newGame(names.slice(0, cast.length));
	const s = run(
		session,
		ctx,
		...cast.map((characterId, i): Command => ({
			type: 'AssignCharacter',
			seatId: seats[i],
			characterId
		})),
		...extra.map((f) => f(seats))
	);
	return { game: s.game, seats };
}

const add =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});

/** Alerts as `kind source→seat index (works?)`, easy to read in a failure. */
function short(alerts: NightAlert[], seats: string[]): string[] {
	return alerts.map((a) => {
		const source = a.source === 'override' ? 'override' : a.source.characterId;
		return `${a.kind} ${source}→${seats.indexOf(a.seatId)}${a.works ? '' : ' (off)'}`;
	});
}

describe('data', () => {
	it('names only real characters', () => {
		const data = committedGameData();
		// Night killers and on-death triggers come from the rules files.
		for (const id of Object.keys(NIGHT_KILLERS)) expect(data.byId.has(id), id).toBe(true);
		for (const id of Object.keys(ON_DEATH)) expect(data.byId.has(id), id).toBe(true);
	});

	it('lists every Demon that kills at night (all but the Riot and the Leviathan)', () => {
		const demons = committedGameData()
			.characters.filter((c) => c.type === 'demon')
			.map((c) => c.id)
			.filter((id) => id !== 'riot' && id !== 'leviathan');
		expect(demons.filter((id) => NIGHT_KILLERS[id]?.by !== 'demon')).toEqual([]);
	});
});

describe('impaired waking player (https://wiki.bloodontheclocktower.com/Glossary)', () => {
	it('reminds that a poisoned Monk has no ability tonight (https://wiki.bloodontheclocktower.com/Poisoner)', () => {
		const { game: g, seats } = game(
			['monk', 'poisoner', 'imp', 'chef', 'empath'],
			add(0, 'poisoner', 'Poisoned')
		);
		const alerts = nightStepAlerts(g, 'monk', characters);
		expect(short(alerts, seats)).toEqual(['impaired monk→0 (off)']);
		expect(alerts[0].impairments.map((i) => i.reason)).toEqual(['poisoned']);
	});

	it('says nothing for a healthy, non-killing step', () => {
		const { game: g } = game(['monk', 'poisoner', 'imp', 'chef', 'empath']);
		expect(nightStepAlerts(g, 'chef', characters)).toEqual([]);
	});
});

describe('Demon kill', () => {
	it('names the Soldier (https://wiki.bloodontheclocktower.com/Soldier) and the Monk’s Safe player (https://wiki.bloodontheclocktower.com/Monk)', () => {
		const { game: g, seats } = game(
			['imp', 'soldier', 'monk', 'chef', 'empath'],
			add(3, 'monk', 'Safe')
		);
		expect(short(nightStepAlerts(g, 'imp', characters), seats)).toEqual([
			'protected soldier→1',
			'protected monk→3'
		]);
	});

	it('flags a Safe token whose Monk is poisoned as not working', () => {
		const { game: g, seats } = game(
			['imp', 'poisoner', 'monk', 'chef', 'empath'],
			add(3, 'monk', 'Safe'),
			add(2, 'poisoner', 'Poisoned')
		);
		expect(short(nightStepAlerts(g, 'imp', characters), seats)).toEqual(['protected monk→3 (off)']);
	});

	it('warns the Mayor’s death may bounce (https://wiki.bloodontheclocktower.com/Mayor)', () => {
		const { game: g, seats } = game(['imp', 'mayor', 'chef', 'empath', 'monk']);
		expect(short(nightStepAlerts(g, 'imp', characters), seats)).toEqual(['may-bounce mayor→1']);
	});

	it('reminds of the Ravenkeeper and the Sage (https://wiki.bloodontheclocktower.com/Ravenkeeper, /Sage)', () => {
		const { game: g, seats } = game(['imp', 'ravenkeeper', 'sage', 'chef', 'empath']);
		expect(short(nightStepAlerts(g, 'imp', characters), seats)).toEqual([
			'on-death ravenkeeper→1',
			'on-death sage→2'
		]);
	});

	it('reminds the Grandmother dies with her grandchild (https://wiki.bloodontheclocktower.com/Grandmother)', () => {
		const { game: g, seats } = game(
			['imp', 'grandmother', 'chef', 'empath', 'monk'],
			add(2, 'grandmother', 'Grandchild')
		);
		expect(short(nightStepAlerts(g, 'imp', characters), seats)).toEqual(['on-death grandmother→2']);
	});

	it('skips dead players', () => {
		const { game: g } = game(['imp', 'soldier', 'chef', 'empath', 'monk'], (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true,
			cause: 'demon'
		}));
		expect(nightStepAlerts(g, 'imp', characters)).toEqual([]);
	});
});

describe('other kills', () => {
	it('the Soldier and Monk protect only against the Demon (https://wiki.bloodontheclocktower.com/Godfather)', () => {
		const { game: g, seats } = game(
			['godfather', 'soldier', 'tealady', 'chef', 'empath'],
			add(3, 'tealady', 'Cannot Die')
		);
		expect(short(nightStepAlerts(g, 'godfather', characters), seats)).toEqual([
			'protected tealady→3'
		]);
	});

	it('the Assassin ignores protection (https://wiki.bloodontheclocktower.com/Assassin)', () => {
		const { game: g, seats } = game(
			['assassin', 'soldier', 'innkeeper', 'ravenkeeper', 'imp'],
			add(1, 'innkeeper', 'Safe')
		);
		expect(short(nightStepAlerts(g, 'assassin', characters), seats)).toEqual([
			'on-death ravenkeeper→3'
		]);
	});

	it('the Gambler can only kill themself, so only their own protection counts (https://wiki.bloodontheclocktower.com/Gambler)', () => {
		const { game: g, seats } = game(
			['gambler', 'mayor', 'innkeeper', 'imp', 'chef'],
			add(0, 'innkeeper', 'Safe'),
			add(4, 'innkeeper', 'Safe')
		);
		expect(short(nightStepAlerts(g, 'gambler', characters), seats)).toEqual([
			'protected innkeeper→0'
		]);
	});

	it('the Fool survives once, until their No Ability token (https://wiki.bloodontheclocktower.com/Fool)', () => {
		const { game: g, seats } = game(['gossip', 'fool', 'imp', 'chef', 'empath']);
		expect(short(nightStepAlerts(g, 'gossip', characters), seats)).toEqual([
			'survives-first-death fool→1'
		]);
		const spent = game(['gossip', 'fool', 'imp', 'chef', 'empath'], add(1, 'fool', 'No Ability'));
		expect(nightStepAlerts(spent.game, 'gossip', characters)).toEqual([]);
	});

	it('the Storyteller’s cannot-die override protects from anything', () => {
		const { game: g, seats } = game(['godfather', 'chef', 'imp', 'empath', 'monk'], (s) => ({
			type: 'SetOverride',
			seatId: s[1],
			override: { field: 'canDie', value: false }
		}));
		expect(short(nightStepAlerts(g, 'godfather', characters), seats)).toEqual([
			'protected override→1'
		]);
	});
});

// A homebrew Demon that kills each night, as the Imp does
// (https://wiki.bloodontheclocktower.com/Imp): its rules block alone gives its step the alerts.
describe('custom characters', () => {
	it('kill at night through their rules block', () => {
		const issues = new Issues();
		const crow = parseCharacter(
			{
				id: 'nightcrow',
				name: 'Night Crow',
				team: 'demon',
				ability: 'Each night*, choose a player: they die.',
				rules: { kills: { by: 'demon' } }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		const all = new Map([...characters, [crow!.id, crow!]]);
		expect(nightKiller('nightcrow', all)).toEqual({
			by: 'demon',
			targets: 'any',
			ignoresProtection: false
		});
		expect(nightKiller('nightcrow')).toBeUndefined();
		const { game: g, seats } = game(['soldier', 'chef']);
		expect(short(nightStepAlerts(g, 'nightcrow', all), seats)).toEqual(['protected soldier→0']);
	});
});
