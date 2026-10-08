# Toolforge deployment

The application runs in English and French. It selects the browser language on first visit (English for other languages) and remembers the user's choice. The language switch preserves collected results through the browser checkpoint. Source titles and excerpts are not translated. Detailed audit documentation is currently in French.

## Build and run

Use the Toolforge Build Service, following the [official Node.js static-site guide](https://wikitech.wikimedia.org/wiki/Help:Toolforge/Building_container_images/My_first_static_tool_using_Node.js).

The repository includes a `Procfile`, a build script and a small Node.js static server. No API keys, database, Vercel account or runtime packages are required. The server reads `PORT`, listens on all interfaces and serves only `dist/`. Security headers are included independently of Vercel.

Publish this code to the tool's GitLab repository before building. An empty repository cannot be deployed.

In an authenticated Toolforge terminal:

```sh
become commons-collection
toolforge build start https://gitlab.wikimedia.org/toolforge-repos/commons-collection.git
```

Wait for a successful build, then:

```sh
toolforge webservice buildservice start --mount=none
```

Check the service at `https://commons-collection.toolforge.org/` in both languages. Test a search, pause/resume, file usage and CSV export. Do not delete another deployment until these checks pass.

## Updates

Keep GitHub and GitLab on the same commits. After pushing an update to GitLab, start a new build and, once successful, restart the webservice:

```sh
toolforge build start https://gitlab.wikimedia.org/toolforge-repos/commons-collection.git
toolforge webservice buildservice restart --mount=none
```

These are manual deployments. No automatic GitHub-to-Toolforge deployment is configured by this repository.

## Local verification

```sh
npm ci
npm test
npm run build
npm start
```

Open `http://localhost:8000/`. Production serves the generated public files only. The local development server is not the production entrypoint.
