import { rollup } from "rollup";

import configs from "../rollup.config.mjs";

try {
  for (const config of configs) {
    const { output, ...inputOptions } = config;
    const outputs = Array.isArray(output) ? output : [output];
    const bundle = await rollup(inputOptions);

    try {
      for (const outputOptions of outputs) {
        await bundle.write(outputOptions);
      }
    } finally {
      await bundle.close();
    }
  }

  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
