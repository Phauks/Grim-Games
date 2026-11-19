import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * The icons that mark a seat or a vote on the board: chosen in the game pane's Theme beside the
 * real board, not in Settings > Icons (Trevor, 2026-11-18).
 */
export const BOARD_MARKS: readonly IconSlot[] = [
	'alive',
	'dead',
	'ghostVote',
	'poisoned',
	'drunk',
	'protected',
	'night',
	'day',
	'vote',
	'exile',
	'nominator',
	'nominated'
];
