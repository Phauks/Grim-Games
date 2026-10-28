/**
 * SPIKE (temporary, one batch of several): the Carousel Minions as ability parts, one
 * file per character. The other Carousel characters are written in other batches.
 */
import boffin from './boffin.json' with { type: 'json' };
import boomdandy from './boomdandy.json' with { type: 'json' };
import fearmonger from './fearmonger.json' with { type: 'json' };
import goblin from './goblin.json' with { type: 'json' };
import harpy from './harpy.json' with { type: 'json' };
import marionette from './marionette.json' with { type: 'json' };
import mezepheles from './mezepheles.json' with { type: 'json' };
import organgrinder from './organgrinder.json' with { type: 'json' };
import psychopath from './psychopath.json' with { type: 'json' };
import summoner from './summoner.json' with { type: 'json' };
import vizier from './vizier.json' with { type: 'json' };
import widow from './widow.json' with { type: 'json' };
import wizard from './wizard.json' with { type: 'json' };
import wraith from './wraith.json' with { type: 'json' };
import xaan from './xaan.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['boffin', boffin],
	['boomdandy', boomdandy],
	['fearmonger', fearmonger],
	['goblin', goblin],
	['harpy', harpy],
	['marionette', marionette],
	['mezepheles', mezepheles],
	['organgrinder', organgrinder],
	['psychopath', psychopath],
	['summoner', summoner],
	['vizier', vizier],
	['widow', widow],
	['wizard', wizard],
	['wraith', wraith],
	['xaan', xaan]
]);
