<!--
	Fabled and Loric are rules of the game, not seats: in the middle, or small along the edge
	(Trevor, 2026-10-17), each with its reminders at its top right (GrimoireBoard). Abilities the
	Storyteller holds sit with them, on the board rather than hidden away (Trevor, 2026-10-30):
	the Plague Doctor's Minion, marked with its Storyteller Ability reminder as its How to Run
	says (https://wiki.bloodontheclocktower.com/Plague_Doctor).
-->
<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import {
		ruleReminders,
		type CharacterLookup,
		type Game,
		type ReminderId,
		type ReminderInstance
	} from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { placingAlignment } from '#lib/features/grimoire/board.ts';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import { isGeneric, reminderWords } from '#lib/features/grimoire/reminders.ts';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';

	interface Props {
		game: Game;
		characters: CharacterLookup;
		/** One stack for them all (Settings > Board). */
		grouped: boolean;
		/** Small along the board's edge rather than in the middle. */
		edge: boolean;
		tokenSize: number;
		/** The size of a reminder on a seat; held ones are smaller. */
		chip: number;
		disabled: boolean;
		/** The held reminder being dragged, whose place stays dimmed. */
		lifted: ReminderId | undefined;
		/** Opens one Fabled or Loric, or the list of all of them. */
		onShow: (id?: CharacterId) => void;
		/** Opens an ability the Storyteller holds, by the character that gave it. */
		onShowAbility: (via: CharacterId) => void;
		onHeldTap: (reminderId: ReminderId) => void;
		onHeldDrag: (reminderId: ReminderId, x: number, y: number, end: boolean) => void;
		onCancel: () => void;
	}

	let {
		game,
		characters,
		grouped,
		edge,
		tokenSize,
		chip,
		disabled,
		lifted,
		onShow,
		onShowAbility,
		onHeldTap,
		onHeldDrag,
		onCancel
	}: Props = $props();

	const heldLabel = (name: string) => `${name}'s reminders`;
	const abilities = $derived(game.storytellerAbilities ?? []);
	/** Every token in the corner stack: the Fabled and Loric, then the Storyteller's abilities. */
	const stacked = $derived([...game.ruleCharacters, ...abilities.map((a) => a.characterId)]);
	/** The giver's reminder that marks the ability it gives (the Storyteller Ability). */
	const markOf = (via: CharacterId) => rulesOf(via, characters)?.givesAbility?.token;
	/** The character whose art a generic copy shows (Trevor, 2026-10-27), if any. */
	const artOf = (reminder: ReminderInstance) =>
		reminder.like ? characters.get(reminder.like.characterId) : undefined;
</script>

<!--
	A Fabled or Loric's reminders, packed at its token's top right (Trevor, 2026-10-18): the
	latest one, which can be tapped or dragged off, and how many more, which opens the list.
-->
{#snippet heldCluster(held: ReminderInstance[], label: string, onMore: () => void)}
	{@const last = held.at(-1)}
	{#if last}
		<span class="held" role="group" aria-label={label}>
			<span class:lifted={lifted === last.reminderId}>
				<BoardReminder
					label={reminderWords(last)}
					infinite={isGeneric(last)}
					symbol={last.symbol}
					symbolColour={last.symbolColour}
					symbolFill={last.symbolFill}
					art={artOf(last)}
					character={characters.get(last.characterId)}
					alignment={placingAlignment(game, last, characters)}
					size={Math.round(chip * 0.7)}
					{disabled}
					onTap={() => onHeldTap(last.reminderId)}
					onDrag={(x, y, end) => onHeldDrag(last.reminderId, x, y, end)}
					{onCancel}
				/>
			</span>
			{#if held.length > 1}
				<span class="held-more">
					<BoardReminder
						label=""
						character={undefined}
						more={held.length - 1}
						size={Math.round(chip * 0.7)}
						{disabled}
						onTap={onMore}
					/>
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#if grouped}
	<!-- One stack for them all; a tap lists every one (Trevor, 2026-10-17). -->
	<span class="stack-wrap">
		<button
			type="button"
			class="rules-stack"
			data-rule-stack
			aria-label={`Fabled and Loric: ${stacked.length}`}
			onclick={() => onShow()}
		>
			{#each stacked.slice(0, 3) as id, i (`${i}:${id}`)}
				{@const character = characters.get(id)}
				{#if character}<CharacterToken {character} size={tokenSize} />{/if}
			{/each}
			{#if stacked.length > 1}<span class="stack-count" aria-hidden="true"
					><CountBadge count={stacked.length} warn /></span
				>{/if}
		</button>
		{@render heldCluster(
			Object.values(game.ruleReminders ?? {}).flat(),
			'Fabled and Loric reminders',
			() => onShow()
		)}
	</span>
{:else}
	<ul class="rules" class:edge aria-label="Fabled and Loric">
		{#each game.ruleCharacters as id (id)}
			{@const character = characters.get(id)}
			{#if character}
				<li>
					<button
						type="button"
						class="rule"
						data-rule={id}
						aria-label={character.name}
						onclick={() => onShow(id)}
					>
						<CharacterToken {character} size={tokenSize} />
					</button>
					<!-- Its reminders, tight to its top right: parked there, out of play (Trevor,
					     2026-10-18). -->
					{@render heldCluster(ruleReminders(game, id), heldLabel(character.name), () =>
						onShow(id)
					)}
				</li>
			{/if}
		{/each}
		{#each abilities as held (held.via)}
			{@const character = characters.get(held.characterId)}
			{@const mark = markOf(held.via)}
			{#if character}
				<li data-testid="storyteller-ability-token">
					<button
						type="button"
						class="rule"
						aria-label={`Storyteller's ability: ${character.name}`}
						onclick={() => onShowAbility(held.via)}
					>
						<CharacterToken {character} size={tokenSize} />
					</button>
					{#if mark}
						<span class="held">
							<BoardReminder
								label={mark}
								character={characters.get(held.via)}
								size={Math.round(chip * 0.7)}
								{disabled}
								onTap={() => onShowAbility(held.via)}
							/>
						</span>
					{/if}
				</li>
			{/if}
		{/each}
	</ul>
{/if}

<style>
	.rules {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rules.edge {
		justify-content: flex-start;
	}
	.rules li,
	.stack-wrap {
		position: relative;
	}
	/* Packed on the token's top right corner, taking no room of its own. */
	.held {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 1;
		display: flex;
		align-items: flex-start;
		transform: translate(35%, -25%);
	}
	/* The "+n" tucks behind the latest reminder, which stays whole to tap. */
	.held-more {
		position: relative;
		z-index: -1;
		margin-inline-start: -30%;
	}
	/* Its stand-in follows the finger; the place stays, so nothing moves. */
	.held .lifted {
		opacity: 0.3;
	}
	.rule {
		/* Sized from the seats, which already follow the token size setting. */
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	/* The corner stack: tokens overlapping, with how many there are. */
	.rules-stack {
		position: relative;
		display: flex;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.rules-stack > :global(*:not(:first-child):not(.stack-count)) {
		margin-inline-start: -60%;
	}
	.stack-count {
		position: absolute;
		right: 0;
		bottom: 0;
		display: flex;
		font-size: 0.75rem;
	}
</style>
