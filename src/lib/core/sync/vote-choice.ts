/**
 * A choice on the room vote's ballot (Trevor, 2026-11-03, plan M33: "you should be able to mix
 * a vote for a game mode, script, or special rule. for example, you may ask if they want tb +1
 * vs a custom vs sushi buffet"). Each choice has up to three parts, each optional: a script,
 * a game mode and any number of special rules (they stack). Ids are the Storyteller's own
 * (New game's script choices, mode and rule ids); phones only see the name built from them.
 */
export interface VoteChoice {
	script?: string;
	mode?: string;
	rules: string[];
}

/** The parts' display names, as the ballot lists them. */
export interface VoteChoiceNames {
	script?: string;
	mode?: string;
	rules: string[];
}

/** Between the parts of a choice's name (the middle dot is fine in text people see). */
export const CHOICE_SEPARATOR = ' · ';

/** A choice's name from its parts: game mode, then script, then each special rule. */
export function choiceLabel(names: VoteChoiceNames): string {
	return [names.mode, names.script, ...names.rules]
		.filter((part): part is string => !!part)
		.join(CHOICE_SEPARATOR);
}

/** A choice with nothing chosen can't go on the ballot. */
export function isEmptyChoice(choice: VoteChoice): boolean {
	return !choice.script && !choice.mode && choice.rules.length === 0;
}

/** Only special rules: the end of the vote keeps any number of them, since rules stack. */
export function isRulesOnly(choice: VoteChoice): boolean {
	return !choice.script && !choice.mode && choice.rules.length > 0;
}

/**
 * The option id the room keeps for a choice: the same parts give the same id, whatever order
 * the rules were switched on in, so one choice can't be on the ballot twice. It holds the
 * parts themselves, so Play still knows them after the vote screen was left and reopened.
 */
export function choiceId(choice: VoteChoice): string {
	const rules = [...new Set(choice.rules)].sort();
	return [
		choice.script ? `s=${encodeURIComponent(choice.script)}` : '',
		choice.mode ? `m=${encodeURIComponent(choice.mode)}` : '',
		rules.length ? `r=${rules.map(encodeURIComponent).join(',')}` : ''
	]
		.filter(Boolean)
		.join(';');
}

/** A choice back from its option id; `undefined` for an id from a vote before mixed choices. */
export function parseChoiceId(id: string): VoteChoice | undefined {
	const choice: VoteChoice = { rules: [] };
	try {
		for (const part of id.split(';')) {
			const [key, value = ''] = [part.slice(0, 2), part.slice(2)];
			if (!value) return undefined;
			if (key === 's=') choice.script = decodeURIComponent(value);
			else if (key === 'm=') choice.mode = decodeURIComponent(value);
			else if (key === 'r=') choice.rules = value.split(',').map(decodeURIComponent);
			else return undefined;
		}
	} catch {
		return undefined;
	}
	return isEmptyChoice(choice) ? undefined : choice;
}
