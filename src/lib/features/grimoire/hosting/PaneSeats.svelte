<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';

	/**
	 * More's Seats (moved from the board's ⋯ menu into the pane, Trevor 2026-11-18): a Fabled or
	 * Loric to add, and Seating, which swaps the toolbar for its own bar. Add seat is in Seating's
	 * bar only (Trevor, 2026-11-01).
	 */
	interface Props {
		onAddRule: () => void;
		onArrange: () => void;
	}

	let { onAddRule, onArrange }: Props = $props();
</script>

<div class="items" data-testid="pane-seats">
	<Button variant="quiet" icon="fabled" onclick={onAddRule}>Add Fabled or Loric</Button>
	<Button variant="quiet" icon="arrange" data-testid="menu-seating" onclick={onArrange}>
		{t('room.seating.title')}
	</Button>
</div>

<style>
	.items {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		padding-inline: var(--pane-gutter, 0rem);
	}
</style>
