<script lang="ts">
	import { page } from '$app/state';
	import ResumeGameRow from '#lib/features/room/ResumeGameRow.svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import { lastGame, lastGameCard, lastGameHref, openLastGame } from './last-game.svelte.ts';

	/**
	 * The game this device had open last, as Join game's row for it (Trevor, 2026-11-06): at
	 * the top of the menu and the sidebar, so a game left is one tap away. On the game itself
	 * it stays put, and a tap keeps the game. Nothing shows with no game to go back to.
	 */
	interface Props {
		/** Called after a tap, e.g. to close the drawer. */
		onChoose?: () => void;
	}

	let { onChoose }: Props = $props();

	const when = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' })
	);
	// Looks again on every screen, as leaving, saving or ending a game changes the lists.
	$effect(() => {
		void page.url.pathname;
		void lastGame.refresh();
	});
	const game = $derived(lastGame.current);
	const card = $derived(game && lastGameCard(game, when));
	const href = $derived(game && lastGameHref(game));
	const current = $derived(!!href && page.url.pathname.startsWith(href));
</script>

{#if game && card}<div class="last-game">
		<ResumeGameRow
			{...card}
			empty={t('room.noScriptYet')}
			{href}
			{current}
			label={t('shell.lastGame', { name: card.name || t('room.noScriptYet') })}
			testid="last-game"
			onclick={() => {
				onChoose?.();
				openLastGame(game);
			}}
		/>
	</div>{/if}

<style>
	.last-game {
		margin-bottom: var(--space-2);
	}
</style>
