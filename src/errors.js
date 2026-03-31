"use strict";

class ParsingInterrupted extends Error {
  constructor(message = "Parsing interrupted") {
    super(message);
    this.name = "ParsingInterrupted";
  }
}

module.exports = {
  ParsingInterrupted,
};

