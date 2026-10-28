/**
 * SPIKE: Carousel characters as ability parts, one file per character.
 * TEMPORARY index: this batch holds only the Outsiders and Travellers.
 */
import cacklejack from './cacklejack.json' with { type: 'json' };
import damsel from './damsel.json' with { type: 'json' };
import gangster from './gangster.json' with { type: 'json' };
import gnome from './gnome.json' with { type: 'json' };
import golem from './golem.json' with { type: 'json' };
import hatter from './hatter.json' with { type: 'json' };
import heretic from './heretic.json' with { type: 'json' };
import hermit from './hermit.json' with { type: 'json' };
import ogre from './ogre.json' with { type: 'json' };
import plaguedoctor from './plaguedoctor.json' with { type: 'json' };
import politician from './politician.json' with { type: 'json' };
import puzzlemaster from './puzzlemaster.json' with { type: 'json' };
import snitch from './snitch.json' with { type: 'json' };
import zealot from './zealot.json' with { type: 'json' };

export const CAROUSEL_PARTS: ReadonlyMap<string, unknown> = new Map<string, unknown>([
	['cacklejack', cacklejack],
	['damsel', damsel],
	['gangster', gangster],
	['gnome', gnome],
	['golem', golem],
	['hatter', hatter],
	['heretic', heretic],
	['hermit', hermit],
	['ogre', ogre],
	['plaguedoctor', plaguedoctor],
	['politician', politician],
	['puzzlemaster', puzzlemaster],
	['snitch', snitch],
	['zealot', zealot]
]);
