import os
import secrets
from dotenv import load_dotenv

load_dotenv()

def _require_env(key: str) -> str:
    value = os.getenv(key)
    if not value:
        raise RuntimeError(f"Variable de entorno requerida no definida: '{key}'")
    return value

class BaseConfig:
    SECRET_KEY: str = os.getenv("SECRET_KEY") or secrets.token_hex(32)
    JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
    JWT_REFRESH_EXPIRATION_DAYS: int = int(os.getenv("JWT_REFRESH_EXPIRATION_DAYS", "7"))

    # ─── Base de Datos ──────────────────────────────────────────────────────────
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: str = os.getenv("DB_PORT", "5432")
    DB_NAME: str = os.getenv("DB_NAME", "chukutaexpress")
    DB_USER: str = os.getenv("DB_USER", "postgres")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "")

    # Cambio: Usar conector +pg8000
    SQLALCHEMY_DATABASE_URI: str = (
        f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS: bool = False
    SQLALCHEMY_ENGINE_OPTIONS: dict = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 10,
        "max_overflow": 20,
    }

    ALLOWED_ORIGINS: list = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    RATELIMIT_DEFAULT: str = "200 per hour"
    RATELIMIT_AUTH: str = "10 per minute"
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100

class DevelopmentConfig(BaseConfig):
    DEBUG: bool = True
    SQLALCHEMY_ECHO: bool = False

class ProductionConfig(BaseConfig):
    DEBUG: bool = False
    SECRET_KEY: str = _require_env("SECRET_KEY")
    DB_PASSWORD: str = _require_env("DB_PASSWORD")
    
    # Cambio: Aplicar también +pg8000 en producción
    SQLALCHEMY_DATABASE_URI: str = (
        f"postgresql+pg8000://{BaseConfig.DB_USER}:{_require_env('DB_PASSWORD')}"
        f"@{BaseConfig.DB_HOST}:{BaseConfig.DB_PORT}/{BaseConfig.DB_NAME}"
    )

    SESSION_COOKIE_SECURE: bool = True
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "Lax"
    JWT_EXPIRATION_HOURS: int = int(os.getenv("JWT_EXPIRATION_HOURS", "8"))

class TestingConfig(BaseConfig):
    TESTING: bool = True
    SQLALCHEMY_DATABASE_URI: str = "sqlite:///:memory:"
    WTF_CSRF_ENABLED: bool = False

_config_map = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}

def get_config():
    env = os.getenv("FLASK_ENV", "development").lower()
    config_class = _config_map.get(env)
    if not config_class:
        raise ValueError(f"FLASK_ENV inválido: '{env}'. Opciones: {list(_config_map.keys())}")
    return config_class()