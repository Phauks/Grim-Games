import type { Page } from '@playwright/test';

/**
 * Points a page's camera at pictures: getUserMedia gives a stream drawn from them, as a
 * phone's back camera would see the code on the Storyteller's screen. Several pictures are
 * shown in turn, every `everyMs`, as an animated code's frames are.
 */
export async function aimCamera(phone: Page, srcs: string | string[], everyMs = 400) {
	await phone.addInitScript(
		({ srcs, everyMs }) => {
			navigator.mediaDevices.getUserMedia = async () => {
				const images = await Promise.all(
					srcs.map(async (src) => {
						const image = new Image();
						image.src = src;
						await image.decode();
						return image;
					})
				);
				const canvas = document.createElement('canvas');
				canvas.width = canvas.height = 480;
				const context = canvas.getContext('2d')!;
				const start = performance.now();
				const draw = () => {
					const shown = Math.floor((performance.now() - start) / everyMs) % images.length;
					context.fillStyle = '#fff';
					context.fillRect(0, 0, 480, 480);
					context.drawImage(images[shown], 40, 40, 400, 400);
					requestAnimationFrame(draw);
				};
				draw();
				return canvas.captureStream(10);
			};
		},
		{ srcs: Array.isArray(srcs) ? srcs : [srcs], everyMs }
	);
}

/** A picture of a QR code for `value`, as `aimCamera` takes it. */
export function qrSrc(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
