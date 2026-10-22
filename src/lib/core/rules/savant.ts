/**
 * Savant information (L2): statements worked out from the grimoire, so the Storyteller can
 * give one true and one false (https://wiki.bloodontheclocktower.com/Savant).
 *
 * Every template is our own wording, approved by Trevor; none is copied from another
 * generator or the wiki. Each one works out whether it holds right now in every way the
 * players may register (`registrationWorlds`: Spy, Recluse, Faux Paw, a Traveller with no
 * alignment yet):
 * - `true` / `false`: the same in every world;
 * - `either`: it depends on how someone registers (`dependsOn`), so it may fill either slot.
 *
 * Kept interesting (Trevor's brief: "both interesting"): nothing public (how many are dead,
 * what is on the script), nothing about the Savant's own seat, no true line naming the
 * Demon's player, and false numbers stay close to the truth.
 *
 * Who decides: a suggestion, never the final word. A drunk or poisoned Savant may hear two
 * true or two false statements; while a working Vortox is in play a sober Savant hears two
 * false ones (https://wiki.bloodontheclocktower.com/Vortox). `savantSituation` says which
 * applies; the Storyteller still picks the mode.
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import {
	alignmentOf,
	aliveNeighbours,
	getSeat,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import { BASE_DISTRIBUTION } from './distribution.ts';
import type { DayEntry, DayLog, Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrationWorlds, type RegistrationWorld } from './ability.ts';
import { abnormalSinceDawn, reliability } from './night-info.ts';

export const SAVANT_GROUPS = [
	'characters',
	'counts',
	'alignment',
	'types',
	'demon',
	'today',
	'manual'
] as const;
export type SavantGroup = (typeof SAVANT_GROUPS)[number];

/** A piece of a statement: our words, a seat, a character (a badge), a type or a number. */
export type SavantPart =
	| { text: string }
	| { seat: SeatId }
	| { character: CharacterId }
	| { type: CharacterType }
	| { number: number };

/**
 * `check`: the app cannot know (what players chose at night, private chats), so the
 * Storyteller says whether it holds.
 */
export type SavantTruth = 'true' | 'false' | 'either' | 'check';

export interface SavantStatement {
	/** Template and blanks: two statements with the same key say the same thing. */
	key: string;
	template: string;
	group: SavantGroup;
	parts: SavantPart[];
	truth: SavantTruth;
	/** Whether it holds with everyone registering as they truly are. */
	byDefault: boolean;
	/** With `either`: the players whose registration decides it. */
	dependsOn: SeatId[];
}

/** One true and one false, or two of a kind (a drunk or poisoned Savant, the Vortox). */
export type SavantMode = 'one-each' | 'both-true' | 'both-false';

export interface SavantSituation {
	/** The Savant's ability does not work: any mode is allowed. */
	impaired?: 'drunk' | 'poisoned' | 'no-ability';
	/** A working Vortox is in play and the Savant is sober: both must be false. */
	vortox?: SeatId;
	/** The mode the rules point to. */
	mode: SavantMode;
}

/** What the rules say the Savant should hear today. */
export function savantSituation(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): SavantSituation {
	const r = reliability(game, seatId, 'savant', characters);
	if (r.unreliable) return { impaired: r.unreliable, mode: 'one-each' };
	if (r.mustBeFalse && r.vortox !== undefined) return { vortox: r.vortox, mode: 'both-false' };
	return { mode: 'one-each' };
}

// ── Facts the templates read ────────────────────────────────────────────────

const text = (t: string): SavantPart => ({ text: t });

interface Facts {
	game: Game;
	characters: CharacterLookup;
	savant: SeatId;
	/** Seats with a character, in seating order. */
	seats: SeatId[];
	n: number;
	others: SeatId[];
	inPlay: Set<CharacterId>;
	/** Script characters a player can be (no Travellers, Fabled or Loric). */
	script: CharacterId[];
	dead: (s: SeatId) => boolean;
	/** The day log closed by the last "New day": yesterday and last night. */
	yesterday?: DayLog;
	/** The game just after each "New day", oldest first (the first is the start). */
	dawns: readonly Game[];
	/** The game at this morning's "New day", when there was one. */
	lastDawn?: Game;
	/** The night just gone was the first night. */
	firstNightJustGone: boolean;
	impaired: (s: SeatId) => boolean;
}

/** Steps round the circle between two seats, the shorter way. */
function distance(f: Facts, a: SeatId, b: SeatId): number {
	const d = Math.abs(f.game.seating.indexOf(a) - f.game.seating.indexOf(b));
	return Math.min(d, f.game.seating.length - d);
}

/** The seats either side, alive or dead. */
function sideBySide(f: Facts, s: SeatId): SeatId[] {
	const { seating } = f.game;
	const i = seating.indexOf(s);
	const n = seating.length;
	return [seating[(i - 1 + n) % n], seating[(i + 1) % n]].filter(
		(x, j, all) => x !== s && all.indexOf(x) === j
	);
}

// ── Templates ───────────────────────────────────────────────────────────────

/** One filled-in template: its words, and whether it holds in a world. */
interface Instance {
	blanks: string;
	parts: SavantPart[];
	holds: (w: RegistrationWorld) => boolean;
	/** The Storyteller decides (`check`). */
	manual?: boolean;
}

interface Template {
	id: string;
	group: SavantGroup;
	instances: (f: Facts, w0: RegistrationWorld) => Instance[];
}

/** Numbers to offer for a count: the truth and up to two either side, within the range. */
function near(truth: number, min: number, max: number): number[] {
	const out: number[] = [];
	for (let v = truth - 2; v <= truth + 2; v++) if (v >= min && v <= max) out.push(v);
	return out;
}

/** "There are N …" templates: a count in each world, offered near the default world's. */
function count(
	id: string,
	group: SavantGroup,
	value: (f: Facts, w: RegistrationWorld) => number | undefined,
	words: (n: number) => SavantPart[],
	max: (f: Facts) => number,
	min = 0
): Template {
	return {
		id,
		group,
		instances(f, w0) {
			const truth = value(f, w0);
			if (truth === undefined) return [];
			return near(truth, Math.min(min, truth), Math.max(max(f), truth)).map((v) => ({
				blanks: String(v),
				parts: words(v),
				holds: (w) => value(f, w) === v
			}));
		}
	};
}

const alive = (f: Facts) => f.seats.filter((s) => !f.dead(s));
const typed = (f: Facts, w: RegistrationWorld, t: CharacterType) =>
	f.seats.filter((s) => w.type(s) === t);
const isEvil = (w: RegistrationWorld, s: SeatId) => w.alignment(s) === 'evil';

/** The one Demon's seat, or none when there is no Demon or more than one (Legion). */
function demonSeat(f: Facts, w: RegistrationWorld): SeatId | undefined {
	const demons = typed(f, w, 'demon');
	return demons.length === 1 ? demons[0] : undefined;
}

const demonsOnScript = (f: Facts) =>
	f.script.filter((id) => f.characters.get(id)?.type === 'demon').length;

function pairs<T>(list: readonly T[]): [T, T][] {
	const out: [T, T][] = [];
	for (let i = 0; i < list.length; i++)
		for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]);
	return out;
}

/** The longest run of players of one alignment round the circle (all of them if everyone is). */
function longestRun(f: Facts, w: RegistrationWorld, alignment: 'good' | 'evil'): number {
	const seating = f.game.seating;
	const good = seating.map((s) => w.alignment(s) === alignment);
	if (good.every(Boolean)) return seating.length;
	let best = 0;
	let run = 0;
	for (let i = 0; i < seating.length * 2; i++) {
		run = good[i % seating.length] ? run + 1 : 0;
		best = Math.max(best, run);
	}
	return best;
}

const hasReminder = (f: Facts, s: SeatId, characterId: CharacterId, label: string) =>
	f.game.seats[s].reminders.some((r) => r.characterId === characterId && r.label === label);
const hasLabel = (f: Facts, s: SeatId, label: string) =>
	f.game.seats[s].reminders.some((r) => r.label === label);
const ownNoAbility = (f: Facts, s: SeatId) =>
	f.game.seats[s].reminders.some(
		(r) => r.label === 'No Ability' && r.characterId === trueCharacter(f.game, s, f.characters)
	);
const seatOf = (f: Facts, id: CharacterId) =>
	f.seats.find((s) => trueCharacter(f.game, s, f.characters) === id);
const nominations = (log: DayLog | undefined) =>
	(log?.entries ?? []).filter(
		(e): e is Extract<DayEntry, { kind: 'nomination' }> => e.kind === 'nomination'
	);

/** A Minion's reminders that mark whom it chose (TPI's reminder names). */
const MINION_CHOICES: Readonly<Record<CharacterId, readonly string[]>> = {
	poisoner: ['Poisoned'],
	widow: ['Poisoned'],
	witch: ['Cursed'],
	cerenovus: ['Mad'],
	harpy: ['Mad'],
	fearmonger: ['Fear'],
	devilsadvocate: ['Survives Execution'],
	assassin: ['Dead'],
	godfather: ['Dead']
};

function triples<T>(list: readonly T[]): [T, T, T][] {
	const out: [T, T, T][] = [];
	for (let i = 0; i < list.length; i++)
		for (let j = i + 1; j < list.length; j++)
			for (let k = j + 1; k < list.length; k++) out.push([list[i], list[j], list[k]]);
	return out;
}

/**
 * The two statements the app cannot work out: what the Snake Charmer chose leaves no trace
 * unless it hits the Demon, and declining an ability is not recorded. The Storyteller says
 * whether each holds (`check`).
 */
function manual(id: string, parts: (f: Facts) => SavantPart[] | undefined): Template {
	return {
		id,
		group: 'manual',
		instances(f) {
			const p = parts(f);
			return p ? [{ blanks: '', parts: p, holds: () => false, manual: true }] : [];
		}
	};
}

/** A Townsfolk's reminders that mark whom it chose last night (TPI's reminder names). */
const TOWNSFOLK_CHOICES: Readonly<Record<CharacterId, readonly string[]>> = {
	monk: ['Safe'],
	innkeeper: ['Safe'],
	exorcist: ['Chosen']
};

/** Characters whose night information is a number. */
const NUMBER_INFO: ReadonlySet<CharacterId> = new Set([
	'chef',
	'empath',
	'clockmaker',
	'mathematician',
	'oracle',
	'juggler',
	'chambermaid'
]);

/** Information characters whose ability works once per game. */
const ONCE_INFO: ReadonlySet<CharacterId> = new Set(['seamstress', 'fisherman', 'artist']);

/**
 * Why a Minion might not learn the Demon at the start: fewer than 7 players (wiki Glossary,
 * "Minion Info"), the Magician,
 * the Marionette (never learns), the Poppy Grower, Lil' Monsta.
 * https://wiki.bloodontheclocktower.com/Magician, /Marionette, /Poppy_Grower, /Lil%27_Monsta
 */
const HIDES_DEMON: readonly CharacterId[] = ['magician', 'marionette', 'poppygrower', 'lilmonsta'];

const infoEntries = (log: DayLog | undefined) =>
	(log?.entries ?? []).filter((e): e is Extract<DayEntry, { kind: 'info' }> => e.kind === 'info');

/** Whether a character wakes on the night just gone. */
function wakes(f: Facts, id: CharacterId | undefined): boolean {
	const c = id === undefined ? undefined : f.characters.get(id);
	return ((f.firstNightJustGone ? c?.firstNight : c?.otherNight) ?? 0) > 0;
}

/** Characters by seat in a game, true characters. */
const castOf = (f: Facts, g: Game) =>
	new Map(g.seating.map((s) => [s, trueCharacter(g, s, f.characters)] as const));

/** Whether the Demon may pass to another player (the Imp, Fang Gu, Scarlet Woman, Pit-Hag). */
function demonCanPass(f: Facts, w: RegistrationWorld): boolean | undefined {
	const d = demonSeat(f, w);
	if (d === undefined) return undefined;
	const demon = trueCharacter(f.game, d, f.characters);
	const living = (t: CharacterType) => alive(f).some((s) => s !== d && w.type(s) === t);
	const livingAs = (id: CharacterId) =>
		alive(f).some((s) => trueCharacter(f.game, s, f.characters) === id);
	return (
		(demon === 'imp' && living('minion')) ||
		(demon === 'fanggu' && living('outsider')) ||
		(livingAs('scarletwoman') && alive(f).length >= 5) ||
		livingAs('pithag')
	);
}

const LOG_TEMPLATES: readonly Template[] = [
	count(
		'townsfolk-chose-evil',
		'today',
		// Only choices that leave a reminder: the Monk's and Innkeeper's Safe, the Exorcist's Chosen.
		(f, w) => {
			const choosers = Object.keys(TOWNSFOLK_CHOICES).filter((id) => f.inPlay.has(id));
			if (choosers.length === 0) return undefined;
			return choosers.filter((id) =>
				f.seats.some(
					(s) => isEvil(w, s) && TOWNSFOLK_CHOICES[id].some((l) => hasReminder(f, s, id, l))
				)
			).length;
		},
		(n) => [
			{ number: n },
			text(' '),
			{ type: 'townsfolk' },
			text(n === 1 ? ' chose an evil player last night.' : ' chose evil players last night.')
		],
		(f) => Object.keys(TOWNSFOLK_CHOICES).filter((id) => f.inPlay.has(id)).length
	),
	{
		id: 'townsfolk-true-info',
		group: 'today',
		instances(f) {
			const told = infoEntries(f.yesterday).filter(
				(e) => f.characters.get(e.characterId)?.type === 'townsfolk'
			);
			if (told.length === 0) return [];
			return [
				{
					blanks: '',
					parts: [text('Every '), { type: 'townsfolk' }, text(' got true information last night.')],
					holds: () => told.every((e) => (e.abnormal ?? []).length === 0)
				}
			];
		}
	},
	{
		id: 'good-woke',
		group: 'today',
		instances: (f) =>
			f.lastDawn
				? [
						{
							blanks: '',
							parts: [text('A good player woke last night.')],
							holds: (w: RegistrationWorld) =>
								alive(f).some(
									(s) =>
										s !== f.savant &&
										w.alignment(s) === 'good' &&
										wakes(f, trueCharacter(f.game, s, f.characters))
								)
						}
					]
				: []
	},
	count(
		'evil-woke',
		'today',
		(f, w) =>
			f.lastDawn
				? alive(f).filter((s) => isEvil(w, s) && wakes(f, trueCharacter(f.game, s, f.characters)))
						.length
				: undefined,
		(n) => [
			{ number: n },
			text(n === 1 ? ' evil player woke last night.' : ' evil players woke last night.')
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'given-number',
		'today',
		(f) => {
			const told = infoEntries(f.yesterday).filter((e) => NUMBER_INFO.has(e.characterId));
			return told.length === 0 ? undefined : new Set(told.map((e) => e.seatId)).size;
		},
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player was given a number last night.'
					: ' players were given a number last night.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	{
		id: 'minion-same-player',
		group: 'today',
		// Where the Minion's choice reminder sat at each dawn, over at least two nights.
		instances(f) {
			if (f.dawns.length < 2) return [];
			return Object.entries(MINION_CHOICES)
				.filter(([minion]) => f.inPlay.has(minion))
				.map(([minion, labels]) => ({
					blanks: minion,
					parts: [
						text('The '),
						{ character: minion },
						text(' has chosen the same player every night.')
					],
					holds: () => {
						const chosen = f.dawns.map((g) =>
							g.seating.find((s) =>
								g.seats[s].reminders.some(
									(r) => r.characterId === minion && labels.includes(r.label)
								)
							)
						);
						return chosen[0] !== undefined && chosen.every((s) => s === chosen[0]);
					}
				}));
		}
	},
	{
		id: 'more-than-start',
		group: 'counts',
		instances(f) {
			const start = f.dawns[0];
			if (!start || f.dawns.length < 2) return [];
			const countIn = (g: Game, t: CharacterType) =>
				g.seating.filter((s) => typeOf(g, s, f.characters) === t).length;
			return (['outsider', 'townsfolk'] as const).flatMap((t) =>
				(['more', 'fewer'] as const).map((m) => ({
					blanks: `${t}|${m}`,
					parts: [text(`There are ${m} `), { type: t }, text(' than at the start.')],
					holds: () =>
						m === 'more'
							? countIn(f.game, t) > countIn(start, t)
							: countIn(f.game, t) < countIn(start, t)
				}))
			);
		}
	},
	{
		id: 'once-false',
		group: 'today',
		instances(f) {
			const told = f.game.pastDays
				.concat(f.game.today)
				.flatMap((log) => infoEntries(log))
				.filter((e) => ONCE_INFO.has(e.characterId));
			if (told.length === 0) return [];
			return [
				{
					blanks: '',
					parts: [text('A once-per-game ability gave false information.')],
					holds: () => told.some((e) => (e.abnormal ?? []).length > 0)
				}
			];
		}
	},
	{
		id: 'demon-cannot-pass',
		group: 'demon',
		instances: (f, w0) =>
			demonCanPass(f, w0) === undefined
				? []
				: [
						{
							blanks: '',
							parts: [text('The Demon cannot pass to another player.')],
							holds: (w: RegistrationWorld) => demonCanPass(f, w) === false
						}
					]
	},
	{
		id: 'changed-since',
		group: 'today',
		// Between yesterday's New day and this morning's.
		instances(f) {
			const [before, after] = [f.dawns.at(-2), f.dawns.at(-1)];
			if (!before || !after) return [];
			const a = castOf(f, before);
			const b = castOf(f, after);
			const newCharacter = [...b.values()].some(
				(id) => id !== undefined && ![...a.values()].includes(id)
			);
			const changed = after.seating.some((s) => a.get(s) !== undefined && a.get(s) !== b.get(s));
			const turned = after.seating.some(
				(s) => before.seats[s] && alignmentOf(before, s) !== alignmentOf(after, s)
			);
			return [
				{
					blanks: 'new',
					parts: [text('No new character came into play last night.')],
					holds: () => !newCharacter
				},
				{
					blanks: 'character',
					parts: [text("A player's character changed last night.")],
					holds: () => changed
				},
				{
					blanks: 'alignment',
					parts: [text("A player's alignment changed last night.")],
					holds: () => turned
				}
			];
		}
	},
	{
		id: 'minion-unaware',
		group: 'demon',
		instances: (f) =>
			typed(
				f,
				{
					alignment: (s) => alignmentOf(f.game, s),
					type: (s) => typeOf(f.game, s, f.characters),
					misregistered: []
				},
				'minion'
			).length === 0
				? []
				: [
						{
							blanks: '',
							parts: [
								text('At least one '),
								{ type: 'minion' },
								text(' did not learn who the Demon was at the start.')
							],
							holds: () => f.n < 7 || HIDES_DEMON.some((id) => f.inPlay.has(id))
						}
					]
	},
	{
		id: 'started-good',
		group: 'alignment',
		instances(f) {
			const start = f.dawns[0];
			if (!start) return [];
			return f.others
				.filter((s) => start.seats[s] && trueCharacter(f.game, s, f.characters) !== undefined)
				.map((s) => {
					const id = trueCharacter(f.game, s, f.characters)!;
					return {
						blanks: id,
						parts: [{ character: id }, text(' started the game good and is now evil.')],
						holds: () => alignmentOf(start, s) === 'good' && alignmentOf(f.game, s) === 'evil'
					};
				})
				.filter((x) => f.characters.get(x.blanks)?.type !== 'demon');
		}
	},
	{
		id: 'lunatic-demon',
		group: 'today',
		// The Lunatic's Chosen reminders against whom the Demon killed last night.
		instances(f) {
			if (!f.inPlay.has('lunatic') || !f.dawns.at(-1)) return [];
			const before = f.dawns.at(-2);
			const victims = f.seats.filter((s) => {
				const seat = f.dawns.at(-1)!.seats[s];
				const cause = seat?.deathCause;
				const byDemon =
					cause === 'demon' || (cause !== undefined && f.characters.get(cause)?.type === 'demon');
				return seat?.dead && byDemon && !(before?.seats[s]?.dead ?? false);
			});
			if (victims.length === 0) return [];
			const chosen = f.seats.filter((s) => hasReminder(f, s, 'lunatic', 'Chosen'));
			return [
				{
					blanks: '',
					parts: [
						text('The '),
						{ character: 'lunatic' },
						text(' and the Demon chose different players last night.')
					],
					holds: () => !victims.some((v) => chosen.includes(v))
				}
			];
		}
	},
	{
		id: 'character-true-info',
		group: 'today',
		instances: (f) =>
			[...new Set(infoEntries(f.yesterday).map((e) => e.characterId))]
				.filter((id) => id !== 'savant')
				.map((id) => ({
					blanks: id,
					parts: [
						text('The '),
						{ character: id },
						text(' got sober, healthy and true information last night.')
					],
					holds: () =>
						infoEntries(f.yesterday)
							.filter((e) => e.characterId === id)
							.every((e) => (e.abnormal ?? []).length === 0)
				}))
	},
	{
		id: 'poisoned-true',
		group: 'today',
		// Only when a poisoned Townsfolk's info was recorded; whether it was true is the Storyteller's call.
		instances: (f) =>
			infoEntries(f.yesterday).some(
				(e) =>
					f.characters.get(e.characterId)?.type === 'townsfolk' &&
					(e.abnormal ?? []).some((c) => c.reason === 'poisoned')
			)
				? [
						{
							blanks: '',
							parts: [
								text('A poisoned '),
								{ type: 'townsfolk' },
								text(' got true information last night.')
							],
							holds: () => false,
							manual: true
						}
					]
				: []
	},
	manual('snake-charmer-chose', (f) =>
		f.inPlay.has('snakecharmer')
			? [
					text('The '),
					{ character: 'snakecharmer' },
					text(' chose a '),
					{ type: 'minion' },
					text(' last night.')
				]
			: undefined
	),
	manual('declined', () => [text('Someone chose not to use their ability last night.')])
];

export const SAVANT_TEMPLATES: readonly Template[] = [
	// ── Characters ──
	{
		id: 'in-play',
		group: 'characters',
		instances: (f) =>
			f.script
				.filter((id) => f.characters.get(id)?.type !== 'demon')
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' is in play.')],
					holds: () => f.inPlay.has(id)
				}))
	},
	{
		id: 'not-in-play',
		group: 'characters',
		// A Demon too, on a script with more than one.
		instances: (f) =>
			f.script
				.filter((id) => f.characters.get(id)?.type !== 'demon' || demonsOnScript(f) > 1)
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' is not in play.')],
					holds: () => !f.inPlay.has(id)
				}))
	},
	{
		id: 'either-in-play',
		group: 'characters',
		// Two characters of the same type, so the line is a real choice.
		instances: (f) =>
			pairs(f.script.filter((id) => f.characters.get(id)?.type !== 'demon'))
				.filter(([a, b]) => f.characters.get(a)?.type === f.characters.get(b)?.type)
				.map(([a, b]) => ({
					blanks: `${a}|${b}`,
					parts: [{ character: a }, text(' or '), { character: b }, text(' is in play.')],
					holds: () => f.inPlay.has(a) || f.inPlay.has(b)
				}))
	},
	{
		id: 'bluff',
		group: 'characters',
		instances(f) {
			const bluffs = f.game.bluffs[0] ?? [];
			if (bluffs.length === 0) return [];
			return f.script
				.filter(
					(id) =>
						!f.inPlay.has(id) &&
						['townsfolk', 'outsider'].includes(f.characters.get(id)?.type ?? '')
				)
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(" is one of the Demon's bluffs.")],
					holds: () => bluffs.includes(id)
				}));
		}
	},
	// ── Counts ──
	count(
		'outsiders',
		'counts',
		(f, w) => typed(f, w, 'outsider').length,
		(n) => [
			text('There '),
			text(n === 1 ? 'is ' : 'are '),
			{ number: n },
			text(n === 1 ? ' Outsider in play.' : ' Outsiders in play.')
		],
		(f) => Math.min(f.n - 2, 4)
	),
	count(
		'minions-alive',
		'counts',
		(f, w) => typed(f, w, 'minion').filter((s) => !f.dead(s)).length,
		(n) => [{ number: n }, text(n === 1 ? ' Minion is alive.' : ' Minions are alive.')],
		(f) => Math.min(alive(f).length, 4)
	),
	count(
		'dead-evil',
		'counts',
		(f, w) => {
			const dead = f.seats.filter(f.dead);
			return dead.length === 0 ? undefined : dead.filter((s) => isEvil(w, s)).length;
		},
		(n) => [
			{ number: n },
			text(n === 1 ? ' of the dead players is evil.' : ' of the dead players are evil.')
		],
		(f) => f.seats.filter(f.dead).length
	),
	count(
		'impaired',
		'counts',
		(f) => f.seats.filter(f.impaired).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player is drunk or poisoned right now.'
					: ' players are drunk or poisoned right now.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'townsfolk-alive',
		'counts',
		(f, w) => typed(f, w, 'townsfolk').filter((s) => !f.dead(s)).length,
		(n) => [{ number: n }, text(n === 1 ? ' Townsfolk is alive.' : ' Townsfolk are alive.')],
		(f) => alive(f).length,
		1
	),
	// ── Alignment and seating ──
	{
		id: 'same-alignment',
		group: 'alignment',
		instances: (f) =>
			pairs(f.others).flatMap(([a, b]) => [
				{
					blanks: `${a}|${b}|same`,
					parts: [{ seat: a }, text(' and '), { seat: b }, text(' have the same alignment.')],
					holds: (w) => w.alignment(a) !== undefined && w.alignment(a) === w.alignment(b)
				},
				{
					blanks: `${a}|${b}|different`,
					parts: [{ seat: a }, text(' and '), { seat: b }, text(' have different alignments.')],
					holds: (w) =>
						w.alignment(a) !== undefined &&
						w.alignment(b) !== undefined &&
						w.alignment(a) !== w.alignment(b)
				}
			])
	},
	count(
		'evil-neighbours',
		'alignment',
		(f, w) => aliveNeighbours(f.game, f.savant).filter((s) => isEvil(w, s)).length,
		(n) => [
			{ number: n },
			text(n === 1 ? ' of your living neighbours is evil.' : ' of your living neighbours are evil.')
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	count(
		'evil-pairs',
		'alignment',
		(f, w) => {
			const s = f.game.seating;
			return s.filter((x, i) => isEvil(w, x) && isEvil(w, s[(i + 1) % s.length])).length;
		},
		(n) => [text('A Chef would learn '), { number: n }, text('.')],
		(f) => Math.min(f.n, 4)
	),
	{
		id: 'alignment',
		group: 'alignment',
		instances: (f) =>
			f.others.flatMap((s) =>
				(['good', 'evil'] as const).map((a) => ({
					blanks: `${s}|${a}`,
					parts: [{ seat: s }, text(` is ${a}.`)],
					holds: (w: RegistrationWorld) => w.alignment(s) === a
				}))
			)
	},
	...(['good', 'evil'] as const).map((a) =>
		count(
			`${a}-run`,
			'alignment',
			(f, w) => longestRun(f, w, a),
			(n) => [
				text(`The longest unbroken run of ${a} players around the circle is `),
				{ number: n },
				text('.')
			],
			(f) => f.n,
			a === 'good' ? 1 : 0
		)
	),
	// ── Character types ──
	{
		id: 'one-of-two',
		group: 'types',
		// Like the Washerwoman, Librarian or Investigator: the character is one of the two.
		instances: (f) =>
			f.script
				.filter((id) =>
					['townsfolk', 'outsider', 'minion'].includes(f.characters.get(id)?.type ?? '')
				)
				.flatMap((id) =>
					pairs(f.others).map(([a, b]) => ({
						blanks: `${id}|${a}|${b}`,
						parts: [
							text('One of '),
							{ seat: a },
							text(' and '),
							{ seat: b },
							text(' is the '),
							{ character: id },
							text('.')
						],
						holds: () =>
							trueCharacter(f.game, a, f.characters) === id ||
							trueCharacter(f.game, b, f.characters) === id
					}))
				)
	},
	{
		id: 'is-type',
		group: 'types',
		instances: (f) =>
			f.others.flatMap((s) =>
				(['townsfolk', 'outsider', 'minion'] as const).map((t) => ({
					blanks: `${s}|${t}`,
					parts: [
						{ seat: s },
						text(` is ${t === 'outsider' ? 'an' : 'a'} `),
						{ type: t },
						text('.')
					],
					holds: (w: RegistrationWorld) => w.type(s) === t
				}))
			)
	},
	{
		id: 'type-beside',
		group: 'types',
		instances: (f) =>
			(['townsfolk', 'outsider', 'minion', 'demon'] as const).map((t) => ({
				blanks: t,
				parts: [
					text(`${t === 'outsider' ? 'An' : 'A'} `),
					{ type: t },
					text(' is sitting next to you.')
				],
				holds: (w: RegistrationWorld) => sideBySide(f, f.savant).some((s) => w.type(s) === t)
			}))
	},
	// ── The Demon ──
	{
		id: 'demon-is',
		group: 'demon',
		// Only on scripts with more than one Demon: with one, the answer is on the script.
		instances(f) {
			if (demonsOnScript(f) < 2) return [];
			return f.script
				.filter((id) => f.characters.get(id)?.type === 'demon')
				.map((id) => ({
					blanks: id,
					parts: [text('The Demon is the '), { character: id }, text('.')],
					holds: (w: RegistrationWorld) => {
						const d = demonSeat(f, w);
						return d !== undefined && trueCharacter(f.game, d, f.characters) === id;
					}
				}));
		}
	},
	{
		id: 'demon-beside',
		group: 'demon',
		instances: (f) =>
			(['minion', 'outsider'] as const).flatMap((t) => {
				const beside = (w: RegistrationWorld) => {
					const d = demonSeat(f, w);
					return d !== undefined && sideBySide(f, d).some((s) => w.type(s) === t);
				};
				const a = t === 'outsider' ? 'an' : 'a';
				return [
					{
						blanks: `${t}|yes`,
						parts: [text(`The Demon is sitting next to ${a} `), { type: t }, text('.')],
						holds: beside
					},
					{
						blanks: `${t}|no`,
						parts: [text('The Demon is not sitting next to any '), { type: t }, text('.')],
						holds: (w: RegistrationWorld) => demonSeat(f, w) !== undefined && !beside(w)
					}
				];
			})
	},
	count(
		'demon-townsfolk',
		'demon',
		(f, w) => {
			const d = demonSeat(f, w);
			return d === undefined
				? undefined
				: sideBySide(f, d).filter((s) => w.type(s) === 'townsfolk').length;
		},
		(n) => [
			text('The Demon is sitting next to '),
			{ number: n },
			text(' '),
			{ type: 'townsfolk' },
			text('.')
		],
		() => 2
	),
	count(
		'demon-minion-distance',
		'demon',
		// Like the Clockmaker: steps from the Demon to its nearest Minion.
		(f, w) => {
			const d = demonSeat(f, w);
			const minions = typed(f, w, 'minion');
			if (d === undefined || minions.length === 0) return undefined;
			return Math.min(...minions.map((m) => distance(f, d, m)));
		},
		(n) => [
			text('The Demon is '),
			{ number: n },
			text(n === 1 ? ' seat from its nearest Minion.' : ' seats from its nearest Minion.')
		],
		(f) => Math.floor(f.game.seating.length / 2),
		1
	),
	{
		id: 'demon-within',
		group: 'demon',
		instances(f, w0) {
			const max = Math.floor(f.game.seating.length / 2) - 1;
			if (demonSeat(f, w0) === undefined || max < 1) return [];
			return Array.from({ length: max }, (_, i) => i + 1).map((n) => ({
				blanks: String(n),
				parts: [
					text('The Demon is within '),
					{ number: n },
					text(n === 1 ? ' seat of you.' : ' seats of you.')
				],
				holds: (w: RegistrationWorld) => {
					const d = demonSeat(f, w);
					return d !== undefined && distance(f, d, f.savant) <= n;
				}
			}));
		}
	},
	// ── Today ──
	{
		id: 'evil-nominated',
		group: 'today',
		instances(f) {
			const nominators = f.game.today.entries
				.filter((e): e is Extract<DayEntry, { kind: 'nomination' }> => e.kind === 'nomination')
				.map((e) => e.nominator);
			if (nominators.length === 0) return [];
			const any = (w: RegistrationWorld) => nominators.some((s) => isEvil(w, s));
			return [
				{ blanks: 'yes', parts: [text('An evil player has nominated today.')], holds: any },
				{
					blanks: 'no',
					parts: [text('No evil player has nominated today.')],
					holds: (w: RegistrationWorld) => !any(w)
				}
			];
		}
	},
	{
		id: 'evil-dead',
		group: 'today',
		instances(f) {
			const dead = f.seats.filter(f.dead);
			if (dead.length === 0) return [];
			const any = (w: RegistrationWorld) => dead.some((s) => isEvil(w, s));
			return [
				{ blanks: 'yes', parts: [text('An evil player is dead.')], holds: any },
				{
					blanks: 'no',
					parts: [text('Every evil player is alive.')],
					holds: (w: RegistrationWorld) => !any(w)
				}
			];
		}
	},
	// ── From The Grimoire's generator, reworded (Trevor, 2026-10-22: "include all") ──
	{
		id: 'outsiders-changed',
		group: 'counts',
		// Against the setup sheet's count for this many dealt players.
		instances(f) {
			const dealt = f.seats.filter((s) => typeOf(f.game, s, f.characters) !== 'traveller');
			const base = BASE_DISTRIBUTION[dealt.length]?.outsider;
			if (base === undefined) return [];
			const changed = () =>
				dealt.filter((s) => typeOf(f.game, s, f.characters) === 'outsider').length !== base;
			return [
				{
					blanks: 'yes',
					parts: [text('The number of Outsiders was changed during setup.')],
					holds: changed
				},
				{
					blanks: 'no',
					parts: [text('The number of Outsiders was not changed during setup.')],
					holds: () => !changed()
				}
			];
		}
	},
	count(
		'abnormal-last-night',
		'today',
		// From the night info recorded as abnormal before the last "New day".
		(f) => (f.yesterday ? abnormalSinceDawn({ ...f.game, today: f.yesterday }).length : undefined),
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' ability did not work as it should last night.'
					: ' abilities did not work as they should last night.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'mad',
		'today',
		(f) => f.seats.filter((s) => hasLabel(f, s, 'Mad')).length,
		(n) => [
			text('At least '),
			{ number: n },
			text(n === 1 ? ' player is mad right now.' : ' players are mad right now.')
		],
		(f) => Math.min(f.n, 3)
	),
	{
		id: 'mad-alignment',
		group: 'today',
		instances: (f) => {
			const mad = f.seats.filter((s) => hasLabel(f, s, 'Mad'));
			return [
				{
					blanks: 'none',
					parts: [text('No one is mad right now.')],
					holds: () => mad.length === 0
				},
				...(['good', 'evil'] as const).map((a) => ({
					blanks: a,
					parts: [text(`${a === 'evil' ? 'An' : 'A'} ${a} player is mad right now.`)],
					holds: (w: RegistrationWorld) => mad.some((s) => w.alignment(s) === a)
				}))
			];
		}
	},
	{
		id: 'madness-in-play',
		group: 'characters',
		instances: (f) => [
			{
				blanks: '',
				parts: [text('No character in play can make anyone mad.')],
				holds: () =>
					![...f.inPlay].some((id) => /\bmad\b/i.test(f.characters.get(id)?.ability ?? ''))
			}
		]
	},
	count(
		'once-used',
		'today',
		// A player carrying their own character's "No Ability" reminder has used it.
		(f) => f.seats.filter((s) => ownNoAbility(f, s)).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' once-per-game ability has been used.'
					: ' once-per-game abilities have been used.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'impaired-neighbours',
		'counts',
		(f) => aliveNeighbours(f.game, f.savant).filter(f.impaired).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' of your living neighbours is drunk or poisoned.'
					: ' of your living neighbours are drunk or poisoned.'
			)
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	{
		id: 'sit-together',
		group: 'characters',
		instances: (f) =>
			pairs(f.script.filter((id) => f.characters.get(id)?.type !== 'demon')).map(([a, b]) => ({
				blanks: `${a}|${b}`,
				parts: [
					{ character: a },
					text(' and '),
					{ character: b },
					text(' sit next to each other.')
				],
				holds: () => {
					const sa = seatOf(f, a);
					const sb = seatOf(f, b);
					return sa !== undefined && sb !== undefined && sideBySide(f, sa).includes(sb);
				}
			}))
	},
	{
		id: 'witch-cursed',
		group: 'today',
		instances: (f) =>
			f.inPlay.has('witch')
				? [
						{
							blanks: 'yes',
							parts: [text('You are cursed by the '), { character: 'witch' }, text('.')],
							holds: () => hasReminder(f, f.savant, 'witch', 'Cursed')
						},
						{
							blanks: 'no',
							parts: [text('You are not cursed by the '), { character: 'witch' }, text('.')],
							holds: () => !hasReminder(f, f.savant, 'witch', 'Cursed')
						}
					]
				: []
	},
	{
		id: 'neighbours-alignment',
		group: 'alignment',
		instances(f) {
			const [a, b] = aliveNeighbours(f.game, f.savant);
			if (a === undefined || b === undefined) return [];
			const same = (w: RegistrationWorld) =>
				w.alignment(a) !== undefined && w.alignment(a) === w.alignment(b);
			return [
				{
					blanks: 'same',
					parts: [text('Your living neighbours share an alignment.')],
					holds: same
				},
				{
					blanks: 'different',
					parts: [text('Your living neighbours have different alignments.')],
					holds: (w: RegistrationWorld) => w.alignment(b) !== undefined && !same(w)
				}
			];
		}
	},
	{
		id: 'nominated-yesterday',
		group: 'today',
		instances(f) {
			const nominators = nominations(f.yesterday).map((e) =>
				trueCharacter(f.game, e.nominator, f.characters)
			);
			if (nominators.length === 0) return [];
			return [...f.inPlay]
				.filter((id) => f.characters.get(id)?.type !== 'demon')
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' nominated yesterday.')],
					holds: () => nominators.includes(id)
				}));
		}
	},
	{
		id: 'nominee-yesterday',
		group: 'today',
		instances(f) {
			const nominees = nominations(f.yesterday).map((e) => e.nominee);
			if (nominees.length === 0) return [];
			return [
				{
					blanks: 'evil',
					parts: [text('An evil player was nominated yesterday.')],
					holds: (w: RegistrationWorld) => nominees.some((s) => isEvil(w, s))
				},
				{
					blanks: 'outsider',
					parts: [text('An '), { type: 'outsider' }, text(' was nominated yesterday.')],
					holds: (w: RegistrationWorld) => nominees.some((s) => w.type(s) === 'outsider')
				}
			];
		}
	},
	{
		id: 'minion-chose',
		group: 'today',
		// Where a Minion's choice reminder sits says whom it chose.
		instances: (f) =>
			Object.entries(MINION_CHOICES)
				.filter(([minion]) => f.inPlay.has(minion))
				.flatMap(([minion, labels]) =>
					[...f.inPlay]
						.filter((id) => id !== minion && f.characters.get(id)?.type !== 'demon')
						.map((id) => ({
							blanks: `${minion}|${id}`,
							parts: [
								text('The '),
								{ character: minion },
								text(' chose the '),
								{ character: id },
								text(' last night.')
							],
							holds: () => {
								const s = seatOf(f, id);
								return s !== undefined && labels.some((l) => hasReminder(f, s, minion, l));
							}
						}))
				)
	},
	count(
		'neighbours-reminded',
		'today',
		(f) =>
			aliveNeighbours(f.game, f.savant).filter((s) =>
				f.game.seats[s].reminders.some(
					(r) =>
						r.characterId !== trueCharacter(f.game, s, f.characters) &&
						r.characterId !== f.game.seats[s].characterId
				)
			).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? " of your living neighbours carries another character's reminder."
					: " of your living neighbours carry another character's reminder."
			)
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	{
		id: 'one-of-three-evil',
		group: 'alignment',
		// Like the Noble: exactly one of three players is evil.
		instances: (f) =>
			triples(f.others).map(([a, b, c]) => ({
				blanks: `${a}|${b}|${c}`,
				parts: [
					text('Exactly one of '),
					{ seat: a },
					text(', '),
					{ seat: b },
					text(' and '),
					{ seat: c },
					text(' is evil.')
				],
				holds: (w: RegistrationWorld) => [a, b, c].filter((s) => isEvil(w, s)).length === 1
			}))
	},
	{
		id: 'character-impaired',
		group: 'characters',
		instances: (f) =>
			[...f.inPlay]
				.filter((id) => id !== 'savant' && f.characters.get(id)?.type !== 'demon')
				.map((id) => ({
					blanks: id,
					parts: [text('The '), { character: id }, text(' is drunk or poisoned.')],
					holds: () => {
						const s = seatOf(f, id);
						return s !== undefined && f.impaired(s);
					}
				}))
	},
	{
		id: 'died-not-demon',
		group: 'today',
		// Only deaths whose cause names a character that is not a Demon, or a Demon.
		instances: (f) =>
			f.others.flatMap((s) => {
				const cause = f.game.seats[s].deathCause;
				if (!f.game.seats[s].dead || !cause || ['execution', 'exile', 'other'].includes(cause))
					return [];
				const byDemon = cause === 'demon' || f.characters.get(cause)?.type === 'demon';
				const atNight = byDemon || (f.characters.get(cause)?.otherNight ?? 0) > 0;
				if (!atNight) return [];
				return [
					{
						blanks: s,
						parts: [{ seat: s }, text(' died at night, but not to the Demon.')],
						holds: () => !byDemon
					}
				];
			})
	},
	count(
		'townsfolk-pairs',
		'counts',
		(f, w) => {
			const s = f.game.seating;
			return s.filter(
				(x, i) => w.type(x) === 'townsfolk' && w.type(s[(i + 1) % s.length]) === 'townsfolk'
			).length;
		},
		(n) => [
			text('There '),
			text(n === 1 ? 'is ' : 'are '),
			{ number: n },
			text(n === 1 ? ' pair of ' : ' pairs of '),
			{ type: 'townsfolk' },
			text(' sitting next to each other.')
		],
		(f) => f.n
	),
	count(
		'unaware',
		'counts',
		// The Drunk, Marionette and others shown another token, and the Lunatic.
		(f) =>
			f.seats.filter((s) => {
				const id = trueCharacter(f.game, s, f.characters);
				return id === 'lunatic' || id !== f.game.seats[s].characterId;
			}).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player does not know their true character.'
					: ' players do not know their true character.'
			)
		],
		(f) => Math.min(f.n, 3)
	),
	...LOG_TEMPLATES
];

// ── Working them out ────────────────────────────────────────────────────────

/**
 * Every statement the templates can make about this game, from the Savant at `seatId`,
 * with whether each holds. Empty until every seat has a character.
 */
export function savantStatements(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	dawns: readonly Game[] = []
): SavantStatement[] {
	if (!getSeat(game, seatId)) return [];
	const seats = game.seating.filter((s) => trueCharacter(game, s, characters) !== undefined);
	if (seats.length < game.seating.length || seats.length < 5) return [];
	const inPlay = new Set(seats.map((s) => trueCharacter(game, s, characters)!));
	const f: Facts = {
		game,
		characters,
		savant: seatId,
		seats,
		n: seats.length,
		others: seats.filter((s) => s !== seatId),
		inPlay,
		script: scriptCharacterIds(game.script).filter((id) =>
			['townsfolk', 'outsider', 'minion', 'demon'].includes(characters.get(id)?.type ?? '')
		),
		dead: (s) => game.seats[s].dead,
		yesterday: game.pastDays.at(-1),
		dawns,
		lastDawn: dawns.at(-1),
		firstNightJustGone: dawns.length === 1,
		impaired: (s) =>
			abilityState(game, s, characters).impairments.some(
				(i) => i.reason === 'drunk' || i.reason === 'poisoned'
			)
	};
	const worlds = registrationWorlds(game, characters);
	const [w0] = worlds;
	if (!w0) return [];
	const out: SavantStatement[] = [];
	for (const t of SAVANT_TEMPLATES) {
		for (const inst of t.instances(f, w0)) {
			const results = worlds.map((w) => inst.holds(w));
			const truth: SavantTruth = inst.manual
				? 'check'
				: results.every(Boolean)
					? 'true'
					: results.some(Boolean)
						? 'either'
						: 'false';
			const dependsOn =
				truth === 'either'
					? [
							...new Set(
								worlds.filter((_, i) => results[i] !== results[0]).flatMap((w) => w.misregistered)
							)
						]
					: [];
			out.push({
				key: `${t.id}:${inst.blanks}`,
				template: t.id,
				group: t.group,
				parts: inst.parts,
				truth,
				byDefault: results[0],
				dependsOn
			});
		}
	}
	return out;
}

const fits = (s: SavantStatement, want: boolean) =>
	s.truth === 'either' || s.truth === (want ? 'true' : 'false');

/**
 * Picks one statement that is `want` (true or false), preferring a group the others do not
 * use and never repeating one: a template first, so a template with many blanks is no more
 * likely than one with few, then its blanks.
 */
export function pickStatement(
	pool: readonly SavantStatement[],
	want: boolean,
	avoid: readonly SavantStatement[],
	random: () => number = Math.random
): SavantStatement | undefined {
	const keys = new Set(avoid.map((s) => s.key));
	const groups = new Set(avoid.map((s) => s.group));
	const usable = pool.filter((s) => fits(s, want) && !keys.has(s.key));
	// A line that depends on how someone registers only when nothing else fits.
	const definite = usable.filter((s) => s.truth !== 'either');
	const ok = definite.length > 0 ? definite : usable;
	const fresh = ok.filter((s) => !groups.has(s.group));
	const from = fresh.length > 0 ? fresh : ok;
	const templates = [...new Set(from.map((s) => s.template))];
	if (templates.length === 0) return undefined;
	const template = templates[Math.floor(random() * templates.length)];
	const options = from.filter((s) => s.template === template);
	return options[Math.floor(random() * options.length)];
}

/** Whether each slot should be true, for a mode: one-each in a random order. */
export function wantedTruths(
	mode: SavantMode,
	random: () => number = Math.random
): [boolean, boolean] {
	if (mode === 'both-true') return [true, true];
	if (mode === 'both-false') return [false, false];
	return random() < 0.5 ? [true, false] : [false, true];
}

/**
 * Whether a statement holds as it will be given: `either` as everyone registers by default,
 * `check` as the Storyteller set it (`assumed`, true until set).
 */
export function holdsAsGiven(s: SavantStatement, assumed = true): boolean {
	if (s.truth === 'check') return assumed;
	if (s.truth === 'either') return s.byDefault;
	return s.truth === 'true';
}

/**
 * The truth the free slot needs next to a kept statement: the opposite in one-each mode,
 * the same otherwise.
 */
export function partnerTruth(kept: SavantStatement, mode: SavantMode, assumed = true): boolean {
	if (mode === 'both-true') return true;
	if (mode === 'both-false') return false;
	return !holdsAsGiven(kept, assumed);
}

/** A fresh pair for a mode, or fewer statements when the game cannot fill one. */
export function savantPair(
	pool: readonly SavantStatement[],
	mode: SavantMode,
	random: () => number = Math.random
): SavantStatement[] {
	const [a, b] = wantedTruths(mode, random);
	const first = pickStatement(pool, a, [], random);
	if (!first) return [];
	const second = pickStatement(pool, b, [first], random);
	return second ? [first, second] : [first];
}
