/**
 * Fylink - WebRTC & PeerJS Manager
 * Handles peer initialization, custom STUN, and two-way peer connection.
 */

import { generateSessionCode } from './utils.js';

export const CODE_PREFIX = 'fyl-';

export const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export class WebRTCManager {
  constructor(options = {}) {
    this.options = options;
    this.deviceName = options.deviceName || 'Anonymous Device';
    this.myCode = options.myCode || generateSessionCode(6);
    this.myPeerId = `${CODE_PREFIX}${this.myCode.toLowerCase()}`;

    this.onPeerReady = options.onPeerReady || (() => {});
    this.onStatus = options.onStatus || (() => {});
    this.onError = options.onError || (() => {});
    this.onConnectionEstablished = options.onConnectionEstablished || (() => {});

    this.peer = null;
    this.connection = null;
    this.remoteDeviceName = null;
    this.remotePeerCode = null;
    this.isDestroyed = false;

    this.init();
  }

  getIceServers() {
    const saved = localStorage.getItem('fylink_ice_servers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed parsing custom ICE servers, using default:', e);
      }
    }
    return DEFAULT_ICE_SERVERS;
  }

  init() {
    if (typeof window.Peer === 'undefined') {
      const err = 'Thư viện PeerJS chưa được tải. Vui lòng kiểm tra kết nối mạng.';
      this.onError(err);
      return;
    }

    const peerConfig = {
      debug: 1,
      config: {
        iceServers: this.getIceServers(),
        iceCandidatePoolSize: 10
      }
    };

    // Custom signaling server check
    const customHost = localStorage.getItem('fylink_signaling_host');
    const customPort = localStorage.getItem('fylink_signaling_port');
    const customPath = localStorage.getItem('fylink_signaling_path');
    const customSecure = localStorage.getItem('fylink_signaling_secure');

    if (customHost) {
      peerConfig.host = customHost;
      if (customPort) peerConfig.port = parseInt(customPort, 10);
      if (customPath) peerConfig.path = customPath;
      peerConfig.secure = customSecure === 'true';
    }

    try {
      this.peer = new window.Peer(this.myPeerId, peerConfig);
    } catch (e) {
      this.onError('Không thể khởi tạo WebRTC Peer: ' + e.message);
      return;
    }

    this.peer.on('open', (id) => {
      console.log('[WebRTC] Peer sẵn sàng với ID:', id);
      this.onPeerReady(this.myCode, id);
    });

    // Lắng nghe kết nối đến từ peer khác
    this.peer.on('connection', (conn) => {
      console.log('[WebRTC] Nhận kết nối từ:', conn.peer);
      this.setupConnection(conn);
    });

    this.peer.on('error', (err) => {
      console.error('[WebRTC] Lỗi Peer:', err);
      let friendlyMessage = 'Lỗi kết nối WebRTC: ' + err.type;

      if (err.type === 'peer-unavailable') {
        friendlyMessage = `Không tìm thấy thiết bị có mã "${this.remotePeerCode || ''}". Hãy kiểm tra lại mã và đảm bảo thiết bị kia đang mở Fylink.`;
      } else if (err.type === 'network' || err.type === 'server-error') {
        friendlyMessage = 'Không thể kết nối tới máy chủ signaling. Vui lòng kiểm tra mạng hoặc tường lửa.';
      } else if (err.type === 'unavailable-id') {
        // Trùng mã hiếm gặp -> sinh mã mới
        this.myCode = generateSessionCode(6);
        this.myPeerId = `${CODE_PREFIX}${this.myCode.toLowerCase()}`;
        this.init();
        return;
      }

      this.onError(friendlyMessage);
    });

    this.peer.on('disconnected', () => {
      console.warn('[WebRTC] Mất kết nối signaling tạm thời.');
      if (!this.isDestroyed && this.peer && !this.peer.destroyed) {
        try {
          this.peer.reconnect();
        } catch {}
      }
    });

    this.peer.on('close', () => {
      console.log('[WebRTC] Peer đã đóng.');
    });
  }

  /**
   * Chủ động kết nối tới thiết bị khác qua mã 6 ký tự
   */
  connectTo(targetCode) {
    if (!this.peer || this.peer.destroyed) {
      this.onError('Peer chưa sẵn sàng kết nối.');
      return;
    }

    const cleanCode = targetCode.trim().toLowerCase().replace(/^fyl-/, '');
    this.remotePeerCode = cleanCode.toUpperCase();
    const targetPeerId = `${CODE_PREFIX}${cleanCode}`;

    this.onStatus('connecting', {
      message: `Đang kết nối tới thiết bị ${this.remotePeerCode}...`
    });

    // Quan trọng: KHÔNG truyền serialization: 'none' để tránh lỗi constructor trong PeerJS!
    const conn = this.peer.connect(targetPeerId, {
      reliable: true
    });

    this.setupConnection(conn);
  }

  setupConnection(conn) {
    this.connection = conn;

    this.onStatus('connecting', {
      message: 'Đang bắt tay kết nối P2P trực tiếp (ICE/STUN)...'
    });

    // Timeout 15 giây
    const connTimeout = setTimeout(() => {
      if (this.connection && (!this.connection.open || this.connection.readyState !== 'open')) {
        this.onError('Kết nối P2P quá thời gian. Có thể bị chặn bởi tường lửa, VPN hoặc cách ly mạng khách (Guest Wi-Fi).');
      }
    }, 15000);

    conn.on('open', () => {
      clearTimeout(connTimeout);
      console.log('[WebRTC] Kết nối DataChannel đã mở với:', conn.peer);

      // Trích xuất mã 6 ký tự của bên kia
      const remoteRawCode = conn.peer.replace(/^fyl-/, '').toUpperCase();
      this.remotePeerCode = remoteRawCode;

      // Gửi thông tin chào hỏi ban đầu (tên thiết bị)
      try {
        conn.send({
          type: 'session:init',
          deviceName: this.deviceName,
          code: this.myCode,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('Lỗi gửi session:init:', e);
      }

      this.onStatus('connected', {
        peerId: conn.peer,
        remoteCode: remoteRawCode,
        conn
      });

      this.onConnectionEstablished(conn);
    });

    conn.on('close', () => {
      clearTimeout(connTimeout);
      console.log('[WebRTC] Kết nối với peer đã đóng.');
      this.onStatus('disconnected', { message: 'Đã ngắt kết nối với thiết bị.' });
    });

    conn.on('error', (err) => {
      clearTimeout(connTimeout);
      console.error('[WebRTC] Lỗi kết nối:', err);
      this.onError('Kết nối P2P gặp lỗi: ' + (err.message || 'Mạng không ổn định'));
    });
  }

  disconnect() {
    if (this.connection) {
      try {
        this.connection.close();
      } catch {}
      this.connection = null;
    }
    this.onStatus('disconnected', { message: 'Đã ngắt kết nối.' });
  }

  destroy() {
    this.isDestroyed = true;
    this.disconnect();
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}
