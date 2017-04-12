var WD = require("webdriver-client");
var _ = require("lodash");

const ANDROID_ID_PREFIX = "com.alibaba.weex:id/";
const ANDROID_INFO_ID = ANDROID_ID_PREFIX + "container";
const XPATH_PREFIX = {
  android: "//android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.View[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]",
  ios: "//XCUIElementTypeApplication[1]/XCUIElementTypeWindow[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]",
  web: "//body"
};
const NODE_PATTERN = /([a-z-]+)(\[(\d+)\])?/;

const NODE_MAP = {
  android: {
    text: "android.view.View",
    textarea: "android.widget.EditText",
    input: "android.widget.EditText",
    a: "android.view.View",
    image: "android.widget.ImageView",
    video: "android.widget.VideoView",
    web: "android.webkit.WebView",
    waterfall: "android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.support.v7.widget.RecyclerView",
    recycler: "android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.support.v7.widget.RecyclerView",
    list: "android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.support.v7.widget.RecyclerView",
    scroller: "android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.widget.ScrollView[1]/android.widget.FrameLayout",
    div: "android.widget.FrameLayout",
    _default: node => {
      return "android.widget.FrameLayout";
    }
  },
  ios: {
    input: "XCUIElementTypeTextField",
    textarea: "XCUIElementTypeTextView",
    text: "XCUIElementTypeStaticText",
    list: "XCUIElementTypeTable",
    waterfall: "XCUIElementTypeCollectionView",
    recycler: "XCUIElementTypeCollectionView",
    scroller: "XCUIElementTypeScrollView",
    cell: "XCUIElementTypeCell",
    div: "XCUIElementTypeOther",
    _default: node => {
      return "XCUIElementTypeOther";
    }
  },
  web: {
    text: "p",
    _default: node => {
      return node;
    }
  }
};

function mapFunc(node, platformName) {
  let map;
  if ((map = NODE_MAP[platformName]) == undefined) {
    throw new Error("platform not found");
  }

  if (!map[node]) {
    return map._default(node);
  } else {
    return map[node];
  }
}

function mapXPath(xpath, target) {
  var results = [XPATH_PREFIX[target]];
  var parts = xpath.split("/");
  var length = parts.length;
  _.map(parts, function(part, index) {
    if (!part || part.length == 0) {
      return;
    }

    var nodeParts = part.match(NODE_PATTERN);
    if (!nodeParts) {
      return;
    }
    //ignore last, for multiple item find
    var pos = nodeParts[3] === undefined
      ? index == length - 1 ? "" : "[1]"
      : "[" + nodeParts[3] + "]";
    results.push(mapFunc(nodeParts[1], target) + pos);
  });

  return results.join("/");
}

var _wIsIOS, _slowEnv, _target;

module.exports = function(opts) {
  var wd = WD(opts);
  _target = opts["target"];
  _wIsIOS = opts["platformName"] === "iOS";
  _slowEnv = opts["slowEnv"];

  wd.addPromiseChainMethod("wBack", function() {
    return _wIsIOS
      ? this.elementByName("back").sleep(1000).click().sleep(1000)
      : this._back();
  });

  wd.addPromiseChainMethod("wGet", function(url) {
    if (_wIsIOS) {
      return this._get(url)
        .catch(function(e) {
          console.log("catch in get");
        })
        .then();
    } else {
      return this._get(url);
    }
  });

  wd.addPromiseChainMethod("wElementsByXPath", function(xpath) {
    return this._elementsByXPath(mapXPath(xpath, _target));
  });

  wd.addPromiseChainMethod("wElements", function(xpath) {
    return this.wElementsByXPath(xpath);
  });

  wd.addPromiseChainMethod("wElement", function(xpath) {
    return this.wElements(xpath).then(function(el) {
      return el[0];
    });
  });

  wd.addPromiseChainMethod(
    "wWaitForElementByXPath",
    function(xpath, time, interval) {
      return this._waitForElementByXPath(
        mapXPath(xpath, _target),
        time,
        interval
      );
    }
  );

  var _initPromiseChain = wd.initPromiseChain;
  wd.initPromiseChain = function() {
    var ins = _initPromiseChain.apply(this);

    if (_slowEnv) {
      ins._initDriver = ins.initDriver;
      ins._initFailedCount = 0;
      ins.initDriver = function() {
        var self = this;
        if (ins._initFailedCount >= 4) {
          console.error("last retry");
          return ins._initDriver.apply(self);
        } else {
          return ins._initDriver.apply(self).catch(function(e) {
            ins._initFailedCount++;
            console.error("init failed, retry later");
            return ins.sleep(1000).initDriver();
          });
        }
      };
    }

    const wrapElem = function(d) {
      if (d != undefined) {
        d._text = d.text;
        if (_target === "ios") {
          d.text = function() {
            return d.getProperty("value");
          };
        } else if (_target === "android") {
          d.text = function() {
            return d.getProperty("description").then(obj => {
              return obj.description;
            });
          };
        } else if (_target === "web") {
          const NonBreakSpace = String.fromCharCode(160);
          d.text = function() {
            return d._text().then(text => {
              return text.replace(NonBreakSpace, " ");
            });
          };
        }

        if (_slowEnv) {
          d._click = d.click;
          d.click = function(time) {
            return d._click(time).sleep(5000);
          };
        }
      }
      return d;
    };

    //elementById
    ins._elementsById = ins.elementsById;
    let _androidIdMap = {};
    if (_target == "android") {
      setInterval(function(){
        ins._elementsById(ANDROID_INFO_ID)
        .then(elems => {
          return elems[0];
        })
        .getProperty("description")
        .then(data => {
            _androidIdMap = JSON.parse(data.description);
          });
      },2000)

      ins.elementsById = function(id) {
        return this
        ._elementsById(ANDROID_ID_PREFIX + _androidIdMap[id])
      };
    }

    ins._elementById = ins.elementById;
    ins.elementById = function(id) {
      return this.elementsById(id)
        .then(function(el) {
          return el[0];
        })
        .then(wrapElem);
    };

    //waitForElementById
    if (_target === "android") {
      ins._waitForElementById = ins.waitForElementById;
      const waitForIdMap = function(ins, id, time, interval, retry) {
        return ins.sleep(2000).waitForElementById(id, time, interval, retry);
      };
      ins.waitForElementById = function(id, time, interval, retry) {
        if (!retry) {
          retry = 0;
        }
        if(_androidIdMap[id] != undefined){
          console.log("native id found.");
          return this._waitForElementById(ANDROID_ID_PREFIX + _androidIdMap[id]);
        }else if(retry<5){
          console.log("wait for id map");
          return waitForIdMap(this, id, time, interval, ++retry);
        }else{
          throw new Error("native id not found, retry over limit.")
        }
      };
    }

    //elementsByXPath
    var _elementsByXPath = ins.elementsByXPath;
    ins.elementsByXPath = function(path) {
      return this.wElements(path);
    };
    ins._elementsByXPath = _elementsByXPath;

    //elementsByXPath
    var _elementByXPath = ins.elementByXPath;
    ins.elementByXPath = function(path) {
      return this.wElement(path).then(wrapElem);
    };
    ins._elementByXPath = _elementByXPath;

    //waitForElementByXPath
    var _waitForElementByXPath = ins.waitForElementByXPath;
    ins.waitForElementByXPath = function(path, time, interval) {
      return this.wWaitForElementByXPath(path, time, interval);
    };
    ins._waitForElementByXPath = _waitForElementByXPath;

    //back
    var _back = ins.back;
    ins.back = function() {
      if (_slowEnv) {
        return this.wBack().sleep(5000);
      }
      return this.wBack();
    };
    ins._back = _back;

    //get
    /**
     * execute get will throw err in iOS
     */
    var _get = ins.get;
    ins.get = function(url) {
      if (_slowEnv) {
        return this.wGet(url).sleep(5000);
      }
      return this.wGet(url);
    };
    ins._get = _get;

    /**
     * add retry in slow _slowEnv
     */
    if (_slowEnv) {
      const _elemFailLimit = 10;
      ins._elements = ins.elements;
      ins._elemFailCount = 0;
      ins.elements = function() {
        var self = this;
        var args = arguments;
        if (ins._elemFailCount >= _elemFailLimit - 1) {
          console.error("last retry");
          return ins._elements.apply(self, args);
        } else {
          return ins._elements.apply(self, args).catch(function(e) {
            console.log("catched,retry again");
            ins._elemFailCount++;
            return ins.sleep(1000).then(() => {
              return ins.elements.apply(self, args);
            });
          });
        }
      };
    }

    return ins;
  };

  return wd;
};
