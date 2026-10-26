import { describe, expect, it } from 'vitest';
import type { Command } from '#lib/core/engine/index.ts';
import { castGame, newGame, run } from '#lib/core/model/fixtures.test-support.ts';
import { NoopSyncProvider, publicProjection } from './public-projection.ts';

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve'];

/** A game full of private information: characters, alignments, reminders, bluffs, bag. */
function busyGame() {
	const { session, ctx, seats } = newGame(names);
	const s = run(
		session,
		ctx,
		{ type: 'AssignCharacter', seatId: seats[0], characterId: 'imp' },
		{ type: 'AssignCharacter', seatId: seats[1], characterId: 'washerwoman' },
		{
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		},
		{ type: 'AssignCharacter', seatId: seats[2], characterId: 'zombuul' },
		{ type: 'AddReminder', seatId: seats[2], reminder: { characterId: 'zombuul', label: 'Dead' } },
		{ type: 'AssignCharacter', seatId: seats[3], characterId: 'beggar', alignment: 'evil' },
		{ type: 'AssignCharacter', seatId: seats[4], characterId: 'poisoner' },
		{
			type: 'SetOverride',
			seatId: seats[4],
			override: { field: 'registersAsDead', value: true, note: 'secret note' }
		},
		{ type: 'SetOverride', seatId: seats[0], override: { field: 'alignment', value: 'good' } },
		{ type: 'SetDead', seatId: seats[3], dead: true, cause: 'slayer' },
		{ type: 'SetDead', seatId: seats[1], dead: true, cause: 'execution' },
		{ type: 'SetDead', seatId: seats[1], dead: false },
		{ type: 'SetDead', seatId: seats[4], dead: true, cause: 'demon' },
		{ type: 'SetDeathCause', seatId: seats[4], cause: 'imp' },
		{ type: 'SetDead', seatId: seats[4], dead: false },
		{
			type: 'AddNightStepOverride',
			override: { kind: 'add', id: 'night-secret', text: 'night secret', after: null }
		},
		{
			type: 'AddDayReminderOverride',
			override: { kind: 'add', key: 'day-secret', group: 'vote', text: 'day secret' }
		},
		{ type: 'SpendGhostVote', seatId: seats[3] },
		{ type: 'AddRuleCharacter', characterId: 'djinn' },
		{ type: 'SetBluffs', set: 0, characterIds: ['chef', 'monk', 'saint'] },
		{
			type: 'BuildBag',
			includeTravellers: false,
			tiles: [{ shows: 'empath', grimoire: 'empath' }]
		},
		{ type: 'SwapSeats', seatA: seats[0], seatB: seats[1] },
		// The day log: nominations and executions are public, the rest is not.
		{ type: 'Nominate', nominator: seats[0], nominee: seats[1] },
		{ type: 'Execute', seatId: seats[1] },
		{ type: 'UseAbility', seatId: seats[1], characterId: 'washerwoman' },
		{ type: 'DayNote', characterId: 'washerwoman', seatId: seats[1], text: 'day note secret' },
		{ type: 'SetDayMark', mark: 'demon-voted', value: true },
		{ type: 'SetGameNote', title: 'Plan', text: 'game notes secret', hidden: false },
		{
			type: 'RecordNightInfo',
			seatId: seats[1],
			characterId: 'washerwoman',
			text: 'info secret',
			reminders: [{ seatId: seats[2], reminder: { characterId: 'washerwoman', label: 'Wrong' } }]
		}
	);
	return { game: s.game, seats, session: s, ctx };
}

describe('publicProjection', () => {
	it('has names, seat order, deaths and ghost votes', () => {
		const { game, seats } = busyGame();
		expect(publicProjection(game)).toEqual({
			seats: [
				{ seatId: seats[1], seatNumber: 1, playerName: 'Ben', dead: false },
				{ seatId: seats[0], seatNumber: 2, playerName: 'Ana', dead: false },
				// The Zombuul's first death looks like a death to the town, ghost vote and all.
				{ seatId: seats[2], seatNumber: 3, playerName: 'Cat', dead: true, ghostVote: 'unused' },
				{ seatId: seats[3], seatNumber: 4, playerName: 'Dev', dead: true, ghostVote: 'used' },
				// A Storyteller override is private, so it does not show as a death.
				{ seatId: seats[4], seatNumber: 5, playerName: 'Eve', dead: false }
			].map((s) => (s.seatId === seats[1] ? { ...s, dead: true, ghostVote: 'unused' } : s)),
			today: { nominations: [{ nominator: seats[0], nominee: seats[1] }], executions: [seats[1]] }
		});
	});

	it('carries where the board draws the seats, and nothing else of the layout (plan J13)', () => {
		const { game, seats } = busyGame();
		expect(
			publicProjection(game, undefined, { shape: 'oval', gaps: {}, placed: {} })
		).not.toHaveProperty('layout');
		const placed = { x: 20, y: 30, note: 'secret' } as { x: number; y: number };
		const layout = { shape: 'circle', gaps: { [seats[0]]: 1 }, placed: { [seats[1]]: placed } };
		expect(publicProjection(game, undefined, layout).layout).toEqual({
			shape: 'circle',
			gaps: { [seats[0]]: 1 },
			placed: { [seats[1]]: { x: 20, y: 30 } }
		});
	});

	it("carries the board corner's lines, and nothing else (Trevor, 2026-10-24)", () => {
		const { game } = busyGame();
		expect(publicProjection(game)).not.toHaveProperty('corner');
		const corner = {
			modes: ['World Cup', 'Djinn limit'],
			joinCode: true,
			phase: { kind: 'night', number: 2, secret: 'x' } as { kind: 'night'; number: number },
			gameTime: { begun: true, startedAt: 1000 },
			watchers: 3,
			author: false as const,
			storyteller: false as const,
			version: '2.0',
			players: '8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)',
			grimoire: 'secret'
		};
		expect(publicProjection(game, undefined, undefined, corner).corner).toEqual({
			modes: ['World Cup', 'Djinn limit'],
			joinCode: true,
			phase: { kind: 'night', number: 2 },
			gameTime: { begun: true, startedAt: 1000 },
			watchers: 3,
			author: false,
			storyteller: false,
			version: '2.0',
			players: '8 (5 Townsfolk, 1 Outsider, 1 Minion, 1 Demon)'
		});
		// Lines the board hides are left out.
		expect(publicProjection(game, undefined, undefined, { modes: [] }).corner).toEqual({
			modes: []
		});
	});

	it('carries the day timer as the Storyteller shows it to players (Trevor, 2026-10-26)', () => {
		const { game } = busyGame();
		expect(publicProjection(game)).not.toHaveProperty('timer');
		const timer = {
			durationMs: 60_000,
			elapsedMs: 0,
			startedAt: 5,
			mode: 'down' as const,
			look: 'sun' as const,
			grimoire: 'secret'
		};
		expect(
			publicProjection(game, undefined, undefined, undefined, undefined, [], timer).timer
		).toEqual({ durationMs: 60_000, elapsedMs: 0, startedAt: 5, mode: 'down', look: 'sun' });
	});

	it('carries the game mode and special rules, and nothing for a Standard game', () => {
		const { game } = busyGame();
		expect(publicProjection(game)).not.toHaveProperty('rules');
		const rules = [
			{ id: 'mode', name: 'Mode' },
			{ id: 'rule', name: 'Rule', text: 'Text.' }
		];
		expect(publicProjection(game, undefined, undefined, undefined, undefined, rules).rules).toEqual(
			rules
		);
	});

	it('leaks no characters, alignments, reminders, overrides, bluffs, rule characters or bag', () => {
		const { game } = busyGame();
		const json = JSON.stringify(publicProjection(game));
		const secrets = new Set<string>([
			'good',
			'evil',
			'secret note',
			'registersAsDead',
			'night-secret',
			'night secret',
			'day-secret',
			'day secret',
			'day note secret',
			'game notes secret',
			'info secret',
			'demonVoted',
			'ability',
			'note',
			'info'
		]);
		for (const seat of Object.values(game.seats)) {
			if (seat.characterId) secrets.add(seat.characterId);
			for (const r of seat.reminders)
				[r.reminderId, r.characterId, r.label].forEach((x) => secrets.add(x));
		}
		game.ruleCharacters.forEach((id) => secrets.add(id));
		game.bluffs.flat().forEach((id) => secrets.add(id));
		for (const tile of Object.values(game.bag!.tiles)) {
			[tile.tileId, tile.shows, tile.grimoire].forEach((x) => secrets.add(x));
		}
		secrets.add(game.gameId);
		secrets.add(game.script.meta!.name);
		expect(secrets.size).toBeGreaterThan(15);
		for (const secret of secrets) expect(json).not.toContain(`"${secret}"`);
		for (const secret of secrets) expect(json).not.toContain(secret);

		// Only allow-listed keys, so a new private field cannot slip in.
		const keys = new Set<string>();
		JSON.parse(json, (key, value) => {
			if (key !== '' && Number.isNaN(Number(key))) keys.add(key);
			return value;
		});
		expect([...keys].sort()).toEqual(
			[
				'dead',
				'ghostVote',
				'playerName',
				'seatId',
				'seatNumber',
				'seats',
				'today',
				'nominations',
				'nominator',
				'nominee',
				'executions'
			].sort()
		);
	});

	it('leaks no cause of death, which can reveal a character', () => {
		const { game, seats } = busyGame();
		const dev = game.seats[seats[3]];
		expect(dev).toMatchObject({ dead: true, deathCause: 'slayer' });
		const json = JSON.stringify(publicProjection(game));
		expect(json).not.toContain('deathCause');
		expect(json).not.toContain('slayer');
		// The view of a dead player is the same whatever the cause.
		const noCause = { ...game, seats: { ...game.seats, [dev.seatId]: { ...dev } } };
		delete noCause.seats[dev.seatId].deathCause;
		expect(publicProjection(noCause)).toEqual(publicProjection(game));
	});

	it("leaks no Storyteller's seat notes", () => {
		const { session, ctx, seats } = newGame(5);
		const s = run(session, ctx, { type: 'SetSeatNote', seatId: seats[0], note: 'secret word' });
		expect(JSON.stringify(publicProjection(s.game))).not.toContain('secret word');
	});

	it('leaks no night-order or day-reminder overrides', () => {
		const { game } = busyGame();
		expect(game.nightOrderOverrides).toHaveLength(1);
		expect(game.dayReminderOverrides).toHaveLength(1);
		const bare = { ...game, nightOrderOverrides: [], dayReminderOverrides: [] };
		expect(publicProjection(game)).toEqual(publicProjection(bare));
	});

	it('shows only the current day log, so "New day" clears it for the town too', () => {
		const { session, ctx } = busyGame();
		const next = run(session, ctx, { type: 'NewDay' }).game;
		expect(publicProjection(next).today).toEqual({ nominations: [], executions: [] });
	});

	it('leaves out names that are not set', () => {
		const { session } = newGame(2);
		const state = publicProjection(session.game);
		expect(state.seats.every((s) => !('playerName' in s))).toBe(true);
		expect('storytellerName' in state).toBe(false);
	});

	it("shows each player's own avatar and frame, and none where they picked none (plan R6)", () => {
		const { session, ctx, seats } = newGame(2);
		const s = run(session, ctx, {
			type: 'SetSeatLook',
			seatId: seats[0],
			avatar: 'initials',
			frame: 'ring'
		});
		const [first, second] = publicProjection(s.game).seats;
		expect(first).toMatchObject({ avatar: 'initials', frame: 'ring' });
		expect('avatar' in second || 'frame' in second).toBe(false);
	});

	it("shows the Storyteller's name, which the table already knows", () => {
		const { session, ctx } = newGame(2);
		const named = run(session, ctx, { type: 'SetStorytellerName', name: 'Sam' });
		expect(publicProjection(named.game).storytellerName).toBe('Sam');
		const cleared = run(named, ctx, { type: 'SetStorytellerName' });
		expect('storytellerName' in publicProjection(cleared.game)).toBe(false);
	});

	// Travellers tell the town who they are (https://wiki.bloodontheclocktower.com/Travellers).
	it("shows a Traveller's character only when the caller says the town knows it", () => {
		const s = busyGame();
		const travellers = new Set(['beggar']);
		const shown = publicProjection(s.game, (id) => travellers.has(id));
		expect(shown.seats.flatMap((seat) => (seat.traveller ? [seat.traveller] : []))).toEqual([
			'beggar'
		]);
		// Hidden Travellers (Stowed Away), or no answer: no character at all.
		expect(publicProjection(s.game, () => false).seats.some((seat) => 'traveller' in seat)).toBe(
			false
		);
		expect(publicProjection(s.game).seats.some((seat) => 'traveller' in seat)).toBe(false);
	});
});

describe('NoopSyncProvider', () => {
	it('accepts public state and publishes nothing', async () => {
		const provider = new NoopSyncProvider();
		await expect(
			provider.publish({ seats: [], today: { nominations: [], executions: [] } })
		).resolves.toBeUndefined();
		await expect(provider.close()).resolves.toBeUndefined();
	});
});

// https://wiki.bloodontheclocktower.com/Banshee: everyone learns when the Demon kills the Banshee,
// who then votes twice on each nomination; the players' grim shows that instead of a ghost vote.
describe('a Banshee the Demon killed', () => {
	const die =
		(seat: number, cause?: 'demon' | 'execution' | 'imp') =>
		(s: string[]): Command => ({
			type: 'SetDead',
			seatId: s[seat],
			dead: true,
			...(cause ? { cause } : {})
		});
	const seatOf = (cause?: 'demon' | 'execution' | 'imp') => {
		const { session, ctx } = castGame(['banshee', 'chef', 'imp'], die(0, cause));
		return publicProjection(session.game, undefined, undefined, undefined, ctx.characters).seats[0];
	};

	it('shows two votes and no ghost vote, by the Demon or the Imp', () => {
		for (const cause of ['demon', 'imp'] as const) {
			const seat = seatOf(cause);
			expect(seat).toMatchObject({ dead: true, votes: 2 });
			expect(seat).not.toHaveProperty('ghostVote');
		}
	});

	it('shows a ghost vote when executed, or when the cause is not recorded', () => {
		for (const cause of ['execution', undefined] as const) {
			const seat = seatOf(cause);
			expect(seat).toMatchObject({ dead: true, ghostVote: 'unused' });
			expect(seat).not.toHaveProperty('votes');
		}
	});

	it('names no character for the town without the characters', () => {
		const { session } = castGame(['banshee', 'chef', 'imp'], die(0, 'demon'));
		expect(publicProjection(session.game).seats[0]).toMatchObject({ ghostVote: 'unused' });
	});
});
