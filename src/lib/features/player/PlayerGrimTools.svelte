<script lang="ts">
	import type { ScriptMeta } from '#lib/core/data/index.ts';
	import type { PublicGameState } from '#lib/core/sync/public-projection.ts';
	import TownGameInfo from '#lib/features/modes/TownGameInfo.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import HideContentsButton from '#lib/ui/primitives/HideContentsButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import MatchShapeButton from './MatchShapeButton.svelte';
	import { playerSettings } from './player-settings.svelte.ts';

	/**
	 * The Grim tab's own controls, on the town so no strip of the page goes on them (Trevor,
	 * 2026-10-27: "move any controls onto the grim so we remove wasted space"), all in its top
	 * right beside Full screen ("All controls on a player grim should be in the top right, next
	 * to the full screen button"): the eye, the board's shape and, once the Storyteller shares
	 * it, the Final grimoire switch (plan R5); the reminder bin (Trevor, 2026-10-29); and Game
	 * info, which the corner's name opens too but a phone's corner often has no room for
	 * (Trevor, 2026-10-30). A row only: PlayerGrim places it.
	 */
	interface Props {
		/** The board's shape has arrived, so the town can take it. */
		shaped: boolean;
		/** The Storyteller shared the final grimoire: its switch shows. */
		final: boolean;
		showFinal: boolean;
		onFinal: (on: boolean) => void;
		/** The reminder bin: open, and off while the eye hides the player's own reminders. */
		bin?: { open: boolean; disabled: boolean; onToggle: () => void };
		/** Game info for this town, read only (TownGameInfo). */
		info?: {
			meta: ScriptMeta;
			table?: Pick<PublicGameState, 'storytellerName' | 'corner'>;
			roomCode?: string;
		};
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
		bin,
		info,
		placed = false,
		width = $bindable(0),
		height = $bindable(0)
	}: Props = $props();
	let infoOpen = $state(false);
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
		{#if bin}<span class="corner-button"
				><IconButton
					icon="reminder"
					label={t('player.grim.reminderBin')}
					aria-pressed={bin.open}
					disabled={bin.disabled}
					data-bin-opener
					data-testid="reminder-bin-button"
					onclick={bin.onToggle}
				/></span
			>{/if}
		{#if info}<span class="corner-button"
				><IconButton
					icon="info"
					label={t('modes.info.title')}
					aria-haspopup="dialog"
					data-testid="grim-game-info"
					onclick={() => (infoOpen = true)}
				/></span
			>{/if}
		<span class="corner-button"><MatchShapeButton disabled={!shaped} /></span>
	</div>{/snippet}
{#if info}<TownGameInfo
		bind:open={infoOpen}
		meta={info.meta}
		storytellerName={info.table?.storytellerName}
		corner={info.table?.corner}
		roomCode={info.roomCode}
	/>{/if}

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
