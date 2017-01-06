var wd = require('macaca-wd');
var _ = require('lodash');
var weex = require('./weex');

_.mapKeys({
  promiseChainRemote: wd.promiseChainRemote,
  promiseRemote: wd.promiseRemote,
  asyncRemote: wd.asyncRemote
}, function(func, method){
  wd[method] = function(){
    var instance = func.apply(wd, arguments);
    _.mapKeys(weex, function(overrideFunc, overrideMethod){
      var oldFunc = instance[overrideMethod];
      instance[overrideMethod] = function(){
        var hookValue = _.isFunction(overrideFunc) ? overrideFunc.apply(this, arguments) : overrideFunc;
        return _.isFunction(oldFunc) ? oldFunc.apply(this, hookValue) : oldFunc;
      };
    });
    return instance;
  };
});

module.exports = wd;