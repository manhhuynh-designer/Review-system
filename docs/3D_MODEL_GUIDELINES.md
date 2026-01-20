# Hướng dẫn Xuất File 3D (GLB/GLTF) từ Blender cho Review System

Để đảm bảo file 3D hiển thị chính xác trên trình duyệt (Three.js), bạn cần thiết lập vật liệu (Material) trong Blender theo chuẩn **PBR (Physically Based Rendering)** và xuất đúng định dạng glTF 2.0.

## 1. Nguyên tắc chung
*   Sử dụng **Principled BSDF** node cho tất cả các vật liệu. Đây là node chuẩn mà glTF exporter hỗ trợ tốt nhất.
*   **Apply Scale/Rotation:** Luôn ấn `Ctrl+A` -> `All Transforms` cho object trước khi xuất để tránh bị sai tỉ lệ hoặc hướng xoay.
*   **UV Mapping:** Đảm bảo object đã được UV map (đặc biệt là cho Normal Map và Ambient Occlusion).

## 2. Thiết lập Vật liệu (Material Setup)

### A. Vật liệu Kim loại (Metallic) & Độ nhám (Roughness)
*   **Metallic:** Kéo thanh `Metallic` lên `1.0` cho kim loại hoàn toàn.
*   **Roughness:**
    *   `0.0`: Bóng loáng như gương.
    *   `1.0`: Nhám hoàn toàn (không phản chiếu rõ).
*   **Lưu ý:** Nếu dùng Texture (ảnh map), node Image Texture phải:
    *   Nối vào cổng `Metallic` hoặc `Roughness`.
    *   Color Space của ảnh phải để là **Non-Color**.

### B. Vật liệu Kính (Glass / Transmission)
Để xuất được kính trong suốt:
1.  Trong **Principled BSDF**:
    *   **Transmission:** Tăng lên `1.0`.
    *   **Roughness:** Để thấp (ví dụ `0.0` - `0.1`) để kính trong.
    *   **Base Color:** Nên để màu trắng sáng (hoặc màu tint nhẹ).
    *   **Alpha:** Giữ nguyên `1.0` (Đừng giảm Alpha nếu muốn ra chất liệu kính khúc xạ - Refraction).
2.  **Quan trọng:** glTF Export Setting:
    *   Exporter của Blender (các bản mới 3.6+, 4.0+) tự động nhận Transmission.

### C. Vật liệu Trong suốt (Alpha / Transparency)
Dùng cho decal, lưới, vải mỏng (không phải kính khúc xạ):
1.  Trong **Principled BSDF**:
    *   Nối texture có kênh Alpha vào cổng **Alpha**.
    *   Hoặc chỉnh thanh **Alpha** xuống thấp hơn `1.0`.
2.  Trong tab **Material Properties** (bên phải):
    *   Kéo xuống mục **Settings**.
    *   **Blend Mode:** Chuyển từ `Opaque` sang `Alpha Blend` hoặc `Alpha Hashed`.
    *   (Điều này giúp Blender viewport hiển thị đúng và nhắc exporter biết đây là vật liệu trong suốt).

### D. Vật liệu Phát sáng (Emission)
1.  Trong **Principled BSDF**:
    *   **Emission Color:** Chọn màu sáng.
    *   **Emission Strength:** Tăng lên (ví dụ `5.0` - `10.0`).
2.  Nếu dùng Texture:
    *   Nối Image Texture vào cổng **Emission Color**.
    *   (Lưu ý: Three.js renderer cần bật hiệu ứng **Bloom** thì mới thấy quầng sáng tỏa ra, nếu không nó chỉ là màu phẳng rất sáng).

## 3. Cấu hình Xuất (Export Settings)
Khi chọn **File > Export > glTF 2.0 (.glb/.gltf)**:

### Tab "Include"
*   **Limit to:** Chọn `Selected Objects` (nếu chỉ muốn xuất object đang chọn).
*   **Cameras:** Tích chọn nếu muốn xuất cả góc máy camera từ Blender.
*   **Punctual Lights:** Tích chọn nếu muốn xuất đèn (Point, Spot, Sun). *Lưu ý: Thường nên tắt để dùng ánh sáng môi trường của web cho đồng bộ.*

### Tab "Geometry"
*   **UVs:** Tích chọn.
*   **Normals:** Tích chọn.
*   **Tangents:** Tích chọn (quan trọng nếu dùng Normal Map để hiển thị chi tiết gồ ghề đúng hướng ánh sáng).

### Tab "Material" (quan trọng)
*   **Export Materials:** Tích chọn.
*   **Images:** Chọn **Automatic** (khuyến nghị)

## 4.5. Tối ưu Textures với WebP (Khuyến nghị)

> ⚠️ **KHÔNG export WebP trực tiếp từ Blender!**  
> Blender glTF exporter có bug khi export WebP textures, gây lỗi "uri undefined".

### Quy trình đúng để dùng WebP textures:

**Bước 1:** Export từ Blender với **Images = Automatic** (PNG/JPEG mặc định)

**Bước 2:** Cài đặt `gltf-transform` CLI
```bash
npm install -g @gltf-transform/cli
```

**Bước 3:** Convert textures sang WebP
```bash
gltf-transform webp input.glb output-webp.glb --quality 80
```

**Các tùy chọn hữu ích:**
```bash
# Nén Draco mesh + WebP textures
gltf-transform optimize input.glb output.glb --compress draco --texture-compress webp

# Chỉ WebP với chất lượng tùy chỉnh
gltf-transform webp input.glb output.glb --quality 75

# Resize textures lớn (tối đa 2048px)
gltf-transform resize input.glb output.glb --width 2048 --height 2048
```

### Lợi ích:
- ✅ File size giảm 50-80% so với PNG
- ✅ Tương thích hoàn toàn với Three.js
- ✅ Có thể kết hợp Draco mesh compression

## 5. Kiểm tra nhanh (Debug)
Trước khi upload lên hệ thống, bạn có thể kiểm tra file tại:
*   [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com/)
*   Kéo file GLB vào đó. Nếu hiển thị đúng ở đây -> File Blender chuẩn. Nếu sai -> Cần chỉnh lại Node trong Blender.

## 5. Lưu ý cho Three.js (Coder)
*   Để kính (Transmission) hiển thị đẹp, WebGLRenderer cần bật `transmission: true` (thường mặc định trong pmndrs/drei).
*   Để Emission phát sáng (glow), cần dùng **Post-processing Bloom**.
*   Môi trường (Environment Map) rất quan trọng: Vật liệu kim loại và kính sẽ đen thui nếu không có Environment map để phản chiếu.

## 6. Hướng dẫn Xuất Animation (Chuyển động)

Để xuất model có animation (Rigging, Skeletal Animation), bạn cần lưu ý:

### A. Chuẩn bị (Blender NLA Editor)
GLB Export chỉ hiểu các animation được đẩy vào **NLA (Non-Linear Animation) Strips** hoặc là **Active Action**.
1.  Mở tab **Animation** trong Blender.
2.  Chuyển cửa sổ editor sang **Non-Linear Animation**.
3.  Với mỗi hành động (ví dụ: "Idle", "Run"), hãy ấn nút **Push Down** (nút mũi tên đi xuống bên cạnh tên Action) để biến nó thành một NLA Strip.
4.  Đặt tên cho Strip rõ ràng (không dấu, tiếng Anh là tốt nhất), vì tên này sẽ hiển thị trên Web.

### B. Cấu hình Xuất (Animation Tab)
Trong cửa sổ Export glTF 2.0, mở tab **Animation**:
*   **Animation:** Tích chọn (bắt buộc).
*   **Shape Keys:** Tích chọn (nếu dùng Morph Targets/Blend Shapes cho biểu cảm mặt).
*   **Skinning:** Tích chọn (cốt lõi cho xương khớp).
*   **Group by NLA Track:** Tích chọn (để gom các Strip thành các clip riêng biệt).

### C. Lưu ý quan trọng
*   **Apply Scale:** Bắt buộc phải Apply Scale cho cả Mesh và Armature (khung xương) trước khi làm animation, nếu không chuyển động sẽ bị méo khi lên web.
*   **Bake Animation:** Nếu dùng IK (Inverse Kinematics) hoặc Bone Constraint phức tạp, hãy chọn **"Sample Animations"** (hoặc Bake Action) khi export để Blender nướng chuyển động thành Keyframe đơn giản mà Three.js hiểu được.

