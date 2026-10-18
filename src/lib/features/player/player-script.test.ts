import { describe, expect, it } from 'vitest';
import { editionScript } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import {
	groupByType,
	playerJinxes,
	playerNight,
	scriptVersion,
	sheetCharacters
} from './player-script.ts';

const data = committedGameData();
const tb = editionScript('tb', data)!;

describe('player script view', () => {
	it('groups Trouble Brewing as on its character sheet', () => {
		// https://wiki.bloodontheclocktower.com/Trouble_Brewing: 13 Townsfolk, 4 Outsiders, 4 Minions, 1 Demon.
		expect(groupByType(tb.characters).map((g) => [g.type, g.characters.length])).toEqual([
			['townsfolk', 13],
			['outsider', 4],
			['minion', 4],
			['demon', 1]
		]);
	});

	it("adds an edition's recommended Travellers to its sheet", () => {
		// https://wiki.bloodontheclocktower.com/Trouble_Brewing: Scapegoat, Gunslinger, Beggar,
		// Bureaucrat and Thief are its Travellers.
		const travellers = groupByType(sheetCharacters(tb, data)).find((g) => g.type === 'traveller');
		expect(travellers?.characters.map((c) => c.id).sort()).toEqual(
			['beggar', 'bureaucrat', 'gunslinger', 'scapegoat', 'thief'].sort()
		);
		const custom = { ...tb, edition: undefined, characters: tb.characters.slice(0, 3) };
		expect(sheetCharacters(custom, data)).toEqual(custom.characters);
	});

	// https://wiki.bloodontheclocktower.com/Bootlegger; the World Cup 2025 scripts carry their
	// rule as `_meta.bootlegger` (https://botc-script-viewer.sthom.kiwi/wc25/).
	it("shows the script's rules on the Bootlegger, adding it when the script doesn't list it", () => {
		const meta = { ...tb.meta, bootlegger: ['A made-up rule.'] };
		const custom = { ...tb, edition: undefined, meta, characters: tb.characters.slice(0, 3) };
		const shown = sheetCharacters(custom, data);
		expect(shown.slice(0, 3)).toEqual(custom.characters);
		expect(shown[3]).toMatchObject({ id: 'bootlegger', type: 'loric', ability: 'A made-up rule.' });
		const listed = { ...custom, characters: [...custom.characters, data.byId.get('bootlegger')!] };
		expect(sheetCharacters(listed, data).filter((c) => c.id === 'bootlegger')).toHaveLength(1);
	});

	it('lists the night order as names only, with Minion and Demon info on the first night', () => {
		const first = playerNight(tb, data, 'first');
		const ids = first.entries.map((e) => (e.kind === 'marker' ? e.id : e.character.id));
		expect(ids[0]).toBe('dusk');
		expect(ids.at(-1)).toBe('dawn');
		expect(ids.indexOf('minioninfo')).toBeLessThan(ids.indexOf('demoninfo'));
		expect(ids).toContain('poisoner');
		expect(ids).not.toContain('imp');
		const other = playerNight(tb, data, 'other');
		expect(other.entries.some((e) => e.kind === 'character' && e.character.id === 'imp')).toBe(
			true
		);
	});

	it('has no jinxes on Trouble Brewing, and finds them on a script that has a pair', () => {
		expect(playerJinxes(tb, data)).toEqual([]);
		const pair = { ...tb, characters: [data.byId.get('spy')!, data.byId.get('heretic')!] };
		expect(playerJinxes(pair, data)).toHaveLength(1);
	});
});

describe('scriptVersion', () => {
	it('is the BotC Scripts version, and nothing for other sources or a blank version', () => {
		expect(scriptVersion({ source: { kind: 'botcscripts', version: '1.2' } })).toBe('1.2');
		expect(scriptVersion({ source: { kind: 'botcscripts', version: '' } })).toBeUndefined();
		expect(scriptVersion({ source: { kind: 'edition' } })).toBeUndefined();
		expect(scriptVersion(undefined)).toBeUndefined();
		// A built script's own version (Trevor, 2026-10-18).
		expect(scriptVersion({ source: { kind: 'built' } }, { version: '1.2' })).toBe('1.2');
		expect(scriptVersion({ source: { kind: 'botcscripts', version: '3' } }, { version: '1' })).toBe(
			'3'
		);
		expect(scriptVersion(undefined, { version: ' ' })).toBeUndefined();
	});
});
