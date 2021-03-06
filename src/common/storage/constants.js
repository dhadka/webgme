/*globals define*/
/*jshint node:true, browser: true*/
/**
 * @author pmeijer / https://github.com/pmeijer
 */

define([], function () {
    'use strict';
    return {

        // Database related
        MONGO_ID: '_id',
        PROJECT_INFO_ID: '*info*',
        EMPTY_PROJECT_DATA: 'empty',
        PROJECT_ID_SEP: '+',
        PROJECT_DISPLAYED_NAME_SEP: '/',

        // Socket IO
        DATABASE_ROOM: 'database',
        ROOM_DIVIDER: '%',
        CONNECTED: 'CONNECTED',
        DISCONNECTED: 'DISCONNECTED',
        RECONNECTED: 'RECONNECTED',

        // Branch commit status - this is the status returned after setting the hash of a branch
        SYNCED: 'SYNCED',
        FORKED: 'FORKED',
        MERGED: 'MERGED', //This is currently not used

        // Events
        PROJECT_DELETED: 'PROJECT_DELETED',
        PROJECT_CREATED: 'PROJECT_CREATED',

        BRANCH_DELETED: 'BRANCH_DELETED',
        BRANCH_CREATED: 'BRANCH_CREATED',
        BRANCH_HASH_UPDATED: 'BRANCH_HASH_UPDATED',

        BRANCH_UPDATED: 'BRANCH_UPDATED'
    };
});
