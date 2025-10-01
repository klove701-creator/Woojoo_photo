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
    const viewer = $('#modalViewer');
    const dlBtn = $('#modalDlBtn');

    if (!modal || !viewer) return;

    // 슬라이더 시스템 초기화
    this.initModalSlider();

    // 현재 사진 설정
    this.updateSlideContents();

    if (dlBtn) dlBtn.href = photo.url;

    this.renderStrip();
    this.loadComments(photo);
    this.updateReactionsUI(photo);
    this.updateModalHeader(photo);

    modal.classList.remove('slide-right');
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // 뒤로가기 버튼을 위한 히스토리 상태 추가
    window.history.pushState({ page: 'modal' }, '', window.location.href);

    // 자동 숨김 시작
    this.app.uiManager?.resetModalAutoHide();
  }

  // 모달 슬라이더 초기화
  initModalSlider() {
    const viewer = $('#modalViewer');
    if (!viewer) return;

    // 기존 슬라이더 구조가 있으면 제거
    const existingSlider = viewer.querySelector('.modal-slider');
    if (existingSlider) {
      existingSlider.remove();
    }

    // 새 슬라이더 구조 생성
    const slider = document.createElement('div');
    slider.className = 'modal-slider';

    const slides = document.createElement('div');
    slides.className = 'modal-slides';

    // 3개 슬라이드 생성 (이전, 현재, 다음)
    for (let i = 0; i < 3; i++) {
      const slide = document.createElement('div');
      slide.className = 'modal-slide';
      slides.appendChild(slide);
    }

    slider.appendChild(slides);

    // 기존 이미지/비디오 요소들을 슬라이더 앞에 숨기기
    const bigImg = $('#big');
    const bigVideo = $('#bigVideo');
    if (bigImg) bigImg.style.display = 'none';
    if (bigVideo) bigVideo.style.display = 'none';

    viewer.insertBefore(slider, viewer.firstChild);

    this.modalSlides = slides;
  }

  // 슬라이드 내용 업데이트 (초기 로드 시에만 사용)
  updateSlideContents() {
    if (!this.modalSlides) return;

    const slides = this.modalSlides.querySelectorAll('.modal-slide');
    if (slides.length !== 3) return;

    // 이전, 현재, 다음 사진 인덱스 계산
    const prevIndex = this.currentIndex > 0 ? this.currentIndex - 1 : null;
    const nextIndex = this.currentIndex < this.photos.length - 1 ? this.currentIndex + 1 : null;

    // 각 슬라이드에 사진 설정
    this.setSlideContent(slides[0], prevIndex !== null ? this.photos[prevIndex] : null);
    this.setSlideContent(slides[1], this.currentPhoto);
    this.setSlideContent(slides[2], nextIndex !== null ? this.photos[nextIndex] : null);
  }

  // 슬라이드에 콘텐츠 설정
  setSlideContent(slide, photo) {
    slide.innerHTML = '';

    if (!photo) {
      slide.style.opacity = '0.3';
      return;
    }

    slide.style.opacity = '1';

    if (isVideoUrl(photo.url)) {
      const video = document.createElement('video');
      video.src = photo.url;
      video.controls = true;
      video.playsInline = true;
      slide.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = 'photo';
      slide.appendChild(img);
    }
  }

  prev() {
    if (this.currentIndex > 0) {
      this.startSlideTransition('prev');
    }
  }

  next() {
    if (this.currentIndex < this.photos.length - 1) {
      this.startSlideTransition('next');
    }
  }

  // 슬라이드 전환 시작
  startSlideTransition(direction) {
    if (!this.modalSlides) return;

    // 1. 먼저 인덱스 업데이트
    const nextIndex = direction === 'next' ? this.currentIndex + 1 : this.currentIndex - 1;
    const nextPhoto = this.photos[nextIndex];

    // 2. 미리 다음 슬라이드 내용 준비
    this.prepareNextSlides(nextPhoto, nextIndex);

    // 3. 애니메이션 클래스 추가
    this.modalSlides.classList.add(`slide-${direction}`);

    // 4. 애니메이션 완료 후 정리 작업
    setTimeout(() => {
      // 인덱스와 현재 사진 업데이트
      this.currentIndex = nextIndex;
      this.currentPhoto = nextPhoto;

      // 애니메이션 클래스 제거
      this.modalSlides.classList.remove('slide-next', 'slide-prev');

      // 슬라이드 위치 리셋
      this.modalSlides.style.transform = 'translateX(-33.333%)';

      // 메타데이터 업데이트
      this.updatePhotoMetadata();

      // Day Grid가 열려있다면 업데이트
      this.updateDayGridIfOpen();

      // 타임라인 업데이트
      if (this.app.uiManager?.currentTab === 'timeline') {
        this.app.renderTimeline();
      }
    }, 350);
  }

  // 다음 슬라이드들 미리 준비
  prepareNextSlides(nextPhoto, nextIndex) {
    if (!this.modalSlides) return;

    const slides = this.modalSlides.querySelectorAll('.modal-slide');
    if (slides.length !== 3) return;

    // 새로운 인덱스 기준으로 이전, 현재, 다음 사진 계산
    const newPrevIndex = nextIndex > 0 ? nextIndex - 1 : null;
    const newNextIndex = nextIndex < this.photos.length - 1 ? nextIndex + 1 : null;

    // 각 슬라이드에 새로운 사진 설정
    this.setSlideContent(slides[0], newPrevIndex !== null ? this.photos[newPrevIndex] : null);
    this.setSlideContent(slides[1], nextPhoto);
    this.setSlideContent(slides[2], newNextIndex !== null ? this.photos[newNextIndex] : null);
  }

  // 사진 메타데이터 업데이트
  updatePhotoMetadata() {
    const dlBtn = $('#modalDlBtn');
    if (dlBtn) dlBtn.href = this.currentPhoto.url;

    this.renderStrip();
    this.loadComments(this.currentPhoto);
    this.updateReactionsUI(this.currentPhoto);
    this.updateModalHeader(this.currentPhoto);
  }

  // 슬라이드 애니메이션 (기존 호환성을 위해 유지)
  slideToPhoto(direction) {
    this.startSlideTransition(direction === 'right' ? 'prev' : 'next');
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
