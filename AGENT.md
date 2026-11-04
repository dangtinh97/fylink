# Fylink --- Agent Guide

## 1. Sản phẩm

Fylink là web app chia sẻ nội dung nhanh giữa các thiết bị, ưu tiên
thiết bị cùng Wi‑Fi/LAN. Không chỉ gửi file, Fylink còn hỗ trợ chia sẻ
văn bản, ảnh, link và video.

**Tagline:** Share anything. Instantly.\
**Nguyên tắc:** Mở web → chọn nội dung → kết nối thiết bị → chia sẻ.

## 2. Loại nội dung hỗ trợ

Thiết kế giao diện và protocol để hỗ trợ các loại nội dung sau:

1.  **Files** --- gửi một hoặc nhiều file bất kỳ.
2.  **Text** --- gửi đoạn văn bản, ghi chú, mã hoặc nội dung clipboard.
3.  **Images** --- gửi ảnh; hiển thị preview thumbnail trước khi gửi.
4.  **Links** --- chia sẻ URL; người nhận có thể mở link trong tab mới.
5.  **Videos** --- gửi video như file, có thumbnail, tên, dung lượng và
    tiến trình truyền.

Không nhúng hoặc tự động phát video từ nội dung không đáng tin cậy. Link
được hiển thị rõ domain trước khi người nhận mở. Nội dung nhận phải do
người nhận chấp nhận.

## 3. Trải nghiệm dễ dùng

-   Không yêu cầu đăng ký tài khoản.
-   Tối ưu mobile, tablet và desktop.
-   Hai hành động chính luôn rõ: **Send** và **Receive**.
-   Cho phép kéo-thả file, chọn nhiều file và paste text/URL.
-   Tự nhận diện nội dung clipboard:
    -   Text → tab Text.
    -   URL → tab Link.
    -   Ảnh clipboard → tab Image nếu browser cấp quyền.
-   Hỗ trợ QR, link phiên và mã ngắn.
-   Tên thiết bị tự sinh; người dùng có thể đổi.
-   Hiển thị trạng thái kết nối, dung lượng, tiến độ, tốc độ và lỗi dễ
    hiểu.
-   Không bắt người dùng nhập email, mật khẩu hoặc thông tin cá nhân.

## 4. Luồng chia sẻ

### Gửi

1.  Mở Fylink và chọn loại nội dung: Files, Text, Image, Link hoặc
    Video.
2.  Chọn file / nhập nội dung / paste từ clipboard.
3.  Fylink tạo phiên chia sẻ và QR + link + mã ngắn.
4.  Người nhận mở link, quét QR hoặc nhập mã.
5.  Người nhận xem tên thiết bị và preview nội dung rồi **Accept**.
6.  Fylink truyền dữ liệu và hiển thị tiến độ.
7.  Hoàn tất: người nhận lưu file, copy text hoặc mở link.

### Nhận

-   Chọn **Receive** hoặc mở link / quét QR / nhập mã.
-   Xem thiết bị gửi, loại nội dung và tổng dung lượng.
-   Chấp nhận hoặc từ chối.
-   Với text: nút Copy.
-   Với link: domain preview và nút Open link.
-   Với image/video: preview an toàn, nút Save/Download.
-   Với file: danh sách file và nút Save/Download.

## 5. Kết nối nhanh

Ưu tiên: 1. **QR code** --- dễ kết nối khi thiết bị ở gần. 2. **Share
link** --- mở trực tiếp trên thiết bị nhận. 3. **Mã phiên ngắn** ---
nhập thủ công. 4. **LAN discovery** --- tùy chọn nếu có cơ chế discovery
đáng tin cậy; không giả định browser có thể tự quét toàn bộ mạng LAN.

Không yêu cầu account. Mã phiên phải ngẫu nhiên, có thời hạn và không
được dùng làm định danh vĩnh viễn.

## 6. WebRTC / mạng

-   Dùng WebRTC DataChannel để truyền file, text, image, video và
    metadata peer-to-peer.
-   Signaling server tối thiểu dùng để trao đổi SDP/ICE và ghép peer;
    signaling không chuyển nội dung.
-   Google STUN:
    -   `stun:stun.l.google.com:19302`
    -   Có thể thêm `stun:stun1.l.google.com:19302`.
-   STUN không phải signaling server và không đảm bảo kết nối thành
    công.
-   Khi cùng Wi‑Fi, ưu tiên direct LAN route nếu ICE chọn được.
-   Guest Wi‑Fi, client isolation, firewall, VPN hoặc NAT có thể chặn
    P2P.
-   MVP báo lỗi rõ ràng khi direct connection thất bại. TURN relay có
    thể bổ sung sau; relay có thể phát sinh chi phí và làm dữ liệu đi
    qua server trung gian.
-   Không tuyên bố chỉ hoạt động cùng Wi‑Fi nếu ứng dụng cho phép kết
    nối Internet.

## 7. Privacy & security

-   P2P mặc định không upload nội dung lên cloud/backend.
-   Receiver consent bắt buộc trước khi gửi.
-   Signaling dùng HTTPS/WSS trong production.
-   WebRTC mã hóa kết nối theo cơ chế WebRTC.
-   Không log nội dung, tên file nhạy cảm, URL riêng tư hoặc mã phiên.
-   Validate metadata, kích thước, loại file và số lượng file từ peer.
-   Không tự động thực thi hoặc mở file nhận.
-   Với link, hiển thị domain và yêu cầu người dùng chủ động mở.
-   Với image/video, preview không được tự động tải nội dung từ URL bên
    ngoài.
-   Session hết hạn và dọn state sau khi kết thúc.
-   Có giới hạn dung lượng/số file cấu hình được.
-   Không yêu cầu quyền trình duyệt trước khi người dùng thực hiện thao
    tác cần quyền.

## 8. UI/UX

### Phong cách

-   Modern, minimalist, polished.
-   Responsive; mobile-first.
-   Light mode mặc định, hỗ trợ dark mode.
-   Typography rõ, khoảng trắng thoáng, bo góc tinh tế.
-   Animation nhẹ cho connect/transfer; không làm chậm thao tác.
-   Accessible: keyboard navigation, focus states, contrast tốt, label
    rõ.

### Trang chủ

-   Logo **Fylink**.
-   Heading: **Share anything, instantly.**
-   Subtitle: "Send files, text, photos, links and videos directly
    between devices."
-   CTA: **Send** và **Receive**.
-   Composer dạng tab: Files \| Text \| Image \| Link \| Video.
-   Drag/drop zone cho file.
-   Paste zone cho text, link hoặc ảnh.
-   Hiển thị "Same Wi‑Fi recommended" như gợi ý, không khẳng định đang
    cùng mạng nếu chưa xác định.

### Preview trước khi gửi

-   Files: icon, tên, loại, dung lượng, remove.
-   Text: preview, ký tự/dung lượng, Copy/Edit.
-   Image: thumbnail, tên, kích thước, remove.
-   Link: domain, title nếu có thể lấy an toàn; không tự fetch link từ
    backend nếu chưa có thiết kế bảo mật.
-   Video: thumbnail nếu browser có thể tạo từ file local, tên, thời
    lượng nếu đọc được, dung lượng.
-   Nút **Connect device / Create share**.

### Phiên truyền

-   Device sender/receiver.
-   Loại nội dung và danh sách item.
-   Trạng thái: Waiting, Connecting, Connected, Awaiting approval,
    Sending, Completed, Failed.
-   Progress tổng và theo file.
-   Speed, transferred / total, ETA nếu tính được.
-   Cancel, Retry, Done.
-   Lỗi có hướng dẫn: kiểm tra cùng Wi‑Fi, VPN, firewall hoặc tạo phiên
    mới.
-   Tránh đưa thông tin kỹ thuật ICE vào UI chính; diagnostics có thể
    nằm trong phần mở rộng.

## 9. Protocol và truyền dữ liệu

-   Tách module UI, session/signaling, WebRTC transport, content
    handling và transfer protocol.
-   Message types gợi ý:
    -   `session:init`
    -   `session:join`
    -   `content:offer`
    -   `content:accept`
    -   `file:meta`
    -   `file:chunk`
    -   `file:complete`
    -   `text:data`
    -   `link:data`
    -   `transfer:cancel`
    -   `transfer:error`
    -   `transfer:ack`
-   Metadata gồm content type, ID, name, MIME, size và checksum khi phù
    hợp.
-   File/video lớn phải truyền theo chunk; không đọc toàn bộ vào RAM.
-   Dùng backpressure qua `RTCDataChannel.bufferedAmount` và
    `bufferedAmountLowThreshold`.
-   Đảm bảo chunk order, xác thực checksum, xử lý duplicate filename và
    disconnect.
-   Với text/link nhỏ, có thể gửi message trực tiếp qua DataChannel.
-   Với image/video, truyền binary theo chunk như file; preview chỉ là
    UI.
-   Kiểm tra giới hạn browser và kích thước payload; không hardcode
    chunk size mà không test.
-   Xử lý cancel, timeout, tab close, peer disconnect và retry.
-   Không giả báo thành công trước khi receiver xác nhận hoàn tất.

## 10. MVP

### Bắt buộc

-   Files, Text, Image, Link, Video.
-   Send / Receive.
-   QR, link, mã phiên.
-   Receiver consent.
-   WebRTC DataChannel + signaling.
-   Google STUN.
-   Preview trước khi gửi.
-   Progress, cancel, completion/error.
-   Responsive UI, dark mode.
-   HTTPS production.
-   Không lưu content trên server.

### Sau MVP

-   Folder transfer.
-   Gửi nhiều thiết bị.
-   Resume transfer.
-   TURN fallback.
-   LAN discovery.
-   PWA install.
-   Lịch sử local tùy chọn.
-   Thiết bị yêu thích / nickname.
-   Tối ưu transfer lớn và chia sẻ clipboard hai chiều.

## 11. Definition of Done

-   Người dùng gửi file, text, image, link và video không cần tài khoản.
-   QR/link/mã phiên giúp ghép thiết bị nhanh.
-   Receiver có thể xem loại nội dung và chấp nhận/từ chối.
-   File truyền xong có kích thước/checksum đúng.
-   Text copy được; link hiển thị domain; image/video preview đúng.
-   UI có tiến độ và lỗi dễ hiểu.
-   Không upload nội dung lên signaling/backend trong P2P mode.
-   Hoạt động trên trình duyệt desktop/mobile hiện đại.
-   README hướng dẫn local run, signaling, HTTPS, STUN và deploy.

## 12. Coding agent instructions

1.  Kiểm tra repo và stack hiện tại trước khi thay đổi.
2.  Ưu tiên một luồng end-to-end hoàn chỉnh cho từng content type.
3.  Không thêm cloud storage hoặc account system nếu chưa được yêu cầu.
4.  Không giả lập peer discovery hoặc kết nối thành công.
5.  Không log nội dung, file name riêng tư, URL nhạy cảm hoặc session
    token.
6.  Cập nhật README và `.env.example`.
7.  Chạy lint, typecheck và test.
8.  Nếu signaling chưa có, tạo interface và triển khai signaling tối
    thiểu; STUN không thay thế signaling.
9.  Viết test cho transfer lifecycle, chunk order, checksum, cancel,
    disconnect và content-type validation.
10. Giữ UI rõ ràng, thao tác ít bước, ưu tiên tiện dụng hơn tính năng
    phức tạp.

## 13. Định vị

Fylink là công cụ chia sẻ nhanh mọi nội dung giữa các thiết bị: file,
text, ảnh, link và video.

**Mở web → chọn nội dung → kết nối → chia sẻ.**
