<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { Conversion } from '#lib/core/modes/index.ts';
	import SharedPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * Once everyone has drafted, a drafted character that turns players into another type (the
	 * Kazali's Minions, Grimbits' draft): the Storyteller picks a player, then which character of
	 * that type they become, until the count is reached or they stop.
	 */
	interface Props {
		open: boolean;
		conversion: Conversion;
		by: Character | undefined;
		/** The seats (by pick index) that may be turned. */
		seats: readonly number[];
		seatLabel: (seat: number) => string;
		/** What each seat drafted. */
		kept: (seat: number) => Character | undefined;
		/** The characters of the type they may become. */
		characters: readonly Character[];
		onDone: (turned: Record<number, CharacterId>) => void;
	}

	let {
		open = $bindable(),
		conversion,
		by,
		seats,
		seatLabel,
		kept,
		characters,
		onDone
	}: Props = $props();

	let turned = $state<Record<number, CharacterId>>({});
	let at = $state<number | undefined>();
	const left = $derived(seats.filter((i) => turned[i] === undefined));
	const options = $derived(characters.filter((c) => !Object.values(turned).includes(c.id)));
	const type = $derived(TYPE_LABELS[conversion.type]);

	function become(id: CharacterId) {
		if (at === undefined) return;
		turned = { ...turned, [at]: id };
		at = undefined;
		if (Object.keys(turned).length >= conversion.count || left.length === 0) onDone(turned);
	}
</script>

<Dialog bind:open title={t('modes.deal.askTitle')} size="full">
	{#snippet subtitle()}{#if by}<CharacterBadge characterId={by.id} character={by} />{/if}{/snippet}
	{#if at === undefined}
		<div class="ask" data-testid="draft-convert">
			<p class="prompt">{t('modes.deal.convertSeat', { type })}</p>
			<!-- Each seat that may be turned, with what it drafted beside it. -->
			<ul class="seats" data-testid="convert-seats">
				{#each left as i (i)}
					{@const drafted = kept(i)}
					<li>
						<Button onclick={() => (at = i)}>{seatLabel(i)}</Button>
						{#if drafted}<CharacterBadge characterId={drafted.id} character={drafted} />{/if}
					</li>
				{/each}
				<li><Button onclick={() => onDone(turned)}>{t('modes.deal.convertStop')}</Button></li>
			</ul>
		</div>
	{:else}
		<div class="choose" data-testid="convert-character">
			<p class="prompt">{t('modes.deal.convertCharacter', { type, seat: seatLabel(at) })}</p>
			{#if options.length === 0}
				<p>{t('modes.deal.noOptions')}</p>
			{:else}
				<div class="list">
					<SharedPicker
						characters={options}
						collapsibleKey="deal"
						showSearch={false}
						onSelect={become}
					/>
				</div>
			{/if}
		</div>
	{/if}
</Dialog>

<style>
	.prompt {
		margin: 0;
		font-weight: 600;
	}
	.ask,
	.choose {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	/* A full dialog doesn't scroll itself: its content does. */
	.choose,
	.list {
		flex: 1;
		min-height: 0;
	}
	.list {
		display: flex;
		flex-direction: column;
	}
	.seats {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.seats li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding-block: var(--space-1);
		border-bottom: var(--card-border);
	}
</style>
