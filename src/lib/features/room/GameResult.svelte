<script lang="ts">
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { recapPagePath, type SharedRecap } from '#lib/features/history/recap-share-api.ts';
	import { fetchSharedRecap } from '#lib/features/history/recap-share.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import type { RoomPlayer } from './player.svelte.ts';
	import { roomScript } from './room-script.svelte.ts';

	/**
	 * The top of the Game over sheet (Trevor, 2026-11-12, plan R4 option A): this phone's
	 * character at the end, "You won as" or "You lost as", and Share result, which shares the
	 * game's name-free result page (game-result.ts) with "I won as the [character]". Laid out
	 * the same while the result loads, so nothing moves when it comes.
	 */
	interface Props {
		player: RoomPlayer;
		open: boolean;
	}

	let { player, open }: Props = $props();

	const id = $derived(player.view?.ended?.result);
	const winner = $derived(player.view?.ended?.winner);
	let shared = $state.raw<{ id: string; result: SharedRecap }>();
	let sharing = $state(false);

	$effect(() => {
		if (!open || !id || shared?.id === id) return;
		let current = true;
		const wanted = id;
		void fetchSharedRecap(wanted).then((result) => {
			if (current && typeof result !== 'string') shared = { id: wanted, result };
		});
		return () => (current = false);
	});

	const result = $derived(shared?.id === id ? shared?.result : undefined);
	const seatId = $derived(player.view?.me.seatId);
	const end = $derived(result?.recap.seats.find((s) => s.seatId === seatId)?.end);
	const character = $derived.by((): Character | undefined => {
		const characterId = end?.id;
		if (!characterId) return undefined;
		return (
			roomScript(player.code)?.characters.find((c) => c.id === characterId) ??
			officialData.current?.characters.find((c) => c.id === characterId)
		);
	});
	const alignment = $derived(
		end?.alignment ?? (character ? defaultAlignment(character.type) : undefined)
	);
	const won = $derived(!!alignment && alignment === winner);
	const url = $derived(result && id ? `${location.origin}${recapPagePath(id)}` : undefined);
	const text = $derived.by(() => {
		if (!result) return '';
		const script = result.recap.title;
		if (end)
			return t(won ? 'room.result.shareWon' : 'room.result.shareLost', {
				character: end.name,
				script
			});
		return t('room.result.shareGame', { result: result.recap.result, script });
	});
</script>

<div class="result" data-testid="game-result">
	<span class="token">
		{#if character}<CharacterToken {character} size={72} />{/if}
	</span>
	<p class="line" data-testid="game-result-line">
		{#if end && character}{won ? t('room.result.won') : t('room.result.lost')}
			<CharacterPiece
				template="badge"
				characterId={character.id}
				{character}
				{alignment}
				interactive={false}
			/>{/if}
	</p>
	<Button icon="share" disabled={!url} onclick={() => (sharing = true)}
		>{t('room.result.share')}</Button
	>
</div>

<Dialog bind:open={sharing} title={t('room.result.share')}>
	<SharePanel
		{url}
		title={t('room.result.share')}
		qrLabel={t('room.result.qr')}
		pending=""
		{text}
	/>
</Dialog>

<style>
	.result {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: auto auto;
		align-items: center;
		justify-items: start;
		column-gap: var(--space-3);
		row-gap: var(--space-2);
		padding-bottom: var(--space-3);
		border-bottom: 1px solid var(--border);
	}
	.token {
		grid-row: span 2;
		/* Kept while the result loads, so nothing moves when the token comes. */
		min-width: calc(4.5 * var(--u));
		min-height: calc(4.5 * var(--u));
	}
	.line {
		min-height: 1.5em;
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.2rem;
	}
</style>
