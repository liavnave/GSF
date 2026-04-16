"""FastAPI application entry-point — middleware, routers, lifespan."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from infra.Neo4jConnection import close_driver
from server.datasources.router import router as datasources_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    close_driver()


app = FastAPI(title="GSF API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(
    datasources_router, prefix="/api", tags=["datasources", "connectors"]
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
