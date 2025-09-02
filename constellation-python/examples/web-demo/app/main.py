"""
ConstellationFS Python Web Demo - FastAPI Application
"""

import os
import sys
from pathlib import Path

# Add the constellation package to the path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn

from .routes import api, pages

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="ConstellationFS Python Web Demo",
    description="Interactive demo of ConstellationFS with AI assistant",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Set up templates
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(api.router, prefix="/api", tags=["api"])
app.include_router(pages.router, tags=["pages"])

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "constellationfs-web-demo"}

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8000"))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    print(f"🚀 Starting ConstellationFS Web Demo on http://localhost:{port}")
    print("💡 Make sure to set your ANTHROPIC_API_KEY in .env file")
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=debug,
        access_log=debug
    )