(function () {
  'use strict';

  const API_URL = 'https://api.github.com/repos/NuriEnsing/TeknuroPowerToolsKanban/issues?state=all&per_page=100';

  const COLUMNS = [
    { key: 'backlog', label: '0 - Backlog', title: 'Backlog', accent: '#3b82f6', icon: iconBacklog },
    { key: 'ready', label: '1 - Ready', title: 'Ready', accent: '#f59e0b', icon: iconReady },
    { key: 'development', label: '2 - Development', title: 'Development', accent: '#ec4899', icon: iconDevelopment },
    { key: 'qa', label: '3 - Quality Assurance', title: 'Quality Assurance', accent: '#8b5cf6', icon: iconQA },
    { key: 'done', label: '4 - Done', title: 'Done', accent: '#22c55e', icon: iconDone }
  ];

  const PREFS_KEY = 'teknuroKanbanPrefs';

  let allIssues = [];
  let state = { filter: 'all', q: '' };

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function p2(n) { return String(n).padStart(2, '0'); }

  /* ===== Icons ===== */
  function svg(path, size) {
    size = size || 13;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  }

  function iconBacklog() {
    return svg('<path d="M3.5 13.5H8l1.5 2.5h5L16 13.5h4.5"/><path d="M6.2 5.5h11.6l2.7 8v3.8a2.2 2.2 0 0 1-2.2 2.2H5.7a2.2 2.2 0 0 1-2.2-2.2V13.5Z"/>');
  }

  function iconReady() {
    return svg('<circle cx="10.7" cy="10.7" r="6.7"/><path d="M15.6 15.6 21 21"/>');
  }

  function iconDevelopment() {
    return svg('<path d="M9.5 3.5v6.2L4.3 18a2.1 2.1 0 0 0 1.8 3.2h11.8a2.1 2.1 0 0 0 1.8-3.2l-5.2-8.3V3.5"/><path d="M8 3.5h8M6.6 14.8h10.8"/>');
  }

  function iconQA() {
    return svg('<path d="M12 3.2 20.4 7.8v8.4L12 20.8 3.6 16.2V7.8Z"/><path d="M3.6 7.8 12 12.4l8.4-4.6M12 12.4v8.4"/>');
  }

  function iconDone() {
    return svg('<path d="m4.5 12.5 5 5 10-11"/>', 14);
  }

  function iconDate() {
    return svg('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>', 12);
  }

  function iconTag() {
    return svg('<path d="M20.5 13.5 13 21a2.1 2.1 0 0 1-3 0L3 14V4.5h9.5l8 8a2.1 2.1 0 0 1 0 1Z"/><path d="M7.5 8.5h.01"/>', 11);
  }

  function iconNone() {
    return svg('<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M8 12h8"/>', 20);
  }

  /* ===== Theme ===== */
  function initTheme() {
    const btn = $('theme');
    if (!btn) return;

    const apply = function () {
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      btn.setAttribute('aria-pressed', theme === 'dark');
    };

    btn.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
        saved.theme = next;
        localStorage.setItem(PREFS_KEY, JSON.stringify(saved));
      } catch (e) {}
      apply();
    });

    apply();
  }

  /* ===== Search ===== */
  function initSearch() {
    const input = $('q');
    const clear = $('clear');
    const box = $('search');
    if (!input) return;

    const update = function () {
      state.q = input.value;
      if (box) box.classList.toggle('filled', !!input.value);
      applyFilters();
    };

    input.addEventListener('input', update);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        input.value = '';
        update();
        input.blur();
      }
    });

    if (clear) {
      clear.addEventListener('click', function () {
        input.value = '';
        update();
        input.focus();
      });
    }
  }

  /* ===== Tabs ===== */
  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) { t.classList.remove('is-active'); });
        tab.classList.add('is-active');
        state.filter = tab.getAttribute('data-filter');
        applyFilters();
      });
    });
  }

  /* ===== Filter logic ===== */
  function matchesSearch(issue, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const labelNames = (issue.labels || []).map(function (l) { return l.name; }).join(' ');
    const assignee = getAssignee(issue);
    const haystack = [
      String(issue.number),
      issue.title || '',
      issue.body || '',
      labelNames,
      assignee ? assignee.login : ''
    ].join(' ').toLowerCase();
    return haystack.indexOf(q) !== -1;
  }

  function applyFilters() {
    const filtered = allIssues.filter(function (issue) {
      const stateMatch = state.filter === 'all' || issue.state === state.filter;
      return stateMatch && matchesSearch(issue, state.q);
    });

    updateTabCounts();

    if (allIssues.length > 0 && filtered.length === 0) {
      renderBoard([]);
      showBanner('empty-banner', 'No issues match your filters.');
      return;
    }

    hideBanners();
    renderBoard(filtered);
  }

  function updateTabCounts() {
    const open = allIssues.filter(function (i) { return i.state === 'open'; }).length;
    const closed = allIssues.filter(function (i) { return i.state === 'closed'; }).length;
    const total = allIssues.length;

    const allEl = $('tab-count-all');
    const openEl = $('tab-count-open');
    const closedEl = $('tab-count-closed');

    if (allEl) allEl.textContent = String(total);
    if (openEl) openEl.textContent = String(open);
    if (closedEl) closedEl.textContent = String(closed);
  }

  /* ===== Column logic ===== */
  function determineColumn(issue) {
    if (issue.state === 'closed') return 'done';

    const labelNames = (issue.labels || []).map(function (l) { return l.name; });
    for (let i = 0; i < COLUMNS.length; i++) {
      if (labelNames.indexOf(COLUMNS[i].label) !== -1) {
        return COLUMNS[i].key;
      }
    }
    return 'backlog';
  }

  /* ===== Rendering ===== */
  function getAssignee(issue) {
    if (issue.assignee && issue.assignee.login) return issue.assignee;
    if (issue.assignees && issue.assignees.length > 0) return issue.assignees[0];
    return null;
  }

  function getTextColorForBackground(hexColor) {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 0;
    const g = parseInt(hex.substring(2, 4), 16) || 0;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#111827' : '#ffffff';
  }

  function renderLabel(label) {
    const textColor = getTextColorForBackground(label.color || 'cccccc');
    return '<span class="label" style="background-color: #' + esc(label.color || 'cccccc') + '; color: ' + textColor + ';">' + esc(label.name) + '</span>';
  }

  function highlight(text) {
    const q = state.q.trim();
    if (!q) return esc(text);
    const t = esc(text);
    const lower = t.toLowerCase();
    const idx = lower.indexOf(esc(q).toLowerCase());
    if (idx === -1) return t;
    const len = esc(q).length;
    return t.slice(0, idx) + '<mark>' + t.slice(idx, idx + len) + '</mark>' + t.slice(idx + len);
  }

  function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function renderCard(issue, index) {
    const columnKey = determineColumn(issue);
    const column = COLUMNS.find(function (c) { return c.key === columnKey; });
    const accent = column ? column.accent : '#3b82f6';
    const issueUrl = issue.html_url;
    const labelsHtml = (issue.labels || []).map(renderLabel).join('');
    const assignee = getAssignee(issue);
    const created = formatDate(issue.created_at);

    let foot = '';
    if (created) {
      foot += '<span class="date">' + iconDate() + '<span>' + esc(created) + '</span></span>';
    }
    if (assignee) {
      foot += '<span class="assignee">' +
        '<img src="' + esc(assignee.avatar_url) + '&s=32" alt="" loading="lazy">' +
        '<span>' + esc(assignee.login) + '</span>' +
      '</span>';
    } else {
      foot += '<span class="assignee">' + iconTag() + '<span>Unassigned</span></span>';
    }

    return (
      '<article class="card" style="animation-delay:' + Math.min(index * 60, 480) + 'ms">' +
        '<div class="accent" style="background:' + accent + '"></div>' +
        '<div class="body">' +
          '<a class="card-number" href="' + esc(issueUrl) + '" target="_blank" rel="noopener noreferrer">#' + esc(String(issue.number)) + '</a>' +
          '<h3><a href="' + esc(issueUrl) + '" target="_blank" rel="noopener noreferrer">' + highlight(issue.title || '(No title)') + '</a></h3>' +
          (labelsHtml ? '<div class="labels">' + labelsHtml + '</div>' : '') +
          '<div class="foot">' + foot + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function renderColumn(column) {
    return (
      '<article class="col" data-column="' + esc(column.label) + '">' +
        '<div class="colhead">' +
          '<div class="bar" style="background:' + column.accent + '"></div>' +
          '<div class="row">' +
            '<div style="display:flex;align-items:center;gap:8px;min-width:0">' +
              '<span class="cicon" style="color:' + column.accent + ';background:' + column.accent + '15">' + column.icon() + '</span>' +
              '<h2>' + esc(column.title) + '</h2>' +
            '</div>' +
            '<span class="count" id="count-' + column.key + '">0</span>' +
          '</div>' +
        '</div>' +
        '<div class="stack" id="col-' + column.key + '"></div>' +
      '</article>'
    );
  }

  function renderBoard(issues) {
    const board = $('board');
    if (!board) return;

    if (board.innerHTML === '') {
      board.innerHTML = COLUMNS.map(renderColumn).join('');
    }

    COLUMNS.forEach(function (column) {
      const stack = $('col-' + column.key);
      if (stack) stack.innerHTML = '';
    });

    issues.forEach(function (issue, index) {
      const columnKey = determineColumn(issue);
      const stack = $('col-' + columnKey);
      if (!stack) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderCard(issue, index);
      stack.appendChild(wrapper.firstElementChild);
    });

    COLUMNS.forEach(function (column) {
      const stack = $('col-' + column.key);
      const countEl = $('count-' + column.key);
      if (!stack || !countEl) return;

      const count = stack.querySelectorAll('.card').length;
      countEl.textContent = String(count);

      const existing = stack.querySelector('.empty');
      if (count === 0) {
        if (!existing) {
          const empty = document.createElement('div');
          empty.className = 'empty';
          empty.innerHTML = iconNone() + '<span>No issues</span>';
          stack.appendChild(empty);
        }
      } else if (existing) {
        existing.remove();
      }
    });
  }

  /* ===== Banners ===== */
  function showBanner(className, message) {
    const board = $('board');
    if (!board) return;

    hideBanners();

    const banner = document.createElement('div');
    banner.className = className;
    banner.id = 'status-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');

    let html = '';
    if (className === 'loading-banner') {
      html += '<span class="spinner" aria-hidden="true"></span>';
    }
    html += '<span>' + esc(message) + '</span>';

    if (className === 'error-banner') {
      html += '<button class="retry-btn" type="button">Retry</button>';
    }

    banner.innerHTML = html;
    board.parentNode.insertBefore(banner, board);

    const retry = banner.querySelector('.retry-btn');
    if (retry) {
      retry.addEventListener('click', function () {
        loadIssues();
      });
    }
  }

  function hideBanners() {
    const existing = $('status-banner');
    if (existing) existing.remove();
  }

  /* ===== Data loading ===== */
  function updateStamp() {
    const stamp = $('stamp');
    if (!stamp) return;
    const d = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    stamp.textContent = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' · ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    stamp.title = 'Last loaded at ' + d.toISOString();
  }

  function loadIssues() {
    showBanner('loading-banner', 'Loading issues from GitHub…');

    fetch(API_URL)
      .then(function (response) {
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('GitHub API rate limit exceeded. Please try again later.');
          }
          throw new Error('GitHub API returned ' + response.status + ' ' + response.statusText);
        }
        return response.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) {
          throw new Error('Unexpected response from GitHub.');
        }

        allIssues = data.filter(function (item) {
          return !item.pull_request;
        });

        updateStamp();

        if (allIssues.length === 0) {
          renderBoard([]);
          showBanner('empty-banner', 'No issues found in this repository.');
          updateTabCounts();
          return;
        }

        applyFilters();
      })
      .catch(function (error) {
        showBanner('error-banner', error.message || 'Failed to load issues.');
      });
  }

  /* ===== Init ===== */
  function init() {
    initTheme();
    initTabs();
    initSearch();
    loadIssues();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
