/**
 * Our rules blocks for official characters, one file per character (see
 * `../character-rules.ts`). A new file is one more import line here; a test checks that every
 * file in this folder is listed and agrees with `roles.json`.
 */
import type { CharacterId } from '../types.ts';
import { parseCharacterRules, type CharacterRules } from '../character-rules.ts';
import { Issues } from '../validate.ts';
import atheist from './atheist.json' with { type: 'json' };
import banshee from './banshee.json' with { type: 'json' };
import barber from './barber.json' with { type: 'json' };
import farmer from './farmer.json' with { type: 'json' };
import godfather from './godfather.json' with { type: 'json' };
import gossip from './gossip.json' with { type: 'json' };
import hatter from './hatter.json' with { type: 'json' };
import heretic from './heretic.json' with { type: 'json' };
import imp from './imp.json' with { type: 'json' };
import innkeeper from './innkeeper.json' with { type: 'json' };
import klutz from './klutz.json' with { type: 'json' };
import mayor from './mayor.json' with { type: 'json' };
import monk from './monk.json' with { type: 'json' };
import moonchild from './moonchild.json' with { type: 'json' };
import plaguedoctor from './plaguedoctor.json' with { type: 'json' };
import politician from './politician.json' with { type: 'json' };
import poppygrower from './poppygrower.json' with { type: 'json' };
import professor from './professor.json' with { type: 'json' };
import puzzlemaster from './puzzlemaster.json' with { type: 'json' };
import ravenkeeper from './ravenkeeper.json' with { type: 'json' };
import recluse from './recluse.json' with { type: 'json' };
import sage from './sage.json' with { type: 'json' };
import sailor from './sailor.json' with { type: 'json' };
import saint from './saint.json' with { type: 'json' };
import shabaloth from './shabaloth.json' with { type: 'json' };
import soldier from './soldier.json' with { type: 'json' };
import spy from './spy.json' with { type: 'json' };
import sweetheart from './sweetheart.json' with { type: 'json' };
import tealady from './tealady.json' with { type: 'json' };
import tinker from './tinker.json' with { type: 'json' };
import undertaker from './undertaker.json' with { type: 'json' };
import virgin from './virgin.json' with { type: 'json' };
import zombuul from './zombuul.json' with { type: 'json' };

const FILES: Readonly<Record<CharacterId, unknown>> = {
	atheist,
	banshee,
	barber,
	farmer,
	godfather,
	gossip,
	hatter,
	heretic,
	imp,
	innkeeper,
	klutz,
	mayor,
	monk,
	moonchild,
	plaguedoctor,
	politician,
	poppygrower,
	professor,
	puzzlemaster,
	ravenkeeper,
	recluse,
	sage,
	sailor,
	saint,
	shabaloth,
	soldier,
	spy,
	sweetheart,
	tealady,
	tinker,
	undertaker,
	virgin,
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
