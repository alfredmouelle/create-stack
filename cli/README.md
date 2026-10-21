<h1 align="center">create-stack</h1>

<p align="center">
  Pick a framework and the pieces your app needs. create-stack assembles them from a
  tested reference application.
  <br>
  <sub>Supports <strong>Next.js App Router</strong> and <strong>TanStack Start</strong>.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/dw/@alfredmouelle/create-stack?color=cb3837" alt="npm downloads"></a>
  <img src="https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue" alt="license">
  <img src="https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white" alt="node">
  <a href="https://create-stack.alfredmouelle.com"><img src="https://img.shields.io/badge/website-create--stack.alfredmouelle.com-d94f38" alt="website"></a>
</p>

<p align="center">
  <strong><a href="https://create-stack.alfredmouelle.com">Website and interactive stack builder</a></strong>
</p>

<p align="center">
  <!-- served from the npm tarball via jsDelivr so it renders identically on npm and GitHub; record with: vhs docs/demo.tape -->
  <img src="https://cdn.jsdelivr.net/npm/@alfredmouelle/create-stack/docs/demo.gif" alt="create-stack generating a project and changing an adapter" width="640">
</p>

---

Choose a framework, then select a database, tRPC, auth, mailer, formatter, linter, and
optional capabilities. create-stack copies the matching parts of the framework's reference
application, writes the project identity and `.env`, applies the strict quality profile,
installs dependencies, and runs the selected formatter, typecheck, and linter. With Git
enabled, it creates the initial commit after those checks pass.

> **Open source (MIT).** The source and issue tracker are on
> [github.com/alfredmouelle/create-stack](https://github.com/alfredmouelle/create-stack).

## Quick start

```bash
pnpm dlx @alfredmouelle/create-stack@latest my-app
# or the create-* convention (npm / yarn create also work):
pnpm create @alfredmouelle/stack@latest my-app
```

With no flags, the CLI runs **interactive creation**. Any selection flag switches to
**non-interactive** mode for CI and scripts.

Requires **Node ≥ 24.19.0**, a package manager (**pnpm** / npm / yarn / bun), and **git** on
`PATH`. The CLI detects the package manager used to run it and uses the same one in the
generated project.

## Commands

```
create-stack [project] [flags]                    # scaffold a new project
create-stack add [kind] [provider]                # add one capability or component
create-stack add --with kind[=provider] [...]     # add a validated batch
```

`create-stack add` grows an existing project with capabilities such as storage, cache, jobs,
and analytics, or with UI components such as a date picker, a data table, and callable
dialogs. `<command> --help` lists every flag.

## Learn more

- [Docs](https://create-stack.alfredmouelle.com/docs): every flag, `create-stack add`, components, and callable dialogs.
- [Stack builder](https://create-stack.alfredmouelle.com/build): pick your options and copy the matching command.
- [Frameworks](https://create-stack.alfredmouelle.com/frameworks): what each framework supports.

## Credits

Inspired by [create-t3-app](https://create.t3.gg) and the work of [Theo Browne](https://github.com/t3dotgg). Not affiliated with or endorsed by the T3 project.

## Author

[Alfred MOUELLE](https://alfredmouelle.com), full-stack developer.
