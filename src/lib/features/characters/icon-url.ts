import {
	characterIcons,
	defaultAlignment,
	genericIcons,
	homebrewImage,
	ICONS_PATH,
	type Alignment,
	type Character,
	type CharacterIcons
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
 * What to show instead when a character's icon fails to load (a dead link, a host that refuses
 * us, or offline): TPI's generic icon for its type, as when a homebrew character has no image
 * (Trevor, 2026-10-19). Official characters get it too, so a token never shows a broken image.
 */
export function fallbackIconUrl(character: Character, alignment?: Alignment): string | undefined {
	return iconFile(genericIcons(character.type), alignment ?? defaultAlignment(character.type));
}

function tpiIcon(character: Character, team: Alignment | undefined): string | undefined {
	return iconFile(characterIcons(character) ?? genericIcons(character.type), team);
}

function iconFile(icons: CharacterIcons, team: Alignment | undefined): string | undefined {
	const file =
		(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
		icons.unaligned ??
		icons.good;
	return file && `${ICONS_PATH}/${file}`;
}
