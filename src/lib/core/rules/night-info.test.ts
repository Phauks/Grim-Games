/**
 * Night info worked out from the grimoire and the day log. Each scenario paraphrases the
 * character's ability as its wiki page states it:
 * - https://wiki.bloodontheclocktower.com/Town_Crier
 * - https://wiki.bloodontheclocktower.com/Flowergirl
 * - https://wiki.bloodontheclocktower.com/Undertaker
 * - https://wiki.bloodontheclocktower.com/Juggler
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
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	abnormalCauses,
	abnormalSinceDawn,
	answerCauses,
	flowergirlAnswer,
	infoPicker,
	mathematicianAnswer,
	infoRecord,
	isAllowed,
	isTruthful,
	jugglerAnswer,
	oracleAnswer,
	townCrierAnswer,
	truthfulFirst,
	undertakerAnswer,
	withNightInfo
} from './night-info.ts';
import { nightOrder } from './night-order.ts';

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
		expect(townCrierAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(townCrierAnswer(g, seats[0], characters)).toMatchObject({ value: false, because: [] });
	});

	it('reads the current day log only: after New day it is no again', () => {
		const { session, ctx, seats } = game(snv, (s) => ({
			type: 'Nominate',
			nominator: s[4],
			nominee: s[0]
		}));
		const next = run(session, ctx, { type: 'NewDay' });
		expect(townCrierAnswer(next.game, seats[0], characters)).toMatchObject({ value: false });
	});

	it('is unreliable while the Town Crier is poisoned', () => {
		const { game: g, seats } = game(snv, (s) => ({
			type: 'AddReminder',
			seatId: s[0],
			reminder: { characterId: 'nodashii', label: 'Poisoned' }
		}));
		expect(townCrierAnswer(g, seats[0], characters).unreliable).toBe('poisoned');
	});

	it('must be false with a Vortox in play', () => {
		const cast = snv.map((id) => (id === 'nodashii' ? 'vortox' : id));
		const { game: g, seats } = game(cast);
		expect(townCrierAnswer(g, seats[0], characters).mustBeFalse).toBe(true);
	});

	it('flags a Spy or Recluse, who might register as something else', () => {
		const { game: g, seats } = game(['towncrier', 'spy', 'recluse', 'imp', 'chef']);
		expect(townCrierAnswer(g, seats[0], characters).misregister).toEqual([seats[1], seats[2]]);
	});

	it('shows what the Storyteller recorded, as their override', () => {
		const { game: g, seats } = game(snv, (s) => ({
			type: 'RecordNightInfo',
			seatId: s[0],
			characterId: 'towncrier',
			text: 'Shown no'
		}));
		expect(townCrierAnswer(g, seats[0], characters).shown).toMatchObject({ text: 'Shown no' });
	});
});

describe('Flowergirl', () => {
	it('has no answer until the Storyteller marks whether the Demon voted', () => {
		const { game: g, seats } = game(snv);
		expect(flowergirlAnswer(g, seats[1], characters).kind).toBe('none');
	});

	it('hears yes when the Demon voted, and no when it did not', () => {
		const voted = game(snv, () => ({ type: 'SetDemonVoted', voted: true }));
		expect(flowergirlAnswer(voted.game, voted.seats[1], characters)).toMatchObject({
			kind: 'yes-no',
			value: true,
			because: [voted.seats[5]]
		});
		const not = game(snv, () => ({ type: 'SetDemonVoted', voted: false }));
		expect(flowergirlAnswer(not.game, not.seats[1], characters)).toMatchObject({ value: false });
	});
});

describe('Undertaker', () => {
	const tb = ['undertaker', 'washerwoman', 'slayer', 'virgin', 'poisoner', 'imp', 'butler'];

	it('learns the character of the player executed today', () => {
		const { game: g, seats } = game(tb, (s) => ({ type: 'Execute', seatId: s[4] }));
		expect(undertakerAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(undertakerAnswer(g, seats[0], characters)).toMatchObject({ value: 'drunk' });
	});

	it('learns nothing when the executed player did not die by it', () => {
		const { game: g, seats } = game(
			tb,
			(s) => ({ type: 'SetDead', seatId: s[2], dead: true }),
			(s) => ({ type: 'Execute', seatId: s[2] })
		);
		expect(undertakerAnswer(g, seats[0], characters).kind).toBe('none');
	});

	it('learns nothing once the execution is removed from the log', () => {
		const { session, ctx, seats } = game(tb, (s) => ({ type: 'Execute', seatId: s[4] }));
		const removed = run(session, ctx, {
			type: 'RemoveDayEntry',
			entryId: session.game.today.entries[0].entryId
		});
		expect(undertakerAnswer(removed.game, seats[0], characters).kind).toBe('none');
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
		expect(undertakerAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(undertakerAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(undertakerAnswer(g, seats[0], characters).kind).toBe('none');
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
		expect(jugglerAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(jugglerAnswer(g, seats[0], characters)).toMatchObject({ value: 1 });
	});

	it('has no answer with no guesses logged', () => {
		const { game: g, seats } = game(['juggler', 'witch', 'nodashii']);
		expect(jugglerAnswer(g, seats[0], characters).kind).toBe('none');
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
		expect(oracleAnswer(g, seats[0], characters)).toMatchObject({
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
		expect(oracleAnswer(oracle.game, oracle.seats[0], characters)).toMatchObject({
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
		expect(townCrierAnswer(crier.game, crier.seats[0], characters)).toMatchObject({
			value: false,
			possible: [
				{ kind: 'yes-no', value: false },
				{ kind: 'yes-no', value: true }
			]
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
		expect(undertakerAnswer(g, seats[0], characters)).toMatchObject({
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
		const a = mathematicianAnswer(g, seats[0], characters);
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
		expect(mathematicianAnswer(next, seats[0], characters)).toMatchObject({ value: 0 });
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
		expect(mathematicianAnswer(g, seats[0], characters)).toMatchObject({ value: 0 });
	});

	it('free-text answers take their causes from the waking player', () => {
		const { game: g, seats } = game(
			['undertaker', 'chef', 'poisoner', 'imp'],
			add(0, 'poisoner', 'Poisoned')
		);
		expect(answerCauses(undertakerAnswer(g, seats[0], characters))).toEqual([
			{ reason: 'poisoned', characterId: 'poisoner', seatId: seats[2] }
		]);
	});
});
