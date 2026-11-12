/**
 * SPIKE: Trouble Brewing (and its five Travellers) as ability parts, one file per character,
 * and five jinxes that touch them as patches. Nothing in the app imports this yet.
 */
import type { AbilityParts, JinxParts } from '../types.ts';
import washerwoman from './washerwoman.json' with { type: 'json' };
import librarian from './librarian.json' with { type: 'json' };
import investigator from './investigator.json' with { type: 'json' };
import chef from './chef.json' with { type: 'json' };
import empath from './empath.json' with { type: 'json' };
import fortuneteller from './fortuneteller.json' with { type: 'json' };
import undertaker from './undertaker.json' with { type: 'json' };
import monk from './monk.json' with { type: 'json' };
import ravenkeeper from './ravenkeeper.json' with { type: 'json' };
import virgin from './virgin.json' with { type: 'json' };
import slayer from './slayer.json' with { type: 'json' };
import soldier from './soldier.json' with { type: 'json' };
import mayor from './mayor.json' with { type: 'json' };
import butler from './butler.json' with { type: 'json' };
import drunk from './drunk.json' with { type: 'json' };
import recluse from './recluse.json' with { type: 'json' };
import saint from './saint.json' with { type: 'json' };
import poisoner from './poisoner.json' with { type: 'json' };
import spy from './spy.json' with { type: 'json' };
import scarletwoman from './scarletwoman.json' with { type: 'json' };
import baron from './baron.json' with { type: 'json' };
import imp from './imp.json' with { type: 'json' };
import thief from './thief.json' with { type: 'json' };
import bureaucrat from './bureaucrat.json' with { type: 'json' };
import gunslinger from './gunslinger.json' with { type: 'json' };
import beggar from './beggar.json' with { type: 'json' };
import scapegoat from './scapegoat.json' with { type: 'json' };
import heretic__baron from '../jinxes/heretic__baron.json' with { type: 'json' };
import leviathan__soldier from '../jinxes/leviathan__soldier.json' with { type: 'json' };
import spy__poppygrower from '../jinxes/spy__poppygrower.json' with { type: 'json' };
import spy__damsel from '../jinxes/spy__damsel.json' with { type: 'json' };
import lleech__slayer from '../jinxes/lleech__slayer.json' with { type: 'json' };

export const TROUBLE_BREWING_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['washerwoman', washerwoman],
	['librarian', librarian],
	['investigator', investigator],
	['chef', chef],
	['empath', empath],
	['fortuneteller', fortuneteller],
	['undertaker', undertaker],
	['monk', monk],
	['ravenkeeper', ravenkeeper],
	['virgin', virgin],
	['slayer', slayer],
	['soldier', soldier],
	['mayor', mayor],
	['butler', butler],
	['drunk', drunk],
	['recluse', recluse],
	['saint', saint],
	['poisoner', poisoner],
	['spy', spy],
	['scarletwoman', scarletwoman],
	['baron', baron],
	['imp', imp],
	['thief', thief],
	['bureaucrat', bureaucrat],
	['gunslinger', gunslinger],
	['beggar', beggar],
	['scapegoat', scapegoat]
]);

/** Read through `readAbilityParts` before use; typed here only for the jinx examples. */
export const TROUBLE_BREWING_JINXES = [
	heretic__baron,
	leviathan__soldier,
	spy__poppygrower,
	spy__damsel,
	lleech__slayer
] as unknown as JinxParts[];

export type { AbilityParts };
