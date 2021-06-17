import commonjs from 'rollup-plugin-commonjs'; // Convert CommonJS modules to ES6
import babel from '@rollup/plugin-babel';

export default [ 'vue-sso' ].map((name) => ({
  input: `${name}.js`,
  output: [{
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
  },
  ],
  plugins: [
    commonjs(),
    babel({
      exclude: '**/node_modules/**',
      babelHelpers: 'runtime',
    }),
  ],
}));