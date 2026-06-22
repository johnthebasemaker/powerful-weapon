# GitHub Actions setup — build .dmg + .exe automatically

When this is set up, every time you push to GitHub, fresh installers for **macOS** and **Windows** get built automatically (~15–20 minutes). You download them from the Actions tab. No need to own a Windows machine.

Cost: **free** (2,000 build-minutes/month for private repos, unlimited for public — you'll use ~30 mins per build).

---

## One-time setup

### 1. Create a GitHub repo

If you don't have a GitHub account, sign up at <https://github.com/signup> (free).

Then go to <https://github.com/new> and:
- **Repository name:** `powerful-weapon` (or anything you like)
- **Public** or **Private** — your choice. Private is free; the workflow works either way.
- **Don't** check "Add a README" or any other initialization options.
- Click **Create repository**.

GitHub will show you a screen with commands like *"…or push an existing repository from the command line"*. Keep that tab open — you'll use those commands in step 3.

### 2. Initialize git in the project folder

In Terminal:

```bash
cd "/Users/johnsonandrew/Downloads/Bibld Verse Tamil Project"
git init
git add .
git commit -m "Initial commit"
```

You may see a warning about large files (`ggml-large-v3.bin`, `tamil-ov-source.json`). That's fine — your `.gitignore` already excludes the model and the build outputs. But double-check by running `git status` after the `git add` — if you see `ggml-large-v3.bin` listed, **stop** and let me know. We do NOT want to push the 2.9 GB model to GitHub (the workflow downloads it fresh on every build instead).

### 3. Push to GitHub

Copy the two commands GitHub showed you in step 1. They look like:

```bash
git remote add origin https://github.com/YOUR_USERNAME/powerful-weapon.git
git branch -M main
git push -u origin main
```

Run them. Enter your GitHub username + a Personal Access Token (not your password) when prompted. ([How to create a PAT](https://github.com/settings/tokens?type=beta) — give it `repo` scope.)

### 4. Watch the build

1. Go to your repo on GitHub.
2. Click the **Actions** tab.
3. You'll see "Build installers" — click it.
4. You'll see the most recent run with a yellow dot (running) or green check (success).
5. Click into the run to watch progress live.

The first run takes ~20–25 minutes because the Whisper model (2.9 GB) is downloaded fresh on each runner. **Subsequent runs are faster** (~10 minutes) thanks to the cache step.

### 5. Download the installers

Once both jobs show a green check:

1. Scroll to the bottom of the run page.
2. Under **Artifacts**, you'll see:
   - `Powerful-Weapon-macOS` (~3 GB — contains the `.dmg`)
   - `Powerful-Weapon-Windows` (~3 GB — contains the `.exe`)
3. Click each to download a `.zip`. Unzip to get the installer.

That's the file you send to your friend.

---

## Releases (optional but nice)

If you want a stable download URL (instead of digging through the Actions tab each time), use tags:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This triggers the same build PLUS a `release` job that publishes a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases) with both installers attached. Anyone with the link can download — no GitHub login required.

Future versions: bump the version in `package.json`, repeat the tag step (`v0.2.0`, `v0.3.0`, …).

---

## Triggering a build manually

You can also kick off a build without pushing code:

1. Go to **Actions** → **Build installers**.
2. Click **"Run workflow"** dropdown on the right → **"Run workflow"** button.

Useful when nothing's changed but you want a fresh build (e.g. you just updated the Whisper model URL).

---

## Things to know

- **First build is slow** (~25 min) because of the 2.9 GB Whisper model download. Subsequent builds use GitHub's cache and are 10× faster.
- **Whisper model is NOT committed** to your repo. It lives only in the GitHub cache + inside the built artifacts. Your repo stays small (~50 MB).
- **`bible.json`** (the Tamil OV source) is downloaded fresh each build from the godlytalias GitHub repo — not committed.
- **Icon:** if you've placed `icon.png` in `resources/icons/`, it'll be included. Otherwise default Electron icon. You can drop the icon, commit, push — next build uses it.
- **Code signing:** the macOS .dmg is unsigned (your friend will need to do the "Open anyway" step in Privacy & Security on first launch). Windows is also unsigned (SmartScreen warning the first time). For a fully-signed build you'd need an Apple Developer ID ($99/yr) and a Windows code-signing cert ($200+/yr). Skip for personal/gift use.

---

## Troubleshooting

**The build fails on `npm install` with "Electron failed to install"**
GitHub's runners sometimes have flaky network. Re-run the workflow — usually succeeds the second time.

**Windows build fails on `electron-builder` step**
Check the log for missing dependencies. The most common cause is the Whisper Windows binary download — check that step's log for the file list.

**Mac build fails on `cmake --build` (Whisper compile)**
Update to the latest `whisper.cpp` master — sometimes their build flags change. Edit `.github/workflows/build.yml` and remove `--depth 1` so the full history is cloned, or pin to a specific commit.

**The artifact .zip is empty / 0 bytes**
The job hit a timeout or ran out of disk space. The workflow has a 60-minute timeout — if the model cache is cold AND your runner is slow, this can happen. Re-run; the cache will be warm.
