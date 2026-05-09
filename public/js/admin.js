/*
 * admin.js — Admin portal for managing users and projects.
 * Restricted to users with isAdmin flag set.
 */
var Admin = {
  load: function() {
    if (!App.state.user || !App.state.user.isAdmin) {
      App.toast('Admin access required', 'error');
      App.navigate('dashboard');
      return;
    }
    Admin.loadStats();
    Admin.loadUsers();
    Admin.loadProjects();
    Admin.bindTabs();
  },

  bindTabs: function() {
    document.querySelectorAll('.admin-tab').forEach(function(tab) {
      tab.onclick = function() {
        var tabName = this.getAttribute('data-admin-tab');
        document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.admin-panel').forEach(function(p) { p.classList.remove('active'); });
        this.classList.add('active');
        var panel = document.getElementById('admin-panel-' + tabName);
        if (panel) panel.classList.add('active');
      };
    });
  },

  loadStats: function() {
    API.get('/api/admin/stats').then(function(data) {
      document.getElementById('admin-total-users').textContent = data.totalUsers;
      document.getElementById('admin-total-projects').textContent = data.totalProjects;
      document.getElementById('admin-total-tasks').textContent = data.totalTasks;
      document.getElementById('admin-overdue-tasks').textContent = data.overdueTasks;
    }).catch(function(err) { console.error('Admin stats error:', err); });
  },

  loadUsers: function() {
    API.get('/api/admin/users').then(function(data) {
      var tbody = document.getElementById('admin-users-body');
      if (!data.users.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--text-muted)">No users found</td></tr>';
        return;
      }
      var html = '';
      data.users.forEach(function(u) {
        var isCurrentUser = u._id === App.state.user._id;
        var joinDate = new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        html += '<tr>';
        html += '<td><div style="display:flex;align-items:center;gap:.5rem">';
        html += '<div class="card-avatar" style="background:' + u.avatarColor + ';width:28px;height:28px;font-size:.65rem">' + u.name.charAt(0) + '</div>';
        html += '<span>' + u.name + (isCurrentUser ? ' <span style="color:var(--cyan);font-size:.7rem">(You)</span>' : '') + '</span>';
        html += '</div></td>';
        html += '<td style="color:var(--text-secondary)">' + u.email + '</td>';
        html += '<td><span class="project-role-badge ' + (u.isAdmin ? 'role-admin' : 'role-member') + '">' + (u.isAdmin ? 'Admin' : 'User') + '</span></td>';
        html += '<td>' + (u.projectCount || 0) + '</td>';
        html += '<td>' + (u.taskCount || 0) + '</td>';
        html += '<td>' + (u.completedTasks || 0) + '</td>';
        html += '<td style="color:var(--text-muted);font-size:.8rem">' + joinDate + '</td>';
        html += '<td><div style="display:flex;gap:.25rem">';
        if (!isCurrentUser) {
          html += '<button class="btn btn-sm btn-secondary" data-toggle-admin="' + u._id + '" title="' + (u.isAdmin ? 'Demote' : 'Promote') + '">' + (u.isAdmin ? '⬇ Demote' : '⬆ Promote') + '</button>';
          html += '<button class="btn btn-sm btn-danger" data-delete-user="' + u._id + '" title="Delete">🗑️</button>';
        } else {
          html += '<span style="color:var(--text-muted);font-size:.75rem">—</span>';
        }
        html += '</div></td></tr>';
      });
      tbody.innerHTML = html;

      // Bind action buttons
      tbody.onclick = function(e) {
        var toggleBtn = e.target.closest('[data-toggle-admin]');
        if (toggleBtn) {
          Admin.toggleAdmin(toggleBtn.getAttribute('data-toggle-admin'));
          return;
        }
        var deleteBtn = e.target.closest('[data-delete-user]');
        if (deleteBtn) {
          Admin.deleteUser(deleteBtn.getAttribute('data-delete-user'));
          return;
        }
      };
    }).catch(function(err) { console.error('Admin users error:', err); });
  },

  loadProjects: function() {
    API.get('/api/admin/projects').then(function(data) {
      var tbody = document.getElementById('admin-projects-body');
      if (!data.projects.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">No projects found</td></tr>';
        return;
      }
      var html = '';
      data.projects.forEach(function(p) {
        var createdDate = new Date(p.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        var creatorName = p.createdBy ? p.createdBy.name : 'Unknown';
        html += '<tr>';
        html += '<td><strong>' + p.name + '</strong></td>';
        html += '<td style="color:var(--text-secondary)">' + creatorName + '</td>';
        html += '<td>' + p.members.length + '</td>';
        html += '<td>' + (p.taskCount || 0) + '</td>';
        html += '<td>' + (p.completedCount || 0) + '</td>';
        html += '<td style="color:var(--text-muted);font-size:.8rem">' + createdDate + '</td>';
        html += '<td><button class="btn btn-sm btn-danger" data-admin-delete-project="' + p._id + '">🗑️ Delete</button></td>';
        html += '</tr>';
      });
      tbody.innerHTML = html;

      tbody.onclick = function(e) {
        var deleteBtn = e.target.closest('[data-admin-delete-project]');
        if (deleteBtn) {
          Admin.deleteProject(deleteBtn.getAttribute('data-admin-delete-project'));
        }
      };
    }).catch(function(err) { console.error('Admin projects error:', err); });
  },

  toggleAdmin: function(userId) {
    if (!confirm('Change this user\'s admin status?')) return;
    API.put('/api/admin/users/' + userId + '/toggle-admin').then(function(data) {
      App.toast(data.message);
      Admin.loadUsers();
      Admin.loadStats();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  deleteUser: function(userId) {
    if (!confirm('Delete this user? This cannot be undone. Their tasks will be unassigned.')) return;
    API.delete('/api/admin/users/' + userId).then(function() {
      App.toast('User deleted');
      Admin.loadUsers();
      Admin.loadStats();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  deleteProject: function(projectId) {
    if (!confirm('Delete this project and ALL its tasks? This cannot be undone.')) return;
    API.delete('/api/admin/projects/' + projectId).then(function() {
      App.toast('Project deleted');
      Admin.loadProjects();
      Admin.loadStats();
      Projects.loadSidebar();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  }
};
