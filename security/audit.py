"""Read-only source/release checks. No upload, credential collection, or extraction."""
import argparse
import hashlib
import json
import pathlib
import re
import stat
import subprocess
import zipfile

MAX_EXPANDED = 512 * 1024 * 1024
SECRET_PATTERNS = [
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"),
    re.compile(rb"github_pat_[A-Za-z0-9_]{30,}"),
    re.compile(rb"AKIA[0-9A-Z]{16}"),
    re.compile(rb"(?i)(?:_authToken|WARLIKE_BRIDGE_KEY|WARLIKE_SERVER_GATE)\s*[:=]\s*[\"']?[A-Za-z0-9_-]{40,}"),
]

def safe_path(name):
    if not name or len(name) > 240 or name.startswith('/') or '\\' in name or ':' in name:
        return False
    if any(ord(c) < 32 or ord(c) > 126 for c in name):
        return False
    for part in name.rstrip('/').split('/'):
        lower = part.lower()
        stem = lower.split('.')[0]
        if not part or part in ('.', '..') or part.endswith(('.', ' ')):
            return False
        if lower in ('.git', '.dev.vars', '.env') or lower.startswith('.env.'):
            return False
        if stem in ('con', 'prn', 'aux', 'nul') or re.fullmatch(r'(com|lpt)[0-9]', stem):
            return False
    return True

def inspect_archive(path, guard=None):
    names = []
    with zipfile.ZipFile(path) as archive:
        entries = archive.infolist()
        if not entries or len(entries) > 4096 or sum(e.file_size for e in entries) > MAX_EXPANDED:
            raise ValueError('Archive count or expanded size limit exceeded')
        seen = set()
        for entry in entries:
            name = entry.filename
            if not safe_path(name) or stat.S_ISLNK(entry.external_attr >> 16) or entry.flag_bits & 1:
                raise ValueError('Unsafe, linked, or encrypted archive entry')
            key = name.rstrip('/').lower()
            if key in seen:
                raise ValueError('Duplicate or case-colliding archive path')
            seen.add(key)
            if entry.file_size > 256 * 1024 * 1024 or entry.file_size > max(entry.compress_size, 1) * 500:
                raise ValueError('Archive expansion ratio exceeded')
            names.append(name)
        if archive.testzip() is not None:
            raise ValueError('Corrupt archive CRC')
    if guard:
        subprocess.run([str(pathlib.Path(guard).resolve())], input=('\n'.join(names) + '\n').encode(), check=True, capture_output=True, timeout=10)
    with open(path, 'rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest()
    return {'file': pathlib.Path(path).name, 'entries': len(names), 'sha256': digest, 'native_paths': bool(guard)}

def source_audit(root):
    root = pathlib.Path(root).resolve()
    result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'], cwd=root, check=True, capture_output=True)
    paths = sorted(set(p for p in result.stdout.decode().split('\0') if p))
    findings = []
    for name in paths:
        path = root / name
        if path.is_symlink():
            findings.append({'file': name, 'problem': 'source symlink'}); continue
        if not path.is_file():
            continue
        if any(p in ('node_modules', '.wrangler', 'bin', 'obj') for p in path.relative_to(root).parts):
            findings.append({'file': name, 'problem': 'runtime files in source'}); continue
        if path.name.startswith(('.env', '.dev.vars')) and path.name != '.env.example':
            findings.append({'file': name, 'problem': 'environment file in source'}); continue
        raw = path.read_bytes()
        if any(pattern.search(raw) for pattern in SECRET_PATTERNS):
            findings.append({'file': name, 'problem': 'possible embedded secret'})
    return {'files': len(paths), 'findings': findings}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', default='.')
    parser.add_argument('--archive', type=pathlib.Path)
    parser.add_argument('--path-guard', type=pathlib.Path)
    args = parser.parse_args()
    report = source_audit(args.root)
    if args.archive:
        report['release'] = inspect_archive(args.archive, args.path_guard)
    print(json.dumps(report, indent=2))
    return int(bool(report['findings']))

if __name__ == '__main__':
    raise SystemExit(main())
