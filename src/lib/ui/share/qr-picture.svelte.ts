/**
 * The Storyteller's own picture for the middle of share QR codes (plan R1), kept on this
 * device only. It is scaled down when chosen, so it stays light to store, and kept whole:
 * Settings shapes how it sits in the square (Trevor, 2026-10-23), not the stored copy.
 */
import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';

const KEY = 'grim-games:qr-picture:v1';
/** Pixels on the stored picture's longer side: the QR's middle, zoomed in, is never larger. */
const SIZE = 512;

function stored(): string | undefined {
	const value = readStoredText(KEY);
	return value?.startsWith('data:image/') ? value : undefined;
}

export const qrPicture = $state<{ current: string | undefined }>({ current: stored() });

/** Scales a picture file down, whole, and keeps it. False when it can't be read. */
export async function chooseQrPicture(file: File): Promise<boolean> {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.max(1, Math.round(bitmap.width * scale));
		canvas.height = Math.max(1, Math.round(bitmap.height * scale));
		const context = canvas.getContext('2d');
		if (!context) return false;
		context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
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
