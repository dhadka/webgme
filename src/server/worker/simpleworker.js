/*globals requireJS*/
/*jshint node:true*/

/**
 * @module Server.SimpleWorker
 * @author kecso / https://github.com/kecso
 */

'use strict';

var WEBGME = require(__dirname + '/../../../webgme'),
    Q = require('q'),
    Core = requireJS('common/core/core'),
    GUID = requireJS('common/util/guid'),
    DUMP = requireJS('common/core/users/dumpmore'),
    Storage = requireJS('common/storage/nodestorage'),
    Serialization = requireJS('common/core/users/serialization'),
    PluginResult = requireJS('plugin/PluginResult'),
    PluginMessage = requireJS('plugin/PluginMessage'),
    STORAGE_CONSTANTS = requireJS('common/storage/constants'),
    merger = requireJS('common/core/users/merge'),

    FS = require('fs'),

    PluginNodeManager = require('../../plugin/nodemanager'),
    CONSTANT = require('./constants'),
    Logger = require('../logger'),

    core = null,
    result = null,
    resultReady = false,
    resultRequested = false,
    resultId = null,
    error = null,
    initialized = false,
    _addOn = null,
    gmeConfig,
    logger,

    safeSend = function (msg) {
        if (initialized) {
            logger.debug('sending message', {metadata: msg});
        } else {
            //console.log('sending message', {metadata: msg});
        }
        try {
            process.send(msg);
        } catch (e) {
            if (initialized) {
                logger.error('sending message failed', {metadata: msg, e: e});
            } else {
                console.error('sending message failed', {metadata: msg, e: e});
            }
            //TODO check if we should separate some case
            process.exit(0);
        }
    },

    initResult = function () {
        core = null;
        result = null;
        resultReady = false;
        resultRequested = false;
        resultId = null;
        error = null;
    },

    initialize = function (parameters) {
        if (initialized !== true) {
            initialized = true;
            gmeConfig = parameters.gmeConfig;
            WEBGME.addToRequireJsPaths(gmeConfig);
            logger = Logger.create('gme:server:worker:simpleworker:pid_' + process.pid, gmeConfig.server.log, true);
            logger.debug('initializing');

            safeSend({pid: process.pid, type: CONSTANT.msgTypes.initialized});
        } else {
            safeSend({pid: process.pid, type: CONSTANT.msgTypes.initialized});
        }
    },


// Helper functions
    getConnectedStorage = function (webGMESessionId) {
        var host = '127.0.0.1', //TODO: this should come from gmeConfig
            storage = Storage.createStorage(host, webGMESessionId, logger, gmeConfig);

        return storage;
    },

// Export and node-dumping functions
    exportLibrary = function (webGMESessionId, projectId, hash, branchName, commit, libraryRootPath, callback) {

        var storage = getConnectedStorage(webGMESessionId),
            project,
            finish = function (err, data) {
                if (err) {
                    logger.error('exportLibrary: ', err);
                }
                storage.close(function (closeErr) {
                    if (closeErr) {
                        logger.error('storage close returned error', closeErr);
                    } else {
                        logger.debug('storage was closed with no errors');
                    }

                    callback(err || closeErr, data);
                });
            },
            gotHash = function () {
                var core = new Core(project, {
                    globConf: gmeConfig,
                    logger: logger.fork('core')
                });

                core.loadRoot(hash, function (err, root) {
                    if (err) {
                        finish(err);
                        return;
                    }

                    core.loadByPath(root, libraryRootPath, function (err, libraryRoot) {
                        if (err) {
                            finish(err);
                            return;
                        }
                        Serialization.export(core, libraryRoot, finish);
                    });
                });
            };

        storage.open(function (networkState) {
            if (networkState === STORAGE_CONSTANTS.CONNECTED) {

                storage.openProject(projectId, function (err, project__, branches) {
                    if (err) {
                        logger.error('openProject failed', projectId, err);
                        finish(err);
                        return;
                    }

                    project = project__;

                    if (hash) {
                        gotHash();
                        return;
                    }

                    commit = commit || branches[branchName];

                    if (!commit) {
                        finish('Branch not found, projectId: "' + projectId + '", branchName: "' + branchName + '".');
                        return;
                    }

                    project.loadObject(commit, function (err, commitObject) {
                        if (err) {
                            finish('Failed loading commitHash: ' + err);
                            return;
                        }

                        hash = commitObject.root;
                        gotHash();
                    });
                });
            } else {
                finish('having error with the webgme server connection');
            }
        });
    },
    loadNodes = function (root, core, paths, callback) {
        var deferred = Q.defer(),
            nodes = {},
            counter = 0,
            error = '',
            loadedNodeHandler = function (err, nodeObj) {
                counter += 1;
                if (err) {
                    error += err;
                }

                if (nodeObj) {
                    nodes[core.getPath(nodeObj)] = nodeObj;
                }

                if (counter === paths.length) {
                    allNodesLoadedHandler();
                }
            },
            allNodesLoadedHandler = function () {
                if (error) {
                    deferred.reject(error);
                }

                var result = [],
                    i;

                for (i = 0; i < paths.length; i += 1) {
                    result.push(nodes[paths[i]] || null);
                }
                deferred.resolve(result);
            },
            len;

        len = paths.length || 0;

        if (len === 0) {
            allNodesLoadedHandler();
        }
        while (len--) {
            core.loadByPath(root, paths[len], loadedNodeHandler);
        }
        return deferred.promise.nodeify(callback);
    },
    dumpMoreNodes = function (webGMESessionId, projectId, hash, nodePaths, callback) {

        var storage = getConnectedStorage(webGMESessionId),
            finish = function (err, data) {
                storage.close(function (closeErr) {
                    callback(err || closeErr, data);
                });
            };

        storage.open(function (networkStatus) {
            if (networkStatus === STORAGE_CONSTANTS.CONNECTED) {
                storage.openProject(projectId, function (err, project/*, branches*/) {

                    if (err) {
                        finish(err);
                        return;
                    }

                    var core = new Core(project, {
                        globConf: gmeConfig,
                        logger: logger.fork('core')
                    });

                    core.loadRoot(hash, function (err, root) {
                        if (err) {
                            finish(err);
                            return;
                        }

                        loadNodes(root, core, nodePaths, function (err, nodes) {
                            if (err) {
                                finish(err);
                                return;
                            }
                            DUMP(core, nodes, '', 'guid', finish);
                        });
                    });
                });
            } else {
                finish('problems during connection to webgme');
            }
        });
    },

    /**
     * Executes a plugin.
     *
     * @param {string} webGMESessionId
     * @param {string} userId
     * @param {string} pluginName
     * @param {object} context - where the plugin should execute.
     * @param {string} context.project - id of project.
     * @param {string} context.activeNode - path to activeNode.
     * @param {string} [context.activeSelection=[]] - paths to selected nodes.
     * @param {string} context.commit - commit hash to start the plugin from.
     * @param {string} context.branchName - branch which to save to.
     * @param {object} [context.pluginConfig=%defaultForPlugin%] - specific configuration for the plugin.
     * @param {function} callback
     */
    executePlugin = function (webGMESessionId, userId, pluginName, context, callback) {
        var storage = getConnectedStorage(webGMESessionId),
            errMessage;
        logger.debug('executePlugin', userId, pluginName);
        logger.debug('executePlugin context', {metadata: context});
        storage.open(function (status) {
            logger.debug('storage is open');
            if (status === STORAGE_CONSTANTS.CONNECTED) {
                storage.openProject(context.managerConfig.project, function (err, project, branches) {
                    var pluginManager,
                        pluginContext;
                    if (err) {
                        callback(err, null);
                        return;
                    }
                    logger.debug('Opened project, got branches:', context.managerConfig.project, branches);
                    pluginManager = new PluginNodeManager(webGMESessionId, project, logger, gmeConfig);

                    pluginContext = {
                        activeNode: context.managerConfig.activeNode,
                        activeSelection: context.managerConfig.activeSelection,
                        commitHash: context.managerConfig.commit,
                        branchName: context.managerConfig.branchName
                    };

                    pluginManager.executePlugin(pluginName, context.pluginConfig, pluginContext,
                        function (err, result) {
                            if (err) {
                                logger.error('Plugin failed', pluginName);
                            }
                            storage.close(function (closeErr) {
                                if (closeErr) {
                                    logger.error('error closing storage', closeErr);
                                }
                                callback(err, result ? result.serialize() : null);
                            });
                        }
                    );
                });
            } else {
                errMessage = 'Storage ' + status + ' during plugin execution..';
                logger.error(errMessage);
                storage.close(function (closeErr) {
                    if (closeErr) {
                        logger.error('Problems closing storage', closeErr);
                    }
                    callback(errMessage); //TODO: create pluginResult
                });

            }
        });
    },

    getSeedFromFile = function (name) {
        var i, names;
        if (gmeConfig.seedProjects.enable !== true) {
            return null;
        }

        try {
            for (i = 0; i < gmeConfig.seedProjects.basePaths.length; i++) {
                names = FS.readdirSync(gmeConfig.seedProjects.basePaths[i]);
                if (names.indexOf(name + '.json') !== -1) {
                    return JSON.parse(
                        FS.readFileSync(gmeConfig.seedProjects.basePaths[i] + '/' + name + '.json', 'utf8')
                    );
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    seedProject = function (parameters, callback) {
        var storage = getConnectedStorage(parameters.webGMESessionId),
            finish = function (err) {
                storage.close(function (closeErr) {
                    callback(err || closeErr, result);
                });
            },
            result = {};
        logger.debug('seedProject');

        storage.open(function (networkState) {

            var jsonSeed,
                seedReady = function () {
                    logger.debug('seedProject - seedReady');
                    storage.createProject(parameters.projectName, function (err, projectId) {
                        if (err) {
                            logger.error('empty project creation failed', err);
                            finish(err);
                            return;
                        }
                        storage.openProject(projectId, function (err, project) {
                            var core,
                                rootNode;
                            if (err) {
                                logger.error('Failed to open createdProject', err);
                                finish(err);
                                return;
                            }

                            core = new Core(project, {
                                globConf: gmeConfig,
                                logger: logger.fork('core')
                            });
                            rootNode = core.createNode({parent: null, base: null});

                            Serialization.import(core, rootNode, jsonSeed, function (err) {
                                if (err) {
                                    logger.error('import of seed failed', err);
                                    finish(err);
                                    return;
                                }

                                var persisted = core.persist(rootNode);
                                storage.makeCommit(project.projectId,
                                    null,
                                    [],
                                    persisted.rootHash,
                                    persisted.objects,
                                    'seeding project[' + parameters.seedName + ']',
                                    function (err, commitResult) {
                                        if (err) {
                                            logger.error('makeCommit failed.', err);
                                            finish(err);
                                            return;
                                        }

                                        project.createBranch('master', commitResult.hash, function (err) {
                                            if (err) {
                                                logger.error('setting branch failed', err);
                                                callback(err);
                                            }
                                            logger.info('seeding [' + parameters.seedName +
                                                '] to [' + project.projectId + '] completed');
                                            result = {
                                                projectId: projectId
                                            };
                                            finish(null);
                                        });
                                    }
                                );
                            });
                        });
                    });
                };

            if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                logger.debug('seedProject - storage is connected');
                if (parameters.type === 'file') {
                    logger.debug('seedProject - seeding from file:', parameters.seedName);
                    jsonSeed = getSeedFromFile(parameters.seedName);
                    if (jsonSeed === null) {
                        finish('unknown file seed [' + parameters.seedName + ']');
                    } else {
                        seedReady();
                    }
                    return;
                } else {
                    logger.debug('seedProject - seeding from existing project:', parameters.seedName);
                    parameters.seedBranch = parameters.seedBranch || 'master';
                    storage.openProject(parameters.seedName, function (err, project, branches) {
                        if (err) {
                            logger.error('seedProject - failed to open the existing project',
                                parameters.seedName, err);
                            finish(err);
                            return;
                        }
                        if (branches.hasOwnProperty(parameters.seedBranch) === false) {
                            finish('Branch did not exist [' + parameters.seedBranch + ']');
                            return;
                        }
                        project.loadObject(branches[parameters.seedBranch], function (err, commit) {
                            if (err) {
                                logger.error('seedProject - failed loading commitObject for branch',
                                    parameters.seedBranch, err);
                                finish(err);
                                return;
                            }

                            var core = new Core(project, {
                                globConf: gmeConfig,
                                logger: logger.fork('core')
                            });

                            core.loadRoot(commit.root, function (err, root) {
                                if (err) {
                                    logger.error('seedProject - failed loading root for commit',
                                        parameters.seedBranch, err);
                                    finish(err);
                                    return;
                                }
                                Serialization.export(core, root, function (err, jsonExport) {
                                    if (err) {
                                        logger.error('seedProject - failed loading root for commit',
                                            parameters.seedBranch, err);
                                        finish(err);
                                        return;
                                    }
                                    jsonSeed = jsonExport;
                                    seedReady();
                                });
                            });
                        });
                    });
                }
            } else {
                finish('problems connecting to the webgme server');
            }
        });
    },

    getAddOn = function (name) {
        return requireJS('addon/' + name + '/' + name + '/' + name);
    },

    initConnectedWorker = function (webGMESessionId, userId, addOnName, projectId, branchName, callback) {
        if (!addOnName || !projectId || !branchName) {
            return setImmediate(callback, 'Required parameter was not provided');
        }
        var AddOn = getAddOn(addOnName),
            storage = getConnectedStorage(webGMESessionId);

        _addOn = new AddOn(Core, storage, gmeConfig, logger.fork('addOn_' + addOnName), userId);
        //for the initialization we need the project as well
        storage.open(function (networkStatus) {
            if (networkStatus === STORAGE_CONSTANTS.CONNECTED) {
                logger.debug('starting addon', {metadata: addOnName});
                _addOn.start({
                    projectId: projectId,
                    branchName: branchName,
                    logger: logger.fork(addOnName)
                }, function (err) {
                    var myCallback = callback;
                    callback = function () {
                    };
                    myCallback(err);
                });
            } else {
                storage.close(function (closeErr) {
                    if (closeErr) {
                        logger.error('error closing storage', closeErr);
                    }
                    callback('unable to connect to webgme server');
                });
            }
        });


    },

    connectedWorkerQuery = function (parameters, callback) {
        if (_addOn) {
            _addOn.query(parameters, callback);
        } else {
            callback('the addon is not running');
        }
    },

    connectedworkerStop = function (callback) {
        if (_addOn) {
            logger.debug('stopping addon', {metadata: _addOn.getName()});
            _addOn.stop(function (err) {
                if (err) {
                    return callback(err);
                }
                _addOn = null;
                callback(null);
            });
        } else {
            callback(null);
        }
    },

    autoMerge = function (webGMESessionId, userName, projectId, mine, theirs, callback) {
        var storage = getConnectedStorage(webGMESessionId),
            mergeResult = {},
            finish = function (err) {
                storage.close(function (closeErr) {
                    callback(err || closeErr, mergeResult);
                });
            };
        logger.debug('autoMerge ' + projectId + ' ' + mine + ' -> ' + theirs);

        storage.open(function (networkState) {
            if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                storage.openProject(projectId, function (err, project /*, branches*/) {
                    if (err) {
                        finish(err);
                        return;
                    }

                    merger.merge({
                        project: project,
                        gmeConfig: gmeConfig,
                        logger: logger.fork('merge'),
                        myBranchOrCommit: mine,
                        theirBranchOrCommit: theirs,
                        auto: true
                    })
                        .then(function (result) {
                            mergeResult = result;
                            finish(null);
                        })
                        .catch(finish);
                });
            } else {
                finish('unable to establish connection to webgme');
            }
        });
    },
    resolve = function (webGMESessionId, userName, partial, callback) {
        var storage = getConnectedStorage(webGMESessionId),
            result = {},
            finish = function (err) {
                storage.close(function (closeErr) {
                    callback(err || closeErr, result);
                });
            };
        logger.debug('resolve ' + partial.projectId + ' ' + partial.baseCommitHash + ' -> ' + partial.branchName);
        storage.open(function (networkState) {
            if (networkState === STORAGE_CONSTANTS.CONNECTED) {
                storage.openProject(partial.projectId, function (err, project /*, branches*/) {
                    if (err) {
                        finish(err);
                        return;
                    }

                    merger.resolve({
                        project: project,
                        gmeConfig: gmeConfig,
                        logger: logger.fork('merge'),
                        partial: partial
                    })
                        .then(function (resolve) {
                            result = resolve;
                            finish(null);
                        })
                        .catch(finish);
                });
            } else {
                finish('unable to establish connection to webgme');
            }
        });
    };
//main message processing loop
process.on('message', function (parameters) {
    var resultHandling = function (err, r) {
        r = r || null;
        logger.debug('resultHandling invoked');
        if (err) {
            logger.error('resultHandling called with error', err);
        }

        if (resultRequested === true) {
            logger.debug('result was requested, result:', {metadata: r});
            initResult();
            safeSend({pid: process.pid, type: CONSTANT.msgTypes.result, error: err, result: r});
        } else {
            logger.debug('result was NOT requested, result:', {metadata: r});
            resultReady = true;
            error = err;
            result = r;
        }
    };

    parameters = parameters || {};
    parameters.command = parameters.command || CONSTANT.workerCommands.getResult; //default command

    if (!initialized && parameters.command !== CONSTANT.workerCommands.initialize) {
        return safeSend({
            pid: process.pid,
            type: CONSTANT.msgTypes.request,
            error: 'worker has not been initialized yet',
            resid: null
        });
    }

    if (parameters.command === CONSTANT.workerCommands.initialize) {
        return initialize(parameters);
    }

    logger.debug('Incoming message:', {metadata: parameters});
    if (parameters.command !== CONSTANT.workerCommands.getResult) {
        resultId = GUID();
    }
    if (parameters.command === CONSTANT.workerCommands.dumpMoreNodes) {
        if (typeof parameters.projectId === 'string' &&
            typeof parameters.hash === 'string' &&
            parameters.nodes && parameters.nodes.length) {
            safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: null, resid: resultId});
            dumpMoreNodes(parameters.webGMESessionId, parameters.projectId, parameters.hash, parameters.nodes,
                resultHandling);
        } else {
            initResult();
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'invalid parameters: ' + JSON.stringify(parameters)
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.getResult) {
        if (resultId) {
            if (resultReady === true) {
                var e = error,
                    r = result;

                initResult();
                safeSend({pid: process.pid, type: CONSTANT.msgTypes.result, error: e, result: r});
            } else {
                resultRequested = true;
            }
        } else {
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'no work was started yet',
                resid: null
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.executePlugin) {
        if (gmeConfig.plugin.allowServerExecution) {
            if (typeof parameters.name === 'string' && typeof parameters.context === 'object') {
                executePlugin(parameters.webGMESessionId, parameters.userId, parameters.name, parameters.context,
                    function (err, result) {
                        safeSend({
                            pid: process.pid,
                            type: CONSTANT.msgTypes.result,
                            error: err,
                            result: result
                        });
                    }
                );
            } else {
                initResult();
                safeSend({
                    pid: process.pid,
                    type: CONSTANT.msgTypes.result,
                    error: 'invalid parameters: ' + JSON.stringify(parameters),
                    result: {}
                });
            }
        } else {
            initResult();
            var pluginResult = new PluginResult(),
                pluginMessage = new PluginMessage();
            pluginMessage.severity = 'error';
            pluginMessage.message = 'plugin execution on server side is disabled';
            pluginResult.setSuccess(false);
            pluginResult.pluginName = parameters.name;
            pluginResult.addMessage(pluginMessage);
            pluginResult.setStartTime((new Date()).toISOString());
            pluginResult.setFinishTime((new Date()).toISOString());
            pluginResult.setError(pluginMessage.message);
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.result,
                error: null,
                result: pluginResult.serialize()
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.exportLibrary) {
        if (typeof parameters.projectId === 'string' &&
            (typeof parameters.hash === 'string' ||
            typeof parameters.branchName === 'string' ||
            typeof parameters.commit === 'string') &&
            typeof parameters.path === 'string') {
            safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: null, resid: resultId});
            exportLibrary(parameters.webGMESessionId, parameters.projectId, parameters.hash,
                parameters.branchName, parameters.commit, parameters.path, resultHandling);
        } else {
            initResult();
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'invalid parameters: ' + JSON.stringify(parameters)
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.seedProject) {
        safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: null, resid: resultId});
        seedProject(parameters, resultHandling);
    } else if (parameters.command === CONSTANT.workerCommands.connectedWorkerStart) {
        if (gmeConfig.addOn.enable === true) {
            initConnectedWorker(parameters.webGMESessionId, parameters.userId, parameters.workerName,
                parameters.projectId, parameters.branch,
                function (err) {
                    if (err) {
                        safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: err, resid: null});
                    } else {
                        safeSend({
                            pid: process.pid,
                            type: CONSTANT.msgTypes.request,
                            error: null,
                            resid: process.pid
                        });
                    }
                }
            );
        } else {
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'addOn functionality not enabled',
                resid: null
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.connectedWorkerQuery) {
        if (gmeConfig.addOn.enable === true) {
            connectedWorkerQuery(parameters, function (err, result) {
                safeSend({pid: process.pid, type: CONSTANT.msgTypes.query, error: err, result: result});
            });
        } else {
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'addOn functionality not enabled',
                resid: null
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.connectedWorkerStop) {
        if (gmeConfig.addOn.enable === true) {
            connectedworkerStop(function (err) {
                safeSend({pid: process.pid, type: CONSTANT.msgTypes.result, error: err, result: null});
            });
        } else {
            safeSend({
                pid: process.pid,
                type: CONSTANT.msgTypes.request,
                error: 'addOn functionality not enabled',
                resid: null
            });
        }
    } else if (parameters.command === CONSTANT.workerCommands.autoMerge) {
        safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: null, resid: resultId});
        autoMerge(parameters.webGMESessionId,
            parameters.userId,
            parameters.projectId,
            parameters.mine,
            parameters.theirs,
            resultHandling);
    } else if (parameters.command === CONSTANT.workerCommands.resolve) {
        safeSend({pid: process.pid, type: CONSTANT.msgTypes.request, error: null, resid: resultId});
        resolve(parameters.webGMESessionId,
            parameters.userId,
            parameters.partial,
            resultHandling);
    } else {
        safeSend({
            pid: process.pid,
            type: CONSTANT.msgTypes.request,
            error: 'unknown command',
            resid: null
        });
    }
});

safeSend({pid: process.pid, type: CONSTANT.msgTypes.initialize});

// graceful ending of the child process
process.on('SIGINT', function () {
    if (logger) {
        logger.debug('stopping child process');
    } else {
        //console.error('child was killed without initialization');
        process.exit(1);
    }
});
