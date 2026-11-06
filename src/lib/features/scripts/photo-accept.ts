/**
 * What Take a Photo accepts: images only, the same on every device. With no `capture`, a
 * phone offers its camera and its photo library (Trevor, 2026-11-06: "I should also get
 * photos"); Android shows only Camera and Files when the input also allows PDFs, so a PDF
 * goes through Add script's Upload File or a drop instead (Trevor accepted that trade,
 * 2026-11-05). A PDF picked anyway, through a computer's "All files", is still read.
 */
export const PHOTO_ACCEPT = 'image/*';
