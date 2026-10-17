<script lang="ts">
	import { dayNumber } from '#lib/core/rules/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DayPanel from './DayPanel.svelte';
	import { LiveDay } from './live-day.svelte.ts';

	/**
	 * The Storyteller's day as a sheet over the board, like the rest (Trevor, 2026-10-16:
	 * "day should be a modal ... it can be a very big modal"): full screen on phones, nearly
	 * all of a wider screen. Deaths, executions and exiles, ability uses and notes; every
	 * command runs on the open game, so the board behind it updates and History has it.
	 */
	interface Props {
		open: boolean;
		game: OpenGame;
	}

	let { open = $bindable(), game }: Props = $props();

	const day = $derived(new LiveDay(game));
	// Which day it is (Trevor): Day 1 starts when the first night ends.
	const number = $derived(dayNumber(game.game));
	const assistance = $derived(preferences.current.assistance);
</script>

<Dialog bind:open title={number > 0 ? t('day.titleNumber', { number }) : t('day.title')} size="max">
	<div class="body">
		<DayPanel game={day} {assistance} />
	</div>
</Dialog>

<style>
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		/*
		 * Room for the focus ring and the scrollbar beside the tiles. None on top: the day's
		 * pinned timer sits right under the header, so nothing shows above it (Trevor).
		 */
		padding: 0 var(--space-1) var(--space-1);
	}
</style>
