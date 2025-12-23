import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Environment variable for Service Account (Needs to be set in Vercel project settings)
// Value should be the minified JSON string of the service account key
const SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

if (!getApps().length && SERVICE_ACCOUNT) {
    initializeApp({
        credential: cert(SERVICE_ACCOUNT)
    });
} else if (!getApps().length) {
    console.error("FIREBASE_SERVICE_ACCOUNT env var is missing!");
}

const db = getFirestore();

export default async function handler(req, res) {
    // Parsing path segments from the request URL
    // Expected URL: /share/p/:projectId/file/:fileId or /share/p/:projectId
    // Vercel passes the full URL, we can parse it

    // Note: req.url in Vercel function will be the rewritten path if used via rewrite, 
    // or the direct path.
    // Let's assume the rewrite rule sends /share/p/... to this function

    // Vercel Rewrite sends query params (slug)
    const { slug } = req.query;
    const pathParts = Array.isArray(slug) ? slug : (slug || '').split('/');

    let projectId = null;
    let fileId = null;

    if (pathParts.length > 0) {
        projectId = pathParts[0];
    }

    if (pathParts.length >= 3 && pathParts[1] === 'file') {
        fileId = pathParts[2];
    }

    if (!projectId) {
        // If no project ID, just redirect home
        return res.redirect('/');
    }

    try {
        let title = 'Review System';
        let image = null;

        if (fileId) {
            // Fetch File Data
            const fileDoc = await db.collection('projects').doc(projectId).collection('files').doc(fileId).get();
            if (fileDoc.exists) {
                const data = fileDoc.data();
                title = data.name || 'File';

                // Find best thumbnail
                const currentVersion = data.currentVersion || 1;
                const versionData = data.versions?.find(v => v.version === currentVersion);

                if (versionData) {
                    image = versionData.thumbnail || versionData.poster || versionData.url;
                }
            }
        } else {
            // Fetch Project Data
            const projectDoc = await db.collection('projects').doc(projectId).get();
            if (projectDoc.exists) {
                const data = projectDoc.data();
                title = data.name || 'Dự án';
            }
        }

        // Determine the destination URL (the Vercel app itself)
        // We want to redirect the user to the actual "clean" URL handled by React Router
        // e.g. /review/PROJECT_ID/file/FILE_ID
        // Host header is the domain the user accessed
        const host = req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        let appUrl = `${protocol}://${host}`;

        if (fileId) {
            appUrl = `${appUrl}/review/${projectId}/file/${fileId}`;
        } else {
            appUrl = `${appUrl}/review/${projectId}`;
        }

        // Hybrid Metadata Page Strategy:
        // Always return HTML with OG tags for bots to scrape.
        // Include a client-side JavaScript redirect for humans to reach the app.
        // This avoids flaky user-agent detection and ensures metadata always loads.

        const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <title>${title}</title>
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website">
    <meta property="og:url" content="${appUrl}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="Chia sẻ từ Review System">
    ${image ? `<meta property="og:image" content="${image}">` : ''}

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${appUrl}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="Chia sẻ từ Review System">
    ${image ? `<meta property="twitter:image" content="${image}">` : ''}

    <!-- Redirect for Humans -->
    <meta http-equiv="refresh" content="0;url=${appUrl}">
    <script type="text/javascript">
        window.location.href = "${appUrl}";
    </script>
</head>
<body>
    <p>Đang chuyển hướng đến <a href="${appUrl}">Review System</a>...</p>
</body>
</html>
        `;

        // Cache for 1 hour public, but revalidate
        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        res.status(200).send(html);

    } catch (error) {
        console.error('Error fetching metadata:', error);
        // On error, just redirect safely
        res.redirect('/');
    }
}
