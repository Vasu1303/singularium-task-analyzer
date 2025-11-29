const API_URL = 'http://127.0.0.1:8000/api/tasks';

let currentTasks = []

document.addEventListener('DOMContentLoaded', () => {
    fetchTasks()

    document.getElementById('taskForm').addEventListener('submit', handleAddTask);
    document.getElementById('analyzeBtn').addEventListener('click', analyzeTasks);
    
    const depSelect = document.getElementById('dependencies');
    depSelect.addEventListener('change', updateSelectedDependencies);
    
    document.getElementById('formModeBtn').addEventListener('click', () => switchInputMode('form'));
    document.getElementById('jsonModeBtn').addEventListener('click', () => switchInputMode('json'));
    document.getElementById('importJsonBtn').addEventListener('click', handleJsonImport);
});

// Fetch Tasks

async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/`);
        currentTasks = await res.json();
        updateDependencyDropdown(currentTasks);
    } catch(err) {
        console.error('Error fetching tasks:', err)
    }
}

// Add new Task

async function handleAddTask(e) {
    e.preventDefault()
    const depSelect = document.getElementById('dependencies');
    const selectedDeps = Array.from(depSelect.selectedOptions).map(opt => opt.value)

    const payload = {
        title: document.getElementById('title').value,
        due_date: document.getElementById('dueDate').value,
        estimated_hours: document.getElementById('hours').value,
        importance: document.getElementById('importance').value,
        dependencies: selectedDeps
    }

    try {
        const res = await fetch(`${API_URL}/`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        })

        const data = await res.json();
        if (res.ok) {
            showNotification('Task added successfully', 'success');
            document.getElementById('taskForm').reset();
            fetchTasks();
        } else {
            showNotification(`Error: ${data.error}`, 'error');
        }
    } catch (err) {
        alert('Network Error')
    }
}

// Analyze & Render

async function analyzeTasks() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '<div class="loading">Analyzing priorities...</div>';

    try {
        const res = await fetch(`${API_URL}/analyze/`, {method: 'POST'});
        let tasks = await res.json();

        const strategy = document.getElementById('sortStrategy').value;

        if (strategy === 'urgent') {
            tasks.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        } else if (strategy === 'important') {
            tasks.sort((a,b) => b.importance - a.importance);
        } else if (strategy === 'quick') {
            tasks.sort((a,b) => a.estimated_hours - b.estimated_hours);
        } else {
            // Default Score - already sorted by priority_score from backend
        }

        renderTasks(tasks);
    } catch (err) {
        resultsDiv.innerHTML = '<div class="error">Failed to analyze tasks.</div>';
    }
}

function renderTasks(tasks) {
    const container = document.getElementById('results');
    container.innerHTML = '';

    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon"></div>
                <h3>No Tasks Found</h3>
                <p>Add tasks to see prioritized results</p>
            </div>
        `;
        return;
    }

    // Create results grid container
    const grid = document.createElement('div');
    grid.className = 'results-grid';

    tasks.forEach((task, index) => {
        let priorityClass = 'low';
        if (task.priority_score > 50) priorityClass = 'medium';
        if (task.priority_score > 80) priorityClass = 'high';
        if (task.priority_score < 0) priorityClass = 'blocked';
        
        const card = document.createElement('div');
        card.className = `task-card ${priorityClass}`;
        
        // Format date
        const dueDate = new Date(task.due_date);
        const formattedDate = dueDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        // Show blocked dependencies if any
        let blockedInfo = '';
        if (task.dependencies && task.dependencies.length > 0) {
            blockedInfo = `
                <div class="blocked-info">
                    <strong>Blocked by:</strong> ${task.dependencies.join(', ')}
                </div>
            `;
        }
        
        // Format priority score
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
};

async function markComplete(id) {
    if (!confirm("Mark this task as complete?")) return;
    
    try {
        const res = await fetch(`${API_URL}/${id}/complete/`, { 
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        
        if (res.ok) {
            showNotification('Task marked as complete!', 'success');
            analyzeTasks(); // Refresh the list
            fetchTasks(); // Update dependency dropdown
        } else {
            const data = await res.json();
            showNotification(`Error: ${data.error || 'Failed to complete task'}`, 'error');
        }
    } catch (err) {
        showNotification('Network error. Please try again.', 'error');
        console.error(err);
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notification if any
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Trigger animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function updateDependencyDropdown(tasks) {
    const select = document.getElementById('dependencies');
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
    const select = document.getElementById('dependencies');
    const selectedOptions = Array.from(select.selectedOptions);
    const container = document.getElementById('selectedDependencies');
    container.innerHTML = '';
    
    if (selectedOptions.length === 0) {
        return;
    }
    
    selectedOptions.forEach(option => {
        if (!option.value || option.value === '') {
            return;
        }
        
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

function removeDependency(depId) {
    const select = document.getElementById('dependencies');
    const option = select.querySelector(`option[value="${depId}"]`);
    if (option) {
        option.selected = false;
        updateSelectedDependencies();
    }
}

function switchInputMode(mode) {
    const formSection = document.getElementById('formInputSection');
    const jsonSection = document.getElementById('jsonInputSection');
    const formBtn = document.getElementById('formModeBtn');
    const jsonBtn = document.getElementById('jsonModeBtn');
    
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

async function handleJsonImport() {
    const jsonInput = document.getElementById('jsonInput').value.trim();
    
    if (!jsonInput) {
        showNotification('Please paste JSON data', 'error');
        return;
    }
    
    let tasks;
    try {
        tasks = JSON.parse(jsonInput);
    } catch (err) {
        showNotification('Invalid JSON format. Please check your syntax.', 'error');
        return;
    }
    
    if (!Array.isArray(tasks)) {
        showNotification('JSON must be an array of task objects', 'error');
        return;
    }
    
    if (tasks.length === 0) {
        showNotification('No tasks found in JSON', 'error');
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        if (!task.title || !task.due_date || task.estimated_hours === undefined || task.importance === undefined) {
            errorCount++;
            errors.push(`Task ${i + 1}: Missing required fields (title, due_date, estimated_hours, importance)`);
            continue;
        }
        
        if (task.importance < 1 || task.importance > 10) {
            errorCount++;
            errors.push(`Task ${i + 1}: Importance must be between 1 and 10`);
            continue;
        }
        
        if (task.estimated_hours <= 0) {
            errorCount++;
            errors.push(`Task ${i + 1}: Estimated hours must be greater than 0`);
            continue;
        }
        
        const payload = {
            title: task.title,
            due_date: task.due_date,
            estimated_hours: parseFloat(task.estimated_hours),
            importance: parseInt(task.importance),
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : []
        };
        
        try {
            const res = await fetch(`${API_URL}/`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (res.ok) {
                successCount++;
            } else {
                errorCount++;
                errors.push(`Task ${i + 1}: ${data.error || 'Failed to create'}`);
            }
        } catch (err) {
            errorCount++;
            errors.push(`Task ${i + 1}: Network error`);
        }
    }
    
    if (successCount > 0) {
        showNotification(`Successfully imported ${successCount} task(s)`, 'success');
        document.getElementById('jsonInput').value = '';
        fetchTasks();
    }
    
    if (errorCount > 0) {
        const errorMsg = errors.length > 3 
            ? `${errors.slice(0, 3).join('; ')}... (${errorCount} errors total)`
            : errors.join('; ');
        showNotification(`Failed to import ${errorCount} task(s): ${errorMsg}`, 'error');
    }
}

async function deleteTask(id) {
    if (!confirm("Are you sure you want to permanently delete this task?")) return;
    
    try {
        const url = `${API_URL}/${id}/delete/`;
        console.log('Deleting task at URL:', url);
        
        const res = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        console.log('Delete response status:', res.status);
        
        if (res.ok) {
            const data = await res.json();
            console.log('Delete response:', data);
            showNotification('Task deleted successfully', 'success');
            
            const depSelect = document.getElementById('dependencies');
            const selectedDeps = Array.from(depSelect.selectedOptions).map(opt => opt.value);
            
            fetchTasks().then(() => {
                const updatedSelect = document.getElementById('dependencies');
                const availableIds = Array.from(updatedSelect.options).map(opt => opt.value);
                
                selectedDeps.forEach(depId => {
                    if (!availableIds.includes(depId)) {
                        const option = updatedSelect.querySelector(`option[value="${depId}"]`);
                        if (option) {
                            option.selected = false;
                        }
                    }
                });
                
                updateSelectedDependencies();
            });
            
            analyzeTasks();
        } else {
            const data = await res.json().catch(() => ({ error: 'Unknown error' }));
            console.error('Delete failed:', data);
            showNotification(`Error: ${data.error || 'Failed to delete task'}`, 'error');
        }
    } catch (err) {
        console.error('Delete error:', err);
        showNotification('Network error. Please try again.', 'error');
    }
}
