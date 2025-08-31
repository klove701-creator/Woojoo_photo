import {
  isImageFile,
  isVideoFile,
  getBaseName,
  getExifDate,
  getVideoFileDuration,
  fmtDate,
  folderFor,
  derivePublicIdFromUrl,
  isVideoUrl
} from './utils.js';

export class PhotoManager {
  constructor(config, storageManager) {
    this.config = config;
    this.storageManager = storageManager;
    this.currentUser = null;
    this.uploadDateOverride = null;
  }

  setCurrentUser(user) {
    this.currentUser = user;
  }

  setUploadDateOverride(date) {
    this.uploadDateOverride = date;
  }

  // 파일 업로드 처리
  async handleFiles(files) {
    if (!files || files.length === 0 || !this.currentUser) {
      console.warn('파일이 없거나 사용자가 로그인하지 않음');
      return;
    }

    console.log(`📁 ${files.length}개 파일 업로드 시작`);
    
    for (const file of files) {
      try {
        await this.uploadSingleFile(file);
      } catch (error) {
        console.error(`파일 업로드 실패: ${file.name}`, error);
        alert(`파일 업로드 실패: ${file.name}\n${error.message}`);
      }
    }
    
    // 업로드 완료 후 초기화
    this.uploadDateOverride = null;
  }

  // 단일 파일 업로드
  async uploadSingleFile(file) {
    console.log(`📂 파일 처리 시작: ${file.name}`);
    
    let targetDate;
    
    if (this.uploadDateOverride) {
      // 수동으로 지정된 날짜 사용
      targetDate = this.uploadDateOverride;
      console.log(`📅 수동 지정 날짜 사용: ${targetDate}`);
    } else {
      // EXIF에서 촬영일시 추출 시도
      const exifDate = await getExifDate(file);
      if (exifDate) {
        targetDate = fmtDate(exifDate.toISOString());
        console.log(`📸 EXIF 날짜 발견: ${targetDate} (파일: ${file.name})`);
      } else {
        // 파일 수정 날짜 사용
        targetDate = fmtDate(new Date(file.lastModified).toISOString());
        console.log(`📁 파일 수정일 사용: ${targetDate} (파일: ${file.name})`);
      }
    }
    
    // 파일 처리 및 검증
    const processedFile = await this.processFile(file);
    
    // Cloudinary 업로드
    const url = await this.uploadToCloudinary(processedFile, targetDate);
    if (!url) {
      throw new Error('Cloudinary 업로드 실패');
    }
    
    // 동영상인 경우 길이 정보 추가
    let duration = null;
    if (isVideoFile(processedFile)) {
      try {
        duration = await getVideoFileDuration(processedFile);
        console.log(`🎬 동영상 길이: ${duration}`);
      } catch (e) {
        console.log('동영상 길이 가져오기 실패:', e);
        duration = '0:00';
      }
    }

    // 사진 데이터 생성
    const photoData = {
      id: `${getBaseName(file.name)}_${Date.now()}`,
      url: url,
      uploadedAt: new Date().toISOString(),
      dateGroup: targetDate, // 촬영일/지정일 사용
      uploader: this.currentUser,
      timestamp: Date.now(),
      nameBase: getBaseName(file.name),
      originalFileName: file.name,
      fileSize: file.size,
      reactions: {},
      albums: [],
      duration: duration // 동영상 길이 추가
    };
    
    console.log(`💾 데이터 저장: ${photoData.dateGroup} - ${file.name}`);
    
    // 데이터베이스에 저장
    await this.storageManager.savePhoto(photoData);
    
    return photoData;
  }

  // 파일 처리 (압축, 검증 등)
  async processFile(file) {
    // 파일 크기 검증
    if (isVideoFile(file) && file.size > 100 * 1024 * 1024) {
      throw new Error('동영상은 100MB 이하만 업로드 가능합니다.');
    }

    // 이미지 압축 (10MB 초과시)
    if (isImageFile(file) && file.size > 10 * 1024 * 1024) {
      try {
        const compressedFile = await this.compressImage(file);
        console.log(`🗜️ 이미지 압축 완료: ${(file.size/1024/1024).toFixed(1)}MB → ${(compressedFile.size/1024/1024).toFixed(1)}MB`);
        return compressedFile;
      } catch (e) {
        console.log('압축 실패, 원본 사용:', e);
        return file;
      }
    }

    return file;
  }

  // 이미지 압축
  async compressImage(file) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const canvas = document.createElement('canvas');
    const maxSize = 1500;
    let { width, height } = img;

    // 크기 조정
    if (width > height && width > maxSize) {
      height = Math.round(height * maxSize / width);
      width = maxSize;
    } else if (height >= width && height > maxSize) {
      width = Math.round(width * maxSize / height);
      height = maxSize;
    }

    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise(resolve => 
      canvas.toBlob(resolve, 'image/jpeg', 0.9)
    );

    URL.revokeObjectURL(url);
    
    return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
      type: 'image/jpeg'
    });
  }

  // photo-manager.js
async uploadToCloudinary(file, targetDate) {
  try {
    const cloudName = this.config.cloudinary.cloudName;

    // 1) 파일명/확장자/MIME 기반 보수적 판별
    const name = (file?.name || '').toLowerCase();
    const mime = (file?.type || '').toLowerCase();

    const videoExt = /\.(mp4|mov|m4v|avi|mkv|webm)$/i.test(name);
    const imageExt = /\.(jpg|jpeg|png|gif|webp|heic|heif|avif|bmp|tif|tiff)$/i.test(name);

    const mimeVideo = mime.startsWith('video/');
    const mimeImage = mime.startsWith('image/');

    // ⚠️ 핵심: 애매하면 이미지로 처리(영상은 확실할 때만 true)
    const isVideo = mimeVideo || (videoExt && !mimeImage);

    // 2) 프리셋/엔드포인트 강제 분기 (프리셋이 곧 타입)
    const preset   = isVideo ? 'woojoo_fam' : 'woojoo_img';
    const endpoint = isVideo ? 'video'      : 'image';

    // 디버깅 로그 (한번만 확인해보세요)
    console.log('[UPLOAD DECISION]', {
      name, mime, videoExt, imageExt, mimeVideo, mimeImage, isVideo, preset, endpoint
    });

    // 3) 업로드
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', preset);
    formData.append('folder', folderFor(targetDate + 'T00:00:00.000Z'));

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/${endpoint}/upload`,
      { method: 'POST', body: formData }
    );
    const json = await res.json();

    if (!res.ok || !json.secure_url) {
      throw new Error(json?.error?.message || `업로드 실패 (${res.status})`);
    }

    console.log(`☁️ Cloudinary 업로드 성공: ${json.secure_url}`);
    return json.secure_url;
  } catch (error) {
    console.error('❌ Cloudinary 업로드 실패:', error);
    throw error;
  }
}


  // 사진 삭제
  async deletePhoto(photo) {
    try {
      // Cloudinary에서 삭제
      const publicId = derivePublicIdFromUrl(photo.url);
      if (publicId) {
        await this.deleteFromCloudinary(publicId, isVideoUrl(photo.url) ? 'video' : 'image');
      }

      // 데이터베이스에서 삭제
      await this.storageManager.deletePhoto(photo);
      
      console.log('사진 삭제 성공');
    } catch (error) {
      console.error('사진 삭제 오류:', error);
      throw error;
    }
  }

  // Cloudinary에서 삭제
  async deleteFromCloudinary(publicId, resourceType = 'image') {
    try {
      await fetch('/.netlify/functions/delete-cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId, resourceType })
      });
      console.log('Cloudinary에서 삭제 성공');
    } catch (error) {
      console.warn('Cloudinary 삭제 실패:', error);
    }
  }

  // 사진 업데이트 (앨범, 반응 등)
  async updatePhoto(photo, updates) {
    try {
      await this.storageManager.updatePhoto(photo, updates);
      console.log('사진 업데이트 성공');
    } catch (error) {
      console.error('사진 업데이트 오류:', error);
      throw error;
    }
  }

  // 여러 사진 일괄 삭제
  async deleteMultiplePhotos(photos) {
    const results = [];
    
    for (const photo of photos) {
      try {
        await this.deletePhoto(photo);
        results.push({ photo, success: true });
      } catch (error) {
        console.error('사진 삭제 실패:', photo, error);
        results.push({ photo, success: false, error });
      }
    }
    
    return results;
  }


  // 동영상 길이 가져오기 (저장된 duration 사용)
  getVideoDuration(photo) {
    // 업로드할 때 저장된 길이 정보 사용
    if (photo && photo.duration) {
      return photo.duration;
    }
    
    // 길이 정보가 없으면 기본값
    return '0:00';
  }

  // 댓글 개수 가져오기
  getCommentCount(photo) {
    if (!photo) return 0;

    // Firebase 여부와 관계없이 photo 객체에 저장된 값이 있으면 사용
    if (typeof photo.commentCount === 'number') {
      return photo.commentCount;
    }

    // 로컬 저장소에서 직접 확인
    try {
      const key = 'comments_' + (photo.id || photo.public_id || photo.url);
      const comments = JSON.parse(localStorage.getItem(key) || '[]');
      return comments.length;
    } catch (e) {
      return 0;
    }
  }

  // 배지 HTML 생성
  generateBadges(photo) {
    if (!photo) return '';
    
    const isVideo = isVideoUrl(photo.url);
    const commentCount = this.getCommentCount(photo);
    const hasComments = commentCount > 0;
    
    if (!isVideo && !hasComments) return '';
    
    let badges = '<div class="badges-container">';
    
    if (isVideo) {
      const duration = this.getVideoDuration(photo);
      badges += `<div class="video-duration-badge">${duration}</div>`;
    }
    
    if (hasComments) {
      badges += `<div class="comment-badge">
        <span class="comment-icon">💬</span>
        <span class="comment-count">${commentCount}</span>
      </div>`;
    }
    
    badges += '</div>';
    
    return badges;
  }

}