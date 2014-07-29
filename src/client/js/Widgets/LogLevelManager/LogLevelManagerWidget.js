/*globals define, _, requirejs, WebGMEGlobal*/

define(['logManager',
    'js/Controls/DropDownMenu'], function (logManager,
                                           DropDownMenu) {

    "use strict";

    var LogLevelManagerWidget,
        LOG_PREFIX = "LOG: ";

    LogLevelManagerWidget = function (containerEl) {
        this._logger = logManager.create("LogLevelManagerWidget");

        this._statusColors = { "OFF": "BLACK",
            "ERROR": "RED",
            "WARNING": "ORANGE",
            "INFO": "LIGHT_BLUE",
            "DEBUG":"BLUE",
            "ALL": "GRAY"};

        this._el = containerEl;

        //initialize UI
        this._initializeUI();

        this._logger.debug("Created");
    };

    LogLevelManagerWidget.prototype._initializeUI = function () {
        var self = this,
            i;

        this._el.empty();

        this._dropUpMenu = new DropDownMenu({"dropUp": true,
            "pullRight": true,
            "size": "micro"});

        this._dropUpMenu.onItemClicked = function (val) {
            logManager.setLogLevel(logManager.logLevels[val]);
            self._refreshButtonText();
        };

        this._el.append(this._dropUpMenu.getEl());

        this._logLevels = _.extend({}, logManager.logLevels );
        this._logLevelsById = {};

        //get all available log status
        for (i in this._logLevels) {
            if (this._logLevels.hasOwnProperty(i)) {
                this._logLevelsById[this._logLevels[i]] = i;
            }
        }

        for (i in this._logLevelsById) {
            if (this._logLevelsById.hasOwnProperty(i)) {
                this._dropUpMenu.addItem({"text": this._logLevelsById[i],
                    "value": this._logLevelsById[i]});
            }
        }

        this._refreshButtonText();
    };

    LogLevelManagerWidget.prototype._refreshButtonText = function () {
        var currentLogLevel = logManager.getLogLevel();

        this._dropUpMenu.setTitle(LOG_PREFIX + this._logLevelsById[currentLogLevel]);
        this._dropUpMenu.setColor(this._dropUpMenu.COLORS[this._statusColors[this._logLevelsById[currentLogLevel]]]);
    };

    return LogLevelManagerWidget;
});