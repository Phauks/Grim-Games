<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { STANDARD } from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { allModes } from '#lib/features/modes/custom-modes.svelte.ts';
	import { scriptChoices, searchableScripts } from '#lib/features/modes/script-choices.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { roomHost } from './host.svelte.ts';
	import ScriptVotePanel from './ScriptVotePanel.svelte';
	import { pickFromVote, type VotePick } from './vote-pick.ts';

	/**
	 * The room vote's own screen (Trevor, 2026-10-26: "voting should be its own screen. Not a
	 * popup"), reached from New game's Room vote. It opens this device's room if it has none,
	 * and phones see the Storyteller choosing meanwhile. Play goes back to New game with the
	 * winner chosen. The vote lives in the room, so leaving this screen keeps it running.
	 */
	onMount(() => {
		void restoreScripts();
		void loadOfficialData();
		const host = roomHost();
		host.prepare();
		host.setChoosing(true);
		return () => {
			if (host.code) host.setChoosing(false);
		};
	});

	/** New game's own scripts: the base three, recent and saved, and search results. */
	const choices = $derived.by(() => {
		const all = [...scriptChoices(), ...searchableScripts()];
		return all.filter((c, i) => all.findIndex((d) => d.value === c.value) === i);
	});
	/** New game's modes, Standard first (Trevor, 2026-10-23). */
	const modes = $derived(
		[STANDARD, ...allModes().filter((m) => m.id !== STANDARD.id)].map((m) => ({
			value: m.id,
			label: m.name
		}))
	);

	function play(pick: VotePick) {
		pickFromVote(pick);
		void goto(resolve('/new'));
	}
</script>

<ScriptVotePanel
	{choices}
	{modes}
	onPick={(id) => play({ subject: 'script', id })}
	onPickMode={(id) => play({ subject: 'mode', id })}
/>
