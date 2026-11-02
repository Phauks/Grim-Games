/**
 * Commands: everything the Storyteller can do to a game (04-architecture.md §3). A
 * command is checked against the current game and turned into events; it never changes
 * state itself.
 */
import type { Alignment, CharacterId, Script, PlayerName } from '#lib/core/data/index.ts';
import type { DayMark } from '#lib/core/data/day-mark-rules.ts';
import type { DayReminderOverride, NightStepOverride } from '#lib/core/rules/index.ts';
import type { AvatarId } from '#lib/core/avatars/index.ts';
import type { FrameId } from '#lib/core/frames/index.ts';
import type {
	AbnormalCause,
	CharacterGuess,
	DayEntryId,
	GuessAnswer,
	DeathCause,
	FakeEvilInfo,
	GenericLook,
	OverrideField,
	Reminder,
	ReminderId,
	SeatId,
	SeatOverride,
	SymbolColour,
	TileId
} from '#lib/core/model/index.ts';

/** A tile to put in the bag (see `Tile`). */
export interface TileSpec {
	shows: CharacterId;
	grimoire: CharacterId;
	reminders?: Reminder[];
}

export type Command =
	| {
			type: 'CreateGame';
			script: Script;
			playerCount: number;
			/** Fabled and Loric in play from the start; the script's own when absent. */
			ruleCharacters?: CharacterId[];
			/** Who runs the game (Trevor, 2026-10-19); empty or missing means none. */
			storytellerName?: string;
	  }
	/**
	 * Replaces the script mid-game (08-script-loading.md §5.6). Seats, reminders, bluffs and
	 * the bag keep their characters; any that are not on the new script are only warned about.
	 */
	| { type: 'ChangeScript'; script: Script }
	/** `position` is the 0-based place in the seating order; the default is the end. */
	| { type: 'AddSeat'; playerName?: PlayerName; position?: number; notInPlay?: true }
	/** Puts seats in play, or takes them out (`Seat.notInPlay`), as one change. */
	| { type: 'SetInPlay'; seatIds: SeatId[]; inPlay: boolean }
	| { type: 'RemoveSeat'; seatId: SeatId }
	/** An empty or missing name clears it. */
	| { type: 'RenameSeat'; seatId: SeatId; playerName?: PlayerName }
	/** The Storyteller's name, shown to players; an empty or missing name clears it. */
	| { type: 'SetStorytellerName'; name?: string }
	/**
	 * Writes one of the Storyteller's private notes on a seat, trimmed, as `SetGameNote` does:
	 * no `noteId` adds a new one (nothing when it is blank).
	 */
	| {
			type: 'SetSeatNote';
			seatId: SeatId;
			noteId?: string;
			title: string;
			text: string;
			hidden: boolean;
	  }
	| { type: 'DeleteSeatNote'; seatId: SeatId; noteId: string }
	/**
	 * The avatar and frame the seat's player picked on their phone (plan R6, L4); a missing one
	 * clears it. Sent by the live room, never typed by the Storyteller.
	 */
	| { type: 'SetSeatLook'; seatId: SeatId; avatar?: AvatarId; frame?: FrameId }
	/**
	 * Writes one of the game's notes, trimmed; no `noteId` adds a new one (nothing when it is
	 * blank).
	 */
	| { type: 'SetGameNote'; noteId?: string; title: string; text: string; hidden: boolean }
	| { type: 'DeleteGameNote'; noteId: string }
	/**
	 * Puts a character token on a seat. Without `alignment`, an empty seat takes the
	 * default for the character type and a seat that had a character keeps its alignment
	 * (a character change does not change alignment). A Traveller needs `alignment`
	 * unless the seat already has one.
	 */
	| { type: 'AssignCharacter'; seatId: SeatId; characterId: CharacterId; alignment?: Alignment }
	| { type: 'ClearCharacter'; seatId: SeatId }
	/**
	 * Two players swap characters and alignments (the Snake Charmer choosing the Demon,
	 * https://wiki.bloodontheclocktower.com/Snake_Charmer), or only characters with
	 * `keepAlignments` (the Barber's haircuts, https://wiki.bloodontheclocktower.com/Barber).
	 */
	| { type: 'SwapCharacters'; seatId: SeatId; withSeatId: SeatId; keepAlignments?: true }
	| { type: 'SetAlignment'; seatId: SeatId; alignment: Alignment }
	/**
	 * Gives a player the ability of `characterId` by `via`'s `givesAbility` rule, replacing any
	 * `via` gave them before (the Boffin's good ability on the Demon); without `characterId`
	 * it takes that ability away.
	 */
	| { type: 'SetHeldAbility'; seatId: SeatId; via: CharacterId; characterId?: CharacterId }
	/**
	 * Gives the Storyteller the ability of `characterId` by `via`'s `givesAbility` rule (the
	 * Plague Doctor's Minion), replacing any `via` gave before; without it, takes it away.
	 */
	| { type: 'SetStorytellerAbility'; via: CharacterId; characterId?: CharacterId }
	/**
	 * A dead player is reborn as the Traveller `characterId`, alive, keeping their alignment
	 * (the Hindu's first four deaths, https://wiki.bloodontheclocktower.com/Hindu).
	 */
	| { type: 'Reincarnate'; seatId: SeatId; characterId: CharacterId }
	/** Turns a character's optional rule on or off for this game (`Game.optionalRules`). */
	| { type: 'SetOptionalRule'; characterId: CharacterId; on: boolean }
	/**
	 * Marks a player dead or alive. `cause` is optional when marking dead (the Storyteller
	 * can skip it and set it later with `SetDeathCause`); on an already dead player it sets
	 * the cause. Coming back to life clears the cause.
	 */
	/**
	 * Marks a player dead or alive. A death should name its `cause` (Trevor, 2026-10-16:
	 * every death has one); without it the engine warns `no-cause`. Executions and exiles
	 * use `Execute` and `Exile`, which log the day entry too.
	 */
	| { type: 'SetDead'; seatId: SeatId; dead: boolean; cause?: DeathCause }
	/** Records how a dead player died; an undefined `cause` clears it. */
	| { type: 'SetDeathCause'; seatId: SeatId; cause?: DeathCause }
	| { type: 'SpendGhostVote'; seatId: SeatId }
	| { type: 'RestoreGhostVote'; seatId: SeatId }
	/** `tokenId`: copied from one of the bank's ∞ tokens, so it starts with that token's look. */
	| { type: 'AddReminder'; seatId: SeatId; reminder: Reminder; tokenId?: string }
	| { type: 'MoveReminder'; reminderId: ReminderId; toSeatId: SeatId }
	| { type: 'RemoveReminder'; reminderId: ReminderId }
	/**
	 * A reminder on a Fabled or Loric in play (Trevor, 2026-10-17). Any reminder may go there;
	 * one that is not a Fabled's or Loric's own is allowed with a warning.
	 */
	| { type: 'AddRuleReminder'; characterId: CharacterId; reminder: Reminder; tokenId?: string }
	/** Moves a reminder from a seat or a rule character onto a Fabled or Loric in play. */
	| { type: 'MoveReminderToRuleCharacter'; reminderId: ReminderId; characterId: CharacterId }
	/**
	 * A reminder on the board that belongs to no seat (Trevor, 2026-10-17). `MoveReminder`
	 * and `MoveReminderToRuleCharacter` give it a holder again; `RemoveReminder` takes it away.
	 */
	| { type: 'PlaceLooseReminder'; reminder: Reminder; tokenId?: string }
	/** Takes a reminder off its seat or Fabled or Loric and leaves it loose on the board. */
	| { type: 'LoosenReminder'; reminderId: ReminderId }
	/** The Storyteller's text on a reminder; empty clears it. */
	| { type: 'SetReminderNote'; reminderId: ReminderId; note?: string }
	/** The generic reminder's middle symbol; none, or blank, clears it. */
	| { type: 'SetReminderSymbol'; reminderId: ReminderId; symbol?: string }
	/** The colour of the generic reminder's symbol; none clears it. */
	| { type: 'SetReminderSymbolColour'; reminderId: ReminderId; colour?: SymbolColour }
	/** The generic reminder's icon symbol filled or as an outline. */
	| { type: 'SetReminderSymbolFill'; reminderId: ReminderId; fill: boolean }
	/** A new reusable ∞ token at the end of the bank's ones (plan B9). */
	| { type: 'AddGenericToken'; look?: GenericLook }
	/** Replaces a bank ∞ token's look; the copies already placed keep theirs. */
	| { type: 'SetGenericToken'; tokenId: string; look: GenericLook }
	| { type: 'RemoveGenericToken'; tokenId: string }
	/**
	 * Places several reminders at once, such as the suggested setup reminders
	 * (`setupReminders`, `placeableSetupReminders`). Each becomes a normal reminder that can
	 * be moved or removed; undo takes them all back in one step.
	 */
	| { type: 'ApplySetupReminders'; placements: { seatId: SeatId; reminder: Reminder }[] }
	/** Swaps two players' places in the seating order (the Matron). */
	| { type: 'SwapSeats'; seatA: SeatId; seatB: SeatId }
	/**
	 * Every player moves one place round the seating order, keeping their character,
	 * reminders and state. Clockwise is the seating order: the player in seat 1 goes to seat 2
	 * and the last player to seat 1.
	 */
	| { type: 'RotateSeats'; direction: 'clockwise' | 'anticlockwise' }
	/** Moves a player to `position` (0-based) in the seating order; the others close up. */
	| { type: 'MoveSeat'; seatId: SeatId; position: number }
	/**
	 * Count off (plan J40): the whole table in its new order, seat 1 first, as the players
	 * counted round the clock. An entry with no seat is a new one; a name renames its seat.
	 * Every seat now at the table is listed once.
	 */
	| { type: 'CountOff'; seats: { seatId?: SeatId; playerName?: PlayerName }[] }
	| { type: 'SetOverride'; seatId: SeatId; override: SeatOverride }
	| { type: 'ClearOverride'; seatId: SeatId; field: OverrideField }
	/**
	 * The Storyteller's night-order overrides, kept in the order they apply. `index` is the
	 * 0-based place in `Game.nightOrderOverrides`; `Add` appends unless `index` is given.
	 */
	| { type: 'AddNightStepOverride'; override: NightStepOverride; index?: number }
	| { type: 'ReplaceNightStepOverride'; index: number; override: NightStepOverride }
	| { type: 'RemoveNightStepOverride'; index: number }
	/** The same for the pre-day reminders (`Game.dayReminderOverrides`). */
	| { type: 'AddDayReminderOverride'; override: DayReminderOverride; index?: number }
	| { type: 'ReplaceDayReminderOverride'; index: number; override: DayReminderOverride }
	| { type: 'RemoveDayReminderOverride'; index: number }
	/** Fabled and Loric only. */
	| { type: 'AddRuleCharacter'; characterId: CharacterId }
	| { type: 'RemoveRuleCharacter'; characterId: CharacterId }
	/** Replaces bluff set `set` (0-based); `set` equal to the number of sets adds one. */
	| { type: 'SetBluffs'; set: number; characterIds: CharacterId[] }
	| { type: 'RemoveBluffSet'; set: number }
	/** Names a bluff set after the Demon's; an empty name brings back its default. */
	| { type: 'RenameBluffSet'; set: number; name: string }
	/**
	 * Replaces what a player who believes they are the Demon (the Lunatic) is shown: their
	 * fake Minions, a decoy Lunatic and the decoy's picks. An empty one clears it.
	 */
	| { type: 'SetFakeEvilInfo'; seatId: SeatId; info: FakeEvilInfo }
	/** Replaces the bag. Tiles are shuffled unless `shuffle` is false. */
	| {
			type: 'BuildBag';
			tiles: TileSpec[];
			includeTravellers: boolean;
			shuffle?: boolean;
			/** "Is The …" reminders for characters in play with no tile (Drunk, Marionette). */
			unseated?: Reminder[];
	  }
	| { type: 'ClearBag' }
	/** A player takes a tile: `tileId` when they picked one, otherwise the next in order. */
	| { type: 'DrawTile'; seatId: SeatId; tileId?: TileId }
	/**
	 * The player has seen their tile: its grimoire character and reminders go on their
	 * seat. A Traveller tile needs `alignment`.
	 */
	| { type: 'ConfirmDraw'; tileId: TileId; alignment?: Alignment }
	/** The player puts the tile back; it returns to a random place in the bag. */
	| { type: 'CancelDraw'; tileId: TileId }
	/**
	 * One more player joins mid-draw instead of as a Traveller (the fair late seat, Trevor,
	 * 2026-10-30): a seat for them, new characters for the drawn players in `changes`, and
	 * the tiles still in the bag become `bag`. Each changed player who has confirmed a draw
	 * is woken first on the first night and shown their new character.
	 */
	| {
			type: 'AddLatePlayer';
			/**
			 * One or more late players (Trevor, 2026-10-30), each where the Storyteller placed
			 * them: `position` is in the seating as it was before any of them joined.
			 */
			players: { playerName?: PlayerName; position?: number }[];
			changes: { seatId: SeatId; characterId: CharacterId }[];
			bag: TileSpec[];
	  }
	// ── The day log (`Game.today`). Every entry can be removed or edited: an override. ──
	/** Logs a nomination: who nominated whom. Votes are not tracked. */
	| { type: 'Nominate'; nominator: SeatId; nominee: SeatId }
	/** Changes who nominated whom in a logged nomination. */
	| { type: 'EditNomination'; entryId: DayEntryId; nominator: SeatId; nominee: SeatId }
	/**
	 * Records the player a nominee chose in a logged nomination (the Big Wig's speaker);
	 * undefined clears it.
	 */
	| { type: 'ChooseForNomination'; entryId: DayEntryId; chosen?: SeatId }
	/**
	 * Marks one of today's yes-or-no facts (whether the Demon voted, for the Flowergirl), and
	 * swaps the tokens of each character in play that shows it (`dayMark`); undefined clears it.
	 */
	| { type: 'SetDayMark'; mark: DayMark; value?: boolean }
	/**
	 * Stores a value the Storyteller chose during prep (the Yaggababble's secret phrase) as
	 * `Game.prepValues[key]`, `key` from `prepValueKey`; no `value` or an empty one clears it.
	 */
	| { type: 'SetPrepValue'; key: string; value?: string }
	/**
	 * Executes a player. A living player whom the grimoire says cannot die to an execution
	 * (the Devil's Advocate, the Tea Lady, the Sailor, a "can't die" override) is logged as
	 * executed and alive, unless `dies` says the Storyteller ruled otherwise. `savedBy` is the
	 * character the Storyteller says saved them (the Execution sheet's Saved by, such as the
	 * Pacifist's "might not die"), applied even when the grimoire disagrees, with a warning.
	 * `cause` is the character whose ability executed them (the Virgin's), recorded as the cause
	 * of death instead of a plain execution.
	 */
	| { type: 'Execute'; seatId: SeatId; dies?: boolean; savedBy?: CharacterId; cause?: CharacterId }
	/**
	 * Logs a Traveller's exile and marks them dead by exile, if alive. Not an execution. As
	 * with `Execute`, a player whom the grimoire says cannot die (the Tea Lady's Cannot Die) is
	 * logged as exiled and alive unless `dies`; `savedBy` is the character the Storyteller says
	 * kept them alive (the Deviant who was funny), applied even when the grimoire disagrees,
	 * with a warning.
	 */
	| { type: 'Exile'; seatId: SeatId; dies?: boolean; savedBy?: CharacterId }
	/**
	 * Logs that a character used its ability. A character with a "No Ability" reminder
	 * token gets it placed on the seat; otherwise only the use is logged. `on` is the player
	 * the use was about, when its rules ask (`dayUse`: the Slayer's choice, the Virgin's
	 * nominator).
	 */
	| { type: 'UseAbility'; seatId: SeatId; characterId: CharacterId; on?: SeatId }
	/**
	 * A free-text note about a character (any length; may be empty with `guesses`). `holds`
	 * marks a statement true or false (L58); `answer` answers a guess at the player's own
	 * ability (the Amnesiac's), or `customAnswer` in the Storyteller's own words.
	 */
	| {
			type: 'DayNote';
			characterId: CharacterId;
			seatId?: SeatId;
			text: string;
			guesses?: CharacterGuess[];
			holds?: boolean;
			answer?: GuessAnswer;
			customAnswer?: string;
	  }
	/** Replaces a note's text, guesses, truth and answer (leaving one out clears it). */
	| {
			type: 'EditDayNote';
			entryId: DayEntryId;
			text: string;
			guesses?: CharacterGuess[];
			holds?: boolean;
			answer?: GuessAnswer;
			customAnswer?: string;
	  }
	/**
	 * Records what a waking character was shown (`seatId` is the waking player), placing
	 * reminder tokens such as the Washerwoman's "Townsfolk" and "Wrong". A later record for
	 * the same seat and character is what the night order shows: the Storyteller's override.
	 */
	| {
			type: 'RecordNightInfo';
			seatId: SeatId;
			characterId: CharacterId;
			text: string;
			reminders?: { seatId: SeatId; reminder: Reminder }[];
			/** The info or ability worked abnormally because of these (see `abnormalCauses`). */
			abnormal?: AbnormalCause[];
	  }
	/**
	 * Removes a day-log entry and undoes what it did to the grimoire: an execution's death
	 * (if still dead by execution) and the reminder tokens an ability use or night info placed
	 * (if still there).
	 */
	| { type: 'RemoveDayEntry'; entryId: DayEntryId }
	/**
	 * Closes the day log and starts an empty one; the old one is kept as history. The
	 * Storyteller does this by hand ("New day"); opening the night order never does.
	 */
	| { type: 'NewDay' };

export type CommandType = Command['type'];
export type CommandOf<T extends CommandType> = Extract<Command, { type: T }>;
