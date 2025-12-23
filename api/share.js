import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Environment variable for Service Account (Needs to be set in Vercel project settings)
// Value should be the minified JSON string of the service account key
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

// Robust initialization
let db;
try {
    if (!getApps().length) {
        if (SERVICE_ACCOUNT) {
            initializeApp({
                credential: cert(SERVICE_ACCOUNT)
            });
        } else {
            console.warn("FIREBASE_SERVICE_ACCOUNT env var is missing/invalid!");
        }
    }
    db = getFirestore();
} catch (error) {
    console.error("Firebase Init Error:", error);
}

export default async function handler(req, res) {
    const appUrlOrigin = 'https://view.manhhuynh.work';

    // Vercel Rewrite sends query params (slug)
    const { slug } = req.query;
    const pathParts = Array.isArray(slug) ? slug : (slug || '').split('/');

    let projectId = null;
    let fileId = null;

    if (pathParts.length > 0) projectId = pathParts[0];
    if (pathParts.length >= 3 && pathParts[1] === 'file') fileId = pathParts[2];

    // Default Metadata
    let title = 'Review System';
    let description = 'Chia sẻ từ Review System';
    let image = null;
    let debugError = null; // For debugging output

    try {
        if (!projectId) {
            // No Project ID -> Invalid Link
            return res.redirect('/');
        }

        if (!db) {
            throw new Error("Database not initialized (Check FIREBASE_SERVICE_ACCOUNT)");
        }

        if (fileId) {
            // Fetch File Data
            const fileDoc = await db.collection('projects').doc(projectId).collection('files').doc(fileId).get();
            if (fileDoc.exists) {
                const data = fileDoc.data();
                title = data.name || 'File';

                // Find best thumbnail based on file type
                const currentVersion = data.currentVersion || 1;
                const versionData = data.versions?.find(v => v.version === currentVersion);

                if (versionData) {
                    // Priority: shareThumbnailUrl (compressed for social) > thumbnailUrl (for model/pdf) > sequenceUrls[0] > url
                    if (versionData.shareThumbnailUrl) {
                        image = versionData.shareThumbnailUrl;
                    } else if (versionData.thumbnailUrl) {
                        image = versionData.thumbnailUrl;
                    } else if (versionData.sequenceUrls && versionData.sequenceUrls.length > 0) {
                        image = versionData.sequenceUrls[0]; // First frame for sequences
                    } else if (versionData.url) {
                        image = versionData.url; // Direct URL for image/video
                    }
                }
            } else {
                debugError = `File ID ${fileId} not found in DB`;
                title = 'File Not Found';
            }
        } else {
            // Fetch Project Data
            const projectDoc = await db.collection('projects').doc(projectId).get();
            if (projectDoc.exists) {
                const data = projectDoc.data();
                title = data.name || 'Dự án';

                // Try to get thumbnail from the first file in the project
                const filesSnapshot = await db.collection('projects').doc(projectId).collection('files').limit(1).get();
                if (!filesSnapshot.empty) {
                    const firstFile = filesSnapshot.docs[0].data();
                    const currentVersion = firstFile.currentVersion || 1;
                    const versionData = firstFile.versions?.find(v => v.version === currentVersion);
                    if (versionData) {
                        // Priority: shareThumbnailUrl > thumbnailUrl > sequenceUrls[0] > url
                        if (versionData.shareThumbnailUrl) {
                            image = versionData.shareThumbnailUrl;
                        } else if (versionData.thumbnailUrl) {
                            image = versionData.thumbnailUrl;
                        } else if (versionData.sequenceUrls && versionData.sequenceUrls.length > 0) {
                            image = versionData.sequenceUrls[0];
                        } else if (versionData.url) {
                            image = versionData.url;
                        }
                    }
                }
            } else {
                debugError = `Project ID ${projectId} not found in DB`;
                title = 'Project Not Found';
            }
        }

    } catch (error) {
        console.error('Metadata Error:', error);
        debugError = error.message;
        title = `DEBUG ERROR: ${error.message}`; // Show error in title for debugging
    }

    // Canonical URL for og:url (points to share page so bots don't re-crawl SPA)
    let canonicalUrl = appUrlOrigin;
    if (projectId) canonicalUrl += `/share/p/${projectId}`;
    if (fileId) canonicalUrl += `/file/${fileId}`;

    // Destination URL for human redirect (points to actual app)
    let destUrl = appUrlOrigin;
    if (projectId) destUrl += `/review/${projectId}`;
    if (fileId) destUrl += `/file/${fileId}`;

    // Hybrid Metadata Page Strategy
    const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    
    <!-- Open Graph -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description} ${debugError ? `(Debug: ${debugError})` : ''}">
    ${image ? `<meta property="og:image" content="${image}">` : ''}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${canonicalUrl}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description} ${debugError ? `(Debug: ${debugError})` : ''}">
    ${image ? `<meta property="twitter:image" content="${image}">` : ''}

    <!-- Redirect for Humans (JavaScript only, preventing Bots from following meta-refresh) -->
    <script type="text/javascript">
        window.location.href = "${destUrl}";
    </script>
</head>
<body>
    <p>Đang chuyển hướng đến <a href="${destUrl}">Review System</a>...</p>
    ${debugError ? `<p style="color:red; display:none">Debug: ${debugError}</p>` : ''}
</body>
</html>
    `;

    // Disable caching completely to ensure bots get fresh data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(html);
}
