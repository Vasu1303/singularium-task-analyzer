import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.dateparse import parse_date
from .models import Task
from task_analyzer.scoring import calculate_priority_score, detect_cycle

@csrf_exempt
def task_list(request):
    if request.method == 'GET':
        tasks = Task.objects.filter(is_completed=False)
        data=[]
        for task in tasks:
            data.append({
                "id": task.id,
                "title": task.title,
                "due_date": str(task.due_date),
                "estimated_hours": task.estimated_hours,
                "importance": task.importance,
                "is_completed": task.is_completed,
                "dependencies": [d.id for d in task.dependencies.all() if not d.is_completed]
            })
        return JsonResponse(data, safe=False)

    elif request.method == 'POST':
        try:
            body = json.loads(request.body)

            task = Task.objects.create(
                title = body['title'],
                due_date = parse_date(body['due_date']),
                estimated_hours = float(body['estimated_hours']),
                importance = int(body['importance'])
            )

            if 'dependencies' in body:
                for dep_id in body['dependencies']:
                    dep_task = Task.objects.get(id=dep_id)
                    task.dependencies.add(dep_task)
            if detect_cycle(task):
                task.delete()
                return JsonResponse({'error':'Circular dependency detected! Task rejected.'}, status = 400)
            return JsonResponse({'id': task.id, 'message':'Task created successfully'}, status = 201)

        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

@csrf_exempt
def analyze_tasks(request):
    if request.method == 'POST':
        tasks = Task.objects.filter(is_completed=False)
        scored_tasks = []

        for task in tasks:
            score, explanation = calculate_priority_score(task)
            
            scored_tasks.append({
                "id": task.id,
                "title": task.title,
                "due_date": str(task.due_date),
                "priority_score": score,
                "explanation": explanation,
                "estimated_hours": task.estimated_hours,
                "importance": task.importance,
                "dependencies": [d.title for d in task.dependencies.filter(is_completed=False)]
            })
        
        scored_tasks.sort(key=lambda x: x['priority_score'], reverse=True)
        return JsonResponse(scored_tasks, safe=False)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def suggest_tasks(request):
    if request.method == 'GET':
        tasks = Task.objects.filter(is_completed=False)
        scored_tasks = []
        
        for task in tasks:
            score, explanation = calculate_priority_score(task)
            if score > 0:  # Only suggest actionable tasks
                scored_tasks.append({
                    "title": task.title,
                    "score": score,
                    "reason": explanation
                })
        
        # Sort and take top 3
        scored_tasks.sort(key=lambda x: x['score'], reverse=True)
        return JsonResponse(scored_tasks[:3], safe=False)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def complete_task(request, task_id):
    if request.method == 'POST':
        try:
            task = Task.objects.get(id=task_id)
            task.is_completed = True
            task.save()
            return JsonResponse({'status': 'success'})
        except Task.DoesNotExist:
            return JsonResponse({'error': 'Task not found'}, status=404)
    return JsonResponse({'error': 'Method not allowed'}, status=405)

@csrf_exempt
def delete_task(request, task_id):
    if request.method == 'DELETE':
        try:
            task = Task.objects.get(id=task_id)
            task.delete()
            return JsonResponse({'status': 'success', 'message': 'Task deleted successfully'})
        except Task.DoesNotExist:
            return JsonResponse({'error': 'Task not found'}, status=404)
    return JsonResponse({'error': 'Method not allowed'}, status=405)
