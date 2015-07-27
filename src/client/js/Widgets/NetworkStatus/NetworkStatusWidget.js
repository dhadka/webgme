/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 */


define([
    'js/logger',
    'js/Controls/DropDownMenu',
    'js/Controls/PopoverBox',
    'js/Constants'
], function (Logger, DropDownMenu, PopoverBox, CONSTANTS) {

    'use strict';

    var NetworkStatusWidget,
        ITEM_VALUE_CONNECT = 'connect';

    NetworkStatusWidget = function (containerEl, client) {
        this._logger = Logger.create('gme:Widgets:NetworkStatus:NetworkStatusWidget',
            WebGMEGlobal.gmeConfig.client.log);

        this._client = client;
        this._el = containerEl;

        this._initializeUI();

        this._logger.debug('Created');
    };

    NetworkStatusWidget.prototype._initializeUI = function () {
        var self = this,
            initialStatus = this._client.getNetworkStatus();

        this._el.empty();

        //#1 - NetworkStatus
        this._ddNetworkStatus = new DropDownMenu({
            dropUp: true,
            pullRight: true,
            size: 'micro',
            sort: true
        });
        this._ddNetworkStatus.setTitle('NETWORKSTATUS');

        this._el.append(this._ddNetworkStatus.getEl());

        this._ddNetworkStatus.onItemClicked = function (value) {
            if (value === ITEM_VALUE_CONNECT) {
                //self._client.connect();
            }
        };

        this._client.addEventListener(CONSTANTS.CLIENT.NETWORK_STATUS_CHANGED, function (client, networkStatus) {
            self._refreshNetworkStatus(networkStatus);
        });

        this._refreshNetworkStatus(initialStatus);
    };

    NetworkStatusWidget.prototype._refreshNetworkStatus = function (status) {
        this._logger.debug('_refreshNetworkStatus', status);
        switch (status) {
            case CONSTANTS.CLIENT.STORAGE.CONNECTED:
                this._modeConnected();
                break;
            case CONSTANTS.CLIENT.STORAGE.RECONNECTED:
                this._modeReconnected();
                break;
            case CONSTANTS.CLIENT.STORAGE.DISCONNECTED:
                this._modeDisconnected();
                break;
        }
    };

    NetworkStatusWidget.prototype._modeConnected = function () {
        this._ddNetworkStatus.clear();
        this._ddNetworkStatus.setTitle('CONNECTED');
        this._ddNetworkStatus.setColor(DropDownMenu.prototype.COLORS.GREEN);

        if (this._disconnected === true) {
            this._popoverBox.show('Connected to the server',
                this._popoverBox.alertLevels.SUCCESS, true);
            delete this._disconnected;
        }
    };

    NetworkStatusWidget.prototype._modeReconnected = function () {
        this._ddNetworkStatus.clear();
        this._ddNetworkStatus.setTitle('RECONNECTED');
        this._ddNetworkStatus.setColor(DropDownMenu.prototype.COLORS.GREEN);

        if (this._disconnected === true) {
            this._popoverBox.show('Connection to the server has been restored...',
                this._popoverBox.alertLevels.SUCCESS, true);
            delete this._disconnected;
        }
    };

    NetworkStatusWidget.prototype._modeDisconnected = function () {
        this._ddNetworkStatus.clear();
        this._ddNetworkStatus.setTitle('DISCONNECTED');
        this._ddNetworkStatus.addItem({
            text: 'Connect...',
            value: ITEM_VALUE_CONNECT
        });
        this._ddNetworkStatus.setColor(DropDownMenu.prototype.COLORS.ORANGE);

        this._disconnected = true;
        this._popoverBox = this._popoverBox || new PopoverBox(this._ddNetworkStatus.getEl());
        this._popoverBox.show('Connection to the server has been lost...', this._popoverBox.alertLevels.WARNING, false);
    };

    return NetworkStatusWidget;
});