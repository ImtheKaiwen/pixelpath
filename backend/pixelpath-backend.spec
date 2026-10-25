from pathlib import Path

backend = Path(SPECPATH)
project = backend.parent

a = Analysis(
    [str(backend / "app.py")],
    pathex=[str(backend)],
    binaries=[],
    datas=[(str(project / "web"), "web"), (str(backend / "seed"), "seed")],
    hiddenimports=[],
    hookspath=[],
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="pixelpath-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
)
