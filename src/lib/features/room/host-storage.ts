/**
 * What the Storyteller's device keeps of its room (host.svelte.ts): the code and host key,
 * so the room outlives the page and the game, and Grim view's and roles' state.
 */
export const STORAGE_KEY = 'grim-games-room-host';

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
