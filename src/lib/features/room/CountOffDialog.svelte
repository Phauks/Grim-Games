<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { PlayerName } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CountOffTokens from './CountOffTokens.svelte';
	import { cancelCountOff, finishCountOff } from './count-off.ts';
	import { roomHost } from './host.svelte.ts';
	import { playersDialog } from './players-dialog.svelte.ts';

	/**
	 * Count off on the Storyteller's device (plan J40; Trevor, 2026-10-30): Seating's Count off starts it,
	 * the Storyteller locks who is 1 (Trevor, 2026-11-16: "lock 1, only allow selecting once a 1 is
	 * locked"), then watch
	 * the phones tap their numbers, name the numbers of players without a phone ("needs to allow
	 * for non phone users as well"), then Done puts that order and those names on the board as
	 * one step. Cancel ends it with the board as it was.
	 */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();

	const host = roomHost();
	const view = $derived(host.countOff);
	const first = $derived(view?.tokens.find((token) => token.number === 1));

	/**
	 * Who can be 1: the board's players in seat order, as their phone when one has that name,
	 * then the phones at the table without a seat (Trevor, 2026-11-16: the Storyteller locks
	 * the top of the clock before anyone counts).
	 */
	const firstOptions = $derived.by(() => {
		const key = (name: string) => name.trim().toLocaleLowerCase();
		const phones = [...host.members.filter((m) => m.seatId), ...host.unseatedInGame].filter(
			(m) => m.name
		);
		const used: string[] = [];
		const options: { value: string; label: PlayerName }[] = [];
		for (const seatId of game.game.seating) {
			const name = game.game.seats[seatId]?.playerName;
			if (!name || used.includes(key(name))) continue;
			const phone = phones.find((m) => key(m.name!) === key(name));
			used.push(key(name));
			options.push({ value: phone ? `m:${phone.memberId}` : `s:${seatId}`, label: name });
		}
		for (const m of phones) {
			if (used.includes(key(m.name!))) continue;
			used.push(key(m.name!));
			options.push({ value: `m:${m.memberId}`, label: m.name as PlayerName });
		}
		return options;
	});
	const firstValue = $derived(firstOptions.find((o) => o.label === first?.name)?.value);
	function lockFirst(value: string) {
		const [kind, id] = [value.slice(0, 2), value.slice(2)];
		const name = kind === 's:' ? game.game.seats[id as SeatId]?.playerName : undefined;
		host.send({ type: 'name-count', number: 1, ...(kind === 'm:' ? { memberId: id } : { name }) });
	}

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
		finishCountOff(game, run);
		playersDialog.countOff = false;
	}
	function cancel() {
		cancelCountOff();
		playersDialog.countOff = false;
	}
</script>

<Dialog bind:open={playersDialog.countOff} title={t('room.countOff.title')}>
	<div class="count-off" data-testid="count-off-host">
		<Select
			label={t('room.countOff.first')}
			options={firstOptions}
			value={firstValue}
			placeholder={t('room.countOff.pickFirst')}
			attention={!first}
			disabled={!view}
			onChange={lockFirst}
		>
			{#snippet item(option)}<PlayerBadge name={option.label as PlayerName} />{/snippet}
			{#snippet selected(option)}<PlayerBadge name={option.label as PlayerName} />{/snippet}
		</Select>
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
</style>
