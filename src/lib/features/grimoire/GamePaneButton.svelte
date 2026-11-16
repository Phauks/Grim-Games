<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';

	/**
	 * The Storyteller's pane, on a phone: Day, Night, Notes and Players in one sheet, from one
	 * button by the grim cover (Trevor, 2026-11-16: "consolidate it into a single ... button"),
	 * with a count of what waits from players. Where the screen is wide the pane is always beside
	 * the board, so there is no button.
	 */
	const host = roomHost();
	const unread = $derived(host.code ? host.inbox.unread : 0);
	const label = $derived(
		unread
			? `${t('room.players.pane')}, ${t('room.inbox.unread', { count: unread })}`
			: t('room.players.pane')
	);
</script>

{#if !sidePane.beside}<span class="pane-slot"
		><IconButton
			icon="gamePane"
			{label}
			data-testid="game-pane-button"
			outlined
			aria-pressed={sidePane.open}
			onclick={() => (sidePane.open = !sidePane.open)}
		/>{#if unread}<span class="count"><CountBadge count={unread} warn={host.inbox.urgent} /></span
			>{/if}</span
	>{/if}

<style>
	/* The count sits inside the button's corner, so the button keeps its size. */
	.pane-slot {
		position: relative;
		display: inline-flex;
		flex: none;
	}
	.count {
		position: absolute;
		top: 0.15em;
		right: 0.15em;
		font-size: 0.75rem;
		pointer-events: none;
	}
</style>
