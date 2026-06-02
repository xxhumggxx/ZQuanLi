/* ══════════════════════════════════════════════
   TRÀ CHANH ZODY – Admin JavaScript
   ══════════════════════════════════════════════ */

// ── Helper Functions ──
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function fmtMoney(v) {
  return Math.round(v).toLocaleString('vi-VN');
}

// ── Modal Helpers ──
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('open');
    modal.style.display = 'flex';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('open');
    modal.style.display = 'none';
  }
}

// ── Toast Notification ──
function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.textContent = message;

  const bgColor = type === 'error' 
    ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
    : 'linear-gradient(135deg, #ea580c, #c2410c)';
  
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: white;
    padding: 14px 28px;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 10000;
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── Loading Indicator ──
function showLoading() {
  let loader = document.querySelector('.loader-overlay');
  if (!loader) {
    loader = document.createElement('div');
    loader.className = 'loader-overlay';
    loader.innerHTML = `
      <div class="loader-spinner"></div>
    `;
    loader.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(15, 23, 42, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hideLoading() {
  const loader = document.querySelector('.loader-overlay');
  if (loader) {
    loader.style.display = 'none';
  }
}

// ── Page Transitions ──
function showPage(page) {
  // Hide all pages with fade out
  document.querySelectorAll('.page').forEach(p => {
    p.style.opacity = '0';
    p.style.transform = 'translateY(10px)';
    p.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  });

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`[data-page="${page}"]`);
  if (activeNav) activeNav.classList.add('active');

  // Update page title
  const titles = {
    dashboard: 'Tổng Quan',
    reports: 'Báo Cáo Ca',
    consumption: 'Hao Hụt Nguyên Vật Liệu',
    finance: 'Thống Kê Tiền',
    shifts: 'Quản Lý Ca',
    materials: 'Nguyên Vật Liệu'
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  // Show selected page with fade in
  setTimeout(() => {
    document.querySelectorAll('.page').forEach(p => {
      p.style.display = 'none';
      p.style.opacity = '0';
      p.style.transform = 'translateY(10px)';
    });

    const targetPage = document.getElementById(`page-${page}`);
    if (targetPage) {
      targetPage.style.display = 'block';
      setTimeout(() => {
        targetPage.style.opacity = '1';
        targetPage.style.transform = 'translateY(0)';
      }, 50);
    }

    // Load page data
    if (page === 'dashboard') loadDashboard();
    if (page === 'shifts') loadShifts();
    if (page === 'materials') loadMaterials();
    if (page === 'reports') loadReports();
    if (page === 'consumption') loadConsumption();
    if (page === 'finance') loadFinanceStats();
  }, 200);
}

// ── Logout ──
function doLogout() {
  showLoading();
  fetch('/api/logout', { method: 'POST' })
    .then(() => {
      hideLoading();
      window.location.href = '/';
    })
    .catch(err => {
      hideLoading();
      showToast('Lỗi đăng xuất', 'error');
    });
}

// ── Dashboard ──
let revenueChart = null;

async function loadDashboard() {
  showLoading();
  try {
    const today = todayISO();
    const [reports, cons] = await Promise.all([
      fetch(`/api/admin/stats/daily?from=${today}&to=${today}`).then(r => r.json()),
      fetch(`/api/admin/consumption?from=${today}&to=${today}`).then(r => r.json())
    ]);

    // Stats
    let totalRevenue = 0, totalExpense = 0, totalBank = 0, shiftCount = 0;
    reports.forEach(r => {
      shiftCount++;
      if (r.shift_finance && r.shift_finance.length) {
        const f = r.shift_finance[0];
        totalRevenue += (f.software_revenue || 0) + (f.opening_cash || 0);
        totalExpense += f.total_expense || 0;
        totalBank += f.bank_transfer || 0;
      }
    });

    animateValue('stat-revenue', totalRevenue, 'đ');
    animateValue('stat-shifts', shiftCount, ' ca');
    animateValue('stat-expense', totalExpense, 'đ');
    animateValue('stat-bank', totalBank, 'đ');

    // Revenue chart – last 7 days
    await loadRevenueChart();

    // Top consumption
    renderTopConsumption(cons);
  } catch (err) {
    showToast('Lỗi tải dashboard', 'error');
  } finally {
    hideLoading();
  }
}

function animateValue(elementId, value, suffix = '') {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const start = 0;
  const duration = 500;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = start + (value - start) * easeProgress;
    
    element.textContent = fmtMoney(Math.round(current)) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

async function loadRevenueChart() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }

  const revenueByDay = {};
  days.forEach(d => revenueByDay[d] = 0);

  const weekData = await fetch(`/api/admin/stats/daily?from=${days[0]}&to=${days[6]}`).then(r => r.json());
  weekData.forEach(r => {
    if (r.shift_finance && r.shift_finance.length) {
      const f = r.shift_finance[0];
      revenueByDay[r.report_date] = (revenueByDay[r.report_date] || 0) + (f.software_revenue || 0);
    }
  });

  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;

  if (revenueChart) revenueChart.destroy();

  revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days.map(d => {
        const p = d.split('-');
        return `${p[2]}/${p[1]}`;
      }),
      datasets: [{
        label: 'Doanh thu (đ)',
        data: days.map(d => revenueByDay[d]),
        backgroundColor: 'rgba(234, 88, 12, 0.7)',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#94a3b8' } },
        y: { grid: { color: 'rgba(255,255,255,.05)' }, ticks: { color: '#94a3b8', callback: v => fmtMoney(v) + 'đ' } }
      },
      animation: {
        duration: 1000,
        easing: 'easeOutQuart'
      }
    }
  });
}

function renderTopConsumption(cons) {
  const container = document.getElementById('top-consumption');
  if (!container) return;

  const sorted = [...cons].sort((a, b) => b.total_consumed - a.total_consumed).slice(0, 8);

  if (!sorted.length) {
    container.innerHTML = '<div class="empty-state">Chưa có dữ liệu hôm nay</div>';
    return;
  }

  container.innerHTML = sorted.map((c, i) => `
    <div class="top-cons-item" style="animation: fadeInUp 0.3s ease ${i * 0.05}s both">
      <div class="top-cons-rank">${i + 1}</div>
      <div class="top-cons-name">${c.material_name}</div>
      <div class="top-cons-val">${parseFloat((c.total_consumed || 0).toFixed(2))} ${c.unit}</div>
    </div>
  `).join('');
}

// ── Reports ──
async function loadReports() {
  showLoading();
  try {
    const from = document.getElementById('report-from').value;
    const to = document.getElementById('report-to').value;
    const data = await fetch(`/api/admin/reports?from=${from}&to=${to}`).then(r => r.json());

    const container = document.getElementById('reports-container');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<div class="empty-state">Không có báo cáo nào trong khoảng thời gian này</div>';
      return;
    }

    container.innerHTML = data.map((r, i) => {
      const fin = r.shift_finance?.[0] || {};
      const exps = r.expenses || [];
      const totalExp = exps.reduce((s, e) => s + (e.amount || 0), 0);
      const invEntries = r.inventory_entries || [];

      return `
        <div class="report-block" style="animation: fadeInUp 0.3s ease ${i * 0.05}s both">
          <div class="report-block-head">
            <div>
              <span>${r.shift_name}</span>
              <span style="color:var(--muted);font-weight:400;margin-left:10px;font-size:.82rem">${r.report_date}</span>
            </div>
            <span class="badge badge-${r.status}">${r.status === 'submitted' ? '✅ Đã Chốt' : '🔄 Đang Mở'}</span>
          </div>
          <div class="report-block-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:16px">
              <div>
                <div style="font-weight:700;margin-bottom:10px;font-size:.88rem;color:var(--muted)">💰 THU CHI</div>
                <table style="width:100%;font-size:.85rem">
                  <tr><td style="padding:4px 0;color:var(--muted)">Tiền đầu ca</td><td style="text-align:right;font-weight:600">${fmtMoney(fin.opening_cash)}đ</td></tr>
                  <tr><td style="padding:4px 0;color:var(--muted)">Tiền phần mềm</td><td style="text-align:right;font-weight:600">${fmtMoney(fin.software_revenue)}đ</td></tr>
                  <tr><td style="padding:4px 0;color:var(--muted)">Chuyển khoản</td><td style="text-align:right;color:var(--danger)">${fmtMoney(fin.bank_transfer)}đ</td></tr>
                  <tr><td style="padding:4px 0;color:var(--muted)">Tổng chi</td><td style="text-align:right;color:var(--danger)">${fmtMoney(totalExp)}đ</td></tr>
                  <tr style="border-top:1px solid var(--border)">
                    <td style="padding:8px 0 4px;font-weight:700">Tiền thực két</td>
                    <td style="text-align:right;font-weight:800;color:var(--primary)">${fmtMoney(fin.actual_cash)}đ</td>
                  </tr>
                  <tr><td style="padding:4px 0;font-weight:700;color:var(--success)">Tiền cầm về</td>
                    <td style="text-align:right;font-weight:800;color:var(--success)">${fmtMoney(fin.cash_to_bring)}đ</td></tr>
                </table>
              </div>
              <div>
                <div style="font-weight:700;margin-bottom:10px;font-size:.88rem;color:var(--muted)">📋 CHI TIẾT CHI</div>
                ${exps.length
                  ? exps.map(e => `<div style="display:flex;justify-content:space-between;font-size:.83rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span>${e.description}</span><span style="font-weight:700;color:var(--warning)">${fmtMoney(e.amount)}đ</span></div>`).join('')
                  : '<div style="color:var(--muted);font-size:.83rem">Không có khoản chi</div>'}
              </div>
            </div>
            <details>
              <summary style="cursor:pointer;font-size:.85rem;color:var(--muted);margin-bottom:8px">📦 Kiểm kê nguyên liệu (${invEntries.length} mục)</summary>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-top:10px">
                ${invEntries.map(e => {
                  const cons = (e.opening_qty || 0) - (e.closing_qty || 0);
                  const color = cons > 0 ? 'var(--warning)' : cons < 0 ? 'var(--success)' : 'var(--muted)';
                  return `<div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
                    <div style="font-weight:700;font-size:.82rem;margin-bottom:4px">${e.material_name}</div>
                    <div style="font-size:.75rem;color:var(--muted)">Đầu: ${parseFloat((e.opening_qty || 0).toFixed(2))} → Cuối: ${parseFloat((e.closing_qty || 0).toFixed(2))} ${e.unit}</div>
                    <div style="font-size:.75rem;font-weight:700;color:${color};margin-top:2px">${cons > 0 ? '−' : ''}${parseFloat(Math.abs(cons).toFixed(2))} ${e.unit}</div>
                  </div>`;
                }).join('')}
              </div>
            </details>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Lỗi tải báo cáo', 'error');
  } finally {
    hideLoading();
  }
}

// ── Consumption ──
async function loadConsumption() {
  showLoading();
  try {
    const from = document.getElementById('cons-from').value;
    const to = document.getElementById('cons-to').value;
    const data = await fetch(`/api/admin/consumption?from=${from}&to=${to}`).then(r => r.json());

    const container = document.getElementById('consumption-container');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<div class="empty-state">Không có dữ liệu hao hụt</div>';
      return;
    }

    const sorted = [...data].sort((a, b) => b.total_consumed - a.total_consumed);
    const maxCons = Math.max(...sorted.map(c => Math.abs(c.total_consumed)), 1);

    container.innerHTML = `
      <div class="card">
        <div class="card-head">📉 Hao Hụt Nguyên Vật Liệu (${from} → ${to})</div>
        ${sorted.map((c, i) => {
          const pct = Math.min(100, Math.abs(c.total_consumed) / maxCons * 100);
          const isNeg = c.total_consumed < 0;
          return `
            <div class="cons-row" style="animation: fadeInUp 0.3s ease ${i * 0.03}s both">
              <div class="cons-name">${c.material_name}</div>
              <div class="cons-bar-wrap">
                <div class="cons-bar" style="width:${pct}%;background:${isNeg ? 'var(--success)' : ''}"></div>
              </div>
              <div class="cons-value ${c.total_consumed <= 0 ? 'cons-zero' : ''}">
                ${isNeg ? '+' : '−'}${parseFloat(Math.abs(c.total_consumed).toFixed(2))} ${c.unit}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    showToast('Lỗi tải hao hụt', 'error');
  } finally {
    hideLoading();
  }
}

// ── Finance Stats ──
async function loadFinanceStats() {
  showLoading();
  try {
    const from = document.getElementById('fin-from').value;
    const to = document.getElementById('fin-to').value;
    const data = await fetch(`/api/admin/stats/daily?from=${from}&to=${to}`).then(r => r.json());

    const container = document.getElementById('finance-stats-container');
    if (!container) return;

    if (!data.length) {
      container.innerHTML = '<div class="empty-state">Không có dữ liệu tài chính</div>';
      return;
    }

    // Group by date
    const byDate = {};
    data.forEach(r => {
      if (!byDate[r.report_date]) byDate[r.report_date] = { date: r.report_date, shifts: [], totalRevenue: 0, totalExpense: 0, totalBank: 0, totalBring: 0 };
      const fin = r.shift_finance?.[0] || {};
      byDate[r.report_date].shifts.push({ name: r.shift_name, fin });
      byDate[r.report_date].totalRevenue += (fin.software_revenue || 0) + (fin.opening_cash || 0);
      byDate[r.report_date].totalExpense += fin.total_expense || 0;
      byDate[r.report_date].totalBank += fin.bank_transfer || 0;
      byDate[r.report_date].totalBring += fin.cash_to_bring || 0;
    });

    // Grand totals
    const dates = Object.values(byDate).sort((a, b) => b.date.localeCompare(a.date));
    let grandRev = 0, grandExp = 0, grandBank = 0, grandBring = 0;
    dates.forEach(d => {
      grandRev += d.totalRevenue;
      grandExp += d.totalExpense;
      grandBank += d.totalBank;
      grandBring += d.totalBring;
    });

    const summaryHtml = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px;margin-bottom:20px">
        ${[
          { icon: '💰', label: 'Tổng Doanh Thu', val: fmtMoney(grandRev) + 'đ', cls: 'orange' },
          { icon: '💸', label: 'Tổng Chi', val: fmtMoney(grandExp) + 'đ', cls: 'red' },
          { icon: '🏦', label: 'Tổng Chuyển Khoản', val: fmtMoney(grandBank) + 'đ', cls: '' },
          { icon: '👜', label: 'Tổng Cầm Về', val: fmtMoney(grandBring) + 'đ', cls: 'green' },
        ].map(s => `<div class="stat-card"><div class="stat-icon">${s.icon}</div><div class="stat-label">${s.label}</div><div class="stat-value ${s.cls}" style="font-size:1.1rem">${s.val}</div></div>`).join('')}
      </div>`;

    const rowsHtml = dates.map((d, i) => `
      <div class="fin-stat-row" style="animation: fadeInUp 0.3s ease ${i * 0.05}s both">
        <div class="fin-stat-cell" style="min-width:90px">
          <div class="fin-stat-label">Ngày</div>
          <div class="fin-stat-val">${d.date}</div>
          <div style="font-size:.72rem;color:var(--muted);margin-top:2px">${d.shifts.map(s => s.name).join(', ')}</div>
        </div>
        <div class="fin-stat-cell">
          <div class="fin-stat-label">Doanh Thu</div>
          <div class="fin-stat-val orange">${fmtMoney(d.totalRevenue)}đ</div>
        </div>
        <div class="fin-stat-cell">
          <div class="fin-stat-label">Tổng Chi</div>
          <div class="fin-stat-val red">${fmtMoney(d.totalExpense)}đ</div>
        </div>
        <div class="fin-stat-cell">
          <div class="fin-stat-label">Chuyển Khoản</div>
          <div class="fin-stat-val">${fmtMoney(d.totalBank)}đ</div>
        </div>
        <div class="fin-stat-cell">
          <div class="fin-stat-label">Cầm Về</div>
          <div class="fin-stat-val green">${fmtMoney(d.totalBring)}đ</div>
        </div>
      </div>
    `).join('');

    container.innerHTML = summaryHtml + `<div class="card"><div class="card-head">Chi Tiết Theo Ngày</div>${rowsHtml}</div>`;
  } catch (err) {
    showToast('Lỗi tải thống kê', 'error');
  } finally {
    hideLoading();
  }
}

// ── Shifts Management ──
let shiftsData = [];

async function loadShifts() {
  showLoading();
  try {
    shiftsData = await fetch('/api/admin/shifts').then(r => r.json());
    const typeLabel = { morning: 'Sáng', afternoon: 'Chiều', evening: 'Tối' };

    const container = document.getElementById('shifts-container');
    if (!container) return;

    container.innerHTML = shiftsData.map((s, i) => `
      <div class="shift-row" style="animation: fadeInUp 0.3s ease ${i * 0.05}s both">
        <div class="shift-info">
          <div class="shift-name-text">${s.name}</div>
          <div class="shift-pwd-text">🔑 ${s.password}</div>
        </div>
        <span class="shift-type-badge type-${s.shift_type}">${typeLabel[s.shift_type] || s.shift_type}</span>
        <button class="btn-sm btn-outline" onclick="editShift('${s.id}')">✏️ Sửa</button>
        <button class="btn-sm btn-danger" onclick="deleteShift('${s.id}')">🗑️</button>
      </div>
    `).join('');
  } catch (err) {
    showToast('Lỗi tải danh sách ca', 'error');
  } finally {
    hideLoading();
  }
}

function showShiftModal() {
  document.getElementById('shift-edit-id').value = '';
  document.getElementById('shift-name').value = '';
  document.getElementById('shift-pwd').value = '';
  document.getElementById('shift-type').value = 'morning';
  openModal('shift-modal');
}

function editShift(id) {
  const s = shiftsData.find(x => x.id === id);
  if (!s) return;
  document.getElementById('shift-edit-id').value = s.id;
  document.getElementById('shift-name').value = s.name;
  document.getElementById('shift-pwd').value = s.password;
  document.getElementById('shift-type').value = s.shift_type;
  openModal('shift-modal');
}

async function saveShift() {
  const id = document.getElementById('shift-edit-id').value;
  const name = document.getElementById('shift-name').value.trim();
  const pwd = document.getElementById('shift-pwd').value.trim();
  const type = document.getElementById('shift-type').value;

  // Form validation
  if (!name) {
    showToast('Vui lòng nhập tên ca', 'error');
    document.getElementById('shift-name').focus();
    return;
  }
  if (!pwd) {
    showToast('Vui lòng nhập mật khẩu', 'error');
    document.getElementById('shift-pwd').focus();
    return;
  }
  if (pwd.length < 3) {
    showToast('Mật khẩu phải có ít nhất 3 ký tự', 'error');
    document.getElementById('shift-pwd').focus();
    return;
  }

  showLoading();
  try {
    const payload = { name, password: pwd, shift_type: type, is_active: true };
    let url = '/api/admin/shifts';
    let method = 'POST';

    if (id) {
      url = `/api/admin/shifts/${id}`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Lỗi lưu ca');
    }

    const result = await response.json();
    closeModal('shift-modal');
    
    // Clear form
    document.getElementById('shift-edit-id').value = '';
    document.getElementById('shift-name').value = '';
    document.getElementById('shift-pwd').value = '';
    document.getElementById('shift-type').value = 'morning';
    
    await loadShifts();
    showToast('✅ Đã lưu ca!');
  } catch (err) {
    console.error('Error saving shift:', err);
    showToast(err.message || 'Lỗi lưu ca', 'error');
  } finally {
    hideLoading();
  }
}

async function deleteShift(id) {
  if (!confirm('Xoá ca này?')) return;
  showLoading();
  try {
    await fetch(`/api/admin/shifts/${id}`, { method: 'DELETE' });
    await loadShifts();
    showToast('Đã xoá ca');
  } catch (err) {
    showToast('Lỗi xoá ca', 'error');
  } finally {
    hideLoading();
  }
}

// ── Materials Management ──
let materialsData = [];

async function loadMaterials() {
  showLoading();
  try {
    materialsData = await fetch('/api/admin/materials').then(r => r.json());
    const CATS = ['TRÁI CÂY', 'KHÁC', 'SỮA / KEM', 'TOPPING', 'SỐT', 'TRÀ', 'ĂN VẶT'];
    const grouped = {};
    materialsData.forEach(m => {
      if (!grouped[m.category]) grouped[m.category] = [];
      grouped[m.category].push(m);
    });

    const container = document.getElementById('materials-container');
    if (!container) return;

    let html = '';
    CATS.forEach((cat, catIndex) => {
      if (!grouped[cat]) return;
      html += `<div class="card" style="margin-bottom:16px;animation: fadeInUp 0.3s ease ${catIndex * 0.05}s both">
        <div class="card-head">${cat}</div>
        <table class="data-table">
          <thead><tr><th>Tên</th><th>Đơn vị</th><th>Mặc định</th><th></th></tr></thead>
          <tbody>
            ${grouped[cat].map((m, i) => `
              <tr style="animation: fadeInUp 0.3s ease ${(catIndex * 0.1) + (i * 0.02)}s both">
                <td style="font-weight:600">${m.name}</td>
                <td style="color:var(--muted)">${m.unit}</td>
                <td>${m.default_value}</td>
                <td style="display:flex;gap:8px">
                  <button class="btn-sm btn-outline" onclick="editMaterial('${m.id}')">✏️</button>
                  <button class="btn-sm btn-danger" onclick="deleteMaterial('${m.id}')">🗑️</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
    });

    container.innerHTML = html;
  } catch (err) {
    showToast('Lỗi tải nguyên liệu', 'error');
  } finally {
    hideLoading();
  }
}

function showMaterialModal() {
  document.getElementById('mat-edit-id').value = '';
  document.getElementById('mat-category').value = 'TRÁI CÂY';
  document.getElementById('mat-name').value = '';
  document.getElementById('mat-unit').value = '';
  document.getElementById('mat-default').value = '0';
  openModal('material-modal');
}

function editMaterial(id) {
  const m = materialsData.find(x => x.id === id);
  if (!m) return;
  document.getElementById('mat-edit-id').value = m.id;
  document.getElementById('mat-category').value = m.category;
  document.getElementById('mat-name').value = m.name;
  document.getElementById('mat-unit').value = m.unit;
  document.getElementById('mat-default').value = m.default_value;
  openModal('material-modal');
}

async function saveMaterial() {
  const id = document.getElementById('mat-edit-id').value;
  const payload = {
    category: document.getElementById('mat-category').value,
    name: document.getElementById('mat-name').value.trim(),
    unit: document.getElementById('mat-unit').value.trim(),
    default_value: parseFloat(document.getElementById('mat-default').value) || 0
  };

  // Form validation
  if (!payload.name) {
    showToast('Vui lòng nhập tên nguyên liệu', 'error');
    document.getElementById('mat-name').focus();
    return;
  }
  if (!payload.unit) {
    showToast('Vui lòng nhập đơn vị', 'error');
    document.getElementById('mat-unit').focus();
    return;
  }

  showLoading();
  try {
    let url = '/api/admin/materials';
    let method = 'POST';

    if (id) {
      url = `/api/admin/materials/${id}`;
      method = 'PATCH';
    }

    const response = await fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Lỗi lưu nguyên liệu');
    }

    closeModal('material-modal');
    await loadMaterials();
    showToast('✅ Đã lưu nguyên liệu!');
  } catch (err) {
    showToast('Lỗi lưu nguyên liệu', 'error');
  } finally {
    hideLoading();
  }
}

async function deleteMaterial(id) {
  if (!confirm('Xoá nguyên liệu này?')) return;
  showLoading();
  try {
    await fetch(`/api/admin/materials/${id}`, { method: 'DELETE' });
    await loadMaterials();
    showToast('Đã xoá nguyên liệu');
  } catch (err) {
    showToast('Lỗi xoá nguyên liệu', 'error');
  } finally {
    hideLoading();
  }
}

// ── Initialize ──
document.addEventListener('DOMContentLoaded', () => {
  // Set current date
  document.getElementById('page-date').textContent = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const today = todayISO();
  // Set default dates
  ['report-from', 'report-to', 'cons-from', 'cons-to', 'fin-from', 'fin-to'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });

  // Initialize page
  showPage('dashboard');

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .loader-spinner {
      width: 50px;
      height: 50px;
      border: 4px solid rgba(234, 88, 12, 0.2);
      border-top-color: #ea580c;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .page {
      transition: opacity 0.3s ease, transform 0.3s ease;
    }
  `;
  document.head.appendChild(style);
});
