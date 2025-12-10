const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize admin SDK (will use default service account when deployed)
admin.initializeApp();
const bucket = admin.storage().bucket();

async function deleteStoragePath(path) {
  if (!path) return;
  try {
    // path should be the full object path within the bucket (no gs://)
    const file = bucket.file(path);
    await file.delete();
    console.log(`Deleted storage object: ${path}`);
  } catch (err) {
    // If file not found, just warn and continue
    if (err && err.code === 404) {
      console.warn(`Storage object not found (already deleted): ${path}`);
    } else {
      console.error(`Failed to delete storage object ${path}:`, err.message || err);
    }
  }
}

async function deleteStoragePrefix(prefix) {
  if (!prefix) return;
  try {
    // deleteFiles supports prefix, will delete all objects under the prefix
    await bucket.deleteFiles({ prefix });
    console.log(`Deleted storage objects with prefix: ${prefix}`);
  } catch (err) {
    console.error(`Failed to delete storage prefix ${prefix}:`, err.message || err);
  }
}

// Helper: take possible fields from doc data that reference storage paths
function collectPathsFromDoc(data) {
  const paths = new Set();
  if (!data || typeof data !== 'object') return [];

  // Common field names
  if (Array.isArray(data.attachmentPaths)) data.attachmentPaths.forEach(p => p && paths.add(p));
  if (Array.isArray(data.attachments)) data.attachments.forEach(a => {
    if (typeof a === 'string') paths.add(a);
    else if (a && a.path) paths.add(a.path);
  });

  // Versions array (files may store versions with urls)
  if (Array.isArray(data.versions)) {
    data.versions.forEach(v => {
      if (!v) return;
      if (v.path) paths.add(v.path);
      if (v.url && typeof v.url === 'string') {
        // If url is a Storage URL (gs:// or contains /o/), try to extract object path
        const match = v.url.match(/\/o\/(.*)\?/);
        if (match && match[1]) paths.add(decodeURIComponent(match[1]));
      }
    });
  }

  // Thumbnails or derived paths
  if (data.thumbnailPath) paths.add(data.thumbnailPath);
  if (data.thumbPath) paths.add(data.thumbPath);

  return Array.from(paths);
}

exports.cleanUpAttachmentsOnCommentDelete = functions.firestore
  .document('projects/{projectId}/comments/{commentId}')
  .onDelete(async (snap, context) => {
    const data = snap.data();
    const projectId = context.params.projectId;
    console.log(`Comment deleted in project ${projectId}, id=${context.params.commentId}`);

    const paths = collectPathsFromDoc(data);
    if (paths.length === 0) {
      console.log('No attachment paths found on comment.');
      return null;
    }

    // Delete each referenced storage path
    await Promise.all(paths.map(p => deleteStoragePath(p)));
    return null;
  });

exports.cleanUpAttachmentsOnFileDelete = functions.firestore
  .document('projects/{projectId}/files/{fileId}')
  .onDelete(async (snap, context) => {
    const data = snap.data();
    const projectId = context.params.projectId;
    console.log(`File document deleted in project ${projectId}, fileId=${context.params.fileId}`);

    // Collect explicit paths
    const paths = collectPathsFromDoc(data);

    // If file documents store a storage prefix (e.g., folder for sequence frames), try to delete by prefix
    if (data && data.storagePrefix) {
      // Example storagePrefix: `projects/${projectId}/files/${fileId}/`
      await deleteStoragePrefix(data.storagePrefix);
    }

    if (paths.length > 0) {
      await Promise.all(paths.map(p => deleteStoragePath(p)));
    }

    // Also try conventional locations: if fileId is used as folder name
    const possiblePrefix = `projects/${projectId}/files/${context.params.fileId}/`;
    await deleteStoragePrefix(possiblePrefix);

    return null;
  });
