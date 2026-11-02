import { roomHost } from './host.svelte.ts';

let holders = 0;

/**
 * The room's phones see the Storyteller choosing the next game (plan R1) while New game or the
 * room vote is open. Both can be open at once (the vote over the board's New game sheet), so
 * the room hears "done" only when the last of them closes. Returns the release.
 */
export function holdChoosing(): () => void {
	const host = roomHost();
	holders++;
	// Before the room has opened too: the room vote opens one, which then says so at once.
	host.setChoosing(true);
	let held = true;
	return () => {
		if (!held) return;
		held = false;
		holders--;
		if (holders === 0) host.setChoosing(false);
	};
}
