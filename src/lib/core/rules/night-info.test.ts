/**
 * Night info worked out from the grimoire and the day log. Each scenario paraphrases the
 * character's ability as its wiki page states it:
 * - https://wiki.bloodontheclocktower.com/Town_Crier
 * - https://wiki.bloodontheclocktower.com/Flowergirl
 * - https://wiki.bloodontheclocktower.com/Undertaker
 * - https://wiki.bloodontheclocktower.com/Juggler
 * - https://wiki.bloodontheclocktower.com/Gossip
 * - https://wiki.bloodontheclocktower.com/Oracle
 * - https://wiki.bloodontheclocktower.com/Washerwoman, /Librarian, /Investigator, /Chef,
 *   /Empath, /Fortune_Teller, /Steward, /Noble
 * - https://wiki.bloodontheclocktower.com/Drunk, /Poisoner, /Vortox, /Spy, /Recluse
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
	abnormalCauses,
	abnormalSinceDawn,
	answerCauses,
	infoPicker,
	nightAnswer,
	infoRecord,
	isAllowed,
	isTruthful,
	truthfulFirst,
	validInformation,
	withNightInfo
} from './night-info.ts';
import { nightOrder } from './night-order.ts';

/** The night answer for a character that has one (each test's does). */
function answerOf(...args: Parameters<typeof nightAnswer>) {
	const a = nightAnswer(...args);
	if (!a) throw new Error(`no night answer for ${args[2]}`);
	return a;
}

const names = ['Ana', 'Ben', 'Cat', 'Dev', 'Eve', 'Fay', 'Gus', 'Hal'];

/** Seats 0-7 hold these characters; extra commands run after. */
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
	return { game: s.game, seats, session: s, ctx };
}

const snv = [
	'towncrier',
	'flowergirl',
	'juggler',
	'gossip',
	'witch',
	'nodashii',
	'savant',
	'mutant'
];

describe('Town Crier', () => {
	it('hears yes when a Minion nominated today, and who', () => {
		const { game: g, seats } = game(snv, (s) => ({
			type: 'Nominate',
			nominator: s[4],
			nominee: s[0]
		}));
		expect(answerOf(g, seats[0], 'towncrier', characters)).toMatchObject({
			kind: 'yes-no',
			value: true,
			because: [seats[4]]
		});
	});

	it('hears no when only good players and the Demon nominated', () => {
		const { game: g, seats } = game(
			snv,
			(s) => ({ type: 'Nominate', nominator: s[3], nominee: s[4] }),
			(s) => ({ type: 'Nominate', nominator: s[5], nominee: s[3] })
		);
		expect(answerOf(g, seats[0], 'towncrier', characters)).toMatchObject({
			value: false,
			because: []
		});
	});

	it('reads the current day log only: after New day nothing is recorded again', () => {
		const { session, ctx, seats } = game(snv, (s) => ({
			type: 'Nominate',
			nominator: s[4],
			nominee: s[0]
		}));
		const next = run(session, ctx, { type: 'NewDay' });
		expect(answerOf(next.game, seats[0], 'towncrier', characters)).toMatchObject({
			kind: 'none'
		});
	});

	// Trevor (2026-10-23): "town crier is giving valid info no when we haven't implemented
	// nomination tracking". With no nominations recorded the answer is unknown, never no.
	it('gives no answer until a nomination is recorded today', () => {
		const { game: g, seats } = game(snv);
		expect(answerOf(g, seats[0], 'towncrier', characters)).toMatchObject({
			kind: 'none',
			reason: 'No nominations recorded today',
			because: []
		});
	});

	it('is unreliable while the Town Crier is poisoned', () => {
		const { game: g, seats } = game(snv, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'nodashii', label: 'Poisoned' }
		}));
		expect(answerOf(g, seats[0], 'towncrier', characters).unreliable).toBe('poisoned');
	});

	it('must be false with a Vortox in play', () => {
		const cast = snv.map((id) => (id === 'nodashii' ? 'vortox' : id));
		const { game: g, seats } = game(cast);
		expect(answerOf(g, seats[0], 'towncrier', characters).mustBeFalse).toBe(true);
	});

	// Trevor, 2026-10-17: only players whose registration could change the answer.
	it('flags a Spy or Recluse who nominated, who might register as something else', () => {
		const cast = ['towncrier', 'spy', 'recluse', 'imp', 'chef'];
		const quiet = game(cast);
		expect(answerOf(quiet.game, quiet.seats[0], 'towncrier', characters).misregister).toEqual([]);
		const { game: g, seats } = game(
			cast,
			(s) => ({ type: 'Nominate', nominator: s[1], nominee: s[4] }),
			(s) => ({ type: 'Nominate', nominator: s[2], nominee: s[3] })
		);
		const a = answerOf(g, seats[0], 'towncrier', characters);
		expect(a.misregister).toEqual([seats[1], seats[2]]);
		// Why: the nominators as they are, and what each registration would make it.
		expect(a.why.facts.map((f) => [f.seatId, f.characterId, f.type])).toEqual([
			[seats[1], 'spy', 'minion'],
			[seats[2], 'recluse', 'outsider']
		]);
		expect(a.why.alternatives.find((x) => x.seatId === seats[2])!.as).toContainEqual({
			alignment: 'good',
			type: 'minion',
			value: { kind: 'yes-no', value: true }
		});
	});

	it('shows what the Storyteller recorded, as their override', () => {
		const { game: g, seats } = game(snv, (s) => ({
			type: 'RecordNightInfo',
			seatId: s[0],
			characterId: 'towncrier',
			text: 'Shown no'
		}));
		expect(answerOf(g, seats[0], 'towncrier', characters).shown).toMatchObject({
			text: 'Shown no'
		});
	});
});

describe('Flowergirl', () => {
	it('has no answer until the Storyteller marks whether the Demon voted', () => {
		const { game: g, seats } = game(snv);
		expect(answerOf(g, seats[1], 'flowergirl', characters).kind).toBe('none');
	});

	it('hears yes when the Demon voted, and no when it did not', () => {
		const voted = game(snv, () => ({ type: 'SetDemonVoted', voted: true }));
		expect(answerOf(voted.game, voted.seats[1], 'flowergirl', characters)).toMatchObject({
			kind: 'yes-no',
			value: true,
			because: [voted.seats[5]]
		});
		const not = game(snv, () => ({ type: 'SetDemonVoted', voted: false }));
		expect(answerOf(not.game, not.seats[1], 'flowergirl', characters)).toMatchObject({
			value: false
		});
	});
});

describe('Undertaker', () => {
	const tb = ['undertaker', 'washerwoman', 'slayer', 'virgin', 'poisoner', 'imp', 'butler'];

	it('learns the character of the player executed today', () => {
		const { game: g, seats } = game(tb, (s) => ({ type: 'Execute', seatId: s[4] }));
		expect(answerOf(g, seats[0], 'undertaker', characters)).toMatchObject({
			kind: 'character',
			value: 'poisoner',
			because: [seats[4]]
		});
	});

	it('learns the Drunk, not the Townsfolk the Drunk thinks they are', () => {
		const { game: g, seats } = game(
			tb,
			(s) => ({
				type: 'AddReminder',
				seatId: s[1],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}),
			(s) => ({ type: 'Execute', seatId: s[1] })
		);
		expect(answerOf(g, seats[0], 'undertaker', characters)).toMatchObject({ value: 'drunk' });
	});

	it('learns nothing when the executed player did not die by it', () => {
		const { game: g, seats } = game(
			tb,
			(s) => ({ type: 'SetDead', seatId: s[2], dead: true }),
			(s) => ({ type: 'Execute', seatId: s[2] })
		);
		expect(answerOf(g, seats[0], 'undertaker', characters).kind).toBe('none');
	});

	it('learns nothing once the execution is removed from the log', () => {
		const { session, ctx, seats } = game(tb, (s) => ({ type: 'Execute', seatId: s[4] }));
		const removed = run(session, ctx, {
			type: 'RemoveDayEntry',
			entryId: session.game.today.entries[0].entryId
		});
		expect(answerOf(removed.game, seats[0], 'undertaker', characters).kind).toBe('none');
	});

	it('without a day log, reads the dead player carrying the Died Today reminder', () => {
		const { game: g, seats } = game(
			tb,
			(s) => ({ type: 'SetDead', seatId: s[5], dead: true, cause: 'execution' }),
			(s) => ({
				type: 'AddReminder',
				seatId: s[5],
				reminder: { characterId: 'undertaker', label: 'Died Today' }
			})
		);
		expect(answerOf(g, seats[0], 'undertaker', characters)).toMatchObject({
			kind: 'character',
			value: 'imp',
			because: [seats[5]]
		});
	});

	it('marks the answer unreliable when the Undertaker is poisoned', () => {
		const { game: g, seats } = game(
			tb,
			(s) => ({ type: 'Execute', seatId: s[4] }),
			(s) => ({
				type: 'AddReminder',
				seatId: s[0],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			})
		);
		expect(answerOf(g, seats[0], 'undertaker', characters)).toMatchObject({
			value: 'poisoner',
			unreliable: 'poisoned'
		});
	});

	// https://wiki.bloodontheclocktower.com/Exile: exile is not an execution.
	it('learns nothing from an exiled Traveller', () => {
		const { game: g, seats } = game(
			[...tb, 'beggar'],
			(s) => ({ type: 'SetAlignment', seatId: s[7], alignment: 'good' }),
			(s) => ({ type: 'Exile', seatId: s[7] })
		);
		expect(answerOf(g, seats[0], 'undertaker', characters).kind).toBe('none');
	});
});

describe('Juggler', () => {
	it('counts guesses that match true characters (a guess of the Drunk’s token is wrong)', () => {
		const { game: g, seats } = game(
			['juggler', 'washerwoman', 'witch', 'nodashii', 'savant'],
			(s) => ({
				type: 'AddReminder',
				seatId: s[1],
				reminder: { characterId: 'drunk', label: 'Is The Drunk' }
			}),
			(s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				seatId: s[0],
				text: 'Guessed loudly',
				guesses: [
					{ seatId: s[1], characterId: 'washerwoman' },
					{ seatId: s[2], characterId: 'witch' },
					{ seatId: s[3], characterId: 'nodashii' },
					{ seatId: s[4], characterId: 'gossip' }
				]
			})
		);
		expect(answerOf(g, seats[0], 'juggler', characters)).toMatchObject({
			kind: 'number',
			value: 2,
			because: [seats[2], seats[3]]
		});
	});

	it('uses the latest guess when a player is guessed twice', () => {
		const { game: g, seats } = game(
			['juggler', 'witch', 'nodashii'],
			(s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				text: '',
				guesses: [{ seatId: s[1], characterId: 'cerenovus' }]
			}),
			(s) => ({
				type: 'DayNote',
				characterId: 'juggler',
				text: '',
				guesses: [{ seatId: s[1], characterId: 'witch' }]
			})
		);
		expect(answerOf(g, seats[0], 'juggler', characters)).toMatchObject({ value: 1 });
	});

	it('has no answer with no guesses logged', () => {
		const { game: g, seats } = game(['juggler', 'witch', 'nodashii']);
		expect(answerOf(g, seats[0], 'juggler', characters).kind).toBe('none');
	});
});

describe('Gossip', () => {
	const statement =
		(holds?: boolean) =>
		(s: string[]): Command => ({
			type: 'DayNote',
			characterId: 'gossip',
			seatId: s[0],
			text: 'Ben is the Demon',
			...(holds === undefined ? {} : { holds })
		});

	it('says a player dies when today’s statement was marked true', () => {
		const { game: g, seats } = game(['gossip', 'nodashii', 'witch'], statement(true));
		expect(answerOf(g, seats[0], 'gossip', characters)).toMatchObject({
			kind: 'yes-no',
			value: true
		});
	});

	it('says nobody dies when it was marked false', () => {
		const { game: g, seats } = game(['gossip', 'nodashii', 'witch'], statement(false));
		expect(answerOf(g, seats[0], 'gossip', characters)).toMatchObject({
			kind: 'yes-no',
			value: false
		});
	});

	it('asks for the truth, or for a statement, when either is missing', () => {
		const unmarked = game(['gossip', 'nodashii', 'witch'], statement());
		expect(answerOf(unmarked.game, unmarked.seats[0], 'gossip', characters)).toMatchObject({
			kind: 'none',
			reason: 'Mark whether the statement was true'
		});
		const silent = game(['gossip', 'nodashii', 'witch']);
		expect(answerOf(silent.game, silent.seats[0], 'gossip', characters).kind).toBe('none');
	});

	it('is not reliable while the Gossip is poisoned (no death)', () => {
		const { game: g, seats } = game(
			['gossip', 'nodashii', 'witch', 'poisoner'],
			statement(true),
			(s) => ({
				type: 'AddReminder',
				seatId: s[0],
				reminder: { characterId: 'poisoner', label: 'Poisoned' }
			})
		);
		expect(answerOf(g, seats[0], 'gossip', characters)).toMatchObject({ unreliable: 'poisoned' });
	});
});

describe('Oracle', () => {
	it('counts dead evil players, including a Zombuul that registers as dead', () => {
		const { game: g, seats } = game(
			['oracle', 'witch', 'cerenovus', 'zombuul', 'savant'],
			(s) => ({ type: 'SetDead', seatId: s[1], dead: true }),
			(s) => ({ type: 'SetDead', seatId: s[4], dead: true }),
			(s) => ({
				type: 'AddReminder',
				seatId: s[3],
				reminder: { characterId: 'zombuul', label: 'Dead' }
			})
		);
		expect(answerOf(g, seats[0], 'oracle', characters)).toMatchObject({
			value: 2,
			because: [seats[1], seats[3]]
		});
	});
});

describe('info picker', () => {
	const tb = ['washerwoman', 'slayer', 'virgin', 'butler', 'poisoner', 'imp', 'chef'];

	it('Washerwoman: pairs of a Townsfolk and any other player, never herself', () => {
		const { game: g, seats } = game(tb);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(picker).toMatchObject({ kind: 'pair-character', seatCount: 2, anyAllowed: false });
		const slayer = picker.options.filter((o) => o.characterId === 'slayer');
		expect(slayer).toHaveLength(5);
		expect(slayer.every((o) => o.seats[0] === seats[1] && !o.seats.includes(seats[0]))).toBe(true);
		expect(new Set(picker.options.map((o) => o.characterId))).toEqual(
			new Set(['slayer', 'virgin', 'chef'])
		);
		expect(isTruthful(picker, { seats: [seats[4], seats[1]], characterId: 'slayer' })).toBe(true);
		expect(isTruthful(picker, { seats: [seats[4], seats[1]], characterId: 'virgin' })).toBe(false);
		// Truthful seats come first, in the order of the Townsfolk.
		expect(truthfulFirst(picker, g).seats.slice(0, 3)).toEqual([seats[1], seats[2], seats[6]]);
	});

	it('Washerwoman: the Drunk is not a Townsfolk to learn about', () => {
		const { game: g, seats } = game(tb, (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		}));
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(picker.options.some((o) => o.seats[0] === seats[1])).toBe(false);
	});

	it('allows every option, marked, when the Washerwoman is poisoned', () => {
		const { game: g, seats } = game(tb, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(picker).toMatchObject({ anyAllowed: true, unreliable: 'poisoned' });
		const lie = { seats: [seats[4], seats[5]], characterId: 'virgin' };
		expect(isTruthful(picker, lie)).toBe(false);
		expect(isAllowed(picker, lie)).toBe(true);
	});

	it('records the Townsfolk token on the real one and Wrong on the other', () => {
		const { game: g, seats } = game(tb);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		const record = infoRecord(
			picker,
			{ seats: [seats[4], seats[1]], characterId: 'slayer' },
			{ seat: (s) => names[seats.indexOf(s)], character: (id) => id },
			g,
			characters
		);
		expect(record).toEqual({
			text: 'Shown Eve and Ben: one is the slayer',
			reminders: [
				{ seatId: seats[1], reminder: { characterId: 'washerwoman', label: 'Townsfolk' } },
				{ seatId: seats[4], reminder: { characterId: 'washerwoman', label: 'Wrong' } }
			]
		});
	});

	it('Librarian: learns the Drunk as an Outsider, or 0 with no Outsiders', () => {
		const drunk = game(['librarian', 'washerwoman', 'imp', 'poisoner', 'chef'], (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'drunk', label: 'Is The Drunk' }
		}));
		const picker = infoPicker(drunk.game, drunk.seats[0], 'librarian', characters)!;
		expect(new Set(picker.options.map((o) => o.characterId))).toEqual(new Set(['drunk']));
		const none = game(['librarian', 'washerwoman', 'imp', 'poisoner', 'chef']);
		const empty = infoPicker(none.game, none.seats[0], 'librarian', characters)!;
		expect(empty.options).toEqual([{ seats: [], none: true, number: 0 }]);
		expect(isTruthful(empty, { seats: [], none: true })).toBe(true);
	});

	it('Investigator: pairs with a Minion', () => {
		const { game: g, seats } = game(['investigator', 'slayer', 'baron', 'imp', 'chef']);
		const picker = infoPicker(g, seats[0], 'investigator', characters)!;
		expect(new Set(picker.options.map((o) => o.characterId))).toEqual(new Set(['baron']));
	});

	it('Chef: pairs of evil neighbours, around the circle', () => {
		// Seats 0 and 4 are neighbours round the circle; 2 and 3 sit together.
		const { game: g, seats } = game(['poisoner', 'chef', 'baron', 'imp', 'scarletwoman']);
		const picker = infoPicker(g, seats[1], 'chef', characters)!;
		expect(picker.options).toEqual([{ seats: [], number: 3 }]);
		expect(isTruthful(picker, { seats: [], number: 3 })).toBe(true);
	});

	it('Empath: evil among the nearest alive neighbours', () => {
		const { game: g, seats } = game(['imp', 'chef', 'empath', 'slayer', 'poisoner'], (s) => ({
			type: 'SetDead',
			seatId: s[3],
			dead: true
		}));
		const picker = infoPicker(g, seats[2], 'empath', characters)!;
		expect(picker.options).toEqual([{ seats: [], number: 1 }]);
	});

	it('Fortune Teller: yes for the Demon or the red herring', () => {
		const { game: g, seats } = game(
			['fortuneteller', 'chef', 'imp', 'slayer', 'poisoner'],
			(s) => ({
				type: 'AddReminder',
				seatId: s[1],
				reminder: { characterId: 'fortuneteller', label: 'Red Herring' }
			})
		);
		const picker = infoPicker(g, seats[0], 'fortuneteller', characters)!;
		expect(isTruthful(picker, { seats: [seats[3], seats[2]], yes: true })).toBe(true);
		expect(isTruthful(picker, { seats: [seats[1], seats[4]], yes: true })).toBe(true);
		expect(isTruthful(picker, { seats: [seats[3], seats[4]], yes: false })).toBe(true);
		expect(isTruthful(picker, { seats: [seats[3], seats[4]], yes: true })).toBe(false);
	});

	it('Steward: one good player; Noble: three players with exactly one evil', () => {
		const { game: g, seats } = game(['steward', 'noble', 'imp', 'slayer', 'poisoner', 'chef']);
		const steward = infoPicker(g, seats[0], 'steward', characters)!;
		expect(steward.options.map((o) => o.seats[0])).toEqual([seats[1], seats[3], seats[5]]);
		const noble = infoPicker(g, seats[1], 'noble', characters)!;
		expect(isTruthful(noble, { seats: [seats[2], seats[3], seats[5]] })).toBe(true);
		expect(isTruthful(noble, { seats: [seats[2], seats[4], seats[5]] })).toBe(false);
		const record = infoRecord(
			noble,
			{ seats: [seats[2], seats[3], seats[5]] },
			{ seat: (s) => s, character: (id) => id },
			g,
			characters
		);
		expect(record.reminders.map((r) => r.reminder.label)).toEqual(['Know', 'Know', 'Know']);
	});

	it('with a Vortox, only false information is allowed', () => {
		const { game: g, seats } = game(['washerwoman', 'slayer', 'vortox', 'witch', 'savant']);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(picker.mustBeFalse).toBe(true);
		const truth = { seats: [seats[1], seats[2]], characterId: 'slayer' };
		expect(isAllowed(picker, truth)).toBe(false);
		expect(isAllowed(picker, { ...truth, characterId: 'savant' })).toBe(true);
	});

	it('covers only the first-night information characters', () => {
		const { game: g, seats } = game(['gossip', 'imp', 'chef']);
		expect(infoPicker(g, seats[0], 'gossip', characters)).toBeUndefined();
	});
});

describe('withNightInfo', () => {
	it('adds answers and pickers to the matching night-order steps only', () => {
		const data = committedGameData();
		const { game: g, seats } = game(
			['towncrier', 'washerwoman', 'undertaker', 'witch', 'imp', 'chef', 'monk'],
			(s) => ({ type: 'Nominate', nominator: s[3], nominee: s[0] })
		);
		const inPlay = g.seating.map((s) => data.byId.get(g.seats[s].characterId!)!);
		const other = withNightInfo(
			nightOrder({ night: 'other', sheet: data.nightSheet, inPlay, players: 7 }).steps,
			g,
			characters
		);
		const crier = other.find((s) => s.id === 'towncrier')!;
		expect(crier.info).toMatchObject({
			kind: 'answer',
			answers: [{ seatId: seats[0], value: true }]
		});
		expect(other.find((s) => s.id === 'undertaker')!.info).toMatchObject({
			kind: 'answer',
			answers: [{ kind: 'none' }]
		});
		expect(other.find((s) => s.id === 'monk')!.info).toBeUndefined();
		expect(other.find((s) => s.id === 'dusk')!.info).toBeUndefined();
		const first = withNightInfo(
			nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 7 }).steps,
			g,
			characters
		);
		expect(first.find((s) => s.id === 'washerwoman')!.info).toMatchObject({
			kind: 'picker',
			pickers: [{ seatId: seats[1], kind: 'pair-character' }]
		});
		expect(first.find((s) => s.id === 'chef')!.info).toMatchObject({ kind: 'picker' });
	});
});

const add =
	(i: number, characterId: string, label: string) =>
	(s: string[]): Command => ({
		type: 'AddReminder',
		seatId: s[i],
		reminder: { characterId, label }
	});

describe('registration ranges', () => {
	// https://wiki.bloodontheclocktower.com/Chef and /Recluse: the Recluse might register as
	// evil, so the Chef may be told either number.
	it('Chef: the true number and every number a Recluse or Spy allows', () => {
		// Poisoner, Imp, Recluse in a row: 1 true pair, 2 if the Recluse registers evil.
		const { game: g, seats } = game(['chef', 'poisoner', 'imp', 'recluse', 'slayer']);
		const picker = infoPicker(g, seats[0], 'chef', characters)!;
		expect(picker.range).toEqual({ truth: 1, possible: [1, 2] });
		expect(isTruthful(picker, { seats: [], number: 1 })).toBe(true);
		expect(isTruthful(picker, { seats: [], number: 2 })).toBe(false);
		expect(isAllowed(picker, { seats: [], number: 2 })).toBe(true);
		expect(isAllowed(picker, { seats: [], number: 0 })).toBe(false);
		// https://wiki.bloodontheclocktower.com/Spy: might register as good, breaking a pair.
		const spy = game(['chef', 'spy', 'imp', 'slayer', 'monk']);
		expect(infoPicker(spy.game, spy.seats[0], 'chef', characters)!.range).toEqual({
			truth: 1,
			possible: [0, 1]
		});
	});

	it('Chef: no range when nobody may misregister, or when the Recluse is poisoned', () => {
		const { game: g, seats } = game(
			['chef', 'poisoner', 'imp', 'recluse', 'slayer'],
			add(3, 'poisoner', 'Poisoned')
		);
		expect(infoPicker(g, seats[0], 'chef', characters)!.range).toEqual({
			truth: 1,
			possible: [1]
		});
	});

	// https://wiki.bloodontheclocktower.com/Lycanthrope: the Faux Paw player registers as
	// evil, so the true answer counts them as evil.
	it('Chef: the Faux Paw player counts as evil in the true answer', () => {
		const { game: g, seats } = game(
			['chef', 'lycanthrope', 'slayer', 'imp', 'monk'],
			add(2, 'lycanthrope', 'Faux Paw')
		);
		expect(infoPicker(g, seats[0], 'chef', characters)!.range).toEqual({
			truth: 1,
			possible: [1]
		});
	});

	// https://wiki.bloodontheclocktower.com/Empath
	it('Empath: a Recluse neighbour may count as evil', () => {
		const { game: g, seats } = game(['recluse', 'empath', 'slayer', 'imp', 'monk']);
		expect(infoPicker(g, seats[1], 'empath', characters)!.range).toEqual({
			truth: 0,
			possible: [0, 1]
		});
	});

	// https://wiki.bloodontheclocktower.com/Clockmaker
	it('Clockmaker: steps from the Demon to the nearest Minion, and what a Recluse allows', () => {
		const { game: g, seats } = game(['clockmaker', 'imp', 'recluse', 'slayer', 'poisoner']);
		// Imp at 1, Poisoner at 4: 2 steps round the circle; the Recluse at 2 as a Minion: 1;
		// the Recluse as the Demon: 2 steps to the Poisoner.
		expect(infoPicker(g, seats[0], 'clockmaker', characters)!.range).toEqual({
			truth: 2,
			possible: [1, 2]
		});
	});

	// https://wiki.bloodontheclocktower.com/Investigator and /Recluse
	it('Investigator: the Recluse may be shown as any Minion on the script', () => {
		const { game: g, seats } = game(['investigator', 'recluse', 'imp', 'poisoner', 'chef']);
		const picker = infoPicker(g, seats[0], 'investigator', characters)!;
		const choice = { seats: [seats[1], seats[4]], characterId: 'baron' };
		expect(isTruthful(picker, choice)).toBe(false);
		expect(isAllowed(picker, choice)).toBe(true);
		expect(abnormalCauses(picker, choice)).toEqual([
			{ reason: 'registration', characterId: 'recluse', seatId: seats[1] }
		]);
		// Not a character type the Recluse can register as.
		expect(isAllowed(picker, { ...choice, characterId: 'chef' })).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Washerwoman and /Spy
	it('Washerwoman: the Spy may be shown as a Townsfolk', () => {
		const { game: g, seats } = game(['washerwoman', 'spy', 'imp', 'chef', 'monk']);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(isAllowed(picker, { seats: [seats[1], seats[2]], characterId: 'slayer' })).toBe(true);
		expect(isTruthful(picker, { seats: [seats[3], seats[2]], characterId: 'chef' })).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Noble and /Steward
	it('Noble and Steward: a Spy may register as good', () => {
		const { game: g, seats } = game(['noble', 'spy', 'imp', 'chef', 'monk', 'steward']);
		const noble = infoPicker(g, seats[0], 'noble', characters)!;
		// Spy, Imp and Chef: two evil, unless the Spy registers as good.
		const trio = { seats: [seats[1], seats[2], seats[3]] };
		expect(isTruthful(noble, trio)).toBe(false);
		expect(isAllowed(noble, trio)).toBe(true);
		const steward = infoPicker(g, seats[5], 'steward', characters)!;
		expect(isAllowed(steward, { seats: [seats[1]] })).toBe(true);
		expect(isAllowed(steward, { seats: [seats[2]] })).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Fortune_Teller and /Recluse
	it('Fortune Teller: a Recluse may register as the Demon', () => {
		const { game: g, seats } = game(['fortuneteller', 'recluse', 'imp', 'chef', 'monk']);
		const picker = infoPicker(g, seats[0], 'fortuneteller', characters)!;
		expect(isTruthful(picker, { seats: [seats[1], seats[3]], yes: false })).toBe(true);
		expect(isAllowed(picker, { seats: [seats[1], seats[3]], yes: true })).toBe(true);
		expect(isAllowed(picker, { seats: [seats[3], seats[4]], yes: true })).toBe(false);
	});

	// https://wiki.bloodontheclocktower.com/Oracle and /Town_Crier
	it('Oracle and Town Crier answers list what registration allows', () => {
		const oracle = game(['oracle', 'recluse', 'imp', 'chef', 'witch'], (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true
		}));
		expect(answerOf(oracle.game, oracle.seats[0], 'oracle', characters)).toMatchObject({
			value: 0,
			possible: [
				{ kind: 'number', value: 0 },
				{ kind: 'number', value: 1 }
			]
		});
		const crier = game(['towncrier', 'recluse', 'imp', 'chef', 'witch'], (s) => ({
			type: 'Nominate',
			nominator: s[1],
			nominee: s[3]
		}));
		expect(answerOf(crier.game, crier.seats[0], 'towncrier', characters)).toMatchObject({
			value: false,
			possible: [
				{ kind: 'yes-no', value: false },
				{ kind: 'yes-no', value: true }
			]
		});
	});
});

// Trevor, 2026-10-17: offer a misregistration only when it could change the information,
// and show the logic behind each suggestion.
describe('relevant misregistration and why', () => {
	// https://wiki.bloodontheclocktower.com/Empath: only the alive neighbours count.
	it('Empath: a Recluse who is not a neighbour is not offered', () => {
		const far = game(['empath', 'slayer', 'recluse', 'imp', 'monk']);
		const p = infoPicker(far.game, far.seats[0], 'empath', characters)!;
		expect(p.misregister).toEqual([]);
		expect(p.why.alternatives).toEqual([]);
		expect(p.why.facts.map((f) => [f.seatId, f.characterId, f.alignment])).toEqual([
			[far.seats[4], 'monk', 'good'],
			[far.seats[1], 'slayer', 'good']
		]);
		const near = game(['empath', 'recluse', 'slayer', 'imp', 'monk']);
		const q = infoPicker(near.game, near.seats[0], 'empath', characters)!;
		expect(q.misregister).toEqual([near.seats[1]]);
		expect(q.why.alternatives).toEqual([
			{
				seatId: near.seats[1],
				source: 'recluse',
				as: expect.arrayContaining([
					{ alignment: 'evil', type: 'outsider', value: { kind: 'number', value: 1 } }
				])
			}
		]);
	});

	// https://wiki.bloodontheclocktower.com/Empath: a dead player in between is skipped, so
	// a dead Recluse is not a neighbour.
	it('Empath: a dead Recluse between neighbours is not offered', () => {
		const { game: g, seats } = game(['empath', 'recluse', 'slayer', 'imp', 'monk'], (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true
		}));
		expect(infoPicker(g, seats[0], 'empath', characters)!.misregister).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Chef: only pairs of neighbours count, so a
	// Recluse with no evil neighbour changes nothing.
	it('Chef: a Recluse matters only beside an evil player', () => {
		const lone = game(['chef', 'recluse', 'slayer', 'imp', 'poisoner']);
		expect(infoPicker(lone.game, lone.seats[0], 'chef', characters)!.misregister).toEqual([]);
		const beside = game(['chef', 'slayer', 'recluse', 'imp', 'poisoner']);
		const p = infoPicker(beside.game, beside.seats[0], 'chef', characters)!;
		expect(p.misregister).toEqual([beside.seats[2]]);
		expect(p.why.facts.map((f) => f.seatId)).toEqual([beside.seats[3], beside.seats[4]]);
	});

	// https://wiki.bloodontheclocktower.com/Undertaker: only the executed player matters.
	it('Undertaker: only the executed player is relevant', () => {
		const { game: g, seats } = game(['undertaker', 'spy', 'recluse', 'imp', 'chef'], (s) => ({
			type: 'Execute',
			seatId: s[2]
		}));
		const a = answerOf(g, seats[0], 'undertaker', characters);
		expect(a.misregister).toEqual([seats[2]]);
		expect(a.why.facts.map((f) => [f.seatId, f.characterId, f.dead])).toEqual([
			[seats[2], 'recluse', true]
		]);
	});

	// https://wiki.bloodontheclocktower.com/Oracle: only dead players count.
	it('Oracle: only dead players who may misregister are relevant', () => {
		const { game: g, seats } = game(['oracle', 'spy', 'recluse', 'imp', 'chef'], (s) => ({
			type: 'SetDead',
			seatId: s[2],
			dead: true
		}));
		const a = answerOf(g, seats[0], 'oracle', characters);
		expect(a.misregister).toEqual([seats[2]]);
		expect(a.why.facts.map((f) => f.seatId)).toEqual([seats[2]]);
		expect(a.why.alternatives[0].as.map((x) => x.value)).toContainEqual({
			kind: 'number',
			value: 1
		});
	});

	// https://wiki.bloodontheclocktower.com/Fortune_Teller: the Demon and the red herring.
	it('Fortune Teller: the logic names the Demon and the red herring', () => {
		const { game: g, seats } = game(
			['fortuneteller', 'imp', 'slayer', 'monk', 'poisoner'],
			add(3, 'fortuneteller', 'Red Herring')
		);
		const p = infoPicker(g, seats[0], 'fortuneteller', characters)!;
		expect(p.why.facts.map((f) => [f.seatId, f.type, f.redHerring ?? false])).toEqual([
			[seats[1], 'demon', false],
			[seats[3], 'townsfolk', true]
		]);
	});

	// https://wiki.bloodontheclocktower.com/Mathematician: registration isn't its input.
	it('Mathematician: nobody is offered as misregistering', () => {
		const { game: g, seats } = game(['mathematician', 'spy', 'recluse', 'imp', 'chef']);
		expect(answerOf(g, seats[0], 'mathematician', characters).misregister).toEqual([]);
	});
});

// https://wiki.bloodontheclocktower.com/Mathematician: the number of players whose
// ability worked abnormally; the Storyteller marks each with an Abnormal reminder.
describe('Mathematician Abnormal reminders', () => {
	it('counts the players carrying Abnormal once any are placed', () => {
		const { game: g, seats } = game(
			['mathematician', 'chef', 'empath', 'imp', 'monk'],
			add(1, 'mathematician', 'Abnormal'),
			add(2, 'mathematician', 'Abnormal')
		);
		const a = answerOf(g, seats[0], 'mathematician', characters);
		expect(a).toMatchObject({ kind: 'number', value: 2, because: [seats[1], seats[2]] });
		expect(a.why.facts.map((f) => [f.seatId, f.characterId])).toEqual([
			[seats[1], 'chef'],
			[seats[2], 'empath']
		]);
	});

	it('counts recorded abnormal info while no Abnormal reminder is placed', () => {
		const { game: g, seats } = game(['mathematician', 'chef', 'imp']);
		expect(answerOf(g, seats[0], 'mathematician', characters)).toMatchObject({
			value: 0,
			because: []
		});
	});
});

describe('impaired info', () => {
	// https://wiki.bloodontheclocktower.com/Undertaker and /Glossary: a poisoned Undertaker
	// may be shown anything, but the true answer is still worked out.
	it('Undertaker: the true answer, and any answer allowed, naming the poisoner', () => {
		const { game: g, seats } = game(
			['undertaker', 'chef', 'poisoner', 'imp'],
			add(0, 'poisoner', 'Poisoned'),
			(s) => ({ type: 'Execute', seatId: s[1] })
		);
		expect(answerOf(g, seats[0], 'undertaker', characters)).toMatchObject({
			kind: 'character',
			value: 'chef',
			unreliable: 'poisoned',
			impairments: [{ reason: 'poisoned', source: { characterId: 'poisoner', seatId: seats[2] } }]
		});
	});

	// https://wiki.bloodontheclocktower.com/Preacher: the chosen Minion has no ability.
	it('a Minion the Preacher chose: impaired info, and the step says so', () => {
		const data = committedGameData();
		const { game: g, seats } = game(
			['preacher', 'widow', 'imp', 'chef', 'monk'],
			add(1, 'preacher', 'No Ability')
		);
		const inPlay = g.seating.map((s) => data.byId.get(g.seats[s].characterId!)!);
		const steps = withNightInfo(
			nightOrder({ night: 'first', sheet: data.nightSheet, inPlay, players: 7 }).steps,
			g,
			characters
		);
		expect(steps.find((s) => s.id === 'widow')!.impaired).toMatchObject([
			{ seatId: seats[1], impairments: [{ reason: 'no-ability', source: { seatId: seats[0] } }] }
		]);
		expect(steps.find((s) => s.id === 'chef')!.impaired).toBeUndefined();
	});
});

describe('Mathematician', () => {
	// https://wiki.bloodontheclocktower.com/Mathematician: info that is false because of
	// another character's ability counts; true info from a poisoned player does not.
	it('counts recorded abnormal info since dawn, and lists who and why', () => {
		const { session, ctx, seats } = game(
			['mathematician', 'chef', 'poisoner', 'imp', 'recluse', 'empath'],
			add(5, 'poisoner', 'Poisoned')
		);
		const g0 = session.game;
		const empath = infoPicker(g0, seats[5], 'empath', characters)!;
		const chef = infoPicker(g0, seats[1], 'chef', characters)!;
		const name = { seat: (s: string) => s, character: (id: string) => id };
		// The poisoned Empath is told the truth: not abnormal.
		const truthful = infoRecord(
			empath,
			{ seats: [], number: empath.range!.truth },
			name,
			g0,
			characters
		);
		expect(truthful.abnormal).toBeUndefined();
		// The Chef is told 2, because the Recluse registers as evil.
		const registered = infoRecord(chef, { seats: [], number: 2 }, name, g0, characters);
		expect(registered.abnormal).toEqual([
			{ reason: 'registration', characterId: 'recluse', seatId: seats[4] }
		]);
		const lie = infoRecord(empath, { seats: [], number: 2 }, name, g0, characters);
		const g = run(
			session,
			ctx,
			{ type: 'RecordNightInfo', seatId: seats[5], characterId: 'empath', ...truthful },
			{ type: 'RecordNightInfo', seatId: seats[1], characterId: 'chef', ...registered },
			{ type: 'RecordNightInfo', seatId: seats[5], characterId: 'empath', ...lie }
		).game;
		const a = answerOf(g, seats[0], 'mathematician', characters);
		expect(a).toMatchObject({ kind: 'number', value: 2, because: [seats[1], seats[5]] });
		expect(a.abnormal).toMatchObject([
			{ seatId: seats[1], characterId: 'chef', causes: [{ reason: 'registration' }] },
			{
				seatId: seats[5],
				characterId: 'empath',
				causes: [{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[2] }]
			}
		]);
		// A new day starts the count again.
		const next = run({ ...session, game: g }, ctx, { type: 'NewDay' }).game;
		expect(answerOf(next, seats[0], 'mathematician', characters)).toMatchObject({ value: 0 });
	});

	// https://wiki.bloodontheclocktower.com/Vortox: false info because of the Vortox counts.
	it('a Vortox makes false Townsfolk info abnormal', () => {
		const { game: g, seats } = game(['washerwoman', 'slayer', 'vortox', 'witch', 'savant']);
		const picker = infoPicker(g, seats[0], 'washerwoman', characters)!;
		expect(abnormalCauses(picker, { seats: [seats[1], seats[2]], characterId: 'savant' })).toEqual([
			{ reason: 'vortox', characterId: 'vortox', seatId: seats[2] }
		]);
		expect(abnormalCauses(picker, { seats: [seats[1], seats[2]], characterId: 'slayer' })).toEqual(
			[]
		);
	});

	it('does not count the Mathematician’s own ability', () => {
		const { game: g, seats } = game(['mathematician', 'chef', 'poisoner', 'imp'], (s) => ({
			type: 'RecordNightInfo',
			seatId: s[0],
			characterId: 'mathematician',
			text: 'Shown 3',
			abnormal: [{ reason: 'poisoned', characterId: 'poisoner', seatId: s[2] }]
		}));
		expect(abnormalSinceDawn(g)).toEqual([]);
		expect(answerOf(g, seats[0], 'mathematician', characters)).toMatchObject({ value: 0 });
	});

	it('free-text answers take their causes from the waking player', () => {
		const { game: g, seats } = game(
			['undertaker', 'chef', 'poisoner', 'imp'],
			add(0, 'poisoner', 'Poisoned')
		);
		expect(answerCauses(answerOf(g, seats[0], 'undertaker', characters))).toEqual([
			{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[2] }
		]);
	});
});

// Trevor (2026-10-18): never one suggestion; every valid piece of information, with why.
describe('every valid piece of information', () => {
	const tb = ['washerwoman', 'slayer', 'virgin', 'butler', 'poisoner', 'imp', 'chef'];

	it('Washerwoman: each Townsfolk with every player who may be shown beside them', () => {
		const { game: g, seats } = game(tb);
		const valid = validInformation(g, infoPicker(g, seats[0], 'washerwoman', characters)!);
		expect(valid.map((v) => v.characterIds)).toEqual([['slayer'], ['virgin'], ['chef']]);
		const slayer = valid[0];
		expect(slayer).toMatchObject({ reason: 'true', target: seats[1] });
		expect(slayer.seats).toHaveLength(5);
		expect(slayer.seats).not.toContain(seats[0]);
		expect(slayer.seats).not.toContain(seats[1]);
	});

	it('a poisoned Chef: the true number, then every other number, marked', () => {
		const { game: g, seats } = game(['poisoner', 'chef', 'baron', 'imp', 'scarletwoman'], (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		const valid = validInformation(g, infoPicker(g, seats[1], 'chef', characters)!);
		expect(valid[0]).toEqual({ reason: 'true', number: 3, seats: [] });
		expect(valid.slice(1).map((v) => [v.reason, v.number])).toEqual([
			['unreliable', 0],
			['unreliable', 1],
			['unreliable', 2],
			['unreliable', 4],
			['unreliable', 5]
		]);
	});

	it('a poisoned Washerwoman: the true pairs, and any other choice', () => {
		const { game: g, seats } = game(tb, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'poisoner', label: 'Poisoned' }
		}));
		const valid = validInformation(g, infoPicker(g, seats[0], 'washerwoman', characters)!);
		expect(valid.at(-1)).toEqual({ reason: 'unreliable', seats: [], anyOther: true });
		expect(valid.filter((v) => v.reason === 'true')).toHaveLength(3);
	});
});

// Homebrew characters built from the same rules as official ones: an Empath-like one learns
// its evil alive neighbours (https://wiki.bloodontheclocktower.com/Empath), an Oracle-like one
// the evil dead (https://wiki.bloodontheclocktower.com/Oracle).
describe('custom characters', () => {
	function custom(raw: Record<string, unknown>) {
		const issues = new Issues();
		const character = parseCharacter(raw, '[0]', issues, { strict: false, scriptFields: true });
		expect(issues.list).toEqual([]);
		return new Map([...characters, [character!.id, character!]]);
	}

	it('learn first-night information through their rules block', () => {
		const all = custom({
			id: 'heartreader',
			name: 'Heart Reader',
			team: 'townsfolk',
			ability: 'You start knowing how many of your 2 alive neighbours are evil.',
			rules: { learns: { measure: 'evil-alive-neighbours' } }
		});
		const { game: g, seats } = game(['chef', 'imp', 'poisoner']);
		const picker = infoPicker(g, seats[0], 'heartreader', all);
		expect(picker).toMatchObject({ kind: 'number', measure: 'evil-alive-neighbours' });
		expect(picker?.range?.truth).toBe(2);
		expect(infoPicker(g, seats[0], 'heartreader', characters)).toBeUndefined();
	});

	it('get a night answer through their rules block', () => {
		const all = custom({
			id: 'gravewatcher',
			name: 'Grave Watcher',
			team: 'townsfolk',
			ability: 'Each night*, you learn how many dead players are evil.',
			rules: { answers: { question: 'evil-dead' } }
		});
		const { game: g, seats } = game(['chef', 'imp', 'poisoner'], (s) => ({
			type: 'SetDead',
			seatId: s[1],
			dead: true
		}));
		expect(nightAnswer(g, seats[0], 'gravewatcher', all)).toMatchObject({
			kind: 'number',
			value: 1
		});
		expect(nightAnswer(g, seats[0], 'gravewatcher', characters)).toBeUndefined();
	});
});
