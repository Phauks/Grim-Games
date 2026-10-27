/**
 * Whether an ability works, registration and protection. Each scenario paraphrases a wiki
 * page:
 * - https://wiki.bloodontheclocktower.com/Glossary (drunk, poisoned, no ability, dead)
 * - https://wiki.bloodontheclocktower.com/Drunk, /Poisoner, /Minstrel, /Witch
 * - https://wiki.bloodontheclocktower.com/Preacher
 * - https://wiki.bloodontheclocktower.com/Recluse, /Spy, /Lycanthrope
 * - https://wiki.bloodontheclocktower.com/Sailor, /Tea_Lady, /Monk, /Soldier
 */
import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import {
	newGame,
	run,
	testCharacters as characters,
	testContext
} from '#lib/core/model/fixtures.test-support.ts';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { OFFICIAL_RULES, rulesOf } from '#lib/core/data/rules/index.ts';
import { isSeatable } from '#lib/core/data/index.ts';
import {
	abilityState,
	executionSavers,
	firstDeathSaver,
	impairmentOfLabel,
	killRedirect,
	protection,
	registrations,
	registrationWorlds
} from './ability.ts';

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

describe('abilityState', () => {
	it('works for a sober, healthy, living player', () => {
		const { game: g, seats } = game(['chef', 'imp', 'poisoner']);
		expect(abilityState(g, seats[0], characters)).toMatchObject({
			works: true,
			dead: false,
			impairments: []
		});
	});

	it('names the poisoner as the source of a Poisoned token', () => {
		const { game: g, seats } = game(['chef', 'imp', 'poisoner'], add(0, 'poisoner', 'Poisoned'));
		expect(abilityState(g, seats[0], characters)).toMatchObject({
			works: false,
			impairments: [{ reason: 'poisoned', source: { characterId: 'poisoner', seatId: seats[2] } }]
		});
	});

	it('treats the Drunk as drunk, with or without the token', () => {
		const { game: g, seats } = game(['chef', 'imp'], add(0, 'drunk', 'Is The Drunk'));
		expect(abilityState(g, seats[0], characters)).toMatchObject({
			characterId: 'drunk',
			works: false,
			impairments: [{ reason: 'drunk', source: { characterId: 'drunk', seatId: seats[0] } }]
		});
	});

	it('lists every reason, no ability first, then poisoned, then drunk', () => {
		const { game: g, seats } = game(
			['chef', 'imp', 'poisoner', 'sailor'],
			add(0, 'sailor', 'Drunk'),
			add(0, 'poisoner', 'Poisoned')
		);
		expect(abilityState(g, seats[0], characters).impairments.map((i) => i.reason)).toEqual([
			'poisoned',
			'drunk'
		]);
	});

	it('dead players have no ability, unless it works even if dead (the Recluse)', () => {
		const { game: g, seats } = game(
			['chef', 'recluse', 'imp'],
			(s) => ({ type: 'SetDead', seatId: s[0], dead: true }),
			(s) => ({ type: 'SetDead', seatId: s[1], dead: true })
		);
		expect(abilityState(g, seats[0], characters)).toMatchObject({ works: false, dead: true });
		expect(abilityState(g, seats[1], characters)).toMatchObject({ works: true, dead: false });
	});

	it('the Minstrel makes every other non-Traveller drunk, not the Minstrel', () => {
		const { game: g, seats } = game(
			['minstrel', 'chef', 'imp', 'monk'],
			add(0, 'minstrel', 'Everyone Is Drunk'),
			(s) => ({ type: 'AssignCharacter', seatId: s[3], characterId: 'beggar', alignment: 'good' })
		);
		expect(abilityState(g, seats[0], characters).works).toBe(true);
		expect(abilityState(g, seats[1], characters).impairments).toMatchObject([
			{ reason: 'drunk', source: { characterId: 'minstrel', seatId: seats[0] } }
		]);
		expect(abilityState(g, seats[3], characters).works).toBe(true);
	});

	it('the Witch has no ability once just 3 players live', () => {
		const { game: g, seats } = game(['witch', 'chef', 'imp', 'monk'], (s) => ({
			type: 'SetDead',
			seatId: s[3],
			dead: true
		}));
		expect(abilityState(g, seats[0], characters).impairments).toMatchObject([
			{ reason: 'no-ability', source: { characterId: 'witch' } }
		]);
	});
});

describe('Preacher', () => {
	const cast = ['preacher', 'cerenovus', 'nodashii', 'engineer', 'poisoner'];

	it('a chosen Minion has no ability while the Preacher lives', () => {
		const { game: g, seats } = game(cast, add(1, 'preacher', 'No Ability'));
		expect(abilityState(g, seats[1], characters)).toMatchObject({
			works: false,
			impairments: [{ reason: 'no-ability', source: { characterId: 'preacher', seatId: seats[0] } }]
		});
	});

	it('choosing a non-Minion (the Engineer) does nothing', () => {
		const { game: g, seats } = game(cast, add(3, 'preacher', 'No Ability'));
		expect(abilityState(g, seats[3], characters).works).toBe(true);
	});

	it('the Minion gets its ability back while the Preacher is poisoned, or once dead', () => {
		const poisoned = game(cast, add(1, 'preacher', 'No Ability'), add(0, 'poisoner', 'Poisoned'));
		expect(abilityState(poisoned.game, poisoned.seats[1], characters).works).toBe(true);
		const dead = game(cast, add(1, 'preacher', 'No Ability'), (s) => ({
			type: 'SetDead',
			seatId: s[0],
			dead: true
		}));
		expect(abilityState(dead.game, dead.seats[1], characters).works).toBe(true);
	});
});

describe('registrations', () => {
	it('the Recluse may register as evil and as a Minion or Demon', () => {
		const { game: g, seats } = game(['chef', 'recluse', 'imp', 'spy']);
		expect(registrations(g, characters)).toEqual([
			expect.objectContaining({
				seatId: seats[1],
				alignments: ['good', 'evil'],
				types: ['outsider', 'minion', 'demon']
			}),
			expect.objectContaining({
				seatId: seats[3],
				alignments: ['evil', 'good'],
				types: ['minion', 'townsfolk', 'outsider']
			})
		]);
		// 2 x 3 for each of them, the true world first.
		const worlds = registrationWorlds(g, characters);
		expect(worlds).toHaveLength(36);
		expect(worlds[0].misregistered).toEqual([]);
		expect(worlds[0].alignment(seats[1])).toBe('good');
	});

	it('a poisoned Recluse registers truly: no ability', () => {
		const { game: g } = game(
			['chef', 'recluse', 'imp', 'poisoner'],
			add(1, 'poisoner', 'Poisoned')
		);
		expect(registrations(g, characters)).toEqual([]);
	});

	it('the Faux Paw player always registers as evil while the Lycanthrope lives', () => {
		const { game: g, seats } = game(
			['lycanthrope', 'chef', 'imp', 'poisoner'],
			add(1, 'lycanthrope', 'Faux Paw')
		);
		expect(registrations(g, characters)).toMatchObject([
			{ seatId: seats[1], alignments: ['evil'], source: { characterId: 'lycanthrope' } }
		]);
		expect(registrationWorlds(g, characters)[0].alignment(seats[1])).toBe('evil');
	});
});

describe('protection', () => {
	it('the Sailor cannot die, unless drunk or poisoned', () => {
		const sober = game(['sailor', 'imp']);
		expect(protection(sober.game, sober.seats[0], characters, 'other')).toMatchObject({
			characterId: 'sailor'
		});
		const drunk = game(['sailor', 'imp'], add(0, 'sailor', 'Drunk'));
		expect(protection(drunk.game, drunk.seats[0], characters, 'other')).toBeUndefined();
	});

	it('the Monk and Soldier only protect from the Demon; the Tea Lady from anything', () => {
		const { game: g, seats } = game(
			['monk', 'chef', 'soldier', 'tealady', 'imp'],
			add(1, 'monk', 'Safe')
		);
		expect(protection(g, seats[1], characters, 'demon')).toMatchObject({ characterId: 'monk' });
		expect(protection(g, seats[1], characters, 'other')).toBeUndefined();
		expect(protection(g, seats[2], characters, 'other')).toBeUndefined();
		const tea = game(['tealady', 'chef', 'imp'], add(1, 'tealady', 'Cannot Die'));
		expect(protection(tea.game, tea.seats[1], characters, 'other')).toMatchObject({
			characterId: 'tealady'
		});
	});

	it('a Storyteller override wins', () => {
		const { game: g, seats } = game(['sailor', 'imp'], (s) => ({
			type: 'SetOverride',
			seatId: s[0],
			override: { field: 'canDie', value: true }
		}));
		expect(protection(g, seats[0], characters, 'other')).toBeUndefined();
	});

	// A homebrew Townsfolk that marks a player safe from the Demon, as the Monk does: its
	// rules block alone makes its token protect.
	it('a custom character protects through its rules block', () => {
		const issues = new Issues();
		const warden = parseCharacter(
			{
				id: 'lampwarden',
				name: 'Lamp Warden',
				team: 'townsfolk',
				ability: 'Each night*, choose a player: they are safe from the Demon tonight.',
				reminders: ['Warded'],
				rules: { protects: { who: 'marked', token: 'Warded', from: 'demon' } }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		);
		expect(issues.list).toEqual([]);
		const all = new Map([...characters, [warden!.id, warden!]]);
		const { session, ctx, seats } = newGame(3, { ctx: testContext({ characters: all }) });
		const g = run(
			session,
			ctx,
			...['lampwarden', 'chef', 'imp'].map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			})),
			add(1, 'lampwarden', 'Warded')(seats)
		).game;
		expect(protection(g, seats[1], all, 'demon')).toMatchObject({ characterId: 'lampwarden' });
		expect(protection(g, seats[1], all, 'other')).toBeUndefined();
		expect(protection(g, seats[1], characters, 'demon')).toBeUndefined();
	});
});

describe('executionSavers', () => {
	const ids = (g: ReturnType<typeof game>, i: number) =>
		executionSavers(g.game, g.seats[i], characters)
			.filter((s) => s.source.characterId !== 'sailor' && s.source.characterId !== 'tealady')
			.map((s) => [s.source.characterId, s.problem ?? 'ok']);

	it('offers the Pacifist for a good player, warns for an evil one, never applies it unasked', () => {
		// https://wiki.bloodontheclocktower.com/Pacifist: "might not die"; the Storyteller chooses.
		const g = game(['pacifist', 'chef', 'poisoner', 'imp']);
		expect(ids(g, 1)).toContainEqual(['pacifist', 'ok']);
		expect(ids(g, 2)).toContainEqual(['pacifist', 'not-this-player']);
		expect(protection(g.game, g.seats[1], characters, 'execution')).toBeUndefined();
	});

	it("says when the save's character is drunk or poisoned", () => {
		const g = game(['pacifist', 'chef', 'poisoner', 'imp'], add(0, 'poisoner', 'Poisoned'));
		expect(ids(g, 1)).toContainEqual(['pacifist', 'impaired']);
	});

	it("offers the Devil's Advocate only for the player it marked", () => {
		// https://wiki.bloodontheclocktower.com/Devil%27s_Advocate
		const g = game(
			['devilsadvocate', 'chef', 'clockmaker', 'imp'],
			add(1, 'devilsadvocate', 'Survives Execution')
		);
		expect(ids(g, 1)).toContainEqual(['devilsadvocate', 'ok']);
		expect(ids(g, 2)).toContainEqual(['devilsadvocate', 'not-this-player']);
		expect(protection(g.game, g.seats[1], characters, 'execution')).toMatchObject({
			characterId: 'devilsadvocate'
		});
	});

	it('offers the Psychopath and Lleech for themselves only; the Vizier applies unasked', () => {
		// https://wiki.bloodontheclocktower.com/Psychopath (roshambo), /Lleech (lives while the
		// host does), /Vizier (cannot die during the day).
		const g = game(['psychopath', 'lleech', 'vizier', 'chef']);
		expect(ids(g, 0)).toContainEqual(['psychopath', 'ok']);
		expect(ids(g, 1)).toContainEqual(['lleech', 'ok']);
		expect(ids(g, 3)).toEqual(
			expect.arrayContaining([
				['psychopath', 'not-this-player'],
				['lleech', 'not-this-player']
			])
		);
		expect(protection(g.game, g.seats[0], characters, 'execution')).toBeUndefined();
		expect(protection(g.game, g.seats[2], characters, 'execution')).toMatchObject({
			characterId: 'vizier'
		});
		// Not the Vizier's protection at night.
		expect(protection(g.game, g.seats[2], characters, 'demon')).toBeUndefined();
	});

	it('never offers a protection that lasts only the night', () => {
		// https://wiki.bloodontheclocktower.com/Innkeeper: "can't die tonight".
		const g = game(['innkeeper', 'monk', 'soldier', 'imp']);
		expect(ids(g, 0)).toEqual([]);
	});
});

describe('custom characters', () => {
	function custom(raw: Record<string, unknown>) {
		const issues = new Issues();
		const character = parseCharacter(raw, '[0]', issues, { strict: false, scriptFields: true });
		expect(issues.list).toEqual([]);
		const all = new Map([...characters, [character!.id, character!]]);
		const created = newGame(2, { ctx: testContext({ characters: all }) });
		const { ctx, seats } = created;
		const session = run(
			created.session,
			ctx,
			...[character!.id, 'imp'].map((characterId, i): Command => ({
				type: 'AssignCharacter',
				seatId: seats[i],
				characterId
			}))
		);
		return { g: session.game, seats, all, ctx, session };
	}

	// A homebrew Townsfolk whose kill, by anyone, may land elsewhere, as the Mayor's may
	// (https://wiki.bloodontheclocktower.com/Mayor).
	it('can move a kill elsewhere through its rules block', () => {
		const { g, seats, all } = custom({
			id: 'decoy',
			name: 'Decoy',
			team: 'townsfolk',
			ability: 'If you die at night, another player might die instead.',
			rules: { redirectsKill: { from: 'any' } }
		});
		expect(killRedirect(g, seats[0], all, 'other')).toEqual({
			characterId: 'decoy',
			seatId: seats[0]
		});
		expect(killRedirect(g, seats[0], characters, 'demon')).toBeUndefined();
	});

	// A homebrew Outsider that survives its first death, as the Fool does
	// (https://wiki.bloodontheclocktower.com/Fool), until its own spent token is placed.
	it('can survive its first death through its rules block', () => {
		const { g, seats, all, session, ctx } = custom({
			id: 'lucky',
			name: 'Lucky',
			team: 'outsider',
			ability: 'The first time you die, you don’t.',
			reminders: ['Unlucky'],
			rules: { survivesFirstDeath: { spentToken: 'Unlucky' } }
		});
		expect(firstDeathSaver(g, seats[0], all)).toEqual({
			source: { characterId: 'lucky', seatId: seats[0] },
			spentToken: 'Unlucky'
		});
		const spent = run(session, ctx, add(0, 'lucky', 'Unlucky')(seats)).game;
		expect(firstDeathSaver(spent, seats[0], all)).toBeUndefined();
	});

	// A homebrew Outsider that may register as evil and a Minion, as the Recluse may
	// (https://wiki.bloodontheclocktower.com/Recluse).
	it('can register as something else through its rules block', () => {
		const { g, seats, all } = custom({
			id: 'shady',
			name: 'Shady',
			team: 'outsider',
			ability: 'You might register as evil and as a Minion, even if dead.',
			rules: { registersAs: { self: { alignments: ['evil'], types: ['minion'] } } }
		});
		expect(registrations(g, all)).toMatchObject([
			{
				seatId: seats[0],
				alignments: ['good', 'evil'],
				types: ['outsider', 'minion'],
				source: { characterId: 'shady' }
			}
		]);
		expect(registrations(g, characters)).toEqual([]);
	});

	// A homebrew Outsider that is always drunk, as the Drunk is
	// (https://wiki.bloodontheclocktower.com/Drunk).
	it('can be impaired itself through its rules block', () => {
		const { g, seats, all } = custom({
			id: 'sotted',
			name: 'Sotted',
			team: 'outsider',
			ability: 'You are drunk.',
			rules: { impairs: { self: { reason: 'drunk' } } }
		});
		expect(abilityState(g, seats[0], all).impairments).toMatchObject([
			{ reason: 'drunk', source: { characterId: 'sotted', seatId: seats[0] } }
		]);
	});

	// A homebrew Townsfolk whose token poisons everyone else, as the Minstrel's "Everyone Is
	// Drunk" makes them drunk (https://wiki.bloodontheclocktower.com/Minstrel).
	it('can impair every other player with a token through its rules block', () => {
		const { g, seats, all, session, ctx } = custom({
			id: 'bard',
			name: 'Bard',
			team: 'townsfolk',
			ability: 'Once per game, at night, everyone else is poisoned until dusk.',
			reminders: ['Hush'],
			rules: { impairs: { tokens: { Hush: { reason: 'poisoned', on: 'others' } } } }
		});
		expect(abilityState(g, seats[1], all).works).toBe(true);
		const hushed = run(session, ctx, add(0, 'bard', 'Hush')(seats)).game;
		expect(abilityState(hushed, seats[0], all).impairments).toEqual([]);
		expect(abilityState(hushed, seats[1], all).impairments).toMatchObject([
			{ reason: 'poisoned', source: { characterId: 'bard', seatId: seats[0] } }
		]);
	});
});

/**
 * One case per official reminder whose label says "Poisoned" or "Drunk", built from the
 * character's rules alone: on another player it impairs them while its character lives, and,
 * once that character dies, only if its rules say it lasts (an `impairs.tokens` entry without
 * `whileWorks`, such as the Sweetheart's "from now on"). Basis:
 * https://wiki.bloodontheclocktower.com/Abilities (a dead or impaired character's persistent
 * effects end; its example is the dead Poisoner's Slayer).
 */
describe('impairing tokens end with their character unless they last', () => {
	const tokens = [...OFFICIAL_RULES.keys()].flatMap((id) => {
		const character = characters.get(id);
		if (!character || !isSeatable(character.type) || character.type === 'traveller') return [];
		return [...new Set(character.reminders)]
			.filter((label) => impairmentOfLabel(label))
			.map((label) => ({ id, label, rule: rulesOf(id)?.impairs?.tokens?.[label] }))
			.filter(({ rule }) => rule === undefined || rule.on === 'carrier');
	});
	const dead =
		(i: number) =>
		(s: string[]): Command => ({ type: 'SetDead', seatId: s[i], dead: true });

	it('covers the Poisoner, Widow, Courtier and Sweetheart', () => {
		const ids = tokens.map((t) => t.id);
		expect(ids).toEqual(expect.arrayContaining(['poisoner', 'widow', 'courtier', 'sweetheart']));
	});

	for (const { id, label, rule } of tokens) {
		const lasts = rule !== undefined && !rule.whileWorks;
		it(`${id} "${label}": impairs while ${id} lives`, () => {
			const { game: g, seats } = game([id, 'empath', 'imp'], add(1, id, label));
			const typed = rule?.type === undefined || rule.type === 'townsfolk';
			expect(abilityState(g, seats[1], characters).works).toBe(!typed);
		});
		it(`${id} "${label}": ${lasts ? 'still impairs' : 'ends'} once ${id} is dead`, () => {
			const { game: g, seats } = game([id, 'empath', 'imp'], add(1, id, label), dead(0));
			const typed = rule?.type === undefined || rule.type === 'townsfolk';
			expect(abilityState(g, seats[1], characters).works).toBe(!(typed && lasts));
		});
	}
});

describe('Barista and Xaan', () => {
	// https://wiki.bloodontheclocktower.com/Barista: the chosen player is sober and healthy.
	it("clears drunkenness and poisoning under the Barista's Sober & Healthy", () => {
		const { game: g, seats } = game(
			['empath', 'poisoner', 'imp', 'barista'],
			add(0, 'poisoner', 'Poisoned'),
			add(0, 'barista', 'Sober & Healthy')
		);
		expect(abilityState(g, seats[0], characters).works).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Xaan: on night X all Townsfolk are poisoned until
	// dusk, while the Xaan lives.
	it("poisons every Townsfolk while the Xaan's X is out, and only while it lives", () => {
		const { game: g, seats } = game(['empath', 'butler', 'xaan', 'imp'], add(2, 'xaan', 'X'));
		expect(abilityState(g, seats[0], characters).impairments[0]?.reason).toBe('poisoned');
		expect(abilityState(g, seats[1], characters).works).toBe(true);
		const { game: after } = game(['empath', 'butler', 'xaan', 'imp'], add(2, 'xaan', 'X'), (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true
		}));
		expect(abilityState(after, seats[0], characters).works).toBe(true);
	});
});
