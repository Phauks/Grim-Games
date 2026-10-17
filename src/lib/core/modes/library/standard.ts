import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

/** A standard game: no part changed (https://wiki.bloodontheclocktower.com/Setup). */
export const STANDARD: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'standard',
	name: 'Standard',
	sources: [{ title: 'Setup', url: 'https://wiki.bloodontheclocktower.com/Setup' }],
	parts: {}
};
