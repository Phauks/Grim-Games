/**
 * Players' feedback on the ended game, as the live room carries it to the Storyteller (Trevor,
 * 2026-10-20). Kept apart from `room.ts` so each stays a readable size.
 */
import { hasFeedback, parseFeedback, type GameFeedback } from '#lib/core/feedback/index.ts';
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomState } from './room.ts';

/**
 * One member's feedback on the ended game (Trevor, 2026-10-20). `id` is made by the room and
 * is not the member id, so the Storyteller can't match anonymous feedback to a member.
 */
export interface MemberFeedback {
	id: string;
	memberId: string;
	feedback: GameFeedback;
}

/** Feedback as the Storyteller sees it: name and seat only when the player gave them. */
export interface FeedbackView {
	id: string;
	feedback: GameFeedback;
	name?: string;
	seatId?: SeatId;
}

/**
 * A member's feedback on the ended game. Ignored unless `gameId` is the game that ended, the
 * member is in the room and there is something in it; `newId` names a member's first one.
 */
export function receiveFeedback(
	room: RoomState,
	memberId: string,
	gameId: unknown,
	raw: unknown,
	newId: string
): RoomState {
	if (!room.ended || room.ended.gameId !== gameId || room.gameId !== gameId) return room;
	if (!room.members.some((m) => m.memberId === memberId)) return room;
	const feedback = parseFeedback(raw);
	if (!feedback || !hasFeedback(feedback)) return room;
	const all = room.feedback ?? [];
	const last = all.find((f) => f.memberId === memberId);
	const entry: MemberFeedback = { id: last?.id ?? newId, memberId, feedback };
	return {
		...room,
		feedback: last ? all.map((f) => (f === last ? entry : f)) : [...all, entry]
	};
}

export function feedbackView(
	room: RoomState,
	{ id, memberId, feedback }: MemberFeedback
): FeedbackView {
	const view: FeedbackView = { id, feedback };
	if (feedback.anonymous) return view;
	const member = room.members.find((m) => m.memberId === memberId);
	if (member?.name !== undefined) view.name = member.name;
	if (member?.seatId !== undefined) view.seatId = member.seatId;
	return view;
}
