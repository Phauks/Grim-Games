<script lang="ts">
	import { page } from '$app/state';
	import ResumeGameRow from '#lib/features/room/ResumeGameRow.svelte';
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import { forgetGame } from '#lib/features/game/forget-game.ts';
	import { forgetLocalTown } from '#lib/features/player/local-town.svelte.ts';
	import { forgetRoom } from '#lib/features/room/player.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import {
		lastGame,
		lastGameCard,
		lastGameHref,
		openLastGame,
		type LastGame
	} from './last-game.svelte.ts';

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

	// ── ⋯ (Trevor, 2026-11-06): hide it, or remove the game the way Join game would ──
	/** The game the open confirmation is about, kept while it closes. */
	let asking = $state<LastGame>();
	let confirmOpen = $state(false);
	const remove = $derived(
		game?.kind === 'storyteller'
			? t('shell.lastGameDelete')
			: game?.kind === 'room'
				? t('shell.lastGameLeave')
				: t('shell.lastGameDeleteTown')
	);
	const confirmText = $derived(
		asking?.kind === 'storyteller'
			? { title: t('shell.lastGameDeleteTitle'), body: t('shell.lastGameDeleteBody') }
			: asking?.kind === 'room'
				? { title: t('shell.lastGameLeaveTitle'), body: t('shell.lastGameLeaveBody') }
				: { title: t('shell.lastGameDeleteTownTitle'), body: t('shell.lastGameDeleteTownBody') }
	);
	async function confirmRemove() {
		const gone = asking;
		if (!gone) return;
		if (gone.kind === 'storyteller') await forgetGame(gone.gameId);
		else if (gone.kind === 'room') forgetRoom(gone.code);
		else forgetLocalTown(gone.game.visit.key);
		await lastGame.refresh();
	}
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
		<span class="more"
			><Menu
				label={t('shell.lastGameMore')}
				items={[
					{ value: 'hide', label: t('shell.lastGameHide'), onSelect: () => lastGame.hide(game) },
					{
						value: 'remove',
						label: remove,
						onSelect: () => {
							asking = game;
							confirmOpen = true;
						}
					}
				]}
			/></span
		>
	</div>{/if}

<ConfirmDialog
	bind:open={confirmOpen}
	title={confirmText.title}
	danger={asking?.kind !== 'room'}
	onConfirm={() => void confirmRemove()}
>
	<p>{confirmText.body}</p>
</ConfirmDialog>

<style>
	/* ⋯ in the card's top corner, over space the card keeps free, so the sidebar's narrow
	   column gives the card its whole width (Trevor, 2026-11-06). */
	.last-game {
		position: relative;
		margin-bottom: var(--space-2);
	}
	.last-game > :global(.resume-game) {
		padding-inline-end: var(--tap-target);
	}
	/* The lines wrap rather than cut off in the sidebar's narrow column. */
	.last-game :global(.resume-line),
	.last-game :global(.name) {
		white-space: normal;
	}
	.more {
		position: absolute;
		top: 0;
		right: 0;
	}
</style>
