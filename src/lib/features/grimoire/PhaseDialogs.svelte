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
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	interface Props {
		flow: PhaseFlow;
		game: Game;
		characters: CharacterLookup;
	}

	let { flow, game, characters }: Props = $props();
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
	<SettingToggle
		label={ASSIST_LABELS.dayAfterNight.label}
		description={ASSIST_LABELS.dayAfterNight.description}
		checked={preferences.current.assistance.dayAfterNight}
		onChange={(dayAfterNight) =>
			preferences.update({
				assistance: { ...preferences.current.assistance, dayAfterNight }
			})}
	/>
</ConfirmDialog>

<!-- The same question as the day view's Execution. -->
<ExecutionDialog
	bind:open={flow.endDayOpen}
	{game}
	{characters}
	chosen={flow.executeChosen}
	onConfirm={(...args) => flow.executeAndEndDay(...args)}
/>

<style>
	.ask-note {
		margin: 0;
	}
</style>
