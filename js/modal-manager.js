import { $, $$, preview, isVideoUrl } from './utils.js';

export class ModalManager {
  constructor(app) {
    this.app = app;
    this.currentIndex = -1;
    this.commentUnsub = null;
    this.currentPhoto = null;
    this.photos = [];
  }

  showModal(photo, photos = this.app.photos, direction = null) {
    if (!photo) return;
    this.photos = photos;
    const prevPhoto = this.currentPhoto;
    this.currentIndex = this.photos.indexOf(photo);
    if (this.currentIndex < 0) this.currentIndex = 0;
    this.currentPhoto = photo;

    const modal = $('#modal');
    const bigImg = $('#big');
    const bigVideo = $('#bigVideo');
    const viewer = $('#modalViewer');
    const dlBtn = $('#dlBtn');

    if (!modal || !bigImg || !bigVideo) return;

    // Prepare animated transition if navigating within an open modal
    const isOpen = modal.classList.contains('show');
    let ghost = null;
    let ghostIsVideo = false;
    if (isOpen && direction && viewer) {
      // Determine currently visible element to clone as a ghost
      const prevElVisible = bigVideo.style.display !== 'none' && bigVideo.src ? bigVideo : bigImg;
      if (prevElVisible && (prevPhoto || prevElVisible.src)) {
        ghost = prevElVisible.cloneNode(true);
        ghostIsVideo = prevElVisible === bigVideo;
        // Ensure ghost has correct media source
        if (ghostIsVideo) {
          try { ghost.pause(); } catch(_) {}
          ghost.removeAttribute('controls');
          ghost.playsInline = true;
          ghost.muted = true;
          ghost.src = prevElVisible.src;
          try { ghost.load(); } catch(_) {}
        } else {
          ghost.src = prevElVisible.src;
        }
        // Position ghost absolutely within the viewer
        ghost.style.position = 'absolute';
        ghost.style.inset = '0';
        ghost.style.margin = 'auto';
        ghost.style.maxWidth = '100%';
        ghost.style.maxHeight = '70vh';
        ghost.style.objectFit = 'contain';
        ghost.style.zIndex = '5';
        ghost.style.transition = 'transform 200ms ease, opacity 200ms ease';
        ghost.style.transform = 'translateX(0)';
        ghost.style.opacity = '1';
        viewer.appendChild(ghost);
      }
    }

    if (isVideoUrl(photo.url)) {
      bigImg.style.display = 'none';
      bigVideo.style.display = 'block';
      bigVideo.src = photo.url;
      bigVideo.load();
    } else {
      bigVideo.pause();
      bigVideo.style.display = 'none';
      bigImg.style.display = 'block';
      bigImg.src = photo.url;
    }

    if (dlBtn) dlBtn.href = photo.url;

    this.renderStrip();
    this.loadComments(photo);
    this.updateReactionsUI(photo);

    modal.classList.remove('slide-right');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // Run in/out animation if applicable
    if (ghost && direction) {
      const incoming = isVideoUrl(photo.url) ? bigVideo : bigImg;
      // Prepare incoming element start state
      incoming.style.transition = 'transform 200ms ease, opacity 200ms ease';
      incoming.style.transform = direction === 'left' ? 'translateX(40px)' : 'translateX(-40px)';
      incoming.style.opacity = '0';
      // Force reflow before starting animations
      // eslint-disable-next-line no-unused-expressions
      incoming.offsetWidth;
      // Animate
      requestAnimationFrame(() => {
        ghost.style.transform = direction === 'left' ? 'translateX(-40px)' : 'translateX(40px)';
        ghost.style.opacity = '0';
        incoming.style.transform = 'translateX(0)';
        incoming.style.opacity = '1';
      });
      // Cleanup after animation
      setTimeout(() => {
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        incoming.style.transition = '';
        incoming.style.transform = '';
        incoming.style.opacity = '';
      }, 220);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.showModal(this.photos[this.currentIndex - 1], this.photos, 'right');
    }
  }

  next() {
    if (this.currentIndex < this.photos.length - 1) {
      this