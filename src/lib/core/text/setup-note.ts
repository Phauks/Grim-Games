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

/**
 * Splits a trailing "[...]" setup note off an ability. Brackets elsewhere stay in the text. A
 * note that only adds a character the ability already names ("+the King") is dropped.
 */
export function splitSetupNote(ability: string): SplitAbility {
	const match = /\s*\[([^[\]]+)\]\s*$/.exec(ability);
	if (!match) return { text: ability };
	const text = ability.slice(0, match.index);
	const setup = match[1]?.trim();
	if (!setup || !text) return { text: ability };
	// "+the Damsel" when the ability already names the Damsel adds nothing (Trevor, 2026-11-08).
	const needs = /^\+\s*(the\s+.+)$/i.exec(setup)?.[1];
	if (needs && text.toLowerCase().includes(needs.toLowerCase())) return { text };
	return { text, setup };
}
