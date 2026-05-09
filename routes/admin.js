const express = require('express');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Admin middleware — check if user is system admin
function requireAdmin(req, res, next) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// GET /api/admin/stats — system-wide statistics
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalProjects = await Project.countDocuments();
    const totalTasks = await Task.countDocuments();

    const tasksByStatus = await Task.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const tasksByPriority = await Task.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name email avatarColor isAdmin createdAt');

    const recentProjects = await Project.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('createdBy', 'name email')
      .select('name createdBy members createdAt');

    const overdueTasks = await Task.countDocuments({
      dueDate: { $lt: new Date() },
      status: { $ne: 'done' }
    });

    const statusMap = { todo: 0, in_progress: 0, review: 0, done: 0 };
    tasksByStatus.forEach(t => { statusMap[t._id] = t.count; });

    const priorityMap = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasksByPriority.forEach(p => { priorityMap[p._id] = p.count; });

    res.json({
      totalUsers, totalProjects, totalTasks, overdueTasks,
      tasksByStatus: statusMap,
      tasksByPriority: priorityMap,
      recentUsers, recentProjects
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// GET /api/admin/users — list all users
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('name email avatarColor isAdmin createdAt');

    // Get project count and task count per user
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const projectCount = await Project.countDocuments({ 'members.user': user._id });
      const taskCount = await Task.countDocuments({ assignedTo: user._id });
      const completedTasks = await Task.countDocuments({ assignedTo: user._id, status: 'done' });
      return {
        ...user.toObject(),
        projectCount,
        taskCount,
        completedTasks
      };
    }));

    res.json({ users: usersWithStats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// PUT /api/admin/users/:userId/toggle-admin — promote/demote admin
router.put('/users/:userId/toggle-admin', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Can't demote yourself
    if (user._id.toString() === req.userId.toString() && user.isAdmin) {
      return res.status(400).json({ error: 'You cannot demote yourself.' });
    }

    user.isAdmin = !user.isAdmin;
    await user.save();

    res.json({ message: user.isAdmin ? 'User promoted to admin!' : 'Admin privileges removed.', user: user.toJSON() });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// DELETE /api/admin/users/:userId — delete a user
router.delete('/users/:userId', authenticate, requireAdmin, async (req, res) => {
  try {
    if (req.params.userId === req.userId.toString()) {
      return res.status(400).json({ error: 'You cannot delete yourself.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    // Remove from all projects
    await Project.updateMany(
      { 'members.user': user._id },
      { $pull: { members: { user: user._id } } }
    );

    // Unassign tasks
    await Task.updateMany(
      { assignedTo: user._id },
      { $set: { assignedTo: null } }
    );

    await User.findByIdAndDelete(req.params.userId);

    res.json({ message: 'User deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// GET /api/admin/projects — list all projects (system-wide)
router.get('/projects', authenticate, requireAdmin, async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor')
      .sort({ createdAt: -1 });

    const projectsWithCounts = await Promise.all(projects.map(async (p) => {
      const taskCount = await Task.countDocuments({ project: p._id });
      const completedCount = await Task.countDocuments({ project: p._id, status: 'done' });
      return { ...p.toObject(), taskCount, completedCount };
    }));

    res.json({ projects: projectsWithCounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// DELETE /api/admin/projects/:projectId — force delete any project
router.delete('/projects/:projectId', authenticate, requireAdmin, async (req, res) => {
  try {
    await Task.deleteMany({ project: req.params.projectId });
    await Project.findByIdAndDelete(req.params.projectId);
    res.json({ message: 'Project and all tasks deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

module.exports = router;
