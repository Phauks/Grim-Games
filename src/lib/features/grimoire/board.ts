/**
 * Board helpers that are UI only: which characters the pickers offer and the text shown
 * for engine warnings. Rules stay in `#lib/core`; where seats sit is `#lib/ui/seating`.
 */
import {
	findEdition,
	type Alignment,
	type Character,
	type CharacterId,
	type CharacterType,
	type Script
} from '#lib/core/data/index.ts';
import type { EngineWarning } from '#lib/core/engine/index.ts';
import {
	analyseSetup,
	reminderTargetMisses,
	targetRule,
	type DeathCauseFlag,
	type TargetMiss
} from '#lib/core/rules/index.ts';
import {
	GENERAL_DEATH_CAUSES,
	isOnScript,
	scriptCharacterIds,
	trueCharacter,
	type CharacterLookup,
	type DeathCause,
	type Game,
	type Reminder,
	type Seat,
	type SeatId
} from '#lib/core/model/index.ts';

/** The types offered for a seat, in script-sheet order. */
export const SEAT_TYPES: readonly CharacterType[] = [
	'townsfolk',
	'outsider',
	'minion',
	'demon',
	'traveller'
];

export interface CharacterGroup {
	type: CharacterType;
	characters: Character[];
}

/**
 * Characters for a picker, grouped by type. With `all` false only the script's characters
 * are offered, plus every Traveller (Travellers can join any game). Each group keeps
 * script order, then name order for characters off the script.
 */
export function pickerGroups(
	characters: CharacterLookup,
	script: Script,
	types: readonly CharacterType[],
	all: boolean
): CharacterGroup[] {
	const order = new Map(scriptCharacterIds(script).map((id, i) => [id, i]));
	const rank = (c: Character) => order.get(c.id) ?? Number.MAX_SAFE_INTEGER;
	const pool = [...characters.values()].filter(
		(c) =>
			all || order.has(c.id) || c.type === 'traveller' || c.type === 'fabled' || c.type === 'loric'
	);
	return types
		.map((type) => ({
			type,
			characters: pool
				.filter((c) => c.type === type)
				.sort((x, y) => rank(x) - rank(y) || x.name.localeCompare(y.name))
		}))
		.filter((group) => group.characters.length > 0);
}

/**
 * The Travellers a script recommends: those on the script itself, and for an official
 * edition the edition's own Travellers (https://wiki.bloodontheclocktower.com/Travellers).
 */
export function recommendedTravellers(script: Script, characters: CharacterLookup): CharacterId[] {
	const out = scriptCharacterIds(script).filter((id) => characters.get(id)?.type === 'traveller');
	const edition = findEdition(script.meta?.name ?? '')?.id;
	if (edition) {
		for (const c of characters.values()) {
			if (c.type === 'traveller' && c.edition === edition && !out.includes(c.id)) out.push(c.id);
		}
	}
	return out;
}

/**
 * The orphan warning: a seat whose character token is not on the game's script (Travellers
 * never are, so they are not orphans).
 */
export function isOrphan(seat: Seat, script: Script, characters: CharacterLookup): boolean {
	if (seat.characterId === undefined) return false;
	const character = characters.get(seat.characterId);
	if (!character) return true;
	return character.type !== 'traveller' && !isOnScript(script, seat.characterId);
}

/**
 * A death cause that is a character's ability (the Slayer, the Witch), or undefined for the
 * causes with their own words. Screens show that character as a badge (CauseName).
 */
export function causeCharacter(cause: DeathCause | undefined): CharacterId | undefined {
	return cause === undefined || (GENERAL_DEATH_CAUSES as readonly string[]).includes(cause)
		? undefined
		: cause;
}

/**
 * A cause's words. Travellers are exiled rather than executed. A character's ability is
 * its plain name, for accessible names; screens use CauseName, which shows its badge.
 */
export function causeLabel(
	cause: DeathCause | undefined,
	characters: CharacterLookup,
	traveller = false
): string {
	switch (cause) {
		case undefined:
			return 'None';
		case 'execution':
			return traveller ? 'Exiled' : 'Executed';
		case 'exile':
			return 'Exiled';
		case 'demon':
			return 'The Demon';
		case 'other':
			return 'Something else';
		default:
			// eslint-disable-next-line grim/names-as-badges -- plain, for accessible names (above)
			return characters.get(cause)?.name ?? cause;
	}
}

/**
 * Why a death cause is offered with a caution, for the overlay behind its marker. Uses
 * player names (or "Seat N"), and the character (`by`) to show as a badge after the text;
 * the rule itself is core's.
 */
export function causeFlagText(
	flag: DeathCauseFlag,
	game: Game,
	characters: CharacterLookup,
	victim: string
): { text: string; by?: CharacterId } {
	const name = (seatId: SeatId) =>
		game.seats[seatId]?.playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;
	switch (flag.code) {
		case 'registers': {
			// "Only if Ana registered falsely ([Recluse])": the character shows as a badge.
			return { text: `Only if ${victim} registered falsely`, by: flag.source.characterId };
		}
		case 'impaired':
			return {
				text: `${flag.seatIds.map(name).join(', ')} ${flag.seatIds.length === 1 ? 'is' : 'are'} drunk, poisoned or without an ability now.`
			};
		case 'unknown':
			return { text: `${victim}'s alignment or character is not set, so this can't be checked.` };
	}
}

/** What a toast says for a warning the Storyteller went ahead with. */
export function warningText(warning: EngineWarning): string | undefined {
	switch (warning.code) {
		// "reminder-fixed" and "reminder-not-from-rule-character" were asked about before the
		// move (ReminderMoveConfirm); ticking Dawn
		// starts the new day by itself, logged or not ("empty-day").
		case 'no-change':
		case 'reminder-fixed':
		case 'reminder-not-from-rule-character':
		case 'empty-day':
			return undefined;
		case 'not-on-script':
			return 'That character is not on the script.';
		case 'already-in-play':
			return 'That character is already on another seat.';
		case 'kept-alignment':
			return 'The seat kept its alignment. Change it in the seat sheet if needed.';
		case 'seat-has-character':
			return 'The removed seat had a character.';
		case 'ghost-vote-while-alive':
			return 'That player is alive.';
		default:
			return warning.message;
	}
}

/**
 * The alignment of the player whose character a reminder belongs to (Trevor, 2026-10-16):
 * its icon is drawn in that colour, so a turned-evil good player's reminders are red. The
 * seat with that token, else the seat that really is that character (the Drunk); unknown
 * when nobody holds it, and the icon then follows the character type.
 */
export function placingAlignment(
	game: Game,
	characterId: CharacterId,
	characters: CharacterLookup
): Alignment | undefined {
	const holder =
		game.seating.find((s) => game.seats[s].characterId === characterId) ??
		game.seating.find((s) => trueCharacter(game, s, characters) === characterId);
	return holder ? game.seats[holder].alignment : undefined;
}

export interface TableCheck {
	/** Players before and after, Travellers not counted. */
	players: { before: number; after: number };
	/** What no longer matches the setup sheet after the change; empty when it all fits. */
	problems: string[];
	/** The table already did not match before the change. */
	wasOff: boolean;
}

const TABLE_WARNINGS = new Set(['count-mismatch', 'total-mismatch', 'missing-required']);

function tableProblems(
	game: Game,
	characters: CharacterLookup,
	seats: readonly { seatId: SeatId; characterId: CharacterId | undefined }[]
): { players: number; problems: string[] } {
	const inPlay: Character[] = [];
	let travellers = 0;
	for (const { characterId } of seats) {
		const character = characterId ? characters.get(characterId) : undefined;
		if (!character) continue;
		if (character.type === 'traveller') travellers += 1;
		inPlay.push(character);
	}
	for (const id of game.ruleCharacters) {
		const character = characters.get(id);
		if (character) inPlay.push(character);
	}
	const analysis = analyseSetup({
		players: seats.length,
		travellers,
		inPlay,
		findById: (id) => characters.get(id),
		// Homebrew brackets name characters: "[+ Spartacus]".
		findByName: (name) =>
			[...characters.values()].find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.id
	});
	return {
		players: seats.length - travellers,
		problems: analysis.warnings.filter((w) => TABLE_WARNINGS.has(w.code)).map((w) => w.message)
	};
}

/**
 * How removing a seat or its character changes the table (Trevor, 2026-10-16): the player
 * count before and after, and whether the characters still match the setup sheet for that
 * count (core `analyseSetup`, setup modifiers such as the Baron included). Each seat counts
 * as its true character, so a Drunk counts as the Outsider. A warning, never a lock.
 */
export function tableCheck(
	game: Game,
	characters: CharacterLookup,
	change: { kind: 'remove-seat' | 'remove-character'; seatId: SeatId }
): TableCheck {
	const now = game.seating.map((seatId) => ({
		seatId,
		characterId: trueCharacter(game, seatId, characters)
	}));
	const after =
		change.kind === 'remove-seat'
			? now.filter((s) => s.seatId !== change.seatId)
			: now.map((s) => (s.seatId === change.seatId ? { ...s, characterId: undefined } : s));
	const before = tableProblems(game, characters, now);
	const next = tableProblems(game, characters, after);
	return {
		players: { before: before.players, after: next.players },
		problems: next.problems,
		wasOff: before.problems.length > 0
	};
}

/** Why a seat doesn't fit a reminder, in words (codes from reminder-targets.ts). */
const MISS_WORDS: Record<TargetMiss, string> = {
	global: 'it marks the game, not a player',
	'not-self': "it goes on its character's own player",
	self: "it never goes on its character's own player",
	type: 'the character type is not one it goes on',
	alignment: 'the alignment is not one it goes on',
	character: 'the character is not one it goes on',
	life: 'it goes on a player who is alive or dead, not this one',
	neighbour: 'this player is not a neighbour it can go on',
	'with-label': 'it needs another reminder on the same player',
	'not-with-label': 'another reminder on this player rules it out'
};

/** Checks that need to know who the player is. */
const NEEDS_CHARACTER: readonly TargetMiss[] = ['type', 'alignment', 'character'];

/**
 * Why a seat doesn't fit a reminder. A seat with no character yet is not judged on its
 * type, alignment or character: the Storyteller may still be setting up.
 */
export function seatMisses(
	game: Game,
	reminder: Reminder,
	seatId: SeatId,
	characters: CharacterLookup
): TargetMiss[] {
	const misses = reminderTargetMisses(game, reminder, seatId, characters);
	return game.seats[seatId]?.characterId === undefined
		? misses.filter((m) => !NEEDS_CHARACTER.includes(m))
		: misses;
}

/**
 * What the board says when a reminder goes on a seat that doesn't fit it (Trevor,
 * 2026-10-16): the reasons, then the token's own one-line summary. Undefined when it fits or
 * has no curated rule (homebrew). Warns only; the reminder is still placed.
 */
export function reminderFitWarning(
	game: Game,
	reminder: Reminder,
	seatId: SeatId,
	characters: CharacterLookup
): string | undefined {
	const misses = seatMisses(game, reminder, seatId, characters);
	if (misses.length === 0) return undefined;
	const why = misses.map((m) => MISS_WORDS[m]).join('; ');
	const note = targetRule(reminder)?.note;
	return `Not a usual place for it: ${why}.${note ? ` ${note}` : ''}`;
}
