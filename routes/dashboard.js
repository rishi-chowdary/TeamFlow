const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard — aggregated dashboard stats
router.get('/', authenticate, async (req, res) => {
  try {
    // Get all projects user is a member of
    const projects = await Project.find({ 'members.user': req.userId });
    const projectIds = projects.map(p => p._id);

    // Task stats
    const totalTasks = await Task.countDocuments({ project: { $in: projectIds } });
    const statusCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const priorityCounts = await Task.aggregate([
      { $match: { project: { $in: projectIds } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    // Overdue tasks
    const overdueTasks = await Task.find({
      project: { $in: projectIds },
      dueDate: { $lt: new Date() },
      status: { $ne: 'done' }
    })
      .populate('assignedTo', 'name email avatarColor')
      .populate('project', 'name')
      .sort({ dueDate: 1 })
      .limit(10);

    // My tasks
    const myTasks = await Task.find({
      assignedTo: req.userId,
      status: { $ne: 'done' }
    })
      .populate('project', 'name')
      .sort({ dueDate: 1, priority: -1 })
      .limit(10);

    // Recent tasks (activity)
    const recentTasks = await Task.find({
      project: { $in: projectIds }
    })
      .populate('assignedTo', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor')
      .populate('project', 'name')
      .sort({ updatedAt: -1 })
      .limit(8);

    // Format response
    const stats = {
      total: totalTasks,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0
    };
    statusCounts.forEach(sc => { stats[sc._id] = sc.count; });

    const priorities = { low: 0, medium: 0, high: 0, urgent: 0 };
    priorityCounts.forEach(pc => { priorities[pc._id] = pc.count; });

    res.json({
      stats,
      priorities,
      overdueTasks,
      myTasks,
      recentTasks,
      projectCount: projects.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
