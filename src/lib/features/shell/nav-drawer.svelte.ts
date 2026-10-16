/** Whether the navigation drawer is open (phones, and the menu button on a game screen). */
class NavDrawer {
	open = $state(false);

	show(): void {
		this.open = true;
	}
}

export const navDrawer = new NavDrawer();
