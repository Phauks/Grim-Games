import { readTurnsPlayersInto } from '../turns-players-rules.ts';
import type { Part } from './part.ts';
import type { TurnsPlayersInto } from '../turns-players-rules.ts';

/** Players it turns into another type at setup (the Kazali; `turns-players-rules.ts`). */
export const turnsPlayersInto: Part<TurnsPlayersInto> = {
	label: 'Turns players into',
	description: 'Players it turns into another type at setup.',
	read: (block, key, path, issues) => readTurnsPlayersInto(block[key], path, issues)
};
