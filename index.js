"use strict";
exports.__esModule = true;
var dynamicSheets = {};
var combineKey = "__combine__:";
var separator = "|";
var keyword = "combine";
var isDynamic = function (rule) {
    if (rule.renderer.sheet.options.link) {
        return true;
    }
    var keys = Object.keys(rule);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf("fnStyle") !== -1 ||
            (key.indexOf("fnValues") !== -1 && Object.keys(rule[key]).length)) {
            return true;
        }
    }
    return false;
};
var getDynamicKey = function (rule) {
    var keys = Object.keys(rule);
    var dynamicKeys = [];
    keys.forEach(function (key) {
        if (key.indexOf("fnStyle") !== -1 ||
            (key.indexOf("fnValues") !== -1 && Object.keys(rule[key]).length)) {
            dynamicKeys.push(key);
        }
    });
    if (dynamicKeys.length) {
        return "" + rule.key + separator + dynamicKeys.sort().join("-");
    }
    return false;
};
var replaceClassname = function (key, newClassname, classname) {
    return classname.replace("" + combineKey + key, newClassname);
};
var replaceClassnames = function (key, newClassname, classes) {
    Object.keys(classes).forEach(function (classnameKey) {
        classes[classnameKey] = replaceClassname(key, newClassname, classes[classnameKey]);
    });
};
function registerClass(rule, className) {
    if (!className)
        return true;
    // Support array of class names `{combine: ['foo', 'bar']}`
    if (Array.isArray(className)) {
        for (var index = 0; index < className.length; index++) {
            var isSetted = registerClass(rule, className[index]);
            if (!isSetted)
                return false;
        }
        return true;
    }
    // Support space separated class names `{combine: 'foo bar'}`
    if (className.indexOf(" ") > -1) {
        return registerClass(rule, className.split(" "));
    }
    var parent = rule.options.parent;
    // It is a ref to a local rule.
    if (className[0] === "$") {
        var refRule = parent.getRule(className.substr(1));
        if (!refRule) {
            console.warn("[JSS] Referenced rule is not defined. \n" + rule.toString());
            return false;
        }
        if (refRule === rule) {
            console.warn("[JSS] Cyclic composition detected. \n" + rule.toString());
            return false;
        }
        var dynamicKey = String(getDynamicKey(refRule));
        if (isDynamic(refRule)) {
            dynamicSheets[dynamicKey] = parent;
            parent.classes[rule.key] += " " + parent.classes[refRule.key] + " " + combineKey + dynamicKey;
        }
        else {
            parent.classes[rule.key] += " " + parent.classes[refRule.key];
        }
        return true;
    }
    parent.classes[rule.key] += " " + className;
    return true;
}
function jssCompose() {
    function onProcessStyle(style, rule, sheet) {
        if (!(keyword in style))
            return style;
        registerClass(rule, style[keyword]);
        delete style[keyword];
        return style;
    }
    return {
        onProcessStyle: onProcessStyle,
        onProcessSheet: function (sheet) {
            if (sheet.options.link) {
                sheet.rules.index.forEach(function (rule) {
                    var dynamicKey = String(getDynamicKey(rule));
                    if (dynamicSheets[dynamicKey]) {
                        replaceClassnames(dynamicKey, sheet.classes[dynamicKey.split(separator)[0]], dynamicSheets[dynamicKey].classes);
                        delete dynamicSheets[dynamicKey];
                    }
                });
            }
        }
    };
}
exports["default"] = jssCompose;
