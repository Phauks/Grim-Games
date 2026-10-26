import type { CombinedParts } from '#lib/core/modes/index.ts';
import {
	DJINN_THREE_ALIVE,
	DUPLICATE_DEMONS,
	INFINITE_NAMED,
	PLUS_ONE_NAMED
} from './rule-switches.ts';

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
		'Characters die as normal, but the Storyteller doesn’t announce deaths. Dead players can still nominate, and poisoned players don’t wake.',
	// Approved 2026-10-22 ("other special rules are approved"), after he read the rule files.
	'binary-supernovae':
		'One extra Demon is in play. Good wins as soon as any Demon dies by execution; a Demon killed any other way doesn’t end the game.',
	'trained-killer':
		'The Demon doesn’t choose who to attack. Each night after the first, it attacks the next living in-play character in script order.',
	'phantom-detectives':
		'Townsfolk have no ability while alive and gain it when they die. Every other dead player keeps their ability, except the Demon.',
	// Trevor's own wording, 2026-10-22.
	'plus-one':
		'1 Character not on the script is added to the bag. This character may or may not be announced.',
	'council-of-the-dead':
		'On night 4 the dead wake together for 2 minutes, then secretly vote for a living player, who receives a boon.',
	// Approved 2026-10-23 ("instructions and about are fine").
	warrens:
		'While 5 or more players are alive, an evil player who nominates another living evil player swaps characters with them at once. Travellers are left out.',
	'djinns-bargain':
		'A player who nominates may choose to die. If they do, the player they nominated has their ability work twice until dusk the next day.',
	// Trevor's own wording, 2026-10-24.
	'duplicate-characters': 'There can be multiple copies of characters in the bag.',
	// Approved 2026-10-24 ("Approved"), after reading the drafts in the World Cup thread.
	'flesh-and-bone':
		'A campaign of games with the Flesh and Bone Fabled. Characters executed in one game are out for the rest of the campaign and replaced on the next script.',
	'two-games-at-once':
		'The same players play two scripts at the same time, with a character in each game. No one may be the Demon in both.',
	'whale-buffet':
		'Every character is on the script. Each player draws only a character type, then chooses any character of that type to play.'
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
const DJINN_BARGAIN =
	'A player may say, as they nominate, that they choose to die. Don’t ask them; once the nomination is made, the chance has passed. If they do, they die at once, and you announce it. Until dusk the next day, the nominee’s ability works twice: each time it takes effect, resolve it twice, one choice at a time. A once per game ability that was already used stays used.';

export const APPROVED_INSTRUCTIONS: Readonly<Record<string, string | readonly string[]>> = {
	'flesh-and-bone:parts.forced':
		'Put the Flesh and Bone Fabled in play. It is homebrew, so its ability is on its own page, not in the app.',
	'flesh-and-bone:parts.ruleChanges[0]':
		'The Choirboy and Huntsman work differently once the King or Damsel is out of the campaign. The rules page says how.',
	'sushi-buffet:parts.bluffs': 'The Demon receives no bluffs.',
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
		'One seat is dealt a character as usual, but no one plays it. Make its choices arbitrarily. Once per game you may speak for it.',
	// Approved 2026-10-22 ("other special rules are approved"), after he read the rule files.
	'binary-supernovae:parts.winConditions':
		'Good wins as soon as any Demon dies by execution, unless an ability such as the Mastermind’s keeps the game going. A Demon killed by an ability doesn’t end it.',
	'binary-supernovae:parts.ruleChanges[0]':
		'The Summoner removes only 1 Demon at setup, so 1 Demon starts in play. Before the game, say whether the Summoner may make a second copy of that Demon.',
	'trained-killer:parts.demonAttacks':
		'Each night after the first, the Demon attacks the next living in-play character in script order, carrying on from the last one it killed. You decide whether a survivor is attacked again or passed over.',
	'phantom-detectives:parts.abilities':
		'Living Townsfolk don’t wake and have no ability; setup effects still happen. A Townsfolk who dies gains its ability and wakes at its usual place. Other dead players keep waking, except a dead Demon.',
	'council-of-the-dead:parts.nightSteps[0]':
		'At the start of night 4, wake the dead together for 2 minutes. Then each secretly votes for a living player. If no player has a majority, you choose. Give the chosen player a helpful effect of your choice.',
	// Trevor's own two wordings (2026-10-22), one per setting of +1's switch (rule-switches.ts).
	'plus-one:parts.information[0]': [
		'Tell the table that one character from off the script is in play.',
		PLUS_ONE_NAMED
	],
	// Approved 2026-10-23 (decision card): the same switch's text for Infinite Possibilities.
	'infinite-possibilities:parts.information[0]': INFINITE_NAMED,
	// Approved 2026-10-23 ("instructions and about are fine"); the Djinn's Bargain's second text
	// is with its 3-player switch on (rule-switches.ts).
	'warrens:parts.ruleChanges[0]':
		'While 5 or more players are alive, when an evil player nominates another living evil player, and neither is a Traveller, swap their character tokens straight away. Each learns their new character when they next wake at night.',
	'djinns-bargain:parts.ruleChanges[0]': [DJINN_BARGAIN, `${DJINN_BARGAIN} ${DJINN_THREE_ALIVE}`],
	// Approved 2026-10-26 (decision card); the second is with the Duplicate Demons switch on.
	'duplicate-characters:parts.duplicates': [
		'You may put more than one copy of any character but a Demon in the bag.',
		DUPLICATE_DEMONS
	]
};

/** Whether a built-in instruction is text Trevor approved for that part. */
export function instructionApproved(key: string, text: unknown): boolean {
	const approved = APPROVED_INSTRUCTIONS[key];
	return typeof approved === 'string' ? approved === text : !!approved?.includes(text as string);
}

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
		return instructionApproved(`${modeId}:${path}`, instructions) ? item : rest;
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
