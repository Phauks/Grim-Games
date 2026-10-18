<script lang="ts">
	import { defaultAlignment } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import InfoTokenText from '#lib/features/info-tokens/InfoTokenText.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import type { ShownCharacter } from './shown.ts';

	interface Props {
		/** Info-token text shown above the characters; `**bold**` is supported. */
		title?: string;
		characters?: readonly ShownCharacter[];
		/** What the Storyteller filled in (a secret word), shown as typed under the title. */
		detail?: string;
		/** Shares the screen with other cards: smaller text, no room kept for the close button. */
		compact?: boolean;
	}

	let { title, characters = [], detail, compact = false }: Props = $props();

	let areaWidth = $state(0);
	let areaHeight = $state(0);
	let captionHeight = $state(0);

	const single = $derived(characters.length === 1 ? characters[0].character : undefined);
	/**
	 * The token never fills the screen (Trevor, 2026-10-17): at most three quarters of the
	 * width and just over half the height, and always leaving room for the name and ability.
	 */
	const size = $derived(
		Math.max(
			64,
			Math.floor(Math.min(areaWidth * 0.75, areaHeight * 0.55, areaHeight - captionHeight - 16))
		)
	);
</script>

<!-- One card as the player sees it: the card's text, then one big token or a list. -->
<div
	class="content"
	data-has-title={title ? '' : undefined}
	data-compact={compact ? '' : undefined}
>
	{#if title}
		<h2 class="title"><InfoTokenText text={title} /></h2>
	{/if}
	{#if detail}
		<p class="detail">{detail}</p>
	{/if}
	{#if single}
		<!-- The token, its name and its ability, together in the middle of the screen. -->
		<div class="area" bind:clientWidth={areaWidth} bind:clientHeight={areaHeight}>
			<div class="single" data-testid="shown-character">
				<CharacterToken
					character={single}
					alignment={characters[0].alignment ?? defaultAlignment(single.type)}
					{size}
				/>
				<div class="caption" bind:clientHeight={captionHeight}>
					<span class="name"
						><CharacterBadge
							characterId={single.id}
							character={single}
							alignment={characters[0].alignment}
							interactive={false}
						/></span
					>
					<p class="ability">{single.ability}</p>
				</div>
			</div>
		</div>
	{:else if characters.length > 1}
		<!-- Several characters (bluffs): a list with each ability, not tokens (Trevor). -->
		<ul class="list">
			{#each characters as shown (shown.character.id)}
				<li>
					<CharacterBadge
						characterId={shown.character.id}
						character={shown.character}
						alignment={shown.alignment ?? defaultAlignment(shown.character.type)}
						interactive={false}
					/>
					<p>{shown.character.ability}</p>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
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
	/* Several cards on one screen (Trevor, 2026-10-16): each fits its own share. */
	.content[data-compact] {
		gap: var(--space-2);
		padding: var(--space-3);
		overflow-y: auto;
	}
	.content[data-compact] .title {
		font-size: clamp(1.3rem, 5vw, 2.4rem);
	}
	.content[data-compact] .ability {
		font-size: 1.05rem;
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
	.detail {
		margin: 0;
		max-width: 22ch;
		font-family: var(--font-heading);
		font-size: clamp(2.4rem, 11vw, 5rem);
		line-height: 1.1;
		color: var(--accent);
		overflow-wrap: anywhere;
	}
	/* A number on its own (the Number card): as big as the screen allows. */
	.content:not([data-has-title]) .detail {
		margin-block: auto;
		font-size: clamp(6rem, 45vmin, 20rem);
		line-height: 1;
	}
	.content[data-compact] .detail {
		font-size: clamp(1.6rem, 7vw, 3rem);
	}
	.content:not(:has(.area)) .title {
		margin: auto 0;
	}
	/* A title with a word under it: the two sit together in the middle. */
	.content:not(:has(.area)):has(.detail) .title {
		margin: auto 0 0;
	}
	.content:not(:has(.area)) .detail {
		margin-bottom: auto;
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
		gap: var(--space-4);
	}
	.caption {
		display: grid;
		justify-items: center;
		gap: var(--space-3);
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
	/* The shared badge, larger: it names the character the player is being shown. */
	.name {
		max-width: 100%;
		font-size: clamp(1.3rem, 5vw, 1.8rem);
		--character-icon-scale: 1.4;
	}
	.ability {
		margin: 0;
		max-width: 32ch;
		font-family: var(--font-ability);
		font-size: clamp(1.25rem, 4.5vw, 1.8rem);
		line-height: 1.35;
	}
	.content[data-compact] .name {
		font-size: 1.1rem;
		--character-icon-scale: 1;
	}
</style>
