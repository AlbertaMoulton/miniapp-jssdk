# MiniApp JSSDK

Client SDK and WebView runtime bridging TeamGaga MiniApps with native Flutter host containers.

## Language

**Test Console**:
A standalone web testbed loaded in the host container WebView to exercise MiniApp JSSDK APIs on real devices.
_Avoid_: Demo page, playground, mock runner

**Injected Runtime**:
The native host JavaScript runtime mounted at `window.tgg` inside the WebView container.
_Avoid_: Mock runtime, browser shim

**Pages Deployment**:
An automated GitHub Actions workflow publishing the bundled Test Console directly to GitHub Pages.
_Avoid_: gh-pages branch sync
