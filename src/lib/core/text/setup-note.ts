/**
 * A character's ability can end with a setup note in square brackets, such as "[+2 Outsiders]",
 * which changes the game's setup rather than what the character does in play. Character rows
 * draw it on its own line (Trevor, 2026-11-06), so it is split off here.
 */
export interface SplitAbility {
	/** The ability without its setup note. */
	text: string;
	/** The setup note without its brackets, when there is one. */
	setup?: string;
}

/** Splits a trailing "[...]" setup note off an ability. Brackets elsewhere stay in the text. */
export function splitSetupNote(ability: string): SplitAbility {
	const match = /\s*\[([^[\]]+)\]\s*$/.exec(ability);
	if (!match) return { text: ability };
	const text = ability.slice(0, match.index);
	const setup = match[1]?.trim();
	return setup && text ? { text, setup } : { text: ability };
}
