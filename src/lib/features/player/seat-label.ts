/**
 * A seat's words on a player's grim, for its button's accessible name: who sits there, then
 * what the table and this player know about them. Split out of PlayerGrim.
 */
import { t } from '#lib/i18n/locale.svelte.ts';
import type { PublicSeat } from '#lib/core/sync/public-projection.ts';

export interface SeatLabelParts {
	/** The seat's player's name, or its "no name" words. */
	name: string;
	/** This phone's own seat. */
	mine: boolean;
	/** The Traveller the town was told about, by name. */
	traveller?: string;
	/** The player's guesses, by name, front first; none while they are hidden. */
	guesses: readonly string[];
	/** The player's reminders on the seat, in words. */
	reminders: readonly string[];
	note: boolean;
}

/* eslint-disable grim/names-as-badges -- the seat button's accessible name (aria-label) only */
export function seatLabel(seat: PublicSeat, parts: SeatLabelParts): string {
	const words = [`${t('common.seat', { number: seat.seatNumber })}: ${parts.name}`];
	if (parts.mine) words.push(t('player.grim.you'));
	if (seat.dead) words.push(t('player.grim.dead'));
	if (seat.notInPlay) words.push(t('common.notInPlay'));
	if (seat.ghostVote === 'unused') words.push(t('player.grim.voteUnused'));
	if (seat.ghostVote === 'used') words.push(t('player.grim.voteUsed'));
	// No ghost vote to spend (the Banshee killed by the Demon), as the board says.
	if (seat.votes !== undefined) words.push(t('player.grim.votes', { count: seat.votes }));
	if (parts.traveller) words.push(t('player.grim.traveller', { name: parts.traveller }));
	if (parts.guesses.length) words.push(t('player.grim.guess', { name: parts.guesses.join(', ') }));
	if (parts.reminders.length)
		words.push(t('player.grim.hasReminders', { labels: parts.reminders.join(', ') }));
	if (parts.note) words.push(t('player.grim.hasNote'));
	return words.join(', ');
}
/* eslint-enable grim/names-as-badges */
