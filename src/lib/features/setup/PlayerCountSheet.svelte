<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import SetupTable from './SetupTable.svelte';
	import { MAX_SELECT_PLAYERS, MIN_SELECT_PLAYERS } from './selection.svelte.ts';

	/**
	 * The player count with − and + steppers and the setup sheet under it, where tapping a column
	 * picks that count. Shared by character selection and New game (Trevor, 2026-10-17).
	 */
	interface Props {
		players: number;
		onChange: (players: number) => void;
		min?: number;
		max?: number;
	}

	let { players, onChange, min = MIN_SELECT_PLAYERS, max = MAX_SELECT_PLAYERS }: Props = $props();

	const set = (n: number) => onChange(Math.min(max, Math.max(min, n)));
</script>

<section class="controls" aria-label={t('setup.players')}>
	<div class="players">
		<span id="players-label">{t('setup.players')}</span>
		<button
			type="button"
			class="step"
			aria-label={t('setup.fewerPlayers')}
			disabled={players <= min}
			onclick={() => set(players - 1)}>−</button
		>
		<output aria-labelledby="players-label" data-testid="player-count">{players}</output>
		<button
			type="button"
			class="step"
			aria-label={t('setup.morePlayers')}
			disabled={players >= max}
			onclick={() => set(players + 1)}>+</button
		>
	</div>
	<Collapsible title={t('setup.sheet')} storageKey="setup:sheet">
		<SetupTable {players} onPick={set} />
	</Collapsible>
</section>

<style>
	.controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-2);
		padding-top: var(--space-2);
	}
	.players {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.players > span {
		flex: 1;
	}
	.step {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.step:hover {
		background: var(--surface-selected);
	}
	.step:disabled {
		opacity: 0.5;
		cursor: default;
	}
	output {
		min-width: 2ch;
		font-size: 1.4rem;
		font-weight: 700;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}
</style>
