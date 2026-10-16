<script lang="ts">
	import { defaultAlignment } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import InfoTokenText from '#lib/features/info-tokens/InfoTokenText.svelte';
	import { fitTokens } from './fit.ts';
	import CharacterLabel from './CharacterLabel.svelte';
	import type { ShownCharacter } from './shown.ts';

	interface Props {
		/** Info-token text shown above the characters; `**bold**` is supported. */
		title?: string;
		characters?: readonly ShownCharacter[];
	}

	let { title, characters = [] }: Props = $props();

	let areaWidth = $state(0);
	let areaHeight = $state(0);

	const single = $derived(characters.length === 1 ? characters[0].character : undefined);
	const fit = $derived(
		fitTokens(single ? 1 : 0, areaWidth, areaHeight, {
			labelHeight: 48,
			// A computer window has room for a bigger token than a phone (Trevor, 2026-10-16).
			max: 640
		})
	);
</script>

<!-- One card as the player sees it: the card's text, then one big token or a list. -->
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
	.ability {
		margin: 0;
		max-width: 32ch;
		font-family: var(--font-ability);
		font-size: 1.3rem;
		line-height: 1.35;
	}
</style>
