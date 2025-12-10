Attachment cleanup Cloud Functions

This functions folder contains Firebase Cloud Functions to garbage-collect storage objects referenced by Firestore documents when those documents are deleted.

Triggers implemented:
- `cleanUpAttachmentsOnCommentDelete`: Firestore trigger on `projects/{projectId}/comments/{commentId}`. Deletes storage paths referenced in `attachmentPaths`, `attachments`, and similar fields.
- `cleanUpAttachmentsOnFileDelete`: Firestore trigger on `projects/{projectId}/files/{fileId}`. Deletes referenced object paths and attempts to delete objects by common prefixes, including `projects/{projectId}/files/{fileId}/`.

Deploy

1. From this repo root, install dependencies inside `functions/`:

```powershell
cd functions
npm install
```

2. Deploy functions (requires `firebase-tools` and login):

```powershell
firebase deploy --only functions
```

Notes & Safety

- The functions attempt to delete storage objects by exact path or by prefix. Make sure your Firestore documents store storage object paths (object names) or `storagePrefix` values in a predictable format.
- Test in a staging project before deploying to production. Deleted objects are irrecoverable unless you have backups.
- The service account used to run functions must have `Storage Admin` or appropriate delete permissions.
