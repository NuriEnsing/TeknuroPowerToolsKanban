(function () {
  'use strict';

  const API_URL = 'https://api.github.com/repos/NuriEnsing/TeknuroPowerToolsKanban/issues?state=all&per_page=100';
  const NEW_ISSUE_URL = 'https://github.com/NuriEnsing/TeknuroPowerToolsKanban/issues/new';

  const COLUMNS = [
    { label: '0 - Backlog', id: 'col-0-backlog' },
    { label: '1 - Ready', id: 'col-1-ready' },
    { label: '2 - Development', id: 'col-2-development' },
    { label: '3 - Quality Assurance', id: 'col-3-quality-assurance' },
    { label: '4 - Done', id: 'col-4-done' }
  ];

  const statusBanner = document.getElementById('status-banner');
  const searchInput = document.getElementById('search-input');
  const filterButtons = document.querySelectorAll('.filter-btn');

  let allIssues = [];
  let currentFilter = 'all';
  let currentSearch = '';

  function setStatus(type, message, retryCallback) {
    statusBanner.className = 'status-banner ' + type;
    let html = '';

    if (type === 'loading') {
      html += '<span class="spinner" aria-hidden="true"></span>';
    }

    html += '<span>' + escapeHtml(message) + '</span>';

    if (retryCallback) {
      html += '<button class="retry-btn" type="button">Retry</button>';
    }

    statusBanner.innerHTML = html;

    const retryBtn = statusBanner.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', retryCallback);
    }
  }

  function clearStatus() {
    statusBanner.className = 'status-banner';
    statusBanner.innerHTML = '';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    return '<span class="label" style="background-color: #' + escapeHtml(label.color || 'cccccc') + '; color: ' + textColor + ';">' + escapeHtml(label.name) + '</span>';
  }

  function getAssignee(issue) {
    if (issue.assignee && issue.assignee.login) {
      return issue.assignee;
    }
    if (issue.assignees && issue.assignees.length > 0) {
      return issue.assignees[0];
    }
    return null;
  }

  function renderAssignee(issue) {
    const assignee = getAssignee(issue);

    if (assignee) {
      return (
        '<div class="card-footer">' +
          '<img class="assignee-avatar" src="' + escapeHtml(assignee.avatar_url) + '&s=48" alt="" loading="lazy">' +
          '<span class="assignee-name">' + escapeHtml(assignee.login) + '</span>' +
        '</div>'
      );
    }

    return (
      '<div class="card-footer">' +
        '<span class="assignee-empty" aria-hidden="true">?</span>' +
        '<span class="assignee-name">Unassigned</span>' +
      '</div>'
    );
  }

  function renderCard(issue) {
    const labelsHtml = (issue.labels || []).map(renderLabel).join('');
    const issueUrl = issue.html_url;
    const stateClass = issue.state === 'closed' ? 'card-state-closed' : '';

    return (
      '<article class="card ' + stateClass + '">' +
        '<div class="card-header">' +
          '<a class="card-number" href="' + escapeHtml(issueUrl) + '" target="_blank" rel="noopener noreferrer">#' + escapeHtml(String(issue.number)) + '</a>' +
        '</div>' +
        '<a class="card-title" href="' + escapeHtml(issueUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(issue.title || '(No title)') + '</a>' +
        (labelsHtml ? '<div class="card-labels">' + labelsHtml + '</div>' : '') +
        renderAssignee(issue) +
      '</article>'
    );
  }

  function determineColumn(issue) {
    if (issue.state === 'closed') {
      return '4 - Done';
    }

    const labelNames = (issue.labels || []).map(function (label) { return label.name; });

    for (let i = 0; i < COLUMNS.length; i++) {
      if (labelNames.indexOf(COLUMNS[i].label) !== -1) {
        return COLUMNS[i].label;
      }
    }

    return '0 - Backlog';
  }

  function updateColumnCounts() {
    COLUMNS.forEach(function (column) {
      const container = document.getElementById(column.id);
      const count = container.querySelectorAll('.card').length;
      const header = container.closest('.column').querySelector('.column-count');
      header.textContent = String(count);
      header.setAttribute('aria-label', count + ' issue' + (count === 1 ? '' : 's'));

      const existingEmpty = container.querySelector('.column-empty');
      if (count === 0) {
        if (!existingEmpty) {
          const empty = document.createElement('div');
          empty.className = 'column-empty';
          empty.textContent = 'No issues';
          container.appendChild(empty);
        }
      } else if (existingEmpty) {
        existingEmpty.remove();
      }
    });
  }

  function renderBoard(issues) {
    COLUMNS.forEach(function (column) {
      document.getElementById(column.id).innerHTML = '';
    });

    issues.forEach(function (issue) {
      const columnLabel = determineColumn(issue);
      const column = COLUMNS.find(function (c) { return c.label === columnLabel; });
      if (!column) return;

      const container = document.getElementById(column.id);
      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderCard(issue);
      container.appendChild(wrapper.firstElementChild);
    });

    updateColumnCounts();
  }

  function matchesSearch(issue, query) {
    if (!query) return true;

    const lowerQuery = query.toLowerCase();
    const numberMatch = String(issue.number).indexOf(lowerQuery) !== -1;
    const titleMatch = (issue.title || '').toLowerCase().indexOf(lowerQuery) !== -1;
    const labelMatch = (issue.labels || []).some(function (label) {
      return label.name.toLowerCase().indexOf(lowerQuery) !== -1;
    });
    const assignee = getAssignee(issue);
    const assigneeMatch = assignee && assignee.login.toLowerCase().indexOf(lowerQuery) !== -1;

    return numberMatch || titleMatch || labelMatch || assigneeMatch;
  }

  function applyFilters() {
    const filtered = allIssues.filter(function (issue) {
      const stateMatch = currentFilter === 'all' || issue.state === currentFilter;
      const searchMatch = matchesSearch(issue, currentSearch);
      return stateMatch && searchMatch;
    });

    if (allIssues.length > 0 && filtered.length === 0) {
      renderBoard([]);
      setStatus('empty', 'No issues match your filters.');
      return;
    }

    clearStatus();
    renderBoard(filtered);
  }

  function setActiveFilterButton(filter) {
    filterButtons.forEach(function (btn) {
      if (btn.getAttribute('data-filter') === filter) {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });
  }

  function handleFilterClick(event) {
    const btn = event.target.closest('.filter-btn');
    if (!btn) return;

    currentFilter = btn.getAttribute('data-filter');
    setActiveFilterButton(currentFilter);
    applyFilters();
  }

  function handleSearchInput(event) {
    currentSearch = event.target.value.trim();
    applyFilters();
  }

  function loadIssues() {
    setStatus('loading', 'Loading issues from GitHub…');

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

        if (allIssues.length === 0) {
          setStatus('empty', 'No issues found in this repository.');
          renderBoard([]);
          return;
        }

        applyFilters();
      })
      .catch(function (error) {
        setStatus('error', error.message || 'Failed to load issues.', function () {
          loadIssues();
        });
      });
  }

  filterButtons.forEach(function (btn) {
    btn.addEventListener('click', handleFilterClick);
  });

  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
  }

  document.addEventListener('DOMContentLoaded', loadIssues);
})();
