/*globals define, _, $*/
/*jshint browser: true*/
/**
 * @author rkereskenyi / https://github.com/rkereskenyi
 */

define(['js/Controls/PropertyGrid/Widgets/WidgetBase'], function (WidgetBase) {

    'use strict';

    var LabelWidget,
        LABEL_BASE = $('<span/>', {class: 'user-select-on'});

    LabelWidget = function (propertyDesc) {
        LabelWidget.superclass.call(this, propertyDesc);

        this.__label = LABEL_BASE.clone();

        this.updateDisplay();

        this.el.append(this.__label);
    };

    LabelWidget.superclass = WidgetBase;

    _.extend(LabelWidget.prototype, WidgetBase.prototype);

    LabelWidget.prototype.updateDisplay = function () {
        this.__label.text(this.propertyValue);
        this.__label.attr('title', this.propertyValue);
        return LabelWidget.superclass.prototype.updateDisplay.call(this);
    };

    return LabelWidget;

});