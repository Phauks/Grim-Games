<script lang="ts">
	import {
		ACCOLADES,
		MAX_COMMENT_LENGTH,
		MAX_RATING,
		emptyFeedback,
		hasFeedback,
		toggleAccolade,
		type GameFeedback
	} from '#lib/core/feedback/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import type { RoomPlayer } from './player.svelte.ts';

	/**
	 * A player's feedback once the game is over (Trevor, 2026-10-20, plan R4): a rating in half
	 * stars, accolades for the Storyteller and a comment, anonymous unless they turn it off.
	 * It opens from Rate game and starts from what this phone last sent; Send replaces it.
	 */
	interface Props {
		player: RoomPlayer;
		open: boolean;
	}

	let { player, open = $bindable() }: Props = $props();

	let draft = $state<GameFeedback>(emptyFeedback());
	$effect(() => {
		if (open) draft = structuredClone($state.snapshot(player.view?.feedback) ?? emptyFeedback());
	});

	/** Tapping a star rates it; tapping the same star again takes off half. */
	function rate(star: number) {
		draft.rating = draft.rating === star ? star - 0.5 : star;
	}
	/** How much of a star is filled: 1, 0.5 or 0. */
	const fill = (star: number) => Math.max(0, Math.min(1, (draft.rating ?? 0) - star + 1));

	const offline = $derived(player.status !== 'open' || !player.view?.endedGameId);

	function send(event: SubmitEvent) {
		event.preventDefault();
		const comment = draft.comment?.trim();
		const feedback: GameFeedback = { ...$state.snapshot(draft), comment: comment || undefined };
		if (!comment) delete feedback.comment;
		if (player.sendFeedback(feedback)) open = false;
	}
</script>

<Dialog bind:open title={t('room.feedback.title')}>
	<form onsubmit={send} data-testid="feedback-sheet">
		<fieldset>
			<legend>{t('room.feedback.rating')}</legend>
			<div class="stars">
				{#each Array.from({ length: MAX_RATING }, (_, i) => i + 1) as star (star)}
					<button
						type="button"
						class="star"
						style:--fill="{fill(star) * 100}%"
						aria-label={t('room.feedback.star', { number: star })}
						aria-pressed={fill(star) > 0}
						onclick={() => rate(star)}>★</button
					>
				{/each}
				<!-- Always there, so a first rating moves nothing. -->
				<span class="value" data-testid="feedback-rating"
					>{draft.rating === undefined
						? ''
						: t('room.feedback.ratingValue', { rating: draft.rating })}</span
				>
			</div>
		</fieldset>
		<fieldset>
			<legend>{t('room.feedback.accolades')}</legend>
			<div class="accolades">
				{#each ACCOLADES as accolade (accolade.id)}
					<Chip
						type="button"
						pressed={draft.accolades.includes(accolade.id)}
						onclick={() => (draft = toggleAccolade(draft, accolade.id))}
						>{accolade.emoji} {t(`room.feedback.accolade.${accolade.id}`)}</Chip
					>
				{/each}
			</div>
		</fieldset>
		<TextField
			label={t('room.feedback.comment')}
			bind:value={() => draft.comment ?? '', (v) => (draft.comment = v)}
			multiline
			rows={3}
			maxlength={MAX_COMMENT_LENGTH}
		/>
		<Toggle
			label={t('room.feedback.anonymous')}
			checked={draft.anonymous}
			onChange={(on) => (draft.anonymous = on)}
		/>
		<ModalActions
			onCancel={() => (open = false)}
			submit
			disabled={offline || !hasFeedback(draft)}
			confirmLabel={t('room.feedback.send')}
		/>
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
	}
	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}
	legend {
		margin-bottom: var(--space-1);
	}
	.stars {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.star {
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		font-size: 2rem;
		line-height: 1;
		touch-action: manipulation;
		/* A half star is the star's left half in the accent colour. */
		background-image: linear-gradient(90deg, var(--accent) var(--fill), var(--border) var(--fill));
		background-clip: text;
		color: transparent;
		cursor: pointer;
	}
	.value {
		min-width: 4em;
		margin-inline-start: var(--space-2);
		font-variant-numeric: tabular-nums;
	}
	.accolades {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
