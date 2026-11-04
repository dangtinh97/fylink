# Fylink — Share anything. Instantly.

> **Tagline:** Share anything. Instantly.  
> **Nguyên tắc:** Mở web → Thấy ngay mã thiết bị & QR → Bắt tay kết nối 2 chiều → Thoải mái chia sẻ.

Fylink là ứng dụng web chia sẻ nội dung nhanh giữa các thiết bị trực tiếp qua mạng ngang hàng (**WebRTC DataChannel**), ưu tiên các thiết bị cùng mạng Wi‑Fi/LAN.

Fylink được xây dựng bằng **HTML, CSS và JavaScript thuần (Zero build step, không cần Vite hay Node.js server)**, có thể triển khai trực tiếp lên **GitHub Pages (`github.io`)**.

---

## 🌟 Trải nghiệm kết nối 2 chiều tự nhiên (Bi-directional P2P)

Khác với các ứng dụng bắt người dùng phải chia vai trò cứng nhắc "máy này chỉ được gửi, máy kia chỉ được nhận", Fylink hoạt động hoàn toàn tự nhiên:

1. **Mở web là thấy ngay mã của mình**:
   - Ngay trên thanh Header và màn hình chính hiển thị rõ ràng: **Tên thiết bị** và **Mã kết nối 6 chữ số** (ví dụ: `582914`, kèm mã QR).
2. **Bắt tay kết nối cực nhanh**:
   - Nhập 6 chữ số của thiết bị kia (bàn phím số tự bật trên điện thoại, hoặc quét mã QR / mở link dạng `fylink/#582914`).
3. **Kênh song công 2 chiều (Full-Duplex)**:
   - Khi 2 máy đã bắt tay kết nối thành công, **bất kỳ bên nào cũng có thể gửi hoặc nhận**.
   - Bạn gửi cho bạn bè xong, bạn bè có thể gửi trả lại tệp khác ngay trong cùng phiên mà không cần tạo phòng lại từ đầu!

---

## 🚀 Đa dạng loại nội dung hỗ trợ

- 📁 **Files**: Gửi một hoặc nhiều file bất kỳ với kích thước tùy ý.
- 📝 **Text**: Gửi đoạn văn bản, ghi chú, mã nguồn hoặc clipboard; tính số ký tự và dung lượng tự động.
- 🖼️ **Images**: Gửi ảnh chất lượng cao; tự động tạo thumbnail preview trước khi gửi.
- 🔗 **Links**: Chia sẻ liên kết an toàn; người nhận xem trước tên miền (domain badge) trước khi mở.
- 🎬 **Videos**: Gửi video an toàn; trích xuất video thumbnail và thời lượng bằng HTML5 Canvas trực tiếp trên máy client.

---

## 🛠️ Công nghệ & Bảo mật

- **P2P tuyệt đối**: Không có bất kỳ dữ liệu tệp tin nào được tải lên cloud/server.
- **Duyệt trước khi nhận (Consent)**: Luôn hiển thị tên thiết bị gửi, số lượng và dung lượng; người nhận bấm **Chấp nhận** mới bắt đầu truyền dữ liệu.
- **Backpressure & 64KB Chunking**: Phân chia file thành các gói 64KB, kiểm soát hàng đợi bằng `bufferedAmount` và sự kiện `bufferedamountlow`, không gây tràn RAM khi truyền tệp lớn.
- **Xác thực toàn vẹn Checksum**: Kiểm tra mã băm SHA-256 (`crypto.subtle`) đảm bảo file tải về nguyên vẹn 100%.
- **Google STUN**: Sử dụng các STUN server chính thức (`stun.l.google.com:19302`) để phân giải NAT traversal.

---

## 🌐 Triển khai lên GitHub Pages (Deploy to github.io)

Ứng dụng tương thích 100% với **GitHub Pages**:

1. Tạo repository trên GitHub (ví dụ: `Fylink`).
2. Đẩy toàn bộ mã nguồn lên nhánh `main`:
   ```bash
   git init
   git add .
   git commit -m "feat: release Fylink two-way P2P"
   git branch -M main
   git remote add origin https://github.com/<your-username>/Fylink.git
   git push -u origin main
   ```
3. Vào **Settings** → **Pages** trên GitHub repository:
   - **Source**: Chọn `Deploy from a branch`.
   - **Branch**: Chọn `main` / folder `/(root)` → bấm **Save**.
4. Trang web sẽ trực tiếp hoạt động tại: `https://<your-username>.github.io/Fylink/`

---

## 📂 Cấu trúc thư mục

```
Fylink/
├── index.html          # Giao diện chính Single-page Application
├── css/
│   └── style.css       # Toàn bộ CSS phong cách Minimalist, Responsive & Dark theme
├── js/
│   ├── app.js          # Bộ điều khiển trung tâm (UI, Composer, Clipboard, State)
│   ├── protocol.js     # Giao thức truyền tin 2 chiều, backpressure 64KB, Checksum SHA-256
│   ├── webrtc.js       # Quản lý kết nối WebRTC & Signaling PeerJS
│   └── utils.js        # Hàm tiện ích (formatBytes, thumbnail generator, device naming)
├── .gitignore          # Cấu hình bỏ qua file rác
├── AGENT.md            # Tài liệu yêu cầu kỹ thuật chi tiết
└── README.md           # Hướng dẫn sử dụng và triển khai
```
