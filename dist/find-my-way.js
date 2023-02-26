(function (f) {
  if (typeof exports === "object" && typeof module !== "undefined") {
    module.exports = f();
  } else if (typeof define === "function" && define.amd) {
    define([], f);
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      g = this;
    }
    g.FindMyWay = f();
  }
})(function () {
  var define, module, exports;
  return function () {
    function r(e, n, t) {
      function o(i, f) {
        if (!n[i]) {
          if (!e[i]) {
            var c = "function" == typeof require && require;
            if (!f && c) return c(i, !0);
            if (u) return u(i, !0);
            var a = new Error("Cannot find module '" + i + "'");
            throw a.code = "MODULE_NOT_FOUND", a;
          }
          var p = n[i] = {
            exports: {}
          };
          e[i][0].call(p.exports, function (r) {
            var n = e[i][1][r];
            return o(n || r);
          }, p, p.exports, r, e, n, t);
        }
        return n[i].exports;
      }
      for (var u = "function" == typeof require && require, i = 0; i < t.length; i++) o(t[i]);
      return o;
    }
    return r;
  }()({
    1: [function (require, module, exports) {
      'use strict';

      function Assert(expr, message) {
        if (!expr) {
          throw new Error(message);
        }
        return true;
      }
      module.exports = Assert;
    }, {}],
    2: [function (require, module, exports) {
      'use strict';

      const HandlerStorage = require('./handler_storage');
      const NODE_TYPES = {
        STATIC: 0,
        PARAMETRIC: 1,
        WILDCARD: 2
      };
      class Node {
        constructor() {
          this.handlerStorage = new HandlerStorage();
        }
      }
      class ParentNode extends Node {
        constructor() {
          super();
          this.staticChildren = {};
        }
        findStaticMatchingChild(path, pathIndex) {
          const staticChild = this.staticChildren[path.charAt(pathIndex)];
          if (staticChild === undefined || !staticChild.matchPrefix(path, pathIndex)) {
            return null;
          }
          return staticChild;
        }
        createStaticChild(path) {
          if (path.length === 0) {
            return this;
          }
          let staticChild = this.staticChildren[path.charAt(0)];
          if (staticChild) {
            let i = 1;
            for (; i < staticChild.prefix.length; i++) {
              if (path.charCodeAt(i) !== staticChild.prefix.charCodeAt(i)) {
                staticChild = staticChild.split(this, i);
                break;
              }
            }
            return staticChild.createStaticChild(path.slice(i));
          }
          const label = path.charAt(0);
          this.staticChildren[label] = new StaticNode(path);
          return this.staticChildren[label];
        }
      }
      class StaticNode extends ParentNode {
        constructor(prefix) {
          super();
          this.prefix = prefix;
          this.wildcardChild = null;
          this.parametricChildren = [];
          this.kind = NODE_TYPES.STATIC;
          this._compilePrefixMatch();
        }
        createParametricChild(regex, staticSuffix) {
          const regexpSource = regex && regex.source;
          let parametricChild = this.parametricChildren.find(child => {
            const childRegexSource = child.regex && child.regex.source;
            return childRegexSource === regexpSource;
          });
          if (parametricChild) {
            return parametricChild;
          }
          parametricChild = new ParametricNode(regex, staticSuffix);
          this.parametricChildren.push(parametricChild);
          this.parametricChildren.sort((child1, child2) => {
            if (!child1.isRegex) return 1;
            if (!child2.isRegex) return -1;
            if (child1.staticSuffix === null) return 1;
            if (child2.staticSuffix === null) return -1;
            if (child2.staticSuffix.endsWith(child1.staticSuffix)) return 1;
            if (child1.staticSuffix.endsWith(child2.staticSuffix)) return -1;
            return 0;
          });
          return parametricChild;
        }
        createWildcardChild() {
          if (this.wildcardChild) {
            return this.wildcardChild;
          }
          this.wildcardChild = new WildcardNode();
          return this.wildcardChild;
        }
        split(parentNode, length) {
          const parentPrefix = this.prefix.slice(0, length);
          const childPrefix = this.prefix.slice(length);
          this.prefix = childPrefix;
          this._compilePrefixMatch();
          const staticNode = new StaticNode(parentPrefix);
          staticNode.staticChildren[childPrefix.charAt(0)] = this;
          parentNode.staticChildren[parentPrefix.charAt(0)] = staticNode;
          return staticNode;
        }
        getNextNode(path, pathIndex, nodeStack, paramsCount) {
          let node = this.findStaticMatchingChild(path, pathIndex);
          let parametricBrotherNodeIndex = 0;
          if (node === null) {
            if (this.parametricChildren.length === 0) {
              return this.wildcardChild;
            }
            node = this.parametricChildren[0];
            parametricBrotherNodeIndex = 1;
          }
          if (this.wildcardChild !== null) {
            nodeStack.push({
              paramsCount,
              brotherPathIndex: pathIndex,
              brotherNode: this.wildcardChild
            });
          }
          for (let i = this.parametricChildren.length - 1; i >= parametricBrotherNodeIndex; i--) {
            nodeStack.push({
              paramsCount,
              brotherPathIndex: pathIndex,
              brotherNode: this.parametricChildren[i]
            });
          }
          return node;
        }
        _compilePrefixMatch() {
          if (this.prefix.length === 1) {
            this.matchPrefix = () => true;
            return;
          }
          const lines = [];
          for (let i = 1; i < this.prefix.length; i++) {
            const charCode = this.prefix.charCodeAt(i);
            lines.push(`path.charCodeAt(i + ${i}) === ${charCode}`);
          }
          this.matchPrefix = new Function('path', 'i', `return ${lines.join(' && ')}`); // eslint-disable-line
        }
      }

      class ParametricNode extends ParentNode {
        constructor(regex, staticSuffix) {
          super();
          this.isRegex = !!regex;
          this.regex = regex || null;
          this.staticSuffix = staticSuffix || null;
          this.kind = NODE_TYPES.PARAMETRIC;
        }
        getNextNode(path, pathIndex) {
          return this.findStaticMatchingChild(path, pathIndex);
        }
      }
      class WildcardNode extends Node {
        constructor() {
          super();
          this.kind = NODE_TYPES.WILDCARD;
        }
        getNextNode() {
          return null;
        }
      }
      module.exports = {
        StaticNode,
        ParametricNode,
        WildcardNode,
        NODE_TYPES
      };
    }, {
      "./handler_storage": 3
    }],
    3: [function (require, module, exports) {
      'use strict';

      class HandlerStorage {
        constructor() {
          this.unconstrainedHandler = null; // optimized reference to the handler that will match most of the time
          this.constraints = [];
          this.handlers = []; // unoptimized list of handler objects for which the fast matcher function will be compiled
          this.constrainedHandlerStores = null;
        }

        // This is the hot path for node handler finding -- change with care!
        getMatchingHandler(derivedConstraints) {
          if (derivedConstraints === undefined) {
            return this.unconstrainedHandler;
          }
          return this._getHandlerMatchingConstraints(derivedConstraints);
        }
        addHandler(handler, params, store, constrainer, constraints) {
          const handlerObject = {
            handler,
            params,
            constraints,
            store: store || null,
            _createParamsObject: this._compileCreateParamsObject(params)
          };
          if (Object.keys(constraints).length === 0) {
            this.unconstrainedHandler = handlerObject;
          }
          for (const constraint of Object.keys(constraints)) {
            if (!this.constraints.includes(constraint)) {
              if (constraint === 'version') {
                // always check the version constraint first as it is the most selective
                this.constraints.unshift(constraint);
              } else {
                this.constraints.push(constraint);
              }
            }
          }
          if (this.handlers.length >= 32) {
            throw new Error('find-my-way supports a maximum of 32 route handlers per node when there are constraints, limit reached');
          }
          this.handlers.push(handlerObject);
          // Sort the most constrained handlers to the front of the list of handlers so they are tested first.
          this.handlers.sort((a, b) => Object.keys(a.constraints).length - Object.keys(b.constraints).length);
          this._compileGetHandlerMatchingConstraints(constrainer, constraints);
        }
        _compileCreateParamsObject(params) {
          const lines = [];
          for (let i = 0; i < params.length; i++) {
            lines.push(`'${params[i]}': paramsArray[${i}]`);
          }
          return new Function('paramsArray', `return {${lines.join(',')}}`); // eslint-disable-line
        }

        _getHandlerMatchingConstraints() {
          return null;
        }

        // Builds a store object that maps from constraint values to a bitmap of handler indexes which pass the constraint for a value
        // So for a host constraint, this might look like { "fastify.io": 0b0010, "google.ca": 0b0101 }, meaning the 3rd handler is constrainted to fastify.io, and the 2nd and 4th handlers are constrained to google.ca.
        // The store's implementation comes from the strategies provided to the Router.
        _buildConstraintStore(store, constraint) {
          for (let i = 0; i < this.handlers.length; i++) {
            const handler = this.handlers[i];
            const constraintValue = handler.constraints[constraint];
            if (constraintValue !== undefined) {
              let indexes = store.get(constraintValue) || 0;
              indexes |= 1 << i; // set the i-th bit for the mask because this handler is constrained by this value https://stackoverflow.com/questions/1436438/how-do-you-set-clear-and-toggle-a-single-bit-in-javascrip
              store.set(constraintValue, indexes);
            }
          }
        }

        // Builds a bitmask for a given constraint that has a bit for each handler index that is 0 when that handler *is* constrained and 1 when the handler *isnt* constrainted. This is opposite to what might be obvious, but is just for convienience when doing the bitwise operations.
        _constrainedIndexBitmask(constraint) {
          let mask = 0;
          for (let i = 0; i < this.handlers.length; i++) {
            const handler = this.handlers[i];
            const constraintValue = handler.constraints[constraint];
            if (constraintValue !== undefined) {
              mask |= 1 << i;
            }
          }
          return ~mask;
        }

        // Compile a fast function to match the handlers for this node
        // The function implements a general case multi-constraint matching algorithm.
        // The general idea is this: we have a bunch of handlers, each with a potentially different set of constraints, and sometimes none at all. We're given a list of constraint values and we have to use the constraint-value-comparison strategies to see which handlers match the constraint values passed in.
        // We do this by asking each constraint store which handler indexes match the given constraint value for each store. Trickily, the handlers that a store says match are the handlers constrained by that store, but handlers that aren't constrained at all by that store could still match just fine. So, each constraint store can only describe matches for it, and it won't have any bearing on the handlers it doesn't care about. For this reason, we have to ask each stores which handlers match and track which have been matched (or not cared about) by all of them.
        // We use bitmaps to represent these lists of matches so we can use bitwise operations to implement this efficiently. Bitmaps are cheap to allocate, let us implement this masking behaviour in one CPU instruction, and are quite compact in memory. We start with a bitmap set to all 1s representing every handler that is a match candidate, and then for each constraint, see which handlers match using the store, and then mask the result by the mask of handlers that that store applies to, and bitwise AND with the candidate list. Phew.
        // We consider all this compiling function complexity to be worth it, because the naive implementation that just loops over the handlers asking which stores match is quite a bit slower.
        _compileGetHandlerMatchingConstraints(constrainer) {
          this.constrainedHandlerStores = {};
          for (const constraint of this.constraints) {
            const store = constrainer.newStoreForConstraint(constraint);
            this.constrainedHandlerStores[constraint] = store;
            this._buildConstraintStore(store, constraint);
          }
          const lines = [];
          lines.push(`
    let candidates = ${(1 << this.handlers.length) - 1}
    let mask, matches
    `);
          for (const constraint of this.constraints) {
            // Setup the mask for indexes this constraint applies to. The mask bits are set to 1 for each position if the constraint applies.
            lines.push(`
      mask = ${this._constrainedIndexBitmask(constraint)}
      value = derivedConstraints.${constraint}
      `);

            // If there's no constraint value, none of the handlers constrained by this constraint can match. Remove them from the candidates.
            // If there is a constraint value, get the matching indexes bitmap from the store, and mask it down to only the indexes this constraint applies to, and then bitwise and with the candidates list to leave only matching candidates left.
            const strategy = constrainer.strategies[constraint];
            const matchMask = strategy.mustMatchWhenDerived ? 'matches' : '(matches | mask)';
            lines.push(`
      if (value === undefined) {
        candidates &= mask
      } else {
        matches = this.constrainedHandlerStores.${constraint}.get(value) || 0
        candidates &= ${matchMask}
      }
      if (candidates === 0) return null;
      `);
          }

          // There are some constraints that can be derived and marked as "must match", where if they are derived, they only match routes that actually have a constraint on the value, like the SemVer version constraint.
          // An example: a request comes in for version 1.x, and this node has a handler that matches the path, but there's no version constraint. For SemVer, the find-my-way semantics do not match this handler to that request.
          // This function is used by Nodes with handlers to match when they don't have any constrained routes to exclude request that do have must match derived constraints present.
          for (const constraint in constrainer.strategies) {
            const strategy = constrainer.strategies[constraint];
            if (strategy.mustMatchWhenDerived && !this.constraints.includes(constraint)) {
              lines.push(`if (derivedConstraints.${constraint} !== undefined) return null`);
            }
          }

          // Return the first handler who's bit is set in the candidates https://stackoverflow.com/questions/18134985/how-to-find-index-of-first-set-bit
          lines.push('return this.handlers[Math.floor(Math.log2(candidates))]');
          this._getHandlerMatchingConstraints = new Function('derivedConstraints', lines.join('\n')); // eslint-disable-line
        }
      }

      module.exports = HandlerStorage;
    }, {}],
    4: [function (require, module, exports) {
      'use strict';

      /*
        Char codes:
          '!': 33 - !
          '#': 35 - %23
          '$': 36 - %24
          '%': 37 - %25
          '&': 38 - %26
          ''': 39 - '
          '(': 40 - (
          ')': 41 - )
          '*': 42 - *
          '+': 43 - %2B
          ',': 44 - %2C
          '-': 45 - -
          '.': 46 - .
          '/': 47 - %2F
          ':': 58 - %3A
          ';': 59 - %3B
          '=': 61 - %3D
          '?': 63 - %3F
          '@': 64 - %40
          '_': 95 - _
          '~': 126 - ~
      */
      const assert = require('./assert-mock.js');
      const querystring = require('fast-querystring');
      const isRegexSafe = require('safe-regex2');
      const deepEqual = require('fast-deep-equal');
      const {
        flattenNode,
        compressFlattenedNode,
        prettyPrintFlattenedNode,
        prettyPrintRoutesArray
      } = require('./lib/pretty-print');
      const {
        StaticNode,
        NODE_TYPES
      } = require('./custom_node');
      const Constrainer = require('./lib/constrainer');
      const httpMethods = require('./lib/http-methods');
      const {
        safeDecodeURI,
        safeDecodeURIComponent
      } = require('./lib/url-sanitizer');
      const FULL_PATH_REGEXP = /^https?:\/\/.*?\//;
      const OPTIONAL_PARAM_REGEXP = /(\/:[^/()]*?)\?(\/?)/;
      if (!isRegexSafe(FULL_PATH_REGEXP)) {
        throw new Error('the FULL_PATH_REGEXP is not safe, update this module');
      }
      if (!isRegexSafe(OPTIONAL_PARAM_REGEXP)) {
        throw new Error('the OPTIONAL_PARAM_REGEXP is not safe, update this module');
      }
      function Router(opts) {
        if (!(this instanceof Router)) {
          return new Router(opts);
        }
        opts = opts || {};
        if (opts.defaultRoute) {
          assert(typeof opts.defaultRoute === 'function', 'The default route must be a function');
          this.defaultRoute = opts.defaultRoute;
        } else {
          this.defaultRoute = null;
        }
        if (opts.onBadUrl) {
          assert(typeof opts.onBadUrl === 'function', 'The bad url handler must be a function');
          this.onBadUrl = opts.onBadUrl;
        } else {
          this.onBadUrl = null;
        }
        if (opts.buildPrettyMeta) {
          assert(typeof opts.buildPrettyMeta === 'function', 'buildPrettyMeta must be a function');
          this.buildPrettyMeta = opts.buildPrettyMeta;
        } else {
          this.buildPrettyMeta = defaultBuildPrettyMeta;
        }
        if (opts.querystringParser) {
          assert(typeof opts.querystringParser === 'function', 'querystringParser must be a function');
          this.querystringParser = opts.querystringParser;
        } else {
          this.querystringParser = query => query === '' ? {} : querystring.parse(query);
        }
        this.caseSensitive = opts.caseSensitive === undefined ? true : opts.caseSensitive;
        this.ignoreTrailingSlash = opts.ignoreTrailingSlash || false;
        this.ignoreDuplicateSlashes = opts.ignoreDuplicateSlashes || false;
        this.maxParamLength = opts.maxParamLength || 100;
        this.allowUnsafeRegex = opts.allowUnsafeRegex || false;
        this.routes = [];
        this.trees = {};
        this.constrainer = new Constrainer(opts.constraints);
        this._routesPatterns = {};
      }
      Router.prototype.on = function on(method, path, opts, handler, store) {
        if (typeof opts === 'function') {
          if (handler !== undefined) {
            store = handler;
          }
          handler = opts;
          opts = {};
        }
        // path validation
        assert(typeof path === 'string', 'Path should be a string');
        assert(path.length > 0, 'The path could not be empty');
        assert(path[0] === '/' || path[0] === '*', 'The first character of a path should be `/` or `*`');
        // handler validation
        assert(typeof handler === 'function', 'Handler should be a function');

        // path ends with optional parameter
        const optionalParamMatch = path.match(OPTIONAL_PARAM_REGEXP);
        if (optionalParamMatch) {
          assert(path.length === optionalParamMatch.index + optionalParamMatch[0].length, 'Optional Parameter needs to be the last parameter of the path');
          const pathFull = path.replace(OPTIONAL_PARAM_REGEXP, '$1$2');
          const pathOptional = path.replace(OPTIONAL_PARAM_REGEXP, '$2');
          this.on(method, pathFull, opts, handler, store);
          this.on(method, pathOptional, opts, handler, store);
          return;
        }
        const route = path;
        if (this.ignoreDuplicateSlashes) {
          path = removeDuplicateSlashes(path);
        }
        if (this.ignoreTrailingSlash) {
          path = trimLastSlash(path);
        }
        const methods = Array.isArray(method) ? method : [method];
        for (const method of methods) {
          this._on(method, path, opts, handler, store, route);
          this.routes.push({
            method,
            path,
            opts,
            handler,
            store
          });
        }
      };
      Router.prototype._on = function _on(method, path, opts, handler, store) {
        assert(typeof method === 'string', 'Method should be a string');
        assert(httpMethods.includes(method), `Method '${method}' is not an http method.`);
        let constraints = {};
        if (opts.constraints !== undefined) {
          assert(typeof opts.constraints === 'object' && opts.constraints !== null, 'Constraints should be an object');
          if (Object.keys(opts.constraints).length !== 0) {
            constraints = opts.constraints;
          }
        }
        this.constrainer.validateConstraints(constraints);
        // Let the constrainer know if any constraints are being used now
        this.constrainer.noteUsage(constraints);

        // Boot the tree for this method if it doesn't exist yet
        if (this.trees[method] === undefined) {
          this.trees[method] = new StaticNode('/');
          this._routesPatterns[method] = [];
        }
        if (path === '*' && this.trees[method].prefix.length !== 0) {
          const currentRoot = this.trees[method];
          this.trees[method] = new StaticNode('');
          this.trees[method].staticChildren['/'] = currentRoot;
        }
        let currentNode = this.trees[method];
        let parentNodePathIndex = currentNode.prefix.length;
        const params = [];
        for (let i = 0; i <= path.length; i++) {
          if (path.charCodeAt(i) === 58 && path.charCodeAt(i + 1) === 58) {
            // It's a double colon
            i++;
            continue;
          }
          const isParametricNode = path.charCodeAt(i) === 58 && path.charCodeAt(i + 1) !== 58;
          const isWildcardNode = path.charCodeAt(i) === 42;
          if (isParametricNode || isWildcardNode || i === path.length && i !== parentNodePathIndex) {
            let staticNodePath = path.slice(parentNodePathIndex, i);
            if (!this.caseSensitive) {
              staticNodePath = staticNodePath.toLowerCase();
            }
            staticNodePath = staticNodePath.split('::').join(':');
            staticNodePath = staticNodePath.split('%').join('%25');
            // add the static part of the route to the tree
            currentNode = currentNode.createStaticChild(staticNodePath);
          }
          if (isParametricNode) {
            let isRegexNode = false;
            const regexps = [];
            let lastParamStartIndex = i + 1;
            for (let j = lastParamStartIndex;; j++) {
              const charCode = path.charCodeAt(j);
              const isRegexParam = charCode === 40;
              const isStaticPart = charCode === 45 || charCode === 46;
              const isEndOfNode = charCode === 47 || j === path.length;
              if (isRegexParam || isStaticPart || isEndOfNode) {
                const paramName = path.slice(lastParamStartIndex, j);
                params.push(paramName);
                isRegexNode = isRegexNode || isRegexParam || isStaticPart;
                if (isRegexParam) {
                  const endOfRegexIndex = getClosingParenthensePosition(path, j);
                  const regexString = path.slice(j, endOfRegexIndex + 1);
                  if (!this.allowUnsafeRegex) {
                    assert(isRegexSafe(new RegExp(regexString)), `The regex '${regexString}' is not safe!`);
                  }
                  regexps.push(trimRegExpStartAndEnd(regexString));
                  j = endOfRegexIndex + 1;
                } else {
                  regexps.push('(.*?)');
                }
                const staticPartStartIndex = j;
                for (; j < path.length; j++) {
                  const charCode = path.charCodeAt(j);
                  if (charCode === 47) break;
                  if (charCode === 58) {
                    const nextCharCode = path.charCodeAt(j + 1);
                    if (nextCharCode === 58) j++;else break;
                  }
                }
                let staticPart = path.slice(staticPartStartIndex, j);
                if (staticPart) {
                  staticPart = staticPart.split('::').join(':');
                  staticPart = staticPart.split('%').join('%25');
                  regexps.push(escapeRegExp(staticPart));
                }
                lastParamStartIndex = j + 1;
                if (isEndOfNode || path.charCodeAt(j) === 47 || j === path.length) {
                  const nodePattern = isRegexNode ? '()' + staticPart : staticPart;
                  path = path.slice(0, i + 1) + nodePattern + path.slice(j);
                  i += nodePattern.length;
                  const regex = isRegexNode ? new RegExp('^' + regexps.join('') + '$') : null;
                  currentNode = currentNode.createParametricChild(regex, staticPart || null);
                  parentNodePathIndex = i + 1;
                  break;
                }
              }
            }
          } else if (isWildcardNode) {
            // add the wildcard parameter
            params.push('*');
            currentNode = currentNode.createWildcardChild();
            parentNodePathIndex = i + 1;
            if (i !== path.length - 1) {
              throw new Error('Wildcard must be the last character in the route');
            }
          }
        }
        if (!this.caseSensitive) {
          path = path.toLowerCase();
        }
        if (path === '*') {
          path = '/*';
        }
        for (const existRoute of this._routesPatterns[method]) {
          if (existRoute.path === path && deepEqual(existRoute.constraints, constraints)) {
            throw new Error(`Method '${method}' already declared for route '${path}' with constraints '${JSON.stringify(constraints)}'`);
          }
        }
        this._routesPatterns[method].push({
          path,
          params,
          constraints
        });
        currentNode.handlerStorage.addHandler(handler, params, store, this.constrainer, constraints);
      };
      Router.prototype.hasConstraintStrategy = function (strategyName) {
        return this.constrainer.hasConstraintStrategy(strategyName);
      };
      Router.prototype.addConstraintStrategy = function (constraints) {
        this.constrainer.addConstraintStrategy(constraints);
        this._rebuild(this.routes);
      };
      Router.prototype.reset = function reset() {
        this.trees = {};
        this.routes = [];
        this._routesPatterns = {};
      };
      Router.prototype.off = function off(method, path, constraints) {
        // path validation
        assert(typeof path === 'string', 'Path should be a string');
        assert(path.length > 0, 'The path could not be empty');
        assert(path[0] === '/' || path[0] === '*', 'The first character of a path should be `/` or `*`');
        // options validation
        assert(typeof constraints === 'undefined' || typeof constraints === 'object' && !Array.isArray(constraints) && constraints !== null, 'Constraints should be an object or undefined.');

        // path ends with optional parameter
        const optionalParamMatch = path.match(OPTIONAL_PARAM_REGEXP);
        if (optionalParamMatch) {
          assert(path.length === optionalParamMatch.index + optionalParamMatch[0].length, 'Optional Parameter needs to be the last parameter of the path');
          const pathFull = path.replace(OPTIONAL_PARAM_REGEXP, '$1$2');
          const pathOptional = path.replace(OPTIONAL_PARAM_REGEXP, '$2');
          this.off(method, pathFull, constraints);
          this.off(method, pathOptional, constraints);
          return;
        }
        if (this.ignoreDuplicateSlashes) {
          path = removeDuplicateSlashes(path);
        }
        if (this.ignoreTrailingSlash) {
          path = trimLastSlash(path);
        }
        const methods = Array.isArray(method) ? method : [method];
        for (const method of methods) {
          this._off(method, path, constraints);
        }
      };
      Router.prototype._off = function _off(method, path, constraints) {
        // method validation
        assert(typeof method === 'string', 'Method should be a string');
        assert(httpMethods.includes(method), `Method '${method}' is not an http method.`);
        function matcherWithoutConstraints(route) {
          return method !== route.method || path !== route.path;
        }
        function matcherWithConstraints(route) {
          return matcherWithoutConstraints(route) || !deepEqual(constraints, route.opts.constraints || {});
        }
        const predicate = constraints ? matcherWithConstraints : matcherWithoutConstraints;

        // Rebuild tree without the specific route
        const newRoutes = this.routes.filter(predicate);
        this._rebuild(newRoutes);
      };
      Router.prototype.lookup = function lookup(req, res, ctx, done) {
        if (typeof ctx === 'function') {
          done = ctx;
          ctx = undefined;
        }
        if (done === undefined) {
          const constraints = this.constrainer.deriveConstraints(req, ctx);
          const handle = this.find(req.method, req.url, constraints);
          return this.callHandler(handle, req, res, ctx);
        }
        this.constrainer.deriveConstraints(req, ctx, (err, constraints) => {
          if (err !== null) {
            done(err);
            return;
          }
          try {
            const handle = this.find(req.method, req.url, constraints);
            const result = this.callHandler(handle, req, res, ctx);
            done(null, result);
          } catch (err) {
            done(err);
          }
        });
      };
      Router.prototype.callHandler = function callHandler(handle, req, res, ctx) {
        if (handle === null) return this._defaultRoute(req, res, ctx);
        return ctx === undefined ? handle.handler(req, res, handle.params, handle.store, handle.searchParams) : handle.handler.call(ctx, req, res, handle.params, handle.store, handle.searchParams);
      };
      Router.prototype.find = function find(method, path, derivedConstraints) {
        let currentNode = this.trees[method];
        if (currentNode === undefined) return null;
        if (path.charCodeAt(0) !== 47) {
          // 47 is '/'
          path = path.replace(FULL_PATH_REGEXP, '/');
        }

        // This must be run before sanitizeUrl as the resulting function
        // .sliceParameter must be constructed with same URL string used
        // throughout the rest of this function.
        if (this.ignoreDuplicateSlashes) {
          path = removeDuplicateSlashes(path);
        }
        let sanitizedUrl;
        let querystring;
        let shouldDecodeParam;
        try {
          sanitizedUrl = safeDecodeURI(path);
          path = sanitizedUrl.path;
          querystring = sanitizedUrl.querystring;
          shouldDecodeParam = sanitizedUrl.shouldDecodeParam;
        } catch (error) {
          return this._onBadUrl(path);
        }
        if (this.ignoreTrailingSlash) {
          path = trimLastSlash(path);
        }
        const originPath = path;
        if (this.caseSensitive === false) {
          path = path.toLowerCase();
        }
        const maxParamLength = this.maxParamLength;
        let pathIndex = currentNode.prefix.length;
        const params = [];
        const pathLen = path.length;
        const brothersNodesStack = [];
        while (true) {
          if (pathIndex === pathLen) {
            const handle = currentNode.handlerStorage.getMatchingHandler(derivedConstraints);
            if (handle !== null) {
              return {
                handler: handle.handler,
                store: handle.store,
                params: handle._createParamsObject(params),
                searchParams: this.querystringParser(querystring)
              };
            }
          }
          let node = currentNode.getNextNode(path, pathIndex, brothersNodesStack, params.length);
          if (node === null) {
            if (brothersNodesStack.length === 0) {
              return null;
            }
            const brotherNodeState = brothersNodesStack.pop();
            pathIndex = brotherNodeState.brotherPathIndex;
            params.splice(brotherNodeState.paramsCount);
            node = brotherNodeState.brotherNode;
          }
          currentNode = node;

          // static route
          if (currentNode.kind === NODE_TYPES.STATIC) {
            pathIndex += currentNode.prefix.length;
            continue;
          }
          if (currentNode.kind === NODE_TYPES.WILDCARD) {
            let param = originPath.slice(pathIndex);
            if (shouldDecodeParam) {
              param = safeDecodeURIComponent(param);
            }
            params.push(param);
            pathIndex = pathLen;
            continue;
          }
          if (currentNode.kind === NODE_TYPES.PARAMETRIC) {
            let paramEndIndex = originPath.indexOf('/', pathIndex);
            if (paramEndIndex === -1) {
              paramEndIndex = pathLen;
            }
            let param = originPath.slice(pathIndex, paramEndIndex);
            if (shouldDecodeParam) {
              param = safeDecodeURIComponent(param);
            }
            if (currentNode.isRegex) {
              const matchedParameters = currentNode.regex.exec(param);
              if (matchedParameters === null) continue;
              for (let i = 1; i < matchedParameters.length; i++) {
                const matchedParam = matchedParameters[i];
                if (matchedParam.length > maxParamLength) {
                  return null;
                }
                params.push(matchedParam);
              }
            } else {
              if (param.length > maxParamLength) {
                return null;
              }
              params.push(param);
            }
            pathIndex = paramEndIndex;
          }
        }
      };
      Router.prototype._rebuild = function (routes) {
        this.reset();
        for (const route of routes) {
          const {
            method,
            path,
            opts,
            handler,
            store
          } = route;
          this._on(method, path, opts, handler, store);
          this.routes.push({
            method,
            path,
            opts,
            handler,
            store
          });
        }
      };
      Router.prototype._defaultRoute = function (req, res, ctx) {
        if (this.defaultRoute !== null) {
          return ctx === undefined ? this.defaultRoute(req, res) : this.defaultRoute.call(ctx, req, res);
        } else {
          res.statusCode = 404;
          res.end();
        }
      };
      Router.prototype._onBadUrl = function (path) {
        if (this.onBadUrl === null) {
          return null;
        }
        const onBadUrl = this.onBadUrl;
        return {
          handler: (req, res, ctx) => onBadUrl(path, req, res),
          params: {},
          store: null
        };
      };
      Router.prototype.prettyPrint = function (opts = {}) {
        opts.commonPrefix = opts.commonPrefix === undefined ? true : opts.commonPrefix; // default to original behaviour
        if (!opts.commonPrefix) return prettyPrintRoutesArray.call(this, this.routes, opts);
        const root = {
          prefix: '/',
          nodes: [],
          children: {}
        };
        for (const method in this.trees) {
          const node = this.trees[method];
          if (node) {
            flattenNode(root, node, method);
          }
        }
        compressFlattenedNode(root);
        return prettyPrintFlattenedNode.call(this, root, '', true, opts);
      };
      for (var i in httpMethods) {
        /* eslint no-prototype-builtins: "off" */
        if (!httpMethods.hasOwnProperty(i)) continue;
        const m = httpMethods[i];
        const methodName = m.toLowerCase();
        if (Router.prototype[methodName]) throw new Error('Method already exists: ' + methodName);
        Router.prototype[methodName] = function (path, handler, store) {
          return this.on(m, path, handler, store);
        };
      }
      Router.prototype.all = function (path, handler, store) {
        this.on(httpMethods, path, handler, store);
      };
      module.exports = Router;
      function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      function removeDuplicateSlashes(path) {
        return path.replace(/\/\/+/g, '/');
      }
      function trimLastSlash(path) {
        if (path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
          return path.slice(0, -1);
        }
        return path;
      }
      function trimRegExpStartAndEnd(regexString) {
        // removes chars that marks start "^" and end "$" of regexp
        if (regexString.charCodeAt(1) === 94) {
          regexString = regexString.slice(0, 1) + regexString.slice(2);
        }
        if (regexString.charCodeAt(regexString.length - 2) === 36) {
          regexString = regexString.slice(0, regexString.length - 2) + regexString.slice(regexString.length - 1);
        }
        return regexString;
      }
      function getClosingParenthensePosition(path, idx) {
        // `path.indexOf()` will always return the first position of the closing parenthese,
        // but it's inefficient for grouped or wrong regexp expressions.
        // see issues #62 and #63 for more info

        var parentheses = 1;
        while (idx < path.length) {
          idx++;

          // ignore skipped chars
          if (path[idx] === '\\') {
            idx++;
            continue;
          }
          if (path[idx] === ')') {
            parentheses--;
          } else if (path[idx] === '(') {
            parentheses++;
          }
          if (!parentheses) return idx;
        }
        throw new TypeError('Invalid regexp expression in "' + path + '"');
      }
      function defaultBuildPrettyMeta(route) {
        // buildPrettyMeta function must return an object, which will be parsed into key/value pairs for display
        if (!route) return {};
        if (!route.store) return {};
        return Object.assign({}, route.store);
      }
    }, {
      "./assert-mock.js": 1,
      "./custom_node": 2,
      "./lib/constrainer": 5,
      "./lib/http-methods": 6,
      "./lib/pretty-print": 7,
      "./lib/url-sanitizer": 10,
      "fast-deep-equal": 12,
      "fast-querystring": 13,
      "safe-regex2": 22
    }],
    5: [function (require, module, exports) {
      'use strict';

      const acceptVersionStrategy = require('./strategies/accept-version');
      const acceptHostStrategy = require('./strategies/accept-host');
      const assert = require('../assert-mock.js');
      class Constrainer {
        constructor(customStrategies) {
          this.strategies = {
            version: acceptVersionStrategy,
            host: acceptHostStrategy
          };
          this.strategiesInUse = new Set();
          this.asyncStrategiesInUse = new Set();

          // validate and optimize prototypes of given custom strategies
          if (customStrategies) {
            for (const strategy of Object.values(customStrategies)) {
              this.addConstraintStrategy(strategy);
            }
          }
        }
        isStrategyUsed(strategyName) {
          return this.strategiesInUse.has(strategyName) || this.asyncStrategiesInUse.has(strategyName);
        }
        hasConstraintStrategy(strategyName) {
          const customConstraintStrategy = this.strategies[strategyName];
          if (customConstraintStrategy !== undefined) {
            return customConstraintStrategy.isCustom || this.isStrategyUsed(strategyName);
          }
          return false;
        }
        addConstraintStrategy(strategy) {
          assert(typeof strategy.name === 'string' && strategy.name !== '', 'strategy.name is required.');
          assert(strategy.storage && typeof strategy.storage === 'function', 'strategy.storage function is required.');
          assert(strategy.deriveConstraint && typeof strategy.deriveConstraint === 'function', 'strategy.deriveConstraint function is required.');
          if (this.strategies[strategy.name] && this.strategies[strategy.name].isCustom) {
            throw new Error(`There already exists a custom constraint with the name ${strategy.name}.`);
          }
          if (this.isStrategyUsed(strategy.name)) {
            throw new Error(`There already exists a route with ${strategy.name} constraint.`);
          }
          strategy.isCustom = true;
          strategy.isAsync = strategy.deriveConstraint.length === 3;
          this.strategies[strategy.name] = strategy;
          if (strategy.mustMatchWhenDerived) {
            this.noteUsage({
              [strategy.name]: strategy
            });
          }
        }
        deriveConstraints(req, ctx, done) {
          const constraints = this.deriveSyncConstraints(req, ctx);
          if (done === undefined) {
            return constraints;
          }
          this.deriveAsyncConstraints(constraints, req, ctx, done);
        }
        deriveSyncConstraints(req, ctx) {
          return undefined;
        }

        // When new constraints start getting used, we need to rebuild the deriver to derive them. Do so if we see novel constraints used.
        noteUsage(constraints) {
          if (constraints) {
            const beforeSize = this.strategiesInUse.size;
            for (const key in constraints) {
              const strategy = this.strategies[key];
              if (strategy.isAsync) {
                this.asyncStrategiesInUse.add(key);
              } else {
                this.strategiesInUse.add(key);
              }
            }
            if (beforeSize !== this.strategiesInUse.size) {
              this._buildDeriveConstraints();
            }
          }
        }
        newStoreForConstraint(constraint) {
          if (!this.strategies[constraint]) {
            throw new Error(`No strategy registered for constraint key ${constraint}`);
          }
          return this.strategies[constraint].storage();
        }
        validateConstraints(constraints) {
          for (const key in constraints) {
            const value = constraints[key];
            if (typeof value === 'undefined') {
              throw new Error('Can\'t pass an undefined constraint value, must pass null or no key at all');
            }
            const strategy = this.strategies[key];
            if (!strategy) {
              throw new Error(`No strategy registered for constraint key ${key}`);
            }
            if (strategy.validate) {
              strategy.validate(value);
            }
          }
        }
        deriveAsyncConstraints(constraints, req, ctx, done) {
          let asyncConstraintsCount = this.asyncStrategiesInUse.size;
          if (asyncConstraintsCount === 0) {
            done(null, constraints);
            return;
          }
          constraints = constraints || {};
          for (const key of this.asyncStrategiesInUse) {
            const strategy = this.strategies[key];
            strategy.deriveConstraint(req, ctx, (err, constraintValue) => {
              if (err !== null) {
                done(err);
                return;
              }
              constraints[key] = constraintValue;
              if (--asyncConstraintsCount === 0) {
                done(null, constraints);
              }
            });
          }
        }

        // Optimization: build a fast function for deriving the constraints for all the strategies at once. We inline the definitions of the version constraint and the host constraint for performance.
        // If no constraining strategies are in use (no routes constrain on host, or version, or any custom strategies) then we don't need to derive constraints for each route match, so don't do anything special, and just return undefined
        // This allows us to not allocate an object to hold constraint values if no constraints are defined.
        _buildDeriveConstraints() {
          if (this.strategiesInUse.size === 0) return;
          const lines = ['return {'];
          for (const key of this.strategiesInUse) {
            const strategy = this.strategies[key];
            // Optimization: inline the derivation for the common built in constraints
            if (!strategy.isCustom) {
              if (key === 'version') {
                lines.push('   version: req.headers[\'accept-version\'],');
              } else if (key === 'host') {
                lines.push('   host: req.headers.host || req.headers[\':authority\'],');
              } else {
                throw new Error('unknown non-custom strategy for compiling constraint derivation function');
              }
            } else {
              lines.push(`  ${strategy.name}: this.strategies.${key}.deriveConstraint(req, ctx),`);
            }
          }
          lines.push('}');
          this.deriveSyncConstraints = new Function('req', 'ctx', lines.join('\n')).bind(this); // eslint-disable-line
        }
      }

      module.exports = Constrainer;
    }, {
      "../assert-mock.js": 1,
      "./strategies/accept-host": 8,
      "./strategies/accept-version": 9
    }],
    6: [function (require, module, exports) {
      'use strict';

      // defined by Node.js http module, a snapshot from Node.js 18.12.0
      const httpMethods = ['ACL', 'BIND', 'CHECKOUT', 'CONNECT', 'COPY', 'DELETE', 'GET', 'HEAD', 'LINK', 'LOCK', 'M-SEARCH', 'MERGE', 'MKACTIVITY', 'MKCALENDAR', 'MKCOL', 'MOVE', 'NOTIFY', 'OPTIONS', 'PATCH', 'POST', 'PROPFIND', 'PROPPATCH', 'PURGE', 'PUT', 'REBIND', 'REPORT', 'SEARCH', 'SOURCE', 'SUBSCRIBE', 'TRACE', 'UNBIND', 'UNLINK', 'UNLOCK', 'UNSUBSCRIBE'];
      module.exports = httpMethods;
    }, {}],
    7: [function (require, module, exports) {
      'use strict';

      /* eslint-disable no-multi-spaces */
      const indent = '    ';
      const branchIndent = '│   ';
      const midBranchIndent = '├── ';
      const endBranchIndent = '└── ';
      const wildcardDelimiter = '*';
      const pathDelimiter = '/';
      const pathRegExp = /(?=\/)/;
      /* eslint-enable */

      function parseFunctionName(fn) {
        let fName = fn.name || '';
        fName = fName.replace('bound', '').trim();
        fName = (fName || 'anonymous') + '()';
        return fName;
      }
      function parseMeta(meta) {
        if (Array.isArray(meta)) return meta.map(m => parseMeta(m));
        if (typeof meta === 'symbol') return meta.toString();
        if (typeof meta === 'function') return parseFunctionName(meta);
        return meta;
      }
      function buildMetaObject(route, metaArray) {
        const out = {};
        const cleanMeta = this.buildPrettyMeta(route);
        if (!Array.isArray(metaArray)) metaArray = cleanMeta ? Reflect.ownKeys(cleanMeta) : [];
        metaArray.forEach(m => {
          const metaKey = typeof m === 'symbol' ? m.toString() : m;
          if (cleanMeta && cleanMeta[m]) {
            out[metaKey] = parseMeta(cleanMeta[m]);
          }
        });
        return out;
      }
      function prettyPrintRoutesArray(routeArray, opts = {}) {
        if (!this.buildPrettyMeta) throw new Error('buildPrettyMeta not defined');
        opts.includeMeta = opts.includeMeta || null; // array of meta objects to display
        const mergedRouteArray = [];
        let tree = '';
        routeArray.sort((a, b) => {
          if (!a.path || !b.path) return 0;
          return a.path.localeCompare(b.path);
        });

        // merge alike paths
        for (let i = 0; i < routeArray.length; i++) {
          const route = routeArray[i];
          const pathExists = mergedRouteArray.find(r => route.path === r.path);
          if (pathExists) {
            // path already declared, add new method and break out of loop
            pathExists.handlers.push({
              method: route.method,
              opts: route.opts.constraints || undefined,
              meta: opts.includeMeta ? buildMetaObject.call(this, route, opts.includeMeta) : null
            });
            continue;
          }
          const routeHandler = {
            method: route.method,
            opts: route.opts.constraints || undefined,
            meta: opts.includeMeta ? buildMetaObject.call(this, route, opts.includeMeta) : null
          };
          mergedRouteArray.push({
            path: route.path,
            methods: [route.method],
            opts: [route.opts],
            handlers: [routeHandler]
          });
        }

        // insert root level path if none defined
        if (!mergedRouteArray.filter(r => r.path === pathDelimiter).length) {
          const rootPath = {
            path: pathDelimiter,
            truncatedPath: '',
            methods: [],
            opts: [],
            handlers: [{}]
          };

          // if wildcard route exists, insert root level after wildcard
          if (mergedRouteArray.filter(r => r.path === wildcardDelimiter).length) {
            mergedRouteArray.splice(1, 0, rootPath);
          } else {
            mergedRouteArray.unshift(rootPath);
          }
        }

        // build tree
        const routeTree = buildRouteTree(mergedRouteArray);

        // draw tree
        routeTree.forEach((rootBranch, idx) => {
          tree += drawBranch(rootBranch, null, idx === routeTree.length - 1, false, true);
          tree += '\n'; // newline characters inserted at beginning of drawing function to allow for nested paths
        });

        return tree;
      }
      function buildRouteTree(mergedRouteArray) {
        const result = [];
        const temp = {
          result
        };
        mergedRouteArray.forEach((route, idx) => {
          let splitPath = route.path.split(pathRegExp);

          // add preceding slash for proper nesting
          if (splitPath[0] !== pathDelimiter) {
            // handle wildcard route
            if (splitPath[0] !== wildcardDelimiter) splitPath = [pathDelimiter, splitPath[0].slice(1), ...splitPath.slice(1)];
          }

          // build tree
          splitPath.reduce((acc, path, pidx) => {
            if (!acc[path]) {
              acc[path] = {
                result: []
              };
              const pathSeg = {
                path,
                children: acc[path].result
              };
              if (pidx === splitPath.length - 1) pathSeg.handlers = route.handlers;
              acc.result.push(pathSeg);
            }
            return acc[path];
          }, temp);
        });

        // unfold root object from array
        return result;
      }
      function drawBranch(pathSeg, prefix, endBranch, noPrefix, rootBranch) {
        let branch = '';
        if (!noPrefix && !rootBranch) branch += '\n';
        if (!noPrefix) branch += `${prefix || ''}${endBranch ? endBranchIndent : midBranchIndent}`;
        branch += `${pathSeg.path}`;
        if (pathSeg.handlers) {
          const flatHandlers = pathSeg.handlers.reduce((acc, curr) => {
            const match = acc.findIndex(h => JSON.stringify(h.opts) === JSON.stringify(curr.opts));
            if (match !== -1) {
              acc[match].method = [acc[match].method, curr.method].join(', ');
            } else {
              acc.push(curr);
            }
            return acc;
          }, []);
          flatHandlers.forEach((handler, idx) => {
            if (idx > 0) branch += `${noPrefix ? '' : prefix || ''}${endBranch ? indent : branchIndent}${pathSeg.path}`;
            branch += ` (${handler.method || '-'})`;
            if (handler.opts && JSON.stringify(handler.opts) !== '{}') branch += ` ${JSON.stringify(handler.opts)}`;
            if (handler.meta) {
              Reflect.ownKeys(handler.meta).forEach((m, hidx) => {
                branch += `\n${noPrefix ? '' : prefix || ''}${endBranch ? indent : branchIndent}`;
                branch += `• (${m}) ${JSON.stringify(handler.meta[m])}`;
              });
            }
            if (flatHandlers.length > 1 && idx !== flatHandlers.length - 1) branch += '\n';
          });
        } else {
          if (pathSeg.children.length > 1) branch += ' (-)';
        }
        if (!noPrefix) prefix = `${prefix || ''}${endBranch ? indent : branchIndent}`;
        pathSeg.children.forEach((child, idx) => {
          const endBranch = idx === pathSeg.children.length - 1;
          const skipPrefix = !pathSeg.handlers && pathSeg.children.length === 1;
          branch += drawBranch(child, prefix, endBranch, skipPrefix);
        });
        return branch;
      }
      function prettyPrintFlattenedNode(flattenedNode, prefix, tail, opts) {
        if (!this.buildPrettyMeta) throw new Error('buildPrettyMeta not defined');
        opts.includeMeta = opts.includeMeta || null; // array of meta items to display
        let paramName = '';
        const printHandlers = [];
        for (const {
          node,
          method
        } of flattenedNode.nodes) {
          for (const handler of node.handlerStorage.handlers) {
            printHandlers.push({
              method,
              ...handler
            });
          }
        }
        if (printHandlers.length) {
          printHandlers.forEach((handler, index) => {
            let suffix = `(${handler.method || '-'})`;
            if (Object.keys(handler.constraints).length > 0) {
              suffix += ' ' + JSON.stringify(handler.constraints);
            }
            let name = '';
            // find locations of parameters in prefix
            const paramIndices = flattenedNode.prefix.split('').map((ch, idx) => ch === ':' ? idx : null).filter(idx => idx !== null);
            if (paramIndices.length) {
              let prevLoc = 0;
              paramIndices.forEach((loc, idx) => {
                // find parameter in prefix
                name += flattenedNode.prefix.slice(prevLoc, loc + 1);
                // insert parameters
                name += handler.params[handler.params.length - paramIndices.length + idx];
                if (idx === paramIndices.length - 1) name += flattenedNode.prefix.slice(loc + 1);
                prevLoc = loc + 1;
              });
            } else {
              // there are no parameters, return full object
              name = flattenedNode.prefix;
            }
            if (index === 0) {
              paramName += `${name} ${suffix}`;
            } else {
              paramName += `\n${prefix}${tail ? indent : branchIndent}${name} ${suffix}`;
            }
            if (opts.includeMeta) {
              const meta = buildMetaObject.call(this, handler, opts.includeMeta);
              Object.keys(meta).forEach((m, hidx) => {
                paramName += `\n${prefix || ''}${tail ? indent : branchIndent}`;
                paramName += `• (${m}) ${JSON.stringify(meta[m])}`;
              });
            }
          });
        } else {
          paramName = flattenedNode.prefix;
        }
        let tree = `${prefix}${tail ? endBranchIndent : midBranchIndent}${paramName}\n`;
        prefix = `${prefix}${tail ? indent : branchIndent}`;
        const labels = Object.keys(flattenedNode.children);
        for (let i = 0; i < labels.length; i++) {
          const child = flattenedNode.children[labels[i]];
          tree += prettyPrintFlattenedNode.call(this, child, prefix, i === labels.length - 1, opts);
        }
        return tree;
      }
      function flattenNode(flattened, node, method) {
        if (node.handlerStorage.handlers.length !== 0) {
          flattened.nodes.push({
            method,
            node
          });
        }
        if (node.parametricChildren && node.parametricChildren[0]) {
          if (!flattened.children[':']) {
            flattened.children[':'] = {
              prefix: ':',
              nodes: [],
              children: {}
            };
          }
          flattenNode(flattened.children[':'], node.parametricChildren[0], method);
        }
        if (node.wildcardChild) {
          if (!flattened.children['*']) {
            flattened.children['*'] = {
              prefix: '*',
              nodes: [],
              children: {}
            };
          }
          flattenNode(flattened.children['*'], node.wildcardChild, method);
        }
        if (node.staticChildren) {
          for (const child of Object.values(node.staticChildren)) {
            // split on the slash separator but use a regex to lookahead and not actually match it, preserving it in the returned string segments
            const childPrefixSegments = child.prefix.split(pathRegExp);
            let cursor = flattened;
            let parent;
            for (const segment of childPrefixSegments) {
              parent = cursor;
              cursor = cursor.children[segment];
              if (!cursor) {
                cursor = {
                  prefix: segment,
                  nodes: [],
                  children: {}
                };
                parent.children[segment] = cursor;
              }
            }
            flattenNode(cursor, child, method);
          }
        }
      }
      function compressFlattenedNode(flattenedNode) {
        const childKeys = Object.keys(flattenedNode.children);
        if (flattenedNode.nodes.length === 0 && childKeys.length === 1) {
          const child = flattenedNode.children[childKeys[0]];
          if (child.nodes.length <= 1) {
            compressFlattenedNode(child);
            flattenedNode.nodes = child.nodes;
            flattenedNode.prefix += child.prefix;
            flattenedNode.children = child.children;
            return flattenedNode;
          }
        }
        for (const key of Object.keys(flattenedNode.children)) {
          compressFlattenedNode(flattenedNode.children[key]);
        }
        return flattenedNode;
      }
      module.exports = {
        flattenNode,
        compressFlattenedNode,
        prettyPrintFlattenedNode,
        prettyPrintRoutesArray
      };
    }, {}],
    8: [function (require, module, exports) {
      'use strict';

      const assert = require('../../assert-mock.js');
      function HostStorage() {
        const hosts = {};
        const regexHosts = [];
        return {
          get: host => {
            const exact = hosts[host];
            if (exact) {
              return exact;
            }
            for (const regex of regexHosts) {
              if (regex.host.test(host)) {
                return regex.value;
              }
            }
          },
          set: (host, value) => {
            if (host instanceof RegExp) {
              regexHosts.push({
                host,
                value
              });
            } else {
              hosts[host] = value;
            }
          }
        };
      }
      module.exports = {
        name: 'host',
        mustMatchWhenDerived: false,
        storage: HostStorage,
        validate(value) {
          assert(typeof value === 'string' || Object.prototype.toString.call(value) === '[object RegExp]', 'Host should be a string or a RegExp');
        }
      };
    }, {
      "../../assert-mock.js": 1
    }],
    9: [function (require, module, exports) {
      'use strict';

      const assert = require('../../assert-mock.js');
      function SemVerStore() {
        if (!(this instanceof SemVerStore)) {
          return new SemVerStore();
        }
        this.store = {};
        this.maxMajor = 0;
        this.maxMinors = {};
        this.maxPatches = {};
      }
      SemVerStore.prototype.set = function (version, store) {
        if (typeof version !== 'string') {
          throw new TypeError('Version should be a string');
        }
        let [major, minor, patch] = version.split('.');
        major = Number(major) || 0;
        minor = Number(minor) || 0;
        patch = Number(patch) || 0;
        if (major >= this.maxMajor) {
          this.maxMajor = major;
          this.store.x = store;
          this.store['*'] = store;
          this.store['x.x'] = store;
          this.store['x.x.x'] = store;
        }
        if (minor >= (this.maxMinors[major] || 0)) {
          this.maxMinors[major] = minor;
          this.store[`${major}.x`] = store;
          this.store[`${major}.x.x`] = store;
        }
        if (patch >= (this.store[`${major}.${minor}`] || 0)) {
          this.maxPatches[`${major}.${minor}`] = patch;
          this.store[`${major}.${minor}.x`] = store;
        }
        this.store[`${major}.${minor}.${patch}`] = store;
        return this;
      };
      SemVerStore.prototype.get = function (version) {
        return this.store[version];
      };
      module.exports = {
        name: 'version',
        mustMatchWhenDerived: true,
        storage: SemVerStore,
        validate(value) {
          assert(typeof value === 'string', 'Version should be a string');
        }
      };
    }, {
      "../../assert-mock.js": 1
    }],
    10: [function (require, module, exports) {
      'use strict';

      // It must spot all the chars where decodeURIComponent(x) !== decodeURI(x)
      // The chars are: # $ & + , / : ; = ? @
      function decodeComponentChar(highCharCode, lowCharCode) {
        if (highCharCode === 50) {
          if (lowCharCode === 53) return '%';
          if (lowCharCode === 51) return '#';
          if (lowCharCode === 52) return '$';
          if (lowCharCode === 54) return '&';
          if (lowCharCode === 66) return '+';
          if (lowCharCode === 98) return '+';
          if (lowCharCode === 67) return ',';
          if (lowCharCode === 99) return ',';
          if (lowCharCode === 70) return '/';
          if (lowCharCode === 102) return '/';
          return null;
        }
        if (highCharCode === 51) {
          if (lowCharCode === 65) return ':';
          if (lowCharCode === 97) return ':';
          if (lowCharCode === 66) return ';';
          if (lowCharCode === 98) return ';';
          if (lowCharCode === 68) return '=';
          if (lowCharCode === 100) return '=';
          if (lowCharCode === 70) return '?';
          if (lowCharCode === 102) return '?';
          return null;
        }
        if (highCharCode === 52 && lowCharCode === 48) {
          return '@';
        }
        return null;
      }
      function safeDecodeURI(path) {
        let shouldDecode = false;
        let shouldDecodeParam = false;
        let querystring = '';
        for (let i = 1; i < path.length; i++) {
          const charCode = path.charCodeAt(i);
          if (charCode === 37) {
            const highCharCode = path.charCodeAt(i + 1);
            const lowCharCode = path.charCodeAt(i + 2);
            if (decodeComponentChar(highCharCode, lowCharCode) === null) {
              shouldDecode = true;
            } else {
              shouldDecodeParam = true;
              // %25 - encoded % char. We need to encode one more time to prevent double decoding
              if (highCharCode === 50 && lowCharCode === 53) {
                shouldDecode = true;
                path = path.slice(0, i + 1) + '25' + path.slice(i + 1);
                i += 2;
              }
              i += 2;
            }
            // Some systems do not follow RFC and separate the path and query
            // string with a `;` character (code 59), e.g. `/foo;jsessionid=123456`.
            // Thus, we need to split on `;` as well as `?` and `#`.
          } else if (charCode === 63 || charCode === 59 || charCode === 35) {
            querystring = path.slice(i + 1);
            path = path.slice(0, i);
            break;
          }
        }
        const decodedPath = shouldDecode ? decodeURI(path) : path;
        return {
          path: decodedPath,
          querystring,
          shouldDecodeParam
        };
      }
      function safeDecodeURIComponent(uriComponent) {
        const startIndex = uriComponent.indexOf('%');
        if (startIndex === -1) return uriComponent;
        let decoded = '';
        let lastIndex = startIndex;
        for (let i = startIndex; i < uriComponent.length; i++) {
          if (uriComponent.charCodeAt(i) === 37) {
            const highCharCode = uriComponent.charCodeAt(i + 1);
            const lowCharCode = uriComponent.charCodeAt(i + 2);
            const decodedChar = decodeComponentChar(highCharCode, lowCharCode);
            decoded += uriComponent.slice(lastIndex, i) + decodedChar;
            lastIndex = i + 3;
          }
        }
        return uriComponent.slice(0, startIndex) + decoded + uriComponent.slice(lastIndex);
      }
      module.exports = {
        safeDecodeURI,
        safeDecodeURIComponent
      };
    }, {}],
    11: [function (require, module, exports) {
      'use strict';

      var UTF8_ACCEPT = 12;
      var UTF8_REJECT = 0;
      var UTF8_DATA = [
      // The first part of the table maps bytes to character to a transition.
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 8, 7, 7, 10, 9, 9, 9, 11, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
      // The second part of the table maps a state to a new state when adding a
      // transition.
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 0, 0, 0, 0, 24, 36, 48, 60, 72, 84, 96, 0, 12, 12, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 24, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 24, 24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      // The third part maps the current transition to a mask that needs to apply
      // to the byte.
      0x7F, 0x3F, 0x3F, 0x3F, 0x00, 0x1F, 0x0F, 0x0F, 0x0F, 0x07, 0x07, 0x07];
      function decodeURIComponent(uri) {
        var percentPosition = uri.indexOf('%');
        if (percentPosition === -1) return uri;
        var length = uri.length;
        var decoded = '';
        var last = 0;
        var codepoint = 0;
        var startOfOctets = percentPosition;
        var state = UTF8_ACCEPT;
        while (percentPosition > -1 && percentPosition < length) {
          var high = hexCodeToInt(uri[percentPosition + 1], 4);
          var low = hexCodeToInt(uri[percentPosition + 2], 0);
          var byte = high | low;
          var type = UTF8_DATA[byte];
          state = UTF8_DATA[256 + state + type];
          codepoint = codepoint << 6 | byte & UTF8_DATA[364 + type];
          if (state === UTF8_ACCEPT) {
            decoded += uri.slice(last, startOfOctets);
            decoded += codepoint <= 0xFFFF ? String.fromCharCode(codepoint) : String.fromCharCode(0xD7C0 + (codepoint >> 10), 0xDC00 + (codepoint & 0x3FF));
            codepoint = 0;
            last = percentPosition + 3;
            percentPosition = startOfOctets = uri.indexOf('%', last);
          } else if (state === UTF8_REJECT) {
            return null;
          } else {
            percentPosition += 3;
            if (percentPosition < length && uri.charCodeAt(percentPosition) === 37) continue;
            return null;
          }
        }
        return decoded + uri.slice(last);
      }
      var HEX = {
        '0': 0,
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        '6': 6,
        '7': 7,
        '8': 8,
        '9': 9,
        'a': 10,
        'A': 10,
        'b': 11,
        'B': 11,
        'c': 12,
        'C': 12,
        'd': 13,
        'D': 13,
        'e': 14,
        'E': 14,
        'f': 15,
        'F': 15
      };
      function hexCodeToInt(c, shift) {
        var i = HEX[c];
        return i === undefined ? 255 : i << shift;
      }
      module.exports = decodeURIComponent;
    }, {}],
    12: [function (require, module, exports) {
      'use strict';

      // do not edit .js files directly - edit src/index.jst
      module.exports = function equal(a, b) {
        if (a === b) return true;
        if (a && b && typeof a == 'object' && typeof b == 'object') {
          if (a.constructor !== b.constructor) return false;
          var length, i, keys;
          if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;) if (!equal(a[i], b[i])) return false;
            return true;
          }
          if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
          if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
          if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
          keys = Object.keys(a);
          length = keys.length;
          if (length !== Object.keys(b).length) return false;
          for (i = length; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
          for (i = length; i-- !== 0;) {
            var key = keys[i];
            if (!equal(a[key], b[key])) return false;
          }
          return true;
        }

        // true if both NaN, false otherwise
        return a !== a && b !== b;
      };
    }, {}],
    13: [function (require, module, exports) {
      "use strict";

      const parse = require("./parse");
      const stringify = require("./stringify");
      const fastQuerystring = {
        parse,
        stringify
      };

      /**
       * Enable TS and JS support
       *
       * - `const qs = require('fast-querystring')`
       * - `import qs from 'fast-querystring'`
       */
      module.exports = fastQuerystring;
      module.exports.default = fastQuerystring;
      module.exports.parse = parse;
      module.exports.stringify = stringify;
    }, {
      "./parse": 15,
      "./stringify": 16
    }],
    14: [function (require, module, exports) {
      // This file is taken from Node.js project.
      // Full implementation can be found from https://github.com/nodejs/node/blob/main/lib/internal/querystring.js

      const hexTable = Array.from({
        length: 256
      }, (_, i) => "%" + ((i < 16 ? "0" : "") + i.toString(16)).toUpperCase());

      // These characters do not need escaping when generating query strings:
      // ! - . _ ~
      // ' ( ) *
      // digits
      // alpha (uppercase)
      // alpha (lowercase)
      // rome-ignore format: the array should not be formatted
      const noEscape = new Int8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      // 0 - 15
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      // 16 - 31
      0, 1, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 0,
      // 32 - 47
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0,
      // 48 - 63
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      // 64 - 79
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1,
      // 80 - 95
      0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      // 96 - 111
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 1, 0 // 112 - 127
      ]);

      /**
       * @param {string} str
       * @returns {string}
       */
      function encodeString(str) {
        const len = str.length;
        if (len === 0) return "";
        let out = "";
        let lastPos = 0;
        let i = 0;
        outer: for (; i < len; i++) {
          let c = str.charCodeAt(i);

          // ASCII
          while (c < 0x80) {
            if (noEscape[c] !== 1) {
              if (lastPos < i) out += str.slice(lastPos, i);
              lastPos = i + 1;
              out += hexTable[c];
            }
            if (++i === len) break outer;
            c = str.charCodeAt(i);
          }
          if (lastPos < i) out += str.slice(lastPos, i);

          // Multi-byte characters ...
          if (c < 0x800) {
            lastPos = i + 1;
            out += hexTable[0xc0 | c >> 6] + hexTable[0x80 | c & 0x3f];
            continue;
          }
          if (c < 0xd800 || c >= 0xe000) {
            lastPos = i + 1;
            out += hexTable[0xe0 | c >> 12] + hexTable[0x80 | c >> 6 & 0x3f] + hexTable[0x80 | c & 0x3f];
            continue;
          }
          // Surrogate pair
          ++i;

          // This branch should never happen because all URLSearchParams entries
          // should already be converted to USVString. But, included for
          // completion's sake anyway.
          if (i >= len) {
            throw new Error("URI malformed");
          }
          const c2 = str.charCodeAt(i) & 0x3ff;
          lastPos = i + 1;
          c = 0x10000 + ((c & 0x3ff) << 10 | c2);
          out += hexTable[0xf0 | c >> 18] + hexTable[0x80 | c >> 12 & 0x3f] + hexTable[0x80 | c >> 6 & 0x3f] + hexTable[0x80 | c & 0x3f];
        }
        if (lastPos === 0) return str;
        if (lastPos < len) return out + str.slice(lastPos);
        return out;
      }
      module.exports = {
        encodeString
      };
    }, {}],
    15: [function (require, module, exports) {
      "use strict";

      const fastDecode = require("fast-decode-uri-component");
      const plusRegex = /\+/g;
      const Empty = function () {};
      Empty.prototype = Object.create(null);

      /**
       * @callback parse
       * @param {string} input
       */
      function parse(input) {
        // Optimization: Use new Empty() instead of Object.create(null) for performance
        // v8 has a better optimization for initializing functions compared to Object
        const result = new Empty();
        if (typeof input !== "string") {
          return result;
        }
        let inputLength = input.length;
        let key = "";
        let value = "";
        let startingIndex = -1;
        let equalityIndex = -1;
        let shouldDecodeKey = false;
        let shouldDecodeValue = false;
        let keyHasPlus = false;
        let valueHasPlus = false;
        let hasBothKeyValuePair = false;
        let c = 0;

        // Have a boundary of input.length + 1 to access last pair inside the loop.
        for (let i = 0; i < inputLength + 1; i++) {
          c = i !== inputLength ? input.charCodeAt(i) : 38;

          // Handle '&' and end of line to pass the current values to result
          if (c === 38) {
            hasBothKeyValuePair = equalityIndex > startingIndex;

            // Optimization: Reuse equality index to store the end of key
            if (!hasBothKeyValuePair) {
              equalityIndex = i;
            }
            key = input.slice(startingIndex + 1, equalityIndex);

            // Add key/value pair only if the range size is greater than 1; a.k.a. contains at least "="
            if (hasBothKeyValuePair || key.length > 0) {
              // Optimization: Replace '+' with space
              if (keyHasPlus) {
                key = key.replace(plusRegex, " ");
              }

              // Optimization: Do not decode if it's not necessary.
              if (shouldDecodeKey) {
                key = fastDecode(key) || key;
              }
              if (hasBothKeyValuePair) {
                value = input.slice(equalityIndex + 1, i);
                if (valueHasPlus) {
                  value = value.replace(plusRegex, " ");
                }
                if (shouldDecodeValue) {
                  value = fastDecode(value) || value;
                }
              }
              const currentValue = result[key];
              if (currentValue === undefined) {
                result[key] = value;
              } else {
                // Optimization: value.pop is faster than Array.isArray(value)
                if (currentValue.pop) {
                  currentValue.push(value);
                } else {
                  result[key] = [currentValue, value];
                }
              }
            }

            // Reset reading key value pairs
            value = "";
            startingIndex = i;
            equalityIndex = i;
            shouldDecodeKey = false;
            shouldDecodeValue = false;
            keyHasPlus = false;
            valueHasPlus = false;
          }
          // Check '='
          else if (c === 61) {
            if (equalityIndex <= startingIndex) {
              equalityIndex = i;
            }
            // If '=' character occurs again, we should decode the input.
            else {
              shouldDecodeValue = true;
            }
          }
          // Check '+', and remember to replace it with empty space.
          else if (c === 43) {
            if (equalityIndex > startingIndex) {
              valueHasPlus = true;
            } else {
              keyHasPlus = true;
            }
          }
          // Check '%' character for encoding
          else if (c === 37) {
            if (equalityIndex > startingIndex) {
              shouldDecodeValue = true;
            } else {
              shouldDecodeKey = true;
            }
          }
        }
        return result;
      }
      module.exports = parse;
    }, {
      "fast-decode-uri-component": 11
    }],
    16: [function (require, module, exports) {
      "use strict";

      const {
        encodeString
      } = require("./internals/querystring");
      function getAsPrimitive(value) {
        const type = typeof value;
        if (type === "string") {
          // Length check is handled inside encodeString function
          return encodeString(value);
        } else if (type === "bigint") {
          return value.toString();
        } else if (type === "boolean") {
          return value ? "true" : "false";
        } else if (type === "number" && Number.isFinite(value)) {
          return value < 1e21 ? "" + value : encodeString("" + value);
        }
        return "";
      }

      /**
       * @param {Record<string, string | number | boolean
       * | ReadonlyArray<string | number | boolean> | null>} input
       * @returns {string}
       */
      function stringify(input) {
        let result = "";
        if (input === null || typeof input !== "object") {
          return result;
        }
        const separator = "&";
        const keys = Object.keys(input);
        const keyLength = keys.length;
        let valueLength = 0;
        for (let i = 0; i < keyLength; i++) {
          const key = keys[i];
          const value = input[key];
          const encodedKey = encodeString(key) + "=";
          if (i) {
            result += separator;
          }
          if (Array.isArray(value)) {
            valueLength = value.length;
            for (let j = 0; j < valueLength; j++) {
              if (j) {
                result += separator;
              }

              // Optimization: Dividing into multiple lines improves the performance.
              // Since v8 does not need to care about the '+' character if it was one-liner.
              result += encodedKey;
              result += getAsPrimitive(value[j]);
            }
          } else {
            result += encodedKey;
            result += getAsPrimitive(value);
          }
        }
        return result;
      }
      module.exports = stringify;
    }, {
      "./internals/querystring": 14
    }],
    17: [function (require, module, exports) {
      const util = require('./util');
      const types = require('./types');
      const sets = require('./sets');
      const positions = require('./positions');
      module.exports = regexpStr => {
        var i = 0,
          l,
          c,
          start = {
            type: types.ROOT,
            stack: []
          },
          // Keep track of last clause/group and stack.
          lastGroup = start,
          last = start.stack,
          groupStack = [];
        var repeatErr = i => {
          util.error(regexpStr, `Nothing to repeat at column ${i - 1}`);
        };

        // Decode a few escaped characters.
        var str = util.strToChars(regexpStr);
        l = str.length;

        // Iterate through each character in string.
        while (i < l) {
          c = str[i++];
          switch (c) {
            // Handle escaped characters, inclues a few sets.
            case '\\':
              c = str[i++];
              switch (c) {
                case 'b':
                  last.push(positions.wordBoundary());
                  break;
                case 'B':
                  last.push(positions.nonWordBoundary());
                  break;
                case 'w':
                  last.push(sets.words());
                  break;
                case 'W':
                  last.push(sets.notWords());
                  break;
                case 'd':
                  last.push(sets.ints());
                  break;
                case 'D':
                  last.push(sets.notInts());
                  break;
                case 's':
                  last.push(sets.whitespace());
                  break;
                case 'S':
                  last.push(sets.notWhitespace());
                  break;
                default:
                  // Check if c is integer.
                  // In which case it's a reference.
                  if (/\d/.test(c)) {
                    last.push({
                      type: types.REFERENCE,
                      value: parseInt(c, 10)
                    });

                    // Escaped character.
                  } else {
                    last.push({
                      type: types.CHAR,
                      value: c.charCodeAt(0)
                    });
                  }
              }
              break;

            // Positionals.
            case '^':
              last.push(positions.begin());
              break;
            case '$':
              last.push(positions.end());
              break;

            // Handle custom sets.
            case '[':
              // Check if this class is 'anti' i.e. [^abc].
              var not;
              if (str[i] === '^') {
                not = true;
                i++;
              } else {
                not = false;
              }

              // Get all the characters in class.
              var classTokens = util.tokenizeClass(str.slice(i), regexpStr);

              // Increase index by length of class.
              i += classTokens[1];
              last.push({
                type: types.SET,
                set: classTokens[0],
                not
              });
              break;

            // Class of any character except \n.
            case '.':
              last.push(sets.anyChar());
              break;

            // Push group onto stack.
            case '(':
              // Create group.
              var group = {
                type: types.GROUP,
                stack: [],
                remember: true
              };
              c = str[i];

              // If if this is a special kind of group.
              if (c === '?') {
                c = str[i + 1];
                i += 2;

                // Match if followed by.
                if (c === '=') {
                  group.followedBy = true;

                  // Match if not followed by.
                } else if (c === '!') {
                  group.notFollowedBy = true;
                } else if (c !== ':') {
                  util.error(regexpStr, `Invalid group, character '${c}'` + ` after '?' at column ${i - 1}`);
                }
                group.remember = false;
              }

              // Insert subgroup into current group stack.
              last.push(group);

              // Remember the current group for when the group closes.
              groupStack.push(lastGroup);

              // Make this new group the current group.
              lastGroup = group;
              last = group.stack;
              break;

            // Pop group out of stack.
            case ')':
              if (groupStack.length === 0) {
                util.error(regexpStr, `Unmatched ) at column ${i - 1}`);
              }
              lastGroup = groupStack.pop();

              // Check if this group has a PIPE.
              // To get back the correct last stack.
              last = lastGroup.options ? lastGroup.options[lastGroup.options.length - 1] : lastGroup.stack;
              break;

            // Use pipe character to give more choices.
            case '|':
              // Create array where options are if this is the first PIPE
              // in this clause.
              if (!lastGroup.options) {
                lastGroup.options = [lastGroup.stack];
                delete lastGroup.stack;
              }

              // Create a new stack and add to options for rest of clause.
              var stack = [];
              lastGroup.options.push(stack);
              last = stack;
              break;

            // Repetition.
            // For every repetition, remove last element from last stack
            // then insert back a RANGE object.
            // This design is chosen because there could be more than
            // one repetition symbols in a regex i.e. `a?+{2,3}`.
            case '{':
              var rs = /^(\d+)(,(\d+)?)?\}/.exec(str.slice(i)),
                min,
                max;
              if (rs !== null) {
                if (last.length === 0) {
                  repeatErr(i);
                }
                min = parseInt(rs[1], 10);
                max = rs[2] ? rs[3] ? parseInt(rs[3], 10) : Infinity : min;
                i += rs[0].length;
                last.push({
                  type: types.REPETITION,
                  min,
                  max,
                  value: last.pop()
                });
              } else {
                last.push({
                  type: types.CHAR,
                  value: 123
                });
              }
              break;
            case '?':
              if (last.length === 0) {
                repeatErr(i);
              }
              last.push({
                type: types.REPETITION,
                min: 0,
                max: 1,
                value: last.pop()
              });
              break;
            case '+':
              if (last.length === 0) {
                repeatErr(i);
              }
              last.push({
                type: types.REPETITION,
                min: 1,
                max: Infinity,
                value: last.pop()
              });
              break;
            case '*':
              if (last.length === 0) {
                repeatErr(i);
              }
              last.push({
                type: types.REPETITION,
                min: 0,
                max: Infinity,
                value: last.pop()
              });
              break;

            // Default is a character that is not `\[](){}?+*^$`.
            default:
              last.push({
                type: types.CHAR,
                value: c.charCodeAt(0)
              });
          }
        }

        // Check if any groups have not been closed.
        if (groupStack.length !== 0) {
          util.error(regexpStr, 'Unterminated group');
        }
        return start;
      };
      module.exports.types = types;
    }, {
      "./positions": 18,
      "./sets": 19,
      "./types": 20,
      "./util": 21
    }],
    18: [function (require, module, exports) {
      const types = require('./types');
      exports.wordBoundary = () => ({
        type: types.POSITION,
        value: 'b'
      });
      exports.nonWordBoundary = () => ({
        type: types.POSITION,
        value: 'B'
      });
      exports.begin = () => ({
        type: types.POSITION,
        value: '^'
      });
      exports.end = () => ({
        type: types.POSITION,
        value: '$'
      });
    }, {
      "./types": 20
    }],
    19: [function (require, module, exports) {
      const types = require('./types');
      const INTS = () => [{
        type: types.RANGE,
        from: 48,
        to: 57
      }];
      const WORDS = () => {
        return [{
          type: types.CHAR,
          value: 95
        }, {
          type: types.RANGE,
          from: 97,
          to: 122
        }, {
          type: types.RANGE,
          from: 65,
          to: 90
        }].concat(INTS());
      };
      const WHITESPACE = () => {
        return [{
          type: types.CHAR,
          value: 9
        }, {
          type: types.CHAR,
          value: 10
        }, {
          type: types.CHAR,
          value: 11
        }, {
          type: types.CHAR,
          value: 12
        }, {
          type: types.CHAR,
          value: 13
        }, {
          type: types.CHAR,
          value: 32
        }, {
          type: types.CHAR,
          value: 160
        }, {
          type: types.CHAR,
          value: 5760
        }, {
          type: types.RANGE,
          from: 8192,
          to: 8202
        }, {
          type: types.CHAR,
          value: 8232
        }, {
          type: types.CHAR,
          value: 8233
        }, {
          type: types.CHAR,
          value: 8239
        }, {
          type: types.CHAR,
          value: 8287
        }, {
          type: types.CHAR,
          value: 12288
        }, {
          type: types.CHAR,
          value: 65279
        }];
      };
      const NOTANYCHAR = () => {
        return [{
          type: types.CHAR,
          value: 10
        }, {
          type: types.CHAR,
          value: 13
        }, {
          type: types.CHAR,
          value: 8232
        }, {
          type: types.CHAR,
          value: 8233
        }];
      };

      // Predefined class objects.
      exports.words = () => ({
        type: types.SET,
        set: WORDS(),
        not: false
      });
      exports.notWords = () => ({
        type: types.SET,
        set: WORDS(),
        not: true
      });
      exports.ints = () => ({
        type: types.SET,
        set: INTS(),
        not: false
      });
      exports.notInts = () => ({
        type: types.SET,
        set: INTS(),
        not: true
      });
      exports.whitespace = () => ({
        type: types.SET,
        set: WHITESPACE(),
        not: false
      });
      exports.notWhitespace = () => ({
        type: types.SET,
        set: WHITESPACE(),
        not: true
      });
      exports.anyChar = () => ({
        type: types.SET,
        set: NOTANYCHAR(),
        not: true
      });
    }, {
      "./types": 20
    }],
    20: [function (require, module, exports) {
      module.exports = {
        ROOT: 0,
        GROUP: 1,
        POSITION: 2,
        SET: 3,
        RANGE: 4,
        REPETITION: 5,
        REFERENCE: 6,
        CHAR: 7
      };
    }, {}],
    21: [function (require, module, exports) {
      const types = require('./types');
      const sets = require('./sets');
      const CTRL = '@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^ ?';
      const SLSH = {
        '0': 0,
        't': 9,
        'n': 10,
        'v': 11,
        'f': 12,
        'r': 13
      };

      /**
       * Finds character representations in str and convert all to
       * their respective characters
       *
       * @param {String} str
       * @return {String}
       */
      exports.strToChars = function (str) {
        /* jshint maxlen: false */
        var chars_regex = /(\[\\b\])|(\\)?\\(?:u([A-F0-9]{4})|x([A-F0-9]{2})|(0?[0-7]{2})|c([@A-Z[\\\]^?])|([0tnvfr]))/g;
        str = str.replace(chars_regex, function (s, b, lbs, a16, b16, c8, dctrl, eslsh) {
          if (lbs) {
            return s;
          }
          var code = b ? 8 : a16 ? parseInt(a16, 16) : b16 ? parseInt(b16, 16) : c8 ? parseInt(c8, 8) : dctrl ? CTRL.indexOf(dctrl) : SLSH[eslsh];
          var c = String.fromCharCode(code);

          // Escape special regex characters.
          if (/[[\]{}^$.|?*+()]/.test(c)) {
            c = '\\' + c;
          }
          return c;
        });
        return str;
      };

      /**
       * turns class into tokens
       * reads str until it encounters a ] not preceeded by a \
       *
       * @param {String} str
       * @param {String} regexpStr
       * @return {Array.<Array.<Object>, Number>}
       */
      exports.tokenizeClass = (str, regexpStr) => {
        /* jshint maxlen: false */
        var tokens = [];
        var regexp = /\\(?:(w)|(d)|(s)|(W)|(D)|(S))|((?:(?:\\)(.)|([^\]\\]))-(?:\\)?([^\]]))|(\])|(?:\\)?([^])/g;
        var rs, c;
        while ((rs = regexp.exec(str)) != null) {
          if (rs[1]) {
            tokens.push(sets.words());
          } else if (rs[2]) {
            tokens.push(sets.ints());
          } else if (rs[3]) {
            tokens.push(sets.whitespace());
          } else if (rs[4]) {
            tokens.push(sets.notWords());
          } else if (rs[5]) {
            tokens.push(sets.notInts());
          } else if (rs[6]) {
            tokens.push(sets.notWhitespace());
          } else if (rs[7]) {
            tokens.push({
              type: types.RANGE,
              from: (rs[8] || rs[9]).charCodeAt(0),
              to: rs[10].charCodeAt(0)
            });
          } else if (c = rs[12]) {
            tokens.push({
              type: types.CHAR,
              value: c.charCodeAt(0)
            });
          } else {
            return [tokens, regexp.lastIndex];
          }
        }
        exports.error(regexpStr, 'Unterminated character class');
      };

      /**
       * Shortcut to throw errors.
       *
       * @param {String} regexp
       * @param {String} msg
       */
      exports.error = (regexp, msg) => {
        throw new SyntaxError('Invalid regular expression: /' + regexp + '/: ' + msg);
      };
    }, {
      "./sets": 19,
      "./types": 20
    }],
    22: [function (require, module, exports) {
      'use strict';

      var parse = require('ret');
      var types = parse.types;
      module.exports = function (re, opts) {
        if (!opts) opts = {};
        var replimit = opts.limit === undefined ? 25 : opts.limit;
        if (isRegExp(re)) re = re.source;else if (typeof re !== 'string') re = String(re);
        try {
          re = parse(re);
        } catch (err) {
          return false;
        }
        var reps = 0;
        return function walk(node, starHeight) {
          var i;
          var ok;
          var len;
          if (node.type === types.REPETITION) {
            starHeight++;
            reps++;
            if (starHeight > 1) return false;
            if (reps > replimit) return false;
          }
          if (node.options) {
            for (i = 0, len = node.options.length; i < len; i++) {
              ok = walk({
                stack: node.options[i]
              }, starHeight);
              if (!ok) return false;
            }
          }
          var stack = node.stack || node.value && node.value.stack;
          if (!stack) return true;
          for (i = 0; i < stack.length; i++) {
            ok = walk(stack[i], starHeight);
            if (!ok) return false;
          }
          return true;
        }(re, 0);
      };
      function isRegExp(x) {
        return {}.toString.call(x) === '[object RegExp]';
      }
    }, {
      "ret": 17
    }]
  }, {}, [4])(4);
});