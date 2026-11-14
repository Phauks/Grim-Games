<script lang="ts">
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';
	import GenericGuessToken from './GenericGuessToken.svelte';
	import type { SeatGuess } from './grim-guesses.ts';

	/**
	 * A seat's two or three guesses at once on the player's grim, its token split into halves or
	 * thirds (Trevor, 2026-11-13, picked from mockups: "That fourth guess looks super good!").
	 * Each guess's icon sits in the middle of its own slice, so no slice shows only an edge of
	 * the art. The newest guess takes the first slice: the left half, or the top third.
	 */
	interface Props {
		/** Two or three guesses, newest first. */
		entries: readonly SeatGuess[];
		/** The token's size in px, as the seat draws it. */
		size: number;
	}

	let { entries, size }: Props = $props();

	const thirds = $derived(entries.length > 2);
	/** Each slice's middle, in degrees (0 = right, 90 = down), and how far out its icon sits. */
	const SLICES = {
		halves: [180, 0],
		thirds: [-90, 30, 150]
	};
	/** How far from the middle a slice's icon sits, as a share of the token's size. */
	const OUT = { halves: 0.22, thirds: 0.24 };
	/** The icon's size, as a share of the token's size: as big as its slice holds. */
	const ICON = { halves: 0.5, thirds: 0.42 };
	const kind = $derived(thirds ? 'thirds' : 'halves');
	const rad = (deg: number) => (deg * Math.PI) / 180;
	/** A point at `deg` on a circle past the token's rim, as a CSS position. */
	const rim = (deg: number) => `${50 + 75 * Math.cos(rad(deg))}% ${50 + 75 * Math.sin(rad(deg))}%`;
	const slices = $derived(
		SLICES[kind].slice(0, entries.length).map((mid) => {
			const half = thirds ? 60 : 90;
			return {
				clip: `polygon(50% 50%, ${rim(mid - half)}, ${rim(mid)}, ${rim(mid + half)})`,
				x: OUT[kind] * size * Math.cos(rad(mid)),
				y: OUT[kind] * size * Math.sin(rad(mid))
			};
		})
	);
	/** The lines between the slices, from the middle to the rim. */
	const lines = $derived(SLICES[kind].map((mid) => mid + (thirds ? 60 : 90)));
	const icon = $derived(size * ICON[kind]);
	const blank = { firstNight: false, otherNight: false, reminders: 0 };
</script>

<span class="split" style:--token-size="{size}px" data-testid="split-guesses">
	<span class="layer"><TokenFace label="" leaves={blank} {size} /></span>
	{#each entries as entry, i (entry.id)}
		{@const slice = slices[i]}
		<span class="layer slice" style:clip-path={slice.clip} data-testid="guess-slice"
			><span class="icon" style:translate="{slice.x}px {slice.y}px"
				>{#if entry.generic}<GenericGuessToken
						guess={entry.generic}
						label={entry.label}
						size={icon}
					/>{:else if entry.character}<span
						class="art"
						style:width="{icon}px"
						style:height="{icon}px"
						><CharacterPiece template="icon" character={entry.character} /></span
					>{/if}</span
			></span
		>
	{/each}
	<svg class="layer lines" viewBox="0 0 100 100" aria-hidden="true">
		{#each lines as deg (deg)}
			<line x1="50" y1="50" x2={50 + 50 * Math.cos(rad(deg))} y2={50 + 50 * Math.sin(rad(deg))} />
		{/each}
	</svg>
</span>

<style>
	.split {
		position: relative;
		display: block;
		width: var(--token-size);
		height: var(--token-size);
		border-radius: 50%;
		overflow: hidden;
	}
	.layer {
		position: absolute;
		inset: 0;
	}
	.slice {
		display: grid;
		place-items: center;
	}
	.icon,
	.art {
		display: grid;
	}
	.lines line {
		stroke: var(--on-token);
		stroke-width: 1.2;
		opacity: 0.5;
	}
</style>
