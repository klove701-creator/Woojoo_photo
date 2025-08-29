// 기본 설정 상수들
export const DEFAULTS = {
  FIREBASE_PROJECT_ID: "woojoo-fam-87e33",
  FIREBASE_API_KEY: "AIzaSyByFOUQIZTQI-idsLxI4nprciukooMlLcI",
  CLOUDINARY_CLOUD_NAME: "dawj0jy9t",
  CLOUDINARY_UPLOAD_PRESET: "woojoo_fam"
};

export const SETUP_DONE_KEY = 'familyAppConfigured';

// 날짜 유틸리티 함수들
export const fmtDate = iso => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const folderFor = iso => {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${dd}`;
};

// 이미지/비디오 유틸리티
export const optimize = (url, w, h) => 
  (url && url.includes('cloudinary.com')) ? 
    url.replace('/upload/', '/upload/w_' + w + ',h_' + h + ',c_fill,f_auto,q_auto/') : 
    url;

export const isVideoUrl = url => 
  typeof url === 'string' && (url.includes('/video/upload/') || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(url));

export const videoThumb = (url, w, h) => {
  try {
    if (!isVideoUrl(url)) return url;
    if (url.includes('/video/upload/')) {
      let u = url.replace('/video/upload/', `/video/upload/so_1,w_${w},h_${h},c_fill,f_jpg,q_auto/`);
      u = u.replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg$2');
      return u;
    }
    return url;
  } catch (e) {
    return url;
  }
};

export const preview = (url, w, h) => isVideoUrl(url) ? videoThumb(url, w, h) : optimize(url, w, h);

// 파일 타입 검사
export const isImgType = (t = '') => t.startsWith('image/');
export const isVidType = (t = '') => t.startsWith('video/');

// 파일 객체 검사
export const isImageFile = (file) => {
  if (!file) return false;
  const type = file.type || '';
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();

  // 이미지 확장자 우선 확인
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];
  if (imageExts.includes(ext)) return true;

  if (isImgType(type)) return true;
  return false;
};

export const isVideoFile = (file) => {
  if (!file) return false;
  const type = file.type || '';
  const name = file.name || '';
  const ext = name.split('.').pop().toLowerCase();

  // 이미지 확장자는 명시적으로 제외
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp'];
  if (imageExts.includes(ext)) return false;
  if (isImgType(type)) return false;

  const videoExts = ['mp4', 'mov', 'webm', 'm4v'];
  if (videoExts.includes(ext)) return true;
  if (isVidType(type)) return true;

  return false;
};

// 파일명 유틸리티
export const getBaseName = (name = '') => name.replace(/\.[^.]+$/, '').toLowerCase();

// Cloudinary Public ID 추출
export const derivePublicIdFromUrl = (url = '') => {
  try {
    if (!url.includes('/upload/')) return null;
    let tail = url.split('/upload/')[1].split('?')[0];
    tail = tail.replace(/\.[a-z0-9]+$/i, '');
    const m = tail.match(/\/v\d+\//);
    if (m) {
      tail = tail.split(m[0])[1];
    }
    return tail || null;
  } catch (e) {
    return null;
  }
};

// Fisher–Yates shuffle (non-destructive)
export const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    let r = Math.random();
    if (window.crypto?.getRandomValues) {
      const u32 = new Uint32Array(1);
      window.crypto.getRandomValues(u32);
      r = (u32[0] / 2**32);
    }
    const j = Math.floor(r * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 무작위로 사진 선택하는 헬퍼 함수
export const getRandomImages = (photos, count) => {
  if (!photos || photos.length === 0) return [];
  
  // 사진 객체들에서 URL만 추출
  const urls = photos.map(p => p.url || p).filter(url => url);
  
  // 섞기
  const shuffled = shuffle(urls);
  
  // 요청된 개수만큼 반환
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

// EXIF 데이터에서 촬영일시 추출 함수
export const getExifDate = async (file) => {
  return new Promise((resolve) => {
    try {
      if (!isImageFile(file)) {
        resolve(null);
        return;
      }

      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const view = new DataView(e.target.result);
          
          // JPEG 파일인지 확인
          if (view.getUint16(0) !== 0xFFD8) {
            resolve(null);
            return;
          }

          let offset = 2;
          let marker;
          
          // EXIF 데이터 찾기
          while (offset < view.byteLength) {
            marker = view.getUint16(offset);
            if (marker === 0xFFE1) {
              // EXIF 세그먼트 발견
              const exifLength = view.getUint16(offset + 2);
              const exifData = new DataView(e.target.result, offset + 4, exifLength - 2);
              
              // "Exif" 문자열 확인
              if (exifData.getUint32(0) === 0x45786966) {
                const dateTime = extractDateTimeFromExif(exifData);
                resolve(dateTime);
                return;
              }
            }
            offset += 2 + view.getUint16(offset + 2);
          }
          
          resolve(null);
        } catch (error) {
          console.log('EXIF 파싱 오류:', error);
          resolve(null);
        }
      };
      
      reader.onerror = () => resolve(null);
      reader.readAsArrayBuffer(file.slice(0, 65536)); // 처음 64KB만 읽기
    } catch (error) {
      console.log('EXIF 읽기 오류:', error);
      resolve(null);
    }
  });
};

// EXIF DateTime 추출
export const extractDateTimeFromExif = (exifData) => {
  try {
    // 간단한 EXIF DateTime 태그 검색 (0x0132 또는 0x9003)
    // 실제로는 더 복잡한 파싱이 필요하지만, 기본적인 구현
    const dataStr = new TextDecoder().decode(exifData.buffer);
    
    // DateTime 패턴 찾기 (YYYY:MM:DD HH:MM:SS 형식)
    const datePattern = /(\d{4}):(\d{2}):(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/;
    const match = dataStr.match(datePattern);
    
    if (match) {
      const [, year, month, day, hour, minute, second] = match;
      return new Date(year, month - 1, day, hour, minute, second);
    }
    
    return null;
  } catch (error) {
    console.log('DateTime 추출 오류:', error);
    return null;
  }
};

// 동영상 파일에서 실제 길이 가져오기
export const getVideoFileDuration = (file) => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    
    video.onloadedmetadata = () => {
      const duration = video.duration;
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      resolve(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    };
    
    video.onerror = () => resolve('0:00');
    video.src = URL.createObjectURL(file);
  });
};

// DOM 유틸리티
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);