import { obj, opt, STR, TOKEN } from '../field-spec.ts';
import { specPart, partWords } from './part.ts';

/**
 * Each evil player learns who carries its `carrier` reminder: shown "This player is" with
 * that player's character, pointing at them; with no one marked, "These characters are not
 * in play" with the character named (the Storm Catcher's Stormcaught,
 * https://wiki.bloodontheclocktower.com/Storm_Catcher). `named`: the key of its prep value
 * (`setupPrep` note `value`) holding the character named, saved even when not in play.
 */
export const evilLearns = partWords(
	specPart(
		'night',
		'Evil learns',
		'Each evil player learns who carries its reminder.',
		obj({ carrier: TOKEN, named: opt(STR) })
	),
	{
		carrier: {
			label: 'Reminder',
			about: 'Each evil player learns who carries it.'
		},
		named: {
			label: 'Prep value',
			about: 'The name of the prep value holding the character named.'
		}
	}
);
