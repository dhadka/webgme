"use strict";

define(['js/Utils/GMEConcepts',
    'js/DragDrop/DragHelper',
    'js/NodePropertyNames',
    'js/RegistryKeys',
    './../Crosscut/CrosscutConstants',
    'js/Panels/ControllerBase/DiagramDesignerWidgetMultiTabMemberListControllerBase'], function (
                                               GMEConcepts,
                                               DragHelper,
                                               nodePropertyNames,
                                               REGISTRY_KEYS,
                                               ManualAspectConstants,
                                               DiagramDesignerWidgetMultiTabMemberListControllerBase) {

    var SetEditorController;

    SetEditorController = function (options) {
        options = options || {};
        options.loggerName = "SetEditorController";

        DiagramDesignerWidgetMultiTabMemberListControllerBase.call(this, options);

        this.logger.debug("SetEditorController ctor finished");
    };

    _.extend(SetEditorController.prototype, DiagramDesignerWidgetMultiTabMemberListControllerBase.prototype);

    SetEditorController.prototype.getOrderedMemberListInfo = function (memberListContainerObject) {
        var result = [],
            memberListContainerID = this._memberListContainerID,
            setNames = GMEConcepts.getSets(memberListContainerID),
            len;

        len = setNames.length;
        while (len--) {
            result.push({'memberListID': setNames[len],
                'title': setNames[len],
                'enableDeleteTab': false,
                'enableRenameTab': false});
        }

        result.sort(function (a,b) {
            if (a.title.toLowerCase() < b.title.toLowerCase()) {
                return -1;
            } else {
                return 1;
            }
        });

        return result;
    };


    /**********************************************************/
    /*         HANDLE OBJECT DRAG & DROP ACCEPTANCE           */
    /**********************************************************/
    SetEditorController.prototype._onBackgroundDroppableAccept = function(event, dragInfo) {
        var gmeIDList = DragHelper.getDragItems(dragInfo),
            accept = DiagramDesignerWidgetMultiTabMemberListControllerBase.prototype._onBackgroundDroppableAccept.call(this, event, dragInfo);

        if (accept === true) {
            //if based on the DiagramDesignerWidgetMultiTabMemberListControllerBase check it could be accepted, ie items are not members of the set so far
            //we need to see if we can accept them based on the META rules
            accept = GMEConcepts.canAddToSet(this._memberListContainerID, this._selectedMemberListID, gmeIDList);
        }

        return accept;
    };
    /**********************************************************/
    /*  END OF --- HANDLE OBJECT DRAG & DROP ACCEPTANCE       */
    /**********************************************************/

    /*
     * Overwrite 'no tab' warning message to the user
     */
    SetEditorController.prototype.displayNoTabMessage = function () {
        var msg = 'The currently selected object does not contain any sets.';

        this._widget.setBackgroundText(msg);
    };

    return SetEditorController;
});
