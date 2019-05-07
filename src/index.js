import { parse } from 'acorn'
import EventEmitter from 'events'

const noop = () => {}

function isTypeOf (obj, type) {
  return Object.prototype.toString.call(obj) === `[object ${type}]`
}

function execute (func, args = []) {
  let result = func(...args)

  if ('' + result === 'null') {
    return result
  }
  // FIXME: Convert to yield*
  if (result !== undefined) {
    if (result.next) {
      let iter = result
      let res = iter.next()
      while (!res.done) {
        res = iter.next()
      }
      if ('' + res.value === 'null') {
        return res.value
      }
      if ('' + res.value === 'undefined') {
        return res.value
      }
      return res.value
    }
  }
  return result
}

class Return {
  constructor (val) {
    this.value = val
  }
}

// TODO: add es3 'arguments.callee'?
class Arguments {
  toString () {
    return '[object Arguments]'
  }
}

// need something unique to compare a against.
const Break = {}
const Continue = {}

function createVarStore (parent, vars) {
  vars = vars || {}
  return {
    parent: parent,
    vars: vars
  }
}

function addDeclarationsToStore (declarations, varStore) {
  for (let key in declarations) {
    if (declarations.hasOwnProperty(key) && !varStore.vars.hasOwnProperty(key)) {
      varStore.vars[key] = declarations[key]()
    }
  }
}

export class Environment extends EventEmitter {
  constructor (globalObjects) {
    super()
    if (!Array.isArray(globalObjects)) {
      globalObjects = [globalObjects]
    }
    let parent
    globalObjects.forEach((vars) => {
      parent = createVarStore(parent, vars)
    })
    // the topmost store is our current store
    this._curVarStore = parent
    this._curDeclarations = {}
    this._globalObj = globalObjects[0]
    this._curThis = this._globalObj
    this._boundGen = this._gen.bind(this)
    this.DEBUG = false
    this.DELAY = 0
    this.STATE = 'running'
  }

  gen (node) {
    const opts = {
      locations: true,
      ecmaVersion: 5
    }
    if (typeof node === 'string') {
      node = parse(node, opts)
    }

    const resp = this._gen(node)
    addDeclarationsToStore(this._curDeclarations, this._curVarStore)
    this._curDeclarations = {}
    return resp
  }

  _gen (node) {
    const closure = ({
      BinaryExpression: this._genBinExpr,
      LogicalExpression: this._genBinExpr,
      UnaryExpression: this._genUnaryExpr,
      UpdateExpression: this._genUpdExpr,
      ObjectExpression: this._genObjExpr,
      ArrayExpression: this._genArrExpr,
      CallExpression: this._genCallExpr,
      NewExpression: this._genNewExpr,
      MemberExpression: this._genMemExpr,
      ThisExpression: this._genThisExpr,
      SequenceExpression: this._genSeqExpr,
      Literal: this._genLit,
      Identifier: this._genIdent,
      AssignmentExpression: this._genAssignExpr,
      FunctionDeclaration: this._genFuncDecl,
      VariableDeclaration: this._genVarDecl,
      BlockStatement: this._genProgram,
      Program: this._genProgram,
      ExpressionStatement: this._genExprStmt,
      EmptyStatement: this._genEmptyStmt,
      ReturnStatement: this._genRetStmt,
      FunctionExpression: this._genFuncExpr,
      IfStatement: this._genIfStmt,
      ConditionalExpression: this._genCondStmt,
      ForStatement: this._genLoopStmt,
      WhileStatement: this._genLoopStmt,
      DoWhileStatement: this._genDoWhileStmt,
      ForInStatement: this._genForInStmt,
      WithStatement: this._genWithStmt,
      ThrowStatement: this._genThrowStmt,
      TryStatement: this._genTryStmt,
      ContinueStatement: this._genContStmt,
      BreakStatement: this._genBreakStmt,
      SwitchStatement: this._genSwitchStmt
    }[node.type] || function () {
      console.warn(`Not implemented yet: ${node.type}`)
      return noop
    }).call(this, node)

    if (this.DEBUG) {
      return () => {
        let info = `closure for ${node.type} called`
        let line = ((node.loc || {}).start || {}).line
        if (line) {
          info += ` while processing line ${line}`
        }
        const resp = closure()
        info += '. Result:'
        console.log(info, resp)
        return resp
      }
    }
    return closure
  }

  _genBinExpr = function (node) {
    let a = this._gen(node.left)
    let b = this._gen(node.right)

    function * callExpr (expr) {
      let result
      result = expr()

      if (typeof result.next === 'function') {
        yield * result
      }

      return result
    }

    const cmp = {
      '==': function * () {
        // eslint-disable-next-line
        return (yield * callExpr(a)) == (yield * callExpr(b))
      },
      '!=': function * () {
        // eslint-disable-next-line
        return (yield * callExpr(a)) != (yield * callExpr(b))
      },
      '===': function * () {
        return (yield * callExpr(a)) === (yield * callExpr(b))
      },
      '!==': function * () {
        return (yield * callExpr(a)) !== (yield * callExpr(b))
      },
      '<': function * () {
        return (yield * callExpr(a)) < (yield * callExpr(b))
      },
      '<=': function * () {
        return (yield * callExpr(a)) <= (yield * callExpr(b))
      },
      '>': function * () {
        return (yield * callExpr(a)) > (yield * callExpr(b))
      },
      '>=': function * () {
        return (yield * callExpr(a)) >= (yield * callExpr(b))
      },
      '<<': function * () {
        return (yield * callExpr(a)) << (yield * callExpr(b))
      },
      '>>': function * () {
        return (yield * callExpr(a)) >> (yield * callExpr(b))
      },
      '>>>': function * () {
        return (yield * callExpr(a)) >>> (yield * callExpr(b))
      },
      '+': function * () {
        return (yield * callExpr(a)) + (yield * callExpr(b))
      },
      '-': function * () {
        return (yield * callExpr(a)) - (yield * callExpr(b))
      },
      '*': function * () {
        return (yield * callExpr(a)) * (yield * callExpr(b))
      },
      '/': function * () {
        return (yield * callExpr(a)) / (yield * callExpr(b))
      },
      '%': function * () {
        return (yield * callExpr(a)) % (yield * callExpr(b))
      },
      '|': function * () {
        return (yield * callExpr(a)) | (yield * callExpr(b))
      },
      '^': function * () {
        return (yield * callExpr(a)) ^ (yield * callExpr(b))
      },
      '&': function * () {
        return (yield * callExpr(a)) & (yield * callExpr(b))
      },
      'in': function * () {
        return (yield * callExpr(a)) in (yield * callExpr(b))
      },
      'instanceof': function * () {
        return (yield * callExpr(a)) instanceof (yield * callExpr(b))
      },
      // logic expressions
      '||': function * () {
        return (yield * callExpr(a)) || (yield * callExpr(b))
      },
      '&&': function * () {
        return (yield * callExpr(a)) && (yield * callExpr(b))
      }
    }[node.operator]

    return function () {
      // FIXME: Convert to yield*
      const iter = cmp()
      let res = iter.next()
      while (!res.done) {
        res = iter.next()
      }
      return res.value
    }
  }

  _genUnaryExpr (node) {
    if (node.operator === 'delete') {
      return this._genDelete(node)
    }
    let a = this._gen(node.argument)
    let op = {
      '-': function () {
        return -a()
      },
      '+': function () {
        return +a()
      },
      '!': function () {
        return !a()
      },
      '~': function () {
        return ~a()
      },
      'typeof': function () {
        return typeof a()
      },
      'void': function () {
        return void a()
      }
    }[node.operator]

    return function () {
      return op()
    }
  }

  _genDelete (node) {
    const obj = this._genObj(node.argument)
    const attr = this._genName(node.argument)

    return function () {
      return delete obj()[attr()]
    }
  }

  _genObjExpr (node) {
    // TODO property.kind: don't assume init when it can also be set/get
    const items = []
    node.properties.forEach((property) => {
      // object expression keys are static so can be calculated
      // immediately
      const key = this._objKey(property.key)()
      items.push({
        key: key,
        getVal: this._gen(property.value)
      })
    })

    return function () {
      const result = {}
      items.forEach((item) => {
        result[item.key] = item.getVal()
      })
      return result
    }
  }

  _genArrExpr (node) {
    let items = node.elements.map(this._boundGen)

    return function () {
      return items.map(execute)
    }
  }

  _objKey (node) {
    let key
    if (node.type === 'Identifier') {
      key = node.name
    } else {
      key = this._gen(node)()
    }

    return function () {
      return key
    }
  }

  _genCallExpr (node) {
    let callee
    const args = node.arguments.map(this._boundGen)

    if (node.callee.type === 'MemberExpression') {
      const obj = this._genObj(node.callee)
      const name = this._genName(node.callee)
      const methodName = name()

      callee = function () {
        const theObj = execute(obj)

        if (isTypeOf(theObj, 'Promise')) {
          return (...params) => {
            if (methodName === 'catch') {
              return theObj.catch(error => {
                const func = params[0]

                if (typeof func === 'function') {
                  return execute(func, [ error ])
                }
                return Promise.reject(error)
              })
            } else {
              return theObj.then(res => {
                const func = params[0]

                if (typeof func === 'function') {
                  return execute(func, [ res ])
                }
                return Promise.resolve(res)
              }, error => {
                const func = params[1]

                if (typeof func === 'function') {
                  return execute(func, [ error ])
                }
                return Promise.reject(error)
              })
            }
          }
        }

        return theObj[methodName].bind(theObj)
      }
    } else {
      callee = this._gen(node.callee)
    }

    const self = this
    return function * () {
      self.emit('line', node.loc.start.line)

      const c = callee()

      if (c === undefined) {
        return c
      }

      let result
      let res
      let newArgs = args.map(execute)

      if (c.next) {
        res = yield * c
        result = res.apply(self._globalObj, newArgs)
      } else {
        result = c.apply(self._globalObj, newArgs)
      }

      if (result !== undefined) {
        if (result.next) {
          res = yield * result
          return res
        }
      }

      return result
    }
  }

  _genNewExpr (node) {
    let callee = this._gen(node.callee)
    let args = node.arguments.map(this._boundGen)
    let self = this

    return function * () {
      self.emit('line', node.loc.start.line)
      const cl = callee()
      const ar = args.map(execute)

      if (!cl) {
        return null
      }

      if (globalClass.hasOwnProperty(cl.name) >= 0) {
        // eslint-disable-next-line
        const newObject = new cl(...ar)
        return newObject
      }

      const newObject = Object.create(cl.prototype)
      const constructor = cl.apply(newObject, ar)
      yield * constructor
      return newObject
    }
  }

  _genMemExpr (node) {
    let obj = this._gen(node.object)
    let property = this._memExprProperty(node)

    return () => {
      this.emit('line', node.loc.start.line)
      return obj()[property()]
    }
  }

  _memExprProperty (node) {
    return node.computed ? this._gen(node.property) : this._objKey(node.property)
  }

  _genThisExpr () {
    return () => {
      return this._curThis
    }
  }

  _genSeqExpr (node) {
    const exprs = node.expressions.map(this._boundGen)
    return function () {
      let result
      exprs.forEach(function (expr) {
        result = expr()
      })
      return result
    }
  }

  _genUpdExpr (node) {
    const self = this
    const update = {
      '--true': function (obj, name) {
        return --obj[name]
      },
      '--false': function (obj, name) {
        return obj[name]--
      },
      '++true': function (obj, name) {
        return ++obj[name]
      },
      '++false': function (obj, name) {
        return obj[name]++
      }
    }[node.operator + node.prefix]
    const obj = this._genObj(node.argument)
    const name = this._genName(node.argument)
    return function * () {
      self.emit('line', node.loc.start.line)
      yield
      return update(obj(), name())
    }
  }

  _genObj (node) {
    if (node.type === 'Identifier') {
      return this._getVarStore.bind(this, node.name)
    } else if (node.type === 'MemberExpression') {
      return this._gen(node.object)
    } else {
      console.warn('Unknown _genObj() type: ' + node.type)
      return noop
    }
  }

  _genName (node) {
    if (node.type === 'Identifier') {
      return () => node.name
    } else if (node.type === 'MemberExpression') {
      return this._memExprProperty(node)
    } else {
      console.warn('Unknown _genName() type: ' + node.type)
      return noop
    }
  }

  _genLit (node) {
    return () => node.value
  }

  _genIdent (node) {
    return () => this._getVarStore(node.name)[node.name]
  }

  _getVarStore (name) {
    let store = this._curVarStore
    do {
      if (store.vars.hasOwnProperty(name)) {
        return store.vars
      }
    } while ((store = store.parent))

    // global object as fallback
    return this._globalObj
  }

  _genAssignExpr (node) {
    const self = this
    const setter = {
      '=': (obj, name, val) => (obj[name] = val),
      '+=': (obj, name, val) => (obj[name] += val),
      '-=': (obj, name, val) => (obj[name] -= val),
      '*=': (obj, name, val) => (obj[name] *= val),
      '/=': (obj, name, val) => (obj[name] /= val),
      '%=': (obj, name, val) => (obj[name] %= val),
      '<<=': (obj, name, val) => (obj[name] <<= val),
      '>>=': (obj, name, val) => (obj[name] >>= val),
      '>>>=': (obj, name, val) => (obj[name] >>>= val),
      '|=': (obj, name, val) => (obj[name] |= val),
      '^=': (obj, name, val) => (obj[name] ^= val),
      '&=': (obj, name, val) => (obj[name] &= val)
    }[node.operator]
    const obj = this._genObj(node.left)
    const name = this._genName(node.left)
    const val = this._gen(node.right)
    return function * () {
      self.emit('line', node.left.loc.start.line)
      let v = val()
      if (v !== undefined) {
        if (v.next) {
          v = yield * v
        }
      }
      return setter(obj(), name(), v)
    }
  }

  _genFuncDecl (node) {
    this._curDeclarations[node.id.name] = this._genFuncExpr(node)
    return function * () {
      return noop
    }
  }

  _genVarDecl (node) {
    const assignments = []
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i]
      this._curDeclarations[decl.id.name] = noop
      if (decl.init) {
        assignments.push({
          type: 'AssignmentExpression',
          operator: '=',
          left: decl.id,
          right: decl.init
        })
      }
    }
    return this._gen({
      type: 'BlockStatement',
      body: assignments
    })
  }

  getState () {
    return this.STATE
  }

  setState (state) {
    this.STATE = state
  }

  _genFuncExpr (node) {
    const oldDeclarations = this._curDeclarations
    this._curDeclarations = {}
    const body = this._gen(node.body)
    const declarations = this._curDeclarations
    this._curDeclarations = oldDeclarations

    // reset var store
    return () => {
      const parent = this._curVarStore
      const self = this

      return function * () {
        // build arguments object
        const args = new Arguments()
        args.length = arguments.length
        for (let i = 0; i < arguments.length; i++) {
          args[i] = arguments[i]
        }

        // switch interpreter 'stack'
        const oldStore = self._curVarStore
        const oldThis = self._curThis
        self._curVarStore = createVarStore(parent)
        self._curThis = this

        addDeclarationsToStore(declarations, self._curVarStore)
        self._curVarStore.vars.arguments = args

        // add function args to var store
        node.params.forEach((param, i) => {
          self._curVarStore.vars[param.name] = args[i]
        })

        // run function body
        let result = yield * body()

        // switch 'stack' back
        self._curThis = oldThis
        self._curVarStore = oldStore

        if (isTypeOf(result, 'Promise')) {
          return result
        }

        if (result instanceof Return) {
          return result.value
        }
      }
    }
  }

  _genProgram (node) {
    const stmtClosures = node.body.map((stmt) => this._gen(stmt))

    return function () {
      let result
      for (let i = 0; i < stmtClosures.length; i++) {
        result = stmtClosures[i]()

        if (typeof result.next === 'function') {
          let res
          do {
            res = result.next()
          } while (result.done)
          result = res.value
        }
        if (result === Break || result === Continue || result instanceof Return) {
          break
        }
      }
      // return last
      return result
    }
  }

  _genExprStmt (node) {
    return this._gen(node.expression)
  }

  _genEmptyStmt () {
    return noop
  }

  _genRetStmt (node) {
    const arg = node.argument ? this._gen(node.argument) : noop
    return () => {
      this.emit('line', node.loc.start.line)
      return new Return(arg())
    }
  }

  _genIfStmt (node) {
    const test = () => {
      this.emit('line', node.loc.start.line)
      return this._gen(node.test)()
    }
    const consequent = this._gen(node.consequent)
    const alternate = node.alternate ? this._gen(node.alternate) : function * () {
      return noop
    }

    return function * () {
      const result = test() ? yield * consequent() : yield * alternate()
      return result
    }
  }

  _genCondStmt (node) {
    const test = () => {
      this.emit('line', node.loc.start.line)
      return this._gen(node.test)()
    }
    const consequent = this._gen(node.consequent)
    const alternate = node.alternate ? this._gen(node.alternate) : noop

    return function () {
      return test() ? consequent() : alternate()
    }
  }

  _genLoopStmt (node, body) {
    const self = this
    const init = node.init ? this._gen(node.init) : function * () {
      return noop
    }
    const test = node.test ? function * () {
      self.emit('line', node.loc.start.line)
      return self._gen(node.test)()
    } : function * () {
      return true
    }
    const update = node.update ? this._gen(node.update) : function * () {
      return noop
    }
    body = body || this._gen(node.body)

    return function * () {
      self.emit('line', node.loc.start.line)
      let resp
      for (yield * init(); yield * test(); yield * update()) {
        let newResp = yield * body()

        if (newResp === Break) {
          break
        }
        if (newResp === Continue) {
          continue
        }
        resp = newResp
        if (newResp instanceof Return) {
          break
        }
      }
      return resp
    }
  }

  _genDoWhileStmt (node) {
    const body = this._gen(node.body)
    const loop = this._genLoopStmt(node, body)

    return function * () {
      yield * body()
      yield * loop()
    }
  }

  _genForInStmt (node) {
    const self = this
    const right = this._gen(node.right)
    const body = this._gen(node.body)

    let left = node.left
    if (left.type === 'VariableDeclaration') {
      this._curDeclarations[left.declarations[0].id.name] = noop
      left = left.declarations[0].id
    }
    return function * () {
      self.emit('line', node.loc.start.line)
      let resp
      for (let x in right()) {
        self.emit('line', node.loc.start.line)
        yield * self._genAssignExpr({
          operator: '=',
          left: left,
          right: {
            type: 'Literal',
            value: x
          }
        })()
        resp = yield * body()
      }
      return resp
    }
  }

  _genWithStmt (node) {
    const self = this
    const obj = this._gen(node.object)
    const body = this._gen(node.body)

    return function * () {
      self._curVarStore = createVarStore(self._curVarStore, obj())
      const result = yield * body()
      self._curVarStore = self._curVarStore.parent
      return result
    }
  }

  _genThrowStmt (node) {
    const arg = this._gen(node.argument)
    return function () {
      throw arg()
    }
  }

  _genTryStmt (node) {
    const block = this._gen(node.block)
    const handler = this._genCatchHandler(node.handler)
    const finalizer = node.finalizer ? this._gen(node.finalizer) : function (x) {
      return x
    }

    return () => {
      try {
        return finalizer(block())
      } catch (err) {
        return finalizer(handler(err))
      }
    }
  }

  _genCatchHandler (node) {
    if (!node) {
      return noop
    }
    const body = this._gen(node.body)
    return (err) => {
      const old = this._curVarStore.vars[node.param.name]
      this._curVarStore.vars[node.param.name] = err
      const resp = body()
      this._curVarStore.vars[node.param.name] = old

      return resp
    }
  }

  _genContStmt () {
    return () => Continue
  }

  _genBreakStmt () {
    return () => Break
  }

  _genSwitchStmt (node) {
    const discriminant = this._gen(node.discriminant)
    const cases = node.cases.map((curCase) => ({
      test: curCase.test ? this._gen(curCase.test) : null,
      code: this._genProgram({ body: curCase.consequent })
    }))

    return function * () {
      let foundMatch = false
      let discriminantVal = discriminant()
      let resp
      let defaultCase

      for (let i = 0; i < cases.length; i++) {
        let curCase = cases[i]
        if (!foundMatch) {
          if (!curCase.test) {
            defaultCase = curCase
            continue
          }
          if (discriminantVal !== curCase.test()) {
            continue
          }
          foundMatch = true
        }
        // foundMatch is guaranteed to be true here
        let newResp = yield * curCase.code()
        if (newResp === Break) {
          return resp
        }
        resp = newResp
        if (resp === Continue || resp instanceof Return) {
          return resp
        }
      }
      if (!foundMatch && defaultCase) {
        return yield * defaultCase.code()
      }
    }
  }
}

const globalClass = {
  Number,
  String,
  Boolean,
  Object,
  Promise,
  Array,
  ArrayBuffer,
  Float32Array,
  Float64Array,
  Int8Array,
  Int16Array,
  Int32Array,
  Error,
  Set,
  Map,
  RegExp,
  Date,
  DataView,
  Proxy,
  Symbol
}
const globalEnv = {
  ...globalClass,
  NaN,
  undefined,
  Infinity,

  // 全局函数
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  decodeURI,
  decodeURIComponent,
  encodeURI,
  encodeURIComponent,
  escape,
  unescape,

  console,
  JSON,
  Math
}
export function evaluate (code, options = {}) {
  const {
    scope
  } = options

  const env = new Environment({ ...globalEnv, ...scope })
  const iterator = env.gen(code)()

  let result = iterator
  if (iterator && typeof iterator.next === 'function') {
    do {
      result = iterator.next()
    } while (!result.done)
  }

  return result
}
