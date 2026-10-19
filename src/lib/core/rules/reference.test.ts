/**
 * The Character reference is built from TPI's data and our rules code. Rules cited:
 * - https://wiki.bloodontheclocktower.com/Witch (the Cursed player; Witch day reminder)
 * - https://wiki.bloodontheclocktower.com/Character_Types (alignment from type)
 * - https://wiki.bloodontheclocktower.com/Glossary (Dusk, Dawn)
 */
import { describe, expect, it } from 'vitest';
import { committedGameData, committedNumericNightOrder } from '#lib/core/testing/committed-data.ts';
import {
	characterReference,
	compareNightOrders,
	fullNightOrder,
	matchesReference,
	referenceText,
	sheetPosition
} from './reference.ts';

const data = committedGameData();
const numeric = committedNumericNightOrder();
const entries = characterReference(data, numeric);
const entry = (id: string) => entries.find((e) => e.character.id === id)!;
const name = (id: string) => data.byId.get(id)?.name ?? id;

describe('characterReference', () => {
	it('has every official character once', () => {
		expect(entries).toHaveLength(data.characters.length);
		expect(new Set(entries.map((e) => e.character.id)).size).toBe(entries.length);
	});

	// https://wiki.bloodontheclocktower.com/Grandmother (Trevor's reviewed night text)
	it('lists where our night text departs from TPI’s, with the reason', () => {
		const gm = entry('grandmother');
		expect(gm.differences.map((d) => d.part)).toEqual(['firstNight', 'otherNight']);
		expect(gm.differences[1].source).toBe(data.byId.get('grandmother')!.otherNightReminder);
		expect(gm.differences[1].ours).toContain('*DEAD*');
		expect(gm.otherNight.ours?.reason).toBeTruthy();
		expect(gm.filters.has('differs')).toBe(true);
		expect(entry('chef').differences).toEqual([]);
		// Parked fuller text is not in use.
		expect(entry('witch').differences).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Yaggababble
	it('shows the Yaggababble’s phrase as a value entered during prep', () => {
		expect(referenceText(entry('yaggababble').dayReminders[0].segments, name)).toBe(
			'[Yaggababble] secret phrase is (PHRASE)'
		);
	});

	it('collects everything for the Witch', () => {
		const witch = entry('witch');
		expect(witch.alignment).toBe('evil');
		expect(witch.jinxes).toEqual([]);
		expect(witch.firstNight.position).toBe(data.nightSheet.firstNight.indexOf('witch') + 1);
		expect(witch.otherNight.position).toBe(data.nightSheet.otherNight.indexOf('witch') + 1);
		expect(witch.firstNight.number).toBe(numeric.firstNight.get('witch'));
		expect(witch.firstNight.text).toBe(data.byId.get('witch')!.firstNightReminder);
		const texts = witch.dayReminders.map((r) => referenceText(r.segments, name));
		expect(texts).toContain('[Witch] has chosen [player with “Cursed”]');
		expect(texts).toContain('[Witch] is poisoned / is drunk');
		expect(witch.wiki).toBe('https://wiki.bloodontheclocktower.com/Witch');
		expect(witch.filters.has('day')).toBe(true);
		expect(witch.filters.has('jinxes')).toBe(false);
	});

	it('gives setup modifiers, jinxes and the no-day reason', () => {
		expect(entry('baron').setup?.summary).toBe('+2 Outsiders');
		expect(entry('baron').noDayReason).toBe('setup only');
		expect(entry('baron').filters.has('setup')).toBe(true);
		const spy = entry('spy');
		expect(spy.jinxes.length).toBeGreaterThan(0);
		expect(spy.jinxes.every((j) => j.with !== 'spy' && j.reason.length > 0)).toBe(true);
	});

	it('leaves alignment to the Storyteller for Travellers and to nobody for rule characters', () => {
		expect(entry('gunslinger').alignment).toBeUndefined();
		expect(entry('gunslinger').alignmentNote).toBe('Storyteller chooses');
		expect(entry('angel').alignmentNote).toBe('None');
		expect(entry('witch').alignmentNote).toBe('Evil');
	});
});

describe('compareNightOrders', () => {
	it('flags missing numbers, numbers off the sheet and out-of-order numbers', () => {
		const numbers = new Map([
			['a', 10],
			['c', 5],
			['d', 30],
			['z', 99]
		]);
		const out = compareNightOrders(['dusk', 'a', 'b', 'c', 'd', 'dawn'], numbers);
		expect(out.get('dusk')).toEqual({ position: 1, issues: [] });
		expect(out.get('b')!.issues).toEqual(['On TPI’s night sheet but has no provisional number.']);
		expect(out.get('a')!.issues[0]).toMatch(/different place/);
		expect(out.get('c')!.issues[0]).toMatch(/different place/);
		expect(out.get('d')).toEqual({ position: 5, number: 30, issues: [] });
		expect(out.get('z')).toEqual({
			number: 99,
			issues: ['Has a provisional number but is not on TPI’s night sheet.']
		});
	});
});

describe('matchesReference', () => {
	it('searches names, ability text and tokens, and filters by type and flags', () => {
		const ids = (q: Parameters<typeof matchesReference>[1]) =>
			entries.filter((e) => matchesReference(e, q)).map((e) => e.character.id);
		expect(ids({ search: 'witch' })).toContain('witch');
		expect(ids({ search: 'cursed' })).toContain('witch');
		expect(ids({ search: 'lil monsta' })).toContain('lilmonsta');
		expect(ids({ types: ['demon'] }).every((id) => data.byId.get(id)!.type === 'demon')).toBe(true);
		const jinxedDemons = ids({ types: ['demon'], filters: ['jinxes'] });
		expect(jinxedDemons).toContain('leviathan');
		expect(jinxedDemons).not.toContain('imp');
	});
});

describe('fullNightOrder', () => {
	it('starts at Dusk and keeps TPI order, with announcements after Dawn', () => {
		for (const night of ['first', 'other'] as const) {
			const steps = fullNightOrder(data, night, numeric).steps;
			expect(steps[0].id).toBe('dusk');
			const dawn = steps.findIndex((s) => s.id === 'dawn');
			expect(steps.slice(dawn + 1).every((s) => s.afterDawn)).toBe(true);
			const positions = steps.map((s) => sheetPosition(data.nightSheet, night, s.id)!);
			expect(positions).toEqual([...positions].sort((a, b) => a - b));
		}
		const first = fullNightOrder(data, 'first', numeric).steps.map((s) => s.id);
		expect(first).toContain('minioninfo');
		expect(first).toContain('demoninfo');
	});
});

describe('reference tokens', () => {
	it('groups TPI copies of a token and counts those the setup reminders place', () => {
		// The No Dashii lists Poisoned twice and setup poisons both its Townsfolk neighbours.
		expect(entry('nodashii').tokens).toEqual([
			{ label: 'Dead', global: false, copies: 1, setup: 0, firstDay: 0 },
			{ label: 'Poisoned', global: false, copies: 2, setup: 2, firstDay: 0 }
		]);
		// The Washerwoman's two tokens both go down before the first night.
		expect(entry('washerwoman').tokens.map((t) => [t.label, t.setup])).toEqual([
			['Townsfolk', 1],
			['Wrong', 1]
		]);
	});

	it('never places more of a token at setup than TPI lists', () => {
		const over = entries.flatMap((e) =>
			e.problems.filter((p) => p.startsWith('Setup places')).map((p) => `${e.character.id}: ${p}`)
		);
		expect(over).toEqual([]);
	});
});
