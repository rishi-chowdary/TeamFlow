/*
 * dashboard.js — Renders the main dashboard: stats, progress bars,
 * priority breakdown, overdue tasks, user's tasks, and recent activity.
 */
var Dashboard = {
  load: function() {
    API.get('/api/dashboard').then(function(data) {
      Dashboard.renderStats(data.stats, data.overdueTasks.length);
      Dashboard.renderProgress(data.stats);
      Dashboard.renderPriorities(data.priorities);
      Dashboard.renderOverdue(data.overdueTasks);
      Dashboard.renderMyTasks(data.myTasks);
      Dashboard.renderActivity(data.recentTasks);
    }).catch(function(err) {
      console.error('[Dashboard]', err.message);
    });
  },

  renderStats: function(stats, overdueCount) {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-in-progress').textContent = stats.in_progress;
    document.getElementById('stat-done').textContent = stats.done;
    document.getElementById('stat-overdue').textContent = overdueCount;
  },

  renderProgress: function(stats) {
    var total = stats.total || 1;
    var items = [
      { label: 'To Do',       count: stats.todo,        color: '#555577' },
      { label: 'In Progress', count: stats.in_progress, color: '#0984E3' },
      { label: 'Review',      count: stats.review,      color: '#FDCB6E' },
      { label: 'Done',        count: stats.done,        color: '#00B894' }
    ];

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var pct = (items[i].count / total * 100).toFixed(1);
      html += '<div class="progress-bar-item">';
      html += '<div class="progress-bar-label"><span>' + items[i].label + '</span><span>' + items[i].count + '</span></div>';
      html += '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + pct + '%;background:' + items[i].color + '"></div></div>';
      html += '</div>';
    }
    document.getElementById('progress-bars').innerHTML = html;
  },

  renderPriorities: function(p) {
    var total = (p.low + p.medium + p.high + p.urgent) || 1;
    var items = [
      { label: 'Urgent', count: p.urgent, color: '#D63031' },
      { label: 'High',   count: p.high,   color: '#E17055' },
      { label: 'Medium', count: p.medium, color: '#FDCB6E' },
      { label: 'Low',    count: p.low,    color: '#00B894' }
    ];

    var html = '';
    for (var i = 0; i < items.length; i++) {
      var pct = (items[i].count / total * 100).toFixed(1);
      html += '<div class="priority-item">';
      html += '<div class="priority-badge" style="background:' + items[i].color + '"></div>';
      html += '<div class="priority-info"><span>' + items[i].label + '</span></div>';
      html += '<div class="priority-bar"><div class="priority-bar-fill" style="width:' + pct + '%;background:' + items[i].color + '"></div></div>';
      html += '<div class="priority-count">' + items[i].count + '</div>';
      html += '</div>';
    }
    document.getElementById('priority-chart').innerHTML = html;
  },

  renderOverdue: function(tasks) {
    var el = document.getElementById('overdue-list');
    if (!tasks.length) {
      el.innerHTML = '<div class="empty-state"><p>No overdue tasks — nice work!</p></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var pColors = { low: '#00B894', medium: '#FDCB6E', high: '#E17055', urgent: '#D63031' };
      var pColor = pColors[t.priority] || '#555577';
      var projName = (t.project && t.project.name) ? App.esc(t.project.name) : '';

      html += '<div class="task-mini">';
      html += '<div class="task-mini-priority" style="background:' + pColor + '"></div>';
      html += '<div class="task-mini-info">';
      html += '<span class="task-mini-title">' + App.esc(t.title) + '</span>';
      html += '<span class="task-mini-meta">' + projName + ' · Due ' + App.formatDate(t.dueDate) + '</span>';
      html += '</div>';
      if (t.assignedTo) {
        html += '<div class="card-avatar" style="background:' + t.assignedTo.avatarColor + '">' + App.esc(t.assignedTo.name.charAt(0)) + '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
  },

  renderMyTasks: function(tasks) {
    var el = document.getElementById('my-tasks-list');
    if (!tasks.length) {
      el.innerHTML = '<div class="empty-state"><p>No tasks assigned to you</p></div>';
      return;
    }

    var statusLabels = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
    var pColors = { low: '#00B894', medium: '#FDCB6E', high: '#E17055', urgent: '#D63031' };
    var html = '';

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var projName = (t.project && t.project.name) ? App.esc(t.project.name) : '';
      var statusText = statusLabels[t.status] || t.status;
      var duePart = t.dueDate ? ' · Due ' + App.formatDate(t.dueDate) : '';

      html += '<div class="task-mini">';
      html += '<div class="task-mini-priority" style="background:' + (pColors[t.priority] || '#555577') + '"></div>';
      html += '<div class="task-mini-info">';
      html += '<span class="task-mini-title">' + App.esc(t.title) + '</span>';
      html += '<span class="task-mini-meta">' + projName + ' · ' + statusText + duePart + '</span>';
      html += '</div>';
      html += '</div>';
    }
    el.innerHTML = html;
  },

  renderActivity: function(tasks) {
    var el = document.getElementById('recent-activity');
    if (!tasks.length) {
      el.innerHTML = '<div class="empty-state"><p>No recent activity</p></div>';
      return;
    }

    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var user = t.createdBy || {};
      var userName = App.esc(user.name || 'Someone');
      var projName = (t.project && t.project.name) ? App.esc(t.project.name) : 'a project';

      html += '<div class="activity-item">';
      html += '<div class="activity-avatar" style="background:' + (user.avatarColor || '#6C5CE7') + '">' + (user.name || '?').charAt(0) + '</div>';
      html += '<div>';
      html += '<div class="activity-text"><strong>' + userName + '</strong> updated <strong>' + App.esc(t.title) + '</strong> in ' + projName + '</div>';
      html += '<div class="activity-time">' + App.timeAgo(t.updatedAt) + '</div>';
      html += '</div>';
      html += '</div>';
    }
    el.innerHTML = html;
  }
};
