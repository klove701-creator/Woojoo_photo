import { $ } from './utils.js';

export class GrowthManager {
  constructor(app) {
    this.app = app;
    this.currentEditingRecord = null;
    this.growthRecords = JSON.parse(localStorage.getItem('growthRecords') || '[]');

    this.bindEvents();
  }

  // 이벤트 바인딩
  bindEvents() {
    // 성장 기록 추가 버튼
    $('#addGrowthBtn')?.addEventListener('click', () => this.showGrowthModal());

    // 성장 모달 관련
    $('#closeGrowthModal')?.addEventListener('click', () => this.hideGrowthModal());
    $('#growthForm')?.addEventListener('submit', (e) => this.handleGrowthSubmit(e));
    $('#deleteGrowthBtn')?.addEventListener('click', () => this.handleGrowthDelete());
  }

  // 성장 기록 모달 표시
  showGrowthModal(recordId = null) {
    const modal = $('#growthModal');
    const form = $('#growthForm');
    const title = $('#growthModalTitle');
    const deleteBtn = $('#deleteGrowthBtn');

    if (!modal || !form) return;

    this.currentEditingRecord = recordId ? this.getGrowthRecordById(recordId) : null;

    // 폼 초기화
    form.reset();

    if (this.currentEditingRecord) {
      // 수정 모드
      title.textContent = '성장 기록 수정';
      deleteBtn.style.display = 'block';

      // 기존 데이터 채우기
      $('#growthDate').value = this.currentEditingRecord.date || '';
      $('#growthHeight').value = this.currentEditingRecord.height || '';
      $('#growthWeight').value = this.currentEditingRecord.weight || '';
      $('#growthHeadCircumference').value = this.currentEditingRecord.headCircumference || '';
      $('#growthMilestone').value = this.currentEditingRecord.milestone || '';
      $('#growthMemo').value = this.currentEditingRecord.memo || '';
    } else {
      // 추가 모드
      title.textContent = '성장 기록 추가';
      deleteBtn.style.display = 'none';

      // 기본값으로 오늘 날짜 설정
      $('#growthDate').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';

    // 뒤로가기 버튼을 위한 히스토리 상태 추가
    window.history.pushState({ page: 'growthModal' }, '', window.location.href);
  }

  // 성장 기록 모달 숨기기
  hideGrowthModal() {
    const modal = $('#growthModal');
    if (!modal) return;

    modal.classList.remove('show');
    document.body.style.overflow = '';
    this.currentEditingRecord = null;
  }

  // 성장 기록 폼 제출 처리
  handleGrowthSubmit(e) {
    e.preventDefault();

    const date = $('#growthDate').value;
    const height = parseFloat($('#growthHeight').value) || null;
    const weight = parseFloat($('#growthWeight').value) || null;
    const headCircumference = parseFloat($('#growthHeadCircumference').value) || null;
    const milestone = $('#growthMilestone').value.trim();
    const memo = $('#growthMemo').value.trim();

    if (!date) {
      alert('날짜는 필수입니다.');
      return;
    }

    if (!height && !weight && !headCircumference && !milestone && !memo) {
      alert('최소 하나의 항목은 입력해주세요.');
      return;
    }

    const recordData = {
      id: this.currentEditingRecord?.id || this.generateId(),
      date,
      height,
      weight,
      headCircumference,
      milestone,
      memo,
      createdAt: this.currentEditingRecord?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (this.currentEditingRecord) {
      // 수정
      this.updateGrowthRecord(recordData);
    } else {
      // 추가
      this.addGrowthRecord(recordData);
    }

    this.hideGrowthModal();
    this.renderGrowthRecords();
    this.renderGrowthCharts();

    // 활동 로그 추가
    if (this.app.addActivityLog) {
      this.app.addActivityLog(
        this.currentEditingRecord ? 'growth_edit' : 'growth_add',
        `성장 기록 ${this.currentEditingRecord ? '수정' : '추가'}: ${date}`
      );
    }
  }

  // 성장 기록 삭제 처리
  handleGrowthDelete() {
    if (!this.currentEditingRecord) return;

    if (confirm('이 성장 기록을 삭제하시겠습니까?')) {
      this.deleteGrowthRecord(this.currentEditingRecord.id);
      this.hideGrowthModal();
      this.renderGrowthRecords();
      this.renderGrowthCharts();

      // 활동 로그 추가
      if (this.app.addActivityLog) {
        this.app.addActivityLog('growth_delete', `성장 기록 삭제: ${this.currentEditingRecord.date}`);
      }
    }
  }

  // 성장 기록 추가
  addGrowthRecord(record) {
    this.growthRecords.push(record);
    this.saveGrowthRecords();
  }

  // 성장 기록 수정
  updateGrowthRecord(updatedRecord) {
    const index = this.growthRecords.findIndex(r => r.id === updatedRecord.id);
    if (index !== -1) {
      this.growthRecords[index] = updatedRecord;
      this.saveGrowthRecords();
    }
  }

  // 성장 기록 삭제
  deleteGrowthRecord(recordId) {
    this.growthRecords = this.growthRecords.filter(r => r.id !== recordId);
    this.saveGrowthRecords();
  }

  // 성장 기록 저장
  saveGrowthRecords() {
    localStorage.setItem('growthRecords', JSON.stringify(this.growthRecords));
  }

  // ID로 성장 기록 찾기
  getGrowthRecordById(id) {
    return this.growthRecords.find(r => r.id === id);
  }

  // 유니크 ID 생성
  generateId() {
    return 'growth_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 성장 기록 목록 렌더링
  renderGrowthRecords() {
    this.renderRecentGrowthRecords();
    this.renderAllGrowthRecords();
  }

  // 최근 성장 기록 렌더링
  renderRecentGrowthRecords() {
    const container = $('#recentGrowthRecords');
    if (!container) return;

    const recentRecords = this.growthRecords
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 3);

    if (recentRecords.length === 0) {
      container.innerHTML = '<div class="no-records">아직 성장 기록이 없습니다.</div>';
      return;
    }

    container.innerHTML = recentRecords.map(record => this.renderGrowthRecordItem(record)).join('');
  }

  // 모든 성장 기록 렌더링
  renderAllGrowthRecords() {
    const container = $('#allGrowthRecords');
    if (!container) return;

    const sortedRecords = this.growthRecords
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sortedRecords.length === 0) {
      container.innerHTML = '<div class="no-records">아직 성장 기록이 없습니다.</div>';
      return;
    }

    container.innerHTML = sortedRecords.map(record => this.renderGrowthRecordItem(record)).join('');
  }

  // 성장 기록 아이템 렌더링
  renderGrowthRecordItem(record) {
    const dataItems = [];
    if (record.height) dataItems.push(`키: ${record.height}cm`);
    if (record.weight) dataItems.push(`몸무게: ${record.weight}kg`);
    if (record.headCircumference) dataItems.push(`머리둘레: ${record.headCircumference}cm`);

    return `
      <div class="growth-record-item" onclick="window.app.growthManager.showGrowthModal('${record.id}')">
        <div class="growth-record-content">
          <div class="growth-record-date">${this.formatDate(record.date)}</div>
          <div class="growth-record-data">${dataItems.join(' | ')}</div>
          ${record.milestone ? `<div class="growth-record-milestone">${record.milestone}</div>` : ''}
          ${record.memo ? `<div class="growth-record-memo">${record.memo}</div>` : ''}
        </div>
        <div class="growth-record-actions">
          <button class="growth-record-edit" onclick="event.stopPropagation(); window.app.growthManager.showGrowthModal('${record.id}')" title="수정">✏️</button>
          <button class="growth-record-delete" onclick="event.stopPropagation(); window.app.growthManager.deleteGrowthRecord('${record.id}'); window.app.growthManager.renderGrowthRecords(); window.app.growthManager.renderGrowthCharts();" title="삭제">🗑️</button>
        </div>
      </div>
    `;
  }

  // 성장 차트 렌더링
  renderGrowthCharts() {
    this.renderHeightChart();
    this.renderWeightChart();
  }

  // 키 성장 차트 렌더링
  renderHeightChart() {
    const container = $('#heightChart');
    if (!container) return;

    const heightRecords = this.growthRecords
      .filter(r => r.height)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (heightRecords.length === 0) {
      container.innerHTML = '<div class="no-chart-data">키 데이터가 없습니다</div>';
      return;
    }

    // 간단한 차트 HTML
    const chartData = heightRecords.map(r => ({
      date: this.formatDate(r.date),
      value: r.height,
      fullDate: r.date
    }));

    container.innerHTML = `
      <div class="simple-chart">
        ${chartData.map(point => `
          <div class="chart-point" title="${point.date}: ${point.value}cm">
            <div class="chart-value">${point.value}cm</div>
            <div class="chart-date">${point.date.split('-')[1]}/${point.date.split('-')[2]}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 몸무게 성장 차트 렌더링
  renderWeightChart() {
    const container = $('#weightChart');
    if (!container) return;

    const weightRecords = this.growthRecords
      .filter(r => r.weight)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (weightRecords.length === 0) {
      container.innerHTML = '<div class="no-chart-data">몸무게 데이터가 없습니다</div>';
      return;
    }

    // 간단한 차트 HTML
    const chartData = weightRecords.map(r => ({
      date: this.formatDate(r.date),
      value: r.weight,
      fullDate: r.date
    }));

    container.innerHTML = `
      <div class="simple-chart">
        ${chartData.map(point => `
          <div class="chart-point" title="${point.date}: ${point.value}kg">
            <div class="chart-value">${point.value}kg</div>
            <div class="chart-date">${point.date.split('-')[1]}/${point.date.split('-')[2]}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 날짜 포맷팅
  formatDate(dateString) {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 성장 통계 가져오기
  getGrowthStats() {
    if (this.growthRecords.length === 0) return null;

    const sortedRecords = this.growthRecords.sort((a, b) => new Date(a.date) - new Date(b.date));
    const latestRecord = sortedRecords[sortedRecords.length - 1];
    const firstRecord = sortedRecords[0];

    const stats = {
      totalRecords: this.growthRecords.length,
      latestHeight: latestRecord.height,
      latestWeight: latestRecord.weight,
      latestDate: latestRecord.date,
      heightGrowth: latestRecord.height && firstRecord.height ?
        (latestRecord.height - firstRecord.height).toFixed(1) : null,
      weightGrowth: latestRecord.weight && firstRecord.weight ?
        (latestRecord.weight - firstRecord.weight).toFixed(2) : null,
      milestones: this.growthRecords.filter(r => r.milestone).map(r => ({
        date: r.date,
        milestone: r.milestone
      }))
    };

    return stats;
  }

  // 탭이 활성화될 때 호출
  initializeGrowthTab() {
    this.renderGrowthRecords();
    this.renderGrowthCharts();
  }
}