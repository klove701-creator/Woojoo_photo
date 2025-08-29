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

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
  console.log('🌟 우주성장일지 v4.1 초기화 중...');
  
  // 전역 앱 인스턴스 생성
  window.app = new App();
  
  console.log('✅ 앱 초기화 완료!');
});