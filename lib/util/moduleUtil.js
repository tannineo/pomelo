var os = require("os");
var admin = require("pomelo-admin");

var utils = require("./utils");
var Constants = require("./constants");
var pathUtil = require("./pathUtil");
var starter = require("../master/starter");

var logger = require("pomelo-logger").getLogger("pomelo", __filename);

var pro = module.exports;

/**
 * 加载admin模块
 * Load admin modules
 */
pro.loadModules = function(self, consoleService) {
  // load app register modules
  var _modules = self.app.get(Constants.KEYWORDS.MODULE);

  if (!_modules) {
    return;
  }

  var modules = [];
  for (var m in _modules) {
    modules.push(_modules[m]);
  }

  var record, moduleId, module;
  for (var i = 0, l = modules.length; i < l; i++) {
    record = modules[i];
    if (typeof record.module === "function") {
      // 如果是module的工厂方法则生成module
      module = record.module(record.opts, consoleService);
    } else {
      module = record.module;
    }

    moduleId = record.moduleId || module.moduleId;

    if (!moduleId) {
      logger.warn("ignore an unknown module.");
      continue;
    }

    // 注册module
    consoleService.register(moduleId, module);
    self.modules.push(module);
  }
};

/**
 * 启动所有module
 * @param {*} modules
 * @param {*} cb
 */
pro.startModules = function(modules, cb) {
  // invoke the start lifecycle method of modules

  if (!modules) {
    return;
  }
  startModule(null, modules, 0, cb);
};

/**
 * 加入默认的admin模块
 * Append the default system admin modules
 */
pro.registerDefaultModules = function(isMaster, app, closeWatcher) {
  if (!closeWatcher) {
    if (isMaster) {
      app.registerAdmin(require("../modules/masterwatcher"), { app: app });
    } else {
      app.registerAdmin(require("../modules/monitorwatcher"), { app: app });
    }
  }
  app.registerAdmin(admin.modules.watchServer, { app: app });
  app.registerAdmin(require("../modules/console"), {
    app: app,
    starter: starter
  });

  // 如果应用开启了 systemMonitor
  // 注册一堆监控module
  if (app.enabled("systemMonitor")) {
    // 不支持windows wwwwwww
    if (os.platform() !== Constants.PLATFORM.WIN) {
      app.registerAdmin(admin.modules.systemInfo);
      app.registerAdmin(admin.modules.nodeInfo);
    }
    app.registerAdmin(admin.modules.monitorLog, {
      path: pathUtil.getLogPath(app.getBase())
    });
    app.registerAdmin(admin.modules.scripts, {
      app: app,
      path: pathUtil.getScriptPath(app.getBase())
    });
    if (os.platform() !== Constants.PLATFORM.WIN) {
      app.registerAdmin(admin.modules.profiler);
    }
  }
};

/**
 * 启动module
 * 递归顺序启动
 *
 * @param {*} err
 * @param {*} modules
 * @param {*} index
 * @param {*} cb
 */
var startModule = function(err, modules, index, cb) {
  if (err || index >= modules.length) {
    utils.invokeCallback(cb, err);
    return;
  }

  var module = modules[index];
  if (module && typeof module.start === "function") {
    module.start(function(err) {
      startModule(err, modules, index + 1, cb);
    });
  } else {
    startModule(err, modules, index + 1, cb);
  }
};
