<script lang="ts">
	import { registersAsDead, type SeatId } from '#lib/core/model/index.ts';
	import { tokenGiverInfo } from '#lib/core/rules/index.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import AlignmentPill from './AlignmentPill.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import SeatBadge from './SeatBadge.svelte';

	/**
	 * The vote tokens a player holds who votes only with them (`voter.needsToken`: the Beggar,
	 * https://wiki.bloodontheclocktower.com/Beggar), and Add for a dead player giving one
	 * (Trevor, 2026-11-03: on the Beggar's own sheet, "allows more votes"). The dialog asks who
	 * gave it, every dead player offered with those whose ghost vote is spent listed last (warn,
	 * never lock), and says what to tell the receiver about the giver (`tokenGiverInfo`): both
	 * alignments when the giver may register as either, or when the receiver's ability does not
	 * work. Confirm spends the giver's ghost vote and adds the token (`GiveVoteToken`).
	 */
	interface Props {
		grimoire: Grimoire;
		seatId: SeatId;
	}

	let { grimoire, seatId }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const tokens = $derived(game.seats[seatId]?.voteTokens ?? 0);
	const givers = $derived(
		game.seating
			.filter((id) => id !== seatId && registersAsDead(game, id, characters))
			.sort((a, b) => Number(game.seats[a].ghostVoteUsed) - Number(game.seats[b].ghostVoteUsed))
	);
	let open = $state(false);
	let from = $state<SeatId>();
	const info = $derived(from ? tokenGiverInfo(game, from, seatId, characters) : undefined);
	const tell = $derived(
		info ? (info.unreliable ? (['good', 'evil'] as const) : info.alignments) : []
	);

	function start() {
		from = givers[0];
		open = true;
	}
	function confirm() {
		if (from) grimoire.run({ type: 'GiveVoteToken', from, to: seatId });
	}
</script>

{#snippet giver(option: { value: string })}<SeatBadge
		{game}
		{characters}
		seatId={option.value}
		interactive={false}
	/>{/snippet}

<span class="tokens">
	<span class="count" data-testid="vote-token-count">{tokens}</span>
	<Chip data-testid="vote-token-add" disabled={givers.length === 0} onclick={start}
		><Icon name="add" />Add</Chip
	>
</span>

<ConfirmDialog bind:open title="Add vote token" disabled={!from} onConfirm={confirm}>
	<div class="fields">
		<Select
			label="From"
			value={from}
			options={givers.map((id) => ({ value: id, label: seatName(game, id) }))}
			item={giver}
			selected={giver}
			onChange={(id) => (from = id)}
		/>
		<span class="label"
			>Tell {#if info}the <SeatBadge
					{game}
					{characters}
					{seatId}
					interactive={false}
				/>{:else}them{/if}</span
		>
		<span class="tell" data-testid="vote-token-tell">
			{#each tell as alignment, i (alignment)}{#if i > 0}or{/if}<AlignmentPill
					{alignment}
					text={alignment === 'good' ? 'Good' : 'Evil'}
				/>{:else}None{/each}
		</span>
	</div>
</ConfirmDialog>

<style>
	.tokens {
		display: inline-flex;
		align-items: center;
		gap: var(--space-3);
	}
	.count {
		min-width: 1.5em;
		text-align: center;
		font-size: 1.1rem;
	}
	.fields {
		display: grid;
		gap: var(--space-2);
	}
	.label {
		margin-top: var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.tell {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
	}
</style>
