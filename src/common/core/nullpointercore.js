/*
 * Copyright (C) 2013 Vanderbilt University, All rights reserved.
 *
 * Author: Tamas Kecskes
 */

define([], function () {
    "use strict";

    var NULLPTR_NAME = "_null_pointer";
    var NULLPTR_RELID = "_nullptr";


    function nullPointerCore (_innerCore) {
        var _core = {};
        for(var i in _innerCore){
            _core[i] = _innerCore[i];
        }

        
        //extra functions
        _core.setPointer = function(node,name, target){
            if(target === null){
                var nullChild = _innerCore.getChild(node,NULLPTR_RELID);
                _innerCore.setAttribute(nullChild,'name',NULLPTR_NAME);
                _innerCore.setPointer(node,name,nullChild);
            } else {
                _innerCore.setPointer(node,name,target);
            }
        };
        _core.getPointerPath = function(node,name){
            var path = _innerCore.getPointerPath(node,name);
            if(path && path.indexOf(NULLPTR_RELID) !== -1){
                return null;
            } else {
                return path;
            }
        };
        _core.loadPointer = function(node,name){
            var path = _core.getPointerPath(node,name);
            if(path === null){
                return null;
            } else {
                return _innerCore.loadPointer(node,name);
            }
        };

        
        return _core;
    }

    return nullPointerCore;
});


