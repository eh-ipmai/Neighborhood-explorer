# Antigravity CLI (`agy`) Setup for GitHub Codespaces

This guide covers how to install and run the **Google Antigravity CLI (`agy`)** quickly—or automatically—whenever you spin up a new GitHub Codespace for **Neighborhood Explorer**.

---

## Automatic Install in New Codespaces (Already Enabled)

This repository's [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) is already configured to install `agy` automatically whenever a new Codespace is created (in parallel with `npm install`) and to add `/home/node/.local/bin` to your `PATH`:

```json
  "postCreateCommand": {
    "npm": "npm install",
    "agy": "[ -x \"$HOME/.local/bin/agy\" ] || command -v agy >/dev/null 2>&1 || curl -fsSL https://antigravity.google/cli/install.sh | bash"
  },
  "remoteEnv": {
    "PATH": "${containerEnv:PATH}:/home/node/.local/bin"
  }
```

- **New Codespaces:** `agy` is installed automatically during container creation.
- **Existing Codespaces:** Either run the 1-command manual install below, or run **Codespaces: Rebuild Container** from the Command Palette.

---

## Option 1: Quick 1-Command Manual Install (or Update)

In any Codespace terminal, run:

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Then reload your shell (or open a new terminal tab) and verify:

```bash
source ~/.bashrc
agy --version
```

> **Note:** The installer downloads a standalone binary to `~/.local/bin/agy` and adds `~/.local/bin` to your shell `PATH`.

---

## Option 2: Auto-Install Across *All* Your Codespaces (Dotfiles)

If you want `agy` automatically installed in every GitHub Codespace you create (across any repository):

1. Create a GitHub repo (for example, `dotfiles`) with an `install.sh` script containing:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   if ! command -v agy >/dev/null 2>&1; then
     curl -fsSL https://antigravity.google/cli/install.sh | bash
   fi
   ```
2. In GitHub **Settings → Codespaces → Dotfiles**, enable **Automatically install dotfiles** and select your `dotfiles` repository.

---

## Launching & Authenticating in Codespaces

From the repository root, start the CLI:

```bash
agy
```

- **First-time sign-in:** Because Codespaces runs in a remote container, `agy` prints a Google sign-in URL in the terminal. Open that link in your browser (iPad Safari or desktop) to sign in and link the session.
- **Keep credentials out of Git:** Authentication tokens and settings live in `~/.gemini/antigravity-cli/` (outside the repo), so nothing personal is committed to Git.
- **Exit `agy`:** Type `/exit` (or press `Ctrl+D` twice).

---

## Local Windows PC Install (Optional)

If you are working locally on Windows instead of Codespaces:

- **PowerShell:**
  ```powershell
  irm https://antigravity.google/cli/install.ps1 | iex
  ```
- **Command Prompt (CMD):**
  ```cmd
  curl -fsSL https://antigravity.google/cli/install.cmd -o install.cmd && install.cmd && del install.cmd
  ```

---

## Troubleshooting

- **`agy: command not found` after installing:** Run `export PATH="$HOME/.local/bin:$PATH"` or open a fresh terminal tab so your updated `~/.bashrc` is loaded.
- **Updating `agy` later:** Re-run the same `curl -fsSL https://antigravity.google/cli/install.sh | bash` command.
- **Official Docs:** [Antigravity Getting Started](https://antigravity.google/docs/getting-started) · [CLI Reference](https://antigravity.google/docs/cli/reference)
