<!--
	Putting a token from the reminder bank on a seat (ReminderBank), with what else it offers:
	a Duplicate copy's Remove, a reminder's ⋯, or an ∞ token's Edit.
-->
<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import type { BankItem } from './bank-items.ts';
	import { seatMisfits } from './board.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import ReminderMoreButton from './ReminderMoreButton.svelte';
	import { isGeneric } from './reminders.ts';
	import SeatChooser from './SeatChooser.svelte';

	interface Props {
		grimoire: Grimoire;
		open: boolean;
		/** The token being put. */
		item: BankItem | undefined;
		onChoose: (seatId: SeatId) => void;
		/** Done with the token another way: removed, or changed from its ⋯. */
		onDone: () => void;
		/** Opens the ∞ token's editor. */
		onEditToken: (tokenId: string) => void;
	}

	let { grimoire, open = $bindable(), item, onChoose, onDone, onEditToken }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	/** The seats the token being put doesn't fit, faded in the list (Trevor, 2026-10-27). */
	const misfits = $derived(item ? seatMisfits(game, item, characters, grimoire.atDawn) : undefined);
</script>

<SeatChooser bind:open title="Put on" {game} {characters} {misfits} {onChoose}>
	{#snippet heading()}
		Put {#if item}<ReminderToken
				label={isGeneric(item) ? item.label || '∞' : item.label}
				character={characters.get(item.characterId)}
			/>{/if} on
	{/snippet}
	{#snippet headActions()}
		<!-- Duplicate from the bank too; the copy stays in the bank (Trevor, 2026-10-20). -->
		{#if item && !isGeneric(item)}
			<!-- A Duplicate copy goes back out of the bank, as one on the board does (Trevor,
			     2026-10-24). -->
			{#if item.extra && grimoire.bankCopyCount(item) > 0}
				{@const copy = item}
				<DeleteButton
					label="Remove reminder"
					onclick={() => {
						grimoire.removeBankCopy(copy);
						onDone();
					}}
				/>
			{/if}
			<ReminderMoreButton {grimoire} reminder={item} {onDone} />
		{:else if item?.token}
			{@const tokenId = item.token.tokenId}
			<IconButton icon="edit" label="Edit token" onclick={() => onEditToken(tokenId)} />
		{/if}
	{/snippet}
</SeatChooser>
