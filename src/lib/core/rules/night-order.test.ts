/**
 * Night order engine. Rules sources:
 * - https://wiki.bloodontheclocktower.com/Glossary (Dusk, Dawn, Minion Info, Demon Info)
 * - https://wiki.bloodontheclocktower.com/Abilities (the night sheet gives the order)
 * - https://wiki.bloodontheclocktower.com/Toymaker (normal evil info at any size)
 * - https://wiki.bloodontheclocktower.com/Leviathan and /Vizier (announced after Dawn)
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { editionScript } from '#lib/core/data/script.ts';
import type { Character } from '#lib/core/data/types.ts';
import { nightOrder, type NightOrderInput } from './night-order.ts';

const data = committedGameData();
const get = (...ids: string[]) => ids.map((id) => data.byId.get(id)!);
const tb = editionScript('tb', data)!.characters;

function order(input: Partial<NightOrderInput> & Pick<NightOrderInput, 'inPlay'>) {
	return nightOrder({ night: 'first', sheet: data.nightSheet, players: 8, ...input });
}
const stepIds = (input: Parameters<typeof order>[0]) => order(input).steps.map((s) => s.id);

const homebrew = (extra: Partial<Character>): Character => ({
	id: 'stormwarden',
	name: 'Storm Warden',
	type: 'townsfolk',
	ability: '',
	setup: false,
	reminders: [],
	remindersGlobal: [],
	special: [],
	...extra
});

describe('first night, Trouble Brewing', () => {
	it('runs Dusk, evil info, then characters in sheet order, then Dawn', () => {
		const inPlay = get('poisoner', 'spy', 'washerwoman', 'empath', 'imp', 'monk', 'butler');
		expect(stepIds({ inPlay })).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'poisoner',
			'washerwoman',
			'empath',
			'butler',
			'spy',
			'dawn'
		]);
	});

	it('leaves out characters that do not act tonight (Imp, Monk on the first night)', () => {
		const steps = order({ inPlay: get('imp', 'monk', 'chef') }).steps;
		expect(steps.map((s) => s.id)).toEqual(['dusk', 'minioninfo', 'demoninfo', 'chef', 'dawn']);
		expect(steps.find((s) => s.id === 'chef')?.reminder).toBe(
			data.byId.get('chef')!.firstNightReminder
		);
	});

	it('has text for every marker', () => {
		for (const step of order({ inPlay: tb }).steps.filter((s) => s.kind === 'marker')) {
			expect(step.reminder, step.id).toMatch(/\w/);
		}
	});
});

describe('other nights', () => {
	it('never has evil info and follows the other-night sheet', () => {
		const inPlay = get('poisoner', 'monk', 'scarletwoman', 'imp', 'ravenkeeper', 'empath', 'chef');
		expect(stepIds({ night: 'other', inPlay })).toEqual([
			'dusk',
			'poisoner',
			'monk',
			'scarletwoman',
			'imp',
			'ravenkeeper',
			'empath',
			'dawn'
		]);
	});
});

describe('the 7+ player rule', () => {
	it('skips Minion and Demon info below 7 players, with a reason', () => {
		const result = order({ inPlay: get('poisoner', 'imp'), players: 6 });
		expect(result.steps.map((s) => s.id)).toEqual(['dusk', 'poisoner', 'dawn']);
		expect(result.omitted.map((o) => o.id)).toEqual(['minioninfo', 'demoninfo']);
		expect(result.omitted[0].reason).toContain('Fewer than 7 players');
	});

	it('keeps them at exactly 7', () => {
		expect(stepIds({ inPlay: [], players: 7 })).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'dawn'
		]);
	});

	it('keeps them below 7 when the Toymaker is in play', () => {
		const steps = order({ inPlay: get('toymaker', 'imp'), players: 5 }).steps;
		expect(steps.map((s) => s.id)).toContain('minioninfo');
		expect(steps.find((s) => s.id === 'demoninfo')?.notes.join(' ')).toContain('Toymaker');
	});
});

describe('after Dawn', () => {
	it('puts Leviathan and Vizier after Dawn on the first night', () => {
		const steps = order({ inPlay: get('vizier', 'leviathan', 'chef') }).steps;
		expect(steps.map((s) => s.id)).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'chef',
			'dawn',
			'leviathan',
			'vizier'
		]);
		expect(steps.filter((s) => s.afterDawn).map((s) => s.id)).toEqual(['leviathan', 'vizier']);
		expect(steps.at(-1)?.notes).toContain('After Dawn: announce this to everyone.');
	});
});

describe('notes at the evil info steps', () => {
	it('mentions Poppy Grower, Lunatic, Magician, Summoner and Snitch', () => {
		const steps = order({
			inPlay: get('poppygrower', 'lunatic', 'magician', 'summoner', 'snitch')
		}).steps;
		const minion = steps.find((s) => s.id === 'minioninfo')!.notes.join(' ');
		const demon = steps.find((s) => s.id === 'demoninfo')!.notes.join(' ');
		// In the order the characters are in play, each from its rules file's `evilInfo`.
		expect(minion).toMatch(/Poppy Grower.*Lunatic.*Magician/);
		expect(minion).not.toMatch(/Summoner|Snitch/);
		expect(demon).toMatch(/Summoner/);
		expect(demon).toMatch(/Snitch/);
	});

	it('reads a homebrew character’s own evilInfo note', () => {
		const [chef] = get('chef');
		const homebrew = {
			...chef,
			id: 'lantern',
			name: 'Lantern',
			rules: { evilInfo: { notes: { demoninfo: 'show the Demon one more bluff.' } } }
		};
		const steps = order({ inPlay: [...get('imp'), homebrew] }).steps;
		expect(steps.find((s) => s.id === 'demoninfo')!.notes).toContain(
			'Lantern: show the Demon one more bluff.'
		);
		expect(steps.find((s) => s.id === 'minioninfo')!.notes).not.toContain(
			'Lantern: show the Demon one more bluff.'
		);
	});
});

describe('custom order from _meta', () => {
	it('follows the script order and keeps unlisted characters in their standard place', () => {
		const inPlay = get('poisoner', 'washerwoman', 'chef', 'empath', 'imp');
		const result = order({
			inPlay,
			customOrder: ['dusk', 'chef', 'minioninfo', 'demoninfo', 'poisoner', 'washerwoman', 'dawn']
		});
		expect(result.steps.map((s) => s.id)).toEqual([
			'dusk',
			'chef',
			'empath',
			'minioninfo',
			'demoninfo',
			'poisoner',
			'washerwoman',
			'dawn'
		]);
		expect(result.steps.find((s) => s.id === 'chef')?.placement).toBe('custom-order');
		expect(result.steps.find((s) => s.id === 'empath')?.notes[0]).toContain(
			'Not in the script’s own night order'
		);
	});

	it('adds missing Dusk and Dawn and still skips evil info below 7', () => {
		const result = order({
			inPlay: get('poisoner'),
			players: 5,
			customOrder: ['poisoner', 'minioninfo']
		});
		expect(result.steps.map((s) => s.id)).toEqual(['dusk', 'poisoner', 'dawn']);
	});
});

describe('homebrew characters', () => {
	// TPI publishes no night numbers for official characters, so a homebrew number cannot be
	// matched against them: the step goes before Dawn for the Storyteller to check.
	it('places homebrew with or without a number before Dawn with a note', () => {
		const noNumber = homebrew({ otherNightReminder: 'x' });
		const r1 = order({ night: 'other', inPlay: [noNumber, ...get('imp')] });
		expect(r1.steps.map((s) => s.id)).toEqual(['dusk', 'imp', 'stormwarden', 'dawn']);
		expect(r1.steps[2]).toMatchObject({ placement: 'unplaced' });
		const numbered = homebrew({ firstNight: 3, firstNightReminder: 'Wake the Storm Warden.' });
		const r2 = order({ inPlay: [numbered, ...get('chef', 'leviathan')] });
		expect(r2.steps.map((s) => s.id)).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'chef',
			'stormwarden',
			'dawn',
			'leviathan'
		]);
		expect(r2.steps[4]).toMatchObject({
			placement: 'unplaced',
			reminder: 'Wake the Storm Warden.'
		});
		expect(r2.steps[4].notes[0]).toContain('Check the order');
	});

	it('wakes on number alone, and notes the missing text', () => {
		const steps = order({ inPlay: [homebrew({ firstNight: 100 })] }).steps;
		expect(steps.find((s) => s.id === 'stormwarden')?.notes).toContain(
			'No night text for this character tonight.'
		);
	});

	it('uses TPI order for an official id even if a script copies it with a number', () => {
		const chef = { ...data.byId.get('chef')!, firstNight: 1 };
		expect(stepIds({ inPlay: [chef, ...get('poisoner')] })).toEqual([
			'dusk',
			'minioninfo',
			'demoninfo',
			'poisoner',
			'chef',
			'dawn'
		]);
	});
});

describe('Storyteller overrides', () => {
	const inPlay = get('poisoner', 'washerwoman', 'chef', 'imp');

	it('hides, edits, moves and adds steps', () => {
		const result = order({
			inPlay,
			overrides: [
				{ kind: 'hide', id: 'washerwoman' },
				{ kind: 'edit', id: 'chef', text: 'Show 1 finger.' },
				{ kind: 'move', id: 'poisoner', after: 'chef' },
				{ kind: 'add', id: 'custom-1', text: 'Check the bag.', title: 'Bag check', after: 'dusk' },
				{
					kind: 'add',
					id: 'custom-2',
					text: 'Wake the Imp to wave.',
					characterId: 'imp',
					after: 'nowhere'
				}
			]
		});
		expect(result.steps.map((s) => s.id)).toEqual([
			'dusk',
			'custom-1',
			'minioninfo',
			'demoninfo',
			'chef',
			'poisoner',
			'custom-2',
			'dawn'
		]);
		expect(result.steps.find((s) => s.id === 'chef')).toMatchObject({
			reminder: 'Show 1 finger.',
			overridden: 'edited'
		});
		expect(result.steps.find((s) => s.id === 'poisoner')?.overridden).toBe('moved');
		expect(result.steps.find((s) => s.id === 'custom-1')).toMatchObject({
			kind: 'custom',
			title: 'Bag check',
			overridden: 'added'
		});
		expect(result.steps.find((s) => s.id === 'custom-2')?.character?.id).toBe('imp');
		expect(result.omitted).toEqual([{ id: 'washerwoman', reason: 'Hidden by the Storyteller.' }]);
	});

	it('applies an override only to the night it names', () => {
		const overrides = [{ kind: 'hide' as const, id: 'poisoner', night: 'other' as const }];
		expect(stepIds({ inPlay, overrides })).toContain('poisoner');
		expect(stepIds({ night: 'other', inPlay, overrides })).not.toContain('poisoner');
	});

	it('recomputes after-Dawn when a step is moved past Dawn', () => {
		const steps = order({ inPlay, overrides: [{ kind: 'move', id: 'chef', after: 'dawn' }] }).steps;
		expect(steps.at(-1)).toMatchObject({ id: 'chef', afterDawn: true });
	});
});

describe('every character on the full sheet', () => {
	it('appears once, in TPI order, for both nights', () => {
		for (const night of ['first', 'other'] as const) {
			const steps = nightOrder({
				night,
				sheet: data.nightSheet,
				inPlay: data.characters,
				players: 15
			}).steps;
			expect(steps.map((s) => s.id)).toEqual(
				night === 'first' ? data.nightSheet.firstNight : data.nightSheet.otherNight
			);
		}
	});
});
