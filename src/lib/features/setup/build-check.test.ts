import { describe, expect, it } from 'vitest';
import type { Character } from '#lib/core/data/index.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { analyseSelection, planBag, scriptFacts } from '#lib/core/rules/index.ts';
import { buildErrors, setupWarningMessages, uncuratedReminderCharacters } from './build-check.ts';

const data = committedGameData();
const lookup = (id: string) => data.byId.get(id);

function check(
	players: number,
	ids: string[],
	standIns: Record<string, string> = {},
	travellerMax?: number
) {
	const selection: Record<string, number> = {};
	for (const id of ids) selection[id] = (selection[id] ?? 0) + 1;
	const scriptOrder = [...new Set(ids)];
	const analysis = analyseSelection({ players, selection, scriptOrder, lookup });
	const plan = planBag({
		selection,
		scriptCharacters: scriptOrder.map((id) => lookup(id)!),
		lookup,
		standIns,
		random: () => 0
	});
	const travellers = ids.filter((id) => lookup(id)?.type === 'traveller').length;
	return buildErrors({ analysis, issues: plan.issues, travellers, travellerMax });
}

describe('buildErrors', () => {
	// https://beardytas.com/garden-of-djinn/stowed-away/: up to 2 Travellers in the bag.
	it('flags more Travellers than a special rule lets into the bag', () => {
		const six = ['washerwoman', 'empath', 'monk', 'butler', 'poisoner', 'imp'];
		expect(check(8, [...six, 'scapegoat', 'gunslinger'], {}, 2)).toEqual([]);
		expect(check(9, [...six, 'scapegoat', 'gunslinger', 'beggar'], {}, 2)).toContain(
			'3 Travellers chosen; a special rule allows up to 2 in the bag.'
		);
	});

	it('is empty for a clean selection', () => {
		expect(check(5, ['washerwoman', 'empath', 'monk', 'poisoner', 'imp'])).toEqual([]);
	});

	it('flags a missing Demon and the wrong bag size', () => {
		const errors = check(5, ['washerwoman', 'empath', 'monk', 'poisoner']);
		expect(errors.some((e) => /Demon/.test(e))).toBe(true);
		expect(errors.some((e) => /4 characters chosen for 5 players/.test(e))).toBe(true);
	});

	it('flags copies the rules do not allow', () => {
		const errors = check(5, ['washerwoman', 'washerwoman', 'monk', 'poisoner', 'imp']);
		expect(errors.some((e) => /Washerwoman is chosen 2 times/.test(e))).toBe(true);
	});

	it('flags counts that ignore a setup change (Baron: +2 Outsiders)', () => {
		expect(
			check(7, ['washerwoman', 'empath', 'monk', 'chef', 'librarian', 'baron', 'imp'])
		).not.toEqual([]);
	});

	it('flags missing Travellers beyond 15 players', () => {
		const ids = [
			...['washerwoman', 'librarian', 'investigator', 'chef', 'empath', 'fortuneteller'],
			...['undertaker', 'monk', 'ravenkeeper'],
			...['butler', 'saint'],
			...['poisoner', 'spy', 'scarletwoman', 'imp']
		];
		expect(check(16, ids).some((e) => /0 Travellers chosen; expected 1/.test(e))).toBe(true);
		expect(check(16, [...ids, 'thief'])).toEqual([]);
	});
});

describe('setupWarningMessages', () => {
	const name = (id: string) => lookup(id)?.name ?? id;
	const analyse = (ids: string[]) =>
		analyseSelection({
			players: 5,
			selection: Object.fromEntries(ids.map((id) => [id, 1])),
			scriptOrder: ids,
			lookup,
			findByName: (n) => [...data.byId.values()].find((c) => c.name === n)?.id
		});
	const chosen = ['choirboy', 'chef', 'empath', 'poisoner', 'imp'];

	// https://wiki.bloodontheclocktower.com/Choirboy: the King must be in play.
	it('keeps the swap advice when the King is on the script', () => {
		const script = [...chosen, 'king'].map((id) => lookup(id)!);
		const reqs = scriptFacts(script, data.jinxes).requirements;
		const messages = setupWarningMessages(analyse(chosen).warnings, reqs, name);
		expect(messages.some((m) => /swap a Townsfolk for the King/.test(m))).toBe(true);
	});

	it('says the King is not on the script when it is not', () => {
		const reqs = scriptFacts(
			chosen.map((id) => lookup(id)!),
			data.jinxes
		).requirements;
		const messages = setupWarningMessages(analyse(chosen).warnings, reqs, name);
		expect(messages).toContain(
			'Choirboy needs the King in play, but the King is not on the script.'
		);
		expect(messages.some((m) => /swap a Townsfolk/.test(m))).toBe(false);
	});
});

describe('uncuratedReminderCharacters', () => {
	const data = committedGameData();
	const official = (id: string): Character => data.characters.find((c) => c.id === id)!;
	const custom = (id: string, reminders: string[]): Character => ({
		...official('chef'),
		id,
		name: id,
		reminders,
		remindersGlobal: []
	});

	it('names custom characters with reminders, never official ones', () => {
		const inPlay = [
			official('washerwoman'),
			official('chef'),
			custom('lamp', ['Lit']),
			custom('quiet', [])
		];
		expect(uncuratedReminderCharacters(inPlay)).toEqual(['lamp']);
	});

	it('leaves out a custom character whose rules say what it places at setup', () => {
		const lamp = { ...custom('lamp', ['Lit']), rules: { setupPrep: { none: 'lit later' } } };
		expect(uncuratedReminderCharacters([lamp])).toEqual([]);
	});
});
