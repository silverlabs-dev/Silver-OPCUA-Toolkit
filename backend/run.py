# backend/run.py
# Use this file to run the server instead of calling uvicorn directly.
# This ensures our logging config is applied before uvicorn initializes.

import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_config=None,
        log_level="warning",
    )