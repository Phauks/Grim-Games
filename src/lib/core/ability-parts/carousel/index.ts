/**
 * SPIKE: Carousel characters as ability parts, one file per character.
 * TEMPORARY index: this batch holds the Carousel Demons only; the batches are merged later.
 */
import alhadikhia from './alhadikhia.json' with { type: 'json' };
import kazali from './kazali.json' with { type: 'json' };
import legion from './legion.json' with { type: 'json' };
import leviathan from './leviathan.json' with { type: 'json' };
import lilmonsta from './lilmonsta.json' with { type: 'json' };
import lleech from './lleech.json' with { type: 'json' };
import lordoftyphon from './lordoftyphon.json' with { type: 'json' };
import ojo from './ojo.json' with { type: 'json' };
import riot from './riot.json' with { type: 'json' };
import yaggababble from './yaggababble.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['alhadikhia', alhadikhia],
	['kazali', kazali],
	['legion', legion],
	['leviathan', leviathan],
	['lilmonsta', lilmonsta],
	['lleech', lleech],
	['lordoftyphon', lordoftyphon],
	['ojo', ojo],
	['riot', riot],
	['yaggababble', yaggababble]
]);
