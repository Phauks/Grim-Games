import { registerSettingsSection } from '../registry.ts';
import AboutSection from './AboutSection.svelte';
import AppearanceSection from './AppearanceSection.svelte';
import FontsSection from './FontsSection.svelte';
import IconsSection from './IconsSection.svelte';

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
	id: 'about',
	label: 'About',
	icon: 'info',
	component: AboutSection,
	order: 90
});
