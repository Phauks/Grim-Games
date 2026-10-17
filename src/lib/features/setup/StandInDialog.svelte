<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { StandIn } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		/** The Lunatic, and the Demons its token may show. */
		standIn: StandIn | undefined;
		lookup: (id: CharacterId) => Character | undefined;
		onChoose: (shows: CharacterId) => void;
	}

	let { open = $bindable(), standIn, lookup, onChoose }: Props = $props();

	const character = $derived(standIn ? lookup(standIn.characterId) : undefined);
	const name = slot('character');
	const options = $derived(
		(standIn?.options ?? []).map((id) => lookup(id)).filter((c): c is Character => c !== undefined)
	);
	let query = $state('');
	$effect(() => {
		if (!open) query = '';
	});
</script>

<!--
	Which Demon token goes in the bag for the Lunatic, opened from the setup check. The
	Demon in play is the default (https://wiki.bloodontheclocktower.com/Lunatic).
-->
{#snippet fill()}{#if character}<CharacterBadge
			characterId={character.id}
			{character}
			inline
		/>{/if}{/snippet}

<Dialog
	bind:open
	title={t('setup.standIn.title', { name })}
	description={t('setup.standIn.description', { name })}
	size="full"
>
	{#snippet heading()}<Sentence text={t('setup.standIn.title', { name })} {fill} />{/snippet}
	{#snippet subtitle()}<Sentence text={t('setup.standIn.description', { name })} {fill} />{/snippet}
	<div class="list" data-testid="stand-in-picker">
		<CharacterPicker
			characters={options}
			selected={standIn?.shows ? [standIn.shows] : []}
			bind:query
			collapsibleKey="stand-in"
			onSelect={(id) => {
				onChoose(id);
				open = false;
			}}
		/>
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} />
	{/snippet}
</Dialog>

<style>
	.list {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
</style>
