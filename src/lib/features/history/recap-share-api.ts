/**
 * The shared game recap API, used by the app and the Worker (plain TypeScript, no app
 * imports). The Storyteller shares a finished game's recap with the players (Trevor,
 * 2026-10-19: "something that people who are playing the game could see as well on their
 * phones if the storyteller allows"); it is stored on our Worker under a random id and
 * deleted 30 days after it was last opened, or earlier by the Storyteller.
 *
 *   POST   /api/recap            body: SharedRecap       -> 201 { id, deleteKey }
 *   GET    /api/recap/<id>                               -> 200 SharedRecap | 404
 *   DELETE /api/recap/<id>       X-Delete-Key header     -> 204 | 404
 *
 * The page is /recap/<id>. The id is 128 random bits rather than a short code, because a
 * recap names the players: it is only ever opened from the link or QR code, never typed.
 */
import type { GameRecap, RecapLine, RecapNote, RecapParts, RecapSeat } from './recap-html.ts';

export const RECAP_API = '/api/recap';
export const RECAP_PAGE = '/recap';
export const RECAP_DELETE_KEY_HEADER = 'X-Delete-Key';
/** A shared recap is deleted this long after it was last opened. */
export const RECAP_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** The largest recap we store: the grimoire picture as a JPEG plus the text. */
export const MAX_RECAP_BYTES = 1_500_000;
const SHARED_VERSION = 1;
/** Far more than any game has; anything bigger isn't a recap. */
const MAX_SEATS = 100;
const MAX_LINES = 5000;
const MAX_TEXT = 2000;

/** Image data URLs only, so a recap never points anywhere else. */
export const IMAGE_DATA = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/** What is stored: the recap with only the parts the Storyteller chose. */
export interface SharedRecap {
	v: typeof SHARED_VERSION;
	recap: GameRecap;
	parts: RecapParts;
	/** The grimoire as an image data URL, when `parts.image` is on. */
	image?: string;
}

export interface CreatedRecap {
	id: string;
	/** Proves the Storyteller may delete it; kept on their device only. */
	deleteKey: string;
}

/** 22 base64url characters: 128 random bits. */
const RECAP_ID = /^[A-Za-z0-9_-]{22}$/;

export function isRecapId(id: string): boolean {
	return RECAP_ID.test(id);
}

export function recapApiPath(id: string): string {
	return `${RECAP_API}/${id}`;
}

export function recapPagePath(id: string): string {
	return `${RECAP_PAGE}/${id}`;
}

/** The id in a Worker path `/api/recap/<id>`, or undefined. */
export function parseRecapApiPath(pathname: string): string | undefined {
	const id = /^\/api\/recap\/([^/]+)\/?$/.exec(pathname)?.[1];
	return id && isRecapId(id) ? id : undefined;
}

/** Only what we lay out: the parts left out are emptied, so they are never uploaded. */
export function sharedRecap(recap: GameRecap, parts: RecapParts, image?: string): SharedRecap {
	return {
		v: SHARED_VERSION,
		recap: { ...recap, log: parts.log ? recap.log : [], notes: parts.notes ? recap.notes : [] },
		parts,
		...(parts.image && image && IMAGE_DATA.test(image) ? { image } : {})
	};
}

type Fields = Record<string, unknown>;
const isObject = (v: unknown): v is Fields => typeof v === 'object' && v !== null;
const text = (v: unknown): v is string => typeof v === 'string' && v.length <= MAX_TEXT;
const optionalText = (v: unknown) => v === undefined || text(v);
const flag = (v: unknown): v is boolean => typeof v === 'boolean';

function isCharacter(v: unknown): boolean {
	if (v === undefined) return true;
	return (
		isObject(v) &&
		text(v.name) &&
		(v.alignment === undefined || v.alignment === 'good' || v.alignment === 'evil')
	);
}

function isSeat(v: unknown): v is RecapSeat {
	return (
		isObject(v) &&
		text(v.seatId) &&
		typeof v.number === 'number' &&
		text(v.name) &&
		isCharacter(v.start) &&
		isCharacter(v.end) &&
		flag(v.dead) &&
		optionalText(v.death) &&
		optionalText(v.accountId) &&
		optionalText(v.claimedBy)
	);
}

const isLine = (v: unknown): v is RecapLine => isObject(v) && text(v.time) && text(v.text);
const isNote = (v: unknown): v is RecapNote => isObject(v) && text(v.about) && text(v.text);

function list<T>(v: unknown, max: number, is: (item: unknown) => item is T): v is T[] {
	return Array.isArray(v) && v.length <= max && v.every(is);
}

function isRecap(v: unknown): v is GameRecap {
	return (
		isObject(v) &&
		text(v.title) &&
		optionalText(v.author) &&
		optionalText(v.storyteller) &&
		text(v.played) &&
		text(v.result) &&
		optionalText(v.howEnded) &&
		typeof v.days === 'number' &&
		list(v.seats, MAX_SEATS, isSeat) &&
		list(v.log, MAX_LINES, isLine) &&
		list(v.notes, MAX_LINES, isNote)
	);
}

/**
 * A stored recap, checked field by field (it comes from whoever shared it), or undefined.
 * A newer version than this build knows is undefined too.
 */
export function readSharedRecap(body: unknown): SharedRecap | undefined {
	if (!isObject(body) || body.v !== SHARED_VERSION || !isRecap(body.recap)) return undefined;
	const parts = body.parts;
	if (!isObject(parts) || !flag(parts.log) || !flag(parts.image) || !flag(parts.notes)) {
		return undefined;
	}
	if (
		body.image !== undefined &&
		(typeof body.image !== 'string' || !IMAGE_DATA.test(body.image))
	) {
		return undefined;
	}
	return body as unknown as SharedRecap;
}

export function readCreatedRecap(body: unknown): CreatedRecap | undefined {
	if (!isObject(body)) return undefined;
	const { id, deleteKey } = body;
	if (typeof id !== 'string' || !isRecapId(id) || typeof deleteKey !== 'string') return undefined;
	return { id, deleteKey };
}
