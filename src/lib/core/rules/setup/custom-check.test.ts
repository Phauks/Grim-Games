import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { loadScript, toScript } from '#lib/core/data/script.ts';
import type { Character } from '#lib/core/data/types.ts';
import { scriptWithCharacter } from './bag-characters.ts';
import { editedCharacter } from '#lib/core/rules/character-builder.ts';
import { checkKey, customCheck, ownCharacters, type CustomCheckInput } from './custom-check.ts';

const data = committedGameData();

const LAMPLIGHTER = {
	id: 'lamplighter',
	name: 'Lamplighter',
	team: 'townsfolk',
	ability: 'Each night*, choose a player: they are safe from the Demon tonight.',
	reminders: ['Lit'],
	otherNightReminder: 'The Lamplighter chooses a player.'
};
const BELLRINGER = {
	id: 'bellringer',
	name: 'Bellringer',
	team: 'townsfolk',
	ability: 'You start knowing how many pairs of evil players ring true. [+1 Outsider]',
	firstNightReminder: 'Show the Bellringer a number.'
};
const WHISPERER = {
	id: 'whisperer',
	name: 'Whisperer',
	team: 'minion',
	ability: 'Each day, if you are mad about a secret, you might be executed.',
	reminders: ['Secret']
};

function setup(json: unknown[]) {
	const loaded = loadScript(json, data).script!;
	const script = toScript(loaded);
	const own = (id: string) => loaded.characters.find((c) => c.id === id)!;
	const input = (inPlay: Character[]): CustomCheckInput => ({
		sheet: data.nightSheet,
		official: data.byId,
		inPlay,
		players: 8,
		script
	});
	return { loaded, script, own, input };
}

describe('ownCharacters', () => {
	it('keeps the script’s own characters once each, never an official one', () => {
		const { own } = setup([{ id: '_meta', name: 'T' }, LAMPLIGHTER, 'chef', 'imp']);
		const chef = data.byId.get('chef')!;
		const lamp = own('lamplighter');
		expect(ownCharacters([chef, lamp, lamp]).map((c) => c.id)).toEqual(['lamplighter']);
	});
});

describe('customCheck', () => {
	it('marks a night place found from the ability as a guess, after a step of this game', () => {
		const { own, input } = setup([{ id: '_meta', name: 'T' }, LAMPLIGHTER, 'chef', 'imp']);
		const lamp = own('lamplighter');
		const check = customCheck(lamp, input([lamp, data.byId.get('imp')!]));
		expect(check.first).toEqual({ wakes: false });
		expect(check.other).toMatchObject({ wakes: true, source: 'guessed' });
		expect(check.other.wakes && check.other.after).toBeTruthy();
	});

	it('says the night place comes from the script when its own night order lists it', () => {
		const { own, input } = setup([
			{ id: '_meta', name: 'T', otherNight: ['dusk', 'lamplighter', 'imp', 'dawn'] },
			LAMPLIGHTER,
			'imp'
		]);
		const lamp = own('lamplighter');
		const check = customCheck(lamp, input([lamp, data.byId.get('imp')!]));
		expect(check.other).toMatchObject({ wakes: true, after: { id: 'dusk' }, source: 'script' });
	});

	it('says the night place comes from the rules when the character has its own', () => {
		const { own, input } = setup([
			{ id: '_meta', name: 'T' },
			{ ...LAMPLIGHTER, rules: { nightOrder: { other: { after: 'monk' } } } },
			'monk',
			'imp'
		]);
		const lamp = own('lamplighter');
		const check = customCheck(lamp, input([lamp, data.byId.get('monk')!]));
		expect(check.other).toMatchObject({ wakes: true, after: { id: 'monk' }, source: 'rules' });
	});

	it('lists its tokens, with every seat and no setup tokens as guesses without rules', () => {
		const { own, input } = setup([{ id: '_meta', name: 'T' }, LAMPLIGHTER, 'imp']);
		const lamp = own('lamplighter');
		const check = customCheck(lamp, input([lamp]));
		expect(check.reminders).toEqual(['Lit']);
		expect(check.placedOn).toBe('guessed');
		expect(check.beforeGame).toBe('unknown');
	});

	it('has no token parts for a character without tokens', () => {
		const { own, input } = setup([{ id: '_meta', name: 'T' }, BELLRINGER, 'imp']);
		const bell = own('bellringer');
		const check = customCheck(bell, input([bell]));
		expect(check.placedOn).toBeUndefined();
		expect(check.beforeGame).toBeUndefined();
	});

	it('reads the setup change from [bracketed] text as a guess', () => {
		const { own, input } = setup([{ id: '_meta', name: 'T' }, BELLRINGER, 'imp']);
		const bell = own('bellringer');
		expect(customCheck(bell, input([bell])).setup).toEqual({
			summary: '+1 Outsider',
			source: 'guessed'
		});
	});

	it('lists the day reminders found in the ability as guesses', () => {
		const { own, input } = setup([{ id: '_meta', name: 'T' }, WHISPERER, 'imp']);
		const whisperer = own('whisperer');
		const check = customCheck(whisperer, input([whisperer]));
		expect(check.day.map((d) => d.text)).toContain('involves madness');
		expect(check.day.every((d) => d.source === 'guessed')).toBe(true);
		expect(check.guesses).toBeGreaterThanOrEqual(check.day.length + 2);
	});
});

describe('checkKey', () => {
	it('stays while the character is the same and changes once it is edited', () => {
		const { own, script } = setup([{ id: '_meta', name: 'T' }, LAMPLIGHTER, 'imp']);
		const lamp = own('lamplighter');
		const again = setup([{ id: '_meta', name: 'Other' }, LAMPLIGHTER, 'chef']).own('lamplighter');
		expect(checkKey(again)).toBe(checkKey(lamp));
		const edited = editedCharacter(lamp, {
			...LAMPLIGHTER,
			rules: { nightOrder: { other: { after: 'monk' } } }
		})!;
		expect(checkKey(edited)).not.toBe(checkKey(lamp));
		const next = scriptWithCharacter(script, edited);
		const entry = next.entries.find((e) => e.kind === 'custom');
		expect(entry?.kind === 'custom' && entry.character.rules?.nightOrder?.other?.after).toBe(
			'monk'
		);
	});
});

describe('editedCharacter', () => {
	it('keeps the original id and its TPI special data', () => {
		const { own } = setup([
			{ id: '_meta', name: 'T' },
			{ ...LAMPLIGHTER, special: [{ type: 'selection', name: 'bag-disabled' }] },
			'imp'
		]);
		const lamp = own('lamplighter');
		const edited = editedCharacter(lamp, { ...LAMPLIGHTER, id: 'renamed', name: 'Lantern' })!;
		expect(edited.id).toBe('lamplighter');
		expect(edited.name).toBe('Lantern');
		expect(edited.special).toEqual(lamp.special);
	});
});
