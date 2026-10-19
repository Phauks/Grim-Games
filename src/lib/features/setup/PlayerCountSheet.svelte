<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import SetupTable from './SetupTable.svelte';
	import { MAX_SELECT_PLAYERS, MIN_SELECT_PLAYERS } from './selection.svelte.ts';
	import { toast } from '#lib/ui/primitives/toaster.ts';

	/**
	 * The player count with its stepper and the setup sheet under it, where tapping a column
	 * picks that count. Shared by character selection and New game (Trevor, 2026-10-17).
	 */
	interface Props {
		players: number;
		onChange: (players: number) => void;
		min?: number;
		max?: number;
		/** The sheet's heading, and the section's name; one per town names its town. */
		title?: string;
		/** Where the sheet's open state is kept; each town keeps its own. */
		storageKey?: string;
		testid?: string;
		/** The most players the script is made for (Teensyville: 6); more are greyed out. */
		maxPlayers?: number;
	}

	let {
		players,
		onChange,
		min = MIN_SELECT_PLAYERS,
		max = MAX_SELECT_PLAYERS,
		title,
		storageKey = 'setup:sheet',
		testid = 'player-count',
		maxPlayers
	}: Props = $props();

	function set(n: number) {
		const next = Math.min(max, Math.max(min, n));
		// Warns once on the way past the script's limit, never blocks.
		if (maxPlayers !== undefined && next > maxPlayers && players <= maxPlayers)
			toast(t('setup.tooManyPlayers'), t('setup.tooManyPlayersFor', { max: maxPlayers }));
		onChange(next);
	}
</script>

<section class="controls" aria-label={title ?? t('setup.players')}>
	<!-- One line (Trevor, 2026-10-18): the Setup sheet toggle, then Players beside its count. -->
	<Collapsible title={title ?? t('setup.sheet')} level={3} {storageKey}>
		{#snippet aside()}
			<div class="players">
				<span>{t('setup.players')}</span>
				<Stepper
					value={players}
					label={t('setup.players')}
					lessLabel={t('setup.fewerPlayers')}
					moreLabel={t('setup.morePlayers')}
					{min}
					{max}
					onchange={set}
					large
					{testid}
				/>
			</div>
		{/snippet}
		<SetupTable {players} onPick={set} {maxPlayers} />
	</Collapsible>
</section>

<style>
	/* A card like the setup check's, so the page's sections share one look. */
	.controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 0;
		padding: var(--space-1) var(--space-3) var(--space-2);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.players {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
