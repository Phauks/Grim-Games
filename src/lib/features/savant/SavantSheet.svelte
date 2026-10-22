<script lang="ts">
	import { untrack } from 'svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { dawnGames } from '#lib/core/engine/index.ts';
	import {
		holdsAsGiven,
		partnerTruth,
		pickStatement,
		savantPair,
		savantSituation,
		savantStatements,
		type SavantMode,
		type SavantStatement
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { noteText, statementText, TYPE_NAMES } from './statement-text.ts';

	/**
	 * Savant information (L2, Trevor 2026-10-22): one true and one false statement worked out
	 * from the grimoire (`core/rules/savant.ts`). Keep one and cycle the other; a suggestion,
	 * never the final word. "Use these" saves them as the Savant's note for today.
	 */
	interface Props {
		open?: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
	}

	let { open = $bindable(false), grimoire, seatId }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const pool = $derived(
		seatId === undefined
			? []
			: savantStatements(game, seatId, characters, dawnGames(grimoire.open.session.log))
	);
	const situation = $derived(
		seatId === undefined ? undefined : savantSituation(game, seatId, characters)
	);

	let mode = $state<SavantMode>('one-each');
	let lines = $state<(SavantStatement | undefined)[]>([undefined, undefined]);
	let locked = $state([false, false]);
	/** For a line only the Storyteller can check: whether it holds. */
	let assumed = $state([true, true]);

	function fill(slotIndex: number, want: boolean, avoid: SavantStatement[]) {
		const next = pickStatement(pool, want, avoid);
		lines[slotIndex] = next;
		assumed[slotIndex] = want;
	}

	/** A fresh pair, keeping a locked line. */
	function refresh() {
		const keep = [0, 1].find((i) => locked[i] && lines[i]);
		if (keep === undefined) {
			const pair = savantPair(pool, mode);
			lines = [pair[0], pair[1]];
			assumed = pair.map((s, i) =>
				s.truth === 'check'
					? mode === 'both-true'
						? true
						: mode === 'both-false'
							? false
							: i === 0
					: true
			) as [boolean, boolean];
			return;
		}
		if (locked[0] && locked[1]) return;
		cycle(keep === 0 ? 1 : 0);
	}

	function cycle(slotIndex: number) {
		const other = lines[slotIndex === 0 ? 1 : 0];
		const current = lines[slotIndex];
		const want = other
			? partnerTruth(other, mode, assumed[slotIndex === 0 ? 1 : 0])
			: mode !== 'both-false';
		fill(
			slotIndex,
			want,
			[other, current].filter((s): s is SavantStatement => s !== undefined)
		);
	}

	// A new pair each time the sheet opens, in the mode the rules point to. Only `open` is
	// tracked: locking or cycling must not start again.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			mode = situation?.mode ?? 'one-each';
			locked = [false, false];
			lines = [undefined, undefined];
			refresh();
		});
	});

	function setMode(next: SavantMode) {
		mode = next;
		refresh();
	}

	/** The Storyteller says whether a line only they can check holds; the other follows. */
	function setAssumed(slotIndex: number, value: boolean) {
		assumed[slotIndex] = value;
		const other = slotIndex === 0 ? 1 : 0;
		if (!locked[other]) cycle(other);
	}

	const modeOptions = $derived([
		{ value: 'one-each' as const, label: t('savant.modeOneEach') },
		{ value: 'both-true' as const, label: t('savant.modeBothTrue') },
		{ value: 'both-false' as const, label: t('savant.modeBothFalse') }
	]);

	/** Why the mode may differ, on one line kept for it so nothing moves. */
	const why = $derived(
		situation?.impaired
			? {
					text: t(
						situation.impaired === 'drunk'
							? 'savant.drunk'
							: situation.impaired === 'poisoned'
								? 'savant.poisoned'
								: 'savant.noAbility',
						{ character: slot('character') }
					),
					characterId: 'savant'
				}
			: situation?.vortox !== undefined
				? { text: t('savant.vortox', { character: slot('character') }), characterId: 'vortox' }
				: undefined
	);

	function truthLabel(s: SavantStatement): string {
		if (s.truth === 'either') {
			return t('savant.dependsOn', {
				seats: s.dependsOn.map((x) => seatLabel(game, x)).join(', ')
			});
		}
		return s.truth === 'true' ? t('savant.true') : t('savant.false');
	}

	function save() {
		if (seatId === undefined) return;
		const given = lines.flatMap((s, i) =>
			s
				? [
						t(holdsAsGiven(s, assumed[i]) ? 'savant.noteTrue' : 'savant.noteFalse', {
							statement: statementText(s, game, characters)
						})
					]
				: []
		);
		const existing = game.today.entries.findLast(
			(e) => e.kind === 'note' && e.characterId === 'savant' && e.seatId === seatId
		);
		const ok =
			existing && existing.kind === 'note'
				? grimoire.run({
						type: 'EditDayNote',
						entryId: existing.entryId,
						text: noteText(existing.text, given),
						...(existing.guesses ? { guesses: existing.guesses } : {})
					})
				: grimoire.run({
						type: 'DayNote',
						characterId: 'savant',
						seatId,
						text: noteText('', given)
					});
		if (ok) open = false;
	}
</script>

<BottomSheet
	bind:open
	title={seatId === undefined
		? t('savant.title')
		: t('savant.titleSeat', { seat: seatLabel(game, seatId) })}
>
	<div class="savant">
		<Select
			label={t('savant.mode')}
			value={mode}
			options={modeOptions}
			onChange={(v: SavantMode) => setMode(v)}
		/>
		<!-- Kept for the reason line, so the statements never move (Trevor's no-reflow rule). -->
		<p class="why" data-testid="savant-why">
			{#if why}<Sentence text={why.text}
					>{#snippet fill()}<CharacterBadge
							characterId={why.characterId}
							character={characters.get(why.characterId)}
						/>{/snippet}</Sentence
				>{/if}
		</p>

		{#each [0, 1] as i (i)}
			{@const line = lines[i]}
			<section
				class="line"
				aria-label={t('savant.statement', { number: i + 1 })}
				data-testid="savant-line"
			>
				<IconButton
					icon="lock"
					label={t('savant.lock', { number: i + 1 })}
					aria-pressed={locked[i]}
					disabled={!line}
					onclick={() => (locked[i] = !locked[i])}
				/>
				<div class="words">
					<p class="sentence">
						{#if line}
							{#each line.parts as part, j (j)}{#if 'text' in part}{part.text}{:else if 'seat' in part}{seatLabel(
										game,
										part.seat
									)}{:else if 'character' in part}<CharacterBadge
										characterId={part.character}
										character={characters.get(part.character)}
									/>{:else if 'type' in part}{TYPE_NAMES[part.type]}{:else}{part.number}{/if}{/each}
						{:else}
							{t('common.none')}
						{/if}
					</p>
					<p class="truth">
						{#if line?.truth === 'check'}
							<Chip pressed={assumed[i]} onclick={() => setAssumed(i, !assumed[i])}
								>{assumed[i] ? t('savant.checkTrue') : t('savant.checkFalse')}</Chip
							>
						{:else if line}
							<span data-truth={line.truth}>{truthLabel(line)}</span>
						{/if}
					</p>
				</div>
				<IconButton
					icon="random"
					label={t('savant.another', { number: i + 1 })}
					disabled={locked[i] || pool.length === 0}
					onclick={() => cycle(i)}
				/>
			</section>
		{/each}

		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={save}
			confirmLabel={t('savant.use')}
			disabled={!lines[0] && !lines[1]}
		/>
	</div>
</BottomSheet>

<style>
	.savant {
		display: grid;
		gap: var(--space-3);
	}
	.why {
		margin: 0;
		min-height: 1.5em;
		color: var(--on-surface-muted);
	}
	.line {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: start;
		gap: var(--space-2);
		padding: var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-md);
	}
	.words {
		display: grid;
		gap: var(--space-1);
	}
	.sentence {
		margin: 0;
		/* Two lines kept, so a shorter statement moves nothing. */
		min-height: 3em;
	}
	.truth {
		margin: 0;
		min-height: var(--tap-target);
		display: flex;
		align-items: center;
		color: var(--on-surface-muted);
	}
	[data-truth='true'] {
		color: var(--good);
	}
	[data-truth='false'] {
		color: var(--evil);
	}
</style>
