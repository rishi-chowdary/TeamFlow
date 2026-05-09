/*
 * app.js — Core SPA routing, API layer, and shared utilities.
 * Handles navigation, auth state, SSE events, modals, and toasts.
 */
var App = {
  state: {
    user: null,
    token: null,
    currentView: 'dashboard',
    currentProject: null,
    projects: [],
    sseSource: null
  },

  init: function() {
    // global click delegation — single handler for all interactive elements
    document.addEventListener('click', function(e) {
      var navItem = e.target.closest('.nav-item[data-view]');
      if (navItem) {
        e.preventDefault();
        e.stopPropagation();
        App.navigate(navItem.getAttribute('data-view'));
        return;
      }

      var projItem = e.target.closest('.sidebar-project-item[data-project-id]');
      if (projItem) {
        e.preventDefault();
        App.openProjectTasks(projItem.getAttribute('data-project-id'));
        return;
      }

      var projCard = e.target.closest('.project-card[data-project-id]');
      if (projCard && !e.target.closest('.project-actions')) {
        App.openProjectTasks(projCard.getAttribute('data-project-id'));
        return;
      }

      if (e.target.closest('#logout-btn')) { Auth.logout(); return; }
      if (e.target.closest('#sidebar-toggle-btn')) { App.toggleSidebar(); return; }
      if (e.target.closest('#create-project-btn')) { Projects.showCreateModal(); return; }
      if (e.target.closest('#create-task-btn')) { Tasks.showCreateModal(); return; }
      if (e.target.closest('#modal-close-btn')) { App.closeModal(); return; }
      if (e.target === document.getElementById('modal-overlay')) { App.closeModal(); return; }

      if (e.target.closest('[data-auth-action="signup"]')) {
        e.preventDefault();
        Auth.showSignup();
        return;
      }
      if (e.target.closest('[data-auth-action="login"]')) {
        e.preventDefault();
        Auth.showLogin();
        return;
      }

      var roleBtn = e.target.closest('.role-btn[data-role]');
      if (roleBtn) {
        e.preventDefault();
        Auth.setRole(roleBtn.getAttribute('data-role'));
        return;
      }

      var authTab = e.target.closest('.auth-tab[data-auth-tab]');
      if (authTab) {
        e.preventDefault();
        var tab = authTab.getAttribute('data-auth-tab');
        if (tab === 'signin') Auth.showLogin();
        else if (tab === 'signup') Auth.showSignup();
        return;
      }
    });

    document.addEventListener('change', function(e) {
      if (e.target.id === 'filter-priority' || e.target.id === 'filter-assignee') {
        Tasks.applyFilters();
      }
    });

    // restore session from localStorage
    var token = localStorage.getItem('tf_token');
    if (token) {
      App.state.token = token;
      API.get('/api/auth/me').then(function(res) {
        App.state.user = res.user;
        App.showApp();
      }).catch(function() {
        App.showAuth();
      });
    } else {
      App.showAuth();
    }
  },

  showAuth: function() {
    App.state.token = null;
    App.state.user = null;
    localStorage.removeItem('tf_token');
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('app-screen').classList.remove('active');
    if (App.state.sseSource) {
      App.state.sseSource.close();
      App.state.sseSource = null;
    }
  },

  showApp: function() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    App.updateUserUI();
    App.navigate('dashboard');
    App.connectSSE();
    Projects.loadSidebar();
  },

  updateUserUI: function() {
    var u = App.state.user;
    if (!u) return;

    var avatar = document.getElementById('user-avatar');
    avatar.style.background = u.avatarColor || '#6C5CE7';
    avatar.textContent = u.name.charAt(0).toUpperCase();
    document.getElementById('user-name').textContent = u.name;
    
    var roleBadge = document.getElementById('user-role-badge');
    if (u.isAdmin) {
      roleBadge.textContent = 'Admin';
      roleBadge.className = 'user-role-badge user-role-admin';
    } else {
      roleBadge.textContent = 'Member';
      roleBadge.className = 'user-role-badge user-role-member';
    }

    var hour = new Date().getHours();
    var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    document.getElementById('dashboard-greeting').textContent = greeting + ', ' + u.name.split(' ')[0] + '!';

    // toggle admin-only elements
    var adminEls = document.querySelectorAll('.admin-only');
    for (var i = 0; i < adminEls.length; i++) {
      adminEls[i].style.display = u.isAdmin ? '' : 'none';
    }
  },

  navigate: function(view) {
    App.state.currentView = view;

    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('active');

    var navItems = document.querySelectorAll('.nav-item');
    for (var i = 0; i < navItems.length; i++) navItems[i].classList.remove('active');

    var viewEl = document.getElementById('view-' + view);
    if (viewEl) viewEl.classList.add('active');

    var navItem = document.querySelector('.nav-item[data-view="' + view + '"]');
    if (navItem) navItem.classList.add('active');

    switch (view) {
      case 'dashboard': Dashboard.load(); break;
      case 'projects':  Projects.load(); break;
      case 'tasks':     if (App.state.currentProject) Tasks.load(App.state.currentProject); break;
      case 'member':    Member.load(); break;
      case 'admin':     Admin.load(); break;
    }
  },

  openProjectTasks: function(projectId) {
    App.state.currentProject = projectId;
    App.navigate('tasks');
    var items = document.querySelectorAll('.sidebar-project-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-project-id') === projectId);
    }
  },

  toggleSidebar: function() {
    document.getElementById('sidebar').classList.toggle('open');
  },

  connectSSE: function() {
    if (App.state.sseSource) App.state.sseSource.close();
    try {
      var es = new EventSource('/api/events');
      App.state.sseSource = es;

      var refreshEvents = [
        'task_created', 'task_updated', 'task_deleted', 'task_status_changed',
        'project_created', 'project_deleted', 'member_added', 'member_removed'
      ];
      refreshEvents.forEach(function(evt) {
        es.addEventListener(evt, function() {
          if (App.state.currentView === 'dashboard') Dashboard.load();
          if (App.state.currentView === 'tasks' && App.state.currentProject) Tasks.load(App.state.currentProject);
          if (App.state.currentView === 'projects') Projects.load();
          if (App.state.currentView === 'member') Member.load();
          Projects.loadSidebar();
        });
      });

      es.onerror = function() { /* auto-reconnects by default */ };
    } catch (err) {
      // SSE not critical — fail silently
    }
  },

  openModal: function(title, bodyHTML) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHTML;
    document.getElementById('modal-overlay').classList.add('active');
  },

  closeModal: function() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  toast: function(message, type) {
    type = type || 'success';
    var container = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(function() { el.remove(); }, 3500);
  },

  // safely escape HTML to prevent XSS when rendering user content
  esc: function(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  timeAgo: function(date) {
    var seconds = Math.floor((Date.now() - new Date(date)) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
  },

  formatDate: function(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};


/* HTTP client wrapper with auth header injection */
var API = {
  request: function(method, url, body) {
    var headers = { 'Content-Type': 'application/json' };
    if (App.state.token) headers['Authorization'] = 'Bearer ' + App.state.token;

    var opts = { method: method, headers: headers };
    if (body) opts.body = JSON.stringify(body);

    var isAuthEndpoint = url.startsWith('/api/auth/');
    return fetch(url, opts).then(function(res) {
      return res.json().then(function(data) {
        if (res.status === 401 && !isAuthEndpoint) { App.showAuth(); throw new Error('Session expired'); }
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
      });
    });
  },
  get:    function(url)       { return this.request('GET', url); },
  post:   function(url, body) { return this.request('POST', url, body); },
  put:    function(url, body) { return this.request('PUT', url, body); },
  patch:  function(url, body) { return this.request('PATCH', url, body); },
  delete: function(url)       { return this.request('DELETE', url); }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
