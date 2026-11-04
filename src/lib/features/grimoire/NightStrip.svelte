<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { rise } from '#lib/ui/motion.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import MarkerToken from '#lib/ui/token/MarkerToken.svelte';
	import { NIGHT_MARKERS, type NightMarker } from '#lib/core/data/index.ts';
	import { glossaryDialog } from '#lib/features/glossary/glossary-dialog.svelte.ts';
	import { glossaryKey } from '#lib/features/glossary/wiki-glossary.ts';
	import type { RowMarker } from '#lib/features/characters/character-templates.ts';
	import NightAlerts from './NightAlerts.svelte';
	import StepIfChosen from './StepIfChosen.svelte';
	import NightSuggested from './NightSuggested.svelte';
	import { stepNightNumbers, type Night, type NightStep } from '#lib/core/rules/index.ts';
	import NightText from '#lib/features/reference/NightText.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import StepFocusSetting from './StepFocusSetting.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { MARKER_ICONS, seatName, stepHolders, stepName } from './night-steps.ts';
	import { setTermsPlain } from '#lib/features/glossary/term-handler.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';

	/**
	 * Walking through the night (Trevor, 2026-10-16): the current step under the board, with
	 * TPI's text, and Previous and Next. Next ticks the step; tapping the step opens it to be
	 * filled in. A fixed height, so moving between steps never moves the board.
	 */
	interface Props {
		grimoire: Grimoire;
		steps: readonly NightStep[];
		night: Night;
		index: number;
		onIndex: (index: number) => void;
		onOpen: (step: NightStep) => void;
		onClose: () => void;
		/** Next on the last step: nothing is left, so the board points at End night. */
		onPastEnd?: () => void;
		/**
		 * A special rule keeps this step's player asleep (I See Dead People: poisoned players
		 * don't wake), named by the rule. The board works it out, so night steps stay mode-free.
		 */
		asleepBy?: string;
		/** A special rule leaves this step's seat to no one (The Ballad of Seat 7), named by the rule. */
		emptySeatBy?: string;
		/** The player a special rule says the Demon attacks tonight (Trained Killer), and the rule. */
		attack?: { seat: string; by: string };
	}

	// The step is one button that opens it; its words are explained in the step it opens.
	setTermsPlain();
	let {
		grimoire,
		steps,
		night,
		index,
		onIndex,
		onOpen,
		onClose,
		onPastEnd,
		asleepBy,
		emptySeatBy,
		attack
	}: Props = $props();

	const game = $derived(grimoire.game);
	const step = $derived(steps[index]);
	const holders = $derived(step ? stepHolders(game, step, grimoire.open.characters) : []);
	const ticked = $derived(step ? grimoire.isNightStepDone(night, step) : false);

	const isMarker = (id: string): id is NightMarker =>
		(NIGHT_MARKERS as readonly string[]).includes(id);
	/** The steps the Glossary has an entry for, by the step's own name (Trevor, 2026-10-18). */
	const GLOSSARY_STEPS = new Set(['dusk', 'dawn', 'minioninfo', 'demoninfo']);
	/** A step that isn't a character's, as a character's row (Trevor, 2026-11-03). */
	const stepMarker = $derived.by((): RowMarker | undefined => {
		if (!step || step.character) return undefined;
		const name = stepName(step);
		return {
			name,
			team: step.id === 'minioninfo' || step.id === 'demoninfo' ? 'evil' : 'neutral',
			picture: markerPicture,
			info: GLOSSARY_STEPS.has(step.id) ? () => glossaryDialog.show(glossaryKey(name)) : undefined,
			infoLabel: `About ${name}`
		};
	});

	// The step's reminders in the bank: ringed, alone or first (Trevor, 2026-10-17).
	let focusOpen = $state(false);
	let focusButton = $state<HTMLElement>();

	const last = $derived(index >= steps.length - 1);
	/*
	 * The count is the step's number on the token's leaf (Trevor, 2026-11-04: "so that dawn does
	 * not count ... the number matches what would appear on a token"): counted among the
	 * characters that wake tonight, the same filter as the board's leaves, so Dusk, Dawn, Minion
	 * info and Demon info have none. A character that wakes again keeps its first number.
	 */
	const numbers = $derived(stepNightNumbers(steps));
	const number = $derived(
		step?.kind === 'character' && step.character && !step.afterDawn
			? numbers.get(step.character.id)
			: undefined
	);
	function next() {
		if (step && !ticked) grimoire.toggleNightStep(night, step, { startDay: false });
		if (!last) onIndex(index + 1);
		// Nothing after it: show where the night ends (Trevor, 2026-10-19).
		else onPastEnd?.();
	}
</script>

{#snippet markerPicture()}
	{#if step && isMarker(step.id)}<MarkerToken
			marker={step.id}
			size={40}
			label=""
		/>{:else if step}<span class="marker-icon"
			><Icon name={MARKER_ICONS[step.id] ?? 'night'} /></span
		>{/if}
{/snippet}

<!-- Rises into place under the board rather than appearing at once (Trevor, 2026-10-19); it is
     positioned over the space below, so nothing moves. `global`: it plays when the board's
     walk-through starts or ends, not only inside this component. -->
<section
	class="strip"
	aria-label="Night walk-through"
	data-testid="night-strip"
	data-step={index + 1}
	data-steps={steps.length}
	in:rise|global
	out:rise|global={{ speed: 'fast' }}
>
	<IconButton
		icon="back"
		label="Previous step"
		disabled={index === 0}
		onclick={() => onIndex(index - 1)}
	/>
	{#if step}
		<!-- The character as every list draws it, with its ability turned off (Trevor,
		     2026-11-02), and Dusk, Dawn and the info steps as the same row with their picture
		     (Trevor, 2026-11-03): the ring opens its details, the band names it and its player,
		     and the band opens the step. The count is the night's, so it sits beside the band,
		     not on it. -->
		<span class="row" class:ticked>
			<CharacterPiece
				template="name"
				character={step.character}
				marker={step.character ? undefined : stepMarker}
				info
				playerName={holders.length === 1 ? seatName(game, holders[0]) : undefined}
				onclick={() => onOpen(step)}
			>
				{#snippet tags()}{#if step.again}<span class="again">again</span>{/if}{/snippet}
				{#snippet aside()}{#if number !== undefined}<span class="count"
							><CountBadge count={number} total={numbers.size} /></span
						>{/if}{/snippet}
			</CharacterPiece>
		</span>
		<button type="button" class="step" class:ticked onclick={() => onOpen(step)}>
			<span class="body">
				<!-- The step's name for the button's own label; the row above shows it. -->
				<span class="name visually-hidden"><strong>{stepName(step)}</strong></span>
				{#if holders.length > 1}<span class="who"
						>{#each holders as seatId, i (seatId)}{i > 0 ? ', ' : ''}<PlayerBadge
								name={seatName(game, seatId)}
							/>{/each}</span
					>{/if}
				<!-- Inside the strip's fixed height, which scrolls, so nothing outside moves. -->
				{#if asleepBy}<span class="asleep" data-testid="step-asleep"
						>Poisoned: doesn’t wake ({asleepBy})</span
					>{/if}
				{#if emptySeatBy}<span class="empty-seat" data-testid="step-empty-seat"
						>No player: make its choices ({emptySeatBy})</span
					>{/if}
				{#if attack}<span class="attack" data-testid="step-attack"
						>Attacks {attack.seat} ({attack.by})</span
					>{/if}
				<!-- What to do comes before any information (Trevor, 2026-10-20). -->
				<span class="text">
					{#if step.reminder}
						{#if step.character}
							<NightText text={step.reminder} character={step.character} {night} />
						{:else}
							{step.reminder}
						{/if}
					{/if}
				</span>
				<NightAlerts {grimoire} {step} compact />
				<StepIfChosen {grimoire} {step} compact />
				<NightSuggested {grimoire} {step} compact />
			</span>
		</button>
	{:else}
		<span class="step none">None</span>
	{/if}
	<!-- Next ticks the step; the bank's End night ends the night (Trevor, 2026-10-18), and Next
	     past the last step lights it up (Trevor, 2026-10-19). -->
	<IconButton icon="forward" label="Next step" onclick={next} />
	<!-- In the top corner (Trevor, 2026-10-16), so Previous and Next own the sides. The step
	     reminders setting is behind ⋯, the app's icon for more choices (Trevor, 2026-10-18). -->
	<span class="corner">
		<span bind:this={focusButton}
			><IconButton
				icon="more"
				label="Character reminders"
				onclick={() => (focusOpen = !focusOpen)}
			/></span
		>
		<IconButton icon="close" label="Stop the walk-through" onclick={onClose} />
	</span>
</section>

<Popover bind:open={focusOpen} title="Character reminders" anchor={focusButton}>
	<StepFocusSetting />
</Popover>

<style>
	.strip {
		position: absolute;
		left: 0;
		right: 0;
		/* Under the step's reminders tray (NightTray). */
		top: calc(100% + 2 * var(--space-2) + var(--tray-h));
		z-index: 2;
		display: flex;
		align-items: stretch;
		gap: var(--space-1);
		height: var(--strip-h);
		box-sizing: border-box;
		padding: var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	/* Previous and Next are the big targets down each side, under the Stop corner. */
	.strip > :global(button:not(.step)) {
		align-self: stretch;
		height: auto;
		margin-top: var(--tap-target);
	}
	.corner {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		display: flex;
	}
	.step {
		flex: 1;
		min-width: 0;
		display: flex;
		gap: var(--space-2);
		align-items: flex-start;
		padding: var(--space-1);
		border: 0;
		border-radius: var(--radius-md);
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.step:hover {
		background: var(--surface-selected);
	}
	.step.ticked .body,
	.row.ticked {
		opacity: 0.6;
	}
	/* A step's icon in the ring, as a character's icon fills it. */
	.marker-icon {
		display: grid;
		place-items: center;
		--icon-size: 70%;
		color: var(--heading);
	}
	.body {
		display: grid;
		min-width: 0;
		max-height: 100%;
		overflow-y: auto;
		/* Scrolls by swipe or wheel, with no bar drawn (Trevor, 2026-10-16). */
		scrollbar-width: none;
	}
	.body::-webkit-scrollbar {
		display: none;
	}
	.who {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.who {
		font-family: var(--font-player);
	}
	.who,
	.count {
		color: var(--on-surface-muted);
	}
	/* As "Seat 7" on a character's band (Trevor, 2026-11-02). */
	.count {
		display: grid;
		align-items: center;
		font-size: 0.95rem;
		white-space: nowrap;
	}
	/* As tall as a character's band, in the player names' font (Trevor, 2026-11-02). */
	.count :global(.count-badge) {
		height: 1.7rem;
		font-family: var(--font-player);
		font-weight: var(--font-player-weight, 700);
		font-variant-numeric: lining-nums tabular-nums;
	}
	.asleep {
		color: var(--evil-text);
		font-size: 0.9rem;
	}
	.attack {
		color: var(--evil-text);
		font-size: 0.9rem;
	}
	.empty-seat {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.text {
		font-family: var(--font-ability);
		font-size: 0.9rem;
		line-height: 1.3;
	}
	/*
	 * The character's row across the top, clear of ⋯ and X, its ring where the step's icon
	 * was: as tall as a tap target, so the text below starts where it did.
	 */
	.row {
		position: absolute;
		top: var(--space-1);
		left: var(--space-1);
		right: calc(2 * var(--tap-target));
		z-index: 1;
		--character-ring: var(--tap-target);
	}
	.again {
		font-size: 0.75em;
	}
	.step .body {
		padding-top: calc(var(--tap-target) - var(--space-1));
	}
	.none {
		display: grid;
		place-items: center;
		color: var(--on-surface-muted);
	}
</style>
