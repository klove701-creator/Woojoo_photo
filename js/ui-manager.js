import { $, $$, getRandomImages, shuffle, fmtDate, preview } from './utils.js';

export class UIManager {
  constructor(app) {
    this.app = app;
    this.currentTab = 'timeline';
    this.currentMonth = new Date();
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

    this.bindEvents();
  }

  // 이벤트 바인딩
  bindEvents() {
    // 설정 관련
    $('#save')?.addEventListener('click', () => this.app.saveConfig(true));
    $('#skip')?.addEventListener('click', () => this.app.saveConfig(false));
    $('#openSetup')?.addEventListener('click', () => this.showSetup());

    // 인증 관련
    $('#logout')?.addEventListener('click', () => this.app.logout());

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

    // 모달 관련
    $('#closeBtn')?.addEventListener('click', () => this.hideModal());
    $('#prevBtn')?.addEventListener('click', () => this.app.modalManager?.prev());
    $('#nextBtn')?.addEventListener('click', () => this.app.modalManager?.next());
    $('#delBtn')?.addEventListener('click', () => this.app.modalManager?.deleteCurrent());

    // 캘린더 관련
    $('#prevM')?.addEventListener('click', () => this.navigateMonth(-1));
    $('#nextM')?.addEventListener('click', () => this.navigateMonth(1));
    $('#calTitle')?.addEventListener('click', () => this.showYearPicker());

    // 댓글 관련
    $('#commentSend')?.addEventListener('click', () => this.app.modalManager?.submitComment());
    $('#commentInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.app.modalManager?.submitComment();
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
  }

  // 키보드 이벤트
  bindKeyboardEvents() {
    window.addEventListener('keydown', (e) => {
      const modal = $('#modal');
      if (!modal || !modal.classList.contains('show')) return;
      if (e.key === 'ArrowRight') this.app.modalManager?.next();
      if (e.key === 'ArrowLeft') this.app.modalManager?.prev();
      if (e.key === 'Escape') this.hideModal();
    });
  }

  // 스와이프 이벤트
  bindSwipeEvents() {
    // 모달 스와이프
    const modalViewer = $('#modalViewer');
    modalViewer?.addEventListener('touchstart', (e) => this.handleTouchStart(e, 'modal'), {passive: true});
    modalViewer?.addEventListener('touchmove', (e) => this.handleTouchMove(e, 'modal'), {passive: true});
    modalViewer?.addEventListener('touchend', (e) => this.handleTouchEnd(e, 'modal'), {passive: true});
    
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

  handleTouchEnd(e, type) {
    if (this.isSwipeProcessing) return;
    
    const deltaX = e.changedTouches[0].clientX - this.swipeStartX;
    const deltaY = e.changedTouches[0].clientY - this.swipeStartY;
    
    // 세로 스크롤이 우선이면 스와이프 무시
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    
    if (Math.abs(deltaX) > this.swipeThreshold) {
      this.isSwipeProcessing = true;
      
      if (type === 'modal') {
        if (deltaX > 0) {
          this.app.modalManager?.prev();
        } else {
          this.app.modalManager?.next();
        }
      } else if (type === 'tab') {
        const tabs = ['timeline', 'calendar', 'albums'];
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
  }

  // 파일 업로드 처리
  async handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    await this.app.photoManager.handleFiles(files);
    event.target.value = ''; // 같은 파일 재선택 가능하도록
    this.app.renderCurrentView();
  }

  // 설정 표시/숨기기
  showSetup() {
    $('#setup')?.classList.remove('hidden');
  }

  hideSetup() {
    $('#setup')?.classList.add('hidden');
  }

  // 탭 전환
  showTab(tab) {
    const tabs = ['timeline', 'calendar', 'albums'];
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
    if (this.selectedPhotos.size === 0) return;
    
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
    
    $('#cancelAlbumSelect').onclick = () => {
      $('#albumSelectModal')?.remove();
    };
    
    $('#confirmAlbumSelect').onclick = async () => {
      const checkboxes = $$('#albumCheckboxContainer input[type="checkbox"]:checked');
      const selectedAlbums = checkboxes.map(cb => cb.value);
      
      if (selectedAlbums.length === 0) {
        alert('앨범을 선택해주세요.');
        return;
      }
      
      try {
        await this.app.movePhotosToAlbums(Array.from(this.selectedPhotos), selectedAlbums);
        alert(`${this.selectedPhotos.size}개 사진이 선택한 앨범에 추가되었습니다.`);
        $('#albumSelectModal')?.remove();
        this.exitMultiSelectMode();
        this.app.renderCurrentView();
      } catch (e) {
        alert('앨범 이동 중 오류가 발생했습니다: ' + e.message);
      }
    };
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
    this.dayGridMultiSelectMode = false;
    this.dayGridSelectedPhotos.clear();

    const dayPhotos = this.app.getPhotosByDate(date);
    
    if (title) title.textContent = date;
    if (count) count.textContent = `${dayPhotos.length}장`;
    
    const shuffledPhotos = shuffle(dayPhotos);
    
    grid.innerHTML = shuffledPhotos.map(photo => {
      const badges = this.app.photoManager.generateBadges(photo);
      const photoId = photo.id || photo.public_id || photo.url;
      
      return `<div class="cell" data-photo-id="${photoId}">
        <div class="day-grid-selector"></div>
        <img class="openable" data-id="${photoId}" src="${preview(photo.url, 600, 600)}" alt="photo"/>
        ${badges}
      </div>`;
    }).join('');
    
    // 이벤트 바인딩
    this.bindDayGridCellEvents();
    
    overlay.classList.add('show');
  }

  hideDayGrid() {
    const overlay = $('#dayGridOverlay');
    overlay?.classList.remove('show');
    
    this.exitDayGridMultiSelect();
  }

  bindDayGridCellEvents() {
    const grid = $('#dayGrid');
    if (!grid) return;

    // 다중 요소 순회이므로 $$ 사용
    $$('.cell', grid).forEach(cell => {
      const photoId = cell.dataset.photoId;
      let longPressTimer;

      // 터치 시작 (꾹 누르기)
      cell.addEventListener('touchstart', () => {
        if (this.dayGridMultiSelectMode) return;
        
        longPressTimer = setTimeout(() => {
          this.startDayGridMultiSelect();
          this.toggleDayGridSelection(photoId);
          navigator.vibrate?.(100);
        }, 1000);
      }, {passive: true});

      cell.addEventListener('touchend', () => {
        clearTimeout(longPressTimer);
      }, {passive: true});

      cell.addEventListener('touchcancel', () => {
        clearTimeout(longPressTimer);
      }, {passive: true});

      // 클릭 이벤트
      cell.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (this.dayGridMultiSelectMode) {
          this.toggleDayGridSelection(photoId);
        } else {
          this.hideDayGrid();
          setTimeout(() => this.app.openPhotoById(photoId), 50);
        }
      });
    });
  }

  startDayGridMultiSelect() {
    this.dayGridMultiSelectMode = true;
    const grid = $('#dayGrid');
    const header = $('#dayGridMultiselectHeader');
    
    grid?.classList.add('multiselect-mode');
    header?.classList.add('show');
    
    this.updateDayGridMultiSelectInfo();
  }

  exitDayGridMultiSelect() {
    this.dayGridMultiSelectMode = false;
    this.dayGridSelectedPhotos.clear();
    
    const grid = $('#dayGrid');
    const header = $('#dayGridMultiselectHeader');
    
    grid?.classList.remove('multiselect-mode');
    header?.classList.remove('show');
    
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

  // 모달 관리
  hideModal() {
    const modal = $('#modal');
    const video = $('#bigVideo');
    
    try {
      video?.pause();
    } catch (e) {}
    
    modal?.classList.remove('show');
    document.body.style.overflow = 'auto';
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
    } catch (error) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
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

  // 주간 표시
  getWeekday(dateString) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const date = new Date(dateString);
    return days[date.getDay()];
  }
}

// 전역에서 접근 가능하도록
window.uiManager = null;
