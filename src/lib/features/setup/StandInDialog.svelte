<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { StandIn } from '#lib/core/rules/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		/** The Drunk, Marionette or Lunatic, and what may go in the bag for it. */
		standIn: StandIn | undefined;
		/** Characters already chosen for the bag: not offered, as they'd be in it twice. */
		selected: readonly CharacterId[];
		lookup: (id: CharacterId) => Character | undefined;
		onChoose: (shows: CharacterId) => void;
	}

	let { open = $bindable(), standIn, selected, lookup, onChoose }: Props = $props();

	const name = $derived(standIn ? (lookup(standIn.characterId)?.name ?? '') : '');
	const options = $derived(
		(standIn?.options ?? [])
			// A Lunatic is usually shown the Demon in play; a good stand-in shouldn't be in the bag.
			.filter((id) => standIn?.kind === 'demon' || !selected.includes(id))
			.map((id) => lookup(id))
			.filter((c): c is Character => c !== undefined)
	);
	let query = $state('');
	$effect(() => {
		if (!open) query = '';
	});
</script>

<!--
	Asked when a Drunk or Marionette is added (Trevor, 2026-10-16): which token goes in the
	bag in its place. Never picked for the Storyteller; "Decide later" leaves it to the
	setup check, and the build confirms it if still unchosen.
-->
<Dialog
	bind:open
	title={t('setup.standIn.title', { name })}
	description={t('setup.standIn.description', { name })}
	size="full"
>
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
		<Button variant="quiet" onclick={() => (open = false)}>{t('setup.standIn.later')}</Button>
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
