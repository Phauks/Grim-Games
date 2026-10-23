/**
 * Reminder targets: the `reminderTargets` part of each character's rules file
 * (`data/rules/<id>.json`), read from the character's wiki page; the behaviour tests below
 * cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import type { GameSession } from '#lib/core/engine/log.ts';
import { dawnGames } from '#lib/core/engine/dawns.ts';
import type { EngineContext } from '#lib/core/engine/context.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Reminder } from '#lib/core/model/types.ts';
import {
	REMINDER_TARGETS,
	reminderOffered,
	reminderTargetMisses,
	reminderTargets,
	targetRule
} from './reminder-targets.ts';

const data = committedGameData();

/**
 * A game whose seats hold these characters, in order. `drunk:empath` is the Drunk shown the
 * Empath; `+evil` sets the seat's alignment; `!` marks the player dead.
 */
function grimoire(
	specs: string[],
	extra: Command[] = []
): { session: GameSession; seats: string[]; ctx: EngineContext } {
	const { session, ctx, seats } = newGame(specs.length);
	const commands = specs.flatMap((spec, i): Command[] => {
		const dead = spec.endsWith('!');
		const [name, alignment] = spec.replace(/!$/, '').split('+');
		const [truly, shown] = name.split(':');
		const seatId = seats[i];
		const out: Command[] = [
			{
				type: 'AssignCharacter',
				seatId,
				characterId: shown ?? truly,
				...(alignment ? { alignment: alignment as 'good' | 'evil' } : {})
			}
		];
		if (shown) {
			const label = `Is The ${data.byId.get(truly)!.name}`;
			out.push({ type: 'AddReminder', seatId, reminder: { characterId: truly, label } });
		}
		if (dead) out.push({ type: 'SetDead', seatId, dead: true });
		return out;
	});
	return { session: run(session, ctx, ...commands, ...extra), seats, ctx };
}

const characters = newGame(1).ctx.characters;

/** Indexes of the seats a token fits, in seating order. */
function fitting(session: GameSession, reminder: Reminder): number[] {
	return reminderTargets(session.game, reminder, characters).flatMap((fit, i) =>
		fit.misses.length === 0 ? [i] : []
	);
}

describe('every official reminder token has a target rule', () => {
	const withReminders = data.characters.filter(
		(c) => c.reminders.length > 0 || c.remindersGlobal.length > 0
	);

	it.each(withReminders.map((c) => [c.id, c] as const))('%s', (_, character) => {
		const entry = REMINDER_TARGETS[character.id];
		expect(entry, `${character.id} has no target rules`).toBeDefined();
		const labels = new Set([...character.reminders, ...character.remindersGlobal]);
		expect(new Set(Object.keys(entry.labels))).toEqual(labels);
		for (const [label, rule] of Object.entries(entry.labels)) {
			expect(rule.note?.length, `${character.id} ${label}`).toBeGreaterThan(0);
			expect(rule.global === true || rule.seat !== undefined, `${character.id} ${label}`).toBe(
				true
			);
			for (const other of [rule.withLabel, rule.notWithLabel, rule.neighbour?.of]) {
				if (other !== undefined && other !== 'self') expect(labels).toContain(other);
			}
		}
	});

	it('lists no character without reminder tokens', () => {
		const ids = new Set(withReminders.map((c) => c.id));
		expect(Object.keys(REMINDER_TARGETS).filter((id) => !ids.has(id))).toEqual([]);
	});
});

describe('reminder targets', () => {
	// https://wiki.bloodontheclocktower.com/Vigormortis: a killed Minion keeps its ability and
	// poisons a nearby Townsfolk, counting only Townsfolk either way round.
	it('Vigormortis: Has Ability only on a killed Minion, Poisoned on its nearest Townsfolk', () => {
		const { session, seats, ctx } = grimoire([
			'vigormortis',
			'chef',
			'butler',
			'poisoner',
			'recluse',
			'empath',
			'monk'
		]);
		const dead: Command[] = [
			{
				type: 'AddReminder',
				seatId: seats[3],
				reminder: { characterId: 'vigormortis', label: 'Dead' }
			},
			{
				type: 'AddReminder',
				seatId: seats[3],
				reminder: { characterId: 'vigormortis', label: 'Has Ability' }
			}
		];
		const s = run(session, ctx, ...dead);
		expect(fitting(session, { characterId: 'vigormortis', label: 'Has Ability' })).toEqual([]);
		expect(fitting(s, { characterId: 'vigormortis', label: 'Has Ability' })).toEqual([3]);
		// The Chef (seat 1) is the nearest Townsfolk anticlockwise, skipping the Butler; the
		// Empath (seat 5) clockwise, skipping the Recluse.
		expect(fitting(s, { characterId: 'vigormortis', label: 'Poisoned' })).toEqual([1, 5]);
		expect(
			reminderTargetMisses(
				s.game,
				{ characterId: 'vigormortis', label: 'Poisoned' },
				seats[2],
				characters
			)
		).toEqual(['type', 'neighbour']);
	});

	// https://wiki.bloodontheclocktower.com/No_Dashii: its two nearest Townsfolk are poisoned.
	it('No Dashii: its nearest Townsfolk each way', () => {
		const { session } = grimoire(['nodashii', 'saint', 'chef', 'empath', 'monk', 'recluse']);
		expect(fitting(session, { characterId: 'nodashii', label: 'Poisoned' })).toEqual([2, 4]);
	});

	// https://wiki.bloodontheclocktower.com/Tea_Lady: her alive neighbours, while both are good.
	it('Tea Lady: only her living good neighbours', () => {
		const { session } = grimoire(['chef', 'monk!', 'tealady', 'empath', 'imp']);
		expect(fitting(session, { characterId: 'tealady', label: 'Cannot Die' })).toEqual([0, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Washerwoman: one Townsfolk and one other player, who may
	// be the Washerwoman herself (Trevor, 2026-10-18).
	// The Washerwoman may be shown herself (Trevor, 2026-10-23).
	it('Washerwoman: Townsfolk on any Townsfolk, herself too; Wrong anywhere but that player', () => {
		const { session, seats, ctx } = grimoire(['washerwoman', 'chef', 'butler', 'imp'], []);
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 1]);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'washerwoman', label: 'Townsfolk' }
		});
		expect(fitting(s, { characterId: 'washerwoman', label: 'Wrong' })).toEqual([0, 2, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Investigator: two players are shown, one of them a
	// Minion; the other may be the Investigator (Trevor, 2026-10-18).
	it('Investigator: Minion on another Minion; Wrong anywhere but that player', () => {
		const { session, seats, ctx } = grimoire(['investigator', 'chef', 'poisoner', 'imp'], []);
		expect(fitting(session, { characterId: 'investigator', label: 'Minion' })).toEqual([2]);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[2],
			reminder: { characterId: 'investigator', label: 'Minion' }
		});
		expect(fitting(s, { characterId: 'investigator', label: 'Wrong' })).toEqual([0, 1, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Librarian: two players are shown, one of them an
	// Outsider; neither is the Librarian.
	it('Librarian: Outsider on another Outsider; Wrong anywhere but that player', () => {
		const { session, seats, ctx } = grimoire(['librarian', 'chef', 'butler', 'imp'], []);
		expect(fitting(session, { characterId: 'librarian', label: 'Outsider' })).toEqual([2]);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[2],
			reminder: { characterId: 'librarian', label: 'Outsider' }
		});
		expect(fitting(s, { characterId: 'librarian', label: 'Wrong' })).toEqual([0, 1, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk is dealt a Townsfolk token, so
	// "Is The Drunk" is never on a Minion, Demon or Outsider (Trevor, 2026-10-18).
	it('Drunk: Is The Drunk only beside a Townsfolk token', () => {
		const { session } = grimoire(['chef', 'butler', 'poisoner', 'imp', 'empath']);
		expect(fitting(session, { characterId: 'drunk', label: 'Is The Drunk' })).toEqual([0, 4]);
	});

	// https://wiki.bloodontheclocktower.com/Drunk and https://wiki.bloodontheclocktower.com/Poisoner:
	// a drunk or poisoned player's information can be false, so their info tokens fit any seat
	// (Trevor, 2026-10-18: "like a librarian being drunk, they can see anyone").
	it('Librarian really the Drunk: Outsider and Wrong fit any seat', () => {
		const { session } = grimoire(['drunk:librarian', 'chef', 'butler', 'imp']);
		expect(fitting(session, { characterId: 'librarian', label: 'Outsider' })).toEqual([0, 1, 2, 3]);
		expect(fitting(session, { characterId: 'librarian', label: 'Wrong' })).toEqual([0, 1, 2, 3]);
	});

	it('poisoned Washerwoman and Investigator: their tokens fit any seat', () => {
		const { session, seats, ctx } = grimoire(['washerwoman', 'investigator', 'chef', 'poisoner']);
		const poisoned = (seatId: string): Command => ({
			type: 'AddReminder',
			seatId,
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		});
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 1, 2]);
		const s = run(session, ctx, poisoned(seats[0]), poisoned(seats[1]));
		expect(fitting(s, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 1, 2, 3]);
		expect(fitting(s, { characterId: 'investigator', label: 'Minion' })).toEqual([0, 1, 2, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Recluse and https://wiki.bloodontheclocktower.com/Spy:
	// they may register as the other side, so info tokens fit them (Trevor, 2026-10-18).
	it('Recluse and Spy fit the info tokens they may register for', () => {
		const { session } = grimoire(['investigator', 'washerwoman', 'recluse', 'spy', 'imp']);
		expect(fitting(session, { characterId: 'investigator', label: 'Minion' })).toEqual([2, 3]);
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 1, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Knight: a sober Knight's Know tokens are never on
	// the Demon; a drunk one's may be.
	it('Knight: Know never on the Demon unless the Knight is drunk', () => {
		const { session, seats, ctx } = grimoire(['knight', 'chef', 'imp']);
		expect(fitting(session, { characterId: 'knight', label: 'Know' })).not.toContain(2);
		const s = run(session, ctx, {
			type: 'AddReminder',
			seatId: seats[0],
			reminder: { characterId: 'sweetheart', label: 'Drunk' }
		});
		expect(fitting(s, { characterId: 'knight', label: 'Know' })).toContain(2);
	});

	// https://wiki.bloodontheclocktower.com/Evil_Twin: the twin is of the opposite alignment.
	it('Evil Twin: the twin is the opposite alignment and never the Evil Twin', () => {
		const { session } = grimoire(['eviltwin', 'chef', 'imp', 'empath']);
		expect(fitting(session, { characterId: 'eviltwin', label: 'Twin' })).toEqual([1, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Marionette: sits next to the Demon, and is evil.
	// Placing it makes a good player the Marionette, and evil: it fits the nearest good player
	// each side of the Demon, passing over evil players (Trevor, 2026-10-23).
	it('Marionette: the nearest good player each side of the Demon', () => {
		const { session } = grimoire(['chef', 'empath', 'imp', 'scarletwoman', 'monk']);
		expect(fitting(session, { characterId: 'marionette', label: 'Is The Marionette' })).toEqual([
			1, 4
		]);
	});

	// https://wiki.bloodontheclocktower.com/Recluse: a Recluse may register as the Demon, so the
	// good players beside it fit too (Trevor, 2026-10-23).
	it('Marionette: beside a Recluse who may register as the Demon', () => {
		const { session } = grimoire(['chef', 'recluse', 'monk', 'soldier', 'imp', 'saint']);
		expect(fitting(session, { characterId: 'marionette', label: 'Is The Marionette' })).toEqual([
			0, 2, 3, 5
		]);
	});

	// https://wiki.bloodontheclocktower.com/Undertaker: the token marks the dead executee.
	it('Undertaker: Died Today only on a dead player', () => {
		const { session } = grimoire(['undertaker', 'chef!', 'imp']);
		expect(fitting(session, { characterId: 'undertaker', label: 'Died Today' })).toEqual([1]);
	});

	// https://wiki.bloodontheclocktower.com/Riot: the day tokens go on the Riot itself, as every
	// token with nowhere else to go does (Trevor, 2026-10-23).
	it('Riot: day tokens go on the Riot', () => {
		const { session, seats } = grimoire(['riot', 'chef']);
		expect(fitting(session, { characterId: 'riot', label: 'Day 1' })).toEqual([0]);
		expect(
			reminderTargetMisses(
				session.game,
				{ characterId: 'riot', label: 'Day 1' },
				seats[1],
				characters
			)
		).toEqual(['not-self']);
	});

	// A Fabled's own tokens still mark the game: a Fabled has no seat.
	it('Fabled tokens still mark the game', () => {
		const { session, seats } = grimoire(['chef']);
		expect(
			reminderTargetMisses(
				session.game,
				{ characterId: 'deusexfiasco', label: 'Whoopsie' },
				seats[0],
				characters
			)
		).toEqual(['global']);
	});

	// https://wiki.bloodontheclocktower.com/Slayer: "No Ability" marks the Slayer itself.
	it('a token for the character itself fits only its own seat, wherever it sits', () => {
		const { session } = grimoire(['chef', 'slayer', 'imp']);
		expect(fitting(session, { characterId: 'slayer', label: 'No Ability' })).toEqual([1]);
	});

	it('judges nothing it cannot: homebrew tokens, and owner rules with the owner out of play', () => {
		const { session } = grimoire(['chef', 'imp']);
		expect(fitting(session, { characterId: 'homebrew', label: 'Anything' })).toEqual([0, 1]);
		expect(targetRule({ characterId: 'chef', label: 'Nope' })).toBeUndefined();
		expect(fitting(session, { characterId: 'slayer', label: 'No Ability' })).toEqual([0, 1]);
	});
});

// Trevor's corrections, 2026-10-23: one test per line of his list.
describe('placement corrections (Trevor, 2026-10-23)', () => {
	const know = (characterId: string, seatId: string): Command => ({
		type: 'AddReminder',
		seatId,
		reminder: { characterId, label: 'Know' }
	});

	// https://wiki.bloodontheclocktower.com/Noble: three players, exactly one of them evil.
	it('Noble: Know fits two good players and one evil player', () => {
		const { session, seats, ctx } = grimoire(['noble', 'chef', 'monk', 'imp', 'poisoner']);
		const two = run(session, ctx, know('noble', seats[1]), know('noble', seats[2]));
		expect(fitting(two, { characterId: 'noble', label: 'Know' })).toEqual([3, 4]);
		const three = run(two, ctx, know('noble', seats[3]));
		expect(fitting(three, { characterId: 'noble', label: 'Know' })).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Steward: the good player may be the Steward.
	it('Steward: may learn themself', () => {
		const { session } = grimoire(['steward', 'chef', 'imp']);
		expect(fitting(session, { characterId: 'steward', label: 'Know' })).toEqual([0, 1]);
	});

	// https://wiki.bloodontheclocktower.com/Bounty_Hunter: an evil Bounty Hunter may be the evil
	// player it knows.
	it('Bounty Hunter: may learn themself', () => {
		const { session } = grimoire(['bountyhunter+evil', 'imp', 'chef']);
		expect(fitting(session, { characterId: 'bountyhunter', label: 'Know' })).toEqual([0, 1]);
	});

	// https://wiki.bloodontheclocktower.com/Investigator: no self rule; the Investigator is no
	// Minion, so it never fits anyway.
	it('Investigator: Minion fits only Minions, with no rule about self', () => {
		const { session } = grimoire(['investigator', 'poisoner', 'imp']);
		expect(targetRule({ characterId: 'investigator', label: 'Minion' })?.seat).toBe('any');
		expect(fitting(session, { characterId: 'investigator', label: 'Minion' })).toEqual([1]);
	});

	// https://wiki.bloodontheclocktower.com/Grandmother: any good player, of any type, since a
	// Minion or Demon may be good.
	it('Grandmother: Grandchild fits a good Minion', () => {
		const { session } = grimoire(['grandmother', 'poisoner+good', 'imp']);
		expect(fitting(session, { characterId: 'grandmother', label: 'Grandchild' })).toEqual([1]);
	});

	// https://wiki.bloodontheclocktower.com/Village_Idiot: the extra drunk one needs two or more.
	it('Village Idiot: Drunk is offered only with 2 or more Village Idiots', () => {
		const drunk = { characterId: 'villageidiot', label: 'Drunk' };
		const one = grimoire(['villageidiot', 'chef', 'imp']);
		expect(reminderOffered(one.session.game, drunk, characters)).toBe(false);
		const two = grimoire(['villageidiot', 'villageidiot', 'imp']);
		expect(reminderOffered(two.session.game, drunk, characters)).toBe(true);
		expect(reminderOffered(one.session.game, { characterId: 'chef', label: 'x' }, characters)).toBe(
			true
		);
	});

	// https://wiki.bloodontheclocktower.com/Undertaker: an executed Undertaker died today too,
	// which the Cannibal may need.
	it('Undertaker: Died Today fits the Undertaker', () => {
		const { session } = grimoire(['undertaker!', 'chef']);
		expect(fitting(session, { characterId: 'undertaker', label: 'Died Today' })).toEqual([0]);
	});

	// https://wiki.bloodontheclocktower.com/Professor: a dead Professor cannot act.
	it('Professor: Alive never fits the Professor', () => {
		const { session } = grimoire(['professor!', 'chef!', 'imp']);
		expect(fitting(session, { characterId: 'professor', label: 'Alive' })).toEqual([1]);
	});

	// https://wiki.bloodontheclocktower.com/Minstrel
	it('Minstrel: Everyone Is Drunk goes on the Minstrel', () => {
		const { session } = grimoire(['minstrel', 'chef']);
		expect(fitting(session, { characterId: 'minstrel', label: 'Everyone Is Drunk' })).toEqual([0]);
	});

	// https://wiki.bloodontheclocktower.com/Tea_Lady: only while both living neighbours are good.
	it('Tea Lady: Cannot Die fits only while both living neighbours are good', () => {
		const tea = { characterId: 'tealady', label: 'Cannot Die' };
		expect(fitting(grimoire(['chef', 'tealady', 'monk', 'imp']).session, tea)).toEqual([0, 2]);
		expect(fitting(grimoire(['chef', 'tealady', 'imp', 'monk']).session, tea)).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Mezepheles: a good Mezepheles may say the word.
	it('Mezepheles: Turns Evil fits a good Mezepheles', () => {
		const { session } = grimoire(['mezepheles+good', 'chef', 'imp']);
		expect(fitting(session, { characterId: 'mezepheles', label: 'Turns Evil' })).toEqual([0, 1]);
	});

	// https://wiki.bloodontheclocktower.com/Xaan, /Fang_Gu: tokens with no target go on their own
	// character.
	it('Xaan nights and the Fang Gu’s Once go on their own character', () => {
		const { session } = grimoire(['xaan', 'fanggu', 'chef']);
		expect(fitting(session, { characterId: 'xaan', label: 'Night 1' })).toEqual([0]);
		expect(fitting(session, { characterId: 'xaan', label: 'X' })).toEqual([0]);
		expect(fitting(session, { characterId: 'fanggu', label: 'Once' })).toEqual([1]);
	});
});

describe('different to last night', () => {
	/** A game where `label` went on seat `on` last night, then New day. */
	function lastNight(cast: string[], characterId: string, label: string, on: number) {
		const first = grimoire(cast);
		const session = run(first.session, first.ctx, {
			type: 'AddReminder',
			seatId: first.seats[on],
			reminder: { characterId, label }
		});
		const dawn = run(session, first.ctx, { type: 'NewDay' });
		return { game: dawn.game, atDawn: dawnGames(dawn.log).at(-1)!, seats: first.seats };
	}

	// https://wiki.bloodontheclocktower.com/Devil%27s_Advocate: a living player, never the
	// same one two nights running.
	it('the Devil’s Advocate does not choose last night’s player again', () => {
		const reminder = { characterId: 'devilsadvocate', label: 'Survives Execution' };
		const { game, atDawn, seats } = lastNight(
			['devilsadvocate', 'chef', 'empath', 'imp'],
			reminder.characterId,
			reminder.label,
			1
		);
		expect(reminderTargetMisses(game, reminder, seats[1], characters, atDawn)).toEqual([
			'last-night'
		]);
		expect(reminderTargetMisses(game, reminder, seats[2], characters, atDawn)).toEqual([]);
		// Without last night's game (the first night), nothing is ruled out.
		expect(reminderTargetMisses(game, reminder, seats[1], characters)).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Exorcist: a different player each night.
	it('the Exorcist does not choose last night’s player again', () => {
		const reminder = { characterId: 'exorcist', label: 'Chosen' };
		const { game, atDawn, seats } = lastNight(
			['exorcist', 'chef', 'empath', 'imp'],
			reminder.characterId,
			reminder.label,
			3
		);
		expect(reminderTargetMisses(game, reminder, seats[3], characters, atDawn)).toEqual([
			'last-night'
		]);
		expect(reminderTargetMisses(game, reminder, seats[2], characters, atDawn)).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Balloonist: each night a player of a different
	// character type from last night's.
	it('the Balloonist is not shown last night’s character type again', () => {
		const reminder = { characterId: 'balloonist', label: 'Know' };
		const { game, atDawn, seats } = lastNight(
			['balloonist', 'chef', 'empath', 'butler', 'imp'],
			reminder.characterId,
			reminder.label,
			1
		);
		const misses = (i: number) =>
			reminderTargetMisses(game, reminder, seats[i], characters, atDawn);
		expect(misses(1)).toEqual(['last-night']);
		expect(misses(2)).toEqual(['last-night']);
		expect(misses(3)).toEqual([]);
		expect(misses(4)).toEqual([]);
	});
});
