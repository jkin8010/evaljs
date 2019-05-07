import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import { uglify } from 'rollup-plugin-uglify'
import pkg from './package.json'

const env = process.env.NODE_ENV || 'production'
const dependencies = pkg.dependencies
const depExternal = Object.keys(dependencies)

const plugins = [
  resolve({
    customResolveOptions: {
      moduleDirectory: 'node_modules'
    }
  }),
  commonjs({
    include: 'node_modules/**'
  }),
  babel({
    runtimeHelpers: true
  })
]
if (env === 'production') {
  plugins.push(uglify())
}

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/evaljs.js',
      format: 'cjs'
    }
  ],
  external: [
    ...depExternal
  ],
  plugins
}
