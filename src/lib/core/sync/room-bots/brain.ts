/**
 * What a test room's fake phone sends (features/test-room): the same messages a player's phone
 * sends (`ClientMessage` in room-protocol.ts), chosen the way a player at the table would. Each
 * action is one tap a player makes, for the Test room's fast tools; `replies` makes them all on
 * their own as the view asks, for bots left to play by themselves. Pure, so the choices are
 * tested; the bot that sends them is features/test-room/phone-bot.ts.
 */
import { ACCOLADES } from '#lib/core/feedback/feedback.ts';
import type { ClientMessage, PlayerView } from '#lib/core/sync/room-protocol.ts';

/** The taps a fast tool makes every bot do at once. */
export const BOT_ACTIONS = ['seat', 'count', 'role', 'vote', 'rate', 'message'] as const;
export type BotAction = (typeof BOT_ACTIONS)[number];

/** What one bot has already done, so a view that comes again doesn't send it twice. */
export interface BotMemory {
	/** It tapped a number in the count off that is open. */
	counted?: boolean;
	/** Seating was open and this bot already asked to sit. */
	satWhileOpen?: boolean;
	/** The open seat this bot last asked for once seating was locked. */
	claimed?: string;
	/** The role (character and alignment) this bot last held to see. */
	seenRole?: string;
	spectatorVote?: string;
	scriptVote?: string;
	feedbackFor?: string;
	look?: boolean;
}

export interface BotSelf {
	/** 0-based, the order the bots joined in: it spreads their choices round the table. */
	index: number;
	name: string;
	/** A number from 0 to 1, for the choices that are random. */
	random: () => number;
}

const pick = <T>(items: readonly T[], random: () => number): T =>
	items[Math.floor(random() * items.length) % items.length];

/** A seat no player has, as the room judges it (`isOpenSeat` in room-seating-open.ts). */
const open = (name?: string) => !name || /^Seat \d+$/.test(name);

const roleKey = (view: PlayerView) =>
	view.role ? `${view.role.characterId ?? ''}/${view.role.alignment ?? ''}` : undefined;

/**
 * The message for one tap, or none when the view offers nothing to tap: a seat (moving while
 * seating is open, else claiming an open one), a count off number, holding to see a character,
 * a vote (the spectators' or the next script's), a rating once the game is over, or a message
 * to the Storyteller.
 */
export function action(kind: BotAction, view: PlayerView, self: BotSelf): ClientMessage | null {
	const me = view.me;
	const seats = view.public?.seats ?? [];
	if (!me.name) return null;
	switch (kind) {
		case 'seat': {
			if (!seats.length) return null;
			if (view.seatingOpen) return { type: 'sit', onto: seats[self.index % seats.length].seatId };
			if (me.seatId) return null;
			const free = seats.filter((s) => open(s.playerName) && !view.takenSeats.includes(s.seatId));
			const seat = free[self.index % Math.max(1, free.length)];
			return seat ? { type: 'claim-seat', seatId: seat.seatId } : null;
		}
		case 'count': {
			const count = view.countOff;
			if (!count || count.tokens.some((t) => t.mine)) return null;
			const held = new Set(count.tokens.map((t) => t.number));
			const free = Array.from({ length: count.size }, (_, i) => i + 1).filter((n) => !held.has(n));
			// Its own place round the table if free, as players count in order; else the first free.
			const number = free.includes(self.index + 1) ? self.index + 1 : free[0];
			return number === undefined ? null : { type: 'count', number };
		}
		case 'role':
			return view.role ? { type: 'role-seen' } : null;
		case 'vote': {
			if (view.vote) {
				return {
					type: 'vote',
					voteId: view.vote.voteId,
					choice: pick(view.vote.options, self.random)
				};
			}
			const ballot = view.scriptVote;
			if (!ballot?.options.length) return null;
			const ids = ballot.options.map((o) => o.id);
			const shuffled = [...ids].sort(() => self.random() - 0.5);
			const choices =
				ballot.kind === 'single'
					? [pick(ids, self.random)]
					: ballot.kind === 'multiple'
						? shuffled.slice(0, 1 + Math.floor(self.random() * ids.length))
						: shuffled;
			return { type: 'script-ballot', voteId: ballot.voteId, choices };
		}
		case 'rate': {
			const ended = view.endedGameId;
			if (!ended) return null;
			return {
				type: 'feedback',
				gameId: ended,
				feedback: {
					version: 1,
					rating: 1 + Math.floor(self.random() * 9) / 2,
					accolades: [pick(ACCOLADES, self.random).id],
					comment: `${self.name} had fun.`,
					anonymous: self.random() < 0.5
				}
			};
		}
		case 'message':
			return view.inbox ? { type: 'message', text: `A test message from ${self.name}.` } : null;
	}
}

/**
 * Everything a bot left to itself sends for this view, and what it will then have done: each
 * tap once, when the view first offers it. It never messages the Storyteller unasked.
 */
export function replies(
	view: PlayerView,
	memory: BotMemory,
	self: BotSelf
): { send: ClientMessage[]; memory: BotMemory } {
	const next: BotMemory = { ...memory };
	if (!view.me.name) {
		return { send: [{ type: 'request', name: self.name }], memory: next };
	}
	const send: ClientMessage[] = [];
	const add = (message: ClientMessage | null) => {
		if (message) send.push(message);
		return !!message;
	};
	if (!next.look) next.look = add({ type: 'look', avatar: 'initials' });

	if (!view.countOff) next.counted = false;
	else if (!next.counted) next.counted = add(action('count', view, self));

	if (!view.seatingOpen) next.satWhileOpen = false;
	else if (!next.satWhileOpen) next.satWhileOpen = add(action('seat', view, self));
	if (!view.seatingOpen && !view.me.seatId) {
		const claim = action('seat', view, self);
		if (claim?.type === 'claim-seat' && next.claimed !== claim.seatId) {
			add(claim);
			next.claimed = claim.seatId;
		}
	}

	const role = roleKey(view);
	if (role && next.seenRole !== role && add(action('role', view, self))) next.seenRole = role;

	if (view.vote && view.vote.choice === undefined && next.spectatorVote !== view.vote.voteId) {
		if (add(action('vote', view, self))) next.spectatorVote = view.vote.voteId;
	} else if (
		!view.vote &&
		view.scriptVote &&
		!view.scriptVote.choices &&
		next.scriptVote !== view.scriptVote.voteId
	) {
		if (add(action('vote', view, self))) next.scriptVote = view.scriptVote.voteId;
	}

	const ended = view.endedGameId;
	if (ended && !view.feedback && next.feedbackFor !== ended && add(action('rate', view, self))) {
		next.feedbackFor = ended;
	}
	return { send, memory: next };
}
