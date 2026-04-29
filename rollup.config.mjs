import babel from "@rollup/plugin-babel";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const extensions = [".ts"];

const basePlugins = [
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
    output: {
      file: "dist/index.esm.js",
      format: "esm",
      sourcemap: true,
    },
    plugins: basePlugins,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.iife.js",
      format: "iife",
      name: "TeamGagaMiniApp",
      exports: "named",
      sourcemap: true,
    },
    plugins: basePlugins,
  },
  {
    input: "src/index.ts",
    output: {
      file: "dist/index.iife.min.js",
      format: "iife",
      name: "TeamGagaMiniApp",
      exports: "named",
      sourcemap: true,
    },
    plugins: [
      ...basePlugins,
      terser({
        compress: true,
        ecma: 5,
        format: {
          comments: false,
        },
        mangle: true,
      }),
    ],
  },
];
