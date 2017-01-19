'use strict';

require('should');

var wd = require('../');

var browserName = process.env.browser || 'safari';
browserName = browserName.toLowerCase();

var iOSSafariOpts = {
  deviceName: 'iPhone 5s',
  platformName: 'iOS',
  browserName: 'Safari'
};

var AndroidChromeOpts = {
  platformName: 'Android',
  browserName: 'Chrome'
};


describe('macaca mobile sample', function() {
  this.timeout(5 * 60 * 1000);

  var driver = wd.promiseChainRemote({
    host: 'localhost',
    port: 3456
  });

  driver.configureHttp({
    timeout: 600 * 1000
  });

  before(function() {
    return driver
      .init(browserName === 'safari' ? iOSSafariOpts : AndroidChromeOpts);
  });

  after(function() {
    return driver
      .sleep(1000)
      .quit();
  });

  it('#0 should works with macaca', function() {
    console.log(driver.getInitConfig());
    return driver
      .get('https://www.taobao.com')
      .elementById('index-kw')
      .sendKeys('macaca')
      .elementById('index-bn')
      .tap()
      .sleep(5000)
      .source()
      .then(function(html) {
        html.should.containEql('macaca');
      })
      .takeScreenshot();
  });



});