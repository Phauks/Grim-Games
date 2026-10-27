<script lang="ts">
	import { actionTaken, type ActionState } from '#lib/core/sound/soundboard.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { soundboard } from './soundboard.svelte.ts';

	/**
	 * Plays the sound tied to each action the Storyteller takes on the board (plan U7): Dusk,
	 * Dawn, an execution and the game ending. Only what changes while the board is open plays,
	 * never the state it opened with.
	 */
	let { now }: { now: ActionState } = $props();

	let before: ActionState | undefined;
	$effect(() => {
		const after = { ...now };
		const action = before && actionTaken(before, after);
		before = after;
		if (!action || !preferences.current.actionSoundsOn) return;
		const sound = preferences.current.actionSounds[action];
		if (sound !== 'none') void soundboard.play(sound);
	});
</script>
