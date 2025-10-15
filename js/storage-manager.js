// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  getDocs,
  updateDoc,
  getDoc,
  setDoc,
  increment,
  limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

export class StorageManager {
  constructor(config) {
    this.config = config;
    this.db = null;
    this.firebaseOn = false;
    this.unsubscribers = new Map(); // 구독 관리
    this.lastUploadLogTime = 0; // 마지막 업로드 로그 기록 시간
  }

  // Firebase 초기화
  async initFirebase() {
    try {
      if (!this.config.firebase?.projectId || !this.config.firebase?.apiKey) {
        throw new Error('Firebase 설정이 없습니다.');
      }

      const app = initializeApp({
        projectId: this.config.firebase.projectId,
        apiKey: this.config.firebase.apiKey
      });
      
      this.db = getFirestore(app);
      this.firebaseOn = true;
      
      console.log('Firebase 초기화 성공');
      return true;
    } catch (error) {
      console.warn('Firebase 초기화 실패:', error);
      this.firebaseOn = false;
      return false;
    }
  }

  // 사진 데이터 로드
  async loadPhotos(callback) {
    if (this.firebaseOn && this.db) {
      return this.loadPhotosFromFirebase(callback);
    } else {
      return this.loadPhotosFromLocal(callback);
    }
  }

  // Firebase에서 사진 로드
  loadPhotosFromFirebase(callback) {
    const q = query(collection(this.db, 'family-photos'), orderBy('timestamp', 'desc'));

    // 기존 구독 해제
    const unsub = this.unsubscribers.get('photos');
    if (unsub) unsub();

    // 새로운 구독 설정
    const unsubscriber = onSnapshot(q, async (snapshot) => {
      const photos = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let commentCount = data.commentCount;

        if (commentCount === undefined) {
          try {
            const commentsSnap = await getDocs(collection(this.db, 'family-photos', docSnap.id, 'comments'));
            commentCount = commentsSnap.size;
          } catch (e) {
            commentCount = 0;
          }
        }

        return { docId: docSnap.id, ...data, commentCount };
      }));

      callback(photos, null);
    }, (error) => {
      console.error('Firebase 사진 로드 오류:', error);
      callback([], error);
    });

    this.unsubscribers.set('photos', unsubscriber);
    return unsubscriber;
  }

  // 로컬에서 사진 로드
  loadPhotosFromLocal(callback) {
    try {
      const photos = JSON.parse(localStorage.getItem('familyPhotos') || '[]');
      callback(photos, null);
    } catch (error) {
      console.error('로컬 사진 로드 오류:', error);
      callback([], error);
    }
  }

  // 사진 저장
  async savePhoto(photoData) {
    if (this.firebaseOn && this.db) {
      return this.savePhotoToFirebase(photoData);
    } else {
      return this.savePhotoToLocal(photoData);
    }
  }

  // Firebase에 사진 저장
  async savePhotoToFirebase(photoData) {
    try {
      const docRef = await addDoc(collection(this.db, 'family-photos'), photoData);
      console.log('Firebase에 사진 저장 성공:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Firebase 사진 저장 오류:', error);
      throw error;
    }
  }

  // 로컬에 사진 저장
  savePhotoToLocal(photoData) {
    try {
      const photos = JSON.parse(localStorage.getItem('familyPhotos') || '[]');
      photos.unshift(photoData);
      localStorage.setItem('familyPhotos', JSON.stringify(photos));
      console.log('로컬에 사진 저장 성공');
      return photoData.id;
    } catch (error) {
      console.error('로컬 사진 저장 오류:', error);
      throw error;
    }
  }

  // 사진 삭제
  async deletePhoto(photo) {
    if (this.firebaseOn && this.db && photo.docId) {
      return this.deletePhotoFromFirebase(photo);
    } else {
      return this.deletePhotoFromLocal(photo);
    }
  }

  // Firebase에서 사진 삭제
  async deletePhotoFromFirebase(photo) {
    try {
      // 댓글도 함께 삭제
      const commentsRef = collection(this.db, 'family-photos', photo.docId, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      
      for (const commentDoc of commentsSnapshot.docs) {
        await deleteDoc(doc(this.db, 'family-photos', photo.docId, 'comments', commentDoc.id));
      }
      
      // 사진 문서 삭제
      await deleteDoc(doc(this.db, 'family-photos', photo.docId));
      console.log('Firebase에서 사진 삭제 성공');
    } catch (error) {
      console.error('Firebase 사진 삭제 오류:', error);
      throw error;
    }
  }

  // 로컬에서 사진 삭제
  deletePhotoFromLocal(photo) {
    try {
      const photos = JSON.parse(localStorage.getItem('familyPhotos') || '[]');
      const photoId = photo.id || photo.public_id || photo.url;
      const filteredPhotos = photos.filter(p => (p.id || p.public_id || p.url) !== photoId);
      
      localStorage.setItem('familyPhotos', JSON.stringify(filteredPhotos));
      
      // 댓글도 삭제
      const commentKey = 'comments_' + photoId;
      localStorage.removeItem(commentKey);
      
      console.log('로컬에서 사진 삭제 성공');
    } catch (error) {
      console.error('로컬 사진 삭제 오류:', error);
      throw error;
    }
  }

  // 사진 업데이트 (앨범, 반응 등)
  async updatePhoto(photo, updates) {
    if (this.firebaseOn && this.db && photo.docId) {
      return this.updatePhotoInFirebase(photo, updates);
    } else {
      return this.updatePhotoInLocal(photo, updates);
    }
  }

  // Firebase에서 사진 업데이트
  async updatePhotoInFirebase(photo, updates) {
    try {
      await updateDoc(doc(this.db, 'family-photos', photo.docId), updates);
      console.log('Firebase에서 사진 업데이트 성공');
    } catch (error) {
      console.error('Firebase 사진 업데이트 오류:', error);
      throw error;
    }
  }

  // 로컬에서 사진 업데이트
  updatePhotoInLocal(photo, updates) {
    try {
      const photos = JSON.parse(localStorage.getItem('familyPhotos') || '[]');
      const photoId = photo.id || photo.public_id || photo.url;
      const index = photos.findIndex(p => (p.id || p.public_id || p.url) === photoId);
      
      if (index >= 0) {
        photos[index] = { ...photos[index], ...updates };
        localStorage.setItem('familyPhotos', JSON.stringify(photos));
        console.log('로컬에서 사진 업데이트 성공');
      }
    } catch (error) {
      console.error('로컬 사진 업데이트 오류:', error);
      throw error;
    }
  }

  // 댓글 로드
  loadComments(photo, callback) {
    if (this.firebaseOn && this.db && photo.docId) {
      return this.loadCommentsFromFirebase(photo, callback);
    } else {
      return this.loadCommentsFromLocal(photo, callback);
    }
  }

  // Firebase에서 댓글 로드
  loadCommentsFromFirebase(photo, callback) {
    const q = query(
      collection(this.db, 'family-photos', photo.docId, 'comments'), 
      orderBy('createdAt', 'asc')
    );

    const key = `comments_${photo.docId}`;
    const unsub = this.unsubscribers.get(key);
    if (unsub) unsub();

    const unsubscriber = onSnapshot(q, (snapshot) => {
      const comments = [];
      snapshot.forEach((doc) => {
        comments.push({ id: doc.id, ...doc.data() });
      });
      callback(comments, null);
    }, (error) => {
      console.error('Firebase 댓글 로드 오류:', error);
      callback([], error);
    });

    this.unsubscribers.set(key, unsubscriber);
    return unsubscriber;
  }

  // 로컬에서 댓글 로드
  loadCommentsFromLocal(photo, callback) {
    try {
      const key = 'comments_' + (photo.id || photo.public_id || photo.url);
      const comments = JSON.parse(localStorage.getItem(key) || '[]');
      callback(comments, null);
    } catch (error) {
      console.error('로컬 댓글 로드 오류:', error);
      callback([], error);
    }
  }

  // 댓글 추가
  async addComment(photo, commentData) {
    if (this.firebaseOn && this.db && photo.docId) {
      return this.addCommentToFirebase(photo, commentData);
    } else {
      return this.addCommentToLocal(photo, commentData);
    }
  }

  // Firebase에 댓글 추가
  async addCommentToFirebase(photo, commentData) {
    try {
      const docRef = await addDoc(
        collection(this.db, 'family-photos', photo.docId, 'comments'),
        commentData
      );
      // 댓글 수 증가
      try {
        await updateDoc(doc(this.db, 'family-photos', photo.docId), {
          commentCount: increment(1)
        });
      } catch (e) {
        console.warn('댓글 수 업데이트 실패:', e);
      }
      console.log('Firebase에 댓글 추가 성공');
      return docRef.id;
    } catch (error) {
      console.error('Firebase 댓글 추가 오류:', error);
      throw error;
    }
  }

  // 로컬에 댓글 추가
  addCommentToLocal(photo, commentData) {
    try {
      const key = 'comments_' + (photo.id || photo.public_id || photo.url);
      const comments = JSON.parse(localStorage.getItem(key) || '[]');
      comments.push(commentData);
      localStorage.setItem(key, JSON.stringify(comments));
      console.log('로컬에 댓글 추가 성공');
      return Date.now().toString();
    } catch (error) {
      console.error('로컬 댓글 추가 오류:', error);
      throw error;
    }
  }

  // 앨범 관리
  async loadSharedAlbums(callback) {
    if (this.firebaseOn && this.db) {
      return this.loadSharedAlbumsFromFirebase(callback);
    } else {
      // 로컬 모드에서는 설정에서 앨범 목록 사용
      const albums = this.config.albums || [];
      callback(albums, null);
      return null;
    }
  }

  // Firebase에서 공유 앨범 로드
  loadSharedAlbumsFromFirebase(callback) {
    const unsub = this.unsubscribers.get('albums');
    if (unsub) unsub();

    const unsubscriber = onSnapshot(
      collection(this.db, 'shared_albums'),
      (snapshot) => {
        const albums = snapshot.docs
          .map(doc => doc.data()?.name || '')
          .filter(Boolean)
          .sort();
        callback(albums, null);
      },
      (error) => {
        console.error('Firebase 앨범 로드 오류:', error);
        callback([], error);
      }
    );

    this.unsubscribers.set('albums', unsubscriber);
    return unsubscriber;
  }

  // 앨범 추가
  async addAlbum(albumName) {
    if (this.firebaseOn && this.db) {
      return this.addAlbumToFirebase(albumName);
    } else {
      return this.addAlbumToLocal(albumName);
    }
  }

  // Firebase에 앨범 추가
  async addAlbumToFirebase(albumName) {
    try {
      const cleanName = albumName.trim();
      if (!cleanName) return;
      
      await setDoc(doc(this.db, 'shared_albums', cleanName), {
        name: cleanName,
        updatedAt: Date.now()
      });
      console.log('Firebase에 앨범 추가 성공:', cleanName);
    } catch (error) {
      console.error('Firebase 앨범 추가 오류:', error);
      throw error;
    }
  }

  // 로컬에 앨범 추가
  addAlbumToLocal(albumName) {
    try {
      const cleanName = albumName.trim();
      if (!cleanName) return;
      
      if (!this.config.albums.includes(cleanName)) {
        this.config.albums.push(cleanName);
        localStorage.setItem('familyAppConfig', JSON.stringify(this.config));
        console.log('로컬에 앨범 추가 성공:', cleanName);
      }
    } catch (error) {
      console.error('로컬 앨범 추가 오류:', error);
      throw error;
    }
  }

  // 앨범 삭제
  async removeAlbum(albumName) {
    if (this.firebaseOn && this.db) {
      return this.removeAlbumFromFirebase(albumName);
    } else {
      return this.removeAlbumFromLocal(albumName);
    }
  }

  // Firebase에서 앨범 삭제
  async removeAlbumFromFirebase(albumName) {
    try {
      const cleanName = albumName.trim();
      if (!cleanName) return;
      
      await deleteDoc(doc(this.db, 'shared_albums', cleanName));
      console.log('Firebase에서 앨범 삭제 성공:', cleanName);
    } catch (error) {
      console.error('Firebase 앨범 삭제 오류:', error);
      throw error;
    }
  }

  // 로컬에서 앨범 삭제
  removeAlbumFromLocal(albumName) {
    try {
      const cleanName = albumName.trim();
      if (!cleanName) return;
      
      const index = this.config.albums.indexOf(cleanName);
      if (index >= 0) {
        this.config.albums.splice(index, 1);
        localStorage.setItem('familyAppConfig', JSON.stringify(this.config));
        console.log('로컬에서 앨범 삭제 성공:', cleanName);
      }
    } catch (error) {
      console.error('로컬 앨범 삭제 오류:', error);
      throw error;
    }
  }


  // 모든 구독 해제
  unsubscribeAll() {
    this.unsubscribers.forEach((unsubscriber, key) => {
      try {
        unsubscriber();
        console.log(`구독 해제: ${key}`);
      } catch (error) {
        console.error(`구독 해제 오류 (${key}):`, error);
      }
    });
    this.unsubscribers.clear();
  }

  // 활동 로그 저장
  async saveActivityLog(action, details = {}) {
    // 업로드 액션은 5분에 한 번만 로그 기록
    if (action === 'upload') {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      if (now - this.lastUploadLogTime < fiveMinutes) {
        console.log('업로드 로그 생략 (5분 미만 경과)');
        return;
      }

      this.lastUploadLogTime = now;
    }

    const log = {
      timestamp: Date.now(),
      action: action,
      user: details.user || this.currentUser,
      details: details
    };

    if (this.firebaseOn && this.db) {
      return this.saveActivityLogToFirebase(log);
    } else {
      return this.saveActivityLogToLocal(log);
    }
  }

  // Firebase에 활동 로그 저장
  async saveActivityLogToFirebase(log) {
    try {
      await addDoc(collection(this.db, 'activity_logs'), log);
      console.log('Firebase에 활동 로그 저장 성공');
    } catch (error) {
      console.error('Firebase 활동 로그 저장 오류:', error);
      throw error;
    }
  }

  // 로컬에 활동 로그 저장
  saveActivityLogToLocal(log) {
    try {
      const logs = JSON.parse(localStorage.getItem('activity_logs') || '[]');
      logs.push(log);

      // 로그가 너무 많으면 오래된 것부터 삭제 (최대 1000개)
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }

      localStorage.setItem('activity_logs', JSON.stringify(logs));
      console.log('로컬에 활동 로그 저장 성공');
    } catch (error) {
      console.error('로컬 활동 로그 저장 오류:', error);
      throw error;
    }
  }

  // 활동 로그 로드
  async loadActivityLogs() {
    if (this.firebaseOn && this.db) {
      return this.loadActivityLogsFromFirebase();
    } else {
      return this.loadActivityLogsFromLocal();
    }
  }

  // Firebase에서 활동 로그 로드
  async loadActivityLogsFromFirebase() {
    try {
      const q = query(
        collection(this.db, 'activity_logs'),
        orderBy('timestamp', 'desc'),
        limit(200)
      );
      const snapshot = await getDocs(q);
      const logs = [];
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      return logs;
    } catch (error) {
      console.error('Firebase 활동 로그 로드 오류:', error);
      return [];
    }
  }

  // 로컬에서 활동 로그 로드
  loadActivityLogsFromLocal() {
    try {
      const logs = JSON.parse(localStorage.getItem('activity_logs') || '[]');
      return logs.sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('로컬 활동 로그 로드 오류:', error);
      return [];
    }
  }

  // 일정 저장
  async saveSchedule(scheduleData) {
    if (this.firebaseOn && this.db) {
      return this.saveScheduleToFirebase(scheduleData);
    } else {
      return this.saveScheduleToLocal(scheduleData);
    }
  }

  // Firebase에 일정 저장
  async saveScheduleToFirebase(scheduleData) {
    try {
      const docRef = await addDoc(collection(this.db, 'family-schedules'), scheduleData);
      console.log('Firebase에 일정 저장 성공:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('Firebase 일정 저장 오류:', error);
      throw error;
    }
  }

  // 로컬에 일정 저장
  saveScheduleToLocal(scheduleData) {
    try {
      const schedules = JSON.parse(localStorage.getItem('familySchedules') || '[]');
      schedules.push(scheduleData);
      localStorage.setItem('familySchedules', JSON.stringify(schedules));
      console.log('로컬에 일정 저장 성공');
      return scheduleData.id;
    } catch (error) {
      console.error('로컬 일정 저장 오류:', error);
      throw error;
    }
  }

  // 일정 로드
  async loadSchedules(callback) {
    if (this.firebaseOn && this.db) {
      return this.loadSchedulesFromFirebase(callback);
    } else {
      return this.loadSchedulesFromLocal(callback);
    }
  }

  // Firebase에서 일정 로드
  loadSchedulesFromFirebase(callback) {
    const q = query(collection(this.db, 'family-schedules'), orderBy('date', 'asc'));

    const unsub = this.unsubscribers.get('schedules');
    if (unsub) unsub();

    const unsubscriber = onSnapshot(q, (snapshot) => {
      const schedules = [];
      snapshot.forEach((doc) => {
        schedules.push({ docId: doc.id, ...doc.data() });
      });
      callback(schedules, null);
    }, (error) => {
      console.error('Firebase 일정 로드 오류:', error);
      callback([], error);
    });

    this.unsubscribers.set('schedules', unsubscriber);
    return unsubscriber;
  }

  // 로컬에서 일정 로드
  loadSchedulesFromLocal(callback) {
    try {
      const schedules = JSON.parse(localStorage.getItem('familySchedules') || '[]');
      callback(schedules, null);
    } catch (error) {
      console.error('로컬 일정 로드 오류:', error);
      callback([], error);
    }
  }

  // 일정 업데이트
  async updateSchedule(schedule, updates) {
    if (this.firebaseOn && this.db && schedule.docId) {
      return this.updateScheduleInFirebase(schedule, updates);
    } else {
      return this.updateScheduleInLocal(schedule, updates);
    }
  }

  // Firebase에서 일정 업데이트
  async updateScheduleInFirebase(schedule, updates) {
    try {
      await updateDoc(doc(this.db, 'family-schedules', schedule.docId), updates);
      console.log('Firebase에서 일정 업데이트 성공');
    } catch (error) {
      console.error('Firebase 일정 업데이트 오류:', error);
      throw error;
    }
  }

  // 로컬에서 일정 업데이트
  updateScheduleInLocal(schedule, updates) {
    try {
      const schedules = JSON.parse(localStorage.getItem('familySchedules') || '[]');
      const index = schedules.findIndex(s => s.id === schedule.id);
      
      if (index >= 0) {
        schedules[index] = { ...schedules[index], ...updates };
        localStorage.setItem('familySchedules', JSON.stringify(schedules));
        console.log('로컬에서 일정 업데이트 성공');
      }
    } catch (error) {
      console.error('로컬 일정 업데이트 오류:', error);
      throw error;
    }
  }

  // 일정 삭제
  async deleteSchedule(schedule) {
    if (this.firebaseOn && this.db && schedule.docId) {
      return this.deleteScheduleFromFirebase(schedule);
    } else {
      return this.deleteScheduleFromLocal(schedule);
    }
  }

  // Firebase에서 일정 삭제
  async deleteScheduleFromFirebase(schedule) {
    try {
      await deleteDoc(doc(this.db, 'family-schedules', schedule.docId));
      console.log('Firebase에서 일정 삭제 성공');
    } catch (error) {
      console.error('Firebase 일정 삭제 오류:', error);
      throw error;
    }
  }

  // 로컬에서 일정 삭제
  deleteScheduleFromLocal(schedule) {
    try {
      const schedules = JSON.parse(localStorage.getItem('familySchedules') || '[]');
      const filteredSchedules = schedules.filter(s => s.id !== schedule.id);
      localStorage.setItem('familySchedules', JSON.stringify(filteredSchedules));
      console.log('로컬에서 일정 삭제 성공');
    } catch (error) {
      console.error('로컬 일정 삭제 오류:', error);
      throw error;
    }
  }

  // 정리
  cleanup() {
    this.unsubscribeAll();
    this.db = null;
    this.firebaseOn = false;
  }
}