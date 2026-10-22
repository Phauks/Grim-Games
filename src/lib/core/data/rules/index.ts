/**
 * Our rules blocks for official characters, one file per character (see
 * `../character-rules.ts`). A new file is one more import line here; a test checks that every
 * file in this folder is listed and agrees with `roles.json`.
 */
import type { CharacterId } from '../types.ts';
import { parseCharacterRules, type CharacterRules } from '../character-rules.ts';
import { Issues } from '../validate.ts';
import godfather from './godfather.json' with { type: 'json' };
import gossip from './gossip.json' with { type: 'json' };
import imp from './imp.json' with { type: 'json' };
import professor from './professor.json' with { type: 'json' };
import shabaloth from './shabaloth.json' with { type: 'json' };
import tinker from './tinker.json' with { type: 'json' };
import undertaker from './undertaker.json' with { type: 'json' };
import zombuul from './zombuul.json' with { type: 'json' };

const FILES: Readonly<Record<CharacterId, unknown>> = {
	godfather,
	gossip,
	imp,
	professor,
	shabaloth,
	tinker,
	undertaker,
	zombuul
};

function load(): ReadonlyMap<CharacterId, CharacterRules> {
	const issues = new Issues();
	const out = new Map<CharacterId, CharacterRules>();
	for (const [id, raw] of Object.entries(FILES)) {
		const rules = parseCharacterRules(raw, `rules/${id}.json`, issues);
		if (rules) out.set(id, rules);
	}
	issues.throwIfAny('character rules');
	return out;
}

/** Each official character's rules block, by id; characters with no file have none. */
export const OFFICIAL_RULES: ReadonlyMap<CharacterId, CharacterRules> = load();

/**
 * A character's rules block: a custom character's own `rules`, else our overlay file. A custom
 * character that reuses an official id without `rules` keeps the official block.
 */
export function rulesOf(
	characterId: CharacterId,
	characters?: ReadonlyMap<CharacterId, { rules?: CharacterRules }>
): CharacterRules | undefined {
	return characters?.get(characterId)?.rules ?? OFFICIAL_RULES.get(characterId);
}
