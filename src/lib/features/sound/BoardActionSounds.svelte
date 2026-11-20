<script lang="ts">
	import { actionTaken, type ActionState } from '#lib/core/sound/soundboard.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * Plays the sound of each moment the Storyteller's board moves through (plan U7; on by
	 * default, Trevor 2026-11-19): Dusk, Dawn, an execution and the game ending. Only what
	 * changes while the board is open plays, never the state it opened with.
	 */
	let { now }: { now: ActionState } = $props();

	let before: ActionState | undefined;
	$effect(() => {
		const after = { ...now };
		const action = before && actionTaken(before, after);
		before = after;
		if (!action) return;
		const sound = preferences.current.momentSounds[action];
		if (sound !== 'none') soundboard.play(sound);
	});
</script>
