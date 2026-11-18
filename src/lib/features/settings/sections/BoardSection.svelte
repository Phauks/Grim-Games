<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BoardPreview from './BoardPreview.svelte';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import BoardBackgroundRows from './BoardBackgroundRows.svelte';
	import BoardRows from './BoardRows.svelte';
	import PinchZoomRow from './PinchZoomRow.svelte';

	/**
	 * How the grimoire board looks and behaves (Trevor, 2026-10-18: tokens have their own
	 * section); the game pane's Theme shows the same rows beside the real board.
	 */
</script>

<!-- A live preview beside the looks it shows (Trevor, 2026-10-20), as in Tokens. -->
<SettingGroup title={t('settings.boardPreview')} testid="board-preview">
	{#snippet preview()}<BoardPreview />{/snippet}
	<BoardBackgroundRows />
	<BoardRows />
</SettingGroup>

<!-- Outside the preview, which it doesn't change. -->
<PinchZoomRow />
