import { $, $$, getRandomImages, shuffle, fmtDate, preview } from './utils.js';
export class UIManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'timeline';
    this.currentMonth = new Date();
    this.scheduleCurrentMonth = new Date(); // 일정 캘린더용
    this.isMultiSelectMode = false;
    this.selectedPhotos = new Set();
    
    // 스와이프 관련
    this.swipeStartX = 0;
    this.swipeStartY = 0;
    this.swipeThreshold = 50;
    this.isSwipeProcessing = false;
    
    // Day Grid 관련
    this.dayGridMultiSelectMode = false;
    this.dayGridSelectedPhotos = new Set();
    this.currentGridDate = null;
    this.dayGridPhotos = [];
    this.pendingFiles = [];
    
    // 일정 관련
    this.currentEditingSchedule = null;
    
    this.bindEvents();
  }
  // 이벤트 바인딩
  bindEvents() {
    // 설정 관련
    $('#save')?.addEventListener('click', () => this.app.saveConfig(true));
    $('#skip')?.addEventListener('click', () => this.app.saveConfig(false));
    $('#openSetup')?.addEventListener('click', () => this.toggleSetup());
    // 인증 관련 (로그아웃 버튼 제거됨)
    // 탭 관련
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => this.showTab(e.target.dataset.tab));
    });
    // 업로드 관련
    const fileInput = $('#file');
    const calendarFileInput = $('#calendarFile');
    
    $('#fab')?.addEventListener('click', () => {
      this.app.photoManager.setUploadDateOverride(null);
      fileInput?.click();
    });
    
    fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    calendarFileInput?.addEventListener('change', (e) => this.handleFileUpload(e));
        $('#uploadCancel')?.addEventListener('click', () => this.hideUploadPreview());
    $('#uploadConfirm')?.addEventListener('click', () => this.handleUploadConfirm());
    // 모달 관련
    $('#closeBtn')?.addEventListener('click', () => this.hideModal());
    $('#prevBtn')?.addEventListener('click', () => this.app.modalManager?.prev());
    $('#nextBtn')?.addEventListener('click', () => this.app.modalManager?.next());

    // 새로운 모달 드롭다운 메뉴
    $('#modalMenuBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleModalDropdown();
    });
    $('#modalAlbumBtn')?.addEventListener('click', () => this.app.modalManager?.showAlbumSelector());
    $('#modalDelBtn')?.addEventListener('click', () => this.app.modalManager?.deleteCurrent());

    // 모달 뒤로가기 버튼
    $('#modalBackBtn')?.addEventListener('click', () => this.hideModal());

    // 댓글 토글 버튼
    $('#commentToggleBtn')?.addEventListener('click', () => this.showCommentModal());

    // 모달 자동 숨김을 위한 이벤트
    this.bindModalAutoHide();
    // 캘린더 관련
    $('#prevM')?.addEventListener('click', () => this.navigateMonth(-1));
    $('#nextM')?.addEventListener('click', () => this.navigateMonth(1));
    $('#calTitle')?.addEventListener('click', () => this.showYearPicker());
    // 댓글 관련
    $('#commentSend')?.addEventListener('click', () => {
      this.app.modalManager?.submitComment();
      this.hideCommentInput();
    });
    $('#commentInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.app.modalManager?.submitComment();
        this.hideCommentInput();
      }
    });

    // 댓글 모달 관련
    $('#closeCommentModal')?.addEventListener('click', () => this.hideCommentModal());
    $('#commentModalOverlay')?.addEventListener('click', () => this.hideCommentModal());
    $('#commentModalSend')?.addEventListener('click', () => this.submitCommentModal());
    $('#commentModalInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.submitCommentModal();
      }
    });
    // 멤버 관리
    $('#memberAdd')?.addEventListener('click', () => this.addMember());
    $('#membersReset')?.addEventListener('click', () => this.resetMembers());
    // 앨범 관리
    $('#albumAdd')?.addEventListener('click', () => this.addAlbum());
    $('#albumBtn')?.addEventListener('click', () => this.app.modalManager?.showAlbumSelector());
    // 이모지 반응
    $$('.reaction').forEach(btn => {
      btn.addEventListener('click', (e) => this.app.modalManager?.toggleReaction(e.currentTarget.dataset.emoji));
    });
    // 테마 선택
    $$('.theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.applyTheme(e.target.dataset.theme));
    });
    // 다중선택 관련
    $('#multiselectBtn')?.addEventListener('click', () => this.toggleMultiSelectMode());
    $('#moveToAlbumBtn')?.addEventListener('click', () => this.moveSelectedToAlbum());
    $('#deleteSelectedBtn')?.addEventListener('click', () => this.deleteSelectedPhotos());
    $('#cancelMultiselectBtn')?.addEventListener('click', () => this.exitMultiSelectMode());

    // 중복 사진 관리
    $('#duplicateManagerBtn')?.addEventListener('click', () => this.showDuplicateManager());
    $('#duplicateManagerBtn2')?.addEventListener('click', () => this.showDuplicateManager());

    // 활동 로그
    $('#refreshLogs')?.addEventListener('click', () => this.loadAndDisplayActivityLogs());
    $('#activityLogBtn')?.addEventListener('click', () => this.showActivityLogs());
    $('#familyActivityBtn')?.addEventListener('click', () => this.showActivityLogs());

    // 상태바
    $('#stat')?.addEventListener('click', () => this.app.toggleOnlineMode());
    // 키보드 이벤트
    this.bindKeyboardEvents();
    
    // 스와이프 이벤트
    this.bindSwipeEvents();
    // 캘린더 클릭 이벤트
    this.bindCalendarClickEvents();
    // Day Grid 이벤트
    this.bindDayGridEvents();
    
    // 일정 관련 이벤트
    this.bindScheduleEvents();
    
  }
  // 키보드 이벤트
  bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      const modal = $('#modal');
      if (!modal || !modal.classList.contains('show')) return;

      // 댓글 모드일 때는 키보드 네비게이션 비활성화 (ESC 제외)
      if (this.commentModeActive) {
        if (e.key === 'Escape') this.toggleComments();
        return;
      }

      if (e.key === 'ArrowRight') this.app.modalManager?.next();
      if (e.key === 'ArrowLeft') this.app.modalManager?.prev();
      if (e.key === 'Escape') this.hideModal();
    });
  }
  // 스와이프 이벤트
  bindSwipeEvents() {
    // 모달 스와이프 - 향상된 감도
    const modal = $('#modal');
    modal?.addEventListener('touchstart', (e) => this.handleModalTouchStart(e), {passive: true});
    modal?.addEventListener('touchmove', (e) => this.handleModalTouchMove(e), {passive: false});
    modal?.addEventListener('touchend', (e) => this.handleModalTouchEnd(e), {passive: true});
    
    // 탭 스와이프
    const tabContainer = $('#tabContainer');
    tabContainer?.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'tab'), {passive: true});
    tabContainer?.addEventListener('touchmove', (e) => this.handleTouchMove(e, 'tab'), {passive: true});
    tabContainer?.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'tab'), {passive: true});
    
    // 캘린더 스와이프
    const cal = $('.cal');
    cal?.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'calendar'), {passive: true});
    cal?.addEventListener('touchmove', (e) => this.handleTouchMove(e, 'calendar'), {passive: true});
    cal?.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'calendar'), {passive: true});
  }
  handleTouchStart(e, type) {
    this.swipeStartX = e.touches[0].clientX;
    this.swipeStartY = e.touches[0].clientY;
    this.isSwipeProcessing = false;
  }
  handleTouchMove(e, type) {
    if (this.isSwipeProcessing) return;
  }
  // 향상된 모달 스와이프 핸들러
  handleModalTouchStart(e) {
    // 댓글 모드일 때는 스와이프 비활성화
    if (this.isCommentMode || this.commentModeActive) return;

    this.modalSwipeStartX = e.touches[0].clientX;
    this.modalSwipeStartY = e.touches[0].clientY;
    this.modalSwipeCurrentX = this.modalSwipeStartX;
    this.isModalSwiping = false;
    this.modalSwipeDirection = null;

    // 슬라이더 요소 가져오기
    const viewer = $('#modalViewer');
    if (viewer) {
      this.modalSwipeElement = viewer.querySelector('.modal-slides');
    }
  }

  handleModalTouchMove(e) {
    // 댓글 모드일 때는 스와이프 비활성화
    if (this.isCommentMode || this.commentModeActive) return;
    if (!this.modalSwipeElement) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = currentX - this.modalSwipeStartX;
    const deltaY = currentY - this.modalSwipeStartY;

    // 세로 스크롤이 더 크면 스와이프 취소
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
      return;
    }

    // 가로 스와이프 시작 감지
    if (Math.abs(deltaX) > 10 && !this.isModalSwiping) {
      this.isModalSwiping = true;
      this.modalSwipeDirection = deltaX > 0 ? 'right' : 'left';
      this.modalSwipeElement.classList.add('swiping');
      e.preventDefault();
    }

    if (this.isModalSwiping) {
      e.preventDefault();

      // 슬라이더 변형 적용 (-33.333%가 기본 위치)
      const baseTransform = -33.333;
      const swipePercent = (deltaX / window.innerWidth) * 33.333;
      const newTransform = baseTransform + swipePercent;

      this.modalSwipeElement.style.transform = `translateX(${newTransform}%)`;
      this.modalSwipeCurrentX = currentX;
    }
  }

  handleModalTouchEnd(e) {
    // 댓글 모드일 때는 스와이프 비활성화
    if (this.isCommentMode || this.commentModeActive) {
      this.resetModalSwipe();
      return;
    }

    if (!this.isModalSwiping || !this.modalSwipeElement) {
      this.resetModalSwipe();
      return;
    }

    const deltaX = this.modalSwipeCurrentX - this.modalSwipeStartX;
    const velocity = Math.abs(deltaX);
    const threshold = 100; // 스와이프 임계값

    this.modalSwipeElement.classList.remove('swiping');

    if (velocity > threshold) {
      // 스와이프 완료 - 애니메이션을 통해 다음/이전 사진으로 이동
      const direction = deltaX > 0 ? 'prev' : 'next';

      // 모달 매니저의 애니메이션 시스템 사용
      if (direction === 'prev') {
        this.app.modalManager?.prev();
      } else {
        this.app.modalManager?.next();
      }
    } else {
      // 스와이프 취소 - 원래 위치로 복귀
      this.modalSwipeElement.classList.add('transitioning');
      this.modalSwipeElement.style.transform = 'translateX(-33.333%)';
    }

    setTimeout(() => {
      this.resetModalSwipe();
    }, 300);
  }

  resetModalSwipe() {
    if (this.modalSwipeElement) {
      this.modalSwipeElement.classList.remove('swiping', 'transitioning', 'slide-next', 'slide-prev');
      this.modalSwipeElement.style.transform = 'translateX(-33.333%)';
    }
    this.isModalSwiping = false;
    this.modalSwipeDirection = null;
    this.modalSwipeElement = null;
    this.modalSwipeStartX = 0;
    this.modalSwipeCurrentX = 0;
  }

  handleTouchEnd(e, type) {
    if (this.isSwipeProcessing) return;

    const deltaX = e.changedTouches[0].clientX - this.swipeStartX;
    const deltaY = e.changedTouches[0].clientY - this.swipeStartY;

    // 세로 스크롤이 우선이면 스와이프 무시
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;

    if (Math.abs(deltaX) > this.swipeThreshold) {
      this.isSwipeProcessing = true;

      if (type === 'tab') {
        const tabs = ['timeline', 'calendar', 'albums', 'schedule'];
        const currentIndex = tabs.indexOf(this.currentTab);

        if (deltaX > 0 && currentIndex > 0) {
          this.showTab(tabs[currentIndex - 1]);
        } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
          this.showTab(tabs[currentIndex + 1]);
        }
      } else if (type === 'calendar') {
        if (deltaX > 0) {
          this.navigateMonth(-1);
        } else {
          this.navigateMonth(1);
        }
      }

      setTimeout(() => { this.isSwipeProcessing = false; }, 300);
    }
  }
  // 캘린더 클릭 이벤트
  bindCalendarClickEvents() {
    // 모달 전체에 이벤트 위임
    document.addEventListener('click', (e) => {
      // 모달 외부 클릭시 닫기
      if (e.target.closest('#datePickerModal') === null && 
          e.target.id !== 'calTitle') {
        this.hideDatePicker();
      }
      
      // 연도 아이템 클릭
      if (e.target.classList.contains('year-item')) {
        e.preventDefault();
        e.stopPropagation();
        const yearText = e.target.textContent.replace('년', '');
        const year = parseInt(yearText);
        this.selectYear(year);
      }
      
      // 월 아이템 클릭
      if (e.target.classList.contains('month-item')) {
        e.preventDefault();
        e.stopPropagation();
        const monthText = e.target.textContent.replace('월', '');
        const month = parseInt(monthText) - 1; // 0부터 시작
        this.selectMonth(month);
      }
      // 캘린더 셀 업로드 클릭
      if (e.target.classList.contains('upload-icon') || e.target.closest('.cell.empty')) {
        const cell = e.target.closest('.cell');
        if (cell && cell.dataset.date) {
          this.app.photoManager.setUploadDateOverride(cell.dataset.date);
          $('#calendarFile')?.click();
        }
      }
    });
  }
  // Day Grid 이벤트
  bindDayGridEvents() {
    $('#dayGridBack')?.addEventListener('click', () => this.hideDayGrid());
    $('#dayGridMultiselectBtn')?.addEventListener('click', () => this.toggleDayGridMultiSelectMode());
    $('#dayGridMoveToAlbum')?.addEventListener('click', () => this.moveDayGridSelectedToAlbum());
    $('#dayGridDeleteSelected')?.addEventListener('click', () => this.deleteDayGridSelectedPhotos());
    $('#dayGridCancelMultiselect')?.addEventListener('click', () => this.exitDayGridMultiSelect());
  }

  // 일정 관련 이벤트
  bindScheduleEvents() {
    // 일정 추가 버튼
    $('#addScheduleBtn')?.addEventListener('click', () => this.showScheduleModal());
    
    // 일정 캘린더 네비게이션
    $('#schedulePrevM')?.addEventListener('click', () => this.navigateScheduleMonth(-1));
    $('#scheduleNextM')?.addEventListener('click', () => this.navigateScheduleMonth(1));
    
    // 일정 모달 관련
    $('#closeScheduleModal')?.addEventListener('click', () => this.hideScheduleModal());
    $('#scheduleForm')?.addEventListener('submit', (e) => this.handleScheduleSubmit(e));
    $('#deleteScheduleBtn')?.addEventListener('click', () => this.handleScheduleDelete());
    
    // 모달 외부 클릭 시 닫기
    $('#scheduleModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'scheduleModal') {
        this.hideScheduleModal();
      }
    });
  }
     // 업로드 미리보기 표시
  showUploadPreview(files) {
    const overlay = $('#uploadPreviewOverlay');
    const grid = $('#uploadPreviewGrid');
    if (!overlay || !grid) {
      // 미리보기 지원 안하면 즉시 업로드
      this.app.photoManager.handleFiles(files);
      this.app.renderCurrentView();
      return;
    }
    this.pendingFiles = files;
    grid.innerHTML = '';
    // 날짜 기준 정렬
    files.sort((a, b) => a.lastModified - b.lastModified);
    files.forEach((file, idx) => {
      const url = URL.createObjectURL(file);
      const date = fmtDate(new Date(file.lastModified).toISOString());
      const div = document.createElement('div');
      div.className = 'upload-item selected';
      div.dataset.index = idx;
      div.dataset.date = date;
      div.innerHTML = `<img src="${url}" alt="preview"/>`;
      div.addEventListener('click', () => div.classList.toggle('selected'));
      grid.appendChild(div);
    });
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    overlay.focus();
    this.setupUploadFastScroll();
  }
  hideUploadPreview() {
    const overlay = $('#uploadPreviewOverlay');
    const grid = $('#uploadPreviewGrid');
    if (overlay && overlay.contains(document.activeElement)) {
    document.activeElement.blur();
    }
    overlay?.classList.remove('show');
    overlay?.setAttribute('aria-hidden', 'true');
    if (grid) grid.innerHTML = '';
    this.pendingFiles = [];
  }
  handleUploadConfirm() {
    const selected = $$('#uploadPreviewGrid .upload-item.selected');
    const files = Array.from(selected).map(el => this.pendingFiles[parseInt(el.dataset.index)]);
    this.hideUploadPreview();
    if (files.length > 0) {
      this.app.photoManager.handleFiles(files).then(() => {
        this.app.renderCurrentView();
      });
    }
  }
  setupUploadFastScroll() {
    const container = $('#uploadPreviewContainer');
    const track = $('#uploadFastScrollTrack');
    const thumb = $('#uploadFastScrollThumb');
    const bubble = $('#uploadDateBubble');
    if (!container || !track || !thumb || !bubble) return;
    let dragging = false;
    const updateBubble = () => {
      const items = $$('#uploadPreviewGrid .upload-item');
      const cRect = container.getBoundingClientRect();
      for (const item of items) {
        const rect = item.getBoundingClientRect();
        if (rect.bottom >= cRect.top) {
          bubble.textContent = item.dataset.date || '';
          bubble.classList.add('show');
          clearTimeout(this._bubbleTimer);
          this._bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 500);
          break;
        }
      }
    };
    const updateDrag = (clientY) => {
      const rect = track.getBoundingClientRect();
      const cRect = container.getBoundingClientRect();
      let ratio = (clientY - rect.top) / rect.height;
      ratio = Math.max(0, Math.min(1, ratio));
      const scrollTop = ratio * (container.scrollHeight - container.clientHeight);
      container.scrollTo({ top: scrollTop, behavior: 'auto' });
      thumb.style.top = `${ratio * 100}%`;
      bubble.style.top = `${clientY - cRect.top}px`;
      updateBubble();
    };
    const start = (e) => {
      dragging = true;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      updateDrag(clientY);
      e.preventDefault();
    };
    const move = (e) => {
      if (!dragging) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      updateDrag(clientY);
      e.preventDefault();
    };
    const end = () => {
      dragging = false;
    };
    track.onmousedown = start;
    track.ontouchstart = (e) => start(e);
    document.onmousemove = move;
    document.ontouchmove = (e) => move(e);
    document.onmouseup = end;
    document.ontouchend = end;
    const onScrollLike = () => {
      if (!dragging) {
        const ratio = container.scrollTop / (container.scrollHeight - container.clientHeight);
        thumb.style.top = `${ratio * 100}%`;
      }
      updateBubble();
    };
    container.addEventListener('scroll', onScrollLike);
    container.addEventListener('touchstart', onScrollLike, {passive: true});
    container.addEventListener('touchmove', onScrollLike, {passive: true});
    container.addEventListener('wheel', onScrollLike);
  }
  // 파일 업로드 처리
  async handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // 선택 즉시 업로드 처리
    await this.app.photoManager.handleFiles(files);
    this.app.renderCurrentView();

    event.target.value = '';
  }
  // 설정 표시/숨기기
  showSetup() {
    $('#setup')?.classList.remove('hidden');
    this.app.loadCloudinaryUsage?.();
  }
  hideSetup() {
    $('#setup')?.classList.add('hidden');
  }
  toggleSetup() {
    const setup = $('#setup');
    if (!setup) return;
    if (setup.classList.contains('hidden')) {
      this.showSetup();
    } else {
      this.hideSetup();
    }
  }
  // 탭 전환
  showTab(tab) {
    const tabs = ['timeline', 'calendar', 'albums', 'schedule'];
    const currentIndex = tabs.indexOf(this.currentTab);
    const newIndex = tabs.indexOf(tab);
    
    // 탭 버튼 활성화
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    
    // 슬라이드 방향 결정
    const isForward = newIndex > currentIndex;
    
    // 현재 활성화된 탭 비활성화
    const currentTabEl = $('.tab-content.active');
    if (currentTabEl) {
      currentTabEl.classList.remove('active');
      currentTabEl.classList.add(isForward ? 'slide-left' : 'slide-right');
      
      setTimeout(() => {
        currentTabEl.classList.remove('slide-left', 'slide-right');
      }, 300);
    }
    
    // 새 탭 활성화
    const newTabEl = $(`#${tab}`);
    if (newTabEl) {
      newTabEl.classList.remove('slide-left', 'slide-right');
      newTabEl.classList.add('active');
    }
    
    this.currentTab = tab;
    
    // 특정 탭 렌더링
    if (tab === 'calendar') this.app.renderCalendar();
    if (tab === 'albums') this.app.renderAlbumPhotos();
    if (tab === 'schedule') this.app.renderSchedule();
  }
  // 테마 적용
  applyTheme(theme) {
    document.body.dataset.theme = theme;
    $$('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
    
    this.app.config.theme = theme;
    this.app.saveAppConfig();
  }
  // 스플래시 화면 관리
  showSplashScreen() {
    const splashScreen = $('#splashScreen');
    const splashImages = $('#splashImages');
    
    if (!splashScreen || !splashImages) return;
    
    console.log('스플래시 화면 시작');
    
    let imagesToShow = [];
    
    // 메모리에서 사진 가져오기
    if (this.app.photos && this.app.photos.length > 0) {
      imagesToShow = getRandomImages(this.app.photos, 1);
    } else {
      // 로컬스토리지에서 가져오기
      const savedPhotos = JSON.parse(localStorage.getItem('familyPhotos') || '[]');
      if (savedPhotos.length > 0) {
        imagesToShow = getRandomImages(savedPhotos, 1);
      }
    }
    
    // 사진 표시
    if (imagesToShow.length > 0) {
      splashImages.innerHTML = imagesToShow.map((src) => 
        `<img class="splash-image" src="${preview(src, 800, 800)}" alt="memory" />`
      ).join('');
      
      this.animateSplashImages();
    } else {
      splashImages.style.display = 'none';
    }
    
    // 3초 후 숨기기
    setTimeout(() => {
      this.hideSplashScreen();
    }, 3000);
  }
  animateSplashImages() {
    const images = $$('.splash-image');
    if (images.length === 0) return;
    
    const image = images[0];
    if (!image) return;
    
    // 초기 상태: 투명하고 약간 확대
    image.style.opacity = '0';
    image.style.transform = 'scale(1.1)';
    
    // 0.5초 후 부드럽게 등장
    setTimeout(() => {
      image.style.opacity = '1';
      image.style.transform = 'scale(1)';
    }, 500);
  }
  hideSplashScreen() {
    const splashScreen = $('#splashScreen');
    const appContent = $('.top');
    
    if (!splashScreen) return;
    
    splashScreen.classList.add('hide');
    
    if (appContent) {
      appContent.classList.add('fade-in');
    }
    
    setTimeout(() => {
      splashScreen.style.display = 'none';
    }, 800);
  }
  // 상태 표시
  setStatus(status) {
    const statusEl = $('#stat');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.title = `상태: ${status} (클릭하여 전환)`;
    }
  }
  showMessage(text, isSuccess = true) {
    const msgEl = $('#msg');
    if (msgEl) {
      msgEl.textContent = text;
      msgEl.style.color = isSuccess ? '#10b981' : '#ef4444';
    }
  }
  // 멤버 관리
  renderMembers() {
    const membersArea = $('#membersArea');
    if (!membersArea) return;
    
    membersArea.innerHTML = this.app.config.members.map((member, i) => 
      `<span class="chip" data-i="${i}">${member} <span class="del" title="삭제">×</span></span>`
    ).join('');
    
    // 삭제 이벤트 바인딩
    $$('#membersArea .chip .del').forEach(el => {
      el.onclick = (e) => {
        const i = Number(e.target.closest('.chip').dataset.i);
        this.app.config.members.splice(i, 1);
        this.app.saveAppConfig();
        this.renderMembers();
        this.renderLoginChips();
      };
    });
  }
  renderLoginChips() {
    const loginChips = $('#loginChips');
    if (!loginChips) return;
    
    loginChips.innerHTML = this.app.config.members.map(member => 
      `<button class="btn secondary chipSel" data-member="${member}">${member}</button>`
    ).join('');
    
    // 클릭 이벤트 바인딩
    $$('.chipSel').forEach(chip => {
      chip.onclick = (e) => this.app.login(e.target.dataset.member);
    });
  }
  addMember() {
    const input = $('#memberInput');
    if (!input) return;
    
    const value = input.value.trim();
    if (!value) return;
    
    if (!this.app.config.members.includes(value)) {
      this.app.config.members.push(value);
    }
    
    this.app.saveAppConfig();
    input.value = '';
    this.renderMembers();
    this.renderLoginChips();
  }
  resetMembers() {
    this.app.config.members = ["👨‍💼 아빠","👩‍💼 엄마","🌟 우주","👵 할머니","👴 할아버지","👩‍🦰 고모"];
    this.app.saveAppConfig();
    this.renderMembers();
    this.renderLoginChips();
  }
  // 앨범 관리
  renderAlbums() {
    const albumsList = $('#albumsList');
    const albumFilter = $('#albumFilter');
    
    const albums = this.app.config.albums || [];
    
    // 관리 리스트
    if (albumsList) {
      albumsList.innerHTML = albums.map((album, i) => 
        `<span class="album-item" data-album="${album}" data-i="${i}">${album} <span class="del" title="삭제">×</span></span>`
      ).join('');
      
      // 삭제 이벤트 바인딩 (다중 선택자이므로 $$ 사용!)
      $$('#albumsList .album-item .del').forEach(el => {
        el.onclick = async (e) => {
          e.stopPropagation();
          const i = Number(e.target.closest('.album-item').dataset.i);
          const albumName = albums[i];
          
          this.app.config.albums.splice(i, 1);
          await this.app.storageManager.removeAlbum(albumName);
          this.app.saveAppConfig();
          this.renderAlbums();
        };
      });
    }
    
    // 필터 탭
    if (albumFilter) {
      albumFilter.innerHTML = 
        '<span class="album-item active" data-album="all">전체</span>' +
        albums.map(album => `<span class="album-item" data-album="${album}">${album}</span>`).join('');
      
      $$('#albumFilter .album-item').forEach(el => {
        el.onclick = () => this.app.filterByAlbum(el.dataset.album);
      });
    }
  }
  addAlbum() {
    const input = $('#albumInput');
    if (!input) return;
    
    const value = input.value.trim();
    if (!value) return;
    
    if (!this.app.config.albums.includes(value)) {
      this.app.config.albums.push(value);
      this.app.storageManager.addAlbum(value);
    }
    
    this.app.saveAppConfig();
    input.value = '';
    this.renderAlbums();
  }
  // 캘린더 관리
  navigateMonth(direction) {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
    this.app.renderCalendar();
  }
  showYearPicker() {
    const modal = $('#datePickerModal');
    const header = $('#datePickerHeader');
    const content = $('#datePickerContent');
    
    if (!modal || !header || !content) return;
    
    header.textContent = '연도 선택';
    content.innerHTML = this.generateYearGrid();
    modal.classList.add('show');
  }
  hideDatePicker() {
    $('#datePickerModal')?.classList.remove('show');
  }
  generateYearGrid() {
    const currentYear = this.currentMonth.getFullYear();
    const startYear = currentYear - 10;
    const years = [];
    
    for (let i = 0; i < 20; i++) {
      years.push(startYear + i);
    }
    
    return `<div class="year-grid">
      ${years.map(year => 
        `<div class="year-item ${year === currentYear ? 'current' : ''}">${year}년</div>`
      ).join('')}
    </div>`;
  }
  generateMonthGrid() {
    const months = ['1월', '2월', '3월', '4월', '5월', '6월', 
                   '7월', '8월', '9월', '10월', '11월', '12월'];
    const currentMonth = this.currentMonth.getMonth();
    
    return `<div class="month-grid">
      ${months.map((month, i) => 
        `<div class="month-item ${i === currentMonth ? 'current' : ''}">${month}</div>`
      ).join('')}
    </div>`;
  }
  selectYear(year) {
    const currentMonthIndex = this.currentMonth.getMonth();
    this.currentMonth = new Date(year, currentMonthIndex, 1);
    
    // 월 선택 화면으로 전환
    const header = $('#datePickerHeader');
    const content = $('#datePickerContent');
    
    if (header && content) {
      header.textContent = `${year}년`;
      content.innerHTML = this.generateMonthGrid();
    }
  }
  selectMonth(monthIndex) {
    const currentYear = this.currentMonth.getFullYear();
    this.currentMonth = new Date(currentYear, monthIndex, 1);
    
    this.app.renderCalendar();
    this.hideDatePicker();
  }
  // 다중선택 모드
  toggleMultiSelectMode() {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    this.selectedPhotos.clear();
    
    const btn = $('#multiselectBtn');
    const bottomBar = $('#multiselectBottomBar');
    
    if (!btn || !bottomBar) return;
    
    if (this.isMultiSelectMode) {
      btn.textContent = '선택 취소';
      btn.classList.add('btn');
      btn.classList.remove('secondary');
      bottomBar.classList.add('show');
    } else {
      btn.textContent = '다중선택';
      btn.classList.remove('btn');
      btn.classList.add('secondary');
      bottomBar.classList.remove('show');
    }
    
    this.app.renderAlbumPhotos();
  }
  exitMultiSelectMode() {
    this.isMultiSelectMode = false;
    this.selectedPhotos.clear();
    
    const btn = $('#multiselectBtn');
    const bottomBar = $('#multiselectBottomBar');
    
    if (btn) {
      btn.textContent = '다중선택';
      btn.classList.remove('btn');
      btn.classList.add('secondary');
    }
    
    bottomBar?.classList.remove('show');
    
    this.app.renderAlbumPhotos();
  }
  selectPhoto(photoId) {
    if (this.selectedPhotos.has(photoId)) {
      this.selectedPhotos.delete(photoId);
    } else {
      this.selectedPhotos.add(photoId);
    }
    
    const container = document.querySelector(`[data-photo-id="${photoId}"]`);
    if (container) {
      container.classList.toggle('selected', this.selectedPhotos.has(photoId));
    }
    
    this.updateMultiSelectInfo();
  }
  updateMultiSelectInfo() {
    const count = this.selectedPhotos.size;
    const moveBtn = $('#moveToAlbumBtn');
    const deleteBtn = $('#deleteSelectedBtn');
    
    if (moveBtn && deleteBtn) {
      if (count > 0) {
        moveBtn.textContent = `📁 앨범 이동 (${count}개)`;
        deleteBtn.textContent = `🗑️ 삭제 (${count}개)`;
        moveBtn.disabled = false;
        deleteBtn.disabled = false;
      } else {
        moveBtn.textContent = '📁 앨범 이동';
        deleteBtn.textContent = '🗑️ 삭제';
        moveBtn.disabled = true;
        deleteBtn.disabled = true;
      }
    }
  }
  async moveSelectedToAlbum() {
    if (this.selectedPhotos.size === 0) {
      alert('사진을 먼저 선택해주세요.');
      return;
    }

    if (this.app.config.albums.length === 0) {
      alert('앨범이 없습니다. 설정에서 앨범을 먼저 추가해주세요.');
      return;
    }

    const albumCheckboxes = this.app.config.albums.map(album =>
      `<label style="display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer;">
         <input type="checkbox" value="${album}">
         <span>${album}</span>
       </label>`
    ).join('');

    const modalHtml = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;" id="albumSelectModal">
        <div style="background:white; padding:24px; border-radius:16px; max-width:400px; width:90%;">
          <h3>📁 앨범 선택</h3>
          <p>${this.selectedPhotos.size}개 사진을 이동할 앨범을 선택하세요</p>
          <div id="albumCheckboxContainer">${albumCheckboxes}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button id="cancelAlbumSelect" class="btn secondary">취소</button>
            <button id="confirmAlbumSelect" class="btn">이동하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const cancelBtn = $('#cancelAlbumSelect');
    const confirmBtn = $('#confirmAlbumSelect');

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        const modal = $('#albumSelectModal');
        if (modal) modal.remove();
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const checkboxes = $$('#albumCheckboxContainer input[type="checkbox"]:checked');
        const selectedAlbums = Array.from(checkboxes).map(cb => cb.value);

        if (selectedAlbums.length === 0) {
          alert('앨범을 선택해주세요.');
          return;
        }

        try {
          await this.app.movePhotosToAlbums(Array.from(this.selectedPhotos), selectedAlbums);
          alert(`${this.selectedPhotos.size}개 사진이 선택한 앨범에 추가되었습니다.`);
          const modal = $('#albumSelectModal');
          if (modal) modal.remove();
          this.exitMultiSelectMode();
          this.app.renderCurrentView();
        } catch (e) {
          console.error('앨범 이동 오류:', e);
          alert('앨범 이동 중 오류가 발생했습니다: ' + e.message);
        }
      };
    }
  }
  async deleteSelectedPhotos() {
    if (this.selectedPhotos.size === 0) return;
    
    if (!confirm(`선택한 ${this.selectedPhotos.size}개 사진을 정말 삭제하시겠습니까?`)) return;
    
    try {
      await this.app.deleteMultiplePhotos(Array.from(this.selectedPhotos));
      alert(`${this.selectedPhotos.size}개 사진이 삭제되었습니다.`);
      this.exitMultiSelectMode();
      this.app.load();
    } catch (e) {
      alert('사진 삭제 중 오류가 발생했습니다: ' + e.message);
    }
  }
  // Day Grid 관리
  showDayGrid(date) {
    const overlay = $('#dayGridOverlay');
    const title = $('#dayGridTitle');
    const count = $('#dayGridCount');
    const grid = $('#dayGrid');
    
    if (!overlay || !grid) return;
    this.currentGridDate = date;

    // 기존 선택 상태 백업
    const previouslySelected = new Set(this.dayGridSelectedPhotos);

    // 다른 날짜로 변경된 경우에만 선택 상태 초기화
    if (this.lastGridDate !== date) {
      this.dayGridMultiSelectMode = false;
      this.dayGridSelectedPhotos.clear();
    }
    this.lastGridDate = date;

    const dayPhotos = this.app.getPhotosByDate(date);
    this.dayGridPhotos = dayPhotos;
    
    if (title) title.textContent = date;
    if (count) count.textContent = `${dayPhotos.length}장`;

    // 스플래시 이미지 설정
    this.setupDayGridSplash(date, dayPhotos);

    const shuffledPhotos = shuffle(dayPhotos);
    
    grid.innerHTML = shuffledPhotos.map(photo => {
      const badges = this.app.photoManager.generateBadges(photo);
      const photoId = photo.id || photo.public_id || photo.url;
      const stats = this.app.generatePhotoStats(photo);

      return `<div class="cell" data-photo-id="${photoId}">
        <div class="day-grid-selector"></div>
        <img class="openable" data-id="${photoId}" src="${preview(photo.url, 600, 600)}" alt="photo"/>
        ${badges}
        ${stats}
      </div>`;
    }).join('');
    
      // 이벤트 바인딩
      this.bindDayGridCellEvents();

      // 선택 상태 복원
      this.updateDayGridSelections();

      overlay.classList.remove('slide-left', 'slide-right');
      overlay.classList.add('show');
      overlay.setAttribute('aria-hidden', 'false');
      overlay.focus();
  }
  hideDayGrid(direction = 'back') {
    const overlay = $('#dayGridOverlay');
    if (overlay && overlay.contains(document.activeElement)) {
      document.activeElement.blur();
    }
    if (!overlay) return;

    // 스플래시 슬라이드쇼 정지
    this.stopSplashSlideshow();

    if (direction === 'forward') {
      overlay.classList.add('slide-left');
      overlay.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        overlay.classList.remove('show', 'slide-left', 'slide-right');
      }, 300);
    } else {
      overlay.classList.add('no-transition');
      overlay.classList.remove('show', 'slide-left', 'slide-right');
      overlay.setAttribute('aria-hidden', 'true');
      requestAnimationFrame(() => overlay.classList.remove('no-transition'));
    }
    this.exitDayGridMultiSelect();
  }
  bindDayGridCellEvents() {
    const grid = $('#dayGrid');
    if (!grid) return;
    // 다중 요소 순회이므로 $$ 사용
    $$('.cell', grid).forEach(cell => {
      const photoId = cell.dataset.photoId;

      // 클릭 이벤트
      cell.addEventListener('click', (e) => {
        e.preventDefault();

        if (this.dayGridMultiSelectMode) {
          this.toggleDayGridSelection(photoId);
        } else {
          this.app.openPhotoById(photoId, this.dayGridPhotos);
        }
      });
    });
  }
  toggleDayGridMultiSelectMode() {
    if (this.dayGridMultiSelectMode) {
      this.exitDayGridMultiSelect();
    } else {
      this.startDayGridMultiSelect();
    }
  }

  startDayGridMultiSelect() {
    this.dayGridMultiSelectMode = true;
    this.dayGridSelectedPhotos.clear();

    const grid = $('#dayGrid');
    const header = $('#dayGridMultiselectHeader');
    const btn = $('#dayGridMultiselectBtn');

    grid?.classList.add('multiselect-mode');
    header?.classList.add('show');

    if (btn) {
      btn.textContent = '취소';
      btn.classList.add('active');
    }

    this.updateDayGridMultiSelectInfo();
  }
  exitDayGridMultiSelect() {
    this.dayGridMultiSelectMode = false;
    this.dayGridSelectedPhotos.clear();

    const grid = $('#dayGrid');
    const header = $('#dayGridMultiselectHeader');
    const btn = $('#dayGridMultiselectBtn');

    grid?.classList.remove('multiselect-mode');
    header?.classList.remove('show');

    if (btn) {
      btn.textContent = '선택';
      btn.classList.remove('active');
    }

    // 다중 요소 해제이므로 $$ 사용
    $$('.cell.selected', grid).forEach(cell => {
      cell.classList.remove('selected');
    });
  }
  toggleDayGridSelection(photoId) {
    if (this.dayGridSelectedPhotos.has(photoId)) {
      this.dayGridSelectedPhotos.delete(photoId);
    } else {
      this.dayGridSelectedPhotos.add(photoId);
    }
    
    const cell = $(`[data-photo-id="${photoId}"]`);
    cell?.classList.toggle('selected', this.dayGridSelectedPhotos.has(photoId));
    
    this.updateDayGridMultiSelectInfo();
  }
  updateDayGridMultiSelectInfo() {
    const count = this.dayGridSelectedPhotos.size;
    const info = $('#dayGridMultiselectInfo');
    const moveBtn = $('#dayGridMoveToAlbum');
    const deleteBtn = $('#dayGridDeleteSelected');

    if (info) info.textContent = `${count}개 선택됨`;

    if (moveBtn) moveBtn.disabled = count === 0;
    if (deleteBtn) deleteBtn.disabled = count === 0;
  }

  updateDayGridSelections() {
    const grid = $('#dayGrid');
    if (!grid) return;

    // 선택된 사진들의 체크 표시 복원
    this.dayGridSelectedPhotos.forEach(photoId => {
      const cell = $(`[data-photo-id="${photoId}"]`, grid);
      if (cell) {
        cell.classList.add('selected');
      }
    });

    // 다중 선택 모드인 경우 그리드에 클래스 추가
    if (this.dayGridMultiSelectMode) {
      grid.classList.add('multiselect-mode');
      this.updateDayGridMultiSelectInfo();
    }
  }

  setupDayGridSplash(date, dayPhotos) {
    const splashImage = $('#dayGridSplashImage');
    const ddayElement = $('#dayGridDday');
    const dateElement = $('#dayGridDate');

    if (dayPhotos.length === 0) return;

    // 스플래시 데이터 저장
    this.currentSplashPhotos = dayPhotos;
    this.currentSplashIndex = 0;

    // 첫 번째 사진을 스플래시 이미지로 사용
    if (splashImage) {
      splashImage.src = preview(dayPhotos[0].url, 800, 400);
      // 첫 번째 이미지에 페이드 줌 애니메이션 시작
      setTimeout(() => {
        splashImage.classList.add('fade-zoom');
      }, 100);
    }

    // D-Day와 날짜 설정
    if (ddayElement && dateElement) {
      // 타임라인의 calculateDDay 함수 사용
      const ddayText = this.app.calculateDDay(date);

      ddayElement.textContent = ddayText;
      dateElement.textContent = new Date(date + 'T00:00:00').toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // 드롭다운 메뉴 이벤트 바인딩
    this.bindDropdownEvents();

    // 자동 슬라이드쇼 시작 (2초마다)
    this.startSplashSlideshow();
  }

  startSplashSlideshow() {
    // 기존 인터벌 정리
    if (this.splashInterval) {
      clearInterval(this.splashInterval);
    }

    // 사진이 2장 이상일 때만 슬라이드쇼 실행
    if (this.currentSplashPhotos && this.currentSplashPhotos.length > 1) {
      this.splashInterval = setInterval(() => {
        this.changeSplashImage();
      }, 7000); // 7초마다 변경
    }
  }

  changeSplashImage() {
    const splashImage = $('#dayGridSplashImage');
    if (!splashImage || !this.currentSplashPhotos) return;

    // 다음 이미지 인덱스 계산
    this.currentSplashIndex = (this.currentSplashIndex + 1) % this.currentSplashPhotos.length;
    const nextPhoto = this.currentSplashPhotos[this.currentSplashIndex];

    // 새 이미지 미리 로드
    const nextImage = new Image();
    nextImage.onload = () => {
      // 현재 애니메이션 상태와 상관없이 부드럽게 전환 시작
      splashImage.style.transition = 'opacity 2s ease-out, transform 2s ease-out, filter 2s ease-out';

      // 현재 상태에서 자연스럽게 디졸브 시작
      requestAnimationFrame(() => {
        // 모든 애니메이션 클래스 제거
        splashImage.classList.remove('fade-zoom', 'fade-dissolve', 'fade-in');

        // CSS transition으로 부드럽게 페이드아웃
        splashImage.style.opacity = '0';
        splashImage.style.transform = 'scale(1.05)';
        splashImage.style.filter = 'brightness(0.7) contrast(0.8)';
      });

      // 2초 후 새 이미지로 교체
      setTimeout(() => {
        // 이미지 교체
        splashImage.src = preview(nextPhoto.url, 800, 400);

        // 초기 상태로 리셋
        splashImage.style.opacity = '1';
        splashImage.style.transform = 'scale(1)';
        splashImage.style.filter = 'brightness(1) contrast(1)';

        // transition 제거하고 애니메이션으로 복귀
        setTimeout(() => {
          splashImage.style.transition = '';
          splashImage.classList.add('fade-zoom');
        }, 100);
      }, 2000);
    };

    // 새 이미지 로드 시작
    nextImage.src = preview(nextPhoto.url, 800, 400);
  }

  stopSplashSlideshow() {
    if (this.splashInterval) {
      clearInterval(this.splashInterval);
      this.splashInterval = null;
    }

    // 애니메이션 클래스 정리
    const splashImage = $('#dayGridSplashImage');
    if (splashImage) {
      splashImage.classList.remove('fade-zoom', 'fade-out');
    }
  }

  bindDropdownEvents() {
    const menuBtn = $('#dayGridMenuBtn');
    const dropdown = $('#dayGridDropdown');
    const backBtn = $('#dayGridBack');

    // 뒤로 가기 버튼
    if (backBtn) {
      backBtn.onclick = () => this.hideDayGrid();
    }

    // 드롭다운 토글
    if (menuBtn && dropdown) {
      menuBtn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      };

      // 외부 클릭 시 드롭다운 닫기
      document.addEventListener('click', (e) => {
        if (!menuBtn.contains(e.target) && !dropdown.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    // 드롭다운 아이템들
    $('#dropdownAddTag')?.addEventListener('click', () => {
      $('#dayGridDropdown')?.classList.add('hidden');
      this.showAddTagDialog();
    });

    $('#dropdownSelectAll')?.addEventListener('click', () => {
      $('#dayGridDropdown')?.classList.add('hidden');
      this.toggleDayGridMultiSelectMode();
    });

    $('#dropdownDelete')?.addEventListener('click', () => {
      $('#dayGridDropdown')?.classList.add('hidden');
      this.showDeleteAllDialog();
    });
  }

  showAddTagDialog() {
    alert('태그 추가 기능은 아직 구현되지 않았습니다.');
  }

  showDeleteAllDialog() {
    if (confirm('이 날의 모든 사진을 삭제하시겠습니까?')) {
      // TODO: 전체 삭제 로직 구현
      alert('전체 삭제 기능은 아직 구현되지 않았습니다.');
    }
  }

  async moveDayGridSelectedToAlbum() {
    if (this.dayGridSelectedPhotos.size === 0) {
      alert('사진을 먼저 선택해주세요.');
      return;
    }

    if (this.app.config.albums.length === 0) {
      alert('앨범이 없습니다. 설정에서 앨범을 먼저 추가해주세요.');
      return;
    }

    const albumCheckboxes = this.app.config.albums.map(album =>
      `<label style="display:flex; align-items:center; gap:8px; padding:8px; cursor:pointer;">
         <input type="checkbox" value="${album}">
         <span>${album}</span>
       </label>`
    ).join('');

    const modalHtml = `
      <div style="position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:9999;" id="dayGridAlbumSelectModal">
        <div style="background:white; padding:24px; border-radius:16px; max-width:400px; width:90%;">
          <h3>📁 앨범 선택</h3>
          <p>${this.dayGridSelectedPhotos.size}개 사진을 이동할 앨범을 선택하세요</p>
          <div id="dayGridAlbumCheckboxContainer">${albumCheckboxes}</div>
          <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:16px;">
            <button id="cancelDayGridAlbumSelect" class="btn secondary">취소</button>
            <button id="confirmDayGridAlbumSelect" class="btn">이동하기</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const cancelBtn = $('#cancelDayGridAlbumSelect');
    const confirmBtn = $('#confirmDayGridAlbumSelect');

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        const modal = $('#dayGridAlbumSelectModal');
        if (modal) modal.remove();
      };
    }

    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        const checkboxes = $$('#dayGridAlbumCheckboxContainer input[type="checkbox"]:checked');
        const selectedAlbums = Array.from(checkboxes).map(cb => cb.value);

        if (selectedAlbums.length === 0) {
          alert('앨범을 선택해주세요.');
          return;
        }

        try {
          await this.app.movePhotosToAlbums(Array.from(this.dayGridSelectedPhotos), selectedAlbums);
          alert(`${this.dayGridSelectedPhotos.size}개 사진이 선택한 앨범에 추가되었습니다.`);
          const modal = $('#dayGridAlbumSelectModal');
          if (modal) modal.remove();
          this.exitDayGridMultiSelect();
          this.app.renderCurrentView();
        } catch (e) {
          console.error('Day Grid 앨범 이동 오류:', e);
          alert('앨범 이동 중 오류가 발생했습니다: ' + e.message);
        }
      };
    }
  }

  async deleteDayGridSelectedPhotos() {
    if (this.dayGridSelectedPhotos.size === 0) return;

    if (!confirm(`선택한 ${this.dayGridSelectedPhotos.size}개 사진을 정말 삭제하시겠습니까?`)) return;

    try {
      await this.app.deleteMultiplePhotos(Array.from(this.dayGridSelectedPhotos));
      alert(`${this.dayGridSelectedPhotos.size}개 사진이 삭제되었습니다.`);
      this.exitDayGridMultiSelect();
      this.hideDayGrid();
      this.app.load();
    } catch (e) {
      alert('사진 삭제 중 오류가 발생했습니다: ' + e.message);
    }
  }

  // 모달 관리
  hideModal() {
    const modal = $('#modal');
    const video = $('#bigVideo');

    try {
      video?.pause();
    } catch (e) {}

    modal?.classList.remove('show');
    document.body.style.overflow = 'auto';

    // 댓글 모달도 함께 닫기
    this.hideCommentModal();

    // 자동 숨김 타이머 정리
    this.clearModalAutoHideTimer();
  }

  // 모달 드롭다운 토글
  toggleModalDropdown() {
    const dropdown = $('#modalDropdown');
    if (!dropdown) return;

    dropdown.classList.toggle('hidden');

    // 외부 클릭 시 닫기
    if (!dropdown.classList.contains('hidden')) {
      setTimeout(() => {
        document.addEventListener('click', this.closeModalDropdown.bind(this), { once: true });
      }, 0);
    }
  }

  closeModalDropdown() {
    $('#modalDropdown')?.classList.add('hidden');
  }

  // 댓글 창 토글 (기존 함수는 호환성을 위해 유지하되 새 모달로 리디렉션)
  toggleComments() {
    this.showCommentModal();
  }

  // 댓글 창 숨기기
  hideCommentInput() {
    const commentInputContainer = $('.comment-input');
    const commentsSection = $('#modalComments');

    if (commentInputContainer) {
      commentInputContainer.classList.remove('active');
    }

    if (commentsSection) {
      commentsSection.classList.remove('input-active', 'active');
    }

    // 다른 기능들 다시 활성화
    this.enableModalInteractions();
  }

  // 댓글 모달 표시
  showCommentModal() {
    const modal = $('#commentModal');
    const commentList = $('#commentModalList');

    if (!modal || !this.app.modalManager?.currentPhoto) return;

    // 모달 드롭다운 메뉴 닫기
    this.closeModalDropdown();

    // 댓글 로드
    this.loadCommentsToModal(this.app.modalManager.currentPhoto);

    // 모달 표시
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // 입력창 포커스
    setTimeout(() => {
      const input = $('#commentModalInput');
      if (input) input.focus();
    }, 300);
  }

  // 댓글 모달 숨기기
  hideCommentModal() {
    const modal = $('#commentModal');
    if (!modal) return;

    modal.classList.remove('show');
    document.body.style.overflow = 'auto';

    // 입력창 초기화
    const input = $('#commentModalInput');
    if (input) input.value = '';
  }

  // 댓글 모달에 댓글 로드
  loadCommentsToModal(photo) {
    const list = $('#commentModalList');
    if (!list) return;

    list.innerHTML = '';

    if (this.commentUnsub) {
      this.commentUnsub();
      this.commentUnsub = null;
    }

    this.commentUnsub = this.app.storageManager.loadComments(photo, (comments) => {
      list.innerHTML = '';

      if (comments.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 40px; color: #9ca3af;">아직 댓글이 없어요<br/>첫 번째 댓글을 남겨보세요!</div>';
        return;
      }

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

  // 댓글 모달에서 댓글 전송
  submitCommentModal() {
    const input = $('#commentModalInput');
    if (!input || !this.app.modalManager?.currentPhoto) return;

    const text = input.value.trim();
    if (!text) return;

    if (!this.app.currentUser) {
      alert('사용자를 선택하세요');
      return;
    }

    const comment = {
      user: this.app.currentUser,
      text,
      createdAt: Date.now()
    };

    this.app.storageManager.addComment(this.app.modalManager.currentPhoto, comment);

    // 댓글 작성 활동 로그 저장
    this.app.storageManager.saveActivityLog('comment', {
      user: this.app.currentUser,
      photoId: this.app.modalManager.currentPhoto.id || this.app.modalManager.currentPhoto.public_id || this.app.modalManager.currentPhoto.url,
      timestamp: Date.now()
    }).catch(e => console.warn('댓글 활동 로그 저장 실패:', e));

    input.value = '';

    // 타임라인 업데이트 (댓글 카운트 반영)
    if (this.currentTab === 'timeline') {
      this.app.renderTimeline();
    }

    // Day Grid가 열려있다면 업데이트
    this.app.modalManager?.updateDayGridIfOpen();
  }

  // 모달 자동 숨김 기능
  bindModalAutoHide() {
    const modal = $('#modal');
    if (!modal) return;

    // 마우스 움직임 감지
    modal.addEventListener('mousemove', () => this.resetModalAutoHide());
    modal.addEventListener('touchstart', () => this.resetModalAutoHide());
    modal.addEventListener('click', () => this.resetModalAutoHide());
  }

  resetModalAutoHide() {
    const modal = $('#modal');
    if (!modal || !modal.classList.contains('show')) return;

    const topHeader = $('#modalTopHeader');
    const bottomFooter = $('#modalBottomFooter');

    // UI 요소 표시
    topHeader?.classList.remove('auto-hide');
    bottomFooter?.classList.remove('auto-hide');

    // 기존 타이머 정리
    this.clearModalAutoHideTimer();

    // 3초 후 자동 숨김
    this.modalAutoHideTimer = setTimeout(() => {
      topHeader?.classList.add('auto-hide');
      bottomFooter?.classList.add('auto-hide');
    }, 3000);
  }

  clearModalAutoHideTimer() {
    if (this.modalAutoHideTimer) {
      clearTimeout(this.modalAutoHideTimer);
      this.modalAutoHideTimer = null;
    }
  }

  // 모달 인터랙션 비활성화 (댓글창 열렸을 때)
  disableModalInteractions() {
    // 네비게이션 버튼들 비활성화
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
    const modalBackBtn = $('#modalBackBtn');
    const modalMenuBtn = $('#modalMenuBtn');
    const reactionBtns = $$('.reaction');

    if (prevBtn) prevBtn.style.pointerEvents = 'none';
    if (nextBtn) nextBtn.style.pointerEvents = 'none';
    if (modalBackBtn) modalBackBtn.style.pointerEvents = 'none';
    if (modalMenuBtn) modalMenuBtn.style.pointerEvents = 'none';

    // 반응 버튼들 비활성화
    reactionBtns.forEach(btn => {
      if (!btn.classList.contains('comment-toggle')) {
        btn.style.pointerEvents = 'none';
      }
    });

    // 스와이프 이벤트 비활성화
    this.isCommentMode = true;

    // 키보드 이벤트 무시를 위한 플래그 설정
    this.commentModeActive = true;
  }

  // 모달 인터랙션 활성화 (댓글창 닫혔을 때)
  enableModalInteractions() {
    // 네비게이션 버튼들 활성화
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
    const modalBackBtn = $('#modalBackBtn');
    const modalMenuBtn = $('#modalMenuBtn');
    const reactionBtns = $$('.reaction');

    if (prevBtn) prevBtn.style.pointerEvents = 'auto';
    if (nextBtn) nextBtn.style.pointerEvents = 'auto';
    if (modalBackBtn) modalBackBtn.style.pointerEvents = 'auto';
    if (modalMenuBtn) modalMenuBtn.style.pointerEvents = 'auto';

    // 반응 버튼들 활성화
    reactionBtns.forEach(btn => {
      btn.style.pointerEvents = 'auto';
    });

    // 스와이프 이벤트 활성화
    this.isCommentMode = false;

    // 키보드 이벤트 플래그 해제
    this.commentModeActive = false;
  }

  // 중복 사진 관리
  showDuplicateManager() {
    const duplicates = this.app.photoManager.findDuplicatePhotos(this.app.photos);
    
    if (duplicates.length === 0) {
      alert('중복된 사진이 없어요!');
      return;
    }
    
    const modal = $('#duplicateModal');
    const content = $('#duplicateContent');
    
    if (!modal || !content) return;
    
    content.innerHTML = `
      <div style="padding: 20px;">
        <h3>🗂️ 중복 사진 관리 (${duplicates.length}개 그룹)</h3>
        <p>같은 파일명과 크기를 가진 사진들입니다.</p>
        
        <div style="display: flex; gap: 10px; margin: 16px 0;">
          <button id="deleteAllDuplicates" class="btn" style="background: #ef4444;">모든 중복본 삭제</button>
          <button id="closeDuplicateModal" class="btn secondary">닫기</button>
        </div>
        
        <div style="max-height: 400px; overflow-y: auto;">
          ${duplicates.map((dup, i) => `
            <div style="border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>${dup.fileName} (${this.app.photoManager.formatFileSize(dup.fileSize)})</span>
                <button onclick="window.uiManager.deleteDuplicate(${i})" class="btn secondary">중복본 삭제</button>
              </div>
              <div style="display: flex; gap: 10px;">
                <div style="flex: 1; text-align: center;">
                  <div style="margin-bottom: 4px;">원본</div>
                  <img src="${preview(dup.original.url, 150, 150)}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;" />
                </div>
                <div style="flex: 1; text-align: center;">
                  <div style="margin-bottom: 4px;">중복본</div>
                  <img src="${preview(dup.duplicate.url, 150, 150)}" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;" />
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    
    modal.classList.add('show');
    
    $('#deleteAllDuplicates').onclick = () => this.deleteAllDuplicates(duplicates);
    $('#closeDuplicateModal').onclick = () => modal.classList.remove('show');
  }

  async deleteDuplicate(index) {
    const duplicates = this.app.photoManager.findDuplicatePhotos(this.app.photos);
    const dup = duplicates[index];
    
    if (!confirm(`"${dup.fileName}" 중복본을 삭제하시겠습니까?`)) return;
    
    try {
      await this.app.photoManager.deletePhoto(dup.duplicate);
      this.showDuplicateManager(); // 목록 새로고침
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
  }

  async deleteAllDuplicates(duplicates) {
    if (!confirm(`${duplicates.length}개의 중복본을 모두 삭제하시겠습니까?`)) return;
    
    try {
      const duplicatePhotos = duplicates.map(d => d.duplicate);
      await this.app.photoManager.deleteMultiplePhotos(duplicatePhotos);
      
      alert(`${duplicates.length}개의 중복본이 삭제되었습니다.`);
      $('#duplicateModal')?.classList.remove('show');
      this.app.load();
    } catch (e) {
      alert('사진 삭제 중 오류가 발생했습니다: ' + e.message);
    }
  }

  // 설정창에서 접속 로그 로드 및 표시
  async loadAndDisplayActivityLogs() {
    const logs = await this.app.storageManager.loadActivityLogs();
    const container = $('#activityLogsList');
    
    if (!container) return;
    
    // 최근 10개의 로그만 표시
    const recentLogs = logs.slice(0, 10);
    
    if (recentLogs.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:16px; color:#6b7280">접속 로그가 없습니다</div>';
      return;
    }
    
    container.innerHTML = recentLogs.map(log => {
      const actionText = {
        'login': '로그인',
        'upload': '사진 업로드', 
        'comment': '댓글 작성',
        'logout': '로그아웃'
      }[log.action] || log.action;
      
      const date = new Date(log.timestamp);
      const timeStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return `
        <div style="border-bottom:1px solid #e5e7eb; padding:8px 0; font-size:12px;">
          <div style="display:flex; justify-content:space-between;">
            <span><strong>${log.user}</strong> ${actionText}</span>
            <span style="color:#6b7280">${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // 활동 로그 표시
  async showActivityLogs() {
    const logs = await this.app.storageManager.loadActivityLogs();
    
    const modal = $('#activityLogModal');
    const content = $('#activityLogContent');
    
    if (!modal || !content) return;
    
    // 최근 7일간의 로그만 표시
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentLogs = logs.filter(log => new Date(log.timestamp) > weekAgo);
    
    // 사용자별 통계
    const userStats = {};
    recentLogs.forEach(log => {
      if (!userStats[log.user]) {
        userStats[log.user] = { logins: 0, uploads: 0, comments: 0, lastSeen: null };
      }
      
      if (log.action === 'login') userStats[log.user].logins++;
      if (log.action === 'upload') userStats[log.user].uploads++;
      if (log.action === 'comment') userStats[log.user].comments++;
      
      if (!userStats[log.user].lastSeen || new Date(log.timestamp) > new Date(userStats[log.user].lastSeen)) {
        userStats[log.user].lastSeen = log.timestamp;
      }
    });
    
    content.innerHTML = `
      <div style="padding: 20px;">
        <h3>가족 활동 로그 (최근 7일)</h3>
        
        <div style="margin-bottom: 24px;">
          <h4>활동 요약</h4>
          ${Object.entries(userStats).map(([user, stats]) => `
            <div style="background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-bottom: 8px;">
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 600;">${user}</span>
                <span style="font-size: 12px;">
                  ${stats.lastSeen ? new Date(stats.lastSeen).toLocaleDateString() : ''}
                </span>
              </div>
              <div style="font-size: 12px; margin-top: 4px;">
                접속 ${stats.logins}회 • 업로드 ${stats.uploads}개 • 댓글 ${stats.comments}개
              </div>
            </div>
          `).join('')}
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 16px;">
          <h4>상세 활동 로그</h4>
          <button id="closeActivityLog" class="btn secondary">닫기</button>
        </div>
        
        <div style="max-height: 300px; overflow-y: auto;">
          ${recentLogs.length === 0 ? 
            '<div style="text-align: center; padding: 20px;">최근 활동이 없어요</div>' :
            recentLogs.map(log => {
              const actionText = {
                'login': '로그인',
                'upload': '사진 업로드', 
                'comment': '댓글 작성',
                'logout': '로그아웃'
              }[log.action] || log.action;
              
              return `
                <div style="border-bottom: 1px solid var(--border); padding: 8px 0;">
                  <div style="display: flex; justify-content: space-between;">
                    <span><strong>${log.user}</strong> ${actionText}</span>
                    <span style="font-size: 12px;">
                      ${new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              `;
            }).join('')
          }
        </div>
      </div>
    `;
    
    modal.classList.add('show');
    $('#closeActivityLog').onclick = () => modal.classList.remove('show');
  }
  // 일정 캘린더 월 네비게이션
  navigateScheduleMonth(direction) {
    this.scheduleCurrentMonth.setMonth(this.scheduleCurrentMonth.getMonth() + direction);
    this.app.renderScheduleCalendar();
  }

  // 일정 모달 표시
  showScheduleModal(scheduleId = null, defaultDate = null) {
    const modal = $('#scheduleModal');
    const form = $('#scheduleForm');
    const title = $('#scheduleModalTitle');
    const deleteBtn = $('#deleteScheduleBtn');
    
    if (!modal || !form) return;
    
    this.currentEditingSchedule = scheduleId ? this.app.getScheduleById(scheduleId) : null;
    
    // 폼 초기화
    form.reset();
    
    if (this.currentEditingSchedule) {
      // 수정 모드
      title.textContent = '일정 수정';
      deleteBtn.style.display = 'block';
      
      // 기존 데이터 채우기
      $('#scheduleTitle').value = this.currentEditingSchedule.title || '';
      $('#scheduleDate').value = this.currentEditingSchedule.date || '';
      $('#scheduleTime').value = this.currentEditingSchedule.time || '';
      $('#scheduleMemo').value = this.currentEditingSchedule.memo || '';
      
      // 참여자 체크박스 설정
      this.renderParticipantsSelector(this.currentEditingSchedule.participants || []);
    } else {
      // 추가 모드
      title.textContent = '일정 추가';
      deleteBtn.style.display = 'none';
      
      // 기본 날짜 설정
      if (defaultDate) {
        $('#scheduleDate').value = defaultDate;
      }
      
      this.renderParticipantsSelector();
    }
    
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }

  // 참여자 선택기 렌더링
  renderParticipantsSelector(selectedParticipants = []) {
    const container = $('#scheduleParticipants');
    if (!container) return;
    
    const members = this.app.config.members || [];
    
    container.innerHTML = members.map(member => `
      <label class="participant-checkbox">
        <input type="checkbox" value="${member}" ${selectedParticipants.includes(member) ? 'checked' : ''}>
        <span>${member}</span>
      </label>
    `).join('');
  }

  // 일정 모달 숨기기
  hideScheduleModal() {
    const modal = $('#scheduleModal');
    if (!modal) return;
    
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    this.currentEditingSchedule = null;
  }

  // 일정 폼 제출 처리
  async handleScheduleSubmit(e) {
    e.preventDefault();
    
    const title = $('#scheduleTitle').value.trim();
    const date = $('#scheduleDate').value;
    const time = $('#scheduleTime').value;
    const memo = $('#scheduleMemo').value.trim();
    
    if (!title || !date) {
      alert('제목과 날짜는 필수입니다.');
      return;
    }
    
    // 참여자 수집
    const participants = Array.from($$('#scheduleParticipants input[type="checkbox"]:checked'))
      .map(cb => cb.value);
    
    const scheduleData = {
      title,
      date,
      time,
      memo,
      participants,
      createdBy: this.app.currentUser,
      createdAt: Date.now()
    };
    
    try {
      if (this.currentEditingSchedule) {
        // 수정
        await this.app.updateSchedule(this.currentEditingSchedule, scheduleData);
      } else {
        // 추가
        scheduleData.id = Date.now().toString();
        await this.app.saveSchedule(scheduleData);
      }
      
      this.hideScheduleModal();
      alert(this.currentEditingSchedule ? '일정이 수정되었습니다.' : '일정이 추가되었습니다.');
    } catch (error) {
      alert('일정 저장 중 오류가 발생했습니다: ' + error.message);
    }
  }

  // 일정 삭제 처리
  async handleScheduleDelete() {
    if (!this.currentEditingSchedule) return;
    
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;
    
    try {
      await this.app.deleteSchedule(this.currentEditingSchedule);
      this.hideScheduleModal();
      alert('일정이 삭제되었습니다.');
    } catch (error) {
      alert('일정 삭제 중 오류가 발생했습니다: ' + error.message);
    }
  }

  // 주간 표시
  getWeekday(dateString) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateString);
    return days[date.getDay()];
  }
}
// 전역에서 접근 가능하도록
window.uiManager = null;










