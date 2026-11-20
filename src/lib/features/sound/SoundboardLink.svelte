<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * The game's sounds' link to the board, for as long as the Storyteller's board is up,
	 * whether or not the pane's Sounds is open (Trevor, 2026-11-18).
	 */

	// Play on (plan U10): sounds reach the Public Town and phones through this board's room,
	// and never sound here (Trevor, 2026-10-30).
	$effect(() => {
		if (!roomHost().code) return;
		soundboard.town = (command) => roomHost().townSound(command, preferences.current.soundOutput);
		return () => (soundboard.town = undefined);
	});

	// The volume follows Settings while a sound plays.
	$effect(() => {
		void preferences.current.soundVolume;
		soundboard.applyVolume();
	});
</script>
