from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def index():
    return FileResponse("static/index.html")

@app.get("/index.html")
def index_html():
    return FileResponse("static/index.html")

@app.get("/app.js")
def app_js():
    return FileResponse("static/app.js")

@app.get("/relax")
def relax():
    return FileResponse("static/relax.html")

@app.get("/katsu")
def katsu():
    return FileResponse("static/katsu.html")
