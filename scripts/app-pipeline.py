#!/usr/bin/env python3
"""Small no-follow primitives for the app build/deploy pipeline."""
import fcntl, hashlib, json, os, pwd, re, shutil, stat, sys, tempfile
from pathlib import Path

EXCLUDED_TOP = {"node_modules", ".runtime", ".releases", ".build-work"}
ROOT_FILES = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", ".npmrc"]

def die(msg):
    print(msg, file=sys.stderr); raise SystemExit(70)

def open_lock(path, create=False, production=False):
    p = Path(path); parent = p.parent
    pst = os.lstat(parent)
    if not stat.S_ISDIR(pst.st_mode) or stat.S_ISLNK(pst.st_mode): die("unsafe lock parent")
    flags = os.O_RDWR | os.O_CLOEXEC | os.O_NOFOLLOW
    if create: flags |= os.O_CREAT
    fd = os.open(p, flags, 0o666)
    fst, lst = os.fstat(fd), os.lstat(p)
    if not stat.S_ISREG(fst.st_mode) or (fst.st_dev, fst.st_ino) != (lst.st_dev, lst.st_ino): die("unsafe lock inode")
    if production:
        if os.geteuid() != 0: die("production lock initialization requires root")
        os.fchown(fd, 0, 0); os.fchmod(fd, 0o666)
        if os.stat(parent).st_uid != 0: die("production lock parent must be root-owned")
    return fd

def verify_lock(path, fd):
    fst, lst = os.fstat(fd), os.lstat(path)
    if not stat.S_ISREG(fst.st_mode) or stat.S_ISLNK(lst.st_mode) or (fst.st_dev, fst.st_ino) != (lst.st_dev, lst.st_ino): die("inherited lock does not match canonical lock")
    try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError: die("inherited fd does not own the build lock")

def entries(root):
    root = Path(root); paths = []
    for name in ROOT_FILES:
        p = root / name
        if not p.is_file() or p.is_symlink(): die(f"unsafe/missing build input: {name}")
        paths.append((name, p))
    app = root / "app"
    for base, dirs, files in os.walk(app, topdown=True, followlinks=False):
        relbase = Path(base).relative_to(app)
        kept = []
        for d in sorted(dirs):
            if (relbase == Path(".") and (d in EXCLUDED_TOP or d == ".next" or d.startswith(".next."))): continue
            p = Path(base) / d
            if p.is_symlink(): die(f"symlink build input rejected: {p}")
            kept.append(d)
        dirs[:] = kept
        for name in sorted(files):
            if relbase == Path(".") and (name == ".app-build.lock" or name.startswith(".next.")): continue
            p = Path(base) / name
            if p.is_symlink() or not p.is_file(): die(f"non-regular build input rejected: {p}")
            paths.append((str(Path("app") / relbase / name), p))
    return paths

def fingerprint(root):
    out = {}
    for rel, p in entries(root):
        st = os.stat(p, follow_symlinks=False); h = hashlib.sha256()
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""): h.update(chunk)
        out[rel] = [stat.S_IMODE(st.st_mode), st.st_size, st.st_mtime_ns, h.hexdigest()]
    return out

def snapshot(root, dest):
    root, dest = Path(root), Path(dest)
    dstst = os.lstat(dest)
    if not stat.S_ISDIR(dstst.st_mode) or stat.S_ISLNK(dstst.st_mode) or any(dest.iterdir()): die("snapshot destination must be a reserved empty directory")
    before = fingerprint(root)
    for rel, src in entries(root):
        target = dest / rel; target.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
        with open(src, "rb") as r, os.fdopen(fd, "wb") as w: shutil.copyfileobj(r, w)
        st = os.stat(src, follow_symlinks=False); os.chmod(target, stat.S_IMODE(st.st_mode)); os.utime(target, ns=(st.st_atime_ns, st.st_mtime_ns))
    copied = fingerprint(dest)
    after = fingerprint(root)
    if before != after or before != copied:
        shutil.rmtree(dest)
        die("build inputs changed while snapshotting")
    ws = dest / "pnpm-workspace.yaml"
    text = ws.read_text()
    text, n = re.subn(r"packages:\n(?:  - .+\n)+", "packages:\n  - app\n", text, count=1)
    if n != 1: die("cannot derive app-only workspace")
    ws.write_text(text)
    digest = hashlib.sha256(json.dumps(before, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    (dest / ".source-manifest.json").write_text(json.dumps({"digest": digest, "files": before}, sort_keys=True) + "\n")
    print(digest)

def main():
    cmd = sys.argv[1]
    if cmd == "init-lock":
        fd = open_lock(sys.argv[2], True, sys.argv[3] == "production"); os.close(fd)
    elif cmd == "with-lock":
        path, marker = sys.argv[2], sys.argv.index("--")
        fd = open_lock(path); fcntl.flock(fd, fcntl.LOCK_EX); os.dup2(fd, 9, inheritable=True)
        os.environ["LPS_LOCK_PATH"] = path; os.environ["LPS_PIPELINE_INNER"] = "1"
        os.execvp(sys.argv[marker + 1], sys.argv[marker + 1:])
    elif cmd == "verify-lock": verify_lock(sys.argv[2], int(sys.argv[3]))
    elif cmd == "init-dir":
        p = Path(sys.argv[2])
        try: os.mkdir(p, int(sys.argv[3], 8))
        except FileExistsError: pass
        st = os.lstat(p)
        if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): die("unsafe pipeline directory")
    elif cmd == "reserve-dir":
        parent = Path(sys.argv[2]); st = os.lstat(parent)
        if not stat.S_ISDIR(st.st_mode) or stat.S_ISLNK(st.st_mode): die("unsafe reservation parent")
        print(tempfile.mkdtemp(prefix=sys.argv[3], dir=parent))
    elif cmd == "snapshot": snapshot(sys.argv[2], sys.argv[3])
    elif cmd == "write-json":
        p = Path(sys.argv[2]); data = sys.stdin.buffer.read(); json.loads(data)
        fd, tmp = tempfile.mkstemp(prefix=f".{p.name}.", dir=p.parent)
        try:
            os.fchmod(fd, int(sys.argv[3], 8) if len(sys.argv) > 3 else 0o600)
            os.write(fd, data); os.fsync(fd); os.close(fd); os.replace(tmp, p)
            dfd = os.open(p.parent, os.O_RDONLY | os.O_DIRECTORY); os.fsync(dfd); os.close(dfd)
        finally:
            try: os.close(fd)
            except OSError: pass
            try: os.unlink(tmp)
            except FileNotFoundError: pass
    elif cmd == "atomic-symlink":
        target, p = sys.argv[2], Path(sys.argv[3]); tmp = p.parent / ("." + p.name + "." + next(tempfile._get_candidate_names()))
        os.symlink(target, tmp); os.replace(tmp, p); dfd = os.open(p.parent, os.O_RDONLY | os.O_DIRECTORY); os.fsync(dfd); os.close(dfd)
    elif cmd == "durable-unlink":
        p = Path(sys.argv[2]);
        try: os.unlink(p)
        except FileNotFoundError: pass
        dfd = os.open(p.parent, os.O_RDONLY | os.O_DIRECTORY); os.fsync(dfd); os.close(dfd)
    elif cmd == "json-get": print(json.load(open(sys.argv[2]))[sys.argv[3]])
    elif cmd == "validate-metadata":
        p, repo, name = Path(sys.argv[2]), str(Path(sys.argv[3]).resolve()), sys.argv[4]
        st, pst = os.lstat(p), os.lstat(p.parent)
        if stat.S_ISLNK(st.st_mode) or not stat.S_ISREG(st.st_mode): die("metadata must be a regular no-symlink file")
        data = json.load(open(p))
        required = {"version", "installed", "appName", "repoRoot", "lockPath", "runtimeRoot", "unit", "buildUser"}
        if set(data) != required or data["version"] != 1 or data["installed"] is not True: die("invalid installed metadata schema")
        if st.st_uid != 0 or pst.st_uid != 0 or stat.S_IMODE(st.st_mode) & 0o022: die("installed metadata ownership/mode invalid")
        if data["appName"] != name or data["repoRoot"] != repo: die("installed metadata namespace/repo mismatch")
        if data["lockPath"] != f"/run/lock/{name}-app-build.lock" or data["runtimeRoot"] != f"/var/lib/{name}-app-runtime" or data["unit"] != f"{name}-app.service": die("installed metadata path mismatch")
        if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]*", data["buildUser"]): die("invalid build user")
        pwd.getpwnam(data["buildUser"])
        print(data["lockPath"])
    elif cmd == "verify-release-links":
        root = Path(sys.argv[2]).resolve()
        for p in root.rglob("*"):
            if p.is_symlink() and not str(p.resolve()).startswith(str(root) + os.sep): die(f"external runtime symlink: {p}")
    elif cmd == "verify-source":
        manifest = json.loads(Path(sys.argv[3]).read_text())
        if fingerprint(sys.argv[2]) != manifest["files"]: die("live build inputs changed after snapshot")
        print(manifest["digest"])
    elif cmd == "exec-as":
        user, marker = sys.argv[2], sys.argv.index("--"); pw = pwd.getpwnam(user)
        if os.geteuid() == 0:
            os.setgroups([]); os.setgid(pw.pw_gid); os.setuid(pw.pw_uid)
        elif os.geteuid() != pw.pw_uid: die("cannot change build user")
        os.set_inheritable(9, True); os.execvp(sys.argv[marker + 1], sys.argv[marker + 1:])
    else: die("unknown command")
if __name__ == "__main__": main()
