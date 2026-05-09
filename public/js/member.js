/*
 * member.js — Personal member portal showing assigned tasks,
 * projects, and progress. Allows inline status changes and task editing.
 */
var Member = {
  data: null,
  currentTab: 'my-tasks',
  currentFilter: 'all',

  load: function() {
    Member.loadPortal();
    Member.bindTabs();
  },

  bindTabs: function() {
    var tabs = document.querySelectorAll('.member-tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].onclick = function() {
        var tabName = this.getAttribute('data-member-tab');
        var allTabs = document.querySelectorAll('.member-tab-btn');
        var allPanels = document.querySelectorAll('.member-panel');

        for (var j = 0; j < allTabs.length; j++) allTabs[j].classList.remove('active');
        for (var j = 0; j < allPanels.length; j++) allPanels[j].classList.remove('active');

        this.classList.add('active');
        Member.currentTab = tabName;
        var panel = document.getElementById('member-panel-' + tabName);
        if (panel) panel.classList.add('active');
      };
    }
  },

  loadPortal: function() {
    API.get('/api/member/portal').then(function(data) {
      Member.data = data;
      Member.renderStats(data.stats);
      Member.renderPriorities(data.priorities);
      Member.renderTasks(data.tasks);
      Member.renderProjects(data.projects);
    }).catch(function(err) {
      console.error('[MemberPortal]', err.message);
    });
  },

  renderStats: function(stats) {
    document.getElementById('member-total-tasks').textContent = stats.totalTasks;
    document.getElementById('member-in-progress').textContent = stats.inProgressTasks;
    document.getElementById('member-completed').textContent = stats.doneTasks;
    document.getElementById('member-overdue').textContent = stats.overdueTasks;
  },

  renderPriorities: function(priorities) {
    var container = document.getElementById('member-priority-summary');
    if (!container) return;

    var total = priorities.urgent + priorities.high + priorities.medium + priorities.low;
    if (total === 0) {
      container.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--text-muted)">No active tasks</div>';
      return;
    }

    var items = [
      { label: 'Urgent', count: priorities.urgent, color: 'var(--red)' },
      { label: 'High',   count: priorities.high,   color: 'var(--orange)' },
      { label: 'Medium', count: priorities.medium,  color: 'var(--yellow)' },
      { label: 'Low',    count: priorities.low,     color: 'var(--green)' }
    ];

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var pct = total > 0 ? Math.round((items[i].count / total) * 100) : 0;
      html += '<div class="priority-item">';
      html += '<div class="priority-badge" style="background:' + items[i].color + '"></div>';
      html += '<div class="priority-info"><span>' + items[i].label + '</span></div>';
      html += '<div class="priority-bar"><div class="priority-bar-fill" style="width:' + pct + '%;background:' + items[i].color + '"></div></div>';
      html += '<div class="priority-count">' + items[i].count + '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  },

  renderTasks: function(tasks) {
    var tbody = document.getElementById('member-tasks-body');
    if (!tasks || !tasks.length) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No tasks assigned to you yet</td></tr>';
      return;
    }

    // apply active filter
    var filtered = tasks;
    switch (Member.currentFilter) {
      case 'active':
        filtered = tasks.filter(function(t) { return t.status !== 'done'; });
        break;
      case 'done':
        filtered = tasks.filter(function(t) { return t.status === 'done'; });
        break;
      case 'overdue':
        filtered = tasks.filter(function(t) {
          return t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
        });
        break;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No tasks match this filter</td></tr>';
      return;
    }

    var priorityIcons = { low: '🟢', medium: '🟡', high: '🟠', urgent: '🔴' };
    var html = '';

    for (var i = 0; i < filtered.length; i++) {
      var t = filtered[i];
      var projectName = (t.project && t.project.name) ? App.esc(t.project.name) : 'Unknown';
      var dueDate = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
      var isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
      var icon = priorityIcons[t.priority] || '';
      var priorityLabel = t.priority.charAt(0).toUpperCase() + t.priority.slice(1);

      html += '<tr class="member-task-row">';

      // task name + description preview
      html += '<td><strong class="member-task-title">' + App.esc(t.title) + '</strong>';
      if (t.description) {
        html += '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + App.esc(t.description) + '</div>';
      }
      html += '</td>';

      html += '<td><span class="member-project-tag">' + projectName + '</span></td>';
      html += '<td><span class="member-priority-tag priority-' + t.priority + '">' + icon + ' ' + priorityLabel + '</span></td>';

      // status dropdown
      html += '<td>';
      html += '<select class="member-status-select status-select-' + t.status + '" data-task-id="' + t._id + '" onchange="Member.changeStatus(this)">';
      html += '<option value="todo"' + (t.status === 'todo' ? ' selected' : '') + '>To Do</option>';
      html += '<option value="in_progress"' + (t.status === 'in_progress' ? ' selected' : '') + '>In Progress</option>';
      html += '<option value="review"' + (t.status === 'review' ? ' selected' : '') + '>Review</option>';
      html += '<option value="done"' + (t.status === 'done' ? ' selected' : '') + '>Done</option>';
      html += '</select>';
      html += '</td>';

      html += '<td style="' + (isOverdue ? 'color:var(--red);font-weight:600' : 'color:var(--text-secondary)') + '">' + dueDate + (isOverdue ? ' ⚠️' : '') + '</td>';
      html += '<td style="color:var(--text-muted);font-size:.8rem">' + App.timeAgo(t.updatedAt) + '</td>';
      html += '<td><button class="btn btn-sm btn-secondary" onclick="Member.editTask(\'' + t._id + '\')" title="Edit task">✏️</button></td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
  },

  renderProjects: function(projects) {
    var tbody = document.getElementById('member-projects-body');
    if (!projects || !projects.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">You\'re not part of any projects yet</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var createdDate = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      var creatorName = (p.createdBy && p.createdBy.name) ? App.esc(p.createdBy.name) : 'Unknown';
      var progress = p.myTaskCount > 0 ? Math.round((p.myCompletedCount / p.myTaskCount) * 100) : 0;

      html += '<tr>';
      html += '<td><strong>' + App.esc(p.name) + '</strong>';
      if (p.description) html += '<div style="font-size:.75rem;color:var(--text-muted);margin-top:.15rem">' + App.esc(p.description) + '</div>';
      html += '</td>';
      html += '<td><span class="project-role-badge ' + (p.myRole === 'admin' ? 'role-admin' : 'role-member') + '">' + (p.myRole === 'admin' ? 'Admin' : 'Member') + '</span></td>';
      html += '<td>' + p.members.length + '</td>';
      html += '<td><div style="display:flex;align-items:center;gap:.5rem">';
      html += '<span>' + p.myCompletedCount + '/' + p.myTaskCount + '</span>';
      html += '<div class="member-progress-bar"><div class="member-progress-fill" style="width:' + progress + '%"></div></div>';
      html += '</div></td>';
      html += '<td style="color:var(--text-muted);font-size:.8rem">' + createdDate + '</td>';
      html += '<td><button class="btn btn-sm btn-primary" onclick="App.openProjectTasks(\'' + p._id + '\')">Open →</button></td>';
      html += '</tr>';
    }
    tbody.innerHTML = html;
  },

  filterTasks: function(filter) {
    Member.currentFilter = filter;
    var buttons = document.querySelectorAll('.member-filter-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].getAttribute('data-filter') === filter);
    }
    if (Member.data) Member.renderTasks(Member.data.tasks);
  },

  changeStatus: function(selectEl) {
    var taskId = selectEl.getAttribute('data-task-id');
    var newStatus = selectEl.value;

    API.patch('/api/member/tasks/' + taskId + '/status', { status: newStatus }).then(function() {
      App.toast('Status updated');
      selectEl.className = 'member-status-select status-select-' + newStatus;
      Member.loadPortal();
    }).catch(function(err) {
      App.toast(err.message, 'error');
      Member.loadPortal();
    });
  },

  editTask: function(taskId) {
    if (!Member.data) return;

    var task = null;
    for (var i = 0; i < Member.data.tasks.length; i++) {
      if (Member.data.tasks[i]._id === taskId) { task = Member.data.tasks[i]; break; }
    }
    if (!task) return;

    var dueVal = (task.dueDate && task.dueDate.indexOf('T') !== -1) ? task.dueDate.split('T')[0] : (task.dueDate || '');
    var selOpt = function(field, val) { return task[field] === val ? ' selected' : ''; };

    var html = '<form id="member-edit-task-form">'
      + '<div class="form-group"><label>Title</label>'
      + '<input type="text" id="edit-task-title" value="' + App.esc(task.title || '') + '" required></div>'
      + '<div class="form-group"><label>Description</label>'
      + '<textarea id="edit-task-desc" rows="3">' + App.esc(task.description || '') + '</textarea></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">'
      + '<div class="form-group"><label>Priority</label><select id="edit-task-priority">'
      + '<option value="low"' + selOpt('priority','low') + '>Low</option>'
      + '<option value="medium"' + selOpt('priority','medium') + '>Medium</option>'
      + '<option value="high"' + selOpt('priority','high') + '>High</option>'
      + '<option value="urgent"' + selOpt('priority','urgent') + '>Urgent</option>'
      + '</select></div>'
      + '<div class="form-group"><label>Due Date</label>'
      + '<input type="date" id="edit-task-due" value="' + dueVal + '"></div>'
      + '</div>'
      + '<div class="modal-actions">'
      + '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>'
      + '<button type="submit" class="btn btn-primary">Save Changes</button>'
      + '</div></form>';

    App.openModal('Edit Task', html);

    document.getElementById('member-edit-task-form').onsubmit = function(e) {
      e.preventDefault();
      var payload = {
        title: document.getElementById('edit-task-title').value,
        description: document.getElementById('edit-task-desc').value,
        priority: document.getElementById('edit-task-priority').value,
        dueDate: document.getElementById('edit-task-due').value || null
      };
      API.patch('/api/member/tasks/' + taskId, payload).then(function() {
        App.toast('Task updated!');
        App.closeModal();
        Member.loadPortal();
      }).catch(function(err) {
        App.toast(err.message, 'error');
      });
    };
  }
};
