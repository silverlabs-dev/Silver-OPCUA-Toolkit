# backend/app/core/logging_config.py

import logging
import sys
from app.core.config import settings


def setup_logging() -> None:
    """
    Configures structured logging for the entire application.
    In development: human-readable text format with colors.
    In production: JSON-friendly format for log aggregators.
    Called once during app lifespan startup — not at module level.
    """
    log_level = settings.LOG_LEVEL.upper()

    if settings.LOG_FORMAT == "json":
        formatter = _JsonFormatter()
    else:
        formatter = _TextFormatter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    # Configure root logger — clear all existing handlers first
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    root_logger.handlers = []
    root_logger.addHandler(handler)

    # Suppress noisy third-party loggers completely
    for name in [
        "asyncua",
        "asyncua.client",
        "asyncua.common",
        "asyncua.uaprotocol",
        "asyncua.client.ua_client",
        "asyncua.client.client",
        "uvicorn",
        "uvicorn.access",
        "uvicorn.error",
        "sqlalchemy",
        "sqlalchemy.engine",
        "sqlalchemy.engine.Engine",
        "sqlalchemy.pool",
        "sqlalchemy.dialects",
        "watchfiles",
    ]:
        lg = logging.getLogger(name)
        lg.setLevel(logging.WARNING)
        lg.handlers = []
        lg.propagate = False

    logging.getLogger(__name__).info(
        f"Logging initialized [level={log_level}, format={settings.LOG_FORMAT}, env={settings.ENV}]"
    )


class _TextFormatter(logging.Formatter):
    """
    Human-readable format for development.
    Example: 2024-01-15 10:23:01 | INFO     | app.opcua.manager | Connected to opc.tcp://...
    """

    LEVEL_COLORS = {
        "DEBUG":    "\033[36m",   # Cyan
        "INFO":     "\033[32m",   # Green
        "WARNING":  "\033[33m",   # Yellow
        "ERROR":    "\033[31m",   # Red
        "CRITICAL": "\033[41m",   # Red background
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.LEVEL_COLORS.get(record.levelname, "")
        level = f"{color}{record.levelname:<8}{self.RESET}"
        timestamp = self.formatTime(record, "%Y-%m-%d %H:%M:%S")
        return f"{timestamp} | {level} | {record.name} | {record.getMessage()}"


class _JsonFormatter(logging.Formatter):
    """
    Machine-readable format for production / log aggregators.
    Each line is a valid JSON object.
    """

    def format(self, record: logging.LogRecord) -> str:
        import json
        from datetime import datetime, timezone

        payload = {
            "ts":      datetime.now(timezone.utc).isoformat(),
            "level":   record.levelname,
            "logger":  record.name,
            "message": record.getMessage(),
        }

        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False)