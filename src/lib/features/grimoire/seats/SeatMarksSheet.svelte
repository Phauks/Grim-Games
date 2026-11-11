<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import type { ReminderId } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * A seat's small tokens in words (Trevor, 2026-11-03: "tap pill for words"): what each mark
	 * in the seat's pill (HeldAbilityPill) says, as + has an ability, ? believes, ! mad as,
	 * = is really, ≈ fake, so a Storyteller learning the marks never has to guess. A mark that
	 * comes from a reminder can be held from its row, as a tap on that reminder would.
	 */
	interface Props {
		open: boolean;
		/** The player's name, or "Seat N". */
		title: string;
		abilities: { character: Character; works: boolean }[];
		custom: readonly string[];
		truths: { character: Character; reminderId?: string }[];
		believes?: { character: Character; reminderId?: string };
		madAs: { character: Character; reminderId?: string }[];
		pretends?: Character;
		/** Opens a reminder; none while the reminders can't be acted on (a view only). */
		onReminder?: (reminderId: ReminderId) => void;
	}

	let {
		open = $bindable(),
		title,
		abilities,
		custom,
		truths,
		believes,
		madAs,
		pretends,
		onReminder
	}: Props = $props();

	type Kind = 'holds' | 'believes' | 'mad' | 'is';
	interface Row {
		key: string;
		mark: string;
		kind: Kind;
		character?: Character;
		words: string;
		reminderId?: string;
	}
	const rows = $derived<Row[]>([
		...abilities.map(({ character, works }) => ({
			key: `held:${character.id}`,
			mark: '+',
			kind: 'holds' as const,
			character,
			words: works ? 'Also has this ability' : 'Also has this ability, not working now'
		})),
		...custom.map((words) => ({
			key: `custom:${words}`,
			mark: '+',
			kind: 'holds' as const,
			words: `Also has: ${words}`
		})),
		...(believes
			? [
					{
						key: 'believes',
						mark: '?',
						kind: 'believes' as const,
						character: believes.character,
						words: 'Believes they are this character',
						reminderId: believes.reminderId
					}
				]
			: []),
		...madAs.map(({ character, reminderId }, k) => ({
			key: `mad:${reminderId ?? k}`,
			mark: '!',
			kind: 'mad' as const,
			character,
			words: 'Is mad as this character',
			reminderId
		})),
		...truths.map(({ character, reminderId }, k) => ({
			key: `is:${reminderId ?? k}`,
			mark: '=',
			kind: 'is' as const,
			character,
			words: 'Is really this character',
			reminderId
		})),
		...(pretends
			? [
					{
						key: 'pretends',
						mark: '≈',
						kind: 'is' as const,
						character: pretends,
						words: 'Fake: the Storyteller pretends they are this character'
					}
				]
			: [])
	]);

	function openReminder(reminderId: string) {
		open = false;
		// After the tap's click, so it doesn't land on the board under the closing sheet.
		setTimeout(() => onReminder?.(reminderId as ReminderId));
	}
</script>

<Dialog bind:open {title} description="Small tokens">
	<ul class="list" data-testid="seat-marks">
		{#each rows as row (row.key)}
			<li>
				<span class="kind {row.kind}" aria-hidden="true">{row.mark}</span>
				{#if row.character}
					<CharacterPiece
						template="badge"
						characterId={row.character.id}
						character={row.character}
					/>
				{/if}
				<span class="words">{row.words}</span>
				{#if row.reminderId && onReminder}
					<Button variant="quiet" onclick={() => openReminder(row.reminderId!)}
						>Hold reminder</Button
					>
				{/if}
			</li>
		{:else}
			<li class="none">None</li>
		{/each}
	</ul>
</Dialog>

<style>
	.list {
		display: grid;
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border); /* px-ok: a hairline divider */
	}
	.words {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.none {
		color: var(--on-surface-muted);
	}
	/* The same marks and colours as the pill's (HeldAbilityPill), so the two read as one key. */
	.kind {
		display: grid;
		place-items: center;
		width: 1.75em;
		height: 1.75em;
		border-radius: 50%;
		font-weight: 700;
		line-height: 1;
	}
	.kind.holds {
		background: var(--good);
		color: var(--on-good);
	}
	.kind.is {
		background: var(--evil);
		color: var(--on-evil);
	}
	.kind.believes {
		background: var(--accent);
		color: var(--on-accent);
	}
	.kind.mad {
		background: var(--fabled);
		color: var(--on-fabled);
	}
</style>
