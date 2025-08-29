import { $, $$, preview, isVideoUrl } from './utils.js';

export class ModalManager {
  constructor(app) {
    this.app = app;
    this.currentIndex = -1;
    this.commentUnsub = null;
    this.currentPhoto = null;
  }

  showModal(photo) {
    if (!photo) return;
    this.currentIndex = this.app.photos.indexOf(photo);
    if (this.currentIndex < 0) this.currentIndex = 0;
    this.currentPhoto = photo;

    const modal = $('#modal');
    const bigImg = $('#big');
    const bigVideo = $('#bigVideo');
    const dlBtn = $('#dlBtn');

    if (!modal || !bigImg || !bigVideo) return;

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
  }

  prev() {
    if (this.currentIndex > 0) {
      this.showModal(this.app.photos[this.currentIndex - 1]);
    }
  }

  next() {
    if (this.currentIndex < this.app.photos.length - 1) {
      this.showModal(this.app.photos[this.currentIndex + 1]);
    }
  }

  async deleteCurrent() {
    if (!this.currentPhoto) return;
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;

    try {
      await this.app.photoManager.deletePhoto(this.currentPhoto);
      this.app.photos.splice(this.currentIndex, 1);
      this.app.renderCurrentView();

      if (this.app.photos.length === 0) {
        this.app.uiManager.hideModal();
      } else if (this.currentIndex >= this.app.photos.length) {
        this.showModal(this.app.photos[this.app.photos.length - 1]);
      } else {
        this.showModal(this.app.photos[this.currentIndex]);
      }
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다.');
    }
  }

  async submitComment() {
    const input = $('#commentInput');
    if (!input || !this.currentPhoto) return;
    const text = input.value.trim();
    if (!text) return;

    const commentData = {
      user: this.app.currentUser || '익명',
      text,
      createdAt: new Date().toISOString()
    };

    try {
      await this.app.storageManager.addComment(this.currentPhoto, commentData);
      this.currentPhoto.commentCount = (this.currentPhoto.commentCount || 0) + 1;
      input.value = '';
      this.app.photoManager.logActivity('comment');
      this.loadComments(this.currentPhoto);
      this.app.renderCurrentView();
    } catch (e) {
      alert('댓글 전송에 실패했습니다.');
    }
  }

  showAlbumSelector() {
    if (!this.currentPhoto) return;

    const albumCheckboxes = this.app.config.albums.map(album =>
      `<label style="display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer;">
         <input type="checkbox" value="${album}" ${this.currentPhoto.albums?.includes(album) ? 'checked' : ''}>
         <span>${album}</span>
       </label>`
    ).join('');

    const modalHtml = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;" id="albumSelectModal">
        <div style="background:white; padding:24px; border-radius:16px; max-width:400px; width:90%;">
          <h3>📁 앨범에 추가</h3>
          <div id="albumCheckboxContainer">${albumCheckboxes}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button id="cancelAlbumSelect" class="btn secondary">취소</button>
            <button id="confirmAlbumSelect" class="btn">저장</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    $('#cancelAlbumSelect').onclick = () => {
      $('#albumSelectModal')?.remove();
    };

    $('#confirmAlbumSelect').onclick = async () => {
      const selected = $$('#albumCheckboxContainer input[type="checkbox"]:checked').map(cb => cb.value);
      this.currentPhoto.albums = selected;
      try {
        await this.app.storageManager.updatePhoto(this.currentPhoto, { albums: this.currentPhoto.albums });
        this.app.uiManager.showMessage('앨범에 추가되었습니다.');
      } catch (e) {
        alert('앨범 업데이트 중 오류가 발생했습니다.');
      }
      $('#albumSelectModal')?.remove();
      this.app.renderCurrentView();
    };
  }

  toggleReaction(emoji) {
    if (!this.currentPhoto || !this.app.currentUser) return;

    if (!this.currentPhoto.reactions) this.currentPhoto.reactions = {};
    if (!this.currentPhoto.reactions[emoji]) this.currentPhoto.reactions[emoji] = [];

    const users = this.currentPhoto.reactions[emoji];
    const idx = users.indexOf(this.app.currentUser);
    if (idx >= 0) {
      users.splice(idx, 1);
    } else {
      users.push(this.app.currentUser);
    }

    this.updateReactionsUI(this.currentPhoto);
    this.app.photoManager.updatePhoto(this.currentPhoto, { reactions: this.currentPhoto.reactions });
  }

  loadComments(photo) {
    if (this.commentUnsub) {
      this.commentUnsub();
      this.commentUnsub = null;
    }
    this.commentUnsub = this.app.storageManager.loadComments(photo, (comments) => {
      this.renderComments(comments);
    });
  }

  renderComments(comments = []) {
    const list = $('#commentList');
    if (!list) return;
    list.innerHTML = comments.map(c => `
      <div class="comment">
        <div class="author">${c.user || '익명'}</div>
        <div class="text">${c.text}</div>
        <div class="time">${new Date(c.createdAt).toLocaleString()}</div>
      </div>
    `).join('');
  }

  renderStrip() {
    const strip = $('#strip');
    if (!strip) return;
    strip.innerHTML = this.app.photos.map((p, idx) => `
      <img src="${preview(p.url, 150, 150)}" data-index="${idx}" class="${idx === this.currentIndex ? 'active' : ''}"/>
    `).join('');
    $$('#strip img').forEach(img => {
      img.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index, 10);
        const photo = this.app.photos[index];
        if (photo) this.showModal(photo);
      });
    });
  }

  updateReactionsUI(photo) {
    const buttons = $$('.reaction');
    buttons.forEach(btn => {
      const emoji = btn.dataset.emoji;
      const users = photo.reactions?.[emoji] || [];
      const countEl = btn.querySelector('.reaction-count');
      if (countEl) countEl.textContent = users.length;
      btn.classList.toggle('active', users.includes(this.app.currentUser));
    });
  }
}
