const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { authenticate, requireProjectAdmin, requireProjectMember } = require('../middleware/auth');

const router = express.Router();

// GET /api/projects — list user's projects
router.get('/', authenticate, async (req, res) => {
  try {
    const projects = await Project.find({
      'members.user': req.userId
    })
      .populate('createdBy', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor')
      .sort({ createdAt: -1 });

    // Add task counts for each project
    const projectsWithCounts = await Promise.all(
      projects.map(async (project) => {
        const taskCounts = await Task.aggregate([
          { $match: { project: project._id } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 }
            }
          }
        ]);

        const counts = { todo: 0, in_progress: 0, review: 0, done: 0, total: 0 };
        taskCounts.forEach(tc => {
          counts[tc._id] = tc.count;
          counts.total += tc.count;
        });

        return {
          ...project.toObject(),
          taskCounts: counts
        };
      })
    );

    res.json({ projects: projectsWithCounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// POST /api/projects — create project
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Project name must be at least 2 characters.' });
    }

    const project = new Project({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: req.userId,
      members: [{ user: req.userId, role: 'admin' }]
    });

    await project.save();
    await project.populate('createdBy', 'name email avatarColor');
    await project.populate('members.user', 'name email avatarColor');

    // Broadcast SSE
    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'project_created', { project });

    res.status(201).json({ message: 'Project created!', project });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// PUT /api/projects/:projectId — update project
router.put('/:projectId', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = req.project;

    if (name) project.name = name.trim();
    if (description !== undefined) project.description = description.trim();

    await project.save();
    await project.populate('createdBy', 'name email avatarColor');
    await project.populate('members.user', 'name email avatarColor');

    res.json({ message: 'Project updated!', project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// DELETE /api/projects/:projectId — delete project
router.delete('/:projectId', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    // Delete all tasks in the project
    await Task.deleteMany({ project: req.params.projectId });
    await Project.findByIdAndDelete(req.params.projectId);

    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'project_deleted', { projectId: req.params.projectId });

    res.json({ message: 'Project and all its tasks deleted.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// POST /api/projects/:projectId/members — invite member
router.post('/:projectId/members', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { email, role = 'member' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No user found with that email. They need to sign up first.' });
    }

    const project = req.project;
    const existingMember = project.members.find(m => m.user.toString() === user._id.toString());
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this project.' });
    }

    project.members.push({ user: user._id, role: role === 'admin' ? 'admin' : 'member' });
    await project.save();
    await project.populate('members.user', 'name email avatarColor');

    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'member_added', { projectId: project._id, user: user.toJSON(), role });

    res.json({ message: `${user.name} added to the project!`, project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member.' });
  }
});

// DELETE /api/projects/:projectId/members/:userId — remove member
router.delete('/:projectId/members/:userId', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const project = req.project;
    const { userId } = req.params;

    // Can't remove yourself if you're the only admin
    const admins = project.members.filter(m => m.role === 'admin');
    const targetMember = project.members.find(m => m.user.toString() === userId);

    if (!targetMember) {
      return res.status(404).json({ error: 'Member not found in this project.' });
    }

    if (targetMember.role === 'admin' && admins.length === 1) {
      return res.status(400).json({ error: 'Cannot remove the only admin. Promote another member first.' });
    }

    project.members = project.members.filter(m => m.user.toString() !== userId);
    await project.save();

    // Unassign tasks from removed member
    await Task.updateMany(
      { project: project._id, assignedTo: userId },
      { assignedTo: null }
    );

    const broadcast = req.app.get('broadcastSSE');
    broadcast(req.userId, 'member_removed', { projectId: project._id, userId });

    res.json({ message: 'Member removed from project.', project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member.' });
  }
});

// PUT /api/projects/:projectId/members/:userId/role — change member role
router.put('/:projectId/members/:userId/role', authenticate, requireProjectAdmin(), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or member.' });
    }

    const project = req.project;
    const member = project.members.find(m => m.user.toString() === req.params.userId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // Prevent demoting the last admin
    if (member.role === 'admin' && role === 'member') {
      const admins = project.members.filter(m => m.role === 'admin');
      if (admins.length === 1) {
        return res.status(400).json({ error: 'Cannot demote the only admin.' });
      }
    }

    member.role = role;
    await project.save();
    await project.populate('members.user', 'name email avatarColor');

    res.json({ message: 'Role updated!', project });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update role.' });
  }
});

module.exports = router;
