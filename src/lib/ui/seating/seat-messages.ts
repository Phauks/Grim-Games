/**
 * What a seat's player has sent that the Storyteller hasn't read (plan M86): `urgent` when one
 * asks to talk or reports a picture. Shown in the seat's note mark.
 */
export type SeatMessages = 'new' | 'urgent';

/** The mark for a count of waiting messages, or none. */
export function seatMessages(waiting: {
	count: number;
	urgent: boolean;
}): SeatMessages | undefined {
	if (!waiting.count) return undefined;
	return waiting.urgent ? 'urgent' : 'new';
}
