<script lang="ts">
	import { DEFAULT_SHARE_CHOICES, type ShareChoices } from '#lib/core/engine/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import ShareChoicesFields from '#lib/features/room/ShareChoicesFields.svelte';

	/**
	 * Game over, in the day timer's place once the game has ended (Trevor, 2026-11-15, option B:
	 * "you could have B replace the timer?"), clear of the script's logo in the seat ring. The
	 * pill says who won and opens what is about this game: Share grim, Export game and Player
	 * feedback. Reopen game and New game stay only in ⋯ ("perhaps we don't include them here,
	 * and only in the ...?"). Share grim asks what goes with the grimoire, a switch each.
	 */
	interface Props {
		winner?: 'good' | 'evil';
		/** "Good won", "Evil won" or "Winner not recorded". */
		text: string;
		/** A spectator's board or the final grimoire on a phone: the pill is only a label. */
		watching: boolean;
		onExport: () => void;
		onFeedback?: () => void;
		/** Only while the room is connected and the grimoire hasn't gone to the phones yet. */
		onShareGrim?: (choices: ShareChoices) => void;
	}

	let { winner, text, watching, onExport, onFeedback, onShareGrim }: Props = $props();

	let shareOpen = $state(false);
	/** The grimoire's characters and reminders always go; the rest is the Storyteller's call. */
	let choices = $state.raw<ShareChoices>(DEFAULT_SHARE_CHOICES);

	const items = $derived([
		...(onShareGrim
			? [
					{
						value: 'share-grim',
						label: t('room.shareGrim.button'),
						icon: 'shareGrim' as const,
						onSelect: () => {
							choices = DEFAULT_SHARE_CHOICES;
							shareOpen = true;
						}
					}
				]
			: []),
		{
			value: 'export',
			label: 'Export game',
			icon: 'download' as const,
			onSelect: onExport
		},
		...(onFeedback
			? [
					{
						value: 'feedback',
						label: t('room.feedback.view'),
						icon: 'feedback' as const,
						onSelect: onFeedback
					}
				]
			: [])
	]);
</script>

{#snippet face()}
	<!-- On a phone only "Good won" shows, so the pill clears the first seat; the words stay. -->
	<span class="prefix">{`${t('room.gameOver')}: `}</span>{text}
{/snippet}

{#if watching}
	<span class="game-over-pill" role="status" data-testid="game-over" data-team={winner}
		>{@render face()}</span
	>
{:else}
	<Menu
		label={`${t('room.gameOver')}: ${text}`}
		{items}
		triggerAttrs={{ 'data-testid': 'game-over', 'data-team': winner, class: 'game-over-pill' }}
	>
		{#snippet trigger()}{@render face()}<Icon name="expand" />{/snippet}
	</Menu>
{/if}

<ConfirmDialog
	bind:open={shareOpen}
	title={t('room.shareGrim.title')}
	onConfirm={() => onShareGrim?.(choices)}
>
	<p class="dialog-text">{t('room.shareGrim.body')}</p>
	<ShareChoicesFields bind:choices />
</ConfirmDialog>

<style>
	.dialog-text {
		margin: 0;
	}
	/* The board's old Game over label, now the menu's button, in the winning team's colour;
	   repeated class to win over a menu button's own look, padding and open colour. */
	:global(.game-over-pill.game-over-pill.game-over-pill) {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		min-height: var(--tap-target);
		border-radius: var(--radius-full);
		gap: var(--space-1);
		max-width: 100%;
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--on-surface);
		font-family: var(--font-heading);
		font-size: 0.9rem;
		white-space: nowrap;
	}
	:global(.game-over-pill.game-over-pill.game-over-pill[data-team='good']) {
		background: var(--good);
		color: var(--on-good);
	}
	:global(.game-over-pill.game-over-pill.game-over-pill[data-team='evil']) {
		background: var(--evil);
		color: var(--on-evil);
	}
	@media (max-width: 40rem) {
		.prefix {
			display: none;
		}
	}
</style>
