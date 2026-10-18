<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { BagSlot } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { TileMark } from './tile-face.ts';
	import TileMarkFace from './TileMarkFace.svelte';

	/**
	 * The bag as players see it: face-down tiles in places that never move, a drawn tile
	 * leaving a gap. Setup's draw and a game mode's deal both use it (Trevor, 2026-10-18:
	 * every mode draws from "the same pick a tile bag").
	 */
	interface Props {
		slots: readonly BagSlot[];
		/** Each place's face (tileMarks), in slot order. */
		marks: readonly TileMark[];
		/** "Seat 3 · Ana", for a held tile's label. */
		seatLabel: (seatId: SeatId | undefined) => string;
		onpick: (slot: BagSlot) => void;
	}

	let { slots, marks, seatLabel, onpick }: Props = $props();

	const markName = (number: number) => marks[number - 1]?.name ?? String(number);
	// A colour fills the whole token, with ink that reads on it (Trevor, 2026-10-17).
	function colourOf(number: number) {
		const mark = marks[number - 1];
		return mark?.kind === 'colour' ? mark : undefined;
	}
</script>

<ol class="tiles" aria-label={t('setup.draw.bag')}>
	{#each slots as s (s.tileId)}
		<li>
			<button
				type="button"
				class="tile"
				data-state={s.state}
				disabled={s.state === 'drawn'}
				aria-label={s.state === 'held'
					? t('setup.draw.tileHeld', {
							number: markName(s.number),
							seat: seatLabel(s.seatId)
						})
					: s.state === 'drawn'
						? t('setup.draw.tileDrawn', { number: markName(s.number) })
						: t('setup.draw.tile', { number: markName(s.number) })}
				onclick={() => onpick(s)}
				style:background={colourOf(s.number)?.colour}
				style:color={colourOf(s.number)?.ink}
			>
				<span class="face"
					>{#if marks[s.number - 1]}<TileMarkFace mark={marks[s.number - 1]} />{/if}</span
				>
				<span class="mark"
					>{#if s.state === 'drawn'}<Icon name="check" />{:else if s.state === 'held'}{t(
							'setup.draw.held'
						)}{/if}</span
				>
			</button>
		</li>
	{/each}
</ol>

<style>
	/* Three big tiles a row on a phone, more on wider screens (Trevor, 2026-10-16). */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(30%, calc(8 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* The number or symbol sits dead centre; the Held/✓ mark overlays the lower rim. */
	.tile {
		display: grid;
		grid-template-areas: 'tile';
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		min-height: var(--tap-target);
		border: 0;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 3px var(--token-rim);
		font: inherit;
		cursor: pointer;
		touch-action: manipulation;
	}
	@media (hover: hover) {
		.tile:hover {
			filter: brightness(1.1);
		}
	}
	.tile[data-state='held'] {
		box-shadow: inset 0 0 0 4px var(--accent);
	}
	.tile[data-state='drawn'] {
		opacity: 0.35;
		cursor: default;
		filter: none;
	}
	.face {
		grid-area: tile;
		display: grid;
		place-items: center;
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1;
	}
	.mark {
		grid-area: tile;
		align-self: end;
		display: grid;
		place-items: center;
		height: 1.2em;
		margin-bottom: 14%;
		font-size: 0.8rem;
	}
	/* A computer window: a wider bag with bigger tiles. */
	@media (min-width: 75rem) {
		.tiles {
			grid-template-columns: repeat(auto-fill, minmax(calc(10 * var(--u)), 1fr));
			gap: var(--space-3);
		}
	}
</style>
