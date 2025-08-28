
# 우리가족 사진첩 — 모바일 타임라인/캘린더 (Netlify)

- 모바일 우선 UI, 맑은고딕 우선 폰트
- 탭: 타임라인 / 캘린더
- 업로드: Cloudinary (unsigned preset), 날짜별 폴더 저장(YYYY/MM/DD)
- 삭제: /.netlify/functions/delete-cloudinary (Netlify env: CLOUDINARY_* 필요)
- Firebase는 선택(실시간). 미설정 시 로컬 저장 동작

## Netlify 환경변수 (삭제 기능용)
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

## 하드코딩된 기본값 (index.html의 DEFAULTS 수정)
- FIREBASE_PROJECT_ID: woojoo-fam-87e33
- FIREBASE_API_KEY: (동일)
- CLOUDINARY_CLOUD_NAME: dawj0jy9t
- CLOUDINARY_UPLOAD_PRESET: woojoo_fam
