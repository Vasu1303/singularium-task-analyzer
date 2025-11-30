const API_URL = 'http://127.0.0.1:8000/api/tasks';

let currentTasks = [];

// Global variables to prevent duplicate message spam
let lastMessage = "";
let lastMessageTime = 0;

const getEl = (id) => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
    fetchTasks();

    getEl('taskForm').addEventListener('submit', handleAddTask);
    getEl('analyzeBtn').addEventListener('click', analyzeTasks);

    const depSelect = getEl('dependencies');
    depSelect.addEventListener('change', updateSelectedDependencies);

    getEl('formModeBtn').addEventListener('click', () => switchInputMode('form'));
    getEl('jsonModeBtn').addEventListener('click', () => switchInputMode('json'));
    getEl('importJsonBtn').addEventListener('click', handleJsonImport);
});

async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/`);
        currentTasks = await res.json();
        updateDependencyDropdown(currentTasks);
    } catch (err) {
        console.error('Error fetching tasks:', err);
    }
}

async function createTask(payload) {
    const res = await fetch(`${API_URL}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || 'Failed to create task');
    }
    return data;
}

function buildPayloadFromForm() {
    const depSelect = getEl('dependencies');
    const selectedDeps = Array.from(depSelect.selectedOptions).map(opt => opt.value);

    return {
        title: getEl('title').value,
        due_date: getEl('dueDate').value,
        estimated_hours: getEl('hours').value,
        importance: getEl('importance').value,
        dependencies: selectedDeps
    };
}

async function handleAddTask(e) {
    e.preventDefault();

    // 1. Lock the button
    const submitBtn = document.querySelector('#taskForm button[type="submit"]');
    const originalText = submitBtn.innerText;
    submitBtn.disabled = true;
    submitBtn.innerText = "Adding...";

    const payload = buildPayloadFromForm();

    try {
        await createTask(payload);
        showNotification('Task added successfully', 'success');
        getEl('taskForm').reset();

        getEl('dependencies').value = "";
        updateSelectedDependencies();

        // Delay fetchTasks to ensure notification is visible first
        setTimeout(() => {
            fetchTasks();
        }, 200);
    } catch (err) {
        showNotification(`Error: ${err.message}`, 'error');
    } finally {
        // 2. Unlock the button
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
    }
}

async function handleJsonImport() {
    const jsonInput = getEl('jsonInput').value.trim();
    
    if (!jsonInput) {
        showNotification('Please paste JSON data', 'error');
        return;
    }
    
    let tasksToImport;
    try {
        tasksToImport = JSON.parse(jsonInput);
    } catch (err) {
        showNotification('Invalid JSON format', 'error');
        return;
    }
    
    if (!Array.isArray(tasksToImport) || tasksToImport.length === 0) {
        showNotification('JSON must be an array of task objects', 'error');
        return;
    }

    // 1. Context: Map to resolve dependencies (Title -> ID)
    // Pre-fill with existing tasks from the DB so we can link to them too.
    const resolvedMap = new Map();
    currentTasks.forEach(t => {
        resolvedMap.set(t.title, t.id);      // Resolve by Title
        resolvedMap.set(String(t.id), t.id);  // Resolve by ID
    });

    // Queue of tasks to process
    let pendingTasks = tasksToImport.map((t, index) => ({
        ...t, 
        originalIndex: index // Keep track of original index for index-based deps (0, 1)
    }));
    
    let successCount = 0;
    let errors = [];
    let madeProgress = true;

    // 2. The Loop: Keep processing as long as we are creating tasks
    // This allows us to create "Task A" first, so "Task B" (which needs A) can find A's ID.
    while (pendingTasks.length > 0 && madeProgress) {
        madeProgress = false;
        const remainingTasks = [];

        for (const task of pendingTasks) {
            // Check if all dependencies for this task are already resolved
            const rawDeps = task.dependencies || [];
            let allDepsResolved = true;
            const resolvedDepIds = [];

            for (const dep of rawDeps) {
                let resolvedId = null;

                // Case A: Index Reference (e.g., 0, 1) in the JSON array
                if (typeof dep === 'number' && dep < tasksToImport.length) {
                    // We need to check if the task at that index has been created yet.
                    // To do this, we look up the title of the task at that index.
                    const targetTitle = tasksToImport[dep].title;
                    resolvedId = resolvedMap.get(targetTitle);
                }
                
                // Case B: Title Reference or Existing ID
                if (!resolvedId) {
                    resolvedId = resolvedMap.get(dep) || resolvedMap.get(String(dep));
                }

                if (resolvedId) {
                    resolvedDepIds.push(resolvedId);
                } else {
                    // Dependency not found yet. It might be in 'remainingTasks' waiting for its turn.
                    allDepsResolved = false; 
                    break;
                }
            }

            if (allDepsResolved) {
                // DEPENDENCIES READY! We can create this task now.
                const payload = {
                    title: task.title,
                    due_date: task.due_date,
                    estimated_hours: parseFloat(task.estimated_hours || 1),
                    importance: parseInt(task.importance || 5),
                    dependencies: resolvedDepIds // <--- This sends [1, 55], NEVER ["Title"]
                };

                try {
                    const data = await createTask(payload);
                    
                    // Add to map so future tasks can link to this one
                    resolvedMap.set(task.title, data.id);
                    successCount++;
                    madeProgress = true;
                } catch (err) {
                    errors.push(`"${task.title}": ${err.message}`);
                }
            } else {
                // Not ready yet, keep in queue
                remainingTasks.push(task);
            }
        }
        
        pendingTasks = remainingTasks;
    }

    // 3. Final Report
    if (pendingTasks.length > 0) {
        const skippedTitles = pendingTasks.map(t => t.title).join(', ');
        errors.push(`Skipped due to missing/circular dependencies: ${skippedTitles}`);
    }

    getEl('jsonInput').value = '';
    
    // Show notification first, then refresh UI after a delay to ensure notification is visible
    if (errors.length > 0) {
        showNotification(`Imported ${successCount}. Errors: ${errors[0]}`, 'error');
        // Wait for notification to be visible before refreshing
        setTimeout(async () => {
            await fetchTasks();
        }, 200);
    } else {
        showNotification(`Successfully imported ${successCount} tasks!`, 'success');
        // Wait for notification to be visible before refreshing
        setTimeout(async () => {
            await fetchTasks();
            setTimeout(() => analyzeTasks(), 500);
        }, 200);
    }
}

function sortTasks(tasks, strategy) {
    const sorted = [...tasks];

    if (strategy === 'urgent') {
        sorted.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    } else if (strategy === 'important') {
        sorted.sort((a, b) => b.importance - a.importance);
    } else if (strategy === 'quick') {
        sorted.sort((a, b) => a.estimated_hours - b.estimated_hours);
    }

    return sorted;
}

function setEmptyState(title, message) {
    const container = getEl('results');
    container.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon"></div>
            <h3>${title}</h3>
            <p>${message}</p>
        </div>
    `;
}

async function analyzeTasks() {
    const resultsDiv = getEl('results');
    resultsDiv.innerHTML = '<div class="loading">Analyzing priorities...</div>';

    try {
        const res = await fetch(`${API_URL}/analyze/`, { method: 'POST' });
        let tasks = await res.json();

        const strategy = getEl('sortStrategy').value;
        if (strategy !== 'score') {
            tasks = sortTasks(tasks, strategy);
        }

        renderTasks(tasks);
    } catch (err) {
        resultsDiv.innerHTML = '<div class="error">Failed to analyze tasks.</div>';
    }
}

function renderTasks(tasks) {
    const container = getEl('results');
    container.innerHTML = '';

    if (!tasks.length) {
        setEmptyState('No Tasks Found', 'Add tasks to see prioritized results');
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'results-grid';

    tasks.forEach((task, index) => {
        let priorityClass = 'low';
        if (task.priority_score > 50) priorityClass = 'medium';
        if (task.priority_score > 80) priorityClass = 'high';
        if (task.priority_score < 0) priorityClass = 'blocked';

        const card = document.createElement('div');
        card.className = `task-card ${priorityClass}`;

        const dueDate = new Date(task.due_date);
        const formattedDate = dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        let blockedInfo = '';
        // Check if backend returned dependency titles (it should if you updated views.py)
        // If not, we can infer them from currentTasks using the IDs if needed, 
        // but your Analyze view usually returns names.
        if (task.dependencies && task.dependencies.length > 0) {
            blockedInfo = `
                <div class="blocked-info">
                    <strong>Blocked by:</strong> ${task.dependencies.join(', ')}
                </div>
            `;
        }

        const scoreDisplay = task.priority_score < 0 ? 'Blocked' : task.priority_score.toFixed(1);

        card.innerHTML = `
            <div class="score-badge">Priority #${index + 1}</div>
            <h3>${task.title}</h3>
            <div class="task-details">
                <div class="detail-item">
                    <span class="detail-label">Due Date</span>
                    <span class="detail-value">${formattedDate}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Effort</span>
                    <span class="detail-value">${task.estimated_hours}h</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Importance</span>
                    <span class="detail-value">${task.importance}/10</span>
                </div>
            </div>
            ${blockedInfo}
            <div class="score-explain">
                <strong>Priority Score: ${scoreDisplay}</strong>
                <em>${task.explanation || 'Standard priority'}</em>
            </div>
            <div class="card-actions">
                <button onclick="markComplete(${task.id})" class="btn btn-complete">
                    <span class="btn-text">Mark as Complete</span>
                </button>
                <button onclick="deleteTask(${task.id})" class="btn btn-delete">
                    <span class="btn-text">Delete</span>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    container.innerHTML = '';
    container.appendChild(grid);
}

async function markComplete(id) {
    if (!confirm('Mark this task as complete?')) return;

    try {
        const res = await fetch(`${API_URL}/${id}/complete/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            showNotification('Task marked as complete!', 'success');
            analyzeTasks();
            fetchTasks();
        } else {
            const data = await res.json();
            showNotification(`Error: ${data.error || 'Failed to complete task'}`, 'error');
        }
    } catch (err) {
        showNotification('Network error. Please try again.', 'error');
        console.error(err);
    }
}

async function deleteTask(id) {
    if (!confirm('Are you sure you want to permanently delete this task?')) return;

    try {
        const res = await fetch(`${API_URL}/${id}/delete/`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });

        if (res.ok) {
            showNotification('Task deleted. Priority will be re-calculated.', 'info');
            fetchTasks(); // Update context for dropdowns
            setTimeout(() => analyzeTasks(), 200); // Update UI
        } else {
            const data = await res.json();
            showNotification(`Error: ${data.error || 'Failed to delete task'}`, 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showNotification('Network error. Please try again.', 'error');
    }
}

function showNotification(message, type = 'info') {
    // 1. Debounce: Prevent the exact same message from appearing twice in < 1 second
    const now = Date.now();
    if (message === lastMessage && now - lastMessageTime < 1000) {
        return;
    }
    lastMessage = message;
    lastMessageTime = now;

    // 2. Create a container if it doesn't exist (this holds the stack)
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);

        // Style the container to be fixed in the top-right
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '10000';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px'; // Space between toasts
        container.style.pointerEvents = 'none'; // Click-through empty space
    }

    // 3. Create the notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // IMPORTANT: Reset fixed positioning so they stack inside the flex container
    notification.style.position = 'relative';
    notification.style.top = 'auto';
    notification.style.right = 'auto';
    notification.style.pointerEvents = 'auto'; // Re-enable clicking on the toast itself

    container.appendChild(notification);

    // 4. Animation In - Force reflow to ensure browser renders initial state, then add .show class
    notification.offsetHeight; // Force reflow
    setTimeout(() => {
        if (notification.parentNode) {
            notification.classList.add('show');
        }
    }, 10);

    // 5. Click to dismiss
    notification.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            if (container.childNodes.length === 0) {
                container.remove();
            }
        }, 300);
    });

}

function updateDependencyDropdown(tasks) {
    const select = getEl('dependencies');
    const currentSelected = Array.from(select.selectedOptions).map(opt => opt.value);
    const availableTaskIds = tasks.map(t => String(t.id));

    select.innerHTML = '';
    tasks.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.innerText = t.title;
        if (currentSelected.includes(String(t.id)) && availableTaskIds.includes(String(t.id))) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    updateSelectedDependencies();
}

function updateSelectedDependencies() {
    const select = getEl('dependencies');
    const selectedOptions = Array.from(select.selectedOptions);
    const container = getEl('selectedDependencies');
    container.innerHTML = '';

    if (!selectedOptions.length) return;

    selectedOptions.forEach(option => {
        if (!option.value) return;

        const chip = document.createElement('div');
        chip.className = 'dependency-chip';
        chip.innerHTML = `
            <span class="chip-text">${option.textContent}</span>
            <button type="button" class="chip-delete" data-value="${option.value}" aria-label="Remove dependency">
                <span class="chip-delete-icon">×</span>
            </button>
        `;

        const deleteBtn = chip.querySelector('.chip-delete');
        deleteBtn.addEventListener('click', () => {
            option.selected = false;
            updateSelectedDependencies();
        });

        container.appendChild(chip);
    });
}

function switchInputMode(mode) {
    const formSection = getEl('formInputSection');
    const jsonSection = getEl('jsonInputSection');
    const formBtn = getEl('formModeBtn');
    const jsonBtn = getEl('jsonModeBtn');

    if (mode === 'form') {
        formSection.style.display = 'block';
        jsonSection.style.display = 'none';
        formBtn.classList.add('active');
        jsonBtn.classList.remove('active');
    } else {
        formSection.style.display = 'none';
        jsonSection.style.display = 'block';
        jsonBtn.classList.add('active');
        formBtn.classList.remove('active');
    }
}
