import { DEFAULTS, SETUP_DONE_KEY, fmtDate, shuffle, preview } from './utils.js';
import { StorageManager } from './storage-manager.js';
import { PhotoManager } from './photo-manager.js';
import { UIManager } from './ui-manager.js';
import { ModalManager } from './modal-manager.js';

export class App {
  constructor() {
    this.config = null;
    this.currentUser = null;
    this.photos = [];
    this.schedules = [];
    this.loading = true;
    this.currentAlbum = null;
    
    // 매니저들
    this.storageManager = null;
    this.photoManager = null;
    this.uiManager = null;
    this.modalManager = null;
    
    this.init();
  }

  async init() {
    // UI 매니저 초기화 (스플래시 화면 표시)
    this.uiManager = new UIManager(this);
    window.uiManager = this.uiManager; // 전역 접근을 위해
    this.uiManager.showSplashScreen();
    
    // 설정 로드
    await this.loadConfig();
    
    // 매니저들 초기화
    this.storageManager = new StorageManager(this.config);
    this.photoManager = new PhotoManager(this.config, this.storageManager);
    this.modalManager = new ModalManager(this);
    
    // 사용자 복원
    this.currentUser = localStorage.getItem('currentUser') || null;
    if (this.currentUser) {
      this.photoManager.setCurrentUser(this.currentUser);
    }
    
    // UI 초기화
    this.uiManager.renderMembers();
    this.uiManager.renderLoginChips();
    this.uiManager.renderAlbums();
    this.uiManager.applyTheme(this.config.theme);
    this.uiManager.loadAndDisplayActivityLogs();
    
    // 앱 상태 확인
    this.checkAppState();
  }

  // 설정 로드
  async loadConfig() {
    let savedConfig = {};
    try {
      savedConfig = JSON.parse(localStorage.getItem('familyAppConfig') || '{}');
    } catch (e) {
      console.warn('설정 로드 실패:', e);
    }
    
    this.config = {
      firebase: {
        projectId: savedConfig?.firebase?.projectId || DEFAULTS.FIREBASE_PROJECT_ID,
        apiKey: savedConfig?.firebase?.apiKey || DEFAULTS.FIREBASE_API_KEY
      },
      cloudinary: {
        cloudName: savedConfig?.cloudinary?.cloudName || DEFAULTS.CLOUDINARY_CLOUD_NAME,
        uploadPreset: savedConfig?.cloudinary?.uploadPreset || DEFAULTS.CLOUDINARY_UPLOAD_PRESET
      },
      useFirebase: savedConfig?.useFirebase === true,
      members: Array.isArray(savedConfig?.members) && savedConfig.members.length ? 
        savedConfig.members : 
        ["👨‍💼 아빠","👩‍💼 엄마","🌟 우주","👵 할머니","👴 할아버지","👩‍🦰 고모"],
      dday: savedConfig?.dday || '2023-06-26',
      theme: savedConfig?.theme || 'default',
      albums: savedConfig?.albums || ['100일', '첫걸음마', '돌잔치', '어린이집']
    };
    
    // UI에 설정 반영
    const inputs = {
      'fb-project': this.config.firebase.projectId,
      'fb-api': this.config.firebase.apiKey,
      'cld-name': this.config.cloudinary.cloudName,
      'cld-preset': this.config.cloudinary.uploadPreset,
      'ddayInput': this.config.dday
    };
    
    Object.entries(inputs).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
    
    this.saveAppConfig();
  }

  // 앱 설정 저장
  saveAppConfig() {
    localStorage.setItem('familyAppConfig', JSON.stringify(this.config));
  }

  // 설정 저장 (Firebase 사용 여부 결정)
  async saveConfig(useFirebase) {
    const projectId = document.getElementById('fb-project')?.value.trim();
    const apiKey = document.getElementById('fb-api')?.value.trim();
    const cloudName = document.getElementById('cld-name')?.value.trim();
    const preset = document.getElementById('cld-preset')?.value.trim();
    
    if (!cloudName || !preset) {
      this.uiManager.showMessage('Cloudinary 설정은 필수입니다.', false);
      return;
    }
    
    this.config.firebase.projectId = projectId;
    this.config.firebase.apiKey = apiKey;
    this.config.cloudinary.cloudName = cloudName;
    this.config.cloudinary.uploadPreset = preset;
    this.config.useFirebase = !!useFirebase;
    
    this.saveAppConfig();
    localStorage.setItem(SETUP_DONE_KEY, '1');
    
    this.uiManager.showMessage(useFirebase ? '저장됨(Firebase 사용)' : '로컬 모드로 시작');
    this.checkAppState();
  }

  // 앱 상태 확인
  async checkAppState() {
    // 자동으로 설정 완료로 처리
    localStorage.setItem(SETUP_DONE_KEY, '1');
    this.config.useFirebase = true; // 무조건 Firebase 사용
    this.saveAppConfig();
    
    this.uiManager.hideSetup();
    this.loading = true;
    
    if (this.config.useFirebase && this.config.firebase?.projectId && this.config.firebase?.apiKey) {
      try {
        const success = await this.storageManager.initFirebase();
        if (success) {
          this.uiManager.setStatus('online');
          await this.subscribeSharedAlbums();
        } else {
          throw new Error('Firebase 초기화 실패');
        }
      } catch (e) {
        console.warn('Firebase 연결 실패:', e);
        this.config.useFirebase = false;
        this.uiManager.setStatus('offline');
      }
    } else {
      this.config.useFirebase = false;
      this.uiManager.setStatus('offline');
    }
    
    if (this.currentUser) {
      this.showApp();
    } else {
      this.showLogin();
    }
  }

  // 공유 앨범 구독
  async subscribeSharedAlbums() {
    if (!this.config.useFirebase) return;
    
    await this.storageManager.loadSharedAlbums((albums, error) => {
      if (error) {
        console.warn('공유 앨범 로드 실패:', error);
        return;
      }
      
      if (albums && albums.length > 0) {
        this.config.albums = albums;
        this.saveAppConfig();
        this.uiManager.renderAlbums();
      }
    });
  }

  // 로그인/로그아웃
  showLogin() {
    document.getElementById('login')?.classList.remove('hidden');
    document.getElementById('app')?.classList.add('hidden');
  }

  showApp() {
    document.getElementById('login')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('hidden');
    document.getElementById('me').textContent = this.currentUser;
    this.load();
  }

  login(member) {
    this.currentUser = member;
    localStorage.setItem('currentUser', member);
    this.photoManager.setCurrentUser(member);

    // 로그인 활동 로그 저장
    this.storageManager.saveActivityLog('login', {
      user: member,
      timestamp: Date.now()
    }).catch(e => console.warn('로그인 로그 저장 실패:', e));

    this.showApp();
  }

  logout() {
    // 로그아웃 활동 로그 저장
    if (this.currentUser) {
      this.storageManager.saveActivityLog('logout', {
        user: this.currentUser,
        timestamp: Date.now()
      }).catch(e => console.warn('로그아웃 로그 저장 실패:', e));
    }

    this.currentUser = null;
    localStorage.removeItem('currentUser');
    this.photoManager.setCurrentUser(null);
    this.showLogin();
  }

  // 온라인/오프라인 모드 전환
  toggleOnlineMode() {
    this.config.useFirebase = !this.config.useFirebase;
    this.saveAppConfig();
    this.checkAppState();
  }

  // Cloudinary 사용량 로드
  async loadCloudinaryUsage() {
    try {
      const res = await fetch('/.netlify/functions/cloudinary-usage');
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      const total = data.limit || 0;
      const used = data.usage || 0;
      const percent = total ? (used / total) * 100 : 0;

      const fill = document.getElementById('cloudinaryUsageFill');
      const text = document.getElementById('cloudinaryUsageText');

      const format = (bytes) => {
        const units = ['B','KB','MB','GB','TB'];
        let n = bytes;
        let i = 0;
        while (n >= 1024 && i < units.length - 1) {
          n /= 1024;
          i++;
        }
        return `${n.toFixed(1)}${units[i]}`;
      };

      if (fill) fill.style.width = `${percent.toFixed(1)}%`;
      if (text) text.textContent = `${format(used)} / ${format(total)} (${percent.toFixed(1)}%)`;
    } catch (e) {
      console.warn('Cloudinary 사용량 불러오기 실패:', e);
      const text = document.getElementById('cloudinaryUsageText');
      if (text) text.textContent = '사용량 정보를 가져오지 못했습니다';
    }
  }

  // 데이터 로드
  async load() {
    this.loading = true;
    
    // 사진 로드
    await this.storageManager.loadPhotos((photos, error) => {
      if (error) {
        console.error('사진 로드 오류:', error);
        this.uiManager.setStatus('offline');
      } else {
        this.photos = photos;
        this.uiManager.setStatus(this.config.useFirebase ? 'online' : 'offline');
      }
      
      this.loading = false;
      this.renderCurrentView();
      this.checkMemoryOfDay();
      
      // 사진이 로드되었고 스플래시가 아직 보이면 업데이트
      if (photos.length > 0 && !document.getElementById('splashScreen')?.classList.contains('hide')) {
        this.updateSplashWithPhotos();
      }
    });

    // 일정 로드
    await this.storageManager.loadSchedules((schedules, error) => {
      if (error) {
        console.error('일정 로드 오류:', error);
      } else {
        this.schedules = schedules;
        if (this.uiManager.currentTab === 'schedule') {
          this.renderSchedule();
        }
      }
    });
  }

  // 스플래시 화면 사진 업데이트
  updateSplashWithPhotos() {
    if (!this.photos || this.photos.length === 0) return;
    
    const splashImages = document.getElementById('splashImages');
    const splashScreen = document.getElementById('splashScreen');
    
    if (splashScreen && !splashScreen.classList.contains('hide')) {
      console.log('Firebase 사진으로 스플래시 업데이트:', this.photos.length + '개');
      
      const imagesToShow = this.getRandomImages(this.photos, 1);
      
      if (imagesToShow.length > 0) {
        splashImages.innerHTML = imagesToShow.map((src) => 
          `<img class="splash-image" src="${preview(src, 800, 800)}" alt="memory" />`
        ).join('');
        
        splashImages.style.display = 'block';
        this.uiManager.animateSplashImages();
      }
    }
  }

  // 무작위 이미지 선택
  getRandomImages(photos, count) {
    if (!photos || photos.length === 0) return [];
    
    const urls = photos.map(p => p.url || p).filter(url => url);
    const shuffled = shuffle(urls);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  // 작년 오늘 추억 확인
  checkMemoryOfDay() {
    const today = new Date();
    const lastYear = new Date(today);
    lastYear.setFullYear(today.getFullYear() - 1);
    const dateStr = fmtDate(lastYear.toISOString());
    
    const memories = this.photos.filter(photo => {
      const photoDate = photo.dateGroup || fmtDate(photo.uploadedAt || new Date().toISOString());
      return photoDate === dateStr;
    });
    
    if (memories.length > 0) {
      const memoryDay = document.getElementById('memoryDay');
      const grid = document.getElementById('memoryGrid');
      
      if (memoryDay && grid) {
        memoryDay.classList.remove('hidden');
        grid.innerHTML = memories.slice(0, 6).map(photo => {
          const photoId = photo.id || photo.public_id || photo.url;
          return `<div class="memory-thumb openable" data-id="${photoId}">
            <img src="${preview(photo.url, 200, 200)}" alt="memory"/>
          </div>`;
        }).join('');
        
        // 클릭 이벤트 바인딩
        grid.querySelectorAll('.openable').forEach(el => {
          el.onclick = () => this.openPhotoById(el.dataset.id);
        });
      }
    }
  }

  // 현재 뷰 렌더링
  renderCurrentView() {
    this.renderTimeline();
    
    if (this.uiManager.currentTab === 'calendar') {
      this.renderCalendar();
    }
    if (this.uiManager.currentTab === 'albums') {
      this.renderAlbumPhotos();
    }
    if (this.uiManager.currentTab === 'schedule') {
      this.renderSchedule();
    }
  }

  // 타임라인 렌더링
  renderTimeline() {
    const root = document.getElementById('timeline');
    if (!root) return;
    
    if (this.loading) {
      root.innerHTML = Array.from({length: 2}).map(() => `
        <div class="day">
          <div class="card">
            <div class="skel" style="height:20px;width:40%;margin-bottom:10px"></div>
            <div class="skel" style="height:200px"></div>
          </div>
        </div>
      `).join('');
      return;
    }
    
    if (!this.photos || this.photos.length === 0) {
      root.innerHTML = '<div class="card" style="text-align:center; color:#6b7280">아직 사진이 없어요. 오른쪽 아래 ＋ 로 업로드해보세요!</div>';
      return;
    }
    
    const groups = this.groupByDate(this.photos);
    const dates = Object.keys(groups).sort((a, b) => a < b ? 1 : -1);
    
    root.innerHTML = `<div class="timeline">${dates.map(date => {
      const dayPhotos = groups[date];
      const shuffledPhotos = shuffle(dayPhotos);
      const hero = shuffledPhotos[0];
      const extra = shuffledPhotos.slice(1, 5);
      const remaining = shuffledPhotos.length - 1 - extra.length;
      
      // D-Day 계산
      const ddayText = this.calculateDDay(date);
      
      // 앨범 태그
      const allAlbums = new Set();
      dayPhotos.forEach(photo => {
        if (photo.albums) photo.albums.forEach(album => allAlbums.add(album));
      });
      const albumTags = allAlbums.size > 0 ? 
        `<div class="album-tags">${Array.from(allAlbums).map(album => `<span class="album-tag">${album}</span>`).join('')}</div>` : '';
      
      // 타일들 생성 (최대 2개만)
      const tiles = extra.slice(0, 2).map((photo, index) => {
        const badges = this.photoManager.generateBadges(photo);
        const photoId = photo.id || photo.public_id || photo.url;

        // 두 번째 타일(오른쪽 하단)에 오버레이 추가
        let overlay = '';
        if (index === 1 && remaining > 0) {
          // 동영상 감지 함수
          const isVideo = (item) => {
            // resource_type으로 감지
            if (item.resource_type === 'video') return true;

            // URL에서 동영상 확장자 감지 (더 정확한 패턴)
            const url = item.url || item.secure_url || '';
            const videoExtensions = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.3gp', '.flv', '.wmv'];

            // URL 끝부분이나 쿼리 파라미터 전까지 확인
            const urlWithoutQuery = url.split('?')[0];
            if (videoExtensions.some(ext => urlWithoutQuery.toLowerCase().endsWith(ext))) return true;

            // Cloudinary URL에서 /video/ 패턴 감지
            if (url.includes('/video/')) return true;

            // MIME 타입으로 감지
            if (item.format && ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(item.format.toLowerCase())) return true;

            // 추가 속성들 확인
            if (item.type === 'video' || item.mediaType === 'video') return true;

            // 파일명에서 확장자 추출
            const filename = item.original_filename || item.public_id || '';
            if (videoExtensions.some(ext => filename.toLowerCase().includes(ext))) return true;

            return false;
          };

          // 남은 사진과 동영상 개수 계산
          const remainingPhotos = dayPhotos.filter(p => !isVideo(p));
          const remainingVideos = dayPhotos.filter(p => isVideo(p));

          // 이미 표시된 3개 (hero + 2개 타일) 제외
          const photoCount = Math.max(0, remainingPhotos.length - 3);
          const videoCount = remainingVideos.length;

          let overlayText = '';
          if (photoCount > 0 && videoCount > 0) {
            overlayText = `${photoCount}개의 사진+${videoCount}개의 동영상`;
          } else if (photoCount > 0) {
            overlayText = `${photoCount}개의 사진`;
          } else if (videoCount > 0) {
            overlayText = `${videoCount}개의 동영상`;
          }

          if (overlayText) {
            overlay = `<div class="photo-overlay">
                         <div class="overlay-text">${overlayText}</div>
                       </div>`;
          }
        }

        return `<div class="tile open-grid" data-date="${date}" data-id="${photoId}">
          <img src="${preview(photo.url, 300, 300)}" alt="thumb"/>
          ${badges}
          ${overlay}
        </div>`;
      }).join('');
      
      const heroId = hero.id || hero.public_id || hero.url;
      
      return `<div class="day">
        <div class="day-card">
          <div class="day-header">
            <div class="day-header-content">
              <span class="day-indicator"></span>
              <div class="day-date-info">
                <div class="day-date-single">
                  <span class="day-dday">${ddayText}</span>
                  <span class="day-actual-date">${date} (${this.uiManager.getWeekday(date)})</span>
                </div>
              </div>
            </div>
          </div>
          ${albumTags}
          <div class="day-content">
            <div class="hero-tile open-grid" data-date="${date}" data-id="${heroId}">
              <img src="${preview(hero.url, 600, 600)}" alt="대표 이미지"/>
              ${this.photoManager.generateBadges(hero)}
            </div>
            <div class="tile-grid">
              ${tiles}
            </div>
          </div>
        </div>
      </div>`;
    }).join('')}</div>`;
    
    // 이벤트 바인딩
    root.querySelectorAll('.openable').forEach(el => {
      el.onclick = () => this.openPhotoById(el.dataset.id);
    });
    
    root.querySelectorAll('.open-grid').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (date) this.uiManager.showDayGrid(date);
      });
    });
    
    root.querySelectorAll('.more-tile').forEach(el => {
      el.addEventListener('click', () => {
        const date = el.dataset.date;
        if (date) this.uiManager.showDayGrid(date);
      });
    });
  }

  // D-Day 계산
  calculateDDay(date) {
    const targetDate = new Date(date);
    const baseDate = new Date(this.config.dday || '2023-06-26');

    if (targetDate >= baseDate) {
      // 아기 개월수 계산
      let years = targetDate.getFullYear() - baseDate.getFullYear();
      let months = targetDate.getMonth() - baseDate.getMonth();
      let days = targetDate.getDate() - baseDate.getDate() + 1; // 하루 추가

      if (days < 0) {
        months--;
        const prevMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 0);
        days += prevMonth.getDate();
      }

      if (months < 0) {
        years--;
        months += 12;
      }

      const totalMonths = years * 12 + months;
      return totalMonths > 0 ? `${totalMonths}개월 ${days}일` : `${days}일`;
    } else {
      // 미래 날짜
      const diffTime = baseDate.getTime() - targetDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return `D-${diffDays}`;
    }
  }

  // 날짜별 그룹화
  groupByDate(photos) {
    const photosWithDate = photos.map(photo => ({
      ...photo,
      dateGroup: photo.dateGroup || fmtDate(photo.uploadedAt || new Date().toISOString())
    }));
    
    return photosWithDate.reduce((acc, photo) => {
      (acc[photo.dateGroup] = acc[photo.dateGroup] || []).push(photo);
      return acc;
    }, {});
  }

  // 특정 날짜의 사진들 가져오기
  getPhotosByDate(date) {
    const groups = this.groupByDate(this.photos);
    return groups[date] || [];
  }

  // 캘린더 렌더링
  renderCalendar() {
    const grid = document.getElementById('calGrid');
    const title = document.getElementById('calTitle');
    
    if (!grid || !title) return;
    
    grid.innerHTML = '';
    
    // 안전한 날짜 처리
    let year, month;
    if (this.uiManager.currentMonth && this.uiManager.currentMonth instanceof Date) {
      year = this.uiManager.currentMonth.getFullYear();
      month = this.uiManager.currentMonth.getMonth();
    } else {
      const now = new Date();
      year = now.getFullYear();
      month = now.getMonth();
      this.uiManager.currentMonth = new Date(year, month, 1);
    }

    const date = new Date(year, month, 1);
    title.textContent = `${year}년 ${month + 1}월`;
    
    const startDay = date.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // 빈 셀들
    for (let i = 0; i < startDay; i++) {
      const cell = document.createElement('div');
      cell.className = 'cell empty';
      grid.appendChild(cell);
    }
    
    // 실제 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const cell = document.createElement('div');
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const firstPhoto = this.photos.find(photo => {
        const photoDate = photo.dateGroup || fmtDate(photo.uploadedAt || new Date().toISOString());
        return photoDate === dateStr;
      });
      
      cell.dataset.date = dateStr;
      
      if (firstPhoto) {
        cell.className = 'cell has-photo openable';
        cell.dataset.id = firstPhoto.id || firstPhoto.public_id || firstPhoto.url;
        cell.innerHTML = `<div class="d">${day}</div><img class="full" src="${preview(firstPhoto.url, 400, 400)}" alt="thumb" />`;
        cell.onclick = () => this.openPhotoById(cell.dataset.id);
      } else {
        cell.className = 'cell empty';
        cell.innerHTML = `
          <div class="d">${day}</div>
          <svg class="upload-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7,10 12,15 17,10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        `;
      }
      
      grid.appendChild(cell);
    }
  }

  // 앨범 필터링
  filterByAlbum(album) {
    this.currentAlbum = album;
    document.querySelectorAll('#albumFilter .album-item').forEach(el => {
      el.classList.toggle('active', el.dataset.album === album);
    });
    this.renderAlbumPhotos();
  }

  // 앨범 사진 렌더링
  renderAlbumPhotos() {
    const container = document.getElementById('albumPhotos');
    if (!container) return;
    
    let photos = this.photos;
    if (this.currentAlbum && this.currentAlbum !== 'all') {
      photos = photos.filter(photo => photo.albums && photo.albums.includes(this.currentAlbum));
    }
    
    if (photos.length === 0) {
      container.innerHTML = '<div class="card" style="text-align:center">이 앨범에는 아직 사진이 없어요</div>';
      return;
    }
    
    const photoHtml = photos.map(photo => {
      const photoId = photo.id || photo.public_id || photo.url;
      const isSelected = this.uiManager.selectedPhotos.has(photoId);
      
      return `<div class="photo-container ${this.uiManager.isMultiSelectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}" 
                   data-photo-id="${photoId}" 
                   ${this.uiManager.isMultiSelectMode ? 
                     `onclick="window.uiManager.selectPhoto('${photoId}')"` : 
                     `onclick="window.app.openPhotoById('${photoId}')"`}>
                ${this.uiManager.isMultiSelectMode ? '<div class="photo-selector"></div>' : ''}
                <img src="${preview(photo.url, 300, 300)}" alt="photo" 
                     style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:12px; cursor:pointer; transition:transform 0.2s ease;"/>
              </div>`;
    }).join('');
    
    container.innerHTML = `<div class="masonry">${photoHtml}</div>`;
    
    this.uiManager.updateMultiSelectInfo();
  }

  // 사진 열기
  openPhotoById(id, photoList = this.photos) {
    const photo = photoList.find(p => (p.id || p.public_id) === id || p.url === id);
    if (photo && this.modalManager) {
      this.modalManager.showModal(photo, photoList);
    }
  }

  // 다중 사진을 앨범으로 이동
  async movePhotosToAlbums(photoIds, albumNames) {
    for (const photoId of photoIds) {
      const photo = this.photos.find(p => (p.id || p.public_id || p.url) === photoId);
      if (!photo) continue;
      
      if (!photo.albums) photo.albums = [];
      
      albumNames.forEach(albumName => {
        if (!photo.albums.includes(albumName)) {
          photo.albums.push(albumName);
        }
      });
      
      await this.storageManager.updatePhoto(photo, { albums: photo.albums });
    }
  }

  // 다중 사진 삭제
  async deleteMultiplePhotos(photoIds) {
    const photos = photoIds.map(id => 
      this.photos.find(p => (p.id || p.public_id || p.url) === id)
    ).filter(Boolean);
    
    await this.photoManager.deleteMultiplePhotos(photos);
  }

  // 일정 렌더링
  renderSchedule() {
    const calGrid = document.getElementById('scheduleCalGrid');
    const calTitle = document.getElementById('scheduleCalTitle');
    const todayList = document.getElementById('todaySchedules');
    const upcomingList = document.getElementById('upcomingSchedules');

    if (!calGrid || !calTitle || !todayList || !upcomingList) return;

    // 캘린더 렌더링
    this.renderScheduleCalendar();

    // 오늘의 일정 렌더링
    this.renderTodaySchedules();

    // 예정된 일정 렌더링
    this.renderUpcomingSchedules();
  }

  // 일정 캘린더 렌더링
  renderScheduleCalendar() {
    const calGrid = document.getElementById('scheduleCalGrid');
    const calTitle = document.getElementById('scheduleCalTitle');
    
    if (!calGrid || !calTitle) return;
    
    const currentMonth = this.uiManager.scheduleCurrentMonth || new Date();
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    calTitle.textContent = `${year}년 ${month + 1}월`;
    
    const startDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    let html = '';
    
    // 요일 헤더
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    html += '<div class="schedule-cal-days">';
    dayNames.forEach(day => {
      html += `<div class="schedule-cal-day-header">${day}</div>`;
    });
    html += '</div>';
    
    html += '<div class="schedule-cal-body">';
    
    // 빈 셀들
    for (let i = 0; i < startDay; i++) {
      html += '<div class="schedule-cal-cell empty"></div>';
    }
    
    // 실제 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const daySchedules = this.schedules.filter(s => s.date === dateStr);
      
      html += `<div class="schedule-cal-cell" data-date="${dateStr}">
        <div class="schedule-cal-date">${day}</div>
        <div class="schedule-cal-events">
          ${daySchedules.slice(0, 2).map(schedule => 
            `<div class="schedule-cal-event" title="${schedule.title}">
              ${schedule.title.length > 6 ? schedule.title.substring(0, 6) + '...' : schedule.title}
            </div>`
          ).join('')}
          ${daySchedules.length > 2 ? `<div class="schedule-cal-more">+${daySchedules.length - 2}</div>` : ''}
        </div>
      </div>`;
    }
    
    html += '</div>';
    calGrid.innerHTML = html;
    
    // 날짜 클릭 이벤트
    calGrid.querySelectorAll('.schedule-cal-cell[data-date]').forEach(cell => {
      cell.addEventListener('click', () => {
        const date = cell.dataset.date;
        this.uiManager.showScheduleModal(null, date);
      });
    });
  }

  // 오늘의 일정 렌더링
  renderTodaySchedules() {
    const container = document.getElementById('todaySchedules');
    if (!container) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD 형식

    const todaySchedules = this.schedules
      .filter(schedule => schedule.date === todayStr)
      .sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

    if (todaySchedules.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280">오늘 일정이 없습니다</div>';
      return;
    }

    container.innerHTML = todaySchedules.map(schedule => {
      return `
        <div class="today-schedule-item" onclick="window.app.uiManager.showScheduleModal('${schedule.docId || schedule.id}')">
          <div class="today-schedule-content">
            <div class="today-schedule-title">${schedule.title}</div>
            ${schedule.time ? `<div class="today-schedule-time">⏰ ${schedule.time}</div>` : '<div class="today-schedule-time">⏰ 시간 미정</div>'}
            ${schedule.participants && schedule.participants.length > 0 ?
              `<div class="today-schedule-participants">👥 ${schedule.participants.join(', ')}</div>` : ''}
            ${schedule.memo ? `<div class="today-schedule-memo">📝 ${schedule.memo}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 예정된 일정 렌더링 (오늘 제외)
  renderUpcomingSchedules() {
    const container = document.getElementById('upcomingSchedules');
    if (!container) return;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingSchedules = this.schedules
      .filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return schedule.date !== todayStr && scheduleDate > today && scheduleDate <= nextWeek;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcomingSchedules.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#6b7280">예정된 일정이 없습니다</div>';
      return;
    }

    container.innerHTML = upcomingSchedules.map(schedule => {
      const date = new Date(schedule.date);
      const dateStr = date.toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
        weekday: 'short'
      });

      return `
        <div class="upcoming-schedule-item" onclick="window.app.uiManager.showScheduleModal('${schedule.docId || schedule.id}')">
          <div class="upcoming-schedule-date">${dateStr}</div>
          <div class="upcoming-schedule-content">
            <div class="upcoming-schedule-title">${schedule.title}</div>
            ${schedule.time ? `<div class="upcoming-schedule-time">${schedule.time}</div>` : ''}
            ${schedule.participants && schedule.participants.length > 0 ?
              `<div class="upcoming-schedule-participants">${schedule.participants.join(', ')}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // 일정 저장
  async saveSchedule(scheduleData) {
    try {
      await this.storageManager.saveSchedule(scheduleData);
      // 일정 목록 새로고침
      this.load();
    } catch (error) {
      console.error('일정 저장 오류:', error);
      throw error;
    }
  }

  // 일정 업데이트
  async updateSchedule(schedule, updates) {
    try {
      await this.storageManager.updateSchedule(schedule, updates);
      // 일정 목록 새로고침
      this.load();
    } catch (error) {
      console.error('일정 업데이트 오류:', error);
      throw error;
    }
  }

  // 일정 삭제
  async deleteSchedule(schedule) {
    try {
      await this.storageManager.deleteSchedule(schedule);
      // 일정 목록 새로고침
      this.load();
    } catch (error) {
      console.error('일정 삭제 오류:', error);
      throw error;
    }
  }

  // ID로 일정 찾기
  getScheduleById(id) {
    return this.schedules.find(s => (s.docId || s.id) === id);
  }
}

// 전역에서 접근 가능하도록
window.app = null;