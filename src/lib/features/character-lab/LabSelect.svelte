<script lang="ts">
	import { CHARACTER_TYPES } from '#lib/core/data/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import AddCharactersDialog from '#lib/features/setup/AddCharactersDialog.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { lab } from './lab-store.svelte.ts';
	import type { LabSession } from './lab-session.svelte.ts';

	/**
	 * The Character Lab's characters, on the left above their rows (plan M47, Trevor
	 * 2026-11-04: "move left right toggle and character select to the left side"): the arrows
	 * that swap the character under test, + to select characters, and the jinx filter.
	 */
	interface Props {
		session: LabSession;
		/** The arrows go to the new game as well, for a screen with no room for its frame. */
		open?: boolean;
	}

	let { session, open = false }: Props = $props();

	const setup = $derived(session.setup);
	let adding = $state(false);
</script>

<section class="select" aria-label={t('lab.locked')} data-testid="lab-select">
	<div class="row">
		<div class="nav" data-testid="lab-testing">
			<IconButton
				icon="back"
				label={t('lab.previousCharacter')}
				disabled={session.loading || !session.testing}
				onclick={() => void session.stepTesting(-1, open)}
			/>
			<span class="testing" data-testid="lab-locked">
				{#if session.testing}<CharacterPiece
						template="badge"
						characterId={session.testing}
					/>{:else}{t('common.none')}{/if}
			</span>
			<IconButton
				icon="forward"
				label={t('lab.nextCharacter')}
				disabled={session.loading || !session.testing}
				onclick={() => void session.stepTesting(1, open)}
			/>
		</div>
		<IconButton
			icon="add"
			label={t('lab.addTitle')}
			disabled={!session.data}
			onclick={() => (adding = true)}
		/>
	</div>
	<!-- Usable once a character is locked; until then nothing is listed. -->
	<Toggle
		label={t('lab.jinxedOnly')}
		checked={setup.jinxedOnly}
		disabled={session.locked.length === 0}
		onChange={(jinxedOnly) => lab.update({ jinxedOnly, index: 0 })}
	/>
</section>

{#if session.data}
	{@const data = session.data}
	<AddCharactersDialog
		bind:open={adding}
		title={t('lab.addTitle')}
		types={CHARACTER_TYPES}
		characters={data.characters}
		selected={session.locked}
		jinxCounts
		filter={(c) =>
			(!setup.pickJinxed || !!data.jinxes.byCharacter.get(c.id)?.length) &&
			(!setup.pickSetup || !!c.setup)}
		onToggle={(id) => session.setLocked(id, !session.locked.includes(id))}
	>
		<!-- Quick ways to the characters worth testing (Trevor, 2026-11-04). -->
		<div class="filters">
			<Toggle
				label={t('lab.hasJinxes')}
				checked={setup.pickJinxed}
				onChange={(pickJinxed) => lab.update({ pickJinxed })}
			/>
			<Toggle
				label={t('lab.changesSetup')}
				checked={setup.pickSetup}
				onChange={(pickSetup) => lab.update({ pickSetup })}
			/>
		</div>
	</AddCharactersDialog>
{/if}

<style>
	.select {
		display: grid;
		gap: var(--space-1);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.nav {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
	}
	.testing {
		display: flex;
		justify-content: center;
		min-width: 0;
		color: var(--on-surface-muted);
	}
	.filters {
		display: grid;
		gap: var(--space-1);
	}
</style>
