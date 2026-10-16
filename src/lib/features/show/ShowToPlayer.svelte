<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { plainText } from '#lib/features/info-tokens/bold.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import ShownCard from './ShownCard.svelte';
	import type { ShownCharacter, ShownInfoCard } from './shown.ts';

	interface Props {
		open?: boolean;
		/** Info-token text shown above the tokens; `**bold**` is supported. */
		title?: string;
		characters?: readonly ShownCharacter[];
		/**
		 * Several cards in a row, which the player moves through left and right (Trevor,
		 * 2026-10-16). Given, `title` and `characters` are not used.
		 */
		cards?: readonly ShownInfoCard[];
		onclose?: () => void;
	}

	let { open = $bindable(false), title, characters = [], cards, onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let track = $state<HTMLDivElement>();
	let current = $state(0);

	const shownCards = $derived<readonly ShownInfoCard[]>(cards ?? [{ title, characters }]);
	const chain = $derived(shownCards.length > 1);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) {
			current = 0;
			dialog.showModal();
		}
		if (!open && dialog.open) dialog.close();
	});

	const label = $derived.by(() => {
		// Outside the error boundary, so it must not throw: the dialog has to stay up.
		try {
			const card = shownCards[current] ?? shownCards[0];
			return (
				[
					card?.title ? plainText(card.title) : undefined,
					...(card?.characters ?? []).map((c) => c.character.name)
				]
					.filter(Boolean)
					.join(': ') || 'Shown to player'
			);
		} catch {
			return 'Shown to player';
		}
	});

	function close() {
		open = false;
		onclose?.();
	}

	function go(index: number) {
		if (!track) return;
		const next = Math.max(0, Math.min(shownCards.length - 1, index));
		track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' });
		current = next;
	}

	function onscroll() {
		if (!track || track.clientWidth === 0) return;
		current = Math.round(track.scrollLeft / track.clientWidth);
	}
</script>

<!--
	Shown to a player, so it fully covers the grimoire: nothing behind it is visible. Views
	that only the Storyteller sees dim and blur what is behind them instead. That is the
	hide-vs-blur convention from Pocket Grimoire's README: opaque means "safe to show",
	blurred means "Storyteller only". Only the close button closes it (Pocket Grimoire #28):
	a stray tap on the background must not reveal the grimoire.
-->
<dialog
	bind:this={dialog}
	class="show"
	aria-label={label}
	data-testid="show-to-player"
	oncancel={(event) => {
		event.preventDefault();
		close();
	}}
	onkeydown={(event) => {
		if (!chain) return;
		if (event.key === 'ArrowRight') go(current + 1);
		if (event.key === 'ArrowLeft') go(current - 1);
	}}
>
	{#if open}
		<button type="button" class="close" aria-label="Close" onclick={close}>
			<Icon name="close" />
		</button>
		<!--
			A crash inside is caught here, inside the opaque dialog, so the fallback is still
			full screen and the grimoire never shows through; the close button stays above it.
		-->
		<ErrorBoundary area="show">
			{#if chain}
				<!-- A chain of cards: swipe, or use the arrows, to move between them. -->
				<div class="track" bind:this={track} {onscroll}>
					{#each shownCards as card, i (i)}
						<section
							class="page"
							aria-label="Card {i + 1} of {shownCards.length}"
							inert={i !== current}
						>
							<ShownCard title={card.title} characters={card.characters} />
						</section>
					{/each}
				</div>
				<div class="nav">
					<button
						type="button"
						class="arrow"
						aria-label="Previous card"
						disabled={current === 0}
						onclick={() => go(current - 1)}><Icon name="back" /></button
					>
					<ol class="dots" aria-label="Cards">
						{#each [...shownCards.keys()] as i (i)}
							<li aria-current={i === current ? 'step' : undefined}></li>
						{/each}
					</ol>
					<button
						type="button"
						class="arrow"
						aria-label="Next card"
						disabled={current === shownCards.length - 1}
						onclick={() => go(current + 1)}><Icon name="forward" /></button
					>
				</div>
			{:else}
				<ShownCard title={shownCards[0]?.title} characters={shownCards[0]?.characters} />
			{/if}
			{#snippet fallback()}
				<div class="fallback" data-testid="show-failed">
					<p class="failed">Couldn't show this.</p>
				</div>
			{/snippet}
		</ErrorBoundary>
	{/if}
</dialog>

<style>
	.show {
		width: 100vw;
		max-width: none;
		height: 100dvh;
		max-height: none;
		margin: 0;
		padding: 0;
		border: 0;
		/* Opaque: the grimoire must not show through (see the comment above). Canvas is an
		   opaque system colour, used if the theme's surface is ever missing. */
		background: var(--surface, Canvas);
		color: var(--on-surface);
		overscroll-behavior: none;
	}
	.show::backdrop {
		background: var(--surface, Canvas);
	}
	.close {
		position: absolute;
		top: calc(var(--space-2) + env(safe-area-inset-top));
		right: calc(var(--space-2) + env(safe-area-inset-right));
		z-index: 1;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		cursor: pointer;
		--icon-size: calc(1.5 * var(--u));
	}
	.close:hover {
		background: var(--surface-selected);
	}
	.failed {
		margin: auto 0;
		font-size: 1.3rem;
		color: var(--on-surface-muted);
	}
	.fallback {
		display: grid;
		place-items: center;
		height: 100%;
	}
	.track {
		display: flex;
		height: 100%;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		overscroll-behavior-x: contain;
	}
	.track::-webkit-scrollbar {
		display: none;
	}
	.page {
		flex: none;
		width: 100%;
		height: 100%;
		/* Room for the arrows and dots at the bottom. */
		padding-bottom: calc(var(--tap-target) + var(--space-3));
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}
	.nav {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(var(--space-2) + env(safe-area-inset-bottom));
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
	}
	.arrow {
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		border: 0;
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
		cursor: pointer;
	}
	.arrow:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.arrow:not(:disabled):hover {
		background: var(--surface-selected);
	}
	.dots {
		display: flex;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.dots li {
		width: 0.6rem;
		height: 0.6rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, currentColor 30%, transparent);
	}
	.dots li[aria-current='step'] {
		background: var(--accent);
	}
</style>
