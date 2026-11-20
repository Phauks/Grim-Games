import { liveDayTimer } from '#lib/features/day/day-timer.svelte.ts';
import { preferences } from '#lib/ui/preferences.svelte.ts';
import { roomHost } from './host.svelte.ts';

/**
 * Back to town (plan U2): stops the day timer (Trevor, 2026-11-02: always available) and calls
 * every player's phone with its moment's sound, set in Settings > Sound (Trevor, 2026-11-19),
 * or none. False when no room's phones could be reached.
 */
export function callTown(): boolean {
	if (liveDayTimer.running) liveDayTimer.toggle();
	const sound = preferences.current.momentSounds.townCall;
	return roomHost().callTown(sound === 'none' ? undefined : sound);
}

// The day timer reaching 0:00 calls the town itself, with no confirm and, without a room,
// nothing said (Trevor, 2026-11-15: "If timer goes down to 0, should activate back to town").
liveDayTimer.onTimeUp(() => void callTown());
