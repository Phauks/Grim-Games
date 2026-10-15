/**
 * Info tokens: the rectangular cards the Storyteller shows players at night ("This is the
 * Demon" and so on). They belong to the game, not to any character (Trevor, 2026-10-15).
 *
 * Sources: the wiki Glossary names them "Info tokens" with "This is the Demon" as its
 * example (https://wiki.bloodontheclocktower.com/Glossary); the rulebook names "This is
 * the Demon", "These characters are not in play" and "You are". The remaining entries are
 * the cards Storytellers commonly use; Trevor reviews the list.
 */
export interface InfoToken {
	id: string;
	text: string;
	/** Built in (cannot be deleted, only hidden) or made by the Storyteller. */
	source: 'standard' | 'custom';
	/** Shown to a player alongside: character tokens, a player, or nothing. */
	shows?: 'characters' | 'player' | 'none';
}

export const STANDARD_INFO_TOKENS: readonly InfoToken[] = [
	{ id: 'this-is-the-demon', text: 'This is the Demon', source: 'standard', shows: 'player' },
	{
		id: 'these-are-your-minions',
		text: 'These are your Minions',
		source: 'standard',
		shows: 'player'
	},
	{
		id: 'not-in-play',
		text: 'These characters are not in play',
		source: 'standard',
		shows: 'characters'
	},
	{ id: 'you-are', text: 'You are', source: 'standard', shows: 'characters' },
	{ id: 'this-player-is', text: 'This player is', source: 'standard', shows: 'characters' },
	{
		id: 'selected-you',
		text: 'This character selected you',
		source: 'standard',
		shows: 'characters'
	},
	{ id: 'did-you-nominate', text: 'Did you nominate today?', source: 'standard', shows: 'none' },
	{ id: 'did-you-vote', text: 'Did you vote today?', source: 'standard', shows: 'none' }
];

/** The standard list with the Storyteller's hidden ones removed and custom ones added. */
export function infoTokens(
	custom: readonly InfoToken[] = [],
	hidden: readonly string[] = []
): InfoToken[] {
	return [...STANDARD_INFO_TOKENS.filter((t) => !hidden.includes(t.id)), ...custom];
}
