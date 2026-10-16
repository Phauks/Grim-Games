/**
 * How many characters a card asks for. "These characters are not in play" goes with the 3
 * bluffs; "This player is" may name several, such as the Dreamer's good and evil pair
 * (Trevor, 2026-10-16); the rest name one.
 */
const PICK_MAX: Readonly<Record<string, number>> = { 'not-in-play': 3, 'this-player-is': 3 };

export function pickMax(tokenId: string): number {
	// The Storyteller's own cards may show up to 3, like the standard ones.
	if (tokenId.startsWith('custom-')) return 3;
	return PICK_MAX[tokenId] ?? 1;
}
