/**
 * Utility functions for generating social share thumbnails.
 * Creates compressed 1200x630 JPEG images suitable for og:image.
 */

// Target dimensions for social share thumbnails (Facebook recommended)
const SHARE_THUMBNAIL_WIDTH = 1200;
const SHARE_THUMBNAIL_HEIGHT = 630;
const SHARE_THUMBNAIL_QUALITY = 0.8;

/**
 * Resize and compress an image to the social share thumbnail dimensions.
 * @param sourceUrl - URL of the source image
 * @returns Promise<Blob> - JPEG blob of the compressed thumbnail
 */
export async function generateImageThumbnail(sourceUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = SHARE_THUMBNAIL_WIDTH;
            canvas.height = SHARE_THUMBNAIL_HEIGHT;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Calculate crop/fit dimensions (cover mode)
            const sourceAspect = img.width / img.height;
            const targetAspect = SHARE_THUMBNAIL_WIDTH / SHARE_THUMBNAIL_HEIGHT;

            let sx = 0, sy = 0, sw = img.width, sh = img.height;

            if (sourceAspect > targetAspect) {
                // Source is wider - crop horizontally
                sw = img.height * targetAspect;
                sx = (img.width - sw) / 2;
            } else {
                // Source is taller - crop vertically
                sh = img.width / targetAspect;
                sy = (img.height - sh) / 2;
            }

            // Fill with white background (for transparent images)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw image
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, SHARE_THUMBNAIL_WIDTH, SHARE_THUMBNAIL_HEIGHT);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create blob'));
                    }
                },
                'image/jpeg',
                SHARE_THUMBNAIL_QUALITY
            );
        };

        img.onerror = () => {
            reject(new Error('Failed to load image'));
        };

        img.src = sourceUrl;
    });
}

/**
 * Extract first frame from video and generate thumbnail.
 * @param videoUrl - URL of the video file
 * @returns Promise<Blob> - JPEG blob of the first frame thumbnail
 */
export async function generateVideoThumbnail(videoUrl: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        video.onloadeddata = () => {
            // Seek to 0 to get first frame
            video.currentTime = 0;
        };

        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            canvas.width = SHARE_THUMBNAIL_WIDTH;
            canvas.height = SHARE_THUMBNAIL_HEIGHT;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Calculate crop/fit dimensions
            const sourceAspect = video.videoWidth / video.videoHeight;
            const targetAspect = SHARE_THUMBNAIL_WIDTH / SHARE_THUMBNAIL_HEIGHT;

            let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;

            if (sourceAspect > targetAspect) {
                sw = video.videoHeight * targetAspect;
                sx = (video.videoWidth - sw) / 2;
            } else {
                sh = video.videoWidth / targetAspect;
                sy = (video.videoHeight - sh) / 2;
            }

            ctx.fillStyle = '#000000'; // Black background for videos
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(video, sx, sy, sw, sh, 0, 0, SHARE_THUMBNAIL_WIDTH, SHARE_THUMBNAIL_HEIGHT);

            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create video thumbnail blob'));
                    }
                },
                'image/jpeg',
                SHARE_THUMBNAIL_QUALITY
            );
        };

        video.onerror = () => {
            reject(new Error('Failed to load video'));
        };

        video.src = videoUrl;
    });
}

/**
 * Generate thumbnail from PDF first page.
 * Requires pdf.js to be loaded.
 * @param pdfUrl - URL of the PDF file
 * @returns Promise<Blob> - JPEG blob of the first page thumbnail
 */
export async function generatePdfThumbnail(pdfUrl: string): Promise<Blob> {
    // Dynamic import of pdf.js
    const pdfjs = await import('pdfjs-dist');

    // Set worker path
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).toString();

    const pdf = await pdfjs.getDocument(pdfUrl).promise;
    const page = await pdf.getPage(1);

    // Calculate scale to fit target dimensions
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.max(
        SHARE_THUMBNAIL_WIDTH / viewport.width,
        SHARE_THUMBNAIL_HEIGHT / viewport.height
    );
    const scaledViewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = SHARE_THUMBNAIL_WIDTH;
    canvas.height = SHARE_THUMBNAIL_HEIGHT;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('Failed to get canvas context');
    }

    // Center the page
    const offsetX = (SHARE_THUMBNAIL_WIDTH - scaledViewport.width) / 2;
    const offsetY = (SHARE_THUMBNAIL_HEIGHT - scaledViewport.height) / 2;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(offsetX, offsetY);

    // @ts-ignore - pdfjs types may not match runtime API
    await page.render({
        canvasContext: ctx,
        viewport: scaledViewport
    }).promise;

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to create PDF thumbnail blob'));
                }
            },
            'image/jpeg',
            SHARE_THUMBNAIL_QUALITY
        );
    });
}
