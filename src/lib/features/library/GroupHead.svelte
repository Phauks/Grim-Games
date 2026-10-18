<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * A heading of the Library's sidebar that folds its group away (Trevor, 2026-10-18:
	 * "allow collapsing of folders, kind, and tags"), with the group's own buttons beside it.
	 */
	interface Props {
		/** The heading's id, which names its section. */
		id: string;
		title: string;
		open?: boolean;
		actions?: Snippet;
	}

	let { id, title, open = $bindable(true), actions }: Props = $props();
</script>

<div class="head">
	<h2 {id} class="heading">
		<button type="button" class="toggle" aria-expanded={open} onclick={() => (open = !open)}>
			<span class="caret" class:closed={!open}><Icon name="expand" /></span>
			{title}
		</button>
	</h2>
	{@render actions?.()}
</div>

<style>
	.head {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		grid-auto-columns: auto;
		align-items: center;
	}
	.heading {
		margin: 0;
		font: inherit;
	}
	.toggle {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
		cursor: pointer;
	}
	.caret {
		display: flex;
		transition: transform 0.15s;
	}
	.caret.closed {
		transform: rotate(-90deg);
	}
</style>
