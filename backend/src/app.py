from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routes.transactions import router as transactions_router
from routes.costs import router as costs_router
from routes.users import router as users_router
from routes.representatives import router as users_representatives
from database import test_db_connection
import logging
import os

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="MatPoz CRM API")

# Konfiguracja CORS - rozszerzona lista origins
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "http://frontend:3000",
    "https://crm.move37th.ai",
    "https://www.crm.move37th.ai",
    "http://crm.move37th.ai",
    "http://www.crm.move37th.ai",
    # Load balancer URLs
    "http://app-lb-1176488264.eu-central-1.elb.amazonaws.com",
    "http://app-lb-1176488264.eu-central-1.elb.amazonaws.com:3000",
    "https://app-lb-1176488264.eu-central-1.elb.amazonaws.com",
    "https://app-lb-1176488264.eu-central-1.elb.amazonaws.com:3000",
]

# Dodajemy możliwość konfiguracji CORS przez zmienną środowiskową
if additional_origins := os.getenv("ADDITIONAL_CORS_ORIGINS"):
    origins.extend(additional_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)


# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Sprawdzamy połączenie z bazą danych
        db_status = test_db_connection()
        return JSONResponse(
            content={
                "status": "ok" if db_status else "error",
                "version": "dupa_zupa",
                "database": "connected" if db_status else "disconnected"
            },
            status_code=200 if db_status else 500
        )
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            content={"status": "error", "detail": str(e)},
            status_code=500
        )


# Event handlers
@app.on_event("startup")
async def startup_event():
    logger.info("Starting MatPoz CRM API")
    logger.info("Environment: %s", os.getenv("ENV", "development"))

    # Test database connection during startup
    logger.info("Testing database connection...")
    if test_db_connection():
        logger.info("✅ Successfully connected to the database")
    else:
        logger.error("❌ Failed to connect to the database")

    logger.info("Registered routes:")
    for route in app.routes:
        logger.info(f"  {route.path} [{', '.join(route.methods)}]")

    logger.info("CORS origins:")
    for origin in origins:
        logger.info(f"  {origin}")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down MatPoz CRM API")


# Middleware do logowania żądań i obsługi błędów
@app.middleware("http")
async def log_requests(request, call_next):
    request_id = request.headers.get("X-Request-ID", "N/A")
    logger.info(f"Request {request_id}: {request.method} {request.url}")
    try:
        response = await call_next(request)
        logger.info(f"Response {request_id}: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request {request_id} failed: {str(e)}")
        return JSONResponse(
            content={"detail": "Internal server error"},
            status_code=500
        )


# Error handlers
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception handler caught: {str(exc)}")
    return JSONResponse(
        content={"detail": "Internal server error"},
        status_code=500
    )


# Podpięcie routerów
app.include_router(
    transactions_router,
    prefix="/api",
    tags=["transactions"]
)

app.include_router(
    costs_router,
    prefix="/api",
    tags=["costs"]
)
app.include_router(
    users_router,
    prefix="/api",
    tags=["users"]
)
app.include_router(
    users_representatives,
    prefix="/api",
    tags=["representatives"]
)

if __name__ == "__main__":
    import uvicorn

    # W trybie developerskim włączamy auto-reload
    is_dev = os.getenv("ENV", "development") == "development"
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=is_dev,
        workers=int(os.getenv("WORKERS", 1))
    )