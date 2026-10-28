<script lang="ts">
	import { tick } from 'svelte';
	import type { EndReason } from '#lib/core/rules/index.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { endedGames, type EndedGame } from './device-notes.ts';
	import EndGameFields from './EndGameFields.svelte';
	import GameEndPrompt from './GameEndPrompt.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Ending and reopening the game (Trevor, 2026-10-16): End game moves it to History, Reopen
	 * puts it back in Join or resume, and the rules checked at dusk can offer End game themselves.
	 */
	interface Props {
		grimoire: Grimoire;
		/** This game's ending, if it has ended. */
		ended: EndedGame | undefined;
		/** Who won, as the board's game over line says it. */
		endedText: string;
		endOpen: boolean;
		reopenOpen: boolean;
		/** The game was ended or reopened, so its ending is read again. */
		onChange: () => void;
	}

	let {
		grimoire,
		ended,
		endedText,
		endOpen = $bindable(),
		reopenOpen = $bindable(),
		onChange
	}: Props = $props();

	let winner = $state<'good' | 'evil' | undefined>();
	let endReason = $state<EndReason | undefined>();
	/**
	 * End game can send the finished grimoire to the room's phones too (Trevor, 2026-10-24),
	 * as Share grim does (plan R5); only while this device has a room.
	 */
	let shareFinal = $state(false);
	const inRoom = $derived(!!roomHost().code);
	async function endGame() {
		endOpen = false;
		endedGames.end(grimoire.game.gameId, winner, endReason);
		grimoire.open.setViewOnly(true);
		onChange();
		if (!shareFinal || !inRoom) return;
		// After the room is told the game is over (the board's effect), which a share needs.
		await tick();
		if (!roomHost().reveal(grimoire.open)) toast(t('room.shareGrim.failed'));
	}
	function reopenGame() {
		endedGames.reopen(grimoire.game.gameId);
		grimoire.open.setViewOnly(false);
		onChange();
	}
</script>

<GameEndPrompt
	{grimoire}
	active={!ended && !grimoire.open.viewOnly}
	onEnd={(team, reason) => {
		winner = team;
		endReason = reason;
		endGame();
	}}
/>

<ConfirmDialog bind:open={reopenOpen} title="Reopen game?" onConfirm={reopenGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd>Ended, in History: {endedText}</dd>
		<dt>Becomes</dt>
		<dd>In Join or resume</dd>
	</dl>
</ConfirmDialog>

<ConfirmDialog bind:open={endOpen} title="End game?" danger onConfirm={endGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd>In Join or resume</dd>
		<dt>Becomes</dt>
		<dd>Ended, in History</dd>
	</dl>
	<div class="winner">
		<EndGameFields {grimoire} bind:winner bind:reason={endReason} />
	</div>
	{#if inRoom}
		<div class="share">
			<Toggle
				label={t('room.shareGrim.atEnd')}
				checked={shareFinal}
				onChange={(on) => (shareFinal = on)}
			/>
		</div>
	{/if}
</ConfirmDialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
	.winner,
	.share {
		margin-top: var(--space-3);
	}
</style>
