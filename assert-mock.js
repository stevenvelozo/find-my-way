'use strict'

function Assert (expr, message) {
  if (!expr) {
    throw new Error(message)
  }

  return true
}

module.exports = Assert
