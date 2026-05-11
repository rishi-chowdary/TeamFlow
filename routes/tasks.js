const express = require('express');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { authenticate, requireProjectMember } = require('../middleware/auth');

const router = express.Router();

// GET /api/tasks?project=xxx — list tasks for a project
router.get('/', authenticate, async (req, res) => {
  try {
    const { project, status, priority, assignedTo, search } = req.query;

    if (!project) {
      return res.status(400).json({ error: 'Project ID is required.' });
    }

    // Verify membership
    const proj = await Project.findById(project);
    if (!proj) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    const isMember = proj.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    // Build query
    const query = { project };
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (assignedTo) query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const tasks = await Task.find(query)
      .populate('assignedTo', 'name email avatarColor')
      .populate('createdBy', 'name email avatarColor')
      .sort({ createdAt: -1 });

    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks.' });
  }
});

// POST /api/tasks — create task
router.post('/', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { title, description, status, priority, project, assignedTo, dueDate } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required.' });
    }

    // Project is already verified and attached to req by requireProjectAdmin
    const proj = req.project;

    const task = new Task({
      title: title.trim(),
      description: description?.trim() || '',
      status: status || 'todo',
      priority: priority || 'medium',
      project,
      assignedTo: assignedTo || null,
      createdBy: req.userId,
      dueDate: dueDate || null
    });

    await task.save();
    await task.populate('assignedTo', 'name email avatarColor');
    await task.populate('createdBy', 'name email avatarColor');

    // Broadcast SSE
    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'task_created', { task });

    res.status(201).json({ message: 'Task created!', task });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// PUT /api/tasks/:taskId — update task
router.put('/:taskId', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Verify membership in the task's project
    const proj = await Project.findById(task.project);
    if (!proj) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const member = proj.members.find(m => m.user.toString() === req.userId.toString());
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this project.' });
    }

    // Members can only update tasks assigned to them or tasks they created
    if (member.role === 'member') {
      const isAssigned = task.assignedTo && task.assignedTo.toString() === req.userId.toString();
      const isCreator = task.createdBy.toString() === req.userId.toString();
      if (!isAssigned && !isCreator) {
        return res.status(403).json({ error: 'You can only edit tasks assigned to you or created by you.' });
      }
    }

    // Update fields
    const { title, description, status, priority, assignedTo, dueDate } = req.body;
    if (title) task.title = title.trim();
    if (description !== undefined) task.description = description.trim();
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo !== undefined) task.assignedTo = assignedTo || null;
    if (dueDate !== undefined) task.dueDate = dueDate || null;

    await task.save();
    await task.populate('assignedTo', 'name email avatarColor');
    await task.populate('createdBy', 'name email avatarColor');

    // Broadcast SSE
    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'task_updated', { task });

    res.json({ message: 'Task updated!', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// PATCH /api/tasks/:taskId/status — quick status update (for drag-and-drop)
router.patch('/:taskId/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['todo', 'in_progress', 'review', 'done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Verify membership
    const proj = await Project.findById(task.project);
    const isMember = proj && proj.members.some(m => m.user.toString() === req.userId.toString());
    if (!isMember) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    task.status = status;
    await task.save();
    await task.populate('assignedTo', 'name email avatarColor');
    await task.populate('createdBy', 'name email avatarColor');

    // Broadcast SSE
    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'task_status_changed', { task });

    res.json({ message: 'Status updated!', task });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status.' });
  }
});

// DELETE /api/tasks/:taskId — delete task
router.delete('/:taskId', authenticate, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    // Verify admin or task creator
    const proj = await Project.findById(task.project);
    const member = proj && proj.members.find(m => m.user.toString() === req.userId.toString());
    
    if (!member) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    if (member.role !== 'admin' && task.createdBy.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only admins or the task creator can delete tasks.' });
    }

    await Task.findByIdAndDelete(req.params.taskId);

    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'task_deleted', { taskId: req.params.taskId, projectId: task.project });

    res.json({ message: 'Task deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

module.exports = router;
