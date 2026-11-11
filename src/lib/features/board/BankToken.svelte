<script lang="ts">
	import type { Alignment, Character, CharacterId } from '#lib/core/data/index.ts';
	import BoardReminder from './BoardReminder.svelte';
	import NewTokenButton from './NewTokenButton.svelte';
	import ReminderCount from './ReminderCount.svelte';
	import { bankView, type BankItem } from './bank-items.ts';

	/**
	 * One token in a reminder tray, as the bank draws it: "+ New token", or the token with its
	 * ×count when stacked. The Storyteller's bank (ReminderBank) and a player's tray
	 * (player/PlayerReminderBin) alike (Trevor, 2026-11-06: "the same components for parity").
	 */
	interface Props {
		item: BankItem;
		characters: ReadonlyMap<CharacterId, Character>;
		/** Whose it is on the board: the owner's alignment and a holder's icon. */
		placing?: { alignment?: Alignment; holder?: Character };
		size: number;
		disabled: boolean;
		/** "+ New token" glows while a reminder is dragged (`over` while above it). */
		glow?: 'ready' | 'over';
		onNew: () => void;
		onTap: () => void;
		onMenu?: () => void;
		onDrag: (x: number, y: number, end: boolean) => void;
		onCancel: () => void;
		panX: boolean;
	}

	let {
		item,
		characters,
		placing,
		size,
		disabled,
		glow,
		onNew,
		onTap,
		onMenu,
		onDrag,
		onCancel,
		panX
	}: Props = $props();
</script>

{#if item.makesToken}
	<NewTokenButton {glow} {size} {disabled} onclick={onNew} />
{:else}
	{#if item.count > 1}<ReminderCount count={item.count} />{/if}
	<BoardReminder
		{...bankView(item, characters)}
		{...placing}
		{size}
		{disabled}
		{onTap}
		{onMenu}
		{onDrag}
		{onCancel}
		{panX}
	/>
{/if}
