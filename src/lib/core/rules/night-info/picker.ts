/**
 * Night information: the info picker, the truthful options for a character whose rules
 * block `learns` something. Part of `night-info.ts`.
 */
import { isLearnsBlock, type Learns, type LearnsBlock } from '#lib/core/data/character-rules.ts';
import type { CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { AbnormalCause, Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import {
	type Registration,
	type RegistrationWorld,
	registrationWorlds,
	registrations
} from '../ability.ts';
import { pretendGame } from '../pretend.ts';
import { causesOf } from '../night-deaths.ts';
import type { Night } from '../night-order.ts';
import { wokeTonight } from '../woke-tonight.ts';
import { carries } from './token-carriers.ts';
import { perPairOptions } from './neighbour-pairs.ts';
import {
	blockFacts,
	blockHighest,
	blockLowest,
	blockMostTrue,
	blockOptions,
	type BlockSpec
} from './blocks.ts';
import {
	type AnswerValue,
	type Reliability,
	type Why,
	type WhyFact,
	alternatives,
	anyInfo,
	fact,
	mayBeFalseCause,
	onlyRelevant,
	relevantSeats,
	reliability,
	wikiOf
} from './reliability.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';

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
	/**
	 * What the character learns (its rules block's `learns.measure`): the official name it was
	 * written as, for a building block written as a preset.
	 */
	measure: Learns['measure'];
	/** For `number`: the highest number it can show. */
	highest?: number;
	/** For `number`: the lowest number it can show (a distance is at least 1). */
	lowest?: number;
	/**
	 * For `number`, when lower than `highest`: the highest number that could be true (the most
	 * pairs the evil players can make). Information that may be false (drunk, poisoned) stays
	 * within it; information that must be false may go beyond it (the lying Storyteller gives
	 * the Chef more pairs than there are, https://wiki.bloodontheclocktower.com/Knaves Example 1).
	 */
	mostTrue?: number;
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
	/**
	 * Every option is allowed, because the waking player's ability does not work, or the
	 * Storyteller may break the rules (`anyBy`: the Atheist).
	 */
	anyAllowed: boolean;
	/**
	 * The options that fit the Storyteller's pretend evil team (`pretendGame`, M26), as if those
	 * players were their pretend characters; absent with no pretend team. Suggested first.
	 */
	pretend?: InfoOption[];
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
	/** For a block with `woke`: the players who woke tonight by their own ability. */
	wokeSeats?: ReadonlySet<SeatId>;
	/**
	 * The answer is the Storyteller's judgement, with no truth the grimoire holds (the High
	 * Priestess): every option is valid, and the Vortox has nothing to make false.
	 */
	judgement?: true;
}

type PickerShape = Pick<PickerSpec, 'kind' | 'seatCount' | 'answer' | 'judgement'>;
/**
 * The picker each `learns` building block shows: its kind and, from `choose`, how many players
 * are tapped. Every official name is a preset of a block, expanded when read
 * (`data/parts/answers.ts`, `data/parts/learns.ts`).
 */
const BLOCK_SHAPES: Readonly<Record<LearnsBlock, Omit<PickerShape, 'seatCount'>>> = {
	count: { kind: 'number' },
	players: { kind: 'players' },
	'any-of': { kind: 'yes-no' },
	character: { kind: 'pair-character' },
	same: { kind: 'yes-no' },
	alignment: { kind: 'yes-no', answer: 'alignment' },
	direction: { kind: 'yes-no', answer: 'direction' },
	distance: { kind: 'number' },
	storyteller: { kind: 'players', judgement: true }
};

function shapeOf(learns: Learns): PickerShape | undefined {
	if (!isLearnsBlock(learns.measure)) return undefined;
	return { ...BLOCK_SHAPES[learns.measure], seatCount: learns.choose ?? 0 };
}

/** The character type a two-player `character` block shows (the Washerwoman's Townsfolk). */
function characterTypeOf(spec: PickerSpec): CharacterType | undefined {
	return spec.measure === 'character' && spec.choose === 2 && spec.types?.length === 1
		? spec.types[0]
		: undefined;
}

/**
 * The picker for a character that `learns` first-night information (its rules block: our
 * `data/rules/<id>.json`, or a custom character's `rules`), or undefined.
 */
function pickerSpec(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): PickerSpec | undefined {
	const learns = rulesFor(game, characterId, characters)?.learns;
	const shape = learns && shapeOf(learns);
	return learns && shape && { ...learns, ...shape };
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
	if (!isBlock(spec)) return [];
	return blockOptions(spec, { game, seatId, characterId, characters, world });
}

const isBlock = (spec: PickerSpec): spec is PickerSpec & BlockSpec => isLearnsBlock(spec.measure);

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
	const worlds = registrationWorlds(game, characters, regs);
	const [base, ...rest] = worlds;
	const out = optionsIn(game, seatId, characterId, spec, characters, base);
	const seen = new Set(out.map(optionKey));
	const add = (option: InfoOption, registered: SeatId[]) => {
		const key = optionKey(option);
		if (seen.has(key)) return;
		seen.add(key);
		out.push({ ...option, registered });
	};
	for (const world of rest) {
		for (const option of optionsIn(game, seatId, characterId, spec, characters, world)) {
			add(option, world.misregistered);
		}
	}
	// Then what is only true when a player registers differently for each pair they are in.
	const registering = new Set(regs.map((r) => r.seatId));
	// Worlds differing only in how those players register give the same counts here.
	const usual = (w: RegistrationWorld) =>
		regs.every((r) => w.alignment(r.seatId) === r.alignments[0] && w.type(r.seatId) === r.types[0]);
	for (const world of worlds.filter(usual)) {
		const others = world.misregistered.filter((s) => !registering.has(s));
		for (const { option, registered } of perPairOptions(game, spec, regs, world)) {
			add(option, [...new Set([...others, ...registered])]);
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
	const f = (s: SeatId) => fact(game, s, characters, world);
	if (!isBlock(spec)) return [];
	// The Fortune Teller's red herring is marked as one.
	return blockFacts(spec, { game, seatId, characterId, characters, world }).map((s) =>
		spec.token && carries(game, s, characterId, spec.token) ? { ...f(s), redHerring: true } : f(s)
	);
}

/** The info picker for a waking player, or undefined for a character it does not cover. */
export function infoPicker(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup,
	night: Night = game.pastDays.length === 0 ? 'first' : 'other'
): InfoPicker | undefined {
	const learns = pickerSpec(game, characterId, characters);
	if (!learns) return undefined;
	const spec: PickerSpec = learns.woke
		? {
				...learns,
				wokeSeats: new Set(game.seating.filter((s) => wokeTonight(game, s, characters, night)))
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
	if (spec.judgement) {
		delete r.mustBeFalse;
		delete r.falseSeat;
		delete r.falseBy;
	}
	// A number is one value; other pickers have many options, so no single alternative.
	const numberIn = (w: RegistrationWorld): AnswerValue | undefined => {
		const n = optionsOf(w)[0]?.number;
		return spec.kind === 'number' && n !== undefined ? { kind: 'number', value: n } : undefined;
	};
	const fake = pretendGame(game, characters);
	const pretend = fake
		? truthfulOptions(fake, seatId, characterId, spec, characters, registrations(fake, characters))
		: undefined;
	// Players who match in some registration world (a Recluse may register evil).
	const matchable = (block: BlockSpec) =>
		new Set(
			worlds.flatMap((world) => blockFacts(block, { game, seatId, characterId, characters, world }))
		).size;
	const mostTrue =
		isBlock(spec) && spec.kind === 'number'
			? blockMostTrue(spec, game, () => matchable(spec))
			: undefined;
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
		measure: spec.preset ?? spec.measure,
		...(isBlock(spec) && spec.kind === 'number'
			? { highest: blockHighest(spec, game), lowest: blockLowest(spec) }
			: {}),
		...(mostTrue !== undefined ? { mostTrue } : {}),
		characterId,
		seatId,
		seatCount: spec.seatCount,
		...(characterTypeOf(spec) ? { characterType: characterTypeOf(spec) } : {}),
		...(spec.answer ? { answer: spec.answer } : {}),
		options,
		...(range ? { range } : {}),
		anyAllowed: anyInfo(r) || r.anyBy !== undefined,
		...(pretend ? { pretend } : {}),
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
	if (picker.mayBeFalse) return [mayBeFalseCause(picker.mayBeFalse)];
	if (picker.mustBeFalse && picker.falseBy) {
		return [
			{
				reason: 'false-info',
				characterId: picker.falseBy,
				...(picker.falseSeat ? { seatId: picker.falseSeat } : {})
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

export { type ValidInfo, type ValidReason, validInformation } from './valid-info.ts';

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
