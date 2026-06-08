"""Tasks & Follow-ups router — Phase 9.

Endpoints
---------
GET    /tasks              list (filters: status, priority, type, lead_id, deal_id, overdue, due_today)
POST   /tasks              create
GET    /tasks/summary      counts by status + overdue/today/week
GET    /tasks/{id}         get one
PATCH  /tasks/{id}         update
DELETE /tasks/{id}         delete (204)
POST   /tasks/{id}/complete  mark done
POST   /tasks/{id}/reopen    reset to pending
GET    /tasks/lead/{lead_id}  tasks for a lead
GET    /tasks/deal/{deal_id}  tasks for a deal
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db, get_current_user
from models.user import User
from models.task import Task
from models.lead import Lead
from models.deal import Deal
from schemas.task import CreateTaskRequest, UpdateTaskRequest, TaskResponse, TaskSummary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tasks", tags=["tasks"])


# ─── helpers ──────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _enrich(task: Task, db: AsyncSession) -> TaskResponse:
    """Populate lead_company, lead_contact, deal_title, assigned_to_name, is_overdue."""
    resp = TaskResponse.model_validate(task)

    if task.lead_id:
        lead = await db.get(Lead, task.lead_id)
        if lead:
            resp.lead_company = lead.company
            resp.lead_contact = lead.contact_name

    if task.deal_id:
        deal = await db.get(Deal, task.deal_id)
        if deal:
            resp.deal_title = deal.title

    if task.assigned_to:
        user = await db.get(User, task.assigned_to)
        if user:
            resp.assigned_to_name = user.full_name

    now = _now()
    if task.due_date and task.status not in ("done", "cancelled"):
        due = task.due_date if task.due_date.tzinfo else task.due_date.replace(tzinfo=timezone.utc)
        resp.is_overdue = due < now

    return resp


async def _get_task_or_404(task_id: UUID, tenant_id: UUID, db: AsyncSession) -> Task:
    task = await db.get(Task, task_id)
    if not task or task.tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


# ─── list ─────────────────────────────────────────────────────────────────────

@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    task_status: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None, alias="type"),
    lead_id: Optional[UUID] = Query(None),
    deal_id: Optional[UUID] = Query(None),
    overdue: bool = Query(False),
    due_today: bool = Query(False),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = current_user.tenant_id
    now = _now()

    conditions = [Task.tenant_id == tenant_id]
    if task_status:
        conditions.append(Task.status == task_status)
    if priority:
        conditions.append(Task.priority == priority)
    if task_type:
        conditions.append(Task.task_type == task_type)
    if lead_id:
        conditions.append(Task.lead_id == lead_id)
    if deal_id:
        conditions.append(Task.deal_id == deal_id)
    if overdue:
        conditions.append(Task.due_date < now)
        conditions.append(Task.status.notin_(["done", "cancelled"]))
    if due_today:
        today_end = now.replace(hour=23, minute=59, second=59)
        today_start = now.replace(hour=0, minute=0, second=0)
        conditions.append(Task.due_date >= today_start)
        conditions.append(Task.due_date <= today_end)
        conditions.append(Task.status.notin_(["done", "cancelled"]))

    rows = await db.execute(
        select(Task)
        .where(and_(*conditions))
        .order_by(
            # Urgent first, then by due_date ascending, then created_at
            Task.due_date.asc().nulls_last(),
            Task.created_at.desc(),
        )
        .limit(limit)
    )
    tasks = rows.scalars().all()
    return [await _enrich(t, db) for t in tasks]


# ─── summary ──────────────────────────────────────────────────────────────────

@router.get("/summary", response_model=TaskSummary)
async def task_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quick counts — used by dashboard widget and TasksPage header."""
    tenant_id = current_user.tenant_id
    now = _now()
    today_end = now.replace(hour=23, minute=59, second=59)
    today_start = now.replace(hour=0, minute=0, second=0)
    week_end = now + timedelta(days=7)

    async def _count(extra_conds: list) -> int:
        base = [Task.tenant_id == tenant_id] + extra_conds
        return await db.scalar(
            select(__import__("sqlalchemy", fromlist=["func"]).func.count(Task.id))
            .where(and_(*base))
        ) or 0

    from sqlalchemy import func
    pending     = await _count([Task.status == "pending"])
    in_progress = await _count([Task.status == "in_progress"])
    done        = await _count([Task.status == "done"])
    cancelled   = await _count([Task.status == "cancelled"])
    overdue     = await _count([Task.due_date < now, Task.status.notin_(["done", "cancelled"])])
    due_today   = await _count([Task.due_date >= today_start, Task.due_date <= today_end,
                                Task.status.notin_(["done", "cancelled"])])
    due_week    = await _count([Task.due_date >= today_start, Task.due_date <= week_end,
                                Task.status.notin_(["done", "cancelled"])])

    return TaskSummary(
        pending=pending,
        in_progress=in_progress,
        done=done,
        cancelled=cancelled,
        overdue=overdue,
        due_today=due_today,
        due_this_week=due_week,
        total=pending + in_progress + done + cancelled,
    )


# ─── create ───────────────────────────────────────────────────────────────────

@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: CreateTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = Task(
        tenant_id=current_user.tenant_id,
        created_by=current_user.id,
        assigned_to=body.assigned_to,
        lead_id=body.lead_id,
        deal_id=body.deal_id,
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        priority=body.priority,
        due_date=body.due_date,
        status="pending",
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return await _enrich(task, db)


# ─── get one ──────────────────────────────────────────────────────────────────

@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_or_404(task_id, current_user.tenant_id, db)
    return await _enrich(task, db)


# ─── update ───────────────────────────────────────────────────────────────────

@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: UUID,
    body: UpdateTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_or_404(task_id, current_user.tenant_id, db)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    task.updated_at = _now()
    # Auto-set completed_at when status flipped to done
    if body.status == "done" and not task.completed_at:
        task.completed_at = _now()
    await db.commit()
    await db.refresh(task)
    return await _enrich(task, db)


# ─── delete ───────────────────────────────────────────────────────────────────

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_or_404(task_id, current_user.tenant_id, db)
    await db.delete(task)
    await db.commit()


# ─── complete / reopen ────────────────────────────────────────────────────────

@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_or_404(task_id, current_user.tenant_id, db)
    task.status = "done"
    task.completed_at = _now()
    task.updated_at = _now()
    await db.commit()
    await db.refresh(task)
    return await _enrich(task, db)


@router.post("/{task_id}/reopen", response_model=TaskResponse)
async def reopen_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await _get_task_or_404(task_id, current_user.tenant_id, db)
    task.status = "pending"
    task.completed_at = None
    task.updated_at = _now()
    await db.commit()
    await db.refresh(task)
    return await _enrich(task, db)


# ─── by lead / by deal ────────────────────────────────────────────────────────

@router.get("/lead/{lead_id}", response_model=list[TaskResponse])
async def tasks_for_lead(
    lead_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(Task)
        .where(Task.tenant_id == current_user.tenant_id, Task.lead_id == lead_id)
        .order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
    )
    return [await _enrich(t, db) for t in rows.scalars().all()]


@router.get("/deal/{deal_id}", response_model=list[TaskResponse])
async def tasks_for_deal(
    deal_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await db.execute(
        select(Task)
        .where(Task.tenant_id == current_user.tenant_id, Task.deal_id == deal_id)
        .order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc())
    )
    return [await _enrich(t, db) for t in rows.scalars().all()]
