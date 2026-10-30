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
	let nameHeight = $state(0);

	/**
	 * A one-word answer (a number, Yes, True) fills the space it has, sized by its length so
	 * it never wraps (Trevor, 2026-10-30: "Your number is 1" was small and hard to read).
	 */
	const short = $derived(!!detail && detail.length <= 6 && !/\s/.test(detail));

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

	/**
	 * Several characters (the Demon's bluffs) are tokens too, not lines of text (Trevor,
	 * 2026-10-27): as large as fits, trying each number of columns, each with its name below.
	 */
	let tokenList = $state<HTMLUListElement>();
	let gap = $state(0);
	/** Each name's own width: a column is as wide as the widest name, if wider than its token. */
	let nameWidths = $state<number[]>([]);
	$effect(() => {
		void areaWidth;
		if (tokenList) gap = parseFloat(getComputedStyle(tokenList).columnGap) || 0;
	});
	const many = $derived.by(() => {
		const n = characters.length;
		const widestName = Math.max(0, ...nameWidths.slice(0, n));
		let best = { size: 0, columns: 1 };
		for (let columns = 1; columns <= n; columns++) {
			const rows = Math.ceil(n / columns);
			const across = (areaWidth - gap * (columns - 1)) / columns;
			// More columns only while the names still fit side by side.
			if (columns > 1 && widestName > across) break;
			const down = (areaHeight - rows * (nameHeight + gap)) / rows;
			const size = Math.floor(Math.min(across, down, areaWidth * 0.75, areaHeight * 0.55));
			if (size > best.size) best = { size, columns };
		}
		const size = Math.max(48, best.size);
		return {
			size,
			columns: best.columns,
			width: Math.min(areaWidth, Math.max(size, widestName))
		};
	});
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
		<p
			class="detail"
			data-short={short ? '' : undefined}
			style:--length={short ? Math.max(2, detail.length) : undefined}
		>
			{detail}
		</p>
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
		<!-- Several characters (bluffs): tokens with their names (Trevor, 2026-10-27). -->
		<div class="area" bind:clientWidth={areaWidth} bind:clientHeight={areaHeight}>
			<ul
				class="tokens"
				bind:this={tokenList}
				style:max-width="{many.columns * many.width + (many.columns - 1) * gap}px"
				data-testid="shown-characters"
			>
				{#each characters as shown, i (shown.character.id)}
					<li style:width="{many.width}px">
						<CharacterToken
							character={shown.character}
							alignment={shown.alignment ?? defaultAlignment(shown.character.type)}
							size={many.size}
						/>
						<span class="name" bind:clientHeight={nameHeight} bind:clientWidth={nameWidths[i]}
							><CharacterBadge
								characterId={shown.character.id}
								character={shown.character}
								alignment={shown.alignment ?? defaultAlignment(shown.character.type)}
								interactive={false}
							/></span
						>
					</li>
				{/each}
			</ul>
		</div>
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
		/* A short answer is sized by the card's own space, also when it shares the screen. */
		container-type: size;
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
		/* Readable on every theme and sheet background, unlike the accent (Trevor, 2026-10-30). */
		color: var(--on-surface);
		overflow-wrap: anywhere;
	}
	.content[data-compact] .detail {
		font-size: clamp(1.6rem, 7vw, 3rem);
	}
	/*
	 * A number or one-word answer: as big as the card allows, each character taking about
	 * 0.6em, under the title when there is one.
	 */
	.detail[data-short],
	.content[data-compact] .detail[data-short] {
		max-width: none;
		font-size: min(calc(140cqi / var(--length)), 45cqb);
		line-height: 1;
		overflow-wrap: normal;
	}
	.content:not([data-has-title]) .detail {
		margin-block: auto;
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
	.tokens {
		/* Flex, not grid: a short last row sits in the middle. */
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		width: 100%;
		gap: var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tokens li {
		flex: 0 0 auto;
		display: grid;
		justify-items: center;
		align-content: start;
		gap: var(--space-2);
		min-width: 0;
	}
	/* The shared badge, larger: it names the character the player is being shown. */
	.name {
		max-width: 100%;
		font-size: clamp(1.3rem, 5vw, 1.8rem);
	}
	.ability {
		margin: 0;
		max-width: 32ch;
		font-family: var(--font-ability);
		font-size: clamp(1.25rem, 4.5vw, 1.8rem);
		line-height: 1.35;
	}
	/* Several names share the width, so each is a size smaller than a single one. */
	.tokens .name {
		max-width: none;
		font-size: clamp(1rem, 3.5vw, 1.4rem);
	}
	.content[data-compact] .name {
		font-size: 1.1rem;
	}
</style>
