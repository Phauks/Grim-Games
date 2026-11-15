<script lang="ts">
	import { ACCOLADES, type AccoladeId } from '#lib/core/feedback/index.ts';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import FrameDrawing from '#lib/ui/seating/FrameDrawing.svelte';

	/**
	 * One accolade as a badge (Trevor, 2026-11-15, look C): its emoji on a coin in the double
	 * gold ring, its name under it. In the Game over sheet it is a toggle, grey and smaller until
	 * picked; in Player feedback it shows how many players gave it, in the corner.
	 */
	interface Props {
		id: AccoladeId;
		/** A toggle: whether it is picked. Left out, the badge only shows. */
		pressed?: boolean;
		onclick?: () => void;
		/** How many players gave it. */
		count?: number;
	}

	let { id, pressed, onclick, count }: Props = $props();

	const ring = seatFrame('double-gold');
	const emoji = $derived(ACCOLADES.find((a) => a.id === id)?.emoji ?? '');
	const label = $derived(t(`room.feedback.accolade.${id}`));
</script>

{#snippet face()}
	<span class="coin" aria-hidden="true">
		<span class="disc">{emoji}</span>
		<span class="ring"><FrameDrawing frame={ring} /></span>
	</span>
	{#if count === undefined}<span class="label">{label}</span>
	{:else}
		<!-- Read as one phrase, "Great pacing × 2"; shown as the name and a corner count. -->
		<span class="visually-hidden"
			>{t('room.feedback.accoladeCount', { accolade: label, count })}</span
		>
		<span class="label" aria-hidden="true">{label}</span>
		<span class="count" aria-hidden="true"><CountBadge {count} times /></span>
	{/if}
{/snippet}

{#if onclick}
	<button
		type="button"
		class="badge"
		data-off={pressed ? undefined : ''}
		aria-pressed={!!pressed}
		data-testid="accolade-badge"
		{onclick}>{@render face()}</button
	>
{:else}
	<span class="badge" data-testid="accolade-badge" data-accolade={id}>{@render face()}</span>
{/if}

<style>
	.badge {
		position: relative;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--space-1);
		width: calc(5.5 * var(--u));
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: var(--text);
		font: inherit;
		text-align: center;
		touch-action: manipulation;
	}
	button.badge {
		cursor: pointer;
	}
	.coin {
		position: relative;
		display: block;
		width: calc(3.4 * var(--u));
		height: calc(3.4 * var(--u));
		transition:
			opacity 0.15s,
			filter 0.15s,
			transform 0.15s;
	}
	.disc {
		position: absolute;
		inset: 6%;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: var(--token-face);
		font-size: 1.35rem;
		line-height: 1;
	}
	.ring {
		position: absolute;
		inset: 0;
	}
	.label {
		font-family: var(--font-heading);
		font-size: 0.8rem;
		line-height: 1.15;
	}
	/* Not picked: grey and a little smaller, in the same space, so picking moves nothing. */
	.badge[data-off] .coin {
		opacity: 0.45;
		filter: grayscale(1);
		transform: scale(0.9);
	}
	.badge[data-off] .label {
		color: var(--text-muted);
	}
	.count {
		position: absolute;
		top: 0;
		right: 0;
	}
	@media (prefers-reduced-motion: reduce) {
		.coin {
			transition: none;
		}
	}
</style>
