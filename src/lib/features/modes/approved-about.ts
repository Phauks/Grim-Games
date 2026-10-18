/**
 * Built-in mode descriptions Trevor has approved (2026-10-18: "You write game mode
 * descriptions, but I will verify them"). Each entry is the exact text he approved, so a
 * description shows to everyone only while it still matches; any later edit hides it behind
 * our own wording setting again until he approves the new text.
 */
export const APPROVED_ABOUT: Readonly<Record<string, string>> = {
	// Trevor's own wording, 2026-10-18.
	'sushi-buffet':
		'Each Player can select from three drafted characters, players can select their character, or mulligan into a new set of two drafted characters, where they once again can select their character, or mulligan into the final character. The demon gets no bluffs.',
	'two-towns-and-a-boomdandy':
		'Two towns play side by side, each with its own Storyteller and script. Each day some players move to the other town. The game ends if both demons are killed, or 5 days pass. If both demons have been killed, good wins; if both demons are alive, evil wins; if one demon is dead and one is alive, the evil team wins if the boomdandy is alive and in the same town as the living mayor.',
	specters: 'Spectators share one ability and vote during the game on how it is used.',
	'infinite-possibilities':
		'Any script, with 1-4 hidden extra characters from off the script that only their players know about. The Storyteller may tell the table a range of how many custom characters are in play.'
};

/** Whether a built-in mode's description is the text Trevor approved. */
export function aboutApproved(modeId: string, about: string | undefined): boolean {
	return about !== undefined && APPROVED_ABOUT[modeId] === about;
}
