<script lang="ts">
	import { onMount } from 'svelte';
	import { STANDARD } from '#lib/core/modes/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { allModes } from '#lib/features/modes/custom-modes.svelte.ts';
	import { allRules } from '#lib/features/modes/custom-rules.svelte.ts';
	import { scriptChoices, searchableScripts } from '#lib/features/modes/script-choices.svelte.ts';
	import { restoreScripts } from '#lib/features/scripts/current-script.svelte.ts';
	import { holdChoosing } from './choosing.ts';
	import { roomHost } from './host.svelte.ts';
	import ScriptVotePanel from './ScriptVotePanel.svelte';
	import type { VotePick } from './vote-pick.ts';

	interface Props {
		/** Play: New game with the winner chosen. */
		onPlay: (pick: VotePick) => void;
		/** Back, or Cancel vote: to where the vote was opened from. */
		onBack: () => void;
		/** In a sheet whose X closes it: no Back before a vote opens. */
		hideBack?: boolean;
	}
	let { onPlay, onBack, hideBack = false }: Props = $props();

	/**
	 * The room vote (Trevor, 2026-10-26: "voting should be its own screen. Not a popup"): /vote
	 * from New game's Room vote, or a sheet filling the game screen once a game is over, so
	 * running it never leaves the board (Trevor, 2026-11-01). It opens this device's room if it
	 * has none, and phones see the Storyteller choosing meanwhile. The vote lives in the room,
	 * so leaving this screen keeps it running.
	 */
	onMount(() => {
		void restoreScripts();
		void loadOfficialData();
		roomHost().prepare();
		return holdChoosing();
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

	/** New game's special rules, built-in first (Trevor, 2026-10-26). */
	const rules = $derived(allRules().map((r) => ({ value: r.id, label: r.name })));
</script>

<ScriptVotePanel
	{choices}
	{modes}
	onPick={(id) => onPlay({ subject: 'script', id })}
	onPickMode={(id) => onPlay({ subject: 'mode', id })}
	{rules}
	onPickRules={(ids) => onPlay({ subject: 'rules', ids })}
	{onBack}
	{hideBack}
/>
