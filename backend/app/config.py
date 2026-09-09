import os
from enum import Enum
from typing import List
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or project root
backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(backend_dir / ".env")
load_dotenv()

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"

class HandlingBehaviour(str, Enum):
    PRODUCT_DROPPED = "Product dropped"
    PRODUCT_DRAGGED = "Product dragged"
    PRODUCT_THROWN = "Product thrown"
    IMPROPER_STACKING = "Improper stacking"
    ROUGH_HANDLING = "Rough handling"
    UNSTABLE_STACKING = "Unstable stacking"

class AppEnvironment(str, Enum):
    DEVELOPMENT = "DEVELOPMENT"
    TEST = "TEST"
    DEMO = "DEMO"
    STAGING = "STAGING"
    PRODUCTION = "PRODUCTION"

class AppConfig:
    # Environment Setting
    ENVIRONMENT: AppEnvironment = AppEnvironment(os.getenv("ENVIRONMENT", "DEVELOPMENT").upper())

    # Application & Server Settings
    TITLE: str = os.getenv("APP_TITLE", "Warehouse Intelligence API")
    VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    API_PREFIX: str = os.getenv("API_PREFIX", "/api")
    CORS_ORIGINS: List[str] = [os.getenv("CORS_ORIGIN", "*")]

    # Database Settings (Environment Aware)
    @property
    def DATABASE_URL(self) -> str:
        explicit_url = os.getenv("DATABASE_URL")
        if explicit_url:
            return explicit_url
        # Anchor relative SQLite database files directly to backend_dir for CWD-independence
        env_db_map = {
            AppEnvironment.PRODUCTION: f"sqlite:///{backend_dir / 'warehouse_prod.db'}",
            AppEnvironment.STAGING: f"sqlite:///{backend_dir / 'warehouse_staging.db'}",
            AppEnvironment.DEMO: f"sqlite:///{backend_dir / 'warehouse_demo.db'}",
            AppEnvironment.TEST: f"sqlite:///{backend_dir / 'warehouse_test.db'}",
            AppEnvironment.DEVELOPMENT: f"sqlite:///{backend_dir / 'warehouse.db'}"
        }
        return env_db_map.get(self.ENVIRONMENT, f"sqlite:///{backend_dir / 'warehouse.db'}")

    # Gemini AI Settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    GEMINI_BASE_URL: str = os.getenv(
        "GEMINI_BASE_URL", 
        "https://generativelanguage.googleapis.com/v1beta/models"
    )
    GEMINI_TEMPERATURE: float = float(os.getenv("GEMINI_TEMPERATURE", "0.2"))
    GEMINI_MAX_OUTPUT_TOKENS: int = int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "1024"))
    ASSISTANT_CONTEXT_LIMIT: int = int(os.getenv("ASSISTANT_CONTEXT_LIMIT", "10"))

    # Roboflow API Settings
    ROBOFLOW_API_KEY: str = os.getenv("ROBOFLOW_API_KEY", "")
    ROBOFLOW_PROJECT_ID: str = os.getenv("ROBOFLOW_PROJECT_ID", "warehouse-carton-det")
    ROBOFLOW_MODEL_VERSION: str = os.getenv("ROBOFLOW_MODEL_VERSION", "1")
    MODEL_ENGINE: str = os.getenv("MODEL_ENGINE", "LOCAL_YOLO11")

    # System Prompt Configurations
    SYSTEM_ASSISTANT_PROMPT: str = os.getenv(
        "SYSTEM_ASSISTANT_PROMPT",
        "You are the Godrej Warehouse Field Intelligence AI Assistant. "
        "Your role is to assist warehouse supervisors by answering questions about product handling incidents, "
        "risk levels, and corrective actions. Always ground your responses strictly in the provided incident database events."
    )

settings = AppConfig()
