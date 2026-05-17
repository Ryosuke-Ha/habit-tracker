import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import models
from database import SessionLocal, engine
from domain.exceptions import DomainError
from routers import ai_analysis, coaching, habits, monthly_reviews, notifications, persistent_todos, reviews, scheduled_todos, settings, subtasks, templates

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Habit Tracker API")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router)
app.include_router(habits.router)
app.include_router(reviews.router)
app.include_router(ai_analysis.router)
app.include_router(monthly_reviews.router)
app.include_router(persistent_todos.router)
app.include_router(scheduled_todos.router)
app.include_router(subtasks.router)
app.include_router(settings.router)
app.include_router(coaching.router)
app.include_router(notifications.router)


@app.exception_handler(DomainError)
async def domain_error_handler(request, exc: DomainError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )


@app.get("/health")
async def health_check():
    return {"status": "ok"}


def seed_data():
    db = SessionLocal()
    try:
        if db.query(models.Template).count() > 0:
            return

        weekday = models.Template(name="平日")
        weekend = models.Template(name="休日")
        db.add(weekday)
        db.add(weekend)
        db.flush()

        weekday_habits = [
            models.Habit(template_id=weekday.id, title="筋トレ", scheduled_time="07:00", location="ジム", order=0),
            models.Habit(template_id=weekday.id, title="英語学習", scheduled_time="12:00", location="カフェ", order=1),
            models.Habit(template_id=weekday.id, title="読書30分", scheduled_time="22:00", location="寝室", order=2),
        ]
        weekend_habits = [
            models.Habit(template_id=weekend.id, title="長時間読書", scheduled_time="09:00", location="自宅", order=0),
            models.Habit(template_id=weekend.id, title="投資リサーチ", scheduled_time="10:00", location="自宅", order=1),
        ]
        db.add_all(weekday_habits + weekend_habits)
        db.commit()
    finally:
        db.close()


seed_data()
