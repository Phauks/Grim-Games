/**
 * Pre-day reminders. Each curated entry cites its character's wiki page in
 * `day-reminders.data.ts`; the behaviour tests below cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Character } from '#lib/core/data/types.ts';
import {
	DAY_REMINDER_ENTRIES,
	dayReminders,
	impairment,
	NO_DAY_RELEVANCE,
	renderReminder,
	type DaySeat,
	type DayState
} from './day-reminders.ts';

const data = committedGameData();
const name = (id: string) => data.byId.get(id)?.name ?? id;
let n = 0;
const seat = (characterId: string, extra: Partial<DaySeat> = {}): DaySeat => ({
	seatId: `s${++n}`,
	characterId,
	dead: false,
	reminders: [],
	...extra
});
function texts(state: Partial<DayState> & Pick<DayState, 'seats'>, extra: Character[] = []) {
	const lookup = (id: string) => extra.find((c) => c.id === id) ?? data.byId.get(id);
	return dayReminders({ day: 2, character: lookup, ...state }).flatMap((g) =>
		g.reminders.map((r) => renderReminder(r.segments, (id) => lookup(id)?.name ?? id))
	);
}

describe('coverage', () => {
	it('considers every official character exactly once', () => {
		const curated = DAY_REMINDER_ENTRIES.map((e) => e.id);
		const quiet = Object.keys(NO_DAY_RELEVANCE);
		expect(new Set(curated).size).toBe(curated.length);
		expect(curated.filter((id) => quiet.includes(id))).toEqual([]);
		const all = new Set([...curated, ...quiet]);
		expect(data.characters.filter((c) => !all.has(c.id)).map((c) => c.id)).toEqual([]);
		expect([...all].filter((id) => !data.byId.has(id))).toEqual([]);
	});

	it('cites a wiki page and has text for every curated reminder', () => {
		for (const entry of DAY_REMINDER_ENTRIES) {
			expect(entry.wiki, entry.id).toMatch(/^https:\/\/wiki\.bloodontheclocktower\.com\/\S+$/);
			for (const spec of entry.reminders) {
				expect(
					spec.template.some((p) => 'self' in p),
					entry.id
				).toBe(true);
				if (spec.template.some((p) => 'target' in p))
					expect(spec.when?.reminder, entry.id).toBeDefined();
			}
		}
	});

	it('names only reminder tokens the character really has', () => {
		for (const entry of DAY_REMINDER_ENTRIES) {
			const c = data.byId.get(entry.id)!;
			const tokens = [...c.reminders, ...c.remindersGlobal].map((t) => t.toLowerCase());
			for (const spec of entry.reminders) {
				for (const token of [spec.when?.reminder, spec.when?.noReminder]) {
					if (token) expect(tokens, `${entry.id}: ${token}`).toContain(token.toLowerCase());
				}
			}
		}
	});
});

describe('state-based reminders', () => {
	// https://wiki.bloodontheclocktower.com/Witch
	it('shows who the Witch has chosen, with player names when known', () => {
		const witch = seat('witch', { playerName: 'Sam' });
		const librarian = seat('librarian', {
			playerName: 'Alex',
			reminders: [{ source: 'witch', token: 'Cursed' }]
		});
		expect(texts({ seats: [witch, librarian] })).toEqual([
			'[Witch · Sam] has chosen [Librarian · Alex]'
		]);
		expect(texts({ seats: [seat('witch'), seat('chef')] })).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Saint
	it('shows the Saint only while alive', () => {
		expect(texts({ seats: [seat('saint')] })).toEqual(['[Saint] is alive']);
		expect(texts({ seats: [seat('saint', { dead: true })] })).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Slayer
	it('shows an unused Slayer shot, and whether the Slayer is poisoned or drunk', () => {
		expect(texts({ seats: [seat('slayer')] })).toEqual(['[Slayer] has an unused shot']);
		const used = seat('slayer', { reminders: [{ source: 'slayer', token: 'No Ability' }] });
		expect(texts({ seats: [used] })).toEqual([]);
		const poisoned = seat('slayer', { reminders: [{ source: 'poisoner', token: 'Poisoned' }] });
		expect(texts({ seats: [poisoned, seat('poisoner')] })).toEqual([
			'[Slayer] has an unused shot',
			'[Slayer] is poisoned'
		]);
		// https://wiki.bloodontheclocktower.com/Drunk: the Drunk thinks they are the Slayer.
		const drunk = seat('slayer', { reminders: [{ source: 'drunk', token: 'Is The Drunk' }] });
		expect(texts({ seats: [drunk] })).toContain('[Slayer] is drunk');
	});

	it('reads Poisoned and Drunk tokens from any source', () => {
		expect(impairment('Poisoned')).toBe('poisoned');
		expect(impairment('Drunk 2')).toBe('drunk');
		expect(impairment('Everyone Is Drunk')).toBe('drunk');
		expect(impairment('Safe')).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Juggler and /Riot
	it('respects day limits', () => {
		expect(texts({ day: 1, seats: [seat('juggler')] })).toEqual(['[Juggler] may juggle today']);
		expect(texts({ day: 2, seats: [seat('juggler')] })).toEqual([]);
		expect(texts({ day: 2, seats: [seat('riot')] })).toEqual([]);
		expect(texts({ day: 3, seats: [seat('riot')] })).toEqual(['[Riot] is rioting']);
	});

	// https://wiki.bloodontheclocktower.com/Scarlet_Woman
	it('respects alive-player counts', () => {
		const seats = [seat('scarletwoman'), seat('imp'), seat('chef'), seat('empath')];
		expect(texts({ seats })).toEqual([]);
		expect(texts({ seats: [...seats, seat('monk')] })).toEqual(['[Scarlet Woman] is alive']);
	});

	// https://wiki.bloodontheclocktower.com/Klutz
	it('shows dead-only triggers only when dead', () => {
		expect(texts({ seats: [seat('klutz')] })).toEqual([]);
		expect(texts({ seats: [seat('klutz', { dead: true })] })).toEqual(['[Klutz] is dead']);
	});

	// https://wiki.bloodontheclocktower.com/Djinn
	it('includes Fabled and Loric that are not seated', () => {
		expect(texts({ seats: [], rules: ['djinn'] })).toEqual(['[Djinn] is in play']);
	});

	it('leaves out characters with no day relevance', () => {
		expect(texts({ seats: [seat('chef'), seat('imp'), seat('poisoner')] })).toEqual([]);
	});

	it('groups reminders in a fixed order', () => {
		const groups = dayReminders({
			day: 2,
			character: (id) => data.byId.get(id),
			seats: [seat('saint'), seat('slayer'), seat('virgin')]
		});
		expect(groups.map((g) => g.group)).toEqual(['day-ability', 'nomination', 'execution-death']);
		expect(groups[0].reminders[0].wiki).toBe('https://wiki.bloodontheclocktower.com/Slayer');
	});
});

describe('homebrew', () => {
	const custom: Character = {
		id: 'heckler',
		name: 'Heckler',
		type: 'outsider',
		ability:
			'Each day, you may publicly heckle a player. If you are executed, you might not die. [+1 Outsider]',
		setup: true,
		reminders: [],
		remindersGlobal: [],
		special: [{ type: 'vote', name: 'multiplier', value: 2 }]
	};

	it('is auto-detected from ability text and special', () => {
		const groups = dayReminders({
			day: 1,
			character: (id) => (id === 'heckler' ? custom : undefined),
			seats: [seat('heckler')]
		});
		const reminders = groups.flatMap((g) => g.reminders);
		expect(reminders.every((r) => r.autoDetected)).toBe(true);
		expect(reminders.map((r) => r.group)).toEqual(['day-ability', 'vote', 'execution-death']);
		expect(renderReminder(reminders[0].segments, name)).toBe('[heckler] may act today');
	});

	it('treats a homebrew copy of an official id as homebrew', () => {
		const copy = {
			...data.byId.get('chef')!,
			edition: undefined,
			ability: 'Each day, publicly cook.'
		};
		expect(texts({ seats: [seat('chef')] }, [copy])).toEqual(['[Chef] may act today']);
	});
});
