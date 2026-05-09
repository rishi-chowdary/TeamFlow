/*
 * projects.js — Project listing, creation, deletion, member management.
 * Renders the sidebar project list and project cards grid.
 */
var Projects = {
  load: function() {
    return API.get('/api/projects').then(function(data) {
      App.state.projects = data.projects;
      Projects.render(data.projects);
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  loadSidebar: function() {
    return API.get('/api/projects').then(function(data) {
      App.state.projects = data.projects;
      var list = document.getElementById('sidebar-project-list');
      var colors = ['#6C5CE7','#00CEC9','#E17055','#00B894','#E84393','#0984E3','#FDCB6E'];
      var html = '';
      for (var i = 0; i < data.projects.length; i++) {
        var p = data.projects[i];
        var isActive = App.state.currentProject === p._id ? 'active' : '';
        html += '<div class="sidebar-project-item ' + isActive + '" data-project-id="' + p._id + '">';
        html += '<div class="project-dot" style="background:' + colors[i % colors.length] + '"></div>';
        html += '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + p.name + '</span>';
        html += '<span style="font-size:.7rem;color:var(--text-muted)">' + (p.taskCounts ? p.taskCounts.total : 0) + '</span>';
        html += '</div>';
      }
      list.innerHTML = html;
    }).catch(function() {});
  },

  render: function(projects) {
    var grid = document.getElementById('projects-grid');
    if (!projects.length) {
      grid.innerHTML = '<div class="empty-state"><p>No projects yet. Create your first project!</p></div>';
      return;
    }
    var html = '';
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var myMember = null;
      for (var j = 0; j < p.members.length; j++) {
        var mUserId = p.members[j].user._id || p.members[j].user;
        if (mUserId === App.state.user._id) { myMember = p.members[j]; break; }
      }
      var myRole = myMember ? myMember.role : 'member';
      var tc = p.taskCounts || { total:0, done:0, in_progress:0, todo:0 };

      html += '<div class="project-card" data-project-id="' + p._id + '">';
      html += '<div class="project-card-header">';
      html += '<div class="project-card-title">' + App.esc(p.name) + '</div>';;
      html += '<span class="project-role-badge role-' + myRole + '">' + myRole + '</span>';
      html += '</div>';
      if (p.description) html += '<div class="project-card-desc">' + App.esc(p.description) + '</div>';
      html += '<div class="project-card-stats">';
      html += '<div class="project-stat"><span class="project-stat-num">' + tc.total + '</span><span class="project-stat-label">Tasks</span></div>';
      html += '<div class="project-stat"><span class="project-stat-num">' + tc.done + '</span><span class="project-stat-label">Done</span></div>';
      html += '<div class="project-stat"><span class="project-stat-num">' + tc.in_progress + '</span><span class="project-stat-label">Active</span></div>';
      html += '</div>';

      // Members
      html += '<div style="display:flex;align-items:center;justify-content:space-between">';
      html += '<div class="project-card-members">';
      var showMembers = Math.min(p.members.length, 5);
      for (var j = 0; j < showMembers; j++) {
        var u = p.members[j].user;
        html += '<div class="member-avatar" style="background:' + u.avatarColor + '" title="' + App.esc(u.name) + '">' + App.esc(u.name.charAt(0)) + '</div>';
      }
      if (p.members.length > 5) html += '<span class="member-count">+' + (p.members.length - 5) + '</span>';
      html += '</div>';

      // Admin actions
      if (myRole === 'admin') {
        html += '<div class="project-actions">';
        html += '<button class="btn-icon" data-manage-project="' + p._id + '" title="Manage"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg></button>';
        html += '<button class="btn-icon" data-delete-project="' + p._id + '" title="Delete"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg></button>';
        html += '</div>';
      }
      html += '</div></div>';
    }
    grid.innerHTML = html;

    // Bind project action clicks via delegation
    grid.onclick = function(e) {
      var manage = e.target.closest('[data-manage-project]');
      if (manage) { e.stopPropagation(); Projects.showManageModal(manage.getAttribute('data-manage-project')); return; }
      var del = e.target.closest('[data-delete-project]');
      if (del) { e.stopPropagation(); Projects.deleteProject(del.getAttribute('data-delete-project')); return; }
    };
  },

  showCreateModal: function() {
    App.openModal('New Project',
      '<form id="create-project-form">' +
      '<div class="form-group"><label>Project Name</label><input type="text" id="new-project-name" required placeholder="e.g. Marketing Campaign"></div>' +
      '<div class="form-group"><label>Description</label><textarea id="new-project-desc" placeholder="What\'s this project about?"></textarea></div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create Project</button></div>' +
      '</form>'
    );
    document.getElementById('create-project-form').onsubmit = function(e) {
      e.preventDefault();
      Projects.create();
    };
  },

  create: function() {
    var name = document.getElementById('new-project-name').value;
    var desc = document.getElementById('new-project-desc').value;
    return API.post('/api/projects', { name: name, description: desc }).then(function() {
      App.closeModal(); App.toast('Project created!'); Projects.load(); Projects.loadSidebar();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  deleteProject: function(id) {
    if (!confirm('Delete this project and all its tasks?')) return;
    return API.delete('/api/projects/' + id).then(function() {
      App.toast('Project deleted'); Projects.load(); Projects.loadSidebar();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  showManageModal: function(projectId) {
    var project = null;
    for (var i = 0; i < App.state.projects.length; i++) {
      if (App.state.projects[i]._id === projectId) { project = App.state.projects[i]; break; }
    }
    if (!project) return;

    var membersHTML = '';
    for (var i = 0; i < project.members.length; i++) {
      var m = project.members[i];
      var u = m.user;
      var adminCount = project.members.filter(function(x) { return x.role === 'admin'; }).length;
      var canRemove = m.role !== 'admin' || adminCount > 1;
      membersHTML += '<div class="member-row">';
      membersHTML += '<div class="member-avatar" style="background:' + u.avatarColor + ';width:32px;height:32px;border:none;margin:0">' + u.name.charAt(0) + '</div>';
      membersHTML += '<div class="member-row-info"><div class="member-row-name">' + App.esc(u.name) + '</div><div class="member-row-email">' + App.esc(u.email) + '</div></div>';
      membersHTML += '<span class="project-role-badge role-' + m.role + '">' + m.role + '</span>';
      if (canRemove) {
        membersHTML += '<button class="btn-icon" data-remove-member="' + u._id + '" title="Remove"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
      }
      membersHTML += '</div>';
    }

    var html = '<form id="edit-project-form">' +
      '<div class="form-group"><label>Project Name</label><input type="text" id="edit-project-name" value="' + project.name + '" required></div>' +
      '<div class="form-group"><label>Description</label><textarea id="edit-project-desc">' + (project.description||'') + '</textarea></div>' +
      '<div class="modal-actions"><button type="submit" class="btn btn-primary btn-sm">Save Changes</button></div>' +
      '</form>' +
      '<hr style="border-color:var(--border);margin:1.5rem 0">' +
      '<h3 style="font-size:.95rem;margin-bottom:.75rem">Team Members</h3>' +
      '<div class="members-list" id="members-list-container">' + membersHTML + '</div>' +
      '<hr style="border-color:var(--border);margin:1.5rem 0">' +
      '<h3 style="font-size:.95rem;margin-bottom:.75rem">Invite Member</h3>' +
      '<form id="invite-form" style="display:flex;gap:.5rem">' +
      '<input type="email" id="invite-email" placeholder="member@email.com" required style="flex:1">' +
      '<select id="invite-role" style="width:110px"><option value="member">Member</option><option value="admin">Admin</option></select>' +
      '<button type="submit" class="btn btn-primary btn-sm">Invite</button>' +
      '</form>';

    App.openModal('Manage Project', html);

    document.getElementById('edit-project-form').onsubmit = function(e) {
      e.preventDefault();
      Projects.updateProject(projectId);
    };
    document.getElementById('invite-form').onsubmit = function(e) {
      e.preventDefault();
      Projects.inviteMember(projectId);
    };
    document.getElementById('members-list-container').onclick = function(e) {
      var btn = e.target.closest('[data-remove-member]');
      if (btn) Projects.removeMember(projectId, btn.getAttribute('data-remove-member'));
    };
  },

  updateProject: function(id) {
    return API.put('/api/projects/' + id, {
      name: document.getElementById('edit-project-name').value,
      description: document.getElementById('edit-project-desc').value
    }).then(function() {
      App.toast('Project updated!'); Projects.load(); Projects.loadSidebar(); App.closeModal();
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  inviteMember: function(projectId) {
    return API.post('/api/projects/' + projectId + '/members', {
      email: document.getElementById('invite-email').value,
      role: document.getElementById('invite-role').value
    }).then(function() {
      App.toast('Member invited!'); Projects.load();
      Projects.loadSidebar();
      // Refresh modal
      setTimeout(function() { Projects.showManageModal(projectId); }, 300);
    }).catch(function(err) { App.toast(err.message, 'error'); });
  },

  removeMember: function(projectId, userId) {
    if (!confirm('Remove this member?')) return;
    return API.delete('/api/projects/' + projectId + '/members/' + userId).then(function() {
      App.toast('Member removed'); Projects.load();
      setTimeout(function() { Projects.showManageModal(projectId); }, 300);
    }).catch(function(err) { App.toast(err.message, 'error'); });
  }
};
