# TeamGaga MiniApp JS SDK

JavaScript SDK for TeamGaga miniapps running inside the TeamGaga App Flutter WebView container.

## Build

```sh
pnpm run build
```

The build emits ES5 IIFE bundles for WebView injection:

- `dist/index.iife.js`
- `dist/index.iife.min.js`
- `dist/index.d.ts`

## Usage

```html
<script src="./dist/index.iife.min.js"></script>
<script>
  TeamGagaMiniApp.getUserId().then(function (userId) {
    console.log(userId);
  });
</script>
```

The Flutter WebView host should expose `tgg.postMessage`.
Each request includes a callback name such as `tgg_cb_1`. Native responses can
be completed by calling that callback on the `tgg` bridge object:

```js
tgg.tgg_cb_1({
  userId: "user-123",
  avatar: "https://example.com/avatar.png",
  username: "alice",
  nickname: "Alice",
});
```

The callback also accepts `{ success: true, data }` and rejects on
`{ success: false, code, message }`. `TeamGagaMiniApp.resolve(id, value)` and
`TeamGagaMiniApp.reject(id, error)` remain available for host integrations that
prefer an explicit SDK namespace.

## Release

Configure npm Trusted Publishing for `@teamgaga/miniapp-jssdk`:

- Publisher: GitHub Actions
- Owner: `AlbertaMoulton`
- Repository: `miniapp-jssdk`
- Workflow filename: `publish.yml`

Then create a release tag from `main`:

```bash
pnpm run release:patch
git push origin main v0.1.6
```

Use `minor` or `major` when needed. The release script updates `package.json`, runs checks, tests, build, and `pnpm pack --dry-run`, then commits the version bump and creates the tag. GitHub Actions publishes tagged releases to npm.
