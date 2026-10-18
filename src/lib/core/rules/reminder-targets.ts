/**
 * Valid targets for reminder tokens (Trevor, 2026-10-16): which seats a token may go on,
 * so the board can show fitting and unfitting players while the Storyteller places or
 * drags one. Curated per character in `reminder-targets.data.ts` from each character's
 * wiki page.
 *
 * This only suggests and warns: a token on an unfitting seat is never refused (the
 * Storyteller can override anything). Checks use the true character and the alignment the
 * rules use (`trueCharacter`, `alignmentOf`), never what a player registers as, because
 * misregistration is the Storyteller's call.
 */
import type { CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import {
	aliveNeighbours,
	alignmentOf,
	registersAsDead,
	trueCharacter,
	typeOf
} from '#lib/core/model/selectors.ts';
import type { Game, Reminder, SeatId } from '#lib/core/model/types.ts';
import { abilityState, registrations } from './ability.ts';
import {
	REMINDER_TARGETS,
	type CharacterTargets,
	type NeighbourRule,
	type TargetRule
} from './reminder-targets.data.ts';

export { REMINDER_TARGETS };
export type { CharacterTargets, NeighbourRule, TargetRule };

/**
 * Why a seat doesn't fit a token's rule, one code per broken condition:
 * - `global`: the token marks the game, not a player;
 * - `not-self` / `self`: only the owner's seat, or never the owner's seat;
 * - `type`, `alignment`, `character`, `life`: the seat's true character type (or the type
 *   of the token it was dealt, for `shown`), alignment, character, or alive/dead state is
 *   wrong;
 * - `neighbour`: not a neighbour as the rule counts them;
 * - `with-label` / `not-with-label`: missing, or already carrying, the owner's other token.
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
	| 'not-with-label';

export interface TargetFit {
	seatId: SeatId;
	/** Empty when the seat fits. */
	misses: TargetMiss[];
}

/** The curated rule for a token, or undefined for homebrew tokens and unlisted labels. */
export function targetRule(reminder: Reminder): TargetRule | undefined {
	return REMINDER_TARGETS[reminder.characterId]?.labels[reminder.label];
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
		(rule.type !== undefined && typeOf(game, id, characters) !== rule.type);
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
 * owner isn't in play, so nothing is flagged that can't be judged.
 */
export function reminderTargetMisses(
	game: Game,
	reminder: Reminder,
	seatId: SeatId,
	characters: CharacterLookup
): TargetMiss[] {
	const rule = targetRule(reminder);
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
	if (rule.life) {
		const dead = game.seats[seatId].dead;
		if (rule.life === 'alive' ? dead : !dead) misses.push('life');
	}
	if (rule.neighbour) {
		const { of, ofType } = rule.neighbour;
		const from = ofType
			? game.seating.filter((id) => typeOf(game, id, characters) === ofType)
			: of === 'self'
				? owners
				: seatsWith(game, reminder.characterId, of);
		if (from.length > 0) {
			const near = from.some((id) =>
				neighbours(game, id, rule.neighbour!, characters).includes(seatId)
			);
			if (!near) misses.push('neighbour');
		}
	}
	const labels = game.seats[seatId].reminders
		.filter((r) => r.characterId === reminder.characterId)
		.map((r) => r.label);
	if (rule.withLabel && !labels.includes(rule.withLabel)) misses.push('with-label');
	if (rule.notWithLabel && labels.includes(rule.notWithLabel)) misses.push('not-with-label');
	return misses;
}

/** Every seat in seating order, with why it doesn't fit (empty when it does). */
export function reminderTargets(
	game: Game,
	reminder: Reminder,
	characters: CharacterLookup
): TargetFit[] {
	return game.seating.map((seatId) => ({
		seatId,
		misses: reminderTargetMisses(game, reminder, seatId, characters)
	}));
}
