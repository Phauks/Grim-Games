<script lang="ts">
	import { Switch } from '@ark-ui/svelte/switch';

	interface Props {
		label: string;
		checked: boolean;
		onChange: (checked: boolean) => void;
		disabled?: boolean;
	}

	let { label, checked, onChange, disabled }: Props = $props();
</script>

<!-- An on/off switch; the whole row is the tap target. -->
<Switch.Root {checked} {disabled} onCheckedChange={(details) => onChange(details.checked)}>
	<Switch.Label>{label}</Switch.Label>
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
