<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { untrack } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import {
		emptyProgress,
		markKnown,
		migratePractice,
		nextCard,
		type PracticeProgress
	} from './practice.ts';

	/**
	 * Practice this script (Trevor approved, 2026-10-16): a character's token and name; the
	 * answer is TPI's ability text, in a sheet so the page doesn't move. Progress stays on
	 * the device, one record per script.
	 */
	interface Props {
		characters: readonly Character[];
		/** The script's notebook key; progress is kept per script. */
		scriptKey: string;
	}

	let { characters, scriptKey }: Props = $props();

	const storageKey = $derived(`grim-games:practice:${scriptKey}`);
	function load(key: string): PracticeProgress {
		try {
			return migratePractice(JSON.parse(localStorage.getItem(key) ?? 'null')) ?? emptyProgress();
		} catch {
			return emptyProgress();
		}
	}
	function save(p: PracticeProgress) {
		progress = p;
		try {
			localStorage.setItem(storageKey, JSON.stringify(p));
		} catch {
			// Private browsing or full storage: progress lasts until the page closes.
		}
	}

	let progress = $state<PracticeProgress>(emptyProgress());
	let cardId = $state<string>();
	const ids = $derived(characters.map((c) => c.id));
	// A new script (key) starts from its own saved progress.
	$effect(() => {
		const saved = load(storageKey);
		untrack(() => {
			progress = saved;
			cardId = nextCard(ids, saved);
		});
	});
	const card = $derived(characters.find((c) => c.id === cardId));
	const knownCount = $derived(ids.filter((id) => progress.known.includes(id)).length);

	let answerOpen = $state(false);
	let resetOpen = $state(false);
	function answer(knew: boolean) {
		if (!cardId) return;
		const next = knew ? markKnown(progress, cardId) : progress;
		if (knew) save(next);
		answerOpen = false;
		cardId = nextCard(ids, next, cardId);
	}
</script>

<div class="practice">
	<div class="bar">
		<p class="count" data-testid="practice-count">
			{t('player.practiceKnown', { known: knownCount, total: ids.length })}
		</p>
		<Button variant="quiet" onclick={() => (resetOpen = true)} disabled={knownCount === 0}
			>{t('player.practiceReset')}</Button
		>
	</div>

	<!-- The card keeps its size whatever it shows, so nothing moves (Trevor). -->
	<div class="card" data-testid="practice-card" data-character={card?.id}>
		{#if card}
			<CharacterToken character={card} size={144} />
			<!-- Not a button: its dialog would show the answer. -->
			<h2><CharacterBadge characterId={card.id} character={card} interactive={false} /></h2>
			<p class="type">{TYPE_LABELS[card.type]}</p>
			<Button variant="accent" onclick={() => (answerOpen = true)}
				>{t('player.practiceShow')}</Button
			>
		{:else}
			<p class="done">{t('player.practiceDone')}</p>
		{/if}
	</div>
</div>

<BottomSheet bind:open={answerOpen} title={t('player.practiceAnswer')}>
	{#snippet heading()}
		{#if card}<CharacterBadge characterId={card.id} character={card} interactive={false} />{/if}
	{/snippet}
	{#if card}
		<p class="ability" data-testid="practice-answer">{card.ability}</p>
		<div class="answers">
			<Button onclick={() => answer(false)}>{t('player.practiceAgain')}</Button>
			<Button variant="accent" onclick={() => answer(true)}>{t('player.practiceKnew')}</Button>
		</div>
	{/if}
</BottomSheet>

<ConfirmDialog
	bind:open={resetOpen}
	title={t('player.practiceResetConfirm')}
	onConfirm={() => {
		save(emptyProgress());
		cardId = nextCard(ids, emptyProgress());
	}}
>
	<p>{t('player.practiceResetBody')}</p>
</ConfirmDialog>

<style>
	.practice {
		display: grid;
		gap: var(--space-3);
		max-width: var(--measure);
		margin: 0 auto;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.count {
		margin: 0;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
	}
	.card {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: var(--space-2);
		min-height: calc(22 * var(--u));
		padding: var(--space-4);
		border: 1px solid var(--border);
		border-radius: var(--space-3);
		background: var(--surface-raised);
		text-align: center;
	}
	h2 {
		margin: 0;
		color: var(--heading);
		font-family: var(--font-character);
	}
	.type,
	.done {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.ability {
		margin: 0 0 var(--space-3);
		font-family: var(--font-ability);
		font-size: 1.1rem;
		line-height: 1.4;
	}
	.answers {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
	}
</style>
