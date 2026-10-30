/**
 * What a fake phone does when its view changes (room-bots.ts): the same messages a player's
 * phone sends (`ClientMessage` in core/sync/room-protocol.ts), chosen the way a player at the
 * table would. Pure, so the choices are tested; the bot that sends them is bot.ts.
 */
import { ACCOLADES } from '#lib/core/feedback/feedback.ts';
import type { ClientMessage, PlayerView } from '#lib/core/sync/room-protocol.ts';

/** What one bot has already done, so a view that comes again doesn't send it twice. */
export interface BotMemory {
	/** The count off this bot last tapped a number in, by its numbers' size. */
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

/** The messages to send for this view, and what the bot will then have done. */
export function replies(
	view: PlayerView,
	memory: BotMemory,
	self: BotSelf
): { send: ClientMessage[]; memory: BotMemory } {
	const send: ClientMessage[] = [];
	const next: BotMemory = { ...memory };
	const me = view.me;
	if (!me.name) {
		send.push({ type: 'request', name: self.name });
		return { send, memory: next };
	}
	if (!next.look) {
		send.push({ type: 'look', avatar: 'initials' });
		next.look = true;
	}

	const count = view.countOff;
	if (!count) next.counted = false;
	else if (!next.counted && !count.tokens.some((t) => t.mine)) {
		const held = new Set(count.tokens.map((t) => t.number));
		const free = Array.from({ length: count.size }, (_, i) => i + 1).filter((n) => !held.has(n));
		// Its own place round the table if free, as players count in order; else the first free.
		const number = free.includes(self.index + 1) ? self.index + 1 : free[0];
		if (number !== undefined) {
			send.push({ type: 'count', number });
			next.counted = true;
		}
	}

	const seats = view.public?.seats ?? [];
	if (!view.seatingOpen) next.satWhileOpen = false;
	else if (!next.satWhileOpen && seats.length) {
		send.push({ type: 'sit', after: seats[self.index % seats.length].seatId });
		next.satWhileOpen = true;
	}
	if (!view.seatingOpen && !me.seatId && seats.length) {
		const free = seats.filter((s) => open(s.playerName) && !view.takenSeats.includes(s.seatId));
		const seat = free[self.index % Math.max(1, free.length)];
		if (seat && next.claimed !== seat.seatId) {
			send.push({ type: 'claim-seat', seatId: seat.seatId });
			next.claimed = seat.seatId;
		}
	}

	if (view.role) {
		const key = `${view.role.characterId ?? ''}/${view.role.alignment ?? ''}`;
		if (next.seenRole !== key) {
			send.push({ type: 'role-seen' });
			next.seenRole = key;
		}
	}

	if (view.vote && view.vote.choice === undefined && next.spectatorVote !== view.vote.voteId) {
		send.push({
			type: 'vote',
			voteId: view.vote.voteId,
			choice: pick(view.vote.options, self.random)
		});
		next.spectatorVote = view.vote.voteId;
	}

	const ballot = view.scriptVote;
	if (ballot && !ballot.choices && next.scriptVote !== ballot.voteId && ballot.options.length) {
		const ids = ballot.options.map((o) => o.id);
		const shuffled = [...ids].sort(() => self.random() - 0.5);
		const choices =
			ballot.kind === 'single'
				? [pick(ids, self.random)]
				: ballot.kind === 'multiple'
					? shuffled.slice(0, 1 + Math.floor(self.random() * ids.length))
					: shuffled;
		send.push({ type: 'script-ballot', voteId: ballot.voteId, choices });
		next.scriptVote = ballot.voteId;
	}

	const ended = view.endedGameId;
	if (ended && !view.feedback && next.feedbackFor !== ended) {
		send.push({
			type: 'feedback',
			gameId: ended,
			feedback: {
				version: 1,
				rating: 1 + Math.floor(self.random() * 9) / 2,
				accolades: [pick(ACCOLADES, self.random).id],
				comment: `${self.name} had fun.`,
				anonymous: self.random() < 0.5
			}
		});
		next.feedbackFor = ended;
	}
	return { send, memory: next };
}
