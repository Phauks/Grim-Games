/**
 * Night information: the info picker, the truthful options for a character whose rules
 * block `learns` something. Part of `night-info.ts`.
 */
import type { Learns } from '#lib/core/data/character-rules.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import { type CharacterLookup, scriptCharacterIds } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { AbnormalCause, Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import { type Registration, type RegistrationWorld, registrationWorlds } from '../ability.ts';
import { causesOf } from '../night-deaths.ts';
import type { Night } from '../night-order.ts';
import { wokeTonight } from '../woke-tonight.ts';
import { carries, lastShown } from './token-carriers.ts';
import {
	type AnswerValue,
	type Reliability,
	type Why,
	type WhyFact,
	alternatives,
	fact,
	onlyRelevant,
	relevantSeats,
	reliability,
	wikiOf
} from './reliability.ts';

/**
 * - `pair-character`: two players and a character, one of whom is that character
 *   (Washerwoman, Librarian, Investigator);
 * - `number`: a number (Chef, Empath, Clockmaker);
 * - `players`: players to point at (Steward: 1 good player; Noble: 3, exactly 1 evil; Sage:
 *   2, one of them the Demon);
 * - `yes-no`: the player chose 2 players; yes or no (Fortune Teller, Seamstress), or one of
 *   two other answers (`PickerAnswer`).
 */
export type PickerKind = 'pair-character' | 'number' | 'players' | 'yes-no';

/**
 * What a `yes-no` picker's two answers mean, when not yes and no: `alignment`, yes for evil
 * and no for good (Village Idiot); `direction`, yes for clockwise and no for anticlockwise
 * (Shugenja).
 */
export type PickerAnswer = 'alignment' | 'direction';

/** One option the Storyteller could show. */
export interface InfoOption {
	seats: SeatId[];
	characterId?: CharacterId;
	/**
	 * For a player who registers as the shown type without being it (a Spy shown to the
	 * Washerwoman): any of these characters may be shown.
	 */
	characterIds?: CharacterId[];
	number?: number;
	yes?: boolean;
	/** "There are none in play" (a Librarian with no Outsiders learns 0). */
	none?: boolean;
	/**
	 * Set when the option is only true if these players register as something else (a
	 * Recluse as evil): allowed, the Storyteller's call, and abnormal for the Mathematician.
	 */
	registered?: SeatId[];
	/**
	 * For a players picker, the player the option turns on: the Steward's good player, the
	 * evil one of the Noble's three.
	 */
	pivot?: SeatId;
}

/** For a number picker: the true number and every number registration allows. */
export interface NumberRange {
	truth: number;
	/** Ascending, including `truth`. */
	possible: number[];
}

export interface InfoPicker extends Reliability {
	kind: PickerKind;
	/** What the character learns (its rules block's `learns.measure`). */
	measure: Learns['measure'];
	characterId: CharacterId;
	/** The waking player. */
	seatId: SeatId;
	/** How many players the Storyteller taps (0 for a number). */
	seatCount: number;
	/** For `pair-character`: the character type shown. */
	characterType?: CharacterType;
	/** For `yes-no`: what the answers mean, when not yes and no. */
	answer?: PickerAnswer;
	/** The truthful options, from the grimoire, including ones that rely on registration. */
	options: InfoOption[];
	/** For `number`: the true number and the range registration allows. */
	range?: NumberRange;
	/** Every option is allowed, because the waking player's ability does not work. */
	anyAllowed: boolean;
	why: Why;
	/**
	 * Reminder tokens to place: `target` on the player who is the shown character (or the
	 * first player tapped), `other` on the second player, `each` on every player tapped.
	 */
	reminders: { target?: string; other?: string; each?: string };
	wiki: string;
}

/** What the Storyteller chose to show. */
export interface InfoChoice {
	seats: SeatId[];
	characterId?: CharacterId;
	number?: number;
	yes?: boolean;
	none?: boolean;
}

interface PickerSpec extends Learns {
	kind: PickerKind;
	seatCount: number;
	answer?: PickerAnswer;
	/** For `woke-tonight`: the players who woke tonight by their own ability. */
	woke?: ReadonlySet<SeatId>;
}

/** The picker each `learns` measure shows: its kind and how many players are tapped. */
const MEASURE_PICKERS: Readonly<
	Record<Learns['measure'], Pick<PickerSpec, 'kind' | 'seatCount' | 'answer'>>
> = {
	'pair-of-type': { kind: 'pair-character', seatCount: 2 },
	'evil-pairs': { kind: 'number', seatCount: 0 },
	'evil-alive-neighbours': { kind: 'number', seatCount: 0 },
	'demon-minion-steps': { kind: 'number', seatCount: 0 },
	'demon-or-token': { kind: 'yes-no', seatCount: 2 },
	'good-player': { kind: 'players', seatCount: 1 },
	'one-evil-of-three': { kind: 'players', seatCount: 3 },
	'same-alignment': { kind: 'yes-no', seatCount: 2 },
	'demon-in-pair': { kind: 'players', seatCount: 2 },
	'character-of': { kind: 'pair-character', seatCount: 1 },
	'not-demon-pair': { kind: 'players', seatCount: 2 },
	'evil-player': { kind: 'players', seatCount: 1 },
	'demon-player': { kind: 'players', seatCount: 1 },
	'closest-evil-direction': { kind: 'yes-no', seatCount: 0, answer: 'direction' },
	'chosen-alignment': { kind: 'yes-no', seatCount: 1, answer: 'alignment' },
	'type-differs-from-token': { kind: 'players', seatCount: 1 },
	'woke-tonight': { kind: 'number', seatCount: 2 }
};

/**
 * The picker for a character that `learns` first-night information (its rules block: our
 * `data/rules/<id>.json`, or a custom character's `rules`), or undefined.
 */
function pickerSpec(characterId: CharacterId, characters: CharacterLookup): PickerSpec | undefined {
	const learns = rulesOf(characterId, characters)?.learns;
	return learns && { ...learns, ...MEASURE_PICKERS[learns.measure] };
}

/** Every unordered selection of `k` items. */
function choose<T>(items: readonly T[], k: number): T[][] {
	if (k === 0) return [[]];
	if (items.length < k) return [];
	const [first, ...rest] = items;
	return [...choose(rest, k - 1).map((c) => [first, ...c]), ...choose(rest, k)];
}

/** The options that are true when players register as `world` says. */
function optionsIn(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	world: RegistrationWorld
): InfoOption[] {
	const evil = (s: SeatId) => world.alignment(s) === 'evil';
	// Information is about the other players: the waking player is never one of them
	// (a rules question for Trevor; see the report).
	const others = game.seating.filter((s) => s !== seatId);
	switch (spec.measure) {
		case 'pair-of-type': {
			// https://wiki.bloodontheclocktower.com/Washerwoman, /Librarian, /Investigator:
			// one of the two players is the character shown; the other is anyone else. A player
			// registering as that type without being it may be shown as any such character.
			const type = spec.type;
			const targets = others.filter((s) => world.type(s) === type);
			const ofType = scriptCharacterIds(game.script).filter(
				(id) => characters.get(id)?.type === type
			);
			const options = targets.flatMap((target) => {
				const shown: Pick<InfoOption, 'characterId' | 'characterIds'> =
					typeOf(game, target, characters) === type
						? { characterId: trueCharacter(game, target, characters)! }
						: { characterIds: ofType };
				return others
					.filter((s) => s !== target)
					.map((other): InfoOption => ({ seats: [target, other], ...shown }));
			});
			// The Librarian learns there are no Outsiders when none are in play.
			if (spec.noneWhenAbsent && targets.length === 0) {
				options.push({ seats: [], none: true, number: 0 });
			}
			return options;
		}
		case 'evil-pairs': {
			// https://wiki.bloodontheclocktower.com/Chef: pairs of evil players sitting next to
			// each other, around the whole circle.
			const n = game.seating.length;
			let pairs = 0;
			for (let i = 0; i < n && n > 1; i++) {
				if (n === 2 && i === 1) break;
				if (evil(game.seating[i]) && evil(game.seating[(i + 1) % n])) pairs++;
			}
			return [{ seats: [], number: pairs }];
		}
		case 'evil-alive-neighbours': {
			// https://wiki.bloodontheclocktower.com/Empath: evil among the alive neighbours.
			const neighbours = aliveNeighbours(game, seatId);
			return [{ seats: [], number: neighbours.filter(evil).length }];
		}
		case 'demon-minion-steps': {
			// https://wiki.bloodontheclocktower.com/Clockmaker: steps from the Demon to its
			// nearest Minion, either way round the circle.
			const n = game.seating.length;
			const at = (type: CharacterType) =>
				game.seating.flatMap((s, i) => (world.type(s) === type ? [i] : []));
			const demons = at('demon');
			const minions = at('minion');
			if (demons.length === 0 || minions.length === 0) return [];
			const steps = Math.min(
				...demons.flatMap((d) => minions.map((m) => Math.min(Math.abs(d - m), n - Math.abs(d - m))))
			);
			return [{ seats: [], number: steps }];
		}
		case 'demon-or-token': {
			// https://wiki.bloodontheclocktower.com/Fortune_Teller: yes when either chosen player
			// is the Demon or the red herring. The player may choose themselves.
			const flagged = (s: SeatId) =>
				world.type(s) === 'demon' || carries(game, s, characterId, spec.token);
			return choose(game.seating, 2).map((pair) => ({ seats: pair, yes: pair.some(flagged) }));
		}
		case 'good-player':
			// https://wiki.bloodontheclocktower.com/Steward: one good player.
			return others.filter((s) => !evil(s)).map((s) => ({ seats: [s], pivot: s }));
		case 'one-evil-of-three':
			// https://wiki.bloodontheclocktower.com/Noble: three players, exactly one evil.
			return choose(others, 3).flatMap((trio) => {
				const bad = trio.filter(evil);
				return bad.length === 1 ? [{ seats: trio, pivot: bad[0] }] : [];
			});
		case 'same-alignment':
			// https://wiki.bloodontheclocktower.com/Seamstress: the player chose 2 other players;
			// yes when both are good or both are evil.
			return choose(others, 2).map((pair) => ({
				seats: pair,
				yes: evil(pair[0]) === evil(pair[1])
			}));
		case 'demon-in-pair':
			// https://wiki.bloodontheclocktower.com/Sage: two players, one of them the Demon; the
			// other is anyone else.
			return others
				.filter((s) => world.type(s) === 'demon')
				.flatMap((demon) =>
					others
						.filter((s) => s !== demon)
						.map((other): InfoOption => ({ seats: [demon, other], pivot: demon }))
				);
		case 'character-of':
			// https://wiki.bloodontheclocktower.com/Ravenkeeper (any player's character),
			// /King (an alive character), /Pixie (an in-play Townsfolk), /Grandmother (a good
			// Townsfolk or Outsider). A player registering as another type (the Recluse as a
			// Minion) may be shown as any character of that type.
			return characterOfSeats(game, seatId, spec, world).map((s) => ({
				seats: [s],
				...shownAs(game, s, characters, world)
			}));
		case 'not-demon-pair':
			// https://wiki.bloodontheclocktower.com/Knight: two players who are not the Demon.
			return choose(
				others.filter((s) => world.type(s) !== 'demon'),
				2
			).map((pair) => ({ seats: pair }));
		case 'evil-player':
			// https://wiki.bloodontheclocktower.com/Bounty_Hunter: one evil player.
			return others.filter(evil).map((s) => ({ seats: [s], pivot: s }));
		case 'demon-player':
			// https://wiki.bloodontheclocktower.com/Choirboy: which player is the Demon.
			return others.filter((s) => world.type(s) === 'demon').map((s) => ({ seats: [s], pivot: s }));
		case 'closest-evil-direction': {
			// https://wiki.bloodontheclocktower.com/Shugenja: the direction of the evil player
			// fewest steps away; when the nearest each way are as close, either. The wiki counts
			// steps round the circle, so dead players count.
			const n = game.seating.length;
			const at = game.seating.indexOf(seatId);
			const steps = (dir: 1 | -1) => {
				for (let i = 1; i < n; i++) {
					if (evil(game.seating[(((at + dir * i) % n) + n) % n])) return i;
				}
				return undefined;
			};
			const clockwise = steps(1);
			const anticlockwise = steps(-1);
			if (clockwise === undefined || anticlockwise === undefined) return [];
			return [
				...(clockwise <= anticlockwise ? [{ seats: [], yes: true }] : []),
				...(anticlockwise <= clockwise ? [{ seats: [], yes: false }] : [])
			];
		}
		case 'chosen-alignment':
			// https://wiki.bloodontheclocktower.com/Village_Idiot: the alignment of the player
			// chosen. Like the Fortune Teller, any player, themselves included.
			return game.seating.map((s) => ({ seats: [s], yes: evil(s) }));
		case 'woke-tonight':
			// https://wiki.bloodontheclocktower.com/Chambermaid: two alive players, not the
			// Chambermaid; how many woke tonight because of their own ability. A player woken to
			// be asked counts even if they decline (Trevor, 2026-10-31).
			return choose(
				others.filter((s) => !game.seats[s].dead),
				2
			).map((pair) => ({ seats: pair, number: pair.filter((s) => spec.woke?.has(s)).length }));
		case 'type-differs-from-token': {
			// https://wiki.bloodontheclocktower.com/Balloonist: a player of a different character
			// type than the one shown last time (any player the first time). Alive or dead.
			const before = lastShown(game, seatId, characterId, spec.token).map((s) => world.type(s));
			return others
				.filter((s) => !before.includes(world.type(s)))
				.map((s) => ({ seats: [s], pivot: s }));
		}
	}
}

/** The players a `character-of` picker may show the character of. */
function characterOfSeats(
	game: Game,
	seatId: SeatId,
	spec: PickerSpec,
	world: RegistrationWorld
): SeatId[] {
	return game.seating.filter((s) => {
		const type = world.type(s);
		return (
			(spec.self || s !== seatId) &&
			(!spec.alive || !registersAsDead(game, s)) &&
			(!spec.types || (type !== undefined && spec.types.includes(type))) &&
			(!spec.alignment || world.alignment(s) === spec.alignment)
		);
	});
}

/** The character a player is shown as: their own, or any of the type they register as. */
function shownAs(
	game: Game,
	seatId: SeatId,
	characters: CharacterLookup,
	world: RegistrationWorld
): Pick<InfoOption, 'characterId' | 'characterIds'> {
	const type = world.type(seatId);
	if (typeOf(game, seatId, characters) === type) {
		return { characterId: trueCharacter(game, seatId, characters)! };
	}
	return {
		characterIds: scriptCharacterIds(game.script).filter((id) => characters.get(id)?.type === type)
	};
}

const optionKey = (o: InfoOption) =>
	JSON.stringify([o.seats, o.characterId, o.characterIds, o.number, o.yes, o.none]);

/**
 * The truthful options in every way players may register: the default world's options
 * first, then those that are only true when someone misregisters, marked `registered`.
 */
function truthfulOptions(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	regs: readonly Registration[]
): InfoOption[] {
	const [base, ...rest] = registrationWorlds(game, characters, regs);
	const out = optionsIn(game, seatId, characterId, spec, characters, base);
	const seen = new Set(out.map(optionKey));
	for (const world of rest) {
		for (const option of optionsIn(game, seatId, characterId, spec, characters, world)) {
			const key = optionKey(option);
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({ ...option, registered: world.misregistered });
		}
	}
	return out;
}

/** The players a picker's options are worked out from, as the default world sees them. */
function pickerFacts(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	spec: PickerSpec,
	characters: CharacterLookup,
	world: RegistrationWorld
): WhyFact[] {
	const others = game.seating.filter((s) => s !== seatId);
	const f = (s: SeatId) => fact(game, s, characters, world);
	const evil = (s: SeatId) => world.alignment(s) === 'evil';
	switch (spec.measure) {
		case 'pair-of-type':
			return others.filter((s) => world.type(s) === spec.type).map(f);
		case 'evil-pairs':
			return game.seating.filter(evil).map(f);
		case 'evil-alive-neighbours':
			return aliveNeighbours(game, seatId).map(f);
		case 'demon-minion-steps':
			return game.seating
				.filter((s) => world.type(s) === 'demon' || world.type(s) === 'minion')
				.map(f);
		case 'demon-or-token':
			return game.seating.flatMap((s) => {
				const redHerring = carries(game, s, characterId, spec.token);
				if (world.type(s) !== 'demon' && !redHerring) return [];
				return [{ ...f(s), ...(redHerring ? { redHerring: true } : {}) }];
			});
		case 'one-evil-of-three':
		case 'same-alignment':
			return others.filter(evil).map(f);
		case 'demon-in-pair':
		case 'not-demon-pair':
		case 'demon-player':
			return others.filter((s) => world.type(s) === 'demon').map(f);
		case 'evil-player':
		case 'closest-evil-direction':
			return others.filter(evil).map(f);
		case 'type-differs-from-token':
			return lastShown(game, seatId, characterId, spec.token).map(f);
		case 'woke-tonight':
			return others.filter((s) => !game.seats[s].dead && spec.woke?.has(s)).map(f);
		case 'chosen-alignment':
		case 'good-player':
		case 'character-of':
			return [];
	}
}

/** The info picker for a waking player, or undefined for a character it does not cover. */
export function infoPicker(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	night: Night = game.pastDays.length === 0 ? 'first' : 'other'
): InfoPicker | undefined {
	const learns = pickerSpec(characterId, characters);
	if (!learns) return undefined;
	const spec: PickerSpec =
		learns.measure === 'woke-tonight'
			? {
					...learns,
					woke: new Set(game.seating.filter((s) => wokeTonight(game, s, characters, night)))
				}
			: learns;
	const all = reliability(game, seatId, characterId, characters);
	const options = truthfulOptions(game, seatId, characterId, spec, characters, all.registrations);
	const worlds = registrationWorlds(game, characters, all.registrations);
	const optionsOf = (w: RegistrationWorld) =>
		optionsIn(game, seatId, characterId, spec, characters, w);
	const result = (w: RegistrationWorld) => JSON.stringify(optionsOf(w).map(optionKey).sort());
	const relevant = relevantSeats(game, all.registrations, worlds, result);
	const r = onlyRelevant(all, relevant);
	// A number is one value; other pickers have many options, so no single alternative.
	const numberIn = (w: RegistrationWorld): AnswerValue | undefined => {
		const n = optionsOf(w)[0]?.number;
		return spec.kind === 'number' && n !== undefined ? { kind: 'number', value: n } : undefined;
	};
	const truth = options.find((o) => !o.registered && o.number !== undefined)?.number;
	const range: NumberRange | undefined =
		spec.kind === 'number' && truth !== undefined
			? {
					truth,
					possible: [...new Set(options.flatMap((o) => o.number ?? []))].sort((a, b) => a - b)
				}
			: undefined;
	return {
		...r,
		kind: spec.kind,
		measure: spec.measure,
		characterId,
		seatId,
		seatCount: spec.seatCount,
		...(spec.type ? { characterType: spec.type } : {}),
		...(spec.answer ? { answer: spec.answer } : {}),
		options,
		...(range ? { range } : {}),
		anyAllowed: r.unreliable !== undefined,
		why: {
			facts: pickerFacts(game, seatId, characterId, spec, characters, worlds[0]),
			alternatives: alternatives(game, all.registrations, relevant, worlds, numberIn, result)
		},
		reminders: spec.reminders ?? {},
		wiki: wikiOf(characterId, characters)
	};
}

const sameSeats = (a: readonly SeatId[], b: readonly SeatId[]) =>
	a.length === b.length && a.every((s) => b.includes(s));

function matches(picker: InfoPicker, o: InfoOption, choice: InfoChoice): boolean {
	switch (picker.kind) {
		case 'pair-character':
			if (o.none) return choice.none === true;
			return (
				!choice.none &&
				choice.characterId !== undefined &&
				(o.characterId === choice.characterId ||
					(o.characterIds?.includes(choice.characterId) ?? false)) &&
				sameSeats(o.seats, choice.seats)
			);
		case 'number':
			return o.number === choice.number;
		case 'players':
			return sameSeats(o.seats, choice.seats);
		case 'yes-no':
			return sameSeats(o.seats, choice.seats) && o.yes === choice.yes;
	}
}

/** The option a choice matches, preferring one that needs no misregistration. */
export function matchingOption(picker: InfoPicker, choice: InfoChoice): InfoOption | undefined {
	const all = picker.options.filter((o) => matches(picker, o, choice));
	return all.find((o) => !o.registered) ?? all[0];
}

/** Whether a choice is true with everyone registering as they are. */
export function isTruthful(picker: InfoPicker, choice: InfoChoice): boolean {
	const o = matchingOption(picker, choice);
	return o !== undefined && !o.registered;
}

/**
 * Whether the choice is allowed: truthful (counting what registration allows), or anything
 * when the waking player's ability does not work. With a Vortox in play a Townsfolk's info
 * must be false instead.
 */
export function isAllowed(picker: InfoPicker, choice: InfoChoice): boolean {
	if (picker.anyAllowed) return true;
	if (picker.mustBeFalse) return !isTruthful(picker, choice);
	return matchingOption(picker, choice) !== undefined;
}

/**
 * Why a choice worked abnormally, for the Mathematician
 * (https://wiki.bloodontheclocktower.com/Mathematician): nothing when it is true; the
 * players it relies on registering as something else (a Recluse shown as evil to the Chef
 * counts); else the waking player's impairments; else the Vortox. A false choice with no
 * cause is not abnormal, just not allowed.
 */
export function abnormalCauses(picker: InfoPicker, choice: InfoChoice): AbnormalCause[] {
	const o = matchingOption(picker, choice);
	if (o && !o.registered) return [];
	if (o?.registered) {
		return picker.registrations
			.filter((r) => o.registered!.includes(r.seatId))
			.map((r) => ({
				reason: 'registration',
				characterId: r.source.characterId,
				seatId: r.seatId
			}));
	}
	if (picker.impairments.length > 0) return causesOf(picker.impairments);
	if (picker.mustBeFalse && picker.falseBy) {
		return [
			{
				reason: 'vortox',
				characterId: picker.falseBy,
				...(picker.vortox ? { seatId: picker.vortox } : {})
			}
		];
	}
	return [];
}

/**
 * Seats and characters for the picker's display, truthful ones first: seats that are part
 * of a truthful option (the shown character's seat before the other), then the rest.
 */
export function truthfulFirst(
	picker: InfoPicker,
	game: Game
): { seats: SeatId[]; characters: CharacterId[] } {
	const seats: SeatId[] = [];
	const ids: CharacterId[] = [];
	for (const o of picker.options) {
		if (picker.kind === 'pair-character' && o.seats[0] && !seats.includes(o.seats[0])) {
			seats.push(o.seats[0]);
		}
		if (o.characterId && !ids.includes(o.characterId)) ids.push(o.characterId);
	}
	for (const s of game.seating) if (!seats.includes(s)) seats.push(s);
	return { seats, characters: ids };
}

/** Why a piece of information is valid to show. */
export type ValidReason =
	/** True as the grimoire stands. */
	| 'true'
	/** True if the `registered` players register as something else (Spy, Recluse). */
	| 'registers'
	/** Any information is allowed: the waking player is drunk, poisoned or has no ability. */
	| 'unreliable'
	/** The Vortox: only false information is allowed. */
	| 'vortox';

/**
 * One piece of information the Storyteller may show. Every valid one is listed; the app
 * never picks one for them (Trevor, 2026-10-18: "don't give a single suggestion, just show
 * all valid information").
 */
export interface ValidInfo {
	reason: ValidReason;
	/** For `registers`: the players who would have to register otherwise. */
	registered?: SeatId[];
	/** A number (Chef, Empath, Clockmaker; the Librarian's 0). */
	number?: number;
	yes?: boolean;
	none?: boolean;
	/** For a pair: the character, or any of these characters, that may be shown. */
	characterIds?: CharacterId[];
	/** For a pair: the player who is that character. */
	target?: SeatId;
	/**
	 * The players: for a pair, every player who may be shown beside `target`; otherwise the
	 * players the information is about (Fortune Teller's pair, Steward's or Noble's choice).
	 */
	seats: SeatId[];
	/** Any other choice is valid too, for `unreliable` or `vortox` (too many to list). */
	anyOther?: boolean;
}

/** The highest number a number picker could show, for listing every valid one. */
function highestNumber(game: Game, measure: Learns['measure']): number {
	const n = game.seating.length;
	if (measure === 'evil-alive-neighbours' || measure === 'woke-tonight') return 2;
	if (measure === 'demon-minion-steps') return Math.max(1, Math.floor(n / 2));
	return n;
}

/**
 * Every valid piece of information for a picker, grouped for display: the true ones first,
 * then those true only by registration, then what droisoning or the Vortox allows. Pairs
 * are grouped by the shown character and its player, listing every possible second player.
 */
export function validInformation(game: Game, picker: InfoPicker): ValidInfo[] {
	const reasonOf = (o: InfoOption): Pick<ValidInfo, 'reason' | 'registered'> =>
		o.registered ? { reason: 'registers', registered: o.registered } : { reason: 'true' };
	// Under the Vortox the truthful options are exactly the ones not allowed.
	const truthful: ValidInfo[] = picker.mustBeFalse && !picker.unreliable ? [] : groupOptions();
	const extra: ValidInfo[] = [];
	const loose: ValidReason | undefined = picker.unreliable
		? 'unreliable'
		: picker.mustBeFalse
			? 'vortox'
			: undefined;
	if (loose) {
		if (picker.kind === 'number') {
			const taken = new Set(truthful.map((v) => v.number));
			const notTrue = new Set(picker.options.map((o) => o.number));
			for (
				let n = picker.measure === 'demon-minion-steps' ? 1 : 0;
				n <= highestNumber(game, picker.measure);
				n++
			) {
				if (taken.has(n)) continue;
				if (loose === 'vortox' && notTrue.has(n)) continue;
				extra.push({ reason: loose, number: n, seats: [] });
			}
		} else {
			extra.push({ reason: loose, seats: [], anyOther: true });
		}
	}
	return [...truthful, ...extra];

	function groupOptions(): ValidInfo[] {
		if (picker.kind !== 'pair-character') {
			return picker.options.map((o) => ({
				...reasonOf(o),
				seats: [...o.seats],
				...(o.number !== undefined ? { number: o.number } : {}),
				...(o.yes !== undefined ? { yes: o.yes } : {}),
				...(o.none ? { none: true } : {})
			}));
		}
		const groups = new Map<string, ValidInfo>();
		for (const o of picker.options) {
			if (o.none) {
				groups.set('none', { ...reasonOf(o), none: true, number: 0, seats: [] });
				continue;
			}
			const [target, other] = o.seats;
			const ids = o.characterId ? [o.characterId] : (o.characterIds ?? []);
			const key = JSON.stringify([target, ids, o.registered ?? []]);
			const group =
				groups.get(key) ??
				groups.set(key, { ...reasonOf(o), characterIds: ids, target, seats: [] }).get(key)!;
			if (other && !group.seats.includes(other)) group.seats.push(other);
		}
		return [...groups.values()];
	}
}

/** The `RecordNightInfo` fields for a choice: text in our words, tokens to place, and causes. */
export function infoRecord(
	picker: InfoPicker,
	choice: InfoChoice,
	name: { seat: (seatId: SeatId) => string; character: (id: CharacterId) => string },
	game: Game,
	characters: CharacterLookup
): {
	text: string;
	reminders: { seatId: SeatId; reminder: Reminder }[];
	abnormal?: AbnormalCause[];
} {
	const abnormal = abnormalCauses(picker, choice);
	const out = (text: string, reminders: { seatId: SeatId; reminder: Reminder }[]) =>
		abnormal.length > 0 ? { text, reminders, abnormal } : { text, reminders };
	const token = (seatId: SeatId, label: string) => ({
		seatId,
		reminder: { characterId: picker.characterId, label }
	});
	const players = choice.seats.map(name.seat);
	switch (picker.kind) {
		case 'pair-character': {
			if (choice.none) return out(`Shown 0 (none in play)`, []);
			const id = choice.characterId ?? '';
			// The token goes on the player who really is the character, or who registers as it.
			const option = matchingOption(picker, choice);
			const target =
				choice.seats.find((s) => trueCharacter(game, s, characters) === id) ??
				option?.seats[0] ??
				choice.seats[0];
			const other = choice.seats.find((s) => s !== target);
			const reminders = [];
			if (target && picker.reminders.target) reminders.push(token(target, picker.reminders.target));
			if (other && picker.reminders.other) reminders.push(token(other, picker.reminders.other));
			return out(
				players.length === 1
					? `Shown ${players[0]} as the ${name.character(id)}`
					: `Shown ${players.join(' and ')}: one is the ${name.character(id)}`,
				reminders
			);
		}
		case 'number':
			return out(`Shown ${choice.number ?? 0}`, []);
		case 'players':
			return out(
				`Shown ${players.join(', ')}`,
				picker.reminders.each ? choice.seats.map((s) => token(s, picker.reminders.each!)) : []
			);
		case 'yes-no': {
			const shown = answerText(picker.answer, choice.yes === true).toLowerCase();
			return out(
				players.length > 0 ? `Chose ${players.join(' and ')}: shown ${shown}` : `Shown ${shown}`,
				[]
			);
		}
	}
}

/** A `yes-no` answer in words: Yes or No, Evil or Good, Clockwise or Anticlockwise. */
export function answerText(answer: PickerAnswer | undefined, yes: boolean): string {
	if (answer === 'alignment') return yes ? 'Evil' : 'Good';
	if (answer === 'direction') return yes ? 'Clockwise' : 'Anticlockwise';
	return yes ? 'Yes' : 'No';
}
