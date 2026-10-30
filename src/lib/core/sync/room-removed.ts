/**
 * Remove from room (plan J37, Trevor 2026-10-29): the Storyteller takes a phone out of the room
 * for the current game. It is turned away if it tries again, until the Storyteller lets it back
 * in or a new game starts. The Storyteller's Players lists who was removed, by name and look,
 * so "Let back in" has someone to show.
 */
import { lookOf } from './room-look.ts';
import type { RoomMember, RoomState } from './room.ts';

/** A removed phone as the Storyteller last saw it; never a seat, which it no longer has. */
export type RemovedMember = Pick<RoomMember, 'memberId' | 'name' | 'avatar' | 'frame' | 'picture'>;

export function isRemoved(room: RoomState, memberId: string): boolean {
	return !!room.removed?.some((m) => m.memberId === memberId);
}

/** Takes the member out of the room for this game, with its seat, vote and ballot. */
export function removeMember(room: RoomState, memberId: string): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member || isRemoved(room, memberId)) return room;
	const removed: RemovedMember = {
		memberId,
		...(member.name === undefined ? {} : { name: member.name }),
		...lookOf(member)
	};
	const next: RoomState = {
		...room,
		members: room.members.filter((m) => m.memberId !== memberId),
		removed: [...(room.removed ?? []), removed]
	};
	if (room.vote?.votes[memberId] !== undefined) {
		const { [memberId]: _gone, ...votes } = room.vote.votes;
		void _gone;
		next.vote = { ...room.vote, votes };
	}
	return next;
}

/** Lets a removed phone join again; it comes back as a new phone with no seat. */
export function letBackIn(room: RoomState, memberId: string): RoomState {
	if (!isRemoved(room, memberId)) return room;
	const removed = room.removed!.filter((m) => m.memberId !== memberId);
	const { removed: _all, ...rest } = room;
	void _all;
	return removed.length ? { ...rest, removed } : rest;
}

/** A new game lets everyone back in: removal holds for one game only. */
export function withoutRemoved(room: RoomState): RoomState {
	if (!room.removed) return room;
	const { removed: _all, ...rest } = room;
	void _all;
	return rest;
}
