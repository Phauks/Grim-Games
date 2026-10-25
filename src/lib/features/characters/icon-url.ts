import {
	characterIcons,
	defaultAlignment,
	genericIcons,
	homebrewImage,
	ICONS_PATH,
	type Alignment,
	type Character
} from '#lib/core/data/index.ts';

/**
 * A character's icon in the colour of an alignment: blue for good, red for evil. Pass the
 * alignment of the player whose character it is (Trevor, 2026-10-16: a reminder's icon shows
 * the alignment of the player who put it down, so a good character turned evil goes red).
 * Without one, the character type's starting alignment is used. Homebrew uses the script's
 * own images (the second as its flipped-alignment icon), or TPI's generic icon for its type
 * when it has none.
 */
export function iconUrl(character: Character, alignment?: Alignment): string | undefined {
	const usual = defaultAlignment(character.type);
	const team = alignment ?? usual;
	if (!character.edition) {
		const own = homebrewImage(
			character.image,
			character.type,
			team,
			alignment !== undefined && usual !== undefined && alignment !== usual
		);
		if (own) return own;
	}
	return tpiIcon(character, team);
}

/**
 * A reminder token's owner icon, always in its owner's alignment (Trevor, 2026-10-23: no
 * setting): the placing player's, else the character's usual one.
 */
export function reminderIconUrl(
	character: Character,
	alignment: Alignment | undefined
): string | undefined {
	return iconUrl(character, alignment);
}

/**
 * What to show instead when a homebrew character's own image fails to load (a dead link, or
 * offline): TPI's generic icon for its type, as when it has no image (Trevor, 2026-10-19).
 * Undefined for official characters, whose icons ship with the app.
 */
export function fallbackIconUrl(character: Character, alignment?: Alignment): string | undefined {
	if (character.edition) return undefined;
	return tpiIcon(character, alignment ?? defaultAlignment(character.type));
}

function tpiIcon(character: Character, team: Alignment | undefined): string | undefined {
	const icons = characterIcons(character) ?? genericIcons(character.type);
	const file =
		(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
		icons.unaligned ??
		icons.good;
	return file && `${ICONS_PATH}/${file}`;
}
