<script lang="ts">
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * The soundboard's link to the board, for as long as the Storyteller's board is up, whether
	 * or not the Soundboard is open (it is a view of the pane, Trevor 2026-11-18).
	 */

	// Play on (plan U10): the soundboard reaches the Public Town and phones through this
	// board's room, and never sounds here (Trevor, 2026-10-30).
	$effect(() => {
		if (!roomHost().code) return;
		soundboard.town = (command) => roomHost().townSound(command, preferences.current.soundOutput);
		return () => (soundboard.town = undefined);
	});

	// Levels and loops follow the mixer while sounds play, from here or from Settings.
	$effect(() => {
		void preferences.current.soundVolume;
		void preferences.current.soundboardLevel;
		void preferences.current.soundMixes;
		void preferences.current.soundOutput;
		soundboard.applyMix();
	});
</script>
