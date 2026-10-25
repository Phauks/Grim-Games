<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Game } from '#lib/core/model/index.ts';
	import { carryFrom, clearNextGame, setNextGame } from '#lib/features/game/next-game.ts';
	import NewGame from '#lib/features/grimoire/NewGame.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { notBegun } from './new-game-draft.ts';

	/**
	 * New game from inside a game (Trevor, 2026-10-24): no script change mid-game, but "a way
	 * to Start A New Game", as "a tiny modal version of the new game screen" so the game mode,
	 * special rules and the room's vote can change too. The room, seat count and names carry
	 * over (next-game.ts); the current game ends when the new one starts, so closing the sheet
	 * changes nothing. A game not yet begun is dropped without asking.
	 */
	interface Props {
		game: Game;
		/** Start game was tapped (Game time runs). */
		started: boolean;
	}

	let { game, started }: Props = $props();

	let asking = $state(false);
	let open = $state(false);

	/** Game info's New game: asks first when there is a game to end. */
	export function begin() {
		const drop = !started && notBegun(game);
		if (drop) show(true);
		else asking = true;
	}
	function show(drop: boolean) {
		setNextGame(carryFrom(game, drop));
		open = true;
	}
	// Closed without starting, or the board left with it open: nothing carries into a later
	// game. A game started from the sheet has taken the carry by then.
	$effect(() => {
		if (!open) clearNextGame();
	});
	onDestroy(clearNextGame);
</script>

<ConfirmDialog
	bind:open={asking}
	title={t('modes.newGame.ask')}
	description={t('modes.newGame.askText')}
	danger
	onConfirm={() => show(false)}
/>

<Dialog bind:open title={t('setup.newGame')} size="max">
	{#if open}<NewGame compact />{/if}
</Dialog>
