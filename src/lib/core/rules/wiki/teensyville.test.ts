/**
 * Rules suite for https://wiki.bloodontheclocktower.com/Teensyville
 *
 * Teensyville scripts are for 5 or 6 players and their sheet has six Townsfolk, two
 * Outsiders, two Minions and two Demons, from any edition. The page is silent on evil
 * info; that rule is from https://wiki.bloodontheclocktower.com/Glossary (Minion Info and
 * Demon Info need 7 or more players) and https://wiki.bloodontheclocktower.com/Toymaker.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import { analyseSetup } from '../setup.ts';
import { nightOrder } from '../night-order.ts';
import {
	EVIL_INFO_MIN_PLAYERS,
	hasEvilTeamInfo,
	isTeensyvilleScript,
	scriptMaxPlayers,
	sheetCounts,
	TEENSYVILLE_SHEET,
	teensyvilleWarnings
} from '../teensyville.ts';

const data = committedGameData();
const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);

// A Teensyville-shaped sheet drawn from several editions.
const teensy = get(
	'washerwoman',
	'chef',
	'empath',
	'clockmaker',
	'slayer',
	'pixie',
	'drunk',
	'mutant',
	'poisoner',
	'witch',
	'imp',
	'nodashii'
);

describe('Teensyville sheets', () => {
	it('have 6 Townsfolk, 2 Outsiders, 2 Minions and 2 Demons', () => {
		expect(TEENSYVILLE_SHEET).toEqual({ townsfolk: 6, outsider: 2, minion: 2, demon: 2 });
		expect(sheetCounts(teensy)).toEqual(TEENSYVILLE_SHEET);
		expect(isTeensyvilleScript(teensy)).toBe(true);
	});

	it('are not the base editions', () => {
		expect(isTeensyvilleScript(editionScript('tb', data)!.characters)).toBe(false);
	});

	it('advise against more than 6 players', () => {
		expect(teensyvilleWarnings(teensy, 6)).toEqual([]);
		expect(teensyvilleWarnings(teensy, 7)[0]).toContain('5 or 6 players');
	});

	it('are made for at most 6 players; other scripts name no limit', () => {
		expect(scriptMaxPlayers(teensy)).toBe(6);
		expect(scriptMaxPlayers(editionScript('tb', data)!.characters)).toBeUndefined();
	});

	it('deal the normal 5 and 6 player counts', () => {
		expect(
			analyseSetup({ players: 5, inPlay: get('washerwoman', 'chef', 'empath', 'poisoner', 'imp') })
				.warnings
		).toEqual([]);
		expect(
			analyseSetup({
				players: 6,
				// The Drunk has no token, so one more Townsfolk goes in the bag.
				inPlay: get('washerwoman', 'chef', 'empath', 'monk', 'drunk', 'poisoner', 'imp')
			}).warnings
		).toEqual([]);
	});
});

describe('no Minion or Demon info below 7 players', () => {
	it('applies at 5 and 6, not at 7', () => {
		expect(EVIL_INFO_MIN_PLAYERS).toBe(7);
		expect(hasEvilTeamInfo(5, [])).toBe(false);
		expect(hasEvilTeamInfo(6, get('imp'))).toBe(false);
		expect(hasEvilTeamInfo(7, [])).toBe(true);
	});

	it('is lifted by the Toymaker', () => {
		expect(hasEvilTeamInfo(5, get('toymaker'))).toBe(true);
	});

	it('is lifted by a custom character with the same rule', () => {
		const toy = {
			...data.byId.get('imp')!,
			id: 'clockwork',
			name: 'Clockwork',
			rules: { evilInfo: { anyPlayerCount: true as const } }
		};
		expect(hasEvilTeamInfo(5, [toy])).toBe(true);
	});

	it('removes the steps from the first night', () => {
		const first = nightOrder({
			night: 'first',
			sheet: data.nightSheet,
			inPlay: teensy,
			players: 6
		});
		expect(first.steps.map((s) => s.id)).not.toContain('minioninfo');
		expect(first.steps.map((s) => s.id)).not.toContain('demoninfo');
		expect(first.omitted.map((o) => o.id)).toEqual(['minioninfo', 'demoninfo']);
	});
});
