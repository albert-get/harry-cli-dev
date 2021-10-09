'use strict';

const log = require('npmlog')

log.level=process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
log.heading='harry';
log.addLevel('success',2000,{fg:'green',blod:true});

module.exports = log;

