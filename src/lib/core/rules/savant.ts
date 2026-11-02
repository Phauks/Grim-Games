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
 * false ones (https://wiki.bloodontheclocktower.com/Vortox). With two Storytellers (the Knaves)
 * a Savant who goes to the lying one hears two false statements, and one who goes to the
 * truthful one two true ones (https://wiki.bloodontheclocktower.com/Knaves). `savantSituation`
 * says which applies; the Storyteller still picks the mode.
 */
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { scriptCharacterIds, type CharacterLookup } from '#lib/core/model/characters.ts';
import { aliveNeighbours, getSeat, trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrationWorlds, type RegistrationWorld } from './ability.ts';
import { reliability } from './night-info.ts';

import {
	hasLabel,
	seatOf,
	sideBySide,
	text,
	typed,
	type Facts,
	type Instance
} from './savant-facts.ts';
import { SAVANT_TEMPLATES } from './savant-templates.ts';
export const SAVANT_GROUPS = [
	'characters',
	'counts',
	'alignment',
	'types',
	'demon',
	'today',
	'manual',
	'room'
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
 * Storyteller says whether it holds. `unknown`: a statement the Storyteller typed and has not
 * marked true or false yet (`typedStatement`).
 */
export type SavantTruth = 'true' | 'false' | 'either' | 'check' | 'unknown';

/** Who a typed statement is about: one seat, or whoever holds a character type. */
export type SavantAbout = { seat: SeatId } | { type: CharacterType };

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
	/**
	 * Why it holds or not, for the Storyteller (Trevor, 2026-10-23: L49): the true count
	 * when it gives a number, and the character of each player and where each character it
	 * names is. Empty for a statement only the Storyteller can check.
	 */
	why: SavantPart[][];
	/** A typed statement's link to a seat or a character type, if the Storyteller gave one. */
	about?: SavantAbout;
}

/** One true and one false, or two of a kind (a drunk or poisoned Savant, the Vortox). */
export type SavantMode = 'one-each' | 'both-true' | 'both-false';

export interface SavantSituation {
	/** The Savant's ability does not work: any mode is allowed. */
	impaired?: 'drunk' | 'poisoned' | 'no-ability';
	/** A working Vortox is in play and the Savant is sober: both must be false. */
	vortox?: SeatId;
	/**
	 * That character (the Vortox, or any whose `falseInfo` covers Townsfolk, or the rule
	 * character of two Storytellers when the Savant went to the lying one).
	 */
	falseBy?: CharacterId;
	/**
	 * Two Storytellers (the Knaves, https://wiki.bloodontheclocktower.com/Knaves): the Savant
	 * went to the one who lies now (both false) or tells the truth (both may be true).
	 */
	storyteller?: { by: CharacterId; lies: boolean };
	/** The mode the rules point to. */
	mode: SavantMode;
}

/** What the rules say the Savant should hear today. */
export function savantSituation(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup
): SavantSituation {
	const r = reliability(game, seatId, game.seats[seatId]?.characterId ?? '', characters);
	if (r.unreliable) return { impaired: r.unreliable, mode: 'one-each' };
	if (r.mustBeFalse && r.vortox !== undefined)
		return { vortox: r.vortox, ...(r.falseBy ? { falseBy: r.falseBy } : {}), mode: 'both-false' };
	const st = r.storyteller;
	if (st?.lies !== undefined) {
		const storyteller = { by: st.by, lies: st.lies };
		return st.lies
			? { storyteller, falseBy: st.by, mode: 'both-false' }
			: { storyteller, mode: 'both-true' };
	}
	return { mode: 'one-each' };
}

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
		const instances = t.instances(f, w0);
		for (const inst of instances) {
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
				dependsOn,
				why: inst.manual ? [] : whyOf(f, w0, inst, instances)
			});
		}
	}
	return out;
}

/** The same words, numbers aside. */
const sameButNumbers = (a: readonly SavantPart[], b: readonly SavantPart[]) =>
	a.length === b.length &&
	a.every((p, i) =>
		'number' in p ? 'number' in b[i] : JSON.stringify(p) === JSON.stringify(b[i])
	);

/** What a reason needs from the facts: the game and its characters. */
type Grim = Pick<Facts, 'game' | 'characters'>;

/** "Seat 4 (Butler)", for a reason. */
const seatFact = (f: Grim, seat: SeatId): SavantPart[] => {
	const id = trueCharacter(f.game, seat, f.characters);
	return id ? [{ seat }, text(' ('), { character: id }, text(')')] : [{ seat }];
};

/** A list of seats for a reason, or "none". */
function seatsFact(f: Grim, head: SavantPart[], seats: readonly SeatId[]): SavantPart[] {
	if (seats.length === 0) return [...head, text(': none')];
	return [
		...head,
		text(': '),
		...seats.flatMap((s, i) => [...(i ? [text(', ')] : []), ...seatFact(f, s)])
	];
}

const TYPE_WORDS: readonly [CharacterType, RegExp][] = [
	['townsfolk', /\bTownsfolk\b/],
	['outsider', /\bOutsiders?\b/],
	['minion', /\bMinions?\b/],
	['demon', /\bDemons?\b/]
];

/**
 * The facts a statement rests on, as the grimoire has them (`SavantStatement.why`): the true
 * count for a wrong number; each player it names with their character; where each character
 * it names is; who holds each character type it speaks of; the Savant's neighbours for a
 * line about "you"; who is mad for a line about madness.
 */
function whyOf(
	f: Facts,
	w0: RegistrationWorld,
	inst: Instance,
	instances: readonly Instance[]
): SavantPart[][] {
	const facts: SavantPart[][] = [];
	if (inst.parts.some((p) => 'number' in p) && !inst.holds(w0)) {
		const truth = instances.find((o) => o.holds(w0) && sameButNumbers(o.parts, inst.parts));
		if (truth) facts.push(truth.parts);
	}
	const seats: SeatId[] = [];
	for (const p of inst.parts) if ('seat' in p && !seats.includes(p.seat)) seats.push(p.seat);
	for (const seat of seats) facts.push(seatFact(f, seat));
	const named: CharacterId[] = [];
	for (const p of inst.parts)
		if ('character' in p && !named.includes(p.character)) named.push(p.character);
	for (const id of named) {
		const seat = seatOf(f, id);
		if (seat !== undefined && seats.includes(seat)) continue;
		facts.push(
			seat === undefined
				? [{ character: id }, text(': not in play')]
				: [{ character: id }, text(': '), { seat }]
		);
	}
	const words = inst.parts.map((p) => ('text' in p ? p.text : '')).join('');
	const types = new Set<CharacterType>();
	for (const p of inst.parts) if ('type' in p) types.add(p.type);
	for (const [type, re] of TYPE_WORDS) if (re.test(words)) types.add(type);
	for (const [type] of TYPE_WORDS)
		if (types.has(type)) facts.push(seatsFact(f, [{ type }], typed(f, w0, type)));
	if (/\byou(r)?\b/i.test(words)) {
		const near = /living/i.test(words)
			? aliveNeighbours(f.game, f.savant)
			: sideBySide(f, f.savant);
		facts.push(seatsFact(f, [text('Beside you')], near));
	}
	if (/\bmad\b/i.test(words)) {
		facts.push(
			seatsFact(
				f,
				[text('Mad')],
				f.seats.filter((s) => hasLabel(f, s, 'Mad'))
			)
		);
	}
	return facts;
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
function wantedTruths(mode: SavantMode, random: () => number = Math.random): [boolean, boolean] {
	if (mode === 'both-true') return [true, true];
	if (mode === 'both-false') return [false, false];
	return random() < 0.5 ? [true, false] : [false, true];
}

/**
 * Whether a statement holds as it will be given: `either` as everyone registers by default,
 * `check` as the Storyteller set it (`assumed`, true until set).
 */
export function holdsAsGiven(s: SavantStatement, assumed = true): boolean {
	if (s.truth === 'check' || s.truth === 'unknown') return assumed;
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

/**
 * Whether two statements make a pair the mode allows (one true and one false, or two of a
 * kind), as given; undefined while a typed one is still unmarked.
 */
export function pairFits(
	a: SavantStatement,
	b: SavantStatement,
	mode: SavantMode
): boolean | undefined {
	if (a.truth === 'unknown' || b.truth === 'unknown') return undefined;
	const [x, y] = [holdsAsGiven(a), holdsAsGiven(b)];
	if (mode === 'one-each') return x !== y;
	return x === y && x === (mode === 'both-true');
}

// ── Typed by the Storyteller ────────────────────────────────────────────────

/** A statement the Storyteller types: its words, what it is about, and how they marked it. */
export interface TypedStatementInput {
	words: string;
	about?: SavantAbout;
	/** True or false as the Storyteller marks it; left out until they do. */
	marked?: boolean;
}

/**
 * A statement the grimoire cannot know, typed by the Storyteller: about the players as people
 * in the room (what they wear, where they sit, the Demon's player being a woman). It holds
 * as the Storyteller marks it (`unknown` until then), so it pairs with a worked-out statement
 * through `partnerTruth` and `pairFits` like any other. Linked to a seat or a character type,
 * its reasons say who that is, to help the Storyteller judge it.
 */
export function typedStatement(
	game: Game,
	characters: CharacterLookup,
	input: TypedStatementInput
): SavantStatement {
	const words = input.words.trim();
	const about = input.about;
	const f: Grim = { game, characters };
	const why: SavantPart[][] = [];
	if (about && 'seat' in about && getSeat(game, about.seat)) why.push(seatFact(f, about.seat));
	if (about && 'type' in about) {
		const holders = game.seating.filter(
			(s) => characters.get(trueCharacter(game, s, characters) ?? '')?.type === about.type
		);
		why.push(seatsFact(f, [{ type: about.type }], holders));
	}
	const aboutKey = !about ? '' : 'seat' in about ? `seat:${about.seat}` : `type:${about.type}`;
	return {
		key: `typed:${aboutKey}|${words}`,
		template: 'typed',
		group: 'room',
		parts: [text(words)],
		truth: input.marked === undefined ? 'unknown' : input.marked ? 'true' : 'false',
		byDefault: input.marked ?? true,
		dependsOn: [],
		why,
		...(about ? { about } : {})
	};
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
