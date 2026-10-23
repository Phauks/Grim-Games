/**
 * Valid targets for reminder tokens (Trevor, 2026-10-16): which seats a token may go on,
 * so the board can show fitting and unfitting players while the Storyteller places or
 * drags one. Each character's rules block says where its tokens go (`reminderTargets`, see
 * `data/target-rules.ts`): our `data/rules/<id>.json`, or a custom character's `rules`.
 *
 * This only suggests and warns: a token on an unfitting seat is never refused (the
 * Storyteller can override anything). Checks use the true character and the alignment the
 * rules use (`trueCharacter`, `alignmentOf`), because misregistration is the Storyteller's
 * call, except where a rule says otherwise: info tokens, and a neighbour of a seat that may
 * register as the Demon (the Marionette beside a Recluse; Trevor, 2026-10-23).
 */
import { OFFICIAL_RULES, rulesOf } from '#lib/core/data/rules/index.ts';
import type { NeighbourRule, TargetRule } from '#lib/core/data/target-rules.ts';
import type { CharacterId, ReminderLabel } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	alignmentOf,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { Game, Reminder, ReminderInstance, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';

export type { NeighbourRule, TargetRule };

export interface CharacterTargets {
	labels: Readonly<Record<ReminderLabel, TargetRule>>;
}

/** The official characters' token rules, by character id. */
export const REMINDER_TARGETS: Readonly<Record<CharacterId, CharacterTargets>> = Object.fromEntries(
	[...OFFICIAL_RULES].flatMap(([id, rules]) =>
		rules.reminderTargets ? [[id, { labels: rules.reminderTargets }]] : []
	)
);

/**
 * Why a seat doesn't fit a token's rule, one code per broken condition:
 * - `global`: the token marks the game, not a player;
 * - `not-self` / `self`: only the owner's seat, or never the owner's seat;
 * - `type`, `alignment`, `character`, `life`: the seat's true character type (or the type
 *   of the token it was dealt, for `shown`), alignment, character, or alive/dead state is
 *   wrong;
 * - `neighbour`: not a neighbour as the rule counts them;
 * - `with-label` / `not-with-label`: missing, or already carrying, the owner's other token;
 * - `last-night`: the ability says "different to last night", and this player carried the
 *   token at the latest dawn (or, for `type`, has that player's character type).
 */
export type TargetMiss =
	| 'global'
	| 'not-self'
	| 'self'
	| 'type'
	| 'alignment'
	| 'character'
	| 'life'
	| 'neighbour'
	| 'with-label'
	| 'not-with-label'
	| 'last-night';

export interface TargetFit {
	seatId: SeatId;
	/** Empty when the seat fits. */
	misses: TargetMiss[];
}

/** The rule for a token, or undefined for a token whose character's rules give none. */
export function targetRule(
	reminder: Reminder,
	characters?: CharacterLookup
): TargetRule | undefined {
	return rulesOf(reminder.characterId, characters)?.reminderTargets?.[reminder.label];
}

/**
 * Whether the token exists in this game: one with `minOwners` only while that many seats hold
 * its character (the Village Idiot's Drunk, with 2 or more Village Idiots; Trevor,
 * 2026-10-23).
 */
export function reminderOffered(
	game: Game,
	reminder: Reminder,
	characters: CharacterLookup
): boolean {
	const min = targetRule(reminder, characters)?.minOwners;
	return min === undefined || ownerSeats(game, reminder.characterId, characters).length >= min;
}

/** Seats whose true character (or character token) is the token's character. */
export function ownerSeats(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): SeatId[] {
	return game.seating.filter(
		(id) =>
			game.seats[id].characterId === characterId ||
			trueCharacter(game, id, characters) === characterId
	);
}

function seatsWith(game: Game, characterId: CharacterId, label: string): SeatId[] {
	return game.seating.filter((id) =>
		game.seats[id].reminders.some((r) => r.characterId === characterId && r.label === label)
	);
}

/** The nearest seat each way from `from` that the rule counts as a neighbour. */
function neighbours(
	game: Game,
	from: SeatId,
	rule: NeighbourRule,
	characters: CharacterLookup
): SeatId[] {
	const skip = (id: SeatId) =>
		(rule.alive === true && registersAsDead(game, id)) ||
		(rule.type !== undefined && typeOf(game, id, characters) !== rule.type) ||
		(rule.alignment !== undefined && alignmentOf(game, id) !== rule.alignment);
	return aliveNeighbours(game, from, skip);
}

/**
 * Whether the information a character's player was given may be false: they are really
 * another character (the Drunk, Lunatic or Marionette shown it), or drunk or poisoned
 * (https://wiki.bloodontheclocktower.com/Drunk, https://wiki.bloodontheclocktower.com/Poisoner).
 */
function mayBeFalse(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	if (trueCharacter(game, seatId, characters) !== characterId) return true;
	return abilityState(game, seatId, characters).impairments.length > 0;
}

/**
 * Whether `seatId` fits the token's rule. A seat always fits a token with no rule. Rules
 * that depend on the owner (its seat, alignment or neighbours) are skipped while the
 * owner isn't in play, so nothing is flagged that can't be judged. `atDawn` is the game as
 * it stood at the latest "New day" (`dawnGames`), for "different to last night"; without it
 * (the first night) that check is skipped.
 */
export function reminderTargetMisses(
	game: Game,
	reminder: Reminder,
	seatId: SeatId,
	characters: CharacterLookup,
	atDawn?: Game
): TargetMiss[] {
	const rule = targetRule(reminder, characters);
	if (!rule || !Object.hasOwn(game.seats, seatId)) return [];
	if (rule.global) return ['global'];

	const owners = ownerSeats(game, reminder.characterId, characters);
	if (rule.info && owners.some((id) => mayBeFalse(game, id, reminder.characterId, characters)))
		return [];
	const misses: TargetMiss[] = [];
	const isOwner = owners.includes(seatId);
	if (rule.seat === 'self' && owners.length > 0 && !isOwner) misses.push('not-self');
	if (rule.seat === 'other' && isOwner) misses.push('self');

	// What an info token marks is what the player registered as: the Recluse may register as
	// an evil Minion or Demon, the Spy as a good Townsfolk or Outsider (Trevor, 2026-10-18;
	// https://wiki.bloodontheclocktower.com/Recluse, https://wiki.bloodontheclocktower.com/Spy).
	const registered = rule.info
		? registrations(game, characters).find((r) => r.seatId === seatId)
		: undefined;
	if (rule.types) {
		const type = typeOf(game, seatId, characters);
		const types = registered?.types ?? (type === undefined ? [] : [type]);
		if (type !== undefined && !types.some((t) => rule.types!.includes(t))) misses.push('type');
	}
	if (rule.shown) {
		const shown = game.seats[seatId].characterId;
		const type = shown === undefined ? undefined : characters.get(shown)?.type;
		if (type !== undefined && !rule.shown.includes(type)) misses.push('type');
	}
	if (rule.characters) {
		const id = trueCharacter(game, seatId, characters);
		if (id !== undefined && !rule.characters.includes(id)) misses.push('character');
	}
	if (rule.alignment) {
		const alignment = alignmentOf(game, seatId);
		if (alignment !== undefined) {
			if (rule.alignment === 'good' || rule.alignment === 'evil') {
				const alignments = registered?.alignments ?? [alignment];
				if (!alignments.includes(rule.alignment)) misses.push('alignment');
			} else {
				const ownerAlignments = owners
					.map((id) => alignmentOf(game, id))
					.filter((a) => a !== undefined);
				const fitsOne = ownerAlignments.some((a) =>
					rule.alignment === 'same' ? a === alignment : a !== alignment
				);
				if (ownerAlignments.length > 0 && !fitsOne) misses.push('alignment');
			}
		}
	}
	if (rule.alignmentCounts) {
		const alignment = alignmentOf(game, seatId);
		const max = alignment ? rule.alignmentCounts[alignment] : undefined;
		if (max !== undefined) {
			const self = 'reminderId' in reminder ? (reminder as ReminderInstance).reminderId : undefined;
			const placed = game.seating
				.filter((id) => alignmentOf(game, id) === alignment)
				.flatMap((id) => game.seats[id].reminders)
				.filter(
					(r) =>
						r.characterId === reminder.characterId &&
						r.label === reminder.label &&
						r.reminderId !== self
				).length;
			if (placed >= max) misses.push('alignment');
		}
	}
	if (rule.life) {
		const dead = game.seats[seatId].dead;
		if (rule.life === 'alive' ? dead : !dead) misses.push('life');
	}
	if (rule.neighbour) {
		const near = rule.neighbour;
		const from = near.ofType
			? game.seating.filter(
					(id) =>
						typeOf(game, id, characters) === near.ofType ||
						registrations(game, characters).some(
							(r) => r.seatId === id && r.types.includes(near.ofType!)
						)
				)
			: near.of === 'self'
				? owners
				: seatsWith(game, reminder.characterId, near.of);
		if (from.length > 0) {
			const fits = from.some((id) => {
				const seats = neighbours(game, id, near, characters);
				if (!seats.includes(seatId)) return false;
				// Both neighbours must fit (the Tea Lady protects only while both are good).
				return (
					!near.both ||
					seats.every((s) => !rule.alignment || rule.alignment === alignmentOf(game, s))
				);
			});
			if (!fits) misses.push('neighbour');
		}
	}
	const labels = game.seats[seatId].reminders
		.filter((r) => r.characterId === reminder.characterId)
		.map((r) => r.label);
	if (rule.withLabel && !labels.includes(rule.withLabel)) misses.push('with-label');
	if (rule.notWithLabel && labels.includes(rule.notWithLabel)) misses.push('not-with-label');
	if (rule.differsFromLastNight && atDawn) {
		const before = seatsWith(atDawn, reminder.characterId, reminder.label);
		const type = typeOf(game, seatId, characters);
		const repeat =
			rule.differsFromLastNight === 'player'
				? before.includes(seatId)
				: type !== undefined && before.some((id) => typeOf(atDawn, id, characters) === type);
		if (repeat) misses.push('last-night');
	}
	return misses;
}

/** Every seat in seating order, with why it doesn't fit (empty when it does). */
export function reminderTargets(
	game: Game,
	reminder: Reminder,
	characters: CharacterLookup,
	atDawn?: Game
): TargetFit[] {
	return game.seating.map((seatId) => ({
		seatId,
		misses: reminderTargetMisses(game, reminder, seatId, characters, atDawn)
	}));
}
