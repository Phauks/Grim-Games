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
	const icons = characterIcons(character) ?? genericIcons(character.type);
	const file =
		(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
		icons.unaligned ??
		icons.good;
	return file && `${ICONS_PATH}/${file}`;
}
