# Smart Task Analyzer

A sophisticated task management system that intelligently prioritizes tasks based on urgency, importance, effort, and dependencies. Built with Django REST API backend and vanilla JavaScript frontend, this application helps you focus on what matters most.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Priority Scoring Algorithm](#priority-scoring-algorithm)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Usage Guide](#usage-guide)
- [API Endpoints](#api-endpoints)
- [Example JSON](#example-json)
- [Tradeoffs and Considerations](#tradeoffs-and-considerations)
- [Future Enhancements](#future-enhancements)

## Overview

Smart Task Analyzer is a full-stack web application designed to help users manage and prioritize their tasks effectively. The system uses a sophisticated scoring algorithm that considers multiple factors to determine task priority, ensuring you always know what to work on next.

### Key Capabilities

- **Intelligent Prioritization**: Automatically calculates priority scores based on multiple factors
- **Dependency Management**: Handle task dependencies with cycle detection
- **Bulk Import**: Import multiple tasks via JSON for quick setup
- **Real-time Analysis**: Get instant priority rankings with detailed explanations
- **Professional UI**: Clean, JIRA-inspired interface with color-coded priorities

## Features

### Core Functionality

1. **Task Creation**
   - Create tasks via form or JSON import
   - Set due dates, estimated hours, and importance (1-10 scale)
   - Define dependencies between tasks

2. **Smart Prioritization**
   - Automatic priority score calculation
   - Visual priority indicators (High/Medium/Low/Blocked)
   - Detailed explanations for each priority score

3. **Dependency Management**
   - Circular dependency detection
   - Visual blocking indicators
   - Smart ordered import for JSON dependencies

4. **Task Management**
   - Mark tasks as complete
   - Delete tasks
   - Filter out completed tasks from analysis

5. **Bulk Operations**
   - JSON import with dependency resolution
   - Support for index-based, title-based, and ID-based dependencies

## Priority Scoring Algorithm

The heart of this application is the priority scoring algorithm located in `backend/task_analyzer/scoring.py`. It calculates a priority score for each task based on three main factors: **Urgency**, **Importance**, and **Effort**.

### Formula

```
Priority Score = Urgency Score + Importance Score + Effort Score
```

### Component Breakdown

#### 1. Urgency Score (Based on Due Date)

The urgency score is calculated based on how close the due date is:

**Overdue Tasks** (days_until_due < 0):
```python
urgency_score = 100 + min(days_overdue * 5, 200)
```
- **Rationale**: Overdue tasks are critical and should be addressed immediately
- **Scoring**: 
  - 1 day overdue: 105 points
  - 5 days overdue: 125 points
  - 20+ days overdue: 300 points (capped)
- **Consideration**: The cap prevents extreme values from dominating the score

**Due Today** (days_until_due == 0):
```python
urgency_score = 90
```
- **Rationale**: Tasks due today need immediate attention
- **Scoring**: Fixed at 90 points

**Future Tasks** (days_until_due > 0):
```python
urgency_score = 80 / (days_until_due + 1)
```
- **Rationale**: Uses a decaying function to prioritize nearer deadlines
- **Scoring Examples**:
  - 1 day away: 40 points
  - 3 days away: 20 points
  - 7 days away: 10 points
  - 30 days away: ~2.6 points

#### 2. Importance Score (User Preference)

```python
importance_score = task.importance * 1.5
```
- **Range**: 1-10 (user input)
- **Scoring**: Multiplied by 1.5 to give appropriate weight
- **Examples**:
  - Importance 1: 1.5 points
  - Importance 5: 7.5 points
  - Importance 10: 15 points
- **Rationale**: User-defined importance reflects business value and personal priorities

#### 3. Effort Score (Quick Wins Bonus)

```python
if task.estimated_hours < 2:
    effort_score = 10  # Quick win bonus
elif task.estimated_hours > 8:
    effort_score = -5  # Penalty for large tasks
else:
    effort_score = 0
```

- **Quick Wins (< 2 hours)**: +10 points
  - **Rationale**: Short tasks build momentum and can be completed quickly
  - **Psychology**: Completing quick tasks provides satisfaction and progress

- **Large Tasks (> 8 hours)**: -5 points
  - **Rationale**: Very large tasks may need to be broken down
  - **Consideration**: Prevents overwhelming tasks from being prioritized too highly

#### 4. Blocked Tasks

```python
if any dependency is not completed:
    return -1.0, "Blocked by incomplete task: {dependency.title}"
```

- **Score**: -1.0 (always lowest priority)
- **Rationale**: Tasks blocked by incomplete dependencies cannot be started
- **Display**: Shows as "Blocked" with explanation of blocking task

### Score Examples

| Scenario | Urgency | Importance | Effort | Total | Explanation |
|----------|---------|------------|--------|-------|-------------|
| Overdue (3 days), High importance (9), Quick (1h) | 115 | 13.5 | 10 | **138.5** | OVERDUE by 3 days!, High importance, Quick win |
| Due today, Medium importance (5), Medium (4h) | 90 | 7.5 | 0 | **97.5** | Due today!, Standard priority |
| 7 days away, High importance (8), Quick (1.5h) | 10 | 12 | 10 | **32** | High importance, Quick win |
| 30 days away, Low importance (2), Large (10h) | 2.6 | 3 | -5 | **0.6** | Standard priority |
| Blocked by incomplete task | - | - | - | **-1.0** | Blocked by incomplete task: Task Name |

### Algorithm Considerations

1. **Overdue Penalty**: The exponential penalty for overdue tasks ensures they always rank highest
2. **Decay Function**: The `80 / (days + 1)` formula provides smooth prioritization without sudden jumps
3. **Quick Win Bonus**: Encourages completing small tasks to build momentum
4. **Importance Multiplier**: The 1.5x multiplier balances user preference with urgency
5. **Blocking Logic**: Blocked tasks are always ranked lowest, regardless of other factors

## Project Structure

```
singularium/
├── backend/                    
│   ├── task_analyzer/          
│   │   ├── __init__.py
│   │   ├── settings.py         
│   │   ├── urls.py             
│   │   ├── wsgi.py
│   │   └── scoring.py          
│   ├── tasks/                  
│   │   ├── migrations/         
│   │   ├── models.py           
│   │   ├── views.py            
│   │   ├── urls.py             
│   │   └── admin.py
│   ├── manage.py               
│   ├── requirements.txt        
│   └── db.sqlite3              
│
├── frontend/                   
│   ├── index.html             
│   ├── styles.css             
│   └── scripts.js             
│
├── venv/                      
├── .gitignore                 
└── README.md                  
```

### Key Files

- **`backend/task_analyzer/scoring.py`**: Core priority scoring algorithm
- **`backend/tasks/models.py`**: Task data model with dependencies
- **`backend/tasks/views.py`**: REST API endpoints
- **`frontend/scripts.js`**: Frontend logic, JSON import, UI updates
- **`frontend/styles.css`**: Professional styling with priority color coding

## Setup Instructions

### Prerequisites

- Python 3.8 or higher
- pip (Python package manager)
- A modern web browser

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd singularium
```

### Step 2: Set Up Python Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

### Step 3: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Dependencies:**
- Django 5.2.8
- django-cors-headers 4.9.0 (for CORS support)
- sqlparse 0.5.4
- asgiref 3.11.0

### Step 4: Set Up Database

```bash
# Run migrations to create database tables
python manage.py migrate
```

This creates the SQLite database file (`db.sqlite3`) with the Task model schema.

### Step 5: Start Django Server

```bash
# From the backend directory
python manage.py runserver
```

The API will be available at `http://127.0.0.1:8000/api/`

### Step 6: Open Frontend

1. Open `frontend/index.html` in your web browser
2. Or serve it using a local server:
   ```bash
   # Using Python's built-in server
   cd frontend
   python -m http.server 8080
   # Then open http://localhost:8080
   ```

### Step 7: Verify Setup

1. Backend should be running on `http://127.0.0.1:8000`
2. Frontend should be accessible in your browser
3. Try creating a task to verify everything works

## Usage Guide

### Creating Tasks

#### Method 1: Form Input

1. Click the **"Form"** tab
2. Fill in:
   - **Task Title**: Description of the task
   - **Due Date**: When the task is due
   - **Estimated Hours**: How long the task will take
   - **Importance**: 1-10 scale (10 = most important)
   - **Dependencies** (optional): Select tasks that must be completed first
3. Click **"Create Task"**

#### Method 2: JSON Import

1. Click the **"JSON"** tab
2. Paste JSON array of tasks (see [Example JSON](#example-json))
3. Click **"Import Tasks"**

### Analyzing Tasks

1. Click **"Analyze Tasks"** button
2. Tasks are automatically sorted by priority score (highest first)
3. Each task shows:
   - Priority rank (#1, #2, etc.)
   - Priority score
   - Explanation of why it's prioritized
   - Color-coded badge (High/Medium/Low/Blocked)

### Managing Tasks

- **Mark as Complete**: Click "Mark as Complete" on any task card
- **Delete**: Click "Delete" to permanently remove a task
- **Sort Options**: Use the dropdown to sort by:
  - Priority Score (default)
  - Urgent (by due date)
  - Important (by importance)
  - Quick (by estimated hours)

### Understanding Priority Colors

- **High Priority** (Score > 80): Red/orange tint, urgent attention needed
- **Medium Priority** (Score 50-80): Yellow tint, moderate priority
- **Low Priority** (Score < 50): Green/blue tint, can wait
- **Blocked** (Score < 0): Gray, cannot start until dependencies are complete

## API Endpoints

All endpoints are prefixed with `/api/`

### GET `/api/tasks/`
Get all incomplete tasks.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Complete project",
    "due_date": "2024-12-31",
    "estimated_hours": 8.0,
    "importance": 9,
    "is_completed": false,
    "dependencies": [2, 3]
  }
]
```

### POST `/api/tasks/`
Create a new task.

**Request Body:**
```json
{
  "title": "New Task",
  "due_date": "2024-12-31",
  "estimated_hours": 4.0,
  "importance": 7,
  "dependencies": [1, 2]
}
```

**Response:**
```json
{
  "id": 5,
  "message": "Task created successfully"
}
```

**Errors:**
- `400`: Circular dependency detected or validation error

### POST `/api/tasks/analyze/`
Analyze and rank all incomplete tasks by priority.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Urgent Task",
    "due_date": "2024-12-20",
    "priority_score": 125.5,
    "explanation": "OVERDUE by 2 days!, High importance",
    "estimated_hours": 2.0,
    "importance": 9,
    "dependencies": []
  }
]
```

### GET `/api/tasks/suggest/`
Get top 3 suggested tasks (actionable, non-blocked).

**Response:**
```json
[
  {
    "title": "Quick Task",
    "score": 45.5,
    "reason": "Due soon, Quick win"
  }
]
```

### POST `/api/tasks/<task_id>/complete/`
Mark a task as complete.

**Response:**
```json
{
  "status": "success"
}
```

### DELETE `/api/tasks/<task_id>/delete/`
Delete a task permanently.

**Response:**
```json
{
  "status": "success",
  "message": "Task deleted successfully"
}
```

## Example JSON

### Basic Example

```json
[
  {
    "title": "Review project proposal",
    "due_date": "2024-12-20",
    "estimated_hours": 2.0,
    "importance": 8,
    "dependencies": []
  },
  {
    "title": "Prepare presentation",
    "due_date": "2024-12-22",
    "estimated_hours": 4.0,
    "importance": 9,
    "dependencies": [0]
  }
]
```

### Advanced Example with Dependencies

```json
[
  {
    "title": "Design database schema",
    "due_date": "2024-12-18",
    "estimated_hours": 3.0,
    "importance": 8,
    "dependencies": []
  },
  {
    "title": "Implement backend API",
    "due_date": "2024-12-20",
    "estimated_hours": 8.0,
    "importance": 9,
    "dependencies": [0]
  },
  {
    "title": "Write unit tests",
    "due_date": "2024-12-21",
    "estimated_hours": 2.0,
    "importance": 7,
    "dependencies": [1]
  },
  {
    "title": "Deploy to staging",
    "due_date": "2024-12-22",
    "estimated_hours": 1.0,
    "importance": 8,
    "dependencies": [1, 2]
  }
]
```

### Dependency Reference Methods

The JSON import supports three ways to reference dependencies:

1. **Index-based** (0-based array index):
   ```json
   "dependencies": [0, 1]  // References first and second tasks in the array
   ```

2. **Title-based** (task title string):
   ```json
   "dependencies": ["Design database schema"]  // References task by title
   ```

3. **ID-based** (existing task ID):
   ```json
   "dependencies": [5, 7]  // References existing tasks by their database ID
   ```

**Note**: The smart import system processes tasks in dependency order, ensuring dependencies are created before dependent tasks.

## Tradeoffs and Considerations

### Algorithm Tradeoffs

1. **Urgency vs Importance**
   - **Current**: Urgency can dominate (overdue tasks get 100+ points)
   - **Tradeoff**: High-importance future tasks may rank lower than low-importance urgent tasks
   - **Rationale**: Time-sensitive tasks often have real-world consequences if missed

2. **Quick Win Bonus**
   - **Current**: +10 points for tasks < 2 hours
   - **Tradeoff**: May prioritize trivial tasks over important long-term work
   - **Rationale**: Builds momentum and prevents procrastination

3. **Large Task Penalty**
   - **Current**: -5 points for tasks > 8 hours
   - **Tradeoff**: Important large tasks may be deprioritized
   - **Rationale**: Large tasks should be broken down into smaller chunks

4. **Decay Function**
   - **Current**: `80 / (days + 1)` for future tasks
   - **Tradeoff**: Very distant tasks get near-zero urgency
   - **Rationale**: Focuses attention on near-term deadlines

### Technical Tradeoffs


1. **Client-Side Dependency Resolution**
   - **Current**: Smart ordered import in JavaScript
   - **Tradeoff**: Complex logic in frontend, potential for errors
   - **Consideration**: Could be moved to backend for better validation

### UI/UX Tradeoffs

1. **Manual Refresh**
   - **Current**: User must click "Analyze Tasks" to see updated priorities
   - **Tradeoff**: Not real-time, requires user action
   - **Consideration**: Could auto-refresh on task changes

2. **Toast Notifications**
   - **Current**: Manual dismiss (click to close)
   - **Tradeoff**: May clutter screen if many actions occur
   - **Consideration**: Could add auto-dismiss with longer timeout

3. **No Undo**
   - **Current**: Deleted tasks are permanently removed
   - **Tradeoff**: Accidental deletions cannot be recovered
   - **Consideration**: Could add soft delete or undo functionality

## Future Enhancements

### Algorithm Improvements

- [ ] **Blocker Bonus**: Boost priority for tasks that block many other tasks
- [ ] **Context Awareness**: Consider time of day, energy levels
- [ ] **Machine Learning**: Learn from user completion patterns
- [ ] **Recurring Tasks**: Support for repeating tasks
- [ ] **Time-based Scoring**: Adjust scores based on available time

### Feature Additions

- [ ] **Task Categories/Tags**: Organize tasks by project or category
- [ ] **Task Templates**: Quick creation from common task patterns
- [ ] **Export/Import**: Backup and restore task data
- [ ] **Calendar View**: Visual timeline of due dates
- [ ] **Task History**: Track completion times and patterns


## 🐛 Known Issues

1. **Circular Dependency Detection**: Only checks at creation time, not on dependency updates
2. **No Validation**: Frontend doesn't validate date formats before submission
3. **No Pagination**: All tasks loaded at once (may be slow with 100+ tasks)


---

