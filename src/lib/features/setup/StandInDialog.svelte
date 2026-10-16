<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { StandIn } from '#lib/core/rules/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		/** The Lunatic, and the Demons its token may show. */
		standIn: StandIn | undefined;
		lookup: (id: CharacterId) => Character | undefined;
		onChoose: (shows: CharacterId) => void;
	}

	let { open = $bindable(), standIn, lookup, onChoose }: Props = $props();

	const name = $derived(standIn ? (lookup(standIn.characterId)?.name ?? '') : '');
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
		<Button variant="quiet" onclick={() => (open = false)}>{t('common.cancel')}</Button>
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
