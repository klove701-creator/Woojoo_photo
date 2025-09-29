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
    const dlBtn = $('#modalDlBtn');

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
          try { ghost.pause(); } catch (_) {}
          ghost.removeAttribute('controls');
          ghost.playsInline = true;
          ghost.muted = true;
          ghost.src = prevElVisible.src;
          try { ghost.load(); } catch (_) {}
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
        ghost.style.transition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)';
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
    this.updateModalHeader(photo);

    modal.classList.remove('slide-right');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // 자동 숨김 시작
    this.app.uiManager?.resetModalAutoHide();

    // Run in/out animation if applicable
    if (ghost && direction) {
      const incoming = isVideoUrl(photo.url) ? bigVideo : bigImg;
      // Prepare incoming element start state
      incoming.style.transition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms cubic-bezier(0.4, 0, 0.2, 1)';
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
      }, 420);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.showModal(this.photos[this.currentIndex - 1], this.photos, 'right');
    }
  }

  next() {
    if (this.currentIndex < this.photos.length - 1) {
      this.showModal(this.photos[this.currentIndex + 1], this.photos, 'left');
    }
  }

  hideModal() {
    const modal = $('#modal');
    if (!modal) return;
    modal.classList.add('slide-right');
    modal.classList.remove('show');
    document.body.style.overflow = '';
    if (this.commentUnsub) {
      this.commentUnsub();
      this.commentUnsub = null;
    }
  }

  renderStrip() {
    const strip = $('#strip');
    if (!strip) return;
    strip.innerHTML = '';
    this.photos.forEach((p, idx) => {
      const img = document.createElement('img');
      img.src = preview(p.url, 200, 200);
      if (idx === this.currentIndex) img.classList.add('active');
      img.addEventListener('click', () => {
        const direction = idx > this.currentIndex ? 'left' : 'right';
        this.showModal(p, this.photos, direction);
      });
      strip.appendChild(img);
    });
  }

  loadComments(photo) {
    const list = $('#commentList');
    if (!list) return;
    list.innerHTML = '';
    if (this.commentUnsub) {
      this.commentUnsub();
      this.commentUnsub = null;
    }
    this.commentUnsub = this.app.storageManager.loadComments(photo, (comments) => {
      list.innerHTML = '';
      comments.forEach(c => {
        const div = document.createElement('div');
        div.className = 'comment-item';

        const headerDiv = document.createElement('div');
        headerDiv.className = 'comment-header';

        const userSpan = document.createElement('strong');
        userSpan.textContent = c.user;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'comment-time';
        const date = new Date(c.createdAt);
        timeSpan.textContent = date.toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });

        headerDiv.appendChild(userSpan);
        headerDiv.appendChild(timeSpan);

        const textDiv = document.createElement('div');
        textDiv.className = 'comment-text';
        textDiv.textContent = c.text;

        div.appendChild(headerDiv);
        div.appendChild(textDiv);
        list.appendChild(div);
      });
    });
  }

  submitComment() {
    const input = $('#commentInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !this.currentPhoto) return;
    if (!this.app.currentUser) {
      alert('사용자를 선택하세요');
      return;
    }
    const comment = {
      user: this.app.currentUser,
      text,
      createdAt: Date.now()
    };
    this.app.storageManager.addComment(this.currentPhoto, comment);

    // 댓글 작성 활동 로그 저장
    this.app.storageManager.saveActivityLog('comment', {
      user: this.app.currentUser,
      photoId: this.currentPhoto.id || this.currentPhoto.public_id || this.currentPhoto.url,
      timestamp: Date.now()
    }).catch(e => console.warn('댓글 활동 로그 저장 실패:', e));

    input.value = '';
  }

  async deleteCurrent() {
    if (!this.currentPhoto) return;
    if (!confirm('이 사진을 삭제하시겠습니까?')) return;
    try {
      await this.app.photoManager.deletePhoto(this.currentPhoto);
      this.photos.splice(this.currentIndex, 1);
      this.hideModal();
      this.app.load();
    } catch (e) {
      alert('삭제 중 오류가 발생했습니다: ' + e.message);
    }
  }

  showAlbumSelector() {
    if (!this.currentPhoto) return;
    const input = prompt('앨범 이름을 입력하세요 (쉼표로 구분)');
    if (!input) return;
    const names = input.split(',').map(n => n.trim()).filter(Boolean);
    if (!names.length) return;
    const photoId = this.currentPhoto.id || this.currentPhoto.public_id || this.currentPhoto.url;
    this.app.movePhotosToAlbums([photoId], names);
    alert('앨범에 추가되었습니다.');
  }

  toggleReaction(emoji) {
    if (!this.currentPhoto || !this.app.currentUser) return;
    if (!this.currentPhoto.reactions) this.currentPhoto.reactions = {};
    const users = this.currentPhoto.reactions[emoji] || [];
    const idx = users.indexOf(this.app.currentUser);
    const wasLiked = idx >= 0;

    if (wasLiked) {
      users.splice(idx, 1);
    } else {
      users.push(this.app.currentUser);
      // 하트 이모지일 때 이펙트 표시
      if (emoji === '❤️') {
        this.showHeartEffect();
      }
    }
    this.currentPhoto.reactions[emoji] = users;
    this.updateReactionsUI(this.currentPhoto);
    this.app.photoManager.updatePhoto(this.currentPhoto, { reactions: this.currentPhoto.reactions });

    // 타임라인 업데이트 (하트/댓글 카운트 반영)
    if (this.app.uiManager?.currentTab === 'timeline') {
      this.app.renderTimeline();
    }

    // Day Grid가 열려있다면 업데이트
    this.updateDayGridIfOpen();
  }

  // 인스타그램식 하트 이펙트
  showHeartEffect() {
    const viewer = $('#modalViewer');
    if (!viewer) return;

    // 하트 이펙트 요소 생성
    const heartEffect = document.createElement('div');
    heartEffect.className = 'heart-effect';
    heartEffect.textContent = '❤️';

    // 화면 중앙에 위치시키기
    const viewerRect = viewer.getBoundingClientRect();
    heartEffect.style.left = `${viewerRect.width / 2 - 40}px`; // 하트 크기의 절반만큼 조정
    heartEffect.style.top = `${viewerRect.height / 2 - 40}px`;

    viewer.appendChild(heartEffect);

    // 애니메이션 완료 후 요소 제거
    setTimeout(() => {
      if (heartEffect && heartEffect.parentNode) {
        heartEffect.parentNode.removeChild(heartEffect);
      }
    }, 1200);
  }

  // Day Grid 업데이트 (열려있는 경우)
  updateDayGridIfOpen() {
    const dayGridOverlay = document.getElementById('dayGridOverlay');
    if (dayGridOverlay && dayGridOverlay.classList.contains('show')) {
      // Day Grid가 현재 열려있다면 다시 렌더링
      const currentDate = this.app.uiManager.currentGridDate;
      if (currentDate) {
        // 현재 사진의 날짜가 Day Grid와 같다면 업데이트
        const photoDate = this.currentPhoto?.dateGroup ||
                         (this.currentPhoto?.uploadedAt ? this.currentPhoto.uploadedAt.split('T')[0] : null);
        if (photoDate === currentDate) {
          this.app.uiManager.showDayGrid(currentDate);
        }
      }
    }
  }

  updateReactionsUI(photo) {
    const buttons = $$('.reaction');
    buttons.forEach(btn => {
      const emoji = btn.dataset.emoji;
      const users = photo.reactions?.[emoji] || [];
      const countSpan = btn.querySelector('.reaction-count');
      if (countSpan) countSpan.textContent = users.length;
      btn.classList.toggle('active', users.includes(this.app.currentUser));
    });
  }

  updateModalHeader(photo) {
    const ddayElement = $('#modalDday');
    const dateElement = $('#modalDate');

    if (!ddayElement || !dateElement) return;

    // 사진의 날짜 정보 가져오기 (dateGroup 또는 uploadedAt 사용)
    const photoDate = photo.dateGroup || (photo.uploadedAt ? photo.uploadedAt.split('T')[0] : null);

    if (photoDate) {
      // D-Day 계산
      const ddayText = this.app.calculateDDay(photoDate);
      ddayElement.textContent = ddayText;

      // 날짜 표시 ("패밀리" 제거)
      const date = new Date(photoDate + 'T00:00:00');
      const dateText = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      dateElement.textContent = dateText;
    } else {
      // 날짜 정보가 없는 경우
      ddayElement.textContent = '';
      dateElement.textContent = '';
    }
  }
}
