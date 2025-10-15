import { App } from './app.js';
import './utils.js';
import './ui-manager.js';
import './photo-manager.js';
import './storage-manager.js';
import './app.js';


// PWA 서비스 워커 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' })
      .then(() => console.log('서비스 워커 등록 성공'))
      .catch(err => console.error('서비스 워커 등록 실패', err));
  });
}

// HTTPS 체크
if (location.protocol === 'file:') {
  alert('HTTPS에서 열어주세요 (Netlify 권장)');
}

// 갤럭시폰 뒤로가기 버튼 처리
let lastBackPressTime = 0;
const BACK_PRESS_INTERVAL = 2000; // 2초
let historyInitialized = false;

function setupBackButtonHandler() {
  // 초기 히스토리 상태 추가 (중복 방지)
  if (!historyInitialized) {
    window.history.pushState({ page: 'main' }, '', window.location.href);
    historyInitialized = true;
    console.log('✅ 히스토리 초기화 완료');
  }

  // 뒤로가기 버튼 이벤트 처리
  window.addEventListener('popstate', (event) => {
    console.log('🔙 뒤로가기 버튼 감지');
    // 모달이 열려있으면 모달 닫기
    const modal = document.getElementById('modal');
    const dayGridOverlay = document.getElementById('dayGridOverlay');
    const scheduleModal = document.getElementById('scheduleModal');
    const commentModal = document.getElementById('commentModal');
    const duplicateModal = document.getElementById('duplicateModal');
    const growthModal = document.getElementById('growthModal');

    if (modal && modal.classList.contains('show')) {
      // 모달 매니저의 hideModal 함수 호출
      if (window.app?.modalManager?.hideModal) {
        window.app.modalManager.hideModal();
      } else {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    if (dayGridOverlay && dayGridOverlay.classList.contains('show')) {
      // UI 매니저의 hideDayGrid 함수 호출
      if (window.app?.uiManager?.hideDayGrid) {
        window.app.uiManager.hideDayGrid();
      } else {
        dayGridOverlay.classList.remove('show');
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    if (scheduleModal && scheduleModal.classList.contains('show')) {
      // UI 매니저의 hideScheduleModal 함수 호출
      if (window.app?.uiManager?.hideScheduleModal) {
        window.app.uiManager.hideScheduleModal();
      } else {
        scheduleModal.classList.remove('show');
        document.body.style.overflow = '';
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    if (commentModal && commentModal.classList.contains('show')) {
      // UI 매니저의 hideCommentModal 함수 호출
      if (window.app?.uiManager?.hideCommentModal) {
        window.app.uiManager.hideCommentModal();
      } else {
        commentModal.classList.remove('show');
        document.body.style.overflow = '';
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    if (duplicateModal && duplicateModal.classList.contains('show')) {
      duplicateModal.classList.remove('show');
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    if (growthModal && growthModal.classList.contains('show')) {
      // 성장일지 매니저의 hideGrowthModal 함수 호출
      if (window.app?.growthManager?.hideGrowthModal) {
        window.app.growthManager.hideGrowthModal();
      } else {
        growthModal.classList.remove('show');
        document.body.style.overflow = '';
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
      lastBackPressTime = 0; // 모달 닫을 때 타이머 리셋
      return;
    }

    // 모든 모달이 닫혀있으면 앱 종료 확인
    const currentTime = Date.now();
    if (currentTime - lastBackPressTime < BACK_PRESS_INTERVAL) {
      // 2초 내에 다시 뒤로가기 누름 - 앱 종료
      console.log('🚪 앱 종료 시도');
      window.close();
      // window.close()가 동작하지 않을 경우를 대비
      if (!window.closed) {
        // 히스토리를 모두 지우고 about:blank로 이동
        window.location.href = 'about:blank';
      }
      lastBackPressTime = 0;
    } else {
      // 첫 번째 뒤로가기 - 토스트 메시지 표시
      console.log('⚠️ 종료 경고 표시');
      lastBackPressTime = currentTime;
      showExitToast();
      // 히스토리 상태 복원
      window.history.pushState({ page: 'main' }, '', window.location.href);
    }
  });
}

// 페이지 로드/새로고침 시 히스토리 재설정
window.addEventListener('pageshow', (event) => {
  if (event.persisted || performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    console.log('📄 페이지 재로드 감지 - 히스토리 리셋');
    historyInitialized = false;
    lastBackPressTime = 0;
    setupBackButtonHandler();
  }
});

// 종료 안내 토스트 메시지 표시
function showExitToast() {
  // 기존 토스트가 있으면 제거
  const existingToast = document.getElementById('exitToast');
  if (existingToast) {
    existingToast.remove();
  }

  // 새 토스트 생성
  const toast = document.createElement('div');
  toast.id = 'exitToast';
  toast.textContent = '뒤로 버튼을 한 번 더 누르면 종료됩니다';
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 24px;
    font-size: 14px;
    z-index: 10000;
    animation: fadeInOut 2s ease-in-out;
  `;

  // 애니메이션 스타일 추가
  if (!document.getElementById('toastAnimation')) {
    const style = document.createElement('style');
    style.id = 'toastAnimation';
    style.textContent = `
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
        10% { opacity: 1; transform: translateX(-50%) translateY(0); }
        90% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(10px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // 2초 후 제거
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.remove();
    }
  }, 2000);
}

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 우주성장일지 v4.1 초기화 중...');

  // 갤럭시폰 뒤로가기 버튼 처리 설정
  setupBackButtonHandler();

  // 전역 앱 인스턴스 생성
  window.app = new App();

  console.log('✅ 앱 초기화 완료!');
});