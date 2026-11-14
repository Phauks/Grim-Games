import type { Relation } from './friend-rules.ts';

/** Two people with no link at all. */
export const NO_RELATION: Relation = {
	friend: false,
	incoming: false,
	outgoing: false,
	blocked: false
};
