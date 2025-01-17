'use strict'
require('core-js/es6/array')
var arrayify = require('array-back')
var o = require('object-tools')
var Definitions = require('./definitions')
var option = require('./option')
var cliUsage = require('command-line-usage')
var t = require('typical')
var Argv = require('./argv')

/**
A library to collect command-line args and generate a usage guide.

@module command-line-args
*/
module.exports = commandLineArgs

/**
 * @class
 * @classdesc A class encapsulating operations you can perform using an [OptionDefinition](#exp_module_definition--OptionDefinition) array as input.
 *
 * The constructor will throw if you pass invalid option definitions. You should fix these issues before proceeding.
 * @param {module:definition[]} - An optional array of [OptionDefinition](#exp_module_definition--OptionDefinition) objects
 * @typicalname cli
 * @alias module:command-line-args
 * @throws `NAME_MISSING` if an option definition is missing the required `name` property
 * @throws `INVALID_TYPE` if an option definition has a `type` value that's not a function
 * @throws `INVALID_ALIAS` if an alias is numeric, a hyphen or a length other than 1
 * @throws `DUPLICATE_NAME` if an option definition name was used more than once
 * @throws `DUPLICATE_ALIAS` if an option definition alias was used more than once
 * @example
 * ```js
 * var commandLineArgs = require("command-line-args")
 * var cli = commandLineArgs([
 *     { name: "file" },
 *     { name: "verbose" },
 *     { name: "depth"}
 * ])
 * ```
 */
class CommandLineArgs {
  constructor (definitions) {
    this.definitions = new Definitions(definitions)
  }

  /**
  Returns an object containing all the values and flags set on the command line. By default it parses the global [`process.argv`](https://nodejs.org/api/process.html#process_process_argv) array.

  @param [argv] {string[]} - An array of strings, which if passed will be parsed instead of `process.argv`.
  @returns {object}
  @throws `UNKNOWN_OPTION` if the user sets an option without a definition
  */
  parse (argv) {
    argv = new Argv(argv)
    argv.expandOptionEqualsNotation()
    argv.expandGetoptNotation()
    argv.validate(this.definitions)

    /* create output initialised with default values */
    var output = this.definitions.createOutput()
    var def

    /* walk argv building the output */
    argv.forEach(item => {
      if (option.isOption(item)) {
        def = this.definitions.get(item)
        if (!t.isDefined(output[def.name])) outputSet(output, def.name, def.getInitialValue())
        if (def.isBoolean()) {
          outputSet(output, def.name, true)
          def = null
        }
      } else {
        var value = item
        if (!def) {
          def = this.definitions.getDefault()
          if (!def) return
          if (!t.isDefined(output[def.name])) outputSet(output, def.name, def.getInitialValue())
        }

        var outputValue = def.type ? def.type(value) : value
        outputSet(output, def.name, outputValue)

        if (!def.multiple) def = null
      }
    })

    /* clear _initial flags */
    o.each(output, (value, key) => {
      if (Array.isArray(value) && value._initial) delete value._initial
    })

    /* group the output values */
    if (this.definitions.isGrouped()) {
      var grouped = {
        _all: output
      }

      this.definitions.whereGrouped().forEach(def => {
        arrayify(def.group).forEach(groupName => {
          grouped[groupName] = grouped[groupName] || {}
          if (t.isDefined(output[def.name])) {
            grouped[groupName][def.name] = output[def.name]
          }
        })
      })

      this.definitions.whereNotGrouped().forEach(def => {
        if (t.isDefined(output[def.name])) {
          if (!grouped._none) grouped._none = {}
          grouped._none[def.name] = output[def.name]
        }
      })
      return grouped
    } else {
      return output
    }
  }

  /**
  Generates a usage guide. Please see [command-line-usage](https://github.com/75lb/command-line-usage) for full instructions of how to use.

  @param [options] {object} - the options to pass to [command-line-usage](https://github.com/75lb/command-line-usage)
  @returns {string}
  */
  getUsage (options) {
    return cliUsage(this.definitions, options)
  }
}

function outputSet (output, property, value) {
  if (output[property] && output[property]._initial) {
    output[property] = []
    delete output[property]._initial
  }
  if (Array.isArray(output[property])) {
    output[property].push(value)
  } else {
    output[property] = value
  }
}

/* Factory method: initialises a new CommandLineArgs instance. */
function commandLineArgs (definitions) {
  return new CommandLineArgs(definitions)
}
