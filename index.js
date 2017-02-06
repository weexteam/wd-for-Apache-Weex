var WD = require('webdriver-client');
var _ = require('lodash');

var xPathPrefixForAndroid = '//android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.widget.LinearLayout[1]/android.widget.FrameLayout[1]/android.view.View[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]/android.widget.FrameLayout[1]';
var xPathPrefixForIOS = '';
var NODE_PATTERN = /([a-z-]+)(\[(\d+)\])?/;

function mapFunc(node, isIOS){
  if(isIOS){
    return;
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
    case "div":
    default:
      return "android.widget.FrameLayout";
  }
}

function mapXPath(xpath, isIOS){
  var results = [isIOS ? xPathPrefixForIOS : xPathPrefixForAndroid];
  var parts = xpath.split('/');
  _.map(parts, function(part){
    if(!part || part.length==0){
      return
    }

    var nodeParts = part.match(NODE_PATTERN);
    if(!nodeParts){
      return
    }
    var pos = nodeParts[3] === undefined ? '' : "[" + nodeParts[3] + "]";
    results.push(mapFunc(nodeParts[1]) + pos, isIOS);
  });

  var oo = results.join('/');

  return oo.substring(0, oo.length -1);
}


module.exports = function(opts){
  var wd = WD(opts);
  wd.addPromiseChainMethod('wBack', function(){
    return this._wIsIOS ?
      this.elementByName('back').sleep(1000).click().sleep(1000) :
      this._back();
  });

  wd.addPromiseChainMethod('wGet', function (url) {
    if(this._wIsIOS){
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
    return this._elementsByXPath(mapXPath(xpath));
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

  wd.addPromiseChainMethod('wText', function(xpath) {
    return this._wIsIOS ?
      this
        .wElement(xpath)
        .text() :
      this
        .wElement(xpath)
        .getProperty('description');
  });

  var _initPromiseChain = wd.initPromiseChain;
  wd.initPromiseChain = function(){
    var ins = _initPromiseChain.apply(this);

    ins._wIsIOS = opts['platformName'] === 'iOS';
    ins._wIsAndroid = opts['platformName'] === 'Android';

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
          var _text = d.text;
          d.text = function(){
            return ins._wIsAndroid ? d.getProperty('description') : _text.call(d);
          };
          return d;
        })

    };
    ins._elementByXPath = _elementByXPath;

    //back
    var _back = ins.back;
    ins.back = function(){
      return this.wBack();
    };
    ins._back = _back;

    //get 
    /**
     * execute get will throw err in iOS
     */
    var _get = ins.get;
    ins.get = function(url){
      return this.wGet(url);
    };

    return ins;
  };


  return wd;
};
