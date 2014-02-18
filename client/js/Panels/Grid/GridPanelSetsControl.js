"use strict";

define(['logManager',
    'clientUtil',
    'js/Constants',
    'js/NodePropertyNames'], function (logManager,
                                    util,
                                    CONSTANTS,
                                    nodePropertyNames) {

    var GridPanelSetsControl;

    GridPanelSetsControl = function (options) {
        var self = this;
        this._client = options.client;
        this._panel = options.panel;
        this._dataGridWidget = options.widget;

        this._dataGridWidget._rowDelete = false;
        this._dataGridWidget._rowEdit = false;

        this._setContainerID = null;

        this._logger = logManager.create("GridPanelSetsControl");

        this._selectedObjectChanged = function (__project, nodeId) {
            self.selectedObjectChanged(nodeId);
        };

        this._logger.debug("Created");
    };

    GridPanelSetsControl.prototype.selectedObjectChanged = function (nodeId) {
        var self = this;

        this._logger.debug("SELECTEDOBJECT_CHANGED nodeId '" + nodeId + "'");

        //remove current territory patterns
        if (this._territoryId) {
            this._client.removeUI(this._territoryId);
            this._dataGridWidget.clear();
        }

        this._setContainerID = nodeId;

        if (this._setContainerID || this._setContainerID === CONSTANTS.PROJECT_ROOT_ID) {
            //put new node's info into territory rules
            this._selfPatterns = {};
            this._selfPatterns[nodeId] = { "children": 0 };

            this._territoryId = this._client.addUI(this, function (events) {
                self._processSetContainer();
            });
            //update the territory
            this._client.updateTerritory(this._territoryId, this._selfPatterns);
        }
    };

    GridPanelSetsControl.prototype.destroy = function () {
        this.detachClientEventListeners();
        this._client.removeUI(this._territoryId);
    };

    GridPanelSetsControl.prototype._processSetContainer = function () {
        var setContainer = this._client.getNode(this._setContainerID),
            setDescriptor,
            setNames,
            i,
            set,
            setMembers,
            j,
            memberRegistryNames,
            k,
            title = " (" + this._setContainerID + ")";

        this._insertList = [];

        if (setContainer) {
            title = (setContainer.getAttribute(nodePropertyNames.Attributes.name) || 'N/A') + title;
            //get set names
            //get set members
            //get set registries

            setNames = setContainer.getSetNames();

            i = setNames.length;
            while (i--) {
                set = setNames[i];
                setMembers = setContainer.getMemberIds(set);

                //fill set names and member list
                setDescriptor = {"ID": set,
                    "Members": setMembers };

                j = setMembers.length;
                while (j--) {
                    //get set registry
                    memberRegistryNames = setContainer.getMemberRegistryNames(set, setMembers[j]);
                    k = memberRegistryNames.length;
                    while (k--) {
                        var setMemberRegName = /*set + '_' + */memberRegistryNames[k];
                        setDescriptor[setMemberRegName] = setDescriptor[setMemberRegName] || [];
                        var keyValue = setMembers[j] + ': ' + JSON.stringify(setContainer.getMemberRegistry(set, setMembers[j], memberRegistryNames[k]));
                        setDescriptor[setMemberRegName].push(keyValue);
                    }
                }

                this._insertList.push(setDescriptor);
            }


            this._dataGridWidget.insertObjects(this._insertList);
        }

        this._panel.setTitle(title);
    };


    GridPanelSetsControl.prototype.attachClientEventListeners = function () {
        this.detachClientEventListeners();
        this._client.addEventListener(this._client.events.SELECTEDOBJECT_CHANGED, this._selectedObjectChanged);
    };

    GridPanelSetsControl.prototype.detachClientEventListeners = function () {
        this._client.removeEventListener(this._client.events.SELECTEDOBJECT_CHANGED, this._selectedObjectChanged);
    };

    return GridPanelSetsControl;
});