<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { EndReason } from '#lib/core/rules/index.ts';
	import { tick } from 'svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import AlignmentPill from './AlignmentPill.svelte';
	import { endedGames, type EndedGame } from './device-notes.ts';
	import { endGameRequest } from './end-game-request.svelte.ts';
	import EndGameFields from './EndGameFields.svelte';
	import GameEndPrompt from './GameEndPrompt.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Ending and reopening the game (Trevor, 2026-10-16): End game moves it to History, Reopen
	 * puts it back in Continue game, and the rules checked at dusk can offer End game themselves.
	 * The confirms say what the board shows, where the game is up to and Game over, not where
	 * the save is filed (Trevor, 2026-11-01: the room stays open after End game).
	 */
	interface Props {
		grimoire: Grimoire;
		/** This game's ending, if it has ended. */
		ended: EndedGame | undefined;
		/** Who won, as the board's game over line says it. */
		endedText: string;
		/** Where the game is up to, as the corner says it ("Day 3"). */
		phase: string;
		endOpen: boolean;
		reopenOpen: boolean;
		/** The game was ended or reopened, so its ending is read again. */
		onChange: () => void;
	}

	let {
		grimoire,
		ended,
		endedText,
		phase,
		endOpen = $bindable(),
		reopenOpen = $bindable(),
		onChange
	}: Props = $props();

	let winner = $state<'good' | 'evil' | undefined>();
	let endReason = $state<EndReason | undefined>();
	let alsoWon = $state<SeatId[]>([]);
	/**
	 * Share grim is not asked here (Trevor, 2026-11-01: "allow it to be done after the fact"):
	 * once the game is over, ⋯ > Session offers it while the room is connected.
	 */
	function endGame() {
		endOpen = false;
		endedGames.end(grimoire.game.gameId, winner, endReason, alsoWon);
		grimoire.open.setViewOnly(true);
		onChange();
	}
	/**
	 * End game asked for from elsewhere (the Fiddle contest's result): opens with its winner,
	 * then, once the fields have preselected how that winner won, its reason.
	 */
	$effect(() => {
		const pending = endGameRequest.pending;
		if (!pending) return;
		endGameRequest.pending = undefined;
		if (ended) return;
		winner = pending.winner;
		alsoWon = [];
		endOpen = true;
		void tick().then(() => (endReason = pending.reason));
	});
	function reopenGame() {
		endedGames.reopen(grimoire.game.gameId);
		grimoire.open.setViewOnly(false);
		onChange();
	}
</script>

<GameEndPrompt
	{grimoire}
	active={!ended && !grimoire.open.viewOnly}
	onEnd={(team, reason, also) => {
		winner = team;
		endReason = reason;
		alsoWon = also;
		endGame();
	}}
/>

<ConfirmDialog bind:open={reopenOpen} title="Reopen game?" onConfirm={reopenGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd><AlignmentPill alignment={ended?.winner} text={`Game over: ${endedText}`} /></dd>
		<dt>Becomes</dt>
		<dd>{phase}</dd>
	</dl>
</ConfirmDialog>

<ConfirmDialog bind:open={endOpen} title="End game?" danger onConfirm={endGame}>
	<dl class="change">
		<dt>Now</dt>
		<dd>{phase}</dd>
		<dt>Becomes</dt>
		<dd>
			<AlignmentPill
				alignment={winner}
				text={`Game over: ${winner === 'good' ? 'Good won' : winner === 'evil' ? 'Evil won' : 'Winner not recorded'}`}
			/>
		</dd>
	</dl>
	<div class="winner">
		<EndGameFields {grimoire} bind:winner bind:reason={endReason} bind:alsoWon />
	</div>
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
	.winner {
		margin-top: var(--space-3);
	}
</style>
