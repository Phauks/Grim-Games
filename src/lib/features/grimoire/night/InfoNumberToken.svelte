<script lang="ts">
	import ShowToPlayerButton from '#lib/features/show/ShowToPlayerButton.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';

	/**
	 * A step that gives a number offers the "Your number is" info token (Trevor, 2026-10-18):
	 * the number, then its Show to player.
	 */
	interface Props {
		number: number;
		/** The info token's own text ("Your number is"). */
		card: string;
		max: number;
		onShow: (n: number) => void;
	}

	let { number = $bindable(), card, max, onShow }: Props = $props();
</script>

<h3>Info token</h3>
<div class="number" data-testid="step-number">
	<span class="card-text" aria-hidden="true">{card}</span>
	<NumberSelect bind:value={number} label={card} hideLabel min={0} {max} />
	<ShowToPlayerButton onclick={() => onShow(number)} />
</div>

<style>
	.number {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
	}
	.card-text {
		font-weight: 600;
	}
</style>
