require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const path       = require('path');

const authRoutes      = require('./routes/auth');
const projectRoutes   = require('./routes/projects');
const taskRoutes      = require('./routes/tasks');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes     = require('./routes/admin');
const memberRoutes    = require('./routes/member');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ---- SSE (Server-Sent Events) ---- */
const sseClients = new Map();

function broadcastSSE(userId, event, data) {
  sseClients.forEach(function(res, clientId) {
    try {
      res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n');
    } catch (e) {
      sseClients.delete(clientId);
    }
  });
}
app.set('broadcastSSE', broadcastSSE);

/* ---- Middleware ---- */
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---- API Routes ---- */
app.use('/api/auth',      authRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/member',    memberRoutes);

/* ---- SSE Endpoint ---- */
app.get('/api/events', function(req, res) {
  var clientId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive'
  });
  res.write('event: connected\ndata: ' + JSON.stringify({ clientId: clientId }) + '\n\n');
  sseClients.set(clientId, res);

  req.on('close', function() {
    sseClients.delete(clientId);
  });
});

/* ---- SPA Fallback ---- */
app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/* ---- Start Server ---- */
mongoose.connect(process.env.MONGODB_URI)
  .then(function() {
    console.log('Connected to MongoDB');
    app.listen(PORT, function() {
      console.log('TeamFlow running on http://localhost:' + PORT);
    });
  })
  .catch(function(err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
