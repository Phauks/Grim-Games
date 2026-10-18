/**
 * Reminder targets. Every rule cites its character's wiki page in
 * `reminder-targets.data.ts`; the behaviour tests below cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import type { GameSession } from '#lib/core/engine/log.ts';
import type { EngineContext } from '#lib/core/engine/context.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { Reminder } from '#lib/core/model/types.ts';
import {
	REMINDER_TARGETS,
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
		expect(entry.wiki).toBe(wikiUrl(character));
		const labels = new Set([...character.reminders, ...character.remindersGlobal]);
		expect(new Set(Object.keys(entry.labels))).toEqual(labels);
		for (const [label, rule] of Object.entries(entry.labels)) {
			expect(rule.note.length, `${character.id} ${label}`).toBeGreaterThan(0);
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
	it('Washerwoman: Townsfolk on another Townsfolk; Wrong anywhere but that player', () => {
		const { session, seats, ctx } = grimoire(['washerwoman', 'chef', 'butler', 'imp'], []);
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([1]);
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
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([1, 2]);
		const s = run(session, ctx, poisoned(seats[0]), poisoned(seats[1]));
		expect(fitting(s, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 1, 2, 3]);
		expect(fitting(s, { characterId: 'investigator', label: 'Minion' })).toEqual([0, 1, 2, 3]);
	});

	// https://wiki.bloodontheclocktower.com/Recluse and https://wiki.bloodontheclocktower.com/Spy:
	// they may register as the other side, so info tokens fit them (Trevor, 2026-10-18).
	it('Recluse and Spy fit the info tokens they may register for', () => {
		const { session } = grimoire(['investigator', 'washerwoman', 'recluse', 'spy', 'imp']);
		expect(fitting(session, { characterId: 'investigator', label: 'Minion' })).toEqual([2, 3]);
		expect(fitting(session, { characterId: 'washerwoman', label: 'Townsfolk' })).toEqual([0, 3]);
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
	it('Marionette: next to the Demon', () => {
		const { session } = grimoire(['chef', 'marionette:empath+evil', 'imp', 'monk', 'saint']);
		expect(fitting(session, { characterId: 'marionette', label: 'Is The Marionette' })).toEqual([
			1
		]);
	});

	// https://wiki.bloodontheclocktower.com/Undertaker: the token marks the dead executee.
	it('Undertaker: Died Today only on a dead player', () => {
		const { session } = grimoire(['undertaker', 'chef!', 'imp']);
		expect(fitting(session, { characterId: 'undertaker', label: 'Died Today' })).toEqual([1]);
	});

	// https://wiki.bloodontheclocktower.com/Riot: the day tokens mark the game, not a player.
	it('Riot: day tokens are never on a seat', () => {
		const { session, seats } = grimoire(['riot', 'chef']);
		expect(fitting(session, { characterId: 'riot', label: 'Day 1' })).toEqual([]);
		expect(
			reminderTargetMisses(
				session.game,
				{ characterId: 'riot', label: 'Day 1' },
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
