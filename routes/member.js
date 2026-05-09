const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/member/portal — member portal data
router.get('/portal', authenticate, async (req, res) => {
  try {
    // Get all projects user is a member of
    const projects = await Project.find({ 'members.user': req.userId })
      .populate('createdBy', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor')
      .sort({ createdAt: -1 });

    const projectIds = projects.map(p => p._id);

    // All my tasks across all projects
    const myTasks = await Task.find({ assignedTo: req.userId })
      .populate('project', 'name')
      .populate('assignedTo', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor')
      .sort({ updatedAt: -1 });

    // Stats
    const totalTasks = myTasks.length;
    const todoTasks = myTasks.filter(t => t.status === 'todo').length;
    const inProgressTasks = myTasks.filter(t => t.status === 'in_progress').length;
    const reviewTasks = myTasks.filter(t => t.status === 'review').length;
    const doneTasks = myTasks.filter(t => t.status === 'done').length;
    const overdueTasks = myTasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    ).length;

    // Priority breakdown
    const urgentTasks = myTasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
    const highTasks = myTasks.filter(t => t.priority === 'high' && t.status !== 'done').length;
    const mediumTasks = myTasks.filter(t => t.priority === 'medium' && t.status !== 'done').length;
    const lowTasks = myTasks.filter(t => t.priority === 'low' && t.status !== 'done').length;

    // Projects with my role and task counts
    const projectsWithStats = projects.map(p => {
      const member = p.members.find(m => m.user && m.user._id.toString() === req.userId.toString());
      const myProjectTasks = myTasks.filter(t => t.project && t.project._id.toString() === p._id.toString());
      const completedInProject = myProjectTasks.filter(t => t.status === 'done').length;
      return {
        ...p.toObject(),
        myRole: member ? member.role : 'member',
        myTaskCount: myProjectTasks.length,
        myCompletedCount: completedInProject
      };
    });

    res.json({
      stats: {
        totalTasks,
        todoTasks,
        inProgressTasks,
        reviewTasks,
        doneTasks,
        overdueTasks,
        totalProjects: projects.length
      },
      priorities: {
        urgent: urgentTasks,
        high: highTasks,
        medium: mediumTasks,
        low: lowTasks
      },
      tasks: myTasks,
      projects: projectsWithStats
    });
  } catch (error) {
    console.error('Member portal error:', error);
    res.status(500).json({ error: 'Failed to fetch member portal data.' });
  }
});

// PATCH /api/member/tasks/:taskId/status — quick status update
router.patch('/tasks/:taskId/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['todo', 'in_progress', 'review', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    // Verify user is assigned to this task or is a project member
    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const isMember = project.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a member of this project.' });

    task.status = status;
    task.updatedAt = new Date();
    await task.save();

    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email avatarColor');

    res.json({ message: 'Task status updated!', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status.' });
  }
});

// PATCH /api/member/tasks/:taskId — edit task details
router.patch('/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const { title, description, priority, dueDate } = req.body;

    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    // Verify user is a project member
    const project = await Project.findById(task.project);
    if (!project) return res.status(404).json({ error: 'Project not found.' });

    const isMember = project.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) return res.status(403).json({ error: 'Not a member of this project.' });

    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (priority) task.priority = priority;
    if (dueDate !== undefined) task.dueDate = dueDate || null;
    task.updatedAt = new Date();
    await task.save();

    await task.populate('project', 'name');
    await task.populate('assignedTo', 'name email avatarColor');

    res.json({ message: 'Task updated!', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

module.exports = router;
