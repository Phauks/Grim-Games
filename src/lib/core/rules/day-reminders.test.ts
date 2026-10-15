/**
 * Pre-day reminders. Each curated entry cites its character's wiki page in
 * `day-reminders.data.ts`; the behaviour tests below cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Character } from '#lib/core/data/types.ts';
import {
	newGame,
	run as runCommands,
	testCharacters
} from '#lib/core/model/fixtures.test-support.ts';
import {
	DAY_REMINDER_ENTRIES,
	dayReminders,
	dayStateFromGame,
	impairment,
	isOnceOnlyDayAbility,
	NO_DAY_RELEVANCE,
	renderReminder,
	type DayReminderOverride,
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
const token = (characterId: string, label: string) => ({ characterId, label });

function run(state: Partial<DayState> & Pick<DayState, 'seats'>, extra: Character[] = []) {
	const lookup = (id: string) => extra.find((c) => c.id === id) ?? data.byId.get(id);
	return dayReminders({ character: lookup, ...state });
}
function texts(state: Partial<DayState> & Pick<DayState, 'seats'>, extra: Character[] = []) {
	const lookup = (id: string) => extra.find((c) => c.id === id) ?? data.byId.get(id);
	return run(state, extra).groups.flatMap((g) =>
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
				for (const label of [spec.when?.reminder, spec.when?.noReminder]) {
					if (label) expect(tokens, `${entry.id}: ${label}`).toContain(label.toLowerCase());
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
			reminders: [token('witch', 'Cursed')]
		});
		expect(texts({ seats: [witch, librarian] })).toEqual([
			'[Witch · Sam] has chosen [Librarian · Alex]'
		]);
		expect(texts({ seats: [seat('witch'), seat('chef')] })).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Yaggababble: the Storyteller picks the phrase.
	it('shows the Yaggababble’s phrase once the Storyteller entered it in prep', () => {
		const yagg = seat('yaggababble');
		expect(texts({ seats: [yagg] })).toEqual(['[Yaggababble] secret phrase is (PHRASE)']);
		expect(
			texts({ seats: [yagg], prepValues: { 'yaggababble.phrase': 'cheese and onion' } })
		).toEqual(['[Yaggababble] secret phrase is (cheese and onion)']);
	});

	// https://wiki.bloodontheclocktower.com/Pixie and /Sailor (Trevor’s review wording)
	it('words the Pixie and Sailor reminders as reviewed', () => {
		const pixie = seat('pixie');
		const chef = seat('chef', { reminders: [token('pixie', 'Mad')] });
		expect(texts({ seats: [pixie, chef] })).toEqual([
			'[Pixie] must be mad as [Chef] to gain their ability when they die.'
		]);
		expect(texts({ seats: [seat('sailor')] })).toEqual(['[Sailor] cannot die.']);
	});

	// https://wiki.bloodontheclocktower.com/Saint
	it('shows the Saint only while alive', () => {
		expect(texts({ seats: [seat('saint')] })).toEqual(['[Saint] is alive']);
		expect(texts({ seats: [seat('saint', { dead: true })] })).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Slayer
	it('shows an unused Slayer shot, or instead that the Slayer is poisoned or drunk', () => {
		expect(texts({ seats: [seat('slayer')] })).toEqual(['[Slayer] has an unused shot']);
		const used = seat('slayer', { reminders: [token('slayer', 'No Ability')] });
		expect(texts({ seats: [used] })).toEqual([]);
		const poisoned = seat('slayer', { reminders: [token('poisoner', 'Poisoned')] });
		expect(texts({ seats: [poisoned, seat('poisoner')] })).toEqual([
			'[Slayer] is poisoned by [Poisoner]'
		]);
		// https://wiki.bloodontheclocktower.com/Drunk: the Drunk thinks they are the Slayer.
		const drunk = seat('slayer', { reminders: [token('drunk', 'Is The Drunk')] });
		expect(texts({ seats: [drunk] })).toEqual(['[Slayer] is really the [Drunk]']);
	});

	it('reads Poisoned and Drunk tokens from any source', () => {
		expect(impairment('Poisoned')).toBe('poisoned');
		expect(impairment('Drunk 2')).toBe('drunk');
		expect(impairment('Everyone Is Drunk')).toBe('drunk');
		expect(impairment('Safe')).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Juggler and /Riot: no day tracking, so tokens decide.
	it('uses reminder tokens instead of day numbers', () => {
		expect(texts({ seats: [seat('juggler')] })).toEqual(['[Juggler] may juggle']);
		const juggled = seat('juggler', { reminders: [token('juggler', 'Correct')] });
		expect(texts({ seats: [juggled] })).toEqual([]);
		expect(texts({ seats: [seat('riot')] })).toEqual([]);
		const day3 = seat('riot', { reminders: [token('riot', 'Day 3')] });
		expect(texts({ seats: [day3] })).toEqual(['[Riot] is rioting']);
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

	// https://wiki.bloodontheclocktower.com/Banshee
	it('uses the death cause, treating an unknown cause as uncertain', () => {
		const line = '[Banshee] may nominate and vote twice';
		expect(texts({ seats: [seat('banshee', { dead: true, deathCause: 'demon' })] })).toEqual([
			line
		]);
		expect(texts({ seats: [seat('banshee', { dead: true, deathCause: 'imp' })] })).toEqual([line]);
		expect(texts({ seats: [seat('banshee', { dead: true, deathCause: 'execution' })] })).toEqual(
			[]
		);
		const unknown = run({ seats: [seat('banshee', { dead: true })] });
		expect(unknown.groups[0].reminders[0].uncertain).toBe(true);
	});

	// https://wiki.bloodontheclocktower.com/Djinn
	it('includes Fabled and Loric that are not seated', () => {
		expect(texts({ seats: [], ruleCharacters: ['djinn'] })).toEqual(['[Djinn] is in play']);
	});

	it('leaves out characters with no day relevance and seats with no character', () => {
		const empty: DaySeat = { seatId: 'x', dead: false, reminders: [] };
		expect(texts({ seats: [seat('chef'), seat('imp'), seat('poisoner'), empty] })).toEqual([]);
	});

	it('groups reminders in a fixed order', () => {
		const { groups } = run({ seats: [seat('saint'), seat('slayer'), seat('virgin')] });
		expect(groups.map((g) => g.group)).toEqual(['day-ability', 'nomination', 'execution-death']);
		expect(groups[0].reminders[0].wiki).toBe('https://wiki.bloodontheclocktower.com/Slayer');
	});
});

describe('Storyteller overrides', () => {
	const witch = seat('witch', { playerName: 'Sam' });
	const chef = seat('chef', { reminders: [token('witch', 'Cursed')] });
	const saint = seat('saint');
	const seats = [witch, chef, saint];
	const keys = run({ seats }).groups.flatMap((g) => g.reminders.map((r) => r.key));

	it('gives every generated reminder a stable, unique key', () => {
		expect(new Set(keys).size).toBe(keys.length);
		expect(run({ seats }).groups.flatMap((g) => g.reminders.map((r) => r.key))).toEqual(keys);
		expect(keys).toContain(`witch#0@${witch.seatId}>${chef.seatId}`);
	});

	it('hides, edits and adds reminders', () => {
		const overrides: DayReminderOverride[] = [
			{ kind: 'hide', key: `saint#0@${saint.seatId}` },
			{ kind: 'edit', key: `witch#0@${witch.seatId}>${chef.seatId}`, text: 'cursed the Chef' },
			{
				kind: 'add',
				key: 'custom-1',
				group: 'announcement',
				text: 'Remind everyone of the house rule'
			},
			{ kind: 'add', key: 'custom-2', group: 'vote', text: 'is voting twice', seatId: chef.seatId }
		];
		const result = run({ seats, overrides });
		const lines = result.groups.flatMap((g) =>
			g.reminders.map((r) => renderReminder(r.segments, name))
		);
		expect(lines).toEqual([
			'[Witch · Sam] cursed the Chef',
			'[Chef] is voting twice',
			'Remind everyone of the house rule'
		]);
		expect(result.hidden.map((r) => r.key)).toEqual([`saint#0@${saint.seatId}`]);
		expect(result.groups.flatMap((g) => g.reminders.map((r) => r.overridden))).toEqual([
			'edited',
			'added',
			'added'
		]);
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
		const reminders = run({ seats: [seat('heckler')] }, [custom]).groups.flatMap(
			(g) => g.reminders
		);
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

describe('isOnceOnlyDayAbility', () => {
	it('is true for once-per-game day abilities marked with "No Ability"', () => {
		// https://wiki.bloodontheclocktower.com/Slayer, /Artist, /Virgin
		for (const id of ['slayer', 'artist', 'virgin', 'fisherman']) {
			expect(isOnceOnlyDayAbility(id), id).toBe(true);
		}
		// https://wiki.bloodontheclocktower.com/Gossip: every day.
		for (const id of ['gossip', 'savant', 'juggler', 'imp']) {
			expect(isOnceOnlyDayAbility(id), id).toBe(false);
		}
	});
});

describe('impaired abilities', () => {
	/** Seats for an entry: the character, a carrier for each reminder it watches, and fillers. */
	function cast(id: string, selfReminders: { characterId: string; label: string }[]) {
		const entry = DAY_REMINDER_ENTRIES.find((e) => e.id === id)!;
		const self = seat(id, { reminders: selfReminders });
		const carriers = entry.reminders.flatMap((spec) =>
			spec.when?.reminder ? [seat('chef', { reminders: [token(id, spec.when.reminder)] })] : []
		);
		const fillers = Array.from({ length: 5 }, () => seat('chef'));
		return { self, seats: [self, ...carriers, ...fillers] };
	}

	// https://wiki.bloodontheclocktower.com/Glossary: a drunk or poisoned player has no
	// ability, so its normal lines would be wrong; https://wiki.bloodontheclocktower.com/Sailor
	it('shows exactly one line for an impaired character: the impaired one replaces the rest', () => {
		const impairable = DAY_REMINDER_ENTRIES.filter((e) => e.impairable);
		expect(impairable.map((e) => e.id)).toEqual(expect.arrayContaining(['sailor', 'yaggababble']));
		for (const e of impairable) {
			const alive = (key: string) => {
				const index = Number(/#(\d+)@/.exec(key)?.[1]);
				return (e.reminders[index]?.when?.self ?? 'alive') === 'alive';
			};
			for (const label of ['Poisoned', 'Drunk']) {
				const source = label === 'Drunk' ? 'sailor' : 'poisoner';
				const { self, seats } = cast(e.id, [token(source, label)]);
				const reminders = run({ seats }).groups.flatMap((g) => g.reminders);
				const normal = reminders.filter(
					(r) => r.characterId === e.id && /#\d+@/.test(r.key) && alive(r.key)
				);
				const impaired = reminders.filter(
					(r) => r.key === `${e.id}#${label.toLowerCase()}@${self.seatId}`
				);
				expect(normal, `${e.id} ${label}`).toEqual([]);
				expect(impaired, `${e.id} ${label}`).toHaveLength(1);
			}
			// Unimpaired, no impaired line shows.
			const { seats } = cast(e.id, []);
			const keys = run({ seats }).groups.flatMap((g) => g.reminders.map((r) => r.key));
			expect(
				keys.some((k) => /#(poisoned|drunk|no-ability)@/.test(k)),
				e.id
			).toBe(false);
		}
	});

	it('the Sailor: "cannot die" or "is poisoned", never both', () => {
		expect(texts({ seats: [seat('sailor')] })).toEqual(['[Sailor] cannot die']);
		const poisoned = seat('sailor', { reminders: [token('poisoner', 'Poisoned')] });
		expect(texts({ seats: [poisoned] })).toEqual(['[Sailor] is poisoned by [Poisoner]']);
		const both = seat('sailor', {
			reminders: [token('poisoner', 'Poisoned'), token('sailor', 'Drunk')]
		});
		expect(texts({ seats: [both] })).toEqual([
			'[Sailor] is poisoned by [Poisoner] and drunk by [Sailor]'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Minstrel: the Minstrel's own token does not make
	// the Minstrel drunk.
	it('does not read the Minstrel’s "Everyone Is Drunk" as the Minstrel being drunk', () => {
		const minstrel = seat('minstrel', { reminders: [token('minstrel', 'Everyone Is Drunk')] });
		expect(texts({ seats: [minstrel] })).toEqual([
			'[Minstrel] is alive',
			'[Minstrel] has made everyone drunk'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Preacher
	it('says a Minion the Preacher chose has no ability, naming the Preacher', () => {
		const { session, ctx, seats } = newGame(['Ana', 'Ben', 'Cat', 'Dev']);
		const g = runCommands(
			session,
			ctx,
			{ type: 'AssignCharacter', seatId: seats[0], characterId: 'preacher' },
			{ type: 'AssignCharacter', seatId: seats[1], characterId: 'witch' },
			{ type: 'AssignCharacter', seatId: seats[2], characterId: 'spy' },
			{ type: 'AssignCharacter', seatId: seats[3], characterId: 'nodashii' },
			{ type: 'AddReminder', seatId: seats[1], reminder: token('preacher', 'No Ability') },
			{ type: 'AddReminder', seatId: seats[2], reminder: token('preacher', 'No Ability') }
		).game;
		const state = dayStateFromGame(g, (id) => testCharacters.get(id), undefined, testCharacters);
		const lines = dayReminders(state).groups.flatMap((gr) =>
			gr.reminders.map((r) => renderReminder(r.segments, name))
		);
		expect(lines).toContain('[Witch · Ben] has no ability from [Preacher · Ana]');
		// The Spy has nothing to watch by day, but losing its ability is worth saying.
		expect(lines).toContain('[Spy · Cat] has no ability from [Preacher · Ana]');
		expect(lines.some((l) => l.startsWith('[Witch · Ben] has chosen'))).toBe(false);
	});
});

// https://wiki.bloodontheclocktower.com/Pixie
describe('Pixie', () => {
	it('stops asking the Pixie to be mad once the Mad player is dead', () => {
		const pixie = seat('pixie');
		const mad = seat('chef', { reminders: [token('pixie', 'Mad')] });
		expect(texts({ seats: [pixie, mad] })).toEqual(['[Pixie] must be mad as [Chef]']);
		expect(texts({ seats: [pixie, { ...mad, dead: true }] })).toEqual([]);
	});
});
