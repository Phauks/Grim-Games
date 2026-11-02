<!--
	The questions the board asks before the game moves on (phase-flow.svelte.ts): Start game
	with setup reminders left, End night, and the day's Execution.
-->
<script lang="ts">
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import BoardReminder from './BoardReminder.svelte';
	import ReminderTokenRow from './ReminderTokenRow.svelte';
	import ExecutionDialog from '#lib/features/day/ExecutionDialog.svelte';
	import type { PhaseFlow } from '#lib/features/grimoire/phase-flow.svelte.ts';
	import AidMenu from '#lib/features/settings/AidMenu.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';

	interface Props {
		flow: PhaseFlow;
		game: Game;
		characters: CharacterLookup;
		/** Start game not yet tapped: the day's Execution warns (Trevor, 2026-11-01). */
		notStarted?: boolean;
	}

	let { flow, game, characters, notStarted = false }: Props = $props();
</script>

<ConfirmDialog
	bind:open={flow.startAskOpen}
	title="Start the game?"
	onConfirm={() => flow.beginGame()}
>
	<p class="ask-note">Setup reminders not yet placed:</p>
	<!-- The tokens themselves, as on the board (Trevor, 2026-10-30). -->
	<ReminderTokenRow testid="setup-left">
		{#each flow.setupLeft as { key, suggestion } (key)}
			<li>
				<BoardReminder
					label={suggestion.label}
					character={characters.get(suggestion.characterId)}
				/>
			</li>
		{/each}
	</ReminderTokenRow>
</ConfirmDialog>

<ConfirmDialog
	bind:open={flow.endNightOpen}
	title="End the night?"
	onConfirm={() => flow.endNight()}
>
	<!-- Whether the day opens after it is only in Settings (Trevor, 2026-10-30). -->
	{#snippet headActions()}<AidMenu aid="dayAfterNight" />{/snippet}
</ConfirmDialog>

<!-- The same question as the day view's Execution. -->
<ExecutionDialog
	bind:open={flow.endDayOpen}
	{game}
	{characters}
	chosen={flow.executeChosen}
	{notStarted}
	onConfirm={(...args) => flow.executeAndEndDay(...args)}
/>

<style>
	.ask-note {
		margin: 0;
	}
</style>
