/**
 * Info pickers for the Shugenja, Village Idiot and Balloonist, each from its `learns` rule.
 * Each scenario paraphrases the ability as its wiki page states it:
 * - https://wiki.bloodontheclocktower.com/Shugenja (the closest evil player's direction;
 *   either when the nearest each way are as close)
 * - https://wiki.bloodontheclocktower.com/Village_Idiot (a chosen player's alignment)
 * - https://wiki.bloodontheclocktower.com/Balloonist (a player of a different character type
 *   than last time; any player the first time)
 */
import { describe, expect, it } from 'vitest';
import {
	castGame,
	castWith,
	run,
	testCharacters as characters
} from '#lib/core/model/fixtures.test-support.ts';
import { parseCharacter } from '#lib/core/data/parse.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { infoPicker, infoRecord, isAllowed } from '../night-info.ts';
import { yesNoAnswers } from './yes-no.ts';

const name = { seat: (s: string) => s, character: (id: string) => id };

describe('Shugenja', () => {
	it('learns anticlockwise when the closest evil player sits that way', () => {
		// Evil at seats 2 (2 steps clockwise) and 5 (1 step anticlockwise).
		const { game: g, seats } = castGame([
			'shugenja',
			'chef',
			'imp',
			'empath',
			'butler',
			'poisoner'
		]);
		const picker = infoPicker(g, seats[0], 'shugenja', characters)!;
		expect(picker).toMatchObject({ kind: 'yes-no', seatCount: 0, answer: 'direction' });
		expect(yesNoAnswers(g, picker, []).map((a) => [a.yes, a.reason])).toEqual([[false, 'true']]);
		expect(infoRecord(picker, { seats: [], yes: false }, name, g, characters).text).toBe(
			'Shown anticlockwise'
		);
	});

	it('may learn either way when the nearest evil players are as close', () => {
		const { game: g, seats } = castGame(['shugenja', 'imp', 'chef', 'empath', 'poisoner']);
		const picker = infoPicker(g, seats[0], 'shugenja', characters)!;
		expect(yesNoAnswers(g, picker, []).map((a) => a.yes)).toEqual([true, false]);
	});
});

describe('Village Idiot', () => {
	it('learns the alignment of the player chosen', () => {
		const { game: g, seats } = castGame(['villageidiot', 'chef', 'imp', 'empath', 'butler']);
		const picker = infoPicker(g, seats[0], 'villageidiot', characters)!;
		expect(picker).toMatchObject({ kind: 'yes-no', seatCount: 1, answer: 'alignment' });
		expect(yesNoAnswers(g, picker, [seats[2]]).map((a) => a.yes)).toEqual([true]);
		expect(yesNoAnswers(g, picker, [seats[1]]).map((a) => a.yes)).toEqual([false]);
		expect(infoRecord(picker, { seats: [seats[2]], yes: true }, name, g, characters).text).toBe(
			`Chose ${seats[2]}: shown evil`
		);
	});
});

describe('Balloonist', () => {
	const cast = ['balloonist', 'chef', 'imp', 'butler', 'poisoner'];

	it('may be shown any other player the first time', () => {
		const { game: g, seats } = castGame(cast);
		const picker = infoPicker(g, seats[0], 'balloonist', characters)!;
		expect(picker).toMatchObject({ kind: 'players', seatCount: 1, reminders: { each: 'Know' } });
		expect(picker.options.map((o) => o.seats[0])).toEqual(seats.slice(1));
	});

	it('is then shown a different character type than the player marked last time', () => {
		const { game: g, seats } = castGame(cast, (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'balloonist', label: 'Know' }
		}));
		const picker = infoPicker(g, seats[0], 'balloonist', characters)!;
		// The Chef was shown: no Townsfolk now.
		expect(picker.options.map((o) => o.seats[0])).toEqual([seats[2], seats[3], seats[4]]);
		expect(isAllowed(picker, { seats: [seats[1]] })).toBe(false);
	});

	it('follows the token its latest recorded info placed', () => {
		const first = castGame(cast, (s) => ({
			type: 'AddReminder',
			seatId: s[1],
			reminder: { characterId: 'balloonist', label: 'Know' }
		}));
		const { seats } = first;
		const picker = infoPicker(first.game, seats[0], 'balloonist', characters)!;
		const record = infoRecord(picker, { seats: [seats[3]] }, name, first.game, characters);
		const next = run(first.session, first.ctx, {
			type: 'RecordNightInfo',
			seatId: seats[0],
			characterId: 'balloonist',
			...record
		});
		// The Butler, an Outsider, was shown last: the Chef may be shown again, the Butler not.
		const after = infoPicker(next.game, seats[0], 'balloonist', characters)!;
		expect(after.options.map((o) => o.seats[0])).toEqual([seats[1], seats[2], seats[4]]);
	});
});

describe('a custom character', () => {
	it('learns a chosen player’s alignment through its rules block', () => {
		const issues = new Issues();
		const seer = parseCharacter(
			{
				id: 'truthseer',
				name: 'Truth Seer',
				team: 'townsfolk',
				ability: 'Each night, choose a player: you learn their alignment.',
				rules: { learns: { measure: 'chosen-alignment' } }
			},
			'[0]',
			issues,
			{ strict: false, scriptFields: true }
		)!;
		expect(issues.list).toEqual([]);
		const all = new Map([...characters, [seer.id, seer]]);
		const { game: g, seats } = castWith({ characters: all })([seer.id, 'chef', 'imp']);
		const picker = infoPicker(g, seats[0], seer.id, all)!;
		expect(yesNoAnswers(g, picker, [seats[2]]).map((a) => a.yes)).toEqual([true]);
	});
});
