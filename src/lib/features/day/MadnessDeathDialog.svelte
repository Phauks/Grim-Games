<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { MadnessOffer } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * A mad player broke madness that might kill (the Harpy's: the 1st player, the 2nd, both or
	 * neither, https://wiki.bloodontheclocktower.com/Harpy): the Storyteller switches on who
	 * dies, and Confirm marks them dead by that character. Nobody is chosen to start with.
	 */
	interface Props {
		open: boolean;
		game: DayPort;
		offer: MadnessOffer | undefined;
	}

	let { open = $bindable(), game, offer }: Props = $props();

	let chosen = $state<SeatId[]>([]);
	$effect(() => {
		if (open) chosen = [];
	});

	function confirm() {
		if (!offer) return;
		for (const seatId of chosen)
			game.run({ type: 'SetDead', seatId, dead: true, cause: offer.characterId });
	}
</script>

<ConfirmDialog
	bind:open
	title={t('day.madnessDeathTitle')}
	danger
	disabled={chosen.length === 0}
	onConfirm={confirm}
>
	<ul class="rows" data-testid="madness-deaths">
		{#each offer?.dies ?? [] as seatId (seatId)}
			<li>
				<PlayerBadge name={game.seatName(seatId)} />
				<!-- eslint-disable grim/names-as-badges -- hidden label (accessible name) only -->
				<Toggle
					hideLabel
					label={t('day.madnessDies', { who: game.seatName(seatId) })}
					checked={chosen.includes(seatId)}
					onChange={(on) =>
						(chosen = on ? [...chosen, seatId] : chosen.filter((id) => id !== seatId))}
				/>
				<!-- eslint-enable grim/names-as-badges -->
			</li>
		{/each}
	</ul>
</ConfirmDialog>

<style>
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rows li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		padding-block: var(--space-2);
	}
	.rows li + li {
		border-top: var(--card-border);
	}
</style>
