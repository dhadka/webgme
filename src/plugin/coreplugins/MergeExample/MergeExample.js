/*globals define*/
/*jshint node:true, browser:true*/

/**
 * Generated by PluginGenerator from webgme on Wed Jul 15 2015 15:24:02 GMT-0500 (CDT).
 */

define([
    'plugin/PluginConfig',
    'plugin/PluginBase',
    'common/core/users/merge',
    'q',
    'common/regexp'
], function (PluginConfig, PluginBase, merge, Q, REGEXP) {
    'use strict';

    /**
     * Initializes a new instance of MergeExample.
     * @class
     * @augments {PluginBase}
     * @classdesc This class represents the plugin MergeExample.
     * @constructor
     */
    var MergeExample = function () {
        // Call base class' constructor.
        PluginBase.call(this);
    };

    // Prototypal inheritance from PluginBase.
    MergeExample.prototype = Object.create(PluginBase.prototype);
    MergeExample.prototype.constructor = MergeExample;

    /**
     * Gets the name of the MergeExample.
     * @returns {string} The name of the plugin.
     * @public
     */
    MergeExample.prototype.getName = function () {
        return 'Merge Example';
    };

    /**
     * Gets the semantic version (semver.org) of the MergeExample.
     * @returns {string} The version of the plugin.
     * @public
     */
    MergeExample.prototype.getVersion = function () {
        return '0.1.0';
    };

    /**
     * Gets the description of the MergeExample.
     * @returns {string} The description of the plugin.
     * @public
     */
    MergeExample.prototype.getDescription = function () {
        return 'Example plugin to show how to use the merge capabilities of webgme.';
    };

    /**
     * Gets the configuration structure for the MergeExample.
     * The ConfigurationStructure defines the configuration for the plugin
     * and will be used to populate the GUI when invoking the plugin from webGME.
     * @returns {object} The version of the plugin.
     * @public
     */
    MergeExample.prototype.getConfigStructure = function () {
        return [
            {
                'name': 'mergeFrom',
                'displayName': 'Merge from',
                //'regex': '^[a-zA-Z]+$', // TODO: verify branch or hash
                //'regexMessage': 'Name can only contain English characters!',
                'description': 'Merging changes from this branch or commit hash.',
                'value': 'development',
                'valueType': 'string',
                'readOnly': false
            },
            {
                'name': 'mergeTo',
                'displayName': 'Merge to',
                //'regex': '^[a-zA-Z]+$', // TODO: verify branch or hash
                //'regexMessage': 'Name can only contain English characters!',
                'description': 'Merging changes to this branch or commit hash.',
                'value': 'master',
                'valueType': 'string',
                'readOnly': false
            },
            {
                'name': 'createNewBranch',
                'displayName': 'Create a new branch for target',
                //'regex': '^[a-zA-Z]+$', // TODO: verify branch or hash
                //'regexMessage': 'Name can only contain English characters!',
                'description': 'Creates a new branch for "to" first then merges changes "from"',
                'value': false,
                'valueType': 'boolean',
                'readOnly': false
            },
            {
                'name': 'newBranchName',
                'displayName': 'Name of the new branch',
                'regex': '^[a-zA-Z]+$', // TODO: verify branch or hash
                'regexMessage': 'Name can only contain English characters!',
                'description': 'Name of the new branch where the result of the merge will be stored.',
                'value': 'merge',
                'valueType': 'string',
                'readOnly': false
            }

        ];
    };


    /**
     * Main function for the plugin to execute. This will perform the execution.
     * Notes:
     * - Always log with the provided logger.[error,warning,info,debug].
     * - Do NOT put any user interaction logic UI, etc. inside this method.
     * - callback always has to be called even if error happened.
     *
     * @param {function(string, plugin.PluginResult)} callback - the result callback
     */
    MergeExample.prototype.main = function (callback) {
        // Use self to access core, project, result, logger etc from PluginBase.
        // These are all instantiated at this point.
        var self = this,
            newBranchName;
        // Obtain the current user configuration.
        var currentConfig = self.getCurrentConfig();
        self.logger.info('Current configuration ' + JSON.stringify(currentConfig, null, 4));

        newBranchName = currentConfig.createNewBranch ? currentConfig.newBranchName : null;

        function resolutionStrategy(result) {
            // set the resolution as needed, then return with the object.
            return result;
        }

        //FIXME running on client side will not generate events, so need manual update of the UI afterwards
        self.merge(currentConfig.mergeFrom, currentConfig.mergeTo, newBranchName, resolutionStrategy)
            .then(function (result) {
                // if merged without any conflicts the result structure is
                // result.baseCommitHash
                // result.conflict
                // result.diff
                // result.myCommitHash
                // result.projectId
                // result.targetBranchName
                // result.theirCommitHash
                // result.finalCommitHash

                // if resolved and a branch got updatedthe result structure as follows
                // result.updatedBranch
                // result.hash

                // if resolved and only commit is created the result structure as follows
                // result is a commit hash itself

                var resultHash = result.finalCommitHash || result.hash || result,
                    resultBranch = result.targetBranchName || result.updatedBranch;

                if (resultBranch) {
                    self.createMessage(null, 'Successfully updated branch.', 'info');
                } else {
                    self.createMessage(null, 'Failed to update branch, but merge commit got created ' + resultHash, 'warn');
                }

                self.logger.info(result);

                self.result.setSuccess(true);
                callback(null, self.result);
            })
            .catch(function (err) {
                self.result.setSuccess(false);
                self.result.setError(err.message);
                callback(err, self.result);
            });
    };

    /**
     * Creates a new branch from an existing branch or commit hash if new branch name is given and it is not the same
     * as the branchNameOrCommitHash.
     *
     * @param branchNameOrCommitHash
     * @param newBranchName
     * @returns {*}
     */
    MergeExample.prototype.ensureBranch = function (branchNameOrCommitHash, newBranchName) {
        var self = this,
            deferred = Q.defer(),
            getCommitHash = function (commitOrBranch) {
                var commitDeferred = Q.defer();

                if (REGEXP.HASH.test(commitOrBranch)) {
                    commitDeferred.resolve(commitOrBranch);
                } else {
                    Q.ninvoke(self.project, 'getBranches')
                        .then(function (branches) {
                            commitDeferred.resolve(branches[commitOrBranch]);
                        })
                        .catch(commitDeferred.reject);
                }
                return commitDeferred.promise;
            };

        if (newBranchName && branchNameOrCommitHash !== newBranchName) {
            getCommitHash(branchNameOrCommitHash)
                .then(function (commitHash) {
                    return Q.ninvoke(self.project, 'createBranch', newBranchName, commitHash);
                })
                .then(function () {
                    deferred.resolve(newBranchName);
                })
                .catch(deferred.reject);
        } else {
            deferred.resolve(branchNameOrCommitHash);
        }
        return deferred.promise;
    };

    /**
     * Merges two branches or commits. If the newBranchName is given it creates a new branch for the result.
     *
     * @param mergeFrom {string}
     * @param mergeTo {string}
     * @param newBranchName [string|null]
     * @param resolutionStrategy [Function|null] - defines how the conflicts should be resolved, by default 'mine'
     *                                             is chosen for all conflicts.
     * @returns {*}
     */
    MergeExample.prototype.merge = function (mergeFrom, mergeTo, newBranchName, resolutionStrategy) {
        var self = this;

        // default values
        mergeTo = mergeTo || 'master';
        newBranchName = newBranchName || null;

        if (typeof resolutionStrategy !== 'function') {
            resolutionStrategy = function (result) {
                return result;
            };
        }

        return self.ensureBranch(mergeTo, newBranchName)
            .then(function (mergeTo__) {
                mergeTo = mergeTo__;
                return merge.merge({
                    project: self.project,
                    logger: self.logger,
                    gmeConfig: self.gmeConfig,
                    myBranchOrCommit: mergeFrom,
                    theirBranchOrCommit: mergeTo,
                    auto: true
                });
            })
            .then(function (result) {
                // result.baseCommitHash
                // result.conflict
                // result.diff
                // result.myCommitHash
                // result.projectId
                // result.targetBranchName
                // result.theirCommitHash

                self.logger.info(result);

                if (result.conflict.items.length === 0) {
                    // FIXME: what if it could not update the branch or got a commit hash
                    return result;
                } else {
                    // there was a conflict

                    // resolve
                    return merge.resolve({
                        partial: resolutionStrategy(result),
                        project: self.project,
                        logger: self.logger,
                        gmeConfig: self.gmeConfig,
                        myBranchOrCommit: mergeFrom,
                        theirBranchOrCommit: mergeTo,
                        auto: true
                    });
                }

            });
    };

    return MergeExample;
});