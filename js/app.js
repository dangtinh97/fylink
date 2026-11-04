/**
 * Fylink - Bidirectional Application Controller
 * Immediate peer initialization, instant code visibility, and two-way file sharing.
 */

import {
  generateDeviceName,
  generateSessionCode,
  formatBytes,
  formatSpeed,
  formatDuration,
  extractDomain,
  sanitizeFilename,
  generateImageThumbnail,
  generateVideoThumbnail,
  copyToClipboard
} from './utils.js';

import { WebRTCManager } from './webrtc.js';
import { TransferCoordinator } from './protocol.js';

// Application State
const state = {
  theme: localStorage.getItem('fylink_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  deviceName: localStorage.getItem('fylink_device_name') || generateDeviceName(),
  myCode: generateSessionCode(6),
  activeTab: 'files',
  stagedItems: [],
  webrtc: null,
  coordinator: null,
  remotePeerInfo: null
};

localStorage.setItem('fylink_device_name', state.deviceName);

// DOM Elements
const DOM = {
  html: document.documentElement,
  brandLink: document.getElementById('brand-link'),
  themeToggle: document.getElementById('theme-toggle'),
  themeIconSun: document.getElementById('theme-icon-sun'),
  themeIconMoon: document.getElementById('theme-icon-moon'),
  deviceChip: document.getElementById('device-chip'),
  deviceNameDisplay: document.getElementById('device-name-display'),
  headerCodeChip: document.getElementById('header-code-chip'),
  headerCodeDisplay: document.getElementById('header-code-display'),

  // Discovery Screen
  discoveryScreen: document.getElementById('discovery-screen'),
  myQrContainer: document.getElementById('my-qr-container'),
  myCodeText: document.getElementById('my-code-text'),
  btnCopyMyCode: document.getElementById('btn-copy-my-code'),
  targetCodeInput: document.getElementById('target-code-input'),
  btnConnectTarget: document.getElementById('btn-connect-target'),
  discoveryStatusBadge: document.getElementById('discovery-status-badge'),
  discoveryStatusText: document.getElementById('discovery-status-text'),
  discoveryErrorBox: document.getElementById('discovery-error-box'),
  discoveryErrorMessage: document.getElementById('discovery-error-message'),

  // Session Screen
  sessionScreen: document.getElementById('session-screen'),
  peerDeviceName: document.getElementById('peer-device-name'),
  peerDeviceCode: document.getElementById('peer-device-code'),
  btnDisconnect: document.getElementById('btn-disconnect'),

  // Consent Banner
  consentBanner: document.getElementById('consent-banner'),
  consentTitle: document.getElementById('consent-title'),
  consentDesc: document.getElementById('consent-desc'),
  btnConsentReject: document.getElementById('btn-consent-reject'),
  btnConsentAccept: document.getElementById('btn-consent-accept'),

  // Progress Card
  transferProgressCard: document.getElementById('transfer-progress-card'),
  transferStatusLabel: document.getElementById('transfer-status-label'),
  transferProgressPercent: document.getElementById('transfer-progress-percent'),
  transferProgressBar: document.getElementById('transfer-progress-bar'),
  transferMetricsSpeed: document.getElementById('transfer-metrics-speed'),
  transferMetricsBytes: document.getElementById('transfer-metrics-bytes'),
  transferMetricsEta: document.getElementById('transfer-metrics-eta'),

  // Received Content Card
  receivedContentCard: document.getElementById('received-content-card'),
  receivedTextBox: document.getElementById('received-text-box'),
  receivedTextBody: document.getElementById('received-text-body'),
  btnCopyReceivedText: document.getElementById('btn-copy-received-text'),
  receivedLinkBox: document.getElementById('received-link-box'),
  receivedLinkDomain: document.getElementById('received-link-domain'),
  receivedLinkUrl: document.getElementById('received-link-url'),
  btnOpenReceivedLink: document.getElementById('btn-open-received-link'),
  receivedFilesBox: document.getElementById('received-files-box'),
  receivedFilesCount: document.getElementById('received-files-count'),
  btnDownloadAll: document.getElementById('btn-download-all'),
  receivedMediaGallery: document.getElementById('received-media-gallery'),
  receivedFilesList: document.getElementById('received-files-list'),

  // Composer
  tabBtns: document.querySelectorAll('.tab-btn'),
  composerPanels: document.querySelectorAll('.composer-panel'),
  fileInput: document.getElementById('file-input'),
  imageInput: document.getElementById('image-input'),
  videoInput: document.getElementById('video-input'),
  dropzoneFiles: document.getElementById('dropzone-files'),
  dropzoneImage: document.getElementById('dropzone-image'),
  dropzoneVideo: document.getElementById('dropzone-video'),
  textInput: document.getElementById('text-input'),
  textCharCount: document.getElementById('text-char-count'),
  textByteCount: document.getElementById('text-byte-count'),
  linkInput: document.getElementById('link-input'),
  linkPreviewBox: document.getElementById('link-preview-box'),
  linkDomainBadge: document.getElementById('link-domain-badge'),
  linkPreviewUrl: document.getElementById('link-preview-url'),
  previewSection: document.getElementById('preview-section'),
  previewItemCount: document.getElementById('preview-item-count'),
  previewTotalSize: document.getElementById('preview-total-size'),
  previewList: document.getElementById('preview-list'),
  btnSendContent: document.getElementById('btn-send-content'),

  // Modals & Toast
  renameModal: document.getElementById('rename-modal'),
  btnCloseRename: document.getElementById('btn-close-rename'),
  inputDeviceName: document.getElementById('input-device-name'),
  btnSaveDeviceName: document.getElementById('btn-save-device-name'),
  toastContainer: document.getElementById('toast-container')
};

/* ==========================================================================
   UI Helpers & Notification Toast
   ========================================================================== */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    <span>${message}</span>
  `;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 200);
  }, duration);
}

function applyTheme(theme) {
  state.theme = theme;
  DOM.html.dataset.theme = theme;
  localStorage.setItem('fylink_theme', theme);
  if (theme === 'dark') {
    DOM.themeIconSun.classList.add('hidden');
    DOM.themeIconMoon.classList.remove('hidden');
  } else {
    DOM.themeIconSun.classList.remove('hidden');
    DOM.themeIconMoon.classList.add('hidden');
  }
}

function updateDeviceDisplay() {
  DOM.deviceNameDisplay.textContent = state.deviceName;
  DOM.inputDeviceName.value = state.deviceName;
  DOM.headerCodeDisplay.textContent = state.myCode;
  DOM.myCodeText.textContent = state.myCode;

  // Render QR Code of this device
  renderMyQrCode();
}

function renderMyQrCode() {
  DOM.myQrContainer.innerHTML = '';
  const myUrl = `${window.location.origin}${window.location.pathname}#${state.myCode}`;

  if (typeof window.QRCode !== 'undefined') {
    new window.QRCode(DOM.myQrContainer, {
      text: myUrl,
      width: 160,
      height: 160,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: window.QRCode.CorrectLevel.M
    });
  } else {
    DOM.myQrContainer.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);padding:1rem;">Mã của bạn: <strong>${state.myCode}</strong></div>`;
  }
}

/* ==========================================================================
   Tab Navigation & Composer Management
   ========================================================================== */
function switchTab(tabId) {
  state.activeTab = tabId;
  DOM.tabBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  DOM.composerPanels.forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });
  updateComposerState();
}

async function addFiles(fileList) {
  for (const file of fileList) {
    const item = {
      id: Math.random().toString(36).substring(2, 9),
      file,
      name: sanitizeFilename(file.name),
      size: file.size,
      type: file.type || 'application/octet-stream'
    };

    if (file.type.startsWith('image/')) {
      item.mediaType = 'image';
      const imgData = await generateImageThumbnail(file);
      if (imgData) {
        item.thumbnail = imgData.thumbnail;
        item.width = imgData.width;
        item.height = imgData.height;
      }
    } else if (file.type.startsWith('video/')) {
      item.mediaType = 'video';
      const vidData = await generateVideoThumbnail(file);
      if (vidData) {
        item.thumbnail = vidData.thumbnail;
        item.duration = vidData.duration;
      }
    } else {
      item.mediaType = 'file';
    }

    state.stagedItems.push(item);
  }

  renderPreviewList();
  updateComposerState();
}

function removeStagedItem(id) {
  state.stagedItems = state.stagedItems.filter(i => i.id !== id);
  renderPreviewList();
  updateComposerState();
}

function renderPreviewList() {
  if (state.stagedItems.length === 0) {
    DOM.previewSection.classList.add('hidden');
    DOM.previewList.innerHTML = '';
    return;
  }

  DOM.previewSection.classList.remove('hidden');
  DOM.previewItemCount.textContent = state.stagedItems.length;

  const totalBytes = state.stagedItems.reduce((acc, cur) => acc + cur.size, 0);
  DOM.previewTotalSize.textContent = formatBytes(totalBytes);

  DOM.previewList.innerHTML = '';
  state.stagedItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'preview-item';

    let thumbHtml = '';
    if (item.thumbnail) {
      thumbHtml = `<img src="${item.thumbnail}" class="preview-thumb" alt="thumb">`;
    } else if (item.mediaType === 'video') {
      thumbHtml = `<div class="preview-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--primary-subtle);color:var(--primary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect width="14" height="14" x="1" y="5" rx="2" ry="2"/></svg></div>`;
    } else {
      thumbHtml = `<div class="preview-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--bg-subtle);color:var(--text-muted);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>`;
    }

    let metaText = formatBytes(item.size);
    if (item.duration) metaText += ` • ${formatDuration(item.duration)}`;

    el.innerHTML = `
      <div class="preview-item-info">
        ${thumbHtml}
        <div class="preview-item-texts">
          <div class="preview-item-name" title="${item.name}">${item.name}</div>
          <div class="preview-item-meta">${metaText}</div>
        </div>
      </div>
      <button class="btn-remove" data-id="${item.id}" title="Xóa file">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    el.querySelector('.btn-remove').addEventListener('click', () => removeStagedItem(item.id));
    DOM.previewList.appendChild(el);
  });
}

function updateComposerState() {
  let canSend = false;

  if (state.activeTab === 'files' || state.activeTab === 'image' || state.activeTab === 'video') {
    canSend = state.stagedItems.length > 0;
  } else if (state.activeTab === 'text') {
    canSend = DOM.textInput.value.trim().length > 0;
  } else if (state.activeTab === 'link') {
    const val = DOM.linkInput.value.trim();
    canSend = val.length > 3 && (val.includes('.') || val.startsWith('http'));
  }

  DOM.btnSendContent.disabled = !canSend;
}

/* ==========================================================================
   Clipboard & Dropzone Handlers
   ========================================================================== */
function setupDropzone(dropzoneEl, fileInputEl, defaultTab) {
  dropzoneEl.addEventListener('click', () => fileInputEl.click());

  dropzoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzoneEl.classList.add('dragover');
  });

  dropzoneEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('dragover');
  });

  dropzoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzoneEl.classList.remove('dragover');
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      switchTab(defaultTab);
      addFiles(e.dataTransfer.files);
    }
  });

  fileInputEl.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      fileInputEl.value = '';
    }
  });
}

// Global Drag & Drop
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    const first = e.dataTransfer.files[0];
    if (first.type.startsWith('image/')) switchTab('image');
    else if (first.type.startsWith('video/')) switchTab('video');
    else switchTab('files');
    addFiles(e.dataTransfer.files);
  }
});

// Global Paste
window.addEventListener('paste', async (e) => {
  const activeEl = document.activeElement;
  const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

  if (e.clipboardData) {
    const items = e.clipboardData.items;
    const pastedFiles = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      switchTab('image');
      await addFiles(pastedFiles);
      showToast('Đã dán ảnh từ clipboard');
      return;
    }

    const pastedText = e.clipboardData.getData('text');
    if (pastedText && !isInputActive) {
      const trimmed = pastedText.trim();
      if (/^https?:\/\//i.test(trimmed)) {
        e.preventDefault();
        switchTab('link');
        DOM.linkInput.value = trimmed;
        DOM.linkInput.dispatchEvent(new Event('input'));
        showToast('Đã dán liên kết từ clipboard');
      } else {
        e.preventDefault();
        switchTab('text');
        DOM.textInput.value = pastedText;
        DOM.textInput.dispatchEvent(new Event('input'));
        showToast('Đã dán văn bản từ clipboard');
      }
    }
  }
});

DOM.textInput.addEventListener('input', () => {
  const text = DOM.textInput.value;
  DOM.textCharCount.textContent = `${text.length} ký tự`;
  DOM.textByteCount.textContent = formatBytes(new TextEncoder().encode(text).length);
  updateComposerState();
});

DOM.linkInput.addEventListener('input', () => {
  const url = DOM.linkInput.value.trim();
  if (url.length > 0) {
    DOM.linkPreviewBox.classList.remove('hidden');
    DOM.linkDomainBadge.textContent = extractDomain(url);
    DOM.linkPreviewUrl.textContent = url;
  } else {
    DOM.linkPreviewBox.classList.add('hidden');
  }
  updateComposerState();
});

/* ==========================================================================
   WebRTC Connection Lifecycle & Two-Way Coordination
   ========================================================================== */
function initWebRTC() {
  state.webrtc = new WebRTCManager({
    deviceName: state.deviceName,
    myCode: state.myCode,
    onPeerReady: (code) => {
      console.log('Peer ready with code:', code);
      state.myCode = code;
      updateDeviceDisplay();
      checkUrlHashForAutoConnect();
    },
    onStatus: (status, details) => {
      if (status === 'connecting') {
        DOM.discoveryStatusBadge.classList.remove('hidden');
        DOM.discoveryStatusText.textContent = details?.message || 'Đang kết nối...';
      } else if (status === 'connected') {
        DOM.discoveryStatusBadge.classList.add('hidden');
        switchToSessionView(details.remoteCode, details.peerId);
      } else if (status === 'disconnected') {
        showToast('Đã ngắt kết nối với thiết bị.');
        switchToDiscoveryView();
      }
    },
    onError: (err) => {
      DOM.discoveryStatusBadge.classList.add('hidden');
      DOM.discoveryErrorBox.classList.remove('hidden');
      DOM.discoveryErrorMessage.textContent = err;
      DOM.btnConnectTarget.disabled = false;
      DOM.btnConnectTarget.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
        Bắt tay kết nối
      `;
    },
    onConnectionEstablished: (conn) => {
      setupCoordinator(conn);
    }
  });
}

function setupCoordinator(conn) {
  state.coordinator = new TransferCoordinator(conn, {
    myDeviceName: state.deviceName,
    onPeerInfo: (info) => {
      DOM.peerDeviceName.textContent = info.deviceName || 'Thiết bị';
      if (info.code) DOM.peerDeviceCode.textContent = info.code;
    },
    onOfferReceived: (offer) => {
      // Khi đối phương gửi nội dung tới -> hiện consent banner
      DOM.consentBanner.classList.remove('hidden');
      DOM.consentTitle.textContent = `${offer.deviceName || 'Thiết bị'} muốn gửi nội dung`;

      let summary = '';
      if (offer.contentType === 'text') {
        summary = `Đoạn văn bản (${formatBytes(offer.totalSize)})`;
      } else if (offer.contentType === 'link') {
        summary = `Liên kết: ${offer.domain || 'External link'}`;
      } else {
        summary = `${offer.itemCount} ${offer.contentType} (${formatBytes(offer.totalSize)})`;
      }
      DOM.consentDesc.textContent = summary;
    },
    onStatusChange: (status) => {
      if (status === 'sending') {
        DOM.transferProgressCard.classList.remove('hidden');
        DOM.transferStatusLabel.textContent = 'Đang gửi dữ liệu...';
      } else if (status === 'receiving') {
        DOM.consentBanner.classList.add('hidden');
        DOM.transferProgressCard.classList.remove('hidden');
        DOM.transferStatusLabel.textContent = 'Đang nhận dữ liệu...';
      } else if (status === 'completed') {
        DOM.transferProgressCard.classList.add('hidden');
        showToast('✓ Truyền dữ liệu hoàn tất!');
      } else if (status === 'rejected') {
        DOM.consentBanner.classList.add('hidden');
        DOM.transferProgressCard.classList.add('hidden');
        showToast('Yêu cầu gửi đã bị từ chối');
      }
    },
    onProgress: (m) => {
      DOM.transferProgressCard.classList.remove('hidden');
      DOM.transferStatusLabel.textContent = m.mode === 'sending' ? `Đang gửi: ${m.fileName}` : `Đang nhận: ${m.fileName}`;
      DOM.transferProgressPercent.textContent = `${Math.round(m.totalProgress)}%`;
      DOM.transferProgressBar.style.width = `${m.totalProgress}%`;
      DOM.transferMetricsSpeed.textContent = formatSpeed(m.speed);
      DOM.transferMetricsBytes.textContent = `${formatBytes(m.transferredBytes)} / ${formatBytes(m.totalBytes)}`;
      DOM.transferMetricsEta.textContent = m.eta > 0 ? `ETA: ${formatDuration(m.eta)}` : 'ETA: --';
    },
    onTransferComplete: (result) => {
      DOM.transferProgressCard.classList.add('hidden');
      if (result.isSender) {
        showToast('Nội dung đã được gửi thành công!');
        // Reset composer
        state.stagedItems = [];
        DOM.textInput.value = '';
        DOM.linkInput.value = '';
        renderPreviewList();
        updateComposerState();
        return;
      }

      // Display Received Content
      DOM.receivedContentCard.classList.remove('hidden');

      if (result.type === 'text') {
        DOM.receivedTextBox.classList.remove('hidden');
        DOM.receivedTextBody.textContent = result.text;
        DOM.btnCopyReceivedText.onclick = async () => {
          const ok = await copyToClipboard(result.text);
          showToast(ok ? 'Đã sao chép văn bản!' : 'Không thể sao chép');
        };
      } else if (result.type === 'link') {
        DOM.receivedLinkBox.classList.remove('hidden');
        DOM.receivedLinkDomain.textContent = result.domain || extractDomain(result.url);
        DOM.receivedLinkUrl.textContent = result.url;
        DOM.receivedLinkUrl.href = result.url;
        DOM.btnOpenReceivedLink.href = result.url;
      } else if (result.files && result.files.length > 0) {
        DOM.receivedFilesBox.classList.remove('hidden');
        DOM.receivedFilesCount.textContent = result.files.length;
        DOM.receivedMediaGallery.innerHTML = '';
        DOM.receivedFilesList.innerHTML = '';

        const hasMedia = result.files.some(f => f.mimeType.startsWith('image/') || f.mimeType.startsWith('video/'));
        DOM.receivedMediaGallery.style.display = hasMedia ? 'grid' : 'none';

        result.files.forEach(fileItem => {
          if (fileItem.mimeType.startsWith('image/')) {
            const el = document.createElement('div');
            el.className = 'media-card';
            el.innerHTML = `
              <img src="${fileItem.url}" alt="${fileItem.name}">
              <div class="media-card-footer">
                <a href="${fileItem.url}" download="${fileItem.name}" class="btn-secondary btn-sm" style="width:100%; text-decoration:none;">Tải về</a>
              </div>
            `;
            DOM.receivedMediaGallery.appendChild(el);
          } else if (fileItem.mimeType.startsWith('video/')) {
            const el = document.createElement('div');
            el.className = 'media-card';
            el.innerHTML = `
              <video src="${fileItem.url}" controls playsinline preload="metadata"></video>
              <div class="media-card-footer">
                <a href="${fileItem.url}" download="${fileItem.name}" class="btn-secondary btn-sm" style="width:100%; text-decoration:none;">Tải về</a>
              </div>
            `;
            DOM.receivedMediaGallery.appendChild(el);
          }

          const row = document.createElement('div');
          row.className = 'preview-item';
          row.innerHTML = `
            <div class="preview-item-info">
              <div class="preview-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--bg-subtle);">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <div class="preview-item-texts">
                <div class="preview-item-name">${fileItem.name}</div>
                <div class="preview-item-meta">${formatBytes(fileItem.size)} ${fileItem.checksumValid ? '• Đã xác thực ✓' : ''}</div>
              </div>
            </div>
            <a href="${fileItem.url}" download="${fileItem.name}" class="btn-secondary btn-sm" style="text-decoration:none;">
              Tải về
            </a>
          `;
          DOM.receivedFilesList.appendChild(row);
        });

        DOM.btnDownloadAll.onclick = () => {
          result.files.forEach((fileItem, idx) => {
            setTimeout(() => {
              const a = document.createElement('a');
              a.href = fileItem.url;
              a.download = fileItem.name;
              document.body.appendChild(a);
              a.click();
              a.remove();
            }, idx * 250);
          });
        };
      }
    },
    onError: (msg) => {
      DOM.transferProgressCard.classList.add('hidden');
      showToast(msg);
    },
    onCancelled: (msg) => {
      DOM.transferProgressCard.classList.add('hidden');
      DOM.consentBanner.classList.add('hidden');
      showToast(msg);
    }
  });
}

function switchToSessionView(remoteCode, peerId) {
  DOM.discoveryScreen.classList.add('hidden');
  DOM.sessionScreen.classList.remove('hidden');
  DOM.peerDeviceCode.textContent = remoteCode || '------';
  DOM.peerDeviceName.textContent = 'Thiết bị';
  showToast(`Đã kết nối với ${remoteCode}!`);
}

function switchToDiscoveryView() {
  DOM.sessionScreen.classList.add('hidden');
  DOM.discoveryScreen.classList.remove('hidden');
  DOM.targetCodeInput.value = '';
  DOM.btnConnectTarget.disabled = true;
  DOM.btnConnectTarget.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
    </svg>
    Bắt tay kết nối
  `;
}

function sendActiveContent() {
  if (!state.coordinator) {
    showToast('Chưa kết nối với thiết bị.');
    return;
  }

  let offer = {
    contentType: state.activeTab,
    deviceName: state.deviceName,
    totalSize: 0,
    itemCount: 0,
    itemsSummary: []
  };

  if (state.activeTab === 'text') {
    const text = DOM.textInput.value;
    const bytes = new TextEncoder().encode(text).length;
    offer.totalSize = bytes;
    offer.itemCount = 1;
    offer.text = text;
  } else if (state.activeTab === 'link') {
    const url = DOM.linkInput.value.trim();
    offer.totalSize = url.length;
    offer.itemCount = 1;
    offer.url = url;
    offer.domain = extractDomain(url);
  } else {
    offer.totalSize = state.stagedItems.reduce((acc, cur) => acc + cur.size, 0);
    offer.itemCount = state.stagedItems.length;
    offer.files = state.stagedItems;
  }

  state.coordinator.sendOffer(offer);
  showToast('Đang chờ đối phương chấp nhận...');
}

/* ==========================================================================
   Auto-connect via URL Hash Fragment (#8K9B2X)
   ========================================================================== */
function checkUrlHashForAutoConnect() {
  const hash = window.location.hash.replace(/^[#?](?:code=)?/, '').trim().toUpperCase();
  if (hash && hash.length >= 4 && hash !== state.myCode) {
    DOM.targetCodeInput.value = hash;
    DOM.btnConnectTarget.disabled = false;
    setTimeout(() => {
      connectToTarget();
    }, 600);
  }
}

function connectToTarget() {
  const targetCode = DOM.targetCodeInput.value.trim().toUpperCase();
  if (!targetCode) return;

  if (targetCode === state.myCode) {
    showToast('Không thể kết nối tới chính thiết bị này.');
    return;
  }

  DOM.btnConnectTarget.disabled = true;
  DOM.btnConnectTarget.innerHTML = '<span class="pulse-dot"></span> Đang bắt tay...';
  DOM.discoveryErrorBox.classList.add('hidden');

  state.webrtc.connectTo(targetCode);
}

/* ==========================================================================
   Event Listeners
   ========================================================================== */
function initEvents() {
  // Brand Click reload
  DOM.brandLink.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.hash = '';
    window.location.reload();
  });

  // Theme Toggle
  DOM.themeToggle.addEventListener('click', () => {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  });

  // Device Name Click
  DOM.deviceChip.addEventListener('click', () => {
    DOM.renameModal.classList.add('active');
  });
  DOM.btnCloseRename.addEventListener('click', () => {
    DOM.renameModal.classList.remove('active');
  });
  DOM.btnSaveDeviceName.addEventListener('click', () => {
    const val = DOM.inputDeviceName.value.trim();
    if (val) {
      state.deviceName = val;
      localStorage.setItem('fylink_device_name', val);
      updateDeviceDisplay();
      showToast('Đã lưu tên thiết bị');
    }
    DOM.renameModal.classList.remove('active');
  });

  // Copy My Code
  const copyCodeAction = async () => {
    const ok = await copyToClipboard(state.myCode);
    showToast(ok ? `Đã sao chép mã: ${state.myCode}` : 'Không thể sao chép');
  };
  DOM.btnCopyMyCode.addEventListener('click', copyCodeAction);
  DOM.headerCodeChip.addEventListener('click', copyCodeAction);

  // Target Code Input (Chỉ cho phép nhập 6 chữ số)
  DOM.targetCodeInput.addEventListener('input', () => {
    const val = DOM.targetCodeInput.value.replace(/\D/g, '').slice(0, 6);
    DOM.targetCodeInput.value = val;
    DOM.btnConnectTarget.disabled = val.length < 6;
  });
  DOM.targetCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !DOM.btnConnectTarget.disabled) {
      connectToTarget();
    }
  });
  DOM.btnConnectTarget.addEventListener('click', connectToTarget);

  // Disconnect Button
  DOM.btnDisconnect.addEventListener('click', () => {
    if (state.webrtc) state.webrtc.disconnect();
    window.location.hash = '';
    switchToDiscoveryView();
  });

  // Tabs
  DOM.tabBtns.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Dropzones
  setupDropzone(DOM.dropzoneFiles, DOM.fileInput, 'files');
  setupDropzone(DOM.dropzoneImage, DOM.imageInput, 'image');
  setupDropzone(DOM.dropzoneVideo, DOM.videoInput, 'video');

  // Send Action
  DOM.btnSendContent.addEventListener('click', sendActiveContent);

  // Consent Actions
  DOM.btnConsentAccept.addEventListener('click', () => {
    if (state.coordinator) state.coordinator.acceptOffer();
  });
  DOM.btnConsentReject.addEventListener('click', () => {
    if (state.coordinator) state.coordinator.rejectOffer();
  });
}

// Initial Boot
applyTheme(state.theme);
updateDeviceDisplay();
initEvents();
initWebRTC();
