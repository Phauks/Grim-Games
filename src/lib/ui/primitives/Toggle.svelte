<script lang="ts">
	import { Switch } from '@ark-ui/svelte/switch';

	interface Props {
		label: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
		disabled?: boolean;
		/** The label stays its accessible name but isn't shown (a row's title already says it). */
		hideLabel?: boolean;
		/**
		 * A line beside the switch, under the label, inside the tap target (Trevor, 2026-10-22:
		 * a switch has no text beneath it). The switch stays on the label's line.
		 */
		description?: string;
	}

	let { label, checked, onChange, disabled, hideLabel = false, description }: Props = $props();
</script>

<!-- An on/off switch; the whole row is the tap target. -->
<Switch.Root {checked} {disabled} onCheckedChange={(details) => onChange(details.checked)}>
	{#if description}
		<span class="toggle-text">
			<Switch.Label>{label}</Switch.Label>
			<span class="toggle-description">{description}</span>
		</span>
	{:else}
		<Switch.Label class={hideLabel ? 'visually-hidden' : undefined}>{label}</Switch.Label>
	{/if}
	<Switch.Control><Switch.Thumb /></Switch.Control>
	<Switch.HiddenInput />
</Switch.Root>

<style>
	:global([data-scope='switch'][data-part='root']) {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		min-height: var(--tap-target);
		font-family: var(--font-control);
		cursor: pointer;
		touch-action: manipulation;
	}
	.toggle-text {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
	}
	.toggle-description {
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	/* With a description the switch keeps to the label's line. */
	:global([data-scope='switch'][data-part='root']:has(.toggle-text)) {
		align-items: flex-start;
		padding-block: var(--space-2);
	}
	:global([data-scope='switch'][data-part='root'][data-disabled]) {
		opacity: 0.5;
	}
	:global([data-scope='switch'][data-part='control']) {
		display: flex;
		flex: none;
		width: calc(3 * var(--u));
		height: calc(1.75 * var(--u));
		padding: calc(0.1875 * var(--u));
		border-radius: var(--radius-full);
		background: var(--surface-selected);
		box-shadow: inset 0 0 0 1px var(--border);
		transition: background var(--duration-fast);
	}
	:global([data-scope='switch'][data-part='control'][data-state='checked']) {
		background: var(--accent);
	}
	:global([data-scope='switch'][data-part='thumb']) {
		width: calc(calc(1.75 * var(--u)) - 0.375 * var(--u));
		aspect-ratio: 1;
		border-radius: 50%;
		background: var(--on-accent);
		transition: translate var(--duration-fast) var(--ease-out);
	}
	:global([data-scope='switch'][data-part='thumb'][data-state='checked']) {
		translate: calc(calc(3 * var(--u)) - calc(1.75 * var(--u))) 0;
	}
	:global([data-scope='switch'][data-part='control'][data-focus-visible]) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
