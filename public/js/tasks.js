/*
 * tasks.js — Kanban board with drag-and-drop, task CRUD,
 * priority/assignee filtering, and inline editing.
 */
var Tasks = {
  tasks: [],
  project: null,

  load: function(projectId) {
    if (!projectId) return;
    App.state.currentProject = projectId;

    var proj = null;
    for (var i = 0; i < App.state.projects.length; i++) {
      if (App.state.projects[i]._id === projectId) { proj = App.state.projects[i]; break; }
    }

    if (proj) {
      document.getElementById('tasks-project-title').textContent = proj.name;
      document.getElementById('tasks-subtitle').textContent = proj.description || 'Kanban board';
      Tasks.project = proj;
      Tasks.updateAssigneeFilter(proj);
    }
    document.getElementById('tasks-actions').style.display = 'flex';

    API.get('/api/tasks?project=' + projectId).then(function(data) {
      Tasks.tasks = data.tasks;
      Tasks.renderBoard(data.tasks);
    }).catch(function(err) {
      App.toast(err.message, 'error');
    });
  },

  updateAssigneeFilter: function(proj) {
    var sel = document.getElementById('filter-assignee');
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">All Members</option><option value="unassigned">Unassigned</option>';
    var members = proj.members || [];
    for (var i = 0; i < members.length; i++) {
      var u = members[i].user;
      sel.innerHTML += '<option value="' + u._id + '">' + App.esc(u.name) + '</option>';
    }
    sel.value = currentVal;
  },

  renderBoard: function(tasks) {
    var cols = { todo: [], in_progress: [], review: [], done: [] };
    for (var i = 0; i < tasks.length; i++) {
      if (cols[tasks[i].status]) cols[tasks[i].status].push(tasks[i]);
    }

    var statuses = ['todo', 'in_progress', 'review', 'done'];
    for (var s = 0; s < statuses.length; s++) {
      var status = statuses[s];
      var cards = cols[status];
      document.getElementById('count-' + status).textContent = cards.length;

      var html = '';
      if (cards.length === 0) {
        html = '<div style="text-align:center;padding:1rem;color:var(--text-muted);font-size:.8rem">No tasks</div>';
      } else {
        for (var c = 0; c < cards.length; c++) {
          html += Tasks.cardHTML(cards[c]);
        }
      }
      document.getElementById('cards-' + status).innerHTML = html;
    }
  },

  cardHTML: function(t) {
    var isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done';
    var duePart = t.dueDate ? '<span class="due-tag ' + (isOverdue ? 'overdue' : '') + '">📅 ' + App.formatDate(t.dueDate) + '</span>' : '';
    var assigneePart = t.assignedTo
      ? '<div class="card-avatar" style="background:' + t.assignedTo.avatarColor + '" title="' + App.esc(t.assignedTo.name) + '">' + App.esc(t.assignedTo.name.charAt(0)) + '</div>'
      : '';

    return '<div class="kanban-card" draggable="true" ondragstart="Tasks.dragStart(event,\'' + t._id + '\')" ondragend="Tasks.dragEnd(event)" onclick="Tasks.showEditModal(\'' + t._id + '\')">'
      + '<div class="kanban-card-title">' + App.esc(t.title) + '</div>'
      + (t.description ? '<div class="kanban-card-desc">' + App.esc(t.description) + '</div>' : '')
      + '<div class="kanban-card-footer">'
      + '<div class="kanban-card-meta">'
      + '<span class="priority-tag priority-' + t.priority + '">' + t.priority + '</span>'
      + duePart
      + '</div>'
      + assigneePart
      + '</div>'
      + '</div>';
  },

  applyFilters: function() {
    var priority = document.getElementById('filter-priority').value;
    var assignee = document.getElementById('filter-assignee').value;
    var filtered = Tasks.tasks.slice();

    if (priority) {
      filtered = filtered.filter(function(t) { return t.priority === priority; });
    }
    if (assignee === 'unassigned') {
      filtered = filtered.filter(function(t) { return !t.assignedTo; });
    } else if (assignee) {
      filtered = filtered.filter(function(t) { return t.assignedTo && t.assignedTo._id === assignee; });
    }
    Tasks.renderBoard(filtered);
  },

  // drag-and-drop handlers
  dragStart: function(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.target.classList.add('dragging');
  },
  dragEnd: function(e) { e.target.classList.remove('dragging'); },
  dragOver: function(e) { e.preventDefault(); },
  drop: function(e, newStatus) {
    e.preventDefault();
    var taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    API.patch('/api/tasks/' + taskId + '/status', { status: newStatus }).then(function() {
      Tasks.load(App.state.currentProject);
    }).catch(function(err) {
      App.toast(err.message, 'error');
    });
  },

  showCreateModal: function() {
    if (!App.state.currentProject) {
      App.toast('Select a project first', 'error');
      return;
    }
    var proj = Tasks.project;
    var membersOpts = '';
    var members = (proj && proj.members) ? proj.members : [];
    for (var i = 0; i < members.length; i++) {
      membersOpts += '<option value="' + members[i].user._id + '">' + App.esc(members[i].user.name) + '</option>';
    }

    App.openModal('New Task',
      '<form onsubmit="Tasks.create(event)">' +
      '<div class="form-group"><label>Title</label><input type="text" id="task-title" required placeholder="What needs to be done?"></div>' +
      '<div class="form-group"><label>Description</label><textarea id="task-desc" placeholder="Add details..."></textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
        '<div class="form-group"><label>Priority</label><select id="task-priority"><option value="low">🟢 Low</option><option value="medium" selected>🟡 Medium</option><option value="high">🟠 High</option><option value="urgent">🔴 Urgent</option></select></div>' +
        '<div class="form-group"><label>Status</label><select id="task-status"><option value="todo">To Do</option><option value="in_progress">In Progress</option><option value="review">Review</option></select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
        '<div class="form-group"><label>Assign To</label><select id="task-assignee"><option value="">Unassigned</option>' + membersOpts + '</select></div>' +
        '<div class="form-group"><label>Due Date</label><input type="date" id="task-due"></div>' +
      '</div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button><button type="submit" class="btn btn-primary">Create Task</button></div>' +
      '</form>'
    );
  },

  create: function(e) {
    e.preventDefault();
    API.post('/api/tasks', {
      title: document.getElementById('task-title').value,
      description: document.getElementById('task-desc').value,
      priority: document.getElementById('task-priority').value,
      status: document.getElementById('task-status').value,
      assignedTo: document.getElementById('task-assignee').value || null,
      dueDate: document.getElementById('task-due').value || null,
      project: App.state.currentProject
    }).then(function() {
      App.closeModal();
      App.toast('Task created!');
      Tasks.load(App.state.currentProject);
    }).catch(function(err) {
      App.toast(err.message, 'error');
    });
  },

  showEditModal: function(taskId) {
    var t = null;
    for (var i = 0; i < Tasks.tasks.length; i++) {
      if (Tasks.tasks[i]._id === taskId) { t = Tasks.tasks[i]; break; }
    }
    if (!t) return;

    var proj = Tasks.project;
    var members = (proj && proj.members) ? proj.members : [];
    var membersOpts = '';
    for (var i = 0; i < members.length; i++) {
      var selected = (t.assignedTo && t.assignedTo._id === members[i].user._id) ? ' selected' : '';
      membersOpts += '<option value="' + members[i].user._id + '"' + selected + '>' + App.esc(members[i].user.name) + '</option>';
    }

    var dueVal = t.dueDate ? t.dueDate.split('T')[0] : '';
    var selOpt = function(field, val) { return t[field] === val ? ' selected' : ''; };

    App.openModal('Edit Task',
      '<form onsubmit="Tasks.update(event, \'' + t._id + '\')">' +
      '<div class="form-group"><label>Title</label><input type="text" id="edit-task-title" value="' + App.esc(t.title) + '" required></div>' +
      '<div class="form-group"><label>Description</label><textarea id="edit-task-desc">' + App.esc(t.description || '') + '</textarea></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
        '<div class="form-group"><label>Priority</label><select id="edit-task-priority">' +
          '<option value="low"' + selOpt('priority','low') + '>🟢 Low</option>' +
          '<option value="medium"' + selOpt('priority','medium') + '>🟡 Medium</option>' +
          '<option value="high"' + selOpt('priority','high') + '>🟠 High</option>' +
          '<option value="urgent"' + selOpt('priority','urgent') + '>🔴 Urgent</option>' +
        '</select></div>' +
        '<div class="form-group"><label>Status</label><select id="edit-task-status">' +
          '<option value="todo"' + selOpt('status','todo') + '>To Do</option>' +
          '<option value="in_progress"' + selOpt('status','in_progress') + '>In Progress</option>' +
          '<option value="review"' + selOpt('status','review') + '>Review</option>' +
          '<option value="done"' + selOpt('status','done') + '>Done</option>' +
        '</select></div>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">' +
        '<div class="form-group"><label>Assign To</label><select id="edit-task-assignee"><option value="">Unassigned</option>' + membersOpts + '</select></div>' +
        '<div class="form-group"><label>Due Date</label><input type="date" id="edit-task-due" value="' + dueVal + '"></div>' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button type="button" class="btn btn-danger btn-sm" onclick="Tasks.deleteTask(\'' + t._id + '\')">Delete</button>' +
        '<div style="flex:1"></div>' +
        '<button type="button" class="btn btn-secondary" onclick="App.closeModal()">Cancel</button>' +
        '<button type="submit" class="btn btn-primary">Save</button>' +
      '</div>' +
      '</form>'
    );
  },

  update: function(e, taskId) {
    e.preventDefault();
    API.put('/api/tasks/' + taskId, {
      title: document.getElementById('edit-task-title').value,
      description: document.getElementById('edit-task-desc').value,
      priority: document.getElementById('edit-task-priority').value,
      status: document.getElementById('edit-task-status').value,
      assignedTo: document.getElementById('edit-task-assignee').value || null,
      dueDate: document.getElementById('edit-task-due').value || null
    }).then(function() {
      App.closeModal();
      App.toast('Task updated!');
      Tasks.load(App.state.currentProject);
    }).catch(function(err) {
      App.toast(err.message, 'error');
    });
  },

  deleteTask: function(taskId) {
    if (!confirm('Delete this task? This action cannot be undone.')) return;
    API.delete('/api/tasks/' + taskId).then(function() {
      App.closeModal();
      App.toast('Task deleted');
      Tasks.load(App.state.currentProject);
    }).catch(function(err) {
      App.toast(err.message, 'error');
    });
  }
};
