from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'module.json').read_text())
assert json.loads((root / 'manifest.json').read_text()) == manifest
out = root / 'dist'
out.mkdir(exist_ok=True)
archive = out / f"{manifest['id']}-v{manifest['version']}.zip"
files = [root / name for name in ['module.json', 'manifest.json', 'README.md', 'CHANGELOG.md', 'LICENSE']]
for directory in ['scripts', 'styles', 'assets']:
    files.extend(path for path in (root / directory).rglob('*') if path.is_file())
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
    for path in sorted(files):
        name = f"{manifest['id']}/{path.relative_to(root).as_posix()}"
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        package.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
for name in ['module.json', 'manifest.json']:
    shutil.copyfile(root / name, out / name)
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    assert json.loads(package.read(f"{manifest['id']}/module.json")) == manifest
    assert all(f"{manifest['id']}/{entry}" in package.namelist() for entry in manifest['esmodules'] + manifest['styles'])
print(json.dumps({'archive': str(archive), 'files': len(files), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}))
