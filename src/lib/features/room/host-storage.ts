/**
 * The window name of the Character Analyzer's game frame. Its game stays on this device: the
 * frame never joins the device's own room, so testing a character never moves the phones of a
 * real game, and it only opens a room of its own when Share is pressed in it (Trevor,
 * 2026-11-06: "should be local, and not invoke a room code unless specifically asks for it
 * with a button").
 */
export const LAB_FRAME_NAME = 'grimbinder-lab';

/**
 * What the Storyteller's device keeps of its room (host.svelte.ts): the code and host key,
 * so the room outlives the page and the game, and Grim view's and roles' state. The lab's
 * frame keeps its own.
 */
export const STORAGE_KEY = isLabFrame() ? 'grim-games-room-host:lab' : 'grim-games-room-host';

function isLabFrame(): boolean {
	return (globalThis as { name?: unknown }).name === LAB_FRAME_NAME;
}

export interface StoredRoom {
	code: string;
	key: string;
	/** The key Grim view's password makes, while Grim view is on. */
	viewerKey?: string;
	/** The Grim view password that key was made from. */
	viewerPassword?: string;
	/** The game that password was made for: the next game gets a new one (2026-10-26). */
	viewerGame?: string;
	/** The game whose players may see their own characters now (Trevor, 2026-10-26). */
	rolesShown?: string;
	/** When rolesShown turns itself off, in Date.now() ms (roles-shown.svelte.ts). */
	rolesShownUntil?: number;
}
