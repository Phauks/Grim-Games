<script lang="ts">
	import type { GenericLook } from '#lib/core/model/index.ts';
	import GenericLookDialog from './GenericLookDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * One of the bank's reusable ∞ tokens (plan B9, Trevor 2026-10-23: "Tokens only"): its
	 * symbol, colour and text, which every copy pulled from it starts with. Changing it leaves
	 * the copies already placed as they are. Drawn by GenericLookDialog.
	 */
	interface Props {
		grimoire: Grimoire;
		open?: boolean;
		tokenId?: string;
	}

	let { grimoire, open = $bindable(false), tokenId }: Props = $props();

	const token = $derived(grimoire.game.genericTokens?.find((t) => t.tokenId === tokenId));

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
	onDelete={() => token && grimoire.run({ type: 'RemoveGenericToken', tokenId: token.tokenId })}
	deleteLabel="Delete token"
/>
