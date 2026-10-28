<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import MatchShapeButton from './MatchShapeButton.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The Grim tab's own controls, on the town so no strip of the page goes on them (Trevor,
	 * 2026-10-27: "move any controls onto the grim so we remove wasted space"), all in its top
	 * right beside Full screen ("All controls on a player grim should be in the top right, next
	 * to the full screen button"): the eye, the board's shape and, once the Storyteller shares
	 * it, the Final grimoire switch (plan R5). A row only: PlayerGrim places it.
	 */
	interface Props {
		/** The board's shape has arrived, so the town can take it. */
		shaped: boolean;
		/** The Storyteller shared the final grimoire: its switch shows. */
		final: boolean;
		showFinal: boolean;
		onFinal: (on: boolean) => void;
		/** Placed in the town's top right itself, for a town without Full screen's corner. */
		placed?: boolean;
		/** Placed, the row's size, measured, so the ring of seats keeps clear of it. */
		width?: number;
		height?: number;
	}

	let {
		shaped,
		final,
		showFinal,
		onFinal,
		placed = false,
		width = $bindable(0),
		height = $bindable(0)
	}: Props = $props();
</script>

<!-- Placed, measured; in Full screen's corner, that corner is measured instead. -->
{#if placed}<div class="placed" bind:clientWidth={width} bind:clientHeight={height}>
		{@render row()}
	</div>{:else}{@render row()}{/if}

{#snippet row()}<div class="grim-tools" data-testid="grim-tools">
		{#if final}<span class="corner-pill"
				><Toggle label={t('room.finalGrimoire')} checked={showFinal} onChange={onFinal} /></span
			>{/if}
		<span class="corner-button"
			><HideContentsButton
				hidden={playerSettings.current.hideGuesses}
				onchange={(hideGuesses) => playerSettings.update({ hideGuesses })}
				testid="hide-guesses"
			/></span
		>
		<span class="corner-button"><MatchShapeButton disabled={!shaped} /></span>
	</div>{/snippet}

<style>
	.grim-tools {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* Where Full screen's corner sits (FullScreenStage), over the seats' layer as it is. */
	.placed {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		z-index: 1;
	}
	.corner-button {
		border-radius: 50%;
		background: var(--board-bar-background);
	}
	/* A switch with its words, on the same backing as the corner's round buttons. */
	.corner-pill {
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--board-bar-background);
	}
</style>
