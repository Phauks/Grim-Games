<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { GameMode, SpecialRule } from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ModeAbout from '#lib/features/modes/ModeAbout.svelte';
	import ModeInspectDialog from '#lib/features/modes/ModeInspectDialog.svelte';
	import ShareModeDialog from '#lib/features/modes/ShareModeDialog.svelte';
	import { customModes } from '#lib/features/modes/custom-modes.svelte.ts';
	import { customRules } from '#lib/features/modes/custom-rules.svelte.ts';
	import { modeFileText } from '#lib/features/modes/mode-share.ts';
	import { downloadFile, fileNameFor } from '#lib/ui/download.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ItemPane from './ItemPane.svelte';
	import LabelRows from './LabelRows.svelte';
	import { modeKey, ruleKey } from './library-items.ts';

	/**
	 * A game mode or special rule added on this device, in the Library's pane (Trevor,
	 * 2026-11-01: mode files in the Library like scripts and characters): its About, and the
	 * same Inspect, Share and Delete as New game and Special rules. Edit opens it in the Mode
	 * builder, which is also where its name changes, so the file and the Library agree.
	 */
	interface Props {
		open?: boolean;
		mode: GameMode | SpecialRule;
		inline: boolean;
	}

	let { open = $bindable(false), mode, inline }: Props = $props();

	const isRule = $derived(mode.kind === 'special-rule');
	const itemKey = $derived(isRule ? ruleKey(mode.id) : modeKey(mode.id));
	let inspecting = $state(false);
	let sharing = $state(false);
	let deleting = $state(false);

	function download() {
		downloadFile(fileNameFor(mode.name, mode.id), modeFileText(mode));
	}
</script>

<ItemPane bind:open title={mode.name} {inline}>
	{#snippet headActions()}
		<IconButton
			icon="info"
			label={t('modes.inspect', { name: mode.name })}
			onclick={() => (inspecting = true)}
		/>
		<IconButton
			icon="edit"
			label={t('library.editMode', { name: mode.name })}
			onclick={() => goto(`${resolve('/build-mode')}#edit=${encodeURIComponent(mode.id)}`)}
		/>
		<IconButton
			icon="share"
			label={t('modes.shareFile', { name: mode.name })}
			onclick={() => (sharing = true)}
		/>
		<IconButton icon="download" label={t('library.download')} onclick={download} />
		<DeleteButton
			label={t('modes.add.delete', { name: mode.name })}
			onclick={() => (deleting = true)}
		/>
	{/snippet}
	<div class="mode" data-testid="library-mode">
		<ModeAbout {mode} />
		<dl>
			<LabelRows {itemKey} />
		</dl>
	</div>
</ItemPane>

<ModeInspectDialog bind:open={inspecting} {mode} />
<ShareModeDialog bind:open={sharing} {mode} />
<ConfirmDialog
	bind:open={deleting}
	title={t('modes.add.deleteConfirm', { name: mode.name })}
	danger
	onConfirm={() => {
		if (isRule) customRules.remove(mode.id);
		else customModes.remove(mode.id);
		open = false;
	}}
/>

<style>
	.mode {
		display: grid;
		gap: var(--space-3);
	}
	dl {
		margin: 0;
	}
</style>
