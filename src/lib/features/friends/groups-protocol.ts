/**
 * Groups (plan F6; Trevor, 2026-10-31): "you can have several groups, there can be a group
 * join code ... I play at a board game cafe ... when starting a game, players just look to
 * that, instead of having to find the associated code", and "not everyone will go every
 * time, so we can't be too spammy". So a group is a name and a join code; a Storyteller
 * chooses, per room, to show their live game in a group, and members see it when they look.
 * Nothing is sent to members. Codes travel in request bodies and the URL hash, never a query.
 */
import type { FriendAccount } from './friends-protocol.ts';

/** Groups one account can be in, its own included. */
export const MAX_GROUPS = 20;
/** Members in one group: a cafe's regulars. */
export const MAX_GROUP_MEMBERS = 500;
/** Groups one account can start in a day. */
export const GROUPS_PER_DAY = 5;
export const MAX_GROUP_NAME = 60;
/** How long a room shows in a group without being shown again: one evening's game. */
export const GROUP_GAME_TTL_MS = 12 * 60 * 60 * 1000;

/** Letters and digits that can't be mistaken for each other when read aloud or off a wall. */
export const GROUP_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const GROUP_CODE_LENGTH = 8;

/** A typed or scanned code as stored: capitals, no spaces or dashes; undefined if it can't be one. */
export function normaliseGroupCode(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const code = value.toUpperCase().replace(/[\s-]/g, '');
	if (code.length !== GROUP_CODE_LENGTH) return undefined;
	return [...code].every((c) => GROUP_CODE_ALPHABET.includes(c)) ? code : undefined;
}

/** A code shown to people: two halves, easier to read off a poster. */
export function formatGroupCode(code: string): string {
	const half = GROUP_CODE_LENGTH / 2;
	return `${code.slice(0, half)}-${code.slice(half)}`;
}

/** A name as stored: trimmed and cut to length; undefined when empty. */
export function normaliseGroupName(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined;
	const name = value.trim().replace(/\s+/g, ' ').slice(0, MAX_GROUP_NAME);
	return name || undefined;
}

/** A link that opens Join group with the code filled in, for a group's QR code. */
export function groupLink(origin: string, code: string): string {
	return `${origin}/friends#group=${code}`;
}

/** The code in a group link or its hash (`#group=…`); undefined for anything else. */
export function readGroupLink(text: string): string | undefined {
	let hash: string;
	try {
		const url = new URL(text.trim());
		if (url.pathname !== '/friends') return undefined;
		hash = url.hash;
	} catch {
		hash = text.trim();
	}
	const match = /^#group=([^&]+)$/.exec(hash);
	return match ? normaliseGroupCode(match[1]) : undefined;
}

/** A live game shown in a group. */
export interface GroupGame {
	/** The room's code, for Join game. */
	room: string;
	title: string;
	storyteller: FriendAccount;
	at: number;
}

/** One group on the Friends page. */
export interface GroupSummary {
	code: string;
	name: string;
	/** Whether this account started it, and so may remove members or delete it. */
	owner: boolean;
	members: number;
	games: GroupGame[];
}

/** `GET /api/friends/groups`. */
export interface GroupsResponse {
	groups: GroupSummary[];
}

/** Why joining or starting a group didn't happen. */
export type GroupRefusal = 'not-found' | 'full' | 'limit' | 'unavailable';

/** `POST /api/friends/groups/join` and `/create`: the account's groups after the change. */
export type GroupChangeResponse =
	({ ok: true; code: string } & GroupsResponse) | { ok: false; reason: GroupRefusal };

/** `POST /api/friends/groups/members`: the group's members, for its owner. */
export interface GroupMembersResponse {
	members: FriendAccount[];
}

/** `POST /api/friends/groups/room`: which of the Storyteller's groups show this room. */
export interface GroupRoomRequest {
	room: string;
	/** The group to change, and whether the room shows in it; leave out to only ask. */
	group?: string;
	show?: boolean;
	title?: string;
}

export interface GroupRoomResponse {
	shown: string[];
}

export const GROUPS_API = '/api/friends/groups';
export const GROUP_CREATE_API = `${GROUPS_API}/create`;
export const GROUP_JOIN_API = `${GROUPS_API}/join`;
export const GROUP_LEAVE_API = `${GROUPS_API}/leave`;
export const GROUP_MEMBERS_API = `${GROUPS_API}/members`;
export const GROUP_REMOVE_API = `${GROUPS_API}/remove`;
export const GROUP_ROOM_API = `${GROUPS_API}/room`;
