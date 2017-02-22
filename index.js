var WD = require('webdriver-client');
var _ = require('lodash');

var xPathPrefixForAndroid = '//android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.View[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]';
var xPathPrefixForIOS = "//XCUIElementTypeApplication[1]/XCUIElementTypeWindow[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]/XCUIElementTypeOther[1]"
var NODE_PATTERN = /([a-z-]+)(\[(\d+)\])?/;

function mapFunc(node, isIOS){
  if(isIOS){
    switch (node) {
      case "input":
        return "XCUIElementTypeTextField";
      case "text":
        return "XCUIElementTypeStaticText";
      case "list":
        return "XCUIElementTypeTable"
      case "div":
      default:
        return "XCUIElementTypeOther"
     }
  }

  switch(node){
    case "text":
      return "android.view.View";
    case "textarea":
      return "android.widget.EditText";
    case "input":
      return "android.widget.EditText";
    case "a":
      return "android.view.View";
    case "image":
      return "android.widget.ImageView";
    case "video":
      return "android.widget.VideoView";
    case "web":
      return "android.webkit.WebView";
    case "list":
      return "android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.support.v7.widget.RecyclerView";
    case "div":
    default:
      return "android.widget.FrameLayout";
  }
}

function mapXPath(xpath, isIOS){
  var results = [isIOS ? xPathPrefixForIOS : xPathPrefixForAndroid];
  var parts = xpath.split('/');
  var length = parts.length;
  _.map(parts, function(part,index){
    if(!part || part.length==0){
      return
    }

    var nodeParts = part.match(NODE_PATTERN);
    if(!nodeParts){
      return
    }
    //ignore last, for multiple item find
    var pos = nodeParts[3] === undefined ? (index == length-1?'':'[1]') : "[" + nodeParts[3] + "]";
    results.push(mapFunc(nodeParts[1], isIOS) + pos);
  });

  return results.join('/');
}

var _wIsIOS,_slowEnv;

module.exports = function(opts){
  var wd = WD(opts);
  _wIsIOS = opts['platformName'] === 'iOS';
  _slowEnv = opts['slowEnv'];

  wd.addPromiseChainMethod('wBack', function(){
    return _wIsIOS ?
      this.elementByName('back').sleep(1000).click().sleep(1000) :
      this._back();
  });

  wd.addPromiseChainMethod('wGet', function (url) {
    if(_wIsIOS){
      return this
            ._get(url)
            .catch(function (e) {
                console.log("catch in get")
            })
            .then();
    }else{
      return this._get(url);
    }
  });


  wd.addPromiseChainMethod('wElementsByXPath',function(xpath){
    return this._elementsByXPath(mapXPath(xpath,_wIsIOS));
  });

  wd.addPromiseChainMethod('wElements',function(xpath){
    return this.wElementsByXPath(xpath);
  });

  wd.addPromiseChainMethod('wElement',function(xpath){
    return this
      .wElements(xpath)
      .then(function(el){
        return el[0];
      });
  });

  wd.addPromiseChainMethod('wWaitForElementByXPath',function(xpath,time,interval){
    return this._waitForElementByXPath(mapXPath(xpath,_wIsIOS),time,interval);
  });

  var _initPromiseChain = wd.initPromiseChain;
  wd.initPromiseChain = function(){
    var ins = _initPromiseChain.apply(this);

    if(_slowEnv){
      ins._initDriver = ins.initDriver
      ins._initFailedCount = 0;
      ins.initDriver = function(){
        var self = this;
        if(ins._initFailedCount >= 4){
          console.error("last retry")
          return ins._initDriver.apply(self);
        }else{
          return ins._initDriver.apply(self)
            .catch(function(e){
              ins._initFailedCount++;
              console.error("init failed, retry later");
              return ins.sleep(1000).initDriver();
            })
        }
      }
    }

    //elementsByXPath
    var _elementsByXPath = ins.elementsByXPath;
    ins.elementsByXPath = function(path){
      return this.wElements(path);
    };
    ins._elementsByXPath = _elementsByXPath;

    //elementsByXPath
    var _elementByXPath = ins.elementByXPath;
    ins.elementByXPath = function(path){
      return this.wElement(path)
        .then(function(d){
          if(d != undefined){
            var _text = d.text;
            d.text = _wIsIOS?function(){
              return d.getProperty('value');
            }:function(){
              return  d.getProperty('description').then((obj)=>{ return obj.description});
            };

            if(_slowEnv){
              d._click = d.click;
              d.click = function(time){
                return d._click(time).sleep(5000);
              }
            }
          }
          return d;
        })

    };
    ins._elementByXPath = _elementByXPath;

    //waitForElementByXPath
    var _waitForElementByXPath = ins.waitForElementByXPath;
    ins.waitForElementByXPath = function(path,time,interval){
      return this.wWaitForElementByXPath(path,time,interval);
    }
    ins._waitForElementByXPath = _waitForElementByXPath;

    //back
    var _back = ins.back;
    ins.back = function(){
      if(_slowEnv){
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
    ins.get = function(url){
      if(_slowEnv){
        return this.wGet(url).sleep(5000);
      }
      return this.wGet(url);
    };
    ins._get = _get;

    return ins;
  };


  return wd;
};