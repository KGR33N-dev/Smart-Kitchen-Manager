from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import engine, get_db

# Tworzenie wszystkich tabel w bazie jeśli nie istnieją (w produkcji lepiej użyć np. alembic)
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Kitchen Manager API",
    description="API do zarządzania zapasami w inteligentnej kuchni (Iteracja 1 z Baza i Dockerem)",
    version="1.0.0"
)

@app.get("/", tags=["Root"])
def read_root():
    return {"message": "Witaj w Smart Kitchen Manager API! Otwórz /docs dla dokumentacji Swagger."}

@app.get("/health", tags=["Root"])
def health_check():
    return {"status": "ok"}

