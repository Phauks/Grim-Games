import { COUNT, obj, opt, STRS } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * What its player may still do once dead, when the death's `cause` is one of these ('demon'
 * also matches any Demon's id; an unrecorded cause counts): nominate `nominations` times a
 * day, and vote `votes` times on every nomination without a vote token. Dead players may not
 * nominate otherwise and have one ghost vote (https://wiki.bloodontheclocktower.com/Glossary,
 * "Nomination", "Dead Player"); the Banshee killed by the Demon nominates and votes twice
 * (https://wiki.bloodontheclocktower.com/Banshee).
 */
export const afterDeath = specPart(
	'deaths',
	'What its dead player may still do',
	'How many times its player may still nominate and vote once dead, by cause of death.',
	// `cause`: death causes or character ids; `nominations`: a day (the living make one, the dead
	// none); `votes`: on every nomination, needing no vote token.
	obj({ cause: STRS, nominations: opt(COUNT), votes: opt(COUNT) }),
	(value, path, issues) => {
		if (value.cause.length === 0 || value.cause.includes('')) {
			issues.add(`${path}.cause`, 'expected a list of death causes or character ids');
			return undefined;
		}
		if (value.nominations !== undefined || value.votes !== undefined) return value;
		issues.add(path, 'expected nominations or votes');
		return undefined;
	}
);

export type AfterDeath = PartValue<typeof afterDeath>;
