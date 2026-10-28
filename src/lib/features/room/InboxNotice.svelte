<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * On the grim cover, how many messages wait (Trevor, 2026-10-27: "Integrate this messaging
	 * system into grim cover as well, don't show who, but show notifications"): a count only,
	 * never a name or a word of a message, since the table can see the cover. Its place is kept
	 * while the room is open, so a message coming in moves nothing on the cover.
	 */
	const host = roomHost();
	const unread = $derived(host.inbox.unread);
</script>

{#if host.code}
	<p class="notice" class:none={!unread} data-testid="cover-inbox" aria-live="polite">
		<Icon name="messages" />
		<span>{t('room.inbox.unread', { count: unread })}</span>
	</p>
{/if}

<style>
	.notice {
		flex-basis: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		margin: 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--on-surface);
	}
	.none {
		visibility: hidden;
	}
</style>
