<script lang="ts">
	import type { HTMLButtonAttributes } from 'svelte/elements';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * The back arrow of a list-and-detail view on a phone, where a detail slides in over its
	 * list (component review, 2026-10-18: the character dialog and Glossary, Settings, Search
	 * and the glossary popover each drew their own). Not page navigation: pages have none.
	 */
	interface Props extends Omit<HTMLButtonAttributes, 'children'> {
		/** What it goes back to, e.g. "Back to the list". */
		label: string;
		/** Only the arrow shows; the label stays its accessible name and tooltip. */
		hideLabel?: boolean;
	}

	let { label, hideLabel = false, class: className, ...rest }: Props = $props();
</script>

<button
	type="button"
	class={['back-button', className]}
	aria-label={hideLabel ? label : undefined}
	title={hideLabel ? label : undefined}
	{...rest}
	><Icon name="back" />{#if !hideLabel}<span>{label}</span>{/if}</button
>

<style>
	.back-button {
		display: inline-flex;
		align-items: center;
		justify-self: start;
		gap: var(--space-1);
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		cursor: pointer;
	}
</style>
