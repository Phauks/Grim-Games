import { readAfterDeath } from '../after-death-rules.ts';
import { objectPart } from './part.ts';

/**
 * What its player may still do once dead, when the death's `cause` is one of these ('demon'
 * also matches any Demon's id; an unrecorded cause counts): nominate `nominations` times a
 * day, and vote `votes` times on every nomination without a vote token. Dead players may not
 * nominate otherwise and have one ghost vote (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination", "Dead Player"); the Banshee killed by the Demon nominates and votes twice
 * (https://wiki.bloodontheclocktower.com/Banshee).
 */
export const afterDeath = objectPart(
	'What its dead player may still do',
	'How many times its player may still nominate and vote once dead, by cause of death.',
	readAfterDeath
);
