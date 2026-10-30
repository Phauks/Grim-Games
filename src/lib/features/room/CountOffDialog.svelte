<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import { countOffSeats } from '#lib/core/sync/room.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CountOffTokens from './CountOffTokens.svelte';
	import { roomHost } from './host.svelte.ts';
	import { playersDialog } from './players-dialog.svelte.ts';

	/**
	 * Count off on the Storyteller's device (plan J40; Trevor, 2026-10-30): the ⋯ item starts it
	 * (whoever is 1 taps it themselves: "shouldn't require storyteller to select 1"), then watch
	 * the phones tap their numbers, name the numbers of players without a phone ("needs to allow
	 * for non phone users as well"), then Done puts that order and those names on the board as
	 * one step. Cancel ends it with the board as it was.
	 */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();

	const host = roomHost();
	const view = $derived(host.countOff);
	const badge = (name: string) => name as PlayerName;
	const first = $derived(view?.tokens.find((token) => token.number === 1));

	/** The number whose player's name is being typed. */
	let naming = $state<number>();
	let typed = $state('');
	let nameOpen = $state(false);
	function tap(number: number) {
		naming = number;
		typed = view?.tokens.find((token) => token.number === number)?.name ?? '';
		nameOpen = true;
	}
	function saveName() {
		if (naming === undefined) return;
		host.send({ type: 'name-count', number: naming, ...(typed.trim() ? { name: typed } : {}) });
		nameOpen = false;
	}

	function done() {
		if (!view) return;
		const seats = countOffSeats(game.game.seating, game.game.seats, view);
		const command: Command = { type: 'CountOff', seats };
		if (run ? run(command) : game.run(command).ok) host.send({ type: 'end-count-off' });
		playersDialog.countOff = false;
	}
	function cancel() {
		if (view) host.send({ type: 'end-count-off' });
		playersDialog.countOff = false;
	}
</script>

<Dialog bind:open={playersDialog.countOff} title={t('room.countOff.title')}>
	<div class="count-off" data-testid="count-off-host">
		<p class="from">
			{#if first}{t('room.countOff.from')}
				<PlayerBadge name={badge(first.name)} />{:else}{t('room.countOff.fromOne')}{/if}
		</p>
		{#if view}<CountOffTokens {view} onTap={tap} />{/if}
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={cancel}
			onConfirm={done}
			disabled={!view}
			confirmLabel={t('room.countOff.done')}
		/>
	{/snippet}
</Dialog>

<ConfirmDialog
	bind:open={nameOpen}
	title={t('room.countOff.name', { number: naming ?? 0 })}
	onConfirm={saveName}
>
	<TextField
		label={t('room.countOff.name', { number: naming ?? 0 })}
		hideLabel
		bind:value={typed}
		maxlength={40}
		oncommit={saveName}
	/>
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
