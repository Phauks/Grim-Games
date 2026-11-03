<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, PlayerName } from '#lib/core/data/index.ts';
	import type { SeatRole } from '#lib/core/sync/seat-roles.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import RoleCard from './RoleCard.svelte';
	import VoteChoice from './VoteChoice.svelte';

	/**
	 * The player's own character on their phone (Trevor, 2026-10-26: "Storyteller tells people
	 * they can see it on their screen. It becomes a hold to see."). No button of its own (Trevor,
	 * 2026-11-03: "I dislike how big the button is"): while players may see theirs the status
	 * line turns into Your character (PlayerStatusRow), which calls `show`. The first hold tells
	 * the Storyteller it was seen. The Storyteller's player view asks which seat first
	 * (Trevor, 2026-10-30), then shows that seat's card as its phone does.
	 */
	interface SeatChoice {
		seatId: string;
		seatNumber: number;
		name?: PlayerName;
		role?: SeatRole;
	}
	interface Props {
		/** This phone's own role, while players may see theirs. */
		role?: SeatRole;
		/** The game's script characters, before the official ones. */
		characters?: readonly Character[];
		/** The first hold of a role, to tell the Storyteller. */
		onSeen?: () => void;
		/** The Storyteller's player view: every seat, while players may see theirs. */
		seats?: readonly SeatChoice[];
	}

	let { role: own, characters, onSeen, seats }: Props = $props();

	/** The seat the Storyteller chose to see as. */
	let chosen = $state<string>();
	const role = $derived(seats ? seats.find((s) => s.seatId === chosen)?.role : own);
	let open = $state(false);
	let picking = $state(false);
	$effect(() => {
		if (seats && !seats.some((s) => s.role)) picking = false;
	});
	export function show() {
		if (seats) picking = true;
		else open = true;
	}
	function pick(seatId: string) {
		chosen = seatId;
		picking = false;
		open = true;
	}
</script>

{#if seats}
	<Dialog bind:open={picking} title={t('room.role.open')}>
		<ul class="seats" data-testid="role-seats">
			{#each seats as seat (seat.seatId)}
				<li>
					<VoteChoice
						mark={seat.seatNumber}
						pressed={false}
						disabled={!seat.role}
						onclick={() => pick(seat.seatId)}
						>{#if seat.name}<PlayerBadge name={seat.name} />{:else}{t('common.seat', {
								number: seat.seatNumber
							})}{/if}</VoteChoice
					>
				</li>
			{/each}
		</ul>
	</Dialog>
{/if}

<RoleCard bind:open {role} {characters} {onSeen} />

<style>
	.seats {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
</style>
