/**
 * Players' messages to the Storyteller (Trevor, 2026-10-27: "Unilateral messaging to
 * storyteller. Combine into a communication menu where notifications from players about bad
 * images also goes."). One way only: a phone sends, the Storyteller reads, and nothing comes
 * back. A phone never sees its own message again once sent ("Players cannot see message once
 * sent. Don't want ppl to use info to confirm things"), so the player view carries none. The
 * room keeps them for the current game only; a new game starts with an empty inbox.
 */
import { parsePlayersPhase, type PlayersPhase } from '#lib/core/rules/game-phase.ts';
import type { RoomState } from './room.ts';

/**
 * A safety cap only, never shown (Trevor, 2026-10-28: "There is no need for character limit
 * on messages"): long enough for any message, short enough that one can't swell the room.
 */
export const MAX_MESSAGE_LENGTH = 2000;
/**
 * All of a game's messages together stay under this, so the room's saved state and its
 * update to the Storyteller stay well inside the Worker's limits (Durable Object values and
 * WebSocket messages); a message past it is dropped.
 */
export const MAX_ROOM_MESSAGE_CHARS = 200_000;
/** A phone sends at most this many messages a game, so one phone can't flood the inbox. */
export const MAX_MESSAGES_PER_MEMBER = 30;
/** A second message from one phone sooner than this after its last is dropped. */
export const MESSAGE_GAP_MS = 2000;

/** One message from a player's phone, as the room keeps it and the Storyteller sees it. */
export interface PlayerMessage {
	id: string;
	memberId: string;
	text: string;
	/** Milliseconds since the epoch, the room's clock. */
	at: number;
	/** When in the game it was sent, as phones are told (`PublicGameState.now`). */
	phase?: PlayersPhase;
	/** The Storyteller has opened it. */
	read?: true;
	/** The player asks the Storyteller for a word in private (Trevor, 2026-10-27: "add a checkmark to request a storyteller consult"). */
	consult?: true;
}

/** A message's text, trimmed and cut to length; `null` when there is nothing to send. */
export function cleanMessage(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	// Control characters other than line breaks are dropped; runs of blank lines are shortened.
	// eslint-disable-next-line no-control-regex
	const text = raw.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n');
	const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH).trim();
	return trimmed || null;
}

/**
 * A member's message to the Storyteller. Ignored when the member isn't in the room, the
 * Storyteller's app can't show it (`inbox`), it has no text and asks for no consult, or the
 * phone has sent too many or too fast. `id` is made by the room.
 */
export function sendMessage(
	room: RoomState,
	memberId: string,
	raw: unknown,
	at: number,
	id: string,
	consult?: unknown
): RoomState {
	if (!room.inbox || !room.members.some((m) => m.memberId === memberId)) return room;
	const text = cleanMessage(raw) ?? '';
	if (!text && consult !== true) return room;
	const all = room.messages ?? [];
	const mine = all.filter((m) => m.memberId === memberId);
	if (mine.length >= MAX_MESSAGES_PER_MEMBER) return room;
	const used = all.reduce((sum, m) => sum + m.text.length, 0);
	if (used + text.length > MAX_ROOM_MESSAGE_CHARS) return room;
	const last = mine.at(-1);
	if (last && at - last.at < MESSAGE_GAP_MS) return room;
	const message: PlayerMessage = { id, memberId, text, at };
	if (consult === true) message.consult = true;
	const phase = parsePlayersPhase(room.public?.now);
	if (phase) message.phase = phase;
	return { ...room, messages: [...all, message] };
}

/**
 * The Storyteller opened these messages, or with `read` false marked them unread again
 * (Trevor, 2026-10-28: "mark as unread, and only marked as read when entered"). Unknown ids
 * are ignored.
 */
export function readMessages(room: RoomState, ids: unknown, read = true): RoomState {
	if (!Array.isArray(ids) || !room.messages) return room;
	const chosen = new Set(ids.filter((i): i is string => typeof i === 'string'));
	const change = (m: PlayerMessage) => chosen.has(m.id) && !!m.read !== read;
	if (!room.messages.some(change)) return room;
	return {
		...room,
		messages: room.messages.map((m) => {
			if (!change(m)) return m;
			if (read) return { ...m, read: true };
			const { read: _read, ...unread } = m;
			void _read;
			return unread;
		})
	};
}

/**
 * Whether the Storyteller's app shows messages, from its hello: phones offer to send one only
 * then, so a message never goes to an app that would drop it unread.
 */
export function setInbox(room: RoomState, on: unknown): RoomState {
	if (on === true) return room.inbox ? room : { ...room, inbox: true };
	if (!room.inbox) return room;
	const { inbox: _off, ...rest } = room;
	void _off;
	return rest;
}

/** A new game: the last game's messages go with it. */
export function withoutMessages(room: RoomState): RoomState {
	if (!room.messages) return room;
	const { messages: _messages, ...rest } = room;
	void _messages;
	return rest;
}
