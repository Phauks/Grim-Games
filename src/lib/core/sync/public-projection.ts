/**
 * Live sync (04-architecture.md §8.2): what player devices may see, and the port that
 * publishes it.
 *
 * The public projection is built field by field from an allow-list, never by copying
 * the game and deleting secrets, so a new private field cannot leak by default.
 */
import {
	REGISTERS_AS_DEAD_REMINDERS,
	seatsInOrder,
	type Game,
	type Seat,
	type SeatId
} from '#lib/core/model/index.ts';
import type { CharacterId, PlayerName } from '#lib/core/data/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { publicVotesWithoutToken } from '#lib/core/rules/voting.ts';
import {
	parsePlayersPhase,
	type GamePhase,
	type PlayersPhase
} from '#lib/core/rules/game-phase.ts';
import { parsePublicTimer, type PublicDayTimer } from '#lib/core/rules/day-timer.ts';
import type { AvatarId } from '#lib/core/avatars/index.ts';
import type { FrameId } from '#lib/core/frames/index.ts';
import { isImageHash } from './room-images.ts';

export interface PublicSeat {
	seatId: SeatId;
	/** 1-based, clockwise. */
	seatNumber: number;
	playerName?: PlayerName;
	/**
	 * Dead as the town sees it: also true for a Zombuul after its first death, which
	 * looks like a death to everyone. Storyteller overrides are private and ignored.
	 */
	dead: boolean;
	/**
	 * A dead player's ghost vote, spent in front of everyone (Trevor, 2026-10-19: the players'
	 * Grim shows "who has dead votes"). Only on seats that show as dead.
	 */
	ghostVote?: 'unused' | 'used';
	/**
	 * Dead, but voting this many times on each nomination with no ghost vote to spend, as the
	 * town learned (the Banshee killed by the Demon, `publicVotesWithoutToken`). Set in place of
	 * `ghostVote`.
	 */
	votes?: number;
	/**
	 * A Traveller's character: Travellers tell the town who they are
	 * (https://wiki.bloodontheclocktower.com/Travellers), so the players' script can show it
	 * in play (Trevor, 2026-10-19). Never set for any other character, nor when the game's
	 * mode keeps Travellers secret (Stowed Away).
	 */
	traveller?: CharacterId;
	/** The avatar and frame the seat's player picked on their phone (plan R6): theirs to show. */
	avatar?: AvatarId;
	frame?: FrameId;
}

/**
 * Today's public events. Nominations and executions happen in front of everyone, so the
 * town may see them; the day log's other entries stay private: ability uses (a "No
 * Ability" token, or a use logged for a player who is not really that character), notes,
 * night info and the Flowergirl's "Demon voted" mark all reveal characters. Whether an
 * execution killed the player is not repeated here: `dead` on the seat already shows it.
 */
export interface PublicDay {
	/** In the order they were made. */
	nominations: { nominator: SeatId; nominee: SeatId }[];
	executions: SeatId[];
}

/**
 * Where the Storyteller's board draws the seats (plan J13): its ring's shape, the gaps, and
 * the seats placed by hand, by seat id, as percentages of the board. Where people sit is
 * plain to the whole table, so phones draw the town the same way. Phones parse it before
 * use (parseSeatLayout), as they would a saved layout.
 */
export interface PublicSeatLayout {
	shape: string;
	gaps: Readonly<Record<string, number>>;
	placed: Readonly<Record<string, { x: number; y: number }>>;
}

/** The night or day in play, or Setup before the first night begins (gamePhase). */
export type PublicPhase = GamePhase;

/**
 * The board's lower left corner as the Storyteller shows it (Trevor, 2026-10-24: the player
 * grim shows "the same information in the bottom left"), so a phone's corner says what the
 * board's does. Each line is here only while the board shows it; the table can read all of
 * them off the Storyteller's board anyway.
 */
export interface PublicCorner {
	/** The game's mode, if it isn't Standard, then each special rule, by name. */
	modes: string[];
	/** The join code's line: each phone shows the code it joined with. */
	joinCode?: boolean;
	phase?: PublicPhase;
	/** Game time: since the first night began, until End game; Setup until it has begun. */
	gameTime?: { begun: boolean; startedAt?: number; endedAt?: number };
	/** Spectators on the view-only link. */
	watchers?: number;
	/** False when the board hides the author's or Storyteller's line (a build before had both). */
	author?: false;
	storyteller?: false;
	/** The script's version and the player count with its split by type, when shown. */
	version?: string;
	players?: string;
}

/**
 * The board's background as the Storyteller shows it (Trevor, 2026-10-26: "even if player
 * changes settings for their theme, the background for the shared grim should be the
 * same"), so every phone, Public Town and Grim view draws the town on the same background.
 * Font sizes stay each device's own, for accessibility.
 */
export interface PublicLook {
	/** `script` for the script's own image, `image` for a picture, or a built-in background's id. */
	background?: string;
	/** The picture the room holds (core/sync/room-images.ts), by its hash, with `image`. */
	image?: string;
	/** How dark the vignette is, 0 to 1, while it is on. */
	vignette?: number;
	/** How visible the script's logo is, 0 to 1, while it is shown. */
	logo?: number;
}

/** Longest background id a look carries: a word, never a link or a picture. */
const MAX_BACKGROUND_ID = 32;

const share = (value: unknown) =>
	typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : undefined;

/**
 * A look as sent by another device, field by field: anything malformed is left out, so a
 * phone draws no background rather than something the Storyteller never chose.
 */
export function parsePublicLook(raw: unknown): PublicLook | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const { background, image, vignette, logo } = raw as Record<string, unknown>;
	const look: PublicLook = {};
	if (
		typeof background === 'string' &&
		background.length <= MAX_BACKGROUND_ID &&
		/^[a-z][a-z0-9-]*$/.test(background)
	)
		look.background = background;
	if (isImageHash(image)) look.image = image;
	const dark = share(vignette);
	if (dark !== undefined) look.vignette = dark;
	const faint = share(logo);
	if (faint !== undefined) look.logo = faint;
	return look;
}

/**
 * The game mode, unless Standard, then each special rule, with the words its About shows: the
 * table plays by them, so every copy of the script lists them (Trevor, 2026-10-24).
 */
export interface PublicRule {
	id: string;
	name: string;
	text?: string;
}

export interface PublicGameState {
	/** The Storyteller's name, when the game has one: the table already knows who runs it. */
	storytellerName?: string;
	/** In clockwise seating order. */
	seats: PublicSeat[];
	today: PublicDay;
	/** Left out while the board draws its seats on the plain ring. */
	layout?: PublicSeatLayout;
	/** Left out until the Storyteller's board is open. */
	corner?: PublicCorner;
	/** Left out for a Standard game with no special rules. */
	rules?: PublicRule[];
	/**
	 * The Fabled and Loric in play, which are announced to the town, so a phone can show their
	 * setup change (the Sentinel's ±1 Outsider) in the Players counts (Trevor, 2026-10-27).
	 * Left out when there are none.
	 */
	ruleCharacters?: CharacterId[];
	/**
	 * The day timer, as the Storyteller chose to show it on players' phones (Trevor,
	 * 2026-10-26); left out when the Storyteller keeps it to themself.
	 */
	timer?: PublicDayTimer;
	/**
	 * Setup, the night, the day or Town, for the status line on players' phones (Trevor,
	 * 2026-10-26); left out when the board shows no game in play.
	 */
	now?: PlayersPhase;
	/** Left out until the Storyteller's board is open. */
	look?: PublicLook;
}

/** The corner's lines only, field by field, like everything else here. */
function boardCorner(corner: PublicCorner): PublicCorner {
	const { modes, joinCode, phase, gameTime, watchers, author, storyteller, version, players } =
		corner;
	const view: PublicCorner = { modes: modes.map(String) };
	if (joinCode) view.joinCode = true;
	if (phase)
		view.phase =
			phase.kind === 'setup' ? { kind: 'setup' } : { kind: phase.kind, number: phase.number };
	if (gameTime)
		view.gameTime = {
			begun: !!gameTime.begun,
			...(gameTime.startedAt !== undefined ? { startedAt: gameTime.startedAt } : {}),
			...(gameTime.endedAt !== undefined ? { endedAt: gameTime.endedAt } : {})
		};
	if (watchers) view.watchers = watchers;
	if (author === false) view.author = false;
	if (storyteller === false) view.storyteller = false;
	if (version) view.version = String(version);
	if (players) view.players = String(players);
	return view;
}

/** The layout's three parts only, or nothing when it is the plain oval ring. */
function boardLayout(layout: PublicSeatLayout): PublicSeatLayout | undefined {
	const { shape, gaps, placed } = layout;
	if (shape === 'oval' && Object.keys(gaps).length === 0 && Object.keys(placed).length === 0)
		return undefined;
	return {
		shape,
		gaps: { ...gaps },
		placed: Object.fromEntries(Object.entries(placed).map(([id, p]) => [id, { x: p.x, y: p.y }]))
	};
}

function appearsDead(seat: Seat): boolean {
	return (
		seat.dead ||
		seat.reminders.some((r) =>
			REGISTERS_AS_DEAD_REMINDERS.some(
				(d) => d.characterId === r.characterId && d.label === r.label
			)
		)
	);
}

/**
 * @param publicTraveller Whether a character is a Traveller the town knows about: the
 *   caller knows the character types and the game's mode. Left out, no character is shown.
 * @param layout Where the board draws the seats, kept on the Storyteller's device.
 * @param corner What the board's corner shows now, from the Storyteller's board.
 * @param characters The game's characters, for what the town learns of a death (`votes`).
 * @param rules The game mode and special rules, kept by the game modes feature.
 * @param timer The day timer and how players see it, or nothing when they don't.
 * @param now Where the game is up to, for the players' status line.
 * @param look The board's background, vignette and logo, from the Storyteller's board.
 */
export function publicProjection(
	game: Game,
	publicTraveller?: (characterId: CharacterId) => boolean,
	layout?: PublicSeatLayout,
	corner?: PublicCorner,
	characters?: CharacterLookup,
	rules: readonly PublicRule[] = [],
	timer?: PublicDayTimer,
	now?: PlayersPhase,
	look?: PublicLook
): PublicGameState {
	const drawn = layout && boardLayout(layout);
	// Field by field, so nothing else rides along with it.
	const clock = parsePublicTimer(timer);
	const phase = parsePlayersPhase(now);
	return {
		...(game.storytellerName ? { storytellerName: game.storytellerName } : {}),
		...(drawn ? { layout: drawn } : {}),
		...(corner ? { corner: boardCorner(corner) } : {}),
		...(rules.length ? { rules: rules.map((r) => ({ ...r })) } : {}),
		...(game.ruleCharacters.length ? { ruleCharacters: [...game.ruleCharacters] } : {}),
		...(clock ? { timer: clock } : {}),
		...(phase ? { now: phase } : {}),
		...(look ? { look: parsePublicLook(look) } : {}),
		seats: seatsInOrder(game).map((seat, i) => {
			const view: PublicSeat = {
				seatId: seat.seatId,
				seatNumber: i + 1,
				dead: appearsDead(seat)
			};
			if (seat.playerName !== undefined) view.playerName = seat.playerName;
			if (seat.avatar !== undefined) view.avatar = seat.avatar;
			if (seat.frame !== undefined) view.frame = seat.frame;
			// Every seat that looks dead shows a vote the same way, so a Zombuul looks no different.
			const votes =
				view.dead && characters
					? publicVotesWithoutToken(game, seat.seatId, characters)
					: undefined;
			if (votes !== undefined) view.votes = votes;
			else if (view.dead) view.ghostVote = seat.ghostVoteUsed ? 'used' : 'unused';
			if (seat.characterId && publicTraveller?.(seat.characterId))
				view.traveller = seat.characterId;
			return view;
		}),
		today: {
			nominations: game.today.entries.flatMap((e) =>
				e.kind === 'nomination' ? [{ nominator: e.nominator, nominee: e.nominee }] : []
			),
			executions: game.today.entries.flatMap((e) => (e.kind === 'execution' ? [e.seatId] : []))
		}
	};
}

/**
 * Publishes public state to other devices. Only `PublicGameState` ever crosses this
 * port, so a provider cannot send the grimoire even by mistake.
 */
export interface SyncProvider {
	publish(state: PublicGameState): Promise<void>;
	close(): Promise<void>;
}

/** The provider used until live sync ships: publishes nothing. */
export class NoopSyncProvider implements SyncProvider {
	async publish(state: PublicGameState): Promise<void> {
		void state;
	}
	async close(): Promise<void> {}
}
