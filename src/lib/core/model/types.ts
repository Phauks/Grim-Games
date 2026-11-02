/**
 * The game state a grimoire holds (04-architecture.md §3, as revised 2026-10-15).
 *
 * Game terms: a character has a *type* (townsfolk ... loric), a player has an *alignment*
 * (good/evil). A *seat* is a player wherever they sit; *seating* is the clockwise order.
 * Fabled and Loric are *rule characters* held on the game, never on a seat.
 *
 * State is only ever changed by the engine's reducer (`#lib/core/engine`), so these types
 * are plain, JSON-serialisable data.
 */
import type {
	Alignment,
	CharacterId,
	ReminderLabel,
	Script,
	PlayerName
} from '#lib/core/data/index.ts';
import type { DayMark } from '#lib/core/data/day-mark-rules.ts';
// Type-only: the Storyteller's night-order and day-reminder overrides are defined next to
// the rules that apply them, and stored on the game.
import type { DayReminderOverride } from '#lib/core/rules/day-reminders.ts';
import type { NightStepOverride } from '#lib/core/rules/night-order.ts';
import type { FrameId } from '#lib/core/frames/index.ts';
import type { AvatarId } from '#lib/core/avatars/index.ts';

export type GameId = string;
export type SeatId = string;
/** Identifies one reminder token placed in the grimoire. */
export type ReminderId = string;
/** Identifies one tile in the bag. */
export type TileId = string;
/** Identifies one entry in a day log. */
export type DayEntryId = string;

/**
 * A reminder token as TPI's data names it: the character it belongs to and its text,
 * e.g. `{ characterId: 'drunk', label: 'Is The Drunk' }` or `{ characterId: 'zombuul',
 * label: 'Dead' }`.
 */
export interface Reminder {
	characterId: CharacterId;
	label: ReminderLabel;
	/**
	 * The seat whose copy of the character this token is, when the character is in play more
	 * than once (Trevor, 2026-10-19: a good and an evil Imp each have their own tokens, in
	 * their own colours). None when there is only one, or it isn't known.
	 */
	ownerSeatId?: SeatId;
}

/** A reminder token placed in the grimoire. It belongs to a seat and moves with it. */
export interface ReminderInstance extends Reminder {
	reminderId: ReminderId;
	/** The Storyteller's own words on it; only the generic ∞ reminder has one so far. */
	note?: string;
	/**
	 * What the generic reminder shows in its middle (Trevor, 2026-10-19: chosen per token): a
	 * symbol's icon id or an emoji. None shows a blank token.
	 */
	symbol?: string;
	/**
	 * The colour of the generic reminder's symbol (Trevor, 2026-10-20). None is the reminder's
	 * own ink. An emoji keeps its own colours.
	 */
	symbolColour?: SymbolColour;
	/**
	 * The generic reminder's icon symbol drawn filled instead of as an outline, chosen per
	 * token (Trevor, 2026-10-23). An emoji is unaffected.
	 */
	symbolFill?: true;
	/**
	 * The character reminder a generic one was copied from (Trevor, 2026-10-27: dragged onto
	 * "+ New token"): it shows that character's art while it has no symbol, and is placed with
	 * the seats that reminder fits suggested.
	 */
	like?: Reminder;
}

/**
 * What a generic reminder looks like: its text, its symbol and how the symbol is drawn, and
 * the character reminder it copies, if any.
 */
export type GenericLook = Pick<
	ReminderInstance,
	'note' | 'symbol' | 'symbolColour' | 'symbolFill' | 'like'
>;

/**
 * A reusable ∞ token in the reminder bank (plan B9, Trevor 2026-10-23: "Tokens only"): made
 * with "+ New token", it stays in the bank, and every copy pulled from it starts with its
 * look. Changing it later leaves the copies already placed as they are.
 */
export interface GenericToken extends GenericLook {
	tokenId: string;
}

/** Colours a generic reminder's symbol can take, each one of the theme's own colours. */
export const SYMBOL_COLOURS = ['blue', 'red', 'purple', 'gold', 'green'] as const;
export type SymbolColour = (typeof SYMBOL_COLOURS)[number];

/**
 * The generic ∞ reminder's `characterId` (Trevor, 2026-10-18: one plain reminder, as many as
 * needed, with optional text, instead of a custom reminder). It belongs to no character.
 */
export const GENERIC_REMINDER_ID = 'generic';

/**
 * What a Storyteller override replaces. Overrides win over anything the rules conclude:
 * - `registersAsDead`: whether abilities treat the player as dead;
 * - `alignment`: the alignment the rules use for this player;
 * - `character`: the player's true character for the rules;
 * - `canDie`: whether the player can die (behaviours such as the Tea Lady ask this).
 */
export type SeatOverride =
	| { field: 'registersAsDead'; value: boolean; note?: string }
	| { field: 'alignment'; value: Alignment; note?: string }
	| { field: 'character'; value: CharacterId; note?: string }
	| { field: 'canDie'; value: boolean; note?: string };

export type OverrideField = SeatOverride['field'];
export const OVERRIDE_FIELDS = [
	'registersAsDead',
	'alignment',
	'character',
	'canDie'
] as const satisfies readonly OverrideField[];

/**
 * How a player died, when the Storyteller recorded it: executed, exiled (Travellers),
 * killed by the Demon, a character's ability (its id), or something else. Undefined means
 * not recorded. The app does not track day or night, so the cause is never inferred.
 * Exile is not an execution (https://wiki.bloodontheclocktower.com/Exile).
 */
export type DeathCause = 'execution' | 'exile' | 'demon' | 'other' | CharacterId;

/** The death causes that are not a character. */
export const GENERAL_DEATH_CAUSES = [
	'execution',
	'demon',
	'other',
	'exile'
] as const satisfies readonly DeathCause[];

/** A player, wherever they sit. */
export interface Seat {
	seatId: SeatId;
	playerName?: PlayerName;
	/** The character token in the grimoire for this player: what they were shown. */
	characterId?: CharacterId;
	/**
	 * Set whenever `characterId` is: defaulted from the character type, and always chosen
	 * by the Storyteller for a Traveller. Undefined only while the seat has no character.
	 */
	alignment?: Alignment;
	dead: boolean;
	/**
	 * At the table but not in play yet (Trevor, 2026-10-31): a Traveller who arrives mid-game
	 * sits down before the night they join at. Such a seat counts for nothing (votes, the alive
	 * count, nominations, the game's end) until it comes into play, by hand or when the next
	 * night starts. Absent once in play.
	 */
	notInPlay?: true;
	/** How the player died, if the Storyteller recorded it. Only set while `dead`. */
	deathCause?: DeathCause;
	/** True once a dead player has used their vote. */
	ghostVoteUsed: boolean;
	/** At most one override per field. */
	overrides: SeatOverride[];
	/**
	 * The Storyteller's private notes about this player (Trevor, 2026-10-16), e.g. the
	 * Mezepheles' word or the Amnesiac's ability: titled, several per player like the game's
	 * own notes (Trevor, 2026-10-26), oldest first. Never in the public projection. Absent
	 * until one is written.
	 */
	notes?: GameNote[];
	/**
	 * The frame the player picked for their token on their own phone (L4), carried with their
	 * avatar. Undefined shows the board's default frame. Purely decorative.
	 */
	frame?: FrameId;
	/**
	 * The picture the player picked on their own phone (plan R6), shown on their seat token.
	 * Undefined shows none. Purely decorative.
	 */
	avatar?: AvatarId;
	reminders: ReminderInstance[];
	/**
	 * Abilities this player has besides their own character's, each given by another
	 * character's `givesAbility` rule (the Boffin's good ability on the Demon,
	 * https://wiki.bloodontheclocktower.com/Boffin). At most one per giver. Absent while none.
	 */
	abilities?: HeldAbility[];
}

/** An ability a player holds without its token: whose it is, and which character gave it. */
export interface HeldAbility {
	characterId: CharacterId;
	via: CharacterId;
}

/**
 * One tile in the bag. `shows` is the character the player sees when they draw it;
 * `grimoire` is the character token that goes in front of their seat in the grimoire.
 * The Drunk is a tile that shows a Townsfolk, puts that Townsfolk in the grimoire, and
 * places "Is The Drunk"; a Lunatic tile shows the Demon and puts the Lunatic in the
 * grimoire.
 */
export interface Tile {
	tileId: TileId;
	shows: CharacterId;
	grimoire: CharacterId;
	/** Reminder tokens placed on the drawing player's seat when the draw is confirmed. */
	reminders: Reminder[];
	/** Set while a player holds the tile (drawn) and after the draw is confirmed. */
	drawnBySeat?: SeatId;
	confirmed: boolean;
}

/** The bag is persisted, so backing out of the draw never loses it. */
export interface Bag {
	tiles: Record<TileId, Tile>;
	/** Tiles still in the bag, in draw order. */
	order: TileId[];
	/** Travellers drawn from the bag get their alignment when the draw is confirmed, or later. */
	includeTravellers: boolean;
	/**
	 * "Is The …" reminders for characters in play with no tile (the Drunk, the Marionette):
	 * the Storyteller puts them on a player once the tokens come back (Trevor, 2026-10-16).
	 * Absent in games saved before this existed, which is the same as none.
	 */
	unseated?: Reminder[];
}

/**
 * The Storyteller's answer to a private guess at a player's own ability (the Amnesiac's,
 * https://wiki.bloodontheclocktower.com/Amnesiac): very wrong, on the right track, very close,
 * or spot on.
 */
export const GUESS_ANSWERS = ['cold', 'warm', 'hot', 'bingo'] as const;
export type GuessAnswer = (typeof GUESS_ANSWERS)[number];

/** A public guess of one player's character (the Juggler's, for example). */
export interface CharacterGuess {
	seatId: SeatId;
	characterId: CharacterId;
}

/**
 * One thing the Storyteller logged since the last "New day" (Trevor, 2026-10-15: the log is
 * cleared by hand, never by the night order, because the app does not track day or night):
 * - `nomination`: who nominated whom. Votes are not tracked; a player-facing vote tracker
 *   comes later. `chosen`: the player the nominee chose because a character in play says so
 *   (the Big Wig's speaker, https://wiki.bloodontheclocktower.com/Big_Wig).
 * - `execution`: the player was executed (and marked dead by execution if they were alive).
 * - `exile`: a Traveller was exiled (and marked dead by exile if alive). Exile is not an
 *   execution: abilities about executions ignore it
 *   (https://wiki.bloodontheclocktower.com/Exile).
 * - `ability`: a character used its ability; `reminderId` is the "No Ability" token placed,
 *   and `on` the player the use was about (whom the Slayer chose, the Virgin's nominator).
 * - `note`: the Storyteller's free text about a character (a Gossip statement, the Artist's
 *   question, what the Savant was told), with structured `guesses` for the Juggler.
 * - `info`: what a waking character was shown, with the reminder tokens it placed, and
 *   whether it worked abnormally (for the Mathematician).
 * - `wish`: a wish a character's player made (its `wish` rule: the Wizard's,
 *   https://wiki.bloodontheclocktower.com/Wizard), granted or declined, with the price and the
 *   clue the Storyteller set, and a standard `effect` the app knows, when they chose one.
 */
export type DayEntry =
	| {
			kind: 'nomination';
			entryId: DayEntryId;
			nominator: SeatId;
			nominee: SeatId;
			chosen?: SeatId;
	  }
	| {
			kind: 'execution';
			entryId: DayEntryId;
			seatId: SeatId;
			died: boolean;
			/**
			 * Executed and does not die (Trevor, 2026-10-23): the ability that saved them, or no
			 * `characterId` for the Storyteller's "can't die" override. Absent when they died or
			 * were already dead.
			 */
			savedBy?: { characterId?: CharacterId; seatId?: SeatId };
	  }
	| { kind: 'exile'; entryId: DayEntryId; seatId: SeatId; died: boolean }
	| {
			kind: 'ability';
			entryId: DayEntryId;
			seatId: SeatId;
			characterId: CharacterId;
			reminderId?: ReminderId;
			on?: SeatId;
	  }
	| {
			kind: 'note';
			entryId: DayEntryId;
			characterId: CharacterId;
			seatId?: SeatId;
			text: string;
			guesses?: CharacterGuess[];
			/** For a statement (the Gossip's): whether it is true, as the Storyteller marked it. */
			holds?: boolean;
			/** For a guess at the player's own ability (the Amnesiac's): the Storyteller's answer. */
			answer?: GuessAnswer;
			/**
			 * The Storyteller's answer in their own words when no `answer` fits ("Lukewarm":
			 * Trevor, 2026-10-31, the answers are a range). Never set with `answer`.
			 */
			customAnswer?: string;
	  }
	| {
			kind: 'info';
			entryId: DayEntryId;
			seatId: SeatId;
			characterId: CharacterId;
			text: string;
			reminderIds: ReminderId[];
			/** Set when the info or ability worked abnormally because of another character. */
			abnormal?: AbnormalCause[];
	  }
	| {
			kind: 'wish';
			entryId: DayEntryId;
			seatId: SeatId;
			characterId: CharacterId;
			text: string;
			granted: boolean;
			price?: string;
			clue?: string;
			effect?: WishEffect;
	  };

/**
 * A granted wish's effect the app knows and acts on, the Storyteller's pick (they decide what
 * a wish does: https://wiki.bloodontheclocktower.com/Wizard):
 * - `good-drunk`: every good player is drunk for the rest of the game.
 */
export const WISH_EFFECTS = ['good-drunk'] as const;
export type WishEffect = (typeof WISH_EFFECTS)[number];

/**
 * The two Storytellers of a rule character's `twoStorytellers` rule (the Knaves,
 * https://wiki.bloodontheclocktower.com/Knaves): their names, which one lies (0 or 1, absent
 * until decided), and whether they have switched.
 */
export interface StorytellerPair {
	/** Empty names mean "Storyteller 1" and "Storyteller 2". */
	names?: [string, string];
	liar?: 0 | 1;
	switched?: true;
}

export type DayEntryKind = DayEntry['kind'];

/**
 * Why an ability worked abnormally, for the Mathematician
 * (https://wiki.bloodontheclocktower.com/Mathematician): the player was drunk or poisoned or
 * had no ability, a Vortox made the info false, a player registered as something else, a
 * protection stopped a death, or something else the Storyteller noted. `characterId` and
 * `seatId` name the other character responsible, when known.
 */
export type AbnormalReason =
	'drunk' | 'poisoned' | 'no-ability' | 'vortox' | 'registration' | 'protected' | 'other';

export const ABNORMAL_REASONS = [
	'drunk',
	'poisoned',
	'no-ability',
	'vortox',
	'registration',
	'protected',
	'other'
] as const satisfies readonly AbnormalReason[];

export interface AbnormalCause {
	reason: AbnormalReason;
	characterId?: CharacterId;
	seatId?: SeatId;
}

/** The day log: everything logged since the last "New day". */
export interface DayLog {
	entries: DayEntry[];
	/**
	 * Today's yes-or-no facts as the Storyteller marked them (whether the Demon voted, whether
	 * a Minion nominated: `DAY_MARKS`), for the characters that learn them at night. A fact is
	 * missing until marked. Votes themselves are not tracked.
	 */
	marks?: Partial<Record<DayMark, boolean>>;
	/**
	 * Which of two Storytellers (`Game.storytellerPair`) each player went to for their
	 * information today, by seat. Absent while none.
	 */
	visits?: Record<SeatId, 0 | 1>;
	/** When "New day" closed this log (milliseconds since the epoch); only on past days. */
	closedAt?: number;
}

/**
 * One of the Storyteller's notes on the game (Trevor, 2026-10-23: "allow for multiple notes,
 * each gets a title", as the player's notebook does), or on one player (`Seat.notes`).
 */
export interface GameNote {
	noteId: string;
	/** Empty until the Storyteller names it. */
	title: string;
	text: string;
	/** The list shows the title only; the text shows when the note is opened. */
	hidden: boolean;
}

/**
 * What a player who believes they are the Demon is shown, so it stays the same from night to
 * night (https://wiki.bloodontheclocktower.com/Lunatic: "point to any players" as Minions).
 */
export interface FakeEvilInfo {
	/** The players pointed at as their Minions. */
	minions: SeatId[];
	/** Another player they are told is the Lunatic, as a real Demon would be. */
	decoy?: SeatId;
	/** Whom that decoy "chose" last, shown as a real Lunatic's targets would be. */
	decoyChose?: SeatId[];
}

export interface Game {
	gameId: GameId;
	/** Milliseconds since the epoch. */
	createdAt: number;
	script: Script;
	seats: Record<SeatId, Seat>;
	/** Clockwise seating order. Swapping seats (the Matron) reorders this only. */
	seating: SeatId[];
	/** Fabled and Loric in play. */
	ruleCharacters: CharacterId[];
	/**
	 * Abilities the Storyteller holds, each given by a character's `givesAbility` rule (the
	 * Plague Doctor's Minion, https://wiki.bloodontheclocktower.com/Plague_Doctor), shown on
	 * the board with the Fabled and Loric (Trevor, 2026-10-30). At most one per giver.
	 * Absent while none.
	 */
	storytellerAbilities?: HeldAbility[];
	/**
	 * The players reborn as Travellers after dying, in the order they died (the Hindu's first
	 * four, https://wiki.bloodontheclocktower.com/Hindu). Absent while none.
	 */
	reincarnated?: SeatId[];
	/**
	 * The characters whose optional rule from their wiki page this game plays with, chosen at
	 * the start (Trevor, 2026-10-30): their rules are `rulesIn`. Absent while none.
	 */
	optionalRules?: CharacterId[];
	/**
	 * Reminders held by a Fabled or Loric in play, by its id (Trevor, 2026-10-17). Optional,
	 * so older saved games read as before; removing the character takes its reminders away.
	 */
	ruleReminders?: Record<CharacterId, ReminderInstance[]>;
	/**
	 * Reminders on the board that belong to no seat (Trevor, 2026-10-17: a reminder put down
	 * anywhere "would not be assigned to a character, because we wouldn't be able to tell who
	 * had it"). Where each one sits is the device's own; optional, so older games read as before.
	 */
	looseReminders?: ReminderInstance[];
	/** The bank's reusable ∞ tokens (plan B9), in the order made; absent until one is made. */
	genericTokens?: GenericToken[];
	/** Demon bluffs; more than one set when more than one player gets bluffs. */
	bluffs: CharacterId[][];
	/**
	 * Names the Storyteller gave bluff sets, by position (Trevor, 2026-10-17); an empty or
	 * missing name means the set's default. Optional, so older saved games read as before.
	 */
	bluffNames?: string[];
	/**
	 * The world the Storyteller shows a player who believes they are the Demon (the Lunatic),
	 * by that player's seat (Trevor, 2026-10-29). Private: never in the public projection.
	 * Optional, so older saved games read as before.
	 */
	fakeEvilInfo?: Record<SeatId, FakeEvilInfo>;
	bag?: Bag;
	/** The Storyteller's changes to the night order, applied in this order. */
	nightOrderOverrides: NightStepOverride[];
	/** The Storyteller's changes to the pre-day reminders, applied in this order. */
	dayReminderOverrides: DayReminderOverride[];
	/**
	 * Values the Storyteller chose during prep, by `prepValueKey` ("yaggababble.phrase").
	 * Private: never in the public projection. Absent until one is set.
	 */
	prepValues?: Record<string, string>;
	/**
	 * The Storyteller's titled notes on the game as a whole (Trevor, 2026-10-19; several since
	 * 2026-10-23, like a player's notebook), beside each seat's own notes, oldest first.
	 * Private: never in the public projection. Absent until one is written.
	 */
	notes?: GameNote[];
	/** The current day log, since the last "New day". */
	today: DayLog;
	/** Earlier day logs, oldest first, closed by "New day". */
	pastDays: DayLog[];
	/**
	 * Who runs the game, shown to players (Trevor, 2026-10-19). Optional: absent when the
	 * Storyteller gave none, and in games saved before version 10.
	 */
	storytellerName?: string;
	/** The two Storytellers, while a `twoStorytellers` rule character is set up. Absent until set. */
	storytellerPair?: StorytellerPair;
}
