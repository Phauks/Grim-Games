<script lang="ts">
	import { untrack } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { reelsMove, spinReel } from '#lib/features/setup/reel.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';

	/**
	 * Sushi Buffet's slot machine (Trevor, 2026-10-23): one reel per character of the first
	 * offer. Each offer spins its reels to its characters; refusing it crosses out one reel and
	 * spins the rest to the new offer, so 3, 2, 1 ends with two crossed out. Purely visual: the
	 * offer is already decided, and the reels run through every character of the draft.
	 */
	interface Props {
		offer: readonly Character[];
		/** Reels in all: the first offer's size. */
		size: number;
		reel: readonly Character[];
		/** True while any reel spins. */
		spinning?: boolean;
	}

	let { offer, size, reel, spinning = $bindable(false) }: Props = $props();

	let faces = $state<(Character | undefined)[]>([]);
	let cancels: (() => void)[] = [];
	function stopAll() {
		for (const cancel of cancels) cancel();
		cancels = [];
		faces = [];
		spinning = false;
	}

	const key = $derived(offer.map((c) => c.id).join(' '));
	$effect(() => {
		void key;
		untrack(() => {
			stopAll();
			if (reel.length < 2 || !reelsMove()) return;
			spinning = true;
			let left = offer.length;
			offer.forEach((_, i) => {
				// The reels stop one after another, left to right.
				cancels.push(
					spinReel(
						reel,
						(character) => (faces[i] = character),
						() => {
							faces[i] = undefined;
							if (--left === 0) spinning = false;
						},
						1200 + 500 * i
					)
				);
			});
		});
		return stopAll;
	});
</script>

<div class="reels" data-testid="offer-reels" data-spinning={spinning ? '' : undefined}>
	{#each { length: size }, i (i)}
		{@const character = offer[i]}
		<div class="reel" data-testid="offer-reel" data-crossed={character ? undefined : ''}>
			{#if character}
				<CharacterToken character={faces[i] ?? character} size={72} showName={false} />
			{:else}
				<span class="cross"><Icon name="close" label={t('modes.deal.refused')} /></span>
			{/if}
		</div>
	{/each}
</div>

<style>
	.reels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
		gap: var(--space-2);
	}
	.reel {
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		overflow: hidden;
	}
	.cross {
		font-size: 2.5rem;
		color: var(--danger);
	}
</style>
