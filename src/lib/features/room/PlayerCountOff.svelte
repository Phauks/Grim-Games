<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CountOffTokens from './CountOffTokens.svelte';
	import type { RoomPlayer } from './player.svelte.ts';

	/**
	 * Count off on a phone (plan J40; Trevor, 2026-10-30: "ppl select, and call it a day if it
	 * seems accurate"): a sheet over whatever the phone shows, with no grim behind it. It opens
	 * when the Storyteller starts one, and again while this phone has no number yet.
	 */
	let { player }: { player: RoomPlayer } = $props();

	const view = $derived(player.view?.countOff);
	const first = $derived(view?.tokens.find((token) => token.number === 1));
	let open = $state(false);
	let seen = '';
	$effect(() => {
		const now = view ? JSON.stringify(view) : '';
		if (now === seen) return;
		seen = now;
		open = !!view && (open || !view.tokens.some((token) => token.mine));
	});

	/** A number someone else holds, waiting for Confirm before it is taken. */
	let taking = $state<{ number: number; name: string }>();
	let confirming = $state(false);
	function tap(number: number) {
		const holder = view?.tokens.find((token) => token.number === number);
		if (holder?.mine) return;
		if (!holder) {
			player.count(number);
			return;
		}
		taking = holder;
		confirming = true;
	}
</script>

{#if view}
	<Dialog bind:open title={t('room.countOff.title')}>
		<div class="count-off" data-testid="count-off">
			<p class="from">
				{#if first}{t('room.countOff.from')}
					<PlayerBadge name={first.name as PlayerName} />{:else}{t('room.countOff.fromOne')}{/if}
			</p>
			<CountOffTokens {view} onTap={tap} />
		</div>
	</Dialog>
{/if}

<ConfirmDialog
	bind:open={confirming}
	title={t('room.countOff.take', { number: taking?.number ?? 0 })}
	onConfirm={() => taking && player.count(taking.number)}
>
	{#if taking}<p>
			<PlayerBadge name={taking.name as PlayerName} />
			{t('room.countOff.takeFrom')}
		</p>{/if}
</ConfirmDialog>

<style>
	.count-off {
		display: grid;
		gap: var(--space-3);
	}
	.from {
		margin: 0;
	}
</style>
