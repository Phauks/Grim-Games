<script lang="ts">
	import { defaultAlignment } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import InfoTokenText from '#lib/features/info-tokens/InfoTokenText.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import JinxNote from '#lib/features/characters/JinxNote.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import type { ShownCharacter } from './shown.ts';

	interface Props {
		/** Info-token text shown above the characters; `**bold**` is supported. */
		title?: string;
		characters?: readonly ShownCharacter[];
		/** What the Storyteller filled in (a secret word), shown as typed under the title. */
		detail?: string;
		/** Shares the screen with other cards: smaller text, no room kept for the close button. */
		compact?: boolean;
		/**
		 * Characters as big tokens, or only as rows the way the script sheet lists them; the
		 * Storyteller's choice in Settings (Trevor, 2026-11-02: "they can decide which they like
		 * better").
		 */
		tokens?: boolean;
	}

	let { title, characters = [], detail, compact = false, tokens }: Props = $props();

	const asTokens = $derived(tokens ?? preferences.current.assistance.characterTokens);

	let areaWidth = $state(0);
	let areaHeight = $state(0);
	let captionHeight = $state(0);

	/**
	 * A short answer (a number, Yes/No, True/False, a custom card's choice) fills the space it
	 * has, sized by its length so it stays on one line (Trevor, 2026-10-30: "Your number is 1"
	 * was small and hard to read; "consider other short infos like yes no true false").
	 */
	const short = $derived(!!detail && detail.length <= 12);

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

{#snippet jinxList(shown: ShownCharacter)}
	{#if shown.jinxes?.length}
		<!-- The character's jinxes in effect, under its ability (Trevor, 2026-11-04). -->
		<ul class="jinxes" data-testid="shown-jinxes">
			{#each shown.jinxes as jinx (jinx.characters.join('+'))}
				<li><JinxNote {jinx} characters={shown.jinxCharacters} /></li>
			{/each}
		</ul>
	{/if}
{/snippet}

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
	{#if characters.length > 1 || (characters.length > 0 && !asTokens)}
		<!-- Rows, as the script sheet lists them: always for several characters (Trevor,
		     2026-11-14: "Rows only", the standard way, with the ability readable from afar),
		     and for one when the Storyteller's setting turns tokens off. -->
		<div class="area rows-area">
			<ul class="rows" data-testid="shown-rows">
				{#each characters as shown (shown.character.id)}
					<li>
						<CharacterPiece
							template="row"
							character={shown.character}
							alignment={shown.alignment}
						/>
						{@render jinxList(shown)}
					</li>
				{/each}
			</ul>
		</div>
	{:else if single}
		<!-- The token, its name and its ability, together in the middle of the screen. -->
		<div class="area" bind:clientWidth={areaWidth} bind:clientHeight={areaHeight}>
			<div class="single" data-testid="shown-character">
				<CharacterToken
					character={single}
					alignment={characters[0].alignment ?? defaultAlignment(single.type)}
					{size}
				/>
				<!-- The name and ability as the Script tab shows them, under the token, as the bag
				     draw's reveal does (Trevor, 2026-11-02: "the standard way we show characters"). -->
				<div class="caption" bind:clientHeight={captionHeight}>
					<CharacterPiece template="row" character={single} alignment={characters[0].alignment} />
					{@render jinxList(characters[0])}
				</div>
			</div>
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
	/* --card-fit shrinks the words to fit an editor's preview (CardEditorLayout). */
	.content[data-compact] .title {
		font-size: calc(clamp(1.3rem, 5vw, 2.4rem) * var(--card-fit, 1));
	}
	.content[data-compact] .caption,
	.content[data-compact] .rows {
		font-size: 1.05rem;
	}
	.content:not([data-has-title]) {
		justify-content: center;
	}
	.title {
		margin: 0;
		max-width: 22ch;
		/* A card's own lines and typed lists (Trevor, 2026-10-31). */
		white-space: pre-line;
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
		font-size: calc(clamp(1.6rem, 7vw, 3rem) * var(--card-fit, 1));
	}
	/*
	 * A short answer: as big as the card allows, each character taking about 0.6em, under the
	 * title when there is one.
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
		width: 100%;
		gap: var(--space-4);
	}
	.caption {
		width: min(100%, 32rem);
		font-size: clamp(1.1rem, 4.5vw, 1.5rem);
		text-align: start;
	}
	.jinxes {
		display: grid;
		gap: var(--space-2);
		margin: var(--space-3) 0 0;
		padding: var(--space-2) 0 0;
		list-style: none;
		border-top: 1px solid var(--border); /* px-ok: hairline */
		font-size: 0.85em;
	}
	/* Rows scroll inside the card's space rather than push it (no reflow). */
	.rows-area {
		overflow-y: auto;
	}
	.rows {
		display: grid;
		gap: var(--space-3);
		width: min(100%, 32rem);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: clamp(1.1rem, 4.5vw, 1.5rem);
		text-align: start;
	}
</style>
