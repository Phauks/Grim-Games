<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * The room row's place on /play when the script came from an offline code (Trevor,
	 * 2026-10-26): says the game is offline, and opens what this phone has and what it won't
	 * get. One tap target, the whole row, as the room's own row.
	 */
	let open = $state(false);
</script>

<button
	type="button"
	class="offline"
	data-testid="offline-game"
	aria-haspopup="dialog"
	onclick={() => (open = true)}
>
	<span class="summary" role="status">{t('player.offline.row')}</span>
	<Icon name="info" />
	<span class="visually-hidden">{t('player.offline.more')}</span>
</button>

<Dialog bind:open title={t('player.offline.title')}>
	<div class="what">
		<h3>{t('player.offline.hereTitle')}</h3>
		<p>{t('player.offline.here')}</p>
		<h3>{t('player.offline.notHereTitle')}</h3>
		<p>{t('player.offline.notHere')}</p>
	</div>
</Dialog>

<style>
	.offline {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		margin-bottom: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.summary {
		flex: 1;
		min-width: 0;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.what {
		display: grid;
		gap: var(--space-2);
	}
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: 1rem;
	}
</style>
