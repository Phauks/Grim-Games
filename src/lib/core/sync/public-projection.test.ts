import { describe, expect, it } from 'vitest';
import { newGame, run } from '#lib/core/model/fixtures.test-support.ts';
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
		{ type: 'SwapSeats', seatA: seats[0], seatB: seats[1] }
	);
	return { game: s.game, seats };
}

describe('publicProjection', () => {
	it('has names, seat order, deaths and ghost votes', () => {
		const { game, seats } = busyGame();
		expect(publicProjection(game)).toEqual({
			seats: [
				{ seatId: seats[1], seatNumber: 1, playerName: 'Ben', dead: false, ghostVoteUsed: false },
				{ seatId: seats[0], seatNumber: 2, playerName: 'Ana', dead: false, ghostVoteUsed: false },
				// The Zombuul's first death looks like a death to the town.
				{ seatId: seats[2], seatNumber: 3, playerName: 'Cat', dead: true, ghostVoteUsed: false },
				{ seatId: seats[3], seatNumber: 4, playerName: 'Dev', dead: true, ghostVoteUsed: true },
				// A Storyteller override is private, so it does not show as a death.
				{ seatId: seats[4], seatNumber: 5, playerName: 'Eve', dead: false, ghostVoteUsed: false }
			]
		});
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
			'day secret'
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
			['dead', 'ghostVoteUsed', 'playerName', 'seatId', 'seatNumber', 'seats'].sort()
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

	it('leaks no night-order or day-reminder overrides', () => {
		const { game } = busyGame();
		expect(game.nightOrderOverrides).toHaveLength(1);
		expect(game.dayReminderOverrides).toHaveLength(1);
		const bare = { ...game, nightOrderOverrides: [], dayReminderOverrides: [] };
		expect(publicProjection(game)).toEqual(publicProjection(bare));
	});

	it('leaves out names that are not set', () => {
		const { session } = newGame(2);
		expect(publicProjection(session.game).seats.every((s) => !('playerName' in s))).toBe(true);
	});
});

describe('NoopSyncProvider', () => {
	it('accepts public state and publishes nothing', async () => {
		const provider = new NoopSyncProvider();
		await expect(provider.publish({ seats: [] })).resolves.toBeUndefined();
		await expect(provider.close()).resolves.toBeUndefined();
	});
});
