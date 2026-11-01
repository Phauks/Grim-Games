import { tokenPart } from './part.ts';

/**
 * Its reminder whose every copy carries the Storyteller's own words for that player, typed
 * and shown on its `infoCard` from the reminder (the Zenomancer's Goal: the Storyteller
 * picks each goal, https://wiki.bloodontheclocktower.com/Zenomancer).
 */
export const noteOn = tokenPart(
	'Storyteller’s note on',
	'Its reminder whose every copy carries the Storyteller’s own words for that player.'
);
