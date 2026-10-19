import type { CombinedParts } from '#lib/core/modes/index.ts';

/**
 * Built-in mode and special rule descriptions Trevor has approved (2026-10-18: "You write game mode
 * descriptions, but I will verify them"). Each entry is the exact text he approved, so a
 * description shows to everyone only while it still matches; any later edit hides it behind
 * our own wording setting again until he approves the new text.
 */
export const APPROVED_ABOUT: Readonly<Record<string, string>> = {
	// Trevor's own wording, 2026-10-19.
	standard: 'Normal rules for Blood on the Clocktower',
	// Trevor's own wording, 2026-10-18.
	'sushi-buffet':
		'Each Player can select from three drafted characters, players can select their character, or mulligan into a new set of two drafted characters, where they once again can select their character, or mulligan into the final character. The demon gets no bluffs.',
	'two-towns-and-a-boomdandy':
		'Two towns play side by side, each with its own Storyteller and script. Each day some players move to the other town. The game ends if both demons are killed, or 5 days pass. If both demons have been killed, good wins; if both demons are alive, evil wins; if one demon is dead and one is alive, the evil team wins if the boomdandy is alive and in the same town as the living mayor.',
	specters: 'Spectators share one ability and vote during the game on how it is used.',
	'infinite-possibilities':
		'Any script, with 1-4 hidden extra characters from off the script that only their players know about. The Storyteller may tell the table a range of how many custom characters are in play.',
	// Approved 2026-10-19 ("rule descriptions were approved").
	'seat-7':
		'One seat is dealt a character as usual, but no one plays it. Its choices are arbitrary, and once per game the Storyteller may speak for it.',
	'stowed-away':
		'Up to 2 Travellers may be in the bag, with the other counts set for that many fewer players. No one is told who the Travellers are, and exiling one counts as an execution.',
	'i-see-dead-people':
		'Characters die as normal, but the Storyteller doesn’t announce deaths. Dead players can still nominate, and poisoned players don’t wake.'
};

/** Whether a built-in mode's description is the text Trevor approved. */
export function aboutApproved(modeId: string, about: string | undefined): boolean {
	return about !== undefined && APPROVED_ABOUT[modeId] === about;
}

/**
 * Built-in Storyteller instructions Trevor has approved, by mode or rule id and the part's
 * path (`whale-buffet:parts.ruleChanges[0]`), each the exact text, as descriptions are.
 * Trevor reviewed the drafts of 2026-10-19 (game-modes/storyteller-instructions.md in the
 * project files) and sent them back the same day, rewording some. The two lines he took out
 * (Whale Buffet's information, Infinite Possibilities' rule change) stay hidden.
 */
export const APPROVED_INSTRUCTIONS: Readonly<Record<string, string>> = {
	'flesh-and-bone:parts.forced':
		'Put the Flesh and Bone Fabled in play. It is homebrew, so its ability is on its own page, not in the app.',
	'flesh-and-bone:parts.ruleChanges[0]':
		'The Choirboy and Huntsman work differently once the King or Damsel is out of the campaign. The rules page says how.',
	'sushi-buffet:parts.bluffs': 'The Demon receives no bluffs.',
	'sushi-buffet:parts.setupModifiers':
		'Drafted characters never change the counts: the draft keeps the setup sheet’s counts for the player count, so a Baron adds no Outsiders.',
	'sushi-buffet:parts.assignment':
		'Each player is offered 3 characters, of any types, and keeps one, or refuses them for 2 new ones, then for a last one. Characters not selected may be recycled; that is the Storyteller’s choice.',
	'two-towns-and-a-boomdandy:parts.ruleChanges[0]':
		'If the Leviathan and the Mayor are alive on day 5 and no execution occurs, good wins.',
	'two-towns-and-a-boomdandy:parts.information[0]':
		'When evil outnumber the living good in a town, a good player in that town learns it.',
	'two-towns-and-a-boomdandy:parts.daySteps[0]':
		'Each day the town nominates a representative, who decides which players to send to the other town: 3 after day 1, 2 after days 2 and 3, and 1 after days 4 and 5.',
	'two-towns-and-a-boomdandy:parts.winConditions':
		'The game ends when both Demons are dead, and good wins, or after day 5. Then evil wins if both Demons are alive, or if one is and the living Boomdandy is in the same town as the living Mayor; otherwise good wins.',
	'whale-buffet:parts.setupModifiers':
		'Only the Bounty Hunter’s setup effect applies; for example, a Baron adds no Outsiders.',
	'whale-buffet:parts.assignment':
		'The bag deals each player only a character type. On the first night each player chooses a character of that type. You may ask a player to reconsider their choice.',
	'whale-buffet:parts.duplicates':
		'Players may choose the same character. You may make the extra copies drunk.',
	'whale-buffet:parts.bluffs': 'The Demon receives no bluffs.',
	'i-see-dead-people:parts.deaths':
		'Don’t announce who has died. Dead players can still nominate. Poisoned players don’t wake at night.',
	'stowed-away:parts.travellers':
		'Put up to 2 Travellers in the bag, and set the player count for that many fewer players. Don’t announce who the Travellers are. Exiling a Traveller counts as an execution.',
	'seat-7:parts.seats':
		'One seat is dealt a character as usual, but no one plays it. Make its choices arbitrarily. Once per game you may speak for it.'
};

/**
 * A mode's parts as Inspect shows them: Storyteller instructions Trevor hasn't approved are
 * left out (the whole file still has them). `ownWording` shows every one.
 */
export function shownParts(
	modeId: string,
	parts: CombinedParts,
	ownWording: boolean
): CombinedParts {
	if (ownWording) return parts;
	const shown = (path: string, item: unknown): unknown => {
		if (typeof item !== 'object' || item === null || !('instructions' in item)) return item;
		const { instructions, ...rest } = item as { instructions: unknown };
		return APPROVED_INSTRUCTIONS[`${modeId}:${path}`] === instructions ? item : rest;
	};
	return Object.fromEntries(
		Object.entries(parts).map(([part, value]) => [
			part,
			Array.isArray(value)
				? value.map((item, i) => shown(`parts.${part}[${i}]`, item))
				: shown(`parts.${part}`, value)
		])
	) as CombinedParts;
}
