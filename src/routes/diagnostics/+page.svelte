<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import { showDiagnostics } from '#lib/features/settings/sections/about-advanced.ts';

	// Deep link: /diagnostics opens Settings at About with Advanced open, where the diagnostics
	// live (Trevor, 2026-10-18); closing it returns home.
	let shown = $state(false);
	onMount(async () => {
		// Wait a tick so the layout's SettingsModal has mounted and sees the change.
		await tick();
		showDiagnostics();
		shown = true;
	});
	$effect(() => {
		if (shown && !settingsDialog.open) void goto(resolve('/'), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Diagnostics · {APP_NAME}</title>
</svelte:head>
