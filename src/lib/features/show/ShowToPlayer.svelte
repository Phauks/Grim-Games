<script lang="ts">
	import { defaultAlignment, type Alignment, type Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { plainText } from '#lib/features/info-tokens/bold.ts';
	import InfoTokenText from '#lib/features/info-tokens/InfoTokenText.svelte';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { fitTokens } from './fit.ts';
	import CharacterLabel from './CharacterLabel.svelte';

	export interface ShownCharacter {
		character: Character;
		/** Which icon to show; defaults from the character type. */
		alignment?: Alignment;
	}

	interface Props {
		open?: boolean;
		/** Info-token text shown above the tokens; `**bold**` is supported. */
		title?: string;
		characters?: readonly ShownCharacter[];
		onclose?: () => void;
	}

	let { open = $bindable(false), title, characters = [], onclose }: Props = $props();

	let dialog = $state<HTMLDialogElement>();
	let areaWidth = $state(0);
	let areaHeight = $state(0);

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});

	const single = $derived(characters.length === 1 ? characters[0].character : undefined);
	const fit = $derived(
		fitTokens(single ? 1 : 0, areaWidth, areaHeight, {
			labelHeight: 48
		})
	);
	const label = $derived.by(() => {
		// Outside the error boundary, so it must not throw: the dialog has to stay up.
		try {
			return (
				[title ? plainText(title) : undefined, ...characters.map((c) => c.character.name)]
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
			<div class="content" data-has-title={title ? '' : undefined}>
				{#if title}
					<h2 class="title"><InfoTokenText text={title} /></h2>
				{/if}
				{#if single}
					<div class="area" bind:clientWidth={areaWidth} bind:clientHeight={areaHeight}>
						<div class="single" style:--size="{fit.size}px">
							<CharacterToken
								character={single}
								alignment={characters[0].alignment ?? defaultAlignment(single.type)}
								size={fit.size}
							/>
							<span class="name">{single.name}</span>
						</div>
					</div>
					<p class="ability">{single.ability}</p>
				{:else if characters.length > 1}
					<!-- Several characters (bluffs): a list with each ability, not tokens (Trevor). -->
					<ul class="list">
						{#each characters as shown (shown.character.id)}
							<li>
								<CharacterLabel
									character={shown.character}
									alignment={shown.alignment ?? defaultAlignment(shown.character.type)}
								/>
								<p>{shown.character.ability}</p>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
			{#snippet fallback()}
				<div class="content" data-testid="show-failed">
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
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		height: 100%;
		padding: calc(var(--tap-target) + var(--space-4) + env(safe-area-inset-top)) var(--space-4)
			calc(var(--space-5) + env(safe-area-inset-bottom));
		text-align: center;
	}
	.content:not([data-has-title]) {
		justify-content: center;
	}
	.title {
		margin: 0;
		max-width: 22ch;
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
		font-size: clamp(2rem, 9vw, 4rem);
		line-height: 1.15;
		color: var(--heading);
		overflow-wrap: anywhere;
	}
	.content:not(:has(.area)) .title {
		margin: auto 0;
	}
	.title :global(strong) {
		color: var(--accent);
	}
	.area {
		flex: 1;
		width: 100%;
		min-height: 0;
		display: grid;
		place-items: center;
	}
	.single {
		display: grid;
		justify-items: center;
		gap: var(--space-1);
	}
	.list {
		display: grid;
		gap: var(--space-4);
		width: min(100%, 40rem);
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
		text-align: start;
		font-size: 1.4rem;
	}
	.list li {
		display: grid;
		justify-items: start;
		gap: var(--space-2);
	}
	.list p {
		margin: 0;
		font-family: var(--font-ability);
		font-size: 1.2rem;
		line-height: 1.35;
	}
	.name {
		max-width: 100%;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		font-size: 1.4rem;
		line-height: 1.2;
		color: var(--heading);
	}
	.failed {
		margin: auto 0;
		font-size: 1.3rem;
		color: var(--on-surface-muted);
	}
	.ability {
		margin: 0;
		max-width: 32ch;
		font-family: var(--font-ability);
		font-size: 1.3rem;
		line-height: 1.35;
	}
</style>
