<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
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
	/**
	 * Up to 3 cards are shown together on one screen (Trevor, 2026-10-16: chains are mostly
	 * one or two cards); longer chains are swiped through, so nothing gets too small to read.
	 */
	const MAX_TOGETHER = 3;
	const together = $derived(shownCards.length > 1 && shownCards.length <= MAX_TOGETHER);
	const chain = $derived(shownCards.length > MAX_TOGETHER);

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
					.join(': ') || t('show.shownToPlayer')
			);
		} catch {
			return t('show.shownToPlayer');
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
	Esc closes only this view (the dialog's own cancel), never a sheet open under it: sheets
	listen for Esc on the document, so it is stopped here, on the window, before them.
-->
<svelte:window
	onkeydowncapture={(event) => {
		if (open && event.key === 'Escape') event.stopPropagation();
	}}
/>

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
	onpointerdown={(event) => {
		// Opened from inside a sheet (Trevor, 2026-10-17: the sheet stays open underneath), the
		// sheet must not take a tap or swipe here as a drag or a tap outside it.
		event.stopPropagation();
	}}
	onkeydown={(event) => {
		if (!chain) return;
		if (event.key === 'ArrowRight') go(current + 1);
		if (event.key === 'ArrowLeft') go(current - 1);
	}}
>
	{#if open}
		<span class="close"><IconButton icon="close" label={t('common.close')} onclick={close} /></span>
		<!--
			A crash inside is caught here, inside the opaque dialog, so the fallback is still
			full screen and the grimoire never shows through; the close button stays above it.
		-->
		<ErrorBoundary area="show">
			{#if together}
				<div class="together" style:--count={shownCards.length}>
					{#each shownCards as card, i (i)}
						<section
							class="cell"
							aria-label={t('show.card', { number: i + 1, count: shownCards.length })}
						>
							<ShownCard
								title={card.title}
								characters={card.characters}
								detail={card.detail}
								compact
							/>
						</section>
					{/each}
				</div>
			{:else if chain}
				<!-- A chain of cards: swipe, or use the arrows, to move between them. -->
				<div class="track" bind:this={track} {onscroll}>
					{#each shownCards as card, i (i)}
						<section
							class="page"
							aria-label={t('show.card', { number: i + 1, count: shownCards.length })}
							inert={i !== current}
						>
							<ShownCard title={card.title} characters={card.characters} detail={card.detail} />
						</section>
					{/each}
				</div>
				<div class="nav">
					<button
						type="button"
						class="arrow"
						aria-label={t('show.previousCard')}
						disabled={current === 0}
						onclick={() => go(current - 1)}><Icon name="back" /></button
					>
					<ol class="dots" aria-label={t('show.cards')}>
						{#each [...shownCards.keys()] as i (i)}
							<li aria-current={i === current ? 'step' : undefined}></li>
						{/each}
					</ol>
					<button
						type="button"
						class="arrow"
						aria-label={t('show.nextCard')}
						disabled={current === shownCards.length - 1}
						onclick={() => go(current + 1)}><Icon name="forward" /></button
					>
				</div>
			{:else}
				<ShownCard
					title={shownCards[0]?.title}
					characters={shownCards[0]?.characters}
					detail={shownCards[0]?.detail}
				/>
			{/if}
			{#snippet fallback()}
				<div class="fallback" data-testid="show-failed">
					<p class="failed">{t('show.failed')}</p>
				</div>
			{/snippet}
		</ErrorBoundary>
	{/if}
</dialog>

<style>
	/* The page's colours, not a sheet's, even when opened from inside one. */
	.show {
		--surface: var(--player-view-surface);
		--surface-raised: var(--player-view-raised);
		--surface-selected: var(--player-view-selected);
		--on-surface: var(--player-view-ink);
		--on-surface-muted: var(--player-view-muted);
		--border: var(--player-view-border);
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
		--icon-size: calc(1.5 * var(--u));
	}
	/* Raised so it shows over a card; the hover tint is the shared one, over this fill. */
	.close :global(.icon-button) {
		background-color: var(--surface-raised);
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
	/* Side by side on a wide screen, one above the other on a phone held upright. */
	.together {
		display: grid;
		grid-template-rows: repeat(var(--count), minmax(0, 1fr));
		height: 100%;
		padding: calc(var(--tap-target) + var(--space-2) + env(safe-area-inset-top)) var(--space-2)
			calc(var(--space-2) + env(safe-area-inset-bottom));
	}
	.cell {
		min-height: 0;
	}
	.cell + .cell {
		border-top: 1px solid var(--border);
	}
	@media (orientation: landscape) {
		.together {
			grid-template-rows: none;
			grid-template-columns: repeat(var(--count), minmax(0, 1fr));
		}
		.cell + .cell {
			border-top: 0;
			border-left: 1px solid var(--border);
		}
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
		background: var(--border);
	}
	.dots li[aria-current='step'] {
		background: var(--accent);
	}
</style>
