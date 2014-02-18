"use strict";

define(['logManager',
    'clientUtil',
    'js/Constants',
    'js/Utils/GMEConcepts',
    'js/NodePropertyNames'], function (logManager,
                                       util,
                                       CONSTANTS,
                                       GMEConcepts,
                                       nodePropertyNames) {

    var GraphVizControl,
        MODEL = 'MODEL';

    GraphVizControl = function (options) {
        var self = this;

        this._logger = logManager.create("GraphVizControl");

        this._client = options.client;

        //initialize core collections and variables
        this._graphVizWidget = options.widget;

        this._currentNodeId = null;
        this._currentNodeParentId = undefined;

        this._displayModelsOnly = false;

        this._initWidgetEventHandlers();

        this._selectedObjectChanged = function (__project, nodeId) {
            self.selectedObjectChanged(nodeId);
        };

        this._logger.debug("Created");
    };

    GraphVizControl.prototype._initWidgetEventHandlers = function () {
        var self = this;

        this._graphVizWidget.onBackgroundDblClick = function () {
            if (self._currentNodeParentId) {
                self._client.setSelectedObjectId(self._currentNodeParentId);
            }
        };

        this._graphVizWidget.onNodeOpen = function (id) {
            self._selfPatterns[id] = { "children": 1 };
            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };

        this._graphVizWidget.onNodeDblClick = function (id) {
            self._client.setSelectedObjectId(id);
        };

        this._graphVizWidget.onNodeClose = function (id) {
            var deleteRecursive;

            deleteRecursive = function (nodeId) {
                if (self._selfPatterns.hasOwnProperty(nodeId)) {
                    var node = self._nodes[nodeId];

                    if (node) {
                        var childrenIDs = node.childrenIDs,
                            i = childrenIDs.length;

                        while (i--) {
                            deleteRecursive(childrenIDs[i]);
                        }
                    }

                    delete self._selfPatterns[nodeId];
                }
            };

            //call the cleanup recursively
            deleteRecursive(id);

            if (id === self._currentNodeId) {
                self._selfPatterns[id] = { "children": 0 };
            }

            self._client.updateTerritory(self._territoryId, self._selfPatterns);
        };
    };

    GraphVizControl.prototype.selectedObjectChanged = function (nodeId) {
        var desc = this._getObjectDescriptor(nodeId),
            self = this;

        this._logger.debug("SELECTEDOBJECT_CHANGED nodeId '" + nodeId + "'");

        //remove current territory patterns
        if (this._currentNodeId) {
            this._client.removeUI(this._territoryId);
        }

        this._currentNodeId = nodeId;
        this._currentNodeParentId = undefined;

        this._nodes = {};

        if (this._currentNodeId) {
            //put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = { "children": 0 };

            this._graphVizWidget.setTitle(desc.name.toUpperCase());

            if (desc.parentId) {
                this.$btnModelHierarchyUp.show();
            } else {
                this.$btnModelHierarchyUp.hide();
            }

            this._currentNodeParentId = desc.parentId;

            this._territoryId = this._client.addUI(this, function (events) {
                self._eventCallback(events);
            });
            //update the territory
            this._client.updateTerritory(this._territoryId, this._selfPatterns);

            setTimeout(function () {
                self._selfPatterns[nodeId] = { "children": 1 };
                self._client.updateTerritory(self._territoryId, self._selfPatterns);
            }, 1000);
        }
    };

    GraphVizControl.prototype._getObjectDescriptor = function (nodeId) {
        var nodeObj = this._client.getNode(nodeId),
            objDescriptor;

        if (nodeObj) {
            objDescriptor = {'id': undefined,
                             'name': undefined,
                             'childrenIDs': undefined,
                             'parentId': undefined,
                             'isConnection': false};

            objDescriptor.id = nodeObj.getId();
            objDescriptor.name =  nodeObj.getAttribute(nodePropertyNames.Attributes.name);
            objDescriptor.childrenIDs = nodeObj.getChildrenIds();
            objDescriptor.childrenNum = objDescriptor.childrenIDs.length;
            objDescriptor.parentId = nodeObj.getParentId();
            objDescriptor.isConnection = GMEConcepts.isConnection(nodeId);
        }

        return objDescriptor;
    };

    GraphVizControl.prototype._eventCallback = function (events) {
        var i = events ? events.length : 0,
            e;

        this._logger.debug("_eventCallback '" + i + "' items");

        while (i--) {
            e = events[i];
            switch (e.etype) {
                case CONSTANTS.TERRITORY_EVENT_LOAD:
                    this._onLoad(e.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UPDATE:
                    this._onUpdate(e.eid);
                    break;
                case CONSTANTS.TERRITORY_EVENT_UNLOAD:
                    this._onUnload(e.eid);
                    break;
            }
        }

        this._generateData();

        this._logger.debug("_eventCallback '" + events.length + "' items - DONE");
    };

    GraphVizControl.prototype._generateData = function () {
        var self = this;

        var data = _.extend({}, this._currentNodeId ? this._nodes[this._currentNodeId] : {});

        var loadRecursive = function (node) {
            var len = (node && node.childrenIDs) ? node.childrenIDs.length : 0;
            while (len--) {
                node.children = node.children || [];
                if (self._nodes[node.childrenIDs[len]]) {
                    if ((self._displayModelsOnly === true && self._nodes[node.childrenIDs[len]].isConnection !== true) ||
                        self._displayModelsOnly === false) {
                        node.children.push(_.extend({}, self._nodes[node.childrenIDs[len]]));
                        loadRecursive(node.children[node.children.length-1]);
                    }
                }
            }
        };
        loadRecursive(data);

        this._graphVizWidget.setData(data);
    };

    // PUBLIC METHODS
    GraphVizControl.prototype._onLoad = function (gmeID) {
        this._nodes[gmeID] = this._getObjectDescriptor(gmeID);
    };

    GraphVizControl.prototype._onUpdate = function (gmeID) {
        this._nodes[gmeID] = this._getObjectDescriptor(gmeID);
    };

    GraphVizControl.prototype._onUnload = function (gmeID) {
        delete this._nodes[gmeID];
    };

    GraphVizControl.prototype.destroy = function () {
        this._detachClientEventListeners();
    };

    GraphVizControl.prototype._attachClientEventListeners = function () {
        this._detachClientEventListeners();
        this._client.addEventListener(this._client.events.SELECTEDOBJECT_CHANGED, this._selectedObjectChanged);
    };

    GraphVizControl.prototype._detachClientEventListeners = function () {
        this._client.removeEventListener(this._client.events.SELECTEDOBJECT_CHANGED, this._selectedObjectChanged);
    };

    GraphVizControl.prototype.onActivate = function () {
        this._attachClientEventListeners();
        this._displayToolbarItems();
    };

    GraphVizControl.prototype.onDeactivate = function () {
        this._detachClientEventListeners();
        this._hideToolbarItems();
    };

    GraphVizControl.prototype._displayToolbarItems = function () {
        if (this._toolbarInitialized !== true) {
            this._initializeToolbar();
        } else {
            for (var i = 0; i < this._toolbarItems.length; i++) {
                this._toolbarItems[i].show();
            }
        }
    };

    GraphVizControl.prototype._hideToolbarItems = function () {
        if (this._toolbarInitialized === true) {
            for (var i = 0; i < this._toolbarItems.length; i++) {
                this._toolbarItems[i].hide();
            }
        }
    };

    GraphVizControl.prototype._removeToolbarItems = function () {
        if (this._toolbarInitialized === true) {
            for (var i = 0; i < this._toolbarItems.length; i++) {
                this._toolbarItems[i].destroy();
            }
        }
    };

    GraphVizControl.prototype._initializeToolbar = function () {
        var toolBar = WebGMEGlobal.Toolbar,
            self = this;

        this._toolbarItems = [];

        this._toolbarItems.push(toolBar.addSeparator());

        /************** GOTO PARENT IN HIERARCHY BUTTON ****************/
        this.$btnModelHierarchyUp = toolBar.addButton({
            "title": "Go to parent",
            "icon": "icon-circle-arrow-up",
            "clickFn": function (/*data*/) {
                self._client.setSelectedObjectId(self._currentNodeParentId);
            }
        });
        this._toolbarItems.push(this.$btnModelHierarchyUp);
        this.$btnModelHierarchyUp.hide();
        /************** END OF - GOTO PARENT IN HIERARCHY BUTTON ****************/

        /************** MODEL / CONNECTION filter *******************/
        this.$lblShowConnection = toolBar.addLabel();
        this.$lblShowConnection.text('SHOW CONNECTIONS:');
        this._toolbarItems.push(this.$lblShowConnection);

        this.$cbShowConnection = toolBar.addCheckBox({ "title": "Go to parent",
            "checkChangedFn": function(data, checked){
                self._displayModelsOnly = !checked;
                self._generateData();
            }
        });
        this._toolbarItems.push(this.$cbShowConnection);
        /************** END OF - MODEL / CONNECTION filter *******************/


        this._toolbarInitialized = true;
    };

    return GraphVizControl;
});