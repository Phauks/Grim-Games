import type { CharacterId } from '#lib/core/data/index.ts';
import type { CharacterLookup } from '#lib/core/model/index.ts';

/** Which corner stack a rule character sits in. */
export type RuleKind = 'fabled' | 'loric';

export interface RuleStack {
	kind: RuleKind;
	/** The stack's name, as the game names the character type. */
	label: string;
	ids: CharacterId[];
}

const LABELS: Record<RuleKind, string> = { fabled: 'Fabled', loric: 'Loric' };

/**
 * The Fabled in one stack and the Loric in another, side by side in the board's corner
 * (Trevor, 2026-10-31: "stack lorics and fabled separately next to each other"), each in the
 * order they were added. An empty stack is left out.
 */
export function ruleStacks(ids: readonly CharacterId[], characters: CharacterLookup): RuleStack[] {
	const kinds: RuleKind[] = ['fabled', 'loric'];
	return kinds
		.map((kind) => ({
			kind,
			label: LABELS[kind],
			ids: ids.filter((id) => kindOf(id, characters) === kind)
		}))
		.filter((stack) => stack.ids.length > 0);
}

/** A rule character's stack; one that isn't a Loric goes with the Fabled. */
export function kindOf(id: CharacterId, characters: CharacterLookup): RuleKind {
	return characters.get(id)?.type === 'loric' ? 'loric' : 'fabled';
}
