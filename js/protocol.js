/**
 * Fylink - Bidirectional Transfer Protocol
 * Handles chunking, backpressure, checksum verification, and two-way send/receive.
 */

import { calculateSha256 } from './utils.js';

export const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
export const MAX_BUFFERED_AMOUNT = 1024 * 1024; // 1 MB buffer limit before applying backpressure
export const PACKET_MAGIC = 0x46594C4B; // "FYLK" in hex
export const PROTOCOL_TYPES = {
  SESSION_INIT: 'session:init',
  CONTENT_OFFER: 'content:offer',
  CONTENT_ACCEPT: 'content:accept',
  CONTENT_REJECT: 'content:reject',
  FILE_META: 'file:meta',
  FILE_COMPLETE: 'file:complete',
  TEXT_DATA: 'text:data',
  LINK_DATA: 'link:data',
  TRANSFER_CANCEL: 'transfer:cancel',
  TRANSFER_ERROR: 'transfer:error',
  TRANSFER_ACK: 'transfer:ack'
};

/**
 * Creates binary packet with header:
 * [0..3] Magic: "FYLK" (Uint32)
 * [4..7] File Index: (Uint32)
 * [8..11] Chunk Index: (Uint32)
 * [12..15] Payload Length: (Uint32)
 * [16..] Raw chunk data
 */
export function createBinaryChunkPacket(fileIndex, chunkIndex, chunkArrayBuffer) {
  const headerSize = 16;
  const payloadSize = chunkArrayBuffer.byteLength;
  const packetBuffer = new ArrayBuffer(headerSize + payloadSize);
  const dataView = new DataView(packetBuffer);

  dataView.setUint32(0, PACKET_MAGIC, false);
  dataView.setUint32(4, fileIndex, false);
  dataView.setUint32(8, chunkIndex, false);
  dataView.setUint32(12, payloadSize, false);

  const uint8View = new Uint8Array(packetBuffer, headerSize);
  uint8View.set(new Uint8Array(chunkArrayBuffer));

  return packetBuffer;
}

/**
 * Parses binary chunk packet from ArrayBuffer, Uint8Array or any TypedArray
 */
export function parseBinaryChunkPacket(bufferOrView) {
  let arrayBuffer;
  if (bufferOrView instanceof ArrayBuffer) {
    arrayBuffer = bufferOrView;
  } else if (ArrayBuffer.isView(bufferOrView)) {
    // Trích xuất buffer chính xác từ Uint8Array hoặc DataView
    arrayBuffer = bufferOrView.buffer.slice(
      bufferOrView.byteOffset,
      bufferOrView.byteOffset + bufferOrView.byteLength
    );
  } else {
    return null;
  }

  if (arrayBuffer.byteLength < 16) return null;
  const dataView = new DataView(arrayBuffer);
  const magic = dataView.getUint32(0, false);
  if (magic !== PACKET_MAGIC) {
    console.warn('[Protocol] Magic header không khớp:', magic.toString(16));
    return null;
  }

  const fileIndex = dataView.getUint32(4, false);
  const chunkIndex = dataView.getUint32(8, false);
  const payloadLength = dataView.getUint32(12, false);

  const chunkData = arrayBuffer.slice(16, 16 + payloadLength);
  return { fileIndex, chunkIndex, payloadLength, chunkData };
}

export class TransferCoordinator {
  constructor(peerConnection, options = {}) {
    this.conn = peerConnection;
    this.options = options;
    this.myDeviceName = options.myDeviceName || 'My Device';

    this.onPeerInfo = options.onPeerInfo || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onOfferReceived = options.onOfferReceived || (() => {});
    this.onTransferComplete = options.onTransferComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.onCancelled = options.onCancelled || (() => {});

    // Transfer status tracking
    this.isSending = false;
    this.isReceiving = false;
    this.isCancelled = false;

    // Sender metrics
    this.outContentData = null;
    this.outLocalFiles = [];
    this.outTotalBytes = 0;
    this.outTransferredBytes = 0;
    this.outStartTime = 0;
    this.outLastSpeedUpdate = 0;
    this.outBytesSinceLastSpeed = 0;
    this.outCurrentSpeed = 0;

    // Receiver metrics
    this.inOffer = null;
    this.inTotalBytes = 0;
    this.inTransferredBytes = 0;
    this.inFiles = [];
    this.inFileStates = new Map();
    this.inCurrentFile = null;
    this.inLastSpeedUpdate = 0;
    this.inBytesSinceLastSpeed = 0;
    this.inCurrentSpeed = 0;
    this._receiveQueue = Promise.resolve();

    this.setupListeners();
  }

  setupListeners() {
    if (!this.conn) return;

    this.conn.on('data', (data) => {
      // Xử lý tuần tự theo hàng đợi để tránh race condition khi nhận nhiều ảnh/file liên tiếp
      this._receiveQueue = this._receiveQueue
        .then(() => this.processIncomingData(data))
        .catch((err) => {
          console.error('[Protocol] Lỗi xử lý dữ liệu đến:', err);
        });
    });

    this.conn.on('close', () => {
      if (this.isSending || this.isReceiving) {
        this.onError('Kết nối bị đóng trong quá trình truyền dữ liệu.');
      }
    });

    this.conn.on('error', (err) => {
      this.onError('Lỗi kết nối WebRTC: ' + (err.message || 'Lỗi mạng'));
    });
  }

  async processIncomingData(data) {
    // 1. Dữ liệu nhị phân: Blob
    if (data instanceof Blob) {
      try {
        const ab = await data.arrayBuffer();
        this.handleBinaryChunk(ab);
      } catch (e) {
        console.error('[Protocol] Lỗi đọc Blob chunk:', e);
      }
      return;
    }

    // 2. Dữ liệu nhị phân: ArrayBuffer hoặc Uint8Array/TypedArray
    if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      this.handleBinaryChunk(data);
      return;
    }

    // 3. Tin nhắn dạng chuỗi JSON
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        await this.handleMessage(parsed);
      } catch {
        // chuỗi thuần
      }
      return;
    }

    // 4. Tin nhắn dạng Object điều khiển (phải có thuộc tính .type)
    if (data && typeof data === 'object' && typeof data.type === 'string') {
      await this.handleMessage(data);
      return;
    }

    console.warn('[Protocol] Bỏ qua gói tin không nhận diện được:', typeof data, data);
  }

  sendMessage(type, payload = {}) {
    if (!this.conn || !this.conn.open) {
      console.warn('[Protocol] Kết nối chưa mở, không thể gửi:', type);
      return;
    }
    const msg = JSON.stringify({ type, timestamp: Date.now(), ...payload });
    this.conn.send(msg);
  }

  async handleMessage(msg) {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case PROTOCOL_TYPES.SESSION_INIT:
        this.onPeerInfo({
          deviceName: msg.deviceName,
          code: msg.code
        });
        break;

      case PROTOCOL_TYPES.CONTENT_OFFER:
        this.inOffer = msg;
        this.inTotalBytes = msg.totalSize || 0;
        this.inTransferredBytes = 0;
        this.onOfferReceived(msg);
        break;

      case PROTOCOL_TYPES.CONTENT_ACCEPT:
        if (this.isSending) {
          this.onStatusChange('sending');
          await this.executeSendProcess();
        }
        break;

      case PROTOCOL_TYPES.CONTENT_REJECT:
        if (this.isSending) {
          this.isSending = false;
          this.onStatusChange('rejected');
          this.onError('Thiết bị nhận đã từ chối chia sẻ.');
        }
        break;

      case PROTOCOL_TYPES.TEXT_DATA:
        this.onTransferComplete({
          type: 'text',
          text: msg.text,
          deviceName: msg.deviceName
        });
        this.sendMessage(PROTOCOL_TYPES.TRANSFER_ACK, { success: true });
        break;

      case PROTOCOL_TYPES.LINK_DATA:
        this.onTransferComplete({
          type: 'link',
          url: msg.url,
          title: msg.title,
          domain: msg.domain,
          deviceName: msg.deviceName
        });
        this.sendMessage(PROTOCOL_TYPES.TRANSFER_ACK, { success: true });
        break;

      case PROTOCOL_TYPES.FILE_META: {
        const idx = msg.fileIndex ?? 0;
        console.log('[Protocol] Bắt đầu nhận file:', msg.name, 'Index:', idx, 'Kích thước dự kiến:', msg.size, 'Chunks:', msg.totalChunks);
        this.inCurrentFile = msg;
        this.inFileStates.set(idx, {
          meta: msg,
          chunks: [],
          receivedBytes: 0
        });
        this.onStatusChange('receiving', { file: msg });
        break;
      }

      case PROTOCOL_TYPES.FILE_COMPLETE:
        await this.finalizeReceivedFile(msg);
        break;

      case PROTOCOL_TYPES.TRANSFER_CANCEL:
        this.isCancelled = true;
        this.isSending = false;
        this.isReceiving = false;
        this.onCancelled('Quá trình truyền bị hủy bởi thiết bị kia.');
        break;

      case PROTOCOL_TYPES.TRANSFER_ERROR:
        this.isSending = false;
        this.isReceiving = false;
        this.onError(msg.reason || 'Lỗi truyền dữ liệu từ phía đối phương.');
        break;

      case PROTOCOL_TYPES.TRANSFER_ACK:
        if (this.isSending && msg.success) {
          this.isSending = false;
          this.onStatusChange('completed');
          this.onTransferComplete({ success: true, isSender: true });
        }
        break;
    }
  }

  handleBinaryChunk(bufferOrView) {
    const packet = parseBinaryChunkPacket(bufferOrView);
    if (!packet) {
      console.error('[Protocol] Gói nhị phân không hợp lệ hoặc sai định dạng');
      return;
    }

    const fileState = this.inFileStates.get(packet.fileIndex);
    if (!fileState) {
      console.warn('[Protocol] Nhận chunk cho fileIndex chưa có metadata:', packet.fileIndex);
      return;
    }

    fileState.chunks[packet.chunkIndex] = packet.chunkData;
    fileState.receivedBytes += packet.payloadLength;
    this.inTransferredBytes += packet.payloadLength;
    this.inBytesSinceLastSpeed += packet.payloadLength;

    const now = Date.now();
    const delta = (now - this.inLastSpeedUpdate) / 1000;
    if (delta >= 0.5) {
      this.inCurrentSpeed = Math.round(this.inBytesSinceLastSpeed / delta);
      this.inLastSpeedUpdate = now;
      this.inBytesSinceLastSpeed = 0;
    }

    const currentFileMeta = fileState.meta;
    const currentFileProgress = currentFileMeta && currentFileMeta.size > 0
      ? (fileState.receivedBytes / currentFileMeta.size) * 100
      : 100;

    const totalProgress = this.inTotalBytes > 0
      ? Math.min(100, (this.inTransferredBytes / this.inTotalBytes) * 100)
      : 100;

    const eta = this.inCurrentSpeed > 0 ? Math.round((this.inTotalBytes - this.inTransferredBytes) / this.inCurrentSpeed) : 0;

    this.onProgress({
      mode: 'receiving',
      fileIndex: packet.fileIndex,
      totalFiles: this.inOffer?.itemCount || 1,
      fileName: currentFileMeta?.name || 'file',
      currentFileProgress,
      totalProgress,
      transferredBytes: this.inTransferredBytes,
      totalBytes: this.inTotalBytes,
      speed: this.inCurrentSpeed,
      eta
    });
  }

  async finalizeReceivedFile(msg) {
    const idx = msg.fileIndex ?? 0;
    const fileState = this.inFileStates.get(idx);
    if (!fileState) return;

    const fileMeta = fileState.meta;
    const orderedChunks = fileState.chunks.filter(Boolean);
    const blob = new Blob(orderedChunks, {
      type: fileMeta.mimeType || 'application/octet-stream'
    });

    console.log(`[Protocol] Nhận xong file "${fileMeta.name}" (#${idx}): ${orderedChunks.length} chunks, tổng ${blob.size} bytes`);

    let checksumValid = true;
    if (fileMeta.checksum && blob.size > 0) {
      try {
        const buffer = await blob.arrayBuffer();
        const calculatedHash = await calculateSha256(buffer);
        if (calculatedHash && calculatedHash !== fileMeta.checksum) {
          console.warn('[Protocol] Mã băm SHA-256 không khớp cho file:', fileMeta.name);
          checksumValid = false;
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra checksum:', err);
      }
    }

    this.inFiles.push({
      name: fileMeta.name,
      size: blob.size > 0 ? blob.size : (fileMeta.size || 0),
      mimeType: fileMeta.mimeType || 'application/octet-stream',
      blob,
      url: URL.createObjectURL(blob),
      checksumValid
    });

    this.inFileStates.delete(idx);

    if (msg.isLastFile) {
      this.isReceiving = false;
      this.sendMessage(PROTOCOL_TYPES.TRANSFER_ACK, { success: true });
      this.onStatusChange('completed');
      this.onTransferComplete({
        type: this.inOffer?.contentType || 'files',
        files: this.inFiles,
        deviceName: this.inOffer?.deviceName
      });
    }
  }

  /**
   * Bắt đầu gửi nội dung tới đối phương
   */
  sendOffer(contentData, localFiles = []) {
    this.outContentData = contentData;
    this.outLocalFiles = localFiles && localFiles.length > 0 ? localFiles : (contentData.files || []);
    this.outTotalBytes = contentData.totalSize || 0;
    this.outTransferredBytes = 0;
    this.isSending = true;
    this.isCancelled = false;
    this.onStatusChange('offered');

    // Không chuyển object DOM File qua mạng để tránh lỗi serialization
    const networkOffer = { ...contentData };
    delete networkOffer.files;
    this.sendMessage(PROTOCOL_TYPES.CONTENT_OFFER, networkOffer);
  }

  acceptOffer() {
    this.isReceiving = true;
    this.inFiles = [];
    this.inFileStates.clear();
    this.inLastSpeedUpdate = Date.now();
    this.inBytesSinceLastSpeed = 0;
    this.sendMessage(PROTOCOL_TYPES.CONTENT_ACCEPT);
    this.onStatusChange('receiving');
  }

  rejectOffer() {
    this.isReceiving = false;
    this.sendMessage(PROTOCOL_TYPES.CONTENT_REJECT);
    this.onStatusChange('idle');
  }

  cancelTransfer() {
    this.isCancelled = true;
    this.isSending = false;
    this.isReceiving = false;
    this.sendMessage(PROTOCOL_TYPES.TRANSFER_CANCEL);
    this.onCancelled('Bạn đã hủy chuyển dữ liệu.');
  }

  async executeSendProcess() {
    if (!this.outContentData) return;
    this.outStartTime = Date.now();
    this.outLastSpeedUpdate = Date.now();
    this.outBytesSinceLastSpeed = 0;

    const { contentType } = this.outContentData;

    if (contentType === 'text') {
      this.sendMessage(PROTOCOL_TYPES.TEXT_DATA, {
        text: this.outContentData.text,
        deviceName: this.myDeviceName
      });
      return;
    }

    if (contentType === 'link') {
      this.sendMessage(PROTOCOL_TYPES.LINK_DATA, {
        url: this.outContentData.url,
        title: this.outContentData.title,
        domain: this.outContentData.domain,
        deviceName: this.myDeviceName
      });
      return;
    }

    // Gửi binary file/ảnh/video từ danh sách local
    const files = this.outLocalFiles || [];
    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      if (this.isCancelled) break;
      const fileItem = files[fIdx];
      await this.sendFileItem(fileItem, fIdx, fIdx === files.length - 1);
    }
  }

  async sendFileItem(fileItem, fileIndex, isLastFile) {
    const file = fileItem.file || fileItem;
    if (!file) {
      console.error('[Protocol] Tệp tin không tồn tại để gửi:', fileItem);
      return;
    }

    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE) || 1;

    console.log(`[Protocol] Bắt đầu gửi file "${fileItem.name || file.name}": dung lượng ${fileSize} bytes, ${totalChunks} chunks`);

    let checksum = null;
    if (fileSize <= 100 * 1024 * 1024 && fileSize > 0) {
      try {
        const buffer = await file.arrayBuffer();
        checksum = await calculateSha256(buffer);
      } catch (e) {
        console.warn('Lỗi tính SHA-256:', e);
      }
    }

    this.sendMessage(PROTOCOL_TYPES.FILE_META, {
      fileIndex,
      name: fileItem.name || file.name,
      size: fileSize,
      mimeType: fileItem.type || file.type,
      totalChunks,
      checksum,
      isLastFile
    });

    let offset = 0;
    let chunkIndex = 0;

    while (offset < fileSize && !this.isCancelled) {
      await this.waitForBufferDrain();

      const sliceEnd = Math.min(offset + CHUNK_SIZE, fileSize);
      const sliceBlob = file.slice(offset, sliceEnd);
      const chunkBuffer = await sliceBlob.arrayBuffer();

      const packet = createBinaryChunkPacket(fileIndex, chunkIndex, chunkBuffer);
      
      try {
        this.conn.send(packet);
      } catch (e) {
        console.error('[Protocol] Lỗi gửi chunk qua DataChannel:', e);
      }

      const chunkLen = chunkBuffer.byteLength;
      offset += chunkLen;
      chunkIndex++;
      this.outTransferredBytes += chunkLen;
      this.outBytesSinceLastSpeed += chunkLen;

      const now = Date.now();
      const delta = (now - this.outLastSpeedUpdate) / 1000;
      if (delta >= 0.5) {
        this.outCurrentSpeed = Math.round(this.outBytesSinceLastSpeed / delta);
        this.outLastSpeedUpdate = now;
        this.outBytesSinceLastSpeed = 0;
      }

      const currentFileProgress = fileSize > 0 ? (offset / fileSize) * 100 : 100;
      const totalProgress = this.outTotalBytes > 0
        ? Math.min(100, (this.outTransferredBytes / this.outTotalBytes) * 100)
        : 100;

      const eta = this.outCurrentSpeed > 0 ? Math.round((this.outTotalBytes - this.outTransferredBytes) / this.outCurrentSpeed) : 0;

      this.onProgress({
        mode: 'sending',
        fileIndex,
        totalFiles: this.outLocalFiles.length || 1,
        fileName: fileItem.name || file.name,
        currentFileProgress,
        totalProgress,
        transferredBytes: this.outTransferredBytes,
        totalBytes: this.outTotalBytes,
        speed: this.outCurrentSpeed,
        eta
      });
    }

    if (!this.isCancelled) {
      this.sendMessage(PROTOCOL_TYPES.FILE_COMPLETE, {
        fileIndex,
        isLastFile
      });
    }
  }

  waitForBufferDrain() {
    return new Promise((resolve) => {
      const dc = this.conn?.dataChannel;
      if (!dc || dc.bufferedAmount <= MAX_BUFFERED_AMOUNT) {
        return resolve();
      }

      dc.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT / 2;
      const onLow = () => {
        dc.removeEventListener('bufferedamountlow', onLow);
        resolve();
      };
      dc.addEventListener('bufferedamountlow', onLow);

      setTimeout(() => {
        dc.removeEventListener('bufferedamountlow', onLow);
        resolve();
      }, 500);
    });
  }
}
