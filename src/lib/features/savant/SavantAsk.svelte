<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { dayClaim } from '#lib/core/rules/day/day-claims.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import AidMenu from '#lib/features/settings/AidMenu.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { untrack } from 'svelte';
	import SavantSheet from './SavantSheet.svelte';

	/**
	 * The board's Savant sheet (L5) and the question that offers it before Dawn (Trevor,
	 * 2026-10-23: L46, a question, never a block; 2026-11-06: before Dawn, not after it).
	 */
	let { grimoire }: { grimoire: Grimoire } = $props();

	let seatId = $state<SeatId | undefined>();
	let open = $state(false);
	let askOpen = $state(false);
	/** The sheet sets the information for the day Dawn begins. */
	let ahead = $state(false);
	let after: (() => void) | undefined;

	/** Opens the sheet for a Savant's seat (the day view's Savant info button). */
	export function show(seat: SeatId): void {
		seatId = seat;
		open = true;
	}

	/** Offers a living Savant's information, then runs `next` (Dawn) once it is all closed. */
	export function ask(next: () => void): void {
		const game = grimoire.game;
		const seat =
			preferences.current.assistance.savantInfo && !grimoire.open.viewOnly
				? game.seating.find(
						(id) =>
							dayClaim(game, game.seats[id].characterId ?? '', grimoire.open.characters) ===
								'statements' && !game.seats[id].dead
					)
				: undefined;
		if (seat === undefined) return next();
		seatId = seat;
		after = next;
		askOpen = true;
	}

	$effect(() => {
		if (askOpen || open || !after) return;
		const next = after;
		after = undefined;
		ahead = false;
		untrack(next);
	});
</script>

<!-- During a night, the information is for the day Dawn begins. -->
<SavantSheet bind:open {grimoire} {seatId} ahead={ahead || grimoire.nightUnderway} />
<ConfirmDialog
	bind:open={askOpen}
	title={t('day.savantAsk')}
	onConfirm={() => {
		ahead = true;
		open = true;
	}}
>
	{#snippet headActions()}<AidMenu aid="savantInfo" />{/snippet}
</ConfirmDialog>
