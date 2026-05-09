const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found. Token invalid.' });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please login again.' });
    }
    return res.status(401).json({ error: 'Invalid token.' });
  }
};

// Check if user is admin of a project
const requireProjectAdmin = (projectParamName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const Project = require('../models/Project');
      const projectId = req.params[projectParamName] || req.body.projectId || req.body.project;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required.' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const member = project.members.find(m => m.user.toString() === req.userId.toString());
      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      if (member.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required for this action.' });
      }

      req.project = project;
      req.memberRole = member.role;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
};

// Check if user is a member of a project (any role)
const requireProjectMember = (projectParamName = 'projectId') => {
  return async (req, res, next) => {
    try {
      const Project = require('../models/Project');
      const projectId = req.params[projectParamName] || req.body.projectId || req.body.project;
      
      if (!projectId) {
        return res.status(400).json({ error: 'Project ID required.' });
      }

      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found.' });
      }

      const member = project.members.find(m => m.user.toString() === req.userId.toString());
      if (!member) {
        return res.status(403).json({ error: 'You are not a member of this project.' });
      }

      req.project = project;
      req.memberRole = member.role;
      next();
    } catch (error) {
      res.status(500).json({ error: 'Authorization check failed.' });
    }
  };
};

module.exports = { authenticate, requireProjectAdmin, requireProjectMember };
