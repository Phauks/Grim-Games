import { INT, obj, T, TOKEN, variants } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * What one vote counts as, while the character's ability works: `weight` votes (negative
 * takes votes away) for the player carrying its `reminder`, or for its own player (`self`).
 * Two weights on one player multiply. The Thief's chosen player's vote counts negatively
 * (https://wiki.bloodontheclocktower.com/Thief), the Bureaucrat's counts as 3
 * (https://wiki.bloodontheclocktower.com/Bureaucrat), and the Ug hat's wearer votes twice
 * (https://wiki.bloodontheclocktower.com/God_of_Ug).
 */
export const voteWeight = specPart(
	'Vote weight',
	'What a vote counts as for the player carrying its reminder, or for its own player.',
	variants(
		{ label: 'Its reminder', has: 'reminder', spec: obj({ reminder: TOKEN, weight: INT }) },
		{ label: 'Its player', has: 'self', spec: obj({ self: T, weight: INT }) }
	),
	(value, path, issues) => {
		const before = issues.list.length;
		if (value.weight === 1) issues.add(`${path}.weight`, 'expected a whole number other than 1');
		if (!('reminder' in value) && !('self' in value)) issues.add(`${path}.self`, 'expected true');
		return issues.list.length > before ? undefined : value;
	}
);

export type VoteWeight = PartValue<typeof voteWeight>;
