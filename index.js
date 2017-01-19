var wd = require('macaca-wd');
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

  return results.join('/')
}

_.mapKeys({
  promiseChainRemote: wd.promiseChainRemote,
  promiseRemote: wd.promiseRemote,
  asyncRemote: wd.asyncRemote
}, function(func, method){
  wd[method] = function(){
    var instance = func.apply(wd, arguments);
    var instanceInit = instance.init;
    instance['init'] = function(){
      var args = [].slice.call(arguments, 0);
      instance._wIsIOS = args[0]['platformName'] === 'iOS';
      instance._wIsAndroid = args[0]['platformName'] === 'Android';
      return instanceInit.apply(instance, args);
    };
    return instance;
  };
});

wd.addPromiseChainMethod('wBack', function(){
  return this._wIsIOS ?
    this.elementByName('back').sleep(1000).click().sleep(1000) :
    this.back();
});

wd.addPromiseChainMethod('wElements',function(xpath){

  return this.elementsByXPath(mapXPath(xpath));
});

wd.addPromiseChainMethod('wElement',function(xpath){
  return this
      .elementsByXPath(mapXPath(xpath))
      .then(function(el){
        return el[0];
      });
});

wd.addPromiseChainMethod('textOfXPath', function(xpath) {
  var nxpath = mapXPath(xpath);
  return this._wIsIOS ?
    this
      .elementsByXPath(nxpath)
      .then(function(el){
        return el[0];
      })
      .text() :
    this
      .elementsByXPath(nxpath)
      .then(function(el){
        return el[0];
      })
      .getProperty('description');
});

module.exports = wd;