<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * A rounded pill button, a full tap target high. With `pressed` it is a switch that fills
	 * with the accent colour when on (component review, 2026-10-18: the day panel's Used and
	 * the Library's tag toggles each drew their own). `marked` outlines it, e.g. a note that
	 * has text.
	 */
	interface Props extends Omit<HTMLButtonAttributes, 'aria-pressed'> {
		/** On or off; leave out for a chip that only acts. */
		pressed?: boolean;
		marked?: boolean;
		children: Snippet;
	}

	let { pressed, marked = false, children, class: className, ...rest }: Props = $props();
</script>

<button
	type="button"
	class={['chip', className]}
	aria-pressed={pressed}
	data-marked={marked ? 'true' : undefined}
	{...rest}>{@render children()}</button
>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-1);
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-full);
		background: transparent;
		color: inherit;
		font: inherit;
		font-family: var(--font-control);
		cursor: pointer;
	}
	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--on-accent);
	}
	.chip[data-marked] {
		border-color: var(--heading);
	}
	.chip:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
