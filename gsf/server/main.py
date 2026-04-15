from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

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


@app.exception_handler(StarletteHTTPException)
def http_exception_handler(
    _request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    detail = exc.detail
    message = detail if isinstance(detail, str) else str(detail)
    return JSONResponse(status_code=exc.status_code, content={"message": message})


@app.exception_handler(RequestValidationError)
def validation_exception_handler(
    _request,
    exc: RequestValidationError,
) -> JSONResponse:
    parts = [f"{e['loc']}: {e['msg']}" for e in exc.errors()]
    return JSONResponse(
        status_code=422,
        content={"message": "; ".join(parts) or "Validation error"},
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
