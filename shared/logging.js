class Logger {
  constructor() {
    this.verbosityLevels = {
      DEBUG: 3,
      INFO: 2,
      LOG: 1,
      WARNING: 0,
      ERROR: -1,
    }
    this.verbosity = this.verbosityLevels.LOG
  }

  setVerbosity(v) {
    if (v in this.verbosityLevels) {
      this.verbosity = this.verbosityLevels[v]
    } else {
      throw new Error(`Invalid verbosity level: ${v}`)
    }
  }

  
  debug(message) {
    if (this.verbosity >= this.verbosityLevels.DEBUG) {
      console.debug(`[DEBUG] ${message}`)
    }
  }
  
  info(message) {
    if (this.verbosity >= this.verbosityLevels.INFO) {
      console.info(`[INFO] ${message}`)
    }
  }
  
  log(message) {
    if (this.verbosity >= this.verbosityLevels.LOG) {
      console.log(`${message}`)
    }
  }

  warning(message) {
    if (this.verbosity >= this.verbosityLevels.WARNING) {
      console.warn(`[WARNING] ${message}`)
    }
  }

  error(message) {
    if (this.verbosity >= this.verbosityLevels.ERROR) {
      console.error(`[ERROR] ${message}`)
    }
  }
}

export const logger = new Logger();

export function setVerbosity(v) {
    logger.setVerbosity(v);
}
