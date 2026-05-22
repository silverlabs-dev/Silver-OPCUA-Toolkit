# backend/run.py
# Use this file to run the server instead of calling uvicorn directly.
# This ensures our logging config is applied before uvicorn initializes.

import uvicorn
import multiprocessing

if __name__ == "__main__":
    # Only initialize on the main process, not the reloader child
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None,       # Disable uvicorn's default logging config
        log_level="warning",   # Suppress uvicorn's own logs
    )