/**
 * Players' own avatar pictures in a live room (Trevor, 2026-10-27: "allow setting users
 * profile/icon in the player settings ... report image ... which will then show the image to
 * the storyteller, who can either decide to let it stand, or to remove/revoke avatar for that
 * game"). A phone uploads its picture to the room (core/sync/room-images.ts, with its own key)
 * and names it in its look; the room puts it on the phone's seat for the whole table. Any other
 * phone can report it; the Storyteller lets it stand or takes that player's picture away until
 * the next game. The room keeps the verdicts per game, so a new game starts clean.
 */
import type { SeatId } from '#lib/core/model/index.ts';
import type { RoomMember, RoomState } from './room.ts';

/** A player's picture is shrunk to this side on their phone before it goes anywhere. */
export const AVATAR_PICTURE_SIDE = 256;
/** Largest avatar picture a room takes; a 256 px JPEG is a small part of it. */
export const MAX_AVATAR_PICTURE_BYTES = 128 * 1024;

/** One picture reported by other phones, waiting for the Storyteller. */
export interface PictureReport {
	hash: string;
	/** Whose picture it is. */
	memberId: string;
	/** The members who reported it, each once. */
	reporters: string[];
	/** Milliseconds since the epoch of the first report. */
	at: number;
}

/** The room's reports and the Storyteller's verdicts, for the current game. */
export interface RoomPictures {
	reports: PictureReport[];
	/** Pictures the Storyteller let stand: reporting them again does nothing. */
	allowed: string[];
	/** Members whose picture the Storyteller took away: they show their initials this game. */
	revoked: string[];
}

/** What the Storyteller's device is shown of one report. */
export interface PictureReportView {
	hash: string;
	memberId: string;
	count: number;
	/** When it was first reported, to sit among players' messages; older rooms leave it out. */
	at?: number;
}

const NONE: RoomPictures = { reports: [], allowed: [], revoked: [] };

const picturesOf = (room: RoomState): RoomPictures => room.pictures ?? NONE;

/** Whether this member may show a picture in the current game. */
export function mayShowPicture(room: RoomState, memberId: string): boolean {
	return !picturesOf(room).revoked.includes(memberId);
}

/** Each seated player's picture, by seat, for every grim at the table. */
export function seatPictures(members: readonly RoomMember[]): Partial<Record<SeatId, string>> {
	const pictures: Partial<Record<SeatId, string>> = {};
	for (const m of members) if (m.seatId && m.picture) pictures[m.seatId] = m.picture;
	return pictures;
}

/**
 * A phone reports the picture on `seatId`. Nothing changes for an empty seat, the reporter's
 * own picture, one the Storyteller already let stand, or a second report from the same phone.
 */
export function reportPicture(
	room: RoomState,
	reporterId: string,
	seatId: unknown,
	at: number
): RoomState {
	if (typeof seatId !== 'string') return room;
	const owner = room.members.find((m) => m.seatId === seatId && m.picture);
	if (!owner?.picture || owner.memberId === reporterId) return room;
	if (!room.members.some((m) => m.memberId === reporterId)) return room;
	const pictures = picturesOf(room);
	const hash = owner.picture;
	if (pictures.allowed.includes(hash)) return room;
	const old = pictures.reports.find((r) => r.hash === hash && r.memberId === owner.memberId);
	if (old?.reporters.includes(reporterId)) return room;
	const report: PictureReport = old
		? { ...old, reporters: [...old.reporters, reporterId] }
		: { hash, memberId: owner.memberId, reporters: [reporterId], at };
	const reports = old
		? pictures.reports.map((r) => (r === old ? report : r))
		: [...pictures.reports, report];
	return { ...room, pictures: { ...pictures, reports } };
}

/**
 * The Storyteller's verdict on a reported picture: let it stand (`allow`), or take the player's
 * picture away for the rest of this game. Either way its reports are done with.
 */
export function judgePicture(room: RoomState, hash: unknown, allow: unknown): RoomState {
	const pictures = picturesOf(room);
	const report = pictures.reports.find((r) => r.hash === hash);
	if (!report || typeof allow !== 'boolean') return room;
	const reports = pictures.reports.filter((r) => r.hash !== hash);
	if (allow) {
		return {
			...room,
			pictures: { ...pictures, reports, allowed: [...pictures.allowed, report.hash] }
		};
	}
	const revoked = [...new Set([...pictures.revoked, report.memberId])];
	return {
		...room,
		pictures: { ...pictures, reports, revoked },
		members: room.members.map((m) => (m.memberId === report.memberId ? withoutPicture(m) : m))
	};
}

function withoutPicture(member: RoomMember): RoomMember {
	const { picture: _picture, ...rest } = member;
	void _picture;
	return rest;
}

/** The reports waiting for the Storyteller, oldest first, of pictures still shown. */
export function pictureReports(room: RoomState): PictureReportView[] {
	return picturesOf(room)
		.reports.filter((r) =>
			room.members.some((m) => m.memberId === r.memberId && m.picture === r.hash)
		)
		.sort((a, b) => a.at - b.at)
		.map((r) => ({ hash: r.hash, memberId: r.memberId, count: r.reporters.length, at: r.at }));
}

/** A new game: every report and verdict belonged to the last one. */
export function withoutPictureVerdicts(room: RoomState): RoomState {
	if (!room.pictures) return room;
	const { pictures: _pictures, ...rest } = room;
	void _pictures;
	return rest;
}
