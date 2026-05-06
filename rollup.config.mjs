import babel from "@rollup/plugin-babel";
import typescript from "@rollup/plugin-typescript";

const extensions = [".ts"];

const createBasePlugins = () => [
  typescript({
    compilerOptions: {
      declaration: false,
      declarationMap: false,
    },
  }),
  babel({
    babelHelpers: "bundled",
    extensions,
    exclude: "node_modules/**",
    presets: [
      [
        "@babel/preset-env",
        {
          bugfixes: true,
          modules: false,
          targets: {
            ie: "11",
          },
        },
      ],
    ],
  }),
];

export default [
  {
    input: "src/index.ts",
    output: [
      {
        file: "dist/index.esm.js",
        format: "esm",
        sourcemap: true,
      },
      {
        file: "dist/index.iife.js",
        format: "iife",
        name: "TeamGagaMiniApp",
        exports: "named",
        sourcemap: true,
      },
    ],
    plugins: createBasePlugins(),
  },
  {
    input: "src/core.ts",
    output: [
      {
        file: "dist/core.esm.js",
        format: "esm",
        sourcemap: true,
      },
      {
        file: "dist/core.js",
        format: "iife",
        name: "TeamGagaMiniAppCore",
        exports: "named",
        sourcemap: true,
      },
    ],
    plugins: createBasePlugins(),
  },
];
