<script lang="ts">
	import { isSeatable, type Character, type NightMarker } from '#lib/core/data/index.ts';
	import {
		MARKER_TEXT,
		nightOrder,
		TRAVELLER_ALIGNMENT_STEP,
		withTravellerAlignmentStep,
		type Night,
		type NightStep
	} from '#lib/core/rules/index.ts';
	import type { Alignment } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Segmented from '#lib/ui/primitives/Segmented.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import {
		addStep,
		editStep,
		isOwnStep,
		moveStep,
		restoreStep,
		skippedSteps,
		skipStep
	} from './night-edit.ts';

	/**
	 * The night order for this game: the characters in play that wake tonight, in order,
	 * with TPI's night text. Nothing is automatic: the Storyteller ticks steps off (or skips
	 * them) by hand, and can clear the ticks for the next night. In edit mode the Storyteller
	 * reorders, skips, rewrites or adds steps (`night-edit.ts`), each one History entry.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	let night = $state<Night>('first');

	/** The night's steps with the Storyteller's changes, which edit mode works on. */
	const ordered = $derived.by((): NightStep[] => {
		const data = officialData.current;
		if (!data || !open) return [];
		// Players wake by the token they hold (a Drunk wakes as their Townsfolk).
		const inPlay: Character[] = [];
		for (const id of [
			...game.seating.map((s) => game.seats[s].characterId),
			...game.ruleCharacters
		]) {
			const c = id ? characters.get(id) : undefined;
			if (c) inPlay.push(c);
		}
		const { steps } = nightOrder({
			night,
			sheet: data.nightSheet,
			inPlay,
			players: inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length,
			customOrder: night === 'first' ? game.script.meta?.firstNight : game.script.meta?.otherNight,
			overrides: game.nightOrderOverrides
		});
		return steps;
	});
	// A first step to choose any Traveller's alignment that is still unset.
	const steps = $derived(withTravellerAlignmentStep(ordered, game, characters));

	function setAlignment(seatId: string, alignment: Alignment) {
		grimoire.run({ type: 'SetAlignment', seatId, alignment });
	}

	/** Who holds a step's character, for "Empath · Sam". */
	function holders(step: NightStep) {
		return game.seating.filter((s) => game.seats[s].characterId === step.character?.id);
	}
	const seatName = (seatId: string) =>
		game.seats[seatId].playerName ?? `Seat ${game.seating.indexOf(seatId) + 1}`;

	function stepName(step: NightStep | undefined): string {
		if (!step) return '';
		if (step.kind === 'marker') return MARKER_TEXT[step.id as NightMarker].name;
		return step.title ?? step.character?.name ?? step.id;
	}
	function nameOf(id: string): string {
		if (id in MARKER_TEXT) return MARKER_TEXT[id as NightMarker].name;
		return characters.get(id)?.name ?? id;
	}

	// ── Editing ──
	let editing = $state(false);
	$effect(() => {
		if (!open) editing = false;
	});
	const overrides = $derived(game.nightOrderOverrides);
	const skipped = $derived(open ? skippedSteps(overrides, night) : []);
	let chosen = $state<string | undefined>();
	let stepMenuOpen = $state(false);
	const chosenIndex = $derived(ordered.findIndex((s) => s.id === chosen));
	const chosenStep = $derived(ordered[chosenIndex]);
	const chosenOwn = $derived(chosen ? isOwnStep(overrides, night, chosen) : false);
	function openStep(id: string) {
		chosen = id;
		stepMenuOpen = true;
	}
	function move(by: -1 | 1) {
		const command = moveStep(ordered, overrides, night, chosenIndex, by);
		if (command) grimoire.run(command);
	}
	function skip() {
		stepMenuOpen = false;
		if (chosen) grimoire.run(skipStep(overrides, night, chosen));
	}

	let textOpen = $state(false);
	let draft = $state('');
	function startEdit() {
		stepMenuOpen = false;
		draft = chosenStep?.reminder ?? '';
		textOpen = true;
	}
	function saveText() {
		textOpen = false;
		if (chosen && draft.trim() && draft.trim() !== chosenStep?.reminder)
			grimoire.run(editStep(overrides, night, chosen, draft.trim()));
	}

	let addOpen = $state(false);
	/** The step a new one goes after; undefined: just before Dawn. */
	let addAfter = $state<string | null | undefined>();
	let addTitle = $state('');
	let addText = $state('');
	function startAdd(after: string | null | undefined) {
		stepMenuOpen = false;
		addAfter = after;
		addTitle = '';
		addText = '';
		addOpen = true;
	}
	function saveAdd() {
		addOpen = false;
		if (!addTitle.trim() && !addText.trim()) return;
		const dawn = ordered.findIndex((s) => s.id === 'dawn');
		const after =
			addAfter !== undefined
				? addAfter
				: ((dawn > 0 ? ordered[dawn - 1] : ordered.at(-1))?.id ?? null);
		const id = `own-${Date.now().toString(36)}`;
		grimoire.run(addStep(night, after, addTitle, addText.trim(), id));
	}

	const done = $derived(grimoire.nightDone);
	const doneKey = (step: NightStep) => `${night}:${step.id}`;
</script>

<Dialog bind:open title="Night order" size="full">
	<div class="head">
		<Segmented
			label="Night"
			hideLabel
			value={night}
			options={[
				{ value: 'first', label: 'First night' },
				{ value: 'other', label: 'Other nights' }
			]}
			onChange={(n) => (night = n)}
		/>
		{#if editing}
			<Button variant="quiet" icon="add" onclick={() => startAdd(undefined)}>Add step</Button>
		{:else}
			<Button variant="quiet" disabled={done.length === 0} onclick={() => grimoire.clearNight()}>
				Clear ticks
			</Button>
		{/if}
	</div>
	<ol class="steps">
		{#each steps as step (step.id)}
			{@const ticked = done.includes(doneKey(step))}
			<li class:ticked>
				{#if editing && step.id !== TRAVELLER_ALIGNMENT_STEP}
					<IconButton
						icon="more"
						label={`Change ${stepName(step)}`}
						onclick={() => openStep(step.id)}
					/>
				{:else}
					<button
						type="button"
						class="tick"
						aria-pressed={ticked}
						aria-label={`Done: ${stepName(step)}`}
						disabled={editing}
						onclick={() => grimoire.toggleNightStep(doneKey(step))}>{ticked ? '✓' : ''}</button
					>
				{/if}
				<div class="body">
					<p class="title">
						{#if step.id === TRAVELLER_ALIGNMENT_STEP}
							<strong>{step.title}</strong>
						{:else if step.kind === 'marker'}
							<strong>{MARKER_TEXT[step.id as NightMarker].name}</strong>
						{:else if step.character}
							{@const seats = holders(step)}
							{#if seats.length === 0}
								<CharacterBadge characterId={step.character.id} character={step.character} inline />
							{/if}
							{#each seats as seatId (seatId)}
								<CharacterBadge
									characterId={step.character.id}
									character={step.character}
									alignment={game.seats[seatId].alignment}
									playerName={seatName(seatId)}
									inline
								/>
							{/each}
						{:else}
							<strong>{step.title ?? step.id}</strong>
						{/if}
					</p>
					{#if step.id === TRAVELLER_ALIGNMENT_STEP}
						<ul class="travellers">
							{#each step.travellers ?? [] as seatId (seatId)}
								{@const id = game.seats[seatId]?.characterId}
								<li>
									{#if id}
										<CharacterBadge
											characterId={id}
											character={characters.get(id)}
											playerName={seatName(seatId)}
											inline
										/>
									{/if}
									<span class="spacer"></span>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'good')}>Good</Button>
									<Button variant="quiet" onclick={() => setAlignment(seatId, 'evil')}>Evil</Button>
								</li>
							{/each}
						</ul>
					{:else if step.reminder}
						<p class="text">
							{#if step.character}
								<NightText text={step.reminder} character={step.character} {night} />
							{:else}
								{step.reminder}
							{/if}
						</p>
					{/if}
				</div>
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
		{#if editing}
			<li class="skipped">
				<h3>Skipped</h3>
				{#each skipped as { id, index } (index)}
					<div class="skipped-row">
						<span>{nameOf(id)}</span>
						<Button variant="quiet" onclick={() => grimoire.run(restoreStep(index))}>Restore</Button
						>
					</div>
				{:else}
					<p class="none">None</p>
				{/each}
			</li>
		{/if}
	</ol>
	{#snippet actions()}
		<Button
			variant={editing ? 'accent' : 'quiet'}
			icon={editing ? 'check' : 'rename'}
			onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Edit order'}</Button
		>
	{/snippet}
</Dialog>

<Dialog
	bind:open={stepMenuOpen}
	title={stepName(chosenStep)}
	description={night === 'first' ? 'First night' : 'Other nights'}
>
	<div class="menu">
		<Button variant="quiet" disabled={chosenIndex <= 0} onclick={() => move(-1)}>Move up</Button>
		<Button
			variant="quiet"
			disabled={chosenIndex < 0 || chosenIndex >= ordered.length - 1}
			onclick={() => move(1)}>Move down</Button
		>
		<Button variant="quiet" icon="rename" onclick={startEdit}>Edit text</Button>
		<Button variant="quiet" icon="add" onclick={() => startAdd(chosen ?? null)}>
			Add a step after
		</Button>
		<Button variant="quiet" icon="remove" onclick={skip}>
			{chosenOwn ? 'Remove step' : 'Skip this step'}
		</Button>
	</div>
</Dialog>

<Dialog bind:open={textOpen} title={`Text for ${stepName(chosenStep)}`}>
	<label class="field">
		<span>Text</span>
		<textarea bind:value={draft} rows="5"></textarea>
	</label>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (textOpen = false)}>Cancel</Button>
		<Button variant="accent" onclick={saveText}>Save</Button>
	{/snippet}
</Dialog>

<Dialog
	bind:open={addOpen}
	title="Add a step"
	description={addAfter === undefined
		? 'Goes just before Dawn.'
		: addAfter === null
			? 'Goes first.'
			: `Goes after ${nameOf(addAfter)}.`}
>
	<label class="field">
		<span>Title</span>
		<input
			bind:value={addTitle}
			enterkeyhint="done"
			autocomplete="off"
			onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
		/>
	</label>
	<label class="field">
		<span>Text</span>
		<textarea bind:value={addText} rows="4"></textarea>
	</label>
	{#snippet actions()}
		<Button variant="quiet" onclick={() => (addOpen = false)}>Cancel</Button>
		<Button variant="accent" disabled={!addTitle.trim() && !addText.trim()} onclick={saveAdd}
			>Add</Button
		>
	{/snippet}
</Dialog>

<style>
	.head {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.steps {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: var(--tap-target) 1fr;
		gap: var(--space-2);
		align-items: start;
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	li.ticked .body {
		opacity: 0.45;
	}
	.tick {
		width: var(--tap-target);
		height: var(--tap-target);
		border: 2px solid var(--border);
		border-radius: var(--radius-md);
		background: none;
		color: var(--accent);
		font: 700 1.2rem / 1 var(--font-control);
		cursor: pointer;
	}
	.tick:hover {
		background: var(--surface-selected);
	}
	.body p {
		margin: 0;
	}
	.title {
		line-height: 1.9;
	}
	.text {
		font-family: var(--font-ability);
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.travellers {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.travellers li {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.spacer {
		flex: 1;
	}
	.skipped {
		display: block;
		border-bottom: none;
	}
	.skipped h3 {
		margin: var(--space-2) 0 var(--space-1);
		font-size: 0.95rem;
		color: inherit;
	}
	.skipped-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.menu {
		display: grid;
		gap: 2px;
	}
	.menu :global(button) {
		justify-content: flex-start;
	}
	.field {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}
	.field input,
	.field textarea {
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
		color: var(--on-surface);
		font: inherit;
	}
	.none {
		display: block;
		color: var(--on-surface-muted);
	}
</style>
