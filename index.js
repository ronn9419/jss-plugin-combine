const dynamicSheets = {};
const combineKey = "__combine__:";
const separator = "|";
const keyword = "combine";

const isDynamic = rule => {
  if (rule.renderer.sheet.options.link) {
    return true;
  }

  const keys = Object.keys(rule);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (
      key.indexOf("fnStyle") !== -1 ||
      (key.indexOf("fnValues") !== -1 && Object.keys(rule[key]).length)
    ) {
      return true;
    }
  }

  return false;
};

const getDynamicKey = rule => {
  const keys = Object.keys(rule);

  const dynamicKeys = [];

  keys.forEach(key => {
    if (
      key.indexOf("fnStyle") !== -1 ||
      (key.indexOf("fnValues") !== -1 && Object.keys(rule[key]).length)
    ) {
      dynamicKeys.push(key);
    }
  });

  if (dynamicKeys.length) {
    return `${rule.key}${separator}${dynamicKeys.sort().join("-")}`;
  }

  return false;
};

const replaceClassname = (key, newClassname, classname) => {
  return classname.replace(`${combineKey}${key}`, newClassname);
};

const replaceClassnames = (key, newClassname, classes) => {
  Object.keys(classes).forEach(classnameKey => {
    classes[classnameKey] = replaceClassname(
      key,
      newClassname,
      classes[classnameKey]
    );
  });
};

function registerClass(rule, className, sheet) {
  if (!className) return true;

  // Support array of class names `{combine: ['foo', 'bar']}`
  if (Array.isArray(className)) {
    for (let index = 0; index < className.length; index++) {
      const isSetted = registerClass(rule, className[index]);
      if (!isSetted) return false;
    }

    return true;
  }

  // Support space separated class names `{combine: 'foo bar'}`
  if (className.indexOf(" ") > -1) {
    return registerClass(rule, className.split(" "));
  }

  const { parent } = rule.options;

  // It is a ref to a local rule.
  if (className[0] === "$") {
    const refRule = parent.getRule(className.substr(1));

    window.refRule = refRule;
    window.parentRule = parent;

    if (!refRule) {
      console.warn(
        `[JSS] Referenced rule is not defined. \n${rule.toString()}`
      );
      return false;
    }

    if (refRule === rule) {
      console.warn(`[JSS] Cyclic composition detected. \n${rule.toString()}`);
      return false;
    }

    const dynamicKey = getDynamicKey(refRule);

    if (isDynamic(refRule)) {
      dynamicSheets[dynamicKey] = parent;

      parent.classes[rule.key] += ` ${
        parent.classes[refRule.key]
      } ${combineKey}${dynamicKey}`;
    } else {
      parent.classes[rule.key] += ` ${parent.classes[refRule.key]}`;
    }

    return true;
  }

  parent.classes[rule.key] += ` ${className}`;

  return true;
}

export default function jssCompose() {
  function onProcessStyle(style, rule, sheet) {
    if (!(keyword in style)) return style;

    registerClass(rule, style[keyword], sheet);
    delete style[keyword];
    return style;
  }
  return {
    onProcessStyle,
    onProcessSheet: sheet => {
      if (sheet.options.link) {
        sheet.rules.index.forEach(rule => {
          const dynamicKey = getDynamicKey(rule);

          if (dynamicSheets[dynamicKey]) {
            replaceClassnames(
              dynamicKey,
              sheet.classes[dynamicKey.split(separator)[0]],
              dynamicSheets[dynamicKey].classes
            );

            delete dynamicSheets[dynamicKey];
          }
        });
      }
    }
  };
}
