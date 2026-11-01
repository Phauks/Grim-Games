<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { dayNumber } from '#lib/core/rules/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CoverButton from '#lib/features/show/CoverButton.svelte';
	import GameNotesButton from '#lib/features/grimoire/GameNotesButton.svelte';
	import GameLead from '#lib/features/shell/GameLead.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { CoverDetails } from '#lib/features/show/CoverScreen.svelte';
	import type { Snippet } from 'svelte';
	import DayPanel from './DayPanel.svelte';
	import { LiveDay } from './live-day.svelte.ts';

	/**
	 * The Storyteller's day as a sheet over the board, like the rest (Trevor, 2026-10-16:
	 * "day should be a modal ... it can be a very big modal"): the whole screen, so ☰ and the
	 * grim cover sit exactly where the board's do (Trevor, 2026-10-28). Deaths, executions and exiles, ability uses and notes; every
	 * command runs on the open game, so the board behind it updates and History has it.
	 */
	interface Props {
		open: boolean;
		game: OpenGame;
		/**
		 * Execution, which ends the day (Trevor, 2026-10-22): the board asks who was executed,
		 * then closes the day sheet and starts tonight's night at Dusk. Without it there is no
		 * Execution button.
		 */
		onEndDay?: () => void;
		/** Opens the Savant information sheet for a seat (L5). */
		onSavant?: (seatId: SeatId) => void;
		/** A mad player broke madness that executes: the board's Execution asks (L84). */
		onExecute?: (seatId: SeatId, cause: CharacterId) => void;
		/** What the grim cover shows, as from the board (Trevor, 2026-10-26). */
		cover?: CoverDetails;
		coverTimer?: Snippet;
		coverActions?: Snippet;
		/**
		 * Opens the board's Soundboard, beside the cover in the header (Trevor, 2026-10-27:
		 * "Approve day view E"). Without it there is no Soundboard button.
		 */
		onSoundboard?: () => void;
	}

	let {
		open = $bindable(),
		game,
		onEndDay,
		onSavant,
		onExecute,
		cover,
		coverTimer,
		coverActions,
		onSoundboard
	}: Props = $props();

	const day = $derived(new LiveDay(game));
	// Which day it is (Trevor): Day 1 starts when the first night ends.
	const number = $derived(dayNumber(game.game));
	const assistance = $derived(preferences.current.assistance);
	const title = $derived(number > 0 ? t('day.titleNumber', { number }) : t('day.title'));
</script>

<Dialog bind:open {title} size="screen" scroll={false}>
	<!-- ☰ and the grim cover first, where they are on the board, so the cover doesn't move
	     (Trevor, 2026-10-27); the day's name is at the bottom instead (his pick, G3), and named
	     here only for screen readers. -->
	{#snippet lead()}<GameLead
			><CoverButton
				gameId={game.game.gameId}
				details={cover}
				timer={coverTimer}
				actions={coverActions}
			/><GameNotesButton {game} /></GameLead
		>{/snippet}
	{#snippet heading()}<span class="visually-hidden">{title}</span>{/snippet}
	<!-- The Soundboard beside ✕, from the day as from the board (Trevor, 2026-10-27). -->
	{#snippet headActions()}{#if onSoundboard}<IconButton
				icon="soundboard"
				label={t('settings.soundboard')}
				onclick={onSoundboard}
			/>{/if}{/snippet}
	<div class="body">
		<DayPanel game={day} {assistance} {onSavant} {onExecute} />
	</div>
	{#snippet actions()}
		<span class="day-name" data-testid="day-name" aria-hidden="true">{title}</span>
		{#if onEndDay}
			<Button variant="accent" icon="night" disabled={game.viewOnly} onclick={() => onEndDay?.()}
				>{t('day.execution')}</Button
			>
		{/if}
	{/snippet}
</Dialog>

<style>
	/* The day's name across from Execution, as the header's title looks. */
	.day-name {
		margin-right: auto;
		align-self: center;
		color: var(--heading);
		font-family: var(--font-heading);
		font-size: 1.25rem;
		font-weight: var(--font-heading-weight);
	}
	.body {
		/* The day's two columns (L45) follow the sheet's width, not the window's. */
		container: day / inline-size;
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		/*
		 * Room for the focus ring and the scrollbar beside the tiles. None on top: the day's
		 * pinned timer sits right under the header, so nothing shows above it (Trevor).
		 */
		padding: 0 var(--space-1) var(--space-1);
	}
	/*
	 * Phones: the day takes most of the dialog's side padding back, so long character names
	 * (Investigator, Fortune Teller) fit on one line in the player tiles (Trevor, 2026-10-18).
	 * The widening goes on the dialog's own body, which clips what spills past it: a
	 * negative margin here was cut off at its edges and hid text and buttons (Trevor).
	 */
	@media (max-width: 40rem) {
		:global([data-scope='dialog'][data-part='content'] > div):has(> .body) {
			margin-inline: calc(-1 * var(--space-3));
		}
	}
</style>
