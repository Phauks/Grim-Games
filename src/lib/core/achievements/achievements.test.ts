/**
 * Achievements and points over game records. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Saint (executing the Saint ends the game, so a game
 *   can end by the Saint's own win condition, end reason `character:saint`)
 * - https://wiki.bloodontheclocktower.com/Djinn (a Fabled: in play for the whole table, never a
 *   player's character)
 * - https://wiki.bloodontheclocktower.com/Traveller (Travellers are not counted as players)
 * - https://wiki.bloodontheclocktower.com/Scarlet_Woman (becomes the Demon mid-game, so a seat
 *   can start as one character and end as another)
 */
import { describe, expect, it } from 'vitest';
import type { CharacterId, CharacterType } from '#lib/core/data/index.ts';
import { GAME_RECORD_VERSION, type GameRecord } from '#lib/core/stats/index.ts';
import { earned, progress, unlockedOptions } from './engine.ts';
import { balance, pointsEarned, type PointRule } from './points.ts';
import type { Achievement, TakenPart } from './types.ts';

const TYPES: Record<CharacterId, CharacterType> = {
	teaLady: 'townsfolk',
	empath: 'townsfolk',
	chef: 'townsfolk',
	saint: 'outsider',
	scarletwoman: 'minion',
	imp: 'demon',
	beggar: 'traveller',
	djinn: 'fabled'
};

/** A finished game: each seat as [start, end] characters; seat ids are s0, s1, … */
function game(
	n: number,
	seats: [CharacterId, CharacterId?][],
	extra: Partial<GameRecord> = {}
): GameRecord {
	const ids = new Set(seats.flat().filter((id) => id !== undefined));
	return {
		recordVersion: GAME_RECORD_VERSION,
		gameId: `g${n}`,
		role: 'player',
		createdAt: n * 1000,
		endedAt: n * 1000 + 500,
		script: { name: 'Test Brewing' },
		finalThree: false,
		days: 3,
		seats: seats.map(([start, end], i) => ({
			seatId: `s${i}`,
			start: { characterId: start },
			end: { characterId: end ?? start },
			dead: false
		})),
		ruleCharacters: [],
		dayLog: [],
		characters: Object.fromEntries(
			[...ids, ...(extra.ruleCharacters ?? [])].map((id) => [id, { name: id, type: TYPES[id] }])
		),
		...extra
	};
}

const table: [CharacterId, CharacterId?][] = [
	['teaLady'],
	['empath'],
	['chef'],
	['saint'],
	['scarletwoman', 'imp'],
	['imp']
];

describe('earned', () => {
	it('earns "played as" from the seat’s first or last character, never another seat’s', () => {
		const asImp: Achievement = {
			id: 'played-as:imp',
			criteria: { kind: 'playedAs', character: 'imp' },
			unlocks: [{ part: 'medallion', option: 'character:imp' }]
		};
		// The Scarlet Woman became the Imp (seat s4).
		expect(earned([asImp], [{ record: game(1, table), seatId: 's4' }])).toEqual([
			{ id: 'played-as:imp', earnedAt: 1500 }
		]);
		expect(earned([asImp], [{ record: game(1, table), seatId: 's1' }])).toEqual([]);
	});

	it('dates a count by the game that completed it, in the order games ended', () => {
		const three: Achievement = {
			id: 'games-3',
			criteria: { kind: 'gamesPlayed', count: 3, as: 'player' },
			unlocks: [{ part: 'form', option: 'olive' }]
		};
		const games: TakenPart[] = [4, 1, 2].map((n) => ({ record: game(n, table), seatId: 's0' }));
		expect(earned([three], games)).toEqual([{ id: 'games-3', earnedAt: 4500 }]);
		expect(progress(three, games.slice(0, 2))).toEqual({ have: 2, need: 3 });
	});

	it('counts Storyteller games apart from games played', () => {
		const told: Achievement = {
			id: 'told-1',
			criteria: { kind: 'gamesPlayed', count: 1, as: 'storyteller' },
			unlocks: [{ part: 'form', option: 'chain' }]
		};
		expect(earned([told], [{ record: game(1, table), seatId: 's0' }])).toEqual([]);
		expect(earned([told], [{ record: { ...game(1, table), role: 'storyteller' } }])).toHaveLength(
			1
		);
	});

	it('rewards being there for a Saint’s execution, whoever the player was', () => {
		const sawSaint: Achievement = {
			id: 'saw-saint',
			criteria: { kind: 'inGame', where: { endReason: 'character:saint' } },
			unlocks: [{ part: 'accent', option: 'wine-ribbon' }]
		};
		const record = game(1, table, { endReason: 'character:saint' });
		expect(earned([sawSaint], [{ record, seatId: 's1' }])).toHaveLength(1);
		expect(earned([sawSaint], [{ record: game(2, table), seatId: 's1' }])).toEqual([]);
	});

	it('reads Fabled in play and player counts without Travellers', () => {
		const bigDjinn: Achievement = {
			id: 'big-djinn',
			criteria: { kind: 'inGame', where: { ruleCharacter: 'djinn', minPlayers: 6 } },
			unlocks: [{ part: 'crest', option: 'star' }]
		};
		const withDjinn = game(1, table, { ruleCharacters: ['djinn'] });
		expect(earned([bigDjinn], [{ record: withDjinn, seatId: 's0' }])).toHaveLength(1);
		// Six seats, but one is a Traveller: five players.
		const traveller = game(2, [...table.slice(0, 5), ['beggar']], { ruleCharacters: ['djinn'] });
		expect(earned([bigDjinn], [{ record: traveller, seatId: 's0' }])).toEqual([]);
	});

	it('lists each unlocked option once', () => {
		const a: Achievement = {
			id: 'a',
			criteria: { kind: 'gamesPlayed', count: 1 },
			unlocks: [{ part: 'colour', option: 'bronze' }]
		};
		const b: Achievement = { ...a, id: 'b' };
		const got = earned([a, b], [{ record: game(1, table), seatId: 's0' }]);
		expect(unlockedOptions([a, b], got)).toEqual([{ part: 'colour', option: 'bronze' }]);
	});
});

describe('points', () => {
	const rules: PointRule[] = [
		{ id: 'game', kind: 'perGame', points: 10 },
		{ id: 'new-character', kind: 'newCharacter', points: 5 },
		{ id: 'long-game', kind: 'perGame', points: 3, where: { minDays: 5 } }
	];

	it('still pays for a second game as the Tea Lady, without the new-character bonus', () => {
		const games = [1, 2].map((n) => ({ record: game(n, table), seatId: 's0' }));
		expect(pointsEarned(rules, games)).toEqual([
			{ ruleId: 'game', gameId: 'g1', points: 10 },
			{ ruleId: 'new-character', gameId: 'g1', points: 5 },
			{ ruleId: 'game', gameId: 'g2', points: 10 }
		]);
	});

	it('pays the same for a win or a loss', () => {
		const won = { record: game(1, table, { winner: 'good' }), seatId: 's0' };
		const lost = { record: game(1, table, { winner: 'evil' }), seatId: 's0' };
		expect(pointsEarned(rules, [won])).toEqual(pointsEarned(rules, [lost]));
	});

	it('takes purchases off the balance', () => {
		const entries = pointsEarned(rules, [{ record: game(1, table, { days: 6 }), seatId: 's0' }]);
		expect(balance(entries, [{ unlock: { part: 'motion', option: 'sway' }, cost: 12 }])).toBe(6);
	});
});
