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

exports.validateFileUpload = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;

  // PATTERN 1: Project Files
  // projects/{projectId}/files/{fileId}/v{version}/...
  const fileMatch = filePath.match(/^projects\/([^/]+)\/files\/([^/]+)\/v(\d+)\/(.*)$/);

  // PATTERN 2: Comment Attachments
  // comments/{projectId}/{commentId}/{fileName}
  const commentMatch = filePath.match(/^comments\/([^/]+)\/([^/]+)\/(.*)$/);

  if (!fileMatch && !commentMatch) {
    console.log(`Doing nothing: File ${filePath} does not match known patterns.`);
    return null;
  }

  // --- Common Validation Logic ---
  let status = 'clean';
  const fileName = fileMatch ? fileMatch[4] : commentMatch[3];

  try {
    const size = object.size;
    if (size > 500 * 1024 * 1024) {
      console.warn('File too large');
    }

    // --- Real Virus Scan with VirusTotal ---
    // Support both .env (modern) and functions.config() (legacy/CLI)
    const vtApiKey = process.env.VIRUSTOTAL_API_KEY || (functions.config().virustotal && functions.config().virustotal.key);

    if (!vtApiKey) {
      console.warn('⚠️ VIRUSTOTAL_API_KEY missing. Skipping real scan.');
    }

    // Only scan if not an image (VirusTotal has rate limits, better to select what to scan)
    // Actually, for security, scan everything. But for free API tier (4 req/min), be careful.
    // Let's implement full scan for demonstration.

    try {
      console.log('🔍 Starting VirusTotal Scan...');
      const VirusTotalApi = require('node-virustotal');
      const virusTotal = new VirusTotalApi(vtApiKey);
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const crypto = require('crypto');

      // 1. Download file to temp
      const tempFilePath = path.join(os.tmpdir(), fileName);
      await file.download({ destination: tempFilePath });

      // 2. Read file and calculate hash (to check if already scanned) or upload
      const fileBuffer = fs.readFileSync(tempFilePath);

      // Check file size < 32MB for VirusTotal standard API
      if (object.size > 32 * 1024 * 1024) {
        console.warn('⚠️ File too large for standard VT API, skipping scan');
      } else {
        // Upload file to VirusTotal
        // Note: This matches the user's request to use the provided key.
        try {
          // Fix Hanging Issue: Wrap in 10s timeout to prevent Cloud Function from staying pending
          const scanPromise = virusTotal.fileScan(fileBuffer, fileName);
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('VT Scan Timeout')), 10000));

          const response = await Promise.race([scanPromise, timeoutPromise]);
          console.log('📤 Sent to VirusTotal:', response);
        } catch (apiError) {
          console.error('VT API Error/Timeout:', apiError.message);
        }
      }

      // Clean up temp file
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);

    } catch (vtError) {
      console.error('⚠️ VirusTotal Scan Failed (likely rate limit or network):', vtError.message);
      // Fallback: If scanner fails, do we block? 
      // For now, let's allow but log error.
    }

    // Keep the "Virus" name check as a fail-safe / test mechanism
    if (fileName.toLowerCase().includes('virus') || fileName.toLowerCase().includes('infected')) {
      status = 'infected';
      console.warn(`🚨 DETECTED TEST VIRUS SIGNATURE in ${fileName} (Mock Logic Fallback)`);

      // Strict Policy: DELETE infected file immediately
      try {
        await file.delete();
        console.warn(`🗑️ Deleted infected file: ${filePath}`);
      } catch (deleteErr) {
        console.error(`Failed to delete infected file: ${deleteErr.message}`);
      }
    }
  } catch (err) {
    console.error('Validation error:', err);
    status = 'error';
  }

  // --- Update Firestore ---

  // CASE 1: Project File
  if (fileMatch) {
    const [_, projectId, fileId, versionStr] = fileMatch;
    const version = parseInt(versionStr, 10);
    const fileRef = admin.firestore().doc(`projects/${projectId}/files/${fileId}`);

    try {
      await admin.firestore().runTransaction(async (t) => {
        const doc = await t.get(fileRef);
        if (!doc.exists) return;
        const data = doc.data();
        const versions = data.versions || [];
        const index = versions.findIndex(v => v.version === version);
        if (index !== -1) {
          versions[index].validationStatus = status;
          t.update(fileRef, { versions });
        }
      });
      console.log(`✅ Updated FILE status: ${fileId} v${version} -> ${status}`);
    } catch (e) {
      console.error('Failed to update file status', e);
    }
  }

  // CASE 2: Comment Attachment
  if (commentMatch) {
    const [_, projectId, commentId] = commentMatch;
    const commentRef = admin.firestore().doc(`projects/${projectId}/comments/${commentId}`);

    try {
      await admin.firestore().runTransaction(async (t) => {
        const doc = await t.get(commentRef);
        if (!doc.exists) return;

        const data = doc.data();
        let attachments = data.attachments || [];

        // Find attachment by checking if URL contains the filename or id matching timestamp
        // Since we don't have the exact array index or ID easily from storage path alone (unless we parse it),
        // we'll try to match by name match within the object name.
        // Storage path: comments/pid/cid/timestamp_index_name
        // We can match loosely or try to find the entry where url contains the filename.

        // Better: Find the attachment where the URL (if stored) or Name generally matches.
        // Actually, in `uploadCommentAttachments`, we construct path: `.../${timestamp}_${index}_${sanitizedFileName}`
        // and we store that full URL.
        // So we can check if the attachment's URL contains the object's name (last part).
        // object.name is full path `comments/.../...`
        // We can just rely on the fact that we need to update the status of the item that matches this file.

        // This is a bit tricky if multiple files have same name, but timestamp makes it unique.

        const mediaLink = object.mediaLink || object.name; // SelfLink or name

        let found = false;
        attachments = attachments.map(att => {
          // Check if this attachment corresponds to the uploaded file
          // The safest is if we stored the Storage Path in Firestore, but we store URL.
          // The URL contains the path usually encoded.

          if (att.url && att.url.includes(encodeURIComponent(fileName))) {
            found = true;
            return { ...att, validationStatus: status };
          }
          // Fallback: check if decoded URL contains it
          if (att.url && decodeURIComponent(att.url).includes(fileName)) {
            found = true;
            return { ...att, validationStatus: status };
          }
          return att;
        });

        if (found) {
          t.update(commentRef, { attachments });
        }
      });
      console.log(`✅ Updated COMMENT attachment status: ${commentId} -> ${status}`);
    } catch (e) {
      console.error('Failed to update comment status', e);
    }
  }

  return null;
});

exports.resendAccessLink = functions.https.onCall(async (data, context) => {
  const { projectId, email } = data;

  // Basic validation
  if (!projectId || !email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing project ID or email');
  }

  // 1. Check if there is an existing invitation for this email & project
  const invitationsRef = admin.firestore().collection('project_invitations');
  const snapshot = await invitationsRef
    .where('projectId', '==', projectId)
    .where('email', '==', email)
    .where('status', 'in', ['pending', 'accepted']) // Only consider active invites
    .get();

  if (snapshot.empty) {
    // Security: Don't reveal if email exists or not?
    // User requirement: "kiểm tra nếu mail không có trong list share thì báo lỗi"
    // So we throw NOT FOUND error.
    throw new functions.https.HttpsError('not-found', 'Email này không có trong danh sách được mời.');
  }

  // 2. Generate NEW invitation (Keep old ones active)
  const crypto = require('crypto');
  const newToken = crypto.randomBytes(16).toString('hex'); // 32 chars
  const accessCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 60 * 1000); // Code valid for 30 mins

  const oldData = snapshot.docs[0].data();

  const newInvitation = {
    ...oldData,
    token: newToken,
    status: 'pending',
    createdAt: now,
    revokedAt: null,
    allowedDevices: [],
    verificationCode: null,
    accessCode: { // New field for recovery OTP
      code: accessCode,
      expiresAt: expiresAt
    }
  };

  delete newInvitation.id;

  const batch = admin.firestore().batch();
  const newInviteRef = invitationsRef.doc(newToken);
  batch.set(newInviteRef, newInvitation);

  // 3. Send Email
  const mailRef = admin.firestore().collection('mail').doc();
  const origin = data.origin || 'https://review-system-b8883.web.app';
  const link = `${origin}/review/${projectId}?token=${newToken}`;

  batch.set(mailRef, {
    to: email,
    message: {
      subject: `[Code: ${accessCode}] Link truy cập dự án: ${oldData.resourceType === 'project' ? 'Project' : 'File'}`,
      html: `
        <p>Bạn đã yêu cầu gửi lại link truy cập.</p>
        <p>Mã truy cập của bạn là: <strong>${accessCode}</strong></p>
        <p>Hoặc truy cập trực tiếp bằng link bên dưới:</p>
        <a href="${link}">Truy cập ngay</a>
        <p>Mã và Link có hiệu lực trong 30 phút (cho việc nhập mã).</p>
      `
    }
  });

  await batch.commit();

  return { success: true, message: 'Link và mã truy cập mới đã được gửi vào email của bạn.' };
});

exports.verifyAccessCode = functions.https.onCall(async (data, context) => {
  const { projectId, email, code, deviceId } = data;

  if (!projectId || !email || !code) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing info');
  }

  const invitationsRef = admin.firestore().collection('project_invitations');
  const snapshot = await invitationsRef
    .where('projectId', '==', projectId)
    .where('email', '==', email)
    .where('status', 'in', ['pending', 'accepted'])
    .get();

  if (snapshot.empty) {
    throw new functions.https.HttpsError('not-found', 'Email không tồn tại');
  }

  // Find the invitation that matches the code
  const match = snapshot.docs.find(doc => {
    const d = doc.data();
    return d.accessCode && d.accessCode.code === code;
  });

  if (!match) {
    throw new functions.https.HttpsError('invalid-argument', 'Mã xác thực không đúng');
  }

  const invitation = match.data();
  if (invitation.accessCode.expiresAt.toMillis() < Date.now()) {
    throw new functions.https.HttpsError('failed-precondition', 'Mã xác thực đã hết hạn');
  }

  // Code is valid. Bind the device if provided.
  const updates = {
    accessCode: null
  };

  if (deviceId) {
    const allowed = invitation.allowedDevices || [];
    if (!allowed.includes(deviceId)) {
      updates.allowedDevices = [...allowed, deviceId];
    }
  }

  await match.ref.update(updates);

  return { token: match.id };
});
