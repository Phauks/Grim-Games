import {
	characterIcons,
	defaultAlignment,
	ICONS_PATH,
	type Alignment,
	type Character
} from '#lib/core/data/index.ts';

/**
 * A character's icon in the colour of an alignment: blue for good, red for evil. Pass the
 * alignment of the player whose character it is (Trevor, 2026-10-16: a reminder's icon shows
 * the alignment of the player who put it down, so a good character turned evil goes red).
 * Without one, the character type's starting alignment is used. Homebrew falls back to the
 * script's image.
 */
export function iconUrl(character: Character, alignment?: Alignment): string | undefined {
	const icons = characterIcons(character);
	if (!icons) return typeof character.image === 'string' ? character.image : character.image?.[0];
	const team = alignment ?? defaultAlignment(character.type);
	const file =
		(team === 'evil' ? icons.evil : team === 'good' ? icons.good : undefined) ??
		icons.unaligned ??
		icons.good;
	return file && `${ICONS_PATH}/${file}`;
}
