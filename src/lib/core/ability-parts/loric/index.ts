/** SPIKE: the Loric as ability parts, one file per character. Rule characters: no player has them. */
import bigwig from './bigwig.json' with { type: 'json' };
import bootlegger from './bootlegger.json' with { type: 'json' };
import gardener from './gardener.json' with { type: 'json' };
import godofug from './godofug.json' with { type: 'json' };
import hindu from './hindu.json' with { type: 'json' };
import knaves from './knaves.json' with { type: 'json' };
import pope from './pope.json' with { type: 'json' };
import stormcatcher from './stormcatcher.json' with { type: 'json' };
import tor from './tor.json' with { type: 'json' };
import ventriloquist from './ventriloquist.json' with { type: 'json' };
import zenomancer from './zenomancer.json' with { type: 'json' };

export const LORIC_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['bigwig', bigwig],
	['bootlegger', bootlegger],
	['gardener', gardener],
	['godofug', godofug],
	['hindu', hindu],
	['knaves', knaves],
	['pope', pope],
	['stormcatcher', stormcatcher],
	['tor', tor],
	['ventriloquist', ventriloquist],
	['zenomancer', zenomancer]
]);
