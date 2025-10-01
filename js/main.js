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
function setupBackButtonHandler() {
  // 초기 히스토리 상태 추가
  if (window.history.length === 1) {
    window.history.pushState({ page: 'main' }, '', window.location.href);
  }

  // 뒤로가기 버튼 이벤트 처리
  window.addEventListener('popstate', (event) => {
    // 모달이 열려있으면 모달 닫기
    const modal = document.getElementById('modal');
    const dayGridOverlay = document.getElementById('dayGridOverlay');
    const scheduleModal = document.getElementById('scheduleModal');
    const commentModal = document.getElementById('commentModal');
    const duplicateModal = document.getElementById('duplicateModal');

    if (modal && modal.classList.contains('show')) {
      // 모달 매니저의 hideModal 함수 호출
      if (window.app?.modalManager?.hideModal) {
        window.app.modalManager.hideModal();
      } else {
        modal.classList.remove('show');
        document.body.style.overflow = '';
      }
      window.history.pushState({ page: 'main' }, '', window.location.href);
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
      return;
    }

    if (duplicateModal && duplicateModal.classList.contains('show')) {
      duplicateModal.classList.remove('show');
      window.history.pushState({ page: 'main' }, '', window.location.href);
      return;
    }

    // 모든 모달이 닫혀있으면 히스토리 상태 유지
    window.history.pushState({ page: 'main' }, '', window.location.href);
  });
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