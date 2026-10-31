<!--
	The game's notes as a token in the board's top left corner, after the Fabled and Loric and at
	their size (Trevor, 2026-10-31: "it needs to size to the same size as those tokens"). It is
	there only while the game has notes, as a seat's note mark is, and opens Players, where the
	game's notes come first.
-->
<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import TokenFace from '#lib/ui/token/TokenFace.svelte';

	interface Props {
		/** The Fabled and Loric tokens' size, in px. */
		size: number;
		count: number;
		onclick: () => void;
	}

	let { size, count, onclick }: Props = $props();
	const NO_LEAVES = { firstNight: false, otherNight: false, reminders: 0 };
</script>

<button
	type="button"
	class="game-notes-token"
	data-testid="game-notes-token"
	aria-label={`${t('room.players.gameNotes')}: ${count}`}
	style:--size="{size}px"
	{onclick}
>
	<TokenFace label={t('room.players.gameNotes')} leaves={NO_LEAVES} {size} />
	<span class="glyph" aria-hidden="true"><Icon name="notes" /></span>
</button>

<style>
	.game-notes-token {
		position: relative;
		display: grid;
		flex: none;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.game-notes-token > :global(*) {
		grid-area: 1 / 1;
	}
	/* The notes icon drawn on the parchment, as a character's art is; positioned, so it
	   paints over the face (which is positioned too). */
	.glyph {
		position: relative;
		display: grid;
		place-items: center;
		color: var(--on-token);
		--icon-size: calc(var(--size) * 0.5);
		pointer-events: none;
	}
</style>
