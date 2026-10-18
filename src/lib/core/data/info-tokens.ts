/**
 * Info tokens: the rectangular cards the Storyteller shows players at night ("This is the
 * Demon" and so on). They belong to the game, not to any character (Trevor, 2026-10-15).
 *
 * Sources: the wiki Glossary names them "Info tokens" with "This is the Demon" as its
 * example (https://wiki.bloodontheclocktower.com/Glossary); the rulebook names "This is
 * the Demon", "These characters are not in play" and "You are". The remaining entries are
 * the cards Storytellers commonly use; Trevor reviews the list.
 */
/**
 * What the Storyteller fills in each time a card is shown (Trevor, 2026-10-18): words, a
 * number, or one of a set list of answers.
 */
export type InfoTokenValue =
	| { kind: 'text' }
	| { kind: 'number'; min?: number; max?: number }
	| { kind: 'choices'; options: readonly string[] };

/**
 * What a card asks for when shown, beyond the Storyteller pointing at a player. Shown on
 * its tile before it is tapped, and set per card on the Storyteller's own (Trevor, 2026-10-18).
 */
export interface InfoTokenAsks {
	/** Up to this many characters are shown with it. */
	characters?: number;
	value?: InfoTokenValue;
}

export interface InfoToken {
	id: string;
	text: string;
	/** Built in (cannot be deleted, only hidden) or made by the Storyteller. */
	source: 'standard' | 'custom';
	/** What it asks for when shown; nothing when absent. */
	asks?: InfoTokenAsks;
	/** Only what was filled in is shown, without the card's own words (Yes/No). */
	answerOnly?: true;
	/** Not one of the base game's cards: Trevor's own additions (2026-10-18), marked apart. */
	extra?: true;
}

/** The most characters a card can ask for: the Demon's three bluffs, with room to spare. */
export const MAX_ASKED_CHARACTERS = 6;

export const STANDARD_INFO_TOKENS: readonly InfoToken[] = [
	{ id: 'this-is-the-demon', text: 'This is the Demon', source: 'standard' },
	{ id: 'these-are-your-minions', text: 'These are your Minions', source: 'standard' },
	// The Demon's three bluffs (https://wiki.bloodontheclocktower.com/Demon).
	{
		id: 'not-in-play',
		text: 'These characters are not in play',
		source: 'standard',
		asks: { characters: 3 }
	},
	{ id: 'you-are', text: 'You are', source: 'standard', asks: { characters: 1 } },
	// May name several, such as the Dreamer's good and evil pair (Trevor, 2026-10-16).
	{ id: 'this-player-is', text: 'This player is', source: 'standard', asks: { characters: 3 } },
	{
		id: 'selected-you',
		text: 'This character selected you',
		source: 'standard',
		asks: { characters: 1 }
	},
	{ id: 'did-you-nominate', text: 'Did you nominate today?', source: 'standard' },
	{ id: 'did-you-vote', text: 'Did you vote today?', source: 'standard' },
	// Trevor's own additions and wording (2026-10-18), listed apart from the base game's.
	// A number instead of fingers, and Yes or No, chosen when shown (Trevor, 2026-10-18).
	{
		id: 'number',
		text: 'Your number is',
		source: 'standard',
		asks: { value: { kind: 'number', min: 0 } },
		extra: true
	},
	{
		id: 'yes-no',
		text: 'Yes/No',
		source: 'standard',
		asks: { value: { kind: 'choices', options: ['Yes', 'No'] } },
		answerOnly: true,
		extra: true
	},
	// True or False, chosen when shown, like Yes/No (Trevor, 2026-10-18).
	{
		id: 'true-false',
		text: 'True/False',
		source: 'standard',
		asks: { value: { kind: 'choices', options: ['True', 'False'] } },
		answerOnly: true,
		extra: true
	},
	{ id: 'what-are-you-bluffing', text: 'What are you bluffing?', source: 'standard', extra: true },
	{ id: 'use-your-ability', text: 'Use your ability?', source: 'standard', extra: true },
	{ id: 'choose-again', text: 'Please choose again', source: 'standard', extra: true }
];

/** The standard list with the Storyteller's hidden ones removed and custom ones added. */
export function infoTokens(
	custom: readonly InfoToken[] = [],
	hidden: readonly string[] = []
): InfoToken[] {
	return [...STANDARD_INFO_TOKENS.filter((t) => !hidden.includes(t.id)), ...custom];
}
