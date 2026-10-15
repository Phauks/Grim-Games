import { registerSettingsSection } from '../registry.ts';
import AssistanceSection from './AssistanceSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import FontsSection from './FontsSection.svelte';
import IconsSection from './IconsSection.svelte';
import ResetSection from './ResetSection.svelte';

// Built-in sections. Other features register theirs the same way from their own modules.
registerSettingsSection({
	id: 'appearance',
	label: 'Appearance',
	icon: 'appearance',
	component: AppearanceSection,
	order: 10
});
registerSettingsSection({
	id: 'fonts',
	label: 'Fonts',
	icon: 'fonts',
	component: FontsSection,
	order: 20
});
registerSettingsSection({
	id: 'icons',
	label: 'Icons',
	icon: 'icons',
	component: IconsSection,
	order: 30
});
registerSettingsSection({
	id: 'assistance',
	label: 'Storyteller help',
	icon: 'assistance',
	component: AssistanceSection,
	order: 40
});
registerSettingsSection({
	id: 'reset',
	label: 'Reset settings',
	icon: 'undo',
	component: ResetSection,
	order: 90
});
