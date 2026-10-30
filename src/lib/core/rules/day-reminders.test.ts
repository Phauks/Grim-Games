/**
 * Pre-day reminders. Each official character's `dayReminders` lives in its rules block
 * (`data/rules/<id>.json`) and links its wiki page; the behaviour tests below cite the pages
 * they encode.
 */
import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import type { Character } from '#lib/core/data/types.ts';
import { OFFICIAL_RULES } from '#lib/core/data/rules/index.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import {
	newGame,
	run as runCommands,
	testCharacters
} from '#lib/core/model/fixtures.test-support.ts';
import {
	dayReminders,
	daySentence,
	dayStateFromGame,
	impairment,
	isOnceOnlyDayAbility,
	renderReminder,
	type DayReminderOverride,
	type ReminderSegment,
	type DaySeat,
	type DayState
} from './day-reminders.ts';

const data = committedGameData();
/** Official characters with something to watch by day, from their rules blocks. */
const DAY_REMINDER_ENTRIES = [...OFFICIAL_RULES].flatMap(([id, rules]) => {
	const day = rules.dayReminders;
	if (!day?.reminders?.length && !day?.impairable) return [];
	return [{ id, impairable: day.impairable, reminders: day.reminders ?? [] }];
});
/** Official characters with nothing to watch by day, and why. */
const NO_DAY_RELEVANCE = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) =>
		rules.dayReminders?.none === undefined ? [] : [[id, rules.dayReminders.none]]
	)
);
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
		// Trevor, 2026-10-23: the Pit-Hag acts only at night, so it is not a day ability.
		expect(NO_DAY_RELEVANCE.pithag).toBe('night action');
	});

	it('cites a wiki page and has text for every curated reminder', () => {
		for (const entry of DAY_REMINDER_ENTRIES) {
			expect(wikiUrl(data.byId.get(entry.id)!), entry.id).toMatch(
				/^https:\/\/wiki\.bloodontheclocktower\.com\/\S+$/
			);
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

	// https://wiki.bloodontheclocktower.com/Amnesiac: the Storyteller decides the ability.
	it('shows the Amnesiac’s ability once the Storyteller wrote it', () => {
		const amnesiac = seat('amnesiac');
		expect(texts({ seats: [amnesiac] })).toContain('[Amnesiac] ability is (ABILITY)');
		expect(
			texts({ seats: [amnesiac], prepValues: { 'amnesiac.ability': 'learns a number' } })
		).toContain('[Amnesiac] ability is (learns a number)');
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

	// The Drunk's and the Minstrel's rules blocks, given to custom characters.
	it('reads impairments from a custom character’s rules block', () => {
		const sot: Character = {
			id: 'sot',
			name: 'Sot',
			type: 'outsider',
			ability: 'You think you are a Townsfolk, but you are drunk.',
			setup: false,
			reminders: [],
			remindersGlobal: ['Drunk'],
			special: [],
			rules: { impairs: { self: { reason: 'drunk' } } }
		};
		const bard: Character = {
			...sot,
			id: 'bard',
			name: 'Bard',
			type: 'townsfolk',
			ability: 'When a Minion dies by execution, all other players are drunk until tomorrow.',
			reminders: ['All Drunk'],
			remindersGlobal: [],
			rules: { impairs: { tokens: { 'All Drunk': { reason: 'drunk', on: 'others' } } } }
		};
		const slayer = seat('slayer', { reminders: [token('sot', 'Drunk')] });
		expect(texts({ seats: [slayer] }, [sot])).toEqual(['[Slayer] is really the [Sot]']);
		const own = seat('bard', { reminders: [token('bard', 'All Drunk')] });
		expect(texts({ seats: [own] }, [bard]).some((t) => t.includes('drunk'))).toBe(false);
	});

	it('treats a homebrew copy of an official id as homebrew', () => {
		const copy = {
			...data.byId.get('chef')!,
			edition: undefined,
			ability: 'Each day, publicly cook.'
		};
		expect(texts({ seats: [seat('chef')] }, [copy])).toEqual(['[Chef] may act today']);
	});

	// A custom character's own `dayReminders` work as an official one's: the Sailor's
	// "cannot die" (https://wiki.bloodontheclocktower.com/Sailor) and the Spy's registration for
	// the Virgin (https://wiki.bloodontheclocktower.com/Spy).
	const parse = (raw: unknown, reminders: string[] = []) =>
		parseCharacterRules(raw, 'rules', new Issues(), reminders);
	const deckhand: Character = {
		id: 'deckhand',
		name: 'Deckhand',
		type: 'townsfolk',
		ability: 'You can not die.',
		setup: false,
		reminders: ['Marked'],
		remindersGlobal: [],
		special: [],
		rules: parse(
			{
				dayReminders: {
					impairable: true,
					reminders: [
						{ group: 'execution-death', template: [{ self: true }, { text: 'cannot die.' }] },
						{
							group: 'nomination',
							template: [{ self: true }, { text: 'has marked' }, { target: true }],
							when: { reminder: 'Marked' }
						}
					],
					interactions: [
						{
							other: 'virgin',
							group: 'nomination',
							text: 'may register as a Townsfolk if they nominate',
							otherNoReminder: 'No Ability'
						}
					]
				}
			},
			['Marked']
		)
	};

	it('shows a custom character’s own day reminders, not guessed ones', () => {
		const seats = [
			seat('deckhand'),
			seat('virgin', { playerName: 'Vi', reminders: [token('deckhand', 'Marked')] })
		];
		const reminders = run({ seats }, [deckhand]).groups.flatMap((g) => g.reminders);
		expect(reminders.every((r) => !r.autoDetected)).toBe(true);
		expect(texts({ seats }, [deckhand])).toEqual([
			'[Deckhand] has marked [Virgin · Vi]',
			'[Virgin · Vi] has not been nominated',
			'[Deckhand] may register as a Townsfolk if they nominate [Virgin · Vi]',
			'[Deckhand] cannot die.'
		]);
		const poisoned = seat('deckhand', { reminders: [token('poisoner', 'Poisoned')] });
		expect(texts({ seats: [poisoned] }, [deckhand])).toEqual([
			'[Deckhand] is poisoned by [Poisoner]'
		]);
	});

	it('shows nothing for a custom character whose rules say it has nothing by day', () => {
		const quiet = {
			...custom,
			id: 'mute',
			rules: parse({ dayReminders: { none: 'night action' } })
		};
		expect(texts({ seats: [seat('mute')] }, [quiet])).toEqual([]);
	});

	it('reports a malformed dayReminders block', () => {
		const issues = new Issues();
		parseCharacterRules(
			{
				dayReminders: {
					impairable: 'yes',
					none: 'night action',
					reminders: [
						{ group: 'lunch', template: [{ self: true }] },
						{ group: 'vote', template: [{ target: true }] },
						{ group: 'vote', template: [{ self: true }], when: { reminder: 'Hat', self: 'asleep' } }
					],
					interactions: [{ group: 'vote', text: 'x' }]
				}
			},
			'rules',
			issues,
			['Mad']
		);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.dayReminders.impairable',
			'rules.dayReminders.reminders[0].group',
			'rules.dayReminders.reminders[1].when.reminder',
			'rules.dayReminders.reminders[2].when.self',
			'rules.dayReminders.reminders[2].when.reminder',
			'rules.dayReminders.interactions[0].other',
			'rules.dayReminders.none'
		]);
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
		expect(texts({ seats: [seat('sailor')] })).toEqual(['[Sailor] cannot die.']);
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
		expect(texts({ seats: [pixie, mad] })).toEqual([
			'[Pixie] must be mad as [Chef] to gain their ability when they die.'
		]);
		expect(texts({ seats: [pixie, { ...mad, dead: true }] })).toEqual([]);
	});
});

describe('registration interactions', () => {
	it('the living Spy may register as a Townsfolk for the Virgin (https://wiki.bloodontheclocktower.com/Spy, /Virgin)', () => {
		const lines = texts({ seats: [seat('spy'), seat('virgin', { playerName: 'Vi' })] });
		expect(lines).toContain('[Spy] may register as a Townsfolk if they nominate [Virgin · Vi]');
	});

	it('not once the Virgin’s ability is used, the Spy is dead or poisoned', () => {
		const used = texts({
			seats: [seat('spy'), seat('virgin', { reminders: [token('virgin', 'No Ability')] })]
		});
		expect(used.some((l) => l.startsWith('[Spy] may register'))).toBe(false);
		const dead = texts({ seats: [seat('spy', { dead: true }), seat('virgin')] });
		expect(dead.some((l) => l.startsWith('[Spy] may register'))).toBe(false);
		const poisoned = texts({
			seats: [seat('spy', { reminders: [token('poisoner', 'Poisoned')] }), seat('virgin')]
		});
		expect(poisoned.some((l) => l.startsWith('[Spy] may register'))).toBe(false);
	});

	it('the Recluse may register as the Demon for the Slayer and the Golem (https://wiki.bloodontheclocktower.com/Recluse, /Slayer, /Golem)', () => {
		const lines = texts({ seats: [seat('recluse'), seat('slayer'), seat('golem')] });
		expect(lines).toContain('[Recluse] may register as the Demon if shot by [Slayer]');
		expect(lines).toContain('[Recluse] may register as the Demon if nominated by [Golem]');
	});

	it('nominations for the Town Crier (https://wiki.bloodontheclocktower.com/Town_Crier)', () => {
		const lines = texts({ seats: [seat('recluse'), seat('spy'), seat('towncrier')] });
		expect(lines).toContain('[Recluse] may register as a Minion when nominating, for [Town Crier]');
		expect(lines).toContain('[Spy] may register as not a Minion when nominating, for [Town Crier]');
	});
});

describe('daySentence', () => {
	const badge = (characterId: string): ReminderSegment => ({
		kind: 'character',
		ref: { characterId }
	});
	const words = (text: string): ReminderSegment => ({ kind: 'text', text });
	const shown = (segments: ReminderSegment[]) => {
		const { segments: out, stop } = daySentence(segments);
		return renderReminder(out) + (stop ? '.' : '');
	};

	// Trevor (2026-10-18): the day view's lines are proper sentences.
	it('opens with a capital and ends with a full stop', () => {
		expect(shown([words('is alive')])).toBe('Is alive.');
		expect(shown([words('cannot die.')])).toBe('Cannot die.');
		expect(shown([words('may kill before nominations?')])).toBe('May kill before nominations?');
	});

	it('keeps the verb lower case after a leading badge, and stops after a trailing one', () => {
		expect(shown([badge('saint'), words('is alive')])).toBe('[saint] is alive.');
		const { segments, stop } = daySentence([words('has chosen'), badge('librarian')]);
		expect(segments[0]).toEqual(words('Has chosen'));
		expect(stop).toBe(true);
	});

	it('makes every curated line a sentence, the character heading left out', () => {
		for (const entry of DAY_REMINDER_ENTRIES) {
			for (const spec of entry.reminders) {
				const segments = spec.template.map((t): ReminderSegment =>
					'text' in t
						? words(t.text)
						: 'value' in t
							? { kind: 'value', characterId: entry.id, key: t.value, placeholder: t.placeholder }
							: badge(entry.id)
				);
				const line = segments[0]?.kind === 'character' ? segments.slice(1) : segments;
				const text = shown(line);
				expect(text, entry.id).toMatch(/^[A-Z[(]/);
				expect(text, entry.id).toMatch(/[.!?]$/);
			}
		}
	});
});
