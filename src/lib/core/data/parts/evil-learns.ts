import { obj, opt, STR, TOKEN } from '../field-spec.ts';
import { specPart } from './part.ts';

/**
 * Each evil player learns who carries its `carrier` reminder: shown "This player is" with
 * that player's character, pointing at them; with no one marked, "These characters are not
 * in play" with the character named (the Storm Catcher's Stormcaught,
 * https://wiki.bloodontheclocktower.com/Storm_Catcher). `named`: the key of its prep value
 * (`setupPrep` note `value`) holding the character named, saved even when not in play.
 */
export const evilLearns = specPart(
	'Evil learns',
	'Each evil player learns who carries its reminder.',
	obj({ carrier: TOKEN, named: opt(STR) })
);
