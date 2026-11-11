<script lang="ts">
	import { scriptCharacterIds, type GenericLook } from '#lib/core/model/index.ts';
	import GenericLookDialog from './GenericLookDialog.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

	/**
	 * One of the bank's reusable ∞ tokens (plan B9, Trevor 2026-10-23: "Tokens only"): its
	 * symbol, colour and text, which every copy pulled from it starts with. Changing it leaves
	 * the copies already placed as they are. Drawn by GenericLookDialog.
	 */
	interface Props {
		grimoire: Grimoire;
		open?: boolean;
		tokenId?: string;
		/** Just made by "+ New token": closing without Confirm deletes it. */
		fresh?: boolean;
		/** After Confirm (a new token goes into the hand). */
		onConfirm?: () => void;
		/** Its trash: asks first (DeleteTokenConfirm); a token just made goes at once. */
		onDelete: (tokenId: string) => void;
		/** ⋯ Duplicate: a new token with this look. */
		onDuplicate?: (look: GenericLook) => void;
	}

	let {
		grimoire,
		open = $bindable(false),
		tokenId,
		fresh = false,
		onConfirm,
		onDelete,
		onDuplicate
	}: Props = $props();

	const scriptCharacters = $derived(
		scriptCharacterIds(grimoire.game.script).flatMap((id) => {
			const character = grimoire.open.characters.get(id);
			return character ? [character] : [];
		})
	);
	const token = $derived(grimoire.game.genericTokens.find((t) => t.tokenId === tokenId));

	function set(change: GenericLook) {
		if (!token) return;
		const { tokenId: id, ...look } = token;
		grimoire.run({ type: 'SetGenericToken', tokenId: id, look: { ...look, ...change } });
	}
</script>

<GenericLookDialog
	bind:open
	look={token}
	tokenKey={token?.tokenId}
	art={token?.like ? grimoire.open.characters.get(token.like.characterId) : undefined}
	onChange={set}
	onDelete={() => {
		if (!token) return;
		if (fresh) grimoire.run({ type: 'RemoveGenericToken', tokenId: token.tokenId });
		else onDelete(token.tokenId);
	}}
	deleteLabel="Delete token"
	{fresh}
	{onConfirm}
	{onDuplicate}
	{scriptCharacters}
/>
