/**
 * A player's phone in a live room (07-accounts-and-multi-device.md §4.2): it sees the
 * public table and asks the Storyteller for a name and a seat. The phone's key is its own
 * secret, kept on the device, so it is the same member when it comes back.
 */
import type { Script } from '#lib/core/data/index.ts';
import type { GameFeedback } from '#lib/core/feedback/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { buildInfo } from '#lib/build-info.ts';
import {
	isNewerBuild,
	ROOM_PROTOCOL,
	type PlayerView,
	type SharedGrimoire
} from '#lib/core/sync/room.ts';
import type { PublicRule } from '#lib/core/sync/public-projection.ts';
import { readStored, readStoredText, writeStored, writeStoredText } from '#lib/ui/stored.ts';
import { forgetRecentRoom, rememberRoom } from './recent-rooms.ts';
import { lookForNewerBuild } from './newer-build.ts';
import { randomKey, RoomSocket } from './room-socket.svelte.ts';
import { travellersInPlay, type TravellerInPlay } from '#lib/features/player/travellers-in-play.ts';
import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
import { avatarPicture } from '#lib/features/player/avatar-picture.svelte.ts';
import { putRoomImage } from './room-images.ts';
import { dealtSeats } from '#lib/features/modes/players-line.ts';
import { hearCallTown, unlockOnFirstTap } from '#lib/features/sound/sound.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';

const STORAGE_KEY = 'grim-games-room-player';

function deviceKey(): string {
	const stored = readStored<{ key: string }>(STORAGE_KEY);
	if (stored?.key) return stored.key;
	const key = randomKey();
	writeStored(STORAGE_KEY, { key });
	return key;
}

/** The last name this phone asked for, to fill the field next time. */
const NAME_KEY = 'grim-games-room-name';

/** The name this phone last gave a room, for its initials where no room says it. */
export function savedPlayerName(): string {
	return readStored<string>(NAME_KEY) ?? '';
}

/** The room this phone last joined, so /play's Room tab opens it again (Trevor, 2026-10-19). */
const LAST_ROOM_KEY = 'grim-games-room-last';

export function lastRoom(): string | undefined {
	return readStoredText(LAST_ROOM_KEY);
}

/**
 * What /play shows from the room this phone last joined (Trevor, 2026-10-19): who runs the
 * game, and the Travellers the town knows are in play. Kept on the device with the room's
 * code, and forgotten with the room.
 */
const TABLE_KEY = 'grim-games-room-table';

export interface RoomTable {
	storyteller?: string;
	travellers?: TravellerInPlay[];
	/** The game mode and special rules, for the Script tab (Trevor, 2026-10-24). */
	rules?: PublicRule[];
	/** The room's game, so notes and guesses follow the game even offline (`gameKey`). */
	gameId?: string;
	/**
	 * Seats taking characters from the bag (Travellers the town knows about left out), so the
	 * Script tab's Players breakdown shows the table's column (Trevor, 2026-10-26).
	 */
	players?: number;
	/** The Fabled and Loric in play, for their setup change in the Players counts (Trevor, 2026-10-27). */
	ruleCharacters?: string[];
}

function storedTable(code: string | undefined): RoomTable {
	const stored = readStored<RoomTable & { code: string }>(TABLE_KEY);
	if (!code || stored?.code !== code) return {};
	return {
		storyteller: stored.storyteller,
		travellers: stored.travellers,
		rules: stored.rules,
		gameId: stored.gameId,
		players: stored.players,
		ruleCharacters: stored.ruleCharacters
	};
}

/** The last room's table, while it is remembered. */
export const roomTable = $state<RoomTable>(storedTable(lastRoom()));

/**
 * Where a phone keeps what it writes for one game in room `code` (its guesses and seat notes):
 * per game, so a new game in the same room starts clean (Trevor, 2026-10-25). Before the room
 * has said which game it is, the room's code alone.
 */
export function gameKey(code: string): string {
	return code === lastRoom() && roomTable.gameId ? `${code}:${roomTable.gameId}` : code;
}

function setTable(code: string, table: RoomTable): void {
	if (JSON.stringify(table) === JSON.stringify($state.snapshot(roomTable))) return;
	roomTable.storyteller = table.storyteller;
	roomTable.travellers = table.travellers;
	roomTable.rules = table.rules;
	roomTable.gameId = table.gameId;
	roomTable.players = table.players;
	roomTable.ruleCharacters = table.ruleCharacters;
	const empty =
		!table.storyteller &&
		!table.travellers?.length &&
		!table.rules?.length &&
		!table.gameId &&
		!table.players &&
		!table.ruleCharacters?.length;
	writeStored(TABLE_KEY, empty ? undefined : { code, ...table });
}

/**
 * Stops following the last room on /play, but keeps it in Your games to join again: the phone
 * opened another script from a link or an offline code (Trevor, 2026-10-27: a scanned Fall of
 * Rome turned into the last room's Bad Moon Rising once that room reconnected).
 */
export function leaveLastRoom(): void {
	const code = lastRoom();
	if (!code) return;
	writeStoredText(LAST_ROOM_KEY, undefined);
	setTable(code, {});
}

/** Forgets the last room when it is `code` (it closed, or refused this phone). */
export function forgetRoom(code: string): void {
	forgetRecentRoom(code);
	if (lastRoom() !== code) return;
	writeStoredText(LAST_ROOM_KEY, undefined);
	setTable(code, {});
}

export class RoomPlayer {
	view = $state.raw<PlayerView>();
	/** The game's script, once the Storyteller's device has sent it. */
	script = $state.raw<Script>();
	/** The finished grimoire, once the Storyteller shares it after the game (plan R5). */
	revealed = $state.raw<{ gameId: string; grimoire: SharedGrimoire }>();
	/** Pictures this phone reported, by hash, so its menu says so (no success popup). */
	reported = $state.raw<readonly string[]>([]);
	readonly code: string;
	readonly #socket: RoomSocket;
	readonly #key = deviceKey();
	/** The look last sent, and the picture uploaded for which game, so neither repeats. */
	#lastLook: string | undefined;
	#uploaded: { game: string; image: Blob; hash: Promise<string> } | undefined;

	constructor(code: string) {
		this.code = code;
		unlockOnFirstTap();
		writeStoredText(LAST_ROOM_KEY, code);
		rememberRoom(code);
		this.#socket = new RoomSocket(
			code,
			{ type: 'hello', role: 'player', key: this.#key, protocol: ROOM_PROTOCOL },
			(m) => {
				if (m.type === 'player-view') {
					// Another player has this name: say so once, so the player can change it.
					if (m.shownAs && m.shownAs !== this.view?.shownAs && m.me.name) {
						toast(
							t('room.nameShared', { name: m.me.name }),
							t('room.nameSharedDetail', { name: m.shownAs })
						);
					}
					this.view = m;
					// The Storyteller's app is newer: offer its build (Trevor, 2026-10-26: nudge, never block).
					if (isNewerBuild(m.storytellerBuiltAt, buildInfo.builtAt)) lookForNewerBuild();
					// The game runs again, or a new one began: the finished grimoire goes.
					if (!m.ended) this.revealed = undefined;
					const storyteller = m.public?.storytellerName?.trim();
					const travellers = travellersInPlay(m.public?.seats ?? []);
					const rules = m.public?.rules;
					const players = dealtSeats(m.public?.seats ?? []).dealt;
					const ruleCharacters = m.public?.ruleCharacters;
					setTable(code, {
						...(storyteller ? { storyteller } : {}),
						...(travellers.length ? { travellers } : {}),
						...(rules?.length ? { rules } : {}),
						...(m.gameId ? { gameId: m.gameId } : {}),
						...(players ? { players } : {}),
						...(ruleCharacters?.length ? { ruleCharacters } : {})
					});
				} else if (m.type === 'script') this.script = m.script;
				else if (m.type === 'reveal') {
					this.revealed = { gameId: m.gameId, grimoire: m.grimoire };
				} else if (m.type === 'call-town') {
					hearCallTown();
					toast(t('room.callTownHeard'));
				}
			},
			() => {
				this.#lastLook = undefined;
				void this.sendLook();
			}
		);
	}

	/**
	 * Tells the room this phone's avatar, frame and picture (plan R6) when they differ from
	 * what it has: on every connect, and when the player picks again. The picture is uploaded
	 * once a game, since the room deletes one the Storyteller took away; a look the room turned
	 * down is not sent again until something in it changes.
	 */
	async sendLook(): Promise<void> {
		const { avatar, frame } = playerSettings.current;
		const picture = await this.#picture();
		const me = this.view?.me;
		if (me && me.avatar === avatar && me.frame === frame && me.picture === picture) return;
		const look = `${this.view?.gameId}|${avatar}|${frame}|${picture}`;
		if (look === this.#lastLook) return;
		const sent = this.#socket.send({
			type: 'look',
			...(avatar ? { avatar } : {}),
			...(frame ? { frame } : {}),
			...(picture ? { picture } : {})
		});
		if (sent) this.#lastLook = look;
	}

	/** This phone's picture's name in the room, uploading it first; undefined without one. */
	async #picture(): Promise<string | undefined> {
		const blob = avatarPicture.blob();
		if (!blob || !this.view) return undefined;
		const game = this.view.gameId ?? '';
		try {
			const image = await blob;
			const known = this.#uploaded;
			if (known?.game === game && known.image === image) return await known.hash;
			const hash = putRoomImage(this.code, this.#key, image);
			this.#uploaded = { game, image, hash };
			return await hash;
		} catch {
			// Offline or turned down: the initials stand in, and the next connect tries again.
			this.#uploaded = undefined;
			return undefined;
		}
	}

	/** Reports the picture on another player's seat to the Storyteller (2026-10-27). */
	reportPicture(seatId: SeatId): boolean {
		const hash = this.view?.pictures?.[seatId];
		if (!hash || !this.#socket.send({ type: 'report-picture', seatId })) return false;
		this.reported = [...this.reported, hash];
		return true;
	}

	get status() {
		return this.#socket.status;
	}

	get refusedReason() {
		return this.#socket.refusedReason;
	}

	get savedName(): string {
		return savedPlayerName();
	}

	/** Sets this phone's name in the room; the Storyteller seats it (no approval, 2026-10-26). */
	setName(name: string): boolean {
		writeStored(NAME_KEY, name);
		return this.#socket.send({ type: 'request', name });
	}

	leaveSeat(): void {
		this.#socket.send({ type: 'leave-seat' });
	}

	/** A spectator's choice in the open vote (Specters); a new choice replaces the last. */
	vote(choice: SeatId): boolean {
		const voteId = this.view?.vote?.voteId;
		return voteId ? this.#socket.send({ type: 'vote', voteId, choice }) : false;
	}

	/** This phone's ballot in the script vote (plan R1); a new one replaces the last. */
	scriptBallot(choices: string[]): boolean {
		const voteId = this.view?.scriptVote?.voteId;
		return voteId ? this.#socket.send({ type: 'script-ballot', voteId, choices }) : false;
	}

	/** Tells the Storyteller this player has seen their character (Trevor, 2026-10-26). */
	roleSeen(): void {
		this.#socket.send({ type: 'role-seen' });
	}

	/** Feedback on the game that ended (plan R4); a new one replaces the last. */
	sendFeedback(feedback: GameFeedback): boolean {
		const gameId = this.view?.endedGameId;
		return gameId ? this.#socket.send({ type: 'feedback', gameId, feedback }) : false;
	}

	/**
	 * A message to the Storyteller (Trevor, 2026-10-27), only while their app takes them. It
	 * is not kept anywhere on this phone: once sent, the player can't see it again.
	 */
	sendMessage(text: string): boolean {
		if (!this.view?.inbox || !text.trim()) return false;
		return this.#socket.send({ type: 'message', text });
	}

	stop(): void {
		this.#socket.stop();
	}
}
