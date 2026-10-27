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
		type SavantPart,
		type SavantStatement
	} from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { seatLabel, seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { noteText, savedStatements, statementText, TYPE_NAMES } from './statement-text.ts';

	/**
	 * Savant information (L2, Trevor 2026-10-22): one true and one false statement worked out
	 * from the grimoire (`core/rules/savant.ts`), each cycled on its own; a suggestion, never
	 * the final word. Each says whether it is true and why (L49), the Storyteller can write
	 * their own instead (L47), and the eye shows them to the player like info tokens, without
	 * either (L50). "Use these" saves them as the Savant's note for today. Two panes (Trevor,
	 * 2026-10-24): what the Savant was given on earlier days, then today's to edit.
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
	/** For a line only the Storyteller can check: whether it holds. */
	let assumed = $state([true, true]);
	/** A line the Storyteller writes: its words, or undefined for a worked-out line. */
	let own = $state<(string | undefined)[]>([undefined, undefined]);
	/** Whether a written line is true. */
	let ownTrue = $state([true, false]);
	let showOpen = $state(false);

	function fill(slotIndex: number, want: boolean, avoid: SavantStatement[]) {
		const next = pickStatement(pool, want, avoid);
		lines[slotIndex] = next;
		assumed[slotIndex] = want;
	}

	/** A fresh pair; a line the Storyteller wrote stays. */
	function refresh() {
		const written = [0, 1].find((i) => own[i] !== undefined);
		if (written !== undefined) {
			if (own[written === 0 ? 1 : 0] === undefined) cycle(written === 0 ? 1 : 0);
			return;
		}
		const pair = savantPair(pool, mode);
		lines = [pair[0], pair[1]];
		assumed = [0, 1].map((i) =>
			pair[i]?.truth === 'check'
				? mode === 'both-true'
					? true
					: mode === 'both-false'
						? false
						: i === 0
				: true
		);
	}

	/** Another worked-out line in a slot, in place of whatever was there. */
	function another(slotIndex: number) {
		own[slotIndex] = undefined;
		cycle(slotIndex);
	}

	/** Whether a slot holds, as given. */
	function holds(slotIndex: number): boolean | undefined {
		if (own[slotIndex] !== undefined) return ownTrue[slotIndex];
		const line = lines[slotIndex];
		return line ? holdsAsGiven(line, assumed[slotIndex]) : undefined;
	}

	function cycle(slotIndex: number) {
		const otherIndex = slotIndex === 0 ? 1 : 0;
		if (own[otherIndex] !== undefined) {
			const want =
				mode === 'both-true' ? true : mode === 'both-false' ? false : !ownTrue[otherIndex];
			const current = lines[slotIndex];
			fill(slotIndex, want, current ? [current] : []);
			return;
		}
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

	/** How a saved statement starts in the note, so it can be read back. */
	const prefixes = $derived([
		t('savant.noteTrue', { statement: '' }),
		t('savant.noteFalse', { statement: '' })
	]);
	/** The Savant's note for today, where Use these saves the statements. */
	const todayNote = $derived.by(() => {
		const note = game.today.entries.findLast(
			(e) => e.kind === 'note' && e.characterId === 'savant' && e.seatId === seatId
		);
		return note?.kind === 'note' ? note : undefined;
	});

	/** What the Savant was told on earlier days, the latest first. */
	const earlier = $derived(
		seatId === undefined
			? []
			: game.pastDays
					.flatMap((log, day) =>
						log.entries.flatMap((e) =>
							e.kind === 'note' && e.characterId === 'savant' && e.seatId === seatId
								? [{ day, ...savedStatements(e.text, prefixes) }]
								: []
						)
					)
					.filter((d) => d.statements.length > 0 || d.rest !== '')
					.reverse()
	);

	// Today's saved statements when the sheet opens (Trevor, 2026-10-24: they seemed not to
	// save, as a fresh pair was dealt each time); otherwise a new pair in the mode the rules
	// point to. Only `open` is tracked: locking or cycling must not start again.
	$effect(() => {
		if (!open) return;
		untrack(() => {
			mode = situation?.mode ?? 'one-each';
			lines = [undefined, undefined];
			const saved = todayNote ? savedStatements(todayNote.text, prefixes).statements : [];
			if (saved.length > 0) {
				own = [saved[0]?.words ?? '', saved[1]?.words ?? ''];
				ownTrue = [saved[0]?.truth ?? true, saved[1]?.truth ?? false];
				return;
			}
			own = [undefined, undefined];
			ownTrue = [true, false];
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
		if (own[other] === undefined) cycle(other);
	}

	/** Writes a slot's line, starting from the worked-out words. */
	function write(slotIndex: number) {
		const line = lines[slotIndex];
		ownTrue[slotIndex] = holds(slotIndex) ?? slotIndex === 0;
		own[slotIndex] = line ? statementText(line, game, characters) : '';
	}

	/** Each line as the player hears it: no True or False, no reasons (L50). */
	const shown = $derived(
		[0, 1].flatMap((i) => {
			const words = own[i] ?? (lines[i] ? statementText(lines[i]!, game, characters) : '');
			return words.trim() === '' ? [] : [{ title: words }];
		})
	);

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

	/** True, False, or the seats it depends on (a `seats` slot, drawn as their badges). */
	function truthLabel(s: SavantStatement): string {
		if (s.truth === 'either') return t('savant.dependsOn', { seats: slot('seats') });
		return s.truth === 'true' ? t('savant.true') : t('savant.false');
	}

	function save() {
		if (seatId === undefined) return;
		const given = [0, 1].flatMap((i) => {
			const line = lines[i];
			const words = own[i] ?? (line ? statementText(line, game, characters) : '');
			if (words.trim() === '') return [];
			return [t(holds(i) ? 'savant.noteTrue' : 'savant.noteFalse', { statement: words.trim() })];
		});
		if (given.length === 0) return;
		const existing = todayNote;
		const ok = existing
			? grimoire.run({
					type: 'EditDayNote',
					entryId: existing.entryId,
					text: noteText(existing.text, given, prefixes),
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

<Dialog
	bind:open
	size="full"
	title={seatId === undefined
		? t('savant.title')
		: // eslint-disable-next-line grim/names-as-badges -- the accessible name; the heading shows the badge
			t('savant.titleSeat', { seat: seatLabel(game, seatId) })}
	pinAside={false}
>
	{#snippet heading()}{#if seatId === undefined}{t('savant.title')}{:else}<Sentence
				text={t('savant.titleSeat', { seat: slot('seat') })}
				>{#snippet fill()}<PlayerBadge name={seatName(game, seatId)} />{/snippet}</Sentence
			>{/if}{/snippet}
	{#snippet headActions()}
		<IconButton
			icon="showToPlayer"
			label={t('savant.show')}
			disabled={shown.length === 0}
			onclick={() => (showOpen = true)}
		/>
	{/snippet}
	{#snippet aside()}<section aria-label={t('savant.earlier')}>
			<h3 class="pane-title">{t('savant.earlier')}</h3>
			{#if earlier.length === 0}
				<p class="none">{t('common.none')}</p>
			{:else}
				<ol class="earlier" data-testid="savant-earlier">
					{#each earlier as given, k (k)}
						<li>
							<h4>
								{given.day === 0
									? t('day.nightNumber', { number: 1 })
									: t('day.titleNumber', { number: given.day })}
							</h4>
							{#each given.statements as statement, j (j)}
								<p class="given">
									<span class="given-truth" data-truth={statement.truth ? 'true' : 'false'}
										>{statement.truth ? t('savant.true') : t('savant.false')}</span
									>
									{statement.words}
								</p>
							{/each}
							{#if given.rest}<p class="rest">{given.rest}</p>{/if}
						</li>
					{/each}
				</ol>
			{/if}
		</section>{/snippet}
	<div class="savant">
		<h3 class="pane-title">{t('savant.today')}</h3>
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
			{@const written = own[i] !== undefined}
			<section
				class="line"
				aria-label={t('savant.statement', { number: i + 1 })}
				data-testid="savant-line"
			>
				<IconButton
					icon="edit"
					label={t('savant.write', { number: i + 1 })}
					aria-pressed={written}
					disabled={written}
					onclick={() => write(i)}
				/>
				<div class="words">
					{#if written}
						<TextField
							label={t('savant.writeField', { number: i + 1 })}
							hideLabel
							bind:value={own[i]}
						/>
					{:else}
						<p class="sentence">
							{#if line}
								{@render parts(line.parts)}
							{:else}
								{t('common.none')}
							{/if}
						</p>
					{/if}
					<p class="truth">
						{#if written}
							<Chip
								pressed={ownTrue[i]}
								data-truth={ownTrue[i] ? 'true' : 'false'}
								onclick={() => (ownTrue[i] = !ownTrue[i])}
								>{ownTrue[i] ? t('savant.true') : t('savant.false')}</Chip
							>
						{:else if line?.truth === 'check'}
							<Chip pressed={assumed[i]} onclick={() => setAssumed(i, !assumed[i])}
								>{assumed[i] ? t('savant.checkTrue') : t('savant.checkFalse')}</Chip
							>
						{:else if line}
							<span class="verdict" data-truth={line.truth}
								><Sentence text={truthLabel(line)}
									>{#snippet fill()}{#each line.truth === 'either' ? line.dependsOn : [] as x, k (k)}{k >
											0
												? ', '
												: ''}<PlayerBadge name={seatName(game, x)} />{/each}{/snippet}</Sentence
								></span
							>
							{#each line.why as reason, j (j)}
								<span class="why-part" data-testid="savant-why-part"
									>{@render parts(reason)}{#if j < line.why.length - 1};{/if}</span
								>
							{/each}
						{/if}
					</p>
				</div>
				<IconButton
					icon="random"
					label={t('savant.another', { number: i + 1 })}
					disabled={pool.length === 0}
					onclick={() => another(i)}
				/>
			</section>
		{/each}
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={save}
			confirmLabel={t('savant.use')}
			disabled={shown.length === 0}
		/>
	{/snippet}
	<ShowToPlayer bind:open={showOpen} cards={shown} />
</Dialog>

{#snippet parts(
	list: readonly SavantPart[]
)}{#each list as part, j (j)}{#if 'text' in part}{part.text}{:else if 'seat' in part}<PlayerBadge
				name={seatName(game, part.seat)}
			/>{:else if 'character' in part}<CharacterBadge
				characterId={part.character}
				character={characters.get(part.character)}
			/>{:else if 'type' in part}{TYPE_NAMES[part.type]}{:else}{part.number}{/if}{/each}{/snippet}

<style>
	.savant {
		display: grid;
		gap: var(--space-3);
	}
	.pane-title {
		margin: 0;
		font-size: 1rem;
		color: var(--heading);
	}
	.none {
		margin: var(--space-2) 0 0;
		color: var(--on-surface-muted);
	}
	/* Earlier days as rows with lines between, not bordered cards (Trevor's UI rules). */
	.earlier {
		margin: var(--space-2) 0 0;
		padding: 0;
		list-style: none;
	}
	.earlier > li {
		display: grid;
		gap: var(--space-1);
		padding: var(--space-2) 0;
		border-top: var(--card-border);
	}
	.earlier h4 {
		margin: 0;
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.given,
	.rest {
		margin: 0;
	}
	.given-truth {
		margin-right: var(--space-1);
		font-weight: 600;
	}
	.rest {
		white-space: pre-line;
		color: var(--on-surface-muted);
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
	/* The verdict, then why; two lines kept so a shorter reason moves nothing. */
	.truth {
		margin: 0;
		min-height: max(var(--tap-target), 3em);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--space-2);
		color: var(--on-surface-muted);
	}
	.verdict {
		font-weight: 600;
	}
	[data-truth='true'] {
		color: var(--good-text);
	}
	[data-truth='false'] {
		color: var(--evil-text);
	}
</style>
