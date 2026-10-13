# Breachboard start

This repo is the operator pack for [Breachboard](https://github.com/iammainul/breachboard): how to run a tabletop, and a script that starts the stack. The application source stays in that private repository. `./start.sh` clones it into `app/` (gitignored) and brings it up with Docker Compose.

The walkthrough is [docs/guide/README.md](docs/guide/README.md). Screenshot rules are [docs/guide/IMAGE-GUIDELINES.md](docs/guide/IMAGE-GUIDELINES.md). A local stack listens on <http://localhost:3080>.

## Before you start

You need Docker Engine with Compose v2, plus `git`, `curl`, and `openssl`.

The application repository is private. `git clone https://github.com/iammainul/breachboard.git` has to work from this machine before `./start.sh` will. GitHub CLI, SSH, or a credential helper is fine. An anonymous clone is not.

## Start the stack

```bash
./start.sh
```

That clones `master` into `app/` if the checkout is missing, copies `.env.example` to `app/.env`, and fills `AUTH_SECRET` when it is still the placeholder. It then builds the image and starts Postgres and the app, and waits until <http://localhost:3080> answers.

On a first local run, `ALLOW_DEV_DEFAULTS` and `SEED_DEMO` stay on unless `app/.env` turns them off. Sign in with `OPERATOR_EMAIL` and `OPERATOR_PASSWORD` from that file. A fresh local stack uses `operator@local` / `change-me`. The demo room join code is **DEMO01**.

```bash
./start.sh --rebuild   # rebuild the image without cache
./start.sh --logs      # follow app logs
./start.sh --stop      # stop containers; keep the database and media volumes
```

| Variable | Default | Use |
|----------|---------|-----|
| `BREACHBOARD_REPO` | `https://github.com/iammainul/breachboard.git` | Clone URL |
| `BREACHBOARD_REF` | `master` | Branch or tag |
| `BREACHBOARD_DIR` | `./app` | Checkout path |
| `BREACHBOARD_URL` | `http://localhost:3080` | URL the script waits for |

## A machine other people can reach

Edit `app/.env` before you put this on a host that is not just your laptop.

- Set `ALLOW_DEV_DEFAULTS=false` and `SEED_DEMO=false`.
- Replace `OPERATOR_PASSWORD`. With dev defaults off, boot refuses `change-me`.
- Set `AUTH_URL` to the public `https://` origin. Terminate TLS on a reverse proxy in front of port 3080.
- Change the Compose Postgres password, and do not publish `5433` on a public interface. Both live in the application `docker-compose.yml`.
- Back up the Postgres volume and the `ttx_media` volume. Plans and answers sit on that disk.

AI keys can wait. Add them later in the app under `/settings/ai`.
