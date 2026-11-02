/**
 * A player's look in the room (plan R6): their avatar, frame and own picture, which the
 * Storyteller's device puts on their seat, and the words on their profile (tag-line and details,
 * Trevor 2026-11-01). Purely decorative, so no approval, but a picture the Storyteller took away
 * stays away for the game (room-pictures.ts).
 */
import { parseAvatarId } from '#lib/core/avatars/index.ts';
import { parseFrameId } from '#lib/core/frames/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import { parseProfileWords, sameDetails, type ProfileWords } from '#lib/core/profile/index.ts';
import { isImageHash } from './room-images.ts';
import { mayShowPicture } from './room-pictures.ts';
import type { RoomMember, RoomState } from './room.ts';

type Look = 'avatar' | 'frame' | 'picture' | 'tagline' | 'details';

export function lookOf(m: Pick<RoomMember, Look>): Pick<RoomMember, Look> {
	return {
		...(m.avatar === undefined ? {} : { avatar: m.avatar }),
		...(m.frame === undefined ? {} : { frame: m.frame }),
		...(m.picture === undefined ? {} : { picture: m.picture }),
		...wordsOf(m)
	};
}

/** The words on a member's profile, each left out when they wrote none. */
export function wordsOf(m: ProfileWords): ProfileWords {
	return {
		...(m.tagline === undefined ? {} : { tagline: m.tagline }),
		...(m.details === undefined ? {} : { details: m.details })
	};
}

/** Each seated player's profile words, by seat, for every grim at the table. */
export function seatWords(members: readonly RoomMember[]): Partial<Record<SeatId, ProfileWords>> {
	const words: Partial<Record<SeatId, ProfileWords>> = {};
	for (const m of members) {
		const own = wordsOf(m);
		if (m.seatId && Object.keys(own).length) words[m.seatId] = own;
	}
	return words;
}

/**
 * A player's avatar, frame, picture and profile words; unknown ones are dropped, as if none were
 * picked. The
 * picture must be the one this member uploaded (`uploaded`), and not taken away this game.
 */
export function setLook(
	room: RoomState,
	memberId: string,
	raw: {
		avatar?: unknown;
		frame?: unknown;
		picture?: unknown;
		tagline?: unknown;
		details?: unknown;
	},
	uploaded?: string
): RoomState {
	const member = room.members.find((m) => m.memberId === memberId);
	if (!member) return room;
	const avatar = parseAvatarId(raw.avatar);
	const frame = parseFrameId(raw.frame);
	const ok = isImageHash(raw.picture) && raw.picture === uploaded;
	const picture = ok && mayShowPicture(room, memberId) ? uploaded : undefined;
	const words = parseProfileWords(raw);
	const same =
		avatar === member.avatar &&
		frame === member.frame &&
		words.tagline === member.tagline &&
		sameDetails(words.details, member.details);
	if (same && picture === member.picture) return room;
	const { avatar: _a, frame: _f, picture: _p, tagline: _t, details: _d, ...rest } = member;
	void [_a, _f, _p, _t, _d];
	const updated: RoomMember = { ...rest, ...lookOf({ avatar, frame, picture, ...words }) };
	return { ...room, members: room.members.map((m) => (m.memberId === memberId ? updated : m)) };
}
