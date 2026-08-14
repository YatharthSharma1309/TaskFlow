from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from routers.boards import router as boards_router
from routers.tasks import router as tasks_router

CLIENT_DIST = Path(__file__).resolve().parent.parent / "client" / "dist"


def create_app(conn) -> FastAPI:
    app = FastAPI(title="TaskFlow API")
    app.state.db = conn

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_request: Request, exc: StarletteHTTPException):
        detail = exc.detail
        message = detail if isinstance(detail, str) else "Request failed"
        return JSONResponse({"error": message}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def invalid_body(_request: Request, _exc: RequestValidationError):
        return JSONResponse({"error": "Invalid request body"}, status_code=400)

    @app.exception_handler(Exception)
    async def unexpected_error(_request: Request, exc: Exception):
        message = str(exc)
        if "CHECK constraint failed" in message:
            return JSONResponse({"error": "Title is required"}, status_code=400)
        return JSONResponse(
            {"error": "Something went wrong. Please try again."},
            status_code=500,
        )

    @app.get("/api/health")
    def health():
        return {"ok": True}

    app.include_router(boards_router, prefix="/api/boards")
    app.include_router(tasks_router, prefix="/api/tasks")

    assets = CLIENT_DIST / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    if CLIENT_DIST.is_dir():
        @app.get("/{full_path:path}")
        def spa(full_path: str):
            candidate = CLIENT_DIST / full_path
            if full_path and candidate.is_file():
                return FileResponse(candidate)
            return FileResponse(CLIENT_DIST / "index.html")

    return app
