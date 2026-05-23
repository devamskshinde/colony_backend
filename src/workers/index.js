'use strict';

const { startLocationSyncWorker, stopLocationSyncWorker } = require('./locationSync.worker');
const { startCleanupWorker, stopCleanupWorker } = require('./cleanup.worker');
const logger = require('../utils/logger');

let running = false;

function startWorkers() {
  if (running) return;
  running = true;
  startLocationSyncWorker();
  startCleanupWorker();
  logger.info('All workers started');
}

function stopWorkers() {
  if (!running) return;
  running = false;
  stopLocationSyncWorker();
  stopCleanupWorker();
  logger.info('All workers stopped');
}

module.exports = { startWorkers, stopWorkers };
