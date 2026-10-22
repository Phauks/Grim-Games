/**
 * The Storyteller's own picture for the middle of share QR codes (plan R1), kept on this
 * device only. It is scaled down to a small square when chosen, so it stays light to store.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const KEY = 'grim-games:qr-picture:v1';
/** Pixels on each side of the stored square: the QR's middle is never larger on screen. */
const SIZE = 256;

function stored(): string | undefined {
	const value = readStoredText(KEY);
	return value?.startsWith('data:image/') ? value : undefined;
}

export const qrPicture = $state<{ current: string | undefined }>({ current: stored() });

/** Scales a picture file to a centred square and keeps it. False when it can't be read. */
export async function chooseQrPicture(file: File): Promise<boolean> {
	try {
		const bitmap = await createImageBitmap(file);
		const side = Math.min(bitmap.width, bitmap.height);
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = SIZE;
		const context = canvas.getContext('2d');
		if (!context) return false;
		context.drawImage(
			bitmap,
			(bitmap.width - side) / 2,
			(bitmap.height - side) / 2,
			side,
			side,
			0,
			0,
			SIZE,
			SIZE
		);
		bitmap.close();
		const url = canvas.toDataURL('image/png');
		if (!writeStoredText(KEY, url)) return false;
		qrPicture.current = url;
		return true;
	} catch {
		return false;
	}
}

export function forgetQrPicture(): void {
	writeStoredText(KEY, undefined);
	qrPicture.current = undefined;
}
