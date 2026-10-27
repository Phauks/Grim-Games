<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import MatchShapeButton from './MatchShapeButton.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The Grim tab's own controls, over the town's bottom right corner, so no strip of the page
	 * goes on them (Trevor, 2026-10-27: "move any controls onto the grim so we
	 * remove wasted space"): the eye, the board's shape and, once the Storyteller shares it, the
	 * Final grimoire switch (plan R5). Placed inside the town, which it sits over.
	 */
	interface Props {
		/** The board's shape has arrived, so the town can take it. */
		shaped: boolean;
		/** The Storyteller shared the final grimoire: its switch shows. */
		final: boolean;
		showFinal: boolean;
		onFinal: (on: boolean) => void;
	}

	let { shaped, final, showFinal, onFinal }: Props = $props();
</script>

<div class="grim-tools" data-testid="grim-tools">
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
</div>

<style>
	/* The corner of the ring of seats, clear of the corner lines (bottom left) and Full screen
	   (top right); over the seats' layer, as Full screen is. */
	.grim-tools {
		position: absolute;
		right: var(--space-2);
		bottom: var(--space-2);
		z-index: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
