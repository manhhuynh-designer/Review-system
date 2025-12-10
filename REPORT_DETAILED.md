# Báo Cáo Đánh Giá Ứng Dụng Review-system

## Tóm tắt
Ứng dụng là một hệ thống review tài sản sáng tạo (media-first) hỗ trợ xem và chú thích nhiều loại file: hình ảnh, PDF, video, sequence ảnh, và 3D (GLB). Ứng dụng hỗ trợ upload/versioning, public review links, commenting có timestamp cho video, canvas chú thích (Konva) và viewers chuyên biệt (react-pdf, three.js).

## Mục đích & luồng chính
- Mục đích: Cho phép admin upload assets và chia sẻ link review cho khách hàng/đối tác để xem, comment và annotate trực tiếp trên tài sản.
- Luồng chính:
  - Admin upload file (kéo-thả hoặc selector) qua `src/components/files/FileUploader.tsx`.
  - File lưu trên Firebase Storage, meta lưu Firestore (xem `src/lib/firebase.ts` và `src/stores/files.ts`).
  - Reviewer mở link (công khai hoặc private tùy cấu hình), nhập tên hiển thị, xem grid `FilesList` và mở `FileViewDialog` để xem/annotate/comment.
  - Bình luận được quản lý trong `src/stores/comments.ts` và hiển thị trong `CommentsList`.

## Các file chính đã tham khảo (làm bằng chứng)
- `README.md`, `package.json`
- `src/pages/ReviewPage.tsx`
- `src/lib/firebase.ts`
- `src/stores/files.ts`, `src/stores/comments.ts`
- `src/components/files/FileUploader.tsx`, `FilesList.tsx`, `FileViewDialog.tsx`, `FileCard.tsx`
- `src/components/viewers/PDFViewer.tsx`, `CustomVideoPlayer.tsx`, `GLBViewer.tsx`, `ImageSequenceViewer.tsx`
- `src/components/annotations/AnnotationCanvasKonva.tsx`, `AnnotationToolbar.tsx`

## Tech stack & hạ tầng
- Frontend: React + Vite + TypeScript, Tailwind CSS (shadcn/ui style components).
- State: Zustand (stores under `src/stores`).
- Viewers: `react-pdf`, `react-konva`, `react-three-fiber` (three.js), `@mediamonks/fast-image-sequence`.
- Backend/Infra: Firebase (Auth, Firestore, Storage). Có file `firebase.json`, `firestore.rules`, `storage.rules` trong repo.
- Deployment: Vercel / Firebase Hosting (gợi ý trong README và `vercel.json`).

## Đánh giá UX — strengths / weaknesses
- Strengths:
  - Hỗ trợ đa dạng định dạng media (video timestamp, image sequences, GLB 3D) phù hợp studio/creative review.
  - Annotation toolkit tương đối đầy đủ (pen, rect, arrow, undo/redo) tích hợp trực tiếp trong viewer.
  - Realtime-ish: sử dụng Firestore onSnapshot để cập nhật comment/file live.
  - Versioning và sequence reordering hữu ích cho pipeline sản xuất.
- Weaknesses:
  - Mô hình phân quyền chưa tinh tế: README và code cho thấy "public read" cho review link — rủi ro lộ tài sản.
  - Thiếu audit/SSO/enterprise controls (SAML, logs).
  - Không có cơ chế dọn dẹp attachments phụ trợ khi comment/file bị xóa (dễ gây orphaned storage).
  - Thiếu tính năng collaboration nâng cao: presence, live cursors, threaded approvals.

## So sánh nhanh với đối thủ (Filestage, Frame.io, InVision, Google Drive comments)
- Filestage: mạnh ở workflow phê duyệt, approver roles, deadline/reminder — app hiện tại thiếu automation workflow và role granular.
- Frame.io: mạnh về streaming video, transcoding, project-level DAM, SSO — app này nhẹ hơn, có lợi thế hỗ trợ GLB và sequence, dễ self-host.
- InVision: mạnh về prototyping & design inspector — app này mạnh hơn về media đa dạng và annotation trên video/3D.
- Google Drive comments: mạnh về realtime presence, sharing granular — app này chuyên về creative review nhưng cần cải thiện share/privacy.

## Đề xuất tính năng (ưu tiên, mô tả, giá trị, độ phức tạp, note cài đặt)
1. Secure expiring signed download URLs
   - Giá trị: giảm rủi ro leak khi share link.
   - Complexity: Medium
   - Cài đặt: mở rộng `src/lib/firebase.ts` để tạo signed URLs (Storage `getSignedUrl` hoặc Cloud Function), cập nhật `ensureDownloadUrl` trong `src/components/files/FilesList.tsx` và `FileViewDialog.tsx`.

2. Invite-only review links với whitelist email
   - Giá trị: private client reviews không cần full account nhưng giới hạn người xem.
   - Complexity: Medium
   - Cài đặt: thêm collection `reviewLinks` trong Firestore, UI trong admin pages (chỉnh `src/pages/*`), kiểm tra khi render trang review (`src/pages/ReviewPage.tsx`).

3. Cloud Function: garbage-collect attachments khi comment/file bị xóa
   - Giá trị: tiết kiệm storage, tránh dữ liệu dư thừa.
   - Complexity: Low–Medium
   - Cài đặt: thêm Cloud Function (node) triggered onDelete for `comments` và `files` documents; dùng `deleteStorageFile` logic từ `src/lib/firebase.ts`.

4. Threaded replies + soft-delete comment
   - Giá trị: giữ lịch sử hội thoại, tránh orphan replies.
   - Complexity: Low
   - Cài đặt: `src/stores/comments.ts` — thay vì hard delete set `deletedAt`/`isDeleted`; UI trong `CommentsList.tsx` hiển thị placeholder.

5. Presence & Approve/Reject buttons
   - Giá trị: nhanh approve, biết ai đang xem.
   - Complexity: Medium
   - Cài đặt: Firestore `presence` docs under `projects/{id}/presence/{userId}`; UI badges trong `FileViewDialog.tsx` header.

6. Export comments/annotations (PDF/CSV)
   - Giá trị: báo cáo gửi khách hàng và lưu trữ.
   - Complexity: Low
   - Cài đặt: reuse `src/lib/storageUtils.ts` export helpers; UI dialog `src/components/dashboard/ExportDataDialog.tsx`.

7. Real-time shared annotations (live)
   - Giá trị: synchronous collaboration.
   - Complexity: High
   - Cài đặt: persist annotation actions to Firestore under `files/{fileId}/annotations`; update `AnnotationCanvasKonva.tsx` to listen via onSnapshot.

8. Automated file scan & approval pipeline
   - Giá trị: bảo mật, filter file types, virus scanning.
   - Complexity: High
   - Cài đặt: Cloud Function on Storage finalize to scan, set `isApproved` in Firestore; `FilesList`/`FileViewDialog` phải check this flag.

9. Retention & auto-archive rules
   - Giá trị: quản lý chi phí và tuân thủ.
   - Complexity: Medium
   - Cài đặt: metadata flags in file docs + scheduled Cloud Function to archive/delete.

10. Comment search & filters
   - Giá trị: xử lý reviews lớn nhanh hơn.
   - Complexity: Low–Medium
   - Cài đặt: UI enhancements in `CommentsList.tsx` và Firestore indexes (`firestore.indexes.json`).

11. Webhooks/Slack notifications
   - Giá trị: tích hợp vào workflow đội ngũ.
   - Complexity: Medium
   - Cài đặt: Cloud Function to forward on create/update events; or add webhook config in `src/lib/notifications.ts`.

## Vấn đề bảo mật & tuân thủ cần lưu ý
- Xác minh `firestore.rules` và `storage.rules` để đảm bảo reviewer public không thể overwrite admin paths.
- Nếu để public read trên Storage, cần chuyển sang signed URLs hoặc hạn chế metadata exposure.
- Dọn dẹp attachments khi xóa comment/file (Cloud Function) để tránh lưu trữ dữ liệu nhạy cảm.
- Thêm rate-limiting / CAPTCHA trên public upload/comment endpoints để tránh spam/DoS.
- Nếu khách hàng yêu cầu SSO / audit, xây thêm SAML/OAuth và ghi log audit (Cloud Logging).
- GDPR/CCPA: cung cấp export & delete per-personal-data (reviewer display names, attachments).

## Độ tin cậy & giả định
- Độ tin cậy: Cao cho phần nhìn thấy trong mã nguồn (stores, components, lib). Trung bình cho cấu hình runtime (các Cloud Functions hoặc rules nếu không nằm trong repo).
- Giả định: `README.md` còn đúng; một số admin pages hoặc cloud functions có thể chưa được commit.

## Bước tiếp theo khuyến nghị
- Chọn 3 tính năng ưu tiên để làm roadmap (ví dụ: signed URLs, invite-only links, attachment cleanup). Tôi có thể chuẩn bị task breakdown + estimates cho 3 tính năng này.

---

*File được tạo tự động từ scan mã nguồn; nếu bạn muốn phiên bản tiếng Anh hoặc bổ sung chi tiết kĩ thuật (ERD Firestore, API contracts, hoặc estimates theo giờ), hãy cho tôi biết.*

## Chi tiết các tính năng đề xuất

Dưới đây là phần giải thích chi tiết cho các tính năng đã liệt kê ở trên. Mỗi mục gồm: mô tả ngắn, giá trị người dùng, luồng mẫu, thay đổi UI/thư mục mã liên quan, backend/infra cần thêm, rủi ro bảo mật và ước lượng độ phức tạp.

1) Secure, expiring signed download URLs
   - Mô tả: Tạo URL có chữ ký (signed URL) cho phép tải xuống trong thời gian ngắn (ví dụ 1–24 giờ) thay vì dùng public Storage URLs.
   - Giá trị: Giảm rủi ro chia sẻ công khai lâu dài của tài sản.
   - Luồng mẫu: Reviewer nhấn `Download` → client gọi endpoint (Cloud Function) → nhận signed URL → redirect/tải.
   - UI (vùng mã): `src/components/files/FileViewDialog.tsx`, `src/components/files/FilesList.tsx` (hàm `ensureDownloadUrl`).
   - Backend (vùng mã): Cloud Function hoặc serverless endpoint sử dụng Storage API (`getSignedUrl`) — có thể thêm helper trong `src/lib/firebase.ts` cho admin tooling.
   - Bảo mật: TTL hợp lý, endpoint có thể yêu cầu token link hợp lệ để tránh lạm dụng.
   - Độ phức tạp: Medium (~8–16 giờ).

2) Invite-only review links với whitelist email
   - Mô tả: Tạo link review dạng token có expiry và tùy chọn whitelist email/domain để giới hạn người xem.
   - Giá trị: Cho phép private client reviews mà không bắt buộc đăng ký tài khoản.
   - Luồng mẫu: Admin tạo link trong giao diện project → chia sẻ link → client vào link và (tuỳ cấu hình) xác thực email hoặc dùng token.
   - UI (vùng mã): thêm `ProjectShareDialog` trong admin pages; `src/pages/ReviewPage.tsx` validate token trên load.
   - Backend (vùng mã): collection `reviewLinks` trong Firestore; Cloud Function để validate/issue tokens và gửi invite email nếu cần.
   - Bảo mật: Token phải random và có expiry; nếu whitelist email, cần kiểm tra/verify email (OTP hoặc magic link) để tránh giả mạo tên hiển thị.
   - Độ phức tạp: Medium (~12–24 giờ).

3) Attachment cleanup Cloud Function
   - Mô tả: Cloud Function lắng nghe `onDelete` cho documents `comments`/`files` và xóa các file storage được tham chiếu (attachments, thumbnails).
   - Giá trị: Tránh orphaned storage, giảm chi phí và rủi ro rò rỉ dữ liệu.
   - Luồng mẫu: Admin xóa comment/file → trigger CF đọc `attachmentPaths` → xóa từng path.
   - UI (vùng mã): không bắt buộc; có thể thêm trạng thái progress trong `FilesList.tsx` nếu muốn feedback.
   - Backend (vùng mã): Cloud Function NodeJS sử dụng admin SDK; có thể tái sử dụng logic `deleteStorageFile` từ `src/lib/firebase.ts`.
   - Bảo mật: CF dùng service account với quyền tối thiểu và ghi log thao tác xóa để audit.
   - Độ phức tạp: Low–Medium (~4–8 giờ).

**Đã triển khai (thư mục `functions/`)**

- Tôi đã thêm một implementation mẫu Cloud Functions nằm ở `functions/index.js` trong repository. Hàm chính:
   - `cleanUpAttachmentsOnCommentDelete` — trigger `onDelete` cho `projects/{projectId}/comments/{commentId}` và xóa `attachmentPaths`, `attachments` được lưu trong document.
   - `cleanUpAttachmentsOnFileDelete` — trigger `onDelete` cho `projects/{projectId}/files/{fileId}` và xóa mọi đường dẫn được tham chiếu, thử xóa theo `storagePrefix` nếu có, và cố gắng xóa theo prefix `projects/{projectId}/files/{fileId}/`.

Files added:
- `functions/package.json` — dependencies `firebase-admin`, `firebase-functions` (node 18)
- `functions/index.js` — logic các triggers
- `functions/README.md` — hướng dẫn deploy & lưu ý an toàn

Hướng dẫn deploy nhanh:

```powershell
cd functions
npm install
firebase login
firebase deploy --only functions
```

Lưu ý trước khi deploy:
- Test trên staging project trước; deleted objects là không thể khôi phục.
- Đảm bảo service account functions có quyền xóa object trong Storage.
- Điều chỉnh tìm và xóa object tuỳ theo cách project bạn lưu path/url trong Firestore (ví dụ: `versions[].path`, `attachmentPaths[]`, `storagePrefix`).

4) Threaded replies + soft-delete for comments
   - Mô tả: Hỗ trợ reply-to-comment (thread) và soft-delete (đánh dấu `isDeleted`/`deletedAt`) thay vì xóa vĩnh viễn.
   - Giá trị: Giữ nguyên ngữ cảnh hội thoại và tránh orphan replies.
   - Luồng mẫu: Người dùng reply → comment mới có `parentId`; khi delete set `isDeleted=true` và hiển thị placeholder.
   - UI (vùng mã): `src/components/comments/CommentsList.tsx`, `src/components/comments/AddComment.tsx` (hỗ trợ `parentId`).
   - Backend (vùng mã): schema field `parentId`, `isDeleted`; cập nhật logic trong `src/stores/comments.ts`.
   - Bảo mật: Chỉ admin hoặc tác giả mới có quyền xóa/restore; soft-delete tiện rollback.
   - Độ phức tạp: Low (~6–12 giờ).

5) Presence & Approve/Reject buttons
   - Mô tả: Ghi nhận ai đang xem file (presence) và thêm các nút `Approve` / `Request changes` để thu thập trạng thái reviewer.
   - Giá trị: Tăng tính minh bạch và đẩy nhanh quyết định phê duyệt.
   - Luồng mẫu: Khi mở `FileViewDialog`, client upsert document `projects/{id}/presence/{sessionId}`; Approve lưu vào `files/{id}.approvals`.
   - UI (vùng mã): header của `FileViewDialog.tsx` hiển thị avatars và nút approve/reject; `FilesList.tsx` hiển thị số approve.
   - Backend (vùng mã): Firestore presence collection + optional CF cleanup cho presences hết hạn.
   - Bảo mật: Use ephemeral IDs và không tiết lộ PII không cần thiết.
   - Độ phức tạp: Medium (~12–20 giờ).

6) Export comments/annotations (PDF/CSV)
   - Mô tả: Export comment threads và annotation layers thành CSV hoặc PDF (PDF có thể kèm screenshots hoặc overlay annotation).
   - Giá trị: Lưu trữ báo cáo cho khách hàng, chứng cứ pháp lý và backup.
   - Luồng mẫu: Admin chọn file → mở `ExportDataDialog` → chọn format → generate client-side hoặc server-side → download.
   - UI (vùng mã): `src/components/dashboard/ExportDataDialog.tsx` hoặc nút export trong `FileViewDialog.tsx`.
   - Backend (vùng mã): CSV có thể generate client-side; PDF nếu cần nhiều trang/screenshot có thể dùng Cloud Function headless renderer.
   - Bảo mật: Respect access controls; loại bỏ PII nếu cần.
   - Độ phức tạp: Low (~4–12 giờ).

7) Real-time shared annotations (live)
   - Mô tả: Truyền các thao tác annotation (stroke, add shape) theo thời gian thực để tất cả reviewer thấy update live.
   - Giá trị: Synchronous collaboration, hữu ích cho pair-review.
   - Luồng mẫu: Người vẽ push deltas vào `files/{id}/annotations/live`; các client subscribe onSnapshot để render.
   - UI (vùng mã): `src/components/annotations/AnnotationCanvasKonva.tsx` cần lắng nghe live updates; thêm layer cho remote cursors.
   - Backend (vùng mã): Firestore có thể làm được nhưng cần throttle/coalesce; quy mô lớn nên cân nhắc WebSocket service.
   - Bảo mật: Throttle để tránh DoS, xác thực thao tác để tránh spoofing.
   - Độ phức tạp: High (~3–6 tuần thiết kế & triển khai).

8) Automated virus/format validation on upload
   - Mô tả: Sau upload, Cloud Function scan file (3rd-party hoặc ClamAV) và set `isApproved` flag; UI chỉ hiển thị file khi approved.
   - Giá trị: Bảo vệ platform khỏi file độc hại.
   - Luồng mẫu: Upload → Storage `onFinalize` CF → scan → set `files/{id}.isApproved`.
   - Backend (vùng mã): Cloud Function + scanner service (VirusTotal API hoặc container ClamAV); update UI `FilesList`/`FileViewDialog` để tôn trọng flag.
   - Bảo mật: Xử lý quota, logs, false positives policy.
   - Độ phức tạp: High (~2–4 tuần).

9) Retention & auto-archive rules
   - Mô tả: Admin có thể set retention per project; scheduler Cloud Function auto-archive hoặc soft-delete theo policy.
   - Giá trị: Quản lý chi phí và compliance.
   - Luồng mẫu: Admin set rule → CF scheduled job quét và mark/archive/delete theo policy.
   - Backend (vùng mã): metadata flag trên file docs + scheduled Cloud Function (Pub/Sub scheduler).
   - Bảo mật: Soft-delete và audit log để tránh mất mát dữ liệu nhầm.
   - Độ phức tạp: Medium (~12–24 giờ).

10) Marker-based filtering and comment search
   - Mô tả: Lọc comments theo author, trạng thái, time-marker, và hỗ trợ tìm kiếm full-text.
   - Giá trị: Tăng hiệu quả xử lý review lớn.
   - Luồng mẫu: Filter bar trong `CommentsList` → query Firestore (indexed) hoặc search index (Algolia).
   - UI (vùng mã): `src/components/comments/CommentsList.tsx`, `FileViewDialog.tsx` add filter controls.
   - Backend (vùng mã): Firestore composite indexes (`firestore.indexes.json`) hoặc send comments to Algolia for full-text.
   - Bảo mật: Không index dữ liệu nhạy cảm không được phép.
   - Độ phức tạp: Low–Medium (~8–16 giờ).

11) Webhook notifications & integrations
   - Mô tả: Gửi POST tới webhook (Slack, Teams, custom) khi có sự kiện (comment, upload, resolve).
   - Giá trị: Kết nối review flow vào hệ thống team, tăng tương tác.
   - Luồng mẫu: Admin cấu hình webhook URL → CF trigger onCreate/onUpdate → POST payload có chữ ký HMAC.
   - Backend (vùng mã): Cloud Function sender với retry/backoff; hoặc task queue. Reuse `src/lib/notifications.ts` if present.
   - Bảo mật: Sign payloads, giữ secret an toàn, rate-limit.
   - Độ phức tạp: Medium (~8–16 giờ).

---

Nếu bạn muốn, tôi sẽ cập nhật `REPORT_DETAILED.md` này bằng tiếng Anh hoặc mở rộng thêm task breakdown và estimates theo giờ cho 3 tính năng ưu tiên (ví dụ: signed URLs, invite-only links, attachment cleanup). Hãy cho biết lựa chọn của bạn.
