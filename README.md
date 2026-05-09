# TeamFlow — Task Management Platform

A full-stack collaborative task management platform built with **Node.js**, **Express**, **MongoDB**, and **vanilla JavaScript**. Features real-time updates, Kanban boards, role-based access control, and OTP email verification.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x-000000?logo=express&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Live Demo

**Live URL:** [Deployed on Railway](https://teamflow.up.railway.app)
**GitHub Repo:** [github.com/rishi-chowdary/TeamFlow](https://github.com/rishi-chowdary/TeamFlow)

---

## Features

### Authentication & Security
- **OTP Email Verification** — New users verify their email via a 6-digit code sent through Gmail SMTP
- **JWT Session Management** — Secure token-based authentication with 24-hour expiry
- **Role-Based Access** — Admin and Member roles with different permissions
- **Password Hashing** — bcrypt with 12 salt rounds

### Project Management
- **Create & Manage Projects** — Create projects with name, description, and team members
- **Team Collaboration** — Invite members by email, assign roles (Admin/Member)
- **Member Management** — Add, remove, and manage project team members

### Task Management
- **Kanban Board** — Drag-and-drop task board with 4 columns (To Do, In Progress, Review, Done)
- **Task CRUD** — Create, edit, delete tasks with title, description, priority, assignee, and due date
- **Priority Levels** — Low, Medium, High, Urgent with color-coded indicators
- **Filtering** — Filter tasks by priority and assignee

### Member Portal
- **Personal Dashboard** — View all tasks assigned to you across every project
- **Inline Status Updates** — Change task status directly from the portal via dropdown
- **Task Editing** — Edit task details (title, description, priority, due date) from the portal
- **Progress Tracking** — Visual progress bars for each project you're part of
- **Smart Filters** — Filter by All, Active, Completed, or Overdue tasks

### Admin Portal
- **User Management** — View, manage, and delete all registered users
- **Project Oversight** — Monitor and manage all projects across the platform
- **Platform Statistics** — Total users, projects, and tasks at a glance

### Real-Time Updates
- **Server-Sent Events (SSE)** — Live updates when tasks are created, updated, or deleted
- **Auto-Refresh** — Dashboard, Kanban, and sidebar update in real-time

### UI/UX
- **Dark Theme** — Modern glassmorphism design with a dark color scheme
- **Responsive Layout** — Works on desktop and mobile with collapsible sidebar
- **Animations** — Smooth transitions, hover effects, and micro-animations
- **Toast Notifications** — Success, error, and info feedback messages

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript     |
| **Backend**  | Node.js, Express.js                 |
| **Database** | MongoDB Atlas (Mongoose ODM)        |
| **Auth**     | JWT, bcryptjs                       |
| **Email**    | Nodemailer (Gmail SMTP)             |
| **Real-Time**| Server-Sent Events (SSE)            |
| **Hosting**  | Railway                             |

---

## Project Structure

```
TeamFlow/
├── models/
│   ├── User.js              # User schema with password hashing
│   ├── Project.js            # Project schema with member sub-documents
│   └── Task.js               # Task schema with indexes
├── routes/
│   ├── auth.js               # Login, signup, OTP verification
│   ├── projects.js           # Project CRUD, member management
│   ├── tasks.js              # Task CRUD, status updates, drag-drop
│   ├── dashboard.js          # Aggregated dashboard stats
│   ├── admin.js              # Admin portal (user/project management)
│   └── member.js             # Member portal (personal tasks/projects)
├── middleware/
│   └── auth.js               # JWT authentication middleware
├── services/
│   └── otp.js                # OTP generation, storage, email sending
├── public/
│   ├── index.html            # Single-page application shell
│   ├── css/
│   │   └── index.css         # Design tokens & component styles
│   └── js/
│       ├── app.js            # SPA router, API client, utilities
│       ├── auth.js           # Login/signup with OTP flow
│       ├── dashboard.js      # Dashboard rendering
│       ├── projects.js       # Project cards and management
│       ├── tasks.js          # Kanban board with drag-and-drop
│       ├── member.js         # Member portal
│       └── admin.js          # Admin portal
├── server.js                 # Express server entry point
├── package.json
├── .env                      # Environment variables (not committed)
└── .gitignore
```

---

## Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **MongoDB Atlas** account (free tier works)
- **Gmail account** with App Password for OTP emails

### Installation

```bash
# Clone the repository
git clone https://github.com/rishi-chowdary/TeamFlow.git
cd TeamFlow

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/teamflow
JWT_SECRET=your-secret-key-here
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-gmail-app-password
```

> **Note:** For Gmail SMTP, enable 2-Step Verification and generate an [App Password](https://myaccount.google.com/apppasswords). Remove spaces from the 16-character password.

### Run Locally

```bash
# Start the server
npm start

# Or for development
node server.js
```

Visit `http://localhost:3000` in your browser.

### First User

The **first user** to sign up automatically becomes the **Admin**. All subsequent users are regular members.

---

## API Endpoints

### Authentication
| Method | Endpoint              | Description              |
|--------|-----------------------|--------------------------|
| POST   | `/api/auth/send-otp`  | Send OTP to email        |
| POST   | `/api/auth/verify-otp`| Verify OTP & create user |
| POST   | `/api/auth/login`     | Login with credentials   |
| GET    | `/api/auth/me`        | Get current user         |

### Projects
| Method | Endpoint                           | Description           |
|--------|------------------------------------|-----------------------|
| GET    | `/api/projects`                    | List user's projects  |
| POST   | `/api/projects`                    | Create project        |
| PUT    | `/api/projects/:id`                | Update project        |
| DELETE | `/api/projects/:id`                | Delete project        |
| POST   | `/api/projects/:id/members`        | Add member            |
| DELETE | `/api/projects/:id/members/:userId`| Remove member         |

### Tasks
| Method | Endpoint                     | Description           |
|--------|------------------------------|-----------------------|
| GET    | `/api/tasks?project=:id`     | List project tasks    |
| POST   | `/api/tasks`                 | Create task           |
| PUT    | `/api/tasks/:id`             | Update task           |
| DELETE | `/api/tasks/:id`             | Delete task           |
| PATCH  | `/api/tasks/:id/status`      | Update task status    |

### Member Portal
| Method | Endpoint                          | Description              |
|--------|-----------------------------------|--------------------------|
| GET    | `/api/member/portal`              | Get personal dashboard   |
| PATCH  | `/api/member/tasks/:id/status`    | Quick status update      |
| PATCH  | `/api/member/tasks/:id`           | Edit task details        |

### Admin Portal
| Method | Endpoint                | Description           |
|--------|-------------------------|-----------------------|
| GET    | `/api/admin/stats`      | Platform statistics   |
| GET    | `/api/admin/users`      | List all users        |
| DELETE | `/api/admin/users/:id`  | Delete user           |
| GET    | `/api/admin/projects`   | List all projects     |
| DELETE | `/api/admin/projects/:id`| Delete project       |

---

## Deployment (Railway)

1. Push code to GitHub
2. Go to [Railway](https://railway.app) → New Project → Deploy from GitHub
3. Connect the `rishi-chowdary/TeamFlow` repository
4. Add environment variables in Railway dashboard:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `SMTP_USER`
   - `SMTP_PASS`
5. Railway auto-detects Node.js and deploys

---

## Contributors

- **Rishi Chowdary** — Full-stack development

---

## License

This project is licensed under the MIT License.
