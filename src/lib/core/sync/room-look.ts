/**
 * A player's look in the room (plan R6): their avatar, frame and own picture, which the
 * Storyteller's device puts on their seat. Purely decorative, so no approval, but a picture the
 * Storyteller took away stays away for the game (room-pictures.ts), and the look is locked
 * while a game is under way (`lookLocked`).
 */
import { parseAvatarId } from '#lib/core/avatars/index.ts';
import { parseFrameId } from '#lib/core/frames/index.ts';
import { isImageHash } from './room-images.ts';
import { mayShowPicture } from './room-pictures.ts';
import type { RoomMember, RoomState } from './room.ts';

export function lookOf(m: RoomMember): Pick<RoomMember, 'avatar' | 'frame' | 'picture'> {
	return {
		...(m.avatar === undefined ? {} : { avatar: m.avatar }),
		...(m.frame === undefined ? {} : { frame: m.frame }),
		...(m.picture === undefined ? {} : { picture: m.picture })
	};
}

/**
 * Whether a player's look is locked (Trevor, 2026-10-29): from the first night until the game
 * ends, a player who is seated, or already has a look, keeps it, so a new character icon,
 * picture or laurel colour can't hint at the character they claim. A phone joining mid-game
 * with no look yet may still set one, once. Changes made meanwhile wait for the next game.
 */
export function lookLocked(room: RoomState, member: RoomMember): boolean {
	if (!room.begun || room.ended) return false;
	const hasLook = member.avatar ?? member.frame ?? member.picture;
	return member.seatId !== undefined || hasLook !== undefined;
}

/**
 * A player's avatar, frame and picture; unknown ones are dropped, as if none were picked. The
 * picture must be the one this member uploaded (`uploaded`), and not taken away this game.
 * Nothing changes while the member's look is locked.
 */
export function setLook(
	room: RoomState,
	memberId: string,
	raw: { avatar?: unknown; frame?: unknown; picture?: unknown },
	uploaded?: string
): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member || lookLocked(room, member)) return room;
	const avatar = parseAvatarId(raw.avatar);
	const frame = parseFrameId(raw.frame);
	const ok = isImageHash(raw.picture) && raw.picture === uploaded;
	const picture = ok && mayShowPicture(room, memberId) ? uploaded : undefined;
	const same = avatar === member.avatar && frame === member.frame;
	if (same && picture === member.picture) return room;
	const { avatar: _a, frame: _f, picture: _p, ...rest } = member;
	void [_a, _f, _p];
	const updated: RoomMember = { ...rest, ...lookOf({ memberId, avatar, frame, picture }) };
	return { ...room, members: room.members.map((m) => (m.memberId === memberId ? updated : m)) };
}
