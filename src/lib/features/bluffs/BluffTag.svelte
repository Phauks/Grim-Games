<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The red "Bluff" badge on a Demon bluff's row, wherever bluffs are listed: Character
	 * selection, its Demon bluffs, the bluffs sheet and its picker (Trevor, 2026-10-18 and
	 * 2026-10-29). Storyteller-only: never on what a player is shown.
	 */
	interface Props {
		/** Also chosen to be in play: a warning, never a lock. */
		warn?: boolean;
	}

	let { warn = false }: Props = $props();
</script>

<span class="bluff" data-testid="bluff-tag"
	>{#if warn}<Icon name="warning" />{/if}{t('setup.bluffShort')}</span
>

<style>
	.bluff {
		display: inline-flex;
		align-items: center;
		gap: 0.2em;
		padding: 0 0.4em;
		border-radius: var(--radius-full);
		background: var(--evil);
		color: var(--on-evil);
		font-family: var(--font-control);
		font-size: 0.7rem;
		font-weight: 600;
		line-height: 1.4;
		white-space: nowrap;
	}
</style>
