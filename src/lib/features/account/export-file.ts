import { APP_NAME } from '#lib/core/app-name.ts';
import { fileNameFor } from '#lib/ui/download.ts';
import type { AccountUser } from './account-protocol.ts';

/**
 * "Download my data" file name (Trevor, 2026-10-18): the app, the account's username (its id
 * when it has none) and the local date and time, e.g. `grimbinder-trevor-2026-10-18-1852.json`.
 */
export function exportFileName(user: Pick<AccountUser, 'id' | 'username'>, at: Date): string {
	const two = (n: number) => String(n).padStart(2, '0');
	const stamp = `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())}-${two(at.getHours())}${two(at.getMinutes())}`;
	return fileNameFor(`${APP_NAME} ${user.username ?? user.id} ${stamp}`, 'account');
}
