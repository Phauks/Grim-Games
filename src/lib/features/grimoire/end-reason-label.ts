/** How a game ended, in words: End game's choices and the recap. */
/* eslint-disable grim/names-as-badges -- a Select option's accessible name and the saved recap's text; End game shows the badge */
import type { CharacterLookup } from '#lib/core/model/index.ts';
import { endReasonCharacter, type EndReason } from '#lib/core/rules/index.ts';

const LABELS = { 'demon-dead': 'Demon died', 'two-alive': '2 alive', other: 'Other' } as const;

export function endReasonLabel(reason: EndReason, characters: CharacterLookup): string {
	const id = endReasonCharacter(reason);
	if (id) return characters.get(id)?.name ?? id;
	return LABELS[reason as keyof typeof LABELS];
}
