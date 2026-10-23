<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		MAX_SCRIPT_VOTE_OPTIONS,
		MIN_SCRIPT_VOTE_OPTIONS,
		SCRIPT_VOTE_KINDS,
		type ScriptVoteKind
	} from '#lib/core/sync/script-vote.ts';
	import type { ScriptChoiceOption } from '#lib/features/modes/script-choices.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { roomHost } from './host.svelte.ts';

	/**
	 * The room's vote on the next script (Trevor, 2026-10-20, plan R1): the Storyteller offers
	 * two or three scripts, players vote on their phones, and the Storyteller picks from the
	 * count. New game shows it; the room only counts.
	 */
	interface Props {
		open: boolean;
		/** The scripts New game offers, by its own ids. */
		choices: ScriptChoiceOption[];
		/** The Storyteller picked this script from the count. */
		onPick: (id: string) => void;
	}

	let { open = $bindable(), choices, onPick }: Props = $props();

	const host = roomHost();
	const tally = $derived(host.scriptVote);
	let picked = $state<string[]>([]);
	let kind = $state<ScriptVoteKind>('single');
	const kinds = SCRIPT_VOTE_KINDS.map((value) => ({
		value,
		label: t(`room.scriptVote.kind.${value}`)
	}));
	const ready = $derived(
		picked.length >= MIN_SCRIPT_VOTE_OPTIONS && picked.length <= MAX_SCRIPT_VOTE_OPTIONS
	);

	function openVote() {
		const options = picked.flatMap((id) => {
			const choice = choices.find((c) => c.value === id);
			return choice
				? [{ id, name: choice.label, ...(choice.author ? { author: choice.author } : {}) }]
				: [];
		});
		if (host.openScriptVote(kind, options)) picked = [];
	}

	function pick(id: string) {
		host.closeScriptVote();
		open = false;
		onPick(id);
	}
</script>

<BottomSheet bind:open title={t('room.scriptVote.title')}>
	{#if tally}
		<p class="count" data-testid="script-vote-count">
			{t('room.scriptVote.voted', { voted: tally.voted, members: tally.members })}
		</p>
		<ul class="results" data-testid="script-vote-results">
			{#each tally.options as option (option.id)}
				<li>
					<span class="name">{option.name}</span>
					<span class="points"
						>{t(tally.kind === 'ranked' ? 'room.scriptVote.points' : 'room.scriptVote.votes', {
							count: tally.points[option.id] ?? 0
						})}</span
					>
					<Button onclick={() => pick(option.id)}>{t('room.scriptVote.play')}</Button>
				</li>
			{/each}
		</ul>
		<Button variant="danger" onclick={() => host.closeScriptVote()}
			>{t('room.scriptVote.close')}</Button
		>
	{:else}
		<form
			class="new"
			onsubmit={(e) => {
				e.preventDefault();
				if (ready) openVote();
			}}
		>
			<Select
				label={t('room.scriptVote.scripts')}
				multiple
				options={choices.map((c) => ({ value: c.value, label: c.label }))}
				values={picked}
				onValuesChange={(v) => (picked = v)}
				placeholder={t('common.none')}
			/>
			<Select
				label={t('room.scriptVote.how')}
				options={kinds}
				value={kind}
				onChange={(v) => (kind = v)}
			/>
			<ModalActions
				onCancel={() => (open = false)}
				submit
				disabled={!ready || !host.code}
				confirmLabel={t('room.scriptVote.open')}
			/>
		</form>
	{/if}
</BottomSheet>

<style>
	.new {
		display: grid;
		gap: var(--space-4);
	}
	.count {
		margin: 0 0 var(--space-3);
		color: var(--on-surface-muted);
	}
	.results {
		display: grid;
		gap: var(--space-2);
		margin: 0 0 var(--space-4);
		padding: 0;
		list-style: none;
	}
	.results li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-3);
	}
	.points {
		font-variant-numeric: tabular-nums;
	}
</style>
