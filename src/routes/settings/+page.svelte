<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';

	// Deep link: /settings opens the settings modal; closing it returns home.
	let shown = $state(false);
	onMount(async () => {
		// Wait a tick so the layout's SettingsModal has mounted and sees the change.
		await tick();
		settingsDialog.show();
		shown = true;
	});
	$effect(() => {
		if (shown && !settingsDialog.open) void goto(resolve('/'), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Settings · {APP_NAME}</title>
</svelte:head>
