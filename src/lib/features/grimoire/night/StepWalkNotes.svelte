<script lang="ts">
	/**
	 * What a special rule says about tonight's step, as the strip under the board says it, for
	 * the step in the pane beside the board, which has no strip (Trevor, 2026-11-16).
	 */
	interface Props {
		/** A rule keeps the step's player asleep (I See Dead People), named by the rule. */
		asleepBy?: string;
		/** A rule leaves the step's seat to no one (The Ballad of Seat 7), named by the rule. */
		emptySeatBy?: string;
		/** The player a rule says the Demon attacks tonight (Trained Killer), and the rule. */
		attack?: { seat: string; by: string };
	}

	let { asleepBy, emptySeatBy, attack }: Props = $props();
</script>

{#if asleepBy || emptySeatBy || attack}<p class="notes">
		{#if asleepBy}<span class="evil" data-testid="step-asleep"
				>Poisoned: doesn’t wake ({asleepBy})</span
			>{/if}
		{#if emptySeatBy}<span class="muted" data-testid="step-empty-seat"
				>No player: make its choices ({emptySeatBy})</span
			>{/if}
		{#if attack}<span class="evil" data-testid="step-attack"
				>Attacks {attack.seat} ({attack.by})</span
			>{/if}
	</p>{/if}

<style>
	.notes {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0 var(--space-2);
		font-size: 0.9rem;
	}
	.evil {
		color: var(--evil-text);
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
