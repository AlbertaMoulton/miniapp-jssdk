# Dual-Build Pipeline and Artifact-Based Pages Deployment

We decided to use Vite (`vp build`) targeting `dist-pages/` with base path `/miniapp-jssdk/` for the Test Console single-page app, while keeping Rollup for the `@teamgaga/miniapp-jssdk` npm library in `dist/`. The Test Console is deployed to GitHub Pages via official GitHub Actions artifacts (`upload-pages-artifact` and `deploy-pages`) triggered on pushes to `main` and manual dispatch, avoiding git branch pollution and separating testbed deployment from npm release.
