/*
 * auth.js — Handles login, signup with OTP email verification,
 * role selection (member/admin), and session management.
 */
var Auth = {
  selectedRole: 'member',
  pendingEmail: '',
  pendingName: '',
  pendingPassword: '',
  otpTimer: null,
  otpSeconds: 300,

  showLogin: function() {
    document.getElementById('login-form').classList.add('active');
    document.getElementById('signup-form').classList.remove('active');
    var tabSignin = document.getElementById('tab-signin');
    var tabSignup = document.getElementById('tab-signup');
    if (tabSignin) tabSignin.classList.add('active');
    if (tabSignup) tabSignup.classList.remove('active');
  },

  showSignup: function() {
    if (Auth.selectedRole === 'admin') return;
    document.getElementById('signup-form').classList.add('active');
    document.getElementById('login-form').classList.remove('active');
    document.getElementById('tab-signup').classList.add('active');
    document.getElementById('tab-signin').classList.remove('active');
    // Reset to step 1
    Auth.backToStep1();
  },

  setRole: function(role) {
    Auth.selectedRole = role;
    document.querySelectorAll('.role-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.getAttribute('data-role') === role);
    });

    var tabSignup = document.getElementById('tab-signup');
    var authSwitch = document.querySelectorAll('.auth-switch');

    if (role === 'admin') {
      if (tabSignup) tabSignup.style.display = 'none';
      authSwitch.forEach(function(el) { el.style.display = 'none'; });
      Auth.showLogin();
    } else {
      if (tabSignup) tabSignup.style.display = '';
      authSwitch.forEach(function(el) { el.style.display = ''; });
    }

    Auth.updateHeadings();
  },

  updateHeadings: function() {
    var isAdmin = Auth.selectedRole === 'admin';
    var loginH = document.getElementById('login-heading');
    var loginS = document.getElementById('login-subtitle');
    if (loginH) loginH.textContent = isAdmin ? 'Admin Sign In 🛡️' : 'Welcome back! 👋';
    if (loginS) loginS.textContent = isAdmin ? 'Sign in to the admin portal' : 'Sign in to manage your tasks';
  },

  // send OTP to user's email for verification
  sendOTP: function(e) {
    e.preventDefault();
    var btn = document.getElementById('signup-btn');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    btn.querySelector('span').textContent = 'Sending code...';

    Auth.pendingName = document.getElementById('signup-name').value;
    Auth.pendingEmail = document.getElementById('signup-email').value;
    Auth.pendingPassword = document.getElementById('signup-password').value;

    API.post('/api/auth/send-otp', {
      name: Auth.pendingName,
      email: Auth.pendingEmail,
      password: Auth.pendingPassword
    }).then(function(data) {
      App.toast('Verification code sent to your email!', 'success');
      Auth.showStep2();
    }).catch(function(err) {
      App.toast(err.message, 'error');
    }).finally(function() {
      btn.querySelector('.btn-loader').classList.add('hidden');
      btn.querySelector('span').textContent = 'Send Verification Code →';
    });
  },

  // transition UI to OTP input step
  showStep2: function() {
    document.getElementById('signup-step-1').style.display = 'none';
    document.getElementById('signup-step-2').style.display = 'block';
    document.getElementById('otp-sent-email').textContent = Auth.pendingEmail;
    document.getElementById('signup-heading').textContent = 'Verify your email 📧';
    document.getElementById('signup-subtitle').textContent = 'Enter the 6-digit code we sent you';

    // Clear OTP inputs
    for (var i = 1; i <= 6; i++) {
      var input = document.getElementById('otp-digit-' + i);
      input.value = '';
      input.classList.remove('filled', 'error');
    }
    document.getElementById('otp-digit-1').focus();

    // Setup OTP input handlers
    Auth.setupOTPInputs();

    // Start countdown
    Auth.startCountdown();

    // Disable resend for 30s
    var resendBtn = document.getElementById('resend-otp-btn');
    resendBtn.disabled = true;
    var resendCount = 30;
    var resendInterval = setInterval(function() {
      resendCount--;
      resendBtn.textContent = 'Resend Code (' + resendCount + 's)';
      if (resendCount <= 0) {
        clearInterval(resendInterval);
        resendBtn.textContent = 'Resend Code';
        resendBtn.disabled = false;
      }
    }, 1000);
  },

  // auto-focus, auto-advance, paste support for OTP fields
  setupOTPInputs: function() {
    var inputs = [];
    for (var i = 1; i <= 6; i++) {
      inputs.push(document.getElementById('otp-digit-' + i));
    }

    inputs.forEach(function(input, idx) {
      // Remove old listeners by replacing element
      var newInput = input.cloneNode(true);
      input.parentNode.replaceChild(newInput, input);
      inputs[idx] = newInput;

      newInput.addEventListener('input', function(e) {
        var val = this.value.replace(/[^0-9]/g, '');
        this.value = val;

        if (val) {
          this.classList.add('filled');
          this.classList.remove('error');
          // Auto-focus next
          if (idx < 5) inputs[idx + 1].focus();
        } else {
          this.classList.remove('filled');
        }

        // Auto-submit when all filled
        var full = true;
        for (var j = 0; j < 6; j++) {
          if (!inputs[j].value) { full = false; break; }
        }
        if (full) {
          setTimeout(function() { Auth.verifyOTP(); }, 200);
        }
      });

      newInput.addEventListener('keydown', function(e) {
        // Backspace: go to prev
        if (e.key === 'Backspace' && !this.value && idx > 0) {
          inputs[idx - 1].focus();
          inputs[idx - 1].value = '';
          inputs[idx - 1].classList.remove('filled');
        }
        // Arrow keys
        if (e.key === 'ArrowLeft' && idx > 0) inputs[idx - 1].focus();
        if (e.key === 'ArrowRight' && idx < 5) inputs[idx + 1].focus();
      });

      // Paste handling
      newInput.addEventListener('paste', function(e) {
        e.preventDefault();
        var paste = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
        for (var j = 0; j < Math.min(paste.length, 6); j++) {
          inputs[j].value = paste[j];
          inputs[j].classList.add('filled');
        }
        if (paste.length >= 6) {
          inputs[5].focus();
          setTimeout(function() { Auth.verifyOTP(); }, 200);
        } else {
          inputs[Math.min(paste.length, 5)].focus();
        }
      });
    });
  },

  // 5-minute countdown before code expires
  startCountdown: function() {
    if (Auth.otpTimer) clearInterval(Auth.otpTimer);
    Auth.otpSeconds = 300; // 5 minutes

    Auth.otpTimer = setInterval(function() {
      Auth.otpSeconds--;
      var min = Math.floor(Auth.otpSeconds / 60);
      var sec = Auth.otpSeconds % 60;
      var el = document.getElementById('otp-countdown');
      if (el) el.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;

      if (Auth.otpSeconds <= 0) {
        clearInterval(Auth.otpTimer);
        if (el) el.textContent = 'Expired';
        var timerEl = document.getElementById('otp-timer');
        if (timerEl) timerEl.innerHTML = '<span style="color:var(--red)">Code expired! Please resend.</span>';
      }
    }, 1000);
  },

  // validate and submit the 6-digit code
  verifyOTP: function(e) {
    if (e) e.preventDefault();

    var otp = '';
    for (var i = 1; i <= 6; i++) {
      otp += document.getElementById('otp-digit-' + i).value;
    }

    if (otp.length !== 6) {
      App.toast('Please enter the complete 6-digit code', 'error');
      return;
    }

    var btn = document.getElementById('verify-btn');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    btn.querySelector('span').textContent = 'Verifying...';

    API.post('/api/auth/verify-otp', {
      email: Auth.pendingEmail,
      otp: otp
    }).then(function(data) {
      if (Auth.otpTimer) clearInterval(Auth.otpTimer);
      localStorage.setItem('tf_token', data.token);
      App.state.token = data.token;
      App.state.user = data.user;
      App.toast('Email verified! Welcome to TeamFlow! 🎉', 'success');
      App.showApp();
    }).catch(function(err) {
      App.toast(err.message, 'error');
      // Shake the OTP inputs
      for (var i = 1; i <= 6; i++) {
        document.getElementById('otp-digit-' + i).classList.add('error');
      }
      setTimeout(function() {
        for (var i = 1; i <= 6; i++) {
          document.getElementById('otp-digit-' + i).classList.remove('error');
          document.getElementById('otp-digit-' + i).value = '';
          document.getElementById('otp-digit-' + i).classList.remove('filled');
        }
        document.getElementById('otp-digit-1').focus();
      }, 500);
    }).finally(function() {
      btn.querySelector('.btn-loader').classList.add('hidden');
      btn.querySelector('span').textContent = 'Verify & Create Account →';
    });
  },

  // request a new verification code
  resendOTP: function() {
    var resendBtn = document.getElementById('resend-otp-btn');
    resendBtn.disabled = true;
    resendBtn.textContent = 'Sending...';

    API.post('/api/auth/resend-otp', {
      email: Auth.pendingEmail,
      name: Auth.pendingName,
      password: Auth.pendingPassword
    }).then(function() {
      App.toast('New code sent!', 'success');
      Auth.startCountdown();
      // Clear OTP inputs
      for (var i = 1; i <= 6; i++) {
        document.getElementById('otp-digit-' + i).value = '';
        document.getElementById('otp-digit-' + i).classList.remove('filled', 'error');
      }
      document.getElementById('otp-digit-1').focus();
      // Disable resend again for 30s
      var count = 30;
      var interval = setInterval(function() {
        count--;
        resendBtn.textContent = 'Resend Code (' + count + 's)';
        if (count <= 0) {
          clearInterval(interval);
          resendBtn.textContent = 'Resend Code';
          resendBtn.disabled = false;
        }
      }, 1000);
    }).catch(function(err) {
      App.toast(err.message, 'error');
      resendBtn.textContent = 'Resend Code';
      resendBtn.disabled = false;
    });
  },

  // reset signup form to initial state
  backToStep1: function() {
    if (Auth.otpTimer) clearInterval(Auth.otpTimer);
    document.getElementById('signup-step-1').style.display = 'block';
    document.getElementById('signup-step-2').style.display = 'none';
    document.getElementById('signup-heading').textContent = 'Create your account ✨';
    document.getElementById('signup-subtitle').textContent = 'Join your team and start collaborating';
  },

  // handle login form submission
  login: function(e) {
    e.preventDefault();
    var btn = document.getElementById('login-btn');
    btn.querySelector('.btn-loader').classList.remove('hidden');
    btn.querySelector('span').textContent = 'Signing in...';

    API.post('/api/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value,
      loginAsAdmin: Auth.selectedRole === 'admin'
    }).then(function(data) {
      localStorage.setItem('tf_token', data.token);
      App.state.token = data.token;
      App.state.user = data.user;
      App.toast(Auth.selectedRole === 'admin' ? 'Welcome, Admin!' : 'Welcome back!', 'success');
      App.showApp();
    }).catch(function(err) {
      App.toast(err.message, 'error');
    }).finally(function() {
      btn.querySelector('.btn-loader').classList.add('hidden');
      btn.querySelector('span').textContent = 'Sign In →';
    });
  },

  logout: function() {
    localStorage.removeItem('tf_token');
    if (Auth.otpTimer) clearInterval(Auth.otpTimer);
    Auth.selectedRole = 'member';
    Auth.setRole('member');
    Auth.showLogin();
    App.showAuth();
    App.toast('Logged out', 'info');
  }
};
