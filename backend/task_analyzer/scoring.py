from datetime import date

def detect_cycle(task, path=None, visited=None): # DFS -> to detect cycles (A->B->A)
    if path is None:
        path=set()
    if visited is None:
        visited = set()
    if task.id in path:
        return True
    if task.id in visited:
        return False
    path.add(task.id)
    visited.add(task.id)

    for dependency in task.dependencies.all():
        if detect_cycle(dependency, path, visited):
            return True
    path.remove(task.id)
    return False

def calculate_priority_score(task): # calculating a priority_score based on Urgency, Importance & Effort
    for dependency in task.dependencies.all():
        if not dependency.is_completed:
            return -1.0, f"Blocked by incomplete task: {dependency.title}"
        
    today = date.today() 
    days_until_due = (task.due_date - today).days # Urgency Factor

    if days_until_due < 0:
        # PAST DUE: if a task is 1 day late, it's urgent (100). If it's 5 days late, it's critical (125).
        # Adding 100 points, to ensure it tops any future tasks
        # Cap overdue score to prevent extreme values
        days_overdue = abs(days_until_due)
        urgency_score = 100 + min(days_overdue * 5, 200)  # Cap at 300 total
    elif days_until_due == 0:
        # DUE TODAY: Maximum Normal Urgency
        urgency_score = 90
    else:
        #FUTURE: Score should be decayed as the date gets further away
        # Using a decyaing function : 80 / (days + 1)
        # 1 day away: 40 points. 7 days away: 10 points.
        urgency_score = 80 / (days_until_due + 1)
    
    # Importance (User Preference)
    importance_score = task.importance * 1.5 # Scale 1-10

    # EFFORT (These are quick wins :D )
    # The idea is that shorter tasks will help build momentum
    # So we add a small bonus for tasks that are under 2 hours!
    effort_score = 0
    if task.estimated_hours < 2:
        effort_score = 10
    elif task.estimated_hours > 8:
        effort_score = -5

    # Generate Explanation
    reasons = []
    if urgency_score > 80:
        reasons.append("Due very soon")
    if task.importance >= 8:
        reasons.append("High importance")
    if effort_score > 0:
        reasons.append("Quick win (< 2h)")
    
    explanation = ", ".join(reasons) if reasons else "Standard priority"
    
    if days_until_due < 0:
        explanation = f"OVERDUE by {abs(days_until_due)} days!"
    elif days_until_due == 0:
        explanation = "Due today! " + explanation

    total_score = urgency_score + importance_score + effort_score

    return round(total_score, 2), explanation
