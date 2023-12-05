import commonjs from 'rollup-plugin-commonjs'; // Convert CommonJS modules to ES6
import { nodeResolve } from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import gzipPlugin from 'rollup-plugin-gzip';

export default [ 'vue-sso' ].map((name) => ({
  input: `${name}.js`,
  output: [
    {
      format: 'umd',
      name,
      file: `dist/${name}.umd.js`,
    },
    {
      format: 'es',
      name,
      exports: 'named',
      file: `dist/${name}.esm.js`,
    }, {
      format: 'iife',
      name,
      extend: true,
      exports: 'named',
      file: `dist/${name}.min.js`,
    }
  ],
  plugins: [
    nodeResolve(),
    commonjs(),
    babel({
      presets: [
        ['@babel/preset-env'],
      ],
      babelHelpers: 'bundled',
      include: '**/*.js', // Replace '**/node_modules/**' with '**/*.js'
    }),
    terser(),
    gzipPlugin(),
  ],
}));