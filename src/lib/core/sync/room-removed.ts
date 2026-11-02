/**
 * Remove from room (plan J37, Trevor 2026-10-29): the Storyteller takes a phone out of the room
 * for the current game. It is turned away if it tries again, until the Storyteller lets it back
 * in or a new game starts. The Storyteller's Players lists who was removed, by name and look,
 * so "Let back in" has someone to show.
 */
import { sha256Hex } from '#lib/core/codes/hash.ts';
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
	// Their look, not the words on their profile, which may be why they were removed.
	const { tagline: _t, details: _d, ...look } = lookOf(member);
	void [_t, _d];
	const removed: RemovedMember = {
		memberId,
		...(member.name === undefined ? {} : { name: member.name }),
		...look
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

/**
 * Header on a room's preview (`GET /api/room/<code>`) carrying `removedProbe`, so Join game turns
 * a removed phone away as the code is typed (Trevor, 2026-10-31: "it should show error before
 * you get to that screen"). Never a query string, which the Worker's logs keep.
 */
export const REMOVED_PROBE_HEADER = 'X-Removed-Probe';

/**
 * Asks "was I removed?" without naming the phone: a hash of its member id and the room's code,
 * so the same phone looks different in every room.
 */
export function removedProbe(code: string, memberId: string): Promise<string> {
	return sha256Hex(`removed:${code}:${memberId}`);
}

/** Whether `probe` (from `removedProbe`) names a phone removed from room `code`. */
export async function isRemovedProbe(
	room: RoomState,
	code: string,
	probe: string | null | undefined
): Promise<boolean> {
	if (!probe || !room.removed?.length) return false;
	for (const m of room.removed) if ((await removedProbe(code, m.memberId)) === probe) return true;
	return false;
}
